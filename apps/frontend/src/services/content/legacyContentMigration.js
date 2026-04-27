import { readCollection } from './storage';
const MIGRATION_FLAG_KEY = 'theend.content.backend.migrated.v2';
const LEGACY_WORLD_MAP_STORAGE_PREFIX = 'theend.worldMap.zones.dev';
function mergeById(existing, incoming) {
    const merged = new Map();
    for (const entry of existing) {
        if (!entry.id) {
            continue;
        }
        merged.set(entry.id, entry);
    }
    for (const entry of incoming) {
        if (!entry.id) {
            continue;
        }
        merged.set(entry.id, entry);
    }
    return [...merged.values()];
}
function listLegacyWorldMapKeys() {
    if (typeof window === 'undefined') {
        return [LEGACY_WORLD_MAP_STORAGE_PREFIX];
    }
    const keys = new Set([LEGACY_WORLD_MAP_STORAGE_PREFIX]);
    for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith(LEGACY_WORLD_MAP_STORAGE_PREFIX)) {
            keys.add(key);
        }
    }
    return [...keys];
}
function isLikelyLegacyZone(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const zone = value;
    return typeof zone.id === 'string'
        && zone.id.trim().length > 0
        && typeof zone.name === 'string'
        && zone.name.trim().length > 0
        && typeof zone.description === 'string'
        && zone.description.trim().length > 0
        && (zone.shape === 'circle' || zone.shape === 'polygon' || zone.shape === 'rect');
}
function parseLegacyWorldMap(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return {
                zones: parsed,
                regions: [],
            };
        }
        if (parsed && typeof parsed === 'object') {
            const objectValue = parsed;
            if (Array.isArray(objectValue.zones) || Array.isArray(objectValue.regions)) {
                return {
                    zones: Array.isArray(objectValue.zones) ? objectValue.zones : [],
                    regions: Array.isArray(objectValue.regions) ? objectValue.regions : [],
                };
            }
            if (isLikelyLegacyZone(parsed)) {
                return {
                    zones: [parsed],
                    regions: [],
                };
            }
        }
    }
    catch {
        // Ignore unreadable legacy map payloads.
    }
    return null;
}
function readLegacyWorldMap() {
    if (typeof window === 'undefined') {
        return null;
    }
    let zones = [];
    let regions = [];
    for (const key of listLegacyWorldMapKeys()) {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
            continue;
        }
        const parsed = parseLegacyWorldMap(raw);
        if (!parsed) {
            continue;
        }
        zones = mergeById(zones, parsed.zones);
        regions = mergeById(regions, parsed.regions);
    }
    if (zones.length === 0 && regions.length === 0) {
        return null;
    }
    return { zones, regions };
}
function collectLegacySnapshot() {
    if (typeof window === 'undefined') {
        return null;
    }
    const items = readCollection('items');
    const merchants = readCollection('merchants');
    const materials = readCollection('materials');
    const lootTables = readCollection('lootTables');
    const images = readCollection('images');
    const worldMap = readLegacyWorldMap();
    const hasAnyContent = items.length > 0
        || merchants.length > 0
        || materials.length > 0
        || lootTables.length > 0
        || images.length > 0
        || Boolean(worldMap && (worldMap.zones.length > 0 || worldMap.regions.length > 0));
    if (!hasAnyContent) {
        return null;
    }
    return {
        items,
        merchants,
        materials,
        lootTables,
        images,
        worldMap: worldMap
            ? {
                zones: worldMap.zones,
                regions: worldMap.regions,
            }
            : undefined,
    };
}
function idsOf(entries) {
    return new Set((entries ?? []).map((entry) => entry.id));
}
function timestampOf(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
}
function hasMissingIds(remote, legacy) {
    const remoteIds = idsOf(remote);
    return (legacy ?? []).some((entry) => !remoteIds.has(entry.id));
}
function hasNewerEntries(remote, legacy) {
    const remoteById = new Map((remote ?? []).map((entry) => [entry.id, entry]));
    return (legacy ?? []).some((entry) => {
        const legacyTimestamp = timestampOf(entry.updatedAt);
        const remoteTimestamp = timestampOf(remoteById.get(entry.id)?.updatedAt);
        return legacyTimestamp !== null && remoteTimestamp !== null && legacyTimestamp > remoteTimestamp;
    });
}
function shouldImportLegacy(remote, legacy) {
    if (hasMissingIds(remote.items, legacy.items) || hasNewerEntries(remote.items, legacy.items)) {
        return true;
    }
    if (hasMissingIds(remote.merchants, legacy.merchants) || hasNewerEntries(remote.merchants, legacy.merchants)) {
        return true;
    }
    if (hasMissingIds(remote.materials, legacy.materials) || hasNewerEntries(remote.materials, legacy.materials)) {
        return true;
    }
    if (hasMissingIds(remote.lootTables, legacy.lootTables) || hasNewerEntries(remote.lootTables, legacy.lootTables)) {
        return true;
    }
    if (hasMissingIds(remote.images, legacy.images) || hasNewerEntries(remote.images, legacy.images)) {
        return true;
    }
    const legacyZones = legacy.worldMap?.zones ?? [];
    const legacyRegions = legacy.worldMap?.regions ?? [];
    const remoteZones = remote.worldMap?.zones ?? [];
    const remoteRegions = remote.worldMap?.regions ?? [];
    if (legacyZones.length > remoteZones.length || hasMissingIds(remoteZones, legacyZones) || hasNewerEntries(remoteZones, legacyZones)) {
        return true;
    }
    if (legacyRegions.length > remoteRegions.length || hasMissingIds(remoteRegions, legacyRegions)) {
        return true;
    }
    return false;
}
export async function ensureLegacyContentMigrated(options) {
    if (typeof window === 'undefined') {
        return;
    }
    const legacySnapshot = collectLegacySnapshot();
    const alreadyMigrated = window.localStorage.getItem(MIGRATION_FLAG_KEY) === '1';
    if (!legacySnapshot) {
        if (!alreadyMigrated) {
            window.localStorage.setItem(MIGRATION_FLAG_KEY, '1');
        }
        return;
    }
    const remoteSnapshot = await options.loadRemoteSnapshot();
    if (alreadyMigrated && !shouldImportLegacy(remoteSnapshot, legacySnapshot)) {
        return;
    }
    await options.importLegacySnapshot(legacySnapshot);
    window.localStorage.setItem(MIGRATION_FLAG_KEY, '1');
}
