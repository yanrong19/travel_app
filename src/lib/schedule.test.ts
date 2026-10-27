import { expect, test } from 'vitest';
import { attractionById } from '../data/attractions';
import { dayLengthMin, schedule, travelMin, visitMin } from './schedule';

const sensoji = attractionById('senso-ji')!;
const sky = attractionById('shibuya-sky')!;

test('travelMin walks short hops: ×1.3 at 4.5 km/h, rounded up to 5', () => {
  // 1.5 km apart (0.01349° of latitude): 1.5 × 1.3 ÷ 4.5 km/h = 26 min, rounded up to 30.
  expect(travelMin([139.7, 35.7], [139.7, 35.71349])).toBe(30);
  expect(travelMin([139.7, 35.7], [139.7, 35.7])).toBe(0);
});

test('travelMin takes the train past 2 km: 15 min + the distance at 35 km/h, rounded up to 5', () => {
  // Sensō-ji to Shibuya: 15 + 9.77 km ÷ 35 km/h = 31.7 min, rounded up to 35.
  expect(travelMin([139.7966, 35.7148], [139.6993, 35.6764])).toBe(35);
  // Mount Takao to teamLab Planets: 15 + 49.4 km ÷ 35 km/h = 99.7 min, rounded up to 100 (1 h 40).
  expect(travelMin(attractionById('mount-takao')!.lonlat, attractionById('teamlab-planets')!.lonlat)).toBe(100);
});

test('visitMin is the visit midpoint plus the queue midpoint', () => {
  // Sensō-ji: visit 60–90 (75) + queue 0–15 (7.5) = 82.5, rounded to 83.
  expect(visitMin(sensoji)).toBe(83);
});

test('schedule starts at the day’s start and adds travel between stops', () => {
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

test('dayLengthMin is the minutes from a day’s start to its end', () => {
  expect(dayLengthMin('09:00', '19:00')).toBe(600);
  expect(dayLengthMin('07:30', '23:59')).toBe(16 * 60 + 29);
});
