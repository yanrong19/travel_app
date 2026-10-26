// A day's plan read factor by factor. Never one score: the hard or risky parts of a day stay visible
// on their own rows and as flags, instead of being averaged into a single word.
import { CROWD_START_HOUR, type Attraction } from '../data/types';
import { isRainProof, localWord, mustPay, withExtras } from './factors';
import { DAYS_LONG, duration } from './format';
import { dayLengthMin, schedule, type ScheduledStop } from './schedule';
import type { Pace, Who } from './trips';

/** How much cash the day needs: the most cash-bound stop decides. */
export type CashLevel = 'cash-only' | 'mostly-cash' | 'cards';

export type Flag = { factor: 'effort' | 'conditions' | 'vibe' | 'logistics' | 'cost'; text: string; stopId?: string };

export interface DaySummary {
  empty: boolean;
  line: string;
  effort: { hardest: { id: string; name: string; level: number } | null; onFeetMin: number; perStop: { id: string; level: number }[] };
  conditions: { text: string; rainSensitive: string[] };
  vibe: { naturePct: number; cityPct: number; localWord: string };
  logistics: { usedMin: number; travelMin: number; budgetMin: number };
  cost: { min: number; max: number; cashOnly: boolean; cash: CashLevel };
  flags: Flag[];
}

const NOON = 12 * 60;
const EVENING = 17 * 60;
const HARD = 4;
const MAX_ON_FEET = 6 * 60;
const BUSY = 70;
const MAX_STOPS = 4;
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WHO_POOR: Record<Who, string> = {
  solo: 'Not great solo',
  couple: 'Not great for couples',
  family: 'Not great for families',
  friends: 'Not great for a group of friends',
};

/** Average of `value` over the stops, weighted by how long each one is planned for. */
function weighted(stops: ScheduledStop[], value: (a: Attraction) => number): number {
  const total = stops.reduce((s, x) => s + (x.end - x.start), 0);
  if (total <= 0) return 0;
  return stops.reduce((s, x) => s + value(x.a) * (x.end - x.start), 0) / total;
}

// ---------- the one-line summary ----------

/** The highest level decides, so one hard stop is never diluted by easy ones. */
const effortWord = (level: number) => (level >= HARD ? 'big' : level === 3 ? 'moderate' : 'easy');
const settingWord = (nature: number) => (nature >= 60 ? 'outdoor' : nature <= 40 ? 'city' : 'mixed');
const article = (word: string) => (/^[aeiou]/.test(word) ? 'An' : 'A');
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Part {
  name: string;
  effort: string;
  setting: string;
}

/** The day in at most two parts: stops starting before noon, and the rest (afternoon, or evening if it starts at 17:00 or later). */
function parts(stops: ScheduledStop[]): Part[] {
  const morning = stops.filter((s) => s.start < NOON);
  const later = stops.filter((s) => s.start >= NOON);
  const part = (list: ScheduledStop[], name: string): Part => ({
    name,
    effort: effortWord(Math.max(...list.map((s) => s.a.effort.level))),
    setting: settingWord(weighted(list, (a) => a.vibe.nature)),
  });
  const out: Part[] = [];
  if (morning.length) out.push(part(morning, 'morning'));
  if (later.length) out.push(part(later, later[0].start >= EVENING ? 'evening' : 'afternoon'));
  return out;
}

function makeLine(stops: ScheduledStop[], packed: boolean): string {
  const ps = parts(stops);
  const [first, second] = ps;
  const uniform = !second || (first.effort === second.effort && first.setting === second.setting);
  const build = (withSetting: boolean) => {
    const words = (p: Part) => (withSetting ? `${p.effort} ${p.setting}` : p.effort);
    if (uniform) {
      if (packed) return `A long, packed day of ${words(first)} stops`;
      const when = stops.length > 1 && !second ? first.name : 'day';
      return `${article(first.effort)} ${words(first)} ${when}`;
    }
    const shape = `${words(first)} ${first.name}, ${words(second)} ${second.name}`;
    return packed ? `A long, packed day: ${shape}` : cap(shape);
  };
  const full = build(true);
  // Drop the setting before the effort if the line runs long: effort is the part people get caught out by.
  return full.length < 60 ? full : build(false);
}

// ---------- opening hours ----------

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** That day's hours. Without a date, the hours only if every open day shares them. */
function hoursFor(a: Attraction, weekday: number | null): [string, string] | null | undefined {
  const { hours } = a.logistics;
  if (weekday !== null) return hours[weekday];
  const open = hours.filter((h): h is [string, string] => h !== null);
  if (!open.length) return undefined;
  return open.every((h) => h[0] === open[0][0] && h[1] === open[0][1]) ? open[0] : undefined;
}

/** True when the visit starts before opening, after last entry, or runs past closing. */
function outsideHours(s: ScheduledStop, [o, c]: [string, string]): boolean {
  const open = toMin(o);
  let close = toMin(c);
  if (close <= open) close += 24 * 60; // closes after midnight
  const lastStart = close - (s.a.logistics.lastEntryMin ?? 0);
  return s.start < open || s.start > lastStart || s.end > close;
}

// ---------- the summary ----------

export function summarizeDay(
  stops: Attraction[],
  opts: { dayStart: string; pace: Pace; date: Date | null; who: Who },
): DaySummary {
  const budgetMin = dayLengthMin(opts.pace);
  if (!stops.length) {
    return {
      empty: true,
      line: '',
      effort: { hardest: null, onFeetMin: 0, perStop: [] },
      conditions: { text: '', rainSensitive: [] },
      vibe: { naturePct: 0, cityPct: 0, localWord: '' },
      logistics: { usedMin: 0, travelMin: 0, budgetMin },
      cost: { min: 0, max: 0, cashOnly: false, cash: 'cards' },
      flags: [],
    };
  }

  const plan = schedule(stops, opts.dayStart);
  const { date } = opts;
  // logistics.hours is Monday first; getDay() is Sunday = 0.
  const weekday = date ? (date.getDay() + 6) % 7 : null;
  const weekend = date ? date.getDay() === 0 || date.getDay() === 6 : false;
  const flags: Flag[] = [];
  const flag = (factor: Flag['factor'], text: string, a?: Attraction) =>
    flags.push(a ? { factor, text: `${text} (${a.name})`, stopId: a.id } : { factor, text });

  // Effort
  const hardestStop = stops.reduce((h, a) => (a.effort.level > h.effort.level ? a : h));
  // On your feet: time on foot at each place, plus the walk from and back to its station.
  const onFeetMin = stops.reduce((s, a) => s + a.effort.onFeetMin + 2 * a.logistics.walkMin, 0);
  for (let i = 1; i < stops.length; i++) {
    const [prev, cur] = [stops[i - 1], stops[i]];
    if (prev.effort.level >= HARD && cur.effort.level >= HARD)
      flags.push({ factor: 'effort', text: `Two hard stops back to back: ${prev.name}, then ${cur.name}`, stopId: cur.id });
  }
  if (onFeetMin > MAX_ON_FEET) flag('effort', `Over 6 h on your feet: about ${duration(onFeetMin)}`);

  // Conditions: in each part of the day, the weakest stop decides.
  const rainSensitive = stops.filter((a) => !isRainProof(a)).map((a) => a.id);
  const conditionsText = weatherText(plan);
  if (date) {
    const m = date.getMonth();
    for (const a of stops) if (a.conditions.months[m] === 'poor') flag('conditions', `Out of season in ${MONTHS_LONG[m]}`, a);
  }

  // Vibe
  const naturePct = Math.round(weighted(plan, (a) => a.vibe.nature));
  for (const s of plan) {
    const curve = weekend ? s.a.vibe.crowds.weekend : s.a.vibe.crowds.weekday;
    const hour = Math.floor(s.start / 60);
    const busy = curve[hour - CROWD_START_HOUR];
    if (busy != null && busy >= BUSY) flag('vibe', `Busy around ${String(hour).padStart(2, '0')}:00`, s.a);
  }
  for (const a of stops) if (a.vibe.suits[opts.who] === 'poor') flag('vibe', WHO_POOR[opts.who], a);

  // Logistics
  const travelMin = plan.reduce((s, x) => s + x.travelBefore, 0);
  const usedMin = plan[plan.length - 1].end - plan[0].start;
  if (usedMin > budgetMin) flag('logistics', `Over your ${budgetMin / 60} h day by ${duration(usedMin - budgetMin)}`);
  for (const s of plan) {
    const hours = hoursFor(s.a, weekday);
    if (hours === null) flag('logistics', `Closed on ${DAYS_LONG[weekday!]}s`, s.a);
    else if (hours && outsideHours(s, hours)) flag('logistics', `Outside opening hours, ${hours[0]}–${hours[1]}`, s.a);
  }
  for (const a of stops) if (a.logistics.booking === 'required') flag('logistics', 'Book ahead', a);

  // Cost
  const cashOnly = stops.some((a) => a.cost.cash === 'cash-only');
  const cash: CashLevel = cashOnly ? 'cash-only' : stops.some((a) => a.cost.cash === 'mostly-cash') ? 'mostly-cash' : 'cards';
  for (const a of stops) if (a.cost.cash === 'cash-only') flag('cost', 'Cash only', a);

  const packed = stops.length > MAX_STOPS || usedMin > budgetMin;
  return {
    empty: false,
    line: makeLine(plan, packed),
    effort: {
      hardest: { id: hardestStop.id, name: hardestStop.name, level: hardestStop.effort.level },
      onFeetMin,
      perStop: stops.map((a) => ({ id: a.id, level: a.effort.level })),
    },
    conditions: { text: conditionsText, rainSensitive },
    vibe: { naturePct, cityPct: 100 - naturePct, localWord: localWord(weighted(plan, (a) => a.vibe.local)) },
    logistics: { usedMin, travelMin, budgetMin },
    cost: { min: stops.reduce((s, a) => s + mustPay(a), 0), max: stops.reduce((s, a) => s + withExtras(a), 0), cashOnly, cash },
    flags,
  };
}

/** "Morning needs dry weather; afternoon is rain-proof". Any rain-sensitive stop makes its part of the day need dry weather. */
function weatherText(plan: ScheduledStop[]): string {
  const ps = parts(plan).map((p) => {
    const inPart = plan.filter((s) => (p.name === 'morning' ? s.start < NOON : s.start >= NOON));
    return { name: p.name, dry: inPart.some((s) => !isRainProof(s.a)) };
  });
  if (ps.every((p) => p.dry)) return 'Needs dry weather all day';
  if (ps.every((p) => !p.dry)) return 'Rain-proof all day';
  return cap(ps.map((p) => `${p.name} ${p.dry ? 'needs dry weather' : 'is rain-proof'}`).join('; '));
}
