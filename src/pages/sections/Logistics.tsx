import type { Attraction } from '../../data/types';
import { DAYS, duration, durationRange } from '../../lib/format';
import type { Flag } from '../../lib/factors';
import { FactorRow, Notes, Tile, Tiles, hm } from './parts';

const BOOKING_WORD = { required: 'Book ahead', recommended: 'Booking helps', none: 'Walk in' };

/** Time at the attraction, queue included: a quick visit, the typical one and a full exploration. */
export function visitSpan(a: Attraction) {
  const { visitMin, queueMin } = a.logistics;
  const quick = visitMin[0] + queueMin[0];
  const full = visitMin[1] + queueMin[1];
  return { quick, typical: Math.round((quick + full) / 2 / 5) * 5, full };
}

export function Logistics({ a, flags, todayIndex }: { a: Attraction; flags: Flag[]; todayIndex: number }) {
  const l = a.logistics;
  const { quick, full } = visitSpan(a);
  const headline = quick === full ? hm(quick) : `${hm(quick)} – ${hm(full)}`;
  const side = 3 + (l.leadDays != null ? 1 : 0) + (l.lastEntryMin ? 1 : 0);

  return (
    <FactorRow line="logistics" headline={headline} visual={<TimeBar a={a} />} flags={flags}>
      <Tiles>
        <Tile label="Opening hours" rows={side}>
          <table className="hours">
            <tbody>
              {l.hours.map((h, i) => (
                <tr key={DAYS[i]} className={i === todayIndex ? 'is-today' : ''}>
                  <th scope="row">
                    {DAYS[i]}
                    {i === todayIndex && <span className="sr-only"> (today)</span>}
                  </th>
                  <td className="num">{h ? `${h[0]}–${h[1]}` : <span className="pill is-no">Closed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tile>
        <Tile label="Tickets" value={BOOKING_WORD[l.booking]} />
        {l.leadDays != null && <Tile label="How far ahead" value={<span className="num">{l.leadDays >= 7 ? `${Math.round(l.leadDays / 7)} weeks` : `${l.leadDays} days`}</span>} />}
        <Tile label="Entry time" value={l.timing === 'fixed' ? 'Fixed time slot' : 'Come any time'} />
        {l.lastEntryMin ? <Tile label="Last entry" value={<span className="num">{duration(l.lastEntryMin)}</span>} unit=" before closing" /> : null}
        <Tile label="Coin lockers" value={l.lockers ? 'Yes' : 'None nearby'} />
        <Tile label="The visit" value={<span className="num">{durationRange(l.visitMin)}</span>} />
        <Tile label="Queueing" value={<span className="num">{l.queueMin[1] === 0 ? 'None' : durationRange(l.queueMin)}</span>} />
      </Tiles>
      <Notes items={[l.hoursNote, l.bookingNote, l.holidayNote, l.etiquette]} />
    </FactorRow>
  );
}

/** One bar from a quick visit to a full exploration, the typical visit in the middle. */
function TimeBar({ a }: { a: Attraction }) {
  const { quick, typical, full } = visitSpan(a);
  const points =
    quick === full
      ? [{ key: 'typical', name: 'Typical', min: full, at: 50 }]
      : [
          { key: 'quick', name: 'Quick visit', min: quick, at: 0 },
          { key: 'typical', name: 'Typical', min: typical, at: 50 },
          { key: 'full', name: 'Full exploration', min: full, at: 100 },
        ];
  return (
    <span className="fvis">
      <span className="ftrack">
        <span className="ftrack-band is-ramp" style={{ left: 0, width: '100%' }} />
        {points.map((p) => (
          <span key={p.key} className={`ftrack-mark ${p.key === 'typical' ? '' : 'is-small'}`} style={{ left: `${p.at}%` }} />
        ))}
      </span>
      <span className={`ftrack-ends ${points.length === 1 ? 'is-one' : ''}`}>
        {points.map((p) => (
          <span key={p.key}>
            <span className="ftrack-pname">{p.name}</span>
            <span className="ftrack-pvalue num">{hm(p.min)}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
