# Map spotlight, neighbourhoods, in-view browsing and the flat map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the planner, go Japan › Tokyo › Harajuku, browse what's on screen beside a folded day strip, open a flat close-in spotlight on any attraction and step back out, on a Google-Maps-like flat map (3D a tap away).

**Architecture:** Neighbourhoods become a map-only level in `placeTree` under Tokyo, with their own data file. `MapExplorer` learns three things: a remembered Map/3D mode (`applyMode` in `style.ts`), a camera `focus` (a neighbourhood frame or a spotlight) that overrides its target framing, and an `onViewQuad` callback reporting the visible area. The planner keeps the spotlight in the URL (`&spot=`), filters Browse to what's in view, and folds the day header into a strip while browsing.

**Tech Stack:** React 19, TypeScript, react-router 7, MapLibre GL 6.15 (named imports only), OpenFreeMap positron tiles, Vitest. Knowledge base: Python 3 scripts in `kb/scripts`.

**Spec:** `docs/superpowers/specs/2026-10-29-map-spotlight-design.md` (read it with this plan).

## Global Constraints

- No new runtime dependencies. MapLibre imports are named (`import { Map as MapLibreMap } from 'maplibre-gl'`); there is no default export.
- Tiles stay OpenFreeMap `STYLE_URL`; no Google tiles or keys.
- Laptop and phone (`(max-width: 760px)`) both work; camera moves respect `prefersReducedMotion()` (jump instead of fly).
- Neighbourhood ids are `JP-N-TOKYO-<SLUG>` and must be identical in `src/data/neighbourhoods.ts` and `kb/data/curated/JP.txt`.
- Neighbours = attractions within **800 m** straight-line of the spotlit one.
- Flat "Map" palette (exact hex): land `#f5f5f3`, residential `#f1f1ef`, parks `#c6e9c0`, woods `#b9e0b0`, water `#9fd3ef`, minor roads `#ffffff` with `#dadce0` edge, major roads `#ffffff` with `#c9ccd1` casing, motorways `#fde59a` with `#f0c25e` casing, rail `#b8bcc2`, labels `#5f6368` / `#3c4043`, station names `#2f6fd6`, hospitals `#fbe3e3`, schools `#ecebf6`, shopping `#fcefe1`. Reference implementation: `flatStyle()` in `.superpowers/spike/flat-map/main.ts` (git-ignored spike; copy the values, not the structure).
- Map mode is stored in `localStorage` key `fitline.mapMode`, values `'map' | '3d'`, every read and write in try/catch, default `'map'`.
- Neighbourhoods are map-only: never in `trips.ts` `LEVELS`, `ALL_PLACES`, search, the place picker, forecasts or Explore targets.
- Planner URL changes use `replace`, except entering the spotlight, which pushes one history entry.
- All existing tests keep passing (`npm test`), and `npm run build` type-checks clean.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on a branch, not `main`.

## Review Focus

1. **Old links and trips.** A saved trip whose place is Tokyo (`prefecture:13`) or a ward, and links with `?view=prefecture:13`, must open without errors: Tokyo now shows neighbourhood bubbles, a ward still shows its pins. → tests in Task 3.
2. **Bad or stale `&spot=`.** An unknown id, or a spot whose attraction isn't under the viewed place, must not crash or show an empty spotlight. Unknown ids are ignored; a known one moves the view to the attraction's home. → tests in Task 7 (`readDayView`) and Task 3 (`attractionHome`).
3. **Storage that throws or holds junk.** In private mode `localStorage` throws, or the value is `"banana"`: the map stays on Map mode and the toggle still works for the session. → test in Task 4.
4. **The in-view list before the map reports.** Until the first view quad arrives (map loading, or it failed), the list shows the full pool, not "0 in view". → test in Task 6.
5. **Moving between neighbours.** Clicking neighbour after neighbour then pressing Back once leaves the spotlight entirely; it doesn't step back through each neighbour. Crossing into another neighbourhood switches the crumb, and the in-view list stays frozen. → test in Task 5 (`spotHistory`) plus the browser checks in Tasks 7 and 10.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `src/data/neighbourhoods.ts` | create | The 16 Tokyo neighbourhoods: id, names, centre, radius |
| `src/data/types.ts` | modify | `Attraction.neighbourhood` |
| `src/data/attractions.ts` | modify | `neighbourhood` on all 16; 14 new mock attractions |
| `photos-src/`, `public/photos/`, `src/data/photo-credits.json` | modify | Photos for the 14 new attractions (gated on the user's approval) |
| `src/lib/trips.ts` | modify | `PlaceRef.level` gains `'neighbourhood'`; `LEVELS` does not |
| `src/lib/tripPlaces.ts` | modify | label, attractions, cover, view for neighbourhoods |
| `src/lib/placeTree.ts` | modify | Tokyo → neighbourhoods; `pinsFor` |
| `src/lib/browse.ts` | modify | `browsePool` via `pinsFor`; `inView` |
| `src/lib/mapMode.ts` | create | Read, write and share the Map/3D choice |
| `src/map/style.ts` | modify | `applyMode(map, mode)` and the flat palette |
| `src/map/camera.ts` | modify | `viewQuad` |
| `src/lib/spotlight.ts` | create | `metres`, `neighboursOf`, `spotZoom`, `spotHistory` |
| `src/map/MapExplorer.tsx` | modify | Mode toggle, `focus`, `onViewQuad`, spotlight markers |
| `src/components/AttractionMap.tsx` | modify | Always Map mode |
| `src/lib/dayView.ts` | modify | `spot` in the day view |
| `src/pages/Planner.tsx` | modify | Wiring: frames, spotlight, in-view, crumbs |
| `src/components/planner/DayStrip.tsx` | create | Folded day strip |
| `src/components/planner/DayList.tsx`, `Browse.tsx` | modify | Strip while browsing; "N in view" header |
| `src/styles.css` | modify | Toggle, spotlight markers, strip |
| `kb/data/curated/JP.txt`, `kb/scripts/build_places.py`, `kb/scripts/check.py`, `kb/fitline-places.xlsx` | modify | Neighbourhood level in the knowledge base |

---

### Task 1: Neighbourhood data and more mock attractions

**Files:**
- Create: `src/data/neighbourhoods.ts`
- Modify: `src/data/types.ts`, `src/data/attractions.ts`
- Test: `src/data/neighbourhoods.test.ts`, `src/data/attractions.test.ts`, plus count updates in existing tests (`src/lib/placeTree.test.ts` `countFor(...)).toBe(16)` and any others `npm test` flags)

**Interfaces:**
- Produces:
  - `export interface Neighbourhood { id: string; name: string; ja: string; center: [number, number]; radiusM: number }`
  - `export const NEIGHBOURHOODS: Neighbourhood[]` (display order = the list below)
  - `export const neighbourhoodById: (id: string) => Neighbourhood | undefined`
  - `Attraction.neighbourhood: string` (a `NEIGHBOURHOODS` id)

The 16 neighbourhoods (id suffix → English name), with the existing attractions they hold:

| id | name | existing attractions |
|---|---|---|
| `JP-N-TOKYO-SHIBUYA` | Shibuya | shibuya-sky |
| `JP-N-TOKYO-HARAJUKU` | Harajuku & Omotesandō | meiji-jingu |
| `JP-N-TOKYO-SHINJUKU` | Shinjuku | golden-gai |
| `JP-N-TOKYO-ASAKUSA` | Asakusa | senso-ji |
| `JP-N-TOKYO-UENO` | Ueno | tokyo-national-museum |
| `JP-N-TOKYO-YANAKA` | Yanaka | yanaka-ginza |
| `JP-N-TOKYO-GINZA` | Ginza & Tsukiji | tsukiji-outer-market |
| `JP-N-TOKYO-ODAIBA` | Odaiba & Toyosu | teamlab-planets |
| `JP-N-TOKYO-OSHIAGE` | Oshiage | tokyo-skytree |
| `JP-N-TOKYO-RYOGOKU` | Ryōgoku | ryogoku-sumo |
| `JP-N-TOKYO-KIYOSUMI` | Kiyosumi | kiyosumi-gardens |
| `JP-N-TOKYO-SHIMOKITAZAWA` | Shimokitazawa | shimokitazawa |
| `JP-N-TOKYO-NAKANO` | Nakano | nakano-broadway |
| `JP-N-TOKYO-SETAGAYA` | Setagaya | todoroki-valley |
| `JP-N-TOKYO-MITAKA` | Mitaka & Kichijōji | ghibli-museum |
| `JP-N-TOKYO-TAKAO` | Takao | mount-takao |

The 14 new mock attractions (id, name, ward code, neighbourhood, lonlat). Real places; every field of `Attraction` filled with believable values at the same quality bar as the existing 16 (blurb, notes, hours, crowd curve via `crowd()`, cost, station, etiquette where relevant):

| id | name | area | neighbourhood | lonlat |
|---|---|---|---|---|
| `shibuya-crossing` | Shibuya Scramble Crossing | 13113 | SHIBUYA | [139.7005, 35.6595] |
| `miyashita-park` | Miyashita Park | 13113 | SHIBUYA | [139.7020, 35.6620] |
| `nonbei-yokocho` | Nonbei Yokochō | 13113 | SHIBUYA | [139.7036, 35.6590] |
| `takeshita-street` | Takeshita Street | 13113 | HARAJUKU | [139.7031, 35.6716] |
| `yoyogi-park` | Yoyogi Park | 13113 | HARAJUKU | [139.6949, 35.6717] |
| `cat-street` | Cat Street | 13113 | HARAJUKU | [139.7065, 35.6650] |
| `ota-memorial-museum` | Ota Memorial Museum of Art | 13113 | HARAJUKU | [139.7046, 35.6695] |
| `nezu-museum` | Nezu Museum | 13103 | HARAJUKU | [139.7174, 35.6623] |
| `shinjuku-gyoen` | Shinjuku Gyoen | 13104 | SHINJUKU | [139.7100, 35.6852] |
| `omoide-yokocho` | Omoide Yokochō | 13104 | SHINJUKU | [139.6994, 35.6930] |
| `tocho-observatory` | Tokyo Metropolitan Government Building observatories | 13104 | SHINJUKU | [139.6917, 35.6896] |
| `kappabashi` | Kappabashi Kitchen Town | 13106 | ASAKUSA | [139.7880, 35.7140] |
| `sumida-park` | Sumida Park | 13106 | ASAKUSA | [139.8015, 35.7135] |
| `hanayashiki` | Hanayashiki | 13106 | ASAKUSA | [139.7951, 35.7158] |

Centres and radii are the builder's call: each radius large enough that every attraction in the neighbourhood is within it.

- [ ] **Step 1: Write the failing tests** in `src/data/neighbourhoods.test.ts`:

```ts
test('16 neighbourhoods with unique JP-N-TOKYO ids', () => {
  expect(NEIGHBOURHOODS).toHaveLength(16);
  expect(new Set(NEIGHBOURHOODS.map((n) => n.id)).size).toBe(16);
  for (const n of NEIGHBOURHOODS) expect(n.id).toMatch(/^JP-N-TOKYO-[A-Z]+$/);
});
test('every attraction belongs to a known neighbourhood, within its radius', () => {
  for (const a of ATTRACTIONS) {
    const n = neighbourhoodById(a.neighbourhood);
    expect(n, a.id).toBeDefined();
    expect(metresBetween(a.lonlat, n!.center), a.id).toBeLessThanOrEqual(n!.radiusM);
  }
});
test('every neighbourhood holds at least one attraction', () => {
  for (const n of NEIGHBOURHOODS) expect(ATTRACTIONS.some((a) => a.neighbourhood === n.id), n.id).toBe(true);
});
test('30 attractions; Harajuku holds 6', () => {
  expect(ATTRACTIONS).toHaveLength(30);
  expect(ATTRACTIONS.filter((a) => a.neighbourhood === 'JP-N-TOKYO-HARAJUKU')).toHaveLength(6);
});
```

(`metresBetween` is a small haversine helper local to this test file; Task 5 adds the shared `metres` later.) Also add to `attractions.test.ts`: ids are unique; each new attraction has 18 crowd values per curve, 7 hours entries, 12 months.

- [ ] **Step 2: Run `npx vitest run src/data` — expect FAIL** (module not found).
- [ ] **Step 3: Implement** `neighbourhoods.ts`, add `neighbourhood: string` to `Attraction` in `types.ts` (doc comment: "Its neighbourhood id, from data/neighbourhoods"), add `neighbourhood` to the 16, and add the 14 attractions.
- [ ] **Step 4: Run `npm test`** — fix the count assertions that change from 16 to 30 (e.g. `countFor(JAPAN)`), and only those. Expect PASS. Run `npx tsc -b` — expect no errors.
- [ ] **Step 5: Commit** `feat: Tokyo neighbourhoods and 14 more mock attractions`.

New attractions have no photos yet; Task 2 adds them. Until then their `<img>` 404s in the browser. That's expected, and nothing to fix in this task.

---

### Task 2: Photos for the new attractions (needs the user's approval before any download)

**Files:**
- Modify: `photos-src/<id>.jpg` (14 new), `photos-src/credits.json`, then generated `public/photos/<id>-720.webp`, `<id>-1600.webp`, `src/data/photo-credits.json`

**Interfaces:**
- Consumes: Task 1's 14 ids. `photo(id)` in `src/lib/photos.ts` already resolves `/photos/<id>-720.webp`.

- [ ] **Step 1: Shortlist.** For each of the 14, find one Wikimedia Commons photo with a CC0, CC BY or CC BY-SA licence. Record: Commons file page, licence, author, and the original's file size.
- [ ] **Step 2: Ask the user.** List the 14 as filename, source page, licence and size. Download nothing until they say yes.
- [ ] **Step 3: Download (after the yes)** each to `photos-src/<id>.jpg`, and add a credits entry with the same fields as the existing entries in `photos-src/credits.json`.
- [ ] **Step 4: Run `node scripts/build-photos.mjs`** — expect `ok <id>` for each, and 28 new webp files in `public/photos/`.
- [ ] **Step 5: Run `npm test`** — expect PASS. The Credits page lists the new photos.
- [ ] **Step 6: Commit** `feat: photos for the new Tokyo attractions`.

If the user declines, skip this task and tell them the new attractions show without photos.

---

### Task 3: Neighbourhoods in the place tree

**Files:**
- Modify: `src/lib/trips.ts:4` (type only), `src/lib/tripPlaces.ts`, `src/lib/placeTree.ts`, `src/lib/browse.ts`
- Test: `src/lib/placeTree.test.ts`, `src/lib/tripPlaces.test.ts`, `src/lib/trips.test.ts`, `src/lib/browse.test.ts`

**Interfaces:**
- Consumes: `NEIGHBOURHOODS`, `neighbourhoodById`, `Attraction.neighbourhood` (Task 1)
- Produces:
  - `PlaceRef = { level: 'country' | 'region' | 'prefecture' | 'area' | 'neighbourhood'; id: string }`. `trips.ts` `LEVELS` stays the 4 old levels, with a comment that neighbourhoods are map-only.
  - `placeLabel(nbhd)` → `{ name, local: ja, kind: 'Tokyo neighbourhood' }`
  - `attractionsIn(nbhd)` → attractions whose `neighbourhood === id`
  - `placeView(nbhd)` → `{ target: <Tokyo region target>, focusPrefs: null, frame: Bounds }`. `placeView` gains an optional `frame?: Bounds` (`Bounds` from `src/map/camera.ts`): the neighbourhood's circle as a box, grown if needed to hold all its attractions plus 150 m.
  - `placeCover(nbhd)` → first attraction's id
  - `placeTree`: `children(Tokyo)` = neighbourhood refs holding ≥1 attraction, in `NEIGHBOURHOODS` order; `parent(nbhd)` = Tokyo; `attractionLevel(Tokyo) = false`; `attractionLevel(nbhd) = true`; `attractionLevel(area) = true` (unchanged); `isKnownPlace`, `parseRefKey` (its `LEVELS` gains `'neighbourhood'`), `placeAnchor` (= centre) handle it.
  - `export function pinsFor(ref: PlaceRef): Attraction[]` in `placeTree.ts`: the map's pins at an attraction level. A neighbourhood → every attraction of its parent (all of Tokyo); another attraction level → `attractionsIn(ref)`; above → `[]`.
  - `browsePool(viewed, places)` uses `pinsFor(viewed)` at the attraction level.

- [ ] **Step 1: Write the failing tests.** In `placeTree.test.ts`, replace the "Tokyo is the attraction level…" test with:

```ts
const HARAJUKU: PlaceRef = { level: 'neighbourhood', id: 'JP-N-TOKYO-HARAJUKU' };
test('Tokyo has its neighbourhoods as children and is not the attraction level', () => {
  const n = nodeOf(TOKYO);
  expect(n.attractionLevel).toBe(false);
  expect(n.children).toHaveLength(16);
  expect(n.children[1]).toEqual(HARAJUKU);
  expect(nodeOf(HARAJUKU)).toMatchObject({ label: 'Harajuku & Omotesandō', attractionLevel: true, children: [] });
  expect(parentOf(HARAJUKU)).toEqual(TOKYO);
});
test('pathTo a neighbourhood: Japan, Kantō, Tokyo, Harajuku', () => {
  expect(pathTo(HARAJUKU)).toEqual([JAPAN, KANTO, TOKYO, HARAJUKU]);
});
test('a ward stays an attraction level under Tokyo', () => {
  expect(nodeOf(TAITO)).toMatchObject({ attractionLevel: true, children: [] });
  expect(pathTo(TAITO)).toEqual([JAPAN, KANTO, TOKYO, TAITO]);
});
test('pinsFor: a neighbourhood pins all of Tokyo; a ward its own; Tokyo none', () => {
  expect(pinsFor(HARAJUKU)).toHaveLength(30);
  expect(pinsFor(TAITO).every((a) => a.area === '13106')).toBe(true);
  expect(pinsFor(TOKYO)).toEqual([]);
});
test('parseRefKey reads neighbourhoods and rejects unknown ones', () => {
  expect(parseRefKey('neighbourhood:JP-N-TOKYO-HARAJUKU')).toEqual(HARAJUKU);
  expect(parseRefKey('neighbourhood:JP-N-TOKYO-NOWHERE')).toBeNull();
  expect(parseRefKey('prefecture:13')).toEqual(TOKYO); // old links still parse
});
test('attractionHome finds the neighbourhood from a Tokyo trip place', () => {
  expect(attractionHome('meiji-jingu', [TOKYO], TOKYO, TOKYO)).toEqual(HARAJUKU);
  expect(attractionHome('shibuya-sky', [TOKYO], TOKYO, HARAJUKU)).toEqual({ level: 'neighbourhood', id: 'JP-N-TOKYO-SHIBUYA' });
  expect(attractionHome('senso-ji', [TAITO], TAITO, TAITO)).toEqual(TAITO); // ward trip place unchanged
});
test('placeAnchor of a neighbourhood is its centre', () => {
  expect(placeAnchor(HARAJUKU)).toEqual(neighbourhoodById('JP-N-TOKYO-HARAJUKU')!.center);
});
```

Fix the existing `attractionLevelFor`/`attractionHome` tests whose expectation was Tokyo itself, so they expect the neighbourhood instead. In `trips.test.ts`, a stored trip with a `neighbourhood` place fails validation the same way an unknown level does today. In `tripPlaces.test.ts`, add: `ALL_PLACES` has no neighbourhood; `placeView(HARAJUKU).frame` contains every Harajuku attraction; `placeLabel(HARAJUKU).kind === 'Tokyo neighbourhood'`. In `browse.test.ts`: `browsePool(HARAJUKU, [TOKYO])` has 30 entries.

- [ ] **Step 2: Run `npx vitest run src/lib` — expect FAIL.**
- [ ] **Step 3: Implement.** Widening the `PlaceRef` union makes TypeScript flag every non-exhaustive `switch (ref.level)`; handle each one (`placeLabel`, `placeCover`, `placeView`, `isKnownPlace`, `placeAnchor`, `HARD_CODED.parent`). Run `npx tsc -b` until clean. Search `src/` for other `level ===` / `switch` on `PlaceRef.level` (PlacePicker, TripBar, PlaceSwitcher, Explore) and make sure nothing there can receive a neighbourhood. They only see trip places, so a type-narrowing guard is enough.
- [ ] **Step 4: Run `npm test`** — expect PASS.
- [ ] **Step 5: Commit** `feat: neighbourhood level under Tokyo in the planner tree`.

---

### Task 4: Map / 3D mode and the flat palette

**Files:**
- Create: `src/lib/mapMode.ts`, `src/lib/mapMode.test.ts`, `src/map/style.test.ts`
- Modify: `src/map/style.ts`, `src/map/MapExplorer.tsx` (tilt state, button, `flyToTarget`), `src/components/AttractionMap.tsx`, `src/styles.css` (`.map-tilt` → `.map-mode`)

**Interfaces:**
- Produces:
  - `export type MapMode = 'map' | '3d'`
  - `export function readMapMode(store?: Pick<Storage, 'getItem'>): MapMode` (default `window.localStorage`; returns `'map'` on a throw or an unknown value)
  - `export function writeMapMode(mode: MapMode, store?: Pick<Storage, 'setItem'>): void` (swallows throws; dispatches `window` event `'fl-map-mode'`)
  - `export function useMapMode(): [MapMode, (m: MapMode) => void]`: shared across every mounted map through the event, kept in memory when storage throws.
  - `export function applyMode(map: MapLibreMap, mode: MapMode): void` in `style.ts`. Idempotent and switchable both ways with no `setStyle` and no reload: it sets every paint/layout property either mode touches, adds the extra layers once (`g-minor-case`, `g-landuse`, `g-stations`, plus the existing `fl-buildings` and `fl-relief`) and toggles their visibility. Map mode: flat palette (Global Constraints), `fl-buildings` hidden, road names (`highway-name-*`) visible, shields hidden, relief kept. 3D: exactly today's `restyle` look.
  - `restyle(map, sky?)` stays the one-time setup on `style.load`. It now ends by calling `applyMode(map, mode)`, and takes `mode` as a third parameter, default `'3d'`.

- [ ] **Step 1: Write the failing tests.**

`mapMode.test.ts`:
```ts
test('defaults to map; reads a stored 3d', () => {
  expect(readMapMode({ getItem: () => null })).toBe('map');
  expect(readMapMode({ getItem: () => '3d' })).toBe('3d');
});
test('junk or a throwing store reads as map', () => {
  expect(readMapMode({ getItem: () => 'banana' })).toBe('map');
  expect(readMapMode({ getItem: () => { throw new Error('denied'); } })).toBe('map');
});
test('write survives a throwing store', () => {
  expect(() => writeMapMode('3d', { setItem: () => { throw new Error('quota'); } })).not.toThrow();
});
```

`style.test.ts`: build a fake map whose `getStyle()` returns `{ sources: { openmaptiles: { type: 'vector' }, ne2_shaded: { type: 'raster' } }, layers: [...] }`, with layers `background`, `water`, `park`, `landcover_wood`, `landuse_residential`, `building`, `highway_minor`, `highway_major_inner`, `highway_motorway_inner`, `highway-name-minor`, `label_city`. It records `setPaintProperty`, `setLayoutProperty`, `addLayer`, `getLayer`, `setLight` and `setSky` into plain objects:
```ts
test('map mode paints the flat palette and hides 3D buildings', () => {
  const m = fakeMap(); restyle(m as never, undefined, 'map');
  expect(m.paint.background['background-color']).toBe('#f5f5f3');
  expect(m.paint.water['fill-color']).toBe('#9fd3ef');
  expect(m.paint.highway_motorway_inner['line-color']).toBe('#fde59a');
  expect(m.layout['fl-buildings'].visibility).toBe('none');
  expect(m.layout['highway-name-minor'].visibility).toBe('visible');
});
test('switching map → 3d → map ends identical and adds no layer twice', () => {
  const m = fakeMap(); restyle(m as never, undefined, 'map');
  const first = JSON.stringify([m.paint, m.layout]);
  applyMode(m as never, '3d');
  expect(m.paint.background['background-color']).toBe('#eef2f4');
  expect(m.layout['fl-buildings'].visibility).toBe('visible');
  applyMode(m as never, 'map');
  expect(JSON.stringify([m.paint, m.layout])).toBe(first);
  expect(new Set(m.added).size).toBe(m.added.length);
});
```

- [ ] **Step 2: Run `npx vitest run src/lib/mapMode.test.ts src/map/style.test.ts` — expect FAIL.**
- [ ] **Step 3: Implement `mapMode.ts` and `applyMode`.**
- [ ] **Step 4: Wire `MapExplorer`.** Replace `const [tilted, setTilted] = useState(true)` with `const [mode, setMode] = useMapMode(); const tilted = mode === '3d';`. Read the mode in a ref in `style.load` and pass it to `restyle`. An effect on `[mode, ready]` calls `applyMode(map, mode)` and eases pitch/bearing as `toggleTilt` does today (52/−15 or 0/0). `flyToTarget`'s `tilt` default follows the mode. Replace the `2D`/`3D` button with a two-button group `.map-mode`, labelled "Map" and "3D", `aria-pressed` on the active one and an `aria-label` of "Map style" on the group. It shows where the button showed before. `AttractionMap` calls `restyle(map, sky, 'map')`.
- [ ] **Step 5: Run `npm test` and `npx tsc -b`** — expect PASS. Then the browser check (preview "fitline", headless `shot.mjs` for map screenshots): `/map/japan/tokyo` opens flat with blue station names. Clicking 3D tilts and shows buildings. Reload keeps 3D, and the planner opens in 3D too.
- [ ] **Step 6: Commit** `feat: flat Google-style map by default, 3D remembered`.

---

### Task 5: Map focus, view quad and spotlight markers in MapExplorer

**Files:**
- Create: `src/lib/spotlight.ts`, `src/lib/spotlight.test.ts`
- Modify: `src/map/camera.ts`, `src/map/camera.test.ts`, `src/lib/browse.ts`, `src/lib/browse.test.ts`, `src/map/MapExplorer.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `Bounds`, `Insets` (camera.ts); `useMapMode` (Task 4)
- Produces:
  - `spotlight.ts`:
    - `export const NEAR_M = 800`
    - `export function metres(a: [number, number], b: [number, number]): number` (haversine, R = 6371000)
    - `export function neighboursOf(id: string, pool: Attraction[]): string[]`: ids within `NEAR_M` of `id`, excluding it, nearest first; `[]` when `id` isn't in the pool
    - `export function spotZoom(width: number): number`: 16 when width ≥ 761, 15.5 otherwise
    - `export function spotHistory(wasSpot: string | null, nextSpot: string | null): 'push' | 'replace'`: `'push'` only when entering from no spot (null → id); every other change is `'replace'`
  - `camera.ts`: `export type Quad = [number, number][]` (4 lon/lat corners, clockwise from top-left) and `export function viewQuad(W: number, H: number, insets: Insets, unproject: (p: [number, number]) => [number, number]): Quad`: corners of the free rectangle `[insets.left, insets.top] → [W − insets.right, H − insets.bottom]`, unprojected.
  - `browse.ts`: `export function inView(list: Attraction[], quad: Quad | null): Attraction[]`, point-in-polygon on `lonlat`; `quad === null` returns `list` unchanged.
  - `MapExplorer` props:
    - `focus?: MapFocus | null` with `export type MapFocus = { kind: 'frame'; key: string; bounds: Bounds } | { kind: 'spot'; key: string; id: string; center: [number, number]; near: string[] }`
    - `onViewQuad?: (q: Quad) => void`: called on every `moveend` and once when ready, with `viewQuad(W, H, insets, p => map.unproject(p).toArray())`.

**Behaviour to build in MapExplorer:**
- `focus.key` joins `camKey`. With a `frame` focus, `flyToTarget` frames `focus.bounds` (pitch/bearing from the mode as the `area` level does today, `maxZoom` 16) instead of the target's bounds.
- With a `spot` focus, the camera is pitch 0, bearing 0, centre `focus.center`, zoom `spotZoom(W)`, and `padding: { ...insets }`, so the spot is centred in the free area. Before the first spot of a run (previous focus not a spot), save the camera `{ center, zoom, pitch, bearing }`. When focus goes from a spot back to the same non-spot key, fly back to the saved camera instead of re-framing. Later framings reset `padding` to `NO_PAD` as today.
- Dot mode with a spot focus:
  - the spot's dot renders as a name pill `.mdot.is-spot` with a pointer tail (look: `.pick` in the spike's `index.html`)
  - ids in `near` get `.is-near` and always show their label
  - every other dot gets `.is-far`: small grey, no label, still clickable
  - today's numbered stops keep their number, and lose their label when far
- `pickedClearOf` panning is skipped while a spot focus is set: the spot is already centred clear of the panels.

- [ ] **Step 1: Write the failing tests.**

`spotlight.test.ts` (uses `ATTRACTIONS`):
```ts
test('metres: Shibuya Sky to Scramble Crossing is about 200 m', () => {
  expect(metres([139.7022, 35.6585], [139.7005, 35.6595])).toBeGreaterThan(150);
  expect(metres([139.7022, 35.6585], [139.7005, 35.6595])).toBeLessThan(260);
});
test('neighboursOf Shibuya Sky: crossing, Miyashita, Nonbei within 800 m; Meiji Jingu not', () => {
  const n = neighboursOf('shibuya-sky', ATTRACTIONS);
  expect(n).toEqual(expect.arrayContaining(['shibuya-crossing', 'miyashita-park', 'nonbei-yokocho']));
  expect(n).not.toContain('meiji-jingu');
  expect(n).not.toContain('shibuya-sky');
  expect(n[0]).toBe('shibuya-crossing'); // nearest first
});
test('neighboursOf crosses neighbourhoods: Cat Street is near Miyashita Park', () => {
  expect(neighboursOf('miyashita-park', ATTRACTIONS)).toContain('cat-street');
});
test('neighboursOf an unknown id is empty', () => expect(neighboursOf('nope', ATTRACTIONS)).toEqual([]));
test('spotZoom by width', () => { expect(spotZoom(1280)).toBe(16); expect(spotZoom(390)).toBe(15.5); });
test('spotHistory pushes only on entering', () => {
  expect(spotHistory(null, 'a')).toBe('push');
  expect(spotHistory('a', 'b')).toBe('replace');
  expect(spotHistory('a', null)).toBe('replace');
  expect(spotHistory(null, null)).toBe('replace');
});
```

`camera.test.ts`:
```ts
test('viewQuad unprojects the free rectangle corners clockwise from top-left', () => {
  const q = viewQuad(1000, 600, { top: 50, right: 400, bottom: 0, left: 0 }, ([x, y]) => [x, -y]);
  expect(q).toEqual([[0, -50], [600, -50], [600, -600], [0, -600]]);
});
```

`browse.test.ts`:
```ts
test('inView keeps attractions inside the quad; null quad keeps all', () => {
  const quad: Quad = [[139.69, 35.68], [139.71, 35.68], [139.71, 35.66], [139.69, 35.66]];
  const ids = inView(ATTRACTIONS, quad).map((a) => a.id);
  expect(ids).toContain('shibuya-sky');
  expect(ids).not.toContain('senso-ji');
  expect(inView(ATTRACTIONS, null)).toHaveLength(ATTRACTIONS.length);
});
```

- [ ] **Step 2: Run `npx vitest run src/lib/spotlight.test.ts src/map/camera.test.ts src/lib/browse.test.ts` — expect FAIL.**
- [ ] **Step 3: Implement** `spotlight.ts`, `viewQuad`, `inView`.
- [ ] **Step 4: Run the same tests — expect PASS.**
- [ ] **Step 5: Implement the MapExplorer behaviour above, plus CSS** for `.mdot.is-spot`, `.is-near`, `.is-far` and `.map-mode`, using the palette tokens already in `styles.css`. `npx tsc -b` clean; `npm test` PASS.
- [ ] **Step 6: Commit** `feat: map focus, view quad and spotlight markers`.

---

### Task 6: Planner — neighbourhood frames and the in-view list

**Files:**
- Modify: `src/pages/Planner.tsx`, `src/components/planner/Browse.tsx`
- Test: `src/lib/browse.test.ts`

**Interfaces:**
- Consumes: `pinsFor`, `placeView(...).frame` (Task 3); `inView`, `Quad`, `MapFocus`, `onViewQuad` (Task 5)
- Produces:
  - `export function browseList(pool: Attraction[], quad: Quad | null, attractionLevel: boolean): { list: Attraction[]; inView: number | null }` in `browse.ts`. At the attraction level it returns `inView(pool, quad)` with `inView` = its length, or the pool with `inView: null` while `quad` is null. Above the attraction level it returns the pool with `inView: null`.
  - `Browse` prop `inViewCount?: number | null`. When it's a number, the header reads `"{n} in view"` with a muted "· move the map to update". At 0 the empty state reads "Nothing in view here. Zoom out or move the map." Otherwise the header is unchanged.

- [ ] **Step 1: Write the failing test** in `browse.test.ts`:

```ts
const SHIBUYA_QUAD: Quad = [[139.69, 35.68], [139.71, 35.68], [139.71, 35.66], [139.69, 35.66]];
test('browseList: full pool until the map reports; then only what is in view', () => {
  expect(browseList(ATTRACTIONS, null, true)).toEqual({ list: ATTRACTIONS, inView: null });
  const r = browseList(ATTRACTIONS, SHIBUYA_QUAD, true);
  expect(r.inView).toBe(r.list.length);
  expect(r.list.map((a) => a.id)).toContain('shibuya-sky');
  expect(browseList(ATTRACTIONS, SHIBUYA_QUAD, false)).toEqual({ list: ATTRACTIONS, inView: null });
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement `browseList`; run — expect PASS.**
- [ ] **Step 4: Wire the planner:**
  - `pins` = `pinsFor(viewed)`.
  - `focus` = `{ kind: 'frame', key: viewKey, bounds: view.frame }` when `view.frame` is set (a neighbourhood); the spot focus comes in Task 7.
  - Keep `const [quad, setQuad] = useState<Quad | null>(null)`, reset to `null` when `viewKey` changes. Pass `onViewQuad={setQuad}` (ignored while a spot is open; Task 7).
  - The Browse pool = `browseList(pool, quad, !!node?.attractionLevel)`.
  - The Plan/Browse tab label reads `Browse · {n}` when `inView` is a number.
  - Search `scope` at a neighbourhood covers `pins` (all of Tokyo).
- [ ] **Step 5: Run `npm test`, `npx tsc -b`.** Browser check on laptop: in a Tokyo trip, Tokyo shows neighbourhood bubbles. Clicking Harajuku frames it, flat in Map mode, and Browse lists only what's on screen. Panning into Shibuya updates the list after the map stops, while the crumb stays on Harajuku. Crumb Tokyo zooms back out to the bubbles.
- [ ] **Step 6: Commit** `feat: neighbourhood frames and in-view browsing in the planner`.

---

### Task 7: Planner — the spotlight

**Files:**
- Modify: `src/lib/dayView.ts`, `src/lib/dayView.test.ts`, `src/pages/Planner.tsx`

**Interfaces:**
- Consumes: `neighboursOf`, `spotHistory` (Task 5); `attractionHome` (Task 3); `MapFocus` (Task 5)
- Produces: `DayView.spot: string | null`. `readDayView` returns the `&spot=` id only when `attractionById(id)` exists, else null. `writeDayView({ spot })` sets or deletes `spot`.

**Behaviour:**
- `selected` (the open card) is the URL's `spot`, not local state. Opening any card goes through `openStop(sid)`: map dot click, Browse row, day list, wet plan, search, and "See it on the map". It finds `home = attractionHome(...)` and writes `view` (when it changes) and `spot` in **one** `setParams`, with `{ replace: spotHistory(currentSpot, sid) === 'replace' }`. The map's `onAttraction` calls `openStop`, not `setSelected`.
- The laptop hover preview (`peekId`) stays local and never spotlights.
- A spot is shown only when `viewed` is an attraction level and the spot's home under the current trip place's tree is reachable. On load or reload with a `spot` whose home differs from `viewed`, write the home's `view` with `replace`. When it has no home in any trip place, drop `spot` with `replace`.
- `focus` = `{ kind: 'spot', key: 'spot:' + id, id, center: a.lonlat, near: neighboursOf(id, pins) }` while a spot is open, else the Task 6 frame focus or none.
- While a spot is open, `onViewQuad` results are ignored, so the in-view list keeps its rows and scroll.
- Leaving: the card's close, Esc (the existing Escape handler's `selected` branch), and a click on any crumb all clear `spot`. If this page pushed the entry for the current spot run (a ref set when `spotHistory` said push), leave with `navigate(-1)`; otherwise `replace`. A crumb other than the neighbourhood also sets `view` after leaving. The browser's Back leaves on its own because of the push.
- Breadcrumb: while a spot is open, the attraction's name is the last, current crumb, and the viewed place becomes a button that leaves the spotlight.

- [ ] **Step 1: Write the failing tests** in `dayView.test.ts`:

```ts
test('spot reads a known attraction id and ignores unknown ones', () => {
  expect(readDayView(new URLSearchParams('spot=meiji-jingu')).spot).toBe('meiji-jingu');
  expect(readDayView(new URLSearchParams('spot=nope')).spot).toBeNull();
  expect(readDayView(new URLSearchParams('')).spot).toBeNull();
});
test('writeDayView sets and clears spot, keeping the rest', () => {
  const q = writeDayView(new URLSearchParams('day=2&tab=browse'), { spot: 'cat-street' });
  expect(q.get('spot')).toBe('cat-street');
  expect(q.get('tab')).toBe('browse');
  expect(writeDayView(q, { spot: null }).has('spot')).toBe(false);
});
```

- [ ] **Step 2: Run `npx vitest run src/lib/dayView.test.ts` — expect FAIL; implement; expect PASS.**
- [ ] **Step 3: Implement the planner behaviour above.** `npx tsc -b` clean; `npm test` PASS.
- [ ] **Step 4: Browser check (laptop 1280×800 and phone 390×844):**
  - Click Meiji Jingu's dot at Harajuku: the map goes flat and centred in the free area, with the dark name pill, labelled neighbours (Takeshita Street, Yoyogi Park, Ota Memorial…) and grey far dots. The crumb shows "… › Harajuku & Omotesandō › Meiji Jingu".
  - Click Cat Street, then Miyashita Park: the crumb switches to Shibuya.
  - Press Back once: you're out of the spotlight, the camera is back where it was, and the list and scroll are unchanged.
  - Reloading a `&spot=` URL lands in the spotlight. `&spot=nope` is ignored.
  - Phone: the pill sits above the sheet and the card shows.
- [ ] **Step 5: Commit** `feat: spotlight view on an attraction in the planner`.

---

### Task 8: The day folds to a strip while browsing

**Files:**
- Create: `src/components/planner/DayStrip.tsx`
- Modify: `src/components/planner/DayList.tsx`, `src/pages/Planner.tsx` (props only), `src/styles.css`

**Interfaces:**
- Consumes: `stopsOf`, `dayLabel` (DayList.tsx), `photo` (photos.ts)
- Produces: `export function DayStrip(props: { trip: Trip; day: number; onOpen: () => void; flashId?: string | null }): JSX.Element`. It's one button, with accessible name "Day {n}, {k} stops. Show the day plan". Inside: "Day {n}", then each stop as a 22×16 thumbnail with its number badge (in day order; the wet plan's stops when wet is on), then "Open ▾". `flashId` highlights that stop's thumbnail for 1.2 s (no animation under reduced motion).

**Behaviour:**
- In `DayList`, when `tab === 'browse'`, the day header block is replaced by `<DayStrip onOpen={() => onTab('plan')} …/>`: the day header, the times, the wet toggle, Analysis, the hint line and the sub-tab row. The Browse content fills the rest. The day dropdown above stays.
- When `tab === 'plan'`, everything renders as today. The Browse sub-tab shows the in-view count (Task 6).
- `flashId` is the id just added from Browse. The planner sets it in `add` and clears it after 1.2 s.
- Phone: the same inside the sheet. The strip is `position: sticky; top: 0` inside the sheet's scroller, so the list scrolls under it, and sheet dragging is unchanged.

- [ ] **Step 1: Build `DayStrip` and the DayList switch.** No new pure logic, so no unit test. Snapshot-free; the browser check below is the gate.
- [ ] **Step 2: Run `npm test`, `npx tsc -b`** — expect PASS.
- [ ] **Step 3: Browser check.**
  - Laptop: switch to Browse and the header folds to the strip; adding Takeshita Street flashes its new thumbnail; clicking the strip returns to Plan with the full header.
  - Phone 390×844: the strip stays pinned at the top of the sheet while the list scrolls, and the sheet still drags.
  - Compare against `.superpowers/brainstorm/1606-1793245105/content/browse-layout.html` option C.
- [ ] **Step 4: Commit** `feat: day folds to a strip while browsing`.

---

### Task 9: Neighbourhood level in the knowledge base

Independent of Tasks 2–8. It only needs Task 1's ids.

**Files:**
- Modify: `kb/data/curated/JP.txt`, `kb/scripts/build_places.py`, `kb/scripts/check.py`, `kb/data/*.csv` (generated), `kb/fitline-places.xlsx` (generated)

**Interfaces:**
- Consumes: the 16 ids and English names from Task 1's table (must match exactly).
- Produces: a curated line kind `N`, with syntax `N name | Neighbourhood | id=JP-N-TOKYO-X; q=<Wikidata search text>; note=...`, written under `= JP-P-TOKYO`. It's parsed like `P`, but with `is_planning_unit` empty and `kind` `travel`.

- [ ] **Step 1: Update `check.py`.** A planning unit may have children only when every child's `level_type` is `Neighbourhood`. Otherwise it reports `planning unit has children` as today. Neighbourhood rows must have a planning-unit parent (`"{id}: neighbourhood not under a planning unit"`).
- [ ] **Step 2: Add the `N` kind** to `build_places.py` and the 16 lines to `JP.txt`, with the header comment line documenting `N`.
- [ ] **Step 3: Build** with `python kb/scripts/build_places.py`, then `python kb/scripts/build_workbook.py`. The Excel lock file `kb/~$fitline-places.xlsx` means the workbook may be open in Excel. If the write fails, ask the user to close Excel, then rerun.
- [ ] **Step 4: Run `python kb/scripts/check.py`** — expect no problems, and the planning-unit depths unchanged. Run `python -c` to confirm the 16 `JP-N-TOKYO-*` ids in `kb/data/places.csv` equal `NEIGHBOURHOODS` ids (read the TS file with a regex).
- [ ] **Step 5: Commit** `feat(kb): Tokyo neighbourhood level`.

---

### Task 10: Whole-feature check

- [ ] **Step 1:** `npm test` and `npm run build`: all pass.
- [ ] **Step 2:** Browser walk-through, laptop 1280×800 then phone 390×844 (headless `shot.mjs` screenshots for map views):
  - Japan › Kantō › Tokyo › Harajuku › Meiji Jingu and back out by each crumb.
  - Map/3D toggle on Explore and the planner, persisting across reload.
  - An old Tokyo trip and a ward trip open fine.
  - The attraction page map card is flat.
  - The map credit stays visible and clear of panels.
- [ ] **Step 3:** Report what was checked and anything not covered (e.g. Task 2 skipped).
