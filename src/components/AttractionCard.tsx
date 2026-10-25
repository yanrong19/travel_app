import { useRef } from 'react';
import type { Attraction } from '../data/types';
import { areaById } from '../data/places';
import { flags, readings } from '../lib/factors';
import { lensRating, lensWord, type LensId } from '../lib/lens';
import { photo, photoSet } from '../lib/photos';
import { plural } from '../lib/format';
import { useGo } from '../lib/transition';
import { HeartButton } from './Chrome';
import { Icon } from './Icon';
import { Station } from './Station';

function LensBadge({ a, lens }: { a: Attraction; lens: LensId }) {
  const word = lensWord(a, lens);
  if (!word) return null;
  return <span className={`lens-badge is-${lensRating(a, lens)}`}>{word}</span>;
}

/** Big photo card with frosted factor tiles, used in the hero carousel and the phone deck. */
export function FeatureCard({ a, lens, eager = false }: { a: Attraction; lens: LensId; eager?: boolean }) {
  const go = useGo();
  const img = useRef<HTMLImageElement>(null);
  const r = readings(a);
  const area = areaById(a.area)?.properties.name;
  return (
    <article className="feature">
      <img
        ref={img}
        className="feature-photo"
        src={photo(a.id, 720)}
        srcSet={photoSet(a.id)}
        sizes="(max-width: 760px) 90vw, 360px"
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        draggable={false}
      />
      <div className="feature-top">
        <LensBadge a={a} lens={lens} />
        <HeartButton id={a.id} name={a.name} />
      </div>
      <div className="feature-body">
        <h3 className="feature-name">
          <a
            href={`/attraction/${a.id}`}
            onClick={(e) => {
              e.preventDefault();
              go(`/attraction/${a.id}`, { morph: img.current });
            }}
          >
            {a.name}
          </a>
        </h3>
        <p className="feature-area">
          <Icon name="pin" size={14} />
          {area}
        </p>
        <dl className="tiles">
          <div>
            <dt>
              <Station line="conditions" size={16} /> Weather
            </dt>
            <dd>{r.conditions}</dd>
          </div>
          <div>
            <dt>
              <Station line="effort" size={16} /> Effort
            </dt>
            <dd>{r.effort}</dd>
          </div>
          <div>
            <dt>
              <Station line="logistics" size={16} /> Real time
            </dt>
            <dd className="num">{r.logistics}</dd>
          </div>
          <div>
            <dt>
              <Station line="cost" size={16} /> Must-pay
            </dt>
            <dd className="num">{r.cost}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

/** Grid card: photo on top, details underneath. */
export function TileCard({ a, lens }: { a: Attraction; lens: LensId }) {
  const go = useGo();
  const img = useRef<HTMLImageElement>(null);
  const r = readings(a);
  const missed = flags(a).length;
  const area = areaById(a.area)?.properties.name;
  return (
    <article className="tile">
      <div className="tile-media">
        <img ref={img} src={photo(a.id, 720)} alt="" loading="lazy" draggable={false} />
        <div className="tile-top">
          <LensBadge a={a} lens={lens} />
          <HeartButton id={a.id} name={a.name} size={36} />
        </div>
        <div className="tile-chips">
          <span>
            <Icon name="clock" size={14} />
            <span className="num">{r.logistics}</span>
          </span>
          <span>
            <Icon name="yen" size={14} />
            <span className="num">{r.cost}</span>
          </span>
          <span>
            <Icon name="walk" size={14} />
            {r.effort}
          </span>
        </div>
      </div>
      <div className="tile-body">
        <h3 className="tile-name">
          <a
            href={`/attraction/${a.id}`}
            onClick={(e) => {
              e.preventDefault();
              go(`/attraction/${a.id}`, { morph: img.current });
            }}
          >
            {a.name}
          </a>
          <span className="tile-ja" lang="ja">
            {a.ja}
          </span>
        </h3>
        <p className="tile-meta">
          {a.kind} in {area}
        </p>
        {missed > 0 ? (
          <p className="tile-missed">
            <Icon name="alert" size={14} />
            {plural(missed, 'thing')} easy to miss
          </p>
        ) : (
          <p className="tile-missed is-clear">
            <Icon name="check" size={14} />
            Nothing easy to miss
          </p>
        )}
      </div>
    </article>
  );
}
