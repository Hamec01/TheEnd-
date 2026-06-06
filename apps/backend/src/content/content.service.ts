import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  EMPTY_EQUIPMENT,
  CastType,
  ITEMS,
  MERCHANTS,
  SkillType,
  validateSkillDefinition,
  getItemHandsRequired,
  type AdminSkillDefinition,
  type BattleMapDefinition,
  type ArenaCombatEquipmentModifiers,
  type Equipment,
  type ItemDefinition,
  type Merchant,
  type StatBlock,
  type VisualFxDefinition,
} from '@theend/rpg-domain';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { getContentStorageMode, type ContentStorageMode } from '../config/storage-mode';
import { PrismaService } from '../prisma/prisma.service';
import { isEmbeddedAudioDataUrl, isEmbeddedDataUrl, writeStaticAudioFile, writeStoredAudioAsset, writeStoredImageAsset } from './content-assets';
import type {
  AdminItem,
  AdminMerchant,
  BlacksmithBalance,
  BlacksmithForgeTier,
  BlacksmithModule,
  BlacksmithQualityTier,
  BlacksmithTool,
  BlacksmithVisualPreset,
  BlacksmithItemTemplate,
  BlacksmithItemWorkAction,
  City,
  CityLocation,
  CraftingRecipe,
  WorldLocation,
  ContentBackupEnvelope,
  ContentAutosaveStatus,
  ContentCollectionMap,
  ContentCollectionName,
  ContentDatabase,
  ContentImportMode,
  ContentImportResult,
  DialogueDefinition,
  GameImageRef,
  ItemEffect,
  ItemSet,
  ItemSocket,
  ItemRarity,
  LootTable,
  Material,
  MerchantItem,
  NpcDefinition,
  PaintedRegion,
  RecipeVisualProfile,
  QuestDefinition,
  RuneComplex,
  QuestInteractionDefinition,
  QuestInteractionRequirement,
  QuestItemDefinition,
  QuestMarkerDefinition,
  SoundDefinition,
  StoredImage,
  WorldMapContent,
  WorldMapZone,
} from './content.types';
import type {
  WorldNpcArchetype,
  WorldRoute,
  WorldSimConfig,
  WorldSpawnRule,
} from '../worldsim/types/world-simulation.types';
import { aggregateArenaCombatEquipmentModifiers } from './arena-combat-modifiers';
import { applyPassiveStatBonusesToStatBlock, resolveCharacterEquipmentModifiers } from './item-effects.resolver';

const CONTENT_DB_VERSION = 1 as const;
const CONTENT_COLLECTIONS: ContentCollectionName[] = [
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
];
const BUILTIN_MERCHANT_IDS = new Set(MERCHANTS.map((merchant) => merchant.id));
const CONTENT_DB_BACKUP_DIR = 'backups';
const CONTENT_DB_BACKUP_SLOTS = 3;
const CONTENT_AUTOSAVE_DIR = 'autosaves';
const CONTENT_AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000;
const CONTENT_AUTOSAVE_SLOTS = 3;
const CONTENT_AUTOSAVE_FILE_PREFIX = 'theend_content_autosave_';
const BUILTIN_PLACEHOLDER_IMAGE_IDS = new Set(['unknown']);
const CONTENT_STORE_KEY = 'main-content-db';
const CONTENT_BACKUP_SCHEMA_VERSION = 2;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type InputJsonValue = JsonValue;
type StoredImageAssetPayload = Partial<StoredImage> & { folder?: string; dataUrl?: string };
type StoredAudioAssetPayload = {
  id?: string;
  name?: string;
  mimeType?: string;
  folder?: string;
  dataUrl?: string;
};

function extractAssetsUploadFolder(publicUrl?: string): string | undefined {
  const normalized = String(publicUrl ?? '').trim();
  if (!normalized.startsWith('/assets/upload/')) {
    return undefined;
  }
  const relative = normalized.slice('/assets/upload/'.length);
  const parts = relative.split('/').filter(Boolean);
  if (parts.length <= 1) {
    return undefined;
  }
  return parts.slice(0, -1).join('/');
}

function nowIso(): string {
  return new Date().toISOString();
}

function isTruthyEnv(value: string | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getFileMtimeMs(filePath: string): number {
  try {
    return existsSync(filePath) ? statSync(filePath).mtimeMs : 0;
  } catch {
    return 0;
  }
}

function countContent(db: ContentDatabase): Record<string, number> {
  return {
    items: db.items.length,
    skills: db.skills.length,
    visualFx: db.visualFx.length,
    merchants: db.merchants.length,
    cities: db.cities.length,
    locations: db.locations.length,
    materials: db.materials.length,
    lootTables: db.lootTables.length,
    images: db.images.length,
    dialogues: db.dialogues.length,
    npcs: db.npcs.length,
    quests: db.quests.length,
    questInteractions: db.questInteractions.length,
    questItems: db.questItems.length,
    questMarkers: db.questMarkers.length,
    battleMaps: db.battleMaps.length,
    craftingRecipes: (db.craftingRecipes ?? []).length,
    recipeVisualProfiles: (db.recipeVisualProfiles ?? []).length,
    itemSets: (db.itemSets ?? []).length,
    runeComplexes: (db.runeComplexes ?? []).length,
    blacksmithForgeTiers: (db.blacksmithForgeTiers ?? []).length,
    blacksmithModules: (db.blacksmithModules ?? []).length,
    blacksmithTools: (db.blacksmithTools ?? []).length,
    blacksmithQualityTiers: (db.blacksmithQualityTiers ?? []).length,
    blacksmithVisualPresets: (db.blacksmithVisualPresets ?? []).length,
    blacksmithBalance: (db.blacksmithBalance ?? []).length,
    blacksmithItemTemplates: (db.blacksmithItemTemplates ?? []).length,
    blacksmithItemWorkActions: (db.blacksmithItemWorkActions ?? []).length,
    sounds: (db.sounds ?? []).length,
    maps: db.battleMaps.length,
    zones: db.worldMap.zones.length,
    markers: db.questMarkers.length + (db.worldMap.questMarkers?.length ?? 0),
    regions: db.worldMap.regions.length,
  };
}

function resolveGitCommit(): string | undefined {
  return String(
    process.env.GIT_COMMIT
      ?? process.env.VERCEL_GIT_COMMIT_SHA
      ?? process.env.RENDER_GIT_COMMIT
      ?? '',
  ).trim() || undefined;
}

function normalizePositiveMultiplier(value: number | undefined, fallback = 1): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function toAdminType(item: ItemDefinition): AdminItem['type'] {
  if (item.itemType === 'consumable') {
    return 'potion';
  }
  if (item.itemType === 'weapon') {
    return 'weapon';
  }
  if (['helmet', 'necklace', 'armor', 'outerwear', 'belt', 'gloves', 'shield', 'ring', 'legs', 'boots'].includes(item.itemType)) {
    return 'armor';
  }
  return 'misc';
}

function normalizeAdminSlot(slot: AdminItem['slot'] | string | undefined): AdminItem['slot'] {
  switch (slot) {
    case 'cloak':
      return 'outerwear';
    case 'knees':
      return 'legs';
    case 'charm':
      return 'necklace';
    case 'trinket':
      return 'ring';
    default:
      return (slot as AdminItem['slot']) ?? 'none';
  }
}

function toAdminSlot(item: ItemDefinition): AdminItem['slot'] {
  if (item.itemType === 'weapon') {
    return 'rightHand';
  }
  if (item.itemType === 'consumable') {
    return 'quick';
  }
  if (item.itemType === 'helmet') {
    return 'head';
  }
  if (item.itemType === 'necklace') {
    return 'necklace';
  }
  if (item.itemType === 'armor') {
    return 'chest';
  }
  if (item.itemType === 'outerwear') {
    return 'outerwear';
  }
  if (item.itemType === 'belt') {
    return 'belt';
  }
  if (item.itemType === 'ring') {
    return 'ring';
  }
  if (item.itemType === 'legs') {
    return 'legs';
  }
  if (item.itemType === 'boots') {
    return 'boots';
  }
  if (item.itemType === 'gloves') {
    return 'gloves';
  }
  if (item.itemType === 'shield') {
    return 'leftHand';
  }
  return 'none';
}

function merchantTypeToAdmin(merchant: Merchant): AdminMerchant['type'] {
  if (merchant.merchantType === 'weaponsmith') {
    return 'blacksmith';
  }
  if (merchant.merchantType === 'armorer') {
    return 'general';
  }
  return 'alchemist';
}

function mapDomainRarity(rarity: ItemDefinition['rarity']): ItemRarity {
  if (rarity === 'common' || rarity === 'uncommon' || rarity === 'rare') {
    return rarity;
  }
  return 'rare';
}

function seedItemFromDomain(item: ItemDefinition, timestamp: string): AdminItem {
  return {
    id: item.id,
    name: item.name,
    type: toAdminType(item),
    subtype: item.itemSubType,
    slot: toAdminSlot(item),
    handsRequired: item.handsRequired ?? 1,
    rarity: mapDomainRarity(item.rarity),
    price: item.price,
    stackable: item.stackable,
    maxStack: item.stackable ? 99 : 1,
    requiredStats: item.requiredStats,
    bonuses: item.bonuses,
    gameplayDescription: item.description,
    loreDescription: item.description,
    imagePath: item.icon,
    isEnabled: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function seedMerchantFromDomain(merchant: Merchant, timestamp: string): AdminMerchant {
  return {
    id: merchant.id,
    name: merchant.name,
    city: 'Arklein',
    cityId: 'city_arklein',
    location: 'Main District',
    type: merchantTypeToAdmin(merchant),
    description: `${merchant.name} (seeded)`,
    portraitPath: '',
    priceMultiplier: 1,
    isEnabled: true,
    items: merchant.itemIds.map((itemId) => ({
      itemId,
      stock: 10,
      infiniteStock: true,
      priceOverride: undefined,
      priceMultiplier: 1,
      isEnabled: true,
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createStarterCityLocation(cityId: string, id: string, name: string, type: CityLocation['type']): CityLocation {
  return {
    id,
    cityId,
    name,
    type,
    description: '',
    shapeType: 'rectangle',
    shape: { x: 120, y: 120, width: 120, height: 80 },
    npcIds: [],
    questIds: [],
    shopIds: [],
    isVisible: true,
    isUnlocked: true,
    markerIcon: type,
  };
}

function seedStarterCities(timestamp: string): City[] {
  const cityId = 'city_arklein';

  return [
    {
      id: cityId,
      slug: 'arklein',
      name: 'Арклейн',
      kingdomId: 'argos',
      regionId: 'teramor',
      worldZoneId: cityId,
      status: 'active',
      shortDescription: 'Пограничный город-крепость Аргоса.',
      fullDescription: 'Арклейн стоит на напряжённой границе и служит военным, торговым и политическим узлом.',
      history: '',
      loreNotes: '',
      populationTotal: 12000,
      racePopulation: [
        { raceId: 'human', percent: 82, role: 'citizens, soldiers, merchants' },
        { raceId: 'dwarf', percent: 10, role: 'smiths, engineers' },
        { raceId: 'wood_elf', percent: 8, role: 'scouts, healers' },
      ],
      rulerName: 'Барон Арклейна',
      rulerTitle: 'baron',
      governmentType: 'military border rule',
      economyTags: ['fortress', 'trade', 'blacksmith'],
      cultureTags: ['military', 'border', 'human'],
      dangerLevel: 4,
      recommendedLevel: 1,
      climate: 'temperate',
      visualTheme: 'dark medieval fortress',
      locations: [
        createStarterCityLocation(cityId, 'gate_main', 'Главные ворота', 'gate'),
        createStarterCityLocation(cityId, 'market_square', 'Рыночная площадь', 'market'),
        createStarterCityLocation(cityId, 'blacksmith_old', 'Старая кузница', 'blacksmith'),
        createStarterCityLocation(cityId, 'tavern_wolf', 'Таверна Волчий Дым', 'tavern'),
      ],
      connectedCityIds: [],
      connectedZoneIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}

function normalizeCityInput(input: City): City {
  const cityId = String(input.id ?? '').trim();
  return {
    ...clone(input),
    id: cityId,
    slug: input.slug?.trim() || undefined,
    name: String(input.name ?? '').trim(),
    kingdomId: String(input.kingdomId ?? '').trim(),
    regionId: input.regionId?.trim() || undefined,
    worldZoneId: input.worldZoneId?.trim() || undefined,
    status: input.status,
    ownerFactionId: input.ownerFactionId?.trim() || undefined,
    entryRequirement: input.entryRequirement?.trim() || undefined,
    shortDescription: String(input.shortDescription ?? '').trim(),
    fullDescription: String(input.fullDescription ?? '').trim(),
    history: input.history?.trim() || undefined,
    loreNotes: input.loreNotes?.trim() || undefined,
    populationTotal: typeof input.populationTotal === 'number' && Number.isFinite(input.populationTotal)
      ? Math.max(0, Math.round(input.populationTotal))
      : undefined,
    racePopulation: Array.isArray(input.racePopulation)
      ? input.racePopulation
        .map((entry) => ({
          raceId: String(entry.raceId ?? '').trim(),
          count: typeof entry.count === 'number' && Number.isFinite(entry.count) ? Math.max(0, Math.round(entry.count)) : undefined,
          percent: typeof entry.percent === 'number' && Number.isFinite(entry.percent) ? Math.max(0, Math.min(100, entry.percent)) : undefined,
          role: entry.role?.trim() || undefined,
        }))
        .filter((entry) => Boolean(entry.raceId))
      : [],
    rulerNpcId: input.rulerNpcId?.trim() || undefined,
    rulerName: input.rulerName?.trim() || undefined,
    rulerTitle: input.rulerTitle?.trim() || undefined,
    governmentType: input.governmentType?.trim() || undefined,
    economyTags: Array.isArray(input.economyTags) ? input.economyTags.map((entry) => String(entry).trim()).filter(Boolean) : [],
    cultureTags: Array.isArray(input.cultureTags) ? input.cultureTags.map((entry) => String(entry).trim()).filter(Boolean) : [],
    dangerLevel: typeof input.dangerLevel === 'number' && Number.isFinite(input.dangerLevel) ? Math.max(0, Math.round(input.dangerLevel)) : undefined,
    recommendedLevel: typeof input.recommendedLevel === 'number' && Number.isFinite(input.recommendedLevel) ? Math.max(0, Math.round(input.recommendedLevel)) : undefined,
    climate: input.climate?.trim() || undefined,
    visualTheme: input.visualTheme?.trim() || undefined,
    backgroundImageId: input.backgroundImageId?.trim() || undefined,
    backgroundImageUrl: input.backgroundImageUrl?.trim() || undefined,
    thumbnailImageId: input.thumbnailImageId?.trim() || undefined,
    music: normalizeAudioCueInput(input.music),
    ambientSound: normalizeAudioCueInput(input.ambientSound),
    locations: Array.isArray(input.locations)
      ? input.locations
        .map((location) => ({
          ...clone(location),
          id: String(location.id ?? '').trim(),
          cityId,
          name: String(location.name ?? '').trim(),
          description: location.description?.trim() || undefined,
          imageId: location.imageId?.trim() || undefined,
          music: normalizeAudioCueInput(location.music),
          ambientSound: normalizeAudioCueInput(location.ambientSound),
          npcIds: Array.isArray(location.npcIds) ? location.npcIds.map((entry) => String(entry).trim()).filter(Boolean) : [],
          autoTriggers: Array.isArray((location as any).autoTriggers)
            ? (location as any).autoTriggers
              .map((trigger: any) => ({
                npcId: String(trigger?.npcId ?? '').trim(),
                dialogueId: String(trigger?.dialogueId ?? '').trim(),
                condition: trigger?.condition?.trim() || undefined,
                once: trigger?.once !== undefined ? Boolean(trigger.once) : undefined,
              }))
              .filter((trigger: any) => Boolean(trigger.npcId && trigger.dialogueId))
            : undefined,
          questIds: Array.isArray(location.questIds) ? location.questIds.map((entry) => String(entry).trim()).filter(Boolean) : [],
          shopIds: Array.isArray(location.shopIds) ? location.shopIds.map((entry) => String(entry).trim()).filter(Boolean) : [],
          unlockCondition: location.unlockCondition?.trim() || undefined,
          markerIcon: location.markerIcon?.trim() || undefined,
          linkedBattleMapId: location.linkedBattleMapId?.trim() || undefined,
          encounter: location.encounter
            ? {
              kind: location.encounter.kind,
              arenaMasterNpcId: location.encounter.arenaMasterNpcId?.trim() || undefined,
              battleMapIds: Array.isArray(location.encounter.battleMapIds)
                ? location.encounter.battleMapIds.map((entry) => String(entry).trim()).filter(Boolean)
                : undefined,
              presets: Array.isArray(location.encounter.presets)
                ? location.encounter.presets
                  .map((preset) => {
                    const type = preset?.type;
                    if (type !== 'pve' && type !== 'pvp' && type !== 'random' && type !== 'scripted') {
                      return null;
                    }
                    return {
                      id: String(preset?.id ?? '').trim(),
                      label: String(preset?.label ?? '').trim(),
                      type,
                      battleMapId: preset?.battleMapId?.trim() || undefined,
                      enemyCount: typeof preset?.enemyCount === 'number' && Number.isFinite(preset.enemyCount) ? Math.max(1, Math.round(preset.enemyCount)) : undefined,
                      playerTurnSeconds: typeof preset?.playerTurnSeconds === 'number' && Number.isFinite(preset.playerTurnSeconds) ? Math.max(5, Math.round(preset.playerTurnSeconds)) : undefined,
                      notes: preset?.notes?.trim() || undefined,
                    };
                  })
                  .filter((preset): preset is NonNullable<typeof preset> => Boolean(preset?.id && preset?.label))
                : undefined,
              allowPvE: location.encounter.allowPvE !== undefined ? Boolean(location.encounter.allowPvE) : undefined,
              allowPvP: location.encounter.allowPvP !== undefined ? Boolean(location.encounter.allowPvP) : undefined,
              allowRandomEnemyGeneration: location.encounter.allowRandomEnemyGeneration !== undefined ? Boolean(location.encounter.allowRandomEnemyGeneration) : undefined,
            }
            : undefined,
        }))
        .filter((location) => Boolean(location.id && location.name))
      : [],
    connectedCityIds: Array.isArray(input.connectedCityIds) ? input.connectedCityIds.map((entry) => String(entry).trim()).filter(Boolean) : [],
    connectedZoneIds: Array.isArray(input.connectedZoneIds) ? input.connectedZoneIds.map((entry) => String(entry).trim()).filter(Boolean) : [],
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
  };
}

function createEmptyDatabase(): ContentDatabase {
  const timestamp = nowIso();
  return {
    version: CONTENT_DB_VERSION,
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
    recipeVisualProfiles: [],
    itemSets: [],
    runeComplexes: [],
    blacksmithForgeTiers: [],
    blacksmithModules: [],
    blacksmithTools: [],
    blacksmithQualityTiers: [],
    blacksmithVisualPresets: [],
    blacksmithBalance: [],
    blacksmithItemTemplates: [],
    blacksmithItemWorkActions: [],
    sounds: [],
    worldMap: {
      zones: [],
      regions: [],
      questMarkers: [],
      updatedAt: timestamp,
    },
  };
}

function seedBlacksmithForgeTiers(): BlacksmithForgeTier[] {
  return [
    {
      id: 'forge_tier_apprentice',
      name: 'Ученический горн',
      description: 'Базовый горн для простой ковки и обработки.',
      tier: 1,
      requiredBlacksmithLevel: 1,
      requiredSkillIds: [],
      allowedRecipeTypes: ['material_processing', 'smelting', 'blacksmith_craft'],
      allowedRecipeGroups: ['starter', 'basic_weapons', 'basic_armor'],
      allowedMaterialTiers: ['common'],
      heatControlBonus: 2,
      qualityCapBonus: 0,
      failureChanceReduction: 0,
      moduleSlotLimits: { airflow: 1, support: 1, quench: 1 },
      visualPresetId: 'blacksmith_visual_default',
      isEnabled: true,
    },
    {
      id: 'forge_tier_master',
      name: 'Мастерский горн',
      description: 'Усиленный горн для точной и сложной работы.',
      tier: 2,
      requiredBlacksmithLevel: 10,
      requiredSkillIds: ['blacksmith_fine_work'],
      allowedRecipeTypes: ['material_processing', 'smelting', 'blacksmith_craft', 'runecrafting'],
      allowedRecipeGroups: ['advanced_weapons', 'advanced_armor', 'settings', 'rune_surface'],
      allowedMaterialTiers: ['common', 'uncommon', 'rare'],
      heatControlBonus: 5,
      qualityCapBonus: 8,
      failureChanceReduction: 4,
      moduleSlotLimits: { airflow: 2, support: 2, quench: 2, precision: 1 },
      visualPresetId: 'blacksmith_visual_default',
      isEnabled: true,
    },
  ];
}

function seedBlacksmithModules(): BlacksmithModule[] {
  return [
    {
      id: 'module_airflow_bellows_basic',
      name: 'Простые меха',
      moduleType: 'airflow',
      tier: 1,
      description: 'Стабилизируют подачу воздуха к печи.',
      bonuses: { heatControlBonus: 3, overheatChanceReduction: 2 },
      requiredBlacksmithLevel: 2,
      requiredSkillIds: ['blacksmith_basic_forging'],
      compatibleForgeTierIds: ['forge_tier_apprentice', 'forge_tier_master'],
      imageRef: 'unknown',
      isEnabled: true,
    },
    {
      id: 'module_quench_trough_reinforced',
      name: 'Усиленная ванна закалки',
      moduleType: 'quench',
      tier: 2,
      description: 'Снижает риск дефектов при закалке.',
      bonuses: { defectChanceReduction: 5, quenchStabilityBonus: 8 },
      requiredBlacksmithLevel: 8,
      requiredSkillIds: ['blacksmith_simple_tempering'],
      compatibleForgeTierIds: ['forge_tier_master'],
      imageRef: 'unknown',
      isEnabled: true,
    },
  ];
}

function seedBlacksmithTools(): BlacksmithTool[] {
  return [
    {
      id: 'tool_hammer_apprentice',
      name: 'Молот ученика',
      toolType: 'hammer',
      tier: 1,
      description: 'Базовый молот для ровного темпа ударов.',
      bonuses: { strikePrecisionBonus: 4 },
      minResultFloor: 10,
      specialRules: ['safe_start_window'],
      imageRef: 'unknown',
      isEnabled: true,
    },
    {
      id: 'tool_tongs_balanced',
      name: 'Балансные щипцы',
      toolType: 'tongs',
      tier: 1,
      description: 'Повышают контроль заготовки.',
      bonuses: { heatDriftReduction: 5 },
      minResultFloor: 8,
      specialRules: ['reduced_slip_chance'],
      imageRef: 'unknown',
      isEnabled: true,
    },
    {
      id: 'tool_quench_ladle_master',
      name: 'Мастерский ковш закалки',
      toolType: 'quench',
      tier: 2,
      description: 'Даёт точный контроль на этапе закалки.',
      bonuses: { quenchControlBonus: 10, crackChanceReduction: 4 },
      minResultFloor: 15,
      specialRules: ['quench_sweetspot_bonus'],
      imageRef: 'unknown',
      isEnabled: true,
    },
  ];
}

function seedBlacksmithQualityTiers(): BlacksmithQualityTier[] {
  return [
    { id: 'quality_failed', name: 'Брак', minScore: 0, maxScore: 29, priceMultiplier: 0.35, xpMultiplier: 0.4, statMultiplier: 0.5, frameImageRef: 'unknown', isFailureTier: true },
    { id: 'quality_normal', name: 'Нормальное', minScore: 30, maxScore: 59, priceMultiplier: 1, xpMultiplier: 1, statMultiplier: 1, frameImageRef: 'unknown', isFailureTier: false },
    { id: 'quality_fine', name: 'Качественное', minScore: 60, maxScore: 84, priceMultiplier: 1.35, xpMultiplier: 1.2, statMultiplier: 1.12, frameImageRef: 'unknown', isFailureTier: false },
    { id: 'quality_masterwork', name: 'Шедевр', minScore: 85, maxScore: 100, priceMultiplier: 1.8, xpMultiplier: 1.45, statMultiplier: 1.25, frameImageRef: 'unknown', isFailureTier: false },
  ];
}

function seedBlacksmithVisualPresets(): BlacksmithVisualPreset[] {
  return [
    {
      id: 'blacksmith_visual_default',
      name: 'Стандартная кузница',
      backgroundImageRef: 'unknown',
      anvilImageRef: 'unknown',
      furnaceImageRef: 'unknown',
      hammerImageRefs: [],
      defectOverlayRefs: [],
      blankImageRefs: [],
      qualityFrameRefs: [],
    },
  ];
}

function seedBlacksmithBalance(): BlacksmithBalance[] {
  return [
    {
      id: 'blacksmith_balance_default',
      baseXpByRecipeType: {
        material_processing: 12,
        smelting: 18,
        blacksmith_craft: 30,
        runecrafting: 34,
      },
      xpByMaterialTier: {
        common: 0,
        uncommon: 6,
        rare: 14,
        epic: 24,
      },
      qualityBonuses: {
        quality_normal: 0,
        quality_fine: 8,
        quality_masterwork: 16,
      },
      qualityPenalties: {
        quality_failed: -12,
      },
      repeatCraftDiminishingReturns: {
        startAfter: 3,
        floorMultiplier: 0.35,
        decayPerCraft: 0.12,
      },
      heatRanges: {
        low: { min: 0, max: 33 },
        medium: { min: 34, max: 70 },
        high: { min: 71, max: 100 },
      },
      baseDefectChances: {
        crack: 12,
        slag: 8,
        warp: 10,
      },
      quenchProfiles: {
        water: { stability: 45, crackRisk: 18 },
        oil: { stability: 62, crackRisk: 10 },
      },
      strikeProfiles: {
        light: { progress: 8, precision: 14 },
        heavy: { progress: 16, precision: -8 },
      },
      finishProfiles: {
        grind: { sharpness: 12, polish: 4 },
        polish: { sharpness: 4, polish: 14 },
      },
    },
  ];
}

function seedBlacksmithItemTemplates(): BlacksmithItemTemplate[] {
  return [
    {
      id: 'blacksmith_template_one_hand_sword',
      name: 'Одноручный меч',
      description: 'Базовый шаблон одноручного меча для свободной ковки.',
      itemType: 'weapon',
      subtype: 'sword',
      slot: 'rightHand',
      handsRequired: 1,
      baseDamageMin: 4,
      baseDamageMax: 8,
      damageCategory: 'physical',
      physicalType: 'slash',
      requiredRoles: [
        { id: 'main_metal', label: 'Основной металл', role: 'main_metal', required: true, quantity: 3 },
        { id: 'handle', label: 'Рукоять', role: 'handle', required: true, quantity: 1 },
        { id: 'binding', label: 'Обмотка', role: 'leather', required: true, quantity: 1 },
      ],
      optionalRoles: [
        { id: 'quench', label: 'Закалочная жидкость', role: 'quench_liquid', required: false, quantity: 1 },
        { id: 'catalyst', label: 'Катализатор', role: 'flux', required: false, quantity: 1 },
      ],
      allowedMainMaterialRoles: ['main_metal', 'ingot'],
      allowedMaterialTiers: ['common', 'uncommon', 'rare', 'epic'],
      baseMaxAugmentSlots: 2,
      canAddAugmentSlots: true,
      canHaveRuneComplex: true,
      requiredBlacksmithLevel: 1,
      requiredSkillIds: [],
      tags: ['blacksmith_template', 'weapon', 'sword'],
      imageRef: { type: 'tileset', sheetId: 'blacksmith_forge_objects_384', frame: 7 },
      isEnabled: true,
    },
    {
      id: 'blacksmith_template_spear',
      name: 'Копьё',
      description: 'Длинное оружие с упором на древко и наконечник.',
      itemType: 'weapon',
      subtype: 'spear',
      slot: 'rightHand',
      handsRequired: 2,
      baseDamageMin: 5,
      baseDamageMax: 9,
      damageCategory: 'physical',
      physicalType: 'pierce',
      attackRange: 2,
      requiredRoles: [
        { id: 'main_metal', label: 'Наконечник', role: 'main_metal', required: true, quantity: 2 },
        { id: 'handle', label: 'Древко', role: 'wood', required: true, quantity: 2 },
        { id: 'binding', label: 'Крепление', role: 'leather', required: true, quantity: 1 },
      ],
      optionalRoles: [
        { id: 'quench', label: 'Закалочная жидкость', role: 'quench_liquid', required: false, quantity: 1 },
      ],
      allowedMainMaterialRoles: ['main_metal', 'ingot'],
      allowedMaterialTiers: ['common', 'uncommon', 'rare', 'epic'],
      baseMaxAugmentSlots: 2,
      canAddAugmentSlots: true,
      canHaveRuneComplex: true,
      requiredBlacksmithLevel: 1,
      requiredSkillIds: [],
      tags: ['blacksmith_template', 'weapon', 'spear'],
      imageRef: { type: 'tileset', sheetId: 'blacksmith_forge_objects_384', frame: 9 },
      isEnabled: true,
    },
    {
      id: 'blacksmith_template_chestplate',
      name: 'Нагрудник',
      description: 'Защитный доспех из металлических пластин.',
      itemType: 'armor',
      subtype: 'chestplate',
      slot: 'chest',
      baseArmorValue: 6,
      requiredRoles: [
        { id: 'main_metal', label: 'Основной металл', role: 'main_metal', required: true, quantity: 4 },
        { id: 'binding', label: 'Подкладка', role: 'cloth', required: true, quantity: 1 },
      ],
      optionalRoles: [
        { id: 'quench', label: 'Закалочная жидкость', role: 'quench_liquid', required: false, quantity: 1 },
        { id: 'catalyst', label: 'Катализатор', role: 'flux', required: false, quantity: 1 },
      ],
      allowedMainMaterialRoles: ['main_metal', 'ingot'],
      allowedMaterialTiers: ['common', 'uncommon', 'rare', 'epic'],
      baseMaxAugmentSlots: 2,
      canAddAugmentSlots: true,
      canHaveRuneComplex: true,
      requiredBlacksmithLevel: 2,
      requiredSkillIds: [],
      tags: ['blacksmith_template', 'armor', 'chestplate'],
      imageRef: { type: 'tileset', sheetId: 'blacksmith_forge_objects_384', frame: 11 },
      isEnabled: true,
    },
  ];
}

function seedBlacksmithItemWorkActions(): BlacksmithItemWorkAction[] {
  return [
    {
      id: 'blacksmith_itemwork_improve',
      name: 'Улучшить предмет',
      description: 'Повышает урон или броню по итогам мини-игры.',
      actionType: 'improve_stats',
      allowedItemTypes: ['weapon', 'armor'],
      materialCosts: [{ materialId: 'item_iron_ore', quantity: 1 }],
      goldCost: 15,
      baseDifficulty: 38,
      risk: 18,
      statMultiplierDelta: 0.05,
      isEnabled: true,
    },
    {
      id: 'blacksmith_itemwork_add_socket',
      name: 'Добавить слот',
      description: 'Пытается добавить новый слот усиления.',
      actionType: 'add_socket',
      allowedItemTypes: ['weapon', 'armor'],
      materialCosts: [{ materialId: 'item_iron_ore', quantity: 2 }],
      goldCost: 35,
      baseDifficulty: 48,
      risk: 26,
      addSocketRules: {
        allowedAugmentTypes: ['rune', 'magic_stone', 'enchantment'],
        source: 'blacksmith_added',
      },
      isEnabled: true,
    },
    {
      id: 'blacksmith_itemwork_temper_buff',
      name: 'Временная закалка',
      description: 'Даёт временный боевой бафф предмету.',
      actionType: 'temporary_buff',
      allowedItemTypes: ['weapon', 'armor'],
      materialCosts: [{ materialId: 'item_coal_chunk', quantity: 1 }],
      goldCost: 12,
      baseDifficulty: 24,
      risk: 10,
      isEnabled: true,
    },
    {
      id: 'blacksmith_itemwork_dismantle',
      name: 'Разобрать предмет',
      description: 'Разобрать предмет на часть материалов.',
      actionType: 'dismantle',
      allowedItemTypes: ['weapon', 'armor'],
      goldCost: 0,
      baseDifficulty: 12,
      risk: 4,
      isEnabled: true,
    },
  ];
}

function seedRecipeVisualProfiles(): RecipeVisualProfile[] {
  return [
    {
      id: 'smelting_metal',
      name: 'Плавка металла',
      description: 'Профиль обложки для плавки и металлургии.',
      recipeTypes: ['smelting', 'material_processing'],
      materialFamilies: ['metal', 'alloy'],
      coverImageRef: '/art/crafting/recipes/recipe_smelting_metal.png',
      iconImageRef: '/art/crafting/recipes/recipe_smelting_metal.png',
      animationImageRef: '/art/crafting/recipes/recipe_smelting_metal.png',
      backgroundStyle: 'smelting',
      accentColor: '#b0682f',
      isEnabled: true,
    },
    {
      id: 'material_wood',
      name: 'Обработка дерева',
      description: 'Профиль для деревообработки.',
      recipeTypes: ['material_processing', 'carpentry_craft'],
      materialFamilies: ['wood'],
      coverImageRef: '/art/crafting/recipes/recipe_material_wood.png',
      iconImageRef: '/art/crafting/recipes/recipe_material_wood.png',
      animationImageRef: '/art/crafting/recipes/recipe_material_wood.png',
      backgroundStyle: 'processing',
      accentColor: '#7a5a2d',
      isEnabled: true,
    },
    {
      id: 'material_cloth',
      name: 'Обработка ткани',
      description: 'Профиль для ткацких и швейных рецептов.',
      recipeTypes: ['weaving', 'material_processing'],
      materialFamilies: ['cloth', 'leather'],
      coverImageRef: '/art/crafting/recipes/recipe_material_cloth.png',
      iconImageRef: '/art/crafting/recipes/recipe_material_cloth.png',
      animationImageRef: '/art/crafting/recipes/recipe_material_cloth.png',
      backgroundStyle: 'processing',
      accentColor: '#927552',
      isEnabled: true,
    },
    {
      id: 'food_basic',
      name: 'Базовая кулинария',
      description: 'Профиль для простых пищевых рецептов.',
      recipeTypes: ['cooking', 'baking'],
      materialFamilies: ['food'],
      coverImageRef: '/art/crafting/recipes/recipe_food_basic.png',
      iconImageRef: '/art/crafting/recipes/recipe_food_basic.png',
      animationImageRef: '/art/crafting/recipes/recipe_food_basic.png',
      backgroundStyle: 'cooking',
      accentColor: '#b37f42',
      isEnabled: true,
    },
    {
      id: 'alchemy_basic',
      name: 'Базовая алхимия',
      description: 'Профиль для алхимических рецептов.',
      recipeTypes: ['alchemy'],
      materialFamilies: ['alchemy'],
      coverImageRef: '/art/crafting/recipes/recipe_alchemy_basic.png',
      iconImageRef: '/art/crafting/recipes/recipe_alchemy_basic.png',
      animationImageRef: '/art/crafting/recipes/recipe_alchemy_basic.png',
      backgroundStyle: 'alchemy',
      accentColor: '#4f8d7a',
      isEnabled: true,
    },
    {
      id: 'forging_weapon',
      name: 'Ковка оружия',
      description: 'Профиль для оружейных рецептов кузнеца.',
      recipeTypes: ['blacksmith_craft'],
      materialFamilies: ['metal'],
      coverImageRef: '/art/crafting/recipes/recipe_forging_weapon.png',
      iconImageRef: '/art/crafting/recipes/recipe_forging_weapon.png',
      animationImageRef: '/art/crafting/recipes/recipe_forging_weapon.png',
      backgroundStyle: 'forging',
      accentColor: '#b35a39',
      isEnabled: true,
    },
    {
      id: 'forging_armor',
      name: 'Ковка доспеха',
      description: 'Профиль для бронных рецептов кузнеца.',
      recipeTypes: ['blacksmith_craft'],
      materialFamilies: ['metal'],
      coverImageRef: '/art/crafting/recipes/recipe_forging_armor.png',
      iconImageRef: '/art/crafting/recipes/recipe_forging_armor.png',
      animationImageRef: '/art/crafting/recipes/recipe_forging_armor.png',
      backgroundStyle: 'forging',
      accentColor: '#8f6c4d',
      isEnabled: true,
    },
    {
      id: 'rare_alloy',
      name: 'Редкие сплавы',
      description: 'Профиль для рецептов редких сплавов.',
      recipeTypes: ['smelting', 'blacksmith_craft'],
      materialFamilies: ['alloy', 'metal'],
      coverImageRef: '/art/crafting/recipes/recipe_rare_alloy.png',
      iconImageRef: '/art/crafting/recipes/recipe_rare_alloy.png',
      animationImageRef: '/art/crafting/recipes/recipe_rare_alloy.png',
      backgroundStyle: 'refinement',
      accentColor: '#8792a6',
      isEnabled: true,
    },
    {
      id: 'rune_work',
      name: 'Рунная обработка',
      description: 'Профиль для рунических и зачаровательных работ.',
      recipeTypes: ['runecrafting', 'enchantment'],
      materialFamilies: ['rune', 'alchemy'],
      coverImageRef: '/art/crafting/recipes/recipe_rune_work.png',
      iconImageRef: '/art/crafting/recipes/recipe_rune_work.png',
      animationImageRef: '/art/crafting/recipes/recipe_rune_work.png',
      backgroundStyle: 'refinement',
      accentColor: '#7a62b5',
      isEnabled: true,
    },
  ];
}

function createSeedDatabase(): ContentDatabase {
  const timestamp = nowIso();
  return {
    version: CONTENT_DB_VERSION,
    items: Object.values(ITEMS).map((item) => seedItemFromDomain(item, timestamp)),
    skills: [],
    visualFx: [],
    merchants: MERCHANTS.map((merchant) => seedMerchantFromDomain(merchant, timestamp)),
    cities: seedStarterCities(timestamp),
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
    recipeVisualProfiles: seedRecipeVisualProfiles(),
    itemSets: [],
    runeComplexes: [],
    blacksmithForgeTiers: seedBlacksmithForgeTiers(),
    blacksmithModules: seedBlacksmithModules(),
    blacksmithTools: seedBlacksmithTools(),
    blacksmithQualityTiers: seedBlacksmithQualityTiers(),
    blacksmithVisualPresets: seedBlacksmithVisualPresets(),
    blacksmithBalance: seedBlacksmithBalance(),
    blacksmithItemTemplates: seedBlacksmithItemTemplates(),
    blacksmithItemWorkActions: seedBlacksmithItemWorkActions(),
    worldMap: {
      zones: [],
      regions: [],
      questMarkers: [],
      updatedAt: timestamp,
    },
  };
}

function toDomainItemType(adminItem: AdminItem): ItemDefinition['itemType'] {
  const slot = normalizeAdminSlot(adminItem.slot);

  if (adminItem.type === 'weapon') {
    return 'weapon';
  }

  if (adminItem.type === 'armor') {
    switch (slot) {
      case 'head':
        return 'helmet';
      case 'necklace':
        return 'necklace';
      case 'outerwear':
        return 'outerwear';
      case 'belt':
        return 'belt';
      case 'ring':
        return 'ring';
      case 'legs':
        return 'legs';
      case 'boots':
        return 'boots';
      case 'gloves':
        return 'gloves';
      case 'leftHand':
        return 'shield';
      default:
        return 'armor';
    }
  }

  return 'consumable';
}

function ensureCollectionName(name: string): ContentCollectionName {
  if (CONTENT_COLLECTIONS.includes(name as ContentCollectionName)) {
    return name as ContentCollectionName;
  }

  throw new NotFoundException(`Unknown content collection: ${name}`);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => String(entry ?? '').trim()).filter(Boolean);
}

function normalizeOptionalStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return normalizeStringList(value);
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toInteger(value: unknown): number | undefined {
  const num = toFiniteNumber(value);
  return typeof num === 'number' ? Math.round(num) : undefined;
}

const CRAFTING_RECIPE_STATUSES = new Set(['draft', 'active', 'disabled', 'archived']);
const CRAFTING_RECIPE_TYPES = new Set([
  'material_processing',
  'smelting',
  'grinding',
  'cutting',
  'tanning',
  'weaving',
  'cooking',
  'baking',
  'alchemy',
  'jewelcrafting',
  'blacksmith_craft',
  'carpentry_craft',
  'leatherworking_craft',
  'runecrafting',
  'rune_identification',
  'enchantment',
  'add_socket',
  'temporary_item_buff',
  'permanent_item_upgrade',
  'dismantling',
]);
const CRAFTING_PROFESSION_IDS = new Set([
  'mining',
  'blacksmithing',
  'carpentry',
  'leatherworking',
  'jewelcrafting',
  'runecrafting',
  'fishing',
  'cooking',
  'hunting',
  'alchemy',
  'herbalism',
]);
const CRAFTING_STATION_TYPES = new Set([
  'none',
  'forge',
  'furnace',
  'anvil',
  'workbench',
  'sawmill',
  'tanning_rack',
  'cooking_fire',
  'oven',
  'cauldron',
  'alchemy_table',
  'jewelcrafting_table',
  'rune_table',
  'enchanting_table',
  'drying_rack',
  'fishing_spot',
  'hunting_camp',
  'millstone',
]);
const CRAFTING_FAILURE_MODES = new Set([
  'none',
  'lose_inputs',
  'lose_partial_inputs',
  'damaged_item',
  'cursed_result',
  'random_lower_quality',
]);
const CRAFTING_RESULT_MODES = new Set(['fixed', 'random_from_pool']);

function normalizeCraftingMaterialStackInput(value: unknown): NonNullable<CraftingRecipe['inputMaterials']>[number] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const materialId = String(raw.materialId ?? '').trim();
  if (!materialId) {
    return null;
  }

  return {
    materialId,
    quantity: Math.max(1, toInteger(raw.quantity) ?? 1),
  };
}

function normalizeCraftingItemStackInput(
  value: unknown,
  options?: { keepConsume?: boolean },
): NonNullable<CraftingRecipe['inputItems']>[number] | NonNullable<CraftingRecipe['outputItems']>[number] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const itemId = String(raw.itemId ?? '').trim();
  if (!itemId) {
    return null;
  }

  return {
    itemId,
    quantity: Math.max(1, toInteger(raw.quantity) ?? 1),
    consume: options?.keepConsume ? raw.consume !== false : undefined,
  };
}

function normalizeCraftingMaterialStacksInput(value: unknown): CraftingRecipe['inputMaterials'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeCraftingMaterialStackInput(entry))
    .filter((entry): entry is NonNullable<CraftingRecipe['inputMaterials']>[number] => Boolean(entry));
}

function normalizeCraftingItemStacksInput(value: unknown, options?: { keepConsume?: boolean }): CraftingRecipe['inputItems'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeCraftingItemStackInput(entry, options))
    .filter((entry): entry is NonNullable<CraftingRecipe['inputItems']>[number] => Boolean(entry));
}

function normalizeItemEffectInput(input: unknown): ItemEffect | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const type = String(raw.type ?? '').trim() as ItemEffect['type'];
  if (!type) {
    return null;
  }

  const triggerRaw = String(raw.trigger ?? '').trim();
  const trigger = triggerRaw === 'on_hit'
    || triggerRaw === 'on_crit'
    || triggerRaw === 'on_use'
    || triggerRaw === 'on_turn_start'
    || triggerRaw === 'on_turn_end'
    || triggerRaw === 'always'
    ? triggerRaw
    : undefined;

  return {
    type,
    stat: typeof raw.stat === 'string' && raw.stat.trim() ? raw.stat.trim() as ItemEffect['stat'] : undefined,
    value: toFiniteNumber(raw.value),
    percent: toFiniteNumber(raw.percent),
    flat: toFiniteNumber(raw.flat),
    damageCategory: typeof raw.damageCategory === 'string' && raw.damageCategory.trim() ? raw.damageCategory.trim() as ItemEffect['damageCategory'] : undefined,
    physicalType: typeof raw.physicalType === 'string' && raw.physicalType.trim() ? raw.physicalType.trim() as ItemEffect['physicalType'] : undefined,
    elementType: typeof raw.elementType === 'string' && raw.elementType.trim() ? raw.elementType.trim() as ItemEffect['elementType'] : undefined,
    magicSchool: typeof raw.magicSchool === 'string' && raw.magicSchool.trim() ? raw.magicSchool.trim() as ItemEffect['magicSchool'] : undefined,
    statusId: typeof raw.statusId === 'string' && raw.statusId.trim() ? raw.statusId.trim() : undefined,
    chancePercent: toFiniteNumber(raw.chancePercent),
    durationTurns: toInteger(raw.durationTurns),
    trigger,
    activationContexts: normalizeOptionalStringList(raw.activationContexts),
    condition: typeof raw.condition === 'string' && raw.condition.trim() ? raw.condition.trim() : undefined,
  };
}

function normalizeOptionalItemEffects(value: unknown): ItemEffect[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((entry) => normalizeItemEffectInput(entry))
    .filter((entry): entry is ItemEffect => Boolean(entry));
}

function normalizeItemAugmentInput(value: unknown): AdminItem['augment'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const type = String(raw.type ?? '').trim();
  if (!type) {
    return undefined;
  }

  return {
    type: type as NonNullable<AdminItem['augment']>['type'],
    activationContexts: normalizeOptionalStringList(raw.activationContexts),
    effects: normalizeOptionalItemEffects(raw.effects),
    tags: normalizeOptionalStringList(raw.tags),
  };
}

function normalizeItemSocketInput(value: unknown, fallbackIndex: number): NonNullable<AdminItem['augmentSlots']>[number] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const id = String(raw.id ?? '').trim() || `socket_${fallbackIndex + 1}`;
  const sourceRaw = String(raw.source ?? '').trim();
  const source = sourceRaw === 'blacksmith_added' || sourceRaw === 'scripted' || sourceRaw === 'base'
    ? sourceRaw
    : 'base';

  return {
    id,
    source,
    isLocked: raw.isLocked === true,
    allowedAugmentTypes: Array.isArray(raw.allowedAugmentTypes)
      ? normalizeStringList(raw.allowedAugmentTypes) as NonNullable<AdminItem['augmentSlots']>[number]['allowedAugmentTypes']
      : undefined,
    activationContexts: normalizeOptionalStringList(raw.activationContexts),
    socketedAugmentItemId: typeof raw.socketedAugmentItemId === 'string' && raw.socketedAugmentItemId.trim()
      ? raw.socketedAugmentItemId.trim()
      : undefined,
  };
}

function normalizeItemSocketsInput(value: unknown): AdminItem['augmentSlots'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((entry, index) => normalizeItemSocketInput(entry, index))
    .filter((entry): entry is NonNullable<AdminItem['augmentSlots']>[number] => Boolean(entry));
}

function normalizeSlotUpgradeRulesInput(value: unknown): AdminItem['slotUpgradeRules'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const materialCosts = Array.isArray(raw.materialCosts)
    ? raw.materialCosts
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return null;
        }
        const rec = entry as Record<string, unknown>;
        const itemId = String(rec.itemId ?? '').trim();
        const quantity = Math.max(1, Math.round(toFiniteNumber(rec.quantity) ?? 1));
        return itemId ? { itemId, quantity } : null;
      })
      .filter((entry): entry is NonNullable<NonNullable<AdminItem['slotUpgradeRules']>['materialCosts']>[number] => Boolean(entry))
    : undefined;

  const failureModes = Array.isArray(raw.failureModes)
    ? (normalizeStringList(raw.failureModes)
      .filter((mode): mode is 'none' | 'material_lost' | 'item_damaged' | 'slot_locked' =>
        mode === 'none' || mode === 'material_lost' || mode === 'item_damaged' || mode === 'slot_locked'))
    : undefined;

  return {
    minBlacksmithTier: Math.max(1, toInteger(raw.minBlacksmithTier) ?? 1),
    goldCost: Math.max(0, Math.round(toFiniteNumber(raw.goldCost) ?? 0)),
    materialCosts,
    successChancePercent: Math.max(0, Math.min(100, toFiniteNumber(raw.successChancePercent) ?? 100)),
    failureModes,
  };
}

function normalizeItemSetInput(input: ItemSet): ItemSet {
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    pieceItemIds: normalizeStringList(input.pieceItemIds),
    bonuses: Array.isArray(input.bonuses)
      ? input.bonuses
        .map((bonus) => {
          const penaltyRaw = normalizeOptionalItemEffects((bonus as { penaltyEffects?: unknown }).penaltyEffects) ?? [];
          return {
            requiredPieces: Math.max(1, Math.round(toFiniteNumber(bonus?.requiredPieces) ?? 1)),
            effects: normalizeOptionalItemEffects(bonus?.effects) ?? [],
            penaltyEffects: penaltyRaw.length > 0 ? penaltyRaw : undefined,
            description: typeof bonus?.description === 'string' && bonus.description.trim() ? bonus.description.trim() : undefined,
          };
        })
      : [],
    isEnabled: input.isEnabled !== false,
    imagePath: typeof input.imagePath === 'string' && input.imagePath.trim() ? input.imagePath.trim() : undefined,
    gameplayDescription: typeof input.gameplayDescription === 'string' && input.gameplayDescription.trim()
      ? input.gameplayDescription.trim()
      : undefined,
    loreDescription: typeof input.loreDescription === 'string' && input.loreDescription.trim()
      ? input.loreDescription.trim()
      : undefined,
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
  };
}

export function removeDeletedItemIdFromItemSets(itemSets: ItemSet[] | undefined, deletedItemId: string, timestamp = nowIso()): ItemSet[] {
  if (!Array.isArray(itemSets) || !deletedItemId.trim()) {
    return itemSets ?? [];
  }

  return itemSets.map((itemSet) => {
    const pieceItemIds = Array.isArray(itemSet.pieceItemIds) ? itemSet.pieceItemIds : [];
    if (!pieceItemIds.includes(deletedItemId)) {
      return itemSet;
    }

    return {
      ...itemSet,
      pieceItemIds: pieceItemIds.filter((pieceItemId) => pieceItemId !== deletedItemId),
      updatedAt: timestamp,
    };
  });
}

export function collectMissingItemSetReferenceWarnings(db: ContentDatabase): string[] {
  const itemIds = new Set((db.items ?? []).map((item) => String(item?.id ?? '').trim()).filter(Boolean));
  const warnings: string[] = [];

  for (const itemSet of db.itemSets ?? []) {
    if (!itemSet || typeof itemSet !== 'object') {
      continue;
    }

    const missingPieceIds = Array.from(new Set(
      (Array.isArray(itemSet.pieceItemIds) ? itemSet.pieceItemIds : [])
        .map((pieceItemId) => String(pieceItemId ?? '').trim())
        .filter((pieceItemId) => pieceItemId && !itemIds.has(pieceItemId)),
    ));

    if (missingPieceIds.length === 0) {
      continue;
    }

    warnings.push(
      `Item set '${String(itemSet.id ?? '').trim()}' has ${missingPieceIds.length} missing item references: ${missingPieceIds.join(', ')}`,
    );
  }

  return warnings;
}

function normalizeRuneComplexInput(input: RuneComplex): RuneComplex {
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    runeItemIds: normalizeStringList(input.runeItemIds),
    gameplayDescription: typeof input.gameplayDescription === 'string' && input.gameplayDescription.trim() ? input.gameplayDescription.trim() : undefined,
    loreDescription: typeof input.loreDescription === 'string' && input.loreDescription.trim() ? input.loreDescription.trim() : undefined,
    isEnabled: input.isEnabled !== false,
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
  };
}

function normalizeBlacksmithForgeTierInput(input: BlacksmithForgeTier): BlacksmithForgeTier {
  return {
    ...clone(input),
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    tier: Math.max(1, toInteger(input.tier) ?? 1),
    requiredBlacksmithLevel: Math.max(1, toInteger(input.requiredBlacksmithLevel) ?? 1),
    requiredSkillIds: normalizeStringList(input.requiredSkillIds),
    allowedRecipeTypes: normalizeStringList(input.allowedRecipeTypes),
    allowedRecipeGroups: normalizeStringList(input.allowedRecipeGroups),
    allowedMaterialTiers: normalizeStringList(input.allowedMaterialTiers),
    heatControlBonus: toFiniteNumber(input.heatControlBonus) ?? 0,
    qualityCapBonus: toFiniteNumber(input.qualityCapBonus) ?? 0,
    failureChanceReduction: toFiniteNumber(input.failureChanceReduction) ?? 0,
    moduleSlotLimits: typeof input.moduleSlotLimits === 'object' && input.moduleSlotLimits !== null && !Array.isArray(input.moduleSlotLimits)
      ? Object.fromEntries(Object.entries(input.moduleSlotLimits).map(([key, value]) => [key, Math.max(0, toInteger(value) ?? 0)]))
      : {},
    visualPresetId: typeof input.visualPresetId === 'string' && input.visualPresetId.trim() ? input.visualPresetId.trim() : undefined,
    isEnabled: input.isEnabled !== false,
  };
}

function normalizeBlacksmithModuleInput(input: BlacksmithModule): BlacksmithModule {
  return {
    ...clone(input),
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    moduleType: String(input.moduleType ?? '').trim(),
    tier: Math.max(1, toInteger(input.tier) ?? 1),
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    bonuses: typeof input.bonuses === 'object' && input.bonuses !== null && !Array.isArray(input.bonuses)
      ? clone(input.bonuses)
      : {},
    requiredBlacksmithLevel: Math.max(1, toInteger(input.requiredBlacksmithLevel) ?? 1),
    requiredSkillIds: normalizeStringList(input.requiredSkillIds),
    compatibleForgeTierIds: normalizeStringList(input.compatibleForgeTierIds),
    imageRef: typeof input.imageRef === 'string' && input.imageRef.trim() ? input.imageRef.trim() : undefined,
    isEnabled: input.isEnabled !== false,
  };
}

function normalizeBlacksmithToolInput(input: BlacksmithTool): BlacksmithTool {
  return {
    ...clone(input),
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    toolType: String(input.toolType ?? '').trim(),
    tier: Math.max(1, toInteger(input.tier) ?? 1),
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    bonuses: typeof input.bonuses === 'object' && input.bonuses !== null && !Array.isArray(input.bonuses)
      ? clone(input.bonuses)
      : {},
    minResultFloor: Math.max(0, toInteger(input.minResultFloor) ?? 0),
    specialRules: normalizeStringList(input.specialRules),
    imageRef: typeof input.imageRef === 'string' && input.imageRef.trim() ? input.imageRef.trim() : undefined,
    isEnabled: input.isEnabled !== false,
  };
}

function normalizeBlacksmithQualityTierInput(input: BlacksmithQualityTier): BlacksmithQualityTier {
  const minScore = Math.max(0, Math.min(100, toInteger(input.minScore) ?? 0));
  const maxScore = Math.max(minScore, Math.min(100, toInteger(input.maxScore) ?? 100));
  return {
    ...clone(input),
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    minScore,
    maxScore,
    priceMultiplier: Math.max(0, toFiniteNumber(input.priceMultiplier) ?? 1),
    xpMultiplier: Math.max(0, toFiniteNumber(input.xpMultiplier) ?? 1),
    statMultiplier: Math.max(0, toFiniteNumber(input.statMultiplier) ?? 1),
    frameImageRef: typeof input.frameImageRef === 'string' && input.frameImageRef.trim() ? input.frameImageRef.trim() : undefined,
    isFailureTier: Boolean(input.isFailureTier),
  };
}

function normalizeBlacksmithVisualPresetInput(input: BlacksmithVisualPreset): BlacksmithVisualPreset {
  return {
    ...clone(input),
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    backgroundImageRef: typeof input.backgroundImageRef === 'string' && input.backgroundImageRef.trim() ? input.backgroundImageRef.trim() : undefined,
    anvilImageRef: typeof input.anvilImageRef === 'string' && input.anvilImageRef.trim() ? input.anvilImageRef.trim() : undefined,
    furnaceImageRef: typeof input.furnaceImageRef === 'string' && input.furnaceImageRef.trim() ? input.furnaceImageRef.trim() : undefined,
    hammerImageRefs: normalizeStringList(input.hammerImageRefs),
    defectOverlayRefs: normalizeStringList(input.defectOverlayRefs),
    blankImageRefs: normalizeStringList(input.blankImageRefs),
    qualityFrameRefs: normalizeStringList(input.qualityFrameRefs),
  };
}

function normalizeBlacksmithBalanceInput(input: BlacksmithBalance): BlacksmithBalance {
  const toNumberRecord = (value: unknown): Record<string, number> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const next: Record<string, number> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      const numeric = toFiniteNumber(entryValue);
      if (entryKey.trim() && typeof numeric === 'number') {
        next[entryKey] = numeric;
      }
    }
    return next;
  };

  const toNestedNumberRecord = (value: unknown): Record<string, Record<string, number>> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const next: Record<string, Record<string, number>> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      next[entryKey] = toNumberRecord(entryValue);
    }
    return next;
  };

  const repeatRaw = input.repeatCraftDiminishingReturns;
  const heatRangesRaw = input.heatRanges;
  const heatRanges: Record<string, { min: number; max: number }> = {};
  if (heatRangesRaw && typeof heatRangesRaw === 'object' && !Array.isArray(heatRangesRaw)) {
    for (const [entryKey, entryValue] of Object.entries(heatRangesRaw)) {
      if (!entryValue || typeof entryValue !== 'object' || Array.isArray(entryValue)) {
        continue;
      }
      const min = Math.max(0, Math.min(100, toFiniteNumber((entryValue as { min?: unknown }).min) ?? 0));
      const max = Math.max(min, Math.min(100, toFiniteNumber((entryValue as { max?: unknown }).max) ?? min));
      heatRanges[entryKey] = { min, max };
    }
  }

  return {
    ...clone(input),
    id: String(input.id ?? '').trim(),
    baseXpByRecipeType: toNumberRecord(input.baseXpByRecipeType),
    xpByMaterialTier: toNumberRecord(input.xpByMaterialTier),
    qualityBonuses: toNumberRecord(input.qualityBonuses),
    qualityPenalties: toNumberRecord(input.qualityPenalties),
    repeatCraftDiminishingReturns: {
      startAfter: Math.max(0, toInteger(repeatRaw?.startAfter) ?? 0),
      floorMultiplier: Math.max(0, Math.min(1, toFiniteNumber(repeatRaw?.floorMultiplier) ?? 0.5)),
      decayPerCraft: Math.max(0, Math.min(1, toFiniteNumber(repeatRaw?.decayPerCraft) ?? 0.1)),
    },
    heatRanges,
    baseDefectChances: toNumberRecord(input.baseDefectChances),
    quenchProfiles: toNestedNumberRecord(input.quenchProfiles),
    strikeProfiles: toNestedNumberRecord(input.strikeProfiles),
    finishProfiles: toNestedNumberRecord(input.finishProfiles),
  };
}

function normalizeMaterialCraftingPropertiesInput(value: Material['craftingProperties']): Material['craftingProperties'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const normalized = clone(value) as NonNullable<Material['craftingProperties']>;
  normalized.roles = normalizeOptionalStringList(normalized.roles) as NonNullable<Material['craftingProperties']>['roles'];
  normalized.professions = normalizeOptionalStringList(normalized.professions);
  normalized.tags = normalizeOptionalStringList(normalized.tags);
  if (normalized.blacksmith) {
    normalized.blacksmith.allowedTemplateIds = normalizeOptionalStringList(normalized.blacksmith.allowedTemplateIds);
    normalized.blacksmith.preferredTemplateIds = normalizeOptionalStringList(normalized.blacksmith.preferredTemplateIds);
    normalized.blacksmith.tags = normalizeOptionalStringList(normalized.blacksmith.tags);
    normalized.blacksmith.bonusEffects = normalizeOptionalItemEffects(normalized.blacksmith.bonusEffects);
  }
  if (normalized.runic) {
    normalized.runic.compatibleRuneIds = normalizeOptionalStringList(normalized.runic.compatibleRuneIds);
    normalized.runic.forbiddenRuneIds = normalizeOptionalStringList(normalized.runic.forbiddenRuneIds);
  }
  return normalized;
}

function normalizeBlacksmithTemplateMaterialSlotInput(
  value: unknown,
  fallbackId: string,
): BlacksmithItemTemplate['requiredRoles'][number] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const role = String(raw.role ?? '').trim();
  if (!role) {
    return null;
  }
  return {
    id: String(raw.id ?? '').trim() || fallbackId,
    label: String(raw.label ?? raw.id ?? role).trim() || role,
    role: role as BlacksmithItemTemplate['requiredRoles'][number]['role'],
    required: raw.required !== false,
    quantity: Math.max(1, toInteger(raw.quantity) ?? 1),
  };
}

function normalizeBlacksmithItemTemplateInput(input: BlacksmithItemTemplate): BlacksmithItemTemplate {
  const imageRef = normalizeGameImageRefInput(input.imageRef);
  return {
    ...clone(input),
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    itemType: input.itemType === 'armor' ? 'armor' : 'weapon',
    subtype: typeof input.subtype === 'string' && input.subtype.trim() ? input.subtype.trim() : undefined,
    slot: typeof input.slot === 'string' && input.slot.trim() ? input.slot : undefined,
    handsRequired: input.handsRequired === 2 ? 2 : input.handsRequired === 1 ? 1 : undefined,
    baseDamageMin: typeof input.baseDamageMin === 'number' ? Math.max(0, Math.round(input.baseDamageMin)) : undefined,
    baseDamageMax: typeof input.baseDamageMax === 'number' ? Math.max(0, Math.round(input.baseDamageMax)) : undefined,
    baseArmorValue: typeof input.baseArmorValue === 'number' ? Math.max(0, Math.round(input.baseArmorValue)) : undefined,
    damageCategory: typeof input.damageCategory === 'string' && input.damageCategory.trim() ? input.damageCategory : undefined,
    physicalType: typeof input.physicalType === 'string' && input.physicalType.trim() ? input.physicalType : undefined,
    attackRange: typeof input.attackRange === 'number' ? Math.max(1, Math.round(input.attackRange)) : undefined,
    requiredRoles: Array.isArray(input.requiredRoles)
      ? input.requiredRoles
        .map((entry, index) => normalizeBlacksmithTemplateMaterialSlotInput(entry, `required_${index + 1}`))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      : [],
    optionalRoles: Array.isArray(input.optionalRoles)
      ? input.optionalRoles
        .map((entry, index) => normalizeBlacksmithTemplateMaterialSlotInput(entry, `optional_${index + 1}`))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      : undefined,
    allowedMainMaterialRoles: normalizeOptionalStringList(input.allowedMainMaterialRoles) as BlacksmithItemTemplate['allowedMainMaterialRoles'],
    allowedMaterialTiers: normalizeOptionalStringList(input.allowedMaterialTiers),
    baseMaxAugmentSlots: typeof input.baseMaxAugmentSlots === 'number' ? Math.max(0, Math.round(input.baseMaxAugmentSlots)) : undefined,
    canAddAugmentSlots: input.canAddAugmentSlots === true,
    canHaveRuneComplex: input.canHaveRuneComplex === true,
    requiredBlacksmithLevel: typeof input.requiredBlacksmithLevel === 'number' ? Math.max(1, Math.round(input.requiredBlacksmithLevel)) : undefined,
    requiredSkillIds: normalizeOptionalStringList(input.requiredSkillIds),
    tags: normalizeOptionalStringList(input.tags),
    imageRef,
    isEnabled: input.isEnabled !== false,
  };
}

function normalizeBlacksmithItemWorkActionInput(input: BlacksmithItemWorkAction): BlacksmithItemWorkAction {
  return {
    ...clone(input),
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    actionType: String(input.actionType ?? '').trim() as BlacksmithItemWorkAction['actionType'],
    allowedItemTypes: normalizeStringList(input.allowedItemTypes) as BlacksmithItemWorkAction['allowedItemTypes'],
    allowedSubtypes: normalizeOptionalStringList(input.allowedSubtypes),
    requiredBlacksmithLevel: typeof input.requiredBlacksmithLevel === 'number' ? Math.max(1, Math.round(input.requiredBlacksmithLevel)) : undefined,
    requiredSkillIds: normalizeOptionalStringList(input.requiredSkillIds),
    materialCosts: Array.isArray(input.materialCosts)
      ? input.materialCosts
        .map((entry) => ({
          materialId: String(entry.materialId ?? '').trim(),
          quantity: Math.max(1, toInteger(entry.quantity) ?? 1),
        }))
        .filter((entry) => Boolean(entry.materialId))
      : undefined,
    itemCosts: Array.isArray(input.itemCosts)
      ? input.itemCosts
        .map((entry) => ({
          itemId: String(entry.itemId ?? '').trim(),
          quantity: Math.max(1, toInteger(entry.quantity) ?? 1),
          consume: entry.consume !== false,
        }))
        .filter((entry) => Boolean(entry.itemId))
      : undefined,
    goldCost: typeof input.goldCost === 'number' ? Math.max(0, Math.round(input.goldCost)) : undefined,
    baseDifficulty: Math.max(1, toInteger(input.baseDifficulty) ?? 1),
    risk: Math.max(0, toInteger(input.risk) ?? 0),
    effects: normalizeOptionalItemEffects(input.effects),
    statMultiplierDelta: typeof input.statMultiplierDelta === 'number' ? input.statMultiplierDelta : undefined,
    addSocketRules: input.addSocketRules
      ? {
        allowedAugmentTypes: normalizeOptionalStringList(input.addSocketRules.allowedAugmentTypes) as ItemSocket['allowedAugmentTypes'],
        source: 'blacksmith_added',
      }
      : undefined,
    isEnabled: input.isEnabled !== false,
  };
}

function normalizeCraftingRecipeInput(input: CraftingRecipe): CraftingRecipe {
  const statusRaw = String(input.status ?? '').trim();
  const recipeTypeRaw = String(input.recipeType ?? '').trim();
  const stationTypeRaw = String(input.stationType ?? '').trim();
  const failureModeRaw = String(input.failureMode ?? '').trim();
  const resultModeRaw = String(input.resultMode ?? '').trim();
  const visualAnimationRefRaw = String(input.visualAnimationRef ?? '').trim();

  return {
    ...clone(input),
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    status: CRAFTING_RECIPE_STATUSES.has(statusRaw) ? statusRaw as CraftingRecipe['status'] : 'draft',
    recipeType: CRAFTING_RECIPE_TYPES.has(recipeTypeRaw) ? recipeTypeRaw as CraftingRecipe['recipeType'] : 'material_processing',
    professionId: String(input.professionId ?? '').trim(),
    stationType: CRAFTING_STATION_TYPES.has(stationTypeRaw) ? stationTypeRaw as CraftingRecipe['stationType'] : 'none',
    requiredProfessionLevel: Math.max(0, toInteger(input.requiredProfessionLevel) ?? 0) || undefined,
    requiredSkillIds: normalizeStringList(input.requiredSkillIds),
    requiredBlueprintItemId: typeof input.requiredBlueprintItemId === 'string' && input.requiredBlueprintItemId.trim()
      ? input.requiredBlueprintItemId.trim()
      : undefined,
    requiredQuestId: typeof input.requiredQuestId === 'string' && input.requiredQuestId.trim()
      ? input.requiredQuestId.trim()
      : undefined,
    inputMaterials: normalizeCraftingMaterialStacksInput(input.inputMaterials),
    inputItems: normalizeCraftingItemStacksInput(input.inputItems, { keepConsume: true }),
    outputMaterials: normalizeCraftingMaterialStacksInput(input.outputMaterials),
    outputItems: normalizeCraftingItemStacksInput(input.outputItems),
    resultMode: CRAFTING_RESULT_MODES.has(resultModeRaw) ? resultModeRaw as CraftingRecipe['resultMode'] : 'fixed',
    resultPoolId: typeof input.resultPoolId === 'string' && input.resultPoolId.trim() ? input.resultPoolId.trim() : undefined,
    goldCost: Math.max(0, toInteger(input.goldCost) ?? 0) || undefined,
    staminaCost: Math.max(0, toInteger(input.staminaCost) ?? 0) || undefined,
    timeSeconds: Math.max(0, toInteger(input.timeSeconds) ?? 0) || undefined,
    successChance: toFiniteNumber(input.successChance) !== undefined
      ? Math.max(0, Math.min(100, toFiniteNumber(input.successChance) ?? 100))
      : undefined,
    failureMode: CRAFTING_FAILURE_MODES.has(failureModeRaw) ? failureModeRaw as CraftingRecipe['failureMode'] : 'none',
    isRepeatable: input.isRepeatable !== false,
    isEnabled: input.isEnabled !== false,
    tags: normalizeStringList(input.tags),
    visualProfileId: typeof input.visualProfileId === 'string' && input.visualProfileId.trim() ? input.visualProfileId.trim() : undefined,
    visualImageRef: typeof input.visualImageRef === 'string' && input.visualImageRef.trim() ? input.visualImageRef.trim() : undefined,
    visualIconRef: typeof input.visualIconRef === 'string' && input.visualIconRef.trim() ? input.visualIconRef.trim() : undefined,
    visualAnimationRef: visualAnimationRefRaw ? visualAnimationRefRaw : null,
    visualMaterialFamily: typeof input.visualMaterialFamily === 'string' && input.visualMaterialFamily.trim() ? input.visualMaterialFamily.trim() as CraftingRecipe['visualMaterialFamily'] : undefined,
    visualStyle: typeof input.visualStyle === 'string' && input.visualStyle.trim() ? input.visualStyle.trim() as CraftingRecipe['visualStyle'] : undefined,
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
  };
}

function normalizeRecipeVisualProfileInput(input: RecipeVisualProfile): RecipeVisualProfile {
  return {
    ...clone(input),
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    recipeTypes: normalizeStringList(input.recipeTypes),
    materialFamilies: normalizeStringList(input.materialFamilies) as RecipeVisualProfile['materialFamilies'],
    coverImageRef: typeof input.coverImageRef === 'string' && input.coverImageRef.trim() ? input.coverImageRef.trim() : undefined,
    iconImageRef: typeof input.iconImageRef === 'string' && input.iconImageRef.trim() ? input.iconImageRef.trim() : undefined,
    animationImageRef: typeof input.animationImageRef === 'string' && input.animationImageRef.trim() ? input.animationImageRef.trim() : undefined,
    backgroundStyle: typeof input.backgroundStyle === 'string' && input.backgroundStyle.trim() ? input.backgroundStyle.trim() : undefined,
    accentColor: typeof input.accentColor === 'string' && input.accentColor.trim() ? input.accentColor.trim() : undefined,
    isEnabled: input.isEnabled !== false,
  };
}

export function collectMissingCraftingRecipeReferenceWarnings(db: ContentDatabase): string[] {
  const materialIds = new Set((db.materials ?? []).map((entry) => String(entry?.id ?? '').trim()).filter(Boolean));
  const itemIds = new Set((db.items ?? []).map((entry) => String(entry?.id ?? '').trim()).filter(Boolean));
  const skillIds = new Set((db.skills ?? []).map((entry) => String(entry?.id ?? '').trim()).filter(Boolean));
  const questIds = new Set((db.quests ?? []).map((entry) => String(entry?.id ?? '').trim()).filter(Boolean));
  const warnings: string[] = [];

  for (const recipe of db.craftingRecipes ?? []) {
    if (!recipe || typeof recipe !== 'object') {
      continue;
    }

    const missingInputMaterials = Array.from(new Set(
      (recipe.inputMaterials ?? [])
        .map((entry) => String(entry?.materialId ?? '').trim())
        .filter((id) => id && !materialIds.has(id)),
    ));
    if (missingInputMaterials.length > 0) {
      warnings.push(`Crafting recipe '${recipe.id}' has missing input materials: ${missingInputMaterials.join(', ')}`);
    }

    const missingOutputMaterials = Array.from(new Set(
      (recipe.outputMaterials ?? [])
        .map((entry) => String(entry?.materialId ?? '').trim())
        .filter((id) => id && !materialIds.has(id)),
    ));
    if (missingOutputMaterials.length > 0) {
      warnings.push(`Crafting recipe '${recipe.id}' has missing output materials: ${missingOutputMaterials.join(', ')}`);
    }

    const missingInputItems = Array.from(new Set(
      (recipe.inputItems ?? [])
        .map((entry) => String(entry?.itemId ?? '').trim())
        .filter((id) => id && !itemIds.has(id)),
    ));
    if (missingInputItems.length > 0) {
      warnings.push(`Crafting recipe '${recipe.id}' has missing input items: ${missingInputItems.join(', ')}`);
    }

    const missingOutputItems = Array.from(new Set(
      (recipe.outputItems ?? [])
        .map((entry) => String(entry?.itemId ?? '').trim())
        .filter((id) => id && !itemIds.has(id)),
    ));
    if (missingOutputItems.length > 0) {
      warnings.push(`Crafting recipe '${recipe.id}' has missing output items: ${missingOutputItems.join(', ')}`);
    }

    const missingSkillIds = Array.from(new Set(
      (recipe.requiredSkillIds ?? [])
        .map((entry) => String(entry ?? '').trim())
        .filter((id) => id && !skillIds.has(id)),
    ));
    if (missingSkillIds.length > 0) {
      warnings.push(`Crafting recipe '${recipe.id}' has missing required skills: ${missingSkillIds.join(', ')}`);
    }

    const blueprintItemId = String(recipe.requiredBlueprintItemId ?? '').trim();
    if (blueprintItemId && !itemIds.has(blueprintItemId)) {
      warnings.push(`Crafting recipe '${recipe.id}' references missing blueprint item '${blueprintItemId}'.`);
    }

    const questId = String(recipe.requiredQuestId ?? '').trim();
    if (questId && !questIds.has(questId)) {
      warnings.push(`Crafting recipe '${recipe.id}' references missing quest '${questId}'.`);
    }

    const professionId = String(recipe.professionId ?? '').trim();
    if (professionId && !CRAFTING_PROFESSION_IDS.has(professionId)) {
      warnings.push(`Crafting recipe '${recipe.id}' uses unknown profession '${professionId}'.`);
    }
  }

  return warnings;
}

function normalizeVisualFxInput(input: VisualFxDefinition): VisualFxDefinition {
  const timestamp = nowIso();
  const id = String(input.id ?? '').trim();
  const type = input.type === 'static_image' ? 'static_image' : 'sprite_sheet';
  const frameWidth = toInteger(input.asset?.frameWidth);
  const frameHeight = toInteger(input.asset?.frameHeight);
  const frameCount = toInteger(input.asset?.frameCount);
  const frameRate = toFiniteNumber(input.animation?.frameRate);
  const repeat = toInteger(input.animation?.repeat);
  const durationMs = toInteger(input.animation?.durationMs);
  const scale = toFiniteNumber(input.render?.scale);
  const alpha = toFiniteNumber(input.render?.alpha);
  const originX = toFiniteNumber(input.render?.originX);
  const originY = toFiniteNumber(input.render?.originY);
  const depth = toInteger(input.render?.depth);
  const speed = toFiniteNumber(input.projectile?.speed);
  const normalizedStages = Array.isArray(input.stages)
    ? input.stages.map((stage, index) => ({
      id: String(stage.id ?? '').trim() || `stage_${index + 1}`,
      name: typeof stage.name === 'string' && stage.name.trim() ? stage.name.trim() : undefined,
      stageType: stage.stageType ?? 'impact',
      enabled: stage.enabled !== false,
      trigger: stage.trigger ?? (index === 0 ? 'on_start' : 'after_previous'),
      delayMs: Math.max(0, toInteger(stage.delayMs) ?? 0),
      fxRefId: typeof stage.fxRefId === 'string' && stage.fxRefId.trim() ? stage.fxRefId.trim() : undefined,
      fxVariantIds: normalizeStringList(stage.fxVariantIds),
      randomizeFxVariant: stage.randomizeFxVariant === true,
      playOn: stage.playOn ?? 'target',
      followMode: stage.followMode ?? 'none',
      durationMs: Math.max(0, toInteger(stage.durationMs) ?? 0),
      persistMs: Math.max(0, toInteger(stage.persistMs) ?? 0),
      movementBehavior: stage.movementBehavior ?? 'none',
      stopSequenceOnFailure: stage.stopSequenceOnFailure === true,
      parallelGroup: typeof stage.parallelGroup === 'string' && stage.parallelGroup.trim() ? stage.parallelGroup.trim() : undefined,
      branchToStageIds: normalizeStringList(stage.branchToStageIds),
      condition: stage.condition ?? 'always',
      targetMode: stage.targetMode ?? 'primary_target',
      audioRefIds: normalizeStringList(stage.audioRefIds),
      cameraShakePreset: stage.cameraShakePreset ?? 'none',
      chainFromPrevious: stage.chainFromPrevious === true,
      maxChainTargets: Math.max(1, toInteger(stage.maxChainTargets) ?? 3),
    }))
    : [];

  return {
    ...input,
    id,
    name: String(input.name ?? id).trim() || id,
    status: input.status === 'disabled' || input.status === 'draft' ? input.status : 'active',
    kind: input.kind === 'composite' ? 'composite' : 'single',
    category: input.category ?? 'hit',
    element: input.element,
    type,
    description: typeof input.description === 'string' && input.description.trim() ? input.description.trim() : undefined,
    asset: {
      url: String(input.asset?.url ?? '').trim(),
      key: typeof input.asset?.key === 'string' && input.asset.key.trim() ? input.asset.key.trim() : id,
      frameWidth: frameWidth ? Math.max(1, frameWidth) : undefined,
      frameHeight: frameHeight ? Math.max(1, frameHeight) : undefined,
      frameCount: frameCount ? Math.max(1, frameCount) : undefined,
    },
    animation: {
      frameRate: frameRate !== undefined ? Math.max(1, Math.min(120, frameRate)) : undefined,
      repeat: repeat ?? 0,
      durationMs: durationMs ? Math.max(1, durationMs) : undefined,
    },
    placement: {
      defaultPlayOn: input.placement?.defaultPlayOn ?? 'target',
      mode: input.placement?.mode ?? 'once',
      anchor: input.placement?.anchor ?? 'center',
      offsetX: toFiniteNumber(input.placement?.offsetX) ?? 0,
      offsetY: toFiniteNumber(input.placement?.offsetY) ?? 0,
      rotateToDirection: input.placement?.rotateToDirection === true,
      lingerDurationMs: Math.max(80, toInteger(input.placement?.lingerDurationMs) ?? 900),
    },
    render: {
      scale: scale !== undefined ? Math.max(0.01, scale) : 1,
      alpha: alpha !== undefined ? Math.max(0, Math.min(1, alpha)) : 1,
      rotation: toFiniteNumber(input.render?.rotation) ?? 0,
      blendMode: input.render?.blendMode ?? 'NORMAL',
      originX: originX !== undefined ? Math.max(0, Math.min(1, originX)) : 0.5,
      originY: originY !== undefined ? Math.max(0, Math.min(1, originY)) : 0.5,
      depth: depth ?? 5000,
    },
    projectile: {
      speed: speed !== undefined ? Math.max(1, speed) : undefined,
      arc: toFiniteNumber(input.projectile?.arc) ?? 0,
      destroyOnImpact: input.projectile?.destroyOnImpact !== false,
    },
    camera: {
      shakePreset: input.camera?.shakePreset ?? 'none',
    },
    audio: {
      defaultSoundId: typeof input.audio?.defaultSoundId === 'string' && input.audio.defaultSoundId.trim()
        ? input.audio.defaultSoundId.trim()
        : undefined,
      volume: Math.max(0, Math.min(1, toFiniteNumber(input.audio?.volume) ?? 1)),
    },
    stages: normalizedStages,
    tags: normalizeStringList(input.tags),
    createdAt: input.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

export function normalizeItemInput(input: AdminItem): AdminItem {
  const damageMin = typeof input.damageMin === 'number' && Number.isFinite(input.damageMin)
    ? Math.max(0, Math.round(input.damageMin))
    : undefined;
  const damageMax = typeof input.damageMax === 'number' && Number.isFinite(input.damageMax)
    ? Math.max(0, Math.round(input.damageMax))
    : undefined;

  const attackRange = typeof input.attackRange === 'number' && Number.isFinite(input.attackRange)
    ? Math.max(2, Math.min(24, Math.floor(input.attackRange)))
    : undefined;

  const pierceTargets = attackRange && typeof input.pierceTargets === 'number' && Number.isFinite(input.pierceTargets)
    ? Math.max(2, Math.min(12, Math.floor(input.pierceTargets)))
    : undefined;

  const splashRadius = attackRange && typeof input.splashRadius === 'number' && Number.isFinite(input.splashRadius)
    ? Math.max(1, Math.min(6, Math.floor(input.splashRadius)))
    : undefined;

  const splashCenterMultiplier = splashRadius
    ? Math.max(1, Math.min(10, normalizePositiveMultiplier(input.splashCenterMultiplier, 1)))
    : undefined;

  const rawOuterMultiplier = typeof input.splashOuterMultiplier === 'number' && Number.isFinite(input.splashOuterMultiplier)
    ? input.splashOuterMultiplier
    : 0.5;

  const splashOuterMultiplier = splashRadius
    ? Math.max(0, Math.min(splashCenterMultiplier ?? 1, rawOuterMultiplier))
    : undefined;

  const equipmentEffects = normalizeOptionalItemEffects(input.equipmentEffects);
  const useEffects = normalizeOptionalItemEffects(input.useEffects);
  const augment = normalizeItemAugmentInput(input.augment);
  const augmentSlots = normalizeItemSocketsInput(input.augmentSlots);
  const slotUpgradeRules = normalizeSlotUpgradeRulesInput(input.slotUpgradeRules);
  const maxAugmentSlots = typeof input.maxAugmentSlots === 'number' && Number.isFinite(input.maxAugmentSlots)
    ? Math.max(0, Math.round(input.maxAugmentSlots))
    : undefined;
  const imageRef = normalizeGameImageRefInput(input.imageRef, input.imagePath);

  return {
    ...input,
    id: input.id.trim(),
    name: input.name.trim(),
    type: input.type,
    subtype: input.subtype?.trim() || undefined,
    slot: normalizeAdminSlot(input.slot),
    handsRequired: input.type === 'weapon' && input.handsRequired === 2 ? 2 : 1,
    price: Math.max(0, Math.round(input.price || 0)),
    stackable: Boolean(input.stackable),
    maxStack: input.stackable ? Math.max(2, input.maxStack ?? 2) : 1,
    requiredStats: input.requiredStats ?? {},
    bonuses: input.bonuses ?? {},
    useEffect: input.useEffect,
    effects: Array.isArray(input.effects) ? clone(input.effects) : input.effects,
    combatEffects: Array.isArray(input.combatEffects) ? clone(input.combatEffects) : input.combatEffects,
    equipmentEffects,
    useEffects,
    augment,
    augmentSlots,
    canAddAugmentSlots: input.canAddAugmentSlots === true,
    maxAugmentSlots,
    slotUpgradeRules,
    canHaveRuneComplex: input.canHaveRuneComplex === true,
    defaultRuneComplexId: input.defaultRuneComplexId?.trim() || undefined,
    setId: input.setId?.trim() || undefined,
    tags: normalizeOptionalStringList(input.tags),
    battleVisuals: input.battleVisuals
      ? {
        battleSpriteAssetId: input.battleVisuals.battleSpriteAssetId?.trim() || undefined,
        deathEffectId: input.battleVisuals.deathEffectId?.trim() || undefined,
        hitEffectPreset: input.battleVisuals.hitEffectPreset?.trim() || undefined,
        castSoundId: input.battleVisuals.castSoundId?.trim() || undefined,
        impactSoundId: input.battleVisuals.impactSoundId?.trim() || undefined,
      }
      : undefined,
    damageMin: input.type === 'weapon' ? (damageMin ?? damageMax) : damageMin,
    damageMax: input.type === 'weapon' ? (damageMax ?? damageMin) : damageMax,
    attackRange,
    pierceTargets,
    splashRadius,
    splashCenterMultiplier,
    splashOuterMultiplier,
    gameplayDescription: input.gameplayDescription ?? '',
    loreDescription: input.loreDescription ?? '',
    imagePath: toLegacyImagePath(imageRef, input.imagePath),
    imageRef,
    isEnabled: input.isEnabled !== false,
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
  };
}

function normalizeSkillInput(input: AdminSkillDefinition): AdminSkillDefinition {
  const now = nowIso();
  const normalized: AdminSkillDefinition = {
    ...input,
    id: input.id.trim(),
    name: input.name.trim(),
    slug: input.slug?.trim() || input.id.trim(),
    type: input.type ?? SkillType.PHYSICAL,
    subtypes: Array.isArray(input.subtypes) ? input.subtypes : [],
    iconUrl: input.iconUrl?.trim() || undefined,
    shortDescription: input.shortDescription ?? '',
    gameplayDescription: input.gameplayDescription ?? '',
    loreDescription: input.loreDescription?.trim() || undefined,
    isActive: input.isActive !== false,
    isPassive: Boolean(input.isPassive),
    isToggleable: Boolean(input.isToggleable),
    maxLevel: Math.min(5, Math.max(1, Math.round(input.maxLevel || 1))) as AdminSkillDefinition['maxLevel'],
    levels: Array.isArray(input.levels) ? input.levels : [],
    target: input.target,
    costs: {
      resources: Array.isArray(input.costs?.resources) ? input.costs.resources : [],
      allowClassModifiers: input.costs?.allowClassModifiers !== false,
      allowRaceModifiers: input.costs?.allowRaceModifiers !== false,
      allowEquipmentModifiers: input.costs?.allowEquipmentModifiers !== false,
      isFree: Boolean(input.costs?.isFree),
    },
    damage: Array.isArray(input.damage) ? input.damage : [],
    healing: Array.isArray(input.healing) ? input.healing : [],
    effects: Array.isArray(input.effects) ? input.effects : [],
    summons: Array.isArray(input.summons) ? input.summons : [],
    transformations: Array.isArray(input.transformations) ? input.transformations : [],
    risks: Array.isArray(input.risks) ? input.risks : [],
    rune: input.rune ?? {
      usesRunes: false,
      runeIds: [],
      requiredRuneIds: [],
      bindingRuneIds: [],
      runeCosts: [],
      removable: true,
      canDestroyHost: false,
    },
    shamanism: input.shamanism ?? {
      requiresSpirit: false,
      requiresContract: false,
      canSummonEntity: false,
      canMakeContract: false,
      canLoseControl: false,
    },
    requirements: {
      ...(input.requirements ?? {}),
      requiredQuestIds: Array.isArray(input.requirements?.requiredQuestIds)
        ? input.requirements.requiredQuestIds.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
      requiredItems: Array.isArray(input.requirements?.requiredItems)
        ? input.requirements.requiredItems.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
      allowedClasses: Array.isArray(input.requirements?.allowedClasses)
        ? input.requirements.allowedClasses.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
      forbiddenClasses: Array.isArray(input.requirements?.forbiddenClasses)
        ? input.requirements.forbiddenClasses.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
      allowedRaces: Array.isArray(input.requirements?.allowedRaces)
        ? input.requirements.allowedRaces.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
      forbiddenRaces: Array.isArray(input.requirements?.forbiddenRaces)
        ? input.requirements.forbiddenRaces.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
      requiredSkills: Array.isArray(input.requirements?.requiredSkills)
        ? input.requirements.requiredSkills.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
    },
    acquisition: input.acquisition ?? {
      methods: [],
      isStarterSkill: false,
      isQuestReward: false,
      isBuyable: false,
      isDiscoverable: false,
      isAdminOnly: true,
    },
    classScaling: Array.isArray(input.classScaling) ? input.classScaling : [],
    raceRules: Array.isArray(input.raceRules) ? input.raceRules : [],
    cooldown: input.cooldown ?? { cooldownTurns: 0 },
    cast: input.cast ?? {
      castType: CastType.INSTANT,
      requiresLineOfSight: true,
      canBeInterrupted: false,
    },
    tags: Array.isArray(input.tags) ? input.tags : [],
    isPublished: Boolean(input.isPublished),
    isHidden: Boolean(input.isHidden),
    acquisitionMode: input.acquisitionMode === 'trainer'
      || input.acquisitionMode === 'quest'
      || input.acquisitionMode === 'dialogue'
      || input.acquisitionMode === 'item'
      || input.acquisitionMode === 'hidden'
      || input.acquisitionMode === 'admin'
      ? input.acquisitionMode
      : undefined,
    isTrainable: input.isTrainable === true,
    requiredLevel: typeof input.requiredLevel === 'number' && Number.isFinite(input.requiredLevel)
      ? Math.max(0, Math.round(input.requiredLevel))
      : undefined,
    requiredQuestId: input.requiredQuestId?.trim() || undefined,
    requiredCompletedQuestId: input.requiredCompletedQuestId?.trim() || undefined,
    requiredQuestItemId: input.requiredQuestItemId?.trim() || undefined,
    requiredNpcId: input.requiredNpcId?.trim() || undefined,
    requiredClassIds: Array.isArray(input.requiredClassIds)
      ? input.requiredClassIds.map((entry) => String(entry).trim()).filter(Boolean)
      : [],
    requiredRaceIds: Array.isArray(input.requiredRaceIds)
      ? input.requiredRaceIds.map((entry) => String(entry).trim()).filter(Boolean)
      : [],
    requiredKnownSkillIds: Array.isArray(input.requiredKnownSkillIds)
      ? input.requiredKnownSkillIds.map((entry) => String(entry).trim()).filter(Boolean)
      : [],
    adminNotes: input.adminNotes?.trim() || undefined,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };

  const errors = validateSkillDefinition(normalized);
  if (errors.length > 0) {
    throw new BadRequestException(errors.join(', '));
  }

  return normalized;
}

function normalizeAudioCueInput<T extends { assetId?: string; url?: string; volume?: number; loop?: boolean; fadeInMs?: number; fadeOutMs?: number; subtitle?: string }>(
  input: T | undefined,
): T | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const assetId = input.assetId ? String(input.assetId).trim() : '';
  const url = input.url ? String(input.url).trim() : '';
  if (!assetId && !url) {
    return undefined;
  }
  return {
    assetId: assetId || undefined,
    url: url || undefined,
    volume: typeof input.volume === 'number' && Number.isFinite(input.volume)
      ? Math.max(0, Math.min(1, input.volume))
      : undefined,
    loop: typeof input.loop === 'boolean' ? input.loop : undefined,
    fadeInMs: typeof input.fadeInMs === 'number' && Number.isFinite(input.fadeInMs)
      ? Math.max(0, Math.round(input.fadeInMs))
      : undefined,
    fadeOutMs: typeof input.fadeOutMs === 'number' && Number.isFinite(input.fadeOutMs)
      ? Math.max(0, Math.round(input.fadeOutMs))
      : undefined,
    subtitle: input.subtitle ? String(input.subtitle).trim() : undefined,
  } as T;
}

function normalizeDialogueInput(input: DialogueDefinition): DialogueDefinition {
  const now = nowIso();
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    title: String(input.title ?? '').trim(),
    npcId: input.npcId ? String(input.npcId).trim() : undefined,
    status: input.status === 'active' || input.status === 'disabled' ? input.status : 'draft',
    description: input.description ? String(input.description).trim() : undefined,
    startNodeId: String(input.startNodeId ?? 'start').trim() || 'start',
    introVoiceAssetId: input.introVoiceAssetId ? String(input.introVoiceAssetId).trim() : undefined,
    introMusicAssetId: input.introMusicAssetId ? String(input.introMusicAssetId).trim() : undefined,
    nodes: Array.isArray(input.nodes) ? clone(input.nodes) : [],
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function normalizeGameImageRefInput(input: unknown, legacyImagePath?: string | null): GameImageRef | undefined {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const ref = input as Record<string, unknown>;
    const type = String(ref.type ?? '').trim();
    if (type === 'image') {
      const src = String(ref.src ?? '').trim();
      if (src) {
        return { type: 'image', src };
      }
    }
    if (type === 'tileset') {
      const sheetId = String(ref.sheetId ?? '').trim();
      const frame = Number(ref.frame);
      if (sheetId && Number.isInteger(frame) && frame >= 0) {
        return { type: 'tileset', sheetId, frame };
      }
    }
  }

  const fallback = typeof legacyImagePath === 'string' ? legacyImagePath.trim() : '';
  if (fallback) {
    return { type: 'image', src: fallback };
  }
  return undefined;
}

function toLegacyImagePath(imageRef: GameImageRef | undefined, legacyImagePath?: string | null): string | undefined {
  if (imageRef?.type === 'image') {
    return imageRef.src.trim() || undefined;
  }
  if (imageRef) {
    return undefined;
  }
  const fallback = typeof legacyImagePath === 'string' ? legacyImagePath.trim() : '';
  return fallback || undefined;
}

function normalizeNpcInput(input: NpcDefinition): NpcDefinition {
  const now = nowIso();
  const portraitImageRef = normalizeGameImageRefInput(input.portraitImageRef, input.portraitUrl);
  const fullImageRef = normalizeGameImageRefInput(input.fullImageRef, input.fullImageUrl);
  const combatImageRef = normalizeGameImageRefInput(input.combatImageRef, input.combatImageUrl);
  const iconImageRef = normalizeGameImageRefInput(input.iconImageRef, input.iconUrl);
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    title: input.title ? String(input.title).trim() : undefined,
    status: input.status === 'active' || input.status === 'disabled' || input.status === 'archived' ? input.status : 'draft',
    kind: String(input.kind ?? 'civilian').trim() || 'civilian',
    race: String(input.race ?? 'human').trim() || 'human',
    description: input.description ? String(input.description).trim() : undefined,
    cityId: input.cityId ? String(input.cityId).trim() : undefined,
    locationId: input.locationId ? String(input.locationId).trim() : undefined,
    currentCityId: input.currentCityId ? String(input.currentCityId).trim() : undefined,
    homeCityId: input.homeCityId ? String(input.homeCityId).trim() : undefined,
    cityLocationId: input.cityLocationId ? String(input.cityLocationId).trim() : undefined,
    canTrade: input.canTrade === true,
    traderId: input.traderId ? String(input.traderId).trim() : undefined,
    dialogueId: input.dialogueId ? String(input.dialogueId).trim() : undefined,
    portraitUrl: toLegacyImagePath(portraitImageRef, input.portraitUrl),
    portraitImageRef,
    fullImageUrl: toLegacyImagePath(fullImageRef, input.fullImageUrl),
    fullImageRef,
    combatImageUrl: toLegacyImagePath(combatImageRef, input.combatImageUrl),
    combatImageRef,
    iconUrl: toLegacyImagePath(iconImageRef, input.iconUrl),
    iconImageRef,
    battleSpriteAssetId: input.battleSpriteAssetId ? String(input.battleSpriteAssetId).trim() : undefined,
    deathEffectId: input.deathEffectId ? String(input.deathEffectId).trim() : undefined,
    hitEffectPreset: input.hitEffectPreset ? String(input.hitEffectPreset).trim() : undefined,
    dialogueStartVoiceAssetId: input.dialogueStartVoiceAssetId ? String(input.dialogueStartVoiceAssetId).trim() : undefined,
    dialogueStartLine: input.dialogueStartLine ? String(input.dialogueStartLine).trim() : undefined,
    voiceProfileId: input.voiceProfileId ? String(input.voiceProfileId).trim() : undefined,
    worldSimTrader: input.worldSimTrader === true,
    mapBindings: Array.isArray(input.mapBindings) ? clone(input.mapBindings) : [],
    dialogues: Array.isArray(input.dialogues) ? clone(input.dialogues) : [],
    questBindings: Array.isArray(input.questBindings) ? clone(input.questBindings) : [],
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function normalizeMaterialInput(input: Material): Material {
  const now = nowIso();
  const imageRef = normalizeGameImageRefInput(input.imageRef, input.imagePath);
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    category: input.category,
    region: String(input.region ?? '').trim(),
    rarity: input.rarity,
    properties: Array.isArray(input.properties)
      ? (input.properties
          .map((entry) => String(entry ?? '').trim())
          .filter(Boolean) as Material['properties'])
      : [],
    averageMarketPrice: typeof input.averageMarketPrice === 'number' && Number.isFinite(input.averageMarketPrice)
      ? Math.max(0, Math.round(input.averageMarketPrice))
      : undefined,
    gameplayDescription: String(input.gameplayDescription ?? '').trim(),
    loreDescription: String(input.loreDescription ?? '').trim(),
    craftingProperties: normalizeMaterialCraftingPropertiesInput(input.craftingProperties),
    imagePath: toLegacyImagePath(imageRef, input.imagePath),
    imageRef,
    isEnabled: input.isEnabled !== false,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function normalizeQuestItemInput(input: QuestItemDefinition): QuestItemDefinition {
  const iconImageRef = normalizeGameImageRefInput(input.iconImageRef, input.iconUrl);
  const imageRef = normalizeGameImageRefInput(input.imageRef, input.imageUrl);
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    description: String(input.description ?? '').trim(),
    iconUrl: toLegacyImagePath(iconImageRef, input.iconUrl),
    iconImageRef,
    imageUrl: toLegacyImagePath(imageRef, input.imageUrl),
    imageRef,
    linkedQuestId: input.linkedQuestId ? String(input.linkedQuestId).trim() : undefined,
    canDrop: input.canDrop !== false,
    canSell: input.canSell !== false,
    canTrade: input.canTrade !== false,
    removeOnQuestComplete: input.removeOnQuestComplete !== false,
    showInQuestInventory: input.showInQuestInventory !== false,
  };
}

function normalizeQuestMarkerInput(input: unknown): QuestMarkerDefinition {
  const marker = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const iconImageRef = normalizeGameImageRefInput(marker.iconImageRef, marker.icon as string | undefined);
  const imageRef = normalizeGameImageRefInput(marker.imageRef, marker.imageUrl as string | undefined);

  const linkedQuestId = marker.linkedQuestId ?? marker.questId;
  const linkedObjectiveId = marker.linkedObjectiveId ?? marker.objectiveId;
  const linkedStepId = marker.linkedStepId ?? marker.stepId;
  const linkedNpcId = marker.linkedNpcId ?? marker.npcId;
  const type = String(marker.type ?? marker.markerType ?? 'quest_objective').trim() || 'quest_objective';
  const normalizeVisibility = (value: unknown): QuestMarkerDefinition['miniMapVisibility'] => {
    return value === 'always'
      || value === 'nearby'
      || value === 'selectedQuestOnly'
      || value === 'discoveredOnly'
      || value === 'hidden'
      ? value
      : undefined;
  };

  return {
    id: String(marker.id ?? '').trim(),
    mapId: String(marker.mapId ?? 'worldmap-main').trim() || 'worldmap-main',
    x: typeof marker.x === 'number' && Number.isFinite(marker.x) ? Math.max(0, Math.min(1, marker.x)) : 0.5,
    y: typeof marker.y === 'number' && Number.isFinite(marker.y) ? Math.max(0, Math.min(1, marker.y)) : 0.5,
    type,
    title: String(marker.title ?? '').trim(),
    linkedQuestId: linkedQuestId ? String(linkedQuestId).trim() : undefined,
    linkedStepId: linkedStepId ? String(linkedStepId).trim() : undefined,
    linkedObjectiveId: linkedObjectiveId ? String(linkedObjectiveId).trim() : undefined,
    linkedNpcId: linkedNpcId ? String(linkedNpcId).trim() : undefined,
    icon: toLegacyImagePath(iconImageRef, marker.icon as string | undefined),
    iconImageRef,
    visibleToPlayer: marker.visibleToPlayer !== false,
    conditionIds: Array.isArray(marker.conditionIds) ? marker.conditionIds.map((id) => String(id).trim()).filter(Boolean) : [],
    imageUrl: toLegacyImagePath(imageRef, marker.imageUrl as string | undefined),
    imageRef,
    isActive: marker.isActive === false ? false : undefined,
    requirements: Array.isArray(marker.requirements) ? marker.requirements as QuestInteractionRequirement[] : undefined,
    hideAfterQuestCompleted: marker.hideAfterQuestCompleted === true ? true : undefined,
    hideAfterObjectiveCompleted: marker.hideAfterObjectiveCompleted === true ? true : undefined,
    hideAfterStepCompleted: marker.hideAfterStepCompleted === true ? true : undefined,
    showOnWorldMap: marker.showOnWorldMap === false ? false : true,
    showOnMiniMap: marker.showOnMiniMap === false ? false : true,
    worldMapVisibility: normalizeVisibility(marker.worldMapVisibility),
    miniMapVisibility: normalizeVisibility(marker.miniMapVisibility),
  };
}

function normalizeQuestInput(input: QuestDefinition): QuestDefinition {
  const now = nowIso();
  const portraitImageRef = normalizeGameImageRefInput(input.portraitImageRef, input.portraitUrl);
  const imageRef = normalizeGameImageRefInput(input.imageRef, input.imageUrl);
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    title: String(input.title ?? '').trim(),
    adminDescription: input.adminDescription ? String(input.adminDescription) : '',
    playerDescription: input.playerDescription ? String(input.playerDescription) : '',
    category: String(input.category ?? 'global').trim() || 'global',
    status: input.status === 'active' || input.status === 'disabled' || input.status === 'archived' ? input.status : 'draft',
    kingdomId: input.kingdomId ? String(input.kingdomId).trim() : undefined,
    factionId: input.factionId ? String(input.factionId).trim() : undefined,
    cityId: input.cityId ? String(input.cityId).trim() : undefined,
    npcId: input.npcId ? String(input.npcId).trim() : undefined,
    recommendedLevel: typeof input.recommendedLevel === 'number' && Number.isFinite(input.recommendedLevel)
      ? Math.max(1, Math.round(input.recommendedLevel))
      : undefined,
    minLevel: typeof input.minLevel === 'number' && Number.isFinite(input.minLevel) ? Math.max(1, Math.round(input.minLevel)) : undefined,
    maxLevel: typeof input.maxLevel === 'number' && Number.isFinite(input.maxLevel) ? Math.max(1, Math.round(input.maxLevel)) : undefined,
    isRepeatable: Boolean(input.isRepeatable),
    isHidden: Boolean(input.isHidden),
    portraitUrl: toLegacyImagePath(portraitImageRef, input.portraitUrl),
    portraitImageRef,
    imageUrl: toLegacyImagePath(imageRef, input.imageUrl),
    imageRef,
    bannerUrl: input.bannerUrl ? String(input.bannerUrl).trim() : undefined,
    steps: Array.isArray(input.steps) ? clone(input.steps) : [],
    triggers: Array.isArray(input.triggers) ? clone(input.triggers) : [],
    conditions: Array.isArray(input.conditions) ? clone(input.conditions) : [],
    rewards: Array.isArray(input.rewards) ? clone(input.rewards) : [],
    failureConsequences: Array.isArray(input.failureConsequences) ? clone(input.failureConsequences) : [],
    flags: input.flags && typeof input.flags === 'object' ? clone(input.flags) : {},
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function normalizeQuestInteractionInput(input: QuestInteractionDefinition): QuestInteractionDefinition {
  const normalizeText = (value: unknown): string | undefined => {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : undefined;
  };

  const triggerType = String(input.triggerType ?? 'zone_inspect').trim();
  const safeTriggerType: QuestInteractionDefinition['triggerType'] =
    triggerType === 'zone_enter'
    || triggerType === 'marker_reached'
    || triggerType === 'object_interact'
    || triggerType === 'item_use'
    || triggerType === 'npc_interact'
    || triggerType === 'manual'
      ? triggerType
      : 'zone_inspect';

  const normalizedRequirements = Array.isArray(input.requirements)
    ? input.requirements
      .map((requirement) => ({
        ...requirement,
        type: String(requirement?.type ?? '').trim() as any,
        questId: normalizeText(requirement?.questId),
        objectiveId: normalizeText(requirement?.objectiveId),
        stepId: normalizeText(requirement?.stepId),
        itemId: normalizeText(requirement?.itemId),
        questItemId: normalizeText(requirement?.questItemId),
        skillId: normalizeText(requirement?.skillId),
        flagKey: normalizeText(requirement?.flagKey),
        raceId: normalizeText(requirement?.raceId),
        classId: normalizeText(requirement?.classId),
        factionId: normalizeText(requirement?.factionId),
        amount: typeof requirement?.amount === 'number' && Number.isFinite(requirement.amount)
          ? requirement.amount
          : undefined,
      }))
      .filter((requirement) => Boolean(requirement.type))
    : [];

  return {
    ...input,
    id: String(input.id ?? '').trim(),
    title: String(input.title ?? '').trim(),
    zoneId: normalizeText(input.zoneId),
    markerId: normalizeText(input.markerId),
    objectId: normalizeText(input.objectId),
    itemId: normalizeText(input.itemId),
    npcId: normalizeText(input.npcId),
    questId: normalizeText(input.questId),
    stepId: normalizeText(input.stepId),
    objectiveId: normalizeText(input.objectiveId),
    triggerType: safeTriggerType,
    text: String(input.text ?? '').trim(),
    imageId: normalizeText(input.imageId),
    choices: Array.isArray(input.choices)
      ? input.choices
        .map((choice) => ({
          ...choice,
          id: String(choice?.id ?? '').trim(),
          text: String(choice?.text ?? '').trim(),
          resultText: normalizeText(choice?.resultText),
          imageId: normalizeText(choice?.imageId),
          requirements: Array.isArray(choice?.requirements)
            ? choice.requirements
              .map((requirement) => ({
                ...requirement,
                type: String(requirement?.type ?? '').trim() as any,
                questId: normalizeText(requirement?.questId),
                objectiveId: normalizeText(requirement?.objectiveId),
                stepId: normalizeText(requirement?.stepId),
                itemId: normalizeText(requirement?.itemId),
                questItemId: normalizeText(requirement?.questItemId),
                skillId: normalizeText(requirement?.skillId),
                flagKey: normalizeText(requirement?.flagKey),
                raceId: normalizeText(requirement?.raceId),
                classId: normalizeText(requirement?.classId),
                factionId: normalizeText(requirement?.factionId),
                amount: typeof requirement?.amount === 'number' && Number.isFinite(requirement.amount)
                  ? requirement.amount
                  : undefined,
              }))
              .filter((requirement) => Boolean(requirement.type))
            : [],
          effects: Array.isArray(choice?.effects)
            ? choice.effects
              .map((effect) => ({
                ...effect,
                type: String(effect?.type ?? '').trim() as any,
                questId: normalizeText(effect?.questId),
                objectiveId: normalizeText(effect?.objectiveId),
                stepId: normalizeText(effect?.stepId),
                itemId: normalizeText(effect?.itemId),
                questItemId: normalizeText(effect?.questItemId),
                skillId: normalizeText(effect?.skillId),
                dialogueId: normalizeText(effect?.dialogueId),
                locationId: normalizeText(effect?.locationId),
                shopId: normalizeText(effect?.shopId),
                enemyId: normalizeText(effect?.enemyId),
                flagKey: normalizeText(effect?.flagKey),
                amount: typeof effect?.amount === 'number' && Number.isFinite(effect.amount)
                  ? effect.amount
                  : undefined,
              }))
              .filter((effect) => Boolean(effect.type))
            : [],
          close: choice?.close === true,
          completeObjectiveId: normalizeText(choice?.completeObjectiveId),
          completeStepId: normalizeText(choice?.completeStepId),
          completeQuest: choice?.completeQuest === true,
          giveRewards: choice?.giveRewards === true,
          nextQuestId: normalizeText(choice?.nextQuestId),
          startQuestId: normalizeText(choice?.startQuestId),
          setFlag: choice?.setFlag && typeof choice.setFlag === 'object' && String(choice.setFlag.key ?? '').trim()
            ? {
                key: String(choice.setFlag.key).trim(),
                value: choice.setFlag.value,
              }
            : undefined,
        }))
        .filter((choice) => Boolean(choice.id && choice.text))
      : [],
    isActive: input.isActive !== false,
    requirements: normalizedRequirements,
    consumeOnUse: input.consumeOnUse === true,
    hideAfterQuestCompleted: input.hideAfterQuestCompleted === true,
    hideAfterObjectiveCompleted: input.hideAfterObjectiveCompleted === true,
    hideAfterStepCompleted: input.hideAfterStepCompleted === true,
    requiredQuestId: normalizeText(input.requiredQuestId),
    requiredQuestStatus: input.requiredQuestStatus === 'completed' || input.requiredQuestStatus === 'failed'
      ? input.requiredQuestStatus
      : input.requiredQuestStatus === 'active'
        ? 'active'
        : undefined,
    requiredObjectiveId: normalizeText(input.requiredObjectiveId),
    requiredItemId: normalizeText(input.requiredItemId),
    requiredQuestItemId: normalizeText(input.requiredQuestItemId),
    blockedEntryDialogueId: normalizeText(input.blockedEntryDialogueId),
    blockedEntryNpcId: normalizeText(input.blockedEntryNpcId),
    blockedEntryMessage: normalizeText(input.blockedEntryMessage),
  };
}

function normalizeMerchantItem(entry: MerchantItem): MerchantItem {
  return {
    itemId: entry.itemId.trim(),
    stock: typeof entry.stock === 'number' && Number.isFinite(entry.stock) ? Math.max(0, Math.round(entry.stock)) : undefined,
    infiniteStock: entry.infiniteStock !== false,
    priceOverride: typeof entry.priceOverride === 'number' && Number.isFinite(entry.priceOverride)
      ? Math.max(0, Math.round(entry.priceOverride))
      : undefined,
    priceMultiplier: normalizePositiveMultiplier(entry.priceMultiplier, 1),
    isEnabled: entry.isEnabled !== false,
  };
}

function normalizeMerchantInput(input: AdminMerchant): AdminMerchant {
  const cityId = input.cityId?.trim() || undefined;
  const cityLocationId = input.cityLocationId?.trim() || undefined;
  if (cityLocationId && !cityId) {
    throw new BadRequestException('cityLocationId requires cityId');
  }

  return {
    ...input,
    id: input.id.trim(),
    name: input.name.trim(),
    city: input.city.trim(),
    cityId,
    cityLocationId,
    location: input.location?.trim() || undefined,
    placeType: input.placeType === 'location' ? 'location' : input.placeType === 'city' ? 'city' : undefined,
    placeId: input.placeId?.trim() || undefined,
    description: input.description?.trim() || undefined,
    portraitPath: input.portraitPath?.trim() || undefined,
    priceMultiplier: normalizePositiveMultiplier(input.priceMultiplier, 1),
    worldSimTrader: input.worldSimTrader === true,
    materialTradingEnabled: input.materialTradingEnabled === true,
    materialTrades: Array.isArray(input.materialTrades)
      ? input.materialTrades
        .map((entry) => ({
          materialId: String(entry.materialId ?? '').trim(),
          buys: entry.buys !== false,
          sells: entry.sells !== false,
          isEnabled: entry.isEnabled !== false,
        }))
        .filter((entry) => Boolean(entry.materialId))
      : [],
    isEnabled: input.isEnabled !== false,
    items: Array.isArray(input.items) ? input.items.map(normalizeMerchantItem).filter((entry) => entry.itemId) : [],
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
  };
}

function normalizeLocationInput(input: WorldLocation): WorldLocation {
  const now = nowIso();
  const normalizeVariantStringList = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((entry) => String(entry ?? '').trim()).filter(Boolean) : [];

  return {
    ...clone(input),
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    slug: input.slug?.trim() || undefined,
    type: 'location',
    subtype: typeof input.subtype === 'string' ? input.subtype.trim() || undefined : undefined,
    status: input.status === 'active' || input.status === 'disabled' || input.status === 'archived' ? input.status : 'draft',
    description: input.description?.trim() || undefined,
    shortDescription: input.shortDescription?.trim() || undefined,
    regionId: input.regionId?.trim() || undefined,
    parentLocationId: input.parentLocationId?.trim() || undefined,
    kingdomId: input.kingdomId?.trim() || undefined,
    factionId: input.factionId?.trim() || undefined,
    clanId: input.clanId?.trim() || undefined,
    tribeId: input.tribeId?.trim() || undefined,
    isHidden: input.isHidden === true,
    isDiscovered: input.isDiscovered === true,
    requiresDiscovery: input.requiresDiscovery === true,
    discoveryQuestId: input.discoveryQuestId?.trim() || undefined,
    defaultImageId: input.defaultImageId?.trim() || undefined,
    defaultImagePath: input.defaultImagePath?.trim() || undefined,
    currentState: input.currentState?.trim() || undefined,
    stateVariants: Array.isArray(input.stateVariants)
      ? input.stateVariants
        .map((variant) => ({
          ...clone(variant),
          stateKey: String(variant.stateKey ?? '').trim(),
          name: String(variant.name ?? '').trim(),
          descriptionOverride: variant.descriptionOverride?.trim() || undefined,
          imageId: variant.imageId?.trim() || undefined,
          imagePath: variant.imagePath?.trim() || undefined,
          visibleOnMap: variant.visibleOnMap === true,
          canEnter: variant.canEnter !== false,
          ownerFactionId: variant.ownerFactionId?.trim() || undefined,
          npcIds: normalizeVariantStringList(variant.npcIds),
          merchantIds: normalizeVariantStringList(variant.merchantIds),
          questIds: normalizeVariantStringList(variant.questIds),
          dialogueIds: normalizeVariantStringList(variant.dialogueIds),
          battleMapIds: normalizeVariantStringList(variant.battleMapIds),
          tags: normalizeVariantStringList(variant.tags),
        }))
        .filter((variant) => Boolean(variant.stateKey) && Boolean(variant.name))
      : [],
    areas: Array.isArray(input.areas)
      ? input.areas
        .map((area) => ({
          ...clone(area),
          id: String(area.id ?? '').trim(),
          name: String(area.name ?? '').trim(),
          type: area.type?.trim() || undefined,
          description: area.description?.trim() || undefined,
          imageId: area.imageId?.trim() || undefined,
          imagePath: area.imagePath?.trim() || undefined,
          shapeType: area.shapeType === 'rectangle' || area.shapeType === 'circle' || area.shapeType === 'polygon' || area.shapeType === 'none'
            ? area.shapeType
            : 'none',
          shape: area.shape
            ? {
                x: typeof area.shape.x === 'number' && Number.isFinite(area.shape.x) ? area.shape.x : undefined,
                y: typeof area.shape.y === 'number' && Number.isFinite(area.shape.y) ? area.shape.y : undefined,
                radius: typeof area.shape.radius === 'number' && Number.isFinite(area.shape.radius) ? area.shape.radius : undefined,
                width: typeof area.shape.width === 'number' && Number.isFinite(area.shape.width) ? area.shape.width : undefined,
                height: typeof area.shape.height === 'number' && Number.isFinite(area.shape.height) ? area.shape.height : undefined,
                points: Array.isArray(area.shape.points)
                  ? area.shape.points
                    .filter((point) => point && typeof point === 'object')
                    .map((point) => ({
                      x: typeof point.x === 'number' && Number.isFinite(point.x) ? point.x : 0,
                      y: typeof point.y === 'number' && Number.isFinite(point.y) ? point.y : 0,
                    }))
                  : undefined,
              }
            : undefined,
          npcIds: normalizeVariantStringList(area.npcIds),
          merchantIds: normalizeVariantStringList(area.merchantIds),
          questIds: normalizeVariantStringList(area.questIds),
          dialogueIds: normalizeVariantStringList(area.dialogueIds),
          battleMapIds: normalizeVariantStringList(area.battleMapIds),
          visibleInStates: normalizeVariantStringList(area.visibleInStates),
          hiddenUntilQuestId: area.hiddenUntilQuestId?.trim() || undefined,
          hiddenAfterQuestId: area.hiddenAfterQuestId?.trim() || undefined,
          canEnter: area.canEnter !== false,
          isHidden: area.isHidden === true,
          tags: normalizeVariantStringList(area.tags),
        }))
        .filter((area) => Boolean(area.id) && Boolean(area.name))
      : [],
    npcIds: normalizeVariantStringList(input.npcIds),
    merchantIds: normalizeVariantStringList(input.merchantIds),
    questIds: normalizeVariantStringList(input.questIds),
    dialogueIds: normalizeVariantStringList(input.dialogueIds),
    battleMapIds: normalizeVariantStringList(input.battleMapIds),
    entryRequirements: input.entryRequirements
      ? {
          minLevel: typeof input.entryRequirements.minLevel === 'number' && Number.isFinite(input.entryRequirements.minLevel)
            ? Math.max(0, Math.round(input.entryRequirements.minLevel))
            : undefined,
          requiredQuestId: input.entryRequirements.requiredQuestId?.trim() || undefined,
          requiredCompletedQuestId: input.entryRequirements.requiredCompletedQuestId?.trim() || undefined,
          requiredItemIds: normalizeVariantStringList(input.entryRequirements.requiredItemIds),
          requiredFactionId: input.entryRequirements.requiredFactionId?.trim() || undefined,
          requiredFactionReputation: typeof input.entryRequirements.requiredFactionReputation === 'number'
            && Number.isFinite(input.entryRequirements.requiredFactionReputation)
            ? input.entryRequirements.requiredFactionReputation
            : undefined,
          requiredRace: normalizeVariantStringList(input.entryRequirements.requiredRace),
          requiredClass: normalizeVariantStringList(input.entryRequirements.requiredClass),
          requiredProfession: normalizeVariantStringList(input.entryRequirements.requiredProfession),
          requiredFlag: input.entryRequirements.requiredFlag?.trim() || undefined,
        }
      : undefined,
    locationEffects: Array.isArray(input.locationEffects)
      ? input.locationEffects
        .map((effect) => ({
          ...clone(effect),
          type: String(effect.type ?? '').trim(),
          value: typeof effect.value === 'number' && Number.isFinite(effect.value) ? effect.value : undefined,
          stat: effect.stat?.trim() || undefined,
          element: effect.element?.trim() || undefined,
          description: effect.description?.trim() || undefined,
        }))
        .filter((effect) => Boolean(effect.type))
      : [],
    tags: normalizeVariantStringList(input.tags),
    published: input.published === true,
    hidden: input.hidden === true,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function isBuiltInItemId(itemId: string): boolean {
  return Object.prototype.hasOwnProperty.call(ITEMS, itemId);
}

function isBuiltInMerchantId(merchantId: string): boolean {
  return BUILTIN_MERCHANT_IDS.has(merchantId);
}

function shouldReplaceItemsFromLegacy(existing: AdminItem[], incoming: AdminItem[]): boolean {
  if (incoming.length === 0 || existing.length === 0) {
    return false;
  }

  const incomingIds = new Set(incoming.map((item) => item.id));
  const incomingHasCustomItems = incoming.some((item) => !isBuiltInItemId(item.id));
  const existingHasUnexpectedCustomItems = existing.some((item) => !isBuiltInItemId(item.id) && !incomingIds.has(item.id));
  const existingHasBuiltInOnlyNoise = existing.some((item) => isBuiltInItemId(item.id) && !incomingIds.has(item.id));

  return incomingHasCustomItems && existingHasBuiltInOnlyNoise && !existingHasUnexpectedCustomItems;
}

function shouldReplaceMerchantsFromLegacy(existing: AdminMerchant[], incoming: AdminMerchant[]): boolean {
  if (incoming.length === 0 || existing.length === 0) {
    return false;
  }

  const incomingIds = new Set(incoming.map((merchant) => merchant.id));
  const incomingHasCustomMerchants = incoming.some((merchant) => !isBuiltInMerchantId(merchant.id));
  const existingHasUnexpectedCustomMerchants = existing.some((merchant) => !isBuiltInMerchantId(merchant.id) && !incomingIds.has(merchant.id));
  const existingHasBuiltInOnlyNoise = existing.some((merchant) => isBuiltInMerchantId(merchant.id) && !incomingIds.has(merchant.id));

  return incomingHasCustomMerchants && existingHasBuiltInOnlyNoise && !existingHasUnexpectedCustomMerchants;
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const merged = new Map<string, T>();

  for (const entry of existing) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    if (!entry.id) {
      continue;
    }
    merged.set(entry.id, clone(entry));
  }

  for (const entry of incoming) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const id = String(entry.id ?? '').trim();
    if (!id) {
      continue;
    }
    merged.set(id, clone({ ...entry, id }));
  }

  return [...merged.values()];
}

function addMissingById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const existingIds = new Set(existing.map((entry) => String(entry?.id ?? '').trim()).filter(Boolean));
  const addedIds = new Set<string>();
  const result = existing
    .filter((entry) => entry && typeof entry === 'object' && String(entry.id ?? '').trim())
    .map((entry) => clone(entry));

  for (const entry of incoming) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const id = String(entry.id ?? '').trim();
    if (!id || existingIds.has(id) || addedIds.has(id)) {
      continue;
    }
    addedIds.add(id);
    result.push(clone({ ...entry, id }));
  }

  return result;
}

interface AddMissingImportActions {
  createMissing: string[];
  skippedExisting: string[];
}

type AddMissingImportActionMap = Record<string, AddMissingImportActions>;

function emptyAddMissingActions(): AddMissingImportActions {
  return { createMissing: [], skippedExisting: [] };
}

function countAddMissingActions(actions: AddMissingImportActionMap): { created: number; updated: number; skippedExisting: number } {
  return Object.values(actions).reduce(
    (summary, action) => ({
      created: summary.created + action.createMissing.length,
      updated: 0,
      skippedExisting: summary.skippedExisting + action.skippedExisting.length,
    }),
    { created: 0, updated: 0, skippedExisting: 0 },
  );
}

function findDuplicateIds<T extends { id: string }>(entries: T[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const entry of entries) {
    // Skip null or undefined entries
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const id = String(entry.id ?? '').trim();
    if (!id) {
      continue;
    }
    if (seen.has(id)) {
      duplicates.add(id);
      continue;
    }
    seen.add(id);
  }

  return [...duplicates];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasValidId(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return String(value.id ?? '').trim().length > 0;
}

function sanitizeObjectArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry) => isRecord(entry)) as T[];
}

function sanitizeIdObjectArray<T extends { id: string }>(value: unknown): T[] {
  return sanitizeObjectArray<T>(value).filter((entry) => hasValidId(entry));
}

function hasMojibakeQuestionMarks(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return /\?{3,}/.test(value);
}

function toFallbackLabelFromId(id: string, defaultLabel: string): string {
  const normalized = String(id ?? '').trim();
  if (!normalized) {
    return defaultLabel;
  }

  const words = normalized
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.length > 0 ? words.join(' ') : defaultLabel;
}

function repairSuspiciousText(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return fallback;
  }
  return hasMojibakeQuestionMarks(normalized) ? fallback : normalized;
}

function resolveContentDataDir(): string {
  const configured = String(process.env.CONTENT_DATA_DIR ?? '').trim();
  if (!configured) {
    return join(process.cwd(), 'data');
  }

  return isAbsolute(configured) ? configured : join(process.cwd(), configured);
}

function resolveContentDataFilePath(): string {
  const configuredLegacyPath = String(process.env.CONTENT_DB_PATH ?? '').trim();
  if (configuredLegacyPath) {
    return isAbsolute(configuredLegacyPath) ? configuredLegacyPath : join(process.cwd(), configuredLegacyPath);
  }

  const configuredFile = String(process.env.CONTENT_DATA_FILE ?? 'theend_content.local.json').trim() || 'theend_content.local.json';
  return join(resolveContentDataDir(), configuredFile);
}

function resolveContentExampleFilePath(): string {
  return join(resolveContentDataDir(), 'theend_content.example.json');
}

function resolveLegacyContentTemplatePath(): string {
  const configured = String(process.env.CONTENT_DB_PATH ?? '').trim();
  if (!configured) {
    return join(process.cwd(), 'data', 'content-db.json');
  }

  if (isAbsolute(configured)) {
    return configured;
  }

  return join(process.cwd(), configured);
}

function resolveStorageMode(): ContentStorageMode {
  return getContentStorageMode();
}

// ─── WorldSim config normalization ───────────────────────────────────────────

function normalizeWorldNpcArchetype(raw: unknown): WorldNpcArchetype {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? '').trim(),
    name: String(r.name ?? '').trim() || String(r.id ?? '').trim(),
    kind: (r.kind as WorldNpcArchetype['kind']) ?? 'merchant',
    npcTemplateId: r.npcTemplateId ? String(r.npcTemplateId).trim() : undefined,
    merchantId: r.merchantId ? String(r.merchantId).trim() : undefined,
    sourceType: (r.sourceType as WorldNpcArchetype['sourceType']) ?? undefined,
    sourceId: r.sourceId ? String(r.sourceId).trim() : undefined,
    economyProfile: r.economyProfile && typeof r.economyProfile === 'object' ? (r.economyProfile as WorldNpcArchetype['economyProfile']) : undefined,
    escorts: r.escorts && typeof r.escorts === 'object' ? (r.escorts as WorldNpcArchetype['escorts']) : undefined,
    worldSpriteId: String(r.worldSpriteId ?? 'trader_world_sprite').trim() || 'trader_world_sprite',
    restingWorldSpriteId: r.restingWorldSpriteId ? String(r.restingWorldSpriteId).trim() : undefined,
    portraitId: r.portraitId ? String(r.portraitId).trim() : undefined,
    isEnabled: r.isEnabled !== false,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : nowIso(),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : nowIso(),
  };
}

function normalizeWorldRoute(raw: unknown): WorldRoute {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? '').trim(),
    name: String(r.name ?? '').trim() || String(r.id ?? '').trim(),
    waypoints: Array.isArray(r.waypoints)
      ? r.waypoints.filter(Boolean).map((wp: unknown) => {
          const w = (wp && typeof wp === 'object' ? wp : {}) as Record<string, unknown>;
          return {
            zoneId: String(w.zoneId ?? '').trim(),
            cityId: w.cityId ? String(w.cityId).trim() : undefined,
            stopDurationMin: typeof w.stopDurationMin === 'number' ? w.stopDurationMin : undefined,
            stopDurationMax: typeof w.stopDurationMax === 'number' ? w.stopDurationMax : undefined,
          };
        })
      : [],
    travelTimingDevMinutes: typeof r.travelTimingDevMinutes === 'number' ? r.travelTimingDevMinutes : 10,
    travelTimingReleaseHours: typeof r.travelTimingReleaseHours === 'number' ? r.travelTimingReleaseHours : 6,
    dangerLevel: typeof r.dangerLevel === 'number' ? r.dangerLevel : 3,
    restChance: typeof r.restChance === 'number' ? r.restChance : 0.25,
    allowedArchetypes: Array.isArray(r.allowedArchetypes) ? r.allowedArchetypes.map((a: unknown) => String(a ?? '').trim()).filter(Boolean) : [],
    isActive: r.isActive !== false,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : nowIso(),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : nowIso(),
  };
}

function normalizeWorldSpawnRule(raw: unknown): WorldSpawnRule {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? '').trim(),
    name: String(r.name ?? '').trim() || String(r.id ?? '').trim(),
    spawnType: (r.spawnType as WorldSpawnRule['spawnType']) ?? 'time_based',
    spawnTimeDevMinutes: typeof r.spawnTimeDevMinutes === 'number' ? r.spawnTimeDevMinutes : undefined,
    spawnTimeReleaseHours: typeof r.spawnTimeReleaseHours === 'number' ? r.spawnTimeReleaseHours : undefined,
    archetypeIds: Array.isArray(r.archetypeIds) ? r.archetypeIds.map((a: unknown) => String(a ?? '').trim()).filter(Boolean) : [],
    minGroupSize: typeof r.minGroupSize === 'number' ? Math.max(1, r.minGroupSize) : 1,
    maxGroupSize: typeof r.maxGroupSize === 'number' ? Math.max(1, r.maxGroupSize) : 1,
    spawnWeight: typeof r.spawnWeight === 'number' ? Math.min(1, Math.max(0, r.spawnWeight)) : 1,
    conditions: r.conditions && typeof r.conditions === 'object' ? (r.conditions as WorldSpawnRule['conditions']) : undefined,
    cooldownDev: typeof r.cooldownDev === 'number' ? r.cooldownDev : undefined,
    cooldownRelease: typeof r.cooldownRelease === 'number' ? r.cooldownRelease : undefined,
    lastSpawnTime: typeof r.lastSpawnTime === 'string' ? r.lastSpawnTime : undefined,
    isActive: r.isActive !== false,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : nowIso(),
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : nowIso(),
  };
}

export function normalizeWorldSimConfig(input: unknown): WorldSimConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  // Support legacy field aliases
  const archetypesRaw = Array.isArray(raw.npcArchetypes)
    ? raw.npcArchetypes
    : Array.isArray((raw as any).archetypes)
    ? (raw as any).archetypes
    : [];

  const routesRaw = Array.isArray(raw.routes)
    ? raw.routes
    : Array.isArray((raw as any).npcRoutes)
    ? (raw as any).npcRoutes
    : [];

  const spawnRulesRaw = Array.isArray(raw.spawnRules)
    ? raw.spawnRules
    : Array.isArray((raw as any).rules)
    ? (raw as any).rules
    : [];

  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
    npcArchetypes: archetypesRaw.filter(Boolean).map(normalizeWorldNpcArchetype),
    routes: routesRaw.filter(Boolean).map(normalizeWorldRoute),
    spawnRules: spawnRulesRaw.filter(Boolean).map(normalizeWorldSpawnRule),
  };
}

function contentFromMaybeEnvelope(raw: unknown): Partial<ContentDatabase> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'content' in raw) {
    const content = (raw as { content?: unknown }).content;
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      return content as Partial<ContentDatabase>;
    }
  }

  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Partial<ContentDatabase> : {};
}

function extractExtraContent(raw: unknown): Record<string, unknown> {
  const content = contentFromMaybeEnvelope(raw);
  const known = new Set<string>(['version', 'worldMap', ...CONTENT_COLLECTIONS]);
  const extras: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(content as Record<string, unknown>)) {
    if (!known.has(key)) {
      extras[key] = value === undefined ? null : clone(value);
    }
  }

  return extras;
}

@Injectable()
export class ContentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContentService.name);
  private readonly runtimeFile = resolveContentDataFilePath();
  private readonly dataDir = dirname(this.runtimeFile);
  private readonly templateFile = resolveContentExampleFilePath();
  private readonly legacyTemplateFile = resolveLegacyContentTemplatePath();
  private readonly backupDir = join(this.dataDir, CONTENT_DB_BACKUP_DIR);
  private readonly autosaveDir = join(this.dataDir, CONTENT_AUTOSAVE_DIR);
  private backupSlot = 0;
  private readonly storageMode: ContentStorageMode = resolveStorageMode();
  private dbCache: ContentDatabase | null = null;
  private fileCacheMtimeMs = 0;
  private initPromise: Promise<void> | null = null;
  private extraContent: Record<string, unknown> = {};
  private imageAssetsMaterialized = 0;
  private writeQueue: Promise<ContentDatabase> = Promise.resolve(createEmptyDatabase());
  private autosaveTimer: NodeJS.Timeout | null = null;
  private autosaveSlot = 0;
  private autosaveStatus: ContentAutosaveStatus = {
    enabled: true,
    intervalMs: CONTENT_AUTOSAVE_INTERVAL_MS,
    slotCount: CONTENT_AUTOSAVE_SLOTS,
    currentSlot: 0,
    files: [],
  };

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureInitialized();
    this.startAutosaveLoop();
  }

  onModuleDestroy(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initializeStorage().catch((error) => {
        this.initPromise = null;
        throw error;
      });
    }

    await this.initPromise;
  }

  getStorageMode(): ContentStorageMode {
    return this.storageMode;
  }

  getContentFileName(): string | undefined {
    return this.storageMode === 'file' ? this.runtimeFile.split(/[\\/]/).pop() : undefined;
  }

  assertContentImportAllowed(): void {
    if (isTruthyEnv(process.env.ALLOW_CONTENT_IMPORT)) {
      return;
    }

    throw new ForbiddenException('Local content import/reload/seed endpoints are disabled. Set ALLOW_CONTENT_IMPORT=true to enable them explicitly.');
  }

  private ensureCache(): ContentDatabase {
    if (!this.dbCache) {
      throw new InternalServerErrorException('Content storage is not initialized.');
    }

    return this.dbCache;
  }

  private getContentStoreDelegate(): {
    findUnique(args: { where: { key: string } }): Promise<{ value: JsonValue } | null>;
    upsert(args: { where: { key: string }; update: { value: InputJsonValue }; create: { key: string; value: InputJsonValue } }): Promise<unknown>;
  } {
    return (this.prisma as unknown as {
      contentStore: {
        findUnique(args: { where: { key: string } }): Promise<{ value: JsonValue } | null>;
        upsert(args: { where: { key: string }; update: { value: InputJsonValue }; create: { key: string; value: InputJsonValue } }): Promise<unknown>;
      };
    }).contentStore;
  }

  private async initializeStorage(): Promise<void> {
    if (this.storageMode === 'file') {
      this.dbCache = this.loadFromFileStorage();
      this.logger.log(`Content storage initialized in file mode using ${this.runtimeFile}.`);
      return;
    }

    await this.ensureDatabaseStorageSchema();

    const store = await this.getContentStoreDelegate().findUnique({
      where: { key: CONTENT_STORE_KEY },
    });

    if (store) {
      const raw = store.value && typeof store.value === 'object'
        ? (store.value as Partial<ContentDatabase>)
        : {};
      const materializedBefore = this.imageAssetsMaterialized;
      this.dbCache = this.normalizeDatabase(raw);
      if (this.imageAssetsMaterialized > materializedBefore) {
        await this.persist(this.dbCache);
      }
      this.logger.log('Content storage initialized from postgres.');
      return;
    }

    const template = this.loadTemplateDatabase() ?? createEmptyDatabase();
    await this.persist(template);
    this.logger.log('Content storage bootstrapped from repository template into database.');
  }

  private loadFromFileStorage(): ContentDatabase {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    if (!existsSync(this.runtimeFile)) {
      const seeded = this.loadTemplateDatabase() ?? createEmptyDatabase();
      this.persistToFile(seeded);
      return this.ensureCache();
    }

    try {
      const raw = JSON.parse(readFileSync(this.runtimeFile, 'utf8')) as unknown;
      this.extraContent = extractExtraContent(raw);
      const materializedBefore = this.imageAssetsMaterialized;
      const normalized = this.normalizeDatabase(contentFromMaybeEnvelope(raw));
      this.fileCacheMtimeMs = getFileMtimeMs(this.runtimeFile);
      if (this.imageAssetsMaterialized > materializedBefore) {
        this.logger.log(`Materialized ${this.imageAssetsMaterialized - materializedBefore} embedded image(s) into Resurse/assets/upload.`);
        this.persistToFile(normalized);
        return this.ensureCache();
      }
      return normalized;
    } catch {
      const fallback = this.loadTemplateDatabase() ?? createEmptyDatabase();
      this.persistToFile(fallback);
      return this.ensureCache();
    }
  }

  private validateDatabaseIntegrity(db: ContentDatabase): string[] {
    const errors: string[] = [];
    const warnings = new Set<string>();

    const duplicateItems = findDuplicateIds(db.items);
    if (duplicateItems.length > 0) {
      errors.push(`Duplicate item ids: ${duplicateItems.join(', ')}`);
    }

    const duplicateSkills = findDuplicateIds(db.skills);
    if (duplicateSkills.length > 0) {
      errors.push(`Duplicate skill ids: ${duplicateSkills.join(', ')}`);
    }

    const skillSlugs = new Set<string>();
    for (const skill of db.skills) {
      // Skip null or invalid entries
      if (!skill || typeof skill !== 'object') {
        errors.push(`Skill entry is null or invalid`);
        continue;
      }
      if (skillSlugs.has(skill.slug)) {
        errors.push(`Duplicate skill slug: ${skill.slug}`);
      }
      skillSlugs.add(skill.slug);
    }

    const duplicateMerchants = findDuplicateIds(db.merchants);
    if (duplicateMerchants.length > 0) {
      errors.push(`Duplicate merchant ids: ${duplicateMerchants.join(', ')}`);
    }

    const duplicateImages = findDuplicateIds(db.images);
    if (duplicateImages.length > 0) {
      errors.push(`Duplicate image ids: ${duplicateImages.join(', ')}`);
    }

    const duplicateDialogues = findDuplicateIds(db.dialogues);
    if (duplicateDialogues.length > 0) {
      errors.push(`Duplicate dialogue ids: ${duplicateDialogues.join(', ')}`);
    }

    const duplicateNpcs = findDuplicateIds(db.npcs);
    if (duplicateNpcs.length > 0) {
      errors.push(`Duplicate npc ids: ${duplicateNpcs.join(', ')}`);
    }

    const duplicateQuests = findDuplicateIds(db.quests);
    if (duplicateQuests.length > 0) {
      errors.push(`Duplicate quest ids: ${duplicateQuests.join(', ')}`);
    }

    const duplicateQuestInteractions = findDuplicateIds(db.questInteractions);
    if (duplicateQuestInteractions.length > 0) {
      errors.push(`Duplicate quest interaction ids: ${duplicateQuestInteractions.join(', ')}`);
    }

    const duplicateQuestItems = findDuplicateIds(db.questItems);
    if (duplicateQuestItems.length > 0) {
      errors.push(`Duplicate quest item ids: ${duplicateQuestItems.join(', ')}`);
    }

    const duplicateQuestMarkers = findDuplicateIds(db.questMarkers);
    if (duplicateQuestMarkers.length > 0) {
      errors.push(`Duplicate quest marker ids: ${duplicateQuestMarkers.join(', ')}`);
    }

    const duplicateCraftingRecipes = findDuplicateIds(db.craftingRecipes ?? []);
    if (duplicateCraftingRecipes.length > 0) {
      errors.push(`Duplicate crafting recipe ids: ${duplicateCraftingRecipes.join(', ')}`);
    }

    const duplicateItemSets = findDuplicateIds(db.itemSets ?? []);
    if (duplicateItemSets.length > 0) {
      errors.push(`Duplicate item set ids: ${duplicateItemSets.join(', ')}`);
    }

    const duplicateRuneComplexes = findDuplicateIds(db.runeComplexes ?? []);
    if (duplicateRuneComplexes.length > 0) {
      errors.push(`Duplicate rune complex ids: ${duplicateRuneComplexes.join(', ')}`);
    }

    const itemIds = new Set(db.items.map((item) => item.id));
    const itemById = new Map(db.items.map((item) => [item.id, item] as const));

    for (const item of db.items) {
      // Skip null or invalid entries
      if (!item || typeof item !== 'object') {
        errors.push(`Item entry is null or invalid`);
        continue;
      }
      if (hasMojibakeQuestionMarks(item.name) || hasMojibakeQuestionMarks(item.subtype) || hasMojibakeQuestionMarks(item.gameplayDescription) || hasMojibakeQuestionMarks(item.loreDescription)) {
        errors.push(`Item '${item.id}' contains suspicious mojibake text ('???').`);
      }
    }

    for (const skill of db.skills) {
      // Skip null or invalid entries
      if (!skill || typeof skill !== 'object') {
        continue;
      }
      for (const validationError of validateSkillDefinition(skill)) {
        errors.push(`Skill '${skill.id}': ${validationError}`);
      }
    }

    for (const merchant of db.merchants) {
      // Skip null or invalid entries
      if (!merchant || typeof merchant !== 'object') {
        errors.push(`Merchant entry is null or invalid`);
        continue;
      }
      if (hasMojibakeQuestionMarks(merchant.name) || hasMojibakeQuestionMarks(merchant.city) || hasMojibakeQuestionMarks(merchant.location) || hasMojibakeQuestionMarks(merchant.description)) {
        errors.push(`Merchant '${merchant.id}' contains suspicious mojibake text ('???').`);
      }

      for (const entry of merchant.items) {
        if (!itemIds.has(entry.itemId)) {
          errors.push(`Merchant '${merchant.id}' references missing item '${entry.itemId}'.`);
        }
      }
    }

    const itemSetIds = new Set((db.itemSets ?? []).map((s) => (s && typeof s === 'object' ? String(s.id ?? '').trim() : '')).filter(Boolean));

    for (const set of db.itemSets ?? []) {
      // Skip null or invalid entries
      if (!set || typeof set !== 'object') {
        errors.push(`Item set entry is null or invalid`);
        continue;
      }
      const pieceIds = Array.isArray(set.pieceItemIds) ? set.pieceItemIds : [];

      for (const bonus of Array.isArray(set.bonuses) ? set.bonuses : []) {
        const requiredPieces = (bonus as { requiredPieces?: number }).requiredPieces ?? pieceIds.length;
        if (!Number.isFinite(requiredPieces) || requiredPieces <= 0) {
          errors.push(`Item set '${set.id}' has bonus with invalid requiredPieces: must be > 0.`);
          continue;
        }

        if (requiredPieces > pieceIds.length) {
          warnings.add(
            `Item set '${set.id}' has bonus requiredPieces (${requiredPieces}) greater than pieceItemIds length (${pieceIds.length}).`,
          );
        }
      }
    }

    for (const warning of collectMissingItemSetReferenceWarnings(db)) {
      warnings.add(warning);
    }

    for (const recipe of db.craftingRecipes ?? []) {
      if (!recipe || typeof recipe !== 'object') {
        errors.push(`Crafting recipe entry is null or invalid`);
        continue;
      }

      const totalInputs = (recipe.inputMaterials?.length ?? 0) + (recipe.inputItems?.length ?? 0);
      const totalOutputs = (recipe.outputMaterials?.length ?? 0) + (recipe.outputItems?.length ?? 0);
      if (totalInputs <= 0) {
        errors.push(`Crafting recipe '${recipe.id}' must have at least one input.`);
      }
      if ((recipe.resultMode ?? 'fixed') !== 'random_from_pool' && totalOutputs <= 0) {
        warnings.add(`Crafting recipe '${recipe.id}' has no outputs in fixed mode.`);
      }
      if ((recipe.resultMode ?? 'fixed') === 'random_from_pool' && !String(recipe.resultPoolId ?? '').trim()) {
        errors.push(`Crafting recipe '${recipe.id}' uses random_from_pool without resultPoolId.`);
      }
    }

    for (const warning of collectMissingCraftingRecipeReferenceWarnings(db)) {
      warnings.add(warning);
    }

    for (const complex of db.runeComplexes ?? []) {
      // Skip null or invalid entries
      if (!complex || typeof complex !== 'object') {
        errors.push(`Rune complex entry is null or invalid`);
        continue;
      }
      const runeItemIds = Array.isArray(complex.runeItemIds) ? complex.runeItemIds : [];
      for (const runeItemId of runeItemIds) {
        if (!itemIds.has(runeItemId)) {
          errors.push(`Rune complex '${complex.id}' references missing rune item '${runeItemId}'.`);
        }
      }
    }

    for (const item of db.items) {
      if (!item || typeof item !== 'object') {
        errors.push(`items contains invalid entry`);
        continue;
      }
      const setRef = typeof item.setId === 'string' ? item.setId.trim() : '';
      if (setRef && !itemSetIds.has(setRef)) {
        warnings.add(`Item '${item.id}' references missing item set '${setRef}'.`);
      }
      for (const socket of item.augmentSlots ?? []) {
        const augmentItemId = String(socket.socketedAugmentItemId ?? '').trim();
        if (!augmentItemId) {
          continue;
        }
        const augmentItem = itemById.get(augmentItemId);
        if (!augmentItem) {
          errors.push(`Item '${item.id}' socket '${socket.id}' references missing augment item '${augmentItemId}'.`);
          continue;
        }
        if (!augmentItem.augment) {
          errors.push(`Item '${item.id}' socket '${socket.id}' references item '${augmentItemId}' without augment block.`);
        }
      }
    }

    for (const zone of db.worldMap.zones ?? []) {
      // Skip null or invalid entries
      if (!zone || typeof zone !== 'object') {
        errors.push(`World zone entry is null or invalid`);
        continue;
      }
      if (hasMojibakeQuestionMarks(zone.name) || hasMojibakeQuestionMarks(zone.description)) {
        errors.push(`World zone '${zone.id}' contains suspicious mojibake text ('???').`);
      }
    }

    for (const region of db.worldMap.regions ?? []) {
      // Skip null or invalid entries
      if (!region || typeof region !== 'object') {
        errors.push(`World region entry is null or invalid`);
        continue;
      }
      if (hasMojibakeQuestionMarks(region.name) || hasMojibakeQuestionMarks(region.description)) {
        errors.push(`World region '${region.id}' contains suspicious mojibake text ('???').`);
      }
    }

    for (const dialogue of db.dialogues ?? []) {
      // Skip null or invalid entries
      if (!dialogue || typeof dialogue !== 'object') {
        errors.push(`Dialogue entry is null or invalid`);
        continue;
      }
      if (hasMojibakeQuestionMarks(dialogue.title) || hasMojibakeQuestionMarks(dialogue.description)) {
        errors.push(`Dialogue '${dialogue.id}' contains suspicious mojibake text ('???').`);
      }
    }

    for (const npc of db.npcs ?? []) {
      // Skip null or invalid entries
      if (!npc || typeof npc !== 'object') {
        errors.push(`NPC entry is null or invalid`);
        continue;
      }
      if (hasMojibakeQuestionMarks(npc.name) || hasMojibakeQuestionMarks(npc.title) || hasMojibakeQuestionMarks(npc.description)) {
        errors.push(`NPC '${npc.id}' contains suspicious mojibake text ('???').`);
      }
    }

    for (const quest of db.quests ?? []) {
      // Skip null or invalid entries
      if (!quest || typeof quest !== 'object') {
        errors.push(`Quest entry is null or invalid`);
        continue;
      }
      if (hasMojibakeQuestionMarks(quest.title) || hasMojibakeQuestionMarks(quest.adminDescription) || hasMojibakeQuestionMarks(quest.playerDescription)) {
        errors.push(`Quest '${quest.id}' contains suspicious mojibake text ('???').`);
      }
    }

    for (const warning of warnings) {
      this.logger.warn(warning);
    }

    return errors;
  }

  private createBackupSnapshot(): void {
    if (!existsSync(this.runtimeFile)) {
      return;
    }

    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }

    this.backupSlot = (this.backupSlot % CONTENT_DB_BACKUP_SLOTS) + 1;
    const backupFile = join(this.backupDir, `theend_content_backup_${this.backupSlot}.json`);
    copyFileSync(this.runtimeFile, backupFile);
  }

  private startAutosaveLoop(): void {
    if (this.storageMode !== 'file') {
      return;
    }

    this.scheduleNextAutosave();
    this.createAutosaveSnapshot();

    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
    }
    this.autosaveTimer = setInterval(() => {
      this.createAutosaveSnapshot();
    }, CONTENT_AUTOSAVE_INTERVAL_MS);
  }

  private createAutosaveSnapshot(): void {
    try {
      if (!existsSync(this.autosaveDir)) {
        mkdirSync(this.autosaveDir, { recursive: true });
      }

      const legacyFiles = [
        'content-db.json',
        'theend_content.local.json',
        'theend_runtime.local.json',
      ];
      for (const legacyFile of legacyFiles) {
        const legacyPath = join(this.autosaveDir, legacyFile);
        if (existsSync(legacyPath)) {
          unlinkSync(legacyPath);
        }
      }

      const slot = (this.autosaveSlot % CONTENT_AUTOSAVE_SLOTS) + 1;
      const targetPath = join(this.autosaveDir, `${CONTENT_AUTOSAVE_FILE_PREFIX}${slot}.json`);
      const payload = this.createBackupEnvelope(this.ensureLoaded());
      writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');

      const savedAt = nowIso();
      this.autosaveSlot = slot % CONTENT_AUTOSAVE_SLOTS;
      this.autosaveStatus = {
        ...this.autosaveStatus,
        currentSlot: slot,
        lastSavedAt: savedAt,
        lastError: undefined,
        files: this.collectAutosaveFiles(),
      };
      this.scheduleNextAutosave();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown autosave error';
      this.autosaveStatus = {
        ...this.autosaveStatus,
        lastError: message,
        files: this.collectAutosaveFiles(),
      };
      this.scheduleNextAutosave();
      this.logger.warn(`Autosave snapshot failed: ${message}`);
    }
  }

  private scheduleNextAutosave(): void {
    this.autosaveStatus = {
      ...this.autosaveStatus,
      nextScheduledAt: new Date(Date.now() + CONTENT_AUTOSAVE_INTERVAL_MS).toISOString(),
    };
  }

  private collectAutosaveFiles(): ContentAutosaveStatus['files'] {
    const files: ContentAutosaveStatus['files'] = [];
    for (let slot = 1; slot <= CONTENT_AUTOSAVE_SLOTS; slot += 1) {
      const fileName = `${CONTENT_AUTOSAVE_FILE_PREFIX}${slot}.json`;
      const filePath = join(this.autosaveDir, fileName);
      const updatedAt = existsSync(filePath) ? statSync(filePath).mtime.toISOString() : undefined;
      files.push({ slot, fileName, updatedAt });
    }
    return files;
  }

  private materializeStoredImageAsset(image: StoredImage): StoredImage {
    const next = clone(image);
    if (!isEmbeddedDataUrl(next.dataUrl)) {
      return next;
    }

    try {
      const asset = writeStoredImageAsset({
        id: next.id,
        name: next.name,
        mimeType: next.mimeType,
        dataUrl: next.dataUrl,
      });
      this.imageAssetsMaterialized += 1;
      return {
        ...next,
        mimeType: asset.mimeType || next.mimeType,
        dataUrl: asset.publicUrl,
        updatedAt: nowIso(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown image asset error';
      this.logger.warn(`Failed to store image asset '${next.id}', keeping embedded image data: ${message}`);
      return next;
    }
  }

  private normalizeStoredImageInput(input: StoredImage): StoredImage {
    const timestamp = nowIso();
    const image: StoredImage = {
      id: String(input.id ?? '').trim(),
      name: String(input.name ?? 'image').trim() || 'image',
      mimeType: String(input.mimeType ?? 'image/png').trim() || 'image/png',
      width: Number.isFinite(Number(input.width)) ? Number(input.width) : 0,
      height: Number.isFinite(Number(input.height)) ? Number(input.height) : 0,
      dataUrl: String(input.dataUrl ?? '').trim(),
      createdAt: String(input.createdAt ?? '').trim() || timestamp,
      updatedAt: String(input.updatedAt ?? '').trim() || timestamp,
    };
    return this.materializeStoredImageAsset(image);
  }

  private normalizeDatabase(raw: Partial<ContentDatabase>): ContentDatabase {
    return {
      version: CONTENT_DB_VERSION,
      items: sanitizeIdObjectArray<AdminItem>(raw.items).map((item) => normalizeItemInput(item)),
      skills: sanitizeIdObjectArray<AdminSkillDefinition>(raw.skills).map((skill) => normalizeSkillInput(skill)),
      visualFx: sanitizeIdObjectArray<VisualFxDefinition>(raw.visualFx).map((entry) => normalizeVisualFxInput(entry)).filter((entry) => Boolean(entry.id)),
      merchants: sanitizeIdObjectArray<AdminMerchant>(raw.merchants).map((merchant) => normalizeMerchantInput(merchant)),
      cities: sanitizeIdObjectArray<City>(raw.cities).map((city) => normalizeCityInput(city)).filter((city) => Boolean(city.id)),
      locations: sanitizeIdObjectArray<WorldLocation>(raw.locations).map((location) => normalizeLocationInput(location)).filter((location) => Boolean(location.id)),
      materials: clone(sanitizeIdObjectArray<Material>(raw.materials)),
      lootTables: clone(sanitizeIdObjectArray<LootTable>(raw.lootTables)),
      images: sanitizeIdObjectArray<StoredImage>(raw.images).map((image) => this.normalizeStoredImageInput(image)),
      dialogues: sanitizeIdObjectArray<DialogueDefinition>(raw.dialogues).map((entry) => normalizeDialogueInput(entry)).filter((d) => Boolean(d.id)),
      npcs: sanitizeIdObjectArray<NpcDefinition>(raw.npcs).map((entry) => normalizeNpcInput(entry)).filter((n) => Boolean(n.id)),
      quests: sanitizeIdObjectArray<QuestDefinition>(raw.quests).map((entry) => normalizeQuestInput(entry)).filter((q) => Boolean(q.id)),
      questInteractions: sanitizeIdObjectArray<QuestInteractionDefinition>(raw.questInteractions)
        .map((entry) => normalizeQuestInteractionInput(entry))
        .filter((q) => Boolean(q.id)),
      questItems: sanitizeIdObjectArray<QuestItemDefinition>(raw.questItems).map((entry) => normalizeQuestItemInput(entry)).filter((q) => Boolean(q.id)),
      questMarkers: sanitizeIdObjectArray<QuestMarkerDefinition>(raw.questMarkers).map((entry) => normalizeQuestMarkerInput(entry)).filter((m) => Boolean(m.id)),
      battleMaps: clone(sanitizeIdObjectArray<BattleMapDefinition>(raw.battleMaps)).filter((map) => Boolean(map.id)),
      craftingRecipes: sanitizeIdObjectArray<CraftingRecipe>(raw.craftingRecipes).map((entry) => normalizeCraftingRecipeInput(entry)).filter((entry) => Boolean(entry.id)),
      recipeVisualProfiles: sanitizeIdObjectArray<RecipeVisualProfile>(raw.recipeVisualProfiles)
        .map((entry) => normalizeRecipeVisualProfileInput(entry))
        .filter((entry) => Boolean(entry.id)),
      itemSets: sanitizeIdObjectArray<ItemSet>(raw.itemSets).map((entry) => normalizeItemSetInput(entry)).filter((set) => Boolean(set.id)),
      runeComplexes: sanitizeIdObjectArray<RuneComplex>(raw.runeComplexes).map((entry) => normalizeRuneComplexInput(entry)).filter((entry) => Boolean(entry.id)),
      blacksmithForgeTiers: sanitizeIdObjectArray<BlacksmithForgeTier>(raw.blacksmithForgeTiers)
        .map((entry) => normalizeBlacksmithForgeTierInput(entry))
        .filter((entry) => Boolean(entry.id)),
      blacksmithModules: sanitizeIdObjectArray<BlacksmithModule>(raw.blacksmithModules)
        .map((entry) => normalizeBlacksmithModuleInput(entry))
        .filter((entry) => Boolean(entry.id)),
      blacksmithTools: sanitizeIdObjectArray<BlacksmithTool>(raw.blacksmithTools)
        .map((entry) => normalizeBlacksmithToolInput(entry))
        .filter((entry) => Boolean(entry.id)),
      blacksmithQualityTiers: sanitizeIdObjectArray<BlacksmithQualityTier>(raw.blacksmithQualityTiers)
        .map((entry) => normalizeBlacksmithQualityTierInput(entry))
        .filter((entry) => Boolean(entry.id)),
      blacksmithVisualPresets: sanitizeIdObjectArray<BlacksmithVisualPreset>(raw.blacksmithVisualPresets)
        .map((entry) => normalizeBlacksmithVisualPresetInput(entry))
        .filter((entry) => Boolean(entry.id)),
      blacksmithBalance: sanitizeIdObjectArray<BlacksmithBalance>(raw.blacksmithBalance)
        .map((entry) => normalizeBlacksmithBalanceInput(entry))
        .filter((entry) => Boolean(entry.id)),
      blacksmithItemTemplates: sanitizeIdObjectArray<BlacksmithItemTemplate>(raw.blacksmithItemTemplates)
        .map((entry) => normalizeBlacksmithItemTemplateInput(entry))
        .filter((entry) => Boolean(entry.id)),
      blacksmithItemWorkActions: sanitizeIdObjectArray<BlacksmithItemWorkAction>(raw.blacksmithItemWorkActions)
        .map((entry) => normalizeBlacksmithItemWorkActionInput(entry))
        .filter((entry) => Boolean(entry.id)),
      sounds: sanitizeIdObjectArray<SoundDefinition>(raw.sounds).filter((entry) => Boolean(entry.id)),
      worldMap: raw.worldMap && typeof raw.worldMap === 'object'
        ? {
            zones: clone(sanitizeIdObjectArray<WorldMapZone>(raw.worldMap.zones)),
            regions: clone(sanitizeIdObjectArray<PaintedRegion>(raw.worldMap.regions)),
            questMarkers: sanitizeIdObjectArray<QuestMarkerDefinition>(raw.worldMap.questMarkers)
              .map((entry) => normalizeQuestMarkerInput(entry))
              .filter((m) => Boolean(m.id)),
            updatedAt: raw.worldMap.updatedAt || nowIso(),
          }
        : {
            zones: [],
            regions: [],
            questMarkers: [],
            updatedAt: nowIso(),
          },
      // Preserve worldSim config if present
      worldSim: raw.worldSim != null ? normalizeWorldSimConfig(raw.worldSim) : undefined,
    };
  }

  private loadTemplateDatabase(): ContentDatabase | null {
    for (const filePath of [this.templateFile, this.legacyTemplateFile, join(this.dataDir, 'content-template.json')]) {
      if (!existsSync(filePath)) {
        continue;
      }

      try {
        const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
        this.extraContent = extractExtraContent(raw);
        return this.normalizeDatabase(contentFromMaybeEnvelope(raw));
      } catch {
        continue;
      }
    }

    return null;
  }

  private ensureLoaded(): ContentDatabase {
    if (this.storageMode === 'file') {
      const currentMtimeMs = getFileMtimeMs(this.runtimeFile);
      if (!this.dbCache || (currentMtimeMs > 0 && currentMtimeMs !== this.fileCacheMtimeMs)) {
        this.dbCache = this.loadFromFileStorage();
      }
    }

    return this.ensureCache();
  }

  private createBackupEnvelope(db: ContentDatabase): ContentBackupEnvelope {
    const exportedAt = nowIso();
    return {
      schemaVersion: CONTENT_BACKUP_SCHEMA_VERSION,
      game: 'TheEnd',
      exportedAt,
      exportedBy: 'admin',
      appEnv: process.env.NODE_ENV || process.env.APP_ENV || undefined,
      gitCommit: resolveGitCommit(),
      contentCounts: countContent(db),
      content: clone({ ...this.extraContent, ...db }) as ContentDatabase,
    };
  }

  private unwrapImportPayload(payload: unknown): Partial<ContentDatabase> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Import payload must be a JSON object.');
    }

    const maybeEnvelope = payload as { content?: unknown; backup?: unknown };
    const rawContent = maybeEnvelope.backup && typeof maybeEnvelope.backup === 'object'
      ? (maybeEnvelope.backup as { content?: unknown }).content ?? maybeEnvelope.backup
      : maybeEnvelope.content ?? payload;

    if (!rawContent || typeof rawContent !== 'object' || Array.isArray(rawContent)) {
      throw new BadRequestException('Import backup content must be a JSON object.');
    }

    this.extraContent = extractExtraContent(rawContent);
    return rawContent as Partial<ContentDatabase>;
  }

  private mergeDatabasesById(existing: ContentDatabase, incoming: ContentDatabase): ContentDatabase {
    return {
      version: CONTENT_DB_VERSION,
      items: mergeById(existing.items, incoming.items),
      skills: mergeById(existing.skills, incoming.skills),
      visualFx: mergeById(existing.visualFx, incoming.visualFx),
      merchants: mergeById(existing.merchants, incoming.merchants),
      cities: mergeById(existing.cities, incoming.cities),
      locations: mergeById(existing.locations, incoming.locations),
      materials: mergeById(existing.materials, incoming.materials),
      lootTables: mergeById(existing.lootTables, incoming.lootTables),
      images: mergeById(existing.images, incoming.images),
      dialogues: mergeById(existing.dialogues, incoming.dialogues),
      npcs: mergeById(existing.npcs, incoming.npcs),
      quests: mergeById(existing.quests, incoming.quests),
      questInteractions: mergeById(existing.questInteractions, incoming.questInteractions),
      questItems: mergeById(existing.questItems, incoming.questItems),
      questMarkers: mergeById(existing.questMarkers, incoming.questMarkers),
      battleMaps: mergeById(existing.battleMaps, incoming.battleMaps),
      craftingRecipes: mergeById(existing.craftingRecipes ?? [], incoming.craftingRecipes ?? []),
      recipeVisualProfiles: mergeById(existing.recipeVisualProfiles ?? [], incoming.recipeVisualProfiles ?? []),
      itemSets: mergeById(existing.itemSets ?? [], incoming.itemSets ?? []),
      runeComplexes: mergeById(existing.runeComplexes ?? [], incoming.runeComplexes ?? []),
      blacksmithForgeTiers: mergeById(existing.blacksmithForgeTiers ?? [], incoming.blacksmithForgeTiers ?? []),
      blacksmithModules: mergeById(existing.blacksmithModules ?? [], incoming.blacksmithModules ?? []),
      blacksmithTools: mergeById(existing.blacksmithTools ?? [], incoming.blacksmithTools ?? []),
      blacksmithQualityTiers: mergeById(existing.blacksmithQualityTiers ?? [], incoming.blacksmithQualityTiers ?? []),
      blacksmithVisualPresets: mergeById(existing.blacksmithVisualPresets ?? [], incoming.blacksmithVisualPresets ?? []),
      blacksmithBalance: mergeById(existing.blacksmithBalance ?? [], incoming.blacksmithBalance ?? []),
      blacksmithItemTemplates: mergeById(existing.blacksmithItemTemplates ?? [], incoming.blacksmithItemTemplates ?? []),
      blacksmithItemWorkActions: mergeById(existing.blacksmithItemWorkActions ?? [], incoming.blacksmithItemWorkActions ?? []),
      sounds: mergeById(existing.sounds ?? [], incoming.sounds ?? []),
      worldMap: {
        zones: mergeById(existing.worldMap.zones, incoming.worldMap.zones),
        regions: mergeById(existing.worldMap.regions, incoming.worldMap.regions),
        questMarkers: mergeById(existing.worldMap.questMarkers ?? [], incoming.worldMap.questMarkers ?? []),
        updatedAt: nowIso(),
      },
    };
  }

  private addMissingDatabasesById(existing: ContentDatabase, incoming: ContentDatabase): ContentDatabase {
    const hasWorldMapChanges = incoming.worldMap.zones.length > 0
      || incoming.worldMap.regions.length > 0
      || (incoming.worldMap.questMarkers ?? []).length > 0;

    return {
      version: CONTENT_DB_VERSION,
      items: addMissingById(existing.items, incoming.items),
      skills: addMissingById(existing.skills, incoming.skills),
      visualFx: addMissingById(existing.visualFx, incoming.visualFx),
      merchants: addMissingById(existing.merchants, incoming.merchants),
      cities: addMissingById(existing.cities, incoming.cities),
      locations: addMissingById(existing.locations, incoming.locations),
      materials: addMissingById(existing.materials, incoming.materials),
      lootTables: addMissingById(existing.lootTables, incoming.lootTables),
      images: addMissingById(existing.images, incoming.images),
      dialogues: addMissingById(existing.dialogues, incoming.dialogues),
      npcs: addMissingById(existing.npcs, incoming.npcs),
      quests: addMissingById(existing.quests, incoming.quests),
      questInteractions: addMissingById(existing.questInteractions, incoming.questInteractions),
      questItems: addMissingById(existing.questItems, incoming.questItems),
      questMarkers: addMissingById(existing.questMarkers, incoming.questMarkers),
      battleMaps: addMissingById(existing.battleMaps, incoming.battleMaps),
      craftingRecipes: addMissingById(existing.craftingRecipes ?? [], incoming.craftingRecipes ?? []),
      recipeVisualProfiles: addMissingById(existing.recipeVisualProfiles ?? [], incoming.recipeVisualProfiles ?? []),
      itemSets: addMissingById(existing.itemSets ?? [], incoming.itemSets ?? []),
      runeComplexes: addMissingById(existing.runeComplexes ?? [], incoming.runeComplexes ?? []),
      blacksmithForgeTiers: addMissingById(existing.blacksmithForgeTiers ?? [], incoming.blacksmithForgeTiers ?? []),
      blacksmithModules: addMissingById(existing.blacksmithModules ?? [], incoming.blacksmithModules ?? []),
      blacksmithTools: addMissingById(existing.blacksmithTools ?? [], incoming.blacksmithTools ?? []),
      blacksmithQualityTiers: addMissingById(existing.blacksmithQualityTiers ?? [], incoming.blacksmithQualityTiers ?? []),
      blacksmithVisualPresets: addMissingById(existing.blacksmithVisualPresets ?? [], incoming.blacksmithVisualPresets ?? []),
      blacksmithBalance: addMissingById(existing.blacksmithBalance ?? [], incoming.blacksmithBalance ?? []),
      blacksmithItemTemplates: addMissingById(existing.blacksmithItemTemplates ?? [], incoming.blacksmithItemTemplates ?? []),
      blacksmithItemWorkActions: addMissingById(existing.blacksmithItemWorkActions ?? [], incoming.blacksmithItemWorkActions ?? []),
      sounds: addMissingById(existing.sounds ?? [], incoming.sounds ?? []),
      worldMap: {
        zones: addMissingById(existing.worldMap.zones, incoming.worldMap.zones),
        regions: addMissingById(existing.worldMap.regions, incoming.worldMap.regions),
        questMarkers: addMissingById(existing.worldMap.questMarkers ?? [], incoming.worldMap.questMarkers ?? []),
        updatedAt: hasWorldMapChanges ? nowIso() : existing.worldMap.updatedAt,
      },
    };
  }

  private filterAddMissingOnlyContent(existing: ContentDatabase, incoming: Partial<ContentDatabase>): {
    content: Partial<ContentDatabase>;
    actions: AddMissingImportActionMap;
  } {
    const actions: AddMissingImportActionMap = {};
    const filterCollection = (key: string, entries: unknown, existingEntries: Array<{ id?: unknown }> | undefined): unknown[] | undefined => {
      if (!Array.isArray(entries)) {
        return undefined;
      }
      const action = emptyAddMissingActions();
      actions[key] = action;
      const existingIds = new Set((existingEntries ?? []).map((entry) => String(entry?.id ?? '').trim()).filter(Boolean));
      const acceptedIds = new Set<string>();
      const missingEntries: unknown[] = [];

      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') {
          missingEntries.push(entry);
          continue;
        }
        const id = String((entry as { id?: unknown }).id ?? '').trim();
        if (!id) {
          missingEntries.push(entry);
          continue;
        }
        if (existingIds.has(id)) {
          action.skippedExisting.push(id);
          continue;
        }
        if (!acceptedIds.has(id)) {
          action.createMissing.push(id);
          acceptedIds.add(id);
        }
        missingEntries.push(entry);
      }

      return missingEntries;
    };

    const worldMap = incoming.worldMap && typeof incoming.worldMap === 'object'
      ? {
          zones: (filterCollection('worldMap.zones', incoming.worldMap.zones, existing.worldMap.zones) ?? []) as WorldMapZone[],
          regions: (filterCollection('worldMap.regions', incoming.worldMap.regions, existing.worldMap.regions) ?? []) as PaintedRegion[],
          questMarkers: (filterCollection('worldMap.questMarkers', incoming.worldMap.questMarkers, existing.worldMap.questMarkers ?? []) ?? []) as QuestMarkerDefinition[],
          updatedAt: incoming.worldMap.updatedAt,
        }
      : undefined;

    return {
      content: {
        version: CONTENT_DB_VERSION,
        items: filterCollection('items', incoming.items, existing.items) as AdminItem[] | undefined,
        skills: filterCollection('skills', incoming.skills, existing.skills) as AdminSkillDefinition[] | undefined,
        visualFx: filterCollection('visualFx', incoming.visualFx, existing.visualFx) as VisualFxDefinition[] | undefined,
        merchants: filterCollection('merchants', incoming.merchants, existing.merchants) as AdminMerchant[] | undefined,
        cities: filterCollection('cities', incoming.cities, existing.cities) as City[] | undefined,
        materials: filterCollection('materials', incoming.materials, existing.materials) as Material[] | undefined,
        lootTables: filterCollection('lootTables', incoming.lootTables, existing.lootTables) as LootTable[] | undefined,
        images: filterCollection('images', incoming.images, existing.images) as StoredImage[] | undefined,
        dialogues: filterCollection('dialogues', incoming.dialogues, existing.dialogues) as DialogueDefinition[] | undefined,
        npcs: filterCollection('npcs', incoming.npcs, existing.npcs) as NpcDefinition[] | undefined,
        quests: filterCollection('quests', incoming.quests, existing.quests) as QuestDefinition[] | undefined,
        questInteractions: filterCollection('questInteractions', incoming.questInteractions, existing.questInteractions) as QuestInteractionDefinition[] | undefined,
        questItems: filterCollection('questItems', incoming.questItems, existing.questItems) as QuestItemDefinition[] | undefined,
        questMarkers: filterCollection('questMarkers', incoming.questMarkers, existing.questMarkers) as QuestMarkerDefinition[] | undefined,
        battleMaps: filterCollection('battleMaps', incoming.battleMaps, existing.battleMaps) as BattleMapDefinition[] | undefined,
        craftingRecipes: filterCollection('craftingRecipes', incoming.craftingRecipes, existing.craftingRecipes ?? []) as CraftingRecipe[] | undefined,
        recipeVisualProfiles: filterCollection('recipeVisualProfiles', incoming.recipeVisualProfiles, existing.recipeVisualProfiles ?? []) as RecipeVisualProfile[] | undefined,
        itemSets: filterCollection('itemSets', incoming.itemSets, existing.itemSets ?? []) as ItemSet[] | undefined,
        runeComplexes: filterCollection('runeComplexes', incoming.runeComplexes, existing.runeComplexes ?? []) as RuneComplex[] | undefined,
        blacksmithForgeTiers: filterCollection('blacksmithForgeTiers', incoming.blacksmithForgeTiers, existing.blacksmithForgeTiers ?? []) as BlacksmithForgeTier[] | undefined,
        blacksmithModules: filterCollection('blacksmithModules', incoming.blacksmithModules, existing.blacksmithModules ?? []) as BlacksmithModule[] | undefined,
        blacksmithTools: filterCollection('blacksmithTools', incoming.blacksmithTools, existing.blacksmithTools ?? []) as BlacksmithTool[] | undefined,
        blacksmithQualityTiers: filterCollection('blacksmithQualityTiers', incoming.blacksmithQualityTiers, existing.blacksmithQualityTiers ?? []) as BlacksmithQualityTier[] | undefined,
        blacksmithVisualPresets: filterCollection('blacksmithVisualPresets', incoming.blacksmithVisualPresets, existing.blacksmithVisualPresets ?? []) as BlacksmithVisualPreset[] | undefined,
        blacksmithBalance: filterCollection('blacksmithBalance', incoming.blacksmithBalance, existing.blacksmithBalance ?? []) as BlacksmithBalance[] | undefined,
        blacksmithItemTemplates: filterCollection('blacksmithItemTemplates', incoming.blacksmithItemTemplates, existing.blacksmithItemTemplates ?? []) as BlacksmithItemTemplate[] | undefined,
        blacksmithItemWorkActions: filterCollection('blacksmithItemWorkActions', incoming.blacksmithItemWorkActions, existing.blacksmithItemWorkActions ?? []) as BlacksmithItemWorkAction[] | undefined,
        sounds: filterCollection('sounds', incoming.sounds, existing.sounds ?? []) as SoundDefinition[] | undefined,
        worldMap,
      },
      actions,
    };
  }

  private collectImportWarnings(db: ContentDatabase): string[] {
    const warnings: string[] = [];
    const imageIds = new Set(db.images.map((image) => String(image.id ?? '').trim()).filter(Boolean));
    const pushMissingImage = (label: string, imageId: string | undefined) => {
      if (!imageId || imageId.startsWith('/') || imageId.startsWith('http') || imageIds.has(imageId) || BUILTIN_PLACEHOLDER_IMAGE_IDS.has(imageId)) {
        return;
      }
      warnings.push(`${label} references missing image '${imageId}'.`);
    };

    for (const item of db.items) {
      pushMissingImage(`Item '${item.id}'`, item.imagePath);
    }
    for (const skill of db.skills) {
      pushMissingImage(`Skill '${skill.id}'`, skill.iconUrl);
    }
    for (const merchant of db.merchants) {
      pushMissingImage(`Merchant '${merchant.id}'`, merchant.portraitPath);
    }
    for (const city of db.cities) {
      pushMissingImage(`City '${city.id}' background`, city.backgroundImageId);
      pushMissingImage(`City '${city.id}' thumbnail`, city.thumbnailImageId);
      for (const location of city.locations) {
        pushMissingImage(`City location '${city.id}/${location.id}'`, location.imageId);
      }
    }
    for (const interaction of db.questInteractions) {
      pushMissingImage(`Quest interaction '${interaction.id}'`, interaction.imageId);
      for (const choice of interaction.choices ?? []) {
        pushMissingImage(`Quest interaction choice '${interaction.id}/${choice.id}'`, choice.imageId);
      }
    }

    const itemIds = new Set(db.items.map((item) => item.id));
    const itemById = new Map(db.items.map((item) => [item.id, item] as const));

    for (const set of db.itemSets ?? []) {
      for (const pieceItemId of set.pieceItemIds ?? []) {
        if (!itemIds.has(pieceItemId)) {
          warnings.push(`Item set '${set.id}' references missing item '${pieceItemId}'.`);
        }
      }
    }

    for (const complex of db.runeComplexes ?? []) {
      for (const runeItemId of complex.runeItemIds ?? []) {
        if (!itemIds.has(runeItemId)) {
          warnings.push(`Rune complex '${complex.id}' references missing rune item '${runeItemId}'.`);
        }
      }
    }

    for (const module of db.blacksmithModules ?? []) {
      pushMissingImage(`Blacksmith module '${module.id}'`, module.imageRef);
    }
    for (const tool of db.blacksmithTools ?? []) {
      pushMissingImage(`Blacksmith tool '${tool.id}'`, tool.imageRef);
    }
    for (const qualityTier of db.blacksmithQualityTiers ?? []) {
      pushMissingImage(`Blacksmith quality '${qualityTier.id}' frame`, qualityTier.frameImageRef);
    }
    for (const preset of db.blacksmithVisualPresets ?? []) {
      pushMissingImage(`Blacksmith visual preset '${preset.id}' background`, preset.backgroundImageRef);
      pushMissingImage(`Blacksmith visual preset '${preset.id}' anvil`, preset.anvilImageRef);
      pushMissingImage(`Blacksmith visual preset '${preset.id}' furnace`, preset.furnaceImageRef);
      for (const imageId of preset.hammerImageRefs ?? []) {
        pushMissingImage(`Blacksmith visual preset '${preset.id}' hammer`, imageId);
      }
      for (const imageId of preset.defectOverlayRefs ?? []) {
        pushMissingImage(`Blacksmith visual preset '${preset.id}' defect overlay`, imageId);
      }
      for (const imageId of preset.blankImageRefs ?? []) {
        pushMissingImage(`Blacksmith visual preset '${preset.id}' blank`, imageId);
      }
      for (const imageId of preset.qualityFrameRefs ?? []) {
        pushMissingImage(`Blacksmith visual preset '${preset.id}' quality frame`, imageId);
      }
    }

    warnings.push(...collectMissingCraftingRecipeReferenceWarnings(db));

    for (const item of db.items) {
      for (const socket of item.augmentSlots ?? []) {
        const augmentItemId = String(socket.socketedAugmentItemId ?? '').trim();
        if (!augmentItemId) {
          continue;
        }
        const augmentItem = itemById.get(augmentItemId);
        if (!augmentItem) {
          warnings.push(`Item '${item.id}' socket '${socket.id}' references missing augment item '${augmentItemId}'.`);
        } else if (!augmentItem.augment) {
          warnings.push(`Item '${item.id}' socket '${socket.id}' references '${augmentItemId}' without augment block.`);
        }
      }
    }

    const embeddedImageCount = db.images.filter((image) => isEmbeddedDataUrl(image.dataUrl)).length;
    if (embeddedImageCount > 0) {
      warnings.push(`This backup still includes ${embeddedImageCount} embedded image record(s). They will be moved to Resurse/assets/upload on the next load/import.`);
    } else if (db.images.length > 0) {
      warnings.push(`This backup contains ${db.images.length} image reference(s). Copy Resurse/assets/upload together with the JSON when moving PCs.`);
    } else {
      warnings.push('This backup contains image references only. Make sure the assets folder/zip is also copied.');
    }

    return warnings;
  }

  private persistToFile(db: ContentDatabase): ContentDatabase {
    const next = clone(db);
    const integrityErrors = this.validateDatabaseIntegrity(next);
    if (integrityErrors.length > 0) {
      throw new BadRequestException(`Content integrity check failed:\n- ${integrityErrors.join('\n- ')}`);
    }

    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    this.createBackupSnapshot();
    this.dbCache = next;
    const tmpFile = `${this.runtimeFile}.tmp`;
    writeFileSync(tmpFile, JSON.stringify(this.createBackupEnvelope(this.dbCache), null, 2), 'utf8');
    renameSync(tmpFile, this.runtimeFile);
    this.fileCacheMtimeMs = getFileMtimeMs(this.runtimeFile);
    return clone(this.dbCache);
  }

  private async persist(db: ContentDatabase): Promise<ContentDatabase> {
    const next = clone(db);
    const integrityErrors = this.validateDatabaseIntegrity(next);
    if (integrityErrors.length > 0) {
      throw new BadRequestException(`Content integrity check failed:\n- ${integrityErrors.join('\n- ')}`);
    }

    if (this.storageMode === 'file') {
      this.writeQueue = this.writeQueue
        .catch(() => this.ensureLoaded())
        .then(() => this.persistToFile(next));
      return this.writeQueue;
    }

    await this.getContentStoreDelegate().upsert({
      where: { key: CONTENT_STORE_KEY },
      update: { value: next as unknown as any },
      create: {
        key: CONTENT_STORE_KEY,
        value: next as unknown as any,
      },
    });

    this.dbCache = next;
    return clone(this.dbCache);
  }

  private async ensureDatabaseStorageSchema(): Promise<void> {
    if (this.storageMode !== 'postgres') {
      return;
    }

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ContentStore" (
        "key" TEXT NOT NULL PRIMARY KEY,
        "value" JSONB NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  getSnapshot(): ContentDatabase {
    return clone(this.ensureLoaded());
  }

  exportFullContent(): ContentBackupEnvelope {
    return this.createBackupEnvelope(this.ensureLoaded());
  }

  getAutosaveStatus(): ContentAutosaveStatus {
    return {
      ...this.autosaveStatus,
      files: this.collectAutosaveFiles(),
    };
  }

  triggerAutosave(): ContentAutosaveStatus {
    this.createAutosaveSnapshot();
    return this.getAutosaveStatus();
  }

  async importFullContent(payload: unknown, mode: ContentImportMode = 'replace', dryRunOverride?: boolean): Promise<ContentImportResult> {
    const previousExtraContent = this.extraContent;
    const content = this.unwrapImportPayload(payload);
    const existing = this.ensureLoaded();
    const shouldDryRun = dryRunOverride ?? mode === 'dryRun';
    let actions: AddMissingImportActionMap | undefined;
    let summary: { created: number; updated: number; skippedExisting: number } | undefined;
    let next: ContentDatabase;

    if (mode === 'add_missing_only') {
      const filtered = this.filterAddMissingOnlyContent(existing, content);
      actions = filtered.actions;
      summary = countAddMissingActions(actions);
      const normalized = this.normalizeDatabase(filtered.content);
      next = this.addMissingDatabasesById(existing, normalized);
      this.extraContent = previousExtraContent;
    } else {
      const normalized = this.normalizeDatabase(content);
      next = mode === 'merge'
        ? this.mergeDatabasesById(existing, normalized)
        : normalized;
    }

    const errors = this.validateDatabaseIntegrity(next);
    if (errors.length > 0) {
      this.extraContent = previousExtraContent;
      throw new BadRequestException(`Content import validation failed:\n- ${errors.join('\n- ')}`);
    }

    if (shouldDryRun) {
      this.extraContent = previousExtraContent;
      return {
        mode,
        dryRun: true,
        snapshot: clone(next),
        warnings: this.collectImportWarnings(next),
        errors: [],
        summary,
        actions,
      };
    }

    const saved = await this.persist(next);
    return {
      mode,
      dryRun: false,
      snapshot: saved,
      warnings: this.collectImportWarnings(saved),
      errors: [],
      summary,
      actions,
    };
  }

  async reloadFromDisk(): Promise<ContentDatabase> {
    await this.ensureInitialized();
    const template = this.loadTemplateDatabase() ?? createEmptyDatabase();
    return this.persist(template);
  }

  validateIntegrity(): { ok: boolean; errors: string[] } {
    const db = this.ensureLoaded();
    const errors = this.validateDatabaseIntegrity(db);
    return {
      ok: errors.length === 0,
      errors,
    };
  }

  getStorageHealth(): { ok: true; contentStorage: 'readable-writable' } | { ok: false; error: string } {
    if (this.storageMode !== 'file') {
      return { ok: true, contentStorage: 'readable-writable' };
    }

    try {
      if (!existsSync(this.dataDir)) {
        mkdirSync(this.dataDir, { recursive: true });
      }
      if (existsSync(this.runtimeFile)) {
        JSON.parse(readFileSync(this.runtimeFile, 'utf8')) as unknown;
      }
      const probe = `${this.runtimeFile}.healthcheck.tmp`;
      writeFileSync(probe, JSON.stringify({ ok: true, checkedAt: nowIso() }), 'utf8');
      unlinkSync(probe);
      return { ok: true, contentStorage: 'readable-writable' };
    } catch {
      return { ok: false, error: 'Content file storage unavailable' };
    }
  }

  listCollection<K extends ContentCollectionName>(name: K | string): ContentCollectionMap[K][] {
    const db = this.ensureLoaded();
    const collectionName = ensureCollectionName(name);
    return clone(db[collectionName]) as ContentCollectionMap[K][];
  }

  getCollectionEntry<K extends ContentCollectionName>(name: K | string, id: string): ContentCollectionMap[K] | null {
    const collection = this.listCollection(name);
    return collection.find((entry) => entry.id === id) ?? null;
  }

  private writeUploadedStoredImageAsset(id: string, payload: StoredImageAssetPayload, existing?: StoredImage): StoredImage {
    const dataUrl = String(payload.dataUrl ?? '').trim();
    if (!isEmbeddedDataUrl(dataUrl)) {
      throw new BadRequestException('Image upload payload must include an image dataUrl.');
    }

    try {
      const timestamp = nowIso();
      const asset = writeStoredImageAsset({
        id,
        name: payload.name ?? existing?.name ?? 'image',
        mimeType: payload.mimeType ?? existing?.mimeType ?? 'image/png',
        folder: String(payload.folder ?? '').trim() || extractAssetsUploadFolder(existing?.dataUrl),
        dataUrl,
      });

      return {
        id,
        name: String(payload.name ?? existing?.name ?? 'image').trim() || 'image',
        mimeType: asset.mimeType || String(payload.mimeType ?? existing?.mimeType ?? 'image/png').trim() || 'image/png',
        width: Number.isFinite(Number(payload.width ?? existing?.width)) ? Number(payload.width ?? existing?.width) : 0,
        height: Number.isFinite(Number(payload.height ?? existing?.height)) ? Number(payload.height ?? existing?.height) : 0,
        dataUrl: asset.publicUrl,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown image asset error';
      throw new BadRequestException(`Failed to store uploaded image '${id}': ${message}`);
    }
  }

  async createStoredImageAsset(payload: StoredImageAssetPayload): Promise<StoredImage> {
    const db = this.ensureLoaded();
    const id = String(payload.id ?? `img_${Date.now()}_${randomUUID().slice(0, 8)}`).trim();
    if (!id) {
      throw new BadRequestException('Missing id for image upload.');
    }
    if (db.images.some((image) => image.id === id)) {
      throw new BadRequestException(`Duplicate images id: ${id}`);
    }

    const next = this.writeUploadedStoredImageAsset(id, payload);
    db.images = [...db.images, next];
    await this.persist(db);
    return clone(next);
  }

  async replaceStoredImageAsset(id: string, payload: StoredImageAssetPayload): Promise<StoredImage> {
    const db = this.ensureLoaded();
    const current = db.images.find((image) => image.id === id);
    if (!current) {
      throw new NotFoundException(`images entry not found: ${id}`);
    }

    const next = this.writeUploadedStoredImageAsset(id, payload, current);
    db.images = db.images.map((image) => image.id === id ? next : image);
    await this.persist(db);
    return clone(next);
  }

  async uploadAudioAsset(payload: StoredAudioAssetPayload): Promise<{ assetId: string; publicUrl: string; mimeType: string }> {
    const dataUrl = String(payload.dataUrl ?? '').trim();
    if (!isEmbeddedAudioDataUrl(dataUrl)) {
      throw new BadRequestException('Audio upload payload must include an audio dataUrl.');
    }

    const requestedId = String(payload.id ?? '').trim();
    const assetId = requestedId || `audio_${Date.now()}_${randomUUID().slice(0, 8)}`;

    try {
      const stored = writeStoredAudioAsset({
        id: assetId,
        name: payload.name ?? assetId,
        mimeType: payload.mimeType ?? 'audio/ogg',
        folder: payload.folder,
        dataUrl,
      });

      return {
        assetId,
        publicUrl: stored.publicUrl,
        mimeType: stored.mimeType,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown audio asset error';
      throw new BadRequestException(`Failed to store uploaded audio '${assetId}': ${message}`);
    }
  }

  async writeStaticAudio(payload: { targetPath: string; dataUrl: string; mimeType?: string }): Promise<{ publicUrl: string; mimeType: string }> {
    const dataUrl = String(payload.dataUrl ?? '').trim();
    if (!isEmbeddedAudioDataUrl(dataUrl)) {
      throw new BadRequestException('Audio upload payload must include an audio dataUrl.');
    }
    const targetPath = String(payload.targetPath ?? '').trim();
    if (!targetPath) {
      throw new BadRequestException('targetPath is required.');
    }
    try {
      return writeStaticAudioFile({
        targetRelativePath: targetPath,
        dataUrl,
        mimeType: payload.mimeType,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to write static audio to '${targetPath}': ${message}`);
    }
  }

  async createCollectionEntry<K extends ContentCollectionName>(name: K | string, payload: ContentCollectionMap[K]): Promise<ContentCollectionMap[K]> {
    const db = this.ensureLoaded();
    const collectionName = ensureCollectionName(name);
    const nextId = String(payload.id ?? '').trim();
    if (!nextId) {
      throw new BadRequestException(`Missing id for ${collectionName} entry.`);
    }

    if ((db[collectionName] as Array<{ id: string }>).some((entry) => entry.id === nextId)) {
      throw new BadRequestException(`Duplicate ${collectionName} id: ${nextId}`);
    }

    let nextEntry: ContentCollectionMap[K];
    if (collectionName === 'items') {
      nextEntry = normalizeItemInput(payload as ContentCollectionMap['items']) as ContentCollectionMap[K];
    } else if (collectionName === 'skills') {
      nextEntry = normalizeSkillInput(payload as ContentCollectionMap['skills']) as ContentCollectionMap[K];
    } else if (collectionName === 'visualFx') {
      nextEntry = normalizeVisualFxInput(payload as unknown as VisualFxDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'merchants') {
      nextEntry = normalizeMerchantInput(payload as ContentCollectionMap['merchants']) as ContentCollectionMap[K];
    } else if (collectionName === 'materials') {
      nextEntry = normalizeMaterialInput(payload as ContentCollectionMap['materials']) as ContentCollectionMap[K];
    } else if (collectionName === 'cities') {
      nextEntry = normalizeCityInput(payload as ContentCollectionMap['cities']) as ContentCollectionMap[K];
    } else if (collectionName === 'locations') {
      nextEntry = normalizeLocationInput(payload as ContentCollectionMap['locations']) as ContentCollectionMap[K];
    } else if (collectionName === 'images') {
      nextEntry = this.normalizeStoredImageInput(payload as unknown as StoredImage) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'dialogues') {
      nextEntry = normalizeDialogueInput(payload as unknown as DialogueDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'npcs') {
      nextEntry = normalizeNpcInput(payload as unknown as NpcDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'quests') {
      nextEntry = normalizeQuestInput(payload as unknown as QuestDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'questInteractions') {
      nextEntry = normalizeQuestInteractionInput(payload as unknown as QuestInteractionDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'questItems') {
      nextEntry = normalizeQuestItemInput(payload as unknown as QuestItemDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'questMarkers') {
      nextEntry = normalizeQuestMarkerInput(payload as unknown as QuestMarkerDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'craftingRecipes') {
      nextEntry = normalizeCraftingRecipeInput(payload as unknown as CraftingRecipe) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'recipeVisualProfiles') {
      nextEntry = normalizeRecipeVisualProfileInput(payload as unknown as RecipeVisualProfile) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'itemSets') {
      nextEntry = normalizeItemSetInput(payload as unknown as ItemSet) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'runeComplexes') {
      nextEntry = normalizeRuneComplexInput(payload as unknown as RuneComplex) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithForgeTiers') {
      nextEntry = normalizeBlacksmithForgeTierInput(payload as unknown as BlacksmithForgeTier) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithModules') {
      nextEntry = normalizeBlacksmithModuleInput(payload as unknown as BlacksmithModule) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithTools') {
      nextEntry = normalizeBlacksmithToolInput(payload as unknown as BlacksmithTool) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithQualityTiers') {
      nextEntry = normalizeBlacksmithQualityTierInput(payload as unknown as BlacksmithQualityTier) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithVisualPresets') {
      nextEntry = normalizeBlacksmithVisualPresetInput(payload as unknown as BlacksmithVisualPreset) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithBalance') {
      nextEntry = normalizeBlacksmithBalanceInput(payload as unknown as BlacksmithBalance) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithItemTemplates') {
      nextEntry = normalizeBlacksmithItemTemplateInput(payload as unknown as BlacksmithItemTemplate) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithItemWorkActions') {
      nextEntry = normalizeBlacksmithItemWorkActionInput(payload as unknown as BlacksmithItemWorkAction) as unknown as ContentCollectionMap[K];
    } else {
      nextEntry = clone(payload);
    }

    const collections = db as unknown as Record<ContentCollectionName, unknown[]>;
    collections[collectionName] = [...collections[collectionName], nextEntry as unknown];
    await this.persist(db);
    return clone(nextEntry);
  }

  async updateCollectionEntry<K extends ContentCollectionName>(name: K | string, id: string, patch: Partial<ContentCollectionMap[K]>): Promise<ContentCollectionMap[K]> {
    const db = this.ensureLoaded();
    const collectionName = ensureCollectionName(name);
    const current = (db[collectionName] as Array<{ id: string }>).find((entry) => entry.id === id);
    if (!current) {
      throw new NotFoundException(`${collectionName} entry not found: ${id}`);
    }

    const mergedBase = { ...current, ...clone(patch), id } as ContentCollectionMap[K];
    let merged: ContentCollectionMap[K];
    if (collectionName === 'items') {
      merged = normalizeItemInput(mergedBase as ContentCollectionMap['items']) as ContentCollectionMap[K];
    } else if (collectionName === 'skills') {
      merged = normalizeSkillInput(mergedBase as ContentCollectionMap['skills']) as ContentCollectionMap[K];
    } else if (collectionName === 'visualFx') {
      merged = normalizeVisualFxInput(mergedBase as unknown as VisualFxDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'merchants') {
      merged = normalizeMerchantInput(mergedBase as ContentCollectionMap['merchants']) as ContentCollectionMap[K];
    } else if (collectionName === 'materials') {
      merged = normalizeMaterialInput(mergedBase as ContentCollectionMap['materials']) as ContentCollectionMap[K];
    } else if (collectionName === 'cities') {
      merged = normalizeCityInput(mergedBase as ContentCollectionMap['cities']) as ContentCollectionMap[K];
    } else if (collectionName === 'locations') {
      merged = normalizeLocationInput(mergedBase as ContentCollectionMap['locations']) as ContentCollectionMap[K];
    } else if (collectionName === 'images') {
      merged = this.normalizeStoredImageInput(mergedBase as unknown as StoredImage) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'dialogues') {
      merged = normalizeDialogueInput(mergedBase as unknown as DialogueDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'npcs') {
      merged = normalizeNpcInput(mergedBase as unknown as NpcDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'quests') {
      merged = normalizeQuestInput(mergedBase as unknown as QuestDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'questInteractions') {
      merged = normalizeQuestInteractionInput(mergedBase as unknown as QuestInteractionDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'questItems') {
      merged = normalizeQuestItemInput(mergedBase as unknown as QuestItemDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'questMarkers') {
      merged = normalizeQuestMarkerInput(mergedBase as unknown as QuestMarkerDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'craftingRecipes') {
      merged = normalizeCraftingRecipeInput(mergedBase as unknown as CraftingRecipe) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'recipeVisualProfiles') {
      merged = normalizeRecipeVisualProfileInput(mergedBase as unknown as RecipeVisualProfile) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'itemSets') {
      merged = normalizeItemSetInput(mergedBase as unknown as ItemSet) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'runeComplexes') {
      merged = normalizeRuneComplexInput(mergedBase as unknown as RuneComplex) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithForgeTiers') {
      merged = normalizeBlacksmithForgeTierInput(mergedBase as unknown as BlacksmithForgeTier) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithModules') {
      merged = normalizeBlacksmithModuleInput(mergedBase as unknown as BlacksmithModule) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithTools') {
      merged = normalizeBlacksmithToolInput(mergedBase as unknown as BlacksmithTool) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithQualityTiers') {
      merged = normalizeBlacksmithQualityTierInput(mergedBase as unknown as BlacksmithQualityTier) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithVisualPresets') {
      merged = normalizeBlacksmithVisualPresetInput(mergedBase as unknown as BlacksmithVisualPreset) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithBalance') {
      merged = normalizeBlacksmithBalanceInput(mergedBase as unknown as BlacksmithBalance) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithItemTemplates') {
      merged = normalizeBlacksmithItemTemplateInput(mergedBase as unknown as BlacksmithItemTemplate) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'blacksmithItemWorkActions') {
      merged = normalizeBlacksmithItemWorkActionInput(mergedBase as unknown as BlacksmithItemWorkAction) as unknown as ContentCollectionMap[K];
    } else {
      merged = mergedBase;
    }

    const collections = db as unknown as Record<ContentCollectionName, unknown[]>;
    collections[collectionName] = (collections[collectionName] as Array<{ id: string }>).map((entry) =>
      entry.id === id ? clone(merged) : entry,
    );
    await this.persist(db);
    return clone(merged);
  }

  async deleteCollectionEntry(name: ContentCollectionName | string, id: string): Promise<void> {
    const db = this.ensureLoaded();
    const collectionName = ensureCollectionName(name);
    const collections = db as unknown as Record<ContentCollectionName, unknown[]>;
    collections[collectionName] = (collections[collectionName] as Array<{ id: string }>).filter((entry) => entry.id !== id);
    if (collectionName === 'items') {
      db.itemSets = removeDeletedItemIdFromItemSets(db.itemSets ?? [], id, nowIso());
    }
    await this.persist(db);
  }

  async importLegacy(payload: Partial<ContentDatabase>): Promise<ContentDatabase> {
    const db = this.ensureLoaded();

    if (Array.isArray(payload.items) && payload.items.length > 0) {
      const normalizedItems = payload.items.map((item) => normalizeItemInput(item as AdminItem));
      db.items = shouldReplaceItemsFromLegacy(db.items, normalizedItems)
        ? clone(normalizedItems)
        : mergeById(db.items, normalizedItems);
    }
    if (Array.isArray(payload.skills) && payload.skills.length > 0) {
      const normalizedSkills = payload.skills.map((skill) => normalizeSkillInput(skill as AdminSkillDefinition));
      db.skills = mergeById(db.skills, normalizedSkills);
    }
    if (Array.isArray(payload.visualFx) && payload.visualFx.length > 0) {
      const normalized = payload.visualFx.map((entry) => normalizeVisualFxInput(entry as VisualFxDefinition));
      db.visualFx = mergeById(db.visualFx, normalized);
    }
    if (Array.isArray(payload.locations) && payload.locations.length > 0) {
      const normalizedLocations = payload.locations.map((location) => normalizeLocationInput(location as WorldLocation));
      db.locations = mergeById(db.locations, normalizedLocations);
    }
    if (Array.isArray(payload.merchants) && payload.merchants.length > 0) {
      const normalizedMerchants = payload.merchants.map((merchant) => normalizeMerchantInput(merchant as AdminMerchant));
      db.merchants = shouldReplaceMerchantsFromLegacy(db.merchants, normalizedMerchants)
        ? clone(normalizedMerchants)
        : mergeById(db.merchants, normalizedMerchants);
    }
    if (Array.isArray(payload.cities) && payload.cities.length > 0) {
      const normalizedCities = payload.cities.map((city) => normalizeCityInput(city as City));
      db.cities = mergeById(db.cities, normalizedCities);
    }
    if (Array.isArray(payload.materials) && payload.materials.length > 0) {
      const normalizedMaterials = payload.materials.map((material) => normalizeMaterialInput(material as Material));
      db.materials = mergeById(db.materials, normalizedMaterials);
    }
    if (Array.isArray(payload.lootTables) && payload.lootTables.length > 0) {
      db.lootTables = mergeById(db.lootTables, payload.lootTables as any[]);
    }
    if (Array.isArray(payload.blacksmithForgeTiers) && payload.blacksmithForgeTiers.length > 0) {
      const normalized = payload.blacksmithForgeTiers.map((entry) => normalizeBlacksmithForgeTierInput(entry as BlacksmithForgeTier));
      db.blacksmithForgeTiers = mergeById(db.blacksmithForgeTiers ?? [], normalized);
    }
    if (Array.isArray(payload.blacksmithModules) && payload.blacksmithModules.length > 0) {
      const normalized = payload.blacksmithModules.map((entry) => normalizeBlacksmithModuleInput(entry as BlacksmithModule));
      db.blacksmithModules = mergeById(db.blacksmithModules ?? [], normalized);
    }
    if (Array.isArray(payload.blacksmithTools) && payload.blacksmithTools.length > 0) {
      const normalized = payload.blacksmithTools.map((entry) => normalizeBlacksmithToolInput(entry as BlacksmithTool));
      db.blacksmithTools = mergeById(db.blacksmithTools ?? [], normalized);
    }
    if (Array.isArray(payload.blacksmithQualityTiers) && payload.blacksmithQualityTiers.length > 0) {
      const normalized = payload.blacksmithQualityTiers.map((entry) => normalizeBlacksmithQualityTierInput(entry as BlacksmithQualityTier));
      db.blacksmithQualityTiers = mergeById(db.blacksmithQualityTiers ?? [], normalized);
    }
    if (Array.isArray(payload.blacksmithVisualPresets) && payload.blacksmithVisualPresets.length > 0) {
      const normalized = payload.blacksmithVisualPresets.map((entry) => normalizeBlacksmithVisualPresetInput(entry as BlacksmithVisualPreset));
      db.blacksmithVisualPresets = mergeById(db.blacksmithVisualPresets ?? [], normalized);
    }
    if (Array.isArray(payload.blacksmithBalance) && payload.blacksmithBalance.length > 0) {
      const normalized = payload.blacksmithBalance.map((entry) => normalizeBlacksmithBalanceInput(entry as BlacksmithBalance));
      db.blacksmithBalance = mergeById(db.blacksmithBalance ?? [], normalized);
    }
    if (Array.isArray(payload.blacksmithItemTemplates) && payload.blacksmithItemTemplates.length > 0) {
      const normalized = payload.blacksmithItemTemplates.map((entry) => normalizeBlacksmithItemTemplateInput(entry as BlacksmithItemTemplate));
      db.blacksmithItemTemplates = mergeById(db.blacksmithItemTemplates ?? [], normalized);
    }
    if (Array.isArray(payload.blacksmithItemWorkActions) && payload.blacksmithItemWorkActions.length > 0) {
      const normalized = payload.blacksmithItemWorkActions.map((entry) => normalizeBlacksmithItemWorkActionInput(entry as BlacksmithItemWorkAction));
      db.blacksmithItemWorkActions = mergeById(db.blacksmithItemWorkActions ?? [], normalized);
    }
    if (Array.isArray(payload.images) && payload.images.length > 0) {
      const normalizedImages = (payload.images as StoredImage[]).map((image) => this.normalizeStoredImageInput(image));
      db.images = mergeById(db.images, normalizedImages);
    }
    if (Array.isArray(payload.dialogues) && payload.dialogues.length > 0) {
      const normalized = payload.dialogues.map((entry) => normalizeDialogueInput(entry as DialogueDefinition));
      db.dialogues = mergeById(db.dialogues, normalized);
    }
    if (Array.isArray(payload.npcs) && payload.npcs.length > 0) {
      const normalized = payload.npcs.map((entry) => normalizeNpcInput(entry as NpcDefinition));
      db.npcs = mergeById(db.npcs, normalized);
    }
    if (Array.isArray(payload.quests) && payload.quests.length > 0) {
      const normalized = payload.quests.map((entry) => normalizeQuestInput(entry as QuestDefinition));
      db.quests = mergeById(db.quests, normalized);
    }
    if (Array.isArray(payload.questInteractions) && payload.questInteractions.length > 0) {
      const normalized = payload.questInteractions.map((entry) => normalizeQuestInteractionInput(entry as QuestInteractionDefinition));
      db.questInteractions = mergeById(db.questInteractions, normalized);
    }
    if (Array.isArray(payload.questItems) && payload.questItems.length > 0) {
      const normalized = payload.questItems.map((entry) => normalizeQuestItemInput(entry as QuestItemDefinition));
      db.questItems = mergeById(db.questItems, normalized);
    }
    if (Array.isArray(payload.questMarkers) && payload.questMarkers.length > 0) {
      const normalized = payload.questMarkers.map((entry) => normalizeQuestMarkerInput(entry as QuestMarkerDefinition));
      db.questMarkers = mergeById(db.questMarkers, normalized);
    }
    if (Array.isArray(payload.battleMaps) && payload.battleMaps.length > 0) {
      db.battleMaps = mergeById(db.battleMaps, clone(payload.battleMaps as BattleMapDefinition[]));
    }
    if (Array.isArray(payload.craftingRecipes) && payload.craftingRecipes.length > 0) {
      const normalized = payload.craftingRecipes.map((entry) => normalizeCraftingRecipeInput(entry as CraftingRecipe));
      db.craftingRecipes = mergeById(db.craftingRecipes ?? [], normalized);
    }

    if (Array.isArray(payload.recipeVisualProfiles) && payload.recipeVisualProfiles.length > 0) {
      const normalized = payload.recipeVisualProfiles.map((entry) => normalizeRecipeVisualProfileInput(entry as RecipeVisualProfile));
      db.recipeVisualProfiles = mergeById(db.recipeVisualProfiles ?? [], normalized);
    }
    if (Array.isArray(payload.itemSets) && payload.itemSets.length > 0) {
      const normalized = payload.itemSets.map((entry) => normalizeItemSetInput(entry as ItemSet));
      db.itemSets = mergeById(db.itemSets ?? [], normalized);
    }
    if (Array.isArray(payload.runeComplexes) && payload.runeComplexes.length > 0) {
      const normalized = payload.runeComplexes.map((entry) => normalizeRuneComplexInput(entry as RuneComplex));
      db.runeComplexes = mergeById(db.runeComplexes ?? [], normalized);
    }
    if (payload.worldMap && (payload.worldMap.zones?.length || payload.worldMap.regions?.length || payload.worldMap.questMarkers?.length)) {
      const normalizedQuestMarkers = Array.isArray(payload.worldMap.questMarkers)
        ? payload.worldMap.questMarkers.map((entry) => normalizeQuestMarkerInput(entry as QuestMarkerDefinition)).filter((m) => Boolean(m.id))
        : [];
      db.worldMap = {
        zones: mergeById(db.worldMap.zones ?? [], clone(payload.worldMap.zones ?? [])),
        regions: mergeById(db.worldMap.regions ?? [], clone(payload.worldMap.regions ?? [])),
        questMarkers: mergeById(db.worldMap.questMarkers ?? [], normalizedQuestMarkers),
        updatedAt: nowIso(),
      };
    }

    return this.persist(db);
  }

  async seedDefaultsIfEmpty(): Promise<{ seeded: boolean; message: string }> {
    const db = this.ensureLoaded();
    if (db.items.length > 0 || db.merchants.length > 0) {
      return { seeded: false, message: 'Content already exists, seed skipped.' };
    }

    const seeded = this.loadTemplateDatabase() ?? createSeedDatabase();
    await this.persist(seeded);
    return {
      seeded: true,
      message: `Seeded ${seeded.items.length} items and ${seeded.merchants.length} merchants at ${seeded.worldMap.updatedAt}`,
    };
  }

  getWorldMap(): WorldMapContent {
    return clone(this.ensureLoaded().worldMap);
  }

  getCanonicalItemIds(options?: { enabledOnly?: boolean }): string[] {
    const enabledOnly = options?.enabledOnly === true;
    const contentItemIds = this.ensureLoaded().items
      .filter((item) => (enabledOnly ? item.isEnabled : true))
      .map((item) => item.id);
    return Array.from(new Set([...Object.keys(ITEMS), ...contentItemIds]));
  }

  isCanonicalItemId(itemId: string, options?: { enabledOnly?: boolean }): boolean {
    return this.getCanonicalItemIds(options).includes(itemId);
  }

  getCombatLootPool(): string[] {
    return this.getCanonicalItemIds({ enabledOnly: true });
  }

  async saveWorldMap(payload: WorldMapContent): Promise<WorldMapContent> {
    const db = this.ensureLoaded();
    const safeZones = sanitizeIdObjectArray<WorldMapZone>(payload?.zones)
      .map((zone) => {
        const fallbackName = toFallbackLabelFromId(zone.id, 'Zone');
        const safeName = repairSuspiciousText(zone.name, fallbackName);
        return {
          ...zone,
          name: safeName,
          description: repairSuspiciousText(zone.description, safeName),
        };
      });
    const safeRegions = sanitizeIdObjectArray<PaintedRegion>(payload?.regions)
      .map((region) => {
        const fallbackName = toFallbackLabelFromId(region.id, 'Region');
        const safeName = repairSuspiciousText(region.name, fallbackName);
        return {
          ...region,
          name: safeName,
          description: repairSuspiciousText(region.description, safeName),
        };
      });
    const safeQuestMarkers = sanitizeIdObjectArray<QuestMarkerDefinition>(payload?.questMarkers)
      .map((entry) => normalizeQuestMarkerInput(entry))
      .filter((m) => Boolean(m.id));

    db.worldMap = {
      zones: clone(safeZones),
      regions: clone(safeRegions),
      questMarkers: safeQuestMarkers,
      updatedAt: nowIso(),
    };
    await this.persist(db);
    return clone(db.worldMap);
  }

  getWorldSimConfig(): WorldSimConfig {
    const db = this.ensureLoaded();
    return normalizeWorldSimConfig(db.worldSim);
  }

  async updateWorldSimConfig(config: WorldSimConfig): Promise<WorldSimConfig> {
    const db = this.ensureLoaded();
    const normalized = normalizeWorldSimConfig(config);
    db.worldSim = normalized;
    await this.persist(db);
    return clone(normalized);
  }

  toDomainItemDefinition(adminItem: AdminItem): ItemDefinition {
    const rarity: ItemDefinition['rarity'] = adminItem.rarity === 'common' || adminItem.rarity === 'uncommon' || adminItem.rarity === 'rare'
      ? adminItem.rarity
      : 'rare';
    const itemType = toDomainItemType(adminItem);

    return {
      id: adminItem.id,
      name: adminItem.name,
      itemType,
      itemSubType: adminItem.subtype || adminItem.type,
      handsRequired: itemType === 'weapon' && adminItem.handsRequired === 2 ? 2 : 1,
      price: Math.max(0, adminItem.price),
      requiredStats: adminItem.requiredStats ?? {},
      bonuses: adminItem.bonuses ?? {},
      stackable: adminItem.stackable,
      description: adminItem.gameplayDescription || adminItem.loreDescription || adminItem.name,
      icon: adminItem.imagePath || 'unknown',
      rarity,
    };
  }

  resolveItemById(itemId: string): ItemDefinition {
    const adminItem = this.ensureLoaded().items.find((item) => item.id === itemId && item.isEnabled);
    if (adminItem) {
      return this.toDomainItemDefinition(adminItem);
    }

    const domainItem = ITEMS[itemId];
    if (domainItem) {
      return domainItem;
    }

    throw new NotFoundException(`Unknown item id: ${itemId}`);
  }

  /**
   * Returns the raw AdminItem payload when present in content DB.
   * Used by combat runtime to read useEffects/effects/combatEffects.
   */
  resolveAdminItemById(itemId: string): AdminItem | null {
    const adminItem = this.ensureLoaded().items.find((item) => item.id === itemId && item.isEnabled);
    return adminItem ? clone(adminItem) : null;
  }

  getStatsWithEquipment(
    baseStats: StatBlock,
    equipment: Equipment,
    equippedItemsBySlot?: Partial<Record<keyof Equipment, AdminItem | null>>,
  ): StatBlock {
    const next = { ...baseStats };

    for (const [slot, itemId] of Object.entries(equipment) as Array<[keyof Equipment, string | null]>) {
      if (!itemId) {
        continue;
      }

      try {
        const overlayItem = equippedItemsBySlot?.[slot];
        const item = overlayItem ?? this.resolveItemById(itemId);
        for (const [stat, value] of Object.entries(item.bonuses ?? {})) {
          const key = stat as keyof StatBlock;
          next[key] = (next[key] ?? 0) + (value ?? 0);
        }
      } catch {
        // Skip missing legacy items instead of breaking character loading.
      }
    }

    const db = this.ensureLoaded();
    const resolved = resolveCharacterEquipmentModifiers({
      equipment,
      items: db.items,
      itemSets: db.itemSets ?? [],
      activationContexts: ['combat', 'arena'],
      equippedItemsBySlot,
    });
    applyPassiveStatBonusesToStatBlock(next, resolved.effects);

    return next;
  }

  getArenaCombatEquipmentModifiers(
    equipment: Equipment,
    equippedItemsBySlot?: Partial<Record<keyof Equipment, AdminItem | null>>,
  ): ArenaCombatEquipmentModifiers {
    const db = this.ensureLoaded();
    const resolved = resolveCharacterEquipmentModifiers({
      equipment,
      items: db.items,
      itemSets: db.itemSets ?? [],
      activationContexts: ['combat', 'arena'],
      equippedItemsBySlot,
    });
    const modifiers = aggregateArenaCombatEquipmentModifiers(resolved.effects);

    let totalArmorValue = 0;
    for (const [slot, itemId] of Object.entries(equipment) as Array<[keyof Equipment, string | null]>) {
      if (!itemId) {
        continue;
      }
      const adminItem = equippedItemsBySlot?.[slot] ?? db.items.find((item) => item.id === itemId && item.isEnabled) ?? null;
      if (!adminItem || typeof adminItem.armorValue !== 'number' || !Number.isFinite(adminItem.armorValue)) {
        continue;
      }
      totalArmorValue += Math.max(0, Math.floor(adminItem.armorValue));
    }

    if (totalArmorValue > 0) {
      modifiers.incomingPhysical.flat -= Math.max(1, Math.floor(totalArmorValue * 0.35));
      modifiers.incomingMagic.flat -= Math.floor(totalArmorValue * 0.1);
    }

    if (equipment.shield) {
      modifiers.blockChancePercent += 5;
    }

    return modifiers;
  }

  canEquipItem(baseStats: StatBlock, itemId: string, equipment?: Equipment, preferredSlot?: keyof Equipment): { ok: boolean; reason?: string } {
    const item = this.resolveItemById(itemId);

    if (item.itemType === 'consumable') {
      return { ok: false, reason: 'Consumables cannot be equipped.' };
    }

    for (const [stat, required] of Object.entries(item.requiredStats)) {
      const current = baseStats[stat as keyof StatBlock];
      if (required !== undefined && current < required) {
        return { ok: false, reason: `Недостаточно ${stat}: нужно ${required}` };
      }
    }

    const ringSlots: Array<keyof Equipment> = ['ring1', 'ring2', 'ring3'];
    const directSlots: Partial<Record<ItemDefinition['itemType'], keyof Equipment>> = {
      helmet: 'helmet',
      necklace: 'necklace',
      armor: 'armor',
      outerwear: 'outerwear',
      belt: 'belt',
      gloves: 'gloves',
      legs: 'legs',
      boots: 'boots',
      shield: 'shield',
    };

    const targetSlot = (() => {
      if (item.itemType === 'weapon') {
        return getItemHandsRequired(item) === 2 ? 'weapon' : preferredSlot === 'shield' ? 'shield' : 'weapon';
      }

      if (item.itemType === 'ring') {
        if (preferredSlot && !ringSlots.includes(preferredSlot)) {
          return null;
        }

        return preferredSlot ?? ringSlots.find((slot) => !(equipment?.[slot])) ?? 'ring1';
      }

      return directSlots[item.itemType] ?? null;
    })();

    if (!targetSlot) {
      return { ok: false, reason: 'Предмет нельзя надеть в выбранный слот.' };
    }

    if (item.itemType !== 'weapon' && item.itemType !== 'ring' && preferredSlot && preferredSlot !== targetSlot) {
      return { ok: false, reason: 'Предмет нельзя надеть в выбранный слот.' };
    }

    if (targetSlot === 'shield' && equipment?.weapon) {
      try {
        const equippedWeapon = this.resolveItemById(equipment.weapon);
        if (equippedWeapon.itemType === 'weapon' && getItemHandsRequired(equippedWeapon) === 2) {
          return { ok: false, reason: 'Левая рука занята двуручным оружием.' };
        }
      } catch {
        // Ignore broken legacy equipment records.
      }
    }

    return { ok: true };
  }

  equipItem(equipment: Equipment, itemId: string, preferredSlot?: keyof Equipment): Equipment {
    const item = this.resolveItemById(itemId);

    if (item.itemType === 'consumable') {
      throw new BadRequestException('Consumables cannot be equipped.');
    }

    const ringSlots: Array<keyof Equipment> = ['ring1', 'ring2', 'ring3'];
    const slotByType: Partial<Record<ItemDefinition['itemType'], keyof Equipment>> = {
      weapon: 'weapon',
      helmet: 'helmet',
      necklace: 'necklace',
      armor: 'armor',
      outerwear: 'outerwear',
      belt: 'belt',
      ring: 'ring1',
      legs: 'legs',
      boots: 'boots',
      gloves: 'gloves',
      shield: 'shield',
    };
    let slot = slotByType[item.itemType];

    if (item.itemType === 'weapon' && getItemHandsRequired(item) === 1) {
      slot = preferredSlot === 'shield' ? 'shield' : 'weapon';
    }

    if (item.itemType === 'ring') {
      if (preferredSlot && !ringSlots.includes(preferredSlot)) {
        throw new BadRequestException('Кольцо можно надеть только в слот кольца.');
      }
      slot = preferredSlot ?? ringSlots.find((ringSlot) => !equipment[ringSlot]) ?? 'ring1';
    }

    if (!slot) {
      throw new BadRequestException(`Unsupported equipment slot for item type: ${item.itemType}`);
    }

    if (item.itemType === 'weapon' && getItemHandsRequired(item) === 2) {
      return {
        ...equipment,
        weapon: itemId,
        shield: null,
      };
    }

    if (item.itemType === 'shield' && equipment.weapon) {
      try {
        const equippedWeapon = this.resolveItemById(equipment.weapon);
        if (equippedWeapon.itemType === 'weapon' && getItemHandsRequired(equippedWeapon) === 2) {
          throw new BadRequestException('Левая рука занята двуручным оружием.');
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
      }
    }

    return {
      ...equipment,
      [slot]: itemId,
    };
  }

  normalizeEquipment(equipment?: Partial<Equipment> | null): Equipment {
    return {
      ...EMPTY_EQUIPMENT,
      weapon: equipment?.weapon ?? null,
      helmet: equipment?.helmet ?? null,
      necklace: equipment?.necklace ?? null,
      armor: equipment?.armor ?? null,
      outerwear: equipment?.outerwear ?? null,
      belt: equipment?.belt ?? null,
      ring1: equipment?.ring1 ?? null,
      ring2: equipment?.ring2 ?? null,
      ring3: equipment?.ring3 ?? null,
      legs: equipment?.legs ?? null,
      boots: equipment?.boots ?? null,
      gloves: equipment?.gloves ?? null,
      shield: equipment?.shield ?? null,
    };
  }

  getMerchantItemPrice(merchantId: string | undefined, itemId: string): number {
    const item = this.resolveItemById(itemId);
    if (!merchantId) {
      return item.price;
    }

    const adminMerchant = this.ensureLoaded().merchants.find((merchant) => merchant.id === merchantId && merchant.isEnabled);
    if (!adminMerchant) {
      return item.price;
    }

    const merchantEntry = adminMerchant.items.find((entry) => entry.itemId === itemId && entry.isEnabled);
    if (!merchantEntry) {
      throw new BadRequestException(`Merchant ${merchantId} does not sell item ${itemId}.`);
    }

    const basePrice = merchantEntry.priceOverride ?? item.price;
    const merchantMultiplier = normalizePositiveMultiplier(adminMerchant.priceMultiplier, 1);
    const entryMultiplier = normalizePositiveMultiplier(merchantEntry.priceMultiplier, 1);
    return Math.max(0, Math.round(basePrice * merchantMultiplier * entryMultiplier));
  }
}
