# THEEND — Система деревьев, древесных свойств и плотника

**Файл-подготовка перед ТЗ для Copilot / агента.**  
Цель файла — зафиксировать не только идею, но и полный свод сущностей, enum-значений, template-ов, свойств, эффектов и поэтапный план внедрения так, чтобы дальше можно было разбить работу на маленькие технические задачи.

---

## 0. Главная мысль системы

Плотник должен стать не второстепенной профессией, которая просто делает доски, а полноценным центром производственной цепочки.

Правильная цепочка:

```txt
Дерево
↓
Бревно
↓
Доска / балка / кора / смола / древесный уголь
↓
Плотницкая заготовка / компонент
↓
Финальный предмет другой профессии или самостоятельный предмет плотника
```

То есть дерево больше не должно быть просто ресурсом с названием. Каждая порода дерева должна иметь свойства, которые могут наследоваться дальше:

```txt
Снежный Дозорник → холодостойкость, сохранение тепла, хрупкость ветвей
Пламенный Вихрь → огнестойкость, огненная сила, жар, опасная обработка
Сталелист → твёрдость, прочность, тяжесть
Эльфийская Песнь → гибкость, воздушность, магическая проводимость
Сердце Гнома → тяжесть, строительная прочность, устойчивость
Танец Фераласа → огонь, тьма, запретность, риск порчи
```

Плотник сохраняет или раскрывает свойства дерева. Чем выше уровень плотника, инструменты, станки, навыки и качество мини-игры, тем больше свойств переходит в результат.

Кузнец, рунорез, маг, алхимик, кожевник и другие профессии потом используют эти плотницкие компоненты.

---

## 1. Что уже есть в текущем коде и что надо учитывать

### 1.1. Уже есть рабочий контракт ItemEffect

В коде уже существуют такие типы эффектов:

```ts
export type ItemEffectType =
  | 'stat_bonus'
  | 'incoming_damage_modifier'
  | 'outgoing_damage_modifier'
  | 'armor_penetration'
  | 'crit_chance_modifier'
  | 'crit_damage_modifier'
  | 'crit_chance_taken_modifier'
  | 'lifesteal'
  | 'apply_status'
  | 'status_resistance'
  | 'status_immunity'
  | 'block_chance_modifier'
  | 'dodge_chance_modifier'
  | 'hit_chance_modifier'
  | 'extra_attack_chance';
```

У эффекта уже есть поля:

```ts
stat?: StatKey;
value?: number;
percent?: number;
flat?: number;
damageCategory?: DamageCategory;
physicalType?: PhysicalType;
elementType?: ElementType;
magicSchool?: MagicSchool;
statusId?: string;
chancePercent?: number;
durationTurns?: number;
trigger?: 'on_hit' | 'on_crit' | 'on_use' | 'on_turn_start' | 'on_turn_end' | 'always';
activationContexts?: string[];
condition?: string;
data?: Record<string, unknown>;
```

Вывод: для первого этапа лучше использовать уже существующие effect-типы, а не придумывать новые боевые модификаторы сразу.

---

### 1.2. Уже есть боевые статусы

В боевой системе уже есть реестр статусов:

```txt
stunned
knockdown
silenced
frozen
blinded
poisoned
bleeding
burning
slowed
cursed
```

Это значит, что деревянные компоненты и предметы могут давать:

```txt
status_resistance frozen
status_resistance burning
status_resistance poisoned
apply_status burning
apply_status poisoned
apply_status bleeding
```

Но осторожно: `apply_status` должен использоваться только там, где это логично. Например, обычная рукоять из Пламенного Вихря не должна сама поджигать врага. А вот посох/лук/стрела/зачарованное оружие на основе этого дерева — может.

---

### 1.3. Уже есть MaterialCraftingProperties

У материалов уже есть расширенные свойства:

```ts
physical?: MaterialPhysicalProperties;
elemental?: MaterialElementalProperties;
magical?: MaterialMagicalProperties;
alchemy?: MaterialAlchemyProperties;
blacksmith?: MaterialBlacksmithProperties;
runic?: MaterialRunicProperties;
economic?: MaterialEconomicProperties;
```

И внутри уже есть полезные поля:

```txt
hardness
flexibility
density
weight
sharpnessPotential
durability
corrosionResistance
heatResistance
coldResistance
conductivity
fragility
elasticity

firePower
waterPower
earthPower
airPower
lightPower
darkPower

magicPower
manaConductivity
spellAmplification
curseAffinity
spiritAffinity
demonAffinity
necroticAffinity
holyAffinity

healingPower
poisonPower
stimulantPower
sedativePower
painkillerPower
regenerationPower
visionPower
manaPower
toxicity
addictionRisk

runePower
instability
soulRisk
bloodCost
memoryCost
corruptionRisk
canContainSpirit
canContainDemon
canBindToItem

baseDemand
militaryDemand
foodDemand
luxuryValue
illegalValue
exportValue
```

Вывод: деревья надо подключать к этой системе, а не создавать отдельную несовместимую механику.

---

### 1.4. Сейчас у TreeDefinition нет древесных свойств

Сейчас дерево имеет примерно такой контракт:

```ts
export interface TreeDefinition {
  id: string;
  name: string;
  description?: string;
  region: string;
  biomeIds: string[];
  tier: number;
  rarity: ItemRarity;
  hp: number;
  hardness: number;
  stability: number;
  fallRisk: number;
  requiredWoodcuttingTier: number;
  requiredToolTier: number;
  baseXp: number;
  weight: number;
  drops: TreeDrop[];
  enabled: boolean;
  imageRef?: GameImageRef;
  imagePath?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

Этого достаточно для рубки, но недостаточно для крафта.

Нужно добавить:

```txt
woodProfile
traitProfile
craftingProperties
processingProfile
inheritanceRules
```

---

## 2. Новая архитектура дерева

### 2.1. TreeDefinition должен стать источником свойств

Предлагаемое расширение:

```ts
export type WoodTraitTag =
  | 'cold_resistant'
  | 'heat_resistant'
  | 'fire_affinity'
  | 'water_affinity'
  | 'earth_affinity'
  | 'air_affinity'
  | 'light_affinity'
  | 'dark_affinity'
  | 'life_affinity'
  | 'nature_affinity'
  | 'mana_conductive'
  | 'rune_friendly'
  | 'ritual_wood'
  | 'forbidden_wood'
  | 'volatile'
  | 'dense'
  | 'lightweight'
  | 'flexible'
  | 'brittle'
  | 'hard'
  | 'elastic'
  | 'resinous'
  | 'dry'
  | 'wet'
  | 'luxury'
  | 'building_grade'
  | 'weapon_grade'
  | 'bow_grade'
  | 'staff_grade'
  | 'shield_grade'
  | 'furniture_grade';
```

```ts
export interface TreeWoodProfile {
  materialTier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  defaultMaterialCategory: 'wood';
  traitTags: WoodTraitTag[];
  physical: MaterialPhysicalProperties;
  elemental?: MaterialElementalProperties;
  magical?: MaterialMagicalProperties;
  alchemy?: MaterialAlchemyProperties;
  runic?: MaterialRunicProperties;
  economic?: MaterialEconomicProperties;
  preferredComponentKinds?: CarpenterComponentKind[];
  forbiddenComponentKinds?: CarpenterComponentKind[];
  defaultInheritedEffects?: ItemEffect[];
  processingDifficultyBonus?: number;
  processingRiskBonus?: number;
  notes?: string;
}
```

```ts
export interface TreeDefinition {
  // существующие поля остаются
  id: string;
  name: string;
  description?: string;
  region: string;
  biomeIds: string[];
  tier: number;
  rarity: ItemRarity;
  hp: number;
  hardness: number;
  stability: number;
  fallRisk: number;
  requiredWoodcuttingTier: number;
  requiredToolTier: number;
  baseXp: number;
  weight: number;
  drops: TreeDrop[];
  enabled: boolean;
  imageRef?: GameImageRef;
  imagePath?: string;
  createdAt?: string;
  updatedAt?: string;

  // новые поля
  woodProfile?: TreeWoodProfile;
  sourceMaterialIds?: string[];
  defaultLogMaterialId?: string;
  defaultPlankMaterialId?: string;
  defaultBeamMaterialId?: string;
  defaultResinMaterialId?: string;
  defaultBarkMaterialId?: string;
}
```

---

## 3. Новые enum / union-типы для плотника

### 3.1. CarpenterComponentKind

Это самый важный enum для второй фазы.

```ts
export type CarpenterComponentKind =
  // базовая обработка древесины
  | 'raw_log'
  | 'clean_log'
  | 'split_log'
  | 'plank'
  | 'thin_plank'
  | 'planed_plank'
  | 'polished_plank'
  | 'beam'
  | 'support_beam'
  | 'wood_panel'
  | 'wood_strip'
  | 'wooden_pin'
  | 'wooden_rivet'
  | 'wooden_wedge'
  | 'charcoal'
  | 'bark_strip'
  | 'treated_bark'
  | 'resin'
  | 'wood_glue'

  // рукояти и древки
  | 'generic_handle'
  | 'sword_handle'
  | 'dagger_handle'
  | 'axe_haft'
  | 'hammer_handle'
  | 'mace_handle'
  | 'spear_shaft'
  | 'javelin_shaft'
  | 'polearm_shaft'
  | 'halberd_shaft'
  | 'staff_core'
  | 'wand_core'
  | 'ritual_staff_core'
  | 'rune_staff_core'

  // луки и арбалеты
  | 'bow_stave'
  | 'bow_limb'
  | 'bow_grip'
  | 'simple_bow_body'
  | 'hunting_bow_body'
  | 'war_bow_body'
  | 'longbow_body'
  | 'composite_bow_core'
  | 'crossbow_stock'
  | 'crossbow_body'
  | 'crossbow_channel'
  | 'crossbow_grip'
  | 'crossbow_reinforced_stock'

  // стрелы / болты
  | 'arrow_shaft'
  | 'arrow_shaft_bundle'
  | 'bolt_shaft'
  | 'bolt_shaft_bundle'
  | 'training_arrow'
  | 'hunting_arrow'
  | 'war_arrow'
  | 'training_bolt'
  | 'war_bolt'

  // щиты
  | 'shield_core_round'
  | 'shield_core_kite'
  | 'shield_core_tower'
  | 'shield_board'
  | 'shield_frame'
  | 'shield_grip'

  // мебель / поселения
  | 'chair_frame'
  | 'table_frame'
  | 'bed_frame'
  | 'shelf_frame'
  | 'chest_body'
  | 'wardrobe_body'
  | 'weapon_rack'
  | 'armor_stand'
  | 'training_dummy'
  | 'door_panel'
  | 'ladder_part'
  | 'cart_wheel'
  | 'barrel_body'
  | 'ship_plank'

  // магические / специальные плотницкие основы
  | 'rune_wood_plate'
  | 'ritual_board'
  | 'alchemy_shelf'
  | 'enchanting_frame'
  | 'magic_focus_frame'
  | 'totem_core'
  | 'shamanic_frame';
```

---

### 3.2. CarpenterRecipeGroup

```ts
export type CarpenterRecipeGroup =
  | 'wood_processing'
  | 'component_crafting'
  | 'weapon_components'
  | 'bows'
  | 'crossbows'
  | 'arrows_and_bolts'
  | 'staffs_and_wands'
  | 'shields'
  | 'furniture'
  | 'building_parts'
  | 'workshop_parts'
  | 'ritual_woodwork'
  | 'repair_parts'
  | 'custom_carpentry';
```

---

### 3.3. CarpenterStationType

Можно использовать существующий `CraftingStationType`, но для UI плотника лучше иметь внутренний список:

```ts
export type CarpenterStationType =
  | 'workbench'
  | 'sawmill'
  | 'drying_rack'
  | 'carving_bench'
  | 'bowyer_bench'
  | 'lathe'
  | 'assembly_table'
  | 'finishing_table'
  | 'rune_carving_table';
```

Маппинг на существующий `CraftingStationType`:

```txt
sawmill → sawmill
workbench → workbench
drying_rack → drying_rack
carving_bench → workbench
bowyer_bench → workbench
lathe → workbench
assembly_table → workbench
finishing_table → workbench
rune_carving_table → workbench / rune_table later
```

---

### 3.4. CarpenterTemplateDifficultyType

```ts
export type CarpenterTemplateDifficultyType =
  | 'simple_cut'
  | 'straight_planing'
  | 'fine_carving'
  | 'balanced_shape'
  | 'tension_work'
  | 'assembly'
  | 'rune_carving'
  | 'ritual_shaping'
  | 'dangerous_woodwork';
```

---

## 4. Новая сущность CarpenterItemTemplate

Нужен аналог `BlacksmithItemTemplate`, но под плотника.

```ts
export interface CarpenterTemplateInputSlot {
  id: string;
  label: string;
  required: boolean;
  quantity: number;
  acceptedMaterialCategories?: MaterialCategory[];
  acceptedMaterialRoles?: MaterialCraftingRole[];
  acceptedComponentKinds?: CarpenterComponentKind[];
  preferredWoodTraitTags?: WoodTraitTag[];
  forbiddenWoodTraitTags?: WoodTraitTag[];
}

export interface CarpenterTraitTransferRule {
  trait: string;
  physicalMultiplier?: number;
  elementalMultiplier?: number;
  magicalMultiplier?: number;
  runicMultiplier?: number;
  alchemyMultiplier?: number;
  economicMultiplier?: number;
  minQualityScore?: number;
  outputEffect?: ItemEffect;
}

export interface CarpenterItemTemplate {
  id: string;
  name: string;
  description?: string;
  group: CarpenterRecipeGroup;
  componentKind: CarpenterComponentKind;
  outputItemType: ItemType;
  outputSubtype?: string;
  outputSlot?: ItemSlot;
  handsRequired?: 1 | 2;
  baseDamageMin?: number;
  baseDamageMax?: number;
  baseArmorValue?: number;
  baseAttackRange?: number;
  basePrice?: number;
  requiredCarpenterLevel?: number;
  requiredSkillIds?: string[];
  stationType: CarpenterStationType;
  difficultyType: CarpenterTemplateDifficultyType;
  baseDifficulty: number;
  baseRisk: number;
  inputSlots: CarpenterTemplateInputSlot[];
  optionalSlots?: CarpenterTemplateInputSlot[];
  traitTransferRules?: CarpenterTraitTransferRule[];
  allowedFollowupProfessions?: CraftingProfessionId[];
  canBeUsedByBlacksmith?: boolean;
  canBeUsedByRunecrafter?: boolean;
  canBeUsedByEnchanter?: boolean;
  canBeUsedByAlchemist?: boolean;
  canBeFinalEquipment?: boolean;
  canAddAugmentSlots?: boolean;
  baseMaxAugmentSlots?: number;
  tags?: string[];
  imageRef?: GameImageRef;
  isEnabled: boolean;
}
```

---

## 5. Новая сущность CarpenterCraftedComponentSnapshot

Компоненты плотника должны хранить происхождение и наследованные свойства.

```ts
export interface CarpenterCraftedComponentSnapshot {
  sourceTreeId?: string;
  sourceWoodMaterialIds: string[];
  componentKind: CarpenterComponentKind;
  templateId: string;
  craftedByProfession: 'carpenter';
  craftedByCharacterId?: string;
  carpenterLevel?: number;
  qualityScore: number;
  traitRetentionPercent: number;
  inheritedTraitTags: WoodTraitTag[];
  inheritedCraftingProperties?: MaterialCraftingProperties;
  inheritedEffects?: ItemEffect[];
  workshopResult?: CarpenterWorkshopResult;
}
```

Это можно хранить:

```txt
вариант 1: внутри AdminItem как componentPayload/custom data
вариант 2: внутри ItemInstance.statOverrides / notes / tags
вариант 3: отдельная коллекция carpenterItemInstances
```

Для первого этапа проще:

```txt
создавать runtime AdminItem-like item с tags + equipmentEffects + gameplayDescription
```

Но лучше сразу заложить структуру snapshot, чтобы потом не ломать сохранения.

---

## 6. Свойства древесины: полный список для админки

### 6.1. Физические свойства

```txt
hardness — твёрдость
flexibility — гибкость
density — плотность
weight — вес
sharpnessPotential — возможность держать острую форму, важно для деревянных наконечников/кольев
durability — прочность
corrosionResistance — устойчивость к коррозии/гниению/разложению
heatResistance — сопротивление жару
coldResistance — сопротивление холоду
conductivity — проводимость, физическая/энергетическая
fragility — хрупкость
elasticity — упругость
grainStability — стабильность волокон
knotDensity — количество сучков
crackRisk — риск трещин при обработке
resinContent — смолистость
moistureRetention — удержание влаги
dryingDifficulty — сложность сушки
processingDifficulty — сложность обработки
splinterRisk — риск заноз/сколов
polishPotential — потенциал полировки
carvingPrecision — точность резьбы
bowTension — пригодность для луков
shaftStraightness — пригодность для древков/стрел
shieldIntegrity — пригодность для щитовых основ
staffBalance — пригодность для посохов
```

Часть этих полей можно пока хранить в `data`/`woodProfile`, а в `MaterialPhysicalProperties` переносить только существующие поля.

---

### 6.2. Стихийные свойства

```txt
firePower — огненная сила
waterPower — водная сила
earthPower — земляная сила
airPower — воздушная сила
lightPower — светлая сила
darkPower — тёмная сила
```

---

### 6.3. Магические свойства

```txt
magicPower — общая магическая сила
manaConductivity — проводимость маны
spellAmplification — усиление заклинаний
curseAffinity — склонность к проклятиям
spiritAffinity — связь с духами
demonAffinity — демоническая связь
necroticAffinity — связь со смертью/некротикой
holyAffinity — светлая/сакральная связь
natureAffinity — связь с природой
illusionAffinity — пригодность для иллюзий
mindAffinity — пригодность для магии разума
```

---

### 6.4. Алхимические свойства

```txt
healingPower — лечебность
poisonPower — ядовитость
stimulantPower — стимулирующий эффект
sedativePower — успокаивающий эффект
painkillerPower — обезболивание
regenerationPower — регенерация
visionPower — видение скрытого
manaPower — восстановление/усиление маны
toxicity — токсичность
addictionRisk — риск зависимости
resinAlchemyPower — сила смолы
barkMedicinePower — лечебная сила коры
```

---

### 6.5. Рунные свойства

```txt
runePower — сила для рун
instability — нестабильность
soulRisk — риск воздействия на душу
bloodCost — цена крови
memoryCost — цена памяти
corruptionRisk — риск порчи
canContainSpirit — может содержать духа
canContainDemon — может содержать демона
canBindToItem — может привязываться к предмету
runeCarvingPrecision — точность резьбы под руны
socketStability — стабильность гнезда/углубления
magicStoneGrip — способность удерживать магический камень
```

---

### 6.6. Экономические свойства

```txt
baseDemand — общий спрос
militaryDemand — военный спрос
foodDemand — пищевой/бытовой спрос
luxuryValue — роскошность
illegalValue — незаконная ценность
exportValue — экспортная ценность
craftGuildValue — ценность для ремесленных гильдий
kingdomDemand — спрос королевств
rarityPower — сила редкости
```

---

## 7. Реально подходящие эффекты для первого этапа

На первом этапе лучше использовать только уже понятные эффекты.

### 7.1. Для физических компонентов

```ts
{ type: 'stat_bonus', stat: 'constitution', value: 1, trigger: 'always' }
{ type: 'stat_bonus', stat: 'strength', value: 1, trigger: 'always' }
{ type: 'stat_bonus', stat: 'dexterity', value: 1, trigger: 'always' }
{ type: 'hit_chance_modifier', percent: 4, trigger: 'always' }
{ type: 'crit_chance_modifier', percent: 3, trigger: 'always' }
{ type: 'block_chance_modifier', percent: 5, trigger: 'always' }
{ type: 'dodge_chance_modifier', percent: 3, trigger: 'always' }
{ type: 'incoming_damage_modifier', damageCategory: 'physical', percent: -4, trigger: 'always' }
```

### 7.2. Для огня / жара

```ts
{ type: 'status_resistance', statusId: 'burning', percent: 10, trigger: 'always' }
{ type: 'incoming_damage_modifier', damageCategory: 'elemental', percent: -5, trigger: 'always' }
{ type: 'outgoing_damage_modifier', damageCategory: 'elemental', percent: 4, trigger: 'always' }
{ type: 'apply_status', statusId: 'burning', chancePercent: 8, durationTurns: 2, trigger: 'on_hit', data: { tickDamage: 2, damageCategory: 'elemental' } }
```

Важно: `outgoing_damage_modifier` сейчас лучше считать общим боевым бонусом. Строгую привязку к `elementType: 'fire'` лучше реализовать позже отдельным этапом.

### 7.3. Для холода

```ts
{ type: 'status_resistance', statusId: 'frozen', percent: 10, trigger: 'always' }
{ type: 'incoming_damage_modifier', damageCategory: 'elemental', percent: -4, trigger: 'always' }
```

### 7.4. Для яда / лечения

```ts
{ type: 'status_resistance', statusId: 'poisoned', percent: 10, trigger: 'always' }
{ type: 'status_resistance', statusId: 'bleeding', percent: 8, trigger: 'always' }
{ type: 'stat_bonus', stat: 'willpower', value: 1, trigger: 'always' }
```

### 7.5. Для тьмы / запретного дерева

```ts
{ type: 'status_resistance', statusId: 'cursed', percent: 8, trigger: 'always' }
{ type: 'apply_status', statusId: 'cursed', chancePercent: 5, durationTurns: 2, trigger: 'on_hit' }
{ type: 'outgoing_damage_modifier', damageCategory: 'magic', percent: 4, trigger: 'always' }
```

---

## 8. Профили всех деревьев

### 8.1. Снежный Дозорник

```txt
Регион: Айлас'сил
Роль: холодные земли, луки, древки, щиты против холода, походные предметы
```

```json
{
  "id": "tree_snow_sentinel",
  "traitTags": ["cold_resistant", "heat_storage", "hard", "brittle", "staff_grade", "shield_grade"],
  "physical": {
    "hardness": 58,
    "flexibility": 34,
    "density": 52,
    "weight": 50,
    "durability": 62,
    "coldResistance": 90,
    "heatResistance": 28,
    "fragility": 42,
    "elasticity": 30
  },
  "elemental": {
    "waterPower": 18,
    "airPower": 8
  },
  "magical": {
    "magicPower": 8,
    "manaConductivity": 6
  },
  "preferredComponentKinds": ["shield_core_round", "shield_core_kite", "staff_core", "arrow_shaft", "bow_stave"],
  "defaultInheritedEffects": [
    { "type": "status_resistance", "statusId": "frozen", "percent": 12, "trigger": "always" }
  ]
}
```

---

### 8.2. Песчаный Властелин

```txt
Регион: Тел'фарен
Роль: пустынные луки, лёгкие древки, походные конструкции, выживание в жаре
```

```json
{
  "id": "tree_sand_lord",
  "traitTags": ["heat_resistant", "desert", "dry", "lightweight", "bow_grade", "weapon_grade"],
  "physical": {
    "hardness": 46,
    "flexibility": 62,
    "density": 38,
    "weight": 34,
    "durability": 48,
    "heatResistance": 82,
    "coldResistance": 18,
    "fragility": 26,
    "elasticity": 58
  },
  "elemental": {
    "firePower": 10,
    "airPower": 14,
    "waterPower": 12
  },
  "economic": {
    "baseDemand": 35,
    "exportValue": 25
  },
  "preferredComponentKinds": ["bow_stave", "arrow_shaft", "spear_shaft", "javelin_shaft", "crossbow_stock"],
  "defaultInheritedEffects": [
    { "type": "status_resistance", "statusId": "burning", "percent": 8, "trigger": "always" },
    { "type": "hit_chance_modifier", "percent": 3, "trigger": "always" }
  ]
}
```

---

### 8.3. Зелёный Шёпот

```txt
Регион: Илар'аэн
Роль: охотничьи луки, учебные луки, стрелы, лёгкие посохи, природные предметы
```

```json
{
  "id": "tree_green_whisper",
  "traitTags": ["flexible", "lightweight", "nature_affinity", "air_affinity", "bow_grade", "staff_grade"],
  "physical": {
    "hardness": 34,
    "flexibility": 86,
    "density": 30,
    "weight": 28,
    "durability": 42,
    "conductivity": 34,
    "fragility": 18,
    "elasticity": 82
  },
  "elemental": {
    "airPower": 28,
    "earthPower": 8,
    "waterPower": 10
  },
  "magical": {
    "magicPower": 10,
    "manaConductivity": 18,
    "spiritAffinity": 10
  },
  "preferredComponentKinds": ["hunting_bow_body", "bow_stave", "arrow_shaft", "staff_core", "wand_core"],
  "defaultInheritedEffects": [
    { "type": "hit_chance_modifier", "percent": 5, "trigger": "always" },
    { "type": "dodge_chance_modifier", "percent": 3, "trigger": "always" }
  ]
}
```

---

### 8.4. Золотой Жнец

```txt
Регион: Мирил'нуар
Роль: дорогая мебель, лечебные предметы, посохи жизни, ритуальные доски
```

```json
{
  "id": "tree_golden_reaper",
  "traitTags": ["life_affinity", "healing", "luxury", "ritual_wood", "staff_grade", "furniture_grade"],
  "physical": {
    "hardness": 44,
    "flexibility": 54,
    "density": 42,
    "weight": 40,
    "durability": 56,
    "conductivity": 42,
    "elasticity": 48
  },
  "elemental": {
    "lightPower": 18,
    "earthPower": 8,
    "waterPower": 12
  },
  "magical": {
    "magicPower": 22,
    "manaConductivity": 20,
    "holyAffinity": 16,
    "spiritAffinity": 8
  },
  "alchemy": {
    "healingPower": 30,
    "regenerationPower": 16,
    "painkillerPower": 12,
    "toxicity": 0
  },
  "economic": {
    "luxuryValue": 60,
    "exportValue": 35
  },
  "preferredComponentKinds": ["ritual_staff_core", "rune_wood_plate", "ritual_board", "chair_frame", "table_frame", "bed_frame"],
  "defaultInheritedEffects": [
    { "type": "status_resistance", "statusId": "poisoned", "percent": 8, "trigger": "always" },
    { "type": "stat_bonus", "stat": "willpower", "value": 1, "trigger": "always" }
  ]
}
```

---

### 8.5. Горный Страж

```txt
Регион: Терамор
Роль: щиты, балки, копья, арбалетные ложа, строительство
```

```json
{
  "id": "tree_mountain_guardian",
  "traitTags": ["hard", "dense", "building_grade", "shield_grade", "weapon_grade", "earth_affinity"],
  "physical": {
    "hardness": 82,
    "flexibility": 28,
    "density": 78,
    "weight": 78,
    "durability": 88,
    "heatResistance": 42,
    "coldResistance": 46,
    "fragility": 14,
    "elasticity": 24
  },
  "elemental": {
    "earthPower": 26
  },
  "economic": {
    "militaryDemand": 45,
    "baseDemand": 40
  },
  "preferredComponentKinds": ["support_beam", "shield_core_tower", "shield_core_kite", "spear_shaft", "crossbow_stock", "hammer_handle"],
  "defaultInheritedEffects": [
    { "type": "block_chance_modifier", "percent": 5, "trigger": "always" },
    { "type": "incoming_damage_modifier", "damageCategory": "physical", "percent": -4, "trigger": "always" }
  ]
}
```

---

### 8.6. Пламенный Вихрь

```txt
Регион: Край Огненных Теней
Роль: огненные посохи, жаростойкие щиты, рукояти огненного оружия, опасная древесина
```

```json
{
  "id": "tree_flame_whirl",
  "traitTags": ["fire_affinity", "heat_resistant", "volatile", "staff_grade", "ritual_wood", "weapon_grade"],
  "physical": {
    "hardness": 54,
    "flexibility": 46,
    "density": 48,
    "weight": 46,
    "durability": 58,
    "heatResistance": 94,
    "coldResistance": 8,
    "conductivity": 52,
    "fragility": 22
  },
  "elemental": {
    "firePower": 36,
    "darkPower": 6
  },
  "magical": {
    "magicPower": 18,
    "manaConductivity": 22,
    "spellAmplification": 16
  },
  "runic": {
    "runePower": 12,
    "instability": 18,
    "corruptionRisk": 6,
    "canBindToItem": true
  },
  "preferredComponentKinds": ["staff_core", "ritual_staff_core", "wand_core", "shield_core_round", "sword_handle", "bow_stave"],
  "defaultInheritedEffects": [
    { "type": "status_resistance", "statusId": "burning", "percent": 14, "trigger": "always" },
    { "type": "outgoing_damage_modifier", "damageCategory": "elemental", "percent": 4, "trigger": "always" }
  ]
}
```

---

### 8.7. Сталелист

```txt
Регион: Айлас'сил
Роль: тяжёлые щиты, арбалеты, крепкие рукояти, военные конструкции
```

```json
{
  "id": "tree_steelleaf",
  "traitTags": ["hard", "dense", "cold_resistant", "shield_grade", "weapon_grade", "building_grade"],
  "physical": {
    "hardness": 92,
    "flexibility": 18,
    "density": 86,
    "weight": 88,
    "durability": 94,
    "coldResistance": 72,
    "heatResistance": 36,
    "fragility": 10,
    "elasticity": 14
  },
  "elemental": {
    "earthPower": 20,
    "airPower": 4
  },
  "economic": {
    "militaryDemand": 60,
    "exportValue": 40
  },
  "preferredComponentKinds": ["shield_core_tower", "crossbow_stock", "hammer_handle", "mace_handle", "support_beam"],
  "forbiddenComponentKinds": ["longbow_body", "hunting_bow_body"],
  "defaultInheritedEffects": [
    { "type": "incoming_damage_modifier", "damageCategory": "physical", "percent": -5, "trigger": "always" },
    { "type": "crit_chance_taken_modifier", "percent": -4, "trigger": "always" }
  ]
}
```

---

### 8.8. Тень Сахары

```txt
Регион: Тел'фарен
Роль: скрытные луки, пустынные древки, ритуальные доски, лёгкие предметы
```

```json
{
  "id": "tree_sahara_shadow",
  "traitTags": ["heat_resistant", "dark_affinity", "desert", "lightweight", "ritual_wood", "bow_grade"],
  "physical": {
    "hardness": 42,
    "flexibility": 68,
    "density": 34,
    "weight": 30,
    "durability": 46,
    "heatResistance": 86,
    "coldResistance": 10,
    "elasticity": 64,
    "fragility": 24
  },
  "elemental": {
    "airPower": 18,
    "darkPower": 16,
    "firePower": 8
  },
  "magical": {
    "magicPower": 12,
    "manaConductivity": 12,
    "curseAffinity": 8
  },
  "preferredComponentKinds": ["bow_stave", "hunting_bow_body", "arrow_shaft", "wand_core", "ritual_board"],
  "defaultInheritedEffects": [
    { "type": "dodge_chance_modifier", "percent": 4, "trigger": "always" },
    { "type": "hit_chance_modifier", "percent": 3, "trigger": "always" }
  ]
}
```

---

### 8.9. Эльфийская Песнь

```txt
Регион: Илар'аэн
Роль: лучшие луки, посохи воздуха/природы, жезлы, ритуальные предметы
```

```json
{
  "id": "tree_elven_song",
  "traitTags": ["air_affinity", "mana_conductive", "flexible", "bow_grade", "staff_grade", "ritual_wood"],
  "physical": {
    "hardness": 40,
    "flexibility": 94,
    "density": 32,
    "weight": 26,
    "durability": 52,
    "conductivity": 70,
    "elasticity": 90,
    "fragility": 16
  },
  "elemental": {
    "airPower": 38,
    "lightPower": 10,
    "waterPower": 8
  },
  "magical": {
    "magicPower": 28,
    "manaConductivity": 42,
    "spellAmplification": 22,
    "spiritAffinity": 16
  },
  "runic": {
    "runePower": 18,
    "instability": 4,
    "canBindToItem": true
  },
  "preferredComponentKinds": ["longbow_body", "war_bow_body", "bow_stave", "staff_core", "wand_core", "rune_staff_core"],
  "defaultInheritedEffects": [
    { "type": "hit_chance_modifier", "percent": 6, "trigger": "always" },
    { "type": "crit_chance_modifier", "percent": 3, "trigger": "always" },
    { "type": "stat_bonus", "stat": "perception", "value": 1, "trigger": "always" }
  ]
}
```

---

### 8.10. Королевская Куколка

```txt
Регион: Мирил'нуар
Роль: дворцовая мебель, дорогие рукояти, декоративные посохи, торговые предметы
```

```json
{
  "id": "tree_royal_pupa",
  "traitTags": ["luxury", "life_affinity", "light_affinity", "furniture_grade", "staff_grade"],
  "physical": {
    "hardness": 48,
    "flexibility": 50,
    "density": 44,
    "weight": 42,
    "durability": 54,
    "conductivity": 36,
    "elasticity": 46
  },
  "elemental": {
    "lightPower": 16,
    "earthPower": 8
  },
  "magical": {
    "magicPower": 14,
    "manaConductivity": 16,
    "holyAffinity": 10
  },
  "alchemy": {
    "healingPower": 14,
    "sedativePower": 8
  },
  "economic": {
    "luxuryValue": 70,
    "exportValue": 45,
    "baseDemand": 38
  },
  "preferredComponentKinds": ["chair_frame", "table_frame", "bed_frame", "shelf_frame", "sword_handle", "staff_core"],
  "defaultInheritedEffects": [
    { "type": "stat_bonus", "stat": "luck", "value": 1, "trigger": "always" },
    { "type": "stat_bonus", "stat": "willpower", "value": 1, "trigger": "always" }
  ]
}
```

---

### 8.11. Сердце Гнома

```txt
Регион: Терамор
Роль: балки, шахтные подпорки, рукояти молотов/топоров, щиты, механизмы
```

```json
{
  "id": "tree_dwarf_heart",
  "traitTags": ["dense", "hard", "building_grade", "shield_grade", "weapon_grade", "earth_affinity"],
  "physical": {
    "hardness": 88,
    "flexibility": 20,
    "density": 94,
    "weight": 96,
    "durability": 98,
    "heatResistance": 48,
    "coldResistance": 50,
    "fragility": 8,
    "elasticity": 18
  },
  "elemental": {
    "earthPower": 34
  },
  "magical": {
    "magicPower": 4,
    "manaConductivity": 2
  },
  "economic": {
    "militaryDemand": 70,
    "baseDemand": 55,
    "exportValue": 35
  },
  "preferredComponentKinds": ["support_beam", "shield_core_tower", "hammer_handle", "axe_haft", "crossbow_stock", "cart_wheel"],
  "forbiddenComponentKinds": ["wand_core", "longbow_body"],
  "defaultInheritedEffects": [
    { "type": "block_chance_modifier", "percent": 6, "trigger": "always" },
    { "type": "incoming_damage_modifier", "damageCategory": "physical", "percent": -5, "trigger": "always" },
    { "type": "stat_bonus", "stat": "constitution", "value": 1, "trigger": "always" }
  ]
}
```

---

### 8.12. Танец Фераласа

```txt
Регион: Край Огненных Теней
Роль: опасные огненные посохи, запретные ритуальные доски, огнеупорные предметы, оружие Края Огненных Теней
```

```json
{
  "id": "tree_feralas_dance",
  "traitTags": ["fire_affinity", "dark_affinity", "forbidden_wood", "volatile", "ritual_wood", "staff_grade"],
  "physical": {
    "hardness": 62,
    "flexibility": 42,
    "density": 58,
    "weight": 56,
    "durability": 66,
    "heatResistance": 100,
    "coldResistance": 0,
    "conductivity": 64,
    "fragility": 30
  },
  "elemental": {
    "firePower": 52,
    "darkPower": 28,
    "lightPower": 0
  },
  "magical": {
    "magicPower": 34,
    "manaConductivity": 30,
    "spellAmplification": 26,
    "curseAffinity": 24,
    "demonAffinity": 12
  },
  "runic": {
    "runePower": 28,
    "instability": 38,
    "soulRisk": 12,
    "bloodCost": 6,
    "memoryCost": 4,
    "corruptionRisk": 32,
    "canContainSpirit": true,
    "canContainDemon": true,
    "canBindToItem": true
  },
  "economic": {
    "illegalValue": 75,
    "exportValue": 50,
    "militaryDemand": 65
  },
  "preferredComponentKinds": ["ritual_staff_core", "rune_staff_core", "wand_core", "ritual_board", "rune_wood_plate", "totem_core"],
  "defaultInheritedEffects": [
    { "type": "status_resistance", "statusId": "burning", "percent": 20, "trigger": "always" },
    { "type": "outgoing_damage_modifier", "damageCategory": "magic", "percent": 5, "trigger": "always" },
    { "type": "apply_status", "statusId": "burning", "chancePercent": 6, "durationTurns": 2, "trigger": "on_hit", "data": { "tickDamage": 2, "damageCategory": "elemental" } }
  ],
  "processingDifficultyBonus": 18,
  "processingRiskBonus": 28
}
```

Важно: Танец Фераласа не должен быть просто лучшим деревом. Он должен давать огромный потенциал, но повышать риск брака, порчи, проклятия, нестабильности и будущих негативных эффектов.

---

## 9. Все template-ы плотника на текущий этап

Ниже максимальный набор template-ов, который стоит заложить сейчас. Не все нужно сразу подключать к UI на первом шаге, но enum/id лучше продумать заранее.

---

## 9.1. Wood processing templates

### template_carp_log_to_planks

```json
{
  "id": "template_carp_log_to_planks",
  "name": "Распилить бревно на доски",
  "group": "wood_processing",
  "componentKind": "plank",
  "stationType": "sawmill",
  "difficultyType": "straight_planing",
  "baseDifficulty": 12,
  "baseRisk": 4,
  "requiredCarpenterLevel": 1,
  "inputSlots": [
    { "id": "log", "label": "Бревно", "required": true, "quantity": 1, "acceptedComponentKinds": ["raw_log", "clean_log"] }
  ],
  "output": "4-8 досок в зависимости от качества распила"
}
```

### template_carp_log_to_beams

```json
{
  "id": "template_carp_log_to_beams",
  "name": "Распилить бревно на балки",
  "group": "wood_processing",
  "componentKind": "beam",
  "stationType": "sawmill",
  "difficultyType": "straight_planing",
  "baseDifficulty": 15,
  "baseRisk": 5,
  "requiredCarpenterLevel": 1,
  "inputSlots": [
    { "id": "log", "label": "Бревно", "required": true, "quantity": 1, "acceptedComponentKinds": ["raw_log", "clean_log"] }
  ]
}
```

### template_carp_log_to_firewood

```json
{
  "id": "template_carp_log_to_firewood",
  "name": "Наколоть дрова",
  "group": "wood_processing",
  "componentKind": "split_log",
  "stationType": "workbench",
  "difficultyType": "simple_cut",
  "baseDifficulty": 6,
  "baseRisk": 1,
  "requiredCarpenterLevel": 1
}
```

### template_carp_log_to_charcoal

```json
{
  "id": "template_carp_log_to_charcoal",
  "name": "Подготовить древесный уголь",
  "group": "wood_processing",
  "componentKind": "charcoal",
  "stationType": "drying_rack",
  "difficultyType": "simple_cut",
  "baseDifficulty": 10,
  "baseRisk": 3,
  "requiredCarpenterLevel": 1,
  "allowedFollowupProfessions": ["blacksmithing", "alchemy"]
}
```

### template_carp_plank_to_planed_plank

```json
{
  "id": "template_carp_plank_to_planed_plank",
  "name": "Выстрогать доску",
  "group": "wood_processing",
  "componentKind": "planed_plank",
  "stationType": "workbench",
  "difficultyType": "straight_planing",
  "baseDifficulty": 14,
  "baseRisk": 3,
  "requiredCarpenterLevel": 1
}
```

### template_carp_plank_to_polished_plank

```json
{
  "id": "template_carp_plank_to_polished_plank",
  "name": "Отполировать доску",
  "group": "wood_processing",
  "componentKind": "polished_plank",
  "stationType": "finishing_table",
  "difficultyType": "fine_carving",
  "baseDifficulty": 20,
  "baseRisk": 4,
  "requiredCarpenterLevel": 2
}
```

### template_carp_plank_to_thin_plank

```json
{
  "id": "template_carp_plank_to_thin_plank",
  "name": "Сделать тонкую планку",
  "group": "wood_processing",
  "componentKind": "thin_plank",
  "stationType": "workbench",
  "difficultyType": "straight_planing",
  "baseDifficulty": 18,
  "baseRisk": 6,
  "requiredCarpenterLevel": 2
}
```

### template_carp_bark_to_treated_bark

```json
{
  "id": "template_carp_bark_to_treated_bark",
  "name": "Обработать кору",
  "group": "wood_processing",
  "componentKind": "treated_bark",
  "stationType": "drying_rack",
  "difficultyType": "simple_cut",
  "baseDifficulty": 10,
  "baseRisk": 2,
  "requiredCarpenterLevel": 1,
  "allowedFollowupProfessions": ["alchemy", "leatherworking"]
}
```

### template_carp_resin_to_wood_glue

```json
{
  "id": "template_carp_resin_to_wood_glue",
  "name": "Приготовить столярную смолу",
  "group": "wood_processing",
  "componentKind": "wood_glue",
  "stationType": "workbench",
  "difficultyType": "assembly",
  "baseDifficulty": 12,
  "baseRisk": 3,
  "requiredCarpenterLevel": 1,
  "allowedFollowupProfessions": ["carpenter", "alchemy", "blacksmithing"]
}
```

---

## 9.2. Weapon component templates

### template_carp_sword_handle_basic

```json
{
  "id": "template_carp_sword_handle_basic",
  "name": "Рукоять меча",
  "group": "weapon_components",
  "componentKind": "sword_handle",
  "outputItemType": "material",
  "outputSubtype": "weapon_component",
  "stationType": "carving_bench",
  "difficultyType": "balanced_shape",
  "baseDifficulty": 18,
  "baseRisk": 5,
  "requiredCarpenterLevel": 1,
  "inputSlots": [
    { "id": "wood", "label": "Древесина", "required": true, "quantity": 1, "acceptedComponentKinds": ["planed_plank", "polished_plank", "wood_strip"] },
    { "id": "resin", "label": "Смола/клей", "required": false, "quantity": 1, "acceptedComponentKinds": ["wood_glue", "resin"] }
  ],
  "canBeUsedByBlacksmith": true,
  "traitTransferRules": [
    { "trait": "hardness", "physicalMultiplier": 0.35 },
    { "trait": "flexibility", "physicalMultiplier": 0.45 },
    { "trait": "manaConductivity", "magicalMultiplier": 0.20 }
  ]
}
```

### template_carp_dagger_handle_basic

```json
{
  "id": "template_carp_dagger_handle_basic",
  "name": "Рукоять кинжала",
  "group": "weapon_components",
  "componentKind": "dagger_handle",
  "stationType": "carving_bench",
  "difficultyType": "fine_carving",
  "baseDifficulty": 16,
  "baseRisk": 4,
  "requiredCarpenterLevel": 1,
  "canBeUsedByBlacksmith": true
}
```

### template_carp_axe_haft_basic

```json
{
  "id": "template_carp_axe_haft_basic",
  "name": "Топорище",
  "group": "weapon_components",
  "componentKind": "axe_haft",
  "stationType": "carving_bench",
  "difficultyType": "balanced_shape",
  "baseDifficulty": 20,
  "baseRisk": 6,
  "requiredCarpenterLevel": 1,
  "canBeUsedByBlacksmith": true,
  "preferredWoodTraitTags": ["hard", "dense", "weapon_grade"]
}
```

### template_carp_hammer_handle_basic

```json
{
  "id": "template_carp_hammer_handle_basic",
  "name": "Рукоять молота",
  "group": "weapon_components",
  "componentKind": "hammer_handle",
  "stationType": "carving_bench",
  "difficultyType": "balanced_shape",
  "baseDifficulty": 21,
  "baseRisk": 6,
  "requiredCarpenterLevel": 1,
  "canBeUsedByBlacksmith": true,
  "preferredWoodTraitTags": ["hard", "dense", "building_grade"]
}
```

### template_carp_mace_handle_basic

```json
{
  "id": "template_carp_mace_handle_basic",
  "name": "Рукоять булавы",
  "group": "weapon_components",
  "componentKind": "mace_handle",
  "stationType": "carving_bench",
  "difficultyType": "balanced_shape",
  "baseDifficulty": 20,
  "baseRisk": 6,
  "requiredCarpenterLevel": 1,
  "canBeUsedByBlacksmith": true
}
```

### template_carp_spear_shaft_basic

```json
{
  "id": "template_carp_spear_shaft_basic",
  "name": "Древко копья",
  "group": "weapon_components",
  "componentKind": "spear_shaft",
  "stationType": "carving_bench",
  "difficultyType": "balanced_shape",
  "baseDifficulty": 22,
  "baseRisk": 7,
  "requiredCarpenterLevel": 1,
  "canBeUsedByBlacksmith": true,
  "preferredWoodTraitTags": ["hard", "flexible", "weapon_grade"]
}
```

### template_carp_javelin_shaft_basic

```json
{
  "id": "template_carp_javelin_shaft_basic",
  "name": "Древко метательного копья",
  "group": "weapon_components",
  "componentKind": "javelin_shaft",
  "stationType": "carving_bench",
  "difficultyType": "balanced_shape",
  "baseDifficulty": 20,
  "baseRisk": 6,
  "requiredCarpenterLevel": 2,
  "canBeUsedByBlacksmith": true,
  "preferredWoodTraitTags": ["lightweight", "flexible", "weapon_grade"]
}
```

### template_carp_polearm_shaft_basic

```json
{
  "id": "template_carp_polearm_shaft_basic",
  "name": "Древко древкового оружия",
  "group": "weapon_components",
  "componentKind": "polearm_shaft",
  "stationType": "carving_bench",
  "difficultyType": "balanced_shape",
  "baseDifficulty": 25,
  "baseRisk": 8,
  "requiredCarpenterLevel": 2,
  "canBeUsedByBlacksmith": true
}
```

### template_carp_halberd_shaft_basic

```json
{
  "id": "template_carp_halberd_shaft_basic",
  "name": "Древко алебарды",
  "group": "weapon_components",
  "componentKind": "halberd_shaft",
  "stationType": "carving_bench",
  "difficultyType": "balanced_shape",
  "baseDifficulty": 28,
  "baseRisk": 9,
  "requiredCarpenterLevel": 3,
  "canBeUsedByBlacksmith": true,
  "preferredWoodTraitTags": ["hard", "dense", "weapon_grade"]
}
```

---

## 9.3. Staff and wand templates

### template_carp_staff_core_basic

```json
{
  "id": "template_carp_staff_core_basic",
  "name": "Основа посоха",
  "group": "staffs_and_wands",
  "componentKind": "staff_core",
  "outputItemType": "weapon",
  "outputSubtype": "staff_core",
  "outputSlot": "rightHand",
  "handsRequired": 2,
  "baseDamageMin": 1,
  "baseDamageMax": 3,
  "baseAttackRange": 1,
  "stationType": "carving_bench",
  "difficultyType": "balanced_shape",
  "baseDifficulty": 22,
  "baseRisk": 6,
  "requiredCarpenterLevel": 1,
  "canBeFinalEquipment": true,
  "canBeUsedByRunecrafter": true,
  "canBeUsedByEnchanter": true,
  "baseMaxAugmentSlots": 1,
  "canAddAugmentSlots": true,
  "preferredWoodTraitTags": ["staff_grade", "mana_conductive", "ritual_wood"]
}
```

### template_carp_wand_core_basic

```json
{
  "id": "template_carp_wand_core_basic",
  "name": "Основа жезла",
  "group": "staffs_and_wands",
  "componentKind": "wand_core",
  "outputItemType": "weapon",
  "outputSubtype": "wand_core",
  "outputSlot": "rightHand",
  "handsRequired": 1,
  "baseDamageMin": 1,
  "baseDamageMax": 2,
  "baseAttackRange": 3,
  "stationType": "carving_bench",
  "difficultyType": "fine_carving",
  "baseDifficulty": 24,
  "baseRisk": 7,
  "requiredCarpenterLevel": 2,
  "canBeFinalEquipment": true,
  "canBeUsedByRunecrafter": true,
  "canBeUsedByEnchanter": true,
  "baseMaxAugmentSlots": 1,
  "canAddAugmentSlots": true,
  "preferredWoodTraitTags": ["mana_conductive", "staff_grade"]
}
```

### template_carp_ritual_staff_core

```json
{
  "id": "template_carp_ritual_staff_core",
  "name": "Ритуальная основа посоха",
  "group": "ritual_woodwork",
  "componentKind": "ritual_staff_core",
  "outputItemType": "weapon",
  "outputSubtype": "ritual_staff_core",
  "outputSlot": "rightHand",
  "handsRequired": 2,
  "baseDamageMin": 1,
  "baseDamageMax": 4,
  "baseAttackRange": 2,
  "stationType": "rune_carving_table",
  "difficultyType": "ritual_shaping",
  "baseDifficulty": 34,
  "baseRisk": 12,
  "requiredCarpenterLevel": 4,
  "canBeFinalEquipment": true,
  "canBeUsedByRunecrafter": true,
  "canBeUsedByEnchanter": true,
  "baseMaxAugmentSlots": 2,
  "canAddAugmentSlots": true,
  "preferredWoodTraitTags": ["ritual_wood", "mana_conductive", "rune_friendly"]
}
```

### template_carp_rune_staff_core

```json
{
  "id": "template_carp_rune_staff_core",
  "name": "Основа посоха под руны",
  "group": "ritual_woodwork",
  "componentKind": "rune_staff_core",
  "outputItemType": "weapon",
  "outputSubtype": "rune_staff_core",
  "outputSlot": "rightHand",
  "handsRequired": 2,
  "baseDamageMin": 1,
  "baseDamageMax": 4,
  "baseAttackRange": 2,
  "stationType": "rune_carving_table",
  "difficultyType": "rune_carving",
  "baseDifficulty": 38,
  "baseRisk": 14,
  "requiredCarpenterLevel": 5,
  "canBeFinalEquipment": true,
  "canBeUsedByRunecrafter": true,
  "canBeUsedByEnchanter": true,
  "baseMaxAugmentSlots": 2,
  "canAddAugmentSlots": true,
  "preferredWoodTraitTags": ["rune_friendly", "mana_conductive", "ritual_wood"]
}
```

---

## 9.4. Bow templates

### template_carp_bow_stave

```json
{
  "id": "template_carp_bow_stave",
  "name": "Заготовка лука",
  "group": "bows",
  "componentKind": "bow_stave",
  "outputItemType": "material",
  "outputSubtype": "bow_component",
  "stationType": "bowyer_bench",
  "difficultyType": "tension_work",
  "baseDifficulty": 22,
  "baseRisk": 7,
  "requiredCarpenterLevel": 1,
  "canBeUsedByBlacksmith": false,
  "preferredWoodTraitTags": ["flexible", "bow_grade", "air_affinity"]
}
```

### template_carp_simple_bow

```json
{
  "id": "template_carp_simple_bow",
  "name": "Простой лук",
  "group": "bows",
  "componentKind": "simple_bow_body",
  "outputItemType": "weapon",
  "outputSubtype": "bow",
  "outputSlot": "rightHand",
  "handsRequired": 2,
  "baseDamageMin": 2,
  "baseDamageMax": 5,
  "baseAttackRange": 5,
  "stationType": "bowyer_bench",
  "difficultyType": "tension_work",
  "baseDifficulty": 24,
  "baseRisk": 8,
  "requiredCarpenterLevel": 1,
  "canBeFinalEquipment": true,
  "canBeUsedByBlacksmith": true,
  "canBeUsedByRunecrafter": true,
  "baseMaxAugmentSlots": 1,
  "canAddAugmentSlots": true
}
```

### template_carp_hunting_bow

```json
{
  "id": "template_carp_hunting_bow",
  "name": "Охотничий лук",
  "group": "bows",
  "componentKind": "hunting_bow_body",
  "outputItemType": "weapon",
  "outputSubtype": "bow",
  "outputSlot": "rightHand",
  "handsRequired": 2,
  "baseDamageMin": 3,
  "baseDamageMax": 7,
  "baseAttackRange": 6,
  "stationType": "bowyer_bench",
  "difficultyType": "tension_work",
  "baseDifficulty": 28,
  "baseRisk": 9,
  "requiredCarpenterLevel": 2,
  "canBeFinalEquipment": true,
  "canBeUsedByBlacksmith": true,
  "canBeUsedByRunecrafter": true,
  "baseMaxAugmentSlots": 1,
  "canAddAugmentSlots": true,
  "preferredWoodTraitTags": ["flexible", "lightweight", "bow_grade"]
}
```

### template_carp_war_bow

```json
{
  "id": "template_carp_war_bow",
  "name": "Боевой лук",
  "group": "bows",
  "componentKind": "war_bow_body",
  "outputItemType": "weapon",
  "outputSubtype": "bow",
  "outputSlot": "rightHand",
  "handsRequired": 2,
  "baseDamageMin": 5,
  "baseDamageMax": 10,
  "baseAttackRange": 6,
  "stationType": "bowyer_bench",
  "difficultyType": "tension_work",
  "baseDifficulty": 34,
  "baseRisk": 12,
  "requiredCarpenterLevel": 3,
  "canBeFinalEquipment": true,
  "canBeUsedByBlacksmith": true,
  "canBeUsedByRunecrafter": true,
  "baseMaxAugmentSlots": 2,
  "canAddAugmentSlots": true,
  "preferredWoodTraitTags": ["flexible", "hard", "bow_grade", "weapon_grade"]
}
```

### template_carp_longbow

```json
{
  "id": "template_carp_longbow",
  "name": "Длинный лук",
  "group": "bows",
  "componentKind": "longbow_body",
  "outputItemType": "weapon",
  "outputSubtype": "bow",
  "outputSlot": "rightHand",
  "handsRequired": 2,
  "baseDamageMin": 6,
  "baseDamageMax": 12,
  "baseAttackRange": 8,
  "stationType": "bowyer_bench",
  "difficultyType": "tension_work",
  "baseDifficulty": 42,
  "baseRisk": 15,
  "requiredCarpenterLevel": 5,
  "canBeFinalEquipment": true,
  "canBeUsedByBlacksmith": true,
  "canBeUsedByRunecrafter": true,
  "baseMaxAugmentSlots": 2,
  "canAddAugmentSlots": true,
  "preferredWoodTraitTags": ["flexible", "air_affinity", "bow_grade"]
}
```

### template_carp_composite_bow_core

```json
{
  "id": "template_carp_composite_bow_core",
  "name": "Основа составного лука",
  "group": "bows",
  "componentKind": "composite_bow_core",
  "outputItemType": "weapon",
  "outputSubtype": "bow",
  "outputSlot": "rightHand",
  "handsRequired": 2,
  "baseDamageMin": 7,
  "baseDamageMax": 13,
  "baseAttackRange": 7,
  "stationType": "bowyer_bench",
  "difficultyType": "assembly",
  "baseDifficulty": 48,
  "baseRisk": 18,
  "requiredCarpenterLevel": 6,
  "canBeFinalEquipment": true,
  "canBeUsedByBlacksmith": true,
  "canBeUsedByRunecrafter": true,
  "baseMaxAugmentSlots": 2,
  "canAddAugmentSlots": true,
  "inputSlots": [
    { "id": "bow_stave", "label": "Заготовка лука", "required": true, "quantity": 1, "acceptedComponentKinds": ["bow_stave"] },
    { "id": "reinforcement", "label": "Усиливающий материал", "required": false, "quantity": 1, "acceptedMaterialCategories": ["leather", "bone", "metal"] },
    { "id": "glue", "label": "Столярная смола", "required": true, "quantity": 1, "acceptedComponentKinds": ["wood_glue", "resin"] }
  ]
}
```

---

## 9.5. Crossbow templates

### template_carp_crossbow_stock

```json
{
  "id": "template_carp_crossbow_stock",
  "name": "Ложе арбалета",
  "group": "crossbows",
  "componentKind": "crossbow_stock",
  "outputItemType": "material",
  "outputSubtype": "crossbow_component",
  "stationType": "carving_bench",
  "difficultyType": "balanced_shape",
  "baseDifficulty": 26,
  "baseRisk": 8,
  "requiredCarpenterLevel": 2,
  "canBeUsedByBlacksmith": true,
  "preferredWoodTraitTags": ["hard", "dense", "weapon_grade"]
}
```

### template_carp_crossbow_body

```json
{
  "id": "template_carp_crossbow_body",
  "name": "Деревянный корпус арбалета",
  "group": "crossbows",
  "componentKind": "crossbow_body",
  "outputItemType": "material",
  "outputSubtype": "crossbow_component",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 32,
  "baseRisk": 10,
  "requiredCarpenterLevel": 3,
  "canBeUsedByBlacksmith": true
}
```

### template_carp_simple_crossbow

```json
{
  "id": "template_carp_simple_crossbow",
  "name": "Простой арбалет",
  "group": "crossbows",
  "componentKind": "crossbow_body",
  "outputItemType": "weapon",
  "outputSubtype": "crossbow",
  "outputSlot": "rightHand",
  "handsRequired": 2,
  "baseDamageMin": 6,
  "baseDamageMax": 12,
  "baseAttackRange": 6,
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 42,
  "baseRisk": 16,
  "requiredCarpenterLevel": 4,
  "canBeFinalEquipment": true,
  "canBeUsedByBlacksmith": true,
  "baseMaxAugmentSlots": 1,
  "canAddAugmentSlots": true,
  "inputSlots": [
    { "id": "stock", "label": "Ложе арбалета", "required": true, "quantity": 1, "acceptedComponentKinds": ["crossbow_stock"] },
    { "id": "body", "label": "Корпус/направляющая", "required": true, "quantity": 1, "acceptedComponentKinds": ["crossbow_body", "crossbow_channel"] },
    { "id": "mechanism", "label": "Простой механизм", "required": false, "quantity": 1, "acceptedMaterialCategories": ["metal"] }
  ]
}
```

Примечание: полноценный боевой арбалет лучше делать совместно с кузнецом. Плотник делает деревянную часть, кузнец усиливает механизм.

---

## 9.6. Arrow and bolt templates

### template_carp_arrow_shaft_bundle

```json
{
  "id": "template_carp_arrow_shaft_bundle",
  "name": "Древки стрел",
  "group": "arrows_and_bolts",
  "componentKind": "arrow_shaft_bundle",
  "outputItemType": "material",
  "outputSubtype": "arrow_component",
  "stationType": "carving_bench",
  "difficultyType": "straight_planing",
  "baseDifficulty": 14,
  "baseRisk": 3,
  "requiredCarpenterLevel": 1,
  "canBeUsedByBlacksmith": true,
  "preferredWoodTraitTags": ["lightweight", "shaftStraightness", "bow_grade"]
}
```

### template_carp_bolt_shaft_bundle

```json
{
  "id": "template_carp_bolt_shaft_bundle",
  "name": "Древки болтов",
  "group": "arrows_and_bolts",
  "componentKind": "bolt_shaft_bundle",
  "outputItemType": "material",
  "outputSubtype": "bolt_component",
  "stationType": "carving_bench",
  "difficultyType": "straight_planing",
  "baseDifficulty": 16,
  "baseRisk": 4,
  "requiredCarpenterLevel": 1,
  "canBeUsedByBlacksmith": true,
  "preferredWoodTraitTags": ["hard", "shaftStraightness", "weapon_grade"]
}
```

### template_carp_training_arrows

```json
{
  "id": "template_carp_training_arrows",
  "name": "Учебные стрелы",
  "group": "arrows_and_bolts",
  "componentKind": "training_arrow",
  "outputItemType": "weapon",
  "outputSubtype": "arrow",
  "baseDamageMin": 1,
  "baseDamageMax": 2,
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 12,
  "baseRisk": 2,
  "requiredCarpenterLevel": 1,
  "canBeFinalEquipment": true,
  "stackable": true
}
```

### template_carp_hunting_arrows

```json
{
  "id": "template_carp_hunting_arrows",
  "name": "Охотничьи стрелы",
  "group": "arrows_and_bolts",
  "componentKind": "hunting_arrow",
  "outputItemType": "weapon",
  "outputSubtype": "arrow",
  "baseDamageMin": 2,
  "baseDamageMax": 4,
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 18,
  "baseRisk": 4,
  "requiredCarpenterLevel": 2,
  "canBeFinalEquipment": true,
  "canBeUsedByBlacksmith": true,
  "stackable": true
}
```

### template_carp_war_arrows

```json
{
  "id": "template_carp_war_arrows",
  "name": "Боевые стрелы",
  "group": "arrows_and_bolts",
  "componentKind": "war_arrow",
  "outputItemType": "weapon",
  "outputSubtype": "arrow",
  "baseDamageMin": 3,
  "baseDamageMax": 6,
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 26,
  "baseRisk": 7,
  "requiredCarpenterLevel": 3,
  "canBeFinalEquipment": true,
  "canBeUsedByBlacksmith": true,
  "stackable": true
}
```

---

## 9.7. Shield templates

### template_carp_round_shield_core

```json
{
  "id": "template_carp_round_shield_core",
  "name": "Круглая щитовая основа",
  "group": "shields",
  "componentKind": "shield_core_round",
  "outputItemType": "material",
  "outputSubtype": "shield_component",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 22,
  "baseRisk": 6,
  "requiredCarpenterLevel": 1,
  "canBeUsedByBlacksmith": true,
  "preferredWoodTraitTags": ["hard", "shield_grade"]
}
```

### template_carp_kite_shield_core

```json
{
  "id": "template_carp_kite_shield_core",
  "name": "Каплевидная щитовая основа",
  "group": "shields",
  "componentKind": "shield_core_kite",
  "outputItemType": "material",
  "outputSubtype": "shield_component",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 28,
  "baseRisk": 8,
  "requiredCarpenterLevel": 2,
  "canBeUsedByBlacksmith": true,
  "preferredWoodTraitTags": ["hard", "dense", "shield_grade"]
}
```

### template_carp_tower_shield_core

```json
{
  "id": "template_carp_tower_shield_core",
  "name": "Основа башенного щита",
  "group": "shields",
  "componentKind": "shield_core_tower",
  "outputItemType": "material",
  "outputSubtype": "shield_component",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 36,
  "baseRisk": 12,
  "requiredCarpenterLevel": 4,
  "canBeUsedByBlacksmith": true,
  "preferredWoodTraitTags": ["hard", "dense", "shield_grade", "building_grade"]
}
```

### template_carp_wooden_shield_basic

```json
{
  "id": "template_carp_wooden_shield_basic",
  "name": "Деревянный щит",
  "group": "shields",
  "componentKind": "shield_core_round",
  "outputItemType": "armor",
  "outputSubtype": "shield",
  "outputSlot": "leftHand",
  "handsRequired": 1,
  "baseArmorValue": 3,
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 24,
  "baseRisk": 6,
  "requiredCarpenterLevel": 1,
  "canBeFinalEquipment": true,
  "canBeUsedByBlacksmith": true,
  "baseMaxAugmentSlots": 1,
  "canAddAugmentSlots": true
}
```

---

## 9.8. Furniture and settlement templates

### template_carp_chair_frame

```json
{
  "id": "template_carp_chair_frame",
  "name": "Каркас стула",
  "group": "furniture",
  "componentKind": "chair_frame",
  "outputItemType": "misc",
  "outputSubtype": "furniture",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 12,
  "baseRisk": 2,
  "requiredCarpenterLevel": 1,
  "preferredWoodTraitTags": ["furniture_grade", "luxury"]
}
```

### template_carp_table_frame

```json
{
  "id": "template_carp_table_frame",
  "name": "Каркас стола",
  "group": "furniture",
  "componentKind": "table_frame",
  "outputItemType": "misc",
  "outputSubtype": "furniture",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 14,
  "baseRisk": 3,
  "requiredCarpenterLevel": 1
}
```

### template_carp_bed_frame

```json
{
  "id": "template_carp_bed_frame",
  "name": "Каркас кровати",
  "group": "furniture",
  "componentKind": "bed_frame",
  "outputItemType": "misc",
  "outputSubtype": "furniture",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 18,
  "baseRisk": 4,
  "requiredCarpenterLevel": 1
}
```

### template_carp_chest_body

```json
{
  "id": "template_carp_chest_body",
  "name": "Деревянный сундук",
  "group": "furniture",
  "componentKind": "chest_body",
  "outputItemType": "misc",
  "outputSubtype": "container",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 22,
  "baseRisk": 5,
  "requiredCarpenterLevel": 2
}
```

### template_carp_weapon_rack

```json
{
  "id": "template_carp_weapon_rack",
  "name": "Стойка для оружия",
  "group": "furniture",
  "componentKind": "weapon_rack",
  "outputItemType": "misc",
  "outputSubtype": "workshop_furniture",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 24,
  "baseRisk": 6,
  "requiredCarpenterLevel": 2,
  "allowedFollowupProfessions": ["blacksmithing"]
}
```

### template_carp_training_dummy

```json
{
  "id": "template_carp_training_dummy",
  "name": "Тренировочный манекен",
  "group": "furniture",
  "componentKind": "training_dummy",
  "outputItemType": "misc",
  "outputSubtype": "training_object",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 26,
  "baseRisk": 6,
  "requiredCarpenterLevel": 2
}
```

### template_carp_door_panel

```json
{
  "id": "template_carp_door_panel",
  "name": "Дверная панель",
  "group": "building_parts",
  "componentKind": "door_panel",
  "outputItemType": "misc",
  "outputSubtype": "building_part",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 18,
  "baseRisk": 4,
  "requiredCarpenterLevel": 1
}
```

### template_carp_ladder_part

```json
{
  "id": "template_carp_ladder_part",
  "name": "Часть лестницы",
  "group": "building_parts",
  "componentKind": "ladder_part",
  "outputItemType": "misc",
  "outputSubtype": "building_part",
  "stationType": "assembly_table",
  "difficultyType": "assembly",
  "baseDifficulty": 16,
  "baseRisk": 3,
  "requiredCarpenterLevel": 1
}
```

### template_carp_cart_wheel

```json
{
  "id": "template_carp_cart_wheel",
  "name": "Колесо телеги",
  "group": "building_parts",
  "componentKind": "cart_wheel",
  "outputItemType": "misc",
  "outputSubtype": "transport_part",
  "stationType": "assembly_table",
  "difficultyType": "balanced_shape",
  "baseDifficulty": 30,
  "baseRisk": 8,
  "requiredCarpenterLevel": 3
}
```

### template_carp_ship_plank

```json
{
  "id": "template_carp_ship_plank",
  "name": "Корабельная доска",
  "group": "building_parts",
  "componentKind": "ship_plank",
  "outputItemType": "misc",
  "outputSubtype": "ship_part",
  "stationType": "sawmill",
  "difficultyType": "straight_planing",
  "baseDifficulty": 28,
  "baseRisk": 8,
  "requiredCarpenterLevel": 3,
  "preferredWoodTraitTags": ["durable", "water_affinity", "building_grade"]
}
```

---

## 9.9. Ritual / rune woodwork templates

### template_carp_rune_wood_plate

```json
{
  "id": "template_carp_rune_wood_plate",
  "name": "Деревянная пластина под руны",
  "group": "ritual_woodwork",
  "componentKind": "rune_wood_plate",
  "outputItemType": "material",
  "outputSubtype": "rune_component",
  "stationType": "rune_carving_table",
  "difficultyType": "rune_carving",
  "baseDifficulty": 30,
  "baseRisk": 10,
  "requiredCarpenterLevel": 3,
  "canBeUsedByRunecrafter": true,
  "preferredWoodTraitTags": ["rune_friendly", "mana_conductive", "ritual_wood"]
}
```

### template_carp_ritual_board

```json
{
  "id": "template_carp_ritual_board",
  "name": "Ритуальная доска",
  "group": "ritual_woodwork",
  "componentKind": "ritual_board",
  "outputItemType": "material",
  "outputSubtype": "ritual_component",
  "stationType": "rune_carving_table",
  "difficultyType": "ritual_shaping",
  "baseDifficulty": 34,
  "baseRisk": 12,
  "requiredCarpenterLevel": 4,
  "canBeUsedByRunecrafter": true,
  "canBeUsedByEnchanter": true,
  "preferredWoodTraitTags": ["ritual_wood", "dark_affinity", "light_affinity", "life_affinity"]
}
```

### template_carp_magic_focus_frame

```json
{
  "id": "template_carp_magic_focus_frame",
  "name": "Деревянная рама магического фокуса",
  "group": "ritual_woodwork",
  "componentKind": "magic_focus_frame",
  "outputItemType": "material",
  "outputSubtype": "magic_component",
  "stationType": "rune_carving_table",
  "difficultyType": "fine_carving",
  "baseDifficulty": 36,
  "baseRisk": 12,
  "requiredCarpenterLevel": 4,
  "canBeUsedByRunecrafter": true,
  "canBeUsedByEnchanter": true,
  "preferredWoodTraitTags": ["mana_conductive", "ritual_wood", "staff_grade"]
}
```

### template_carp_totem_core

```json
{
  "id": "template_carp_totem_core",
  "name": "Основа тотема",
  "group": "ritual_woodwork",
  "componentKind": "totem_core",
  "outputItemType": "material",
  "outputSubtype": "shamanic_component",
  "stationType": "carving_bench",
  "difficultyType": "ritual_shaping",
  "baseDifficulty": 32,
  "baseRisk": 10,
  "requiredCarpenterLevel": 3,
  "canBeUsedByRunecrafter": true,
  "preferredWoodTraitTags": ["spirit", "nature_affinity", "ritual_wood"]
}
```

---

## 10. Как луки, арбалеты и посохи должны делиться между профессиями

### 10.1. Луки

Плотник делает полностью:

```txt
заготовка лука
простой лук
охотничий лук
боевой лук
длинный лук
составной лук
```

Кузнец может дорабатывать:

```txt
металлические накладки
усиление рукояти
боевые наконечники стрел
усиленные крепления
```

Рунорез / маг может делать:

```txt
руны ветра
руны точности
стихийное зачарование
магическую тетиву
```

---

### 10.2. Стрелы

Плотник делает:

```txt
древки стрел
учебные стрелы
охотничьи стрелы
древки болтов
```

Кузнец делает:

```txt
металлические наконечники стрел
бронебойные наконечники
наконечники болтов
```

Алхимик делает:

```txt
ядовитое покрытие
горючее покрытие
смоляное покрытие
усыпляющий состав
```

---

### 10.3. Посохи

Плотник делает:

```txt
основа посоха
основа жезла
ритуальный посох-основа
основа под руны
```

Но это ещё не полноценный магический предмет.

Рунорез / маг потом добавляют:

```txt
руны
камни
зачарование
магический фокус
```

---

### 10.4. Арбалеты

На раннем этапе:

```txt
плотник создаёт простой арбалет
кузнец может его усилить
```

В будущем:

```txt
плотник делает деревянное ложе и корпус
кузнец делает спусковой механизм и металлические детали
инженер/гномий мастер делает сложный механизм
```

---

## 11. Интеграция с кузнецом

### 11.1. Что нужно убрать у кузнеца

Кузнец не должен сам делать:

```txt
деревянный меч
деревянное копьё
деревянный щит без металла
обычный лук
обычные стрелы
обычные посохи
древки
рукояти
щитовые деревянные основы
```

### 11.2. Что оставить кузнецу

Кузнец должен делать:

```txt
лезвие меча
лезвие топора
наконечник копья
наконечник алебарды
наконечники стрел
наконечники болтов
металлическая оковка щита
заклёпки
арбалетный механизм
металлические усилители лука/арбалета
```

### 11.3. Новый принцип рецептов кузнеца

Было:

```txt
железо + дерево → меч
```

Должно стать:

```txt
железный клинок + рукоять меча плотника + кожаная обмотка → меч
```

Было:

```txt
металл + дерево → копьё
```

Должно стать:

```txt
наконечник копья + древко копья плотника → копьё
```

Было:

```txt
металл + дерево → щит
```

Должно стать:

```txt
щитовая основа плотника + металлическая оковка + кожаный ремень → щит
```

---

## 12. Мастерские в городах

На первом этапе игрок должен иметь доступ к мастерской через город/локацию.

Пример city location/service:

```json
{
  "id": "city_location_carpenter_workshop",
  "name": "Мастерская плотника",
  "type": "workshop",
  "services": ["carpenter_workshop"],
  "stationTypes": ["workbench", "sawmill", "drying_rack"],
  "isEnabled": true
}
```

У городской мастерской должны быть ограничения:

```txt
доступны только базовые рецепты
нельзя делать запретные ритуальные предметы
сложные template-ы требуют высокий уровень города/мастерской
редкие операции требуют личную мастерскую или NPC-мастера
```

В будущем:

```txt
игрок может купить личную мастерскую
улучшать станки
нанимать помощников
хранить древесину
получать заказы
```

---

## 13. Мини-игра мастерской плотника

Рубка и распил уже являются первой фазой. Мастерская должна быть другой по ощущению: не сила, а точность.

### 13.1. Три стадии

```txt
1. Выравнивание / строгание
2. Резьба / обход сучков и трещин
3. Балансировка / сборка
```

### 13.2. Результат мини-игры

```ts
export interface CarpenterWorkshopResult {
  success: boolean;
  reason?: 'cancelled' | 'no_stamina' | 'tool_broken' | 'too_many_mistakes';
  componentKind: CarpenterComponentKind;
  staminaSpent: number;
  durabilitySpent: number;
  qualityScore: number;
  traitRetentionPercent: number;
  mistakes: number;
  stageResults: {
    planing: number;
    carving: number;
    balancing: number;
  };
}
```

### 13.3. Формула качества

```txt
qualityScore =
  baseScore
  + planingScore * 0.30
  + carvingScore * 0.35
  + balancingScore * 0.35
  + carpenterLevelBonus
  + toolBonus
  + stationBonus
  - treeRiskPenalty
  - mistakesPenalty
```

### 13.4. Формула сохранения свойств

```txt
traitRetentionPercent = clamp(
  35
  + qualityScore * 0.45
  + carpenterLevel * 1.5
  + stationTraitBonus
  - materialInstability
  - mistakes * 3,
  10,
  100
)
```

---

## 14. Промт для техно-демки мастерской

```txt
Create a standalone HTML5/Phaser 3 tech demo for a fantasy carpenter workshop mini-game.

Goal:
The mini-game represents fine woodworking after the player has already chopped and sawed logs in the main RPG. This demo should NOT include inventory, RPG backend, scoring as currency, or item rewards. It should only simulate the workshop action and return a result object.

Core fantasy action:
The player crafts one wooden component from a selected wood material:
- staff core
- bow stave
- sword handle
- spear shaft
- shield core
- crossbow stock
- furniture panel

The mini-game has 3 short stages:

1. Planing / Straightening
The player moves a plane tool along a wooden plank. The goal is to keep the tool inside a highlighted grain path. Going outside the path creates roughness. Too much pressure creates damage.

2. Carving / Detail Work
Knots, cracks, and glowing grain lines appear on the wood. The player must avoid cracks and cut along good grain lines. This affects magical conductivity and trait retention.

3. Balancing / Assembly
A balance meter moves left/right. The player must keep it in the optimal zone for a few seconds. This affects final quality, weapon handling, bow accuracy, or staff stability.

UI must show:
- Wood name
- Component type
- Material traits preview
- Quality meter
- Trait retention %
- Tool durability
- Player stamina
- Mistakes count
- Stage progress

No score. No coins. No arcade points.

The result object must look like:

{
  success: boolean,
  reason?: "cancelled" | "no_stamina" | "tool_broken" | "too_many_mistakes",
  componentKind: string,
  staminaSpent: number,
  durabilitySpent: number,
  qualityScore: number,
  traitRetentionPercent: number,
  mistakes: number,
  stageResults: {
    planing: number,
    carving: number,
    balancing: number
  }
}

Visual style:
Dark fantasy 2D, warm wooden workshop, medieval tools, readable UI, no text-heavy menus, no pixel art unless needed. The prototype should be easy to embed later into a React game through callbacks onComplete(result) and onFail(result).

Important:
Do not implement RPG inventory, item creation, backend calls, or saving. The main RPG will do that later. This demo only returns the crafting performance result.
```

---

## 15. Этапы внедрения для будущего ТЗ

### Этап 1 — Tree traits только в данных и админке

Цель:

```txt
деревья получают свойства
админка умеет их редактировать
данные сохраняются/import/export
игра не ломается
```

Сделать:

```txt
1. Расширить TreeDefinition.
2. Добавить WoodTraitTag.
3. Добавить TreeWoodProfile.
4. Обновить backend content.types.ts.
5. Обновить frontend models.ts.
6. Обновить CarpentryTreesTab.
7. Добавить UI-поля:
   - physical
   - elemental
   - magical
   - alchemy
   - runic
   - economic
   - traitTags
   - preferredComponentKinds
   - forbiddenComponentKinds
   - inheritedEffects
8. Проверить backup/import/export.
9. Никаких боевых изменений пока не делать.
```

Критерий готовности:

```txt
можно открыть дерево в админке, прописать свойства, сохранить, перезагрузить страницу, увидеть те же свойства.
```

---

### Этап 2 — Наследование свойств в древесные материалы

Цель:

```txt
брёвна, доски, балки, кора, смола получают sourceTreeId и часть woodProfile
```

Сделать:

```txt
1. Добавить функцию buildWoodMaterialFromTree(tree, outputKind, quality).
2. Добавить конвертацию TreeWoodProfile → MaterialCraftingProperties.
3. Добавить коэффициенты наследования:
   - log 1.00
   - plank 0.80
   - beam 0.85
   - bark 0.45
   - resin 0.65
   - charcoal 0.35
4. Протянуть в результат рубки/распила.
5. Проверить, что полученный материал имеет sourceTreeId/sourceTreeName.
```

Критерий готовности:

```txt
срубил Пламенный Вихрь → получил бревно Пламенного Вихря с firePower/heatResistance.
распилил → получил доски Пламенного Вихря с частью этих свойств.
```

---

### Этап 3 — CarpenterItemTemplate без мини-игры

Цель:

```txt
появляется мастерская плотника с template-ами и простым нажатием Создать
```

Сделать:

```txt
1. Добавить CarpenterItemTemplate.
2. Добавить коллекцию carpenterItemTemplates в content db.
3. Добавить админку template-ов плотника.
4. Добавить вкладки:
   - wood_processing
   - weapon_components
   - bows
   - crossbows
   - arrows_and_bolts
   - staffs_and_wands
   - shields
   - furniture
   - ritual_woodwork
5. Добавить создание runtime item/component.
6. Добавить traitRetentionPercent пока фиксированный, например 60 + level.
```

Критерий готовности:

```txt
в мастерской можно взять доску Горного Стража и создать рукоять меча Горного Стража.
```

---

### Этап 4 — Городские мастерские

Цель:

```txt
пользоваться плотником можно через городскую локацию, как кузницей
```

Сделать:

```txt
1. Добавить service carpenter_workshop.
2. Добавить проверку location/city services.
3. Добавить кнопку входа в мастерскую из города/локации.
4. Ограничить template-ы по stationTypes и workshop tier.
```

Критерий готовности:

```txt
в городе есть Мастерская плотника, игрок нажимает и попадает в UI плотника.
```

---

### Этап 5 — Интеграция с кузнецом

Цель:

```txt
кузнец использует готовые компоненты плотника вместо сырого дерева
```

Сделать:

```txt
1. В blacksmith templates заменить role wood/handle на inputItems componentKind.
2. Добавить чтение компонентных itemSnapshot/carpenterPayload.
3. Добавить функцию deriveComponentBonusesForBlacksmith.
4. Передавать inheritedEffects компонента в финальный предмет.
5. Обновить рецепты:
   - меч требует sword_handle
   - топор требует axe_haft
   - копьё требует spear_shaft
   - алебарда требует halberd_shaft
   - щит требует shield_core
   - арбалет требует crossbow_stock/body
```

Критерий готовности:

```txt
рукоять из Эльфийской Песни влияет на финальный меч/лук/посох через hit/crit/perception или другие эффекты.
```

---

### Этап 6 — Луки как полноценное оружие плотника

Цель:

```txt
плотник может создавать луки и арбалеты как оружие
```

Сделать:

```txt
1. Добавить subtype bow/crossbow.
2. Проверить attackRange.
3. Проверить handsRequired 2.
4. Проверить battle visual defaults.
5. Добавить базовые луки:
   - simple_bow
   - hunting_bow
   - war_bow
   - longbow
6. Добавить стрелы/болты как расходник или пока как обычный item.
```

Критерий готовности:

```txt
созданный лук можно экипировать и атаковать на дистанции.
```

---

### Этап 7 — Посохи и магические основы

Цель:

```txt
плотник создаёт основы посохов/жезлов, которые потом могут быть зачарованы
```

Сделать:

```txt
1. Добавить staff_core/wand_core as weapon.
2. Добавить canBeUsedByRunecrafter/canBeUsedByEnchanter.
3. Добавить baseMaxAugmentSlots.
4. Проверить, что без зачарования это слабое оружие.
5. Позже связать с рунами/камнями.
```

Критерий готовности:

```txt
основа посоха создаётся, экипируется, имеет свойства дерева, но не является сразу сильным магическим оружием.
```

---

### Этап 8 — Мини-игра мастерской

Цель:

```txt
качество компонента зависит от mini-game результата
```

Сделать:

```txt
1. Подключить техно-демку или реализовать React/Phaser компонент.
2. На вход давать selectedTemplate + selectedMaterial.
3. На выход получать CarpenterWorkshopResult.
4. Качество и traitRetentionPercent зависят от результата.
5. Ошибки могут снизить качество или испортить материал.
```

Критерий готовности:

```txt
одна и та же доска может дать плохую или хорошую рукоять в зависимости от мини-игры.
```

---

### Этап 9 — Личная мастерская игрока

Цель на будущее:

```txt
игрок может купить мастерскую в городе/поселении
```

Сделать позже:

```txt
1. playerWorkshops.
2. workshop ownership.
3. station upgrades.
4. storage.
5. assistants.
6. orders.
7. passive production.
```

---

## 16. Главная проверка end-to-end

Нельзя считать систему готовой, если она работает только в админке.

Минимальная проверка:

```txt
1. В админке у дерева Пламенный Вихрь прописан firePower и heatResistance.
2. Игрок рубит Пламенный Вихрь.
3. Игрок получает бревно Пламенного Вихря.
4. Игрок распиливает его на доски.
5. Доска сохраняет часть firePower и heatResistance.
6. Плотник делает основу посоха из этой доски.
7. Основа посоха получает traitRetentionPercent и effects.
8. Игрок экипирует/использует предмет или отдаёт рунорезу/магу/кузнецу.
9. Финальный предмет реально получает effects.
10. В бою effect применяется.
```

---

## 17. Главное правило баланса

Редкое дерево не должно автоматически давать легендарный предмет.

Финальный результат зависит от:

```txt
редкость дерева
качество древесины
сложность дерева
уровень плотника
навыки плотника
станок
инструмент
мини-игра
рецепт/template
дальнейшая профессия
```

Пример:

```txt
Новичок может испортить Танец Фераласа.
Мастер может раскрыть даже обычный Зелёный Шёпот.
```

---

## 18. Краткий итог для будущего ТЗ

В будущем ТЗ агенту нельзя давать задачу “сделай всю систему плотника”. Это слишком большая задача.

Нужно дробить так:

```txt
ТЗ 1: TreeWoodProfile в типах, backend, frontend admin, сохранение.
ТЗ 2: наследование woodProfile в материалы рубки/распила.
ТЗ 3: CarpenterItemTemplate и админка template-ов.
ТЗ 4: простая мастерская плотника без мини-игры.
ТЗ 5: городская мастерская как service в city/location.
ТЗ 6: создание компонентов: рукоять, древко, щитовая основа.
ТЗ 7: интеграция кузнеца с компонентами плотника.
ТЗ 8: луки как оружие плотника.
ТЗ 9: посохи/жезлы как основы под магию.
ТЗ 10: мини-игра мастерской.
ТЗ 11: личная мастерская игрока.
```

Главный принцип каждого ТЗ:

```txt
не только UI,
не только админка,
а полный путь:
тип → сохранение → админка → runtime → инвентарь → использование.
```

---

## 19. Дополнение: навыки плотника как ключи открытия мастерской

Это дополнение добавлено после проверки уже существующего дерева навыков плотника.

В игре уже есть навыки плотника, которые логично использовать не только как пассивные бонусы, но и как **ключи открытия действий, template-ов, веток мастерской и качества результата**.

Главный принцип:

```txt
Навык плотника
↓
открывает действие / template / группу template-ов
↓
runtime проверяет requiredSkillIds
↓
мастерская показывает только доступное
↓
качество и сохранение свойств зависят от навыков
```

То есть навык не должен быть только декоративной иконкой в UI. Он должен влиять на:

```txt
доступные рецепты
доступные template-ы свободного плотничества
качество компонента
traitRetentionPercent
шанс брака
расход материала
сложность мини-игры
количество получаемых материалов
открытие скрытых свойств дерева
```

---

### 19.1. Уже видимые навыки из текущего дерева плотника

По текущему экрану навыков уже есть такие узлы:

```txt
Чистый сруб
Лесопильный глаз
Лестничий
Тихая валка
Сухая сердцевина
Каркас мастера
Клин лесоруба
Разметка доски
Сухая доска
Чтение ствола
Бережная пила
Древко ученика
Верный замах
Ровный распил
Простая рукоять
```

Эти навыки нужно связать с мастерской и template-ами.

---

## 20. Skill IDs для плотника

Ниже предлагаемые технические ID. Если в коде уже есть другие ID, не ломать старые: нужно сделать alias/миграцию или использовать существующие ID.

```ts
export type CarpenterSkillId =
  | 'carp_clean_cut'
  | 'carp_sawmill_eye'
  | 'carp_ladderman'
  | 'carp_quiet_felling'
  | 'carp_dry_heartwood'
  | 'carp_master_frame'
  | 'carp_lumberjack_wedge'
  | 'carp_board_marking'
  | 'carp_dry_board'
  | 'carp_reading_the_trunk'
  | 'carp_careful_saw'
  | 'carp_apprentice_shaft'
  | 'carp_faithful_swing'
  | 'carp_even_sawing'
  | 'carp_simple_handle'

  // новые навыки мастерской
  | 'carp_bow_stave_basics'
  | 'carp_bowyer_hand'
  | 'carp_war_bow_shape'
  | 'carp_longbow_mastery'
  | 'carp_crossbow_stock'
  | 'carp_crossbow_body'
  | 'carp_staff_core_basics'
  | 'carp_wand_carving'
  | 'carp_rune_staff_preparation'
  | 'carp_shield_core_basics'
  | 'carp_tower_shield_frame'
  | 'carp_arrow_shafting'
  | 'carp_war_arrow_bundle'
  | 'carp_ritual_wood_carving'
  | 'carp_forbidden_wood_handling'
  | 'carp_trait_preservation'
  | 'carp_hidden_grain_reading'
  | 'carp_master_component_balance';
```

---

## 21. Карта навыков → что открывает

### 21.1. Чистый сруб

```txt
Название: Чистый сруб
ID: carp_clean_cut
Тип: рубка / качество сырья
```

Открывает:

```txt
clean_log
более качественные брёвна
меньше потерь коры/смолы
+ к качеству бревна после рубки
```

Runtime-эффекты:

```ts
woodcuttingResultQualityBonus += 5
logTraitRetentionBonus += 0.05
barkDamageChance -= 0.10
```

Связанные template-ы:

```txt
template_carp_log_to_planks
template_carp_log_to_beams
```

---

### 21.2. Верный замах

```txt
Название: Верный замах
ID: carp_faithful_swing
Тип: рубка / точность удара
```

Эффекты:

```ts
axeHitDamageBonus += 0.08
staminaCostMultiplier -= 0.05
treeFallRiskPenalty -= 0.05
```

Открывает:

```txt
лучшее качество бревна при успешной рубке
снижает шанс аварийной валки
```

---

### 21.3. Чтение ствола

```txt
Название: Чтение ствола
ID: carp_reading_the_trunk
Тип: анализ дерева
```

Открывает:

```txt
просмотр видимых свойств дерева перед рубкой
первые скрытые wood traits
подсказки по риску падения
подсказки по пригодности дерева для лука/посоха/щита
```

Runtime-эффекты:

```ts
canInspectTreeTraits = true
hiddenTraitRevealLevel += 1
treeFallRiskPenalty -= 0.05
```

В UI:

```txt
В forest panel показывать:
- известные свойства дерева;
- пригодность: луки / посохи / щиты / рукояти;
- риск обработки.
```

---

### 21.4. Клин лесоруба

```txt
Название: Клин лесоруба
ID: carp_lumberjack_wedge
Тип: рубка / раскол / безопасность
```

Открывает:

```txt
split_log
контролируемая валка
черновое раскалывание бревна
```

Связанные template-ы:

```txt
template_carp_log_to_firewood
template_carp_log_to_charcoal
```

Runtime-эффекты:

```ts
controlledFellingBonus += 0.10
splitLogYieldBonus += 1
fallAccidentChance -= 0.10
```

---

### 21.5. Тихая валка

```txt
Название: Тихая валка
ID: carp_quiet_felling
Тип: рубка / скрытность / события
```

Открывает:

```txt
меньше шанс привлечь зверей/монстров во время рубки
тихая рубка в опасных биомах
```

Runtime-эффекты:

```ts
woodcuttingNoiseMultiplier -= 0.25
forestAmbushChance -= 0.10
rareTreeDamageChance -= 0.05
```

---

### 21.6. Лесопильный глаз

```txt
Название: Лесопильный глаз
ID: carp_sawmill_eye
Тип: распил / анализ волокон
```

Открывает:

```txt
предпросмотр выхода при распиле
подсказку лучшего направления распила
больше шанса получить качественную доску
```

Связанные template-ы:

```txt
template_carp_log_to_planks
template_carp_log_to_beams
template_carp_plank_to_thin_plank
```

Runtime-эффекты:

```ts
sawingPreviewEnabled = true
sawingYieldBonus += 0.10
sawingMistakePenalty -= 0.10
```

---

### 21.7. Ровный распил

```txt
Название: Ровный распил
ID: carp_even_sawing
Тип: распил / качество досок
```

Открывает:

```txt
ровные доски
балки с меньшим браком
```

Связанные template-ы:

```txt
template_carp_log_to_planks
template_carp_log_to_beams
template_carp_plank_to_planed_plank
```

Runtime-эффекты:

```ts
plankQualityBonus += 6
beamQualityBonus += 4
traitRetentionPercent += 5
```

---

### 21.8. Бережная пила

```txt
Название: Бережная пила
ID: carp_careful_saw
Тип: распил / сохранение свойств
```

Открывает:

```txt
бережный распил редких деревьев
меньше потеря firePower/manaConductivity/elasticity при распиле
```

Runtime-эффекты:

```ts
sawDurabilityLossMultiplier -= 0.10
materialTraitLossMultiplier -= 0.15
rareWoodWasteChance -= 0.10
```

---

### 21.9. Разметка доски

```txt
Название: Разметка доски
ID: carp_board_marking
Тип: мастерская / подготовка формы
```

Открывает:

```txt
planed_plank
thin_plank
wood_strip
точную подготовку для рукоятей, стрел, луков
```

Связанные template-ы:

```txt
template_carp_plank_to_planed_plank
template_carp_plank_to_thin_plank
template_carp_arrow_shaft_bundle
template_carp_bow_stave
```

Runtime-эффекты:

```ts
workshopPlaningScoreBonus += 5
componentDifficultyPenalty -= 2
```

---

### 21.10. Сухая доска

```txt
Название: Сухая доска
ID: carp_dry_board
Тип: сушка / качество материала
```

Открывает:

```txt
dry_plank / seasoned_plank
стабильные доски для луков, щитов и мебели
```

Связанные template-ы:

```txt
template_carp_plank_to_planed_plank
template_carp_plank_to_polished_plank
template_carp_bow_stave
template_carp_round_shield_core
```

Runtime-эффекты:

```ts
dryingSuccessBonus += 0.12
crackRiskMultiplier -= 0.15
bowTensionBonus += 0.05
```

---

### 21.11. Сухая сердцевина

```txt
Название: Сухая сердцевина
ID: carp_dry_heartwood
Тип: сушка редкой древесины
```

Открывает:

```txt
работу с плотной/редкой сердцевиной
staff_core из редкого дерева
crossbow_stock из плотного дерева
shield_core из плотного дерева
```

Связанные template-ы:

```txt
template_carp_staff_core_basic
template_carp_crossbow_stock
template_carp_kite_shield_core
template_carp_tower_shield_core
```

Runtime-эффекты:

```ts
heartwoodTraitRetentionBonus += 0.10
denseWoodDifficultyPenalty -= 4
dryingFailureChance -= 0.10
```

---

### 21.12. Древко ученика

```txt
Название: Древко ученика
ID: carp_apprentice_shaft
Тип: оружейные компоненты
```

Открывает:

```txt
spear_shaft
javelin_shaft
arrow_shaft_bundle
bolt_shaft_bundle
```

Связанные template-ы:

```txt
template_carp_spear_shaft_basic
template_carp_javelin_shaft_basic
template_carp_arrow_shaft_bundle
template_carp_bolt_shaft_bundle
```

Runtime-эффекты:

```ts
shaftStraightnessBonus += 8
spearShaftQualityBonus += 5
arrowShaftYieldBonus += 2
```

---

### 21.13. Простая рукоять

```txt
Название: Простая рукоять
ID: carp_simple_handle
Тип: рукояти для оружия
```

Открывает:

```txt
sword_handle
dagger_handle
axe_haft
hammer_handle
mace_handle
```

Связанные template-ы:

```txt
template_carp_sword_handle_basic
template_carp_dagger_handle_basic
template_carp_axe_haft_basic
template_carp_hammer_handle_basic
template_carp_mace_handle_basic
```

Runtime-эффекты:

```ts
handleQualityBonus += 6
handleTraitRetentionBonus += 0.08
blacksmithComponentValueBonus += 0.10
```

---

### 21.14. Лестничий

```txt
Название: Лестничий
ID: carp_ladderman
Тип: строительство / поселения
```

Открывает:

```txt
ladder_part
door_panel
support_beam
cart_wheel
ship_plank basic
```

Связанные template-ы:

```txt
template_carp_ladder_part
template_carp_door_panel
template_carp_cart_wheel
template_carp_ship_plank
template_carp_log_to_beams
```

Runtime-эффекты:

```ts
buildingPartQualityBonus += 8
settlementRepairEfficiency += 0.10
```

---

### 21.15. Каркас мастера

```txt
Название: Каркас мастера
ID: carp_master_frame
Тип: каркасы / сложная сборка
```

Открывает:

```txt
shield_core_kite
shield_core_tower
crossbow_body
furniture_frame
weapon_rack
training_dummy
composite_bow_core
```

Связанные template-ы:

```txt
template_carp_kite_shield_core
template_carp_tower_shield_core
template_carp_crossbow_body
template_carp_simple_crossbow
template_carp_weapon_rack
template_carp_training_dummy
template_carp_composite_bow_core
```

Runtime-эффекты:

```ts
assemblyQualityBonus += 10
componentBalanceBonus += 8
complexTemplateRiskPenalty -= 0.10
```

---

## 22. Новые навыки для второй фазы мастерской

Текущие навыки уже хороши для базовой ветки. Но для луков, арбалетов, посохов, щитов и ритуального дерева нужны дополнительные узлы.

---

### 22.1. Заготовка лучника

```txt
Название: Заготовка лучника
ID: carp_bow_stave_basics
Требует: carp_board_marking, carp_dry_board
```

Открывает:

```txt
template_carp_bow_stave
template_carp_simple_bow
```

Эффекты:

```ts
bowStaveQualityBonus += 6
bowTensionWorkDifficulty -= 3
```

---

### 22.2. Рука лучника

```txt
Название: Рука лучника
ID: carp_bowyer_hand
Требует: carp_bow_stave_basics
```

Открывает:

```txt
template_carp_hunting_bow
template_carp_arrow_shaft_bundle
template_carp_hunting_arrows
```

Эффекты:

```ts
bowAccuracyBonus += 5
arrowStraightnessBonus += 8
```

---

### 22.3. Боевой изгиб

```txt
Название: Боевой изгиб
ID: carp_war_bow_shape
Требует: carp_bowyer_hand
```

Открывает:

```txt
template_carp_war_bow
template_carp_war_arrows
```

Эффекты:

```ts
warBowDamageBonus += 1
bowBreakChance -= 0.08
```

---

### 22.4. Длинная тетива

```txt
Название: Длинная тетива
ID: carp_longbow_mastery
Требует: carp_war_bow_shape
```

Открывает:

```txt
template_carp_longbow
template_carp_composite_bow_core
```

Эффекты:

```ts
bowAttackRangeBonus += 1
longbowQualityBonus += 10
```

---

### 22.5. Ложе арбалета

```txt
Название: Ложе арбалета
ID: carp_crossbow_stock
Требует: carp_dry_heartwood, carp_master_frame
```

Открывает:

```txt
template_carp_crossbow_stock
```

Эффекты:

```ts
crossbowStockQualityBonus += 8
denseWoodPenalty -= 3
```

---

### 22.6. Корпус арбалета

```txt
Название: Корпус арбалета
ID: carp_crossbow_body
Требует: carp_crossbow_stock
```

Открывает:

```txt
template_carp_crossbow_body
template_carp_simple_crossbow
```

Эффекты:

```ts
crossbowAssemblyQualityBonus += 8
crossbowRiskPenalty -= 0.10
```

---

### 22.7. Основа посоха

```txt
Название: Основа посоха
ID: carp_staff_core_basics
Требует: carp_dry_heartwood, carp_reading_the_trunk
```

Открывает:

```txt
template_carp_staff_core_basic
```

Эффекты:

```ts
staffCoreTraitRetentionBonus += 0.10
manaConductivityRetentionBonus += 0.12
```

---

### 22.8. Резьба жезла

```txt
Название: Резьба жезла
ID: carp_wand_carving
Требует: carp_staff_core_basics, carp_board_marking
```

Открывает:

```txt
template_carp_wand_core_basic
```

Эффекты:

```ts
wandFineCarvingBonus += 8
runeSocketStabilityBonus += 0.05
```

---

### 22.9. Подготовка под руны

```txt
Название: Подготовка под руны
ID: carp_rune_staff_preparation
Требует: carp_wand_carving
```

Открывает:

```txt
template_carp_rune_staff_core
template_carp_rune_wood_plate
template_carp_magic_focus_frame
```

Эффекты:

```ts
runeCarvingQualityBonus += 10
runeInstabilityPenalty -= 0.10
baseMaxAugmentSlotsBonus += 1 для подходящих staff/wand/rune templates
```

---

### 22.10. Щитовая основа

```txt
Название: Щитовая основа
ID: carp_shield_core_basics
Требует: carp_simple_handle, carp_board_marking
```

Открывает:

```txt
template_carp_round_shield_core
template_carp_wooden_shield_basic
```

Эффекты:

```ts
shieldCoreQualityBonus += 7
shieldTraitRetentionBonus += 0.10
```

---

### 22.11. Башенный каркас

```txt
Название: Башенный каркас
ID: carp_tower_shield_frame
Требует: carp_shield_core_basics, carp_master_frame
```

Открывает:

```txt
template_carp_kite_shield_core
template_carp_tower_shield_core
```

Эффекты:

```ts
largeShieldQualityBonus += 10
heavyWoodPenalty -= 0.08
```

---

### 22.12. Ровные стрелы

```txt
Название: Ровные стрелы
ID: carp_arrow_shafting
Требует: carp_apprentice_shaft, carp_board_marking
```

Открывает:

```txt
template_carp_arrow_shaft_bundle
template_carp_bolt_shaft_bundle
template_carp_training_arrows
```

Эффекты:

```ts
arrowYieldBonus += 2
arrowHitChanceBonus += 3
```

---

### 22.13. Боевой пучок

```txt
Название: Боевой пучок
ID: carp_war_arrow_bundle
Требует: carp_arrow_shafting, carp_bowyer_hand
```

Открывает:

```txt
template_carp_hunting_arrows
template_carp_war_arrows
```

Эффекты:

```ts
warArrowDamageBonus += 1
arrowTraitRetentionBonus += 0.05
```

---

### 22.14. Ритуальная резьба

```txt
Название: Ритуальная резьба
ID: carp_ritual_wood_carving
Требует: carp_staff_core_basics, carp_reading_the_trunk
```

Открывает:

```txt
template_carp_ritual_staff_core
template_carp_ritual_board
template_carp_totem_core
```

Эффекты:

```ts
ritualWoodQualityBonus += 10
spiritAffinityRetentionBonus += 0.12
```

---

### 22.15. Запретное волокно

```txt
Название: Запретное волокно
ID: carp_forbidden_wood_handling
Требует: carp_ritual_wood_carving
```

Открывает:

```txt
работу с forbidden_wood без огромного штрафа
Танец Фераласа
опасные ритуальные основы
```

Эффекты:

```ts
forbiddenWoodRiskPenalty -= 0.20
corruptionRiskPenalty -= 0.10
forbiddenWoodTraitRetentionBonus += 0.10
```

Важно: этот навык не должен полностью убирать риск. Он только снижает риск.

---

### 22.16. Сохранение свойств

```txt
Название: Сохранение свойств
ID: carp_trait_preservation
Требует: carp_careful_saw, carp_reading_the_trunk
```

Открывает:

```txt
повышенный traitRetentionPercent для всех компонентов
```

Эффекты:

```ts
globalTraitRetentionBonus += 0.10
materialTraitLossMultiplier -= 0.10
```

---

### 22.17. Скрытые волокна

```txt
Название: Скрытые волокна
ID: carp_hidden_grain_reading
Требует: carp_trait_preservation
```

Открывает:

```txt
просмотр скрытых свойств дерева
работу с редкими эффектами дерева
```

Эффекты:

```ts
hiddenTraitRevealLevel += 2
rareTraitActivationChance += 0.10
```

---

### 22.18. Баланс мастера

```txt
Название: Баланс мастера
ID: carp_master_component_balance
Требует: carp_master_frame, carp_trait_preservation
```

Открывает:

```txt
лучшие компоненты для кузнеца, луков и посохов
```

Эффекты:

```ts
componentBalanceBonus += 12
finalComponentQualityFloor += 10
blacksmithComponentValueBonus += 0.20
```

---

## 23. Skill-gated template matrix

Ниже матрица, которую можно использовать в админке и runtime. Каждый template должен иметь `requiredSkillIds`.

### 23.1. Wood processing

```txt
template_carp_log_to_planks:
- carp_sawmill_eye или базовый доступ без навыка
- бонус от carp_even_sawing
- бонус от carp_careful_saw

template_carp_log_to_beams:
- carp_even_sawing
- бонус от carp_ladderman

template_carp_log_to_firewood:
- carp_lumberjack_wedge

template_carp_log_to_charcoal:
- carp_lumberjack_wedge

template_carp_plank_to_planed_plank:
- carp_board_marking

template_carp_plank_to_polished_plank:
- carp_board_marking
- carp_dry_board

template_carp_plank_to_thin_plank:
- carp_board_marking
```

---

### 23.2. Weapon components

```txt
template_carp_sword_handle_basic:
- carp_simple_handle

template_carp_dagger_handle_basic:
- carp_simple_handle

template_carp_axe_haft_basic:
- carp_simple_handle
- бонус от carp_dry_heartwood

template_carp_hammer_handle_basic:
- carp_simple_handle
- бонус от carp_dry_heartwood

template_carp_mace_handle_basic:
- carp_simple_handle

template_carp_spear_shaft_basic:
- carp_apprentice_shaft

template_carp_javelin_shaft_basic:
- carp_apprentice_shaft

template_carp_polearm_shaft_basic:
- carp_apprentice_shaft
- carp_master_frame

template_carp_halberd_shaft_basic:
- carp_apprentice_shaft
- carp_master_frame
```

---

### 23.3. Staffs and wands

```txt
template_carp_staff_core_basic:
- carp_staff_core_basics

template_carp_wand_core_basic:
- carp_wand_carving

template_carp_ritual_staff_core:
- carp_ritual_wood_carving

template_carp_rune_staff_core:
- carp_rune_staff_preparation
```

---

### 23.4. Bows

```txt
template_carp_bow_stave:
- carp_bow_stave_basics

template_carp_simple_bow:
- carp_bow_stave_basics

template_carp_hunting_bow:
- carp_bowyer_hand

template_carp_war_bow:
- carp_war_bow_shape

template_carp_longbow:
- carp_longbow_mastery

template_carp_composite_bow_core:
- carp_longbow_mastery
- carp_master_frame
```

---

### 23.5. Crossbows

```txt
template_carp_crossbow_stock:
- carp_crossbow_stock

template_carp_crossbow_body:
- carp_crossbow_body

template_carp_simple_crossbow:
- carp_crossbow_body
- carp_master_frame
```

---

### 23.6. Arrows and bolts

```txt
template_carp_arrow_shaft_bundle:
- carp_arrow_shafting или carp_apprentice_shaft

template_carp_bolt_shaft_bundle:
- carp_arrow_shafting или carp_apprentice_shaft

template_carp_training_arrows:
- carp_arrow_shafting

template_carp_hunting_arrows:
- carp_war_arrow_bundle или carp_bowyer_hand

template_carp_war_arrows:
- carp_war_arrow_bundle
```

---

### 23.7. Shields

```txt
template_carp_round_shield_core:
- carp_shield_core_basics

template_carp_kite_shield_core:
- carp_shield_core_basics
- carp_master_frame

template_carp_tower_shield_core:
- carp_tower_shield_frame

template_carp_wooden_shield_basic:
- carp_shield_core_basics
```

---

### 23.8. Furniture and building

```txt
template_carp_chair_frame:
- базовый доступ или carp_ladderman

template_carp_table_frame:
- базовый доступ или carp_ladderman

template_carp_bed_frame:
- carp_ladderman

template_carp_chest_body:
- carp_ladderman

template_carp_weapon_rack:
- carp_master_frame

template_carp_training_dummy:
- carp_master_frame

template_carp_door_panel:
- carp_ladderman

template_carp_ladder_part:
- carp_ladderman

template_carp_cart_wheel:
- carp_ladderman
- carp_master_frame

template_carp_ship_plank:
- carp_ladderman
- carp_dry_board
```

---

### 23.9. Ritual and rune woodwork

```txt
template_carp_rune_wood_plate:
- carp_rune_staff_preparation

template_carp_ritual_board:
- carp_ritual_wood_carving

template_carp_magic_focus_frame:
- carp_rune_staff_preparation
- carp_ritual_wood_carving

template_carp_totem_core:
- carp_ritual_wood_carving
```

---

## 24. Как это должно быть в админке

### 24.1. В админке навыков

У каждого навыка плотника добавить/использовать поля:

```ts
unlockTemplateIds?: string[];
unlockComponentKinds?: CarpenterComponentKind[];
unlockRecipeGroups?: CarpenterRecipeGroup[];
modifiers?: Record<string, number | boolean | string>;
```

Пример:

```json
{
  "id": "carp_simple_handle",
  "name": "Простая рукоять",
  "professionId": "carpenter",
  "unlockTemplateIds": [
    "template_carp_sword_handle_basic",
    "template_carp_dagger_handle_basic",
    "template_carp_axe_haft_basic",
    "template_carp_hammer_handle_basic",
    "template_carp_mace_handle_basic"
  ],
  "unlockComponentKinds": [
    "sword_handle",
    "dagger_handle",
    "axe_haft",
    "hammer_handle",
    "mace_handle"
  ],
  "modifiers": {
    "handleQualityBonus": 6,
    "handleTraitRetentionBonus": 0.08,
    "blacksmithComponentValueBonus": 0.10
  }
}
```

Если текущий `ProfessionSkillDefinition` уже имеет другое поле для эффектов, не создавать несовместимое второе поле. Нужно сделать адаптер:

```txt
старое поле эффектов навыка
↓
normalizeCarpenterSkillModifiers(skill)
↓
runtime modifiers
```

---

### 24.2. В админке template-ов плотника

У каждого template обязательно должны быть:

```ts
requiredSkillIds?: string[];
recommendedSkillIds?: string[];
bonusSkillIds?: string[];
```

Разница:

```txt
requiredSkillIds — без них нельзя создать
recommendedSkillIds — можно создать, но с предупреждением/штрафом
bonusSkillIds — дают бонус к качеству/сохранению свойств
```

Пример:

```json
{
  "id": "template_carp_sword_handle_basic",
  "name": "Рукоять меча",
  "requiredSkillIds": ["carp_simple_handle"],
  "bonusSkillIds": ["carp_trait_preservation", "carp_master_component_balance"]
}
```

---

## 25. Как это должно работать в runtime

### 25.1. Проверка доступа

Перед созданием компонента:

```ts
function canUseCarpenterTemplate(character, template): boolean {
  if (!hasProfession(character, 'carpenter')) return false;
  if (getProfessionLevel(character, 'carpenter') < template.requiredCarpenterLevel) return false;
  return template.requiredSkillIds.every((skillId) => hasProfessionSkill(character, skillId));
}
```

Если не хватает навыка:

```txt
UI показывает template заблокированным
tooltip: Требуется навык "Простая рукоять"
```

---

### 25.2. Расчёт модификаторов навыков

```ts
function collectCarpenterSkillModifiers(character): CarpenterRuntimeModifiers {
  const learnedSkills = getLearnedProfessionSkills(character, 'carpenter');

  return learnedSkills.reduce((mods, skill) => {
    const skillMods = normalizeCarpenterSkillModifiers(skill);
    return mergeCarpenterModifiers(mods, skillMods);
  }, createEmptyCarpenterRuntimeModifiers());
}
```

Пример результата:

```ts
interface CarpenterRuntimeModifiers {
  globalTraitRetentionBonus: number;
  handleTraitRetentionBonus: number;
  staffCoreTraitRetentionBonus: number;
  bowStaveQualityBonus: number;
  shieldCoreQualityBonus: number;
  assemblyQualityBonus: number;
  componentBalanceBonus: number;
  rareWoodWasteChanceReduction: number;
  forbiddenWoodRiskReduction: number;
  hiddenTraitRevealLevel: number;
}
```

---

### 25.3. Формула с навыками

Старая формула:

```txt
traitRetentionPercent =
  35
  + qualityScore * 0.45
  + carpenterLevel * 1.5
  + stationTraitBonus
  - materialInstability
  - mistakes * 3
```

Новая формула:

```txt
traitRetentionPercent =
  35
  + qualityScore * 0.45
  + carpenterLevel * 1.5
  + stationTraitBonus
  + skillTraitRetentionBonus
  + componentSpecificSkillBonus
  - materialInstability
  - mistakes * 3
```

Где:

```txt
skillTraitRetentionBonus:
- общий бонус от carp_trait_preservation
- бонус по типу компонента: handle/staff/bow/shield
- бонус от скрытых волокон для редких свойств
```

---

## 26. Как навыки связаны с мини-игрой мастерской

Мини-игра не должна знать всю систему навыков. TheEnd должен передавать в мини-игру уже готовые модификаторы.

Phaser/React mini-game получает:

```ts
interface CarpenterWorkshopGameConfig {
  componentKind: CarpenterComponentKind;
  woodName: string;
  templateId: string;
  difficultyType: CarpenterTemplateDifficultyType;
  baseDifficulty: number;
  baseRisk: number;
  playerStamina: number;
  toolDurability: number;

  modifiers: {
    planingAssist?: number;
    carvingAssist?: number;
    balancingAssist?: number;
    mistakeForgiveness?: number;
    knotWarning?: boolean;
    hiddenGrainHints?: boolean;
    forbiddenWoodWarning?: boolean;
  };
}
```

Пример:

```txt
carp_board_marking → planingAssist
carp_hidden_grain_reading → hiddenGrainHints
carp_master_component_balance → balancingAssist
carp_forbidden_wood_handling → forbiddenWoodWarning
carp_careful_saw → mistakeForgiveness
```

Мини-игра возвращает только результат:

```ts
CarpenterWorkshopResult
```

А TheEnd уже применяет:

```txt
уровень
навыки
свойства дерева
качество
инвентарь
создание предмета
```

---

## 27. Как обновить будущие этапы внедрения

В разделе этапов внедрения нужно учитывать навыки.

### Новый Этап 3.5 — Skill-gated templates

Добавить между:

```txt
Этап 3 — CarpenterItemTemplate без мини-игры
Этап 4 — Городские мастерские
```

Новый этап:

```txt
Этап 3.5 — Навыки открывают template-ы плотника
```

Цель:

```txt
уже существующие навыки плотника реально открывают рецепты, компоненты и ветки мастерской
```

Сделать:

```txt
1. Добавить в template requiredSkillIds/recommendedSkillIds/bonusSkillIds.
2. Добавить в profession skills unlockTemplateIds/unlockComponentKinds/unlockRecipeGroups/modifiers.
3. Сделать helper canUseCarpenterTemplate(character, template).
4. Сделать helper collectCarpenterSkillModifiers(character).
5. В UI мастерской показывать заблокированные template-ы с причиной.
6. Runtime должен не разрешать создание, даже если UI пропустил.
7. Добавить минимум 5 рабочих skill-gates:
   - Простая рукоять → рукояти
   - Древко ученика → древки
   - Сухая доска → сухие/строганые доски
   - Каркас мастера → щитовые основы/арбалет
   - Основа посоха → staff_core
```

Критерий готовности:

```txt
если у игрока нет "Простая рукоять", он не может создать sword_handle;
если навык изучен — template становится доступным;
runtime проверяет это независимо от UI.
```

---

## 28. Главное правило по навыкам

Навык плотника должен быть связан с реальным действием.

Плохо:

```txt
Навык даёт +1 где-то в описании, но игра этого не читает.
```

Хорошо:

```txt
Навык открывает template.
Навык меняет формулу качества.
Навык меняет traitRetention.
Навык снижает риск.
Навык открывает подсказки по дереву.
Навык даёт доступ к редкой древесине.
```

И самое главное:

```txt
админка → сохранение → runtime → UI мастерской → создание предмета
```

Навыки должны пройти весь этот путь.

