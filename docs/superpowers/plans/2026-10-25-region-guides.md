# Region Guides Under the Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At Japan, Tokyo and ward level, show a sub-region list beside the map (linked both ways on hover). Scrolling down slides region guides up over the fixed map, and scrolling back up returns to the map. The separate Japan and Tokyo pages are folded into these guides.

**Architecture:**
- `Explore` stops being a fixed, non-scrolling page:
  - The map and its overlays sit in a fixed stage.
  - At guide levels a `GuideSheet` follows as normal document content.
- A `useGuideScroll` hook drives the effects from the scroll position:
  - It runs Lenis on the window.
  - It writes scroll progress to a CSS variable (`--gp`), so the effects never re-render React.
  - It settles to the nearer end when the scroll stops halfway.
- Pure logic is unit-tested with Vitest:
  - region data
  - attraction summaries
  - progress and settle maths
- UI tasks are checked by type-check, build and headless screenshots.

**Tech Stack:** Vite 8, React 19, TypeScript 7, react-router v7, MapLibre GL 6, motion, GSAP SplitText, Lenis, Swiper, d3-geo. New dev dependency: Vitest (tests only).

**Spec:** `docs/superpowers/specs/2026-10-25-region-guides-design.md`

## Global Constraints

- No new runtime dependencies. Vitest is the only new package, and it is dev-only.
- The map instance must not be rebuilt between levels: `Explore` stays the single layout route in `src/App.tsx`.
- `prefers-reduced-motion`: no chevron nudge, no map scale; the transition becomes a plain scroll.
- OpenStreetMap attribution stays visible at every scroll position.
- Phone breakpoint is `max-width: 760px`, matching `useMedia('(max-width: 760px)')` and the existing CSS.
- Exact copy from the spec:
  - Sheet heading at Japan: "Which part of Japan fits you?"
  - Sheet heading at Tokyo: "Which part of Tokyo fits you?"
  - Cue: "Scroll for region guides"
  - Sticky bar: "Japan · 8 regions" / "Back to map"
  - Rough-data label: "Rough guide"
  - Japan button: "See region guides"
  - Wheel hint: "Scrolling shows the guides. Use Ctrl + scroll to zoom the map."
- Peek height: 90px. Settle threshold: p < 0.5 goes to the top, otherwise to the guides. Nudge after about 3 s without interaction, once.
- Map at p = 1: brightness 0.6, scale 0.97. Title card and list panel are fully faded by p = 0.4.
- New photos need the user's OK on a list (filename, source, size) before downloading. Until then, region cards show a neutral placeholder.
- After every task: `npx tsc -b` exits 0 and `npm run build` succeeds.
- Screenshot checks:
  - Run `node C:\Users\fooya\AppData\Local\Temp\claude\C--projects-travel-app\76e40c19-ea28-43e8-81fd-bba8ffb081f9\scratchpad\shot.mjs <url> <out.jpg> [w] [h] [waitMs] [js]` against the dev server on port 5174.
  - Sizes: 1440×900, 1280×800 and 390×844.
  - The in-app browser pane pauses animation frames, so the map won't render there.
- Don't push. Commit locally only after the user has said the earlier uncommitted work may be committed.

## Review Focus

1. **Changing level while scrolled down** (e.g. clicking a guide card, or browser back): the page returns to the top before the map flies, and the next level's sheet starts at the peek. Tested in Task 3: `resets scroll on level change`.
2. **Wheel at world level and on embedded or other maps**: the globe still zooms on the wheel and only guide levels pass the wheel to the page. Tested in Task 3: `wheelScrollsPage=false keeps scroll zoom`.
3. **A ward or region with no matching attractions under the active filter**: the summary must not crash or print NaN, and the card shows "Nothing matches this filter". Tested in Task 1: `summarize([])`.
4. **Deep links with `#guides`** (`/japan` redirect, `/map/japan/tokyo/taito#guides`): the page lands on the guides once the map is ready, not before the sheet has height. Tested in Task 7.
5. **Window resize or phone rotation mid-scroll**: progress is recomputed from the new viewport height, with no stuck half-dim map. Tested in Task 2: `guideProgress` recomputes on resize; Task 3 screenshot at 1280×800 after a resize.

---

### Task 1: Test runner, region data and attraction summaries

**Files:**
- Modify: `package.json` (add `vitest` to devDependencies; script `"test": "vitest run"`)
- Create: `src/data/regions.ts`
- Create: `src/lib/summary.ts`
- Test: `src/data/regions.test.ts`, `src/lib/summary.test.ts`

**Interfaces:**
- Produces:
  - `type Effort = 'Easy' | 'Moderate' | 'Hard'`, `type Crowds = 'Quiet' | 'Busy' | 'Packed'`, `type Cost = 'Free' | '¥' | '¥¥' | '¥¥¥'`
  - `interface Summary { months: boolean[] /* 12, Jan first */; effort: Effort; crowds: Crowds; cost: Cost; count: number }`
  - `summarize(list: Attraction[]): Summary` in `src/lib/summary.ts`
  - `interface Region { id: string; name: string; ja: string; prefectures: number[]; oneLiner: string; photo: string | null; live: boolean; rough?: Summary }` in `src/data/regions.ts`
  - `REGIONS: Region[]`, ordered north to south: hokkaido, tohoku, kanto, chubu, kansai, chugoku, shikoku, kyushu-okinawa
  - `regionOfPref(code: number): Region | undefined`
  - `regionSummary(r: Region): Summary`: for a live region it returns `summarize(ATTRACTIONS)`, otherwise `r.rough!`
  - `prefName(code: number): string` (from `PREFECTURES`, ids `'01'`–`'47'` as numbers)

- [ ] **Step 1: Install Vitest and add the script**

Run: `npm i -D vitest` and add `"test": "vitest run"` to `scripts`.
Expected: `npx vitest --version` prints a version.

- [ ] **Step 2: Write the failing tests**

```ts
// src/data/regions.test.ts
test('every prefecture 1–47 belongs to exactly one region', () => {
  const all = REGIONS.flatMap((r) => r.prefectures).sort((a, b) => a - b);
  expect(all).toEqual(Array.from({ length: 47 }, (_, i) => i + 1));
});
test('region codes follow the spec', () => {
  const by = Object.fromEntries(REGIONS.map((r) => [r.id, r.prefectures]));
  expect(by.hokkaido).toEqual([1]);
  expect(by.tohoku).toEqual([2, 3, 4, 5, 6, 7]);
  expect(by.kanto).toEqual([8, 9, 10, 11, 12, 13, 14]);
  expect(by.chubu).toEqual([15, 16, 17, 18, 19, 20, 21, 22, 23]);
  expect(by.kansai).toEqual([24, 25, 26, 27, 28, 29, 30]);
  expect(by.chugoku).toEqual([31, 32, 33, 34, 35]);
  expect(by.shikoku).toEqual([36, 37, 38, 39]);
  expect(by['kyushu-okinawa']).toEqual([40, 41, 42, 43, 44, 45, 46, 47]);
});
test('only Kantō is live, and Tokyo is in it', () => {
  expect(REGIONS.filter((r) => r.live).map((r) => r.id)).toEqual(['kanto']);
  expect(regionOfPref(13)?.id).toBe('kanto');
});
test('coming-soon regions carry a rough summary with 12 months', () => {
  for (const r of REGIONS.filter((x) => !x.live)) expect(r.rough?.months).toHaveLength(12);
});
test('prefName reads the geo data', () => expect(prefName(13)).toBe('Tokyo'));
```

```ts
// src/lib/summary.test.ts (build tiny attractions with a helper that spreads ATTRACTIONS[0] and overrides fields)
test('month is good when at least half rate it good', ...)        // 2 of 4 good → true, 1 of 4 → false
test('effort from median level: 2→Easy, 3→Moderate, 4→Hard', ...)
test('crowds from mean weekend peak: 44→Quiet, 45→Busy, 70→Busy, 71→Packed', ...)
test('cost from median entry: 0→Free, 999→¥, 2999→¥¥, 3000→¥¥¥', ...)
test('summarize([]) is safe', () => {
  expect(summarize([])).toEqual({ months: Array(12).fill(false), effort: 'Easy', crowds: 'Quiet', cost: 'Free', count: 0 });
});
test('Tokyo summary is stable', () => expect(summarize(ATTRACTIONS).count).toBe(16));
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, modules `../data/regions` and `./summary` not found.

- [ ] **Step 4: Implement `summarize` and `src/data/regions.ts`**

- Weekend peak = the max of the non-null values in `vibe.crowds.weekend`.
- Median of an even-length list = the lower middle value, matching `median` in `MapExplorer.tsx`.
- `REGIONS`: Japanese names 北海道, 東北, 関東, 中部, 関西, 中国, 四国, 九州・沖縄.
- Kantō: `photo: 'shibuya-sky'`, `live: true`. The other regions: `photo: null`, with plausible `rough` summaries and plain, well-known one-liners (the builder writes these).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 11 tests. `npx tsc -b` exits 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/data/regions.ts src/data/regions.test.ts src/lib/summary.ts src/lib/summary.test.ts
git commit -m "feat: add Japan regions data and attraction summaries"
```

---

### Task 2: Scroll progress and settle

**Files:**
- Create: `src/lib/useGuideScroll.ts`
- Test: `src/lib/useGuideScroll.test.ts`

**Interfaces:**
- Produces:
  - `PEEK = 90`
  - `guideProgress(scrollY: number, viewportH: number, peek: number, barH: number): number`
    - Returns `clamp(scrollY / (viewportH - peek - barH), 0, 1)`.
    - Returns 0 when the denominator is ≤ 0.
  - `settleTarget(p: number): 'top' | 'guides' | null`
    - `null` when p ≤ 0.001 or p ≥ 0.999.
    - Otherwise `'top'` if p < 0.5, else `'guides'`.
  - `useGuideScroll(opts: { enabled: boolean; root: RefObject<HTMLElement>; barH: number; levelKey: string }): { scrollToGuides(): void; scrollToTop(): void; atGuides: boolean }`
    - When enabled, creates `new Lenis({ autoRaf: true, lerp: 0.11 })` (same settings as `src/pages/Attraction.tsx`) and destroys it when disabled or unmounted.
    - On each Lenis scroll, writes `--gp` on `root` with 3 decimals.
    - After 160 ms with no scroll event, eases to `settleTarget`: 0 for `'top'`, the guides offset for `'guides'`.
    - `atGuides` becomes true when p ≥ 0.999. It's React state, changed only when it flips.
    - When `levelKey` changes: jump to the top immediately and reset `--gp` to 0.
    - Recompute on `resize`.
    - Under reduced motion: Lenis is still used for `scrollTo`, but the settle uses `immediate: true`.

- [ ] **Step 1: Write the failing tests**

```ts
test('progress clamps to 0..1', () => {
  expect(guideProgress(0, 900, 90, 56)).toBe(0);
  expect(guideProgress(377, 900, 90, 56)).toBeCloseTo(0.5, 2);
  expect(guideProgress(5000, 900, 90, 56)).toBe(1);
});
test('progress recomputes for a new viewport height', () => {
  expect(guideProgress(377, 600, 90, 56)).toBeGreaterThan(guideProgress(377, 900, 90, 56));
});
test('degenerate viewport gives 0', () => expect(guideProgress(100, 100, 90, 56)).toBe(0));
test('settle picks the nearer end, none at the ends', () => {
  expect(settleTarget(0)).toBeNull();
  expect(settleTarget(1)).toBeNull();
  expect(settleTarget(0.3)).toBe('top');
  expect(settleTarget(0.5)).toBe('guides');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useGuideScroll`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `guideProgress`, `settleTarget` and `useGuideScroll` in `src/lib/useGuideScroll.ts`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. `npx tsc -b` exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/useGuideScroll.ts src/lib/useGuideScroll.test.ts
git commit -m "feat: scroll progress and settle for region guides"
```

---

### Task 3: Scrollable Explore shell, guide sheet and wheel behaviour

**Files:**
- Create: `src/components/guides/GuideSheet.tsx`
- Modify: `src/pages/Explore.tsx` (layout, hook wiring, `See region guides` button), `src/map/MapExplorer.tsx` (wheel props), `src/styles.css` (new section "Region guides" after "Map search")

**Interfaces:**
- Consumes: `useGuideScroll`, `PEEK` (Task 2).
- Produces:
  - `GuideSheet(props: { heading: string; cue: string; barLabel: string; atGuides: boolean; onBackToMap(): void; peek?: ReactNode; miniMap?: ReactNode; children: ReactNode })`
    - `peek` renders inside the visible 90px strip (phone chips, Tokyo filters).
    - `miniMap` renders in the sticky bar.
  - `MapExplorer` gains two props:
    - `wheelScrollsPage?: boolean` (default false). When true, `map.scrollZoom.disable()`. A wheel listener on the map wrapper turns Ctrl + wheel into `map.easeTo({ zoom: zoom - deltaY * 0.01, around: unproject(pointer), duration: 0 })` with `preventDefault`. Plain wheel is left alone so Lenis and window scrolling get it.
    - `onWheelPassThrough?: () => void`, called on a plain wheel over the map while `wheelScrollsPage` is true.
  - CSS contract:
    - `.explore` gets `--gp` (0..1).
    - `.explore-stage` is fixed (map, title, search, panel, controls, toast).
    - `.guides` starts at `margin-top: calc(100svh - 90px)`.
    - Stage effects read `var(--gp)`: the map filter brightness goes 1 → 0.6 and the scale 1 → 0.97. Title and panel opacity use `clamp(0, 1 - var(--gp) / 0.4, 1)`.
    - The world level has no `.guides`, and the body doesn't scroll.

- [ ] **Step 1: Restructure Explore**
  - `.explore` becomes normal flow, with the fixed `.explore-stage` holding everything that exists today.
  - Render `GuideSheet` only for the `country` level of a live country (Japan), `region` and `area`. Give it placeholder children for now: one line, "Region guides coming in the next task".
  - Pass `levelKey = `${target.level}:${target.country?.id}:${target.area?.id}`` (built in Explore) so a level change resets the scroll.
  - At Japan level, rename the "Japan's page" button to `See region guides`, calling `scrollToGuides()`.

- [ ] **Step 2: Build GuideSheet**
  - Rounded top, handle, heading, and the cue with a chevron. The chevron nudges once after 3000 ms without pointer, wheel or key input, and not under reduced motion.
  - Sticky bar `position: sticky; top: 0`, with `barLabel` on the left and `miniMap` plus "Back to map" (chevron up) on the right. The whole bar is a button calling `onBackToMap`.

- [ ] **Step 3: Wheel behaviour and hint**
  - Pass `wheelScrollsPage` when a sheet is shown.
  - `onWheelPassThrough` shows the toast "Scrolling shows the guides. Use Ctrl + scroll to zoom the map." once per page load, tracked by a ref in Explore and only when `--gp` is 0.

- [ ] **Step 4: Verify type-check and build**

Run: `npx tsc -b && npm run build`
Expected: exit 0.

- [ ] **Step 5: Verify behaviour with screenshots**
  - `shot.mjs http://localhost:5174/map/japan s3-top.jpg 1440 900 8000`: the sheet peeks 90px with its heading and cue, and the map is undimmed.
  - Same URL with js `window.scrollTo(0, 400)` then wait: the map is dimmed and the title card is faded.
  - js `window.scrollTo(0, 99999)`: the sticky bar is pinned at the top.
  - `resets scroll on level change`: on `/map/japan`, run `window.scrollTo(0, 99999)`, then `history.pushState` to `/map/japan/tokyo` via the crumb or a link click, then wait. `scrollY` is 0 and `--gp` is 0.
  - `wheelScrollsPage=false keeps scroll zoom`: on `/` run `__flMap.scrollZoom.isEnabled()` → `true`. On `/map/japan` → `false`.
  - Resize: load at 1440×900 scrolled halfway, then resize to 1280×800 via CDP or reload at that size and scroll. `--gp` is still within 0..1, and the map is not stuck half-dimmed after the settle.
  - Phone, 390×844: the sheet peek sits above the bottom tabs and is fully visible.

- [ ] **Step 6: Commit**

```bash
git add src/components/guides/GuideSheet.tsx src/pages/Explore.tsx src/map/MapExplorer.tsx src/styles.css
git commit -m "feat: scrollable map page with peeking guide sheet"
```

---

### Task 4: Japan region list with two-way hover, region focus and phone chips

**Files:**
- Create: `src/components/guides/RegionList.tsx`
- Modify: `src/map/MapExplorer.tsx`, `src/components/GlobeCard.tsx`, `src/pages/Explore.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `REGIONS`, `regionOfPref`, `prefName` (Task 1). `GuideSheet.peek` (Task 3).
- Produces:
  - `RegionList(props: { openId: string | null; hot: { region: string | null; pref: number | null }; onHover(h: { region: string | null; pref: number | null }): void; onToggle(id: string): void; onPickPref(code: number): void })`
    - Desktop accordion in `.panel`, heading "Regions of Japan".
    - Each row shows the name, the Japanese name and a status ("Live · Tokyo" on Kantō, "Coming soon" otherwise).
    - Expanded rows list prefectures; Tokyo is marked Live.
  - `RegionChips(props: { focusId: string | null; onPick(id: string): void })` for the phone peek.
  - New `MapExplorer` props:
    - `hotPrefs?: number[]`: feature-state `hover` on `fl-prefs` for those codes; replaces the internal hover while set.
    - `focusPrefs?: number[] | null`: the camera fits the union of those prefectures' bounds at country level, using the same padding as other levels.
    - `onPrefHover?: (code: number | null) => void`, fired from the existing `onPrefMove` and `leave`.
    - Existing `onRegion` and `onNotice` are unchanged.
  - `GlobeCard`'s `dest` prop type widens to `CardSubject = Pick<Destination, 'slug' | 'name' | 'local' | 'oneLiner' | 'live'> & { landmarks: { photo: string | null; name: string }[] }`.
    - A single landmark renders one centred photo.
    - `photo: null` renders the neutral placeholder.
    - `MapExplorer.pinned` takes a `CardSubject`.

- [ ] **Step 1: Hover linking**

Explore holds `hot` state:
- A region row sets `hotPrefs = region.prefectures`.
- A prefecture row sets `[code]`.
- A map hover (`onPrefHover`) sets `hot = { region: regionOfPref(code).id, pref: code }`, which highlights the matching row and, if that region is open, its prefecture row.

- [ ] **Step 2: Clicks per the spec and the after-review calls**

- **Kantō row:** toggles open and sets `focusPrefs = kanto.prefectures`, with no card.
- **Coming-soon region row:** opens it, sets `focusPrefs`, and pins a `CardSubject` built from the region (one landmark: the region photo or null).
- **Prefecture 13 (row or map):** `onRegion()`, which flies to Tokyo.
- **Other Kantō prefectures:** keep today's notice.
- **Coming-soon prefecture:** behaves as its region.
- **Escape or "Zoom out" while a region is focused:** clears the focus first, before leaving Japan.
- **Phone chips:** behave as the rows, except the Kantō chip flies to Tokyo.

- [ ] **Step 3: Verify type-check and build**

Run: `npx tsc -b && npm run build`
Expected: exit 0.

- [ ] **Step 4: Verify with screenshots**

- `/map/japan` at 1440×900 with js hovering the Kansai row (`dispatchEvent(new PointerEvent('pointerenter'))`): Kansai's 7 prefectures are highlighted.
- js clicking the Kansai row: the camera frames Kansai and the Kansai card is tethered with a placeholder photo.
- js clicking the Kantō row: Kantō is framed, its rows are expanded, and there's no card.
- Phone: the chip row shows in the peek, and tapping Kyūshū frames it with the card docked.

- [ ] **Step 5: Commit**

```bash
git add src/components/guides/RegionList.tsx src/map/MapExplorer.tsx src/components/GlobeCard.tsx src/pages/Explore.tsx src/styles.css
git commit -m "feat: Japan region list linked to the map"
```

---

### Task 5: Japan region guide cards and sticky-bar mini map

**Files:**
- Create: `src/components/guides/GuideCard.tsx`, `src/components/guides/MonthStrip.tsx`, `src/components/guides/MiniMap.tsx`
- Modify: `src/pages/Explore.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `regionSummary`, `Summary` (Task 1). `GuideSheet.miniMap` (Task 3). Explore's `hot` state and the click handlers (Task 4).
- Produces:
  - `MonthStrip(props: { months: boolean[]; rough?: boolean })`: 12 cells labelled with `MONTHS` from `src/lib/format.ts`. Has `aria-label` "Best months: Mar, Apr…". The caption "Rough guide" shows when `rough` is set.
  - `GuideCard(props: { photo: string | null; title: string; ja?: string; status: string; line: string; summary: Summary | null; rough?: boolean; foot?: string; onHover(on: boolean): void; onPick(): void })`
    - Shows the tags `summary.effort`, `summary.crowds` and `summary.cost`.
    - `summary === null` or `count === 0` (for live derived data) shows "Nothing matches this filter".
  - `MiniMap(props: { kind: 'japan' | 'tokyo'; hot: number[] })`: a static SVG drawn with `d3-geo` `geoPath` from `PREFECTURES` or `TOKYO_AREAS`, in `C.cedar` for the hot codes. It is not a MapLibre map.

- [ ] **Step 1: Render the Japan guides**
  - Live regions first, then north to south.
  - `foot` = the prefecture names joined with ", ".
  - Card hover sets `hot`, so both the mini map and the dimmed main map highlight.
  - Card click: `scrollToTop()`, then the same handler as the row click from Task 4. The Kantō card flies to Tokyo.

- [ ] **Step 2: Verify type-check, tests and build**

Run: `npm test && npx tsc -b && npm run build`
Expected: exit 0.

- [ ] **Step 3: Verify with screenshots**

- `/map/japan` scrolled to the guides at 1440×900 and 390×844:
  - 8 cards.
  - Kantō is first, marked Live, with months and tags derived from Tokyo.
  - The other 7 cards show "Rough guide".
  - The mini map is in the sticky bar.
- js hovering the Shikoku card: the mini map highlights Shikoku.

- [ ] **Step 4: Commit**

```bash
git add src/components/guides src/pages/Explore.tsx src/styles.css
git commit -m "feat: Japan region guide cards"
```

---

### Task 6: Tokyo level: ward list, filters in the sheet, ward guides, top picks, all attractions

**Files:**
- Create: `src/components/guides/WardList.tsx`, `src/components/guides/TokyoSections.tsx`
- Modify: `src/pages/Explore.tsx`, `src/styles.css`
- Reference (move markup and CSS from): `src/pages/Place.tsx` (`AREAS`, the hero rail Swiper, the phone `deck` EffectCards, the `Grid` and `.all` section with search and chips)

**Interfaces:**
- Consumes: `summarize` (Task 1), `GuideSheet`, `GuideCard`, `MonthStrip`, `MiniMap` (Tasks 3 and 5), `FILTERS` from `src/lib/factors.ts`.
- Produces:
  - `WARDS` (exported from `src/components/guides/WardList.tsx`, or `src/data/places.ts` if shared): wards with attractions, `{ id, name, ja, cover }`, sorted by count. Moved from `Place.tsx`'s `AREAS`.
  - `WardList(props: { counts: Record<string, number>; hot: string | null; onHover(id: string | null): void; onPick(id: string): void })`. Counts follow the active filter. Wards with 0 matches stay listed, muted.
  - `TokyoSections(props: { scope: 'tokyo' | string /* ward id */; filter: FilterId; setFilter(f: FilterId): void; onWard(id: string): void; onOpen(attractionId: string): void })`, rendering in order:
    1. Ward guides (at Tokyo), or a row of other wards (at ward level).
    2. "Top picks": Swiper rail on desktop, EffectCards deck on phone.
    3. "All attractions": search, chips and grid.
  - The filter state lives in Explore. It drives the `pins` passed to `MapExplorer` (as today), the `WardList` counts, the ward-guide summaries (`summarize(wardAttractions.filter(test))`) and the grid.

- [ ] **Step 1: Swap the right-hand panel at Tokyo for `WardList`**

Hover links both ways through `MapExplorer`'s existing `hoverId` mechanics for areas. Add `hotArea?: string | null` and `onAreaHover?: (id: string | null) => void` to `MapExplorer`, mirroring Task 4's prefecture props on `fl-areas`.

- [ ] **Step 2: Put the filter chips in the sheet peek at Tokyo**

Use the existing `FilterChips` in `Explore.tsx`. At Tokyo there's no attraction panel on desktop and no `.msheet` on phone.

- [ ] **Step 3: Build `TokyoSections` by moving the Place.tsx markup**

Ward guide card: `photo = cover`, `status = "N checked"` (N from the filtered list), `line` = the kinds of its attractions joined (e.g. "Temple, market, museum"), `foot` = the top 3 attraction names by the order in `ATTRACTIONS`. Clicking it goes to the ward level (`/map/japan/tokyo/<ward>`) after `scrollToTop()`.

Keep class names so the existing CSS applies, and move only the CSS that's used.

- [ ] **Step 4: Verify type-check, tests and build**

Run: `npm test && npx tsc -b && npm run build`
Expected: exit 0.

- [ ] **Step 5: Verify with screenshots**

- `/map/japan/tokyo` at 1440×900: the ward list is on the right, and hovering Taitō highlights it on the map.
- Scrolled: ward guides, then Top picks, then All attractions.
- js clicking the "Free" chip in the peek: tickers, ward counts and the grid all change together.
- Phone: chips in the peek, the deck in Top picks.

- [ ] **Step 6: Commit**

```bash
git add src/components/guides src/pages/Explore.tsx src/map/MapExplorer.tsx src/styles.css
git commit -m "feat: Tokyo ward list and guides under the map"
```

---

### Task 7: Ward level, routes, navigation and removing the old pages

**Files:**
- Modify: `src/pages/Explore.tsx`, `src/App.tsx`, `src/components/Chrome.tsx`, `src/pages/Attraction.tsx`, `src/pages/Place.tsx`, `src/styles.css`, `DESIGN.md`, `README.md`
- Delete: `src/components/HomeMap.tsx` (once nothing imports it)

**Interfaces:**
- Consumes: `TokyoSections`, `GuideSheet`, `useGuideScroll.scrollToGuides` (Tasks 2, 3 and 6).
- Produces:
  - **Ward level:**
    - Right panel: that ward's attractions, as today.
    - Sheet heading "In <ward>"; bar "<ward> · N places".
    - Phone peek: today's `.mrow` attraction row; the pin card stays.
    - Content: `TokyoSections scope={wardId}`.
  - **Routes:**
    - `/japan` → `/map/japan#guides`
    - `/japan/tokyo` → `/map/japan/tokyo#guides`
    - `/japan/tokyo/:ward` → `/map/japan/tokyo/:ward#guides`
    - Each uses `<Navigate replace>`, inside `PlacePage` for the live country.
    - `ComingSoon` stays for other countries.
  - **Explore:** on mount and on level change, if `location.hash === '#guides'`, call `scrollToGuides()` once the map is `ready` and the sheet has rendered (one `requestAnimationFrame` after `ready`).
  - **Navigation:**
    - TopNav "Tokyo" and BottomTabs "Tokyo" → `TOKYO_PATH`.
    - TopNav "Explore" is active only at world level; "Tokyo" is active for `/map/japan/tokyo*`.
    - Attraction page back and "See it on the map" → `areaPath(a.area)`.
  - **Removed:**
    - `LivePlace`, `AreasSection`, `RegionsSection` and `ScopeChips` from `Place.tsx`.
    - `HomeMap.tsx`.
    - CSS used only by those (search `styles.css` for each class first).

- [ ] **Step 1: Ward level and the redirects**

- [ ] **Step 2: Deep-link `#guides` handling**

- [ ] **Step 3: Navigation and the attraction page links; delete unused code and CSS**

- [ ] **Step 4: Update DESIGN.md and README.md for the new structure**

- [ ] **Step 5: Verify type-check, tests and build**

Run: `npm test && npx tsc -b && npm run build`
Expected: exit 0. `grep -rn "HomeMap\|LivePlace\|TOKYO_PAGE" src` finds no imports of removed code. Keep `TOKYO_PAGE` only if it is still used for the redirect.

- [ ] **Step 6: Verify with screenshots**

- `/japan` lands on the Japan guides.
- `/japan/tokyo/taito` lands on Taitō's guides, with the map framed on Taitō behind.
- `/map/japan/tokyo/taito` at the top shows the attraction panel and the sheet peek.
- Phone ward level: the attraction row in the peek.
- An attraction page's back button goes to the ward on the map.

- [ ] **Step 7: Commit**

```bash
git add -A src DESIGN.md README.md
git commit -m "feat: fold Japan and Tokyo pages into map guides"
```

---

### Task 8: Region photos (needs the user's OK)

**Files:**
- Add: `photos-src/region-<id>.jpg` × 7, then generated `public/photos/region-<id>-720.webp` and `-1600.webp`
- Modify: `src/data/regions.ts` (`photo` ids), `photos-src/credits.json`, `src/data/photo-credits.json` (via the script)

**Interfaces:**
- Consumes: `Region.photo` (Task 1). `GuideCard` and `GlobeCard` placeholders (Tasks 4 and 5).

- [ ] **Step 1: Find candidates**

For each of the 7 regions, find one Wikimedia Commons photo, using the taste skill's asset search as before. Present the list to the user: filename, Commons page URL, licence and size. Stop until the user approves.

- [ ] **Step 2: After approval, download into `photos-src/` and run `node scripts/build-photos.mjs`**

Expected: 14 webp files and credits updated.

- [ ] **Step 3: Set `photo` on each region; check the Credits page lists them**

- [ ] **Step 4: Verify with screenshots**

`/map/japan` guides at 1440×900 and 390×844: all 8 cards have photos, and the Kansai focus card shows its photo.

- [ ] **Step 5: Commit**

```bash
git add photos-src public/photos src/data/regions.ts src/data/photo-credits.json
git commit -m "feat: photos for Japan region guides"
```
