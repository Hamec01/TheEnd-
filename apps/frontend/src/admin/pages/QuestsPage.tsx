import { useEffect, useMemo, useState } from 'react';
import { AdminImageField } from '../AdminImageField';
import { ZoneReferenceInput } from '../ZoneReferenceInput';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';
import { subscribeToContentSync } from '../../services/content/contentSync';
import { imageService } from '../../services/content/imageService';
import { resolveStoredImageSource } from '../../services/content/runtimeImageService';
import { QUEST_SEED_CITIES, QUEST_SEED_FACTIONS, QUEST_SEED_KINGDOMS } from '../../services/questWorldSeed';
import {
  deleteQuest,
  duplicateQuest,
  ensureQuestsLoaded,
  exportQuestsJson,
  getAllQuests,
  importQuestsJson,
  saveQuest,
} from '../../services/questRepository';
import { ensureNpcsLoaded, getAllNpcs } from '../../services/npcRepository';
import { validateQuest } from '../../services/questValidator';
import { buildWorldZoneLabel, getAllZones, refreshZonesFromBackend } from '../../services/worldRepository';
import type {
  QuestCategory,
  QuestCondition,
  QuestDefinition,
  QuestObjective,
  QuestReward,
  QuestStatus,
  QuestStep,
  QuestTrigger,
  QuestValidationResult,
} from '../../types/quest';
import type { StoredImage } from '../../services/content/models';
import type { WorldMapZone } from '../../worldmap/zoneEditorTypes';

const QUEST_CATEGORIES: QuestCategory[] = ['global', 'kingdom', 'faction', 'profession', 'lore', 'city', 'npc', 'random', 'hidden', 'repeatable'];
const QUEST_STATUSES: QuestStatus[] = ['draft', 'active', 'disabled', 'archived'];

function formatLabel(value: string): string {
  return value.split('_').map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1)).join(' ');
}

function emptyQuest(): QuestDefinition {
  const now = new Date().toISOString();
  return {
    id: '',
    title: '',
    adminDescription: '',
    playerDescription: '',
    category: 'global',
    status: 'draft',
    isRepeatable: false,
    isHidden: false,
    portraitUrl: '',
    imageUrl: '',
    bannerUrl: '',
    steps: [],
    triggers: [],
    conditions: [],
    rewards: [],
    failureConsequences: [],
    flags: {},
    createdAt: now,
    updatedAt: now,
  };
}

function safeParseJson<T>(raw: string, fallback: T): T {
  if (!raw.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uniqueId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildValidationWorldData(quests: QuestDefinition[], zones: WorldMapZone[]) {
  const npcIds = getAllNpcs().map((entry) => entry.id);
  return {
    npcIds,
    itemIds: [],
    questItemIds: [],
    professionIds: ['archer', 'blacksmith', 'alchemist', 'hunter'],
    markerIds: [],
    zoneIds: zones.map((zone) => zone.id),
    dialogueIds: quests.flatMap((quest) => quest.triggers.map((trigger) => trigger.dialogueId)).filter(Boolean) as string[],
    kingdoms: [...QUEST_SEED_KINGDOMS],
    factions: [...QUEST_SEED_FACTIONS],
    cities: [...QUEST_SEED_CITIES],
  };
}

export function QuestsPage() {
  const [quests, setQuests] = useState<QuestDefinition[]>([]);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestDefinition>(emptyQuest());
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | QuestCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | QuestStatus>('all');
  const [kingdomFilter, setKingdomFilter] = useState<'all' | string>('all');
  const [cityFilter, setCityFilter] = useState<'all' | string>('all');
  const [factionFilter, setFactionFilter] = useState<'all' | string>('all');
  const [status, setStatus] = useState('Готово');
  const [validation, setValidation] = useState<QuestValidationResult>({ errors: [], warnings: [] });
  const [npcIds, setNpcIds] = useState<string[]>([]);
  const [zones, setZones] = useState<WorldMapZone[]>(() => getAllZones());

  const [stepsJson, setStepsJson] = useState('[]');
  const [conditionsJson, setConditionsJson] = useState('[]');
  const [rewardsJson, setRewardsJson] = useState('[]');
  const [failureJson, setFailureJson] = useState('[]');
  const [triggersJson, setTriggersJson] = useState('[]');

  async function refresh() {
    await Promise.all([ensureQuestsLoaded(), ensureNpcsLoaded()]);
    const [nextQuests, nextImages] = await Promise.all([Promise.resolve(getAllQuests()), imageService.getAll()]);
    setQuests(nextQuests);
    setImages(nextImages);

    if (selectedId) {
      const selected = nextQuests.find((quest) => quest.id === selectedId) ?? null;
      if (!selected) {
        setSelectedId(null);
        setDraft(emptyQuest());
      }
    }

    setNpcIds(getAllNpcs().map((entry) => entry.id));
  }

  useEffect(() => {
    void refresh();

    setZones(getAllZones());
    void refreshZonesFromBackend().then(setZones).catch(() => undefined);

    const unsubscribe = subscribeToContentSync((payload) => {
      if (payload.scope === 'worldMap' || payload.scope === 'all') {
        void refreshZonesFromBackend().then(setZones).catch(() => undefined);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    setStepsJson(JSON.stringify(draft.steps, null, 2));
    setConditionsJson(JSON.stringify(draft.conditions, null, 2));
    setRewardsJson(JSON.stringify(draft.rewards, null, 2));
    setFailureJson(JSON.stringify(draft.failureConsequences, null, 2));
    setTriggersJson(JSON.stringify(draft.triggers, null, 2));

    const worldData = buildValidationWorldData(quests, zones);
    setValidation(validateQuest(draft, worldData));
  }, [draft, quests, zones]);

  const visibleQuests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quests.filter((quest) => {
      if (q && !quest.id.toLowerCase().includes(q) && !quest.title.toLowerCase().includes(q)) {
        return false;
      }
      if (categoryFilter !== 'all' && quest.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all' && quest.status !== statusFilter) {
        return false;
      }
      if (kingdomFilter !== 'all' && quest.kingdomId !== kingdomFilter) {
        return false;
      }
      if (cityFilter !== 'all' && quest.cityId !== cityFilter) {
        return false;
      }
      if (factionFilter !== 'all' && quest.factionId !== factionFilter) {
        return false;
      }
      return true;
    });
  }, [categoryFilter, cityFilter, factionFilter, kingdomFilter, query, quests, statusFilter]);

  const selectedQuest = useMemo(
    () => (selectedId ? quests.find((entry) => entry.id === selectedId) ?? null : null),
    [quests, selectedId],
  );
  const zoneListText = useMemo(() => zones.map((zone) => buildWorldZoneLabel(zone)).join(', '), [zones]);
  const triggerZoneEntries = useMemo(
    () => draft.triggers.map((trigger, index) => ({ trigger, index })),
    [draft.triggers],
  );
  const objectiveZoneEntries = useMemo(
    () => draft.steps.flatMap((step, stepIndex) => step.objectives.map((objective, objectiveIndex) => ({ step, objective, stepIndex, objectiveIndex }))),
    [draft.steps],
  );

  function getQuestCardAccent(quest: QuestDefinition): string {
    if (quest.status === 'disabled' || quest.status === 'archived') {
      return 'is-crimson';
    }
    if (quest.category === 'random' || quest.isRepeatable) {
      return 'is-sky';
    }
    if (quest.category === 'hidden' || quest.isHidden) {
      return 'is-olive';
    }
    return 'is-gold';
  }

  function patch(next: Partial<QuestDefinition>) {
    setDraft((current) => ({ ...current, ...next, updatedAt: new Date().toISOString() }));
  }

  function select(quest: QuestDefinition) {
    setSelectedId(quest.id);
    setDraft({ ...quest });
    setStatus(`Редактируется квест: ${quest.id}`);
  }

  async function saveCurrent() {
    const worldData = buildValidationWorldData(quests, zones);
    const result = validateQuest(draft, worldData);
    setValidation(result);

    if (draft.status === 'active' && result.errors.length > 0) {
      setStatus('Нельзя активировать квест с критическими ошибками. Нажмите ПРОВЕРИТЬ КВЕСТ.');
      return;
    }

    const prepared: QuestDefinition = {
      ...draft,
      id: draft.id.trim() || uniqueId('quest'),
      title: draft.title.trim(),
      updatedAt: new Date().toISOString(),
      createdAt: draft.createdAt || new Date().toISOString(),
      steps: safeParseJson<QuestStep[]>(stepsJson, draft.steps),
      conditions: safeParseJson<QuestCondition[]>(conditionsJson, draft.conditions),
      rewards: safeParseJson<QuestReward[]>(rewardsJson, draft.rewards),
      failureConsequences: safeParseJson<QuestReward[]>(failureJson, draft.failureConsequences),
      triggers: safeParseJson<QuestTrigger[]>(triggersJson, draft.triggers),
    };

    try {
      const saved = await saveQuest(prepared);
      setSelectedId(saved.id);
      setDraft(saved);
      await refresh();
      setStatus(`Квест сохранен: ${saved.id}`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function duplicateSelectedQuest() {
    if (!selectedId) {
      return;
    }
    try {
      const copied = await duplicateQuest(selectedId);
      await refresh();
      setSelectedId(copied.id);
      setDraft(copied);
      setStatus(`Создана копия: ${copied.id}`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function disableSelectedQuest() {
    if (!selectedId) {
      return;
    }

    const selected = quests.find((quest) => quest.id === selectedId);
    if (!selected) {
      return;
    }

    await saveQuest({ ...selected, status: 'disabled' });
    await refresh();
    setStatus(`Квест отключен: ${selectedId}`);
  }

  async function deleteSelectedQuest() {
    if (!selectedId) {
      return;
    }

    await deleteQuest(selectedId);
    setSelectedId(null);
    setDraft(emptyQuest());
    await refresh();
    setStatus(`Квест удален: ${selectedId}`);
  }

  function createQuest() {
    setSelectedId(null);
    setDraft(emptyQuest());
    setStatus('Новый квест. Заполните поля и сохраните.');
  }

  function addStep() {
    const stepId = uniqueId('step');
    const objectiveId = uniqueId('obj');
    const nextStep: QuestStep = {
      id: stepId,
      questId: draft.id || '',
      title: `Step ${draft.steps.length + 1}`,
      journalText: '',
      order: draft.steps.length + 1,
      objectives: [
        {
          id: objectiveId,
          type: 'talk_to_npc',
          description: 'New objective',
        } as QuestObjective,
      ],
    };

    patch({ steps: [...draft.steps, nextStep] });
  }

  async function exportJson() {
    const payload = await exportQuestsJson();
    navigator.clipboard.writeText(payload).then(() => {
      setStatus('JSON квестов скопирован в буфер обмена.');
    }).catch(() => {
      setStatus('Не удалось скопировать JSON автоматически.');
    });
  }

  async function importJson() {
    const raw = window.prompt('Вставьте JSON для импорта квестов и предметов:');
    if (!raw) {
      return;
    }

    try {
      const result = await importQuestsJson(raw);
      await refresh();
      setStatus(`Импорт завершен: квестов ${result.quests}, квестовых предметов ${result.questItems}.`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  function validateCurrentQuest() {
    const worldData = buildValidationWorldData(quests, zones);
    const result = validateQuest(draft, worldData);
    setValidation(result);
    setStatus(`Проверка: ${result.errors.length} ошибок, ${result.warnings.length} предупреждений.`);
  }

  function updateTriggerZone(index: number, zoneId: string) {
    patch({
      triggers: draft.triggers.map((trigger, triggerIndex) => triggerIndex === index ? { ...trigger, zoneId: zoneId || undefined } : trigger),
    });
  }

  function updateObjectiveZone(stepIndex: number, objectiveIndex: number, zoneId: string) {
    patch({
      steps: draft.steps.map((step, currentStepIndex) => currentStepIndex === stepIndex
        ? {
            ...step,
            objectives: step.objectives.map((objective, currentObjectiveIndex) => currentObjectiveIndex === objectiveIndex
              ? { ...objective, zoneId: zoneId || undefined }
              : objective),
          }
        : step),
    });
  }

  function resolveImage(imageKey: string | undefined): string | undefined {
    if (!imageKey) {
      return undefined;
    }
    return resolveStoredImageSource(imageKey, images);
  }

  return (
    <div className="admin-page-grid">
      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Стабильный id для квестовых связок." />
            <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Название" hint="Название квеста, видимое игроку." />
            <input value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Категория" hint="Тип квеста: global, kingdom, faction, npc, random и т.д." />
            <select value={draft.category} onChange={(event) => patch({ category: event.target.value as QuestCategory })}>
              {QUEST_CATEGORIES.map((category) => <option key={category} value={category}>{formatLabel(category)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Статус" hint="Draft/active/disabled/archived. Active блокируется при критических ошибках." />
            <select value={draft.status} onChange={(event) => patch({ status: event.target.value as QuestStatus })}>
              {QUEST_STATUSES.map((entry) => <option key={entry} value={entry}>{formatLabel(entry)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Королевство" hint="Привязка к королевству для kingdom-квестов." />
            <select value={draft.kingdomId ?? ''} onChange={(event) => patch({ kingdomId: event.target.value || undefined })}>
              <option value="">Не задано</option>
              {QUEST_SEED_KINGDOMS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Фракция" hint="Привязка к фракции." />
            <select value={draft.factionId ?? ''} onChange={(event) => patch({ factionId: event.target.value || undefined })}>
              <option value="">Не задано</option>
              {QUEST_SEED_FACTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Город" hint="Привязка к городу." />
            <select value={draft.cityId ?? ''} onChange={(event) => patch({ cityId: event.target.value || undefined })}>
              <option value="">Не задано</option>
              {QUEST_SEED_CITIES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="NPC" hint="ID квестодателя или связанного NPC." />
            <select value={draft.npcId ?? ''} onChange={(event) => patch({ npcId: event.target.value || undefined })}>
              <option value="">Не задано</option>
              {npcIds.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Мин. уровень" hint="Минимальный уровень игрока для старта." />
            <input type="number" value={draft.minLevel ?? ''} onChange={(event) => patch({ minLevel: event.target.value ? Number(event.target.value) : undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Рек. уровень" hint="Рекомендованный уровень для прохождения." />
            <input type="number" value={draft.recommendedLevel ?? ''} onChange={(event) => patch({ recommendedLevel: event.target.value ? Number(event.target.value) : undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Макс. уровень" hint="Ограничение максимального уровня при необходимости." />
            <input type="number" value={draft.maxLevel ?? ''} onChange={(event) => patch({ maxLevel: event.target.value ? Number(event.target.value) : undefined })} />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isRepeatable} onChange={(event) => patch({ isRepeatable: event.target.checked })} />
            <AdminFieldLabel label="Повторяемый" hint="Repeatable contract flow." />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isHidden} onChange={(event) => patch({ isHidden: event.target.checked })} />
            <AdminFieldLabel label="Скрытый" hint="Скрытый/секретный квест." />
          </label>
        </div>

        <label>
          <AdminFieldLabel label="Описание для админа" hint="Техническое описание для дизайнера контента." />
          <textarea rows={3} value={draft.adminDescription} onChange={(event) => patch({ adminDescription: event.target.value })} />
        </label>
        <label>
          <AdminFieldLabel label="Описание для игрока" hint="Текст, который увидит игрок в журнале." />
          <textarea rows={3} value={draft.playerDescription} onChange={(event) => patch({ playerDescription: event.target.value })} />
        </label>

        <div className="admin-card-grid admin-card-grid-tight">
          <section className="card admin-item-preview">
            <h4>Portrait</h4>
            {resolveImage(draft.portraitUrl) ? <img className="admin-item-preview-icon" src={resolveImage(draft.portraitUrl)} alt="portrait" /> : <p className="muted">Нет превью</p>}
          </section>
          <section className="card admin-item-preview">
            <h4>Image</h4>
            {resolveImage(draft.imageUrl) ? <img className="admin-item-preview-icon" src={resolveImage(draft.imageUrl)} alt="image" /> : <p className="muted">Нет превью</p>}
          </section>
          <section className="card admin-item-preview">
            <h4>Banner</h4>
            {resolveImage(draft.bannerUrl) ? <img className="admin-item-preview-icon" src={resolveImage(draft.bannerUrl)} alt="banner" /> : <p className="muted">Нет превью</p>}
          </section>
        </div>

        <AdminImageField
          value={draft.portraitUrl}
          onChange={(nextValue) => patch({ portraitUrl: nextValue || undefined })}
          onStatus={setStatus}
          presetId="merchant-portrait"
          suggestedName={`${draft.id || draft.title || 'quest'}-portrait`}
          label="Портрет квеста"
          hint="Загрузка портрета квеста в общее хранилище изображений. URL вручную вводить не нужно."
        />

        <AdminImageField
          value={draft.imageUrl}
          onChange={(nextValue) => patch({ imageUrl: nextValue || undefined })}
          onStatus={setStatus}
          presetId="item-icon"
          suggestedName={`${draft.id || draft.title || 'quest'}-image`}
          label="Изображение квеста"
          hint="Загрузка иллюстрации квеста в общее хранилище изображений. URL вручную вводить не нужно."
        />

        <AdminImageField
          value={draft.bannerUrl}
          onChange={(nextValue) => patch({ bannerUrl: nextValue || undefined })}
          onStatus={setStatus}
          presetId="merchant-portrait"
          suggestedName={`${draft.id || draft.title || 'quest'}-banner`}
          label="Баннер квеста"
          hint="Загрузка баннера квеста в общее хранилище изображений. URL вручную вводить не нужно."
        />

        <section className="card admin-item-preview">
          <h4>Steps</h4>
          <div className="admin-actions-row">
            <button type="button" onClick={addStep}>Добавить шаг</button>
          </div>
          <textarea rows={12} value={stepsJson} onChange={(event) => setStepsJson(event.target.value)} onBlur={() => patch({ steps: safeParseJson<QuestStep[]>(stepsJson, draft.steps) })} />
          <p className="muted">Доступные zoneId: {zoneListText || '-'}</p>
          {objectiveZoneEntries.length > 0 ? (
            <div className="admin-zone-reference-stack">
              {objectiveZoneEntries.map(({ step, objective, stepIndex, objectiveIndex }) => (
                <ZoneReferenceInput
                  key={`${step.id}:${objective.id}`}
                  label={`Objective ${objective.id}`}
                  hint={`Шаг ${step.title || step.id}. Для objective можно выбрать существующую зону или ввести zoneId вручную.`}
                  listId={`quest-objective-zone-${step.id}-${objective.id}`}
                  value={objective.zoneId ?? ''}
                  zones={zones}
                  onChange={(value) => updateObjectiveZone(stepIndex, objectiveIndex, value)}
                  emptyOptionLabel="Зона objective"
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="card admin-item-preview">
          <h4>Conditions</h4>
          <textarea rows={8} value={conditionsJson} onChange={(event) => setConditionsJson(event.target.value)} onBlur={() => patch({ conditions: safeParseJson<QuestCondition[]>(conditionsJson, draft.conditions) })} />
        </section>

        <section className="card admin-item-preview">
          <h4>Rewards</h4>
          <textarea rows={8} value={rewardsJson} onChange={(event) => setRewardsJson(event.target.value)} onBlur={() => patch({ rewards: safeParseJson<QuestReward[]>(rewardsJson, draft.rewards) })} />
          <h4>Failure Consequences</h4>
          <textarea rows={6} value={failureJson} onChange={(event) => setFailureJson(event.target.value)} onBlur={() => patch({ failureConsequences: safeParseJson<QuestReward[]>(failureJson, draft.failureConsequences) })} />
        </section>

        <section className="card admin-item-preview">
          <h4>Triggers</h4>
          <textarea rows={10} value={triggersJson} onChange={(event) => setTriggersJson(event.target.value)} onBlur={() => patch({ triggers: safeParseJson<QuestTrigger[]>(triggersJson, draft.triggers) })} />
          <p className="muted">Доступные zoneId: {zoneListText || '-'}</p>
          {triggerZoneEntries.length > 0 ? (
            <div className="admin-zone-reference-stack">
              {triggerZoneEntries.map(({ trigger, index }) => (
                <ZoneReferenceInput
                  key={trigger.id}
                  label={`Trigger ${trigger.id}`}
                  hint={`Тип ${trigger.type}. Для trigger можно выбрать существующую зону или ввести zoneId вручную.`}
                  listId={`quest-trigger-zone-${trigger.id}`}
                  value={trigger.zoneId ?? ''}
                  zones={zones}
                  onChange={(value) => updateTriggerZone(index, value)}
                  emptyOptionLabel="Зона trigger"
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="card admin-item-preview">
          <h4>Validation</h4>
          <div className="admin-actions-row">
            <button type="button" onClick={validateCurrentQuest}>ПРОВЕРИТЬ КВЕСТ</button>
          </div>
          <p>Ошибки: {validation.errors.length}</p>
          {validation.errors.map((error) => <p key={error} className="muted">• {error}</p>)}
          <p>Предупреждения: {validation.warnings.length}</p>
          {validation.warnings.map((warning) => <p key={warning} className="muted">• {warning}</p>)}
        </section>

        <div className="admin-actions-row">
          <button onClick={() => { void saveCurrent(); }}>{selectedId ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}</button>
          <button disabled={!selectedId} onClick={() => { void duplicateSelectedQuest(); }}>ДУБЛИРОВАТЬ</button>
          <button disabled={!selectedId} onClick={() => { void disableSelectedQuest(); }}>ОТКЛЮЧИТЬ</button>
          <button disabled={!selectedId} onClick={() => { void deleteSelectedQuest(); }}>УДАЛИТЬ</button>
        </div>

        <p className="muted">{status}</p>
      </section>

      <section className="admin-items-catalog card">
        <div className="admin-catalog-header">
          <div>
            <p className="admin-catalog-kicker">Quest Library</p>
            <h3>Все квесты</h3>
            <p className="muted">Список квестов теперь внизу как у предметов: выберите квест-значок, чтобы редактировать его в форме выше.</p>
          </div>
          <div className="admin-catalog-metrics">
            <span>{visibleQuests.length} в выдаче</span>
            <span>{quests.filter((entry) => entry.status === 'active').length} активных</span>
          </div>
        </div>

        <div className="admin-list-tools admin-catalog-toolbar">
          <input placeholder="Поиск по id или названию" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'all' | QuestCategory)}>
            <option value="all">Все категории</option>
            {QUEST_CATEGORIES.map((category) => <option key={category} value={category}>{formatLabel(category)}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | QuestStatus)}>
            <option value="all">Любой статус</option>
            {QUEST_STATUSES.map((entry) => <option key={entry} value={entry}>{formatLabel(entry)}</option>)}
          </select>
          <select value={kingdomFilter} onChange={(event) => setKingdomFilter(event.target.value)}>
            <option value="all">Любое королевство</option>
            {QUEST_SEED_KINGDOMS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
            <option value="all">Любой город</option>
            {QUEST_SEED_CITIES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <select value={factionFilter} onChange={(event) => setFactionFilter(event.target.value)}>
            <option value="all">Любая фракция</option>
            {QUEST_SEED_FACTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <button onClick={createQuest}>Новый квест</button>
          <button onClick={exportJson}>Экспорт JSON</button>
          <button onClick={importJson}>Импорт JSON</button>
        </div>

        <div className="admin-items-selected-row">
          <strong>Сейчас редактируется:</strong>
          <span>{selectedQuest ? `${selectedQuest.title || '(без названия)'} (${selectedQuest.id})` : 'новый квест'}</span>
        </div>

        <div className="admin-items-icons-grid">
          {visibleQuests.map((quest) => (
            <button
              key={quest.id}
              className={`admin-item-icon-card ${selectedId === quest.id ? 'is-active' : ''}`}
              onClick={() => select(quest)}
              title={`${quest.title || quest.id} (${quest.id})`}
            >
              <div className={`admin-catalog-thumb admin-catalog-thumb-lg ${getQuestCardAccent(quest)}`}>
                {resolveImage(quest.portraitUrl || quest.imageUrl || quest.bannerUrl)
                  ? <img src={resolveImage(quest.portraitUrl || quest.imageUrl || quest.bannerUrl)} alt={quest.title || quest.id} />
                  : (quest.title.trim() || quest.category).charAt(0).toUpperCase()}
              </div>
              <strong>{quest.title || '(без названия)'}</strong>
              <span>{quest.id || 'ID ещё не задан'}</span>
              <span>{formatLabel(quest.category)} | {formatLabel(quest.status)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
