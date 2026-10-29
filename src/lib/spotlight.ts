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
