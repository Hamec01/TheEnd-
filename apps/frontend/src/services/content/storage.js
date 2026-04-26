const PREFIX = 'theend.content.';
const DEFAULT_DB = {
    items: [],
    merchants: [],
    materials: [],
    lootTables: [],
    images: [],
};
function key(name) {
    return `${PREFIX}${name}`;
}
function safeParse(raw, fallback) {
    if (!raw) {
        return fallback;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
export function readCollection(name) {
    if (typeof window === 'undefined') {
        return [];
    }
    return safeParse(window.localStorage.getItem(key(name)), []);
}
export function writeCollection(name, values) {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(key(name), JSON.stringify(values));
}
export function resetContentStorage() {
    if (typeof window === 'undefined') {
        return;
    }
    Object.keys(DEFAULT_DB).forEach((name) => {
        window.localStorage.removeItem(key(name));
    });
}
export function nowIso() {
    return new Date().toISOString();
}
export function uid(prefix = 'id') {
    const random = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${Date.now()}_${random}`;
}
