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

if (!db.content) {
  db.content = {};
}
const content = db.content;

// Ensure collections exist
if (!content.items) content.items = [];
if (!content.npcs) content.npcs = [];
if (!content.dialogues) content.dialogues = [];
if (!content.merchants) content.merchants = [];
if (!content.quests) content.quests = [];
if (!content.trees) content.trees = [];
if (!content.biomes) content.biomes = [];
if (!content.worldMap) content.worldMap = { zones: [] };
if (!content.worldMap.zones) content.worldMap.zones = [];

// Helper to upsert an item
function upsertItem(item) {
  const idx = content.items.findIndex(i => i.id === item.id);
  const now = new Date().toISOString();
  const itemData = {
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
    ...item
  };
  if (idx !== -1) {
    content.items[idx] = { ...content.items[idx], ...itemData };
  } else {
    content.items.push(itemData);
  }
}

// 1. Seed Tree Log Items for each tree
const treeLogDefinitions = [
  { id: 'item_wood_log_snow_watchman', name: 'Бревно Снежного Дозорника', price: 15 },
  { id: 'item_wood_log_sand_lord', name: 'Бревно Песчаного Властелина', price: 18 },
  { id: 'item_wood_log_green_whisper', name: 'Бревно Зелёного Шёпота', price: 12 },
  { id: 'item_wood_log_golden_reaper', name: 'Бревно Золотого Жнеца', price: 20 },
  { id: 'item_wood_log_mountain_guard', name: 'Бревно Горного Стража', price: 22 },
  { id: 'item_wood_log_flame_whirl', name: 'Бревно Пламенного Вихря', price: 25 },
  { id: 'item_wood_log_steel_leaf', name: 'Бревно Сталелиста', price: 30 },
  { id: 'item_wood_log_sahara_shadow', name: 'Бревно Тени Сахары', price: 28 },
  { id: 'item_wood_log_elven_song', name: 'Бревно Эльфийской Песни', price: 35 },
  { id: 'item_wood_log_royal_cocoon', name: 'Бревно Королевской Куколки', price: 40 },
  { id: 'item_wood_log_dwarf_heart', name: 'Бревно Сердца Гнома', price: 45 },
  { id: 'item_wood_log_feralas_dance', name: 'Бревно Танца Фераласа', price: 50 },
  // Basic logs
  { id: 'item_wood_log_common', name: 'Обычное бревно', price: 5 },
  { id: 'item_tree_bark_common', name: 'Кора дерева', price: 2 },
  { id: 'item_resin_common', name: 'Смола', price: 3 },
  { id: 'item_wood_plank_common', name: 'Обычная доска', price: 8 },
  { id: 'item_wood_beam_common', name: 'Обычная балка', price: 12 },
  { id: 'item_wood_handle_common', name: 'Простая деревянная рукоять', price: 10 },
  { id: 'item_staff_core_common', name: 'Простая основа посоха', price: 15 }
];

treeLogDefinitions.forEach(log => {
  upsertItem({
    id: log.id,
    name: log.name,
    type: 'material',
    rarity: 'common',
    price: log.price,
    stackable: true,
    maxStack: 99,
    gameplayDescription: `Древесный материал: ${log.name}.`,
    loreDescription: 'Используется в деревообработке плотника.',
    imageRef: { type: 'image', src: 'material_wood_log' }
  });
});

// 2. Seed Carpenter Tools (Weapon/Profession Tool types)
const toolsToSeed = [
  // Axes
  {
    id: 'tool_woodcutting_axe_worn',
    name: 'Старый лесорубный топор',
    type: 'profession_tool',
    profession: 'carpenter',
    toolKind: 'woodcutting_axe',
    tier: 1,
    price: 35,
    durability: 60,
    maxDurability: 60,
    efficiency: 1.0,
    treeDamageBonus: 0,
    staminaCostModifier: 1.0,
    breakChanceModifier: 1.0,
    stackable: false,
    rarity: 'common',
    gameplayDescription: 'Старый лесорубный топор. Подходит для рубки простых деревьев.',
    loreDescription: 'Потертое лезвие и простая рукоять.',
    imageRef: { type: 'image', src: 'tool_axe_worn' }
  },
  {
    id: 'tool_woodcutting_axe_steel',
    name: 'Стальной топор дровосека',
    type: 'profession_tool',
    profession: 'carpenter',
    toolKind: 'woodcutting_axe',
    tier: 2,
    price: 250,
    durability: 120,
    maxDurability: 120,
    efficiency: 1.5,
    treeDamageBonus: 5,
    staminaCostModifier: 0.9,
    breakChanceModifier: 0.8,
    stackable: false,
    rarity: 'uncommon',
    gameplayDescription: 'Качественный стальной топор. Увеличивает урон по дереву.',
    loreDescription: 'Выкован из закаленной стали, отлично сбалансирован.',
    imageRef: { type: 'image', src: 'tool_axe_steel' }
  },
  // Saws
  {
    id: 'tool_saw_basic',
    name: 'Простая ручная пила',
    type: 'profession_tool',
    profession: 'carpenter',
    toolKind: 'saw',
    tier: 1,
    price: 30,
    durability: 50,
    maxDurability: 50,
    efficiency: 1.0,
    stackable: false,
    rarity: 'common',
    gameplayDescription: 'Простая ручная пила для распила брёвен на доски.',
    loreDescription: 'Обычная пила с деревянной ручкой.',
    imageRef: { type: 'image', src: 'tool_saw_basic' }
  },
  // Workshop tools
  {
    id: 'tool_planer_basic',
    name: 'Рубанок подмастерья',
    type: 'profession_tool',
    profession: 'carpenter',
    toolKind: 'planer',
    tier: 1,
    price: 45,
    durability: 60,
    maxDurability: 60,
    efficiency: 1.0,
    stackable: false,
    rarity: 'common',
    gameplayDescription: 'Применяется для строгания досок в мастерской.',
    loreDescription: 'Небольшой рубанок с ровной колодкой.',
    imageRef: { type: 'image', src: 'tool_planer_basic' }
  },
  {
    id: 'tool_chisel_basic',
    name: 'Набор стамесок',
    type: 'profession_tool',
    profession: 'carpenter',
    toolKind: 'chisel',
    tier: 1,
    price: 40,
    durability: 80,
    maxDurability: 80,
    efficiency: 1.0,
    stackable: false,
    rarity: 'common',
    gameplayDescription: 'Используется для художественной резьбы по дереву.',
    loreDescription: 'Несколько острых стамесок разной ширины.',
    imageRef: { type: 'image', src: 'tool_chisel_basic' }
  },
  {
    id: 'tool_hammer_basic',
    name: 'Столярный молоток',
    type: 'profession_tool',
    profession: 'carpenter',
    toolKind: 'hammer',
    tier: 1,
    price: 25,
    durability: 100,
    maxDurability: 100,
    efficiency: 1.0,
    stackable: false,
    rarity: 'common',
    gameplayDescription: 'Необходим для сборки конструкций в мастерской.',
    loreDescription: 'Удобный молоток с деревянной ручкой.',
    imageRef: { type: 'image', src: 'tool_hammer_basic' }
  },
  {
    id: 'tool_carving_knife_basic',
    name: 'Резчик по дереву',
    type: 'profession_tool',
    profession: 'carpenter',
    toolKind: 'carving_knife',
    tier: 1,
    price: 35,
    durability: 70,
    maxDurability: 70,
    efficiency: 1.0,
    stackable: false,
    rarity: 'common',
    gameplayDescription: 'Удобный нож для мелких деталей и заготовок.',
    loreDescription: 'Короткое, острозаточенное лезвие.',
    imageRef: { type: 'image', src: 'tool_carving_knife_basic' }
  },
  {
    id: 'tool_workbench_basic',
    name: 'Переносной верстак',
    type: 'profession_tool',
    profession: 'carpenter',
    toolKind: 'workbench',
    tier: 1,
    price: 150,
    durability: 200,
    maxDurability: 200,
    efficiency: 1.0,
    stackable: false,
    rarity: 'uncommon',
    gameplayDescription: 'Позволяет производить сборку мебели и каркасов.',
    loreDescription: 'Складной верстак с зажимами.',
    imageRef: { type: 'image', src: 'tool_workbench_basic' }
  },
  {
    id: 'tool_drying_rack_basic',
    name: 'Стойка для сушки досок',
    type: 'profession_tool',
    profession: 'carpenter',
    toolKind: 'drying_rack',
    tier: 1,
    price: 80,
    durability: 150,
    maxDurability: 150,
    efficiency: 1.0,
    stackable: false,
    rarity: 'common',
    gameplayDescription: 'Служит для сушки влажной древесины.',
    loreDescription: 'Простая решетчатая рама.',
    imageRef: { type: 'image', src: 'tool_drying_rack_basic' }
  }
];

toolsToSeed.forEach(tool => upsertItem(tool));

// 3. Seed Carts / Transport Items
const transportsToSeed = [
  {
    id: 'cart_wooden_basic',
    name: 'Простая деревянная повозка',
    type: 'profession_transport',
    profession: 'carpenter',
    transportKind: 'cart',
    price: 750,
    capacityWeight: 250,
    capacityLogs: 8,
    durability: 150,
    maxDurability: 150,
    speed: 0.9,
    requiresHorse: false,
    tier: 1,
    stackable: false,
    rarity: 'common',
    gameplayDescription: 'Простая деревянная повозка. Позволяет перевозить до 8 брёвен.',
    loreDescription: 'Скрипучая, но надежная повозка, которую нужно тянуть самому.',
    imageRef: { type: 'image', src: 'transport_cart_basic' }
  },
  {
    id: 'cart_carpenter_reinforced',
    name: 'Усиленная повозка плотника',
    type: 'profession_transport',
    profession: 'carpenter',
    transportKind: 'cart',
    price: 1500,
    capacityWeight: 400,
    capacityLogs: 12,
    durability: 250,
    maxDurability: 250,
    speed: 0.95,
    requiresHorse: false,
    tier: 2,
    stackable: false,
    rarity: 'uncommon',
    gameplayDescription: 'Усиленная железными ободами повозка. Вмещает до 12 брёвен.',
    loreDescription: 'Укрепленные борта и прочные оси выдержат солидный груз.',
    imageRef: { type: 'image', src: 'transport_cart_reinforced' }
  },
  {
    id: 'horse_cart_basic',
    name: 'Конь с простой повозкой',
    type: 'profession_transport',
    profession: 'carpenter',
    transportKind: 'horse_cart',
    price: 3000,
    capacityWeight: 800,
    capacityLogs: 20,
    durability: 400,
    maxDurability: 400,
    speed: 1.1,
    requiresHorse: true,
    tier: 3,
    stackable: false,
    rarity: 'rare',
    gameplayDescription: 'Малая конная повозка. Лимит перевозимых брёвен увеличен до 20, скорость выше.',
    loreDescription: 'Спокойная рабочая лошадь, запряженная в повозку среднего размера.',
    imageRef: { type: 'image', src: 'transport_horse_cart_basic' }
  },
  {
    id: 'horse_cart_heavy',
    name: 'Тяжёлый конь с большой повозкой',
    type: 'profession_transport',
    profession: 'carpenter',
    transportKind: 'horse_cart',
    price: 6000,
    capacityWeight: 1500,
    capacityLogs: 35,
    durability: 600,
    maxDurability: 600,
    speed: 1.2,
    requiresHorse: true,
    tier: 4,
    stackable: false,
    rarity: 'epic',
    gameplayDescription: 'Большая грузовая повозка с тяжеловозным конем. Позволяет везти до 35 брёвен.',
    loreDescription: 'Огромный тяжеловоз без труда тащит за собой целую кучу вековых стволов.',
    imageRef: { type: 'image', src: 'transport_horse_cart_heavy' }
  }
];

transportsToSeed.forEach(trans => upsertItem(trans));

// 4. Seed Trees
const treesData = [
  {
    id: 'tree_snow_watchman',
    name: 'Снежный Дозорник',
    description: 'Произрастает в вечно холодных краях, древесина очень плотная и устойчива к морозам.',
    region: 'ailassil',
    biomeIds: ['biome_ailassil_frozen_forest'],
    tier: 1,
    rarity: 'common',
    hp: 120,
    hardness: 2,
    stability: 70,
    fallRisk: 12,
    requiredWoodcuttingTier: 1,
    requiredToolTier: 1,
    baseXp: 15,
    weight: 35,
    drops: [
      { itemId: 'item_wood_log_snow_watchman', min: 1, max: 3, chance: 100 },
      { itemId: 'item_tree_bark_common', min: 0, max: 2, chance: 40 },
      { itemId: 'item_resin_common', min: 0, max: 1, chance: 20 }
    ],
    enabled: true
  },
  {
    id: 'tree_sand_lord',
    name: 'Песчаный Властелин',
    description: 'Пустынное дерево с волокнистой структурой, удерживающей редкую влагу.',
    region: 'telfaren',
    biomeIds: ['biome_telfaren_desert_woods'],
    tier: 1,
    rarity: 'common',
    hp: 110,
    hardness: 2,
    stability: 60,
    fallRisk: 10,
    requiredWoodcuttingTier: 1,
    requiredToolTier: 1,
    baseXp: 15,
    weight: 32,
    drops: [
      { itemId: 'item_wood_log_sand_lord', min: 1, max: 3, chance: 100 },
      { itemId: 'item_tree_bark_common', min: 0, max: 1, chance: 30 }
    ],
    enabled: true
  },
  {
    id: 'tree_green_whisper',
    name: 'Зелёный Шёпот',
    description: 'Молодое, гибкое лиственное дерево, характерное для умеренных зон.',
    region: 'ilaraen',
    biomeIds: ['biome_ilaraen_green_forest'],
    tier: 1,
    rarity: 'common',
    hp: 90,
    hardness: 1,
    stability: 80,
    fallRisk: 8,
    requiredWoodcuttingTier: 1,
    requiredToolTier: 1,
    baseXp: 10,
    weight: 25,
    drops: [
      { itemId: 'item_wood_log_green_whisper', min: 1, max: 3, chance: 100 },
      { itemId: 'item_resin_common', min: 0, max: 2, chance: 30 }
    ],
    enabled: true
  },
  {
    id: 'tree_golden_reaper',
    name: 'Золотой Жнец',
    description: 'Листья этого дерева отливают золотом, а древесина ценится за медовый оттенок.',
    region: 'mirilnuar',
    biomeIds: ['biome_mirilnuar_blooming_woods'],
    tier: 2,
    rarity: 'uncommon',
    hp: 160,
    hardness: 3,
    stability: 75,
    fallRisk: 15,
    requiredWoodcuttingTier: 2,
    requiredToolTier: 2,
    baseXp: 25,
    weight: 40,
    drops: [
      { itemId: 'item_wood_log_golden_reaper', min: 1, max: 2, chance: 100 },
      { itemId: 'item_tree_bark_common', min: 0, max: 2, chance: 50 },
      { itemId: 'item_resin_common', min: 0, max: 1, chance: 30 }
    ],
    enabled: true
  },
  {
    id: 'tree_mountain_guard',
    name: 'Горный Страж',
    description: 'Вековые хвойные деревья на склонах гор, закаленные сильными ветрами.',
    region: 'teramor',
    biomeIds: ['biome_teramor_mountain_forest'],
    tier: 1,
    rarity: 'common',
    hp: 120,
    hardness: 2,
    stability: 70,
    fallRisk: 12,
    requiredWoodcuttingTier: 1,
    requiredToolTier: 1,
    baseXp: 15,
    weight: 35,
    drops: [
      { itemId: 'item_wood_log_mountain_guard', min: 1, max: 3, chance: 100 },
      { itemId: 'item_tree_bark_common', min: 0, max: 2, chance: 40 },
      { itemId: 'item_resin_common', min: 0, max: 1, chance: 20 }
    ],
    enabled: true
  },
  {
    id: 'tree_flame_whirl',
    name: 'Пламенный Вихрь',
    description: 'Древесина горяча на ощупь, растет в зонах вулканической активности.',
    region: 'fire_shadows',
    biomeIds: ['biome_fire_shadows_burning_woods'],
    tier: 2,
    rarity: 'uncommon',
    hp: 180,
    hardness: 4,
    stability: 65,
    fallRisk: 18,
    requiredWoodcuttingTier: 2,
    requiredToolTier: 2,
    baseXp: 30,
    weight: 45,
    drops: [
      { itemId: 'item_wood_log_flame_whirl', min: 1, max: 2, chance: 100 },
      { itemId: 'item_resin_common', min: 1, max: 2, chance: 60 }
    ],
    enabled: true
  },
  {
    id: 'tree_steel_leaf',
    name: 'Сталелист',
    description: 'Чрезвычайно прочное дерево, чья кора тверда словно доспех.',
    region: 'teramor',
    biomeIds: ['biome_teramor_mountain_forest'],
    tier: 3,
    rarity: 'rare',
    hp: 250,
    hardness: 6,
    stability: 85,
    fallRisk: 10,
    requiredWoodcuttingTier: 3,
    requiredToolTier: 2,
    baseXp: 50,
    weight: 60,
    drops: [
      { itemId: 'item_wood_log_steel_leaf', min: 1, max: 2, chance: 100 },
      { itemId: 'item_tree_bark_common', min: 1, max: 3, chance: 50 }
    ],
    enabled: true
  },
  {
    id: 'tree_sahara_shadow',
    name: 'Тень Сахары',
    description: 'Тёмный ствол и редкая крона, выживает в суровом зное глубокой пустыни.',
    region: 'telfaren',
    biomeIds: ['biome_telfaren_desert_woods'],
    tier: 2,
    rarity: 'uncommon',
    hp: 140,
    hardness: 3,
    stability: 60,
    fallRisk: 14,
    requiredWoodcuttingTier: 2,
    requiredToolTier: 2,
    baseXp: 22,
    weight: 38,
    drops: [
      { itemId: 'item_wood_log_sahara_shadow', min: 1, max: 2, chance: 100 },
      { itemId: 'item_tree_bark_common', min: 0, max: 2, chance: 40 }
    ],
    enabled: true
  },
  {
    id: 'tree_elven_song',
    name: 'Эльфийская Песнь',
    description: 'Древнее священное дерево с прекрасным серебристым стволом, излучающим тихую мелодию.',
    region: 'mirilnuar',
    biomeIds: ['biome_mirilnuar_blooming_woods'],
    tier: 3,
    rarity: 'rare',
    hp: 200,
    hardness: 3,
    stability: 90,
    fallRisk: 5,
    requiredWoodcuttingTier: 3,
    requiredToolTier: 2,
    baseXp: 60,
    weight: 30,
    drops: [
      { itemId: 'item_wood_log_elven_song', min: 1, max: 2, chance: 100 },
      { itemId: 'item_resin_common', min: 1, max: 3, chance: 50 }
    ],
    enabled: true
  },
  {
    id: 'tree_royal_cocoon',
    name: 'Королевская Куколка',
    description: 'Редчайшее дерево, чья кора свивается словно шелк, а сок заменяет драгоценный лак.',
    region: 'ilaraen',
    biomeIds: ['biome_ilaraen_green_forest'],
    tier: 4,
    rarity: 'epic',
    hp: 300,
    hardness: 5,
    stability: 80,
    fallRisk: 15,
    requiredWoodcuttingTier: 4,
    requiredToolTier: 2,
    baseXp: 100,
    weight: 50,
    drops: [
      { itemId: 'item_wood_log_royal_cocoon', min: 1, max: 1, chance: 100 },
      { itemId: 'item_resin_common', min: 2, max: 4, chance: 80 }
    ],
    enabled: true
  },
  {
    id: 'tree_dwarf_heart',
    name: 'Сердце Гнома',
    description: 'Приземистое, невероятно толстое дерево, растущее прямо из скальных расщелин.',
    region: 'teramor',
    biomeIds: ['biome_teramor_mountain_forest'],
    tier: 2,
    rarity: 'uncommon',
    hp: 180,
    hardness: 4,
    stability: 95,
    fallRisk: 5,
    requiredWoodcuttingTier: 2,
    requiredToolTier: 2,
    baseXp: 28,
    weight: 55,
    drops: [
      { itemId: 'item_wood_log_dwarf_heart', min: 1, max: 2, chance: 100 },
      { itemId: 'item_tree_bark_common', min: 1, max: 2, chance: 60 }
    ],
    enabled: true
  },
  {
    id: 'tree_feralas_dance',
    name: 'Танец Фераласа',
    description: 'Изогнутые стволы переплетаются друг с другом, создавая узорчатые рощи.',
    region: 'ilaraen',
    biomeIds: ['biome_ilaraen_green_forest'],
    tier: 3,
    rarity: 'rare',
    hp: 220,
    hardness: 4,
    stability: 75,
    fallRisk: 20,
    requiredWoodcuttingTier: 3,
    requiredToolTier: 2,
    baseXp: 55,
    weight: 42,
    drops: [
      { itemId: 'item_wood_log_feralas_dance', min: 1, max: 2, chance: 100 },
      { itemId: 'item_tree_bark_common', min: 0, max: 2, chance: 50 },
      { itemId: 'item_resin_common', min: 0, max: 2, chance: 40 }
    ],
    enabled: true
  }
];

content.trees = treesData;
console.log('Seeded trees list.');

// 5. Seed Biomes
const biomesData = [
  {
    id: 'biome_ailassil_frozen_forest',
    name: 'Морозный лес Айлас’сила',
    region: 'ailassil',
    climate: 'arctic_tundra',
    dangerLevel: 2,
    defaultTreePool: ['tree_snow_watchman'],
    allowedResourceKinds: ['forest', 'herb', 'hunting'],
    description: 'Вечно замерзшая лесная глушь под покровительством снежных бурь.',
    enabled: true
  },
  {
    id: 'biome_telfaren_desert_woods',
    name: 'Пустынная роща Тел’фарена',
    region: 'telfaren',
    climate: 'arid_desert',
    dangerLevel: 3,
    defaultTreePool: ['tree_sand_lord', 'tree_sahara_shadow'],
    allowedResourceKinds: ['forest', 'herb'],
    description: 'Редкие рощи засухоустойчивых деревьев посреди бескрайних барханов.',
    enabled: true
  },
  {
    id: 'biome_ilaraen_green_forest',
    name: 'Зелёный лес Илар’аэна',
    region: 'ilaraen',
    climate: 'temperate_deciduous',
    dangerLevel: 1,
    defaultTreePool: ['tree_green_whisper', 'tree_feralas_dance', 'tree_royal_cocoon'],
    allowedResourceKinds: ['forest', 'herb', 'hunting'],
    description: 'Богатый жизнью лиственный лес, идеален для начинающих лесорубов.',
    enabled: true
  },
  {
    id: 'biome_mirilnuar_blooming_woods',
    name: 'Цветущий лес Мирил’нуара',
    region: 'mirilnuar',
    climate: 'subtropical_humid',
    dangerLevel: 2,
    defaultTreePool: ['tree_golden_reaper', 'tree_elven_song'],
    allowedResourceKinds: ['forest', 'herb', 'hunting'],
    description: 'Чарующий лес с золотистой листвой и редкими породами древесины.',
    enabled: true
  },
  {
    id: 'biome_teramor_mountain_forest',
    name: 'Горный лес Терамора',
    region: 'teramor',
    climate: 'mountain_temperate',
    dangerLevel: 2,
    defaultTreePool: ['tree_mountain_guard', 'tree_dwarf_heart', 'tree_steel_leaf'],
    allowedResourceKinds: ['forest', 'herb', 'hunting'],
    description: 'Горный лес с крепкими деревьями, подходящими для строительства и шахтных подпорок.',
    enabled: true
  },
  {
    id: 'biome_fire_shadows_burning_woods',
    name: 'Огненный лес Края Огненных Теней',
    region: 'fire_shadows',
    climate: 'volcanic_active',
    dangerLevel: 5,
    defaultTreePool: ['tree_flame_whirl'],
    allowedResourceKinds: ['forest', 'hunting'],
    description: 'Жаркие выжженные делянки, где растут редчайшие огнестойкие стволы.',
    enabled: true
  }
];

content.biomes = biomesData;
console.log('Seeded biomes list.');

// 6. Seed Merchant Stock and Prices
const merchantId = 'merchant_carpenter_tools_argos';
const merchantData = {
  id: merchantId,
  name: 'Товары плотника Аргоса',
  city: 'Аргос',
  cityId: 'argos',
  type: 'material_trader',
  description: 'Инструменты, расходники и повозки для дровосеков и плотников.',
  priceMultiplier: 1.0,
  isEnabled: true,
  items: [
    { itemId: 'tool_woodcutting_axe_worn', stock: 10, infiniteStock: false, isEnabled: true },
    { itemId: 'tool_woodcutting_axe_steel', stock: 2, infiniteStock: false, isEnabled: true },
    { itemId: 'tool_saw_basic', stock: 10, infiniteStock: false, isEnabled: true },
    { itemId: 'tool_planer_basic', stock: 5, infiniteStock: false, isEnabled: true },
    { itemId: 'tool_chisel_basic', stock: 5, infiniteStock: false, isEnabled: true },
    { itemId: 'tool_hammer_basic', stock: 8, infiniteStock: false, isEnabled: true },
    { itemId: 'tool_carving_knife_basic', stock: 5, infiniteStock: false, isEnabled: true },
    { itemId: 'tool_workbench_basic', stock: 2, infiniteStock: false, isEnabled: true },
    { itemId: 'tool_drying_rack_basic', stock: 4, infiniteStock: false, isEnabled: true },
    { itemId: 'cart_wooden_basic', stock: 1, infiniteStock: false, isEnabled: true },
    { itemId: 'cart_carpenter_reinforced', stock: 1, infiniteStock: false, isEnabled: true }
  ]
};

const merIdx = content.merchants.findIndex(m => m.id === merchantId);
if (merIdx !== -1) {
  content.merchants[merIdx] = merchantData;
} else {
  content.merchants.push(merchantData);
}
console.log('Seeded merchant: merchant_carpenter_tools_argos');

// 7. Update Master NPC: npc_carpenter_master_argos with services
const npcIdx = content.npcs.findIndex(n => n.id === 'npc_carpenter_master_argos');
const npcMasterData = {
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
    { dialogueId: 'dlg_carpenter_master_argos_intro', priority: 1 }
  ],
  questBindings: [
    { role: 'giver', questId: 'quest_carpenter_first_cut' }
  ],
  trainer: {
    skillIds: [],
    professionIds: ['carpenter'],
    requiresQuestIds: [],
    requiresReputation: 0,
    priceGold: 0
  },
  professionTrainer: 'carpenter',
  merchantId: merchantId,
  workshopId: 'workshop_carpenter_argos_basic',
  services: [
    'learn_profession',
    'buy_tools',
    'rent_cart',
    'buy_cart',
    'open_workshop'
  ]
};

if (npcIdx !== -1) {
  content.npcs[npcIdx] = { ...content.npcs[npcIdx], ...npcMasterData };
} else {
  content.npcs.push(npcMasterData);
}
console.log('Seeded master NPC update.');

// 8. Update Zone zone_argos_forest_west with real biome and treepool
const zoneIdx = content.worldMap.zones.findIndex(z => z.id === 'zone_argos_forest_west');
if (zoneIdx !== -1) {
  content.worldMap.zones[zoneIdx].biomeId = 'biome_teramor_mountain_forest';
  content.worldMap.zones[zoneIdx].treePool = ['tree_mountain_guard', 'tree_dwarf_heart', 'tree_steel_leaf'];
  console.log('Updated zone_argos_forest_west treepool and biome.');
}

// Save back
try {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('Database successfully seeded and updated!');
} catch (err) {
  console.error('Failed to write database:', err);
  process.exit(1);
}
