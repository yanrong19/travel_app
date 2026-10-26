import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BottomTabs, Footer, TopNav } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { MONTHS, plural } from '../lib/format';
import { EASE_OUT, useReducedMotion } from '../lib/motion';
import { creditFor, photo } from '../lib/photos';
import { useGo } from '../lib/transition';
import { dateOf, type Trip } from '../lib/trips';
import { placeCover, placeLabel } from '../lib/tripPlaces';
import { useTrips } from '../lib/tripsStore';
import { useMedia } from '../lib/useMedia';

const UNDO_MS = 6000;
const EMPTY_PHOTO = 'hero';
// Dismissing the unreadable-data note lasts for this visit (the store's notice is fixed at load).
const NOTICE_KEY = 'fitline.tripsNoticeDismissed';

/** The first planned stop across the days, else the first unplanned attraction. */
const firstStop = (trip: Trip) => trip.days.find((d) => d.stops.length > 0)?.stops[0] ?? trip.unplanned[0] ?? null;

/** Cover photo id: the first stop's own photo, else the first place's photo. */
function coverOf(trip: Trip): string | null {
  const stop = firstStop(trip);
  if (stop) return stop;
  return trip.places[0] ? placeCover(trip.places[0]) : null;
}

function readDismissed() {
  try {
    return sessionStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

const dayMonth = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** "12–14 Apr 2027", "28 Apr – 3 May 2027", or "5 days" when the trip has no dates. */
function tripWhen(trip: Trip): string {
  const start = dateOf(trip, 0);
  const end = dateOf(trip, trip.days.length - 1);
  if (!start || !end) return plural(trip.days.length, 'day');
  if (trip.days.length === 1) return `${dayMonth(start)} ${start.getFullYear()}`;
  if (start.getFullYear() !== end.getFullYear()) return `${dayMonth(start)} ${start.getFullYear()} – ${dayMonth(end)} ${end.getFullYear()}`;
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
  return `${dayMonth(start)} – ${dayMonth(end)} ${end.getFullYear()}`;
}

const stopCount = (trip: Trip) => trip.days.reduce((n, d) => n + d.stops.length, 0);

export default function TripsPage() {
  const { trips, remove, restore, notice } = useTrips();
  const [noticeOff, setNoticeOff] = useState(readDismissed);
  const go = useGo();
  const narrow = useMedia('(max-width: 760px)');
  const reduced = useReducedMotion();
  const [deleted, setDeleted] = useState<Trip | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const list = [...trips].sort((a, b) => b.updatedAt - a.updatedAt);
  const credit = creditFor(EMPTY_PHOTO);

  useEffect(() => {
    document.title = 'Trips · Fitline';
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const del = (trip: Trip) => {
    remove(trip.id);
    setDeleted(trip);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDeleted(null), UNDO_MS);
  };

  const dismissNotice = () => {
    setNoticeOff(true);
    try {
      sessionStorage.setItem(NOTICE_KEY, '1');
    } catch {
      /* no storage: the note comes back on the next visit to this page */
    }
  };

  const undo = () => {
    if (!deleted) return;
    restore(deleted);
    setDeleted(null);
    window.clearTimeout(timer.current);
  };

  return (
    <div className="page">
      <TopNav />
      <main className="trips">
        {notice && !noticeOff && (
          <div className="trips-notice" role="status">
            <Icon name="alert" size={18} />
            <p>
              {notice} A copy of the old data is kept in this browser.
            </p>
            <button type="button" className="icon-button" onClick={dismissNotice} aria-label="Dismiss this note">
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {list.length === 0 ? (
          <section className="trips-empty" aria-labelledby="trips-empty-title">
            <img src={photo(EMPTY_PHOTO, 1600)} alt="" />
            <div className="trips-empty-card">
              <p className="trips-eyebrow">Trips</p>
              <h1 id="trips-empty-title">Plan your first trip</h1>
              <p>Pick your places, lay attractions out day by day, and see the walking, crowds, rain and cost add up before you go.</p>
              <button type="button" className="button" onClick={() => go('/trips/new')}>
                <Icon name="plus" />
                New trip
              </button>
            </div>
            {credit && (
              <a className="trips-credit" href={credit.page} target="_blank" rel="noreferrer">
                Photo: {credit.creator}, {credit.license}
              </a>
            )}
          </section>
        ) : (
          <>
            <header className="trips-head">
              <div>
                <h1>Trips</h1>
                <p className="trips-count">{plural(list.length, 'trip')}</p>
              </div>
              <button type="button" className="button" onClick={() => go('/trips/new')}>
                <Icon name="plus" />
                New trip
              </button>
            </header>
            <ul className="trips-grid">
              <AnimatePresence initial={false}>
                {list.map((t) => (
                  <motion.li
                    key={t.id}
                    layout={!reduced}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: reduced ? 0 : 0.3, ease: EASE_OUT }}
                  >
                    <TripCard trip={t} onOpen={() => go(`/trips/${t.id}`)} onDelete={() => del(t)} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </>
        )}
      </main>

      <div className="toast is-action" role="status" data-on={deleted ? '1' : ''}>
        {deleted && (
          <>
            <span>Deleted “{deleted.name}”</span>
            <button type="button" className="toast-undo" onClick={undo}>
              Undo
            </button>
          </>
        )}
      </div>

      <Footer />
      {narrow && <BottomTabs />}
    </div>
  );
}

function TripCard({ trip, onOpen, onDelete }: { trip: Trip; onOpen: () => void; onDelete: () => void }) {
  const cover = coverOf(trip);
  const places = trip.places.map((p) => placeLabel(p).name).join(' · ');
  const stops = stopCount(trip);
  return (
    <article className={`trip-card ${cover ? '' : 'is-plain'}`}>
      {cover && <img className="trip-card-photo" src={photo(cover)} alt="" loading="lazy" />}
      <div className="trip-card-top">
        <button
          type="button"
          className="glass-button trip-card-delete"
          onClick={onDelete}
          aria-label={`Delete ${trip.name}`}
          title="Delete trip"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="trip-card-body">
        <h2 className="trip-card-name">
          <a
            href={`/trips/${trip.id}`}
            onClick={(e) => {
              e.preventDefault();
              onOpen();
            }}
          >
            {trip.name}
          </a>
        </h2>
        {places && (
          <p className="trip-card-places">
            <Icon name="pin" size={14} />
            {places}
          </p>
        )}
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
            <dd className="num">{stops ? plural(stops, 'stop') : 'No stops yet'}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

/** Stand-in for the setup and planner pages until they are built. */
export function TripPlaceholder() {
  const go = useGo();
  const narrow = useMedia('(max-width: 760px)');
  useEffect(() => {
    document.title = 'Trips · Fitline';
  }, []);
  return (
    <div className="page">
      <TopNav />
      <main className="missing">
        <h1>Coming in the next task</h1>
        <p>This part of the trip planner isn’t built yet.</p>
        <button type="button" className="button" onClick={() => go('/trips')}>
          <Icon name="arrowLeft" />
          Back to trips
        </button>
      </main>
      {narrow && <BottomTabs />}
    </div>
  );
}
