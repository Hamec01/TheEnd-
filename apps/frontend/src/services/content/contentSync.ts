export type ContentSyncScope = 'content' | 'worldMap' | 'all';

export interface ContentSyncPayload {
  scope: ContentSyncScope;
  timestamp: number;
}

const CHANNEL_NAME = 'theend.content.sync';
const EVENT_NAME = 'theend:content-sync';

let channel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }

  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }

  return channel;
}

function normalizePayload(value: unknown): ContentSyncPayload | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const payload = value as Partial<ContentSyncPayload>;
  if (payload.scope !== 'content' && payload.scope !== 'worldMap' && payload.scope !== 'all') {
    return null;
  }

  return {
    scope: payload.scope,
    timestamp: typeof payload.timestamp === 'number' && Number.isFinite(payload.timestamp)
      ? payload.timestamp
      : Date.now(),
  };
}

export function notifyContentSync(scope: ContentSyncScope): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: ContentSyncPayload = {
    scope,
    timestamp: Date.now(),
  };

  window.dispatchEvent(new CustomEvent<ContentSyncPayload>(EVENT_NAME, { detail: payload }));
  getBroadcastChannel()?.postMessage(payload);
}

export function subscribeToContentSync(listener: (payload: ContentSyncPayload) => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleWindowEvent = (event: Event) => {
    const payload = normalizePayload((event as CustomEvent<ContentSyncPayload>).detail);
    if (payload) {
      listener(payload);
    }
  };

  const handleMessage = (event: MessageEvent<unknown>) => {
    const payload = normalizePayload(event.data);
    if (payload) {
      listener(payload);
    }
  };

  window.addEventListener(EVENT_NAME, handleWindowEvent as EventListener);
  const activeChannel = getBroadcastChannel();
  activeChannel?.addEventListener('message', handleMessage as EventListener);

  return () => {
    window.removeEventListener(EVENT_NAME, handleWindowEvent as EventListener);
    activeChannel?.removeEventListener('message', handleMessage as EventListener);
  };
}
