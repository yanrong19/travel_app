import { useId, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { ATTRACTIONS } from '../../data/attractions';
import type { Attraction } from '../../data/types';
import { getRainChance, isLikelyWet } from '../../lib/forecast';
import { DAYS, MONTHS, duration, plural } from '../../lib/format';
import { photo } from '../../lib/photos';
import { schedule } from '../../lib/schedule';
import { slotMismatch } from '../../lib/timeOfDay';
import { dayPlace } from '../../lib/tripPlaces';
import { DAY_START, dateOf, type Trip } from '../../lib/trips';
import { Icon } from '../Icon';
import { DayPicker } from './DayPicker';

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

/** The panel's sub-tabs: the day's plan, a list of everything on the map to pick from, and the day's wet-weather plan. */
export type PlanTab = 'plan' | 'browse' | 'wet';

interface Props {
  trip: Trip;
  day: number;
  onDay: (day: number) => void;
  /** The sub-tab shown. It also decides where adds from the card, the search and Saved go. */
  tab: PlanTab;
  onTab: (tab: PlanTab) => void;
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
  /** Shown under the stops on the Plan sub-tab, in the same scroll (the day summary). */
  after?: ReactNode;
  /** The Wet-weather plan sub-tab's content. */
  wet?: ReactNode;
  /** The Browse sub-tab's content. */
  browse?: ReactNode;
  /** Shown last on either sub-tab (the trip's Saved tray). */
  tray?: ReactNode;
  /** Stops to flag for rain (on a likely-wet day, the summary's rain-sensitive stops), worded from their rain rating. */
  rainFlags?: string[];
  /** Shown under the day dropdown, above the sub-tabs (the phone sheet's one-line summary). */
  peek?: ReactNode;
  /** Shown above the day dropdown, whatever the day (trips can't be saved). */
  banner?: ReactNode;
}

/** `short` is the phone's label, where three sub-tabs share a narrow pill. */
const TABS: { id: PlanTab; label: string; short?: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'browse', label: 'Browse' },
  { id: 'wet', label: 'Wet-weather plan', short: 'Wet weather' },
];

/**
 * The day dropdown, then the Plan, Browse and Wet-weather plan sub-tabs. Plan lists the day's stops in
 * order with their planned times and the travel between them; Browse lists what the map shows.
 */
export function DayList({
  trip,
  day,
  onDay,
  tab,
  onTab,
  onRemove,
  onMove,
  onReplace,
  onOpen,
  hotId,
  onHover,
  replacing,
  onCancelReplace,
  note,
  after,
  wet,
  browse,
  tray,
  rainFlags = [],
  peek,
  banner,
}: Props) {
  const id = useId();
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
  const wetDay = isLikelyWet(rain[day]);

  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const to = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    onTab(TABS[to].id);
    requestAnimationFrame(() => tabs.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };

  // Replace mode starts on Plan; Browse can pick the replacement too.
  const replaceBanner = replacingName && (
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
    <div className="dl">
      {banner}
      <div className="dl-top">
        <DayPicker options={options} value={day} onPick={onDay} />
      </div>
      {peek}
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
            {t.id === 'wet' && wetDay && <Icon name="rain" size={15} />}
            {t.short ? (
              <>
                <span className="dl-subtab-long">{t.label}</span>
                <span className="dl-subtab-short">{t.short}</span>
              </>
            ) : (
              t.label
            )}
            {t.id === 'wet' && wetDay && <span className="sr-only">, {rain[day]}% rain</span>}
          </button>
        ))}
      </div>

      <div className="dl-panel" role="tabpanel" data-lenis-prevent id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`}>
        {tab === 'wet' ? (
          <>
            {note}
            {wet}
          </>
        ) : tab === 'browse' ? (
          <>
            {replaceBanner}
            {note}
            {browse}
          </>
        ) : (
          <>
            <div className="dl-head">
              <h2>{`Day ${day + 1}`}</h2>
              <p className="num">
                {[date && shortDate(date), timed.length ? plural(timed.length, 'stop') : null, timed.length ? `${hhmm(timed[0].start)}–${hhmm(timed[timed.length - 1].end)}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            {replaceBanner}

            {note}

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

            {after}
          </>
        )}
        {tray}
      </div>
    </div>
  );
}
