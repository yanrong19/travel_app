import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Attraction } from '../data/types';
import { areaById, areaBySlug, slug, targetFromParams } from '../data/places';
import type { LensId } from '../lib/lens';
import { plural } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import { useMedia } from '../lib/useMedia';
import { Icon } from './Icon';
import { PanelRow, PinCard } from './MapCards';

const NOOP = () => {};
// The map engine is large, so it loads only when a map is first shown.
const MapExplorer = lazy(() => import('../map/MapExplorer'));

/** The list and a map of Tokyo side by side; each list row has a ticker on the map. */
export function HomeMap({
  list,
  lens,
  onOpen,
  areaId: areaProp,
  onAreaChange,
}: {
  list: Attraction[];
  lens: LensId;
  onOpen: (id: string) => void;
  /** When the page owns the ward filter, it passes it in and hears about changes. */
  areaId?: string | null;
  onAreaChange?: (id: string | null) => void;
}) {
  const narrow = useMedia('(max-width: 760px)');
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [ownArea, setOwnArea] = useState<string | null>(null);
  const areaId = areaProp !== undefined ? areaProp : ownArea;
  const setAreaId = (id: string | null) => (onAreaChange ? onAreaChange(id) : setOwnArea(id));

  const area = areaId ? areaById(areaId) : undefined;
  const target = useMemo(
    () => (area ? targetFromParams('japan', 'tokyo', slug(area.properties.name)) : targetFromParams('japan', 'tokyo')),
    [area],
  );
  const shown = area ? list.filter((a) => a.area === area.id) : list;
  const pickedItem = picked ? shown.find((a) => a.id === picked) ?? null : null;

  // A filter or search that hides the picked place also closes its card.
  useEffect(() => {
    if (picked && !shown.some((a) => a.id === picked)) setPicked(null);
  }, [shown, picked]);

  const insets = { top: 20, right: 20, bottom: pickedItem ? (narrow ? 200 : 210) : 20, left: 20 };

  return (
    <div className="hmap">
      <div className="hmap-list">
        <div className="hmap-list-head">
          {area ? (
            <button type="button" className="area-chip" onClick={() => setAreaId(null)}>
              {area.properties.name}
              <Icon name="close" size={14} />
              <span className="sr-only">Show all of Tokyo</span>
            </button>
          ) : (
            <p>All of Tokyo</p>
          )}
          <span className="section-count">{plural(shown.length, 'place')}</span>
        </div>
        <ul className={narrow ? 'mrow' : 'plist'}>
          {shown.map((a) => (
            <li key={a.id}>
              <PanelRow
                a={a}
                hot={(picked ?? hover) === a.id}
                onHover={setHover}
                onOpen={narrow ? setPicked : onOpen}
                showArea={!area}
                lens={lens}
                axis={narrow ? 'inline' : 'block'}
              />
            </li>
          ))}
          {shown.length === 0 && <li className="empty-line">Nothing here matches your filters.</li>}
        </ul>
      </div>

      <div className="hmap-stage">
        <Suspense fallback={<div className="map-loading" aria-hidden="true" />}>
        <MapExplorer
          embed
          fitPins
          target={target}
          insets={insets}
          pins={shown}
          lens={lens}
          hoverId={hover}
          selectedId={picked}
          onHover={setHover}
          onAttraction={(id) => setPicked((p) => (p === id ? null : id))}
          onArea={(s) => {
            setAreaId(areaBySlug(s)?.id ?? null);
            setPicked(null);
          }}
          onRegion={NOOP}
          onCountry={NOOP}
          onNotice={NOOP}
        />
        </Suspense>
        <AnimatePresence>
          {pickedItem && (
            <motion.div
              key={pickedItem.id}
              className="hmap-card"
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.98 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
            >
              <PinCard a={pickedItem} onOpen={onOpen} onClose={() => setPicked(null)} />
            </motion.div>
          )}
        </AnimatePresence>
        {!area && <p className="hmap-tip">Tap a ward to zoom in, or a ticker to see the place.</p>}
      </div>
    </div>
  );
}
