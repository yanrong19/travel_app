import { useEffect, useId, useMemo, useState } from 'react';
import { summarizeDay } from '../../lib/daySummary';
import { getRainChance } from '../../lib/forecast';
import { duration, plural, yen } from '../../lib/format';
import { photo } from '../../lib/photos';
import { dayPlace } from '../../lib/tripPlaces';
import { dateOf, type Trip } from '../../lib/trips';
import { Icon } from '../Icon';
import { shortDate, stopsOf } from './DayList';

/** Where the next add from the card, the search or the trays goes. */
export type AddTarget = 'day' | 'wet';

interface Props {
  trip: Trip;
  /** The current day, 0-based. */
  day: number;
  /** Open by default (the day is likely wet). Reapplied when it changes. */
  open: boolean;
  adding: AddTarget;
  onAdding: (to: AddTarget) => void;
  onRemove: (id: string, index: number) => void;
  onOpen: (id: string) => void;
}

/**
 * The day's wet-weather plan: a second, optional list of rain-proof places to fall back on.
 * Reference only, nothing swaps automatically. Its "Adding to" switch decides where the next add goes.
 */
export function WetPlan({ trip, day, open: startOpen, adding, onAdding, onRemove, onOpen }: Props) {
  const [openState, setOpen] = useState(startOpen);
  const id = useId();
  useEffect(() => setOpen(startOpen), [startOpen, day]);
  // While it is the target of the next add, the plan stays open.
  const open = openState || adding === 'wet';

  const ids = trip.days[day]?.wet ?? [];
  const items = useMemo(() => stopsOf(ids), [ids]);
  const date = dateOf(trip, day);
  const chance = getRainChance(dayPlace(trip, day), date);
  const sum = useMemo(
    () => summarizeDay(items, { dayStart: trip.dayStart, pace: trip.pace, date, who: trip.who }),
    // A Date is new every render; its time stands in for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, trip.dayStart, trip.pace, trip.who, date?.getTime()],
  );

  const toggle = () => {
    // Closed, the plan can't be the target of the next add.
    if (open && adding === 'wet') onAdding('day');
    setOpen(!open);
  };

  return (
    <section className={`wet ${open ? 'is-open' : ''}`} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>
        <button type="button" className="tray-head wet-head" aria-expanded={open} aria-controls={`${id}-body`} onClick={toggle}>
          <Icon name="rain" size={18} />
          <span>Wet-weather plan</span>
          <span className="tray-count num">{items.length}</span>
          <Icon name="chevronDown" size={16} />
        </button>
      </h3>
      {open && (
        <div id={`${id}-body`} className="wet-body">
          <p className="wet-note">
            {chance !== null && date ? (
              <>
                <strong className="num">{chance}% rain</strong> on {shortDate(date)}.{' '}
              </>
            ) : (
              'No forecast without dates. '
            )}
            A rain-proof backup for Day {day + 1}. Nothing swaps by itself.
          </p>

          <div className="wet-adding" role="group" aria-label="Where the next add goes">
            <span className="wet-adding-label">Adding to:</span>
            <div className="wet-switch">
              <button type="button" aria-pressed={adding === 'day'} onClick={() => onAdding('day')}>
                Day {day + 1}
              </button>
              <button type="button" aria-pressed={adding === 'wet'} onClick={() => onAdding('wet')}>
                Wet-weather plan
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="tray-empty wet-empty">
              {adding === 'wet'
                ? 'Now add rain-proof places from the map, the search or the trays.'
                : 'Switch to Wet-weather plan, then add rain-proof places from the map, the search or the trays.'}
            </p>
          ) : (
            <>
              <ul className="tray-list">
                {items.map((a, i) => (
                  <li key={a.id} className="tray-item">
                    <button type="button" className="wet-open" onClick={() => onOpen(a.id)}>
                      <img src={photo(a.id)} alt="" loading="lazy" />
                      <span className="tray-text">
                        <strong>{a.name}</strong>
                        <span>{a.kind}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="dl-icon"
                      onClick={() => onRemove(a.id, i)}
                      aria-label={`Remove ${a.name} from the wet-weather plan`}
                      title="Remove"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="wet-sum num">
                <Icon name="clock" size={14} />
                <span>
                  {plural(items.length, 'place')} · about {duration(sum.logistics.usedMin)} incl. travel ·{' '}
                  {sum.cost.min === sum.cost.max ? yen(sum.cost.min) : `${yen(sum.cost.min)} – ${yen(sum.cost.max)}`}
                </span>
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
