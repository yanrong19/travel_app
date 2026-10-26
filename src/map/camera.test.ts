import { test, expect } from 'vitest';
import { fitPadding } from './camera';

const pad = { top: 206, right: 546, bottom: 342, left: 110 };

test('padding that fits is left alone', () => {
  expect(fitPadding(pad, 1440, 900)).toEqual(pad);
});
test('a phone keeps its tight framing: 92px free is still enough', () => {
  const tight = { top: 390, right: 47, bottom: 362, left: 47 };
  expect(fitPadding(tight, 390, 844)).toEqual(tight);
});
test('a short screen shrinks top and bottom in proportion, keeping 80px free', () => {
  const p = fitPadding(pad, 1440, 390);
  expect(p.top + p.bottom).toBeCloseTo(390 - 80, 5);
  expect(p.top / p.bottom).toBeCloseTo(206 / 342, 5);
  expect(p.left).toBe(110);
  expect(p.right).toBe(546);
});
test('a narrow screen shrinks the sides the same way', () => {
  const p = fitPadding(pad, 600, 900);
  const q = fitPadding(pad, 700, 900);
  expect(q.left + q.right).toBeCloseTo(700 - 80, 5);
  expect(p.left + p.right).toBeCloseTo(600 - 80, 5);
  expect(p.top).toBe(206);
});
