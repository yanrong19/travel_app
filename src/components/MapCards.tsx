import { useEffect, useRef } from 'react';
import type { Attraction } from '../data/types';
import { areaById } from '../data/places';
import { readings } from '../lib/factors';
import { lensRating, lensWord, type LensId } from '../lib/lens';
import { photo } from '../lib/photos';
import { HeartButton } from './Chrome';
import { Icon } from './Icon';
import { Station } from './Station';

/** A list row that mirrors a map ticker: hovering one lights up the other. */
export function PanelRow({
  a,
  hot,
  onHover,
  onOpen,
  showArea,
  lens = 'any',
  axis = 'block',
}: {
  a: Attraction;
  hot: boolean;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
  showArea: boolean;
  lens?: LensId;
  /** Which way the surrounding list scrolls, so the hot row can slide into view. */
  axis?: 'block' | 'inline';
}) {
  const r = readings(a);
  const ref = useRef<HTMLButtonElement>(null);
  const word = lensWord(a, lens);
  useEffect(() => {
    if (!hot) return;
    ref.current?.scrollIntoView(axis === 'inline' ? { inline: 'center', block: 'nearest', behavior: 'smooth' } : { block: 'nearest', behavior: 'smooth' });
  }, [hot, axis]);
  return (
    <button
      ref={ref}
      type="button"
      className={`prow ${hot ? 'is-hot' : ''}`}
      onPointerEnter={() => onHover(a.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(a.id)}
      onBlur={() => onHover(null)}
      onClick={() => onOpen(a.id)}
    >
      <img src={photo(a.id)} alt="" loading="lazy" />
      <span className="prow-text">
        <strong>{a.name}</strong>
        <span className="prow-meta">
          {a.kind}
          {showArea && <> in {areaById(a.area)?.properties.name}</>}
        </span>
        <span className="prow-facts">
          <span>
            <Icon name="clock" size={13} />
            <span className="num">{r.logistics}</span>
          </span>
          <span>
            <Icon name="yen" size={13} />
            <span className="num">{r.cost}</span>
          </span>
          {word ? <span className={`prow-lens is-${lensRating(a, lens)}`}>{word}</span> : <span>{r.conditions}</span>}
        </span>
      </span>
    </button>
  );
}

/** The card that slides up when a ticker is tapped. */
export function PinCard({ a, onOpen, onClose }: { a: Attraction; onOpen: (id: string) => void; onClose: () => void }) {
  const r = readings(a);
  return (
    <article className="pin-card">
      <img src={photo(a.id)} alt="" />
      <div className="pin-card-body">
        <div className="pin-card-head">
          <div>
            <h3>{a.name}</h3>
            <p>
              {a.kind} in {areaById(a.area)?.properties.name}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <ul className="pin-card-facts">
          <li>
            <Station line="conditions" size={16} />
            {r.conditions}
          </li>
          <li>
            <Station line="effort" size={16} />
            {r.effort}
          </li>
          <li>
            <Station line="logistics" size={16} />
            <span className="num">{r.logistics}</span>
          </li>
          <li>
            <Station line="cost" size={16} />
            <span className="num">{r.cost}</span>
          </li>
        </ul>
        <div className="pin-card-actions">
          <button type="button" className="button is-compact" onClick={() => onOpen(a.id)}>
            See the details
            <Icon name="arrowRight" />
          </button>
          <HeartButton id={a.id} name={a.name} tone="solid" size={40} />
        </div>
      </div>
    </article>
  );
}
