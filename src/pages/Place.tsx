import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCards, Keyboard, A11y, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-cards';
import { ATTRACTIONS } from '../data/attractions';
import { AREA_COUNTS, TOKYO_AREAS, TOKYO_PAGE, areaById, areaBySlug, areaPath, areaPagePath, TOKYO_PATH } from '../data/places';
import { destinationBySlug, JAPAN_SOON, type Destination } from '../data/destinations';
import type { Attraction } from '../data/types';
import { KineticTitle } from '../components/KineticTitle';
import { FeatureCard, TileCard } from '../components/AttractionCard';
import { HomeMap } from '../components/HomeMap';
import { BottomTabs, Footer, TopNav } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { FILTERS, type FilterId } from '../lib/factors';
import { photo, creditFor } from '../lib/photos';
import { plural } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import { useGo } from '../lib/transition';
import { useMedia } from '../lib/useMedia';

const AREAS = TOKYO_AREAS.filter((a) => AREA_COUNTS[a.id])
  .map((a) => ({ ...a, count: AREA_COUNTS[a.id], cover: ATTRACTIONS.find((x) => x.area === a.id)!.id }))
  .sort((x, y) => y.count - x.count);

const TOKYO_COVER = 'shibuya-sky';
const JAPAN_COVER = 'hero';

const match = (q: string, text: string) => text.toLowerCase().includes(q.trim().toLowerCase());

type Level = 'country' | 'region' | 'area';

/** One page for every place level: a country, Tokyo, or one of Tokyo's wards (the ward is a filter on Tokyo). */
export default function PlacePage() {
  const { country, region, area } = useParams();
  const dest = destinationBySlug(country);
  if (!dest) return <Navigate to="/" replace />;
  if (!dest.live) return <ComingSoon d={dest} />;
  if (region && region !== 'tokyo') return <Navigate to={`/${dest.slug}`} replace />;
  const ward = area ? areaBySlug(area) : undefined;
  if (area && (!ward || !AREA_COUNTS[ward.id])) return <Navigate to={TOKYO_PAGE} replace />;
  const level: Level = ward ? 'area' : region ? 'region' : 'country';
  return <LivePlace d={dest} level={level} wardId={ward?.id ?? null} />;
}

function LivePlace({ d, level, wardId }: { d: Destination; level: Level; wardId: string | null }) {
  const go = useGo();
  const navigate = useNavigate();
  const narrow = useMedia('(max-width: 760px)');
  const [filter, setFilter] = useState<FilterId>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const allRef = useRef<HTMLElement>(null);
  const ward = wardId ? areaById(wardId) : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const scoped = useMemo(() => (wardId ? ATTRACTIONS.filter((a) => a.area === wardId) : ATTRACTIONS), [wardId]);
  const searched = scoped.filter(
    (a) => !query || match(query, `${a.name} ${a.ja} ${a.kind} ${areaById(a.area)?.properties.name}`),
  );
  const activeFilter = FILTERS.find((f) => f.id === filter)!;
  const shown = searched.filter(activeFilter.test);

  const hero = {
    country: {
      photo: JAPAN_COVER,
      alt: 'Tokyo’s skyline with Mount Fuji behind it',
      text: d.name,
      sub: d.local,
      line: `${d.oneLiner} Tokyo is mapped first, with ${plural(ATTRACTIONS.length, 'attraction')} checked.`,
      picks: `Top picks in ${d.name}`,
      placeholder: `Search places in ${d.name}…`,
      map: `/map/${d.slug}`,
    },
    region: {
      photo: TOKYO_COVER,
      alt: 'Tokyo seen from the Shibuya Sky deck',
      text: 'Tokyo',
      sub: '東京',
      line: `${plural(ATTRACTIONS.length, 'attraction')}, each checked for weather, effort, crowds, logistics and real cost before you go.`,
      picks: 'Top picks in Tokyo',
      placeholder: 'Search temples, markets, Shibuya…',
      map: TOKYO_PATH,
    },
    area: ward && {
      photo: AREAS.find((a) => a.id === ward.id)!.cover,
      alt: '',
      text: ward.properties.name,
      sub: ward.properties.ja,
      line: `${plural(scoped.length, 'attraction')} in ${ward.properties.name}, each checked for weather, effort, crowds, logistics and real cost.`,
      picks: `In ${ward.properties.name}`,
      placeholder: `Search ${ward.properties.name}…`,
      map: areaPath(ward.id),
    },
  }[level]!;
  const credit = creditFor(hero.photo);

  useEffect(() => {
    document.title = `${hero.text}: attractions checked before you go · Fitline`;
  }, [hero.text]);

  // Wards are a filter on Tokyo: the page stays, the title and photo change.
  const pickWard = (id: string | null) => {
    setQuery('');
    navigate(id ? areaPagePath(id) : TOKYO_PAGE, { preventScrollReset: true });
  };
  const toResults = () => allRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const titleWidth = hero.text.length > 12 ? 80 : hero.text.length > 8 ? 96 : 104;

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-stage">
          <AnimatePresence initial={false}>
            <motion.img
              key={hero.photo}
              className="hero-photo"
              src={photo(hero.photo, 1600)}
              alt={hero.alt}
              fetchPriority="high"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: EASE_OUT }}
            />
          </AnimatePresence>
          <div className="hero-scrim" aria-hidden="true" />
          <TopNav tone="glass" />

          <div className="hero-grid">
            <div className="hero-copy">
              <nav className="hero-crumbs" aria-label="Where you are">
                <a href="/" onClick={(e) => (e.preventDefault(), go('/'))}>
                  World
                </a>
                {level !== 'country' && (
                  <a href={`/${d.slug}`} onClick={(e) => (e.preventDefault(), navigate(`/${d.slug}`, { preventScrollReset: true }))}>
                    {d.name}
                  </a>
                )}
                {level === 'area' && (
                  <a href={TOKYO_PAGE} onClick={(e) => (e.preventDefault(), pickWard(null))}>
                    Tokyo
                  </a>
                )}
              </nav>
              <KineticTitle text={hero.text} sub={hero.sub} className="hero-title" width={titleWidth} delay={0.2} />
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={hero.line}
                  className="hero-line"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                >
                  {hero.line}
                </motion.p>
              </AnimatePresence>

              <form
                className="search"
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  toResults();
                }}
              >
                <Icon name="search" size={18} />
                <label htmlFor="q" className="sr-only">
                  Search attractions
                </label>
                <input id="q" type="search" placeholder={hero.placeholder} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
                <button type="submit" className="search-go" aria-label="Show results">
                  <Icon name="arrowRight" size={18} />
                </button>
              </form>

              <ScopeChips level={level} wardId={wardId} onWard={pickWard} onTokyo={() => navigate(TOKYO_PAGE, { preventScrollReset: true })} />
            </div>

            {!narrow && (
              <div className="hero-rail" aria-label={hero.picks}>
                <div className="rail-head">
                  <h2>{hero.picks}</h2>
                  <div className="rail-nav">
                    <button type="button" className="round-button rail-prev" aria-label="Previous picks">
                      <Icon name="arrowLeft" size={18} />
                    </button>
                    <button type="button" className="round-button rail-next" aria-label="Next picks">
                      <Icon name="arrowRight" size={18} />
                    </button>
                  </div>
                </div>
                <Swiper
                  key={wardId ?? 'all'}
                  modules={[Navigation, Keyboard, A11y]}
                  navigation={{ prevEl: '.rail-prev', nextEl: '.rail-next' }}
                  keyboard={{ enabled: true }}
                  slidesPerView="auto"
                  spaceBetween={18}
                  watchSlidesProgress
                  className="rail"
                >
                  {scoped.map((a, i) => (
                    <SwiperSlide key={a.id} className="rail-slide">
                      <FeatureCard a={a} lens="any" eager={i < 3} />
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>
            )}
          </div>
          {credit && (
            <p className="hero-credit">
              Photo: {credit.creator}, {credit.license}
            </p>
          )}
        </div>
        {narrow && (
          <div className="hero-below">
            <Swiper
              key={wardId ?? 'all'}
              modules={[EffectCards, A11y]}
              effect="cards"
              grabCursor
              cardsEffect={{ perSlideOffset: 9, perSlideRotate: 3, slideShadows: false }}
              className="deck"
            >
              {scoped.slice(0, 8).map((a, i) => (
                <SwiperSlide key={a.id}>
                  <FeatureCard a={a} lens="any" eager={i < 2} />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        )}
      </section>

      <main className="home-main">
        {level === 'country' ? (
          <RegionsSection onTokyo={() => navigate(TOKYO_PAGE, { preventScrollReset: true })} mapHref={hero.map} />
        ) : (
          <AreasSection wardId={wardId} onWard={pickWard} mapHref={hero.map} />
        )}

        <section className="all" id="all" ref={allRef} aria-labelledby="all-title">
          <div className="section-head">
            <h2 id="all-title">{ward ? `All in ${ward.properties.name}` : 'All attractions'}</h2>
            <p className="section-count" aria-live="polite">
              {query ? `${plural(shown.length, 'match', 'matches')} for “${query}”` : plural(shown.length, 'place')}
            </p>
          </div>
          <div className="all-tools">
            <div className="chips" role="group" aria-label="Filter attractions">
              <LayoutGroup id="filters">
                {FILTERS.map((f) => {
                  const n = searched.filter(f.test).length;
                  return (
                    <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                      {filter === f.id && <motion.span layoutId="chip-pill" className="chip-pill" transition={{ duration: 0.3, ease: EASE_OUT }} />}
                      <span className="chip-text">
                        {f.id === 'all' ? 'All' : f.label}
                        <span className="chip-count num">{n}</span>
                      </span>
                    </button>
                  );
                })}
              </LayoutGroup>
            </div>
            <div className="all-tools-end">
              <div className="view-toggle" role="group" aria-label="View">
                {(['grid', 'map'] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
                    {view === v && <motion.span layoutId="view-pill" className="view-pill" transition={{ duration: 0.35, ease: EASE_OUT }} />}
                    <span className="view-text">
                      <Icon name={v === 'grid' ? 'grid' : 'map'} size={16} />
                      {v === 'grid' ? 'Grid' : 'Map'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {view === 'map' ? (
              <motion.div key="map" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
                <HomeMap
                  list={shown}
                  lens="any"
                  onOpen={(id) => go(`/attraction/${id}`)}
                  areaId={level === 'country' ? undefined : wardId}
                  onAreaChange={level === 'country' ? undefined : pickWard}
                />
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
                <Grid list={shown} />
              </motion.div>
            )}
          </AnimatePresence>
          {shown.length === 0 && view === 'grid' && (
            <div className="empty">
              <p>
                Nothing matches {query ? `“${query}”` : 'this filter'}
                {filter !== 'all' && ` with ${activeFilter.label.toLowerCase()} on`}.
              </p>
              <button
                type="button"
                className="button is-quiet"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                Clear search and filters
              </button>
            </div>
          )}
        </section>
      </main>

      <Footer />
      {narrow && <BottomTabs />}
    </div>
  );
}

function Grid({ list }: { list: Attraction[] }) {
  return (
    <motion.ul className="grid" layout>
      <AnimatePresence mode="popLayout" initial={false}>
        {list.map((a) => (
          <motion.li
            key={a.id}
            layout
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            <TileCard a={a} lens="any" />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

/** The sub-place filter in the hero: Japan's regions, or Tokyo's wards. */
function ScopeChips({
  level,
  wardId,
  onWard,
  onTokyo,
}: {
  level: Level;
  wardId: string | null;
  onWard: (id: string | null) => void;
  onTokyo: () => void;
}) {
  if (level === 'country') {
    return (
      <div className="scope" role="group" aria-label="Regions of Japan">
        <button type="button" className="scope-chip is-live" onClick={onTokyo}>
          <span className="scope-text">
            Tokyo <span className="num">{ATTRACTIONS.length}</span>
          </span>
        </button>
        {JAPAN_SOON.map((n) => (
          <span key={n} className="scope-chip is-soon" aria-disabled="true" title="Coming soon">
            <span className="scope-text">
              {n} <span>Soon</span>
            </span>
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="scope" role="group" aria-label="Filter by ward">
      <LayoutGroup id="scope">
        {[{ id: null as string | null, name: 'All of Tokyo', count: ATTRACTIONS.length }, ...AREAS.map((a) => ({ id: a.id as string | null, name: a.properties.name, count: a.count }))].map(
          (c) => {
            const on = wardId === c.id;
            return (
              <button key={c.id ?? 'all'} type="button" className="scope-chip" aria-pressed={on} onClick={() => onWard(c.id)}>
                {on && <motion.span layoutId="scope-pill" className="scope-pill" transition={{ duration: 0.4, ease: EASE_OUT }} />}
                <span className="scope-text">
                  {c.name} <span className="num">{c.count}</span>
                </span>
              </button>
            );
          },
        )}
      </LayoutGroup>
    </div>
  );
}

function AreasSection({ wardId, onWard, mapHref }: { wardId: string | null; onWard: (id: string | null) => void; mapHref: string }) {
  const go = useGo();
  return (
    <section className="areas" aria-labelledby="areas-title">
      <div className="section-head">
        <h2 id="areas-title">Explore by area</h2>
        <a className="text-link" href={mapHref} onClick={(e) => (e.preventDefault(), go(mapHref))}>
          Open the map
          <Icon name="arrowRight" />
        </a>
      </div>
      <ul className="area-row">
        {AREAS.map((a) => (
          <li key={a.id}>
            <button type="button" className={`area-card ${wardId === a.id ? 'is-on' : ''}`} aria-pressed={wardId === a.id} onClick={() => onWard(wardId === a.id ? null : a.id)}>
              <img src={photo(a.cover)} alt="" loading="lazy" />
              <span className="area-text">
                <strong>{a.properties.name}</strong>
                <span lang="ja">{a.properties.ja}</span>
              </span>
              <span className="area-count num">{a.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RegionsSection({ onTokyo, mapHref }: { onTokyo: () => void; mapHref: string }) {
  const go = useGo();
  return (
    <section className="areas" aria-labelledby="areas-title">
      <div className="section-head">
        <h2 id="areas-title">Explore by region</h2>
        <a className="text-link" href={mapHref} onClick={(e) => (e.preventDefault(), go(mapHref))}>
          Open the map
          <Icon name="arrowRight" />
        </a>
      </div>
      <ul className="region-row">
        <li>
          <button type="button" className="area-card is-big" onClick={onTokyo}>
            <img src={photo(TOKYO_COVER)} alt="" loading="lazy" />
            <span className="area-text">
              <strong>Tokyo</strong>
              <span lang="ja">東京</span>
            </span>
            <span className="area-count num">{ATTRACTIONS.length}</span>
          </button>
        </li>
        {JAPAN_SOON.map((n) => (
          <li key={n}>
            <div className="soon-card">
              <strong>{n}</strong>
              <span>Coming soon</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Countries we haven't checked yet: their landmarks and a way back to what's live. */
function ComingSoon({ d }: { d: Destination }) {
  const go = useGo();
  const narrow = useMedia('(max-width: 760px)');
  const cover = d.landmarks[0];
  const credit = creditFor(cover.photo);
  useEffect(() => {
    document.title = `${d.name}: coming soon · Fitline`;
    window.scrollTo(0, 0);
  }, [d]);
  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-stage is-soon">
          <img className="hero-photo" src={photo(cover.photo, 1600)} alt={cover.name} fetchPriority="high" />
          <div className="hero-scrim" aria-hidden="true" />
          <TopNav tone="glass" />
          <div className="hero-grid">
            <div className="hero-copy">
              <nav className="hero-crumbs" aria-label="Where you are">
                <a href="/" onClick={(e) => (e.preventDefault(), go('/'))}>
                  World
                </a>
              </nav>
              <KineticTitle text={d.name} sub={d.local} className="hero-title" width={d.name.length > 10 ? 80 : 104} delay={0.2} />
              <p className="hero-line">{d.oneLiner}</p>
              <p className="soon-pill">We’re checking attractions in {d.name} next.</p>
              <div className="explore-actions">
                <button type="button" className="button is-inverse-light" onClick={() => go(TOKYO_PAGE)}>
                  Explore Tokyo meanwhile
                  <Icon name="arrowRight" />
                </button>
              </div>
            </div>
          </div>
          {credit && (
            <p className="hero-credit">
              Photo: {credit.creator}, {credit.license}
            </p>
          )}
        </div>
      </section>
      <main className="home-main">
        <section className="areas" aria-labelledby="sights-title">
          <div className="section-head">
            <h2 id="sights-title">Places we’ll check in {d.name}</h2>
          </div>
          <ul className="sights">
            {d.landmarks.map((l) => (
              <li key={l.photo}>
                <figure>
                  <img src={photo(l.photo)} alt={l.name} loading="lazy" />
                  <figcaption>{l.name}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
      {narrow && <BottomTabs />}
    </div>
  );
}
