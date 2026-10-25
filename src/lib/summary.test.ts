import { expect, test } from 'vitest';
import { ATTRACTIONS } from '../data/attractions';
import type { Attraction, Rating } from '../data/types';
import { summarize } from './summary';

/** A copy of the first attraction with a few fields overridden. */
function make(o: {
  months?: Rating[];
  level?: 1 | 2 | 3 | 4 | 5;
  weekend?: (number | null)[];
  entry?: number;
}): Attraction {
  const a = ATTRACTIONS[0];
  return {
    ...a,
    conditions: { ...a.conditions, months: o.months ?? a.conditions.months },
    effort: { ...a.effort, level: o.level ?? a.effort.level },
    vibe: { ...a.vibe, crowds: { ...a.vibe.crowds, weekend: o.weekend ?? a.vibe.crowds.weekend } },
    cost: { ...a.cost, entry: o.entry ?? a.cost.entry },
  };
}
const janOnly = (r: Rating): Rating[] => [r, ...Array<Rating>(11).fill('poor')];

test('month is good when at least half rate it good', () => {
  const four = (n: number) => Array.from({ length: 4 }, (_, i) => make({ months: janOnly(i < n ? 'good' : 'ok') }));
  expect(summarize(four(2)).months[0]).toBe(true);
  expect(summarize(four(1)).months[0]).toBe(false);
  expect(summarize(four(2)).months[1]).toBe(false);
});
test('effort from median level: 2→Easy, 3→Moderate, 4→Hard', () => {
  const lv = (n: 1 | 2 | 3 | 4 | 5) => [make({ level: n })];
  expect(summarize(lv(2)).effort).toBe('Easy');
  expect(summarize(lv(3)).effort).toBe('Moderate');
  expect(summarize(lv(4)).effort).toBe('Hard');
  expect(summarize(lv(1)).effort).toBe('Easy');
  expect(summarize(lv(5)).effort).toBe('Hard');
});
test('crowds from mean weekend peak: 44→Quiet, 45→Busy, 70→Busy, 71→Packed', () => {
  const pk = (n: number) => [make({ weekend: [null, 10, n, 5] })];
  expect(summarize(pk(44)).crowds).toBe('Quiet');
  expect(summarize(pk(45)).crowds).toBe('Busy');
  expect(summarize(pk(70)).crowds).toBe('Busy');
  expect(summarize(pk(71)).crowds).toBe('Packed');
});
test('cost from median entry: 0→Free, 999→¥, 2999→¥¥, 3000→¥¥¥', () => {
  const en = (n: number) => [make({ entry: n })];
  expect(summarize(en(0)).cost).toBe('Free');
  expect(summarize(en(999)).cost).toBe('¥');
  expect(summarize(en(2999)).cost).toBe('¥¥');
  expect(summarize(en(3000)).cost).toBe('¥¥¥');
});
test('median of an even list is the lower middle value', () => {
  expect(summarize([make({ entry: 0 }), make({ entry: 3000 })]).cost).toBe('Free');
});
test('summarize([]) is safe', () => {
  expect(summarize([])).toEqual({ months: Array(12).fill(false), effort: 'Easy', crowds: 'Quiet', cost: 'Free', count: 0 });
});
test('Tokyo summary is stable', () => expect(summarize(ATTRACTIONS).count).toBe(16));
