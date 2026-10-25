import { useEffect } from 'react';
import { ATTRACTIONS } from '../data/attractions';
import { BottomTabs, TopNav } from '../components/Chrome';
import { CREDITS, photo } from '../lib/photos';
import { useMedia } from '../lib/useMedia';
import { Footer } from './Home';

const nameOf = (id: string) => (id === 'hero' ? 'Home page' : ATTRACTIONS.find((a) => a.id === id)?.name ?? id);

export default function Credits() {
  const narrow = useMedia('(max-width: 760px)');
  useEffect(() => {
    document.title = 'Photo credits · Fitline';
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="page">
      <TopNav />
      <main className="credits">
        <h1>Photo credits</h1>
        <p className="credits-lead">
          Every photo comes from Wikimedia Commons under a licence that allows reuse. Thanks to the photographers below.
        </p>
        <ul className="credits-list">
          {CREDITS.map((c) => (
            <li key={c.id}>
              <img src={photo(c.id)} alt="" loading="lazy" />
              <div>
                <strong>{nameOf(c.id)}</strong>
                <p>
                  <a href={c.page} target="_blank" rel="noreferrer">
                    {c.title}
                  </a>{' '}
                  by {c.creator},{' '}
                  <a href={c.licenseUrl} target="_blank" rel="noreferrer">
                    {c.license}
                  </a>
                  . Resized for the web.
                </p>
              </div>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
      {narrow && <BottomTabs />}
    </div>
  );
}
