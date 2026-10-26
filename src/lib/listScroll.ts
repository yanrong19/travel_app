import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './motion';

/**
 * The scrollTop that brings an item into a scrolling list's view by the shortest move, like
 * `scrollIntoView({ block: 'nearest' })` but on that list only, never the page around it.
 * `itemTop` is measured from the top of the list's content; `pad` keeps a little room around it.
 */
export function nearestScrollTop(scrollTop: number, viewH: number, itemTop: number, itemH: number, pad = 0) {
  const top = itemTop - pad;
  const bottom = itemTop + itemH + pad;
  if (top < scrollTop) return Math.max(0, top);
  if (bottom > scrollTop + viewH) return Math.max(0, Math.min(top, bottom - viewH));
  return scrollTop;
}

/** Scrolls `list` so `item` (a descendant) is in view, by the shortest move, touching only the list. */
export function revealInList(list: HTMLElement, item: HTMLElement, pad = 6) {
  const lr = list.getBoundingClientRect();
  const ir = item.getBoundingClientRect();
  const itemTop = ir.top - lr.top - list.clientTop + list.scrollTop;
  const next = nearestScrollTop(list.scrollTop, list.clientHeight, itemTop, ir.height, pad);
  if (next !== list.scrollTop) list.scrollTo({ top: next, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

/**
 * A panel list whose lit row can change from outside it (the map under the pointer): the row is
 * scrolled into the list's view, unless the pointer or focus is in the list already, where the
 * user is steering it. `selector` finds the lit row inside the list, or is null for none.
 */
export function useRevealLit<T extends HTMLElement>(selector: string | null) {
  const list = useRef<T>(null);
  const inside = useRef(false);
  useEffect(() => {
    const el = list.current;
    if (!selector || !el || inside.current || el.contains(document.activeElement)) return;
    const row = el.querySelector<HTMLElement>(selector);
    if (row) revealInList(el, row);
  }, [selector]);
  return {
    list,
    onPointerEnter: () => {
      inside.current = true;
    },
    onPointerLeave: () => {
      inside.current = false;
    },
  };
}
