import { useEffect, useRef } from 'react';
import type { PlaceRef } from '../../lib/trips';
import { attractionsIn, placeLabel } from '../../lib/tripPlaces';
import { Icon } from '../Icon';

interface Props {
  places: PlaceRef[];
  index: number;
  onPick: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

/** The trip's places as pills: one is the map's current place. A trip keeps at least one. */
export function PlaceSwitcher({ places, index, onPick, onAdd, onRemove }: Props) {
  const row = useRef<HTMLDivElement>(null);
  // Keep the current pill in view when the row scrolls (phone, or many places).
  useEffect(() => {
    row.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [index]);

  return (
    <div ref={row} className="psw" role="group" aria-label="Places in this trip">
      {places.map((p, i) => {
        const { name } = placeLabel(p);
        const empty = attractionsIn(p).length === 0;
        return (
          <span key={`${p.level}-${p.id}`} className={`psw-pill ${i === index ? 'is-on' : ''}`}>
            <button
              type="button"
              className="psw-pick"
              aria-pressed={i === index}
              onClick={() => onPick(i)}
              title={empty ? `${name}: no checked attractions yet` : undefined}
            >
              {!empty && <span className="psw-dot" aria-hidden="true" />}
              {name}
            </button>
            {places.length > 1 && (
              <button type="button" className="psw-remove" onClick={() => onRemove(i)} aria-label={`Remove ${name} from the trip`}>
                <Icon name="close" size={13} />
              </button>
            )}
          </span>
        );
      })}
      <button type="button" className="psw-add" onClick={onAdd}>
        <Icon name="plus" size={15} />
        Add place
      </button>
    </div>
  );
}
