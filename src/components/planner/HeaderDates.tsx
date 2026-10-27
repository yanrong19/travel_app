import { useEffect, useId, useRef, useState } from 'react';
import { plural } from '../../lib/format';
import { endDate, movedToSaved, type Trip } from '../../lib/trips';
import { Icon } from '../Icon';
import { TripDates, datesLabel, type TripDatesValue } from './TripSettings';

/** True when cutting the trip to `n` days would take stops or wet-weather plans off the days cut. */
export const cutsPlans = (trip: Trip, n: number) => n < trip.days.length && trip.days.slice(n).some((d) => d.stops.length > 0 || d.wet.length > 0);

interface PanelProps {
  trip: Trip;
  /** Applies new dates to the trip (start date and number of days). */
  onApply: (next: TripDatesValue) => void;
}

/**
 * The trip's dates, edited in place: every change applies to the trip as it's made, so the day headers
 * follow. The one exception is fewer days that would take stops or wet-weather plans off the days
 * cut: that waits, with what it would do, until "Cut to N days" is pressed. Closing drops it.
 */
export function TripDatesPanel({ trip, onApply }: PanelProps) {
  const [pending, setPending] = useState<TripDatesValue | null>(null);
  const value: TripDatesValue = pending ?? { startDate: trip.startDate, endDate: endDate(trip), days: trip.days.length };
  const change = (next: TripDatesValue) => {
    if (cutsPlans(trip, next.days)) return setPending(next);
    setPending(null);
    onApply(next);
  };

  const n = pending?.days ?? trip.days.length;
  const dropped = pending ? trip.days.slice(n).reduce((c, d) => c + d.stops.length, 0) : 0;
  // Only the stops Saved doesn't already hold are news.
  const moved = pending ? movedToSaved(trip, n) : 0;
  const droppedWet = pending ? trip.days.slice(n).some((d) => d.wet.length > 0) : false;

  return (
    <div className="tdates-panel">
      <TripDates value={value} onChange={change} />
      {pending && (
        <div className="tdates-cut" role="status">
          <p className="plan-warn">
            <Icon name="alert" size={16} />
            {dropped > 0
              ? `${moved > 0 ? `${plural(moved, 'stop')} after Day ${n} will move to Saved` : `The stops after Day ${n} come off their days and stay in Saved`}${droppedWet ? ', and those days’ wet-weather plans will be removed' : ''}.`
              : `The wet-weather plans after Day ${n} will be removed.`}
          </p>
          <div className="tdates-actions">
            <button type="button" className="button is-compact is-quiet" onClick={() => setPending(null)}>
              Keep {plural(trip.days.length, 'day')}
            </button>
            <button
              type="button"
              className="button is-compact"
              onClick={() => {
                onApply(pending);
                setPending(null);
              }}
            >
              Cut to {plural(n, 'day')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ButtonProps extends PanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Phone: the button only opens; the planner shows the panel in a sheet. Laptop: a popover under the button. */
  popover: boolean;
}

/**
 * "10–12 Nov · 3 days" beside the trip's name. On laptop it opens a small popover anchored to it,
 * which Escape and a click outside close; on phone the planner opens a sheet instead.
 */
export function HeaderDates({ trip, onApply, open, onOpenChange, popover }: ButtonProps) {
  const popId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const showPop = popover && open;

  useEffect(() => {
    if (!showPop) return;
    // The first field takes focus, as a dialog's would.
    pop.current?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) onOpenChange(false);
    };
    // Capture, so the planner's own Escape (which closes the card) doesn't also run.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onOpenChange(false);
      btn.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [showPop, onOpenChange]);

  const label = datesLabel(trip);
  return (
    <div ref={wrap} className="tdates">
      <button
        ref={btn}
        type="button"
        className="tdates-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={showPop ? popId : undefined}
        aria-label={`Trip dates: ${label}. Change`}
        onClick={() => onOpenChange(!open)}
      >
        <Icon name="calendar" size={15} />
        <span className="num">{label}</span>
      </button>
      {showPop && (
        <div ref={pop} id={popId} className="tdates-pop" role="dialog" aria-label="Trip dates">
          <TripDatesPanel trip={trip} onApply={onApply} />
        </div>
      )}
    </div>
  );
}
