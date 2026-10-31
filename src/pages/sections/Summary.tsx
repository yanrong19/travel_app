import { lineById, type LineId } from '../../data/lines';
import { Icon } from '../../components/Icon';
import { lineVars } from './parts';

export interface SummaryItem {
  line: LineId;
  /** One word or two: the row's reading, or the personal warning. */
  verdict: string;
  /** Its row has something to check, or a warning about the user's own plan. */
  warn: boolean;
}

/** The five factors at a glance, above their rows; a tile opens its row and goes to it. */
export function Summary({ items, onGo }: { items: SummaryItem[]; onGo: (line: LineId) => void }) {
  return (
    <ul className="fsum" aria-label="At a glance">
      {items.map((it) => {
        const name = lineById(it.line).name;
        return (
          <li key={it.line} style={lineVars(it.line)}>
            <button
              type="button"
              className={`fsum-tile ${it.warn ? 'is-warn' : ''}`}
              onClick={() => onGo(it.line)}
              aria-label={`${name}: ${it.verdict}${it.warn ? ', worth checking' : ''}`}
            >
              <span className="fsum-label">{name}</span>
              <span className="fsum-verdict num">
                {it.warn && <Icon name="alert" size={14} />}
                {it.verdict}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
