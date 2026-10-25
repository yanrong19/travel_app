import { useEffect, useLayoutEffect, useRef, useState, type ElementType } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { prefersReducedMotion } from '../lib/motion';

gsap.registerPlugin(SplitText);

// Place names in Anybody. Each letter rises out of a mask while its width axis
// opens from condensed to wide; on change the old name folds up first.
const NARROW = '"wdth" 50, "wght" 380';
const WIDE = '"wdth" 150, "wght" 300';

interface Props {
  text: string;
  sub?: string;
  as?: ElementType;
  className?: string;
  /** Delay before the first entrance, in seconds. */
  delay?: number;
  /** Resting width axis (50–150). Long names rest narrower so they keep to two lines. */
  width?: number;
}

export function KineticTitle({ text, sub, as: Tag = 'h1', className = '', delay = 0, width = 118 }: Props) {
  const REST = `"wdth" ${width}, "wght" 640`;
  const root = useRef<HTMLElement>(null);
  const [shown, setShown] = useState({ text, sub });
  const firstRun = useRef(true);
  const leaving = useRef<gsap.core.Tween | null>(null);

  // Entrance for whatever is shown now.
  useLayoutEffect(() => {
    const el = root.current?.querySelector<HTMLElement>('.kt-main');
    const subEl = root.current?.querySelector<HTMLElement>('.kt-sub');
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.visibility = 'visible';
      return;
    }
    let split: SplitText | null = null;
    let tl: gsap.core.Timeline | null = null;
    let cancelled = false;
    // Wait for Anybody so letters are measured in it, but never longer than 900ms.
    const fontReady = Promise.race([document.fonts.load('640 64px Anybody'), new Promise((r) => setTimeout(r, 900))]);
    fontReady.catch(() => undefined).then(() => {
      if (cancelled) return;
      split = SplitText.create(el, { type: 'words,chars', wordsClass: 'kt-word', charsClass: 'kt-char', mask: 'chars' });
      el.style.visibility = 'visible';
      tl = gsap.timeline({ delay: firstRun.current ? delay : 0.05 });
      tl.fromTo(
        split.chars,
        { yPercent: 105, fontVariationSettings: NARROW },
        { yPercent: 0, fontVariationSettings: REST, duration: 1.05, ease: 'expo.out', stagger: 0.028 },
      );
      if (subEl) tl.fromTo(subEl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }, 0.25);
      firstRun.current = false;
    });
    return () => {
      cancelled = true;
      tl?.kill();
      split?.revert();
    };
    // REST derives from width
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, delay]);

  // Exit the old name, then swap.
  useEffect(() => {
    if (text === shown.text && sub === shown.sub) return;
    const chars = root.current?.querySelectorAll<HTMLElement>('.kt-char');
    const subEl = root.current?.querySelector<HTMLElement>('.kt-sub');
    leaving.current?.kill();
    if (!chars?.length || prefersReducedMotion()) {
      setShown({ text, sub });
      return;
    }
    if (subEl) gsap.to(subEl, { opacity: 0, duration: 0.2 });
    leaving.current = gsap.to(chars, {
      yPercent: -105,
      fontVariationSettings: WIDE,
      duration: 0.34,
      ease: 'power3.in',
      stagger: 0.012,
      onComplete: () => setShown({ text, sub }),
    });
  }, [text, sub, shown]);

  return (
    <Tag ref={root} className={`kt ${className}`} style={{ fontVariationSettings: REST }} aria-label={sub ? `${text} ${sub}` : text}>
      {/* Keyed so each name gets a fresh element: SplitText's revert would
          otherwise put the previous name back after React has changed it. */}
      <span key={`m-${shown.text}`} className="kt-main" aria-hidden="true">
        {shown.text}
      </span>
      {shown.sub && (
        <span key={`s-${shown.sub}`} className="kt-sub" aria-hidden="true" lang="ja">
          {shown.sub}
        </span>
      )}
    </Tag>
  );
}
