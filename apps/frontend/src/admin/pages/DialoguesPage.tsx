import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { AdminAudioField } from '../AdminAudioField';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import { AdminFieldLabel } from '../adminUi';
import { CitizenshipEffectEditor, type CitizenshipEffectEditorValue } from '../components/CitizenshipEffectEditor';
import { ReputationChangesEditor, type ReputationChangeEditorValue } from '../components/ReputationChangesEditor';
import {
  mergeDialogueActionCitizenship,
  mergeDialogueActionReputation,
  toEditorCitizenshipEffect,
  toEditorReputationChanges,
} from '../components/reputationEffectAdapters';
import { getAdminInitials, getNpcPreviewImageKey, resolveAdminImageSource } from '../adminVisuals';
import { subscribeToContentSync } from '../../services/content/contentSync';
import {
  deleteDialogue,
  duplicateDialogue,
  ensureDialoguesLoaded,
  getAllDialogues,
  importDialoguesJson,
  renameDialogue,
  saveDialogue,
} from '../../services/dialogueRepository';
import { ensureNpcsLoaded, getAllNpcs } from '../../services/npcRepository';
import { ensureQuestsLoaded, getAllQuests, getQuestItems } from '../../services/questRepository';
import { imageService } from '../../services/content/imageService';
import { itemsService } from '../../services/content/itemsService';
import { skillsService } from '../../services/content/skillsService';
import { validateDialogue } from '../../services/dialogueValidator';
import type { DialogueAction, DialogueDefinition, DialogueNode, DialogueValidationWorldData } from '../../types/dialogue';
import type { NpcDefinition } from '../../types/npc';
import type { StoredImage } from '../../services/content/models';
import { downloadCollectionJson, extractRawCollectionFromImportJson } from '../../services/content/adminJsonImportExport';
import { getIdQualityWarning, runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';

function emptyDialogue(): DialogueDefinition {
  const now = new Date().toISOString();
  return {
    id: '',
    title: '',
    status: 'draft',
    description: '',
    startNodeId: 'start',
    nodes: [
      {
        id: 'start',
        speaker: 'npc',
        text: '',
        choices: [],
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
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

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function dialogueValidation(
  dialogue: DialogueDefinition,
  worldData: DialogueValidationWorldData,
): { errors: string[]; warnings: string[] } {
  return validateDialogue(dialogue, worldData);
}

type DialogueEffectContainer = 'choice_effects' | 'choice_actions' | 'node_actions';

export function DialoguesPage() {
  const [dialogues, setDialogues] = useState<DialogueDefinition[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DialogueDefinition>(emptyDialogue());
  const [statusText, setStatusText] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [nodesJson, setNodesJson] = useState('[]');
  const [mineActionNodeId, setMineActionNodeId] = useState('');
  const [mineActionChoiceId, setMineActionChoiceId] = useState('');
  const [mineActionMineId, setMineActionMineId] = useState('');
  const [mineActionUsePayload, setMineActionUsePayload] = useState(false);
  const [selectedEffectContainer, setSelectedEffectContainer] = useState<DialogueEffectContainer>('choice_effects');
  const [selectedReputationEffectIndex, setSelectedReputationEffectIndex] = useState(-1);
  const [selectedCitizenshipEffectIndex, setSelectedCitizenshipEffectIndex] = useState(-1);

  const [npcIds, setNpcIds] = useState<string[]>([]);
  const [questIds, setQuestIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [questItemIds, setQuestItemIds] = useState<string[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [npcDefinitions, setNpcDefinitions] = useState<NpcDefinition[]>([]);
  const [storedImages, setStoredImages] = useState<StoredImage[]>([]);

  async function refreshReferences() {
    await Promise.all([
      ensureDialoguesLoaded(),
      ensureNpcsLoaded(),
      ensureQuestsLoaded(),
    ]);

    const [items, skills, images] = await Promise.all([
      itemsService.getAll().catch(() => []),
      skillsService.getAll().catch(() => []),
      imageService.getAll().catch(() => []),
    ]);

    setItemIds(items.map((entry) => entry.id));
    setSkillIds(skills.map((entry) => entry.id));
    const allNpcs = getAllNpcs();
    setNpcDefinitions(allNpcs);
    setStoredImages(images);
    setNpcIds(allNpcs.map((entry) => entry.id));
    setQuestIds(getAllQuests().map((entry) => entry.id));
    setQuestItemIds(getQuestItems().map((entry) => entry.id));
  }

  function refresh() {
    const all = getAllDialogues();
    setDialogues(all);
    if (selectedId && !all.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
      setDraft(emptyDialogue());
    }
  }

  useEffect(() => {
    void refreshReferences().then(() => {
      refresh();
    });

    const unsubscribe = subscribeToContentSync((payload) => {
      if (payload.scope === 'content' || payload.scope === 'all') {
        void refreshReferences().then(() => {
          refresh();
        });
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    setNodesJson(JSON.stringify(draft.nodes, null, 2));
  }, [draft]);

  const parsedNodes = useMemo(
    () => parseJsonArray<DialogueNode>(nodesJson, draft.nodes),
    [draft.nodes, nodesJson],
  );

  const mineActionChoices = useMemo(() => {
    const node = parsedNodes.find((entry) => entry.id === mineActionNodeId) ?? null;
    return node?.choices ?? [];
  }, [mineActionNodeId, parsedNodes]);

  const selectedChoice = useMemo(() => {
    const node = parsedNodes.find((entry) => entry.id === mineActionNodeId);
    if (!node) {
      return null;
    }
    return node.choices.find((entry) => entry.id === mineActionChoiceId) ?? null;
  }, [mineActionChoiceId, mineActionNodeId, parsedNodes]);

  const selectedContainerActions = useMemo<DialogueAction[]>(() => {
    const selectedNode = parsedNodes.find((entry) => entry.id === mineActionNodeId) ?? null;
    if (!selectedNode) {
      return [];
    }

    if (selectedEffectContainer === 'node_actions') {
      return selectedNode.actions ?? [];
    }

    if (!selectedChoice) {
      return [];
    }

    return selectedEffectContainer === 'choice_actions'
      ? (selectedChoice.actions ?? [])
      : (selectedChoice.effects ?? []);
  }, [mineActionNodeId, parsedNodes, selectedChoice, selectedEffectContainer]);

  const selectedChoiceReputationChanges = useMemo(() => {
    if (selectedContainerActions.length === 0) {
      return [];
    }
    const effects = selectedContainerActions;
    const action = selectedReputationEffectIndex >= 0
      ? effects[selectedReputationEffectIndex]
      : undefined;
    return toEditorReputationChanges(action?.reputationChanges);
  }, [selectedContainerActions, selectedReputationEffectIndex]);

  const selectedChoiceCitizenship = useMemo(() => {
    if (selectedContainerActions.length === 0) {
      return null;
    }
    const effects = selectedContainerActions;
    const action = selectedCitizenshipEffectIndex >= 0
      ? effects[selectedCitizenshipEffectIndex]
      : undefined;
    return toEditorCitizenshipEffect(action?.changeCitizenship ?? action?.kingdomId);
  }, [selectedContainerActions, selectedCitizenshipEffectIndex]);

  const selectedChoiceReputationEffectEntries = useMemo(() => {
    const effects = selectedContainerActions;
    return effects
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.type === 'addReputation' || entry.type === 'add_reputation');
  }, [selectedContainerActions]);

  const selectedChoiceCitizenshipEffectEntries = useMemo(() => {
    const effects = selectedContainerActions;
    return effects
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.type === 'changeCitizenship' || entry.type === 'change_citizenship');
  }, [selectedContainerActions]);

  useEffect(() => {
    if (!parsedNodes.some((entry) => entry.id === mineActionNodeId)) {
      setMineActionNodeId(parsedNodes[0]?.id ?? '');
    }
  }, [mineActionNodeId, parsedNodes]);

  useEffect(() => {
    if (!mineActionChoices.some((entry) => entry.id === mineActionChoiceId)) {
      setMineActionChoiceId(mineActionChoices[0]?.id ?? '');
    }
  }, [mineActionChoiceId, mineActionChoices]);

  useEffect(() => {
    const available = selectedChoiceReputationEffectEntries.map((entry) => entry.index);
    if (available.length === 0) {
      setSelectedReputationEffectIndex(-1);
      return;
    }
    if (!available.includes(selectedReputationEffectIndex)) {
      setSelectedReputationEffectIndex(available[0]);
    }
  }, [selectedChoiceReputationEffectEntries, selectedReputationEffectIndex]);

  useEffect(() => {
    const available = selectedChoiceCitizenshipEffectEntries.map((entry) => entry.index);
    if (available.length === 0) {
      setSelectedCitizenshipEffectIndex(-1);
      return;
    }
    if (!available.includes(selectedCitizenshipEffectIndex)) {
      setSelectedCitizenshipEffectIndex(available[0]);
    }
  }, [selectedChoiceCitizenshipEffectEntries, selectedCitizenshipEffectIndex]);

  const worldData = useMemo<DialogueValidationWorldData>(() => ({
    npcIds,
    questIds,
    itemIds,
    questItemIds,
    skillIds,
    factionIds: ['free_cities', 'artalon_guard', 'mist_cult'],
    kingdomIds: ['luminor', 'artalon', 'kriantar', 'terimia', 'argos', 'none'],
    locationIds: ['arklein', 'brenhold', 'ironcrest', 'whisper_port'],
  }), [itemIds, npcIds, questIds, questItemIds, skillIds]);

  const validation = useMemo(() => dialogueValidation(draft, worldData), [draft, worldData]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dialogues.filter((entry) => {
      if (!q) {
        return true;
      }
      return entry.id.toLowerCase().includes(q) || entry.title.toLowerCase().includes(q) || (entry.npcId ?? '').toLowerCase().includes(q);
    });
  }, [dialogues, query]);

  const npcById = useMemo(() => new Map(npcDefinitions.map((npc) => [npc.id, npc])), [npcDefinitions]);

  function patch(next: Partial<DialogueDefinition>) {
    setDraft((current) => ({ ...current, ...next, updatedAt: new Date().toISOString() }));
  }

  function selectDialogue(dialogue: DialogueDefinition) {
    setSelectedId(dialogue.id);
    setDraft({ ...dialogue });
    setStatusText(`Редактируется диалог: ${dialogue.id}`);
  }

  function createDialogue() {
    setSelectedId(null);
    setDraft(emptyDialogue());
    setStatusText('Новый диалог.');
  }

  async function saveCurrent() {
    if (isSaving) {
      return;
    }

    const prepared: DialogueDefinition = {
      ...draft,
      id: draft.id.trim() || `dlg_${Math.random().toString(36).slice(2, 8)}`,
      title: draft.title.trim(),
      startNodeId: draft.startNodeId.trim(),
        introVoiceAssetId: sanitizeAudioAssetRef(draft.introVoiceAssetId),
        introMusicAssetId: sanitizeAudioAssetRef(draft.introMusicAssetId),
      nodes: parseJsonArray<DialogueNode>(nodesJson, draft.nodes),
      updatedAt: new Date().toISOString(),
      createdAt: draft.createdAt || new Date().toISOString(),
    };

      if (draft.introVoiceAssetId && !prepared.introVoiceAssetId) {
        setStatusText('Intro voice выглядит как локальный путь Windows. Загрузите файл через кнопку "Выбрать аудио" (asset ID).');
        return;
      }
      if (draft.introMusicAssetId && !prepared.introMusicAssetId) {
        setStatusText('Intro music выглядит как локальный путь Windows. Загрузите файл через кнопку "Выбрать аудио" (asset ID).');
        return;
      }

    const result = dialogueValidation(prepared, worldData);
    if (prepared.status === 'active' && result.errors.length > 0) {
      setStatusText('Нельзя активировать диалог с ошибками.');
      return;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: prepared.id,
      onSave: () => (selectedId && prepared.id !== selectedId ? renameDialogue(selectedId, prepared) : saveDialogue(prepared)),
      onAfterSave: refreshReferences,
      successLabel: (entry) => `Сохранено: ${entry.id}`,
    });
    if (!saved) {
      setIsSaving(false);
      return;
    }

    setSelectedId(saved.id);
    setDraft(saved);
    refresh();
    const warning = getIdQualityWarning(saved.id);
    if (warning) {
      setStatusText(`Предупреждение: ${warning}`);
      setSaveState({ state: 'warning', message: warning });
    } else {
      setStatusText(`Диалог сохранен: ${saved.id}`);
    }
    setIsSaving(false);
  }

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: saveCurrent,
  });

  async function duplicateSelectedDialogue() {
    if (!selectedId) {
      return;
    }
    const copied = await duplicateDialogue(selectedId);
    setSelectedId(copied.id);
    setDraft(copied);
    refresh();
    setStatusText(`Создана копия: ${copied.id}`);
  }

  async function deleteSelectedDialogue() {
    if (!selectedId) {
      return;
    }
    await deleteDialogue(selectedId);
    setSelectedId(null);
    setDraft(emptyDialogue());
    refresh();
    setStatusText(`Диалог удален: ${selectedId}`);
  }

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_dialogues',
      collectionKey: 'dialogues',
      entries: dialogues,
    });
    setStatusText(`Экспорт диалогов: ${dialogues.length}`);
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
      const entries = extractRawCollectionFromImportJson(payload, 'dialogues');
      const count = await importDialoguesJson(JSON.stringify(entries));
      refresh();
      setStatusText(`Импорт диалогов завершен: ${count}`);
      setSaveState({ state: 'saved', message: `Импорт диалогов: ${count}` });
    } catch (error) {
      setStatusText((error as Error).message);
      setSaveState({ state: 'error', message: (error as Error).message });
    } finally {
      setIsImporting(false);
    }
  }

  function addNode() {
    const nodeId = `node_${Math.random().toString(36).slice(2, 8)}`;
    patch({
      nodes: [
        ...draft.nodes,
        {
          id: nodeId,
          speaker: 'npc',
          text: '',
          choices: [],
        },
      ],
    });
  }

  function addOpenMineActionToChoice() {
    const mineId = mineActionMineId.trim();
    if (!mineActionNodeId || !mineActionChoiceId || !mineId) {
      setStatusText('Для open_mine укажите node, choice и mineId.');
      return;
    }

    const nextNodes = parsedNodes.map((node) => {
      if (node.id !== mineActionNodeId) {
        return node;
      }

      return {
        ...node,
        choices: node.choices.map((choice) => {
          if (choice.id !== mineActionChoiceId) {
            return choice;
          }

          const actionId = `open_mine_${Math.random().toString(36).slice(2, 8)}`;
          const openMineAction: DialogueAction = mineActionUsePayload
            ? { id: actionId, type: 'open_mine', payload: { mineId } }
            : { id: actionId, type: 'open_mine', mineId };

          return {
            ...choice,
            effects: [...(choice.effects ?? []), openMineAction],
          };
        }),
      };
    });

    setNodesJson(JSON.stringify(nextNodes, null, 2));
    patch({ nodes: nextNodes });
    setStatusText(`Добавлен action open_mine в choice: ${mineActionChoiceId}`);
  }

  function patchSelectedChoice(mutator: (choice: DialogueNode['choices'][number]) => DialogueNode['choices'][number]) {
    if (!mineActionNodeId || !mineActionChoiceId) {
      setStatusText('Сначала выберите Node и Choice для редактирования эффектов.');
      return;
    }

    const nextNodes = parsedNodes.map((node) => {
      if (node.id !== mineActionNodeId) {
        return node;
      }
      return {
        ...node,
        choices: node.choices.map((choice) => {
          if (choice.id !== mineActionChoiceId) {
            return choice;
          }
          return mutator(choice);
        }),
      };
    });

    setNodesJson(JSON.stringify(nextNodes, null, 2));
    patch({ nodes: nextNodes });
  }

  function patchSelectedActionCollection(mutator: (actions: DialogueAction[]) => DialogueAction[]) {
    if (!mineActionNodeId) {
      setStatusText('Сначала выберите Node для редактирования эффектов.');
      return;
    }

    if (selectedEffectContainer !== 'node_actions' && !mineActionChoiceId) {
      setStatusText('Сначала выберите Choice для редактирования эффектов.');
      return;
    }

    if (selectedEffectContainer === 'node_actions') {
      const nextNodes = parsedNodes.map((node) => {
        if (node.id !== mineActionNodeId) {
          return node;
        }
        const currentActions = node.actions ?? [];
        return {
          ...node,
          actions: mutator(currentActions),
        };
      });
      setNodesJson(JSON.stringify(nextNodes, null, 2));
      patch({ nodes: nextNodes });
      return;
    }

    patchSelectedChoice((choice) => {
      const currentActions = selectedEffectContainer === 'choice_actions'
        ? (choice.actions ?? [])
        : (choice.effects ?? []);
      const nextActions = mutator(currentActions);

      if (selectedEffectContainer === 'choice_actions') {
        return { ...choice, actions: nextActions };
      }

      return { ...choice, effects: nextActions };
    });
  }

  function updateSelectedChoiceReputation(changes: ReputationChangeEditorValue[]) {
    if (selectedContainerActions.length === 0 && selectedEffectContainer !== 'node_actions') {
      return;
    }

    if (selectedReputationEffectIndex < 0) {
      if (changes.length === 0) {
        return;
      }

      patchSelectedActionCollection((existing) => {
        const effects = Array.isArray(existing) ? [...existing] : [];
        const nextAction = mergeDialogueActionReputation(
          { id: `choice_rep_${Math.random().toString(36).slice(2, 8)}`, type: 'addReputation' as const },
          changes,
        );
        effects.push(nextAction);
        return effects;
      });
      setSelectedReputationEffectIndex(selectedContainerActions.length);
      return;
    }

    patchSelectedActionCollection((existing) => {
      const effects = Array.isArray(existing) ? [...existing] : [];
      const index = selectedReputationEffectIndex;

      if (changes.length === 0) {
        if (index >= 0 && index < effects.length) {
          effects.splice(index, 1);
        }
        return effects;
      }

      const current = index >= 0 && index < effects.length
        ? effects[index]
        : { id: `choice_rep_${Math.random().toString(36).slice(2, 8)}`, type: 'addReputation' as const };
      const nextAction = mergeDialogueActionReputation(current, changes);
      if (index >= 0 && index < effects.length) {
        effects[index] = nextAction;
      } else {
        effects.push(nextAction);
      }
      return effects;
    });

    if (changes.length === 0) {
      setSelectedReputationEffectIndex(-1);
    }
  }

  function updateSelectedChoiceCitizenship(value: CitizenshipEffectEditorValue | null) {
    if (selectedContainerActions.length === 0 && selectedEffectContainer !== 'node_actions') {
      return;
    }

    if (selectedCitizenshipEffectIndex < 0) {
      if (!value) {
        return;
      }

      patchSelectedActionCollection((existing) => {
        const effects = Array.isArray(existing) ? [...existing] : [];
        const nextAction = mergeDialogueActionCitizenship(
          { id: `choice_cit_${Math.random().toString(36).slice(2, 8)}`, type: 'changeCitizenship' as const },
          value,
        );
        effects.push(nextAction);
        return effects;
      });
      setSelectedCitizenshipEffectIndex(selectedContainerActions.length);
      return;
    }

    patchSelectedActionCollection((existing) => {
      const effects = Array.isArray(existing) ? [...existing] : [];
      const index = selectedCitizenshipEffectIndex;

      if (!value) {
        if (index >= 0 && index < effects.length) {
          effects.splice(index, 1);
        }
        return effects;
      }

      const current = index >= 0 && index < effects.length
        ? effects[index]
        : { id: `choice_cit_${Math.random().toString(36).slice(2, 8)}`, type: 'changeCitizenship' as const };
      const nextAction = mergeDialogueActionCitizenship(current, value);
      if (index >= 0 && index < effects.length) {
        effects[index] = nextAction;
      } else {
        effects.push(nextAction);
      }

      return effects;
    });

    if (!value) {
      setSelectedCitizenshipEffectIndex(-1);
    }
  }

  function addReputationEffectToChoice() {
    updateSelectedChoiceReputation([{ targetType: 'kingdom', targetId: 'luminor', amount: 0 }]);
  }

  function removeSelectedReputationEffectFromChoice() {
    updateSelectedChoiceReputation([]);
  }

  function addCitizenshipEffectToChoice() {
    updateSelectedChoiceCitizenship({
      kingdomId: 'luminor',
      oldKingdomPenalty: -50,
      newKingdomBonus: 20,
      requireAuthorityNpc: true,
    });
  }

  function removeSelectedCitizenshipEffectFromChoice() {
    updateSelectedChoiceCitizenship(null);
  }

  function applyMineDialogueTemplate() {
    const mineId = mineActionMineId.trim() || 'mine_teramor_mineral';
    const nextNodes: DialogueNode[] = [
      {
        id: 'start',
        speaker: 'system',
        text: 'Перед вами старая минеральная шахта. Из глубины тянет холодом, а на камнях видны следы старых кирок.',
        choices: [
          {
            id: 'choice_enter_mine',
            text: 'Войти в шахту',
            effects: [
              {
                id: 'open_mine_entry',
                type: 'open_mine',
                mineId,
              },
            ],
          },
          {
            id: 'choice_inspect',
            text: 'Осмотреть вход',
            nextNodeId: 'inspect',
          },
          {
            id: 'choice_leave',
            text: 'Уйти',
            endsDialogue: true,
          },
        ],
      },
      {
        id: 'inspect',
        speaker: 'system',
        text: 'Деревянные подпорки почернели от времени. На стене виден знак старой артели горняков.',
        choices: [
          {
            id: 'choice_back',
            text: 'Назад',
            nextNodeId: 'start',
          },
        ],
      },
    ];

    setNodesJson(JSON.stringify(nextNodes, null, 2));
    patch({
      id: draft.id.trim() || 'dialogue_mineral_mine_entrance',
      title: draft.title.trim() || 'Вход в минеральную шахту',
      startNodeId: 'start',
      nodes: nextNodes,
    });
    setMineActionNodeId('start');
    setMineActionChoiceId('choice_enter_mine');
    setMineActionMineId(mineId);
    setStatusText('Применен шаблон диалога входа в шахту.');
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <input placeholder="Поиск диалога" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button onClick={createDialogue}>СОЗДАТЬ</button>
          <button disabled={!selectedId} onClick={duplicateSelectedDialogue}>ДУБЛИРОВАТЬ</button>
          <button disabled={!selectedId} onClick={deleteSelectedDialogue}>УДАЛИТЬ</button>
          <button onClick={exportJson}>ЭКСПОРТ JSON</button>
          <button disabled={isImporting || isSaving} onClick={() => importFileRef.current?.click()}>{isImporting ? 'ИМПОРТ...' : 'ИМПОРТ JSON'}</button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={handleImportFile} />
        </div>

        {draft.npcId ? (
          <section className="card admin-item-preview">
            <div className="admin-selected-visual">
              <span className="admin-catalog-thumb admin-catalog-thumb-lg">
                {(() => {
                  const npc = npcById.get(draft.npcId ?? '');
                  const imageSrc = resolveAdminImageSource(getNpcPreviewImageKey(npc), storedImages);
                  return imageSrc
                    ? <img src={imageSrc} alt={npc?.name ?? draft.npcId} />
                    : getAdminInitials(npc?.name ?? draft.npcId, 'NPC');
                })()}
              </span>
              <div>
                <h4>{npcById.get(draft.npcId)?.name ?? draft.npcId}</h4>
                <p>{draft.title || draft.id || 'Dialogue'}</p>
                <p className="muted">{draft.npcId}</p>
              </div>
            </div>
          </section>
        ) : null}

        <div className="admin-scroll-list admin-visual-list">
          {visible.map((entry) => {
            const npc = entry.npcId ? npcById.get(entry.npcId) : null;
            const imageSrc = resolveAdminImageSource(getNpcPreviewImageKey(npc), storedImages);
            return (
              <button key={entry.id} className={`admin-entity-card ${selectedId === entry.id ? 'is-active' : ''}`} onClick={() => selectDialogue(entry)}>
                <span className="admin-catalog-thumb">
                  {imageSrc ? <img src={imageSrc} alt={npc?.name ?? entry.npcId ?? entry.id} /> : getAdminInitials(npc?.name ?? entry.title ?? entry.id, 'DLG')}
                </span>
                <span className="admin-entity-copy">
                  <strong>{entry.title || '(без названия)'}</strong>
                  <span>{npc?.name ?? entry.npcId ?? 'без NPC'}</span>
                  <span>{entry.id} | {entry.status}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label><AdminFieldLabel label="ID" hint="Уникальный id диалога." /><AdminHelpTooltip section="dialogues" field="id" /><input value={draft.id} onChange={(event) => patch({ id: event.target.value })} /></label>
          <label><AdminFieldLabel label="Title" hint="Название диалога." /><AdminHelpTooltip section="dialogues" field="title" /><input value={draft.title} onChange={(event) => patch({ title: event.target.value })} /></label>
          <label><AdminFieldLabel label="NPC" hint="Привязка диалога к NPC." /><select value={draft.npcId ?? ''} onChange={(event) => patch({ npcId: event.target.value || undefined })}><option value="">Не задано</option>{npcIds.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          <label><AdminFieldLabel label="Status" hint="Статус публикации диалога." /><select value={draft.status} onChange={(event) => patch({ status: event.target.value as DialogueDefinition['status'] })}><option value="draft">Draft</option><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
          <label><AdminFieldLabel label="Start Node ID" hint="Стартовая нода диалога." /><input value={draft.startNodeId} onChange={(event) => patch({ startNodeId: event.target.value })} /></label>
          <label><AdminFieldLabel label="Intro voice asset ID" hint="Optional voice asset played when the dialogue starts." /><input value={draft.introVoiceAssetId ?? ''} onChange={(event) => patch({ introVoiceAssetId: event.target.value || undefined })} placeholder="vo_dialogue_intro_01" /></label>
          <label><AdminFieldLabel label="Intro music asset ID" hint="Optional music cue for this dialogue scene." /><input value={draft.introMusicAssetId ?? ''} onChange={(event) => patch({ introMusicAssetId: event.target.value || undefined })} placeholder="music_dialogue_tension" /></label>
        </div>

        <AdminAudioField
          value={draft.introVoiceAssetId}
          onChange={(nextValue) => patch({ introVoiceAssetId: nextValue || undefined })}
          onStatus={setStatusText}
          mode="assetId"
          suggestedAssetId={`${draft.id || 'dialogue'}_intro_voice`}
          suggestedName={`${draft.id || 'dialogue'}-intro-voice`}
          label="Загрузить intro voice"
          hint="Загружает voice-файл и подставляет его asset ID в поле Intro voice asset ID."
        />

        <AdminAudioField
          value={draft.introMusicAssetId}
          onChange={(nextValue) => patch({ introMusicAssetId: nextValue || undefined })}
          onStatus={setStatusText}
          mode="assetId"
          suggestedAssetId={`${draft.id || 'dialogue'}_intro_music`}
          suggestedName={`${draft.id || 'dialogue'}-intro-music`}
          label="Загрузить intro music"
          hint="Загружает music-файл и подставляет его asset ID в поле Intro music asset ID."
        />

        <label>
          <AdminFieldLabel label="Описание" hint="Техническое описание для редактора." />
          <AdminHelpTooltip section="dialogues" field="description" />
          <textarea rows={3} value={draft.description ?? ''} onChange={(event) => patch({ description: event.target.value || undefined })} />
        </label>

        <section className="card admin-item-preview">
          <h4>
            Nodes / Choices editor
            {' '}
            <AdminHelpTooltip section="dialogues" field="choiceConditions" />
            {' '}
            <AdminHelpTooltip section="dialogues" field="choiceEffects" />
          </h4>
          <div className="admin-actions-row">
            <button type="button" onClick={addNode}>Добавить ноду</button>
            <button type="button" onClick={applyMineDialogueTemplate}>Шаблон: Вход в шахту</button>
          </div>
          <textarea rows={20} value={nodesJson} onChange={(event) => setNodesJson(event.target.value)} onBlur={() => patch({ nodes: parseJsonArray<DialogueNode>(nodesJson, draft.nodes) })} />
          <p className="muted" style={{ marginTop: 8 }}>Actions внутри choice/node поддерживают `addReputation`, массив `reputationChanges` и `changeCitizenship` с `kingdomId`.</p>
          <div className="admin-form-grid" style={{ marginTop: 12 }}>
            <label>
              <AdminFieldLabel label="Открыть шахту" hint="Добавить action/effect open_mine в choice." />
              <select value={mineActionNodeId} onChange={(event) => setMineActionNodeId(event.target.value)}>
                <option value="">Выберите ноду</option>
                {parsedNodes.map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}
              </select>
            </label>
            <label>
              <AdminFieldLabel label="Choice" hint="Выберите choice внутри ноды." />
              <select value={mineActionChoiceId} onChange={(event) => setMineActionChoiceId(event.target.value)}>
                <option value="">Выберите choice</option>
                {mineActionChoices.map((choice) => <option key={choice.id} value={choice.id}>{choice.text || choice.id}</option>)}
              </select>
            </label>
            <label>
              <AdminFieldLabel label="mineId" hint="ID шахты из раздела: Профессии → Горняк → Шахты" />
              <input
                placeholder="mine_teramor_mineral"
                value={mineActionMineId}
                onChange={(event) => setMineActionMineId(event.target.value)}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={mineActionUsePayload}
                onChange={(event) => setMineActionUsePayload(event.target.checked)}
              />
              Использовать payload.mineId
            </label>
          </div>
          <div className="admin-actions-row" style={{ marginTop: 8 }}>
            <button type="button" onClick={addOpenMineActionToChoice}>Открыть шахту</button>
          </div>

          <section className="card admin-item-preview" style={{ marginTop: 12 }}>
            <h4>Репутация и подданство</h4>
            <p className="muted">
              Выберите Node и при необходимости Choice, затем укажите контейнер эффектов (choice.effects, choice.actions или node.actions).
            </p>
            <label>
              <AdminFieldLabel label="Контейнер эффектов" hint="Куда сохранить addReputation/changeCitizenship в JSON." />
              <select
                value={selectedEffectContainer}
                onChange={(event) => setSelectedEffectContainer(event.target.value as DialogueEffectContainer)}
              >
                <option value="choice_effects">choice.effects</option>
                <option value="choice_actions">choice.actions</option>
                <option value="node_actions">node.actions</option>
              </select>
            </label>
            <div className="admin-form-grid" style={{ marginBottom: 10 }}>
              <label>
                <AdminFieldLabel label="Reputation effect" hint="Можно иметь несколько addReputation/add_reputation в одном choice." />
                <select
                  value={selectedReputationEffectIndex >= 0 ? String(selectedReputationEffectIndex) : ''}
                  onChange={(event) => setSelectedReputationEffectIndex(event.target.value ? Number(event.target.value) : -1)}
                >
                  <option value="">Не выбран</option>
                  {selectedChoiceReputationEffectEntries.map(({ entry, index }, idx) => (
                    <option key={`${entry.id ?? 'rep'}-${index}`} value={String(index)}>
                      {`#${idx + 1} (${entry.id ?? entry.type})`}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-actions-row" style={{ alignSelf: 'end' }}>
                <button type="button" onClick={addReputationEffectToChoice}>Добавить reputation effect</button>
                <button
                  type="button"
                  onClick={removeSelectedReputationEffectFromChoice}
                  disabled={selectedReputationEffectIndex < 0}
                >
                  Удалить выбранный reputation effect
                </button>
              </div>
            </div>
            <ReputationChangesEditor
              value={selectedChoiceReputationChanges}
              onChange={updateSelectedChoiceReputation}
            />
            <div className="admin-form-grid" style={{ marginBottom: 10 }}>
              <label>
                <AdminFieldLabel label="Citizenship effect" hint="Можно иметь несколько changeCitizenship/change_citizenship в одном choice." />
                <select
                  value={selectedCitizenshipEffectIndex >= 0 ? String(selectedCitizenshipEffectIndex) : ''}
                  onChange={(event) => setSelectedCitizenshipEffectIndex(event.target.value ? Number(event.target.value) : -1)}
                >
                  <option value="">Не выбран</option>
                  {selectedChoiceCitizenshipEffectEntries.map(({ entry, index }, idx) => (
                    <option key={`${entry.id ?? 'cit'}-${index}`} value={String(index)}>
                      {`#${idx + 1} (${entry.id ?? entry.type})`}
                    </option>
                  ))}
                </select>
              </label>
              <div className="admin-actions-row" style={{ alignSelf: 'end' }}>
                <button type="button" onClick={addCitizenshipEffectToChoice}>Добавить citizenship effect</button>
                <button
                  type="button"
                  onClick={removeSelectedCitizenshipEffectFromChoice}
                  disabled={selectedCitizenshipEffectIndex < 0}
                >
                  Удалить выбранный citizenship effect
                </button>
              </div>
            </div>
            <CitizenshipEffectEditor
              value={selectedChoiceCitizenship}
              onChange={updateSelectedChoiceCitizenship}
            />
          </section>
        </section>

        <section className="card admin-item-preview">
          <h4>Preview</h4>
          {draft.nodes.map((node) => (
            <div key={node.id} className="admin-subcard">
              <strong>{node.id} ({node.speaker})</strong>
              <p>{node.text || '...'}</p>
              {node.choices.map((choice) => (
                <p key={choice.id} className="muted">- {choice.text || choice.id} {choice.nextNodeId ? `=> ${choice.nextNodeId}` : ''} {choice.endsDialogue ? '(end)' : ''} {choice.questIconMode ? `[${choice.questIconMode}]` : ''}</p>
              ))}
            </div>
          ))}
        </section>

        <section className="card admin-item-preview">
          <h4>Validation</h4>
          <p>Ошибки: {validation.errors.length}</p>
          {validation.errors.map((entry) => <p key={entry} className="muted">• {entry}</p>)}
          <p>Предупреждения: {validation.warnings.length}</p>
          {validation.warnings.map((entry) => <p key={entry} className="muted">• {entry}</p>)}
        </section>

        <div className="admin-actions-row">
          <button disabled={isSaving} onClick={() => { void saveCurrent(); }}>{isSaving ? 'Сохранение...' : (selectedId ? 'СОХРАНИТЬ' : 'СОЗДАТЬ')}</button>
          <button disabled={!selectedId} onClick={duplicateSelectedDialogue}>ДУБЛИРОВАТЬ</button>
          <button disabled={!selectedId} onClick={deleteSelectedDialogue}>УДАЛИТЬ</button>
        </div>

        <AdminSaveStatus value={saveState} />
        <p className="muted">{statusText}</p>
      </section>
    </div>
  );
}
