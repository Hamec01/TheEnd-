const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../apps/backend/data/theend_content.local.json');
console.log('Reading database from:', dbPath);

let db;
try {
  db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
} catch (err) {
  console.error('Failed to read database:', err);
  process.exit(1);
}

const content = db.content;

// Helper to push items if not already present
function upsertItem(item) {
  const idx = content.items.findIndex(i => i.id === item.id);
  if (idx !== -1) {
    content.items[idx] = { ...content.items[idx], ...item };
    console.log(`Updated item: ${item.id}`);
  } else {
    content.items.push(item);
    console.log(`Created item: ${item.id}`);
  }
}

// 1. Carpenter Tools
upsertItem({
  id: 'tool_woodcutting_axe_worn',
  name: 'Старый лесорубный топор',
  type: 'weapon',
  subtype: 'axe',
  slot: 'rightHand',
  handsRequired: 1,
  rarity: 'common',
  price: 50,
  stackable: false,
  maxStack: 1,
  damageMin: 4,
  damageMax: 8,
  damageCategory: 'physical',
  physicalType: 'slash',
  bonuses: {},
  profession: 'carpenter',
  toolKind: 'woodcutting_axe',
  tier: 1,
  durability: 60,
  maxDurability: 60,
  efficiency: 1.0,
  breakChanceModifier: 1.0,
  gameplayDescription: 'Старый лесорубный топор. Подходит для рубки обычных деревьев.',
  loreDescription: 'Потертое лезвие и простая рукоять. Повидал немало деревьев.',
  isEnabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

upsertItem({
  id: 'tool_saw_basic',
  name: 'Простая ручная пила',
  type: 'weapon',
  subtype: 'saw',
  slot: 'rightHand',
  handsRequired: 1,
  rarity: 'common',
  price: 30,
  stackable: false,
  maxStack: 1,
  damageMin: 1,
  damageMax: 3,
  damageCategory: 'physical',
  physicalType: 'slash',
  bonuses: {},
  profession: 'carpenter',
  toolKind: 'saw',
  tier: 1,
  durability: 50,
  maxDurability: 50,
  efficiency: 1.0,
  gameplayDescription: 'Простая ручная пила. Подходит для малого распила брёвен.',
  loreDescription: 'Обычная пила с деревянной ручкой.',
  isEnabled: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// 2. Carpenter Materials
const materials = [
  { id: 'item_wood_log_common', name: 'Обычное бревно', gameplay: 'Используется для распила на доски и балки.' },
  { id: 'item_wood_plank_common', name: 'Обычная доска', gameplay: 'Материал для столярного дела и строительных конструкций.' },
  { id: 'item_wood_beam_common', name: 'Обычная балка', gameplay: 'Тяжелый деревянный брус для перекрытий и каркасов.' },
  { id: 'item_wood_handle_common', name: 'Простая деревянная рукоять', gameplay: 'Используется как основа для инструментов и одноручного оружия.' },
  { id: 'item_staff_core_common', name: 'Простая основа посоха', gameplay: 'Длинная деревянная заготовка для создания магических посохов.' },
  { id: 'item_tree_bark_common', name: 'Кора дерева', gameplay: 'Используется в дублении кожи и алхимии.' },
  { id: 'item_resin_common', name: 'Смола', gameplay: 'Используется в алхимии, столярном деле и факелах.' },
  { id: 'item_firewood_common', name: 'Поленья', gameplay: 'Используется в качестве топлива для костра или печи.' }
];

materials.forEach(m => {
  upsertItem({
    id: m.id,
    name: m.name,
    type: 'material',
    rarity: 'common',
    price: Math.floor(Math.random() * 5) + 2,
    stackable: true,
    maxStack: 99,
    gameplayDescription: m.gameplay,
    loreDescription: 'Простой древесный материал.',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
});

// 3. NPC Master
const npcIdx = content.npcs.findIndex(n => n.id === 'npc_carpenter_master_argos');
const npcMaster = {
  id: 'npc_carpenter_master_argos',
  name: 'Мастер-плотник',
  title: 'Мастер древесного дела',
  status: 'active',
  kind: 'trainer',
  race: 'human',
  gender: 'male',
  age: '48',
  kingdomId: 'argos',
  factionId: 'argos_citizens',
  locationId: 'loc_argos_city_wood_workshop',
  homeCityId: 'argos',
  currentCityId: 'argos',
  cityLocationId: 'workshop_wood_basic',
  description: 'Мастер-плотник обучает рубке леса, распилу брёвен и обработке дерева.',
  shortDescription: 'Мастер-плотник.',
  defaultDisposition: 'friendly',
  isUnique: true,
  canRespawn: false,
  canFight: false,
  canTalk: true,
  canTrade: true,
  worldSimTrader: false,
  canTrain: true,
  canGiveQuests: true,
  dialogues: [
    {
      dialogueId: 'dlg_carpenter_master_argos_intro',
      priority: 1
    }
  ],
  questBindings: [
    {
      role: 'giver',
      questId: 'quest_carpenter_first_cut'
    }
  ],
  trainer: {
    skillIds: [],
    professionIds: [
      'carpenter'
    ],
    requiresQuestIds: [],
    requiresReputation: 0,
    priceGold: 0
  },
  professionTrainer: 'carpenter',
  traderId: 'merchant_carpenter_master',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  portraitUrl: '/assets/placeholders/npc_merchant.png',
  fullImageUrl: '/assets/placeholders/npc_merchant.png',
  iconUrl: '/assets/placeholders/npc_merchant.png',
  portraitImageRef: { type: 'image', src: '/assets/placeholders/npc_merchant.png' },
  fullImageRef: { type: 'image', src: '/assets/placeholders/npc_merchant.png' },
  iconImageRef: { type: 'image', src: '/assets/placeholders/npc_merchant.png' }
};

if (npcIdx !== -1) {
  content.npcs[npcIdx] = { ...content.npcs[npcIdx], ...npcMaster };
  console.log('Updated NPC: npc_carpenter_master_argos');
} else {
  content.npcs.push(npcMaster);
  console.log('Created NPC: npc_carpenter_master_argos');
}

// 4. Dialogue definition
const dlgIdx = content.dialogues.findIndex(d => d.id === 'dlg_carpenter_master_argos_intro');
const dialogueData = {
  id: 'dlg_carpenter_master_argos_intro',
  title: 'Мастер-плотник',
  npcId: 'npc_carpenter_master_argos',
  status: 'active',
  startNodeId: 'n_intro',
  description: 'Разговор с мастером-плотником.',
  nodes: [
    {
      id: 'n_intro',
      speaker: 'npc',
      text: 'Приветствую. Я мастер-плотник Аргоса. Интересует работа с деревом?',
      choices: [
        {
          id: 'c_about',
          text: 'Расскажи о плотницком деле.',
          nextNodeId: 'n_about'
        },
        {
          id: 'c_learn',
          text: 'Я хочу обучиться профессии плотника.',
          nextNodeId: 'n_learn'
        },
        {
          id: 'c_quest',
          text: 'Есть ли у тебя работа для меня?',
          nextNodeId: 'n_quest_offer',
          questIconMode: 'start'
        },
        {
          id: 'c_shop',
          text: 'Покажи свои товары и инструменты.',
          actions: [
            {
              id: 'a_open_shop',
              type: 'openShop'
            }
          ],
          endsDialogue: true
        },
        {
          id: 'c_leave',
          text: 'До встречи.',
          endsDialogue: true
        }
      ]
    },
    {
      id: 'n_about',
      speaker: 'npc',
      text: 'Плотник — это не просто тот, кто колотит табуретки. Это искусство превращения живого леса в надёжные доски, древки для копий, основы для посохов и прочные строительные балки. Всё начинается с хорошего топора и верного глаза.',
      choices: [
        {
          id: 'back',
          text: 'Назад.',
          nextNodeId: 'n_intro'
        }
      ]
    },
    {
      id: 'n_learn',
      speaker: 'npc',
      text: 'Обучение плотницкому ремеслу требует упорства. Я готов обучить тебя основам.\n\n(Вы получаете профессию Плотник)',
      choices: [
        {
          id: 'c_confirm_learn',
          text: 'Обучиться.',
          actions: [
            {
              id: 'a_learn_prof',
              type: 'learnProfession',
              professionId: 'carpenter'
            }
          ],
          endsDialogue: true
        },
        {
          id: 'back_learn',
          text: 'Я подумаю.',
          nextNodeId: 'n_intro'
        }
      ]
    },
    {
      id: 'n_quest_offer',
      speaker: 'npc',
      text: 'Если ты хочешь доказать, что плотницкое дело тебе по плечу, отправляйся на Западную лесную делянку Аргоса. Сруби там дерево и принеси мне 2 бревна и 4 обработанные доски.',
      choices: [
        {
          id: 'c_accept_q',
          text: 'Я сделаю это.',
          actions: [
            {
              id: 'a_start_q',
              type: 'startQuest',
              questId: 'quest_carpenter_first_cut'
            }
          ],
          endsDialogue: true,
          questIconMode: 'start'
        },
        {
          id: 'c_decline_q',
          text: 'Может быть позже.',
          nextNodeId: 'n_intro'
        }
      ]
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

if (dlgIdx !== -1) {
  content.dialogues[dlgIdx] = dialogueData;
  console.log('Updated dialogue: dlg_carpenter_master_argos_intro');
} else {
  content.dialogues.push(dialogueData);
  console.log('Created dialogue: dlg_carpenter_master_argos_intro');
}

// 5. Merchant
const merIdx = content.merchants.findIndex(m => m.id === 'merchant_carpenter_master');
const merchantData = {
  id: 'merchant_carpenter_master',
  name: 'Мастер-плотник',
  city: 'Аргос',
  cityId: 'argos',
  type: 'material_trader',
  description: 'Продажа инструментов для деревообработки.',
  priceMultiplier: 1.0,
  isEnabled: true,
  items: [
    {
      itemId: 'tool_woodcutting_axe_worn',
      infiniteStock: true,
      isEnabled: true
    },
    {
      itemId: 'tool_saw_basic',
      infiniteStock: true,
      isEnabled: true
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

if (merIdx !== -1) {
  content.merchants[merIdx] = merchantData;
  console.log('Updated merchant: merchant_carpenter_master');
} else {
  content.merchants.push(merchantData);
  console.log('Created merchant: merchant_carpenter_master');
}

// 6. Quest
const qstIdx = content.quests.findIndex(q => q.id === 'quest_carpenter_first_cut');
const questData = {
  id: 'quest_carpenter_first_cut',
  title: 'Первый сруб',
  flags: {},
  npcId: 'npc_carpenter_master_argos',
  steps: [
    {
      id: 'step_first_cut',
      order: 1,
      title: 'Первый сруб',
      questId: 'quest_carpenter_first_cut',
      objectives: [
        {
          id: 'obj_collect_logs',
          type: 'collect_item',
          itemId: 'item_wood_log_common',
          requiredCount: 2,
          description: 'Собрать бревна (2 шт.)'
        },
        {
          id: 'obj_collect_planks',
          type: 'collect_item',
          itemId: 'item_wood_plank_common',
          requiredCount: 4,
          description: 'Собрать доски (4 шт.)'
        }
      ],
      journalText: 'Мастер-плотник велел тебе срубить первое дерево, распилить его и принести 2 бревна и 4 обработанные доски.'
    }
  ],
  cityId: 'argos',
  status: 'active',
  rewards: [
    {
      id: 'rw_carpenter_first_gold',
      type: 'gold',
      amount: 150
    },
    {
      id: 'rw_carpenter_first_exp',
      type: 'experience',
      amount: 100
    }
  ],
  category: 'profession',
  imageUrl: '/assets/placeholders/npc_merchant.png',
  isHidden: false,
  minLevel: 1,
  triggers: [
    {
      id: 'trg_npc_start_carpenter',
      type: 'npc_dialogue',
      npcId: 'npc_carpenter_master_argos',
      dialogueId: 'dlg_carpenter_master_argos_intro'
    }
  ],
  bannerUrl: '/assets/placeholders/quest_banner.png',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  conditions: [],
  portraitUrl: '/assets/placeholders/unknown_portrait.png',
  isRepeatable: false,
  adminDescription: 'Introductory Carpenter quest.',
  recommendedLevel: 1,
  playerDescription: 'Срубите сосну на делянке, распилите на доски и принесите мастеру.',
  failureConsequences: [],
  portraitImageRef: { type: 'image', src: '/assets/placeholders/unknown_portrait.png' },
  imageRef: { type: 'image', src: '/assets/placeholders/npc_merchant.png' }
};

if (qstIdx !== -1) {
  content.quests[qstIdx] = questData;
  console.log('Updated quest: quest_carpenter_first_cut');
} else {
  content.quests.push(questData);
  console.log('Created quest: quest_carpenter_first_cut');
}

// 7. WorldMap Zone
const zoneIdx = content.worldMap.zones.findIndex(z => z.id === 'zone_argos_forest_west');
const zoneData = {
  id: 'zone_argos_forest_west',
  name: 'Западная лесная делянка Аргоса',
  type: 'rectangle', // rectangle zone
  editorLayer: 'resources',
  resourceKind: 'forest',
  forestId: 'forest_argos_west',
  biomeId: 'biome_temperate_military_border',
  treePool: [
    'tree_pine_common',
    'tree_oak_argos',
    'tree_dry_birch'
  ],
  woodcuttingTier: 1,
  requiresProfession: 'carpenter',
  isProfessionZone: true,
  x: 0.35,
  y: 0.52,
  width: 0.05,
  height: 0.05,
  description: 'Подходящее место для рубки сосны, дуба и березы.',
  tooltip: 'Западная лесная делянка Аргоса\nРесурс: древесина\nУровень рубки: 1\nДеревья: сосна, дуб, береза\nТребуется профессия: Плотник',
  dangerLevel: 1,
  recommendedLevel: 1,
  isDiscovered: true,
  isVisibleToPlayer: true,
  isSafeZone: true,
  allowPvP: false,
  faction: 'Аргос',
  shape: 'rectangle',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  color: '#8b5a2b' // brown/wood color
};

if (zoneIdx !== -1) {
  content.worldMap.zones[zoneIdx] = { ...content.worldMap.zones[zoneIdx], ...zoneData };
  console.log('Updated zone: zone_argos_forest_west');
} else {
  content.worldMap.zones.push(zoneData);
  console.log('Created zone: zone_argos_forest_west');
}

// Write database back
try {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('Database successfully updated!');
} catch (err) {
  console.error('Failed to write database:', err);
  process.exit(1);
}
