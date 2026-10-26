import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadTrips, newTrip, serializeTrips, type Trip } from './trips';

// Per-viewer trips, kept in localStorage. Every storage access is wrapped: if storage is
// unavailable, trips last for this visit only.
export const KEY = 'fitline.trips';
export const BACKUP_KEY = 'fitline.trips.backup';

/**
 * Reads the stored trips. When the data was partly or wholly unreadable (there is a notice), the raw
 * text is copied to a backup key first, so the store's first write can't destroy a trip that a
 * later version could still recover.
 */
export function readStored(storage: Pick<Storage, 'getItem' | 'setItem'>): { trips: Trip[]; notice: string | null } {
  let raw: string | null = null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return { trips: [], notice: null };
  }
  const result = loadTrips(raw);
  if (result.notice !== null && raw !== null) {
    try {
      storage.setItem(BACKUP_KEY, raw);
    } catch {
      /* no room or no storage: nothing more we can do */
    }
  }
  return result;
}

function read(): { trips: Trip[]; notice: string | null } {
  try {
    return readStored(localStorage);
  } catch {
    return { trips: [], notice: null };
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
}

const Ctx = createContext<TripsState | null>(null);

export function TripsProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(read);
  const [trips, setTrips] = useState<Trip[]>(initial.trips);
  // Until the first change, leave storage alone, so unreadable data isn't overwritten just by opening the app.
  const untouched = useRef(initial.trips);

  useEffect(() => {
    if (trips === untouched.current) return;
    try {
      localStorage.setItem(KEY, serializeTrips(trips));
    } catch {
      /* storage unavailable or full: trips last for this visit only */
    }
  }, [trips]);

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
    () => ({ trips, get: (id) => trips.find((t) => t.id === id), create, update, remove, restore, notice: initial.notice }),
    [trips, create, update, remove, restore, initial.notice],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrips() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTrips needs TripsProvider');
  return v;
}
