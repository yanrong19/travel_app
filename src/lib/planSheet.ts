// The phone trip planner's layout numbers: the header over the map and the day sheet under it. The
// page scrolls and the sheet slides up over the fixed map (useGuideScroll); these say where things
// sit so the progress, the settle, the CSS and the map's insets agree. Pure: no React, no DOM.

import type { Insets } from '../map/camera';

/**
 * How tall the sheet peeks above the tab bar: the day dropdown, the day's date and times, the
 * wet-weather toggle and the Analysis button, and the one-line summary. The sub-tabs sit just under it.
 */
export const PEEK_PHONE = 196;
/** The room the peek leaves under it for the tab bar. */
export const SHEET_CLEAR = 92;
/**
 * The header's height under the safe area: the trip bar (10 + 52), the place pills (8 + 36) and the
 * breadcrumb (6 + 28), plus a little air. The planner hands it to the CSS, with the safe area, as
 * `--plan-head` (headBottom).
 */
export const HEAD_PHONE = 148;
/** Air between the header and what the map frames under it. */
const HEAD_GAP = 12;

/**
 * useGuideScroll's `barH` for a sheet whose top lands at `top` once it is fully up (progress 1).
 * The sheet starts `vh - peek - clear` down the page; progress 1 is a scroll of `vh - peek - barH`,
 * which leaves its top at `barH - clear` on screen.
 */
export const sheetBarH = (top: number, clear = SHEET_CLEAR) => top + clear;

/** Where the sheet's top edge is on screen at progress `p` (0 resting at the peek, 1 fully up at `top`). */
export function sheetTopAt(p: number, { vh, peek = PEEK_PHONE, clear = SHEET_CLEAR, top }: { vh: number; peek?: number; clear?: number; top: number }) {
  const rest = vh - peek - clear;
  const t = Math.min(1, Math.max(0, p));
  return rest - t * (rest - top);
}

/** The header's bottom edge on screen, under a safe area of `safeTop` (the notch). */
export const headBottom = (safeTop: number) => safeTop + HEAD_PHONE;

/** The map's insets on phone: framed between the header and the sheet's peek, clear of the edges. */
export function phoneInsets(safeTop: number, peek = PEEK_PHONE, clear = SHEET_CLEAR): Insets {
  return { top: headBottom(safeTop) + HEAD_GAP, right: 16, bottom: peek + clear + 16, left: 16 };
}

// ---------- laptop ----------

/** Laptop: the map frames its place between the top bar and search, and the day panel. */
export const PLAN_INSETS: Insets = { top: 236, right: 476, bottom: 40, left: 40 };
/** The day analysis panel beside the day panel on wide laptops, and the gap between them. */
export const ANALYSIS_W = 360;
export const ANALYSIS_GAP = 12;
/**
 * The narrowest window where the analysis fits beside the day panel, clear of the search: the search
 * (32 + 400) and some air, the analysis and the day panel (420), and the right margin (24). Narrower,
 * it slides over the day list instead, as on phone. styles.css's media queries use the same number.
 */
export const ANALYSIS_SIDE_MIN = 1264;

/** The map's insets with the analysis open beside the day panel: the right inset grows by its width. */
export const withAnalysis = (i: Insets): Insets => ({ ...i, right: i.right + ANALYSIS_W + ANALYSIS_GAP });
