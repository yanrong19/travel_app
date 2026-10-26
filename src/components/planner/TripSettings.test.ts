import { expect, test } from 'vitest';
import { shiftDate, withDays, withEnd, withStart } from './TripSettings';

const none = { startDate: null, endDate: null, days: 5 };

test('shiftDate crosses months and years and rejects non-dates', () => {
  expect(shiftDate('2027-01-30', 3)).toBe('2027-02-02');
  expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  expect(shiftDate('2027-03-05', -4)).toBe('2027-03-01');
  expect(shiftDate('', 1)).toBeNull();
});

test('a start keeps the number of days and sets the end', () => {
  expect(withStart(none, '2027-04-12')).toEqual({ startDate: '2027-04-12', endDate: '2027-04-16', days: 5 });
});

test('an end after the start sets the number of days', () => {
  const v = withStart(none, '2027-04-12');
  expect(withEnd(v, '2027-04-20')).toEqual({ startDate: '2027-04-12', endDate: '2027-04-20', days: 9 });
});

test('an end before the start moves the start back, keeping the days', () => {
  const v = withStart(none, '2027-04-12');
  expect(withEnd(v, '2027-04-10')).toEqual({ startDate: '2027-04-06', endDate: '2027-04-10', days: 5 });
});

test('an end without a start counts the start back from it', () => {
  expect(withEnd(none, '2027-04-10')).toEqual({ startDate: '2027-04-06', endDate: '2027-04-10', days: 5 });
});

test('the number of days moves the end, and is clamped to 1..60', () => {
  const v = withStart(none, '2027-04-12');
  expect(withDays(v, 2)).toEqual({ startDate: '2027-04-12', endDate: '2027-04-13', days: 2 });
  expect(withDays(none, 0).days).toBe(1);
  expect(withDays(none, 99).days).toBe(60);
  expect(withDays(none, 7)).toEqual({ startDate: null, endDate: null, days: 7 });
});

test('clearing either date clears both and keeps the number of days', () => {
  const v = withDays(withStart(none, '2027-04-12'), 8);
  expect(withStart(v, '')).toEqual({ startDate: null, endDate: null, days: 8 });
  expect(withEnd(v, '')).toEqual({ startDate: null, endDate: null, days: 8 });
});
