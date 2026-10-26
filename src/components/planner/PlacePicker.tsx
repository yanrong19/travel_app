import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { JAPAN_ID } from '../../data/places';
import { REGIONS } from '../../data/regions';
import type { Insets } from '../../map/camera';
import { plural } from '../../lib/format';
import { EASE_OUT, useReducedMotion } from '../../lib/motion';
import { photo } from '../../lib/photos';
import type { PlaceRef } from '../../lib/trips';
import { ALL_PLACES, attractionsIn, placeCover, placeLabel, sameRef } from '../../lib/tripPlaces';
import { Icon } from '../Icon';

// The map engine is large, so it loads only when the picker is shown.
const MapExplorer = lazy(() => import('../../map/MapExplorer'));

const WORLD_TARGET = { level: 'world' as const };
const GLOBE_INSETS: Insets = { top: 20, right: 20, bottom: 20, left: 20 };
const NO_PINS: never[] = [];
const noop = () => {};

const SECTION: Record<PlaceRef['level'], string> = {
  country: 'Destinations',
  region: 'Regions of Japan',
  prefecture: 'Prefectures',
  area: 'Tokyo wards',
};
const LEVEL_ORDER: PlaceRef['level'][] = ['country', 'region', 'prefecture', 'area'];

const NO_DATA = 'No checked attractions yet';

/** Lower case without accents, so "kanto" finds Kantō. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

interface Item {
  key: string;
  ref: PlaceRef;
  label: string;
  local?: string;
  sub: string;
  count: number;
  img: string | null;
}

const ITEMS: Item[] = ALL_PLACES.map((p) => {
  const ref: PlaceRef = { level: p.level, id: p.id };
  const count = attractionsIn(ref).length;
  const cover = placeCover(ref);
  return {
    key: `${p.level}-${p.id}`,
    ref,
    label: p.label,
    local: placeLabel(ref).local,
    sub: `${p.sub} · ${count ? `${plural(count, 'attraction')} checked` : NO_DATA}`,
    count,
    img: cover ? photo(cover) : null,
  };
}).sort((a, b) => LEVEL_ORDER.indexOf(a.ref.level) - LEVEL_ORDER.indexOf(b.ref.level));

function score(item: Item, q: string) {
  const label = norm(item.label);
  if (label.startsWith(q)) return 0;
  if (label.split(/[\s-]+/).some((w) => w.startsWith(q))) return 1;
  if (label.includes(q) || (item.local ?? '').includes(q)) return 2;
  return -1;
}

interface Props {
  value: PlaceRef[];
  onChange: (next: PlaceRef[]) => void;
  /** Rendered at the end of the side column (under the picked places). */
  footer?: ReactNode;
}

/**
 * Picks the places a trip is built from. The globe picks countries (any country) and never drills
 * down; deeper places come from the search, or from quick chips for Japan's regions once Japan is in.
 */
export function PlacePicker({ value, onChange, footer }: Props) {
  const reduced = useReducedMotion();
  const [said, setSaid] = useState('');
  const has = (ref: PlaceRef) => value.some((p) => sameRef(p, ref));

  const toggle = (ref: PlaceRef) => {
    const name = placeLabel(ref).name;
    if (has(ref)) {
      onChange(value.filter((p) => !sameRef(p, ref)));
      setSaid(`Removed ${name}.`);
    } else {
      onChange([...value, { ...ref }]);
      setSaid(`Added ${name}.`);
    }
  };

  const lit = useMemo(() => value.filter((p) => p.level === 'country').map((p) => p.id), [value]);
  const japan = has({ level: 'country', id: JAPAN_ID });

  return (
    <div className="pp">
      <div className="pp-side">
        <PlaceSearch picked={value} onToggle={toggle} />

        <AnimatePresence initial={false}>
          {japan && (
            <motion.section
              key="regions"
              className="pp-regions"
              aria-labelledby="pp-regions-title"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: reduced ? 0 : 0.25, ease: EASE_OUT }}
            >
              <h2 id="pp-regions-title" className="pp-label">
                Narrow Japan down
              </h2>
              <div className="pp-rchips" role="group" aria-labelledby="pp-regions-title">
                {REGIONS.map((r) => {
                  const ref: PlaceRef = { level: 'region', id: r.id };
                  return (
                    <button key={r.id} type="button" className="rchip" aria-pressed={has(ref)} onClick={() => toggle(ref)}>
                      {r.live && <span className="live-dot" aria-hidden="true" />}
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <section className="pp-picked" aria-labelledby="pp-picked-title">
          <h2 id="pp-picked-title" className="pp-label">
            Your places{value.length > 0 && <span className="num"> · {value.length}</span>}
          </h2>
          {value.length === 0 ? (
            <p className="pp-empty">Tap a country on the globe, or search for a region, prefecture or Tokyo ward.</p>
          ) : (
            <ul className="pp-chips">
              {value.map((ref) => (
                <PickedChip key={`${ref.level}-${ref.id}`} place={ref} onRemove={() => toggle(ref)} />
              ))}
            </ul>
          )}
        </section>

        {footer && <div className="pp-foot">{footer}</div>}
      </div>

      <div className="pp-globe">
        <Suspense fallback={<div className="map-loading" aria-hidden="true" />}>
          <MapExplorer
            target={WORLD_TARGET}
            insets={GLOBE_INSETS}
            pins={NO_PINS}
            hoverId={null}
            tour={false}
            litCountries={lit}
            wheelScrollsPage
            onWorldPick={(worldId) => toggle({ level: 'country', id: worldId })}
            onHover={noop}
            onCountry={noop}
            onRegion={noop}
            onArea={noop}
            onAttraction={noop}
            onNotice={noop}
          />
        </Suspense>
        <p className="pp-globe-hint" aria-hidden="true">
          <Icon name="globe" size={15} />
          Tap a country to add or remove it
        </p>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

function PickedChip({ place, onRemove }: { place: PlaceRef; onRemove: () => void }) {
  const { name, kind } = placeLabel(place);
  const cover = placeCover(place);
  const empty = attractionsIn(place).length === 0;
  return (
    <li className="pp-chip">
      {cover ? (
        <img src={photo(cover)} alt="" />
      ) : (
        <span className="pp-chip-icon" aria-hidden="true">
          <Icon name={place.level === 'country' ? 'globe' : 'pin'} size={16} />
        </span>
      )}
      <span className="pp-chip-text">
        <span className="pp-chip-name">{name}</span>
        <span className={`pp-chip-sub ${empty ? 'is-empty' : ''}`}>{empty ? NO_DATA : kind}</span>
      </span>
      <button type="button" className="pp-chip-remove" onClick={onRemove} aria-label={`Remove ${name}`}>
        <Icon name="close" size={14} />
      </button>
    </li>
  );
}

/** Search over every pickable place; picking toggles it in the trip. */
function PlaceSearch({ picked, onToggle }: { picked: PlaceRef[]; onToggle: (ref: PlaceRef) => void }) {
  const reduced = useReducedMotion();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const label = 'Search countries, regions, prefectures and wards';

  const q = norm(query.trim());
  const results = useMemo(() => {
    if (!q) return ITEMS;
    return ITEMS.map((i) => ({ i, s: score(i, q) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => LEVEL_ORDER.indexOf(a.i.ref.level) - LEVEL_ORDER.indexOf(b.i.ref.level) || a.s - b.s)
      .map((r) => r.i)
      .slice(0, 30);
  }, [q]);

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
    onToggle(item.ref);
    setQuery('');
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open) choose(results[active]);
      else setOpen(true);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      if (query) setQuery('');
      else setOpen(false);
    }
  };

  const activeId = open && results[active] ? `${listId}-${results[active].key}` : undefined;

  return (
    <div
      ref={box}
      className={`msearch is-inline ${open ? 'is-open' : ''}`}
      // Tabbing (or any focus move) out of the search closes its list, so it never covers what's below.
      onBlur={(e) => !box.current?.contains(e.relatedTarget as Node | null) && setOpen(false)}
    >
      <div className="msearch-field">
        <Icon name="search" size={18} />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label={label}
          placeholder="Search countries, regions and wards"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
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
        {open && (
          <motion.div
            className="msearch-panel"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: reduced ? 0 : 0.18, ease: EASE_OUT }}
          >
            {results.length === 0 ? (
              <div className="msearch-empty">
                <p>No place by that name. Countries without data can be picked on the globe.</p>
              </div>
            ) : (
              <ul
                id={listId}
                role="listbox"
                aria-label={label}
                className="msearch-list"
                // Chrome puts a scrolling box in the tab order, which would keep Tab inside the search.
                tabIndex={-1}
                data-lenis-prevent
              >
                {results.map((item, i) => {
                  const heading = i === 0 || results[i - 1].ref.level !== item.ref.level;
                  const on = picked.some((p) => sameRef(p, item.ref));
                  return (
                    <li key={item.key} role="presentation">
                      {heading && (
                        <p className="msearch-section" role="presentation">
                          {SECTION[item.ref.level]}
                        </p>
                      )}
                      <div
                        id={`${listId}-${item.key}`}
                        role="option"
                        aria-selected={i === active}
                        data-index={i}
                        className={`msearch-item ${item.count ? 'is-live' : ''} ${i === active ? 'is-active' : ''}`}
                        onMouseEnter={() => setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(item)}
                      >
                        {item.img ? (
                          <img src={item.img} alt="" />
                        ) : (
                          <span className="msearch-icon" aria-hidden="true">
                            <Icon name="pin" size={16} />
                          </span>
                        )}
                        <span className="msearch-text">
                          <span className="msearch-label">
                            {item.label}
                            {item.local && (
                              <span className="msearch-ja" lang={item.ref.level === 'country' ? undefined : 'ja'}>
                                {item.local}
                              </span>
                            )}
                          </span>
                          <span className="msearch-sub">{item.sub}</span>
                        </span>
                        {on && (
                          <span className="msearch-badge pp-added">
                            <Icon name="check" size={12} />
                            Added
                          </span>
                        )}
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
