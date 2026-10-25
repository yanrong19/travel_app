import { BrowserRouter, Route, Routes } from 'react-router';
import Home from './pages/Home';
import Explore from './pages/Explore';
import AttractionPage from './pages/Attraction';
import Credits from './pages/Credits';
import { TransitionProvider } from './lib/transition';
import { TripProvider } from './lib/trip';
import { SavedDrawer } from './components/Chrome';

export default function App() {
  return (
    <BrowserRouter>
      <TripProvider>
        <TransitionProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/attraction/:id" element={<AttractionPage />} />
            <Route path="/credits" element={<Credits />} />
            <Route path="/map/:country?/:region?/:area?" element={<Explore />} />
            <Route path="*" element={<Home />} />
          </Routes>
          <SavedDrawer />
        </TransitionProvider>
      </TripProvider>
    </BrowserRouter>
  );
}
