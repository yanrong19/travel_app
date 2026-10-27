import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import type { Rating } from '../../data/types';
import { lineById, type LineId } from '../../data/lines';
import type { Flag } from '../../lib/factors';
import { Station } from '../../components/Station';
import { Icon } from '../../components/Icon';

export const RATING_WORD: Record<Rating, string> = { good: 'Good', ok: 'Fine', poor: 'Poor' };
const RATING_STEPS: Record<Rating, number> = { good: 3, ok: 2, poor: 1 };

/** The factor's line colours as CSS variables, for everything inside a row. */
export const lineVars = (line: LineId) =>
  ({
    '--hue': `var(--c-${line})`,
    '--soft': `var(--c-${line}-soft)`,
    '--track': `var(--c-${line}-track)`,
    '--line-ink': `var(--c-${line}-ink)`,
  }) as CSSProperties;

/** "2 h", "45 min", "5 h 30": short enough for a headline. */
export function hm(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

interface RowProps {
  line: LineId;
  headline: string;
  /** A small pill beside the headline. */
  extra?: ReactNode;
  /** The headline visual: a track with a marker or band in the line colour. */
  visual: ReactNode;
  /** This factor's "to check" items. */
  flags: Flag[];
  children: ReactNode;
}

/**
 * One factor as a full-width row: the line's station on its rail, the label, a large headline and
 * its visual. Clicking the row opens the factor's details in place; several rows can be open.
 */
export function FactorRow({ line, headline, extra, visual, flags, children }: RowProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const l = lineById(line);
  return (
    <div className={`frow ${open ? 'is-open' : ''}`} style={lineVars(line)} data-line={line}>
      <h3 className="frow-h">
        <button type="button" id={`${id}-b`} className="frow-btn" aria-expanded={open} aria-controls={`${id}-p`} onClick={() => setOpen((o) => !o)}>
          <span className="frow-station">
            <Station line={line} size={30} filled />
          </span>
          <span className="frow-label">{l.name}</span>
          {flags.length > 0 && <span className="frow-flag">{flags.length} to check</span>}
          <span className="frow-chev" aria-hidden="true">
            <Icon name="chevronDown" size={18} />
          </span>
          <span className="frow-head">
            <span className="frow-headline num">{headline}</span>
            {extra}
          </span>
          <span className="frow-visual" aria-hidden="true">
            {visual}
          </span>
        </button>
      </h3>
      <div id={`${id}-p`} className="frow-panel" role="region" aria-labelledby={`${id}-b`}>
        <div className="frow-clip">
          <div className="frow-body">
            {flags.length > 0 && (
              <div className="frow-check">
                <p className="frow-check-title">
                  <Icon name="alert" size={16} />
                  To check
                </p>
                <ul>
                  {flags.map((f) => (
                    <li key={f.text}>{f.text}</li>
                  ))}
                </ul>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The expanded area's two-column grid. */
export const Tiles = ({ children }: { children: ReactNode }) => <div className="ftiles">{children}</div>;

/** A secondary metric: its label, a value and anything below it. `wide` takes both columns. */
export function Tile({ label, value, unit, wide, aside, rows, children }: { label: string; value?: ReactNode; unit?: string; wide?: boolean; aside?: ReactNode; rows?: number; children?: ReactNode }) {
  return (
    <div className={`ftile ${wide ? 'is-wide' : ''}`} style={rows ? { gridRow: `span ${rows}` } : undefined}>
      <div className="ftile-head">
        <span className="ftile-label">{label}</span>
        {aside}
      </div>
      {value != null && (
        <p className="ftile-value">
          {value}
          {unit && <span className="ftile-unit">{unit}</span>}
        </p>
      )}
      {children}
    </div>
  );
}

/** The factor's notes, one short paragraph each. */
export function Notes({ items }: { items: (string | undefined | false)[] }) {
  const list = items.filter((s): s is string => !!s);
  if (!list.length) return null;
  return (
    <ul className="fnotes">
      {list.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ul>
  );
}

/** Three short bars: three filled is good, one is poor. */
export function RatingMark({ r }: { r: Rating }) {
  const n = RATING_STEPS[r];
  return (
    <span className={`rmark is-${r}`} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'on' : ''} />
      ))}
    </span>
  );
}

/** A filled track at the true ratio, 0–100. */
export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** A two-ended scale with a marker, e.g. calm ↔ lively. */
export function Scale({ value, left, right, label }: { value: number; left: string; right: string; label: string }) {
  return (
    <div className="scale">
      <div className="ftrack" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
        <span className="ftrack-mark" style={{ left: `${value}%` }} />
      </div>
      <div className="scale-ends">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}
