// The trip planner's Browse sub-tab and its calm map markers: which attractions to list, the filter
// chips, the sort, each row's action, and each marker's kind and accessible name. Pure.
import { attractionById } from '../data/attractions';
import type { Attraction } from '../data/types';
import { FILTERS, isRainProof, readings } from './factors';
import { nodeOf } from './placeTree';
import { bestSlot, type TimeSlot } from './timeOfDay';
import { attractionsIn } from './tripPlaces';
import { dayOf, type PlaceRef, type Trip } from './trips';

// ---------- markers ----------

/** An attraction on the planner map: one of today's stops (numbered in route order), a stop on another day, or not planned. */
export type Marker = { kind: 'today'; day: number; n: number } | { kind: 'other'; day: number } | { kind: 'free' };

const FREE: Marker = { kind: 'free' };

/**
 * Every planned attraction's marker. Today's stops are numbered 1, 2, 3… in the day's own order,
 * skipping ids the data no longer has (as the day list does). Wet-weather plans don't count.
 */
export function markersFor(trip: Trip, day: number): Record<string, Marker> {
  const out: Record<string, Marker> = {};
  trip.days.forEach((d, i) => {
    let n = 0;
    for (const id of d.stops) {
      if (!attractionById(id)) continue;
      out[id] = i === day ? { kind: 'today', day: i, n: ++n } : { kind: 'other', day: i };
    }
  });
  return out;
}

export const markerOf = (markers: Record<string, Marker> | undefined, id: string): Marker => markers?.[id] ?? FREE;

/** "Sensō-ji, Day 1 stop 1, ¥360", "Meiji Jingu, on Day 2, ¥400", "Golden Gai, not planned, ¥2,800". */
export function markerName(a: Attraction, m: Marker): string {
  const where = m.kind === 'today' ? `Day ${m.day + 1} stop ${m.n}` : m.kind === 'other' ? `on Day ${m.day + 1}` : 'not planned';
  return `${a.name}, ${where}, ${readings(a).cost}`;
}

// ---------- filters ----------

export type BrowseFilterId = 'rain' | 'easy' | 'local' | 'free' | TimeSlot;

const SLOT_LABEL: Record<TimeSlot, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
const slot = (s: TimeSlot) => ({ id: s, label: SLOT_LABEL[s], test: (a: Attraction) => a.conditions.timeOfDay[s] === 'good' });

/** The chips, multi-select and combined with AND: the list filters, then the parts of the day rated good. */
export const BROWSE_FILTERS: { id: BrowseFilterId; label: string; test: (a: Attraction) => boolean }[] = [
  ...FILTERS.filter((f): f is (typeof FILTERS)[number] & { id: Exclude<typeof f.id, 'all'> } => f.id !== 'all'),
  slot('morning'),
  slot('afternoon'),
  slot('evening'),
];
const testOf = new Map(BROWSE_FILTERS.map((f) => [f.id, f.test]));

/** True when the attraction passes every chip that is on. */
export const matchesAll = (a: Attraction, on: BrowseFilterId[]) => on.every((id) => testOf.get(id)?.(a) ?? true);

/** For each chip, how many the list would show with it on, alongside the chips already on. */
export function filterCounts(list: Attraction[], on: BrowseFilterId[]): Record<BrowseFilterId, number> {
  const out = {} as Record<BrowseFilterId, number>;
  for (const f of BROWSE_FILTERS) {
    const set = on.includes(f.id) ? on : [...on, f.id];
    out[f.id] = list.filter((a) => matchesAll(a, set)).length;
  }
  return out;
}

// ---------- rows ----------

export type RowAction = { kind: 'add' | 'remove' | 'move' | 'replace'; label: string } | { kind: 'note'; label: string };

/**
 * A row's one action on the current day: add it, take it off, or bring it over from another day. In
 * replace mode (always on the current day) any other attraction offers itself as the replacement.
 * With the wet-weather toggle on, the action is on the day's wet-weather plan instead, which takes
 * rain-proof places only; replace mode is off there.
 */
export function rowAction(trip: Trip, day: number, id: string, replacing: string | null, wet = false): RowAction {
  if (wet) {
    const a = attractionById(id);
    if (!a || !isRainProof(a)) return { kind: 'note', label: 'Not rain-proof' };
    if (trip.days[day]?.wet.includes(id)) return { kind: 'remove', label: 'Remove from wet-weather plan' };
    return { kind: 'add', label: 'Add to wet-weather plan' };
  }
  const on = dayOf(trip, id);
  if (replacing) {
    if (id === replacing) return { kind: 'note', label: 'Being replaced' };
    if (on === day) return { kind: 'note', label: `Already on Day ${day + 1}` };
    return { kind: 'replace', label: on !== null ? `On Day ${on + 1} · use as replacement` : 'Use as replacement' };
  }
  if (on === day) return { kind: 'remove', label: `Remove from Day ${day + 1}` };
  if (on !== null) return { kind: 'move', label: `On Day ${on + 1}: move here` };
  return { kind: 'add', label: `Add to Day ${day + 1}` };
}

export interface BrowseRow {
  a: Attraction;
  /** The day it is planned on (0-based), or null. */
  on: number | null;
  /** Its stop number when it is on the current day. */
  n: number | null;
  saved: boolean;
  facts: { cost: string; effort: string; rainProof: boolean; best: TimeSlot | null };
  action: RowAction;
  /** Greyed: the wet-weather toggle is on and it isn't rain-proof. */
  off: boolean;
}

/**
 * The list: the chips applied, unplanned first, then by name. Planned ones stay, with their day. With
 * the wet-weather toggle on, the rain-proof ones come first and the rest are greyed.
 */
export function browseRows(list: Attraction[], trip: Trip, day: number, on: BrowseFilterId[], replacing: string | null, wet = false): BrowseRow[] {
  const markers = markersFor(trip, day);
  return list
    .filter((a) => matchesAll(a, on))
    .map((a): BrowseRow => {
      const m = markerOf(markers, a.id);
      const r = readings(a);
      const rainProof = isRainProof(a);
      return {
        a,
        on: m.kind === 'free' ? null : m.day,
        n: m.kind === 'today' ? m.n : null,
        saved: trip.saved.includes(a.id),
        facts: { cost: r.cost, effort: r.effort, rainProof, best: bestSlot(a) },
        action: rowAction(trip, day, a.id, wet ? null : replacing, wet),
        off: wet && !rainProof,
      };
    })
    .sort((x, y) => Number(x.off) - Number(y.off) || Number(x.on !== null) - Number(y.on !== null) || x.a.name.localeCompare(y.a.name));
}

// ---------- which attractions ----------

/**
 * What Browse lists: the viewed place's attractions at the attraction level; above it, every
 * attraction the trip's places cover, once each. Places without data have none.
 */
export function browsePool(viewed: PlaceRef | null, places: PlaceRef[]): Attraction[] {
  if (!viewed) return [];
  if (nodeOf(viewed).attractionLevel) return attractionsIn(viewed);
  return [...new Map(places.flatMap(attractionsIn).map((a) => [a.id, a])).values()];
}

/**
 * Right after an action in the list, the rows keep the order they had (the status and button change
 * in place) instead of jumping to their new group. Only while the list holds the same rows: a new
 * filter, day or place lists afresh.
 */
export function freezeOrder(rows: BrowseRow[], frozen: string[] | null): BrowseRow[] {
  if (!frozen || frozen.length !== rows.length) return rows;
  const at = new Map(frozen.map((id, i) => [id, i]));
  if (rows.some((r) => !at.has(r.a.id))) return rows;
  return [...rows].sort((x, y) => at.get(x.a.id)! - at.get(y.a.id)!);
}
