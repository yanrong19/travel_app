// Morning, afternoon and evening: which part of the day a stop starts in, and whether that suits it.
// Pure and structured so an optimiser can reorder stops on the same data.
import type { Attraction } from '../data/types';

export type TimeSlot = 'morning' | 'afternoon' | 'evening';
export const TIME_SLOTS: TimeSlot[] = ['morning', 'afternoon', 'evening'];

/** 12:00 and 17:00, in minutes from midnight. */
export const NOON = 12 * 60;
export const EVENING = 17 * 60;

/** Each slot as [from, to) in minutes from midnight. The evening runs on past midnight. */
export const SLOT_RANGES: Record<TimeSlot, [number, number]> = {
  morning: [0, NOON],
  afternoon: [NOON, EVENING],
  evening: [EVENING, 48 * 60],
};

/** The slot a start time falls in. Minutes past 24:00 (a plan running past midnight) stay in the evening. */
export const slotAt = (min: number): TimeSlot => (min < NOON ? 'morning' : min < EVENING ? 'afternoon' : 'evening');

/** The first slot rated good, else the first rated ok; null when every slot is poor. */
export function bestSlot(a: Attraction): TimeSlot | null {
  const t = a.conditions.timeOfDay;
  return TIME_SLOTS.find((s) => t[s] === 'good') ?? TIME_SLOTS.find((s) => t[s] === 'ok') ?? null;
}

/** When a stop starting at `start` lands in a slot rated poor: that slot and the better one. Ok is not a mismatch. */
export function slotMismatch(a: Attraction, start: number): { slot: TimeSlot; better: TimeSlot | null } | null {
  const slot = slotAt(start);
  return a.conditions.timeOfDay[slot] === 'poor' ? { slot, better: bestSlot(a) } : null;
}
