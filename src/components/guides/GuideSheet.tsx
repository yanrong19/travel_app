import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

/** Height of the sticky bar's row, which pins below the nav and search once the guides are up. */
export const BAR_H = 56;
/** Where the bar's row pins: laptop, level with the search (96–148px, centred in the row); phone, under the full-width search (72–120px). */
export const BAR_TOP = 94;
export const BAR_TOP_PHONE = 128;

/** Quiet time before the cue's chevron nudges, once. */
const NUDGE_AFTER_MS = 3000;

type Props = {
  heading: string;
  cue: string;
  barLabel: string;
  atGuides: boolean;
  onBackToMap(): void;
  /** Keyboard focus came into the guides while the sheet is not fully up: bring it up. */
  onBodyFocus?(): void;
  /** Sits in the visible strip of the peeking sheet (phone chips, Tokyo filters). */
  peek?: ReactNode;
  /** A small map thumbnail in the sticky bar. */
  miniMap?: ReactNode;
  children: ReactNode;
};

/** Focus the browser would ring: from the keyboard, or into a text field. */
function isKeyboardFocus(el: Element) {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  );
}

/**
 * The sheet that peeks above the bottom of the map and slides over it as the page scrolls.
 * Its first child is the sticky bar: it rides just above the sheet and pins when the sheet is
 * fully up. Its frosted backing reaches the top of the window, behind the nav and search (which
 * stay above the sheet), and its row sits at `--bar-top`. So the page must scroll by
 * (viewport − peek − bar top − BAR_H) for the sheet to come fully up.
 */
export function GuideSheet({ heading, cue, barLabel, atGuides, onBackToMap, onBodyFocus, peek, miniMap, children }: Props) {
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
      <div className="gbar" data-on={atGuides ? '1' : ''}>
        <button type="button" className="gbar-row" onClick={onBackToMap} tabIndex={atGuides ? 0 : -1} aria-hidden={!atGuides}>
          <span className="gbar-label">{barLabel}</span>
          <span className="gbar-end">
            {miniMap}
            <span className="gbar-back">
              Back to map
              <Chevron up />
            </span>
          </span>
        </button>
      </div>
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
        {/* Tabbing in from the map can leave the page part-way, where the settle would drop the
            focused card off screen; so keyboard focus brings the sheet fully up. A mouse click
            doesn't, as the page moving under the pointer could lose the click. */}
        <div
          className="gsheet-body"
          onFocus={(e) => {
            if (!atGuides && isKeyboardFocus(e.target)) onBodyFocus?.();
          }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
