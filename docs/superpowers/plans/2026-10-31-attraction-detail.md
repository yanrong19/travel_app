# Attraction detail and spotlight tweaks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Clicking a dot no longer recentres the map; the attraction page's Cost shows only on-site costs; best times fit the user's day; the factors section reads calmer.

**Architecture:** One data clean-up, one `MapFocus` flag, one pure `bestTime` module feeding a reworked Conditions row, then a layout pass over the five factor rows.

**Tech Stack:** React 19, TypeScript, MapLibre GL 6, Vitest.

**Spec:** the user-approved proposal (chat, 2026-10-31), restated in each task below. Mockup reference: summary strip of 5 verdict tiles; Conditions headline "Best 09:00–10:30" + one sentence; timeline over the user's day with crowd bars, best band, dashed "your stop" box; chips for clipped curated moments; Cost lists entry and on-site extras only.

## Global Constraints

- Default day window `DAY_START = '09:00'`, `DAY_END = '19:00'` from `src/lib/trips.ts`.
- Weekday index 0 = Monday (as `logistics.hours`); weekend = indices 5, 6 → `vibe.crowds.weekend`.
- Crowd curves cover hours 06:00–23:00 (`CROWD_START_HOUR = 6`), `null` = closed.
- Line endings: keep each file's own (`git ls-files --eol`); MapExplorer.tsx and styles.css are CRLF.
- All tests pass (`npm test`), `npx tsc -b` clean. Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `feat/attraction-detail`.

## Review Focus

1. A day window shorter than the visit, or a place closed the whole window → a clear "Closed during your day, opens HH:MM" / shortened block, never NaN or an empty headline.
2. Places open past midnight (Golden Gai, Omoide Yokochō: close ≤ open) and 24-hour places (`00:00`–`24:00`).
3. Attraction page outside the planner (no trip) and inside it (trip with/without dates, attraction on/off that day).
4. Reveal-open of an attraction in another neighbourhood: crumb switches, camera does not move.
5. Phone (≤ 760 px) for every UI change.

---

### Task 1: Cost shows only what you pay at the attraction

**Files:** Modify `src/data/attractions.ts`; tests as needed (`src/data/attractions.test.ts`, `src/lib/browse.test.ts`, others `npm test` flags).

- Remove every `cost.extras` entry that is travel to or from the attraction: labels starting `Return ` (metro, JR, train, "metro and Yurikamome") and `Taxi back after the last train`. Keep `Cable car round trip` (Mount Takao) — it is part of the visit. Also remove travel wording from `cost.freeNote` / `cost.cashNote` if any mentions fares.
- [ ] Test (attractions.test.ts): `no cost extra is transport` — no extra label matches `/^(return |taxi )/i` or `/yurikamome/i`; `mount-takao` still has an extra labelled `Cable car round trip`.
- [ ] Update count/list assertions that change because `mustPay` / the Free chip changed (only those).
- [ ] `npm test`, `npx tsc -b`; commit `fix: cost shows only what you pay at the attraction`.

### Task 2: Clicking a dot doesn't recentre the map

**Files:** `src/map/MapExplorer.tsx`, `src/pages/Planner.tsx`, `src/map/camera.ts` (+ test).

**Interfaces:**
- `MapFocus` spot variant gains `move: 'reveal' | 'fly'`.
- `export function revealDelta(p: [number, number], free: { left: number; top: number; right: number; bottom: number }, margin = 40): [number, number]` in `camera.ts`: the smallest pan (dx, dy, screen px) that brings point `p` inside `free` shrunk by `margin`; `[0, 0]` when already inside.

**Behaviour:**
- `move: 'reveal'`: no zoom, no centring, no pitch change. If the spot (and its pill) would be off-screen or under the card (`pickedClearOf`) / panels (insets), pan by `revealDelta`; else don't move. No camera is saved, so leaving the spot leaves the camera where it is.
- `move: 'fly'`: today's spotlight camera (fit neighbours, save/restore).
- Planner: a map dot click, a Browse row click and a neighbour click inside the spotlight open with `'reveal'`; the day list, wet plan, search, "See it on the map" and a reload/shared `&spot=` link use `'fly'`. Keep the move mode in a ref/state set by `openStop(sid, move)`; a URL-only load defaults to `'fly'`.
- A reveal-open whose attraction lives in another neighbourhood switches the breadcrumb (as today) but must NOT reframe the camera to that neighbourhood — not on entering, and not on leaving the spot. (The frame focus for a view reached this way must not fly; the next explicit crumb/bubble click frames as usual.)
- [ ] Tests for `revealDelta`: inside → `[0,0]`; left of free area → positive dx just enough; below → negative dy; corner → both.
- [ ] Browser check (headless, 1280×800 and 390×844): at Harajuku, click Takeshita Street's dot → camera centre/zoom unchanged (log `__flMap.getCenter()/getZoom()` before/after), pill + neighbour labels show; click a dot under the day panel edge → small pan only; Esc → camera unchanged; click Shibuya Sky's dot from Harajuku → crumb Shibuya, camera unchanged; day-list stop → flies as before.
- [ ] Commit `feat: clicking a dot keeps the map where it is`.

### Task 3: Best times fit your day

**Files:** Create `src/lib/bestTime.ts` + `src/lib/bestTime.test.ts`; modify `src/pages/sections/Conditions.tsx`, `src/pages/Attraction.tsx`, `src/styles.css`.

**Interfaces (minutes from midnight throughout):**
- `export interface DayWindow { start: number; end: number; label: string }` — label `"Day 1 · 09:00–19:00"` in planning, `"a 09:00–19:00 day"` otherwise.
- `export function crowdAt(a: Attraction, weekday: number, minute: number): number | null` — the hour's crowd value (weekday/weekend curve), `null` when closed or outside 06:00–23:00.
- `export function openSpans(a: Attraction, weekday: number): [number, number][]` — that day's opening span(s); close ≤ open means past midnight (close + 1440); `null` hours → `[]`.
- `export function bestWindow(a: Attraction, win: DayWindow, weekday: number): { kind: 'best'; from: number; to: number; why: 'quiet' | 'moment' } | { kind: 'closed'; opensAt: number | null }`:
  - visit length = mean of `logistics.visitMin`, cut to fit if the open part of the window is shorter;
  - candidate starts every 30 min within (window ∩ open spans), visit must end by min(window end, close);
  - score = mean crowd over the visit's hours (missing → 50) + slot penalty from `conditions.timeOfDay` for the start's slot (poor +40, ok +10; slots per `lib/timeOfDay`) − 15 × hours of overlap with any curated `conditions.bestTimes` window; lowest wins, ties → earliest;
  - `why = 'moment'` when the chosen block overlaps a curated window, else `'quiet'`;
  - no open time inside the window → `{ kind: 'closed', opensAt }` (that day's opening minute, or null if closed all day).
- `export function momentsIn(a: Attraction, win: DayWindow): { from: number; to: number; label: string }[]` — curated `bestTimes` clipped to the window; ones fully outside are dropped.

**Behaviour (Conditions row):**
- Headline `Best 09:00–10:30`, sentence `Quietest part of your day.` (`why: 'quiet'`) or `<moment label>, inside your day.` (`'moment'`); closed → headline `Closed during your day` + `Opens 10:00` / `Closed that day`.
- Visual: a timeline over the window only — hourly crowd bars (closed hours greyed), the best block as a band, ticks at start / middle / end; with a planned stop, a dashed "your stop" box over its time.
- Clipped moments as chips (`18:00–19:00 lit up after dark`); the old "Best windows" tile shows only clipped moments.
- `Attraction.tsx`: in planning (`inPlan`) use that trip day's `start`/`end`, its date's weekday (trip with dates) or today's, and the stop's scheduled `start`/`end` (via `schedule()` on that day's stops) when the attraction is on that day. Outside planning: default window, today's weekday, no stop. Show the window label in the factors header: `For Day 1 · 09:00–19:00` / `For a 09:00–19:00 day`.
- [ ] Tests (bestTime.test.ts), with real data: Sensō-ji on a weekday in 09:00–19:00 → best block starts at 09:00, `momentsIn` drops 06:00–08:00 and clips 18:00–21:00 to 18:00–19:00; a window 06:00–09:00 for a place opening 10:00 → `closed` with `opensAt` 600; Golden Gai (opens 19:00, past midnight) with window 18:00–23:59 → best block starts ≥ 19:00; a 24-hour place → candidates span the whole window; window shorter than the visit → block fits the window.
- [ ] Browser check: `/attraction/senso-ji` (no plan) and from the planner (Day 1 09:00–19:00 with Sensō-ji as a stop), laptop + phone.
- [ ] Commit `feat: best times fit your day`.

### Task 4: A calmer factors section

**Files:** `src/pages/Attraction.tsx`, `src/pages/sections/*.tsx`, `src/styles.css`, `src/lib/factors.ts` (if a helper is needed, with a test).

- Summary strip at the top of "Before you go": 5 tiles (Conditions, Effort, Vibe, Logistics, Cost), each label + one verdict (`readings(a)` words; Conditions may use the best-window headline); clicking a tile scrolls to / opens its row. A tile is tinted (warning) when its row has flags or a personal warning.
- Personal warning (planning, attraction on that day): the stop's mean crowd ≥ 70 → Logistics (or Conditions) tile reads `Busy at 12:13` and the row's sentence says `Your stop at 12:13 is in the busiest part of the day. Try 09:00–10:30.` (best block from Task 3).
- Rows with flags or a personal warning start open; the rest start folded.
- The paragraph notes under each row (`<Notes>`) become short lines attached to the tile they explain (e.g. `weatherNote` under Weather, `monthsNote` under Months, `cashNote` under Paying); drop duplicates.
- Months: highlight the trip's month(s) (planning trip with dates) or this month; other months render quieter (lower contrast), still labelled.
- Keep accessibility: rows remain buttons with `aria-expanded`; summary tiles are buttons/links with clear names.
- [ ] Browser check laptop 1280×800 + phone 390×844, outside and inside planning; compare with the mockup.
- [ ] Commit `feat: calmer factors section with a summary strip`.
