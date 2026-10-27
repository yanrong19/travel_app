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
  movedToSaved,
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
  setDayTimes,
  setStartDate,
  unsaveFromTrip,
  type Trip,
} from './trips';

function init(o: Partial<Parameters<typeof newTrip>[0]> = {}) {
  return {
    name: 'Spring',
    places: [{ level: 'prefecture' as const, id: '13' }],
    startDate: null as string | null,
    days: 3,
    ...o,
  };
}
const make = (o: Partial<Parameters<typeof newTrip>[0]> = {}) => newTrip(init(o), 1, 't1');
const EMPTY_DAY = { stops: [], wet: [], start: '09:00', end: '19:00' };

test('newTrip makes one empty DayPlan per day, 09:00 to 19:00', () =>
  expect(newTrip(init({ days: 3 }), 1, 't1').days).toEqual([EMPTY_DAY, EMPTY_DAY, EMPTY_DAY]));

test('newTrip fills defaults and stamps times', () => {
  const t = newTrip(init(), 5, 'abc');
  expect(t).toMatchObject({ version: 1, id: 'abc', saved: [], createdAt: 5, updatedAt: 5 });
  // Who's going, pace and the trip-wide day start are gone: each day has its own times.
  for (const k of ['who', 'pace', 'dayStart']) expect(k in t).toBe(false);
});

test('setDayTimes sets a day’s start and end, alone or together', () => {
  const t = make();
  const both = setDayTimes(t, 1, { start: '08:30', end: '21:15' }, 7);
  expect(both.days[1]).toEqual({ ...EMPTY_DAY, start: '08:30', end: '21:15' });
  expect(both.days[0]).toBe(t.days[0]);
  expect(both.updatedAt).toBe(7);
  expect(setDayTimes(t, 0, { start: '10:00' }, 7).days[0]).toEqual({ ...EMPTY_DAY, start: '10:00' });
  expect(setDayTimes(t, 0, { end: '23:59' }, 7).days[0]).toEqual({ ...EMPTY_DAY, end: '23:59' });
  expect(setDayTimes(t, 0, { start: '00:00', end: '00:01' }, 7).days[0]).toEqual({ ...EMPTY_DAY, start: '00:00', end: '00:01' });
});

test('setDayTimes is a no-op on bad input: not HH:MM, end not after start, no such day, nothing new', () => {
  const t = make();
  for (const bad of ['24:00', '9:00', '09:60', '', '09:00:00', 'soon']) {
    expect(setDayTimes(t, 0, { start: bad }, 7)).toBe(t);
    expect(setDayTimes(t, 0, { end: bad }, 7)).toBe(t);
  }
  // A day doesn't run past midnight: the end must be after the start on the same clock.
  expect(setDayTimes(t, 0, { start: '19:00' }, 7)).toBe(t); // the end is 19:00
  expect(setDayTimes(t, 0, { end: '09:00' }, 7)).toBe(t);
  expect(setDayTimes(t, 0, { start: '22:00', end: '01:00' }, 7)).toBe(t);
  expect(setDayTimes(t, 3, { start: '08:00' }, 7)).toBe(t);
  expect(setDayTimes(t, -1, { start: '08:00' }, 7)).toBe(t);
  expect(setDayTimes(t, 0, {}, 7)).toBe(t);
  expect(setDayTimes(t, 0, { start: '09:00', end: '19:00' }, 7)).toBe(t);
});

test('setStartDate sets or clears the dates and ignores a non-date', () => {
  const t = make();
  const dated = setStartDate(t, '2027-04-10', 5);
  expect(dated.startDate).toBe('2027-04-10');
  expect(dated.updatedAt).toBe(5);
  expect(setStartDate(dated, '2027-04-10', 6)).toBe(dated);
  expect(setStartDate(dated, null, 6).startDate).toBeNull();
  expect(setStartDate(t, null, 6)).toBe(t);
  for (const bad of ['0027-04-10', '2027-02-30', 'soon', '']) expect(setStartDate(dated, bad, 6)).toBe(dated);
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
  expect(t.days[0]).toEqual({ ...EMPTY_DAY, stops: ['a'] });
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
  expect(t.days[4]).toEqual(EMPTY_DAY);
});

test('setDays adds days at 09:00 to 19:00 and keeps the times of the days it keeps', () => {
  const t = setDayTimes(setDayTimes(make({ days: 2 }), 0, { start: '07:00', end: '22:00' }, 2), 1, { start: '10:00' }, 2);
  const grown = setDays(t, 4, 3);
  expect(grown.days.map((d) => [d.start, d.end])).toEqual([
    ['07:00', '22:00'],
    ['10:00', '19:00'],
    ['09:00', '19:00'],
    ['09:00', '19:00'],
  ]);
  expect(setDays(grown, 1, 4).days).toEqual([{ ...EMPTY_DAY, start: '07:00', end: '22:00' }]);
});

test('removePlace keeps each day’s times', () => {
  const t = addStop(setDayTimes(make(), 0, { start: '07:00', end: '22:00' }, 2), 0, 'a', 2);
  const r = removePlace(t, { level: 'prefecture', id: '13' }, ['a'], 3);
  expect(r.days[0]).toEqual({ ...EMPTY_DAY, start: '07:00', end: '22:00' });
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
  expect(r.days[1]).toEqual(EMPTY_DAY);
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
    setDayTimes(newTrip(init({ name: 'Two', days: 1 }), 3, 't2'), 0, { start: '07:30', end: '21:30' }, 4),
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
  // Structural damage still drops the trip.
  expect(loadTrips(raw({ days: [] })).trips).toEqual([]);
});

/** A trip as builds before per-day times wrote it: who's going, a pace and one day start, and days without times. */
const legacy = (t: Trip, o: { who?: unknown; pace?: unknown; dayStart?: unknown }) => ({
  ...t,
  days: t.days.map(({ stops, wet }) => ({ stops, wet })),
  ...o,
});
const loadOne = (stored: object) => loadTrips(JSON.stringify({ version: 1, trips: [stored] }));

test('loadTrips migrates the old day start and pace into each day’s start and end', () => {
  const t = addStop(make(), 0, 'a', 2);
  const r = loadOne(legacy(t, { who: 'family', pace: 'packed', dayStart: '07:30' }));
  expect(r.notice).toBeNull();
  expect(r.trips).toEqual([{ ...t, days: t.days.map((d) => ({ ...d, start: '07:30', end: '19:30' })) }]);
  const times = (o: Parameters<typeof legacy>[1]) => loadOne(legacy(t, o)).trips[0].days.map((d) => `${d.start}–${d.end}`);
  expect(times({ pace: 'relaxed', dayStart: '09:00' })).toEqual(Array(3).fill('09:00–17:00'));
  expect(times({ pace: 'normal', dayStart: '08:15' })).toEqual(Array(3).fill('08:15–18:15'));
  // A pace that would run past midnight stops at 23:59.
  expect(times({ pace: 'packed', dayStart: '15:00' })).toEqual(Array(3).fill('15:00–23:59'));
});

test('loadTrips gives the defaults where the old fields are missing or unreadable', () => {
  const t = make();
  const times = (o: Parameters<typeof legacy>[1]) => loadOne(legacy(t, o)).trips[0].days.map((d) => `${d.start}–${d.end}`);
  expect(times({})).toEqual(Array(3).fill('09:00–19:00'));
  expect(times({ who: 'nobody', pace: 'frantic', dayStart: '9:00' })).toEqual(Array(3).fill('09:00–19:00'));
  for (const dayStart of ['24:00', '09:60', '', 900, null]) expect(times({ dayStart, pace: 'normal' })).toEqual(Array(3).fill('09:00–19:00'));
  // Only one of the two: the other is the default, or (a late start) the normal 10 h, up to 23:59.
  expect(times({ dayStart: '07:00' })).toEqual(Array(3).fill('07:00–19:00'));
  expect(times({ pace: 'packed' })).toEqual(Array(3).fill('09:00–21:00'));
  expect(times({ dayStart: '20:00' })).toEqual(Array(3).fill('20:00–23:59'));
  // A start at 23:59 leaves no day after it: the defaults.
  expect(times({ dayStart: '23:59', pace: 'normal' })).toEqual(Array(3).fill('09:00–19:00'));
});

test('loadTrips keeps good per-day times and repairs bad ones day by day', () => {
  const t = setDayTimes(make(), 1, { start: '06:00', end: '23:00' }, 2);
  expect(loadTrips(serializeTrips([t])).trips).toEqual([t]);
  const stored = {
    ...t,
    pace: 'relaxed',
    dayStart: '10:00',
    days: [
      { stops: [], wet: [], start: '25:00', end: '18:00' }, // bad start: the old start, and its end stands
      { stops: [], wet: [], start: '08:00', end: '07:00' }, // end not after start: the end from the old pace
      { stops: [], wet: [], start: '08:00' }, // no end
    ],
  };
  expect(loadOne(stored).trips[0].days.map((d) => `${d.start}–${d.end}`)).toEqual(['10:00–18:00', '08:00–16:00', '08:00–16:00']);
});

test('loadTrips drops fields it doesn’t know, so they are gone on the next save', () => {
  const t = make();
  const stored = { ...legacy(t, { who: 'solo', pace: 'normal', dayStart: '09:00' }), colour: 'red', unplanned: [] };
  const [r] = loadOne({ ...stored, days: stored.days.map((d) => ({ ...d, mood: 'sunny' })) }).trips;
  expect(Object.keys(r).sort()).toEqual(['createdAt', 'days', 'id', 'name', 'places', 'saved', 'startDate', 'updatedAt', 'version']);
  expect(Object.keys(r.days[0]).sort()).toEqual(['end', 'start', 'stops', 'wet']);
  expect(serializeTrips([r])).toBe(serializeTrips([t]));
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

test('loadTrips unions saved and unplanned when a trip has both, so nothing is lost', () => {
  const t = saveToTrip(make(), 's', 2);
  expect(loadTrips(JSON.stringify({ version: 1, trips: [{ ...t, unplanned: ['u'] }] })).trips).toEqual([{ ...t, saved: ['s', 'u'] }]);
  // Duplicates across and within the two lists are kept once, saved's order first.
  const both = { ...saveToTrip(t, 'x', 2), unplanned: ['u', 'x', 'u', 's', 'v'] };
  const [r] = loadTrips(JSON.stringify({ version: 1, trips: [both] })).trips;
  expect(r.saved).toEqual(['s', 'x', 'u', 'v']);
  expect('unplanned' in r).toBe(false);
});

test('loadTrips dedupes a migrated unplanned list and drops a trip with neither field', () => {
  const r = loadTrips(JSON.stringify({ version: 1, trips: [oldShape(make(), ['a', 'b', 'a', 'b'])] }));
  expect(r.trips[0].saved).toEqual(['a', 'b']);
  const { saved: _saved, ...neither } = make();
  expect(loadTrips(JSON.stringify({ version: 1, trips: [neither] })).trips).toEqual([]);
});

test('movedToSaved counts only the cut days’ stops that saved doesn’t already hold', () => {
  let t = setDays(make(), 4, 2);
  t = addStop(addStop(addStop(t, 2, 'a', 2), 2, 'b', 2), 3, 'c', 2);
  t = saveToTrip(t, 'b', 2);
  expect(movedToSaved(t, 2)).toBe(2); // a and c; b is already saved
  expect(movedToSaved(t, 3)).toBe(1);
  expect(movedToSaved(t, 4)).toBe(0);
  expect(movedToSaved(saveToTrip(saveToTrip(t, 'a', 2), 'c', 2), 2)).toBe(0);
});
