import React, { useEffect, useMemo, useState } from 'react';
import { getContentCollection, getContentEntry, createContentEntry, updateContentEntry, deleteContentEntry } from '../../services/content/contentApi';
import type { AdminItem, StoredImage } from '../../services/content/models';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { useAdminSaveShortcut, type AdminSaveViewModel, runSaveWithFeedback } from '../adminSaveTools';
import { AdminFieldLabel } from '../adminUi';
import { downloadCollectionJson, extractRawCollectionFromImportJson, importCollectionFromJsonEntries, type JsonImportMode } from '../../services/content/adminJsonImportExport';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import { loadRuntimeImages } from '../../services/content/runtimeImageService';
import { toLegacyImagePath } from '../../services/content/gameImageRefs';

import '../pages/LivingWorldPage.css';

function emptyTool(): AdminItem {
  return {
    id: '',
    name: '',
    type: 'profession_tool',
    professionItem: true,
    professionId: 'carpenter',
    professionItemKind: 'tool',
    professionStats: {
      toolKind: 'woodcutting_axe',
      tier: 1,
      durability: 100,
      maxDurability: 100,
      efficiency: 1.0,
      staminaCostModifier: 1.0,
      breakChanceModifier: 1.0,
    },
    profession: 'carpenter',
    toolKind: 'woodcutting_axe',
    tier: 1,
    price: 50,
    durability: 100,
    maxDurability: 100,
    efficiency: 1.0,
    treeDamageBonus: 0,
    staminaCostModifier: 1.0,
    breakChanceModifier: 1.0,
    transportKind: 'cart',
    capacityWeight: 250,
    capacityLogs: 8,
    speed: 1.0,
    requiresHorse: false,
    stackable: false,
    rarity: 'common',
    gameplayDescription: '',
    loreDescription: '',
    imageRef: { type: 'image', src: '' },
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function CarpentryToolsTab() {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminItem>(emptyTool());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [importMode, setImportMode] = useState<JsonImportMode>('addOnly');
  const importFileRef = React.useRef<HTMLInputElement>(null);

  type ToolSubTab = 'general' | 'description' | 'properties' | 'json';
  const [activeSubTab, setActiveSubTab] = useState<ToolSubTab>('general');

  async function refresh() {
    try {
      const [allItems, images] = await Promise.all([
        getContentCollection<AdminItem>('items'),
        loadRuntimeImages().catch(() => []),
      ]);
      setItems(allItems || []);
      setRuntimeImages(images);
      if (selectedId && !allItems.some(i => i.id === selectedId)) {
        setSelectedId(null);
        setDraft(emptyTool());
      }
    } catch (err) {
      console.error(err);
      setStatus('Ошибка загрузки инструментов');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const carpenterItems = useMemo(() => {
    return items.filter(i => i.type === 'profession_tool' && i.profession === 'carpenter');
  }, [items]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return carpenterItems.filter((i) => !q || i.id.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  }, [carpenterItems, query]);

  function selectItem(item: AdminItem) {
    setSelectedId(item.id);
    setDraft({
      ...emptyTool(),
      ...item
    });
  }

  function createNew() {
    setSelectedId(null);
    setDraft(emptyTool());
    setActiveSubTab('general');
  }

  function patch(next: Partial<AdminItem>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  const imageSrcValue = useMemo(() => {
    if (draft.imageRef && typeof draft.imageRef === 'object' && 'src' in draft.imageRef) {
      return draft.imageRef.src || '';
    }
    return '';
  }, [draft.imageRef]);

  function handleImageSrcChange(src: string) {
    patch({
      imageRef: { type: 'image', src }
    });
  }

  async function saveCurrent() {
    if (isSaving) return;
    const cleanId = draft.id.trim();
    if (!cleanId) {
      setStatus('Ошибка: ID не может быть пустым');
      return;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: cleanId,
      onSave: async () => {
        const payload: AdminItem = {
          ...draft,
          id: cleanId,
          name: draft.name.trim() || cleanId,
          type: 'profession_tool',
          professionItem: true,
          professionId: 'carpenter',
          professionItemKind: 'tool',
          professionStats: {
            ...(draft.professionStats ?? {}),
            toolKind: draft.professionStats?.toolKind ?? draft.toolKind,
            tier: draft.professionStats?.tier ?? draft.tier,
            durability: draft.professionStats?.durability ?? draft.durability,
            maxDurability: draft.professionStats?.maxDurability ?? draft.maxDurability,
            efficiency: draft.professionStats?.efficiency ?? draft.efficiency,
            staminaCostModifier: draft.professionStats?.staminaCostModifier ?? draft.staminaCostModifier,
            breakChanceModifier: draft.professionStats?.breakChanceModifier ?? draft.breakChanceModifier,
          },
          profession: 'carpenter',
          stackable: false,
        };

        if (selectedId && selectedId !== cleanId) {
          await deleteContentEntry('items', selectedId);
          return createContentEntry('items', payload);
        } else if (items.some(i => i.id === cleanId)) {
          return updateContentEntry('items', cleanId, payload);
        } else {
          return createContentEntry('items', payload);
        }
      },
      onAfterSave: async (entry) => {
        const verified = await getContentEntry<AdminItem>('items', entry.id);
        if (!verified) throw new Error('Запись не найдена на бэкенде после сохранения.');
      },
      successLabel: (entry) => `Сохранено: ${entry.id}`,
    });

    if (saved) {
      setSelectedId(saved.id);
      setDraft(saved);
      await refresh();
      setStatus(`Сохранено: ${saved.id}`);
    }
    setIsSaving(false);
  }

  async function removeCurrent() {
    if (!selectedId) return;
    if (!window.confirm(`Вы уверены, что хотите удалить ${selectedId}?`)) return;

    try {
      await deleteContentEntry('items', selectedId);
      setSelectedId(null);
      setDraft(emptyTool());
      await refresh();
      setStatus(`Удалено: ${selectedId}`);
    } catch (err) {
      console.error(err);
      setStatus('Ошибка удаления');
    }
  }

  // Export JSON
  function handleExportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_carpenter_items',
      collectionKey: 'items',
      entries: carpenterItems,
    });
    setStatus(`Экспортировано ${carpenterItems.length} предметов.`);
  }

  // Import JSON
  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (importMode === 'replaceAll') {
      if (!window.confirm('ВНИМАНИЕ: это полностью заменит инструменты и транспорт плотника в этом разделе. Прочие предметы (оружие, броня) не пострадают. Продолжить?')) {
        return;
      }
    }

    setIsSaving(true);
    setStatus('Импорт предметов...');
    try {
      const parsed = JSON.parse(await file.text());
      const entries = extractRawCollectionFromImportJson(parsed, 'items');
      const result = await importCollectionFromJsonEntries<AdminItem>({
        entries,
        defaults: emptyTool,
        normalize: (v) => ({ ...emptyTool(), ...v, id: v.id.trim(), profession: 'carpenter' }),
        validate: (i) => (!i.id ? ['ID предмета обязателен.'] : []),
        getAll: async () => {
          const all = await getContentCollection<AdminItem>('items');
          return all.filter(i => (i.type === 'profession_tool' || i.type === 'profession_transport') && i.profession === 'carpenter');
        },
        create: (v) => createContentEntry('items', v),
        update: (id, v) => updateContentEntry('items', id, v),
        delete: (id) => deleteContentEntry('items', id),
        mode: importMode,
      });

      await refresh();
      setStatus(`Импорт: создано ${result.created.length}, обновлено ${result.updated.length}, пропущено ${result.skippedExisting.length}, ошибок ${result.errors.length}.`);
      if (result.errors.length > 0) {
        console.error(result.errors);
      }
    } catch (err) {
      console.error(err);
      setStatus(`Ошибка импорта: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: saveCurrent,
  });

  return (
    <div className="living-editor-grid">
      
      {/* Left Column list */}
      <section className="catalog-sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Инструменты и повозки</h4>
          <span className="premium-badge">{visibleItems.length} / {carpenterItems.length}</span>
        </div>

        <input
          className="catalog-search-input"
          placeholder="Поиск по названию/ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="catalog-scrollable-list custom-scroll" style={{ maxHeight: 'calc(100vh - 440px)', minHeight: '220px' }}>
          {visibleItems.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`catalog-card ${isSelected ? 'is-selected' : ''}`}
                onClick={() => selectItem(item)}
              >
                <strong style={{ fontSize: '0.95rem', display: 'block' }}>{item.name}</strong>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="action-btn-lw secondary"
          style={{ width: '100%', marginTop: '0.8rem', borderStyle: 'dashed' }}
          onClick={createNew}
        >
          + Новый инструмент/повозка
        </button>

        {/* Import/Export Block */}
        <div className="card" style={{ padding: '0.8rem', background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(169, 139, 87, 0.2)', marginTop: '0.8rem' }}>
          <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Импорт / Экспорт JSON</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <button type="button" className="action-btn-lw secondary" onClick={handleExportJson} style={{ width: '100%', padding: '0.35rem' }}>
              Экспортировать всё
            </button>
            <div style={{ borderTop: '1px solid rgba(169,139,87,0.15)', marginTop: '0.25rem', paddingTop: '0.4rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem' }} className="muted">
                Режим импорта:
                <select className="filter-select" value={importMode} onChange={(e) => setImportMode(e.target.value as JsonImportMode)} style={{ marginTop: '0.2rem', padding: '0.2rem' }}>
                  <option value="addOnly">Добавить новые</option>
                  <option value="merge">Обновить и добавить новые</option>
                  <option value="replaceAll">Полная замена (Replace all)</option>
                </select>
              </label>
              <button type="button" onClick={() => importFileRef.current?.click()} style={{ width: '100%', padding: '0.35rem' }} className="action-btn-lw primary">
                Загрузить и импортировать
              </button>
              <input ref={importFileRef} type="file" accept="application/json,.json" onChange={handleImportFile} style={{ display: 'none' }} />
            </div>
          </div>
        </div>
      </section>

      {/* Right Column workspace */}
      <section className="editor-workspace">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent)' }}>
            {selectedId ? `Предмет: ${draft.name}` : 'Создание предмета'}
          </h4>
          {selectedId && <span className="muted" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>ID: {selectedId}</span>}
        </div>

        {/* Sub tabs */}
        <div className="sub-tabs-container">
          {(['general', 'description', 'properties', 'json'] as const).map(tab => {
            const isActive = activeSubTab === tab;
            return (
              <button
                key={tab}
                type="button"
                className={`sub-tab-btn ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveSubTab(tab)}
              >
                {tab === 'general' ? 'Общее' :
                 tab === 'description' ? 'Описание' :
                 tab === 'properties' ? 'Параметры / Свойства' : 'JSON'}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '1rem' }} className="custom-scroll">
          
          {/* Sub-tab 1: GENERAL */}
          {activeSubTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-grid-premium">
                <div className="field-group">
                  <AdminFieldLabel label="ID Предмета" hint="Например: tool_woodcutting_axe_steel" />
                  <input value={draft.id} onChange={(e) => patch({ id: e.target.value })} disabled={selectedId !== null} />
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Название" hint="Отображаемое имя в игре" />
                  <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Тип предмета" hint="Категория" />
                  <input value="Инструмент (profession_tool)" disabled style={{ height: '36px' }} />
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Тир" hint="Уровень/ранг предмета" />
                  <input type="number" value={draft.tier ?? 1} onChange={(e) => patch({ tier: parseInt(e.target.value, 10) || 1 })} />
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Базовая цена (золото)" hint="Стоимость покупки у торговца" />
                  <input type="number" value={draft.price ?? 0} onChange={(e) => patch({ price: parseInt(e.target.value, 10) || 0 })} />
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Редкость" hint="Rarity предмета" />
                  <select value={draft.rarity} onChange={(e) => patch({ rarity: e.target.value as any })} style={{ height: '36px' }}>
                    <option value="common">Common</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Макс. прочность" hint="Максимальная прочность" />
                  <input type="number" value={draft.maxDurability ?? 100} onChange={(e) => patch({ maxDurability: parseInt(e.target.value, 10) || 100, durability: parseInt(e.target.value, 10) || 100 })} />
                </div>
                <div className="field-group" style={{ gridColumn: 'span 2' }}>
                  <ImageSheetPicker
                    label="Изображение предмета"
                    hint="Загрузите файл: система сама сохранит его и подставит ID. Для тайлсета можно выбрать frame."
                    category="items"
                    value={draft.imageRef}
                    legacyImagePath={draft.imagePath}
                    runtimeImages={runtimeImages}
                    showUploadForImage
                    disableManualImageInput
                    uploadPresetId="item-icon"
                    uploadSuggestedId={draft.id || undefined}
                    uploadSuggestedName={`${draft.id || draft.name || 'item'}-icon`}
                    onStatus={setStatus}
                    onChange={(next) => patch({
                      imageRef: next,
                      imagePath: next ? toLegacyImagePath(next) : undefined,
                    })}
                  />
                </div>
                <div className="field-group" style={{ justifyContent: 'center' }}>
                  <label className="zone-editor-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '1.25rem' }}>
                    <input type="checkbox" checked={draft.isEnabled} onChange={(e) => patch({ isEnabled: e.target.checked })} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Инструмент/повозка доступна в игре</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 2: DESCRIPTION */}
          {activeSubTab === 'description' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="field-group">
                <AdminFieldLabel label="Игровое описание" hint="Краткие свойства и эффекты" />
                <textarea rows={3} value={draft.gameplayDescription} onChange={(e) => patch({ gameplayDescription: e.target.value })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Художественное описание" hint="Лор предмета" />
                <textarea rows={3} value={draft.loreDescription} onChange={(e) => patch({ loreDescription: e.target.value })} />
              </div>
            </div>
          )}

          {/* Sub-tab 3: PROPERTIES */}
          {activeSubTab === 'properties' && (
            <div className="form-grid-premium">
              <div className="field-group">
                <AdminFieldLabel label="Вид инструмента" hint="Определяет роль в деревообработке" />
                <select value={draft.toolKind ?? 'woodcutting_axe'} onChange={(e) => patch({ toolKind: e.target.value })} style={{ height: '36px' }}>
                  <option value="woodcutting_axe">Топор лесоруба (woodcutting_axe)</option>
                  <option value="saw">Пила (saw)</option>
                  <option value="planer">Рубанок (planer)</option>
                  <option value="chisel">Стамеска (chisel)</option>
                  <option value="hammer">Молоток (hammer)</option>
                  <option value="carving_knife">Нож для художественной резьбы (carving_knife)</option>
                  <option value="workbench">Переносной верстак (workbench)</option>
                  <option value="drying_rack">Стойка для сушки (drying_rack)</option>
                </select>
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Эффективность (efficiency)" hint="Множитель скорости выполнения операций" />
                <input type="number" step="0.1" value={draft.efficiency ?? 1.0} onChange={(e) => patch({ efficiency: parseFloat(e.target.value) || 1.0 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Бонус урона дереву" hint="Прибавляется к урону при рубке" />
                <input type="number" value={draft.treeDamageBonus ?? 0} onChange={(e) => patch({ treeDamageBonus: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Модификатор расхода выносливости" hint="Множитель расхода выносливости (например 0.9 = -10%)" />
                <input type="number" step="0.1" value={draft.staminaCostModifier ?? 1.0} onChange={(e) => patch({ staminaCostModifier: parseFloat(e.target.value) || 1.0 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Модификатор шанса поломки" hint="Множитель шанса сломать топор (например 0.8 = -20% риска)" />
                <input type="number" step="0.1" value={draft.breakChanceModifier ?? 1.0} onChange={(e) => patch({ breakChanceModifier: parseFloat(e.target.value) || 1.0 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Требуемый уровень плотника" hint="Минимальный уровень профессии плотника" />
                <input type="number" value={draft.requiredLevel ?? 1} onChange={(e) => patch({ requiredLevel: parseInt(e.target.value, 10) || 1 })} />
              </div>
            </div>
          )}

          {/* Sub-tab 4: JSON */}
          {activeSubTab === 'json' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1, minHeight: '300px' }}>
              <AdminFieldLabel label="Исходный код (JSON)" hint="Только для чтения и отладки" />
              <textarea
                readOnly
                rows={14}
                value={JSON.stringify(draft, null, 2)}
                style={{
                  fontFamily: 'monospace',
                  width: '100%',
                  flex: 1,
                  background: 'rgba(0,0,0,0.22)',
                  padding: '0.8rem',
                  color: '#d4c7b3',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '6px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

        </div>

        {/* Action Buttons Row */}
        <div className="action-buttons-bar">
          <button type="button" className="action-btn-lw primary" onClick={saveCurrent} disabled={isSaving}>
            {isSaving ? 'Сохранение...' : (selectedId ? 'Сохранить предмет' : 'Создать предмет')}
          </button>
          {selectedId && (
            <button type="button" className="action-btn-lw danger" onClick={removeCurrent} style={{ marginLeft: 'auto' }}>
              Удалить предмет
            </button>
          )}
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <AdminSaveStatus value={saveState} />
          <p className="muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>{status}</p>
        </div>

      </section>

    </div>
  );
}

