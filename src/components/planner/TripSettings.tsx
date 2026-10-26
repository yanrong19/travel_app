import { useEffect, useId, useState } from 'react';
import { MAX_DAYS, PACE_HOURS, daysBetween, type Pace, type Who } from '../../lib/trips';
import { Icon } from '../Icon';

export interface TripSettingsValue {
  name: string;
  startDate: string | null;
  endDate: string | null;
  days: number;
  who: Who;
  pace: Pace;
  dayStart: string;
}

// ---------- dates (pure, so they can be tested) ----------

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' plus n calendar days, or null when it isn't a date. */
export function shiftDate(date: string, n: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3] + n);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const clampDays = (n: number) => Math.min(MAX_DAYS, Math.max(1, Math.round(n)));
type Dates = Pick<TripSettingsValue, 'startDate' | 'endDate' | 'days'>;

/** A new start keeps the number of days and moves the end with it. Clearing it clears both dates. */
export function withStart(v: Dates, start: string): Dates {
  const end = start ? shiftDate(start, v.days - 1) : null;
  if (!start || !end) return { ...v, startDate: null, endDate: null };
  return { ...v, startDate: start, endDate: end };
}

/** A new end sets the number of days. Without a start, the start is counted back from it. */
export function withEnd(v: Dates, end: string): Dates {
  if (!end || !shiftDate(end, 0)) return { ...v, startDate: null, endDate: null };
  if (!v.startDate) return { ...v, startDate: shiftDate(end, 1 - v.days), endDate: end };
  const n = daysBetween(v.startDate, end);
  // An end before the start, or too far after it: the start follows instead.
  if (n < 1 || n > MAX_DAYS) return { ...v, startDate: shiftDate(end, 1 - v.days), endDate: end };
  return { ...v, endDate: end, days: n };
}

/** A new number of days moves the end, if there are dates. */
export function withDays(v: Dates, days: number): Dates {
  const n = clampDays(days);
  return { ...v, days: n, endDate: v.startDate ? shiftDate(v.startDate, n - 1) : null };
}

// ---------- the form ----------

const WHO: { id: Who; label: string }[] = [
  { id: 'solo', label: 'Solo' },
  { id: 'couple', label: 'Couple' },
  { id: 'family', label: 'Family' },
  { id: 'friends', label: 'Friends' },
];
const PACE: { id: Pace; label: string }[] = [
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'normal', label: 'Normal' },
  { id: 'packed', label: 'Packed' },
];

interface Props {
  value: TripSettingsValue;
  onChange: (next: TripSettingsValue) => void;
  /** Shown in the empty name field, and used when it's left empty. */
  namePlaceholder?: string;
}

export function TripSettings({ value, onChange, namePlaceholder }: Props) {
  const id = useId();
  const set = (patch: Partial<TripSettingsValue>) => onChange({ ...value, ...patch });
  // The days field keeps what's typed until it's a number in range, so "12" can be typed over "1".
  const [daysText, setDaysText] = useState(String(value.days));
  useEffect(() => setDaysText(String(value.days)), [value.days]);
  const hasDates = !!value.startDate;

  const typeDays = (text: string) => {
    setDaysText(text);
    const n = Number(text);
    if (text.trim() && Number.isInteger(n) && n >= 1 && n <= MAX_DAYS) set(withDays(value, n));
  };

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
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>

      <fieldset className="tset-group">
        <legend>When</legend>
        <div className="tset-dates">
          <div className="tset-field">
            <label htmlFor={`${id}-start`}>Start date</label>
            <input
              id={`${id}-start`}
              className="tset-input num"
              type="date"
              value={value.startDate ?? ''}
              onChange={(e) => set(withStart(value, e.target.value))}
            />
          </div>
          <div className="tset-field">
            <label htmlFor={`${id}-end`}>End date</label>
            <input
              id={`${id}-end`}
              className="tset-input num"
              type="date"
              value={value.endDate ?? ''}
              min={value.startDate ?? undefined}
              onChange={(e) => set(withEnd(value, e.target.value))}
            />
          </div>
          <div className="tset-field">
            <label htmlFor={`${id}-days`}>Number of days</label>
            <div className="tset-stepper">
              <button
                type="button"
                className="tset-step"
                onClick={() => set(withDays(value, value.days - 1))}
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
                onClick={() => set(withDays(value, value.days + 1))}
                disabled={value.days >= MAX_DAYS}
                aria-label="One day more"
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>
        </div>
        <p className="tset-hint">
          {hasDates ? (
            <>
              The days follow the dates.{' '}
              <button type="button" className="text-button" onClick={() => set({ startDate: null, endDate: null })}>
                Clear dates
              </button>
            </>
          ) : (
            'No dates yet? Set the number of days and add dates later.'
          )}
        </p>
      </fieldset>

      <PillRadios legend="Who’s going" name={`${id}-who`} options={WHO} value={value.who} onChange={(who) => set({ who })} />

      <PillRadios
        legend="Pace"
        name={`${id}-pace`}
        options={PACE.map((p) => ({ ...p, sub: `${PACE_HOURS[p.id]} h days` }))}
        value={value.pace}
        onChange={(pace) => set({ pace })}
      />

      <div className="tset-field tset-time">
        <label htmlFor={`${id}-start-time`}>Day starts at</label>
        <input
          id={`${id}-start-time`}
          className="tset-input num"
          type="time"
          value={value.dayStart}
          onChange={(e) => e.target.value && set({ dayStart: e.target.value })}
        />
      </div>
    </div>
  );
}

function PillRadios<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { id: T; label: string; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="tset-group">
      <legend>{legend}</legend>
      <div className="tset-pills">
        {options.map((o) => (
          <label key={o.id} className="tset-pill">
            <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            <span>
              {o.label}
              {o.sub && <small className="num">{o.sub}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
