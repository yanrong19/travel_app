import { expect, test } from 'vitest';
import { REGIONS } from '../data/regions';
import type { PlaceRef } from './trips';
import {
  attractionHome,
  attractionLevelFor,
  countFor,
  isKnownPlace,
  nodeOf,
  parentOf,
  parseRefKey,
  pathTo,
  placeAnchor,
  refKey,
  sameTree,
} from './placeTree';

const JAPAN: PlaceRef = { level: 'country', id: '392' };
const ITALY: PlaceRef = { level: 'country', id: '380' };
const KANTO: PlaceRef = { level: 'region', id: 'kanto' };
const KANSAI: PlaceRef = { level: 'region', id: 'kansai' };
const TOKYO: PlaceRef = { level: 'prefecture', id: '13' };
const KANAGAWA: PlaceRef = { level: 'prefecture', id: '14' };
const TAITO: PlaceRef = { level: 'area', id: '13106' };

test('Japan has the 8 regions as children and is not the attraction level', () => {
  const n = nodeOf(JAPAN);
  expect(n.label).toBe('Japan');
  expect(n.attractionLevel).toBe(false);
  expect(n.children).toEqual(REGIONS.map((r) => ({ level: 'region', id: r.id })));
  expect(n.children).toHaveLength(8);
});

test('each region has its prefectures as children', () => {
  for (const r of REGIONS) {
    const n = nodeOf({ level: 'region', id: r.id });
    expect(n.attractionLevel).toBe(false);
    expect(n.children).toEqual(r.prefectures.map((p) => ({ level: 'prefecture', id: String(p).padStart(2, '0') })));
    for (const c of n.children) expect(parentOf(c)).toEqual({ level: 'region', id: r.id });
  }
  expect(nodeOf(KANTO).children.map((c) => c.id)).toEqual(['08', '09', '10', '11', '12', '13', '14']);
});

test('Tokyo is the attraction level, and its wards stay a filter inside it', () => {
  const n = nodeOf(TOKYO);
  expect(n).toMatchObject({ label: 'Tokyo', attractionLevel: true, children: [] });
  expect(nodeOf(TAITO)).toMatchObject({ attractionLevel: true, children: [] });
  expect(parentOf(TAITO)).toEqual(TOKYO);
});

test('other prefectures are the attraction level, with no attractions yet', () => {
  expect(nodeOf(KANAGAWA)).toMatchObject({ attractionLevel: true, children: [] });
  expect(countFor(KANAGAWA)).toBe(0);
});

test('a country outside Japan is the attraction level at country level', () => {
  expect(nodeOf(ITALY)).toMatchObject({ ref: ITALY, label: 'Italy', attractionLevel: true, children: [] });
  expect(parentOf(ITALY)).toBeNull();
  expect(pathTo(ITALY)).toEqual([ITALY]);
});

test('parentOf walks up to the country', () => {
  expect(parentOf(TOKYO)).toEqual(KANTO);
  expect(parentOf(KANTO)).toEqual(JAPAN);
  expect(parentOf(JAPAN)).toBeNull();
});

test('pathTo a ward runs root first: Japan, Kantō, Tokyo, the ward', () => {
  expect(pathTo(TAITO)).toEqual([JAPAN, KANTO, TOKYO, TAITO]);
  expect(pathTo(TOKYO)).toEqual([JAPAN, KANTO, TOKYO]);
  expect(pathTo(JAPAN)).toEqual([JAPAN]);
});

test('countFor counts the checked attractions inside a place', () => {
  expect(countFor(JAPAN)).toBe(30);
  expect(countFor(KANTO)).toBe(30);
  expect(countFor(TOKYO)).toBe(30);
  expect(countFor(KANSAI)).toBe(0);
  expect(countFor(ITALY)).toBe(0);
  expect(countFor(TAITO)).toBeGreaterThan(0);
  expect(countFor(TAITO)).toBeLessThan(30);
});

test('attractionLevelFor finds the attraction-level place under a root', () => {
  expect(attractionLevelFor(JAPAN, 'senso-ji')).toEqual(TOKYO);
  expect(attractionLevelFor(KANTO, 'senso-ji')).toEqual(TOKYO);
  expect(attractionLevelFor(TOKYO, 'senso-ji')).toEqual(TOKYO);
  expect(attractionLevelFor(KANSAI, 'senso-ji')).toBeNull();
  expect(attractionLevelFor(ITALY, 'senso-ji')).toBeNull();
});

test('sameTree holds for places under the same root country', () => {
  expect(sameTree(JAPAN, TOKYO)).toBe(true);
  expect(sameTree(TOKYO, KANTO)).toBe(true);
  expect(sameTree(KANSAI, TAITO)).toBe(true);
  expect(sameTree(ITALY, ITALY)).toBe(true);
  expect(sameTree(ITALY, JAPAN)).toBe(false);
  expect(sameTree(ITALY, TOKYO)).toBe(false);
});

test('refKey and parseRefKey round-trip, and unknown places are refused', () => {
  for (const ref of [JAPAN, ITALY, KANTO, TOKYO, TAITO]) expect(parseRefKey(refKey(ref))).toEqual(ref);
  expect(parseRefKey('prefecture:8')).toEqual({ level: 'prefecture', id: '08' });
  expect(parseRefKey(null)).toBeNull();
  expect(parseRefKey('region:atlantis')).toBeNull();
  expect(parseRefKey('planet:3')).toBeNull();
  expect(parseRefKey('prefecture:99')).toBeNull();
  expect(isKnownPlace({ level: 'country', id: '000' })).toBe(false);
});

test('placeAnchor puts regions and prefectures on land in Japan', () => {
  const [lng, lat] = placeAnchor(KANTO);
  expect(lng).toBeGreaterThan(138);
  expect(lng).toBeLessThan(141);
  expect(lat).toBeGreaterThan(35);
  expect(lat).toBeLessThan(37.5);
  // Kyūshū & Okinawa: on Kyūshū, not in the sea between it and Okinawa (the middle of its box).
  const [kl, kt] = placeAnchor({ level: 'region', id: 'kyushu-okinawa' });
  expect(kl).toBeGreaterThan(129.5);
  expect(kl).toBeLessThan(132);
  expect(kt).toBeGreaterThan(31);
  expect(kt).toBeLessThan(34);
  // Tokyo without Ogasawara: the centroid stays on the main island.
  const [tl, tt] = placeAnchor(TOKYO);
  expect(tl).toBeGreaterThan(138.9);
  expect(tl).toBeLessThan(140);
  expect(tt).toBeGreaterThan(35.4);
  expect(tt).toBeLessThan(35.9);
});

test('attractionHome: the viewed place when it already shows the pin', () => {
  expect(attractionHome('senso-ji', [JAPAN], JAPAN, TOKYO)).toEqual(TOKYO);
  expect(attractionHome('senso-ji', [TAITO], TAITO, TAITO)).toEqual(TAITO);
});

test('attractionHome: above the attraction level, the attraction-level place under the trip place', () => {
  expect(attractionHome('senso-ji', [JAPAN, ITALY], JAPAN, JAPAN)).toEqual(TOKYO);
  expect(attractionHome('senso-ji', [JAPAN, ITALY], JAPAN, KANSAI)).toEqual(TOKYO);
  // Viewing Italy: Sensō-ji lives in the Japan trip place's tree.
  expect(attractionHome('senso-ji', [JAPAN, ITALY], ITALY, ITALY)).toEqual(TOKYO);
});

test('attractionHome: the most specific covering trip place wins', () => {
  expect(attractionHome('senso-ji', [JAPAN, TAITO], JAPAN, JAPAN)).toEqual(TAITO);
  expect(attractionHome('senso-ji', [KANTO, TAITO], KANTO, KANTO)).toEqual(TAITO);
});

test('attractionHome: a Taitō-only trip finds a Taitō attraction in Taitō, and others in Tokyo', () => {
  // Viewing Japan from a Taitō trip (up the breadcrumb): the pin is in Taitō.
  expect(attractionHome('senso-ji', [TAITO], TAITO, JAPAN)).toEqual(TAITO);
  // Not in Taitō: no trip place covers it, so the tree's attraction-level place holds it.
  expect(attractionHome('shibuya-sky', [TAITO], TAITO, JAPAN)).toEqual(TOKYO);
});

test('attractionHome: null when no trip tree holds the attraction', () => {
  expect(attractionHome('senso-ji', [ITALY], ITALY, ITALY)).toBeNull();
});
