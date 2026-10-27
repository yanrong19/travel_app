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
  /** The trip's shortlist: attractions saved for this trip, planned on a day or not. Never duplicated. */
  saved: string[];
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
    saved: [],
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
/** The list with the ids appended that it doesn't already hold, in order. */
const withAll = (list: string[], ids: string[]) => {
  const out = [...list];
  for (const id of ids) if (!out.includes(id)) out.push(id);
  return out;
};
const withDay = (days: DayPlan[], day: number, patch: Partial<DayPlan>) =>
  days.map((d, i) => (i === day ? { ...d, ...patch } : d));

/** A copy of the days with `id` taken out of every day's stops (wet lists are separate and stay). */
const unstop = (days: DayPlan[], id: string) =>
  days.map((d) => (d.stops.includes(id) ? { ...d, stops: without(d.stops, id) } : d));

/** Changes the number of days. Stops on removed days go to saved; their wet lists are dropped. */
export function setDays(trip: Trip, n: number, now: number): Trip {
  const count = clampDays(n);
  if (count === trip.days.length) return trip;
  if (count > trip.days.length) {
    const extra = Array.from({ length: count - trip.days.length }, emptyDay);
    return stamp(trip, now, { days: [...trip.days, ...extra] });
  }
  const orphans = trip.days.slice(count).flatMap((d) => d.stops);
  return stamp(trip, now, { days: trip.days.slice(0, count), saved: withAll(trip.saved, orphans) });
}

/** How many attractions cutting the trip to `n` days adds to saved: stops past day n that saved doesn't hold yet. */
export function movedToSaved(trip: Trip, n: number): number {
  const orphans = trip.days.slice(clampDays(n)).flatMap((d) => d.stops);
  return withAll(trip.saved, orphans).length - trip.saved.length;
}

/**
 * Puts a stop at the end of a day. On another day it moves; already on this day it's a no-op. Saved is
 * a shortlist, so planning a saved attraction leaves it in saved.
 */
export function addStop(trip: Trip, day: number, id: string, now: number): Trip {
  if (!hasDay(trip, day)) return trip;
  if (dayOf(trip, id) === day && !trip.days.some((d, i) => i !== day && d.stops.includes(id))) return trip;
  const days = unstop(trip.days, id).map((d, i) => (i === day ? { ...d, stops: [...d.stops, id] } : d));
  return stamp(trip, now, { days });
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
  // The replaced stop goes to saved, so a replace never loses anything. The new one stays saved if it was.
  return stamp(trip, now, { days: withDay(cleaned, day, { stops }), saved: withAll(trip.saved, [oldId]) });
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

/** Adds an attraction to the trip's saved list, whether or not it is on a day. Already saved: no-op. */
export function saveToTrip(trip: Trip, id: string, now: number): Trip {
  if (trip.saved.includes(id)) return trip;
  return stamp(trip, now, { saved: [...trip.saved, id] });
}

/** Takes an attraction off the trip's saved list. Its day plans are untouched. */
export function unsaveFromTrip(trip: Trip, id: string, now: number): Trip {
  if (!trip.saved.includes(id)) return trip;
  return stamp(trip, now, { saved: without(trip.saved, id) });
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
  const saved = trip.saved.filter((x) => !drop.has(x));
  const same =
    places.length === trip.places.length &&
    saved.length === trip.saved.length &&
    days.every((d, i) => d.stops.length === trip.days[i].stops.length && d.wet.length === trip.days[i].wet.length);
  return same ? trip : stamp(trip, now, { places, days, saved });
}

// ---------- queries ----------

/** The day (0-based) holding the stop, or null when it isn't on a day (saved or not). */
export function dayOf(trip: Trip, id: string): number | null {
  const i = trip.days.findIndex((d) => d.stops.includes(id));
  return i >= 0 ? i : null;
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

/** A trip as stored. Builds before the saved list wrote `unplanned` instead; repair migrates it. */
type StoredTrip = Omit<Trip, 'saved'> & { saved?: string[]; unplanned?: string[] };

/**
 * The structure a trip can't be read without. Dates, times and attraction ids are repaired instead
 * (see repair). The saved list may be under its old name, `unplanned`.
 */
function isTrip(v: unknown): v is StoredTrip {
  const t = v as StoredTrip | null;
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
    (isStrings(t.saved) || isStrings(t.unplanned)) &&
    WHOS.includes(t.who) &&
    PACES.includes(t.pace) &&
    isNum(t.createdAt) &&
    isNum(t.updatedAt)
  );
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Fixes what can be fixed without losing the trip: an unreadable start date becomes no date, an
 * unreadable day start becomes 09:00, attraction ids the data no longer has are dropped, and an old
 * `unplanned` list becomes `saved` (a trip with both gets the two joined, so nothing is lost).
 */
function repair(stored: StoredTrip, isKnown?: (id: string) => boolean): Trip {
  const { unplanned, ...t } = stored; // `t.saved` keeps its key position, so a round trip serializes the same
  const startDate = typeof t.startDate === 'string' && parseDate(t.startDate) ? t.startDate : null;
  const dayStart = typeof t.dayStart === 'string' && HHMM.test(t.dayStart) ? t.dayStart : '09:00';
  const keep = (list: string[]) => (isKnown ? list.filter(isKnown) : list);
  const days = t.days.map((d) => ({ stops: keep(d.stops), wet: keep(d.wet) }));
  const saved = withAll([], [...(isStrings(t.saved) ? t.saved : []), ...(isStrings(unplanned) ? unplanned : [])]);
  return { ...t, startDate, dayStart, days, saved: keep(saved) };
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
