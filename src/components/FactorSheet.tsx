import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import type { Attraction } from '../data/types';
import { LINES, type LineId } from '../data/lines';
import { EASE_OUT } from '../lib/motion';
import { useMedia } from '../lib/useMedia';
import { Icon } from './Icon';
import { Station } from './Station';
import { Conditions } from '../pages/sections/Conditions';
import { Effort } from '../pages/sections/Effort';
import { Vibe } from '../pages/sections/Vibe';
import { Logistics } from '../pages/sections/Logistics';
import { Cost } from '../pages/sections/Cost';

interface Props {
  a: Attraction;
  line: LineId | null;
  onChange: (line: LineId) => void;
  onClose: () => void;
}

/** One factor group at a time, in a side panel (laptop) or a bottom sheet (phone). The line on top switches groups. */
export function FactorSheet({ a, line, onChange, onClose }: Props) {
  const narrow = useMedia('(max-width: 760px)');
  const body = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const day = new Date().getDay();
  const todayIndex = (day + 6) % 7;
  const weekend = day === 0 || day === 6;
  const index = line ? LINES.findIndex((l) => l.id === line) : -1;

  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [line]);

  useEffect(() => {
    if (!line) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < LINES.length - 1) onChange(LINES[index + 1].id);
      if (e.key === 'ArrowLeft' && index > 0) onChange(LINES[index - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [line, index, onChange, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {line && (
        <>
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.div
            className={`fsheet ${narrow ? 'is-bottom' : 'is-side'}`}
            role="dialog"
            aria-modal="true"
            aria-label={`${a.name}: ${LINES[index].name}`}
            data-lenis-prevent
            initial={narrow ? { y: '100%' } : { x: '100%' }}
            animate={narrow ? { y: 0 } : { x: 0 }}
            exit={narrow ? { y: '100%' } : { x: '100%' }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            drag={narrow ? 'y' : false}
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            {narrow && <span className="fsheet-handle" aria-hidden="true" onPointerDown={(e) => drag.start(e)} />}
            <header className="fsheet-head" onPointerDown={(e) => narrow && !(e.target as HTMLElement).closest('button') && drag.start(e)}>
              <ol className="stepper" aria-label="Factor groups">
                {LINES.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => onChange(l.id)} aria-current={l.id === line ? 'step' : undefined}>
                      <Station line={l.id} size={28} filled={l.id === line} />
                      <span className="stepper-name">{l.name}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <button type="button" className="icon-button" onClick={onClose} aria-label="Close" autoFocus>
                <Icon name="close" size={18} />
              </button>
            </header>
            <div className="fsheet-body" ref={body}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={line}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                >
                  {line === 'conditions' && <Conditions a={a} todayIndex={todayIndex} />}
                  {line === 'effort' && <Effort a={a} />}
                  {line === 'vibe' && <Vibe a={a} weekend={weekend} />}
                  {line === 'logistics' && <Logistics a={a} todayIndex={todayIndex} />}
                  {line === 'cost' && <Cost a={a} />}
                </motion.div>
              </AnimatePresence>
              <div className="fsheet-foot">
                <button
                  type="button"
                  className="button is-quiet"
                  disabled={index === 0}
                  onClick={() => index > 0 && onChange(LINES[index - 1].id)}
                >
                  <Icon name="arrowLeft" />
                  {index > 0 ? LINES[index - 1].name : 'Start of the line'}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => (index < LINES.length - 1 ? onChange(LINES[index + 1].id) : onClose())}
                >
                  {index < LINES.length - 1 ? LINES[index + 1].name : 'Done'}
                  <Icon name={index < LINES.length - 1 ? 'arrowRight' : 'check'} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
