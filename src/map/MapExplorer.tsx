import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { AttributionControl, Map as MapLibreMap, type LngLatBoundsLike, type MapGeoJSONFeature } from 'maplibre-gl';
import { C, STYLE_URL, applyMode, restyle } from './style';
import { useMapMode, type MapMode } from '../lib/mapMode';
import { geoBounds } from 'd3-geo';
import type { Attraction } from '../data/types';
import { ATTRACTIONS } from '../data/attractions';
import { AREA_COUNTS, JAPAN_ID, PREFECTURES, TOKYO_AREAS, TOKYO_PREF_ID, WORLD, slug, type Level, type MapTarget, type Place } from '../data/places';
import { regionBounds } from '../data/regions';
import { prefersReducedMotion } from '../lib/motion';
import { photo } from '../lib/photos';
import { readings } from '../lib/factors';
import { markerName, markerOf, type Marker } from '../lib/browse';
import { groupKey, groupName, groupStops, splitZoom, stopRun } from '../lib/stopGroups';
import { lensRating, type LensId } from '../lib/lens';
import { plural } from '../lib/format';
import { Icon } from '../components/Icon';
import { GlobeCard, type CardSubject } from '../components/GlobeCard';
import { DESTINATIONS, countrySlugOf, destinationByWorldId, destinationBySlug, worldShape, type Destination } from '../data/destinations';
import { fitPadding, revealDelta, viewQuad, type Bounds, type Insets, type Quad } from './camera';
import { spotFitZoom, spotZoom } from '../lib/spotlight';
import { coreCluster, layoutBubbleBoxes, type Band, type Box as BubbleBox } from './bubbles';

/** The world tour: how long each destination stays lit, and how long after a drag it picks up again. */
const DWELL_MS = 5000;
const RESUME_MS = 5000;
const SPIN_DEG_PER_FRAME = 0.035;
const TOKYO_LL: [number, number] = [139.69, 35.69];

/** Great-circle distance in degrees: how far a country is from the middle of the visible globe. */
function arc(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180;
  const c = Math.sin(a[1] * r) * Math.sin(b[1] * r) + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.cos((a[0] - b[0]) * r);
  return Math.acos(Math.min(1, Math.max(-1, c))) / r;
}

const DEST_SHAPES = {
  type: 'FeatureCollection' as const,
  features: DESTINATIONS.map((d, i) => ({ type: 'Feature' as const, id: i + 1, properties: { wid: d.worldId, live: d.live }, geometry: worldShape(d)!.geometry })),
};


const JAPAN_BOUNDS: LngLatBoundsLike = [
  [128.6, 30.6],
  [146.2, 45.6],
];

/** Our own shapes as GeoJSON. Wards and prefectures use their numeric code as id so feature-state can find them. */
function collection(list: Place[], idOf: (f: Place, i: number) => number, extra?: (id: string) => object) {
  return {
    type: 'FeatureCollection' as const,
    features: list.map((f, i) => ({
      type: 'Feature' as const,
      id: idOf(f, i),
      properties: { fid: f.id, name: f.properties.name, ja: f.properties.ja ?? '', ...(extra?.(f.id) ?? {}) },
      geometry: f.geometry,
    })),
  };
}

/** The main cluster: pins far from the rest (a mountain an hour out of town) are left for the "outside the view" pill. */
const corePins = (pins: Attraction[]) => coreCluster(pins, (a) => a.lonlat);

function boundsOf(points: [number, number][]): LngLatBoundsLike {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const pad = 0.004; // keep a single point from collapsing the box
  return [
    [Math.min(...xs) - pad, Math.min(...ys) - pad],
    [Math.max(...xs) + pad, Math.max(...ys) + pad],
  ];
}

interface Props {
  target: MapTarget;
  insets: Insets;
  /**
   * When only the insets change and the user has moved the map since it framed its place, pan by half
   * the change (keeping their zoom and framing) instead of framing the place afresh. Left where it
   * framed it, the map re-frames gently. The planner's analysis panel uses it.
   */
  panOnInsets?: boolean;
  pins: Attraction[];
  hoverId: string | null;
  /** The picked attraction; its ticker stays raised. */
  selectedId?: string | null;
  lens?: LensId;
  /** Frame the visible pins instead of the whole region. */
  fitPins?: boolean;
  /** A coming-soon country, or a region of Japan, to pin its card to (country level). */
  pinned?: CardSubject | null;
  /** Prefectures to light on `fl-prefs`; while any are set they replace the map's own hover. */
  hotPrefs?: number[];
  /** The ward to light on `fl-areas`; while it is set it replaces the map's own hover. */
  hotArea?: string | null;
  /** Prefectures the country-level camera frames instead of the whole of Japan. */
  focusPrefs?: number[] | null;
  /** The page scrolls on the wheel: the map zooms only with Ctrl + wheel (and trackpad pinch). */
  wheelScrollsPage?: boolean;
  /** A plain wheel over the map while `wheelScrollsPage` is on. */
  onWheelPassThrough?: () => void;
  /** Where the map's attribution goes instead of the map corner, for when the map can be covered. */
  attributionHost?: HTMLElement | null;
  /** Phone: the room under the docked card, for whatever sits at the bottom of the page. */
  cardBottom?: number;
  /** Laptop: a panel over the map's right side (Japan's region list, the planner's day panel) that the card, and dot labels, must stay clear of. */
  cardClearOf?: RefObject<HTMLElement | null>;
  onHover: (id: string | null) => void;
  /** The prefecture under the pointer at country level, so a list can follow the map. */
  onPrefHover?: (code: number | null) => void;
  /** The ward under the pointer at Tokyo level, so the ward list can follow the map. */
  onAreaHover?: (id: string | null) => void;
  /** A prefecture clicked at country level. Without it, Tokyo flies in and the rest get a notice. */
  onPrefPick?: (code: number) => void;
  onCountry: (slug: string) => void;
  onRegion: () => void;
  onArea: (slug: string) => void;
  onAttraction: (id: string) => void;
  onNotice: (text: string) => void;
  /** The style has loaded and the map is drawing, so the page around it can settle. */
  onReady?: () => void;
  /** Trip planning: an attraction's ticker in the current day's colour or the other days' colour. Toned tickers are raised above the rest. */
  tones?: Record<string, 'today' | 'other'>;
  /** The world-level tour: the turning globe, its card and the Tokyo live pin. On unless set to false. */
  tour?: boolean;
  /** Countries (worldIds) lit as picked, destinations or not. */
  litCountries?: string[];
  /** A country clicked at world level; when set, it's called instead of `onCountry`. */
  onWorldPick?: (worldId: string) => void;
  /** Trip planning above the attraction level: one count bubble per child place, in place of pins. */
  bubbles?: MapBubble[];
  /** Trip planning: a card over the map. When it covers the picked ticker, the map pans the ticker clear of it. */
  pickedClearOf?: RefObject<HTMLElement | null>;
  /** The "N places outside the view" pill. On unless set to false (the trip planner turns it off). */
  offscreenPill?: boolean;
  /**
   * How attractions are marked: photo tickers (the map page), or calm dots (the trip planner): a
   * small dot each, today's stops as numbered circles from `dots`, and a label on hover, focus,
   * pick, or where the zoom leaves room.
   */
  markers?: 'ticker' | 'dot';
  /** Dot mode: each planned attraction's marker (today's numbered stops, other days'); the rest are unplanned. */
  dots?: Record<string, Marker>;
  /** What the camera looks at instead of the target's own framing: a box to frame, or one attraction spotlit. */
  focus?: MapFocus | null;
  /** The free area's corners in lon/lat, on every camera rest and once when the map is ready (see viewQuad). */
  onViewQuad?: (q: Quad) => void;
}

/**
 * A focus overrides the target's framing. `frame` frames its bounds; `spot` centres one attraction in
 * the free area at street zoom, labels its neighbours (`near`) and greys the rest. `key` names the
 * focus for the camera: a new key flies, the same key stays put.
 *
 * A spot's `move` says how the camera gets there. `fly`: the spotlight's own camera, as above, saved
 * first and flown back to on leaving. `reveal` (a dot picked on the map, a row in a list beside it):
 * the camera keeps its zoom, tilt and centre, and only pans, as little as it can, when the spot or
 * its label would be off the free area or under the card. Nothing is saved, and leaving a run of
 * reveals leaves the camera where it is, whatever frame the focus goes back to; that frame stays
 * unflown until its key changes (a crumb, a bubble). A spot's key names its move too, so the same
 * spot opened the other way (revealed, then picked in the day list) moves again, in the same run.
 */
export type MapFocus =
  | { kind: 'frame'; key: string; bounds: Bounds }
  | { kind: 'spot'; key: string; id: string; center: [number, number]; near: string[]; move: SpotMove };
export type SpotMove = 'reveal' | 'fly';

/** A count bubble: a place one level down, how many checked attractions it holds, and how to go there. */
export interface MapBubble {
  id: string;
  ll: [number, number];
  label: string;
  count: number;
  onPick(): void;
}

/** A revealed spot keeps this far inside the free area's edges, and this far off the card. */
const REVEAL_MARGIN = 40;
const REVEAL_CARD_GAP = 12;

/** Dot mode: today's numbered circles closer than this on screen merge into one pill. */
const STOP_MERGE_PX = 28;

type Pad = { top: number; right: number; bottom: number; left: number };
type Cam = { center: [number, number] | { lng: number; lat: number }; zoom: number; pitch: number; bearing: number; padding?: Pad };
const NO_PAD: Pad = { top: 0, right: 0, bottom: 0, left: 0 };

/** How a framing tilts in 3D: Tokyo-wide (`wide`) a little flatter than a ward or a framed box (`close`); some never do (`flat`). */
type Tilt = 'flat' | 'wide' | 'close';
const TILT: Record<Tilt, [pitch: number, bearing: number]> = { flat: [0, 0], wide: [48, -12], close: [55, -18] };
const tiltOf = (kind: Tilt, tilted: boolean): [number, number] => (tilted ? TILT[kind] : TILT.flat);
/** Which tilt a framing at this level takes: a framed box or a ward close, Tokyo-wide wide, anything else flat. */
const tiltKind = (framed: boolean, level: string): Tilt => (framed || level === 'area' ? 'close' : level === 'region' ? 'wide' : 'flat');

export function MapExplorer(props: Props) {
  const {
    target,
    insets,
    panOnInsets = false,
    pins,
    hoverId,
    selectedId = null,
    lens = 'any',
    fitPins = false,
    pinned = null,
    hotPrefs,
    hotArea = null,
    focusPrefs = null,
    wheelScrollsPage = false,
    attributionHost = null,
    cardBottom = 92,
    cardClearOf,
    tones,
    tour = true,
    litCountries,
    bubbles,
    pickedClearOf,
    offscreenPill = true,
    markers = 'ticker',
    dots,
    focus = null,
  } = props;
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const spot = focus?.kind === 'spot' ? focus : null;
  const spotKey = spot ? `${spot.id}:${spot.near.join(',')}` : '';
  const tourRef = useRef(tour);
  tourRef.current = tour;
  const cardBottomRef = useRef(cardBottom);
  cardBottomRef.current = cardBottom;
  const clearOfRef = useRef(cardClearOf);
  clearOfRef.current = cardClearOf;
  const wrap = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const tether = useRef<SVGSVGElement>(null);
  const canvasBox = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const offscreen = useRef<HTMLButtonElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useMapMode();
  const tilted = mode === '3d';
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const handlers = useRef(props);
  handlers.current = props;
  const levelRef = useRef<Level>(target.level);
  levelRef.current = target.level;
  const spin = useRef(0);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  // The one shape the map itself has under the pointer, so the next hover can put it back.
  const hovered = useRef<{ source: string; id: number } | null>(null);
  const hotKey = (hotPrefs ?? []).join(',');
  const hotPrefsRef = useRef(hotPrefs ?? []);
  hotPrefsRef.current = hotPrefs ?? [];
  const hotAreaRef = useRef(hotArea);
  hotAreaRef.current = hotArea;
  const focusKey = (focusPrefs ?? []).join(',');
  const litKey = (litCountries ?? []).join(',');
  // Planning mode: countries are being picked, so no destination is tinted stronger than another.
  const planning = litCountries !== undefined;
  const toneKey = tones ? Object.entries(tones).map(([id, t]) => `${id}:${t}`).sort().join(',') : '';
  const bubbleKey = bubbles ? bubbles.map((b) => `${b.id}:${b.count}`).join(',') : '';
  const dotKey = dots ? Object.entries(dots).map(([id, m]) => `${id}:${m.kind}:${m.kind === 'today' ? m.n : ''}`).sort().join(',') : '';
  const dotMode = markers === 'dot';
  const dotModeRef = useRef(dotMode);
  dotModeRef.current = dotMode;
  // Dot mode: today's stops whose circles overlap on screen, merged into one pill each. Worked out on
  // every camera move; React hears only when the membership changes.
  const [stopGroups, setStopGroups] = useState<{ ids: string[]; ns: number[] }[]>([]);
  const stopGroupKey = useRef('');
  // The pill under the pointer or focus: raised, so its list of names gets a side with room.
  const [hotGroup, setHotGroup] = useState<string | null>(null);
  // A pill whose stops still overlap at the map's deepest zoom: its list turns into buttons to pick one.
  const [pickGroup, setPickGroup] = useState<string | null>(null);
  // A pill split from the keyboard: focus goes to its first stop once that stop shows on its own.
  const focusAfterSplit = useRef<string | null>(null);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const dotsRef = useRef(dots);
  dotsRef.current = dots;

  // The tour: one destination lit at a time while the globe turns.
  const [current, setCurrent] = useState<Destination>(DESTINATIONS[0]);
  const [touring, setTouring] = useState(false);
  const touringRef = useRef(touring);
  touringRef.current = touring;
  const currentRef = useRef(current);
  currentRef.current = current;
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const paused = useRef(false);
  const resumeTimer = useRef(0);
  const firstWorld = useRef(true);
  const toured = useRef(false);
  const flightId = useRef(0);
  const tourOn = target.level === 'world' && tour;
  const tourDest: Destination | null = tourOn && touring ? current : null;
  const cardDest: CardSubject | null = tourOn ? tourDest : pinned;
  const cardRef = useRef(cardDest);
  cardRef.current = cardDest;
  // Regions share the card but have no country shape of their own to light.
  const litWid = cardDest ? destinationBySlug(cardDest.slug)?.worldId : undefined;

  // ---- Create the map once ----
  useEffect(() => {
    const map = new MapLibreMap({
      container: canvasBox.current!,
      style: STYLE_URL,
      center: [139.2, 36],
      zoom: 1.4,
      maxPitch: 70,
      attributionControl: false, // added below, so it can live outside the map
      fadeDuration: 150,
      renderWorldCopies: false,
    });
    mapRef.current = map;
    // Handy for poking at the map from the console during development.
    if (import.meta.env.DEV) (window as unknown as { __flMap?: MapLibreMap }).__flMap = map;

    const failTimer = window.setTimeout(() => !map.isStyleLoaded() && setFailed(true), 15000);

    map.on('style.load', () => {
      clearTimeout(failTimer);
      restyle(map, undefined, modeRef.current);
      addOurLayers(map, modeRef.current);
      map.setProjection({ type: 'globe' });
      setReady(true);
      handlers.current.onReady?.();
    });

    map.on('move', place);
    map.on('resize', place);
    // Touching the map stops the turn and the tour; on the globe both pick up again a few seconds after letting go.
    const hold = () => {
      cancelAnimationFrame(spin.current);
      paused.current = true;
      clearTimeout(resumeTimer.current);
    };
    const release = () => levelRef.current === 'world' && tourRef.current && resumeLater(RESUME_MS);
    map.on('mousedown', hold);
    map.on('touchstart', hold);
    map.on('wheel', () => {
      hold();
      release();
    });
    map.on('mouseup', release);
    map.on('touchend', release);
    map.on('dragend', release);

    return () => {
      clearTimeout(failTimer);
      clearTimeout(resumeTimer.current);
      cancelAnimationFrame(spin.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The attribution sits in the map corner, or in `attributionHost` when the page can cover the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const control = new AttributionControl({ compact: true });
    if (!attributionHost) {
      map.addControl(control, 'bottom-right');
      return () => {
        if (mapRef.current) map.removeControl(control); // a removed map has already dropped it
      };
    }
    const el = control.onAdd(map);
    attributionHost.appendChild(el);
    return () => {
      if (mapRef.current) control.onRemove();
      else el.remove();
    };
  }, [attributionHost]);

  // On a scrolling page the wheel belongs to the page; Ctrl + wheel (and pinch) still zoom the map.
  useEffect(() => {
    const map = mapRef.current;
    const el = wrap.current;
    if (!map || !el || !wheelScrollsPage) return;
    map.scrollZoom.disable();
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) {
        handlers.current.onWheelPassThrough?.();
        return;
      }
      e.preventDefault();
      const box = map.getCanvasContainer();
      const r = box.getBoundingClientRect();
      // The page may scale the map down a little as the guides come up.
      const sx = r.width ? box.clientWidth / r.width : 1;
      const sy = r.height ? box.clientHeight / r.height : 1;
      const around = map.unproject([(e.clientX - r.left) * sx, (e.clientY - r.top) * sy]);
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY; // lines (Firefox) to pixels
      map.easeTo({ zoom: map.getZoom() - dy * 0.01, around, duration: 0 });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (mapRef.current) map.scrollZoom.enable();
    };
  }, [wheelScrollsPage]);

  // Keep the canvas sized to its box.
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    ro.observe(wrap.current!);
    return () => ro.disconnect();
  }, []);

  // The card is docked by its own height, which it only has once it has laid out (and which
  // changes with its subject), so follow its size rather than place it once and hope.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const ro = new ResizeObserver(() => place());
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Place the HTML overlay (tickers, callout) on every camera move ----
  function place() {
    const map = mapRef.current;
    const el = overlay.current;
    if (!map || !el) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
    const tickers: { el: HTMLElement; sx: number; sy: number }[] = [];
    const dotEls: { el: HTMLElement; sx: number; sy: number }[] = [];
    const bubbleEls: { el: HTMLElement; sx: number; sy: number }[] = [];
    let offDots = 0;
    groupTodaysStops(map, el);
    el.querySelectorAll<HTMLElement>('[data-ll]').forEach((node) => {
      const [lng, lat] = node.dataset.ll!.split(',').map(Number);
      const p = map.project([lng, lat]);
      node.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      if (node.dataset.flip !== undefined) node.classList.toggle('is-flipped', p.x > W - 140);
      if (node.classList.contains('ticker')) tickers.push({ el: node, sx: p.x, sy: p.y });
      if (node.classList.contains('mdot') && !node.classList.contains('is-grouped')) {
        // Dots well outside the view stay out of the label layout.
        if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) {
          node.classList.remove('is-labelled', 'is-left');
          offDots++;
        } else dotEls.push({ el: node, sx: p.x, sy: p.y });
      }
      if (node.classList.contains('mbubble')) bubbleEls.push({ el: node, sx: p.x, sy: p.y });
    });
    layoutTickers(tickers);
    // Labels stay left of a panel over the map's right side (its own edge, or the right inset).
    const freeRight = () => {
      const panel = clearOfRef.current?.current?.getBoundingClientRect();
      const left0 = wrap.current?.getBoundingClientRect().left ?? 0;
      return panel && panel.width ? panel.left - left0 - 8 : W - insetsRef.current.right;
    };
    // The zoom controls sit over the map (on the right on phones): labels keep off them.
    const controls = () => {
      const box = wrap.current?.getBoundingClientRect();
      const ctl = wrap.current?.querySelector('.map-controls')?.getBoundingClientRect();
      return ctl && ctl.width && box ? [{ x0: ctl.left - box.left - 4, x1: ctl.right - box.left + 4, y0: ctl.top - box.top - 4, y1: ctl.bottom - box.top + 4 }] : [];
    };
    if (dotEls.length) layoutDots(dotEls, map.getZoom(), freeRight(), H, controls());
    if (bubbleEls.length) layoutBubbles(bubbleEls, { top: insetsRef.current.top, bottom: H - insetsRef.current.bottom, left: 0, right: freeRight() }, controls());
    const off = offDots + [...tickers, ...dotEls].filter((t) => t.sx < 0 || t.sx > W || t.sy < 0 || t.sy > H).length;
    if (offscreen.current) {
      offscreen.current.dataset.on = off ? '1' : '';
      offscreen.current.firstElementChild!.textContent = off === 1 ? '1 place outside the view' : `${off} places outside the view`;
    }
    placeCard(map, W, H);
  }

  /** Dot mode: merges today's numbered circles that overlap on screen (see lib/stopGroups). */
  function groupTodaysStops(map: MapLibreMap, el: HTMLElement) {
    const marks = dotsRef.current;
    const on = dotModeRef.current && !!marks && !!el.querySelector('.mdot');
    const points = on
      ? pinsRef.current.flatMap((a) => {
          const m = marks![a.id];
          if (m?.kind !== 'today') return [];
          const q = map.project(a.lonlat);
          return [{ id: a.id, n: m.n, x: q.x, y: q.y }];
        })
      : [];
    const groups = groupStops(points, STOP_MERGE_PX);
    const key = groupKey(groups);
    if (key === stopGroupKey.current) return;
    stopGroupKey.current = key;
    setStopGroups(groups.map((g) => ({ ids: g.ids, ns: g.ns })));
  }

  /**
   * A pill clicked: zoom in on its stops until their circles separate. At the map's deepest zoom,
   * where that can't happen, its list opens as buttons to pick one. From the keyboard, focus follows
   * to the first stop once it shows on its own.
   */
  function splitGroup(key: string, ids: string[], keyboard: boolean) {
    const map = mapRef.current;
    if (!map) return;
    const max = map.getMaxZoom();
    if (map.getZoom() >= max - 0.01) {
      setPickGroup((k) => (k === key ? null : key));
      return;
    }
    // The pill goes once its stops separate, so it can't hear the pointer leave.
    setHotGroup(null);
    setPickGroup(null);
    focusAfterSplit.current = keyboard ? ids[0] : null;
    const members = ids.map((id) => pinsRef.current.find((a) => a.id === id)).filter((a): a is Attraction => !!a);
    if (!members.length) return;
    const points = members.map((a, i) => {
      const q = map.project(a.lonlat);
      return { id: a.id, n: i, x: q.x, y: q.y };
    });
    const zoom = splitZoom(points, STOP_MERGE_PX, map.getZoom(), max);
    const center: [number, number] = [
      members.reduce((t, a) => t + a.lonlat[0], 0) / members.length,
      members.reduce((t, a) => t + a.lonlat[1], 0) / members.length,
    ];
    map.easeTo({ center, zoom, duration: prefersReducedMotion() ? 0 : 700 });
  }

  /** Tether the destination card to its country: beside it on wide screens, docked at the bottom on phones. */
  function placeCard(map: MapLibreMap, W: number, H: number) {
    const cardEl = card.current;
    const svg = tether.current;
    const d = cardRef.current;
    if (!cardEl || !svg) return;
    if (!d) {
      cardEl.dataset.on = '';
      svg.dataset.on = '';
      return;
    }
    const c = map.getCenter();
    const facing = map.getZoom() > 3 || arc(d.anchor, [c.lng, c.lat]) < 80;
    const p = map.project(d.anchor);
    const cw = cardEl.offsetWidth;
    const ch = cardEl.offsetHeight;
    const ins = insetsRef.current;
    const narrow = W < 760;
    let x: number;
    let y: number;
    if (narrow) {
      x = (W - cw) / 2;
      y = H - ch - cardBottomRef.current;
    } else {
      // Japan's card clears the Tokyo pin's label on the right.
      const gapRight = d.live ? 210 : 70;
      const minX = Math.max(ins.left - 24, 16);
      // The card's right limit: the map's edge, or a little short of a right-hand panel.
      const panel = clearOfRef.current?.current?.getBoundingClientRect();
      const left0 = wrap.current?.getBoundingClientRect().left ?? 0;
      const edge = panel && panel.width ? Math.min(W - 24, panel.left - left0 - 16) : W - 24;
      // Short of room on the right, a region's card closes in on its pin before it flips left,
      // where Japan's title card sits; Japan's own card keeps its gap to clear Tokyo's label.
      const minGap = d.live ? gapRight : 16;
      const right = p.x + minGap + cw <= edge;
      const left = p.x - 70 - cw >= minX;
      // Neither side has room (a narrow laptop with the panel open): as far right as the panel allows.
      x = right ? Math.min(p.x + gapRight, edge - cw) : left ? p.x - 70 - cw : edge - cw;
      x = Math.max(minX, Math.min(edge - cw, x));
      y = Math.max(ins.top - 40, Math.min(H - ch - 24, p.y - ch / 2));
    }
    cardEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    cardEl.dataset.on = facing ? '1' : '';
    const ex = narrow ? x + cw / 2 : p.x < x ? x : x + cw;
    const ey = narrow ? y : Math.max(y + 24, Math.min(y + ch - 24, p.y));
    const line = svg.firstElementChild!;
    const dot = svg.lastElementChild!;
    line.setAttribute('x1', p.x.toFixed(1));
    line.setAttribute('y1', p.y.toFixed(1));
    line.setAttribute('x2', ex.toFixed(1));
    line.setAttribute('y2', ey.toFixed(1));
    dot.setAttribute('cx', p.x.toFixed(1));
    dot.setAttribute('cy', p.y.toFixed(1));
    svg.dataset.on = facing ? '1' : '';
  }

  // ---- The tour ----
  function highlight(wid: string | undefined) {
    const map = mapRef.current;
    if (!map || !map.getSource('fl-dest')) return;
    DEST_SHAPES.features.forEach((f) => map.setFeatureState({ source: 'fl-dest', id: f.id }, { current: f.properties.wid === wid }));
  }

  /** Light another destination facing the viewer; any one will do, as long as it is on this side of the globe. */
  function pickNext() {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    const center: [number, number] = [c.lng, c.lat];
    const others = DESTINATIONS.filter((d) => d.slug !== currentRef.current.slug);
    const facing = others.filter((d) => arc(d.anchor, center) < 62);
    const pool = facing.length ? facing : [...others].sort((a, b) => arc(a.anchor, center) - arc(b.anchor, center)).slice(0, 1);
    setCurrent(pool[Math.floor(Math.random() * pool.length)]);
  }

  /** Start turning and touring again after `ms`, unless the map is touched again first. */
  function resumeLater(ms: number) {
    clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      if (levelRef.current !== 'world' || !tourRef.current || !mapRef.current) return;
      paused.current = false;
      startSpin();
      if (touringRef.current) pickNext();
      else setTouring(true);
      toured.current = true;
    }, ms);
  }

  useEffect(() => {
    if (!ready) return;
    highlight(litWid);
    place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardDest, litWid, ready]);

  // Leaving the globe ends the tour; coming back starts it again five seconds after landing.
  useEffect(() => {
    if (!tourOn) {
      setTouring(false);
      clearTimeout(resumeTimer.current);
      cancelAnimationFrame(spin.current);
      paused.current = false;
    }
  }, [tourOn]);

  // The tour switched back on while on the globe: pick it up again (a no-op on mount).
  const lastTour = useRef(tour);
  useEffect(() => {
    if (lastTour.current === tour) return;
    lastTour.current = tour;
    if (tour && ready && levelRef.current === 'world') resumeLater(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  // ---- Planning mode: every destination gets the same low tint (Japan isn't stronger) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !planning || !map.getSource('fl-dest')) return;
    const set = (plan: boolean) => DEST_SHAPES.features.forEach((f) => map.setFeatureState({ source: 'fl-dest', id: f.id }, { plan }));
    set(true);
    return () => {
      if (mapRef.current) set(false);
    };
  }, [planning, ready]);

  // ---- Countries lit as picked: destinations on `fl-dest`, the rest on `fl-world` ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource('fl-dest') || !map.getSource('fl-world')) return;
    const wids = new Set(litKey ? litKey.split(',') : []);
    if (!wids.size) return;
    const dest = DEST_SHAPES.features.filter((f) => wids.has(f.properties.wid)).map((f) => f.id);
    const world = WORLD.flatMap((f, i) => (wids.has(f.id) && !destinationByWorldId(f.id) ? [i + 1] : []));
    const set = (picked: boolean) => {
      dest.forEach((id) => map.setFeatureState({ source: 'fl-dest', id }, { picked }));
      world.forEach((id) => map.setFeatureState({ source: 'fl-world', id }, { picked }));
    };
    set(true);
    return () => {
      if (mapRef.current) set(false);
    };
  }, [litKey, ready]);

  useEffect(() => {
    if (!tourOn || !touring) return;
    const t = window.setInterval(() => !paused.current && pickNext(), DWELL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOn, touring]);

  // Re-place after React adds, removes or re-ranks overlay items.
  useLayoutEffect(() => {
    place();
  }, [pins, target.level, target.area?.id, hoverId, selectedId, lens, ready, cardBottom, toneKey, bubbleKey, dotKey, markers, stopGroups, hotGroup, pickGroup, spotKey]);

  // A pill split from the keyboard: once its first stop is no longer merged, focus moves to it.
  useEffect(() => {
    const id = focusAfterSplit.current;
    if (!id || stopGroups.some((g) => g.ids.includes(id))) return;
    focusAfterSplit.current = null;
    overlay.current?.querySelector<HTMLElement>(`.mdot[data-id="${id}"]`)?.focus({ preventScroll: true });
  }, [stopGroups]);

  // ---- Keep the picked ticker clear of a card over the map (trip planning) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedId || !pickedClearOf) return;
    let done = false;
    const reveal = () => {
      const a = pins.find((p) => p.id === selectedId);
      const cardEl = pickedClearOf.current;
      const box = wrap.current?.getBoundingClientRect();
      // A spotlit attraction is already centred in the free area, clear of the panels.
      if (done || !a || !cardEl || !box || focusRef.current?.kind === 'spot') return;
      done = true;
      const c = cardEl.getBoundingClientRect();
      const p = map.project(a.lonlat);
      // The ticker's pill and tail sit above its point: about 140 wide and 52 tall, picked. A dot sits
      // on its point with its label beside it: keep about a label's width either side.
      const [hw, up, down] = dotModeRef.current ? [96, 18, 18] : [70, 52, 0];
      const px = box.left + p.x;
      const py = box.top + p.y;
      const ins = insetsRef.current;
      // The pill may reach a little into the top inset: its bottom edge is the chrome's soft padding.
      const [x0, x1, y0, y1] = [box.left + ins.left + hw, box.right - ins.right - hw, box.top + ins.top + up - 12, box.bottom - ins.bottom - down];
      const clear = ([x, y]: [number, number]) => x + hw < c.left || x - hw > c.right || y + down < c.top || y - up > c.bottom;
      const clamp = ([x, y]: [number, number]): [number, number] => [Math.min(x1, Math.max(x0, x)), Math.min(y1, Math.max(y0, y))];
      // Phones: the picked pin also comes into the free strip when it is off it (outside the place's
      // framing, or under the header or the sheet), by panning only: the zoom stays the place's.
      const phone = box.width < 761;
      const inFree = px >= x0 && px <= x1 && py >= y0 && py <= y1;
      if (clear([px, py]) && (!phone || inFree)) return;
      // The nearest spot beside, above or below the card that stays inside the free area.
      const spots: [number, number][] = [
        [px, c.top - down - 4],
        [px, c.bottom + up + 4],
        [c.right + hw + 8, py],
        [c.left - hw - 8, py],
      ];
      if (phone) spots.push([px, py]);
      const fits = spots.map(clamp).filter(clear);
      // No spot clear of the card (a very short screen): still pan, to just above it, rather than zoom out.
      if (!fits.length && phone) fits.push(clamp([px, c.top - down - 4]));
      if (!fits.length) return;
      const [tx, ty] = fits.reduce((b, f) => (Math.hypot(f[0] - px, f[1] - py) < Math.hypot(b[0] - px, b[1] - py) ? f : b));
      map.panBy([px - tx, py - ty], { duration: prefersReducedMotion() ? 0 : 600 });
    };
    // After the card is in, and after any flight to the attraction's place has landed.
    const t = window.setTimeout(() => (map.isMoving() ? map.once('moveend', reveal) : reveal()), 450);
    return () => {
      done = true;
      window.clearTimeout(t);
      map.off('moveend', reveal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready]);

  // Ticker widths change once the web fonts arrive: measure again.
  useEffect(() => {
    document.fonts?.ready.then(() => {
      overlay.current?.querySelectorAll<HTMLElement>('.ticker, .mbubble, .mdot').forEach((t) => delete t.dataset.w);
      place();
    });
  }, []);

  // ---- Which of our layers show at each level ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const lv = target.level;
    const show = (id: string, on: boolean) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    show('fl-world-fill', lv === 'world' || lv === 'country');
    show('fl-dest-fill', lv === 'world' || lv === 'country');
    show('fl-dest-line', lv === 'world' || lv === 'country');
    show('fl-pref-fill', lv === 'country');
    show('fl-pref-line', lv !== 'world');
    show('fl-area-fill', lv === 'region' || lv === 'area');
    show('fl-area-line', lv === 'region' || lv === 'area');
    TOKYO_AREAS.forEach((a) => map.setFeatureState({ source: 'fl-areas', id: Number(a.id) }, { selected: a.id === target.area?.id }));
  }, [ready, target.level, target.area?.id]);

  // ---- Prefectures lit from the outside: the hovered set, and the focused region ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource('fl-prefs')) return;
    const codes = hotKey ? hotKey.split(',').map(Number) : [];
    // The list has taken over: drop whatever the map had under the pointer.
    if (codes.length && hovered.current?.source === 'fl-prefs') {
      map.setFeatureState(hovered.current, { hover: false });
      hovered.current = null;
    }
    codes.forEach((id) => map.setFeatureState({ source: 'fl-prefs', id }, { hover: true }));
    return () => {
      if (!mapRef.current) return;
      codes.forEach((id) => map.setFeatureState({ source: 'fl-prefs', id }, { hover: false }));
    };
  }, [hotKey, ready]);

  // ---- The ward the list is pointing at, lit the same way ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !hotArea || !map.getSource('fl-areas')) return;
    // The list has taken over: drop whatever the map had under the pointer.
    if (hovered.current?.source === 'fl-areas') {
      map.setFeatureState(hovered.current, { hover: false });
      hovered.current = null;
    }
    const id = Number(hotArea);
    map.setFeatureState({ source: 'fl-areas', id }, { hover: true });
    return () => {
      if (mapRef.current) map.setFeatureState({ source: 'fl-areas', id }, { hover: false });
    };
  }, [hotArea, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource('fl-prefs')) return;
    const codes = focusKey ? focusKey.split(',').map(Number) : [];
    codes.forEach((id) => map.setFeatureState({ source: 'fl-prefs', id }, { focus: true }));
    return () => {
      if (!mapRef.current) return;
      codes.forEach((id) => map.setFeatureState({ source: 'fl-prefs', id }, { focus: false }));
    };
  }, [focusKey, ready]);

  // ---- Camera: fly whenever the place, the visible pins or the free area changes ----
  const fitList = fitPins && target.level === 'region' ? pins : undefined;
  const fitKey = fitList ? fitList.map((a) => a.id).sort().join(',') : '';
  // A city's count bubbles (Tokyo's neighbourhoods) frame it on their main cluster, see flyToTarget.
  const frameBubbles = target.level === 'region' && bubbles?.length ? bubbles : null;
  const frameBubbleKey = frameBubbles ? frameBubbles.map((b) => b.id).join(',') : '';
  const insetKey = `${insets.top},${insets.right},${insets.bottom},${insets.left}`;
  const camKey = `${target.level}:${target.country?.id}:${target.area?.id}:${fitKey}:${frameBubbleKey}:${focusKey}:${focus?.key ?? ''}|${insetKey}`;
  const lastKey = useRef('');
  const lastFocus = useRef<MapFocus | null>(null);
  // The camera from just before a run of spots (with the key, insets, mode and kind of tilt it had), to come back to on leaving them.
  const spotReturn = useRef<{ key: string; insets: string; mode: MapMode; tilt: Tilt; cam: Cam } | null>(null);
  // The current run of spots: the key, insets and tilt it started from, and whether any spot in it
  // flew. A run of reveals only leaves the camera be; the first fly saves it (spotReturn) under the
  // run's start.
  const spotRun = useRef<{ key: string; insets: string; tilt: Tilt; flew: boolean } | null>(null);
  // The frame (camKey without its insets) a run of reveals left the camera on: not flown to, as the
  // camera never left the place the reveals started from, until the key changes.
  const quietKey = useRef<string | null>(null);
  // A reveal's own pan while it runs (cleared at its moveend, which a drag or a newer flight cutting
  // it short also brings), so a leave can stop just that pan.
  const revealEase = useRef<object | null>(null);
  const lastInsets = useRef(insets);
  // Where the camera came to rest after the last framing, to tell whether the user has moved it since.
  const framedAt = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const noteFrame = (map: MapLibreMap) =>
    map.once('moveend', () => {
      framedAt.current = { center: map.getCenter().toArray() as [number, number], zoom: map.getZoom() };
    });
  const stillFramed = (map: MapLibreMap) => {
    const f = framedAt.current;
    if (!f) return false;
    const was = map.project(f.center);
    const now = map.project(map.getCenter());
    return Math.abs(map.getZoom() - f.zoom) < 0.02 && Math.hypot(now.x - was.x, now.y - was.y) < 2;
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || camKey === lastKey.current) return;
    const first = lastKey.current === '';
    const [wasKey, wasInsetKey = ''] = lastKey.current.split('|');
    const head = camKey.split('|')[0];
    const onlyInsets = !first && wasKey === head;
    lastKey.current = camKey;
    const was = lastInsets.current;
    lastInsets.current = insets;
    const wasFocus = lastFocus.current;
    lastFocus.current = focus;
    if (focus?.kind === 'spot') {
      quietKey.current = null;
      if (wasFocus?.kind !== 'spot') spotRun.current = { key: wasKey, insets: wasInsetKey, tilt: tiltKind(wasFocus?.kind === 'frame', levelRef.current), flew: false };
      const run = spotRun.current!;
      // The map's first camera has no place to stay at: it flies.
      const fly = focus.move === 'fly' || first;
      if (fly && !run.flew) {
        // The run's first flight: remember where the camera was, under the key, insets and mode the
        // run started at. Not while it is still moving there: leaving then frames afresh rather than
        // going back half-way.
        run.flew = true;
        const c = map.getCenter();
        spotReturn.current =
          first || map.isMoving()
            ? null
            : { key: run.key, insets: run.insets, mode: modeRef.current, tilt: run.tilt, cam: { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), padding: { ...NO_PAD, ...map.getPadding() } } };
      }
      if (!fly) {
        revealSpot(focus.id, focus.center);
        return;
      }
    } else if (wasFocus?.kind === 'spot') {
      const run = spotRun.current;
      spotRun.current = null;
      if (run && !run.flew) {
        // Leaving a run of reveals: the camera stays, on whatever frame the focus is back on (the
        // spot's neighbourhood, when the leave replaced the spot away). The lists that follow the map
        // hear what it shows now, for the place now viewed. A reveal's pan still running stops where
        // it is (its moveend reports too).
        ++flightId.current;
        if (revealEase.current) {
          revealEase.current = null;
          map.stop();
        }
        quietKey.current = head;
        reportQuad(map);
        return;
      }
      // Leaving the spots back to the key and free area they started from: fly back to that camera,
      // not a fresh framing. The map style switched meanwhile: the tilt follows the style.
      const back = spotReturn.current;
      spotReturn.current = null;
      if (back && back.key === head && back.insets === insetKey) {
        cancelAnimationFrame(spin.current);
        ++flightId.current;
        const [pitch, bearing] = back.mode === modeRef.current ? [back.cam.pitch, back.cam.bearing] : tiltOf(back.tilt, modeRef.current === '3d');
        const cam = { ...back.cam, pitch, bearing };
        noteFrame(map);
        if (prefersReducedMotion()) map.jumpTo(cam);
        else map.flyTo({ ...cam, duration: 1200, essential: true, curve: 1.5 });
        return;
      }
    }
    // Still on the frame a run of reveals left the camera on: a new free area pans by half the change
    // (as below) at most, never framing it. A new key is a place picked afresh: it frames.
    const quiet = quietKey.current !== null && quietKey.current === head;
    if (!quiet) quietKey.current = null;
    // A spot is centred in the free area by definition: a new free area (the phone's card measured)
    // re-centres it, below, rather than panning by half the change.
    if (quiet || (onlyInsets && panOnInsets && focus?.kind !== 'spot' && !stillFramed(map))) {
      if (!panOnInsets) return;
      // The free area's centre moves by half the change; the view follows it, gently.
      const dx = (insets.right - was.right - (insets.left - was.left)) / 2;
      const dy = (insets.bottom - was.bottom - (insets.top - was.top)) / 2;
      map.panBy([dx, dy], { duration: prefersReducedMotion() ? 0 : 450, essential: true });
      return;
    }
    // Framing afresh: cameraForBounds measures inside the map's own padding as well as ours, and a
    // spot leaves the insets there, as does a flight back from one that this framing cuts short (a
    // crumb right after leaving a spot). Drop it without moving the view, before listening for the
    // framing's own moveend. (From the globe, which pads too, the framing stays as it was.)
    const pad = map.getPadding();
    if (focus?.kind !== 'spot' && target.level !== 'world' && !wasKey.startsWith('world:') && (pad.top || pad.right || pad.bottom || pad.left)) {
      const box = map.getContainer();
      map.jumpTo({ padding: NO_PAD, center: map.unproject([box.clientWidth / 2, box.clientHeight / 2]) });
    }
    // Listening first: under reduced motion the camera jumps, and its moveend comes at once.
    noteFrame(map);
    flyToTarget(first ? 2600 : onlyInsets ? 500 : undefined, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camKey, ready]);

  function padding() {
    const W = wrap.current!.clientWidth;
    const H = wrap.current!.clientHeight;
    const side = Math.min(70, W * 0.08);
    return fitPadding({ top: insets.top + 56, bottom: insets.bottom + 12, left: insets.left + side, right: insets.right + side }, W, H);
  }

  /**
   * A spot opened by `reveal`: the camera keeps its zoom, tilt and centre, and pans only as far as it
   * takes to bring the spot and its name pill inside the free area the insets leave (by
   * REVEAL_MARGIN) and clear of the card (pickedClearOf, by REVEAL_CARD_GAP). Where the card overlaps
   * the free area, the spot goes beside, above or below it, whichever is the shortest pan. After any
   * move in progress (a flight, a drag) has ended.
   */
  function revealSpot(id: string, center: [number, number]) {
    const map = mapRef.current;
    if (!map) return;
    cancelAnimationFrame(spin.current);
    const flight = ++flightId.current;
    const reveal = () => {
      const box = wrap.current;
      if (flight !== flightId.current || !box) return;
      const W = box.clientWidth;
      const H = box.clientHeight;
      const ins = insetsRef.current;
      // How far the spot reaches from its point: a dot's name pill sits centred above it, with its
      // tail down to the point (styles.css, .mdot.is-spot), measured by layout so a transition in
      // flight doesn't count; a ticker's pill and tail above its point, as the ticker reveal above.
      const pill = dotModeRef.current ? overlay.current?.querySelector<HTMLElement>(`.mdot[data-id="${CSS.escape(id)}"] .mdot-label`) : null;
      const [hw, up, down] = !dotModeRef.current ? [70, 52, 0] : pill?.offsetWidth ? [pill.offsetWidth / 2, pill.offsetHeight + 6, 6] : [96, 36, 6];
      const M = REVEAL_MARGIN;
      const free = { left: ins.left + hw + M, top: ins.top + up + M, right: W - ins.right - hw - M, bottom: H - ins.bottom - down - M };
      let areas = [free];
      const cardEl = pickedClearOf?.current;
      if (cardEl) {
        // Where the card rests, without the slide it comes in with, grown by the pill and the gap.
        const r = cardEl.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        const tf = getComputedStyle(cardEl).transform;
        const t = new DOMMatrixReadOnly(tf === 'none' ? undefined : tf);
        const g = REVEAL_CARD_GAP;
        const x = r.left - b.left - t.m41;
        const y = r.top - b.top - t.m42;
        const c = { left: x - hw - g, right: x + r.width + hw + g, top: y - down - g, bottom: y + r.height + up + g };
        const over = r.width > 0 && c.left < free.right && c.right > free.left && c.top < free.bottom && c.bottom > free.top;
        if (over) {
          const beside = [
            { ...free, right: Math.min(free.right, c.left) },
            { ...free, left: Math.max(free.left, c.right) },
            { ...free, bottom: Math.min(free.bottom, c.top) },
            { ...free, top: Math.max(free.top, c.bottom) },
          ].filter((a) => a.right >= a.left && a.bottom >= a.top);
          if (beside.length) areas = beside;
        }
      }
      // The margins are in the areas already.
      const pt = map.project(center);
      const pans = areas.map((a) => revealDelta([pt.x, pt.y], a, 0));
      const [dx, dy] = pans.reduce((best, d) => (Math.hypot(...d) < Math.hypot(...best) ? d : best));
      if (Math.hypot(dx, dy) < 1) return;
      // The spot itself to its new point: exact under a tilt too, where panBy moves the centre, not it.
      const pad = { ...NO_PAD, ...map.getPadding() };
      const cx = pad.left + (W - pad.left - pad.right) / 2;
      const cy = pad.top + (H - pad.top - pad.bottom) / 2;
      // Listening first: under reduced motion the camera jumps, and its moveend comes at once.
      const ease = {};
      revealEase.current = ease;
      map.once('moveend', () => {
        if (revealEase.current === ease) revealEase.current = null;
      });
      map.easeTo({ center, offset: [pt.x + dx - cx, pt.y + dy - cy], duration: prefersReducedMotion() ? 0 : 600, essential: true });
    };
    if (map.isMoving()) map.once('moveend', reveal);
    else reveal();
  }

  /** Tells the lists that follow the map what its free area shows now (onViewQuad). */
  function reportQuad(map: MapLibreMap) {
    const report = handlers.current.onViewQuad;
    if (!report) return;
    const box = map.getContainer();
    report(viewQuad(box.clientWidth, box.clientHeight, insetsRef.current, (p) => map.unproject(p).toArray() as [number, number]));
  }

  function flyToTarget(duration?: number, all = false, tilt = tilted) {
    const map = mapRef.current;
    if (!map) return;
    cancelAnimationFrame(spin.current);
    // A newer flight cancels this one; its end must not start the spin under the new flight.
    const flight = ++flightId.current;
    const reduced = prefersReducedMotion();
    const go = (cam: Cam) => {
      if (reduced) map.jumpTo(cam);
      else map.flyTo({ ...cam, duration: duration ?? 1800, essential: true, curve: 1.5 });
    };
    const t = target;
    if (t.level === 'world') {
      paused.current = false;
      // Size the globe to the free area beside the title card, and keep it centred there.
      const box = map.getContainer();
      const free = Math.min(box.clientWidth - insets.left - insets.right, box.clientHeight - insets.top - insets.bottom);
      const zoom = Math.max(0.3, Math.min(2.3, Math.log2(Math.max(free, 120) / 200)));
      const c = map.getCenter();
      const from = firstWorld.current ? [125, 22] : [c.lng, Math.max(-10, Math.min(40, c.lat))];
      go({ center: from as [number, number], zoom, pitch: 0, bearing: 0, padding: { ...insets } });
      firstWorld.current = false;
      map.once('moveend', () => {
        if (flight !== flightId.current || levelRef.current !== 'world' || !tourRef.current || paused.current) return;
        startSpin();
        // The first visit tours straight away; coming back, it waits a moment.
        if (!touringRef.current) resumeLater(toured.current ? RESUME_MS : 0);
      });
      return;
    }
    const f = focus;
    if (f?.kind === 'spot') {
      // Flat and north-up, the spot centred in the free area, close in but stepped out (to a floor)
      // until its neighbours are in view too.
      const W = wrap.current!.clientWidth;
      const H = wrap.current!.clientHeight;
      const near = f.near.map((id) => pins.find((a) => a.id === id)?.lonlat).filter((ll): ll is [number, number] => !!ll);
      const free = { w: W - insets.left - insets.right, h: H - insets.top - insets.bottom };
      go({ center: f.center, zoom: spotFitZoom(f.center, near, free, spotZoom(W)), pitch: 0, bearing: 0, padding: { ...insets } });
      return;
    }
    let bounds: LngLatBoundsLike | null = null;
    let pitch = 0;
    let bearing = 0;
    let maxZoom = 16;
    if (f?.kind === 'frame') {
      // A neighbourhood pins all of Tokyo: "Fit all" takes every pin in, not just the neighbourhood.
      bounds = all && pins.length ? boundsOf(pins.map((a) => a.lonlat)) : f.bounds;
      [pitch, bearing] = tiltOf('close', tilt);
    } else if (t.level === 'country' && t.country) {
      if (t.country.id === JAPAN_ID) {
        bounds = (focusPrefs?.length && (regionBounds(focusPrefs) as LngLatBoundsLike | null)) || JAPAN_BOUNDS;
        maxZoom = focusPrefs?.length ? 7.5 : 6;
      } else {
        const [[w, s], [e, n]] = geoBounds(t.country);
        if (e <= w) {
          // Shapes across the date line just get centred.
          go({ center: [(w + e + 360) / 2, (s + n) / 2], zoom: 2.4, pitch: 0, bearing: 0, padding: NO_PAD });
          return;
        }
        bounds = [
          [w, s],
          [e, n],
        ];
        maxZoom = 6;
      }
    } else if (t.level === 'region' && frameBubbles) {
      // Count bubbles: their main cluster, leaving far ones (Takao, an hour west) at or past the edge,
      // so the city's middle gets the room its labels need. "Fit all" takes them all in.
      bounds = boundsOf((all ? frameBubbles : coreCluster(frameBubbles, (b) => b.ll)).map((b) => b.ll));
      [pitch, bearing] = tiltOf('wide', tilt);
      maxZoom = 15;
    } else if (t.level === 'region') {
      const list = fitList && fitList.length ? (all ? fitList : corePins(fitList)) : null;
      bounds = list
        ? boundsOf(list.map((a) => a.lonlat))
        : (geoBounds({ type: 'FeatureCollection', features: TOKYO_AREAS.filter((a) => Number(a.id) < 13300) }) as LngLatBoundsLike);
      [pitch, bearing] = tiltOf('wide', tilt);
      maxZoom = 15;
    } else if (t.level === 'area' && t.area) {
      bounds = geoBounds(t.area) as LngLatBoundsLike;
      [pitch, bearing] = tiltOf('close', tilt);
      maxZoom = 15.5;
    }
    if (!bounds) return;
    // Frame with the final tilt and turn so the places land inside the free area.
    const cam = map.cameraForBounds(bounds, { padding: padding(), maxZoom, pitch, bearing });
    if (!cam || cam.zoom == null || !cam.center) return;
    // Ticker labels are wider than the points they mark; on narrow maps step back a little.
    // Only where there are tickers: a country or a framed region needs every pixel it has.
    const narrow = wrap.current!.clientWidth < 700 && (t.level === 'region' || t.level === 'area');
    go({ center: cam.center as Cam['center'], zoom: cam.zoom - (narrow ? 0.45 : 0), pitch, bearing, padding: NO_PAD });
  }

  function startSpin() {
    const map = mapRef.current;
    if (!map || prefersReducedMotion()) return;
    cancelAnimationFrame(spin.current);
    const step = () => {
      if (levelRef.current !== 'world' || !mapRef.current || paused.current) return;
      const c = map.getCenter();
      map.setCenter([c.lng + SPIN_DEG_PER_FRAME, c.lat]);
      spin.current = requestAnimationFrame(step);
    };
    spin.current = requestAnimationFrame(step);
  }

  // ---- Clicks and hovers on our shapes ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    type Ev = { features?: MapGeoJSONFeature[]; point: { x: number; y: number } };
    const setHover = (f: MapGeoJSONFeature | null, source: string) => {
      const was = hovered.current;
      if (was) map.setFeatureState(was, { hover: false });
      // While a list drives the lighting, the map's own single-shape hover stands aside.
      const taken = (source === 'fl-prefs' && !!hotPrefsRef.current.length) || (source === 'fl-areas' && !!hotAreaRef.current);
      const next = f && f.id != null && !taken ? { source, id: Number(f.id) } : null;
      hovered.current = next;
      if (next) map.setFeatureState(next, { hover: true });
    };
    const showTip = (e: Ev, title: string, sub: string, pointer: boolean) => {
      map.getCanvas().style.cursor = pointer ? 'pointer' : '';
      const t = tip.current;
      if (!t) return;
      t.firstElementChild!.textContent = title;
      t.lastElementChild!.textContent = sub;
      t.style.transform = `translate3d(${e.point.x + 14}px, ${e.point.y + 14}px, 0)`;
      t.dataset.on = '1';
    };
    const leave = () => {
      setHover(null, '');
      handlers.current.onPrefHover?.(null);
      handlers.current.onAreaHover?.(null);
      if (tip.current) tip.current.dataset.on = '';
      map.getCanvas().style.cursor = '';
    };

    const onWorldMove = (e: Ev) => {
      const f = e.features?.[0];
      if (!f) return;
      setHover(f, 'fl-world');
      const d = destinationByWorldId(f.properties.fid);
      showTip(e, f.properties.name, d?.live ? `Tokyo: ${ATTRACTIONS.length} attractions checked` : d ? 'Coming soon' : 'No attractions yet', true);
    };
    const onPrefMove = (e: Ev) => {
      const f = e.features?.[0];
      if (!f) return;
      handlers.current.onPrefHover?.(Number(f.id));
      setHover(f, 'fl-prefs');
      const isTokyo = f.properties.fid === TOKYO_PREF_ID;
      showTip(e, f.properties.name, isTokyo ? `${ATTRACTIONS.length} attractions checked` : 'Not mapped yet', true);
    };
    const onAreaMove = (e: Ev) => {
      const f = e.features?.[0];
      if (!f) return;
      handlers.current.onAreaHover?.(f.properties.fid);
      setHover(f, 'fl-areas');
      const n = AREA_COUNTS[f.properties.fid] ?? 0;
      showTip(e, `${f.properties.name} ${f.properties.ja}`, n ? `${n} attraction${n > 1 ? 's' : ''}` : 'Nothing checked yet', n > 0);
    };
    const onWorldClick = (e: Ev) => {
      const f = e.features?.[0];
      if (!f || levelRef.current !== 'world') return;
      const pick = handlers.current.onWorldPick;
      if (pick) pick(f.properties.fid);
      else handlers.current.onCountry(slug(f.properties.name));
    };
    const onPrefClick = (e: Ev) => {
      const f = e.features?.[0];
      if (!f) return;
      const pick = handlers.current.onPrefPick;
      if (pick) pick(Number(f.id));
      else if (f.properties.fid === TOKYO_PREF_ID) handlers.current.onRegion();
      else handlers.current.onNotice(`${f.properties.name} isn’t mapped yet. Tokyo is the first prefecture with checked attractions.`);
    };
    const onAreaClick = (e: Ev) => {
      const f = e.features?.[0];
      if (!f) return;
      if (AREA_COUNTS[f.properties.fid]) handlers.current.onArea(slug(f.properties.name));
      else handlers.current.onNotice(`No attractions checked in ${f.properties.name} yet.`);
    };

    const bind: [string, string, (e: Ev) => void][] = [
      ['mousemove', 'fl-world-fill', onWorldMove],
      ['mouseleave', 'fl-world-fill', leave],
      ['click', 'fl-world-fill', onWorldClick],
      ['mousemove', 'fl-pref-fill', onPrefMove],
      ['mouseleave', 'fl-pref-fill', leave],
      ['click', 'fl-pref-fill', onPrefClick],
      ['mousemove', 'fl-area-fill', onAreaMove],
      ['mouseleave', 'fl-area-fill', leave],
      ['click', 'fl-area-fill', onAreaClick],
    ];
    const m = map as unknown as { on: (t: string, l: string, f: (e: Ev) => void) => void; off: (t: string, l: string, f: (e: Ev) => void) => void };
    bind.forEach(([type, layer, fn]) => m.on(type, layer, fn));
    return () => bind.forEach(([type, layer, fn]) => m.off(type, layer, fn));
  }, [ready]);

  // ---- Controls ----
  const zoomBy = (d: number) => {
    const map = mapRef.current;
    if (!map) return;
    cancelAnimationFrame(spin.current);
    map.easeTo({ zoom: map.getZoom() + d, duration: prefersReducedMotion() ? 0 : 400 });
  };
  // Map or 3D: the look switches in place, and the camera tilts or levels out when pins are showing.
  const appliedMode = useRef<typeof mode | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyMode(map, mode);
    if (map.getLayer('fl-area-fill')) map.setPaintProperty('fl-area-fill', 'fill-opacity', areaFillOpacity(mode) as never);
    const first = appliedMode.current === null;
    const changed = appliedMode.current !== mode;
    appliedMode.current = mode;
    if (first || !changed) return;
    if (levelRef.current !== 'region' && levelRef.current !== 'area') return;
    // A spot stays flat and north-up, unless it was only revealed: then the camera is still the
    // place's, and tilts as the place the run started from does.
    const f = focusRef.current;
    const run = spotRun.current;
    if (f?.kind === 'spot' && (!run || run.flew)) return;
    // The same tilt a framing here takes, so switching and framing agree.
    const kind = f?.kind === 'spot' && run ? run.tilt : tiltKind(f?.kind === 'frame', levelRef.current);
    const [pitch, bearing] = tiltOf(kind, mode === '3d');
    map.easeTo({ pitch, bearing, duration: prefersReducedMotion() ? 0 : 900 });
  }, [mode, ready]);
  const refit = () => flyToTarget(900, true);

  // ---- What the free area shows, in lon/lat, for lists that follow the map ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const emit = () => reportQuad(map);
    emit();
    map.on('moveend', emit);
    return () => {
      map.off('moveend', emit);
    };
  }, [ready]);

  const level = target.level;
  const showPins = level === 'region' || level === 'area';
  // Trip planning passes pins at country level too (Japan or one of its regions covers Tokyo).
  const showTickers = showPins || (level === 'country' && pins.length > 0);
  const RANK = { good: 1, ok: 2, poor: 3 } as const;
  const placeName = target.area?.properties.name ?? (level === 'world' ? 'the world' : level === 'region' ? 'Tokyo' : target.country?.properties.name);

  return (
    <div ref={wrap} className={`map ${ready ? 'is-ready' : ''}`} data-level={level}>
      <div ref={canvasBox} className="map-canvas" role="region" aria-label={`Map of ${placeName}`} />

      <div ref={overlay} className="map-overlay">
        {level === 'world' && tour && (
          <button type="button" className="livepin" data-flip="" data-ll={TOKYO_LL.join(',')} onClick={() => handlers.current.onRegion()} aria-label={`Tokyo, live: ${plural(ATTRACTIONS.length, 'attraction')} checked. Fly in`}>
            <span className="livepin-photo" aria-hidden="true">
              <img src={photo('shibuya-sky')} alt="" draggable={false} />
            </span>
            <span className="livepin-label" aria-hidden="true">
              Tokyo
              <span className="livepin-live">Live</span>
            </span>
          </button>
        )}
        {showTickers &&
          dotMode &&
          pins.map((a, i) => {
            const m = markerOf(dots, a.id);
            const grouped = m.kind === 'today' && stopGroups.some((g) => g.ids.includes(a.id));
            const raised = selectedId === a.id || hoverId === a.id;
            // With a spot: the spot itself as a name pill, its neighbours always labelled, the rest small and grey.
            const near = spot ? spot.near.indexOf(a.id) : -1;
            const lit = !spot ? '' : a.id === spot.id ? 'is-spot' : near >= 0 ? 'is-near' : 'is-far';
            // Raised first, then the spot's neighbours nearest first, today's stops in route order, other days', the rest.
            const prio = raised ? 0 : near >= 0 ? 0.1 + near / 1000 : m.kind === 'today' ? 0.2 + m.n / 1000 : m.kind === 'other' ? 0.5 + i / 10000 : 1 + i / 100;
            return (
              <button
                key={a.id}
                type="button"
                className={`mdot is-${m.kind} ${lit} ${hoverId === a.id ? 'is-hot' : ''} ${selectedId === a.id ? 'is-picked' : ''} ${grouped ? 'is-grouped' : ''}`}
                data-id={a.id}
                data-ll={a.lonlat.join(',')}
                data-prio={prio}
                data-tier={m.kind === 'today' ? 'today' : 'rest'}
                style={{ ['--i' as string]: i }}
                onPointerEnter={() => props.onHover(a.id)}
                onPointerLeave={() => props.onHover(null)}
                onFocus={() => props.onHover(a.id)}
                onBlur={() => props.onHover(null)}
                onClick={() => props.onAttraction(a.id)}
                aria-label={markerName(a, m)}
              >
                <span className="mdot-mark num" aria-hidden="true">
                  {m.kind === 'today' ? m.n : null}
                </span>
                <span className="mdot-label" aria-hidden="true">
                  <span className="mdot-name">{a.name}</span>
                  <span className="mdot-value num">{readings(a).cost}</span>
                </span>
              </button>
            );
          })}
        {showTickers &&
          dotMode &&
          stopGroups.map((g) => {
            // Numbers come from the current markers, so a stop moved or removed elsewhere renumbers the pill.
            const members = g.ids
              .map((id) => ({ a: pins.find((x) => x.id === id), m: markerOf(dots, id) }))
              .flatMap(({ a, m }) => (a && m.kind === 'today' ? [{ a, n: m.n, day: m.day }] : []))
              .sort((x, y) => x.n - y.n);
            if (members.length < 2) return null;
            const ns = members.map((x) => x.n);
            const day = members[0].day;
            const ll = [0, 1].map((k) => members.reduce((t, x) => t + x.a.lonlat[k], 0) / members.length);
            const key = g.ids.join('+');
            const picking = pickGroup === key;
            const raised = picking || hotGroup === key || g.ids.some((id) => id === hoverId || id === selectedId);
            return (
              <div
                key={key}
                className={`mdot mgroup is-today ${raised ? 'is-hot' : ''} ${picking ? 'is-picking' : ''}`}
                data-ll={ll.join(',')}
                data-prio={raised ? 0 : 0.1}
                data-tier="group"
                onPointerEnter={() => setHotGroup(key)}
                onPointerLeave={(e) => {
                  // A finger "leaves" as it lifts; only a mouse leaving closes the list.
                  if (e.pointerType !== 'mouse') return;
                  setHotGroup(null);
                  setPickGroup(null);
                }}
                onFocus={() => setHotGroup(key)}
                onBlur={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                  setHotGroup(null);
                  setPickGroup(null);
                }}
              >
                <button
                  type="button"
                  className="mgroup-mark num"
                  onClick={(e) => splitGroup(key, g.ids, e.detail === 0)}
                  aria-expanded={picking}
                  aria-label={`${groupName(day, ns, members.map((x) => x.a.name))}. ${picking ? 'Pick one' : 'Zoom in'}`}
                >
                  {stopRun(ns)}
                </button>
                <span className="mdot-label mgroup-label" aria-hidden={!picking}>
                  {members.map(({ a, n }) =>
                    picking ? (
                      <button key={a.id} type="button" className="mgroup-row" onClick={() => props.onAttraction(a.id)}>
                        <span className="mgroup-n num">{n}</span>
                        <span className="mdot-name">{a.name}</span>
                      </button>
                    ) : (
                      <span key={a.id} className={`mgroup-row ${a.id === hoverId || a.id === selectedId ? 'is-hot' : ''}`}>
                        <span className="mgroup-n num">{n}</span>
                        <span className="mdot-name">{a.name}</span>
                      </span>
                    ),
                  )}
                </span>
              </div>
            );
          })}
        {showTickers &&
          !dotMode &&
          pins.map((a, i) => {
            const rating = lensRating(a, lens);
            const raised = selectedId === a.id || hoverId === a.id;
            const tone = tones?.[a.id];
            // Toned tickers (a trip's stops) rank between the raised one and the rest: today's first.
            const prio = raised ? 0 : tone ? (tone === 'today' ? 0.2 : 0.5) + i / 10000 : (rating ? RANK[rating] : 2) + i / 100;
            return (
              <button
                key={a.id}
                type="button"
                className={`ticker ${rating ? `is-${rating}` : ''} ${tone ? `is-${tone}` : ''} ${hoverId === a.id ? 'is-hot' : ''} ${selectedId === a.id ? 'is-picked' : ''}`}
                data-ll={a.lonlat.join(',')}
                data-prio={prio}
                style={{ ['--i' as string]: i }}
                onPointerEnter={() => props.onHover(a.id)}
                onPointerLeave={() => props.onHover(null)}
                onFocus={() => props.onHover(a.id)}
                onBlur={() => props.onHover(null)}
                onClick={() => props.onAttraction(a.id)}
                aria-label={`${a.name}, ${readings(a).cost}. Show card`}
              >
                <span className="ticker-pill">
                  <img src={photo(a.id)} alt="" loading="lazy" draggable={false} />
                  <span className="ticker-label">
                    <span className="ticker-name">{a.name}</span>
                    <span className="ticker-value num">{readings(a).cost}</span>
                  </span>
                </span>
              </button>
            );
          })}
        {bubbles?.map((b, i) => (
          <button
            key={b.id}
            type="button"
            className={`mbubble ${b.count ? 'is-live' : ''}`}
            data-ll={b.ll.join(',')}
            // Places with checked attractions keep their labels first when bubbles crowd.
            data-prio={(b.count ? 0.5 : 1) + i / 100}
            data-label={b.label}
            style={{ ['--i' as string]: i }}
            onClick={b.onPick}
            aria-label={`${b.label}: ${b.count ? `${plural(b.count, 'checked attraction')}` : 'coming soon'}. Show`}
          >
            <span className="mbubble-pill" aria-hidden="true">
              <span className="mbubble-name">{b.label}</span>
              <span className="mbubble-count num">
                <span className="mbubble-sep">· </span>
                {b.count || 'coming soon'}
              </span>
              {/* "+N": bubbles folded into this one where there was no room to draw them (layoutBubbles). */}
              <span className="mbubble-more num" />
            </span>
          </button>
        ))}
      </div>

      <svg ref={tether} className="globe-tether" aria-hidden="true">
        <line />
        <circle r="5" />
      </svg>
      <GlobeCard
        ref={card}
        dest={cardDest ?? current}
        mode={tourOn ? 'tour' : 'pinned'}
        onOpen={() => tourDest && handlers.current.onCountry(countrySlugOf(tourDest))}
        onTokyo={() => handlers.current.onRegion()}
      />

      <div className="map-controls" role="group" aria-label="Map controls">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in">
          <Icon name="plus" size={18} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out">
          <Icon name="minus" size={18} />
        </button>
        {showPins && (
          <>
            <div className="map-mode" role="group" aria-label="Map style">
              <button type="button" onClick={() => setMode('map')} aria-pressed={!tilted}>
                Map
              </button>
              <button type="button" onClick={() => setMode('3d')} aria-pressed={tilted}>
                3D
              </button>
            </div>
            <button type="button" onClick={refit} aria-label="Fit all attractions">
              <Icon name="target" size={18} />
            </button>
          </>
        )}
      </div>

      {showPins && offscreenPill && (
        <button ref={offscreen} type="button" className="map-offscreen" onClick={refit}>
          <span />
          <Icon name="zoomOut" size={15} />
        </button>
      )}

      {!ready && !failed && <div className="map-loading" aria-hidden="true" />}
      {failed && (
        <div className="map-failed" role="status">
          The map couldn’t load. Check your connection and refresh the page.
        </div>
      )}

      <div ref={tip} className="map-tip" aria-hidden="true">
        <strong />
        <span />
      </div>
    </div>
  );
}

export default MapExplorer;

/**
 * The ward tint. In 3D it is as it always was. In Map mode it fades to a quarter from zoom 11.5 to 13.5, so streets,
 * parks and water keep their own colours (zoom may only drive a top-level interpolate, so the cases sit inside its stops).
 */
function areaFillOpacity(mode: MapMode) {
  const hover = ['boolean', ['feature-state', 'hover'], false];
  const base = [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    0.16,
    hover,
    ['case', ['>', ['get', 'count'], 0], 0.18, 0.05],
    ['>', ['get', 'count'], 0],
    0.08,
    0,
  ];
  return mode === '3d' ? base : ['interpolate', ['linear'], ['zoom'], 11.5, base, 13.5, ['*', base, 0.25]];
}

/** Countries, prefectures and Tokyo's wards, drawn over the base map so they can be hovered and clicked. */
function addOurLayers(map: MapLibreMap, mode: MapMode) {
  const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addSource('fl-world', { type: 'geojson', data: collection(WORLD, (_, i) => i + 1) });
  map.addSource('fl-prefs', { type: 'geojson', data: collection(PREFECTURES, (f) => Number(f.id)) });
  map.addSource('fl-areas', { type: 'geojson', data: collection(TOKYO_AREAS, (f) => Number(f.id), (id) => ({ count: AREA_COUNTS[id] ?? 0 })) });
  map.addSource('fl-dest', { type: 'geojson', data: DEST_SHAPES });
  const hover = ['boolean', ['feature-state', 'hover'], false];
  const lit = ['boolean', ['feature-state', 'current'], false];
  // A country picked for a trip, and planning mode (countries are being picked, all tinted alike).
  const picked = ['boolean', ['feature-state', 'picked'], false];
  const plan = ['boolean', ['feature-state', 'plan'], false];
  // A region of Japan the list has opened: its prefectures stay lit while the camera holds them.
  const focus = ['boolean', ['feature-state', 'focus'], false];

  map.addLayer(
    {
      id: 'fl-world-fill',
      type: 'fill',
      source: 'fl-world',
      paint: {
        'fill-color': ['case', picked, C.cedar, C.ink] as never,
        // Picked countries match picked destinations (0.75).
        'fill-opacity': ['case', picked, ['case', hover, 0.83, 0.75], hover, 0.08, 0] as never,
      },
    },
    firstSymbol,
  );
  // Destinations are tinted on the globe (Japan, which is live, stronger, except in planning mode);
  // the one on tour is lit. The tint fades as the camera comes down to a country.
  map.addLayer(
    {
      id: 'fl-dest-fill',
      type: 'fill',
      source: 'fl-dest',
      paint: {
        'fill-color': C.cedar,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 2.8, ['case', lit, 0.9, picked, 0.75, plan, 0.3, ['get', 'live'], 0.6, 0.3], 4.4, ['case', picked, 0.75, lit, 0.28, 0]] as never,
        'fill-opacity-transition': { duration: 600 },
      },
    },
    firstSymbol,
  );
  map.addLayer(
    {
      id: 'fl-dest-line',
      type: 'line',
      source: 'fl-dest',
      paint: {
        'line-color': C.cedar,
        'line-width': ['case', lit, 1.8, 0.6] as never,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 2.8, 0.8, 4.4, ['case', lit, 0.8, 0]] as never,
      },
    },
    firstSymbol,
  );
  map.addLayer(
    {
      id: 'fl-pref-fill',
      type: 'fill',
      source: 'fl-prefs',
      paint: {
        'fill-color': ['case', ['==', ['get', 'fid'], TOKYO_PREF_ID], C.cedar, ['any', hover, focus], C.cedar, C.ink] as never,
        // Zoomed in on Tokyo from the country view (a trip planned at Japan level), the solid fill
        // thins out so the tickers, a trip's coloured stops among them, stay readable on it.
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6.5,
          ['case', ['==', ['get', 'fid'], TOKYO_PREF_ID], ['case', hover, 0.85, 0.7], hover, 0.3, focus, 0.18, 0],
          8.5,
          ['case', ['==', ['get', 'fid'], TOKYO_PREF_ID], ['case', hover, 0.2, 0.12], hover, 0.15, focus, 0.1, 0],
        ] as never,
        'fill-opacity-transition': { duration: 180 },
      },
    },
    firstSymbol,
  );
  map.addLayer(
    {
      id: 'fl-pref-line',
      type: 'line',
      source: 'fl-prefs',
      paint: {
        'line-color': ['case', ['any', hover, focus], C.cedar, '#8fa3ad'] as never,
        // Zoom may only drive a top-level interpolate, so the hover case sits inside its stops.
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, ['case', ['any', hover, focus], 1.4, 0.5], 9, ['case', ['any', hover, focus], 1.4, 1]] as never,
        'line-opacity': 0.6,
      },
    },
    firstSymbol,
  );
  map.addLayer(
    {
      id: 'fl-area-fill',
      type: 'fill',
      source: 'fl-areas',
      paint: {
        'fill-color': C.cedar,
        'fill-opacity': areaFillOpacity(mode) as never,
      },
    },
    map.getLayer('fl-buildings') ? 'fl-buildings' : firstSymbol,
  );
  map.addLayer(
    {
      id: 'fl-area-line',
      type: 'line',
      source: 'fl-areas',
      paint: {
        'line-color': ['case', ['>', ['get', 'count'], 0], C.cedar, '#8fa3ad'],
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, ['>', ['get', 'count'], 0], 1.4, 0.6] as never,
        'line-opacity': ['case', ['>', ['get', 'count'], 0], 0.7, 0.5],
      },
    },
    firstSymbol,
  );
}

/**
 * Tickers that would overlap fold down to a photo dot, highest priority first
 * (the hovered or picked one, then the best fit for the weather lens). As you
 * zoom in and space opens up, their labels come back.
 */
function layoutTickers(list: { el: HTMLElement; sx: number; sy: number }[]) {
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const t of list) {
    if (!t.el.dataset.w) {
      const pill = t.el.querySelector<HTMLElement>('.ticker-pill');
      if (!pill) continue;
      t.el.classList.add('is-measuring');
      t.el.dataset.w = String(pill.offsetWidth);
      t.el.dataset.h = String(pill.offsetHeight);
      t.el.classList.remove('is-measuring');
    }
  }
  const ordered = [...list].sort((a, b) => Number(a.el.dataset.prio) - Number(b.el.dataset.prio));
  const hits = (b: { x0: number; x1: number; y0: number; y1: number }) =>
    placed.some((p) => !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1));
  for (const t of ordered) {
    const w = Number(t.el.dataset.w);
    const h = Number(t.el.dataset.h);
    const full = { x0: t.sx - w / 2 - 4, x1: t.sx + w / 2 + 4, y0: t.sy - h - 12, y1: t.sy };
    const raised = t.el.dataset.prio === '0';
    if (raised || !hits(full)) {
      t.el.classList.remove('is-compact');
      placed.push(full);
    } else {
      t.el.classList.add('is-compact');
      placed.push({ x0: t.sx - 20, x1: t.sx + 20, y0: t.sy - 50, y1: t.sy });
    }
  }
}

/** Dot mode: the zooms from which labels show where there's room, today's numbered stops first. */
const DOT_LABEL_ZOOM = { today: 10, rest: 12.5 } as const;

/**
 * Dot mode. Dots never fold or hide; only their labels come and go. The hovered, focused or picked
 * one always has its label; then, highest priority first (today's stops in route order, then the
 * rest), a label shows to the right of its dot, or failing that to the left, when the zoom allows
 * it and it would overlap no dot and no label placed before it. With a spot, its name pill sits
 * above its point and is placed first, its neighbours (`is-near`) always have their label, and the
 * rest (`is-far`) never do.
 */
type Box = { x0: number; x1: number; y0: number; y1: number };

function layoutDots(list: { el: HTMLElement; sx: number; sy: number }[], zoom: number, right: number, bottom: number, avoid: Box[]) {
  // A merged pill's half-width stands in for a dot's radius (it sets --r for its label's offset).
  const radius = (el: HTMLElement) => (el.dataset.mw ? Number(el.dataset.mw) / 2 : el.classList.contains('is-today') ? 11 : 6);
  for (const t of list) {
    // The spot's pill is a bigger label than a dot's: measure again when a dot becomes or stops being the spot.
    const shape = t.el.classList.contains('is-spot') ? 'spot' : '';
    if (t.el.dataset.w && (t.el.dataset.shape ?? '') === shape) continue;
    const label = t.el.querySelector<HTMLElement>('.mdot-label');
    if (!label) continue;
    t.el.dataset.shape = shape;
    t.el.dataset.w = String(label.offsetWidth);
    t.el.dataset.h = String(label.offsetHeight);
    const pill = t.el.querySelector<HTMLElement>('.mgroup-mark');
    if (pill) {
      t.el.dataset.mw = String(pill.offsetWidth);
      t.el.style.setProperty('--r', `${pill.offsetWidth / 2}px`);
    }
  }
  // Every dot is in the way of every label but its own.
  const dotsAt: Box[] = list.map((t) => {
    const r = radius(t.el) + 2;
    const v = t.el.dataset.mw ? 13 : r;
    return { x0: t.sx - r, x1: t.sx + r, y0: t.sy - v, y1: t.sy + v };
  });
  const overlap = (b: Box, p: Box) => !(b.x1 < p.x0 || b.x0 > p.x1 || b.y1 < p.y0 || b.y0 > p.y1);
  // The map's controls count as placed from the start, and so does the spot's pill, centred above its point.
  const placed: Box[] = [...avoid];
  for (const t of list) {
    if (!t.el.classList.contains('is-spot')) continue;
    const w = Number(t.el.dataset.w);
    const h = Number(t.el.dataset.h);
    placed.push({ x0: t.sx - w / 2 - 2, x1: t.sx + w / 2 + 2, y0: t.sy - h - 8, y1: t.sy + 2 });
  }
  const hits = (b: Box, self: number) => placed.some((p) => overlap(b, p)) || dotsAt.some((p, i) => i !== self && overlap(b, p));
  const order = list.map((t, i) => ({ t, i })).sort((a, b) => Number(a.t.el.dataset.prio) - Number(b.t.el.dataset.prio));
  for (const { t, i } of order) {
    const w = Number(t.el.dataset.w);
    const h = Number(t.el.dataset.h);
    const gap = radius(t.el) + 6;
    const toRight: Box = { x0: t.sx + gap - 2, x1: t.sx + gap + w + 2, y0: t.sy - h / 2 - 2, y1: t.sy + h / 2 + 2 };
    const toLeft: Box = { x0: t.sx - gap - w - 2, x1: t.sx - gap + 2, y0: toRight.y0, y1: toRight.y1 };
    const raised = t.el.dataset.prio === '0' || t.el.classList.contains('is-near');
    const tier = t.el.dataset.tier === 'today' ? 'today' : 'rest';
    // The spot's pill is placed above; far dots go unlabelled.
    if (t.el.classList.contains('is-spot') || t.el.classList.contains('is-far')) {
      t.el.classList.remove('is-labelled', 'is-left');
      continue;
    }
    // A pill lists its stops only when raised (and on hover or focus, in CSS).
    if (t.el.dataset.tier === 'group' && !raised) {
      t.el.classList.remove('is-labelled', 'is-left');
      continue;
    }
    // Near the right edge of the free area (a panel can cover the map's right side), left first.
    const sides = toRight.x1 > right - 8 ? [toLeft, toRight] : [toRight, toLeft];
    let pick: Box | null = null;
    // Every label stays inside the free area. A raised one must show: clear of everything if it can
    // be, else over a dot rather than cut off under the panel.
    const inside = (b: Box) => b.x1 <= right && b.x0 >= 0 && b.y0 >= 0 && b.y1 <= bottom;
    if (raised) pick = sides.find((b) => inside(b) && !hits(b, i)) ?? sides.find(inside) ?? sides.find((b) => !hits(b, i)) ?? sides[0];
    else if (zoom >= DOT_LABEL_ZOOM[tier]) pick = sides.find((b) => inside(b) && !hits(b, i)) ?? null;
    t.el.classList.toggle('is-labelled', !!pick);
    t.el.classList.toggle('is-left', pick === toLeft);
    if (pick) placed.push(pick);
  }
}

/**
 * Count bubbles centre on their place, places with checked attractions first (see layoutBubbleBoxes):
 * one that would overlap another moves just above or below its place, then drops its count
 * ("Saitama"), and only then shrinks to a small circle showing its count, nudged off any pill; its full
 * label shows again on hover or focus. One with nowhere clear to go is folded into the bubble it
 * would cover, which shows "+N" (it stays in the tab order and shows on focus). Bubbles keep off the
 * map controls, and a move never takes one out of the free band (the search and level row above,
 * the credit or the phone sheet below, a panel on the right).
 */
function layoutBubbles(list: { el: HTMLElement; sx: number; sy: number }[], band: Band, avoid: BubbleBox[]) {
  for (const b of list) {
    if (b.el.dataset.w) continue;
    const pill = b.el.querySelector<HTMLElement>('.mbubble-pill');
    if (!pill) continue;
    const was = ['is-short', 'is-compact'].filter((c) => b.el.classList.contains(c));
    b.el.classList.add('is-measuring');
    b.el.classList.remove('is-short', 'is-compact');
    b.el.dataset.w = String(pill.offsetWidth);
    b.el.dataset.h = String(pill.offsetHeight);
    b.el.classList.add('is-short');
    b.el.dataset.ws = String(pill.offsetWidth);
    b.el.classList.replace('is-short', 'is-compact');
    b.el.dataset.wc = String(pill.offsetWidth);
    b.el.dataset.hc = String(pill.offsetHeight);
    b.el.classList.remove('is-measuring', 'is-compact');
    b.el.classList.add(...was);
  }
  const n = (el: HTMLElement, k: string) => Number(el.dataset[k]);
  const out = layoutBubbleBoxes(
    list.map((b) => ({ sx: b.sx, sy: b.sy, w: n(b.el, 'w'), h: n(b.el, 'h'), ws: n(b.el, 'ws'), wc: n(b.el, 'wc'), hc: n(b.el, 'hc'), prio: n(b.el, 'prio') })),
    band,
    avoid,
  );
  const more: string[][] = list.map(() => []);
  out.forEach((o, i) => {
    if (o.mode === 'folded') more[o.into].push(list[i].el.dataset.label ?? '');
  });
  list.forEach((b, i) => {
    const o = out[i];
    b.el.classList.toggle('is-short', o.mode === 'short');
    b.el.classList.toggle('is-compact', o.mode === 'compact');
    b.el.classList.toggle('is-folded', o.mode === 'folded');
    b.el.style.setProperty('--dx', `${o.mode === 'folded' ? 0 : o.dx}px`);
    b.el.style.setProperty('--dy', `${o.mode === 'folded' ? 0 : o.dy}px`);
    // Runs on every camera frame: the badge is written only when it changes.
    const badge = b.el.querySelector<HTMLElement>('.mbubble-more');
    const names = more[i];
    const text = names.length ? `+${names.length}` : '';
    const title = names.length ? `${plural(names.length, 'more place')} here (${names.join(', ')}): zoom in to see ${names.length === 1 ? 'it' : 'them'}` : '';
    if (badge && badge.textContent !== text) badge.textContent = text;
    if (badge && badge.title !== title) badge.title = title;
  });
}

export type { Level };
