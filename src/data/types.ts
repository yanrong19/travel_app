export type Rating = 'good' | 'ok' | 'poor';
export type Access = 'yes' | 'partial' | 'no';
export type Trigger = 'heights' | 'crowds' | 'enclosed' | 'water' | 'dark' | 'loud';

/** Hours of the day the crowd curve covers: 06:00 to 23:00. */
export const CROWD_START_HOUR = 6;

export interface Attraction {
  id: string;
  name: string;
  ja: string;
  /** Municipality code from the Tokyo map, e.g. "13106" for Taitō. */
  area: string;
  lonlat: [number, number];
  kind: string;
  blurb: string;

  conditions: {
    weather: { sun: Rating; cloud: Rating; rain: Rating; heavyRain: Rating; wind: Rating; heat: Rating };
    weatherNote: string;
    /** Share of the visit spent under a roof, 0–100. */
    covered: number;
    /** Twelve ratings, January first. */
    months: Rating[];
    monthsNote: string;
    bestTimes: { from: number; to: number; label: string }[];
    visibility: 'none' | 'some' | 'critical';
    visibilityNote?: string;
    /**
     * How well each part of the day suits a visit starting then. The app's slots: morning before
     * 12:00, afternoon 12:00–17:00, evening 17:00 onward (the day summary's boundaries; see
     * lib/timeOfDay). A slot the place is closed for on every day is never 'good'.
     */
    timeOfDay: { morning: Rating; afternoon: Rating; evening: Rating; note: string };
  };

  effort: {
    level: 1 | 2 | 3 | 4 | 5;
    walkKm: number;
    steps: number;
    climbM: number;
    onFeetMin: number;
    /** Share of walking in shade, 0–100. */
    shade: number;
    wheelchair: Access;
    stroller: Access;
    triggers: Trigger[];
    recovery: 'low' | 'medium' | 'high';
    note: string;
  };

  vibe: {
    /** 0 = mostly tourists, 100 = mostly locals. */
    local: number;
    /** 0 = city, 100 = nature. */
    nature: number;
    /** 0 = calm, 100 = lively. */
    energy: number;
    /** Busyness 0–100 for each hour from 06:00 to 23:00; null when closed. */
    crowds: { weekday: (number | null)[]; weekend: (number | null)[] };
    suits: { solo: Rating; couple: Rating; family: Rating; friends: Rating };
    onlyHere: 'only-tokyo' | 'only-japan' | 'common';
    onlyHereNote: string;
    /** 0 = about the experience, 100 = about the photo. */
    photo: number;
  };

  logistics: {
    visitMin: [number, number];
    queueMin: [number, number];
    travelMin: number;
    /** Seven entries, Monday first. null = closed that day. */
    hours: ([string, string] | null)[];
    hoursNote?: string;
    lastEntryMin?: number;
    booking: 'required' | 'recommended' | 'none';
    bookingNote?: string;
    leadDays?: number;
    timing: 'fixed' | 'flexible';
    station: string;
    walkMin: number;
    lastTrainNote?: string;
    lockers: boolean;
    holidayNote?: string;
    etiquette?: string;
  };

  cost: {
    entry: number;
    extras: { label: string; yen: number; optional?: boolean }[];
    cash: 'cash-only' | 'mostly-cash' | 'cards';
    cashNote?: string;
    freeNote?: string;
  };
}
