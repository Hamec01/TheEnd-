import { useEffect, type Dispatch, type SetStateAction } from 'react';

export type AdminSaveState = 'idle' | 'saving' | 'saved' | 'error' | 'warning';

export interface AdminSaveViewModel {
  state: AdminSaveState;
  message: string;
}

export function getIdQualityWarning(id: string): string | null {
  const trimmed = id.trim();
  if (!trimmed) {
    return null;
  }

  if (/\s/.test(trimmed)) {
    return `ID содержит пробелы. Рекомендуется snake_case: ${trimmed.replace(/\s+/g, '_').toLowerCase()}`;
  }

  if (/[A-Z]/.test(trimmed)) {
    return `ID содержит заглавные буквы. Рекомендуется: ${trimmed.toLowerCase()}`;
  }

  return null;
}

export function toAdminErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Неизвестная ошибка сохранения.';
}

export function useAdminSaveShortcut(params: {
  enabled: boolean;
  isSaving: boolean;
  onSave: () => void | Promise<void>;
}): void {
  const { enabled, isSaving, onSave } = params;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSave = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
      if (!isSave) {
        return;
      }

      event.preventDefault();

      if (!enabled || isSaving) {
        return;
      }

      void onSave();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, isSaving, onSave]);
}

export async function runSaveWithFeedback<T>(params: {
  setState: Dispatch<SetStateAction<AdminSaveViewModel>>;
  saveLabel: string;
  onSave: () => Promise<T>;
  onAfterSave?: (saved: T) => Promise<void> | void;
  successLabel?: (saved: T) => string;
}): Promise<T | null> {
  const { setState, saveLabel, onSave, onAfterSave, successLabel } = params;
  setState({ state: 'saving', message: 'Сохранение...' });

  try {
    const saved = await onSave();
    if (onAfterSave) {
      await onAfterSave(saved);
    }

    const successMessage = successLabel ? successLabel(saved) : `Сохранено: ${saveLabel}`;
    setState({ state: 'saved', message: successMessage });

    window.setTimeout(() => {
      setState((current) => (current.state === 'saved'
        ? { state: 'idle', message: successMessage }
        : current));
    }, 2600);

    return saved;
  } catch (error) {
    setState({ state: 'error', message: `Ошибка сохранения: ${toAdminErrorMessage(error)}` });
    return null;
  }
}
