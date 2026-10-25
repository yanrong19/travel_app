import type { Feature, FeatureCollection, Geometry } from 'geojson';
import worldRaw from './geo/world.json';
import prefsRaw from './geo/japan-prefectures.json';
import tokyoRaw from './geo/tokyo.json';
import { ATTRACTIONS } from './attractions';

type Props = { name: string; ja?: string; kind?: string };
export type Place = Feature<Geometry, Props> & { id: string };

export const WORLD = (worldRaw as unknown as FeatureCollection<Geometry, Props>).features as Place[];
export const PREFECTURES = (prefsRaw as unknown as FeatureCollection<Geometry, Props>).features as Place[];
export const TOKYO_AREAS = (tokyoRaw as unknown as FeatureCollection<Geometry, Props>).features as Place[];

export const JAPAN_ID = '392';
export const TOKYO_PREF_ID = '13';

/** "Taitō" → "taito", "Côte d'Ivoire" → "cote-divoire". */
export const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const countryBySlug = (s: string) => WORLD.find((f) => slug(f.properties.name) === s);
export const areaBySlug = (s: string) => TOKYO_AREAS.find((f) => slug(f.properties.name) === s);
export const areaById = (id: string) => TOKYO_AREAS.find((f) => f.id === id);

/** Areas of Tokyo that have at least one attraction, with their counts. */
export const AREA_COUNTS = ATTRACTIONS.reduce<Record<string, number>>((acc, a) => {
  acc[a.area] = (acc[a.area] ?? 0) + 1;
  return acc;
}, {});

export type Level = 'world' | 'country' | 'region' | 'area';

export interface MapTarget {
  level: Level;
  country?: Place;
  region?: Place;
  area?: Place;
  /** True when the URL named a place that does not exist. */
  missing?: boolean;
}

/** URL shape under /map:  /map  /map/japan  /map/japan/tokyo  /map/japan/tokyo/taito */
export function targetFromParams(country?: string, region?: string, area?: string): MapTarget {
  if (!country) return { level: 'world' };
  const c = countryBySlug(country);
  if (!c) return { level: 'world', missing: true };
  if (!region) return { level: 'country', country: c };
  const r = c.id === JAPAN_ID && region === 'tokyo' ? PREFECTURES.find((p) => p.id === TOKYO_PREF_ID) : undefined;
  if (!r) return { level: 'country', country: c, missing: true };
  if (!area) return { level: 'region', country: c, region: r };
  const a = areaBySlug(area);
  if (!a) return { level: 'region', country: c, region: r, missing: true };
  return { level: 'area', country: c, region: r, area: a };
}

/** The globe is the home page; deeper map levels live under /map. */
export const WORLD_PATH = '/';
export const MAP_ROOT = '/map';
export const TOKYO_PATH = '/map/japan/tokyo';
export const countryPath = (name: string) => `${MAP_ROOT}/${slug(name)}`;
export const areaPath = (areaId: string) => `${TOKYO_PATH}/${slug(areaById(areaId)!.properties.name)}`;

/** Place pages use the same shape without /map: /japan, /japan/tokyo, /japan/tokyo/taito */
export const TOKYO_PAGE = '/japan/tokyo';
export const areaPagePath = (areaId: string) => `${TOKYO_PAGE}/${slug(areaById(areaId)!.properties.name)}`;
