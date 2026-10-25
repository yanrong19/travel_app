import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ATTRACTIONS } from '../data/attractions';
import { areaById, TOKYO_PATH } from '../data/places';
import { mustPay, realTime } from '../lib/factors';
import { duration, plural, yen } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import { photo } from '../lib/photos';
import { useGo } from '../lib/transition';
import { useTrip } from '../lib/trip';
import { Icon } from './Icon';

const SOON = ['Kyoto', 'Osaka', 'Seoul', 'Taipei', 'Singapore'];

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="11" cy="11" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function Wordmark() {
  const go = useGo();
  return (
    <a
      href="/"
      className="wordmark"
      onClick={(e) => {
        e.preventDefault();
        go('/');
      }}
    >
      <Mark />
      <span>Fitline</span>
    </a>
  );
}

/** "Tokyo, Japan" pill that opens a list of cities, with the rest marked as coming soon. */
function CityPicker() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <div className="city" ref={ref}>
      <button type="button" className="city-pill" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <Icon name="pin" />
        Tokyo, Japan
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="city-menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
          >
            <p className="city-menu-title">Cities</p>
            <button type="button" className="city-item is-live" onClick={() => setOpen(false)}>
              Tokyo <span>16 attractions</span>
            </button>
            {SOON.map((c) => (
              <span key={c} className="city-item" aria-disabled="true">
                {c} <span>Coming soon</span>
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TopNav({ tone = 'solid' }: { tone?: 'glass' | 'solid' }) {
  const go = useGo();
  const { pathname } = useLocation();
  const { ids, setOpen } = useTrip();
  const onMap = pathname.startsWith('/map');
  return (
    <header className={`topnav is-${tone}`}>
      <Wordmark />
      <nav className="topnav-links" aria-label="Main">
        <a href="/" aria-current={pathname === '/' ? 'page' : undefined} onClick={(e) => (e.preventDefault(), go('/'))}>
          Explore
        </a>
        <a href={TOKYO_PATH} aria-current={onMap ? 'page' : undefined} onClick={(e) => (e.preventDefault(), go(TOKYO_PATH))}>
          Map
        </a>
        <button type="button" onClick={() => setOpen(true)}>
          Saved
        </button>
      </nav>
      <div className="topnav-end">
        <CityPicker />
        <button type="button" className="saved-button" onClick={() => setOpen(true)} aria-label={`Saved, ${plural(ids.length, 'place')}`}>
          <Icon name="heart" filled={ids.length > 0} size={18} />
          {ids.length > 0 && <span className="saved-count num">{ids.length}</span>}
        </button>
      </div>
    </header>
  );
}

/** Phone tab bar. */
export function BottomTabs() {
  const go = useGo();
  const { pathname } = useLocation();
  const { ids, setOpen } = useTrip();
  const onMap = pathname.startsWith('/map');
  return (
    <nav className="tabs" aria-label="Main">
      <button type="button" aria-current={pathname === '/' ? 'page' : undefined} onClick={() => go('/')}>
        <Icon name="home" size={20} />
        Explore
      </button>
      <button type="button" aria-current={onMap ? 'page' : undefined} onClick={() => go(TOKYO_PATH)}>
        <Icon name="map" size={20} />
        Map
      </button>
      <button type="button" onClick={() => setOpen(true)}>
        <span className="tabs-icon">
          <Icon name="heart" size={20} filled={ids.length > 0} />
          {ids.length > 0 && <span className="tabs-badge num">{ids.length}</span>}
        </span>
        Saved
      </button>
    </nav>
  );
}

/** Heart toggle used on cards and pages. */
export function HeartButton({ id, name, tone = 'glass', size = 40 }: { id: string; name: string; tone?: 'glass' | 'solid'; size?: number }) {
  const { has, toggle } = useTrip();
  const saved = has(id);
  return (
    <motion.button
      type="button"
      className={`heart is-${tone} ${saved ? 'is-on' : ''}`}
      style={{ width: size, height: size }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
      whileTap={{ scale: 0.86 }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle(id);
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={saved ? 'on' : 'off'}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          style={{ display: 'grid' }}
        >
          <Icon name="heart" filled={saved} size={Math.round(size * 0.45)} />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

export function SavedDrawer() {
  const { ids, open, setOpen, remove } = useTrip();
  const go = useGo();
  const items = ids.map((id) => ATTRACTIONS.find((a) => a.id === id)).filter(Boolean) as typeof ATTRACTIONS;
  const time = items.reduce<[number, number]>(
    (s, a) => {
      const [lo, hi] = realTime(a);
      return [s[0] + lo, s[1] + hi];
    },
    [0, 0],
  );
  const cost = items.reduce((s, a) => s + mustPay(a), 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          >
            <header className="drawer-head">
              <h2 id="saved-title">Saved in Tokyo</h2>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close saved list" autoFocus>
                <Icon name="close" size={18} />
              </button>
            </header>

            {items.length === 0 ? (
              <div className="drawer-empty">
                <Icon name="heart" size={28} />
                <p>Tap the heart on any attraction to keep it here. Your list adds up the time and cost for you.</p>
              </div>
            ) : (
              <>
                <dl className="drawer-totals">
                  <div>
                    <dt>Places</dt>
                    <dd className="num">{items.length}</dd>
                  </div>
                  <div>
                    <dt>Door to door</dt>
                    <dd className="num">
                      {duration(time[0])} – {duration(time[1])}
                    </dd>
                  </div>
                  <div>
                    <dt>Must-pay</dt>
                    <dd className="num">{yen(cost)}</dd>
                  </div>
                </dl>
                <ul className="drawer-list">
                  <AnimatePresence initial={false}>
                    {items.map((a) => (
                      <motion.li
                        key={a.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                      >
                        <button
                          type="button"
                          className="drawer-item"
                          onClick={() => {
                            setOpen(false);
                            go(`/attraction/${a.id}`);
                          }}
                        >
                          <img src={photo(a.id)} alt="" loading="lazy" />
                          <span>
                            <strong>{a.name}</strong>
                            <span>
                              {a.kind} in {areaById(a.area)?.properties.name}
                            </span>
                          </span>
                        </button>
                        <button type="button" className="icon-button" onClick={() => remove(a.id)} aria-label={`Remove ${a.name}`}>
                          <Icon name="close" />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
