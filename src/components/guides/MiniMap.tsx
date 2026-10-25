import { useMemo } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { PREFECTURES, TOKYO_AREAS, type Place } from '../../data/places';
import { mainLand } from '../../data/regions';

type Kind = 'japan' | 'tokyo';

interface Props {
  kind: Kind;
  /** The feature codes to light up: prefecture codes at Japan, ward codes at Tokyo. */
  hot: number[];
}

/** Drawing units. The viewBox scales them to whatever box the CSS gives the thumbnail. */
const SIZE = 100;
/** Breathing room around the outline, in drawing units. */
const PAD = 5;

interface Drawing {
  viewBox: string;
  shapes: { code: number; d: string }[];
}

/** Project a set of places into one tight viewBox and a path per place. */
function draw(places: Place[]): Drawing {
  // Far-flung specks (Tokyo's Ogasawara islands, 1,000km south) would shrink the rest to nothing.
  const land = places.map((p) => ({ code: Number(p.id), feature: mainLand(p) }));
  const all = { type: 'FeatureCollection', features: land.map((l) => l.feature) } as FeatureCollection;
  const projection = geoMercator().fitExtent(
    [
      [0, 0],
      [SIZE, SIZE],
    ],
    all,
  );
  // One decimal would be 20x finer than a 40px thumbnail can show, and twice the path data.
  const path = geoPath(projection).digits(0);
  const [[x0, y0], [x1, y1]] = path.bounds(all);
  return {
    viewBox: `${(x0 - PAD).toFixed(1)} ${(y0 - PAD).toFixed(1)} ${(x1 - x0 + PAD * 2).toFixed(1)} ${(y1 - y0 + PAD * 2).toFixed(1)}`,
    shapes: land.map((l) => ({ code: l.code, d: path(l.feature) ?? '' })),
  };
}

// The outlines never change, so each kind is drawn once for the life of the page.
const cache = new Map<Kind, Drawing>();
function drawingFor(kind: Kind): Drawing {
  let d = cache.get(kind);
  if (!d) {
    d = draw(kind === 'japan' ? PREFECTURES : TOKYO_AREAS);
    cache.set(kind, d);
  }
  return d;
}

/**
 * The sticky bar's thumbnail: a static SVG outline of Japan or Tokyo, with the hovered region
 * filled in. It is not a MapLibre map — the real one stays fixed behind the guides.
 */
export function MiniMap({ kind, hot }: Props) {
  const { viewBox, shapes } = drawingFor(kind);
  const lit = useMemo(() => new Set(hot), [hot]);
  return (
    <svg className="minimap" data-kind={kind} viewBox={viewBox} aria-hidden="true" focusable="false">
      {shapes.map((s) => (
        <path key={s.code} d={s.d} className={lit.has(s.code) ? 'is-hot' : undefined} />
      ))}
    </svg>
  );
}
