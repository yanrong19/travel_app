import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import Explore from './pages/Explore';
import AttractionPage from './pages/Attraction';
import Credits from './pages/Credits';
import PlacePage from './pages/Place';
import { TransitionProvider } from './lib/transition';
import { SavedProvider } from './lib/saved';
import { TripsProvider } from './lib/tripsStore';
import { SavedDrawer } from './components/Chrome';

export default function App() {
  return (
    <BrowserRouter>
      <SavedProvider>
        <TripsProvider>
          <TransitionProvider>
            <Routes>
              {/* The globe and the map are one page: one layout route, so the map is not rebuilt between levels. */}
              <Route element={<Explore />}>
                <Route path="/" element={null} />
                <Route path="/map/:country/:region?/:area?" element={null} />
              </Route>
              <Route path="/map" element={<Navigate to="/" replace />} />
              <Route path="/attraction/:id" element={<AttractionPage />} />
              <Route path="/credits" element={<Credits />} />
              <Route path="/:country/:region?/:area?" element={<PlacePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <SavedDrawer />
          </TransitionProvider>
        </TripsProvider>
      </SavedProvider>
    </BrowserRouter>
  );
}
