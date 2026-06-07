const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../apps/backend/src/content/content.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Patch imports
const oldImports = `  QuestMarkerDefinition,
  SoundDefinition,
  StoredImage,
  WorldMapContent,
  WorldMapZone,
} from './content.types';`;

const newImports = `  QuestMarkerDefinition,
  SoundDefinition,
  StoredImage,
  WorldMapContent,
  WorldMapZone,
  TreeDefinition,
  BiomeDefinition,
} from './content.types';`;

if (content.includes(oldImports)) {
  content = content.replace(oldImports, newImports);
  console.log('1. Imports patched.');
} else {
  console.log('1. Warning: imports target not found.');
}

// 2. Patch CONTENT_COLLECTIONS
const oldCollections = `const CONTENT_COLLECTIONS: ContentCollectionName[] = [
  'items',
  'skills',
  'visualFx',
  'merchants',
  'cities',
  'locations',
  'materials',
  'lootTables',
  'images',
  'dialogues',
  'npcs',
  'quests',
  'questInteractions',
  'questItems',
  'questMarkers',
  'battleMaps',
  'craftingRecipes',
  'recipeVisualProfiles',
  'itemSets',
  'runeComplexes',
  'blacksmithForgeTiers',
  'blacksmithModules',
  'blacksmithTools',
  'blacksmithQualityTiers',
  'blacksmithVisualPresets',
  'blacksmithBalance',
  'blacksmithItemTemplates',
  'blacksmithItemWorkActions',
  'sounds',
];`;

const newCollections = `const CONTENT_COLLECTIONS: ContentCollectionName[] = [
  'items',
  'skills',
  'visualFx',
  'merchants',
  'cities',
  'locations',
  'materials',
  'lootTables',
  'images',
  'dialogues',
  'npcs',
  'quests',
  'questInteractions',
  'questItems',
  'questMarkers',
  'battleMaps',
  'craftingRecipes',
  'recipeVisualProfiles',
  'itemSets',
  'runeComplexes',
  'blacksmithForgeTiers',
  'blacksmithModules',
  'blacksmithTools',
  'blacksmithQualityTiers',
  'blacksmithVisualPresets',
  'blacksmithBalance',
  'blacksmithItemTemplates',
  'blacksmithItemWorkActions',
  'sounds',
  'trees',
  'biomes',
];`;

if (content.includes(oldCollections)) {
  content = content.replace(oldCollections, newCollections);
  console.log('2. CONTENT_COLLECTIONS patched.');
} else {
  console.log('2. Warning: CONTENT_COLLECTIONS target not found.');
}

// 3. Patch createEmptyDatabase
const oldEmptyDb = `    sounds: [],
    worldMap: {`;

const newEmptyDb = `    sounds: [],
    trees: [],
    biomes: [],
    worldMap: {`;

if (content.includes(oldEmptyDb)) {
  content = content.replace(oldEmptyDb, newEmptyDb);
  console.log('3. createEmptyDatabase patched.');
} else {
  console.log('3. Warning: createEmptyDatabase target not found.');
}

// 4. Add normalizers
const oldNormMarker = `function normalizeQuestItemInput(input: QuestItemDefinition): QuestItemDefinition {`;

const newNorms = `function normalizeTreeInput(input: TreeDefinition): TreeDefinition {
  const now = nowIso();
  const imageRef = normalizeGameImageRefInput(input.imageRef, input.imagePath);
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    description: input.description ? String(input.description).trim() : undefined,
    region: String(input.region ?? '').trim(),
    biomeIds: Array.isArray(input.biomeIds) ? input.biomeIds.map(id => String(id).trim()).filter(Boolean) : [],
    tier: typeof input.tier === 'number' && Number.isFinite(input.tier) ? Math.max(1, Math.round(input.tier)) : 1,
    rarity: input.rarity || 'common',
    hp: typeof input.hp === 'number' && Number.isFinite(input.hp) ? Math.max(1, Math.round(input.hp)) : 100,
    hardness: typeof input.hardness === 'number' && Number.isFinite(input.hardness) ? Math.max(0, Math.round(input.hardness)) : 1,
    stability: typeof input.stability === 'number' && Number.isFinite(input.stability) ? Math.max(0, Math.round(input.stability)) : 100,
    fallRisk: typeof input.fallRisk === 'number' && Number.isFinite(input.fallRisk) ? Math.max(0, input.fallRisk) : 10,
    requiredWoodcuttingTier: typeof input.requiredWoodcuttingTier === 'number' && Number.isFinite(input.requiredWoodcuttingTier) ? Math.max(1, Math.round(input.requiredWoodcuttingTier)) : 1,
    requiredToolTier: typeof input.requiredToolTier === 'number' && Number.isFinite(input.requiredToolTier) ? Math.max(1, Math.round(input.requiredToolTier)) : 1,
    baseXp: typeof input.baseXp === 'number' && Number.isFinite(input.baseXp) ? Math.max(0, Math.round(input.baseXp)) : 10,
    weight: typeof input.weight === 'number' && Number.isFinite(input.weight) ? Math.max(1, Math.round(input.weight)) : 10,
    drops: Array.isArray(input.drops)
      ? input.drops.map((drop) => ({
          itemId: String(drop.itemId ?? '').trim(),
          min: typeof drop.min === 'number' && Number.isFinite(drop.min) ? Math.max(0, Math.round(drop.min)) : 0,
          max: typeof drop.max === 'number' && Number.isFinite(drop.max) ? Math.max(0, Math.round(drop.max)) : 0,
          chance: typeof drop.chance === 'number' && Number.isFinite(drop.chance) ? Math.max(0, Math.min(100, drop.chance)) : 0,
        })).filter(d => Boolean(d.itemId))
      : [],
    enabled: input.enabled !== false,
    imagePath: toLegacyImagePath(imageRef, input.imagePath),
    imageRef,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function normalizeBiomeInput(input: BiomeDefinition): BiomeDefinition {
  const now = nowIso();
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    region: String(input.region ?? '').trim(),
    climate: String(input.climate ?? '').trim(),
    dangerLevel: typeof input.dangerLevel === 'number' && Number.isFinite(input.dangerLevel) ? Math.max(0, Math.round(input.dangerLevel)) : 0,
    defaultTreePool: Array.isArray(input.defaultTreePool) ? input.defaultTreePool.map(id => String(id).trim()).filter(Boolean) : [],
    allowedResourceKinds: Array.isArray(input.allowedResourceKinds) ? input.allowedResourceKinds.map(kind => String(kind).trim()).filter(Boolean) : [],
    description: String(input.description ?? '').trim(),
    enabled: input.enabled !== false,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function normalizeQuestItemInput(input: QuestItemDefinition): QuestItemDefinition {`;

if (content.includes(oldNormMarker) && !content.includes('normalizeTreeInput')) {
  content = content.replace(oldNormMarker, newNorms);
  console.log('4. Normalizers added.');
} else {
  console.log('4. Warning: normalizers marker not found or already added.');
}

// 5. Patch normalizeDatabase
const oldNormalizeDb = `      sounds: sanitizeIdObjectArray<SoundDefinition>(raw.sounds).filter((entry) => Boolean(entry.id)),`;

const newNormalizeDb = `      sounds: sanitizeIdObjectArray<SoundDefinition>(raw.sounds).filter((entry) => Boolean(entry.id)),
      trees: sanitizeIdObjectArray<TreeDefinition>(raw.trees).map((entry) => normalizeTreeInput(entry)).filter((entry) => Boolean(entry.id)),
      biomes: sanitizeIdObjectArray<BiomeDefinition>(raw.biomes).map((entry) => normalizeBiomeInput(entry)).filter((entry) => Boolean(entry.id)),`;

if (content.includes(oldNormalizeDb) && !content.includes('trees: sanitizeIdObjectArray<TreeDefinition>')) {
  content = content.replace(oldNormalizeDb, newNormalizeDb);
  console.log('5. normalizeDatabase patched.');
} else {
  console.log('5. Warning: normalizeDatabase target not found or already added.');
}

// 6. Patch createCollectionEntry
const oldCreate = `    } else if (collectionName === 'blacksmithItemWorkActions') {
      nextEntry = normalizeBlacksmithItemWorkActionInput(payload as unknown as BlacksmithItemWorkAction) as unknown as ContentCollectionMap[K];
    } else {`;

const newCreate = `    } else if (collectionName === 'blacksmithItemWorkActions') {
      nextEntry = normalizeBlacksmithItemWorkActionInput(payload as unknown as BlacksmithItemWorkAction) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'trees') {
      nextEntry = normalizeTreeInput(payload as unknown as TreeDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'biomes') {
      nextEntry = normalizeBiomeInput(payload as unknown as BiomeDefinition) as unknown as ContentCollectionMap[K];
    } else {`;

if (content.includes(oldCreate) && !content.includes(`collectionName === 'trees'`)) {
  content = content.replace(oldCreate, newCreate);
  console.log('6. createCollectionEntry patched.');
} else {
  console.log('6. Warning: createCollectionEntry target not found or already added.');
}

// 7. Patch updateCollectionEntry
const oldUpdate = `    } else if (collectionName === 'blacksmithItemWorkActions') {
      merged = normalizeBlacksmithItemWorkActionInput(mergedBase as unknown as BlacksmithItemWorkAction) as unknown as ContentCollectionMap[K];
    } else {`;

const newUpdate = `    } else if (collectionName === 'blacksmithItemWorkActions') {
      merged = normalizeBlacksmithItemWorkActionInput(mergedBase as unknown as BlacksmithItemWorkAction) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'trees') {
      merged = normalizeTreeInput(mergedBase as unknown as TreeDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'biomes') {
      merged = normalizeBiomeInput(mergedBase as unknown as BiomeDefinition) as unknown as ContentCollectionMap[K];
    } else {`;

if (content.includes(oldUpdate) && !content.includes(`collectionName === 'trees'`)) {
  content = content.replace(oldUpdate, newUpdate);
  console.log('7. updateCollectionEntry patched.');
} else {
  console.log('7. Warning: updateCollectionEntry target not found or already added.');
}

// 8. Patch importLegacy
const oldImport = `    return this.persist(db);
  }

  async seedDefaultsIfEmpty(): Promise<{ seeded: boolean; message: string }> {`;

const newImport = `    if (Array.isArray(payload.trees) && payload.trees.length > 0) {
      const normalized = payload.trees.map((entry) => normalizeTreeInput(entry as TreeDefinition));
      db.trees = mergeById(db.trees ?? [], normalized);
    }
    if (Array.isArray(payload.biomes) && payload.biomes.length > 0) {
      const normalized = payload.biomes.map((entry) => normalizeBiomeInput(entry as BiomeDefinition));
      db.biomes = mergeById(db.biomes ?? [], normalized);
    }
    return this.persist(db);
  }

  async seedDefaultsIfEmpty(): Promise<{ seeded: boolean; message: string }> {`;

if (content.includes(oldImport) && !content.includes('payload.trees) && payload.trees.length > 0')) {
  content = content.replace(oldImport, newImport);
  console.log('8. importLegacy patched.');
} else {
  console.log('8. Warning: importLegacy target not found or already added.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched file written successfully.');
