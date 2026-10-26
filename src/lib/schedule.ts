// A day's running order turned into clock times. Mock logistics: straight-line distance scaled up,
// not a routing service.
import type { Attraction } from '../data/types';
import { PACE_HOURS, type Pace } from './trips';

const EARTH_KM = 6371;
const DETOUR = 1.4; // streets are longer than the straight line
const KMH = 18; // door to door on trains and walking
const rad = (deg: number) => (deg * Math.PI) / 180;

function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

/** Minutes to get between two [lng, lat] points, rounded up to the next 5. */
export function travelMin(a: [number, number], b: [number, number]): number {
  const raw = ((haversineKm(a, b) * DETOUR) / KMH) * 60;
  return Math.ceil(raw / 5) * 5;
}

const mid = ([lo, hi]: [number, number]) => (lo + hi) / 2;

/** Time spent at a place: the middle of the visit range plus the middle of the queue range. */
export const visitMin = (a: Attraction): number => Math.round(mid(a.logistics.visitMin) + mid(a.logistics.queueMin));

export interface ScheduledStop {
  a: Attraction;
  /** Minutes from midnight. */
  start: number;
  end: number;
  /** Minutes spent getting here from the previous stop; 0 for the first. */
  travelBefore: number;
}

/** Lays stops end to end from `dayStart` ('HH:MM'), with travel between them. */
export function schedule(stops: Attraction[], dayStart: string): ScheduledStop[] {
  const [h, m] = dayStart.split(':').map(Number);
  let clock = (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0);
  return stops.map((a, i) => {
    const travelBefore = i === 0 ? 0 : travelMin(stops[i - 1].lonlat, a.lonlat);
    const start = clock + travelBefore;
    const end = start + visitMin(a);
    clock = end;
    return { a, start, end, travelBefore };
  });
}

/** How many minutes a day can hold at this pace. */
export const dayLengthMin = (pace: Pace): number => PACE_HOURS[pace] * 60;
