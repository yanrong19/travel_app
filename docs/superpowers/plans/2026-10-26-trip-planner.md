# Trip Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Trips tab that replaces the Tokyo tab. Users pick several places and dates, then fill each day with attractions from a map or search. Each day gets a live per-factor summary (no single score), a mock rain chance and an optional wet-weather list. Trips are saved in the browser.

**Architecture:**
- **Pure, unit-tested core in `src/lib/`:**
  - the trip model and its operations
  - storage
  - place helpers
  - the schedule and travel estimate
  - the mock forecast
  - the day summary
- **Thin React layer:**
  - a `TripsProvider` context
  - three pages: `/trips`, `/trips/new` and `/trips/:id`
  - planner components in `src/components/planner/`
- **Map:** the planner reuses `MapExplorer` as its own map instance, with two new props: pin tones and lit countries.

**Tech Stack:** Vite 8, React 19, TypeScript 7, react-router v7, MapLibre GL 6, motion, Lenis, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-trip-planner-design.md`

## Global Constraints

- No new runtime dependencies. Tests use Vitest (`npm test`).
- Precondition: start from branch `region-guides` after the final-review fix wave is committed. Create branch `trip-planner` from it.
- Reuse the existing pieces: `MapExplorer`, tickers, `PinCard`, `MapSearch` patterns, the `GlobeCard` globe, `KineticTitle`, chips, frosted `.panel` surfaces, tokens, and the Metro line colours for the factor groups (`LINES` in `src/data/lines.ts`).
- Copy that is fixed:
  - tabs "Explore", "Trips", "Saved"
  - buttons "Add to trip", "Add to Day N" and "Remove from Day N"
  - "On Day N: move here"
  - "Pick a replacement for <name>"
  - "No checked attractions yet"
  - "Plan your first trip"
  - "Add stops from the map or search"
  - "Not rain-proof"
  - the summary row labels Effort, Conditions, Vibe, Logistics and Cost
- No single score for a day. The per-factor rows are never averaged.
- **Pace day length:** relaxed 8 h, normal 10 h, packed 12 h. Default day start 09:00.
- **Travel estimate:** straight-line distance × 1.4 at 18 km/h, rounded up to 5 min.
- **Visit time per stop:** the midpoint of `logistics.visitMin` plus the midpoint of `logistics.queueMin`.
- **Thresholds:**
  - likely wet = rain chance ≥ 50%
  - crowd warning = crowd ≥ 70 at the planned hour
  - back-to-back hard = two consecutive stops with `effort.level ≥ 4`
  - long day on foot = on-feet total over 360 min
- **Storage:** localStorage key `fitline.trips` with `version: 1`. Saved hearts keep reading the old key `fitline.trip`.
- `prefers-reduced-motion` respected. OpenStreetMap attribution visible. Phone breakpoint `max-width: 760px`.
- **After every task:** `npm test`, `npx tsc -b` and `npm run build` pass.
- **UI tasks:** verify with `node C:\Users\fooya\AppData\Local\Temp\claude\C--projects-travel-app\76e40c19-ea28-43e8-81fd-bba8ffb081f9\scratchpad\shot.mjs <url> <out.jpg> [w] [h] [waitMs] [js]` at 1440×900 and 390×844, against the dev server on port 5174 (`npm run dev -- --port 5174 --strictPort` if it isn't running).
- Commit locally after each task; never push.

## Review Focus

1. **A trip with a number of days but no dates.** There is no weekday, month or rain chance. The summary still renders, skipping the hours, season and crowd-day checks rather than guessing. Tested in Task 4: `summary without dates skips date checks`.
2. **Corrupt or old data in `fitline.trips`.** The app starts with an empty list and a notice instead of crashing, and saved hearts are untouched. Tested in Task 2: `loadTrips tolerates corrupt json` and `loadTrips drops unknown version`.
3. **The same attraction added twice.** A day never holds duplicates. Adding a stop that is already on another day moves it rather than copying it, unless it goes to a wet-weather list. Tested in Task 2: `addStop moves from another day`.
4. **Shortening the trip.** Lowering the number of days moves stops from the removed days into Unplanned; nothing is lost. Tested in Task 2: `setDays keeps stops from removed days`.
5. **A place with no attractions as the current place** (e.g. Italy, or Kyoto prefecture). The map frames it, the list shows "No checked attractions yet", and nothing crashes. Tested in Task 3 (`attractionsIn returns [] for places without data`) and by screenshot in Task 8.

---

### Task 1: Nature vs city, and renaming hearts to Saved

**Files:**
- Modify: `src/data/types.ts` (add `vibe.nature`), `src/data/attractions.ts` (values for all 16), `src/pages/sections/Vibe.tsx` (show it)
- Create: `src/lib/saved.tsx` (moved from `src/lib/trip.tsx`), and delete `src/lib/trip.tsx`
- Modify: every importer of `useTrip`/`TripProvider` (11 uses; `grep -rn "useTrip\|TripProvider" src`)
- Test: `src/data/attractions.test.ts`

**Interfaces:**
- Produces:
  - `Attraction['vibe']['nature']: number` (0 = city, 100 = nature)
  - `SavedProvider`, and `useSaved(): { ids; has; toggle; remove; open; setOpen }` (same shape as today's `useTrip`), in `src/lib/saved.tsx`

- [ ] **Step 1: Write the failing test**

```ts
test('every attraction has a nature value 0–100', () => {
  for (const a of ATTRACTIONS) expect(a.vibe.nature).toBeGreaterThanOrEqual(0), expect(a.vibe.nature).toBeLessThanOrEqual(100);
});
test('nature values are sensible at the ends', () => {
  const by = Object.fromEntries(ATTRACTIONS.map((a) => [a.id, a.vibe.nature]));
  expect(by['mount-takao']).toBeGreaterThanOrEqual(80);
  expect(by['shibuya-sky']).toBeLessThanOrEqual(20);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- attractions`. Expected: FAIL (type error or undefined).

- [ ] **Step 3: Add the field and fill the values**

- Add `nature: number` to the `vibe` type, with a doc comment like `local`'s.
- Fill it for the 16 attractions with plain, defensible values.
- In `Vibe.tsx`, show it in the same style as the touristy/local reading (labels "City" and "Nature").

- [ ] **Step 4: Rename the hearted list**

- Move `trip.tsx` to `saved.tsx` and rename to `SavedProvider`/`useSaved`. The storage key stays `'fitline.trip'`.
- Update all importers, including `App.tsx`.

- [ ] **Step 5: Verify**

Run `npm test`, `npx tsc -b` and `npm run build`. All pass, and `grep -rn "useTrip\|TripProvider\|lib/trip'" src` finds nothing. Screenshot `/attraction/mount-takao` at 1440×900 and open the Vibe section: the nature reading shows.

- [ ] **Step 6: Commit**

```bash
git add -A src && git commit -m "feat: nature vs city vibe; rename hearted list to Saved"
```

---

### Task 2: Trip model, operations and storage

**Files:**
- Create: `src/lib/trips.ts` (types and pure operations), `src/lib/tripsStore.tsx` (context and persistence)
- Test: `src/lib/trips.test.ts`

**Interfaces:**
- Produces, in `src/lib/trips.ts`:
  - **Types:**
    - `type PlaceRef = { level: 'country' | 'region' | 'prefecture' | 'area'; id: string }`
      - `id` is the worldId for a country, a `REGIONS` id for a region, the JIS code as a string (`'13'`) for a prefecture, and the ward code (`'13106'`) for an area
    - `type Pace = 'relaxed' | 'normal' | 'packed'`
    - `type Who = 'solo' | 'couple' | 'family' | 'friends'`
    - `interface DayPlan { stops: string[]; wet: string[] }` (attraction ids)
    - `interface Trip { version: 1; id: string; name: string; places: PlaceRef[]; startDate: string | null /* 'YYYY-MM-DD' */; days: DayPlan[]; unplanned: string[]; who: Who; pace: Pace; dayStart: string /* 'HH:MM' */; createdAt: number; updatedAt: number }`
  - **Constants:** `PACE_HOURS: Record<Pace, number> = { relaxed: 8, normal: 10, packed: 12 }`
  - **Creating and dates:**
    - `newTrip(init: { name: string; places: PlaceRef[]; startDate: string | null; days: number; who: Who; pace: Pace; dayStart?: string }, now: number, id: string): Trip`
    - `dateOf(trip: Trip, day: number): Date | null` (day is 0-based)
    - `endDate(trip: Trip): string | null`
    - `daysBetween(start: string, end: string): number` (inclusive)
  - **Operations** (all pure: they return a new Trip with `updatedAt` set from the `now` argument):
    - `setDays(trip, n, now)`
    - `addStop(trip, day, id, now)`
    - `removeStop(trip, day, id, now)`
    - `moveStop(trip, day, from, to, now)`
    - `replaceStop(trip, day, oldId, newId, now)`
    - `addWet(trip, day, id, now)` and `removeWet(trip, day, id, now)`
    - `addUnplanned(trip, id, now)`
    - `planUnplanned(trip, id, day, now)`
    - `addPlace(trip, ref, now)`
    - `removePlace(trip, ref, removeStops: string[], now)`
  - **Queries:**
    - `dayOf(trip, id): number | null` (which day holds the stop; -1 when it's in unplanned)
  - **Storage:**
    - `loadTrips(raw: string | null): { trips: Trip[]; notice: string | null }`
    - `serializeTrips(trips: Trip[]): string` (`{ version: 1, trips }`)
- Produces, in `src/lib/tripsStore.tsx`:
  - `TripsProvider`
  - `useTrips(): { trips: Trip[]; get(id): Trip | undefined; create(init): Trip; update(id, fn: (t: Trip, now: number) => Trip): void; remove(id): void; restore(trip: Trip): void; notice: string | null }`
  - It reads and writes localStorage key `fitline.trips`, with every access wrapped in try/catch. It saves on every change.

- [ ] **Step 1: Write the failing tests**

```ts
test('newTrip makes one empty DayPlan per day', () => expect(newTrip(init({ days: 3 }), 1, 't1').days).toEqual([{stops:[],wet:[]},{stops:[],wet:[]},{stops:[],wet:[]}]));
test('daysBetween is inclusive', () => expect(daysBetween('2027-04-10', '2027-04-14')).toBe(5));
test('dateOf follows the start date; null without one', ...);           // day 2 of 2027-04-10 → 2027-04-12; startDate null → null
test('addStop adds once; a second add to the same day is a no-op', ...);
test('addStop moves from another day', ...);                           // on day 0, add to day 2 → only on day 2
test('addStop takes it out of unplanned', ...);
test('addWet does not remove it from the day plan', ...);
test('replaceStop keeps the position', ...);                            // [a,b,c] replace b with d → [a,d,c]
test('moveStop reorders', ...);
test('setDays keeps stops from removed days', ...);                    // 5 days with stops on day 4, setDays 3 → unplanned contains them
test('setDays grows with empty days', ...);
test('removePlace drops the place and the listed stops', ...);
test('operations stamp updatedAt from now', ...);
test('loadTrips round-trips serializeTrips', ...);
test('loadTrips tolerates corrupt json', () => expect(loadTrips('{nope')).toEqual({ trips: [], notice: expect.any(String) }));
test('loadTrips drops unknown version', () => expect(loadTrips(JSON.stringify({ version: 9, trips: [{}] })).trips).toEqual([]));
test('loadTrips(null) is empty with no notice', () => expect(loadTrips(null)).toEqual({ trips: [], notice: null }));
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- trips`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/trips.ts`**

Dates are handled as local calendar dates (`YYYY-MM-DD` parsed without a time zone shift).

- [ ] **Step 4: Implement `src/lib/tripsStore.tsx`**

- Ids come from `crypto.randomUUID()` when available, else a time-plus-random string.
- Mount `TripsProvider` in `App.tsx` beside `SavedProvider`.

- [ ] **Step 5: Verify**

Run `npm test`, `npx tsc -b` and `npm run build`. All pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/trips.ts src/lib/trips.test.ts src/lib/tripsStore.tsx src/App.tsx && git commit -m "feat: trip model, operations and storage"
```

---

### Task 3: Place helpers, schedule and mock forecast

**Files:**
- Create: `src/lib/tripPlaces.ts`, `src/lib/schedule.ts`, `src/lib/forecast.ts`
- Test: `src/lib/tripPlaces.test.ts`, `src/lib/schedule.test.ts`, `src/lib/forecast.test.ts`

**Interfaces:**
- Consumes: `PlaceRef`, `Trip`, `PACE_HOURS`, `dateOf` (Task 2), `REGIONS` and `prefName` (`src/data/regions.ts`), `DESTINATIONS` (`src/data/destinations.ts`), `WORLD`, `TOKYO_AREAS`, `areaById`, `JAPAN_ID` and `TOKYO_PREF_ID` (`src/data/places.ts`).
- Produces, in `src/lib/tripPlaces.ts`:
  - `placeLabel(ref: PlaceRef): { name: string; local?: string; kind: string }` (kind is "Country", "Region of Japan", "Prefecture" or "Tokyo ward")
  - `attractionsIn(ref: PlaceRef): Attraction[]`
    - Japan, Kantō, prefecture 13: all of Tokyo
    - a ward: that ward's attractions
    - anything else: `[]`
  - `placeCover(ref: PlaceRef): string | null` (photo id: a destination's first landmark, a region's photo, a ward's first attraction, or Tokyo's `shibuya-sky`)
  - `placeView(ref: PlaceRef): { target: MapTarget; focusPrefs: number[] | null }`
    - a country gives the country target
    - a region gives the Japan country target with `focusPrefs` set to the region's prefectures
    - prefecture 13 gives the Tokyo region target
    - any other prefecture gives the Japan country target with `[code]`
    - an area gives that ward's area target
  - `ALL_PLACES: (PlaceRef & { label: string; sub: string })[]`: every pickable place for search: the 13 destinations, 8 regions, 47 prefectures, and Tokyo wards that have attractions
  - `sameRef(a: PlaceRef, b: PlaceRef): boolean`
  - `covers(ref: PlaceRef, attractionId: string): boolean`: true when `attractionsIn(ref)` includes it
  - `coveringPlace(places: PlaceRef[], attractionId: string): PlaceRef | null`: the first place in the list that covers it
  - `dayPlace(trip: Trip, day: number): PlaceRef | null`: the covering place of the day's first stop, else `trip.places[0]`, else null
- Produces, in `src/lib/schedule.ts`:
  - `travelMin(a: [number, number], b: [number, number]): number` (haversine km × 1.4 ÷ 18 km/h, ceil to 5)
  - `visitMin(a: Attraction): number` (the midpoint of `visitMin` plus the midpoint of `queueMin`)
  - `interface ScheduledStop { a: Attraction; start: number /* minutes from midnight */; end: number; travelBefore: number }`
  - `schedule(stops: Attraction[], dayStart: string): ScheduledStop[]`
  - `dayLengthMin(pace: Pace): number`
- Produces, in `src/lib/forecast.ts`:
  - `getRainChance(ref: PlaceRef | null, date: Date | null): number | null`
    - mock; deterministic for a given date and place; `null` when the date is null
  - `LIKELY_WET = 50`
  - `isLikelyWet(chance: number | null): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// tripPlaces
test('attractionsIn returns all of Tokyo for Japan, Kantō and prefecture 13', ...);   // length 16 each
test('attractionsIn returns [] for places without data', () => { expect(attractionsIn({ level: 'country', id: '380' })).toEqual([]); expect(attractionsIn({ level: 'prefecture', id: '26' })).toEqual([]); });
test('attractionsIn of a ward is that ward only', ...);
test('placeView of a region focuses its prefectures', ...);           // kansai → focusPrefs [24..30], target.level 'country'
test('placeView of prefecture 13 is the Tokyo region level', ...);
test('ALL_PLACES has 13 destinations, 8 regions, 47 prefectures and the wards with attractions', ...);
test('dayPlace uses the first stop, else the first place', ...);
test('coveringPlace finds Japan for a Tokyo attraction; null when nothing covers it', ...);
// schedule
test('travelMin rounds up to 5 and uses ×1.4 at 18 km/h', () => expect(travelMin([139.7966, 35.7148], [139.6993, 35.6764])).toBe(<computed value, ceil5>));
test('schedule starts at dayStart and adds travel between stops', ...);
test('schedule of one stop has no travel', ...);
test('dayLengthMin follows pace', () => expect([dayLengthMin('relaxed'), dayLengthMin('normal'), dayLengthMin('packed')]).toEqual([480, 600, 720]));
// forecast
test('getRainChance is deterministic', ...);
test('getRainChance is null without a date', () => expect(getRainChance(null, null)).toBeNull());
test('Tokyo June is wetter than Tokyo January', ...);
test('chances stay within 0..100', ...);
```

For `travelMin`, the implementer computes the expected value once from the formula and writes it into the test as a literal.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- tripPlaces schedule forecast`. Expected: FAIL.

- [ ] **Step 3: Implement the three modules**

The forecast uses a month baseline per destination: Tokyo Jun to mid-Jul about 60–75 and Aug–Sep about 50–60, other months 20–40. Add a small date-and-place hash jitter of ±10, clamped to 0..100.

- [ ] **Step 4: Verify**

Run `npm test`, `npx tsc -b` and `npm run build`. All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tripPlaces.ts src/lib/schedule.ts src/lib/forecast.ts src/lib/*.test.ts && git commit -m "feat: trip places, schedule and mock forecast"
```

---

### Task 4: Day summary

**Files:**
- Create: `src/lib/daySummary.ts`
- Test: `src/lib/daySummary.test.ts`

**Interfaces:**
- Consumes: `schedule`, `ScheduledStop`, `dayLengthMin` (Task 3); `isRainProof`, `mustPay`, `withExtras` and `EFFORT_LABELS` (`src/lib/factors.ts`); `Trip`, `dateOf` (Task 2).
- Produces:
  - `type Flag = { factor: 'effort' | 'conditions' | 'vibe' | 'logistics' | 'cost'; text: string; stopId?: string }`
  - `interface DaySummary { empty: boolean; line: string; effort: { hardest: { id: string; name: string; level: number } | null; onFeetMin: number; perStop: { id: string; level: number }[] }; conditions: { text: string; rainSensitive: string[] }; vibe: { naturePct: number; cityPct: number; localWord: string }; logistics: { usedMin: number; travelMin: number; budgetMin: number }; cost: { min: number; max: number; cashOnly: boolean }; flags: Flag[] }`
  - `summarizeDay(stops: Attraction[], opts: { dayStart: string; pace: Pace; date: Date | null; who: Who }): DaySummary`

- [ ] **Step 1: Write the failing tests**

```ts
test('empty day', () => expect(summarizeDay([], opts()).empty).toBe(true));
test('a hard nature stop and an easy city stop are not averaged', () => {
  const s = summarizeDay([takao, teamlab], opts());
  expect(s.effort.hardest?.id).toBe('mount-takao');
  expect(s.vibe.naturePct + s.vibe.cityPct).toBe(100);
  expect(s.vibe.naturePct).toBeGreaterThan(50);              // Takao's visit is longer
});
test('back-to-back hard stops are flagged', ...);              // two level ≥ 4 consecutive → effort flag
test('over 360 min on foot is flagged', ...);
test('rain-sensitive stops are listed', ...);                  // !isRainProof → in conditions.rainSensitive
test('closed on that weekday is flagged', ...);                // date on a day where hours[d] === null
test('out-of-season month is flagged', ...);                   // months[m] === 'poor'
test('crowd ≥ 70 at the planned hour is flagged', ...);        // weekend vs weekday from the date
test('summary without dates skips date checks', ...);          // date null → no closed/season/crowd-day flags, no throw
test('over budget is flagged', ...);                           // usedMin > budgetMin
test('book ahead flag when booking is required', ...);
test('a stop rated poor for who is going gets a vibe flag', ...);     // who 'family', suits.family 'poor' → vibe flag
test('cost range runs from mustPay to withExtras; cash-only flagged', ...);
test('line is short and mentions the shape of the day', () => expect(summarizeDay([takao, teamlab], opts()).line).toMatch(/morning/i));
```

Build the fixtures from real `ATTRACTIONS`, overriding fields where a test needs a specific value.

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- daySummary`. Expected: FAIL.

- [ ] **Step 3: Implement `summarizeDay`**

- Vibe split is weighted by each stop's scheduled duration.
- `localWord` reuses `localWord()` from `factors.ts` on the duration-weighted `vibe.local`.
- One-line rules (from the spec):
  - stops starting before 12:00 make the morning, later stops the afternoon or evening
  - effort word from levels: ≤2 easy, 3 moderate, ≥4 big
  - setting word from nature: ≥60 outdoor/nature, ≤40 city, else mixed
  - a single stop gives "A <effort> <setting> day"
  - more than 4 stops, or over budget, gives "A long, packed day of …"
- Keep the line under 60 characters.

- [ ] **Step 4: Verify**

Run `npm test`, `npx tsc -b` and `npm run build`. All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/daySummary.ts src/lib/daySummary.test.ts && git commit -m "feat: per-factor day summary"
```

---

### Task 5: Navigation, the Trips list and "Add to trip"

**Files:**
- Create: `src/pages/Trips.tsx`, `src/components/planner/AddToTrip.tsx`
- Modify: `src/App.tsx` (routes `/trips`, `/trips/new`, `/trips/:id`, placed before the `/:country…` route), `src/components/Chrome.tsx` (tabs), `src/components/MapCards.tsx` (`PinCard` gets an "Add to trip" button), `src/pages/Attraction.tsx` ("Add to trip"), `src/styles.css` (new section "/* ---------- Trips ---------- */")

**Interfaces:**
- Consumes: `useTrips` (Task 2); `placeLabel`, `placeCover` (Task 3).
- Produces:
  - `AddToTrip({ attractionId, place }: { attractionId: string; place: PlaceRef | null })`, a button plus a popover:
    - with no trips, it navigates to `/trips/new` with router state `{ seed: { place, attractionId } }`
    - otherwise it lists trips (last-used first), then days for the chosen trip, and calls `addStop`, or `addUnplanned` when "Unplanned" is picked
    - if no place in the chosen trip covers the attraction (`coveringPlace` is null), it also calls `addPlace(trip, { level: 'prefecture', id: '13' })`
    - last-used is remembered in `sessionStorage` key `fitline.lastTripDay`
  - `/trips/new` and `/trips/:id` render a simple "Coming in the next task" placeholder for now
- Nav:
  - TopNav links: Explore (`/`), Trips (`/trips`), Saved (opens the drawer)
  - BottomTabs: Explore, Trips, Saved
  - Trips is active for `/trips*`, Explore for `/` and `/map*`
  - The "Tokyo" link is removed from both; CityPicker stays

- [ ] **Step 1: Routes and tabs**

- [ ] **Step 2: Trips page**

- Each card shows the cover (`placeCover` of the first stop's place, else of the first place), name, place names, dates or "N days", and the planned stop count.
- Delete has an undo toast (`restore`).
- Empty state: heading "Plan your first trip" and a "New trip" button.

- [ ] **Step 3: AddToTrip on PinCard and the attraction page**

The `place` passed is `{ level: 'area', id: a.area }`.

- [ ] **Step 4: Verify**

- Run `npm test`, `npx tsc -b` and `npm run build`.
- Screenshots:
  - `/trips` empty at 1440 and 390
  - with one trip seeded via js (`localStorage.setItem('fitline.trips', …)`, then reload)
  - the attraction page with the AddToTrip popover open
  - the phone tab bar showing Explore, Trips, Saved

- [ ] **Step 5: Commit**

```bash
git add -A src && git commit -m "feat: Trips tab, trips list and Add to trip"
```

---

### Task 6: MapExplorer additions for planning

**Files:**
- Modify: `src/map/MapExplorer.tsx`, `src/styles.css`

**Interfaces:**
- Produces new optional `MapExplorer` props, all defaulting to today's behaviour:
  - `tones?: Record<string, 'today' | 'other'>`: an attraction id gives its ticker the class `is-today` (cedar) or `is-other` (the second colour). Others keep the default style. Tickers with a tone are raised above untoned ones in `layoutTickers` priority.
  - `tour?: boolean` (default `true`): `false` turns off the world-level tour, its card and the Tokyo live pin.
  - `litCountries?: string[]`: worldIds lit on `fl-dest` with a feature-state `picked` (cedar fill 0.75). Countries that aren't destinations are lit on `fl-world-fill` with `picked` (cedar fill 0.5).
  - `onWorldPick?: (worldId: string) => void`: when set, a world-level click calls it instead of `onCountry`.

- [ ] **Step 1: Implement the props**

The second tone colour is the builder's choice within the tokens; it should read as related to cedar but clearly different (e.g. the Vibe line hue or a muted cedar). Add `--c-plan-other` to `:root`.

- [ ] **Step 2: Verify**

- Run `npm test`, `npx tsc -b` and `npm run build`.
- Screenshot `/` and `/map/japan/tokyo` at 1440×900 to confirm no regression (the tour still runs, the tickers look the same).
- Behaviour with the new props is checked in Tasks 7–8.

- [ ] **Step 3: Commit**

```bash
git add src/map/MapExplorer.tsx src/styles.css && git commit -m "feat: map props for trip planning (tones, lit countries, no tour)"
```

---

### Task 7: New trip setup

**Files:**
- Create: `src/pages/TripNew.tsx`, `src/components/planner/PlacePicker.tsx`, `src/components/planner/TripSettings.tsx`
- Modify: `src/App.tsx` (route element), `src/styles.css`

**Interfaces:**
- Consumes: `useTrips().create` (Task 2); `ALL_PLACES`, `placeLabel` and `sameRef` (Task 3); MapExplorer `tour={false}`, `litCountries` and `onWorldPick` (Task 6).
- Produces:
  - `PlacePicker({ value, onChange }: { value: PlaceRef[]; onChange(next: PlaceRef[]): void })`, which renders:
    - a globe (MapExplorer at world level, tour off, `onWorldPick` set), where clicking any country toggles it; the globe doesn't drill down
    - when Japan is picked, a row of quick chips for Japan's 8 regions toggles them
    - a search over `ALL_PLACES` with sections Destinations, Regions of Japan, Prefectures and Tokyo wards
    - chips of picked places in order, each removable; places where `attractionsIn` is empty carry the note "No checked attractions yet"
  - `TripSettings({ value, onChange })` over `{ name, startDate: string | null, endDate: string | null, days: number, who, pace, dayStart }`:
    - start and end dates and the number of days stay in sync (`daysBetween`)
    - clearing the dates keeps the number of days
  - TripNew page:
    - Step 1 is places, Step 2 is settings
    - "Create trip" calls `create` and navigates to `/trips/:id`
    - a router state `seed` (from AddToTrip) pre-picks the place and puts the attraction in `unplanned`
    - the default name is "<first place> trip"

- [ ] **Step 1: PlacePicker**

- [ ] **Step 2: TripSettings**

Native `<input type="date">` and `<input type="time">` are fine; pill radios for who's going and pace.

- [ ] **Step 3: TripNew page and the create flow**

- [ ] **Step 4: Verify**

- Run `npm test`, `npx tsc -b` and `npm run build`.
- Screenshots:
  - `/trips/new` at 1440 and 390
  - js-click Japan on the globe and add "Kansai" via search: two chips, with Japan lit
  - Step 2: set dates and check the number of days updates
  - "Create trip": lands on `/trips/<id>`, and `localStorage['fitline.trips']` holds the trip

- [ ] **Step 5: Commit**

```bash
git add -A src && git commit -m "feat: new trip setup with places and settings"
```

---

### Task 8: Planner page: map, places, days and the stop list

**Files:**
- Create: `src/pages/Planner.tsx`, `src/components/planner/DayList.tsx`, `src/components/planner/PlaceSwitcher.tsx`
- Modify: `src/App.tsx`, `src/components/MapCards.tsx` (`PinCard` takes an optional `action` node so the planner can show "Add to Day N", "Remove from Day N" or "On Day N: move here"), `src/styles.css`

**Interfaces:**
- Consumes:
  - `useTrips` and the operations (Task 2)
  - `placeView`, `attractionsIn` and `placeLabel` (Task 3)
  - `schedule` and `travelMin` (Task 3)
  - MapExplorer `tones` and `focusPrefs` (Task 6)
  - `PinCard`
- Produces:
  - **Planner page:**
    - `/trips/:id`; an unknown id redirects to `/trips` with a notice
    - **State:** current day index, current place index, selected attraction id, replace target (`{ day, id } | null`)
    - **Top bar:** trip name, editable inline and saved through `update`; `PlaceSwitcher`; "+ Add place", which opens `PlacePicker` in a sheet; a settings button, which opens `TripSettings` in a sheet and applies `setDays` or a date change
    - **Map:** `MapExplorer` with `target` and `focusPrefs` from `placeView(current place)`. `pins` = `attractionsIn(current place)`. `tones` = current-day stops `'today'`, other days' stops `'other'`. `wheelScrollsPage` false.
    - **Search** top-left over the current place's attractions; picking one opens its card.
  - `PlaceSwitcher({ places, index, onPick, onAdd, onRemove })`. Removing a place asks first only about stops that no remaining place covers (`coveringPlace` over the other places), with the copy "<n> stops are in <place>. Remove them too?".
  - `DayList({ trip, day, onDay, onRemove, onMove, onReplace, onOpen })`:
    - day tabs labelled "Day N" plus " · Tue 14 Apr" when dated
    - scheduled stops: photo, name, kind, start time, duration
    - "≈ N min" between stops
    - up and down, remove (with an undo toast), replace
  - When the current place has no attractions, the list area shows "No checked attractions yet" and the map still frames the place.

- [ ] **Step 1: Planner shell, map and place switching**

- [ ] **Step 2: DayList with schedule, reorder and remove**

- [ ] **Step 3: Adding from the card and the search**

- [ ] **Step 4: Verify**

- Run `npm test`, `npx tsc -b` and `npm run build`.
- Screenshots at 1440×900, from a seeded 3-day trip with places Japan and Italy and dated 2027-04-12:
  - add 2 stops to Day 1 and 1 to Day 2 via js clicks on tickers and "Add to Day N"
  - Day 1 pins in cedar, Day 2 in the second colour
  - stop times and the travel line render
  - switch to Italy: map framed, "No checked attractions yet", no console errors
  - shorten the trip to 1 day: Day 2's stop goes to Unplanned

- [ ] **Step 5: Commit**

```bash
git add -A src && git commit -m "feat: trip planner map, places, days and stop list"
```

---

### Task 9: Day summary panel, replace mode and trays

**Files:**
- Create: `src/components/planner/DaySummaryPanel.tsx`, `src/components/planner/Trays.tsx`
- Modify: `src/pages/Planner.tsx`, `src/components/planner/DayList.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `summarizeDay` and `DaySummary` (Task 4); `useSaved` (Task 1); `replaceStop`, `planUnplanned` and `addStop` (Task 2).
- Produces:
  - `DaySummaryPanel({ summary }: { summary: DaySummary })`:
    - the one-line summary
    - rows Effort, Conditions, Vibe, Logistics and Cost, in each factor group's line colour (`LINES`), with these visuals:
      - effort: per-stop bars with the hardest highlighted
      - vibe: a two-part nature/city bar
      - logistics: "used of budget, incl. travel"
      - cost: a range
    - flags listed under their row
    - an empty day shows "Add stops from the map or search"
  - **Replace mode:**
    - clicking replace on a stop sets the replace target, and the list header shows "Pick a replacement for <name>" with a Cancel button
    - the next add from the card, search or a tray calls `replaceStop` instead of `addStop`
    - Escape cancels
  - `Trays({ trip, day, onPlan })`: two collapsible trays under the list:
    - "Unplanned" (`trip.unplanned`)
    - "Saved" (`useSaved().ids`)
    - each item has "Add to Day N" (or, in replace mode, "Use as replacement")

- [ ] **Step 1: DaySummaryPanel**

- [ ] **Step 2: Replace mode**

- [ ] **Step 3: Trays**

- [ ] **Step 4: Verify**

- Run `npm test`, `npx tsc -b` and `npm run build`.
- Screenshots, with Mount Takao and teamLab Planets on a dated Tuesday:
  - the summary shows "Hardest stop: Hard (Mount Takao)", a nature/city split and a book-ahead flag
  - replace Mount Takao with a Saved-tray item: same position
  - Escape leaves replace mode

- [ ] **Step 5: Commit**

```bash
git add -A src && git commit -m "feat: day summary panel, replace mode and trays"
```

---

### Task 10: Wet weather, phone layout and docs

**Files:**
- Create: `src/components/planner/WetPlan.tsx`
- Modify: `src/pages/Planner.tsx`, `src/components/planner/DayList.tsx`, `src/styles.css`, `DESIGN.md`, `README.md`

**Interfaces:**
- Consumes: `getRainChance` and `isLikelyWet` (Task 3); `addWet` and `removeWet` (Task 2); `isRainProof` (`factors.ts`); `summarizeDay` (Task 4, for the wet list's time and cost).
- Produces:
  - **Day tabs:** a rain mark plus "N% rain" when `isLikelyWet(getRainChance(dayPlace(trip, d), dateOf(trip, d)))` is true.
  - **Rain-sensitive stops:** on likely-wet days, stops listed in `summary.conditions.rainSensitive` show "Poor in rain · <covered>% covered".
  - `WetPlan({ trip, day, open, onAdd, onRemove })`, the "Wet-weather plan" section:
    - open by default on likely-wet days, collapsed otherwise
    - lists `day.wet` with remove
    - an "Adding to: Day N / Wet-weather plan" toggle in the panel decides where the next add from the card, search or trays goes
    - wet-list stops get no pin colour; an attraction can be on the day and in its wet list; "move here" and replace mode apply to day lists only
    - attractions that aren't rain-proof are greyed with "Not rain-proof" and can't be added
    - shows a short time and cost line
- **Phone planner:**
  - the map on top, the day panel as a bottom sheet
  - the peek holds the day tabs and the one-line summary; drag or scroll it up for the list, summary, trays and wet plan, reusing `GuideSheet`'s approach where practical
  - pin cards dock at the bottom
  - the place switcher scrolls horizontally under the search
- **Docs:** DESIGN.md and README.md describe the Trips tab, routes, storage, summary rules and the mock forecast interface.

- [ ] **Step 1: Rain marks and flags**

- [ ] **Step 2: WetPlan**

- [ ] **Step 3: Phone layout**

- [ ] **Step 4: Docs**

- [ ] **Step 5: Verify**

- Run `npm test`, `npx tsc -b` and `npm run build`.
- Screenshots:
  - a trip dated 2027-06-20 (rainy season): rain marks on the day tabs, Mount Takao flagged, the wet plan open
  - add a rain-proof attraction to the wet plan; a non-rain-proof one is greyed
  - phone 390×844: peek with day tabs and the one-line summary; scrolled shows the list and summary
  - `document.documentElement.scrollWidth <= 390`
- [ ] **Step 6: Commit**

```bash
git add -A src DESIGN.md README.md && git commit -m "feat: wet-weather plans, phone planner and docs"
```
