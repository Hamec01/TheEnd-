import { useEffect, useRef, useState } from 'react';

interface HelpTooltipProps {
  text: string;
  label?: string;
}

export function HelpTooltip({ text, label = 'Help' }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleOpen = () => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setOpen(true);
      timerRef.current = null;
    }, 2000);
  };

  const close = () => {
    clearTimer();
    setOpen(false);
  };

  useEffect(() => () => clearTimer(), []);

  return (
    <span className="editor-help-tooltip" onMouseEnter={scheduleOpen} onMouseLeave={close}>
      <button
        type="button"
        className="editor-help-tooltip-icon"
        aria-label={label}
        onFocus={scheduleOpen}
        onBlur={close}
      >
        ?
      </button>
      {open ? (
        <span className="editor-help-tooltip-popover" role="tooltip">
          {text}
        </span>
      ) : null}
    </span>
  );
}