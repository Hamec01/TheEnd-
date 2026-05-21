import { useEffect, useState } from 'react';
import type { MineLootTable } from '../../types/mining';
import { downloadCollectionJson } from '../../services/content/adminJsonImportExport';
import { loadMineLootTablesFromStorage, saveMineLootTablesToStorage } from '../../services/miningRepository';
import { AdminFieldLabel } from '../adminUi';

interface MineLootTableEditorProps {
  onSave?: (tables: MineLootTable[]) => void;
}

function emptyTable(): MineLootTable {
  return {
    id: '',
    name: '',
    entries: [],
  };
}

export function MineLootTableEditor({ onSave }: MineLootTableEditorProps) {
  const [tables, setTables] = useState<MineLootTable[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MineLootTable>(emptyTable());
  const [status, setStatus] = useState('Готово');

  useEffect(() => {
    const loaded = loadMineLootTablesFromStorage();
    setTables(loaded);
    if (loaded.length > 0) {
      setSelectedId(loaded[0]!.id);
      setDraft(loaded[0]!);
    }
  }, []);

  function persist(next: MineLootTable[], nextStatus: string) {
    setTables(next);
    saveMineLootTablesToStorage(next);
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

  function addEntry() {
    setDraft((current) => ({
      ...current,
      entries: [...current.entries, { itemId: '', weight: 10, minQuantity: 1, maxQuantity: 1 }],
    }));
  }

  function patchEntry(index: number, patch: Partial<MineLootTable['entries'][number]>) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)),
    }));
  }

  function removeEntry(index: number) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.filter((_, entryIndex) => entryIndex !== index),
    }));
  }

  function saveDraft() {
    const normalized: MineLootTable = {
      ...draft,
      id: draft.id.trim(),
      name: draft.name.trim(),
      entries: draft.entries
        .map((entry) => ({
          itemId: entry.itemId.trim(),
          weight: Math.max(1, Math.floor(Number(entry.weight || 1))),
          minQuantity: Math.max(1, Math.floor(Number(entry.minQuantity || 1))),
          maxQuantity: Math.max(1, Math.floor(Number(entry.maxQuantity || 1))),
          requiredDepth: entry.requiredDepth ? Math.max(1, Math.floor(Number(entry.requiredDepth))) : undefined,
          rarity: entry.rarity?.trim() || undefined,
        }))
        .filter((entry) => Boolean(entry.itemId)),
    };

    if (!normalized.id || !normalized.name) {
      setStatus('Заполните id и название таблицы добычи.');
      return;
    }

    if (selectedId) {
      if (selectedId !== normalized.id && tables.some((entry) => entry.id === normalized.id)) {
        setStatus(`Таблица добычи с id ${normalized.id} уже существует.`);
        return;
      }
      const next = tables.filter((entry) => entry.id !== selectedId).concat([normalized]);
      setSelectedId(normalized.id);
      persist(next, `Таблица добычи сохранена: ${normalized.name}`);
      return;
    }

    if (tables.some((entry) => entry.id === normalized.id)) {
      setStatus(`Таблица добычи с id ${normalized.id} уже существует.`);
      return;
    }
    const next = [...tables, normalized];
    setSelectedId(normalized.id);
    persist(next, `Таблица добычи создана: ${normalized.name}`);
  }

  function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm(`Удалить таблицу добычи ${selectedId}?`)) {
      return;
    }
    const next = tables.filter((entry) => entry.id !== selectedId);
    persist(next, `Таблица добычи удалена: ${selectedId}`);
    startNew();
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <button onClick={startNew}>Новая таблица</button>
          <button onClick={() => {
            downloadCollectionJson({ filePrefix: 'theend_mine_loot_tables', collectionKey: 'mineLootTables', entries: tables });
            setStatus(`Экспортировано таблиц добычи: ${tables.length}`);
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
            <div key={`${entry.itemId}-${index}`} className="merchant-item-row is-active">
              <button onClick={() => removeEntry(index)}>Убрать</button>
              <label>
                <AdminFieldLabel label="Item ID" />
                <input value={entry.itemId} onChange={(event) => patchEntry(index, { itemId: event.target.value })} placeholder="item_iron_ore" />
              </label>
              <label>
                <AdminFieldLabel label="Вес" />
                <input type="number" min={1} value={entry.weight} onChange={(event) => patchEntry(index, { weight: Number(event.target.value) || 1 })} />
              </label>
              <label>
                <AdminFieldLabel label="Min qty" />
                <input type="number" min={1} value={entry.minQuantity} onChange={(event) => patchEntry(index, { minQuantity: Number(event.target.value) || 1 })} />
              </label>
              <label>
                <AdminFieldLabel label="Max qty" />
                <input type="number" min={1} value={entry.maxQuantity} onChange={(event) => patchEntry(index, { maxQuantity: Number(event.target.value) || 1 })} />
              </label>
              <label>
                <AdminFieldLabel label="Required depth" />
                <input type="number" min={1} value={entry.requiredDepth ?? ''} onChange={(event) => patchEntry(index, { requiredDepth: event.target.value ? Number(event.target.value) : undefined })} />
              </label>
              <label>
                <AdminFieldLabel label="Rarity" />
                <input value={entry.rarity ?? ''} onChange={(event) => patchEntry(index, { rarity: event.target.value })} />
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
