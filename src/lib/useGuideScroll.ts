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
/** Past this progress the title card and the right-hand panel have faded out (styles.css). */
export const COVERED_AT = 0.4;

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
  /** Stops the page scrolling while something sits over it (the saved drawer). */
  paused?: boolean;
  /** How much of the sheet shows at the top of the page (the planner's phone sheet peeks taller). */
  peek?: number;
};

/**
 * Drives the guide sheet: Lenis smooths the window scroll, the progress lands in
 * the `--gp` CSS variable on `root`, and the page settles to the nearer end.
 * It also writes `--vh` (window.innerHeight in px) on `root`, so the CSS that places the
 * guides uses the same viewport height as the progress and the settle (on phones the
 * window grows past 100svh when the toolbar retracts).
 */
export function useGuideScroll({ enabled, root, barH, levelKey, paused = false, peek = PEEK }: Options) {
  const [atGuides, setAtGuides] = useState(false);
  // True once the sheet covers the title card and panel: they are faded out, so they leave the tab order.
  const [covered, setCovered] = useState(false);
  const lenis = useRef<Lenis | null>(null);
  const barRef = useRef(barH);
  const peekRef = useRef(peek);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const refresh = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    barRef.current = barH;
    peekRef.current = peek;
    refresh.current();
  }, [barH, peek]);

  useEffect(() => {
    if (!enabled) return;
    // Reduced motion: a plain wheel scroll, no smoothing and no settle. Lenis stays for its
    // scroll events and scrollTo, which it makes immediate under reduced motion.
    const reduced = prefersReducedMotion();
    const l = new Lenis({ autoRaf: true, lerp: 0.11, smoothWheel: !reduced });
    lenis.current = l;
    if (pausedRef.current) l.stop();
    let timer: number | undefined;
    // True while a finger or mouse button is down (covers scrollbar drags), when
    // no scroll events arrive but the user is still steering the page.
    let held = false;

    const progress = () => guideProgress(l.scroll, window.innerHeight, peekRef.current, barRef.current);
    // The one viewport height for both sides: the CSS reads --vh, the maths reads innerHeight.
    const writeVh = () => root.current?.style.setProperty('--vh', `${window.innerHeight}px`);
    const update = () => {
      const p = progress();
      root.current?.style.setProperty('--gp', p.toFixed(3));
      setAtGuides(p >= AT_END);
      setCovered(p >= COVERED_AT);
    };
    // Re-arms on every scroll event, including the ones the settle itself causes,
    // so it only fires once the page has stopped; landing on an end then does nothing.
    const arm = () => {
      window.clearTimeout(timer);
      if (reduced) return;
      timer = window.setTimeout(() => {
        if (held || l.isTouching) return arm();
        if (pausedRef.current) return;
        const target = settleTarget(progress());
        if (!target) return;
        const to = target === 'top' ? 0 : window.innerHeight - peekRef.current - barRef.current;
        l.scrollTo(to, { duration: SETTLE_SECONDS });
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
      writeVh();
      update();
      arm();
    };

    refresh.current = update;
    writeVh();
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

  // Freeze the page behind the saved drawer, as Attraction does behind its sheet.
  useEffect(() => {
    if (paused) lenis.current?.stop();
    else lenis.current?.start();
  }, [paused]);

  // A new level starts at the top of the page, whatever the last one was scrolled to. On mount
  // this runs before Lenis exists (it is made in the effect above), so it scrolls the window itself:
  // the page that linked here may have been scrolled to its bottom.
  useLayoutEffect(() => {
    if (lenis.current) lenis.current.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
    root.current?.style.setProperty('--gp', '0');
    setAtGuides(false);
    setCovered(false);
  }, [levelKey, root]);

  const scrollTo = useCallback((to: number) => {
    lenis.current?.scrollTo(to, prefersReducedMotion() ? { immediate: true } : { duration: SETTLE_SECONDS });
  }, []);
  const scrollToGuides = useCallback(
    () => scrollTo(window.innerHeight - peekRef.current - barRef.current),
    [scrollTo],
  );
  const scrollToTop = useCallback(() => scrollTo(0), [scrollTo]);

  return { scrollToGuides, scrollToTop, atGuides, covered };
}
