import { useMemo } from 'react';
import { summarizeDay } from '../../lib/daySummary';
import { getRainChance } from '../../lib/forecast';
import { duration, plural, yen } from '../../lib/format';
import { photo } from '../../lib/photos';
import { dayPlace } from '../../lib/tripPlaces';
import { dateOf, type Trip } from '../../lib/trips';
import { Icon } from '../Icon';
import { shortDate, stopsOf } from './DayList';

interface Props {
  trip: Trip;
  /** The current day, 0-based. */
  day: number;
  onRemove: (id: string, index: number) => void;
  onOpen: (id: string) => void;
}

/**
 * The Wet-weather plan sub-tab: the day's second, optional list of rain-proof places to fall back on.
 * Reference only, nothing swaps automatically. While this sub-tab is open, adds go here.
 */
export function WetPlan({ trip, day, onRemove, onOpen }: Props) {
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

  return (
    <section className="wet" aria-label={`Day ${day + 1}’s wet-weather plan`}>
      <p className="wet-note">
        {chance !== null && date ? (
          <>
            <Icon name="rain" size={16} />
            <strong className="num">{chance}% rain</strong> on {shortDate(date)}.{' '}
          </>
        ) : (
          'No forecast without dates. '
        )}
        A rain-proof backup for Day {day + 1}. Nothing swaps by itself.
      </p>

      {items.length === 0 ? (
        <p className="tray-empty wet-empty">Add rain-proof places from the map, the search or Saved.</p>
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
    </section>
  );
}
