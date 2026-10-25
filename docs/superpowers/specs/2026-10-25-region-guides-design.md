# Region guides under the map — design

Date: 2026-10-25. Status: reviewed; waiting for the user's approval.

## Intent

Fitline's home is one MapLibre map from globe to Tokyo ward (`src/pages/Explore.tsx`, `src/map/MapExplorer.tsx`). Once someone flies into a country, they need two things the map alone can't give:

1. **A list of the sub regions they can pick from**, beside the map, linked to it both ways on hover, so picking is quick.
2. **More detail to help them choose**, without leaving the map: scroll down and region guides slide up over the map; scroll back up and the map returns.

The user wants it to be obvious that you can scroll down for more, and the transition between map and guides to feel smooth.

## Goals

- Country level (Japan): a right-hand list of Japan's 8 regions, each expanding to its prefectures; hover links list ↔ map.
- Scrolling down reveals region guides (one card per region) with enough detail to compare regions.
- A clear "there's more below" cue at the map view.
- A smooth, reversible, scroll-linked transition; scrolling back up returns to the map view.
- The same pattern at Tokyo level, with wards instead of regions.
- Works on laptop and phone.

## Non-goals

- Real data for regions other than Tokyo. Non-Tokyo values are mock, labelled "Rough guide", until the user's data pipeline supplies them.
- Region guides for countries other than Japan. Coming-soon countries (Italy etc.) keep the current pinned landmark card and no guides.
- Changes to the world (globe) level.

## Anti-goals (failure even if it works)

- Scroll hijacking: the page must never refuse to scroll or jump somewhere the user didn't ask for (beyond the gentle settle described below).
- A cue nobody notices. An arrow alone is not enough.
- Content duplicated in two places (the guides and a separate page saying the same thing).
- Losing the parts of the current Tokyo page the user likes (its ward covers, top picks and all-attractions grid move under the map; see "Decided after review").

## Decisions the user made

- **List content:** the 8 regions of Japan, each expanding to its prefectures. Tokyo sits under Kantō, marked Live.
- **Scroll feel:** the sheet slides over the map, following the scroll; if the user stops halfway it settles to the nearer end.
- **Japan's page:** the guides under the map replace the separate Japan page (`/japan`). The "Japan's page" button becomes "See region guides" and scrolls down.
- **Tokyo:** same pattern, wards in the list and ward guides when scrolling down.
- **Photos:** new downloads need the user's OK with a list of filename, source and size first (standing rule).

## Behaviour

### Japan, map view (scroll at top)

- Map as today (country level). Title card bottom-left ("Japan 日本").
- **Right-hand list panel** (desktop), frosted like the current Tokyo panel (`.panel` in `src/styles.css`):
  - Heading "Regions of Japan".
  - 8 rows: Hokkaidō, Tōhoku, Kantō, Chūbu, Kansai, Chūgoku, Shikoku, Kyūshū and Okinawa. Each row shows its Japanese name and status (Kantō: "Live · Tokyo"; others "Coming soon").
  - Clicking a row expands it in place to list its prefectures (accordion, one open at a time). Tokyo inside Kantō is marked Live.
- **Hover linking:**
  - Hover a region row → all its prefectures highlight on the map (feature-state on `fl-prefs`).
  - Hover a prefecture row → only that prefecture highlights.
  - Hover a prefecture on the map → its region row highlights (and, if that region is expanded, the prefecture row too).
- **Clicks:**
  - Tokyo (row or map) → fly to Tokyo, as today.
  - A coming-soon region row → camera fits that region's prefectures, the region stays highlighted, and a card like the coming-soon country card (photo, name, one-liner, "Coming soon", "Explore Tokyo meanwhile") is tethered to it. URL stays `/map/japan` (state only); Escape or "Zoom out" returns to all of Japan.
  - A coming-soon prefecture row or map shape → same as its region, with the prefecture highlighted more strongly (builder may simplify to the region).
- **Scroll cue (all three together):**
  1. A sheet peeks about 90px above the bottom edge, with a rounded top, a drag handle and the heading "Which part of Japan fits you?". It covers the bottom of the map, so the page visibly continues.
  2. A small label in the sheet header: "Scroll for region guides" with a chevron. The chevron nudges once after ~3 s without interaction, then stays still. No nudge under reduced motion.
  3. The top row of guide card photos sits just below the fold, so a small scroll reveals pictures.

### Scrolling down

- The map stays fixed behind. The guides are ordinary page content starting at `100svh − peek`.
- Scroll-linked, using progress `p` from 0 (top) to 1 (sheet reaches the sticky bar):
  - Map: brightness 1 → 0.6 and scale 1 → 0.97.
  - Title card: fades out and drifts up slightly by p = 0.4.
  - Right-hand list panel: fades and slides right by p = 0.4.
  - Search: stays visible (it's useful at both ends).
- **Settle:** if scrolling stops with 0 < p < 1, ease to the nearer end (p < 0.5 → top, else the guides). Lenis (already a dependency, used on the attraction page) provides smooth scroll and `scrollTo`.
- At p = 1 a **sticky bar** pins to the top: "Japan · 8 regions" on the left; on the right a tiny map thumbnail and "Back to map ↑". Clicking the bar scrolls to the top. Scrolling up past the top of the guides plays the transition in reverse.

### Region guides (Japan)

- One card per region, live first then the rest in geographic order (north to south).
- Card contents:
  - Photo.
  - Name and Japanese name, status (Live / Coming soon).
  - One-liner.
  - 12-month "best time" strip (green months).
  - Three tags: effort, crowds, cost.
  - Prefecture names as small text.
  - For coming-soon regions, a "Rough guide" label on the strip and tags.
- Hover a card → its region highlights on the sticky bar's tiny map (and on the main map behind, which is dimmed but visible).
- Click a card → scroll to the top, then do what clicking that region's row does.
- Under the region cards: nothing else for now (builder may add a closing line pointing back to the map).

### Tokyo, map view and ward guides

- Right-hand list shows Tokyo's wards with checked attractions (current `AREAS` in `src/pages/Place.tsx`: ward, Japanese name, count), most first. Hover links list ↔ map (feature-state on `fl-areas`, already supported). Click → ward level (`/map/japan/tokyo/<ward>`), as today.
- The current attraction list panel moves out of the right-hand slot: attractions remain on the map as tickers and appear in the guides (below) and at ward level.
- Scroll cue and transition identical to Japan; heading "Which part of Tokyo fits you?".
- Ward guide card: cover photo (first attraction in the ward, as `AREAS.cover` today), ward name and Japanese name, number checked, top 3 attraction names, tags (effort, crowds, cost) and best-month strip derived from that ward's attractions.

### Ward level

- Right-hand panel: the ward's attractions, as today.
- Scroll down: that ward's attractions as full cards with the filter chips (All, Rain-proof, Easy, Local, Free) from the current Tokyo page's "All attractions" section.

### Phone (≤ 760px)

- No right-hand panel. The peeking sheet holds the list as a horizontal row of chips (regions at Japan, wards at Tokyo); tapping a chip does what clicking a row does; hover linking becomes tap-to-highlight.
- Page scroll happens by dragging the sheet (one-finger drags on the map keep panning the map). Guides stack in one column. The sticky bar works as on desktop.

## Calls made after review (builder's calls, user can override)

- **Kantō (live region, not Tokyo):** clicking its row expands it and frames Kantō on the map, with no "Coming soon" card. Clicking the Kantō guide card or chip flies to Tokyo, the only live place in it. Kantō's other prefectures behave as coming-soon prefectures do today: highlight plus the "isn't mapped yet, Tokyo is first" notice.
- **Phone access to prefectures:** region chips only; prefectures stay reachable through the search, which already lists them.
- **Ward level:** it uses the same sheet component (cue, settle, sticky bar). Heading "In <ward>", sticky bar "<ward> · N places". The desktop panel and the guide grid share one filter state, so the chips in both places always agree. On phone the sheet's peek holds today's swipeable attraction row; the pin card stays.
- **Tokyo filters:** kept. At Tokyo level the filter chips move into the sheet header (peek), still drive which tickers show and what the camera frames, and also update the ward list counts and ward guides.

## Data

- New `src/data/regions.ts`: the 8 regions with `id`, `name`, `ja`, `prefectures` (JIS codes, matching the numeric ids in `src/data/geo/japan-prefectures.json`), `oneLiner`, `photo`, `months` (12 ratings), `tags` (effort / crowds / cost words), `live`.
  - Codes: Hokkaidō 1; Tōhoku 2–7; Kantō 8–14; Chūbu 15–23; Kansai 24–30; Chūgoku 31–35; Shikoku 36–39; Kyūshū and Okinawa 40–47.
- Kantō's months and tags come from Tokyo's 16 attractions (derivation below); the other 7 regions use plausible mock values.
- Derivation from attractions (Kantō and each Tokyo ward):
  - Month is "good" when at least half the attractions rate it `good` (`conditions.months`).
  - Effort tag from the median `effort.level`: 1–2 Easy, 3 Moderate, 4–5 Hard.
  - Crowds tag from the mean of each attraction's weekend peak (`vibe.crowds.weekend`): < 45 Quiet, 45–70 Busy, > 70 Packed.
  - Cost tag from the median `cost.entry`: 0 Free, < ¥1,000 ¥, < ¥3,000 ¥¥, else ¥¥¥.
- **Photos:** Kantō uses `shibuya-sky`. The other 7 regions need one photo each from Wikimedia Commons, through the existing pipeline (`photos-src/`, `scripts/build-photos.mjs`, credits in `src/data/photo-credits.json`). The file list goes to the user for approval before downloading. Until approved, the cards show a neutral placeholder.

## Routes and navigation

- `/japan` redirects to `/map/japan` and scrolls to the guides (e.g. `/map/japan#guides`).
- Japan's coming-soon fallback page (`ComingSoon` in `Place.tsx`) stays for other countries' `/italy` style URLs.
- Tokyo place pages: see "Decided after review".

## Decided after review (the user's answers)

### The Tokyo page moves under the map

The separate Tokyo pages (`/japan/tokyo`, `/japan/tokyo/<ward>`, `LivePlace` in `src/pages/Place.tsx`) go, like Japan's. What the user likes about them moves into the scroll-down under the Tokyo map, in this order:

1. **Ward guides**: "Which part of Tokyo fits you?" (cards as described above). The photo hero's job, showing what each ward looks like, moves into these cards' cover photos.
2. **Top picks**: the current hero rail (Swiper with Navigation) of the best attractions; on phone, the current EffectCards swipe deck.
3. **All attractions**: the current grid with search and the filter chips (All, Rain-proof, Easy, Local, Free), sharing the one filter state that drives the tickers and the sheet-header chips.

At ward level the same three sections follow, scoped to the ward ("In Taitō"), with the ward guides replaced by a row of the other wards to hop between (the old ward chips).

Routes: `/japan/tokyo` redirects to `/map/japan/tokyo#guides`, and `/japan/tokyo/<ward>` to `/map/japan/tokyo/<ward>#guides`. The "Tokyo" nav tab (desktop and phone) points to `/map/japan/tokyo`. The attraction page's back button and "See it on the map" go to the ward on the map. The embedded map component (`src/components/HomeMap.tsx`) is no longer used and can be removed.

### Mouse wheel scrolls the page

At Japan, Tokyo and ward level on laptop, the wheel anywhere (map included) scrolls the page. The map zooms with Ctrl + wheel, trackpad pinch and the + and − buttons. The first time someone wheels over the map at the top of the page, a short hint appears: "Scrolling shows the guides. Use Ctrl + scroll to zoom the map." It's shown once per visit. One-finger drag still pans the map, on laptop and phone. The globe (world level) keeps wheel zoom, since it has no guides.

## Constraints

- Stack as today: Vite, React 19, TypeScript, react-router v7, MapLibre GL, motion, GSAP SplitText, Lenis, Swiper. No new dependencies needed.
- The map instance must not be rebuilt when moving between levels (one layout route in `src/App.tsx`).
- Respect `prefers-reduced-motion`: no nudge, no scale; the transition becomes a plain scroll.
- OpenStreetMap attribution stays visible.
- Type-check and build must pass. Verify with the headless screenshot script on laptop (1440×900, 1280×800) and phone (390×844), because the hidden browser pane pauses animation frames.

## Left to the builder

- Exact sizes, easing curves and timing (keep in the existing tokens and `EASE_OUT`).
- Component structure (e.g. a `RegionList`, `GuideSheet`, `GuideCard` split) and where scroll progress lives.
- How the settle detects "scrolling stopped".
- Wording of mock one-liners and tags for the 7 coming-soon regions (plain, well-known facts only).
- Whether the tiny map in the sticky bar is a static SVG outline (from the existing geo data) or a second small map; a static SVG is preferred for cost.
