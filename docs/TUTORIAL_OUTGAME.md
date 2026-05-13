# TheEnd — TUTORIAL OUTGAME (гайд по JSON вне админки)

Этот файл — «человеческий» справочник по структурам контента. Он нужен, если вы создаёте контент в JSON вручную (в блокноте/IDE), а потом импортируете в админку.

Дата: 2026-05-13

## 0) Общие правила

### ID
- `id` — строка, уникальная **внутри своей коллекции**.
- Рекомендуемые префиксы: `item_…`, `skill_…`, `quest_…`, `npc_…`, `dialogue_…`, `merchant_…`, `material_…`, `loot_…`.
- Избегайте пробелов и кириллицы в `id` (лучше `snake_case`).

### Связи
- Все связи между сущностями — через строковые ID (например `itemId`, `questId`, `npcId`, `skillId`, `dialogueId`, `lootTableId`, `traderId`).

### Импорт/экспорт JSON в админке (формат файла)
Импорт для коллекций поддерживает такие формы:
1) **Массив**:
```json
[ { "...": "..." }, { "...": "..." } ]
```
2) **Envelope**:
```json
{ "items": [ ... ] }
```
3) **Backup**:
```json
{ "content": { "items": [ ... ] } }
```

Экспорт обычно создаёт envelope вида:
```json
{
  "schemaVersion": 1,
  "game": "TheEnd",
  "exportedAt": "2026-05-13T12:00:00.000Z",
  "exportedBy": "admin",
  "contentCounts": { "items": 123 },
  "items": [ ... ]
}
```

---

## 1) Предметы (`items`)
Раздел админки: **КОНТЕНТ → ПРЕДМЕТЫ**

### Минимально важные поля
- `id: string` (required)
- `name: string` (required)
- `type: ItemType` (required)
- `rarity: ItemRarity` (required)
- `price: number` (>= 0)
- `stackable: boolean`
- `createdAt: string(ISO)`, `updatedAt: string(ISO)` (обычно проставляет админка/импорт)

### Полезные поля
- `subtype?: string`
- `slot?: ItemSlot`
- `handsRequired?: 1 | 2`
- `requiredStats?: Partial<Record<StatKey, number>>`
- `bonuses?: Partial<Record<StatKey, number>>`
- `equipmentEffects?: ItemEffect[]`
- `useEffects?: ItemEffect[]`
- `tags?: string[]`
- `imagePath?: string`
- Рейндж/АОЕ (если предмет используется по клеткам):
  - `attackRange?: number`
  - `pierceTargets?: number`
  - `splashRadius?: number`
  - `splashCenterMultiplier?: number`
  - `splashOuterMultiplier?: number`

### Enums
**ItemType**
- `weapon | armor | potion | material | quest | misc`

**ItemSlot**
- `head | necklace | chest | outerwear | belt | leftHand | rightHand | gloves | legs | boots | ring | trinket | charm | quick | none`

**ItemRarity**
- `common | uncommon | rare | epic | legendary | mythic | forbidden`

**DamageCategory**
- `physical | elemental | magic | shamanic | runic | poison | bleed | true`

**PhysicalType**
- `slash | pierce | blunt | cleave | unarmed`

**ElementType**
- `fire | water | earth | air | light | dark`

**MagicSchool**
- `blood | death | life | mind | illusion | curse | arcane`

**StatKey**
- из домена (`@theend/rpg-domain`), в UI встречаются:
  - `hp | mp | stamina | strength | constitution | dexterity | intelligence | luck | perception | willpower`

### ItemEffect (useEffects/equipmentEffects) — общий вид
```json
{
  "type": "stat_bonus",
  "stat": "hp",
  "flat": 50,
  "trigger": "on_use"
}
```

`ItemEffect.type` (основные варианты):
- `stat_bonus`
- `incoming_damage_modifier | outgoing_damage_modifier`
- `armor_penetration`
- `crit_chance_modifier | crit_damage_modifier | crit_chance_taken_modifier`
- `lifesteal`
- `apply_status`
- `status_resistance | status_immunity`
- `block_chance_modifier | dodge_chance_modifier | hit_chance_modifier`
- `extra_attack_chance`

`trigger`:
- `on_hit | on_crit | on_use | on_turn_start | on_turn_end | always`

---

## 2) Скилы (`skills`)
Раздел админки: **КОНТЕНТ → SKILLS**

### Минимально важные поля
- `id: string` (required)
- `slug: string` (required)
- `name: string` (required)
- `type: SkillType` (required)
- `maxLevel: 1..5`
- `levels: SkillLevelData[]` (обычно на каждый lvl)
- `target: { ... }`
- `costs: { ... }`
- `cast: { ... }`

### Поля связей (часто используются)
- `requiredQuestId?: string` → `quests.id`
- `requiredCompletedQuestId?: string` → `quests.id`
- `requiredQuestItemId?: string` → `questItems.id`
- `requiredNpcId?: string` → `npcs.id`
- `requiredKnownSkillIds?: string[]` → `skills.id`

### Enums (из `@theend/rpg-domain`, смотрите актуальные значения в коде)
В UI они берутся через `Object.values(...)`:
- `SkillType`
- `SkillSubtype`
- `SkillTargetType`
- `CastType`
- `AcquisitionType`

Подсказка: если нужно увидеть полный список значений — открывайте:
- `apps/frontend/src/admin/skills/skillAdminUtils.ts`

---

## 3) Квесты (`quests`)
Раздел админки: **КОНТЕНТ → КВЕСТЫ**

### Минимально важные поля
- `id: string`
- `title: string`
- `category: QuestCategory`
- `status: QuestStatus`
- `steps: QuestStep[]`
- `triggers: QuestTrigger[]`
- `conditions: QuestCondition[]`
- `rewards: QuestReward[]`

### Enums
**QuestCategory**
- `global | kingdom | faction | profession | lore | city | npc | random | hidden | repeatable`

**QuestStatus**
- `draft | active | disabled | archived`

**QuestObjectiveType**
- `talk_to_npc | enter_zone | reach_marker | kill_enemy | collect_item | deliver_item | use_item | pay_gold | receive_gold | choose_dialogue | craft_item | learn_profession | gain_reputation | wait_time | read_book | inspect_object | survive_battle | escort_npc`

**QuestTriggerType**
- `npc_dialogue | map_marker | map_zone_enter | item_use | enemy_death | global_event | profession_unlock | manual_admin | random_zone_roll`

**QuestRewardType**
- `gold | experience | item | quest_item | reputation | title | profession | skill | recipe | unlock_dialogue | unlock_location | unlock_shop | faction_access | lore_entry`

**QuestConditionType**
- `player_level | player_race | player_class | player_profession | kingdom_reputation | faction_reputation | has_item | has_not_item | quest_completed | quest_not_completed | quest_active | npc_alive | npc_dead | time_of_day | in_city | in_kingdom | stat_check | flag_true | flag_false | gold_at_least`

---

## 4) Диалоги (`dialogues`)
Раздел админки: **КОНТЕНТ → ДИАЛОГИ**

### Минимально важные поля
- `id: string`
- `title: string`
- `status: 'draft' | 'active' | 'disabled'`
- `startNodeId: string`
- `nodes: DialogueNode[]`

### DialogueNode
- `id: string`
- `speaker: 'npc' | 'player' | 'system'`
- `text: string`
- `choices: DialogueChoice[]`

### DialogueChoice
- `id: string`
- `text: string`
- `nextNodeId?: string` / `endsDialogue?: boolean`
- `conditions?: DialogueCondition[]`
- `actions?: DialogueAction[]`

Возможные `DialogueAction.type` включают (неполный список из типов):
- `startQuest | completeObjective | completeStep | advanceQuest | completeQuest | failQuest`
- `giveRewards | setQuestFlag`
- `giveItem | takeItem | giveQuestItem | takeQuestItem`
- `giveGold | takeGold | giveExperience | addReputation`
- `openShop | startCombat | trainSkill`
- `unlockLocation | unlockDialogue | openDialogue`
- `setNpcDisposition | setGlobalFlag`

---

## 5) Персонажи / NPC (`npcs`)
Раздел админки: **КОНТЕНТ → ПЕРСОНАЖИ**

### Минимально важные поля
- `id: string`
- `name: string`
- `status: NpcStatus`
- `kind: NpcKind`
- `race: NpcRace`
- `description: string`
- `defaultDisposition: NpcDispositionMode`
- флаги поведения: `canFight/canTalk/canTrade/canTrain/canGiveQuests/canBeKilled`
- `dialogues: NpcDialogueBinding[]`
- `questBindings: NpcQuestBinding[]`

### Enums
**NpcStatus**
- `draft | active | disabled | archived`

**NpcKind**
- `civilian | quest_giver | trader | trainer | guard | enemy | boss | companion | random_encounter | story_character | monster | animal`

**NpcRace**
- `human | high_elf | forest_elf | ancient_elf | dwarf | orc | dark_elf | arin_fellar | monster | beast | undead | spirit | other`

**NpcDispositionMode**
- `friendly | neutral | hostile | fearful | aggressive_on_sight | quest_locked | hidden`

**NpcCombatRole**
- `none | melee | ranged | mage | healer | tank | assassin | summoner | support | beast`

### Важные связи
- `dialogues[*].dialogueId` → `dialogues.id`
- `questBindings[*].questId` → `quests.id`
- `combat.skillIds[]` → `skills.id`
- `combat.weaponItemId` / `combat.armorItemIds[]` → `items.id`
- `combat.lootTableId` / `inventory.lootTableId` → `lootTables.id`
- `traderId` → `merchants.id` (если НПС связан с торговцем)

---

## 6) Торговцы (`merchants`)
Раздел админки: **КОНТЕНТ → ТОРГОВЦЫ**

### Минимально важные поля
- `id: string`
- `name: string`
- `city: string`
- `type: MerchantType`
- `priceMultiplier: number` (> 0)
- `items: MerchantItem[]`
- `isEnabled: boolean`

### MerchantType
- `blacksmith | alchemist | general | rune_master | material_trader | rare_goods | other`

### MerchantItem
- `itemId: string` → `items.id`
- `stock?: number`
- `infiniteStock: boolean`
- `priceOverride?: number`
- `priceMultiplier?: number`
- `isEnabled: boolean`

---

## 7) Материалы (`materials`)
Раздел админки: **КОНТЕНТ → МАТЕРИАЛЫ**

### Минимально важные поля
- `id: string`
- `name: string`
- `category: MaterialCategory`
- `region: string`
- `rarity: ItemRarity`
- `properties: string[]`
- `isEnabled: boolean`

### MaterialCategory
- `metal | wood | leather | cloth | herb | stone | crystal | bone | other`

---

## 8) Таблицы добычи (`lootTables`)
Раздел админки: **КОНТЕНТ → ТАБЛИЦЫ ДОБЫЧИ**

### Минимально важные поля
- `id: string`
- `name: string`
- `sourceType: LootSourceType`
- `sourceId?: string`
- `entries: LootTableEntry[]`

### LootSourceType
- `npc | monster | chest | region | quest | merchant_special`

### LootTableEntry
- `itemId: string` → `items.id`
- `chance: number` (0..1)
- `minQuantity: number` (>= 1)
- `maxQuantity: number` (>= minQuantity)
- `isEnabled?: boolean`

---

## 9) Квестовые предметы / взаимодействия / маркеры
В админке эти разделы существуют (например **КВЕСТОВЫЕ ПРЕДМЕТЫ**, **QUEST INTERACTIONS**), но структуры зависят от текущих `types/quest.ts` и редакторов.

Если нужно дописать сюда **полные** схемы для:
- `questItems`
- `questInteractions`
- `questMarkers`

…скажите, и я соберу их из текущих `types/*` и страниц админки (чтобы не угадать поля неправильно).

Ниже — нормальный **туториал для создания учителей навыков в TheEnd**. Его можно потом прямо положить в твой внутренний справочник админки.

# Туториал: как правильно создавать учителя навыков

Учитель навыков — это NPC, который может обучать игрока скиллам: магическим, боевым, пассивным, профессиональным и любым будущим навыкам. Учитель **не является обычным торговцем**, даже если берёт золото за обучение. Торговец продаёт предметы, а учитель открывает игроку новые способности.

Один NPC может одновременно быть:

```txt
говорящим NPC
торговцем
учителем
квестодателем
лекарем
сюжетным персонажем
```

Например, Брат Элиан может:

```txt
говорить с игроком
продавать настои
обучать магическим навыкам
лечить за золото
позже выдавать квесты церкви
```

---

# 1. Создание NPC-учителя

Открой:

```txt
Админка → Персонажи
```

Создай нового NPC или открой уже существующего.

Для учителя обязательно:

```txt
Can talk: включено
Can train: включено
```

Если NPC ещё и торгует:

```txt
Can trade: включено
Trader profile: выбрать профиль торговца
```

Если NPC пока не выдаёт квесты:

```txt
Can give quests: выключено
```

Иначе админка может показывать предупреждение, что `canGiveQuests = true`, но квесты не привязаны.

---

## Пример базовой настройки NPC

```txt
ID:
npc_arklein_church_healer

Имя:
Брат Элиан

Тип NPC:
Civilian / Trainer / Healer

Раса:
Human

Город:
arklein

Location ID:
location_arklein_church

Can talk:
true

Can trade:
true

Can train:
true

Can give quests:
false

Can fight:
false
```

Для боевого тренера, например мастера меча, можно ставить:

```txt
Can fight: true
Can train: true
```

Для мирного учителя магии или лекаря:

```txt
Can fight: false
Can train: true
```

---

# 2. Где у NPC указывать навыки обучения

У NPC есть поле:

```txt
Trainer skill IDs
```

Туда записываются ID навыков, которым этот NPC может учить.

Правильный формат — **каждый ID с новой строки**:

```txt
skill_ice_arrow_01
skill_lightning_bolt_01
skill_blinding_flash_01
```

Не лучший вариант:

```txt
skill_ice_arrow_01, skill_lightning_bolt_01, skill_blinding_flash_01
```

Если код уже поддерживает запятые — сработает, но для админки и человека удобнее писать с новой строки.

---

## Пример для Брата Элиана

```txt
Trainer skill IDs:

skill_ice_arrow_01
skill_lightning_bolt_01
skill_blinding_flash_01
```

Это означает:

```txt
Брат Элиан может обучать:
- Ледяная стрела
- Молния
- Ослепление
```

---

# 3. Важное отличие: Combat skill IDs и Trainer skill IDs

В NPC есть похожие поля:

```txt
Combat skill IDs
Trainer skill IDs
```

Они нужны для разных вещей.

## Combat skill IDs

Это навыки, которыми **сам NPC пользуется в бою**.

Например, если маг-враг должен кастовать огненный шар:

```txt
Combat skill IDs:
skill_fireball_01
```

## Trainer skill IDs

Это навыки, которым NPC **учит игрока**.

Например:

```txt
Trainer skill IDs:
skill_ice_arrow_01
skill_lightning_bolt_01
skill_blinding_flash_01
```

Если NPC не дерётся, но обучает, `Combat skill IDs` можно оставить пустым.

Для Брата Элиана сейчас правильно так:

```txt
Combat skill IDs:
пусто

Trainer skill IDs:
skill_ice_arrow_01
skill_lightning_bolt_01
skill_blinding_flash_01
```

---

# 4. Создание самого навыка

Открой:

```txt
Админка → Skills
```

Создай навык или открой существующий.

Для навыка, который можно выучить у учителя, должны быть включены такие настройки:

```txt
Status / Published:
опубликован

Получение:
trainer

Доступен для обычного обучения:
включено

Required level:
1 или нужный уровень

Required NPC / trainer:
ID учителя
```

Например:

```txt
Required NPC / trainer:
npc_arklein_church_healer
```

---

## Пример: Ледяная стрела

```txt
ID:
skill_ice_arrow_01

Название:
Ледяная стрела

Получение:
trainer

Доступен для обычного обучения:
true

Required level:
1

Required NPC / trainer:
npc_arklein_church_healer
```

---

# 5. Acquisition Methods — самое важное поле

У навыка есть блок:

```txt
Acquisition Methods
```

Там нужно указать, каким способом навык получается.

Для обучения у NPC используется:

```json
[
  {
    "type": "admin_grant"
  },
  {
    "type": "teacher",
    "teacherNpcId": "npc_arklein_church_healer",
    "priceGold": 80
  }
]
```

Это означает:

```txt
Навык можно выдать админом.
Навык можно выучить у Брата Элиана за 80 золота.
```

---

## Почему важно поле teacherNpcId

Поле:

```json
"teacherNpcId": "npc_arklein_church_healer"
```

говорит игре:

```txt
Этот навык обучается именно у этого NPC.
```

Если его нет, игра может видеть, что навык “учительский”, но не понимать, какой NPC должен его преподавать.

---

# 6. Новый будущий формат цены

Сейчас можно использовать старый простой формат:

```json
{
  "type": "teacher",
  "teacherNpcId": "npc_arklein_church_healer",
  "priceGold": 80
}
```

Но лучше постепенно переходить на будущий формат:

```json
{
  "type": "teacher",
  "teacherNpcId": "npc_arklein_church_healer",
  "costs": {
    "gold": 80
  }
}
```

В будущем сюда можно будет добавить:

```json
{
  "type": "teacher",
  "teacherNpcId": "npc_arklein_church_healer",
  "costs": {
    "gold": 80,
    "items": [
      {
        "itemId": "item_aquarion_shard",
        "quantity": 1
      }
    ],
    "questItems": [
      {
        "questItemId": "questitem_terragorn_token",
        "quantity": 1,
        "consume": false
      }
    ]
  }
}
```

Так учитель сможет просить не только золото, но и предметы, квестовые предметы, репутацию или другие условия.

---

# 7. Требования к навыку

Требования — это то, что игрок должен иметь, но что **не тратится**.

Например:

```json
"requirements": {
  "minCharacterLevel": 1,
  "requiredStats": {
    "intelligence": 5
  },
  "forbiddenRaces": [
    "dwarf"
  ],
  "requiredMagicSchools": [
    "elemental"
  ]
}
```

Это означает:

```txt
Нужен уровень 1.
Нужен intelligence 5.
Гномы не могут использовать этот навык.
Нужна школа магии elemental.
```

---

## Требования и цена — не одно и то же

Важно не путать.

Требования:

```txt
уровень
статы
раса
класс
магическая школа
репутация
завершённый квест
предыдущий навык
```

Цена:

```txt
золото
предмет
квестовый предмет, если он тратится
очки навыков, если появятся
```

Например:

```txt
Чтобы выучить Молнию, нужен интеллект 6.
Это требование.

Чтобы выучить Молнию, нужно заплатить 110 золота.
Это цена.
```

---

# 8. Как игра понимает, что NPC учит навык

Навык считается связанным с учителем, если совпал **хотя бы один** источник.

## Источник 1: NPC содержит skill ID

У NPC:

```txt
Trainer skill IDs:
skill_ice_arrow_01
```

## Источник 2: Навык указывает Required NPC

У навыка:

```txt
Required NPC / trainer:
npc_arklein_church_healer
```

## Источник 3: Acquisition Methods указывает teacherNpcId

У навыка:

```json
{
  "type": "teacher",
  "teacherNpcId": "npc_arklein_church_healer",
  "priceGold": 80
}
```

Достаточно **любого одного** способа, но лучше для надёжности использовать сразу два:

```txt
NPC.trainerSkillIds содержит skill ID
и
skill.acquisition.methods содержит teacherNpcId
```

Для важных учителей лучше заполнять оба места.

---

# 9. Как открывается окно обучения

Есть два нормальных способа открыть обучение.

## Способ 1: кнопка “ТРЕНИРОВКА” на карточке NPC

Если у NPC включено:

```txt
Can train: true
```

на карточке NPC появляется кнопка:

```txt
ТРЕНИРОВКА
```

Она должна открыть:

```txt
Обучение у {имя NPC}
```

Например:

```txt
Обучение у Брата Элиана
```

## Способ 2: через диалог

В диалоге можно добавить choice с action:

```json
{
  "id": "choice_open_training",
  "text": "Я готов учиться.",
  "nextNodeId": "training_offer",
  "actions": [
    {
      "id": "act_open_training",
      "type": "openTraining",
      "trainerNpcId": "npc_arklein_church_healer"
    }
  ]
}
```

Так обучение открывается из реплики NPC.

---

# 10. Какой способ лучше использовать

Для обычных учителей лучше использовать кнопку:

```txt
ТРЕНИРОВКА
```

Это быстро и понятно игроку.

Для сюжетных учителей лучше использовать диалог:

```txt
Игрок спрашивает о знании.
NPC отвечает лорной репликой.
Потом появляется кнопка “Я готов учиться.”
```

Например:

```txt
Ты можешь научить меня магии?
↓
Элиан объясняет, что магия опасна.
↓
Я готов учиться.
↓
Открывается обучение.
```

Идеально, когда работают оба способа:

```txt
ТРЕНИРОВКА — быстрый вход
Диалог — красивый лорный вход
```

---

# 11. Пример полного навыка для учителя

```json
{
  "id": "skill_ice_arrow_01",
  "slug": "ice-arrow",
  "name": "Ледяная стрела",
  "type": "elemental_magic",
  "subtypes": ["spell"],
  "iconUrl": "",
  "shortDescription": "Стихийное заклинание воды: наносит урон и может замедлить цель.",
  "gameplayDescription": "Выпускает ледяную стрелу в одного врага. Наносит elemental-урон воды и имеет шанс наложить slow.",
  "isActive": true,
  "isPassive": false,
  "isToggleable": false,
  "isPublished": true,
  "isHidden": false,
  "acquisitionMode": "trainer",
  "isTrainable": true,
  "requiredLevel": 1,
  "requiredNpcId": "npc_arklein_church_healer",
  "acquisition": {
    "methods": [
      {
        "type": "admin_grant"
      },
      {
        "type": "teacher",
        "teacherNpcId": "npc_arklein_church_healer",
        "priceGold": 80
      }
    ],
    "isStarterSkill": false,
    "isQuestReward": false,
    "isBuyable": true,
    "isDiscoverable": false,
    "isAdminOnly": false
  },
  "requirements": {
    "minCharacterLevel": 1,
    "requiredStats": {
      "intelligence": 5
    },
    "forbiddenRaces": ["dwarf"],
    "requiredMagicSchools": []
  },
  "cooldown": {
    "cooldownTurns": 1,
    "startsOnCombatStart": false,
    "oncePerCombat": false
  },
  "tags": ["magic", "elemental", "water", "ice", "single_target", "slow"]
}
```

---

# 12. Пример NPC-учителя

```json
{
  "id": "npc_arklein_church_healer",
  "name": "Брат Элиан",
  "title": "Лекарь церкви Аркейла",
  "type": "Civilian",
  "race": "Human",
  "cityId": "arklein",
  "locationId": "location_arklein_church",
  "canTalk": true,
  "canTrade": true,
  "canTrain": true,
  "canGiveQuests": false,
  "canFight": false,
  "trainerSkillIds": [
    "skill_ice_arrow_01",
    "skill_lightning_bolt_01",
    "skill_blinding_flash_01"
  ],
  "description": "Брат Элиан — церковный лекарь Аркейла. За пожертвование лечит путников и обучает первым формам магии."
}
```

---

# 13. Как тестировать учителя

После настройки NPC и навыков:

```txt
1. Открой карту.
2. Найди NPC.
3. Нажми на него.
4. Убедись, что есть кнопка ТРЕНИРОВКА.
5. Нажми ТРЕНИРОВКА.
6. Должно открыться окно:
   Обучение у {имя NPC}
7. Навыки должны быть видны:
   - доступные
   - заблокированные
   - уже изученные
```

Если навыки не показываются, проверь:

```txt
NPC canTrain включён?
NPC trainerSkillIds заполнен?
Skill isPublished true?
Skill isTrainable true?
Skill acquisitionMode trainer?
Skill requiredNpcId правильный?
Skill acquisition.methods.teacherNpcId правильный?
Игрок уже не выучил этот навык?
Навык не скрыт isHidden?
Не хватает требований?
Не хватает золота?
```

---

# 14. Что делать, если навык не виден

## Ошибка 1: NPC не тренер

Проверь:

```txt
Can train: true
```

## Ошибка 2: навык не привязан к NPC

Проверь у NPC:

```txt
Trainer skill IDs:
skill_ice_arrow_01
```

И у навыка:

```txt
Required NPC / trainer:
npc_arklein_church_healer
```

И в Acquisition Methods:

```json
{
  "type": "teacher",
  "teacherNpcId": "npc_arklein_church_healer",
  "priceGold": 80
}
```

## Ошибка 3: навык не опубликован

Проверь:

```txt
isPublished: true
```

Если в админке кнопка называется:

```txt
СНЯТЬ ПУБЛИКАЦИЮ
```

значит навык уже опубликован.

Если кнопка называется:

```txt
ОПУБЛИКОВАТЬ
```

значит нужно нажать её.

## Ошибка 4: навык заблокирован требованиями

Например, игрок не имеет нужной школы магии или статов.

Тогда навык должен быть виден в разделе:

```txt
Заблокировано
```

с причиной:

```txt
Требуется intelligence: 5
Требуется школа магии: elemental
Недостаточно золота
```

Если заблокированный навык полностью скрывается — это баг UI.

---

# 15. Как правильно делать разных учителей

## Учитель магии

```txt
Can train: true
Trainer skill IDs:
skill_ice_arrow_01
skill_lightning_bolt_01
skill_blinding_flash_01
```

Навыки:

```txt
type: elemental_magic / normal_magic
requirements: intelligence, willpower, magic school
costs: gold / кристалл / квест
```

## Учитель меча

```txt
Trainer skill IDs:
skill_power_strike_01
skill_guard_break_01
skill_shield_wall_01
```

Навыки:

```txt
type: combat
requirements: strength, endurance
costs: gold
```

## Учитель лучников

```txt
Trainer skill IDs:
skill_aimed_shot_01
skill_double_shot_01
skill_eagle_eye_01
```

Навыки:

```txt
type: ranged_combat
requirements: dexterity, perception
costs: gold / стрелы / квест
```

## Учитель профессии

Например, кузнец:

```txt
Trainer skill IDs:
skill_blacksmith_add_socket_01
skill_blacksmith_sharpen_weapon_01
skill_blacksmith_repair_plate_01
```

Навыки:

```txt
type: profession
requirements: profession level
costs: gold + material item
```

## Учитель шахтёра

```txt
Trainer skill IDs:
skill_miner_find_ore_01
skill_miner_deep_vein_01
skill_miner_safe_tunnel_01
```

Навыки:

```txt
type: profession
requirements: stamina / constitution
costs: gold / инструмент / выполненный квест
```

---

# 16. Рекомендуемый стандарт ID

Для NPC:

```txt
npc_{city}_{role}_{name}
```

Примеры:

```txt
npc_arklein_church_healer
npc_arklein_sword_trainer
npc_arklein_archer_master
npc_mograk_blacksmith_trainer
```

Для навыков:

```txt
skill_{school_or_type}_{name}_{level}
```

Примеры:

```txt
skill_ice_arrow_01
skill_lightning_bolt_01
skill_blinding_flash_01
skill_sword_power_strike_01
skill_blacksmith_add_socket_01
skill_miner_find_ore_01
```

Для action в диалоге:

```txt
act_open_training
act_open_shop
act_take_gold_full_heal
```

---

# 17. Мини-чеклист перед сохранением учителя

Перед тем как тестировать учителя, проверь:

```txt
NPC:
[ ] canTrain включён
[ ] trainerSkillIds заполнен
[ ] NPC Active
[ ] NPC находится в нужной location
[ ] кнопка ТРЕНИРОВКА видна

Skill:
[ ] ID правильный
[ ] Published
[ ] isTrainable true
[ ] acquisitionMode trainer
[ ] requiredNpcId указан
[ ] acquisition.methods teacherNpcId указан
[ ] priceGold или costs.gold указан
[ ] requirements не слишком жёсткие для тестового игрока

UI:
[ ] кнопка ТРЕНИРОВКА открывает Обучение у NPC
[ ] навыки видны available или locked
[ ] locked показывает причины
[ ] после изучения навык появляется в изученных
```

---

# 18. Для Брата Элиана сейчас правильно так

NPC:

```txt
ID:
npc_arklein_church_healer

Can train:
true

Trainer skill IDs:
skill_ice_arrow_01
skill_lightning_bolt_01
skill_blinding_flash_01
```

Ледяная стрела:

```json
[
  {
    "type": "admin_grant"
  },
  {
    "type": "teacher",
    "teacherNpcId": "npc_arklein_church_healer",
    "priceGold": 80
  }
]
```

Молния:

```json
[
  {
    "type": "admin_grant"
  },
  {
    "type": "teacher",
    "teacherNpcId": "npc_arklein_church_healer",
    "priceGold": 110
  }
]
```

Ослепление:

```json
[
  {
    "type": "admin_grant"
  },
  {
    "type": "teacher",
    "teacherNpcId": "npc_arklein_church_healer",
    "priceGold": 95
  }
]
```

---

# 19. Главное правило

Учитель работает только тогда, когда совпадают три слоя:

```txt
NPC умеет тренировать.
Навык разрешён для обучения.
Окно обучения открыто именно у этого NPC.
```

То есть:

```txt
canTrain = true
+
skill isTrainable = true
+
trainerNpcId передан в окно обучения
```

Если открыть обычный экран навыков из меню, игра не знает, у какого NPC ты учишься. Поэтому обучение должно открываться через:

```txt
кнопку ТРЕНИРОВКА на NPC
```

или через:

```txt
диалоговое действие openTraining
```

Тогда окно получает `trainerNpcId` и показывает навыки конкретного учителя.
