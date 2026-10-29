import { useEffect, useRef } from 'react';
import { plural } from '../../lib/format';
import { photo } from '../../lib/photos';
import type { Trip } from '../../lib/trips';
import { stopsOf } from './DayList';

interface Props {
  trip: Trip;
  /** The day, 0-based. */
  day: number;
  /** Opens the day again (back to the Plan sub-tab). */
  onOpen: () => void;
  /** The wet-weather toggle is on: the strip shows the day's wet-weather plan. */
  wet?: boolean;
  /** A stop just added from Browse: its thumbnail lights for a moment. */
  flashId?: string | null;
}

/**
 * The day, folded: while Browse is open the day header gives way to this one button, "Day 2" and a
 * numbered thumbnail per stop in day order, then "Open ▾". Adding from Browse lights the new
 * stop's thumbnail; pressing the strip opens the day again.
 */
export function DayStrip({ trip, day, onOpen, wet = false, flashId = null }: Props) {
  const plan = trip.days[day];
  const stops = stopsOf((wet ? plan?.wet : plan?.stops) ?? []);
  const row = useRef<HTMLSpanElement>(null);

  // A new stop can land past the strip's edge: bring its thumbnail into the row.
  useEffect(() => {
    const r = row.current;
    const el = flashId ? r?.querySelector<HTMLElement>(`[data-stop="${CSS.escape(flashId)}"]`) : null;
    if (r && el) r.scrollLeft = el.offsetLeft + el.offsetWidth - r.clientWidth + 8;
  }, [flashId, stops.length]);

  return (
    <button type="button" className={`ds ${wet ? 'is-wet' : ''}`} onClick={onOpen} aria-label={`Day ${day + 1}, ${plural(stops.length, 'stop')}. Show the day plan`}>
      <strong className="ds-day">Day {day + 1}</strong>
      <span ref={row} className="ds-stops" aria-hidden="true">
        {stops.length === 0 && <span className="ds-none">No stops yet</span>}
        {stops.map((a, i) => (
          <span key={a.id} data-stop={a.id} className={`ds-stop ${flashId === a.id ? 'is-flash' : ''}`}>
            <img src={photo(a.id)} alt="" loading="lazy" />
            <span className="ds-n num">{i + 1}</span>
          </span>
        ))}
      </span>
      <span className="ds-open" aria-hidden="true">
        Open ▾
      </span>
    </button>
  );
}
