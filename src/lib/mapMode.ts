import { useCallback, useEffect, useState } from 'react';

// How the maps look: the flat, Google-style `map`, or the tilted `3d` city with buildings.
// One choice for the whole app: remembered in localStorage, shared by every mounted map through a
// window event, and held in memory when storage is blocked.
export type MapMode = 'map' | '3d';

const KEY = 'fitline.mapMode';
const EVENT = 'fl-map-mode';

/** The mode set this visit; what every map follows when storage can't keep it. */
let shared: MapMode | null = null;

export function readMapMode(store?: Pick<Storage, 'getItem'>): MapMode {
  try {
    const s = store ?? window.localStorage;
    return s.getItem(KEY) === '3d' ? '3d' : 'map';
  } catch {
    return 'map';
  }
}

export function writeMapMode(mode: MapMode, store?: Pick<Storage, 'setItem'>): void {
  shared = mode;
  try {
    (store ?? window.localStorage).setItem(KEY, mode);
  } catch {
    // Private window or blocked storage: the mode lasts until the page closes.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<MapMode>(EVENT, { detail: mode }));
}

export function useMapMode(): [MapMode, (m: MapMode) => void] {
  const [mode, setMode] = useState<MapMode>(() => shared ?? readMapMode());
  useEffect(() => {
    const on = (e: Event) => setMode((e as CustomEvent<MapMode>).detail);
    window.addEventListener(EVENT, on);
    // A change between this render and the listener going up.
    setMode(shared ?? readMapMode());
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const set = useCallback((m: MapMode) => writeMapMode(m), []);
  return [mode, set];
}
