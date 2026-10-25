import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ATTRACTIONS } from '../data/attractions';
import { AREA_COUNTS, JAPAN_ID, PREFECTURES, TOKYO_AREAS, TOKYO_PREF_ID, WORLD, areaById, slug, type MapTarget } from '../data/places';
import { EASE_OUT } from '../lib/motion';
import { photo } from '../lib/photos';
import { plural } from '../lib/format';
import { Icon } from './Icon';

type Kind = 'country' | 'pref' | 'area' | 'place';

interface Item {
  key: string;
  kind: Kind;
  label: string;
  ja?: string;
  sub: string;
  live: boolean;
  img?: string;
  /** Extra words that should match, e.g. the area of a place. */
  also?: string;
  pick: () => void;
}

interface Props {
  target: MapTarget;
  onCountry: (slug: string) => void;
  onRegion: () => void;
  onArea: (slug: string) => void;
  onAttraction: (id: string) => void;
  onNotice: (text: string) => void;
}

/** Lower case without accents, so "taito" finds Taitō. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function score(item: Item, q: string) {
  const label = norm(item.label);
  if (label.startsWith(q)) return 0;
  if (label.split(/[\s-]+/).some((w) => w.startsWith(q))) return 1;
  if (label.includes(q) || (item.ja ?? '').includes(q) || norm(item.also ?? '').includes(q)) return 2;
  return -1;
}

const SECTION: Record<Kind, string> = { country: 'Countries', pref: 'Prefectures', area: 'Wards and cities', place: 'Places' };

/** Search that changes with the map level: countries, then prefectures, then wards and places. */
export function MapSearch({ target, onCountry, onRegion, onArea, onAttraction, onNotice }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const level = target.level;
  const inJapan = target.country?.id === JAPAN_ID;
  const countryName = target.country?.properties.name;

  const { items, placeholder, emptyText } = useMemo(() => {
    if (level === 'world') {
      const list: Item[] = WORLD.map((c) => ({
        key: `c-${c.id}`,
        kind: 'country' as const,
        label: c.properties.name,
        sub: c.id === JAPAN_ID ? `Tokyo: ${plural(ATTRACTIONS.length, 'attraction')} checked` : 'No attractions yet',
        live: c.id === JAPAN_ID,
        pick: () => onCountry(slug(c.properties.name)),
      })).sort((a, b) => Number(b.live) - Number(a.live) || a.label.localeCompare(b.label));
      return { items: list, placeholder: 'Search countries', emptyText: 'No country by that name.' };
    }
    if (level === 'country') {
      if (!inJapan) {
        return {
          items: [] as Item[],
          placeholder: `Search regions in ${countryName}`,
          emptyText: `No regions mapped in ${countryName} yet. Japan is the first country with checked attractions.`,
        };
      }
      const list: Item[] = PREFECTURES.map((p) => ({
        key: `p-${p.id}`,
        kind: 'pref' as const,
        label: p.properties.name,
        sub: p.id === TOKYO_PREF_ID ? plural(ATTRACTIONS.length, 'attraction') : 'Coming soon',
        live: p.id === TOKYO_PREF_ID,
        pick: () =>
          p.id === TOKYO_PREF_ID ? onRegion() : onNotice(`${p.properties.name} isn’t mapped yet. Tokyo is the first prefecture with checked attractions.`),
      })).sort((a, b) => Number(b.live) - Number(a.live) || a.label.localeCompare(b.label));
      return { items: list, placeholder: 'Search prefectures in Japan', emptyText: 'No prefecture by that name.' };
    }
    // Tokyo and its wards: places first, then areas.
    const scope = target.area?.id;
    const places: Item[] = ATTRACTIONS.filter((a) => !scope || a.area === scope).map((a) => {
      const area = areaById(a.area)?.properties.name ?? '';
      return {
        key: `a-${a.id}`,
        kind: 'place' as const,
        label: a.name,
        ja: a.ja,
        sub: `${a.kind} in ${area}`,
        also: `${a.kind} ${area}`,
        live: true,
        img: photo(a.id),
        pick: () => onAttraction(a.id),
      };
    });
    const areas: Item[] = TOKYO_AREAS.filter((a) => Number(a.id) < 13300)
      .map((a) => {
        const n = AREA_COUNTS[a.id] ?? 0;
        return {
          key: `w-${a.id}`,
          kind: 'area' as const,
          label: a.properties.name,
          ja: a.properties.ja,
          sub: n ? plural(n, 'attraction') : 'Nothing checked yet',
          live: n > 0,
          pick: () => (n ? onArea(slug(a.properties.name)) : onNotice(`No attractions checked in ${a.properties.name} yet.`)),
        };
      })
      .sort((a, b) => Number(b.live) - Number(a.live) || a.label.localeCompare(b.label));
    return {
      items: [...places, ...areas],
      placeholder: scope ? `Search ${target.area!.properties.name} and other wards` : 'Search Tokyo’s wards and places',
      emptyText: 'Nothing in Tokyo matches that yet.',
    };
  }, [level, inJapan, countryName, target.area, onCountry, onRegion, onArea, onAttraction, onNotice]);

  const q = norm(query.trim());
  const results = useMemo(() => {
    if (!q) {
      // Before typing: the live entries first, then a handful of the rest.
      if (level === 'region' || level === 'area') return items.filter((i) => i.kind === 'area' ? i.live : true).slice(0, 14);
      return items.slice(0, 12);
    }
    return items
      .map((i) => ({ i, s: score(i, q) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => a.s - b.s || Number(b.i.live) - Number(a.i.live))
      .map((r) => r.i)
      .slice(0, 30);
  }, [items, q, level]);

  // A new level means a new list.
  useEffect(() => {
    setQuery('');
    setActive(0);
  }, [level, target.country?.id, target.area?.id]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    item.pick();
    setQuery('');
    setOpen(false);
    input.current?.blur();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      if (query) setQuery('');
      else {
        setOpen(false);
        input.current?.blur();
      }
    }
  };

  const showList = open;
  const activeId = results[active] ? `${listId}-${results[active].key}` : undefined;

  return (
    <div ref={box} className={`msearch ${showList ? 'is-open' : ''}`}>
      <div className="msearch-field">
        <Icon name="search" size={18} />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? activeId : undefined}
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button type="button" className="msearch-clear" onClick={() => (setQuery(''), input.current?.focus())} aria-label="Clear search">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showList && (
          <motion.div
            className="msearch-panel"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            {results.length === 0 ? (
              <div className="msearch-empty">
                <p>{emptyText}</p>
                {level === 'country' && !inJapan && (
                  <button type="button" className="text-button" onClick={() => choose({ key: 'jp', kind: 'country', label: 'Japan', sub: '', live: true, pick: () => onCountry('japan') })}>
                    Go to Japan
                  </button>
                )}
              </div>
            ) : (
              <ul id={listId} role="listbox" aria-label={placeholder} className="msearch-list">
                {results.map((item, i) => {
                  const heading = i === 0 || results[i - 1].kind !== item.kind;
                  return (
                    <li key={item.key} role="presentation">
                      {heading && (level === 'region' || level === 'area') && (
                        <p className="msearch-section" role="presentation">
                          {SECTION[item.kind]}
                        </p>
                      )}
                      <div
                        id={`${listId}-${item.key}`}
                        role="option"
                        aria-selected={i === active}
                        data-index={i}
                        className={`msearch-item ${item.live ? 'is-live' : ''} ${i === active ? 'is-active' : ''}`}
                        onMouseEnter={() => setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(item)}
                      >
                        {item.img ? (
                          <img src={item.img} alt="" />
                        ) : (
                          <span className="msearch-icon" aria-hidden="true">
                            <Icon name={item.kind === 'country' ? 'map' : 'pin'} size={16} />
                          </span>
                        )}
                        <span className="msearch-text">
                          <span className="msearch-label">
                            {item.label}
                            {item.ja && (
                              <span className="msearch-ja" lang="ja">
                                {item.ja}
                              </span>
                            )}
                          </span>
                          <span className="msearch-sub">{item.sub}</span>
                        </span>
                        {item.live && item.kind !== 'place' && <span className="msearch-badge">Mapped</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
