# THE END Content Creation Tutorial (RU + EN)

> Audit basis / Основа аудита: this guide is based on the current repository snapshot and the actual frontend/backend/runtime code, not on planned behavior.  
> Этот гайд основан на текущем снимке репозитория и реальном коде frontend/backend/runtime, а не на планируемом поведении.

---

## 1. Scope / Что покрывает этот файл

This document explains:

- how to create **quests**
- how quests depend on **items, quest items, skills, NPCs, dialogues, merchants, cities, world zones, quest markers, battle maps**
- which **enum values** and **JSON commands** are really understood by the game right now
- how to create **skills**
- how to create **items**
- how to create **item sets**
- how to create **NPCs**

Этот документ объясняет:

- как создавать **квесты**
- как квесты зависят от **предметов, квестовых предметов, скиллов, NPC, диалогов, торговцев, городов, world zones, quest markers, battle maps**
- какие **enum-значения** и **JSON-команды** игра реально понимает прямо сейчас
- как создавать **скиллы**
- как создавать **предметы**
- как создавать **сеты предметов**
- как создавать **NPC**

---

## 2. Important snapshot note / Важная оговорка по текущему снимку репозитория

- **RU:** В этом снимке репозитория **нет отдельной top-level страницы `Locations`** в админке. Локации мира сейчас распределены между:
  - `Cities` (город и его внутренние `locations`)
  - `Zone Editor` (world zones)
  - `Quest Markers`
  - `Battle Maps`
- **EN:** In this repository snapshot there is **no separate top-level `Locations` admin page**. World location logic is currently split across:
  - `Cities` (city and its embedded `locations`)
  - `Zone Editor` (world zones)
  - `Quest Markers`
  - `Battle Maps`

- **RU:** В этом снимке также **есть schema/API для `itemSets`**, но **нет отдельной frontend-страницы** для их редактирования.
- **EN:** This snapshot also has **schema/API support for `itemSets`**, but **no dedicated frontend page** for editing them.

That matters because the best workflow for content creation depends on what the admin UI actually exposes right now.  
Это важно, потому что лучший workflow для создания контента зависит от того, что админка реально умеет в этой версии.

---

## 3. Status legend / Легенда статусов

- `✅ End-to-end` — **RU:** путь реально проходит от JSON/админки до runtime-логики и UI. **EN:** works from content JSON/admin all the way to runtime and UI.
- `🟡 Partial` — **RU:** логика в коде есть, но путь не полностью подключен или зависит от неиспользуемого события. **EN:** implemented in code, but not fully wired in practice.
- `⚪ Declared only` — **RU:** enum/поле объявлено, но полноценного runtime-поведения не найдено. **EN:** declared in schema, but no complete runtime behavior found.
- `🧩 Free-form ID` — **RU:** это не enum, а произвольный проектный ID (`questId`, `npcId`, `cityId`, etc.). **EN:** not a real enum; it is a project-specific reference ID.

---

## 4. Admin sections and what they are for / Разделы админки и зачем они нужны

| Section | RU | EN | Needed for quests? |
|---|---|---|---|
| `Overview` | Общий обзор, не основной инструмент создания контента | Overview page, not a primary content authoring tool | Optional |
| `Backup` | Импорт/экспорт/резервные копии | Import/export/backup | Optional but useful |
| `Items` | Обычные предметы, награды, требования, экипировка NPC, товары торговцев | Regular items, rewards, requirements, NPC equipment, merchant stock | Often |
| `Item Sets` | В текущем snapshot отдельной страницы нет | No dedicated page in this snapshot | Optional |
| `Skills` | Навыки как награда, требование, обучение у NPC, контент боёв | Skills as rewards, requirements, training, combat content | Often |
| `Quests` | Основное описание квеста: steps, objectives, triggers, rewards, conditions | Main quest definition: steps, objectives, triggers, rewards, conditions | Required |
| `Quest Items` | Отдельный инвентарь для квестовых предметов | Separate inventory for quest items | Sometimes required |
| `Quest Interactions` | Интеракции по зонам/объектам/исследованию | Zone/object/inspection interactions | Very useful |
| `NPCs` | Квестодатели, цели, враги, тренеры, торговцы | Quest givers, targets, enemies, trainers, merchants | Often |
| `Dialogues` | Старт/продолжение/завершение квеста через выборы | Start/continue/finish quests through dialogue choices | One of the safest triggers |
| `Merchants` | Магазины, награды вида `openShop`, ассортимент товаров | Shops, `openShop` actions, stock | Optional |
| `Materials` | Крафтовые материалы и loot ecosystem | Crafting materials and loot ecosystem | Optional |
| `Loot Tables` | Добыча для NPC/сундуков/регионов | Loot for NPC/chests/regions | Optional |
| `Images` | Арт для предметов, городов, диалогов, battle maps | Art assets for items, cities, dialogues, battle maps | Optional but recommended |
| `Cities` | Города и их внутренние точки (`locations`) | Cities and their internal map points (`locations`) | Useful for city quests |
| `Zone Editor` | World zones, region gates, quest areas, world quest markers flow | World zones, region gates, quest areas | Very useful |
| `Battle Maps` | Боевые карты для encounter-based content | Battle maps for encounter-based content | Optional |

---

## 5. Best creation order for a quest / Лучший порядок создания квеста

### Recommended pipeline / Рекомендуемый pipeline

1. **Decide the quest entry point / Определить точку входа**
   - **RU:** Самые безопасные точки входа сейчас — `dialogue` и `zone_enter` / `zone_inspect`.
   - **EN:** The safest entry points right now are `dialogue` and `zone_enter` / `zone_inspect`.

2. **Create supporting references first / Сначала создать все зависимости**
   - **RU:** Если квест выдает предмет, квестовый предмет, скилл, открывает магазин, ссылается на NPC, город, зону или battle map — сначала создайте эти сущности.
   - **EN:** If the quest grants an item, quest item, skill, opens a shop, references an NPC, city, zone, or battle map, create those entities first.

3. **Create the NPC and dialogue early / Рано создать NPC и диалог**
   - **RU:** Если квест стартует через разговор, сначала сделайте NPC + Dialogue, потом сам Quest.
   - **EN:** If the quest starts through conversation, create NPC + Dialogue before finalizing the Quest.

4. **Create the quest itself / Создать сам квест**
   - **RU:** Сначала делайте минимально рабочий квест: 1 step, 1 objective, 1 trigger, 1 reward.
   - **EN:** Start with a minimal working quest: 1 step, 1 objective, 1 trigger, 1 reward.

5. **Bind the world touchpoint / Привязать world touchpoint**
   - **RU:** Добавьте зону, marker, city location, NPC dialogue или interaction, которая реально приводит игрока к квесту.
   - **EN:** Add the actual world touchpoint that leads the player to the quest: zone, marker, city location, NPC dialogue, or interaction.

6. **Only then add branching / Только потом добавлять ветвления**
   - **RU:** Сначала добейтесь end-to-end прохождения. Потом усложняйте.
   - **EN:** First make it work end-to-end. Only then add branching and complexity.

### Best practical rule / Главное практическое правило

- **RU:** Лучший квест — это не самый “богатый по JSON”, а тот, у которого **все ссылки созданы заранее** и который использует **runtime-verified triggers/objectives**.
- **EN:** The best quest is not the most “feature-rich JSON”, but the one where **all references exist beforehand** and the quest uses **runtime-verified triggers/objectives**.

---

## 6. What is actually needed for a quest / Что реально нужно для квеста

### Minimum viable quest / Минимально рабочий квест

At minimum you need:

- `Quest`
- one `QuestStep`
- one `QuestObjective`
- one starting path:
  - dialogue action `startQuest` / `start_quest`, **or**
  - quest trigger `map_zone_enter`, **or**
  - a `Quest Interaction`

Минимально вам нужны:

- `Quest`
- один `QuestStep`
- один `QuestObjective`
- один путь запуска:
  - действие диалога `startQuest` / `start_quest`, **или**
  - триггер квеста `map_zone_enter`, **или**
  - `Quest Interaction`

### Common optional dependencies / Частые дополнительные зависимости

| Need | RU | EN |
|---|---|---|
| `NPC` | Нужен, если квест выдается, сдается или связан с персонажем | Needed if the quest is given, turned in, or tied to a character |
| `Dialogue` | Нужен для безопасного старта/развилки/завершения через разговор | Needed for safe start/branch/turn-in through conversation |
| `Quest Item` | Нужен, если предмет должен жить в отдельном квестовом инвентаре | Needed when the item should live in the separate quest inventory |
| `Item` | Нужен для обычных наград, требований, сдачи, экипировки, торговли | Needed for standard rewards, requirements, turn-ins, gear, trading |
| `Skill` | Нужен, если квест дает навык или проверяет навык | Needed if the quest grants or requires a skill |
| `Merchant` | Нужен, если диалог открывает магазин или квест открывает shop content | Needed if dialogue opens a shop or the quest unlocks shop content |
| `Zone Editor` zone | Нужен для enter/inspect-style world progress | Needed for enter/inspect world progress |
| `Battle Map` | Нужен только если квест ведет в боевую карту | Needed only if the quest leads into a battle map |

---

## 7. Safest quest design patterns right now / Самые безопасные паттерны квестов сейчас

### Pattern A — NPC dialogue start / Старт через диалог с NPC

- **RU:** Это самый безопасный способ начать квест.
- **EN:** This is the safest way to start a quest.

Flow:

1. Create `NPC`
2. Create `Dialogue`
3. In a dialogue choice use `startQuest` or `start_quest`
4. Create a quest objective like `choose_dialogue`, `enter_zone`, or `inspect_object`

### Pattern B — Enter zone / Старт при входе в зону

- **RU:** Один из самых надежных world-map путей.
- **EN:** One of the most reliable world-map paths.

Flow:

1. Create zone in `Zone Editor`
2. Create `Quest`
3. Add trigger `map_zone_enter`
4. Use objective `enter_zone`

### Pattern C — Inspect zone / Исследование зоны

- **RU:** Хорошо работает для “осмотреть объект / найти след / прочитать надпись”.
- **EN:** Works well for “inspect object / find clue / read inscription”.

Flow:

1. Create zone
2. Create `Quest Interaction` with trigger `zone_inspect`
3. Add effects such as `start_quest`, `complete_objective`, `give_item`

### Patterns to avoid for now / Что лучше не ставить в основу квеста прямо сейчас

- `deliver_item` as the only objective
- `wait_time`
- `learn_profession`
- `read_book`
- `escort_npc`
- quest interaction effects that rely on UI-opening events (`open_dialogue`, `open_shop`, `start_combat`)

**RU:** Эти вещи частично объявлены, но не выглядят как самый надежный end-to-end путь в текущем runtime.  
**EN:** These are declared or partially implemented, but they are not the most reliable end-to-end flow in the current runtime.

---

## 8. Quest tutorial / Туториал по созданию квеста

### 8.1 Minimal quest JSON / Минимальный JSON квеста

```json
{
  "id": "quest_feralas_intro",
  "title": "Ashes in the Camp",
  "adminDescription": "Starter quest for the Feralas cult camp.",
  "playerDescription": "Speak with Vaern and inspect the burnt center of the camp.",
  "category": "npc",
  "status": "active",
  "npcId": "npc_vaern_flamebearer",
  "isRepeatable": false,
  "isHidden": false,
  "steps": [
    {
      "id": "step_1",
      "questId": "quest_feralas_intro",
      "title": "Inspect the camp",
      "journalText": "Vaern told you to inspect the burnt center of the camp.",
      "order": 0,
      "objectives": [
        {
          "id": "obj_inspect_center",
          "type": "inspect_object",
          "description": "Inspect the burnt center of the camp.",
          "zoneId": "zone_feralas_burnt_center"
        }
      ]
    }
  ],
  "triggers": [],
  "conditions": [],
  "rewards": [
    {
      "id": "reward_gold",
      "type": "gold",
      "amount": 30
    }
  ],
  "failureConsequences": []
}
```

### 8.2 What each quest block means / Что означает каждый блок квеста

| Field | RU | EN |
|---|---|---|
| `id` | Уникальный строковый ID | Unique string ID |
| `title` | Название квеста | Quest title |
| `adminDescription` | Внутреннее описание для контент-команды | Internal description for the content team |
| `playerDescription` | Текст для игрока | Player-facing description |
| `category` | Контентная категория квеста | Content category |
| `status` | Состояние публикации | Publishing state |
| `npcId` | Привязка к NPC, если это NPC-квест | NPC reference if this is an NPC-driven quest |
| `steps` | Этапы квеста | Quest stages |
| `objectives` | Конкретные цели этапа | Specific goals for the stage |
| `triggers` | Автостарт/автотриггеры | Auto-start / auto-triggers |
| `conditions` | Условия старта | Start conditions |
| `rewards` | Награды | Rewards |
| `failureConsequences` | Последствия провала | Failure consequences |

### 8.3 Recommended quest creation recipe / Рекомендуемый рецепт создания квеста

1. **Create the quest in `draft` first**
   - **RU:** Пока не готовы все ссылки, держите `status: "draft"`.
   - **EN:** Keep `status: "draft"` until all references are ready.

2. **Add exactly one step**
   - **RU:** Не начинайте с 5 шагов. Сначала сделайте 1 рабочий шаг.
   - **EN:** Do not start with 5 steps. Make 1 working step first.

3. **Use a reliable objective**
   - **RU:** Лучше начать с `enter_zone`, `inspect_object`, `choose_dialogue`.
   - **EN:** Start with `enter_zone`, `inspect_object`, or `choose_dialogue`.

4. **Add only one reward at first**
   - **RU:** Золото или предмет — лучше всего для smoke test.
   - **EN:** Gold or an item is best for a smoke test.

5. **Only after successful test add branching, conditions, extra rewards**
   - **RU:** Не усложняйте до первой рабочей версии.
   - **EN:** Do not add complexity before the first working version.

### 8.4 Quest enum reference / Справочник enum-значений квестов

#### Quest category / `QuestCategory`

| Value | RU | EN |
|---|---|---|
| `global` | Глобальный квест | Global quest |
| `kingdom` | Квест королевства | Kingdom quest |
| `faction` | Фракционный квест | Faction quest |
| `profession` | Квест профессии | Profession quest |
| `lore` | Лоровый квест | Lore quest |
| `city` | Городской квест | City quest |
| `npc` | NPC-квест | NPC quest |
| `random` | Случайный квест | Random quest |
| `hidden` | Скрытый квест | Hidden quest |
| `repeatable` | Повторяемый квест | Repeatable quest |

#### Quest status / `QuestStatus`

| Value | RU | EN |
|---|---|---|
| `draft` | Черновик | Draft |
| `active` | Активен | Active |
| `disabled` | Отключен | Disabled |
| `archived` | Архив | Archived |

#### Quest objective types / `QuestObjectiveType`

| Value | Status | RU | EN |
|---|---|---|---|
| `talk_to_npc` | 🟡 | Есть runtime-обработка, но явный emitter `npc_talk` в UI не найден | Runtime exists, but no clear `npc_talk` emitter found in UI |
| `enter_zone` | ✅ | Надежная цель через `zone_enter` | Reliable objective through `zone_enter` |
| `reach_marker` | 🟡 | Есть обработка, но marker event path не выглядит общим и надежным | Handler exists, but marker event path is not clearly fully wired |
| `kill_enemy` | 🟡 | Есть runtime-case, но не найден общий emitter `enemy_killed` | Runtime case exists, but no general `enemy_killed` emitter found |
| `collect_item` | 🟡 | Есть runtime-case, но не найден общий emitter `item_pickup` | Runtime case exists, but no general `item_pickup` emitter found |
| `deliver_item` | ⚪ | Объявлено, но не найдено end-to-end поведение | Declared, but no end-to-end behavior found |
| `use_item` | 🟡 | Есть runtime-case, но не найден общий UI emitter | Runtime case exists, but no general UI emitter found |
| `pay_gold` | ⚪ | Объявлено, но не подтверждено end-to-end | Declared, not confirmed end-to-end |
| `receive_gold` | ⚪ | Объявлено, но не подтверждено end-to-end | Declared, not confirmed end-to-end |
| `choose_dialogue` | ✅ | Надежная цель через `dialogue_choice` | Reliable objective through `dialogue_choice` |
| `craft_item` | ⚪ | Только schema-level | Schema-level only |
| `learn_profession` | ⚪ | Только schema-level | Schema-level only |
| `gain_reputation` | ⚪ | Только schema-level | Schema-level only |
| `wait_time` | ⚪ | Только schema-level | Schema-level only |
| `read_book` | ⚪ | Только schema-level | Schema-level only |
| `inspect_object` | ✅ | Надежная цель через `zone_inspect` | Reliable objective through `zone_inspect` |
| `survive_battle` | 🟡 | Есть runtime-case, но не найден общий `battle_won` emitter | Runtime case exists, but no general `battle_won` emitter found |
| `escort_npc` | ⚪ | Только schema-level | Schema-level only |

#### Quest trigger types / `QuestTriggerType`

| Value | Status | RU | EN |
|---|---|---|---|
| `npc_dialogue` | ✅ | Хороший старт через диалог, особенно `dialogue_choice` | Good start through dialogue, especially `dialogue_choice` |
| `map_marker` | 🟡 | Обработчик есть, но marker event path не подтвержден как общий | Handler exists, but marker event path is not confirmed as a common flow |
| `map_zone_enter` | ✅ | Один из лучших world triggers | One of the best world triggers |
| `item_use` | 🟡 | Логика есть, но runtime event path не найден полностью | Logic exists, but the runtime event path is not fully found |
| `enemy_death` | 🟡 | Логика есть, но emitter не найден | Logic exists, but no emitter found |
| `global_event` | ⚪ | Объявлено, runtime-case не найден | Declared, no runtime case found |
| `profession_unlock` | ⚪ | Объявлено, runtime-case не найден | Declared, no runtime case found |
| `manual_admin` | 🟡 | Логика есть, но не основной player-facing путь | Logic exists, but not a primary player-facing path |
| `random_zone_roll` | ✅ | Работает с zone random pool при корректном `chancePercent/cooldownSeconds` | Works with zone random pool when `chancePercent/cooldownSeconds` are set correctly |

#### Quest reward types / `QuestRewardType`

| Value | Status | RU | EN |
|---|---|---|---|
| `gold` | ✅ | Выдача золота работает | Gold reward works |
| `experience` | ✅ | Выдача опыта работает | Experience reward works |
| `item` | ✅ | Выдача обычного предмета работает | Regular item reward works |
| `quest_item` | ✅ | Выдача квестового предмета работает | Quest item reward works |
| `reputation` | ✅ | Репутация записывается | Reputation is stored |
| `title` | ✅ | Линия награды/состояние формируется | Reward/title state is recorded |
| `profession` | 🟡 | Упоминается, но полноценного storage-flow не видно | Mentioned, but a full storage flow is not obvious |
| `skill` | ✅ | Скилл-награда поддерживается | Skill reward is supported |
| `recipe` | ✅ | Reward line поддерживается | Reward line is supported |
| `unlock_dialogue` | ✅ | Сохраняется как разблокировка/награда | Saved as unlock/reward |
| `unlock_location` | ✅ | Сохраняется как разблокировка/награда | Saved as unlock/reward |
| `unlock_shop` | ✅ | Сохраняется как награда | Saved as reward |
| `faction_access` | ✅ | Сохраняется как награда | Saved as reward |
| `lore_entry` | ✅ | Сохраняется как награда | Saved as reward |

#### Quest condition types / `QuestConditionType`

| Value | Status | RU | EN |
|---|---|---|---|
| `player_level` | ✅ | Работает | Works |
| `player_race` | ✅ | Работает | Works |
| `player_class` | 🟡 | Поддерживается, но class data не всегда подается вызывающим кодом | Supported, but caller code does not always supply class data |
| `player_profession` | 🟡 | Поддерживается, но profession data не всегда подается вызывающим кодом | Supported, but caller code does not always supply profession data |
| `kingdom_reputation` | ✅ | Работает | Works |
| `faction_reputation` | ✅ | Работает | Works |
| `has_item` | ✅ | Работает | Works |
| `has_not_item` | ✅ | Работает | Works |
| `quest_completed` | ✅ | Работает | Works |
| `quest_not_completed` | ✅ | Работает | Works |
| `quest_active` | ✅ | Работает | Works |
| `npc_alive` | ⚪ | Явно не поддержано в evaluator | Explicitly unsupported in evaluator |
| `npc_dead` | ⚪ | Явно не поддержано в evaluator | Explicitly unsupported in evaluator |
| `time_of_day` | ✅ | Работает | Works |
| `in_city` | 🟡 | Проверка есть, но city context не всегда передается | Check exists, but city context is not always passed |
| `in_kingdom` | 🟡 | Проверка есть, но kingdom context не всегда передается | Check exists, but kingdom context is not always passed |
| `stat_check` | ⚪ | Объявлено, но evaluator не поддерживает | Declared, but evaluator does not support it |
| `flag_true` | ✅ | Работает | Works |
| `flag_false` | ✅ | Работает | Works |
| `gold_at_least` | ✅ | Работает | Works |

---

## 9. Quest interactions tutorial / Туториал по Quest Interactions

### When to use Quest Interactions / Когда использовать Quest Interactions

- **RU:** Используйте их для “осмотреть”, “войти”, “кликнуть объект”, “получить реакцию от зоны”.
- **EN:** Use them for “inspect”, “enter”, “click object”, “get zone reaction”.

### Minimal Quest Interaction JSON / Минимальный JSON Quest Interaction

```json
{
  "id": "qi_feralas_burnt_center",
  "title": "Burnt Center Inspection",
  "triggerType": "zone_inspect",
  "zoneId": "zone_feralas_burnt_center",
  "text": "Ash and broken ritual stones cover the ground.",
  "isActive": true,
  "requirements": [],
  "choices": [
    {
      "id": "inspect_choice",
      "text": "Search the ashes",
      "effects": [
        {
          "type": "complete_objective",
          "questId": "quest_feralas_intro",
          "objectiveId": "obj_inspect_center"
        },
        {
          "type": "give_item",
          "itemId": "item_ash_fragment"
        }
      ],
      "close": true
    }
  ]
}
```

### Quest Interaction trigger types / `QuestInteractionTriggerType`

| Value | Status | RU | EN |
|---|---|---|---|
| `zone_inspect` | ✅ | Надежный trigger | Reliable trigger |
| `zone_enter` | ✅ | Надежный trigger | Reliable trigger |
| `marker_reached` | 🟡 | Тип поддержан, но общий path не подтвержден | Type is supported, but common path not confirmed |
| `object_interact` | 🟡 | Тип поддержан, но emitter не найден | Type is supported, but no emitter found |
| `item_use` | 🟡 | Тип поддержан, но emitter не найден | Type is supported, but no emitter found |
| `npc_interact` | 🟡 | Тип поддержан, но emitter не найден | Type is supported, but no emitter found |
| `manual` | 🟡 | Полезно для внутренних тестов, но не основной world flow | Useful for internal tests, not a primary world flow |

### Quest Interaction requirement types / `QuestInteractionRequirementType`

All of the following are implemented in the requirement evaluator.  
Все следующие значения реализованы в requirement evaluator.

`quest_not_started`, `quest_active`, `quest_completed`, `quest_failed`, `objective_completed`, `objective_not_completed`, `step_completed`, `step_not_completed`, `has_item`, `missing_item`, `has_quest_item`, `missing_quest_item`, `has_skill`, `missing_skill`, `has_flag`, `flag_equals`, `race_is`, `class_is`, `level_min`, `level_max`, `faction_relation_min`

### Quest Interaction effect types / `QuestInteractionEffectType`

| Value | Status | RU | EN |
|---|---|---|---|
| `complete_objective` | ✅ | Надежно | Reliable |
| `complete_step` | ✅ | Надежно | Reliable |
| `complete_quest` | ✅ | Надежно | Reliable |
| `start_quest` | ✅ | Надежно | Reliable |
| `fail_quest` | ✅ | Надежно | Reliable |
| `give_rewards` | ✅ | Работает | Works |
| `give_item` | ✅ | Работает | Works |
| `take_item` | ✅ | Работает | Works |
| `give_quest_item` | ✅ | Работает | Works |
| `take_quest_item` | ✅ | Работает | Works |
| `give_skill` | ✅ | Работает | Works |
| `give_gold` | ✅ | Работает | Works |
| `give_experience` | ✅ | Работает | Works |
| `set_flag` | ✅ | Работает | Works |
| `unlock_location` | ✅ | Сохраняет unlock/reward line | Saves unlock/reward line |
| `unlock_dialogue` | ✅ | Сохраняет unlock/reward line | Saves unlock/reward line |
| `open_dialogue` | 🟡 | Runtime event формируется, но UI consumer не найден | Runtime event is created, but no UI consumer was found |
| `open_shop` | 🟡 | Runtime event формируется, но UI consumer не найден для interaction path | Runtime event is created, but no UI consumer was found for the interaction path |
| `start_combat` | 🟡 | Runtime event формируется, но UI consumer не найден для interaction path | Runtime event is created, but no UI consumer was found for the interaction path |

### Best rule for Quest Interactions / Лучшее правило для Quest Interactions

- **RU:** Используйте их прежде всего для **state changes**, а не для сложного UI orchestration.
- **EN:** Use them primarily for **state changes**, not for complex UI orchestration.

---

## 10. Dialogue tutorial / Туториал по диалогам в связке с квестами

### Why dialogues are important / Почему диалоги так важны

- **RU:** Диалоги — один из самых надежных способов стартовать, продолжать и завершать квест.
- **EN:** Dialogues are one of the most reliable ways to start, continue, and finish quests.

### Minimal dialogue example / Минимальный пример диалога

```json
{
  "id": "dlg_vaern_intro",
  "title": "Vaern - First Contact",
  "npcId": "npc_vaern_flamebearer",
  "status": "active",
  "startNodeId": "node_start",
  "nodes": [
    {
      "id": "node_start",
      "speaker": "npc",
      "text": "The camp is wounded, but not dead. Will you help?",
      "choices": [
        {
          "id": "choice_accept",
          "text": "Yes. Tell me what to do.",
          "endsDialogue": true,
          "actions": [
            {
              "id": "act_start_quest",
              "type": "start_quest",
              "questId": "quest_feralas_intro"
            }
          ]
        }
      ]
    }
  ]
}
```

### Dialogue conditions / `DialogueCondition.type`

| Value | Status | RU | EN |
|---|---|---|---|
| `quest_not_started` | ✅ | Работает | Works |
| `quest_active` | ✅ | Работает | Works |
| `quest_completed` | ✅ | Работает | Works |
| `quest_failed` | ✅ | Работает | Works |
| `objective_completed` | ✅ | Работает | Works |
| `objective_not_completed` | ✅ | Работает | Works |
| `has_item` | ✅ | Работает | Works |
| `missing_item` | ✅ | Работает | Works |
| `has_quest_item` | ✅ | Работает | Works |
| `missing_quest_item` | ✅ | Работает | Works |
| `has_skill` | ✅ | Работает | Works |
| `missing_skill` | ✅ | Работает | Works |
| `has_flag` | ✅ | Работает | Works |
| `flag_equals` | ✅ | Работает | Works |
| `race_is` | ✅ | Работает | Works |
| `class_is` | ✅ | Работает | Works |
| `level_min` | ✅ | Работает | Works |
| `level_max` | ✅ | Работает | Works |
| `faction_relation_min` | ✅ | Работает | Works |
| `player_level` | ✅ | Работает | Works |
| `player_race` | ✅ | Работает | Works |
| `player_profession` | ✅ | Работает | Works |
| `faction_reputation` | ✅ | Работает | Works |
| `kingdom_reputation` | ✅ | Работает | Works |
| `gold_at_least` | ✅ | Работает | Works |
| `npc_disposition` | ✅ | Работает | Works |
| `time_of_day` | ⚪ | Объявлено, но runtime-case не найден в dialogue evaluator | Declared, but no runtime case found in the dialogue evaluator |
| `global_flag` | ✅ | Работает | Works |
| `quest_flag` | 🟡 | Выглядит как bug/partial path: читается не как отдельный quest-flag storage | Looks like a bug/partial path: not read as a dedicated quest-flag storage |

### Dialogue actions / `DialogueAction.type`

#### Fully reliable or mostly reliable / Надежные или почти надежные

`startQuest`, `start_quest`, `completeObjective`, `complete_objective`, `completeStep`, `complete_step`, `advanceQuest`, `completeQuest`, `complete_quest`, `failQuest`, `fail_quest`, `giveRewards`, `give_rewards`, `setQuestFlag`, `set_flag`, `giveItem`, `give_item`, `takeItem`, `take_item`, `giveQuestItem`, `give_quest_item`, `takeQuestItem`, `take_quest_item`, `giveGold`, `give_gold`, `takeGold`, `take_gold`, `giveExperience`, `give_experience`, `addReputation`, `openShop`, `open_shop`, `startCombat`, `start_combat`, `trainSkill`, `give_skill`

#### Partial / Частичные

| Value | RU | EN |
|---|---|---|
| `unlockLocation` / `unlock_location` | Event/log path есть, но richer UI/open flow не подтвержден | Event/log path exists, but richer UI/open flow is not confirmed |
| `unlockDialogue` / `unlock_dialogue` | Event/log path есть, но полноценный unlock UI-path не подтвержден | Event/log path exists, but a full unlock UI path is not confirmed |
| `openDialogue` / `open_dialogue` | Выглядит partial, не как надежный “open now” flow | Looks partial, not like a reliable “open now” flow |
| `setNpcDisposition` | Лог формируется, но не видно полноценного системного эффекта | Produces log-like behavior, but no full system effect is obvious |
| `setGlobalFlag` | Работает как запись global flag | Works as global flag storage update |

#### Declared but not confirmed / Объявлено, но не подтверждено

- `open_training` / `openTraining`

**RU:** Для обучения скиллу безопаснее сейчас ориентироваться на `trainSkill` / `give_skill`, а не на `open_training`.  
**EN:** For skill teaching, it is currently safer to rely on `trainSkill` / `give_skill` than on `open_training`.

---

## 11. Skills tutorial / Туториал по созданию скиллов

### What a skill is in this project / Что такое скилл в этом проекте

- **RU:** Скилл — это не просто “иконка и урон”. Это пакет из:
  - targeting
  - resource cost
  - damage/healing/effects
  - acquisition methods
  - requirements
  - cooldown
  - cast profile
  - race/class modifiers
  - rune/shamanism extensions
- **EN:** A skill here is not just “icon + damage”. It is a bundle of:
  - targeting
  - resource cost
  - damage/healing/effects
  - acquisition methods
  - requirements
  - cooldown
  - cast profile
  - race/class modifiers
  - rune/shamanism extensions

### Minimal skill JSON / Минимальный JSON скилла

```json
{
  "id": "skill_vaern_flame_mark",
  "name": "Flame Mark",
  "slug": "flame-mark",
  "type": "magic",
  "subtypes": ["spell"],
  "iconUrl": "",
  "shortDescription": "Marks one enemy with fire.",
  "gameplayDescription": "Deals light fire damage and may apply burn.",
  "loreDescription": "A simple ritual flame sigil used by Vaern's circle.",
  "isActive": true,
  "isPassive": false,
  "isToggleable": false,
  "maxLevel": 5,
  "levels": [
    { "level": 1, "basePower": 5 },
    { "level": 2, "basePower": 10 },
    { "level": 3, "basePower": 15 },
    { "level": 4, "basePower": 20 },
    { "level": 5, "basePower": 25 }
  ],
  "target": {
    "targetType": "single_enemy",
    "range": 4,
    "canTargetSelf": false,
    "canTargetAllies": false,
    "canTargetEnemies": true,
    "canTargetDead": false
  },
  "costs": {
    "resources": [
      { "type": "mp", "amount": 8 }
    ],
    "allowClassModifiers": true,
    "allowRaceModifiers": true,
    "allowEquipmentModifiers": true,
    "isFree": false
  },
  "damage": [
    {
      "id": "damage_1",
      "damageKind": "elemental",
      "elements": ["fire"],
      "minDamage": 4,
      "maxDamage": 7,
      "canCrit": true
    }
  ],
  "healing": [],
  "effects": [
    {
      "id": "effect_burn",
      "effectType": "burn",
      "chancePercent": 25,
      "durationTurns": 2,
      "stackMode": "refresh",
      "dispellable": true
    }
  ],
  "summons": [],
  "transformations": [],
  "risks": [],
  "rune": {
    "usesRunes": false,
    "runeIds": [],
    "requiredRuneIds": [],
    "bindingRuneIds": [],
    "runeCosts": [],
    "removable": true,
    "canDestroyHost": false
  },
  "shamanism": {
    "requiresSpirit": false,
    "requiresContract": false,
    "canSummonEntity": false,
    "canMakeContract": false,
    "canLoseControl": false
  },
  "requirements": {},
  "acquisition": {
    "methods": [
      { "type": "quest_reward", "questId": "quest_feralas_intro" }
    ],
    "isStarterSkill": false,
    "isQuestReward": true,
    "isBuyable": false,
    "isDiscoverable": false,
    "isAdminOnly": false
  },
  "classScaling": [],
  "raceRules": [],
  "cooldown": { "cooldownTurns": 1 },
  "cast": {
    "castType": "instant",
    "requiresLineOfSight": true,
    "canBeInterrupted": false
  },
  "tags": ["fire", "cult", "quest_reward"],
  "isPublished": true,
  "isHidden": false,
  "acquisitionMode": "quest",
  "isTrainable": false,
  "requiredClassIds": [],
  "requiredRaceIds": [],
  "requiredKnownSkillIds": []
}
```

### Skill enums / Справочник enum-значений скиллов

#### `SkillType`

`physical`, `magic`, `elemental_magic`, `normal_magic`, `forbidden_magic`, `shamanism`, `rune`, `mixed`, `passive`

#### `SkillSubtype`

`melee`, `ranged`, `spell`, `chant`, `ritual`, `totem`, `contract`, `curse`, `blessing`, `heal`, `summon`, `transformation`, `control`, `aura`, `rune_mark`, `weapon_technique`

#### `SkillResourceType`

`mp`, `stamina`, `hp`, `blood`, `memory`, `soul`, `rune_charge`, `spirit_favor`, `item`

#### `DamageKind`

`physical`, `elemental`, `magic`, `spiritual`, `rune`, `forbidden`, `true`

#### `PhysicalDamageType`

`slashing`, `piercing`, `blunt`

#### `ElementType`

`fire`, `water`, `earth`, `air`, `light`, `darkness`

#### `MagicSchoolType`

`elemental`, `normal`, `life`, `death`, `blood`, `mind`, `shadow`, `illusion`, `necromancy`, `forbidden`

#### `HealType`

`direct`, `over_time`, `cleanse`, `shield`, `life_steal`

#### `EffectType`

`burn`, `bleed`, `poison`, `curse`, `stun`, `knockdown`, `root`, `slow`, `silence`, `fear`, `confusion`, `blind`, `weakness`, `armor_break`, `resistance_break`, `crit_chance_buff`, `damage_buff`, `defense_buff`, `dodge_buff`, `heal_over_time`, `shield`, `transform`, `mana_burn`, `stamina_drain`

#### `EffectStackMode`

`refresh`, `stack`, `replace`, `ignore`

#### `SkillTargetType`

`self`, `single_ally`, `single_enemy`, `any_single`, `all_allies`, `all_enemies`, `area`, `cone`, `line`, `global`

#### `SkillAreaShape`

`circle`, `cone`, `line`, `ring`, `field`

#### `CastType`

`instant`, `cast_time`, `channeling`, `ritual`, `toggle`

#### `StatType`

`hp`, `mp`, `stamina`, `strength`, `constitution`, `dexterity`, `intelligence`, `luck`, `perception`, `willpower`

#### `AcquisitionType`

`starting`, `teacher`, `shop`, `quest_reward`, `book`, `item`, `location_discovery`, `rune_discovery`, `spirit_contract`, `demon_contract`, `admin_grant`

#### `SkillAvailabilityChannel`

`trainer`, `quest`, `dialogue`, `item`, `hidden`, `admin`

#### `SkillClassRole`

`master`, `proficient`, `neutral`, `penalized`, `forbidden`

#### `SkillRiskType`

`fail_cast`, `backfire_damage`, `self_stun`, `self_burn`, `blood_loss`, `memory_loss`, `soul_damage`, `demonic_possession`, `spirit_anger`, `rune_overload`, `transformation_lock`, `friendly_fire`, `random_target`

#### `RiskSeverity`

`low`, `medium`, `high`, `extreme`

#### `SpiritType`

`ancestor`, `beast`, `nature`, `fire`, `water`, `earth`, `air`, `shadow`, `demon`, `unknown`

#### `SummonType`

`spirit`, `demon`, `beast`, `undead`, `elemental`, `illusion`

#### `SummonControlType`

`direct`, `ai`, `risky`, `uncontrolled`

### Skill authoring rules / Практические правила для создания скиллов

- **RU:** Если скилл магический, обязательно проверяйте `type`, `damageKind`, `elements` / `magicSchool`.
- **EN:** If the skill is magical, always check `type`, `damageKind`, and `elements` / `magicSchool`.

- **RU:** Если скилл требует расу, осторожно используйте race IDs: для `requiredRaceIds` безопаснее использовать runtime-style IDs вроде `HUMAN`, `DWARF`, `HIGH_ELF`, `WOOD_ELF`.
- **EN:** If the skill requires race restrictions, be careful with race IDs: for `requiredRaceIds`, the safest choice is runtime-style IDs like `HUMAN`, `DWARF`, `HIGH_ELF`, `WOOD_ELF`.

- **RU:** `raceRules[].raceId` выглядит терпимее и принимает, например, `DWARF` и `race_dwarf`, но лучше не смешивать стили без необходимости.
- **EN:** `raceRules[].raceId` looks more tolerant and accepts values like `DWARF` and `race_dwarf`, but avoid mixing styles unless necessary.

- **RU:** Активный скилл должен либо иметь cost, либо быть явно `isFree`.
- **EN:** An active skill should either have a cost or be explicitly `isFree`.

---

## 12. Items tutorial / Туториал по предметам

### Minimal item JSON / Минимальный JSON предмета

```json
{
  "id": "item_ash_fragment",
  "name": "Ash Fragment",
  "type": "misc",
  "slot": "none",
  "rarity": "common",
  "price": 5,
  "stackable": true,
  "maxStack": 20,
  "bonuses": {},
  "equipmentEffects": [],
  "useEffects": [],
  "gameplayDescription": "A fragment of ritual ash.",
  "loreDescription": "Collected from the ruins of the cult camp.",
  "isEnabled": true
}
```

### Item enums / Справочник enum-значений предметов

#### `ItemType`

`weapon`, `armor`, `potion`, `material`, `quest`, `misc`

#### `ItemSlot`

`head`, `necklace`, `chest`, `outerwear`, `belt`, `leftHand`, `rightHand`, `gloves`, `legs`, `boots`, `ring`, `trinket`, `charm`, `quick`, `none`

#### `HandsRequired`

`1`, `2`

#### `ItemRarity`

`common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic`, `forbidden`

#### `DamageCategory`

`physical`, `elemental`, `magic`, `shamanic`, `runic`, `poison`, `bleed`, `true`

#### `PhysicalType`

`slash`, `pierce`, `blunt`, `cleave`, `unarmed`

#### `ElementType`

`fire`, `water`, `earth`, `air`, `light`, `dark`

#### `MagicSchool`

`blood`, `death`, `life`, `mind`, `illusion`, `curse`, `arcane`

#### `ItemEffectType`

`stat_bonus`, `incoming_damage_modifier`, `outgoing_damage_modifier`, `armor_penetration`, `crit_chance_modifier`, `crit_damage_modifier`, `crit_chance_taken_modifier`, `lifesteal`, `apply_status`, `status_resistance`, `status_immunity`, `block_chance_modifier`, `dodge_chance_modifier`, `hit_chance_modifier`, `extra_attack_chance`

#### Item effect triggers / `ItemEffect.trigger`

`on_hit`, `on_crit`, `on_use`, `on_turn_start`, `on_turn_end`, `always`

#### `ItemAugmentType`

`rune`, `magic_stone`, `enchantment`, `other`

#### `ItemSocketSource`

`base`, `blacksmith_added`, `scripted`

#### Slot upgrade failure modes / `SlotUpgradeRules.failureModes`

`none`, `material_lost`, `item_damaged`, `slot_locked`

### Item best practices / Лучшие практики по предметам

- **RU:** Для `material` безопасно использовать `slot: "none"`.
- **EN:** For `material`, use `slot: "none"` safely.

- **RU:** Для `potion` при ручном JSON лучше явно ставить `slot: "quick"`.
- **EN:** For potions, when authoring JSON manually, explicitly set `slot: "quick"`.

- **RU:** Для `weapon` лучше явно задавать `slot`, `handsRequired`, `damageMin`, `damageMax`.
- **EN:** For weapons, explicitly set `slot`, `handsRequired`, `damageMin`, and `damageMax`.

- **RU:** Если предмет выдается квестом, не делайте его `quest item`, если он должен жить в обычном инвентаре. Для отдельного квестового инвентаря используйте `Quest Items`.
- **EN:** If a quest grants an item, do not make it a `quest item` unless it should live in the dedicated quest inventory. Use `Quest Items` for that.

### Related economy/content enums / Связанные enum-значения экономики и контента

#### `MerchantType`

`blacksmith`, `alchemist`, `general`, `rune_master`, `material_trader`, `rare_goods`, `other`

#### `MaterialCategory`

`metal`, `wood`, `leather`, `cloth`, `herb`, `stone`, `crystal`, `bone`, `other`

#### `LootSourceType`

`npc`, `monster`, `chest`, `region`, `quest`, `merchant_special`

#### `ImagePresetId`

`item-icon`, `merchant-portrait`, `battle-map-background`

---

## 13. Item sets tutorial / Туториал по сетам предметов

### Snapshot limitation / Ограничение текущего snapshot

- **RU:** `ItemSet` поддерживается schema/API/backend, но отдельной страницы редактирования в текущем frontend snapshot нет.
- **EN:** `ItemSet` is supported by schema/API/backend, but there is no dedicated editing page in the current frontend snapshot.

### Minimal item set JSON / Минимальный JSON сета

```json
{
  "id": "set_feralas_ashbound",
  "name": "Ashbound Vestments",
  "pieceItemIds": [
    "item_ashbound_hood",
    "item_ashbound_robes",
    "item_ashbound_belt"
  ],
  "bonuses": [
    {
      "requiredPieces": 2,
      "description": "+5 intelligence",
      "effects": [
        {
          "type": "stat_bonus",
          "stat": "intelligence",
          "value": 5
        }
      ]
    },
    {
      "requiredPieces": 3,
      "description": "+10% fire damage",
      "effects": [
        {
          "type": "outgoing_damage_modifier",
          "damageCategory": "elemental",
          "elementType": "fire",
          "percent": 10
        }
      ]
    }
  ],
  "isEnabled": true
}
```

### Item set rules / Правила для сетов

- **RU:** Каждый `pieceItemIds[]` должен ссылаться на реально существующий item.
- **EN:** Every `pieceItemIds[]` entry must reference a real item.

- **RU:** Каждый `requiredPieces` должен быть `> 0`.
- **EN:** Every `requiredPieces` must be `> 0`.

- **RU:** `requiredPieces` не может быть больше количества `pieceItemIds`.
- **EN:** `requiredPieces` cannot be greater than the number of `pieceItemIds`.

- **RU:** Чтобы предмет считался частью сета, удобно также прописывать `setId` у самого предмета.
- **EN:** To make the relationship clear, it is also convenient to set `setId` on each item piece itself.

---

## 14. NPC tutorial / Туториал по NPC

### What NPC content usually includes / Что обычно включает NPC-контент

- identity
- race / kingdom / faction / city links
- world map bindings
- dialogues
- quest bindings
- combat profile
- trader or trainer profile
- inventory and loot

### Minimal NPC JSON / Минимальный JSON NPC

```json
{
  "id": "npc_vaern_flamebearer",
  "name": "Vaern Flamebearer",
  "status": "active",
  "kind": "quest_giver",
  "race": "human",
  "cityId": "city_arklein",
  "description": "Leader of the ruined fire camp.",
  "mapBindings": [
    {
      "id": "bind_vaern_world",
      "mapId": "world",
      "zoneId": "zone_feralas_camp",
      "spawnType": "fixed",
      "visibleToPlayer": true
    }
  ],
  "defaultDisposition": "neutral",
  "isUnique": true,
  "canRespawn": false,
  "canFight": false,
  "canTalk": true,
  "canTrade": false,
  "canTrain": false,
  "canGiveQuests": true,
  "canBeKilled": false,
  "dialogues": [
    {
      "dialogueId": "dlg_vaern_intro",
      "priority": 10
    }
  ],
  "questBindings": [
    {
      "questId": "quest_feralas_intro",
      "role": "giver"
    }
  ],
  "createdAt": "2026-05-19T00:00:00.000Z",
  "updatedAt": "2026-05-19T00:00:00.000Z"
}
```

### NPC enums / Справочник enum-значений NPC

#### `NpcStatus`

`draft`, `active`, `disabled`, `archived`

#### `NpcKind`

`civilian`, `quest_giver`, `trader`, `trainer`, `guard`, `enemy`, `boss`, `companion`, `random_encounter`, `story_character`, `monster`, `animal`

#### `NpcRace`

`human`, `high_elf`, `forest_elf`, `ancient_elf`, `dwarf`, `orc`, `dark_elf`, `arin_fellar`, `monster`, `beast`, `undead`, `spirit`, `other`

#### `NpcDispositionMode`

`friendly`, `neutral`, `hostile`, `fearful`, `aggressive_on_sight`, `quest_locked`, `hidden`

#### `NpcCombatRole`

`none`, `melee`, `ranged`, `mage`, `healer`, `tank`, `assassin`, `summoner`, `support`, `beast`

#### `NpcMapBinding.spawnType`

`fixed`, `random_in_zone`, `quest_spawn`, `event_spawn`

#### `NpcQuestBinding.role`

`giver`, `target`, `receiver`, `enemy`, `escort`, `trainer`, `lore_source`

#### `NpcCondition.type`

`quest_active`, `quest_completed`, `quest_not_started`, `quest_failed`, `player_level`, `player_race`, `player_profession`, `faction_reputation`, `kingdom_reputation`, `has_item`, `has_quest_item`, `time_of_day`, `global_flag`, `npc_alive`, `npc_dead`

#### `NpcQuestAction.type`

`startQuest`, `completeObjective`, `advanceQuest`, `completeQuest`, `failQuest`, `setQuestFlag`, `giveItem`, `giveQuestItem`, `takeItem`, `takeQuestItem`, `addReputation`, `giveGold`, `takeGold`, `unlockDialogue`, `unlockLocation`

### NPC validation rules that matter / Важные правила валидации NPC

- **RU:** Активный NPC должен иметь `name` и `kind`.
- **EN:** An active NPC must have `name` and `kind`.

- **RU:** Если `canTrade = true`, должен существовать `traderId`.
- **EN:** If `canTrade = true`, a `traderId` must exist.

- **RU:** Если `canFight = true`, должен существовать блок `combat`.
- **EN:** If `canFight = true`, a `combat` block must exist.

- **RU:** Hostile/aggressive NPC без combat-профиля — ошибка.
- **EN:** A hostile/aggressive NPC without a combat profile is an error.

- **RU:** Говорящий NPC без диалога и без описания — ошибка.
- **EN:** A talking NPC without a dialogue and without description is an error.

### Best NPC workflow for quest content / Лучший workflow NPC для квестового контента

1. Create the NPC shell
2. Add map binding
3. Add dialogue binding
4. Add quest binding
5. Only then add trader/trainer/combat if needed

Сначала делайте “каркас” NPC, а потом навешивайте сложные подсистемы.  
Build the NPC “shell” first, then attach the more complex subsystems.

---

## 15. World content that matters for quests / World-контент, важный для квестов

### Cities / Города

**RU:** Город — это не просто описание. У него есть вложенные `locations`, и они могут содержать `npcIds`, `questIds`, `shopIds`, encounter config и battle map links.  
**EN:** A city is not just flavor text. It has embedded `locations`, and those can contain `npcIds`, `questIds`, `shopIds`, encounter config, and battle map links.

#### City status / `CityStatus`

`active`, `ruined`, `occupied`, `hidden`, `locked`

#### City location type / `CityLocationType`

`gate`, `tavern`, `market`, `blacksmith`, `castle`, `temple`, `arena`, `guild`, `district`, `harbor`, `barracks`, `house`, `dungeon`, `custom`

#### City location shape type / `CityLocationShapeType`

`circle`, `rectangle`, `polygon`

#### City encounter kinds / `CityLocationEncounterKind`

`arena`, `quest`, `event`, `dungeon`, `ambush`

#### City encounter preset types

`pve`, `pvp`, `random`, `scripted`

### Zone Editor / Zone Editor

#### `ZoneType`

`city`, `settlement`, `quest`, `quest_area`, `random_event_area`, `danger_area`, `faction_area`, `kingdom_area`, `city_area`, `resource_area`, `hidden_area`, `story`, `landmark`, `danger`, `grind`, `resource`, `profession`, `dungeon`, `transition`, `safe`, `event`, `faction`, `locked`, `fast_travel`, `rest`

#### `ZoneShape`

`circle`, `polygon`, `rect`

#### `ZoneEditorTool`

`select`, `circle`, `polygon`, `rectangle`, `pan`, `measure`

#### `RegionType`

`walkable`, `blocked`, `water`, `road`, `danger`, `trigger`

### Quest markers / Quest Markers

#### `QuestMarkerType`

`quest_start`, `quest_objective`, `quest_finish`, `npc_quest`, `item_spawn`, `enemy_spawn`, `inspect_object`, `hidden_location`

### Quest zones / `QuestZoneType`

`quest_area`, `random_event_area`, `danger_area`, `faction_area`, `kingdom_area`, `city_area`, `resource_area`, `hidden_area`

### Battle maps / Battle Maps

#### `BattleMapCellType`

`walkable`, `blocked`, `trap`, `difficult`, `water`, `lowCover`, `highCover`

#### `BattleMapSpawnZoneType`

`player`, `enemy`, `neutralNpc`, `reinforcement`

#### `BattleMapObjectType`

`loot`, `container`, `door`, `lever`, `resource`, `questObject`, `decoration`, `cover`, `destructible`

#### `BattleMapTriggerType`

`quest`, `dialogue`, `ambush`, `trap`, `scene`, `exit`, `custom`

#### `BattleMapNpcRole`

`enemy`, `neutral`, `ally`, `merchant`, `questGiver`, `civilian`

---

## 16. Examples of good content chains / Примеры хороших цепочек контента

### Chain 1 — Safe NPC quest / Безопасный NPC-квест

1. `NPC`: `npc_vaern_flamebearer`
2. `Dialogue`: `dlg_vaern_intro`
3. `Quest`: `quest_feralas_intro`
4. `Zone`: `zone_feralas_burnt_center`
5. `Quest Interaction`: `qi_feralas_burnt_center`
6. `Reward Item`: `item_ash_fragment`

**RU:** Это очень хороший первый production-паттерн.  
**EN:** This is a very good first production pattern.

### Chain 2 — City quest / Городской квест

1. Create `City`
2. Add `CityLocation`
3. Bind `npcIds` or `questIds`
4. Use dialogue or quest interaction to progress

### Chain 3 — Skill reward quest / Квест с наградой-скиллом

1. Create `Skill`
2. Create `Quest`
3. Add reward type `skill` or dialogue action `trainSkill` / `give_skill`
4. Verify required references exist

---

## 17. Example JSON bundle / Набор примерных JSON

### Quest item / Квестовый предмет

```json
{
  "id": "quest_item_vaern_seal",
  "name": "Vaern's Seal",
  "description": "A seal used to prove that Vaern sent you.",
  "linkedQuestId": "quest_feralas_intro",
  "canDrop": false,
  "canSell": false,
  "canTrade": false,
  "removeOnQuestComplete": true,
  "showInQuestInventory": true
}
```

### Merchant / Торговец

```json
{
  "id": "merchant_feralas_supplies",
  "name": "Feralas Supplies",
  "city": "Arklein",
  "cityId": "city_arklein",
  "type": "general",
  "priceMultiplier": 1,
  "isEnabled": true,
  "items": [
    {
      "itemId": "item_ash_fragment",
      "infiniteStock": true,
      "isEnabled": true
    }
  ]
}
```

### Material / Материал

```json
{
  "id": "material_burnt_resin",
  "name": "Burnt Resin",
  "category": "herb",
  "region": "feralas",
  "rarity": "common",
  "properties": ["fire", "ritual"],
  "gameplayDescription": "A sticky black residue used in ash rituals.",
  "loreDescription": "It forms when ritual oil burns too long.",
  "isEnabled": true
}
```

### Loot table / Таблица добычи

```json
{
  "id": "loot_feralas_camp_common",
  "name": "Feralas Camp Common Loot",
  "sourceType": "npc",
  "sourceId": "npc_vaern_flamebearer",
  "entries": [
    {
      "itemId": "item_ash_fragment",
      "chance": 0.5,
      "minQuantity": 1,
      "maxQuantity": 2
    }
  ],
  "isEnabled": true
}
```

---

## 18. Seed IDs and project IDs / Seed IDs и project IDs

Some values are true enums, but some are just project IDs.  
Некоторые значения — это настоящие enum, а некоторые — просто project IDs.

### Examples of project seed IDs found in the code / Примеры project seed IDs, найденных в коде

#### Kingdom IDs

`luminor`, `artalon`, `kriantar`, `terimia`, `argos`

#### Faction IDs

`high_elves`, `forest_elves`, `ancient_elves`, `dwarves`, `orcs`, `dark_elves`, `grunvard_dwarves`, `shadow_guild`, `elemental_school`, `black_rite`, `shamans_of_orcs`

#### Seed city IDs

`city_arklein`, `brenhold`, `ironcrest`, `whisper_port`

#### Seed profession IDs

`archer`, `blacksmith`, `alchemist`, `hunter`

**RU:** Это не “строгие enums языка”, а текущие ID-значения проекта/seed-данных.  
**EN:** These are not “hard language enums”; they are current project/seed IDs.

---

## 19. Best practices and pitfalls / Лучшие практики и типичные ошибки

### Best practices / Лучшие практики

- **RU:** Всегда сначала создавайте referenced entities, потом основную запись.
- **EN:** Always create referenced entities before the main record.

- **RU:** Для первого теста используйте минимальный контент.
- **EN:** Use minimal content for the first test.

- **RU:** Для quest start предпочитайте `dialogue` или `map_zone_enter`.
- **EN:** Prefer `dialogue` or `map_zone_enter` for quest start.

- **RU:** Для quest progress предпочитайте `enter_zone`, `inspect_object`, `choose_dialogue`.
- **EN:** Prefer `enter_zone`, `inspect_object`, and `choose_dialogue` for quest progress.

- **RU:** Для сложных world реакций лучше использовать `Quest Interactions`, но только для state-changing logic.
- **EN:** For complex world reactions, prefer `Quest Interactions`, but mainly for state-changing logic.

### Pitfalls / Типичные ошибки

- **RU:** Делать `active` квест, когда еще не созданы `npcId`, `itemId`, `dialogueId`, `zoneId`.
- **EN:** Making a quest `active` before `npcId`, `itemId`, `dialogueId`, or `zoneId` exists.

- **RU:** Ставить objective type, у которого есть enum, но нет надежного runtime path.
- **EN:** Choosing an objective type that has an enum but no reliable runtime path.

- **RU:** Путать `item` и `quest_item`.
- **EN:** Mixing up `item` and `quest_item`.

- **RU:** Рассчитывать, что `open_dialogue` / `open_shop` / `start_combat` из `Quest Interactions` откроют UI так же надежно, как действия из диалогов.
- **EN:** Assuming `open_dialogue` / `open_shop` / `start_combat` from `Quest Interactions` open UI as reliably as dialogue actions do.

- **RU:** Использовать несовместимые race ID styles в skills.
- **EN:** Using mixed/incompatible race ID styles in skills.

---

## 20. Final recommendations / Финальные рекомендации

### If you want the most stable quest pipeline today / Если нужен самый стабильный pipeline квестов прямо сейчас

Use this stack:

1. `NPC`
2. `Dialogue`
3. `Quest`
4. `Zone Editor` zone
5. `Quest Interaction`
6. optional `Quest Item` / `Item` / `Skill` reward

Используйте такую связку:

1. `NPC`
2. `Dialogue`
3. `Quest`
4. зона в `Zone Editor`
5. `Quest Interaction`
6. опционально `Quest Item` / `Item` / `Skill` как награда

### Most stable quest trigger combinations / Самые стабильные комбинации

- `Dialogue action start_quest` + objective `choose_dialogue`
- `Quest trigger map_zone_enter` + objective `enter_zone`
- `Quest Interaction zone_inspect` + effect `complete_objective`

### Most stable reward combinations / Самые стабильные награды

- `gold`
- `experience`
- `item`
- `quest_item`
- `skill`

### Things to treat as advanced/experimental / Что считать advanced/experimental

- `deliver_item`
- `wait_time`
- `learn_profession`
- `escort_npc`
- `global_event`
- `profession_unlock`
- `open_dialogue` from `Quest Interactions`
- `open_shop` from `Quest Interactions`
- `start_combat` from `Quest Interactions`
- `open_training`

---

## 21. Short answer / Короткий вывод

**RU:** Если спросить “как лучше всего делать квесты в нашей игре прямо сейчас?”, ответ будет такой:

> Делать их через `NPC + Dialogue + Quest + Zone/Quest Interaction`, держаться за runtime-verified enum values, минимизировать магию, сначала строить простой рабочий pipeline, и только потом добавлять ветвления, предметы, магазины, боевки и сложные условия.

**EN:** If you ask “what is the best way to create quests in our game right now?”, the answer is:

> Build them through `NPC + Dialogue + Quest + Zone/Quest Interaction`, stick to runtime-verified enum values, minimize magic, create a simple working pipeline first, and only then add branching, items, shops, combat, and more complex conditions.
