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
}

/** Router state for opening an attraction from the planner. */
export const planningState = (tripId: string, search: string) => ({ planning: { tripId, search: normalSearch(search), hops: 1 } satisfies Planning });

/** Router state for opening another attraction from an attraction page in planning: one hop further. */
export const onwardState = (p: Planning) => ({ planning: { ...p, hops: p.hops + 1 } satisfies Planning });

const normalSearch = (s: string) => (s && !s.startsWith('?') ? `?${s}` : s);

/** The planning context in a location's state, or null when there is none or it isn't one. */
export function readPlanning(state: unknown): Planning | null {
  const p = (state as { planning?: Partial<Planning> } | null)?.planning;
  if (!p || typeof p !== 'object' || typeof p.tripId !== 'string' || !p.tripId) return null;
  const search = typeof p.search === 'string' ? normalSearch(p.search) : '';
  // Unknown hops: the previous entry can't be trusted to be the planner, so Back goes by URL.
  const hops = typeof p.hops === 'number' && Number.isInteger(p.hops) && p.hops >= 1 ? p.hops : 0;
  return { tripId: p.tripId, search, hops };
}

/** The planner page the context came from: `/trips/<id>?day=…`. */
export const plannerPath = (p: Planning) => `/trips/${encodeURIComponent(p.tripId)}${p.search}`;

/** The planner's day (0-based) from its search, within a trip of `dayCount` days; the first when missing. */
export function planningDay(search: string, dayCount: number): number {
  const v = new URLSearchParams(search).get('day');
  const n = Number(v);
  const day = v !== null && Number.isInteger(n) && n >= 1 ? n - 1 : 0;
  return Math.max(0, Math.min(day, dayCount - 1));
}

/**
 * Where the page's Back button goes in planning: one step back in history when that entry is the
 * planner (so its history entry is reused), else to the planner's URL.
 */
export function backTarget(p: Planning): { delta: -1 } | { to: string } {
  return p.hops === 1 ? { delta: -1 } : { to: plannerPath(p) };
}
