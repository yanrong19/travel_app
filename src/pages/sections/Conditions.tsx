import type { Attraction, Rating } from '../../data/types';
import { Icon, type IconName } from '../../components/Icon';
import { MONTHS, hhmm } from '../../lib/format';
import { isRainProof, unflagged, type Flag } from '../../lib/factors';
import { closedIn, hourCrowd, momentOver, momentsIn, openSpans, type BestWindow, type DayWindow, type Moment } from '../../lib/bestTime';
import { FactorRow, Meter, RATING_WORD, RatingMark, Tile, Tiles } from './parts';

const WEATHER: { key: keyof Attraction['conditions']['weather']; label: string; icon: IconName }[] = [
  { key: 'sun', label: 'Sun', icon: 'sun' },
  { key: 'cloud', label: 'Cloud', icon: 'cloud' },
  { key: 'rain', label: 'Light rain', icon: 'rain' },
  { key: 'heavyRain', label: 'Heavy rain', icon: 'storm' },
  { key: 'wind', label: 'Strong wind', icon: 'wind' },
  { key: 'heat', label: 'Over 32°C', icon: 'heat' },
];

const MONTH_WORD: Record<Rating, string> = { good: 'Best', ok: 'Fine', poor: 'Avoid' };
const VIS_WORD = { none: 'Doesn’t matter', some: 'Nice to have', critical: 'Make or break' };

/** A planned stop's time on the day, minutes from midnight. */
export type StopTime = { start: number; end: number };

interface Props {
  a: Attraction;
  flags: Flag[];
  /** The day the best time has to fit: the trip day's in planning, a default day otherwise. */
  win: DayWindow;
  /** 0 = Monday. */
  weekday: number;
  /** This attraction's stop on that day, when it is planned there. */
  stop: StopTime | null;
  /** The best block in that day (bestWindow). */
  best: BestWindow;
  /** The months to pick out (0 = January): the trip's, or this month. */
  months: number[];
  /** What those months are, for screen readers: "your trip" or "this month". */
  monthsWord: string;
}

/** The headline and the sentence under it. */
function says(a: Attraction, win: DayWindow, weekday: number, best: BestWindow): [string, string] {
  if (best.kind === 'best') {
    const moment = best.why === 'moment' ? momentOver(a, best.from, best.to) : null;
    return [`Best ${hhmm(best.from)}–${hhmm(best.to)}`, moment ? `${moment.label}, inside your day.` : 'Quietest part of your day.'];
  }
  if (best.opensAt === null) return ['Closed during your day', 'Closed that day'];
  if (best.opensAt >= win.end) return ['Closed during your day', `Opens ${hhmm(best.opensAt)}`];
  // Open earlier that day and shut before the window starts.
  const shuts = Math.max(...openSpans(a, weekday).map(([, c]) => c).filter((c) => c <= win.start));
  return ['Closed during your day', Number.isFinite(shuts) ? `Shuts at ${hhmm(shuts)}, before your day starts` : `Opens ${hhmm(best.opensAt)}`];
}

/** What the timeline shows beyond the headline: the planned stop and when the place is shut. */
function timelineNote(a: Attraction, win: DayWindow, weekday: number, stop: StopTime | null) {
  const out: string[] = [];
  if (stop && stop.end > win.start && stop.start < win.end) out.push(`Your stop ${hhmm(stop.start)}–${hhmm(stop.end)}.`);
  for (const [f, t] of closedIn(a, weekday, win)) {
    if (f === win.start && t === win.end) continue; // the headline says so
    out.push(f === win.start ? `Closed before ${hhmm(t)}.` : t === win.end ? `Closed from ${hhmm(f)}.` : `Closed ${hhmm(f)}–${hhmm(t)}.`);
  }
  return out.join(' ') || undefined;
}

export function Conditions({ a, flags, win, weekday, stop, best, months, monthsWord }: Props) {
  const c = a.conditions;
  const [headline, sentence] = says(a, win, weekday, best);
  const moments = momentsIn(a, win);

  return (
    <FactorRow
      line="conditions"
      headline={headline}
      extra={
        isRainProof(a) && (
          <span className="frow-pill">
            <Icon name="drop" size={14} />
            Wet-weather friendly
          </span>
        )
      }
      sub={sentence}
      srNote={timelineNote(a, win, weekday, stop)}
      visual={<DayFit a={a} win={win} weekday={weekday} best={best} stop={stop} moments={moments} />}
      flags={flags}
    >
      <Tiles>
        <Tile label="Weather" wide notes={[c.weatherNote]}>
          <ul className="weather">
            {WEATHER.map((w) => {
              const r = c.weather[w.key];
              return (
                <li key={w.key} className={`is-${r}`}>
                  <Icon name={w.icon} size={20} />
                  <span className="weather-label">{w.label}</span>
                  <RatingMark r={r} />
                  <span className="weather-word">{RATING_WORD[r]}</span>
                </li>
              );
            })}
          </ul>
        </Tile>
        <Tile label="Under a roof" value={c.covered} unit="%">
          <Meter value={c.covered} label="Share of the visit under a roof" />
        </Tile>
        <Tile label="Clear skies" value={VIS_WORD[c.visibility]} notes={[c.visibilityNote]} />
        <Tile
          label="Months"
          wide
          notes={[unflagged(c.monthsNote, flags)]}
          aside={
            <span className="legend">
              <span className="legend-item is-good">Best</span>
              <span className="legend-item is-ok">Fine</span>
              <span className="legend-item is-poor">Avoid</span>
            </span>
          }
        >
          <ol className="months">
            {c.months.map((r, i) => {
              const now = months.includes(i);
              return (
                <li key={i} className={`is-${r} ${now ? 'is-now' : 'is-other'}`} title={`${MONTHS[i]}: ${MONTH_WORD[r]}`}>
                  <span className="months-name">{MONTHS[i]}</span>
                  <span className="sr-only">
                    {MONTH_WORD[r]}
                    {now ? `, ${monthsWord}` : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </Tile>
        <Tile label="Time of day" wide notes={[c.timeOfDay.note]}>
          {moments.length > 0 && (
            <ul className="ftile-list">
              {moments.map((b) => (
                <li key={b.label}>
                  <strong className="num">
                    {hhmm(b.from)}–{hhmm(b.to)}
                  </strong>
                  {b.label}
                </li>
              ))}
            </ul>
          )}
        </Tile>
      </Tiles>
    </FactorRow>
  );
}

/**
 * The user's day only: a bar per hour for how busy it gets (closed hours greyed), the best block as a
 * band, the planned stop as a dashed box, ticks at the start, middle and end, and the curated moments
 * that fall inside the day as chips.
 */
function DayFit({ a, win, weekday, best, stop, moments }: { a: Attraction; win: DayWindow; weekday: number; best: BestWindow; stop: StopTime | null; moments: Moment[] }) {
  const len = win.end - win.start;
  const x = (m: number) => ((Math.max(win.start, Math.min(win.end, m)) - win.start) / len) * 100;
  const box = (from: number, to: number) => ({ left: `${x(from)}%`, width: `${x(to) - x(from)}%` });
  // An hour is drawn open when any part of it is, at the crowd the best block's score uses for it.
  const hours: { from: number; to: number; crowd: number | null }[] = [];
  for (let h = Math.floor(win.start / 60); h * 60 < win.end; h++) {
    const from = Math.max(h * 60, win.start);
    const to = Math.min((h + 1) * 60, win.end);
    hours.push({ from, to, crowd: hourCrowd(a, weekday, from, to) });
  }
  const inBest = (from: number, to: number) => best.kind === 'best' && from < best.to && to > best.from;
  const mid = Math.round((win.start + win.end) / 60) * 30;
  const ticks = mid - win.start >= 60 && win.end - mid >= 60 ? [win.start, mid, win.end] : [win.start, win.end];
  const showStop = stop && stop.end > win.start && stop.start < win.end;
  return (
    <span className="fvis dfit">
      <span className="dfit-chart">
        {best.kind === 'best' && <span className="dfit-band" style={box(best.from, best.to)} />}
        {hours.map((h) => (
          <span
            key={h.from}
            className={`dfit-bar ${h.crowd === null ? 'is-closed' : ''} ${inBest(h.from, h.to) ? 'is-best' : ''}`}
            style={{ ...box(h.from, h.to), height: h.crowd === null ? undefined : `${Math.max(8, h.crowd)}%` }}
          />
        ))}
        {showStop && <span className="dfit-stop" style={box(stop.start, stop.end)} />}
      </span>
      <span className="ftrack-ticks">
        {ticks.map((m) => (
          <span key={m} className="num" style={{ left: `${x(m)}%` }}>
            {hhmm(m)}
          </span>
        ))}
      </span>
      {(moments.length > 0 || showStop || hours.some((h) => h.crowd === null)) && (
        <span className="dfit-foot">
          {moments.map((m) => (
            <span key={m.label} className="dfit-chip">
              <strong className="num">
                {hhmm(m.from)}–{hhmm(m.to)}
              </strong>{' '}
              {m.label.charAt(0).toLowerCase() + m.label.slice(1)}
            </span>
          ))}
          {showStop && <span className="dfit-key is-stop">Your stop</span>}
          {hours.some((h) => h.crowd === null) && <span className="dfit-key is-closed">Closed</span>}
        </span>
      )}
    </span>
  );
}
