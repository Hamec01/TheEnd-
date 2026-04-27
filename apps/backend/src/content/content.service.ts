import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EMPTY_EQUIPMENT,
  ITEMS,
  MERCHANTS,
  getItemHandsRequired,
  type Equipment,
  type ItemDefinition,
  type Merchant,
  type StatBlock,
} from '@theend/rpg-domain';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type {
  AdminItem,
  AdminMerchant,
  ContentCollectionMap,
  ContentCollectionName,
  ContentDatabase,
  ItemRarity,
  Material,
  MerchantItem,
  StoredImage,
  WorldMapContent,
} from './content.types';

const CONTENT_DB_VERSION = 1 as const;
const CONTENT_COLLECTIONS: ContentCollectionName[] = ['items', 'merchants', 'materials', 'lootTables', 'images'];
const BUILTIN_MERCHANT_IDS = new Set(MERCHANTS.map((merchant) => merchant.id));

function nowIso(): string {
  return new Date().toISOString();
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
  if (['helmet', 'armor', 'boots', 'gloves', 'shield'].includes(item.itemType)) {
    return 'armor';
  }
  return 'misc';
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
  if (item.itemType === 'armor') {
    return 'chest';
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

function createEmptyDatabase(): ContentDatabase {
  const timestamp = nowIso();
  return {
    version: CONTENT_DB_VERSION,
    items: [],
    merchants: [],
    materials: [],
    lootTables: [],
    images: [],
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
    merchants: MERCHANTS.map((merchant) => seedMerchantFromDomain(merchant, timestamp)),
    materials: [],
    lootTables: [],
    images: [],
    worldMap: {
      zones: [],
      regions: [],
      updatedAt: timestamp,
    },
  };
}

function toDomainItemType(adminItem: AdminItem): ItemDefinition['itemType'] {
  if (adminItem.type === 'weapon') {
    return 'weapon';
  }

  if (adminItem.type === 'armor') {
    switch (adminItem.slot) {
      case 'head':
        return 'helmet';
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
  return {
    ...input,
    id: input.id.trim(),
    name: input.name.trim(),
    type: input.type,
    subtype: input.subtype?.trim() || undefined,
    slot: input.slot ?? 'none',
    handsRequired: input.type === 'weapon' && input.handsRequired === 2 ? 2 : 1,
    price: Math.max(0, Math.round(input.price || 0)),
    stackable: Boolean(input.stackable),
    maxStack: input.stackable ? Math.max(2, input.maxStack ?? 2) : 1,
    requiredStats: input.requiredStats ?? {},
    bonuses: input.bonuses ?? {},
    gameplayDescription: input.gameplayDescription ?? '',
    loreDescription: input.loreDescription ?? '',
    imagePath: input.imagePath?.trim() || undefined,
    isEnabled: input.isEnabled !== false,
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
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

@Injectable()
export class ContentService {
  private readonly dataDir = join(process.cwd(), 'data');
  private readonly dbFile = join(this.dataDir, 'content-db.json');
  private readonly templateFile = join(this.dataDir, 'content-template.json');
  private dbCache: ContentDatabase | null = null;

  private normalizeDatabase(raw: Partial<ContentDatabase>): ContentDatabase {
    return {
      version: CONTENT_DB_VERSION,
      items: Array.isArray(raw.items) ? raw.items.map((item) => normalizeItemInput(item as AdminItem)) : [],
      merchants: Array.isArray(raw.merchants) ? raw.merchants.map((merchant) => normalizeMerchantInput(merchant as AdminMerchant)) : [],
      materials: Array.isArray(raw.materials) ? clone(raw.materials as Material[]) : [],
      lootTables: Array.isArray(raw.lootTables) ? clone(raw.lootTables) : [],
      images: Array.isArray(raw.images) ? clone(raw.images as StoredImage[]) : [],
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
    if (!existsSync(this.templateFile)) {
      return null;
    }

    try {
      const raw = JSON.parse(readFileSync(this.templateFile, 'utf8')) as Partial<ContentDatabase>;
      return this.normalizeDatabase(raw);
    } catch {
      return null;
    }
  }

  private ensureLoaded(): ContentDatabase {
    if (this.dbCache) {
      return this.dbCache;
    }

    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }

    if (!existsSync(this.dbFile)) {
      const template = this.loadTemplateDatabase();
      this.persist(template ?? createEmptyDatabase());
      return this.dbCache!;
    }

    try {
      const raw = JSON.parse(readFileSync(this.dbFile, 'utf8')) as Partial<ContentDatabase>;
      const next = this.normalizeDatabase(raw);
      this.persist(next);
      return this.dbCache!;
    } catch {
      const template = this.loadTemplateDatabase();
      this.persist(template ?? createEmptyDatabase());
      return this.dbCache!;
    }
  }

  private persist(db: ContentDatabase): ContentDatabase {
    this.dbCache = clone(db);
    writeFileSync(this.dbFile, JSON.stringify(this.dbCache, null, 2), 'utf8');
    return clone(this.dbCache);
  }

  getSnapshot(): ContentDatabase {
    return clone(this.ensureLoaded());
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

  createCollectionEntry<K extends ContentCollectionName>(name: K | string, payload: ContentCollectionMap[K]): ContentCollectionMap[K] {
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
    } else if (collectionName === 'merchants') {
      nextEntry = normalizeMerchantInput(payload as ContentCollectionMap['merchants']) as ContentCollectionMap[K];
    } else {
      nextEntry = clone(payload);
    }

    const collections = db as unknown as Record<ContentCollectionName, unknown[]>;
    collections[collectionName] = [...collections[collectionName], nextEntry as unknown];
    this.persist(db);
    return clone(nextEntry);
  }

  updateCollectionEntry<K extends ContentCollectionName>(name: K | string, id: string, patch: Partial<ContentCollectionMap[K]>): ContentCollectionMap[K] {
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
    } else if (collectionName === 'merchants') {
      merged = normalizeMerchantInput(mergedBase as ContentCollectionMap['merchants']) as ContentCollectionMap[K];
    } else {
      merged = mergedBase;
    }

    const collections = db as unknown as Record<ContentCollectionName, unknown[]>;
    collections[collectionName] = (collections[collectionName] as Array<{ id: string }>).map((entry) =>
      entry.id === id ? clone(merged) : entry,
    );
    this.persist(db);
    return clone(merged);
  }

  deleteCollectionEntry(name: ContentCollectionName | string, id: string): void {
    const db = this.ensureLoaded();
    const collectionName = ensureCollectionName(name);
    const collections = db as unknown as Record<ContentCollectionName, unknown[]>;
    collections[collectionName] = (collections[collectionName] as Array<{ id: string }>).filter((entry) => entry.id !== id);
    this.persist(db);
  }

  importLegacy(payload: Partial<ContentDatabase>): ContentDatabase {
    const db = this.ensureLoaded();

    if (Array.isArray(payload.items) && payload.items.length > 0) {
      const normalizedItems = payload.items.map((item) => normalizeItemInput(item as AdminItem));
      db.items = shouldReplaceItemsFromLegacy(db.items, normalizedItems)
        ? clone(normalizedItems)
        : mergeById(db.items, normalizedItems);
    }
    if (Array.isArray(payload.merchants) && payload.merchants.length > 0) {
      const normalizedMerchants = payload.merchants.map((merchant) => normalizeMerchantInput(merchant as AdminMerchant));
      db.merchants = shouldReplaceMerchantsFromLegacy(db.merchants, normalizedMerchants)
        ? clone(normalizedMerchants)
        : mergeById(db.merchants, normalizedMerchants);
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
    if (payload.worldMap && (payload.worldMap.zones?.length || payload.worldMap.regions?.length)) {
      db.worldMap = {
        zones: clone(payload.worldMap.zones ?? []),
        regions: clone(payload.worldMap.regions ?? []),
        updatedAt: nowIso(),
      };
    }

    return this.persist(db);
  }

  seedDefaultsIfEmpty(): { seeded: boolean; message: string } {
    const db = this.ensureLoaded();
    if (db.items.length > 0 || db.merchants.length > 0) {
      return { seeded: false, message: 'Content already exists, seed skipped.' };
    }

    const seeded = this.loadTemplateDatabase() ?? createSeedDatabase();
    this.persist(seeded);
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
    return this.ensureLoaded().items
      .filter((item) => (enabledOnly ? item.isEnabled : true))
      .map((item) => item.id);
  }

  isCanonicalItemId(itemId: string, options?: { enabledOnly?: boolean }): boolean {
    return this.getCanonicalItemIds(options).includes(itemId);
  }

  getCombatLootPool(): string[] {
    return this.getCanonicalItemIds({ enabledOnly: true });
  }

  saveWorldMap(payload: WorldMapContent): WorldMapContent {
    const db = this.ensureLoaded();
    db.worldMap = {
      zones: clone(Array.isArray(payload.zones) ? payload.zones : []),
      regions: clone(Array.isArray(payload.regions) ? payload.regions : []),
      updatedAt: nowIso(),
    };
    this.persist(db);
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

  canEquipItem(baseStats: StatBlock, itemId: string, equipment?: Equipment): { ok: boolean; reason?: string } {
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

    if (item.itemType === 'shield' && equipment?.weapon) {
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

  equipItem(equipment: Equipment, itemId: string): Equipment {
    const item = this.resolveItemById(itemId);

    if (item.itemType === 'consumable') {
      throw new BadRequestException('Consumables cannot be equipped.');
    }

    const slotByType: Record<string, keyof Equipment> = {
      weapon: 'weapon',
      helmet: 'helmet',
      armor: 'armor',
      boots: 'boots',
      gloves: 'gloves',
      shield: 'shield',
    };
    const slot = slotByType[item.itemType];
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
      armor: equipment?.armor ?? null,
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
