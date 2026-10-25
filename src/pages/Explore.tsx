import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ATTRACTIONS } from '../data/attractions';
import {
  AREA_COUNTS,
  JAPAN_ID,
  MAP_ROOT,
  TOKYO_PATH,
  TOKYO_PREF_ID,
  WORLD_PATH,
  countryPath,
  slug,
  targetFromParams,
  type MapTarget,
} from '../data/places';
import { DESTINATIONS, destinationByWorldId } from '../data/destinations';
import { REGIONS, prefName, regionAnchor, regionOfPref, type Region } from '../data/regions';
import type { Attraction } from '../data/types';
import type { Insets } from '../map/camera';
import { KineticTitle } from '../components/KineticTitle';
import { BottomTabs, TopNav } from '../components/Chrome';
import { PanelRow, PinCard } from '../components/MapCards';
import { MapSearch } from '../components/MapSearch';
import { Icon } from '../components/Icon';
import { BAR_H, BAR_TOP, BAR_TOP_PHONE, GuideSheet } from '../components/guides/GuideSheet';
import { RegionChips, RegionList, type Hot } from '../components/guides/RegionList';
import type { CardSubject } from '../components/GlobeCard';
import { FILTERS, type FilterId } from '../lib/factors';
import { plural } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import { useGo } from '../lib/transition';
import { PEEK, useGuideScroll } from '../lib/useGuideScroll';
import { useMedia } from '../lib/useMedia';

const AREA_TOTAL = Object.keys(AREA_COUNTS).length;
const SOON = DESTINATIONS.filter((d) => !d.live).length;
// The map engine is large, so it loads only on this page.
const MapExplorer = lazy(() => import('../map/MapExplorer'));

/** Phone: room the guide sheet's peek leaves below it for the tab bar. */
const PHONE_CLEAR = 92;
/** Phone: where the attraction row sits without a sheet (`.msheet` in styles.css); with one it moves up above the peek. */
const MSHEET_BOTTOM = 86;
/** Phone: the room MapExplorer leaves under the docked card without a sheet (the tab bar). */
const CARD_BOTTOM = 92;
const WHEEL_HINT = 'Scrolling shows the guides. Use Ctrl + scroll to zoom the map.';
const TOKYO_PREF = Number(TOKYO_PREF_ID);
const NO_HOT: Hot = { region: null, pref: null };

/** A region shown on the map's card, in the shape the coming-soon country card already uses. */
function regionCard(r: Region): CardSubject {
  return {
    slug: r.id,
    name: r.name,
    local: r.ja,
    oneLiner: r.oneLiner,
    live: false,
    anchor: regionAnchor(r),
    landmarks: [{ photo: r.photo, name: r.name }],
  };
}

/** The guide sheet's words at the levels that have guides: Japan, Tokyo and a ward. */
function sheetFor(t: MapTarget) {
  const cue = 'Scroll for region guides';
  if (t.level === 'country' && t.country!.id === JAPAN_ID)
    return { heading: 'Which part of Japan fits you?', barLabel: `Japan · ${REGIONS.length} regions`, cue };
  if (t.level === 'region') return { heading: 'Which part of Tokyo fits you?', barLabel: `Tokyo · ${AREA_TOTAL} wards`, cue };
  if (t.level === 'area') {
    const name = t.area!.properties.name;
    return { heading: `In ${name}`, barLabel: `${name} · ${plural(AREA_COUNTS[t.area!.id] ?? 0, 'place')}`, cue };
  }
  return null;
}

function titleFor(t: MapTarget) {
  switch (t.level) {
    case 'world':
      return {
        text: 'Know before you go',
        line: 'Every attraction checked for weather, effort, crowds, logistics and real cost, before it goes in your trip.',
      };
    case 'country': {
      if (t.country!.id === JAPAN_ID) return { text: 'Japan', sub: '日本', line: `Tokyo is mapped first, with ${ATTRACTIONS.length} attractions checked.` };
      const d = destinationByWorldId(t.country!.id);
      return d
        ? { text: d.name, sub: d.local, line: `We’re checking ${d.name} next. Tokyo is live with ${ATTRACTIONS.length} attractions meanwhile.` }
        : { text: t.country!.properties.name, line: 'No attractions checked here yet. Tokyo is the first place on the map.' };
    }
    case 'region':
      return { text: 'Tokyo', sub: '東京', line: `${ATTRACTIONS.length} attractions across ${AREA_TOTAL} areas. Tap a ward to zoom in, or a ticker for the details.` };
    case 'area': {
      const n = AREA_COUNTS[t.area!.id] ?? 0;
      return { text: t.area!.properties.name, sub: t.area!.properties.ja, line: `${plural(n, 'attraction')} checked in ${t.area!.properties.name}.` };
    }
  }
}

export default function Explore() {
  const params = useParams();
  const navigate = useNavigate();
  const go = useGo();
  const target = useMemo(() => targetFromParams(params.country, params.region, params.area), [params.country, params.region, params.area]);
  const narrow = useMedia('(max-width: 760px)');
  const [filter, setFilter] = useState<FilterId>('all');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Japan: which region row is open, which region is framed, and what the pointer is over.
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hot, setHot] = useState<Hot>(NO_HOT);

  const listed = target.level === 'region' || target.level === 'area';
  const scoped = useMemo(
    () => (target.level === 'area' ? ATTRACTIONS.filter((a) => a.area === target.area!.id) : listed ? ATTRACTIONS : []),
    [target, listed],
  );
  const activeFilter = FILTERS.find((f) => f.id === filter)!;
  const shown = scoped.filter(activeFilter.test);
  const picked = selected ? ATTRACTIONS.find((a) => a.id === selected) ?? null : null;

  const title = titleFor(target);
  useEffect(() => {
    document.title = target.level === 'world' ? 'Fitline: know before you go' : `${title.text} · Fitline`;
  }, [target.level, title.text]);

  // On the globe the free area is whatever the title card leaves, so measure it.
  const titleRef = useRef<HTMLElement>(null);
  const [titleBox, setTitleBox] = useState({ right: 620, bottom: 300 });
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const round = (n: number) => Math.round(n / 8) * 8;
      setTitleBox((b) => (b.right === round(r.right) && b.bottom === round(r.bottom) ? b : { right: round(r.right), bottom: round(r.bottom) }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const country = target.level === 'country' ? destinationByWorldId(target.country!.id) : undefined;
  const japan = target.level === 'country' && target.country!.id === JAPAN_ID;

  // Japan's regions: the open row, the framed region, and the lit prefectures. They live at
  // Japan's level only, so a level change cannot leave a region's card over Tokyo.
  const focus = japan && focusId ? REGIONS.find((r) => r.id === focusId) ?? null : null;
  const card = useMemo(() => (focus && !focus.live ? regionCard(focus) : null), [focus]);
  const pinned: CardSubject | null = card ?? (country && !country.live ? country : null);
  const focusPrefs = focus ? focus.prefectures : null;
  const focused = !!focus;
  const hotPrefs = useMemo(() => {
    if (!japan) return [];
    if (hot.pref) return [hot.pref];
    return REGIONS.find((r) => r.id === hot.region)?.prefectures ?? [];
  }, [hot, japan]);

  // Changing level clears the picked pin.
  useEffect(() => setSelected(null), [target.level, target.area?.id]);

  // The region focus is page state, so it goes when the level does.
  useEffect(() => {
    setOpenId(null);
    setFocusId(null);
    setHot(NO_HOT);
  }, [target.level, target.country?.id, target.area?.id]);

  /** A region row: it opens and the camera frames it. Kantō is live, so it gets no card. */
  const toggleRegion = (id: string) => {
    const closing = openId === id;
    setOpenId(closing ? null : id);
    setFocusId(closing ? null : id);
    setHot({ region: id, pref: null });
  };

  /** A prefecture row or map shape: Tokyo flies in, the rest of Kantō gets a notice, others open their region. */
  const pickPref = (code: number) => {
    if (code === TOKYO_PREF) return navigate(TOKYO_PATH);
    const r = regionOfPref(code);
    if (!r) return;
    if (r.live) return setNotice(`${prefName(code)} isn’t mapped yet. Tokyo is the first prefecture with checked attractions.`);
    setOpenId(r.id);
    setFocusId(r.id);
    setHot({ region: r.id, pref: code });
  };

  /** A phone chip: the same, except Kantō's chip goes straight to Tokyo, its only live place. */
  const pickChip = (id: string) => {
    if (REGIONS.find((r) => r.id === id)?.live) return navigate(TOKYO_PATH);
    setFocusId((f) => (f === id ? null : id));
    setOpenId(id);
  };

  const onPrefHover = (code: number | null) =>
    setHot(code == null ? NO_HOT : { region: regionOfPref(code)?.id ?? null, pref: code });

  // Wrong URL: settle on the nearest real level.
  useEffect(() => {
    if (!target.missing) return;
    setNotice('That place isn’t on the map, so here is the nearest level that is.');
    const path = target.level === 'world' ? WORLD_PATH : target.level === 'country' ? countryPath(target.country!.properties.name) : TOKYO_PATH;
    navigate(path, { replace: true });
  }, [target, navigate]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3600);
    return () => clearTimeout(t);
  }, [notice]);

  const upPath =
    target.level === 'area' ? TOKYO_PATH : target.level === 'region' ? `${MAP_ROOT}/japan` : target.level === 'country' ? WORLD_PATH : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.drawer')) return;
      if (selected) setSelected(null);
      // A framed region is a level of its own: Escape goes back to all of Japan first.
      else if (focused) setFocusId(null);
      else if (upPath) navigate(upPath);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [upPath, navigate, selected, focused]);

  // Guides under the map: the page scrolls, the sheet slides over the map.
  const sheet = sheetFor(target);
  const rootRef = useRef<HTMLDivElement>(null);
  const clear = sheet && narrow ? PHONE_CLEAR : 0;
  const barTop = narrow ? BAR_TOP_PHONE : BAR_TOP;
  const levelKey = `${target.level}:${target.country?.id}:${target.area?.id}`;
  // Fully up, the sheet starts under the sticky bar, which pins below the nav and search.
  const { scrollToGuides, scrollToTop, atGuides } = useGuideScroll({ enabled: !!sheet, root: rootRef, barH: barTop + BAR_H + clear, levelKey });
  const [attribHost, setAttribHost] = useState<HTMLDivElement | null>(null);

  // Browser back and forward must not put the page back where it was scrolled: a level starts at the top.
  useEffect(() => {
    const prev = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    return () => {
      history.scrollRestoration = prev;
    };
  }, []);

  // The first plain wheel over the map at the top of the page explains where it went, once.
  const wheelHinted = useRef(false);
  const onWheelPassThrough = useCallback(() => {
    if (wheelHinted.current) return;
    if (Number(rootRef.current?.style.getPropertyValue('--gp') || 0) > 0) return;
    wheelHinted.current = true;
    setNotice(WHEEL_HINT);
  }, []);

  const world = target.level === 'world';
  // Japan keeps the right-hand slot for the region list, so the camera frames it in what is left.
  const rightPanel = listed || (japan && !narrow);
  const base: Insets = world
    ? narrow
      ? { top: titleBox.bottom + 4, right: 16, bottom: 236, left: 16 }
      : { top: 90, right: 24, bottom: 0, left: titleBox.right + 24 }
    : narrow
      ? { top: listed ? 236 : 210, right: 16, bottom: listed ? 280 : pinned ? 300 : 220, left: 16 }
      : { top: 150, right: rightPanel ? 476 : pinned ? 420 : 40, bottom: listed ? 220 : 240, left: 40 };
  // The sheet's peek covers the bottom of the map. Above it sit the title card (laptop) or the
  // attraction row and pin card (phone), so the free area shrinks by the peek.
  // Phone: the docked card clears the peek instead of the tab bar, so it sits that much higher.
  const cardBottom = sheet && narrow ? clear + PEEK + 8 : CARD_BOTTOM;
  const insets: Insets = !sheet
    ? base
    : narrow
      ? {
          ...base,
          bottom: listed
            ? base.bottom + clear + PEEK + 8 - MSHEET_BOTTOM
            : pinned
              ? base.bottom + cardBottom - CARD_BOTTOM
              : Math.max(base.bottom, clear + PEEK + 16),
        }
      : { ...base, bottom: base.bottom + PEEK };

  const crumbs = [
    { label: 'World', to: WORLD_PATH },
    target.country && { label: target.country.properties.name, to: countryPath(target.country.properties.name) },
    target.region && { label: 'Tokyo', to: TOKYO_PATH },
    target.area && { label: target.area.properties.name, to: `${TOKYO_PATH}/${slug(target.area.properties.name)}` },
  ].filter(Boolean) as { label: string; to: string }[];

  const open = (id: string) => go(`/attraction/${id}`);

  return (
    <div
      ref={rootRef}
      className={`explore ${sheet ? 'has-guides' : ''}`}
      data-level={target.level}
      style={{ '--sheet-clear': `${clear}px`, '--bar-top': `${barTop}px` } as CSSProperties}
    >
      {/* Above the guide sheet at every scroll position; the sheet's sticky bar pins just below the search. */}
      <div className="explore-chrome">
        <TopNav tone="glass" />
        <MapSearch
          target={target}
          onCountry={(s) => navigate(`${MAP_ROOT}/${s}`)}
          onRegion={() => navigate(TOKYO_PATH)}
          onArea={(s) => navigate(`${TOKYO_PATH}/${s}`)}
          onAttraction={setSelected}
          onNotice={setNotice}
        />
      </div>

      <div className="explore-stage">
        <Suspense fallback={<div className="map-loading" aria-hidden="true" />}>
          <MapExplorer
            target={target}
            insets={insets}
            pins={shown}
            hoverId={hoverId}
            selectedId={selected}
            fitPins
            pinned={pinned}
            hotPrefs={hotPrefs}
            focusPrefs={focusPrefs}
            wheelScrollsPage={!!sheet}
            onWheelPassThrough={onWheelPassThrough}
            attributionHost={sheet ? attribHost : null}
            cardBottom={cardBottom}
            onHover={setHoverId}
            onPrefHover={onPrefHover}
            onPrefPick={pickPref}
            onCountry={(s) => navigate(`${MAP_ROOT}/${s}`)}
            onRegion={() => navigate(TOKYO_PATH)}
            onArea={(s) => navigate(`${TOKYO_PATH}/${s}`)}
            onAttraction={(id) => setSelected(id)}
            onNotice={setNotice}
          />
        </Suspense>

        <section ref={titleRef} className="explore-title">
          {!world && (
          <nav aria-label="Map level" className="crumbs">
            <ol>
              {crumbs.map((c, i) => (
                <li key={c.to}>
                  {i === crumbs.length - 1 ? (
                    <span aria-current="page">{c.label}</span>
                  ) : (
                    <button type="button" onClick={() => navigate(c.to)}>
                      {c.label}
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          )}
          <KineticTitle
            text={title.text}
            sub={title.sub}
            className={`place-title ${world ? 'is-headline' : ''}`}
            width={world ? 88 : title.text.length > 12 ? 80 : title.text.length > 8 ? 100 : 118}
            delay={0.3}
          />
          <p className="explore-line">{title.line}</p>
          {world && (
            <p className="explore-note">
              <span className="live-dot" aria-hidden="true" />
              Tokyo is live with {plural(ATTRACTIONS.length, 'attraction')}. {SOON} more countries are on the way.
            </p>
          )}
          <div className="explore-actions">
            {(world || (target.level === 'country' && target.country!.id !== JAPAN_ID && !pinned)) && (
              <button type="button" className="button" onClick={() => navigate(TOKYO_PATH)}>
                Explore Tokyo
              </button>
            )}
            {japan && (
              <>
                <button type="button" className="button" onClick={() => navigate(TOKYO_PATH)}>
                  Open Tokyo
                </button>
                <button type="button" className="button is-quiet" onClick={scrollToGuides}>
                  See region guides
                </button>
              </>
            )}
            {upPath && (
              <button type="button" className="button is-quiet" onClick={() => (focus ? setFocusId(null) : navigate(upPath))}>
                <Icon name="zoomOut" />
                {focus ? 'All of Japan' : 'Zoom out'}
              </button>
            )}
          </div>
        </section>

        {japan && !narrow && (
          <RegionList openId={openId} hot={hot} onHover={setHot} onToggle={toggleRegion} onPickPref={pickPref} />
        )}

        {listed && !narrow && (
          <aside className="panel" aria-labelledby="panel-title">
            <div className="panel-head">
              <h2 id="panel-title">{target.level === 'area' ? `In ${target.area!.properties.name}` : 'All of Tokyo'}</h2>
              <p className="panel-scope">{plural(shown.length, 'place')}</p>
            </div>
            <FilterChips scoped={scoped} filter={filter} setFilter={setFilter} />
            <ul className="plist" data-lenis-prevent>
              {shown.map((a) => (
                <li key={a.id}>
                  <PanelRow a={a} hot={(selected ?? hoverId) === a.id} onHover={setHoverId} onOpen={open} showArea={target.level === 'region'} />
                </li>
              ))}
              {shown.length === 0 && (
                <li className="empty-line">
                  No {activeFilter.label.toLowerCase()} attractions here.{' '}
                  <button type="button" className="text-button" onClick={() => setFilter('all')}>
                    Show all
                  </button>
                </li>
              )}
            </ul>
          </aside>
        )}

        {listed && narrow && !picked && (
          <aside className="msheet" aria-labelledby="msheet-title">
            <h2 id="msheet-title" className="sr-only">
              Attractions
            </h2>
            <FilterChips scoped={scoped} filter={filter} setFilter={setFilter} />
            <ul className="mrow">
              {shown.map((a) => (
                <li key={a.id}>
                  <PanelRow a={a} hot={false} onHover={() => {}} onOpen={(id) => setSelected(id)} showArea={target.level === 'region'} axis="inline" />
                </li>
              ))}
            </ul>
          </aside>
        )}

        <AnimatePresence>
          {picked && (
            <motion.div
              key={picked.id}
              className="pincard"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            >
              <PinCard a={picked} onOpen={open} onClose={() => setSelected(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {sheet && (
        <>
          {/* Above the sheet, so the map's attribution stays readable at every scroll position. */}
          <div ref={setAttribHost} className="explore-attrib maplibregl-ctrl-bottom-right" />
          <GuideSheet
            heading={sheet.heading}
            cue={sheet.cue}
            barLabel={sheet.barLabel}
            atGuides={atGuides}
            onBackToMap={scrollToTop}
            peek={japan && narrow ? <RegionChips focusId={focusId} onPick={pickChip} /> : undefined}
          >
            <p className="guides-soon">Region guides coming in the next task</p>
          </GuideSheet>
        </>
      )}

      <div className="toast" role="status" data-on={notice ? '1' : ''}>
        {notice}
      </div>
      {narrow && <BottomTabs />}
    </div>
  );
}

function FilterChips({ scoped, filter, setFilter }: { scoped: Attraction[]; filter: FilterId; setFilter: (f: FilterId) => void }) {
  return (
    <div className="chips is-small" role="group" aria-label="Filter attractions">
      {FILTERS.map((f) => (
        <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
          {filter === f.id && <motion.span layoutId="map-chip" className="chip-pill" transition={{ duration: 0.3, ease: EASE_OUT }} />}
          <span className="chip-text">
            {f.label}
            <span className="chip-count num">{scoped.filter(f.test).length}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
