// What the planner's day panel shows, as it lives in the URL: the sub-tab (&tab=browse; Plan is the
// default and leaves no param), the wet-weather toggle (&wet=1) and the spotlit attraction
// (&spot=meiji-jingu). Pure, so it can be tested.
import { attractionById } from '../data/attractions';

/** The day panel's sub-tabs: the day's plan, and a list of everything on the map to pick from. */
export type PlanTab = 'plan' | 'browse';

export interface DayView {
  tab: PlanTab;
  /** The wet-weather toggle: the list shows the day's wet-weather plan, and adds go there. */
  wet: boolean;
  /** The attraction in the map's spotlight, its card open; null when none (or an id that isn't one). */
  spot: string | null;
}

/** Reads the day view from the planner's search. An old link's `tab=wet` opens Plan with the toggle on. */
export function readDayView(params: URLSearchParams): DayView {
  const tab = params.get('tab');
  const spot = params.get('spot');
  return {
    tab: tab === 'browse' ? 'browse' : 'plan',
    wet: params.get('wet') === '1' || tab === 'wet',
    spot: spot && attractionById(spot) ? spot : null,
  };
}

/** The search with the day view changed; everything else in it stays. */
export function writeDayView(params: URLSearchParams, next: Partial<DayView>): URLSearchParams {
  const v = { ...readDayView(params), ...next };
  const q = new URLSearchParams(params);
  if (v.tab === 'plan') q.delete('tab');
  else q.set('tab', v.tab);
  if (v.wet) q.set('wet', '1');
  else q.delete('wet');
  if (v.spot) q.set('spot', v.spot);
  else q.delete('spot');
  return q;
}
