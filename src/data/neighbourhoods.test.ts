import { expect, test } from 'vitest';
import { ATTRACTIONS } from './attractions';
import { NEIGHBOURHOODS, neighbourhoodById } from './neighbourhoods';

/** Great-circle distance in metres between two [lon, lat] points. */
function metresBetween(a: [number, number], b: [number, number]) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

test('16 neighbourhoods with unique JP-N-TOKYO ids', () => {
  expect(NEIGHBOURHOODS).toHaveLength(16);
  expect(new Set(NEIGHBOURHOODS.map((n) => n.id)).size).toBe(16);
  for (const n of NEIGHBOURHOODS) expect(n.id).toMatch(/^JP-N-TOKYO-[A-Z]+$/);
});
test('every attraction belongs to a known neighbourhood, within its radius', () => {
  for (const a of ATTRACTIONS) {
    const n = neighbourhoodById(a.neighbourhood);
    expect(n, a.id).toBeDefined();
    expect(metresBetween(a.lonlat, n!.center), a.id).toBeLessThanOrEqual(n!.radiusM);
  }
});
test('every neighbourhood holds at least one attraction', () => {
  for (const n of NEIGHBOURHOODS) expect(ATTRACTIONS.some((a) => a.neighbourhood === n.id), n.id).toBe(true);
});
test('30 attractions; Harajuku holds 6', () => {
  expect(ATTRACTIONS).toHaveLength(30);
  expect(ATTRACTIONS.filter((a) => a.neighbourhood === 'JP-N-TOKYO-HARAJUKU')).toHaveLength(6);
});
