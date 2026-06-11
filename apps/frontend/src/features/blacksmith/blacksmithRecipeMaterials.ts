import type { InventoryState } from '@theend/rpg-domain';
import { adjustDevInventoryItem, deleteArenaItemInstance, syncArenaItemInstance } from '../../api';
import type {
  AdminItem,
  BlacksmithCustomForgePlan,
  BlacksmithItemTemplate,
  BlacksmithUsedCarpenterComponentSnapshot,
  BlacksmithItemWorkAction,
  BlacksmithQualityTier,
  CraftingRecipe,
  ItemEffect,
  Material,
  MaterialCraftingRole,
  StatKey,
} from '../../services/content/models';
import { itemsService } from '../../services/content/itemsService';
import {
  PLAYER_HIDDEN_RUNTIME_ITEM_TAG,
  PLAYER_RUNTIME_ITEM_TAG,
  getPlayerItemInstanceByItemId,
  isRuntimeItemDefinition,
  removePlayerItemInstanceByItemId,
  upsertPlayerItemInstance,
} from '../../services/playerItemInstances';
import {
  applyCarpenterContributionToForgedItem,
  deriveCarpenterComponentForgeContribution,
  type BlacksmithCarpenterComponentOption,
} from './blacksmithCarpenterComponents';
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

export interface BlacksmithCustomForgeDifficultyResult {
  baseDifficulty: number;
  materialTier: string;
  risk: number;
  power: number;
  warnings: string[];
}

export interface BlacksmithItemWorkSelection {
  targetItemId: string;
  actionId: string;
}

export interface BlacksmithItemWorkApplyResult {
  inventory?: InventoryState;
  createdItem?: AdminItem | null;
  salvagedMaterials?: Record<string, number>;
  success: boolean;
  message: string;
}

export interface BlacksmithPriceBreakdownLine {
  label: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  source: 'material' | 'item' | 'labor';
}

export interface BlacksmithPriceBreakdown {
  materialsCost: number;
  laborCost: number;
  totalPrice: number;
  qualityFactor: number;
  lines: BlacksmithPriceBreakdownLine[];
}

interface CraftedItemOverrides {
  customName?: string;
  customDescription?: string;
  priceOverride?: number;
}

function ensureRuntimeItemPayload(
  item: Omit<AdminItem, 'createdAt' | 'updatedAt'>,
  characterId: string,
): Omit<AdminItem, 'createdAt' | 'updatedAt'> {
  const tags = new Set(item.tags ?? []);
  tags.add(PLAYER_RUNTIME_ITEM_TAG);
  tags.add(PLAYER_HIDDEN_RUNTIME_ITEM_TAG);
  tags.add(`crafted_owner:${characterId}`);
  return {
    ...item,
    tags: Array.from(tags),
  };
}

async function syncItemInstanceRecord(params: {
  item: AdminItem;
  characterId: string;
  sourceItemId?: string;
  qualityTierId?: string | null;
  forgeScore?: number;
  statOverrides?: Record<string, unknown>;
  craftedFromTemplateId?: string;
  craftedMaterialIds?: string[];
  carpenterComponentsUsed?: BlacksmithUsedCarpenterComponentSnapshot[];
  notes?: string;
}): Promise<void> {
  const {
    item,
    characterId,
    sourceItemId,
    qualityTierId,
    forgeScore,
    statOverrides,
    craftedFromTemplateId,
    craftedMaterialIds,
    carpenterComponentsUsed,
    notes,
  } = params;
  const instance = upsertPlayerItemInstance({
    itemId: item.id,
    ownerId: characterId,
    sourceItemId: sourceItemId?.trim() || undefined,
    itemSnapshot: item,
    customName: item.name?.trim() || undefined,
    statOverrides: statOverrides as any,
    qualityTierId: qualityTierId ?? undefined,
    forgeScore,
    craftedFromTemplateId: craftedFromTemplateId?.trim() || undefined,
    craftedMaterialIds: craftedMaterialIds?.filter((entry) => typeof entry === 'string' && entry.trim().length > 0),
    craftedByProfession: 'blacksmithing',
    carpenterComponentsUsed,
    tags: item.tags,
    notes,
  });
  await syncArenaItemInstance(characterId, item.id, {
    version: 1,
    sourceItemId: sourceItemId?.trim() || undefined,
    itemSnapshot: item,
    customName: item.name?.trim() || undefined,
    statOverrides: statOverrides ?? undefined,
    qualityTierId: qualityTierId ?? undefined,
    forgeScore,
    forgedAtIso: instance.updatedAt,
    ownerTag: characterId,
    craftedFromTemplateId: craftedFromTemplateId?.trim() || undefined,
    craftedMaterialIds: craftedMaterialIds?.filter((entry) => typeof entry === 'string' && entry.trim().length > 0),
    craftedByProfession: 'blacksmithing',
    carpenterComponentsUsed,
    tags: item.tags,
    notes,
  }, instance.id).catch(() => undefined);
}

function formatItemCoreStats(item: AdminItem): string[] {
  const parts: string[] = [];
  if (typeof item.damageMin === 'number' || typeof item.damageMax === 'number') {
    parts.push(`урон ${item.damageMin ?? 0}-${item.damageMax ?? item.damageMin ?? 0}`);
  }
  if (typeof item.armorValue === 'number') {
    parts.push(`броня ${item.armorValue}`);
  }
  parts.push(`слоты ${item.augmentSlots?.length ?? 0}/${item.maxAugmentSlots ?? item.augmentSlots?.length ?? 0}`);
  return parts;
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

function appendBonus(target: Partial<Record<StatKey, number>>, stat: StatKey, value: number): void {
  const normalized = Math.round(value);
  if (!normalized) {
    return;
  }
  target[stat] = (target[stat] ?? 0) + normalized;
}

function mergeBonusRecords(
  ...records: Array<Partial<Record<StatKey, number>> | undefined>
): Partial<Record<StatKey, number>> {
  const merged: Partial<Record<StatKey, number>> = {};
  for (const record of records) {
    if (!record) {
      continue;
    }
    for (const [key, value] of Object.entries(record)) {
      if (typeof value !== 'number' || value === 0) {
        continue;
      }
      appendBonus(merged, key as StatKey, value);
    }
  }
  return merged;
}

function deriveMaterialBonuses(materials: Material[]): Partial<Record<StatKey, number>> {
  const bonuses: Partial<Record<StatKey, number>> = {};
  for (const material of materials) {
    const physical = material.craftingProperties?.physical;
    const elemental = material.craftingProperties?.elemental;
    const magical = material.craftingProperties?.magical;
    const smith = material.craftingProperties?.blacksmith;

    appendBonus(bonuses, 'constitution', Math.floor((physical?.durability ?? 0) / 20));
    appendBonus(bonuses, 'strength', Math.floor((smith?.damageMultiplier ? (smith.damageMultiplier - 1) * 10 : 0) + ((elemental?.earthPower ?? 0) / 18)));
    appendBonus(bonuses, 'dexterity', Math.floor(((physical?.elasticity ?? 0) + (elemental?.airPower ?? 0)) / 22));
    appendBonus(bonuses, 'perception', Math.floor(((elemental?.lightPower ?? 0) + (physical?.conductivity ?? 0)) / 24));
    appendBonus(bonuses, 'willpower', Math.floor(((magical?.magicPower ?? 0) + (elemental?.firePower ?? 0) + (elemental?.darkPower ?? 0)) / 20));
    appendBonus(bonuses, 'intelligence', Math.floor(((magical?.manaConductivity ?? 0) + (magical?.spellAmplification ?? 0) + (elemental?.waterPower ?? 0)) / 20));
    appendBonus(bonuses, 'luck', Math.floor((material.craftingProperties?.rarityPower ?? 0) / 2));
  }
  return bonuses;
}

function deriveMaterialEffectPayload(materials: Material[]): ItemEffect[] {
  const merged: ItemEffect[] = [];
  const firePower = materials.reduce((sum, material) => sum + Number(material.craftingProperties?.elemental?.firePower ?? 0), 0);
  const waterPower = materials.reduce((sum, material) => sum + Number(material.craftingProperties?.elemental?.waterPower ?? 0), 0);
  const airPower = materials.reduce((sum, material) => sum + Number(material.craftingProperties?.elemental?.airPower ?? 0), 0);
  const earthPower = materials.reduce((sum, material) => sum + Number(material.craftingProperties?.elemental?.earthPower ?? 0), 0);
  const magicPower = materials.reduce((sum, material) => sum + Number(material.craftingProperties?.magical?.magicPower ?? 0), 0);

  if (firePower >= 10) {
    merged.push({ type: 'outgoing_damage_modifier', elementType: 'fire', percent: Math.max(4, Math.round(firePower / 2)), trigger: 'always' });
  }
  if (waterPower >= 10) {
    merged.push({ type: 'status_resistance', statusId: 'burning', percent: Math.max(6, Math.round(waterPower / 2)), trigger: 'always' });
  }
  if (airPower >= 12) {
    merged.push({ type: 'hit_chance_modifier', percent: Math.max(4, Math.round(airPower / 2.5)), trigger: 'always' });
  }
  if (earthPower >= 12) {
    merged.push({ type: 'block_chance_modifier', percent: Math.max(4, Math.round(earthPower / 2.5)), trigger: 'always' });
  }
  if (magicPower >= 12) {
    merged.push({ type: 'crit_damage_modifier', percent: Math.max(5, Math.round(magicPower / 2)), trigger: 'always' });
  }

  return merged;
}

function summarizeMaterialContribution(materials: Material[]): string {
  if (materials.length === 0) {
    return '';
  }
  const names = materials.map((entry) => entry.name).slice(0, 4).join(', ');
  const bonuses = deriveMaterialBonuses(materials);
  const bonusText = Object.entries(bonuses)
    .filter(([, value]) => typeof value === 'number' && value !== 0)
    .map(([key, value]) => `${key} ${value > 0 ? `+${value}` : value}`)
    .slice(0, 4)
    .join(', ');
  return [`Материалы: ${names}.`, bonusText ? `Свойства ковки: ${bonusText}.` : ''].filter(Boolean).join(' ');
}

function scaleItemEffects(effects: ItemEffect[] | undefined, multiplier: number): ItemEffect[] | undefined {
  if (!effects?.length || multiplier === 1) {
    return effects;
  }
  return effects.map((effect) => ({
    ...effect,
    value: typeof effect.value === 'number' ? roundScaled(effect.value, multiplier) : effect.value,
    flat: typeof effect.flat === 'number' ? roundScaled(effect.flat, multiplier) : effect.flat,
    percent: typeof effect.percent === 'number' ? roundScaled(effect.percent, multiplier) : effect.percent,
    chancePercent: typeof effect.chancePercent === 'number' ? roundScaled(effect.chancePercent, Math.min(multiplier, 1.25)) : effect.chancePercent,
  }));
}

function clampBlacksmithLevel(level: number | null | undefined): number {
  return Math.max(0, Math.floor(Number(level) || 0));
}

function getBlacksmithMasteryScale(level: number | null | undefined): number {
  return 1 + Math.min(0.36, clampBlacksmithLevel(level) * 0.018);
}

function getBlacksmithMasteryFlatBonus(itemType: AdminItem['type'] | BlacksmithItemTemplate['itemType'], level: number | null | undefined): number {
  const normalizedLevel = clampBlacksmithLevel(level);
  if (itemType === 'weapon') {
    return Math.floor(normalizedLevel / 3);
  }
  if (itemType === 'armor') {
    return Math.floor(normalizedLevel / 2);
  }
  return 0;
}

function deriveBlacksmithLevelBonuses(itemType: AdminItem['type'] | BlacksmithItemTemplate['itemType'], level: number | null | undefined): Partial<Record<StatKey, number>> {
  const normalizedLevel = clampBlacksmithLevel(level);
  if (normalizedLevel <= 0) {
    return {};
  }
  if (itemType === 'weapon') {
    return {
      strength: Math.floor(normalizedLevel / 6),
      dexterity: Math.floor(normalizedLevel / 8),
    };
  }
  if (itemType === 'armor') {
    return {
      constitution: Math.floor(normalizedLevel / 5),
      strength: Math.floor(normalizedLevel / 10),
    };
  }
  return {};
}

function describeBlacksmithMasteryContribution(itemType: AdminItem['type'] | BlacksmithItemTemplate['itemType'], level: number | null | undefined): string {
  const flatBonus = getBlacksmithMasteryFlatBonus(itemType, level);
  const normalizedLevel = clampBlacksmithLevel(level);
  if (normalizedLevel <= 0 || flatBonus <= 0) {
    return '';
  }
  return itemType === 'weapon'
    ? `Уровень кузнеца добавил силу удара: +${flatBonus} к базовому урону.`
    : `Уровень кузнеца усилил посадку и прочность: +${flatBonus} к базовой защите.`;
}

function repeatMaterialByQuantity(material: Material, quantity: number): Material[] {
  return Array.from({ length: Math.max(1, Math.floor(quantity || 1)) }, () => material);
}

function getQuantityContributionWeight(quantity: number): number {
  const normalizedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  return 1 + Math.max(0, normalizedQuantity - 1) * 0.68;
}

function getSlotMixInfluence(role: MaterialCraftingRole, itemType: BlacksmithItemTemplate['itemType']): number {
  if (role === 'main_metal' || role === 'ingot') {
    return itemType === 'weapon' ? 1.35 : 1.25;
  }
  if (role === 'alloy_component') {
    return 1.1;
  }
  if (role === 'handle' || role === 'wood' || role === 'leather' || role === 'cloth') {
    return itemType === 'weapon' ? 0.78 : 1.02;
  }
  if (role === 'quench_liquid' || role === 'oil' || role === 'essence' || role === 'crystal') {
    return 0.84;
  }
  return 0.92;
}

function shouldCreateForgedVariant(item: AdminItem | null): boolean {
  if (!item || item.stackable) {
    return false;
  }
  return item.type === 'weapon' || item.type === 'armor';
}

export function createForgedItemFromBase(
  baseItem: AdminItem,
  recipe: CraftingRecipe,
  qualityTier: BlacksmithQualityTier | null,
  characterId: string,
  overrides: CraftedItemOverrides = {},
  sourceMaterials: Material[] = [],
  blacksmithLevel = 0,
): Omit<AdminItem, 'createdAt' | 'updatedAt'> {
  const multiplier = Math.max(1, Number(qualityTier?.statMultiplier ?? 1) || 1);
  const masteryScale = getBlacksmithMasteryScale(blacksmithLevel);
  const totalMultiplier = multiplier * masteryScale;
  const levelFlatBonus = getBlacksmithMasteryFlatBonus(baseItem.type, blacksmithLevel);
  const qualityLabel = String(qualityTier?.name ?? 'Кованый').trim();
  const qualityId = String(qualityTier?.id ?? 'quality_normal').trim();
  const craftedId = createForgedRuntimeItemId(baseItem.id, recipe.id);
  const priceMultiplier = Math.max(1, Number(qualityTier?.priceMultiplier ?? 1) || 1);
  const damageMin = typeof baseItem.damageMin === 'number'
    ? Math.max(1, roundScaled(baseItem.damageMin, totalMultiplier) + levelFlatBonus)
    : undefined;
  const damageMax = typeof baseItem.damageMax === 'number'
    ? Math.max(damageMin ?? 0, roundScaled(baseItem.damageMax, totalMultiplier) + Math.max(levelFlatBonus, 0))
    : undefined;
  const armorValue = typeof baseItem.armorValue === 'number'
    ? Math.max(1, roundScaled(baseItem.armorValue, totalMultiplier) + levelFlatBonus)
    : undefined;
  const qualityDescription = [
    baseItem.gameplayDescription?.trim(),
    `Кузнечная работа: ${qualityLabel}.`,
    `Источник: ${recipe.name}.`,
    `Мастер: ${characterId}.`,
    summarizeMaterialContribution(sourceMaterials),
    describeBlacksmithMasteryContribution(baseItem.type, blacksmithLevel),
  ].filter(Boolean).join(' ');
  const materialBonuses = deriveMaterialBonuses(sourceMaterials);
  const materialEffects = deriveMaterialEffectPayload(sourceMaterials);
  const masteryBonuses = deriveBlacksmithLevelBonuses(baseItem.type, blacksmithLevel);

  return {
    ...baseItem,
    id: craftedId,
    name: overrides.customName?.trim() || `${baseItem.name} (${qualityLabel})`,
    price: Math.max(0, Math.round(overrides.priceOverride ?? ((Number(baseItem.price) || 0) * priceMultiplier))),
    damageMin,
    damageMax,
    armorValue,
    bonuses: mergeBonusRecords(scaleStatRecord(baseItem.bonuses, totalMultiplier), materialBonuses, masteryBonuses),
    gameplayDescription: qualityDescription,
    loreDescription: [
      overrides.customDescription?.trim(),
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
      ...sourceMaterials.map((entry) => `material:${entry.id}`),
    ])),
    equipmentEffects: mergeItemEffects([scaleItemEffects(baseItem.equipmentEffects, totalMultiplier), materialEffects]),
    isEnabled: true,
  };
}

export function normalizeMaterialCraftingRoles(material: Material): MaterialCraftingRole[] {
  const explicit = material.craftingProperties?.roles?.filter(Boolean) ?? [];
  if (explicit.length > 0) {
    return explicit;
  }

  const probe = `${material.id} ${material.name} ${material.category} ${(material.properties ?? []).join(' ')}`.toLowerCase();
  const roles = new Set<MaterialCraftingRole>();
  if (probe.includes('ore') || probe.includes('руда')) roles.add('ore');
  if (probe.includes('ingot') || probe.includes('слит')) {
    roles.add('ingot');
    roles.add('main_metal');
  }
  if (probe.includes('coal') || probe.includes('уг') || probe.includes('fuel')) roles.add('fuel');
  if (probe.includes('flux')) roles.add('flux');
  if (material.category === 'wood') {
    roles.add('wood');
    roles.add('handle');
  }
  if (material.category === 'leather') roles.add('leather');
  if (material.category === 'cloth') {
    roles.add('cloth');
    roles.add('thread');
  }
  if (material.category === 'metal' && roles.size === 0) {
    roles.add('main_metal');
  }
  if (probe.includes('oil') || probe.includes('масл')) {
    roles.add('oil');
    roles.add('quench_liquid');
  }
  if (probe.includes('salt') || probe.includes('соль')) roles.add('salt');
  if (probe.includes('ash') || probe.includes('пеп')) roles.add('ash');
  if (probe.includes('rune') || probe.includes('рун')) roles.add('rune_dust');
  if (probe.includes('crystal') || probe.includes('крист')) roles.add('crystal');
  if (probe.includes('bone') || probe.includes('кость')) roles.add('bone');
  if (roles.size === 0) {
    roles.add(material.category === 'metal' ? 'main_metal' : material.category === 'wood' ? 'wood' : 'essence');
  }
  return Array.from(roles);
}

function getMaterialTier(material: Material): string {
  return material.craftingProperties?.tier?.trim()
    || (material.rarity === 'legendary' || material.rarity === 'mythic' ? 'epic' : material.rarity === 'rare' || material.rarity === 'epic' ? 'rare' : 'common');
}

function getTierWeight(tier: string | undefined): number {
  switch (String(tier ?? '').trim()) {
    case 'mythic':
    case 'legendary':
      return 5;
    case 'epic':
      return 4;
    case 'rare':
      return 3;
    case 'uncommon':
      return 2;
    default:
      return 1;
  }
}

function getBlacksmithMaterialProps(material: Material) {
  return material.craftingProperties?.blacksmith ?? {};
}

function inferSuitabilityForRole(material: Material, role: MaterialCraftingRole): { matches: boolean; warning?: string } {
  const roles = normalizeMaterialCraftingRoles(material);
  const matches = roles.includes(role);
  if (matches) {
    return { matches: true };
  }
  return {
    matches: false,
    warning: `Материал ${material.name} плохо подходит для роли ${role}. Риск дефектов повышен.`,
  };
}

function buildPseudoNeedsForCustomPlan(plan: BlacksmithCustomForgePlan) {
  return plan.selectedMaterials.map((entry) => ({
    catalogId: entry.materialId,
    quantity: Math.max(1, Math.floor(entry.quantity || 1)),
    source: 'material' as const,
  }));
}

function summarizeSelectedMaterialMix(
  entries: Array<{ materialId: string; quantity: number }>,
  materialsById: Map<string, Material>,
): string {
  const grouped = new Map<string, number>();
  for (const entry of entries) {
    grouped.set(entry.materialId, (grouped.get(entry.materialId) ?? 0) + Math.max(1, Math.floor(entry.quantity || 1)));
  }
  return Array.from(grouped.entries())
    .map(([materialId, quantity]) => `${materialsById.get(materialId)?.name ?? materialId} x${quantity}`)
    .slice(0, 6)
    .join(', ');
}

function consumeCatalogNeeds(
  needs: Array<{ catalogId: string; quantity: number; source: 'material' | 'item' }>,
  baseInventory?: InventoryState | null,
): { ok: boolean; inventory?: InventoryState } {
  const mockRecipe = {
    inputMaterials: needs.filter((entry) => entry.source === 'material').map((entry) => ({ materialId: entry.catalogId, quantity: entry.quantity })),
    inputItems: needs.filter((entry) => entry.source === 'item').map((entry) => ({ itemId: entry.catalogId, quantity: entry.quantity })),
  } as CraftingRecipe;
  return consumeRecipeMaterials(mockRecipe, baseInventory);
}

export function calculateCustomForgeDifficulty(
  plan: BlacksmithCustomForgePlan,
  materials: Material[],
  template: BlacksmithItemTemplate,
): BlacksmithCustomForgeDifficultyResult {
  const materialsById = new Map(materials.map((entry) => [entry.id, entry]));
  let baseDifficulty = template.requiredBlacksmithLevel ? 18 + template.requiredBlacksmithLevel * 6 : 24;
  let risk = 8;
  let power = template.itemType === 'weapon'
    ? Math.round(((template.baseDamageMin ?? 0) + (template.baseDamageMax ?? 0)) / 2)
    : Math.max(1, Math.round(template.baseArmorValue ?? 1));
  let topTier = 1;
  const warnings: string[] = [];

  const allSlots = [...(template.requiredRoles ?? []), ...(template.optionalRoles ?? [])];
  for (const slot of allSlots) {
    const selected = plan.selectedMaterials.find((entry) => entry.slotId === slot.id);
    if (!selected) {
      if (slot.required) {
        baseDifficulty += 10;
        risk += 14;
        warnings.push(`Не заполнен обязательный слот: ${slot.label}.`);
      }
      continue;
    }
    const material = materialsById.get(selected.materialId);
    if (!material) {
      baseDifficulty += 8;
      risk += 12;
      warnings.push(`Материал ${selected.materialId} не найден в каталоге.`);
      continue;
    }
    const suitability = inferSuitabilityForRole(material, slot.role);
    if (!suitability.matches && suitability.warning) {
      warnings.push(suitability.warning);
      risk += 10;
      baseDifficulty += 6;
    }
    const smithProps = getBlacksmithMaterialProps(material);
    const tier = getMaterialTier(material);
    topTier = Math.max(topTier, getTierWeight(tier));
    baseDifficulty += Math.round((smithProps.heatDifficulty ?? 0) + ((material.craftingProperties?.runic?.instability ?? 0) / 4));
    risk += Math.round((smithProps.defectRisk ?? 0) + ((material.craftingProperties?.runic?.corruptionRisk ?? 0) / 6));
    power += Math.round(
      (smithProps.qualityBonus ?? 0)
      + (smithProps.damageMultiplier ? (smithProps.damageMultiplier - 1) * 8 : 0)
      + (smithProps.armorMultiplier ? (smithProps.armorMultiplier - 1) * 8 : 0)
      + ((material.craftingProperties?.physical?.durability ?? 0) / 18)
      + ((material.craftingProperties?.elemental?.firePower ?? 0) / 12)
      + ((material.craftingProperties?.magical?.magicPower ?? 0) / 14),
    );
  }

  return {
    baseDifficulty: Math.max(1, Math.round(baseDifficulty)),
    materialTier: topTier >= 5 ? 'mythic' : topTier >= 4 ? 'epic' : topTier >= 3 ? 'rare' : topTier >= 2 ? 'uncommon' : 'common',
    risk: Math.max(0, Math.round(risk)),
    power: Math.max(1, Math.round(power)),
    warnings,
  };
}

export function calculateCustomForgeDifficultyV2(
  plan: BlacksmithCustomForgePlan,
  materials: Material[],
  template: BlacksmithItemTemplate,
): BlacksmithCustomForgeDifficultyResult {
  const materialsById = new Map(materials.map((entry) => [entry.id, entry]));
  const slotById = new Map([...(template.requiredRoles ?? []), ...(template.optionalRoles ?? [])].map((slot) => [slot.id, slot]));
  let baseDifficulty = template.requiredBlacksmithLevel ? 18 + template.requiredBlacksmithLevel * 6 : 24;
  let risk = 8;
  let power = template.itemType === 'weapon'
    ? Math.round(((template.baseDamageMin ?? 0) + (template.baseDamageMax ?? 0)) / 2)
    : Math.max(1, Math.round(template.baseArmorValue ?? 1));
  let topTier = 1;
  const warnings: string[] = [];
  const totalSelectedQuantity = plan.selectedMaterials.reduce((sum, entry) => sum + Math.max(1, Math.floor(entry.quantity || 1)), 0);
  const uniqueMaterialCount = new Set(plan.selectedMaterials.map((entry) => entry.materialId)).size;

  const allSlots = [...(template.requiredRoles ?? []), ...(template.optionalRoles ?? [])];
  for (const slot of allSlots) {
    const selectedForSlot = plan.selectedMaterials.filter((entry) => entry.slotId === slot.id);
    if (selectedForSlot.length === 0) {
      if (slot.required) {
        baseDifficulty += 10;
        risk += 14;
        warnings.push(`Не заполнен обязательный слот: ${slot.label}.`);
      }
      continue;
    }
    if (selectedForSlot.length > 1) {
      baseDifficulty += selectedForSlot.length * 3;
      risk += Math.max(2, selectedForSlot.length * 2);
      power += selectedForSlot.length * 3;
      warnings.push(`Слот ${slot.label} использует смесь материалов. Сложность выше, но потенциал тоже растёт.`);
    }
    for (const selected of selectedForSlot) {
      const material = materialsById.get(selected.materialId);
      const quantity = Math.max(1, Math.floor(selected.quantity || 1));
      if (!material) {
        baseDifficulty += 8;
        risk += 12;
        warnings.push(`Материал ${selected.materialId} не найден в каталоге.`);
        continue;
      }
      const suitability = inferSuitabilityForRole(material, slot.role);
      const quantityWeight = getQuantityContributionWeight(quantity);
      if (!suitability.matches && suitability.warning) {
        warnings.push(suitability.warning);
        risk += Math.round(8 * quantityWeight);
        baseDifficulty += Math.round(5 * quantityWeight);
      }
      const smithProps = getBlacksmithMaterialProps(material);
      const tier = getMaterialTier(material);
      topTier = Math.max(topTier, getTierWeight(tier));
      baseDifficulty += Math.round(
        ((smithProps.heatDifficulty ?? 0) + ((material.craftingProperties?.runic?.instability ?? 0) / 4)) * quantityWeight
        + Math.max(0, quantity - slot.quantity),
      );
      risk += Math.round(
        ((smithProps.defectRisk ?? 0) + ((material.craftingProperties?.runic?.corruptionRisk ?? 0) / 6)) * quantityWeight
        + Math.max(0, quantity - 1),
      );
      power += Math.round(
        ((smithProps.qualityBonus ?? 0)
        + (smithProps.damageMultiplier ? (smithProps.damageMultiplier - 1) * 8 : 0)
        + (smithProps.armorMultiplier ? (smithProps.armorMultiplier - 1) * 8 : 0)
        + ((material.craftingProperties?.physical?.durability ?? 0) / 18)
        + ((material.craftingProperties?.elemental?.firePower ?? 0) / 12)
        + ((material.craftingProperties?.magical?.magicPower ?? 0) / 14)) * quantityWeight,
      );
    }
  }

  if (totalSelectedQuantity > allSlots.length) {
    baseDifficulty += Math.round((totalSelectedQuantity - allSlots.length) * 2.5);
    risk += Math.round((totalSelectedQuantity - allSlots.length) * 1.4);
    power += Math.round((totalSelectedQuantity - allSlots.length) * 2.8);
  }
  if (uniqueMaterialCount > 1) {
    baseDifficulty += (uniqueMaterialCount - 1) * 3;
    risk += uniqueMaterialCount - 1;
    power += (uniqueMaterialCount - 1) * 4;
  }
  const overloadedSlots = plan.selectedMaterials.filter((entry) => {
    const slot = slotById.get(entry.slotId);
    return slot ? Math.max(1, Math.floor(entry.quantity || 1)) > Math.max(1, slot.quantity) : false;
  }).length;
  if (overloadedSlots > 0) {
    warnings.push('Избыток материала в отдельных слотах даёт больше массы и потенциала, но требует уверенной руки кузнеца.');
  }

  return {
    baseDifficulty: Math.max(1, Math.round(baseDifficulty)),
    materialTier: topTier >= 5 ? 'mythic' : topTier >= 4 ? 'epic' : topTier >= 3 ? 'rare' : topTier >= 2 ? 'uncommon' : 'common',
    risk: Math.max(0, Math.round(risk)),
    power: Math.max(1, Math.round(power)),
    warnings,
  };
}

function createTemplateRuntimeItemId(templateId: string, mainMaterialId: string, qualityId: string): string {
  const base = sanitizeIdFragment(templateId) || 'template';
  const mat = sanitizeIdFragment(mainMaterialId) || 'material';
  const quality = sanitizeIdFragment(qualityId) || 'quality';
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  return `crafted_${base}_${mat}_${quality}_${uuid}`;
}

function deriveRarityFromForge(score: number, rarityPower: number): AdminItem['rarity'] {
  if (score >= 96 || rarityPower >= 5) return 'legendary';
  if (score >= 84 || rarityPower >= 4) return 'epic';
  if (score >= 68 || rarityPower >= 3) return 'rare';
  if (score >= 48 || rarityPower >= 2) return 'uncommon';
  return 'common';
}

function mergeItemEffects(effects: Array<ItemEffect[] | undefined>): ItemEffect[] | undefined {
  const merged = effects.flatMap((entry) => entry ?? []);
  return merged.length > 0 ? merged : undefined;
}

export function createForgedItemFromTemplate(params: {
  template: BlacksmithItemTemplate;
  plan: BlacksmithCustomForgePlan;
  materials: Material[];
  qualityTier: BlacksmithQualityTier | null;
  score: number;
  characterId: string;
  overrides?: CraftedItemOverrides;
}): Omit<AdminItem, 'createdAt' | 'updatedAt'> {
  const { template, plan, materials, qualityTier, score, characterId, overrides = {} } = params;
  const materialsById = new Map(materials.map((entry) => [entry.id, entry]));
  const selectedMaterials = plan.selectedMaterials
    .map((entry) => ({
      ...entry,
      material: materialsById.get(entry.materialId) ?? null,
    }))
    .filter((entry) => Boolean(entry.material));

  const mainEntry = selectedMaterials.find((entry) => {
    const slot = template.requiredRoles.find((role) => role.id === entry.slotId) ?? template.optionalRoles?.find((role) => role.id === entry.slotId);
    return slot?.role === 'main_metal' || slot?.role === 'ingot';
  }) ?? selectedMaterials[0] ?? null;

  const mainMaterial = mainEntry?.material ?? null;
  const mainProps = mainMaterial ? getBlacksmithMaterialProps(mainMaterial) : {};
  const qualityMultiplier = Math.max(0.4, Number(qualityTier?.statMultiplier ?? 1) || 1);
  const rarityPower = Math.max(...selectedMaterials.map((entry) => Number(entry.material?.craftingProperties?.rarityPower ?? getTierWeight(getMaterialTier(entry.material!))) || 0), 1);
  const defectPenalty = score < 35 ? 0.82 : score < 55 ? 0.94 : 1;
  const smithDamageMultiplier = Number(mainProps.damageMultiplier ?? 1) || 1;
  const smithArmorMultiplier = Number(mainProps.armorMultiplier ?? 1) || 1;
  const valueMultiplier = selectedMaterials.reduce((acc, entry) => acc * (Number(getBlacksmithMaterialProps(entry.material!).valueMultiplier ?? 1) || 1), 1);
  const physicalBonus = selectedMaterials.reduce((sum, entry) => sum + Number(entry.material?.craftingProperties?.physical?.durability ?? 0), 0);
  const elementalFire = selectedMaterials.reduce((sum, entry) => sum + Number(entry.material?.craftingProperties?.elemental?.firePower ?? 0), 0);
  const magicalPower = selectedMaterials.reduce((sum, entry) => sum + Number(entry.material?.craftingProperties?.magical?.magicPower ?? 0), 0);

  const baseDamageMin = template.baseDamageMin ?? 0;
  const baseDamageMax = template.baseDamageMax ?? 0;
  const baseArmorValue = template.baseArmorValue ?? 0;
  const damageMin = template.itemType === 'weapon'
    ? Math.max(1, Math.round(baseDamageMin * smithDamageMultiplier * qualityMultiplier * defectPenalty + physicalBonus / 25))
    : undefined;
  const damageMax = template.itemType === 'weapon'
    ? Math.max(damageMin ?? 1, Math.round(baseDamageMax * smithDamageMultiplier * qualityMultiplier * defectPenalty + physicalBonus / 18))
    : undefined;
  const armorValue = template.itemType === 'armor'
    ? Math.max(1, Math.round(baseArmorValue * smithArmorMultiplier * qualityMultiplier * defectPenalty + physicalBonus / 20))
    : undefined;
  const priceBase = template.itemType === 'weapon'
    ? ((damageMin ?? 0) + (damageMax ?? 0)) * 8
    : (armorValue ?? 0) * 14;
  const qualityId = qualityTier?.id ?? 'quality_normal';
  const qualityLabel = String(qualityTier?.name ?? 'Обычная ковка').trim();
  const namePrefix = mainMaterial?.name ? `${mainMaterial.name.replace(/ слиток$/i, '').replace(/ руда$/i, '')} ` : '';
  const itemId = createTemplateRuntimeItemId(template.id, mainMaterial?.id ?? 'unknown', qualityId);
  const tags = Array.from(new Set([
    'crafted',
    'blacksmith_forged',
    'custom_forge',
    `template:${template.id}`,
    `crafted_quality:${qualityId}`,
    `crafted_owner:${characterId}`,
    ...selectedMaterials.map((entry) => `material:${entry.materialId}`),
    ...(template.tags ?? []),
  ]));
  const equipmentEffects = mergeItemEffects([
    mainProps.bonusEffects,
    selectedMaterials.flatMap((entry) => getBlacksmithMaterialProps(entry.material!).bonusEffects ?? []),
    deriveMaterialEffectPayload(selectedMaterials.map((entry) => entry.material!)),
    elementalFire >= 20 ? [{
      type: 'status_resistance',
      statusId: 'burning',
      percent: 10,
      trigger: 'always' as const,
    }] : undefined,
    magicalPower >= 18 ? [{
      type: 'stat_bonus',
      stat: 'willpower',
      value: 1,
      trigger: 'always' as const,
    }] : undefined,
  ]);
  const materialBonuses = deriveMaterialBonuses(selectedMaterials.map((entry) => entry.material!));

  return {
    id: itemId,
    name: overrides.customName?.trim() || plan.customName?.trim() || `${namePrefix}${template.name} (${qualityLabel})`,
    type: template.itemType,
    subtype: template.subtype,
    slot: template.slot ?? (template.itemType === 'weapon' ? 'rightHand' : 'chest'),
    handsRequired: template.itemType === 'weapon' ? (template.handsRequired ?? 1) : 1,
    rarity: deriveRarityFromForge(score, rarityPower),
    price: Math.max(1, Math.round(overrides.priceOverride ?? (priceBase * Math.max(1, Number(qualityTier?.priceMultiplier ?? 1) || 1) * valueMultiplier))),
    stackable: false,
    maxStack: 1,
    damageMin,
    damageMax,
    damageCategory: template.damageCategory ?? (template.itemType === 'weapon' ? 'physical' : undefined),
    physicalType: template.physicalType,
    armorValue,
    attackRange: template.attackRange,
    bonuses: materialBonuses,
    equipmentEffects,
    augmentSlots: [],
    canAddAugmentSlots: template.canAddAugmentSlots === true,
    maxAugmentSlots: Math.max(0, template.baseMaxAugmentSlots ?? 0),
    canHaveRuneComplex: template.canHaveRuneComplex === true,
    tags,
    gameplayDescription: `Предмет создан в свободной кузнечной ковке. Шаблон: ${template.name}. Основной материал: ${mainMaterial?.name ?? 'неизвестен'}. Качество: ${qualityLabel}. ${summarizeMaterialContribution(selectedMaterials.map((entry) => entry.material!))}`.trim(),
    loreDescription: `Этот предмет выкован вручную игроком и отличается от стандартных ремесленных изделий.`,
    imageRef: template.imageRef,
    isEnabled: true,
  };
}

export function consumeCustomForgeMaterials(
  plan: BlacksmithCustomForgePlan | null,
  baseInventory?: InventoryState | null,
): { ok: boolean; inventory?: InventoryState } {
  if (!plan) {
    return { ok: false };
  }
  return consumeCatalogNeeds(buildPseudoNeedsForCustomPlan(plan), baseInventory);
}

function createItemWorkRuntimeItemId(baseItemId: string, actionId: string): string {
  const base = sanitizeIdFragment(baseItemId) || 'item';
  const action = sanitizeIdFragment(actionId) || 'work';
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  return `worked_${base}_${action}_${uuid}`;
}

export function consumeItemWorkCosts(
  action: BlacksmithItemWorkAction | null,
  baseInventory?: InventoryState | null,
): { ok: boolean; inventory?: InventoryState } {
  if (!action) {
    return { ok: false };
  }
  const needs = [
    ...(action.materialCosts ?? []).map((entry) => ({ catalogId: entry.materialId, quantity: entry.quantity, source: 'material' as const })),
    ...(action.itemCosts ?? []).map((entry) => ({ catalogId: entry.itemId, quantity: entry.quantity, source: 'item' as const })),
  ];
  return consumeCatalogNeeds(needs, baseInventory);
}

export function buildWorkedItem(
  baseItem: AdminItem,
  action: BlacksmithItemWorkAction,
  score: number,
  overrides: CraftedItemOverrides = {},
): Omit<AdminItem, 'createdAt' | 'updatedAt'> {
  const multiplier = action.actionType === 'improve_stats'
    ? Math.max(1.05, Math.min(1.15, 1.02 + score / 100))
    : action.actionType === 'reinforce'
      ? Math.max(1.04, Math.min(1.12, 1.01 + score / 120))
      : 1;
  const nextSockets = [...(baseItem.augmentSlots ?? [])];
  if (action.actionType === 'add_socket') {
    nextSockets.push({
      id: `socket_blacksmith_added_${Math.random().toString(36).slice(2, 10)}`,
      source: 'blacksmith_added',
      isLocked: false,
      allowedAugmentTypes: action.addSocketRules?.allowedAugmentTypes ?? ['rune', 'magic_stone', 'enchantment'],
    });
  }
  const extraEffects: ItemEffect[] | undefined = action.actionType === 'temporary_buff'
    ? (action.effects && action.effects.length > 0 ? action.effects : [{
      type: 'stat_bonus',
      stat: 'strength',
      value: 1,
      trigger: 'always',
    } satisfies ItemEffect])
    : undefined;
  const effectMultiplier = action.actionType === 'improve_stats'
    ? Math.max(1.04, Math.min(1.12, 1.01 + score / 130))
    : action.actionType === 'reinforce'
      ? Math.max(1.03, Math.min(1.1, 1.01 + score / 150))
      : 1;

  return {
    ...baseItem,
    id: createItemWorkRuntimeItemId(baseItem.id, action.id),
    name: overrides.customName?.trim() || `${baseItem.name} (${action.name})`,
    price: Math.max(0, Math.round(overrides.priceOverride ?? (baseItem.price * multiplier))),
    damageMin: typeof baseItem.damageMin === 'number' ? Math.max(1, Math.round(baseItem.damageMin * multiplier)) : undefined,
    damageMax: typeof baseItem.damageMax === 'number' ? Math.max((typeof baseItem.damageMin === 'number' ? Math.round(baseItem.damageMin * multiplier) : 1), Math.round((baseItem.damageMax ?? 0) * multiplier)) : undefined,
    armorValue: typeof baseItem.armorValue === 'number' ? Math.max(1, Math.round(baseItem.armorValue * multiplier)) : undefined,
    bonuses: scaleStatRecord(baseItem.bonuses, multiplier),
    augmentSlots: nextSockets,
    canAddAugmentSlots: baseItem.canAddAugmentSlots !== false,
    maxAugmentSlots: Math.max(baseItem.maxAugmentSlots ?? nextSockets.length, nextSockets.length),
    equipmentEffects: mergeItemEffects([scaleItemEffects(baseItem.equipmentEffects, effectMultiplier), extraEffects]),
    tags: Array.from(new Set([...(baseItem.tags ?? []), `item_work:${action.actionType}`, `item_work_action:${action.id}`])),
    gameplayDescription: `${baseItem.gameplayDescription} Доработка кузнецом: ${action.name}.`,
    loreDescription: `${baseItem.loreDescription} Предмет прошёл кузнечную доработку.`,
    isEnabled: true,
  };
}

export function buildWorkedItemV2(
  baseItem: AdminItem,
  action: BlacksmithItemWorkAction,
  score: number,
  blacksmithLevel = 0,
  overrides: CraftedItemOverrides = {},
): Omit<AdminItem, 'createdAt' | 'updatedAt'> {
  const baseWorkedItem = buildWorkedItem(baseItem, action, score, overrides);
  const masteryScale = getBlacksmithMasteryScale(blacksmithLevel);
  const masteryFlatBonus = getBlacksmithMasteryFlatBonus(baseItem.type, blacksmithLevel);
  const masteryBonuses = deriveBlacksmithLevelBonuses(baseItem.type, blacksmithLevel);

  return {
    ...baseWorkedItem,
    damageMin: typeof baseWorkedItem.damageMin === 'number'
      ? Math.max(1, Math.round(baseWorkedItem.damageMin * masteryScale) + masteryFlatBonus)
      : undefined,
    damageMax: typeof baseWorkedItem.damageMax === 'number'
      ? Math.max(1, Math.round(baseWorkedItem.damageMax * masteryScale) + Math.max(0, masteryFlatBonus))
      : undefined,
    armorValue: typeof baseWorkedItem.armorValue === 'number'
      ? Math.max(1, Math.round(baseWorkedItem.armorValue * masteryScale) + masteryFlatBonus)
      : undefined,
    bonuses: mergeBonusRecords(baseWorkedItem.bonuses, masteryBonuses),
    gameplayDescription: [baseWorkedItem.gameplayDescription, describeBlacksmithMasteryContribution(baseItem.type, blacksmithLevel)]
      .filter(Boolean)
      .join(' '),
    equipmentEffects: scaleItemEffects(baseWorkedItem.equipmentEffects, masteryScale),
  };
}

export function createForgedItemFromTemplateV2(params: {
  template: BlacksmithItemTemplate;
  plan: BlacksmithCustomForgePlan;
  materials: Material[];
  qualityTier: BlacksmithQualityTier | null;
  score: number;
  characterId: string;
  blacksmithLevel?: number;
  overrides?: CraftedItemOverrides;
}): Omit<AdminItem, 'createdAt' | 'updatedAt'> {
  const { template, plan, materials, qualityTier, score, characterId, blacksmithLevel = 0, overrides = {} } = params;
  const materialsById = new Map(materials.map((entry) => [entry.id, entry]));
  const slotById = new Map([...(template.requiredRoles ?? []), ...(template.optionalRoles ?? [])].map((slot) => [slot.id, slot]));
  const selectedMaterials = plan.selectedMaterials
    .map((entry) => ({
      ...entry,
      quantity: Math.max(1, Math.floor(entry.quantity || 1)),
      material: materialsById.get(entry.materialId) ?? null,
      slot: slotById.get(entry.slotId) ?? null,
    }))
    .filter((entry): entry is typeof entry & { material: Material } => Boolean(entry.material));
  const expandedMaterials = selectedMaterials.flatMap((entry) => repeatMaterialByQuantity(entry.material, entry.quantity));
  const mainEntry = [...selectedMaterials]
    .sort((left, right) => right.quantity - left.quantity)
    .find((entry) => entry.slot?.role === 'main_metal' || entry.slot?.role === 'ingot')
    ?? selectedMaterials[0]
    ?? null;

  const mainMaterial = mainEntry?.material ?? null;
  const mainProps = mainMaterial ? getBlacksmithMaterialProps(mainMaterial) : {};
  const qualityMultiplier = Math.max(0.4, Number(qualityTier?.statMultiplier ?? 1) || 1);
  const rarityPower = Math.max(...selectedMaterials.map((entry) => Number(entry.material.craftingProperties?.rarityPower ?? getTierWeight(getMaterialTier(entry.material))) || 0), 1);
  const defectPenalty = score < 35 ? 0.82 : score < 55 ? 0.94 : 1;
  const masteryScale = getBlacksmithMasteryScale(blacksmithLevel);
  const masteryFlatBonus = getBlacksmithMasteryFlatBonus(template.itemType, blacksmithLevel);
  const computeWeightedSmithMetric = (metric: 'damageMultiplier' | 'armorMultiplier'): number => {
    let weighted = 0;
    let totalWeight = 0;
    for (const entry of selectedMaterials) {
      const baseMetric = Number(getBlacksmithMaterialProps(entry.material)[metric] ?? 1) || 1;
      const slotRole = entry.slot?.role ?? 'essence';
      const influence = getSlotMixInfluence(slotRole, template.itemType);
      const quantityWeight = getQuantityContributionWeight(entry.quantity);
      weighted += baseMetric * influence * quantityWeight;
      totalWeight += influence * quantityWeight;
    }
    return totalWeight > 0 ? weighted / totalWeight : 1;
  };
  const smithDamageMultiplier = computeWeightedSmithMetric('damageMultiplier');
  const smithArmorMultiplier = computeWeightedSmithMetric('armorMultiplier');
  const valueMultiplier = selectedMaterials.reduce((acc, entry) => {
    const baseMultiplier = Number(getBlacksmithMaterialProps(entry.material).valueMultiplier ?? 1) || 1;
    const slotInfluence = getSlotMixInfluence(entry.slot?.role ?? 'essence', template.itemType);
    const weightedFactor = 1 + (baseMultiplier - 1) * Math.min(1.35, slotInfluence * (0.8 + Math.max(0, entry.quantity - 1) * 0.2));
    return acc * Math.max(0.8, Math.min(2.2, weightedFactor));
  }, 1);
  const physicalBonus = expandedMaterials.reduce((sum, material) => sum + Number(material.craftingProperties?.physical?.durability ?? 0), 0);
  const elementalFire = expandedMaterials.reduce((sum, material) => sum + Number(material.craftingProperties?.elemental?.firePower ?? 0), 0);
  const magicalPower = expandedMaterials.reduce((sum, material) => sum + Number(material.craftingProperties?.magical?.magicPower ?? 0), 0);
  const baseDamageMin = template.baseDamageMin ?? 0;
  const baseDamageMax = template.baseDamageMax ?? 0;
  const baseArmorValue = template.baseArmorValue ?? 0;
  const damageMin = template.itemType === 'weapon'
    ? Math.max(1, Math.round(baseDamageMin * smithDamageMultiplier * qualityMultiplier * defectPenalty * masteryScale + physicalBonus / 25 + masteryFlatBonus))
    : undefined;
  const damageMax = template.itemType === 'weapon'
    ? Math.max(damageMin ?? 1, Math.round(baseDamageMax * smithDamageMultiplier * qualityMultiplier * defectPenalty * masteryScale + physicalBonus / 18 + Math.max(1, masteryFlatBonus)))
    : undefined;
  const armorValue = template.itemType === 'armor'
    ? Math.max(1, Math.round(baseArmorValue * smithArmorMultiplier * qualityMultiplier * defectPenalty * masteryScale + physicalBonus / 20 + masteryFlatBonus))
    : undefined;
  const priceBase = template.itemType === 'weapon'
    ? ((damageMin ?? 0) + (damageMax ?? 0)) * 8
    : (armorValue ?? 0) * 14;
  const qualityId = qualityTier?.id ?? 'quality_normal';
  const qualityLabel = String(qualityTier?.name ?? 'Обычная ковка').trim();
  const namePrefix = mainMaterial?.name ? `${mainMaterial.name.replace(/ слиток$/i, '').replace(/ руда$/i, '')} ` : '';
  const itemId = createTemplateRuntimeItemId(template.id, mainMaterial?.id ?? 'unknown', qualityId);
  const tags = Array.from(new Set([
    'crafted',
    'blacksmith_forged',
    'custom_forge',
    `template:${template.id}`,
    `crafted_quality:${qualityId}`,
    `crafted_owner:${characterId}`,
    ...selectedMaterials.map((entry) => `material:${entry.materialId}`),
    ...(template.tags ?? []),
  ]));
  const equipmentEffects = mergeItemEffects([
    mainProps.bonusEffects,
    selectedMaterials.flatMap((entry) => getBlacksmithMaterialProps(entry.material).bonusEffects ?? []),
    deriveMaterialEffectPayload(expandedMaterials),
    elementalFire >= 20 ? [{
      type: 'status_resistance',
      statusId: 'burning',
      percent: 10,
      trigger: 'always' as const,
    }] : undefined,
    magicalPower >= 18 ? [{
      type: 'stat_bonus',
      stat: 'willpower',
      value: 1,
      trigger: 'always' as const,
    }] : undefined,
  ]);
  const materialBonuses = deriveMaterialBonuses(expandedMaterials);
  const masteryBonuses = deriveBlacksmithLevelBonuses(template.itemType, blacksmithLevel);
  const mixText = summarizeSelectedMaterialMix(selectedMaterials, materialsById);

  return {
    id: itemId,
    name: overrides.customName?.trim() || plan.customName?.trim() || `${namePrefix}${template.name} (${qualityLabel})`,
    type: template.itemType,
    subtype: template.subtype,
    slot: template.slot ?? (template.itemType === 'weapon' ? 'rightHand' : 'chest'),
    handsRequired: template.itemType === 'weapon' ? (template.handsRequired ?? 1) : 1,
    rarity: deriveRarityFromForge(score, rarityPower),
    price: Math.max(1, Math.round(overrides.priceOverride ?? (priceBase * Math.max(1, Number(qualityTier?.priceMultiplier ?? 1) || 1) * valueMultiplier))),
    stackable: false,
    maxStack: 1,
    damageMin,
    damageMax,
    damageCategory: template.damageCategory ?? (template.itemType === 'weapon' ? 'physical' : undefined),
    physicalType: template.physicalType,
    armorValue,
    attackRange: template.attackRange,
    bonuses: mergeBonusRecords(materialBonuses, masteryBonuses),
    equipmentEffects,
    augmentSlots: [],
    canAddAugmentSlots: template.canAddAugmentSlots === true,
    maxAugmentSlots: Math.max(0, template.baseMaxAugmentSlots ?? 0),
    canHaveRuneComplex: template.canHaveRuneComplex === true,
    tags,
    gameplayDescription: [
      `Предмет создан в свободной кузнечной ковке. Шаблон: ${template.name}.`,
      `Основной материал: ${mainMaterial?.name ?? 'неизвестен'}.`,
      mixText ? `Смесь: ${mixText}.` : '',
      `Качество: ${qualityLabel}.`,
      summarizeMaterialContribution(expandedMaterials),
      describeBlacksmithMasteryContribution(template.itemType, blacksmithLevel),
    ].filter(Boolean).join(' '),
    loreDescription: overrides.customDescription?.trim()
      || 'Этот предмет выкован вручную игроком и отличается от стандартных ремесленных изделий.',
    imageRef: template.imageRef,
    isEnabled: true,
  };
}

function resolveMaterialUnitPrice(material: Material | null | undefined): number {
  return Math.max(1, Math.round(Number(material?.averageMarketPrice ?? 0) || 1));
}

function resolveItemUnitPrice(item: AdminItem | null | undefined): number {
  return Math.max(1, Math.round(Number(item?.price ?? 0) || 1));
}

export function calculateBlacksmithLaborCost(baseDifficulty: number, score: number, qualityTier?: BlacksmithQualityTier | null): number {
  const qualityFactor = Math.max(0.75, Number(qualityTier?.priceMultiplier ?? 1) || 1);
  const masteryFactor = 0.7 + Math.max(0, score) / 100;
  return Math.max(4, Math.round((Math.max(1, baseDifficulty) * 3.4 + Math.max(0, score) * 1.6) * qualityFactor * masteryFactor));
}

export function calculateRecipeCraftPriceBreakdown(params: {
  recipe: CraftingRecipe;
  itemsCatalog: AdminItem[];
  materialsCatalog: Material[];
  score: number;
  qualityTier?: BlacksmithQualityTier | null;
}): BlacksmithPriceBreakdown {
  const { recipe, itemsCatalog, materialsCatalog, score, qualityTier } = params;
  const materialsById = new Map(materialsCatalog.map((entry) => [entry.id, entry]));
  const itemsById = new Map(itemsCatalog.map((entry) => [entry.id, entry]));
  const lines: BlacksmithPriceBreakdownLine[] = [];

  for (const entry of recipe.inputMaterials ?? []) {
    const material = materialsById.get(entry.materialId) ?? null;
    const quantity = Math.max(1, Math.round(entry.quantity ?? 1));
    const unitPrice = resolveMaterialUnitPrice(material);
    lines.push({ label: material?.name ?? entry.materialId, quantity, unitPrice, subtotal: quantity * unitPrice, source: 'material' });
  }

  for (const entry of recipe.inputItems ?? []) {
    const item = itemsById.get(entry.itemId) ?? null;
    const quantity = Math.max(1, Math.round(entry.quantity ?? 1));
    const unitPrice = resolveItemUnitPrice(item);
    lines.push({ label: item?.name ?? entry.itemId, quantity, unitPrice, subtotal: quantity * unitPrice, source: 'item' });
  }

  const materialsCost = lines.reduce((sum, entry) => sum + entry.subtotal, 0);
  const laborCost = calculateBlacksmithLaborCost(45, score, qualityTier);
  lines.push({ label: 'Работа кузнеца', quantity: 1, unitPrice: laborCost, subtotal: laborCost, source: 'labor' });
  return { materialsCost, laborCost, totalPrice: Math.max(1, materialsCost + laborCost), qualityFactor: Math.max(0.75, Number(qualityTier?.priceMultiplier ?? 1) || 1), lines };
}

export function calculateCustomForgePriceBreakdown(params: {
  plan: BlacksmithCustomForgePlan;
  template: BlacksmithItemTemplate;
  materialsCatalog: Material[];
  score: number;
  qualityTier?: BlacksmithQualityTier | null;
}): BlacksmithPriceBreakdown {
  const { plan, template, materialsCatalog, score, qualityTier } = params;
  const materialsById = new Map(materialsCatalog.map((entry) => [entry.id, entry]));
  const lines: BlacksmithPriceBreakdownLine[] = [];

  for (const entry of plan.selectedMaterials) {
    const material = materialsById.get(entry.materialId) ?? null;
    const quantity = Math.max(1, Math.round(entry.quantity ?? 1));
    const unitPrice = resolveMaterialUnitPrice(material);
    lines.push({ label: material?.name ?? entry.materialId, quantity, unitPrice, subtotal: quantity * unitPrice, source: 'material' });
  }

  const materialsCost = lines.reduce((sum, entry) => sum + entry.subtotal, 0);
  const laborCost = calculateBlacksmithLaborCost(Math.max(18, plan.predictedDifficulty || ((template.requiredBlacksmithLevel ?? 1) * 10)), score, qualityTier);
  lines.push({ label: 'Работа кузнеца', quantity: 1, unitPrice: laborCost, subtotal: laborCost, source: 'labor' });
  return { materialsCost, laborCost, totalPrice: Math.max(1, materialsCost + laborCost), qualityFactor: Math.max(0.75, Number(qualityTier?.priceMultiplier ?? 1) || 1), lines };
}

export function calculateItemWorkPriceBreakdown(params: {
  action: BlacksmithItemWorkAction;
  materialsCatalog: Material[];
  itemsCatalog: AdminItem[];
  score: number;
  qualityTier?: BlacksmithQualityTier | null;
}): BlacksmithPriceBreakdown {
  const { action, materialsCatalog, itemsCatalog, score, qualityTier } = params;
  const materialsById = new Map(materialsCatalog.map((entry) => [entry.id, entry]));
  const itemsById = new Map(itemsCatalog.map((entry) => [entry.id, entry]));
  const lines: BlacksmithPriceBreakdownLine[] = [];

  for (const entry of action.materialCosts ?? []) {
    const material = materialsById.get(entry.materialId) ?? null;
    const quantity = Math.max(1, Math.round(entry.quantity ?? 1));
    const unitPrice = resolveMaterialUnitPrice(material);
    lines.push({ label: material?.name ?? entry.materialId, quantity, unitPrice, subtotal: quantity * unitPrice, source: 'material' });
  }

  for (const entry of action.itemCosts ?? []) {
    const item = itemsById.get(entry.itemId) ?? null;
    const quantity = Math.max(1, Math.round(entry.quantity ?? 1));
    const unitPrice = resolveItemUnitPrice(item);
    lines.push({ label: item?.name ?? entry.itemId, quantity, unitPrice, subtotal: quantity * unitPrice, source: 'item' });
  }

  const materialsCost = lines.reduce((sum, entry) => sum + entry.subtotal, 0);
  const laborCost = calculateBlacksmithLaborCost(action.baseDifficulty, score, qualityTier);
  lines.push({ label: 'Работа кузнеца', quantity: 1, unitPrice: laborCost, subtotal: laborCost, source: 'labor' });
  return { materialsCost, laborCost, totalPrice: Math.max(1, materialsCost + laborCost), qualityFactor: Math.max(0.75, Number(qualityTier?.priceMultiplier ?? 1) || 1), lines };
}

function inferDismantleMaterials(item: AdminItem): Record<string, number> {
  const materials: Record<string, number> = {};
  const materialTags = (item.tags ?? []).filter((tag) => tag.startsWith('material:'));
  if (materialTags.length > 0) {
    for (const tag of materialTags.slice(0, 2)) {
      incrementRecord(materials, tag.slice('material:'.length), 1);
    }
    return materials;
  }
  if (item.type === 'weapon' || item.type === 'armor') {
    incrementRecord(materials, 'item_iron_ore', item.type === 'armor' ? 2 : 1);
  }
  if ((item.subtype ?? '').toLowerCase().includes('spear') || (item.name ?? '').toLowerCase().includes('древ')) {
    incrementRecord(materials, 'item_hardwood', 1);
  }
  return materials;
}

export async function applyItemWorkToCharacter(params: {
  characterId: string;
  action: BlacksmithItemWorkAction;
  baseItem: AdminItem;
  score: number;
  inventory?: InventoryState | null;
  overrides?: CraftedItemOverrides;
}): Promise<BlacksmithItemWorkApplyResult> {
  const { characterId, action, baseItem, score, inventory, overrides } = params;

  if (action.actionType === 'add_socket') {
    if (baseItem.canAddAugmentSlots !== true) {
      return { success: false, message: 'Р­С‚РѕС‚ РїСЂРµРґРјРµС‚ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ СЃР»РѕС‚С‹.' };
    }
    const currentSlots = baseItem.augmentSlots?.length ?? 0;
    const maxSlots = baseItem.maxAugmentSlots ?? currentSlots;
    if (currentSlots >= maxSlots) {
      return { success: false, message: `Р”РѕСЃС‚РёРіРЅСѓС‚ РјР°РєСЃРёРјСѓРј СЃР»РѕС‚РѕРІ (${maxSlots}).` };
    }
  }

  if (action.actionType === 'dismantle') {
    let latestInventory = inventory ?? undefined;
    const removeHub = await adjustDevInventoryItem(characterId, { itemId: baseItem.id, quantityDelta: -1 });
    latestInventory = removeHub.inventory;
    if (isRuntimeItemDefinition(baseItem) || getPlayerItemInstanceByItemId(baseItem.id)) {
      removePlayerItemInstanceByItemId(baseItem.id);
      await deleteArenaItemInstance(characterId, baseItem.id).catch(() => undefined);
      await itemsService.delete(baseItem.id).catch(() => undefined);
    }
    const salvage = inferDismantleMaterials(baseItem);
    const materialMap = { ...readStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY) };
    for (const [materialId, quantity] of Object.entries(salvage)) {
      incrementRecord(materialMap, materialId, Math.max(1, Math.round(quantity * Math.max(0.4, score / 100))));
    }
    writeStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY, materialMap);
    return {
      inventory: latestInventory,
      salvagedMaterials: salvage,
      success: true,
      message: 'РџСЂРµРґРјРµС‚ СЂР°Р·РѕР±СЂР°РЅ РЅР° РјР°С‚РµСЂРёР°Р»С‹.',
    };
  }

  const runtimeBacked = isRuntimeItemDefinition(baseItem) || Boolean(getPlayerItemInstanceByItemId(baseItem.id));
  const existingInstance = getPlayerItemInstanceByItemId(baseItem.id);
  const nextDraft = ensureRuntimeItemPayload(buildWorkedItem(baseItem, action, score, overrides), characterId);
  let nextDefinition: AdminItem;
  let latestInventory = inventory ?? undefined;

  if (runtimeBacked) {
    nextDefinition = await itemsService.update(baseItem.id, { ...nextDraft, id: baseItem.id });
  } else {
    nextDefinition = await itemsService.create(nextDraft);
    const removeHub = await adjustDevInventoryItem(characterId, { itemId: baseItem.id, quantityDelta: -1 });
    const addHub = await adjustDevInventoryItem(characterId, { itemId: nextDefinition.id, quantityDelta: 1 });
    latestInventory = addHub.inventory ?? removeHub.inventory;
  }

  await syncItemInstanceRecord({
    item: nextDefinition,
    characterId,
    sourceItemId: runtimeBacked ? (existingInstance?.sourceItemId ?? baseItem.id) : baseItem.id,
    forgeScore: score,
    notes: action.name,
  });

  const beforeStats = formatItemCoreStats(baseItem).join(', ');
  const afterStats = formatItemCoreStats(nextDefinition).join(', ');
  return {
    inventory: latestInventory,
    createdItem: nextDefinition,
    success: true,
    message: `${action.name}: ${baseItem.name} -> ${nextDefinition.name}. Р‘С‹Р»Рѕ: ${beforeStats}. РЎС‚Р°Р»Рѕ: ${afterStats}.`,
  };
}

export async function grantCustomForgeItemToCharacter(params: {
  characterId: string;
  template: BlacksmithItemTemplate;
  plan: BlacksmithCustomForgePlan;
  materialsCatalog: Material[];
  qualityTier?: BlacksmithQualityTier | null;
  score: number;
  overrides?: CraftedItemOverrides;
}): Promise<{ inventory?: InventoryState; createdItem?: AdminItem | null; success: boolean }> {
  const { characterId, template, plan, materialsCatalog, qualityTier, score, overrides } = params;
  if ((qualityTier?.isFailureTier ?? false) || score < 20) {
    const salvageMap = { ...readStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY) };
    for (const entry of plan.selectedMaterials.slice(0, 2)) {
      incrementRecord(salvageMap, entry.materialId, 1);
    }
    writeStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY, salvageMap);
    return { success: false };
  }
  const createdDraft = ensureRuntimeItemPayload(createForgedItemFromTemplate({
    template,
    plan,
    materials: materialsCatalog,
    qualityTier: qualityTier ?? null,
    score,
    characterId,
    overrides,
  }), characterId);
  const created = await itemsService.create(createdDraft);
  await syncItemInstanceRecord({
    item: created,
    characterId,
    qualityTierId: qualityTier?.id ?? null,
    forgeScore: score,
    craftedFromTemplateId: template.id,
    craftedMaterialIds: plan.selectedMaterials.map((entry) => entry.materialId),
    notes: 'custom_forge',
  });
  const hub = await adjustDevInventoryItem(characterId, { itemId: created.id, quantityDelta: 1 });
  return { inventory: hub.inventory, createdItem: created, success: true };
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
  overrides?: CraftedItemOverrides;
}): Promise<{ inventory?: InventoryState; createdItem?: AdminItem | null }> {
  const { characterId, recipe, baseInventory, itemsCatalog, materialsCatalog, qualityTier, overrides } = params;
  const materialMap = { ...readStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY) };
  let latestInventory = baseInventory ?? undefined;
  let createdItem: AdminItem | null = null;
  let appliedOverride = false;
  const materialsById = new Map(materialsCatalog.map((entry) => [entry.id, entry]));
  const recipeSourceMaterials = (recipe?.inputMaterials ?? [])
    .map((entry) => materialsById.get(entry.materialId) ?? null)
    .filter((entry): entry is Material => Boolean(entry));

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
        const craftedDraft = ensureRuntimeItemPayload(createForgedItemFromBase(
          exactItem,
          recipe!,
          qualityTier ?? null,
          characterId,
          !appliedOverride && quantity === 1 ? overrides : undefined,
          recipeSourceMaterials,
        ), characterId);
        const crafted = await itemsService.create(craftedDraft);
        await syncItemInstanceRecord({
          item: crafted,
          characterId,
          sourceItemId: exactItem.id,
          qualityTierId: qualityTier?.id ?? null,
          craftedMaterialIds: recipeSourceMaterials.map((material) => material.id),
          notes: `recipe:${recipe?.id ?? 'unknown'}`,
        });
        const hub = await adjustDevInventoryItem(characterId, { itemId: crafted.id, quantityDelta: 1 });
        latestInventory = hub.inventory;
        createdItem = createdItem ?? crafted;
        if (!appliedOverride && quantity === 1 && overrides) {
          appliedOverride = true;
        }
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
    createdItem,
  };
}

export async function applyItemWorkToCharacterV2(params: {
  characterId: string;
  action: BlacksmithItemWorkAction;
  baseItem: AdminItem;
  score: number;
  blacksmithLevel?: number;
  inventory?: InventoryState | null;
  overrides?: CraftedItemOverrides;
}): Promise<BlacksmithItemWorkApplyResult> {
  const { characterId, action, baseItem, score, blacksmithLevel = 0, inventory, overrides } = params;
  if (action.actionType === 'add_socket' || action.actionType === 'dismantle') {
    return applyItemWorkToCharacter({ characterId, action, baseItem, score, inventory, overrides });
  }

  const runtimeBacked = isRuntimeItemDefinition(baseItem) || Boolean(getPlayerItemInstanceByItemId(baseItem.id));
  const existingInstance = getPlayerItemInstanceByItemId(baseItem.id);
  const nextDraft = ensureRuntimeItemPayload(buildWorkedItemV2(baseItem, action, score, blacksmithLevel, overrides), characterId);
  let nextDefinition: AdminItem;
  let latestInventory = inventory ?? undefined;

  if (runtimeBacked) {
    nextDefinition = await itemsService.update(baseItem.id, { ...nextDraft, id: baseItem.id });
  } else {
    nextDefinition = await itemsService.create(nextDraft);
    const removeHub = await adjustDevInventoryItem(characterId, { itemId: baseItem.id, quantityDelta: -1 });
    const addHub = await adjustDevInventoryItem(characterId, { itemId: nextDefinition.id, quantityDelta: 1 });
    latestInventory = addHub.inventory ?? removeHub.inventory;
  }

  await syncItemInstanceRecord({
    item: nextDefinition,
    characterId,
    sourceItemId: runtimeBacked ? (existingInstance?.sourceItemId ?? baseItem.id) : baseItem.id,
    forgeScore: score,
    notes: `${action.name}:v2`,
  });

  const beforeStats = formatItemCoreStats(baseItem).join(', ');
  const afterStats = formatItemCoreStats(nextDefinition).join(', ');
  return {
    inventory: latestInventory,
    createdItem: nextDefinition,
    success: true,
    message: `${action.name}: ${baseItem.name} -> ${nextDefinition.name}. Р‘С‹Р»Рѕ: ${beforeStats}. РЎС‚Р°Р»Рѕ: ${afterStats}.`,
  };
}

export async function grantCustomForgeItemToCharacterV2(params: {
  characterId: string;
  template: BlacksmithItemTemplate;
  plan: BlacksmithCustomForgePlan;
  materialsCatalog: Material[];
  selectedCarpenterComponent?: BlacksmithCarpenterComponentOption | null;
  qualityTier?: BlacksmithQualityTier | null;
  score: number;
  blacksmithLevel?: number;
  overrides?: CraftedItemOverrides;
}): Promise<{ inventory?: InventoryState; createdItem?: AdminItem | null; success: boolean }> {
  const {
    characterId,
    template,
    plan,
    materialsCatalog,
    selectedCarpenterComponent,
    qualityTier,
    score,
    blacksmithLevel = 0,
    overrides,
  } = params;
  if ((qualityTier?.isFailureTier ?? false) || score < 20) {
    const salvageMap = { ...readStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY) };
    for (const entry of plan.selectedMaterials.slice(0, 3)) {
      incrementRecord(salvageMap, entry.materialId, 1);
    }
    writeStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY, salvageMap);
    return { success: false };
  }
  const baseDraft = createForgedItemFromTemplateV2({
    template,
    plan,
    materials: materialsCatalog,
    qualityTier: qualityTier ?? null,
    score,
    characterId,
    blacksmithLevel,
    overrides,
  });
  const carpenterContribution = deriveCarpenterComponentForgeContribution({
    template,
    component: selectedCarpenterComponent ?? null,
  });
  const createdDraft = ensureRuntimeItemPayload(
    applyCarpenterContributionToForgedItem(baseDraft, carpenterContribution),
    characterId,
  );
  const created = await itemsService.create(createdDraft);
  await syncItemInstanceRecord({
    item: created,
    characterId,
    qualityTierId: qualityTier?.id ?? null,
    forgeScore: score,
    craftedFromTemplateId: template.id,
    craftedMaterialIds: plan.selectedMaterials.map((entry) => entry.materialId),
    carpenterComponentsUsed: carpenterContribution?.carpenterComponentsUsed,
    notes: 'custom_forge_v2',
  });
  const hub = await adjustDevInventoryItem(characterId, { itemId: created.id, quantityDelta: 1 });
  let latestInventory = hub.inventory;
  if (selectedCarpenterComponent) {
    try {
      const consumeHub = await adjustDevInventoryItem(characterId, {
        itemId: selectedCarpenterComponent.itemId,
        quantityDelta: -1,
      });
      latestInventory = consumeHub.inventory;
      if (selectedCarpenterComponent.instanceId && consumeHub.inventory.items.every((row) => row.itemId !== selectedCarpenterComponent.itemId || row.quantity <= 0)) {
        removePlayerItemInstanceByItemId(selectedCarpenterComponent.itemId);
        await deleteArenaItemInstance(characterId, selectedCarpenterComponent.itemId).catch(() => undefined);
      }
    } catch {
      // keep forged result; component consumption can be retried manually if needed
    }
  }
  return { inventory: latestInventory, createdItem: created, success: true };
}

export async function grantRecipeOutputsToCharacterV2(params: {
  characterId: string;
  recipe: CraftingRecipe | null;
  baseInventory?: InventoryState | null;
  itemsCatalog: AdminItem[];
  materialsCatalog: Material[];
  qualityTier?: BlacksmithQualityTier | null;
  blacksmithLevel?: number;
  overrides?: CraftedItemOverrides;
}): Promise<{ inventory?: InventoryState; createdItem?: AdminItem | null }> {
  const { characterId, recipe, baseInventory, itemsCatalog, materialsCatalog, qualityTier, blacksmithLevel = 0, overrides } = params;
  const materialMap = { ...readStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY) };
  let latestInventory = baseInventory ?? undefined;
  let createdItem: AdminItem | null = null;
  let appliedOverride = false;
  const materialsById = new Map(materialsCatalog.map((entry) => [entry.id, entry]));
  const recipeSourceMaterials = (recipe?.inputMaterials ?? []).flatMap((entry) => {
    const material = materialsById.get(entry.materialId) ?? null;
    return material ? repeatMaterialByQuantity(material, entry.quantity ?? 1) : [];
  });

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
        const craftedDraft = ensureRuntimeItemPayload(createForgedItemFromBase(
          exactItem,
          recipe!,
          qualityTier ?? null,
          characterId,
          !appliedOverride && quantity === 1 ? overrides : undefined,
          recipeSourceMaterials,
          blacksmithLevel,
        ), characterId);
        const crafted = await itemsService.create(craftedDraft);
        await syncItemInstanceRecord({
          item: crafted,
          characterId,
          sourceItemId: exactItem.id,
          qualityTierId: qualityTier?.id ?? null,
          craftedMaterialIds: recipeSourceMaterials.map((material) => material.id),
          notes: `recipe:${recipe?.id ?? 'unknown'}:v2`,
        });
        const hub = await adjustDevInventoryItem(characterId, { itemId: crafted.id, quantityDelta: 1 });
        latestInventory = hub.inventory;
        createdItem = createdItem ?? crafted;
        if (!appliedOverride && quantity === 1 && overrides) {
          appliedOverride = true;
        }
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
    createdItem,
  };
}
