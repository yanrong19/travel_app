import { useEffect, useId, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { ATTRACTIONS } from '../../data/attractions';
import type { Attraction } from '../../data/types';
import { DAYS, MONTHS, duration, plural } from '../../lib/format';
import { photo } from '../../lib/photos';
import { schedule } from '../../lib/schedule';
import { dateOf, type Trip } from '../../lib/trips';
import { Icon } from '../Icon';

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

interface Props {
  trip: Trip;
  day: number;
  onDay: (day: number) => void;
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
  /** Shown above the stops (e.g. a place with no checked attractions). */
  note?: ReactNode;
}

/** Day tabs, then the day's stops in order with their planned times and the travel between them. */
export function DayList({ trip, day, onDay, onRemove, onMove, onReplace, onOpen, hotId, onHover, replacing, onCancelReplace, note }: Props) {
  const id = useId();
  const tabs = useRef<HTMLDivElement>(null);
  const plan = trip.days[day];
  const timed = useMemo(() => schedule(stopsOf(plan?.stops ?? []), trip.dayStart), [plan, trip.dayStart]);
  const date = dateOf(trip, day);
  const replacingName = replacing ? byId.get(replacing)?.name : null;

  // The current tab scrolls into view (a long trip's tabs scroll sideways).
  useEffect(() => {
    tabs.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [day]);

  const onTabKey = (e: KeyboardEvent) => {
    const last = trip.days.length - 1;
    const to = e.key === 'ArrowRight' ? Math.min(last, day + 1) : e.key === 'ArrowLeft' ? Math.max(0, day - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (to === null) return;
    e.preventDefault();
    onDay(to);
    requestAnimationFrame(() => tabs.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };

  return (
    <div className="dl">
      <div ref={tabs} className="dl-tabs" role="tablist" aria-label="Days" onKeyDown={onTabKey}>
        {trip.days.map((d, i) => {
          const at = dateOf(trip, i);
          return (
            <button
              key={i}
              type="button"
              role="tab"
              id={`${id}-tab-${i}`}
              aria-selected={i === day}
              aria-controls={`${id}-panel`}
              tabIndex={i === day ? 0 : -1}
              className="dl-tab"
              onClick={() => onDay(i)}
            >
              <span>Day {i + 1}</span>
              {at && <span className="dl-tab-date"> · {shortDate(at)}</span>}
              {d.stops.length > 0 && (
                <span className="dl-tab-count num" aria-label={`, ${plural(d.stops.length, 'stop')}`}>
                  {d.stops.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="dl-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${day}`}>
        <div className="dl-head">
          <h2>{`Day ${day + 1}`}</h2>
          <p className="num">
            {[date && shortDate(date), timed.length ? plural(timed.length, 'stop') : null, timed.length ? `${hhmm(timed[0].start)}–${hhmm(timed[timed.length - 1].end)}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {replacingName && (
          <div className="dl-replace" role="status">
            <Icon name="swap" size={16} />
            <span>
              Pick a replacement for <strong>{replacingName}</strong>
            </span>
            <button type="button" className="text-button" onClick={onCancelReplace}>
              Cancel
            </button>
          </div>
        )}

        {note}

        {timed.length === 0 ? (
          <p className="dl-empty">No stops on Day {day + 1} yet. Click a pin on the map, or search, to add one.</p>
        ) : (
          <ol className="dl-stops" data-lenis-prevent>
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
                      onClick={() => onMove(day, i, i - 1)}
                      disabled={i === 0}
                      aria-label={`Move ${s.a.name} up`}
                    >
                      <Icon name="chevronUp" size={16} />
                    </button>
                    <button
                      type="button"
                      className="dl-icon"
                      onClick={() => onMove(day, i, i + 1)}
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
                      onClick={() => onRemove(day, s.a.id, i)}
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
      </div>
    </div>
  );
}
