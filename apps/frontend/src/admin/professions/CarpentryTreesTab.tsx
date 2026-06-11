import React, { useEffect, useMemo, useState } from 'react';
import { getContentCollection, getContentEntry, createContentEntry, updateContentEntry, deleteContentEntry } from '../../services/content/contentApi';
import type { TreeDefinition, BiomeDefinition, AdminItem, LootTable, StoredImage } from '../../services/content/models';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { useAdminSaveShortcut, type AdminSaveViewModel, runSaveWithFeedback } from '../adminSaveTools';
import { AdminFieldLabel } from '../adminUi';
import { lootTablesService } from '../../services/content/lootTablesService';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import { loadRuntimeImages } from '../../services/content/runtimeImageService';
import { toLegacyImagePath } from '../../services/content/gameImageRefs';
import { TreeWoodProfileEditor, createEmptyTreeWoodProfile } from '../components/TreeWoodProfileEditor';
import '../pages/LivingWorldPage.css';

function emptyTree(): TreeDefinition {
  return {
    id: '',
    name: '',
    description: '',
    region: '',
    biomeIds: [],
    tier: 1,
    rarity: 'common',
    hp: 100,
    hardness: 1,
    stability: 100,
    fallRisk: 10,
    requiredWoodcuttingTier: 1,
    requiredToolTier: 1,
    baseXp: 10,
    weight: 10,
    drops: [],
    enabled: true,
    woodProfile: createEmptyTreeWoodProfile(),
    sourceMaterialIds: [],
  };
}

export function CarpentryTreesTab() {
  const [trees, setTrees] = useState<TreeDefinition[]>([]);
  const [biomes, setBiomes] = useState<BiomeDefinition[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [lootTables, setLootTables] = useState<LootTable[]>([]);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TreeDefinition>(emptyTree());
  const [draftTreeBiomeIds, setDraftTreeBiomeIds] = useState<string[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<TreeSubTab>('general');

  // Search and filter states
  const [query, setQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [filterEnabled, setFilterEnabled] = useState('all');

  const [status, setStatus] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [woodValidation, setWoodValidation] = useState<{ errors: string[]; warnings: string[] }>({ errors: [], warnings: [] });

  // For adding a new drop
  const [newDropItemId, setNewDropItemId] = useState('');
  const [newDropMin, setNewDropMin] = useState(1);
  const [newDropMax, setNewDropMax] = useState(1);
  const [newDropChance, setNewDropChance] = useState(100);

  type TreeSubTab = 'general' | 'gameplay' | 'wood' | 'drops' | 'biomes' | 'json';

  async function refresh() {
    try {
      const [nextTrees, nextBiomes, nextItems, nextLootTables, images] = await Promise.all([
        getContentCollection<TreeDefinition>('trees'),
        getContentCollection<BiomeDefinition>('biomes'),
        getContentCollection<AdminItem>('items'),
        lootTablesService.getAll(),
        loadRuntimeImages().catch(() => []),
      ]);
      setTrees(nextTrees || []);
      setBiomes(nextBiomes || []);
      setItems(nextItems || []);
      setLootTables(nextLootTables || []);
      setRuntimeImages(images);

      if (selectedId && !nextTrees.some(t => t.id === selectedId)) {
        setSelectedId(null);
        setDraft(emptyTree());
        setDraftTreeBiomeIds([]);
      }
    } catch (err) {
      console.error(err);
      setStatus('Ошибка загрузки данных');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const treeRegions = useMemo(() => {
    const list = new Set<string>();
    trees.forEach(t => { if (t.region) list.add(t.region); });
    biomes.forEach(b => { if (b.region) list.add(b.region); });
    return Array.from(list).sort();
  }, [trees, biomes]);

  const visibleTrees = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trees.filter((t) => {
      const matchQuery = !q || t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
      const matchRegion = filterRegion === 'all' || t.region === filterRegion;
      const matchRarity = filterRarity === 'all' || t.rarity === filterRarity;
      const matchTier = filterTier === 'all' || String(t.tier) === filterTier;
      const matchEnabled = filterEnabled === 'all' 
        ? true 
        : filterEnabled === 'enabled' 
          ? t.enabled !== false 
          : t.enabled === false;

      return matchQuery && matchRegion && matchRarity && matchTier && matchEnabled;
    });
  }, [trees, query, filterRegion, filterRarity, filterTier, filterEnabled]);

  function selectTree(tree: TreeDefinition) {
    setSelectedId(tree.id);
    setDraft({
      ...emptyTree(),
      ...tree,
      biomeIds: tree.biomeIds || [],
      drops: tree.drops || [],
      woodProfile: tree.woodProfile ?? createEmptyTreeWoodProfile(),
      sourceMaterialIds: tree.sourceMaterialIds ?? [],
    });

    const matchingBiomes = biomes
      .filter(b => b.resourcePools?.forest?.includes(tree.id) || b.defaultTreePool?.includes(tree.id))
      .map(b => b.id);
    setDraftTreeBiomeIds(matchingBiomes);
  }

  function createNew() {
    setSelectedId(null);
    setDraft(emptyTree());
    setDraftTreeBiomeIds([]);
    setActiveSubTab('general');
  }

  function patch(next: Partial<TreeDefinition>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function toggleBiome(biomeId: string) {
    setDraftTreeBiomeIds(current => 
      current.includes(biomeId) ? current.filter(id => id !== biomeId) : [...current, biomeId]
    );
  }

  function addDrop() {
    if (!newDropItemId) {
      alert('Выберите предмет для дропа');
      return;
    }
    const currentDrops = draft.drops || [];
    if (currentDrops.some(d => d.itemId === newDropItemId)) {
      alert('Этот предмет уже есть в таблице дропа');
      return;
    }

    const nextDrops = [
      ...currentDrops,
      {
        itemId: newDropItemId,
        min: newDropMin,
        max: newDropMax,
        chance: newDropChance,
      }
    ];
    patch({ drops: nextDrops });
    setNewDropItemId('');
  }

  function removeDrop(itemId: string) {
    const nextDrops = (draft.drops || []).filter(d => d.itemId !== itemId);
    patch({ drops: nextDrops });
  }

  async function saveCurrent() {
    if (isSaving) return;
    const cleanId = draft.id.trim();
    if (!cleanId) {
      setStatus('Ошибка: ID дерева не может быть пустым');
      return;
    }
    if (woodValidation.errors.length > 0) {
      setStatus('Ошибка: исправьте ошибки в Свойствах древесины перед сохранением.');
      return;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: cleanId,
      onSave: async () => {
        const payload: TreeDefinition = {
          ...draft,
          id: cleanId,
          name: draft.name.trim() || cleanId,
          biomeIds: draftTreeBiomeIds,
          woodProfile: draft.woodProfile ?? createEmptyTreeWoodProfile(),
          sourceMaterialIds: draft.sourceMaterialIds ?? [],
        };

        let result: TreeDefinition;
        if (selectedId && selectedId !== cleanId) {
          await deleteContentEntry('trees', selectedId);
          result = await createContentEntry('trees', payload);
        } else if (trees.some(t => t.id === cleanId)) {
          result = await updateContentEntry('trees', cleanId, payload);
        } else {
          result = await createContentEntry('trees', payload);
        }

        // Perform bidirectional sync with biomes
        for (const biome of biomes) {
          const shouldHaveTree = draftTreeBiomeIds.includes(biome.id);
          const currentPool = biome.resourcePools?.forest || [];
          const hasTree = currentPool.includes(cleanId);

          if (shouldHaveTree && !hasTree) {
            const nextPool = [...currentPool, cleanId];
            const updated = {
              ...biome,
              defaultTreePool: nextPool,
              resourcePools: { ...(biome.resourcePools || {}), forest: nextPool }
            };
            await updateContentEntry('biomes', biome.id, updated);
          } else if (!shouldHaveTree && hasTree) {
            const nextPool = currentPool.filter(id => id !== cleanId);
            const updated = {
              ...biome,
              defaultTreePool: nextPool,
              resourcePools: { ...(biome.resourcePools || {}), forest: nextPool }
            };
            await updateContentEntry('biomes', biome.id, updated);
          }
        }

        return result;
      },
      onAfterSave: async (entry) => {
        const verified = await getContentEntry<TreeDefinition>('trees', entry.id);
        if (!verified) throw new Error('Запись не найдена на бэкенде после сохранения.');
      },
      successLabel: (entry) => `Дерево сохранено: ${entry.id}`,
    });

    if (saved) {
      setSelectedId(saved.id);
      setDraft(saved);
      await refresh();
      setStatus(`Дерево сохранено: ${saved.id}`);
    }
    setIsSaving(false);
  }

  async function removeCurrent() {
    if (!selectedId) return;
    if (!window.confirm(`Вы уверены, что хотите удалить дерево ${selectedId}?`)) return;

    try {
      await deleteContentEntry('trees', selectedId);
      setSelectedId(null);
      setDraft(emptyTree());
      setDraftTreeBiomeIds([]);
      await refresh();
      setStatus(`Дерево удалено: ${selectedId}`);
    } catch (err) {
      console.error(err);
      setStatus('Ошибка удаления дерева');
    }
  }

  // Find linked loot table
  const treeLootTable = useMemo(() => {
    if (!selectedId) return null;
    return lootTables.find(lt => lt.sourceType === 'tree' && lt.sourceId === selectedId);
  }, [lootTables, selectedId]);

  async function handleCreateLootTable() {
    if (!selectedId) return;
    const cleanId = draft.id;
    const lootTableId = `loot_tree_${cleanId}`;
    try {
      const newLootTable = {
        id: lootTableId,
        name: `Добыча с дерева: ${draft.name}`,
        sourceType: 'tree' as const,
        sourceId: cleanId,
        entries: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await createContentEntry('lootTables', newLootTable);
      await refresh();
      setStatus(`Создана Loot Table: ${lootTableId}`);
    } catch (err) {
      console.error(err);
      alert('Не удалось создать таблицу добычи.');
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
          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Деревья</h4>
          <span className="premium-badge">{visibleTrees.length} / {trees.length}</span>
        </div>

        <input
          className="catalog-search-input"
          placeholder="Поиск по названию/ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* Filter controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(169,139,87,0.15)', paddingBottom: '0.8rem' }}>
          <label style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }} className="muted">
            Регион:
            <select className="filter-select" value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}>
              <option value="all">Все регионы</option>
              {treeRegions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }} className="muted">
            Редкость:
            <select className="filter-select" value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)}>
              <option value="all">Все</option>
              <option value="common">Common</option>
              <option value="uncommon">Uncommon</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </select>
          </label>
          <label style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }} className="muted">
            Сложность (Tier):
            <select className="filter-select" value={filterTier} onChange={(e) => setFilterTier(e.target.value)}>
              <option value="all">Все</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
              <option value="4">Tier 4</option>
            </select>
          </label>
          <label style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }} className="muted">
            Статус:
            <select className="filter-select" value={filterEnabled} onChange={(e) => setFilterEnabled(e.target.value)}>
              <option value="all">Все</option>
              <option value="enabled">Включено</option>
              <option value="disabled">Отключено</option>
            </select>
          </label>
        </div>

        <div className="catalog-scrollable-list">
          {visibleTrees.map((tree) => {
            const isSelected = selectedId === tree.id;
            return (
              <button
                key={tree.id}
                type="button"
                className={`catalog-card ${isSelected ? 'is-selected' : ''}`}
                onClick={() => selectTree(tree)}
              >
                <strong style={{ fontSize: '0.95rem', display: 'block' }}>{tree.name}</strong>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="action-btn-lw secondary"
          style={{ width: '100%', marginTop: 'auto', borderStyle: 'dashed' }}
          onClick={createNew}
        >
          + Новое дерево
        </button>
      </section>

      {/* Right Column workspace */}
      <section className="editor-workspace">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent)' }}>
            {selectedId ? `Дерево: ${draft.name}` : 'Создание дерева'}
          </h4>
          {selectedId && <span className="muted" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>ID: {selectedId}</span>}
        </div>

        {/* Sub tabs */}
        <div className="sub-tabs-container">
          {(['general', 'gameplay', 'wood', 'drops', 'biomes', 'json'] as const).map(tab => {
            const isActive = activeSubTab === tab;
            return (
              <button
                key={tab}
                type="button"
                className={`sub-tab-btn ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveSubTab(tab)}
              >
                {tab === 'general' ? 'Общее' :
                 tab === 'gameplay' ? 'Геймплей' :
                 tab === 'wood' ? 'Свойства древесины' :
                 tab === 'drops' ? 'Добыча / Drops' :
                 tab === 'biomes' ? 'Биомы обитания' : 'JSON'}
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
                  <AdminFieldLabel label="ID Дерева" hint="Например: tree_pine_common" />
                  <input value={draft.id} onChange={(e) => patch({ id: e.target.value })} disabled={selectedId !== null} />
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Название" hint="Отображаемое имя в игре" />
                  <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Регион лора" hint="Например: teramor, ailassil, etc." />
                  <input value={draft.region} onChange={(e) => patch({ region: e.target.value })} />
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Редкость" hint="Категория редкости" />
                  <select value={draft.rarity} onChange={(e) => patch({ rarity: e.target.value as any })} style={{ height: '36px' }}>
                    <option value="common">Common</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </div>
                <div className="field-group">
                  <AdminFieldLabel label="Tier дерева" hint="Грейд дерева (1-4)" />
                  <input type="number" value={draft.tier} onChange={(e) => patch({ tier: parseInt(e.target.value, 10) || 1 })} />
                </div>
                <div className="field-group" style={{ justifyContent: 'center' }}>
                  <label className="zone-editor-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '1.25rem' }}>
                    <input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Дерево доступно для рубки</span>
                  </label>
                </div>
              </div>

              <ImageSheetPicker
                label="Изображение дерева"
                hint="Загрузите файл: система сама сохранит его и подставит ID. Для тайлсета можно выбрать frame."
                category="other"
                value={draft.imageRef}
                legacyImagePath={draft.imagePath}
                runtimeImages={runtimeImages}
                showUploadForImage
                disableManualImageInput
                uploadPresetId="tree-sprite"
                uploadSuggestedId={draft.id || undefined}
                uploadSuggestedName={`${draft.id || draft.name || 'tree'}-sprite`}
                onStatus={setStatus}
                onChange={(next) => patch({
                  imageRef: next,
                  imagePath: next ? toLegacyImagePath(next) : undefined,
                })}
              />

              <div className="field-group">
                <AdminFieldLabel label="Описание" hint="Художественное описание" />
                <textarea rows={4} value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
              </div>
            </div>
          )}

          {/* Sub-tab 2: GAMEPLAY */}
          {activeSubTab === 'gameplay' && (
            <div className="form-grid-premium three-cols">
              <div className="field-group">
                <AdminFieldLabel label="HP дерева" hint="Здоровье для срубания" />
                <input type="number" value={draft.hp} onChange={(e) => patch({ hp: parseInt(e.target.value, 10) || 1 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Твердость" hint="Вычитается из урона топора" />
                <input type="number" value={draft.hardness} onChange={(e) => patch({ hardness: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Стабильность" hint="Устойчивость при ударах" />
                <input type="number" value={draft.stability} onChange={(e) => patch({ stability: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Риск падения (%)" hint="Шанс получить травму" />
                <input type="number" value={draft.fallRisk} onChange={(e) => patch({ fallRisk: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Требуемый уровень рубки" hint="Уровень навыка Carpenter" />
                <input type="number" value={draft.requiredWoodcuttingTier} onChange={(e) => patch({ requiredWoodcuttingTier: parseInt(e.target.value, 10) || 1 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Требуемый Tier топора" hint="Грейд топора" />
                <input type="number" value={draft.requiredToolTier} onChange={(e) => patch({ requiredToolTier: parseInt(e.target.value, 10) || 1 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Опыт (XP)" hint="Дается при успешной рубке" />
                <input type="number" value={draft.baseXp} onChange={(e) => patch({ baseXp: parseInt(e.target.value, 10) || 0 })} />
              </div>
              <div className="field-group">
                <AdminFieldLabel label="Вес бревна" hint="Вес материала в рюкзаке" />
                <input type="number" value={draft.weight} onChange={(e) => patch({ weight: parseInt(e.target.value, 10) || 1 })} />
              </div>
            </div>
          )}

          {activeSubTab === 'wood' && (
            <TreeWoodProfileEditor
              tree={draft}
              onTreePatch={patch}
              onValidationChange={setWoodValidation}
            />
          )}

          {/* Sub-tab 3: DROPS */}
          {activeSubTab === 'drops' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Linked Loot Table */}
              <div className="card" style={{ padding: '1.25rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(169, 139, 87, 0.35)' }}>
                <strong style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.95rem', color: 'var(--accent)' }}>Связанная таблица добычи (Loot Table):</strong>
                {treeLootTable ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      Найдена: <code style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{treeLootTable.id}</code> ({treeLootTable.name})
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="muted" style={{ fontSize: '0.85rem' }}>Таблица добычи не связана (будут использоваться drops ниже).</span>
                    <button type="button" className="action-btn-lw primary" onClick={handleCreateLootTable} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                      Создать Loot Table
                    </button>
                  </div>
                )}
              </div>

              {/* Drops manually */}
              <div className="card" style={{ padding: '1.25rem', background: 'rgba(0, 0, 0, 0.1)', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', minHeight: '220px' }}>
                <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--accent)' }}>Таблица добычи / Drops</h5>
                
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: '200px' }} className="custom-scroll">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Предмет (ID)</th>
                        <th style={{ textAlign: 'center' }}>Мин</th>
                        <th style={{ textAlign: 'center' }}>Макс</th>
                        <th style={{ textAlign: 'center' }}>Шанс (%)</th>
                        <th style={{ textAlign: 'right' }}>Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(draft.drops || []).map((drop) => {
                        const foundItem = items.find(i => i.id === drop.itemId);
                        return (
                          <tr key={drop.itemId}>
                            <td>
                              <strong>{foundItem ? foundItem.name : drop.itemId}</strong> <span className="muted" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>({drop.itemId})</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>{drop.min}</td>
                            <td style={{ textAlign: 'center' }}>{drop.max}</td>
                            <td style={{ textAlign: 'center' }}>{drop.chance}%</td>
                            <td style={{ textAlign: 'right' }}>
                              <button type="button" className="action-btn-lw danger" onClick={() => removeDrop(drop.itemId)} style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}>Удалить</button>
                            </td>
                          </tr>
                        );
                      })}
                      {(!draft.drops || draft.drops.length === 0) && (
                        <tr>
                          <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>Таблица добычи пуста. Добавьте предметы ниже.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', marginTop: '1.25rem', alignItems: 'end', borderTop: '1px solid rgba(169, 139, 87, 0.15)', paddingTop: '1rem' }}>
                  <div className="field-group">
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Добавить предмет</span>
                    <select value={newDropItemId} onChange={(e) => setNewDropItemId(e.target.value)} style={{ height: '34px', padding: '0.2rem' }}>
                      <option value="">-- Выберите предмет --</option>
                      {items.filter(i => i.type === 'material' || i.type === 'quest').map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.id})</option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Мин</span>
                    <input type="number" value={newDropMin} onChange={(e) => setNewDropMin(parseInt(e.target.value, 10) || 0)} style={{ height: '34px' }} />
                  </div>
                  <div className="field-group">
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Макс</span>
                    <input type="number" value={newDropMax} onChange={(e) => setNewDropMax(parseInt(e.target.value, 10) || 0)} style={{ height: '34px' }} />
                  </div>
                  <div className="field-group">
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Шанс (%)</span>
                    <input type="number" value={newDropChance} onChange={(e) => setNewDropChance(parseInt(e.target.value, 10) || 0)} style={{ height: '34px' }} />
                  </div>
                  <button type="button" onClick={addDrop} className="action-btn-lw primary" style={{ height: '34px', padding: '0 0.8rem' }}>+</button>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 4: BIOMES */}
          {activeSubTab === 'biomes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              <AdminFieldLabel label="Связанные биомы" hint="В каких биомах спавнится это дерево." />
              <div className="trees-checkbox-grid">
                {biomes.map(biome => {
                  const isChecked = draftTreeBiomeIds.includes(biome.id);
                  return (
                    <label key={biome.id} className={`tree-checkbox-card ${isChecked ? 'is-active' : ''}`} style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleBiome(biome.id)}
                      />
                      <div>
                        <strong style={{ fontSize: '0.85rem' }}>{biome.name}</strong>
                        <div className="muted" style={{ fontSize: '0.75rem', marginTop: '0.1rem' }}>
                          {biome.id} | Danger {biome.dangerLevel}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-tab 5: JSON */}
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
            {isSaving ? 'Сохранение...' : (selectedId ? 'Сохранить дерево' : 'Создать дерево')}
          </button>
          {selectedId && (
            <button type="button" className="action-btn-lw danger" onClick={removeCurrent} style={{ marginLeft: 'auto' }}>
              Удалить дерево
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
