import { test, expect } from 'vitest';
import { coreCluster, layoutBubbleBoxes, type BubbleIn, type BubbleOut } from './bubbles';

// Tokyo's neighbourhood anchors at the Tokyo level (placeAnchor), Takao an hour west.
const TOKYO: [string, number, number][] = [
  ['shibuya', 139.7018, 35.66],
  ['harajuku', 139.704, 35.669],
  ['shinjuku', 139.704, 35.691],
  ['asakusa', 139.795, 35.7145],
  ['ueno', 139.7745, 35.7141],
  ['yanaka', 139.766, 35.7278],
  ['ginza', 139.769, 35.668],
  ['odaiba', 139.7898, 35.6491],
  ['oshiage', 139.8107, 35.7101],
  ['ryogoku', 139.7934, 35.6969],
  ['kiyosumi', 139.7975, 35.6806],
  ['shimokitazawa', 139.668, 35.6616],
  ['nakano', 139.6656, 35.7088],
  ['setagaya', 139.648, 35.6086],
  ['mitaka', 139.575, 35.7],
  ['takao', 139.2437, 35.6251],
];
const ll = (t: [string, number, number]): [number, number] => [t[1], t[2]];

test('coreCluster leaves Tokyo’s far west (Takao, Mitaka) out of the core', () => {
  const core = coreCluster(TOKYO, ll).map((t) => t[0]);
  expect(core).not.toContain('takao');
  expect(core).not.toContain('mitaka');
  expect(core).toContain('setagaya');
  expect(core).toContain('shibuya');
  expect(core).toHaveLength(14);
});
test('coreCluster keeps every place when there are fewer than six', () => {
  const few = TOKYO.slice(13);
  expect(coreCluster(few, ll)).toEqual(few);
});
test('coreCluster keeps a tight cluster whole (the floor)', () => {
  const tight = TOKYO.slice(0, 11).map((t): [string, number, number] => [t[0], 139.7 + (t[1] - 139.7) / 100, 35.68 + (t[2] - 35.68) / 100]);
  expect(coreCluster(tight, ll)).toHaveLength(11);
});

const band = { top: 0, bottom: 800, left: 0, right: 1000 };
const bub = (sx: number, sy: number, prio: number, w = 120): BubbleIn => ({ sx, sy, w, h: 34, ws: w - 30, wc: 22, hc: 22, prio });
type Box = { x0: number; x1: number; y0: number; y1: number };
function boxes(list: BubbleIn[], out: BubbleOut[]) {
  return out.flatMap((o, i): Box[] => {
    const b = list[i];
    if (o.mode === 'folded') return [];
    if (o.mode === 'compact') return [{ x0: b.sx + o.dx - b.wc / 2, x1: b.sx + o.dx + b.wc / 2, y0: b.sy + o.dy - b.hc / 2, y1: b.sy + o.dy + b.hc / 2 }];
    const w = o.mode === 'full' ? b.w : b.ws;
    return [{ x0: b.sx - w / 2, x1: b.sx + w / 2, y0: b.sy + o.dy - b.h / 2, y1: b.sy + o.dy + b.h / 2 }];
  });
}
const anyOverlap = (bs: Box[]) => bs.some((a, i) => bs.some((b, j) => j > i && !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1)));

test('bubbles with room are full pills at their place', () => {
  const list = [bub(100, 100, 0), bub(400, 100, 1)];
  expect(layoutBubbleBoxes(list, band)).toEqual([
    { mode: 'full', dx: 0, dy: 0 },
    { mode: 'full', dx: 0, dy: 0 },
  ]);
});
test('a crowded bubble moves just above or below with its count before it drops the count', () => {
  const list = [bub(100, 100, 0), bub(215, 100, 1), bub(160, 100, 2)];
  const out = layoutBubbleBoxes(list, band);
  expect(out[0]).toEqual({ mode: 'full', dx: 0, dy: 0 });
  expect(out[1]).toEqual({ mode: 'full', dx: 0, dy: -40 });
  expect(out[2]).toEqual({ mode: 'full', dx: 0, dy: 40 });
});
test('boxed in above and below, a bubble drops its count to fit at its place', () => {
  const list = [bub(100, 100, 0), bub(220, 60, 0.1), bub(220, 140, 0.2), bub(220, 100, 1)];
  expect(layoutBubbleBoxes(list, band)[3]).toEqual({ mode: 'short', dx: 0, dy: 0 });
});
test('a compact circle is nudged off a pill rather than drawn over it', () => {
  // A stack of three pills leaves the last bubble no pill spot; its place is under the middle one.
  const list = [bub(200, 200, 0, 60), bub(200, 160, 1, 60), bub(200, 240, 2, 60), bub(200, 200, 3)];
  const out = layoutBubbleBoxes(list, band);
  expect(out[3]).toEqual({ mode: 'compact', dx: -52, dy: 0 });
  expect(anyOverlap(boxes(list, out))).toBe(false);
});
test('pills are placed before circles, so a compact high-priority bubble does not block later pills', () => {
  // B (priority 1) has no pill spot (A beside it, P above, Q below); C's pill covers B's place.
  const list = [bub(200, 200, 0, 200), bub(330, 200, 1), bub(395, 200, 3), bub(330, 160, 0.1, 100), bub(330, 240, 0.2, 100)];
  const out = layoutBubbleBoxes(list, band);
  expect(['compact', 'folded']).toContain(out[1].mode);
  expect(out[2]).toEqual({ mode: 'full', dx: 0, dy: 0 });
  expect(anyOverlap(boxes(list, out))).toBe(false);
});
test('a circle with no clear spot nearby folds into the pill it would cover', () => {
  // A wall of wide pills: nowhere within two steps of the last bubble's place is clear.
  const list: BubbleIn[] = [];
  for (let r = 0; r < 7; r++) list.push(bub(300, 100 + r * 40, r, 400));
  list.push(bub(300, 220, 9));
  const out = layoutBubbleBoxes(list, band);
  const last = out[list.length - 1];
  expect(last.mode).toBe('folded');
  if (last.mode === 'folded') expect(last.into).toBe(3);
  expect(anyOverlap(boxes(list, out))).toBe(false);
});
test('bubbles keep off the map controls', () => {
  const controls = { x0: 16, x1: 72, y0: 290, y1: 510 };
  const list = [bub(125, 400, 0), bub(30, 400, 1)];
  const out = layoutBubbleBoxes(list, band, [controls]);
  // A pill reaching under the controls drops its count; a circle blocked only by them stays put.
  expect(out[0]).toEqual({ mode: 'short', dx: 0, dy: 0 });
  expect(out[1]).toEqual({ mode: 'compact', dx: 0, dy: 0 });
});
test('nudged circles stay inside the band', () => {
  // Top-left corner: B can't go up or left, so its circle steps right.
  const list = [bub(30, 20, 0, 60), bub(30, 60, 0.5, 60), bub(30, 20, 1)];
  const out = layoutBubbleBoxes(list, { top: 0, bottom: 800, left: 0, right: 1000 });
  const o = out[2];
  expect(o).toEqual({ mode: 'compact', dx: 52, dy: 0 });
  const [b] = boxes([list[2]], [o]);
  expect(b.y0).toBeGreaterThanOrEqual(0);
  expect(b.x0).toBeGreaterThanOrEqual(0);
});
test('a dense Tokyo-like layout never draws one bubble over another', () => {
  const list = TOKYO.map((t, i) => bub((t[1] - 139.6) * 4000, (35.75 - t[2]) * 5000, i, 90 + t[0].length * 6));
  expect(anyOverlap(boxes(list, layoutBubbleBoxes(list, band)))).toBe(false);
});
