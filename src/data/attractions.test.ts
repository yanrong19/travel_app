import { expect, test } from 'vitest';
import { ATTRACTIONS } from './attractions';

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
