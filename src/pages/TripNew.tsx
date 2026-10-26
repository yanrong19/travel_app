import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ATTRACTIONS } from '../data/attractions';
import { TOKYO_PREF_ID } from '../data/places';
import { BottomTabs, Footer, TopNav } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { PlacePicker } from '../components/planner/PlacePicker';
import { TripSettings, type TripSettingsValue } from '../components/planner/TripSettings';
import { EASE_OUT, useReducedMotion } from '../lib/motion';
import { photo } from '../lib/photos';
import { newTrip, saveToTrip, type PlaceRef } from '../lib/trips';
import { placeLabel } from '../lib/tripPlaces';
import { useTrips } from '../lib/tripsStore';
import { useMedia } from '../lib/useMedia';
import { coverOf, tripWhen } from './Trips';

type Seed = { place: PlaceRef | null; attractionId: string };
type NewTripState = { seed?: Seed; step?: 1 | 2 } | null;

const LEVELS: PlaceRef['level'][] = ['country', 'region', 'prefecture', 'area'];
// The history entry of a setup that has made its trip, so going back to it doesn't offer a second copy.
const DONE_KEY = 'fitline.newTripDone';
const TOKYO: PlaceRef = { level: 'prefecture', id: TOKYO_PREF_ID };

/** The seed "Add to trip" passes in router state, if it is one we can use. */
function readSeed(state: unknown): Seed | null {
  const seed = (state as NewTripState)?.seed;
  if (!seed || typeof seed !== 'object' || !ATTRACTIONS.some((a) => a.id === seed.attractionId)) return null;
  const p = seed.place;
  const place = p && typeof p === 'object' && LEVELS.includes(p.level) && typeof p.id === 'string' ? { level: p.level, id: p.id } : null;
  return { place, attractionId: seed.attractionId };
}

const INITIAL: TripSettingsValue = {
  name: '',
  startDate: null,
  endDate: null,
  days: 3,
  who: 'couple',
  pace: 'normal',
  dayStart: '09:00',
};

export default function TripNew() {
  const location = useLocation();
  const navigate = useNavigate();
  const { create, update } = useTrips();
  const narrow = useMedia('(max-width: 760px)');
  const reduced = useReducedMotion();

  const state = location.state as NewTripState;
  // Read once: the seed pre-picks its place (Tokyo when it has none) and waits in the trip's Saved list.
  const [seed] = useState(() => readSeed(location.state));
  const [places, setPlaces] = useState<PlaceRef[]>(() => (seed ? [seed.place ?? TOKYO] : []));
  const [settings, setSettings] = useState<TripSettingsValue>(INITIAL);
  // The name follows the first place until it's typed in.
  const [named, setNamed] = useState(false);
  const pushed = useRef(false);
  // A second click on "Create trip" before the planner opens must not make a second trip.
  const creating = useRef(false);
  // The step 1 entry's key: once the trip is made, coming back to that entry goes to the trips list.
  const step1Key = useRef(location.key);

  // Step 2 is a history entry of its own, so the phone's back gesture returns to the places.
  // Without places (a refresh drops them) it's step 1 again.
  const step = state?.step === 2 && places.length > 0 ? 2 : 1;

  const defaultName = places.length ? `${placeLabel(places[0]).name} trip` : 'My trip';
  const value = named ? settings : { ...settings, name: defaultName };
  const seedName = seed ? ATTRACTIONS.find((a) => a.id === seed.attractionId)?.name : undefined;

  const heading = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    document.title = 'New trip · Fitline';
  }, []);
  useEffect(() => {
    let done: string | null = null;
    try {
      done = sessionStorage.getItem(DONE_KEY);
    } catch {
      /* no storage: going back simply shows the setup again */
    }
    if (done && done === location.key) navigate('/trips', { replace: true });
  }, [location.key, navigate]);
  if (step === 1) step1Key.current = location.key;
  // A new step starts at the top, with focus on its heading (not on first load).
  useEffect(() => {
    window.scrollTo(0, 0);
    if (firstStep.current) firstStep.current = false;
    else heading.current?.focus({ preventScroll: true });
  }, [step]);

  const toStep2 = () => {
    pushed.current = true;
    navigate(location.pathname, { state: { ...state, step: 2 } });
  };

  const toStep1 = () => {
    if (pushed.current) navigate(-1);
    else navigate(location.pathname, { replace: true, state: { ...state, step: 1 } });
  };

  const onSettings = (next: TripSettingsValue) => {
    if (next.name !== value.name) setNamed(true);
    setSettings(next);
  };

  const finish = () => {
    if (creating.current) return;
    creating.current = true;
    const name = (named ? settings.name.trim() : '') || defaultName;
    const trip = create({
      name,
      places,
      startDate: settings.startDate,
      days: settings.days,
      who: settings.who,
      pace: settings.pace,
      dayStart: settings.dayStart,
    });
    if (seed) update(trip.id, (t, now) => saveToTrip(t, seed.attractionId, now));
    try {
      // A page opened straight from its URL has the key "default", which a later visit would share.
      if (step1Key.current !== 'default') sessionStorage.setItem(DONE_KEY, step1Key.current);
    } catch {
      /* no storage: going back shows the setup again */
    }
    navigate(`/trips/${trip.id}`, { replace: true });
  };

  // What the trip will look like in the Trips list.
  const preview = useMemo(() => {
    const t = newTrip(
      { name: (named ? settings.name.trim() : '') || defaultName, places, startDate: settings.startDate, days: settings.days, who: settings.who, pace: settings.pace },
      0,
      'preview',
    );
    return seed ? saveToTrip(t, seed.attractionId, 0) : t;
  }, [named, settings, defaultName, places, seed]);

  const seedNote = seedName && (
    <p className="tnew-seed">
      <Icon name="check" size={15} />
      <span>
        <strong>{seedName}</strong> will wait in the trip’s Saved list, ready to drop into a day.
      </span>
    </p>
  );

  return (
    <div className="page">
      <TopNav />
      <main className="tnew">
        <header className="tnew-head">
          <ol className="tnew-steps" aria-label="Steps">
            <li aria-current={step === 1 ? 'step' : undefined} className={step > 1 ? 'is-done' : ''}>
              <span className="tnew-step-mark num" aria-hidden="true">
                {step > 1 ? <Icon name="check" size={12} /> : 1}
              </span>
              Places
            </li>
            <li aria-current={step === 2 ? 'step' : undefined}>
              <span className="tnew-step-mark num" aria-hidden="true">
                2
              </span>
              Settings
            </li>
          </ol>
          <h1 ref={heading} tabIndex={-1}>
            {step === 1 ? 'Where are you going?' : 'When, and who’s going?'}
          </h1>
          <p className="tnew-lead">
            {step === 1
              ? 'Pick countries on the globe. For a region, prefecture or Tokyo ward, search. You can add more places later.'
              : 'Dates are optional: a number of days is enough to start planning.'}
          </p>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reduced ? 0 : 0.28, ease: EASE_OUT }}
          >
            {step === 1 ? (
              <PlacePicker
                value={places}
                onChange={setPlaces}
                footer={
                  <>
                    {seedNote}
                    <div className="tnew-actions">
                      <button type="button" className="button" onClick={toStep2} disabled={places.length === 0}>
                        Next: dates and settings
                        <Icon name="arrowRight" />
                      </button>
                      {places.length === 0 && <p className="tnew-actions-hint">Pick at least one place to go on.</p>}
                    </div>
                  </>
                }
              />
            ) : (
              <div className="tnew-settings">
                <div className="tnew-card">
                  <TripSettings value={value} onChange={onSettings} namePlaceholder={defaultName} />
                </div>
                {/* Laptop: the actions sit under the preview, which stays in view. Phone: under the form. */}
                <div className="tnew-side">
                  {!narrow && (
                    <section className="tnew-preview" aria-labelledby="tnew-preview-title">
                      <h2 id="tnew-preview-title" className="pp-label">
                        In your trips
                      </h2>
                      <PreviewCard trip={preview} />
                      {seedNote}
                    </section>
                  )}
                  <div className="tnew-actions">
                    <button type="button" className="button is-quiet" onClick={toStep1}>
                      <Icon name="arrowLeft" />
                      Places
                    </button>
                    <button type="button" className="button is-wide" onClick={finish}>
                      Create trip
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      {narrow && <BottomTabs />}
    </div>
  );
}

/** The trip's card as the Trips list will show it, without the list's actions. */
function PreviewCard({ trip }: { trip: ReturnType<typeof newTrip> }) {
  const cover = coverOf(trip);
  const places = trip.places.map((p) => placeLabel(p).name).join(' · ');
  return (
    <div className={`trip-card ${cover ? '' : 'is-plain'}`}>
      {cover && <img className="trip-card-photo" src={photo(cover)} alt="" />}
      <div className="trip-card-body">
        <p className="trip-card-name">{trip.name}</p>
        <p className="trip-card-places">
          <Icon name="pin" size={14} />
          {places}
        </p>
        <dl className="tiles">
          <div>
            <dt>
              <Icon name="clock" size={13} />
              When
            </dt>
            <dd className="num">{tripWhen(trip)}</dd>
          </div>
          <div>
            <dt>
              <Icon name="map" size={13} />
              Planned
            </dt>
            <dd className="num">No stops yet</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
