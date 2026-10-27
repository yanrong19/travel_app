# Trip planner — design

Date: 2026-10-26. Status: draft for review.

## Intent

Fitline checks each attraction for five groups of factors people forget: Conditions, Effort, Vibe, Logistics and Cost. The trip planner turns that into a plan. Someone picks the places they're going (one or more countries, regions or wards), sets their dates, then fills each day with attractions from the map or the search. As they add stops, each day shows how it will look and feel across the five factor groups, so a day that is too long, too hard, too exposed to rain or too expensive is visible before the trip.

The planner must feel like part of the same app: same map engine, same cards, same search, same look. It replaces the "Tokyo" tab.

## Goals

- A **Trips** tab: a list of saved trips, creating a new one, and opening one to plan it.
- **Trip setup:** pick several places from the globe or the search; set dates (start and end, or a number of days) and a few settings.
- **Planner:**
  - A map of the current place with every attraction as a pin; switch between the trip's places and add more.
  - Day tabs; a right-hand list for the current day.
  - Add from the map (hover a pin for its name, click it for details, then "Add to Day N") or from the search.
  - Pins for the current day's stops are highlighted in one colour; stops on other days in a second, distinct colour.
- **Per-day summary:** one breakdown row per factor group, plus a one-line summary of the day. No single score.
- **Per-stop actions:** add, remove, reorder and replace. Replace = the next attraction picked takes the stop's place. No suggestions.
- **Wet weather (mock data):** a rain chance per day; rain-sensitive stops flagged on likely-wet days; an optional wet-weather list per day, limited to rain-proof attractions.
- **Nature vs city:** a new value under Vibe, shown on the attraction page and used in the day summary.
- **Saved trips:** a trip is kept and can be reopened later.
- Works on laptop and phone.

## Non-goals (for now)

- **Suggestions or recommendations** (for replacing a stop or for wet-weather plans). The user plans to build a knowledge base of attractions per region and country, with a relationship map between attractions, and suggestions will come from that later. Shape the data so a relationship graph can be attached later (stable attraction ids, factor fields on the attraction), but build no recommender.
- **A real weather forecast.** It will come from a weather API later. Use mock rain chances behind an interface the API can replace.
- Accounts, a server, sharing or syncing trips between devices.
- Attractions outside Tokyo. Only Tokyo has checked attractions. Other places can be added to a trip but show "No checked attractions yet" (builder's call, see "Calls").
- Booking, tickets or transport routing beyond a travel-time estimate between stops.

## Anti-goals

- **Averaging a day into one number or word that hides its hard or risky parts.** A hard hike plus an easy museum must not read as "Moderate". The summary shows each factor in the way that suits it (below).
- A planner that feels like a separate app: different map, different cards, different visual language.
- **Losing a trip.** Edits save as they happen; there's no "Save" button to forget.
- Automatically swapping a user's stops (wet weather is reference only).

## Decisions the user made

- The Tokyo tab goes; a Trips tab takes its place.
- Places are picked from the globe or the search; more than one is allowed; they can be countries or regions or wards; more can be added later.
- Dates: start and end, or a number of days; plus other settings the builder sees fit (see "Settings" below for what was proposed).
- The planner's map opens on the first place, with a switch between places.
- Pins: hover shows what it is; click shows details and lets you add it.
- Current day's stops and other days' stops are highlighted in different colours.
- Day tabs Day 1 … Day N.
- **Day summary:** a per-factor breakdown with a one-line summary, no overall score (the user approved the mockup with the rows Effort, Conditions, Vibe, Logistics, Cost and the line "Big outdoor morning, easy city afternoon").
- Add, remove and replace stops; replace has no suggestions for now.
- Nature vs city goes under Vibe.
- Wet weather: build the per-day rain chance, flags and a user-built wet-weather list now, with mock data.
- Trips are saved and can be reopened.

## Behaviour

### Navigation

- TopNav links (desktop): **Explore**, **Trips**, **Saved**. BottomTabs (phone): **Explore**, **Trips**, **Saved**. The Tokyo tab is removed from both; its route `/map/japan/tokyo` stays reachable from the map.
- Attraction page and map PinCard gain an **"Add to trip"** button.
  - With no trips, it starts a new trip with that attraction's place picked and the attraction waiting in the trip's Saved list.
  - With trips, it opens a small picker (trip, then day). The last-used trip and day come first.
- The hearted **Saved** list stays as it is (drawer). Inside the planner it appears as a "Saved" tray of attractions that can be dropped into a day.

### Trips list (`/trips`)

- Cards for each saved trip: name, places, dates (or "N days"), number of planned stops, and a cover photo (the first stop's photo, else the first place's photo).
- "New trip" button. Delete a trip from its card, with an undo toast.
- Empty state: an invitation ("Plan your first trip") with the New trip button.

### New trip (`/trips/new`)

**Step 1: places.**
- A globe (the same MapLibre view as the home page's world level) plus the level-aware search.
- Clicking a destination country, a Japan region or prefecture, or a Tokyo ward toggles it in the trip. Picked places appear as removable chips in order.
- Places without checked attractions can be picked, with a "No checked attractions yet" note on their chip.

**Step 2: settings.**
- Trip name (default "<first place> trip").
- Dates: start and end date, or a number of days without dates (the two stay in sync).
- Who's going: solo, couple, family or friends (the data already rates `vibe.suits` for these).
- Pace: relaxed, normal or packed. It sets the default day length used by the time budget: relaxed 8 h, normal 10 h, packed 12 h.
- Day start time (default 09:00).

"Create trip" opens the planner on Day 1 at the first place.

### Planner (`/trips/:id`)

**Layout (desktop).**
- The map fills the page, as on Explore.
- Top bar:
  - the trip name, which can be edited inline
  - place switcher pills and "+ Add place"
  - a settings button (reopens Step 2)
- Right-hand panel (frosted, like the map page's panel):
  - a day dropdown with dates if set ("Day 3 · Tue 14 Apr"), the rain mark and "N% rain" on likely-wet days, and the stop count (revised 2026-10-27: was day tabs)
  - two sub-tabs under it, "Plan" (the day's stop list and summary) and "Wet-weather plan"; the open sub-tab decides where adds from the card, search and Saved tray go
  - the trip's Saved tray, on both sub-tabs
- The search sits top-left, as on the map page; picking an attraction there opens its card.

**Map.**
- The current place is framed as the map page frames that level (country, region or ward).
- Every attraction in view is a pin (the existing tickers).
- Pin colours:
  - stops on the current day use cedar, the existing accent
  - stops on other days use a second colour that reads as related but distinct
  - all other attractions use the default ticker style
- Hovering a pin shows its name. Clicking opens the existing PinCard with "Add to Day N" (or "Remove from Day N" if already in the current day; "On Day 2: move here" if on another day).

**Stop list.**
- Each stop shows photo, name, kind, its planned start time and duration.
- Times are derived: day start time, then each stop's visit time (the midpoint of `logistics.visitMin`) plus queue (midpoint of `logistics.queueMin`), plus travel between stops.
- Travel estimate: straight-line distance between `lonlat` points, in two bands. Up to 2 km: walking, distance × 1.3 at 4.5 km/h. Over 2 km: train, 15 min fixed transfer plus distance at 35 km/h. Rounded up to 5 minutes. Shown between stops as "≈ 25 min". (Revised in the final review: the single × 1.4 at 18 km/h formula was far off for long hops.)
- Actions per stop:
  - move up and move down (drag to reorder on desktop is optional for the builder)
  - remove (with an undo toast)
  - **replace**: puts the list in replace mode for that stop ("Pick a replacement for Mount Takao"). The next attraction added from the map, search or trays takes its place. Escape or a Cancel button leaves replace mode.
- The trip's Saved list (its "Saved" tray) collects attractions saved for the trip from outside a day (e.g. "Add to trip" from the attraction page, or the planner card's Save toggle). They can be added to any day and stay in Saved once planned. (Revised 2026-10-27: this replaced the "Unplanned" tray.)

**Day summary** (updates live; per factor, never averaged):

- **One-line summary** at the top, built from the stops' order, setting and effort. For example:
  - "Big outdoor morning, easy city afternoon"
  - "A long, packed day of museums"
  - "Gentle city day, mostly indoors"

  The builder writes the phrase rules: morning = stops starting before 12:00, afternoon and evening after. Effort words come from the effort levels and the setting from the nature value. Keep it short and plain.
- **Effort:** the hardest stop's level and name ("Hardest stop: Hard (Mount Takao)"); total time on your feet (sum of `effort.onFeetMin` plus travel walking); one small bar per stop in order, the hardest highlighted. Flags:
  - two stops of level 4 or more back to back
  - total on-feet time over 6 h
- **Conditions:** the weakest stop decides.
  - Weather exposure in words: "Morning needs dry weather; afternoon is rain-proof". Uses `conditions.weather.rain` and `conditions.covered`, with the existing `isRainProof` rule.
  - Season fit when dates are set: flag any stop whose `conditions.months` rating for that month is `poor` ("Out of season in April").
- **Vibe:** shown as a split, not a score.
  - Nature vs city share of the day's time, weighted by each stop's visit time, as a two-part bar ("60% nature · 40% city").
  - Touristy vs local in words from `vibe.local`.
  - Crowd warning when a stop's crowd curve at its planned hour (weekend or weekday from the date; weekday if no dates) is 70 or more.
- **Logistics:**
  - Time budget: "8 h 10 of your 10 h day, incl. 1 h 40 travel" (day length from pace). Over budget is flagged.
  - Opening hours: flag a stop that is closed on that weekday (`logistics.hours[day] === null`) or whose planned time falls outside its hours.
  - "Book ahead" when `logistics.booking` is `required`.
- **Cost:** day total from must-pay costs (the existing `mustPay`) to all-in (`withExtras`), shown as a range ("¥4,500 – ¥5,400"). Cash-only flag when any stop is `cash-only`.
- An empty day shows an invitation ("Add stops from the map or search") instead of the summary.

**Wet weather (mock).**
- Each day with a date has a rain chance (0–100%) from a mock forecast. Days without dates have none.
- **Mock forecast:** a pure function of date and place that returns stable values (the same trip shows the same chances every time). Tokyo's rainy season (June to mid July) and typhoon months (August to September) are higher. Put it behind an interface such as `getRainChance(place, date): number | null`, so a weather API can replace it later.
- Days at 50% or more are "likely wet". There:
  - The day gets a rain mark in the day dropdown and on its Wet-weather plan sub-tab.
  - Rain-sensitive stops get a flag ("Poor in rain · 0% covered").
  - The **wet-weather plan** is a second, optional list for that day, on its own sub-tab. While that sub-tab is open, adds from the map, search and Saved go to it, but only rain-proof attractions can be added; others are greyed with "Not rain-proof".
  - Its own short summary shows: total time and cost.
- The wet-weather list exists for every day and can be filled on any day.
- It is reference only: nothing swaps automatically.

**Places.**
- Switching place pills reframes the map. Stops stay on their days regardless of place.
- "+ Add place" reopens the place picker as a sheet.
- Removing a place with planned stops asks first ("3 stops are in Taitō. Remove them too?").

### Nature vs city

- New field `vibe.nature: number` (0 = city, 100 = nature), mirroring the existing `vibe.local` scale.
- Fill it for the 16 Tokyo attractions (builder's judgement, plain and defensible; e.g. Mount Takao high, teamLab low, Meiji Jingu mid-high).
- Show it in the Vibe group on the attraction page in the same style as the touristy/local value, and use it in the day summary split.
- Add it to the data contract in `src/data/types.ts` so the future pipeline fills it.

### Phone (≤ 760px)

- **Trips list and setup:** single column.
- **Planner:** the map on top, with the day list as a bottom sheet.
  - The sheet peeks with the day dropdown and a one-line summary; the sub-tabs open the sheet's content.
  - Drag it up for the full list, summary and wet-weather plan, as the map page's guide sheet does.
- Pin cards dock at the bottom as on the map page.
- The place switcher scrolls horizontally under the search.

## Data and storage

- **Trips are saved in the browser** (localStorage), under a new key, e.g. `fitline.trips`:
  - a list of trips: `{ id, name, places, startDate?, days, who, pace, dayStart, plan, createdAt, updatedAt }`
  - `places`: ordered refs such as `{ level: 'country' | 'region' | 'prefecture' | 'area', id }`
  - `plan`: per day `{ stops: attractionId[], wet: attractionId[] }`, plus the trip's `saved: attractionId[]` (it replaced `unplanned`)
  - Saving happens on every change. Reads tolerate missing or corrupt data, starting fresh with a notice if it can't be parsed. Include a `version` field.
- The existing hearted list (`src/lib/trip.tsx`, `TripProvider`/`useTrip`, key `fitline.trip`) is the "Saved" feature, and its name now collides with real trips. Rename it in code to `SavedProvider`/`useSaved` (file `src/lib/saved.tsx`) and keep reading the old storage key, so nobody's hearts are lost.
- Summary maths lives in pure, unit-tested functions (Vitest is set up). The same goes for the travel estimate and the mock forecast.

## Routes

- `/trips`: trips list.
- `/trips/new`: setup.
- `/trips/:id`: planner. An unknown id → `/trips` with a notice.
- Routes must sit so the existing `/:country/:region?/:area?` place redirect doesn't catch `/trips`.

## Constraints

- Same stack: Vite, React 19, TypeScript, react-router v7, MapLibre GL, motion, GSAP SplitText, Lenis, Swiper, Vitest. No new runtime dependencies.
- Reuse what exists: MapExplorer, tickers, PinCard, MapSearch, GlobeCard and globe, KineticTitle, GuideSheet patterns, chips, tokens and the frosted surfaces. The planner's map is its own map instance (it's a separate page from Explore).
- Follow `DESIGN.md` and `PRODUCT.md` (photo-led, rounded cards, frosted glass, pill controls, Metro line colours for factor groups).
- `prefers-reduced-motion` respected. OpenStreetMap attribution visible. Phone breakpoint `max-width: 760px`.
- Type-check, tests and build pass. Verify with the headless screenshot script on laptop and phone.
- Precondition: the unfinished final-review fixes on the `region-guides` branch are finished, reviewed and committed first. The planner builds on that branch.

## Calls the builder made (user can override)

- Only Tokyo has attractions; other picked places show "No checked attractions yet" rather than getting new mock data sets.
- Settings beyond dates: name, who's going, pace (relaxed 8 h, normal 10 h, packed 12 h), day start time.
- Travel estimate: up to 2 km, walking (× 1.3 at 4.5 km/h); over 2 km, train (15 min + distance at 35 km/h); rounded up to 5 min.
- Likely wet = rain chance ≥ 50%.
- The wet-weather list only accepts rain-proof attractions (existing `isRainProof`).
- Hearts become a tray inside the planner; "Add to trip" from the attraction page and PinCard.
- Rename the hearted list's code to Saved; keep its storage key.

## Calls made after review (builder's calls, user can override)

- **Picking places.**
  - On the setup globe, a click picks or unpicks a country. Any country can be picked.
  - Deeper places come from the search, which lists regions of Japan, prefectures and Tokyo wards, or from a row of quick chips for Japan's 8 regions shown when Japan is picked.
  - The setup globe doesn't drill down.
- **Stops aren't owned by places.**
  - A stop's place is derived from its attraction's ward.
  - The current place's pins = attractions inside it. Japan, Kantō and Tokyo all show every Tokyo attraction, and the map frames those levels as Explore does.
  - "Remove a place" only asks about stops that no remaining place covers.
  - The planner search covers the current place's attractions.
  - "Add to trip" for an attraction no trip place covers also adds Tokyo (prefecture 13) to the trip's places.
- **A day's rain chance** uses the place of the day's first stop. An empty day uses the trip's first place. The saved format doesn't change.
- **The wet-weather list.**
  - The open sub-tab (Plan or Wet-weather plan) decides where the next add goes (revised 2026-10-27: was an "Adding to" toggle). It stays when the day changes and is kept in the URL as `&tab=wet`.
  - Wet-list stops get no pin colour of their own.
  - An attraction can be on a day and in that same day's wet list.
  - Moving a stop between days and replace mode apply to the Plan sub-tab only.
- **The trip's Saved list** (revised 2026-10-27). In the planner the pin card's heart becomes a "Save" / "Saved" toggle for the trip's Saved list. The one tray, "Saved", offers "Add to Day N" (or "Add to wet-weather plan"), shows "On Day M" for planned items, offers "Use as replacement" in replace mode, and has a remove button with Undo. The global hearted list is unchanged elsewhere.
- **Who's going.**
  - A Vibe flag when a stop's `vibe.suits[who]` is `poor` (e.g. "Not great for families").
  - It's a warning only; nothing is hidden.
- **"Add to trip" with no trips** opens `/trips/new` pre-filled with the attraction's Tokyo place, and the attraction waits in the trip's Saved list. A trip always gets its settings in Step 2. The picker offers the trip's days plus "Save to trip".

## Left to the builder

- Exact visuals within the design system, including the second pin colour and the rain mark.
- Component split and file layout (e.g. `src/pages/Trips.tsx`, `src/pages/TripNew.tsx`, `src/pages/Planner.tsx`, `src/lib/trips.ts`, `src/lib/daySummary.ts`, `src/lib/forecast.ts`).
- Phrase rules for the one-line day summary.
- Whether reordering is buttons only or also drag.
- The mock forecast's exact numbers.
