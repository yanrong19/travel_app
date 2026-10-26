import type { Ref } from 'react';
import { REGIONS, prefName, type Region } from '../../data/regions';
import { TOKYO_PREF_ID } from '../../data/places';
import { useRevealLit } from '../../lib/listScroll';

const TOKYO = Number(TOKYO_PREF_ID);

/** Which region row, and which prefecture inside it, is lit — from the list or from the map. */
export interface Hot {
  region: string | null;
  pref: number | null;
}

/** What a region's row, chip or guide card says about it. */
export const regionStatus = (r: Region) => (r.live ? 'Live · Tokyo' : 'Coming soon');

interface ListProps {
  ref?: Ref<HTMLElement>;
  /** The one open row, if any: the accordion shows one region's prefectures at a time. */
  openId: string | null;
  hot: Hot;
  /** Faded out under the guide sheet: out of the tab order and the pointer's reach. */
  inert?: boolean;
  onHover(h: Hot): void;
  onToggle(id: string): void;
  onPickPref(code: number): void;
}

/** The right-hand panel at Japan level: the eight regions, north to south, linked to the map. */
export function RegionList({ ref, openId, hot, inert, onHover, onToggle, onPickPref }: ListProps) {
  // On a short laptop the last regions sit below the panel's fold: one lit from the map scrolls into view.
  const lit = hot.pref && hot.region === openId ? `[data-pref="${hot.pref}"]` : hot.region ? `[data-region="${hot.region}"]` : null;
  const reveal = useRevealLit<HTMLUListElement>(lit);
  return (
    <aside
      ref={ref}
      className="panel"
      aria-labelledby="panel-title"
      inert={inert}
      onPointerEnter={reveal.onPointerEnter}
      onPointerLeave={() => {
        reveal.onPointerLeave();
        onHover({ region: null, pref: null });
      }}
    >
      <div className="panel-head">
        <h2 id="panel-title">Regions of Japan</h2>
        <p className="panel-scope">{REGIONS.length} regions</p>
      </div>
      <ul ref={reveal.list} className="rlist" data-lenis-prevent>
        {REGIONS.map((r) => {
          const open = openId === r.id;
          return (
            <li key={r.id}>
              <button
                type="button"
                data-region={r.id}
                className={`rrow ${hot.region === r.id ? 'is-hot' : ''} ${r.live ? 'is-live' : ''}`}
                aria-expanded={open}
                onPointerEnter={() => onHover({ region: r.id, pref: null })}
                onFocus={() => onHover({ region: r.id, pref: null })}
                onBlur={() => onHover({ region: null, pref: null })}
                onClick={() => onToggle(r.id)}
              >
                <span className="rrow-text">
                  <strong>
                    {r.name} <span className="rrow-ja">{r.ja}</span>
                  </strong>
                  <span className="rrow-status">
                    {r.live && <span className="live-dot" aria-hidden="true" />}
                    {regionStatus(r)}
                  </span>
                </span>
                <span className="rrow-mark" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              {open && (
                <ul className="rprefs">
                  {r.prefectures.map((code) => (
                    <li key={code}>
                      <button
                        type="button"
                        data-pref={code}
                        className={`rpref ${hot.pref === code ? 'is-hot' : ''}`}
                        onPointerEnter={() => onHover({ region: r.id, pref: code })}
                        onFocus={() => onHover({ region: r.id, pref: code })}
                        onBlur={() => onHover({ region: null, pref: null })}
                        onClick={() => onPickPref(code)}
                      >
                        <span>{prefName(code)}</span>
                        {code === TOKYO && <span className="rpref-live">Live</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

interface ChipProps {
  focusId: string | null;
  onPick(id: string): void;
}

/** Phone: the same eight regions as a row of chips, in the guide sheet's peek. */
export function RegionChips({ focusId, onPick }: ChipProps) {
  return (
    <div className="rchips" role="group" aria-label="Regions of Japan">
      {REGIONS.map((r) => (
        <button key={r.id} type="button" className="rchip" aria-pressed={focusId === r.id} onClick={() => onPick(r.id)}>
          {r.live && <span className="live-dot" aria-hidden="true" />}
          {r.name}
        </button>
      ))}
    </div>
  );
}
