import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Attraction } from '../../data/types';
import { BROWSE_FILTERS, browseRows, filterCounts, freezeOrder, markerName, type BrowseFilterId, type BrowseRow, type Marker } from '../../lib/browse';
import { photo } from '../../lib/photos';
import type { Trip } from '../../lib/trips';
import { Icon, type IconName } from '../Icon';

interface Props {
  trip: Trip;
  /** The current day, 0-based. */
  day: number;
  /** What to list (lib/browse's browsePool): the viewed place's attractions, or the trip's. */
  pool: Attraction[];
  /** The place the list covers, for its heading. */
  placeName: string;
  /** The chips that are on, kept by the page so they survive a trip to the other sub-tabs. */
  filters: BrowseFilterId[];
  onFilters: (next: BrowseFilterId[]) => void;
  /** The stop being replaced, if any: the rows offer themselves as its replacement. */
  replacing: string | null;
  /** The attraction lit on the map; its row lights too. */
  hotId?: string | null;
  onHover: (id: string | null) => void;
  /** Opens the card (the planner's openStop: the map goes to the attraction's place first). */
  onOpen: (id: string) => void;
  /** Adds to the day, moves it here from another day, or in replace mode swaps it in. */
  onAdd: (id: string) => void;
  /** Takes it off the current day. */
  onRemove: (id: string) => void;
  /** The trip's Save toggle. */
  onSave: (id: string) => void;
  /** No checked attractions here, and the panel already says so. */
  quietEmpty?: boolean;
}

const BEST: Record<string, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
const ACTION_ICON: Record<string, IconName> = { add: 'plus', remove: 'close', move: 'arrowRight', replace: 'swap', note: 'check' };

const markerOfRow = (r: BrowseRow, day: number): Marker =>
  r.n !== null ? { kind: 'today', day, n: r.n } : r.on !== null ? { kind: 'other', day: r.on } : { kind: 'free' };

/**
 * The Browse sub-tab: every attraction the map shows, as a compact list with filter chips. Unplanned
 * ones come first. Hovering or focusing a row lights its dot on the map; the row opens the card; its
 * buttons add, move or remove it, or save it to the trip.
 */
export function Browse({ trip, day, pool, placeName, filters, onFilters, replacing, hotId, onHover, onOpen, onAdd, onRemove, onSave, quietEmpty }: Props) {
  const id = useId();
  // After an action the order holds (the row changes in place), until the day, the chips or the place
  // change; leaving the sub-tab unmounts the list, which lists afresh too.
  const [frozen, setFrozen] = useState<{ ids: string[]; day: number; filters: BrowseFilterId[]; pool: Attraction[] } | null>(null);
  const sorted = useMemo(() => browseRows(pool, trip, day, filters, replacing), [pool, trip, day, filters, replacing]);
  const held = frozen && frozen.day === day && frozen.filters === filters && frozen.pool === pool ? frozen.ids : null;
  // Once the day, chips or place move on, the held order is dropped for good: Day 1, Day 2 and back
  // to Day 1 sorts afresh.
  if (frozen && !held) setFrozen(null);
  const rows = useMemo(() => freezeOrder(sorted, held), [sorted, held]);
  const hold = () => setFrozen({ ids: rows.map((r) => r.a.id), day, filters, pool });
  const counts = useMemo(() => filterCounts(pool, filters), [pool, filters]);
  // Leaving the sub-tab unmounts the list: its row's light on the map goes with it.
  const hoverRef = useRef(onHover);
  hoverRef.current = onHover;
  useEffect(() => () => hoverRef.current(null), []);
  const toggle = (f: BrowseFilterId) => onFilters(filters.includes(f) ? filters.filter((x) => x !== f) : [...filters, f]);

  if (!pool.length) {
    return quietEmpty ? null : (
      <div className="plan-empty" role="status">
        <Icon name="map" size={18} />
        <p>
          <strong>No checked attractions yet</strong>
          Nothing in {placeName} is checked yet. Tokyo is.
        </p>
      </div>
    );
  }

  return (
    <section className="br" aria-labelledby={`${id}-h`}>
      <div className="dl-head">
        <h2 id={`${id}-h`}>{placeName}</h2>
        <p className="num" aria-live="polite">
          {filters.length ? `${rows.length} of ${pool.length}` : `${pool.length} attractions`} · unplanned first
        </p>
      </div>

      <div className="br-filters" role="group" aria-label="Filters">
        {BROWSE_FILTERS.map((f) => {
          const on = filters.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              className={`br-chip ${!on && counts[f.id] === 0 ? 'is-none' : ''}`}
              aria-pressed={on}
              onClick={() => toggle(f.id)}
            >
              {on && <Icon name="check" size={13} />}
              {f.label}
              <span className="br-chip-n num">{counts[f.id]}</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="br-none" role="status">
          <p>Nothing matches these filters</p>
          <button type="button" className="button is-compact is-quiet" onClick={() => onFilters([])}>
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="br-list">
          {rows.map((r) => {
            const { a, facts, action } = r;
            const factsId = `${id}-f-${a.id}`;
            const run = () => {
              hold();
              if (action.kind === 'remove') onRemove(a.id);
              else onAdd(a.id);
            };
            return (
              <li
                key={a.id}
                className={`br-row ${hotId === a.id ? 'is-hot' : ''} ${a.id === replacing ? 'is-replacing' : ''}`}
                onPointerEnter={() => onHover(a.id)}
                onPointerLeave={() => onHover(null)}
                // Focus anywhere in the row (its card button, its action, its Save) keeps it lit.
                onFocus={() => onHover(a.id)}
                onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && onHover(null)}
              >
                {/* The row's main area: it covers the whole row, under the buttons. */}
                <button
                  type="button"
                  className="br-open"
                  onClick={() => onOpen(a.id)}
                  aria-label={`${markerName(a, markerOfRow(r, day))}. Show card`}
                  aria-describedby={factsId}
                />
                <span className="br-photo" aria-hidden="true">
                  <img src={photo(a.id)} alt="" loading="lazy" />
                  {r.n !== null ? <span className="br-badge num">{r.n}</span> : r.on !== null && <span className="br-badge is-other" />}
                </span>
                <span className="br-name">
                  <strong>{a.name}</strong>
                  <span className="br-ja" lang="ja">
                    {a.ja}
                  </span>
                </span>
                <span className="br-facts" id={factsId}>
                  <span className="br-kind">{a.kind}</span>
                  <span className="num">{facts.cost}</span>
                  <span>{facts.effort}</span>
                  {facts.rainProof && (
                    <span className="br-rain" title="Rain-proof">
                      <Icon name="rain" size={13} />
                      <span className="sr-only">Rain-proof</span>
                    </span>
                  )}
                  {facts.best && (
                    <span className="br-best">
                      <Icon name="clock" size={13} />
                      <span className="sr-only">Best in the </span>
                      {BEST[facts.best]}
                    </span>
                  )}
                </span>
                <span className="br-foot">
                  {action.kind === 'note' ? (
                    <span className="tray-note">
                      <Icon name={a.id === replacing ? 'swap' : 'check'} size={14} />
                      {action.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`br-act is-${action.kind}`}
                      onClick={run}
                      aria-label={`${action.label}: ${a.name}`}
                    >
                      <Icon name={ACTION_ICON[action.kind]} size={13} />
                      {action.label}
                    </button>
                  )}
                </span>
                <button
                  type="button"
                  className={`br-save ${r.saved ? 'is-on' : ''}`}
                  aria-pressed={r.saved}
                  aria-label={`Save ${a.name} to this trip`}
                  title={r.saved ? 'Saved to this trip' : 'Save to this trip'}
                  onClick={() => onSave(a.id)}
                >
                  <Icon name="bookmark" size={16} filled={r.saved} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
