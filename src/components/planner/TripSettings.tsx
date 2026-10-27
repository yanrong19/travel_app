import { useEffect, useId, useState } from 'react';
import { MONTHS } from '../../lib/format';
import { MAX_DAYS, dateOf, daysBetween, parseDate, type Trip } from '../../lib/trips';
import { Icon } from '../Icon';

export interface TripSettingsValue {
  name: string;
  startDate: string | null;
  endDate: string | null;
  days: number;
}

// ---------- dates (pure, so they can be tested) ----------

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 'YYYY-MM-DD' plus n calendar days, or null when it isn't a date. A year below 1000 isn't one: the
 * date input reports "0027-…" while a year is being typed, and Date would read 27 as 1927.
 */
export function shiftDate(date: string, n: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m || +m[1] < 1000) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3] + n);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1000) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const clampDays = (n: number) => Math.min(MAX_DAYS, Math.max(1, Math.round(n)));
/** A trip's dates as the fields show them: start, end and the number of days, kept in step. */
export type TripDatesValue = Pick<TripSettingsValue, 'startDate' | 'endDate' | 'days'>;
type Dates = TripDatesValue;

/** A new start keeps the number of days and moves the end with it. Clearing it clears both dates. */
export function withStart(v: Dates, start: string): Dates {
  const end = start ? shiftDate(start, v.days - 1) : null;
  if (!start || !end) return { ...v, startDate: null, endDate: null };
  return { ...v, startDate: start, endDate: end };
}

/**
 * A start as it's typed. Only a whole date that reads back as itself (see parseDate) moves the dates;
 * anything else (empty, a year still being typed, 30 Feb) is held as a draft in the field.
 */
export function typeStart(v: Dates, start: string): { dates: Dates; draft: string | null } {
  if (!parseDate(start)) return { dates: v, draft: start };
  return { dates: withStart(v, start), draft: null };
}

/** Leaving the start field with a draft: an empty field clears both dates; a partial one is dropped. */
export function leaveStart(v: Dates, draft: string): Dates {
  return draft === '' ? withStart(v, '') : v;
}

/** Why a typed end isn't used yet: not a whole date, before the start, past 60 days, or no start to count from. */
export type EndProblem = 'incomplete' | 'before' | 'tooLong' | 'noStart' | null;

/**
 * An end as it's typed. The browser reports every segment edit, so "20" typed over "18" passes
 * through "02", and a year being typed reads as no date at all. Only an end within the start's
 * 60 days changes anything (it sets the number of days); anything else leaves the dates alone
 * and is held as pending, with the reason. The start never moves because of the end.
 */
export function typeEnd(v: Dates, end: string): { dates: Dates; problem: EndProblem } {
  if (!end || !shiftDate(end, 0)) return { dates: v, problem: 'incomplete' };
  if (!v.startDate) return { dates: v, problem: 'noStart' };
  const n = daysBetween(v.startDate, end);
  if (n < 1) return { dates: v, problem: 'before' };
  if (n > MAX_DAYS) return { dates: v, problem: 'tooLong' };
  return { dates: { ...v, endDate: end, days: n }, problem: null };
}

/**
 * Leaving the end field with a pending end: an empty field clears both dates (keeping the days);
 * a whole date without a start counts the start back from it; anything else is dropped.
 */
export function leaveEnd(v: Dates, end: string): { dates: Dates; problem: EndProblem } {
  if (!end) return { dates: { ...v, startDate: null, endDate: null }, problem: null };
  if (shiftDate(end, 0) && !v.startDate) return { dates: { ...v, startDate: shiftDate(end, 1 - v.days), endDate: end }, problem: null };
  return typeEnd(v, end);
}

/** A new number of days moves the end, if there are dates. */
export function withDays(v: Dates, days: number): Dates {
  const n = clampDays(days);
  return { ...v, days: n, endDate: v.startDate ? shiftDate(v.startDate, n - 1) : null };
}

// ---------- the header's label ----------

/**
 * The trip's dates for the planner's header: "10–12 Nov · 3 days", "28 Nov – 2 Dec · 5 days",
 * "10 Nov · 1 day", or "3 days" when the trip has no dates.
 */
export function datesLabel(trip: Trip): string {
  const n = trip.days.length;
  const count = `${n} ${n === 1 ? 'day' : 'days'}`;
  const a = dateOf(trip, 0);
  const b = dateOf(trip, n - 1);
  if (!a || !b) return count;
  const dm = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const range =
    n === 1 ? dm(a) : a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? `${a.getDate()}–${dm(b)}` : `${dm(a)} – ${dm(b)}`;
  return `${range} · ${count}`;
}

// ---------- the fields ----------

interface DatesProps {
  value: Dates;
  onChange: (next: Dates) => void;
}

/**
 * Start date, end date and number of days, kept in step: a start keeps the days and moves the end, an
 * end sets the days, the days move the end. Typing is safe: a date that isn't whole yet, or an end that
 * isn't usable, waits in its field (see typeStart and typeEnd) instead of moving the others.
 */
export function TripDates({ value, onChange }: DatesProps) {
  const id = useId();
  const set = (patch: Partial<Dates>) => onChange({ ...value, ...patch });
  // The days field keeps what's typed until it's a number in range, so "12" can be typed over "1".
  const [daysText, setDaysText] = useState(String(value.days));
  useEffect(() => setDaysText(String(value.days)), [value.days]);
  const hasDates = !!value.startDate;
  // A date being typed that isn't usable yet (see typeEnd), shown in its field but not saved.
  const [startDraft, setStartDraft] = useState<string | null>(null);
  const [endDraft, setEndDraft] = useState<string | null>(null);
  const [endNote, setEndNote] = useState<string | null>(null);

  /** Dates changed from anywhere but the end field: whatever was pending there is gone. */
  const setDates = (d: Partial<Dates>) => {
    setEndDraft(null);
    setEndNote(null);
    set(d);
  };

  const typeDays = (text: string) => {
    setDaysText(text);
    const n = Number(text);
    if (text.trim() && Number.isInteger(n) && n >= 1 && n <= MAX_DAYS) setDates(withDays(value, n));
  };

  // A start that isn't a whole date yet stays in its field as a draft (see typeStart). An empty one is
  // only taken as clearing once the field is left: a year being typed can read as empty too.
  const onStart = (text: string) => {
    const r = typeStart(value, text);
    setStartDraft(r.draft);
    if (r.dates !== value) setDates(r.dates);
  };
  const leaveStartField = () => {
    if (startDraft === null) return;
    const next = leaveStart(value, startDraft);
    setStartDraft(null);
    if (next !== value) setDates(next);
  };

  const onEnd = (text: string) => {
    const r = typeEnd(value, text);
    if (r.dates !== value) {
      setEndDraft(null);
      set(r.dates);
    } else setEndDraft(text);
    setEndNote(r.problem === 'before' ? 'End is before start.' : r.problem === 'tooLong' ? `Up to ${MAX_DAYS} days.` : null);
  };
  const leaveEndField = () => {
    if (endDraft === null) return;
    const r = leaveEnd(value, endDraft);
    setEndDraft(null);
    if (r.dates !== value) set(r.dates);
    setEndNote(
      r.problem === 'before'
        ? 'End is before start, so the end date wasn’t changed.'
        : r.problem === 'tooLong'
          ? `Up to ${MAX_DAYS} days, so the end date wasn’t changed.`
          : null,
    );
  };

  return (
    <div className="tset-when">
      <div className="tset-dates">
        <div className="tset-field">
          <label htmlFor={`${id}-start`}>Start date</label>
          <input
            id={`${id}-start`}
            className="tset-input num"
            type="date"
            value={startDraft ?? value.startDate ?? ''}
            onChange={(e) => onStart(e.target.value)}
            onBlur={leaveStartField}
          />
        </div>
        <div className="tset-field">
          <label htmlFor={`${id}-end`}>End date</label>
          <input
            id={`${id}-end`}
            className="tset-input num"
            type="date"
            value={endDraft ?? value.endDate ?? ''}
            min={value.startDate ?? undefined}
            max={value.startDate ? (shiftDate(value.startDate, MAX_DAYS - 1) ?? undefined) : undefined}
            aria-describedby={`${id}-end-note`}
            onChange={(e) => onEnd(e.target.value)}
            onBlur={leaveEndField}
          />
        </div>
        <div className="tset-field">
          <label htmlFor={`${id}-days`}>Number of days</label>
          <div className="tset-stepper">
            <button
              type="button"
              className="tset-step"
              onClick={() => setDates(withDays(value, value.days - 1))}
              disabled={value.days <= 1}
              aria-label="One day fewer"
            >
              <Icon name="minus" size={16} />
            </button>
            <input
              id={`${id}-days`}
              className="tset-input num"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DAYS}
              value={daysText}
              onChange={(e) => typeDays(e.target.value)}
              onBlur={() => setDaysText(String(value.days))}
            />
            <button
              type="button"
              className="tset-step"
              onClick={() => setDates(withDays(value, value.days + 1))}
              disabled={value.days >= MAX_DAYS}
              aria-label="One day more"
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>
      </div>
      <p id={`${id}-end-note`} className="tset-warn" role="status">
        {endNote}
      </p>
      <p className="tset-hint">
        {hasDates ? (
          <>
            The days follow the dates.{' '}
            <button type="button" className="text-button" onClick={() => setDates({ startDate: null, endDate: null })}>
              Clear dates
            </button>
          </>
        ) : (
          'No dates yet? Set the number of days and add dates later.'
        )}
      </p>
    </div>
  );
}

interface Props {
  value: TripSettingsValue;
  onChange: (next: TripSettingsValue) => void;
  /** Shown in the empty name field, and used when it's left empty. */
  namePlaceholder?: string;
}

/** The new trip's name and dates. In the planner, the dates alone (TripDates) sit in the header. */
export function TripSettings({ value, onChange, namePlaceholder }: Props) {
  const id = useId();
  return (
    <div className="tset">
      <div className="tset-field">
        <label htmlFor={`${id}-name`}>Trip name</label>
        <input
          id={`${id}-name`}
          className="tset-input"
          type="text"
          value={value.name}
          placeholder={namePlaceholder}
          maxLength={80}
          autoComplete="off"
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
      </div>

      <fieldset className="tset-group">
        <legend>When</legend>
        <TripDates value={value} onChange={(d) => onChange({ ...value, ...d })} />
      </fieldset>
    </div>
  );
}
