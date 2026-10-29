import { useEffect, useRef, useState } from 'react';
import { AttributionControl, Map as MapLibreMap } from 'maplibre-gl';
import { STYLE_URL, restyle } from '../map/style';
import type { Attraction } from '../data/types';
import { readings } from '../lib/factors';
import { photo } from '../lib/photos';

/** Room above the point for the ticker, so the ticker and its point sit in the middle of the card. */
const TOP_PAD = 60;

/**
 * A still map of the attraction's surroundings with its photo ticker: no pan, no zoom, no click.
 * Loaded lazily (MapLibre is heavy), like the map page.
 */
export default function AttractionMap({ a }: { a: Attraction }) {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = new MapLibreMap({
      container: box.current!,
      style: STYLE_URL,
      center: a.lonlat,
      zoom: 13.6,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      renderWorldCopies: false,
    });
    map.setPadding({ top: TOP_PAD, bottom: 0, left: 0, right: 0 });
    // The full credit, never folded behind a button: OpenStreetMap must stay visible.
    map.addControl(new AttributionControl({ compact: false }), 'bottom-right');
    const place = () => {
      const p = map.project(a.lonlat);
      setAt({ x: p.x, y: p.y });
    };
    map.on('style.load', () => {
      restyle(map, undefined, 'map');
      place();
    });
    map.once('idle', () => setReady(true));
    map.on('resize', place);
    return () => map.remove();
  }, [a]);

  return (
    <div className={`amap-canvas ${ready ? 'is-ready' : ''}`}>
      <div ref={box} className="amap-gl" role="img" aria-label={`Map of the streets around ${a.name}`} />
      {at && (
        <div className="amap-pin" style={{ transform: `translate(${at.x}px, ${at.y}px)` }} aria-hidden="true">
          <span className="ticker is-picked">
            <span className="ticker-pill">
              <img src={photo(a.id)} alt="" draggable={false} />
              <span className="ticker-label">
                <span className="ticker-name">{a.name}</span>
                <span className="ticker-value num">{readings(a).cost}</span>
              </span>
            </span>
          </span>
          <span className="amap-dot" />
        </div>
      )}
    </div>
  );
}
