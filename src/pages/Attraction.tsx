import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import Lenis from 'lenis';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Keyboard, A11y, Navigation } from 'swiper/modules';
import 'swiper/css';
import { ATTRACTIONS, attractionById } from '../data/attractions';
import { LINES, type LineId } from '../data/lines';
import { areaById, areaPath, TOKYO_PATH } from '../data/places';
import { CROWD_START_HOUR, type Attraction as A } from '../data/types';
import { projection } from '../map/camera';
import { AREA_PATHS, TOKYO_BOUNDS, WARDS_BOUNDS } from '../map/paths';
import { KineticTitle } from '../components/KineticTitle';
import { TileCard } from '../components/AttractionCard';
import { FactorSheet } from '../components/FactorSheet';
import { Station } from '../components/Station';
import { Icon } from '../components/Icon';
import { Footer, HeartButton, TopNav } from '../components/Chrome';
import { flags, readings, realTime } from '../lib/factors';
import { clock, duration, durationRange, plural, yen } from '../lib/format';
import { useReducedMotion } from '../lib/motion';
import { photo, photoSet, creditFor } from '../lib/photos';
import { MORPH_NAME, useGo } from '../lib/transition';
import { useSaved } from '../lib/saved';
import { useMedia } from '../lib/useMedia';

const TOKYO_STATION: [number, number] = [139.7671, 35.6812];
const BOOKING_WORD = { required: 'Book ahead', recommended: 'Booking helps', none: 'Walk in' };

export default function AttractionPage() {
  const { id = '' } = useParams();
  const a = attractionById(id);
  const go = useGo();
  if (!a) {
    return (
      <div className="page">
        <TopNav />
        <main className="missing">
          <h1>We don’t have that attraction</h1>
          <p>The link may be out of date. Pick one from the Tokyo map instead.</p>
          <button type="button" className="button" onClick={() => go(TOKYO_PATH)}>
            Open the Tokyo map
          </button>
        </main>
      </div>
    );
  }
  return <Detail key={a.id} a={a} />;
}

/** The short line under each factor chip. */
function chipNote(a: A, line: LineId) {
  switch (line) {
    case 'conditions':
      return `${a.conditions.covered}% under a roof`;
    case 'effort':
      return `${a.effort.walkKm} km on foot, ${a.effort.steps} steps`;
    case 'vibe': {
      const c = a.vibe.crowds.weekday;
      const peak = c.reduce<number>((m, v, i) => ((v ?? -1) > (c[m] ?? -1) ? i : m), 0);
      return `Busiest around ${clock(CROWD_START_HOUR + peak)}`;
    }
    case 'logistics':
      return `${BOOKING_WORD[a.logistics.booking]}, ${durationRange(realTime(a))} door to door`;
    case 'cost':
      return a.cost.entry === 0 ? 'Free entry' : `Entry ${yen(a.cost.entry)}`;
  }
}

function Detail({ a }: { a: A }) {
  const go = useGo();
  const trip = useSaved();
  const reduced = useReducedMotion();
  const narrow = useMedia('(max-width: 760px)');
  const lenis = useRef<Lenis | null>(null);
  const [sheet, setSheet] = useState<LineId | null>(null);
  const area = areaById(a.area)!;
  const fl = flags(a);
  const r = readings(a);
  const saved = trip.has(a.id);
  const credit = creditFor(a.id);
  const others = useMemo(() => {
    const same = ATTRACTIONS.filter((x) => x.area === a.area && x.id !== a.id);
    const rest = ATTRACTIONS.filter((x) => x.area !== a.area && x.id !== a.id);
    return [...same, ...rest].slice(0, 8);
  }, [a]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const l = new Lenis({ autoRaf: true, lerp: 0.11 });
    lenis.current = l;
    return () => {
      l.destroy();
      lenis.current = null;
    };
  }, [reduced]);

  // Freeze the page behind an open sheet.
  useEffect(() => {
    if (sheet) lenis.current?.stop();
    else lenis.current?.start();
    document.documentElement.classList.toggle('is-locked', !!sheet);
    return () => document.documentElement.classList.remove('is-locked');
  }, [sheet]);

  useEffect(() => {
    document.title = `${a.name}: is it for you? · Fitline`;
  }, [a]);

  return (
    <div className="detail">
      {!narrow && <TopNav />}
      <div className="detail-grid">
        <section className="d-hero" aria-labelledby="d-title">
          <img
            className="d-photo"
            src={photo(a.id, 1600)}
            srcSet={photoSet(a.id)}
            sizes="(max-width: 760px) 100vw, 55vw"
            alt=""
            style={{ viewTransitionName: MORPH_NAME }}
            fetchPriority="high"
          />
          <div className="d-scrim" aria-hidden="true" />
          <div className="d-top">
            <button type="button" className="glass-button" onClick={() => go(areaPath(a.area))} aria-label={`Back to ${area.properties.name}`}>
              <Icon name="arrowLeft" size={20} />
            </button>
            <HeartButton id={a.id} name={a.name} size={44} />
          </div>
          <div className="d-title" id="d-title">
            <KineticTitle
              text={a.name}
              sub={a.ja}
              className={`d-name ${a.name.length > 15 ? 'is-long' : ''}`}
              width={a.name.length > 18 ? 76 : a.name.length > 13 ? 92 : 112}
              delay={0.35}
            />
            <p className="d-area">
              <Icon name="pin" size={16} />
              {a.kind} in {area.properties.name}
            </p>
          </div>
          {credit && (
            <a className="d-credit" href={credit.page} target="_blank" rel="noreferrer">
              Photo: {credit.creator}, {credit.license}
            </a>
          )}
        </section>

        <main className="d-body">
          <p className="d-blurb">{a.blurb}</p>

          {!narrow && (
            <div className="d-actions">
              <button type="button" className={`button ${saved ? 'is-done' : ''}`} onClick={() => trip.toggle(a.id)} aria-pressed={saved}>
                <Icon name="heart" filled={saved} />
                {saved ? 'Saved' : 'Save to my list'}
              </button>
              <button type="button" className="button is-quiet" onClick={() => go(areaPath(a.area))}>
                <Icon name="map" />
                See it on the map
              </button>
            </div>
          )}

          <section aria-labelledby="factors-title">
            <div className="section-head is-tight">
              <h2 id="factors-title">Before you go</h2>
              <p className="section-count">Tap a factor for the full picture</p>
            </div>
            <ul className="fchips">
              {LINES.map((l) => {
                const n = fl.filter((f) => f.line === l.id).length;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      className="fchip"
                      onClick={() => setSheet(l.id)}
                      style={{ ['--hue' as string]: `var(--c-${l.id})`, ['--soft' as string]: `var(--c-${l.id}-soft)` }}
                    >
                      <span className="fchip-top">
                        <Station line={l.id} size={26} />
                        <span className="fchip-label">{l.name}</span>
                        {n > 0 && <span className="fchip-flag">{n} to check</span>}
                      </span>
                      <span className="fchip-value num">{r[l.id]}</span>
                      <span className="fchip-note">{chipNote(a, l.id)}</span>
                      <Icon name="arrowUpRight" className="fchip-arrow" size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="missed" aria-labelledby="missed-title">
            <h2 id="missed-title">
              <Icon name="alert" size={18} />
              Easy to miss
            </h2>
            {fl.length ? (
              <ul>
                {fl.slice(0, 6).map((f) => (
                  <li key={f.text}>
                    <button type="button" onClick={() => setSheet(f.line)}>
                      <Station line={f.line} size={22} />
                      <span>{f.text}</span>
                      <Icon name="arrowRight" size={16} className="missed-arrow" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet">Nothing unusual. It works the way most people expect.</p>
            )}
          </section>

          <AreaMap a={a} />

          <section className="also" aria-labelledby="also-title">
            <div className="section-head">
              <h2 id="also-title">More in Tokyo</h2>
              <div className="rail-nav">
                <button type="button" className="round-button also-prev" aria-label="Previous attractions">
                  <Icon name="arrowLeft" size={18} />
                </button>
                <button type="button" className="round-button also-next" aria-label="Next attractions">
                  <Icon name="arrowRight" size={18} />
                </button>
              </div>
            </div>
            <Swiper
              modules={[Keyboard, A11y, Navigation]}
              keyboard={{ enabled: true }}
              navigation={{ prevEl: '.also-prev', nextEl: '.also-next' }}
              watchSlidesProgress
              slidesPerView={1.1}
              spaceBetween={16}
              breakpoints={{ 560: { slidesPerView: 2 } }}
            >
              {others.map((o) => (
                <SwiperSlide key={o.id}>
                  <TileCard a={o} lens="any" />
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        </main>
      </div>

      {!narrow && <Footer />}

      {narrow && (
        <div className="d-bar">
          <button type="button" className={`button is-wide ${saved ? 'is-done' : ''}`} onClick={() => trip.toggle(a.id)} aria-pressed={saved}>
            <Icon name="heart" filled={saved} />
            {saved ? 'Saved to my list' : 'Save to my list'}
          </button>
          <button type="button" className="round-button is-dark" onClick={() => go(areaPath(a.area))} aria-label="See it on the map">
            <Icon name="map" size={20} />
          </button>
        </div>
      )}

      <FactorSheet a={a} line={sheet} onChange={setSheet} onClose={() => setSheet(null)} />
    </div>
  );
}

/** Tokyo with this attraction's area filled, and the line from Tokyo Station. */
function AreaMap({ a }: { a: A }) {
  const inWards = Number(a.area) < 13200;
  const b = inWards ? WARDS_BOUNDS : TOKYO_BOUNDS;
  const pad = (b[1][0] - b[0][0]) * 0.06;
  const vb = [b[0][0] - pad, b[0][1] - pad, b[1][0] - b[0][0] + pad * 2, b[1][1] - b[0][1] + pad * 2];
  const unit = vb[2] / 100;
  const shapes = inWards ? AREA_PATHS.filter((p) => Number(p.id) < 13200) : AREA_PATHS;
  const [sx, sy] = projection(TOKYO_STATION)!;
  const [px, py] = projection(a.lonlat)!;
  const area = areaById(a.area)!;
  const l = a.logistics;

  return (
    <section className="d-map" aria-labelledby="map-title">
      <div className="d-map-text">
        <h2 id="map-title">Getting there</h2>
        <p className="d-map-big num">{duration(l.travelMin)}</p>
        <p>
          From Tokyo Station to {l.station}, then {l.walkMin ? `a ${l.walkMin}-minute walk` : 'you’re there'}.
        </p>
        {l.lastTrainNote && <p className="callout">{l.lastTrainNote}</p>}
        <p className="quiet">{plural(Math.round(l.travelMin * 2), 'minute')} of your day goes on getting there and back.</p>
      </div>
      <svg viewBox={vb.join(' ')} role="img" aria-label={`Map of ${inWards ? 'the 23 wards' : 'Tokyo'} with ${area.properties.name} marked`}>
        {shapes.map((p) => (
          <path key={p.id} d={p.d} className={p.id === a.area ? 'is-here' : ''} />
        ))}
        <line x1={sx} y1={sy} x2={px} y2={py} className="d-map-route" strokeWidth={unit * 0.9} />
        <circle cx={sx} cy={sy} r={unit * 1.4} className="d-map-from" />
        <circle cx={px} cy={py} r={unit * 2.2} className="d-map-to" strokeWidth={unit * 1.1} />
        <text x={sx - unit * 2.4} y={sy + unit * 4.8} fontSize={unit * 3.6} textAnchor="end" className="d-map-label">
          Tokyo Station
        </text>
      </svg>
    </section>
  );
}
