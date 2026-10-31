import type { Attraction } from '../../data/types';
import { mustPay, withExtras, type Flag } from '../../lib/factors';
import { yen, yenPlain } from '../../lib/format';
import { FactorRow, Tile, Tiles } from './parts';

const CASH_WORD = { 'cash-only': 'Cash only', 'mostly-cash': 'Carry some cash', cards: 'Cards are fine' };

/** "¥800 – ¥2,300", one price when there's nothing optional, or "Free". */
export function costRange(a: Attraction) {
  const lo = mustPay(a);
  const hi = withExtras(a);
  if (hi === 0) return 'Free';
  return lo === hi ? yen(lo) : `${yen(lo)} – ${yenPlain(hi)}`;
}

const CASH_LINE = { 'cash-only': 'Cash only.', 'mostly-cash': 'Carry some cash.', cards: 'Cards are fine.' };

/** "Free to enter; extras are optional. Carry some cash.": what you pay there, in one line. */
function spendLine(a: Attraction) {
  const c = a.cost;
  const entry = c.entry === 0 ? 'Free to enter' : `Entry ${yen(c.entry)}`;
  const need = mustPay(a) - c.entry;
  const money = need > 0 ? `${entry}, plus ${yenPlain(need)} you can’t skip.` : c.extras.length ? `${entry}; extras are optional.` : `${entry}.`;
  return `${money} ${CASH_LINE[c.cash]}`;
}

export function Cost({ a, flags }: { a: Attraction; flags: Flag[] }) {
  const c = a.cost;
  const must = mustPay(a);
  const all = withExtras(a);
  const required = c.extras.filter((e) => !e.optional);
  const optional = c.extras.filter((e) => e.optional);

  return (
    <FactorRow line="cost" headline={costRange(a)} sub={spendLine(a)} visual={<CostBar must={must} all={all} />} flags={flags}>
      <Tiles>
        <Tile label="Entry" value={<span className="num">{yen(c.entry)}</span>} notes={[c.freeNote]} />
        <Tile label="Paying" value={CASH_WORD[c.cash]} notes={[c.cashNote]} />
        <Tile label="What you'll spend" wide aside={<span className="ftile-aside">Per adult</span>}>
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
        </Tile>
      </Tiles>
    </FactorRow>
  );
}

/** From the cheapest visit to the most, on a scale from ¥0. */
function CostBar({ must, all }: { must: number; all: number }) {
  const at = (n: number) => (all === 0 ? 0 : (n / all) * 100);
  return (
    <span className="fvis">
      <span className="ftrack">
        {all > 0 && <span className="ftrack-band is-soft" style={{ left: `${at(must)}%`, width: `${at(all) - at(must)}%` }} />}
        {all > 0 && <span className="ftrack-band" style={{ left: 0, width: `${Math.max(at(must), 1.5)}%` }} />}
        <span className="ftrack-mark is-small" style={{ left: `${at(must)}%` }} />
        {all > must && <span className="ftrack-mark" style={{ left: '100%' }} />}
      </span>
      <span className="ftrack-ends">
        <span>
          <span className="ftrack-pname">{all === 0 ? 'Free to enter' : 'Must pay'}</span>
          <span className="ftrack-pvalue num">{yen(must)}</span>
        </span>
        {all > must && (
          <span>
            <span className="ftrack-pname">With extras</span>
            <span className="ftrack-pvalue num">{yenPlain(all)}</span>
          </span>
        )}
      </span>
    </span>
  );
}
