# THEEND QUEST AGENT RULES

Этот файл — постоянная инструкция для агента Antigravity, который должен создавать квесты, NPC, диалоги, quest interactions, quest markers и связанные игровые сущности для браузерной RPG TheEnd.

Агент должен работать не как обычный писатель и не как абстрактный RPG-дизайнер.  
Агент должен работать как контент-архитектор под текущий runtime TheEnd.

Главная задача агента — создавать такой контент, который можно вставить в админку или JSON проекта и затем вручную расставить в игре.

---

# 1. Главная схема работы

Каждый квест должен проектироваться как связка:

```txt
NPC
Dialogue
Quest
Quest Steps
Quest Objectives
Quest Rewards
Quest Conditions
Quest Interactions
Quest Markers
Zones / City Locations
Items / Quest Items / Skills / Reputation if needed
```

Никогда не создавай квест как один отдельный текст.

Если пользователь просит “создай квест”, ты обязан выдать:

1. Краткую идею квеста.
2. Список всех сущностей, которые нужно создать.
3. NPC JSON, если нужен NPC.
4. Dialogue JSON, если квест начинается или завершается через разговор.
5. Quest JSON.
6. Quest Interaction JSON, если нужна зона, осмотр, маркер, предмет или событие.
7. Quest Marker JSON, если игроку надо показать цель на карте.
8. Список того, что пользователь должен вручную расставить в игре.
9. Чеклист тестирования.

---

# 2. Рабочий порядок создания квеста

Всегда создавай контент в таком порядке:

1. Определи тип квеста:
   - `global`
   - `kingdom`
   - `faction`
   - `profession`
   - `lore`
   - `city`
   - `npc`
   - `random`
   - `hidden`
   - `repeatable`

2. Определи точку входа:
   - разговор с NPC;
   - вход в зону;
   - осмотр зоны;
   - достижение маркера;
   - использование предмета;
   - ручной запуск через админку.

3. Создай зависимости:
   - NPC;
   - Dialogue;
   - Item;
   - Quest Item;
   - Skill;
   - Merchant / Shop;
   - Zone;
   - City Location;
   - Quest Marker;
   - Battle Map;
   - Enemy / NPC enemy.

4. Создай NPC.

5. Создай Dialogue.

6. Создай Quest.

7. Создай Quest Interaction, если игрок должен:
   - осмотреть объект;
   - войти в область;
   - нажать на маркер;
   - получить предмет через объект;
   - открыть скрытую сцену;
   - запустить бой;
   - открыть магазин;
   - получить репутацию;
   - сменить подданство.

8. Создай Quest Marker, если цель должна быть видна на карте.

9. В конце дай тест-план.

---

# 3. ID-стиль TheEnd

Все ID должны быть стабильными, понятными, без пробелов и кириллицы.

Используй такой стиль:

```txt
NPC:
npc_<region>_<place>_<role_or_name>

Dialogue:
dlg_<region>_<place>_<npc_name_or_role>

Quest:
quest_<region>_<short_name>

Quest step:
step_1_<short_name>
step_2_<short_name>

Objective:
obj_<action>_<target>

Choice:
choice_<action>_<meaning>

Quest Interaction:
qi_<region>_<place>_<purpose>

Quest Marker:
marker_<quest_short_name>_<purpose>

Quest Item:
qitem_<short_name>

Item:
item_<category>_<short_name>
```

Примеры:

```txt
npc_argos_camp_forge_brokk
dlg_argos_camp_forge_brokk
quest_argos_camp_broken_blade
step_1_speak_with_brokk
step_2_inspect_anvil
obj_choose_accept_brokk
obj_inspect_broken_anvil
qi_argos_camp_forge_anvil
marker_broken_blade_anvil
qitem_broken_argos_blade
item_weapon_recruit_sword_argos
```

---

# 4. Категории квестов

Используй только эти категории:

```txt
global
kingdom
faction
profession
lore
city
npc
random
hidden
repeatable
```

Если `category = kingdom`, обязательно указывай `kingdomId`.

Важное правило:  
kingdom-квесты могут быть ограничены происхождением/королевством игрока. Поэтому не создавай kingdom-квест без `kingdomId`.

Пример:

```json
{
  "category": "kingdom",
  "kingdomId": "argos"
}
```

---

# 5. Статусы квестов

Используй:

```txt
draft
active
disabled
archived
```

Для готового игрового контента ставь:

```json
"status": "active"
```

Для черновика:

```json
"status": "draft"
```

---

# 6. Надёжные objective types

Для текущего runtime самые безопасные цели:

```txt
enter_zone
inspect_object
choose_dialogue
```

Также можно использовать, если понятно, где событие вызывается:

```txt
talk_to_npc
reach_marker
collect_item
use_item
kill_enemy
survive_battle
```

Осторожно используй как основную механику:

```txt
deliver_item
pay_gold
receive_gold
craft_item
learn_profession
gain_reputation
wait_time
read_book
escort_npc
```

Эти типы можно описывать в дизайне, но не делай их единственным критичным способом прохождения, если пользователь не просит специально.

---

# 7. Надёжные trigger types

Используй:

```txt
npc_dialogue
map_zone_enter
map_marker
item_use
enemy_death
manual_admin
random_zone_roll
```

Самые надёжные для обычных квестов:

```txt
npc_dialogue
map_zone_enter
manual_admin
```

Для случайных событий:

```txt
random_zone_roll
```

Для осмотра зоны лучше использовать Quest Interaction с `triggerType`:

```txt
zone_inspect
```

---

# 8. Старт квеста через диалог

Если квест начинается через dialogue choice, всегда дублируй запуск двумя способами.

Legacy shorthand:

```json
"giveQuest": "quest_id"
```

Новый `actions/effects` формат:

```json
"actions": [
  {
    "id": "action_start_quest_id",
    "type": "startQuest",
    "questId": "quest_id"
  }
]
```

или:

```json
"effects": [
  {
    "id": "effect_start_quest_id",
    "type": "start_quest",
    "questId": "quest_id"
  }
]
```

Лучше использовать и `giveQuest`, и `actions` одновременно.

Пример:

```json
{
  "id": "choice_accept_task",
  "text": "Хорошо. Я помогу.",
  "nextNodeId": "accepted",
  "giveQuest": "quest_argos_camp_broken_blade",
  "actions": [
    {
      "id": "action_start_broken_blade",
      "type": "startQuest",
      "questId": "quest_argos_camp_broken_blade"
    }
  ]
}
```

---

# 9. Завершение цели через диалог

Если цель должна завершаться выбором реплики, используй objective type:

```txt
choose_dialogue
```

Пример objective:

```json
{
  "id": "obj_accept_brokk_task",
  "type": "choose_dialogue",
  "description": "Согласиться помочь Брокку.",
  "npcId": "npc_argos_camp_forge_brokk",
  "dialogueChoiceId": "choice_accept_task"
}
```

В самой реплике можно добавить action:

```json
{
  "id": "action_complete_accept_objective",
  "type": "completeObjective",
  "questId": "quest_argos_camp_broken_blade",
  "objectiveId": "obj_accept_brokk_task"
}
```

---

# 10. Осмотр объекта / зоны

Если игрок должен осмотреть место, используй quest objective:

```json
{
  "id": "obj_inspect_broken_anvil",
  "type": "inspect_object",
  "description": "Осмотреть разбитую наковальню.",
  "zoneId": "zone_argos_camp_forge_anvil"
}
```

Quest Interaction:

```json
{
  "id": "qi_argos_camp_forge_anvil",
  "title": "Разбитая наковальня",
  "triggerType": "zone_inspect",
  "zoneId": "zone_argos_camp_forge_anvil",
  "questId": "quest_argos_camp_broken_blade",
  "objectiveId": "obj_inspect_broken_anvil",
  "text": "На наковальне видны свежие трещины. Кто-то ударил по металлу с такой силой, что камень под ней лопнул.",
  "isActive": true,
  "requirements": [
    {
      "type": "quest_active",
      "questId": "quest_argos_camp_broken_blade"
    },
    {
      "type": "objective_not_completed",
      "questId": "quest_argos_camp_broken_blade",
      "objectiveId": "obj_inspect_broken_anvil"
    }
  ],
  "choices": [
    {
      "id": "choice_inspect_anvil",
      "text": "Осмотреть трещины внимательнее.",
      "resultText": "Ты находишь в трещине маленький осколок странного металла.",
      "effects": [
        {
          "type": "complete_objective",
          "questId": "quest_argos_camp_broken_blade",
          "objectiveId": "obj_inspect_broken_anvil"
        },
        {
          "type": "give_quest_item",
          "questItemId": "qitem_strange_metal_shard"
        }
      ],
      "close": true
    }
  ],
  "hideAfterObjectiveCompleted": true
}
```

---

# 11. Вход в зону

Если цель — попасть в область, используй objective:

```json
{
  "id": "obj_enter_forge_yard",
  "type": "enter_zone",
  "description": "Войти во двор кузницы.",
  "zoneId": "zone_argos_camp_forge_yard"
}
```

И trigger, если квест должен стартовать при входе:

```json
{
  "id": "trigger_enter_forge_yard",
  "type": "map_zone_enter",
  "zoneId": "zone_argos_camp_forge_yard"
}
```

---

# 12. Награды

Используй только поддерживаемые reward type:

```txt
gold
experience
item
quest_item
reputation
title
profession
skill
recipe
unlock_dialogue
unlock_location
unlock_shop
faction_access
lore_entry
```

Пример золота:

```json
{
  "id": "reward_gold_50",
  "type": "gold",
  "amount": 50
}
```

Пример опыта:

```json
{
  "id": "reward_xp_100",
  "type": "experience",
  "amount": 100
}
```

Пример предмета:

```json
{
  "id": "reward_item_recruit_sword",
  "type": "item",
  "targetId": "item_weapon_recruit_sword_argos"
}
```

Пример quest item:

```json
{
  "id": "reward_qitem_argos_pass",
  "type": "quest_item",
  "targetId": "qitem_argos_temporary_pass"
}
```

Пример навыка:

```json
{
  "id": "reward_skill_argos_guard_stance",
  "type": "skill",
  "targetId": "skill_argos_guard_stance"
}
```

Пример рецепта:

```json
{
  "id": "reward_recipe_argos_blade_repair",
  "type": "recipe",
  "targetId": "recipe_argos_blade_repair"
}
```

Пример открытия локации:

```json
{
  "id": "reward_unlock_king_tent",
  "type": "unlock_location",
  "targetId": "area_argos_camp_king_tent"
}
```

Пример открытия магазина:

```json
{
  "id": "reward_unlock_forge_shop",
  "type": "unlock_shop",
  "targetId": "merchant_argos_forge_brokk"
}
```

Пример репутации:

```json
{
  "id": "reward_argos_reputation_10",
  "type": "reputation",
  "reputationChanges": [
    {
      "targetType": "kingdom",
      "targetId": "argos",
      "kingdomId": "argos",
      "amount": 10,
      "reason": "Помог кузне Аргоса"
    }
  ]
}
```

---

# 13. Репутация через dialogue action

Если репутация выдаётся через диалог, используй:

```json
{
  "id": "action_add_argos_rep",
  "type": "addReputation",
  "reputationChanges": [
    {
      "targetType": "kingdom",
      "targetId": "argos",
      "kingdomId": "argos",
      "amount": 10,
      "reason": "Помог офицеру Аргоса"
    }
  ]
}
```

или snake_case:

```json
{
  "id": "effect_add_argos_rep",
  "type": "add_reputation",
  "reputationChanges": [
    {
      "targetType": "kingdom",
      "targetId": "argos",
      "kingdomId": "argos",
      "amount": 10
    }
  ]
}
```

---

# 14. Смена подданства

Если квест или диалог меняет подданство, используй:

```json
{
  "id": "action_change_citizenship_argos",
  "type": "changeCitizenship",
  "kingdomId": "argos",
  "changeCitizenship": {
    "kingdomId": "argos",
    "oldKingdomPenalty": -50,
    "newKingdomBonus": 20,
    "requireAuthorityNpc": true
  }
}
```

Важно:  
В runtime смена подданства уже сама применяет штраф старому королевству и бонус новому. Поэтому не дублируй эти же -50/+20 отдельной репутационной наградой, если не нужно специальное дополнительное изменение.

---

# 15. Quest conditions

Для Quest conditions используй:

```txt
player_level
player_race
player_class
player_profession
kingdom_reputation
faction_reputation
has_item
has_not_item
quest_completed
quest_not_completed
quest_active
time_of_day
in_city
in_kingdom
flag_true
flag_false
gold_at_least
```

Осторожно:  
В `questRuntime` сейчас `npc_alive`, `npc_dead` и `stat_check` считаются неподдержанными для Quest conditions. Не используй их в `QuestDefinition` как обязательные условия старта.

Для Dialogue conditions `stat_check` можно использовать, если нужно проверить стат в разговоре.

---

# 16. Dialogue conditions

Для условий реплик можно использовать:

```txt
quest_active
quest_completed
quest_not_started
quest_failed
objective_completed
objective_not_completed
has_item
missing_item
has_quest_item
missing_quest_item
has_skill
missing_skill
has_flag
missing_flag
flag_equals
player_level
player_race
player_race_not
player_origin
player_origin_not
player_kingdom
player_kingdom_not
player_profession
stat_check
gold_at_least
faction_reputation
kingdom_reputation
race_is
class_is
level_min
level_max
faction_relation_min
```

Если реплика должна появляться только во время квеста:

```json
{
  "type": "quest_active",
  "questId": "quest_id"
}
```

Если реплика должна появиться после objective:

```json
{
  "type": "objective_completed",
  "questId": "quest_id",
  "objectiveId": "objective_id"
}
```

Если реплика должна исчезнуть после objective:

```json
{
  "type": "objective_not_completed",
  "questId": "quest_id",
  "objectiveId": "objective_id"
}
```

---

# 17. Quest Interaction requirements

Для Quest Interaction используй требования:

```txt
quest_not_started
quest_active
quest_completed
quest_failed
objective_completed
objective_not_completed
step_completed
step_not_completed
has_item
missing_item
has_quest_item
missing_quest_item
has_skill
missing_skill
has_flag
flag_equals
race_is
class_is
level_min
level_max
faction_relation_min
```

Пример:

```json
"requirements": [
  {
    "type": "quest_active",
    "questId": "quest_argos_camp_broken_blade"
  },
  {
    "type": "objective_not_completed",
    "questId": "quest_argos_camp_broken_blade",
    "objectiveId": "obj_inspect_broken_anvil"
  }
]
```

---

# 18. Quest Interaction effects

Для Quest Interaction choices можно использовать:

```txt
complete_objective
complete_step
complete_quest
start_quest
fail_quest
give_rewards
add_reputation
change_citizenship
give_item
take_item
give_quest_item
take_quest_item
give_skill
give_gold
give_experience
set_flag
unlock_location
unlock_dialogue
open_dialogue
open_shop
start_combat
```

Пример полного выбора:

```json
{
  "id": "choice_take_shard",
  "text": "Взять осколок.",
  "resultText": "Ты осторожно достаёшь осколок из трещины.",
  "effects": [
    {
      "type": "give_quest_item",
      "questItemId": "qitem_strange_metal_shard"
    },
    {
      "type": "complete_objective",
      "questId": "quest_argos_camp_broken_blade",
      "objectiveId": "obj_inspect_broken_anvil"
    }
  ],
  "close": true
}
```

---

# 19. Quest Markers

Если цель должна отображаться на карте, создай marker.

Типы marker:

```txt
quest_start
quest_objective
quest_finish
npc_quest
item_spawn
enemy_spawn
inspect_object
hidden_location
```

Пример:

```json
{
  "id": "marker_broken_blade_anvil",
  "mapId": "atalion",
  "x": 412,
  "y": 288,
  "type": "inspect_object",
  "title": "Разбитая наковальня",
  "linkedQuestId": "quest_argos_camp_broken_blade",
  "linkedStepId": "step_2_inspect_anvil",
  "linkedObjectiveId": "obj_inspect_broken_anvil",
  "zoneId": "zone_argos_camp_forge_anvil",
  "visibleToPlayer": true,
  "conditionIds": [],
  "isActive": true,
  "hideAfterObjectiveCompleted": true,
  "showOnWorldMap": true,
  "showOnMiniMap": true,
  "worldMapVisibility": "selectedQuestOnly",
  "miniMapVisibility": "nearby"
}
```

Если игрок жалуется, что маркер исчезает, но объект всё ещё виден в “осмотреться”, проверь не только marker, но и Quest Interaction:

```txt
hideAfterQuestCompleted
hideAfterObjectiveCompleted
hideAfterStepCompleted
requirements with objective_not_completed
```

---

# 20. Структура Quest JSON

Минимальная структура:

```json
{
  "id": "quest_id",
  "title": "Название",
  "adminDescription": "Описание для админки.",
  "playerDescription": "Описание для игрока.",
  "category": "npc",
  "status": "active",
  "kingdomId": "argos",
  "factionId": "faction_argos_army",
  "cityId": "city_argos_camp",
  "npcId": "npc_argos_camp_forge_brokk",
  "recommendedLevel": 1,
  "minLevel": 1,
  "isRepeatable": false,
  "isHidden": false,
  "steps": [
    {
      "id": "step_1_accept",
      "questId": "quest_id",
      "title": "Поговорить с NPC",
      "journalText": "NPC попросил тебя помочь.",
      "order": 0,
      "objectives": [
        {
          "id": "obj_accept_task",
          "type": "choose_dialogue",
          "description": "Согласиться помочь.",
          "npcId": "npc_id",
          "dialogueChoiceId": "choice_accept_task"
        }
      ],
      "nextStepId": "step_2_do_task"
    },
    {
      "id": "step_2_do_task",
      "questId": "quest_id",
      "title": "Выполнить задание",
      "journalText": "Нужно выполнить поручение.",
      "order": 1,
      "objectives": [
        {
          "id": "obj_inspect_place",
          "type": "inspect_object",
          "description": "Осмотреть место.",
          "zoneId": "zone_id"
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
      "amount": 50
    }
  ],
  "failureConsequences": [],
  "flags": {},
  "createdAt": "AUTO_NOW",
  "updatedAt": "AUTO_NOW"
}
```

---

# 21. Dialogue JSON структура

Диалог должен иметь:

```txt
id
title
npcId
status
startNodeId
nodes
```

Пример:

```json
{
  "id": "dlg_argos_camp_forge_brokk",
  "title": "Брокк у полевой кузни",
  "npcId": "npc_argos_camp_forge_brokk",
  "status": "active",
  "description": "Диалог кузнеца, выдающего квест.",
  "startNodeId": "start",
  "nodes": [
    {
      "id": "start",
      "speaker": "npc",
      "text": "Кузнец поднимает глаза от треснувшей наковальни. — Если пришёл глазеть, стой в стороне. Если помогать — слушай.",
      "choices": [
        {
          "id": "choice_ask_problem",
          "text": "Что случилось?",
          "nextNodeId": "problem"
        },
        {
          "id": "choice_leave",
          "text": "Я зайду позже.",
          "end": true
        }
      ]
    },
    {
      "id": "problem",
      "speaker": "npc",
      "text": "— Металл повёл себя не так. В трещине что-то осталось. Найди осколок, пока офицеры не решили, что это саботаж.",
      "choices": [
        {
          "id": "choice_accept_task",
          "text": "Хорошо. Я осмотрю наковальню.",
          "nextNodeId": "accepted",
          "giveQuest": "quest_argos_camp_broken_blade",
          "actions": [
            {
              "id": "action_start_broken_blade",
              "type": "startQuest",
              "questId": "quest_argos_camp_broken_blade"
            },
            {
              "id": "action_complete_accept",
              "type": "completeObjective",
              "questId": "quest_argos_camp_broken_blade",
              "objectiveId": "obj_accept_brokk_task"
            }
          ]
        }
      ]
    },
    {
      "id": "accepted",
      "speaker": "npc",
      "text": "— Не тяни. В Аргосе железо молчит только перед бедой.",
      "choices": [
        {
          "id": "choice_end",
          "text": "Я понял.",
          "end": true
        }
      ]
    }
  ],
  "createdAt": "AUTO_NOW",
  "updatedAt": "AUTO_NOW"
}
```

---

# 22. NPC JSON структура

Минимальный NPC:

```json
{
  "id": "npc_argos_camp_forge_brokk",
  "name": "Брокк",
  "title": "полевой кузнец Аргоса",
  "status": "active",
  "kind": "npc",
  "race": "dwarf",
  "description": "Суровый гном-кузнец при военном лагере Аргоса.",
  "cityId": "city_argos_camp",
  "locationId": "area_argos_camp_alinol_forge",
  "currentCityId": "city_argos_camp",
  "homeCityId": "city_argos_camp",
  "cityLocationId": "area_argos_camp_alinol_forge",
  "canTrade": true,
  "traderId": "merchant_argos_forge_brokk",
  "dialogueId": "dlg_argos_camp_forge_brokk",
  "mapBindings": [],
  "dialogues": [],
  "questBindings": [],
  "createdAt": "AUTO_NOW",
  "updatedAt": "AUTO_NOW"
}
```

---

# 23. Что всегда писать после JSON

После JSON всегда добавляй раздел:

## Что нужно расставить вручную

- Поставить NPC `<npc_id>` в location/city/zone.
- Привязать `dialogueId` к NPC.
- Создать/проверить `zoneId`.
- Создать/проверить quest marker.
- Если есть quest interaction — проверить `triggerType` и `zoneId`.
- Если есть награда item/quest_item/skill/recipe/shop/location — проверить, что такая сущность уже существует.
- Если есть reputation — проверить `kingdomId` / `factionId`.
- Если есть battle — проверить battleMap/enemy.

## Тест-план

1. Зайти персонажем нужного происхождения/уровня.
2. Найти NPC.
3. Открыть диалог.
4. Нажать стартовую реплику.
5. Проверить, что квест появился в журнале.
6. Проверить, что первый objective завершился.
7. Выполнить следующий objective.
8. Проверить переход step.
9. Завершить квест.
10. Проверить награды.
11. Проверить репутацию.
12. Проверить, что marker/interaction исчезли, если должны исчезнуть.

---

# 24. Важные запреты

Не выдумывай поля, которых нет в текущей схеме.

Не используй русские ID.

Не создавай квест без NPC/Dialogue, если пользователь просит квест от персонажа.

Не создавай kingdom-квест без `kingdomId`.

Не создавай reward типа, которого нет в системе.

Не используй `npc_alive`, `npc_dead`, `stat_check` как обязательные Quest conditions.

Не полагайся только на красивый текст. Всегда думай, как runtime поймёт событие.

Не делай только Dialogue без Quest JSON, если пользователь просит полноценный квест.

Не делай только Quest JSON без Dialogue, если старт через NPC.

Не забывай `hideAfterObjectiveCompleted` / `hideAfterQuestCompleted` для объектов, которые должны исчезать после прохождения.

---

# 25. Главный формат ответа агента

Когда пользователь просит создать квест, отвечай строго так:

1. Название квеста.
2. Краткая идея.
3. Механика прохождения.
4. Какие сущности создаём.
5. NPC JSON.
6. Dialogue JSON.
7. Quest Item JSON, если нужен.
8. Item JSON, если нужен.
9. Quest JSON.
10. Quest Interaction JSON, если нужен.
11. Quest Marker JSON, если нужен.
12. Что расставить вручную.
13. Тест-план.
14. Возможные риски/что проверить.

Если пользователь просит коротко, всё равно сохраняй структуру, но сокращай описания.

---

# 26. Стиль диалогов

Диалоги должны быть атмосферными, но не слишком длинными.

Стиль мира TheEnd:

- тёмное фэнтези;
- серьёзный тон;
- политические последствия;
- королевства, фракции, происхождение игрока имеют значение;
- NPC говорят по роли: кузнец грубо, маг загадочно, военный сухо, крестьянин проще;
- реплики игрока должны быть понятными кнопками.

Не писать диалоги на 20 экранов, если это обычный NPC.

Хорошая структура узлов:

```txt
start
problem
accept
in_progress
turn_in
completed
refuse
```

---

# 27. Простая формула хорошего квеста

Хороший квест TheEnd должен отвечать на вопросы:

```txt
Кто дал задание?
Почему игроку это важно?
Что игрок должен сделать руками?
Как runtime поймёт, что действие выполнено?
Что изменится после выполнения?
Какая награда?
Какая репутация?
Что исчезнет или откроется после квеста?
Как это протестировать?
```

Если хотя бы на один вопрос нет ответа — квест недоделан.

---

# 28. Как использовать этот файл в Antigravity

Лучший вариант:

1. Положить этот файл в проект TheEnd.
2. Создать Workspace Rule.
3. Вставить содержимое файла в Workspace Rule.
4. Назвать правило:

```txt
theend_quest_agent
```

Если Workspace Rule недоступен, положить файл в корень проекта и написать агенту:

```txt
Прочитай файл THEEND_QUEST_AGENT_RULES.md и всегда следуй ему при создании квестов, NPC, диалогов, quest interactions и quest markers для TheEnd.
```

Дополнительный рабочий prompt для агента:

```txt
Сделай полный пакет контента TheEnd:
NPC + Dialogue + Quest + QuestInteraction + QuestMarker.
Не меняй код.
Не читай все .md без необходимости.
Ориентируйся на текущий runtime и правила из THEEND_QUEST_AGENT_RULES.md.
В конце дай список того, что нужно расставить вручную в админке, и тест-план.
```
