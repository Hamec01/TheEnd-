import type { PaintedRegion, WorldMapZone } from '../../worldmap/zoneEditorTypes';
import type {
  AdminDialogue,
  AdminItem,
  AdminMerchant,
  AdminNpc,
  AdminQuest,
  AdminQuestInteraction,
  AdminQuestItem,
  AdminQuestMarker,
  AdminSkill,
  LootTable,
  Material,
  StoredImage,
} from './models';
import { readCollection } from './storage';
import type { ContentSnapshot } from './contentApi';

const MIGRATION_FLAG_KEY = 'theend.content.backend.migrated.v3';
const LEGACY_WORLD_MAP_STORAGE_PREFIX = 'theend.worldMap.zones.dev';
const LEGACY_DIALOGUES_KEY = 'theend.dialogues';
const LEGACY_NPCS_KEY = 'theend.npcs';
const LEGACY_QUESTS_KEY = 'theend.quests';
const LEGACY_QUEST_INTERACTIONS_KEY = 'theend.questInteractions';
const LEGACY_QUEST_ITEMS_KEY = 'theend.questItems';
const LEGACY_QUEST_MARKERS_KEY = 'theend.questMap.markers';

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const merged = new Map<string, T>();

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

function listLegacyWorldMapKeys(): string[] {
  if (typeof window === 'undefined') {
    return [LEGACY_WORLD_MAP_STORAGE_PREFIX];
  }

  const keys = new Set<string>([LEGACY_WORLD_MAP_STORAGE_PREFIX]);
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(LEGACY_WORLD_MAP_STORAGE_PREFIX)) {
      keys.add(key);
    }
  }

  return [...keys];
}

function isLikelyLegacyZone(value: unknown): value is WorldMapZone {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const zone = value as Record<string, unknown>;
  return typeof zone.id === 'string'
    && zone.id.trim().length > 0
    && typeof zone.name === 'string'
    && zone.name.trim().length > 0
    && typeof zone.description === 'string'
    && zone.description.trim().length > 0
    && (zone.shape === 'circle' || zone.shape === 'polygon' || zone.shape === 'rect');
}

function parseLegacyWorldMap(raw: string): { zones: WorldMapZone[]; regions: PaintedRegion[] } | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return {
        zones: parsed as WorldMapZone[],
        regions: [],
      };
    }

    if (parsed && typeof parsed === 'object') {
      const objectValue = parsed as { zones?: WorldMapZone[]; regions?: PaintedRegion[] };
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
  } catch {
    // Ignore unreadable legacy map payloads.
  }

  return null;
}

function readLegacyWorldMap(): { zones: WorldMapZone[]; regions: PaintedRegion[] } | null {
  if (typeof window === 'undefined') {
    return null;
  }

  let zones: WorldMapZone[] = [];
  let regions: PaintedRegion[] = [];

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

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readLegacyArray<T>(key: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return safeParse<T[]>(window.localStorage.getItem(key), []);
}

function collectLegacySnapshot(): Partial<ContentSnapshot> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const items = readCollection<AdminItem>('items');
  const merchants = readCollection<AdminMerchant>('merchants');
  const skills = readCollection<AdminSkill>('skills');
  const materials = readCollection<Material>('materials');
  const lootTables = readCollection<LootTable>('lootTables');
  const images = readCollection<StoredImage>('images');
  const dialogues = readLegacyArray<AdminDialogue>(LEGACY_DIALOGUES_KEY);
  const npcs = readLegacyArray<AdminNpc>(LEGACY_NPCS_KEY);
  const quests = readLegacyArray<AdminQuest>(LEGACY_QUESTS_KEY);
  const questInteractions = readLegacyArray<AdminQuestInteraction>(LEGACY_QUEST_INTERACTIONS_KEY);
  const questItems = readLegacyArray<AdminQuestItem>(LEGACY_QUEST_ITEMS_KEY);
  const questMarkers = readLegacyArray<AdminQuestMarker>(LEGACY_QUEST_MARKERS_KEY);
  const worldMap = readLegacyWorldMap();

  const hasAnyContent = items.length > 0
    || merchants.length > 0
    || skills.length > 0
    || materials.length > 0
    || lootTables.length > 0
    || images.length > 0
    || dialogues.length > 0
    || npcs.length > 0
    || quests.length > 0
    || questInteractions.length > 0
    || questItems.length > 0
    || questMarkers.length > 0
    || Boolean(worldMap && (worldMap.zones.length > 0 || worldMap.regions.length > 0));

  if (!hasAnyContent) {
    return null;
  }

  return {
    items,
    merchants,
    skills,
    materials,
    lootTables,
    images,
    dialogues,
    npcs,
    quests,
    questInteractions,
    questItems,
    questMarkers,
    worldMap: worldMap
      ? {
          zones: worldMap.zones,
          regions: worldMap.regions,
        }
      : undefined,
  };
}

function idsOf(entries: Array<{ id: string }> | undefined): Set<string> {
  return new Set((entries ?? []).map((entry) => entry.id));
}

function timestampOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function hasMissingIds(remote: Array<{ id: string }> | undefined, legacy: Array<{ id: string }> | undefined): boolean {
  const remoteIds = idsOf(remote);
  return (legacy ?? []).some((entry) => !remoteIds.has(entry.id));
}

function hasNewerEntries<T extends { id: string; updatedAt?: unknown }>(
  remote: T[] | undefined,
  legacy: T[] | undefined,
): boolean {
  const remoteById = new Map((remote ?? []).map((entry) => [entry.id, entry]));
  return (legacy ?? []).some((entry) => {
    const legacyTimestamp = timestampOf(entry.updatedAt);
    const remoteTimestamp = timestampOf(remoteById.get(entry.id)?.updatedAt);
    return legacyTimestamp !== null && remoteTimestamp !== null && legacyTimestamp > remoteTimestamp;
  });
}

function shouldImportLegacy(remote: ContentSnapshot, legacy: Partial<ContentSnapshot>): boolean {
  if ((legacy.items?.length ?? 0) > remote.items.length) {
    return true;
  }
  if (hasMissingIds(remote.items, legacy.items) || hasNewerEntries(remote.items, legacy.items)) {
    return true;
  }
  if ((legacy.merchants?.length ?? 0) > remote.merchants.length) {
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
  if (hasMissingIds(remote.dialogues, legacy.dialogues) || hasNewerEntries(remote.dialogues, legacy.dialogues)) {
    return true;
  }
  if (hasMissingIds(remote.npcs, legacy.npcs) || hasNewerEntries(remote.npcs, legacy.npcs)) {
    return true;
  }
  if (hasMissingIds(remote.quests, legacy.quests) || hasNewerEntries(remote.quests, legacy.quests)) {
    return true;
  }
  if (hasMissingIds(remote.questInteractions, legacy.questInteractions) || hasNewerEntries(remote.questInteractions, legacy.questInteractions)) {
    return true;
  }
  if (hasMissingIds(remote.questItems, legacy.questItems) || hasNewerEntries(remote.questItems, legacy.questItems)) {
    return true;
  }
  if (hasMissingIds(remote.questMarkers, legacy.questMarkers) || hasNewerEntries(remote.questMarkers, legacy.questMarkers)) {
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

export async function ensureLegacyContentMigrated(options: {
  loadRemoteSnapshot: () => Promise<ContentSnapshot>;
  importLegacySnapshot: (payload: Partial<ContentSnapshot>) => Promise<unknown>;
}): Promise<void> {
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
