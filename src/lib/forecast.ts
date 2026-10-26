// A mock rain forecast. A month-by-month baseline per place plus a little repeatable noise, so a
// date always shows the same number. A real forecast service will replace this.
import type { PlaceRef } from './trips';

/** The chance of rain (percent) at which a day counts as likely wet. */
export const LIKELY_WET = 50;

export const isLikelyWet = (chance: number | null): boolean => chance !== null && chance >= LIKELY_WET;

/** Tokyo and the rest of Japan: the early-summer rains run from June to mid-July, typhoon season after. */
function japanBaseline(month: number, day: number): number {
  switch (month) {
    case 0: return 20;
    case 1: return 25;
    case 2: return 35;
    case 3: return 38;
    case 4: return 40;
    case 5: return day <= 15 ? 62 : 72; // June
    case 6: return day <= 15 ? 70 : 55; // July
    case 7: return 52; // August
    case 8: return 58; // September
    case 9: return 38;
    case 10: return 28;
    default: return 20;
  }
}

const OTHER_BASELINE = 30;

/** Japan's id in the world map data; everything inside Japan shares the Tokyo baseline. */
const JAPAN_ID = '392';
const isJapan = (ref: PlaceRef) => ref.level !== 'country' || ref.id === JAPAN_ID;

/** A small integer hash (FNV-1a) so noise depends only on the inputs. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Chance of rain, 0..100, for a place on a date. Mock: deterministic for the same date and place.
 * Null when there is no date. With no place it uses Japan's baseline.
 */
export function getRainChance(ref: PlaceRef | null, date: Date | null): number | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const base = !ref || isJapan(ref) ? japanBaseline(date.getMonth(), date.getDate()) : OTHER_BASELINE;
  const key = `${ref ? `${ref.level}:${ref.id}` : '-'}|${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const jitter = (hash(key) % 21) - 10; // -10..+10
  return Math.min(100, Math.max(0, base + jitter));
}
