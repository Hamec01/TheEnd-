import { useEffect, useMemo, useState } from 'react';
import type { MineBlockEntry, MineBlockPayload, MineBlockTable, MineBlockType } from '../../types/mining';
import { downloadCollectionJson } from '../../services/content/adminJsonImportExport';
import { itemsService } from '../../services/content/itemsService';
import {
  loadMineBlockTablesFromStorage,
  loadMineHazardsFromStorage,
  loadMinesFromStorage,
  saveMineBlockTablesToStorage,
} from '../../services/miningRepository';
import { MINING_BLOCK_PAYLOAD_TYPES, MINING_BLOCK_TYPES } from '../../services/miningSkillValidation';
import { AdminFieldLabel } from '../adminUi';
import { fixMojibake } from '../../utils/fixMojibake';

const BLOCK_TYPES: MineBlockType[] = MINING_BLOCK_TYPES;

interface MineBlockTableEditorProps {
  onSave?: (tables: MineBlockTable[]) => void;
}

function emptyEntry(): MineBlockEntry {
  return {
    type: 'stone',
    weight: 10,
    lootTableId: '',
    hazardTableId: '',
    label: '',
    description: '',
    payloads: [],
  };
}

function emptyPayload(): MineBlockPayload {
  return {
    type: 'loot_item',
    weight: 10,
    minQuantity: 1,
    maxQuantity: 1,
  };
}

function emptyTable(defaultMineId = ''): MineBlockTable {
  const table: MineBlockTable = {
    id: '',
    name: '',
    mineId: defaultMineId || undefined,
    depthLevel: 1,
    entries: [
      { type: 'empty', weight: 18, label: 'Пустота' },
      { type: 'stone', weight: 26, lootTableId: '', label: 'Камень' },
      { type: 'ore', weight: 24, lootTableId: '', label: 'Руда' },
      { type: 'hazard', weight: 10, hazardTableId: '', label: 'Опасность' },
      { type: 'passage', weight: 4, label: 'Проход' },
    ],
  };
  return {
    ...table,
    entries: table.entries.map((entry) => ({
      ...entry,
      label: fixMojibake(entry.label),
      description: fixMojibake(entry.description),
    })),
  };
}

export function MineBlockTableEditor({ onSave }: MineBlockTableEditorProps) {
  const mines = useMemo(() => loadMinesFromStorage(), []);
  const [tables, setTables] = useState<MineBlockTable[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMineId, setSelectedMineId] = useState('');
  const [draft, setDraft] = useState<MineBlockTable>(emptyTable());
  const [status, setStatus] = useState('Готово');
  const [knownItemIds, setKnownItemIds] = useState<string[]>([]);
  const [knownHazardIds, setKnownHazardIds] = useState<string[]>([]);

  useEffect(() => {
    const loaded = loadMineBlockTablesFromStorage();
    setTables(loaded);
    setSelectedMineId(loaded[0]?.mineId ?? mines[0]?.id ?? '');
    if (loaded.length > 0) {
      setSelectedId(loaded[0]!.id);
      setDraft(loaded[0]!);
    } else {
      setDraft(emptyTable(mines[0]?.id ?? ''));
    }
    void itemsService.getAll()
      .then((items) => {
        const filtered = items
          .filter((item) => {
            const type = String(item.type ?? '').toLowerCase();
            const subtype = String(item.subtype ?? '').toLowerCase();
            const id = String(item.id ?? '').toLowerCase();
            return type === 'material'
              || subtype.includes('mining')
              || subtype.includes('ore')
              || subtype.includes('stone')
              || subtype.includes('crystal')
              || subtype.includes('gem')
              || subtype.includes('rune')
              || id.includes('ore')
              || id.includes('stone')
              || id.includes('crystal')
              || id.includes('gem')
              || id.includes('rune');
          })
          .map((item) => String(item.id ?? '').trim())
          .filter(Boolean);
        setKnownItemIds(Array.from(new Set(filtered)).sort((a, b) => a.localeCompare(b, 'ru')));
      })
      .catch(() => setKnownItemIds([]));
    const hazards = loadMineHazardsFromStorage().map((entry) => entry.id).filter(Boolean);
    setKnownHazardIds(hazards);
  }, [mines]);

  const draftWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (const entry of draft.entries) {
      const payloads = entry.payloads ?? [];
      const hasLootPayload = payloads.some((payload) => payload.type === 'loot_item' || payload.type === 'loot_material' || payload.type === 'rune_trace' || payload.type === 'gold');
      const hasOreMaterialPayload = payloads.some((payload) => {
        if (payload.type !== 'loot_item' && payload.type !== 'loot_material') {
          return false;
        }
        const id = String(payload.itemId ?? payload.materialId ?? '').toLowerCase();
        return id.includes('ore') || id.includes('material');
      });
      const hasHazardPayload = payloads.some((payload) => payload.type === 'hazard_ref');
      if (entry.type === 'stone' && !hasLootPayload) {
        warnings.push('stone без loot payload.');
      }
      if (entry.type === 'ore' && !hasOreMaterialPayload) {
        warnings.push('ore без ore/material payload.');
      }
      if ((entry.type === 'crystal' || entry.type === 'gem') && !hasLootPayload) {
        warnings.push(`${entry.type} без loot payload.`);
      }
      if (entry.type === 'hazard' && !hasHazardPayload) {
        warnings.push('hazard без hazard_ref payload.');
      }
      if (entry.type === 'passage') {
        const invalid = payloads.some((payload) => payload.type === 'hazard_ref' || payload.type === 'loot_item' || payload.type === 'loot_material');
        if (invalid) {
          warnings.push('passage содержит нерелевантный loot/hazard payload.');
        }
      }
      if (entry.type === 'exit') {
        warnings.push('В таблице используется устаревший block type exit.');
      }
    }
    return warnings;
  }, [draft.entries]);

  const filtered = useMemo(
    () => tables.filter((entry) => !selectedMineId || entry.mineId === selectedMineId),
    [selectedMineId, tables],
  );

  function persist(next: MineBlockTable[], nextStatus: string) {
    setTables(next);
    saveMineBlockTablesToStorage(next);
    onSave?.(next);
    setStatus(nextStatus);
  }

  function startNew() {
    setSelectedId(null);
    setDraft(emptyTable(selectedMineId || mines[0]?.id || ''));
  }

  function selectTable(id: string) {
    const found = tables.find((entry) => entry.id === id);
    if (!found) {
      return;
    }
    setSelectedId(id);
    setDraft(found);
  }

  function patchEntry(index: number, patch: Partial<MineBlockEntry>) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)),
    }));
  }

  function patchPayload(entryIndex: number, payloadIndex: number, patch: Partial<MineBlockPayload>) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, index) => {
        if (index !== entryIndex) {
          return entry;
        }
        const payloads = [...(entry.payloads ?? [])];
        payloads[payloadIndex] = { ...payloads[payloadIndex], ...patch };
        return { ...entry, payloads };
      }),
    }));
  }

  function addPayload(entryIndex: number) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, index) => {
        if (index !== entryIndex) {
          return entry;
        }
        return { ...entry, payloads: [...(entry.payloads ?? []), emptyPayload()] };
      }),
    }));
  }

  function removePayload(entryIndex: number, payloadIndex: number) {
    setDraft((current) => ({
      ...current,
      entries: current.entries.map((entry, index) => {
        if (index !== entryIndex) {
          return entry;
        }
        return { ...entry, payloads: (entry.payloads ?? []).filter((_, index2) => index2 !== payloadIndex) };
      }),
    }));
  }

  function addEntry() {
    setDraft((current) => ({ ...current, entries: [...current.entries, emptyEntry()] }));
  }

  function removeEntry(index: number) {
    setDraft((current) => ({ ...current, entries: current.entries.filter((_, entryIndex) => entryIndex !== index) }));
  }

  function saveDraft() {
    const normalized: MineBlockTable = {
      ...draft,
      id: draft.id.trim(),
      name: draft.name.trim(),
      mineId: draft.mineId?.trim() || undefined,
      depthLevel: draft.depthLevel ? Math.max(1, Math.floor(Number(draft.depthLevel))) : undefined,
      entries: draft.entries
        .map((entry) => ({
          ...entry,
          weight: Math.max(1, Math.floor(Number(entry.weight || 1))),
          lootTableId: entry.lootTableId?.trim() || undefined,
          hazardTableId: entry.hazardTableId?.trim() || undefined,
          label: entry.label?.trim() || undefined,
          description: entry.description?.trim() || undefined,
          payloads: (entry.payloads ?? [])
            .map((payload) => ({
              ...payload,
              weight: Math.max(1, Math.floor(Number(payload.weight || 1))),
              itemId: String(payload.itemId ?? '').trim() || undefined,
              materialId: String(payload.materialId ?? '').trim() || undefined,
              hazardId: String(payload.hazardId ?? '').trim() || undefined,
              eventId: String(payload.eventId ?? '').trim() || undefined,
              goldMin: payload.goldMin === undefined ? undefined : Math.max(0, Math.floor(Number(payload.goldMin))),
              goldMax: payload.goldMax === undefined ? undefined : Math.max(0, Math.floor(Number(payload.goldMax))),
              minQuantity: payload.minQuantity === undefined ? undefined : Math.max(1, Math.floor(Number(payload.minQuantity))),
              maxQuantity: payload.maxQuantity === undefined ? undefined : Math.max(1, Math.floor(Number(payload.maxQuantity))),
              minDepth: payload.minDepth === undefined ? undefined : Math.max(1, Math.floor(Number(payload.minDepth))),
              maxDepth: payload.maxDepth === undefined ? undefined : Math.max(1, Math.floor(Number(payload.maxDepth))),
              rarity: String(payload.rarity ?? '').trim() || undefined,
              tags: (payload.tags ?? []).map((tag) => String(tag).trim()).filter(Boolean),
            }))
            .filter((payload) => Boolean(payload.type)),
        }))
        .filter((entry) => Boolean(entry.type)),
    };

    if (!normalized.id || !normalized.name || normalized.entries.length === 0) {
      setStatus('Заполните id, название и хотя бы одну запись.');
      return;
    }

    for (const entry of normalized.entries) {
      for (const payload of entry.payloads ?? []) {
        if ((payload.type === 'loot_item' || payload.type === 'loot_material') && !payload.itemId && !payload.materialId) {
          setStatus(`Payload ${payload.type} требует itemId/materialId (entry type: ${entry.type}).`);
          return;
        }
        if (payload.type === 'hazard_ref' && !payload.hazardId) {
          setStatus(`Payload hazard_ref требует hazardId (entry type: ${entry.type}).`);
          return;
        }
      }
    }

    if (selectedId) {
      if (selectedId !== normalized.id && tables.some((entry) => entry.id === normalized.id)) {
        setStatus(`Таблица блоков с id ${normalized.id} уже существует.`);
        return;
      }
      const next = tables.filter((entry) => entry.id !== selectedId).concat([normalized]);
      setSelectedId(normalized.id);
      persist(next, `Таблица блоков сохранена: ${normalized.name}`);
      return;
    }
    if (tables.some((entry) => entry.id === normalized.id)) {
      setStatus(`Таблица блоков с id ${normalized.id} уже существует.`);
      return;
    }
    const next = [...tables, normalized];
    setSelectedId(normalized.id);
    persist(next, `Таблица блоков создана: ${normalized.name}`);
  }

  function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm(`Удалить таблицу блоков ${selectedId}?`)) {
      return;
    }
    const next = tables.filter((entry) => entry.id !== selectedId);
    persist(next, `Таблица блоков удалена: ${selectedId}`);
    startNew();
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <button onClick={startNew}>Новая таблица</button>
          <button onClick={() => {
            downloadCollectionJson({ filePrefix: 'theend_mine_blocks', collectionKey: 'mineBlockTables', entries: tables });
            setStatus(`Экспортировано таблиц блоков: ${tables.length}`);
          }}
          >
            Экспорт JSON
          </button>
        </div>
        <label>
          <AdminFieldLabel label="Шахта" />
          <select value={selectedMineId} onChange={(event) => setSelectedMineId(event.target.value)}>
            <option value="">Все шахты</option>
            {mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.name}</option>)}
          </select>
        </label>
        <div className="admin-scroll-list">
          {filtered.map((table) => (
            <button key={table.id} className={selectedId === table.id ? 'is-active' : ''} onClick={() => selectTable(table.id)}>
              <strong>{table.name}</strong>
              <span>{table.id} | depth {table.depthLevel ?? '-'} | entries {table.entries.length}</span>
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
          <label>
            <AdminFieldLabel label="Шахта" />
            <select value={draft.mineId ?? ''} onChange={(event) => setDraft((current) => ({ ...current, mineId: event.target.value || undefined }))}>
              <option value="">Без привязки</option>
              {mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.name}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Глубина" />
            <input type="number" min={1} value={draft.depthLevel ?? 1} onChange={(event) => setDraft((current) => ({ ...current, depthLevel: Number(event.target.value) || 1 }))} />
          </label>
        </div>

        <h4>Записи таблицы</h4>
        <div className="admin-scroll-list merchant-item-pick mine-block-entry-list">
          {draft.entries.map((entry, index) => (
            <div key={`${entry.type}-${index}`} className="merchant-item-row is-active mine-block-entry-row">
              <button onClick={() => removeEntry(index)}>Убрать</button>
              <label>
                <AdminFieldLabel label="Тип" />
                <select value={entry.type} onChange={(event) => patchEntry(index, { type: event.target.value as MineBlockType })}>
                  {BLOCK_TYPES.map((blockType) => <option key={blockType} value={blockType}>{blockType}</option>)}
                </select>
              </label>
              <label>
                <AdminFieldLabel label="Вес" />
                <input type="number" min={1} value={entry.weight} onChange={(event) => patchEntry(index, { weight: Number(event.target.value) || 1 })} />
              </label>
              <label>
                <AdminFieldLabel label="Loot table ID" />
                <input value={entry.lootTableId ?? ''} onChange={(event) => patchEntry(index, { lootTableId: event.target.value })} />
              </label>
              <label>
                <AdminFieldLabel label="Hazard table ID" />
                <input value={entry.hazardTableId ?? ''} onChange={(event) => patchEntry(index, { hazardTableId: event.target.value })} />
              </label>
              <label>
                <AdminFieldLabel label="Метка" />
                <input value={entry.label ?? ''} onChange={(event) => patchEntry(index, { label: event.target.value })} />
              </label>

              <div className="mine-block-payloads">
                <div className="admin-actions-row" style={{ justifyContent: 'space-between' }}>
                  <AdminFieldLabel label="Payload entries" hint="Лут/опасность/событие внутри блока." />
                  <button type="button" onClick={() => addPayload(index)}>+ Payload</button>
                </div>
                {(entry.payloads ?? []).map((payload, payloadIndex) => (
                  <div key={`${payload.type}-${payloadIndex}`} className="merchant-item-row" style={{ marginTop: 8 }}>
                    <button type="button" onClick={() => removePayload(index, payloadIndex)}>Убрать payload</button>
                    <label>
                      <AdminFieldLabel label="Type" />
                      <select
                        value={payload.type}
                        onChange={(event) => patchPayload(index, payloadIndex, { type: event.target.value as MineBlockPayload['type'] })}
                      >
                        {MINING_BLOCK_PAYLOAD_TYPES.map((payloadType) => (
                          <option key={payloadType} value={payloadType}>{payloadType}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <AdminFieldLabel label="Weight" />
                      <input type="number" min={1} value={payload.weight} onChange={(event) => patchPayload(index, payloadIndex, { weight: Number(event.target.value) || 1 })} />
                    </label>
                    <label>
                      <AdminFieldLabel label="itemId / materialId" />
                      <input
                        list="mine-block-item-ids"
                        value={payload.itemId ?? payload.materialId ?? ''}
                        onChange={(event) => patchPayload(index, payloadIndex, { itemId: event.target.value || undefined, materialId: event.target.value || undefined })}
                      />
                    </label>
                    <label>
                      <AdminFieldLabel label="hazardId / eventId" />
                      {payload.type === 'hazard_ref' ? (
                        <select
                          value={payload.hazardId ?? ''}
                          onChange={(event) => patchPayload(index, payloadIndex, { hazardId: event.target.value || undefined })}
                        >
                          <option value="">Выберите hazardId</option>
                          {knownHazardIds.map((hazardId) => <option key={hazardId} value={hazardId}>{hazardId}</option>)}
                        </select>
                      ) : (
                        <input
                          value={payload.hazardId ?? payload.eventId ?? ''}
                          onChange={(event) => patchPayload(index, payloadIndex, { hazardId: event.target.value || undefined, eventId: event.target.value || undefined })}
                        />
                      )}
                    </label>
                    <label>
                      <AdminFieldLabel label="Qty min/max" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <input type="number" min={1} value={payload.minQuantity ?? ''} onChange={(event) => patchPayload(index, payloadIndex, { minQuantity: event.target.value ? Number(event.target.value) : undefined })} />
                        <input type="number" min={1} value={payload.maxQuantity ?? ''} onChange={(event) => patchPayload(index, payloadIndex, { maxQuantity: event.target.value ? Number(event.target.value) : undefined })} />
                      </div>
                    </label>
                    {payload.type === 'gold' ? (
                      <label>
                        <AdminFieldLabel label="Gold min/max" />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <input type="number" min={0} value={payload.goldMin ?? ''} onChange={(event) => patchPayload(index, payloadIndex, { goldMin: event.target.value ? Number(event.target.value) : undefined })} />
                          <input type="number" min={0} value={payload.goldMax ?? ''} onChange={(event) => patchPayload(index, payloadIndex, { goldMax: event.target.value ? Number(event.target.value) : undefined })} />
                        </div>
                      </label>
                    ) : null}
                  </div>
                ))}
              </div>
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
        {draftWarnings.length > 0 ? (
          <div className="card" style={{ background: 'rgba(57, 30, 20, 0.72)', border: '1px solid rgba(215, 166, 114, 0.42)' }}>
            <strong>Предупреждения валидации</strong>
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {draftWarnings.map((warning, index) => <p key={`${warning}-${index}`} className="muted" style={{ margin: 0 }}>{warning}</p>)}
            </div>
          </div>
        ) : null}
        <p className="muted">{status}</p>
        <datalist id="mine-block-item-ids">
          {knownItemIds.map((itemId) => <option key={itemId} value={itemId} />)}
        </datalist>
      </section>
    </div>
  );
}
