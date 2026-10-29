// The level tree behind the planner map: each place has children, and one level on each branch is
// the "attraction level", where the map shows pins. Above it the map shows a count bubble per child.
//
// Japan → its 8 regions → their prefectures. Every other prefecture is the attraction level; Tokyo
// is not: its children are its neighbourhoods, and each of those is the attraction level (its map
// pins all of Tokyo and spotlights the neighbourhood). Neighbourhoods are map-only: they are never
// trip places. Tokyo's wards (TOKYO_AREAS) stay trip places, outside Tokyo's children: each is an
// attraction level of its own with Tokyo as its parent. Any other country is the attraction level
// itself. This is hard-coded from our data for now: later the
// knowledge base supplies the tree per country (Singapore at country level, Japan at prefecture or
// city level). Swap `TREE` for a source that implements `PlaceTree`; nothing outside this file reads
// the hard-coded shape.
//
// The tree is more than `PlaceTree`'s three answers. A knowledge-base tree must also supply, for
// every place it names: whether it exists (`isKnownPlace`, which validates `&view=` in the URL),
// where its bubble sits (`placeAnchor`), its label (`nodeOf` reads `placeLabel`), and one canonical
// id per place (the `prefecture` normaliser here, as zero-padded map ids like '08'). Today those
// read our geo data in `src/data`.
import { geoCentroid } from 'd3-geo';
import { NEIGHBOURHOODS, neighbourhoodById } from '../data/neighbourhoods';
import { REGIONS, mainLand, regionOfPref } from '../data/regions';
import { JAPAN_ID, PREFECTURES, TOKYO_AREAS, TOKYO_PREF_ID, WORLD, areaById } from '../data/places';
import type { Attraction } from '../data/types';
import { attractionsIn, covers, placeLabel, sameRef } from './tripPlaces';
import type { PlaceRef } from './trips';

export interface PlaceNode {
  ref: PlaceRef;
  label: string;
  /** The places one level down, in display order. Empty at the attraction level. */
  children: PlaceRef[];
  /** True where the map shows attractions as pins instead of count bubbles. */
  attractionLevel: boolean;
}

/** What a data source for the level tree provides. */
export interface PlaceTree {
  children(ref: PlaceRef): PlaceRef[];
  parent(ref: PlaceRef): PlaceRef | null;
  attractionLevel(ref: PlaceRef): boolean;
}

const JAPAN: PlaceRef = { level: 'country', id: JAPAN_ID };
const region = (id: string): PlaceRef => ({ level: 'region', id });
/** Prefecture refs carry the map feature's id, zero-padded as in the data ('08'), as ALL_PLACES does. */
const prefecture = (code: number | string): PlaceRef => ({
  level: 'prefecture',
  id: PREFECTURES.find((p) => Number(p.id) === Number(code))?.id ?? String(code),
});
const neighbourhood = (id: string): PlaceRef => ({ level: 'neighbourhood', id });

const isTokyo = (ref: PlaceRef) => ref.level === 'prefecture' && Number(ref.id) === Number(TOKYO_PREF_ID);

/** The hard-coded tree: Japan by region and prefecture; every other country flat. */
const HARD_CODED: PlaceTree = {
  children(ref) {
    if (ref.level === 'country' && ref.id === JAPAN_ID) return REGIONS.map((r) => region(r.id));
    if (ref.level === 'region') return (REGIONS.find((r) => r.id === ref.id)?.prefectures ?? []).map(prefecture);
    if (isTokyo(ref)) return NEIGHBOURHOODS.map((n) => neighbourhood(n.id)).filter((r) => attractionsIn(r).length > 0);
    return [];
  },
  parent(ref) {
    switch (ref.level) {
      case 'country':
        return null;
      case 'region':
        return JAPAN;
      case 'prefecture': {
        const r = regionOfPref(Number(ref.id));
        return r ? region(r.id) : JAPAN;
      }
      case 'area':
      case 'neighbourhood':
        return prefecture(TOKYO_PREF_ID);
    }
  },
  attractionLevel(ref) {
    return !(ref.level === 'country' && ref.id === JAPAN_ID) && ref.level !== 'region' && !isTokyo(ref);
  },
};

const TREE: PlaceTree = HARD_CODED;

export function nodeOf(ref: PlaceRef): PlaceNode {
  return { ref, label: placeLabel(ref).name, children: TREE.children(ref), attractionLevel: TREE.attractionLevel(ref) };
}

export const parentOf = (ref: PlaceRef): PlaceRef | null => TREE.parent(ref);

/** The places from the root down to this one, root first: the breadcrumb. */
export function pathTo(ref: PlaceRef): PlaceRef[] {
  const path = [ref];
  for (let p = parentOf(ref); p && path.length < 10; p = parentOf(p)) path.unshift(p);
  return path;
}

/** How many checked attractions a place holds. */
export const countFor = (ref: PlaceRef): number => attractionsIn(ref).length;

/**
 * The attractions the map pins at an attraction level: a neighbourhood pins every attraction of its
 * parent (all of Tokyo, with its own highlighted); another attraction level its own; above it, none.
 */
export function pinsFor(ref: PlaceRef): Attraction[] {
  if (ref.level === 'neighbourhood') {
    const parent = parentOf(ref);
    return parent ? attractionsIn(parent) : attractionsIn(ref);
  }
  return TREE.attractionLevel(ref) ? attractionsIn(ref) : [];
}

/** The attraction-level place under `root` that holds the attraction, or null when none does. */
export function attractionLevelFor(root: PlaceRef, attractionId: string): PlaceRef | null {
  const node = nodeOf(root);
  if (node.attractionLevel) return attractionsIn(root).some((a) => a.id === attractionId) ? root : null;
  for (const c of node.children) {
    const hit = attractionLevelFor(c, attractionId);
    if (hit) return hit;
  }
  return null;
}

/**
 * The attraction-level place that shows an attraction's pin, for opening its card from anywhere:
 * the viewed place when it already does; else the most specific of the trip places that cover it
 * (Taitō before Japan's Tokyo), the current trip place first on a tie; else the attraction-level
 * place in any trip place's tree that holds it. Null when none does.
 */
export function attractionHome(attractionId: string, places: PlaceRef[], current: PlaceRef | null, viewed: PlaceRef | null): PlaceRef | null {
  if (viewed && TREE.attractionLevel(viewed) && covers(viewed, attractionId)) return viewed;
  const order = current ? [current, ...places.filter((p) => !sameRef(p, current))] : places;
  // The most specific covering trip place wins (a ward over Japan), the first in order on a tie.
  const covering = order.filter((p) => covers(p, attractionId));
  if (covering.length) {
    const best = covering.reduce((b, p) => (pathTo(p).length > pathTo(b).length ? p : b));
    const home = attractionLevelFor(best, attractionId);
    if (home) return home;
  }
  for (const p of order) {
    const hit = attractionLevelFor(pathTo(p)[0], attractionId);
    if (hit) return hit;
  }
  return null;
}

/** True when both places sit in the same tree (under the same country). */
export const sameTree = (a: PlaceRef, b: PlaceRef) => sameRef(pathTo(a)[0], pathTo(b)[0]);

/** True for a place our data knows. */
export function isKnownPlace(ref: PlaceRef): boolean {
  switch (ref.level) {
    case 'country':
      return WORLD.some((f) => f.id === ref.id);
    case 'region':
      return REGIONS.some((r) => r.id === ref.id);
    case 'prefecture':
      return PREFECTURES.some((p) => Number(p.id) === Number(ref.id));
    case 'area':
      return TOKYO_AREAS.some((a) => a.id === ref.id);
    case 'neighbourhood':
      return neighbourhoodById(ref.id) !== undefined;
  }
}

/** A place as one URL value: `region:kanto`. */
export const refKey = (ref: PlaceRef) => `${ref.level}:${ref.id}`;

const LEVELS = ['country', 'region', 'prefecture', 'area', 'neighbourhood'] as const;
export function parseRefKey(v: string | null): PlaceRef | null {
  if (!v) return null;
  const at = v.indexOf(':');
  const level = v.slice(0, at) as PlaceRef['level'];
  const ref = { level, id: v.slice(at + 1) };
  if (!(at > 0 && LEVELS.includes(level) && isKnownPlace(ref))) return null;
  return level === 'prefecture' ? prefecture(ref.id) : ref;
}

/** Where a place's count bubble sits: a region's frame middle, or the centroid of the place's main land. */
export function placeAnchor(ref: PlaceRef): [number, number] {
  const fallback: [number, number] = [138.5, 36.5];
  switch (ref.level) {
    case 'region': {
      // The centroid of its prefectures' main land, not regionAnchor's box middle: Kyūshū &
      // Okinawa's box puts that in the sea between the two.
      const r = REGIONS.find((x) => x.id === ref.id);
      const land = PREFECTURES.filter((p) => r?.prefectures.includes(Number(p.id))).map(mainLand);
      return land.length ? (geoCentroid({ type: 'FeatureCollection', features: land }) as [number, number]) : fallback;
    }
    case 'prefecture': {
      const p = PREFECTURES.find((x) => Number(x.id) === Number(ref.id));
      return p ? (geoCentroid(mainLand(p)) as [number, number]) : fallback;
    }
    case 'area': {
      const a = areaById(ref.id);
      return a ? (geoCentroid(a) as [number, number]) : fallback;
    }
    case 'country': {
      const c = WORLD.find((f) => f.id === ref.id);
      return c ? (geoCentroid(mainLand(c)) as [number, number]) : fallback;
    }
    case 'neighbourhood':
      return neighbourhoodById(ref.id)?.center ?? fallback;
  }
}
