// When to go within the user's own day: the quietest block of a visit's length, nudged towards the
// curated best moments and away from parts of the day rated poor. Pure, minutes from midnight.
import { CROWD_START_HOUR, type Attraction, type Rating } from '../data/types';
import { hhmm } from './format';
import { slotAt } from './timeOfDay';
import { clockMin, DAY_END, DAY_START, isClock } from './trips';

/** The part of a day the best time must fit in. */
export interface DayWindow {
  start: number;
  end: number;
  /** "Day 1 · 09:00–19:00" in planning, "a 09:00–19:00 day" otherwise. */
  label: string;
}

export type BestWindow = { kind: 'best'; from: number; to: number; why: 'quiet' | 'moment' } | { kind: 'closed'; opensAt: number | null };

export interface Moment {
  from: number;
  to: number;
  label: string;
}

const DAY_MIN = 24 * 60;
/** Candidate starts are this far apart. */
const STEP = 30;
/** The crowd assumed for an hour the curve has no value for. */
const MISSING = 50;
const SLOT_PENALTY: Record<Rating, number> = { good: 0, ok: 10, poor: 40 };
/** Taken off the score per hour the block spends inside a curated best time. */
const MOMENT_BONUS = 15;

/** A day's window from its 'HH:MM' start and end; `day` is the trip day (0-based), or null outside planning. */
export function dayWindow(start: string, end: string, day: number | null): DayWindow {
  // A day's times are kept valid (see trips' repair); anything else falls back to the default day.
  const ok = isClock(start) && isClock(end) && clockMin(end) > clockMin(start);
  const s = clockMin(ok ? start : DAY_START);
  const e = clockMin(ok ? end : DAY_END);
  const span = `${hhmm(s)}–${hhmm(e)}`;
  return { start: s, end: e, label: day === null ? `a ${span} day` : `Day ${day + 1} · ${span}` };
}

/** One day's hours as minutes; a close at or before the open runs past midnight. */
function spanOf(h: [string, string] | null | undefined): [number, number] | null {
  if (!h) return null;
  const open = clockMin(h[0]);
  const close = clockMin(h[1]);
  return [open, close <= open ? close + DAY_MIN : close];
}

/**
 * When the place is open on `weekday` (0 = Monday): that day's hours, running past midnight when the
 * close is at or before the open, after the previous night's run past midnight into this morning, if
 * any. Closed all day → [].
 */
export function openSpans(a: Attraction, weekday: number): [number, number][] {
  const hours = a.logistics.hours;
  const out: [number, number][] = [];
  const last = spanOf(hours[(weekday + 6) % 7]);
  if (last && last[1] > DAY_MIN) out.push([0, last[1] - DAY_MIN]);
  const today = spanOf(hours[weekday]);
  if (today) out.push(today);
  return out;
}

/** True when the place is open at `minute` on `weekday`. */
export const isOpenAt = (a: Attraction, weekday: number, minute: number) => openSpans(a, weekday).some(([o, c]) => minute >= o && minute < c);

/** How busy the hour holding `minute` is (0–100), from the weekday or weekend curve; null when closed or off the curve's 06:00–24:00. */
export function crowdAt(a: Attraction, weekday: number, minute: number): number | null {
  const curve = weekday >= 5 ? a.vibe.crowds.weekend : a.vibe.crowds.weekday;
  const i = Math.floor(minute / 60) - CROWD_START_HOUR;
  if (i < 0 || i >= curve.length || !isOpenAt(a, weekday, minute)) return null;
  return curve[i] ?? null;
}

/** The curated best times, in minutes. */
const moments = (a: Attraction): Moment[] => a.conditions.bestTimes.map((b) => ({ from: b.from * 60, to: b.to * 60, label: b.label }));

const overlap = (f1: number, t1: number, f2: number, t2: number) => Math.max(0, Math.min(t1, t2) - Math.max(f1, f2));

/** The curated best time a block overlaps most, or null when it overlaps none. */
export function momentOver(a: Attraction, from: number, to: number): Moment | null {
  let best: Moment | null = null;
  let most = 0;
  for (const m of moments(a)) {
    const o = overlap(from, to, m.from, m.to);
    if (o > most) [best, most] = [m, o];
  }
  return best;
}

/** The curated best times clipped to the window; those wholly outside it are dropped. */
export function momentsIn(a: Attraction, win: DayWindow): Moment[] {
  return moments(a)
    .map((m) => ({ ...m, from: Math.max(m.from, win.start), to: Math.min(m.to, win.end) }))
    .filter((m) => m.to > m.from);
}

/**
 * How busy the hour [from, to) is when any part of it is open: the hour's crowd value, or the same 50
 * the score assumes when the curve has none. Null when it is shut the whole time.
 */
export function hourCrowd(a: Attraction, weekday: number, from: number, to: number): number | null {
  const open = openSpans(a, weekday).filter(([o, c]) => o < to && c > from);
  if (!open.length) return null;
  const first = Math.max(from, Math.min(...open.map(([o]) => o)));
  return crowdAt(a, weekday, first) ?? MISSING;
}

/** The parts of the window the place is shut on `weekday`, in order. */
export function closedIn(a: Attraction, weekday: number, win: DayWindow): [number, number][] {
  const out: [number, number][] = [];
  let t = win.start;
  for (const [o, c] of openSpans(a, weekday)) {
    if (c <= t || o >= win.end) continue;
    if (o > t) out.push([t, o]);
    t = Math.max(t, c);
  }
  if (t < win.end) out.push([t, win.end]);
  return out;
}

/** A planned stop's mean crowd at or above this reads as the busy part of the day. */
export const BUSY = 70;

/** True when a planned stop falls in the busy part of the day (mean crowd over its time ≥ 70). */
export const busyStop = (a: Attraction, weekday: number, stop: { start: number; end: number }) => meanCrowd(a, weekday, stop.start, stop.end) >= BUSY;

/** Mean crowd over [from, to), each hour weighted by the minutes spent in it. */
function meanCrowd(a: Attraction, weekday: number, from: number, to: number): number {
  let sum = 0;
  for (let t = from; t < to; ) {
    const next = Math.min(to, (Math.floor(t / 60) + 1) * 60);
    sum += (crowdAt(a, weekday, t) ?? MISSING) * (next - t);
    t = next;
  }
  return to > from ? sum / (to - from) : MISSING;
}

/**
 * The best block of a visit's length inside the window on `weekday`: the lowest of mean crowd + a
 * penalty for starting in a part of the day rated ok (+10) or poor (+40) − 15 per hour inside a
 * curated best time, over starts every 30 min that let the visit end by the window's end and the
 * close. Ties go to the earliest. The visit (the middle of `visitMin`) is cut to the longest open
 * stretch when that is shorter. No open time in the window → closed, with that day's opening time.
 */
export function bestWindow(a: Attraction, win: DayWindow, weekday: number): BestWindow {
  const parts = openSpans(a, weekday)
    .map(([o, c]): [number, number] => [Math.max(o, win.start), Math.min(c, win.end)])
    .filter(([f, t]) => t > f);
  if (!parts.length) return { kind: 'closed', opensAt: spanOf(a.logistics.hours[weekday])?.[0] ?? null };

  const [lo, hi] = a.logistics.visitMin;
  const visit = Math.min(Math.round((lo + hi) / 2), Math.max(...parts.map(([f, t]) => t - f)));
  const slots = a.conditions.timeOfDay;
  let best = { from: parts[0][0], score: Infinity };
  for (const [f, t] of parts) {
    for (let s = f; s + visit <= t; s += STEP) {
      const inMoments = moments(a).reduce((sum, m) => sum + overlap(s, s + visit, m.from, m.to), 0);
      const score = meanCrowd(a, weekday, s, s + visit) + SLOT_PENALTY[slots[slotAt(s)]] - (MOMENT_BONUS * inMoments) / 60;
      if (score < best.score - 1e-9) best = { from: s, score };
    }
  }
  const to = best.from + visit;
  return { kind: 'best', from: best.from, to, why: momentOver(a, best.from, to) ? 'moment' : 'quiet' };
}
