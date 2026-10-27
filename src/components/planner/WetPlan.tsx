import { useMemo } from 'react';
import { getRainChance } from '../../lib/forecast';
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
  /** Opens the Browse sub-tab (the empty plan's way to find places). */
  onBrowse: () => void;
}

/**
 * The Plan sub-tab with the wet-weather toggle on: the day's second, optional list of rain-proof
 * places to fall back on. Reference only, nothing swaps automatically. While the toggle is on, adds go
 * here, and only rain-proof places can be added. Its time and cost are in the day's analysis.
 */
export function WetPlan({ trip, day, onRemove, onOpen, onBrowse }: Props) {
  const ids = trip.days[day]?.wet;
  const items = useMemo(() => stopsOf(ids ?? []), [ids]);
  const date = dateOf(trip, day);
  const chance = getRainChance(dayPlace(trip, day), date);

  return (
    <section className="wet" aria-label={`Day ${day + 1}’s wet-weather plan`}>
      <p className="wet-note">
        <Icon name="drop" size={15} />
        <span>
          Rain plan for {date ? shortDate(date) : `Day ${day + 1}`}
          {chance !== null && date ? (
            <>
              {' · '}
              <strong className="num">{chance}% chance of rain</strong>
            </>
          ) : (
            ' · no forecast without dates'
          )}
        </span>
      </p>

      {items.length === 0 ? (
        <div className="wet-empty">
          <p>
            <strong>No rain-proof places yet</strong>
            Only rain-proof places can be added: indoors, or mostly covered. Add them from Browse, the map or Saved.
          </p>
          <button type="button" className="button is-compact is-quiet" onClick={onBrowse}>
            <Icon name="search" size={15} />
            Browse rain-proof places
          </button>
        </div>
      ) : (
        <ul className="tray-list wet-list">
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
      )}
    </section>
  );
}
