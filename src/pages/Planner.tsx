import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Navigate, useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import type { Insets, Quad } from '../map/camera';
import type { MapBubble, MapFocus, SpotMove } from '../map/MapExplorer';
import { BottomTabs, TopNav } from '../components/Chrome';
import { PinCard } from '../components/MapCards';
import { MapSearch } from '../components/MapSearch';
import { Icon } from '../components/Icon';
import { Browse } from '../components/planner/Browse';
import { DayAnalysis } from '../components/planner/DayAnalysis';
import { DayList, stopsOf } from '../components/planner/DayList';
import { PlacePicker } from '../components/planner/PlacePicker';
import { PlaceSwitcher } from '../components/planner/PlaceSwitcher';
import { Sheet } from '../components/planner/Sheet';
import { HeaderDates, TripDatesPanel, cutsPlans } from '../components/planner/HeaderDates';
import type { TripDatesValue } from '../components/planner/TripSettings';
import { Trays } from '../components/planner/Trays';
import { WetPlan } from '../components/planner/WetPlan';
import { attractionById } from '../data/attractions';
import { browseList, browsePool, markersFor, type BrowseFilterId } from '../lib/browse';
import { summarizeDay } from '../lib/daySummary';
import { readDayView, writeDayView, type DayView, type PlanTab } from '../lib/dayView';
import { isRainProof } from '../lib/factors';
import { getRainChance, isLikelyWet } from '../lib/forecast';
import { plural } from '../lib/format';
import { planningState, readPlannerOpen, readPlanSearch, SEARCH_STATE, searchStep } from '../lib/planning';
import { ANALYSIS_SIDE_MIN, PEEK_PHONE, PLAN_INSETS, SHEET_CLEAR, belowCard, headBottom, phoneInsets, sheetBarH, withAnalysis } from '../lib/planSheet';
import { EASE_OUT, useReducedMotion } from '../lib/motion';
import { useGo } from '../lib/transition';
import {
  addPlace,
  addStop,
  addWet,
  DAY_END,
  DAY_START,
  dateOf,
  dayOf,
  movedToSaved,
  moveStop,
  removePlace,
  removeStop,
  removeWet,
  replaceStop,
  saveToTrip,
  setDays,
  setDayTimes,
  setStartDate,
  unsaveFromTrip,
  type PlaceRef,
  type Trip,
} from '../lib/trips';
import { attractionsIn, covers, coveringPlace, dayPlace, placeLabel, placeView, sameRef } from '../lib/tripPlaces';
import { attractionHome, countFor, nodeOf, parentOf, parseRefKey, pathTo, pinsFor, placeAnchor, refKey, sameTree } from '../lib/placeTree';
import { afterSpotPop, neighboursOf, spotHistory, spotLeave } from '../lib/spotlight';
import { useSaved } from '../lib/saved';
import { useTrips } from '../lib/tripsStore';
import { undoRemovePlace, undoRemoveStop, undoRemoveWet, undoReplace, undoSetDays, undoUnsave } from '../lib/tripUndo';
import { useGuideScroll } from '../lib/useGuideScroll';
import { useMedia } from '../lib/useMedia';
import { useSafeTop } from '../lib/useSafeTop';

// The map engine is large, so it loads only on the map pages.
const MapExplorer = lazy(() => import('../map/MapExplorer'));

const UNDO_MS = 6000;
const NOTICE_MS = 3600;
const noop = () => {};
/** Laptop: the map frames its place between the top bar and search, and the day panel (lib/planSheet). */
const INSETS_ANALYSIS: Insets = withAnalysis(PLAN_INSETS);
/** Phone: the docked pin card's gap above the peek (styles.css `.planner .pincard`) and its usual height. */
const CARD_DOCK_GAP = 30;
/** Phone: the card's height until it has been measured. */
const CARD_PHONE_H = 250;
/** Phone: the least map height a spot keeps above the card. */
const SPOT_STRIP_MIN = 96;
/** Phone: while a spot is open the day sheet shows just its handle above the tab bar. */
const SPOT_PEEK_PHONE = 24;
/** Phone: how long the sheet's slide to or from the handle runs (styles.css: 0.35s), with a margin. */
const SHEET_SLIDE_MS = 450;
/** Whether the analysis was open beside the day panel, for the rest of the session. */
const ANALYSIS_KEY = 'fitline.planner.analysis';
const readAnalysisOpen = () => {
  try {
    return sessionStorage.getItem(ANALYSIS_KEY) === '1';
  } catch {
    return false;
  }
};
const writeAnalysisOpen = (open: boolean) => {
  try {
    sessionStorage.setItem(ANALYSIS_KEY, open ? '1' : '0');
  } catch {
    /* no storage: it simply isn't remembered */
  }
};
/*
 * Phone (lib/planSheet): one header over the map (the trip bar, the place pills, the breadcrumb) and
 * the day panel as a bottom sheet, as the map page's guide sheet is. The page scrolls; the sheet
 * peeks PEEK_PHONE tall above the tab bar (SHEET_CLEAR), enough for the day dropdown, the one-line
 * header (date and times, the wet-weather toggle, Analysis) and the one-line summary, and comes all
 * the way up over the header, to the safe area.
 */

/** A 1-based position from the URL (`?day=3`) as a 0-based index; 0 when missing or not a whole number. */
const indexParam = (v: string | null) => {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n >= 1 ? n - 1 : 0;
};

/** True when two view quads have the same corners. */
const sameQuad = (a: Quad, b: Quad) => a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);

/** True for a key event from somewhere the user types. */
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || t.matches('input, textarea, select'));

/** `/trips/:id`. An id this browser doesn't have goes back to the trips list with a notice. */
export default function Planner() {
  const { id = '' } = useParams();
  const { get } = useTrips();
  const trip = get(id);
  if (!trip) return <Navigate to="/trips" replace state={{ notice: 'That trip isn’t saved in this browser.' }} />;
  return <PlannerPage key={trip.id} trip={trip} />;
}

type Undo = { text: string; run: () => void };
type Confirm = { ref: PlaceRef; ids: string[] };

function PlannerPage({ trip }: { trip: Trip }) {
  const { update, saveFailed } = useTrips();
  const go = useGo();
  const navigate = useNavigate();
  const narrow = useMedia('(max-width: 760px)');
  // Wide laptops have room for the day analysis beside the day panel; narrower, it slides over the list.
  const roomy = useMedia(`(min-width: ${ANALYSIS_SIDE_MIN}px)`);
  const side = roomy && !narrow;
  const reduced = useReducedMotion();
  const edit = useCallback((fn: (t: Trip, now: number) => Trip) => update(trip.id, fn), [update, trip.id]);

  // The day and place shown live in the URL (?day=3&place=2, 1-based), the Browse sub-tab as
  // &tab=browse, the wet-weather toggle as &wet=1 (lib/dayView), and the map level being viewed as
  // &view=region:kanto, so Back from an attraction page and a reload come back to them. Written with
  // replace: switching days isn't a step in history.
  const [params, setParams] = useSearchParams();
  // An attraction page opened from here gets this search with the trip, so it shows the trip bar and
  // its Back comes back to the same day, place, view and tab.
  const { pathname, search, state: navState, key: navKey } = useLocation();
  const navType = useNavigationType();
  const dayIdx = indexParam(params.get('day'));
  const placeIdx = indexParam(params.get('place'));
  const setParam = useCallback(
    (key: 'day' | 'place', index: number) =>
      setParams(
        (p) => {
          const q = new URLSearchParams(p);
          q.set(key, String(index + 1));
          // Picking a trip place views that place itself, out of any spotlight.
          if (key === 'place') {
            q.delete('view');
            q.delete('spot');
          }
          return q;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  );
  const setDayIdx = useCallback((d: number) => setParam('day', d), [setParam]);
  const setPlaceIdx = useCallback((i: number) => setParam('place', i), [setParam]);
  // The spotlit attraction (&spot=, lib/dayView) is the open card; it shows only once the map views
  // its home (below).
  const { tab, wet, spot: spotParam } = readDayView(params);
  const setView = useCallback(
    (next: Partial<DayView>) => setParams((p) => writeDayView(p, next), { replace: true, preventScrollReset: true }),
    [setParams],
  );
  const [hoverId, setHoverId] = useState<string | null>(null);
  // The place just added from Browse: its thumbnail lights in the day strip for a moment.
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  // The dot under the pointer on the map (not the list), for the hover preview card.
  const [peekId, setPeekId] = useState<string | null>(null);
  const canHover = useMedia('(hover: hover) and (pointer: fine)');
  const onMapHover = useCallback((id: string | null) => {
    setHoverId(id);
    setPeekId(id);
  }, []);
  const [replace, setReplace] = useState<{ day: number; id: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [sheet, setSheet] = useState<'places' | null>(null);
  const [datesOpen, setDatesOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);

  // The trip can shrink under the page (fewer days, a place removed): stay on one that exists.
  // The clamp is written back, so a trip that shrinks and grows again doesn't jump to an old day.
  const day = Math.min(dayIdx, trip.days.length - 1);
  const pi = Math.min(placeIdx, Math.max(0, trip.places.length - 1));
  useEffect(() => {
    if (dayIdx !== day) setDayIdx(day);
  }, [dayIdx, day, setDayIdx]);
  const place = trip.places[pi] ?? null;

  // The viewed place: the map's level, kept apart from the trip's places. It starts at the trip place
  // and moves up and down that place's tree (the breadcrumb and the bubbles); a view from another
  // tree (the place it came from was removed) falls back to the trip place.
  const viewParam = parseRefKey(params.get('view'));
  const viewed = place && viewParam && sameTree(viewParam, place) ? viewParam : place;
  const viewKey = viewed ? refKey(viewed) : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const node = useMemo(() => (viewed ? nodeOf(viewed) : null), [viewKey]);
  const viewedName = node?.label ?? 'this trip';
  /**
   * Writes a viewed place into a search: as a trip place when it is one, else in the current trip
   * place's tree, else in the tree of the trip place it belongs to. False (search untouched) when no
   * trip place's tree holds it.
   */
  const viewInto = useCallback(
    (q: URLSearchParams, ref: PlaceRef) => {
      const exact = trip.places.findIndex((p) => sameRef(p, ref));
      const at = exact >= 0 ? exact : place && sameTree(ref, place) ? pi : trip.places.findIndex((p) => sameTree(p, ref));
      if (at < 0) return false;
      q.set('place', String(at + 1));
      if (sameRef(ref, trip.places[at])) q.delete('view');
      else q.set('view', refKey(ref));
      return true;
    },
    [place, pi, trip.places],
  );
  /** Views a place (see viewInto), out of any spotlight. */
  const setViewed = useCallback(
    (ref: PlaceRef) => {
      const q = new URLSearchParams();
      if (!viewInto(q, ref)) return;
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          viewInto(next, ref);
          next.delete('spot');
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [viewInto, setParams],
  );

  useEffect(() => {
    document.title = `${trip.name} · Fitline`;
  }, [trip.name]);

  // ---- the map ----
  // Keyed on the viewed place itself, so an unrelated edit doesn't hand the map a new target and reframe it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = useMemo(() => (viewed ? placeView(viewed) : null), [viewKey]);
  // Pins only at the attraction level (a neighbourhood pins all of Tokyo, see pinsFor); above it, a
  // count bubble per child place.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pins = useMemo(() => (viewed ? pinsFor(viewed) : []), [viewKey]);
  const placesKey = trip.places.map(refKey).join(',');
  // The spotlight: the &spot= attraction, shown only while the map views an attraction-level place
  // that is its home (attractionHome) under the current trip place. The open card is this spot.
  const spotHome = useMemo(
    () => (spotParam ? attractionHome(spotParam, trip.places, place, viewed) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spotParam, placesKey, pi, viewKey],
  );
  const selected = spotParam && node?.attractionLevel && viewed && spotHome && sameRef(spotHome, viewed) ? spotParam : null;
  // How openStop last opened a spot: a pick on the map (its dot, a neighbour's) or in Browse reveals
  // it where the map already is; the day list, the wet plan, the search and "See it on the map" fly
  // to it. Forgotten once the spot closes, so a spot from the URL alone (a reload, a link, a step
  // back or forward onto one) flies.
  const spotMove = useRef<{ sid: string; move: SpotMove } | null>(null);
  // A spot labels the ones within a walk, centring its attraction or (revealed) leaving the map where
  // it is; else a neighbourhood frames its own box rather than the pins (which are all of Tokyo).
  const focus = useMemo<MapFocus | null>(() => {
    const a = selected ? attractionById(selected) : undefined;
    if (a) {
      const move = spotMove.current?.sid === a.id ? spotMove.current.move : 'fly';
      return { kind: 'spot', key: `spot:${a.id}`, id: a.id, center: a.lonlat, near: neighboursOf(a.id, pins), move };
    }
    return view?.frame ? { kind: 'frame', key: viewKey, bounds: view.frame } : null;
  }, [selected, pins, view, viewKey]);
  // What the map's free area shows, for the in-view Browse list, with the viewed place it was
  // reported for: a new viewed place forgets it until the map reports again. While a spot is open the
  // reports are ignored, so the list keeps its rows, even when a spot in the next neighbourhood moves
  // the view there (and coming back to the place the spot run started from finds its quad still
  // there); a report equal to the last one changes nothing.
  const [quadAt, setQuadAt] = useState<{ key: string; quad: Quad; attraction: boolean } | null>(null);
  const quad = quadAt && (quadAt.key === viewKey || (selected && quadAt.attraction)) ? quadAt.quad : null;
  const quadRef = useRef({ viewKey, attraction: false, spotOn: false });
  quadRef.current = { viewKey, attraction: !!node?.attractionLevel, spotOn: !!selected };
  const onViewQuad = useCallback((q: Quad) => {
    const { viewKey: key, attraction, spotOn } = quadRef.current;
    if (spotOn) return;
    setQuadAt((was) => (was && was.key === key && sameQuad(was.quad, q) ? was : { key, quad: q, attraction }));
  }, []);
  const setViewedRef = useRef(setViewed);
  setViewedRef.current = setViewed;
  const bubbles = useMemo<MapBubble[] | undefined>(
    () =>
      node && !node.attractionLevel
        ? node.children.map((c) => ({
            id: refKey(c),
            ll: placeAnchor(c),
            label: placeLabel(c).name,
            count: countFor(c),
            onPick: () => setViewedRef.current(c),
          }))
        : undefined,
    [node],
  );
  // The map's calm dots: today's stops numbered in route order, other days' stops in their colour.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dots = useMemo(() => markersFor(trip, day), [trip.days, day]);
  // The search covers the viewed place (a neighbourhood's pins, and so its search, are all of its
  // city's); above the attraction level, every attraction in the trip.
  const scope = useMemo(() => {
    const city = viewed?.level === 'neighbourhood' ? parentOf(viewed) : null;
    if (city) return { name: placeLabel(city).name, attractions: pins };
    if (!node || node.attractionLevel) return { name: viewedName, attractions: pins };
    const all = new Map(trip.places.flatMap(attractionsIn).map((a) => [a.id, a]));
    return { name: 'this trip', attractions: [...all.values()] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, viewedName, pins, placesKey]);
  // Laptop: hovering a dot previews its card; a click (selected) keeps it open.
  const preview = canHover && !narrow ? peekId : null;
  const shownId = preview ?? selected;
  const picked = shownId ? (stopsOf([shownId])[0] ?? null) : null;
  const previewing = !!preview && preview !== selected;
  // The Browse sub-tab: what the map shows (the trip's places' attractions above the attraction
  // level), and its chips, kept here so they survive a visit to the other sub-tabs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pool = useMemo(() => browsePool(viewed, trip.places), [viewKey, placesKey]);
  // At the attraction level, only what's on screen once the map has reported its view.
  const listed = useMemo(() => browseList(pool, quad, !!node?.attractionLevel), [pool, quad, node]);
  // The same rows keep the same array, so a camera that moved without changing what's in view
  // doesn't drop Browse's held order (it holds while its pool is the same array).
  const listedIds = listed.list.map((a) => a.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const browseRows = useMemo(() => listed.list, [listedIds]);
  const browsing = { list: browseRows, inView: listed.inView };
  const [browseFilters, setBrowseFilters] = useState<BrowseFilterId[]>([]);

  // A new day leaves replace mode (the sub-tab stays).
  useEffect(() => setReplace(null), [day]);
  const cardRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Replace mode only while its stop is still on its day (an undo, another tab or fewer days can take it away).
  const target = replace && trip.days[replace.day]?.stops.includes(replace.id) ? replace : null;
  useEffect(() => {
    if (replace && !target) setReplace(null);
  }, [replace, target]);

  const plan = trip.days[day];
  const date = dateOf(trip, day);
  const summary = useMemo(
    () => summarizeDay(stopsOf(plan?.stops ?? []), { start: plan?.start ?? DAY_START, end: plan?.end ?? DAY_END, date }),
    // A Date is new every render; its time stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, date?.getTime()],
  );
  const wetDay = isLikelyWet(getRainChance(dayPlace(trip, day), date));
  const toWet = wet;
  // The wet-weather plan read the same way, for the analysis while the toggle is on.
  const wetSummary = useMemo(
    () => summarizeDay(stopsOf(plan?.wet ?? []), { start: plan?.start ?? DAY_START, end: plan?.end ?? DAY_END, date }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, date?.getTime()],
  );
  const shown = wet ? wetSummary : summary;

  // ---- toasts ----
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);
  const offerUndo = (u: Undo) => {
    setUndo(u);
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
  };
  const runUndo = () => {
    undo?.run();
    setUndo(null);
    window.clearTimeout(undoTimer.current);
  };

  // ---- stops ----
  const nameOf = (sid: string) => stopsOf([sid])[0]?.name ?? 'That stop';

  const removeFromDay = (d: number, sid: string, index: number) => {
    edit((t, now) => removeStop(t, d, sid, now));
    if (replace?.id === sid) setReplace(null);
    offerUndo({
      text: `Removed ${nameOf(sid)} from Day ${d + 1}`,
      run: () => edit(undoRemoveStop(d, sid, index)),
    });
  };

  /** Adds to the current day, or in replace mode swaps the attraction into the replaced stop's place. */
  const addToDay = (sid: string) => {
    if (replace) setReplace(null);
    if (target && sid !== target.id) {
      const { day: d, id: old } = target;
      const undoIt = undoReplace(trip, d, old, sid);
      edit((t, now) => replaceStop(t, d, old, sid, now));
      offerUndo({
        text: `${nameOf(sid)} replaces ${nameOf(old)} on Day ${d + 1} · ${nameOf(old)} moved to Saved`,
        run: () => edit(undoIt),
      });
      return;
    }
    edit((t, now) => addStop(t, day, sid, now));
  };

  // ---- the wet-weather plan ----
  /** Adds to the current day's wet-weather plan. Rain-proof attractions only; the day's own stops stay put. */
  const addToWet = (sid: string) => {
    const a = stopsOf([sid])[0];
    if (!a || !isRainProof(a)) return setNotice(`${a?.name ?? 'That place'} isn’t rain-proof, so it can’t go in the wet-weather plan.`);
    edit((t, now) => addWet(t, day, sid, now));
  };

  const removeFromWet = (d: number, sid: string, index: number) => {
    edit((t, now) => removeWet(t, d, sid, now));
    offerUndo({
      text: `Removed ${nameOf(sid)} from Day ${d + 1}’s wet-weather plan`,
      run: () => edit(undoRemoveWet(d, sid, index)),
    });
  };

  /** The sub-tabs. Replace starts on the Plan sub-tab; Browse can pick the replacement, as the Saved tray does. */
  const pickTab = (to: PlanTab) => {
    setView({ tab: to });
    // A row or stop lit from the list being left shouldn't stay lit on the map.
    setHoverId(null);
  };
  /** The wet-weather toggle: the list shows the day's wet-weather plan and adds go there. It and replace mode don't mix. */
  const toggleWet = (on: boolean) => {
    setView({ wet: on });
    setHoverId(null);
    if (on) setReplace(null);
  };

  // ---- the day's times ----
  /** A new start or end for a day; an end not after the start isn't taken, and says so. */
  const setTimes = (d: number, times: { start?: string; end?: string }) => {
    if (setDayTimes(trip, d, times, 0) === trip) {
      const cur = trip.days[d];
      const same = !cur || ((times.start ?? cur.start) === cur.start && (times.end ?? cur.end) === cur.end);
      if (!same) setNotice('A day has to end after it starts, by 23:59.');
      return same;
    }
    edit((t, now) => setDayTimes(t, d, times, now));
    return true;
  };
  const startReplace = (d: number, sid: string) => setReplace((r) => (r?.id === sid ? null : { day: d, id: sid }));

  // ---- the trip's Saved list ----
  const unsave = (sid: string) => {
    const at = trip.saved.indexOf(sid);
    if (at < 0) return;
    edit((t, now) => unsaveFromTrip(t, sid, now));
    offerUndo({ text: `Removed ${nameOf(sid)} from Saved`, run: () => edit(undoUnsave(sid, at)) });
  };
  const toggleSave = (sid: string) => (trip.saved.includes(sid) ? unsave(sid) : edit((t, now) => saveToTrip(t, sid, now)));
  /** The card's Save toggle, in place of the heart: saves to this trip, not the global hearted list. */
  const saveToggle = (sid: string) => {
    const on = trip.saved.includes(sid);
    const name = nameOf(sid);
    return (
      <button
        type="button"
        className={`button is-compact plan-save ${on ? 'is-done' : 'is-quiet'}`}
        aria-pressed={on}
        aria-label={`Save ${name} to this trip`}
        onClick={() => toggleSave(sid)}
      >
        <Icon name={on ? 'check' : 'plus'} />
        {on ? 'Saved' : 'Save'}
      </button>
    );
  };

  /** Where the card, the search, Browse and the Saved tray add to: the day, or its wet-weather plan while the toggle is on. */
  const add = (sid: string) => {
    if (toWet) addToWet(sid);
    else addToDay(sid);
    setFlashId(sid);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1200);
  };
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  /** The card's own action for the attraction it shows. */
  const cardAction = (sid: string) => {
    let label: string;
    let icon: 'plus' | 'close' | 'arrowRight' | 'swap' | 'rain' = 'plus';
    let run = () => addToDay(sid);
    let quiet = false;
    let disabled = false;
    const on = dayOf(trip, sid);
    const a = stopsOf([sid])[0];
    if (toWet) {
      const at = trip.days[day]?.wet.indexOf(sid) ?? -1;
      if (a && !isRainProof(a)) {
        label = 'Not rain-proof';
        icon = 'rain';
        disabled = quiet = true;
      } else if (at >= 0) {
        label = 'Remove from wet-weather plan';
        icon = 'close';
        quiet = true;
        run = () => removeFromWet(day, sid, at);
      } else {
        label = 'Add to wet-weather plan';
        run = () => addToWet(sid);
      }
    } else if (target && sid !== target.id) {
      icon = 'swap';
      if (on === target.day) {
        label = `Already on Day ${on + 1}`;
        disabled = quiet = true;
      } else label = on !== null ? `On Day ${on + 1} · use as replacement` : 'Use as replacement';
    } else if (on === day) {
      label = `Remove from Day ${day + 1}`;
      icon = 'close';
      quiet = true;
      run = () => removeFromDay(day, sid, trip.days[day].stops.indexOf(sid));
    } else if (on !== null) {
      label = `On Day ${on + 1}: move here`;
      icon = 'arrowRight';
    } else label = `Add to Day ${day + 1}`;
    return (
      <div className="plan-action">
        <button type="button" className={`button is-compact ${quiet ? 'is-quiet' : ''}`} onClick={run} disabled={disabled}>
          <Icon name={icon} />
          {label}
        </button>
      </div>
    );
  };

  // ---- places ----
  const allIds = (t: Trip) => [...new Set([...t.days.flatMap((d) => [...d.stops, ...d.wet]), ...t.saved])];

  const askRemovePlace = (ref: PlaceRef) => {
    if (trip.places.length <= 1) return setNotice('A trip needs at least one place.');
    const others = trip.places.filter((p) => !sameRef(p, ref));
    const ids = allIds(trip).filter((sid) => covers(ref, sid) && !coveringPlace(others, sid));
    if (ids.length) setConfirm({ ref, ids });
    else dropPlace(ref, []);
  };

  const dropPlace = (ref: PlaceRef, ids: string[]) => {
    const at = trip.places.findIndex((p) => sameRef(p, ref));
    const undoIt = undoRemovePlace(trip, ref, ids);
    const was = pi;
    edit((t, now) => removePlace(t, ref, ids, now));
    if (at >= 0 && at < pi) setPlaceIdx(pi - 1);
    setConfirm(null);
    offerUndo({
      text: `Removed ${placeLabel(ref).name}${ids.length ? ` and ${plural(ids.length, 'stop')}` : ''}`,
      // The places, days and saved as they were, unless they have changed since; the map goes back too.
      run: () => {
        edit(undoIt);
        setPlaceIdx(was);
      },
    });
  };

  /** The place picker's changes: new places join the trip (and the map goes there); a removed one asks first. */
  const pickPlaces = (next: PlaceRef[]) => {
    const added = next.filter((p) => !trip.places.some((q) => sameRef(p, q)));
    const gone = trip.places.find((p) => !next.some((q) => sameRef(p, q)));
    if (added.length) {
      edit((t, now) => added.reduce((acc, p) => addPlace(acc, p, now), t));
      setPlaceIdx(trip.places.length);
    } else if (gone) askRemovePlace(gone);
  };

  // ---- the dates, in the header ----
  /**
   * New dates from the header: the start date, and the number of days through setDays (stops on cut
   * days move to Saved). A cut that took stops or wet-weather plans off their days can be undone.
   */
  const applyDates = (next: TripDatesValue) => {
    const before = trip;
    const n = next.days;
    const cut = cutsPlans(before, n);
    const moved = movedToSaved(before, n);
    edit((t, now) => setStartDate(setDays(t, n, now), next.startDate, now));
    if (cut)
      offerUndo({
        text: moved > 0 ? `${plural(moved, 'stop')} moved to Saved` : `Trip cut to ${plural(n, 'day')}`,
        // The start date goes back too, if this change moved it.
        run: () => edit(undoSetDays(before, n, next.startDate)),
      });
  };
  const closeDates = useCallback(() => setDatesOpen(false), []);
  // A cut waiting for "Cut to N days" in the phone sheet: its Done is hidden meanwhile, so it can't read as confirming it.
  const [datesHeld, setDatesHeld] = useState(false);

  // ---- the name, edited in place ----
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const typeName = (text: string) => {
    setNameDraft(text);
    const name = text.trim();
    if (name) edit((t, now) => (t.name === name ? t : { ...t, name, updatedAt: now }));
  };

  // ---- the phone search ----
  // The header's search icon turns the trip bar into the search. Opening it pushes a history entry
  // (same URL, SEARCH_STATE), so the Back gesture closes it; every other way of closing steps back
  // off that entry, and only then runs what the close was for (opening a picked place), so that
  // change lands on the planner's own entry. Focus goes back to the icon. Both directions are
  // guarded by refs (router updates land in a transition, so a quick second tap still sees the old
  // location), and the guards reset on every location change, so a close can't get stuck.
  const searchOpen = readPlanSearch(navState);
  const searching = narrow && searchOpen;
  const searchBtn = useRef<HTMLButtonElement>(null);
  const openingSearch = useRef(false);
  const leavingSearch = useRef(false);
  const afterSearch = useRef<(() => void) | null>(null);
  const openSearch = () => {
    if (searchOpen || openingSearch.current) return;
    openingSearch.current = true;
    navigate({ search }, { state: SEARCH_STATE, preventScrollReset: true });
  };
  /** Off the search entry: one step back, or (nothing behind it, e.g. a restored tab) replaced in place. */
  const leaveSearch = useCallback(() => {
    leavingSearch.current = true;
    const idx = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate({ search }, { replace: true, state: null, preventScrollReset: true });
  }, [navigate, search]);
  const closeSearch = useCallback(
    (then?: () => void) => {
      if (then) afterSearch.current = then;
      if (!searchOpen || leavingSearch.current) return;
      leaveSearch();
    },
    [searchOpen, leaveSearch],
  );
  const wasSearchOpen = useRef(searchOpen);
  const searchKey = useRef(navKey);
  useEffect(() => {
    // A new location settles whatever was in flight.
    if (searchKey.current !== navKey) {
      searchKey.current = navKey;
      const leaving = leavingSearch.current;
      leavingSearch.current = false;
      openingSearch.current = false;
      const step = searchStep({ open: searchOpen, wasOpen: wasSearchOpen.current, leaving, narrow });
      wasSearchOpen.current = searchOpen;
      if (step === 'back') return leaveSearch();
      if (step !== 'closed') return;
    } else {
      // Same location, new width: only a widened window with the search open needs a step back.
      if (searchOpen && !narrow && !leavingSearch.current) leaveSearch();
      return;
    }
    const then = afterSearch.current;
    afterSearch.current = null;
    searchBtn.current?.focus({ preventScroll: true });
    // After this commit, once the page's scroll has resumed (it pauses while searching), so the
    // pick's scroll back down to the map isn't dropped.
    if (then) requestAnimationFrame(then);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navKey, narrow]);

  // ---- the day analysis ----
  // Beside the day panel on wide laptops, remembered for the session; over the day list on phones and
  // narrower windows, where it starts closed. Opening moves focus to its heading, closing back to the
  // Analysis button.
  const [sideOpen, setSideOpen] = useState(readAnalysisOpen);
  const [overOpen, setOverOpen] = useState(false);
  const analysisOpen = side ? sideOpen : overOpen;
  const analysisBtn = useRef<HTMLButtonElement>(null);
  const analysisId = useId();
  const analysisHeading = `${analysisId}-h`;
  const showAnalysis = (open: boolean) => {
    if (side) {
      setSideOpen(open);
      writeAnalysisOpen(open);
    } else setOverOpen(open);
    if (open) {
      // Phone: the sheet comes fully up first (from the peek, or from deep in the list).
      if (narrow) scrollToGuides();
      requestAnimationFrame(() => document.getElementById(analysisHeading)?.focus({ preventScroll: true }));
    } else {
      // After the list is back in reach (it is inert under the overlay).
      requestAnimationFrame(() => analysisBtn.current?.focus({ preventScroll: true }));
    }
  };
  const showAnalysisRef = useRef(showAnalysis);
  showAnalysisRef.current = showAnalysis;

  // ---- keys ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isTyping(e.target)) return;
      if (document.querySelector('dialog[open], .drawer')) return;
      if (searching) closeSearch();
      else if (selected) leaveSpotRef.current();
      else if (analysisOpen) showAnalysisRef.current(false);
      else if (replace) setReplace(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, replace, searching, closeSearch, analysisOpen]);

  const empty = !!viewed && countFor(viewed) === 0;

  // ---- the phone sheet ----
  // The page scrolls and the day sheet slides up over the fixed map, as on the map page (useGuideScroll).
  // Fully up, its top is at the safe area: it covers the header, and the day dropdown pins there.
  const rootRef = useRef<HTMLDivElement>(null);
  const safeTop = useSafeTop(narrow);
  const phoneFrame = useMemo(() => phoneInsets(safeTop), [safeTop]);
  // Phone, while a spot is open: the day sheet drops to just its handle (it still drags up), the card
  // docks just above it (styles.css reads --plan-peek), and the spot centres in the map above the
  // card, measured, so the neighbours have room. A short screen keeps at least SPOT_STRIP_MIN of map.
  const spotPhone = narrow && !!selected;
  const peek = spotPhone ? SPOT_PEEK_PHONE : PEEK_PHONE;
  // The sheet slides to and from the handle (styles.css, is-sheet-sliding) only around that change,
  // from the render the peek changes in until the slide is over, not on viewport resizes.
  const [slideFor, setSlideFor] = useState(spotPhone);
  const [sliding, setSliding] = useState(false);
  if (slideFor !== spotPhone) {
    setSlideFor(spotPhone);
    setSliding(true);
  }
  useEffect(() => {
    if (!sliding) return;
    const t = window.setTimeout(() => setSliding(false), SHEET_SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [sliding, spotPhone]);
  // The card's height, measured: on phone, and on laptop with the analysis beside the day panel,
  // where a spot centres below the card (belowCard).
  const [cardH, setCardH] = useState(CARD_PHONE_H);
  const cardShown = picked?.id ?? null;
  const measureCard = narrow || (side && analysisOpen);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!measureCard || !el) return;
    const measure = () => {
      if (el.offsetHeight) setCardH(el.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureCard, cardShown]);
  const [vh, setVh] = useState(() => window.innerHeight);
  useEffect(() => {
    if (!measureCard) return;
    const onResize = () => setVh(window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measureCard]);
  const spotFrame = useMemo(() => {
    const base = phoneInsets(safeTop, SPOT_PEEK_PHONE);
    const clearCard = SHEET_CLEAR + SPOT_PEEK_PHONE + CARD_DOCK_GAP + cardH + 12;
    const room = vh - base.top - SPOT_STRIP_MIN;
    return { ...base, bottom: Math.max(base.bottom, Math.min(clearCard, room)) };
  }, [safeTop, cardH, vh]);
  // Laptop with the analysis open: the free strip is no wider than the card, so a spot centres below it.
  const spotAnalysis = useMemo(() => belowCard(INSETS_ANALYSIS, cardH, vh), [cardH, vh]);
  const laptopInsets = side && analysisOpen ? (selected ? spotAnalysis : INSETS_ANALYSIS) : PLAN_INSETS;
  const insets = narrow ? (spotPhone ? spotFrame : phoneFrame) : laptopInsets;
  const { open: drawerOpen } = useSaved();
  const { scrollToTop, scrollToGuides, atGuides } = useGuideScroll({
    enabled: narrow,
    root: rootRef,
    barH: sheetBarH(safeTop),
    levelKey: trip.id,
    paused: drawerOpen || !!sheet || (narrow && datesOpen) || !!confirm || searching,
    peek,
  });
  // The sheet goes back where it was once the spot closes: fully up if it was up when the spot
  // opened (a Browse row with the list up), else to its peek (which the peek's return does itself).
  const sheetWasUp = useRef(false);
  const wasSpot = useRef(!!selected);
  useEffect(() => {
    const was = wasSpot.current;
    wasSpot.current = !!selected;
    if (!was || selected) return;
    if (narrow && sheetWasUp.current) scrollToGuides();
    sheetWasUp.current = false;
  }, [selected, narrow, scrollToGuides]);
  // On phone the map's credit moves out of the map, above the sheet, so the sheet never hides it.
  const [attribHost, setAttribHost] = useState<HTMLDivElement | null>(null);
  // ---- the spotlight ----
  // Whether this page pushed the history entry the current run of spots sits on: then leaving steps
  // back off it (and Back leaves on its own); otherwise (a reload, a link) leaving replaces it.
  const spotPushed = useRef(false);
  useEffect(() => {
    if (spotParam) return;
    spotPushed.current = false;
    spotMove.current = null;
  }, [spotParam]);
  /**
   * Every way of opening a card (a dot on the map, Browse, the day list, the wet-weather plan, the
   * search, "See it on the map") comes here: one URL change views the attraction-level place that
   * shows its pin and spotlights it. Entering a spot adds a history entry; moving between spots
   * replaces it. On phone the sheet goes back down so the map and the card show. `move`: how the map
   * gets there (see spotMove). A reveal into another neighbourhood switches the crumb but not the
   * camera, on the way in or out (MapFocus).
   */
  const openStop = (sid: string, move: SpotMove) => {
    const home = attractionHome(sid, trip.places, place, viewed);
    if (!home) return;
    spotMove.current = { sid, move };
    const push = spotHistory(spotParam, sid) === 'push';
    setParams(
      (p) => {
        const q = new URLSearchParams(p);
        if (!viewed || !sameRef(home, viewed)) viewInto(q, home);
        return writeDayView(q, { spot: sid });
      },
      { replace: !push, preventScrollReset: true },
    );
    if (push) spotPushed.current = true;
    if (narrow) {
      if (!selected) sheetWasUp.current = atGuides;
      scrollToTop();
    }
  };
  // A spot from a reload or a link whose home isn't the viewed place views its home; one with no home
  // in any trip place is dropped. Both in place: they put the URL right, they aren't steps.
  useEffect(() => {
    if (!spotParam || (viewed && spotHome && sameRef(spotHome, viewed))) return;
    setParams(
      (p) => {
        const q = new URLSearchParams(p);
        if (!spotHome || !viewInto(q, spotHome)) q.delete('spot');
        return q;
      },
      { replace: true, preventScrollReset: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotParam, placesKey]);
  /**
   * Leaves the spotlight (the card's close, Esc, a crumb): one step back when this page pushed the
   * spot's entry, else the spot is replaced away (spotLeave). `to` (a crumb) is then viewed, if it
   * isn't already. Guarded like the search: a quick second leave before the router lands does nothing.
   */
  const leavingSpot = useRef(false);
  const afterSpot = useRef<PlaceRef | null>(null);
  const leaveSpot = (to?: PlaceRef) => {
    if (leavingSpot.current) return;
    const how = spotLeave(spotParam, spotPushed.current);
    if (how === 'back') {
      leavingSpot.current = true;
      afterSpot.current = to ?? null;
      navigate(-1);
      return;
    }
    if (how === 'none') return;
    setParams(
      (p) => {
        const q = writeDayView(p, { spot: null });
        if (to) viewInto(q, to);
        return q;
      },
      { replace: true, preventScrollReset: true },
    );
  };
  const leaveSpotRef = useRef(leaveSpot);
  leaveSpotRef.current = leaveSpot;
  // After every location change. The day, sub-tab and wet toggle aren't steps in history, but while a
  // spot is open they replace its entry, so a step back off it (a leave above, or the browser's Back)
  // lands on the old ones: they are put back as they were just before (afterSpotPop), in place, in
  // the same write as a crumb's place.
  const spotNavKey = useRef(navKey);
  const lastLoc = useRef({ pathname, search });
  useEffect(() => {
    if (spotNavKey.current === navKey) return;
    spotNavKey.current = navKey;
    leavingSpot.current = false;
    const prev = lastLoc.current;
    lastLoc.current = { pathname, search };
    const to = afterSpot.current;
    afterSpot.current = null;
    const kept = afterSpotPop(prev, { pathname, search }, navType === 'POP');
    const q = kept ?? new URLSearchParams(search);
    const view = !!to && !spotParam && !(viewed && sameRef(to, viewed)) && viewInto(q, to);
    if (!kept && !view) return;
    setParams(q, { replace: true, preventScrollReset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navKey]);
  // "See it on the map" on an attraction page in planning comes back here with { open: id } in router
  // state: its card opens once, by the same path as the day list's. The state is cleared first (same
  // URL), so a reload or a later return to this entry doesn't open it again; openStop's own URL change,
  // if any, comes after and keeps the search.
  const openedFor = useRef<string | null>(null);
  useEffect(() => {
    const sid = readPlannerOpen(navState);
    if (!sid || openedFor.current === navKey) return;
    openedFor.current = navKey;
    navigate({ search }, { replace: true, state: null, preventScrollReset: true });
    openStop(sid, 'fly');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navKey]);

  // "See the details" pushes once: a quick second click would push the attraction page twice.
  const openingDetails = useRef(false);
  const openDetails = (aid: string) => {
    if (openingDetails.current) return;
    openingDetails.current = true;
    go(`/attraction/${aid}`, { state: planningState(trip.id, search) });
  };

  const switcher = (
    <PlaceSwitcher
      places={trip.places}
      index={pi}
      onPick={setPlaceIdx}
      onAdd={() => setSheet('places')}
      onRemove={(i) => askRemovePlace(trip.places[i])}
    />
  );

  // Phone: the crumb row scrolls sideways; whenever the level or the spot changes, it ends on the
  // current crumb.
  const crumbsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = crumbsRef.current;
    if (narrow && nav) nav.scrollLeft = nav.scrollWidth;
  }, [narrow, viewKey, selected]);
  // The map level: a breadcrumb up the viewed place's tree. The map's bubbles drill in. While a spot
  // is open its attraction is the last crumb, and every crumb above it (the viewed place too) leaves
  // the spotlight, then views that place.
  const path = viewed ? pathTo(viewed) : [];
  const spotName = selected ? (attractionById(selected)?.name ?? null) : null;
  type Crumb = { key: string; name: string; title?: string; label?: string; go?: () => void };
  let crumbs: Crumb[] = path.map((r) => ({
    key: refKey(r),
    name: placeLabel(r).name,
    go: () => (spotName ? leaveSpot(r) : setViewed(r)),
  }));
  // Laptop: the attraction's crumb makes the row too long for the room beside the search, so the
  // levels above the city fold into one "…" crumb (it goes to the last of them); the city, the
  // viewed place and the attraction stay. What still doesn't fit ellipsises, never the current crumb.
  if (spotName && !narrow && crumbs.length > 3) {
    const folded = crumbs.slice(0, -2);
    const last = folded[folded.length - 1];
    crumbs = [{ key: 'fold', name: '…', title: folded.map((c) => c.name).join(' › '), label: last.name, go: last.go }, ...crumbs.slice(-2)];
  }
  if (spotName) crumbs.push({ key: `spot:${selected}`, name: spotName });
  else if (crumbs.length) crumbs[crumbs.length - 1].go = undefined;
  const levels = viewed && (
    <div className="plan-levels" inert={searching}>
      <nav ref={crumbsRef} className="lvl-crumbs" aria-label="Map level">
        <ol>
          {crumbs.map((c) => (
            <li key={c.key} className={c.go ? undefined : 'is-here'}>
              {c.go ? (
                <>
                  <button type="button" className="lvl-crumb" onClick={c.go} title={c.title ?? c.name} aria-label={c.label}>
                    {c.name}
                  </button>
                  <span className="lvl-sep" aria-hidden="true">
                    ›
                  </span>
                </>
              ) : (
                <span className="lvl-crumb is-current" aria-current="location">
                  {c.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );

  const analysisContent = (
    <DayAnalysis day={day} headingId={analysisHeading} wet={wet} summary={shown} mode={side ? 'side' : 'overlay'} onClose={() => showAnalysis(false)} />
  );

  const days = (
    <DayList
      trip={trip}
      banner={
        saveFailed && (
          <p className="save-failed" role="alert">
            <Icon name="alert" size={16} />
            Trips can’t be saved in this browser.
          </p>
        )
      }
      day={day}
      onDay={setDayIdx}
      tab={tab}
      onTab={pickTab}
      wet={wet}
      onWet={toggleWet}
      onTimes={setTimes}
      onRemove={removeFromDay}
      onMove={(d, from, to) => edit((t, now) => moveStop(t, d, from, to, now))}
      onReplace={startReplace}
      onOpen={(sid) => openStop(sid, 'fly')}
      hotId={selected ?? hoverId}
      onHover={setHoverId}
      flashId={flashId}
      replacing={target?.id ?? null}
      onCancelReplace={() => setReplace(null)}
      rainFlags={wetDay ? summary.conditions.rainSensitive : []}
      hint={shown.empty ? (wet ? 'No rain-proof places in the plan yet' : 'Add stops to see how the day reads') : shown.line}
      analysis={{
        open: analysisOpen,
        id: analysisId,
        mode: side ? 'side' : 'overlay',
        onToggle: () => showAnalysis(!analysisOpen),
        onClose: () => showAnalysis(false),
        buttonRef: analysisBtn,
        swipe: narrow,
        content: !side && analysisContent,
      }}
      wetPlan={<WetPlan trip={trip} day={day} onRemove={(sid, i) => removeFromWet(day, sid, i)} onOpen={(sid) => openStop(sid, 'fly')} onBrowse={() => pickTab('browse')} />}
      browseCount={browsing.inView}
      browse={
        <Browse
          trip={trip}
          day={day}
          pool={browsing.list}
          inViewCount={browsing.inView}
          spotlit={!!selected}
          // A neighbourhood's pins are all of its city, so while the list follows the map its heading
          // says what it lists: what's in view, not the neighbourhood.
          placeName={
            viewed?.level === 'neighbourhood' && typeof browsing.inView === 'number' ? 'In view' : scope.name === 'this trip' ? 'This trip' : viewedName
          }
          filters={browseFilters}
          onFilters={setBrowseFilters}
          replacing={wet ? null : (target?.id ?? null)}
          wet={wet}
          hotId={selected ?? hoverId}
          onHover={setHoverId}
          onOpen={(sid) => openStop(sid, 'reveal')}
          onAdd={add}
          onRemove={(sid) => (wet ? removeFromWet(day, sid, trip.days[day].wet.indexOf(sid)) : removeFromDay(day, sid, trip.days[day].stops.indexOf(sid)))}
          onSave={toggleSave}
          quietEmpty={empty}
        />
      }
      tray={<Trays trip={trip} day={day} wet={wet} onPlan={add} onRemove={unsave} replacing={target?.id ?? null} />}
      note={
        empty && (
          <div className="plan-empty" role="status">
            <Icon name="map" size={18} />
            <p>
              <strong>No checked attractions yet</strong>
              {viewedName} is on the map, but its attractions aren’t checked yet. Tokyo is. Your stops stay on their days.
            </p>
          </div>
        )
      }
    />
  );

  return (
    <div
      ref={rootRef}
      className={`explore planner ${searching ? 'is-searching' : ''} ${picked ? 'has-card' : ''} ${narrow && atGuides ? 'is-covered' : ''} ${side && analysisOpen ? 'is-analysis' : ''} ${sliding ? 'is-sheet-sliding' : ''}`}
      style={
        {
          '--sheet-clear': `${SHEET_CLEAR}px`,
          '--plan-peek': `${peek}px`,
          '--sheet-top': `${safeTop}px`,
          '--plan-head': `${headBottom(safeTop)}px`,
        } as CSSProperties
      }
    >
      {/* Phone: once the sheet is fully up it covers the header, which then leaves the tab order. */}
      <div className="explore-chrome" inert={narrow && atGuides}>
        {/* Phone: the trip bar is the header; the tab bar does the nav's job. */}
        {!narrow && <TopNav tone="glass" />}
        {/* The open search dims the page under it; a tap there closes the search and does nothing else. */}
        {searching && <div className="plan-scrim" aria-hidden="true" onClick={() => closeSearch()} />}
        <div className={`plan-bar ${searching ? 'is-search' : ''}`}>
          {searching && view ? (
            <MapSearch
              className="plan-search"
              target={view.target}
              scope={scope}
              onCountry={noop}
              onRegion={noop}
              onArea={noop}
              onAttraction={(sid) => closeSearch(() => openStop(sid, 'fly'))}
              onNotice={setNotice}
              onClose={() => closeSearch()}
              lead={
                <button type="button" className="icon-button plan-back" onClick={() => closeSearch()} aria-label="Close search" title="Close search">
                  <Icon name="arrowLeft" size={18} />
                </button>
              }
            />
          ) : (
            <>
              <button type="button" className="icon-button plan-back" onClick={() => go('/trips')} aria-label="All trips" title="All trips">
                <Icon name="arrowLeft" size={18} />
              </button>
              {/* Laptop: the name, then the dates beside it. Phone: the dates as a second, smaller line. */}
              <div className="plan-title">
                <input
                  className="plan-name"
                  value={nameDraft ?? trip.name}
                  onChange={(e) => typeName(e.target.value)}
                  onBlur={() => setNameDraft(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      e.currentTarget.blur();
                    }
                  }}
                  aria-label="Trip name"
                  maxLength={80}
                  spellCheck={false}
                  autoComplete="off"
                />
                <HeaderDates trip={trip} onApply={applyDates} open={datesOpen} onOpenChange={setDatesOpen} popover={!narrow} />
              </div>
              {!narrow && switcher}
              {narrow && view && (
                <button
                  ref={searchBtn}
                  type="button"
                  className="round-button plan-search-btn"
                  onClick={openSearch}
                  aria-label={`Search places in ${scope.name}`}
                  title="Search"
                >
                  <Icon name="search" size={18} />
                </button>
              )}
            </>
          )}
        </div>
        {!narrow && view && (
          <MapSearch
            target={view.target}
            scope={scope}
            onCountry={noop}
            onRegion={noop}
            onArea={noop}
            onAttraction={(sid) => openStop(sid, 'fly')}
            onNotice={setNotice}
          />
        )}
        {/* Phone: the place pills get a row of their own under the bar, scrolling sideways. */}
        {/* While searching, what's behind the scrim is out of reach of Tab too. */}
        {narrow && (
          <div className="plan-places" inert={searching}>
            {switcher}
          </div>
        )}
        {levels}
      </div>

      <div className="explore-stage" inert={searching}>
        {view && (
          <Suspense fallback={<div className="map-loading" aria-hidden="true" />}>
            <MapExplorer
              target={view.target}
              focusPrefs={view.focusPrefs}
              insets={insets}
              // The analysis opening beside the day panel pans the view clear of it, keeping its zoom.
              panOnInsets
              // Phone: a city frames on its attractions, as on the map page, not its whole outline:
              // Tokyo's western mountains would leave the city a speck in a phone-wide strip.
              fitPins={narrow}
              pins={pins}
              hoverId={hoverId}
              selectedId={selected}
              markers="dot"
              dots={dots}
              bubbles={bubbles}
              focus={focus}
              onViewQuad={onViewQuad}
              pickedClearOf={cardRef}
              cardClearOf={narrow ? undefined : panelRef}
              offscreenPill={false}
              tour={false}
              wheelScrollsPage={false}
              attributionHost={narrow ? attribHost : null}
              onHover={onMapHover}
              onPrefPick={noop}
              onCountry={noop}
              onRegion={noop}
              onArea={noop}
              onAttraction={(sid) => openStop(sid, 'reveal')}
              onNotice={setNotice}
            />
          </Suspense>
        )}

        {!narrow && (
          <aside ref={panelRef} className={`panel plan-panel ${wet ? 'is-wet' : ''}`} aria-label="Days">
            {days}
          </aside>
        )}

        {/* Wide laptops: the day analysis beside the day panel, which steps left to make room for it. */}
        <AnimatePresence>
          {side && analysisOpen && (
            <motion.aside
              key="analysis"
              id={analysisId}
              className="panel plan-analysis"
              aria-label={`Day ${day + 1} analysis`}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: reduced ? 0 : 0.36, ease: EASE_OUT }}
            >
              {analysisContent}
            </motion.aside>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {picked && (
            <motion.div
              ref={cardRef}
              key={picked.id}
              className={`pincard ${previewing ? 'is-preview' : ''}`}
              initial={{ opacity: 0, y: previewing ? 12 : 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: previewing ? 12 : 40 }}
              transition={{ duration: reduced ? 0 : previewing ? 0.15 : 0.4, ease: EASE_OUT }}
              aria-hidden={previewing || undefined}
            >
              <PinCard a={picked} onOpen={openDetails} onClose={() => leaveSpot()} action={cardAction(picked.id)} save={saveToggle(picked.id)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {narrow && (
        <>
          <div ref={setAttribHost} className="explore-attrib maplibregl-ctrl-bottom-right" inert={searching} />
          <section className="plan-sheet" aria-label="Days" inert={searching}>
            <span className="gsheet-handle" aria-hidden="true" />
            {days}
          </section>
        </>
      )}

      <Sheet
        open={sheet === 'places'}
        title="Places in this trip"
        size="wide"
        onClose={() => setSheet(null)}
      >
        <PlacePicker
          value={trip.places}
          onChange={pickPlaces}
          footer={
            <div className="tnew-actions">
              <button type="button" className="button is-wide" onClick={() => setSheet(null)}>
                Done
              </button>
            </div>
          }
        />
      </Sheet>

      {/* Phone: the header's dates open as a sheet (laptop: a popover under the button). */}
      <Sheet
        open={narrow && datesOpen}
        title="Trip dates"
        size="small"
        onClose={closeDates}
        footer={
          // While a cut waits, only its own "Keep N days" and "Cut to N days" answer it.
          !datesHeld && (
            <div className="psheet-actions">
              <button type="button" className="button is-wide" onClick={closeDates}>
                Done
              </button>
            </div>
          )
        }
      >
        <TripDatesPanel trip={trip} onApply={applyDates} onHeld={setDatesHeld} />
      </Sheet>

      <Sheet open={!!confirm} title="Remove this place?" size="small" onClose={() => setConfirm(null)}>
        {confirm && (
          <div className="plan-confirm">
            <p>
              {confirm.ids.length === 1
                ? `1 stop is in ${placeLabel(confirm.ref).name}. Remove it too?`
                : `${confirm.ids.length} stops are in ${placeLabel(confirm.ref).name}. Remove them too?`}
            </p>
            <div className="psheet-actions">
              <button type="button" className="button is-quiet" onClick={() => dropPlace(confirm.ref, [])}>
                Keep the stops
              </button>
              <button type="button" className="button" onClick={() => dropPlace(confirm.ref, confirm.ids)}>
                Remove {confirm.ids.length === 1 ? 'it' : 'them'} too
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <div className="toast" role="status" data-on={notice ? '1' : ''}>
        {notice}
      </div>
      <div className="toast is-action" role="status" data-on={undo ? '1' : ''}>
        {undo && (
          <>
            <span>{undo.text}</span>
            <button type="button" className="toast-undo" onClick={runUndo}>
              Undo
            </button>
          </>
        )}
      </div>
      {narrow && <BottomTabs />}
    </div>
  );
}
