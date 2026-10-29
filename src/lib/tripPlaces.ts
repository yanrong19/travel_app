// Helpers for the places a trip is built from. Stops are not owned by places: a place only says
// which attractions it covers, and Japan, Kantō and Tokyo all cover every Tokyo attraction.
import { ATTRACTIONS } from '../data/attractions';
import { DESTINATIONS, destinationByWorldId } from '../data/destinations';
import { neighbourhoodById } from '../data/neighbourhoods';
import { REGIONS, prefName } from '../data/regions';
import {
  AREA_COUNTS,
  JAPAN_ID,
  PREFECTURES,
  TOKYO_AREAS,
  TOKYO_PREF_ID,
  WORLD,
  areaById,
  slug,
  targetFromParams,
  type MapTarget,
} from '../data/places';
import type { Attraction } from '../data/types';
import type { Bounds } from '../map/camera';
import type { Trip, PlaceRef } from './trips';

const KANTO_ID = 'kanto';
const isTokyoWide = (ref: PlaceRef) =>
  (ref.level === 'country' && ref.id === JAPAN_ID) ||
  (ref.level === 'region' && ref.id === KANTO_ID) ||
  (ref.level === 'prefecture' && Number(ref.id) === Number(TOKYO_PREF_ID));

const regionById = (id: string) => REGIONS.find((r) => r.id === id);
const prefFeature = (id: string) => PREFECTURES.find((p) => Number(p.id) === Number(id));

export const sameRef = (a: PlaceRef, b: PlaceRef) => a.level === b.level && a.id === b.id;

export function placeLabel(ref: PlaceRef): { name: string; local?: string; kind: string } {
  switch (ref.level) {
    case 'country': {
      const d = destinationByWorldId(ref.id);
      if (d) return { name: d.name, local: d.local, kind: 'Country' };
      return { name: WORLD.find((f) => f.id === ref.id)?.properties.name ?? ref.id, kind: 'Country' };
    }
    case 'region': {
      const r = regionById(ref.id);
      return { name: r?.name ?? ref.id, local: r?.ja, kind: 'Region of Japan' };
    }
    case 'prefecture':
      return { name: prefName(Number(ref.id)) || ref.id, local: prefFeature(ref.id)?.properties.ja, kind: 'Prefecture' };
    case 'area': {
      const a = areaById(ref.id);
      return { name: a?.properties.name ?? ref.id, local: a?.properties.ja, kind: 'Tokyo ward' };
    }
    case 'neighbourhood': {
      const n = neighbourhoodById(ref.id);
      return { name: n?.name ?? ref.id, local: n?.ja, kind: 'Tokyo neighbourhood' };
    }
  }
}

/** The attractions a place covers. Only Tokyo has data so far. */
export function attractionsIn(ref: PlaceRef): Attraction[] {
  if (isTokyoWide(ref)) return ATTRACTIONS;
  if (ref.level === 'area') return ATTRACTIONS.filter((a) => a.area === ref.id);
  if (ref.level === 'neighbourhood') return ATTRACTIONS.filter((a) => a.neighbourhood === ref.id);
  return [];
}

/** Photo id for a place's card, or null when there is nothing to show. */
export function placeCover(ref: PlaceRef): string | null {
  switch (ref.level) {
    case 'country':
      return destinationByWorldId(ref.id)?.landmarks[0]?.photo ?? null;
    case 'region':
      return regionById(ref.id)?.photo ?? null;
    case 'prefecture':
      return Number(ref.id) === Number(TOKYO_PREF_ID) ? 'shibuya-sky' : null;
    case 'area':
    case 'neighbourhood':
      return attractionsIn(ref)[0]?.id ?? null;
  }
}

const M_PER_DEG = 111320;
const FRAME_PAD_M = 150;
const FRAME_MIN_REACH_M = 600;

/**
 * The map frame for a neighbourhood: its attractions' bounding box plus 150 m each side, grown to
 * reach at least 600 m from the neighbourhood's centre every way. Not `radiusM`: the radii are loose
 * membership bounds (up to 3 km), far wider than the walkable patch a person wants to see.
 */
function neighbourhoodFrame(id: string): Bounds | undefined {
  const n = neighbourhoodById(id);
  if (!n) return undefined;
  const [cx, cy] = n.center;
  const mLon = M_PER_DEG * Math.cos((cy * Math.PI) / 180);
  let w = cx - FRAME_MIN_REACH_M / mLon;
  let e = cx + FRAME_MIN_REACH_M / mLon;
  let s = cy - FRAME_MIN_REACH_M / M_PER_DEG;
  let nn = cy + FRAME_MIN_REACH_M / M_PER_DEG;
  for (const a of ATTRACTIONS) {
    if (a.neighbourhood !== id) continue;
    const [x, y] = a.lonlat;
    w = Math.min(w, x - FRAME_PAD_M / mLon);
    e = Math.max(e, x + FRAME_PAD_M / mLon);
    s = Math.min(s, y - FRAME_PAD_M / M_PER_DEG);
    nn = Math.max(nn, y + FRAME_PAD_M / M_PER_DEG);
  }
  return [[w, s], [e, nn]];
}

/**
 * Where the map should look for a place: a target, plus prefectures to highlight on the country map.
 * A neighbourhood also carries the `frame` to fit inside the Tokyo target.
 */
export function placeView(ref: PlaceRef): { target: MapTarget; focusPrefs: number[] | null; frame?: Bounds } {
  const japan = slug(WORLD.find((f) => f.id === JAPAN_ID)?.properties.name ?? 'Japan');
  switch (ref.level) {
    case 'country': {
      const name = WORLD.find((f) => f.id === ref.id)?.properties.name;
      return { target: targetFromParams(name ? slug(name) : undefined), focusPrefs: null };
    }
    case 'region':
      return { target: targetFromParams(japan), focusPrefs: regionById(ref.id)?.prefectures ?? null };
    case 'prefecture':
      if (Number(ref.id) === Number(TOKYO_PREF_ID)) return { target: targetFromParams(japan, 'tokyo'), focusPrefs: null };
      return { target: targetFromParams(japan), focusPrefs: [Number(ref.id)] };
    case 'area': {
      const a = areaById(ref.id);
      return { target: targetFromParams(japan, 'tokyo', a ? slug(a.properties.name) : undefined), focusPrefs: null };
    }
    case 'neighbourhood':
      return { target: targetFromParams(japan, 'tokyo'), focusPrefs: null, frame: neighbourhoodFrame(ref.id) };
  }
}

/** Every place a person can pick, for search. */
export const ALL_PLACES: (PlaceRef & { label: string; sub: string })[] = [
  ...DESTINATIONS.map((d) => ({ level: 'country' as const, id: d.worldId, label: d.name, sub: 'Country' })),
  ...REGIONS.map((r) => ({ level: 'region' as const, id: r.id, label: r.name, sub: 'Region of Japan' })),
  ...PREFECTURES.map((p) => ({ level: 'prefecture' as const, id: p.id, label: p.properties.name, sub: 'Prefecture' })),
  ...TOKYO_AREAS.filter((a) => AREA_COUNTS[a.id]).map((a) => ({
    level: 'area' as const,
    id: a.id,
    label: a.properties.name,
    sub: 'Tokyo ward',
  })),
];

export const covers = (ref: PlaceRef, attractionId: string) => attractionsIn(ref).some((a) => a.id === attractionId);

/** The first place in the list that covers the attraction. */
export const coveringPlace = (places: PlaceRef[], attractionId: string): PlaceRef | null =>
  places.find((p) => covers(p, attractionId)) ?? null;

/** The place that gives a day its rain forecast: whatever covers its first stop, else the trip's first place. */
export function dayPlace(trip: Trip, day: number): PlaceRef | null {
  const first = trip.days[day]?.stops[0];
  const fallback = trip.places[0] ?? null;
  return first ? (coveringPlace(trip.places, first) ?? fallback) : fallback;
}
