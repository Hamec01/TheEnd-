/**
 * Скрипт добавляет 3 торговца (NPC + merchant + dialogue) в content-db.json
 * и привязывает их к world-sim архетипам.
 *
 * Запуск: node scripts/add-worldsim-merchants.js
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../apps/backend/data/content-db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const NOW = new Date().toISOString();

// ─────────────────────────────────────────────
// 1. MERCHANTS (торговые прилавки)
// ─────────────────────────────────────────────
const newMerchants = [
  {
    id: 'merchant_luminor_rikar',
    name: 'Рикар из Люминора',
    city: 'Люминор',
    location: 'Торговый квартал',
    type: 'general',
    portraitPath: '',
    priceMultiplier: 1,
    isEnabled: true,
    items: [
      { itemId: 'arm_chest_cloth_01',    stock: 15, infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'arm_chest_leather_01',  stock: 10, infiniteStock: false, priceMultiplier: 1.1, isEnabled: true },
      { itemId: 'arm_legs_cloth_01',     stock: 15, infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'arm_head_cloth_01',     stock: 15, infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'arm_hands_leather_01',  stock: 10, infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'arm_feet_leather_01',   stock: 10, infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'acc_belt_01',           stock: 10, infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'starter_healing_potion_01', stock: 20, infiniteStock: true, priceMultiplier: 1.2, isEnabled: true },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'merchant_arklein_kirk',
    name: 'Кирк — торговец оружием',
    city: 'Архлейн',
    location: 'Пепельный рынок',
    type: 'weapons',
    portraitPath: '',
    priceMultiplier: 1.05,
    isEnabled: true,
    items: [
      { itemId: 'training_sword_wood_01', stock: 10, infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'wpn_axe_wood_01',        stock: 8,  infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'wpn_spear_wood_01',      stock: 8,  infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'wpn_spear_iron_01',      stock: 5,  infiniteStock: false, priceMultiplier: 1.1, isEnabled: true },
      { itemId: 'wpn_bow_wood_01',        stock: 8,  infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'shd_wood_01',            stock: 8,  infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'starter_sword_01',       stock: 5,  infiniteStock: false, priceMultiplier: 1.2, isEnabled: true },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'merchant_crystallis_ellian',
    name: 'Эллиан из Кристаллиса',
    city: 'Кристаллис',
    location: 'Базар у башни',
    type: 'armor',
    portraitPath: '',
    priceMultiplier: 1.1,
    isEnabled: true,
    items: [
      { itemId: 'starter_leather_armor_01', stock: 5,  infiniteStock: false, priceMultiplier: 1.2, isEnabled: true },
      { itemId: 'arm_chest_leather_01',     stock: 8,  infiniteStock: false, priceMultiplier: 1.1, isEnabled: true },
      { itemId: 'arm_legs_cloth_01',        stock: 10, infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'arm_feet_leather_01',      stock: 10, infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'arm_hands_leather_01',     stock: 10, infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'arm_head_cloth_01',        stock: 10, infiniteStock: false, priceMultiplier: 1,   isEnabled: true },
      { itemId: 'starter_healing_potion_01',stock: 10, infiniteStock: true,  priceMultiplier: 1.3, isEnabled: true },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

// ─────────────────────────────────────────────
// 2. DIALOGUES (с openShop и приветствием)
// ─────────────────────────────────────────────
const newDialogues = [
  {
    id: 'dlg_luminor_rikar_intro',
    title: 'Рикар — приветствие',
    npcId: 'npc_luminor_rikar',
    status: 'active',
    description: 'Торговец тканями и зельями из Люминора. Открывает магазин по запросу.',
    startNodeId: 'n_intro',
    nodes: [
      {
        id: 'n_intro',
        speaker: 'npc',
        text: 'Добро пожаловать! Я Рикар — лучшие ткани и зелья к вашим услугам. Что вас интересует?',
        choices: [
          {
            id: 'c_shop',
            text: 'Покажи товары.',
            endsDialogue: true,
            actions: [{ id: 'a_open_shop', type: 'openShop', merchantId: 'merchant_luminor_rikar' }],
          },
          {
            id: 'c_info',
            text: 'Что привёз с собой?',
            nextNodeId: 'n_goods_info',
          },
          {
            id: 'c_bye',
            text: 'Пока.',
            endsDialogue: true,
          },
        ],
      },
      {
        id: 'n_goods_info',
        speaker: 'npc',
        text: 'Везу из Люминора: льняные рубахи, кожаные куртки и целебные снадобья. В дороге всегда держу запас — мало ли что случится.',
        choices: [
          {
            id: 'c_shop2',
            text: 'Хочу купить.',
            endsDialogue: true,
            actions: [{ id: 'a_open_shop2', type: 'openShop', merchantId: 'merchant_luminor_rikar' }],
          },
          {
            id: 'c_bye2',
            text: 'Спасибо, не нужно.',
            endsDialogue: true,
          },
        ],
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'dlg_arklein_kirk_intro',
    title: 'Кирк — приветствие',
    npcId: 'npc_arklein_kirk',
    status: 'active',
    description: 'Торговец оружием из Архлейна. Продаёт клинки, топоры, копья.',
    startNodeId: 'n_intro',
    nodes: [
      {
        id: 'n_intro',
        speaker: 'npc',
        text: 'А, путник. Нужна сталь? У меня найдётся что-нибудь на любой кошелёк.',
        choices: [
          {
            id: 'c_shop',
            text: 'Что продаёшь?',
            endsDialogue: true,
            actions: [{ id: 'a_open_shop', type: 'openShop', merchantId: 'merchant_arklein_kirk' }],
          },
          {
            id: 'c_ask',
            text: 'Давно торгуешь здесь?',
            nextNodeId: 'n_story',
          },
          {
            id: 'c_bye',
            text: 'Не сейчас.',
            endsDialogue: true,
          },
        ],
      },
      {
        id: 'n_story',
        speaker: 'npc',
        text: 'Двадцать лет как. Отец торговал до меня, и дед до него. Пепельный рынок — это кровь Архлейна.',
        choices: [
          {
            id: 'c_shop2',
            text: 'Посмотрю, что есть.',
            endsDialogue: true,
            actions: [{ id: 'a_open_shop2', type: 'openShop', merchantId: 'merchant_arklein_kirk' }],
          },
          {
            id: 'c_bye2',
            text: 'Интересно. До встречи.',
            endsDialogue: true,
          },
        ],
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'dlg_crystallis_ellian_intro',
    title: 'Эллиан — приветствие',
    npcId: 'npc_crystallis_ellian',
    status: 'active',
    description: 'Торговка броней из Кристаллиса. Специализируется на защитном снаряжении.',
    startNodeId: 'n_intro',
    nodes: [
      {
        id: 'n_intro',
        speaker: 'npc',
        text: 'Приветствую. Эллиан к вашим услугам. Я торгую из Кристаллиса — броня и защитное снаряжение.',
        choices: [
          {
            id: 'c_shop',
            text: 'Покажи броню.',
            endsDialogue: true,
            actions: [{ id: 'a_open_shop', type: 'openShop', merchantId: 'merchant_crystallis_ellian' }],
          },
          {
            id: 'c_ask',
            text: 'Далеко ли Кристаллис отсюда?',
            nextNodeId: 'n_story',
          },
          {
            id: 'c_bye',
            text: 'Спасибо, пойду.',
            endsDialogue: true,
          },
        ],
      },
      {
        id: 'n_story',
        speaker: 'npc',
        text: 'Несколько дней пути через горный перевал. Дорога опасная, но товар того стоит. Кристаллис известен лучшими кожевниками.',
        choices: [
          {
            id: 'c_shop2',
            text: 'Хочу посмотреть товар.',
            endsDialogue: true,
            actions: [{ id: 'a_open_shop2', type: 'openShop', merchantId: 'merchant_crystallis_ellian' }],
          },
          {
            id: 'c_bye2',
            text: 'Удачной торговли.',
            endsDialogue: true,
          },
        ],
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

// ─────────────────────────────────────────────
// 3. NPCs (привязка к merchant + dialogue)
// ─────────────────────────────────────────────
const newNpcs = [
  {
    id: 'npc_luminor_rikar',
    name: 'Рикар',
    title: 'Торговец из Люминора',
    status: 'active',
    kind: 'trader',
    race: 'human',
    cityId: 'luminor',
    locationId: 'trade_district',
    description: 'Странствующий торговец из Люминора. Возит ткани, одежду и целебные зелья между городами.',
    portraitUrl: '/assets/placeholders/npc_merchant.png',
    fullImageUrl: '/assets/placeholders/npc_merchant.png',
    iconUrl: '/assets/placeholders/npc_merchant.png',
    mapBindings: [],
    defaultDisposition: 'friendly',
    isUnique: true,
    canRespawn: false,
    canFight: false,
    canTalk: true,
    canTrade: true,
    canTrain: false,
    canGiveQuests: false,
    canBeKilled: false,
    traderId: 'merchant_luminor_rikar',
    dialogues: [{ dialogueId: 'dlg_luminor_rikar_intro', priority: 1 }],
    questBindings: [],
    inventory: { itemIds: [], questItemIds: [] },
    // world-sim binding — этот ID используется в архетипе нpc_merchant_luminor_01
    worldSimArchetypeId: 'merchant_luminor_trader',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'npc_arklein_kirk',
    name: 'Кирк',
    title: 'Торговец оружием',
    status: 'active',
    kind: 'trader',
    race: 'orc',
    cityId: 'arklein',
    locationId: 'ash_market',
    description: 'Потомственный торговец оружием с Пепельного рынка Архлейна. Поставляет клинки и щиты по всему региону.',
    portraitUrl: '/assets/placeholders/npc_merchant.png',
    fullImageUrl: '/assets/placeholders/npc_merchant.png',
    iconUrl: '/assets/placeholders/npc_merchant.png',
    mapBindings: [],
    defaultDisposition: 'friendly',
    isUnique: true,
    canRespawn: false,
    canFight: false,
    canTalk: true,
    canTrade: true,
    canTrain: false,
    canGiveQuests: false,
    canBeKilled: false,
    traderId: 'merchant_arklein_kirk',
    dialogues: [{ dialogueId: 'dlg_arklein_kirk_intro', priority: 1 }],
    questBindings: [],
    inventory: { itemIds: [], questItemIds: [] },
    worldSimArchetypeId: 'merchant_arklein_trader',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'npc_crystallis_ellian',
    name: 'Эллиан',
    title: 'Торговка из Кристаллиса',
    status: 'active',
    kind: 'trader',
    race: 'high_elf',
    cityId: 'crystallis',
    locationId: 'tower_market',
    description: 'Эльфийская торговка из Кристаллиса. Специализируется на защитном снаряжении и целебных товарах.',
    portraitUrl: '/assets/placeholders/npc_merchant.png',
    fullImageUrl: '/assets/placeholders/npc_merchant.png',
    iconUrl: '/assets/placeholders/npc_merchant.png',
    mapBindings: [],
    defaultDisposition: 'friendly',
    isUnique: true,
    canRespawn: false,
    canFight: false,
    canTalk: true,
    canTrade: true,
    canTrain: false,
    canGiveQuests: false,
    canBeKilled: false,
    traderId: 'merchant_crystallis_ellian',
    dialogues: [{ dialogueId: 'dlg_crystallis_ellian_intro', priority: 1 }],
    questBindings: [],
    inventory: { itemIds: [], questItemIds: [] },
    worldSimArchetypeId: 'merchant_crystallis_trader',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

// ─────────────────────────────────────────────
// 4. WORLD-SIM ARCHETYPES (update npcTemplateId)
// ─────────────────────────────────────────────
// Already in docs/examples/living-world-merchants.json with correct IDs.
// We also update the JSON example to use real NPC IDs.

// ─────────────────────────────────────────────
// Apply changes (skip if already exists)
// ─────────────────────────────────────────────
let added = { npcs: 0, merchants: 0, dialogues: 0 };

for (const npc of newNpcs) {
  if (!db.npcs.find(x => x.id === npc.id)) {
    db.npcs.push(npc);
    added.npcs++;
  }
}
for (const m of newMerchants) {
  if (!db.merchants.find(x => x.id === m.id)) {
    db.merchants.push(m);
    added.merchants++;
  }
}
for (const d of newDialogues) {
  if (!db.dialogues.find(x => x.id === d.id)) {
    db.dialogues.push(d);
    added.dialogues++;
  }
}

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
console.log(`✅ Done! Added: ${added.npcs} NPCs, ${added.merchants} merchants, ${added.dialogues} dialogues`);
console.log('Total: npcs=' + db.npcs.length + ' merchants=' + db.merchants.length + ' dialogues=' + db.dialogues.length);
