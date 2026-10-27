import { useLayoutEffect, useState } from 'react';

/**
 * The top safe-area inset in px (the notch or status bar on a phone in a full-screen web app), so
 * scroll maths can use the same number the CSS gets from `env(safe-area-inset-top)`. 0 elsewhere.
 * Only measured while `enabled`.
 */
export function useSafeTop(enabled: boolean) {
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    if (!enabled) return;
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const measure = () => setTop(Math.round(probe.getBoundingClientRect().height));
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      probe.remove();
    };
  }, [enabled]);
  return enabled ? top : 0;
}
