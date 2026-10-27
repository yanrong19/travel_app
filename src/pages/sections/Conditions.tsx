import type { Attraction, Rating } from '../../data/types';
import { Icon, type IconName } from '../../components/Icon';
import { MONTHS, clock, hourOf } from '../../lib/format';
import { isRainProof } from '../../lib/factors';
import { TIME_SLOTS, type TimeSlot } from '../../lib/timeOfDay';
import { Card, FactorSection, Figure, Meter, Note, RATING_WORD, RatingMark } from './parts';

const WEATHER: { key: keyof Attraction['conditions']['weather']; label: string; icon: IconName }[] = [
  { key: 'sun', label: 'Sun', icon: 'sun' },
  { key: 'cloud', label: 'Cloud', icon: 'cloud' },
  { key: 'rain', label: 'Light rain', icon: 'rain' },
  { key: 'heavyRain', label: 'Heavy rain', icon: 'storm' },
  { key: 'wind', label: 'Strong wind', icon: 'wind' },
  { key: 'heat', label: 'Over 32°C', icon: 'heat' },
];

const MONTH_WORD: Record<Rating, string> = { good: 'Best', ok: 'Fine', poor: 'Avoid' };
const SLOT_LABEL: Record<TimeSlot, { name: string; hours: string }> = {
  morning: { name: 'Morning', hours: 'Before 12:00' },
  afternoon: { name: 'Afternoon', hours: '12:00–17:00' },
  evening: { name: 'Evening', hours: 'From 17:00' },
};
const VIS_WORD = { none: 'Doesn’t matter', some: 'Nice to have', critical: 'Make or break' };

export function Conditions({ a, todayIndex }: { a: Attraction; todayIndex: number }) {
  const c = a.conditions;
  const month = new Date().getMonth();
  const summary = isRainProof(a)
    ? 'Weather barely matters here, so it works as a rain plan.'
    : c.weather.rain === 'poor'
      ? 'Keep it for a dry day, and have a backup ready.'
      : 'Best in fair weather, but light rain won’t ruin it.';

  return (
    <FactorSection line="conditions" summary={summary}>
      <Card title="Weather" span={4}>
        <ul className="weather">
          {WEATHER.map((w) => {
            const r = c.weather[w.key];
            return (
              <li key={w.key} className={`is-${r}`}>
                <Icon name={w.icon} size={22} />
                <span className="weather-label">{w.label}</span>
                <RatingMark r={r} />
                <span className="weather-word">{RATING_WORD[r]}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Under a roof" span={2}>
        <Figure value={c.covered} unit="%" note="of the visit" />
        <Meter value={c.covered} label="Share of the visit under a roof" />
        <Note>{c.weatherNote}</Note>
      </Card>

      <Card
        title="Months"
        span={4}
        aside={
          <span className="legend">
            <span className="legend-item is-good">Best</span>
            <span className="legend-item is-ok">Fine</span>
            <span className="legend-item is-poor">Avoid</span>
          </span>
        }
      >
        <ol className="months">
          {c.months.map((r, i) => (
            <li key={i} className={`is-${r} ${i === month ? 'is-now' : ''}`} title={`${MONTHS[i]}: ${MONTH_WORD[r]}`}>
              <span className="months-name">{MONTHS[i]}</span>
              <span className="sr-only">{MONTH_WORD[r]}</span>
            </li>
          ))}
        </ol>
        <Note>
          {c.monthsNote} The outlined month is this month.
        </Note>
      </Card>

      <Card title="Clear skies" span={2}>
        <p className="big-word">{VIS_WORD[c.visibility]}</p>
        <Note>{c.visibilityNote ?? 'Nothing here depends on the view.'}</Note>
      </Card>

      <Card title="Best part of the day" span={6}>
        <ul className="tod">
          {TIME_SLOTS.map((slot) => {
            const r = c.timeOfDay[slot];
            return (
              <li key={slot} className={`tod-pill is-${r}`}>
                <span className="tod-text">
                  <strong>{SLOT_LABEL[slot].name}</strong> · {RATING_WORD[r].toLowerCase()}
                </span>
                <span className="tod-hours num">{SLOT_LABEL[slot].hours}</span>
              </li>
            );
          })}
        </ul>
        <Note>{c.timeOfDay.note}</Note>
      </Card>

      <Card title="Best time of day" span={6} aside={<span className="card-aside">Hours shown for today</span>}>
        <DayStrip a={a} todayIndex={todayIndex} />
      </Card>
    </FactorSection>
  );
}

function DayStrip({ a, todayIndex }: { a: Attraction; todayIndex: number }) {
  const today = a.logistics.hours[todayIndex];
  let open = today ? hourOf(today[0]) : null;
  let close = today ? hourOf(today[1]) : null;
  if (open != null && close != null && close <= open) close += 24; // closes after midnight
  const best = a.conditions.bestTimes;
  const start = Math.min(5, open ?? 5, ...best.map((b) => b.from));
  const end = Math.max(24, close ?? 24, ...best.map((b) => b.to));
  const pct = (h: number) => ((h - start) / (end - start)) * 100;
  const ticks: number[] = [];
  for (let h = Math.ceil(start / 3) * 3; h <= end; h += 3) ticks.push(h);

  return (
    <div className="daystrip">
      <div className="daystrip-labels">
        {best.map((b) => (
          <span key={b.label} className="daystrip-label" style={{ left: `${pct(b.from)}%` }}>
            {b.label}
          </span>
        ))}
      </div>
      <div className="daystrip-track">
        {open != null && close != null && (
          <span className="daystrip-open" style={{ left: `${pct(open)}%`, width: `${pct(close) - pct(open)}%` }} />
        )}
        {best.map((b) => (
          <span key={b.label} className="daystrip-best" style={{ left: `${pct(b.from)}%`, width: `${pct(b.to) - pct(b.from)}%` }} />
        ))}
      </div>
      <div className="daystrip-ticks" aria-hidden="true">
        {ticks.map((h) => (
          <span key={h} style={{ left: `${pct(h)}%` }}>
            {clock(h)}
          </span>
        ))}
      </div>
      <ul className="daystrip-list">
        {best.map((b) => (
          <li key={b.label}>
            <strong className="num">
              {clock(b.from)}–{clock(b.to)}
            </strong>
            {b.label}
          </li>
        ))}
      </ul>
      <p className="daystrip-key">
        <span className="key-open" /> Open today{' '}
        {today ? (
          <span className="num">
            {today[0]}–{today[1]}
          </span>
        ) : (
          'Closed today'
        )}
        <span className="key-best" /> Best window
      </p>
    </div>
  );
}
