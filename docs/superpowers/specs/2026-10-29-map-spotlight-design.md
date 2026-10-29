# Map spotlight, neighbourhoods, in-view browsing and the flat map — design

Date: 2026-10-29. Status: approved by the user, 2026-10-29.

## Why

When you plan a trip in Fitline, the map shows roughly where things are, but not *exactly*. You can't
easily tell which street an attraction is on, or what else is a short walk away. The user wants to:

- zoom from a country down to a neighbourhood (Japan › Tokyo › Harajuku) and see every attraction there;
- browse a list of what's on screen as they move the map, the way Airbnb lists homes, without the
  screen getting crowded next to their day plan;
- pick an attraction and have the map zoom in close enough to see the exact spot and the streets
  around it, with nearby attractions still visible;
- zoom back out through the breadcrumb;
- switch to a flat map in natural colours (the Google Maps look) instead of the tilted 3D buildings.

Success: in the planner, a user can go Japan › Tokyo › Harajuku › Miyashita Park and back out,
finding and adding places as they go, and the map reads as clearly as Google Maps at street level.

## Goals

1. **Neighbourhood level** under Tokyo, used by the planner map and breadcrumb.
2. **In-view list** in the planner: at the neighbourhood level, the list shows the attractions
   inside the current map view and updates as the map moves.
3. **Day folds to a strip** while browsing (layout "C" from the brainstorm), so the day stays in
   sight without a second panel.
4. **Spotlight** on one attraction: flat, close-in view centred on it, neighbours within a
   10-minute walk labelled, the rest shown as quiet dots, the attraction as the last breadcrumb crumb.
5. **Map / 3D toggle**: a flat "Map" style in a Google-Maps-like palette (the default), and today's
   3D style a tap away. The choice is remembered.

## Non-goals

- **Routes or travel directions.** No walking route from a station, no ring. A transport module
  comes later.
- **Neighbourhood outlines on the map.** Neighbourhoods are points with a frame, not polygons.
- **Neighbourhoods for cities other than Tokyo.** The app only has Tokyo attractions. The knowledge
  base gets the new level and Tokyo's rows; other cities come later.
- **Satellite imagery** or a third map style.
- **Changing the Explore page's ward pages** (`/map/japan/tokyo/<ward>`) to neighbourhoods. Explore
  gets the Map / 3D toggle only. (My call.)

## Anti-goals (would count as failure even if it works)

- The planner screen feels busier than today on a 13" laptop or a phone.
- The spotlight zooms so close you lose the area, or so far you can't read the street names.
- The flat map looks like a grey wireframe instead of a natural, colourful map.
- Leaving the spotlight or a neighbourhood loses the user's day, filters or scroll.

## What exists today (for the builder)

- `src/map/MapExplorer.tsx`: one MapLibre map for Explore, the planner and the place picker. Globe
  at world level; region and area levels tilt (pitch 48 / 55) with `fl-buildings` 3D extrusions from
  zoom 12.5. A `2D`/`3D` button (`toggleTilt`, `tilted` state, not remembered). Planner uses
  `markers="dot"` (numbered today stops) and `bubbles` (count bubbles above the attraction level).
- `src/map/style.ts`: `restyle()` recolours OpenFreeMap's positron style into the app palette and
  adds relief, buildings, light and sky. `src/components/AttractionMap.tsx` uses it for the still
  map card on attraction pages.
- `src/lib/placeTree.ts`: the planner's level tree. Japan → regions → prefectures; Tokyo prefecture
  is the attraction level; Tokyo's wards (`area` refs from `src/data/geo/tokyo.json`) are a filter
  inside it. `PlaceRef.level` is `'country' | 'region' | 'prefecture' | 'area'`. URL `?place=&view=`.
- `src/components/planner/Browse.tsx` + `src/lib/browse.ts`: the Browse sub-tab beside Plan in the
  day panel. Lists the viewed place's attractions (`browsePool`), with filter chips and per-row
  add / remove / move / replace actions.
- `src/pages/Planner.tsx`: the day panel floats on the right on laptop; on phone it's a draggable
  bottom sheet. Laptop hover previews a dot's card (`peekId`); click pins it.
- `src/data/attractions.ts`: 16 mock Tokyo attractions, each with an `area` (ward code) and `lonlat`.
- `kb/`: the places knowledge base. `JP-P-TOKYO` is a planning unit; v1 puts nothing below planning
  units (`kb/scripts/check.py` flags it as an error).
- The throwaway spike at `.superpowers/spike/flat-map/` (git-ignored) shows the flat palette and the
  spotlight working on real tiles. Treat its colours as the starting point, not its code.

## Design

### 1. Neighbourhood level

**Data, app side.** A new hard-coded list, `src/data/neighbourhoods.ts`: for each Tokyo
neighbourhood an `id` (matching its knowledge-base `place_id`, e.g. `JP-N-TOKYO-HARAJUKU`), English
name, local name, centre `[lon, lat]`, and a frame (a bounding box, or a centre plus radius in
metres) for zooming to it. Each mock attraction gets an explicit `neighbourhood` id. Every mock
attraction must belong to exactly one neighbourhood, including the outliers (Mount Takao → "Takao",
Ghibli Museum → "Mitaka & Kichijōji"); naming those is the builder's call.

Starting list (my call, travellers' names, not wards): Shibuya, Harajuku & Omotesandō, Shinjuku,
Asakusa, Ueno, Yanaka, Ginza & Tsukiji, Odaiba & Toyosu, Oshiage (Skytree), Ryōgoku, Kiyosumi,
Shimokitazawa, Nakano, Setagaya (Todoroki), Mitaka & Kichijōji, Takao. Only neighbourhoods with at
least one attraction show a bubble.

**Tree.** `PlaceRef` gains a `'neighbourhood'` level. Tokyo prefecture stops being the attraction
level: its children are its neighbourhoods (count bubbles), and each neighbourhood is the attraction
level. `placeTree` functions (`children`, `parent`, `attractionLevel`, `isKnownPlace`,
`placeAnchor`, `parseRefKey`, `pathTo`, `attractionHome`) learn the new level. The ward filter at
Tokyo goes away in the planner (neighbourhoods replace it). Existing saved trips whose places are
Tokyo or a ward must still open; a ward trip place keeps working as today.

**Camera.** Clicking a neighbourhood bubble frames the neighbourhood (its frame, or its attractions
plus padding, whichever is larger), flat or tilted per the Map / 3D setting.

**Knowledge base.** Add a `Neighbourhood` level type and Tokyo's neighbourhood rows under
`JP-P-TOKYO` in `kb/data/curated/JP.txt`, matched to Wikidata like other rows. Update
`kb/scripts/check.py`: a planning unit may have children only of level type `Neighbourhood`. Rebuild
`kb/fitline-places.xlsx`. Ids must match `src/data/neighbourhoods.ts`.

### 2. In-view list

- At the attraction level (a neighbourhood), the Browse list shows only attractions whose pin is
  inside the visible map area, not under the day panel or sheet. It updates when the map stops
  moving (on `moveend`, not every frame).
- The header says how many: "12 in view". With none in view: a short line suggesting zooming out.
- Filter chips, row actions, hover-to-light and the wet-weather toggle work as today.
- Above the attraction level (Japan, a region, Tokyo), the list behaves as today.
- `MapExplorer` reports its visible bounds (respecting insets) through a new callback; the list
  filters on the planner side.

### 3. Day folds to a strip (layout C)

- While the Browse view is showing, the day panel's top part (day header, times, wet toggle,
  Analysis, Plan/Browse switch) folds into **one strip**: "Day 1", then the day's stops as small
  numbered thumbnails, then an "Open" control.
- Tapping the strip (or "Open") returns to the Plan view with the full day.
- Adding a place from the list drops its thumbnail into the strip, with a short highlight.
- The Plan view keeps an obvious way into browsing (today's Browse tab, relabelled with the in-view
  count where there is one).
- **Phone:** the same inside the bottom sheet. The strip is pinned at the top of the sheet; the list
  scrolls under it. Dragging the sheet works as today.
- Mockup: `.superpowers/brainstorm/1606-1793245105/content/browse-layout.html`, option C.

### 4. Spotlight

**Entering.** Clicking an attraction's dot on the map, or its row in the in-view list, opens the
spotlight (the card opens as today).

**Camera.** Flat (pitch 0) regardless of the Map / 3D setting. The attraction **centred** in the
free map area (clear of the day panel on laptop, above the sheet on phone). Zoom fixed at about 16
on laptop so street names are readable; the builder tunes the exact value per width. (Centred with a
fixed zoom is my call; the alternative, fitting all neighbours, pushes the pick off-centre.)

**Markers.**
- The picked attraction: a dark name pill pointing at its exact spot.
- Neighbours within 800 m (about a 10-minute walk, straight-line distance): normal dots with their
  names shown.
- Every other attraction: small grey dots, no names.
- No ring, no route.

**Moving on.** Clicking a neighbour moves the spotlight to it and re-centres.

**Leaving.** The breadcrumb gains the attraction as its last crumb (Japan › Kantō › Tokyo ›
Harajuku › Miyashita Park). Clicking any crumb zooms out to that level. Esc, closing the card, or
the browser's Back steps out to the neighbourhood view. The URL carries the spotlight (e.g.
`&spot=<attractionId>`) so a reload or shared link lands in it.

**Scope.** The planner. Explore's attraction tickers keep their current behaviour.

### 5. Map / 3D toggle and the flat palette

- The `2D`/`3D` button becomes a two-option toggle: **Map | 3D**.
- **Map** (default): pitch 0, no `fl-buildings`, and a Google-Maps-like palette. From the spike:
  land `#f5f5f3`, residential `#f1f1ef`, parks `#c6e9c0`, woods `#b9e0b0`, water `#9fd3ef`, minor
  roads white with a `#dadce0` edge, major roads white with `#c9ccd1` casing, motorways `#fde59a`
  with `#f0c25e` casing, rail `#b8bcc2`, labels `#5f6368` / `#3c4043`, station names `#2f6fd6`,
  hospitals `#fbe3e3`, schools `#ecebf6`, shopping areas `#fcefe1`. English names as today. Road
  names visible at street zoom. Relief stays at low zooms.
- **3D**: today's look and tilt, unchanged.
- The choice is remembered across pages and reloads (localStorage; read in a try/catch, defaulting
  to Map).
- Applies to every `MapExplorer` (Explore, planner, place picker). The world globe is unchanged in
  both. Attraction page map cards (`AttractionMap`) always use the Map palette (they're flat and
  still).
- Switching restyles the live map without reloading it or losing the camera.

## Constraints

- Stack as today: React 19, TypeScript, MapLibre GL 6, OpenFreeMap tiles (no Google tiles or keys).
- Laptop and phone (≤ 760 px) both supported; reduced-motion respected for camera moves.
- Keep the 261 existing tests passing; add tests for the new pure logic (tree with neighbourhoods,
  in-view filtering, neighbour selection within 800 m, spotlight URL parsing, style preference).
- Map attribution stays visible and clear of panels.

## Left to the builder

- Exact zoom values, padding, animation timing, the strip's visual details within the mock.
- Neighbourhood frames and centres, and names for the outlier neighbourhoods.
- How the style toggle swaps paint properties (one style function per mode, or diffs).
- Component structure inside the planner.

## Calls made after the builder check (mine, for the user to check)

- **Every way of opening a card opens the spotlight**: a map dot, an in-view row, a day-list stop,
  search, and "See it on the map". One entry point (`openStop`). Entering the spotlight pushes a
  history entry, so Back leaves it; everything else in the planner keeps using `replace`. Closing
  the card leaves the spotlight.
- **The in-view list freezes during the spotlight**: it keeps showing what was in view before
  entering, and keeps its scroll. Leaving the spotlight returns the camera to where it was, so the
  list matches again.
- **Neighbourhoods are map-only in v1**: not trip places, not in search or the place picker, not
  saved in trips. `'neighbourhood'` refs live only in the map tree and the `&view=` URL value;
  trip validation (`trips.ts` `LEVELS`), `ALL_PLACES`, forecasts and Explore targets don't accept
  them. Wards stay pickable and keep working exactly as today.
- **A ward trip place stays an attraction level** with Tokyo as its parent (breadcrumb
  Tokyo › Shibuya ward › Miyashita Park). The in-view list, strip and spotlight hang off the general
  "attraction level" check, so ward places get them too. Going up to Tokyo from a ward shows
  Tokyo's neighbourhood bubbles.

## Decided by the user after the builder check

- **Pins and breadcrumb at the neighbourhood level.** Inside a neighbourhood the map shows every
  Tokyo attraction as a dot, not only that neighbourhood's. The in-view list follows the viewport, so
  panning from Harajuku into Shibuya brings Shibuya's places into the list. The breadcrumb stays on
  the neighbourhood the user chose; panning does not change it. It changes only when the user clicks
  another neighbourhood's bubble, or opens the spotlight on an attraction in another neighbourhood
  (the crumb then shows that attraction's neighbourhood). Spotlight neighbours (within 800 m) and the
  grey dots come from all of Tokyo, not only the current neighbourhood.
- **More mock data.** Add about 12–15 mock attractions with full factor data (conditions, effort,
  vibe, logistics, cost, hours, photos as the existing ones have) clustered around Shibuya,
  Harajuku & Omotesandō, Shinjuku and Asakusa, so the spotlight and in-view list can be tried
  properly. Real places, believable details; same shape and quality bar as the existing 16. Existing
  tests that count attractions are updated to match.
