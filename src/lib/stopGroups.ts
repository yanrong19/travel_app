// Today's numbered stops on the planner map, merged where their circles would overlap on screen:
// one compact pill per cluster ("1–3"), which zooms in until they separate. Pure: screen positions in,
// groups out.

export interface StopPoint {
  id: string;
  /** The stop's number on the day. */
  n: number;
  x: number;
  y: number;
}

export interface StopGroup {
  /** Members in stop order. */
  ids: string[];
  ns: number[];
  /** The centroid, in the same screen units. */
  x: number;
  y: number;
}

/**
 * Circles whose centres are closer than `radius` overlap; overlaps chain (1 touches 2, 2 touches 3,
 * so all three merge). Only clusters of two or more come back, in order of their first stop.
 */
export function groupStops(points: StopPoint[], radius: number): StopGroup[] {
  const parent = points.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < radius) parent[find(i)] = find(j);
  const byRoot = new Map<number, StopPoint[]>();
  points.forEach((p, i) => byRoot.set(find(i), [...(byRoot.get(find(i)) ?? []), p]));
  return [...byRoot.values()]
    .filter((m) => m.length > 1)
    .map((m) => {
      const s = [...m].sort((a, b) => a.n - b.n);
      return {
        ids: s.map((p) => p.id),
        ns: s.map((p) => p.n),
        x: s.reduce((t, p) => t + p.x, 0) / s.length,
        y: s.reduce((t, p) => t + p.y, 0) / s.length,
      };
    })
    .sort((a, b) => a.ns[0] - b.ns[0]);
}

const isRun = (ns: number[]) => ns.every((n, i) => i === 0 || n === ns[i - 1] + 1);

/** What the pill reads: "1–3" for a run of three or more, else "1 2" or "1 2 4". */
export const stopRun = (ns: number[]) => (ns.length >= 3 && isRun(ns) ? `${ns[0]}–${ns[ns.length - 1]}` : ns.join(' '));

/** "Day 1 stops 1 to 3: Sensō-ji, Tokyo National Museum, Yanaka Ginza", or "stops 1, 2 and 4". */
export function groupName(day: number, ns: number[], names: string[]): string {
  const which =
    ns.length >= 3 && isRun(ns) ? `${ns[0]} to ${ns[ns.length - 1]}` : `${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`;
  return `Day ${day + 1} stops ${which}: ${names.join(', ')}`;
}

/**
 * The zoom at which the group's closest pair sits a little more than `radius` apart (screen distance
 * doubles with each zoom level), at least half a level in, at most `max`.
 */
export function splitZoom(points: StopPoint[], radius: number, zoom: number, max: number): number {
  let d = Infinity;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) d = Math.min(d, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
  if (!(d > 0.05)) return max;
  return Math.min(max, Math.max(zoom + 0.5, zoom + Math.log2((radius * 1.2) / d)));
}
