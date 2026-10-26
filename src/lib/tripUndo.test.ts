import { expect, test } from 'vitest';
import { addPlace, addStop, addUnplanned, addWet, newTrip, removePlace, removeStop, removeWet, replaceStop } from './trips';
import { undoRemovePlace, undoRemoveStop, undoRemoveWet, undoReplace } from './tripUndo';

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

test('undoRemoveStop takes it back out of unplanned', () => {
  const t = addUnplanned(removeStop(base(), 0, 'b', 2), 'b', 2);
  const r = undoRemoveStop(0, 'b', 1)(t, 3);
  expect(r.days[0].stops).toEqual(['a', 'b', 'c']);
  expect(r.unplanned).toEqual([]);
});

test('undoRemoveStop is a no-op once the stop is planned on a day again', () => {
  const t = addStop(removeStop(base(), 0, 'b', 2), 2, 'b', 2);
  expect(undoRemoveStop(0, 'b', 1)(t, 3)).toBe(t);
});

test('undoRemoveStop goes to the end when the day got shorter', () => {
  const t = removeStop(removeStop(base(), 0, 'c', 2), 0, 'a', 2);
  expect(undoRemoveStop(0, 'c', 2)(t, 3).days[0].stops).toEqual(['b', 'c']);
});

test('undoReplace restores the lists as they were', () => {
  const before = addUnplanned(base(), 'x', 1);
  const t = replaceStop(before, 0, 'b', 'x', 2);
  const r = undoReplace(before, 0, 'b', 'x')(t, 3);
  expect(r.days).toEqual(before.days);
  expect(r.unplanned).toEqual(before.unplanned);
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

test('undoRemovePlace restores the places, days and unplanned', () => {
  let before = addPlace(base(), osaka, 1);
  before = addWet(addUnplanned(before, 'u', 1), 1, 'b', 1);
  const t = removePlace(before, osaka, ['b', 'u'], 2);
  const r = undoRemovePlace(before, osaka, ['b', 'u'])(t, 3);
  expect([r.places, r.days, r.unplanned]).toEqual([before.places, before.days, before.unplanned]);
  expect(r.updatedAt).toBe(3);
});

test('undoRemovePlace is a no-op when the plan changed since', () => {
  const before = addPlace(base(), osaka, 1);
  const t = addStop(removePlace(before, osaka, ['b'], 2), 2, 'z', 2);
  expect(undoRemovePlace(before, osaka, ['b'])(t, 3)).toBe(t);
});
