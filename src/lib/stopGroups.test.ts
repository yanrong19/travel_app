import { expect, test } from 'vitest';
import { groupName, groupStops, splitZoom, stopRun } from './stopGroups';

const p = (id: string, n: number, x: number, y: number) => ({ id, n, x, y });

test('circles closer than the radius merge into one group at their centroid, numbers in order', () => {
  const groups = groupStops([p('c', 3, 20, 0), p('a', 1, 0, 0), p('b', 2, 10, 0), p('far', 4, 200, 0)], 26);
  expect(groups).toEqual([{ ids: ['a', 'b', 'c'], ns: [1, 2, 3], x: 10, y: 0 }]);
});

test('overlap chains: 1 touches 2 and 2 touches 3, so all three merge though 1 and 3 are apart', () => {
  const groups = groupStops([p('a', 1, 0, 0), p('b', 2, 20, 0), p('c', 3, 40, 0)], 26);
  expect(groups.map((g) => g.ns)).toEqual([[1, 2, 3]]);
});

test('separate clusters stay separate; lone circles make no group', () => {
  const groups = groupStops([p('a', 1, 0, 0), p('b', 2, 0, 10), p('c', 3, 100, 100), p('d', 4, 110, 100), p('e', 5, 300, 0)], 26);
  expect(groups.map((g) => g.ids)).toEqual([
    ['a', 'b'],
    ['c', 'd'],
  ]);
  expect(groupStops([p('a', 1, 0, 0), p('b', 2, 26, 0)], 26)).toEqual([]);
  expect(groupStops([], 26)).toEqual([]);
});

test('the pill reads a run of three or more as a range, anything else number by number', () => {
  expect(stopRun([1, 2, 3])).toBe('1–3');
  expect(stopRun([2, 3, 4, 5])).toBe('2–5');
  expect(stopRun([1, 2])).toBe('1 2');
  expect(stopRun([1, 2, 4])).toBe('1 2 4');
});

test('accessible name: the day, the stops and their names', () => {
  expect(groupName(0, [1, 2, 3], ['Sensō-ji', 'Tokyo National Museum', 'Yanaka Ginza'])).toBe(
    'Day 1 stops 1 to 3: Sensō-ji, Tokyo National Museum, Yanaka Ginza',
  );
  expect(groupName(1, [1, 2], ['A', 'B'])).toBe('Day 2 stops 1 and 2: A, B');
  expect(groupName(0, [1, 2, 4], ['A', 'B', 'D'])).toBe('Day 1 stops 1, 2 and 4: A, B, D');
});

test('the zoom that splits a group: enough doublings to push the closest pair past the radius, capped', () => {
  const pts = [p('a', 1, 0, 0), p('b', 2, 13, 0), p('c', 3, 100, 0)];
  // Closest pair is 13 apart; 26 × 1.2 margin needs log2(31.2 / 13) ≈ 1.26 more zoom.
  expect(splitZoom(pts, 26, 10, 15.5)).toBeCloseTo(10 + Math.log2(31.2 / 13), 5);
  expect(splitZoom([p('a', 1, 0, 0), p('b', 2, 0.01, 0)], 26, 10, 15.5)).toBe(15.5);
  expect(splitZoom([p('a', 1, 0, 0), p('b', 2, 0, 0)], 26, 10, 15.5)).toBe(15.5);
  // Always at least a visible step in.
  expect(splitZoom([p('a', 1, 0, 0), p('b', 2, 25, 0)], 26, 10, 15.5)).toBeGreaterThanOrEqual(10.5);
});
