import { useEffect, useState } from 'react';
import type { MineLootTable } from '../../types/mining';
import { downloadCollectionJson, extractRawCollectionFromImportJson } from '../../services/content/adminJsonImportExport';
import { loadMineLootTablesFromStorage, saveMineLootTablesToStorage } from '../../services/miningRepository';
import { itemsService } from '../../services/content/itemsService';
import { materialsService } from '../../services/content/materialsService';
import { AdminFieldLabel } from '../adminUi';

interface MineLootTableEditorProps {
  onSave?: (tables: MineLootTable[]) => void;
}

const LEGACY_LOOT_ITEM_ID_MAP: Record<string, string> = {
  item_raw_stone: 'mat_raw_stone',
  item_iron_ore: 'mat_iron_ore',
  item_small_gold_nugget: 'mat_gold_nugget',
  item_cracked_crystal: 'mat_cracked_crystal',
  item_zeptyrite_trace: 'mat_zeptyrite_trace',
};

function emptyTable(): MineLootTable {
  return {
    id: '',
    name: '',
    entries: [],
  };
}

function normalizeLootItemId(value: string): string {
  const normalized = value.trim();
  return LEGACY_LOOT_ITEM_ID_MAP[normalized] ?? normalized;
}

export function MineLootTableEditor({ onSave }: MineLootTableEditorProps) {
  const [tables, setTables] = useState<MineLootTable[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MineLootTable>(emptyTable());
  const [status, setStatus] = useState('Готово');
  const [knownIds, setKnownIds] = useState<string[]>([]);

  useEffect(() => {
    const loaded = loadMineLootTablesFromStorage();
    setTables(loaded);
    if (loaded.length > 0) {
      setSelectedId(loaded[0]!.id);
      setDraft(loaded[0]!);
    }
    void Promise.all([
      itemsService.getAll().then((items) => items.map((entry) => String(entry.id ?? '').trim())),
      materialsService.getAll().then((materials) => materials.map((entry) => String(entry.id ?? '').trim())),
    ]).then(([itemIds, materialIds]) => {
      setKnownIds(Array.from(new Set([...itemIds, ...materialIds].filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ru')));
    }).catch(() => setKnownIds([]));
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
          itemId: normalizeLootItemId(entry.itemId),
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

  function handleImportJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      try {
        const payload = JSON.parse(await file.text()) as unknown;
        const rawEntries = extractRawCollectionFromImportJson(payload, 'mineLootTables');
        saveMineLootTablesToStorage(rawEntries as MineLootTable[]);
        const imported = loadMineLootTablesFromStorage();
        setTables(imported);
        setSelectedId(imported[0]?.id ?? null);
        setDraft(imported[0] ?? emptyTable());
        setStatus(`Импортировано таблиц добычи: ${imported.length}`);
        onSave?.(imported);
      } catch (error) {
        setStatus(`Ошибка импорта: ${String((error as Error).message ?? error)}`);
      }
    };
    input.click();
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
          <button onClick={handleImportJson}>Импорт JSON</button>
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
        <div className="admin-scroll-list merchant-item-pick" style={{ maxHeight: '42rem', overflowX: 'hidden' }}>
          {draft.entries.map((entry, index) => (
            <div
              key={`${entry.itemId}-${index}`}
              className="merchant-item-row is-active"
              style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) repeat(5, minmax(120px, 1fr))', gap: 12, alignItems: 'end' }}
            >
              <button onClick={() => removeEntry(index)}>Убрать</button>
              <label>
                <AdminFieldLabel label="Item ID" />
                <input list="mine-loot-known-ids" value={entry.itemId} onChange={(event) => patchEntry(index, { itemId: event.target.value })} placeholder="mat_iron_ore" />
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
        <datalist id="mine-loot-known-ids">
          {knownIds.map((entry) => <option key={entry} value={entry} />)}
        </datalist>
      </section>
    </div>
  );
}
