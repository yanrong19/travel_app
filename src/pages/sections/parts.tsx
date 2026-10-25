import type { CSSProperties, ReactNode } from 'react';
import type { Rating } from '../../data/types';
import { lineById, type LineId } from '../../data/lines';
import { Station } from '../../components/Station';

export const RATING_WORD: Record<Rating, string> = { good: 'Good', ok: 'Fine', poor: 'Poor' };
const RATING_STEPS: Record<Rating, number> = { good: 3, ok: 2, poor: 1 };

/** A factor section: the line's station, its name and a one-sentence summary. */
export function FactorSection({ line, summary, children }: { line: LineId; summary: string; children: ReactNode }) {
  const l = lineById(line);
  const style = {
    '--hue': `var(--c-${line})`,
    '--soft': `var(--c-${line}-soft)`,
    '--track': `var(--c-${line}-track)`,
    '--ink': `var(--c-${line}-ink)`,
  } as CSSProperties;
  return (
    <section id={line} className="fsec" style={style} aria-labelledby={`${line}-title`} data-line={line}>
      <header className="fsec-head">
        <Station line={line} size={44} filled />
        <div>
          <h2 id={`${line}-title`} tabIndex={-1}>{l.name}</h2>
          <p>{summary}</p>
        </div>
      </header>
      <div className="fgrid">{children}</div>
    </section>
  );
}

export function Card({ title, span = 2, children, aside }: { title: string; span?: 2 | 3 | 4 | 6; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className={`card span-${span}`}>
      <div className="card-head">
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </div>
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

/** A two-ended scale with a marker, e.g. touristy ↔ local. */
export function Scale({ value, left, right, label }: { value: number; left: string; right: string; label: string }) {
  return (
    <div className="scale">
      <div className="scale-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
        <span className="scale-fill" style={{ width: `${value}%` }} />
        <span className="scale-mark" style={{ left: `${value}%` }} />
      </div>
      <div className="scale-ends">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

export function Figure({ value, unit, note }: { value: ReactNode; unit?: string; note?: string }) {
  return (
    <div className="figure">
      <span className="figure-value num">
        {value}
        {unit && <span className="figure-unit">{unit}</span>}
      </span>
      {note && <span className="figure-note">{note}</span>}
    </div>
  );
}

export const Note = ({ children }: { children: ReactNode }) => <p className="card-note">{children}</p>;
