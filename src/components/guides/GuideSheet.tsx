import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

/** Height of the sticky bar that pins to the top once the guides are up. */
export const BAR_H = 56;

/** Quiet time before the cue's chevron nudges, once. */
const NUDGE_AFTER_MS = 3000;

type Props = {
  heading: string;
  cue: string;
  barLabel: string;
  atGuides: boolean;
  onBackToMap(): void;
  /** Sits in the visible strip of the peeking sheet (phone chips, Tokyo filters). */
  peek?: ReactNode;
  /** A small map thumbnail in the sticky bar. */
  miniMap?: ReactNode;
  children: ReactNode;
};

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}

/**
 * The sheet that peeks above the bottom of the map and slides over it as the page scrolls.
 * Its first child is the sticky bar: it rides just above the sheet and pins to the top
 * when the sheet is fully up, so it needs the page to scroll by (viewport − peek − bar).
 */
export function GuideSheet({ heading, cue, barLabel, atGuides, onBackToMap, peek, miniMap, children }: Props) {
  const [nudge, setNudge] = useState(false);
  const atGuidesRef = useRef(atGuides);
  atGuidesRef.current = atGuides;

  // The chevron nudges once after a quiet spell, so a still page shows it can move.
  useEffect(() => {
    setNudge(false);
    if (prefersReducedMotion()) return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        stop();
        if (!atGuidesRef.current) setNudge(true);
      }, NUDGE_AFTER_MS);
    };
    const events = ['pointerdown', 'wheel', 'keydown'] as const;
    const stop = () => events.forEach((e) => window.removeEventListener(e, arm));
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [heading]);

  return (
    <section className="guides" aria-labelledby="guides-heading" style={{ '--bar-h': `${BAR_H}px` } as CSSProperties}>
      <button
        type="button"
        className="gbar"
        data-on={atGuides ? '1' : ''}
        onClick={onBackToMap}
        tabIndex={atGuides ? 0 : -1}
        aria-hidden={!atGuides}
      >
        <span className="gbar-label">{barLabel}</span>
        <span className="gbar-end">
          {miniMap}
          <span className="gbar-back">
            Back to map
            <Chevron up />
          </span>
        </span>
      </button>
      <div className="gsheet">
        <header className="gsheet-head">
          <span className="gsheet-handle" aria-hidden="true" />
          <div className="gsheet-intro">
            <h2 id="guides-heading">{heading}</h2>
            <p className="gsheet-cue" data-nudge={nudge ? '1' : ''}>
              {cue}
              <Chevron />
            </p>
          </div>
          {peek && <div className="gsheet-peek">{peek}</div>}
        </header>
        <div className="gsheet-body">{children}</div>
      </div>
    </section>
  );
}
