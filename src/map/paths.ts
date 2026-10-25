import { PREFECTURES, TOKYO_AREAS, WORLD } from '../data/places';
import { geoToPath, unionBounds } from './camera';

// Paths are built once; cameras only change the SVG viewBox.
export const WORLD_PATHS = WORLD.map((f) => ({ id: f.id, name: f.properties.name, d: geoToPath(f) ?? '' }));
export const PREF_PATHS = PREFECTURES.map((f) => ({ id: f.id, name: f.properties.name, d: geoToPath(f) ?? '' }));
export const AREA_PATHS = TOKYO_AREAS.map((f) => ({
  id: f.id,
  name: f.properties.name,
  ja: f.properties.ja ?? '',
  d: geoToPath(f) ?? '',
  centroid: geoToPath.centroid(f) as [number, number],
}));
export const WORLD_BOUNDS = unionBounds(WORLD.map((f) => geoToPath.bounds(f)));
export const TOKYO_BOUNDS = unionBounds(TOKYO_AREAS.map((f) => geoToPath.bounds(f)));
/** The 23 wards only, for the detail page's small map. */
export const WARDS_BOUNDS = unionBounds(TOKYO_AREAS.filter((f) => Number(f.id) < 13200).map((f) => geoToPath.bounds(f)));
