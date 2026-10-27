import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { plural } from '../../lib/format';
import { EASE_OUT, useReducedMotion } from '../../lib/motion';
import { Icon } from '../Icon';

export interface DayOption {
  /** "Day 3" */
  label: string;
  /** "Tue 14 Apr", or null when the trip has no dates. */
  date: string | null;
  /** The rain chance when the day is likely wet, else null. */
  rain: number | null;
  stops: number;
}

/** The space a list needs below its button before it opens upward instead (the phone peek sits low). */
const ROOM_BELOW = 280;
/** The phone tab bar under the sheet: the list stays clear of it. */
const BOTTOM_CLEAR = 100;

function Parts({ o }: { o: DayOption }) {
  return (
    <>
      <span className="dp-day">{o.label}</span>
      {o.date && <span className="dp-date"> · {o.date}</span>}
      {o.rain !== null && (
        <span className="dp-rain num">
          <Icon name="rain" size={15} />
          <span>
            <span className="sr-only">, </span>
            {o.rain}% rain
          </span>
        </span>
      )}
      {o.stops > 0 && (
        <span className="dp-count num">
          <span className="sr-only">, </span>
          <span aria-hidden="true">{o.stops}</span>
          <span className="sr-only">{plural(o.stops, 'stop')}</span>
        </span>
      )}
    </>
  );
}

/**
 * The day dropdown: a select-only combobox (button + listbox popover), as the map search's list
 * works. Arrows, Home and End move; Enter or Space picks; Escape or Tab closes.
 */
export function DayPicker({ options, value, onPick }: { options: DayOption[]; value: number; onPick: (day: number) => void }) {
  const id = useId();
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const [place, setPlace] = useState<{ up: boolean; max: number }>({ up: false, max: 360 });
  const last = options.length - 1;

  const show = (at = value) => {
    setActive(Math.max(0, Math.min(last, at)));
    setOpen(true);
  };
  const pick = (i: number) => {
    setOpen(false);
    if (i !== value) onPick(i);
  };

  // Opens downward, unless the button sits low (the phone peek) with more room above.
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - BOTTOM_CLEAR;
    const above = r.top - 16;
    const up = below < ROOM_BELOW && above > below;
    setPlace({ up, max: Math.max(160, Math.min(360, (up ? above : below) - 8)) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Keeps the highlighted day in view in a long trip.
  useEffect(() => {
    if (open) box.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (!open) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
        e.preventDefault();
        show();
      } else if (k === 'Home' || k === 'End') {
        e.preventDefault();
        show(k === 'Home' ? 0 : last);
      }
      return;
    }
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End' || k === 'PageDown' || k === 'PageUp') {
      e.preventDefault();
      setActive((a) =>
        k === 'Home' ? 0 : k === 'End' ? last : Math.max(0, Math.min(last, a + (k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : k === 'PageDown' ? 10 : -10))),
      );
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      pick(active);
    } else if (k === 'Escape') {
      // Handled here: the planner's own Escape (close the card, leave replace mode) skips it.
      e.preventDefault();
      setOpen(false);
    } else if (k === 'Tab') setOpen(false);
  };

  const current = options[value];
  return (
    <div ref={box} className={`dp ${open ? 'is-open' : ''}`}>
      <span id={`${id}-label`} className="sr-only">
        Day
      </span>
      <button
        ref={button}
        type="button"
        role="combobox"
        className="dp-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        <span id={`${id}-value`} className="dp-value">
          {current && <Parts o={current} />}
        </span>
        <Icon name="chevronDown" size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`dp-panel ${place.up ? 'is-up' : ''}`}
            initial={{ opacity: 0, y: place.up ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: place.up ? 6 : -6, scale: 0.98 }}
            transition={{ duration: reduced ? 0 : 0.18, ease: EASE_OUT }}
          >
            <ul id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="dp-list" style={{ maxHeight: place.max }} data-lenis-prevent>
              {options.map((o, i) => (
                <li
                  key={i}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === value}
                  data-index={i}
                  className={`dp-option ${i === active ? 'is-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(i)}
                >
                  <span className="dp-option-text">
                    <Parts o={o} />
                  </span>
                  {i === value && <Icon name="check" size={16} />}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
