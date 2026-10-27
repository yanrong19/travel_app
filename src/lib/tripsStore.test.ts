import { expect, test } from 'vitest';
import { BACKUP_KEY, KEY, readStored, tripsSync } from './tripsStore';
import { addStop, newTrip, serializeTrips, type Trip } from './trips';

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
  const good = newTrip({ name: 'A', places: [], startDate: null, days: 1 }, 1, 'a');
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
  expect(readStored(empty)).toEqual({ trips: [], notice: null, failed: false });
  expect(empty.m.size).toBe(0);
});

test('a storage that throws gives an empty list, not a crash', () => {
  const boom = () => {
    throw new Error('blocked');
  };
  expect(readStored({ getItem: boom, setItem: boom })).toEqual({ trips: [], notice: null, failed: true });
  expect(readStored({ getItem: () => '{nope', setItem: boom }).trips).toEqual([]);
});

// ---------- the store's persistence (what TripsProvider runs on) ----------

function counting(initial: Record<string, string> = {}) {
  const s = fake(initial);
  const writes: string[] = [];
  const setItem = (k: string, v: string) => {
    writes.push(k);
    s.setItem(k, v);
  };
  return { ...s, writes, setItem };
}
const tripA = newTrip({ name: 'A', places: [], startDate: null, days: 1 }, 1, 'a');
const tripB = newTrip({ name: 'B', places: [], startDate: null, days: 2 }, 2, 'b');

test('no write until the first change', () => {
  const s = counting({ [KEY]: serializeTrips([tripA]) });
  const sync = tripsSync(s);
  expect(sync.initial.trips).toEqual([tripA]);
  expect(sync.save(sync.initial.trips)).toBe(false);
  expect(s.writes).toEqual([]);
  expect(sync.save([...sync.initial.trips, tripB])).toBe(false);
  expect(s.writes).toEqual([KEY]);
  expect(s.m.get(KEY)).toBe(serializeTrips([tripA, tripB]));
});

test('a storage event from another tab is taken in and not written back', () => {
  const s = counting({ [KEY]: serializeTrips([tripA]) });
  const sync = tripsSync(s);
  const raw = serializeTrips([tripA, tripB]);
  s.m.set(KEY, raw); // the other tab's write
  const next = sync.receive({ key: KEY, newValue: raw });
  expect(next).toEqual([tripA, tripB]);
  expect(sync.save(next!)).toBe(false);
  expect(s.writes).toEqual([]);
  // Other keys, a cleared storage and unreadable data are ignored.
  expect(sync.receive({ key: 'fitline.saved', newValue: '[]' })).toBeNull();
  expect(sync.receive({ key: null, newValue: null })).toBeNull();
  expect(sync.receive({ key: KEY, newValue: '{nope' })).toBeNull();
});

test('a storage event drops attraction ids the data no longer has', () => {
  const sync = tripsSync(fake(), (id) => id !== 'gone');
  const t = addStop(addStop(tripA, 0, 'senso-ji', 3), 0, 'gone', 3);
  expect(sync.receive({ key: KEY, newValue: serializeTrips([t]) })![0].days[0].stops).toEqual(['senso-ji']);
});

test('a failed write or an unreadable storage is reported', () => {
  const boom = () => {
    throw new Error('blocked');
  };
  const sync = tripsSync({ ...fake(), setItem: boom });
  expect(sync.initial.failed).toBe(false);
  expect(sync.save([tripA])).toBe(true);
  expect(tripsSync({ getItem: boom, setItem: () => {} }).initial.failed).toBe(true);
  expect(tripsSync(null).initial.failed).toBe(true);
  expect(tripsSync(null).save([tripA])).toBe(true);
});

/** Trips as an older build wrote them: `unplanned` instead of `saved`. */
const oldRaw = (trips: Trip[], unplanned: string[]) =>
  JSON.stringify({ version: 1, trips: trips.map(({ saved: _saved, ...rest }) => ({ ...rest, unplanned })) });

test('older trips with unplanned are migrated to saved on read, with no backup', () => {
  const s = fake({ [KEY]: oldRaw([tripA], ['senso-ji']) });
  const r = readStored(s);
  expect(r.trips).toEqual([{ ...tripA, saved: ['senso-ji'] }]);
  expect(r.notice).toBeNull();
  expect(s.m.has(BACKUP_KEY)).toBe(false);
});

test('a storage event with older trips is migrated too', () => {
  const sync = tripsSync(fake(), (id) => id !== 'gone');
  const next = sync.receive({ key: KEY, newValue: oldRaw([tripB], ['senso-ji', 'gone']) });
  expect(next).toEqual([{ ...tripB, saved: ['senso-ji'] }]);
});

test('a trip saved before per-day times loads with each day timed, and the next save drops the old fields', () => {
  const t = addStop(newTrip({ name: 'Old', places: [], startDate: '2027-04-10', days: 2 }, 1, 'old'), 0, 'senso-ji', 1);
  const old = { ...t, days: t.days.map(({ stops, wet }) => ({ stops, wet })), who: 'family', pace: 'relaxed', dayStart: '08:00' };
  const s = counting({ [KEY]: JSON.stringify({ version: 1, trips: [old] }) });
  const sync = tripsSync(s);
  expect(sync.initial.notice).toBeNull();
  expect(sync.initial.trips[0].days.map((d) => [d.start, d.end])).toEqual([
    ['08:00', '16:00'],
    ['08:00', '16:00'],
  ]);
  expect(s.writes).toEqual([]); // opening the app doesn't rewrite it
  sync.save([...sync.initial.trips]);
  const saved = JSON.parse(s.m.get(KEY)!).trips[0];
  for (const k of ['who', 'pace', 'dayStart']) expect(k in saved).toBe(false);
  expect(saved.days[0]).toEqual({ stops: ['senso-ji'], wet: [], start: '08:00', end: '16:00' });
});
