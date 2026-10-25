import { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, EffectCards, Keyboard, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-cards';
import { ATTRACTIONS } from '../../data/attractions';
import { areaById } from '../../data/places';
import type { Attraction } from '../../data/types';
import { FeatureCard, TileCard } from '../AttractionCard';
import { Icon } from '../Icon';
import { GuideCard } from './GuideCard';
import { WARDS } from './WardList';
import { FILTERS, type FilterId } from '../../lib/factors';
import { plural } from '../../lib/format';
import { EASE_OUT } from '../../lib/motion';
import { photo } from '../../lib/photos';
import { summarize } from '../../lib/summary';
import { useMedia } from '../../lib/useMedia';

const match = (q: string, text: string) => text.toLowerCase().includes(q.trim().toLowerCase());

/** "Buddhist temple" + "Food market" → "Buddhist temple, food market". */
function kindsOf(list: Attraction[]) {
  const kinds = [...new Set(list.map((a) => a.kind))];
  return kinds.map((k, i) => (i === 0 ? k : k.charAt(0).toLowerCase() + k.slice(1))).join(', ');
}

interface Props {
  /** All of Tokyo, or one ward's code. */
  scope: 'tokyo' | string;
  filter: FilterId;
  setFilter(f: FilterId): void;
  /** Pick a ward: from a guide card at Tokyo, or from the row of neighbours at ward level. */
  onWard(id: string): void;
  /** A ward guide under the pointer, so the sticky bar's thumbnail can follow it. */
  onWardHover?(id: string | null): void;
}

/**
 * What the old Tokyo page held, under the map: the ward guides (or the other wards),
 * the top picks rail and every attraction with its search and filter chips.
 */
export function TokyoSections({ scope, filter, setFilter, onWard, onWardHover }: Props) {
  const narrow = useMedia('(max-width: 760px)');
  const [query, setQuery] = useState('');
  const ward = scope === 'tokyo' ? null : scope;
  const scoped = useMemo(() => (ward ? ATTRACTIONS.filter((a) => a.area === ward) : ATTRACTIONS), [ward]);
  const activeFilter = FILTERS.find((f) => f.id === filter)!;
  const picks = scoped.filter(activeFilter.test);
  const searched = scoped.filter((a) => !query || match(query, `${a.name} ${a.ja} ${a.kind} ${areaById(a.area)?.properties.name}`));
  const shown = searched.filter(activeFilter.test);
  const wardName = ward ? areaById(ward)?.properties.name : null;

  return (
    <div className="tsections">
      {ward ? (
        <section className="areas" aria-labelledby="wards-title">
          <div className="section-head is-tight">
            <h2 id="wards-title">Other wards</h2>
          </div>
          <ul className="area-row">
            {WARDS.filter((w) => w.id !== ward).map((w) => (
              <li key={w.id}>
                <button type="button" className="area-card" onClick={() => onWard(w.id)}>
                  <img src={photo(w.cover)} alt="" loading="lazy" />
                  <span className="area-text">
                    <strong>{w.name}</strong>
                    <span lang="ja">{w.ja}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="gcards">
          {WARDS.map((w) => {
            const all = ATTRACTIONS.filter((a) => a.area === w.id);
            const list = all.filter(activeFilter.test);
            return (
              <GuideCard
                key={w.id}
                photo={w.cover}
                title={w.name}
                ja={w.ja}
                status={`${plural(list.length, 'place')} checked`}
                line={kindsOf(all)}
                summary={summarize(list)}
                foot={all.slice(0, 3).map((a) => a.name).join(' · ')}
                onHover={(on) => onWardHover?.(on ? w.id : null)}
                onPick={() => onWard(w.id)}
              />
            );
          })}
        </div>
      )}

      <section className="picks" aria-labelledby="picks-title">
        <div className="section-head is-tight">
          <h2 id="picks-title">{wardName ? `In ${wardName}` : 'Top picks in Tokyo'}</h2>
          {!narrow && (
            <div className="rail-nav">
              <button type="button" className="round-button rail-prev" aria-label="Previous picks">
                <Icon name="arrowLeft" size={18} />
              </button>
              <button type="button" className="round-button rail-next" aria-label="Next picks">
                <Icon name="arrowRight" size={18} />
              </button>
            </div>
          )}
        </div>
        {narrow ? (
          <Swiper
            key={`${scope}:${filter}`}
            modules={[EffectCards, A11y]}
            effect="cards"
            grabCursor
            cardsEffect={{ perSlideOffset: 9, perSlideRotate: 3, slideShadows: false }}
            className="deck"
          >
            {picks.slice(0, 8).map((a, i) => (
              <SwiperSlide key={a.id}>
                <FeatureCard a={a} lens="any" eager={i < 2} />
              </SwiperSlide>
            ))}
          </Swiper>
        ) : (
          <Swiper
            key={`${scope}:${filter}`}
            modules={[Navigation, Keyboard, A11y]}
            navigation={{ prevEl: '.rail-prev', nextEl: '.rail-next' }}
            keyboard={{ enabled: true }}
            slidesPerView="auto"
            spaceBetween={18}
            watchSlidesProgress
            className="rail"
          >
            {picks.map((a) => (
              <SwiperSlide key={a.id} className="rail-slide">
                <FeatureCard a={a} lens="any" />
              </SwiperSlide>
            ))}
          </Swiper>
        )}
        {picks.length === 0 && <p className="picks-empty">Nothing matches {activeFilter.label.toLowerCase()} here.</p>}
      </section>

      <section className="all" aria-labelledby="all-title">
        <div className="section-head is-tight">
          <h2 id="all-title">{wardName ? `All in ${wardName}` : 'All attractions'}</h2>
          <p className="section-count" aria-live="polite">
            {query ? `${plural(shown.length, 'match', 'matches')} for “${query}”` : plural(shown.length, 'place')}
          </p>
        </div>
        <div className="all-tools">
          <div className="chips" role="group" aria-label="Filter attractions">
            <LayoutGroup id="guide-filters">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {filter === f.id && <motion.span layoutId="guide-chip" className="chip-pill" transition={{ duration: 0.3, ease: EASE_OUT }} />}
                  <span className="chip-text">
                    {f.label}
                    <span className="chip-count num">{searched.filter(f.test).length}</span>
                  </span>
                </button>
              ))}
            </LayoutGroup>
          </div>
          <div className="all-tools-end">
            <form className="search is-plain" role="search" onSubmit={(e) => e.preventDefault()}>
              <Icon name="search" size={18} />
              <label htmlFor="guide-q" className="sr-only">
                Search attractions
              </label>
              <input
                id="guide-q"
                type="search"
                placeholder={wardName ? `Search ${wardName}…` : 'Search temples, markets, Shibuya…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
            </form>
          </div>
        </div>

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
                <TileCard a={a} lens="any" />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>

        {shown.length === 0 && (
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
    </div>
  );
}
