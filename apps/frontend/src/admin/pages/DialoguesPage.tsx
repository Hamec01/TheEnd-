import { useEffect, useMemo, useState } from 'react';
import { AdminFieldLabel } from '../adminUi';
import { deleteDialogue, duplicateDialogue, exportDialoguesJson, getAllDialogues, importDialoguesJson, saveDialogue } from '../../services/dialogueRepository';
import { getAllNpcs } from '../../services/npcRepository';
import { getAllQuests, getQuestItems } from '../../services/questRepository';
import { itemsService } from '../../services/content/itemsService';
import { skillsService } from '../../services/content/skillsService';
import { validateDialogue } from '../../services/dialogueValidator';
import type { DialogueDefinition, DialogueNode, DialogueValidationWorldData } from '../../types/dialogue';

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

export function DialoguesPage() {
  const [dialogues, setDialogues] = useState<DialogueDefinition[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DialogueDefinition>(emptyDialogue());
  const [statusText, setStatusText] = useState('Готово');
  const [nodesJson, setNodesJson] = useState('[]');

  const [npcIds, setNpcIds] = useState<string[]>([]);
  const [questIds, setQuestIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [questItemIds, setQuestItemIds] = useState<string[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);

  function refresh() {
    const all = getAllDialogues();
    setDialogues(all);
    if (selectedId && !all.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
      setDraft(emptyDialogue());
    }
  }

  useEffect(() => {
    void Promise.all([itemsService.getAll(), skillsService.getAll()]).then(([items, skills]) => {
      setItemIds(items.map((entry) => entry.id));
      setSkillIds(skills.map((entry) => entry.id));
    });
    setNpcIds(getAllNpcs().map((entry) => entry.id));
    setQuestIds(getAllQuests().map((entry) => entry.id));
    setQuestItemIds(getQuestItems().map((entry) => entry.id));
    refresh();
  }, []);

  useEffect(() => {
    setNodesJson(JSON.stringify(draft.nodes, null, 2));
  }, [draft]);

  const worldData = useMemo<DialogueValidationWorldData>(() => ({
    npcIds,
    questIds,
    itemIds,
    questItemIds,
    skillIds,
    factionIds: ['free_cities', 'artalon_guard', 'mist_cult'],
    kingdomIds: ['artalon', 'none'],
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

  function saveCurrent() {
    const prepared: DialogueDefinition = {
      ...draft,
      id: draft.id.trim() || `dlg_${Math.random().toString(36).slice(2, 8)}`,
      title: draft.title.trim(),
      startNodeId: draft.startNodeId.trim(),
      nodes: parseJsonArray<DialogueNode>(nodesJson, draft.nodes),
      updatedAt: new Date().toISOString(),
      createdAt: draft.createdAt || new Date().toISOString(),
    };

    const result = dialogueValidation(prepared, worldData);
    if (prepared.status === 'active' && result.errors.length > 0) {
      setStatusText('Нельзя активировать диалог с ошибками.');
      return;
    }

    const saved = saveDialogue(prepared);
    setSelectedId(saved.id);
    setDraft(saved);
    refresh();
    setStatusText(`Диалог сохранен: ${saved.id}`);
  }

  function duplicateSelectedDialogue() {
    if (!selectedId) {
      return;
    }
    const copied = duplicateDialogue(selectedId);
    setSelectedId(copied.id);
    setDraft(copied);
    refresh();
    setStatusText(`Создана копия: ${copied.id}`);
  }

  function deleteSelectedDialogue() {
    if (!selectedId) {
      return;
    }
    deleteDialogue(selectedId);
    setSelectedId(null);
    setDraft(emptyDialogue());
    refresh();
    setStatusText(`Диалог удален: ${selectedId}`);
  }

  function exportJson() {
    navigator.clipboard.writeText(exportDialoguesJson()).then(() => {
      setStatusText('JSON диалогов скопирован в буфер обмена.');
    }).catch(() => {
      setStatusText('Не удалось скопировать JSON диалогов.');
    });
  }

  function importJson() {
    const raw = window.prompt('Вставьте JSON диалогов для импорта:');
    if (!raw) {
      return;
    }
    try {
      const count = importDialoguesJson(raw);
      refresh();
      setStatusText(`Импорт диалогов завершен: ${count}`);
    } catch (error) {
      setStatusText((error as Error).message);
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

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <input placeholder="Поиск диалога" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button onClick={createDialogue}>СОЗДАТЬ</button>
          <button disabled={!selectedId} onClick={duplicateSelectedDialogue}>ДУБЛИРОВАТЬ</button>
          <button disabled={!selectedId} onClick={deleteSelectedDialogue}>УДАЛИТЬ</button>
          <button onClick={exportJson}>ЭКСПОРТ JSON</button>
          <button onClick={importJson}>ИМПОРТ JSON</button>
        </div>

        <div className="admin-scroll-list">
          {visible.map((entry) => (
            <button key={entry.id} className={selectedId === entry.id ? 'is-active' : ''} onClick={() => selectDialogue(entry)}>
              <strong>{entry.title || '(без названия)'}</strong>
              <span>{entry.id} | {entry.npcId || 'без NPC'} | {entry.status}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label><AdminFieldLabel label="ID" hint="Уникальный id диалога." /><input value={draft.id} onChange={(event) => patch({ id: event.target.value })} /></label>
          <label><AdminFieldLabel label="Title" hint="Название диалога." /><input value={draft.title} onChange={(event) => patch({ title: event.target.value })} /></label>
          <label><AdminFieldLabel label="NPC" hint="Привязка диалога к NPC." /><select value={draft.npcId ?? ''} onChange={(event) => patch({ npcId: event.target.value || undefined })}><option value="">Не задано</option>{npcIds.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          <label><AdminFieldLabel label="Status" hint="Статус публикации диалога." /><select value={draft.status} onChange={(event) => patch({ status: event.target.value as DialogueDefinition['status'] })}><option value="draft">Draft</option><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
          <label><AdminFieldLabel label="Start Node ID" hint="Стартовая нода диалога." /><input value={draft.startNodeId} onChange={(event) => patch({ startNodeId: event.target.value })} /></label>
        </div>

        <label>
          <AdminFieldLabel label="Описание" hint="Техническое описание для редактора." />
          <textarea rows={3} value={draft.description ?? ''} onChange={(event) => patch({ description: event.target.value || undefined })} />
        </label>

        <section className="card admin-item-preview">
          <h4>Nodes / Choices editor</h4>
          <div className="admin-actions-row">
            <button type="button" onClick={addNode}>Добавить ноду</button>
          </div>
          <textarea rows={20} value={nodesJson} onChange={(event) => setNodesJson(event.target.value)} onBlur={() => patch({ nodes: parseJsonArray<DialogueNode>(nodesJson, draft.nodes) })} />
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
          <button onClick={saveCurrent}>{selectedId ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}</button>
          <button disabled={!selectedId} onClick={duplicateSelectedDialogue}>ДУБЛИРОВАТЬ</button>
          <button disabled={!selectedId} onClick={deleteSelectedDialogue}>УДАЛИТЬ</button>
        </div>

        <p className="muted">{statusText}</p>
      </section>
    </div>
  );
}
