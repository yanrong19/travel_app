import { photo as photoSrc, photoSet } from '../../lib/photos';
import type { Summary } from '../../lib/summary';
import { MonthStrip } from './MonthStrip';

interface Props {
  /** Photo key, or null while the place has none. */
  photo: string | null;
  title: string;
  ja?: string;
  /** "Live · Tokyo", "Coming soon", "12 places checked"… */
  status: string;
  line: string;
  /** Null, or a count of 0 on live data, means there is nothing to summarise. */
  summary: Summary | null;
  /** The summary is mock, not derived from checked attractions. */
  rough?: boolean;
  /** Small print under the card: the prefectures, the top attractions… */
  foot?: string;
  onHover(on: boolean): void;
  onPick(): void;
}

/** One guide under the map: photo, name, one-liner, best months and the three tags. */
export function GuideCard({ photo: pic, title, ja, status, line, summary, rough, foot, onHover, onPick }: Props) {
  // Mock summaries count nothing, so only live ones go empty when they have no attractions left.
  const facts = summary && (rough || summary.count > 0) ? summary : null;
  return (
    <article className="gcard" onPointerEnter={() => onHover(true)} onPointerLeave={() => onHover(false)}>
      <div className={`gcard-media ${pic ? '' : 'is-blank'}`}>
        {pic ? (
          <img
            src={photoSrc(pic, 720)}
            srcSet={photoSet(pic)}
            sizes="(max-width: 760px) 90vw, 400px"
            alt=""
            loading="lazy"
            draggable={false}
          />
        ) : (
          <span className="gcard-blank" lang="ja" aria-hidden="true">
            {ja}
          </span>
        )}
      </div>
      <div className="gcard-body">
        <h3 className="gcard-name">
          <button type="button" onClick={onPick} onFocus={() => onHover(true)} onBlur={() => onHover(false)}>
            {title}
          </button>
          {ja && (
            <span className="gcard-ja" lang="ja">
              {ja}
            </span>
          )}
        </h3>
        <p className="gcard-status" data-live={rough ? undefined : '1'}>
          {!rough && <span className="live-dot" aria-hidden="true" />}
          {status}
        </p>
        <p className="gcard-line">{line}</p>
        {facts ? (
          <>
            <MonthStrip months={facts.months} rough={rough} />
            <ul className="gcard-tags">
              <li>
                <span className="sr-only">Effort: </span>
                {facts.effort}
              </li>
              <li>
                <span className="sr-only">Crowds: </span>
                {facts.crowds}
              </li>
              <li>
                <span className="sr-only">Cost: </span>
                {facts.cost}
              </li>
            </ul>
          </>
        ) : (
          <p className="gcard-empty">Nothing matches this filter</p>
        )}
        {foot && <p className="gcard-foot">{foot}</p>}
      </div>
    </article>
  );
}
