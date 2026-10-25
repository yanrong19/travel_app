// The weather lens: pick the weather you're planning for and every
// attraction says how it fares, then sorts best first.
import type { Attraction, Rating } from '../data/types';
import type { IconName } from '../components/Icon';

export type LensId = 'any' | 'sun' | 'rain' | 'heat' | 'wind';

export const LENSES: { id: LensId; label: string; icon: IconName }[] = [
  { id: 'any', label: 'Any weather', icon: 'cloud' },
  { id: 'sun', label: 'Sunny', icon: 'sun' },
  { id: 'rain', label: 'Rainy', icon: 'rain' },
  { id: 'heat', label: 'Hot', icon: 'heat' },
  { id: 'wind', label: 'Windy', icon: 'wind' },
];

const KEY: Record<Exclude<LensId, 'any'>, keyof Attraction['conditions']['weather']> = {
  sun: 'sun',
  rain: 'rain',
  heat: 'heat',
  wind: 'wind',
};

const WORDS: Record<Exclude<LensId, 'any'>, Record<Rating, string>> = {
  sun: { good: 'Great in sun', ok: 'Fine in sun', poor: 'Too exposed in sun' },
  rain: { good: 'Great in rain', ok: 'OK in light rain', poor: 'Skip if it rains' },
  heat: { good: 'Copes with heat', ok: 'Tiring in heat', poor: 'Skip in a heatwave' },
  wind: { good: 'Fine in wind', ok: 'Breezy but OK', poor: 'Closes in strong wind' },
};

export function lensRating(a: Attraction, lens: LensId): Rating | null {
  if (lens === 'any') return null;
  return a.conditions.weather[KEY[lens]];
}

export function lensWord(a: Attraction, lens: LensId) {
  const r = lensRating(a, lens);
  return r && lens !== 'any' ? WORDS[lens][r] : null;
}

const ORDER: Record<Rating, number> = { good: 0, ok: 1, poor: 2 };

/** Best fit first; ties keep their original order. */
export function sortByLens<T extends Attraction>(list: T[], lens: LensId): T[] {
  if (lens === 'any') return list;
  return [...list].sort((x, y) => ORDER[lensRating(x, lens)!] - ORDER[lensRating(y, lens)!]);
}
