import type { Attraction } from '../../data/types';
import { DAYS, duration, durationRange } from '../../lib/format';
import { realTime } from '../../lib/factors';
import { Card, FactorSection, Note } from './parts';

const BOOKING_WORD = { required: 'Book ahead', recommended: 'Booking helps', none: 'Walk in' };

export function Logistics({ a, todayIndex }: { a: Attraction; todayIndex: number }) {
  const l = a.logistics;
  const [lo, hi] = realTime(a);
  const summary =
    l.booking === 'required'
      ? 'Needs planning: tickets come first, then the day.'
      : l.lastTrainNote
        ? 'Easy to start, but watch the way back.'
        : 'Easy to slot in. Turn up when it suits you.';

  const travel = l.travelMin * 2;
  const queue = (l.queueMin[0] + l.queueMin[1]) / 2;
  const visit = (l.visitMin[0] + l.visitMin[1]) / 2;
  const total = travel + queue + visit;
  const seg = [
    { key: 'travel', label: 'There and back', min: travel },
    { key: 'queue', label: 'Queueing', min: queue },
    { key: 'visit', label: 'The visit', min: visit },
  ].filter((s) => s.min > 0);

  return (
    <FactorSection line="logistics" summary={summary}>
      <Card title="Real time needed" span={6} aside={<span className="card-aside">From Tokyo Station, door to door</span>}>
        <div className="realtime">
          <p className="realtime-total num">{durationRange([lo, hi])}</p>
          <p className="realtime-vs">
            Guides list the visit alone: <span className="num">{durationRange(l.visitMin)}</span>
          </p>
        </div>
        <div className="stack" role="img" aria-label={seg.map((s) => `${s.label} ${duration(s.min)}`).join(', ')}>
          {seg.map((s) => (
            <span key={s.key} className={`stack-seg is-${s.key}`} style={{ flexGrow: s.min / total }}>
              <span className="stack-label">{s.label}</span>
              <span className="stack-min num">{duration(s.min)}</span>
            </span>
          ))}
        </div>
        <p className="stack-key" aria-hidden="true">
          {seg.map((x) => (
            <span key={x.key}>
              <i className={`stack-seg is-${x.key}`} />
              {x.label}
            </span>
          ))}
        </p>
      </Card>

      <div className="stackcol span-3">
      <Card title="Opening hours" span={3}>
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
        {(l.lastEntryMin || l.hoursNote) && (
          <Note>
            {l.lastEntryMin ? `Last entry ${duration(l.lastEntryMin)} before closing. ` : ''}
            {l.hoursNote}
          </Note>
        )}
      </Card>

      <Card title="Good to know" span={3}>
        <dl className="kv">
          <div>
            <dt>Coin lockers</dt>
            <dd>{l.lockers ? "Yes" : "None nearby"}</dd>
          </div>
        </dl>
        {l.holidayNote && <Note>{l.holidayNote}</Note>}
        {l.etiquette && <Note>{l.etiquette}</Note>}
        {!l.holidayNote && !l.etiquette && <Note>No holiday quirks or house rules to plan around.</Note>}
      </Card>
      </div>

      <div className="stackcol span-3">
      <Card title="Tickets" span={3}>
        <p className="big-word">{BOOKING_WORD[l.booking]}</p>
        <dl className="kv">
          {l.leadDays != null && (
            <div>
              <dt>How far ahead</dt>
              <dd className="num">{l.leadDays >= 7 ? `${Math.round(l.leadDays / 7)} weeks` : `${l.leadDays} days`}</dd>
            </div>
          )}
          <div>
            <dt>Entry time</dt>
            <dd>{l.timing === 'fixed' ? 'Fixed time slot' : 'Come any time'}</dd>
          </div>
        </dl>
        {l.bookingNote && <Note>{l.bookingNote}</Note>}
      </Card>

      <Card title="Getting there" span={3}>
        <dl className="kv">
          <div>
            <dt>Nearest station</dt>
            <dd>{l.station}</dd>
          </div>
          <div>
            <dt>Walk from the station</dt>
            <dd className="num">{l.walkMin === 0 ? 'At the station' : duration(l.walkMin)}</dd>
          </div>
          <div>
            <dt>From Tokyo Station</dt>
            <dd className="num">{duration(l.travelMin)}</dd>
          </div>
        </dl>
        {l.lastTrainNote && <p className="callout">{l.lastTrainNote}</p>}
      </Card>

      </div>
    </FactorSection>
  );
}
