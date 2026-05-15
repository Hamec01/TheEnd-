import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AdminImageField } from '../AdminImageField';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import type { AdminItem, AdminMerchant, MerchantType, StoredImage } from '../../services/content/models';
import { downloadCollectionJson } from '../../services/content/adminJsonImportExport';
import { itemsService } from '../../services/content/itemsService';
import { loadRuntimeImages, resolveStoredImageSource } from '../../services/content/runtimeImageService';
import { extractRawMerchantsFromImportJson, importMerchantsFromJsonEntries, merchantsService, validateMerchant } from '../../services/content/merchantsService';
import { cityService } from '../../services/cityRepository';
import { uid } from '../../services/content/storage';
import {
  AdminFieldLabel,
  translateAdminErrorMessage,
  translateEnabledState,
  translateItemType,
  translateMerchantType,
} from '../adminUi';
import type { City } from '../../types/city';

const MERCHANT_TYPES: MerchantType[] = ['blacksmith', 'alchemist', 'general', 'rune_master', 'material_trader', 'rare_goods', 'other'];

function emptyMerchant(): AdminMerchant {
  const now = new Date().toISOString();
  return {
    id: '',
    name: '',
    city: '',
    location: '',
    type: 'general',
    description: '',
    portraitPath: '',
    priceMultiplier: 1,
    isEnabled: true,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function MerchantsPage() {
  const [merchants, setMerchants] = useState<AdminMerchant[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [images, setImages] = useState<StoredImage[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminMerchant>(emptyMerchant());
  const [itemSearch, setItemSearch] = useState('');
  const [status, setStatus] = useState('Готово');
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  async function refresh(nextSelectedId: string | null = selectedId) {
    const [allMerchants, allItems, allImages] = await Promise.all([
      merchantsService.getAll(),
      itemsService.getAll(),
      loadRuntimeImages().catch(() => []),
    ]);

    setMerchants(allMerchants);
    setItems(allItems.filter((item) => item.isEnabled));
    setImages(allImages);

    if (!nextSelectedId) {
      return;
    }

    const selectedMerchant = allMerchants.find((merchant) => merchant.id === nextSelectedId);
    if (selectedMerchant) {
      setSelectedId(selectedMerchant.id);
      setDraft(selectedMerchant);
      return;
    }

    setSelectedId(null);
    setDraft(emptyMerchant());
  }

  useEffect(() => {
    void refresh();
    void cityService.getCities().then(setCities).catch(() => setCities([]));
  }, []);

  function exportJson() {
    downloadCollectionJson({
      filePrefix: 'theend_merchants',
      collectionKey: 'merchants',
      entries: merchants,
    });
    setStatus(`Экспортировано торговцев: ${merchants.length}`);
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
      const entries = extractRawMerchantsFromImportJson(payload);
      const result = await importMerchantsFromJsonEntries(entries);
      await refresh();
      const parts = [
        result.created.length ? `создано: ${result.created.length}` : null,
        result.skippedExisting.length ? `пропущено существующих: ${result.skippedExisting.length}` : null,
        result.errors.length ? `ошибок: ${result.errors.length}` : null,
      ].filter(Boolean);
      setStatus(`Импорт торговцев: ${parts.join(', ') || 'нет изменений'}`);
    } catch (error) {
      setStatus(`Импорт: ${translateAdminErrorMessage((error as Error).message)}`);
    } finally {
      setIsImporting(false);
    }
  }

  const selectedCity = useMemo(() => {
    if (!draft.cityId) return null;
    return cities.find((city) => city.id === draft.cityId) ?? null;
  }, [cities, draft.cityId]);

  const selectedCityLocation = useMemo(() => {
    if (!draft.cityLocationId || !selectedCity) return null;
    return selectedCity.locations.find((location) => location.id === draft.cityLocationId) ?? null;
  }, [draft.cityLocationId, selectedCity]);

  const visibleMerchants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return merchants.filter((merchant) => {
      if (!normalizedQuery) {
        return true;
      }

      return merchant.id.toLowerCase().includes(normalizedQuery)
        || merchant.name.toLowerCase().includes(normalizedQuery)
        || merchant.city.toLowerCase().includes(normalizedQuery);
    });
  }, [merchants, query]);

  const selectedItemIds = useMemo(
    () => new Set(draft.items.map((entry) => entry.itemId)),
    [draft.items],
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = itemSearch.trim().toLowerCase();
    return items
      .filter((item) => !normalizedQuery || item.id.toLowerCase().includes(normalizedQuery) || item.name.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => {
        const leftSelected = selectedItemIds.has(left.id);
        const rightSelected = selectedItemIds.has(right.id);
        if (leftSelected !== rightSelected) {
          return leftSelected ? -1 : 1;
        }
        return left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' });
      });
  }, [itemSearch, items, selectedItemIds]);

  const assignedItems = useMemo(
    () => draft.items
      .map((entry) => ({ binding: entry, item: items.find((candidate) => candidate.id === entry.itemId) ?? null }))
      .sort((left, right) => (left.item?.name || left.binding.itemId).localeCompare(right.item?.name || right.binding.itemId, 'ru', { sensitivity: 'base' })),
    [draft.items, items],
  );

  const selectedMerchant = useMemo(
    () => (selectedId ? merchants.find((entry) => entry.id === selectedId) ?? null : null),
    [merchants, selectedId],
  );

  function getMerchantCardAccent(merchant: AdminMerchant): string {
    if (!merchant.isEnabled) {
      return 'is-crimson';
    }
    if (merchant.type === 'rare_goods' || merchant.type === 'rune_master') {
      return 'is-gold';
    }
    if (merchant.type === 'alchemist' || merchant.type === 'material_trader') {
      return 'is-olive';
    }
    return 'is-sky';
  }

  function getItemThumbLabel(item: AdminItem): string {
    return (item.name || item.id || '?').slice(0, 2).toUpperCase();
  }

  function select(merchant: AdminMerchant) {
    setSelectedId(merchant.id);
    setDraft(merchant);
  }

  function patch(next: Partial<AdminMerchant>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function toggleItem(itemId: string) {
    setDraft((current) => {
      const exists = current.items.some((entry) => entry.itemId === itemId);
      if (exists) {
        return { ...current, items: current.items.filter((entry) => entry.itemId !== itemId) };
      }

      return {
        ...current,
        items: [...current.items, { itemId, stock: 10, infiniteStock: false, isEnabled: true }],
      };
    });
  }

  function patchItem(itemId: string, patchData: Partial<AdminMerchant['items'][number]>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((entry) => (entry.itemId === itemId ? { ...entry, ...patchData } : entry)),
    }));
  }

  async function createOrUpdate() {
    const id = draft.id.trim() || uid('merchant');
    const normalized: AdminMerchant = {
      ...draft,
      id,
      priceMultiplier: Number.isFinite(draft.priceMultiplier) ? draft.priceMultiplier : 1,
      updatedAt: new Date().toISOString(),
    };
    const errors = validateMerchant(normalized);

    if (errors.length > 0) {
      setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
      return;
    }

    try {
      if (selectedId) {
        if (normalized.id !== selectedId) {
          const created = await merchantsService.rename(selectedId, normalized.id, normalized);
          setSelectedId(created.id);
          await refresh(created.id);
          setStatus(`Торговец переименован: ${created.id}`);
          return;
        }

        await merchantsService.update(selectedId, normalized);
        await refresh(selectedId);
        setStatus(`Торговец обновлён: ${selectedId}`);
      } else {
        await merchantsService.create(normalized);
        setSelectedId(id);
        await refresh(id);
        setStatus(`Торговец создан: ${id}`);
      }
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function disableSelected() {
    if (!selectedId) {
      return;
    }

    await merchantsService.disable(selectedId);
    await refresh();
    setStatus(`Торговец отключён: ${selectedId}`);
  }

  async function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm('Удалить торговца? Это действие нельзя отменить.')) {
      return;
    }

    await merchantsService.delete(selectedId);
    setSelectedId(null);
    setDraft(emptyMerchant());
    await refresh();
    setStatus(`Торговец удалён: ${selectedId}`);
  }

  return (
    <div className="merchant-admin-layout">
      <section className="admin-form-panel merchant-admin-editor">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Технический уникальный идентификатор торговца." />
            <AdminHelpTooltip section="merchants" field="id" />
            <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
          </label>

          <label>
            <AdminFieldLabel label="Название" hint="Имя торговца, которое увидит игрок." />
            <AdminHelpTooltip section="merchants" field="name" />
            <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </label>

          <label>
            <AdminFieldLabel label="Город" hint="Старое текстовое поле для совместимости." />
            <input value={draft.city} onChange={(event) => patch({ city: event.target.value })} />
          </label>

          <label>
            <AdminFieldLabel label="Локация" hint="Старое текстовое поле места внутри города." />
            <input value={draft.location ?? ''} onChange={(event) => patch({ location: event.target.value })} />
          </label>

          <label>
            <AdminFieldLabel label="City (ID)" hint="Связь с редактором городов." />
            <select value={draft.cityId ?? ''} onChange={(event) => patch({ cityId: event.target.value || undefined, cityLocationId: undefined })}>
              <option value="">Не задано</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name} ({city.id})</option>)}
            </select>
          </label>

          <label>
            <AdminFieldLabel label="City Location (ID)" hint="Место внутри выбранного города." />
            <select value={draft.cityLocationId ?? ''} onChange={(event) => patch({ cityLocationId: event.target.value || undefined })} disabled={!draft.cityId}>
              <option value="">Не задано</option>
              {(selectedCity?.locations ?? []).map((location) => <option key={location.id} value={location.id}>{location.name} ({location.id})</option>)}
            </select>
          </label>

          <label>
            <AdminFieldLabel label="Тип" hint="Роль торговца." />
            <select value={draft.type} onChange={(event) => patch({ type: event.target.value as MerchantType })}>
              {MERCHANT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {translateMerchantType(type)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <AdminFieldLabel label="Множитель цены" hint="1 — обычная цена, 1.2 — дороже, 0.8 — дешевле." />
            <input
              type="number"
              step="0.05"
              min="0.1"
              value={draft.priceMultiplier}
              onChange={(event) => patch({ priceMultiplier: Number(event.target.value) || 1 })}
            />
          </label>

          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(event) => patch({ isEnabled: event.target.checked })} />
            <AdminFieldLabel label="Включён" hint="Отключённый торговец сохраняется в базе, но не используется в игре." />
          </label>
        </div>

        {draft.cityId && !selectedCity ? <p className="muted">Выбранный город не найден.</p> : null}
        {draft.cityLocationId && draft.cityId && !selectedCityLocation ? <p className="muted">Выбранное место внутри города не найдено.</p> : null}

        <label>
          <AdminFieldLabel label="Описание" hint="Короткое описание торговца." />
          <AdminHelpTooltip section="merchants" field="description" />
          <textarea rows={3} value={draft.description ?? ''} onChange={(event) => patch({ description: event.target.value })} />
        </label>

        <AdminImageField
          value={draft.portraitPath}
          onChange={(nextValue) => patch({ portraitPath: nextValue })}
          onStatus={setStatus}
          presetId="merchant-portrait"
          suggestedName={draft.name || draft.id || 'merchant-portrait'}
          label="Портрет торговца"
          hint="Портрет NPC, который будет показан в интерфейсе торговли."
        />

        <h4 title="Список предметов, которые торговец может продавать игроку.">Ассортимент торговца</h4>
        <input placeholder="Поиск предметов для добавления" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} />
        <p className="muted">Клик по предмету добавляет его торговцу. Повторный клик убирает предмет из ассортимента.</p>

        <div className="card">
          <h4>Выбранные товары</h4>
          {assignedItems.length === 0 ? (
            <p className="muted">Пока ничего не выбрано. Выберите предметы из каталога ниже.</p>
          ) : (
            <div className="admin-linked-editor-grid">
              {assignedItems.map(({ binding, item }) => (
                <div key={binding.itemId} className={`admin-linked-editor-row ${binding.isEnabled === false ? 'is-disabled' : ''}`}>
                  <div>
                    <strong>{item?.name || binding.itemId}</strong>
                    <span>{binding.itemId} | {translateItemType(item?.type || 'misc')}</span>
                  </div>
                  <label>
                    <AdminFieldLabel label="Запас" hint="Сколько единиц товара доступно." />
                    <input type="number" min={0} value={binding.stock ?? 0} onChange={(event) => patchItem(binding.itemId, { stock: Number(event.target.value) || 0 })} />
                  </label>
                  <label className="zone-editor-checkbox">
                    <input type="checkbox" checked={binding.infiniteStock ?? false} onChange={(event) => patchItem(binding.itemId, { infiniteStock: event.target.checked })} />
                    <AdminFieldLabel label="Бесконечно" hint="Товар не заканчивается." />
                  </label>
                  <label className="zone-editor-checkbox">
                    <input type="checkbox" checked={binding.isEnabled ?? true} onChange={(event) => patchItem(binding.itemId, { isEnabled: event.target.checked })} />
                    <AdminFieldLabel label="Показывать" hint="Скрытый товар остаётся привязанным, но не показывается игроку." />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="admin-linked-grid merchant-item-pick">
          {visibleItems.map((item) => {
            const assigned = selectedItemIds.has(item.id);
            const image = resolveStoredImageSource(item.imagePath, images);

            return (
              <button
                key={item.id}
                type="button"
                className={`admin-linked-card ${assigned ? 'is-active' : ''}`}
                onClick={() => toggleItem(item.id)}
                title={assigned ? 'Убрать у торговца' : 'Добавить торговцу'}
              >
                <div className="admin-linked-thumb">
                  {image ? <img src={image} alt={item.name} /> : getItemThumbLabel(item)}
                </div>
                <strong>{item.name}</strong>
                <small>{item.id}</small>
                <span>{translateItemType(item.type)}</span>
                <span>{assigned ? 'Выбран' : 'Не выбран'}</span>
              </button>
            );
          })}
        </div>

        <div className="admin-actions-row">
          <button onClick={() => { void createOrUpdate(); }}>{selectedId ? 'Сохранить' : 'Создать'}</button>
          <button disabled={!selectedId} onClick={() => { void disableSelected(); }}>Отключить</button>
          <button disabled={!selectedId} onClick={() => { void deleteSelected(); }}>Удалить</button>
        </div>

        <p className="muted">{status}</p>
      </section>

      <section className="admin-items-catalog card merchant-admin-library">
        <div className="admin-catalog-header">
          <div>
            <p className="admin-catalog-kicker">City Services</p>
            <h3>Все торговцы</h3>
            <p className="muted">Выберите торговца из каталога, как в базе предметов, и редактируйте его слева.</p>
          </div>
          <div className="admin-catalog-metrics">
            <span>{visibleMerchants.length} в выдаче</span>
            <span>{merchants.filter((entry) => entry.isEnabled).length} активных</span>
          </div>
        </div>

        <div className="admin-list-tools admin-catalog-toolbar">
          <input placeholder="Поиск по id, имени или городу" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button onClick={exportJson}>Экспорт JSON</button>
          <button disabled={isImporting} onClick={() => importFileRef.current?.click()}>{isImporting ? 'Импорт...' : 'Импорт JSON'}</button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={handleImportFile} />
          <button onClick={() => { setSelectedId(null); setDraft(emptyMerchant()); }}>Новый торговец</button>
        </div>

        <div className="admin-items-selected-row">
          <strong>Сейчас редактируется:</strong>
          <span>{selectedMerchant ? `${selectedMerchant.name} (${selectedMerchant.id})` : 'новый торговец'}</span>
        </div>

        <div className="admin-items-icons-grid">
          {visibleMerchants.map((merchant) => (
            <button
              key={merchant.id}
              className={`admin-item-icon-card ${selectedId === merchant.id ? 'is-active' : ''}`}
              onClick={() => select(merchant)}
              title={`${merchant.name} (${merchant.id})`}
            >
              <div className={`admin-catalog-thumb admin-catalog-thumb-lg ${getMerchantCardAccent(merchant)}`}>
                {(merchant.name.trim() || merchant.type).charAt(0).toUpperCase()}
              </div>
              <strong>{merchant.name || '(без названия)'}</strong>
              <span>{merchant.id || 'ID ещё не задан'}</span>
              <span>{merchant.city || '-'} | {merchant.items.length} позиций</span>
              <span>{translateEnabledState(merchant.isEnabled)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
