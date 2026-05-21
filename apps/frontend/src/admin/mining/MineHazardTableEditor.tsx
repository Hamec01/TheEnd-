import { useEffect, useState } from 'react';
import type { MineHazardTable } from '../../types/mining';
import { downloadCollectionJson } from '../../services/content/adminJsonImportExport';
import {
  loadMineHazardTablesFromStorage,
  loadMineHazardsFromStorage,
  saveMineHazardTablesToStorage,
} from '../../services/miningRepository';
import { AdminFieldLabel } from '../adminUi';

interface MineHazardTableEditorProps {
  onSave?: (tables: MineHazardTable[]) => void;
}

function emptyTable(): MineHazardTable {
  return {
    id: '',
    name: '',
    entries: [],
  };
}

export function MineHazardTableEditor({ onSave }: MineHazardTableEditorProps) {
  const [tables, setTables] = useState<MineHazardTable[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MineHazardTable>(emptyTable());
  const [status, setStatus] = useState('Готово');
  const hazards = loadMineHazardsFromStorage();

  useEffect(() => {
    const loaded = loadMineHazardTablesFromStorage();
    setTables(loaded);
    if (loaded.length > 0) {
      setSelectedId(loaded[0]!.id);
      setDraft(loaded[0]!);
    }
  }, []);

  function persist(next: MineHazardTable[], nextStatus: string) {
    setTables(next);
    saveMineHazardTablesToStorage(next);
    onSave?.(next);
    setStatus(nextStatus);
  }

  function startNew() {
    setSelectedId(null);
    setDraft(emptyTable());
  }

  function selectTable(id: string) {
    const found = tables.find((entry) => entry.id === id);
    if (!found) {
      return;
    }
    setSelectedId(id);
    setDraft(found);
  }

  function patchEntry(index: number, patch: Partial<MineHazardTable['entries'][number]>) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)),
    }));
  }

  function addEntry() {
    setDraft((current) => ({
      ...current,
      entries: [...current.entries, { hazardId: hazards[0]?.id ?? '', weight: 1, minDepth: 1, maxDepth: 3 }],
    }));
  }

  function removeEntry(index: number) {
    setDraft((current) => ({ ...current, entries: current.entries.filter((_, entryIndex) => entryIndex !== index) }));
  }

  function saveDraft() {
    const normalized: MineHazardTable = {
      ...draft,
      id: draft.id.trim(),
      name: draft.name.trim(),
      entries: draft.entries
        .map((entry) => ({
          hazardId: entry.hazardId.trim(),
          weight: Math.max(1, Math.floor(Number(entry.weight || 1))),
          minDepth: entry.minDepth ? Math.max(1, Math.floor(Number(entry.minDepth))) : undefined,
          maxDepth: entry.maxDepth ? Math.max(1, Math.floor(Number(entry.maxDepth))) : undefined,
        }))
        .filter((entry) => Boolean(entry.hazardId)),
    };
    if (!normalized.id || !normalized.name) {
      setStatus('Заполните id и название таблицы опасностей.');
      return;
    }

    if (selectedId) {
      if (selectedId !== normalized.id && tables.some((entry) => entry.id === normalized.id)) {
        setStatus(`Таблица опасностей с id ${normalized.id} уже существует.`);
        return;
      }
      const next = tables.filter((entry) => entry.id !== selectedId).concat([normalized]);
      setSelectedId(normalized.id);
      persist(next, `Таблица опасностей сохранена: ${normalized.name}`);
      return;
    }

    if (tables.some((entry) => entry.id === normalized.id)) {
      setStatus(`Таблица опасностей с id ${normalized.id} уже существует.`);
      return;
    }
    const next = [...tables, normalized];
    setSelectedId(normalized.id);
    persist(next, `Таблица опасностей создана: ${normalized.name}`);
  }

  function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm(`Удалить таблицу опасностей ${selectedId}?`)) {
      return;
    }
    const next = tables.filter((entry) => entry.id !== selectedId);
    persist(next, `Таблица опасностей удалена: ${selectedId}`);
    startNew();
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <button onClick={startNew}>Новая таблица</button>
          <button onClick={() => {
            downloadCollectionJson({ filePrefix: 'theend_mine_hazard_tables', collectionKey: 'mineHazardTables', entries: tables });
            setStatus(`Экспортировано таблиц опасностей: ${tables.length}`);
          }}
          >
            Экспорт JSON
          </button>
        </div>
        <div className="admin-scroll-list">
          {tables.map((table) => (
            <button key={table.id} className={selectedId === table.id ? 'is-active' : ''} onClick={() => selectTable(table.id)}>
              <strong>{table.name}</strong>
              <span>{table.id} | entries {table.entries.length}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" />
            <input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Название" />
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
        </div>

        <h4>Записи таблицы</h4>
        <div className="admin-scroll-list merchant-item-pick">
          {draft.entries.map((entry, index) => (
            <div key={`${entry.hazardId}-${index}`} className="merchant-item-row is-active">
              <button onClick={() => removeEntry(index)}>Убрать</button>
              <label>
                <AdminFieldLabel label="Опасность" />
                <select value={entry.hazardId} onChange={(event) => patchEntry(index, { hazardId: event.target.value })}>
                  <option value="">Выберите опасность</option>
                  {hazards.map((hazard) => <option key={hazard.id} value={hazard.id}>{hazard.name}</option>)}
                </select>
              </label>
              <label>
                <AdminFieldLabel label="Вес" />
                <input type="number" min={1} value={entry.weight} onChange={(event) => patchEntry(index, { weight: Number(event.target.value) || 1 })} />
              </label>
              <label>
                <AdminFieldLabel label="Min depth" />
                <input type="number" min={1} value={entry.minDepth ?? ''} onChange={(event) => patchEntry(index, { minDepth: event.target.value ? Number(event.target.value) : undefined })} />
              </label>
              <label>
                <AdminFieldLabel label="Max depth" />
                <input type="number" min={1} value={entry.maxDepth ?? ''} onChange={(event) => patchEntry(index, { maxDepth: event.target.value ? Number(event.target.value) : undefined })} />
              </label>
            </div>
          ))}
        </div>
        <div className="admin-actions-row">
          <button onClick={addEntry}>Добавить запись</button>
        </div>

        <div className="admin-actions-row">
          <button onClick={saveDraft}>{selectedId ? 'Сохранить' : 'Создать'}</button>
          <button disabled={!selectedId} onClick={deleteSelected}>Удалить</button>
        </div>
        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
