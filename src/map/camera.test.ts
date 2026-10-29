import { test, expect } from 'vitest';
import { fitPadding, viewQuad } from './camera';

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
test('viewQuad unprojects the free rectangle corners clockwise from top-left', () => {
  const q = viewQuad(1000, 600, { top: 50, right: 400, bottom: 0, left: 0 }, ([x, y]) => [x, -y]);
  expect(q).toEqual([[0, -50], [600, -50], [600, -600], [0, -600]]);
});
