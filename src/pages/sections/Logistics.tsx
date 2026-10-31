import type { Attraction } from '../../data/types';
import { DAYS, DAYS_LONG, duration, durationRange } from '../../lib/format';
import type { Flag } from '../../lib/factors';
import { FactorRow, Tile, Tiles, hm } from './parts';

const BOOKING_WORD = { required: 'Book ahead', recommended: 'Booking helps', none: 'Walk in' };
const BOOKING_LINE = { required: 'Book ahead.', recommended: 'Booking helps.', none: 'No need to book.' };

/** "Open 06:00–23:00 today. No need to book.": that day's hours and tickets in one line. */
function openLine(a: Attraction, weekday: number, today: boolean) {
  const l = a.logistics;
  const h = l.hours[weekday];
  const when = today ? 'today' : `on ${DAYS_LONG[weekday]}`;
  const open = !h ? `Closed ${when}.` : h[0] === '00:00' && h[1] === '24:00' ? `Open all day ${when}.` : `Open ${h[0]}–${h[1]} ${when}.`;
  return `${open} ${BOOKING_LINE[l.booking]}`;
}

/** Time at the attraction, queue included: a quick visit, the typical one and a full exploration. */
export function visitSpan(a: Attraction) {
  const { visitMin, queueMin } = a.logistics;
  const quick = visitMin[0] + queueMin[0];
  const full = visitMin[1] + queueMin[1];
  return { quick, typical: Math.round((quick + full) / 2 / 5) * 5, full };
}

interface Props {
  a: Attraction;
  flags: Flag[];
  /** The day the page is about (0 = Monday): the planned day's in planning, today's otherwise. */
  weekday: number;
  /** That weekday stands for today (outside planning, or a trip without dates). */
  today: boolean;
  /** Said instead of the hours when the planned stop falls outside them or in the busy part of the day. */
  warning: string | null;
}

export function Logistics({ a, flags, weekday, today, warning }: Props) {
  const l = a.logistics;
  const { quick, full } = visitSpan(a);
  const headline = quick === full ? hm(quick) : `${hm(quick)} – ${hm(full)}`;
  const side = 3 + (l.leadDays != null ? 1 : 0) + (l.lastEntryMin ? 1 : 0);

  return (
    <FactorRow line="logistics" headline={headline} sub={warning ?? openLine(a, weekday, today)} subWarn={!!warning} visual={<TimeBar a={a} />} flags={flags}>
      <Tiles>
        <Tile label="Opening hours" rows={side} notes={[l.hoursNote, l.holidayNote]}>
          <table className="hours">
            <tbody>
              {l.hours.map((h, i) => (
                <tr key={DAYS[i]} className={i === weekday ? 'is-today' : ''}>
                  <th scope="row">
                    {DAYS[i]}
                    {i === weekday && <span className="sr-only">{today ? ' (today)' : ' (your day)'}</span>}
                  </th>
                  <td className="num">{h ? `${h[0]}–${h[1]}` : <span className="pill is-no">Closed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tile>
        <Tile label="Tickets" value={BOOKING_WORD[l.booking]} notes={[l.bookingNote]} />
        {l.leadDays != null && <Tile label="How far ahead" value={<span className="num">{l.leadDays >= 7 ? `${Math.round(l.leadDays / 7)} weeks` : `${l.leadDays} days`}</span>} />}
        <Tile label="Entry time" value={l.timing === 'fixed' ? 'Fixed time slot' : 'Come any time'} />
        {l.lastEntryMin ? <Tile label="Last entry" value={<span className="num">{duration(l.lastEntryMin)}</span>} unit=" before closing" /> : null}
        <Tile label="Coin lockers" value={l.lockers ? 'Yes' : 'None nearby'} />
        <Tile label="The visit" value={<span className="num">{durationRange(l.visitMin)}</span>} />
        <Tile label="Queueing" value={<span className="num">{l.queueMin[1] === 0 ? 'None' : durationRange(l.queueMin)}</span>} />
      </Tiles>
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
