import { useEffect, useMemo, useState } from 'react';
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
  const [query, setQuery] = useState('');
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

  const visibleMaterials = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((entry) => {
      if (!q) {
        return true;
      }
      return entry.id.toLowerCase().includes(q)
        || entry.name.toLowerCase().includes(q)
        || entry.region.toLowerCase().includes(q);
    });
  }, [materials, query]);

  const selectedMaterial = useMemo(
    () => (selectedId ? materials.find((entry) => entry.id === selectedId) ?? null : null),
    [materials, selectedId],
  );

  function getMaterialCardAccent(material: Material): string {
    if (!material.isEnabled) {
      return 'is-crimson';
    }
    if (material.rarity === 'legendary' || material.rarity === 'mythic' || material.rarity === 'forbidden') {
      return 'is-gold';
    }
    if (material.rarity === 'epic' || material.rarity === 'rare') {
      return 'is-sky';
    }
    return 'is-olive';
  }

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
        if (normalized.id !== selectedId) {
          const created = await materialsService.rename(selectedId, normalized.id, normalized);
          setSelectedId(created.id);
          setStatus(`Материал переименован: ${created.id}`);
        } else {
          await materialsService.update(selectedId, normalized);
          setStatus(`Материал обновлён: ${selectedId}`);
        }
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
    <div className="admin-page-grid">
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

      <section className="admin-items-catalog card">
        <div className="admin-catalog-header">
          <div>
            <p className="admin-catalog-kicker">Crafting Assets</p>
            <h3>Все материалы</h3>
            <p className="muted">Список материалов перенесен вниз: выбирай материал как значок и редактируй его в форме выше.</p>
          </div>
          <div className="admin-catalog-metrics">
            <span>{visibleMaterials.length} в выдаче</span>
            <span>{materials.filter((entry) => entry.isEnabled).length} активных</span>
          </div>
        </div>

        <div className="admin-list-tools admin-catalog-toolbar">
          <input placeholder="Поиск по id, имени или региону" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button onClick={() => { setSelectedId(null); setDraft(emptyMaterial()); }}>Новый материал</button>
        </div>

        <div className="admin-items-selected-row">
          <strong>Сейчас редактируется:</strong>
          <span>{selectedMaterial ? `${selectedMaterial.name} (${selectedMaterial.id})` : 'новый материал'}</span>
        </div>

        <div className="admin-items-icons-grid">
          {visibleMaterials.map((material) => (
            <button
              key={material.id}
              className={`admin-item-icon-card ${selectedId === material.id ? 'is-active' : ''}`}
              onClick={() => { setSelectedId(material.id); setDraft(material); }}
              title={`${material.name} (${material.id})`}
            >
              <div className={`admin-catalog-thumb admin-catalog-thumb-lg ${getMaterialCardAccent(material)}`}>
                {(material.name.trim() || material.category).charAt(0).toUpperCase()}
              </div>
              <strong>{material.name || '(без названия)'}</strong>
              <span>{material.id || 'ID ещё не задан'}</span>
              <span>{translateMaterialCategory(material.category)} | {translateRarity(material.rarity)}</span>
              <span>{translateEnabledState(material.isEnabled)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
