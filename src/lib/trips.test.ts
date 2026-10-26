import { expect, test } from 'vitest';
import {
  addPlace,
  addStop,
  addWet,
  dateOf,
  dayOf,
  daysBetween,
  endDate,
  loadTrips,
  MAX_DAYS,
  moveStop,
  newTrip,
  removePlace,
  removeStop,
  removeWet,
  replaceStop,
  saveToTrip,
  serializeTrips,
  setDays,
  unsaveFromTrip,
  type Trip,
} from './trips';

function init(o: Partial<Parameters<typeof newTrip>[0]> = {}) {
  return {
    name: 'Spring',
    places: [{ level: 'prefecture' as const, id: '13' }],
    startDate: null as string | null,
    days: 3,
    who: 'couple' as const,
    pace: 'normal' as const,
    ...o,
  };
}
const make = (o: Partial<Parameters<typeof newTrip>[0]> = {}) => newTrip(init(o), 1, 't1');

test('newTrip makes one empty DayPlan per day', () =>
  expect(newTrip(init({ days: 3 }), 1, 't1').days).toEqual([
    { stops: [], wet: [] },
    { stops: [], wet: [] },
    { stops: [], wet: [] },
  ]));

test('newTrip fills defaults and stamps times', () => {
  const t = newTrip(init(), 5, 'abc');
  expect(t).toMatchObject({ version: 1, id: 'abc', saved: [], dayStart: '09:00', createdAt: 5, updatedAt: 5 });
});

test('daysBetween is inclusive', () => expect(daysBetween('2027-04-10', '2027-04-14')).toBe(5));

test('dateOf follows the start date; null without one', () => {
  const t = make({ startDate: '2027-04-10' });
  const d = dateOf(t, 2)!;
  expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2027, 4, 12]);
  expect(dateOf(make(), 2)).toBeNull();
});

test('endDate is the last day, null without a start date', () => {
  expect(endDate(make({ startDate: '2027-04-10', days: 5 }))).toBe('2027-04-14');
  expect(endDate(make({ startDate: '2027-12-30', days: 4 }))).toBe('2028-01-02');
  expect(endDate(make())).toBeNull();
});

test('addStop adds once; a second add to the same day is a no-op', () => {
  const t1 = addStop(make(), 0, 'a', 2);
  const t2 = addStop(t1, 0, 'a', 3);
  expect(t2.days[0].stops).toEqual(['a']);
  expect(t2.updatedAt).toBe(2);
});

test('addStop moves from another day', () => {
  const t = addStop(addStop(make(), 0, 'a', 2), 2, 'a', 3);
  expect(t.days[0].stops).toEqual([]);
  expect(t.days[2].stops).toEqual(['a']);
});

test('planning from saved keeps the id in saved', () => {
  const t = addStop(saveToTrip(make(), 'a', 2), 1, 'a', 3);
  expect(t.saved).toEqual(['a']);
  expect(t.days[1].stops).toEqual(['a']);
});

test('addStop ignores a day that does not exist', () => {
  const t = make();
  expect(addStop(t, 7, 'a', 2)).toBe(t);
});

test('addWet does not remove it from the day plan', () => {
  const t = addWet(addStop(make(), 0, 'a', 2), 0, 'a', 3);
  expect(t.days[0].stops).toEqual(['a']);
  expect(t.days[0].wet).toEqual(['a']);
  expect(addWet(t, 0, 'a', 4).days[0].wet).toEqual(['a']);
});

test('removeWet takes it off the wet list only', () => {
  const t = removeWet(addWet(addStop(make(), 0, 'a', 2), 0, 'a', 3), 0, 'a', 4);
  expect(t.days[0]).toEqual({ stops: ['a'], wet: [] });
});

test('removeStop removes from the day', () => {
  const t = removeStop(addStop(addStop(make(), 0, 'a', 2), 0, 'b', 2), 0, 'a', 3);
  expect(t.days[0].stops).toEqual(['b']);
});

test('replaceStop keeps the position', () => {
  let t = make();
  for (const id of ['a', 'b', 'c']) t = addStop(t, 0, id, 2);
  expect(replaceStop(t, 0, 'b', 'd', 3).days[0].stops).toEqual(['a', 'd', 'c']);
});

test('replaceStop sends the replaced stop to saved and keeps the new one in saved', () => {
  let t = saveToTrip(addStop(make(), 0, 'a', 2), 'd', 2);
  t = replaceStop(t, 0, 'a', 'd', 3);
  expect(t.days[0].stops).toEqual(['d']);
  expect(t.saved).toEqual(['d', 'a']);
});

test('replaceStop does not duplicate a replaced stop already in saved', () => {
  let t = saveToTrip(addStop(make(), 0, 'a', 2), 'a', 2);
  t = replaceStop(t, 0, 'a', 'd', 3);
  expect(t.saved).toEqual(['a']);
});

test('replaceStop pulls the new stop out of its old place', () => {
  let t = addStop(addStop(make(), 0, 'a', 2), 1, 'd', 2);
  t = replaceStop(t, 0, 'a', 'd', 3);
  expect(t.days[0].stops).toEqual(['d']);
  expect(t.days[1].stops).toEqual([]);
});

test('moveStop reorders', () => {
  let t = make();
  for (const id of ['a', 'b', 'c']) t = addStop(t, 0, id, 2);
  expect(moveStop(t, 0, 0, 2, 3).days[0].stops).toEqual(['b', 'c', 'a']);
  expect(moveStop(t, 0, 2, 0, 3).days[0].stops).toEqual(['c', 'a', 'b']);
});

test('saveToTrip adds once; saving again returns the same object', () => {
  const t = saveToTrip(make(), 'a', 2);
  expect(t.saved).toEqual(['a']);
  expect(t.updatedAt).toBe(2);
  expect(saveToTrip(t, 'a', 3)).toBe(t);
});

test('saveToTrip also saves a stop that is already on a day', () => {
  const t = saveToTrip(addStop(make(), 0, 'b', 2), 'b', 3);
  expect(t.saved).toEqual(['b']);
  expect(t.days[0].stops).toEqual(['b']);
});

test('unsaveFromTrip removes it, and is a no-op when it is not saved', () => {
  const t = saveToTrip(saveToTrip(make(), 'a', 2), 'b', 2);
  const r = unsaveFromTrip(t, 'a', 3);
  expect(r.saved).toEqual(['b']);
  expect(r.updatedAt).toBe(3);
  expect(unsaveFromTrip(r, 'a', 4)).toBe(r);
});

test('dayOf finds the day, null when it is not on a day (even if saved)', () => {
  const t = saveToTrip(addStop(make(), 2, 'a', 2), 'u', 2);
  expect(dayOf(t, 'a')).toBe(2);
  expect(dayOf(t, 'u')).toBeNull();
  expect(dayOf(t, 'zzz')).toBeNull();
});

test('setDays keeps stops from removed days', () => {
  let t = make({ days: 5 });
  t = addStop(addStop(t, 4, 'x', 2), 3, 'y', 2);
  t = addWet(t, 4, 'x', 2);
  const s = setDays(t, 3, 3);
  expect(s.days).toHaveLength(3);
  expect(s.saved).toEqual(['y', 'x']);
});

test('setDays sends stops from removed days to saved without duplicates', () => {
  let t = saveToTrip(make({ days: 5 }), 'x', 2);
  t = addStop(addStop(t, 4, 'x', 2), 3, 'y', 2);
  expect(setDays(t, 3, 3).saved).toEqual(['x', 'y']);
});

test('setDays grows with empty days', () => {
  const t = setDays(addStop(make(), 0, 'a', 2), 5, 3);
  expect(t.days).toHaveLength(5);
  expect(t.days[0].stops).toEqual(['a']);
  expect(t.days[4]).toEqual({ stops: [], wet: [] });
});

test('setDays never goes below one day', () => expect(setDays(make(), 0, 2).days).toHaveLength(1));

test('addPlace adds once', () => {
  const ref = { level: 'prefecture' as const, id: '27' };
  const t = addPlace(addPlace(make(), ref, 2), ref, 3);
  expect(t.places).toEqual([{ level: 'prefecture', id: '13' }, ref]);
});

test('removePlace drops the place and the listed stops', () => {
  let t = make();
  t = addStop(addStop(t, 0, 'a', 2), 1, 'b', 2);
  t = addWet(t, 1, 'b', 2);
  t = saveToTrip(saveToTrip(t, 'c', 2), 'a', 2);
  const r = removePlace(t, { level: 'prefecture', id: '13' }, ['b', 'c'], 3);
  expect(r.places).toEqual([]);
  expect(r.days[0].stops).toEqual(['a']);
  expect(r.days[1]).toEqual({ stops: [], wet: [] });
  expect(r.saved).toEqual(['a']);
});

test('operations never mutate their input', () => {
  const t = addWet(saveToTrip(addStop(make({ days: 4 }), 0, 'a', 2), 'u', 2), 0, 'a', 2);
  const before = JSON.stringify(t);
  addStop(t, 1, 'a', 3);
  removeStop(t, 0, 'a', 3);
  moveStop(addStop(t, 0, 'b', 3), 0, 0, 1, 4);
  replaceStop(t, 0, 'a', 'z', 3);
  addWet(t, 1, 'q', 3);
  removeWet(t, 0, 'a', 3);
  saveToTrip(t, 'n', 3);
  unsaveFromTrip(t, 'u', 3);
  addStop(t, 2, 'u', 3);
  addPlace(t, { level: 'country', id: 'jp' }, 3);
  removePlace(t, { level: 'prefecture', id: '13' }, ['a'], 3);
  setDays(t, 1, 3);
  expect(JSON.stringify(t)).toBe(before);
});

test('operations stamp updatedAt from now', () => {
  const t = make();
  expect(addStop(t, 0, 'a', 99).updatedAt).toBe(99);
  expect(addWet(t, 0, 'a', 98).updatedAt).toBe(98);
  expect(saveToTrip(t, 'a', 97).updatedAt).toBe(97);
  expect(setDays(t, 4, 96).updatedAt).toBe(96);
  expect(addPlace(t, { level: 'country', id: 'jp' }, 95).updatedAt).toBe(95);
  expect(removePlace(t, { level: 'prefecture', id: '13' }, [], 94).updatedAt).toBe(94);
  expect(t.updatedAt).toBe(1);
});

test('loadTrips round-trips serializeTrips', () => {
  const trips: Trip[] = [
    addStop(make({ startDate: '2027-04-10' }), 0, 'a', 2),
    newTrip(init({ name: 'Two', days: 1, who: 'solo', pace: 'packed', dayStart: '07:30' }), 3, 't2'),
  ];
  expect(loadTrips(serializeTrips(trips))).toEqual({ trips, notice: null });
});

test('loadTrips tolerates corrupt json', () => expect(loadTrips('{nope')).toEqual({ trips: [], notice: expect.any(String) }));

test('loadTrips drops unknown version', () =>
  expect(loadTrips(JSON.stringify({ version: 9, trips: [{}] })).trips).toEqual([]));

test('loadTrips(null) is empty with no notice', () => expect(loadTrips(null)).toEqual({ trips: [], notice: null }));

test('loadTrips keeps good trips and drops malformed ones with a notice', () => {
  const good = make();
  const r = loadTrips(JSON.stringify({ version: 1, trips: [good, { id: 5 }, null] }));
  expect(r.trips).toEqual([good]);
  expect(r.notice).toEqual(expect.any(String));
});

test('setDays to the current count is a no-op', () => {
  const t = make({ days: 3 });
  expect(setDays(t, 3, 99)).toBe(t);
  expect(t.updatedAt).toBe(1);
});

test('removePlace with nothing to remove is a no-op', () => {
  const t = addStop(make(), 0, 'a', 2);
  const r = removePlace(t, { level: 'prefecture', id: '27' }, [], 99);
  expect(r).toBe(t);
  expect(r.updatedAt).toBe(2);
  expect(removePlace(t, { level: 'prefecture', id: '27' }, ['not-there'], 99)).toBe(t);
});

test('day counts are clamped and never throw', () => {
  expect(MAX_DAYS).toBe(60);
  for (const bad of [Infinity, -Infinity, NaN, 0, -5]) {
    expect(newTrip(init({ days: bad }), 1, 'x').days).toHaveLength(1);
    expect(setDays(make({ days: 3 }), bad, 2).days).toHaveLength(1);
  }
  expect(newTrip(init({ days: 1000 }), 1, 'x').days).toHaveLength(MAX_DAYS);
  expect(setDays(make(), 1000, 2).days).toHaveLength(MAX_DAYS);
  expect(setDays(make(), 4.9, 2).days).toHaveLength(4);
});

test('loadTrips repairs an unreadable start date or day start instead of dropping the trip', () => {
  const good = addStop(make({ startDate: '2027-04-10' }), 0, 'a', 2);
  const raw = (o: object) => JSON.stringify({ version: 1, trips: [{ ...good, ...o }] });
  for (const startDate of ['0027-04-18', '0999-01-01', '2027-02-30', 'soon', 5]) {
    expect(loadTrips(raw({ startDate }))).toEqual({ trips: [{ ...good, startDate: null }], notice: null });
  }
  for (const dayStart of ['24:00', '9:00', '09:60', '', 900, null]) {
    expect(loadTrips(raw({ dayStart }))).toEqual({ trips: [{ ...good, dayStart: '09:00' }], notice: null });
  }
  expect(loadTrips(raw({ dayStart: '23:59' })).trips[0].dayStart).toBe('23:59');
  // Structural damage still drops the trip.
  expect(loadTrips(raw({ days: [] })).trips).toEqual([]);
});

test('loadTrips prunes attraction ids the data no longer has', () => {
  let t = addStop(addStop(make(), 0, 'a', 2), 0, 'gone', 2);
  t = addStop(t, 0, 'b', 2);
  t = addWet(addWet(t, 1, 'gone', 2), 1, 'b', 2);
  t = saveToTrip(saveToTrip(t, 'gone2', 2), 'a2', 2);
  const known = (id: string) => !id.startsWith('gone');
  const [r] = loadTrips(serializeTrips([t]), known).trips;
  expect(r.days[0].stops).toEqual(['a', 'b']);
  expect(r.days[1].wet).toEqual(['b']);
  expect(r.saved).toEqual(['a2']);
  // Without a list of known ids nothing is pruned.
  expect(loadTrips(serializeTrips([t])).trips).toEqual([t]);
});

/** A trip as an older build wrote it: `unplanned` instead of `saved`. */
const oldShape = (t: Trip, unplanned: string[]) => {
  const { saved: _saved, ...rest } = t;
  return { ...rest, unplanned };
};

test('loadTrips migrates a version-1 trip that still has unplanned', () => {
  const t = addStop(make(), 0, 'a', 2);
  const r = loadTrips(JSON.stringify({ version: 1, trips: [oldShape(t, ['u1', 'u2'])] }));
  expect(r.notice).toBeNull();
  expect(r.trips).toEqual([{ ...t, saved: ['u1', 'u2'] }]);
  expect('unplanned' in r.trips[0]).toBe(false);
});

test('loadTrips prunes unknown ids from a migrated unplanned list', () => {
  const raw = JSON.stringify({ version: 1, trips: [oldShape(make(), ['ok', 'gone'])] });
  expect(loadTrips(raw, (id) => id !== 'gone').trips[0].saved).toEqual(['ok']);
});

test('loadTrips prefers saved when a trip has both fields, and drops one with neither', () => {
  const t = saveToTrip(make(), 's', 2);
  expect(loadTrips(JSON.stringify({ version: 1, trips: [{ ...t, unplanned: ['u'] }] })).trips).toEqual([t]);
  const { saved: _saved, ...neither } = make();
  expect(loadTrips(JSON.stringify({ version: 1, trips: [neither] })).trips).toEqual([]);
});
