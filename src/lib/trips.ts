// Trip model and the pure operations on it. Nothing here touches React or storage.
// Every operation returns a new Trip (inputs are never mutated) with updatedAt set from `now`.

export type PlaceRef = { level: 'country' | 'region' | 'prefecture' | 'area' | 'neighbourhood'; id: string };

export interface DayPlan {
  stops: string[];
  wet: string[];
  /** When the day starts and ends, 'HH:MM'. The end is after the start, on the same day (see setDayTimes). */
  start: string;
  end: string;
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
  createdAt: number;
  updatedAt: number;
}

/** Most days a trip can have. */
export const MAX_DAYS = 60;

/** A new day's times. */
export const DAY_START = '09:00';
export const DAY_END = '19:00';

/**
 * How long a day was at each of the old trip-wide paces. Only for reading trips saved before each day
 * had its own start and end (see repair).
 */
export const PACE_HOURS = { relaxed: 8, normal: 10, packed: 12 } as const;
type Pace = keyof typeof PACE_HOURS;

// Neighbourhoods are map-only: a trip never holds one, so a stored trip place at that level is invalid.
const LEVELS: PlaceRef['level'][] = ['country', 'region', 'prefecture', 'area'];

// ---------- clock times ----------

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** True for a 'HH:MM' clock time, 00:00 to 23:59. */
export const isClock = (v: unknown): v is string => typeof v === 'string' && HHMM.test(v);
/** 'HH:MM' → minutes from midnight. */
export const clockMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const LAST_MIN = 23 * 60 + 59;
const pad = (n: number) => String(n).padStart(2, '0');
/** Minutes from midnight → 'HH:MM', clamped to 00:00..23:59. */
const toClock = (min: number) => {
  const m = Math.min(LAST_MIN, Math.max(0, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/**
 * A time as someone types it, as 'HH:MM', or null when it isn't one: "9", "930", "0930", "9:30",
 * "9.30", "21:15", "9pm", "9:30 am". Hours run 0 to 23 (1 to 12 with am or pm); minutes 0 to 59.
 */
export function parseClock(text: string): string | null {
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?\s*(?:([ap])\.?m?\.?)?$/i.exec(text.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  const half = m[3]?.toLowerCase();
  if (min > 59) return null;
  if (half) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (half === 'p' ? 12 : 0);
  } else if (h > 23) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** A clock time moved by `delta` minutes, kept within 00:00..23:59. */
export const stepClock = (t: string, delta: number): string => toClock(clockMin(t) + delta);

// ---------- creating and dates ----------

/** A whole number of days within 1..MAX_DAYS; anything that isn't a finite number becomes 1. */
const clampDays = (n: number) => (Number.isFinite(n) ? Math.min(MAX_DAYS, Math.max(1, Math.floor(n))) : 1);

const emptyDay = (): DayPlan => ({ stops: [], wet: [], start: DAY_START, end: DAY_END });

export function newTrip(init: { name: string; places: PlaceRef[]; startDate: string | null; days: number }, now: number, id: string): Trip {
  const n = clampDays(init.days);
  return {
    version: 1,
    id,
    name: init.name,
    places: init.places.map((p) => ({ ...p })),
    startDate: init.startDate,
    days: Array.from({ length: n }, emptyDay),
    saved: [],
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

/** Sets or clears the start date (the end follows the number of days). A string that isn't a date is a no-op. */
export function setStartDate(trip: Trip, date: string | null, now: number): Trip {
  if ((date !== null && !parseDate(date)) || date === trip.startDate) return trip;
  return stamp(trip, now, { startDate: date });
}

/**
 * Sets a day's start, end or both ('HH:MM'). A day doesn't run past midnight: the end must be later
 * than the start on the same clock, so a late night ends at 23:59 at the latest. Bad input (not a
 * clock time, an end not after the start, a day that doesn't exist) is a no-op, as is no change.
 */
export function setDayTimes(trip: Trip, day: number, times: { start?: string; end?: string }, now: number): Trip {
  if (!hasDay(trip, day)) return trip;
  const d = trip.days[day];
  const start = times.start ?? d.start;
  const end = times.end ?? d.end;
  if (!isClock(start) || !isClock(end) || clockMin(end) <= clockMin(start)) return trip;
  if (start === d.start && end === d.end) return trip;
  return stamp(trip, now, { days: withDay(trip.days, day, { start, end }) });
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
    ...d,
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

/** A day as stored. Builds before per-day times wrote none; repair fills them in. */
type StoredDay = Pick<DayPlan, 'stops' | 'wet'> & { start?: unknown; end?: unknown };

function isDayPlan(v: unknown): v is StoredDay {
  const d = v as StoredDay | null;
  return !!d && typeof d === 'object' && isStrings(d.stops) && isStrings(d.wet);
}

/**
 * A trip as stored. Builds before the saved list wrote `unplanned` instead. Builds before per-day
 * times had a trip-wide `dayStart` and `pace`, and `who`, which is dropped. Repair migrates them.
 */
type StoredTrip = Omit<Trip, 'saved' | 'days'> & {
  days: StoredDay[];
  saved?: string[];
  unplanned?: string[];
  dayStart?: unknown;
  pace?: unknown;
};

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
    isNum(t.createdAt) &&
    isNum(t.updatedAt)
  );
}

const isPace = (v: unknown): v is Pace => typeof v === 'string' && Object.hasOwn(PACE_HOURS, v);

/**
 * A stored day's times. Readable ones (an end after the start) stand. Otherwise they come from the old
 * trip-wide fields: the start from `dayStart`, the end that many pace hours later, up to 23:59. Without
 * a pace the end is 19:00, or 10 h after a start that late. With neither, or with no time left in the
 * day after its start, 09:00 to 19:00.
 */
function dayTimes(d: StoredDay, dayStart: unknown, pace: unknown): Pick<DayPlan, 'start' | 'end'> {
  const start = isClock(d.start) ? d.start : isClock(dayStart) ? dayStart : DAY_START;
  const from = clockMin(start);
  if (isClock(d.end) && clockMin(d.end) > from) return { start, end: d.end };
  let end = isPace(pace) ? toClock(from + PACE_HOURS[pace] * 60) : DAY_END;
  if (clockMin(end) <= from) end = toClock(from + PACE_HOURS.normal * 60);
  return clockMin(end) > from ? { start, end } : { start: DAY_START, end: DAY_END };
}

/**
 * Fixes what can be fixed without losing the trip: an unreadable start date becomes no date,
 * attraction ids the data no longer has are dropped, an old `unplanned` list becomes `saved` (a trip
 * with both gets the two joined, so nothing is lost), and days without readable times get them (see
 * dayTimes). Only a Trip's own fields are kept, in newTrip's order, so anything else (`who`, `pace`,
 * `dayStart`, fields from a later build) is gone on the next save.
 */
function repair(t: StoredTrip, isKnown?: (id: string) => boolean): Trip {
  const startDate = typeof t.startDate === 'string' && parseDate(t.startDate) ? t.startDate : null;
  const keep = (list: string[]) => (isKnown ? list.filter(isKnown) : list);
  const days = t.days.map((d) => ({ stops: keep(d.stops), wet: keep(d.wet), ...dayTimes(d, t.dayStart, t.pace) }));
  const saved = withAll([], [...(isStrings(t.saved) ? t.saved : []), ...(isStrings(t.unplanned) ? t.unplanned : [])]);
  return {
    version: 1,
    id: t.id,
    name: t.name,
    places: t.places.map((p) => ({ level: p.level, id: p.id })),
    startDate,
    days,
    saved: keep(saved),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
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
