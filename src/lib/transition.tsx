import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { prefersReducedMotion } from './motion';

// Page changes use the View Transitions API. When a photo is passed, that
// photo morphs into the hero of the next page (it carries the shared name). `state` is router state for
// the new history entry (the planner's context for an attraction page, say).
type Go = (to: string, opts?: { morph?: HTMLElement | null; state?: unknown }) => void;
const Ctx = createContext<Go>(() => {});

export const MORPH_NAME = 'hero-photo';

export function TransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const go = useCallback<Go>(
    (to, opts) => {
      const canAnimate = 'startViewTransition' in document && !prefersReducedMotion();
      if (!canAnimate) {
        navigate(to, { state: opts?.state });
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
      navigate(to, { viewTransition: true, state: opts?.state });
    },
    [navigate],
  );

  return <Ctx.Provider value={go}>{children}</Ctx.Provider>;
}

export const useGo = () => useContext(Ctx);
