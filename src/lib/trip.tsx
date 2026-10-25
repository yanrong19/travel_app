import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// Per-viewer trip list. Kept in localStorage as a convenience only.
const KEY = 'fitline.trip';

function load(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

interface TripState {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}

const Ctx = createContext<TripState | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(load);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* storage unavailable: the trip lasts for this visit only */
    }
  }, [ids]);

  const toggle = useCallback((id: string) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])), []);
  const remove = useCallback((id: string) => setIds((s) => s.filter((x) => x !== id)), []);
  const value = useMemo(() => ({ ids, has: (id: string) => ids.includes(id), toggle, remove, open, setOpen }), [ids, toggle, remove, open]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrip() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTrip needs TripProvider');
  return v;
}
