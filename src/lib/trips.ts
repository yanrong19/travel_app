// Trip model and the pure operations on it. Nothing here touches React or storage.
// Every operation returns a new Trip (inputs are never mutated) with updatedAt set from `now`.

export type PlaceRef = { level: 'country' | 'region' | 'prefecture' | 'area'; id: string };
export type Pace = 'relaxed' | 'normal' | 'packed';
export type Who = 'solo' | 'couple' | 'family' | 'friends';

export interface DayPlan {
  stops: string[];
  wet: string[];
}

export interface Trip {
  version: 1;
  id: string;
  name: string;
  places: PlaceRef[];
  startDate: string | null; // 'YYYY-MM-DD'
  days: DayPlan[];
  unplanned: string[];
  who: Who;
  pace: Pace;
  dayStart: string; // 'HH:MM'
  createdAt: number;
  updatedAt: number;
}

/** Most days a trip can have. */
export const MAX_DAYS = 60;

export const PACE_HOURS: Record<Pace, number> = { relaxed: 8, normal: 10, packed: 12 };

const LEVELS: PlaceRef['level'][] = ['country', 'region', 'prefecture', 'area'];
const PACES: Pace[] = ['relaxed', 'normal', 'packed'];
const WHOS: Who[] = ['solo', 'couple', 'family', 'friends'];

// ---------- creating and dates ----------

/** A whole number of days within 1..MAX_DAYS; anything that isn't a finite number becomes 1. */
const clampDays = (n: number) => (Number.isFinite(n) ? Math.min(MAX_DAYS, Math.max(1, Math.floor(n))) : 1);

const emptyDay = (): DayPlan => ({ stops: [], wet: [] });

export function newTrip(
  init: { name: string; places: PlaceRef[]; startDate: string | null; days: number; who: Who; pace: Pace; dayStart?: string },
  now: number,
  id: string,
): Trip {
  const n = clampDays(init.days);
  return {
    version: 1,
    id,
    name: init.name,
    places: init.places.map((p) => ({ ...p })),
    startDate: init.startDate,
    days: Array.from({ length: n }, emptyDay),
    unplanned: [],
    who: init.who,
    pace: init.pace,
    dayStart: init.dayStart ?? '09:00',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Parses 'YYYY-MM-DD' as a local calendar date (no time-zone shift). Null if it isn't one, or its year
 * is below 1000 (a date input reports "0027-…" while a year is still being typed).
 */
export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = +m[1];
  if (y < 1000) return null;
  const mo = +m[2];
  const d = +m[3];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The calendar date of a day (0-based), or null when the trip has no start date. */
export function dateOf(trip: Trip, day: number): Date | null {
  if (!trip.startDate) return null;
  const s = parseDate(trip.startDate);
  return s ? new Date(s.getFullYear(), s.getMonth(), s.getDate() + day) : null;
}

/** The last day as 'YYYY-MM-DD', or null when the trip has no start date. */
export function endDate(trip: Trip): string | null {
  const d = dateOf(trip, trip.days.length - 1);
  return d ? fmtDate(d) : null;
}

/** Number of days from start to end, counting both ends. */
export function daysBetween(start: string, end: string): number {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b) return 0;
  // UTC avoids a daylight-saving hour throwing the division off.
  const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86_400_000) + 1;
}

// ---------- operations ----------

const stamp = (trip: Trip, now: number, patch: Partial<Trip>): Trip => ({ ...trip, ...patch, updatedAt: now });
const hasDay = (trip: Trip, day: number) => Number.isInteger(day) && day >= 0 && day < trip.days.length;
const without = (list: string[], id: string) => list.filter((x) => x !== id);
const withDay = (days: DayPlan[], day: number, patch: Partial<DayPlan>) =>
  days.map((d, i) => (i === day ? { ...d, ...patch } : d));

/** A copy of the days with `id` taken out of every day's stops (wet lists are separate and stay). */
const unstop = (days: DayPlan[], id: string) =>
  days.map((d) => (d.stops.includes(id) ? { ...d, stops: without(d.stops, id) } : d));

/** Changes the number of days. Stops on removed days go to unplanned; their wet lists are dropped. */
export function setDays(trip: Trip, n: number, now: number): Trip {
  const count = clampDays(n);
  if (count === trip.days.length) return trip;
  if (count > trip.days.length) {
    const extra = Array.from({ length: count - trip.days.length }, emptyDay);
    return stamp(trip, now, { days: [...trip.days, ...extra] });
  }
  const orphans = trip.days.slice(count).flatMap((d) => d.stops);
  const unplanned = [...trip.unplanned];
  for (const id of orphans) if (!unplanned.includes(id)) unplanned.push(id);
  return stamp(trip, now, { days: trip.days.slice(0, count), unplanned });
}

/** Puts a stop at the end of a day. On another day it moves; already on this day it's a no-op. */
export function addStop(trip: Trip, day: number, id: string, now: number): Trip {
  if (!hasDay(trip, day)) return trip;
  if (dayOf(trip, id) === day && !trip.days.some((d, i) => i !== day && d.stops.includes(id))) return trip;
  const days = unstop(trip.days, id).map((d, i) => (i === day ? { ...d, stops: [...d.stops, id] } : d));
  return stamp(trip, now, { days, unplanned: without(trip.unplanned, id) });
}

export function removeStop(trip: Trip, day: number, id: string, now: number): Trip {
  if (!hasDay(trip, day) || !trip.days[day].stops.includes(id)) return trip;
  return stamp(trip, now, { days: withDay(trip.days, day, { stops: without(trip.days[day].stops, id) }) });
}

/** Moves the stop at index `from` to index `to` within a day. */
export function moveStop(trip: Trip, day: number, from: number, to: number, now: number): Trip {
  if (!hasDay(trip, day)) return trip;
  const stops = trip.days[day].stops.slice();
  if (from < 0 || from >= stops.length || to < 0 || to >= stops.length || from === to) return trip;
  const [s] = stops.splice(from, 1);
  stops.splice(to, 0, s);
  return stamp(trip, now, { days: withDay(trip.days, day, { stops }) });
}

/** Swaps a stop for another in the same position. The new one is taken from wherever else it was planned. */
export function replaceStop(trip: Trip, day: number, oldId: string, newId: string, now: number): Trip {
  if (!hasDay(trip, day)) return trip;
  const at = trip.days[day].stops.indexOf(oldId);
  if (at < 0 || oldId === newId) return trip;
  const cleaned = unstop(trip.days, newId); // removes newId from this day too, which can shift `at`
  const pos = cleaned[day].stops.indexOf(oldId);
  const stops = cleaned[day].stops.slice();
  stops[pos] = newId;
  // The replaced stop waits in unplanned, so a replace never loses anything.
  const unplanned = without(trip.unplanned, newId);
  if (!unplanned.includes(oldId)) unplanned.push(oldId);
  return stamp(trip, now, { days: withDay(cleaned, day, { stops }), unplanned });
}

/** Adds to a day's wet-weather list. Never touches the day's stops. */
export function addWet(trip: Trip, day: number, id: string, now: number): Trip {
  if (!hasDay(trip, day) || trip.days[day].wet.includes(id)) return trip;
  return stamp(trip, now, { days: withDay(trip.days, day, { wet: [...trip.days[day].wet, id] }) });
}

export function removeWet(trip: Trip, day: number, id: string, now: number): Trip {
  if (!hasDay(trip, day) || !trip.days[day].wet.includes(id)) return trip;
  return stamp(trip, now, { days: withDay(trip.days, day, { wet: without(trip.days[day].wet, id) }) });
}

/** Parks an attraction in unplanned. Already planned on a day, or already parked: no-op. */
export function addUnplanned(trip: Trip, id: string, now: number): Trip {
  if (trip.unplanned.includes(id) || dayOf(trip, id) !== null) return trip;
  return stamp(trip, now, { unplanned: [...trip.unplanned, id] });
}

/** Moves an unplanned attraction onto a day. */
export function planUnplanned(trip: Trip, id: string, day: number, now: number): Trip {
  if (!trip.unplanned.includes(id)) return trip;
  return addStop(trip, day, id, now);
}

export function addPlace(trip: Trip, ref: PlaceRef, now: number): Trip {
  if (trip.places.some((p) => p.level === ref.level && p.id === ref.id)) return trip;
  return stamp(trip, now, { places: [...trip.places, { ...ref }] });
}

/** Drops a place and the listed attractions (the stops no remaining place covers) from every list. */
export function removePlace(trip: Trip, ref: PlaceRef, removeStops: string[], now: number): Trip {
  const drop = new Set(removeStops);
  const places = trip.places.filter((p) => !(p.level === ref.level && p.id === ref.id));
  const days = trip.days.map((d) => ({
    stops: d.stops.filter((x) => !drop.has(x)),
    wet: d.wet.filter((x) => !drop.has(x)),
  }));
  const unplanned = trip.unplanned.filter((x) => !drop.has(x));
  const same =
    places.length === trip.places.length &&
    unplanned.length === trip.unplanned.length &&
    days.every((d, i) => d.stops.length === trip.days[i].stops.length && d.wet.length === trip.days[i].wet.length);
  return same ? trip : stamp(trip, now, { places, days, unplanned });
}

// ---------- queries ----------

/** The day (0-based) holding the stop; -1 when it is in unplanned; null when it isn't in the trip. */
export function dayOf(trip: Trip, id: string): number | null {
  const i = trip.days.findIndex((d) => d.stops.includes(id));
  if (i >= 0) return i;
  return trip.unplanned.includes(id) ? -1 : null;
}

// ---------- storage ----------

export function serializeTrips(trips: Trip[]): string {
  return JSON.stringify({ version: 1, trips });
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isPlaceRef(v: unknown): v is PlaceRef {
  const p = v as PlaceRef | null;
  return !!p && typeof p === 'object' && LEVELS.includes(p.level) && typeof p.id === 'string';
}

function isDayPlan(v: unknown): v is DayPlan {
  const d = v as DayPlan | null;
  return !!d && typeof d === 'object' && isStrings(d.stops) && isStrings(d.wet);
}

/** The structure a trip can't be read without. Dates, times and attraction ids are repaired instead (see repair). */
function isTrip(v: unknown): v is Trip {
  const t = v as Trip | null;
  return (
    !!t &&
    typeof t === 'object' &&
    t.version === 1 &&
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    Array.isArray(t.places) &&
    t.places.every(isPlaceRef) &&
    Array.isArray(t.days) &&
    t.days.length >= 1 &&
    t.days.every(isDayPlan) &&
    isStrings(t.unplanned) &&
    WHOS.includes(t.who) &&
    PACES.includes(t.pace) &&
    isNum(t.createdAt) &&
    isNum(t.updatedAt)
  );
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Fixes what can be fixed without losing the trip: an unreadable start date becomes no date, an
 * unreadable day start becomes 09:00, and attraction ids the data no longer has are dropped.
 */
function repair(t: Trip, isKnown?: (id: string) => boolean): Trip {
  const startDate = typeof t.startDate === 'string' && parseDate(t.startDate) ? t.startDate : null;
  const dayStart = typeof t.dayStart === 'string' && HHMM.test(t.dayStart) ? t.dayStart : '09:00';
  const keep = (list: string[]) => (isKnown ? list.filter(isKnown) : list);
  const days = t.days.map((d) => ({ stops: keep(d.stops), wet: keep(d.wet) }));
  return { ...t, startDate, dayStart, days, unplanned: keep(t.unplanned) };
}

/**
 * Reads what serializeTrips wrote. Never throws: bad data gives fewer trips and a notice. With
 * `isKnown`, attraction ids it rejects are pruned (the data has dropped them).
 */
export function loadTrips(raw: string | null, isKnown?: (id: string) => boolean): { trips: Trip[]; notice: string | null } {
  if (raw === null) return { trips: [], notice: null };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { trips: [], notice: "Your saved trips couldn't be read, so you're starting fresh." };
  }
  const d = data as { version?: unknown; trips?: unknown } | null;
  if (!d || typeof d !== 'object' || d.version !== 1 || !Array.isArray(d.trips)) {
    return { trips: [], notice: "Your saved trips are in a format this version doesn't know, so you're starting fresh." };
  }
  const trips = d.trips.filter(isTrip).map((t) => repair(t, isKnown));
  const lost = d.trips.length - trips.length;
  return {
    trips,
    notice: lost > 0 ? `${lost} saved ${lost === 1 ? 'trip' : 'trips'} couldn't be read and ${lost === 1 ? 'was' : 'were'} skipped.` : null,
  };
}
