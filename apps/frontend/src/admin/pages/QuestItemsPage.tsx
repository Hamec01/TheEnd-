import { useEffect, useMemo, useState } from 'react';
import { AdminImageField } from '../AdminImageField';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';
import { imageService } from '../../services/content/imageService';
import { resolveStoredImageSource } from '../../services/content/runtimeImageService';
import { deleteQuestItem, getAllQuests, getQuestItems, saveQuestItem } from '../../services/questRepository';
import type { StoredImage } from '../../services/content/models';
import type { QuestItemDefinition } from '../../types/quest';

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

  async function refresh() {
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

  function saveCurrent() {
    try {
      const saved = saveQuestItem({
        ...draft,
        id: draft.id.trim() || uid('quest_item'),
        name: draft.name.trim(),
      });
      setSelectedId(saved.id);
      setDraft(saved);
      void refresh();
      setStatus(`Квестовый предмет сохранен: ${saved.id}`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  function removeCurrent() {
    if (!selectedId) {
      return;
    }
    deleteQuestItem(selectedId);
    setSelectedId(null);
    setDraft(emptyQuestItem());
    void refresh();
    setStatus(`Квестовый предмет удален: ${selectedId}`);
  }

  function resolveImage(imageKey: string | undefined): string | undefined {
    if (!imageKey) {
      return undefined;
    }
    return resolveStoredImageSource(imageKey, images);
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <input placeholder="Поиск предмета" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button onClick={createNew}>Новый квестовый предмет</button>
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
            <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Название" hint="Имя предмета в интерфейсе." />
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
          <button onClick={saveCurrent}>{selectedId ? 'Сохранить' : 'Создать'}</button>
          <button disabled={!selectedId} onClick={removeCurrent}>Удалить</button>
        </div>

        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
