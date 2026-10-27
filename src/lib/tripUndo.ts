// What the planner's Undo buttons run: each builder returns an edit, (trip, now) => trip, to apply to
// the trip as it is when Undo is pressed. An undo never overrides a change made since: if the plan has
// moved on, it does nothing.
import { addStop, dayOf, moveStop, removePlace, removeStop, replaceStop, setDays, type PlaceRef, type Trip } from './trips';

export type Edit = (t: Trip, now: number) => Trip;

type ListField = 'places' | 'days' | 'saved';

/**
 * Puts the listed fields back as they were in `before`, if they still read exactly as the action left
 * them (`after`). Otherwise the plan has changed since, and it's a no-op.
 */
function restoreIfUnchanged(before: Trip, after: Trip, fields: ListField[]): Edit {
  const pick = (t: Trip) => JSON.stringify(fields.map((f) => t[f]));
  const was = pick(after);
  return (t, now) => {
    if (pick(t) !== was) return t;
    const back: Partial<Trip> = {};
    for (const f of fields) Object.assign(back, { [f]: before[f] });
    return { ...t, ...back, updatedAt: now };
  };
}

/** A stop removed from a day goes back where it was, unless it has been planned on a day since. */
export function undoRemoveStop(day: number, id: string, index: number): Edit {
  return (t, now) => {
    if (dayOf(t, id) !== null) return t;
    const back = addStop(t, day, id, now);
    const at = back.days[day]?.stops.indexOf(id) ?? -1;
    return at < 0 ? back : moveStop(back, day, at, Math.min(index, at), now);
  };
}

/**
 * A stop added to a day goes back off it; one moved there from another day goes back to that day at
 * its old index (`from`). A no-op once it is no longer on `day` (removed or moved again since).
 */
export function undoAddStop(day: number, id: string, from: { day: number; index: number } | null): Edit {
  return (t, now) => {
    if (dayOf(t, id) !== day) return t;
    const off = removeStop(t, day, id, now);
    return from ? undoRemoveStop(from.day, id, from.index)(off, now) : off;
  };
}

/** A replace: the day lists and saved go back as they were, unless they have changed since. */
export function undoReplace(before: Trip, day: number, oldId: string, newId: string): Edit {
  return restoreIfUnchanged(before, replaceStop(before, day, oldId, newId, 0), ['days', 'saved']);
}

/** A stop removed from a wet-weather plan goes back where it was, unless it is back in the plan already. */
export function undoRemoveWet(day: number, id: string, index: number): Edit {
  return (t, now) => {
    const wet = t.days[day]?.wet;
    if (!wet || wet.includes(id)) return t;
    const days = t.days.map((x, i) => (i === day ? { ...x, wet: [...wet.slice(0, index), id, ...wet.slice(index)] } : x));
    return { ...t, days, updatedAt: now };
  };
}

/** A removed place: the places, days and saved go back as they were, unless they have changed since. */
export function undoRemovePlace(before: Trip, ref: PlaceRef, removeStops: string[]): Edit {
  return restoreIfUnchanged(before, removePlace(before, ref, removeStops, 0), ['places', 'days', 'saved']);
}

/** Fewer days: the cut days come back (stops, wet plans, times) and saved goes back as it was, unless either has changed since. */
export function undoSetDays(before: Trip, n: number): Edit {
  return restoreIfUnchanged(before, setDays(before, n, 0), ['days', 'saved']);
}

/** An attraction taken off saved goes back where it was, unless it is saved again already. */
export function undoUnsave(id: string, index: number): Edit {
  return (t, now) => {
    if (t.saved.includes(id)) return t;
    return { ...t, saved: [...t.saved.slice(0, index), id, ...t.saved.slice(index)], updatedAt: now };
  };
}
