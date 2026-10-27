import { expect, test } from 'vitest';
import { addPlace, addStop, addWet, newTrip, removePlace, removeStop, removeWet, replaceStop, saveToTrip, unsaveFromTrip } from './trips';
import { undoAddStop, undoRemovePlace, undoRemoveStop, undoRemoveWet, undoReplace, undoUnsave } from './tripUndo';

const base = () => {
  let t = newTrip({ name: 'T', places: [{ level: 'prefecture', id: '13' }], startDate: null, days: 3, who: 'solo', pace: 'normal' }, 1, 't');
  for (const id of ['a', 'b', 'c']) t = addStop(t, 0, id, 1);
  return t;
};
const osaka = { level: 'prefecture' as const, id: '27' };

test('undoRemoveStop puts the stop back at its index', () => {
  const t = removeStop(base(), 0, 'b', 2);
  const r = undoRemoveStop(0, 'b', 1)(t, 3);
  expect(r.days[0].stops).toEqual(['a', 'b', 'c']);
  expect(r.updatedAt).toBe(3);
});

test('undoRemoveStop puts it back on its day and leaves it in saved', () => {
  const t = saveToTrip(removeStop(base(), 0, 'b', 2), 'b', 2);
  const r = undoRemoveStop(0, 'b', 1)(t, 3);
  expect(r.days[0].stops).toEqual(['a', 'b', 'c']);
  expect(r.saved).toEqual(['b']);
});

test('undoRemoveStop is a no-op once the stop is planned on a day again', () => {
  const t = addStop(removeStop(base(), 0, 'b', 2), 2, 'b', 2);
  expect(undoRemoveStop(0, 'b', 1)(t, 3)).toBe(t);
});

test('undoRemoveStop goes to the end when the day got shorter', () => {
  const t = removeStop(removeStop(base(), 0, 'c', 2), 0, 'a', 2);
  expect(undoRemoveStop(0, 'c', 2)(t, 3).days[0].stops).toEqual(['b', 'c']);
});

test('undoReplace takes the replaced stop back out of saved', () => {
  const before = base();
  const t = replaceStop(before, 0, 'b', 'x', 2);
  expect(t.saved).toEqual(['b']);
  const r = undoReplace(before, 0, 'b', 'x')(t, 3);
  expect(r.days).toEqual(before.days);
  expect(r.saved).toEqual([]);
});

test('undoReplace restores the lists as they were', () => {
  const before = saveToTrip(base(), 'x', 1);
  const t = replaceStop(before, 0, 'b', 'x', 2);
  const r = undoReplace(before, 0, 'b', 'x')(t, 3);
  expect(r.days).toEqual(before.days);
  expect(r.saved).toEqual(before.saved);
  expect(r.updatedAt).toBe(3);
});

test('undoReplace is a no-op when the plan changed since', () => {
  const before = base();
  const t = addStop(replaceStop(before, 0, 'b', 'x', 2), 1, 'y', 2);
  expect(undoReplace(before, 0, 'b', 'x')(t, 3)).toBe(t);
});

test('undoReplace keeps a place added since', () => {
  const before = base();
  const t = addPlace(replaceStop(before, 0, 'b', 'x', 2), osaka, 2);
  expect(undoReplace(before, 0, 'b', 'x')(t, 3).places).toHaveLength(2);
});

test('undoRemoveWet puts it back at its index, and is a no-op if it is back already', () => {
  let before = base();
  for (const id of ['p', 'q', 'r']) before = addWet(before, 1, id, 1);
  const t = removeWet(before, 1, 'q', 2);
  expect(undoRemoveWet(1, 'q', 1)(t, 3).days[1].wet).toEqual(['p', 'q', 'r']);
  const again = addWet(t, 1, 'q', 2);
  expect(undoRemoveWet(1, 'q', 1)(again, 3)).toBe(again);
});

test('undoRemovePlace restores the places, days and saved', () => {
  let before = addPlace(base(), osaka, 1);
  before = addWet(saveToTrip(before, 'u', 1), 1, 'b', 1);
  const t = removePlace(before, osaka, ['b', 'u'], 2);
  const r = undoRemovePlace(before, osaka, ['b', 'u'])(t, 3);
  expect([r.places, r.days, r.saved]).toEqual([before.places, before.days, before.saved]);
  expect(r.updatedAt).toBe(3);
});

test('undoRemovePlace is a no-op when the plan changed since', () => {
  const before = addPlace(base(), osaka, 1);
  const t = addStop(removePlace(before, osaka, ['b'], 2), 2, 'z', 2);
  expect(undoRemovePlace(before, osaka, ['b'])(t, 3)).toBe(t);
});

test('undoUnsave puts the attraction back in saved at its index', () => {
  const before = ['x', 'y', 'z'].reduce((t, id) => saveToTrip(t, id, 1), base());
  const t = unsaveFromTrip(before, 'y', 2);
  const r = undoUnsave('y', 1)(t, 3);
  expect(r.saved).toEqual(['x', 'y', 'z']);
  expect(r.updatedAt).toBe(3);
  // An index past the end (the list shrank since) appends.
  expect(undoUnsave('y', 9)(t, 3).saved).toEqual(['x', 'z', 'y']);
});

test('undoUnsave is a no-op when the attraction is saved again already', () => {
  const t = saveToTrip(unsaveFromTrip(saveToTrip(base(), 'x', 1), 'x', 2), 'x', 2);
  expect(undoUnsave('x', 0)(t, 3)).toBe(t);
});

test('undoAddStop takes a newly added stop back off its day', () => {
  const t = addStop(base(), 1, 'x', 2);
  const r = undoAddStop(1, 'x', null)(t, 3);
  expect(r.days[1].stops).toEqual([]);
  expect(r.days[0].stops).toEqual(['a', 'b', 'c']);
  expect(r.updatedAt).toBe(3);
});

test('undoAddStop puts a moved stop back on its old day at its old index', () => {
  const t = addStop(base(), 2, 'b', 2);
  expect(t.days[0].stops).toEqual(['a', 'c']);
  const r = undoAddStop(2, 'b', { day: 0, index: 1 })(t, 3);
  expect(r.days[0].stops).toEqual(['a', 'b', 'c']);
  expect(r.days[2].stops).toEqual([]);
});

test('undoAddStop leaves saved alone', () => {
  const t = addStop(saveToTrip(base(), 'x', 1), 1, 'x', 2);
  expect(undoAddStop(1, 'x', null)(t, 3).saved).toEqual(['x']);
});

test('undoAddStop is a no-op once the stop has left that day', () => {
  const removed = removeStop(addStop(base(), 1, 'x', 2), 1, 'x', 2);
  expect(undoAddStop(1, 'x', null)(removed, 3)).toBe(removed);
  const movedOn = addStop(addStop(base(), 1, 'x', 2), 2, 'x', 2);
  expect(undoAddStop(1, 'x', null)(movedOn, 3)).toBe(movedOn);
});
