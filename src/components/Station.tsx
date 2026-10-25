import type { LineId } from '../data/lines';
import { lineById } from '../data/lines';

/** A Tokyo Metro style station mark: a ring in the line colour with its code. */
export function Station({ line, size = 28, filled = false, className = '' }: { line: LineId; size?: number; filled?: boolean; className?: string }) {
  const l = lineById(line);
  return (
    <span
      className={`station ${filled ? 'is-filled' : ''} ${className}`}
      style={{ width: size, height: size, ['--hue' as string]: `var(--c-${line})`, fontSize: size * 0.46 }}
      aria-hidden="true"
    >
      {l.code}
    </span>
  );
}
