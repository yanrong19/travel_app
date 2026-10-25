import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCards, Keyboard, A11y, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-cards';
import { ATTRACTIONS } from '../data/attractions';
import { AREA_COUNTS, TOKYO_AREAS, slug } from '../data/places';
import { KineticTitle } from '../components/KineticTitle';
import { FeatureCard, TileCard } from '../components/AttractionCard';
import { HomeMap } from '../components/HomeMap';
import { BottomTabs, TopNav } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { FILTERS, type FilterId } from '../lib/factors';
import { LENSES, sortByLens, lensRating, type LensId } from '../lib/lens';
import { photo, creditFor } from '../lib/photos';
import { plural } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import { useGo } from '../lib/transition';
import { useMedia } from '../lib/useMedia';

const AREAS = TOKYO_AREAS.filter((a) => AREA_COUNTS[a.id])
  .map((a) => ({ ...a, count: AREA_COUNTS[a.id], cover: ATTRACTIONS.find((x) => x.area === a.id)!.id }))
  .sort((x, y) => y.count - x.count);

const match = (q: string, text: string) => text.toLowerCase().includes(q.trim().toLowerCase());

export default function Home() {
  const go = useGo();
  const narrow = useMedia('(max-width: 760px)');
  const [lens, setLens] = useState<LensId>('any');
  const [filter, setFilter] = useState<FilterId>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const allRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = 'Fitline: Tokyo attractions, checked before you go';
    window.scrollTo(0, 0);
  }, []);

  const picks = useMemo(() => sortByLens(ATTRACTIONS, lens), [lens]);
  const searched = ATTRACTIONS.filter(
    (a) => !query || match(query, `${a.name} ${a.ja} ${a.kind} ${TOKYO_AREAS.find((t) => t.id === a.area)?.properties.name}`),
  );
  const activeFilter = FILTERS.find((f) => f.id === filter)!;
  const shown = sortByLens(searched.filter(activeFilter.test), lens);
  const goodCount = lens === 'any' ? null : ATTRACTIONS.filter((a) => lensRating(a, lens) === 'good').length;
  const heroCredit = creditFor('hero');

  const toResults = () => allRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-stage">
        <img className="hero-photo" src={photo('hero', 1600)} alt="Tokyo's skyline with Mount Fuji behind it" fetchPriority="high" />
        <div className="hero-scrim" aria-hidden="true" />
        <TopNav tone="glass" />

        <div className="hero-grid">
          <div className="hero-copy">
            <KineticTitle text="Tokyo" sub="東京" className="hero-title" width={104} delay={0.2} />
            <p className="hero-line">
              {ATTRACTIONS.length} attractions, each checked for weather, effort, crowds, logistics and real cost before you go.
            </p>

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
              <input
                id="q"
                type="search"
                placeholder="Search temples, markets, Shibuya…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className="search-go" aria-label="Show results">
                <Icon name="arrowRight" size={18} />
              </button>
            </form>

            {!narrow && <Lens lens={lens} setLens={setLens} goodCount={goodCount} />}
          </div>

          {!narrow && (
          <div className="hero-rail" aria-label="Top picks">
              <>
                <div className="rail-head">
                  <h2>{lens === 'any' ? 'Top picks' : `Best on a ${LENSES.find((l) => l.id === lens)!.label.toLowerCase()} day`}</h2>
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
                  key={`rail-${lens}`}
                  modules={[Navigation, Keyboard, A11y]}
                  navigation={{ prevEl: '.rail-prev', nextEl: '.rail-next' }}
                  keyboard={{ enabled: true }}
                  slidesPerView="auto"
                  spaceBetween={18}
                  watchSlidesProgress
                  className="rail"
                >
                  {picks.map((a, i) => (
                    <SwiperSlide key={a.id} className="rail-slide">
                      <FeatureCard a={a} lens={lens} eager={i < 3} />
                    </SwiperSlide>
                  ))}
                </Swiper>
              </>
          </div>
          )}
        </div>
        {heroCredit && <p className="hero-credit">Photo: {heroCredit.creator}, {heroCredit.license}</p>}
        </div>
        {narrow && (
          <div className="hero-below">
            <Lens lens={lens} setLens={setLens} goodCount={goodCount} />
            <Swiper
                    key={`deck-${lens}`}
                    modules={[EffectCards, A11y]}
                    effect="cards"
                    grabCursor
                    cardsEffect={{ perSlideOffset: 9, perSlideRotate: 3, slideShadows: false }}
                    className="deck"
                  >
                    {picks.slice(0, 8).map((a, i) => (
                      <SwiperSlide key={a.id}>
                        <FeatureCard a={a} lens={lens} eager={i < 2} />
                      </SwiperSlide>
                    ))}
                  </Swiper>
          </div>
        )}
      </section>

      <main className="home-main">
        <section className="areas" aria-labelledby="areas-title">
          <div className="section-head">
            <h2 id="areas-title">Explore by area</h2>
            <a
              className="text-link"
              href="/map/japan/tokyo"
              onClick={(e) => {
                e.preventDefault();
                go('/map/japan/tokyo');
              }}
            >
              Open the map
              <Icon name="arrowRight" />
            </a>
          </div>
          <ul className="area-row">
            {AREAS.map((a) => (
              <li key={a.id}>
                <a
                  className="area-card"
                  href={`/map/japan/tokyo/${slug(a.properties.name)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    go(`/map/japan/tokyo/${slug(a.properties.name)}`);
                  }}
                >
                  <img src={photo(a.cover)} alt="" loading="lazy" />
                  <span className="area-text">
                    <strong>{a.properties.name}</strong>
                    <span lang="ja">{a.properties.ja}</span>
                  </span>
                  <span className="area-count num">{a.count}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="all" id="all" ref={allRef} aria-labelledby="all-title">
          <div className="section-head">
            <h2 id="all-title">All attractions</h2>
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
            {view === 'map' && !narrow && (
              <div className="lens-mini" role="group" aria-label="Planning for">
                {LENSES.map((l) => (
                  <button key={l.id} type="button" aria-pressed={lens === l.id} onClick={() => setLens(l.id)} title={l.label}>
                    <Icon name={l.icon} size={17} />
                    <span className="sr-only">{l.label}</span>
                  </button>
                ))}
              </div>
            )}
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
              <HomeMap list={shown} lens={lens} onOpen={(id) => go(`/attraction/${id}`)} />
            </motion.div>
          ) : (
          <motion.div key="grid" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
          <motion.ul className="grid" layout>
            <AnimatePresence mode="popLayout" initial={false}>
              {shown.map((a) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                >
                  <TileCard a={a} lens={lens} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
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

function Lens({ lens, setLens, goodCount }: { lens: LensId; setLens: (l: LensId) => void; goodCount: number | null }) {
  return (
    <>
              <div className="lens" role="group" aria-labelledby="lens-label">
                <span id="lens-label" className="lens-label">
                  Planning for
                </span>
                <div className="lens-options">
                  {LENSES.map((l) => (
                    <button key={l.id} type="button" aria-pressed={lens === l.id} onClick={() => setLens(l.id)}>
                      {lens === l.id && <motion.span layoutId="lens-pill" className="lens-pill" transition={{ duration: 0.35, ease: EASE_OUT }} />}
                      <span className="lens-text">
                        <Icon name={l.icon} size={16} />
                        {l.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="lens-note" aria-live="polite">
                {goodCount == null
                  ? 'Pick a weather and the cards sort themselves by how well they cope.'
                  : `${plural(goodCount, 'attraction')} cope well. The best fits come first.`}
              </p>
      </>
  );
}

export function Footer() {
  const go = useGo();
  return (
    <footer className="footer">
      <div className="footer-row">
        <p>A prototype. Attraction details are sample data and haven’t been checked yet.</p>
        <a
          href="/credits"
          onClick={(e) => {
            e.preventDefault();
            go('/credits');
          }}
        >
          Photo credits
        </a>
      </div>
    </footer>
  );
}
