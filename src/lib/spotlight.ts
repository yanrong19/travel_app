// The map spotlight: one attraction picked out on the map, the places within walking distance of it,
// and how close the camera comes. Pure.
import type { Attraction } from '../data/types';

/** Within this many metres an attraction counts as near the spot: about a ten-minute walk. */
export const NEAR_M = 800;

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres between two [lon, lat] points (haversine). */
export function metres(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ids of the attractions within NEAR_M of `id`, nearest first, whatever their neighbourhood; [] when `id` isn't in the pool. */
export function neighboursOf(id: string, pool: Attraction[]): string[] {
  const spot = pool.find((a) => a.id === id);
  if (!spot) return [];
  return pool
    .filter((a) => a.id !== id)
    .map((a) => ({ id: a.id, d: metres(spot.lonlat, a.lonlat) }))
    .filter((x) => x.d <= NEAR_M)
    .sort((x, y) => x.d - y.d)
    .map((x) => x.id);
}

/** The spot's zoom: street level on a laptop, a half step wider on a phone. */
export const spotZoom = (width: number): number => (width >= 761 ? 16 : 15.5);

/** Entering a spot adds a history entry (so Back leaves it); moving between spots or leaving replaces it. */
export const spotHistory = (wasSpot: string | null, nextSpot: string | null): 'push' | 'replace' =>
  wasSpot === null && nextSpot !== null ? 'push' : 'replace';

/**
 * Leaving the spot (the card's close, Esc, a crumb): one step back when this page pushed the spot's
 * entry (so the history has no spot entry left behind), else the spot is replaced away; nothing to
 * do with no spot open.
 */
export const spotLeave = (spot: string | null, pushed: boolean): 'back' | 'replace' | 'none' =>
  !spot ? 'none' : pushed ? 'back' : 'replace';

/**
 * The planner's search params that aren't steps in history (the day, the Browse sub-tab, the
 * wet-weather toggle): changed while a spot is open they replace the spot's entry, so stepping back
 * off it would bring the old ones back. They are carried over instead.
 */
export const SPOT_KEPT = ['day', 'tab', 'wet'] as const;

/** A planner location as afterSpotPop reads it. */
export interface SpotLoc {
  pathname: string;
  search: string;
}

/**
 * After a location change: when it was a pop (Back, or a leave's step back) off a spot onto the same
 * page without one, the search it landed on with the day, sub-tab and wet toggle from just before
 * the pop; null when there is nothing to put back (not such a pop, or they already match).
 */
export function afterSpotPop(prev: SpotLoc, next: SpotLoc, pop: boolean): URLSearchParams | null {
  if (!pop || prev.pathname !== next.pathname) return null;
  const was = new URLSearchParams(prev.search);
  const now = new URLSearchParams(next.search);
  if (!was.get('spot') || now.get('spot')) return null;
  let changed = false;
  for (const k of SPOT_KEPT) {
    const v = was.get(k);
    if (v === now.get(k)) continue;
    changed = true;
    if (v === null) now.delete(k);
    else now.set(k, v);
  }
  return changed ? now : null;
}

/** The spot's zoom never steps out further than this to fit its neighbours. */
export const SPOT_ZOOM_MIN = 14.8;
/** How far inside the free area's edge a neighbour has to sit. */
export const SPOT_MARGIN = 40;

const mercX = (lon: number) => (lon + 180) / 360;
const mercY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;

/**
 * The spot's zoom: `start`, stepped out until every `near` point, with `center` in the middle of a
 * `free` area w × h px, sits at least `margin` px inside it, but no further out than `floor`. Flat
 * and north-up Web Mercator with 512 px tiles, as the spot's camera is.
 */
export function spotFitZoom(
  center: [number, number],
  near: [number, number][],
  free: { w: number; h: number },
  start: number,
  floor = SPOT_ZOOM_MIN,
  margin = SPOT_MARGIN,
): number {
  const hw = free.w / 2 - margin;
  const hh = free.h / 2 - margin;
  let z = start;
  for (const p of near) {
    const dx = Math.abs(mercX(p[0]) - mercX(center[0])) * 512;
    const dy = Math.abs(mercY(p[1]) - mercY(center[1])) * 512;
    if ((dx && hw <= 0) || (dy && hh <= 0)) return floor;
    if (dx) z = Math.min(z, Math.log2(hw / dx));
    if (dy) z = Math.min(z, Math.log2(hh / dy));
  }
  // Rounded down, so the tightest neighbour is never a hair outside the margin.
  return Math.max(floor, Math.floor(z * 100) / 100);
}
