import { expect, test } from 'vitest';
import { attractionById } from '../data/attractions';
import { dayLengthMin, schedule, travelMin, visitMin } from './schedule';

const sensoji = attractionById('senso-ji')!;
const sky = attractionById('shibuya-sky')!;

test('travelMin rounds up to 5 and uses ×1.4 at 18 km/h', () => {
  // Sensō-ji to Shibuya: 9.77 km × 1.4 ÷ 18 km/h = 45.6 min, rounded up to 50.
  expect(travelMin([139.7966, 35.7148], [139.6993, 35.6764])).toBe(50);
  expect(travelMin([139.7, 35.7], [139.7, 35.7])).toBe(0);
});

test('visitMin is the visit midpoint plus the queue midpoint', () => {
  // Sensō-ji: visit 60–90 (75) + queue 0–15 (7.5) = 82.5, rounded to 83.
  expect(visitMin(sensoji)).toBe(83);
});

test('schedule starts at dayStart and adds travel between stops', () => {
  const [a, b] = schedule([sensoji, sky], '09:00');
  expect(a).toMatchObject({ start: 540, end: 540 + visitMin(sensoji), travelBefore: 0 });
  const t = travelMin(sensoji.lonlat, sky.lonlat);
  expect(t).toBeGreaterThan(0);
  expect(b.travelBefore).toBe(t);
  expect(b.start).toBe(a.end + t);
  expect(b.end).toBe(b.start + visitMin(sky));
});

test('schedule of one stop has no travel', () => {
  const s = schedule([sensoji], '08:30');
  expect(s).toHaveLength(1);
  expect(s[0].travelBefore).toBe(0);
  expect(s[0].start).toBe(510);
  expect(schedule([], '09:00')).toEqual([]);
});

test('dayLengthMin follows pace', () => {
  expect([dayLengthMin('relaxed'), dayLengthMin('normal'), dayLengthMin('packed')]).toEqual([480, 600, 720]);
});
