# THEEND: Справочник механик, функций и enum-контрактов

## Зачем этот файл

Этот справочник нужен как опорный документ перед переходом от текущей пошаговой RPG к будущей `action-RPG`, не ломая текущий путь.

Ключевое ограничение:

- сейчас **ничего не переизобретаем и не мигрируем насильно**;
- текущая пошаговая модель, контент JSON, админка и рантайм остаются источником поведения;
- будущий sprite/editor слой должен **встраиваться поверх уже существующих контрактов**, а не переписывать их с нуля.

## Что было просмотрено

### Основные `.md` документы

- `C:\theend\README.md`
- `C:\theend\docs\THEEND_COMBAT_RULES.md`
- `C:\theend\INVENTORY_ITEMS_GUIDE.md`
- `C:\theend\docs\LIVING_WORLD_INTEGRATION.md`
- `C:\theend\docs\PROFESSIONS_AND_MINING_TUTORIAL_RU.md`
- `C:\theend\docs\THEEND_JSON_GUIDE.md`
- `C:\theend\docs\THEEND_RUNTIME_JSON_GUIDE.md`

### Ключевые кодовые источники

- `C:\theend\packages\rpg-domain\src\index.ts`
- `C:\theend\packages\rpg-domain\src\arena-battle.ts`
- `C:\theend\packages\rpg-domain\src\battle-map.ts`
- `C:\theend\packages\rpg-domain\src\character-rules.ts`
- `C:\theend\packages\rpg-domain\src\stats.ts`
- `C:\theend\packages\rpg-domain\src\races.ts`
- `C:\theend\packages\rpg-domain\src\damage.ts`
- `C:\theend\packages\rpg-domain\src\equipment.ts`
- `C:\theend\packages\rpg-domain\src\items.ts`
- `C:\theend\packages\rpg-domain\src\skills.ts`
- `C:\theend\packages\rpg-domain\src\skills\skill.enums.ts`
- `C:\theend\packages\rpg-domain\src\professions.ts`
- `C:\theend\packages\rpg-domain\src\runes.ts`
- `C:\theend\packages\rpg-domain\src\visual-effects.ts`
- `C:\theend\apps\backend\src\content\content.types.ts`
- `C:\theend\apps\backend\src\combat\ai-combat-planner.ts`
- `C:\theend\apps\backend\src\worldsim\types\world-simulation.types.ts`
- `C:\theend\apps\frontend\src\services\questRuntime.ts`
- `C:\theend\apps\frontend\src\services\dialogueRuntime.ts`
- `C:\theend\apps\frontend\src\services\questInteractionRuntime.ts`
- `C:\theend\apps\frontend\src\services\content\models.ts`
- `C:\theend\apps\frontend\src\worldmap\zoneEditorTypes.ts`
- `C:\theend\apps\frontend\src\worldmap\zoneTaxonomy.ts`
- `C:\theend\apps\frontend\src\worldmap\questBattleResolver.ts`
- `C:\theend\apps\frontend\src\battle\battleRendererSettings.ts`

---

## 1. Текущее устройство проекта

### Монорепа

`THEEND` уже разделён на три главные зоны ответственности:

1. `C:\theend\packages\rpg-domain`
   - общий игровой домен;
   - типы, правила, расчёты, enum-ы, shared utility-функции;
   - это главный кандидат на роль **долгоживущего gameplay-contract слоя**.

2. `C:\theend\apps\backend`
   - API;
   - content database / import-export;
   - боевые и skill runtime сервисы;
   - симуляция мира;
   - контентные типы для админки и сохранения.

3. `C:\theend\apps\frontend`
   - клиентская игра;
   - world map;
   - battle UI и Phaser battle renderer;
   - админка;
   - quest/dialogue runtime;
   - локальный runtime для части механик.

### Практический вывод

Если позже делать sprite/editor для action-RPG, то:

- **источником геймдизайнерских сущностей** должен оставаться shared/domain и content model;
- рендерер, спрайты, анимации, hitboxes, action-state machine должны стать **отдельным слоем поверх этого**;
- нельзя делать так, чтобы sprite editor сам придумывал отдельные несвязанные enum-ы оружия, ролей, стихий, статусов, урона.

---

## 2. Что уже реально есть в игре

## 2.1 Игрок, раса, статы, гражданство

Есть:

- базовые первичные статы;
- распределение статов;
- расы и расовые ограничения;
- гражданство/королевство;
- репутация по королевствам;
- стартовые бонусы и стартовые профессии/скиллы;
- правила доступа к академиям и к типам магии.

Ключевые файлы:

- `C:\theend\packages\rpg-domain\src\stats.ts`
- `C:\theend\packages\rpg-domain\src\races.ts`
- `C:\theend\packages\rpg-domain\src\character-rules.ts`

Уже работает как системный контракт:

- стартовые free points;
- resource-стати (`hp`, `mp`, `stamina`) масштабируются отдельно;
- Argos/Luminor/Artalon/Kriantar/Terimia имеют свои бонусы;
- расы могут блокировать школы магии;
- стартовые профессии и стартовые скиллы уже выводятся из race rules.

### Для будущей action-RPG

Эти правила можно переносить без изменения:

- скорость атаки, animation speed, dodge cost, stamina drain, cast times можно навешивать позже;
- но race/kingdom/skill access лучше не дублировать, а читать из существующего домена.

## 2.2 Предметы, экипировка, материалы

Есть:

- предметы;
- rarity;
- slots;
- two-handed logic;
- материалы;
- merchant types;
- item effects / augments / sockets;
- crafting/profession tool предметы.

Ключевые файлы:

- `C:\theend\packages\rpg-domain\src\items.ts`
- `C:\theend\packages\rpg-domain\src\equipment.ts`
- `C:\theend\apps\backend\src\content\content.types.ts`
- `C:\theend\apps\frontend\src\services\content\models.ts`

Практически это уже означает, что будущий editor должен уметь понимать:

- какой предмет является оружием, бронёй, материалом, зельем;
- какой slot он занимает;
- сколько рук требует;
- какой тип урона наносит;
- какие эффекты даёт на экипировке;
- есть ли сокеты и что туда вставляется.

## 2.3 Навыки, магия, эффекты, статусы

Есть:

- систематизированные skill enums;
- типы навыков;
- подтипы;
- ресурсы;
- таргетинг;
- области;
- эффекты;
- summon/spirit/risk модель;
- визуальные эффекты;
- боевые статусы.

Ключевые файлы:

- `C:\theend\packages\rpg-domain\src\skills\skill.enums.ts`
- `C:\theend\packages\rpg-domain\src\skills.ts`
- `C:\theend\packages\rpg-domain\src\damage.ts`
- `C:\theend\packages\rpg-domain\src\combat-status-registry.ts`
- `C:\theend\packages\rpg-domain\src\combat-status-runtime.ts`
- `C:\theend\packages\rpg-domain\src\visual-effects.ts`

Это уже почти готовая semantic-модель для action editor:

- skill знает, что он физический, магический, рунный, шаманский;
- знает target type;
- знает area shape;
- знает resource cost;
- знает effect stack mode;
- знает школу/стихию/тип урона.

То есть будущий sprite editor не должен хранить знания о боевой логике только в анимациях. Он должен лишь:

- привязывать анимации и FX к already-existing skill definition;
- знать, какой hit frame соответствует касту/удару;
- знать, нужен projectile или melee swing;
- знать anchor и placement для VFX.

## 2.4 Пошаговый бой

Есть:

- arena/quest battle система;
- боевая сетка;
- move / defend / attack / skip turn;
- battle objectives;
- extraction zones;
- spawn zones;
- battle map objects / traps / triggers / scripted events;
- боевой action plan и revalidation;
- AI planner;
- Phaser renderer для battlefield.

Ключевые файлы:

- `C:\theend\packages\rpg-domain\src\arena-battle.ts`
- `C:\theend\packages\rpg-domain\src\battle-map.ts`
- `C:\theend\packages\rpg-domain\src\combat-plan.ts`
- `C:\theend\packages\rpg-domain\src\combat-costs.ts`
- `C:\theend\packages\rpg-domain\src\combat-guard.ts`
- `C:\theend\apps\backend\src\combat\combat.service.ts`
- `C:\theend\apps\backend\src\combat\ai-combat-planner.ts`
- `C:\theend\apps\frontend\src\battle\*`

Что важно для перехода к action-RPG:

- бой уже имеет **семантику действий**;
- action-RPG должна менять прежде всего **режим исполнения**, а не сам meaning сущностей;
- attack, skill, defend, movement, threat, target selection, objective progress уже существуют как доменные действия.

То есть потом можно:

- оставить те же skill/item/status definitions;
- заменить пошаговое выполнение на realtime execution pipeline;
- использовать Phaser battle/runtime сцены для action слоя.

## 2.5 Квесты, диалоги, NPC, world-map launch

Есть:

- quest categories / statuses / run statuses;
- objectives, rewards, conditions;
- dialogue runtime;
- NPC definitions;
- quest interactions;
- world-map markers and zones;
- quest battle launch through world map zones.

Ключевые файлы:

- `C:\theend\apps\frontend\src\types\quest.ts`
- `C:\theend\apps\frontend\src\types\npc.ts`
- `C:\theend\apps\frontend\src\services\questRuntime.ts`
- `C:\theend\apps\frontend\src\services\dialogueRuntime.ts`
- `C:\theend\apps\frontend\src\services\questInteractionRuntime.ts`
- `C:\theend\apps\frontend\src\worldmap\zoneEditorTypes.ts`
- `C:\theend\apps\frontend\src\worldmap\questBattleResolver.ts`

Для будущего editor это критично:

- sprite/NPC editor должен знать не только portrait и sprite;
- он должен понимать `dialogueId`, `questId`, `combatRole`, `aiProfileId`, `loadoutPresetId`;
- marker/zone/interaction visibility уже связаны с quest state, и это нужно сохранить.

## 2.6 World map, зоны, города, локации

Есть:

- world map runtime;
- zone editor;
- passability / region paint;
- city/location typing;
- zone interaction modes;
- random/quest/battle/transition semantics;
- выбор renderer: `canvas` и `phaser`.

Ключевые файлы:

- `C:\theend\apps\frontend\src\worldmap\zoneTaxonomy.ts`
- `C:\theend\apps\frontend\src\worldmap\zoneEditorTypes.ts`
- `C:\theend\apps\frontend\src\worldmap\types.ts`
- `C:\theend\apps\frontend\src\worldmap\worldRendererSettings.ts`

Это значит, что будущая action-RPG карта не обязана ломать текущий map editor.

Правильнее:

- оставить текущие zone/city/location definitions;
- добавить sprite/navigation/combat encounter слой;
- дать редактору понимать, какие зоны являются battle launch, quest area, resource area, blocked area и так далее.

## 2.7 Профессии

Есть:

- профессии как отдельный progression слой;
- минимум mining и blacksmithing;
- crafting/workshop related content;
- profession tools and profession items.

Ключевые файлы:

- `C:\theend\packages\rpg-domain\src\professions.ts`
- `C:\theend\packages\rpg-domain\src\blacksmith-session.ts`
- `C:\theend\apps\backend\src\blacksmith\blacksmith.service.ts`
- `C:\theend\docs\PROFESSIONS_AND_MINING_TUTORIAL_RU.md`

Для action editor:

- profession-спрайты и инструменты должны использовать existing ids;
- tool animations должны привязываться к `profession_tool` и related profession effects;
- не стоит делать отдельный "action-only item taxonomy".

## 2.8 Живой мир

Есть:

- npc archetypes;
- routes;
- spawn rules;
- active world entities;
- city market state;
- economy events;
- world simulation snapshot.

Ключевой файл:

- `C:\theend\apps\backend\src\worldsim\types\world-simulation.types.ts`

Это важный задел для action-RPG:

- позже спрайтовый слой сможет читать `activeEntities`;
- world sim уже подразумевает перемещающиеся группы, видимость, состояние, торговлю, агрессию;
- то есть future action world не надо проектировать с нуля, он уже имеет data skeleton.

---

## 3. Главные функции и runtime-точки, которые уже есть

Ниже перечислены функции и сервисы, которые уже формируют фактическую игровую механику.

## 3.1 Статы, расы, гражданство

`C:\theend\packages\rpg-domain\src\stats.ts`

- `getAllocationCost`
- `validateAllocation`
- `applyAllocation`

`C:\theend\packages\rpg-domain\src\races.ts`

- `getRaceDefinition`
- `createRaceModifiers`

`C:\theend\packages\rpg-domain\src\character-rules.ts`

- `createInitialKingdomReputation`
- `createInitialCitizenshipState`
- `applyCitizenshipChange`
- `canRaceUseSkillType`
- `canRaceUseSkillDefinition`
- `getRaceIncomingDamageMultiplier`
- `getRaceOutgoingDamageMultiplier`
- `getKingdomStartingGoldBonus`
- `getKingdomMaxStaminaMultiplier`
- `getSkillMpCostMultiplier`
- `getPhysicalSkillStaminaCostMultiplier`
- `getMissChanceMultiplier`
- `canAccessAcademy`
- `getMerchantPriceModifiers`
- `getCityAccessOutcome`
- `getStartingProfessionIds`
- `getStartingSkillIds`
- `isKingdomId`

## 3.2 Экипировка, предметы, derived combat stats

`C:\theend\packages\rpg-domain\src\equipment.ts`

- `canEquipItem`
- `equipItem`
- `calculateEquipmentBonuses`
- `getStatsWithEquipment`

`C:\theend\packages\rpg-domain\src\derived-stats.ts`

- `calculateTotalDefense`
- `calculateMinDamage`
- `calculateMaxDamage`
- `calculateCritChance`
- `calculateDerivedStats`

## 3.3 Навыки и магический расчёт

`C:\theend\packages\rpg-domain\src\skills.ts`

- `validateSkillDefinition`
- `getSkillCostSummary`
- `getSkillLevelData`
- `getSkillPowerAtLevel`
- `normalizeSkillResourceCosts`

`C:\theend\packages\rpg-domain\src\damage.ts`

- `calculateFinalDamage`
- `applyElementEffect`
- `checkElementCombo`
- `isEffectBlockedByRace`

## 3.4 Пошаговый бой

`C:\theend\packages\rpg-domain\src\combat-plan.ts`

- `normalizeCombatCommand`
- `validateCombatCommand`
- `validateCombatTurnPlan`
- `createCombatCommandFromType`
- `revalidateCombatCommandBeforeExecute`
- `collectAreaEffectTargets`
- `calculateCommandInitiative`

`C:\theend\packages\rpg-domain\src\arena-battle.ts`

- `createInitialBattleState`
- `createQuestBattleContext`
- `validateBattleContextForBattleMap`
- `getReachableBattlefieldTiles`
- `getThreatenedTiles`
- `getBattlefieldTilePlacements`
- `createNpcAction`
- `resolveRound`
- `pickUpBattleObjectiveMarker`
- `evacuateCarriedBodyAtZone`

`C:\theend\packages\rpg-domain\src\combat-status-runtime.ts`

- `tryApplyCombatStatus`
- `collectPeriodicStatusDamage`
- `tickCombatStatusDurationsEndOfRound`
- `syncArenaEntityControlFlagsFromStatuses`

## 3.5 Профессии и руны

`C:\theend\packages\rpg-domain\src\professions.ts`

- `normalizePlayerProfessionsState`
- `unlockProfession`
- `addProfessionXp`
- `computeBlacksmithXpReward`
- `applyBlacksmithCraftResult`

`C:\theend\packages\rpg-domain\src\runes.ts`

- `calculateRuneComplex`
- `canCharacterUseRune`
- `applyRuneCost`
- `calculateRuneBacklashChance`
- `rollRuneBacklash`

`C:\theend\packages\rpg-domain\src\blacksmith-session.ts`

- `createBlacksmithSession`
- `applyBlacksmithAction`
- `finalizeBlacksmithScore`

## 3.6 Квесты и диалоги

`C:\theend\apps\frontend\src\services\questRuntime.ts`

- `evaluateConditions`
- `canStartQuest`
- `startQuest`
- `completeObjective`
- `completeStep`
- `advanceQuest`
- `failQuest`
- `completeQuest`
- `applyQuestRewards`
- `setQuestFlag`
- `getPlayerQuestState`
- `tryStartRandomQuestFromZone`
- `handleQuestEvent`

`C:\theend\apps\frontend\src\services\questInteractionRuntime.ts`

- `evaluateRequirements`
- `getAvailableQuestInteractionChoices`
- `findMatchingQuestInteractions`
- `runQuestInteractionEffects`

`C:\theend\apps\frontend\src\services\questDialogueHooks.ts`

- `checkDialogueQuestCondition`
- `applyDialogueQuestAction`

`C:\theend\apps\frontend\src\services\dialogueRuntime.ts`

- dialogue runtime события и переходы;
- связывание choice/node/intent с quest hooks.

## 3.7 Репутация, мир, world-sim

`C:\theend\apps\frontend\src\services\reputationRuntime.ts`

- `getReputationStanding`
- `resolveZoneReaction`
- `resolveNpcReaction`

`C:\theend\apps\frontend\src\services\useWorldSimulation.ts`

- `fetchWorldSimConfig`
- `saveWorldSimConfig`
- `importWorldSimConfig`
- `validateWorldSimConfig`

`C:\theend\apps\backend\src\combat\ai-combat-planner.ts`

- `buildAiCombatTurnPlan`
- вспомогательные стратегии выбора действий;
- текущий слой AI уже существует как отдельная логика, а не как UI-хак.

---

## 4. Источники истины для будущего редактора

Если позже добавлять sprite/action editor в админку, то надо считать canonical source так:

### 1. Gameplay contract

- `C:\theend\packages\rpg-domain\src\*`

Это основные правила:

- расы;
- статы;
- damage types;
- skills;
- battle logic;
- equipment;
- professions;
- runes;
- визуальные FX contracts.

### 2. Content contract

- `C:\theend\apps\backend\src\content\content.types.ts`
- `C:\theend\apps\frontend\src\services\content\models.ts`

Это редакторские сущности:

- items;
- materials;
- quests;
- NPC;
- world map zones;
- city/location;
- sounds;
- crafting/workshop content;
- import/export.

### 3. Runtime execution

- `C:\theend\apps\frontend\src\services\*`
- `C:\theend\apps\frontend\src\worldmap\*`
- `C:\theend\apps\frontend\src\battle\*`
- `C:\theend\apps\backend\src\combat\*`
- `C:\theend\apps\backend\src\skills\*`

Это исполнение:

- как квест стартует;
- как бой запускается;
- как AI действует;
- как мир рисуется;
- как в Phaser или React battle UI это отображается.

### Главное правило

Будущий action/sprite editor должен редактировать **контент и presentation bindings**, но не становиться новым источником фундаментальной логики.

---

## 5. Что важно сохранить при переходе к action-RPG

## 5.1 Не ломать симуляцию домена

Нужно сохранить разделение:

- симуляция и правила;
- визуализация и исполнение;
- админские данные;
- UI-редактор.

Это уже в целом совпадает с хорошей архитектурой browser-game:

- simulation state должен жить вне renderer;
- renderer не должен становиться источником истины;
- DOM/admin/UI остаётся отдельно от игрового canvas/phaser слоя.

## 5.2 Не делать второй параллельный набор enum-ов

Плохой путь:

- завести новые enum-ы только для sprite editor;
- отдельно кодировать weapon classes, cast types, projectile types, aggression styles;
- потом руками маппить их на игру.

Хороший путь:

- опираться на уже существующие:
  - `SkillType`
  - `SkillSubtype`
  - `DamageCategory`
  - `ElementType`
  - `MagicSchool`
  - `NpcCombatRole`
  - `BattleMapObjectiveType`
  - `QuestObjectiveType`
  - `ItemType`
  - `EquipmentSlot`
  - `ProfessionId`
  - `WorldMapQuestLaunchAction`

## 5.3 Использовать stable IDs

Будущий редактор должен работать через:

- `itemId`
- `skillId`
- `npcId`
- `questId`
- `battleMapId`
- `zoneId`
- `effectId`
- `dialogueId`
- `professionId`

А не через "имя файла спрайта" как primary key.

## 5.4 Action-RPG слой должен добавлять, а не заменять

Новый слой должен добавить:

- sprite sets;
- animation states;
- locomotion settings;
- attack timing windows;
- hitboxes/hurtboxes;
- projectile spawn anchors;
- weapon grip offsets;
- blend trees или state transitions;
- sound hooks;
- VFX hooks;
- AI behavior presets для realtime.

Но он не должен заменять:

- базовую skill/item/quest taxonomy;
- квестовые условия;
- world map zone logic;
- battle objectives;
- profession progression.

---

## 6. Что будущему sprite/editor слою надо понимать о нашей игре

Ниже список сущностей, без понимания которых редактор будет "слепым".

## 6.1 Оружие и экипировка

Редактор должен читать:

- `ItemType`
- `ItemSlot`
- `HandsRequired`
- `PhysicalType`
- `DamageCategory`
- `EquipmentSlot`

И уметь делать presentation-binding:

- idle pose по weapon class;
- attack animation set;
- offhand animation support;
- two-handed stance;
- projectile spawn rule;
- block/parry pose;
- draw/sheath offsets.

## 6.2 Боевая математика

Редактору не нужно считать боевую математику самому, но нужно знать:

- от какого skill/item идёт урон;
- melee это или ranged;
- какая resource cost;
- какой effect применяется;
- какой target shape;
- какой cast type;
- какие VFX и sounds надо проигрывать.

## 6.3 Навыки

Нужно поддержать binding вида:

- `skillId -> animationState`
- `skillId -> castPose`
- `skillId -> projectileFxId`
- `skillId -> impactFxId`
- `skillId -> hitFrame`
- `skillId -> soundSetId`

## 6.4 NPC и враги

Редактор должен понимать:

- `NpcKind`
- `NpcRace`
- `NpcCombatRole`
- `aiProfileId`
- `aiPersonality`
- `loadoutPresetId`
- `skillIds`
- `equipment`

И уметь редактировать:

- набор спрайтов;
- faction/kingdom tint или визуальную атрибуцию;
- movement animation pack;
- melee/ranged/mage action pack;
- death/downed/recover states.

## 6.5 Карта и окружение

Редактор должен уметь читать:

- world map zones;
- passability/regions;
- battle map cells;
- blockers;
- covers;
- traps;
- triggers;
- extraction zones;
- spawn zones.

И понимать разницу между:

- глобальной world-map зоной;
- локальной battle-map клеткой;
- визуальным декоративным объектом;
- объектом, который влияет на gameplay.

---

## 7. Каталог enum-ов и enum-подобных контрактов

Ниже перечислены те enum-ы и union types, которые уже участвуют в рабочей логике. Это не просто "список типов", а будущая база для интеграции редактора.

## 7.1 Настоящие TypeScript `enum`

### `C:\theend\packages\rpg-domain\src\races.ts`

- `Race`
  - `HUMAN`
  - `DWARF`
  - `HIGH_ELF`
  - `WOOD_ELF`

### `C:\theend\packages\rpg-domain\src\arena-battle.ts`

- `TargetZone`
- `ActionType`
- `MovementType`
- `CombatSkillType`
- `TeamSide`
- `DistanceBand`
- `BattlefieldTileType`

### `C:\theend\packages\rpg-domain\src\skills\skill.enums.ts`

- `SkillType`
- `SkillSubtype`
- `SkillResourceType`
- `DamageKind`
- `PhysicalDamageType`
- `ElementType`
- `MagicSchoolType`
- `HealType`
- `EffectType`
- `EffectStackMode`
- `SkillTargetType`
- `SkillAreaShape`
- `CastType`
- `StatType`
- `AcquisitionType`
- `SkillClassRole`
- `SkillRiskType`
- `RiskSeverity`
- `SpiritType`
- `SummonType`
- `SummonControlType`

## 7.2 Character / citizenship / academy contracts

### `C:\theend\packages\rpg-domain\src\character-rules.ts`

- `KingdomId`
  - `luminor`
  - `artalon`
  - `kriantar`
  - `terimia`
  - `argos`

- `AcademyId`
  - `academy_four_winds_temple`
  - `academy_aurelia_garden`
  - `academy_tower_of_knowledge`
  - `academy_hall_of_shadows`
  - `academy_black_rite`

## 7.3 Stats contracts

### `C:\theend\packages\rpg-domain\src\stats.ts`

- `PRIMARY_STATS`
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

- `PrimaryStat`
- `StatBlock`
- `StatAllocation`
- `RESOURCE_STATS`

## 7.4 Damage contracts

Важно: в проекте уже есть **несколько близких словарей** для урона и магии.

- `packages/rpg-domain/src/damage.ts` описывает основной runtime/content damage vocabulary;
- `packages/rpg-domain/src/skills/skill.enums.ts` содержит enum vocabulary навыков;
- `apps/backend/src/content/content.types.ts` и frontend mirror повторяют content-friendly vocabulary.

Будущий editor должен либо:

- использовать один canonical vocabulary для UI;
- либо делать явный mapping, а не неявно смешивать `dark` и `darkness`, `slash` и `slashing` и так далее.

### `C:\theend\packages\rpg-domain\src\damage.ts`

- `DamageCategory`
  - `physical`
  - `elemental`
  - `magic`
  - `shamanic`
  - `runic`
  - `bleed`
  - `poison`
  - `true`

- `PhysicalDamageType`
  - `slash`
  - `pierce`
  - `blunt`
  - `cleave`
  - `unarmed`

- `ElementType`
  - `fire`
  - `water`
  - `earth`
  - `air`
  - `light`
  - `dark`

- `MagicSchool`
  - `blood`
  - `death`
  - `life`
  - `mind`
  - `illusion`
  - `curse`
  - `arcane`

- `ShamanicDamageType`
  - `spiritual`
  - `ethereal`
  - `cursed`
  - `karmic`
- `RunicDamageType`
  - `empowered_physical`
  - `blood`
  - `spiritual`
  - `cursed`
  - `binding`
- `MagicalControlEffect`
  - `curse`
  - `silence`
  - `stun`
  - `blind`

### `C:\theend\packages\rpg-domain\src\skills\skill.enums.ts`

Отдельно важно помнить skill-level vocabulary:

- `PhysicalDamageType`
  - `slashing`
  - `piercing`
  - `blunt`

- `ElementType`
  - `fire`
  - `water`
  - `earth`
  - `air`
  - `light`
  - `darkness`

- `MagicSchoolType`
  - `elemental`
  - `normal`
  - `life`
  - `death`
  - `blood`
  - `mind`
  - `shadow`
  - `illusion`
  - `necromancy`
  - `forbidden`

## 7.5 Equipment and item contracts

### `C:\theend\packages\rpg-domain\src\items.ts`

- `ItemType`
- `HandsRequired`

### `C:\theend\packages\rpg-domain\src\equipment.ts`

- `EquipmentSlot`
- `HandSlot`
  - `weapon`
  - `shield`
- `RingSlot`
  - `ring1`
  - `ring2`
  - `ring3`

### `C:\theend\apps\backend\src\content\content.types.ts`

- `ItemType`
  - `weapon`
  - `armor`
  - `potion`
  - `material`
  - `quest`
  - `misc`
  - `profession_tool`
  - `profession_transport`

- `ItemSlot`
- `HandsRequired`
- `ItemRarity`
  - `common`
  - `uncommon`
  - `rare`
  - `epic`
  - `legendary`
  - `mythic`
  - `forbidden`

- `DamageCategory`
  - `physical`
  - `elemental`
  - `magic`
  - `shamanic`
  - `runic`
  - `poison`
  - `bleed`
  - `true`

- `PhysicalType`
  - `slash`
  - `pierce`
  - `blunt`
  - `cleave`
  - `unarmed`

- `ElementType`
  - `fire`
  - `water`
  - `earth`
  - `air`
  - `light`
  - `dark`

- `MagicSchool`
  - `blood`
  - `death`
  - `life`
  - `mind`
  - `illusion`
  - `curse`
  - `arcane`

- `ItemEffectType`
- `ItemAugmentType`
  - `rune`
  - `magic_stone`
  - `enchantment`
  - `other`

- `ItemSocketSource`
  - `base`
  - `blacksmith_added`
  - `scripted`

## 7.6 Battle contracts

### `C:\theend\packages\rpg-domain\src\arena-battle.ts`

- `ArenaBattlePhase`
  - `PLANNING`
  - `RESOLVING`

- `CombatBattleType`
- `QuestBattleResultState`
- `CombatActorLifeState`
  - `alive`
  - `downed`
  - `defeated`
  - `dead`
  - `escaped`

### `C:\theend\packages\rpg-domain\src\battle-map.ts`

- `BattleMapCellType`
  - `walkable`
  - `blocked`
  - `trap`
  - `difficult`
  - `water`
  - `lowCover`
  - `highCover`

- `BattleMapSpawnZoneType`
  - `player`
  - `enemy`
  - `neutralNpc`
  - `reinforcement`

- `BattleMapObjectType`
  - `loot`
  - `container`
  - `door`
  - `lever`
  - `resource`
  - `questObject`
  - `decoration`
  - `cover`
  - `destructible`

- `BattleMapTriggerType`
  - `quest`
  - `dialogue`
  - `ambush`
  - `trap`
  - `scene`
  - `exit`
  - `custom`

- `BattleMapNpcRole`
  - `enemy`
  - `neutral`
  - `ally`
  - `merchant`
  - `questGiver`
  - `civilian`

- `BattleMapObjectiveType`
  - `extract_bodies`
  - `survive_rounds`
  - `defeat_group`
  - `protect_npc`
  - `reach_zone`
  - `hold_zone`
  - `custom`

- `BattleScriptEventType`
  - `battle_start`
  - `round_start`
  - `objective_progress`
  - `objective_completed`
  - `important_actor_down`
  - `battle_end`

- `BattleMapZoneType`
  - `blocked`
  - `walkable`
  - `spawn_player`
  - `spawn_enemy`
  - `spawn`
  - `cover`
  - `hazard`
  - `exit_zone`

### `C:\theend\packages\rpg-domain\src\combat-plan.ts`

- `CombatQuickSlotId`
- `ActionBarEntryKind`
  - `skill`
  - `item`
  - `weapon`
  - `empty`

- `CombatCommandType`
- `CombatTarget`
- `CombatBattlePhase`
  - `planning`
  - `resolving`
  - `acting`
  - `animating`
  - `finished`

- `CombatEventType`
- `CombatRevalidationFailReason`
- `CombatResolveErrorCode`
- `CombatPlanErrorCode`
- `CombatPlanWarningCode`
- `COMBAT_COMMAND_PRIORITY`

### `C:\theend\packages\rpg-domain\src\combat-costs.ts`

- `CombatActionCostKey`
- `CombatCostErrorCode`

### `C:\theend\packages\rpg-domain\src\combat-guard.ts`

- `CombatGuardType`
  - `guard`
  - `strong_guard`

- `GuardDamageKind`
  - `physical`
  - `magical`

### `C:\theend\packages\rpg-domain\src\combat-core.ts`

- `DamageType`
  - `physical`
  - `magic`
  - `element`
  - `elemental`
  - `shamanic`
  - `runic`
  - `true`

- `CombatActionType`
  - `BASIC_ATTACK`
  - `DEFEND`
  - `SKIP_TURN`

### `C:\theend\packages\rpg-domain\src\combat-status-registry.ts`

- `CombatStatusStackMode`
  - `refresh`
  - `stack`

### `C:\theend\packages\rpg-domain\src\combat-status-runtime.ts`

- `CombatStatusApplyOutcome`
  - `applied`
  - `immune`
  - `resisted`
  - `missed_chance`
  - `skipped`

## 7.7 Profession / crafting / rune contracts

### `C:\theend\packages\rpg-domain\src\professions.ts`

- `ProfessionId`
- `BLACKSMITH_STATS_KEYS`

### `C:\theend\packages\rpg-domain\src\blacksmith-session.ts`

- `BlacksmithStage`
  - `prep`
  - `heat`
  - `strike`
  - `quench`
  - `finish`
  - `completed`

- `BlacksmithWorkMode`
  - `recipe`
  - `custom_forge`
  - `item_work`

### `C:\theend\packages\rpg-domain\src\runes.ts`

- `RuneCategory`
- `RuneCostType`
- `RuneEffectType`
- `BINDING_RUNE_IDS`

### `C:\theend\apps\backend\src\content\content.types.ts`

- `CarpenterComponentKind`
- `CarpenterRecipeGroup`
- `CarpenterStationType`
- `ProfessionWorkshopKind`
- `ProfessionWorkshopInteractionType`
- `CarpenterTemplateDifficultyType`
  - `basic`
  - `standard`
  - `advanced`
  - `master`

- `CraftingRecipeStatus`
  - `draft`
  - `active`
  - `disabled`
  - `archived`

- `CraftingRecipeType`
- `CraftingProfessionId`
- `CraftingStationType`
- `CraftingFailureMode`
- `CraftingRecipeResultMode`
  - `fixed`
  - `random_from_pool`

- `ProfessionItemKind`

## 7.8 Quest / dialogue / NPC contracts

### `C:\theend\apps\frontend\src\types\quest.ts`

- `QuestCategory`
- `QuestStatus`
  - `draft`
  - `active`
  - `disabled`
  - `archived`

- `QuestRunStatus`
  - `not_started`
  - `active`
  - `completed`
  - `failed`
  - `abandoned`

- `QuestObjectiveType`
- `QuestTriggerType`
- `QuestRewardType`
- `QuestConditionType`
- `QuestInteractionRequirementType`
- `QuestInteractionEffectType`
- `QuestInteractionTriggerType`
- `QuestInteractionEvent`
- `QuestMarkerType`
- `QuestMarkerVisibilityMode`
- `QuestZoneType`

### `C:\theend\apps\frontend\src\types\npc.ts`

- `NpcStatus`
  - `draft`
  - `active`
  - `disabled`
  - `archived`

- `NpcKind`
- `NpcRace`
- `NpcDispositionMode`
- `NpcCombatRole`

### `C:\theend\apps\frontend\src\services\dialogueRunner.ts`

- `DialogueSourceType`
  - `npc`
  - `location`
  - `location_place`
  - `quest`
  - `item`
  - `zone`
  - `system`

### `C:\theend\apps\frontend\src\services\dialogueRuntime.ts`

- `DialogueRuntimeEvent`
- `DialogueRuntimeIntent`

## 7.9 World map / city / location contracts

### `C:\theend\apps\backend\src\content\content.types.ts`

- `ZoneShape`
  - `circle`
  - `polygon`
  - `rect`

- `ZoneType`
- `MapEditorLayer`
  - `areas`
  - `locations`
  - `quests`
  - `resources`
  - `zones`

- `ZoneInteractionMode`
- `RegionType`
  - `walkable`
  - `blocked`
  - `water`
  - `swamp`
  - `sand`
  - `road`
  - `danger`
  - `trigger`

- `CityStatus`
  - `active`
  - `ruined`
  - `occupied`
  - `hidden`
  - `locked`

- `CityLocationType`
- `CityLocationShapeType`
  - `circle`
  - `rectangle`
  - `polygon`

- `CityLocationEncounterKind`
  - `arena`
  - `quest`
  - `event`
  - `dungeon`
  - `ambush`

- `LocationStatus`
  - `draft`
  - `active`
  - `disabled`
  - `archived`

- `LocationSubtype`
- `LocationAreaShapeType`
  - `rectangle`
  - `circle`
  - `polygon`
  - `none`

### `C:\theend\apps\frontend\src\worldmap\zoneTaxonomy.ts`

- `MapEditorLayer`
  - `areas`
  - `locations`
  - `quests`
  - `resources`
  - `zones`
  - `passability`

- `ZoneInteractionMode`
  - `none`
  - `inspect`
  - `enter`
  - `quest`
  - `resource`
  - `battle`
  - `random_event`
  - `danger`
  - `transition`
  - `fast_travel`
  - `rest`
  - `locked`

- `LayerVisibilityMode`
  - `hidden`
  - `dimmed`
  - `visible`

### `C:\theend\apps\frontend\src\worldmap\zoneEditorTypes.ts`

- `ZoneShape`
- `ZoneType`
- `ZoneEditorTool`
  - `select`
  - `circle`
  - `polygon`
  - `rectangle`
  - `pan`
  - `measure`

- `RegionType`
- `RegionToolMode`
  - `circle`
  - `pencil`
  - `brush`
  - `eraser`

- `RegionBrushSize`
- `LocationSpriteAnchor`
  - `center`
  - `bottom`

- `LocationStateSpriteKey`
  - `active`
  - `hidden`
  - `destroyed`
  - `restored`
  - `captured`
  - `locked`

- `ResourceKind`
- `WorldMapQuestLaunchAction`
  - `none`
  - `start_quest_battle`

- `WorldMapQuestLaunchTrigger`
  - `enter`
  - `interact`
  - `inspect`

- `WorldMapQuestLaunchRequiredStatus`
  - `active`
  - `completed`
  - `available`
  - `any`

### `C:\theend\apps\frontend\src\worldmap\types.ts`

- `ContextMode`
  - `empty`
  - `location`
  - `npc`
  - `combat`

- `ChatType`
  - `local`
  - `private`
  - `system`

- `PlayerWorldState`
  - `moving`
  - `idle`
  - `in_zone`
  - `in_city`
  - `in_combat`

- `WorldMapMode`
  - `play`
  - `editor`

- `EditorSizeMode`
  - `normal`
  - `editor`

### Renderer switching

- `C:\theend\apps\frontend\src\worldmap\worldRendererSettings.ts`
  - `WorldRendererKind = 'canvas' | 'phaser'`

- `C:\theend\apps\frontend\src\battle\battleRendererSettings.ts`
  - `BattleRendererKind = 'react' | 'phaser'`

## 7.10 Living world / simulation contracts

### `C:\theend\apps\backend\src\worldsim\types\world-simulation.types.ts`

- `WorldNpcArchetype.kind`
  - `merchant`
  - `guard`
  - `bandit`
  - `monk`
  - `wanderer`
  - `mage`
  - `quest_giver`
  - `warrior`
  - `creature`
  - `event`

- `WorldNpcArchetype.sourceType`
  - `npc`
  - `merchant`

- `WorldSpawnRule.spawnType`
  - `time_based`
  - `event_based`
  - `economy_based`

- `ActiveWorldEntity.state`
  - `traveling`
  - `resting`
  - `blocked_waiting`
  - `in_city`
  - `in_combat`
  - `dead`
  - `frozen`
  - `respawning`

- `EconomicEvent.type`
  - `merchant_arrival`
  - `merchant_departure`
  - `merchant_death`
  - `price_update`
  - `supply_shortage`

## 7.11 Frontend battle-specific contracts

### `C:\theend\apps\frontend\src\battle\battleInteractionAdapter.ts`

- `CombatStyle`
  - `MELEE`
  - `RANGED`
  - `MAGIC`

### `C:\theend\apps\frontend\src\worldmap\worldSceneTypes.ts`

- `WorldEntityRenderMode`
  - `portrait`
  - `sprite`
  - `fallback`

### `C:\theend\apps\frontend\src\worldmap\playerMovementSettings.ts`

- `MovementControlScheme`
  - `arrows`
  - `wasd`

## 7.12 Backend AI / skills auxiliary contracts

### `C:\theend\apps\backend\src\combat\ai-combat-planner.ts`

- `AiCombatIntent`
- `AiCombatPersonality`
- `AiPlanRejectReason`

### `C:\theend\apps\backend\src\skills\character-skill.types.ts`

- `CharacterSkillSourceType`
  - `teacher`
  - `academy`
  - `quest`
  - `book`
  - `ritual`
  - `admin`

- `CombatSlotType`
  - `ANY`
  - `MAGIC`
  - `PHYSICAL`
  - `PASSIVE`
  - `RUNE`
  - `SHAMANIC`

---

## 8. Что редактору можно считать стабильным уже сейчас

С высокой вероятностью можно считать стабильной основой:

1. shared gameplay taxonomy из `packages/rpg-domain`;
2. content-types контракты из `content.types.ts` и `frontend/services/content/models.ts`;
3. quest/dialogue/NPC/world-map ids;
4. kingdom/race/stats/skill/damage schemas;
5. battle map и world map entity model;
6. profession and crafting ids;
7. renderer switch idea:
   - world map может быть `canvas` или `phaser`;
   - battle может быть `react` или `phaser`.

Это очень полезно для миграции в action-RPG, потому что уже сейчас видно:

- геймплейный слой не жёстко завязан на один renderer;
- часть Phaser-направления уже есть;
- можно двигаться в сторону action execution, не выбрасывая content систему.

---

## 9. Что пока выглядит частичным или чувствительным

Это не "сломано по определению", но это зоны, где будущему editor надо быть аккуратным:

1. Часть логики живёт в frontend runtime, а не полностью в backend/shared domain.
   - Особенно quest/dialogue/world-map runtime.

2. Есть дублирование content models между backend и frontend.
   - Это удобно для UI, но опасно при эволюции схемы.

3. Пошаговый бой и будущий realtime бой неизбежно будут по-разному исполняться.
   - Значит нельзя смешивать renderer-параметры и core battle meaning.

4. Для NPC/AI уже есть role/personality/loadout-поля, но realtime AI потребует более богатых behavior profiles.
   - Лучше расширять существующие `aiProfileId`/`aiPersonality`, а не придумывать изолированную action-only сущность.

5. Спрайтовая система пока не выглядит единым canonical editor contract.
   - Значит новый sprite editor лучше сразу проектировать как типизированный manifest-слой.

---

## 10. Какой минимальный контракт нужен будущему sprite/action editor

Ниже безопасный стартовый набор сущностей, который можно добавить в админку, не ломая старую игру.

## 10.1 Sprite Actor Definition

Должен ссылаться на существующие игровые сущности:

- `npcId?`
- `race?`
- `itemType?`
- `weaponClass?`
- `combatRole?`
- `professionId?`

И хранить только presentation/runtime для action слоя:

- `spriteSheetId`
- `portraitId`
- `animationSetId`
- `locomotionProfileId`
- `hitboxProfileId`
- `hurtboxProfileId`
- `anchorProfileId`
- `audioProfileId`
- `fxProfileId`

## 10.2 Animation Set

Минимально:

- `idle`
- `run`
- `walk`
- `attack_light`
- `attack_heavy`
- `cast_start`
- `cast_loop`
- `cast_release`
- `block`
- `hit_react`
- `downed`
- `death`
- `interact`
- `gather`
- `mine`
- `craft`

## 10.3 Skill Presentation Binding

Связь:

- `skillId`
- `animationState`
- `castPointMs`
- `hitFrame`
- `projectileSpawnAnchor`
- `projectileFxId`
- `impactFxId`
- `soundSetId`
- `cancelWindowMs`
- `recoveryMs`

## 10.4 Weapon Presentation Binding

Связь:

- `itemId` или `weapon family`
- `stance`
- `gripOffset`
- `swingArc`
- `trailFxId`
- `projectilePrefabId`
- `reloadLikeBehavior?`

## 10.5 Realtime AI Profile

Лучше расширять текущий AI-контракт так:

- `aiProfileId`
- `combatRole`
- `preferredDistance`
- `aggression`
- `kiteBehavior`
- `focusRule`
- `retreatThreshold`
- `skillPriorityProfile`
- `targetSelectionProfile`
- `pathAvoidanceProfile`

И затем маппить его на:

- текущую пошаговую AI логику;
- будущую realtime action AI логику.

---

## 11. Практический вывод

Переход к action-RPG у `THEEND` лучше строить не как "новую игру поверх старой", а как замену способа исполнения боя и движения при сохранении существующих сущностей.

Самое ценное, что уже есть:

- доменные правила;
- систематизированные enums;
- контентные типы;
- квесты/диалоги/NPC/world map;
- battle maps и objectives;
- professions;
- world simulation;
- частичный Phaser путь.

### Самый правильный next step для будущей интеграции редактора

1. Не трогать текущие content ids и gameplay enums.
2. Ввести новый editor-contract слой только для:
   - спрайтов;
   - анимаций;
   - action bindings;
   - realtime AI presets;
   - hitboxes / anchors / audio / VFX bindings.
3. Делать editor так, чтобы он ссылался на текущие:
   - `skillId`
   - `itemId`
   - `npcId`
   - `questId`
   - `battleMapId`
   - `zoneId`
4. Оставить `packages/rpg-domain` главным gameplay reference слоем.

---

## 12. Короткий архитектурный тезис для ТЗ

Если формулировать для будущей задачи одной мыслью:

> Новый sprite/action editor должен быть надстройкой над существующей gameplay taxonomy THEEND, читать shared domain и content contracts, не дублировать enums, и редактировать presentation/runtime bindings для realtime execution без ломки текущей пошаговой игры.
