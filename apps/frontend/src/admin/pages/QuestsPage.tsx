import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { AdminImageField } from '../AdminImageField';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import { ZoneReferenceInput } from '../ZoneReferenceInput';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';
import { ReputationChangesEditor, type ReputationChangeEditorValue } from '../components/ReputationChangesEditor';
import {
  mergeQuestRewardReputation,
  toEditorReputationChanges,
} from '../components/reputationEffectAdapters';
import { subscribeToContentSync } from '../../services/content/contentSync';
import { imageService } from '../../services/content/imageService';
import { resolveStoredImageSource } from '../../services/content/runtimeImageService';
import { itemsService } from '../../services/content/itemsService';
import { skillsService } from '../../services/content/skillsService';
import { ensureDialoguesLoaded, getAllDialogues } from '../../services/dialogueRepository';
import { QUEST_SEED_CITIES, QUEST_SEED_FACTIONS, QUEST_SEED_KINGDOMS } from '../../services/questWorldSeed';
import { cityService } from '../../services/cityRepository';
import {
  deleteQuest,
  duplicateQuest,
  ensureQuestsLoaded,
  getAllQuests,
  getQuestInteractions,
  getQuestItems,
  importQuestsJson,
  renameQuest,
  saveQuest,
} from '../../services/questRepository';
import { ensureNpcsLoaded, getAllNpcs } from '../../services/npcRepository';
import { ensureQuestMarkersLoaded, getQuestMarkers } from '../../services/questMapRepository';
import { validateQuest } from '../../services/questValidator';
import { buildWorldZoneLabel, getAllZones, refreshZonesFromBackend } from '../../services/worldRepository';
import { extractRawCollectionFromImportJson, formatExportStamp } from '../../services/content/adminJsonImportExport';
import { getIdQualityWarning, runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';
import { isKingdomId } from '@theend/rpg-domain';
import type {
  QuestCategory,
  QuestCondition,
  QuestDefinition,
  QuestReward,
  QuestStatus,
  QuestStep,
  QuestTrigger,
  QuestValidationResult,
} from '../../types/quest';
import type { StoredImage } from '../../services/content/models';
import type { WorldMapZone } from '../../worldmap/zoneEditorTypes';
import type { City } from '../../types/city';

const QUEST_CATEGORIES: QuestCategory[] = ['global', 'kingdom', 'faction', 'profession', 'lore', 'city', 'npc', 'random', 'hidden', 'repeatable'];
const QUEST_STATUSES: QuestStatus[] = ['draft', 'active', 'disabled', 'archived'];

type QuestStepJson = QuestStep & {
  description?: string;
  status?: string;
  conditions?: QuestCondition[];
  rewards?: QuestReward[];
  triggers?: QuestTrigger[];
};

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

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeQuestStep(step: QuestStep): QuestStep {
  const jsonStep = step as QuestStepJson;
  return {
    ...step,
    objectives: asArray(jsonStep.objectives),
    conditions: asArray(jsonStep.conditions),
    rewards: asArray(jsonStep.rewards),
    triggers: asArray(jsonStep.triggers),
  } as QuestStep;
}

function normalizeQuestDraft(quest: QuestDefinition): QuestDefinition {
  return {
    ...quest,
    steps: asArray(quest.steps).map(normalizeQuestStep),
    conditions: asArray(quest.conditions),
    rewards: asArray(quest.rewards),
    failureConsequences: asArray(quest.failureConsequences),
    triggers: asArray(quest.triggers),
  };
}

const SAFE_DEFAULT_STEP: QuestStep = {
  id: 'step_find_chest',
  questId: '',
  title: 'Найти тайник',
  journalText: 'Эрдон указал на старый тайник в Аркейле.',
  order: 1,
  description: 'Эрдон указал на старый тайник в Аркейле.',
  status: 'active',
  objectives: [],
  conditions: [],
  rewards: [],
  triggers: [],
} as unknown as QuestStep;

function uniqueId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildValidationWorldData(input: {
  zones: WorldMapZone[];
  npcIds: string[];
  itemIds: string[];
  questItemIds: string[];
  skillIds: string[];
  markerIds: string[];
  interactionQuestIds: string[];
  dialogueCompletableQuestIds: string[];
  dialogueIds: string[];
}) {
  return {
    npcIds: input.npcIds,
    itemIds: input.itemIds,
    questItemIds: input.questItemIds,
    skillIds: input.skillIds,
    professionIds: ['archer', 'blacksmith', 'alchemist', 'hunter'],
    markerIds: input.markerIds,
    zoneIds: input.zones.map((zone) => zone.id),
    interactionQuestIds: input.interactionQuestIds,
    dialogueCompletableQuestIds: input.dialogueCompletableQuestIds,
    dialogueIds: input.dialogueIds,
    kingdoms: [...QUEST_SEED_KINGDOMS],
    factions: [...QUEST_SEED_FACTIONS],
    cities: [...QUEST_SEED_CITIES],
  };
}

interface ValidationSources {
  npcIds: string[];
  itemIds: string[];
  questItemIds: string[];
  skillIds: string[];
  markerIds: string[];
  interactionQuestIds: string[];
  dialogueCompletableQuestIds: string[];
  dialogueIds: string[];
}

export function QuestsPage() {
  const [quests, setQuests] = useState<QuestDefinition[]>([]);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestDefinition>(emptyQuest());
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | QuestCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | QuestStatus>('all');
  const [kingdomFilter, setKingdomFilter] = useState<'all' | string>('all');
  const [cityFilter, setCityFilter] = useState<'all' | string>('all');
  const [factionFilter, setFactionFilter] = useState<'all' | string>('all');
  const [status, setStatus] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [validation, setValidation] = useState<QuestValidationResult>({ errors: [], warnings: [] });
  const [npcIds, setNpcIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [questItemIds, setQuestItemIds] = useState<string[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [markerIds, setMarkerIds] = useState<string[]>([]);
  const [interactionQuestIds, setInteractionQuestIds] = useState<string[]>([]);
  const [dialogueCompletableQuestIds, setDialogueCompletableQuestIds] = useState<string[]>([]);
  const [dialogueIds, setDialogueIds] = useState<string[]>([]);
  const [zones, setZones] = useState<WorldMapZone[]>(() => getAllZones());

  const [stepsJson, setStepsJson] = useState('[]');
  const [conditionsJson, setConditionsJson] = useState('[]');
  const [rewardsJson, setRewardsJson] = useState('[]');
  const [failureJson, setFailureJson] = useState('[]');
  const [triggersJson, setTriggersJson] = useState('[]');

  const rewardsReputationChanges = useMemo(() => {
    const rewards = asArray(safeParseJson<QuestReward[]>(rewardsJson, asArray(draft.rewards)));
    const changes = rewards.flatMap((reward) => {
      if (Array.isArray(reward.reputationChanges) && reward.reputationChanges.length > 0) {
        return toEditorReputationChanges(reward.reputationChanges);
      }
      if (reward.type === 'reputation' && reward.targetId && typeof reward.amount === 'number') {
        return toEditorReputationChanges([
          {
            targetType: isKingdomId(reward.targetId) ? 'kingdom' : 'faction',
            targetId: reward.targetId,
            amount: reward.amount,
          },
        ]);
      }
      return [];
    });
    return changes;
  }, [draft.rewards, rewardsJson]);

  const failureReputationChanges = useMemo(() => {
    const rewards = asArray(safeParseJson<QuestReward[]>(failureJson, asArray(draft.failureConsequences)));
    const changes = rewards.flatMap((reward) => {
      if (Array.isArray(reward.reputationChanges) && reward.reputationChanges.length > 0) {
        return toEditorReputationChanges(reward.reputationChanges);
      }
      if (reward.type === 'reputation' && reward.targetId && typeof reward.amount === 'number') {
        return toEditorReputationChanges([
          {
            targetType: isKingdomId(reward.targetId) ? 'kingdom' : 'faction',
            targetId: reward.targetId,
            amount: reward.amount,
          },
        ]);
      }
      return [];
    });
    return changes;
  }, [draft.failureConsequences, failureJson]);

  async function refreshValidationSources(): Promise<ValidationSources> {
    await Promise.all([
      ensureNpcsLoaded(),
      ensureQuestsLoaded(),
      ensureQuestMarkersLoaded(),
      ensureDialoguesLoaded(),
    ]);

    const [items, skills] = await Promise.all([
      itemsService.getAll().catch(() => []),
      skillsService.getAll().catch(() => []),
    ]);

    const allQuests = getAllQuests();
    const interactions = getQuestInteractions();
    const dialogues = getAllDialogues();

    const nextSources: ValidationSources = {
      npcIds: getAllNpcs().map((entry) => entry.id.trim()),
      itemIds: items.map((entry) => entry.id.trim()),
      questItemIds: getQuestItems().map((entry) => entry.id.trim()),
      skillIds: skills.map((entry) => entry.id.trim()),
      markerIds: getQuestMarkers().map((entry) => entry.id.trim()),
      interactionQuestIds: interactions.map((entry) => (entry.questId ?? '').trim()).filter(Boolean),
      dialogueCompletableQuestIds: dialogues.flatMap((dialogue) =>
      asArray(dialogue.nodes).flatMap((node) =>
        asArray(node.choices)
          .map((choice) => (choice.completeQuest ?? '').trim())
          .filter(Boolean),
      ),
      ),
      dialogueIds: dialogues.map((entry) => entry.id.trim()),
    };

    setNpcIds(nextSources.npcIds);
    setItemIds(nextSources.itemIds);
    setQuestItemIds(nextSources.questItemIds);
    setSkillIds(nextSources.skillIds);
    setMarkerIds(nextSources.markerIds);
    setInteractionQuestIds(nextSources.interactionQuestIds);
    setDialogueCompletableQuestIds(nextSources.dialogueCompletableQuestIds);
    setDialogueIds(nextSources.dialogueIds);

    // Keep quest list current for validation that references active in-memory data.
    setQuests(allQuests);

    return nextSources;
  }

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
    await refreshValidationSources();
  }

  useEffect(() => {
    void refresh();
    void cityService.getCities().then(setCities).catch(() => setCities([]));

    setZones(getAllZones());
    void refreshZonesFromBackend().then(setZones).catch(() => undefined);

    const unsubscribe = subscribeToContentSync((payload) => {
      if (payload.scope === 'content' || payload.scope === 'all') {
        void refresh().catch(() => undefined);
      }
      if (payload.scope === 'worldMap' || payload.scope === 'all') {
        void refreshZonesFromBackend().then(setZones).catch(() => undefined);
      }
    });

    return unsubscribe;
  }, []);

  const startCity = useMemo(
    () => (draft.startCityId ? cities.find((city) => city.id === draft.startCityId) ?? null : null),
    [cities, draft.startCityId],
  );
  const targetCity = useMemo(
    () => (draft.targetCityId ? cities.find((city) => city.id === draft.targetCityId) ?? null : null),
    [cities, draft.targetCityId],
  );
  const startLocation = useMemo(() => {
    if (!draft.startLocationId || !startCity) return null;
    return startCity.locations.find((location) => location.id === draft.startLocationId) ?? null;
  }, [draft.startLocationId, startCity]);
  const targetLocation = useMemo(() => {
    if (!draft.targetLocationId || !targetCity) return null;
    return targetCity.locations.find((location) => location.id === draft.targetLocationId) ?? null;
  }, [draft.targetLocationId, targetCity]);

  useEffect(() => {
    const safeDraft = normalizeQuestDraft(draft);
    setStepsJson(JSON.stringify(safeDraft.steps, null, 2));
    setConditionsJson(JSON.stringify(safeDraft.conditions, null, 2));
    setRewardsJson(JSON.stringify(safeDraft.rewards, null, 2));
    setFailureJson(JSON.stringify(safeDraft.failureConsequences, null, 2));
    setTriggersJson(JSON.stringify(safeDraft.triggers, null, 2));

    const worldData = buildValidationWorldData({
      zones,
      npcIds,
      itemIds,
      questItemIds,
      skillIds,
      markerIds,
      interactionQuestIds,
      dialogueCompletableQuestIds,
      dialogueIds,
    });
    setValidation(validateQuest(safeDraft, worldData));
  }, [dialogueCompletableQuestIds, dialogueIds, draft, interactionQuestIds, itemIds, markerIds, questItemIds, quests, skillIds, zones]);

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
    () => asArray(draft.triggers).map((trigger, index) => ({ trigger, index })),
    [draft.triggers],
  );
  const objectiveZoneEntries = useMemo(
    () => asArray(draft.steps).flatMap((step, stepIndex) => asArray(step.objectives).map((objective, objectiveIndex) => ({ step, objective, stepIndex, objectiveIndex }))),
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
    setDraft((current) => normalizeQuestDraft({ ...current, ...next, updatedAt: new Date().toISOString() }));
  }

  function select(quest: QuestDefinition) {
    setSelectedId(quest.id);
    setDraft(normalizeQuestDraft({ ...quest }));
    setStatus(`Редактируется квест: ${quest.id}`);
  }

  async function saveCurrent() {
    if (isSaving) {
      return;
    }

    const sources = await refreshValidationSources();
    const worldData = buildValidationWorldData({
      zones,
      npcIds: sources.npcIds,
      itemIds: sources.itemIds,
      questItemIds: sources.questItemIds,
      skillIds: sources.skillIds,
      markerIds: sources.markerIds,
      interactionQuestIds: sources.interactionQuestIds,
      dialogueCompletableQuestIds: sources.dialogueCompletableQuestIds,
      dialogueIds: sources.dialogueIds,
    });
    const safeDraft = normalizeQuestDraft(draft);
    const result = validateQuest(safeDraft, worldData);
    setValidation(result);

    if (draft.status === 'active' && result.errors.length > 0) {
      setStatus('Нельзя активировать квест с критическими ошибками. Нажмите ПРОВЕРИТЬ КВЕСТ.');
      return;
    }

    const prepared: QuestDefinition = {
      ...safeDraft,
      id: draft.id.trim() || uniqueId('quest'),
      title: draft.title.trim(),
      updatedAt: new Date().toISOString(),
      createdAt: draft.createdAt || new Date().toISOString(),
      steps: asArray(safeParseJson<QuestStep[]>(stepsJson, safeDraft.steps)).map(normalizeQuestStep),
      conditions: asArray(safeParseJson<QuestCondition[]>(conditionsJson, safeDraft.conditions)),
      rewards: asArray(safeParseJson<QuestReward[]>(rewardsJson, safeDraft.rewards)),
      failureConsequences: asArray(safeParseJson<QuestReward[]>(failureJson, safeDraft.failureConsequences)),
      triggers: asArray(safeParseJson<QuestTrigger[]>(triggersJson, safeDraft.triggers)),
    };

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: prepared.id,
      onSave: () => (selectedId && prepared.id !== selectedId ? renameQuest(selectedId, prepared) : saveQuest(prepared)),
      onAfterSave: async () => {
        await refreshValidationSources();
      },
      successLabel: (entry) => `Сохранено: ${entry.id}`,
    });

    if (!saved) {
      setStatus('Не удалось сохранить квест.');
      setIsSaving(false);
      return;
    }

    setSelectedId(saved.id);
    setDraft(normalizeQuestDraft(saved));
    await refresh();
    const warning = getIdQualityWarning(saved.id);
    if (warning) {
      setStatus(`Предупреждение: ${warning}`);
      setSaveState({ state: 'warning', message: warning });
    } else {
      setStatus(`Квест сохранен: ${saved.id}`);
    }
    setIsSaving(false);
  }

  async function duplicateSelectedQuest() {
    if (!selectedId) {
      return;
    }
    try {
      const copied = await duplicateQuest(selectedId);
      await refresh();
      setSelectedId(copied.id);
      setDraft(normalizeQuestDraft(copied));
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
    const existingSteps = asArray(draft.steps);
    const nextStep: QuestStep = {
      ...SAFE_DEFAULT_STEP,
      id: existingSteps.some((step) => step.id === SAFE_DEFAULT_STEP.id) ? uniqueId('step_find_chest') : SAFE_DEFAULT_STEP.id,
      questId: draft.id || '',
      order: existingSteps.length + 1,
    } as QuestStep;

    patch({ steps: [...existingSteps, nextStep] });
  }

  function exportJson() {
    const payload = {
      schemaVersion: 1,
      game: 'TheEnd',
      exportedAt: new Date().toISOString(),
      exportedBy: 'admin',
      contentCounts: {
        quests: quests.length,
        questInteractions: getQuestInteractions().length,
        questItems: getQuestItems().length,
      },
      quests,
      questInteractions: getQuestInteractions(),
      questItems: getQuestItems(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `theend_quests_bundle_${formatExportStamp()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    setStatus(`Экспорт квестов: ${quests.length}`);
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
      const questsPayload = extractRawCollectionFromImportJson(payload, 'quests');
      const questInteractionsPayload = (() => {
        try {
          return extractRawCollectionFromImportJson(payload, 'questInteractions');
        } catch {
          return [] as unknown[];
        }
      })();
      const questItemsPayload = (() => {
        try {
          return extractRawCollectionFromImportJson(payload, 'questItems');
        } catch {
          return [] as unknown[];
        }
      })();

      const result = await importQuestsJson(JSON.stringify({
        quests: questsPayload,
        questInteractions: questInteractionsPayload,
        questItems: questItemsPayload,
      }));
      await refresh();
      setStatus(`Импорт завершен: квестов ${result.quests}, взаимодействий ${result.questInteractions}, квестовых предметов ${result.questItems}.`);
      setSaveState({ state: 'saved', message: `Импорт квестов: ${result.quests}` });
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
      setSaveState({ state: 'error', message: translateAdminErrorMessage((error as Error).message) });
    } finally {
      setIsImporting(false);
    }
  }

  async function validateCurrentQuest() {
    const sources = await refreshValidationSources();
    const worldData = buildValidationWorldData({
      zones,
      npcIds: sources.npcIds,
      itemIds: sources.itemIds,
      questItemIds: sources.questItemIds,
      skillIds: sources.skillIds,
      markerIds: sources.markerIds,
      interactionQuestIds: sources.interactionQuestIds,
      dialogueCompletableQuestIds: sources.dialogueCompletableQuestIds,
      dialogueIds: sources.dialogueIds,
    });
    const result = validateQuest(normalizeQuestDraft(draft), worldData);
    setValidation(result);
    setStatus(`Проверка: ${result.errors.length} ошибок, ${result.warnings.length} предупреждений.`);
  }

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: saveCurrent,
  });

  function updateTriggerZone(index: number, zoneId: string) {
    patch({
      triggers: asArray(draft.triggers).map((trigger, triggerIndex) => triggerIndex === index ? { ...trigger, zoneId: zoneId || undefined } : trigger),
    });
  }

  function updateObjectiveZone(stepIndex: number, objectiveIndex: number, zoneId: string) {
    patch({
      steps: asArray(draft.steps).map((step, currentStepIndex) => currentStepIndex === stepIndex
        ? {
            ...step,
            objectives: asArray(step.objectives).map((objective, currentObjectiveIndex) => currentObjectiveIndex === objectiveIndex
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

  function patchRewardsReputationChanges(changes: ReputationChangeEditorValue[]) {
    const parsedRewards = asArray(safeParseJson<QuestReward[]>(rewardsJson, asArray(draft.rewards)));
    const nextRewards = parsedRewards.filter((reward) => reward.type !== 'reputation');
    if (changes.length > 0) {
      nextRewards.push(mergeQuestRewardReputation({ id: 'reward_reputation_changes', type: 'reputation' }, changes));
    }
    const nextJson = JSON.stringify(nextRewards, null, 2);
    setRewardsJson(nextJson);
    patch({ rewards: nextRewards });
  }

  function patchFailureReputationChanges(changes: ReputationChangeEditorValue[]) {
    const parsedRewards = asArray(safeParseJson<QuestReward[]>(failureJson, asArray(draft.failureConsequences)));
    const nextRewards = parsedRewards.filter((reward) => reward.type !== 'reputation');
    if (changes.length > 0) {
      nextRewards.push(mergeQuestRewardReputation({ id: 'failure_reputation_changes', type: 'reputation' }, changes));
    }
    const nextJson = JSON.stringify(nextRewards, null, 2);
    setFailureJson(nextJson);
    patch({ failureConsequences: nextRewards });
  }

  return (
    <div className="admin-page-grid">
      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Стабильный id для квестовых связок." />
            <AdminHelpTooltip section="quests" field="id" />
            <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Название" hint="Название квеста, видимое игроку." />
            <AdminHelpTooltip section="quests" field="title" />
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
            <AdminFieldLabel label="Start City" hint="Город, где начинается квест (для city-сцен/логики)." />
            <select value={draft.startCityId ?? ''} onChange={(event) => patch({ startCityId: event.target.value || undefined, startLocationId: undefined })}>
              <option value="">Не задано</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name} ({city.id})</option>)}
            </select>
          </label>
          {draft.startCityId && !startCity ? <p className="muted">City not found</p> : null}
          <label>
            <AdminFieldLabel label="Start Location" hint="Локация внутри Start City." />
            <select value={draft.startLocationId ?? ''} onChange={(event) => patch({ startLocationId: event.target.value || undefined })} disabled={!draft.startCityId}>
              <option value="">Не задано</option>
              {(startCity?.locations ?? []).map((location) => <option key={location.id} value={location.id}>{location.name} ({location.id})</option>)}
            </select>
          </label>
          {draft.startLocationId && draft.startCityId && !startLocation ? <p className="muted">Location not found</p> : null}
          <label>
            <AdminFieldLabel label="Target City" hint="Город-цель квеста (куда ведёт)." />
            <select value={draft.targetCityId ?? ''} onChange={(event) => patch({ targetCityId: event.target.value || undefined, targetLocationId: undefined })}>
              <option value="">Не задано</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name} ({city.id})</option>)}
            </select>
          </label>
          {draft.targetCityId && !targetCity ? <p className="muted">City not found</p> : null}
          <label>
            <AdminFieldLabel label="Target Location" hint="Локация внутри Target City." />
            <select value={draft.targetLocationId ?? ''} onChange={(event) => patch({ targetLocationId: event.target.value || undefined })} disabled={!draft.targetCityId}>
              <option value="">Не задано</option>
              {(targetCity?.locations ?? []).map((location) => <option key={location.id} value={location.id}>{location.name} ({location.id})</option>)}
            </select>
          </label>
          {draft.targetLocationId && draft.targetCityId && !targetLocation ? <p className="muted">Location not found</p> : null}
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
          <AdminHelpTooltip section="quests" field="description" />
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
          <textarea rows={12} value={stepsJson} onChange={(event) => setStepsJson(event.target.value)} onBlur={() => patch({ steps: asArray(safeParseJson<QuestStep[]>(stepsJson, asArray(draft.steps))).map(normalizeQuestStep) })} />
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
          <textarea rows={8} value={conditionsJson} onChange={(event) => setConditionsJson(event.target.value)} onBlur={() => patch({ conditions: asArray(safeParseJson<QuestCondition[]>(conditionsJson, asArray(draft.conditions))) })} />
        </section>

        <section className="card admin-item-preview">
          <h4>Rewards</h4>
          <textarea rows={8} value={rewardsJson} onChange={(event) => setRewardsJson(event.target.value)} onBlur={() => patch({ rewards: asArray(safeParseJson<QuestReward[]>(rewardsJson, asArray(draft.rewards))) })} />
          <p className="muted">Для королевской репутации используйте reward `type: "reputation"` и `targetId` вроде `artalon`, `luminor`, `argos`.</p>
          <ReputationChangesEditor value={rewardsReputationChanges} onChange={patchRewardsReputationChanges} />
          <h4>Failure Consequences</h4>
          <textarea rows={6} value={failureJson} onChange={(event) => setFailureJson(event.target.value)} onBlur={() => patch({ failureConsequences: asArray(safeParseJson<QuestReward[]>(failureJson, asArray(draft.failureConsequences))) })} />
          <ReputationChangesEditor value={failureReputationChanges} onChange={patchFailureReputationChanges} />
        </section>

        <section className="card admin-item-preview">
          <h4>Triggers</h4>
          <textarea rows={10} value={triggersJson} onChange={(event) => setTriggersJson(event.target.value)} onBlur={() => patch({ triggers: asArray(safeParseJson<QuestTrigger[]>(triggersJson, asArray(draft.triggers))) })} />
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
            <button type="button" onClick={() => { void validateCurrentQuest(); }}>ПРОВЕРИТЬ КВЕСТ</button>
          </div>
          <p>Ошибки: {validation.errors.length}</p>
          {validation.errors.map((error) => <p key={error} className="muted">• {error}</p>)}
          <p>Предупреждения: {validation.warnings.length}</p>
          {validation.warnings.map((warning) => <p key={warning} className="muted">• {warning}</p>)}
        </section>

        <div className="admin-actions-row">
          <button disabled={isSaving} onClick={() => { void saveCurrent(); }}>{isSaving ? 'Сохранение...' : (selectedId ? 'СОХРАНИТЬ' : 'СОЗДАТЬ')}</button>
          <button disabled={!selectedId} onClick={() => { void duplicateSelectedQuest(); }}>ДУБЛИРОВАТЬ</button>
          <button disabled={!selectedId} onClick={() => { void disableSelectedQuest(); }}>ОТКЛЮЧИТЬ</button>
          <button disabled={!selectedId} onClick={() => { void deleteSelectedQuest(); }}>УДАЛИТЬ</button>
        </div>

        <AdminSaveStatus value={saveState} />
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
          <button disabled={isImporting || isSaving} onClick={() => importFileRef.current?.click()}>{isImporting ? 'Импорт...' : 'Импорт JSON'}</button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={handleImportFile} />
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
