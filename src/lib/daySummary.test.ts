import { expect, test } from 'vitest';
import { attractionById } from '../data/attractions';
import type { Attraction } from '../data/types';
import { summarizeDay } from './daySummary';
import type { Pace, Who } from './trips';

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

const opts = (o: Partial<{ dayStart: string; pace: Pace; date: Date | null; who: Who }> = {}) => ({
  dayStart: '09:00',
  pace: 'normal' as Pace,
  date: null as Date | null,
  who: 'couple' as Who,
  ...o,
});

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
  const s = summarizeDay([takao, hardMuseum], opts({ pace: 'packed' }));
  expect(s.flags.some((f) => f.factor === 'effort' && /back to back/i.test(f.text))).toBe(true);
  // With an easy stop between them they aren't back to back.
  const apart = summarizeDay([takao, teamlab, hardMuseum], opts({ pace: 'packed' }));
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

test('crowd ≥ 70 at the planned hour is flagged', () => {
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
  // The weekday curve is used when there's no date: Takao at 09:00 isn't busy then.
  expect(s.flags.some((f) => /busy/i.test(f.text))).toBe(false);
});

test('over budget is flagged', () => {
  // Takao and teamLab alone fill a relaxed day exactly (480 min with the train); Sensō-ji tips it over.
  const relaxed = summarizeDay([takao, teamlab, get('senso-ji')], opts({ pace: 'relaxed' }));
  expect(relaxed.logistics.budgetMin).toBe(480);
  expect(relaxed.logistics.usedMin).toBeGreaterThan(480);
  expect(relaxed.flags.some((f) => f.factor === 'logistics' && /over/i.test(f.text))).toBe(true);
  const packed = summarizeDay([takao, teamlab], opts({ pace: 'packed' }));
  expect(packed.flags.some((f) => f.factor === 'logistics' && /over/i.test(f.text))).toBe(false);
});

test('time budget counts travel', () => {
  const s = summarizeDay([takao, teamlab], opts());
  expect(s.logistics.travelMin).toBeGreaterThan(0);
  expect(s.logistics.usedMin).toBeGreaterThan(s.logistics.travelMin);
});

test('book ahead flag when booking is required', () => {
  const s = summarizeDay([takao, teamlab], opts({ pace: 'packed' }));
  const book = s.flags.filter((f) => /book ahead/i.test(f.text));
  expect(book).toHaveLength(1);
  expect(book[0]).toMatchObject({ factor: 'logistics', stopId: 'teamlab-planets' });
});

test('a stop planned outside its opening hours is flagged', () => {
  const morning = summarizeDay([goldenGai], opts({ dayStart: '09:00' }));
  expect(morning.flags.some((f) => f.factor === 'logistics' && /opening hours/i.test(f.text))).toBe(true);
  const night = summarizeDay([goldenGai], opts({ dayStart: '20:00' }));
  expect(night.flags.some((f) => /opening hours/i.test(f.text))).toBe(false);
});

test('a stop rated poor for who is going gets a vibe flag', () => {
  const family = summarizeDay([goldenGai], opts({ who: 'family', dayStart: '20:00' }));
  expect(family.flags.some((f) => f.factor === 'vibe' && f.stopId === 'golden-gai' && /famil/i.test(f.text))).toBe(true);
  const friends = summarizeDay([goldenGai], opts({ who: 'friends', dayStart: '20:00' }));
  expect(friends.flags.some((f) => f.factor === 'vibe')).toBe(false);
});

test('cost range runs from mustPay to withExtras; cash-only flagged', () => {
  const s = summarizeDay([takao, teamlab], opts());
  // Takao: train 800 (+ cable car 950, soba 1200 optional). teamLab: 3,800 + 700 transport.
  expect(s.cost).toEqual({ min: 5300, max: 7450, cashOnly: false, cash: 'mostly-cash' });
  expect(s.flags.some((f) => f.factor === 'cost')).toBe(false);
  const cash = summarizeDay([yanaka], opts({ dayStart: '10:00' }));
  expect(cash.cost.cashOnly).toBe(true);
  expect(cash.flags.some((f) => f.factor === 'cost' && f.stopId === 'yanaka-ginza')).toBe(true);
});

test('vibe gives a local word from the weighted local value', () => {
  expect(summarizeDay([teamlab], opts()).vibe.localWord).toBe('Touristy');
  expect(summarizeDay([shimokita], opts({ dayStart: '12:00' })).vibe.localWord).toBe('Local');
});

test('line is short and mentions the shape of the day', () => expect(summarizeDay([takao, teamlab], opts()).line).toMatch(/morning/i));

test('line for one stop is "A <effort> <setting> day"', () => {
  expect(summarizeDay([takao], opts()).line).toBe('A big outdoor day');
  expect(summarizeDay([teamlab], opts()).line).toBe('An easy city day');
});

test('line keeps the hard part instead of averaging it away', () => {
  expect(summarizeDay([takao, teamlab], opts({ pace: 'packed' })).line).toBe('Big outdoor morning, easy city afternoon'); // Takao to teamLab is now about 1 h 40, not 3 h 55
});

test('line says long and packed when over budget or more than 4 stops', () => {
  expect(summarizeDay([takao, teamlab, get('senso-ji')], opts({ pace: 'relaxed' })).line).toMatch(/^A long, packed day/);
  const five = [get('senso-ji'), get('tokyo-skytree'), get('kiyosumi-gardens'), get('ryogoku-sumo'), teamlab];
  const s = summarizeDay(five, opts({ pace: 'packed' }));
  expect(s.line).toMatch(/^A long, packed day/);
  expect(s.line.length).toBeLessThan(60);
});

test('line stays under 60 characters', () => {
  const ids = ['senso-ji', 'meiji-jingu', 'tokyo-national-museum', 'todoroki-valley', 'kiyosumi-gardens', 'mount-takao'];
  for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    for (const pace of ['relaxed', 'packed'] as Pace[]) {
      const line = summarizeDay([get(a), get(b)], opts({ pace })).line;
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
