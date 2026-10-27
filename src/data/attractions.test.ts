import { expect, test } from 'vitest';
import { ATTRACTIONS } from './attractions';
import { SLOT_RANGES, TIME_SLOTS } from '../lib/timeOfDay';

test('every attraction has a nature value 0–100', () => {
  for (const a of ATTRACTIONS) {
    expect(a.vibe.nature).toBeGreaterThanOrEqual(0);
    expect(a.vibe.nature).toBeLessThanOrEqual(100);
  }
});
test('nature values are sensible at the ends', () => {
  const by = Object.fromEntries(ATTRACTIONS.map((a) => [a.id, a.vibe.nature]));
  expect(by['mount-takao']).toBeGreaterThanOrEqual(80);
  expect(by['shibuya-sky']).toBeLessThanOrEqual(20);
});

test('every attraction rates the morning, afternoon and evening, with a note', () => {
  for (const a of ATTRACTIONS) {
    const t = a.conditions.timeOfDay;
    for (const slot of TIME_SLOTS) expect(['good', 'ok', 'poor'], `${a.id} ${slot}`).toContain(t[slot]);
    expect(t.note.trim().length, a.id).toBeGreaterThan(0);
  }
});

test('a slot outside the opening hours on every day is never good', () => {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  for (const a of ATTRACTIONS) {
    for (const slot of TIME_SLOTS) {
      const [from, to] = SLOT_RANGES[slot];
      const openInSlot = a.logistics.hours.some((h) => {
        if (!h) return false;
        const open = toMin(h[0]);
        let close = toMin(h[1]);
        if (close <= open) close += 24 * 60; // closes after midnight
        return open < to && close > from;
      });
      if (!openInSlot) expect(a.conditions.timeOfDay[slot], `${a.id} ${slot}`).not.toBe('good');
    }
  }
});

test('time-of-day ratings follow the data at the ends', () => {
  const by = Object.fromEntries(ATTRACTIONS.map((a) => [a.id, a.conditions.timeOfDay]));
  expect(by['shibuya-sky'].evening).toBe('good');
  expect(by['tsukiji-outer-market'].morning).toBe('good');
  expect(by['tsukiji-outer-market'].evening).toBe('poor');
  expect(by['teamlab-planets'].evening).toBe('good');
  expect(by['golden-gai'].morning).toBe('poor');
});
