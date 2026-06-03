# THEEND_TUTORIAL_RULES_V1

_Версия: v1_  
_Дата сводки: 2026-06-04_  
_Назначение: единый опорный документ по правилам проекта TheEnd_

---

## 1. Что это за документ

Этот файл объединяет и нормализует правила из существующих документов:

- `BALANCE_BASELINE_TUTORIAL_RU.md`
- `CRAFTING_PROCESSING_SYSTEM_TZ_RU.md`
- `PROFESSIONS_AND_MINING_TUTORIAL_RU.md`
- `THEEND_COMBAT_RULES.md`
- `THEEND_CONTENT_CREATION_TUTORIAL_RU_EN.md`
- `THEEND_JSON_GUIDE.md`
- `THEEND_RUNTIME_JSON_GUIDE.md`
- `TUTORIAL_OUTGAME.md`
- `GODMODE_CONSOLE_TUTORIAL.md`
- `LIVING_WORLD_*`
- `RUNTIME_AUDIT_REPORT.md`
- `UNIVERSAL_ITEM_SYSTEM_TZ_RU.md`
- и связанных handoff/checklist документов

Этот документ должен использоваться как:

1. главный onboarding для работы с проектом;
2. текущая “конституция” контента и runtime;
3. точка правды для новых задач Copilot / Codex;
4. база для проверки: что уже считается рабочим, что ещё переходное, что нельзя ломать.

Старые документы не удаляются, но считаются:

- либо специализированными приложениями;
- либо историческими handoff/TZ;
- либо deep-dive справочниками.

---

## 2. Главное правило проекта

TheEnd строится не как набор изолированных экранов, а как единая RPG-система, где связаны:

- контент;
- runtime;
- UI;
- админка;
- мир;
- бой;
- профессии;
- экономика.

Любая новая система должна:

1. не ломать старые JSON и legacy-поля;
2. проходить через нормализацию и import/export;
3. иметь понятную модель данных;
4. иметь понятную админскую настройку;
5. быть видимой и понятной игроку в UI;
6. не жить только “декорацией”, если заявлена как игровая механика.

---

## 3. Что уже считается внедрённым и рабочим

На текущем этапе в проекте уже существуют и должны считаться реальными системами:

### 3.1. Базовый контентный слой

Рабочие коллекции:

- `items`
- `materials`
- `skills`
- `quests`
- `dialogues`
- `npcs`
- `merchants`
- `lootTables`
- `itemSets`
- `craftingRecipes`
- `images`
- `battleMaps`
- `cities`
- `locations`
- `professions`
- `visualFx`

### 3.2. Живой мир

Система живого мира интегрирована:

- backend world simulation module существует;
- frontend world simulation admin существует;
- активные сущности мира отображаются на карте;
- торговцы, банды и world entities поддерживаются как активные сущности;
- есть admin route `/admin/world-sim`.

Это уже не концепт, а действующий слой.

### 3.3. Диалоги и квестовый runtime

Система диалогов и квестов рабочая, но с чёткими рамками.

Подтверждённо работают:

- старт квеста из диалога;
- проверка `quest_active`, `quest_completed`, `quest_not_started`, `quest_failed`;
- `objective_completed`;
- `objective_not_completed`;
- `zone_inspect`;
- `object_interact`;
- `giveQuestItem`, `completeObjective`, `completeQuest`, `setQuestFlag`, `giveGold`, `trainSkill`, `openShop`, `startCombat`.

### 3.4. Боевой runtime

Тактический бой считается рабочим и опирается на:

- клеточное поле;
- Manhattan distance;
- action economy;
- stamina / mana;
- body-zone combat;
- AI ходов NPC;
- React/Phaser battle shell.

### 3.5. Профессии

Рабочие или частично рабочие направления:

- general professions framework;
- mining;
- blacksmithing;
- profession skill trees;
- profession branches;
- profession XP / unlocks.

### 3.6. Крафт и переработка

Контентный слой `craftingRecipes` уже существует и должен считаться официальным слоем данных для:

- плавки;
- обработки материалов;
- кузнечных рецептов;
- service-рецептов;
- будущих профессий.

### 3.7. Visual FX

Visual FX больше не должны рассматриваться как “одиночная анимашка только слева направо”.

Система уже движется к:

- `single FX`
- `composite FX`
- placement / linger
- movement behavior
- skill-driven visual sequencing

Это направление должно сохраняться и расширяться.

---

## 4. Что уже исправлено и подтверждено

### 4.1. Runtime audit

По итогам runtime audit уже зафиксировано:

- добавлена совместимость старого `giveQuest` и нового `startQuest`;
- поддержаны `objective_completed` и `objective_not_completed`;
- подтверждён приоритет `zone_inspect` через interaction;
- documented issue: `has_quest_item` всё ещё требует осторожности.

### 4.2. Живой мир

Интеграция живого мира доведена до production-usable состояния:

- типы;
- backend module;
- frontend admin;
- active entity layer;
- snapshot API;
- примеры данных и quick start.

### 4.3. Blacksmith / materials / merchants

На текущем этапе уже были введены и закреплены:

- новые material-first правила;
- отдельная торговля материалами;
- legacy material items как совместимость;
- фильтрация legacy materials в `Items`;
- связка merchant ↔ npc ↔ dialogue;
- fallback-портреты торговцев через связанного NPC;
- продажа материалов материал-торговцам из runtime material storage.

### 4.4. Visual FX и skill movement

В системе уже есть опора для:

- linger FX на цели;
- effect placement modes;
- dash_to_target;
- teleport_to_target;
- teleport_there_and_back;
- composite sequence direction.

Это нужно считать уже частью правил проекта, а не экспериментом “для одного скилла”.

---

## 5. Что ещё не считается полностью завершённым

Это важно. Ниже перечислено то, что уже существует, но пока должно считаться зоной активной доработки.

### 5.1. Кузнец

Кузнец уже существует как система, но пока ещё не считается полностью финализированным.

Уже есть:

- профессия;
- древо навыков;
- рецепты;
- вкладки профессии;
- визуальные ассеты;
- базовый forge screen;
- начало mini-game;
- admin-слой под кузни / инструменты / визуал / баланс.

Но ещё должно считаться незавершённым:

- полная связка mini-game ↔ реальные материалы ↔ сохранение результата;
- корректное применение skill effects кузнеца в расчётах;
- полноценная выдача предмета с итоговыми свойствами по качеству;
- полная прогрессия городской кузни → собственной кузни → модулей мастерской.

### 5.2. Visual FX composite authoring

Composite FX — правильное направление, но это зона активной сборки.

Нужно считать в работе:

- preview full sequence;
- composite authoring UX;
- composite validation;
- battle sync hooks;
- skill integration;
- richer stage semantics.

### 5.3. Phaser/React parity

Это не закрытая тема.

Есть отдельный parity roadmap, и пока нужно считать, что:

- parity — обязательная цель;
- React-режим остаётся эталонной опорой поведения;
- Phaser не должен вводить альтернативную логику мира и боя.

---

## 6. Неприкосновенные архитектурные правила

### 6.1. Legacy нельзя ломать

Нельзя без отдельной миграции:

- удалять старые поля;
- переименовывать старые ids массово;
- ломать старые backup/import/export JSON;
- ломать старые `bonuses`, `damageMin`, `damageMax`, `armorValue`, `effects`, `combatEffects`, `useEffect`.

### 6.2. Items и Materials — не одно и то же

Новая логика проекта:

- `Materials` — сырьё, компоненты, полуфабрикаты, руда, слитки, порошки, дерево, кожа, ткань, пищевые ингредиенты;
- `Items` — готовые игровые предметы: оружие, броня, consumables, руны-вставки, магические камни, артефакты.

Legacy item-материалы допускаются только ради совместимости.

### 6.3. Recipes живут отдельно от профессий

`CraftingRecipe` — отдельный контентный слой.

Профессия отвечает на вопрос:
- кто умеет;

Рецепт отвечает:
- как делается;

Станция отвечает:
- где делается.

### 6.4. Visual FX и gameplay не должны срастаться в кашу

Gameplay отвечает за:

- урон;
- hit/miss/crit;
- статусы;
- цели;
- применение эффектов.

Visual FX отвечает за:

- как это выглядит;
- какие стадии проигрываются;
- где показывается эффект;
- какие звуки/вспышки/linger/impact/dash/teleport идут визуально.

Допустимы runtime hooks, но не подмена gameplay-логики визуалкой.

### 6.5. Runtime overlay — официальная часть проекта

Local/runtime storage уже используется для:

- материалов;
- ресурсов;
- quest items;
- unlocks;
- временных runtime overlays.

Нельзя писать новую систему так, будто существует только backend inventory.

---

## 7. Боевая модель: правила v1

### 7.1. Поле

- сетка 12x12;
- позиция определяет дистанцию;
- Manhattan distance — базовая формула.

### 7.2. Экономика хода

Каждый раунд:

- 1 Main Action
- 1 Move Action
- 1 Defense Choice

### 7.3. После движения нельзя безусловно атаковать

Разрешено:

- move 1 cell + attack

По умолчанию запрещено:

- 2+ move + attack
- dash + attack
- disengage + attack

### 7.4. Guard / defense

Остаётся действующей система защитных зон тела и guard modes.

### 7.5. Opportunity attack

Сохраняется как правило выхода из melee без disengage.

---

## 8. Баланс: правила v1

### 8.1. Общая цель

Игра должна ощущаться так:

- деньги в дефиците, но без тотального кризиса;
- броня полезна, но не делает персонажа бессмертным;
- статы различаются по ролям;
- рост персонажа не должен ломать контент слишком быстро.

### 8.2. За уровень

Опорная база:

- персонаж получает `4` stat points за уровень.

### 8.3. Роли статов

- `Strength` — опора мили-урона;
- `Dexterity` — темп, точность, мобильность;
- `Perception` — важна, но не должна доминировать над всем;
- `Constitution` — выживаемость, но не в связке “вечный танк”;
- `Willpower / Intelligence` — магическая и ментальная роль;
- `Luck` — вспомогательная.

### 8.4. Броня

Броня должна:

- снижать риск;
- давать стабильность;
- но не выключать опасность полностью на раннем и среднем тире.

### 8.5. Деньги

Нужное ощущение экономики:

- постоянно чувствуем нехватку;
- но не живём в перманентной нищете;
- покупка улучшений должна быть значимой;
- продажа не должна превращаться в бесконечный денежный дюп через лёгкий лут.

---

## 9. Контентная модель: Items / Materials / Recipes / NPC / Quests

### 9.1. Items

Используются для:

- экипировки;
- оружия;
- брони;
- consumables;
- магических предметов;
- готовых боевых/игровых объектов.

### 9.2. Materials

Используются для:

- сырья;
- торговли ресурсами;
- переработки;
- полуфабрикатов профессий;
- экономических единиц мира.

### 9.3. Quests

Самые стабильные паттерны:

- старт через NPC dialogue;
- старт/прогресс через zone inspect;
- возврат к NPC за завершением.

### 9.4. Dialogues

Диалоги должны использовать:

- `actions[]` как основной и безопасный путь;
- эффекты-bridge только там, где явно поддержано runtime.

### 9.5. NPC

NPC должны проектироваться как связующее звено:

- dialogue;
- quest;
- trainer;
- merchant;
- world presence;
- combat hooks.

---

## 10. Крафт и производство: правила v1

### 10.1. Основные enum-направления

Поддерживаются как минимум:

- `material_processing`
- `smelting`
- `blacksmith_craft`
- `alchemy`
- `cooking`
- и другие recipeType, уже заложенные в модели.

### 10.2. StationType важен

Станция — не декоративное поле. Она должна использоваться как часть логики рецепта.

### 10.3. Рецепты не должны ломать мир

Integrity checks обязательны:

- duplicate ids;
- пустые inputs/outputs;
- broken references;
- invalid resultPool;
- invalid professionId;
- invalid stationType.

### 10.4. Materials должны нормально торговаться

Если торговец material-trader:

- он может продавать материалы;
- он может покупать материалы;
- покупка/продажа должны работать и для runtime material storage, а не только для обычных item entries.

---

## 11. Профессии: правила v1

### 11.1. Профессия — это не только skill tree

Профессия должна состоять из:

- overview;
- progression;
- recipes;
- profession-specific inventory/filtering;
- gameplay loop / minigame / runtime;
- admin configuration.

### 11.2. Mining

Горняк уже должен считаться опорным шаблоном profession + minigame + world entry.

### 11.3. Blacksmith

Кузнец должен развиваться как:

- профессия;
- рецепты;
- forge minigame;
- мастерская;
- station progression;
- item quality system;
- material transformation chain.

Главное правило кузнеца:

- он не должен быть просто “кнопочным крафтом”.

---

## 12. Living World: правила v1

### 12.1. Active world entities — официальная система

Нельзя обращаться с живым миром как с одноразовым прототипом.

Есть:

- archetypes;
- routes;
- spawn rules;
- active world entities;
- snapshot API;
- admin monitor.

### 12.2. Merchant world behavior

Торговец в мире должен быть:

- либо в пути с world entity / повозкой;
- либо в городе как NPC/merchant presence;
- не одновременно как сломанная смесь двух состояний.

### 12.3. Merchant ↔ NPC link обязателен

Если торговец связан с NPC:

- портрет должен подбираться;
- титул должен подбираться;
- диалог должен быть доступен;
- торговля должна открываться через эту связку.

---

## 13. Visual FX: правила v1

### 13.1. FX бывают двух уровней

- `single`
- `composite`

### 13.2. Single FX

Один эффект:

- одна анимация;
- один placement;
- одна логика проигрывания.

### 13.3. Composite FX

Один FX может быть сценарием из стадий:

- cast;
- projectile;
- impact;
- linger;
- sound;
- camera;
- movement;
- return.

### 13.4. Что должен понимать runtime

Не только “справа налево”.

Нужны реальные режимы:

- linger on target;
- follow target;
- follow caster;
- projectile straight/arc;
- dash to target;
- teleport to target;
- teleport there and back.

### 13.5. Не всё обязано быть готово сразу

Но направление зафиксировано:

- FX — это уже не только sprite-playback;
- это боевой визуальный сценарий.

---

## 14. Phaser / React parity: правила v1

### 14.1. Нельзя держать две разные игры

React и Phaser должны отображать один и тот же gameplay, а не два разных поведения.

### 14.2. Общая логика должна быть shared

Особенно для:

- world movement;
- interaction handling;
- combat playback;
- entity rendering adapters;
- effect triggers.

### 14.3. Rollout only behind toggles

Parity-работа должна раскатываться:

- поэтапно;
- за переключателями;
- с smoke-checklist’ом.

---

## 15. JSON и import/export: правила v1

### 15.1. Все новые сущности проходят через нормализацию

Обязательно:

- trim strings;
- safe defaults;
- clamp numbers;
- filter empty ids;
- preserve backward compatibility.

### 15.2. Импорт не должен требовать ручной миграции

Новый слой нельзя проектировать так, будто весь старый JSON можно просто выбросить.

### 15.3. Документация должна совпадать с runtime

Если docs говорят, что enum поддержан, runtime действительно должен его понимать.

И наоборот:

- не надо документировать как “готовое”, если это только красиво выглядит в форме, но не работает в runtime.

---

## 16. Godmode / Debug / QA: правила v1

### 16.1. Godmode — это не игрушка, а рабочий инструмент

Он используется для:

- прогонки квестовых цепочек;
- проверки материалов;
- проверки профессий;
- проверки unlocks;
- world simulation smoke-test;
- экономических сценариев;
- проверки runtime overlay.

### 16.2. Runtime overlay sync обязателен

Если используются:

- runtime gold;
- runtime items;
- runtime materials;
- runtime resources;

то должны существовать:

- команды очистки;
- команды синхронизации;
- понятный способ понять, где лежит фактическое состояние.

---

## 17. Что сейчас ещё считается упущенным

Ниже — главное, что пока ещё не доведено до “закрытой” зрелой системы.

### 17.1. Blacksmith

Нужно довести:

- связь рецептов с материалами;
- расход материалов;
- сохранение результата;
- перенос свойств качества в готовый предмет;
- использование skill effects в расчётах;
- городская кузня → собственная кузня → мастерская.

### 17.2. Visual FX authoring UX

Нужно довести:

- preview complete sequence;
- удобный sequence editor;
- расширенные composite сценарии;
- подтверждённые enum’ы и runtime hooks.

### 17.3. Item effects / sets / augments

Нужно довести:

- preview ↔ resolver parity;
- blacksmith instance-state effects;
- item-set gameplay exposure;
- safe rollout без ломки legacy items.

### 17.4. Documentation hygiene

Документов много, они полезны, но сейчас фрагментированы.

После появления этого файла стоит считать:

- `THEEND_TUTORIAL_RULES_V1.md` — главный входной документ;
- остальные — специализированные приложения.

---

## 18. Что нельзя делать дальше

1. Нельзя плодить новые системы без admin/runtime/content-сцепки.
2. Нельзя делать “декоративные” механики, которые не влияют на игру.
3. Нельзя ломать legacy совместимость без миграции.
4. Нельзя дублировать логику между React и Phaser.
5. Нельзя считать `items` и `materials` одним и тем же.
6. Нельзя документировать неподдерживаемые enum как рабочие.
7. Нельзя держать боевую, profession и world-логику в виде рассинхронизированных частных костылей.

---

## 19. Рекомендуемый порядок работы дальше

### Приоритет 1

- довести blacksmith runtime до настоящей игровой системы;
- довести Visual FX composite pipeline;
- сохранить merchant/material/world consistency;
- продолжить Phaser/React parity без раскола логики.

### Приоритет 2

- довести universal item effects / sockets / augments / set bonuses;
- укрепить preview/resolver parity;
- расширить content-side validation.

### Приоритет 3

- улучшать UX админки;
- чистить docs;
- переводить специализированные handoff-файлы в приложения к этой сводке.

---

## 20. Короткий итог

TheEnd уже не “пустой каркас”.

У проекта уже есть:

- живой мир;
- квестовый runtime;
- тактический бой;
- профессии;
- materials/items split;
- рецепты;
- world-sim;
- админка;
- runtime overlays;
- Visual FX evolution;
- база для кузнеца и сложных profession loops.

Главная задача v1-состояния:

- не расплескать это в набор разрозненных подсистем,
- а довести до состояния, где каждая новая механика проходит через:
  - модель данных,
  - runtime,
  - UI,
  - админку,
  - валидацию,
  - и реальный игровой смысл.

---

## 21. Статус документа

Этот файл следует считать:

- главным tutorial/rules документом проекта на текущем этапе;
- базой для новых ТЗ;
- базой для handoff;
- базой для дальнейшей чистки старой документации.

Рекомендуемое следующее действие после принятия этого файла:

- использовать его как primary reference,
- а узкоспециализированные md-файлы переводить в роль приложений и deep-dive материалов.
