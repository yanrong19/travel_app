import { expect, test } from 'vitest';
import { BACKUP_KEY, KEY, readStored } from './tripsStore';
import { newTrip, serializeTrips } from './trips';

function fake(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

test('corrupt data is backed up and reported', () => {
  const s = fake({ [KEY]: '{nope' });
  const r = readStored(s);
  expect(r.trips).toEqual([]);
  expect(r.notice).toEqual(expect.any(String));
  expect(s.m.get(BACKUP_KEY)).toBe('{nope');
  expect(s.m.get(KEY)).toBe('{nope');
});

test('an unknown version is backed up', () => {
  const raw = JSON.stringify({ version: 9, trips: [{ id: 'x' }] });
  const s = fake({ [KEY]: raw });
  readStored(s);
  expect(s.m.get(BACKUP_KEY)).toBe(raw);
});

test('partly bad data keeps the good trips and backs up the original', () => {
  const good = newTrip({ name: 'A', places: [], startDate: null, days: 1, who: 'solo', pace: 'normal' }, 1, 'a');
  const raw = JSON.stringify({ version: 1, trips: [good, { id: 1 }] });
  const s = fake({ [KEY]: raw });
  expect(readStored(s).trips).toEqual([good]);
  expect(s.m.get(BACKUP_KEY)).toBe(raw);
});

test('clean or missing data makes no backup', () => {
  const clean = fake({ [KEY]: serializeTrips([]) });
  readStored(clean);
  expect(clean.m.has(BACKUP_KEY)).toBe(false);
  const empty = fake();
  expect(readStored(empty)).toEqual({ trips: [], notice: null });
  expect(empty.m.size).toBe(0);
});

test('a storage that throws gives an empty list, not a crash', () => {
  const boom = () => {
    throw new Error('blocked');
  };
  expect(readStored({ getItem: boom, setItem: boom })).toEqual({ trips: [], notice: null });
  expect(readStored({ getItem: () => '{nope', setItem: boom }).trips).toEqual([]);
});
