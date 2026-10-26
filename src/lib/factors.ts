// Derived readings: the short words on the fit line, the "easy to miss" flags
// and the list filters. All computed from the attraction data.
import type { Attraction } from '../data/types';
import type { LineId } from '../data/lines';
import { DAYS_LONG, duration, yen } from './format';

export const EFFORT_LABELS = ['Stroll', 'Easy', 'Moderate', 'Hard', 'Very hard'];

export const isRainProof = (a: Attraction) => a.conditions.weather.rain !== 'poor' && a.conditions.covered >= 60;

/** Fixed costs only: entry plus the extras you can't skip. */
export const mustPay = (a: Attraction) => a.cost.entry + a.cost.extras.filter((e) => !e.optional).reduce((s, e) => s + e.yen, 0);
export const withExtras = (a: Attraction) => a.cost.entry + a.cost.extras.reduce((s, e) => s + e.yen, 0);

/** Door-to-door time range: travel there and back, queue, visit. */
export const realTime = (a: Attraction): [number, number] => {
  const { travelMin, queueMin, visitMin } = a.logistics;
  return [travelMin * 2 + queueMin[0] + visitMin[0], travelMin * 2 + queueMin[1] + visitMin[1]];
};

export function localWord(n: number) {
  if (n >= 65) return 'Local';
  if (n >= 40) return 'Mixed';
  return 'Touristy';
}

export function natureWord(n: number) {
  if (n >= 65) return 'Nature';
  if (n >= 35) return 'Green and built';
  return 'City';
}

/** One short reading per line, shown under each station. */
export function readings(a: Attraction): Record<LineId, string> {
  const w = a.conditions.weather;
  const conditions = isRainProof(a) ? 'Rain-proof' : w.rain === 'poor' ? 'Dry days' : 'Fair weather';
  const [lo, hi] = realTime(a);
  const avg = (lo + hi) / 2;
  return {
    conditions,
    effort: EFFORT_LABELS[a.effort.level - 1],
    vibe: localWord(a.vibe.local),
    logistics: avg >= 60 ? `${Math.round((avg / 60) * 2) / 2} h` : `${Math.round(avg)} min`,
    cost: yen(mustPay(a)),
  };
}

export interface Flag {
  line: LineId;
  text: string;
  /** Higher sorts first. */
  weight: number;
}

/** Things people tend to miss when they plan. */
export function flags(a: Attraction): Flag[] {
  const out: Flag[] = [];
  const { conditions: c, effort: e, logistics: l, cost } = a;

  const closed = l.hours.map((h, i) => (h ? null : DAYS_LONG[i])).filter(Boolean) as string[];
  if (closed.length && closed.length < 7) out.push({ line: 'logistics', text: `Closed on ${closed.join(' and ')}s`, weight: 9 });
  if (l.booking === 'required' && l.leadDays)
    out.push({ line: 'logistics', text: `Book about ${leadText(l.leadDays)} ahead`, weight: 10 });
  else if (l.booking === 'recommended' && l.leadDays && l.leadDays >= 7)
    out.push({ line: 'logistics', text: `Good slots go ${leadText(l.leadDays)} ahead`, weight: 7 });
  if (l.lastEntryMin) out.push({ line: 'logistics', text: `Last entry ${duration(l.lastEntryMin)} before closing`, weight: 6 });
  if (l.lastTrainNote) out.push({ line: 'logistics', text: firstSentence(l.lastTrainNote), weight: 7 });
  if (c.months.filter((m) => m === 'poor').length >= 6)
    out.push({ line: 'conditions', text: firstSentence(c.monthsNote), weight: 10 });
  if (c.weather.wind === 'poor' && c.weather.rain === 'poor')
    out.push({ line: 'conditions', text: 'Rain or strong wind closes it', weight: 8 });
  else if (c.weather.rain === 'poor') out.push({ line: 'conditions', text: 'Not worth it in rain', weight: 7 });
  if (c.visibility === 'critical') out.push({ line: 'conditions', text: 'Pointless in low cloud or haze', weight: 6 });
  if (c.weather.heat === 'poor') out.push({ line: 'conditions', text: 'Hard going in summer heat', weight: 4 });
  if (e.recovery === 'high') out.push({ line: 'effort', text: 'Plan a quiet evening afterwards', weight: 6 });
  if (e.steps >= 300) out.push({ line: 'effort', text: `About ${e.steps} steps of stairs`, weight: 5 });
  if (e.triggers.includes('water')) out.push({ line: 'effort', text: 'You get wet feet', weight: 4 });
  if (cost.cash === 'cash-only') out.push({ line: 'cost', text: 'Bring cash', weight: 7 });
  const extras = mustPay(a) - cost.entry;
  if (extras > cost.entry && extras >= 1000)
    out.push({ line: 'cost', text: `Extras cost more than entry: ${yen(extras)}`, weight: 5 });
  if (l.etiquette) out.push({ line: 'vibe', text: firstSentence(l.etiquette), weight: 5 });

  return out.sort((x, y) => y.weight - x.weight);
}

function leadText(days: number) {
  if (days >= 28) return `${Math.round(days / 30) || 1} month${days >= 45 ? 's' : ''}`;
  if (days >= 7) return `${Math.round(days / 7)} weeks`;
  return `${days} days`;
}

const firstSentence = (s: string) => s.split(/(?<=\.)\s/)[0].replace(/\.$/, '');

export type FilterId = 'all' | 'rain' | 'easy' | 'local' | 'free';

export const FILTERS: { id: FilterId; label: string; test: (a: Attraction) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'rain', label: 'Rain-proof', test: isRainProof },
  { id: 'easy', label: 'Easy', test: (a) => a.effort.level <= 2 },
  { id: 'local', label: 'Local', test: (a) => a.vibe.local >= 65 },
  { id: 'free', label: 'Free', test: (a) => a.cost.entry === 0 },
];
