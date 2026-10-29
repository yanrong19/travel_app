import { expect, test } from 'vitest';
import { applyMode, restyle } from './style';

type Rec = Record<string, Record<string, unknown>>;

// A stand-in for the MapLibre map that records what restyle and applyMode write to it.
function fakeMap() {
  const layers = [
    { id: 'background', type: 'background' },
    { id: 'water', type: 'fill' },
    { id: 'park', type: 'fill', paint: { 'fill-color': '#d8e8c8', 'fill-opacity': 0.7 } },
    { id: 'landcover_wood', type: 'fill' },
    { id: 'landuse_residential', type: 'fill' },
    { id: 'building', type: 'fill' },
    { id: 'highway_minor', type: 'line', paint: { 'line-color': '#fafafa', 'line-width': 2 } },
    { id: 'highway_major_inner', type: 'line' },
    { id: 'highway_motorway_inner', type: 'line' },
    { id: 'highway-name-minor', type: 'symbol', layout: { 'text-field': ['get', 'name'] } },
    { id: 'label_city', type: 'symbol', layout: { 'text-field': ['get', 'name'] } },
  ];
  const paint: Rec = {};
  const layout: Rec = {};
  const present = new Set(layers.map((l) => l.id));
  const added: string[] = [];
  const m = {
    paint,
    layout,
    added,
    light: undefined as unknown,
    sky: undefined as unknown,
    getStyle: () => ({ sources: { openmaptiles: { type: 'vector' }, ne2_shaded: { type: 'raster' } }, layers }),
    getLayer: (id: string) => (present.has(id) ? { id } : undefined),
    addLayer: (l: { id: string; layout?: Record<string, unknown> }) => {
      added.push(l.id);
      present.add(l.id);
      layout[l.id] = { ...(l.layout ?? {}) };
    },
    setPaintProperty: (id: string, k: string, v: unknown) => void ((paint[id] ??= {})[k] = v),
    setLayoutProperty: (id: string, k: string, v: unknown) => void ((layout[id] ??= {})[k] = v),
    setLight: (v: unknown) => void (m.light = v),
    setSky: (v: unknown) => void (m.sky = v),
  };
  return m;
}

test('map mode paints the flat palette and hides 3D buildings', () => {
  const m = fakeMap();
  restyle(m as never, undefined, 'map');
  expect(m.paint.background['background-color']).toBe('#f5f5f3');
  expect(m.paint.water['fill-color']).toBe('#9fd3ef');
  expect(m.paint.highway_motorway_inner['line-color']).toBe('#fde59a');
  expect(m.layout['fl-buildings'].visibility).toBe('none');
  expect(m.layout['highway-name-minor'].visibility).toBe('visible');
});

test('switching map → 3d → map ends identical and adds no layer twice', () => {
  const m = fakeMap();
  restyle(m as never, undefined, 'map');
  const first = JSON.stringify([m.paint, m.layout]);
  applyMode(m as never, '3d');
  expect(m.paint.background['background-color']).toBe('#eef2f4');
  expect(m.layout['fl-buildings'].visibility).toBe('visible');
  applyMode(m as never, 'map');
  expect(JSON.stringify([m.paint, m.layout])).toBe(first);
  expect(new Set(m.added).size).toBe(m.added.length);
});

test('3d mode keeps today\'s look: road names hidden, flat-only layers hidden, originals restored', () => {
  const m = fakeMap();
  restyle(m as never, undefined, '3d');
  expect(m.paint.water['fill-color']).toBe('#b9d5e3');
  expect(m.layout['highway-name-minor'].visibility).toBe('none');
  expect(m.layout.building.visibility).toBe('none');
  expect(m.layout['g-minor-case'].visibility).toBe('none');
  // A property only the flat palette sets goes back to the style's own value.
  expect(m.paint.highway_minor['line-color']).toBe('#fafafa');
  expect(m.paint.highway_minor['line-width']).toBe(2);
});
