import type { Attraction } from '../data/types';

export type Effort = 'Easy' | 'Moderate' | 'Hard';
export type Crowds = 'Quiet' | 'Busy' | 'Packed';
export type Cost = 'Free' | '¥' | '¥¥' | '¥¥¥';

/** A region at a glance: the tags shown on its guide. */
export interface Summary {
  /** Twelve flags, January first: true when the month suits most places. */
  months: boolean[];
  effort: Effort;
  crowds: Crowds;
  cost: Cost;
  count: number;
}

/** Lower middle value of an even-length list; 0 for an empty one. */
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] ?? 0;
};

/** Busiest weekend hour, ignoring closed hours. */
const weekendPeak = (a: Attraction) => Math.max(0, ...a.vibe.crowds.weekend.filter((v): v is number => v != null));

/** Reduce a set of attractions to the best months and the effort, crowd and cost tags. */
export function summarize(list: Attraction[]): Summary {
  const n = list.length;
  const months = Array.from({ length: 12 }, (_, m) => {
    const good = list.filter((a) => a.conditions.months[m] === 'good').length;
    return n > 0 && good * 2 >= n;
  });

  const level = median(list.map((a) => a.effort.level));
  const effort: Effort = level <= 2 ? 'Easy' : level === 3 ? 'Moderate' : 'Hard';

  const peak = n > 0 ? list.reduce((sum, a) => sum + weekendPeak(a), 0) / n : 0;
  const crowds: Crowds = peak < 45 ? 'Quiet' : peak <= 70 ? 'Busy' : 'Packed';

  const entry = median(list.map((a) => a.cost.entry));
  const cost: Cost = entry === 0 ? 'Free' : entry < 1000 ? '¥' : entry < 3000 ? '¥¥' : '¥¥¥';

  return { months, effort, crowds, cost, count: n };
}
