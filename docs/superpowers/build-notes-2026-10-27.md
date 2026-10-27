# Calls made during the build (region guides and trip planner)

Each line: what was decided — why — what it costs if wrong. Collected from the build logs on 2026-10-27.

## Region guides (branch region-guides)

- work on branch region-guides in place, not a separate worktree — the dev server (port 5174) and the screenshot script serve this folder — cost if wrong: none beyond a branch switch.
- T6 may modify src/map/MapExplorer.tsx — the interface requires it — cost if wrong: none
- T6 copies markup into TokyoSections and leaves Place.tsx untouched; T7 deletes the old code — keeps the app working between tasks — cost if wrong: brief duplication for one task
- median uses the lower middle for even lengths, as the plan states, although MapExplorer's own median takes the upper — the plan's rule is explicit — cost if wrong: a tag can differ by one band on even-length lists.
- rough summaries have count 0; Task 5 must show "Nothing matches this filter" only for live derived data, never on rough cards — cost if wrong: coming-soon cards wrongly show the empty message.
- useGuideScroll root typed RefObject<HTMLElement | null> instead of the plan's RefObject<HTMLElement> — React 19 useRef(null) needs it — cost if wrong: none.
- scrollToGuides/scrollToTop also jump immediately under reduced motion — matches the spec's "transition becomes a plain scroll" — cost if wrong: no smooth click-scroll for reduced-motion users, which is intended.
- Task 3's .guides gets min-height so the page is always tall enough for p to reach 1, even with placeholder content — the hook's settle needs max scroll ≥ innerHeight − PEEK − barH — cost if wrong: extra empty space under short guides.
- MapExplorer gets an `attributionHost` prop so OSM attribution renders in a fixed host above the sheet at guide levels — the constraint says attribution visible at every scroll position — cost if wrong: one extra prop.
- on phone the peek sits 8px above the tab bar and the existing attraction row and pin card are lifted above it (not the reverse) — the sheet continues below its peek — cost if wrong: Task 7 moves the row into the peek anyway.
- data-lenis-prevent added to the search results list (MapSearch.tsx) and saved drawer (Chrome.tsx) — without it wheel scrolls the page instead of those lists — cost if wrong: none.
- nav and search stay above the sheet at every scroll position; the sticky bar pins just below them (desktop: at the search's top with left padding so the search sits in the bar; phone: below the search) — spec says search stays visible at both ends — cost if wrong: ~130px of chrome over the guides on phone.
- browser scroll restoration turned off while Explore is mounted — Back must land at the top of a level per Review Focus 1 — cost if wrong: Back never restores a mid-guide scroll position.
- viewport height has one source — useGuideScroll writes --vh from window.innerHeight and CSS uses var(--vh, 100svh) — plan mixed 100svh (CSS) with innerHeight (hook), which drifts on mobile when the toolbar retracts — cost if wrong: guides start position can jump slightly when the toolbar retracts.
- MapExplorer gets onPrefPick (map click on a coming-soon prefecture) and CardSubject gains `anchor` — both forced by the brief's own rulings (prefecture click must open its region; placeCard tethers by anchor) — cost if wrong: none, additive.
- regionBounds/regionAnchor added to src/data/regions.ts, shared by camera and card tether, dropping far-flung prefecture parts (Tokyo's Ogasawara) — without it Kantō's bounding box spans half the Pacific — cost if wrong: none, a clear bug fix.
- the −0.45 narrow zoom step-back now applies only at ticker levels (region/area), not country level — its own comment always scoped it to ticker labels, and country-level phone framing for every country gets slightly larger/more correct as a side effect (checked Italy 3.25→3.70, looks better) — cost if wrong: other coming-soon countries' phone framing shifts; easy single-line revert.
- the phone Japan title card compacts to "Japan 日本" + "All of Japan" while a region is framed (hides crumbs/line/other buttons) — no alternative fits title card + peek + docked card on an 844px screen — cost if wrong: user may prefer keeping the full card with a smaller map band; easy to revisit.
- MiniMap uses CSS var(--cedar) instead of importing C from map/style.ts — that file imports maplibre-gl at module scope, so importing it would pull the map engine into the eager bundle instead of the lazy MapExplorer chunk — cost if wrong: one hex value duplicated.
- regions.ts exports mainLand (shared speck-dropping rule with MiniMap), RegionList.tsx exports regionStatus ("Live · Tokyo"/"Coming soon" shared copy), Task 4's pickChip renamed pickRegion — avoids duplicated logic/copy — cost if wrong: none, pure rename/export additions.
- ward level's GuideSheet content stays the Task 3 placeholder; TokyoSections' scope={wardId} branch exists (brief requires it, Task 7 needs it) but is unreachable/unverified until Task 7 wires ward level's sheet — cost if wrong: a latent bug in an unused branch, caught when Task 7 wires it.
- TokyoSections gained onWardHover (minimap hover parity with Japan) and dropped onOpen (GuideCard/row already navigate via useGo; a wrapper would double-fire) — API deviation forced by how Task 5's GuideCard actually works — cost if wrong: none, additive/removal of unused prop.
- Top picks (the rail/deck) now follow the active filter, not just ward guides/counts/tickers — not in the brief's literal enumeration, but consistent with "filters drive everything on the page" and the design doc's intent — cost if wrong: top picks could show fewer than 3 cards under a narrow filter; easy one-line revert to unfiltered ATTRACTIONS if the user prefers always-full top picks.
- phone peek at ward level keeps the .mrow attraction row in the floating .msheet above the fixed 90px peek rather than inside GuideSheet's peek slot — redoing PEEK as a variable would touch the settle maths across all three levels, out of scope for this task — cost if wrong: structural inconsistency vs Tokyo/Japan's peek-hosted chips, same visual result.
- scroll cue stays "Scroll for region guides" at Tokyo/ward (no replacement copy given) — matches Task 6's same call — cost if wrong: generic copy at non-Japan levels.
- MapExplorer's unused `embed` prop and `JAPAN_SOON` removed; `lens` prop left in place (defaulted, unused) since removing it cascades into the lens library — cost if wrong: none, dead code removal plus one harmless orphaned prop.
- scroll cue copy becomes "Scroll for ward guides" at Tokyo and "Scroll for the full list" at a ward; Japan keeps "Scroll for region guides" — the shared cue is plainly wrong below Japan — cost if wrong: two copy strings to change. To be applied in Task 7's fix round.
- Credits.tsx labels region photos "<Region>, Japan" instead of the raw id — the raw id read as a bug — cost if wrong: none.
- "Back from an attraction restores guides scroll + filter" (final review Important 5) is parked as a product question for the user — it changes behaviour beyond the spec — cost if wrong: Back keeps resetting to the map view with filter All.
- phone ward chips at Tokyo (spec says peek holds wards; plan put filter chips there) parked as a product question — spec contradicts itself — cost if wrong: phone users at Tokyo pick wards only via the guides or map.
- item 7 measures the panel instead of W − insets.right − 24 — the formula pushed the card onto the title card at 1280–1440px — cost if wrong: card may still clip the title card at ~1200px.
- landscape 844×390 got a padding clamp and a compact layout for ≤520px-tall screens (beyond the brief's "fix only if broken" — it was broken) — cost if wrong: one extra media query.

## Trip planner (branch trip-planner)

- Vibe cards reordered so they pair 2×2 (onlyHere last) — cosmetic layout fix beyond brief — cost if wrong: card order differs.
- trip ops — no-op returns the same object without bumping updatedAt; removeStop deletes (undo toast handles mistakes); addUnplanned ignores stops already on a day; setDays drops removed days' wet lists (stops go to unplanned) — wet lists are reference only — cost if wrong: a removed day's backup list is lost.
- the trips store writes to localStorage only after the first change, so unreadable data is never overwritten on load — cost if wrong: none.
- back up unreadable trips data to fitline.trips.backup before the first overwrite, and clamp days to 1..60 — anti-goal "losing a trip" — cost if wrong: one extra storage key.
- visitMin rounds the midpoint sum to whole minutes; mock forecast uses Tokyo's month baseline for all of Japan and a flat 30 elsewhere (±10 jitter) — mock data only — cost if wrong: Hokkaidō's rain chances look Tokyo-like.
- on-feet time counts each stop's station walk (walkMin) there and back, not train time — reading of "travel walking" — cost if wrong: on-feet totals a little high.
- the outside-opening-hours flag is included (spec requires it, brief omitted it); without a date it runs only when all open days share hours — cost if wrong: none.
- "New trip" row in AddToTrip popover, icon-only phone buttons, Unplanned disabled when already on a day — accepted — cost if wrong: small UI tweaks.
- trip card cover = first stop's own photo (spec) over the plan's placeCover-of-ward; storage notice must show on /trips (spec) — pre-review fix sent.
- tour={false} also stops the globe spin (spin is part of the tour); second tone --c-plan-other #4d7d75 muted cedar (avoids Vibe brown) — cost if wrong: setup globe doesn't turn.
- Task 7 extras accepted (PlacePicker footer prop, step 2 history entry, Back after create → /trips, exported coverOf/tripWhen) and defaults (3 days, couple; clearing a date clears both) — cost if wrong: small UX tweaks.
- in planning mode (litCountries set) all destinations share one low tint and every picked country is 0.75; home tour unchanged — Japan looked picked when it wasn't — pre-review fix sent.
- Task 8 MapExplorer extras accepted — tickers at country level when pins passed (Japan-place trips need pins), Tokyo prefecture fill fades on zoom, fixed invalid fl-pref-line zoom expression; minimal replace mode + Sheet.tsx dialog wrapper built early — cost if wrong: Explore's country level could now show tickers if pins were ever passed there (Explore passes [] at country level).
- phone OSM attribution hidden under the docked day panel is deferred to Task 10 (phone planner layout), which must keep it visible — Task 10 rebuilds the phone layout anyway — cost if wrong: attribution hidden on phone between tasks.
- travel line may read "≈ 1 h 40 min" over 60 min, and remove-place copy has a singular variant — clearer copy — cost if wrong: copy differs from the literal spec string.
- a replaced stop goes to Unplanned (not dropped) and replace gets Undo — anti-goal "losing a trip" — cost if wrong: Unplanned fills with replaced stops the user must clear.
- WetPlan props {trip, day, open, adding, onAdding, onRemove, onOpen} (toggle lives inside the section); optional peek param on useGuideScroll; search results not greyed in wet mode (card shows disabled Not rain-proof) — cost if wrong: minor API/UX differences from plan.
- travel estimate becomes two bands — ≤2 km walking (×1.3 at 4.5 km/h), >2 km train (15 min + ×1.3 at 35 km/h), round up to 5 — the spec's single formula gave ~4 h for a ~1.5 h train trip — cost if wrong: estimates still rough; real routing later.
- planner day/place kept in URL search params so Back from an attraction returns to the same day — cost if wrong: URLs carry ?day&place.
- train band has no ×1.3 detour factor (15 min + distance at 35 km/h) — ×1.3 gave 2 h 10 for Takao→teamLab — cost if wrong: long hops slightly optimistic.
- provider test covers the extracted tripsSync logic (no jsdom in repo); unreadable or cleared storage events are ignored so the tab keeps its trips; the save-failed banner may take part of the phone peek — cost if wrong: no rendered-provider test.

## Deferred small issues (not fixed)

- Task 1: minor (deferred): crowds/effort tests use one attraction, so mean/median aren't pinned (add a multi-item case, e.g. peaks 20+80 → Busy)
- Task 1: minor (deferred): MapExplorer's local median takes the upper middle while summary takes the lower; consider sharing one median
- Task 1: minor (deferred): "Tokyo summary is stable" test only checks count
- Task 1: minor (deferred): regionSummary uses r.rough! (non-null assertion)
- Task 2: minor (deferred): disabling the hook leaves atGuides/--gp stale; levelKey reset skipped when Lenis is null (use window.scrollTo fallback)
- Task 2: minor (deferred): barH change recomputes --gp but doesn't re-arm the settle
- Task 2: minor (deferred): first settle after resize may clamp against Lenis's stale limit (self-heals)
- Task 2: minor (deferred): onScroll and onResize identical; levelKey effect doesn't clear pending settle timer
- Task 2: minor (deferred): mouse scrollbar drag during an in-flight 0.7 s settle isn't cancelled
- Task 2: minor (deferred): held flag can stick true until the next pointer press if the release is swallowed
- Task 2: minor (deferred): scrollbar guard assumes pointerdown reaches window for scrollbar clicks (verify in Task 3 browser run)
- Task 3: minor (deferred): wheel hint fires on upward/horizontal wheel at gp 0 (gate on deltyY > 0); hint is once per mount, not per page load
- Task 3: minor (deferred): magic numbers duplicated between TS and CSS (90px peek in 6 places, MSHEET_BOTTOM 86, 188px, BAR_TOP 94/128)
- Task 3: minor (deferred): filter/transform stay on .map at gp 0 (perf on low-end phones)
- Task 3: minor (deferred): faded title card and panel still take clicks between gp 0.4 and 1
- Task 3: minor (deferred): phone — only the 90px peek scrolls the page; swipes on the map pan it (product check)
- Task 3: minor (deferred): faint frosted strip above the nav at p = 1 in s3-fix-desktop-guides.jpg
- Task 3: minor (deferred): Explore.tsx sheet geometry could move to a helper if it grows
- Task 3: minor (deferred): --vh written in useEffect, so first paint may use the svh fallback (useLayoutEffect would avoid a one-time shift on phones)
- Task 4: minor (deferred): phone Japan-level framing is tight (~170px of visible map) once title card + peek + docked card are all up; pre-existing squeeze, not new
- Task 4: minor (deferred): Explore.tsx grew ~90 lines for region focus state; pull into useRegionFocus hook if Task 6 repeats the shape for wards
- Task 4: minor (deferred): exact notice copy duplicated in Explore.tsx and MapExplorer's onPrefClick fallback (now dead there); export it once
- Task 4: minor (deferred): fl-pref-fill opacity transition (180ms) not gated on prefersReducedMotion
- Task 4: minor (deferred): map→list hover has no scroll-into-view; southern rows can be off-screen when highlighted
- Task 4: minor (deferred): pickChip sets openId which phone never reads; stale on narrow→wide resize
- Task 4: minor (deferred): hovered ref in MapExplorer could outlive its owning effect if the click/hover effect re-runs
- Task 4: minor (deferred): placeCard doesn't know about the 476px panel inset at Japan level; a northern/eastern coming-soon region's card could overlap the panel
- Task 4: minor (deferred, product sign-off worth getting): phone title card compacts to "Japan 日本" + "All of Japan" while a region is focused, hiding crumbs/line/Open-Tokyo/See-region-guides buttons — user may want this revisited
- Task 4: minor (deferred, product sign-off worth getting): the narrow zoom step-back fix reaches every coming-soon country's phone framing (not just Japan), e.g. Italy 3.25→3.70 — bigger/better-placed by inspection but unasked-for beyond Japan
- Task 5: minor (deferred): focus ring on card name button vanishes without :has() support (outline:none is unconditional, no @supports fallback)
- Task 5: minor (deferred, plan-mandated): `rough` prop drives caption + empty-state + live-dot in GuideCard; Task 6/7's attraction cards must not accidentally inherit a green dot from a missing `rough`
- Task 5: minor (deferred): live dot predicate duplicated (RegionList uses r.live, GuideCard uses !rough) — same drift risk regionStatus was created to prevent
- Task 5: minor (deferred): "Nothing matches this filter" branch is unreachable until Japan-level filtering exists
- Task 5: minor (deferred): MiniMap draw() runs sync on first Japan-level paint (~31k char SVG, one-off, not a leak)
- Task 5: minor (deferred, plan-mandated): clicking an already-framed region's card un-frames it with no visual cue (pickRegion toggle, inherited from Task 4's mandated handler)
- Task 5: minor (deferred): .minimap[data-kind='tokyo'] will letterbox inside its 56x32 box when Task 6 starts using it (viewBox fit is square)
- Task 6: minor (deferred): 0-match ward card's foot/line come from unfiltered list, contradicts "Nothing matches this filter" above it (Sumida shows attraction names it has 0 of under the active filter)
- Task 6: minor (deferred): wardCounts rebuilt unmemoized on every render at every level
- Task 6: minor (deferred): .search.is-plain fixed 340px width clips placeholder text between 761-1440px; needs max-width/flex instead
- Task 6: minor (deferred): search query narrows the grid but not the map/tickers, so "N matches" can disagree with what's pinned
- Task 6: minor (deferred): scroll cue still reads "Scroll for region guides" at Tokyo (shared copy) — fine per no-silent-copy-change rule, but should get a Tokyo-specific cue in Task 7 if desired
- Task 6: minor (deferred): .explore-attrib 188px phone lift still keys on [data-level='region'] for a row (attraction panel) that no longer renders there
- Task 6: minor (deferred): ward row aria-label has no unit ("Taitō 台東区 3"); is-empty is opacity-only with no screen-reader signal
- Task 7: minor (deferred): #guides never lands if the map fails; can pull the user late on a slow style load (skip if page already moved)
- Task 7: minor (deferred): report wrongly says .lens-mini is still used (dead CSS predating this task)
- Task 7: minor (deferred): back/forward onto a #guides history entry re-scrolls to guides (fits the hash; slight tension with "level starts at top")
- Task 7: minor (deferred): loose ~120px gap above picks heading at ward level; leftover lens prop and .lens* CSS
- Task 8: minor (deferred): Kansai credit date not ISO (harmless, not displayed)
- Final: minor (deferred): zoom buttons hidden on short laptop-height screens; :focus-visible on mouse-clicked inputs can trigger scrollToGuides; region card CTA still clipped by title card at ~1200px; region card too tall on 390px-tall screens; focus drops to body when title card goes inert
- Task 1: minor (deferred): Attraction.tsx keeps local name `trip` for useSaved(); natureWord middle band copy "Green and built"; nature test could assert finite
- Task 2: minor (deferred): two tabs can clobber each other (no storage-event re-read); saves happen in useEffect (a change just before closing could be lost); pass-through updates still re-render/write; dayStart not validated as HH:MM; no DST-boundary or bad-field load tests; no notice when localStorage itself throws
- Task 2: minor (deferred): single-slot backup overwritten on later corrupt loads; +Infinity days → 1 (not 60); backup write happens inside the useState initializer
- Task 3: minor (deferred): empty dayStart parses as 00:00 (not 09:00), no range clamp; sameRef compares raw ids ('1' vs '01'); attractionsIn returns the shared ATTRACTIONS array (callers must not mutate — matters for Task 8 sorting); no test that non-Japan countries use the flat baseline
- Task 4: minor (deferred): Flag type name collides with factors.ts Flag (alias in UI); line's "big" vs row's "Hard" vocabularies differ; dropping setting words can make a line read uniform; second part named from its first stop; weatherText duplicates the parts split; after-midnight starts on night openings compare against the wrong day; test gaps at the 12:00/17:00 boundaries, all-null crowds, empty-day fields
- Task 5: minor (deferred): focus can Tab out of the open AddToTrip popover; a day step with no enabled rows drops focus to body; outside-close uses mousedown only (pointerdown better on touch); focus lost after deleting a trip; single undo slot; notice claims a copy is kept even if the backup write failed and shows only on /trips; PinCard actions wrap one row taller on desktop; readLast type looseness
- Task 6: minor (deferred → carry into Task 8): .ticker.is-today/.is-other:not(.is-compact) specificity beats .is-hot/.is-picked z-index, so a hovered/picked toned ticker sits at z 4; fix with :not(.is-hot):not(.is-picked)
- Task 6: minor (deferred): tour flipping true mid fly-in can start the spin early; world tooltip copy with tour off
- Task 7: minor (deferred): two-digit years map to 19xx mid-typing; search section headings role=presentation (use group+aria-label); aria-controls points at missing element when closed; stale seed place ids not validated against ALL_PLACES; phone tab order (zoom buttons after Next); /trips guard redirect flashes setup for one frame
- Task 7: minor (deferred): MapSearch.tsx (Explore) likely has the same scrolling-list Tab issue (needs tabIndex=-1 + focusout close)
- Task 7: minor (deferred): creating guard never resets if create throws
- Task 8: minor (deferred): remove-place notice toast hides under the sheet backdrop; fl-pref-fill hover opacity change also affects Explore at zoom ≥ 8.5; Japan-zoom tickers cluster on Tokyo
- Task 9: minor (deferred): Escape doesn't leave replace mode while typing in search; Unplanned tray open-default fixed at mount; memo deps eslint-disable for date
- Task 9: minor (deferred): Undo silently no-ops if the plan changed after a replace (no "can't undo" message); toast+undo offered even when replace was a no-op
- Task 10: minor (deferred): README lists fitline.lastTripDay under localStorage (it's sessionStorage); phone docked card can cover its own pin; .plan-places row blocks map touches full-width (pointer-events); expanded OSM credit floats over sheet content; wet-switch transition without reduced-motion override; landscape phone gets cramped laptop layout

## Planner revisions (2026-10-27): trip Saved, day dropdown, wet sub-tab, level navigation

- region bubbles anchor at the land centroid, not regionAnchor (Kyūshū & Okinawa landed at sea) — cost if wrong: bubble positions differ from Explore's region card tether.
- phone peek 164 / sheet top 280 so dropdown, summary and full sub-tabs show — cost if wrong: ~300px map on a 844 phone, ~115px on a 667 phone.
- attractionHome pure fn; breadcrumb beside search ≥1168px so card back at 240; pickedClearOf pans map when card covers selected pin — cost if wrong: extra MapExplorer prop. Deferred: phone card leaves ~60px map (needs design call: shorter phone card or hide level row while card open).

Deferred:
- Deferred: view not held inside the trip place (Taitō trip can view Kansai via breadcrumb); counts global vs search trip-scoped; small-phone map height; chip block wraps tall on 800–1024px laptops; Save toggle visible text vs name; same-tree trip places pill highlight; later regions colliding when more data exists.
- Ruling: attractionHome pure fn; breadcrumb beside search ≥1168px so card back at 240; pickedClearOf pans map when card covers selected pin — cost if wrong: extra MapExplorer prop. Deferred: phone card leaves ~60px map (needs design call: shorter phone card or hide level row while card open).
- Part C: complete (c029ad0..689cd14, fix round 1/5 all addressed). Deferred: rapid double-open could open the earlier card (practically unreachable); 761–1167px card at 284px may cover other tickers.

## Attraction page while planning + morning/afternoon/evening factor (branch planner-detail, 2026-10-27)

- teamLab morning stays ok (its data says first slots are calmest); flag tests use a tweaked copy; screenshots use Golden Gai at 10:00 — the brief's teamLab example contradicted the data — cost if wrong: none.
- Sensō-ji evening 'ok' (grounds never close, lit up after dark); Tokyo National Museum evening 'poor' (late only on Fridays) — cost if wrong: one rating.
- slot logic in shared pure src/lib/timeOfDay.ts used by daySummary and DayList.
- router state carries `hops`; Back steps history only when hops===1 — cost if wrong: none.
- bar's selected day carries back to the planner and to other attractions; "See it on the map" while planning returns to the planner with the card open — user expectation — pre-review fix sent.
- phone trip bar gets a map button (phone save bar hidden while planning); browser Back gesture returns to planner's original day (only the page's back button carries the bar day) — cost if wrong: gesture Back lands on earlier day.

Deferred:
- Part 1: minor (deferred): ratings aren't weekday-aware (National Museum Friday late opening flagged); starts before 06:00 count as morning; Sensō-ji evening ok vs 17:00 hours; Todoroki note says "unlit" (data only says daylight only); "Best part of the day" vs "Best time of day" titles near-duplicate; slot hour strings hardcoded in Conditions.tsx; no UI tests for chip/pills
- Part 2: minor (deferred): bar day lost on reload; push adds a second planner entry when hops ≥ 2 (follows ruling); day-option building duplicated from DayList
- Part 2: complete (71981c2..be0f001, fix round 1/5 all addressed). Part 2: minor (deferred): Back/map dead if navigate(-1) yields no popstate (stale hops, unlikely)

## Phone planner header clean-up (branch planner-detail, 2026-10-27)

- Fitline mark left out of the phone header (4 controls in 366px); search open/close via history state so Back closes it; zoom buttons hide while a card is open on phone — cost if wrong: no wordmark on phone planner.
- phone planner frames by attractions (fitPins on narrow), card only pans; credit fades out at p 0.95–1 on phone planner — cost if wrong: Mount Takao starts outside the phone Tokyo view (as on Explore).
- bottom tab bar stays reachable while searching (not inert) — leaving the planner from search is legitimate — cost if wrong: Tab can leave search to the tabs.

- Minor (deferred): phone detected by map width in MapExplorer (implicit 761); no component tests for search history; Mount Takao outside phone framing (accepted; when on today's plan, not visible at rest)
