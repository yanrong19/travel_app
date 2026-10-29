import { setWorkerUrl, type ExpressionSpecification, type LayerSpecification, type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapMode } from '../lib/mapMode';

// Open map data from OpenStreetMap, served free by OpenFreeMap. The style is
// restyled on load, then switched between the flat `map` look and the `3d` look (see restyle(), applyMode()).
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

// Point MapLibre at its worker explicitly so it loads under Vite in dev and in builds.
setWorkerUrl(workerUrl);

export const C = {
  ground: '#eef2f4',
  water: '#b9d5e3',
  park: '#d3e8dc',
  cedar: '#0e4f47',
  ink: '#10191b',
};

/** The flat, Google-Maps-like palette of map mode. */
const G = {
  land: '#f5f5f3',
  urban: '#f1f1ef',
  park: '#c6e9c0',
  wood: '#b9e0b0',
  water: '#9fd3ef',
  road: '#ffffff',
  roadCase: '#dadce0',
  major: '#ffffff',
  majorCase: '#c9ccd1',
  motorway: '#fde59a',
  motorwayCase: '#f0c25e',
  rail: '#b8bcc2',
  label: '#5f6368',
  labelStrong: '#3c4043',
  station: '#2f6fd6',
  hospital: '#fbe3e3',
  school: '#ecebf6',
  shop: '#fcefe1',
};

const NAME_EN: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];

/** One property to set on a layer. */
type Assign = { kind: 'paint' | 'layout'; prop: string; value: unknown };

/** What each mode sets on one downloaded layer. Both lists cover the same properties. */
interface Row {
  id: string;
  map: Assign[];
  three: Assign[];
}

interface Plan {
  vector?: string;
  firstSymbol?: string;
  relief: boolean;
  rows: Row[];
}

const plans = new WeakMap<MapLibreMap, Plan>();

type Raw = { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };

/** Today's 3D look of one layer: the app's palette, quiet road names and shields, no minor labels. */
function threeLook(l: Raw): Map<string, Assign> {
  const out = new Map<string, Assign>();
  const put = (kind: Assign['kind'], prop: string, value: unknown) => out.set(`${kind}:${prop}`, { kind, prop, value });
  const id = l.id;
  if (l.type === 'background') put('paint', 'background-color', C.ground);
  if (l.type === 'fill' && id === 'water') put('paint', 'fill-color', C.water);
  if (l.type === 'line' && id === 'waterway') put('paint', 'line-color', C.water);
  if (l.type === 'fill' && /park|wood|grass/.test(id)) {
    put('paint', 'fill-color', C.park);
    put('paint', 'fill-opacity', 0.9);
  }
  if (l.type === 'fill' && id === 'landuse_residential') put('paint', 'fill-color', '#e7ecef');
  // Road names, shields and minor place labels crowd the tickers; the map keeps districts, water and stations.
  if (id === 'building' || /^highway-(name|shield)|^road_shield|^label_other$|^airport$/.test(id)) put('layout', 'visibility', 'none');
  if (l.type === 'line' && /^railway(_transit)?$/.test(id)) put('paint', 'line-color', '#9fb3bd');
  if (l.type === 'line' && id === 'boundary_2') put('paint', 'line-color', '#9fb0b8');
  if (l.type === 'symbol' && l.layout && 'text-field' in l.layout) {
    put('layout', 'text-field', NAME_EN);
    put('paint', 'text-color', id.startsWith('label_country') ? '#56636a' : '#3d4a50');
    put('paint', 'text-halo-color', 'rgba(255,255,255,0.9)');
  }
  return out;
}

/** The flat look of one layer: soft land, white roads with a grey edge, yellow motorways, readable street names. */
function mapLook(l: Raw): Map<string, Assign> {
  const out = new Map<string, Assign>();
  const put = (kind: Assign['kind'], prop: string, value: unknown) => out.set(`${kind}:${prop}`, { kind, prop, value });
  const id = l.id;
  if (l.type === 'background') put('paint', 'background-color', G.land);
  if (id === 'water') put('paint', 'fill-color', G.water);
  if (id === 'waterway') put('paint', 'line-color', G.water);
  if (id === 'park') {
    put('paint', 'fill-color', G.park);
    put('paint', 'fill-opacity', 1);
  }
  if (id === 'landcover_wood') {
    put('paint', 'fill-color', G.wood);
    put('paint', 'fill-opacity', 1);
  }
  if (id === 'landuse_residential') put('paint', 'fill-color', G.urban);
  if (id === 'building') put('layout', 'visibility', 'none');
  if (l.type === 'line') {
    if (/highway_(minor|path)/.test(id)) put('paint', 'line-color', G.road);
    if (/major_casing/.test(id)) put('paint', 'line-color', G.majorCase);
    if (/major_(inner|subtle)/.test(id)) put('paint', 'line-color', G.major);
    if (/motorway.*casing/.test(id)) put('paint', 'line-color', G.motorwayCase);
    if (/motorway.*(inner|subtle)/.test(id)) put('paint', 'line-color', G.motorway);
    if (/^railway/.test(id)) put('paint', 'line-color', G.rail);
  }
  if (id === 'highway_minor') put('paint', 'line-width', ['interpolate', ['exponential', 1.5], ['zoom'], 13, 0.8, 16, 4.5, 18, 13]);
  if (/^highway-shield|^road_shield|^airport$/.test(id)) put('layout', 'visibility', 'none');
  if (/^highway-name/.test(id)) put('layout', 'visibility', 'visible');
  if (l.type === 'symbol' && l.layout && 'text-field' in l.layout) {
    put('layout', 'text-field', NAME_EN);
    put('paint', 'text-color', /^label_(city|town|state)/.test(id) ? G.labelStrong : G.label);
    put('paint', 'text-halo-color', '#ffffff');
    put('paint', 'text-halo-width', 1.4);
  }
  return out;
}

// The flat palette fades in between these zooms, so the globe and the whole-country view look as they always have
// and the flat colours show from regional zoom in.
const BLEND_FROM = 5;
const BLEND_TO = 6;

// What a paint property is when a style leaves it out.
const PAINT_DEFAULT: Record<string, number> = { 'fill-opacity': 1, 'text-halo-width': 0, 'line-opacity': 1, 'text-opacity': 1 };

/** The flat value, eased in from `fromValue` over BLEND_FROM..BLEND_TO when both are plain colours or plain numbers. */
function blend(a: Assign, fromValue: unknown): unknown {
  if (a.kind !== 'paint') return a.value;
  const from = fromValue === undefined ? PAINT_DEFAULT[a.prop] : fromValue;
  const plainColour = a.prop.endsWith('-color') && typeof from === 'string' && typeof a.value === 'string';
  const plainNumber = typeof from === 'number' && typeof a.value === 'number';
  if (!plainColour && !plainNumber) return a.value;
  return ['interpolate', ['linear'], ['zoom'], BLEND_FROM, from, BLEND_TO, a.value];
}

/** Reads the downloaded style once, before anything is changed, and works out what each mode sets on each layer. */
function plan(map: MapLibreMap): Plan {
  const style = map.getStyle() as StyleSpecification;
  const vector = Object.entries(style.sources).find(([, s]) => s.type === 'vector')?.[0];
  let firstSymbol: string | undefined;
  const rows: Row[] = [];
  for (const spec of style.layers) {
    const l = spec as unknown as Raw;
    if (l.type === 'symbol' && !firstSymbol) firstSymbol = l.id;
    const m = mapLook(l);
    const t = threeLook(l);
    if (!m.size && !t.size) continue;
    // A property only one mode sets goes back to the style's own value in the other, so switching is lossless.
    const original = (a: Assign) => (a.kind === 'paint' ? l.paint?.[a.prop] : l.layout?.[a.prop]);
    const keys = new Set([...m.keys(), ...t.keys()]);
    const side = (own: Map<string, Assign>, other: Map<string, Assign>): Assign[] =>
      [...keys].map((k) => {
        const a = own.get(k);
        if (a) return a;
        const o = other.get(k)!;
        return { kind: o.kind, prop: o.prop, value: original(o) };
      });
    const three = side(t, m);
    // Only the flat look is blended: 3D keeps its plain values, so it stays exactly as it was.
    const map = side(m, t).map((a, i) => ({ ...a, value: blend(a, three[i].value) }));
    rows.push({ id: l.id, map, three });
  }
  return { vector, firstSymbol, relief: !!style.sources.ne2_shaded, rows };
}

/** Adds the layers a mode needs beyond the downloaded style, once, and gives them the right visibility. */
function ensureLayers(map: MapLibreMap, p: Plan) {
  const add = (layer: LayerSpecification, before?: string) => {
    if (map.getLayer(layer.id)) return;
    map.addLayer(layer, before && map.getLayer(before) ? before : undefined);
  };

  // Shaded relief from Natural Earth gives the globe and Japan's mountains some depth.
  if (p.relief && map.getLayer('park')) {
    add(
      {
        id: 'fl-relief',
        type: 'raster',
        source: 'ne2_shaded',
        maxzoom: 9,
        paint: {
          'raster-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.55, 6, 0.4, 9, 0],
          'raster-saturation': -0.6,
          'raster-contrast': 0.05,
        },
      },
      'park',
    );
  }

  if (p.vector) {
    const source = p.vector;
    add(
      {
        id: 'fl-buildings',
        type: 'fill-extrusion',
        source,
        'source-layer': 'building',
        minzoom: 12.5,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#f6f8f9', 40, '#e4ebef', 150, '#cfdbe1'],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14, ['coalesce', ['get', 'render_height'], 8]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
        },
      },
      p.firstSymbol,
    );

    // Minor roads get a faint grey edge, like Google's.
    add(
      {
        id: 'g-minor-case',
        type: 'line',
        source,
        'source-layer': 'transportation',
        minzoom: 13,
        filter: ['match', ['get', 'class'], ['minor', 'service', 'street'], true, false],
        paint: { 'line-color': G.roadCase, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 13, 1.5, 16, 6, 18, 16] },
      },
      'highway_minor',
    );

    // Soft colour for hospitals, schools and shopping areas.
    add(
      {
        id: 'g-landuse',
        type: 'fill',
        source,
        'source-layer': 'landuse',
        minzoom: 12,
        filter: ['match', ['get', 'class'], ['hospital', 'school', 'university', 'college', 'commercial', 'retail'], true, false],
        paint: {
          'fill-color': ['match', ['get', 'class'], 'hospital', G.hospital, ['school', 'university', 'college'], G.school, G.shop],
        },
      },
      'waterway',
    );

    // Station names, Google-blue.
    add(
      {
        id: 'g-stations',
        type: 'symbol',
        source,
        'source-layer': 'poi',
        minzoom: 13,
        filter: ['all', ['==', ['get', 'class'], 'railway'], ['match', ['get', 'subclass'], ['station', 'halt'], true, false]],
        layout: {
          'text-field': NAME_EN,
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-anchor': 'top',
          'text-offset': [0, 0.5],
          'icon-allow-overlap': false,
        },
        paint: { 'text-color': G.station, 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      },
      p.firstSymbol,
    );
  }
}

/**
 * Puts the map into `map` (flat palette) or `3d` (today's look with buildings). Safe to call any number
 * of times and in either order: every property either mode touches is set, the extra layers are added
 * once and shown or hidden, and nothing reloads.
 */
export function applyMode(map: MapLibreMap, mode: MapMode) {
  let p = plans.get(map);
  if (!p) {
    p = plan(map);
    plans.set(map, p);
  }
  ensureLayers(map, p);
  const flat = mode === 'map';
  for (const row of p.rows) {
    for (const a of flat ? row.map : row.three) {
      // undefined is how a style says "not set": null puts the property back to its default.
      const v = a.value === undefined ? null : a.value;
      // The property names come from the style itself, so the typed overloads can't check them.
      if (a.kind === 'paint') map.setPaintProperty(row.id, a.prop as never, v as never);
      else map.setLayoutProperty(row.id, a.prop as never, v as never);
    }
  }
  const show = (id: string, on: boolean) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  };
  show('fl-buildings', !flat);
  show('g-minor-case', flat);
  show('g-landuse', flat);
  show('g-stations', flat);
}

/** One-time setup when the style loads: light and sky for the tilted view, then the chosen look. */
export function restyle(
  map: MapLibreMap,
  sky: { sky: string; horizon: string } = { sky: '#a9cde0', horizon: '#eef2f4' },
  mode: MapMode = '3d',
) {
  plans.delete(map);
  map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.35, position: [1.3, 200, 35] });
  map.setSky({
    'sky-color': sky.sky,
    'horizon-color': sky.horizon,
    'fog-color': '#eef2f4',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.7,
    'fog-ground-blend': 0.75,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0],
  });
  applyMode(map, mode);
}
