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

test('attraction ids are unique', () => {
  expect(new Set(ATTRACTIONS.map((a) => a.id)).size).toBe(ATTRACTIONS.length);
});

test('the new attractions are fully shaped: 18 crowd hours per curve, 7 days of hours, 12 months', () => {
  const NEW = [
    'shibuya-crossing', 'miyashita-park', 'nonbei-yokocho', 'takeshita-street', 'yoyogi-park', 'cat-street',
    'ota-memorial-museum', 'nezu-museum', 'shinjuku-gyoen', 'omoide-yokocho', 'tocho-observatory',
    'kappabashi', 'sumida-park', 'hanayashiki',
  ];
  for (const id of NEW) {
    const a = ATTRACTIONS.find((x) => x.id === id);
    expect(a, id).toBeDefined();
    expect(a!.vibe.crowds.weekday, id).toHaveLength(18);
    expect(a!.vibe.crowds.weekend, id).toHaveLength(18);
    expect(a!.logistics.hours, id).toHaveLength(7);
    expect(a!.conditions.months, id).toHaveLength(12);
  }
});

test('no cost extra is transport', () => {
  for (const a of ATTRACTIONS) {
    for (const e of a.cost.extras) {
      expect(e.label, a.id).not.toMatch(/^(return |taxi )/i);
      expect(e.label, a.id).not.toMatch(/yurikamome/i);
    }
  }
  const takao = ATTRACTIONS.find((a) => a.id === 'mount-takao')!;
  expect(takao.cost.extras.some((e) => e.label === 'Cable car round trip')).toBe(true);
});
