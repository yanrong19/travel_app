import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { AREA_COUNTS, GUIDES_HASH, MAP_ROOT, TOKYO_PATH, areaBySlug, areaPath } from '../data/places';
import { countrySlugOf, destinationBySlug, type Destination } from '../data/destinations';
import { KineticTitle } from '../components/KineticTitle';
import { BottomTabs, Footer, TopNav } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { photo, creditFor } from '../lib/photos';
import { useGo } from '../lib/transition';
import { useMedia } from '../lib/useMedia';

/**
 * The old place pages. A live country's levels now live under the map, so `/japan`,
 * `/japan/tokyo` and `/japan/tokyo/<ward>` send you to the matching map level, scrolled
 * to its guides. Countries we haven't checked yet still get their coming-soon page.
 */
export default function PlacePage() {
  const { country, region, area } = useParams();
  const dest = destinationBySlug(country);
  if (!dest) return <Navigate to="/" replace />;
  if (!dest.live) return <ComingSoon d={dest} />;
  // Japan: only Tokyo is mapped, so another region lands on the country and a bad ward on Tokyo.
  if (region !== 'tokyo') return <Navigate to={`${MAP_ROOT}/${countrySlugOf(dest)}${GUIDES_HASH}`} replace />;
  if (!area) return <Navigate to={`${TOKYO_PATH}${GUIDES_HASH}`} replace />;
  const ward = areaBySlug(area);
  if (!ward || !AREA_COUNTS[ward.id]) return <Navigate to={`${TOKYO_PATH}${GUIDES_HASH}`} replace />;
  return <Navigate to={`${areaPath(ward.id)}${GUIDES_HASH}`} replace />;
}

/** Countries we haven't checked yet: their landmarks and a way back to what's live. */
function ComingSoon({ d }: { d: Destination }) {
  const go = useGo();
  const narrow = useMedia('(max-width: 760px)');
  const cover = d.landmarks[0];
  const credit = creditFor(cover.photo);
  useEffect(() => {
    document.title = `${d.name}: coming soon · Fitline`;
    window.scrollTo(0, 0);
  }, [d]);
  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-stage is-soon">
          <img className="hero-photo" src={photo(cover.photo, 1600)} alt={cover.name} fetchPriority="high" />
          <div className="hero-scrim" aria-hidden="true" />
          <TopNav tone="glass" />
          <div className="hero-grid">
            <div className="hero-copy">
              <nav className="hero-crumbs" aria-label="Where you are">
                <a href="/" onClick={(e) => (e.preventDefault(), go('/'))}>
                  World
                </a>
              </nav>
              <KineticTitle text={d.name} sub={d.local} className="hero-title" width={d.name.length > 10 ? 80 : 104} delay={0.2} />
              <p className="hero-line">{d.oneLiner}</p>
              <p className="soon-pill">We’re checking attractions in {d.name} next.</p>
              <div className="explore-actions">
                <button type="button" className="button is-inverse-light" onClick={() => go(TOKYO_PATH)}>
                  Explore Tokyo meanwhile
                  <Icon name="arrowRight" />
                </button>
              </div>
            </div>
          </div>
          {credit && (
            <p className="hero-credit">
              Photo: {credit.creator}, {credit.license}
            </p>
          )}
        </div>
      </section>
      <main className="home-main">
        <section className="areas" aria-labelledby="sights-title">
          <div className="section-head">
            <h2 id="sights-title">Places we’ll check in {d.name}</h2>
          </div>
          <ul className="sights">
            {d.landmarks.map((l) => (
              <li key={l.photo}>
                <figure>
                  <img src={photo(l.photo)} alt={l.name} loading="lazy" />
                  <figcaption>{l.name}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
      {narrow && <BottomTabs />}
    </div>
  );
}
