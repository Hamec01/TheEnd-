import { notifyContentSync } from './contentSync';
import { ensureLegacyContentMigrated } from './legacyContentMigration';
const API_BASE = 'http://localhost:3001';
let bootstrapPromise = null;
async function readErrorMessage(res) {
    const raw = await res.text();
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.message)) {
            return parsed.message.join(', ');
        }
        if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
            return parsed.message;
        }
    }
    catch {
        // Fallback to raw text below.
    }
    return raw || `${res.status} ${res.statusText}`;
}
async function requestJson(path, init) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
        ...init,
    });
    if (!res.ok) {
        throw new Error(await readErrorMessage(res));
    }
    if (res.status === 204) {
        return undefined;
    }
    return res.json();
}
async function getContentSnapshotRaw() {
    return requestJson('/content/snapshot');
}
async function importLegacyContentRaw(payload) {
    const snapshot = await requestJson('/content/import-local', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    notifyContentSync('all');
    return snapshot;
}
export async function ensureContentBackendReady() {
    if (!bootstrapPromise) {
        bootstrapPromise = ensureLegacyContentMigrated({
            loadRemoteSnapshot: getContentSnapshotRaw,
            importLegacySnapshot: importLegacyContentRaw,
        }).catch((error) => {
            bootstrapPromise = null;
            throw error;
        });
    }
    return bootstrapPromise;
}
export async function getContentSnapshot() {
    await ensureContentBackendReady();
    return getContentSnapshotRaw();
}
export async function seedDefaultContent() {
    await ensureContentBackendReady();
    const result = await requestJson('/content/seed-defaults', {
        method: 'POST',
    });
    if (result.seeded) {
        notifyContentSync('content');
    }
    return result;
}
export async function getContentCollection(collection) {
    await ensureContentBackendReady();
    return requestJson(`/content/${collection}`);
}
export async function getContentEntry(collection, id) {
    await ensureContentBackendReady();
    return requestJson(`/content/${collection}/${encodeURIComponent(id)}`);
}
export async function createContentEntry(collection, payload) {
    await ensureContentBackendReady();
    const entry = await requestJson(`/content/${collection}`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    notifyContentSync('content');
    return entry;
}
export async function updateContentEntry(collection, id, payload) {
    await ensureContentBackendReady();
    const entry = await requestJson(`/content/${collection}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    notifyContentSync('content');
    return entry;
}
export async function deleteContentEntry(collection, id) {
    await ensureContentBackendReady();
    await requestJson(`/content/${collection}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    notifyContentSync('content');
}
export async function getWorldMapContent() {
    await ensureContentBackendReady();
    return requestJson('/content/world-map');
}
export async function saveWorldMapContent(payload) {
    await ensureContentBackendReady();
    const worldMap = await requestJson('/content/world-map', {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    notifyContentSync('worldMap');
    return worldMap;
}
