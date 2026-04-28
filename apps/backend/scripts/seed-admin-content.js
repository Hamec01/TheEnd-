/* eslint-disable no-console */
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const { PrismaClient } = require('@prisma/client');

const CONTENT_DB_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function emptyDb() {
  const timestamp = nowIso();
  return {
    version: CONTENT_DB_VERSION,
    items: [],
    skills: [],
    merchants: [],
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

function upsertById(entries, nextEntry) {
  const index = entries.findIndex((entry) => entry.id === nextEntry.id);
  if (index >= 0) {
    entries[index] = { ...entries[index], ...nextEntry, updatedAt: nowIso() };
    return;
  }
  entries.push(nextEntry);
}

function upsertZone(zones, zone) {
  const index = zones.findIndex((entry) => entry.id === zone.id);
  if (index >= 0) {
    zones[index] = {
      ...zones[index],
      ...zone,
      updatedAt: nowMs(),
    };
    return;
  }
  zones.push(zone);
}

async function assertPostgresConnection() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[seed-admin-content] DATABASE_URL is not set. Seeding content DB file only.');
    return;
  }

  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    console.warn('[seed-admin-content] DATABASE_URL is not PostgreSQL. Seeding content DB file only.');
    return;
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[seed-admin-content] PostgreSQL connection OK.');
  } finally {
    await prisma.$disconnect();
  }
}

function loadDb(dbPath) {
  if (!existsSync(dbPath)) {
    return emptyDb();
  }

  try {
    const parsed = JSON.parse(readFileSync(dbPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') {
      return emptyDb();
    }

    const base = emptyDb();
    return {
      ...base,
      ...parsed,
      version: CONTENT_DB_VERSION,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      merchants: Array.isArray(parsed.merchants) ? parsed.merchants : [],
      materials: Array.isArray(parsed.materials) ? parsed.materials : [],
      lootTables: Array.isArray(parsed.lootTables) ? parsed.lootTables : [],
      images: Array.isArray(parsed.images) ? parsed.images : [],
      dialogues: Array.isArray(parsed.dialogues) ? parsed.dialogues : [],
      npcs: Array.isArray(parsed.npcs) ? parsed.npcs : [],
      quests: Array.isArray(parsed.quests) ? parsed.quests : [],
      questItems: Array.isArray(parsed.questItems) ? parsed.questItems : [],
      questMarkers: Array.isArray(parsed.questMarkers) ? parsed.questMarkers : [],
      worldMap: {
        zones: Array.isArray(parsed.worldMap && parsed.worldMap.zones) ? parsed.worldMap.zones : [],
        regions: Array.isArray(parsed.worldMap && parsed.worldMap.regions) ? parsed.worldMap.regions : [],
        updatedAt: parsed.worldMap && parsed.worldMap.updatedAt ? parsed.worldMap.updatedAt : nowIso(),
      },
    };
  } catch {
    return emptyDb();
  }
}

async function main() {
  await assertPostgresConnection();

  const backendRoot = join(__dirname, '..');
  const dbPath = join(backendRoot, 'data', 'content-db.json');
  const db = loadDb(dbPath);
  const timestamp = nowIso();

  const starterItems = [
    {
      id: 'starter_sword_01',
      name: 'Starter Sword',
      type: 'weapon',
      subtype: 'sword',
      slot: 'rightHand',
      handsRequired: 1,
      rarity: 'common',
      price: 25,
      stackable: false,
      maxStack: 1,
      damageMin: 4,
      damageMax: 9,
      damageCategory: 'physical',
      physicalType: 'slash',
      requiredStats: {},
      bonuses: { strength: 1 },
      gameplayDescription: 'A reliable blade for first battles.',
      loreDescription: 'Issued to new fighters of Arklein militia.',
      imagePath: 'unknown',
      isEnabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'starter_leather_armor_01',
      name: 'Starter Leather Armor',
      type: 'armor',
      subtype: 'leather',
      slot: 'chest',
      handsRequired: 1,
      rarity: 'common',
      price: 30,
      stackable: false,
      maxStack: 1,
      armorValue: 4,
      requiredStats: {},
      bonuses: { hp: 10 },
      gameplayDescription: 'Basic armor for beginners.',
      loreDescription: 'Simple leather vest sold in Arklein market.',
      imagePath: 'unknown',
      isEnabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'starter_healing_potion_01',
      name: 'Starter Healing Potion',
      type: 'potion',
      subtype: 'healing',
      slot: 'quick',
      handsRequired: 1,
      rarity: 'common',
      price: 12,
      stackable: true,
      maxStack: 20,
      requiredStats: {},
      bonuses: {},
      gameplayDescription: 'Recovers a small amount of HP in combat.',
      loreDescription: 'Brewed by local alchemists for recruits.',
      imagePath: 'unknown',
      isEnabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  for (const item of starterItems) {
    upsertById(db.items, item);
  }

  const merchant = {
    id: 'merchant_arklein_starter',
    name: 'Borin Ironhand',
    city: 'Arklein',
    location: 'Market Square',
    type: 'general',
    description: 'Starter gear merchant for new adventurers.',
    portraitPath: '',
    priceMultiplier: 1,
    isEnabled: true,
    items: starterItems.map((item) => ({
      itemId: item.id,
      stock: 20,
      infiniteStock: true,
      priceMultiplier: 1,
      isEnabled: true,
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  upsertById(db.merchants, merchant);

  const npc = {
    id: 'npc_arklein_guard_01',
    name: 'Captain Rhea',
    title: 'City Guard Captain',
    status: 'active',
    kind: 'guard',
    race: 'human',
    description: 'Commands the city gate watch in Arklein.',
    mapBindings: [],
    dialogues: [],
    questBindings: ['quest_arklein_first_step'],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  upsertById(db.npcs, npc);

  const quest = {
    id: 'quest_arklein_first_step',
    title: 'First Step in Arklein',
    adminDescription: 'Intro quest for new players.',
    playerDescription: 'Talk to Captain Rhea and buy a starter item.',
    category: 'starter',
    status: 'active',
    cityId: 'city_arklein',
    npcId: npc.id,
    recommendedLevel: 1,
    minLevel: 1,
    maxLevel: 5,
    isRepeatable: false,
    isHidden: false,
    steps: [],
    triggers: [],
    conditions: [],
    rewards: [
      { type: 'gold', amount: 50 },
      { type: 'item', itemId: 'starter_healing_potion_01', quantity: 2 },
    ],
    failureConsequences: [],
    flags: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  upsertById(db.quests, quest);

  const cityZone = {
    id: 'city_arklein',
    name: 'Arklein',
    type: 'city',
    shape: 'circle',
    x: 0.5,
    y: 0.55,
    radius: 0.08,
    description: 'Main starter city with market and quest board.',
    tooltip: 'Arklein - Starter City',
    dangerLevel: 1,
    recommendedLevel: 1,
    requiredLevel: 1,
    isDiscovered: true,
    isVisibleToPlayer: true,
    isSafeZone: true,
    allowPvP: false,
    createdAt: nowMs(),
    updatedAt: nowMs(),
  };
  upsertZone(db.worldMap.zones, cityZone);
  db.worldMap.updatedAt = nowIso();

  writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

  console.log('[seed-admin-content] Seed completed.');
  console.log(`[seed-admin-content] Items: ${db.items.length}`);
  console.log(`[seed-admin-content] Merchants: ${db.merchants.length}`);
  console.log(`[seed-admin-content] NPCs: ${db.npcs.length}`);
  console.log(`[seed-admin-content] Quests: ${db.quests.length}`);
  console.log(`[seed-admin-content] Cities/Zones: ${db.worldMap.zones.length}`);
}

main().catch((error) => {
  console.error('[seed-admin-content] Failed:', error);
  process.exitCode = 1;
});
