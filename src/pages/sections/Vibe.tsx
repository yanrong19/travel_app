import { useState } from 'react';
import { motion } from 'motion/react';
import { CROWD_START_HOUR, type Attraction } from '../../data/types';
import { clock } from '../../lib/format';
import { localWord, natureWord, type Flag } from '../../lib/factors';
import { EASE_OUT } from '../../lib/motion';
import { FactorRow, Notes, RATING_WORD, RatingMark, Scale, Tile, Tiles } from './parts';

const ONLY_WORD = { 'only-tokyo': 'Only in Tokyo', 'only-japan': 'Only in Japan', common: 'Found elsewhere' };
const SUITS = [
  { key: 'solo', label: 'Solo' },
  { key: 'couple', label: 'Couple' },
  { key: 'family', label: 'Family with kids' },
  { key: 'friends', label: 'Group of friends' },
] as const;

export function Vibe({ a, flags, weekend }: { a: Attraction; flags: Flag[]; weekend: boolean }) {
  const v = a.vibe;

  return (
    <FactorRow line="vibe" headline={`${localWord(v.local)} · ${natureWord(v.nature)}`} visual={<Sliders local={v.local} nature={v.nature} />} flags={flags}>
      <Tiles>
        <Crowds a={a} initialWeekend={weekend} />
        <Tile label="Energy" value={v.energy >= 65 ? 'Lively' : v.energy >= 35 ? 'Steady' : 'Calm'}>
          <Scale value={v.energy} left="Calm" right="Lively" label="Calm to lively" />
        </Tile>
        <Tile label="Photo or experience" value={v.photo >= 70 ? 'Built for photos' : v.photo >= 40 ? 'Some of each' : 'About being there'}>
          <Scale value={v.photo} left="Being there" right="The photo" label="Experience to photo" />
        </Tile>
        <Tile label="Who it suits" wide>
          <dl className="ftile-suits">
            {SUITS.map((s) => (
              <div key={s.key}>
                <dt>{s.label}</dt>
                <dd>
                  <RatingMark r={v.suits[s.key]} />
                  {RATING_WORD[v.suits[s.key]]}
                </dd>
              </div>
            ))}
          </dl>
        </Tile>
        <Tile label="Can you do it at home?" value={ONLY_WORD[v.onlyHere]} wide />
      </Tiles>
      <Notes items={[v.onlyHereNote]} />
    </FactorRow>
  );
}

/** Touristy ↔ local and city ↔ nature, one marker each. */
function Sliders({ local, nature }: { local: number; nature: number }) {
  const rows = [
    { left: 'Touristy', right: 'Local', value: local },
    { left: 'City', right: 'Nature', value: nature },
  ];
  return (
    <span className="fvis fsliders">
      {rows.map((r) => (
        <span key={r.left} className="fslider">
          <span className="fslider-end">{r.left}</span>
          <span className="ftrack">
            <span className="ftrack-mark" style={{ left: `${r.value}%` }} />
          </span>
          <span className="fslider-end">{r.right}</span>
        </span>
      ))}
    </span>
  );
}

function Crowds({ a, initialWeekend }: { a: Attraction; initialWeekend: boolean }) {
  const [weekend, setWeekend] = useState(initialWeekend);
  const data = a.vibe.crowds[weekend ? 'weekend' : 'weekday'];
  const open = data.map((v, i) => ({ v, h: CROWD_START_HOUR + i })).filter((d) => d.v != null) as { v: number; h: number }[];
  const quiet = open.reduce((m, d) => (d.v < m.v ? d : m), open[0]);
  const busy = open.reduce((m, d) => (d.v > m.v ? d : m), open[0]);

  return (
    <Tile
      label="Crowds by hour"
      wide
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
      <p className="ftile-quiet">
        Quietest around <strong className="num">{clock(quiet.h)}</strong>, busiest around <strong className="num">{clock(busy.h)}</strong>. Gaps are hours it is closed.
      </p>
    </Tile>
  );
}
