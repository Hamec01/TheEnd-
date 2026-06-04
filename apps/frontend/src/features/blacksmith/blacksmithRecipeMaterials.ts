import type { InventoryState } from '@theend/rpg-domain';
import { adjustDevInventoryItem } from '../../api';
import type { AdminItem, BlacksmithQualityTier, CraftingRecipe, Material } from '../../services/content/models';
import { itemsService } from '../../services/content/itemsService';
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

export function normalizeMaterialLikeId(id: string): string[] {
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

export function readPlayerMaterialQuantities(baseInventory?: InventoryState | null): Map<string, number> {
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
  for (const entry of baseInventory?.items ?? []) {
    increment(entry.itemId, Math.max(0, Math.floor(Number(entry.quantity) || 0)));
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

export function getRecipeMaterialShortages(recipe: CraftingRecipe | null, baseInventory?: InventoryState | null): RecipeMaterialShortage[] {
  const quantities = readPlayerMaterialQuantities(baseInventory);
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

export function canAffordRecipeMaterialsWithInventory(recipe: CraftingRecipe | null, baseInventory?: InventoryState | null): boolean {
  return getRecipeMaterialShortages(recipe, baseInventory).length === 0;
}

export function consumeRecipeMaterials(
  recipe: CraftingRecipe | null,
  baseInventory?: InventoryState | null,
): { ok: boolean; inventory?: InventoryState } {
  const shortages = getRecipeMaterialShortages(recipe, baseInventory);
  if (shortages.length > 0) {
    return { ok: false };
  }

  const itemIds = readStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY);
  const materialIds = readStringArrayStorage(PLAYER_MATERIAL_IDS_STORAGE_KEY);
  const resourceIds = readStringArrayStorage(PLAYER_RESOURCE_IDS_STORAGE_KEY);
  const materialMap = { ...readStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY) };
  const resourceMap = { ...readStringNumberRecordStorage(PLAYER_RESOURCES_STORAGE_KEY) };
  const nextInventoryItems = [...(baseInventory?.items ?? [])];

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

  const takeFromInventory = (
    entries: Array<{ itemId: string; quantity: number }>,
    catalogId: string,
    amount: number,
  ): { items: Array<{ itemId: string; quantity: number }>; remaining: number } => {
    let remaining = amount;
    const candidates = new Set(normalizeMaterialLikeId(catalogId));
    const nextItems = [...entries];

    for (let index = nextItems.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const entry = nextItems[index];
      if (!candidates.has(entry.itemId)) {
        continue;
      }
      const used = Math.min(entry.quantity, remaining);
      const nextQuantity = entry.quantity - used;
      if (nextQuantity > 0) {
        nextItems[index] = { ...entry, quantity: nextQuantity };
      } else {
        nextItems.splice(index, 1);
      }
      remaining -= used;
    }

    return { items: nextItems, remaining };
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
    if (remaining > 0 && nextInventoryItems.length > 0) {
      const inventoryResult = takeFromInventory(nextInventoryItems, need.catalogId, remaining);
      nextInventoryItems.splice(0, nextInventoryItems.length, ...inventoryResult.items);
      remaining = inventoryResult.remaining;
    }

    if (remaining > 0) {
      return { ok: false };
    }
  }

  writeStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY, itemIds);
  writeStringArrayStorage(PLAYER_MATERIAL_IDS_STORAGE_KEY, materialIds);
  writeStringArrayStorage(PLAYER_RESOURCE_IDS_STORAGE_KEY, resourceIds);
  writeStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY, materialMap);
  writeStringNumberRecordStorage(PLAYER_RESOURCES_STORAGE_KEY, resourceMap);
  return {
    ok: true,
    inventory: baseInventory ? { ...baseInventory, items: nextInventoryItems } : undefined,
  };
}

export function grantRecipeOutputs(
  recipe: CraftingRecipe | null,
  baseInventory?: InventoryState | null,
): { inventory?: InventoryState } {
  const materialMap = { ...readStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY) };
  const nextInventoryItems = [...(baseInventory?.items ?? [])];

  for (const entry of recipe?.outputMaterials ?? []) {
    const materialId = String(entry.materialId ?? '').trim();
    const quantity = Math.max(0, Math.floor(Number(entry.quantity ?? 0) || 0));
    if (!materialId || quantity <= 0) {
      continue;
    }
    materialMap[materialId] = Math.max(0, Math.floor(Number(materialMap[materialId] ?? 0))) + quantity;
  }

  for (const entry of recipe?.outputItems ?? []) {
    const itemId = String(entry.itemId ?? '').trim();
    const quantity = Math.max(0, Math.floor(Number(entry.quantity ?? 0) || 0));
    if (!itemId || quantity <= 0) {
      continue;
    }
    const existingIndex = nextInventoryItems.findIndex((row) => row.itemId === itemId);
    if (existingIndex >= 0) {
      const current = nextInventoryItems[existingIndex]!;
      nextInventoryItems[existingIndex] = {
        ...current,
        quantity: Math.max(0, Math.floor(Number(current.quantity) || 0)) + quantity,
      };
      continue;
    }
    nextInventoryItems.push({ itemId, quantity });
  }

  writeStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY, materialMap);
  return {
    inventory: baseInventory ? { ...baseInventory, items: nextInventoryItems } : undefined,
  };
}

function sanitizeIdFragment(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function createForgedRuntimeItemId(baseItemId: string, recipeId: string): string {
  const base = sanitizeIdFragment(baseItemId) || 'item';
  const recipe = sanitizeIdFragment(recipeId) || 'recipe';
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  return `crafted_${base}_${recipe}_${uuid}`;
}

function roundScaled(value: number, multiplier: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  if (value === 0) {
    return 0;
  }
  const scaled = value * multiplier;
  return value > 0
    ? Math.max(1, Math.round(scaled))
    : Math.min(-1, Math.round(scaled));
}

function scaleStatRecord(record: Record<string, number> | undefined, multiplier: number): Record<string, number> {
  if (!record) {
    return {};
  }

  const scaledEntries = Object.entries(record)
    .map(([key, value]) => [key, roundScaled(Number(value) || 0, multiplier)] as const)
    .filter(([, value]) => value !== 0);

  return Object.fromEntries(scaledEntries);
}

function shouldCreateForgedVariant(item: AdminItem | null): boolean {
  if (!item || item.stackable) {
    return false;
  }
  return item.type === 'weapon' || item.type === 'armor';
}

function createForgedItemFromBase(
  baseItem: AdminItem,
  recipe: CraftingRecipe,
  qualityTier: BlacksmithQualityTier | null,
  characterId: string,
): Omit<AdminItem, 'createdAt' | 'updatedAt'> {
  const multiplier = Math.max(1, Number(qualityTier?.statMultiplier ?? 1) || 1);
  const qualityLabel = String(qualityTier?.name ?? 'Кованый').trim();
  const qualityId = String(qualityTier?.id ?? 'quality_normal').trim();
  const craftedId = createForgedRuntimeItemId(baseItem.id, recipe.id);
  const priceMultiplier = Math.max(1, Number(qualityTier?.priceMultiplier ?? 1) || 1);
  const damageMin = typeof baseItem.damageMin === 'number'
    ? roundScaled(baseItem.damageMin, multiplier)
    : undefined;
  const damageMax = typeof baseItem.damageMax === 'number'
    ? Math.max(damageMin ?? 0, roundScaled(baseItem.damageMax, multiplier))
    : undefined;
  const qualityDescription = [
    baseItem.gameplayDescription?.trim(),
    `Кузнечная работа: ${qualityLabel}.`,
    `Источник: ${recipe.name}.`,
    `Мастер: ${characterId}.`,
  ].filter(Boolean).join(' ');

  return {
    ...baseItem,
    id: craftedId,
    name: `${baseItem.name} (${qualityLabel})`,
    price: Math.max(0, Math.round((Number(baseItem.price) || 0) * priceMultiplier)),
    damageMin,
    damageMax,
    bonuses: scaleStatRecord(baseItem.bonuses, multiplier),
    gameplayDescription: qualityDescription,
    loreDescription: [
      baseItem.loreDescription?.trim(),
      `Этот экземпляр выкован отдельно и отличается от стандартной версии.`,
    ].filter(Boolean).join(' '),
    stackable: false,
    maxStack: 1,
    tags: Array.from(new Set([
      ...(baseItem.tags ?? []),
      'crafted',
      'blacksmith_forged',
      `crafted_recipe:${recipe.id}`,
      `crafted_quality:${qualityId}`,
      `crafted_owner:${characterId}`,
    ])),
    isEnabled: true,
  };
}

function incrementRecord(record: Record<string, number>, itemId: string, quantity: number): void {
  const normalizedItemId = String(itemId ?? '').trim();
  const normalizedQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  if (!normalizedItemId || normalizedQuantity <= 0) {
    return;
  }
  record[normalizedItemId] = Math.max(0, Math.floor(Number(record[normalizedItemId] ?? 0))) + normalizedQuantity;
}

function isMaterialCatalogEntry(itemId: string, materialsCatalog: Material[]): boolean {
  return materialsCatalog.some((entry) => entry.id === itemId && entry.isEnabled !== false);
}

export async function grantRecipeOutputsToCharacter(params: {
  characterId: string;
  recipe: CraftingRecipe | null;
  baseInventory?: InventoryState | null;
  itemsCatalog: AdminItem[];
  materialsCatalog: Material[];
  qualityTier?: BlacksmithQualityTier | null;
}): Promise<{ inventory?: InventoryState }> {
  const { characterId, recipe, baseInventory, itemsCatalog, materialsCatalog, qualityTier } = params;
  const materialMap = { ...readStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY) };
  let latestInventory = baseInventory ?? undefined;

  for (const entry of recipe?.outputMaterials ?? []) {
    incrementRecord(materialMap, entry.materialId, entry.quantity ?? 1);
  }

  for (const entry of recipe?.outputItems ?? []) {
    const outputId = String(entry.itemId ?? '').trim();
    const quantity = Math.max(0, Math.floor(Number(entry.quantity ?? 0) || 0));
    if (!outputId || quantity <= 0) {
      continue;
    }

    const exactItem = itemsCatalog.find((item) => item.id === outputId && item.isEnabled !== false) ?? null;
    const isMaterial = isMaterialCatalogEntry(outputId, materialsCatalog);

    if (isMaterial && (!exactItem || exactItem.type === 'material')) {
      incrementRecord(materialMap, outputId, quantity);
      continue;
    }

    if (exactItem && shouldCreateForgedVariant(exactItem)) {
      for (let index = 0; index < quantity; index += 1) {
        const crafted = await itemsService.create(createForgedItemFromBase(exactItem, recipe!, qualityTier ?? null, characterId));
        const hub = await adjustDevInventoryItem(characterId, { itemId: crafted.id, quantityDelta: 1 });
        latestInventory = hub.inventory;
      }
      continue;
    }

    const inventoryOutputId = exactItem?.id ?? outputId;
    const hub = await adjustDevInventoryItem(characterId, { itemId: inventoryOutputId, quantityDelta: quantity });
    latestInventory = hub.inventory;
  }

  writeStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY, materialMap);

  return {
    inventory: latestInventory,
  };
}
