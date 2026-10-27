import type { CSSProperties, ReactNode } from 'react';
import { ATTRACTIONS } from '../../data/attractions';
import { lineById, type LineId } from '../../data/lines';
import { EFFORT_LABELS } from '../../lib/factors';
import { duration, yen } from '../../lib/format';
import type { CashLevel, DaySummary, Flag as DayFlag } from '../../lib/daySummary';
import { Icon } from '../Icon';
import { Station } from '../Station';

const nameOf = new Map(ATTRACTIONS.map((a) => [a.id, a.name]));

/** "5 h 20", "45 min", "10 h": the minutes go unnamed once there are hours, to keep a row on one line. */
const hm = (min: number) => (min >= 60 ? duration(min).replace(/ min$/, '') : duration(min));

/** As the attraction page's Cost section words it, in lower case mid-line. */
const CASH_PHRASE: Record<CashLevel, string> = { 'cash-only': 'cash only', 'mostly-cash': 'carry some cash', cards: 'card OK' };

const LOCAL_PHRASE: Record<string, string> = { Local: 'mostly local', Touristy: 'mostly touristy', Mixed: 'touristy and local mixed' };

const hues = (line: LineId) =>
  ({
    '--hue': `var(--c-${line})`,
    '--soft': `var(--c-${line}-soft)`,
    '--track': `var(--c-${line}-track)`,
    '--ink': `var(--c-${line}-ink)`,
  }) as CSSProperties;

function Row({ line, text, flags, children }: { line: LineId; text: ReactNode; flags: DayFlag[]; children?: ReactNode }) {
  return (
    <li className="ds-row" style={hues(line)} data-line={line}>
      <Station line={line} size={26} />
      <div className="ds-body">
        <h4 className="ds-name">{lineById(line).name}</h4>
        <p className="ds-text">{text}</p>
        {children}
        {flags.length > 0 && (
          <ul className="ds-flags">
            {flags.map((f, i) => (
              <li key={i}>
                <Icon name="alert" size={14} />
                <span className="sr-only">Warning: </span>
                {f.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * The day read factor by factor, each in its line's colour. Never one score. `label` names the
 * section; `empty` is what an empty day says.
 */
export function DaySummaryPanel({ summary, label = 'Day summary', empty = 'Add stops from the map or search' }: { summary: DaySummary; label?: string; empty?: string }) {
  if (summary.empty) {
    return (
      <section className="ds is-empty" aria-label={label}>
        <Icon name="plus" size={18} />
        <p>{empty}</p>
      </section>
    );
  }

  const { effort, conditions, vibe, logistics, cost } = summary;
  const flagsFor = (f: LineId) => summary.flags.filter((x) => x.factor === f);
  const top = Math.max(...effort.perStop.map((s) => s.level));
  const over = logistics.usedMin > logistics.budgetMin;
  const scale = Math.max(logistics.usedMin, logistics.budgetMin);
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;

  return (
    <section className="ds" aria-label={label}>
      <h3 className="ds-line">{summary.line}</h3>
      <ul className="ds-rows">
        <Row
          line="effort"
          flags={flagsFor('effort')}
          text={
            <>
              Hardest stop: <strong>{effort.hardest ? EFFORT_LABELS[effort.hardest.level - 1] : '–'}</strong>
              {effort.hardest && ` (${effort.hardest.name})`} · <span className="num">{hm(effort.onFeetMin)}</span> on your feet
            </>
          }
        >
          <ol className="sr-only">
            {effort.perStop.map((s, i) => (
              <li key={s.id}>
                Stop {i + 1}, {nameOf.get(s.id) ?? 'unknown'}: {EFFORT_LABELS[s.level - 1]}
              </li>
            ))}
          </ol>
          <div className="ds-bars" aria-hidden="true">
            {effort.perStop.map((s, i) => (
              <span
                key={s.id}
                className={s.id === effort.hardest?.id ? 'is-hardest' : ''}
                style={{ height: `${(s.level / Math.max(5, top)) * 100}%` }}
                title={`${i + 1}. ${nameOf.get(s.id) ?? ''}: ${EFFORT_LABELS[s.level - 1]}`}
              />
            ))}
          </div>
        </Row>

        <Row line="conditions" flags={flagsFor('conditions')} text={conditions.text} />

        <Row
          line="vibe"
          flags={flagsFor('vibe')}
          text={
            <>
              <span className="num">{vibe.naturePct}%</span> nature · <span className="num">{vibe.cityPct}%</span> city ·{' '}
              {LOCAL_PHRASE[vibe.localWord] ?? vibe.localWord.toLowerCase()}
            </>
          }
        >
          <div className="ds-split" aria-hidden="true">
            {vibe.naturePct > 0 && <span className="is-nature" style={{ flexGrow: vibe.naturePct }} />}
            {vibe.cityPct > 0 && <span className="is-city" style={{ flexGrow: vibe.cityPct }} />}
          </div>
        </Row>

        <Row
          line="logistics"
          flags={flagsFor('logistics')}
          text={
            <>
              <span className="num">{hm(logistics.usedMin)}</span> of your <span className="num">{hm(logistics.budgetMin)}</span> day, incl.{' '}
              <span className="num">{hm(logistics.travelMin)}</span> travel
            </>
          }
        >
          <div className={`ds-budget ${over ? 'is-over' : ''}`} aria-hidden="true">
            <span className="ds-budget-used" style={{ width: pct(logistics.usedMin) }}>
              <span className="ds-budget-travel" style={{ width: `${(logistics.travelMin / Math.max(1, logistics.usedMin)) * 100}%` }} />
            </span>
            {over && <span className="ds-budget-end" style={{ left: pct(logistics.budgetMin) }} />}
          </div>
        </Row>

        <Row
          line="cost"
          flags={flagsFor('cost')}
          text={
            <>
              <strong className="num">{cost.min === cost.max ? yen(cost.min) : `${yen(cost.min)} – ${yen(cost.max)}`}</strong>
              {' · '}
              {CASH_PHRASE[cost.cash]}
            </>
          }
        />
      </ul>
    </section>
  );
}
