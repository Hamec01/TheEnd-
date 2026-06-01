import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type {
  AdminItem,
  AdminSkill,
  CraftingFailureMode,
  CraftingItemStack,
  CraftingMaterialStack,
  CraftingProfessionId,
  CraftingRecipe,
  CraftingRecipeResultMode,
  CraftingRecipeStatus,
  CraftingRecipeType,
  CraftingStationType,
  Material,
} from '../../services/content/models';
import { craftingRecipesService, normalizeCraftingRecipe, validateCraftingRecipe } from '../../services/content/craftingRecipesService';
import { downloadCollectionJson, extractRawCollectionFromImportJson, importCollectionFromJsonEntries } from '../../services/content/adminJsonImportExport';
import { getContentCollection } from '../../services/content/contentApi';
import { uid } from '../../services/content/storage';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';

const RECIPE_STATUSES: CraftingRecipeStatus[] = ['draft', 'active', 'disabled', 'archived'];
const RECIPE_TYPES: CraftingRecipeType[] = [
  'material_processing',
  'smelting',
  'grinding',
  'cutting',
  'tanning',
  'weaving',
  'cooking',
  'baking',
  'alchemy',
  'jewelcrafting',
  'blacksmith_craft',
  'carpentry_craft',
  'leatherworking_craft',
  'runecrafting',
  'rune_identification',
  'enchantment',
  'add_socket',
  'temporary_item_buff',
  'permanent_item_upgrade',
  'dismantling',
];
const PROFESSION_OPTIONS: Array<{ id: CraftingProfessionId; label: string }> = [
  { id: 'mining', label: 'Горняк' },
  { id: 'blacksmithing', label: 'Кузнец' },
  { id: 'carpentry', label: 'Плотник' },
  { id: 'leatherworking', label: 'Кожевник' },
  { id: 'jewelcrafting', label: 'Ювелир' },
  { id: 'runecrafting', label: 'Рунорез' },
  { id: 'fishing', label: 'Рыбак' },
  { id: 'cooking', label: 'Повар' },
  { id: 'hunting', label: 'Охотник' },
  { id: 'alchemy', label: 'Алхимик' },
  { id: 'herbalism', label: 'Травник' },
];
const STATION_OPTIONS: CraftingStationType[] = [
  'none',
  'forge',
  'furnace',
  'anvil',
  'workbench',
  'sawmill',
  'tanning_rack',
  'cooking_fire',
  'oven',
  'cauldron',
  'alchemy_table',
  'jewelcrafting_table',
  'rune_table',
  'enchanting_table',
  'drying_rack',
  'fishing_spot',
  'hunting_camp',
  'millstone',
];
const FAILURE_MODES: CraftingFailureMode[] = [
  'none',
  'lose_inputs',
  'lose_partial_inputs',
  'damaged_item',
  'cursed_result',
  'random_lower_quality',
];
const RESULT_MODES: CraftingRecipeResultMode[] = ['fixed', 'random_from_pool'];

function emptyRecipe(): CraftingRecipe {
  const now = new Date().toISOString();
  return {
    id: '',
    name: '',
    description: '',
    status: 'draft',
    recipeType: 'material_processing',
    professionId: 'blacksmithing',
    stationType: 'none',
    requiredProfessionLevel: 1,
    requiredSkillIds: [],
    requiredBlueprintItemId: '',
    requiredQuestId: '',
    inputMaterials: [],
    inputItems: [],
    outputMaterials: [],
    outputItems: [],
    resultMode: 'fixed',
    resultPoolId: '',
    goldCost: 0,
    staminaCost: 0,
    timeSeconds: 0,
    successChance: 100,
    failureMode: 'none',
    isRepeatable: true,
    isEnabled: true,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

function toPrettyJson(value: unknown, fallback: string): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  return JSON.stringify(value, null, 2);
}

function updateStack<T>(list: T[], index: number, patch: Partial<T>): T[] {
  return list.map((entry, currentIndex) => (currentIndex === index ? { ...entry, ...patch } : entry));
}

export function CraftingRecipesPage() {
  const [recipes, setRecipes] = useState<CraftingRecipe[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [skills, setSkills] = useState<AdminSkill[]>([]);
  const [query, setQuery] = useState('');
  const [professionFilter, setProfessionFilter] = useState<'all' | string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | CraftingRecipeType>('all');
  const [stationFilter, setStationFilter] = useState<'all' | CraftingStationType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | CraftingRecipeStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CraftingRecipe>(emptyRecipe());
  const [status, setStatus] = useState('Готово');
  const [rawJson, setRawJson] = useState(toPrettyJson(emptyRecipe(), '{}'));
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  function syncJson(next: CraftingRecipe) {
    setRawJson(toPrettyJson(next, '{}'));
  }

  async function refresh() {
    const [allRecipes, allMaterials, allItems, allSkills] = await Promise.all([
      craftingRecipesService.getAll(),
      getContentCollection<Material>('materials').catch(() => []),
      getContentCollection<AdminItem>('items').catch(() => []),
      getContentCollection<AdminSkill>('skills').catch(() => []),
    ]);
    setRecipes(allRecipes);
    setMaterials(allMaterials);
    setItems(allItems);
    setSkills(allSkills);
    if (selectedId && !allRecipes.some((entry) => entry.id === selectedId)) {
      const next = emptyRecipe();
      setSelectedId(null);
      setDraft(next);
      syncJson(next);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visibleRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((entry) => {
      if (professionFilter !== 'all' && entry.professionId !== professionFilter) return false;
      if (typeFilter !== 'all' && entry.recipeType !== typeFilter) return false;
      if (stationFilter !== 'all' && entry.stationType !== stationFilter) return false;
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!q) return true;
      return entry.id.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q) || String(entry.description ?? '').toLowerCase().includes(q);
    });
  }, [professionFilter, query, recipes, stationFilter, statusFilter, typeFilter]);

  const materialOptions = useMemo(() => [...materials].sort((a, b) => a.name.localeCompare(b.name, 'ru')), [materials]);
  const itemOptions = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name, 'ru')), [items]);
  const skillOptions = useMemo(() => [...skills].sort((a, b) => a.name.localeCompare(b.name, 'ru')), [skills]);

  function patchDraft(patch: Partial<CraftingRecipe>) {
    setDraft((current) => {
      const next = normalizeCraftingRecipe({
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      });
      syncJson(next);
      return next;
    });
  }

  function selectRecipe(entry: CraftingRecipe) {
    setSelectedId(entry.id);
    setDraft(entry);
    syncJson(entry);
  }

  async function createOrUpdate(nextDraft: CraftingRecipe = draft) {
    const normalized = normalizeCraftingRecipe({
      ...nextDraft,
      id: nextDraft.id.trim() || uid('recipe'),
      updatedAt: new Date().toISOString(),
    });
    const errors = validateCraftingRecipe(normalized);
    if (errors.length > 0) {
      setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
      return;
    }

    try {
      if (selectedId) {
        const updated = await craftingRecipesService.update(selectedId, normalized);
        setSelectedId(updated.id);
        setDraft(updated);
        syncJson(updated);
        setStatus(`Рецепт обновлён: ${updated.id}`);
      } else {
        const created = await craftingRecipesService.create(normalized);
        setSelectedId(created.id);
        setDraft(created);
        syncJson(created);
        setStatus(`Рецепт создан: ${created.id}`);
      }
      await refresh();
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  function resetDraft() {
    const next = emptyRecipe();
    setSelectedId(null);
    setDraft(next);
    syncJson(next);
    setStatus('Новый рецепт');
  }

  async function deleteSelected() {
    if (!selectedId) return;
    if (!window.confirm(`Удалить рецепт "${selectedId}"?`)) return;
    await craftingRecipesService.delete(selectedId);
    resetDraft();
    await refresh();
    setStatus(`Рецепт удалён: ${selectedId}`);
  }

  async function disableSelected() {
    if (!selectedId) return;
    const updated = await craftingRecipesService.disable(selectedId);
    setDraft(updated);
    syncJson(updated);
    await refresh();
    setStatus(`Рецепт отключён: ${selectedId}`);
  }

  async function duplicateSelected() {
    const copy = normalizeCraftingRecipe({
      ...draft,
      id: `${draft.id || 'recipe'}_copy_${Math.floor(Math.random() * 10000)}`,
      name: `${draft.name || 'Recipe'} Копия`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await craftingRecipesService.create(copy);
    await refresh();
    setStatus(`Копия рецепта создана: ${copy.id}`);
  }

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_crafting_recipes',
      collectionKey: 'craftingRecipes',
      entries: recipes,
    });
    setStatus(`Экспорт: craftingRecipes (${recipes.length})`);
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isImporting) return;

    setIsImporting(true);
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const entries = extractRawCollectionFromImportJson(payload, 'craftingRecipes');
      const result = await importCollectionFromJsonEntries<CraftingRecipe>({
        entries,
        defaults: emptyRecipe,
        normalize: normalizeCraftingRecipe,
        validate: validateCraftingRecipe,
        getAll: () => craftingRecipesService.getAll(),
        create: (value) => craftingRecipesService.create(value),
        update: (id, value) => craftingRecipesService.update(id, value),
      });
      await refresh();
      setStatus(`Импорт рецептов: создано ${result.created.length}, пропущено ${result.skippedExisting.length}, обновлено ${result.updated.length}, ошибок ${result.errors.length}`);
    } catch (error) {
      setStatus(`Импорт: ${translateAdminErrorMessage((error as Error).message)}`);
    } finally {
      setIsImporting(false);
    }
  }

  function applyRawJson() {
    try {
      const parsed = JSON.parse(rawJson) as CraftingRecipe;
      const normalized = normalizeCraftingRecipe({
        ...emptyRecipe(),
        ...parsed,
        id: parsed?.id ?? draft.id,
      });
      setDraft(normalized);
      syncJson(normalized);
      setStatus('JSON применён в форму');
    } catch (error) {
      setStatus(`JSON: ${translateAdminErrorMessage((error as Error).message)}`);
    }
  }

  function addMaterialRow(key: 'inputMaterials' | 'outputMaterials') {
    const nextRow: CraftingMaterialStack = { materialId: materialOptions[0]?.id ?? '', quantity: 1 };
    patchDraft({ [key]: [...draft[key], nextRow] } as Partial<CraftingRecipe>);
  }

  function addItemRow(key: 'inputItems' | 'outputItems') {
    const nextRow: CraftingItemStack = { itemId: itemOptions[0]?.id ?? '', quantity: 1, consume: key === 'inputItems' ? true : undefined };
    patchDraft({ [key]: [...draft[key], nextRow] } as Partial<CraftingRecipe>);
  }

  const selectedProfessionLabel = PROFESSION_OPTIONS.find((entry) => entry.id === draft.professionId)?.label ?? draft.professionId;

  return (
    <div className="crafting-page">
      <div className="toolbar">
        <input placeholder="Поиск по id / имени / описанию" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={professionFilter} onChange={(event) => setProfessionFilter(event.target.value)}>
          <option value="all">Все профессии</option>
          {PROFESSION_OPTIONS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | CraftingRecipeType)}>
          <option value="all">Все типы</option>
          {RECIPE_TYPES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select value={stationFilter} onChange={(event) => setStationFilter(event.target.value as 'all' | CraftingStationType)}>
          <option value="all">Все станции</option>
          {STATION_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | CraftingRecipeStatus)}>
          <option value="all">Все статусы</option>
          {RECIPE_STATUSES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <button onClick={resetDraft}>Новый</button>
        <button onClick={() => void createOrUpdate()}>Сохранить</button>
        <button onClick={() => void duplicateSelected()} disabled={!selectedId}>Дублировать</button>
        <button onClick={() => void disableSelected()} disabled={!selectedId}>Отключить</button>
        <button onClick={() => void deleteSelected()} disabled={!selectedId}>Удалить</button>
        <button onClick={exportJson}>Экспорт</button>
        <button onClick={() => importFileRef.current?.click()} disabled={isImporting}>Импорт</button>
        <input ref={importFileRef} type="file" accept=".json,application/json" hidden onChange={handleImportFile} />
      </div>

      <div className="layout">
        <aside className="card recipe-list">
          <h3>Рецепты</h3>
          <p className="muted">{visibleRecipes.length} из {recipes.length}</p>
          <div className="recipe-list-scroll">
            {visibleRecipes.map((entry) => (
              <button
                key={entry.id}
                className={`recipe-list-item ${selectedId === entry.id ? 'is-active' : ''}`}
                onClick={() => selectRecipe(entry)}
              >
                <strong>{entry.name || entry.id}</strong>
              </button>
            ))}
          </div>
        </aside>

        <section className="card recipe-form">
          <div className="grid">
            <label>
              <AdminFieldLabel label="ID" hint="Стабильный id рецепта для backup/import/export и будущего runtime." />
              <input value={draft.id} onChange={(event) => patchDraft({ id: event.target.value })} />
            </label>
            <label>
              <AdminFieldLabel label="Название" hint="Человекочитаемое имя рецепта." />
              <input value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} />
            </label>
            <label>
              <AdminFieldLabel label="Статус" hint="Контентный статус: draft / active / disabled / archived." />
              <select value={draft.status} onChange={(event) => patchDraft({ status: event.target.value as CraftingRecipeStatus })}>
                {RECIPE_STATUSES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              <AdminFieldLabel label="Тип рецепта" hint="Общая категория processing/crafting/service recipe." />
              <select value={draft.recipeType} onChange={(event) => patchDraft({ recipeType: event.target.value as CraftingRecipeType })}>
                {RECIPE_TYPES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              <AdminFieldLabel label="Профессия" hint="Используется существующий список professions без нового runtime слоя." />
              <select value={draft.professionId} onChange={(event) => patchDraft({ professionId: event.target.value })}>
                {PROFESSION_OPTIONS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
              </select>
            </label>
            <label>
              <AdminFieldLabel label="Станция" hint="Где рецепт выполняется: furnace, forge, workbench и т.д." />
              <select value={draft.stationType} onChange={(event) => patchDraft({ stationType: event.target.value as CraftingStationType })}>
                {STATION_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label className="span-2">
              <AdminFieldLabel label="Описание" hint="Краткая заметка для контент-редактора." />
              <textarea rows={3} value={draft.description ?? ''} onChange={(event) => patchDraft({ description: event.target.value })} />
            </label>
          </div>

          <h3>Требования</h3>
          <div className="grid">
            <label>
              <AdminFieldLabel label="Уровень профессии" hint={`Для ${selectedProfessionLabel}.`} />
              <input type="number" min={0} value={draft.requiredProfessionLevel ?? 0} onChange={(event) => patchDraft({ requiredProfessionLevel: Number(event.target.value) })} />
            </label>
            <label>
              <AdminFieldLabel label="Blueprint item" hint="Ссылка на item, если рецепт требует чертёж." />
              <input list="crafting-item-list" value={draft.requiredBlueprintItemId ?? ''} onChange={(event) => patchDraft({ requiredBlueprintItemId: event.target.value })} />
            </label>
            <label>
              <AdminFieldLabel label="Quest id" hint="Необязательная привязка к существующему quest." />
              <input value={draft.requiredQuestId ?? ''} onChange={(event) => patchDraft({ requiredQuestId: event.target.value })} />
            </label>
            <label>
              <AdminFieldLabel label="Required skills" hint="Навыки из Skills. Можно вводить через запятую." />
              <input
                list="crafting-skill-list"
                value={(draft.requiredSkillIds ?? []).join(', ')}
                onChange={(event) => patchDraft({ requiredSkillIds: event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean) })}
              />
            </label>
            <label>
              <AdminFieldLabel label="Gold cost" hint="Контентная стоимость в золоте." />
              <input type="number" min={0} value={draft.goldCost ?? 0} onChange={(event) => patchDraft({ goldCost: Number(event.target.value) })} />
            </label>
            <label>
              <AdminFieldLabel label="Stamina cost" hint="Контентная стоимость в stamina." />
              <input type="number" min={0} value={draft.staminaCost ?? 0} onChange={(event) => patchDraft({ staminaCost: Number(event.target.value) })} />
            </label>
            <label>
              <AdminFieldLabel label="Time seconds" hint="Будущий runtime сможет использовать это поле." />
              <input type="number" min={0} value={draft.timeSeconds ?? 0} onChange={(event) => patchDraft({ timeSeconds: Number(event.target.value) })} />
            </label>
            <label>
              <AdminFieldLabel label="Success chance" hint="0..100." />
              <input type="number" min={0} max={100} value={draft.successChance ?? 100} onChange={(event) => patchDraft({ successChance: Number(event.target.value) })} />
            </label>
            <label>
              <AdminFieldLabel label="Failure mode" hint="Только модель данных, без runtime." />
              <select value={draft.failureMode ?? 'none'} onChange={(event) => patchDraft({ failureMode: event.target.value as CraftingFailureMode })}>
                {FAILURE_MODES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              <AdminFieldLabel label="Result mode" hint="Поддержка будущего random_from_pool без реализации runtime." />
              <select value={draft.resultMode ?? 'fixed'} onChange={(event) => patchDraft({ resultMode: event.target.value as CraftingRecipeResultMode })}>
                {RESULT_MODES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              <AdminFieldLabel label="Result pool id" hint="Для будущих random recipes." />
              <input value={draft.resultPoolId ?? ''} onChange={(event) => patchDraft({ resultPoolId: event.target.value })} />
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={draft.isRepeatable !== false} onChange={(event) => patchDraft({ isRepeatable: event.target.checked })} />
              <span>Repeatable</span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={draft.isEnabled !== false} onChange={(event) => patchDraft({ isEnabled: event.target.checked })} />
              <span>Enabled</span>
            </label>
          </div>

          <h3>Вход</h3>
          <div className="io-block">
            <div className="io-head">
              <strong>inputMaterials</strong>
              <button onClick={() => addMaterialRow('inputMaterials')}>Добавить material</button>
            </div>
            {draft.inputMaterials.map((entry, index) => (
              <div key={`in-mat-${index}`} className="io-row">
                <select value={entry.materialId} onChange={(event) => patchDraft({ inputMaterials: updateStack(draft.inputMaterials, index, { materialId: event.target.value }) })}>
                  <option value="">material</option>
                  {materialOptions.map((material) => <option key={material.id} value={material.id}>{material.name} ({material.id})</option>)}
                </select>
                <input type="number" min={1} value={entry.quantity} onChange={(event) => patchDraft({ inputMaterials: updateStack(draft.inputMaterials, index, { quantity: Number(event.target.value) }) })} />
                <button onClick={() => patchDraft({ inputMaterials: draft.inputMaterials.filter((_, currentIndex) => currentIndex !== index) })}>Удалить</button>
              </div>
            ))}

            <div className="io-head">
              <strong>inputItems</strong>
              <button onClick={() => addItemRow('inputItems')}>Добавить item</button>
            </div>
            {draft.inputItems.map((entry, index) => (
              <div key={`in-item-${index}`} className="io-row io-row-wide">
                <select value={entry.itemId} onChange={(event) => patchDraft({ inputItems: updateStack(draft.inputItems, index, { itemId: event.target.value }) })}>
                  <option value="">item</option>
                  {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
                </select>
                <input type="number" min={1} value={entry.quantity} onChange={(event) => patchDraft({ inputItems: updateStack(draft.inputItems, index, { quantity: Number(event.target.value) }) })} />
                <label className="checkbox compact">
                  <input
                    type="checkbox"
                    checked={entry.consume !== false}
                    onChange={(event) => patchDraft({ inputItems: updateStack(draft.inputItems, index, { consume: event.target.checked }) })}
                  />
                  <span>consume</span>
                </label>
                <button onClick={() => patchDraft({ inputItems: draft.inputItems.filter((_, currentIndex) => currentIndex !== index) })}>Удалить</button>
              </div>
            ))}
          </div>

          <h3>Выход</h3>
          <div className="io-block">
            <div className="io-head">
              <strong>outputMaterials</strong>
              <button onClick={() => addMaterialRow('outputMaterials')}>Добавить material</button>
            </div>
            {draft.outputMaterials.map((entry, index) => (
              <div key={`out-mat-${index}`} className="io-row">
                <select value={entry.materialId} onChange={(event) => patchDraft({ outputMaterials: updateStack(draft.outputMaterials, index, { materialId: event.target.value }) })}>
                  <option value="">material</option>
                  {materialOptions.map((material) => <option key={material.id} value={material.id}>{material.name} ({material.id})</option>)}
                </select>
                <input type="number" min={1} value={entry.quantity} onChange={(event) => patchDraft({ outputMaterials: updateStack(draft.outputMaterials, index, { quantity: Number(event.target.value) }) })} />
                <button onClick={() => patchDraft({ outputMaterials: draft.outputMaterials.filter((_, currentIndex) => currentIndex !== index) })}>Удалить</button>
              </div>
            ))}

            <div className="io-head">
              <strong>outputItems</strong>
              <button onClick={() => addItemRow('outputItems')}>Добавить item</button>
            </div>
            {draft.outputItems.map((entry, index) => (
              <div key={`out-item-${index}`} className="io-row">
                <select value={entry.itemId} onChange={(event) => patchDraft({ outputItems: updateStack(draft.outputItems, index, { itemId: event.target.value }) })}>
                  <option value="">item</option>
                  {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
                </select>
                <input type="number" min={1} value={entry.quantity} onChange={(event) => patchDraft({ outputItems: updateStack(draft.outputItems, index, { quantity: Number(event.target.value) }) })} />
                <button onClick={() => patchDraft({ outputItems: draft.outputItems.filter((_, currentIndex) => currentIndex !== index) })}>Удалить</button>
              </div>
            ))}
          </div>

          <h3>Служебное</h3>
          <div className="grid">
            <label className="span-2">
              <AdminFieldLabel label="Tags" hint="Через запятую. Для контентной классификации и фильтров." />
              <input value={(draft.tags ?? []).join(', ')} onChange={(event) => patchDraft({ tags: event.target.value.split(',').map((entry) => entry.trim()).filter(Boolean) })} />
            </label>
            <label className="span-2">
              <AdminFieldLabel label="JSON preview / raw editor" hint="Можно править руками и затем применить в форму." />
              <textarea rows={16} value={rawJson} onChange={(event) => setRawJson(event.target.value)} />
            </label>
          </div>
          <div className="toolbar toolbar-inline">
            <button onClick={applyRawJson}>Применить JSON</button>
            <button onClick={() => void createOrUpdate()}>Сохранить из формы</button>
          </div>

          <datalist id="crafting-item-list">
            {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </datalist>
          <datalist id="crafting-skill-list">
            {skillOptions.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
          </datalist>

          <p className="muted">{status}</p>
        </section>
      </div>

      <style>{`
        .crafting-page {
          display: grid;
          gap: 16px;
        }
        .toolbar {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .toolbar-inline {
          margin-top: 8px;
        }
        .layout {
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr);
          gap: 16px;
        }
        .recipe-list {
          display: grid;
          gap: 8px;
          align-self: start;
        }
        .recipe-list-scroll {
          display: grid;
          gap: 8px;
          max-height: 75vh;
          overflow: auto;
        }
        .recipe-list-item {
          display: grid;
          gap: 2px;
          text-align: left;
          font-size: 0.82rem;
          line-height: 1.15;
          overflow: hidden;
          word-break: break-word;
          overflow-wrap: anywhere;
          white-space: normal;
          padding: 8px 10px;
        }
        .recipe-list-item strong {
          display: block;
          font-size: 0.82rem;
          line-height: 1.15;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .recipe-list-item.is-active {
          outline: 2px solid rgba(255, 255, 255, 0.35);
        }
        .recipe-form {
          display: grid;
          gap: 16px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .span-2 {
          grid-column: 1 / -1;
        }
        .grid label,
        .checkbox {
          display: grid;
          gap: 6px;
        }
        .checkbox {
          grid-auto-flow: column;
          justify-content: start;
          align-items: center;
        }
        .checkbox.compact {
          gap: 4px;
        }
        .io-block {
          display: grid;
          gap: 10px;
        }
        .io-head {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
        }
        .io-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 120px 110px;
          gap: 8px;
        }
        .io-row-wide {
          grid-template-columns: minmax(0, 1fr) 120px 120px 110px;
        }
        @media (max-width: 1100px) {
          .layout {
            grid-template-columns: 1fr;
          }
          .grid {
            grid-template-columns: 1fr;
          }
          .span-2 {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  );
}
