export interface AdminSaveHandler {
  enabled: boolean;
  isSaving: boolean;
  onSave: () => boolean | void | Promise<boolean | void>;
  successMessage?: string;
}

let activeHandler: AdminSaveHandler | null = null;

let listenerRefCount = 0;
let detachListeners: (() => void) | null = null;

type AdminSaveToastListener = (message: string) => void;
const toastListeners = new Set<AdminSaveToastListener>();

export function subscribeAdminSaveToast(listener: AdminSaveToastListener): () => void {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

function flashAdminSaveToast(message: string): void {
  for (const listener of toastListeners) {
    listener(message);
  }
}

export function setAdminSaveHandler(handler: AdminSaveHandler | null): void {
  activeHandler = handler;
}

export async function triggerAdminSave(): Promise<boolean> {
  if (!activeHandler?.enabled || activeHandler.isSaving) {
    return false;
  }

  try {
    const result = activeHandler.onSave();
    const resolved = result instanceof Promise ? await result : result;
    if (resolved === false) {
      return false;
    }
    flashAdminSaveToast(activeHandler.successMessage ?? 'Сохранено!');
    return true;
  } catch {
    flashAdminSaveToast('Ошибка сохранения');
    return false;
  }
}

function isAdminSaveShortcut(event: KeyboardEvent): boolean {
  if (!event.ctrlKey && !event.metaKey) {
    return false;
  }
  if (event.altKey) {
    return false;
  }
  // Physical S key — works with RU/EN layouts (event.key can be "ы" on RU).
  if (event.code === 'KeyS') {
    return true;
  }
  const key = event.key.toLowerCase();
  return key === 's' || key === 'ы';
}

function handleAdminSaveKeyDown(event: KeyboardEvent): void {
  if (!isAdminSaveShortcut(event)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  void triggerAdminSave();
}

function attachGlobalAdminSaveListeners(): void {
  const options: AddEventListenerOptions = { capture: true };
  document.addEventListener('keydown', handleAdminSaveKeyDown, options);
  window.addEventListener('keydown', handleAdminSaveKeyDown, options);
  detachListeners = () => {
    document.removeEventListener('keydown', handleAdminSaveKeyDown, options);
    window.removeEventListener('keydown', handleAdminSaveKeyDown, options);
    detachListeners = null;
  };
}

export function installGlobalAdminSaveListener(): () => void {
  listenerRefCount += 1;
  if (listenerRefCount === 1) {
    attachGlobalAdminSaveListeners();
  }

  return () => {
    listenerRefCount = Math.max(0, listenerRefCount - 1);
    if (listenerRefCount === 0 && detachListeners) {
      detachListeners();
    }
  };
}

export function isAdminPath(pathname: string): boolean {
  const normalized = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;
  return normalized === '/admin' || normalized.startsWith('/admin/');
}
