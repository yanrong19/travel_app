// The planning context an attraction page is opened with from the trip planner. It travels in router
// (history) state, so a reload keeps it and a page reached any other way has none. Pure: no React.

export interface Planning {
  tripId: string;
  /** The planner's URL search when it opened the page (`?day=2&place=1&view=…&tab=wet`), or ''. */
  search: string;
  /**
   * History entries pushed since the planner: 1 when the planner opened this page, one more per
   * attraction page opened from here. At 1 the previous entry is the planner itself.
   */
  hops: number;
  /** The day (0-based) picked in the trip bar on the page that opened this one; null: the planner's own. */
  day: number | null;
}

/** Router state for opening an attraction from the planner. */
export const planningState = (tripId: string, search: string) => ({
  planning: { tripId, search: normalSearch(search), hops: 1, day: null } satisfies Planning,
});

/** Router state for opening another attraction from an attraction page in planning: one hop further, with the bar's day. */
export const onwardState = (p: Planning, day: number | null = p.day) => ({ planning: { ...p, hops: p.hops + 1, day } satisfies Planning });

const normalSearch = (s: string) => (s && !s.startsWith('?') ? `?${s}` : s);

/** The day in a planner search, 0-based and unclamped; 0 when missing or not a whole number ≥ 1. */
const dayParam = (search: string) => {
  const v = new URLSearchParams(search).get('day');
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n >= 1 ? n - 1 : 0;
};

/** The planning context in a location's state, or null when there is none or it isn't one. */
export function readPlanning(state: unknown): Planning | null {
  const p = (state as { planning?: Partial<Planning> } | null)?.planning;
  if (!p || typeof p !== 'object' || typeof p.tripId !== 'string' || !p.tripId) return null;
  const search = typeof p.search === 'string' ? normalSearch(p.search) : '';
  // Unknown hops: the previous entry can't be trusted to be the planner, so Back goes by URL.
  const hops = typeof p.hops === 'number' && Number.isInteger(p.hops) && p.hops >= 1 ? p.hops : 0;
  const day = typeof p.day === 'number' && Number.isInteger(p.day) && p.day >= 0 ? p.day : null;
  return { tripId: p.tripId, search, hops, day };
}

/** The planner page the context came from (`/trips/<id>?day=…`), on `day` (0-based) when given. */
export function plannerPath(p: Planning, day: number | null = null): string {
  let search = p.search;
  if (day !== null && day !== dayParam(search)) {
    const q = new URLSearchParams(search);
    q.set('day', String(day + 1));
    search = `?${q}`;
  }
  return `/trips/${encodeURIComponent(p.tripId)}${search}`;
}

/** The day the trip bar starts on (0-based), within a trip of `dayCount` days: the one carried, else the planner's. */
export function planningDay(p: Planning, dayCount: number): number {
  const day = p.day ?? dayParam(p.search);
  return Math.max(0, Math.min(day, dayCount - 1));
}

/** Router state the planner reads once: open this attraction's card on the map. */
export type PlannerState = { open: string };

/** The attraction whose card a planner location's state asks to open, or null. */
export function readPlannerOpen(state: unknown): string | null {
  const open = (state as Partial<PlannerState> | null)?.open;
  return typeof open === 'string' && open ? open : null;
}

/**
 * Router state for the phone planner's open search. Opening the search pushes an entry with it, so
 * the Back gesture closes the search instead of leaving the planner; closing it any other way steps
 * back off that entry, so none is left behind.
 */
export const SEARCH_STATE = { planSearch: true } as const;

/** True when a planner location's state is the open search's. */
export function readPlanSearch(state: unknown): boolean {
  return (state as { planSearch?: unknown } | null)?.planSearch === true;
}

/**
 * How the attraction page goes back to the planner, on the bar's `day`, and with `open`'s card shown
 * (the "See it on the map" button):
 * - `back`: one step back in history; the planner entry there is exactly right.
 * - `back-replace`: the planner is the previous entry but needs another day or a card: step back, then
 *   replace that entry with `to` (and `state`), so history never holds the planner twice.
 * - `push`: the planner isn't the previous entry; go to `to`.
 */
export type PlannerReturn = { kind: 'back' } | { kind: 'back-replace' | 'push'; to: string; state?: PlannerState };

export function plannerReturn(p: Planning, opts: { day?: number | null; open?: string | null } = {}): PlannerReturn {
  const to = plannerPath(p, opts.day ?? null);
  const state = opts.open ? { open: opts.open } : undefined;
  if (p.hops !== 1) return { kind: 'push', to, state };
  if (to === plannerPath(p) && !state) return { kind: 'back' };
  return { kind: 'back-replace', to, state };
}
