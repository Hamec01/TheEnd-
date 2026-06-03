import type { CraftingRecipe } from '../../services/content/models';
import {
  PLAYER_ITEMS_STORAGE_KEY,
  PLAYER_MATERIAL_IDS_STORAGE_KEY,
  PLAYER_MATERIALS_STORAGE_KEY,
  PLAYER_RESOURCE_IDS_STORAGE_KEY,
  PLAYER_RESOURCES_STORAGE_KEY,
  readStringArrayStorage,
  readStringNumberRecordStorage,
  writeStringArrayStorage,
  writeStringNumberRecordStorage,
} from '../../utils/playerInventory';

export interface RecipeMaterialNeed {
  catalogId: string;
  quantity: number;
  source: 'material' | 'item';
}

export interface RecipeMaterialShortage {
  catalogId: string;
  required: number;
  available: number;
  source: 'material' | 'item';
}

function normalizeMaterialLikeId(id: string): string[] {
  const probe = String(id ?? '').trim();
  if (!probe) {
    return [];
  }
  const strippedItem = probe.replace(/^item_/, '');
  const strippedMaterial = probe.replace(/^mat_/, '');
  const base = strippedItem.replace(/^mat_/, '') || strippedMaterial.replace(/^item_/, '') || probe;
  const out = new Set<string>([
    probe,
    strippedItem,
    strippedMaterial,
    base,
    `item_${base}`,
    `mat_${base}`,
  ]);
  return Array.from(out).filter(Boolean);
}

export function readPlayerMaterialQuantities(): Map<string, number> {
  const quantityById = new Map<string, number>();
  const increment = (id: string, qty: number) => {
    const normalizedId = String(id ?? '').trim();
    if (!normalizedId || qty <= 0) {
      return;
    }
    quantityById.set(normalizedId, (quantityById.get(normalizedId) ?? 0) + qty);
  };

  for (const id of readStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY)) {
    increment(id, 1);
  }
  for (const id of readStringArrayStorage(PLAYER_MATERIAL_IDS_STORAGE_KEY)) {
    increment(id, 1);
  }
  for (const id of readStringArrayStorage(PLAYER_RESOURCE_IDS_STORAGE_KEY)) {
    increment(id, 1);
  }
  for (const [id, qty] of Object.entries(readStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY))) {
    increment(id, qty);
  }
  for (const [id, qty] of Object.entries(readStringNumberRecordStorage(PLAYER_RESOURCES_STORAGE_KEY))) {
    increment(id, qty);
  }

  return quantityById;
}

export function resolveRecipeMaterialNeeds(recipe: CraftingRecipe | null): RecipeMaterialNeed[] {
  if (!recipe) {
    return [];
  }

  const needs = new Map<string, RecipeMaterialNeed>();
  const addNeed = (catalogId: string, quantity: number, source: 'material' | 'item') => {
    const normalizedId = String(catalogId ?? '').trim();
    const normalizedQty = Math.max(1, Math.floor(quantity));
    if (!normalizedId || normalizedQty <= 0) {
      return;
    }
    const key = `${source}:${normalizedId}`;
    const existing = needs.get(key);
    if (existing) {
      existing.quantity += normalizedQty;
      return;
    }
    needs.set(key, { catalogId: normalizedId, quantity: normalizedQty, source });
  };

  for (const entry of recipe.inputMaterials ?? []) {
    addNeed(entry.materialId, entry.quantity ?? 1, 'material');
  }
  for (const entry of recipe.inputItems ?? []) {
    addNeed(entry.itemId, entry.quantity ?? 1, 'item');
  }

  return Array.from(needs.values());
}

function availableForCatalog(catalogId: string, quantities: Map<string, number>): number {
  return normalizeMaterialLikeId(catalogId).reduce((max, candidate) => Math.max(max, quantities.get(candidate) ?? 0), 0);
}

export function getRecipeMaterialShortages(recipe: CraftingRecipe | null): RecipeMaterialShortage[] {
  const quantities = readPlayerMaterialQuantities();
  const shortages: RecipeMaterialShortage[] = [];

  for (const need of resolveRecipeMaterialNeeds(recipe)) {
    const available = availableForCatalog(need.catalogId, quantities);
    if (available < need.quantity) {
      shortages.push({
        catalogId: need.catalogId,
        required: need.quantity,
        available,
        source: need.source,
      });
    }
  }

  return shortages;
}

export function canAffordRecipeMaterials(recipe: CraftingRecipe | null): boolean {
  return getRecipeMaterialShortages(recipe).length === 0;
}

export function consumeRecipeMaterials(recipe: CraftingRecipe | null): boolean {
  const shortages = getRecipeMaterialShortages(recipe);
  if (shortages.length > 0) {
    return false;
  }

  const quantities = readPlayerMaterialQuantities();
  const itemIds = readStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY);
  const materialIds = readStringArrayStorage(PLAYER_MATERIAL_IDS_STORAGE_KEY);
  const resourceIds = readStringArrayStorage(PLAYER_RESOURCE_IDS_STORAGE_KEY);
  const materialMap = { ...readStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY) };
  const resourceMap = { ...readStringNumberRecordStorage(PLAYER_RESOURCES_STORAGE_KEY) };

  const takeFromRecord = (record: Record<string, number>, catalogId: string, amount: number): number => {
    let remaining = amount;
    for (const candidate of normalizeMaterialLikeId(catalogId)) {
      const current = record[candidate] ?? 0;
      if (current <= 0) {
        continue;
      }
      const used = Math.min(current, remaining);
      const next = current - used;
      if (next > 0) {
        record[candidate] = next;
      } else {
        delete record[candidate];
      }
      remaining -= used;
      if (remaining <= 0) {
        return 0;
      }
    }
    return remaining;
  };

  const takeFromIdList = (ids: string[], catalogId: string, amount: number): { ids: string[]; remaining: number } => {
    let remaining = amount;
    const candidates = new Set(normalizeMaterialLikeId(catalogId));
    const nextIds = [...ids];
    for (let index = nextIds.length - 1; index >= 0 && remaining > 0; index -= 1) {
      if (!candidates.has(nextIds[index])) {
        continue;
      }
      nextIds.splice(index, 1);
      remaining -= 1;
    }
    return { ids: nextIds, remaining };
  };

  for (const need of resolveRecipeMaterialNeeds(recipe)) {
    let remaining = need.quantity;

    if (need.source === 'material') {
      remaining = takeFromRecord(materialMap, need.catalogId, remaining);
      remaining = takeFromRecord(resourceMap, need.catalogId, remaining);
    }

    if (remaining > 0) {
      const itemResult = takeFromIdList(itemIds, need.catalogId, remaining);
      itemIds.splice(0, itemIds.length, ...itemResult.ids);
      remaining = itemResult.remaining;
    }
    if (remaining > 0) {
      const materialResult = takeFromIdList(materialIds, need.catalogId, remaining);
      materialIds.splice(0, materialIds.length, ...materialResult.ids);
      remaining = materialResult.remaining;
    }
    if (remaining > 0) {
      const resourceResult = takeFromIdList(resourceIds, need.catalogId, remaining);
      resourceIds.splice(0, resourceIds.length, ...resourceResult.ids);
      remaining = resourceResult.remaining;
    }

    if (remaining > 0) {
      return false;
    }
  }

  writeStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY, itemIds);
  writeStringArrayStorage(PLAYER_MATERIAL_IDS_STORAGE_KEY, materialIds);
  writeStringArrayStorage(PLAYER_RESOURCE_IDS_STORAGE_KEY, resourceIds);
  writeStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY, materialMap);
  writeStringNumberRecordStorage(PLAYER_RESOURCES_STORAGE_KEY, resourceMap);
  return true;
}
