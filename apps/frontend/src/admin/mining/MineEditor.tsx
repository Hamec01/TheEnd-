import { useEffect, useMemo, useState } from 'react';
import type { MineDefinition, MineDangerLevel, MineVisualTheme } from '../../types/mining';
import { downloadCollectionJson } from '../../services/content/adminJsonImportExport';
import { loadMinesFromStorage, saveMinesToStorage } from '../../services/miningRepository';
import { AdminFieldLabel } from '../adminUi';

interface MineEditorProps {
  onSave?: (mines: MineDefinition[]) => void;
}

const DANGER_LEVELS: MineDangerLevel[] = ['low', 'medium', 'high', 'deadly'];
const VISUAL_THEMES: MineVisualTheme[] = ['teramor_stone', 'coal', 'zeptyrite', 'lava', 'ice', 'shadow', 'crystal'];

function emptyMine(): MineDefinition {
  return {
    id: '',
    name: '',
    description: '',
    shortDescription: '',
    requiredProfessionId: 'mining',
    requiredMiningLevel: 1,
    dangerLevel: 'low',
    visualTheme: 'teramor_stone',
    region: '',
    depthIds: [],
    knownResources: [],
    entryText: '',
    isEnabled: true,
  };
}

function normalizeMineDraft(draft: MineDefinition): MineDefinition {
  return {
    ...draft,
    id: draft.id.trim(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    shortDescription: draft.shortDescription?.trim() || undefined,
    region: draft.region?.trim() || undefined,
    depthIds: draft.depthIds.map((entry) => entry.trim()).filter(Boolean),
    knownResources: draft.knownResources.map((entry) => entry.trim()).filter(Boolean),
    entryText: draft.entryText?.trim() || undefined,
    requiredProfessionId: 'mining',
    requiredMiningLevel: Math.max(1, Math.floor(Number(draft.requiredMiningLevel || 1))),
  };
}

export function MineEditor({ onSave }: MineEditorProps) {
  const [mines, setMines] = useState<MineDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MineDefinition>(emptyMine());
  const [status, setStatus] = useState('Готово');

  useEffect(() => {
    const loaded = loadMinesFromStorage();
    setMines(loaded);
    if (loaded.length > 0) {
      setSelectedId(loaded[0]!.id);
      setDraft(loaded[0]!);
    }
  }, []);

  const selectedMine = useMemo(
    () => mines.find((entry) => entry.id === selectedId) ?? null,
    [mines, selectedId],
  );

  function persist(next: MineDefinition[], nextStatus: string) {
    setMines(next);
    saveMinesToStorage(next);
    onSave?.(next);
    setStatus(nextStatus);
  }

  function beginCreate() {
    setSelectedId(null);
    setDraft(emptyMine());
  }

  function beginEdit(id: string) {
    const found = mines.find((entry) => entry.id === id);
    if (!found) {
      return;
    }
    setSelectedId(id);
    setDraft(found);
  }

  function saveDraft() {
    const normalized = normalizeMineDraft(draft);
    if (!normalized.id || !normalized.name || !normalized.description) {
      setStatus('Заполните id, название и описание шахты.');
      return;
    }

    if (selectedId) {
      if (selectedId !== normalized.id && mines.some((entry) => entry.id === normalized.id)) {
        setStatus(`Шахта с id ${normalized.id} уже существует.`);
        return;
      }
      const next = mines
        .filter((entry) => entry.id !== selectedId)
        .concat([{ ...normalized, updatedAt: new Date().toISOString(), createdAt: selectedMine?.createdAt ?? new Date().toISOString() }])
        .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
      setSelectedId(normalized.id);
      setDraft(normalized);
      persist(next, `Шахта сохранена: ${normalized.name}`);
      return;
    }

    if (mines.some((entry) => entry.id === normalized.id)) {
      setStatus(`Шахта с id ${normalized.id} уже существует.`);
      return;
    }

    const entry = { ...normalized, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const next = [...mines, entry].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
    setSelectedId(entry.id);
    setDraft(entry);
    persist(next, `Шахта создана: ${entry.name}`);
  }

  function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm(`Удалить шахту ${selectedId}?`)) {
      return;
    }
    const next = mines.filter((entry) => entry.id !== selectedId);
    persist(next, `Шахта удалена: ${selectedId}`);
    if (next.length > 0) {
      setSelectedId(next[0]!.id);
      setDraft(next[0]!);
    } else {
      beginCreate();
    }
  }

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_mines',
      collectionKey: 'mines',
      entries: mines,
    });
    setStatus(`Экспортировано шахт: ${mines.length}`);
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <button onClick={beginCreate}>Новая шахта</button>
          <button onClick={exportJson}>Экспорт JSON</button>
        </div>
        <div className="admin-scroll-list">
          {mines.map((mine) => (
            <button
              key={mine.id}
              className={selectedId === mine.id ? 'is-active' : ''}
              onClick={() => beginEdit(mine.id)}
            >
              <strong>{mine.name}</strong>
              <span>{mine.id} | {mine.requiredMiningLevel}+ | {mine.dangerLevel}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Используется в open_mine + mineId." />
            <input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} placeholder="mine_teramor_old_iron" />
          </label>
          <label>
            <AdminFieldLabel label="Название" />
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Короткое описание" />
            <input value={draft.shortDescription ?? ''} onChange={(event) => setDraft((current) => ({ ...current, shortDescription: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Регион" />
            <input value={draft.region ?? ''} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Требуемый уровень Горняка" />
            <input type="number" min={1} value={draft.requiredMiningLevel} onChange={(event) => setDraft((current) => ({ ...current, requiredMiningLevel: Number(event.target.value) || 1 }))} />
          </label>
          <label>
            <AdminFieldLabel label="Уровень опасности" />
            <select value={draft.dangerLevel} onChange={(event) => setDraft((current) => ({ ...current, dangerLevel: event.target.value as MineDangerLevel }))}>
              {DANGER_LEVELS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Визуальная тема" />
            <select value={draft.visualTheme} onChange={(event) => setDraft((current) => ({ ...current, visualTheme: event.target.value as MineVisualTheme }))}>
              {VISUAL_THEMES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))} />
            <AdminFieldLabel label="Включена" />
          </label>
        </div>

        <label>
          <AdminFieldLabel label="Описание" />
          <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={4} />
        </label>

        <label>
          <AdminFieldLabel label="Текст входа" />
          <textarea value={draft.entryText ?? ''} onChange={(event) => setDraft((current) => ({ ...current, entryText: event.target.value }))} rows={3} />
        </label>

        <label>
          <AdminFieldLabel label="ID глубин" hint="Через запятую. Используются для порядка глубин шахты." />
          <input
            value={draft.depthIds.join(', ')}
            onChange={(event) => setDraft((current) => ({ ...current, depthIds: event.target.value.split(',') }))}
            placeholder="mine_teramor_old_iron_depth_1, mine_teramor_old_iron_depth_2"
          />
        </label>

        <label>
          <AdminFieldLabel label="Известные ресурсы" hint="Через запятую. Показываются игроку до входа." />
          <input
            value={draft.knownResources.join(', ')}
            onChange={(event) => setDraft((current) => ({ ...current, knownResources: event.target.value.split(',') }))}
            placeholder="Камень, Железная руда, Золото"
          />
        </label>

        <div className="admin-actions-row">
          <button onClick={saveDraft}>{selectedId ? 'Сохранить' : 'Создать'}</button>
          <button disabled={!selectedId} onClick={deleteSelected}>Удалить</button>
        </div>
        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
