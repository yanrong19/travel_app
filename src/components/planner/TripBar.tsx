import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Attraction } from '../../data/types';
import { summarizeDay } from '../../lib/daySummary';
import { getRainChance, isLikelyWet } from '../../lib/forecast';
import { duration, plural } from '../../lib/format';
import { photo } from '../../lib/photos';
import { schedule } from '../../lib/schedule';
import { slotMismatch } from '../../lib/timeOfDay';
import { dayPlace } from '../../lib/tripPlaces';
import { addStop, dateOf, dayOf, removeStop, saveToTrip, unsaveFromTrip, type Trip } from '../../lib/trips';
import { useTrips } from '../../lib/tripsStore';
import { undoAddStop, undoRemoveStop, undoUnsave, type Edit } from '../../lib/tripUndo';
import { Icon } from '../Icon';
import { Station } from '../Station';
import { hhmm, shortDate, stopsOf } from './DayList';
import { DayPicker, type DayOption } from './DayPicker';

const UNDO_MS = 6000;
/** The day list's open state, for this tab's visit (sessionStorage). */
const OPEN_KEY = 'fitline.tripBar.open';
const FLAG_LINES = ['effort', 'conditions', 'logistics'] as const;
const FLAG_NAMES = { effort: 'Effort', conditions: 'Conditions', logistics: 'Logistics' };

function readOpen() {
  try {
    return sessionStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}
function writeOpen(open: boolean) {
  try {
    sessionStorage.setItem(OPEN_KEY, open ? '1' : '0');
  } catch {
    // Storage blocked: the state lasts for this page only.
  }
}

type Undo = { text: string; run: () => void };

/**
 * The attraction page while planning a trip: a slim pinned bar with the trip, a day, the planner
 * card's add / remove / move action and the trip's Save toggle, and an expandable list of that day's
 * stops with its summary. Edits go to the trip, with Undo, as in the planner. The page holds the day,
 * so Back and onward links carry it.
 */
export function TripBar({
  trip,
  a,
  day: pick,
  onDay,
  onMap,
}: {
  trip: Trip;
  a: Attraction;
  day: number;
  onDay: (day: number) => void;
  /** Back to the planner with this attraction's card on the map (the phone's map button; laptop has its own). */
  onMap: () => void;
}) {
  const { update } = useTrips();
  const id = useId();
  const edit = (fn: Edit) => update(trip.id, fn);
  const day = Math.min(pick, trip.days.length - 1);
  const [open, setOpen] = useState(readOpen);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);

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

  const setOpenTo = (to: boolean) => {
    setOpen(to);
    writeOpen(to);
  };

  // The day dropdown's options, as the planner's day list words them.
  const options = useMemo<DayOption[]>(
    () =>
      trip.days.map((d, i) => {
        const at = dateOf(trip, i);
        const rain = getRainChance(dayPlace(trip, i), at);
        return { label: `Day ${i + 1}`, date: at ? shortDate(at) : null, rain: isLikelyWet(rain) ? rain : null, stops: d.stops.length };
      }),
    [trip],
  );

  const plan = trip.days[day];
  const date = dateOf(trip, day);
  const stops = useMemo(() => stopsOf(plan?.stops ?? []), [plan]);
  const timed = useMemo(() => schedule(stops, trip.dayStart), [stops, trip.dayStart]);
  const summary = useMemo(
    () => summarizeDay(stops, { dayStart: trip.dayStart, pace: trip.pace, date, who: trip.who }),
    // A Date is new every render; its time stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stops, trip.dayStart, trip.pace, trip.who, date?.getTime()],
  );
  const nameOf = (sid: string) => stopsOf([sid])[0]?.name ?? 'That stop';

  // ---- edits ----
  const removeFromDay = (d: number, sid: string) => {
    const index = trip.days[d]?.stops.indexOf(sid) ?? -1;
    if (index < 0) return;
    edit((t, now) => removeStop(t, d, sid, now));
    offerUndo({ text: `Removed ${nameOf(sid)} from Day ${d + 1}`, run: () => edit(undoRemoveStop(d, sid, index)) });
  };

  const on = dayOf(trip, a.id);
  const addAction = () => {
    if (on === day) return removeFromDay(day, a.id);
    const from = on !== null ? { day: on, index: trip.days[on].stops.indexOf(a.id) } : null;
    edit((t, now) => addStop(t, day, a.id, now));
    offerUndo({
      text: from ? `Moved ${a.name} from Day ${from.day + 1} to Day ${day + 1}` : `Added ${a.name} to Day ${day + 1}`,
      run: () => edit(undoAddStop(day, a.id, from)),
    });
  };
  const addLabel = on === day ? `Remove from Day ${day + 1}` : on !== null ? `On Day ${on + 1}: move here` : `Add to Day ${day + 1}`;
  const addIcon = on === day ? 'close' : on !== null ? 'arrowRight' : 'plus';

  const saved = trip.saved.includes(a.id);
  const toggleSave = () => {
    if (!saved) return edit((t, now) => saveToTrip(t, a.id, now));
    const at = trip.saved.indexOf(a.id);
    edit((t, now) => unsaveFromTrip(t, a.id, now));
    offerUndo({ text: `Removed ${a.name} from Saved`, run: () => edit(undoUnsave(a.id, at)) });
  };

  const flagCount = (line: (typeof FLAG_LINES)[number]) => summary.flags.filter((f) => f.factor === line).length;
  const span = timed.length ? `${hhmm(timed[0].start)}–${hhmm(timed[timed.length - 1].end)}` : null;

  return (
    <>
      <div
        className={`tbar ${open ? 'is-open' : ''}`}
        role="region"
        aria-label={`Planning ${trip.name}`}
        onKeyDown={(e) => {
          // The day dropdown handles its own Escape first.
          if (e.key !== 'Escape' || e.defaultPrevented || !open) return;
          setOpenTo(false);
          toggleRef.current?.focus();
        }}
      >
        <div className="tbar-row">
          <p className="tbar-trip">
            <Icon name="trip" size={18} />
            <span className="tbar-trip-text">
              <span className="tbar-kicker">Planning</span>
              <strong>{trip.name}</strong>
            </span>
          </p>
          <div className="tbar-day">
            <DayPicker options={options} value={day} onPick={onDay} />
          </div>
          <button type="button" className={`button is-compact tbar-add ${on === day ? 'is-quiet' : ''}`} onClick={addAction}>
            <Icon name={addIcon} />
            {addLabel}
          </button>
          <div className="tbar-tools">
            <button
              type="button"
              className={`button is-compact plan-save ${saved ? 'is-done' : 'is-quiet'}`}
              aria-pressed={saved}
              aria-label={`Save ${a.name} to this trip`}
              onClick={toggleSave}
            >
              <Icon name={saved ? 'check' : 'plus'} />
              {saved ? 'Saved' : 'Save'}
            </button>
            <button type="button" className="round-button tbar-map" onClick={onMap} aria-label="See it on the map" title="See it on the map">
              <Icon name="map" size={18} />
            </button>
            <button
              ref={toggleRef}
              type="button"
              className="tbar-toggle"
              aria-expanded={open}
              aria-controls={`${id}-panel`}
              onClick={() => setOpenTo(!open)}
            >
              {/* On phone the text is for screen readers only. */}
              <span className="tbar-toggle-text">Day {day + 1} plan</span>
              <Icon name="chevronDown" size={18} />
            </button>
          </div>
        </div>

        <div id={`${id}-panel`} className="tbar-panel" data-lenis-prevent hidden={!open}>
          <div className="dl-head">
            <h2>{`Day ${day + 1}`}</h2>
            <p className="num">{[date && shortDate(date), timed.length ? plural(timed.length, 'stop') : null, span].filter(Boolean).join(' · ')}</p>
          </div>
          {summary.empty ? (
            <p className="tbar-empty">
              <Icon name="plus" size={18} />
              No stops on Day {day + 1} yet.
            </p>
          ) : (
            <>
              <p className="tbar-line">{summary.line}</p>
              <ul className="tbar-flags" aria-label="Things to check">
                {FLAG_LINES.map((l) => {
                  const n = flagCount(l);
                  return (
                    <li key={l} className={n ? 'is-on' : ''} style={{ ['--soft' as string]: `var(--c-${l}-soft)`, ['--tone' as string]: `var(--c-${l}-ink)` }}>
                      <Station line={l} size={18} />
                      {FLAG_NAMES[l]}
                      <span className="num">{n ? `${n} to check` : 'clear'}</span>
                    </li>
                  );
                })}
              </ul>
              <ol className="tbar-stops">
                {timed.map((s, i) => {
                  const miss = slotMismatch(s.a, s.start);
                  return (
                    <li key={s.a.id} className={`tbar-stop ${s.a.id === a.id ? 'is-here' : ''}`} aria-current={s.a.id === a.id ? 'page' : undefined}>
                      <span className="dl-stop-photo">
                        <img src={photo(s.a.id)} alt="" loading="lazy" />
                        <span className="dl-stop-n num" aria-hidden="true">
                          {i + 1}
                        </span>
                      </span>
                      <span className="dl-stop-text">
                        <strong>{s.a.name}</strong>
                        <span className="dl-stop-time num">
                          <Icon name="clock" size={13} />
                          {hhmm(s.start)} · {duration(s.end - s.start)}
                        </span>
                        {miss && (
                          <span className="dl-stop-rain">
                            <Icon name="clock" size={13} />
                            {miss.better ? `Better in the ${miss.better}` : 'Not great at any time of day'}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="dl-icon"
                        onClick={() => removeFromDay(day, s.a.id)}
                        aria-label={`Remove ${s.a.name} from Day ${day + 1}`}
                        title="Remove"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      </div>

      {/* Outside the bar: its backdrop filter would make it the toast's containing block. */}
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
    </>
  );
}
