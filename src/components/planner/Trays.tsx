import { useId, useState } from 'react';
import { useSaved } from '../../lib/saved';
import { photo } from '../../lib/photos';
import { dayOf, type Trip } from '../../lib/trips';
import { Icon } from '../Icon';
import { stopsOf } from './DayList';

interface Props {
  trip: Trip;
  /** The current day, 0-based. */
  day: number;
  /** Plans the attraction on the current day (or, in replace mode, swaps it in). */
  onPlan: (id: string) => void;
  /** The stop being replaced, if any: every item offers itself as its replacement. */
  replacing?: string | null;
}

/** Two collapsible trays under the day: attractions parked in Unplanned, and the hearted ones. */
export function Trays({ trip, day, onPlan, replacing = null }: Props) {
  const saved = useSaved();
  return (
    <div className="trays">
      <Tray
        title="Unplanned"
        ids={trip.unplanned}
        empty="Nothing waiting. “Add to trip” on an attraction parks it here."
        startOpen={trip.unplanned.length > 0}
        trip={trip}
        day={day}
        onPlan={onPlan}
        replacing={replacing}
      />
      <Tray
        title="Saved"
        ids={saved.ids}
        empty="Heart an attraction to keep it here."
        startOpen={false}
        trip={trip}
        day={day}
        onPlan={onPlan}
        replacing={replacing}
      />
    </div>
  );
}

function Tray({
  title,
  ids,
  empty,
  startOpen,
  trip,
  day,
  onPlan,
  replacing,
}: { title: string; ids: string[]; empty: string; startOpen: boolean } & Required<Omit<Props, 'replacing'>> & { replacing: string | null }) {
  const [open, setOpen] = useState(startOpen);
  const id = useId();
  const items = stopsOf(ids);

  return (
    <section className={`tray ${open ? 'is-open' : ''}`}>
      <h3>
        <button type="button" className="tray-head" aria-expanded={open} aria-controls={`${id}-list`} onClick={() => setOpen((o) => !o)}>
          <span>{title}</span>
          <span className="tray-count num">{items.length}</span>
          <Icon name="chevronDown" size={16} />
        </button>
      </h3>
      {open && (
        <div id={`${id}-list`}>
          {items.length === 0 ? (
            <p className="tray-empty">{empty}</p>
          ) : (
            <ul className="tray-list">
              {items.map((a) => {
                const on = dayOf(trip, a.id);
                let action: { label: string; icon: 'plus' | 'swap' | 'arrowRight' } | null;
                let note: string | null = null;
                if (replacing) {
                  action = a.id === replacing ? null : { label: 'Use as replacement', icon: 'swap' };
                  if (!action) note = 'Being replaced';
                } else if (on === day) {
                  action = null;
                  note = `On Day ${day + 1}`;
                } else if (on !== null && on >= 0) action = { label: `On Day ${on + 1}: move here`, icon: 'arrowRight' };
                else action = { label: `Add to Day ${day + 1}`, icon: 'plus' };
                return (
                  <li key={a.id} className="tray-item">
                    <img src={photo(a.id)} alt="" loading="lazy" />
                    <span className="tray-text">
                      <strong>{a.name}</strong>
                      <span>{a.kind}</span>
                    </span>
                    {action ? (
                      <button
                        type="button"
                        className={`tray-add ${replacing ? 'is-replace' : ''}`}
                        onClick={() => onPlan(a.id)}
                        aria-label={`${action.label}: ${a.name}`}
                      >
                        <Icon name={action.icon} size={14} />
                        {action.label}
                      </button>
                    ) : (
                      <span className="tray-note">
                        <Icon name={replacing ? 'swap' : 'check'} size={14} />
                        {note}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
