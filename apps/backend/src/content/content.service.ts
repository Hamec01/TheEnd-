import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  EMPTY_EQUIPMENT,
  CastType,
  ITEMS,
  MERCHANTS,
  SkillType,
  validateSkillDefinition,
  getItemHandsRequired,
  type AdminSkillDefinition,
  type Equipment,
  type ItemDefinition,
  type Merchant,
  type StatBlock,
} from '@theend/rpg-domain';
import type { Prisma } from '@prisma/client';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AdminItem,
  AdminMerchant,
  City,
  CityLocation,
  ContentCollectionMap,
  ContentCollectionName,
  ContentDatabase,
  DialogueDefinition,
  ItemRarity,
  Material,
  MerchantItem,
  NpcDefinition,
  QuestDefinition,
  QuestItemDefinition,
  QuestMarkerDefinition,
  StoredImage,
  WorldMapContent,
} from './content.types';

const CONTENT_DB_VERSION = 1 as const;
const CONTENT_COLLECTIONS: ContentCollectionName[] = [
  'items',
  'skills',
  'merchants',
  'cities',
  'materials',
  'lootTables',
  'images',
  'dialogues',
  'npcs',
  'quests',
  'questItems',
  'questMarkers',
];
const BUILTIN_MERCHANT_IDS = new Set(MERCHANTS.map((merchant) => merchant.id));
const CONTENT_DB_BACKUP_DIR = 'backups';
const CONTENT_DB_MAX_BACKUPS = 40;
const BUILTIN_PLACEHOLDER_IMAGE_IDS = new Set(['unknown']);
const CONTENT_STORE_KEY = 'main-content-db';

type ContentStorageMode = 'database' | 'file';

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
    thumbnailImageId: input.thumbnailImageId?.trim() || undefined,
    locations: Array.isArray(input.locations)
      ? input.locations
        .map((location) => ({
          ...clone(location),
          id: String(location.id ?? '').trim(),
          cityId,
          name: String(location.name ?? '').trim(),
          description: location.description?.trim() || undefined,
          imageId: location.imageId?.trim() || undefined,
          npcIds: Array.isArray(location.npcIds) ? location.npcIds.map((entry) => String(entry).trim()).filter(Boolean) : [],
          questIds: Array.isArray(location.questIds) ? location.questIds.map((entry) => String(entry).trim()).filter(Boolean) : [],
          shopIds: Array.isArray(location.shopIds) ? location.shopIds.map((entry) => String(entry).trim()).filter(Boolean) : [],
          unlockCondition: location.unlockCondition?.trim() || undefined,
          markerIcon: location.markerIcon?.trim() || undefined,
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
    merchants: [],
    cities: [],
    materials: [],
    lootTables: [],
    images: [],
    dialogues: [],
    npcs: [],
    quests: [],
    questItems: [],
    questMarkers: [],
    worldMap: {
      zones: [],
      regions: [],
      updatedAt: timestamp,
    },
  };
}

function createSeedDatabase(): ContentDatabase {
  const timestamp = nowIso();
  return {
    version: CONTENT_DB_VERSION,
    items: Object.values(ITEMS).map((item) => seedItemFromDomain(item, timestamp)),
    skills: [],
    merchants: MERCHANTS.map((merchant) => seedMerchantFromDomain(merchant, timestamp)),
    cities: seedStarterCities(timestamp),
    materials: [],
    lootTables: [],
    images: [],
    dialogues: [],
    npcs: [],
    quests: [],
    questItems: [],
    questMarkers: [],
    worldMap: {
      zones: [],
      regions: [],
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

function normalizeItemInput(input: AdminItem): AdminItem {
  const damageMin = typeof input.damageMin === 'number' && Number.isFinite(input.damageMin)
    ? Math.max(0, Math.round(input.damageMin))
    : undefined;
  const damageMax = typeof input.damageMax === 'number' && Number.isFinite(input.damageMax)
    ? Math.max(0, Math.round(input.damageMax))
    : undefined;

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
    damageMin: input.type === 'weapon' ? (damageMin ?? damageMax) : damageMin,
    damageMax: input.type === 'weapon' ? (damageMax ?? damageMin) : damageMax,
    gameplayDescription: input.gameplayDescription ?? '',
    loreDescription: input.loreDescription ?? '',
    imagePath: input.imagePath?.trim() || undefined,
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
    requirements: input.requirements ?? {},
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
    nodes: Array.isArray(input.nodes) ? clone(input.nodes) : [],
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function normalizeNpcInput(input: NpcDefinition): NpcDefinition {
  const now = nowIso();
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    title: input.title ? String(input.title).trim() : undefined,
    status: input.status === 'active' || input.status === 'disabled' || input.status === 'archived' ? input.status : 'draft',
    kind: String(input.kind ?? 'civilian').trim() || 'civilian',
    race: String(input.race ?? 'human').trim() || 'human',
    description: input.description ? String(input.description).trim() : undefined,
    mapBindings: Array.isArray(input.mapBindings) ? clone(input.mapBindings) : [],
    dialogues: Array.isArray(input.dialogues) ? clone(input.dialogues) : [],
    questBindings: Array.isArray(input.questBindings) ? clone(input.questBindings) : [],
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

function normalizeQuestItemInput(input: QuestItemDefinition): QuestItemDefinition {
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    name: String(input.name ?? '').trim(),
    description: String(input.description ?? '').trim(),
    iconUrl: input.iconUrl ? String(input.iconUrl).trim() : undefined,
    imageUrl: input.imageUrl ? String(input.imageUrl).trim() : undefined,
    linkedQuestId: input.linkedQuestId ? String(input.linkedQuestId).trim() : undefined,
    canDrop: input.canDrop !== false,
    canSell: input.canSell !== false,
    canTrade: input.canTrade !== false,
    removeOnQuestComplete: input.removeOnQuestComplete !== false,
    showInQuestInventory: input.showInQuestInventory !== false,
  };
}

function normalizeQuestMarkerInput(input: QuestMarkerDefinition): QuestMarkerDefinition {
  return {
    ...input,
    id: String(input.id ?? '').trim(),
    mapId: String(input.mapId ?? '').trim(),
    x: typeof input.x === 'number' && Number.isFinite(input.x) ? Math.max(0, Math.min(1, input.x)) : 0.5,
    y: typeof input.y === 'number' && Number.isFinite(input.y) ? Math.max(0, Math.min(1, input.y)) : 0.5,
    type: String(input.type ?? 'quest_objective').trim() || 'quest_objective',
    title: String(input.title ?? '').trim(),
    linkedQuestId: input.linkedQuestId ? String(input.linkedQuestId).trim() : undefined,
    linkedStepId: input.linkedStepId ? String(input.linkedStepId).trim() : undefined,
    linkedObjectiveId: input.linkedObjectiveId ? String(input.linkedObjectiveId).trim() : undefined,
    linkedNpcId: input.linkedNpcId ? String(input.linkedNpcId).trim() : undefined,
    icon: input.icon ? String(input.icon).trim() : undefined,
    visibleToPlayer: input.visibleToPlayer !== false,
    conditionIds: Array.isArray(input.conditionIds) ? input.conditionIds.map((id) => String(id).trim()).filter(Boolean) : [],
    imageUrl: input.imageUrl ? String(input.imageUrl).trim() : undefined,
  };
}

function normalizeQuestInput(input: QuestDefinition): QuestDefinition {
  const now = nowIso();
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
    portraitUrl: input.portraitUrl ? String(input.portraitUrl).trim() : undefined,
    imageUrl: input.imageUrl ? String(input.imageUrl).trim() : undefined,
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
  return {
    ...input,
    id: input.id.trim(),
    name: input.name.trim(),
    city: input.city.trim(),
    location: input.location?.trim() || undefined,
    description: input.description?.trim() || undefined,
    portraitPath: input.portraitPath?.trim() || undefined,
    priceMultiplier: normalizePositiveMultiplier(input.priceMultiplier, 1),
    isEnabled: input.isEnabled !== false,
    items: Array.isArray(input.items) ? input.items.map(normalizeMerchantItem).filter((entry) => entry.itemId) : [],
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
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
    if (!entry.id) {
      continue;
    }
    merged.set(entry.id, clone(entry));
  }

  for (const entry of incoming) {
    const id = String(entry.id ?? '').trim();
    if (!id) {
      continue;
    }
    merged.set(id, clone({ ...entry, id }));
  }

  return [...merged.values()];
}

function findDuplicateIds<T extends { id: string }>(entries: T[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const entry of entries) {
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

function hasMojibakeQuestionMarks(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return /\?{3,}/.test(value);
}

function resolveContentDbFilePath(): string {
  const configured = String(process.env.CONTENT_DB_PATH ?? '').trim();
  if (!configured) {
    return join(process.cwd(), 'data', 'content-db.json');
  }

  if (isAbsolute(configured)) {
    return configured;
  }

  return join(process.cwd(), configured);
}

@Injectable()
export class ContentService implements OnModuleInit {
  private readonly logger = new Logger(ContentService.name);
  private readonly templateFile = resolveContentDbFilePath();
  private readonly dataDir = dirname(this.templateFile);
  private readonly legacyTemplateFile = join(this.dataDir, 'content-template.json');
  private readonly runtimeFile = join(this.dataDir, 'content-runtime.json');
  private readonly backupDir = join(this.dataDir, CONTENT_DB_BACKUP_DIR);
  private readonly storageMode: ContentStorageMode = String(process.env.CONTENT_STORAGE ?? '').trim().toLowerCase() === 'file'
    ? 'file'
    : 'database';
  private dbCache: ContentDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureInitialized();
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
    findUnique(args: { where: { key: string } }): Promise<{ value: Prisma.JsonValue } | null>;
    upsert(args: { where: { key: string }; update: { value: Prisma.InputJsonValue }; create: { key: string; value: Prisma.InputJsonValue } }): Promise<unknown>;
  } {
    return (this.prisma as unknown as {
      contentStore: {
        findUnique(args: { where: { key: string } }): Promise<{ value: Prisma.JsonValue } | null>;
        upsert(args: { where: { key: string }; update: { value: Prisma.InputJsonValue }; create: { key: string; value: Prisma.InputJsonValue } }): Promise<unknown>;
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
      this.dbCache = this.normalizeDatabase(raw);
      this.logger.log('Content storage initialized from database.');
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
      const raw = JSON.parse(readFileSync(this.runtimeFile, 'utf8')) as Partial<ContentDatabase>;
      return this.normalizeDatabase(raw);
    } catch {
      const fallback = this.loadTemplateDatabase() ?? createEmptyDatabase();
      this.persistToFile(fallback);
      return this.ensureCache();
    }
  }

  private validateDatabaseIntegrity(db: ContentDatabase): string[] {
    const errors: string[] = [];

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

    const duplicateQuestItems = findDuplicateIds(db.questItems);
    if (duplicateQuestItems.length > 0) {
      errors.push(`Duplicate quest item ids: ${duplicateQuestItems.join(', ')}`);
    }

    const duplicateQuestMarkers = findDuplicateIds(db.questMarkers);
    if (duplicateQuestMarkers.length > 0) {
      errors.push(`Duplicate quest marker ids: ${duplicateQuestMarkers.join(', ')}`);
    }

    const itemIds = new Set(db.items.map((item) => item.id));
    const imageIds = new Set(db.images.map((image) => String(image.id ?? '').trim()).filter(Boolean));

    for (const item of db.items) {
      if (item.imagePath && !imageIds.has(item.imagePath) && !BUILTIN_PLACEHOLDER_IMAGE_IDS.has(item.imagePath)) {
        errors.push(`Item '${item.id}' references missing image '${item.imagePath}'.`);
      }

      if (hasMojibakeQuestionMarks(item.name) || hasMojibakeQuestionMarks(item.subtype) || hasMojibakeQuestionMarks(item.gameplayDescription) || hasMojibakeQuestionMarks(item.loreDescription)) {
        errors.push(`Item '${item.id}' contains suspicious mojibake text ('???').`);
      }
    }

    for (const skill of db.skills) {
      if (skill.iconUrl && !skill.iconUrl.startsWith('/') && !skill.iconUrl.startsWith('http') && !imageIds.has(skill.iconUrl)) {
        errors.push(`Skill '${skill.id}' references missing image '${skill.iconUrl}'.`);
      }
      for (const validationError of validateSkillDefinition(skill)) {
        errors.push(`Skill '${skill.id}': ${validationError}`);
      }
    }

    for (const merchant of db.merchants) {
      if (merchant.portraitPath && !imageIds.has(merchant.portraitPath) && !BUILTIN_PLACEHOLDER_IMAGE_IDS.has(merchant.portraitPath)) {
        errors.push(`Merchant '${merchant.id}' references missing portrait image '${merchant.portraitPath}'.`);
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

    for (const zone of db.worldMap.zones ?? []) {
      if (hasMojibakeQuestionMarks(zone.name) || hasMojibakeQuestionMarks(zone.description)) {
        errors.push(`World zone '${zone.id}' contains suspicious mojibake text ('???').`);
      }
    }

    for (const region of db.worldMap.regions ?? []) {
      if (hasMojibakeQuestionMarks(region.name) || hasMojibakeQuestionMarks(region.description)) {
        errors.push(`World region '${region.id}' contains suspicious mojibake text ('???').`);
      }
    }

    for (const dialogue of db.dialogues ?? []) {
      if (hasMojibakeQuestionMarks(dialogue.title) || hasMojibakeQuestionMarks(dialogue.description)) {
        errors.push(`Dialogue '${dialogue.id}' contains suspicious mojibake text ('???').`);
      }
    }

    for (const npc of db.npcs ?? []) {
      if (hasMojibakeQuestionMarks(npc.name) || hasMojibakeQuestionMarks(npc.title) || hasMojibakeQuestionMarks(npc.description)) {
        errors.push(`NPC '${npc.id}' contains suspicious mojibake text ('???').`);
      }
    }

    for (const quest of db.quests ?? []) {
      if (hasMojibakeQuestionMarks(quest.title) || hasMojibakeQuestionMarks(quest.adminDescription) || hasMojibakeQuestionMarks(quest.playerDescription)) {
        errors.push(`Quest '${quest.id}' contains suspicious mojibake text ('???').`);
      }
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

    const timestamp = nowIso().replace(/[:.]/g, '-');
    const backupFile = join(this.backupDir, `content-db-${timestamp}.json`);
    copyFileSync(this.runtimeFile, backupFile);

    const backups = readdirSync(this.backupDir)
      .filter((file) => file.startsWith('content-db-') && file.endsWith('.json'))
      .sort();

    const toDelete = backups.slice(0, Math.max(0, backups.length - CONTENT_DB_MAX_BACKUPS));
    for (const file of toDelete) {
      unlinkSync(join(this.backupDir, file));
    }
  }

  private normalizeDatabase(raw: Partial<ContentDatabase>): ContentDatabase {
    return {
      version: CONTENT_DB_VERSION,
      items: Array.isArray(raw.items) ? raw.items.map((item) => normalizeItemInput(item as AdminItem)) : [],
      skills: Array.isArray(raw.skills) ? raw.skills.map((skill) => normalizeSkillInput(skill as AdminSkillDefinition)) : [],
      merchants: Array.isArray(raw.merchants) ? raw.merchants.map((merchant) => normalizeMerchantInput(merchant as AdminMerchant)) : [],
      cities: Array.isArray(raw.cities) ? raw.cities.map((city) => normalizeCityInput(city as City)).filter((city) => Boolean(city.id)) : [],
      materials: Array.isArray(raw.materials) ? clone(raw.materials as Material[]) : [],
      lootTables: Array.isArray(raw.lootTables) ? clone(raw.lootTables) : [],
      images: Array.isArray(raw.images) ? clone(raw.images as StoredImage[]) : [],
      dialogues: Array.isArray(raw.dialogues) ? raw.dialogues.map((entry) => normalizeDialogueInput(entry as DialogueDefinition)).filter((d) => Boolean(d.id)) : [],
      npcs: Array.isArray(raw.npcs) ? raw.npcs.map((entry) => normalizeNpcInput(entry as NpcDefinition)).filter((n) => Boolean(n.id)) : [],
      quests: Array.isArray(raw.quests) ? raw.quests.map((entry) => normalizeQuestInput(entry as QuestDefinition)).filter((q) => Boolean(q.id)) : [],
      questItems: Array.isArray(raw.questItems) ? raw.questItems.map((entry) => normalizeQuestItemInput(entry as QuestItemDefinition)).filter((q) => Boolean(q.id)) : [],
      questMarkers: Array.isArray(raw.questMarkers) ? raw.questMarkers.map((entry) => normalizeQuestMarkerInput(entry as QuestMarkerDefinition)).filter((m) => Boolean(m.id)) : [],
      worldMap: raw.worldMap && typeof raw.worldMap === 'object'
        ? {
            zones: Array.isArray(raw.worldMap.zones) ? clone(raw.worldMap.zones) : [],
            regions: Array.isArray(raw.worldMap.regions) ? clone(raw.worldMap.regions) : [],
            updatedAt: raw.worldMap.updatedAt || nowIso(),
          }
        : {
            zones: [],
            regions: [],
            updatedAt: nowIso(),
          },
    };
  }

  private loadTemplateDatabase(): ContentDatabase | null {
    for (const filePath of [this.templateFile, this.legacyTemplateFile]) {
      if (!existsSync(filePath)) {
        continue;
      }

      try {
        const raw = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<ContentDatabase>;
        return this.normalizeDatabase(raw);
      } catch {
        continue;
      }
    }

    return null;
  }

  private ensureLoaded(): ContentDatabase {
    return this.ensureCache();
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
    writeFileSync(this.runtimeFile, JSON.stringify(this.dbCache, null, 2), 'utf8');
    return clone(this.dbCache);
  }

  private async persist(db: ContentDatabase): Promise<ContentDatabase> {
    const next = clone(db);
    const integrityErrors = this.validateDatabaseIntegrity(next);
    if (integrityErrors.length > 0) {
      throw new BadRequestException(`Content integrity check failed:\n- ${integrityErrors.join('\n- ')}`);
    }

    if (this.storageMode === 'file') {
      return this.persistToFile(next);
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
    if (this.storageMode !== 'database') {
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

  listCollection<K extends ContentCollectionName>(name: K | string): ContentCollectionMap[K][] {
    const db = this.ensureLoaded();
    const collectionName = ensureCollectionName(name);
    return clone(db[collectionName]) as ContentCollectionMap[K][];
  }

  getCollectionEntry<K extends ContentCollectionName>(name: K | string, id: string): ContentCollectionMap[K] | null {
    const collection = this.listCollection(name);
    return collection.find((entry) => entry.id === id) ?? null;
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
    } else if (collectionName === 'merchants') {
      nextEntry = normalizeMerchantInput(payload as ContentCollectionMap['merchants']) as ContentCollectionMap[K];
    } else if (collectionName === 'cities') {
      nextEntry = normalizeCityInput(payload as ContentCollectionMap['cities']) as ContentCollectionMap[K];
    } else if (collectionName === 'dialogues') {
      nextEntry = normalizeDialogueInput(payload as unknown as DialogueDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'npcs') {
      nextEntry = normalizeNpcInput(payload as unknown as NpcDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'quests') {
      nextEntry = normalizeQuestInput(payload as unknown as QuestDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'questItems') {
      nextEntry = normalizeQuestItemInput(payload as unknown as QuestItemDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'questMarkers') {
      nextEntry = normalizeQuestMarkerInput(payload as unknown as QuestMarkerDefinition) as unknown as ContentCollectionMap[K];
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
    } else if (collectionName === 'merchants') {
      merged = normalizeMerchantInput(mergedBase as ContentCollectionMap['merchants']) as ContentCollectionMap[K];
    } else if (collectionName === 'cities') {
      merged = normalizeCityInput(mergedBase as ContentCollectionMap['cities']) as ContentCollectionMap[K];
    } else if (collectionName === 'dialogues') {
      merged = normalizeDialogueInput(mergedBase as unknown as DialogueDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'npcs') {
      merged = normalizeNpcInput(mergedBase as unknown as NpcDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'quests') {
      merged = normalizeQuestInput(mergedBase as unknown as QuestDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'questItems') {
      merged = normalizeQuestItemInput(mergedBase as unknown as QuestItemDefinition) as unknown as ContentCollectionMap[K];
    } else if (collectionName === 'questMarkers') {
      merged = normalizeQuestMarkerInput(mergedBase as unknown as QuestMarkerDefinition) as unknown as ContentCollectionMap[K];
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
      db.materials = mergeById(db.materials, payload.materials as Material[]);
    }
    if (Array.isArray(payload.lootTables) && payload.lootTables.length > 0) {
      db.lootTables = mergeById(db.lootTables, payload.lootTables as any[]);
    }
    if (Array.isArray(payload.images) && payload.images.length > 0) {
      db.images = mergeById(db.images, payload.images as StoredImage[]);
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
    if (Array.isArray(payload.questItems) && payload.questItems.length > 0) {
      const normalized = payload.questItems.map((entry) => normalizeQuestItemInput(entry as QuestItemDefinition));
      db.questItems = mergeById(db.questItems, normalized);
    }
    if (Array.isArray(payload.questMarkers) && payload.questMarkers.length > 0) {
      const normalized = payload.questMarkers.map((entry) => normalizeQuestMarkerInput(entry as QuestMarkerDefinition));
      db.questMarkers = mergeById(db.questMarkers, normalized);
    }
    if (payload.worldMap && (payload.worldMap.zones?.length || payload.worldMap.regions?.length)) {
      db.worldMap = {
        zones: clone(payload.worldMap.zones ?? []),
        regions: clone(payload.worldMap.regions ?? []),
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
    db.worldMap = {
      zones: clone(Array.isArray(payload.zones) ? payload.zones : []),
      regions: clone(Array.isArray(payload.regions) ? payload.regions : []),
      updatedAt: nowIso(),
    };
    await this.persist(db);
    return clone(db.worldMap);
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

  getStatsWithEquipment(baseStats: StatBlock, equipment: Equipment): StatBlock {
    const next = { ...baseStats };

    for (const itemId of Object.values(equipment)) {
      if (!itemId) {
        continue;
      }

      try {
        const item = this.resolveItemById(itemId);
        for (const [stat, value] of Object.entries(item.bonuses)) {
          const key = stat as keyof StatBlock;
          next[key] = (next[key] ?? 0) + (value ?? 0);
        }
      } catch {
        // Skip missing legacy items instead of breaking character loading.
      }
    }

    return next;
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
