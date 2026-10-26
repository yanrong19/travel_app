import { test, expect } from 'vitest';
import { nearestScrollTop } from './listScroll';

test('an item already in view leaves the list where it is', () => {
  expect(nearestScrollTop(0, 300, 100, 60)).toBe(0);
  expect(nearestScrollTop(120, 300, 200, 60)).toBe(120);
});
test('an item below the fold scrolls up just enough to show its bottom', () => {
  expect(nearestScrollTop(0, 300, 400, 60)).toBe(160);
  expect(nearestScrollTop(0, 300, 400, 60, 6)).toBe(166);
});
test('an item above the view scrolls to its top', () => {
  expect(nearestScrollTop(200, 300, 50, 60)).toBe(50);
  expect(nearestScrollTop(200, 300, 4, 60, 6)).toBe(0);
});
test('an item taller than the view shows its top', () => {
  expect(nearestScrollTop(0, 100, 300, 200)).toBe(300);
});
