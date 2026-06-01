# CRAFTING / PROCESSING / RECIPES

## 1. Цель системы

Сделать общий контентный слой рецептов и производственных операций для профессий:

- mining
- blacksmithing
- carpentry
- leatherworking
- jewelcrafting
- runecrafting
- fishing
- cooking
- hunting
- alchemy
- herbalism

Этот слой отвечает не за runtime крафта, а за:

- модель данных
- import/export
- нормализацию
- integrity checks
- admin UI

## 2. Почему рецепты отдельны от кузнеца

Рецепт не должен жить внутри одного runtime-модуля кузнеца, потому что он нужен сразу многим профессиям и видам переработки:

- material processing
- crafting
- service recipes для предметов

Разделение ролей:

- `Material` отвечает на вопрос: "что это такое?"
- `CraftingRecipe` отвечает на вопрос: "как это получить / переработать / создать?"
- `Profession` отвечает на вопрос: "кто умеет это делать?"
- `Station` отвечает на вопрос: "где это делается?"

## 3. Разница Material / Item / Recipe / Profession / Station

- `Material`: сырьё, полуфабрикат, ресурс, порошок, слиток, кожа, дерево, зерно, соль, масло, рудный и рунический камень.
- `Item`: готовый предмет, экипировка, зелье, готовая руна, амулет, законченный артефакт.
- `CraftingRecipe`: описание входов, выходов, требований и станции.
- `Profession`: логическая специализация персонажа.
- `Station`: точка выполнения рецепта.

Отдельно фиксируется:

- материал может продаваться торговцем, если у торговца включена торговля материалами;
- не нужно хранить "состав материала" внутри самого `Material`;
- состав и преобразование живут в `CraftingRecipe`.

## 4. Enum-ы

### Status

- `draft`
- `active`
- `disabled`
- `archived`

### RecipeType

- `material_processing`
- `smelting`
- `grinding`
- `cutting`
- `tanning`
- `weaving`
- `cooking`
- `baking`
- `alchemy`
- `jewelcrafting`
- `blacksmith_craft`
- `carpentry_craft`
- `leatherworking_craft`
- `runecrafting`
- `rune_identification`
- `enchantment`
- `add_socket`
- `temporary_item_buff`
- `permanent_item_upgrade`
- `dismantling`

### ProfessionId

- `mining`
- `blacksmithing`
- `carpentry`
- `leatherworking`
- `jewelcrafting`
- `runecrafting`
- `fishing`
- `cooking`
- `hunting`
- `alchemy`
- `herbalism`

### StationType

- `none`
- `forge`
- `furnace`
- `anvil`
- `workbench`
- `sawmill`
- `tanning_rack`
- `cooking_fire`
- `oven`
- `cauldron`
- `alchemy_table`
- `jewelcrafting_table`
- `rune_table`
- `enchanting_table`
- `drying_rack`
- `fishing_spot`
- `hunting_camp`
- `millstone`

### FailureMode

- `none`
- `lose_inputs`
- `lose_partial_inputs`
- `damaged_item`
- `cursed_result`
- `random_lower_quality`

## 5. Модель данных

Ключевая сущность: `CraftingRecipe`.

Минимальный контракт:

```ts
interface CraftingRecipe {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'disabled' | 'archived';
  recipeType: string;
  professionId: string;
  stationType: string;
  requiredProfessionLevel?: number;
  requiredSkillIds?: string[];
  requiredBlueprintItemId?: string;
  requiredQuestId?: string;
  inputMaterials: Array<{ materialId: string; quantity: number }>;
  inputItems: Array<{ itemId: string; quantity: number; consume?: boolean }>;
  outputMaterials: Array<{ materialId: string; quantity: number }>;
  outputItems: Array<{ itemId: string; quantity: number }>;
  resultMode?: 'fixed' | 'random_from_pool';
  resultPoolId?: string;
  goldCost?: number;
  staminaCost?: number;
  timeSeconds?: number;
  successChance?: number;
  failureMode?: string;
  isRepeatable?: boolean;
  isEnabled?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
```

Поддерживаются три класса рецептов:

1. Processing
`material -> material`

2. Crafting
`materials -> item`

3. Item service recipes
`item + materials -> modified item / service effect`

Сейчас service recipes описываются только как контент-модель, без runtime.

## 6. Правила import/export

- новая коллекция хранится как `craftingRecipes`;
- должна попадать в полный backup/import/export без ломки старых JSON;
- импорт обязан переживать legacy backup, где коллекции может не быть;
- запись проходит через нормализацию:
  - trim строк
  - clamp чисел
  - фильтрация пустых id
  - safe defaults для status/station/failure mode/result mode

## 7. Integrity checks

Проверяются:

- duplicate recipe ids
- наличие хотя бы одного input
- fixed recipe без output помечается warning
- `random_from_pool` без `resultPoolId` считается ошибкой
- ссылки на `Materials`
- ссылки на `Items`
- ссылки на `Skills`
- ссылки на `Quest`
- неизвестная `professionId` даёт warning

Система не должна ломать:

- items
- materials
- traders
- mining
- professions
- старые JSON backup/import/export
- legacy item effects

## 8. Admin UI

В admin content добавляется раздел:

- Предметы
- Материалы
- Таблицы добычи
- Рецепты / Производство

Страница рецептов должна поддерживать:

- список
- фильтр по профессии
- фильтр по типу
- фильтр по станции
- фильтр по статусу
- создание
- редактирование
- удаление
- import/export
- raw JSON editor

В форме должны быть селекторы/ссылки на:

- `Materials`
- `Items`
- `Skills`
- существующие professions

## 9. Smoke-test рецепты

После готовности структуры допустимы первые smoke entries:

1. `recipe_smelting_iron_ingot`
2. `recipe_cut_oak_plank`
3. `recipe_tanned_leather`
4. `recipe_rye_flour`
5. `recipe_identify_minor_rune_stone`

Важно:

- seed самих материалов и предметов не форсируется на этом шаге;
- сначала структура и admin UI;
- потом безопасное наполнение smoke recipes.

## 10. Что НЕ делать сейчас

- не делать runtime кузнеца;
- не делать runtime сокетов;
- не продолжать `UNIVERSAL_ITEM_SYSTEM_TZ_RU`;
- не связывать задачу с augments / activationContexts / socket-операциями;
- не переносить recipe execution в battle/inventory flow;
- не ломать старый контентный слой и legacy item effects.
