export const yen = (n: number) => (n === 0 ? 'Free' : `¥${n.toLocaleString('en-US')}`);
export const yenPlain = (n: number) => `¥${n.toLocaleString('en-US')}`;

export function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export function durationRange([a, b]: [number, number]) {
  if (a === b) return duration(a);
  // Share the unit when both ends sit under an hour.
  if (b < 60) return `${a}–${b} min`;
  return `${duration(a)} – ${duration(b)}`;
}

/** 9.5 → "09:30" */
export function clock(h: number) {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** "17:45" → 17.75; "02:00" after midnight stays 2. */
export const hourOf = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
};

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
