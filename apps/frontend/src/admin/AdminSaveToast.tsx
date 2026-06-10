import { useEffect, useState } from 'react';
import { subscribeAdminSaveToast } from './adminSaveRegistry';

const TOAST_VISIBLE_MS = 2400;

export function AdminSaveToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let hideTimer: number | undefined;

    return subscribeAdminSaveToast((nextMessage) => {
      setMessage(nextMessage);
      if (hideTimer !== undefined) {
        window.clearTimeout(hideTimer);
      }
      hideTimer = window.setTimeout(() => {
        setMessage(null);
        hideTimer = undefined;
      }, TOAST_VISIBLE_MS);
    });
  }, []);

  if (!message) {
    return null;
  }

  return (
    <div className="admin-save-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
