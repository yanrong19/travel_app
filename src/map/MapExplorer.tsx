import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, setWorkerUrl, type LngLatBoundsLike, type MapGeoJSONFeature, type StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { geoBounds } from 'd3-geo';
import type { Attraction } from '../data/types';
import { ATTRACTIONS } from '../data/attractions';
import { AREA_COUNTS, JAPAN_ID, PREFECTURES, TOKYO_AREAS, TOKYO_PREF_ID, WORLD, slug, type Level, type MapTarget, type Place } from '../data/places';
import { prefersReducedMotion } from '../lib/motion';
import { photo } from '../lib/photos';
import { readings } from '../lib/factors';
import { lensRating, type LensId } from '../lib/lens';
import { Icon } from '../components/Icon';
import type { Insets } from './camera';

// Open map data from OpenStreetMap, served free by OpenFreeMap. The style is
// restyled on load into the app's palette (see restyle()).
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

// Point MapLibre at its worker explicitly so it loads under Vite in dev and in builds.
setWorkerUrl(workerUrl);

const C = {
  ground: '#eef2f4',
  water: '#b9d5e3',
  park: '#d3e8dc',
  cedar: '#0e4f47',
  ink: '#10191b',
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
  /** Embedded in a scrolling page: Ctrl or Cmd + scroll zooms, two fingers pan on phones. */
  embed?: boolean;
  onHover: (id: string | null) => void;
  onCountry: (slug: string) => void;
  onRegion: () => void;
  onArea: (slug: string) => void;
  onAttraction: (id: string) => void;
  onNotice: (text: string) => void;
}

type Cam = { center: [number, number] | { lng: number; lat: number }; zoom: number; pitch: number; bearing: number };

export function MapExplorer(props: Props) {
  const { target, insets, pins, hoverId, selectedId = null, lens = 'any', fitPins = false, embed = false } = props;
  const wrap = useRef<HTMLDivElement>(null);
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

  // ---- Create the map once ----
  useEffect(() => {
    const map = new MapLibreMap({
      container: canvasBox.current!,
      style: STYLE_URL,
      center: [139.2, 36],
      zoom: embed ? 8 : 1.4,
      maxPitch: 70,
      attributionControl: { compact: true },
      cooperativeGestures: embed,
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
    });

    map.on('move', place);
    map.on('resize', place);
    const stopSpin = () => cancelAnimationFrame(spin.current);
    map.on('mousedown', stopSpin);
    map.on('touchstart', stopSpin);
    map.on('wheel', stopSpin);

    return () => {
      clearTimeout(failTimer);
      cancelAnimationFrame(spin.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the canvas sized to its box.
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    ro.observe(wrap.current!);
    return () => ro.disconnect();
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
  }

  // Re-place after React adds, removes or re-ranks overlay items.
  useLayoutEffect(() => {
    place();
  }, [pins, target.level, target.area?.id, hoverId, selectedId, lens, ready]);

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
    show('fl-pref-fill', lv === 'country');
    show('fl-pref-line', lv !== 'world');
    show('fl-area-fill', lv === 'region' || lv === 'area');
    show('fl-area-line', lv === 'region' || lv === 'area');
    TOKYO_AREAS.forEach((a) => map.setFeatureState({ source: 'fl-areas', id: Number(a.id) }, { selected: a.id === target.area?.id }));
  }, [ready, target.level, target.area?.id]);

  // ---- Camera: fly whenever the place, the visible pins or the free area changes ----
  const fitList = fitPins && target.level === 'region' ? pins : undefined;
  const fitKey = fitList ? fitList.map((a) => a.id).sort().join(',') : '';
  const insetKey = `${insets.top},${insets.right},${insets.bottom},${insets.left}`;
  const camKey = `${target.level}:${target.country?.id}:${target.area?.id}:${fitKey}|${insetKey}`;
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
    const side = Math.min(70, W * 0.08);
    return { top: insets.top + 56, bottom: insets.bottom + 12, left: insets.left + side, right: insets.right + side };
  }

  function flyToTarget(duration?: number, all = false, tilt = tilted) {
    const map = mapRef.current;
    if (!map) return;
    cancelAnimationFrame(spin.current);
    const reduced = prefersReducedMotion();
    const go = (cam: Cam) => {
      if (reduced) map.jumpTo(cam);
      else map.flyTo({ ...cam, duration: duration ?? 1800, essential: true, curve: 1.5 });
    };
    const t = target;
    if (t.level === 'world') {
      go({ center: [139.5, 30], zoom: map.getContainer().clientWidth < 700 ? 1 : 1.9, pitch: 0, bearing: 0 });
      if (!reduced) map.once('moveend', () => levelRef.current === 'world' && startSpin());
      return;
    }
    let bounds: LngLatBoundsLike | null = null;
    let pitch = 0;
    let bearing = 0;
    let maxZoom = 16;
    if (t.level === 'country' && t.country) {
      if (t.country.id === JAPAN_ID) bounds = JAPAN_BOUNDS;
      else {
        const [[w, s], [e, n]] = geoBounds(t.country);
        if (e <= w) {
          // Shapes across the date line just get centred.
          go({ center: [(w + e + 360) / 2, (s + n) / 2], zoom: 2.4, pitch: 0, bearing: 0 });
          return;
        }
        bounds = [
          [w, s],
          [e, n],
        ];
      }
      maxZoom = 6;
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
    const narrow = wrap.current!.clientWidth < 700;
    go({ center: cam.center as Cam['center'], zoom: cam.zoom - (narrow ? 0.45 : 0), pitch, bearing });
  }

  function startSpin() {
    const map = mapRef.current;
    if (!map || prefersReducedMotion()) return;
    const step = () => {
      if (levelRef.current !== 'world' || !mapRef.current) return;
      const c = map.getCenter();
      map.setCenter([c.lng + 0.04, c.lat]);
      spin.current = requestAnimationFrame(step);
    };
    spin.current = requestAnimationFrame(step);
  }

  // ---- Clicks and hovers on our shapes ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    type Ev = { features?: MapGeoJSONFeature[]; point: { x: number; y: number } };
    let hovered: { source: string; id: number } | null = null;
    const setHover = (f: MapGeoJSONFeature | null, source: string) => {
      if (hovered) map.setFeatureState(hovered, { hover: false });
      hovered = f && f.id != null ? { source, id: Number(f.id) } : null;
      if (hovered) map.setFeatureState(hovered, { hover: true });
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
      if (tip.current) tip.current.dataset.on = '';
      map.getCanvas().style.cursor = '';
    };

    const onWorldMove = (e: Ev) => {
      const f = e.features?.[0];
      if (!f) return;
      setHover(f, 'fl-world');
      const isJapan = f.properties.fid === JAPAN_ID;
      showTip(e, f.properties.name, isJapan ? `Tokyo: ${ATTRACTIONS.length} attractions checked` : 'No attractions yet', true);
    };
    const onPrefMove = (e: Ev) => {
      const f = e.features?.[0];
      if (!f) return;
      setHover(f, 'fl-prefs');
      const isTokyo = f.properties.fid === TOKYO_PREF_ID;
      showTip(e, f.properties.name, isTokyo ? `${ATTRACTIONS.length} attractions checked` : 'Not mapped yet', true);
    };
    const onAreaMove = (e: Ev) => {
      const f = e.features?.[0];
      if (!f) return;
      setHover(f, 'fl-areas');
      const n = AREA_COUNTS[f.properties.fid] ?? 0;
      showTip(e, `${f.properties.name} ${f.properties.ja}`, n ? `${n} attraction${n > 1 ? 's' : ''}` : 'Nothing checked yet', n > 0);
    };
    const onWorldClick = (e: Ev) => {
      const f = e.features?.[0];
      if (f && levelRef.current === 'world') handlers.current.onCountry(slug(f.properties.name));
    };
    const onPrefClick = (e: Ev) => {
      const f = e.features?.[0];
      if (!f) return;
      if (f.properties.fid === TOKYO_PREF_ID) handlers.current.onRegion();
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
    <div ref={wrap} className={`map ${embed ? 'is-embed' : ''} ${ready ? 'is-ready' : ''}`} data-level={level}>
      <div ref={canvasBox} className="map-canvas" role="region" aria-label={`Map of ${placeName}`} />

      <div ref={overlay} className="map-overlay">
        {level === 'world' && (
          <button type="button" className="map-callout" data-flip="" data-ll="138.5,37.2" onClick={() => handlers.current.onCountry('japan')}>
            <span className="map-callout-dot" aria-hidden="true" />
            <span>Japan</span>
          </button>
        )}
        {showPins &&
          pins.map((a, i) => {
            const rating = lensRating(a, lens);
            const raised = selectedId === a.id || hoverId === a.id;
            const prio = raised ? 0 : (rating ? RANK[rating] : 2) + i / 100;
            return (
              <button
                key={a.id}
                type="button"
                className={`ticker ${rating ? `is-${rating}` : ''} ${hoverId === a.id ? 'is-hot' : ''} ${selectedId === a.id ? 'is-picked' : ''}`}
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

/** Recolour the downloaded base style into the app's palette, show English names, and add relief and 3D buildings. */
function restyle(map: MapLibreMap) {
  const style = map.getStyle() as StyleSpecification;
  const vector = Object.entries(style.sources).find(([, s]) => s.type === 'vector')?.[0];
  let firstSymbol: string | undefined;
  for (const l of style.layers) {
    if (l.type === 'symbol' && !firstSymbol) firstSymbol = l.id;
    if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', C.ground);
    if (l.type === 'fill' && l.id === 'water') map.setPaintProperty(l.id, 'fill-color', C.water);
    if (l.type === 'line' && l.id === 'waterway') map.setPaintProperty(l.id, 'line-color', C.water);
    if (l.type === 'fill' && /park|wood|grass/.test(l.id)) {
      map.setPaintProperty(l.id, 'fill-color', C.park);
      map.setPaintProperty(l.id, 'fill-opacity', 0.9);
    }
    if (l.type === 'fill' && l.id === 'landuse_residential') map.setPaintProperty(l.id, 'fill-color', '#e7ecef');
    // Road names, shields and minor place labels crowd the tickers; the map keeps districts, water and stations.
    if (l.id === 'building' || /^highway-(name|shield)|^road_shield|^label_other$|^airport$/.test(l.id)) map.setLayoutProperty(l.id, 'visibility', 'none');
    if (l.type === 'line' && /^railway(_transit)?$/.test(l.id)) map.setPaintProperty(l.id, 'line-color', '#9fb3bd');
    if (l.type === 'line' && l.id === 'boundary_2') map.setPaintProperty(l.id, 'line-color', '#9fb0b8');
    if (l.type === 'symbol' && l.layout && 'text-field' in l.layout) {
      map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]);
      map.setPaintProperty(l.id, 'text-color', l.id.startsWith('label_country') ? '#56636a' : '#3d4a50');
      map.setPaintProperty(l.id, 'text-halo-color', 'rgba(255,255,255,0.9)');
    }
  }

  // Shaded relief from Natural Earth gives the globe and Japan's mountains some depth.
  if (style.sources.ne2_shaded && map.getLayer('park')) {
    map.addLayer(
      {
        id: 'fl-relief',
        type: 'raster',
        source: 'ne2_shaded',
        maxzoom: 9,
        paint: {
          'raster-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.55, 6, 0.4, 9, 0],
          'raster-saturation': -0.6,
          'raster-contrast': 0.05,
        },
      },
      'park',
    );
  }

  if (vector) {
    map.addLayer(
      {
        id: 'fl-buildings',
        type: 'fill-extrusion',
        source: vector,
        'source-layer': 'building',
        minzoom: 12.5,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#f6f8f9', 40, '#e4ebef', 150, '#cfdbe1'],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14, ['coalesce', ['get', 'render_height'], 8]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
        },
      },
      firstSymbol,
    );
  }

  map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.35, position: [1.3, 200, 35] });
  map.setSky({
    'sky-color': '#a9cde0',
    'horizon-color': '#eef2f4',
    'fog-color': '#eef2f4',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.7,
    'fog-ground-blend': 0.75,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 8, 0],
  });
}

/** Countries, prefectures and Tokyo's wards, drawn over the base map so they can be hovered and clicked. */
function addOurLayers(map: MapLibreMap) {
  const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addSource('fl-world', { type: 'geojson', data: collection(WORLD, (_, i) => i + 1) });
  map.addSource('fl-prefs', { type: 'geojson', data: collection(PREFECTURES, (f) => Number(f.id)) });
  map.addSource('fl-areas', { type: 'geojson', data: collection(TOKYO_AREAS, (f) => Number(f.id), (id) => ({ count: AREA_COUNTS[id] ?? 0 })) });
  const hover = ['boolean', ['feature-state', 'hover'], false];

  map.addLayer(
    {
      id: 'fl-world-fill',
      type: 'fill',
      source: 'fl-world',
      paint: {
        'fill-color': ['case', ['==', ['get', 'fid'], JAPAN_ID], C.cedar, C.ink],
        // Japan glows green on the globe and fades as the prefectures take over.
        'fill-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          ['case', ['==', ['get', 'fid'], JAPAN_ID], 0.85, hover, 0.08, 0],
          4,
          ['case', ['==', ['get', 'fid'], JAPAN_ID], 0, hover, 0.08, 0],
        ] as never,
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
        'fill-color': ['case', ['==', ['get', 'fid'], TOKYO_PREF_ID], C.cedar, C.ink],
        'fill-opacity': ['case', ['==', ['get', 'fid'], TOKYO_PREF_ID], ['case', hover, 0.85, 0.7], hover, 0.07, 0] as never,
      },
    },
    firstSymbol,
  );
  map.addLayer(
    {
      id: 'fl-pref-line',
      type: 'line',
      source: 'fl-prefs',
      paint: { 'line-color': '#8fa3ad', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 9, 1], 'line-opacity': 0.6 },
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
