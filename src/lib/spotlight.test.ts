import { expect, test } from 'vitest';
import { ATTRACTIONS, attractionById } from '../data/attractions';
import { afterSpotPop, metres, neighboursOf, SPOT_ZOOM_MIN, spotFitZoom, spotHistory, spotLeave, spotZoom } from './spotlight';

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
test('spotLeave steps back only when this page pushed the spot', () => {
  expect(spotLeave('a', true)).toBe('back');
  expect(spotLeave('a', false)).toBe('replace');
  expect(spotLeave(null, true)).toBe('none');
  expect(spotLeave(null, false)).toBe('none');
});

/**
 * The planner's history as the router keeps it, driven by the same decisions Planner makes: opening
 * a spot (spotHistory), day/tab/wet changes (always replace), leaving (spotLeave), and after every
 * location change afterSpotPop, whose result is written back with replace.
 */
function planner(start: string) {
  const path = '/trip/t1';
  const stack = [start];
  let at = 0;
  let pushed = false;
  let pushes = 0;
  const cur = () => new URLSearchParams(stack[at]);
  const land = (prev: string, pop: boolean) => {
    if (!new URLSearchParams(stack[at]).get('spot')) pushed = false;
    const fix = afterSpotPop({ pathname: path, search: prev }, { pathname: path, search: stack[at] }, pop);
    if (fix) stack[at] = fix.toString();
  };
  const replace = (q: URLSearchParams) => {
    const prev = stack[at];
    stack[at] = q.toString();
    land(prev, false);
  };
  const back = () => {
    const prev = stack[at];
    at -= 1;
    land(prev, true);
  };
  return {
    get search() {
      return cur();
    },
    get length() {
      return at + 1;
    },
    get pushes() {
      return pushes;
    },
    open(sid: string) {
      const q = cur();
      const how = spotHistory(q.get('spot'), sid);
      q.set('spot', sid);
      if (how === 'push') {
        const prev = stack[at];
        stack.splice(at + 1, Infinity, q.toString());
        at += 1;
        pushed = true;
        pushes += 1;
        land(prev, false);
      } else replace(q);
    },
    set(k: string, v: string | null) {
      const q = cur();
      if (v === null) q.delete(k);
      else q.set(k, v);
      replace(q);
    },
    /** The card's close, Esc and a crumb all leave this way; a crumb then views its place with replace. */
    leave(view?: string) {
      const how = spotLeave(cur().get('spot'), pushed);
      if (how === 'back') back();
      else if (how === 'replace') {
        const q = cur();
        q.delete('spot');
        replace(q);
      }
      if (view) this.set('view', view);
    },
    back,
  };
}

test('entering a spot pushes once; moving between neighbours replaces', () => {
  const p = planner('day=1&place=1');
  p.open('meiji-jingu');
  expect(p.length).toBe(2);
  p.open('takeshita-street');
  p.open('cat-street');
  expect(p.length).toBe(2);
  expect(p.pushes).toBe(1);
  expect(p.search.get('spot')).toBe('cat-street');
  p.leave();
  expect(p.length).toBe(1);
  expect(p.search.get('spot')).toBeNull();
});
test('leaving a spot this page did not push (a reload) replaces it away, with no step back', () => {
  const p = planner('day=1&place=1&spot=meiji-jingu');
  p.leave();
  expect(p.length).toBe(1);
  expect(p.search.toString()).toBe('day=1&place=1');
});
for (const how of ['close', 'Esc', 'crumb', 'browser Back'] as const) {
  test(`the day, sub-tab and wet toggle changed during a spot survive leaving by ${how}`, () => {
    const p = planner('day=1&place=1');
    p.open('meiji-jingu');
    p.set('day', '2');
    p.set('tab', 'browse');
    p.set('wet', '1');
    if (how === 'browser Back') p.back();
    else p.leave(how === 'crumb' ? 'area:tokyo' : undefined);
    expect(p.length).toBe(1);
    const q = p.search;
    expect(q.get('spot')).toBeNull();
    expect(q.get('day')).toBe('2');
    expect(q.get('tab')).toBe('browse');
    expect(q.get('wet')).toBe('1');
    expect(q.get('place')).toBe('1');
    if (how === 'crumb') expect(q.get('view')).toBe('area:tokyo');
  });
}
test('turning the sub-tab and wet toggle back off during a spot survives leaving too', () => {
  const p = planner('day=3&place=1&tab=browse&wet=1');
  p.open('meiji-jingu');
  p.set('tab', null);
  p.set('wet', null);
  p.leave();
  expect(p.search.toString()).toBe('day=3&place=1');
});
test('afterSpotPop leaves other changes alone', () => {
  const loc = (search: string, pathname = '/trip/t1') => ({ pathname, search });
  // Nothing changed during the spot: nothing to put back.
  expect(afterSpotPop(loc('day=1&spot=a'), loc('day=1'), true)).toBeNull();
  // Not a pop (a replace that drops the spot keeps its own params).
  expect(afterSpotPop(loc('day=2&spot=a'), loc('day=1'), false)).toBeNull();
  // A pop onto another spot, or from no spot, or to another page.
  expect(afterSpotPop(loc('day=2&spot=a'), loc('day=1&spot=b'), true)).toBeNull();
  expect(afterSpotPop(loc('day=2'), loc('day=1'), true)).toBeNull();
  expect(afterSpotPop(loc('day=2&spot=a'), loc('day=1', '/trip/t2'), true)).toBeNull();
  // The place and view it lands on stay the landed ones.
  expect(afterSpotPop(loc('day=2&place=1&view=n:x&spot=a'), loc('day=1&place=2'), true)?.toString()).toBe('day=2&place=2');
});

// Flat, north-up Web Mercator with 512 px tiles, as MapLibre: a point's pixel offset from the centre.
const offset = (c: [number, number], p: [number, number], z: number) => {
  const x = (lon: number) => (lon + 180) / 360;
  const y = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
  const s = 512 * 2 ** z;
  return [(x(p[0]) - x(c[0])) * s, (y(p[1]) - y(c[1])) * s];
};
const LAPTOP_FREE = { w: 764, h: 524 }; // 1280 × 800 less the planner's insets

test('spotFitZoom keeps the start zoom with no neighbours, or neighbours already in view', () => {
  const c: [number, number] = [139.7022, 35.6585];
  expect(spotFitZoom(c, [], LAPTOP_FREE, 16)).toBe(16);
  expect(spotFitZoom(c, [c], LAPTOP_FREE, 16)).toBe(16);
  // About 50 m away: well inside at 16.
  expect(spotFitZoom(c, [[139.7027, 35.6588]], LAPTOP_FREE, 16)).toBe(16);
});
test('spotFitZoom steps out just far enough for every neighbour to sit 40 px inside', () => {
  const miyashita = attractionById('miyashita-park')!.lonlat;
  const near = neighboursOf('miyashita-park', ATTRACTIONS).map((id) => attractionById(id)!.lonlat);
  const z = spotFitZoom(miyashita, near, LAPTOP_FREE, 16);
  expect(z).toBeLessThan(16);
  expect(z).toBeGreaterThan(SPOT_ZOOM_MIN);
  const room = near.map((p) => offset(miyashita, p, z)).map(([dx, dy]) => Math.min(LAPTOP_FREE.w / 2 - Math.abs(dx), LAPTOP_FREE.h / 2 - Math.abs(dy)));
  // Every neighbour at least 40 px in, and the tightest one only just (no further out than needed).
  expect(Math.min(...room)).toBeGreaterThanOrEqual(40);
  expect(Math.min(...room)).toBeLessThan(43);
});
test('spotFitZoom never goes below the floor', () => {
  const c: [number, number] = [139.6993, 35.6764];
  expect(SPOT_ZOOM_MIN).toBe(14.8);
  expect(spotFitZoom(c, [[139.75, 35.7]], LAPTOP_FREE, 16)).toBe(SPOT_ZOOM_MIN);
  // A free area too small for the margin falls back to the floor too.
  expect(spotFitZoom(c, [[139.6994, 35.6765]], { w: 60, h: 60 }, 16)).toBe(SPOT_ZOOM_MIN);
});
