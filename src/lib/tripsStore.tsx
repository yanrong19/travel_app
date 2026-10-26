import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadTrips, newTrip, serializeTrips, type Trip } from './trips';

// Per-viewer trips, kept in localStorage. Every storage access is wrapped: if storage is
// unavailable, trips last for this visit only.
const KEY = 'fitline.trips';

function read(): { trips: Trip[]; notice: string | null } {
  try {
    return loadTrips(localStorage.getItem(KEY));
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
