import type { DaySummary } from '../../lib/daySummary';
import { Icon } from '../Icon';
import { DaySummaryPanel } from './DaySummaryPanel';

interface Props {
  /** The day, 0-based. */
  day: number;
  /** The heading's id: it takes focus when the analysis opens. */
  headingId: string;
  /** The wet-weather toggle is on: this reads the day's wet-weather plan. */
  wet: boolean;
  summary: DaySummary;
  /** Beside the day panel (wide laptops: a close button), or over the day list (a back arrow). */
  mode: 'side' | 'overlay';
  onClose: () => void;
}

/**
 * The day read factor by factor (the day summary), behind the day header's Analysis button: a panel
 * beside the day panel on wide laptops, sliding over the day list on phones and narrower windows.
 */
export function DayAnalysis({ day, headingId, wet, summary, mode, onClose }: Props) {
  const back = mode === 'overlay';
  return (
    <div className="dan">
      <div className="dan-head">
        {back && (
          <button type="button" className="icon-button dan-back" onClick={onClose} aria-label="Back to the day">
            <Icon name="arrowLeft" size={18} />
          </button>
        )}
        <div className="dan-title">
          <h2 id={headingId} tabIndex={-1}>
            Day {day + 1} analysis
          </h2>
          {wet && (
            <p className="dan-wet">
              <Icon name="drop" size={13} />
              Wet-weather plan
            </p>
          )}
        </div>
        {!back && (
          <button type="button" className="icon-button dan-close" onClick={onClose} aria-label="Close the analysis">
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      <div className="dan-body">
        <DaySummaryPanel
          summary={summary}
          label={wet ? 'Wet-weather plan summary' : 'Day summary'}
          empty={wet ? 'Add rain-proof places to the wet-weather plan to see how it reads' : 'Add stops from Browse, the map or search to see how the day reads'}
        />
      </div>
    </div>
  );
}
