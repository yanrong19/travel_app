import { test, expect } from 'vitest';
import { guideProgress, settleTarget } from './useGuideScroll';

test('progress clamps to 0..1', () => {
  expect(guideProgress(0, 900, 90, 56)).toBe(0);
  expect(guideProgress(377, 900, 90, 56)).toBeCloseTo(0.5, 2);
  expect(guideProgress(5000, 900, 90, 56)).toBe(1);
});
test('progress recomputes for a new viewport height', () => {
  expect(guideProgress(377, 600, 90, 56)).toBeGreaterThan(guideProgress(377, 900, 90, 56));
});
test('degenerate viewport gives 0', () => expect(guideProgress(100, 100, 90, 56)).toBe(0));
test('settle picks the nearer end, none at the ends', () => {
  expect(settleTarget(0)).toBeNull();
  expect(settleTarget(1)).toBeNull();
  expect(settleTarget(0.3)).toBe('top');
  expect(settleTarget(0.5)).toBe('guides');
});
