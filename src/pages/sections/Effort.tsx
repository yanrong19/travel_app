import type { Access, Attraction, Trigger } from '../../data/types';
import { EFFORT_LABELS } from '../../lib/factors';
import { duration } from '../../lib/format';
import { Card, FactorSection, Figure, Meter, Note } from './parts';

const ACCESS_WORD: Record<Access, string> = { yes: 'Yes', partial: 'Partly', no: 'No' };
const TRIGGER_WORD: Record<Trigger, string> = {
  heights: 'Heights',
  crowds: 'Dense crowds',
  enclosed: 'Tight spaces',
  water: 'Wading in water',
  dark: 'Darkness',
  loud: 'Loud rooms',
};
const RECOVERY_WORD = { low: 'Plenty left', medium: 'Some left', high: 'Little left' };

export function Effort({ a }: { a: Attraction }) {
  const e = a.effort;
  const summary =
    e.level >= 4
      ? 'A real workout. Plan the rest of the day around it.'
      : e.level === 3
        ? 'Some climbing and a lot of time on your feet.'
        : 'Gentle on the body. Most people will manage it easily.';

  return (
    <FactorSection line="effort" summary={summary}>
      <Card title="Intensity" span={3}>
        <ol className="steps" aria-label={`Intensity: ${EFFORT_LABELS[e.level - 1]}`}>
          {EFFORT_LABELS.map((label, i) => (
            <li key={label} className={i + 1 === e.level ? 'is-now' : i + 1 < e.level ? 'is-below' : ''}>
              <span className="steps-bar" />
              <span className="steps-label">{label}</span>
            </li>
          ))}
        </ol>
        <Note>{e.note}</Note>
      </Card>

      <Card title="On foot" span={3}>
        <dl className="strip">
          <div>
            <dt>Walking</dt>
            <dd className="num">
              {e.walkKm}
              <span className="unit"> km</span>
            </dd>
          </div>
          <div>
            <dt>Stairs</dt>
            <dd className="num">
              {e.steps}
              <span className="unit"> steps</span>
            </dd>
          </div>
          <div>
            <dt>Climb</dt>
            <dd className="num">
              {e.climbM}
              <span className="unit"> m</span>
            </dd>
          </div>
          <div>
            <dt>Standing</dt>
            <dd className="num">{duration(e.onFeetMin)}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Shade" span={2}>
        <Figure value={e.shade} unit="%" note="of the walking" />
        <Meter value={e.shade} label="Share of walking in shade" />
      </Card>

      <Card title="Access" span={2}>
        <dl className="kv">
          <div>
            <dt>Wheelchair</dt>
            <dd>
              <span className={`pill is-${e.wheelchair}`}>{ACCESS_WORD[e.wheelchair]}</span>
            </dd>
          </div>
          <div>
            <dt>Stroller</dt>
            <dd>
              <span className={`pill is-${e.stroller}`}>{ACCESS_WORD[e.stroller]}</span>
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Heads-up for" span={2}>
        {e.triggers.length ? (
          <ul className="chips">
            {e.triggers.map((t) => (
              <li key={t}>{TRIGGER_WORD[t]}</li>
            ))}
          </ul>
        ) : (
          <p className="quiet">Nothing that commonly bothers people.</p>
        )}
        <dl className="kv is-tight">
          <div>
            <dt>Energy afterwards</dt>
            <dd>{RECOVERY_WORD[e.recovery]}</dd>
          </div>
        </dl>
      </Card>
    </FactorSection>
  );
}
