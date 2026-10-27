import type { Access, Attraction, Trigger } from '../../data/types';
import { EFFORT_LABELS, type Flag } from '../../lib/factors';
import { duration } from '../../lib/format';
import { FactorRow, Meter, Notes, Tile, Tiles } from './parts';

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

export function Effort({ a, flags }: { a: Attraction; flags: Flag[] }) {
  const e = a.effort;

  return (
    <FactorRow line="effort" headline={EFFORT_LABELS[e.level - 1]} visual={<Levels level={e.level} />} flags={flags}>
      <Tiles>
        <Tile label="Walking" value={<span className="num">{e.walkKm}</span>} unit=" km" />
        <Tile label="Stairs" value={<span className="num">{e.steps}</span>} unit=" steps" />
        <Tile label="Climb" value={<span className="num">{e.climbM}</span>} unit=" m" />
        <Tile label="On your feet" value={<span className="num">{duration(e.onFeetMin)}</span>} />
        <Tile label="Walking in shade" value={<span className="num">{e.shade}</span>} unit="%">
          <Meter value={e.shade} label="Share of walking in shade" />
        </Tile>
        <Tile label="Energy afterwards" value={RECOVERY_WORD[e.recovery]} />
        <Tile label="Wheelchair">
          <span className={`pill is-${e.wheelchair}`}>{ACCESS_WORD[e.wheelchair]}</span>
        </Tile>
        <Tile label="Stroller">
          <span className={`pill is-${e.stroller}`}>{ACCESS_WORD[e.stroller]}</span>
        </Tile>
        <Tile label="Heads-up for" wide>
          {e.triggers.length ? (
            <ul className="chips">
              {e.triggers.map((t) => (
                <li key={t}>{TRIGGER_WORD[t]}</li>
              ))}
            </ul>
          ) : (
            <p className="ftile-quiet">Nothing that commonly bothers people.</p>
          )}
        </Tile>
      </Tiles>
      <Notes items={[e.note]} />
    </FactorRow>
  );
}

/** The whole five-step scale, this level filled. */
function Levels({ level }: { level: number }) {
  return (
    <span className="fvis">
      <span className="ftrack is-steps">
        {EFFORT_LABELS.map((label, i) => (
          <span key={label} className={`ftrack-step ${i + 1 === level ? 'is-now' : i + 1 < level ? 'is-below' : ''}`} />
        ))}
      </span>
      <span className="ftrack-steplabels">
        {EFFORT_LABELS.map((label, i) => (
          <span key={label} className={i + 1 === level ? 'is-now' : ''}>
            {label}
          </span>
        ))}
      </span>
    </span>
  );
}
