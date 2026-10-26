import { expect, test } from 'vitest';
import { leaveEnd, shiftDate, typeEnd, withDays, withStart } from './TripSettings';

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

test('an end within the start’s 60 days sets the number of days', () => {
  const v = withStart(none, '2027-04-12');
  expect(typeEnd(v, '2027-04-20')).toEqual({ dates: { startDate: '2027-04-12', endDate: '2027-04-20', days: 9 }, problem: null });
  expect(typeEnd(v, '2027-04-12').dates.days).toBe(1);
  expect(typeEnd(v, '2027-06-10').dates.days).toBe(60);
});

test('typing "20" over 18 Apr segment by segment keeps the start (it passes through 02 Apr)', () => {
  const v = withDays(withStart(none, '2027-04-12'), 7); // 12–18 Apr
  const mid = typeEnd(v, '2027-04-02');
  expect(mid).toEqual({ dates: v, problem: 'before' });
  const done = typeEnd(mid.dates, '2027-04-20');
  expect(done.dates).toEqual({ startDate: '2027-04-12', endDate: '2027-04-20', days: 9 });
});

test('an end before the start, past 60 days, or half typed changes nothing', () => {
  const v = withStart(none, '2027-04-12');
  expect(typeEnd(v, '2027-04-10')).toEqual({ dates: v, problem: 'before' });
  expect(typeEnd(v, '2027-06-11')).toEqual({ dates: v, problem: 'tooLong' });
  expect(typeEnd(v, '')).toEqual({ dates: v, problem: 'incomplete' }); // a year being typed reads as empty
});

test('leaving the end field: a pending bad end is dropped, a lone end counts the start back', () => {
  const v = withStart(none, '2027-04-12');
  expect(leaveEnd(v, '2027-04-10')).toEqual({ dates: v, problem: 'before' });
  expect(typeEnd(none, '2027-04-10')).toEqual({ dates: none, problem: 'noStart' });
  expect(leaveEnd(none, '2027-04-10').dates).toEqual({ startDate: '2027-04-06', endDate: '2027-04-10', days: 5 });
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
  expect(leaveEnd(v, '').dates).toEqual({ startDate: null, endDate: null, days: 8 });
});
