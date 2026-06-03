import type { CraftingItemStack, CraftingMaterialStack, CraftingRecipe } from './models';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { nowIso, uid } from './storage';

function normalizeMaterialStacks(value: CraftingMaterialStack[] | undefined): CraftingMaterialStack[] {
  return Array.isArray(value)
    ? value
      .map((entry) => ({
        materialId: String(entry?.materialId ?? '').trim(),
        quantity: Math.max(1, Math.round(Number(entry?.quantity ?? 1) || 1)),
      }))
      .filter((entry) => Boolean(entry.materialId))
    : [];
}

function normalizeItemStacks(value: CraftingItemStack[] | undefined, options?: { keepConsume?: boolean }): CraftingItemStack[] {
  return Array.isArray(value)
    ? value
      .map((entry) => ({
        itemId: String(entry?.itemId ?? '').trim(),
        quantity: Math.max(1, Math.round(Number(entry?.quantity ?? 1) || 1)),
        consume: options?.keepConsume ? entry?.consume !== false : undefined,
      }))
      .filter((entry) => Boolean(entry.itemId))
    : [];
}

export function normalizeCraftingRecipe(recipe: CraftingRecipe): CraftingRecipe {
  const visualAnimationRefRaw = String(recipe.visualAnimationRef ?? '').trim();
  return {
    ...recipe,
    id: String(recipe.id ?? '').trim(),
    name: String(recipe.name ?? '').trim(),
    description: typeof recipe.description === 'string' && recipe.description.trim() ? recipe.description.trim() : undefined,
    professionId: String(recipe.professionId ?? '').trim(),
    requiredProfessionLevel: Number.isFinite(recipe.requiredProfessionLevel) ? Math.max(0, Math.round(recipe.requiredProfessionLevel ?? 0)) : undefined,
    requiredSkillIds: Array.isArray(recipe.requiredSkillIds)
      ? recipe.requiredSkillIds.map((entry) => String(entry ?? '').trim()).filter(Boolean)
      : [],
    requiredBlueprintItemId: typeof recipe.requiredBlueprintItemId === 'string' && recipe.requiredBlueprintItemId.trim()
      ? recipe.requiredBlueprintItemId.trim()
      : undefined,
    requiredQuestId: typeof recipe.requiredQuestId === 'string' && recipe.requiredQuestId.trim()
      ? recipe.requiredQuestId.trim()
      : undefined,
    inputMaterials: normalizeMaterialStacks(recipe.inputMaterials),
    inputItems: normalizeItemStacks(recipe.inputItems, { keepConsume: true }),
    outputMaterials: normalizeMaterialStacks(recipe.outputMaterials),
    outputItems: normalizeItemStacks(recipe.outputItems),
    resultPoolId: typeof recipe.resultPoolId === 'string' && recipe.resultPoolId.trim() ? recipe.resultPoolId.trim() : undefined,
    goldCost: Number.isFinite(recipe.goldCost) ? Math.max(0, Math.round(recipe.goldCost ?? 0)) : undefined,
    staminaCost: Number.isFinite(recipe.staminaCost) ? Math.max(0, Math.round(recipe.staminaCost ?? 0)) : undefined,
    timeSeconds: Number.isFinite(recipe.timeSeconds) ? Math.max(0, Math.round(recipe.timeSeconds ?? 0)) : undefined,
    successChance: Number.isFinite(recipe.successChance) ? Math.max(0, Math.min(100, recipe.successChance ?? 100)) : undefined,
    failureMode: recipe.failureMode ?? 'none',
    isRepeatable: recipe.isRepeatable !== false,
    isEnabled: recipe.isEnabled !== false,
    tags: Array.isArray(recipe.tags) ? recipe.tags.map((entry) => String(entry ?? '').trim()).filter(Boolean) : [],
    visualProfileId: typeof recipe.visualProfileId === 'string' && recipe.visualProfileId.trim() ? recipe.visualProfileId.trim() : undefined,
    visualImageRef: typeof recipe.visualImageRef === 'string' && recipe.visualImageRef.trim() ? recipe.visualImageRef.trim() : undefined,
    visualIconRef: typeof recipe.visualIconRef === 'string' && recipe.visualIconRef.trim() ? recipe.visualIconRef.trim() : undefined,
    visualAnimationRef: visualAnimationRefRaw ? visualAnimationRefRaw : null,
    visualMaterialFamily: typeof recipe.visualMaterialFamily === 'string' && recipe.visualMaterialFamily.trim()
      ? recipe.visualMaterialFamily
      : undefined,
    visualStyle: typeof recipe.visualStyle === 'string' && recipe.visualStyle.trim()
      ? recipe.visualStyle
      : undefined,
    createdAt: recipe.createdAt || nowIso(),
    updatedAt: recipe.updatedAt || nowIso(),
  };
}

export function validateCraftingRecipe(recipe: CraftingRecipe): string[] {
  const errors: string[] = [];
  if (!recipe.id.trim()) {
    errors.push('id required');
  }
  if (!recipe.name.trim()) {
    errors.push('name required');
  }
  if (!String(recipe.professionId ?? '').trim()) {
    errors.push('professionId required');
  }
  if (!recipe.recipeType) {
    errors.push('recipeType required');
  }
  if (!recipe.stationType) {
    errors.push('stationType required');
  }
  if (!Array.isArray(recipe.inputMaterials) || !Array.isArray(recipe.inputItems) || !Array.isArray(recipe.outputMaterials) || !Array.isArray(recipe.outputItems)) {
    errors.push('recipe IO collections must be arrays');
  }
  if ((recipe.inputMaterials?.length ?? 0) + (recipe.inputItems?.length ?? 0) === 0) {
    errors.push('recipe requires at least one input');
  }
  if (recipe.resultMode !== 'random_from_pool' && (recipe.outputMaterials?.length ?? 0) + (recipe.outputItems?.length ?? 0) === 0) {
    errors.push('fixed recipe requires at least one output');
  }
  if (recipe.resultMode === 'random_from_pool' && !String(recipe.resultPoolId ?? '').trim()) {
    errors.push('resultPoolId required for random_from_pool mode');
  }
  return errors;
}

export const craftingRecipesService = {
  async getAll(): Promise<CraftingRecipe[]> {
    return getContentCollection<CraftingRecipe>('craftingRecipes');
  },

  async getById(id: string): Promise<CraftingRecipe | null> {
    return getContentEntry<CraftingRecipe>('craftingRecipes', id);
  },

  async create(payload: CraftingRecipe): Promise<CraftingRecipe> {
    const next = normalizeCraftingRecipe({
      ...payload,
      id: payload.id?.trim() || uid('recipe'),
      createdAt: payload.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
    const errors = validateCraftingRecipe(next);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return createContentEntry<CraftingRecipe>('craftingRecipes', next);
  },

  async update(id: string, patch: Partial<CraftingRecipe>): Promise<CraftingRecipe> {
    const current = await this.getById(id);
    if (!current) {
      throw new Error(`Crafting recipe not found: ${id}`);
    }
    const next = normalizeCraftingRecipe({
      ...current,
      ...patch,
      id: current.id,
      updatedAt: nowIso(),
    });
    const errors = validateCraftingRecipe(next);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return updateContentEntry<CraftingRecipe>('craftingRecipes', id, next);
  },

  async disable(id: string): Promise<CraftingRecipe> {
    return this.update(id, { isEnabled: false, status: 'disabled' });
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('craftingRecipes', id);
  },
};
