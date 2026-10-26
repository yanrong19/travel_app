import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// Per-viewer saved list (the hearted attractions). Kept in localStorage as a convenience only.
// The key keeps its old name so existing hearts survive the rename.
const KEY = 'fitline.trip';

function load(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

interface SavedState {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}

const Ctx = createContext<SavedState | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(load);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* storage unavailable: saved items last for this visit only */
    }
  }, [ids]);

  const toggle = useCallback((id: string) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])), []);
  const remove = useCallback((id: string) => setIds((s) => s.filter((x) => x !== id)), []);
  const value = useMemo(() => ({ ids, has: (id: string) => ids.includes(id), toggle, remove, open, setOpen }), [ids, toggle, remove, open]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSaved() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSaved needs SavedProvider');
  return v;
}
