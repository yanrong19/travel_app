import { expect, test } from 'vitest';
import { ATTRACTIONS, attractionById } from '../data/attractions';
import { metres, neighboursOf, spotHistory, spotZoom } from './spotlight';

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
