import type { Attraction } from '../../data/types';
import { mustPay, withExtras } from '../../lib/factors';
import { yen, yenPlain } from '../../lib/format';
import { Card, FactorSection, Note } from './parts';

const CASH_WORD = { 'cash-only': 'Cash only', 'mostly-cash': 'Carry some cash', cards: 'Cards are fine' };

export function Cost({ a }: { a: Attraction }) {
  const c = a.cost;
  const must = mustPay(a);
  const all = withExtras(a);
  const required = c.extras.filter((e) => !e.optional);
  const optional = c.extras.filter((e) => e.optional);
  const summary =
    c.entry === 0
      ? `Free to enter. Getting there and the basics come to ${yen(must)}.`
      : `${yenPlain(c.entry)} to enter, ${yenPlain(must)} once you add what you can’t skip.`;

  return (
    <FactorSection line="cost" summary={summary}>
      <Card title="What you'll spend" span={4} aside={<span className="card-aside">Per adult</span>}>
        <table className="spend">
          <tbody>
            <tr>
              <th scope="row">Entry</th>
              <td className="num">{yen(c.entry)}</td>
            </tr>
            {required.map((e) => (
              <tr key={e.label}>
                <th scope="row">{e.label}</th>
                <td className="num">{yenPlain(e.yen)}</td>
              </tr>
            ))}
            <tr className="spend-total">
              <th scope="row">Must-pay</th>
              <td className="num">{yenPlain(must)}</td>
            </tr>
            {optional.map((e) => (
              <tr key={e.label} className="is-optional">
                <th scope="row">
                  {e.label} <span className="optional">optional</span>
                </th>
                <td className="num">{yenPlain(e.yen)}</td>
              </tr>
            ))}
            {optional.length > 0 && (
              <tr className="spend-total is-soft">
                <th scope="row">With everything</th>
                <td className="num">{yenPlain(all)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Paying" span={2}>
        <p className="big-word">{CASH_WORD[c.cash]}</p>
        <dl className="kv">
          <div>
            <dt>On top of entry</dt>
            <dd className="num">{yenPlain(must - c.entry)}</dd>
          </div>
          <div>
            <dt>Optional extras</dt>
            <dd className="num">{optional.length ? yenPlain(all - must) : '—'}</dd>
          </div>
        </dl>
        {c.cashNote && <Note>{c.cashNote}</Note>}
        {c.freeNote && <Note>{c.freeNote}</Note>}
      </Card>
    </FactorSection>
  );
}
