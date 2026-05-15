import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AdminSaveStatus } from '../AdminSaveStatus';
import { AdminImageField } from '../AdminImageField';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';
import { getContentCollection, getContentEntry } from '../../services/content/contentApi';
import { imageService } from '../../services/content/imageService';
import { resolveStoredImageSource } from '../../services/content/runtimeImageService';
import { deleteQuestItem, ensureQuestsLoaded, getAllQuests, getQuestItems, renameQuestItem, saveQuestItem } from '../../services/questRepository';
import { downloadCollectionJson, extractRawCollectionFromImportJson } from '../../services/content/adminJsonImportExport';
import type { StoredImage } from '../../services/content/models';
import type { QuestItemDefinition } from '../../types/quest';
import { getIdQualityWarning, runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';

function emptyQuestItem(): QuestItemDefinition {
  return {
    id: '',
    name: '',
    description: '',
    iconUrl: '',
    imageUrl: '',
    linkedQuestId: '',
    canDrop: false,
    canSell: false,
    canTrade: false,
    removeOnQuestComplete: true,
    showInQuestInventory: true,
  };
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function QuestItemsPage() {
  const [items, setItems] = useState<QuestItemDefinition[]>([]);
  const [questIds, setQuestIds] = useState<string[]>([]);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestItemDefinition>(emptyQuestItem());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const importFileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    await ensureQuestsLoaded();
    const [nextItems, quests, nextImages] = await Promise.all([
      Promise.resolve(getQuestItems()),
      Promise.resolve(getAllQuests()),
      imageService.getAll(),
    ]);
    setItems(nextItems);
    setQuestIds(quests.map((quest) => quest.id));
    setImages(nextImages);

    if (selectedId && !nextItems.some((item) => item.id === selectedId)) {
      setSelectedId(null);
      setDraft(emptyQuestItem());
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => !q || item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q));
  }, [items, query]);

  function patch(next: Partial<QuestItemDefinition>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function select(item: QuestItemDefinition) {
    setSelectedId(item.id);
    setDraft(item);
  }

  function createNew() {
    setSelectedId(null);
    setDraft(emptyQuestItem());
  }

  async function saveCurrent() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: draft.id || 'quest_item',
      onSave: async () => {
        const prepared: QuestItemDefinition = {
          ...draft,
          id: draft.id.trim() || uid('quest_item'),
          name: draft.name.trim(),
        };

        if (selectedId && prepared.id !== selectedId) {
          return renameQuestItem(selectedId, prepared);
        }

        return saveQuestItem(prepared);
      },
      onAfterSave: async (entry) => {
        const verified = await getContentEntry<QuestItemDefinition>('questItems', entry.id);
        if (!verified) {
          throw new Error('Сохранение не подтверждено: запись не найдена после сохранения.');
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
    await refresh();

    const warning = getIdQualityWarning(saved.id);
    if (warning) {
      setStatus(`Предупреждение: ${warning}`);
      setSaveState({ state: 'warning', message: warning });
    } else {
      setStatus(`Квестовый предмет сохранен: ${saved.id}`);
    }
    setIsSaving(false);
  }

  async function debugPersistence() {
    const selected = draft.id.trim();
    const [cached, persisted] = await Promise.all([
      Promise.resolve(getQuestItems()),
      getContentCollection<QuestItemDefinition>('questItems').catch(() => []),
    ]);

    const cachedExists = selected ? cached.some((entry) => entry.id.trim() === selected) : false;
    const persistedExists = selected ? persisted.some((entry) => entry.id.trim() === selected) : false;

    setDebugInfo([
      `collection: questItems`,
      `count(cache): ${cached.length}`,
      `count(persisted): ${persisted.length}`,
      `selectedId: ${selected || '-'}`,
      `exists(cache): ${cachedExists ? 'yes' : 'no'}`,
      `exists(persisted): ${persistedExists ? 'yes' : 'no'}`,
      `source: cache + backend content`,
    ].join(' | '));
  }

  async function removeCurrent() {
    if (!selectedId) {
      return;
    }
    await deleteQuestItem(selectedId);
    setSelectedId(null);
    setDraft(emptyQuestItem());
    await refresh();
    setStatus(`Квестовый предмет удален: ${selectedId}`);
  }

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_quest_items',
      collectionKey: 'questItems',
      entries: items,
    });
    setStatus(`Экспорт квестовых предметов: ${items.length}`);
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
      const entries = extractRawCollectionFromImportJson(payload, 'questItems');
      const existingIds = new Set(getQuestItems().map((entry) => entry.id));
      let created = 0;
      let skippedExisting = 0;

      for (const raw of entries) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          continue;
        }
        const item = raw as QuestItemDefinition;
        const id = String(item.id ?? '').trim();
        if (!id) {
          continue;
        }
        if (existingIds.has(id)) {
          skippedExisting += 1;
          continue;
        }
        await saveQuestItem({ ...item, id });
        created += 1;
        existingIds.add(id);
      }

      setStatus(`?????? ????????: ??????? ${created}, ????????? ???????????? ${skippedExisting}.`);
      setSaveState({ state: 'saved', message: `?????? questItems: +${created} / =${skippedExisting}` });
    } catch (error) {
      const message = translateAdminErrorMessage((error as Error).message);
      setStatus(message);
      setSaveState({ state: 'error', message });
    } finally {
      setIsImporting(false);
    }
  }

  function resolveImage(imageKey: string | undefined): string | undefined {
    if (!imageKey) {
      return undefined;
    }
    return resolveStoredImageSource(imageKey, images);
  }

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: saveCurrent,
  });

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <input placeholder="Поиск предмета" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button onClick={createNew}>Новый квестовый предмет</button>
          <button onClick={exportJson}>Экспорт JSON</button>
          <button disabled={isImporting || isSaving} onClick={() => importFileRef.current?.click()}>{isImporting ? 'Импорт...' : 'Импорт JSON'}</button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={handleImportFile} />
        </div>

        <div className="admin-scroll-list">
          {visibleItems.map((item) => (
            <button key={item.id} className={selectedId === item.id ? 'is-active' : ''} onClick={() => select(item)}>
              <strong>{item.name || '(без названия)'}</strong>
              <span>{item.id} | {item.linkedQuestId || 'без привязки'}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Стабильный id квестового предмета." />
            <AdminHelpTooltip section="questItems" field="id" />
            <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Название" hint="Имя предмета в интерфейсе." />
            <AdminHelpTooltip section="questItems" field="name" />
            <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Иконка" hint="Иконка предмета (iconUrl)." />
            <input value={draft.iconUrl ?? ''} onChange={(event) => patch({ iconUrl: event.target.value || undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Изображение" hint="Полноразмерное изображение (imageUrl)." />
            <input value={draft.imageUrl ?? ''} onChange={(event) => patch({ imageUrl: event.target.value || undefined })} />
          </label>
          <label>
            <AdminFieldLabel label="Связанный квест" hint="ID квеста, к которому относится предмет." />
            <select value={draft.linkedQuestId ?? ''} onChange={(event) => patch({ linkedQuestId: event.target.value || undefined })}>
              <option value="">Не связан</option>
              {questIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
        </div>

        <label>
          <AdminFieldLabel label="Описание" hint="Описание квестового предмета." />
          <AdminHelpTooltip section="questItems" field="description" />
          <textarea rows={4} value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
        </label>

        <AdminImageField
          value={draft.iconUrl}
          onChange={(nextValue) => patch({ iconUrl: nextValue || undefined })}
          onStatus={setStatus}
          presetId="item-icon"
          suggestedName={`${draft.id || draft.name || 'quest-item'}-icon`}
          label="Иконка квестового предмета"
          hint="Использует тот же image storage, что и предметы/торговцы/квесты."
        />

        <div className="admin-form-grid">
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.canDrop} onChange={(event) => patch({ canDrop: event.target.checked })} />
            <AdminFieldLabel label="Можно выбросить" hint="Разрешить выброс квестового предмета." />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.canSell} onChange={(event) => patch({ canSell: event.target.checked })} />
            <AdminFieldLabel label="Можно продать" hint="Разрешить продажу в магазине." />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.canTrade} onChange={(event) => patch({ canTrade: event.target.checked })} />
            <AdminFieldLabel label="Можно передать" hint="Разрешить передачу игрокам/NPC." />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.removeOnQuestComplete} onChange={(event) => patch({ removeOnQuestComplete: event.target.checked })} />
            <AdminFieldLabel label="Удалять после завершения" hint="Удалять предмет после успешного завершения квеста." />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.showInQuestInventory} onChange={(event) => patch({ showInQuestInventory: event.target.checked })} />
            <AdminFieldLabel label="Показывать в квестовом инвентаре" hint="Показывать предмет в отдельном квестовом инвентаре." />
          </label>
        </div>

        <section className="card admin-item-preview">
          <h4>Превью</h4>
          <p><strong>{draft.name || '(без названия)'}</strong> ({draft.id || 'id не задан'})</p>
          {resolveImage(draft.iconUrl) ? <img className="admin-item-preview-icon" src={resolveImage(draft.iconUrl)} alt={draft.name || 'quest-item'} /> : null}
          {resolveImage(draft.imageUrl) ? <img className="admin-item-preview-icon" src={resolveImage(draft.imageUrl)} alt={`${draft.name || 'quest-item'} image`} /> : null}
          <p className="muted">{draft.description || 'Описание отсутствует.'}</p>
        </section>

        <div className="admin-actions-row">
          <button disabled={isSaving} onClick={() => { void saveCurrent(); }}>{isSaving ? 'Сохранение...' : (selectedId ? 'Сохранить' : 'Создать')}</button>
          <button disabled={!selectedId} onClick={removeCurrent}>Удалить</button>
          <button type="button" onClick={() => { void debugPersistence(); }}>Проверить сохранение / Debug content</button>
        </div>

        <AdminSaveStatus value={saveState} />
        <p className="muted">{status}</p>
        {debugInfo ? <p className="muted">{debugInfo}</p> : null}
      </section>
    </div>
  );
}
