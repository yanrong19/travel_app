import { useState, type KeyboardEvent } from 'react';
import { parseClock, stepClock } from '../../lib/trips';
import { Icon } from '../Icon';

interface Props {
  /** The day, 0-based, for the fields' names. */
  day: number;
  start: string;
  end: string;
  /** Sets the day's start or end; false when the day wouldn't make sense (an end not after the start). */
  onChange: (times: { start?: string; end?: string }) => boolean;
}

/** Arrow keys move a time by a quarter of an hour. */
const STEP_MIN = 15;

function TimeField({ label, value, onCommit }: { label: string; value: string; onCommit: (t: string) => boolean }) {
  // What's typed, until it's applied or dropped.
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const t = parseClock(draft);
    setDraft(null);
    if (t && t !== value) onCommit(t);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      e.currentTarget.select();
    } else if (e.key === 'Escape' && draft !== null) {
      // Escape puts the time back; a second one is the page's.
      e.preventDefault();
      e.stopPropagation();
      setDraft(null);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const from = (draft !== null && parseClock(draft)) || value;
      const next = stepClock(from, e.key === 'ArrowUp' ? STEP_MIN : -STEP_MIN);
      setDraft(null);
      if (next !== value) onCommit(next);
    }
  };
  return (
    <input
      className="dl-time num"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      maxLength={8}
      aria-label={label}
      value={draft ?? value}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
    />
  );
}

/**
 * The day's start and end, "09:00–19:00", each a small field: click or tap to type a new time (9, 930,
 * 9:30, 7pm), Enter or leaving the field applies it, Escape puts it back, the arrow keys step it by
 * 15 minutes. The gap between them is the day's time budget.
 */
export function DayTimes({ day, start, end, onChange }: Props) {
  return (
    <span className="dl-times" role="group" aria-label={`Day ${day + 1} times`}>
      <Icon name="clock" size={14} />
      <TimeField label={`Day ${day + 1} starts at`} value={start} onCommit={(t) => onChange({ start: t })} />
      <span className="dl-times-dash" aria-hidden="true">
        –
      </span>
      <TimeField label={`Day ${day + 1} ends at`} value={end} onCommit={(t) => onChange({ end: t })} />
    </span>
  );
}
