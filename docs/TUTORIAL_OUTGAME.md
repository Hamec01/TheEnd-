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

