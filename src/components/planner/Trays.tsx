import { useId, useState } from 'react';
import { isRainProof } from '../../lib/factors';
import { photo } from '../../lib/photos';
import { dayOf, type Trip } from '../../lib/trips';
import { Icon } from '../Icon';
import { stopsOf, type PlanTab } from './DayList';

interface Props {
  trip: Trip;
  /** The current day, 0-based. */
  day: number;
  /** The sub-tab open: on Wet-weather plan, adds go to the day's wet-weather plan, rain-proof only. */
  tab: PlanTab;
  /** Adds where the sub-tab says (or, in replace mode, swaps the attraction in). */
  onPlan: (id: string) => void;
  /** Takes the attraction off the trip's Saved list. */
  onRemove: (id: string, index: number) => void;
  /** The stop being replaced, if any: every item offers itself as its replacement. */
  replacing?: string | null;
}

type Action = { label: string; icon: 'plus' | 'swap' | 'arrowRight' };

/**
 * The tray under the day: the trip's own Saved list, a shortlist kept whether or not its places are
 * on a day. (The global hearted list stays in its own drawer.)
 */
export function Trays({ trip, day, tab, onPlan, onRemove, replacing = null }: Props) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const items = stopsOf(trip.saved);
  const wet = tab === 'wet';

  return (
    <div className="trays">
      <section className={`tray ${open ? 'is-open' : ''}`}>
        <h3>
          <button type="button" className="tray-head" aria-expanded={open} aria-controls={`${id}-list`} onClick={() => setOpen((o) => !o)}>
            <span>Saved</span>
            <span className="tray-count num">{items.length}</span>
            <Icon name="chevronDown" size={16} />
          </button>
        </h3>
        {open && (
          <div id={`${id}-list`}>
            {items.length === 0 ? (
              <p className="tray-empty">Save places from the map to keep a shortlist for this trip.</p>
            ) : (
              <ul className="tray-list">
                {items.map((a) => {
                  const on = dayOf(trip, a.id);
                  let action: Action | null = null;
                  let note: string | null = null;
                  let noteIcon: 'check' | 'swap' | 'rain' = 'check';
                  // Where else it is planned, under its name; left out when the action or note says it already.
                  let where = on !== null ? `On Day ${on + 1}` : null;
                  const off = wet && !isRainProof(a);
                  if (wet) {
                    // The wet-weather plan: any rain-proof attraction, whether or not it is on a day.
                    if (off) {
                      note = 'Not rain-proof';
                      noteIcon = 'rain';
                    } else if (trip.days[day]?.wet.includes(a.id)) note = 'In wet-weather plan';
                    else action = { label: 'Add to wet-weather plan', icon: 'plus' };
                  } else if (replacing) {
                    // Replace mode works on the current day: an item already on it can't stand in.
                    if (a.id === replacing) {
                      note = 'Being replaced';
                      noteIcon = 'swap';
                      where = null;
                    } else if (on === day) {
                      note = `Already on Day ${day + 1}`;
                      where = null;
                    } else action = { label: 'Use as replacement', icon: 'swap' };
                  } else if (on === day) {
                    note = `On Day ${day + 1}`;
                    where = null;
                  } else if (on !== null) action = { label: `Move to Day ${day + 1}`, icon: 'arrowRight' };
                  else action = { label: `Add to Day ${day + 1}`, icon: 'plus' };
                  return (
                    <li key={a.id} className={`tray-item ${off ? 'is-off' : ''}`}>
                      <img src={photo(a.id)} alt="" loading="lazy" />
                      <span className="tray-text">
                        <strong>{a.name}</strong>
                        <span>
                          {a.kind}
                          {where && <span className="tray-where"> · {where}</span>}
                        </span>
                      </span>
                      {action ? (
                        <button
                          type="button"
                          className={`tray-add ${replacing && !wet ? 'is-replace' : ''}`}
                          onClick={() => onPlan(a.id)}
                          aria-label={`${action.label}: ${a.name}`}
                        >
                          <Icon name={action.icon} size={14} />
                          {action.label}
                        </button>
                      ) : (
                        <span className="tray-note">
                          <Icon name={noteIcon} size={14} />
                          {note}
                        </span>
                      )}
                      <button
                        type="button"
                        className="dl-icon tray-remove"
                        onClick={() => onRemove(a.id, trip.saved.indexOf(a.id))}
                        aria-label={`Remove ${a.name} from Saved`}
                        title="Remove from Saved"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
