import type { Attraction, Rating } from '../../data/types';
import { Icon, type IconName } from '../../components/Icon';
import { MONTHS, clock } from '../../lib/format';
import { isRainProof, type Flag } from '../../lib/factors';
import { FactorRow, Meter, Notes, RATING_WORD, RatingMark, Tile, Tiles } from './parts';

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

/** The timeline runs over the crowd curve's hours, 06:00 to 23:00. */
const DAY_START = 6;
const DAY_END = 23;
const TICKS = [6, 12, 18, 23];
const at = (h: number) => ((Math.max(DAY_START, Math.min(DAY_END, h)) - DAY_START) / (DAY_END - DAY_START)) * 100;

export function Conditions({ a, flags }: { a: Attraction; flags: Flag[] }) {
  const c = a.conditions;
  const month = new Date().getMonth();
  const best = c.bestTimes[0];
  const headline = best ? `Best ${clock(best.from)}–${clock(best.to)}` : 'Any time of day';

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
      visual={<DayLine bestTimes={c.bestTimes} />}
      flags={flags}
    >
      <Tiles>
        <Tile label="Weather" wide>
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
        <Tile label="Clear skies" value={VIS_WORD[c.visibility]} />
        <Tile
          label="Months"
          wide
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
                <span className="sr-only">
                  {MONTH_WORD[r]}
                  {i === month ? ', this month' : ''}
                </span>
              </li>
            ))}
          </ol>
        </Tile>
        {c.bestTimes.length > 0 && (
          <Tile label={c.bestTimes.length > 1 ? 'Best windows' : 'Best window'} wide>
            <ul className="ftile-list">
              {c.bestTimes.map((b) => (
                <li key={b.label}>
                  <strong className="num">
                    {clock(b.from)}–{clock(b.to)}
                  </strong>
                  {b.label}
                </li>
              ))}
            </ul>
          </Tile>
        )}
      </Tiles>
      <Notes items={[c.weatherNote, c.monthsNote, c.visibilityNote, c.timeOfDay.note]} />
    </FactorRow>
  );
}

/** 06:00 to 23:00 with the best hours lit. */
function DayLine({ bestTimes }: { bestTimes: Attraction['conditions']['bestTimes'] }) {
  return (
    <span className="fvis">
      <span className="ftrack">
        {bestTimes.map((b) => (
          <span key={b.label} className="ftrack-band" style={{ left: `${at(b.from)}%`, width: `${Math.max(1.5, at(b.to) - at(b.from))}%` }} />
        ))}
      </span>
      <span className="ftrack-ticks">
        {TICKS.map((h) => (
          <span key={h} className="num" style={{ left: `${at(h)}%` }}>
            {clock(h)}
          </span>
        ))}
      </span>
    </span>
  );
}
