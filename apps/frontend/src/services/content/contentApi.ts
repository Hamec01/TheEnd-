import type { BattleMapDefinition } from '@theend/rpg-domain';
import type { PaintedRegion, WorldMapZone } from '../../worldmap/zoneEditorTypes';
import type { City } from '../../types/city';
import type { QuestMarkerDefinition } from '../../types/quest';
import type {
  AdminDialogue,
  AdminItem,
  AdminMerchant,
  AdminNpc,
  AdminQuest,
  AdminQuestItem,
  AdminQuestMarker,
  AdminSkill,
  LootTable,
  Material,
  StoredImage,
} from './models';
import { notifyContentSync } from './contentSync';
import { ensureLegacyContentMigrated } from './legacyContentMigration';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const ALLOW_CONTENT_IMPORT = String(import.meta.env.VITE_ALLOW_CONTENT_IMPORT ?? '').trim().toLowerCase() === 'true';

export type ContentCollectionName =
  | 'items'
  | 'skills'
  | 'merchants'
  | 'cities'
  | 'materials'
  | 'lootTables'
  | 'images'
  | 'dialogues'
  | 'npcs'
  | 'quests'
  | 'questItems'
  | 'questMarkers'
  | 'battleMaps';

export interface WorldMapContent {
  zones: WorldMapZone[];
  regions: PaintedRegion[];
  questMarkers?: unknown[];
  updatedAt?: string;
}

export interface ContentSnapshot {
  items: AdminItem[];
  skills: AdminSkill[];
  merchants: AdminMerchant[];
  cities: City[];
  materials: Material[];
  lootTables: LootTable[];
  images: StoredImage[];
  dialogues: AdminDialogue[];
  npcs: AdminNpc[];
  quests: AdminQuest[];
  questItems: AdminQuestItem[];
  questMarkers: AdminQuestMarker[];
  battleMaps: BattleMapDefinition[];
  worldMap: WorldMapContent;
}

let bootstrapPromise: Promise<void> | null = null;

async function readErrorMessage(res: Response): Promise<string> {
  const raw = await res.text();

  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(', ');
    }
    if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
      return parsed.message;
    }
  } catch {
    // Fallback to raw text below.
  }

  return raw || `${res.status} ${res.statusText}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
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
    return undefined as T;
  }

  return res.json();
}

async function getContentSnapshotRaw(): Promise<ContentSnapshot> {
  return requestJson<ContentSnapshot>('/content/snapshot');
}

async function importLegacyContentRaw(payload: Partial<ContentSnapshot>): Promise<ContentSnapshot> {
  const snapshot = await requestJson<ContentSnapshot>('/content/import-local', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  notifyContentSync('all');
  return snapshot;
}

export async function ensureContentBackendReady(): Promise<void> {
  if (!ALLOW_CONTENT_IMPORT) {
    return;
  }

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

export async function getContentSnapshot(): Promise<ContentSnapshot> {
  await ensureContentBackendReady();
  return getContentSnapshotRaw();
}

export async function exportFullContent(): Promise<ContentSnapshot> {
  await ensureContentBackendReady();
  return requestJson<ContentSnapshot>('/content/export');
}

export async function importFullContent(payload: Partial<ContentSnapshot>): Promise<ContentSnapshot> {
  await ensureContentBackendReady();
  const snapshot = await requestJson<ContentSnapshot>('/content/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  notifyContentSync('all');
  return snapshot;
}

export async function seedDefaultContent(): Promise<{ seeded: boolean; message: string }> {
  await ensureContentBackendReady();
  const result = await requestJson<{ seeded: boolean; message: string }>('/content/seed-defaults', {
    method: 'POST',
  });
  if (result.seeded) {
    notifyContentSync('content');
  }
  return result;
}

export async function getContentCollection<T>(collection: ContentCollectionName): Promise<T[]> {
  await ensureContentBackendReady();
  return requestJson<T[]>(`/content/${collection}`);
}

export async function getContentEntry<T>(collection: ContentCollectionName, id: string): Promise<T | null> {
  await ensureContentBackendReady();
  return requestJson<T | null>(`/content/${collection}/${encodeURIComponent(id)}`);
}

export async function createContentEntry<T>(collection: ContentCollectionName, payload: T): Promise<T> {
  await ensureContentBackendReady();
  const entry = await requestJson<T>(`/content/${collection}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  notifyContentSync('content');
  return entry;
}

export async function updateContentEntry<T>(collection: ContentCollectionName, id: string, payload: Partial<T>): Promise<T> {
  await ensureContentBackendReady();
  const entry = await requestJson<T>(`/content/${collection}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  notifyContentSync('content');
  return entry;
}

export async function deleteContentEntry(collection: ContentCollectionName, id: string): Promise<void> {
  await ensureContentBackendReady();
  await requestJson<{ ok: true }>(`/content/${collection}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  notifyContentSync('content');
}

export async function getWorldMapContent(): Promise<WorldMapContent> {
  await ensureContentBackendReady();
  return requestJson<WorldMapContent>('/content/world-map');
}

export async function saveWorldMapContent(payload: WorldMapContent): Promise<WorldMapContent> {
  await ensureContentBackendReady();
  const worldMap = await requestJson<WorldMapContent>('/content/world-map', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  notifyContentSync('worldMap');
  return worldMap;
}
