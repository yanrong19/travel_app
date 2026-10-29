/** Pure layout helpers for the map's pins and count bubbles (MapExplorer applies them to the DOM). */

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * The main cluster of a set of places: the ones within 2.6 times the median distance of the median
 * point (and never closer than `floor` degrees). Places far from the rest (a mountain an hour out of
 * town) are left out, so a frame on the rest doesn't shrink the city to a speck. Fewer than six
 * places are all kept.
 */
export function coreCluster<T>(items: T[], ll: (t: T) => [number, number], floor = 0.05): T[] {
  if (items.length < 6) return items;
  const pts = items.map(ll);
  const cx = median(pts.map((p) => p[0]));
  const cy = median(pts.map((p) => p[1]));
  const d = pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
  const limit = Math.max(median(d) * 2.6, floor);
  return items.filter((_, i) => d[i] <= limit);
}

/** A count bubble to lay out: its place on screen, its sizes as a full, short (no count) and compact pill, and its priority (lower first). */
export interface BubbleIn {
  sx: number;
  sy: number;
  /** Full pill: "Shibuya · 4". */
  w: number;
  h: number;
  /** Short pill: "Shibuya". */
  ws: number;
  /** Compact circle: "4". */
  wc: number;
  hc: number;
  prio: number;
}

/**
 * Where a bubble goes: as a pill (full or short), offset by dy from its place; as a compact circle
 * offset by dx, dy; or `folded` (not drawn) into the bubble at index `into`, which shows "+N".
 */
export type BubbleOut =
  | { mode: 'full' | 'short'; dx: 0; dy: number }
  | { mode: 'compact'; dx: number; dy: number }
  | { mode: 'folded'; into: number };

export interface Band {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type Box = { x0: number; x1: number; y0: number; y1: number };
// Boxes carry their own margins, so boxes that only touch don't overlap.
const overlaps = (a: Box, b: Box) => !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1);

/**
 * Lays out count bubbles so none is drawn over another, or over `avoid` (the map's controls). In
 * priority order each tries to be a pill: full at its place, then full just above or below it
 * (inside the band), and only then short (dropping its count) in the same three spots. Those that
 * can't fit become compact circles showing their count, placed after every pill: at their place if
 * it's clear, else nudged to the nearest clear spot within two steps. One with no clear spot at all
 * is folded into the bubble it would have covered, which shows "+N"; one blocked only by `avoid`
 * stays a circle at its place (under the controls, as any map feature there is).
 */
export function layoutBubbleBoxes(list: BubbleIn[], band: Band, avoid: Box[] = []): BubbleOut[] {
  const out: BubbleOut[] = new Array(list.length);
  const placed: { box: Box; i: number }[] = avoid.map((box) => ({ box, i: -1 }));
  const hits = (r: Box) => placed.some((p) => overlaps(r, p.box));
  const order = list.map((_, i) => i).sort((a, b) => list[a].prio - list[b].prio);
  const pillBox = (b: BubbleIn, w: number, dy: number): Box => ({ x0: b.sx - w / 2 - 4, x1: b.sx + w / 2 + 4, y0: b.sy + dy - b.h / 2 - 3, y1: b.sy + dy + b.h / 2 + 3 });
  const pending: number[] = [];
  for (const i of order) {
    const b = list[i];
    const tries = (['full', 'short'] as const).flatMap((mode) => [0, -(b.h + 6), b.h + 6].map((dy) => ({ mode, dy })));
    const fit = tries.find((t) => {
      const r = pillBox(b, t.mode === 'full' ? b.w : b.ws, t.dy);
      return !hits(r) && (t.dy === 0 || (r.y0 >= band.top && r.y1 <= band.bottom));
    });
    if (!fit) {
      pending.push(i);
      continue;
    }
    out[i] = { mode: fit.mode, dx: 0, dy: fit.dy };
    placed.push({ box: pillBox(b, fit.mode === 'full' ? b.w : b.ws, fit.dy), i });
  }
  for (const i of pending) {
    const b = list[i];
    const circle = (dx: number, dy: number): Box => ({ x0: b.sx + dx - b.wc / 2 - 2, x1: b.sx + dx + b.wc / 2 + 2, y0: b.sy + dy - b.hc / 2 - 2, y1: b.sy + dy + b.hc / 2 + 2 });
    const inBand = (r: Box) => r.y0 >= band.top && r.y1 <= band.bottom && r.x0 >= band.left && r.x1 <= band.right;
    const step = b.hc + 4;
    const offsets: [number, number][] = [];
    for (let gx = -2; gx <= 2; gx++) for (let gy = -2; gy <= 2; gy++) offsets.push([gx * step, gy * step]);
    offsets.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]) || Math.abs(p[0]) - Math.abs(q[0]));
    const at = offsets.find(([dx, dy]) => {
      const r = circle(dx, dy);
      return !hits(r) && ((dx === 0 && dy === 0) || inBand(r));
    });
    if (at) {
      out[i] = { mode: 'compact', dx: at[0], dy: at[1] };
      placed.push({ box: circle(at[0], at[1]), i });
      continue;
    }
    // Nowhere clear: fold into the nearest bubble it would cover.
    const home = circle(0, 0);
    const far = (p: { box: Box }) => Math.hypot((p.box.x0 + p.box.x1) / 2 - b.sx, (p.box.y0 + p.box.y1) / 2 - b.sy);
    const under = placed.filter((p) => p.i >= 0 && overlaps(home, p.box)).sort((p, q) => far(p) - far(q))[0];
    if (under) out[i] = { mode: 'folded', into: under.i };
    else {
      out[i] = { mode: 'compact', dx: 0, dy: 0 };
      placed.push({ box: home, i });
    }
  }
  return out;
}
