import { expect, test } from 'vitest';
import { attractionById } from '../data/attractions';
import type { Attraction } from '../data/types';
import { bestSlot, slotAt, slotMismatch } from './timeOfDay';

const at = (h: number, m = 0) => h * 60 + m;
const withSlots = (a: Attraction, morning: string, afternoon: string, evening: string): Attraction => {
  const c = structuredClone(a);
  c.conditions.timeOfDay = { ...c.conditions.timeOfDay, morning, afternoon, evening } as Attraction['conditions']['timeOfDay'];
  return c;
};
const teamlab = attractionById('teamlab-planets')!;

test('slot boundaries: before 12:00 morning, 12:00–17:00 afternoon, 17:00 onward evening', () => {
  expect(slotAt(at(6))).toBe('morning');
  expect(slotAt(at(11, 59))).toBe('morning');
  expect(slotAt(at(12))).toBe('afternoon');
  expect(slotAt(at(16, 59))).toBe('afternoon');
  expect(slotAt(at(17))).toBe('evening');
  // Past midnight on the same plan is still the evening, not the next morning.
  expect(slotAt(at(25))).toBe('evening');
});

test('best slot is the first good one, else the first ok one, else none', () => {
  expect(bestSlot(withSlots(teamlab, 'poor', 'ok', 'good'))).toBe('evening');
  expect(bestSlot(withSlots(teamlab, 'poor', 'ok', 'ok'))).toBe('afternoon');
  expect(bestSlot(withSlots(teamlab, 'good', 'poor', 'good'))).toBe('morning');
  expect(bestSlot(withSlots(teamlab, 'poor', 'poor', 'poor'))).toBeNull();
});

test('a mismatch only when the scheduled slot is poor', () => {
  const nightOnly = withSlots(teamlab, 'poor', 'ok', 'good');
  expect(slotMismatch(nightOnly, at(10))).toEqual({ slot: 'morning', better: 'evening' });
  expect(slotMismatch(nightOnly, at(13))).toBeNull(); // ok is not flagged
  expect(slotMismatch(nightOnly, at(19))).toBeNull();
  expect(slotMismatch(withSlots(teamlab, 'poor', 'poor', 'poor'), at(10))).toEqual({ slot: 'morning', better: null });
});
