// The phone trip planner's layout numbers: the header over the map and the day sheet under it. The
// page scrolls and the sheet slides up over the fixed map (useGuideScroll); these say where things
// sit so the progress, the settle, the CSS and the map's insets agree. Pure: no React, no DOM.

import type { Insets } from '../map/camera';

/** How tall the sheet peeks above the tab bar: the day dropdown, the one-line summary and the sub-tab pill. */
export const PEEK_PHONE = 168;
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
