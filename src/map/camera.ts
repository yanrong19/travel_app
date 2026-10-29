import { geoArea, geoNaturalEarth1, geoPath } from 'd3-geo';
import { interpolateZoom } from 'd3-interpolate';
import type { Feature, Geometry, Polygon } from 'geojson';

// One projection for every zoom level, so world → country → ward is one
// continuous camera move. Scale 1000 puts 1 unit at roughly 7 km, which keeps
// ward outlines precise with 3-decimal paths.
export const projection = geoNaturalEarth1().scale(1000).translate([0, 0]).precision(0.05);
export const geoToPath = geoPath(projection);

/** Camera: centre (x, y) and visible width w, in projected units. */
export interface View {
  x: number;
  y: number;
  w: number;
}
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export type Bounds = [[number, number], [number, number]];

/**
 * Padding the map can frame inside: on a short or narrow screen (a phone held sideways in the
 * laptop layout) the insets can add up to more than the map, and MapLibre then frames nothing.
 * Each axis keeps at least `minFree` px free (as fitView does), shrinking that axis' two sides in
 * proportion; padding that already leaves that much is untouched.
 */
export function fitPadding(p: Insets, W: number, H: number, minFree = 80): Insets {
  const squeeze = (a: number, b: number, len: number): [number, number] => {
    const room = len - minFree;
    if (a + b <= room || a + b <= 0) return [a, b];
    const k = Math.max(0, room) / (a + b);
    return [a * k, b * k];
  };
  const [top, bottom] = squeeze(p.top, p.bottom, H);
  const [left, right] = squeeze(p.left, p.right, W);
  return { top, right, bottom, left };
}

/** Bounds of a feature, ignoring far-flung islands (parts under 2% of the largest). */
export function mainBounds(f: Feature<Geometry>): Bounds {
  const g = f.geometry;
  if (g.type !== 'MultiPolygon') return geoToPath.bounds(f);
  const parts = g.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }) as Polygon);
  const areas = parts.map((p) => geoArea(p));
  const max = Math.max(...areas);
  const keep = parts.filter((_, i) => areas[i] >= max * 0.02);
  return geoToPath.bounds({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: keep.map((p) => p.coordinates) } });
}

export function unionBounds(all: Bounds[]): Bounds {
  // Shapes that simplified away report infinite bounds; skip them.
  const list = all.filter((b) => b.flat().every(Number.isFinite));
  return [
    [Math.min(...list.map((b) => b[0][0])), Math.min(...list.map((b) => b[0][1]))],
    [Math.max(...list.map((b) => b[1][0])), Math.max(...list.map((b) => b[1][1]))],
  ];
}

/** The view that fits bounds inside the screen area left free by the insets. */
export function fitView(b: Bounds, W: number, H: number, inset: Insets, pad = 1.12, minW = 0): View {
  const aw = Math.max(80, W - inset.left - inset.right);
  const ah = Math.max(80, H - inset.top - inset.bottom);
  const bw = b[1][0] - b[0][0];
  const bh = b[1][1] - b[0][1];
  const w = Math.max((bw * pad * W) / aw, (bh * pad * W) / ah, minW);
  const k = w / W; // units per pixel
  const cx = (b[0][0] + b[1][0]) / 2;
  const cy = (b[0][1] + b[1][1]) / 2;
  return {
    x: cx - (inset.left + aw / 2 - W / 2) * k,
    y: cy - (inset.top + ah / 2 - H / 2) * k,
    w,
  };
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

type Listener = (v: View) => void;

export class Camera {
  view: View;
  private listeners = new Set<Listener>();
  private raf = 0;

  constructor(v: View) {
    this.view = v;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.view);
    return () => void this.listeners.delete(fn);
  }

  set(v: View) {
    cancelAnimationFrame(this.raf);
    this.emit(v);
  }

  private emit(v: View) {
    this.view = v;
    this.listeners.forEach((fn) => fn(v));
  }

  /** Smooth zoom-and-pan (van Wijk & Nuij), zooming out mid-flight on long hops. */
  flyTo(target: View, opts: { duration?: number; onDone?: () => void } = {}) {
    cancelAnimationFrame(this.raf);
    const from = this.view;
    // interpolateZoom.rho exists at runtime but is missing from the type definitions.
    const zoom = (interpolateZoom as unknown as { rho: (r: number) => typeof interpolateZoom }).rho(1.25);
    const i = zoom([from.x, from.y, from.w], [target.x, target.y, target.w]);
    const duration = opts.duration ?? Math.min(2600, Math.max(750, i.duration * 0.62));
    if (duration <= 0) {
      this.emit(target);
      opts.onDone?.();
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const [x, y, w] = i(easeInOut(t));
      this.emit({ x, y, w });
      if (t < 1) this.raf = requestAnimationFrame(tick);
      else opts.onDone?.();
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }
}

/** Projected point → screen pixels for a view. */
export function toScreen(p: [number, number], v: View, W: number, H: number): [number, number] {
  const k = W / v.w;
  return [(p[0] - v.x) * k + W / 2, (p[1] - v.y) * k + H / 2];
}

/** Four lon/lat corners of what the map shows, clockwise from top-left. */
export type Quad = [number, number][];

/** The free rectangle the insets leave on a W × H map, its corners unprojected to lon/lat. */
export function viewQuad(W: number, H: number, insets: Insets, unproject: (p: [number, number]) => [number, number]): Quad {
  const l = insets.left;
  const t = insets.top;
  const r = W - insets.right;
  const b = H - insets.bottom;
  return [unproject([l, t]), unproject([r, t]), unproject([r, b]), unproject([l, b])];
}
