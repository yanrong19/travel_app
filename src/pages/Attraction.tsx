import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import Lenis from 'lenis';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Keyboard, A11y, Navigation } from 'swiper/modules';
import 'swiper/css';
import { ATTRACTIONS, attractionById } from '../data/attractions';
import { areaById, areaPath, TOKYO_PATH } from '../data/places';
import type { Attraction as A } from '../data/types';
import { KineticTitle } from '../components/KineticTitle';
import { TileCard } from '../components/AttractionCard';
import { Icon } from '../components/Icon';
import { AddToTrip } from '../components/planner/AddToTrip';
import { TripBar } from '../components/planner/TripBar';
import { Footer, HeartButton, TopNav } from '../components/Chrome';
import { flags } from '../lib/factors';
import { duration } from '../lib/format';
import { useReducedMotion } from '../lib/motion';
import { photo, photoSet, creditFor } from '../lib/photos';
import { onwardState, plannerReturn, planningDay, readPlanning } from '../lib/planning';
import { MORPH_NAME, useGo } from '../lib/transition';
import { useSaved } from '../lib/saved';
import { useTrips } from '../lib/tripsStore';
import { useMedia } from '../lib/useMedia';
import type { PlaceRef } from '../lib/trips';
import { Conditions } from './sections/Conditions';
import { Effort } from './sections/Effort';
import { Vibe } from './sections/Vibe';
import { Logistics } from './sections/Logistics';
import { Cost } from './sections/Cost';

// MapLibre is heavy: the map card loads it after the page shell, as Explore does.
const AttractionMap = lazy(() => import('../components/AttractionMap'));

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

function Detail({ a }: { a: A }) {
  const go = useGo();
  const navigate = useNavigate();
  const trip = useSaved();
  // In planning when the planner opened this page (router state) for a trip this browser has: the
  // trip bar replaces the hearts and the save bar, and Back goes to the planner.
  const { state } = useLocation();
  const { get } = useTrips();
  const planning = readPlanning(state);
  const planTrip = planning ? get(planning.tripId) : undefined;
  const inPlan = planning && planTrip ? { p: planning, trip: planTrip } : null;
  // The trip bar's day: Back, "See it on the map" and the onward links carry it.
  const [barDay, setBarDay] = useState(() => (inPlan ? planningDay(inPlan.p, inPlan.trip.days.length) : 0));
  // Set once the page heads back to the planner: the router applies the move in a transition, so the
  // page stays clickable for a moment, and a second Back would step back past the planner.
  const leaving = useRef(false);
  const onPop = useRef<(() => void) | null>(null);
  // Leaving another way before the step back arrives: drop the listener, a tick later so a popstate
  // already being dispatched (which can unmount this page) still reaches it.
  useEffect(
    () => () => {
      const pending = onPop.current;
      if (pending) setTimeout(() => window.removeEventListener('popstate', pending), 0);
    },
    [],
  );
  /** Back to the planner on the bar's day, with `open`'s card shown on the map when given. Once only. */
  const toPlanner = (open?: string) => {
    if (!inPlan || leaving.current) return;
    leaving.current = true;
    const r = plannerReturn(inPlan.p, { day: barDay, open });
    if (r.kind === 'push') return go(r.to, { state: r.state });
    if (r.kind === 'back-replace') {
      // The planner is the previous entry: step back onto it, then rewrite it (no second planner entry).
      const plannerAt = `/trips/${encodeURIComponent(inPlan.p.tripId)}`;
      const handle = () => {
        window.removeEventListener('popstate', handle);
        onPop.current = null;
        if (window.location.pathname === plannerAt) navigate(r.to, { replace: true, state: r.state });
      };
      onPop.current = handle;
      window.addEventListener('popstate', handle);
    }
    navigate(-1);
  };
  const back = () => (inPlan ? toPlanner() : go(areaPath(a.area)));
  const toMap = () => (inPlan ? toPlanner(a.id) : go(areaPath(a.area)));
  const reduced = useReducedMotion();
  const narrow = useMedia('(max-width: 760px)');
  const lenis = useRef<Lenis | null>(null);
  const area = areaById(a.area)!;
  const place: PlaceRef = { level: 'area', id: a.area };
  const fl = flags(a);
  const day = new Date().getDay();
  const todayIndex = (day + 6) % 7;
  const weekend = day === 0 || day === 6;
  const on = (line: string) => fl.filter((f) => f.line === line);
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

  useEffect(() => {
    document.title = `${a.name}: is it for you? · Fitline`;
  }, [a]);

  return (
    <div className={`detail ${inPlan ? 'is-planning' : ''}`}>
      {!narrow && <TopNav />}
      {inPlan && <TripBar trip={inPlan.trip} a={a} day={barDay} onDay={setBarDay} onMap={toMap} />}
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
            <button type="button" className="glass-button" onClick={back} aria-label={`Back to ${inPlan ? inPlan.trip.name : area.properties.name}`}>
              <Icon name="arrowLeft" size={20} />
            </button>
            {/* In planning, Save goes to the trip (the bar), not the Saved list. */}
            {!inPlan && <HeartButton id={a.id} name={a.name} size={44} />}
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
          {!narrow && !inPlan && (
            <div className="d-actions">
              <button type="button" className={`button ${saved ? 'is-done' : ''}`} onClick={() => trip.toggle(a.id)} aria-pressed={saved}>
                <Icon name="heart" filled={saved} />
                {saved ? 'Saved' : 'Save to my list'}
              </button>
              <AddToTrip attractionId={a.id} place={place} />
            </div>
          )}

          <MapCard a={a} />

          <section className="d-about" aria-labelledby="about-title">
            <h2 id="about-title" className="sr-only">
              About
            </h2>
            <p className="d-blurb">{a.blurb}</p>
            <p className="d-kind">
              <Icon name="pin" size={16} />
              {a.kind} in {area.properties.name}
            </p>
          </section>

          <section className="d-factors" aria-labelledby="factors-title">
            <h2 id="factors-title" className="d-factors-title">
              Before you go
            </h2>
            <div className="frows">
              <Conditions a={a} flags={on('conditions')} />
              <Effort a={a} flags={on('effort')} />
              <Vibe a={a} flags={on('vibe')} weekend={weekend} />
              <Logistics a={a} flags={on('logistics')} todayIndex={todayIndex} />
              <Cost a={a} flags={on('cost')} />
            </div>
          </section>

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
                  <TileCard a={o} lens="any" linkState={inPlan ? onwardState(inPlan.p, barDay) : undefined} heart={!inPlan} />
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
        </main>
      </div>

      {!narrow && <Footer />}

      {/* In planning the trip bar at the top does this bar's work. */}
      {narrow && !inPlan && (
        <div className="d-bar">
          <button type="button" className={`button is-wide ${saved ? 'is-done' : ''}`} onClick={() => trip.toggle(a.id)} aria-pressed={saved}>
            <Icon name="heart" filled={saved} />
            {saved ? 'Saved to my list' : 'Save to my list'}
          </button>
          <AddToTrip attractionId={a.id} place={place} />
          <button type="button" className="round-button is-dark" onClick={() => go(areaPath(a.area))} aria-label="See it on the map">
            <Icon name="map" size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

/** A still map of the attraction with its ticker, and how to get there under it. */
function MapCard({ a }: { a: A }) {
  const l = a.logistics;
  return (
    <section className="amap" aria-labelledby="map-title">
      <Suspense fallback={<div className="amap-canvas" aria-hidden="true" />}>
        <AttractionMap a={a} />
      </Suspense>
      <div className="amap-info">
        <h2 id="map-title" className="sr-only">
          Getting there
        </h2>
        <dl className="amap-facts">
          <div>
            <dt>From Tokyo Station</dt>
            <dd className="num">{duration(l.travelMin)}</dd>
          </div>
          <div>
            <dt>Nearest station</dt>
            <dd>
              {l.station}
              <span className="amap-walk num">{l.walkMin ? `${duration(l.walkMin)} walk` : 'At the gate'}</span>
            </dd>
          </div>
        </dl>
        {l.lastTrainNote && (
          <p className="amap-warn">
            <Icon name="alert" size={16} />
            {l.lastTrainNote}
          </p>
        )}
      </div>
    </section>
  );
}
