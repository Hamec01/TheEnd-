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

function emptyTransport(): AdminItem {
  return {
    id: '',
    name: '',
    type: 'profession_transport',
    profession: 'carpenter',
    transportKind: 'cart',
    price: 150,
    rentPrice: 15,
    rentDuration: 24,
    durability: 100,
    maxDurability: 100,
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

export function CarpentryTransportTab() {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminItem>(emptyTransport());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [importMode, setImportMode] = useState<JsonImportMode>('addOnly');
  const importFileRef = React.useRef<HTMLInputElement>(null);

  type TransportSubTab = 'general' | 'description' | 'properties' | 'json';
  const [activeSubTab, setActiveSubTab] = useState<TransportSubTab>('general');

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
        setDraft(emptyTransport());
      }
    } catch (err) {
      console.error(err);
      setStatus('Ошибка загрузки транспорта');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const carpenterTransports = useMemo(() => {
    return items.filter(i => i.type === 'profession_transport' && i.profession === 'carpenter');
  }, [items]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return carpenterTransports.filter((i) => !q || i.id.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  }, [carpenterTransports, query]);

  function selectItem(item: AdminItem) {
    setSelectedId(item.id);
    setDraft({
      ...emptyTransport(),
      ...item
    });
  }

  function createNew() {
    setSelectedId(null);
    setDraft(emptyTransport());
    setActiveSubTab('general');
  }

  function patch(next: Partial<AdminItem>) {
    setDraft((current) => ({ ...current, ...next }));
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
          type: 'profession_transport',
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
      setDraft(emptyTransport());
      await refresh();
      setStatus(`Удалено: ${selectedId}`);
    } catch (err) {
      console.error(err);
      setStatus('Ошибка удаления');
    }
  }

  function handleExportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_carpenter_transports',
      collectionKey: 'items',
      entries: carpenterTransports,
    });
    setStatus(`Экспортировано ${carpenterTransports.length} повозок.`);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (importMode === 'replaceAll') {
      if (!window.confirm('ВНИМАНИЕ: это полностью заменит повозки плотника в этом разделе. Прочие предметы не пострадают. Продолжить?')) {
        return;
      }
    }

    setIsSaving(true);
    setStatus('Импорт транспорта...');
    try {
      const parsed = JSON.parse(await file.text());
      const entries = extractRawCollectionFromImportJson(parsed, 'items');
      const result = await importCollectionFromJsonEntries<AdminItem>({
        entries,
        defaults: emptyTransport,
        normalize: (v) => ({ ...emptyTransport(), ...v, id: v.id.trim(), type: 'profession_transport', profession: 'carpenter' }),
        validate: (i) => (!i.id ? ['ID повозки обязателен.'] : []),
        getAll: async () => {
          const all = await getContentCollection<AdminItem>('items');
          return all.filter(i => i.type === 'profession_transport' && i.profession === 'carpenter');
        },
        create: (v) => createContentEntry('items', v),
        update: (id, v) => updateContentEntry('items', id, v),
        delete: (id) => deleteContentEntry('items', id),
        mode: importMode,
      });

      await refresh();
      setStatus(`Импорт: создано ${result.created.length}, обновлено ${result.updated.length}, пропущено ${result.skippedExisting.length}, ошибок ${result.errors.length}.`);
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
          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Повозки плотника</h4>
          <span className="premium-badge">{visibleItems.length} / {carpenterTransports.length}</span>
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
          + Новая повозка
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
            {selectedId ? `Повозка: ${draft.name}` : 'Создание повозки'}
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
                  <AdminFieldLabel label="ID повозки" hint="Например: cart_wooden_simple" />
                  <input value={draft.id} onChange={(e) => patch({ id: e.target.value })} disabled={selectedId !== null} />
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Название" hint="Отображаемое имя в игре" />
                  <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Базовая цена продажи (золото)" hint="Стоимость покупки у торговца" />
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
                  <AdminFieldLabel label="Макс. прочность" hint="Максимальная прочность повозки" />
                  <input type="number" value={draft.maxDurability ?? 100} onChange={(e) => patch({ maxDurability: parseInt(e.target.value, 10) || 100, durability: parseInt(e.target.value, 10) || 100 })} />
                </div>
                <div className="field-group" style={{ gridColumn: 'span 2' }}>
                  <ImageSheetPicker
                    label="Изображение повозки"
                    hint="Загрузите файл или выберите тайлсет"
                    category="items"
                    value={draft.imageRef}
                    legacyImagePath={draft.imagePath}
                    runtimeImages={runtimeImages}
                    showUploadForImage
                    disableManualImageInput
                    uploadPresetId="item-icon"
                    uploadSuggestedId={draft.id || undefined}
                    uploadSuggestedName={`${draft.id || draft.name || 'transport'}-icon`}
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
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Повозка доступна в игре</span>
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
                <AdminFieldLabel label="Вид транспорта" hint="Тип повозки" />
                <select value={draft.transportKind ?? 'cart'} onChange={(e) => patch({ transportKind: e.target.value })} style={{ height: '36px' }}>
                  <option value="cart">Тележка / Повозка (cart)</option>
                  <option value="horse_cart">Конная повозка (horse_cart)</option>
                </select>
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Вместимость бревен" hint="Лимит перевозимых бревен" />
                <input type="number" value={draft.capacityLogs ?? 8} onChange={(e) => patch({ capacityLogs: parseInt(e.target.value, 10) || 8 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Грузоподъемность (кг)" hint="Максимальный дополнительный вес" />
                <input type="number" value={draft.capacityWeight ?? 250} onChange={(e) => patch({ capacityWeight: parseInt(e.target.value, 10) || 250 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Модификатор скорости" hint="Например, 1.0 = нормальная, 0.9 = медленнее, 1.2 = быстрее" />
                <input type="number" step="0.05" value={draft.speed ?? 1.0} onChange={(e) => patch({ speed: parseFloat(e.target.value) || 1.0 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Стоимость аренды (золото)" hint="Цена аренды повозки" />
                <input type="number" value={draft.rentPrice ?? 0} onChange={(e) => patch({ rentPrice: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Срок аренды (часов)" hint="Продолжительность аренды" />
                <input type="number" value={draft.rentDuration ?? 0} onChange={(e) => patch({ rentDuration: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <div className="field-group" style={{ justifyContent: 'center' }}>
                <label className="zone-editor-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '1.25rem' }}>
                  <input type="checkbox" checked={draft.requiresHorse ?? false} onChange={(e) => patch({ requiresHorse: e.target.checked })} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Требуется запряженная лошадь</span>
                </label>
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
            {isSaving ? 'Сохранение...' : (selectedId ? 'Сохранить повозку' : 'Создать повозку')}
          </button>
          {selectedId && (
            <button type="button" className="action-btn-lw danger" onClick={removeCurrent} style={{ marginLeft: 'auto' }}>
              Удалить повозку
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
