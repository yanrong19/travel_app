# Fitline

A travel web app prototype that shows, for each attraction, the factors people forget to weigh before adding it to a trip: weather and season, effort, vibe and crowds, logistics, and real cost. It also plans trips day by day and reads each day factor by factor. Tokyo only for now, with sample data.

## Run it

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

To make a production build: `npm run build` (output in `dist/`), and `npm run preview` to serve it.

## Project layout

- `src/data/attractions.ts` – the sample attraction data (`src/data/types.ts` is its shape)
- `src/pages/` – the map and its guides (`Explore.tsx`, the home page), Attraction, Credits, `Place.tsx` for coming-soon countries, and the trips pages (`Trips.tsx`, `TripNew.tsx`, `Planner.tsx`)
- `src/components/planner/` – the planner's day list, day summary, wet-weather plan, trays, place picker, and the trip's dates (the new-trip form and the planner header's popover)
- `src/lib/trips.ts` – the trip model and its pure operations; `tripsStore.tsx` saves it; `daySummary.ts`, `schedule.ts` and `forecast.ts` read a day; `tripPlaces.ts` and `placeTree.ts` map a trip's places (what each covers, and the level tree behind the planner map)
- `src/components/guides/` – the sheet under the map: region and ward guide cards, lists and the sticky bar's mini map
- `src/map/MapExplorer.tsx` – the 3D map (MapLibre with OpenStreetMap data from OpenFreeMap)
- `scripts/build-geo.mjs` – rebuilds the country, prefecture and Tokyo ward shapes
- `scripts/build-photos.mjs` – makes web-sized photos from `photos-src/`
- `PRODUCT.md`, `DESIGN.md` – product notes and the design system

## Trips

The **Trips** tab (it replaced the old Tokyo tab; Tokyo is still on the map) holds the trip planner.

- **Routes:** `/trips` lists your trips, `/trips/new` sets one up on one page (places, with the name, dates or a day count and "Create trip" beside them), and `/trips/:id` is the planner: the map with the trip's places, day tabs, the day's stops in order with travel times, the day summary, a wet-weather plan, and the trip's Saved tray. "Add to trip" on an attraction page or a map pin card adds to a trip, or starts one.
- **Map levels** (`src/lib/placeTree.ts`): attractions show on the planner map only at the level where that scale makes sense, the "attraction level". Each place has children: Japan → its 8 regions → their prefectures, and Tokyo is the attraction level (its wards stay a filter inside it); a country outside Japan is the attraction level itself, as a small country like Singapore will be. Above the attraction level the map shows a count bubble per child ("Kantō · 16", "Kansai · coming soon") instead of pins, and a breadcrumb (Japan › Kantō › Tokyo) goes back up. The viewed place is kept apart from the trip's places and lives in the URL as `&view=region:kanto` beside `?place=`. Searching above the attraction level searches every attraction in the trip and jumps to the attraction's place before opening its card. The tree is hard-coded for now behind `nodeOf`, `parentOf` and `pathTo` (a `PlaceTree` source); later the knowledge base supplies it per country, along with each country's attraction level.
- **Dates in the planner header:** beside the trip's name, "10–12 Nov · 3 days" (or "3 days" undated) opens a popover (a sheet on phone) with the start and end dates and the number of days, kept in step as the new-trip form does, and "Clear dates", which keeps the days. Changes apply as they are made; fewer days that would take stops or wet-weather plans off their days wait for "Cut to N days", which moves those stops to Saved and can be undone.
- **Day times:** there is no who's going and no pace. Each day has its own start and end time (`DayPlan.start` / `end`, 'HH:MM'), 09:00 and 19:00 for a new day; `setDayTimes` changes them (the end must be after the start, and a day doesn't run past midnight, so the latest end is 23:59). The schedule starts at the day's start and the time budget is the gap between them.
- **Storage:** trips live in this browser's localStorage under `fitline.trips` (a versioned list). There are no accounts and no syncing. If the stored data can't be read, the raw text is copied to `fitline.trips.backup` before anything is written. The last trip and day you added to are remembered for the visit in sessionStorage, under `fitline.lastTripDay`. Trips saved before per-day times are migrated on load: the old trip-wide `dayStart` becomes each day's start and the old pace gives its end (relaxed 8 h, normal 10 h, packed 12 h after the start, up to 23:59); a trip with neither gets 09:00 to 19:00. Fields a trip no longer has (`who`, `pace`, `dayStart`) are dropped on the next save; the storage version stays 1.
- **Day summary rules** (`src/lib/daySummary.ts`). Never one score: each factor group gets its own row and its own flags.
  - **Effort:** the hardest stop decides. Time on your feet counts each stop's walk from and back to the station. Flags for two hard stops in a row and for over 6 h on your feet.
  - **Conditions:** any stop that isn't rain-proof makes its part of the day (morning, or afternoon and evening) need dry weather. Rain-proof means rain isn't "poor" and at least 60% is covered. Flags for stops out of season in that month.
  - **Vibe:** the nature and city split, and the local or touristy word, weighted by time at each stop. Flags for crowds of 70% or more at the planned hour (weekday or weekend curve).
  - **Logistics:** time used against the day's own budget, from its start to its end time, including travel between stops (mock estimate from straight-line distance, rounded up to 5 min: up to 2 km it's a walk, distance × 1.3 at 4.5 km/h; further it's the train, 15 min plus distance at 35 km/h). Flags for going over, for a stop closed that weekday or visited outside its hours, and for "Book ahead".
  - **Cost:** must-pay to with-extras range, and the most cash-bound stop sets the cash level. Flags for cash-only stops.
  - **The one line:** the day in up to two parts (morning, then afternoon or evening), each named by its hardest effort (easy, moderate or big) and its setting (outdoor, city or mixed). A day with more than 4 stops or over its time is "a long, packed day".
- **Mock forecast** (`src/lib/forecast.ts`): `getRainChance(place, date): number | null` returns a rain chance from 0 to 100, or null for a day without a date. It is a pure function of the place and date: a monthly baseline for Japan (rainy season June to mid-July, typhoons August to September) plus repeatable noise, so the same trip always shows the same chances. A day's place is its first stop's place, or the trip's first place. Days at 50% or more (`LIKELY_WET`) are likely wet: the tab gets a rain mark, rain-sensitive stops are flagged and the day's wet-weather plan opens. A weather API can replace the function without other changes.
- **Wet-weather plan:** an optional second list per day, rain-proof attractions only, for reference. Nothing swaps automatically. An "Adding to: Day N / Wet-weather plan" switch decides where the next add goes.
- **Parked for later:** suggestions and recommendations (for replacing a stop or filling a wet-weather plan). They will come from a future knowledge base of attractions per region and country, with a relationship map between attractions. Attraction ids are stable and factors live on the attraction so that graph can attach later.

## Credits

Photos from Wikimedia Commons, credited on the `/credits` page. Map data © OpenStreetMap contributors, tiles by OpenFreeMap. Japan boundaries from GSI Global Map Japan via `jpn-atlas`; world boundaries from Natural Earth via `world-atlas`.
