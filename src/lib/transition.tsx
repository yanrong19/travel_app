import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { prefersReducedMotion } from './motion';

// Page changes use the View Transitions API. When a photo is passed, that
// photo morphs into the hero of the next page (it carries the shared name).
type Go = (to: string, opts?: { morph?: HTMLElement | null }) => void;
const Ctx = createContext<Go>(() => {});

export const MORPH_NAME = 'hero-photo';

export function TransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const go = useCallback<Go>(
    (to, opts) => {
      const canAnimate = 'startViewTransition' in document && !prefersReducedMotion();
      if (!canAnimate) {
        navigate(to);
        return;
      }
      document.querySelectorAll<HTMLElement>('[data-morphing]').forEach((el) => {
        el.style.viewTransitionName = '';
        delete el.dataset.morphing;
      });
      if (opts?.morph) {
        opts.morph.style.viewTransitionName = MORPH_NAME;
        opts.morph.dataset.morphing = '1';
      }
      navigate(to, { viewTransition: true });
    },
    [navigate],
  );

  return <Ctx.Provider value={go}>{children}</Ctx.Provider>;
}

export const useGo = () => useContext(Ctx);
