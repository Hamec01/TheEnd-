import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { AdminAudioField } from '../AdminAudioField';
import { AdminImageField } from '../AdminImageField';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import { ZoneReferenceInput } from '../ZoneReferenceInput';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';
import { getAdminInitials, getNpcPreviewImageKey, resolveAdminImageSource } from '../adminVisuals';
import { subscribeToContentSync } from '../../services/content/contentSync';
import { ensureDialoguesLoaded, getAllDialogues, saveDialogue } from '../../services/dialogueRepository';
import { imageService } from '../../services/content/imageService';
import { itemsService } from '../../services/content/itemsService';
import { lootTablesService } from '../../services/content/lootTablesService';
import { merchantsService } from '../../services/content/merchantsService';
import { skillsService } from '../../services/content/skillsService';
import { visualFxService } from '../../services/content/visualFxService';
import { ensureQuestMarkersLoaded, getQuestMarkers } from '../../services/questMapRepository';
import { ensureQuestsLoaded, getAllQuests, getQuestItems } from '../../services/questRepository';
import { ensureNpcsLoaded, getAllNpcs, saveNpc, renameNpc, deleteNpc, duplicateNpc, importNpcsJson, getNpcAdminNormalizationIssues } from '../../services/npcRepository';
import { validateNpc } from '../../services/npcValidator';
import { buildWorldZoneLabel, getAllZones, refreshZonesFromBackend } from '../../services/worldRepository';
import { cityService } from '../../services/cityRepository';
import { locationService } from '../../services/locationRepository';
import { downloadCollectionJson, extractRawCollectionFromImportJson } from '../../services/content/adminJsonImportExport';
import { normalizeNpcForAdmin } from '../../services/npcAdminNormalization';
import type {
  NpcCondition,
  NpcDefinition,
  NpcDispositionMode,
  NpcKind,
  NpcMapBinding,
  NpcRace,
  NpcStatus,
  NpcValidationWorldData,
} from '../../types/npc';
import type { WorldMapZone } from '../../worldmap/zoneEditorTypes';
import type { City } from '../../types/city';
import type { WorldLocation } from '../../types/location';
import type { StoredImage } from '../../services/content/models';
import { getIdQualityWarning, runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import { NpcGroupList } from '../components/NpcGroupList';
import { buildNpcCardSummary, groupNpcsByKey, getGroupingLabel, resolveNpcPlaceInfo, type GroupingKey } from '../utils/npcGrouping';
import { AdminSectionErrorBoundary } from '../components/AdminSectionErrorBoundary';
import { BATTLE_EFFECT_IDS } from '../../phaser/effects/effectRegistry';

const NPC_STATUSES: NpcStatus[] = ['draft', 'active', 'disabled', 'archived'];
const GROUPING_OPTIONS: GroupingKey[] = ['place', 'city', 'location', 'kingdom', 'faction', 'kind', 'none'];
const NPC_KINDS: NpcKind[] = ['civilian', 'quest_giver', 'trader', 'trainer', 'guard', 'enemy', 'boss', 'companion', 'random_encounter', 'story_character', 'monster', 'animal'];
const NPC_RACES: NpcRace[] = ['human', 'high_elf', 'forest_elf', 'ancient_elf', 'dwarf', 'orc', 'dark_elf', 'arin_fellar', 'monster', 'beast', 'undead', 'spirit', 'other'];
const NPC_DISPOSITIONS: NpcDispositionMode[] = ['friendly', 'neutral', 'hostile', 'fearful', 'aggressive_on_sight', 'quest_locked', 'hidden'];
const MAP_SPAWN_TYPES: NpcMapBinding['spawnType'][] = ['fixed', 'random_in_zone', 'quest_spawn', 'event_spawn'];
const QUICK_FILTER_OPTIONS = [
  { key: 'unbound', label: 'Только без привязки' },
  { key: 'traders', label: 'Только торговцы' },
  { key: 'quest', label: 'Только квестовые' },
  { key: 'combat', label: 'Только боевые' },
  { key: 'village', label: 'Только деревни' },
  { key: 'academy', label: 'Только академии' },
  { key: 'city', label: 'Только города' },
  { key: 'active', label: 'Только active' },
  { key: 'draft', label: 'Только draft' },
] as const;
type QuickFilterKey = typeof QUICK_FILTER_OPTIONS[number]['key'];

type NpcTab =
  | 'basic'
  | 'images'
  | 'location'
  | 'combat'
  | 'skills'
  | 'inventory'
  | 'trade'
  | 'dialogues'
  | 'quests'
  | 'behavior'
  | 'validation';

function emptyNpc(): NpcDefinition {
  const now = new Date().toISOString();
  return {
    id: '',
    name: '',
    status: 'draft',
    kind: 'civilian',
    race: 'human',
    description: '',
    mapBindings: [],
    defaultDisposition: 'neutral',
    isUnique: true,
    canRespawn: false,
    canFight: false,
    canTalk: true,
    canTrade: false,
    worldSimTrader: false,
    canTrain: false,
    canGiveQuests: false,
    canBeKilled: false,
    dialogues: [],
    questBindings: [],
    createdAt: now,
    updatedAt: now,
  };
}

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function isLikelyWindowsPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function sanitizeAudioAssetRef(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  if (isLikelyWindowsPath(normalized)) {
    return undefined;
  }
  return normalized;
}

function formatLabel(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function repairNpcInState(rawNpc: NpcDefinition): { npc: NpcDefinition; issues: string[] } {
  return normalizeNpcForAdmin(rawNpc);
}

export function NpcsPage() {
  const [npcs, setNpcs] = useState<NpcDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NpcDefinition>(emptyNpc());
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<NpcTab>('basic');
  const [groupingKey, setGroupingKey] = useState<GroupingKey>('place');
  const [quickFilters, setQuickFilters] = useState<Record<QuickFilterKey, boolean>>({
    unbound: false,
    traders: false,
    quest: false,
    combat: false,
    village: false,
    academy: false,
    city: false,
    active: false,
    draft: false,
  });
  const [statusText, setStatusText] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBulkImageUploading, setBulkImageUploading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [dialogueIds, setDialogueIds] = useState<string[]>([]);
  const [questIds, setQuestIds] = useState<string[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [questItemIds, setQuestItemIds] = useState<string[]>([]);
  const [traderOptions, setTraderOptions] = useState<Array<{ id: string; name: string; city: string; enabled: boolean; assortment: number }>>([]);
  const [zones, setZones] = useState<WorldMapZone[]>(() => getAllZones());
  const [markerIds, setMarkerIds] = useState<string[]>([]);
  const [lootTableIds, setLootTableIds] = useState<string[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [locations, setLocations] = useState<WorldLocation[]>([]);
  const [storedImages, setStoredImages] = useState<StoredImage[]>([]);
  const [visualFxIds, setVisualFxIds] = useState<string[]>([]);

  const [mapBindingsJson, setMapBindingsJson] = useState('[]');
  const [dialogueBindingsJson, setDialogueBindingsJson] = useState('[]');
  const [questBindingsJson, setQuestBindingsJson] = useState('[]');
  const [conditionsJson, setConditionsJson] = useState('[]');

  function refresh() {
    const all = getAllNpcs();
    setNpcs(all);

    const selected = selectedId ? all.find((entry) => entry.id === selectedId) ?? null : null;
    if (selected) {
      setDraft(selected);
    } else if (selectedId) {
      setSelectedId(null);
      setDraft(emptyNpc());
    }
  }

  useEffect(() => {
    void Promise.all([
      ensureNpcsLoaded(),
      ensureDialoguesLoaded(),
      ensureQuestsLoaded(),
      ensureQuestMarkersLoaded(),
      skillsService.getAll(),
      itemsService.getAll(),
      merchantsService.getAll(),
      lootTablesService.getAll(),
      visualFxService.getAll().catch(() => []),
      imageService.getAll().catch(() => []),
    ]).then(([, , , , skills, items, merchants, lootTables, visualFx, images]) => {
      setSkillIds(skills.map((entry) => entry.id));
      setItemIds(items.map((entry) => entry.id));
      setStoredImages(images);
      setVisualFxIds(visualFx.filter((entry) => entry.status !== 'disabled').map((entry) => entry.id));
      setTraderOptions(merchants.map((entry) => ({
        id: entry.id,
        name: entry.name,
        city: entry.city,
        enabled: entry.isEnabled,
        assortment: entry.items.length,
      })));
      setLootTableIds(lootTables.map((entry) => entry.id));

      setQuestIds(getAllQuests().map((entry) => entry.id));
      setQuestItemIds(getQuestItems().map((entry) => entry.id));
      setDialogueIds(getAllDialogues().map((entry) => entry.id));
      setMarkerIds(getQuestMarkers().map((entry) => entry.id));
      setZones(getAllZones());
      refresh();
    });

    void cityService.getCities().then(setCities).catch(() => setCities([]));
    void locationService.getLocations().then(setLocations).catch(() => setLocations([]));

    void refreshZonesFromBackend().then(setZones).catch(() => undefined);

    const unsubscribe = subscribeToContentSync((payload) => {
      if (payload.scope === 'content' || payload.scope === 'all') {
        void Promise.all([
          ensureDialoguesLoaded(),
          ensureQuestsLoaded(),
          ensureQuestMarkersLoaded(),
          skillsService.getAll(),
          itemsService.getAll(),
          merchantsService.getAll(),
          lootTablesService.getAll(),
          visualFxService.getAll().catch(() => []),
          imageService.getAll().catch(() => []),
        ]).then(([, , , skills, items, merchants, lootTables, visualFx, images]) => {
          setSkillIds(skills.map((entry) => entry.id));
          setItemIds(items.map((entry) => entry.id));
          setStoredImages(images);
          setVisualFxIds(visualFx.filter((entry) => entry.status !== 'disabled').map((entry) => entry.id));
          setTraderOptions(merchants.map((entry) => ({
            id: entry.id,
            name: entry.name,
            city: entry.city,
            enabled: entry.isEnabled,
            assortment: entry.items.length,
          })));
          setLootTableIds(lootTables.map((entry) => entry.id));
          setQuestIds(getAllQuests().map((entry) => entry.id));
          setQuestItemIds(getQuestItems().map((entry) => entry.id));
          setDialogueIds(getAllDialogues().map((entry) => entry.id));
          setMarkerIds(getQuestMarkers().map((entry) => entry.id));
          refresh();
        }).catch(() => undefined);

        void Promise.all([
          cityService.getCities().catch(() => []),
          locationService.getLocations().catch(() => []),
        ]).then(([nextCities, nextLocations]) => {
          setCities(nextCities);
          setLocations(nextLocations);
        }).catch(() => undefined);
      }

      if (payload.scope === 'worldMap' || payload.scope === 'all') {
        void refreshZonesFromBackend().then(setZones).catch(() => undefined);
      }
    });

    return unsubscribe;
  }, []);

  const homeCity = useMemo(
    () => (draft.homeCityId ? cities.find((city) => city.id === draft.homeCityId) ?? null : null),
    [cities, draft.homeCityId],
  );
  const currentCity = useMemo(
    () => (draft.currentCityId ? cities.find((city) => city.id === draft.currentCityId) ?? null : null),
    [cities, draft.currentCityId],
  );
  const currentCityLocations = useMemo(
    () => currentCity?.locations ?? [],
    [currentCity],
  );
  const groupingContext = useMemo(
    () => ({ cities, locations, zones }),
    [cities, locations, zones],
  );
  const selectedCityLocation = useMemo(() => {
    if (!draft.cityLocationId || !currentCity) return null;
    return currentCity.locations.find((location) => location.id === draft.cityLocationId) ?? null;
  }, [currentCity, draft.cityLocationId]);
  const selectedWorldLocation = useMemo(
    () => (draft.locationId ? locations.find((location) => location.id === draft.locationId) ?? null : null),
    [draft.locationId, locations],
  );

  useEffect(() => {
    setMapBindingsJson(JSON.stringify(draft.mapBindings, null, 2));
    setDialogueBindingsJson(JSON.stringify(draft.dialogues, null, 2));
    setQuestBindingsJson(JSON.stringify(draft.questBindings, null, 2));
    setConditionsJson(JSON.stringify(draft.conditions ?? [], null, 2));
  }, [draft]);

  const zoneIds = useMemo(() => zones.map((zone) => zone.id), [zones]);
  const npcBattleEffectIds = useMemo(
    () => Array.from(new Set([...visualFxIds, ...BATTLE_EFFECT_IDS])).sort(),
    [visualFxIds],
  );

  const worldData = useMemo<NpcValidationWorldData>(() => ({
    questIds,
    skillIds,
    traderIds: traderOptions.map((entry) => entry.id),
    itemIds,
    questItemIds,
    zoneIds,
    markerIds,
    dialogueIds,
    factionIds: ['free_cities', 'artalon_guard', 'mist_cult'],
    kingdomIds: ['luminor', 'artalon', 'kriantar', 'terimia', 'argos', 'none'],
    cityIds: ['arklein', 'brenhold', 'ironcrest', 'whisper_port'],
    mapIds: ['worldmap-main'],
  }), [dialogueIds, itemIds, markerIds, questIds, questItemIds, skillIds, traderOptions, zoneIds]);

  const validation = useMemo(() => validateNpc(draft, worldData), [draft, worldData]);
  const adminNormalizationIssues = useMemo(
    () => (selectedId ? getNpcAdminNormalizationIssues(selectedId) : []),
    [selectedId, npcs],
  );

  const visibleNpcs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return npcs.filter((entry) => {
      const searchMatches = !q
        ? true
        : entry.id.toLowerCase().includes(q)
          || entry.name.toLowerCase().includes(q)
          || (entry.title ?? '').toLowerCase().includes(q);
      if (!searchMatches) {
        return false;
      }

      const place = resolveNpcPlaceInfo(entry, groupingContext);
      if (quickFilters.unbound && place.kind !== 'unbound') {
        return false;
      }
      if (quickFilters.traders && !(entry.canTrade || entry.worldSimTrader || entry.traderId)) {
        return false;
      }
      if (quickFilters.quest && !(entry.canGiveQuests || entry.questBindings.length > 0)) {
        return false;
      }
      if (quickFilters.combat && !entry.canFight) {
        return false;
      }
      if (quickFilters.village && place.category !== 'village') {
        return false;
      }
      if (quickFilters.academy && place.category !== 'academy' && place.category !== 'magic_school') {
        return false;
      }
      if (quickFilters.city && place.category !== 'city' && place.category !== 'city_inner_location') {
        return false;
      }
      if (quickFilters.active && entry.status !== 'active') {
        return false;
      }
      if (quickFilters.draft && entry.status !== 'draft') {
        return false;
      }
      return true;
    });
  }, [groupingContext, npcs, query, quickFilters]);

  const selectedNpc = useMemo(() => (selectedId ? npcs.find((entry) => entry.id === selectedId) ?? null : null), [npcs, selectedId]);

  const linkedTraderSummary = useMemo(() => {
    if (!draft.traderId) {
      return null;
    }
    return traderOptions.find((entry) => entry.id === draft.traderId) ?? null;
  }, [draft.traderId, traderOptions]);

  const primaryMapBinding = useMemo(() => draft.mapBindings[0] ?? null, [draft.mapBindings]);
  const locationZone = useMemo(
    () => zones.find((zone) => zone.id === (primaryMapBinding?.zoneId ?? '').trim()) ?? null,
    [primaryMapBinding?.zoneId, zones],
  );
  const resolvedDraftPlace = useMemo(() => resolveNpcPlaceInfo(draft, groupingContext), [draft, groupingContext]);
  const draftCardSummary = useMemo(() => buildNpcCardSummary(draft, groupingContext), [draft, groupingContext]);
  const zoneListText = useMemo(() => zones.map((zone) => buildWorldZoneLabel(zone)).join(', '), [zones]);

  function toggleQuickFilter(filterKey: QuickFilterKey) {
    setQuickFilters((current) => ({ ...current, [filterKey]: !current[filterKey] }));
  }

  function patchPrimaryMapBinding(next: Partial<NpcMapBinding>) {
    const current = draft.mapBindings[0] ?? { id: `map_${Date.now()}`, mapId: 'worldmap-main', spawnType: 'fixed', visibleToPlayer: true };
    patch({ mapBindings: [{ ...current, ...next }] });
  }

  function patch(next: Partial<NpcDefinition>) {
    setDraft((current) => ({ ...current, ...next, updatedAt: new Date().toISOString() }));
  }

  async function handleUploadAllNpcImages(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setBulkImageUploading(true);
    try {
      const baseName = draft.id.trim() || 'npc';

      const uploadOrReplaceNpcImage = async (
        imageId: string,
        preset: 'merchant-portrait' | 'item-icon',
        imageName: string,
      ) => {
        const existing = await imageService.get(imageId);
        if (existing) {
          return imageService.replacePreset(imageId, file, preset, { name: imageName });
        }
        return imageService.uploadPreset(file, preset, {
          id: imageId,
          name: imageName,
          folder: buildUploadFolder('images', 'npcs', baseName),
        });
      };

      const [portrait, fullImage, combatImage, icon] = await Promise.all([
        uploadOrReplaceNpcImage(`${baseName}_portrait`, 'merchant-portrait', `${baseName}-portrait`),
        uploadOrReplaceNpcImage(`${baseName}_full`, 'merchant-portrait', `${baseName}-full`),
        uploadOrReplaceNpcImage(`${baseName}_combat`, 'merchant-portrait', `${baseName}-combat`),
        uploadOrReplaceNpcImage(`${baseName}_icon`, 'item-icon', `${baseName}-icon`),
      ]);

      patch({
        portraitUrl: portrait.id,
        fullImageUrl: fullImage.id,
        combatImageUrl: combatImage.id,
        iconUrl: icon.id,
      });
      setStatusText(`Загружены все варианты изображений для NPC: ${baseName}.`);
    } catch (error) {
      setStatusText(translateAdminErrorMessage((error as Error).message));
    } finally {
      setBulkImageUploading(false);
    }
  }

  function repairSelectedNpc() {
    const repaired = repairNpcInState(draft);
    setDraft(repaired.npc);
    setStatusText('NPC приведён к безопасной структуре. Проверьте поля и нажмите Сохранить.');
    setSaveState({
      state: repaired.issues.length > 0 ? 'warning' : 'saved',
      message: repaired.issues.length > 0 ? repaired.issues[0] : 'NPC приведён к безопасной структуре.',
    });
  }

  function createNpc() {
    setSelectedId(null);
    setDraft(emptyNpc());
    setStatusText('Новый NPC. Заполните форму справа.');
  }

  function selectNpc(npc: NpcDefinition) {
    const normalized = normalizeNpcForAdmin(npc).npc;
    setSelectedId(normalized.id);
    setDraft({ ...normalized });
    setStatusText(`Редактируется NPC: ${npc.id}`);
  }

  async function saveCurrent() {
    if (isSaving) {
      return;
    }

    const prepared: NpcDefinition = {
      ...draft,
      id: draft.id.trim() || `npc_${Math.random().toString(36).slice(2, 8)}`,
      name: draft.name.trim(),
      dialogueStartVoiceAssetId: sanitizeAudioAssetRef(draft.dialogueStartVoiceAssetId),
      mapBindings: parseJsonArray<NpcMapBinding>(mapBindingsJson, draft.mapBindings),
      dialogues: parseJsonArray(draft.dialogues ? dialogueBindingsJson : '[]', draft.dialogues),
      questBindings: parseJsonArray(draft.questBindings ? questBindingsJson : '[]', draft.questBindings),
      conditions: parseJsonArray<NpcCondition>(conditionsJson, draft.conditions ?? []),
      updatedAt: new Date().toISOString(),
      createdAt: draft.createdAt || new Date().toISOString(),
    };

    if (draft.dialogueStartVoiceAssetId && !prepared.dialogueStartVoiceAssetId) {
      setStatusText('Dialogue start voice выглядит как локальный путь Windows. Загрузите файл через кнопку "Выбрать аудио" (asset ID).');
      return;
    }

    const result = validateNpc(prepared, worldData);
    if (prepared.status === 'active' && result.errors.length > 0) {
      setStatusText('Нельзя активировать NPC с критическими ошибками. Перейдите во вкладку Валидация.');
      return;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: prepared.id,
      onSave: () => (selectedId && prepared.id !== selectedId ? renameNpc(selectedId, prepared) : saveNpc(prepared)),
      onAfterSave: () => Promise.resolve(refresh()),
      successLabel: (entry) => `Сохранено: ${entry.id}`,
    });
    if (!saved) {
      setIsSaving(false);
      return;
    }

    setDraft(saved);
    setSelectedId(saved.id);
    refresh();
    const warning = getIdQualityWarning(saved.id);
    if (warning) {
      setStatusText(`Предупреждение: ${warning}`);
      setSaveState({ state: 'warning', message: warning });
    } else {
      setStatusText(`NPC сохранен: ${saved.id}`);
    }
    setIsSaving(false);
  }

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: saveCurrent,
  });

  async function duplicateSelected() {
    if (!selectedId) {
      return;
    }
    const copy = await duplicateNpc(selectedId);
    refresh();
    setSelectedId(copy.id);
    setDraft(copy);
    setStatusText(`Создана копия: ${copy.id}`);
  }

  async function disableSelected() {
    if (!selectedId) {
      return;
    }
    const current = npcs.find((entry) => entry.id === selectedId);
    if (!current) {
      return;
    }
    await saveNpc({ ...current, status: 'disabled' });
    refresh();
    setStatusText(`NPC отключен: ${selectedId}`);
  }

  async function removeSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }
    await deleteNpc(selectedId);
    setSelectedId(null);
    setDraft(emptyNpc());
    refresh();
    setStatusText(`NPC удален: ${selectedId}`);
  }

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_npcs',
      collectionKey: 'npcs',
      entries: npcs,
    });
    setStatusText(`Экспорт NPC: ${npcs.length}`);
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isImporting || isSaving) {
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const entries = extractRawCollectionFromImportJson(payload, 'npcs');
      const count = await importNpcsJson(JSON.stringify(entries));
      refresh();
      setStatusText(`Импорт NPC завершен: ${count}`);
      setSaveState({ state: 'saved', message: `Импорт NPC: ${count}` });
    } catch (error) {
      setStatusText((error as Error).message);
      setSaveState({ state: 'error', message: (error as Error).message });
    } finally {
      setIsImporting(false);
    }
  }

  async function createDialogueForNpc() {
    const npcId = draft.id.trim();
    if (!npcId) {
      setStatusText('Сначала сохраните NPC, затем создайте диалог.');
      return;
    }

    const dialogueId = `dlg_${npcId}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    await saveDialogue({
      id: dialogueId,
      title: `Dialogue for ${draft.name || npcId}`,
      npcId,
      status: 'active',
      startNodeId: 'start',
      nodes: [{
        id: 'start',
        speaker: 'npc',
        text: draft.canTrade && draft.traderId ? 'Приветствую. Хочешь взглянуть на мои товары?' : 'Приветствую. Чем могу помочь?',
        choices: draft.canTrade && draft.traderId ? [{ id: 'open_shop', text: 'Покажи товары', endsDialogue: true, actions: [{ id: 'open_shop', type: 'openShop', merchantId: draft.traderId }] }] : [],
      }],
      createdAt: now,
      updatedAt: now,
    });

    const nextDialogueIds = getAllDialogues().map((entry) => entry.id);
    setDialogueIds(nextDialogueIds);
    patch({
      dialogues: [...draft.dialogues, { dialogueId, priority: draft.dialogues.length + 1 }],
    });
    setStatusText(`Создан диалог: ${dialogueId}`);
  }

  async function createTraderProfileForNpc() {
    const npcId = draft.id.trim();
    if (!npcId) {
      setStatusText('Сначала сохраните NPC, затем создайте trader profile.');
      return;
    }

    if (draft.traderId?.trim()) {
      patch({ canTrade: true, worldSimTrader: true, kind: draft.kind === 'civilian' ? 'trader' : draft.kind });
      setStatusText(`Trader profile уже привязан: ${draft.traderId}`);
      return;
    }

    const merchantId = `merchant_${npcId}`;
    const created = await merchantsService.create({
      id: merchantId,
      name: draft.name || npcId,
      city: draft.currentCityId || draft.cityId || draft.homeCityId || 'world',
      location: draft.cityLocationId || draft.locationId || '',
      cityId: draft.currentCityId || draft.cityId || draft.homeCityId || undefined,
      cityLocationId: draft.cityLocationId || draft.locationId || undefined,
      type: 'general',
      description: `Trader profile for NPC ${npcId}`,
      portraitPath: draft.portraitUrl || '',
      priceMultiplier: 1,
      worldSimTrader: true,
      materialTradingEnabled: false,
      materialTrades: [],
      isEnabled: true,
      items: [],
    });

    const merchants = await merchantsService.getAll();
    setTraderOptions(merchants.map((entry) => ({
      id: entry.id,
      name: entry.name,
      city: entry.city,
      enabled: entry.isEnabled,
      assortment: entry.items.length,
    })));
    patch({ canTrade: true, traderId: created.id, worldSimTrader: true, kind: draft.kind === 'civilian' ? 'trader' : draft.kind });
    setStatusText(`Создан trader profile: ${created.id}`);
  }

  async function createWorldSimArchetypeForNpc() {
    const npcId = (selectedId || draft.id || '').trim();
    if (!npcId) {
      setStatusText('Сначала сохраните NPC, потом создайте world-sim archetype.');
      return;
    }

    const npcName = (draft.name || npcId).trim();
    const archetypeId = `ws_npc_${npcId}`;
    const isMerchantNpc = Boolean(draft.worldSimTrader || draft.canTrade || draft.traderId);
    const isQuestNpc = Array.isArray(draft.questBindings) && draft.questBindings.length > 0;
    const kind = isMerchantNpc
      ? 'merchant'
      : draft.defaultDisposition === 'hostile' || draft.defaultDisposition === 'aggressive_on_sight'
        ? 'bandit'
        : isQuestNpc
          ? 'quest_giver'
        : draft.canFight
          ? 'guard'
          : 'wanderer';

    try {
      const existingResponse = await fetch('/api/world-simulation/archetypes');
      const existing = existingResponse.ok ? await existingResponse.json() : [];
      if (Array.isArray(existing) && existing.some((entry: any) => entry.id === archetypeId)) {
        setStatusText(`World-sim archetype уже существует: ${archetypeId}`);
        return;
      }

      const payload = {
        id: archetypeId,
        name: isMerchantNpc ? `Караван ${npcName}` : npcName,
        kind,
        sourceType: 'npc',
        sourceId: npcId,
        npcTemplateId: npcId,
        worldSpriteId: kind === 'merchant' ? 'trader_world_sprite' : kind === 'bandit' ? 'camp_world_sprite' : 'camp_world_sprite_2',
        restingWorldSpriteId: kind === 'bandit' ? 'fire_world_sprite' : undefined,
        portraitId: draft.portraitUrl || 'unknown',
        isEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch('/api/world-simulation/archetypes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setStatusText(`Создан world-sim archetype: ${archetypeId}. Чтобы он появился в мире, добавьте его в маршрут и spawn rule.`);
    } catch (error) {
      setStatusText(`Не удалось создать world-sim archetype: ${(error as Error).message}`);
    }
  }

  return (
    <div className="admin-form-panel">
      <div className="admin-tabbar">
        <button className={activeTab === 'basic' ? 'is-active' : ''} onClick={() => setActiveTab('basic')}>Основное</button>
        <button className={activeTab === 'images' ? 'is-active' : ''} onClick={() => setActiveTab('images')}>Изображения</button>
        <button className={activeTab === 'location' ? 'is-active' : ''} onClick={() => setActiveTab('location')}>Локация</button>
        <button className={activeTab === 'combat' ? 'is-active' : ''} onClick={() => setActiveTab('combat')}>Боевые статы</button>
        <button className={activeTab === 'skills' ? 'is-active' : ''} onClick={() => setActiveTab('skills')}>Скиллы</button>
        <button className={activeTab === 'inventory' ? 'is-active' : ''} onClick={() => setActiveTab('inventory')}>Инвентарь/Лут</button>
        <button className={activeTab === 'trade' ? 'is-active' : ''} onClick={() => setActiveTab('trade')}>Торговля</button>
        <button className={activeTab === 'dialogues' ? 'is-active' : ''} onClick={() => setActiveTab('dialogues')}>Диалоги</button>
        <button className={activeTab === 'quests' ? 'is-active' : ''} onClick={() => setActiveTab('quests')}>Квесты</button>
        <button className={activeTab === 'behavior' ? 'is-active' : ''} onClick={() => setActiveTab('behavior')}>Поведение</button>
        <button className={activeTab === 'validation' ? 'is-active' : ''} onClick={() => setActiveTab('validation')}>Валидация</button>
      </div>

      <AdminSectionErrorBoundary
        sectionName="Персонажи"
        onReset={() => {
          setSelectedId(null);
          setDraft(emptyNpc());
          setActiveTab('basic');
          setStatusText('Выбранная запись сброшена после ошибки.');
        }}
      >
        {adminNormalizationIssues.length > 0 ? (
          <div className="admin-panel warning">
            <h4>⚠ Запись NPC загружена в безопасном режиме</h4>
            <p className="muted">Найдены проблемы:</p>
            <ul>
              {adminNormalizationIssues.slice(0, 8).map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
            <div className="admin-actions-row">
              <button type="button" onClick={repairSelectedNpc} disabled={isSaving}>Починить запись</button>
            </div>
          </div>
        ) : (
          <div className="admin-actions-row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" onClick={repairSelectedNpc} disabled={isSaving} title="Нормализовать текущую запись (на случай старого формата или ручных правок JSON)">Починить запись</button>
          </div>
        )}

        {activeTab === 'basic' ? (
          <div className="admin-form-grid">
            <label><AdminFieldLabel label="ID" hint="Уникальный ID NPC." /><AdminHelpTooltip section="characters" field="id" /><input value={draft.id} onChange={(event) => patch({ id: event.target.value })} /></label>
            <label><AdminFieldLabel label="Имя" hint="Отображаемое имя NPC." /><AdminHelpTooltip section="characters" field="name" /><input value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label>
            <label><AdminFieldLabel label="Титул" hint="Дополнительный титул NPC." /><input value={draft.title ?? ''} onChange={(event) => patch({ title: event.target.value || undefined })} /></label>
            <label><AdminFieldLabel label="Статус" hint="Draft/active/disabled/archived." /><select value={draft.status} onChange={(event) => patch({ status: event.target.value as NpcStatus })}>{NPC_STATUSES.map((entry) => <option key={entry} value={entry}>{formatLabel(entry)}</option>)}</select></label>
            <label><AdminFieldLabel label="Тип NPC" hint="Роль персонажа в мире." /><select value={draft.kind} onChange={(event) => patch({ kind: event.target.value as NpcKind })}>{NPC_KINDS.map((entry) => <option key={entry} value={entry}>{formatLabel(entry)}</option>)}</select></label>
            <label><AdminFieldLabel label="Раса" hint="Раса NPC." /><select value={draft.race} onChange={(event) => patch({ race: event.target.value as NpcRace })}>{NPC_RACES.map((entry) => <option key={entry} value={entry}>{formatLabel(entry)}</option>)}</select></label>
            <label><AdminFieldLabel label="Пол" hint="Текстовое поле пола." /><input value={draft.gender ?? ''} onChange={(event) => patch({ gender: event.target.value || undefined })} /></label>
            <label><AdminFieldLabel label="Возраст" hint="Возраст или возрастной текст." /><input value={draft.age ?? ''} onChange={(event) => patch({ age: event.target.value || undefined })} /></label>
            <label><AdminFieldLabel label="Королевство" hint="Привязка к королевству." /><input value={draft.kingdomId ?? ''} onChange={(event) => patch({ kingdomId: event.target.value || undefined })} /></label>
            <label><AdminFieldLabel label="Фракция" hint="Привязка к фракции." /><input value={draft.factionId ?? ''} onChange={(event) => patch({ factionId: event.target.value || undefined })} /></label>
            <label><AdminFieldLabel label="Город" hint="Привязка к городу." /><input value={draft.cityId ?? ''} onChange={(event) => patch({ cityId: event.target.value || undefined })} /></label>
            <label><AdminFieldLabel label="Location ID" hint="Локальный id локации." /><input value={draft.locationId ?? ''} onChange={(event) => patch({ locationId: event.target.value || undefined })} /></label>
            <label><AdminFieldLabel label="Disposition" hint="Базовое отношение NPC к игроку." /><select value={draft.defaultDisposition} onChange={(event) => patch({ defaultDisposition: event.target.value as NpcDispositionMode })}>{NPC_DISPOSITIONS.map((entry) => <option key={entry} value={entry}>{formatLabel(entry)}</option>)}</select></label>
            <label><AdminFieldLabel label="Reputation Value" hint="Изменение репутации при взаимодействии." /><input type="number" value={draft.reputationValue ?? ''} onChange={(event) => patch({ reputationValue: event.target.value ? Number(event.target.value) : undefined })} /></label>
            <label className="zone-editor-checkbox"><input type="checkbox" checked={draft.isUnique} onChange={(event) => patch({ isUnique: event.target.checked })} /><AdminFieldLabel label="Unique NPC" hint="Уникальный NPC в мире." /></label>
            <label className="zone-editor-checkbox"><input type="checkbox" checked={draft.canRespawn} onChange={(event) => patch({ canRespawn: event.target.checked })} /><AdminFieldLabel label="Can respawn" hint="Респаун после смерти." /></label>
            <label><AdminFieldLabel label="Respawn seconds" hint="Время респауна NPC." /><input type="number" value={draft.respawnSeconds ?? ''} onChange={(event) => patch({ respawnSeconds: event.target.value ? Number(event.target.value) : undefined })} /></label>
            <label className="zone-editor-checkbox"><input type="checkbox" checked={draft.canFight} onChange={(event) => patch({ canFight: event.target.checked })} /><AdminFieldLabel label="Can fight" hint="NPC может участвовать в бою." /></label>
            <label className="zone-editor-checkbox"><input type="checkbox" checked={draft.canTalk} onChange={(event) => patch({ canTalk: event.target.checked })} /><AdminFieldLabel label="Can talk" hint="NPC доступен для диалога." /></label>
            <label className="zone-editor-checkbox"><input type="checkbox" checked={draft.canTrade} onChange={(event) => patch({ canTrade: event.target.checked })} /><AdminFieldLabel label="Can trade" hint="NPC открывает торговлю." /></label>
            <label className="zone-editor-checkbox"><input type="checkbox" checked={draft.canTrain} onChange={(event) => patch({ canTrain: event.target.checked })} /><AdminFieldLabel label="Can train" hint="NPC может тренировать." /></label>
            <label className="zone-editor-checkbox"><input type="checkbox" checked={draft.canGiveQuests} onChange={(event) => patch({ canGiveQuests: event.target.checked })} /><AdminFieldLabel label="Can give quests" hint="NPC может выдавать квесты." /></label>
            <label className="zone-editor-checkbox"><input type="checkbox" checked={draft.canBeKilled} onChange={(event) => patch({ canBeKilled: event.target.checked })} /><AdminFieldLabel label="Can be killed" hint="NPC можно убить." /></label>
          </div>
        ) : null}

        {activeTab === 'images' ? (
          <>
            <section className="card admin-inline-image-field">
              <div className="admin-inline-image-field-head">
                <AdminFieldLabel
                  label="Пакетная загрузка изображений NPC"
                  hint="Один файл автоматически обновит главный портрет NPC, полноразмерное изображение, боевой портрет и иконку."
                />
                <span className="muted">384x384px + 128x128px</span>
              </div>

              <div className="admin-inline-image-field-body">
                <label className="admin-inline-image-upload">
                  <span>{isBulkImageUploading ? 'Загрузка...' : 'Загрузить файл для всех изображений'}</span>
                  <input type="file" accept="image/*" onChange={handleUploadAllNpcImages} disabled={isBulkImageUploading} />
                </label>

                <button
                  type="button"
                  disabled={isBulkImageUploading || (!draft.portraitUrl && !draft.fullImageUrl && !draft.combatImageUrl && !draft.iconUrl)}
                  onClick={() => patch({
                    portraitUrl: undefined,
                    fullImageUrl: undefined,
                    combatImageUrl: undefined,
                    iconUrl: undefined,
                  })}
                >
                  Очистить все
                </button>
              </div>

              <p className="muted">
                Система автоматически подготовит изображения под нужные размеры интерфейса. При необходимости любой слот можно заменить вручную ниже.
              </p>
            </section>
            <AdminImageField value={draft.portraitUrl} onChange={(next) => patch({ portraitUrl: next || undefined })} onStatus={setStatusText} presetId="merchant-portrait" suggestedId={draft.id ? `${draft.id}_portrait` : undefined} suggestedName={`${draft.id || 'npc'}-portrait`} uploadFolder={buildUploadFolder('images', 'npcs', draft.id || draft.name || undefined)} label="Портрет NPC" hint="Главный портрет персонажа." />
            <AdminImageField value={draft.fullImageUrl} onChange={(next) => patch({ fullImageUrl: next || undefined })} onStatus={setStatusText} presetId="merchant-portrait" suggestedId={draft.id ? `${draft.id}_full` : undefined} suggestedName={`${draft.id || 'npc'}-full`} uploadFolder={buildUploadFolder('images', 'npcs', draft.id || draft.name || undefined)} label="Полное изображение" hint="Полноразмерное изображение для карточек." />
            <AdminImageField value={draft.combatImageUrl} onChange={(next) => patch({ combatImageUrl: next || undefined })} onStatus={setStatusText} presetId="merchant-portrait" suggestedId={draft.id ? `${draft.id}_combat` : undefined} suggestedName={`${draft.id || 'npc'}-combat`} uploadFolder={buildUploadFolder('images', 'npcs', draft.id || draft.name || undefined)} label="Боевой портрет" hint="Изображение для боя." />
            <AdminImageField value={draft.iconUrl} onChange={(next) => patch({ iconUrl: next || undefined })} onStatus={setStatusText} presetId="item-icon" suggestedId={draft.id ? `${draft.id}_icon` : undefined} suggestedName={`${draft.id || 'npc'}-icon`} uploadFolder={buildUploadFolder('images', 'npcs', draft.id || draft.name || undefined)} label="Иконка NPC" hint="Иконка маркера NPC на карте." />
          </>
        ) : null}

        {activeTab === 'location' ? (
          <>
            <div className="admin-form-grid">
              <label>
                <AdminFieldLabel label="Home City" hint="Родной город NPC. Не обязателен, но полезен для логики появления и фоновых связей." />
                <select value={draft.homeCityId ?? ''} onChange={(event) => patch({ homeCityId: event.target.value || undefined })}>
                  <option value="">Не задано</option>
                  {cities.map((city) => <option key={city.id} value={city.id}>{city.name} ({city.id})</option>)}
                </select>
              </label>
              <p className="muted">{draft.homeCityId ? (homeCity ? `Город найден: ${homeCity.name}` : 'Город не найден') : 'Город не задан'}</p>

              <label>
                <AdminFieldLabel label="Current City" hint="Город, где NPC находится сейчас (для City-сцен). Меняет список локаций ниже." />
                <select value={draft.currentCityId ?? ''} onChange={(event) => {
                  const nextCityId = event.target.value || undefined;
                  patch({
                    currentCityId: nextCityId,
                    cityLocationId: nextCityId ? draft.cityLocationId : undefined,
                  });
                }}>
                  <option value="">Не задано</option>
                  {cities.map((city) => <option key={city.id} value={city.id}>{city.name} ({city.id})</option>)}
                </select>
              </label>
              <p className="muted">{draft.currentCityId ? (currentCity ? `Город найден: ${currentCity.name}` : 'Город не найден') : 'Город не задан'}</p>

              <label>
                <AdminFieldLabel label="World Location" hint="Мировая локация NPC: деревня, академия, лагерь, шахта и другие точки на world map." />
                <select value={draft.locationId ?? ''} onChange={(event) => patch({ locationId: event.target.value || undefined })}>
                  <option value="">Не задано</option>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.id})</option>)}
                </select>
              </label>
              <p className="muted">{draft.locationId ? (selectedWorldLocation ? `World location found: ${selectedWorldLocation.name}` : 'Локация не найдена') : 'Локация не задана'}</p>

              <label>
                <AdminFieldLabel label="City Inner Location" hint="Локация внутри выбранного Current City: ворота, рынок, кузница, арена и т.д." />
                <select
                  value={draft.cityLocationId ?? ''}
                  onChange={(event) => patch({ cityLocationId: event.target.value || undefined })}
                  disabled={!draft.currentCityId}
                >
                  <option value="">Не задано</option>
                  {currentCityLocations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.id})</option>)}
                </select>
              </label>
              <p className="muted">{draft.cityLocationId ? (selectedCityLocation ? `Локация найдена: ${selectedCityLocation.name}` : 'Локация не найдена') : 'Локация не задана'}</p>

              <label>
                <AdminFieldLabel label="Allowed Cities (CSV)" hint="Список городов, где NPC может появляться. Введите ids через запятую." />
                <input
                  value={(draft.allowedCityIds ?? []).join(', ')}
                  onChange={(event) => patch({ allowedCityIds: event.target.value ? event.target.value.split(',').map((v) => v.trim()).filter(Boolean) : undefined })}
                  placeholder="argos_arklein, luminor_soleymar"
                />
              </label>
              <label><AdminFieldLabel label="Map ID" hint="Карта, где спавнится NPC. Для city zone можно оставить пустым." /><input value={primaryMapBinding?.mapId ?? ''} onChange={(event) => {
                patchPrimaryMapBinding({ mapId: event.target.value });
              }} placeholder="worldmap-main" /></label>
              <label><AdminFieldLabel label="Marker ID" hint="Связь с квестовым маркером." /><input value={primaryMapBinding?.markerId ?? ''} onChange={(event) => {
                patchPrimaryMapBinding({ markerId: event.target.value || undefined });
              }} /></label>
              <ZoneReferenceInput
                label="Zone ID"
                hint="Выберите существующую зону или введите zoneId вручную."
                listId="npc-location-zone-ids"
                value={primaryMapBinding?.zoneId ?? ''}
                zones={zones}
                onChange={(value) => patchPrimaryMapBinding({ zoneId: value || undefined })}
              />
              <label><AdminFieldLabel label="Spawn Type" hint="Тип появления NPC." /><select value={primaryMapBinding?.spawnType ?? 'fixed'} onChange={(event) => {
                patchPrimaryMapBinding({ spawnType: event.target.value as NpcMapBinding['spawnType'] });
              }}>{MAP_SPAWN_TYPES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
              <label><AdminFieldLabel label="X" hint="Нормализованная координата X (0..1). Для city zone можно не заполнять." /><input type="number" min={0} max={1} step={0.01} value={primaryMapBinding?.x ?? ''} onChange={(event) => {
                patchPrimaryMapBinding({ x: event.target.value ? Number(event.target.value) : undefined });
              }} /></label>
              <label><AdminFieldLabel label="Y" hint="Нормализованная координата Y (0..1). Для city zone можно не заполнять." /><input type="number" min={0} max={1} step={0.01} value={primaryMapBinding?.y ?? ''} onChange={(event) => {
                patchPrimaryMapBinding({ y: event.target.value ? Number(event.target.value) : undefined });
              }} /></label>
              <label className="zone-editor-checkbox"><input type="checkbox" checked={primaryMapBinding?.visibleToPlayer ?? true} onChange={(event) => {
                patchPrimaryMapBinding({ visibleToPlayer: event.target.checked });
              }} /><AdminFieldLabel label="Visible to player" hint="Показывать NPC игроку на карте." /></label>
            </div>

            <section className="card admin-item-preview npc-location-preview">
              <h4>Resolved location preview</h4>
              <p className="muted">Карточка списка: {draftCardSummary.titleLine} {draftCardSummary.placeLine ? `• ${draftCardSummary.placeLine}` : ''}</p>
              <p className="muted">По месту: {resolvedDraftPlace.label}</p>
              <p className="muted">Категория: {resolvedDraftPlace.category}</p>
              <p className="muted">Kingdom: {resolvedDraftPlace.kingdomName || 'не определено'}</p>
              <p className="muted">Region: {resolvedDraftPlace.regionName || 'не определено'}</p>
              <p className="muted">Zone: {locationZone ? buildWorldZoneLabel(locationZone) : (primaryMapBinding?.zoneId ? 'Зона не найдена' : 'Зона не задана')}</p>
              <p className="muted">World location: {selectedWorldLocation ? `${selectedWorldLocation.name} (${selectedWorldLocation.subtype ?? 'location'})` : (draft.locationId ? 'Локация не найдена' : 'Локация не задана')}</p>
            </section>

            <section className="card admin-item-preview">
              <h4>Map bindings JSON</h4>
              <textarea rows={10} value={mapBindingsJson} onChange={(event) => setMapBindingsJson(event.target.value)} onBlur={() => patch({ mapBindings: parseJsonArray<NpcMapBinding>(mapBindingsJson, draft.mapBindings) })} />
              <p className="muted">Доступные zoneId: {zoneListText || '-'}</p>
              <p className="muted">Доступные markerId: {markerIds.join(', ') || '-'}</p>
            </section>
          </>
        ) : null}

        {activeTab === 'combat' ? (
          <div className="admin-form-grid">
            <label><AdminFieldLabel label="Level" hint="Боевой уровень NPC." /><input type="number" value={draft.combat?.level ?? 1} onChange={(event) => patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), level: Number(event.target.value) || 1 } })} /></label>
            <label><AdminFieldLabel label="Role" hint="Боевая роль NPC." /><input value={draft.combat?.role ?? 'none'} onChange={(event) => patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), role: event.target.value as NonNullable<NpcDefinition['combat']>['role'] } })} /></label>
            <label><AdminFieldLabel label="HP" hint="Очки здоровья." /><input type="number" value={draft.combat?.hp ?? 100} onChange={(event) => patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), hp: Number(event.target.value) || 1 } })} /></label>
            <label><AdminFieldLabel label="Mana" hint="Очки маны." /><input type="number" value={draft.combat?.mana ?? ''} onChange={(event) => patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), mana: event.target.value ? Number(event.target.value) : undefined } })} /></label>
            <label><AdminFieldLabel label="Stamina" hint="Очки выносливости." /><input type="number" value={draft.combat?.stamina ?? ''} onChange={(event) => patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), stamina: event.target.value ? Number(event.target.value) : undefined } })} /></label>
            <label><AdminFieldLabel label="Damage Min" hint="Минимальный урон." /><input type="number" value={draft.combat?.damageMin ?? ''} onChange={(event) => patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), damageMin: event.target.value ? Number(event.target.value) : undefined } })} /></label>
            <label><AdminFieldLabel label="Damage Max" hint="Максимальный урон." /><input type="number" value={draft.combat?.damageMax ?? ''} onChange={(event) => patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), damageMax: event.target.value ? Number(event.target.value) : undefined } })} /></label>
            <label><AdminFieldLabel label="Physical Armor" hint="Физическая броня." /><input type="number" value={draft.combat?.physicalArmor ?? ''} onChange={(event) => patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), physicalArmor: event.target.value ? Number(event.target.value) : undefined } })} /></label>
            <label><AdminFieldLabel label="Magic Resist" hint="Сопротивление магии." /><input type="number" value={draft.combat?.magicResist ?? ''} onChange={(event) => patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), magicResist: event.target.value ? Number(event.target.value) : undefined } })} /></label>
            <label><AdminFieldLabel label="Weapon Item ID" hint="ID оружия NPC." /><input value={draft.combat?.weaponItemId ?? ''} onChange={(event) => patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), weaponItemId: event.target.value || undefined } })} /></label>
            <label><AdminFieldLabel label="Loot Table ID" hint="Таблица лута NPC." /><input value={draft.combat?.lootTableId ?? ''} onChange={(event) => patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), lootTableId: event.target.value || undefined } })} /></label>
            <label><AdminFieldLabel label="Battle sprite asset ID" hint="Phaser asset id for the combat token. Empty falls back to combat portrait." /><input value={draft.battleSpriteAssetId ?? ''} onChange={(event) => patch({ battleSpriteAssetId: event.target.value || undefined })} placeholder="npc_guard_sprite" /></label>
            <label><AdminFieldLabel label="Death effect ID" hint="Effect registry id used when this NPC dies." /><input list="npc-battle-effect-ids" value={draft.deathEffectId ?? ''} onChange={(event) => patch({ deathEffectId: event.target.value || undefined })} placeholder="death_fade" /></label>
            <label><AdminFieldLabel label="Hit effect preset" hint="Default impact effect for this NPC." /><input list="npc-battle-effect-ids" value={draft.hitEffectPreset ?? ''} onChange={(event) => patch({ hitEffectPreset: event.target.value || undefined })} placeholder="hit_blunt" /></label>
            <datalist id="npc-battle-effect-ids">
              {npcBattleEffectIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </datalist>
          </div>
        ) : null}

        {activeTab === 'skills' ? (
          <section className="card admin-item-preview">
            <h4>Combat skill IDs</h4>
            <textarea
              rows={8}
              value={(draft.combat?.skillIds ?? []).join('\n')}
              onChange={(event) => {
                const skillList = event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean);
                patch({ combat: { ...(draft.combat ?? { level: 1, role: 'none', hp: 100, skillIds: [] }), skillIds: skillList } });
              }}
            />
            <h4>Trainer skill IDs</h4>
            <textarea
              rows={8}
              value={(draft.trainer?.skillIds ?? []).join('\n')}
              onChange={(event) => {
                const skillList = event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean);
                patch({ trainer: { ...(draft.trainer ?? {}), skillIds: skillList } });
              }}
            />
            <p className="muted">Доступные skills: {skillIds.slice(0, 20).join(', ')}{skillIds.length > 20 ? '...' : ''}</p>
          </section>
        ) : null}

        {activeTab === 'inventory' ? (
          <>
            <div className="admin-form-grid">
              <label><AdminFieldLabel label="Loot table" hint="Таблица лута для инвентаря." /><input value={draft.inventory?.lootTableId ?? ''} onChange={(event) => patch({ inventory: { ...(draft.inventory ?? { itemIds: [], questItemIds: [] }), lootTableId: event.target.value || undefined } })} /></label>
              <label><AdminFieldLabel label="Gold Min" hint="Минимум золота." /><input type="number" value={draft.inventory?.goldMin ?? ''} onChange={(event) => patch({ inventory: { ...(draft.inventory ?? { itemIds: [], questItemIds: [] }), goldMin: event.target.value ? Number(event.target.value) : undefined } })} /></label>
              <label><AdminFieldLabel label="Gold Max" hint="Максимум золота." /><input type="number" value={draft.inventory?.goldMax ?? ''} onChange={(event) => patch({ inventory: { ...(draft.inventory ?? { itemIds: [], questItemIds: [] }), goldMax: event.target.value ? Number(event.target.value) : undefined } })} /></label>
            </div>

            <section className="card admin-item-preview">
              <h4>Inventory itemIds</h4>
              <textarea rows={8} value={(draft.inventory?.itemIds ?? []).join('\n')} onChange={(event) => patch({ inventory: { ...(draft.inventory ?? { itemIds: [], questItemIds: [] }), itemIds: event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean) } })} />
              <h4>Inventory questItemIds</h4>
              <textarea rows={8} value={(draft.inventory?.questItemIds ?? []).join('\n')} onChange={(event) => patch({ inventory: { ...(draft.inventory ?? { itemIds: [], questItemIds: [] }), questItemIds: event.target.value.split('\n').map((entry) => entry.trim()).filter(Boolean) } })} />
              <p className="muted">Item refs: {itemIds.slice(0, 12).join(', ')}{itemIds.length > 12 ? '...' : ''}</p>
              <p className="muted">Quest item refs: {questItemIds.slice(0, 12).join(', ')}{questItemIds.length > 12 ? '...' : ''}</p>
              <p className="muted">Loot tables: {lootTableIds.slice(0, 12).join(', ')}{lootTableIds.length > 12 ? '...' : ''}</p>
            </section>
          </>
        ) : null}

        {activeTab === 'trade' ? (
          <section className="card admin-item-preview">
            <div className="admin-form-grid">
              <label className="zone-editor-checkbox"><input type="checkbox" checked={draft.canTrade} onChange={(event) => patch({ canTrade: event.target.checked })} /><AdminFieldLabel label="Can trade" hint="Разрешить торговлю через trader profile." /></label>
              <label className="zone-editor-checkbox"><input type="checkbox" checked={Boolean(draft.worldSimTrader)} onChange={(event) => patch({ worldSimTrader: event.target.checked })} /><AdminFieldLabel label="World-sim trader" hint="Разрешить выбирать этого NPC в архетипах живого мира." /></label>
              <label>
                <AdminFieldLabel label="Trader profile" hint="Связь с существующим торговцем. NPC не дублирует систему торговцев." />
                <select value={draft.traderId ?? ''} onChange={(event) => patch({ traderId: event.target.value || undefined })}>
                  <option value="">Не задано</option>
                  {traderOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry.city})</option>)}
                </select>
              </label>
            </div>

            <div className="admin-actions-row">
              <button type="button" onClick={() => { void createTraderProfileForNpc(); }}>Создать trader profile для NPC</button>
              <button type="button" onClick={() => { void createDialogueForNpc(); }}>Создать диалог для NPC</button>
              <button type="button" onClick={() => { void createWorldSimArchetypeForNpc(); }}>Создать world-sim archetype</button>
            </div>

            {linkedTraderSummary ? (
              <p className="muted">Профиль: {linkedTraderSummary.name} | {linkedTraderSummary.city} | {linkedTraderSummary.enabled ? 'enabled' : 'disabled'} | {linkedTraderSummary.assortment} позиций</p>
            ) : (
              <p className="muted">Trader profile не выбран.</p>
            )}
          </section>
        ) : null}

        {activeTab === 'dialogues' ? (
          <section className="card admin-item-preview">
            <h4>Dialogue bindings</h4>
            <div className="admin-form-grid">
              <label><AdminFieldLabel label="Dialogue start voice asset ID" hint="Audio asset id for the first voice line when this NPC opens dialogue." /><input value={draft.dialogueStartVoiceAssetId ?? ''} onChange={(event) => patch({ dialogueStartVoiceAssetId: event.target.value || undefined })} placeholder="vo_guard_intro_01" /></label>
              <label><AdminFieldLabel label="Dialogue start line" hint="Optional one-line bark/subtitle used before the dialogue UI opens." /><input value={draft.dialogueStartLine ?? ''} onChange={(event) => patch({ dialogueStartLine: event.target.value || undefined })} placeholder="State your business." /></label>
              <label><AdminFieldLabel label="Voice profile ID" hint="Shared voice profile key for future TTS/voice selection." /><input value={draft.voiceProfileId ?? ''} onChange={(event) => patch({ voiceProfileId: event.target.value || undefined })} placeholder="voice_gruff_male_01" /></label>
            </div>
            <AdminAudioField
              value={draft.dialogueStartVoiceAssetId}
              onChange={(nextValue) => patch({ dialogueStartVoiceAssetId: nextValue || undefined })}
              onStatus={setStatusText}
              mode="assetId"
              suggestedAssetId={`${draft.id || 'npc'}_dialogue_start_voice`}
              suggestedName={`${draft.id || 'npc'}-dialogue-start-voice`}
              uploadFolder={buildUploadFolder('audio', 'npcs', draft.id || draft.name || undefined, 'voice')}
              label="Загрузить voice для старта диалога"
              hint="Загружает voice-файл и подставляет его asset ID в поле Dialogue start voice asset ID."
            />
            <div className="admin-actions-row">
              <button type="button" onClick={createDialogueForNpc}>Создать диалог для NPC</button>
            </div>
            <textarea rows={10} value={dialogueBindingsJson} onChange={(event) => setDialogueBindingsJson(event.target.value)} onBlur={() => patch({ dialogues: parseJsonArray(dialogueBindingsJson, draft.dialogues) })} />
            <p className="muted">Доступные dialogue IDs: {dialogueIds.join(', ') || '-'}</p>
          </section>
        ) : null}

        {activeTab === 'quests' ? (
          <section className="card admin-item-preview">
            <h4>Quest bindings</h4>
            <textarea rows={10} value={questBindingsJson} onChange={(event) => setQuestBindingsJson(event.target.value)} onBlur={() => patch({ questBindings: parseJsonArray(questBindingsJson, draft.questBindings) })} />
            <p className="muted">Доступные quest IDs: {questIds.join(', ') || '-'}</p>
            <p className="muted">canGiveQuests: {draft.canGiveQuests ? 'true' : 'false'}</p>
          </section>
        ) : null}

        {activeTab === 'behavior' ? (
          <>
            <div className="admin-form-grid">
              <label><AdminFieldLabel label="Movement radius" hint="Радиус перемещения NPC." /><input type="number" value={draft.behavior?.movementRadius ?? ''} onChange={(event) => patch({ behavior: { ...(draft.behavior ?? {}), movementRadius: event.target.value ? Number(event.target.value) : undefined } })} /></label>
              <label><AdminFieldLabel label="Interaction radius" hint="Радиус взаимодействия игрока." /><input type="number" value={draft.behavior?.interactionRadius ?? ''} onChange={(event) => patch({ behavior: { ...(draft.behavior ?? {}), interactionRadius: event.target.value ? Number(event.target.value) : undefined } })} /></label>
              <label><AdminFieldLabel label="Aggression radius" hint="Радиус агрессии NPC." /><input type="number" value={draft.behavior?.aggressionRadius ?? ''} onChange={(event) => patch({ behavior: { ...(draft.behavior ?? {}), aggressionRadius: event.target.value ? Number(event.target.value) : undefined } })} /></label>
              <ZoneReferenceInput
                label="Patrol zone"
                hint="Зона патрулирования NPC. Можно выбрать из списка или ввести вручную."
                listId="npc-patrol-zone-ids"
                value={draft.behavior?.patrolZoneId ?? ''}
                zones={zones}
                onChange={(value) => patch({ behavior: { ...(draft.behavior ?? {}), patrolZoneId: value || undefined } })}
              />
              <label><AdminFieldLabel label="Flee at HP %" hint="Порог бегства по HP." /><input type="number" value={draft.behavior?.fleeAtHpPercent ?? ''} onChange={(event) => patch({ behavior: { ...(draft.behavior ?? {}), fleeAtHpPercent: event.target.value ? Number(event.target.value) : undefined } })} /></label>
              <label className="zone-editor-checkbox"><input type="checkbox" checked={draft.behavior?.callsGuards ?? false} onChange={(event) => patch({ behavior: { ...(draft.behavior ?? {}), callsGuards: event.target.checked } })} /><AdminFieldLabel label="Calls guards" hint="Зовет стражу при агрессии." /></label>
              <label className="zone-editor-checkbox"><input type="checkbox" checked={draft.behavior?.attacksEnemiesOfFaction ?? false} onChange={(event) => patch({ behavior: { ...(draft.behavior ?? {}), attacksEnemiesOfFaction: event.target.checked } })} /><AdminFieldLabel label="Attacks faction enemies" hint="Атакует врагов фракции." /></label>
            </div>
            <label>
              <AdminFieldLabel label="Daily routine" hint="Краткое текстовое описание рутины NPC." />
              <textarea rows={5} value={draft.behavior?.dailyRoutineText ?? ''} onChange={(event) => patch({ behavior: { ...(draft.behavior ?? {}), dailyRoutineText: event.target.value || undefined } })} />
            </label>
          </>
        ) : null}

        {activeTab === 'validation' ? (
          <section className="card admin-item-preview">
            <h4>Conditions JSON</h4>
            <textarea rows={10} value={conditionsJson} onChange={(event) => setConditionsJson(event.target.value)} onBlur={() => patch({ conditions: parseJsonArray<NpcCondition>(conditionsJson, draft.conditions ?? []) })} />
            <h4>Validation</h4>
            <p>Ошибки: {validation.errors.length}</p>
            {validation.errors.map((entry) => <p key={entry} className="muted">• {entry}</p>)}
            <p>Предупреждения: {validation.warnings.length}</p>
            {validation.warnings.map((entry) => <p key={entry} className="muted">• {entry}</p>)}
          </section>
        ) : null}

        <label>
          <AdminFieldLabel label="Описание" hint="Краткое описание NPC для игрока." />
          <AdminHelpTooltip section="characters" field="description" />
          <textarea rows={3} value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
        </label>

        <label>
          <AdminFieldLabel label="Admin notes" hint="Внутренние заметки дизайнера." />
          <textarea rows={3} value={draft.adminNotes ?? ''} onChange={(event) => patch({ adminNotes: event.target.value || undefined })} />
        </label>

        <div className="admin-actions-row">
          <button disabled={isSaving} onClick={() => { void saveCurrent(); }}>{isSaving ? 'Сохранение...' : (selectedId ? 'СОХРАНИТЬ' : 'СОЗДАТЬ')}</button>
          <button onClick={() => { void createWorldSimArchetypeForNpc(); }}>WORLD-SIM ARCHETYPE</button>
          <button disabled={!selectedId} onClick={duplicateSelected}>ДУБЛИРОВАТЬ</button>
          <button disabled={!selectedId} onClick={disableSelected}>ОТКЛЮЧИТЬ</button>
          <button disabled={!selectedId} onClick={removeSelected}>УДАЛИТЬ</button>
        </div>

        <AdminSaveStatus value={saveState} />
        <p className="muted">{statusText}</p>

        <hr style={{ margin: '2rem 0', borderColor: 'rgba(117, 92, 57, 0.3)' }} />

        <div className="npc-list-bottom-section">
          <h3>ВСЕ NPC</h3>
          <div className="npc-list-bottom-controls">
            <button onClick={createNpc} title="Создать новый NPC">+ СОЗДАТЬ</button>
            <button disabled={!selectedId} onClick={duplicateSelected} title="Дублировать выбранный NPC">ДУБЛИРОВАТЬ</button>
            <button disabled={!selectedId} onClick={disableSelected} title="Отключить выбранный NPC">ОТКЛЮЧИТЬ</button>
            <button disabled={!selectedId} onClick={removeSelected} title="Удалить выбранный NPC">УДАЛИТЬ</button>
            <button onClick={exportJson} title="Экспортировать все NPC в JSON">ЭКСПОРТ</button>
            <button disabled={isImporting || isSaving} onClick={() => importFileRef.current?.click()} title="Импортировать NPC из JSON файла">
              {isImporting ? 'ИМПОРТ...' : 'ИМПОРТ'}
            </button>
            <input ref={importFileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={handleImportFile} />
          </div>

          <div className="npc-list-bottom-filters">
            <input
              placeholder="Поиск по имени, титулу или ID..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label className="npc-list-grouping">
              <strong>Группировать:</strong>
              <select value={groupingKey} onChange={(event) => setGroupingKey(event.target.value as GroupingKey)}>
                {GROUPING_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {getGroupingLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <div className="npc-list-quick-filters">
              {QUICK_FILTER_OPTIONS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`npc-filter-chip ${quickFilters[filter.key] ? 'is-active' : ''}`}
                  onClick={() => toggleQuickFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <span className="muted">Всего: {visibleNpcs.length}</span>
          </div>

          <NpcGroupList
            groups={groupNpcsByKey(visibleNpcs, groupingKey, groupingContext)}
            selectedId={selectedId}
            storedImages={storedImages}
            groupingContext={groupingContext}
            onSelect={selectNpc}
          />
        </div>
      </AdminSectionErrorBoundary>
    </div>
    );
}
