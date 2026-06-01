import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { AdminItem, LootTable } from '../../services/content/models';
import { downloadCollectionJson } from '../../services/content/adminJsonImportExport';
import { itemsService } from '../../services/content/itemsService';
import { extractRawLootTablesFromImportJson, importLootTablesFromJsonEntries, lootTablesService, validateLootTable } from '../../services/content/lootTablesService';
import { uid } from '../../services/content/storage';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import {
  AdminFieldLabel,
  translateAdminErrorMessage,
  translateItemType,
  translateLootSourceType,
} from '../adminUi';

const LOOT_SOURCE_TYPES: LootTable['sourceType'][] = ['npc', 'monster', 'chest', 'region', 'quest', 'merchant_special'];

function emptyLootTable(): LootTable {
  const now = new Date().toISOString();
  return {
    id: '',
    name: '',
    sourceType: 'monster',
    sourceId: '',
    entries: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function LootTablesPage() {
  const [tables, setTables] = useState<LootTable[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LootTable>(emptyLootTable());
  const [status, setStatus] = useState('Готово');
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [allTables, allItems] = await Promise.all([lootTablesService.getAll(), itemsService.getAll()]);
    setTables(allTables);
    setItems(allItems.filter((item) => item.isEnabled));
    if (selectedId && !allTables.some((table) => table.id === selectedId)) {
      setSelectedId(null);
      setDraft(emptyLootTable());
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_lootTables',
      collectionKey: 'lootTables',
      entries: tables,
    });
    setStatus(`Экспорт: lootTables (${tables.length})`);
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isImporting) {
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const entries = extractRawLootTablesFromImportJson(payload);
      const result = await importLootTablesFromJsonEntries(entries);
      await refresh();
      const parts = [
        result.created.length ? `создано: ${result.created.length}` : null,
        result.skippedExisting.length ? `пропущено существующих: ${result.skippedExisting.length}` : null,
        result.errors.length ? `ошибок: ${result.errors.length}` : null,
      ].filter(Boolean);
      setStatus(`Импорт таблиц добычи: ${parts.join(', ') || 'нет изменений'}`);
    } catch (error) {
      setStatus(`Импорт: ${(error as Error).message}`);
    } finally {
      setIsImporting(false);
    }
  }

  const expectedDrops = useMemo(() => {
    return draft.entries.map((entry) => {
      const item = items.find((candidate) => candidate.id === entry.itemId);
      const avgQty = (entry.minQuantity + entry.maxQuantity) / 2;
      const expectation = entry.chance * avgQty;
      return {
        itemName: item?.name ?? entry.itemId,
        expectation,
      };
    }).sort((left, right) => right.expectation - left.expectation);
  }, [draft.entries, items]);

  function patch(next: Partial<LootTable>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function addEntry(itemId: string) {
    if (!itemId || draft.entries.some((entry) => entry.itemId === itemId)) {
      return;
    }
    setDraft((current) => ({
      ...current,
      entries: [...current.entries, { itemId, chance: 0.15, minQuantity: 1, maxQuantity: 1, isEnabled: true }],
    }));
  }

  function patchEntry(itemId: string, patchData: Partial<LootTable['entries'][number]>) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry) => (entry.itemId === itemId ? { ...entry, ...patchData } : entry)),
    }));
  }

  function removeEntry(itemId: string) {
    setDraft((current) => ({ ...current, entries: current.entries.filter((entry) => entry.itemId !== itemId) }));
  }

  async function createOrUpdate() {
    const id = draft.id.trim() || uid('loot');
    const normalized: LootTable = {
      ...draft,
      id,
      updatedAt: new Date().toISOString(),
    };
    const errors = validateLootTable(normalized);
    if (errors.length > 0) {
      setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
      return;
    }

    try {
      if (selectedId) {
        if (normalized.id !== selectedId) {
          const created = await lootTablesService.rename(selectedId, normalized.id, normalized);
          setSelectedId(created.id);
          setStatus(`Таблица добычи переименована: ${created.id}`);
        } else {
          await lootTablesService.update(selectedId, normalized);
          setStatus(`Таблица добычи обновлена: ${selectedId}`);
        }
      } else {
        await lootTablesService.create(normalized);
        setSelectedId(id);
        setStatus(`Таблица добычи создана: ${id}`);
      }
      await refresh();
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function deleteSelected() {
    if (!selectedId) {
      return;
    }
    await lootTablesService.delete(selectedId);
    setSelectedId(null);
    setDraft(emptyLootTable());
    await refresh();
    setStatus(`Таблица добычи удалена: ${selectedId}`);
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <button onClick={exportJson}>Экспорт JSON</button>
          <button disabled={isImporting} onClick={() => importFileRef.current?.click()}>{isImporting ? 'Импорт...' : 'Импорт JSON'}</button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={handleImportFile} />
          <button onClick={() => { setSelectedId(null); setDraft(emptyLootTable()); }}>Новая таблица добычи</button>
        </div>
        <div className="admin-scroll-list">
          {tables.map((table) => (
            <button key={table.id} className={selectedId === table.id ? 'is-active' : ''} onClick={() => { setSelectedId(table.id); setDraft(table); }}>
              <strong>{table.name || table.id}</strong>
              <span>{translateLootSourceType(table.sourceType)}: {table.sourceId || 'не указан'} | {table.entries.length} записей</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Технический уникальный идентификатор таблицы добычи. На него могут ссылаться монстры, сундуки, регионы и события." />
            <AdminHelpTooltip section="lootTables" field="id" />
            <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Название" hint="Человеко-читаемое имя таблицы. Удобно для навигации внутри админки." />
            <AdminHelpTooltip section="lootTables" field="name" />
            <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Источник" hint="Откуда берётся добыча: монстр, сундук, квест, регион и т.д." />
            <select value={draft.sourceType} onChange={(event) => patch({ sourceType: event.target.value as LootTable['sourceType'] })}>
              {LOOT_SOURCE_TYPES.map((sourceType) => (
                <option key={sourceType} value={sourceType}>{translateLootSourceType(sourceType)}</option>
              ))}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="ID источника" hint="ID конкретного монстра, сундука, региона или другого объекта, которому принадлежит эта таблица." />
            <AdminHelpTooltip section="lootTables" field="description" />
            <input value={draft.sourceId ?? ''} onChange={(event) => patch({ sourceId: event.target.value })} />
          </label>
        </div>

        <h4 title="Записи внутри таблицы: какие предметы могут выпасть, с каким шансом и в каком количестве.">Записи в таблице</h4>
        <select onChange={(event) => { addEntry(event.target.value); event.currentTarget.selectedIndex = 0; }}>
          <option value="">Добавить предмет...</option>
          {items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
        </select>

        <div className="admin-scroll-list merchant-item-pick">
          {draft.entries.map((entry) => {
            const item = items.find((candidate) => candidate.id === entry.itemId);
            const itemName = item?.name ?? entry.itemId;
            return (
              <div key={entry.itemId} className="merchant-item-row is-active">
                <button onClick={() => removeEntry(entry.itemId)}>Убрать</button>
                <div>
                  <strong>{itemName}</strong>
                  <span>{entry.itemId}{item ? ` | ${translateItemType(item.type)}` : ''}</span>
                </div>
                <label>
                  <AdminFieldLabel label="Шанс" hint="Вероятность выпадения предмета от 0 до 1. Например 0.25 = 25%." />
                  <input type="number" step="0.01" min={0} max={1} value={entry.chance} onChange={(event) => patchEntry(entry.itemId, { chance: Number(event.target.value) || 0 })} />
                </label>
                <label>
                  <AdminFieldLabel label="Мин. кол-во" hint="Минимальное количество предметов, которое выпадет при успешном ролле." />
                  <input type="number" min={1} value={entry.minQuantity} onChange={(event) => patchEntry(entry.itemId, { minQuantity: Number(event.target.value) || 1 })} />
                </label>
                <label>
                  <AdminFieldLabel label="Макс. кол-во" hint="Максимальное количество предметов, которое может выпасть. Не должно быть меньше минимального." />
                  <input type="number" min={1} value={entry.maxQuantity} onChange={(event) => patchEntry(entry.itemId, { maxQuantity: Number(event.target.value) || 1 })} />
                </label>
                <label className="zone-editor-checkbox">
                  <input type="checkbox" checked={entry.isEnabled} onChange={(event) => patchEntry(entry.itemId, { isEnabled: event.target.checked })} />
                  <AdminFieldLabel label="Включено" hint="Если выключить, запись останется в таблице, но перестанет участвовать в выпадении." />
                </label>
              </div>
            );
          })}
        </div>

        <div className="admin-actions-row">
          <button onClick={() => { void createOrUpdate(); }}>{selectedId ? 'Сохранить' : 'Создать'}</button>
          <button disabled={!selectedId} onClick={() => { void deleteSelected(); }}>Удалить</button>
        </div>

        <section className="card admin-item-preview">
          <h4>Ожидаемая добыча (среднее за один запуск)</h4>
          {expectedDrops.length === 0 ? <p className="muted">Записей пока нет.</p> : null}
          {expectedDrops.slice(0, 12).map((row) => (
            <p key={row.itemName}>{row.itemName}: {row.expectation.toFixed(2)}</p>
          ))}
        </section>

        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
