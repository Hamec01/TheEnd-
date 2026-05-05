import { useEffect, useMemo, useState } from 'react';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { AdminImageField } from '../AdminImageField';
import { ZoneReferenceInput } from '../ZoneReferenceInput';
import { AdminFieldLabel } from '../adminUi';
import { subscribeToContentSync } from '../../services/content/contentSync';
import { ensureDialoguesLoaded, getAllDialogues, saveDialogue } from '../../services/dialogueRepository';
import { itemsService } from '../../services/content/itemsService';
import { lootTablesService } from '../../services/content/lootTablesService';
import { merchantsService } from '../../services/content/merchantsService';
import { skillsService } from '../../services/content/skillsService';
import { ensureQuestMarkersLoaded, getQuestMarkers } from '../../services/questMapRepository';
import { ensureQuestsLoaded, getAllQuests, getQuestItems } from '../../services/questRepository';
import { ensureNpcsLoaded, getAllNpcs, saveNpc, renameNpc, deleteNpc, duplicateNpc, exportNpcsJson, importNpcsJson } from '../../services/npcRepository';
import { validateNpc } from '../../services/npcValidator';
import { buildWorldZoneLabel, getAllZones, refreshZonesFromBackend } from '../../services/worldRepository';
import { cityService } from '../../services/cityRepository';
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
import { getIdQualityWarning, runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';

const NPC_STATUSES: NpcStatus[] = ['draft', 'active', 'disabled', 'archived'];
const NPC_KINDS: NpcKind[] = ['civilian', 'quest_giver', 'trader', 'trainer', 'guard', 'enemy', 'boss', 'companion', 'random_encounter', 'story_character', 'monster', 'animal'];
const NPC_RACES: NpcRace[] = ['human', 'high_elf', 'forest_elf', 'ancient_elf', 'dwarf', 'orc', 'dark_elf', 'arin_fellar', 'monster', 'beast', 'undead', 'spirit', 'other'];
const NPC_DISPOSITIONS: NpcDispositionMode[] = ['friendly', 'neutral', 'hostile', 'fearful', 'aggressive_on_sight', 'quest_locked', 'hidden'];
const MAP_SPAWN_TYPES: NpcMapBinding['spawnType'][] = ['fixed', 'random_in_zone', 'quest_spawn', 'event_spawn'];

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

function formatLabel(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function NpcsPage() {
  const [npcs, setNpcs] = useState<NpcDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NpcDefinition>(emptyNpc());
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<NpcTab>('basic');
  const [statusText, setStatusText] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);

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
    ]).then(([, , , , skills, items, merchants, lootTables]) => {
      setSkillIds(skills.map((entry) => entry.id));
      setItemIds(items.map((entry) => entry.id));
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
        ]).then(([, , , skills, items, merchants, lootTables]) => {
          setSkillIds(skills.map((entry) => entry.id));
          setItemIds(items.map((entry) => entry.id));
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
  const selectedCityLocation = useMemo(() => {
    if (!draft.cityLocationId || !currentCity) return null;
    return currentCity.locations.find((location) => location.id === draft.cityLocationId) ?? null;
  }, [currentCity, draft.cityLocationId]);

  useEffect(() => {
    setMapBindingsJson(JSON.stringify(draft.mapBindings, null, 2));
    setDialogueBindingsJson(JSON.stringify(draft.dialogues, null, 2));
    setQuestBindingsJson(JSON.stringify(draft.questBindings, null, 2));
    setConditionsJson(JSON.stringify(draft.conditions ?? [], null, 2));
  }, [draft]);

  const zoneIds = useMemo(() => zones.map((zone) => zone.id), [zones]);

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
    kingdomIds: ['artalon', 'none'],
    cityIds: ['arklein', 'brenhold', 'ironcrest', 'whisper_port'],
    mapIds: ['worldmap-main'],
  }), [dialogueIds, itemIds, markerIds, questIds, questItemIds, skillIds, traderOptions, zoneIds]);

  const validation = useMemo(() => validateNpc(draft, worldData), [draft, worldData]);

  const visibleNpcs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return npcs.filter((entry) => {
      if (!q) {
        return true;
      }
      return entry.id.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q) || (entry.title ?? '').toLowerCase().includes(q);
    });
  }, [npcs, query]);

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
  const zoneListText = useMemo(() => zones.map((zone) => buildWorldZoneLabel(zone)).join(', '), [zones]);

  function patchPrimaryMapBinding(next: Partial<NpcMapBinding>) {
    const current = draft.mapBindings[0] ?? { id: `map_${Date.now()}`, mapId: 'worldmap-main', spawnType: 'fixed', visibleToPlayer: true };
    patch({ mapBindings: [{ ...current, ...next }] });
  }

  function patch(next: Partial<NpcDefinition>) {
    setDraft((current) => ({ ...current, ...next, updatedAt: new Date().toISOString() }));
  }

  function createNpc() {
    setSelectedId(null);
    setDraft(emptyNpc());
    setStatusText('Новый NPC. Заполните форму справа.');
  }

  function selectNpc(npc: NpcDefinition) {
    setSelectedId(npc.id);
    setDraft({ ...npc });
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
      mapBindings: parseJsonArray<NpcMapBinding>(mapBindingsJson, draft.mapBindings),
      dialogues: parseJsonArray(draft.dialogues ? dialogueBindingsJson : '[]', draft.dialogues),
      questBindings: parseJsonArray(draft.questBindings ? questBindingsJson : '[]', draft.questBindings),
      conditions: parseJsonArray<NpcCondition>(conditionsJson, draft.conditions ?? []),
      updatedAt: new Date().toISOString(),
      createdAt: draft.createdAt || new Date().toISOString(),
    };

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

  async function exportJson() {
    const json = await exportNpcsJson();
    navigator.clipboard.writeText(json).then(() => {
      setStatusText('JSON NPC скопирован в буфер обмена.');
    }).catch(() => {
      setStatusText('Не удалось скопировать JSON.');
    });
  }

  async function importJson() {
    const raw = window.prompt('Вставьте JSON NPC для импорта:');
    if (!raw) {
      return;
    }

    try {
      const count = await importNpcsJson(raw);
      refresh();
      setStatusText(`Импорт NPC завершен: ${count}`);
    } catch (error) {
      setStatusText((error as Error).message);
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
      status: 'draft',
      startNodeId: 'start',
      nodes: [{
        id: 'start',
        speaker: 'npc',
        text: '',
        choices: [],
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

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <input placeholder="Поиск NPC" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button onClick={createNpc}>СОЗДАТЬ</button>
          <button disabled={!selectedId} onClick={duplicateSelected}>ДУБЛИРОВАТЬ</button>
          <button disabled={!selectedId} onClick={disableSelected}>ОТКЛЮЧИТЬ</button>
          <button disabled={!selectedId} onClick={removeSelected}>УДАЛИТЬ</button>
          <button onClick={exportJson}>ЭКСПОРТ JSON</button>
          <button onClick={importJson}>ИМПОРТ JSON</button>
        </div>

        {selectedNpc ? (
          <section className="card admin-item-preview">
            <h4>{selectedNpc.name || '(без названия)'}</h4>
            <p>{selectedNpc.id}</p>
            <p>{formatLabel(selectedNpc.kind)} | {formatLabel(selectedNpc.status)}</p>
            <p>{formatLabel(selectedNpc.race)} | {formatLabel(selectedNpc.defaultDisposition)}</p>
          </section>
        ) : null}

        <div className="admin-scroll-list">
          {visibleNpcs.map((entry) => (
            <button key={entry.id} className={selectedId === entry.id ? 'is-active' : ''} onClick={() => selectNpc(entry)}>
              <strong>{entry.name || '(без названия)'}</strong>
              <span>{entry.id} | {formatLabel(entry.kind)} | {formatLabel(entry.status)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form-panel">
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

        {activeTab === 'basic' ? (
          <div className="admin-form-grid">
            <label><AdminFieldLabel label="ID" hint="Уникальный ID NPC." /><input value={draft.id} onChange={(event) => patch({ id: event.target.value })} /></label>
            <label><AdminFieldLabel label="Имя" hint="Отображаемое имя NPC." /><input value={draft.name} onChange={(event) => patch({ name: event.target.value })} /></label>
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
            <AdminImageField value={draft.portraitUrl} onChange={(next) => patch({ portraitUrl: next || undefined })} onStatus={setStatusText} presetId="merchant-portrait" suggestedName={`${draft.id || 'npc'}-portrait`} label="Портрет NPC" hint="Главный портрет персонажа." />
            <AdminImageField value={draft.fullImageUrl} onChange={(next) => patch({ fullImageUrl: next || undefined })} onStatus={setStatusText} presetId="merchant-portrait" suggestedName={`${draft.id || 'npc'}-full`} label="Полное изображение" hint="Полноразмерное изображение для карточек." />
            <AdminImageField value={draft.combatImageUrl} onChange={(next) => patch({ combatImageUrl: next || undefined })} onStatus={setStatusText} presetId="merchant-portrait" suggestedName={`${draft.id || 'npc'}-combat`} label="Боевой портрет" hint="Изображение для боя." />
            <AdminImageField value={draft.iconUrl} onChange={(next) => patch({ iconUrl: next || undefined })} onStatus={setStatusText} presetId="item-icon" suggestedName={`${draft.id || 'npc'}-icon`} label="Иконка NPC" hint="Иконка маркера NPC на карте." />
          </>
        ) : null}

        {activeTab === 'location' ? (
          <>
            <div className="admin-form-grid">
              <label>
                <AdminFieldLabel label="Home City" hint="Родной город NPC. Не обязателен, но полезен для логики появления/диалогов." />
                <select value={draft.homeCityId ?? ''} onChange={(event) => patch({ homeCityId: event.target.value || undefined })}>
                  <option value="">Не задано</option>
                  {cities.map((city) => <option key={city.id} value={city.id}>{city.name} ({city.id})</option>)}
                </select>
              </label>
              {draft.homeCityId && !homeCity ? <p className="muted">City not found</p> : null}

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
              {draft.currentCityId && !currentCity ? <p className="muted">City not found</p> : null}

              <label>
                <AdminFieldLabel label="City Location" hint="Локация внутри выбранного Current City (ворота, рынок, кузница и т.д.)." />
                <select
                  value={draft.cityLocationId ?? ''}
                  onChange={(event) => patch({ cityLocationId: event.target.value || undefined })}
                  disabled={!draft.currentCityId}
                >
                  <option value="">Не задано</option>
                  {currentCityLocations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.id})</option>)}
                </select>
              </label>
              {draft.cityLocationId && draft.currentCityId && !selectedCityLocation ? <p className="muted">Location not found</p> : null}

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

            {locationZone ? <p className="muted">Выбрана зона: {buildWorldZoneLabel(locationZone)}</p> : null}

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
              <label>
                <AdminFieldLabel label="Trader profile" hint="Связь с существующим торговцем. NPC не дублирует систему торговцев." />
                <select value={draft.traderId ?? ''} onChange={(event) => patch({ traderId: event.target.value || undefined })}>
                  <option value="">Не задано</option>
                  {traderOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({entry.city})</option>)}
                </select>
              </label>
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
          <textarea rows={3} value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
        </label>

        <label>
          <AdminFieldLabel label="Admin notes" hint="Внутренние заметки дизайнера." />
          <textarea rows={3} value={draft.adminNotes ?? ''} onChange={(event) => patch({ adminNotes: event.target.value || undefined })} />
        </label>

        <div className="admin-actions-row">
          <button disabled={isSaving} onClick={() => { void saveCurrent(); }}>{isSaving ? 'Сохранение...' : (selectedId ? 'СОХРАНИТЬ' : 'СОЗДАТЬ')}</button>
          <button disabled={!selectedId} onClick={duplicateSelected}>ДУБЛИРОВАТЬ</button>
          <button disabled={!selectedId} onClick={disableSelected}>ОТКЛЮЧИТЬ</button>
          <button disabled={!selectedId} onClick={removeSelected}>УДАЛИТЬ</button>
        </div>

        <AdminSaveStatus value={saveState} />
        <p className="muted">{statusText}</p>
      </section>
    </div>
  );
}
