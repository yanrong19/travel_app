import { expect, test } from 'vitest';
import { ATTRACTIONS, attractionById } from '../data/attractions';
import type { Attraction, Rating } from '../data/types';
import { busyStop } from './bestTime';
import { summarizeDay } from './daySummary';
import { duration as durationOf } from './format';
import { schedule } from './schedule';

const get = (id: string) => attractionById(id)!;
/** A copy of an attraction with some fields changed. */
const tweak = (a: Attraction, change: (c: Attraction) => void): Attraction => {
  const c = structuredClone(a);
  change(c);
  return c;
};

const takao = get('mount-takao');
const teamlab = get('teamlab-planets');
const museum = get('tokyo-national-museum'); // closed on Mondays
const tsukiji = get('tsukiji-outer-market'); // closed on Sundays
const shimokita = get('shimokitazawa');
const goldenGai = get('golden-gai'); // poor for families, opens 19:00
const yanaka = get('yanaka-ginza'); // cash only

/** The day's own start and end (09:00 to 19:00 unless changed), its date, and today (a Wednesday) for undated crowds. */
const opts = (o: Partial<{ start: string; end: string; date: Date | null; today: Date }> = {}) => ({
  start: '09:00',
  end: '19:00',
  date: null as Date | null,
  today: new Date(2026, 9, 28),
  ...o,
});
// The old paces' lengths, as a day from 09:00.
const RELAXED = { end: '17:00' };
const PACKED = { end: '21:00' };

const MONDAY = new Date(2026, 9, 26);
const WEDNESDAY = new Date(2026, 9, 28);
const SATURDAY = new Date(2026, 9, 31);
const SUNDAY = new Date(2026, 10, 1);

test('empty day', () => expect(summarizeDay([], opts()).empty).toBe(true));

test('a hard nature stop and an easy city stop are not averaged', () => {
  const s = summarizeDay([takao, teamlab], opts());
  expect(s.effort.hardest?.id).toBe('mount-takao');
  expect(s.vibe.naturePct + s.vibe.cityPct).toBe(100);
  expect(s.vibe.naturePct).toBeGreaterThan(50); // Takao's visit is longer
});

test('effort lists every stop in order with its level', () => {
  const s = summarizeDay([teamlab, takao], opts());
  expect(s.effort.perStop).toEqual([
    { id: 'teamlab-planets', level: 1 },
    { id: 'mount-takao', level: 4 },
  ]);
  expect(s.effort.hardest).toEqual({ id: 'mount-takao', name: 'Mount Takao', level: 4 });
});

test('back-to-back hard stops are flagged', () => {
  const hardMuseum = tweak(museum, (a) => (a.effort.level = 4));
  const s = summarizeDay([takao, hardMuseum], opts(PACKED));
  expect(s.flags.some((f) => f.factor === 'effort' && /back to back/i.test(f.text))).toBe(true);
  // With an easy stop between them they aren't back to back.
  const apart = summarizeDay([takao, teamlab, hardMuseum], opts(PACKED));
  expect(apart.flags.some((f) => /back to back/i.test(f.text))).toBe(false);
});

test('over 360 min on foot is flagged', () => {
  const s = summarizeDay([takao, shimokita], opts());
  expect(s.effort.onFeetMin).toBeGreaterThan(360);
  expect(s.flags.some((f) => f.factor === 'effort' && /on your feet/i.test(f.text))).toBe(true);
  const light = summarizeDay([teamlab], opts());
  expect(light.effort.onFeetMin).toBeLessThanOrEqual(360);
  expect(light.flags.some((f) => /on your feet/i.test(f.text))).toBe(false);
});

test('rain-sensitive stops are listed', () => {
  const s = summarizeDay([takao, teamlab], opts());
  expect(s.conditions.rainSensitive).toEqual(['mount-takao']);
  expect(s.conditions.text).toMatch(/morning needs dry weather/i);
  expect(s.conditions.text).toMatch(/rain-proof/i);
  expect(summarizeDay([teamlab], opts()).conditions.rainSensitive).toEqual([]);
});

test('closed on that weekday is flagged', () => {
  // The museum closes on Mondays (hours[0]); Tsukiji on Sundays (hours[6]).
  const mon = summarizeDay([tsukiji, museum], opts({ date: MONDAY }));
  const closedMon = mon.flags.filter((f) => f.factor === 'logistics' && /closed/i.test(f.text));
  expect(closedMon.map((f) => f.stopId)).toEqual(['tokyo-national-museum']);

  const sun = summarizeDay([tsukiji, museum], opts({ date: SUNDAY }));
  const closedSun = sun.flags.filter((f) => f.factor === 'logistics' && /closed/i.test(f.text));
  expect(closedSun.map((f) => f.stopId)).toEqual(['tsukiji-outer-market']);
});

test('out-of-season month is flagged', () => {
  // Takao's June is rated poor (rainy season).
  const june = summarizeDay([takao], opts({ date: new Date(2026, 5, 10) }));
  expect(june.flags.some((f) => f.factor === 'conditions' && f.stopId === 'mount-takao' && /June/.test(f.text))).toBe(true);
  const may = summarizeDay([takao], opts({ date: new Date(2026, 4, 10) }));
  expect(may.flags.some((f) => /season/i.test(f.text))).toBe(false);
});

test('a stop whose mean crowd is ≥ 70 is flagged, as the attraction page says it', () => {
  // Takao at 09:00: quiet on a weekday, busy on a weekend.
  const sat = summarizeDay([takao], opts({ date: SATURDAY }));
  expect(sat.flags.some((f) => f.factor === 'vibe' && f.stopId === 'mount-takao' && /busy/i.test(f.text))).toBe(true);
  const wed = summarizeDay([takao], opts({ date: WEDNESDAY }));
  expect(wed.flags.some((f) => /busy/i.test(f.text))).toBe(false);
});

test('summary without dates skips date checks', () => {
  const offSeason = tweak(takao, (a) => (a.conditions.months = a.conditions.months.map(() => 'poor')));
  const closedAllWeek = tweak(museum, (a) => (a.logistics.hours = a.logistics.hours.map(() => null)));
  let s!: ReturnType<typeof summarizeDay>;
  expect(() => (s = summarizeDay([offSeason, closedAllWeek], opts({ date: null })))).not.toThrow();
  expect(s.flags.some((f) => /closed|season/i.test(f.text))).toBe(false);
  // Without a date, crowds are read on today's weekday, as the attraction page does: Takao at 09:00
  // is quiet on a Wednesday, busy on a Saturday.
  expect(s.flags.some((f) => /busy/i.test(f.text))).toBe(false);
  const sat = summarizeDay([takao], opts({ date: null, today: SATURDAY }));
  expect(sat.flags.some((f) => f.factor === 'vibe' && /busy/i.test(f.text))).toBe(true);
});

test('over budget is flagged', () => {
  // Takao and teamLab alone fill a 09:00–17:00 day exactly (480 min with the train); Sensō-ji tips it over.
  const relaxed = summarizeDay([takao, teamlab, get('senso-ji')], opts(RELAXED));
  expect(relaxed.logistics.budgetMin).toBe(480);
  expect(relaxed.logistics.usedMin).toBeGreaterThan(480);
  expect(relaxed.flags.some((f) => f.factor === 'logistics' && /over/i.test(f.text))).toBe(true);
  const packed = summarizeDay([takao, teamlab], opts(PACKED));
  expect(packed.flags.some((f) => f.factor === 'logistics' && /over/i.test(f.text))).toBe(false);
});

test('time budget counts travel', () => {
  const s = summarizeDay([takao, teamlab], opts());
  expect(s.logistics.travelMin).toBeGreaterThan(0);
  expect(s.logistics.usedMin).toBeGreaterThan(s.logistics.travelMin);
});

test('book ahead flag when booking is required', () => {
  const s = summarizeDay([takao, teamlab], opts(PACKED));
  const book = s.flags.filter((f) => /book ahead/i.test(f.text));
  expect(book).toHaveLength(1);
  expect(book[0]).toMatchObject({ factor: 'logistics', stopId: 'teamlab-planets' });
});

test('a stop planned outside its opening hours is flagged', () => {
  const morning = summarizeDay([goldenGai], opts({ start: '09:00' }));
  expect(morning.flags.some((f) => f.factor === 'logistics' && /opening hours/i.test(f.text))).toBe(true);
  const night = summarizeDay([goldenGai], opts({ start: '20:00' }));
  expect(night.flags.some((f) => /opening hours/i.test(f.text))).toBe(false);
});

test('the budget is the day’s own start to end, and the schedule starts at its start', () => {
  const s = summarizeDay([takao, teamlab], opts({ start: '07:30', end: '22:15' }));
  expect(s.logistics.budgetMin).toBe(14 * 60 + 45);
  expect(summarizeDay([], opts({ start: '10:00', end: '12:00' })).logistics.budgetMin).toBe(120);
  // Golden Gai opens at 19:00: from a 20:00 start it's inside its hours, from 09:00 it isn't.
  expect(summarizeDay([goldenGai], opts({ start: '20:00', end: '23:59' })).flags.some((f) => /opening hours/i.test(f.text))).toBe(false);
});

test('over budget says by how much, in hours and minutes', () => {
  const s = summarizeDay([takao, teamlab], opts({ start: '09:00', end: '12:30' }));
  const over = s.flags.find((f) => f.factor === 'logistics' && /^Over/.test(f.text));
  expect(over?.text).toBe(`Over your 3 h 30 min day by ${durationOf(s.logistics.usedMin - 210)}`);
});

test('no who’s-going flag: a stop poor for families is not flagged for it', () => {
  const s = summarizeDay([goldenGai], opts({ start: '20:00', end: '23:59' }));
  expect(s.flags.some((f) => f.factor === 'vibe' && /not great/i.test(f.text))).toBe(false);
});

test('cost range runs from mustPay to withExtras; cash-only flagged', () => {
  const s = summarizeDay([takao, teamlab], opts());
  // Takao: free to enter (+ cable car 950, soba 1200 optional). teamLab: 3,800.
  expect(s.cost).toEqual({ min: 3800, max: 5950, cashOnly: false, cash: 'mostly-cash' });
  expect(s.flags.some((f) => f.factor === 'cost')).toBe(false);
  const cash = summarizeDay([yanaka], opts({ start: '10:00' }));
  expect(cash.cost.cashOnly).toBe(true);
  expect(cash.flags.some((f) => f.factor === 'cost' && f.stopId === 'yanaka-ginza')).toBe(true);
});

test('vibe gives a local word from the weighted local value', () => {
  expect(summarizeDay([teamlab], opts()).vibe.localWord).toBe('Touristy');
  expect(summarizeDay([shimokita], opts({ start: '12:00' })).vibe.localWord).toBe('Local');
});

test('line is short and mentions the shape of the day', () => expect(summarizeDay([takao, teamlab], opts()).line).toMatch(/morning/i));

test('line for one stop is "A <effort> <setting> day"', () => {
  expect(summarizeDay([takao], opts()).line).toBe('A big outdoor day');
  expect(summarizeDay([teamlab], opts()).line).toBe('An easy city day');
});

test('line keeps the hard part instead of averaging it away', () => {
  expect(summarizeDay([takao, teamlab], opts(PACKED)).line).toBe('Big outdoor morning, easy city afternoon'); // Takao to teamLab is now about 1 h 40, not 3 h 55
});

test('line says long and packed when over budget or more than 4 stops', () => {
  expect(summarizeDay([takao, teamlab, get('senso-ji')], opts(RELAXED)).line).toMatch(/^A long, packed day/);
  const five = [get('senso-ji'), get('tokyo-skytree'), get('kiyosumi-gardens'), get('ryogoku-sumo'), teamlab];
  const s = summarizeDay(five, opts(PACKED));
  expect(s.line).toMatch(/^A long, packed day/);
  expect(s.line.length).toBeLessThan(60);
});

test('line stays under 60 characters', () => {
  const ids = ['senso-ji', 'meiji-jingu', 'tokyo-national-museum', 'todoroki-valley', 'kiyosumi-gardens', 'mount-takao'];
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    for (const day of [RELAXED, PACKED]) {
      const line = summarizeDay([get(a), get(b)], opts(day)).line;
      expect(line.length, line).toBeLessThan(60);
    }
  }
});

test('cash level: the most cash-bound stop decides', () => {
  expect(summarizeDay([teamlab], opts()).cost.cash).toBe('cards');
  // Mount Takao is mostly cash, so the day needs some cash even with teamLab's cards.
  expect(summarizeDay([teamlab, takao], opts()).cost.cash).toBe('mostly-cash');
  expect(summarizeDay([takao, yanaka], opts()).cost.cash).toBe('cash-only');
  expect(summarizeDay([], opts()).cost.cash).toBe('cards');
});

// ---------- time of day ----------

const todFlags = (s: ReturnType<typeof summarizeDay>) => s.flags.filter((f) => f.factor === 'conditions' && /time of day|best in the/.test(f.text));
/** A copy with its morning / afternoon / evening ratings replaced. */
const slots = (a: Attraction, morning: Rating, afternoon: Rating, evening: Rating) =>
  tweak(a, (c) => (c.conditions.timeOfDay = { ...c.conditions.timeOfDay, morning, afternoon, evening }));

test('a stop in a poor slot is flagged and pointed to its best slot', () => {
  // A teamLab whose morning is poor, at 10:00: best in the evening.
  const nightTeamlab = slots(teamlab, 'poor', 'ok', 'good');
  const s = summarizeDay([nightTeamlab], opts({ start: '10:00' }));
  expect(todFlags(s)).toEqual([{ factor: 'conditions', text: 'teamLab Planets is best in the evening', stopId: 'teamlab-planets' }]);
  // Golden Gai, for real, at 10:00.
  const gai = summarizeDay([goldenGai], opts({ start: '10:00' }));
  expect(todFlags(gai).map((f) => f.text)).toEqual(['Golden Gai is best in the evening']);
});

test('a stop in a good or ok slot is not flagged', () => {
  expect(todFlags(summarizeDay([goldenGai], opts({ start: '20:00' })))).toEqual([]);
  expect(todFlags(summarizeDay([tsukiji], opts({ start: '08:00' })))).toEqual([]);
  // Afternoon rated ok: not flagged.
  expect(todFlags(summarizeDay([slots(teamlab, 'poor', 'ok', 'good')], opts({ start: '13:00' })))).toEqual([]);
});

test('a stop poor at every time of day says so', () => {
  const s = summarizeDay([slots(teamlab, 'poor', 'poor', 'poor')], opts({ start: '10:00' }));
  expect(todFlags(s).map((f) => f.text)).toEqual(["teamLab Planets isn't great at any time of day"]);
});

test('time-of-day boundaries: 11:59 is morning, 12:00 afternoon, 17:00 evening', () => {
  const amOnly = slots(teamlab, 'good', 'poor', 'poor');
  expect(todFlags(summarizeDay([amOnly], opts({ start: '11:59' })))).toEqual([]);
  expect(todFlags(summarizeDay([amOnly], opts({ start: '12:00' }))).map((f) => f.text)).toEqual(['teamLab Planets is best in the morning']);
  const pmOnly = slots(teamlab, 'poor', 'good', 'poor');
  expect(todFlags(summarizeDay([pmOnly], opts({ start: '16:59' })))).toEqual([]);
  expect(todFlags(summarizeDay([pmOnly], opts({ start: '17:00' }))).map((f) => f.text)).toEqual(['teamLab Planets is best in the afternoon']);
});

test('the busy flag agrees with the attraction page’s busyStop for every attraction', () => {
  for (const a of ATTRACTIONS) {
    for (const date of [WEDNESDAY, SATURDAY]) {
      for (const start of ['09:00', '13:00']) {
        const [s] = schedule([a], start);
        const flagged = summarizeDay([a], opts({ start, end: '23:00', date })).flags.some((f) => f.factor === 'vibe' && /busy/i.test(f.text));
        expect(flagged, `${a.id} ${start} ${date.getDay()}`).toBe(busyStop(a, (date.getDay() + 6) % 7, s));
      }
    }
  }
});
