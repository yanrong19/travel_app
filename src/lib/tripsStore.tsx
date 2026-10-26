import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ATTRACTIONS } from '../data/attractions';
import { loadTrips, newTrip, serializeTrips, type Trip } from './trips';

// Per-viewer trips, kept in localStorage. Every storage access is wrapped: if storage is
// unavailable, trips last for this visit only, and the store says so (saveFailed).
export const KEY = 'fitline.trips';
export const BACKUP_KEY = 'fitline.trips.backup';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Loaded = { trips: Trip[]; notice: string | null; failed: boolean };

const KNOWN = new Set(ATTRACTIONS.map((a) => a.id));
const isKnown = (id: string) => KNOWN.has(id);

/**
 * Reads the stored trips. When the data was partly or wholly unreadable (there is a notice), the raw
 * text is copied to a backup key first, so the store's first write can't destroy a trip that a
 * later version could still recover. `failed` is set when storage itself can't be read.
 */
export function readStored(storage: StorageLike, known?: (id: string) => boolean): Loaded {
  let raw: string | null = null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return { trips: [], notice: null, failed: true };
  }
  const result = loadTrips(raw, known);
  if (result.notice !== null && raw !== null) {
    try {
      storage.setItem(BACKUP_KEY, raw);
    } catch {
      /* no room or no storage: nothing more we can do */
    }
  }
  return { ...result, failed: false };
}

/**
 * The store's persistence, apart from React so it can be tested with a fake storage. It never writes
 * the list storage already holds: neither the one read at the start (so unreadable data isn't
 * overwritten just by opening the app) nor one taken in from another tab (so it isn't written back).
 */
export function tripsSync(storage: StorageLike | null, known?: (id: string) => boolean) {
  const initial: Loaded = storage ? readStored(storage, known) : { trips: [], notice: null, failed: true };
  let held = initial.trips;
  let failed = initial.failed;
  return {
    initial,
    /** Writes the list unless storage already holds it. Returns whether saving has failed. */
    save(trips: Trip[]): boolean {
      if (trips === held) return failed;
      try {
        if (!storage) throw new Error('no storage');
        storage.setItem(KEY, serializeTrips(trips));
        held = trips;
        failed = false;
      } catch {
        failed = true; // storage unavailable or full: trips last for this visit only
      }
      return failed;
    },
    /**
     * Another tab changed storage. Returns the trips it now holds, or null when the change isn't to
     * the trips (another key, or storage cleared) or can't be read (then this tab keeps its own).
     */
    receive(e: { key: string | null; newValue: string | null }): Trip[] | null {
      if (e.key !== KEY || e.newValue === null) return null;
      const r = loadTrips(e.newValue, known);
      if (r.notice !== null) return null;
      held = r.trips;
      return r.trips;
    },
  };
}

function localStore(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type TripInit = Parameters<typeof newTrip>[0];

interface TripsState {
  trips: Trip[];
  get: (id: string) => Trip | undefined;
  create: (init: TripInit) => Trip;
  update: (id: string, fn: (t: Trip, now: number) => Trip) => void;
  remove: (id: string) => void;
  /** Puts a removed trip back (undo). Replaces a trip with the same id. */
  restore: (trip: Trip) => void;
  notice: string | null;
  /** True when trips can't be saved in this browser (storage blocked or full): they last for this visit only. */
  saveFailed: boolean;
}

const Ctx = createContext<TripsState | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
  const [sync] = useState(() => tripsSync(localStore(), isKnown));
  const initial = sync.initial;
  const [trips, setTrips] = useState<Trip[]>(initial.trips);
  const [saveFailed, setSaveFailed] = useState(initial.failed);

  // Until the first change, storage is left alone (see tripsSync).
  useEffect(() => setSaveFailed(sync.save(trips)), [sync, trips]);

  // Another tab saved its trips: take them in, so this tab's next save doesn't overwrite them.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      const next = sync.receive(e);
      if (next) setTrips(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [sync]);

  const create = useCallback((init: TripInit) => {
    const trip = newTrip(init, Date.now(), makeId());
    setTrips((s) => [...s, trip]);
    return trip;
  }, []);

  const update = useCallback((id: string, fn: (t: Trip, now: number) => Trip) => {
    const now = Date.now();
    setTrips((s) => s.map((t) => (t.id === id ? fn(t, now) : t)));
  }, []);

  const remove = useCallback((id: string) => setTrips((s) => s.filter((t) => t.id !== id)), []);

  const restore = useCallback(
    (trip: Trip) => setTrips((s) => [...s.filter((t) => t.id !== trip.id), trip].sort((a, b) => a.createdAt - b.createdAt)),
    [],
  );

  const value = useMemo<TripsState>(
    () => ({ trips, get: (id) => trips.find((t) => t.id === id), create, update, remove, restore, notice: initial.notice, saveFailed }),
    [trips, create, update, remove, restore, initial.notice, saveFailed],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrips() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTrips needs TripsProvider');
  return v;
}
