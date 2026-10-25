import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import Lenis from 'lenis';
import { prefersReducedMotion } from './motion';

/** How much of the map stays visible above the guide sheet once it is fully up. */
export const PEEK = 90;

/** Quiet time after the last scroll event before the page settles to an end. */
const SETTLE_MS = 160;
const SETTLE_SECONDS = 0.7;
const AT_START = 0.001;
const AT_END = 0.999;

/** How far the sheet has slid up: 0 at the top of the page, 1 at the guides offset. */
export function guideProgress(scrollY: number, viewportH: number, peek: number, barH: number) {
  const span = viewportH - peek - barH;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, scrollY / span));
}

/** Which end to settle to, or null when already resting on one. */
export function settleTarget(p: number): 'top' | 'guides' | null {
  if (p <= AT_START || p >= AT_END) return null;
  return p < 0.5 ? 'top' : 'guides';
}

type Options = {
  enabled: boolean;
  root: RefObject<HTMLElement | null>;
  barH: number;
  levelKey: string;
};

/**
 * Drives the guide sheet: Lenis smooths the window scroll, the progress lands in
 * the `--gp` CSS variable on `root`, and the page settles to the nearer end.
 */
export function useGuideScroll({ enabled, root, barH, levelKey }: Options) {
  const [atGuides, setAtGuides] = useState(false);
  const lenis = useRef<Lenis | null>(null);
  const barRef = useRef(barH);
  const refresh = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    barRef.current = barH;
    refresh.current();
  }, [barH]);

  useEffect(() => {
    if (!enabled) return;
    const l = new Lenis({ autoRaf: true, lerp: 0.11 });
    lenis.current = l;
    let timer: number | undefined;
    // True while a finger or mouse button is down (covers scrollbar drags), when
    // no scroll events arrive but the user is still steering the page.
    let held = false;

    const progress = () => guideProgress(l.scroll, window.innerHeight, PEEK, barRef.current);
    const update = () => {
      const p = progress();
      root.current?.style.setProperty('--gp', p.toFixed(3));
      setAtGuides(p >= AT_END);
    };
    // Re-arms on every scroll event, including the ones the settle itself causes,
    // so it only fires once the page has stopped; landing on an end then does nothing.
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (held || l.isTouching) return arm();
        const target = settleTarget(progress());
        if (!target) return;
        const to = target === 'top' ? 0 : window.innerHeight - PEEK - barRef.current;
        l.scrollTo(to, prefersReducedMotion() ? { immediate: true } : { duration: SETTLE_SECONDS });
      }, SETTLE_MS);
    };
    const onScroll = () => {
      update();
      arm();
    };
    const onDown = () => {
      held = true;
    };
    const onUp = () => {
      held = false;
      arm();
    };
    const onResize = () => {
      update();
      arm();
    };

    refresh.current = update;
    update();
    l.on('scroll', onScroll);
    window.addEventListener('resize', onResize);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('mouseup', onUp); // browsers may skip pointerup after a scrollbar drag
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('mouseup', onUp);
      refresh.current = () => {};
      l.destroy();
      lenis.current = null;
    };
  }, [enabled, root]);

  // A new level starts at the top of the page, whatever the last one was scrolled to.
  useLayoutEffect(() => {
    lenis.current?.scrollTo(0, { immediate: true });
    root.current?.style.setProperty('--gp', '0');
    setAtGuides(false);
  }, [levelKey, root]);

  const scrollTo = useCallback((to: number) => {
    lenis.current?.scrollTo(to, prefersReducedMotion() ? { immediate: true } : { duration: SETTLE_SECONDS });
  }, []);
  const scrollToGuides = useCallback(
    () => scrollTo(window.innerHeight - PEEK - barRef.current),
    [scrollTo],
  );
  const scrollToTop = useCallback(() => scrollTo(0), [scrollTo]);

  return { scrollToGuides, scrollToTop, atGuides };
}
