import { useState } from 'react';
import { motion } from 'motion/react';
import { CROWD_START_HOUR, type Attraction } from '../../data/types';
import { clock } from '../../lib/format';
import { localWord } from '../../lib/factors';
import { EASE_OUT } from '../../lib/motion';
import { Card, FactorSection, Note, RATING_WORD, RatingMark, Scale } from './parts';

const ONLY_WORD = { 'only-tokyo': 'Only in Tokyo', 'only-japan': 'Only in Japan', common: 'Found elsewhere' };
const SUITS = [
  { key: 'solo', label: 'Solo' },
  { key: 'couple', label: 'Couple' },
  { key: 'family', label: 'Family with kids' },
  { key: 'friends', label: 'Group of friends' },
] as const;

export function Vibe({ a, weekend }: { a: Attraction; weekend: boolean }) {
  const v = a.vibe;
  const word = localWord(v.local);
  const summary =
    word === 'Local'
      ? 'Mostly locals, and it feels like everyday Tokyo.'
      : word === 'Mixed'
        ? 'A mix of locals and visitors.'
        : 'Firmly on the tourist trail. Expect company.';

  return (
    <FactorSection line="vibe" summary={summary}>
      <Crowds a={a} initialWeekend={weekend} />

      <Card title="Who it suits" span={2}>
        <dl className="kv is-roomy">
          {SUITS.map((s) => (
            <div key={s.key}>
              <dt>{s.label}</dt>
              <dd className="kv-rating">
                <RatingMark r={v.suits[s.key]} />
                {RATING_WORD[v.suits[s.key]]}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Who you'll be with" span={3}>
        <p className="big-word">{word}</p>
        <Scale value={v.local} left="Mostly tourists" right="Mostly locals" label="Touristy to local" />
      </Card>

      <Card title="Energy" span={3}>
        <p className="big-word">{v.energy >= 65 ? 'Lively' : v.energy >= 35 ? 'Steady' : 'Calm'}</p>
        <Scale value={v.energy} left="Calm" right="Lively" label="Calm to lively" />
      </Card>

      <Card title="Can you do it at home?" span={3}>
        <p className="big-word">{ONLY_WORD[v.onlyHere]}</p>
        <Note>{v.onlyHereNote}</Note>
      </Card>

      <Card title="Photo or experience" span={3}>
        <p className="big-word">{v.photo >= 70 ? 'Built for photos' : v.photo >= 40 ? 'Some of each' : 'About being there'}</p>
        <Scale value={v.photo} left="The experience" right="The photo" label="Experience to photo" />
      </Card>
    </FactorSection>
  );
}

function Crowds({ a, initialWeekend }: { a: Attraction; initialWeekend: boolean }) {
  const [weekend, setWeekend] = useState(initialWeekend);
  const data = a.vibe.crowds[weekend ? 'weekend' : 'weekday'];
  const open = data.map((v, i) => ({ v, h: CROWD_START_HOUR + i })).filter((d) => d.v != null) as { v: number; h: number }[];
  const quiet = open.reduce((m, d) => (d.v < m.v ? d : m), open[0]);
  const busy = open.reduce((m, d) => (d.v > m.v ? d : m), open[0]);

  return (
    <Card
      title="Crowds by hour"
      span={4}
      aside={
        <div className="segmented" role="group" aria-label="Day type">
          <button type="button" aria-pressed={!weekend} onClick={() => setWeekend(false)}>
            Weekday
          </button>
          <button type="button" aria-pressed={weekend} onClick={() => setWeekend(true)}>
            Weekend
          </button>
        </div>
      }
    >
      <div className="crowds">
        <div className="crowds-y" aria-hidden="true">
          <span>Packed</span>
          <span>Busy</span>
          <span>Quiet</span>
        </div>
        <div className="crowds-plot" role="img" aria-label={`Quietest at ${clock(quiet.h)}, busiest at ${clock(busy.h)}`}>
          {data.map((v, i) => (
            <div key={i} className="crowds-col">
              {v != null && (
                <motion.span
                  className={`crowds-bar ${CROWD_START_HOUR + i === busy.h ? 'is-peak' : ''}`}
                  initial={false}
                  animate={{ height: `${Math.max(3, v)}%` }}
                  transition={{ duration: 0.45, ease: EASE_OUT }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="crowds-x" aria-hidden="true">
          {data.map((_, i) => (
            <span key={i}>{(CROWD_START_HOUR + i) % 3 === 0 ? clock(CROWD_START_HOUR + i).slice(0, 2) : ''}</span>
          ))}
        </div>
      </div>
      <Note>
        Quietest around <strong className="num">{clock(quiet.h)}</strong>, busiest around{' '}
        <strong className="num">{clock(busy.h)}</strong>. Gaps are hours it is closed.
      </Note>
    </Card>
  );
}
