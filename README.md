# Fitline

A travel web app prototype that shows, for each attraction, the factors people forget to weigh before adding it to a trip: weather and season, effort, vibe and crowds, logistics, and real cost. Tokyo only for now, with sample data.

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
- `src/pages/` – the map and its guides (`Explore.tsx`, the home page), Attraction, Credits, and `Place.tsx` for coming-soon countries
- `src/components/guides/` – the sheet under the map: region and ward guide cards, lists and the sticky bar's mini map
- `src/map/MapExplorer.tsx` – the 3D map (MapLibre with OpenStreetMap data from OpenFreeMap)
- `scripts/build-geo.mjs` – rebuilds the country, prefecture and Tokyo ward shapes
- `scripts/build-photos.mjs` – makes web-sized photos from `photos-src/`
- `PRODUCT.md`, `DESIGN.md` – product notes and the design system

## Credits

Photos from Wikimedia Commons, credited on the `/credits` page. Map data © OpenStreetMap contributors, tiles by OpenFreeMap. Japan boundaries from GSI Global Map Japan via `jpn-atlas`; world boundaries from Natural Earth via `world-atlas`.
