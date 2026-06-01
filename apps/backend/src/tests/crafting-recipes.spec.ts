import { describe, expect, it } from 'vitest';
import { collectMissingCraftingRecipeReferenceWarnings } from '../content/content.service';
import type { AdminItem, ContentDatabase, CraftingRecipe, Material } from '../content/content.types';

function makeItem(id: string): AdminItem {
  return {
    id,
    name: id,
    type: 'misc',
    rarity: 'common',
    price: 0,
    stackable: false,
    gameplayDescription: '',
    loreDescription: '',
    isEnabled: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function makeMaterial(id: string): Material {
  return {
    id,
    name: id,
    category: 'other',
    region: '',
    rarity: 'common',
    properties: [],
    gameplayDescription: '',
    loreDescription: '',
    isEnabled: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function makeRecipe(id: string): CraftingRecipe {
  return {
    id,
    name: id,
    status: 'draft',
    recipeType: 'smelting',
    professionId: 'blacksmithing',
    stationType: 'furnace',
    inputMaterials: [{ materialId: 'iron_ore', quantity: 3 }],
    inputItems: [],
    outputMaterials: [{ materialId: 'iron_ingot', quantity: 1 }],
    outputItems: [],
    resultMode: 'fixed',
    failureMode: 'none',
    isRepeatable: true,
    isEnabled: true,
    tags: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function makeDatabase(overrides: Partial<ContentDatabase> = {}): ContentDatabase {
  return {
    version: 1,
    items: [],
    skills: [],
    visualFx: [],
    merchants: [],
    cities: [],
    locations: [],
    materials: [],
    lootTables: [],
    images: [],
    dialogues: [],
    npcs: [],
    quests: [],
    questInteractions: [],
    questItems: [],
    questMarkers: [],
    battleMaps: [],
    craftingRecipes: [],
    itemSets: [],
    runeComplexes: [],
    worldMap: {
      zones: [],
      regions: [],
      questMarkers: [],
      updatedAt: '2026-06-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('crafting recipe helpers', () => {
  it('aggregates missing references across materials, items and skills', () => {
    const recipe = makeRecipe('recipe_smelting_iron_ingot');
    recipe.inputItems = [{ itemId: 'smith_hammer', quantity: 1, consume: false }];
    recipe.requiredBlueprintItemId = 'blueprint_iron_ingot';
    recipe.requiredSkillIds = ['skill_smelting', 'skill_missing'];

    const warnings = collectMissingCraftingRecipeReferenceWarnings(makeDatabase({
      materials: [makeMaterial('iron_ore')],
      items: [makeItem('smith_hammer')],
      skills: [{ id: 'skill_smelting' } as any],
      craftingRecipes: [recipe],
    }));

    expect(warnings).toEqual([
      "Crafting recipe 'recipe_smelting_iron_ingot' has missing output materials: iron_ingot",
      "Crafting recipe 'recipe_smelting_iron_ingot' has missing required skills: skill_missing",
      "Crafting recipe 'recipe_smelting_iron_ingot' references missing blueprint item 'blueprint_iron_ingot'.",
    ]);
  });

  it('warns about unknown professions for forward compatibility visibility', () => {
    const recipe = makeRecipe('recipe_unknown_profession');
    recipe.professionId = 'chronomancy';

    const warnings = collectMissingCraftingRecipeReferenceWarnings(makeDatabase({
      materials: [makeMaterial('iron_ore'), makeMaterial('iron_ingot')],
      craftingRecipes: [recipe],
    }));

    expect(warnings).toContain("Crafting recipe 'recipe_unknown_profession' uses unknown profession 'chronomancy'.");
  });
});
