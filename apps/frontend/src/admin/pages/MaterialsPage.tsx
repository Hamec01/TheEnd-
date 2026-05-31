import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { Material } from '../../services/content/models';
import { itemsService } from '../../services/content/itemsService';
import { downloadCollectionJson } from '../../services/content/adminJsonImportExport';
import { extractRawMaterialsFromImportJson, importMaterialsFromJsonEntries, materialsService, validateMaterial } from '../../services/content/materialsService';
import { loadRuntimeImages, resolveStoredImageSource } from '../../services/content/runtimeImageService';
import { normalizeGameImageRef, toLegacyImagePath, validateGameImageRef } from '../../services/content/gameImageRefs';
import { uid } from '../../services/content/storage';
import { GameImageView } from '../components/GameImageView';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import {
  AdminFieldLabel,
  translateAdminErrorMessage,
  translateEnabledState,
  translateMaterialCategory,
  translateRarity,
} from '../adminUi';

const MATERIAL_CATEGORIES: Material['category'][] = ['metal', 'wood', 'leather', 'cloth', 'herb', 'stone', 'crystal', 'bone', 'other'];
const MATERIAL_RARITIES: Material['rarity'][] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'forbidden'];

function emptyMaterial(): Material {
  const now = new Date().toISOString();
  return {
    id: '',
    name: '',
    category: 'other',
    region: '',
    rarity: 'common',
    averageMarketPrice: 0,
    properties: [],
    gameplayDescription: '',
    loreDescription: '',
    imagePath: '',
    imageRef: undefined,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [images, setImages] = useState<Awaited<ReturnType<typeof loadRuntimeImages>>>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Material>(emptyMaterial());
  const [status, setStatus] = useState('Готово');
  const [isImporting, setIsImporting] = useState(false);
  const [catalogGroupMode, setCatalogGroupMode] = useState<'category' | 'rarity' | 'none'>('category');
  const [catalogSortMode, setCatalogSortMode] = useState<'name' | 'id' | 'category' | 'rarity'>('name');
  const [catalogFilterMode, setCatalogFilterMode] = useState<'none' | 'category' | 'rarity'>('none');
  const [catalogFilterValue, setCatalogFilterValue] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const importFileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const all = await materialsService.getAll();
    setMaterials(all);
    if (selectedId && !all.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
      setDraft(emptyMaterial());
    }
  }

  useEffect(() => {
    void refresh();
    void loadRuntimeImages().then(setImages).catch(() => setImages([]));
  }, []);

  useEffect(() => {
    // Keep sort defaults aligned with grouping for faster scanning.
    if (catalogGroupMode === 'rarity' && catalogSortMode === 'name') {
      setCatalogSortMode('category');
    }
    if (catalogGroupMode === 'category' && catalogSortMode === 'name') {
      setCatalogSortMode('rarity');
    }
    if (catalogGroupMode === 'none' && (catalogSortMode === 'category' || catalogSortMode === 'rarity')) {
      setCatalogSortMode('name');
    }
  }, [catalogGroupMode, catalogSortMode]);

  useEffect(() => {
    if (catalogFilterMode === 'none') {
      setCatalogFilterValue('');
      return;
    }
    if (catalogFilterMode === 'category' && catalogFilterValue && !MATERIAL_CATEGORIES.includes(catalogFilterValue as any)) {
      setCatalogFilterValue('');
    }
    if (catalogFilterMode === 'rarity' && catalogFilterValue && !MATERIAL_RARITIES.includes(catalogFilterValue as any)) {
      setCatalogFilterValue('');
    }
  }, [catalogFilterMode, catalogFilterValue]);

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_materials',
      collectionKey: 'materials',
      entries: materials,
    });
    setStatus(`Экспорт: materials (${materials.length})`);
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isImporting) {
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const entries = extractRawMaterialsFromImportJson(payload);
      const result = await importMaterialsFromJsonEntries(entries);
      await refresh();
      const parts = [
        result.created.length ? `создано: ${result.created.length}` : null,
        result.skippedExisting.length ? `????????? ????????????: ${result.skippedExisting.length}` : null,
        result.errors.length ? `ошибок: ${result.errors.length}` : null,
      ].filter(Boolean);
      setStatus(`Импорт материалов: ${parts.join(', ') || 'нет изменений'}`);
    } catch (error) {
      setStatus(`Импорт: ${(error as Error).message}`);
    } finally {
      setIsImporting(false);
    }
  }

  const visibleMaterials = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((entry) => {
      if (catalogFilterMode === 'category' && catalogFilterValue) {
        if (entry.category !== catalogFilterValue) {
          return false;
        }
      }
      if (catalogFilterMode === 'rarity' && catalogFilterValue) {
        if (entry.rarity !== catalogFilterValue) {
          return false;
        }
      }
      if (!q) {
        return true;
      }
      return entry.id.toLowerCase().includes(q)
        || entry.name.toLowerCase().includes(q)
        || entry.region.toLowerCase().includes(q);
    });
  }, [catalogFilterMode, catalogFilterValue, materials, query]);

  const selectedMaterial = useMemo(
    () => (selectedId ? materials.find((entry) => entry.id === selectedId) ?? null : null),
    [materials, selectedId],
  );

  const rarityRank = useMemo(() => {
    return Object.fromEntries(MATERIAL_RARITIES.map((entry, index) => [entry, index])) as Record<Material['rarity'], number>;
  }, []);
  const categoryRank = useMemo(() => {
    return Object.fromEntries(MATERIAL_CATEGORIES.map((entry, index) => [entry, index])) as Record<Material['category'], number>;
  }, []);

  const groupedMaterials = useMemo(() => {
    const groups = new Map<string, Material[]>();

    const groupKeyFor = (material: Material): string => {
      if (catalogGroupMode === 'category') {
        return `category:${material.category}`;
      }
      if (catalogGroupMode === 'rarity') {
        return `rarity:${material.rarity}`;
      }
      return 'all';
    };

    for (const material of visibleMaterials) {
      const key = groupKeyFor(material);
      const existing = groups.get(key);
      if (existing) {
        existing.push(material);
      } else {
        groups.set(key, [material]);
      }
    }

    const collator = new Intl.Collator('ru', { sensitivity: 'base' });
    const sortItems = (items: Material[]) => {
      const sorted = [...items];
      sorted.sort((a, b) => {
        const compareCategory = () => (categoryRank[a.category] ?? 999) - (categoryRank[b.category] ?? 999);
        const compareRarity = () => (rarityRank[a.rarity] ?? 999) - (rarityRank[b.rarity] ?? 999);

        if (catalogSortMode === 'category') {
          const categoryDelta = compareCategory();
          if (categoryDelta !== 0) return categoryDelta;
          const rarityDelta = compareRarity();
          if (rarityDelta !== 0) return rarityDelta;
        } else if (catalogSortMode === 'rarity') {
          const rarityDelta = compareRarity();
          if (rarityDelta !== 0) return rarityDelta;
          const categoryDelta = compareCategory();
          if (categoryDelta !== 0) return categoryDelta;
        } else {
          // Default behavior: if grouping by rarity, keep categories clustered for fast scanning.
          if (catalogGroupMode === 'rarity') {
            const categoryDelta = compareCategory();
            if (categoryDelta !== 0) return categoryDelta;
          }
          const rarityDelta = compareRarity();
          if (rarityDelta !== 0) return rarityDelta;
        }

        if (catalogSortMode === 'id') {
          const idDelta = collator.compare(a.id, b.id);
          if (idDelta !== 0) return idDelta;
        }

        const nameDelta = collator.compare(a.name || '', b.name || '');
        if (nameDelta !== 0) return nameDelta;
        return collator.compare(a.id, b.id);
      });
      return sorted;
    };

    const orderedKeys: string[] = (() => {
      if (catalogGroupMode === 'category') {
        const expected = MATERIAL_CATEGORIES.map((entry) => `category:${entry}`);
        const extras = [...groups.keys()].filter((key) => !expected.includes(key)).sort();
        return [...expected.filter((key) => groups.has(key)), ...extras];
      }
      if (catalogGroupMode === 'rarity') {
        const expected = MATERIAL_RARITIES.map((entry) => `rarity:${entry}`);
        const extras = [...groups.keys()].filter((key) => !expected.includes(key)).sort();
        return [...expected.filter((key) => groups.has(key)), ...extras];
      }
      return groups.has('all') ? ['all'] : [];
    })();

    return orderedKeys.map((key) => ({
      key,
      title: (() => {
        if (key === 'all') return 'Все';
        if (key.startsWith('category:')) {
          const category = key.slice('category:'.length) as Material['category'];
          return translateMaterialCategory(category);
        }
        if (key.startsWith('rarity:')) {
          const rarity = key.slice('rarity:'.length) as Material['rarity'];
          return translateRarity(rarity);
        }
        return key;
      })(),
      items: sortItems(groups.get(key) ?? []),
    }));
  }, [catalogGroupMode, catalogSortMode, categoryRank, rarityRank, visibleMaterials]);

  function getMaterialCardAccent(material: Material): string {
    if (!material.isEnabled) {
      return 'is-crimson';
    }
    if (material.rarity === 'legendary' || material.rarity === 'mythic' || material.rarity === 'forbidden') {
      return 'is-gold';
    }
    if (material.rarity === 'epic' || material.rarity === 'rare') {
      return 'is-sky';
    }
    return 'is-olive';
  }

  async function createOrUpdate() {
    const id = draft.id.trim() || uid('mat');
    const normalizedImageRef = normalizeGameImageRef(draft.imageRef, draft.imagePath);
    const normalized: Material = {
      ...draft,
      id,
      imageRef: normalizedImageRef,
      imagePath: toLegacyImagePath(normalizedImageRef),
      updatedAt: new Date().toISOString(),
    };

    const imageErrors = validateGameImageRef(normalized.imageRef);
    if (imageErrors.length > 0) {
      setStatus(`Проверка изображения: ${translateAdminErrorMessage(imageErrors.join(', '))}`);
      return;
    }

    const errors = validateMaterial(normalized);
    if (errors.length > 0) {
      setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
      return;
    }

    try {
      if (selectedId) {
        if (normalized.id !== selectedId) {
          const created = await materialsService.rename(selectedId, normalized.id, normalized);
          setSelectedId(created.id);
          setStatus(`Материал переименован: ${created.id}`);
        } else {
          await materialsService.update(selectedId, normalized);
          setStatus(`Материал обновлён: ${selectedId}`);
        }
      } else {
        await materialsService.create(normalized);
        setSelectedId(id);
        setStatus(`Материал создан: ${id}`);
      }
      await refresh();
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function createLinkedItem() {
    if (!draft.name.trim()) {
      setStatus(translateAdminErrorMessage('Material name is required to create linked item.'));
      return;
    }

    const itemId = `mat_${(draft.id || uid('mat')).replace(/[^a-zA-Z0-9_]/g, '_')}`;
    try {
      await itemsService.create({
        id: itemId,
        name: draft.name,
        type: 'material',
        rarity: draft.rarity,
        price: Math.max(1, Math.round(draft.averageMarketPrice || 1)),
        stackable: true,
        maxStack: 999,
        gameplayDescription: draft.gameplayDescription || `Материал: ${draft.name}`,
        loreDescription: draft.loreDescription || draft.gameplayDescription || '',
        imagePath: toLegacyImagePath(normalizeGameImageRef(draft.imageRef, draft.imagePath)) ?? draft.imagePath,
        imageRef: normalizeGameImageRef(draft.imageRef, draft.imagePath),
        isEnabled: true,
      });
      setStatus(`Создан связанный предмет-материал: ${itemId}`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function disableSelected() {
    if (!selectedId) {
      return;
    }
    await materialsService.disable(selectedId);
    await refresh();
    setStatus(`Материал отключён: ${selectedId}`);
  }

  async function deleteSelected() {
    if (!selectedId) {
      return;
    }
    await materialsService.delete(selectedId);
    setSelectedId(null);
    setDraft(emptyMaterial());
    await refresh();
    setStatus(`Материал удалён: ${selectedId}`);
  }

  return (
    <div className="admin-page-grid">
      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Технический уникальный идентификатор материала. На него могут ссылаться крафт, лут и связанные предметы." />
            <AdminHelpTooltip section="materials" field="id" />
            <input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Название" hint="Отображаемое имя материала для игрока." />
            <AdminHelpTooltip section="materials" field="name" />
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Категория" hint="К какому виду относится материал: металл, дерево, ткань, кристалл и т.д." />
            <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as Material['category'] }))}>
              {MATERIAL_CATEGORIES.map((category) => (
                <option key={category} value={category}>{translateMaterialCategory(category)}</option>
              ))}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Редкость" hint="Редкость материала. Обычно влияет на ценность и редкость получения." />
            <select value={draft.rarity} onChange={(event) => setDraft((current) => ({ ...current, rarity: event.target.value as Material['rarity'] }))}>
              {MATERIAL_RARITIES.map((rarity) => (
                <option key={rarity} value={rarity}>{translateRarity(rarity)}</option>
              ))}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Регион" hint="Где этот материал обычно добывается: регион, биом или территория." />
            <input value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Средняя рыночная цена" hint="Базовая средняя цена материала для торговли и связанного item." />
            <input type="number" min="0" value={draft.averageMarketPrice ?? 0} onChange={(event) => setDraft((current) => ({ ...current, averageMarketPrice: Number(event.target.value) || 0 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Свойства" hint="Список ключевых свойств через запятую: например 'гибкий, жаростойкий, редкий'." />
            <input
              value={draft.properties.join(', ')}
              onChange={(event) => setDraft((current) => ({
                ...current,
                properties: event.target.value.split(',').map((v) => v.trim()).filter(Boolean) as Material['properties'],
              }))}
            />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))} />
            <AdminFieldLabel label="Включён" hint="Если выключить, материал останется в базе, но не будет использоваться активным контентом." />
          </label>
        </div>

        <ImageSheetPicker
          label="Изображение материала"
          hint="Загрузите файл: система сама сохранит его и подставит ID. Для тайлсета можно выбрать frame."
          category="materials"
          value={draft.imageRef}
          legacyImagePath={draft.imagePath}
          runtimeImages={images}
          showUploadForImage
          disableManualImageInput
          uploadPresetId="item-icon"
          uploadSuggestedId={draft.id || undefined}
          uploadSuggestedName={`${draft.id || draft.name || 'material'}-icon`}
          uploadFolder={buildUploadFolder('images', 'materials', draft.id || draft.name || undefined)}
          onStatus={setStatus}
          onChange={(next) => setDraft((current) => ({
            ...current,
            imageRef: next,
            imagePath: toLegacyImagePath(next),
          }))}
        />

        <label>
          <AdminFieldLabel label="Игровое описание" hint="Практическое описание для игрока: где используется материал и зачем он нужен." />
          <AdminHelpTooltip section="materials" field="description" />
          <textarea rows={4} value={draft.gameplayDescription ?? ''} onChange={(event) => setDraft((current) => ({ ...current, gameplayDescription: event.target.value }))} />
        </label>

        <label>
          <AdminFieldLabel label="Лор / описание мира" hint="Художественный текст про происхождение, атмосферу и историю материала." />
          <textarea rows={3} value={draft.loreDescription ?? ''} onChange={(event) => setDraft((current) => ({ ...current, loreDescription: event.target.value }))} />
        </label>

        <div className="admin-actions-row">
          <button onClick={() => { void createOrUpdate(); }}>{selectedId ? 'Сохранить' : 'Создать'}</button>
          <button onClick={() => { void createLinkedItem(); }}>Создать связанный предмет</button>
          <button disabled={!selectedId} onClick={() => { void disableSelected(); }}>Отключить</button>
          <button disabled={!selectedId} onClick={() => { void deleteSelected(); }}>Удалить</button>
        </div>
        <p className="muted">{status}</p>
      </section>

      <section className="admin-items-catalog card">
        <div className="admin-catalog-header">
          <div>
            <p className="admin-catalog-kicker">Crafting Assets</p>
            <h3>Все материалы</h3>
            <p className="muted">Материалы — это сырье и торговые единицы мира: еда, зерно, кожа, ткань, дерево, руда, камни, кристаллы, масла, рунные компоненты. Готовые предметы с эффектами, экипировка, руны-вставки и магические камни-вставки создаются в разделе «Предметы».</p>
          </div>
          <div className="admin-catalog-metrics">
            <span>{visibleMaterials.length} в выдаче</span>
            <span>{materials.filter((entry) => entry.isEnabled).length} активных</span>
          </div>
        </div>

      <div className="admin-list-tools admin-catalog-toolbar">
        <input placeholder="Поиск по id, имени или региону" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={catalogGroupMode} onChange={(event) => setCatalogGroupMode(event.target.value as typeof catalogGroupMode)}>
          <option value="category">Группа: Категория</option>
          <option value="rarity">Группа: Редкость</option>
          <option value="none">Группа: Нет</option>
        </select>
        <select value={catalogSortMode} onChange={(event) => setCatalogSortMode(event.target.value as typeof catalogSortMode)}>
          <option value="name">Сорт: Имя</option>
          <option value="id">Сорт: ID</option>
          {catalogGroupMode === 'rarity' ? <option value="category">Сорт: Категория</option> : null}
          {catalogGroupMode === 'category' ? <option value="rarity">Сорт: Редкость</option> : null}
        </select>
        <select value={catalogFilterMode} onChange={(event) => setCatalogFilterMode(event.target.value as typeof catalogFilterMode)}>
          <option value="none">Фильтр: Нет</option>
          <option value="category">Фильтр: Категория</option>
          <option value="rarity">Фильтр: Редкость</option>
        </select>
        <select
          disabled={catalogFilterMode === 'none'}
          value={catalogFilterValue}
          onChange={(event) => setCatalogFilterValue(event.target.value)}
        >
          <option value="">Все</option>
          {catalogFilterMode === 'category'
            ? MATERIAL_CATEGORIES.map((category) => (
              <option key={category} value={category}>{translateMaterialCategory(category)}</option>
            ))
            : null}
          {catalogFilterMode === 'rarity'
            ? MATERIAL_RARITIES.map((rarity) => (
              <option key={rarity} value={rarity}>{translateRarity(rarity)}</option>
            ))
            : null}
        </select>
        <button onClick={exportJson}>Экспорт JSON</button>
        <button disabled={isImporting} onClick={() => importFileRef.current?.click()}>{isImporting ? 'Импорт...' : 'Импорт JSON'}</button>
        <input ref={importFileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={handleImportFile} />
        <button onClick={() => { setSelectedId(null); setDraft(emptyMaterial()); }}>Новый материал</button>
      </div>

        <div className="admin-items-selected-row">
          <strong>Сейчас редактируется:</strong>
          <span>{selectedMaterial ? `${selectedMaterial.name} (${selectedMaterial.id})` : 'новый материал'}</span>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {groupedMaterials.map((group) => {
            const collapsed = collapsedGroups.has(group.key);
            return (
              <div key={group.key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <strong>{group.title}</strong>
                    <span className="muted">{group.items.length}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCollapsedGroups((current) => {
                      const next = new Set(current);
                      if (next.has(group.key)) {
                        next.delete(group.key);
                      } else {
                        next.add(group.key);
                      }
                      return next;
                    })}
                  >
                    {collapsed ? 'Развернуть' : 'Свернуть'}
                  </button>
                </div>

                {collapsed ? null : (
                  <div className="admin-items-icons-grid">
                    {group.items.map((material) => {
                      const image = resolveStoredImageSource(material.imagePath, images);
                      const imageRef = normalizeGameImageRef(material.imageRef, material.imagePath);
                      return (
                        <button
                          key={material.id}
                          className={`admin-item-icon-card ${selectedId === material.id ? 'is-active' : ''}`}
                          onClick={() => { setSelectedId(material.id); setDraft(material); }}
                          title={`${material.name} (${material.id})`}
                        >
                          <div className={`admin-catalog-thumb admin-catalog-thumb-lg ${getMaterialCardAccent(material)}`}>
                            {imageRef ? (
                              <GameImageView
                                imageRef={imageRef}
                                runtimeImages={images}
                                alt={material.name}
                                size={64}
                                fallbackText={(material.name.trim() || material.category).charAt(0).toUpperCase()}
                              />
                            ) : image ? <img src={image} alt={material.name} /> : (material.name.trim() || material.category).charAt(0).toUpperCase()}
                          </div>
                          <strong>{material.name || '(без названия)'}</strong>
                          <span>{material.id || 'ID ещё не задан'}</span>
                          <span>{translateMaterialCategory(material.category)} | {translateRarity(material.rarity)}</span>
                          <span>{translateEnabledState(material.isEnabled)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
