import { useEffect, useMemo, useState } from 'react';
import { AdminImageField } from '../AdminImageField';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import type { AdminItem, AdminMerchant, MerchantType } from '../../services/content/models';
import { itemsService } from '../../services/content/itemsService';
import { merchantsService, validateMerchant } from '../../services/content/merchantsService';
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
  const [cities, setCities] = useState<City[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminMerchant>(emptyMerchant());
  const [itemSearch, setItemSearch] = useState('');
  const [status, setStatus] = useState('Готово');

  async function refresh(nextSelectedId: string | null = selectedId) {
    const [allMerchants, allItems] = await Promise.all([merchantsService.getAll(), itemsService.getAll()]);
    setMerchants(allMerchants);
    setItems(allItems.filter((item) => item.isEnabled));

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

  const selectedCity = useMemo(() => {
    if (!draft.cityId) return null;
    return cities.find((city) => city.id === draft.cityId) ?? null;
  }, [cities, draft.cityId]);

  const selectedCityLocation = useMemo(() => {
    if (!draft.cityLocationId || !selectedCity) return null;
    return selectedCity.locations.find((location) => location.id === draft.cityLocationId) ?? null;
  }, [draft.cityLocationId, selectedCity]);

  const visibleMerchants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merchants.filter((merchant) => {
      if (!q) {
        return true;
      }

      return merchant.id.toLowerCase().includes(q)
        || merchant.name.toLowerCase().includes(q)
        || merchant.city.toLowerCase().includes(q);
    });
  }, [merchants, query]);

  const selectedItemIds = useMemo(
    () => new Set(draft.items.map((entry) => entry.itemId)),
    [draft.items],
  );

  const visibleItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return items
      .filter((item) => !q || item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))
      .sort((left, right) => {
        const leftSelected = selectedItemIds.has(left.id);
        const rightSelected = selectedItemIds.has(right.id);
        if (leftSelected !== rightSelected) {
          return leftSelected ? -1 : 1;
        }

        const leftTime = Date.parse(left.updatedAt || left.createdAt || '');
        const rightTime = Date.parse(right.updatedAt || right.createdAt || '');
        if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
          return rightTime - leftTime;
        }

        return left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' });
      });
  }, [itemSearch, items, selectedItemIds]);

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
          setStatus(`Merchant renamed: ${created.id}`);
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
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }

    await merchantsService.delete(selectedId);
    setSelectedId(null);
    setDraft(emptyMerchant());
    await refresh();
    setStatus(`Торговец удалён: ${selectedId}`);
  }

  return (
    <div className="admin-page-grid">
      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Технический уникальный идентификатор торговца. На него ссылаются городские точки и игровые сервисы." />
            <AdminHelpTooltip section="merchants" field="id" />
            <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
          </label>

          <label>
            <AdminFieldLabel label="Название" hint="Имя торговца, которое увидит игрок." />
            <AdminHelpTooltip section="merchants" field="name" />
            <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </label>

          <label>
            <AdminFieldLabel label="Город" hint="Название города. Для появления в Арклейне укажи здесь: Арклейн." />
            <input value={draft.city} onChange={(event) => patch({ city: event.target.value })} />
          </label>

          <label>
            <AdminFieldLabel label="Локация" hint="Более точное место внутри города: рынок, кузня, таверна, квартал и т.д. По этому полю игра старается поставить торговца в подходящую часть города." />
            <input value={draft.location ?? ''} onChange={(event) => patch({ location: event.target.value })} />
          </label>

          <label>
            <AdminFieldLabel label="City (ID)" hint="Привязка к City Editor: выбери город по id. Это не ломает старые поля 'Город/Локация'." />
            <select value={draft.cityId ?? ''} onChange={(event) => patch({ cityId: event.target.value || undefined, cityLocationId: undefined })}>
              <option value="">Не задано</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.name} ({city.id})</option>)}
            </select>
          </label>
          {draft.cityId && !selectedCity ? <p className="muted">City not found</p> : null}

          <label>
            <AdminFieldLabel label="City Location (ID)" hint="Локация внутри выбранного города (из City Editor). Список фильтруется по выбранному City." />
            <select value={draft.cityLocationId ?? ''} onChange={(event) => patch({ cityLocationId: event.target.value || undefined })} disabled={!draft.cityId}>
              <option value="">Не задано</option>
              {(selectedCity?.locations ?? []).map((location) => <option key={location.id} value={location.id}>{location.name} ({location.id})</option>)}
            </select>
          </label>
          {draft.cityLocationId && draft.cityId && !selectedCityLocation ? <p className="muted">Location not found</p> : null}

          <label>
            <AdminFieldLabel label="Тип" hint="Роль торговца. Помогает понять, чем именно он торгует." />
            <select value={draft.type} onChange={(event) => patch({ type: event.target.value as MerchantType })}>
              {MERCHANT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {translateMerchantType(type)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <AdminFieldLabel label="Множитель цены" hint="Наценка или скидка торговца. 1 — обычная цена, 1.2 — на 20% дороже, 0.8 — на 20% дешевле." />
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
            <AdminFieldLabel label="Включён" hint="Если выключить, торговец сохранится в базе, но не будет использоваться в игре." />
          </label>
        </div>

        <label>
          <AdminFieldLabel label="Описание" hint="Короткое описание торговца: чем известен, что продаёт, какой у него стиль." />
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
          hint="Загружает портрет NPC, который будет показываться в городе и в окне торговли."
        />

        <h4 title="Список предметов, которые торговец может продавать игроку.">Ассортимент торговца</h4>
        <input placeholder="Поиск предметов для добавления" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} />
        <p className="muted">Доступно предметов: {visibleItems.length}. Новые и уже выбранные позиции показаны выше.</p>

        <div className="admin-scroll-list merchant-item-pick">
          {visibleItems.map((item) => {
            const assigned = draft.items.find((entry) => entry.itemId === item.id);

            return (
              <div key={item.id} className={`merchant-item-row ${assigned ? 'is-active' : ''}`}>
                <button onClick={() => toggleItem(item.id)}>{assigned ? 'Убрать' : 'Добавить'}</button>

                <div>
                  <strong>{item.name}</strong>
                  <span>{item.id} | {translateItemType(item.type)}</span>
                </div>

                {assigned ? (
                  <>
                    <label>
                      <AdminFieldLabel label="Запас" hint="Сколько единиц этого предмета доступно у торговца. Если включён бесконечный запас, число можно игнорировать." />
                      <input type="number" min={0} value={assigned.stock ?? 0} onChange={(event) => patchItem(item.id, { stock: Number(event.target.value) || 0 })} />
                    </label>

                    <label className="zone-editor-checkbox">
                      <input type="checkbox" checked={assigned.infiniteStock ?? false} onChange={(event) => patchItem(item.id, { infiniteStock: event.target.checked })} />
                      <AdminFieldLabel label="Бесконечный запас" hint="Если включено, этот предмет никогда не закончится у торговца." />
                    </label>

                    <label className="zone-editor-checkbox">
                      <input type="checkbox" checked={assigned.isEnabled ?? true} onChange={(event) => patchItem(item.id, { isEnabled: event.target.checked })} />
                      <AdminFieldLabel label="Показывать" hint="Если выключить, предмет останется привязан к торговцу, но игрок не увидит его в продаже." />
                    </label>
                  </>
                ) : null}
              </div>
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

      <section className="admin-items-catalog card">
        <div className="admin-catalog-header">
          <div>
            <p className="admin-catalog-kicker">City Services</p>
            <h3>Все торговцы</h3>
            <p className="muted">Выбирай торговца снизу, как обычный значок, и редактируй его в форме выше.</p>
          </div>
          <div className="admin-catalog-metrics">
            <span>{visibleMerchants.length} в выдаче</span>
            <span>{merchants.filter((entry) => entry.isEnabled).length} активных</span>
          </div>
        </div>

        <div className="admin-list-tools admin-catalog-toolbar">
          <input placeholder="Поиск по id, имени или городу" value={query} onChange={(event) => setQuery(event.target.value)} />
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
