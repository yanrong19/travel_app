import { setWorkerUrl, type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';

// Open map data from OpenStreetMap, served free by OpenFreeMap. The style is
// restyled on load into the app's palette (see restyle()).
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

/** Recolour the downloaded base style into the app's palette, show English names, and add relief and 3D buildings. */
export function restyle(map: MapLibreMap, sky: { sky: string; horizon: string } = { sky: '#a9cde0', horizon: '#eef2f4' }) {
  const style = map.getStyle() as StyleSpecification;
  const vector = Object.entries(style.sources).find(([, s]) => s.type === 'vector')?.[0];
  let firstSymbol: string | undefined;
  for (const l of style.layers) {
    if (l.type === 'symbol' && !firstSymbol) firstSymbol = l.id;
    if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', C.ground);
    if (l.type === 'fill' && l.id === 'water') map.setPaintProperty(l.id, 'fill-color', C.water);
    if (l.type === 'line' && l.id === 'waterway') map.setPaintProperty(l.id, 'line-color', C.water);
    if (l.type === 'fill' && /park|wood|grass/.test(l.id)) {
      map.setPaintProperty(l.id, 'fill-color', C.park);
      map.setPaintProperty(l.id, 'fill-opacity', 0.9);
    }
    if (l.type === 'fill' && l.id === 'landuse_residential') map.setPaintProperty(l.id, 'fill-color', '#e7ecef');
    // Road names, shields and minor place labels crowd the tickers; the map keeps districts, water and stations.
    if (l.id === 'building' || /^highway-(name|shield)|^road_shield|^label_other$|^airport$/.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');
    if (l.type === 'line' && /^railway(_transit)?$/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#9fb3bd');
    if (l.type === 'line' && l.id === 'boundary_2') map.setPaintProperty(l.id, 'line-color', '#9fb0b8');
    if (l.type === 'symbol' && l.layout && 'text-field' in l.layout) {
      map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]);
      map.setPaintProperty(l.id, 'text-color', l.id.startsWith('label_country') ? '#56636a' : '#3d4a50');
      map.setPaintProperty(l.id, 'text-halo-color', 'rgba(255,255,255,0.9)');
    }
  }

  // Shaded relief from Natural Earth gives the globe and Japan's mountains some depth.
  if (style.sources.ne2_shaded && map.getLayer('park')) {
    map.addLayer(
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

  if (vector) {
    map.addLayer(
      {
        id: 'fl-buildings',
        type: 'fill-extrusion',
        source: vector,
        'source-layer': 'building',
        minzoom: 12.5,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#f6f8f9', 40, '#e4ebef', 150, '#cfdbe1'],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14, ['coalesce', ['get', 'render_height'], 8]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
        },
      },
      firstSymbol,
    );
  }

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
}

