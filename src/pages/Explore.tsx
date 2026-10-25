import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ATTRACTIONS } from '../data/attractions';
import { AREA_COUNTS, JAPAN_ID, MAP_ROOT, TOKYO_PATH, countryPath, slug, targetFromParams, type MapTarget } from '../data/places';
import type { Attraction } from '../data/types';
import type { Insets } from '../map/camera';
import { KineticTitle } from '../components/KineticTitle';
import { BottomTabs, TopNav } from '../components/Chrome';
import { PanelRow, PinCard } from '../components/MapCards';
import { MapSearch } from '../components/MapSearch';
import { Icon } from '../components/Icon';
import { FILTERS, type FilterId } from '../lib/factors';
import { plural } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import { useGo } from '../lib/transition';
import { useMedia } from '../lib/useMedia';

const AREA_TOTAL = Object.keys(AREA_COUNTS).length;
// The map engine is large, so it loads only on this page.
const MapExplorer = lazy(() => import('../map/MapExplorer'));

function titleFor(t: MapTarget) {
  switch (t.level) {
    case 'world':
      return { text: 'The world', line: 'Japan is the first country with checked attractions. Tap it to fly in.' };
    case 'country':
      return t.country!.id === JAPAN_ID
        ? { text: 'Japan', sub: '日本', line: `Tokyo is mapped first, with ${ATTRACTIONS.length} attractions checked.` }
        : { text: t.country!.properties.name, line: 'No attractions checked here yet. Japan is the first country on the map.' };
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

  const listed = target.level === 'region' || target.level === 'area';
  const scoped = useMemo(
    () => (target.level === 'area' ? ATTRACTIONS.filter((a) => a.area === target.area!.id) : listed ? ATTRACTIONS : []),
    [target, listed],
  );
  const activeFilter = FILTERS.find((f) => f.id === filter)!;
  const shown = scoped.filter(activeFilter.test);
  const picked = selected ? ATTRACTIONS.find((a) => a.id === selected) ?? null : null;

  useEffect(() => {
    document.title = 'Map · Fitline';
  }, []);

  // Changing level clears the picked pin.
  useEffect(() => setSelected(null), [target.level, target.area?.id]);

  // Wrong URL: settle on the nearest real level.
  useEffect(() => {
    if (!target.missing) return;
    setNotice('That place isn’t on the map, so here is the nearest level that is.');
    const path = target.level === 'world' ? MAP_ROOT : target.level === 'country' ? countryPath(target.country!.properties.name) : TOKYO_PATH;
    navigate(path, { replace: true });
  }, [target, navigate]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3600);
    return () => clearTimeout(t);
  }, [notice]);

  const upPath =
    target.level === 'area' ? TOKYO_PATH : target.level === 'region' ? `${MAP_ROOT}/japan` : target.level === 'country' ? MAP_ROOT : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.drawer')) return;
      if (selected) setSelected(null);
      else if (upPath) navigate(upPath);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [upPath, navigate, selected]);

  const insets: Insets = narrow
    ? { top: listed ? 236 : 210, right: 16, bottom: listed ? 280 : 220, left: 16 }
    : { top: 150, right: listed ? 476 : 40, bottom: listed ? 220 : 240, left: 40 };

  const title = titleFor(target);
  const crumbs = [
    { label: 'World', to: MAP_ROOT },
    target.country && { label: target.country.properties.name, to: countryPath(target.country.properties.name) },
    target.region && { label: 'Tokyo', to: TOKYO_PATH },
    target.area && { label: target.area.properties.name, to: `${TOKYO_PATH}/${slug(target.area.properties.name)}` },
  ].filter(Boolean) as { label: string; to: string }[];

  const open = (id: string) => go(`/attraction/${id}`);

  return (
    <div className="explore" data-level={target.level}>
      <Suspense fallback={<div className="map-loading" aria-hidden="true" />}>
      <MapExplorer
        target={target}
        insets={insets}
        pins={shown}
        hoverId={hoverId}
        selectedId={selected}
        fitPins
        onHover={setHoverId}
        onCountry={(s) => navigate(`${MAP_ROOT}/${s}`)}
        onRegion={() => navigate(TOKYO_PATH)}
        onArea={(s) => navigate(`${TOKYO_PATH}/${s}`)}
        onAttraction={(id) => setSelected(id)}
        onNotice={setNotice}
      />
      </Suspense>

      <TopNav tone="glass" />

      <MapSearch
        target={target}
        onCountry={(s) => navigate(`${MAP_ROOT}/${s}`)}
        onRegion={() => navigate(TOKYO_PATH)}
        onArea={(s) => navigate(`${TOKYO_PATH}/${s}`)}
        onAttraction={setSelected}
        onNotice={setNotice}
      />

      <section className="explore-title">
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
        <KineticTitle
          text={title.text}
          sub={title.sub}
          className="place-title"
          width={title.text.length > 12 ? 80 : title.text.length > 8 ? 100 : 118}
          delay={0.3}
        />
        <p className="explore-line">{title.line}</p>
        <div className="explore-actions">
          {(target.level === 'world' || (target.level === 'country' && target.country!.id !== JAPAN_ID)) && (
            <button type="button" className="button" onClick={() => navigate(`${MAP_ROOT}/japan`)}>
              Go to Japan
            </button>
          )}
          {target.level === 'country' && target.country!.id === JAPAN_ID && (
            <button type="button" className="button" onClick={() => navigate(TOKYO_PATH)}>
              Open Tokyo
            </button>
          )}
          {upPath && (
            <button type="button" className="button is-quiet" onClick={() => navigate(upPath)}>
              <Icon name="zoomOut" />
              Zoom out
            </button>
          )}
        </div>
      </section>

      {listed && !narrow && (
        <aside className="panel" aria-labelledby="panel-title">
          <div className="panel-head">
            <h2 id="panel-title">{target.level === 'area' ? `In ${target.area!.properties.name}` : 'All of Tokyo'}</h2>
            <p className="panel-scope">{plural(shown.length, 'place')}</p>
          </div>
          <FilterChips scoped={scoped} filter={filter} setFilter={setFilter} />
          <ul className="plist">
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
