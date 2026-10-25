import { MONTHS } from '../../lib/format';

interface Props {
  /** Twelve flags, January first: true when the month suits the place. */
  months: boolean[];
  /** Mock values: the strip says so, so nobody reads them as checked data. */
  rough?: boolean;
}

/**
 * The twelve-month "best time" strip on a guide card. The good months are filled; the row reads
 * as one image to a screen reader, so it hears the good months instead of twelve labels.
 */
export function MonthStrip({ months, rough }: Props) {
  const best = MONTHS.filter((_, i) => months[i]);
  return (
    <div className="mstrip">
      <ol className="mstrip-row" role="img" aria-label={best.length ? `Best months: ${best.join(', ')}` : 'No month stands out'}>
        {MONTHS.map((m, i) => (
          <li key={m} className={months[i] ? 'is-good' : ''}>
            {m}
          </li>
        ))}
      </ol>
      {rough && <p className="mstrip-note">Rough guide</p>}
    </div>
  );
}
