import { forwardRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ATTRACTIONS } from '../data/attractions';
import type { Destination } from '../data/destinations';
import { EASE_OUT } from '../lib/motion';
import { photo } from '../lib/photos';
import { plural } from '../lib/format';
import { KineticTitle } from './KineticTitle';
import { Icon } from './Icon';

interface Props {
  dest: Destination;
  /** 'tour': the destination lit on the turning globe, the whole card flies in.
   *  'pinned': a coming-soon country we have flown to, with a way on to Tokyo. */
  mode: 'tour' | 'pinned';
  onOpen: () => void;
  onTokyo: () => void;
}

/** Photo fan, name and one-liner for a destination, tethered to its country on the map. */
export const GlobeCard = forwardRef<HTMLDivElement, Props>(function GlobeCard({ dest, mode, onOpen, onTokyo }, ref) {
  const status = dest.live ? `${plural(ATTRACTIONS.length, 'attraction')} checked in Tokyo` : 'Coming soon';
  return (
    <div ref={ref} className={`globe-card is-${mode} ${dest.live ? 'is-live' : ''}`}>
      <span className="globe-fan" aria-hidden="true">
        <AnimatePresence initial={false}>
          {dest.landmarks.map((l, i) => (
            <motion.img
              key={`${dest.slug}-${l.photo}`}
              src={photo(l.photo)}
              alt=""
              className={`fan-${i}`}
              initial={{ opacity: 0, y: 24, rotate: 0, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, rotate: [-7, 0, 7][i], scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: EASE_OUT }}
            />
          ))}
        </AnimatePresence>
      </span>
      <span className="globe-card-body">
        <KineticTitle as="span" text={dest.name} sub={dest.local} className="globe-name" width={dest.name.length > 10 ? 78 : 100} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={dest.slug}
            className="globe-line"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            {dest.oneLiner}
          </motion.span>
        </AnimatePresence>
        {mode === 'tour' ? (
          <span className="globe-status">
            <span className={dest.live ? 'is-live' : ''}>{status}</span>
            <Icon name="arrowRight" size={16} />
          </span>
        ) : (
          <span className="globe-pinned">
            <span className="globe-soon">Coming soon</span>
            <button type="button" className="button" onClick={onTokyo}>
              Explore Tokyo meanwhile
              <Icon name="arrowRight" size={16} />
            </button>
          </span>
        )}
      </span>
      {mode === 'tour' && (
        <button type="button" className="globe-card-hit" onClick={onOpen} aria-label={`${dest.name}: ${dest.oneLiner} ${status}. Fly in`} />
      )}
    </div>
  );
});
