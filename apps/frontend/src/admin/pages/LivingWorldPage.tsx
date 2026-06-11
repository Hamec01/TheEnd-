import React, { useEffect, useMemo, useState, useRef } from 'react';
import { getContentCollection, getContentEntry, createContentEntry, updateContentEntry, deleteContentEntry } from '../../services/content/contentApi';
import type { BiomeDefinition, TreeDefinition, AdminItem, LootTable, StoredImage } from '../../services/content/models';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { useAdminSaveShortcut, type AdminSaveViewModel, runSaveWithFeedback } from '../adminSaveTools';
import { AdminFieldLabel } from '../adminUi';
import { downloadCollectionJson, extractRawCollectionFromImportJson, importCollectionFromJsonEntries, type JsonImportMode } from '../../services/content/adminJsonImportExport';
import { lootTablesService } from '../../services/content/lootTablesService';
import { ImageSheetPicker } from '../components/ImageSheetPicker';
import { loadRuntimeImages } from '../../services/content/runtimeImageService';
import { toLegacyImagePath } from '../../services/content/gameImageRefs';
import { TreeWoodProfileEditor, createEmptyTreeWoodProfile } from '../components/TreeWoodProfileEditor';
import './LivingWorldPage.css';

type MainTab = 'biomes' | 'trees' | 'plants' | 'animals' | 'fish' | 'monsters' | 'events' | 'import_export';
type BiomeSubTab = 'general' | 'resources' | 'trees' | 'plants' | 'animals' | 'fish' | 'monsters' | 'events' | 'json';
type TreeSubTab = 'general' | 'gameplay' | 'wood' | 'drops' | 'biomes' | 'json';

const WATER_TYPES = ['river', 'lake', 'sea', 'swamp', 'pond', 'underground_water'] as const;
const RESOURCE_KINDS = ['forest', 'herb', 'hunting', 'fishing', 'monster', 'event'] as const;

interface LivingWorldPageProps {
  initialTab?: MainTab;
  onNavigate?: (path: string) => void;
}

interface PendingImportPreview<T extends { id: string }> {
  fileName: string;
  mode: JsonImportMode;
  totalFound: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  replaceWarningCount: number;
  firstIds: string[];
  errors: string[];
  entries: T[];
}

function emptyBiome(): BiomeDefinition {
  return {
    id: '',
    name: '',
    region: '',
    climate: '',
    dangerLevel: 1,
    hasWater: false,
    waterTypes: [],
    defaultTreePool: [],
    allowedResourceKinds: ['forest'],
    resourcePools: {
      forest: [],
      herb: [],
      hunting: [],
      fishing: [],
      monster: [],
      event: [],
    },
    description: '',
    enabled: true,
  };
}

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

export function LivingWorldPage({ initialTab = 'biomes', onNavigate }: LivingWorldPageProps) {
  // Main Navigation State
  const [activeMainTab, setActiveMainTab] = useState<MainTab>(initialTab);

  // Collections loaded from backend
  const [biomes, setBiomes] = useState<BiomeDefinition[]>([]);
  const [trees, setTrees] = useState<TreeDefinition[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [lootTables, setLootTables] = useState<LootTable[]>([]);

  // Selection states
  const [selectedBiomeId, setSelectedBiomeId] = useState<string | null>(null);
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);

  // Draft editing states
  const [draftBiome, setDraftBiome] = useState<BiomeDefinition>(emptyBiome());
  const [draftTree, setDraftTree] = useState<TreeDefinition>(emptyTree());
  const [draftTreeBiomeIds, setDraftTreeBiomeIds] = useState<string[]>([]);

  // Sub-tabs navigation
  const [activeBiomeSubTab, setActiveBiomeSubTab] = useState<BiomeSubTab>('general');
  const [activeTreeSubTab, setActiveTreeSubTab] = useState<TreeSubTab>('general');

  // Search queries & filters
  const [biomeQuery, setBiomeQuery] = useState('');
  const [treeQuery, setTreeQuery] = useState('');
  
  // Tree catalog filters
  const [treeFilterRegion, setTreeFilterRegion] = useState('all');
  const [treeFilterRarity, setTreeFilterRarity] = useState('all');
  const [treeFilterTier, setTreeFilterTier] = useState('all');
  const [treeFilterEnabled, setTreeFilterEnabled] = useState('all');

  // Status & Saving states
  const [status, setStatus] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [woodValidation, setWoodValidation] = useState<{ errors: string[]; warnings: string[] }>({ errors: [], warnings: [] });

  // Input state for adding string IDs in Biome detail list editor tabs
  const [newPoolItemText, setNewPoolItemText] = useState('');

  // Dropdown drop selection state inside Tree drops editor
  const [newDropItemId, setNewDropItemId] = useState('');
  const [newDropMin, setNewDropMin] = useState(1);
  const [newDropMax, setNewDropMax] = useState(1);
  const [newDropChance, setNewDropChance] = useState(100);

  // JSON Import/Export states
  const [biomeImportMode, setBiomeImportMode] = useState<JsonImportMode>('addOnly');
  const [treeImportMode, setTreeImportMode] = useState<JsonImportMode>('addOnly');
  const biomeImportFileRef = useRef<HTMLInputElement>(null);
  const treeImportFileRef = useRef<HTMLInputElement>(null);
  const [pendingBiomeImport, setPendingBiomeImport] = useState<PendingImportPreview<BiomeDefinition> | null>(null);
  const [pendingTreeImport, setPendingTreeImport] = useState<PendingImportPreview<TreeDefinition> | null>(null);

  // Quick Create Tree Modal state
  const [showCreateTreeModal, setShowCreateTreeModal] = useState(false);
  const [modalTree, setModalTree] = useState<TreeDefinition>(emptyTree());
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);

  // Load datasets from backend
  async function refresh() {
    try {
      const [nextBiomes, nextTrees, nextItems, nextLootTables, images] = await Promise.all([
        getContentCollection<BiomeDefinition>('biomes'),
        getContentCollection<TreeDefinition>('trees'),
        getContentCollection<AdminItem>('items'),
        lootTablesService.getAll(),
        loadRuntimeImages().catch(() => []),
      ]);
      setBiomes(nextBiomes || []);
      setTrees(nextTrees || []);
      setItems(nextItems || []);
      setLootTables(nextLootTables || []);
      setRuntimeImages(images);
    } catch (err) {
      console.error('Failed to load datasets:', err);
      setStatus('Ошибка загрузки данных');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Synchronize initial selection on path entry or updates
  useEffect(() => {
    if (initialTab !== activeMainTab) {
      setActiveMainTab(initialTab);
    }
  }, [initialTab]);

  // ==========================================
  // BIOMES CATALOG SELECTORS & HELPERS
  // ==========================================
  const visibleBiomes = useMemo(() => {
    const q = biomeQuery.trim().toLowerCase();
    return biomes.filter(b => {
      const matchQuery = !q || b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q);
      return matchQuery;
    });
  }, [biomes, biomeQuery]);

  function handleSelectBiome(biome: BiomeDefinition) {
    setSelectedBiomeId(biome.id);
    const forestPool = biome.resourcePools?.forest?.length 
      ? biome.resourcePools.forest 
      : (biome.defaultTreePool || []);

    setDraftBiome({
      ...emptyBiome(),
      ...biome,
      waterTypes: biome.waterTypes || [],
      defaultTreePool: biome.defaultTreePool || [],
      allowedResourceKinds: (biome.allowedResourceKinds || []).filter(k => k !== 'ore'),
      resourcePools: {
        forest: forestPool,
        herb: biome.resourcePools?.herb || [],
        hunting: biome.resourcePools?.hunting || [],
        fishing: biome.resourcePools?.fishing || [],
        monster: biome.resourcePools?.monster || [],
        event: biome.resourcePools?.event || [],
      }
    });
  }

  function handleCreateNewBiome() {
    setSelectedBiomeId(null);
    setDraftBiome(emptyBiome());
    setActiveBiomeSubTab('general');
  }

  function patchBiome(next: Partial<BiomeDefinition>) {
    setDraftBiome(current => ({ ...current, ...next }));
  }

  function patchBiomePool(kind: keyof NonNullable<BiomeDefinition['resourcePools']>, list: string[]) {
    setDraftBiome(current => {
      const nextPools = {
        ...emptyBiome().resourcePools,
        ...current.resourcePools,
        [kind]: list
      };
      const defaultTreePool = kind === 'forest' ? list : (current.defaultTreePool || []);
      return {
        ...current,
        resourcePools: nextPools,
        defaultTreePool
      };
    });
  }

  function toggleTreeInBiomePool(treeId: string) {
    const pool = draftBiome.resourcePools?.forest || [];
    const nextPool = pool.includes(treeId)
      ? pool.filter(id => id !== treeId)
      : [...pool, treeId];
    patchBiomePool('forest', nextPool);
  }

  function toggleBiomeResourceKind(kind: typeof RESOURCE_KINDS[number]) {
    const kinds = draftBiome.allowedResourceKinds || [];
    const nextKinds = kinds.includes(kind)
      ? kinds.filter(k => k !== kind)
      : [...kinds, kind];
    patchBiome({ allowedResourceKinds: nextKinds });
  }

  function toggleBiomeWaterType(type: typeof WATER_TYPES[number]) {
    const types = draftBiome.waterTypes || [];
    const nextTypes = types.includes(type)
      ? types.filter(t => t !== type)
      : [...types, type];
    patchBiome({ waterTypes: nextTypes as any });
  }

  function addPoolItem(kind: keyof NonNullable<BiomeDefinition['resourcePools']>) {
    const text = newPoolItemText.trim();
    if (!text) return;
    const pool = draftBiome.resourcePools?.[kind] || [];
    if (pool.includes(text)) {
      alert('Этот ID уже добавлен.');
      return;
    }
    patchBiomePool(kind, [...pool, text]);
    setNewPoolItemText('');
  }

  function removePoolItem(kind: keyof NonNullable<BiomeDefinition['resourcePools']>, id: string) {
    const pool = draftBiome.resourcePools?.[kind] || [];
    patchBiomePool(kind, pool.filter(item => item !== id));
  }

  async function handleSaveBiome() {
    if (isSaving) return;
    const cleanId = draftBiome.id.trim();
    if (!cleanId) {
      setStatus('Ошибка: ID биома не может быть пустым');
      return;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: cleanId,
      onSave: async () => {
        const payload: BiomeDefinition = {
          ...draftBiome,
          id: cleanId,
          name: draftBiome.name.trim() || cleanId,
          allowedResourceKinds: (draftBiome.allowedResourceKinds || []).filter(k => k !== 'ore'),
        };

        if (selectedBiomeId && selectedBiomeId !== cleanId) {
          await deleteContentEntry('biomes', selectedBiomeId);
          return createContentEntry('biomes', payload);
        } else if (biomes.some(b => b.id === cleanId)) {
          return updateContentEntry('biomes', cleanId, payload);
        } else {
          return createContentEntry('biomes', payload);
        }
      },
      onAfterSave: async (entry) => {
        const verified = await getContentEntry<BiomeDefinition>('biomes', entry.id);
        if (!verified) throw new Error('Запись не найдена на бэкенде после сохранения.');
      },
      successLabel: (entry) => `Биом сохранен: ${entry.id}`,
    });

    if (saved) {
      setSelectedBiomeId(saved.id);
      setDraftBiome(saved);
      await refresh();
      setStatus(`Биом сохранен: ${saved.id}`);
    }
    setIsSaving(false);
  }

  async function handleRemoveBiome() {
    if (!selectedBiomeId) return;
    if (!window.confirm(`Вы уверены, что хотите удалить биом ${selectedBiomeId}?`)) return;

    try {
      await deleteContentEntry('biomes', selectedBiomeId);
      setSelectedBiomeId(null);
      setDraftBiome(emptyBiome());
      await refresh();
      setStatus(`Биом удален: ${selectedBiomeId}`);
    } catch (err) {
      console.error(err);
      setStatus('Ошибка удаления биома');
    }
  }

  // ==========================================
  // TREES CATALOG SELECTORS, FILTERS & HELPERS
  // ==========================================
  const treeRegions = useMemo(() => {
    const list = new Set<string>();
    trees.forEach(t => { if (t.region) list.add(t.region); });
    biomes.forEach(b => { if (b.region) list.add(b.region); });
    return Array.from(list).sort();
  }, [trees, biomes]);

  const visibleTrees = useMemo(() => {
    const q = treeQuery.trim().toLowerCase();
    return trees.filter(t => {
      const matchQuery = !q || t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
      const matchRegion = treeFilterRegion === 'all' || t.region === treeFilterRegion;
      const matchRarity = treeFilterRarity === 'all' || t.rarity === treeFilterRarity;
      const matchTier = treeFilterTier === 'all' || String(t.tier) === treeFilterTier;
      const matchEnabled = treeFilterEnabled === 'all' 
        ? true 
        : treeFilterEnabled === 'enabled' 
          ? t.enabled !== false 
          : t.enabled === false;

      return matchQuery && matchRegion && matchRarity && matchTier && matchEnabled;
    });
  }, [trees, treeQuery, treeFilterRegion, treeFilterRarity, treeFilterTier, treeFilterEnabled]);

  function handleSelectTree(tree: TreeDefinition) {
    setSelectedTreeId(tree.id);
    setDraftTree({
      ...emptyTree(),
      ...tree,
      biomeIds: tree.biomeIds || [],
      drops: tree.drops || [],
      woodProfile: tree.woodProfile ?? createEmptyTreeWoodProfile(),
      sourceMaterialIds: tree.sourceMaterialIds ?? [],
    });

    // Bidirectional list: find all biomes currently containing this tree
    const matchingBiomes = biomes
      .filter(b => b.resourcePools?.forest?.includes(tree.id) || b.defaultTreePool?.includes(tree.id))
      .map(b => b.id);
    setDraftTreeBiomeIds(matchingBiomes);
  }

  function handleCreateNewTree() {
    setSelectedTreeId(null);
    setDraftTree(emptyTree());
    setDraftTreeBiomeIds([]);
    setActiveTreeSubTab('general');
  }

  function patchTree(next: Partial<TreeDefinition>) {
    setDraftTree(current => ({ ...current, ...next }));
  }

  function toggleBiomeInTreeDraft(biomeId: string) {
    setDraftTreeBiomeIds(current => 
      current.includes(biomeId) ? current.filter(id => id !== biomeId) : [...current, biomeId]
    );
  }

  function addTreeDrop() {
    if (!newDropItemId) {
      alert('Выберите предмет для дропа');
      return;
    }
    const currentDrops = draftTree.drops || [];
    if (currentDrops.some(d => d.itemId === newDropItemId)) {
      alert('Этот предмет уже добавлен.');
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
    patchTree({ drops: nextDrops });
    setNewDropItemId('');
  }

  function removeTreeDrop(itemId: string) {
    const nextDrops = (draftTree.drops || []).filter(d => d.itemId !== itemId);
    patchTree({ drops: nextDrops });
  }

  async function handleSaveTree() {
    if (isSaving) return;
    const cleanId = draftTree.id.trim();
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
          ...draftTree,
          id: cleanId,
          name: draftTree.name.trim() || cleanId,
          biomeIds: draftTreeBiomeIds, // save standard list of associated biomes
          woodProfile: draftTree.woodProfile ?? createEmptyTreeWoodProfile(),
          sourceMaterialIds: draftTree.sourceMaterialIds ?? [],
        };

        // 1. Save/Update tree registry
        let result: TreeDefinition;
        if (selectedTreeId && selectedTreeId !== cleanId) {
          await deleteContentEntry('trees', selectedTreeId);
          result = await createContentEntry('trees', payload);
        } else if (trees.some(t => t.id === cleanId)) {
          result = await updateContentEntry('trees', cleanId, payload);
        } else {
          result = await createContentEntry('trees', payload);
        }

        // 2. Perform bidirectional sync with all biomes
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
      setSelectedTreeId(saved.id);
      setDraftTree(saved);
      await refresh();
      setStatus(`Дерево сохранено: ${saved.id}`);
    }
    setIsSaving(false);
  }

  async function handleRemoveTree() {
    if (!selectedTreeId) return;
    if (!window.confirm(`Вы уверены, что хотите удалить дерево ${selectedTreeId}?`)) return;

    try {
      await deleteContentEntry('trees', selectedTreeId);
      setSelectedTreeId(null);
      setDraftTree(emptyTree());
      setDraftTreeBiomeIds([]);
      await refresh();
      setStatus(`Дерево удалено: ${selectedTreeId}`);
    } catch (err) {
      console.error(err);
      setStatus('Ошибка удаления дерева');
    }
  }

  // ==========================================
  // QUICK CREATE TREE MODAL ACTIONS
  // ==========================================
  function handleOpenCreateTreeModal() {
    setModalTree({
      ...emptyTree(),
      region: draftBiome.region || '',
    });
    setShowCreateTreeModal(true);
  }

  async function handleConfirmCreateTree(addToBiome: boolean) {
    const cleanId = modalTree.id.trim();
    if (!cleanId) {
      alert('ID дерева обязателен.');
      return;
    }
    if (trees.some(t => t.id === cleanId)) {
      alert('Дерево с таким ID уже существует в реестре.');
      return;
    }

    try {
      const payload: TreeDefinition = {
        ...modalTree,
        id: cleanId,
        name: modalTree.name.trim() || cleanId,
        biomeIds: addToBiome ? [draftBiome.id] : [],
      };

      // Create tree registry entry
      await createContentEntry('trees', payload);
      
      // Update local view
      if (addToBiome) {
        const currentPool = draftBiome.resourcePools?.forest || [];
        patchBiomePool('forest', [...currentPool, cleanId]);
      }

      await refresh();
      setShowCreateTreeModal(false);
      setStatus(`Создано новое дерево: ${cleanId}`);
    } catch (err) {
      console.error(err);
      alert('Не удалось создать дерево.');
    }
  }

  // ==========================================
  // EXPORT / IMPORT LOGIC
  // ==========================================
  function handleExportBiomesAll() {
    downloadCollectionJson({
      filePrefix: 'theend_biomes',
      collectionKey: 'biomes',
      entries: biomes,
    });
    setStatus(`Экспортировано ${biomes.length} биомов.`);
  }

  function handleExportBiomesSelected() {
    if (!selectedBiomeId) return;
    downloadCollectionJson({
      filePrefix: `theend_biome_${selectedBiomeId}`,
      collectionKey: 'biomes',
      entries: [draftBiome],
    });
    setStatus(`Экспортирован биом: ${selectedBiomeId}`);
  }

  function handleExportTreesAll() {
    downloadCollectionJson({
      filePrefix: 'theend_trees',
      collectionKey: 'trees',
      entries: trees,
    });
    setStatus(`Экспортировано ${trees.length} деревьев.`);
  }

  function handleExportTreesSelected() {
    if (!selectedTreeId) return;
    downloadCollectionJson({
      filePrefix: `theend_tree_${selectedTreeId}`,
      collectionKey: 'trees',
      entries: [draftTree],
    });
    setStatus(`Экспортировано дерево: ${selectedTreeId}`);
  }

  function buildImportPreview<T extends { id: string }>(params: {
    fileName: string;
    mode: JsonImportMode;
    entries: T[];
    existingIds: string[];
    replaceWarningCount: number;
    normalize: (value: T) => T;
    validate: (value: T) => string[];
  }): PendingImportPreview<T> {
    const existing = new Set(params.existingIds);
    const seen = new Set<string>();
    const errors: string[] = [];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const normalizedEntries: T[] = [];

    for (const raw of params.entries) {
      const id = String(raw.id ?? '').trim();
      if (!id) {
        errors.push('У записи нет строкового id.');
        continue;
      }
      if (seen.has(id)) {
        errors.push(`Повторяющийся id внутри файла: ${id}.`);
        continue;
      }
      seen.add(id);
      const candidate = params.normalize({ ...raw, id } as T);
      const validationErrors = params.validate(candidate);
      if (validationErrors.length > 0) {
        errors.push(`${id}: ${validationErrors.join(', ')}`);
        continue;
      }
      normalizedEntries.push(candidate);
      if (existing.has(id)) {
        if (params.mode === 'addOnly') skippedCount += 1;
        else updatedCount += 1;
      } else {
        createdCount += 1;
      }
    }

    return {
      fileName: params.fileName,
      mode: params.mode,
      totalFound: params.entries.length,
      createdCount,
      updatedCount,
      skippedCount,
      replaceWarningCount: params.replaceWarningCount,
      firstIds: normalizedEntries.slice(0, 10).map((entry) => entry.id),
      errors,
      entries: normalizedEntries,
    };
  }

  function clearBiomeImportPreview() {
    setPendingBiomeImport(null);
  }

  function clearTreeImportPreview() {
    setPendingTreeImport(null);
  }

  async function handleImportBiomes(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clearBiomeImportPreview();
    setStatus('Подготовка preview импорта биомов...');
    try {
      const parsed = JSON.parse(await file.text());
      const entries = extractRawCollectionFromImportJson(parsed, 'biomes');
      if (!Array.isArray(entries)) {
        throw new Error('В файле не найдена коллекция biomes');
      }
      const existing = await getContentCollection<BiomeDefinition>('biomes');
      const normalizeBiome = (v: BiomeDefinition) => {
        const norm = { ...emptyBiome(), ...v, id: v.id.trim() };
        norm.allowedResourceKinds = (norm.allowedResourceKinds || []).filter(k => k !== 'ore');
        return norm;
      };
      const preview = buildImportPreview<BiomeDefinition>({
        fileName: file.name,
        mode: biomeImportMode,
        entries: entries as BiomeDefinition[],
        existingIds: existing.map((item) => item.id),
        replaceWarningCount: biomeImportMode === 'replaceAll' ? existing.length : 0,
        normalize: normalizeBiome,
        validate: (b) => (!b.id ? ['ID биома обязателен.'] : []),
      });
      setPendingBiomeImport(preview);
      setStatus('Preview импорта биомов готов. Подтвердите импорт.');
    } catch (err) {
      console.error(err);
      const message = (err as Error).message.includes('Ожидался массив записей')
        ? 'В файле не найдена коллекция biomes'
        : `Ошибка импорта биомов: ${(err as Error).message}`;
      setPendingBiomeImport({
        fileName: file.name,
        mode: biomeImportMode,
        totalFound: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        replaceWarningCount: 0,
        firstIds: [],
        errors: [message],
        entries: [],
      });
      setStatus(message);
    }
  }

  async function handleImportTrees(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clearTreeImportPreview();
    setStatus('Подготовка preview импорта деревьев...');
    try {
      const parsed = JSON.parse(await file.text());
      const entries = extractRawCollectionFromImportJson(parsed, 'trees');
      if (!Array.isArray(entries)) {
        throw new Error('В файле не найдена коллекция trees');
      }
      const existing = await getContentCollection<TreeDefinition>('trees');
      const preview = buildImportPreview<TreeDefinition>({
        fileName: file.name,
        mode: treeImportMode,
        entries: entries as TreeDefinition[],
        existingIds: existing.map((item) => item.id),
        replaceWarningCount: treeImportMode === 'replaceAll' ? existing.length : 0,
        normalize: (v) => ({ ...emptyTree(), ...v, id: v.id.trim() }),
        validate: (t) => (!t.id ? ['ID дерева обязателен.'] : []),
      });
      setPendingTreeImport(preview);
      setStatus('Preview импорта деревьев готов. Подтвердите импорт.');
    } catch (err) {
      console.error(err);
      const message = (err as Error).message.includes('Ожидался массив записей')
        ? 'В файле не найдена коллекция trees'
        : `Ошибка импорта деревьев: ${(err as Error).message}`;
      setPendingTreeImport({
        fileName: file.name,
        mode: treeImportMode,
        totalFound: 0,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        replaceWarningCount: 0,
        firstIds: [],
        errors: [message],
        entries: [],
      });
      setStatus(message);
    }
  }

  async function confirmBiomeImport() {
    if (!pendingBiomeImport) return;
    if (pendingBiomeImport.mode === 'replaceAll') {
      if (!window.confirm('Вы уверены? Это заменит все текущие записи.')) return;
    }
    setIsSaving(true);
    setStatus('Импорт биомов...');
    try {
      const result = await importCollectionFromJsonEntries<BiomeDefinition>({
        entries: pendingBiomeImport.entries,
        defaults: emptyBiome,
        normalize: (v) => {
          const norm = { ...emptyBiome(), ...v, id: v.id.trim() };
          norm.allowedResourceKinds = (norm.allowedResourceKinds || []).filter(k => k !== 'ore');
          return norm;
        },
        validate: (b) => (!b.id ? ['ID биома обязателен.'] : []),
        getAll: () => getContentCollection<BiomeDefinition>('biomes'),
        create: (v) => createContentEntry('biomes', v),
        update: (id, v) => updateContentEntry('biomes', id, v),
        delete: (id) => deleteContentEntry('biomes', id),
        mode: pendingBiomeImport.mode,
      });
      await refresh();
      setStatus(`Импорт завершён: добавлено ${result.created.length}, обновлено ${result.updated.length}, пропущено ${result.skippedExisting.length}.`);
      clearBiomeImportPreview();
    } catch (err) {
      console.error(err);
      setStatus(`Ошибка импорта биомов: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmTreeImport() {
    if (!pendingTreeImport) return;
    if (pendingTreeImport.mode === 'replaceAll') {
      if (!window.confirm('Вы уверены? Это заменит все текущие записи.')) return;
    }
    setIsSaving(true);
    setStatus('Импорт деревьев...');
    try {
      const result = await importCollectionFromJsonEntries<TreeDefinition>({
        entries: pendingTreeImport.entries,
        defaults: emptyTree,
        normalize: (v) => ({ ...emptyTree(), ...v, id: v.id.trim() }),
        validate: (t) => (!t.id ? ['ID дерева обязателен.'] : []),
        getAll: () => getContentCollection<TreeDefinition>('trees'),
        create: (v) => createContentEntry('trees', v),
        update: (id, v) => updateContentEntry('trees', id, v),
        delete: (id) => deleteContentEntry('trees', id),
        mode: pendingTreeImport.mode,
      });
      await refresh();
      setStatus(`Импорт завершён: добавлено ${result.created.length}, обновлено ${result.updated.length}, пропущено ${result.skippedExisting.length}.`);
      clearTreeImportPreview();
    } catch (err) {
      console.error(err);
      setStatus(`Ошибка импорта деревьев: ${(err as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  }

  // ==========================================
  // LOOT TABLE MANAGEMENT
  // ==========================================
  const treeLootTable = useMemo(() => {
    if (!selectedTreeId) return null;
    return lootTables.find(lt => lt.sourceType === 'tree' && lt.sourceId === selectedTreeId);
  }, [lootTables, selectedTreeId]);

  async function handleCreateLootTableForTree() {
    if (!selectedTreeId) return;
    const cleanId = draftTree.id;
    const lootTableId = `loot_tree_${cleanId}`;
    try {
      const newLootTable = {
        id: lootTableId,
        name: `Добыча с дерева: ${draftTree.name}`,
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
    enabled: activeMainTab === 'biomes' || activeMainTab === 'trees',
    isSaving,
    onSave: activeMainTab === 'biomes' ? handleSaveBiome : handleSaveTree,
  });

  return (
    <div className="living-world-page">
      
      {/* Main Tab Navigation Header */}
      <div className="living-world-header">
        <h2 className="living-world-title">🌍 Живой мир</h2>
      </div>

      <div className="living-tabs-container">
        {([
          { key: 'biomes', label: 'Биомы' },
          { key: 'trees', label: 'Деревья' },
          { key: 'plants', label: 'Растения' },
          { key: 'animals', label: 'Животные' },
          { key: 'fish', label: 'Рыба' },
          { key: 'monsters', label: 'Монстры' },
          { key: 'events', label: 'События' },
          { key: 'import_export', label: 'Импорт / Экспорт' }
        ] as const).map(tab => {
          const isActive = activeMainTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={`living-tab-btn ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveMainTab(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Page Content Workspace */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        
        {/* Placeholder tab views */}
        {activeMainTab === 'plants' && (
          <div className="card" style={{ padding: '3rem', width: '100%', textAlign: 'center' }}>
            <h4 style={{ color: 'var(--accent)' }}>🌿 Справочник растений</h4>
            <p className="muted" style={{ marginTop: '0.8rem', fontSize: '0.95rem' }}>
              Раздел подготовлен для будущей системы. Справочник растений будет подключён позже при интеграции профессии Травник.
            </p>
          </div>
        )}

        {activeMainTab === 'animals' && (
          <div className="card" style={{ padding: '3rem', width: '100%', textAlign: 'center' }}>
            <h4 style={{ color: 'var(--accent)' }}>🐾 Справочник животных</h4>
            <p className="muted" style={{ marginTop: '0.8rem', fontSize: '0.95rem' }}>
              Раздел подготовлен для будущей системы. Справочник диких зверей будет добавлен в будущих фазах.
            </p>
          </div>
        )}

        {activeMainTab === 'fish' && (
          <div className="card" style={{ padding: '3rem', width: '100%', textAlign: 'center' }}>
            <h4 style={{ color: 'var(--accent)' }}>🐟 Справочник рыб</h4>
            <p className="muted" style={{ marginTop: '0.8rem', fontSize: '0.95rem' }}>
              Раздел подготовлен для будущей системы. База данных водных ресурсов будет расширена позже.
            </p>
          </div>
        )}

        {activeMainTab === 'monsters' && (
          <div className="card" style={{ padding: '3rem', width: '100%', textAlign: 'center' }}>
            <h4 style={{ color: 'var(--accent)' }}>👹 Справочник монстров</h4>
            <p className="muted" style={{ marginTop: '0.8rem', fontSize: '0.95rem' }}>
              Раздел подготовлен для будущей системы. Настройки экологических спавнов чудовищ появятся в следующих обновлениях.
            </p>
          </div>
        )}

        {activeMainTab === 'events' && (
          <div className="card" style={{ padding: '3rem', width: '100%', textAlign: 'center' }}>
            <h4 style={{ color: 'var(--accent)' }}>📅 Справочник событий</h4>
            <p className="muted" style={{ marginTop: '0.8rem', fontSize: '0.95rem' }}>
              Раздел подготовлен для будущей системы. События живого мира появятся в следующих обновлениях.
            </p>
          </div>
        )}

        {activeMainTab === 'biomes' && (
          <div className="living-editor-grid">
            
            {/* Left list catalog with search */}
            <section className="catalog-sidebar">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Природные зоны</h4>
                <span className="premium-badge">{visibleBiomes.length} / {biomes.length}</span>
              </div>

              <input
                className="catalog-search-input"
                placeholder="Поиск по названию/ID..."
                value={biomeQuery}
                onChange={(e) => setBiomeQuery(e.target.value)}
              />

              <div className="catalog-scrollable-list">
                {visibleBiomes.map((biome) => {
                  const isSelected = selectedBiomeId === biome.id;
                  return (
                    <button
                      key={biome.id}
                      type="button"
                      className={`catalog-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectBiome(biome)}
                    >
                      <strong style={{ fontSize: '0.95rem', display: 'block' }}>{biome.name}</strong>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="action-btn-lw secondary"
                style={{ width: '100%', marginTop: 'auto', borderStyle: 'dashed' }}
                onClick={handleCreateNewBiome}
              >
                + Новый биом
              </button>
            </section>

            {/* Right editor panel */}
            <section className="editor-workspace">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent)' }}>
                  {selectedBiomeId ? `Биом: ${draftBiome.name}` : 'Создание биома'}
                </h4>
                {selectedBiomeId && (
                  <span className="muted" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                    ID: {selectedBiomeId}
                  </span>
                )}
              </div>

              {/* Sub tabs navigation */}
              <div className="sub-tabs-container">
                {(['general', 'resources', 'trees', 'plants', 'animals', 'fish', 'monsters', 'events', 'json'] as const).map(tab => {
                  const isActive = activeBiomeSubTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      className={`sub-tab-btn ${isActive ? 'is-active' : ''}`}
                      onClick={() => setActiveBiomeSubTab(tab)}
                    >
                      {tab === 'general' ? 'Общее' :
                       tab === 'resources' ? 'Ресурсы' :
                       tab === 'trees' ? 'Деревья' :
                       tab === 'plants' ? 'Растения' :
                       tab === 'animals' ? 'Животные' :
                       tab === 'fish' ? 'Рыба / Водоёмы' :
                       tab === 'monsters' ? 'Монстры' :
                       tab === 'events' ? 'События' : 'JSON'}
                    </button>
                  );
                })}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '1rem' }} className="custom-scroll">
                
                {/* Sub-tab 1: GENERAL */}
                {activeBiomeSubTab === 'general' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-grid-premium">
                      <div className="field-group">
                        <AdminFieldLabel label="ID биома" hint="Системный идентификатор биома (например: biome_forest_temperate)" />
                        <input value={draftBiome.id} onChange={(e) => patchBiome({ id: e.target.value })} disabled={selectedBiomeId !== null} />
                      </div>
                      <div className="field-group">
                        <AdminFieldLabel label="Название биома" hint="Человекочитаемое название в игре" />
                        <input value={draftBiome.name} onChange={(e) => patchBiome({ name: e.target.value })} />
                      </div>
                      <div className="field-group">
                        <AdminFieldLabel label="Регион мира" hint="К какому региону привязан этот биом" />
                        <input value={draftBiome.region} onChange={(e) => patchBiome({ region: e.target.value })} />
                      </div>
                      <div className="field-group">
                        <AdminFieldLabel label="Климат" hint="Климатические условия" />
                        <input value={draftBiome.climate} onChange={(e) => patchBiome({ climate: e.target.value })} />
                      </div>
                      <div className="field-group">
                        <AdminFieldLabel label="Уровень опасности (Danger Level)" hint="Влияет на сложность монстров и качество дропа" />
                        <input type="number" value={draftBiome.dangerLevel} onChange={(e) => patchBiome({ dangerLevel: parseInt(e.target.value, 10) || 1 })} />
                      </div>
                      <div className="field-group" style={{ justifyContent: 'center' }}>
                        <label className="zone-editor-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '1.25rem' }}>
                          <input type="checkbox" checked={draftBiome.enabled !== false} onChange={(e) => patchBiome({ enabled: e.target.checked })} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Биом активен в игре</span>
                        </label>
                      </div>
                    </div>

                    <div className="card" style={{ padding: '1.25rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(169, 139, 87, 0.35)' }}>
                      <label className="zone-editor-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: '0.8rem' }}>
                        <input type="checkbox" checked={draftBiome.hasWater} onChange={(e) => patchBiome({ hasWater: e.target.checked, waterTypes: e.target.checked ? draftBiome.waterTypes : [] })} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--accent)' }}>Наличие водоемов (hasWater)</span>
                      </label>

                      {draftBiome.hasWater && (
                        <div style={{ marginTop: '0.8rem', borderTop: '1px solid rgba(169, 139, 87, 0.15)', paddingTop: '0.8rem' }}>
                          <span className="muted" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.4rem', fontWeight: 600 }}>Разрешенные типы воды:</span>
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            {WATER_TYPES.map(type => (
                              <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                <input type="checkbox" checked={draftBiome.waterTypes?.includes(type as any)} onChange={() => toggleBiomeWaterType(type)} />
                                <span style={{ textTransform: 'capitalize' }}>{type}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="field-group">
                      <AdminFieldLabel label="Описание биома" hint="Художественное описание природной зоны" />
                      <textarea rows={4} value={draftBiome.description || ''} onChange={(e) => patchBiome({ description: e.target.value })} />
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: RESOURCES */}
                {activeBiomeSubTab === 'resources' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <AdminFieldLabel label="Разрешенные виды ресурсов" hint="Виды деятельности и активности, доступные в биоме" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(0, 0, 0, 0.15)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                      {RESOURCE_KINDS.map(kind => (
                        <label key={kind} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.01)' }}>
                          <input
                            type="checkbox"
                            checked={draftBiome.allowedResourceKinds?.includes(kind as any)}
                            onChange={() => toggleBiomeResourceKind(kind)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                          />
                          <div>
                            <span style={{ fontWeight: 'bold', color: 'var(--accent)', textTransform: 'uppercase', fontSize: '0.85rem' }}>{kind}</span>
                            <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>
                              {kind === 'forest' ? 'Рубка деревьев и сбор древесины (Справочник Деревьев / Плотник)' :
                               kind === 'herb' ? 'Сбор алхимических растений (Справочник Растений / Травник)' :
                               kind === 'hunting' ? 'Охота на зверей и монстров (Справочник Животных / Охотник)' :
                               kind === 'fishing' ? 'Рыбная ловля в водоёмах (Справочник Рыбы / Рыбак)' :
                               kind === 'monster' ? 'Спавн враждебных монстров и случайные засады' :
                               'Случайные дорожные события живого мира'}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-tab 3: TREES inside Biome */}
                {activeBiomeSubTab === 'trees' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--accent)' }}>Деревья в этом биоме (resourcePools.forest)</span>
                        <div className="muted" style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>Отметьте деревья для заселения биома.</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" onClick={handleOpenCreateTreeModal} className="action-btn-lw primary">
                          + Создать дерево
                        </button>
                        <button type="button" onClick={() => setActiveMainTab('trees')} className="action-btn-lw secondary">
                          Реестр деревьев
                        </button>
                      </div>
                    </div>

                    <div className="trees-checkbox-grid">
                      {trees.map(tree => {
                        const isChecked = (draftBiome.resourcePools?.forest || []).includes(tree.id);
                        return (
                          <div key={tree.id} className={`tree-checkbox-card ${isChecked ? 'is-active' : ''}`}>
                            <label>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleTreeInBiomePool(tree.id)}
                              />
                              <div>
                                <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{tree.name}</span>
                                <div className="muted" style={{ fontSize: '0.75rem', marginTop: '0.1rem' }}>
                                  Tier {tree.tier} | HP {tree.hp}
                                </div>
                              </div>
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectTree(tree);
                                setActiveMainTab('trees');
                              }}
                              style={{ padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', cursor: 'pointer', border: '1px solid rgba(169,139,87,0.3)' }}
                              title="Редактировать параметры дерева в реестре"
                            >
                              ✏️
                            </button>
                          </div>
                        );
                      })}
                      {trees.length === 0 && (
                        <span className="muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
                          В реестре нет деревьев. Создайте их кнопкой выше.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-tab 4: PLANTS inside Biome */}
                {activeBiomeSubTab === 'plants' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="lw-alert info">
                      <span>🌿 Раздел подготовлен для профессии Травник. Справочник растений будет подключён в следующих фазах.</span>
                    </div>

                    <div className="field-group">
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>Добавить ID растения (resourcePools.herb)</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input value={newPoolItemText} onChange={(e) => setNewPoolItemText(e.target.value)} placeholder="plant_fialaran" style={{ flex: 1 }} />
                        <button type="button" onClick={() => addPoolItem('herb')} className="action-btn-lw primary">Добавить</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minHeight: '120px', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(169,139,87,0.15)' }}>
                      {(draftBiome.resourcePools?.herb || []).map(id => (
                        <span key={id} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.65rem', background: 'rgba(210,170,102,0.1)', border: '1px solid rgba(210,170,102,0.3)' }}>
                          <strong>{id}</strong>
                          <button type="button" onClick={() => removePoolItem('herb', id)} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                        </span>
                      ))}
                      {(draftBiome.resourcePools?.herb || []).length === 0 && <span className="muted" style={{ margin: 'auto' }}>Список растений пуст.</span>}
                    </div>
                  </div>
                )}

                {/* Sub-tab 5: ANIMALS inside Biome */}
                {activeBiomeSubTab === 'animals' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="field-group">
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>Добавить ID дикого зверя (resourcePools.hunting)</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input value={newPoolItemText} onChange={(e) => setNewPoolItemText(e.target.value)} placeholder="beast_forest_wolf" style={{ flex: 1 }} />
                        <button type="button" onClick={() => addPoolItem('hunting')} className="action-btn-lw primary">Добавить</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minHeight: '120px', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(169,139,87,0.15)' }}>
                      {(draftBiome.resourcePools?.hunting || []).map(id => (
                        <span key={id} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.65rem', background: 'rgba(210,170,102,0.1)', border: '1px solid rgba(210,170,102,0.3)' }}>
                          <strong>{id}</strong>
                          <button type="button" onClick={() => removePoolItem('hunting', id)} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                        </span>
                      ))}
                      {(draftBiome.resourcePools?.hunting || []).length === 0 && <span className="muted" style={{ margin: 'auto' }}>Список охотничьих ресурсов пуст.</span>}
                    </div>
                  </div>
                )}

                {/* Sub-tab 6: FISH inside Biome */}
                {activeBiomeSubTab === 'fish' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {!draftBiome.hasWater && (
                      <div className="lw-alert warning">
                        <span>⚠️ В этом биоме отключена вода (hasWater = false). Рыбные ресурсы не будут доступны для ловли.</span>
                      </div>
                    )}

                    <div className="field-group">
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>Добавить ID рыбы (resourcePools.fishing)</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input value={newPoolItemText} onChange={(e) => setNewPoolItemText(e.target.value)} placeholder="fish_river_common" style={{ flex: 1 }} disabled={!draftBiome.hasWater} />
                        <button type="button" onClick={() => addPoolItem('fishing')} className="action-btn-lw primary" disabled={!draftBiome.hasWater}>Добавить</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minHeight: '120px', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(169,139,87,0.15)' }}>
                      {(draftBiome.resourcePools?.fishing || []).map(id => (
                        <span key={id} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.65rem', background: 'rgba(210,170,102,0.1)', border: '1px solid rgba(210,170,102,0.3)' }}>
                          <strong>{id}</strong>
                          <button type="button" onClick={() => removePoolItem('fishing', id)} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                        </span>
                      ))}
                      {(draftBiome.resourcePools?.fishing || []).length === 0 && <span className="muted" style={{ margin: 'auto' }}>Рыбные ресурсы отсутствуют.</span>}
                    </div>
                  </div>
                )}

                {/* Sub-tab 7: MONSTERS inside Biome */}
                {activeBiomeSubTab === 'monsters' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="field-group">
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>Добавить ID спавнящегося монстра (resourcePools.monster)</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input value={newPoolItemText} onChange={(e) => setNewPoolItemText(e.target.value)} placeholder="monster_shadow_stalker" style={{ flex: 1 }} />
                        <button type="button" onClick={() => addPoolItem('monster')} className="action-btn-lw primary">Добавить</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minHeight: '120px', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(169,139,87,0.15)' }}>
                      {(draftBiome.resourcePools?.monster || []).map(id => (
                        <span key={id} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.65rem', background: 'rgba(210,170,102,0.1)', border: '1px solid rgba(210,170,102,0.3)' }}>
                          <strong>{id}</strong>
                          <button type="button" onClick={() => removePoolItem('monster', id)} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                        </span>
                      ))}
                      {(draftBiome.resourcePools?.monster || []).length === 0 && <span className="muted" style={{ margin: 'auto' }}>Список монстров пуст.</span>}
                    </div>
                  </div>
                )}

                {/* Sub-tab 8: EVENTS inside Biome */}
                {activeBiomeSubTab === 'events' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="field-group">
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>Добавить ID события мира (resourcePools.event)</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input value={newPoolItemText} onChange={(e) => setNewPoolItemText(e.target.value)} placeholder="event_fallen_tree" style={{ flex: 1 }} />
                        <button type="button" onClick={() => addPoolItem('event')} className="action-btn-lw primary">Добавить</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minHeight: '120px', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(169,139,87,0.15)' }}>
                      {(draftBiome.resourcePools?.event || []).map(id => (
                        <span key={id} className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.65rem', background: 'rgba(210,170,102,0.1)', border: '1px solid rgba(210,170,102,0.3)' }}>
                          <strong>{id}</strong>
                          <button type="button" onClick={() => removePoolItem('event', id)} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                        </span>
                      ))}
                      {(draftBiome.resourcePools?.event || []).length === 0 && <span className="muted" style={{ margin: 'auto' }}>Список событий пуст.</span>}
                    </div>
                  </div>
                )}

                {/* Sub-tab 9: JSON preview */}
                {activeBiomeSubTab === 'json' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1, minHeight: '300px' }}>
                    <AdminFieldLabel label="Исходный код биома (JSON)" hint="Только для чтения и отладки" />
                    <textarea
                      readOnly
                      rows={14}
                      value={JSON.stringify(draftBiome, null, 2)}
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
                <button type="button" className="action-btn-lw primary" onClick={handleSaveBiome} disabled={isSaving}>
                  {isSaving ? 'Сохранение...' : (selectedBiomeId ? 'Сохранить изменения' : 'Создать биом')}
                </button>
                {selectedBiomeId && (
                  <button type="button" className="action-btn-lw danger" onClick={handleRemoveBiome} style={{ marginLeft: 'auto' }}>
                    Удалить биом
                  </button>
                )}
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <AdminSaveStatus value={saveState} />
                <p className="muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}>{status}</p>
              </div>

            </section>
          </div>
        )}

        {/* 2. TREES TAB */}
        {activeMainTab === 'trees' && (
          <div className="living-editor-grid">
            
            {/* Left list catalog with search and filters */}
            <section className="catalog-sidebar">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Реестр деревьев</h4>
                <span className="premium-badge">{visibleTrees.length} / {trees.length}</span>
              </div>

              <input
                className="catalog-search-input"
                placeholder="Поиск по названию/ID..."
                value={treeQuery}
                onChange={(e) => setTreeQuery(e.target.value)}
              />

              {/* Advanced Filter Row Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(169,139,87,0.15)', paddingBottom: '0.8rem' }}>
                <label style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }} className="muted">
                  Регион:
                  <select className="filter-select" value={treeFilterRegion} onChange={(e) => setTreeFilterRegion(e.target.value)}>
                    <option value="all">Все регионы</option>
                    {treeRegions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }} className="muted">
                  Редкость:
                  <select className="filter-select" value={treeFilterRarity} onChange={(e) => setTreeFilterRarity(e.target.value)}>
                    <option value="all">Все редкости</option>
                    <option value="common">Common</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </label>
                <label style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }} className="muted">
                  Сложность (Tier):
                  <select className="filter-select" value={treeFilterTier} onChange={(e) => setTreeFilterTier(e.target.value)}>
                    <option value="all">Все типы</option>
                    <option value="1">Tier 1</option>
                    <option value="2">Tier 2</option>
                    <option value="3">Tier 3</option>
                    <option value="4">Tier 4</option>
                  </select>
                </label>
                <label style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }} className="muted">
                  Статус:
                  <select className="filter-select" value={treeFilterEnabled} onChange={(e) => setTreeFilterEnabled(e.target.value)}>
                    <option value="all">Все деревья</option>
                    <option value="enabled">Включенные</option>
                    <option value="disabled">Отключенные</option>
                  </select>
                </label>
              </div>

              {/* Scrollable List container */}
              <div className="catalog-scrollable-list">
                {visibleTrees.map((tree) => {
                  const isSelected = selectedTreeId === tree.id;
                  return (
                    <button
                      key={tree.id}
                      type="button"
                      className={`catalog-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectTree(tree)}
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
                onClick={handleCreateNewTree}
              >
                + Новое дерево
              </button>
            </section>

            {/* Right Editor Panel */}
            <section className="editor-workspace">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent)' }}>
                  {selectedTreeId ? `Дерево: ${draftTree.name}` : 'Создание дерева'}
                </h4>
                {selectedTreeId && (
                  <span className="muted" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                    ID: {selectedTreeId}
                  </span>
                )}
              </div>

              {/* Sub tabs navigation */}
              <div className="sub-tabs-container">
                {(['general', 'gameplay', 'wood', 'drops', 'biomes', 'json'] as const).map(tab => {
                  const isActive = activeTreeSubTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      className={`sub-tab-btn ${isActive ? 'is-active' : ''}`}
                      onClick={() => setActiveTreeSubTab(tab)}
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
                {activeTreeSubTab === 'general' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-grid-premium">
                      <div className="field-group">
                        <AdminFieldLabel label="ID Дерева" hint="Системный идентификатор (например: tree_pine_common)" />
                        <input value={draftTree.id} onChange={(e) => patchTree({ id: e.target.value })} disabled={selectedTreeId !== null} />
                      </div>
                      <div className="field-group">
                        <AdminFieldLabel label="Название дерева" hint="Отображаемое название в игре" />
                        <input value={draftTree.name} onChange={(e) => patchTree({ name: e.target.value })} />
                      </div>
                      <div className="field-group">
                        <AdminFieldLabel label="Регион лора" hint="К какому региону мира привязано это дерево" />
                        <input value={draftTree.region} onChange={(e) => patchTree({ region: e.target.value })} />
                      </div>
                      <div className="field-group">
                        <AdminFieldLabel label="Редкость" hint="Редкость ресурса в мире" />
                        <select value={draftTree.rarity} onChange={(e) => patchTree({ rarity: e.target.value as any })} style={{ height: '36px' }}>
                          <option value="common">Common</option>
                          <option value="uncommon">Uncommon</option>
                          <option value="rare">Rare</option>
                          <option value="epic">Epic</option>
                          <option value="legendary">Legendary</option>
                        </select>
                      </div>
                      <div className="field-group">
                        <AdminFieldLabel label="Tier дерева" hint="Грейд дерева как материала для крафта (1-4)" />
                        <input type="number" value={draftTree.tier} onChange={(e) => patchTree({ tier: parseInt(e.target.value, 10) || 1 })} />
                      </div>
                      <div className="field-group" style={{ justifyContent: 'center' }}>
                        <label className="zone-editor-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '1.25rem' }}>
                          <input type="checkbox" checked={draftTree.enabled !== false} onChange={(e) => patchTree({ enabled: e.target.checked })} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Дерево доступно для рубки</span>
                        </label>
                      </div>
                    </div>

                    <ImageSheetPicker
                      label="Изображение дерева"
                      hint="Загрузите файл: система сама сохранит его и подставит ID. Для тайлсета можно выбрать frame."
                      category="other"
                      value={draftTree.imageRef}
                      legacyImagePath={draftTree.imagePath}
                      runtimeImages={runtimeImages}
                      showUploadForImage
                      disableManualImageInput
                      uploadPresetId="tree-sprite"
                      uploadSuggestedId={draftTree.id || undefined}
                      uploadSuggestedName={`${draftTree.id || draftTree.name || 'tree'}-sprite`}
                      onStatus={setStatus}
                      onChange={(next) => patchTree({
                        imageRef: next,
                        imagePath: next ? toLegacyImagePath(next) : undefined,
                      })}
                    />

                    <div className="field-group">
                      <AdminFieldLabel label="Художественное описание" hint="Отображается игроку при осмотре" />
                      <textarea rows={4} value={draftTree.description || ''} onChange={(e) => patchTree({ description: e.target.value })} />
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: GAMEPLAY */}
                {activeTreeSubTab === 'gameplay' && (
                  <div className="form-grid-premium three-cols">
                    <div className="field-group">
                      <AdminFieldLabel label="HP дерева" hint="Общее количество здоровья дерева для срубания" />
                      <input type="number" value={draftTree.hp} onChange={(e) => patchTree({ hp: parseInt(e.target.value, 10) || 1 })} />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="Твёрдость (hardness)" hint="Поглощает урон от ударов топора" />
                      <input type="number" value={draftTree.hardness} onChange={(e) => patchTree({ hardness: parseInt(e.target.value, 10) || 0 })} />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="Стабильность" hint="Сопротивление падению ствола" />
                      <input type="number" value={draftTree.stability} onChange={(e) => patchTree({ stability: parseInt(e.target.value, 10) || 0 })} />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="Риск падения (%)" hint="Шанс травмироваться, если не отступить назад при падении" />
                      <input type="number" value={draftTree.fallRisk} onChange={(e) => patchTree({ fallRisk: parseInt(e.target.value, 10) || 0 })} />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="Требуемый навык рубки" hint="Минимальный уровень плотника" />
                      <input type="number" value={draftTree.requiredWoodcuttingTier} onChange={(e) => patchTree({ requiredWoodcuttingTier: parseInt(e.target.value, 10) || 1 })} />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="Требуемый Tier топора" hint="Минимальный грейд топора для рубки" />
                      <input type="number" value={draftTree.requiredToolTier} onChange={(e) => patchTree({ requiredToolTier: parseInt(e.target.value, 10) || 1 })} />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="Опыт за рубку (baseXp)" hint="Опыт профессии Плотника при успешном срубе" />
                      <input type="number" value={draftTree.baseXp} onChange={(e) => patchTree({ baseXp: parseInt(e.target.value, 10) || 0 })} />
                    </div>
                    <div className="field-group">
                      <AdminFieldLabel label="Вес одного бревна" hint="Вес материала в инвентаре игрока" />
                      <input type="number" value={draftTree.weight} onChange={(e) => patchTree({ weight: parseInt(e.target.value, 10) || 1 })} />
                    </div>
                  </div>
                )}

                {activeTreeSubTab === 'wood' && (
                  <TreeWoodProfileEditor
                    tree={draftTree}
                    onTreePatch={patchTree}
                    onValidationChange={setWoodValidation}
                  />
                )}

                {/* Sub-tab 3: DROPS & LOOT TABLES */}
                {activeTreeSubTab === 'drops' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Loot Table status card */}
                    <div className="card" style={{ padding: '1.25rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(169, 139, 87, 0.35)' }}>
                      <strong style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.95rem', color: 'var(--accent)' }}>Связанная таблица добычи (Loot Table):</strong>
                      
                      {treeLootTable ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            Найдена: <code style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{treeLootTable.id}</code> ({treeLootTable.name})
                          </span>
                          {onNavigate && (
                            <button type="button" className="action-btn-lw secondary" onClick={() => onNavigate('/admin/loot-tables')} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                              Редактировать Loot Table
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="muted" style={{ fontSize: '0.85rem' }}>Таблица отсутствует (будут использоваться drops ниже).</span>
                          <button type="button" className="action-btn-lw primary" onClick={handleCreateLootTableForTree} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                            Создать Loot Table
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Manual Drops List */}
                    <div className="card" style={{ padding: '1.25rem', background: 'rgba(0, 0, 0, 0.1)', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', minHeight: '220px' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--accent)' }}>Дроп по умолчанию (drops)</h5>
                      
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
                            {(draftTree.drops || []).map((drop) => {
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
                                    <button type="button" className="action-btn-lw danger" onClick={() => removeTreeDrop(drop.itemId)} style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem' }}>Удалить</button>
                                  </td>
                                </tr>
                              );
                            })}
                            {(!draftTree.drops || draftTree.drops.length === 0) && (
                              <tr>
                                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>Дроп-лист пуст. Добавьте материалы ниже.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Add Drop Panel */}
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '0.5rem', marginTop: '1.25rem', alignItems: 'end', borderTop: '1px solid rgba(169, 139, 87, 0.15)', paddingTop: '1rem' }}>
                        <div className="field-group">
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Материал</span>
                          <select value={newDropItemId} onChange={(e) => setNewDropItemId(e.target.value)} style={{ height: '34px', padding: '0.2rem' }}>
                            <option value="">-- выберите --</option>
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
                        <button type="button" onClick={addTreeDrop} className="action-btn-lw primary" style={{ height: '34px', padding: '0 0.8rem' }}>+</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab 4: BIOMES (Bidirectional list) */}
                {activeTreeSubTab === 'biomes' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                    <AdminFieldLabel label="Используется в биомах" hint="Где растет это дерево. Изменения применятся после нажатия Сохранить дерево." />
                    <div className="trees-checkbox-grid">
                      {biomes.map(biome => {
                        const isChecked = draftTreeBiomeIds.includes(biome.id);
                        return (
                          <label key={biome.id} className={`tree-checkbox-card ${isChecked ? 'is-active' : ''}`} style={{ cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleBiomeInTreeDraft(biome.id)}
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

                {/* Sub-tab 5: JSON preview */}
                {activeTreeSubTab === 'json' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1, minHeight: '300px' }}>
                    <AdminFieldLabel label="Исходный код дерева (JSON)" hint="Только для чтения и отладки" />
                    <textarea
                      readOnly
                      rows={14}
                      value={JSON.stringify(draftTree, null, 2)}
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
                <button type="button" className="action-btn-lw primary" onClick={handleSaveTree} disabled={isSaving}>
                  {isSaving ? 'Сохранение...' : (selectedTreeId ? 'Сохранить дерево' : 'Создать дерево')}
                </button>
                {selectedTreeId && (
                  <button type="button" className="action-btn-lw danger" onClick={handleRemoveTree} style={{ marginLeft: 'auto' }}>
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
        )}

        {/* 3. IMPORT / EXPORT TAB */}
        {activeMainTab === 'import_export' && (
          <div className="living-editor-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            
            {/* Biomes Import/Export Section */}
            <section className="card editor-workspace" style={{ gap: '1.25rem' }}>
              <h4 style={{ color: 'var(--accent)', fontSize: '1.2rem', borderBottom: '1px solid rgba(169,139,87,0.25)', paddingBottom: '0.5rem' }}>
                🌍 Импорт / Экспорт Биомов
              </h4>
              <p className="muted" style={{ fontSize: '0.9rem', margin: 0 }}>Управление базой данных природных зон.</p>
              
              <div style={{ borderBottom: '1px solid rgba(169,139,87,0.15)', paddingBottom: '1.25rem' }}>
                <h5 style={{ color: 'var(--text-main)', margin: '0 0 0.6rem 0' }}>Экспортировать биомы</h5>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="action-btn-lw secondary" onClick={handleExportBiomesAll}>
                    Скачать все биомы ({biomes.length})
                  </button>
                  <button type="button" className="action-btn-lw secondary" onClick={handleExportBiomesSelected} disabled={!selectedBiomeId}>
                    Скачать выбранный
                  </button>
                </div>
              </div>

              <div>
                <h5 style={{ color: 'var(--text-main)', margin: '0 0 0.6rem 0' }}>Импортировать биомы</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxWidth: '380px' }}>
                  <label style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }} className="muted">
                    Режим интеграции:
                    <select value={biomeImportMode} onChange={(e) => { setBiomeImportMode(e.target.value as JsonImportMode); clearBiomeImportPreview(); }}>
                      <option value="addOnly">Добавить только новые (Add only new)</option>
                      <option value="merge">Обновить совпадающие (Merge/update)</option>
                      <option value="replaceAll">Полная замена всей базы (Replace all) ⚠️</option>
                    </select>
                  </label>
                  <button type="button" className="action-btn-lw primary" onClick={() => biomeImportFileRef.current?.click()}>
                    Загрузить JSON файл
                  </button>
                  <input ref={biomeImportFileRef} type="file" accept="application/json,.json" onChange={handleImportBiomes} style={{ display: 'none' }} />
                </div>
                {pendingBiomeImport && (
                  <div className="card" style={{ marginTop: '0.8rem', padding: '0.8rem' }}>
                    <strong>Preview импорта биомов</strong>
                    <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                      Файл: {pendingBiomeImport.fileName}
                    </div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      Найдено: {pendingBiomeImport.totalFound}, добавить: {pendingBiomeImport.createdCount}, обновить: {pendingBiomeImport.updatedCount}, пропустить: {pendingBiomeImport.skippedCount}
                    </div>
                    {pendingBiomeImport.mode === 'replaceAll' && (
                      <div style={{ color: '#ffb366', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                        Внимание: будет заменено текущих записей: {pendingBiomeImport.replaceWarningCount}
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
                      Первые ID: {pendingBiomeImport.firstIds.length > 0 ? pendingBiomeImport.firstIds.join(', ') : '—'}
                    </div>
                    {pendingBiomeImport.errors.length > 0 && (
                      <div style={{ marginTop: '0.35rem' }}>
                        {pendingBiomeImport.errors.map((error, index) => (
                          <div key={`${error}-${index}`} style={{ color: '#ff8080', fontSize: '0.82rem' }}>{error}</div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
                      <button
                        type="button"
                        className="action-btn-lw primary"
                        onClick={confirmBiomeImport}
                        disabled={pendingBiomeImport.errors.length > 0 || isSaving}
                      >
                        Подтвердить импорт
                      </button>
                      <button type="button" className="action-btn-lw secondary" onClick={clearBiomeImportPreview}>
                        Отменить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Trees Import/Export Section */}
            <section className="card editor-workspace" style={{ gap: '1.25rem' }}>
              <h4 style={{ color: 'var(--accent)', fontSize: '1.2rem', borderBottom: '1px solid rgba(169,139,87,0.25)', paddingBottom: '0.5rem' }}>
                🌲 Импорт / Экспорт Деревьев
              </h4>
              <p className="muted" style={{ fontSize: '0.9rem', margin: 0 }}>Управление реестром пород деревьев.</p>
              
              <div style={{ borderBottom: '1px solid rgba(169,139,87,0.15)', paddingBottom: '1.25rem' }}>
                <h5 style={{ color: 'var(--text-main)', margin: '0 0 0.6rem 0' }}>Экспортировать деревья</h5>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="action-btn-lw secondary" onClick={handleExportTreesAll}>
                    Скачать все деревья ({trees.length})
                  </button>
                  <button type="button" className="action-btn-lw secondary" onClick={handleExportTreesSelected} disabled={!selectedTreeId}>
                    Скачать выбранное
                  </button>
                </div>
              </div>

              <div>
                <h5 style={{ color: 'var(--text-main)', margin: '0 0 0.6rem 0' }}>Импортировать деревья</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxWidth: '380px' }}>
                  <label style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }} className="muted">
                    Режим интеграции:
                    <select value={treeImportMode} onChange={(e) => { setTreeImportMode(e.target.value as JsonImportMode); clearTreeImportPreview(); }}>
                      <option value="addOnly">Добавить только новые (Add only new)</option>
                      <option value="merge">Обновить совпадающие (Merge/update)</option>
                      <option value="replaceAll">Полная замена всей базы (Replace all) ⚠️</option>
                    </select>
                  </label>
                  <button type="button" className="action-btn-lw primary" onClick={() => treeImportFileRef.current?.click()}>
                    Загрузить JSON файл
                  </button>
                  <input ref={treeImportFileRef} type="file" accept="application/json,.json" onChange={handleImportTrees} style={{ display: 'none' }} />
                </div>
                {pendingTreeImport && (
                  <div className="card" style={{ marginTop: '0.8rem', padding: '0.8rem' }}>
                    <strong>Preview импорта деревьев</strong>
                    <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                      Файл: {pendingTreeImport.fileName}
                    </div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      Найдено: {pendingTreeImport.totalFound}, добавить: {pendingTreeImport.createdCount}, обновить: {pendingTreeImport.updatedCount}, пропустить: {pendingTreeImport.skippedCount}
                    </div>
                    {pendingTreeImport.mode === 'replaceAll' && (
                      <div style={{ color: '#ffb366', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                        Внимание: будет заменено текущих записей: {pendingTreeImport.replaceWarningCount}
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
                      Первые ID: {pendingTreeImport.firstIds.length > 0 ? pendingTreeImport.firstIds.join(', ') : '—'}
                    </div>
                    {pendingTreeImport.errors.length > 0 && (
                      <div style={{ marginTop: '0.35rem' }}>
                        {pendingTreeImport.errors.map((error, index) => (
                          <div key={`${error}-${index}`} style={{ color: '#ff8080', fontSize: '0.82rem' }}>{error}</div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
                      <button
                        type="button"
                        className="action-btn-lw primary"
                        onClick={confirmTreeImport}
                        disabled={pendingTreeImport.errors.length > 0 || isSaving}
                      >
                        Подтвердить импорт
                      </button>
                      <button type="button" className="action-btn-lw secondary" onClick={clearTreeImportPreview}>
                        Отменить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        )}

      </div>

      {/* QUICK TREE CREATION MODAL OVERLAY */}
      {showCreateTreeModal && (
        <div className="admin-modal-backdrop">
          <div className="modal-content-card">
            <h3>Создать новое дерево</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '1.5rem' }}>
              <div className="field-group">
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>ID дерева</span>
                <input value={modalTree.id} onChange={(e) => setModalTree({ ...modalTree, id: e.target.value })} placeholder="tree_dry_pine" />
              </div>
              <div className="field-group">
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Название</span>
                <input value={modalTree.name} onChange={(e) => setModalTree({ ...modalTree, name: e.target.value })} placeholder="Сухая Сосна" />
              </div>
              <div className="field-group">
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Регион</span>
                <input value={modalTree.region} onChange={(e) => setModalTree({ ...modalTree, region: e.target.value })} placeholder="teramor" />
              </div>
              <div className="field-group">
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Редкость</span>
                <select value={modalTree.rarity} onChange={(e) => setModalTree({ ...modalTree, rarity: e.target.value as any })} style={{ height: '36px' }}>
                  <option value="common">Common</option>
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </div>
              <div className="field-group">
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>HP дерева</span>
                <input type="number" value={modalTree.hp} onChange={(e) => setModalTree({ ...modalTree, hp: parseInt(e.target.value, 10) || 100 })} />
              </div>
              <div className="field-group">
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Твёрдость</span>
                <input type="number" value={modalTree.hardness} onChange={(e) => setModalTree({ ...modalTree, hardness: parseInt(e.target.value, 10) || 1 })} />
              </div>
              <div className="field-group">
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Риск падения (%)</span>
                <input type="number" value={modalTree.fallRisk} onChange={(e) => setModalTree({ ...modalTree, fallRisk: parseInt(e.target.value, 10) || 10 })} />
              </div>
              <div className="field-group">
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tier</span>
                <input type="number" value={modalTree.tier} onChange={(e) => setModalTree({ ...modalTree, tier: parseInt(e.target.value, 10) || 1 })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="action-btn-lw primary" onClick={() => handleConfirmCreateTree(true)}>
                Создать и добавить в биом
              </button>
              <button type="button" className="action-btn-lw secondary" onClick={() => handleConfirmCreateTree(false)}>
                Создать без добавления
              </button>
              <button type="button" className="action-btn-lw danger" onClick={() => setShowCreateTreeModal(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
