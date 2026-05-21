# GODMODE Console Tutorial

## RU

### Что это

В игру встроен постоянный тестовый аккаунт и внутриигровая dev-консоль для быстрого QA.

- Логин: `godmod`
- Пароль: `godmod123`
- Открыть / закрыть консоль: `` ` `` или `ё`

Консоль доступна только после входа в аккаунт `godmod`.

---

### Быстрый старт

1. Запусти игру.
2. На экране входа нажми `GODMODE` или введи:
   - `godmod`
   - `godmod123`
3. Если аккаунта ещё нет, он создастся автоматически.
4. После загрузки персонажа нажми `` ` `` или `ё`.
5. Введи `help`, чтобы увидеть короткую справку.

---

### Как устроены данные

Есть две большие группы данных:

- **Backend / character state**
  - золото персонажа
  - уровень
  - опыт
  - свободные очки
  - статы
  - обычный инвентарь
  - экипировка
  - изученные навыки

- **Runtime / world state**
  - quest items
  - materials
  - resources
  - player flags
  - unlocked locations / dialogues / shops
  - runtime overlay для золота и world-items
  - quest state

Команда `sync runtime` переносит runtime-обычные предметы и runtime-золото в backend-инвентарь персонажа.

---

### Общие правила синтаксиса

- Команды нечувствительны к регистру для основных слов.
- ID лучше копировать как есть из админки.
- Аргументы с пробелами можно брать в кавычки.
- Для некоторых команд есть compact-alias формы, например:
  - `get_quest_feralas_followers_path_start`
  - `delete_quest_feralas_followers_path_start`
  - `give_item_iron_sword`
  - `give_quest_item_feralas_emblem`
  - `give_skill_skill_firebolt`
  - `give_gold_5000`
  - `set_level_20`
  - `teleport_city_city_arklein`
  - `teleport_location_loc_feralas_cult`
  - `open_merchant_merchant_weaponsmith`
  - `give_itemset_set_feralas_ash`

---

### Базовые команды

```txt
help
state
```

- `help` — короткий список команд
- `state` — текущий снимок персонажа и runtime-хранилищ

---

### Золото, опыт, уровень, очки

```txt
gold add 1000
gold set 5000

xp add 250
xp set 9000

level set 15

points add 10
points set 99
```

---

### Статы

Поддерживаются:

- `hp`
- `mp`
- `stamina`
- `strength`
- `constitution`
- `dexterity`
- `intelligence`
- `luck`
- `perception`
- `willpower`

Примеры:

```txt
stat set strength 30
stat add strength 5

stat set hp 220
stat set mp 150
stat set perception 18
```

Примечания:

- `constitution` уходит во внутреннее поле `endurance`
- `perception` уходит во внутреннее поле `speed`

---

### Текущие ресурсы персонажа

```txt
resource full

resource set hp 120
resource set mp 80
resource set stamina 65
resource set regen 4
```

Поддерживаются:

- `hp`
- `mp`
- `stamina`
- `regen`

---

### Обычные предметы

```txt
item add item_iron_sword
item add item_iron_sword 3
item remove item_iron_sword
item remove item_iron_sword 2
```

Для просмотра доступных ID:

```txt
list items
list items sword
```

---

### Экипировка

```txt
equip item_iron_sword
equip item_iron_sword weapon
unequip weapon
unequip armor
```

---

### Навыки

```txt
skill add skill_firebolt
skill remove skill_firebolt

list skills
list skills fire
```

---

### Профессии

```txt
profession list
profession unlock mining
profession remove mining

profession xp add mining 100
profession xp set mining 0
profession level set mining 5
profession points add mining 10
profession points set mining 99

profession skill learn mining mining_strong_swing
profession skill reset mining

profession branch choose mining mining_branch_deep_delver
profession branch reset mining
```

Что это даёт:

- `unlock` открывает профессию в профиле персонажа
- `xp add` / `xp set` помогают быстро проверить рост уровня и начисление skill points
- `level set` и `points set` позволяют собрать нужный тестовый билд за 1 шаг
- `skill learn` и `branch choose` повторяют основные действия панели профессий
- `skill reset` и `branch reset` очищают состояние для повторного прогона

---

### Горняк и шахты

```txt
mine open mine_teramor_old_iron
mine close
mine finish escaped
mine finish retreated
mine finish failed
mine finish dead
```

Что важно:

- кнопка `Выйти из шахты` теперь доступна всегда, пока забег активен
- старый блок типа `exit` считается устаревшим и больше не нужен для выхода
- `mine close` имитирует безопасный выход через кнопку выхода
- `mine finish ...` быстро переводит забег в нужный итог для QA

---

### Квесты

```txt
quest get feralas_followers_path_start
quest start feralas_followers_path_start
quest advance feralas_followers_path_start
quest complete feralas_followers_path_start
quest fail feralas_followers_path_start "debug fail"
quest reset feralas_followers_path_start

quest track feralas_followers_path_start
quest track feralas_followers_path_start obj_speak_to_vaern
quest untrack

quest reward feralas_followers_path_start
quest flag feralas_followers_path_start truth_heard true

objective complete feralas_followers_path_start obj_speak_to_vaern

list quests
list quests feralas
```

Что делает:

- `get` — показывает текущее состояние квеста
- `start` — выдаёт квест
- `advance` — двигает квест на следующий шаг
- `complete` — завершает квест и пытается выдать награды
- `fail` — проваливает квест
- `reset` — удаляет player-state квеста
- `track` — ставит активный tracked-quest
- `untrack` — очищает tracked-quest
- `reward` — вручную применяет награды квеста
- `flag` — ставит quest-specific flag
- `objective complete` — отмечает objective как выполненный

---

### Квестовые предметы

```txt
questitem add feralas_emblem
questitem add feralas_emblem 2
questitem remove feralas_emblem

give_quest_item_feralas_emblem
```

Это тот же storage, который используется в проверках `has_quest_item`.

---

### Материалы и ресурсы

```txt
material add iron_ore 5
material remove iron_ore 2

resource add ash_resin 3
resource remove ash_resin 1

list materials
list materials ore
```

---

### Флаги игрока

```txt
flag list
flag get feralas_truth_known
flag set feralas_truth_known true
flag set cult_rank 3
flag delete cult_rank
```

---

### Unlock / доступы

```txt
unlock location loc_feralas_cult
unlock dialogue dlg_npc_vaern_flamebearer_5x3j
unlock shop merchant_weaponsmith

unlock all locations
unlock all dialogues
unlock all shops
```

---

### Телепорт

```txt
teleport world
teleport city city_arklein
teleport location loc_feralas_cult

tp world
tp city city_arklein
tp location loc_feralas_cult
```

Примечание:

- для `city` открывается локальная карта города
- для `location` открывается либо локальная карта локации, либо старое location-window, если у локации нет local map

---

### Панели и UI

```txt
panel open inventory
panel open character
panel open stats
panel open skills
panel open equipment
panel open merchant merchant_weaponsmith
panel open arena
panel open map
panel close
```

---

### Торговцы

```txt
merchant list
merchant list smith
merchant open merchant_weaponsmith

open_merchant_merchant_weaponsmith
```

---

### Боевая отладка

```txt
battle map battlemap_arklein_arena_test

battle start
battle start 1
battle start 4 battlemap_arklein_arena_test

battle npc npc_vaern_flamebearer
battle npc npc_vaern_flamebearer,npc_bandit_archer battlemap_arklein_arena_test
```

Что делает:

- `battle map` — выбирает карту боя по умолчанию
- `battle start` — запускает бой против сгенерированных врагов
- `battle npc` — запускает бой против конкретных NPC из базы

---

### Наборы предметов

```txt
itemset list
itemset list feralas

itemset give set_feralas_ash
itemset remove set_feralas_ash

give_itemset_set_feralas_ash
```

`itemset give` выдаёт по 1 экземпляру каждого `pieceItemId` из набора.

---

### Поиск контента

```txt
list items
list skills
list quests
list npcs
list dialogues
list merchants
list cities
list locations
list battlemaps
list itemsets
list materials
```

Можно добавлять фильтр:

```txt
list npcs vaern
list dialogues feralas
list locations cult
list battlemaps arena
```

---

### Очистка runtime-хранилищ

```txt
clear questitems
clear materials
clear resources
clear flags
clear runtimeitems
clear allruntime
```

Что очищает:

- `questitems` — все runtime quest items
- `materials` — runtime materials
- `resources` — runtime resources
- `flags` — player flags
- `runtimeitems` — runtime обычные предметы + runtime золото overlay
- `allruntime` — всё выше сразу

---

### Синхронизация runtime overlay

```txt
sync runtime
```

Полезно, если:

- диалог или квест дал обычный `item`
- диалог или квест дал runtime-золото
- нужно перенести это в backend-инвентарь персонажа

---

### Рекомендуемые сценарии тестирования

#### Быстро проверить квест Фераласа

```txt
quest start feralas_followers_path_start
questitem add feralas_emblem
teleport location loc_feralas_cult
```

#### Быстро собрать билд мага

```txt
level set 20
points set 50
stat set intelligence 40
stat set willpower 35
skill add skill_firebolt
skill add skill_arcane_burst
item add item_initiate_staff
equip item_initiate_staff
```

#### Быстро открыть торговца и проверить цены

```txt
gold set 99999
merchant open merchant_weaponsmith
```

#### Быстро запустить бой против конкретного NPC

```txt
battle npc npc_vaern_flamebearer battlemap_arklein_arena_test
```

---

### Важные замечания

- Команды Godmode не предназначены для обычных игроков.
- Некоторые команды меняют persistent character data, а не только текущую сессию.
- `clear allruntime` не удаляет backend-персонажа, но чистит runtime-слой мира.
- `quest reward` может выдать награды повторно, если запускать её несколько раз.
- `itemset give` выдаёт все части набора по одной штуке.

---

## EN

### What it is

The game includes a permanent test account and an in-game dev console for fast QA.

- Login: `godmod`
- Password: `godmod123`
- Open / close console: `` ` `` or `ё`

The console is available only after logging into the `godmod` account.

---

### Quick start

1. Launch the game.
2. On the login screen click `GODMODE` or enter:
   - `godmod`
   - `godmod123`
3. If the account does not exist yet, it is created automatically.
4. After the character is loaded, press `` ` `` or `ё`.
5. Type `help` to see the short command list.

---

### Data model overview

There are two major groups of data:

- **Backend / character state**
  - character gold
  - level
  - experience
  - free points
  - stats
  - regular inventory
  - equipment
  - learned skills

- **Runtime / world state**
  - quest items
  - materials
  - resources
  - player flags
  - unlocked locations / dialogues / shops
  - runtime overlay for gold and world-items
  - quest state

The `sync runtime` command merges runtime regular-items and runtime gold into the backend character inventory.

---

### General syntax rules

- Core command words are case-insensitive.
- It is best to copy IDs directly from the admin panel.
- Arguments with spaces can be wrapped in quotes.
- Some commands have compact alias forms, for example:
  - `get_quest_feralas_followers_path_start`
  - `delete_quest_feralas_followers_path_start`
  - `give_item_iron_sword`
  - `give_quest_item_feralas_emblem`
  - `give_skill_skill_firebolt`
  - `give_gold_5000`
  - `set_level_20`
  - `teleport_city_city_arklein`
  - `teleport_location_loc_feralas_cult`
  - `open_merchant_merchant_weaponsmith`
  - `give_itemset_set_feralas_ash`

---

### Core commands

```txt
help
state
```

- `help` — short command list
- `state` — current snapshot of character and runtime storages

---

### Gold, XP, level, points

```txt
gold add 1000
gold set 5000

xp add 250
xp set 9000

level set 15

points add 10
points set 99
```

---

### Stats

Supported:

- `hp`
- `mp`
- `stamina`
- `strength`
- `constitution`
- `dexterity`
- `intelligence`
- `luck`
- `perception`
- `willpower`

Examples:

```txt
stat set strength 30
stat add strength 5

stat set hp 220
stat set mp 150
stat set perception 18
```

Notes:

- `constitution` maps to internal backend field `endurance`
- `perception` maps to internal backend field `speed`

---

### Current character resources

```txt
resource full

resource set hp 120
resource set mp 80
resource set stamina 65
resource set regen 4
```

Supported:

- `hp`
- `mp`
- `stamina`
- `regen`

---

### Regular items

```txt
item add item_iron_sword
item add item_iron_sword 3
item remove item_iron_sword
item remove item_iron_sword 2
```

To inspect available IDs:

```txt
list items
list items sword
```

---

### Equipment

```txt
equip item_iron_sword
equip item_iron_sword weapon
unequip weapon
unequip armor
```

---

### Skills

```txt
skill add skill_firebolt
skill remove skill_firebolt

list skills
list skills fire
```

---

### Professions

```txt
profession list
profession unlock mining
profession remove mining

profession xp add mining 100
profession xp set mining 0
profession level set mining 5
profession points add mining 10
profession points set mining 99

profession skill learn mining mining_strong_swing
profession skill reset mining

profession branch choose mining mining_branch_deep_delver
profession branch reset mining
```

This is the fastest way to test profession progression:

- `unlock` opens the profession in the character profile
- `xp add` / `xp set` help verify level growth and skill point gain
- `level set` and `points set` let you build a test setup in one step
- `skill learn` and `branch choose` mirror the profession UI actions
- `skill reset` and `branch reset` clear the test state for another pass

---

### Mining / mine runs

```txt
mine open mine_teramor_old_iron
mine close
mine finish escaped
mine finish retreated
mine finish failed
mine finish dead
```

Notes:

- the `Выйти из шахты` button is always available while a run is active
- legacy `exit` blocks are deprecated and no longer required for leaving a mine
- `mine close` simulates a safe exit through the UI button
- `mine finish ...` is a fast QA shortcut for terminal mine states

---

### Quests

```txt
quest get feralas_followers_path_start
quest start feralas_followers_path_start
quest advance feralas_followers_path_start
quest complete feralas_followers_path_start
quest fail feralas_followers_path_start "debug fail"
quest reset feralas_followers_path_start

quest track feralas_followers_path_start
quest track feralas_followers_path_start obj_speak_to_vaern
quest untrack

quest reward feralas_followers_path_start
quest flag feralas_followers_path_start truth_heard true

objective complete feralas_followers_path_start obj_speak_to_vaern

list quests
list quests feralas
```

What each one does:

- `get` — prints current player quest state
- `start` — grants a quest
- `advance` — advances the quest to the next step
- `complete` — completes the quest and tries to grant rewards
- `fail` — fails the quest
- `reset` — removes the player quest state
- `track` — sets the active tracked quest
- `untrack` — clears the tracked quest
- `reward` — manually applies the quest reward payload
- `flag` — sets a quest-specific flag
- `objective complete` — marks an objective as completed

---

### Quest items

```txt
questitem add feralas_emblem
questitem add feralas_emblem 2
questitem remove feralas_emblem

give_quest_item_feralas_emblem
```

This uses the same storage that `has_quest_item` conditions read from.

---

### Materials and resources

```txt
material add iron_ore 5
material remove iron_ore 2

resource add ash_resin 3
resource remove ash_resin 1

list materials
list materials ore
```

---

### Player flags

```txt
flag list
flag get feralas_truth_known
flag set feralas_truth_known true
flag set cult_rank 3
flag delete cult_rank
```

---

### Unlocks

```txt
unlock location loc_feralas_cult
unlock dialogue dlg_npc_vaern_flamebearer_5x3j
unlock shop merchant_weaponsmith

unlock all locations
unlock all dialogues
unlock all shops
```

---

### Teleport

```txt
teleport world
teleport city city_arklein
teleport location loc_feralas_cult

tp world
tp city city_arklein
tp location loc_feralas_cult
```

Notes:

- `city` opens the local city map
- `location` opens either a local location map or the legacy location window if the location has no local map

---

### Panels and UI

```txt
panel open inventory
panel open character
panel open stats
panel open skills
panel open equipment
panel open merchant merchant_weaponsmith
panel open arena
panel open map
panel close
```

---

### Merchants

```txt
merchant list
merchant list smith
merchant open merchant_weaponsmith

open_merchant_merchant_weaponsmith
```

---

### Combat debugging

```txt
battle map battlemap_arklein_arena_test

battle start
battle start 1
battle start 4 battlemap_arklein_arena_test

battle npc npc_vaern_flamebearer
battle npc npc_vaern_flamebearer,npc_bandit_archer battlemap_arklein_arena_test
```

What each one does:

- `battle map` — selects the default battle map
- `battle start` — starts combat against generated enemies
- `battle npc` — starts combat against specific NPCs from content

---

### Item sets

```txt
itemset list
itemset list feralas

itemset give set_feralas_ash
itemset remove set_feralas_ash

give_itemset_set_feralas_ash
```

`itemset give` grants one copy of every `pieceItemId` in the set.

---

### Content lookup

```txt
list items
list skills
list quests
list npcs
list dialogues
list merchants
list cities
list locations
list battlemaps
list itemsets
list materials
```

You can add a filter:

```txt
list npcs vaern
list dialogues feralas
list locations cult
list battlemaps arena
```

---

### Clearing runtime storages

```txt
clear questitems
clear materials
clear resources
clear flags
clear runtimeitems
clear allruntime
```

What gets cleared:

- `questitems` — all runtime quest items
- `materials` — runtime materials
- `resources` — runtime resources
- `flags` — player flags
- `runtimeitems` — runtime regular items plus runtime gold overlay
- `allruntime` — all of the above at once

---

### Runtime overlay sync

```txt
sync runtime
```

Useful when:

- a dialogue or quest gave a regular `item`
- a dialogue or quest gave runtime gold
- you want to move that data into the backend character inventory

---

### Recommended testing flows

#### Quickly test the Feralas quest

```txt
quest start feralas_followers_path_start
questitem add feralas_emblem
teleport location loc_feralas_cult
```

#### Quickly build a mage test character

```txt
level set 20
points set 50
stat set intelligence 40
stat set willpower 35
skill add skill_firebolt
skill add skill_arcane_burst
item add item_initiate_staff
equip item_initiate_staff
```

#### Quickly open a merchant and inspect prices

```txt
gold set 99999
merchant open merchant_weaponsmith
```

#### Quickly start combat against a specific NPC

```txt
battle npc npc_vaern_flamebearer battlemap_arklein_arena_test
```

---

### Important notes

- Godmode commands are not intended for normal players.
- Some commands modify persistent character data, not just the current session.
- `clear allruntime` does not delete the backend character, but it does wipe the runtime world layer.
- `quest reward` can apply rewards more than once if you run it repeatedly.
- `itemset give` grants all set pieces one by one.
