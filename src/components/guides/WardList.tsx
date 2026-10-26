import { ATTRACTIONS } from '../../data/attractions';
import { AREA_COUNTS, TOKYO_AREAS } from '../../data/places';
import { useRevealLit } from '../../lib/listScroll';
import { photo } from '../../lib/photos';

export interface Ward {
  /** The numeric ward code, as used by the map's `fl-areas` ids. */
  id: string;
  name: string;
  ja: string;
  /** Attraction id whose photo stands for the ward. */
  cover: string;
}

/** Tokyo's wards with checked attractions, the fullest first. */
export const WARDS: Ward[] = TOKYO_AREAS.filter((a) => AREA_COUNTS[a.id])
  .map((a) => ({
    id: a.id,
    name: a.properties.name,
    ja: a.properties.ja ?? '',
    cover: ATTRACTIONS.find((x) => x.area === a.id)!.id,
  }))
  .sort((x, y) => AREA_COUNTS[y.id] - AREA_COUNTS[x.id]);

interface Props {
  /** How many attractions each ward has under the active filter. */
  counts: Record<string, number>;
  hot: string | null;
  /** Faded out under the guide sheet: out of the tab order and the pointer's reach. */
  inert?: boolean;
  onHover(id: string | null): void;
  onPick(id: string): void;
}

/** The right-hand panel at Tokyo level: the wards, fullest first, linked to the map. */
export function WardList({ counts, hot, inert, onHover, onPick }: Props) {
  // A ward lit from the map scrolls into the list's view when it sits below the fold.
  const reveal = useRevealLit<HTMLUListElement>(hot ? `[data-ward="${hot}"]` : null);
  return (
    <aside
      className="panel"
      aria-labelledby="panel-title"
      inert={inert}
      onPointerEnter={reveal.onPointerEnter}
      onPointerLeave={() => {
        reveal.onPointerLeave();
        onHover(null);
      }}
    >
      <div className="panel-head">
        <h2 id="panel-title">Wards of Tokyo</h2>
        <p className="panel-scope">{WARDS.length} wards</p>
      </div>
      <ul ref={reveal.list} className="wlist" data-lenis-prevent>
        {WARDS.map((w) => {
          const n = counts[w.id] ?? 0;
          return (
            <li key={w.id}>
              <button
                type="button"
                data-ward={w.id}
                className={`wrow ${hot === w.id ? 'is-hot' : ''} ${n ? '' : 'is-empty'}`}
                onPointerEnter={() => onHover(w.id)}
                onFocus={() => onHover(w.id)}
                onBlur={() => onHover(null)}
                onClick={() => onPick(w.id)}
              >
                <img src={photo(w.cover)} alt="" loading="lazy" draggable={false} />
                <span className="wrow-text">
                  <strong>{w.name}</strong>
                  <span className="wrow-ja" lang="ja">
                    {w.ja}
                  </span>
                </span>
                <span className="wrow-count num">{n}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
