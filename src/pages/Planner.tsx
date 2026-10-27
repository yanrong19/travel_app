import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import type { Insets } from '../map/camera';
import type { MapBubble } from '../map/MapExplorer';
import { BottomTabs, TopNav } from '../components/Chrome';
import { PinCard } from '../components/MapCards';
import { MapSearch } from '../components/MapSearch';
import { Icon } from '../components/Icon';
import { DayList, stopsOf, type PlanTab } from '../components/planner/DayList';
import { DaySummaryPanel } from '../components/planner/DaySummaryPanel';
import { PlacePicker } from '../components/planner/PlacePicker';
import { PlaceSwitcher } from '../components/planner/PlaceSwitcher';
import { Sheet } from '../components/planner/Sheet';
import { TripSettings, type TripSettingsValue } from '../components/planner/TripSettings';
import { Trays } from '../components/planner/Trays';
import { WetPlan } from '../components/planner/WetPlan';
import { summarizeDay } from '../lib/daySummary';
import { isRainProof } from '../lib/factors';
import { getRainChance, isLikelyWet } from '../lib/forecast';
import { plural } from '../lib/format';
import { planningState, readPlannerOpen, readPlanSearch, SEARCH_STATE } from '../lib/planning';
import { PEEK_PHONE, SHEET_CLEAR, phoneInsets, sheetBarH } from '../lib/planSheet';
import { EASE_OUT, useReducedMotion } from '../lib/motion';
import { useGo } from '../lib/transition';
import {
  addPlace,
  addStop,
  addWet,
  dateOf,
  dayOf,
  endDate,
  movedToSaved,
  moveStop,
  removePlace,
  removeStop,
  removeWet,
  replaceStop,
  saveToTrip,
  setDays,
  unsaveFromTrip,
  type PlaceRef,
  type Trip,
} from '../lib/trips';
import { attractionsIn, covers, coveringPlace, dayPlace, placeLabel, placeView, sameRef } from '../lib/tripPlaces';
import { attractionHome, countFor, nodeOf, parseRefKey, pathTo, placeAnchor, refKey, sameTree } from '../lib/placeTree';
import { useSaved } from '../lib/saved';
import { useTrips } from '../lib/tripsStore';
import { undoRemovePlace, undoRemoveStop, undoRemoveWet, undoReplace, undoUnsave } from '../lib/tripUndo';
import { useGuideScroll } from '../lib/useGuideScroll';
import { useMedia } from '../lib/useMedia';
import { useSafeTop } from '../lib/useSafeTop';

// The map engine is large, so it loads only on the map pages.
const MapExplorer = lazy(() => import('../map/MapExplorer'));

const UNDO_MS = 6000;
const NOTICE_MS = 3600;
const noop = () => {};
/** Laptop: the map frames its place between the top bar and search, and the day panel. */
const INSETS: Insets = { top: 236, right: 476, bottom: 40, left: 40 };
/*
 * Phone (lib/planSheet): one header over the map (the trip bar, the place pills, the breadcrumb) and
 * the day panel as a bottom sheet, as the map page's guide sheet is. The page scrolls; the sheet
 * peeks PEEK_PHONE tall above the tab bar (SHEET_CLEAR), enough for the day dropdown, the one-line
 * summary and the whole sub-tab pill, and comes all the way up over the header, to the safe area.
 */

/** A 1-based position from the URL (`?day=3`) as a 0-based index; 0 when missing or not a whole number. */
const indexParam = (v: string | null) => {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n >= 1 ? n - 1 : 0;
};

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
  const reduced = useReducedMotion();
  const edit = useCallback((fn: (t: Trip, now: number) => Trip) => update(trip.id, fn), [update, trip.id]);

  // The day and place shown live in the URL (?day=3&place=2, 1-based), the Wet-weather plan
  // sub-tab as &tab=wet, and the map level being viewed as &view=region:kanto, so Back from an
  // attraction page comes back to them. Written with replace: switching days isn't a step in history.
  const [params, setParams] = useSearchParams();
  // An attraction page opened from here gets this search with the trip, so it shows the trip bar and
  // its Back comes back to the same day, place, view and tab.
  const { search, state: navState, key: navKey } = useLocation();
  const dayIdx = indexParam(params.get('day'));
  const placeIdx = indexParam(params.get('place'));
  const setParam = useCallback(
    (key: 'day' | 'place', index: number) =>
      setParams(
        (p) => {
          const q = new URLSearchParams(p);
          q.set(key, String(index + 1));
          // Picking a trip place views that place itself.
          if (key === 'place') q.delete('view');
          return q;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  );
  const setDayIdx = useCallback((d: number) => setParam('day', d), [setParam]);
  const setPlaceIdx = useCallback((i: number) => setParam('place', i), [setParam]);
  const tab: PlanTab = params.get('tab') === 'wet' ? 'wet' : 'plan';
  const setTab = useCallback(
    (to: PlanTab) =>
      setParams(
        (p) => {
          const q = new URLSearchParams(p);
          if (to === 'wet') q.set('tab', 'wet');
          else q.delete('tab');
          return q;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [replace, setReplace] = useState<{ day: number; id: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [sheet, setSheet] = useState<'places' | 'settings' | null>(null);
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
  // and moves up and down that place's tree (the breadcrumb, bubbles and chips); a view from another
  // tree (the place it came from was removed) falls back to the trip place.
  const viewParam = parseRefKey(params.get('view'));
  const viewed = place && viewParam && sameTree(viewParam, place) ? viewParam : place;
  const viewKey = viewed ? refKey(viewed) : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const node = useMemo(() => (viewed ? nodeOf(viewed) : null), [viewKey]);
  const viewedName = node?.label ?? 'this trip';
  /**
   * Views a place: as a trip place when it is one, else in the current trip place's tree, else in the
   * tree of the trip place it belongs to.
   */
  const setViewed = useCallback(
    (ref: PlaceRef) => {
      const exact = trip.places.findIndex((p) => sameRef(p, ref));
      const at = exact >= 0 ? exact : place && sameTree(ref, place) ? pi : trip.places.findIndex((p) => sameTree(p, ref));
      if (at < 0) return;
      const home = trip.places[at];
      setParams(
        (p) => {
          const q = new URLSearchParams(p);
          q.set('place', String(at + 1));
          if (sameRef(ref, home)) q.delete('view');
          else q.set('view', refKey(ref));
          return q;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [place, pi, trip.places, setParams],
  );

  useEffect(() => {
    document.title = `${trip.name} · Fitline`;
  }, [trip.name]);

  // ---- the map ----
  // Keyed on the viewed place itself, so an unrelated edit doesn't hand the map a new target and reframe it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = useMemo(() => (viewed ? placeView(viewed) : null), [viewKey]);
  // Pins only at the attraction level; above it, a count bubble per child place.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pins = useMemo(() => (viewed && node?.attractionLevel ? attractionsIn(viewed) : []), [viewKey]);
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
  const tones = useMemo(() => {
    const t: Record<string, 'today' | 'other'> = {};
    trip.days.forEach((d, i) => d.stops.forEach((s) => (t[s] = i === day ? 'today' : 'other')));
    return t;
  }, [trip.days, day]);
  // The search covers the viewed place; above the attraction level, every attraction in the trip.
  const placesKey = trip.places.map(refKey).join(',');
  const scope = useMemo(() => {
    if (!node || node.attractionLevel) return { name: viewedName, attractions: pins };
    const all = new Map(trip.places.flatMap(attractionsIn).map((a) => [a.id, a]));
    return { name: 'this trip', attractions: [...all.values()] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, viewedName, pins, placesKey]);
  const picked = selected ? (stopsOf([selected])[0] ?? null) : null;

  // A new day leaves replace mode (the sub-tab stays). A new viewed place closes the card, unless
  // the search moved the map there to open one (below).
  useEffect(() => setReplace(null), [day]);
  const pendingOpen = useRef<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Replace mode only while its stop is still on its day (an undo, another tab or a settings change can take it away).
  const target = replace && trip.days[replace.day]?.stops.includes(replace.id) ? replace : null;
  useEffect(() => {
    if (replace && !target) setReplace(null);
  }, [replace, target]);

  const plan = trip.days[day];
  const date = dateOf(trip, day);
  const summary = useMemo(
    () => summarizeDay(stopsOf(plan?.stops ?? []), { dayStart: trip.dayStart, pace: trip.pace, date, who: trip.who }),
    // A Date is new every render; its time stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, trip.dayStart, trip.pace, trip.who, date?.getTime()],
  );
  const wetDay = isLikelyWet(getRainChance(dayPlace(trip, day), date));
  const toWet = tab === 'wet';

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

  /** The sub-tabs: the wet-weather plan and replace mode don't mix (replace works on the Plan sub-tab only). */
  const pickTab = (to: PlanTab) => {
    setTab(to);
    if (to === 'wet') setReplace(null);
  };
  const startReplace = (d: number, sid: string) => setReplace((r) => (r?.id === sid ? null : { day: d, id: sid }));

  // ---- the trip's Saved list ----
  const unsave = (sid: string) => {
    const at = trip.saved.indexOf(sid);
    if (at < 0) return;
    edit((t, now) => unsaveFromTrip(t, sid, now));
    offerUndo({ text: `Removed ${nameOf(sid)} from Saved`, run: () => edit(undoUnsave(sid, at)) });
  };
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
        onClick={() => (on ? unsave(sid) : edit((t, now) => saveToTrip(t, sid, now)))}
      >
        <Icon name={on ? 'check' : 'plus'} />
        {on ? 'Saved' : 'Save'}
      </button>
    );
  };

  /** Where the card, the search and the Saved tray add to: the sub-tab open. */
  const add = (sid: string) => (toWet ? addToWet(sid) : addToDay(sid));

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

  // ---- settings ----
  const [draft, setDraft] = useState<TripSettingsValue | null>(null);
  const openSettings = () => {
    setDraft({
      name: trip.name,
      startDate: trip.startDate,
      endDate: endDate(trip),
      days: trip.days.length,
      who: trip.who,
      pace: trip.pace,
      dayStart: trip.dayStart,
    });
    setSheet('settings');
  };
  const dropped = draft ? trip.days.slice(draft.days).reduce((n, d) => n + d.stops.length, 0) : 0;
  // Only the stops Saved doesn't already hold are news.
  const moved = draft ? movedToSaved(trip, draft.days) : 0;
  const droppedWet = draft ? trip.days.slice(draft.days).some((d) => d.wet.length > 0) : false;
  const saveSettings = () => {
    if (!draft) return;
    const v = draft;
    edit((t, now) => {
      const n = setDays(t, v.days, now);
      const name = v.name.trim() || t.name;
      const same = name === n.name && v.startDate === n.startDate && v.who === n.who && v.pace === n.pace && v.dayStart === n.dayStart;
      return same ? n : { ...n, name, startDate: v.startDate, who: v.who, pace: v.pace, dayStart: v.dayStart, updatedAt: now };
    });
    if (moved) setNotice(`${plural(moved, 'stop')} moved to Saved.`);
    setSheet(null);
  };

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
  // change lands on the planner's own entry. Focus goes back to the icon.
  const searchOpen = readPlanSearch(navState);
  const searching = narrow && searchOpen;
  const searchBtn = useRef<HTMLButtonElement>(null);
  const leavingSearch = useRef(false);
  const afterSearch = useRef<(() => void) | null>(null);
  const openSearch = () => {
    if (!searchOpen) navigate({ search }, { state: SEARCH_STATE, preventScrollReset: true });
  };
  const closeSearch = useCallback(
    (then?: () => void) => {
      if (then) afterSearch.current = then;
      if (!searchOpen || leavingSearch.current) return;
      leavingSearch.current = true;
      navigate(-1);
    },
    [searchOpen, navigate],
  );
  const wasSearchOpen = useRef(searchOpen);
  useEffect(() => {
    if (wasSearchOpen.current === searchOpen) return;
    wasSearchOpen.current = searchOpen;
    if (searchOpen) return;
    leavingSearch.current = false;
    const then = afterSearch.current;
    afterSearch.current = null;
    searchBtn.current?.focus({ preventScroll: true });
    then?.();
  }, [searchOpen]);

  // ---- keys ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isTyping(e.target)) return;
      if (document.querySelector('dialog[open], .drawer')) return;
      if (searching) closeSearch();
      else if (selected) setSelected(null);
      else if (replace) setReplace(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, replace, searching, closeSearch]);

  const empty = !!viewed && countFor(viewed) === 0;

  // ---- the phone sheet ----
  // The page scrolls and the day sheet slides up over the fixed map, as on the map page (useGuideScroll).
  // Fully up, its top is at the safe area: it covers the header, and the day dropdown pins there.
  const rootRef = useRef<HTMLDivElement>(null);
  const safeTop = useSafeTop(narrow);
  const phoneFrame = useMemo(() => phoneInsets(safeTop), [safeTop]);
  const insets = narrow ? phoneFrame : INSETS;
  const { open: drawerOpen } = useSaved();
  const { scrollToTop, atGuides } = useGuideScroll({
    enabled: narrow,
    root: rootRef,
    barH: sheetBarH(safeTop),
    levelKey: trip.id,
    paused: drawerOpen || !!sheet || !!confirm || searching,
    peek: PEEK_PHONE,
  });
  // On phone the map's credit moves out of the map, above the sheet, so the sheet never hides it.
  const [attribHost, setAttribHost] = useState<HTMLDivElement | null>(null);
  /** Shows the attraction's card; on phone the sheet goes back down so the map and the card show. */
  const showCard = (sid: string) => {
    setSelected(sid);
    if (narrow) scrollToTop();
  };
  useEffect(() => {
    const sid = pendingOpen.current;
    pendingOpen.current = null;
    if (sid) showCard(sid);
    else setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);
  /**
   * Every way of opening a card (the day list, the wet-weather plan, the search) comes here: the map
   * first goes to the attraction-level place that shows its pin, then the card opens.
   */
  const openStop = (sid: string) => {
    const home = attractionHome(sid, trip.places, place, viewed);
    if (!home || (viewed && sameRef(home, viewed))) return showCard(sid);
    pendingOpen.current = sid;
    setViewed(home);
  };
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
    openStop(sid);
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

  // The map level: a breadcrumb up the viewed place's tree, then on laptops a chip per child for the
  // keyboard. Phones keep the breadcrumb alone, as a slim line under the pills: the bubbles drill in.
  const path = viewed ? pathTo(viewed) : [];
  const chips = !narrow && !!bubbles && bubbles.length > 0;
  const levels = viewed && (
    <div className="plan-levels">
      <nav className="lvl-crumbs" aria-label="Map level">
        <ol>
          {path.map((r, i) => {
            const name = placeLabel(r).name;
            return (
              <li key={refKey(r)}>
                {i < path.length - 1 ? (
                  <>
                    <button type="button" className="lvl-crumb" onClick={() => setViewed(r)}>
                      {name}
                    </button>
                    <span className="lvl-sep" aria-hidden="true">
                      ›
                    </span>
                  </>
                ) : (
                  <>
                    <span className="lvl-crumb is-current" aria-current="location">
                      {name}
                    </span>
                    {/* Leads into the chips: Japan › Hokkaidō, Tōhoku, Kantō… */}
                    {chips && (
                      <span className="lvl-sep is-lead" aria-hidden="true">
                        ›
                      </span>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {chips && bubbles && (
        <div className="lvl-chips" role="group" aria-label={`Places in ${viewedName}`}>
          {bubbles.map((b) => (
            <button key={b.id} type="button" className={`lvl-chip ${b.count ? 'is-live' : ''}`} onClick={b.onPick}>
              {b.label}
              <span className="lvl-chip-count num">{b.count || 'Soon'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
      onRemove={removeFromDay}
      onMove={(d, from, to) => edit((t, now) => moveStop(t, d, from, to, now))}
      onReplace={startReplace}
      onOpen={openStop}
      hotId={selected ?? hoverId}
      onHover={setHoverId}
      replacing={target?.id ?? null}
      onCancelReplace={() => setReplace(null)}
      rainFlags={wetDay ? summary.conditions.rainSensitive : []}
      peek={narrow && <p className="dl-peek">{summary.empty ? 'No stops yet. Add them from the map or search.' : summary.line}</p>}
      after={<DaySummaryPanel summary={summary} />}
      wet={<WetPlan trip={trip} day={day} onRemove={(sid, i) => removeFromWet(day, sid, i)} onOpen={openStop} />}
      tray={<Trays trip={trip} day={day} tab={tab} onPlan={add} onRemove={unsave} replacing={target?.id ?? null} />}
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
      className={`explore planner ${chips ? 'has-level-chips' : ''} ${searching ? 'is-searching' : ''} ${picked ? 'has-card' : ''} ${narrow && atGuides ? 'is-covered' : ''}`}
      style={{ '--sheet-clear': `${SHEET_CLEAR}px`, '--plan-peek': `${PEEK_PHONE}px`, '--sheet-top': `${safeTop}px` } as CSSProperties}
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
              onAttraction={(sid) => closeSearch(() => openStop(sid))}
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
              <button type="button" className="round-button plan-settings" onClick={openSettings} aria-label="Trip settings" title="Trip settings">
                <Icon name="sliders" size={18} />
              </button>
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
            onAttraction={openStop}
            onNotice={setNotice}
          />
        )}
        {/* Phone: the place pills get a row of their own under the bar, scrolling sideways. */}
        {narrow && <div className="plan-places">{switcher}</div>}
        {levels}
      </div>

      <div className="explore-stage">
        {view && (
          <Suspense fallback={<div className="map-loading" aria-hidden="true" />}>
            <MapExplorer
              target={view.target}
              focusPrefs={view.focusPrefs}
              insets={insets}
              // Phone: a city frames on its attractions, as on the map page, not its whole outline:
              // Tokyo's western mountains would leave the city a speck in a phone-wide strip.
              fitPins={narrow}
              pins={pins}
              hoverId={hoverId}
              selectedId={selected}
              tones={tones}
              bubbles={bubbles}
              pickedClearOf={cardRef}
              tour={false}
              wheelScrollsPage={false}
              attributionHost={narrow ? attribHost : null}
              onHover={setHoverId}
              onPrefPick={noop}
              onCountry={noop}
              onRegion={noop}
              onArea={noop}
              onAttraction={setSelected}
              onNotice={setNotice}
            />
          </Suspense>
        )}

        {!narrow && (
          <aside className="panel plan-panel" aria-label="Days">
            {days}
          </aside>
        )}

        <AnimatePresence>
          {picked && (
            <motion.div
              ref={cardRef}
              key={picked.id}
              className="pincard"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: reduced ? 0 : 0.4, ease: EASE_OUT }}
            >
              <PinCard a={picked} onOpen={openDetails} onClose={() => setSelected(null)} action={cardAction(picked.id)} save={saveToggle(picked.id)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {narrow && (
        <>
          <div ref={setAttribHost} className="explore-attrib maplibregl-ctrl-bottom-right" />
          <section className="plan-sheet" aria-label="Days">
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

      <Sheet
        open={sheet === 'settings' && !!draft}
        title="Trip settings"
        onClose={() => setSheet(null)}
        footer={
          <>
            {(dropped > 0 || droppedWet) && draft && (
              <p className="plan-warn" role="status">
                <Icon name="alert" size={16} />
                {dropped > 0
                  ? `${moved > 0 ? `${plural(moved, 'stop')} after Day ${draft.days} will move to Saved` : `The stops after Day ${draft.days} come off their days and stay in Saved`}${droppedWet ? ', and those days’ wet-weather plans will be removed' : ''}.`
                  : `The wet-weather plans after Day ${draft.days} will be removed.`}
              </p>
            )}
            <div className="psheet-actions">
              <button type="button" className="button is-quiet" onClick={() => setSheet(null)}>
                Cancel
              </button>
              <button type="button" className="button" onClick={saveSettings}>
                Save changes
              </button>
            </div>
          </>
        }
      >
        {draft && <TripSettings value={draft} onChange={setDraft} namePlaceholder={trip.name} />}
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
