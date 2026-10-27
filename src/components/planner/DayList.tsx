import { useId, useMemo, useRef, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ATTRACTIONS } from '../../data/attractions';
import type { Attraction } from '../../data/types';
import type { PlanTab } from '../../lib/dayView';
import { getRainChance, isLikelyWet } from '../../lib/forecast';
import { DAYS, MONTHS, duration, plural } from '../../lib/format';
import { EASE_OUT, useReducedMotion } from '../../lib/motion';
import { photo } from '../../lib/photos';
import { schedule } from '../../lib/schedule';
import { slotMismatch } from '../../lib/timeOfDay';
import { dayPlace } from '../../lib/tripPlaces';
import { DAY_END, DAY_START, dateOf, type Trip } from '../../lib/trips';
import { Icon } from '../Icon';
import { DayPicker } from './DayPicker';
import { DayTimes } from './DayTimes';

const byId = new Map(ATTRACTIONS.map((a) => [a.id, a]));

/** The attractions behind a list of ids, skipping any the data no longer has. */
export const stopsOf = (ids: string[]): Attraction[] => ids.map((id) => byId.get(id)).filter((a): a is Attraction => !!a);

const pad = (n: number) => String(n).padStart(2, '0');
/** Minutes from midnight → "09:30". */
export const hhmm = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(Math.round(min) % 60)}`;

/** "Tue 14 Apr" */
export const shortDate = (d: Date) => `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** "Day 3", or "Day 3 · Tue 14 Apr" when the trip has dates. */
export function dayLabel(trip: Trip, day: number) {
  const d = dateOf(trip, day);
  return `Day ${day + 1}${d ? ` · ${shortDate(d)}` : ''}`;
}

export type { PlanTab } from '../../lib/dayView';

/** The day analysis, behind the header's Analysis button. */
export interface AnalysisSlot {
  open: boolean;
  /** The analysis region's id, for the button's aria-controls. */
  id: string;
  /** Beside the day panel (the page shows it), or sliding over the day list (shown here, from `content`). */
  mode: 'side' | 'overlay';
  onToggle: () => void;
  onClose: () => void;
  /** The Analysis button, so focus can come back to it when the analysis closes. */
  buttonRef: Ref<HTMLButtonElement>;
  /** The overlay's content (DayAnalysis). */
  content?: ReactNode;
  /** The overlay also closes with a swipe to the right (touch screens). */
  swipe?: boolean;
}

interface Props {
  trip: Trip;
  day: number;
  onDay: (day: number) => void;
  /** The sub-tab shown. */
  tab: PlanTab;
  onTab: (tab: PlanTab) => void;
  /** The wet-weather toggle: the list shows the day's wet-weather plan, and adds go there. */
  wet: boolean;
  onWet: (on: boolean) => void;
  /** Sets the day's start or end time; false when it wasn't taken (an end not after the start). */
  onTimes: (day: number, times: { start?: string; end?: string }) => boolean;
  onRemove: (day: number, id: string, index: number) => void;
  onMove: (day: number, from: number, to: number) => void;
  onReplace: (day: number, id: string) => void;
  onOpen: (id: string) => void;
  /** The attraction lit on the map; its row lights too. */
  hotId?: string | null;
  onHover?: (id: string | null) => void;
  /** The stop being replaced, if any. */
  replacing?: string | null;
  onCancelReplace?: () => void;
  /** Shown at the top of either sub-tab (e.g. a place with no checked attractions). */
  note?: ReactNode;
  /** The Plan sub-tab's content with the wet-weather toggle on (WetPlan). */
  wetPlan?: ReactNode;
  /** The Browse sub-tab's content. */
  browse?: ReactNode;
  /** Shown last on either sub-tab (the trip's Saved tray). */
  tray?: ReactNode;
  /** Stops to flag for rain (on a likely-wet day, the summary's rain-sensitive stops), worded from their rain rating. */
  rainFlags?: string[];
  /** The day's one-line summary, under the header: a hint for the Analysis button. */
  hint: string;
  analysis: AnalysisSlot;
  /** Shown above the day dropdown, whatever the day (trips can't be saved). */
  banner?: ReactNode;
}

const TABS: { id: PlanTab; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'browse', label: 'Browse' },
];

/** How far right a swipe has to carry the analysis (or how fast) to close it. */
const SWIPE_PX = 80;
const SWIPE_SPEED = 400;

/**
 * The day dropdown, then the day's header: its date and stops, its start and end times, the
 * wet-weather toggle and the Analysis button, with the one-line summary under them. Then the Plan
 * and Browse sub-tabs. Plan lists the day's stops in order with their planned times and the travel
 * between them (with the toggle on, the day's wet-weather plan); Browse lists what the map shows.
 * With the toggle on, rain falls softly behind the panel.
 */
export function DayList({
  trip,
  day,
  onDay,
  tab,
  onTab,
  wet,
  onWet,
  onTimes,
  onRemove,
  onMove,
  onReplace,
  onOpen,
  hotId,
  onHover,
  replacing,
  onCancelReplace,
  note,
  wetPlan,
  browse,
  tray,
  rainFlags = [],
  hint,
  analysis,
  banner,
}: Props) {
  const id = useId();
  const reduced = useReducedMotion();
  const tabs = useRef<HTMLDivElement>(null);
  const plan = trip.days[day];
  const timed = useMemo(() => schedule(stopsOf(plan?.stops ?? []), plan?.start ?? DAY_START), [plan]);
  // Stops starting in a part of the day rated poor for them, by position in `timed`.
  const misses = useMemo(() => timed.map((s) => slotMismatch(s.a, s.start)), [timed]);
  const date = dateOf(trip, day);
  // Positions in the day's own list: the timed list skips ids the data doesn't have, so its indices can differ.
  const rawIndex = (sid: string) => plan?.stops.indexOf(sid) ?? -1;
  const replacingName = replacing ? byId.get(replacing)?.name : null;
  // Each day's rain chance, from the place of its first stop (or the trip's first place).
  const rain = useMemo(() => trip.days.map((_, i) => getRainChance(dayPlace(trip, i), dateOf(trip, i))), [trip]);
  const options = useMemo(
    () =>
      trip.days.map((d, i) => {
        const at = dateOf(trip, i);
        return { label: `Day ${i + 1}`, date: at ? shortDate(at) : null, rain: isLikelyWet(rain[i]) ? rain[i] : null, stops: d.stops.length };
      }),
    [trip, rain],
  );
  const chance = rain[day];
  const overlay = analysis.mode === 'overlay' && analysis.open;

  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const to = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    onTab(TABS[to].id);
    requestAnimationFrame(() => tabs.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };

  // Replace mode starts on Plan; Browse can pick the replacement too. Never with the toggle on.
  const replaceBanner = replacingName && !wet && (
    <div className="dl-replace" role="status">
      <Icon name="swap" size={16} />
      <span>
        Pick a replacement for <strong>{replacingName}</strong>
      </span>
      <button type="button" className="text-button" onClick={onCancelReplace}>
        Cancel
      </button>
    </div>
  );

  return (
    <div className={`dl ${wet ? 'is-wet' : ''}`}>
      {/* The rain behind the panel while the toggle is on: drops over a cooler tint, behind the content. */}
      <div className="dl-rain" aria-hidden="true" />
      {banner}
      <div className="dl-top">
        <DayPicker options={options} value={day} onPick={onDay} />
      </div>

      <div className={`dl-stage ${overlay ? 'is-covered' : ''}`}>
        <div className="dl-body" inert={overlay}>
          <div className="dl-day">
            <p className="dl-date num">{[date && shortDate(date), timed.length ? plural(timed.length, 'stop') : 'No stops yet'].filter(Boolean).join(' · ')}</p>
            <DayTimes day={day} start={plan?.start ?? DAY_START} end={plan?.end ?? DAY_END} onChange={(t) => onTimes(day, t)} />
            <button type="button" className="dl-wet" aria-pressed={wet} onClick={() => onWet(!wet)}>
              <Icon name="drop" size={15} />
              <span className="dl-wet-text">
                Wet weather
                {chance !== null && (
                  <>
                    <span className="num" aria-hidden="true">
                      {' · '}
                      {chance}%
                    </span>
                    <span className="sr-only">, {chance}% chance of rain</span>
                  </>
                )}
              </span>
              <span className="dl-switch" aria-hidden="true" />
            </button>
            <button
              ref={analysis.buttonRef}
              type="button"
              className="dl-analyse"
              aria-expanded={analysis.open}
              aria-controls={analysis.id}
              aria-describedby={`${id}-hint`}
              onClick={analysis.onToggle}
            >
              <Icon name="analysis" size={16} />
              Analysis
            </button>
          </div>
          <p className="dl-hint" id={`${id}-hint`}>
            {hint}
          </p>

          <div ref={tabs} className="dl-subtabs" role="tablist" aria-label={`Day ${day + 1}`} onKeyDown={onTabKey}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`${id}-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`${id}-panel`}
                tabIndex={tab === t.id ? 0 : -1}
                className="dl-subtab"
                onClick={() => onTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="dl-panel" role="tabpanel" data-lenis-prevent id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`}>
            {tab === 'browse' ? (
              <>
                {replaceBanner}
                {note}
                {browse}
              </>
            ) : wet ? (
              <>
                {note}
                {wetPlan}
              </>
            ) : (
              <>
                {replaceBanner}

                {note}

                {timed.length === 0 && (
                  <div className="dl-empty">
                    <p>
                      <strong>No stops yet</strong>
                      Add places from Browse, the map or search. They line up here in order, with their times.
                    </p>
                    <button type="button" className="button is-compact is-quiet" onClick={() => onTab('browse')}>
                      <Icon name="search" size={15} />
                      Browse places
                    </button>
                  </div>
                )}

                {timed.length > 0 && (
                  <ol className="dl-stops">
                    {timed.map((s, i) => (
                      <li key={s.a.id}>
                        {i > 0 && (
                          <p className="dl-travel num">
                            <Icon name="train" size={14} />
                            <span aria-hidden="true">≈ {duration(s.travelBefore)}</span>
                            <span className="sr-only">About {duration(s.travelBefore)} to get there</span>
                          </p>
                        )}
                        <div
                          className={`dl-stop ${hotId === s.a.id ? 'is-hot' : ''} ${replacing === s.a.id ? 'is-replacing' : ''}`}
                          onPointerEnter={() => onHover?.(s.a.id)}
                          onPointerLeave={() => onHover?.(null)}
                        >
                          <div className="dl-stop-order">
                            <button
                              type="button"
                              className="dl-icon"
                              onClick={() => onMove(day, rawIndex(s.a.id), rawIndex(timed[i - 1].a.id))}
                              disabled={i === 0}
                              aria-label={`Move ${s.a.name} up`}
                            >
                              <Icon name="chevronUp" size={16} />
                            </button>
                            <button
                              type="button"
                              className="dl-icon"
                              onClick={() => onMove(day, rawIndex(s.a.id), rawIndex(timed[i + 1].a.id))}
                              disabled={i === timed.length - 1}
                              aria-label={`Move ${s.a.name} down`}
                            >
                              <Icon name="chevronDown" size={16} />
                            </button>
                          </div>
                          <button type="button" className="dl-stop-main" onClick={() => onOpen(s.a.id)}>
                            <span className="dl-stop-photo">
                              <img src={photo(s.a.id)} alt="" loading="lazy" />
                              <span className="dl-stop-n num" aria-hidden="true">
                                {i + 1}
                              </span>
                            </span>
                            <span className="dl-stop-text">
                              <strong>{s.a.name}</strong>
                              <span className="dl-stop-kind">{s.a.kind}</span>
                              <span className="dl-stop-time num">
                                <Icon name="clock" size={13} />
                                {hhmm(s.start)} · {duration(s.end - s.start)}
                              </span>
                              {misses[i] && (
                                <span className="dl-stop-rain">
                                  <Icon name="clock" size={13} />
                                  {misses[i].better ? `Better in the ${misses[i].better}` : 'Not great at any time of day'}
                                </span>
                              )}
                              {rainFlags.includes(s.a.id) && (
                                <span className="dl-stop-rain num">
                                  <Icon name="rain" size={13} />
                                  {s.a.conditions.weather.rain === 'poor' ? 'Poor in rain' : 'Mostly open-air'} · {s.a.conditions.covered}% covered
                                </span>
                              )}
                            </span>
                          </button>
                          <div className="dl-stop-order">
                            <button
                              type="button"
                              className="dl-icon"
                              onClick={() => onReplace(day, s.a.id)}
                              aria-pressed={replacing === s.a.id}
                              aria-label={`Replace ${s.a.name}`}
                              title="Replace"
                            >
                              <Icon name="swap" size={16} />
                            </button>
                            <button
                              type="button"
                              className="dl-icon"
                              onClick={() => onRemove(day, s.a.id, rawIndex(s.a.id))}
                              aria-label={`Remove ${s.a.name} from Day ${day + 1}`}
                              title="Remove"
                            >
                              <Icon name="close" size={16} />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
            {tray}
          </div>
        </div>

        <AnimatePresence>
          {overlay && (
            <motion.section
              key="analysis"
              id={analysis.id}
              className="dl-analysis"
              aria-label={`Day ${day + 1} analysis`}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: reduced ? 0 : 0.36, ease: EASE_OUT }}
              drag={analysis.swipe ? 'x' : false}
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 1 }}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_SPEED) analysis.onClose();
              }}
            >
              {analysis.content}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
