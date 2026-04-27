const CHANNEL_NAME = 'theend.content.sync';
const EVENT_NAME = 'theend:content-sync';
let channel = null;
function getBroadcastChannel() {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
        return null;
    }
    if (!channel) {
        channel = new BroadcastChannel(CHANNEL_NAME);
    }
    return channel;
}
function normalizePayload(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const payload = value;
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
export function notifyContentSync(scope) {
    if (typeof window === 'undefined') {
        return;
    }
    const payload = {
        scope,
        timestamp: Date.now(),
    };
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
    getBroadcastChannel()?.postMessage(payload);
}
export function subscribeToContentSync(listener) {
    if (typeof window === 'undefined') {
        return () => undefined;
    }
    const handleWindowEvent = (event) => {
        const payload = normalizePayload(event.detail);
        if (payload) {
            listener(payload);
        }
    };
    const handleMessage = (event) => {
        const payload = normalizePayload(event.data);
        if (payload) {
            listener(payload);
        }
    };
    window.addEventListener(EVENT_NAME, handleWindowEvent);
    const activeChannel = getBroadcastChannel();
    activeChannel?.addEventListener('message', handleMessage);
    return () => {
        window.removeEventListener(EVENT_NAME, handleWindowEvent);
        activeChannel?.removeEventListener('message', handleMessage);
    };
}
