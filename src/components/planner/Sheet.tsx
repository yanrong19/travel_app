import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../Icon';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Shown under the body, outside its scroll. */
  footer?: ReactNode;
  size?: 'wide' | 'medium' | 'small';
}

/**
 * A modal sheet over the planner, on the native <dialog>: it traps focus, Escape closes it and
 * focus goes back to whatever opened it. Its content mounts only while it's open (the place
 * picker brings a map of its own).
 */
export function Sheet({ open, title, onClose, children, footer, size = 'medium' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`psheet is-${size}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        // Escape in an open search list belongs to the list.
        if (document.activeElement?.getAttribute('aria-expanded') === 'true') return;
        onClose();
      }}
      // A click on the backdrop lands on the dialog itself.
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <div className="psheet-box">
          <header className="psheet-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </header>
          <div className="psheet-body" data-lenis-prevent>
            {children}
          </div>
          {footer && <footer className="psheet-foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
