import type { InventoryItem, InventoryState } from '@theend/rpg-domain';
import type { AdminItem } from './content/models';
import { resolveCharacterScopedStorageKey } from './characterScopedStorage';
import { getMaxDurability, getProfessionItemKind } from './professionItemModule';
import {
  PLAYER_ITEMS_STORAGE_KEY,
  PLAYER_INVENTORY_REMOVALS_STORAGE_KEY,
  readStringArrayStorage,
  readStringNumberRecordStorage,
  writeStringArrayStorage,
  writeStringNumberRecordStorage,
} from '../utils/playerInventory';

const CARPENTER_TOOL_INSTANCES_KEY = 'theend.player.carpenterToolInstances';
const INSTANCE_PREFIX = 'carpentry_tool:';

export interface CarpenterToolInstanceRecord {
  templateId: string;
  durability: number;
  maxDurability: number;
}

function readInstances(characterId: string): Record<string, CarpenterToolInstanceRecord> {
  if (typeof window === 'undefined' || !characterId.trim()) {
    return {};
  }
  const raw = window.localStorage.getItem(resolveCharacterScopedStorageKey(CARPENTER_TOOL_INSTANCES_KEY));
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, CarpenterToolInstanceRecord> = {};
    for (const [instanceId, value] of Object.entries(parsed)) {
      if (!instanceId.startsWith(INSTANCE_PREFIX) || !value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }
      const record = value as Record<string, unknown>;
      const templateId = String(record.templateId ?? '').trim();
      const durability = Number(record.durability);
      const maxDurability = Number(record.maxDurability);
      if (!templateId || !Number.isFinite(durability) || !Number.isFinite(maxDurability)) {
        continue;
      }
      next[instanceId] = {
        templateId,
        durability: Math.max(0, Math.floor(durability)),
        maxDurability: Math.max(1, Math.floor(maxDurability)),
      };
    }
    return next;
  } catch {
    return {};
  }
}

function writeInstances(characterId: string, instances: Record<string, CarpenterToolInstanceRecord>): void {
  if (typeof window === 'undefined' || !characterId.trim()) {
    return;
  }
  window.localStorage.setItem(
    resolveCharacterScopedStorageKey(CARPENTER_TOOL_INSTANCES_KEY),
    JSON.stringify(instances),
  );
}

function readLegacyDurability(characterId: string, templateId: string): number | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const key = `theend.tool_durability.${characterId}.${templateId}`;
  const stored = window.localStorage.getItem(key);
  if (stored === null) {
    return null;
  }
  const parsed = Number.parseInt(stored, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  window.localStorage.removeItem(key);
  return Math.max(0, parsed);
}

function createInstanceId(templateId: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${INSTANCE_PREFIX}${templateId}:${suffix}`;
}

export function isCarpenterToolInstanceId(itemId: string): boolean {
  return String(itemId ?? '').startsWith(INSTANCE_PREFIX);
}

export function isNonStackableProfessionTool(adminItem: AdminItem | null | undefined): boolean {
  if (!adminItem) {
    return false;
  }
  const kind = getProfessionItemKind(adminItem);
  if (kind === 'tool' || kind === 'transport') {
    return true;
  }
  return adminItem.type === 'profession_tool' || adminItem.type === 'profession_transport';
}

export function resolveProfessionToolTemplateId(
  itemId: string,
  characterId: string,
): string {
  const normalized = String(itemId ?? '').trim();
  if (!isCarpenterToolInstanceId(normalized)) {
    return normalized;
  }
  return readInstances(characterId)[normalized]?.templateId ?? normalized;
}

export function registerCarpenterToolInstance(
  characterId: string,
  templateId: string,
  maxDurability: number,
  initialDurability?: number,
): string {
  const normalizedTemplateId = String(templateId ?? '').trim();
  const max = Math.max(1, Math.floor(maxDurability));
  const legacyDurability = initialDurability ?? readLegacyDurability(characterId, normalizedTemplateId);
  const durability = legacyDurability ?? max;
  const instanceId = createInstanceId(normalizedTemplateId);
  const instances = readInstances(characterId);
  instances[instanceId] = {
    templateId: normalizedTemplateId,
    durability: Math.max(0, Math.min(max, Math.floor(durability))),
    maxDurability: max,
  };
  writeInstances(characterId, instances);
  return instanceId;
}

export function getCarpenterToolDurability(
  itemId: string,
  characterId: string,
  fallbackMaxDurability: number,
): number {
  const normalized = String(itemId ?? '').trim();
  if (!isCarpenterToolInstanceId(normalized)) {
    if (typeof window === 'undefined') {
      return fallbackMaxDurability;
    }
    const legacyKey = `theend.tool_durability.${characterId}.${normalized}`;
    const stored = window.localStorage.getItem(legacyKey);
    if (stored === null) {
      return fallbackMaxDurability;
    }
    const parsed = Number.parseInt(stored, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallbackMaxDurability;
  }
  const record = readInstances(characterId)[normalized];
  if (!record) {
    return fallbackMaxDurability;
  }
  return Math.max(0, Math.min(record.maxDurability, record.durability));
}

export function setCarpenterToolDurability(
  itemId: string,
  characterId: string,
  durability: number,
  maxDurability?: number,
): void {
  const normalized = String(itemId ?? '').trim();
  if (!isCarpenterToolInstanceId(normalized)) {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      `theend.tool_durability.${characterId}.${normalized}`,
      String(Math.max(0, Math.floor(durability))),
    );
    return;
  }
  const instances = readInstances(characterId);
  const record = instances[normalized];
  if (!record) {
    return;
  }
  const max = Math.max(1, Math.floor(maxDurability ?? record.maxDurability));
  instances[normalized] = {
    ...record,
    maxDurability: max,
    durability: Math.max(0, Math.min(max, Math.floor(durability))),
  };
  writeInstances(characterId, instances);
}

export function removeCarpenterToolInstance(itemId: string, characterId: string): void {
  const normalized = String(itemId ?? '').trim();
  if (!normalized) {
    return;
  }
  if (isCarpenterToolInstanceId(normalized)) {
    const instances = readInstances(characterId);
    delete instances[normalized];
    writeInstances(characterId, instances);
    return;
  }
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(`theend.tool_durability.${characterId}.${normalized}`);
  }
}

function addPersistedInventoryRemoval(templateId: string, quantity: number): void {
  const normalizedTemplateId = String(templateId ?? '').trim();
  const amount = Math.max(0, Math.floor(quantity));
  if (!normalizedTemplateId || amount <= 0) {
    return;
  }
  const persisted = readStringNumberRecordStorage(PLAYER_INVENTORY_REMOVALS_STORAGE_KEY);
  persisted[normalizedTemplateId] = (persisted[normalizedTemplateId] ?? 0) + amount;
  writeStringNumberRecordStorage(PLAYER_INVENTORY_REMOVALS_STORAGE_KEY, persisted);
}

function rebuildRuntimeToolEntries(
  expandedItems: InventoryItem[],
  characterId: string,
  resolveAdminItem: (itemId: string) => AdminItem | null,
): void {
  const runtimeItems = readStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY);
  const nonToolRuntime = runtimeItems.filter((itemId) => {
    const templateId = resolveProfessionToolTemplateId(itemId, characterId);
    const adminItem = resolveAdminItem(templateId);
    return !isNonStackableProfessionTool(adminItem);
  });
  const toolInstanceIds = expandedItems
    .map((entry) => entry.itemId)
    .filter((itemId) => {
      if (!isCarpenterToolInstanceId(itemId)) {
        return false;
      }
      const templateId = resolveProfessionToolTemplateId(itemId, characterId);
      return isNonStackableProfessionTool(resolveAdminItem(templateId));
    });
  writeStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY, [...nonToolRuntime, ...toolInstanceIds]);
}

export function normalizeProfessionToolInventory(
  inventory: InventoryState,
  characterId: string,
  resolveAdminItem: (itemId: string) => AdminItem | null,
): InventoryState {
  if (!characterId.trim()) {
    return inventory;
  }

  const expandedItems: InventoryItem[] = [];
  let changed = false;

  for (const entry of inventory.items) {
    const templateId = resolveProfessionToolTemplateId(entry.itemId, characterId);
    const adminItem = resolveAdminItem(templateId);
    if (!isNonStackableProfessionTool(adminItem)) {
      expandedItems.push(entry);
      continue;
    }

    const count = Math.max(0, Math.floor(entry.quantity));
    if (count <= 0) {
      continue;
    }

    if (isCarpenterToolInstanceId(entry.itemId) && count === 1) {
      const maxDurability = getMaxDurability(adminItem) ?? 100;
      const instances = readInstances(characterId);
      if (!instances[entry.itemId]) {
        instances[entry.itemId] = {
          templateId,
          durability: readLegacyDurability(characterId, templateId) ?? maxDurability,
          maxDurability,
        };
        writeInstances(characterId, instances);
        changed = true;
      }
      expandedItems.push({ itemId: entry.itemId, quantity: 1 });
      continue;
    }

    changed = true;
    addPersistedInventoryRemoval(templateId, count);
    for (let index = 0; index < count; index += 1) {
      const legacyDurability = index === 0 && !isCarpenterToolInstanceId(entry.itemId)
        ? readLegacyDurability(characterId, templateId)
        : null;
      const instanceId = registerCarpenterToolInstance(
        characterId,
        templateId,
        getMaxDurability(adminItem) ?? 100,
        legacyDurability ?? undefined,
      );
      expandedItems.push({ itemId: instanceId, quantity: 1 });
    }
  }

  if (changed) {
    rebuildRuntimeToolEntries(expandedItems, characterId, resolveAdminItem);
  }

  return {
    ...inventory,
    items: expandedItems,
  };
}

export function addProfessionToolToRuntimeInventory(
  characterId: string,
  templateId: string,
  resolveAdminItem: (itemId: string) => AdminItem | null,
  quantity = 1,
): string[] {
  const adminItem = resolveAdminItem(templateId);
  const amount = Math.max(1, Math.floor(quantity));
  const created: string[] = [];
  const runtimeItems = readStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY);

  if (!isNonStackableProfessionTool(adminItem)) {
    for (let index = 0; index < amount; index += 1) {
      runtimeItems.push(templateId);
    }
    writeStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY, runtimeItems);
    return Array.from({ length: amount }, () => templateId);
  }

  for (let index = 0; index < amount; index += 1) {
    const instanceId = registerCarpenterToolInstance(
      characterId,
      templateId,
      getMaxDurability(adminItem) ?? 100,
    );
    created.push(instanceId);
    runtimeItems.push(instanceId);
  }
  writeStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY, runtimeItems);
  return created;
}

export function removeProfessionToolFromRuntimeInventory(
  characterId: string,
  itemId: string,
  quantity = 1,
): void {
  const normalized = String(itemId ?? '').trim();
  const amount = Math.max(1, Math.floor(quantity));
  const runtimeItems = readStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY);
  const nextItems = [...runtimeItems];

  for (let index = 0; index < amount; index += 1) {
    const targetId = isCarpenterToolInstanceId(normalized)
      ? normalized
      : nextItems.find((entry) => resolveProfessionToolTemplateId(entry, characterId) === normalized);
    if (!targetId) {
      break;
    }
    const removeIndex = nextItems.indexOf(targetId);
    if (removeIndex === -1) {
      break;
    }
    nextItems.splice(removeIndex, 1);
    removeCarpenterToolInstance(targetId, characterId);
  }

  writeStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY, nextItems);
}
