import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { TOKYO_PREF_ID } from '../../data/places';
import { DAYS, MONTHS, plural } from '../../lib/format';
import { EASE_OUT, useReducedMotion } from '../../lib/motion';
import { addPlace, addStop, dateOf, dayOf, saveToTrip, type PlaceRef, type Trip } from '../../lib/trips';
import { coveringPlace, placeLabel } from '../../lib/tripPlaces';
import { useTrips } from '../../lib/tripsStore';
import { Icon } from '../Icon';

// The trip and day last added to, for this visit. Day -1 is "Save to trip" (no day).
const LAST_KEY = 'fitline.lastTripDay';
type Last = { tripId: string; day: number };

function readLast(): Last | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(LAST_KEY) ?? 'null') as Last | null;
    return v && typeof v.tripId === 'string' && Number.isInteger(v.day) ? v : null;
  } catch {
    return null;
  }
}

function writeLast(v: Last) {
  try {
    sessionStorage.setItem(LAST_KEY, JSON.stringify(v));
  } catch {
    /* no storage: the picker just won't remember */
  }
}

const SAVE = -1;
const DONE_MS = 2600;
const POP_WIDTH = 320;
const GAP = 8;
const EDGE = 12;

/** "Day 3 · Tue 14 Apr", or "Day 3" when the trip has no dates. */
function dayLabel(trip: Trip, day: number) {
  const d = dateOf(trip, day);
  return d ? `Day ${day + 1} · ${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}` : `Day ${day + 1}`;
}

/** Where the attraction already sits in a trip, in words, or null. */
function whereIn(trip: Trip, id: string) {
  const at = dayOf(trip, id);
  if (at !== null) return `On Day ${at + 1}`;
  return trip.saved.includes(id) ? 'Saved' : null;
}

/**
 * "Add to trip": with no trips it starts a new one seeded with this attraction; otherwise a small
 * popover picks a trip, then a day (or just saves it to the trip). The last-used trip and day come first.
 */
export function AddToTrip({ attractionId, place }: { attractionId: string; place: PlaceRef | null }) {
  const { trips, update } = useTrips();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pos, setPos] = useState<{ style: CSSProperties; side: 'up' | 'down' } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const doneTimer = useRef<number | undefined>(undefined);

  const last = open ? readLast() : null;
  const ordered = [...trips].sort((a, b) => {
    if (last && a.id === last.tripId) return -1;
    if (last && b.id === last.tripId) return 1;
    return b.updatedAt - a.updatedAt;
  });
  const chosen = tripId ? trips.find((t) => t.id === tripId) ?? null : null;

  const startNew = () => navigate('/trips/new', { state: { seed: { place, attractionId } } });

  const close = (refocus: boolean) => {
    setOpen(false);
    setTripId(null);
    if (refocus) button.current?.focus();
  };

  const onButton = () => {
    if (trips.length === 0) {
      startNew();
      return;
    }
    if (open) close(false);
    else setOpen(true);
  };

  const pick = (trip: Trip, day: number) => {
    update(trip.id, (t, now) => {
      // A trip whose places don't cover this attraction gains Tokyo, so the stop has a place.
      const next = coveringPlace(t.places, attractionId) ? t : addPlace(t, { level: 'prefecture', id: TOKYO_PREF_ID }, now);
      return day === SAVE ? saveToTrip(next, attractionId, now) : addStop(next, day, attractionId, now);
    });
    writeLast({ tripId: trip.id, day });
    close(true);
    setDone(day === SAVE ? 'Saved to trip' : `Added to Day ${day + 1}`);
    window.clearTimeout(doneTimer.current);
    doneTimer.current = window.setTimeout(() => setDone(null), DONE_MS);
  };

  useEffect(() => () => window.clearTimeout(doneTimer.current), []);

  // Place the popover next to the button, inside the viewport, on the side with more room.
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(POP_WIDTH, vw - EDGE * 2);
      const left = Math.min(Math.max(EDGE, r.left), vw - width - EDGE);
      const below = vh - r.bottom - GAP - EDGE;
      const above = r.top - GAP - EDGE;
      const down = below >= 340 || below >= above;
      setPos({
        side: down ? 'down' : 'up',
        style: down
          ? { left, width, top: r.bottom + GAP, maxHeight: below }
          : { left, width, bottom: vh - r.top + GAP, maxHeight: above },
      });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);

  // Outside clicks close it; focus moves into each step as it opens.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open && pos) pop.current?.querySelector<HTMLButtonElement>('.att-item:not(:disabled), .att-new')?.focus();
  }, [open, tripId, pos !== null]);

  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);

  return (
    <div className="att">
      <button
        ref={button}
        type="button"
        className={`button att-button ${done ? 'is-done' : 'is-quiet'}`}
        aria-haspopup={trips.length ? 'dialog' : undefined}
        aria-expanded={trips.length ? open : undefined}
        onClick={onButton}
        title="Add to trip"
      >
        <Icon name={done ? 'check' : 'trip'} size={18} />
        <span className="att-label">{done ?? 'Add to trip'}</span>
      </button>
      <span className="sr-only" role="status">
        {done}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={pop}
              className="att-pop"
              data-side={pos.side}
              data-lenis-prevent
              role="dialog"
              aria-label="Add to trip"
              style={pos.style}
              initial={{ opacity: 0, y: pos.side === 'down' ? -6 : 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: pos.side === 'down' ? -6 : 6, scale: 0.98 }}
              transition={{ duration: reduced ? 0 : 0.18, ease: EASE_OUT }}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return;
                e.preventDefault();
                e.stopPropagation();
                close(true);
              }}
            >
              {chosen ? (
                <DayStep
                  trip={chosen}
                  attractionId={attractionId}
                  lastDay={last && last.tripId === chosen.id ? last.day : null}
                  onBack={() => setTripId(null)}
                  onPick={(day) => pick(chosen, day)}
                />
              ) : (
                <>
                  <p className="att-title">Add to which trip?</p>
                  <ul className="att-list">
                    {ordered.map((t) => {
                      const where = whereIn(t, attractionId);
                      return (
                        <li key={t.id}>
                          <button type="button" className="att-item" onClick={() => setTripId(t.id)}>
                            <span className="att-item-text">
                              <strong>{t.name}</strong>
                              <span>
                                {[t.places.map((p) => placeLabel(p).name).join(', '), plural(t.days.length, 'day')]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </span>
                            {where ? <span className="att-tag">{where}</span> : <Icon name="arrowRight" size={16} />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button type="button" className="att-new" onClick={startNew}>
                    <Icon name="plus" />
                    New trip
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function DayStep({
  trip,
  attractionId,
  lastDay,
  onBack,
  onPick,
}: {
  trip: Trip;
  attractionId: string;
  lastDay: number | null;
  onBack: () => void;
  onPick: (day: number) => void;
}) {
  const at = dayOf(trip, attractionId);
  const options = [...trip.days.map((_, i) => i), SAVE];
  if (lastDay !== null && options.includes(lastDay)) options.splice(0, 0, ...options.splice(options.indexOf(lastDay), 1));

  return (
    <>
      <div className="att-step-head">
        <button type="button" className="icon-button" onClick={onBack} aria-label="Back to trips">
          <Icon name="arrowLeft" size={18} />
        </button>
        <p className="att-title">{trip.name}</p>
      </div>
      <ul className="att-list">
        {options.map((day) => {
          // Saving works whether or not it is on a day: the trip's Saved list is a shortlist.
          const here = day === SAVE ? trip.saved.includes(attractionId) : at === day;
          const n = day === SAVE ? 0 : trip.days[day].stops.length;
          const count = n ? plural(n, 'stop') : 'Nothing planned yet';
          const note = here
            ? day === SAVE
              ? 'Already saved'
              : 'Already here'
            : day === SAVE
              ? 'Decide the day later'
              : at !== null
                ? `${count} · moves from Day ${at + 1}`
                : count;
          return (
            <li key={day}>
              <button type="button" className="att-item" disabled={here} onClick={() => onPick(day)}>
                <span className="att-item-text">
                  <strong>{day === SAVE ? 'Save to trip' : dayLabel(trip, day)}</strong>
                  <span>{note}</span>
                </span>
                {here ? (
                  <Icon name="check" size={16} />
                ) : day === lastDay ? (
                  <span className="att-tag">Last used</span>
                ) : (
                  <Icon name="plus" size={16} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
