import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';
import { subscribeToContentSync } from '../../services/content/contentSync';
import {
  deleteQuestInteraction,
  ensureQuestsLoaded,
  getAllQuests,
  getQuestInteractions,
  getQuestItems,
  renameQuestInteraction,
  saveQuestInteraction,
} from '../../services/questRepository';
import { ensureQuestMarkersLoaded, getQuestMarkers } from '../../services/questMapRepository';
import { getAllZones } from '../../services/worldRepository';
import { getContentCollection } from '../../services/content/contentApi';
import { downloadCollectionJson, extractRawCollectionFromImportJson } from '../../services/content/adminJsonImportExport';
import type { AdminItem, AdminSkill } from '../../services/content/models';
import type { QuestInteractionDefinition, QuestInteractionChoice } from '../../types/quest';
import { getIdQualityWarning, runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';

const TRIGGER_TYPES: QuestInteractionDefinition['triggerType'][] = [
  'zone_inspect',
  'zone_enter',
  'marker_reached',
  'object_interact',
  'item_use',
  'npc_interact',
  'manual',
];

const QUEST_STATUSES: Array<'active' | 'completed' | 'failed'> = ['active', 'completed', 'failed'];

function emptyInteraction(): QuestInteractionDefinition {
  return {
    id: '',
    title: '',
    triggerType: 'zone_inspect',
    text: '',
    requirements: [],
    choices: [],
    isActive: true,
    consumeOnUse: false,
    hideAfterQuestCompleted: false,
    hideAfterObjectiveCompleted: false,
    hideAfterStepCompleted: false,
  };
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeChoice(choice: QuestInteractionChoice): QuestInteractionChoice {
  return {
    ...choice,
    id: String(choice.id ?? '').trim(),
    text: String(choice.text ?? '').trim(),
    resultText: String(choice.resultText ?? '').trim() || undefined,
    imageId: String(choice.imageId ?? '').trim() || undefined,
    requirements: Array.isArray(choice.requirements) ? choice.requirements : [],
    effects: Array.isArray(choice.effects) ? choice.effects : [],
    close: choice.close === true,
    completeObjectiveId: String(choice.completeObjectiveId ?? '').trim() || undefined,
    completeStepId: String(choice.completeStepId ?? '').trim() || undefined,
    completeQuest: choice.completeQuest === true,
    giveRewards: choice.giveRewards === true,
    nextQuestId: String(choice.nextQuestId ?? '').trim() || undefined,
    startQuestId: String(choice.startQuestId ?? '').trim() || undefined,
    setFlag: choice.setFlag && String(choice.setFlag.key ?? '').trim()
      ? {
          key: String(choice.setFlag.key).trim(),
          value: choice.setFlag.value,
        }
      : undefined,
  };
}

function normalizeInteraction(interaction: QuestInteractionDefinition): QuestInteractionDefinition {
  return {
    ...interaction,
    id: String(interaction.id ?? '').trim(),
    title: String(interaction.title ?? '').trim(),
    zoneId: String(interaction.zoneId ?? '').trim() || undefined,
    markerId: String(interaction.markerId ?? '').trim() || undefined,
    objectId: String(interaction.objectId ?? '').trim() || undefined,
    itemId: String(interaction.itemId ?? '').trim() || undefined,
    npcId: String(interaction.npcId ?? '').trim() || undefined,
    questId: String(interaction.questId ?? '').trim() || undefined,
    stepId: String(interaction.stepId ?? '').trim() || undefined,
    objectiveId: String(interaction.objectiveId ?? '').trim() || undefined,
    text: String(interaction.text ?? '').trim(),
    imageId: String(interaction.imageId ?? '').trim() || undefined,
    requirements: Array.isArray(interaction.requirements) ? interaction.requirements : [],
    choices: Array.isArray(interaction.choices)
      ? interaction.choices.map(normalizeChoice).filter((choice) => Boolean(choice.id && choice.text))
      : [],
    consumeOnUse: interaction.consumeOnUse === true,
    hideAfterQuestCompleted: interaction.hideAfterQuestCompleted === true,
    hideAfterObjectiveCompleted: interaction.hideAfterObjectiveCompleted === true,
    hideAfterStepCompleted: interaction.hideAfterStepCompleted === true,
    requiredQuestId: String(interaction.requiredQuestId ?? '').trim() || undefined,
    requiredQuestStatus: interaction.requiredQuestStatus,
    requiredObjectiveId: String(interaction.requiredObjectiveId ?? '').trim() || undefined,
    requiredItemId: String(interaction.requiredItemId ?? '').trim() || undefined,
    requiredQuestItemId: String(interaction.requiredQuestItemId ?? '').trim() || undefined,
    isActive: interaction.isActive !== false,
  };
}

function parseChoices(raw: string): QuestInteractionChoice[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.map((entry) => normalizeChoice(entry as QuestInteractionChoice)).filter((entry) => Boolean(entry.id && entry.text));
}

function parseRequirements(raw: string): QuestInteractionDefinition['requirements'] {
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? parsed : [];
}

export function QuestInteractionsPage() {
  const [interactions, setInteractions] = useState<QuestInteractionDefinition[]>([]);
  const [quests, setQuests] = useState<ReturnType<typeof getAllQuests>>([]);
  const [questIds, setQuestIds] = useState<string[]>([]);
  const [questItemIds, setQuestItemIds] = useState<string[]>([]);
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [markerIds, setMarkerIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestInteractionDefinition>(emptyInteraction());
  const [requirementsJson, setRequirementsJson] = useState('[]');
  const [choicesJson, setChoicesJson] = useState('[]');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    await Promise.all([ensureQuestsLoaded(), ensureQuestMarkersLoaded()]);
    const nextInteractions = getQuestInteractions();
    const nextQuests = getAllQuests();
    const [contentItems, contentSkills] = await Promise.all([
      getContentCollection<AdminItem>('items').catch(() => []),
      getContentCollection<AdminSkill>('skills').catch(() => []),
    ]);

    setInteractions(nextInteractions);
    setQuests(nextQuests);
    setQuestIds(nextQuests.map((quest) => quest.id));
    setQuestItemIds(getQuestItems().map((item) => item.id));
    setZoneIds(getAllZones().map((zone) => zone.id));
    setMarkerIds(getQuestMarkers().map((marker) => marker.id));
    setItemIds(contentItems.map((item) => item.id));
    setSkillIds(contentSkills.map((skill) => skill.id));

    if (selectedId && !nextInteractions.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
      setDraft(emptyInteraction());
      setChoicesJson('[]');
    }
  }

  useEffect(() => {
    void refresh();

    const unsubscribe = subscribeToContentSync((payload) => {
      if (payload.scope === 'content' || payload.scope === 'worldMap' || payload.scope === 'all') {
        void refresh();
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    setRequirementsJson(JSON.stringify(draft.requirements ?? [], null, 2));
    setChoicesJson(JSON.stringify(draft.choices ?? [], null, 2));
  }, [draft]);

  const visibleInteractions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return interactions.filter((interaction) => {
      if (!q) {
        return true;
      }
      return interaction.id.toLowerCase().includes(q)
        || interaction.title.toLowerCase().includes(q)
        || (interaction.zoneId ?? '').toLowerCase().includes(q)
        || (interaction.questId ?? '').toLowerCase().includes(q);
    });
  }, [interactions, query]);

  function patch(next: Partial<QuestInteractionDefinition>) {
    setDraft((current) => normalizeInteraction({ ...current, ...next }));
  }

  function select(interaction: QuestInteractionDefinition) {
    setSelectedId(interaction.id);
    setDraft(normalizeInteraction(interaction));
    setStatus(`Редактируется interaction: ${interaction.id}`);
  }

  function createNew() {
    setSelectedId(null);
    setDraft(emptyInteraction());
    setRequirementsJson('[]');
    setChoicesJson('[]');
    setStatus('Новый interaction. Заполните поля и сохраните.');
  }

  function validatePreparedInteraction(interaction: QuestInteractionDefinition): string[] {
    const errors: string[] = [];
    const quest = interaction.questId ? quests.find((entry) => entry.id === interaction.questId) : null;

    if (interaction.questId && !quest) {
      errors.push(`questId не найден: ${interaction.questId}`);
    }
    if (interaction.stepId && quest && !quest.steps.some((step) => step.id === interaction.stepId)) {
      errors.push(`stepId не найден в квесте ${quest.id}: ${interaction.stepId}`);
    }
    if (
      interaction.objectiveId
      && quest
      && !quest.steps.some((step) => step.objectives.some((objective) => objective.id === interaction.objectiveId))
    ) {
      errors.push(`objectiveId не найден в квесте ${quest.id}: ${interaction.objectiveId}`);
    }
    if (interaction.zoneId && !zoneIds.includes(interaction.zoneId)) {
      errors.push(`zoneId не найден: ${interaction.zoneId}`);
    }
    if (interaction.markerId && !markerIds.includes(interaction.markerId)) {
      errors.push(`markerId не найден: ${interaction.markerId}`);
    }

    const choiceIds = new Set<string>();
    for (const choice of interaction.choices ?? []) {
      if (choiceIds.has(choice.id)) {
        errors.push(`Дублируется choice id: ${choice.id}`);
      }
      choiceIds.add(choice.id);

      for (const effect of choice.effects ?? []) {
        if (effect.questId && !questIds.includes(effect.questId)) {
          errors.push(`Effect ${effect.type}: questId не найден (${effect.questId})`);
        }
        if (effect.itemId && !itemIds.includes(effect.itemId)) {
          errors.push(`Effect ${effect.type}: itemId не найден (${effect.itemId})`);
        }
        if (effect.questItemId && !questItemIds.includes(effect.questItemId)) {
          errors.push(`Effect ${effect.type}: questItemId не найден (${effect.questItemId})`);
        }
        if (effect.skillId && !skillIds.includes(effect.skillId)) {
          errors.push(`Effect ${effect.type}: skillId не найден (${effect.skillId})`);
        }
      }
    }

    return errors;
  }

  async function saveCurrent() {
    if (isSaving) {
      return;
    }

    try {
      const prepared = normalizeInteraction({
        ...draft,
        id: draft.id.trim() || uid('interaction'),
        requirements: parseRequirements(requirementsJson),
        choices: parseChoices(choicesJson),
      });

      const validationErrors = validatePreparedInteraction(prepared);
      if (validationErrors.length > 0) {
        setStatus(`Ошибка валидации: ${validationErrors[0]}`);
        return;
      }

      setIsSaving(true);
      const saved = await runSaveWithFeedback({
        setState: setSaveState,
        saveLabel: prepared.id,
        onSave: () => (selectedId && prepared.id !== selectedId ? renameQuestInteraction(selectedId, prepared) : saveQuestInteraction(prepared)),
        onAfterSave: refresh,
        successLabel: (entry) => `Сохранено: ${entry.id}`,
      });
      if (!saved) {
        setIsSaving(false);
        return;
      }

      setSelectedId(saved.id);
      setDraft(saved);
      await refresh();
      const warning = getIdQualityWarning(saved.id);
      if (warning) {
        setStatus(`Предупреждение: ${warning}`);
        setSaveState({ state: 'warning', message: warning });
      } else {
        setStatus(`Quest interaction сохранен: ${saved.id}`);
      }
      setIsSaving(false);
    } catch (error) {
      setIsSaving(false);
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: saveCurrent,
  });

  async function removeCurrent() {
    if (!selectedId) {
      return;
    }

    try {
      await deleteQuestInteraction(selectedId);
      setSelectedId(null);
      setDraft(emptyInteraction());
      setRequirementsJson('[]');
      setChoicesJson('[]');
      await refresh();
      setStatus(`Quest interaction удален: ${selectedId}`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_quest_interactions',
      collectionKey: 'questInteractions',
      entries: interactions,
    });
    setStatus(`Экспорт interactions: ${interactions.length}`);
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isImporting || isSaving) {
      return;
    }

    setIsImporting(true);
    try {
      await ensureQuestsLoaded();
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const entries = extractRawCollectionFromImportJson(payload, 'questInteractions');
      const existingIds = new Set(getQuestInteractions().map((entry) => entry.id));
      let created = 0;
      let skippedExisting = 0;

      for (const raw of entries) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          continue;
        }
        const normalized = normalizeInteraction(raw as QuestInteractionDefinition);
        if (!normalized.id) {
          continue;
        }
        if (existingIds.has(normalized.id)) {
          skippedExisting += 1;
          continue;
        }
        await saveQuestInteraction(normalized);
        created += 1;
        existingIds.add(normalized.id);
      }

      setStatus(`?????? ????????: ??????? ${created}, ????????? ???????????? ${skippedExisting}.`);
      setSaveState({ state: 'saved', message: `?????? interactions: +${created} / =${skippedExisting}` });
    } catch (error) {
      const message = translateAdminErrorMessage((error as Error).message);
      setStatus(message);
      setSaveState({ state: 'error', message });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <input
            placeholder="Поиск interaction"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button onClick={createNew}>Новый interaction</button>
          <button onClick={exportJson}>Экспорт JSON</button>
          <button disabled={isImporting || isSaving} onClick={() => importFileRef.current?.click()}>{isImporting ? 'Импорт...' : 'Импорт JSON'}</button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={handleImportFile} />
        </div>

        <div className="admin-scroll-list">
          {visibleInteractions.map((interaction) => (
            <button
              key={interaction.id}
              className={selectedId === interaction.id ? 'is-active' : ''}
              onClick={() => select(interaction)}
            >
              <strong>{interaction.title || '(без названия)'}</strong>
              <span>{interaction.id} | {interaction.triggerType}</span>
              <span>{interaction.zoneId || interaction.markerId || interaction.questId || 'без привязки'}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Уникальный id interaction." />
            <AdminHelpTooltip section="questInteractions" field="id" />
            <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Title" hint="Название popup для игрока." />
            <AdminHelpTooltip section="questInteractions" field="title" />
            <input value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Zone ID" hint="Зона для trigger-а." />
            <input value={draft.zoneId ?? ''} onChange={(event) => patch({ zoneId: event.target.value || undefined })} />
          </label>
          <label>
            <AdminHelpTooltip section="questInteractions" field="description" />
            <AdminFieldLabel label="Marker ID" hint="Маркер для trigger-а." />
            <input value={draft.markerId ?? ''} onChange={(event) => patch({ markerId: event.target.value || undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Object ID" hint="Объект для object_interact." />
            <input value={draft.objectId ?? ''} onChange={(event) => patch({ objectId: event.target.value || undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Item ID" hint="Предмет для item_use." />
            <input value={draft.itemId ?? ''} onChange={(event) => patch({ itemId: event.target.value || undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="NPC ID" hint="NPC для npc_interact." />
            <input value={draft.npcId ?? ''} onChange={(event) => patch({ npcId: event.target.value || undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Quest ID" hint="Если задан, interaction завязан на квест." />
            <select value={draft.questId ?? ''} onChange={(event) => patch({ questId: event.target.value || undefined })}>
              <option value="">Не задано</option>
              {questIds.map((questId) => <option key={questId} value={questId}>{questId}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Step ID" hint="Опциональный step target." />
            <input value={draft.stepId ?? ''} onChange={(event) => patch({ stepId: event.target.value || undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Objective ID" hint="Опциональный objective target." />
            <input value={draft.objectiveId ?? ''} onChange={(event) => patch({ objectiveId: event.target.value || undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Trigger Type" hint="Тип события, который запускает interaction." />
            <select
              value={draft.triggerType}
              onChange={(event) => patch({ triggerType: event.target.value as QuestInteractionDefinition['triggerType'] })}
            >
              {TRIGGER_TYPES.map((triggerType) => <option key={triggerType} value={triggerType}>{triggerType}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Image ID" hint="ID изображения из image storage (опционально)." />
            <input value={draft.imageId ?? ''} onChange={(event) => patch({ imageId: event.target.value || undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Required Quest ID" hint="Проверка состояния другого квеста." />
            <select
              value={draft.requiredQuestId ?? ''}
              onChange={(event) => patch({ requiredQuestId: event.target.value || undefined })}
            >
              <option value="">Не задано</option>
              {questIds.map((questId) => <option key={questId} value={questId}>{questId}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Required Quest Status" hint="Требуемый статус requiredQuestId." />
            <select
              value={draft.requiredQuestStatus ?? ''}
              onChange={(event) => patch({ requiredQuestStatus: (event.target.value || undefined) as QuestInteractionDefinition['requiredQuestStatus'] })}
            >
              <option value="">Не задано</option>
              {QUEST_STATUSES.map((statusValue) => <option key={statusValue} value={statusValue}>{statusValue}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Required Objective ID" hint="Проверка выполненной objective." />
            <input value={draft.requiredObjectiveId ?? ''} onChange={(event) => patch({ requiredObjectiveId: event.target.value || undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Required Item ID" hint="Обычный предмет из инвентаря игрока." />
            <input value={draft.requiredItemId ?? ''} onChange={(event) => patch({ requiredItemId: event.target.value || undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Required Quest Item ID" hint="Квестовый предмет игрока." />
            <select
              value={draft.requiredQuestItemId ?? ''}
              onChange={(event) => patch({ requiredQuestItemId: event.target.value || undefined })}
            >
              <option value="">Не задано</option>
              {questItemIds.map((itemId) => <option key={itemId} value={itemId}>{itemId}</option>)}
            </select>
          </label>
          <label className="zone-editor-checkbox">
            <input
              type="checkbox"
              checked={draft.isActive !== false}
              onChange={(event) => patch({ isActive: event.target.checked })}
            />
            <AdminFieldLabel label="Is Active" hint="Отключенный interaction игнорируется runtime-ом." />
          </label>
          <label className="zone-editor-checkbox">
            <input
              type="checkbox"
              checked={draft.consumeOnUse === true}
              onChange={(event) => patch({ consumeOnUse: event.target.checked })}
            />
            <AdminFieldLabel label="Consume On Use" hint="Не повторять interaction после выбора с эффектами." />
          </label>
          <label className="zone-editor-checkbox">
            <input
              type="checkbox"
              checked={draft.hideAfterQuestCompleted === true}
              onChange={(event) => patch({ hideAfterQuestCompleted: event.target.checked })}
            />
            <AdminFieldLabel label="Hide After Quest Completed" hint="Скрыть после завершения связанного квеста." />
          </label>
          <label className="zone-editor-checkbox">
            <input
              type="checkbox"
              checked={draft.hideAfterObjectiveCompleted === true}
              onChange={(event) => patch({ hideAfterObjectiveCompleted: event.target.checked })}
            />
            <AdminFieldLabel label="Hide After Objective Completed" hint="Скрыть после завершения objective." />
          </label>
          <label className="zone-editor-checkbox">
            <input
              type="checkbox"
              checked={draft.hideAfterStepCompleted === true}
              onChange={(event) => patch({ hideAfterStepCompleted: event.target.checked })}
            />
            <AdminFieldLabel label="Hide After Step Completed" hint="Скрыть после завершения step." />
          </label>
        </div>

        <label>
          <AdminFieldLabel label="Text" hint="Основной текст popup для игрока." />
          <textarea rows={4} value={draft.text} onChange={(event) => patch({ text: event.target.value })} />
        </label>

        <label>
          <AdminFieldLabel
            label="Requirements JSON"
            hint="Массив requirements для interaction (quest/item/flag/race/class/level/faction checks)."
          />
          <textarea rows={8} value={requirementsJson} onChange={(event) => setRequirementsJson(event.target.value)} />
        </label>

        <label>
          <AdminFieldLabel
            label="Choices JSON"
            hint="Массив choices с requirements/effects. Legacy-поля тоже поддерживаются." 
          />
          <textarea rows={14} value={choicesJson} onChange={(event) => setChoicesJson(event.target.value)} />
        </label>

        <div className="admin-actions-row">
          <button disabled={isSaving} onClick={() => { void saveCurrent(); }}>{isSaving ? 'Сохранение...' : (selectedId ? 'Сохранить' : 'Создать')}</button>
          <button disabled={!selectedId} onClick={removeCurrent}>Удалить</button>
        </div>

        <AdminSaveStatus value={saveState} />
        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
