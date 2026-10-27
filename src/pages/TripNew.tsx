import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ATTRACTIONS } from '../data/attractions';
import { TOKYO_PREF_ID } from '../data/places';
import { BottomTabs, Footer, TopNav } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { PlacePicker } from '../components/planner/PlacePicker';
import { TripSettings, type TripSettingsValue } from '../components/planner/TripSettings';
import { saveToTrip, type PlaceRef } from '../lib/trips';
import { placeLabel } from '../lib/tripPlaces';
import { useTrips } from '../lib/tripsStore';
import { useMedia } from '../lib/useMedia';

type Seed = { place: PlaceRef | null; attractionId: string };
type NewTripState = { seed?: Seed } | null;

const LEVELS: PlaceRef['level'][] = ['country', 'region', 'prefecture', 'area'];
const TOKYO: PlaceRef = { level: 'prefecture', id: TOKYO_PREF_ID };

/** The seed "Add to trip" passes in router state, if it is one we can use. */
function readSeed(state: unknown): Seed | null {
  const seed = (state as NewTripState)?.seed;
  if (!seed || typeof seed !== 'object' || !ATTRACTIONS.some((a) => a.id === seed.attractionId)) return null;
  const p = seed.place;
  const place = p && typeof p === 'object' && LEVELS.includes(p.level) && typeof p.id === 'string' ? { level: p.level, id: p.id } : null;
  return { place, attractionId: seed.attractionId };
}

const INITIAL: TripSettingsValue = { name: '', startDate: null, endDate: null, days: 3 };

/**
 * `/trips/new`: one page. The place picker (search, Japan's regions, the picked places and the globe),
 * with the trip's name, dates and "Create trip" in its side column: beside the globe on laptop, under
 * it on phone.
 */
export default function TripNew() {
  const location = useLocation();
  const navigate = useNavigate();
  const { create, update } = useTrips();
  const narrow = useMedia('(max-width: 760px)');

  // Read once: the seed pre-picks its place (Tokyo when it has none) and waits in the trip's Saved list.
  const [seed] = useState(() => readSeed(location.state));
  const [places, setPlaces] = useState<PlaceRef[]>(() => (seed ? [seed.place ?? TOKYO] : []));
  const [settings, setSettings] = useState<TripSettingsValue>(INITIAL);
  // The name follows the first place until it's typed in.
  const [named, setNamed] = useState(false);
  // A second click on "Create trip" before the planner opens must not make a second trip.
  // (The planner then replaces this page in history, so Back from it goes to the trips list.)
  const creating = useRef(false);

  const defaultName = places.length ? `${placeLabel(places[0]).name} trip` : 'My trip';
  const value = named ? settings : { ...settings, name: defaultName };
  const seedName = seed ? ATTRACTIONS.find((a) => a.id === seed.attractionId)?.name : undefined;

  useEffect(() => {
    document.title = 'New trip · Fitline';
  }, []);

  const onSettings = (next: TripSettingsValue) => {
    if (next.name !== value.name) setNamed(true);
    setSettings(next);
  };

  const finish = () => {
    if (creating.current || places.length === 0) return;
    creating.current = true;
    const name = (named ? settings.name.trim() : '') || defaultName;
    const trip = create({ name, places, startDate: settings.startDate, days: settings.days });
    if (seed) update(trip.id, (t, now) => saveToTrip(t, seed.attractionId, now));
    navigate(`/trips/${trip.id}`, { replace: true });
  };

  return (
    <div className="page">
      <TopNav />
      <main className="tnew">
        <header className="tnew-head">
          <h1>Where are you going?</h1>
          <p className="tnew-lead">
            Pick countries on the globe, or search for a region, prefecture or Tokyo ward. Dates are optional: a number of days is enough to start.
          </p>
        </header>

        <PlacePicker
          value={places}
          onChange={setPlaces}
          footer={
            <section className="tnew-details" aria-label="Your trip">
              <TripSettings value={value} onChange={onSettings} namePlaceholder={defaultName} />
              {seedName && (
                <p className="tnew-seed">
                  <Icon name="check" size={15} />
                  <span>
                    <strong>{seedName}</strong> will wait in the trip’s Saved list, ready to drop into a day.
                  </span>
                </p>
              )}
              <div className="tnew-actions">
                <button type="button" className="button is-wide" onClick={finish} disabled={places.length === 0}>
                  Create trip
                </button>
                {places.length === 0 && <p className="tnew-actions-hint">Pick at least one place to create the trip.</p>}
              </div>
            </section>
          }
        />
      </main>
      <Footer />
      {narrow && <BottomTabs />}
    </div>
  );
}
