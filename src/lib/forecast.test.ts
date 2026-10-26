import { expect, test } from 'vitest';
import type { PlaceRef } from './trips';
import { getRainChance, isLikelyWet, LIKELY_WET } from './forecast';

const JAPAN: PlaceRef = { level: 'country', id: '392' };
const TOKYO: PlaceRef = { level: 'prefecture', id: '13' };

test('getRainChance is deterministic', () => {
  const d = new Date(2027, 5, 12);
  expect(getRainChance(TOKYO, d)).toBe(getRainChance(TOKYO, new Date(2027, 5, 12)));
  expect(getRainChance(JAPAN, d)).toBe(getRainChance(JAPAN, d));
});

test('getRainChance is null without a date', () => {
  expect(getRainChance(null, null)).toBeNull();
  expect(getRainChance(TOKYO, null)).toBeNull();
});

test('getRainChance works without a place', () => {
  expect(getRainChance(null, new Date(2027, 5, 12))).toBeTypeOf('number');
});

const avg = (month: number) => {
  const xs = Array.from({ length: 28 }, (_, i) => getRainChance(TOKYO, new Date(2027, month, i + 1))!);
  return xs.reduce((a, b) => a + b, 0) / xs.length;
};

test('Tokyo June is wetter than Tokyo January', () => {
  expect(avg(5)).toBeGreaterThan(avg(0) + 25);
  expect(getRainChance(TOKYO, new Date(2027, 5, 20))!).toBeGreaterThan(getRainChance(TOKYO, new Date(2027, 0, 20))!);
});

test('chances stay within 0..100', () => {
  const places: (PlaceRef | null)[] = [null, JAPAN, TOKYO, { level: 'country', id: '380' }, { level: 'area', id: '13106' }];
  for (const p of places)
    for (let i = 0; i < 366; i++) {
      const c = getRainChance(p, new Date(2028, 0, 1 + i))!;
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(100);
    }
});

test('isLikelyWet is true from 50 up, false for null', () => {
  expect(LIKELY_WET).toBe(50);
  expect(isLikelyWet(50)).toBe(true);
  expect(isLikelyWet(49)).toBe(false);
  expect(isLikelyWet(null)).toBe(false);
});
