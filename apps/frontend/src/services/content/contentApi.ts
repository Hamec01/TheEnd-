import type { BattleMapDefinition } from '@theend/rpg-domain';
import type { PaintedRegion, WorldMapZone } from '../../worldmap/zoneEditorTypes';
import type { City } from '../../types/city';
import type { WorldLocation } from '../../types/location';
import type { QuestMarkerDefinition } from '../../types/quest';
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
  AdminVisualFx,
  BlacksmithBalance,
  BlacksmithForgeTier,
  BlacksmithModule,
  BlacksmithQualityTier,
  BlacksmithTool,
  BlacksmithVisualPreset,
  BlacksmithItemTemplate,
  CarpenterItemTemplate,
  ProfessionWorkshopDefinition,
  BlacksmithItemWorkAction,
  CraftingRecipe,
  RecipeVisualProfile,
  ItemSet,
  LootTable,
  Material,
  RuneComplex,
  SoundDefinition,
  StoredImage,
  TreeDefinition,
  BiomeDefinition,
} from './models';
import { notifyContentSync } from './contentSync';
import { ensureLegacyContentMigrated } from './legacyContentMigration';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api';
const ALLOW_CONTENT_IMPORT = String(import.meta.env.VITE_ALLOW_CONTENT_IMPORT ?? '').trim().toLowerCase() === 'true';
const API_TIMEOUT_MS = 10_000;
const IMAGE_UPLOAD_TIMEOUT_MS = 120_000;

export type ContentCollectionName =
  | 'items'
  | 'skills'
  | 'visualFx'
  | 'merchants'
  | 'cities'
  | 'locations'
  | 'materials'
  | 'lootTables'
  | 'images'
  | 'dialogues'
  | 'npcs'
  | 'quests'
  | 'questInteractions'
  | 'questItems'
  | 'questMarkers'
  | 'battleMaps'
  | 'craftingRecipes'
  | 'recipeVisualProfiles'
  | 'itemSets'
  | 'runeComplexes'
  | 'blacksmithForgeTiers'
  | 'blacksmithModules'
  | 'blacksmithTools'
  | 'blacksmithQualityTiers'
  | 'blacksmithVisualPresets'
  | 'blacksmithBalance'
  | 'blacksmithItemTemplates'
  | 'carpenterItemTemplates'
  | 'blacksmithItemWorkActions'
  | 'sounds'
  | 'trees'
  | 'biomes'
  | 'imageSheets'
  | 'professionSkills'
  | 'professionWorkshops';

export interface ItemPreviewQueryBody {
  activationContexts?: string[];
  instanceSocketState?: Array<{
    socketId: string;
    socketedAugmentItemId?: string;
    isLocked?: boolean;
    source?: 'base' | 'blacksmith_added' | 'scripted';
  }>;
}

export interface ItemPreviewResponse {
  itemId: string;
  itemName: string;
  humanReadableEffects: string[];
  socketsPreview: Array<{
    socketId: string;
    status: 'empty' | 'occupied_active' | 'occupied_inactive' | 'locked';
    socketedAugmentItemId?: string;
    socketedAugmentName?: string;
    inactiveReason?: string;
    allowedAugmentTypes?: string[];
    source?: 'base' | 'blacksmith_added' | 'scripted';
    augmentEffects?: string[];
  }>;
  inactiveAugments: Array<{
    socketId: string;
    augmentItemId: string;
    augmentItemName?: string;
    inactiveReason: string;
    effects: string[];
  }>;
  setPreview?: {
    setId: string;
    setName: string;
    totalPieces: number;
    pieceSummaries?: Array<{ itemId: string; itemName: string }>;
    bonuses: Array<{
      requiredPieces: number;
      description?: string;
      effects: string[];
      penaltyEffects?: string[];
    }>;
  };
}

export interface WorldMapContent {
  zones: WorldMapZone[];
  regions: PaintedRegion[];
  questMarkers?: unknown[];
  updatedAt?: string;
}

export interface ContentSnapshot {
  items: AdminItem[];
  skills: AdminSkill[];
  visualFx: AdminVisualFx[];
  merchants: AdminMerchant[];
  cities: City[];
  locations: WorldLocation[];
  materials: Material[];
  lootTables: LootTable[];
  images: StoredImage[];
  dialogues: AdminDialogue[];
  npcs: AdminNpc[];
  quests: AdminQuest[];
  questInteractions: AdminQuestInteraction[];
  questItems: AdminQuestItem[];
  questMarkers: AdminQuestMarker[];
  battleMaps: BattleMapDefinition[];
  craftingRecipes: CraftingRecipe[];
  recipeVisualProfiles: RecipeVisualProfile[];
  itemSets: ItemSet[];
  runeComplexes: RuneComplex[];
  blacksmithForgeTiers: BlacksmithForgeTier[];
  blacksmithModules: BlacksmithModule[];
  blacksmithTools: BlacksmithTool[];
  blacksmithQualityTiers: BlacksmithQualityTier[];
  blacksmithVisualPresets: BlacksmithVisualPreset[];
  blacksmithBalance: BlacksmithBalance[];
  blacksmithItemTemplates: BlacksmithItemTemplate[];
  carpenterItemTemplates: CarpenterItemTemplate[];
  professionWorkshops: ProfessionWorkshopDefinition[];
  blacksmithItemWorkActions: BlacksmithItemWorkAction[];
  sounds: SoundDefinition[];
  trees?: TreeDefinition[];
  biomes?: BiomeDefinition[];
  imageSheets?: import('./models').ImageSheetDefinition[];
  professionSkills?: import('../../types/profession').ProfessionSkill[];
  worldMap: WorldMapContent;
}

export type ContentImportMode = 'replace' | 'merge' | 'dryRun' | 'add_missing_only';

export interface ContentBackupEnvelope {
  schemaVersion: number;
  game: 'TheEnd';
  exportedAt: string;
  exportedBy: 'admin';
  appEnv?: string;
  gitCommit?: string;
  contentCounts: Record<string, number>;
  content: ContentSnapshot;
}

export interface ContentImportResult {
  mode: ContentImportMode;
  dryRun: boolean;
  snapshot: ContentSnapshot;
  warnings: string[];
  errors: string[];
  summary?: {
    created: number;
    updated: number;
    skippedExisting: number;
  };
  actions?: Record<string, {
    createMissing: string[];
    skippedExisting: string[];
  }>;
}

export interface ContentAutosaveFileInfo {
  slot: number;
  fileName: string;
  updatedAt?: string;
}

export interface ContentAutosaveStatus {
  enabled: boolean;
  intervalMs: number;
  slotCount: number;
  currentSlot: number;
  lastSavedAt?: string;
  nextScheduledAt?: string;
  lastError?: string;
  files: ContentAutosaveFileInfo[];
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

async function requestJson<T>(path: string, init?: RequestInit, options?: { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options?.timeoutMs ?? API_TIMEOUT_MS);
  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    throw new Error(isAbort
      ? 'Backend or content file storage is unavailable. Check /api/health.'
      : 'Backend or content file storage is unavailable. Check /api/health.');
  } finally {
    window.clearTimeout(timeout);
  }

  if (!res.ok) {
    const message = await readErrorMessage(res);
    throw new Error(message || 'Backend or content file storage is unavailable. Check /api/health.');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const raw = await res.text();
  if (!raw.trim()) {
    return undefined as T;
  }

  return JSON.parse(raw) as T;
}

function stringifyUpdatePayload(payload: unknown): string {
  return JSON.stringify(payload, (_key, value) => (value === undefined ? null : value));
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

export async function exportFullContent(): Promise<ContentBackupEnvelope> {
  await ensureContentBackendReady();
  return requestJson<ContentBackupEnvelope>('/content/export');
}

export async function getContentAutosaveStatus(): Promise<ContentAutosaveStatus> {
  await ensureContentBackendReady();
  return requestJson<ContentAutosaveStatus>('/content/autosave-status');
}

export async function triggerContentAutosave(): Promise<ContentAutosaveStatus> {
  await ensureContentBackendReady();
  return requestJson<ContentAutosaveStatus>('/content/autosave', {
    method: 'POST',
  });
}

export async function importFullContent(
  payload: Partial<ContentSnapshot> | ContentBackupEnvelope,
  mode: ContentImportMode = 'replace',
  options?: { dryRun?: boolean },
): Promise<ContentImportResult> {
  await ensureContentBackendReady();
  const result = await requestJson<ContentImportResult>('/content/import', {
    method: 'POST',
    body: JSON.stringify({ mode, dryRun: options?.dryRun, backup: payload }),
  });
  if (!result.dryRun) {
    notifyContentSync('all');
  }
  return result;
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

export async function getItemPreview(id: string, body?: ItemPreviewQueryBody): Promise<ItemPreviewResponse> {
  await ensureContentBackendReady();
  return requestJson<ItemPreviewResponse>(`/content/preview/item/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
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

export async function uploadContentImage(payload: Partial<StoredImage> & { folder?: string; dataUrl: string }): Promise<StoredImage> {
  await ensureContentBackendReady();
  const entry = await requestJson<StoredImage>('/content/images/upload', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, { timeoutMs: IMAGE_UPLOAD_TIMEOUT_MS });
  notifyContentSync('content');
  return entry;
}

export async function uploadContentAudioAsset(payload: { id?: string; name?: string; mimeType?: string; folder?: string; dataUrl: string }): Promise<{ assetId: string; publicUrl: string; mimeType: string }> {
  await ensureContentBackendReady();
  const entry = await requestJson<{ assetId: string; publicUrl: string; mimeType: string }>('/content/assets/audio/upload', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, { timeoutMs: IMAGE_UPLOAD_TIMEOUT_MS });
  notifyContentSync('content');
  return entry;
}

export async function writeStaticAudioFile(payload: { targetPath: string; dataUrl: string; mimeType?: string }): Promise<{ publicUrl: string; mimeType: string }> {
  await ensureContentBackendReady();
  return requestJson<{ publicUrl: string; mimeType: string }>('/content/assets/audio/static', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, { timeoutMs: IMAGE_UPLOAD_TIMEOUT_MS });
}

export async function listAudioAssets(): Promise<string[]> {
  await ensureContentBackendReady();
  return requestJson<string[]>('/content/assets/audio/list');
}

export async function updateContentEntry<T>(collection: ContentCollectionName, id: string, payload: Partial<T>): Promise<T> {
  await ensureContentBackendReady();
  const entry = await requestJson<T>(`/content/${collection}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: stringifyUpdatePayload(payload),
  });
  notifyContentSync('content');
  return entry;
}

export async function replaceProfessionSkillsCollection(
  skills: import('../../types/profession').ProfessionSkill[],
): Promise<import('../../types/profession').ProfessionSkill[]> {
  await ensureContentBackendReady();
  const entries = await requestJson<import('../../types/profession').ProfessionSkill[]>('/content/professionSkills/replace-all', {
    method: 'PUT',
    body: JSON.stringify({ skills }),
  });
  notifyContentSync('content');
  return entries;
}

export async function replaceContentImage(id: string, payload: Partial<StoredImage> & { dataUrl: string }): Promise<StoredImage> {
  await ensureContentBackendReady();
  const entry = await requestJson<StoredImage>(`/content/images/${encodeURIComponent(id)}/upload`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, { timeoutMs: IMAGE_UPLOAD_TIMEOUT_MS });
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
