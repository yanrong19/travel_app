import { test, expect } from 'vitest';
import { fitPadding, revealDelta, viewQuad } from './camera';

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

const free = { left: 40, top: 236, right: 804, bottom: 760 };
test('revealDelta: a point already inside the free area (less the margin) needs no pan', () => {
  expect(revealDelta([400, 500], free)).toEqual([0, 0]);
  expect(revealDelta([80, 276], free)).toEqual([0, 0]);
});
test('revealDelta: left of the free area pans right just enough', () => {
  expect(revealDelta([20, 500], free)).toEqual([60, 0]);
  expect(revealDelta([70, 500], free)).toEqual([10, 0]);
});
test('revealDelta: below the free area pans up just enough', () => {
  expect(revealDelta([400, 790], free)).toEqual([0, -70]);
});
test('revealDelta: off a corner pans on both axes', () => {
  expect(revealDelta([850, 100], free)).toEqual([-86, 176]);
});
test('revealDelta: the margin is a parameter', () => {
  expect(revealDelta([20, 500], free, 0)).toEqual([20, 0]);
});
test('revealDelta: a free area narrower than twice the margin centres the point on that axis', () => {
  expect(revealDelta([0, 500], { left: 100, top: 0, right: 150, bottom: 1000 })).toEqual([125, 0]);
});
