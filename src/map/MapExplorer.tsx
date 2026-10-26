import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { AttributionControl, Map as MapLibreMap, type LngLatBoundsLike, type MapGeoJSONFeature } from 'maplibre-gl';
import { C, STYLE_URL, restyle } from './style';
import { geoBounds } from 'd3-geo';
import type { Attraction } from '../data/types';
import { ATTRACTIONS } from '../data/attractions';
import { AREA_COUNTS, JAPAN_ID, PREFECTURES, TOKYO_AREAS, TOKYO_PREF_ID, WORLD, slug, type Level, type MapTarget, type Place } from '../data/places';
import { regionBounds } from '../data/regions';
import { prefersReducedMotion } from '../lib/motion';
import { photo } from '../lib/photos';
import { readings } from '../lib/factors';
import { lensRating, type LensId } from '../lib/lens';
import { plural } from '../lib/format';
import { Icon } from '../components/Icon';
import { GlobeCard, type CardSubject } from '../components/GlobeCard';
import { DESTINATIONS, countrySlugOf, destinationByWorldId, destinationBySlug, worldShape, type Destination } from '../data/destinations';
import { fitPadding, type Insets } from './camera';

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

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** The main cluster: pins far from the rest (a mountain an hour out of town) are left for the "outside the view" pill. */
function corePins(pins: Attraction[]) {
  if (pins.length < 6) return pins;
  const cx = median(pins.map((a) => a.lonlat[0]));
  const cy = median(pins.map((a) => a.lonlat[1]));
  const d = pins.map((a) => Math.hypot(a.lonlat[0] - cx, a.lonlat[1] - cy));
  const limit = Math.max(median(d) * 2.6, 0.05);
  return pins.filter((_, i) => d[i] <= limit);
}

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
  /** Laptop: a panel over the map's right side (Japan's region list) that the card must stay clear of. */
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
}

type Pad = { top: number; right: number; bottom: number; left: number };
type Cam = { center: [number, number] | { lng: number; lat: number }; zoom: number; pitch: number; bearing: number; padding?: Pad };
const NO_PAD: Pad = { top: 0, right: 0, bottom: 0, left: 0 };

export function MapExplorer(props: Props) {
  const {
    target,
    insets,
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
  } = props;
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
  const [tilted, setTilted] = useState(true);
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
  const toneKey = tones ? Object.entries(tones).map(([id, t]) => `${id}:${t}`).sort().join(',') : '';

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
      restyle(map);
      addOurLayers(map);
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
    el.querySelectorAll<HTMLElement>('[data-ll]').forEach((node) => {
      const [lng, lat] = node.dataset.ll!.split(',').map(Number);
      const p = map.project([lng, lat]);
      node.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      if (node.dataset.flip !== undefined) node.classList.toggle('is-flipped', p.x > W - 140);
      if (node.classList.contains('ticker')) tickers.push({ el: node, sx: p.x, sy: p.y });
    });
    layoutTickers(tickers);
    const off = tickers.filter((t) => t.sx < 0 || t.sx > W || t.sy < 0 || t.sy > H).length;
    if (offscreen.current) {
      offscreen.current.dataset.on = off ? '1' : '';
      offscreen.current.firstElementChild!.textContent = off === 1 ? '1 place outside the view' : `${off} places outside the view`;
    }
    placeCard(map, W, H);
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
  }, [pins, target.level, target.area?.id, hoverId, selectedId, lens, ready, cardBottom, toneKey]);

  // Ticker widths change once the web fonts arrive: measure again.
  useEffect(() => {
    document.fonts?.ready.then(() => {
      overlay.current?.querySelectorAll<HTMLElement>('.ticker').forEach((t) => delete t.dataset.w);
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
  const insetKey = `${insets.top},${insets.right},${insets.bottom},${insets.left}`;
  const camKey = `${target.level}:${target.country?.id}:${target.area?.id}:${fitKey}:${focusKey}|${insetKey}`;
  const lastKey = useRef('');

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || camKey === lastKey.current) return;
    const first = lastKey.current === '';
    const onlyInsets = !first && lastKey.current.split('|')[0] === camKey.split('|')[0];
    lastKey.current = camKey;
    flyToTarget(first ? 2600 : onlyInsets ? 500 : undefined, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camKey, ready]);

  function padding() {
    const W = wrap.current!.clientWidth;
    const H = wrap.current!.clientHeight;
    const side = Math.min(70, W * 0.08);
    return fitPadding({ top: insets.top + 56, bottom: insets.bottom + 12, left: insets.left + side, right: insets.right + side }, W, H);
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
    let bounds: LngLatBoundsLike | null = null;
    let pitch = 0;
    let bearing = 0;
    let maxZoom = 16;
    if (t.level === 'country' && t.country) {
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
    } else if (t.level === 'region') {
      const list = fitList && fitList.length ? (all ? fitList : corePins(fitList)) : null;
      bounds = list
        ? boundsOf(list.map((a) => a.lonlat))
        : (geoBounds({ type: 'FeatureCollection', features: TOKYO_AREAS.filter((a) => Number(a.id) < 13300) }) as LngLatBoundsLike);
      pitch = tilt ? 48 : 0;
      bearing = tilt ? -12 : 0;
      maxZoom = 15;
    } else if (t.level === 'area' && t.area) {
      bounds = geoBounds(t.area) as LngLatBoundsLike;
      pitch = tilt ? 55 : 0;
      bearing = tilt ? -18 : 0;
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
  const toggleTilt = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !tilted;
    setTilted(next);
    map.easeTo({ pitch: next ? 52 : 0, bearing: next ? -15 : 0, duration: prefersReducedMotion() ? 0 : 900 });
  };
  const refit = () => flyToTarget(900, true);

  const level = target.level;
  const showPins = level === 'region' || level === 'area';
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
        {showPins &&
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
            <button type="button" onClick={toggleTilt} aria-pressed={tilted} aria-label={tilted ? 'Switch to flat view' : 'Switch to 3D view'} className="map-tilt">
              {tilted ? '2D' : '3D'}
            </button>
            <button type="button" onClick={refit} aria-label="Fit all attractions">
              <Icon name="target" size={18} />
            </button>
          </>
        )}
      </div>

      {showPins && (
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

/** Countries, prefectures and Tokyo's wards, drawn over the base map so they can be hovered and clicked. */
function addOurLayers(map: MapLibreMap) {
  const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addSource('fl-world', { type: 'geojson', data: collection(WORLD, (_, i) => i + 1) });
  map.addSource('fl-prefs', { type: 'geojson', data: collection(PREFECTURES, (f) => Number(f.id)) });
  map.addSource('fl-areas', { type: 'geojson', data: collection(TOKYO_AREAS, (f) => Number(f.id), (id) => ({ count: AREA_COUNTS[id] ?? 0 })) });
  map.addSource('fl-dest', { type: 'geojson', data: DEST_SHAPES });
  const hover = ['boolean', ['feature-state', 'hover'], false];
  const lit = ['boolean', ['feature-state', 'current'], false];
  // A country picked for a trip.
  const picked = ['boolean', ['feature-state', 'picked'], false];
  // A region of Japan the list has opened: its prefectures stay lit while the camera holds them.
  const focus = ['boolean', ['feature-state', 'focus'], false];

  map.addLayer(
    {
      id: 'fl-world-fill',
      type: 'fill',
      source: 'fl-world',
      paint: {
        'fill-color': ['case', picked, C.cedar, C.ink] as never,
        'fill-opacity': ['case', picked, ['case', hover, 0.58, 0.5], hover, 0.08, 0] as never,
      },
    },
    firstSymbol,
  );
  // Destinations are tinted on the globe (Japan, which is live, stronger); the one on tour is lit.
  // The tint fades as the camera comes down to a country.
  map.addLayer(
    {
      id: 'fl-dest-fill',
      type: 'fill',
      source: 'fl-dest',
      paint: {
        'fill-color': C.cedar,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 2.8, ['case', lit, 0.9, picked, 0.75, ['get', 'live'], 0.6, 0.3], 4.4, ['case', picked, 0.75, lit, 0.28, 0]] as never,
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
        'fill-opacity': ['case', ['==', ['get', 'fid'], TOKYO_PREF_ID], ['case', hover, 0.85, 0.7], hover, 0.3, focus, 0.18, 0] as never,
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
        'line-width': ['case', ['any', hover, focus], 1.4, ['interpolate', ['linear'], ['zoom'], 4, 0.5, 9, 1]] as never,
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
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          0.16,
          hover,
          ['case', ['>', ['get', 'count'], 0], 0.18, 0.05],
          ['>', ['get', 'count'], 0],
          0.08,
          0,
        ] as never,
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

export type { Level };
