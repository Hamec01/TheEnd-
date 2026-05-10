import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ADMIN_HELP, type AdminHelpEntry, type AdminHelpSectionKey, getAdminHelpEntry } from './adminHelpText';

type AdminHelpTooltipProps = {
  entry?: AdminHelpEntry;
  section?: AdminHelpSectionKey;
  field?: string;
  label?: string;
};

type TooltipPosition = {
  top: number;
  left: number;
  maxWidth: number;
};

const TOOLTIP_MIN_WIDTH = 280;
const TOOLTIP_MAX_WIDTH = 360;
const TOOLTIP_GAP = 10;

function resolveEntry(props: AdminHelpTooltipProps): AdminHelpEntry | undefined {
  if (props.entry) {
    return props.entry;
  }
  if (!props.section || !props.field) {
    return undefined;
  }
  return getAdminHelpEntry(props.section, props.field);
}

function computeTooltipPosition(anchor: HTMLElement): TooltipPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const preferredWidth = Math.min(TOOLTIP_MAX_WIDTH, Math.max(TOOLTIP_MIN_WIDTH, viewportWidth - 24));
  let left = rect.left + rect.width / 2 - preferredWidth / 2;
  left = Math.max(12, Math.min(left, viewportWidth - preferredWidth - 12));

  let top = rect.bottom + TOOLTIP_GAP;
  if (top + 200 > viewportHeight) {
    top = Math.max(12, rect.top - 200 - TOOLTIP_GAP);
  }

  return { top, left, maxWidth: preferredWidth };
}

export function AdminHelpTooltip(props: AdminHelpTooltipProps) {
  const entry = useMemo(() => resolveEntry(props), [props]);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const tooltipId = useId();

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const close = () => {
    clearTimer();
    setOpen(false);
  };

  const openTooltip = () => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      if (buttonRef.current) {
        setPosition(computeTooltipPosition(buttonRef.current));
      }
      setOpen(true);
      timerRef.current = null;
    }, 300);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      if (buttonRef.current) {
        setPosition(computeTooltipPosition(buttonRef.current));
      }
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  useEffect(() => () => clearTimer(), []);

  if (!entry) {
    return null;
  }

  const style: CSSProperties | undefined = position
    ? { top: `${position.top}px`, left: `${position.left}px`, width: `${position.maxWidth}px` }
    : undefined;

  return (
    <span className="admin-help-tooltip" onMouseEnter={openTooltip} onMouseLeave={close}>
      <button
        ref={buttonRef}
        type="button"
        className="admin-help-tooltip-icon"
        aria-label={props.label ?? entry.title ?? 'Подсказка'}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={openTooltip}
        onBlur={close}
      >
        ?
      </button>
      {open && position
        ? createPortal(
          <div id={tooltipId} className="admin-help-tooltip-popover" role="tooltip" style={style}>
            <div className="admin-help-tooltip-title">{entry.title}</div>
            <div className="admin-help-tooltip-text">{entry.text}</div>
            {entry.example ? <pre className="admin-help-tooltip-example">{entry.example}</pre> : null}
            {entry.warning ? <div className="admin-help-tooltip-warning">{entry.warning}</div> : null}
          </div>,
          document.body,
        )
        : null}
    </span>
  );
}

export { ADMIN_HELP };
