import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import type { Insets } from '../map/camera';
import { BottomTabs, TopNav } from '../components/Chrome';
import { PinCard } from '../components/MapCards';
import { MapSearch } from '../components/MapSearch';
import { Icon } from '../components/Icon';
import { DayList, stopsOf } from '../components/planner/DayList';
import { DaySummaryPanel } from '../components/planner/DaySummaryPanel';
import { PlacePicker } from '../components/planner/PlacePicker';
import { PlaceSwitcher } from '../components/planner/PlaceSwitcher';
import { Sheet } from '../components/planner/Sheet';
import { TripSettings, type TripSettingsValue } from '../components/planner/TripSettings';
import { Trays } from '../components/planner/Trays';
import { WetPlan, type AddTarget } from '../components/planner/WetPlan';
import { summarizeDay } from '../lib/daySummary';
import { isRainProof } from '../lib/factors';
import { getRainChance, isLikelyWet } from '../lib/forecast';
import { plural } from '../lib/format';
import { EASE_OUT, useReducedMotion } from '../lib/motion';
import { useGo } from '../lib/transition';
import {
  addPlace,
  addStop,
  addWet,
  dateOf,
  dayOf,
  endDate,
  moveStop,
  planUnplanned,
  removePlace,
  removeStop,
  removeWet,
  replaceStop,
  setDays,
  type PlaceRef,
  type Trip,
} from '../lib/trips';
import { attractionsIn, covers, coveringPlace, dayPlace, placeLabel, placeView, sameRef } from '../lib/tripPlaces';
import { useSaved } from '../lib/saved';
import { useTrips } from '../lib/tripsStore';
import { undoRemovePlace, undoRemoveStop, undoRemoveWet, undoReplace } from '../lib/tripUndo';
import { useGuideScroll } from '../lib/useGuideScroll';
import { useMedia } from '../lib/useMedia';

// The map engine is large, so it loads only on the map pages.
const MapExplorer = lazy(() => import('../map/MapExplorer'));

const UNDO_MS = 6000;
const NOTICE_MS = 3600;
const noop = () => {};
/** Laptop: the map frames its place between the top bar and search, and the day panel. */
const INSETS: Insets = { top: 236, right: 476, bottom: 40, left: 40 };
/**
 * Phone: the day panel is a bottom sheet over the map, as the map page's guide sheet is. The page
 * scrolls; the sheet peeks PEEK_PHONE tall above the tab bar (SHEET_CLEAR) and comes up to
 * SHEET_TOP, under the trip bar, the search and the place pills.
 */
const PEEK_PHONE = 128;
const SHEET_CLEAR = 92;
const SHEET_TOP = 240;
const INSETS_PHONE: Insets = { top: SHEET_TOP, right: 16, bottom: PEEK_PHONE + SHEET_CLEAR + 16, left: 16 };

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
  const narrow = useMedia('(max-width: 760px)');
  const reduced = useReducedMotion();
  const edit = useCallback((fn: (t: Trip, now: number) => Trip) => update(trip.id, fn), [update, trip.id]);

  // The day and place shown live in the URL (?day=3&place=2, 1-based), so Back from an attraction
  // page comes back to them. Written with replace: switching days isn't a step in history.
  const [params, setParams] = useSearchParams();
  const dayIdx = indexParam(params.get('day'));
  const placeIdx = indexParam(params.get('place'));
  const setParam = useCallback(
    (key: 'day' | 'place', index: number) =>
      setParams(
        (p) => {
          const q = new URLSearchParams(p);
          q.set(key, String(index + 1));
          return q;
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  );
  const setDayIdx = useCallback((d: number) => setParam('day', d), [setParam]);
  const setPlaceIdx = useCallback((i: number) => setParam('place', i), [setParam]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [replace, setReplace] = useState<{ day: number; id: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [sheet, setSheet] = useState<'places' | 'settings' | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [adding, setAdding] = useState<AddTarget>('day');
  const undoTimer = useRef<number | undefined>(undefined);

  // The trip can shrink under the page (fewer days, a place removed): stay on one that exists.
  // The clamp is written back, so a trip that shrinks and grows again doesn't jump to an old day.
  const day = Math.min(dayIdx, trip.days.length - 1);
  const pi = Math.min(placeIdx, Math.max(0, trip.places.length - 1));
  useEffect(() => {
    if (dayIdx !== day) setDayIdx(day);
  }, [dayIdx, day, setDayIdx]);
  const place = trip.places[pi] ?? null;
  const placeKey = place ? `${place.level}:${place.id}` : '';
  const placeName = place ? placeLabel(place).name : 'this trip';

  useEffect(() => {
    document.title = `${trip.name} · Fitline`;
  }, [trip.name]);

  // ---- the map ----
  // Keyed on the place itself, so an unrelated edit doesn't hand the map a new target and reframe it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = useMemo(() => (place ? placeView(place) : null), [placeKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pins = useMemo(() => (place ? attractionsIn(place) : []), [placeKey]);
  const tones = useMemo(() => {
    const t: Record<string, 'today' | 'other'> = {};
    trip.days.forEach((d, i) => d.stops.forEach((s) => (t[s] = i === day ? 'today' : 'other')));
    return t;
  }, [trip.days, day]);
  const scope = useMemo(() => ({ name: placeName, attractions: pins }), [placeName, pins]);
  const picked = selected ? (stopsOf([selected])[0] ?? null) : null;

  // A new place or day closes the card; a new day leaves replace mode.
  useEffect(() => setSelected(null), [placeKey]);
  useEffect(() => setReplace(null), [day]);
  useEffect(() => setAdding('day'), [day]);

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
  const toWet = adding === 'wet';

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
        text: `${nameOf(sid)} replaces ${nameOf(old)} on Day ${d + 1} · ${nameOf(old)} moved to Unplanned`,
        run: () => edit(undoIt),
      });
      return;
    }
    edit((t, now) => (t.unplanned.includes(sid) ? planUnplanned(t, sid, day, now) : addStop(t, day, sid, now)));
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

  /** "Adding to": the wet-weather plan and replace mode don't mix (replace works on day lists only). */
  const pickAdding = (to: AddTarget) => {
    setAdding(to);
    if (to === 'wet') setReplace(null);
  };
  const startReplace = (d: number, sid: string) => {
    setAdding('day');
    setReplace((r) => (r?.id === sid ? null : { day: d, id: sid }));
  };

  /** Where the card, the search and the trays add to. */
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
      } else label = on !== null && on >= 0 ? `On Day ${on + 1} · use as replacement` : 'Use as replacement';
    } else if (on === day) {
      label = `Remove from Day ${day + 1}`;
      icon = 'close';
      quiet = true;
      run = () => removeFromDay(day, sid, trip.days[day].stops.indexOf(sid));
    } else if (on !== null && on >= 0) {
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
  const allIds = (t: Trip) => [...new Set([...t.days.flatMap((d) => [...d.stops, ...d.wet]), ...t.unplanned])];

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
      // The places, days and unplanned as they were, unless they have changed since; the map goes back too.
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
    if (dropped) setNotice(`${plural(dropped, 'stop')} moved to Unplanned.`);
    setSheet(null);
  };

  // ---- the name, edited in place ----
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const typeName = (text: string) => {
    setNameDraft(text);
    const name = text.trim();
    if (name) edit((t, now) => (t.name === name ? t : { ...t, name, updatedAt: now }));
  };

  // ---- keys ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isTyping(e.target)) return;
      if (document.querySelector('dialog[open], .drawer')) return;
      if (selected) setSelected(null);
      else if (replace) setReplace(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, replace]);

  const empty = !!place && pins.length === 0;
  const insets = narrow ? INSETS_PHONE : INSETS;

  // ---- the phone sheet ----
  // The page scrolls and the day sheet slides up over the fixed map, as on the map page (useGuideScroll).
  const rootRef = useRef<HTMLDivElement>(null);
  const { open: drawerOpen } = useSaved();
  const { scrollToTop } = useGuideScroll({
    enabled: narrow,
    root: rootRef,
    barH: SHEET_TOP + SHEET_CLEAR,
    levelKey: trip.id,
    paused: drawerOpen || !!sheet || !!confirm,
    peek: PEEK_PHONE,
  });
  // On phone the map's credit moves out of the map, above the sheet, so the sheet never hides it.
  const [attribHost, setAttribHost] = useState<HTMLDivElement | null>(null);
  /** Opens the attraction's card; on phone the sheet goes back down so the map and the card show. */
  const openStop = (sid: string) => {
    setSelected(sid);
    if (narrow) scrollToTop();
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
      after={
        <>
          <DaySummaryPanel summary={summary} />
          <WetPlan
            trip={trip}
            day={day}
            open={wetDay}
            adding={adding}
            onAdding={pickAdding}
            onRemove={(sid, i) => removeFromWet(day, sid, i)}
            onOpen={openStop}
          />
          <Trays trip={trip} day={day} onPlan={add} replacing={target?.id ?? null} wet={toWet} />
        </>
      }
      note={
        empty && (
          <div className="plan-empty" role="status">
            <Icon name="map" size={18} />
            <p>
              <strong>No checked attractions yet</strong>
              {placeName} is on the map, but its attractions aren’t checked yet. Tokyo is. Your stops stay on their days.
            </p>
          </div>
        )
      }
    />
  );

  return (
    <div
      ref={rootRef}
      className="explore planner"
      style={{ '--sheet-clear': `${SHEET_CLEAR}px`, '--plan-peek': `${PEEK_PHONE}px`, '--sheet-top': `${SHEET_TOP}px` } as CSSProperties}
    >
      <div className="explore-chrome">
        <TopNav tone="glass" />
        <div className="plan-bar">
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
          <button type="button" className="round-button plan-settings" onClick={openSettings} aria-label="Trip settings" title="Trip settings">
            <Icon name="sliders" size={18} />
          </button>
        </div>
        {view && (
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
        {/* Phone: the place pills get a row of their own under the search, scrolling sideways. */}
        {narrow && <div className="plan-places">{switcher}</div>}
      </div>

      <div className="explore-stage">
        {view && (
          <Suspense fallback={<div className="map-loading" aria-hidden="true" />}>
            <MapExplorer
              target={view.target}
              focusPrefs={view.focusPrefs}
              insets={insets}
              pins={pins}
              hoverId={hoverId}
              selectedId={selected}
              tones={tones}
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
              key={picked.id}
              className="pincard"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: reduced ? 0 : 0.4, ease: EASE_OUT }}
            >
              <PinCard a={picked} onOpen={(aid) => go(`/attraction/${aid}`)} onClose={() => setSelected(null)} action={cardAction(picked.id)} />
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
                  ? `${plural(dropped, 'stop')} after Day ${draft.days} will move to Unplanned${droppedWet ? ', and those days’ wet-weather plans will be removed' : ''}.`
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
