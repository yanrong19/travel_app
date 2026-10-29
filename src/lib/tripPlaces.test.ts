import { expect, test } from 'vitest';
import { DESTINATIONS } from '../data/destinations';
import { REGIONS } from '../data/regions';
import { AREA_COUNTS, TOKYO_AREAS } from '../data/places';
import { ATTRACTIONS } from '../data/attractions';
import { neighbourhoodById } from '../data/neighbourhoods';
import { newTrip, addStop, type PlaceRef } from './trips';
import { ALL_PLACES, attractionsIn, coveringPlace, covers, dayPlace, placeCover, placeLabel, placeView, sameRef } from './tripPlaces';

const JAPAN: PlaceRef = { level: 'country', id: '392' };
const KANTO: PlaceRef = { level: 'region', id: 'kanto' };
const TOKYO: PlaceRef = { level: 'prefecture', id: '13' };
const TAITO: PlaceRef = { level: 'area', id: '13106' };
const HARAJUKU: PlaceRef = { level: 'neighbourhood', id: 'JP-N-TOKYO-HARAJUKU' };
const ODAIBA: PlaceRef = { level: 'neighbourhood', id: 'JP-N-TOKYO-ODAIBA' };

test('attractionsIn returns all of Tokyo for Japan, Kantō and prefecture 13', () => {
  for (const ref of [JAPAN, KANTO, TOKYO]) expect(attractionsIn(ref)).toHaveLength(30);
});

test('attractionsIn returns [] for places without data', () => {
  expect(attractionsIn({ level: 'country', id: '380' })).toEqual([]);
  expect(attractionsIn({ level: 'prefecture', id: '26' })).toEqual([]);
  expect(attractionsIn({ level: 'region', id: 'kansai' })).toEqual([]);
});

test('attractionsIn of a ward is that ward only', () => {
  const list = attractionsIn(TAITO);
  expect(list.length).toBe(AREA_COUNTS['13106']);
  expect(list.length).toBeGreaterThan(0);
  expect(list.every((a) => a.area === '13106')).toBe(true);
});

test('placeLabel names each level', () => {
  expect(placeLabel(JAPAN)).toEqual({ name: 'Japan', local: '日本', kind: 'Country' });
  expect(placeLabel(KANTO)).toMatchObject({ name: 'Kantō', local: '関東', kind: 'Region of Japan' });
  expect(placeLabel(TOKYO)).toMatchObject({ name: 'Tokyo', kind: 'Prefecture' });
  expect(placeLabel(TAITO)).toMatchObject({ kind: 'Tokyo ward' });
  expect(placeLabel(TAITO).name).toBe(TOKYO_AREAS.find((a) => a.id === '13106')!.properties.name);
});

test('placeCover picks a photo for each level', () => {
  expect(placeCover(JAPAN)).toBe('senso-ji');
  expect(placeCover(KANTO)).toBe('shibuya-sky');
  expect(placeCover(TOKYO)).toBe('shibuya-sky');
  expect(placeCover(TAITO)).toBe(attractionsIn(TAITO)[0].id);
  expect(placeCover({ level: 'prefecture', id: '26' })).toBeNull();
});

test('placeView of a region focuses its prefectures', () => {
  const v = placeView({ level: 'region', id: 'kansai' });
  expect(v.focusPrefs).toEqual([24, 25, 26, 27, 28, 29, 30]);
  expect(v.target.level).toBe('country');
});

test('placeView of prefecture 13 is the Tokyo region level', () => {
  const v = placeView(TOKYO);
  expect(v.target.level).toBe('region');
  expect(v.focusPrefs).toBeNull();
});

test('placeView of other places', () => {
  expect(placeView(JAPAN)).toMatchObject({ target: { level: 'country' }, focusPrefs: null });
  expect(placeView({ level: 'prefecture', id: '26' })).toMatchObject({ target: { level: 'country' }, focusPrefs: [26] });
  const a = placeView(TAITO);
  expect(a.target.level).toBe('area');
  expect(a.target.area?.id).toBe('13106');
  expect(a.focusPrefs).toBeNull();
});

test('ALL_PLACES has 13 destinations, 8 regions, 47 prefectures and the wards with attractions', () => {
  const by = (level: PlaceRef['level']) => ALL_PLACES.filter((p) => p.level === level);
  expect(by('country')).toHaveLength(13);
  expect(by('country')).toHaveLength(DESTINATIONS.length);
  expect(by('region')).toHaveLength(8);
  expect(by('region')).toHaveLength(REGIONS.length);
  expect(by('prefecture')).toHaveLength(47);
  expect(by('area')).toHaveLength(Object.keys(AREA_COUNTS).length);
  expect(ALL_PLACES.every((p) => p.label && p.sub)).toBe(true);
});

test('sameRef compares level and id', () => {
  expect(sameRef(TOKYO, { level: 'prefecture', id: '13' })).toBe(true);
  expect(sameRef(TOKYO, { level: 'area', id: '13' })).toBe(false);
});

test('covers follows attractionsIn', () => {
  expect(covers(JAPAN, 'senso-ji')).toBe(true);
  expect(covers({ level: 'country', id: '380' }, 'senso-ji')).toBe(false);
});

test('coveringPlace finds Japan for a Tokyo attraction; null when nothing covers it', () => {
  const id = ATTRACTIONS[0].id;
  expect(coveringPlace([{ level: 'country', id: '380' }, JAPAN, TOKYO], id)).toEqual(JAPAN);
  expect(coveringPlace([{ level: 'country', id: '380' }], id)).toBeNull();
  expect(coveringPlace([], id)).toBeNull();
});

test('dayPlace uses the first stop, else the first place', () => {
  const t0 = newTrip({ name: 't', places: [{ level: 'country', id: '380' }, JAPAN], startDate: null, days: 2 }, 0, 't');
  expect(dayPlace(t0, 0)).toEqual({ level: 'country', id: '380' }); // empty day: first place
  const t1 = addStop(t0, 1, 'senso-ji', 1);
  expect(dayPlace(t1, 1)).toEqual(JAPAN); // covered by Japan, not by Italy
  expect(dayPlace(t1, 0)).toEqual({ level: 'country', id: '380' });
  expect(dayPlace({ ...t0, places: [] }, 0)).toBeNull();
});

test('a neighbourhood covers its own attractions only, labelled and with a cover photo', () => {
  const list = attractionsIn(HARAJUKU);
  expect(list).toHaveLength(6);
  expect(list.every((a) => a.neighbourhood === HARAJUKU.id)).toBe(true);
  expect(placeLabel(HARAJUKU)).toEqual({ name: 'Harajuku & Omotesandō', local: '原宿・表参道', kind: 'Tokyo neighbourhood' });
  expect(placeCover(HARAJUKU)).toBe(list[0].id);
});

test('ALL_PLACES has no neighbourhood: they are map-only', () => {
  expect(ALL_PLACES.some((p) => p.level === 'neighbourhood')).toBe(false);
});

test('placeView of a neighbourhood is the Tokyo level with a frame that holds every attraction', () => {
  const v = placeView(HARAJUKU);
  expect(v.target.level).toBe('region');
  expect(v.focusPrefs).toBeNull();
  const [[w, s], [e, n]] = v.frame!;
  for (const a of attractionsIn(HARAJUKU)) {
    expect(a.lonlat[0]).toBeGreaterThanOrEqual(w);
    expect(a.lonlat[0]).toBeLessThanOrEqual(e);
    expect(a.lonlat[1]).toBeGreaterThanOrEqual(s);
    expect(a.lonlat[1]).toBeLessThanOrEqual(n);
  }
  // Reaches at least 600 m from the centre each way.
  const [cx, cy] = neighbourhoodById(HARAJUKU.id)!.center;
  const mE = 111320 * Math.cos((cy * Math.PI) / 180);
  expect((e - cx) * mE).toBeGreaterThanOrEqual(599);
  expect((cx - w) * mE).toBeGreaterThanOrEqual(599);
  expect((n - cy) * 111320).toBeGreaterThanOrEqual(599);
  expect((cy - s) * 111320).toBeGreaterThanOrEqual(599);
});

test('a neighbourhood frame ignores its loose radius: Odaiba spans about 1.6 km at most', () => {
  const [[w], [e]] = placeView(ODAIBA).frame!;
  const lat = neighbourhoodById(ODAIBA.id)!.center[1];
  expect((e - w) * 111320 * Math.cos((lat * Math.PI) / 180)).toBeLessThanOrEqual(1600);
  expect(placeView(TOKYO).frame).toBeUndefined();
});
