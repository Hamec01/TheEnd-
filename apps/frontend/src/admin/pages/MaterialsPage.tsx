import { useEffect, useState } from 'react';
import type { Material } from '../../services/content/models';
import { itemsService } from '../../services/content/itemsService';
import { materialsService, validateMaterial } from '../../services/content/materialsService';
import { uid } from '../../services/content/storage';
import { AdminImageField } from '../AdminImageField';
import {
  AdminFieldLabel,
  translateAdminErrorMessage,
  translateEnabledState,
  translateMaterialCategory,
  translateRarity,
} from '../adminUi';

const MATERIAL_CATEGORIES: Material['category'][] = ['metal', 'wood', 'leather', 'cloth', 'herb', 'stone', 'crystal', 'bone', 'other'];
const MATERIAL_RARITIES: Material['rarity'][] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'forbidden'];

function emptyMaterial(): Material {
  const now = new Date().toISOString();
  return {
    id: '',
    name: '',
    category: 'other',
    region: '',
    rarity: 'common',
    properties: [],
    gameplayDescription: '',
    loreDescription: '',
    imagePath: '',
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Material>(emptyMaterial());
  const [status, setStatus] = useState('Готово');

  async function refresh() {
    const all = await materialsService.getAll();
    setMaterials(all);
    if (selectedId && !all.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
      setDraft(emptyMaterial());
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createOrUpdate() {
    const id = draft.id.trim() || uid('mat');
    const normalized: Material = {
      ...draft,
      id,
      updatedAt: new Date().toISOString(),
    };
    const errors = validateMaterial(normalized);
    if (errors.length > 0) {
      setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
      return;
    }

    try {
      if (selectedId) {
        await materialsService.update(selectedId, normalized);
        setStatus(`Материал обновлён: ${selectedId}`);
      } else {
        await materialsService.create(normalized);
        setSelectedId(id);
        setStatus(`Материал создан: ${id}`);
      }
      await refresh();
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function createLinkedItem() {
    if (!draft.name.trim()) {
      setStatus(translateAdminErrorMessage('Material name is required to create linked item.'));
      return;
    }

    const itemId = `mat_${(draft.id || uid('mat')).replace(/[^a-zA-Z0-9_]/g, '_')}`;
    try {
      await itemsService.create({
        id: itemId,
        name: draft.name,
        type: 'material',
        rarity: draft.rarity,
        price: 1,
        stackable: true,
        maxStack: 999,
        gameplayDescription: draft.gameplayDescription || `Материал: ${draft.name}`,
        loreDescription: draft.loreDescription || draft.gameplayDescription || '',
        imagePath: draft.imagePath,
        isEnabled: true,
      });
      setStatus(`Создан связанный предмет-материал: ${itemId}`);
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function disableSelected() {
    if (!selectedId) {
      return;
    }
    await materialsService.disable(selectedId);
    await refresh();
    setStatus(`Материал отключён: ${selectedId}`);
  }

  async function deleteSelected() {
    if (!selectedId) {
      return;
    }
    await materialsService.delete(selectedId);
    setSelectedId(null);
    setDraft(emptyMaterial());
    await refresh();
    setStatus(`Материал удалён: ${selectedId}`);
  }

  return (
    <div className="admin-two-col">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <button onClick={() => { setSelectedId(null); setDraft(emptyMaterial()); }}>Новый материал</button>
        </div>
        <div className="admin-scroll-list">
          {materials.map((material) => (
            <button key={material.id} className={selectedId === material.id ? 'is-active' : ''} onClick={() => { setSelectedId(material.id); setDraft(material); }}>
              <strong>{material.name}</strong>
              <span>{material.id} | {translateMaterialCategory(material.category)} | {translateRarity(material.rarity)} | {translateEnabledState(material.isEnabled)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Технический уникальный идентификатор материала. На него могут ссылаться крафт, лут и связанные предметы." />
            <input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Название" hint="Отображаемое имя материала для игрока." />
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Категория" hint="К какому виду относится материал: металл, дерево, ткань, кристалл и т.д." />
            <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as Material['category'] }))}>
              {MATERIAL_CATEGORIES.map((category) => (
                <option key={category} value={category}>{translateMaterialCategory(category)}</option>
              ))}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Редкость" hint="Редкость материала. Обычно влияет на ценность и редкость получения." />
            <select value={draft.rarity} onChange={(event) => setDraft((current) => ({ ...current, rarity: event.target.value as Material['rarity'] }))}>
              {MATERIAL_RARITIES.map((rarity) => (
                <option key={rarity} value={rarity}>{translateRarity(rarity)}</option>
              ))}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Регион" hint="Где этот материал обычно добывается: регион, биом или территория." />
            <input value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} />
          </label>
          <label>
            <AdminFieldLabel label="Свойства" hint="Список ключевых свойств через запятую: например 'гибкий, жаростойкий, редкий'." />
            <input value={draft.properties.join(', ')} onChange={(event) => setDraft((current) => ({ ...current, properties: event.target.value.split(',').map((v) => v.trim()).filter(Boolean) }))} />
          </label>
          <label>
            <AdminFieldLabel label="Путь / ID изображения" hint="Ссылка на картинку или ID изображения из раздела картинок." />
            <input value={draft.imagePath ?? ''} onChange={(event) => setDraft((current) => ({ ...current, imagePath: event.target.value }))} />
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked }))} />
            <AdminFieldLabel label="Включён" hint="Если выключить, материал останется в базе, но не будет использоваться активным контентом." />
          </label>
        </div>

        <AdminImageField
          value={draft.imagePath}
          onChange={(nextValue) => setDraft((current) => ({ ...current, imagePath: nextValue }))}
          onStatus={setStatus}
          presetId="item-icon"
          suggestedName={`${draft.id || draft.name || 'material'}-icon`}
          label="Картинка материала"
          hint="Загружает иконку материала и сразу уменьшает её до рабочего размера для интерфейса."
        />

        <label>
          <AdminFieldLabel label="Игровое описание" hint="Практическое описание для игрока: где используется материал и зачем он нужен." />
          <textarea rows={4} value={draft.gameplayDescription ?? ''} onChange={(event) => setDraft((current) => ({ ...current, gameplayDescription: event.target.value }))} />
        </label>

        <label>
          <AdminFieldLabel label="Лор / описание мира" hint="Художественный текст про происхождение, атмосферу и историю материала." />
          <textarea rows={3} value={draft.loreDescription ?? ''} onChange={(event) => setDraft((current) => ({ ...current, loreDescription: event.target.value }))} />
        </label>

        <div className="admin-actions-row">
          <button onClick={() => { void createOrUpdate(); }}>{selectedId ? 'Сохранить' : 'Создать'}</button>
          <button onClick={() => { void createLinkedItem(); }}>Создать связанный предмет</button>
          <button disabled={!selectedId} onClick={() => { void disableSelected(); }}>Отключить</button>
          <button disabled={!selectedId} onClick={() => { void deleteSelected(); }}>Удалить</button>
        </div>
        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
