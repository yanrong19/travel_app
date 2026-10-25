# Fitline design

Photo-led, light and airy, set by the user's reference boards (travel app mockups with big photos, rounded cards and frosted glass). Tokens live in `src/styles.css` `:root`.

## World
- **Ground** misty `#eef2f4`, white surfaces, ink `#10191b`, muted `#56636a`.
- **Primary** deep cedar green `#0e4f47` (buttons, saved state, map data areas). Hearts turn `#e0245e` when saved.
- **Factor groups** keep Tokyo Metro line colours as small marks only (station rings, meters, chart bars): Conditions `#009bbf`, Effort `#e60012`, Vibe `#9c5e31`, Logistics `#00a27a`, Cost `#f39700`. Each has `-soft`, `-track` and `-ink` tints.
- **Glass** only over photos: `rgba(255,255,255,.16–.24)`, 1px white 38% edge, `blur(18px) saturate(150%)`. On light ground use frost `rgba(255,255,255,.78)`.
- **Radius** 32 / 24 / 18 / 12, pills 999. **Shadows** soft and long, only on things that float over photos or the map.
- **Type** Anybody (variable width) for place names only, animated letter by letter by `KineticTitle`; Figtree for everything else; Zen Kaku Gothic New for Japanese.

## Signature moves
- **Weather lens** on home: pick Sunny, Rainy, Hot or Windy and every card re-sorts with a badge saying how it copes.
- **Photo morph**: the tapped card photo becomes the next page's hero (View Transitions, `MORPH_NAME`).
- **Metro line stepper** in the factor sheet: the five factor groups are stations; tapping one switches the sheet.

## Layout rules
- Laptop home: full-bleed photo hero, glass nav, huge place name, search and lens on the left, side carousel of cards on the right.
- Attraction: sticky photo panel left, factor chips right; on phones the photo leads and a frosted save bar pins to the bottom.
- Map: MapLibre with OpenStreetMap data from OpenFreeMap (positron style, recoloured in `restyle()`). A shaded-relief globe at world level that spins until touched, a fly-to into Japan, then Tokyo tilted about 50 degrees with 3D buildings from zoom 12.5. Tickers (photo, name, must-pay price) float above; colliding ones fold to photo dots. The OpenStreetMap credit must stay visible.
- Photos need a dark neutral scrim under any white text. Credit every photo (`/credits` and on each hero).
