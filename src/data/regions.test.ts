import { expect, test } from 'vitest';
import { REGIONS, prefName, regionOfPref } from './regions';

test('every prefecture 1–47 belongs to exactly one region', () => {
  const all = REGIONS.flatMap((r) => r.prefectures).sort((a, b) => a - b);
  expect(all).toEqual(Array.from({ length: 47 }, (_, i) => i + 1));
});
test('region codes follow the spec', () => {
  const by = Object.fromEntries(REGIONS.map((r) => [r.id, r.prefectures]));
  expect(by.hokkaido).toEqual([1]);
  expect(by.tohoku).toEqual([2, 3, 4, 5, 6, 7]);
  expect(by.kanto).toEqual([8, 9, 10, 11, 12, 13, 14]);
  expect(by.chubu).toEqual([15, 16, 17, 18, 19, 20, 21, 22, 23]);
  expect(by.kansai).toEqual([24, 25, 26, 27, 28, 29, 30]);
  expect(by.chugoku).toEqual([31, 32, 33, 34, 35]);
  expect(by.shikoku).toEqual([36, 37, 38, 39]);
  expect(by['kyushu-okinawa']).toEqual([40, 41, 42, 43, 44, 45, 46, 47]);
});
test('only Kantō is live, and Tokyo is in it', () => {
  expect(REGIONS.filter((r) => r.live).map((r) => r.id)).toEqual(['kanto']);
  expect(regionOfPref(13)?.id).toBe('kanto');
});
test('coming-soon regions carry a rough summary with 12 months', () => {
  for (const r of REGIONS.filter((x) => !x.live)) expect(r.rough?.months).toHaveLength(12);
});
test('prefName reads the geo data', () => expect(prefName(13)).toBe('Tokyo'));
