import { expect, test } from 'vitest';
import { ATTRACTIONS, attractionById } from '../data/attractions';
import { metres, neighboursOf, SPOT_ZOOM_MIN, spotFitZoom, spotHistory, spotZoom } from './spotlight';

test('metres: Shibuya Sky to Scramble Crossing is about 200 m', () => {
  expect(metres([139.7022, 35.6585], [139.7005, 35.6595])).toBeGreaterThan(150);
  expect(metres([139.7022, 35.6585], [139.7005, 35.6595])).toBeLessThan(260);
});
test('neighboursOf Shibuya Sky: crossing, Miyashita, Nonbei within 800 m; Meiji Jingu not', () => {
  const n = neighboursOf('shibuya-sky', ATTRACTIONS);
  expect(n).toEqual(expect.arrayContaining(['shibuya-crossing', 'miyashita-park', 'nonbei-yokocho']));
  expect(n).not.toContain('meiji-jingu');
  expect(n).not.toContain('shibuya-sky');
  // Nearest first.
  const from = attractionById('shibuya-sky')!.lonlat;
  const d = n.map((id) => metres(from, attractionById(id)!.lonlat));
  expect(d).toEqual([...d].sort((x, y) => x - y));
});
test('neighboursOf crosses neighbourhoods: Cat Street is near Miyashita Park', () => {
  expect(neighboursOf('miyashita-park', ATTRACTIONS)).toContain('cat-street');
});
test('neighboursOf an unknown id is empty', () => expect(neighboursOf('nope', ATTRACTIONS)).toEqual([]));
test('spotZoom by width', () => {
  expect(spotZoom(1280)).toBe(16);
  expect(spotZoom(390)).toBe(15.5);
});
test('spotHistory pushes only on entering', () => {
  expect(spotHistory(null, 'a')).toBe('push');
  expect(spotHistory('a', 'b')).toBe('replace');
  expect(spotHistory('a', null)).toBe('replace');
  expect(spotHistory(null, null)).toBe('replace');
});

// Flat, north-up Web Mercator with 512 px tiles, as MapLibre: a point's pixel offset from the centre.
const offset = (c: [number, number], p: [number, number], z: number) => {
  const x = (lon: number) => (lon + 180) / 360;
  const y = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
  const s = 512 * 2 ** z;
  return [(x(p[0]) - x(c[0])) * s, (y(p[1]) - y(c[1])) * s];
};
const LAPTOP_FREE = { w: 764, h: 524 }; // 1280 × 800 less the planner's insets

test('spotFitZoom keeps the start zoom with no neighbours, or neighbours already in view', () => {
  const c: [number, number] = [139.7022, 35.6585];
  expect(spotFitZoom(c, [], LAPTOP_FREE, 16)).toBe(16);
  expect(spotFitZoom(c, [c], LAPTOP_FREE, 16)).toBe(16);
  // About 50 m away: well inside at 16.
  expect(spotFitZoom(c, [[139.7027, 35.6588]], LAPTOP_FREE, 16)).toBe(16);
});
test('spotFitZoom steps out just far enough for every neighbour to sit 40 px inside', () => {
  const miyashita = attractionById('miyashita-park')!.lonlat;
  const near = neighboursOf('miyashita-park', ATTRACTIONS).map((id) => attractionById(id)!.lonlat);
  const z = spotFitZoom(miyashita, near, LAPTOP_FREE, 16);
  expect(z).toBeLessThan(16);
  expect(z).toBeGreaterThan(SPOT_ZOOM_MIN);
  const room = near.map((p) => offset(miyashita, p, z)).map(([dx, dy]) => Math.min(LAPTOP_FREE.w / 2 - Math.abs(dx), LAPTOP_FREE.h / 2 - Math.abs(dy)));
  // Every neighbour at least 40 px in, and the tightest one only just (no further out than needed).
  expect(Math.min(...room)).toBeGreaterThanOrEqual(40);
  expect(Math.min(...room)).toBeLessThan(43);
});
test('spotFitZoom never goes below the floor', () => {
  const c: [number, number] = [139.6993, 35.6764];
  expect(SPOT_ZOOM_MIN).toBe(14.8);
  expect(spotFitZoom(c, [[139.75, 35.7]], LAPTOP_FREE, 16)).toBe(SPOT_ZOOM_MIN);
  // A free area too small for the margin falls back to the floor too.
  expect(spotFitZoom(c, [[139.6994, 35.6765]], { w: 60, h: 60 }, 16)).toBe(SPOT_ZOOM_MIN);
});
