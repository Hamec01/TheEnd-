import type { InventoryState } from '@theend/rpg-domain';
import { resolveCharacterScopedStorageKey } from '../services/characterScopedStorage';

export const PLAYER_GOLD_STORAGE_KEY = 'theend.player.gold';
export const PLAYER_ITEMS_STORAGE_KEY = 'theend.player.items';
export const PLAYER_QUEST_ITEMS_STORAGE_KEY = 'theend.player.questItems';
export const PLAYER_MATERIAL_IDS_STORAGE_KEY = 'theend.player.materialIds';
export const PLAYER_RESOURCE_IDS_STORAGE_KEY = 'theend.player.resourceIds';
export const PLAYER_MATERIALS_STORAGE_KEY = 'theend.player.materials';
export const PLAYER_RESOURCES_STORAGE_KEY = 'theend.player.resources';
export const PLAYER_FLAGS_STORAGE_KEY = 'theend.player.flags';
export const PLAYER_UNLOCKED_LOCATIONS_STORAGE_KEY = 'theend.player.unlockedLocations';
export const PLAYER_UNLOCKED_DIALOGUES_STORAGE_KEY = 'theend.player.unlockedDialogues';
export const PLAYER_UNLOCKED_SHOPS_STORAGE_KEY = 'theend.player.unlockedShops';

type UnknownRecord = Record<string, unknown>;

export interface NormalizedPlayerInventory {
  itemIds: string[];
  questItemIds: string[];
  materialIds: string[];
  resourceIds: string[];
  materials: Record<string, number>;
  resources: Record<string, number>;
}

function parseStorageValue(key: string): unknown {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(resolveCharacterScopedStorageKey(key));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function readStringArrayStorage(key: string): string[] {
  const parsed = parseStorageValue(key);
  return Array.isArray(parsed)
    ? parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
}

export function readStringNumberRecordStorage(key: string): Record<string, number> {
  const parsed = parseStorageValue(key);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const next: Record<string, number> = {};
  for (const [entryKey, entryValue] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof entryKey !== 'string' || !entryKey.trim()) {
      continue;
    }
    const numericValue = Number(entryValue);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      next[entryKey] = numericValue;
    }
  }

  return next;
}

export function writeStringArrayStorage(key: string, values: string[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    resolveCharacterScopedStorageKey(key),
    JSON.stringify(values.filter((value) => typeof value === 'string' && value.trim().length > 0)),
  );
}

export function writeStringNumberRecordStorage(key: string, values: Record<string, number>): void {
  if (typeof window === 'undefined') {
    return;
  }

  const next: Record<string, number> = {};
  for (const [entryKey, entryValue] of Object.entries(values)) {
    const numericValue = Number(entryValue);
    if (entryKey.trim() && Number.isFinite(numericValue) && numericValue > 0) {
      next[entryKey] = Math.floor(numericValue);
    }
  }

  window.localStorage.setItem(resolveCharacterScopedStorageKey(key), JSON.stringify(next));
}

export function readNumberStorage(key: string, fallback = 0): number {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(resolveCharacterScopedStorageKey(key));
  if (raw === null) {
    return fallback;
  }

  const numericValue = Number(raw);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function writeNumberStorage(key: string, value: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  const numericValue = Number(value);
  window.localStorage.setItem(resolveCharacterScopedStorageKey(key), String(Number.isFinite(numericValue) ? numericValue : 0));
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function normalizeStringNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const next: Record<string, number> = {};
  for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
    const numericValue = Number(entryValue);
    if (entryKey.trim() && Number.isFinite(numericValue) && numericValue > 0) {
      next[entryKey] = numericValue;
    }
  }
  return next;
}

export function normalizePlayerInventory(rawInventory: unknown): NormalizedPlayerInventory {
  const inventory = (rawInventory && typeof rawInventory === 'object'
    ? rawInventory as UnknownRecord
    : {}) as UnknownRecord;

  return {
    itemIds: normalizeStringArray(inventory.itemIds),
    questItemIds: normalizeStringArray(inventory.questItemIds),
    materialIds: normalizeStringArray(inventory.materialIds),
    resourceIds: normalizeStringArray(inventory.resourceIds),
    materials: normalizeStringNumberRecord(inventory.materials),
    resources: normalizeStringNumberRecord(inventory.resources),
  };
}

export function normalizeInventoryState(rawInventory: unknown): InventoryState {
  const inventory = (rawInventory && typeof rawInventory === 'object'
    ? rawInventory as UnknownRecord
    : {}) as UnknownRecord;

  const rawItems = Array.isArray(inventory.items) ? inventory.items : [];
  const items = rawItems
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const itemId = typeof record.itemId === 'string' ? record.itemId.trim() : '';
      const quantity = Number(record.quantity);
      if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
        return null;
      }
      return { itemId, quantity };
    })
    .filter((entry): entry is { itemId: string; quantity: number } => Boolean(entry));

  const gold = Number(inventory.gold);

  return {
    gold: Number.isFinite(gold) ? gold : 0,
    items,
  };
}

export function mergeInventoryWithRuntimeOverlay(baseInventory: InventoryState): InventoryState {
  const normalizedBase = normalizeInventoryState(baseInventory);
  const runtimeItemIds = readStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY);
  const runtimeGold = Math.max(0, readNumberStorage(PLAYER_GOLD_STORAGE_KEY, 0));

  const quantityByItemId = new Map<string, number>();
  for (const entry of normalizedBase.items) {
    quantityByItemId.set(entry.itemId, (quantityByItemId.get(entry.itemId) ?? 0) + entry.quantity);
  }
  for (const itemId of runtimeItemIds) {
    quantityByItemId.set(itemId, (quantityByItemId.get(itemId) ?? 0) + 1);
  }

  return {
    gold: Math.max(0, normalizedBase.gold) + runtimeGold,
    items: Array.from(quantityByItemId.entries())
      .filter(([, quantity]) => quantity > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity })),
  };
}
