import type { AdminItem, ItemInstance } from './content/models';
import { resolveCharacterScopedStorageKey } from './characterScopedStorage';
import { nowIso, uid } from './content/storage';
import { PLAYER_ITEM_INSTANCES_STORAGE_KEY } from '../utils/playerInventory';

export const PLAYER_RUNTIME_ITEM_TAG = 'runtime_instance';
export const PLAYER_HIDDEN_RUNTIME_ITEM_TAG = 'player_runtime_hidden';

function normalizeItemSnapshot(raw: unknown): AdminItem | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!id || !name) {
    return undefined;
  }
  return record as unknown as AdminItem;
}

function readRaw(): unknown {
  if (typeof window === 'undefined') {
    return [];
  }
  const raw = window.localStorage.getItem(resolveCharacterScopedStorageKey(PLAYER_ITEM_INSTANCES_STORAGE_KEY));
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function normalizeInstance(raw: unknown): ItemInstance | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const itemId = typeof record.itemId === 'string' ? record.itemId.trim() : '';
  if (!id || !itemId) {
    return null;
  }
  return {
    id,
    itemId,
    ownerId: typeof record.ownerId === 'string' ? record.ownerId.trim() : undefined,
    sourceItemId: typeof record.sourceItemId === 'string' ? record.sourceItemId.trim() : undefined,
    itemSnapshot: normalizeItemSnapshot(record.itemSnapshot),
    customName: typeof record.customName === 'string' ? record.customName : undefined,
    statOverrides: record.statOverrides && typeof record.statOverrides === 'object' && !Array.isArray(record.statOverrides)
      ? (record.statOverrides as ItemInstance['statOverrides'])
      : undefined,
    qualityTierId: typeof record.qualityTierId === 'string' ? record.qualityTierId.trim() : undefined,
    forgeScore: typeof record.forgeScore === 'number' && Number.isFinite(record.forgeScore) ? record.forgeScore : undefined,
    craftedFromTemplateId: typeof record.craftedFromTemplateId === 'string' ? record.craftedFromTemplateId.trim() : undefined,
    craftedMaterialIds: Array.isArray(record.craftedMaterialIds)
      ? record.craftedMaterialIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : undefined,
    craftedByProfession:
      record.craftedByProfession === 'blacksmithing' || record.craftedByProfession === 'carpenter'
        ? record.craftedByProfession
        : undefined,
    carpenterComponent: record.carpenterComponent && typeof record.carpenterComponent === 'object' && !Array.isArray(record.carpenterComponent)
      ? (record.carpenterComponent as ItemInstance['carpenterComponent'])
      : undefined,
    carpenterComponentsUsed: Array.isArray(record.carpenterComponentsUsed)
      ? record.carpenterComponentsUsed.filter((entry): entry is NonNullable<ItemInstance['carpenterComponentsUsed']>[number] => (
        Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      ))
      : undefined,
    tags: Array.isArray(record.tags)
      ? record.tags.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : undefined,
    notes: typeof record.notes === 'string' ? record.notes : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : nowIso(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : nowIso(),
  };
}

function writeAll(instances: ItemInstance[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(resolveCharacterScopedStorageKey(PLAYER_ITEM_INSTANCES_STORAGE_KEY), JSON.stringify(instances));
}

export function readPlayerItemInstances(): ItemInstance[] {
  const parsed = readRaw();
  return Array.isArray(parsed)
    ? parsed.map(normalizeInstance).filter((entry): entry is ItemInstance => Boolean(entry))
    : [];
}

export function getPlayerItemInstanceByItemId(itemId: string): ItemInstance | null {
  const normalizedItemId = String(itemId ?? '').trim();
  if (!normalizedItemId) {
    return null;
  }
  return readPlayerItemInstances().find((entry) => entry.itemId === normalizedItemId) ?? null;
}

export function upsertPlayerItemInstance(
  patch: Partial<ItemInstance> & Pick<ItemInstance, 'itemId'>,
): ItemInstance {
  const all = readPlayerItemInstances();
  const normalizedItemId = String(patch.itemId ?? '').trim();
  const existingIndex = all.findIndex((entry) => entry.itemId === normalizedItemId || (patch.id && entry.id === patch.id));
  const timestamp = nowIso();

  if (existingIndex >= 0) {
    const existing = all[existingIndex]!;
    const next: ItemInstance = {
      ...existing,
      ...patch,
      id: String((patch.id ?? existing.id) || existing.id).trim() || existing.id,
      itemId: normalizedItemId || existing.itemId,
      itemSnapshot: normalizeItemSnapshot(patch.itemSnapshot) ?? existing.itemSnapshot,
      statOverrides: patch.statOverrides ?? existing.statOverrides,
      updatedAt: timestamp,
    };
    all[existingIndex] = next;
    writeAll(all);
    return next;
  }

  const created: ItemInstance = {
    id: String(patch.id ?? uid('iteminst')).trim() || uid('iteminst'),
    itemId: normalizedItemId,
    ownerId: patch.ownerId?.trim() || undefined,
    sourceItemId: patch.sourceItemId?.trim() || undefined,
    itemSnapshot: normalizeItemSnapshot(patch.itemSnapshot),
    customName: patch.customName,
    statOverrides: patch.statOverrides,
    qualityTierId: patch.qualityTierId?.trim() || undefined,
    forgeScore: patch.forgeScore,
    craftedFromTemplateId: patch.craftedFromTemplateId?.trim() || undefined,
    craftedMaterialIds: patch.craftedMaterialIds?.filter((entry) => typeof entry === 'string' && entry.trim().length > 0),
    craftedByProfession: patch.craftedByProfession,
    carpenterComponent: patch.carpenterComponent,
    carpenterComponentsUsed: patch.carpenterComponentsUsed,
    tags: patch.tags?.filter((entry) => typeof entry === 'string' && entry.trim().length > 0),
    notes: patch.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  all.push(created);
  writeAll(all);
  return created;
}

export function removePlayerItemInstanceByItemId(itemId: string): void {
  const normalizedItemId = String(itemId ?? '').trim();
  if (!normalizedItemId) {
    return;
  }
  writeAll(readPlayerItemInstances().filter((entry) => entry.itemId !== normalizedItemId));
}

export function isRuntimeItemDefinition(item: AdminItem | null | undefined): boolean {
  if (!item) {
    return false;
  }
  const tags = new Set(item.tags ?? []);
  return tags.has(PLAYER_RUNTIME_ITEM_TAG) || tags.has(PLAYER_HIDDEN_RUNTIME_ITEM_TAG);
}

export function resolveEffectiveAdminItem(
  itemId: string,
  adminItems: AdminItem[],
  instances: ItemInstance[] = readPlayerItemInstances(),
): AdminItem | null {
  const normalizedItemId = String(itemId ?? '').trim();
  const normalizedItemIdLower = normalizedItemId.toLowerCase();
  if (!normalizedItemId) {
    return null;
  }
  const instance = instances.find((entry) => String(entry.itemId ?? '').trim().toLowerCase() === normalizedItemIdLower) ?? null;
  const direct = adminItems.find((entry) => String(entry.id ?? '').trim().toLowerCase() === normalizedItemIdLower && entry.isEnabled !== false) ?? null;
  const sourced = instance?.sourceItemId
    ? adminItems.find((entry) => String(entry.id ?? '').trim().toLowerCase() === String(instance.sourceItemId ?? '').trim().toLowerCase() && entry.isEnabled !== false) ?? null
    : null;
  const seed = instance?.itemSnapshot && instance.itemSnapshot.isEnabled !== false
    ? instance.itemSnapshot
    : direct ?? sourced;

  if (!seed) {
    return null;
  }

  const bonuses = instance?.statOverrides?.bonuses
    ? {
      ...(seed.bonuses ?? {}),
      ...instance.statOverrides.bonuses,
    }
    : seed.bonuses;

  return {
    ...seed,
    id: normalizedItemId,
    name: instance?.customName?.trim() || seed.name,
    damageMin: instance?.statOverrides?.damageMin ?? seed.damageMin,
    damageMax: instance?.statOverrides?.damageMax ?? seed.damageMax,
    armorValue: instance?.statOverrides?.armorValue ?? seed.armorValue,
    price: instance?.statOverrides?.price ?? seed.price,
    attackRange: instance?.statOverrides?.attackRange ?? seed.attackRange,
    pierceTargets: instance?.statOverrides?.pierceTargets ?? seed.pierceTargets,
    splashRadius: instance?.statOverrides?.splashRadius ?? seed.splashRadius,
    splashCenterMultiplier: instance?.statOverrides?.splashCenterMultiplier ?? seed.splashCenterMultiplier,
    splashOuterMultiplier: instance?.statOverrides?.splashOuterMultiplier ?? seed.splashOuterMultiplier,
    bonuses,
    equipmentEffects: instance?.statOverrides?.equipmentEffects ?? seed.equipmentEffects,
    augmentSlots: instance?.statOverrides?.augmentSlots ?? seed.augmentSlots,
    maxAugmentSlots: instance?.statOverrides?.maxAugmentSlots ?? seed.maxAugmentSlots,
    canAddAugmentSlots: instance?.statOverrides?.canAddAugmentSlots ?? seed.canAddAugmentSlots,
    canHaveRuneComplex: instance?.statOverrides?.canHaveRuneComplex ?? seed.canHaveRuneComplex,
    tags: Array.from(new Set([...(seed.tags ?? []), ...(instance?.tags ?? [])])),
  };
}

export function buildEffectiveAdminItems(
  adminItems: AdminItem[],
  instances: ItemInstance[] = readPlayerItemInstances(),
): AdminItem[] {
  const byId = new Map(adminItems.map((entry) => [entry.id, entry] as const));
  for (const instance of instances) {
    const effective = resolveEffectiveAdminItem(instance.itemId, adminItems, instances);
    if (effective) {
      byId.set(instance.itemId, effective);
    }
  }
  return Array.from(byId.values());
}
