import { expect, test } from 'vitest';
import { addStop, addWet, newTrip, setDayTimes } from '../../lib/trips';
import { cutsPlans } from './HeaderDates';

const trip = () => newTrip({ name: 'T', places: [{ level: 'prefecture', id: '13' }], startDate: null, days: 5 }, 1, 't');

test('cutting empty days with the default times loses nothing, so it applies at once', () => {
  expect(cutsPlans(trip(), 1)).toBe(false);
  expect(cutsPlans(trip(), 5)).toBe(false);
  expect(cutsPlans(trip(), 8)).toBe(false);
});

test('a cut day with stops or a wet-weather plan holds the cut', () => {
  expect(cutsPlans(addStop(trip(), 3, 'senso-ji', 2), 3)).toBe(true);
  expect(cutsPlans(addWet(trip(), 4, 'teamlab-planets', 2), 4)).toBe(true);
  // Days kept don't count.
  expect(cutsPlans(addStop(trip(), 1, 'senso-ji', 2), 2)).toBe(false);
});

test('a cut day with its own start or end time holds the cut too', () => {
  const late = setDayTimes(trip(), 4, { end: '22:00' }, 2);
  expect(cutsPlans(late, 4)).toBe(true);
  expect(cutsPlans(late, 1)).toBe(true);
  expect(cutsPlans(setDayTimes(trip(), 2, { start: '07:30' }, 2), 2)).toBe(true);
  // Typing "12" over "5" passes through 1 day: that would cut day 5's times, so it waits.
  expect(cutsPlans(late, 5)).toBe(false);
});
