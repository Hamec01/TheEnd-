import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { AdminItem, ItemSet, ItemSetBonus, ItemType, ItemRarity, ItemSlot, StoredImage } from '../../services/content/models';
import { itemsService } from '../../services/content/itemsService';
import { itemSetsService, validateItemSet } from '../../services/content/itemSetsService';
import { subscribeToContentSync } from '../../services/content/contentSync';
import { loadRuntimeImages, resolveStoredImageSource } from '../../services/content/runtimeImageService';
import { uid } from '../../services/content/storage';
import { AdminImageField } from '../AdminImageField';
import { ItemEffectEditor } from '../components/ItemEffectEditor';
import type { ItemEffectJson } from '../itemEffectConstants';
import { downloadCollectionJson, extractRawCollectionFromImportJson } from '../../services/content/adminJsonImportExport';
import { AdminFieldLabel, translateAdminErrorMessage, translateItemType, translateRarity, translateItemSlot } from '../adminUi';
import { getIdQualityWarning, runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';
import { AdminSaveStatus } from '../AdminSaveStatus';

const ITEM_TYPES: ItemType[] = ['weapon', 'armor', 'potion', 'material', 'quest', 'misc'];
const RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'forbidden'];
const SLOTS: ItemSlot[] = ['head', 'necklace', 'chest', 'outerwear', 'belt', 'leftHand', 'rightHand', 'gloves', 'legs', 'boots', 'ring', 'trinket', 'charm', 'quick', 'none'];

function emptySet(): ItemSet {
  const now = new Date().toISOString();
  return {
    id: '',
    name: '',
    pieceItemIds: [],
    bonuses: [],
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function emptyBonusTier(): ItemSetBonus {
  return { requiredPieces: 2, effects: [], description: '' };
}

function toPrettyJson(value: unknown, emptyFallback: string): string {
  if (value === undefined || value === null) {
    return emptyFallback;
  }
  return JSON.stringify(value, null, 2);
}

export interface ItemSetsPageProps {
  onNavigate?: (path: string) => void;
}

export function ItemSetsPage({ onNavigate }: ItemSetsPageProps) {
  const [sets, setSets] = useState<ItemSet[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemSet>(emptySet());
  const [prevPieceIds, setPrevPieceIds] = useState<string[]>([]);
  const [status, setStatus] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const selectedIdRef = useRef<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [itemQuery, setItemQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | ItemRarity>('all');
  const [slotFilter, setSlotFilter] = useState<'all' | ItemSlot>('all');

  const [fullJsonText, setFullJsonText] = useState('{}');
  const [bonusesJsonText, setBonusesJsonText] = useState('[]');
  const [pieceIdsJsonText, setPieceIdsJsonText] = useState('[]');

  function syncJsonEditorsFromDraft(next: ItemSet) {
    setFullJsonText(toPrettyJson(next, '{}'));
    setBonusesJsonText(toPrettyJson(next.bonuses, '[]'));
    setPieceIdsJsonText(toPrettyJson(next.pieceItemIds, '[]'));
  }

  async function refresh() {
    const activeSelectedId = selectedIdRef.current;
    const [allSets, allItems, images] = await Promise.all([
      itemSetsService.getAll(),
      itemsService.getAll(),
      loadRuntimeImages(),
    ]);
    setSets(allSets);
    setItems(allItems);
    setRuntimeImages(images);
    if (activeSelectedId && !allSets.some((s) => s.id === activeSelectedId)) {
      setSelectedId(null);
      const n = emptySet();
      setDraft(n);
      setPrevPieceIds([]);
      syncJsonEditorsFromDraft(n);
      return;
    }

    if (activeSelectedId) {
      const selectedSet = allSets.find((entry) => entry.id === activeSelectedId);
      if (selectedSet) {
        setDraft(selectedSet);
        setPrevPieceIds([...(selectedSet.pieceItemIds ?? [])]);
        syncJsonEditorsFromDraft(selectedSet);
      }
    }
  }

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    void refresh();

    const unsubscribe = subscribeToContentSync((payload) => {
      if (payload.scope === 'content' || payload.scope === 'all') {
        void refresh();
      }
    });

    return unsubscribe;
  }, []);

  const visibleSets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sets.filter((s) => !q || s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [sets, query]);

  const existingItemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const existingPieceIds = useMemo(
    () => draft.pieceItemIds.filter((pieceItemId) => existingItemIds.has(pieceItemId)),
    [draft.pieceItemIds, existingItemIds],
  );

  const missingPieceIds = useMemo(
    () => draft.pieceItemIds.filter((pieceItemId) => pieceItemId && !existingItemIds.has(pieceItemId)),
    [draft.pieceItemIds, existingItemIds],
  );

  const selectedPieceSet = useMemo(() => new Set(existingPieceIds), [existingPieceIds]);

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (q && !item.id.toLowerCase().includes(q) && !item.name.toLowerCase().includes(q)) {
        return false;
      }
      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }
      if (rarityFilter !== 'all' && item.rarity !== rarityFilter) {
        return false;
      }
      if (slotFilter !== 'all' && (item.slot ?? 'none') !== slotFilter) {
        return false;
      }
      return true;
    });
  }, [items, itemQuery, rarityFilter, slotFilter, typeFilter]);

  function resolveItemThumb(item: AdminItem): string | undefined {
    const p = item.imagePath?.trim();
    if (!p) {
      return undefined;
    }
    return resolveStoredImageSource(p, runtimeImages);
  }

  function selectSet(entry: ItemSet) {
    setSelectedId(entry.id);
    setDraft(entry);
    setPrevPieceIds([...(entry.pieceItemIds ?? [])]);
    syncJsonEditorsFromDraft(entry);
  }

  function patchDraft(patch: Partial<ItemSet>) {
    setDraft((c) => {
      const n = { ...c, ...patch };
      syncJsonEditorsFromDraft(n);
      return n;
    });
  }

  function togglePiece(itemId: string) {
    const cur = new Set(draft.pieceItemIds);
    if (cur.has(itemId)) {
      cur.delete(itemId);
    } else {
      cur.add(itemId);
    }
    patchDraft({ pieceItemIds: [...cur] });
  }

  function conflictForItem(itemId: string): string | null {
    const item = items.find((i) => i.id === itemId);
    if (!item?.setId || item.setId === draft.id) {
      return null;
    }
    return `Этот предмет уже входит в другой сет: ${item.setId}`;
  }

  async function syncItemsAfterSave(setId: string, before: string[], after: string[]) {
    const beforeSet = new Set(before);
    const afterSet = new Set(after);
    for (const id of beforeSet) {
      if (!afterSet.has(id)) {
        const item = await itemsService.getById(id);
        if (item?.setId === setId) {
          await itemsService.update(id, { setId: undefined });
        }
      }
    }
    for (const id of afterSet) {
      await itemsService.update(id, { setId });
    }
  }

  async function createOrUpdate(nextDraft: ItemSet = draft) {
    if (isSaving) {
      return;
    }
    const id = nextDraft.id.trim() || uid('item_set');
    const normalized: ItemSet = {
      ...nextDraft,
      id,
      pieceItemIds: [...new Set(nextDraft.pieceItemIds.filter(Boolean))],
      bonuses: (nextDraft.bonuses ?? []).map((b) => ({
        ...b,
        effects: b.effects ?? [],
        penaltyEffects: b.penaltyEffects && b.penaltyEffects.length > 0 ? b.penaltyEffects : undefined,
      })),
      updatedAt: new Date().toISOString(),
    };

    const errors = validateItemSet(normalized);
    if (errors.length > 0) {
      setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
      return;
    }

    setIsSaving(true);
    const pieceBefore = selectedId ? prevPieceIds : [];
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: id,
      onSave: async () => {
        if (selectedId) {
          const updated = await itemSetsService.update(selectedId, normalized);
          await syncItemsAfterSave(updated.id, pieceBefore, updated.pieceItemIds);
          return updated;
        }
        const created = await itemSetsService.create(normalized);
        await syncItemsAfterSave(created.id, [], created.pieceItemIds);
        return created;
      },
      onAfterSave: async (entry) => {
        const verified = await itemSetsService.getById(entry.id);
        if (!verified) {
          throw new Error('Сохранение не подтверждено.');
        }
      },
      successLabel: (entry) => `Сохранено: ${entry.id}`,
    });

    if (!saved) {
      setIsSaving(false);
      return;
    }

    setSelectedId(saved.id);
    setDraft(saved);
    setPrevPieceIds([...(saved.pieceItemIds ?? [])]);
    syncJsonEditorsFromDraft(saved);
    await refresh();

    const w = getIdQualityWarning(saved.id);
    if (w) {
      setStatus(`Предупреждение: ${w}`);
      setSaveState({ state: 'warning', message: w });
    } else {
      setStatus(selectedId ? `Сет обновлён: ${saved.id}` : `Сет создан: ${saved.id}`);
    }
    setIsSaving(false);
  }

  async function cleanupMissingPieces() {
    if (missingPieceIds.length === 0) {
      return;
    }

    const cleanedDraft: ItemSet = {
      ...draft,
      pieceItemIds: existingPieceIds,
      updatedAt: new Date().toISOString(),
    };

    if (!selectedId) {
      setDraft(cleanedDraft);
      setStatus('Отсутствующие предметы удалены из списка частей. Сохрани сет, чтобы зафиксировать изменения.');
      return;
    }

    setDraft(cleanedDraft);
    syncJsonEditorsFromDraft(cleanedDraft);
    await createOrUpdate(cleanedDraft);
  }

  useAdminSaveShortcut({ enabled: true, isSaving, onSave: () => { void createOrUpdate(); } });

  async function duplicateSelected() {
    if (!selectedId) {
      return;
    }
    const copy: ItemSet = {
      ...draft,
      id: `${draft.id || 'set'}_copy_${Math.floor(Math.random() * 10000)}`,
      name: `${draft.name} Копия`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await itemSetsService.create(copy);
      setStatus(`Копия сета: ${copy.id}`);
      await refresh();
    } catch (e) {
      setStatus(translateAdminErrorMessage((e as Error).message));
    }
  }

  async function disableSelected() {
    if (!selectedId) {
      return;
    }
    await itemSetsService.disable(selectedId);
    await refresh();
    setStatus(`Сет отключён: ${selectedId}`);
  }

  async function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm('Удалить сет? Предметы останутся, но setId у частей этого сета можно очистить вручную.')) {
      return;
    }
    for (const pid of draft.pieceItemIds) {
      const item = await itemsService.getById(pid);
      if (item?.setId === selectedId) {
        await itemsService.update(pid, { setId: undefined });
      }
    }
    await itemSetsService.delete(selectedId);
    setSelectedId(null);
    const n = emptySet();
    setDraft(n);
    setPrevPieceIds([]);
    syncJsonEditorsFromDraft(n);
    await refresh();
    setStatus(`Сет удалён: ${selectedId}`);
  }

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_item_sets',
      collectionKey: 'itemSets',
      entries: sets,
    });
    setStatus(`Экспорт сетов: ${sets.length}`);
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
      const entries = extractRawCollectionFromImportJson(payload, 'itemSets');
      const existingIds = new Set((await itemSetsService.getAll()).map((entry) => entry.id));
      let created = 0;
      let updated = 0;

      for (const raw of entries) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          continue;
        }
        const record = raw as ItemSet;
        const id = String(record.id ?? '').trim();
        if (!id) {
          continue;
        }
        if (existingIds.has(id)) {
          await itemSetsService.update(id, record);
          updated += 1;
        } else {
          await itemSetsService.create({ ...record, id });
          existingIds.add(id);
          created += 1;
        }
      }

      await refresh();
      setStatus(`Импорт сетов завершен: создано ${created}, обновлено ${updated}.`);
      setSaveState({ state: 'saved', message: `Импорт set: +${created} / ~${updated}` });
    } catch (error) {
      const message = translateAdminErrorMessage((error as Error).message);
      setStatus(message);
      setSaveState({ state: 'error', message });
    } finally {
      setIsImporting(false);
    }
  }

  function addBonusTier() {
    patchDraft({ bonuses: [...(draft.bonuses ?? []), emptyBonusTier()] });
  }

  function removeBonusTier(index: number) {
    patchDraft({ bonuses: (draft.bonuses ?? []).filter((_, i) => i !== index) });
  }

  function patchBonus(index: number, patch: Partial<ItemSetBonus>) {
    const next = (draft.bonuses ?? []).map((b, i) => (i === index ? { ...b, ...patch } : b));
    patchDraft({ bonuses: next });
  }

  const pieceCount = existingPieceIds.length;
  const previewLines = (draft.bonuses ?? []).map((b) => {
    const req = b.requiredPieces;
    const label = req >= pieceCount && pieceCount > 0 ? `${req}/${pieceCount} (полный)` : `${req}/${pieceCount || '—'} частей`;
    return { label, desc: b.description };
  });

  return (
    <div className="admin-page-grid admin-items-page">
      <section className="admin-form-panel">
        <p className="muted">
          Сет активируется автоматически, когда нужное количество частей экипировано. Бонусы применяются к носителю: игроку, NPC или монстру.
          Не дублируй на предмете то, что задумано как бонус сета.
        </p>
        {onNavigate ? (
          <div className="admin-actions-row">
            <button type="button" onClick={() => onNavigate('/admin/items')}>← К предметам</button>
          </div>
        ) : null}

        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Уникальный id сета." />
            <input value={draft.id} onChange={(e) => patchDraft({ id: e.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Название" hint="Имя сета для игрока." />
            <input value={draft.name} onChange={(e) => patchDraft({ name: e.target.value })} />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(e) => patchDraft({ isEnabled: e.target.checked })} />
            <AdminFieldLabel label="Включён" hint="Отключённые сеты не дают бонусов." />
          </label>
          <label>
            <AdminFieldLabel label="Создан / обновлён" hint="Только чтение." />
            <input readOnly value={`${draft.createdAt} → ${draft.updatedAt}`} />
          </label>
        </div>

        <AdminImageField
          value={draft.imagePath}
          onChange={(v) => patchDraft({ imagePath: v })}
          onStatus={setStatus}
          presetId="set-icon"
          suggestedName={`${draft.id || draft.name || 'set'}-icon`}
          label="Иконка сета"
          hint="Та же схема imagePath, что у предметов."
        />

        <label>
          <AdminFieldLabel label="Игровое описание" hint="Кратко, что даёт сет." />
          <textarea rows={2} value={draft.gameplayDescription ?? ''} onChange={(e) => patchDraft({ gameplayDescription: e.target.value || undefined })} />
        </label>
        <label>
          <AdminFieldLabel label="Лор" hint="Опционально." />
          <textarea rows={2} value={draft.loreDescription ?? ''} onChange={(e) => patchDraft({ loreDescription: e.target.value || undefined })} />
        </label>

        <section className="card">
          <h4>Превью порогов</h4>
          <p className="muted">Выбрано частей в сете: {pieceCount}. Экипированные части считает рантайм.</p>
          {missingPieceIds.length > 0 ? (
            <div className="card">
              <h5>Отсутствующие предметы</h5>
              <p className="muted">В set записаны id, которых больше нет в items.</p>
              <ul>
                {missingPieceIds.map((pieceItemId) => <li key={pieceItemId}>Предмет отсутствует: {pieceItemId}</li>)}
              </ul>
              <button type="button" disabled={isSaving} onClick={() => { void cleanupMissingPieces(); }}>
                Очистить отсутствующие предметы
              </button>
            </div>
          ) : null}
          <ul>
            {previewLines.map((line, i) => (
              <li key={i}><strong>{line.label}</strong>{line.desc ? ` — ${line.desc}` : ''}</li>
            ))}
          </ul>
          {pieceCount === 0 ? <p className="muted">Добавь предметы в сет.</p> : null}
          {(draft.bonuses ?? []).some((b) => b.requiredPieces > pieceCount && pieceCount > 0) ? (
            <p className="muted">Внимание: есть порог с большим числом частей, чем выбрано в сете.</p>
          ) : null}
        </section>

        <section className="card">
          <h4>Бонусы по числу частей</h4>
          <div className="admin-actions-row">
            <button type="button" onClick={addBonusTier}>Добавить бонус</button>
          </div>
          {(draft.bonuses ?? []).map((bonus, index) => (
            <div key={index} className="card admin-form-grid">
              <label>
                <span>Нужно частей</span>
                <input
                  type="number"
                  min={1}
                  value={bonus.requiredPieces}
                  onChange={(e) => patchBonus(index, { requiredPieces: Math.max(1, Number(e.target.value) || 1) })}
                />
              </label>
              <label>
                <span>Описание</span>
                <input value={bonus.description ?? ''} onChange={(e) => patchBonus(index, { description: e.target.value || undefined })} />
              </label>
              <h5>Положительные эффекты</h5>
              <ItemEffectEditor
                effects={(bonus.effects ?? []) as ItemEffectJson[]}
                onChange={(next) => patchBonus(index, { effects: next as ItemSetBonus['effects'] })}
              />
              <h5>Штрафы / отрицательные эффекты</h5>
              <ItemEffectEditor
                effects={(bonus.penaltyEffects ?? []) as ItemEffectJson[]}
                onChange={(next) => patchBonus(index, { penaltyEffects: next.length > 0 ? (next as ItemSetBonus['effects']) : undefined })}
                addLabel="Добавить штраф"
              />
              <button type="button" onClick={() => removeBonusTier(index)}>Удалить уровень</button>
            </div>
          ))}
        </section>

        <section className="card">
          <h4>Raw JSON</h4>
          <p className="muted">Полный объект сета</p>
          <textarea
            rows={8}
            value={fullJsonText}
            onChange={(e) => {
              const raw = e.target.value;
              setFullJsonText(raw);
              try {
                const parsed = JSON.parse(raw) as ItemSet;
                if (parsed && typeof parsed === 'object') {
                  setDraft((c) => ({ ...c, ...parsed, id: parsed.id ?? c.id }));
                }
              } catch {
                /* ignore */
              }
            }}
          />
          <p className="muted">Только bonuses</p>
          <textarea
            rows={6}
            value={bonusesJsonText}
            onChange={(e) => {
              const raw = e.target.value;
              setBonusesJsonText(raw);
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  patchDraft({ bonuses: parsed as ItemSetBonus[] });
                }
              } catch {
                /* ignore */
              }
            }}
          />
          <p className="muted">Только pieceItemIds</p>
          <textarea
            rows={4}
            value={pieceIdsJsonText}
            onChange={(e) => {
              const raw = e.target.value;
              setPieceIdsJsonText(raw);
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  patchDraft({ pieceItemIds: Array.from(new Set(parsed.map(String).map((value) => value.trim()).filter(Boolean))) });
                }
              } catch {
                /* ignore */
              }
            }}
          />
        </section>

        <div className="admin-actions-row">
          <button type="button" disabled={isSaving} onClick={() => { void createOrUpdate(); }}>{isSaving ? 'Сохранение…' : 'Сохранить сет'}</button>
          <button type="button" disabled={!selectedId} onClick={() => { void duplicateSelected(); }}>Дублировать</button>
          <button type="button" disabled={!selectedId} onClick={() => { void disableSelected(); }}>Отключить</button>
          <button type="button" disabled={!selectedId} onClick={() => { void deleteSelected(); }}>Удалить</button>
          <button type="button" onClick={exportJson}>Экспорт JSON</button>
          <button type="button" disabled={isImporting || isSaving} onClick={() => importFileRef.current?.click()}>{isImporting ? 'Импорт...' : 'Импорт JSON'}</button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={handleImportFile} />
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              const n = emptySet();
              setDraft(n);
              setPrevPieceIds([]);
              syncJsonEditorsFromDraft(n);
            }}
          >
            Новый сет
          </button>
        </div>
        <AdminSaveStatus value={saveState} />
        <p className="muted">{status}</p>
      </section>

      <section className="admin-items-catalog card">
        <h3>Сеты</h3>
        <input placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="admin-items-icons-grid">
          {visibleSets.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`admin-item-icon-card ${selectedId === s.id ? 'is-active' : ''}`}
              onClick={() => selectSet(s)}
            >
              <div className="admin-catalog-thumb admin-catalog-thumb-lg is-olive">
                {(s.name || s.id).charAt(0).toUpperCase()}
              </div>
              <strong>{s.name || '(без имени)'}</strong>
              <span>{s.id}</span>
              <span className="muted">{s.pieceItemIds?.length ?? 0} ч. · {s.isEnabled ? 'вкл' : 'выкл'}</span>
            </button>
          ))}
        </div>

        <h4>Части сета (клик по карточке)</h4>
        <p className="muted">Выбрано: {selectedPieceSet.size}</p>
        <div className="admin-list-tools admin-catalog-toolbar">
          <input placeholder="Предметы: поиск" value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | ItemType)}>
            <option value="all">Все типы</option>
            {ITEM_TYPES.map((t) => <option key={t} value={t}>{translateItemType(t)}</option>)}
          </select>
          <select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value as 'all' | ItemRarity)}>
            <option value="all">Любая редкость</option>
            {RARITIES.map((r) => <option key={r} value={r}>{translateRarity(r)}</option>)}
          </select>
          <select value={slotFilter} onChange={(e) => setSlotFilter(e.target.value as 'all' | ItemSlot)}>
            <option value="all">Любой слот</option>
            {SLOTS.map((sl) => <option key={sl} value={sl}>{translateItemSlot(sl)}</option>)}
          </select>
        </div>
        <div className="admin-items-icons-grid">
          {filteredItems.map((item) => {
            const on = selectedPieceSet.has(item.id);
            const conflict = conflictForItem(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`admin-item-icon-card ${on ? 'is-active' : ''}`}
                onClick={() => togglePiece(item.id)}
                title={conflict ?? `${item.name} (${item.id})`}
              >
                <div className={`admin-catalog-thumb admin-catalog-thumb-lg ${on ? 'is-gold' : 'is-olive'}`}>
                  {resolveItemThumb(item) ? <img src={resolveItemThumb(item)} alt={item.name} /> : (item.name || item.type).charAt(0).toUpperCase()}
                </div>
                {on ? <span aria-hidden>✓</span> : null}
                <strong>{item.name}</strong>
                <span>{item.id}</span>
                {conflict ? <span className="muted">{conflict}</span> : null}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
