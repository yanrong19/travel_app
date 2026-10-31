import { expect, test } from 'vitest';
import { attractionById } from '../data/attractions';
import type { Attraction } from '../data/types';
import { bestWindow, busyStop, closedIn, crowdAt, dayWindow, hourCrowd, isOpenAt, momentsIn, openSpans, type DayWindow } from './bestTime';

const at = (h: number, m = 0) => h * 60 + m;
const win = (from: number, to: number): DayWindow => ({ start: from, end: to, label: 'test' });
const get = (id: string) => attractionById(id)!;
const MON = 0;
const SAT = 5;

const sensoji = get('senso-ji');
const ghibli = get('ghibli-museum'); // 10:00–18:00, shut Tuesdays
const gai = get('golden-gai'); // 19:00–02:00
const crossing = get('shibuya-crossing'); // 00:00–24:00

/** A copy with flat crowds (and a chosen value per hour), every slot good and no curated times. */
function flat(a: Attraction, crowdOf: (h: number) => number = () => 50): Attraction {
  const c = structuredClone(a);
  const curve = Array.from({ length: 18 }, (_, i) => crowdOf(6 + i));
  c.vibe.crowds = { weekday: curve, weekend: curve };
  c.conditions.timeOfDay = { ...c.conditions.timeOfDay, morning: 'good', afternoon: 'good', evening: 'good' };
  c.conditions.bestTimes = [];
  return c;
}

test('dayWindow labels a planning day and a default day', () => {
  expect(dayWindow('09:00', '19:00', 0)).toEqual({ start: at(9), end: at(19), label: 'Day 1 · 09:00–19:00' });
  expect(dayWindow('08:30', '21:00', null)).toEqual({ start: at(8, 30), end: at(21), label: 'a 08:30–21:00 day' });
  // Times that aren't a valid day fall back to the default 09:00–19:00, never NaN.
  expect(dayWindow('19:00', '09:00', 2)).toEqual({ start: at(9), end: at(19), label: 'Day 3 · 09:00–19:00' });
  expect(dayWindow('', 'x', null)).toEqual({ start: at(9), end: at(19), label: 'a 09:00–19:00 day' });
});

test('openSpans: same-day hours, past midnight, 24 hours, closed', () => {
  expect(openSpans(sensoji, MON)).toEqual([[at(6), at(23)]]);
  expect(openSpans(ghibli, 1)).toEqual([]);
  expect(openSpans(crossing, MON)).toEqual([[0, at(24)]]);
  // Golden Gai: tonight's 19:00–02:00, plus last night's run past midnight into this morning.
  expect(openSpans(gai, MON)).toEqual([
    [0, at(2)],
    [at(19), at(26)],
  ]);
});

test('crowdAt reads the weekday or weekend curve, null when closed or off the curve', () => {
  expect(crowdAt(sensoji, MON, at(9, 30))).toBe(sensoji.vibe.crowds.weekday[3]);
  expect(crowdAt(sensoji, SAT, at(9, 30))).toBe(sensoji.vibe.crowds.weekend[3]);
  expect(crowdAt(sensoji, MON, at(18))).toBe(sensoji.vibe.crowds.weekday[12]); // the lit grounds
  expect(crowdAt(sensoji, MON, at(23))).toBeNull(); // the grounds have shut
  expect(crowdAt(ghibli, 1, at(12))).toBeNull(); // Tuesday
  expect(crowdAt(crossing, MON, at(5))).toBeNull(); // before the curve's 06:00
  expect(crowdAt(gai, MON, at(23, 30))).toBe(gai.vibe.crowds.weekday[17]);
});

test('isOpenAt: closing minute is shut; past midnight counts', () => {
  expect(isOpenAt(sensoji, MON, at(22, 59))).toBe(true);
  expect(isOpenAt(sensoji, MON, at(23))).toBe(false);
  expect(isOpenAt(gai, 1, at(1, 30))).toBe(true); // Monday night's bars, early Tuesday
  expect(isOpenAt(gai, 1, at(12))).toBe(false);
});

test('Sensō-ji on a weekday: the quiet morning, or the lit grounds when the day runs past 18:00', () => {
  // 09:00–17:00: the morning, before the early-afternoon crush.
  expect(bestWindow(sensoji, win(at(9), at(17)), MON)).toMatchObject({ kind: 'best', from: at(9), to: at(9) + 75, why: 'quiet' });
  // 09:00–19:00: the quiet, lit-up evening wins; moments are clipped to the day.
  const day = win(at(9), at(19));
  expect(bestWindow(sensoji, day, MON)).toMatchObject({ kind: 'best', from: at(17, 30), to: at(18, 45), why: 'moment' });
  expect(momentsIn(sensoji, day)).toEqual([{ from: at(18), to: at(19), label: 'Lit up after dark' }]);
});

test('a window before opening is closed, with the opening time', () => {
  expect(bestWindow(ghibli, win(at(6), at(9)), MON)).toEqual({ kind: 'closed', opensAt: at(10) });
  expect(bestWindow(ghibli, win(at(9), at(19)), 1)).toEqual({ kind: 'closed', opensAt: null });
  expect(bestWindow(gai, win(at(9), at(19)), MON)).toEqual({ kind: 'closed', opensAt: at(19) });
});

test('Golden Gai, open past midnight, in an 18:00–23:59 window: best from 19:00 on, inside the window', () => {
  const b = bestWindow(gai, win(at(18), at(23, 59)), MON);
  expect(b.kind).toBe('best');
  if (b.kind !== 'best') return;
  expect(b.from).toBeGreaterThanOrEqual(at(19));
  expect(b.to).toBeLessThanOrEqual(at(23, 59));
  expect(b.to - b.from).toBe(135);
  expect(b.why).toBe('moment'); // the 20:00–23:00 bars
});

test('a 24-hour place: candidates run from the window start to its end', () => {
  const day = win(at(7), at(22));
  // Quietest at the very start, then at the very end.
  const early = bestWindow(flat(crossing, (h) => (h === 7 ? 0 : 50)), day, MON);
  expect(early).toMatchObject({ kind: 'best', from: at(7) });
  const late = bestWindow(flat(crossing, (h) => (h === 21 ? 0 : 50)), day, MON);
  expect(late).toMatchObject({ kind: 'best', from: at(21), to: at(21, 20) });
});

test('a window shorter than the visit: the block is cut to fit it', () => {
  expect(bestWindow(gai, win(at(19), at(20)), MON)).toMatchObject({ kind: 'best', from: at(19), to: at(20) });
  // Open only for the last half hour of the window.
  expect(bestWindow(ghibli, win(at(8), at(10, 30)), MON)).toMatchObject({ kind: 'best', from: at(10), to: at(10, 30) });
});

test('a curated moment pulls the block onto it; a poor slot pushes it away', () => {
  const day = win(at(9), at(19));
  const withMoment = flat(sensoji);
  withMoment.conditions.bestTimes = [{ from: 15, to: 17, label: 'Golden light' }];
  expect(bestWindow(withMoment, day, MON)).toMatchObject({ kind: 'best', from: at(15), why: 'moment' });

  const poorMorning = flat(sensoji);
  poorMorning.conditions.timeOfDay.morning = 'poor';
  expect(bestWindow(poorMorning, day, MON)).toMatchObject({ kind: 'best', from: at(12), why: 'quiet' });
});

test('ties go to the earliest start', () => {
  expect(bestWindow(flat(crossing), win(at(9), at(19)), MON)).toMatchObject({ kind: 'best', from: at(9) });
});

test('momentsIn keeps moments that overlap, clipped; drops the rest', () => {
  expect(momentsIn(sensoji, win(at(5), at(23)))).toEqual([
    { from: at(6), to: at(8), label: 'Quiet at opening' },
    { from: at(18), to: at(21), label: 'Lit up after dark' },
  ]);
  expect(momentsIn(sensoji, win(at(9), at(17)))).toEqual([]);
});

test('hourCrowd: an hour is open if any part of it is; open with no curve value counts 50, as the score does', () => {
  const ota = get('ota-memorial-museum'); // opens 10:30, shut Mondays
  expect(hourCrowd(ota, 1, at(10), at(11))).toBe(ota.vibe.crowds.weekday[4]);
  expect(hourCrowd(ota, MON, at(10), at(11))).toBeNull();
  expect(hourCrowd(ghibli, MON, at(9), at(10))).toBeNull(); // opens 10:00
  expect(hourCrowd(ghibli, 1, at(12), at(13))).toBeNull(); // Tuesday
  const gap = structuredClone(crossing);
  gap.vibe.crowds.weekday[3] = null;
  expect(hourCrowd(gap, MON, at(9), at(10))).toBe(50);
  expect(hourCrowd(crossing, MON, at(5), at(6))).toBe(50); // before the curve's 06:00
  // A clipped first hour (window starts 09:30) still reads the hour's value.
  expect(hourCrowd(sensoji, MON, at(9, 30), at(10))).toBe(sensoji.vibe.crowds.weekday[3]);
});

test('closedIn: the parts of the window the place is shut, in minutes', () => {
  const day = win(at(9), at(19));
  expect(closedIn(ghibli, MON, day)).toEqual([
    [at(9), at(10)],
    [at(18), at(19)],
  ]);
  expect(closedIn(ghibli, 1, day)).toEqual([[at(9), at(19)]]);
  expect(closedIn(crossing, MON, day)).toEqual([]);
  expect(closedIn(gai, MON, win(at(18), at(23, 59)))).toEqual([[at(18), at(19)]]);
});

test('busyStop: a stop whose mean crowd is 70 or more', () => {
  expect(busyStop(sensoji, MON, { start: at(12, 13), end: at(13, 28) })).toBe(true);
  expect(busyStop(sensoji, MON, { start: at(9), end: at(10, 15) })).toBe(false);
  expect(busyStop(sensoji, SAT, { start: at(11), end: at(12) })).toBe(true);
  // A stop while it is shut has no crowd to speak of: 50, not busy.
  expect(busyStop(ghibli, 1, { start: at(12), end: at(13) })).toBe(false);
});
