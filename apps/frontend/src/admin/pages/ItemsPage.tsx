import { useEffect, useMemo, useState } from 'react';
import { AdminSaveStatus } from '../AdminSaveStatus';
import type { AdminItem, DamageCategory, ElementType, HandsRequired, ItemRarity, ItemSlot, ItemType, MagicSchool, PhysicalType, StatKey, StoredImage } from '../../services/content/models';
import { imageService } from '../../services/content/imageService';
import { loadRuntimeImages, resolveStoredImageSource } from '../../services/content/runtimeImageService';
import { itemsService, validateItem } from '../../services/content/itemsService';
import { uid } from '../../services/content/storage';
import { AdminImageField } from '../AdminImageField';
import {
  AdminFieldLabel,
  translateAdminErrorMessage,
  translateDamageCategory,
  translateElementType,
  translateEnabledState,
  translateHandsRequired,
  translateItemSlot,
  translateItemType,
  translateMagicSchool,
  translatePhysicalType,
  translateRarity,
  translateStatKey,
} from '../adminUi';
import { getIdQualityWarning, runSaveWithFeedback, useAdminSaveShortcut, type AdminSaveViewModel } from '../adminSaveTools';

const STAT_KEYS: StatKey[] = ['hp', 'mp', 'stamina', 'strength', 'constitution', 'dexterity', 'intelligence', 'luck', 'perception', 'willpower'];
const ITEM_TYPES: ItemType[] = ['weapon', 'armor', 'potion', 'material', 'quest', 'misc'];
const RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'forbidden'];
const SLOTS: ItemSlot[] = ['head', 'necklace', 'chest', 'outerwear', 'belt', 'leftHand', 'rightHand', 'gloves', 'legs', 'boots', 'ring', 'trinket', 'charm', 'quick', 'none'];
const DAMAGE_CATEGORIES: DamageCategory[] = ['physical', 'elemental', 'magic', 'shamanic', 'runic', 'poison', 'bleed', 'true'];
const PHYSICAL_TYPES: PhysicalType[] = ['slash', 'pierce', 'blunt', 'cleave', 'unarmed'];
const ELEMENT_TYPES: ElementType[] = ['fire', 'water', 'earth', 'air', 'light', 'dark'];
const MAGIC_SCHOOLS: MagicSchool[] = ['blood', 'death', 'life', 'mind', 'illusion', 'curse', 'arcane'];

function emptyItem(): AdminItem {
  const now = new Date().toISOString();
  return {
    id: '',
    name: '',
    type: 'weapon',
    subtype: '',
    slot: 'rightHand',
    handsRequired: 1,
    rarity: 'common',
    price: 0,
    stackable: false,
    maxStack: 1,
    requiredStats: {},
    bonuses: {},
    gameplayDescription: '',
    loreDescription: '',
    imagePath: '',
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function parseNumber(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePositiveInt(value: string): number | undefined {
  const parsed = parseNumber(value);
  if (typeof parsed !== 'number') {
    return undefined;
  }
  const intValue = Math.floor(parsed);
  return Number.isFinite(intValue) && intValue > 0 ? intValue : undefined;
}

function isDirectImageSource(value: string): boolean {
  return value.startsWith('data:') || value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
}

export function ItemsPage() {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | ItemRarity>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminItem>(emptyItem());
  const [status, setStatus] = useState('Готово');
  const [saveState, setSaveState] = useState<AdminSaveViewModel>({ state: 'idle', message: 'Готово' });
  const [isSaving, setIsSaving] = useState(false);
  const [rangePanelOpen, setRangePanelOpen] = useState(false);

  const [previewImage, setPreviewImage] = useState<StoredImage | null>(null);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);

  async function refresh() {
    const [all, images] = await Promise.all([itemsService.getAll(), loadRuntimeImages()]);
    setItems(all);
    setRuntimeImages(images);
    if (selectedId && !all.some((item) => item.id === selectedId)) {
      setSelectedId(null);
      setDraft(emptyItem());
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
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
      return true;
    });
  }, [items, query, rarityFilter, typeFilter]);

  const selectedItem = useMemo(
    () => (selectedId ? items.find((item) => item.id === selectedId) ?? null : null),
    [items, selectedId],
  );

  function resolveItemImage(item: AdminItem): string | undefined {
    return resolveStoredImageSource(item.imagePath?.trim(), runtimeImages);
  }

  function getItemCardAccent(item: AdminItem): string {
    switch (item.rarity) {
      case 'legendary':
      case 'mythic':
        return 'is-gold';
      case 'epic':
      case 'forbidden':
        return 'is-crimson';
      case 'rare':
        return 'is-sky';
      default:
        return 'is-olive';
    }
  }

  function select(item: AdminItem) {
    setSelectedId(item.id);
    setDraft(item);
    setRangePanelOpen(Boolean(item.attackRange || item.pierceTargets || item.splashRadius));
  }

  function patch(next: Partial<AdminItem>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function patchStatBucket(bucket: 'requiredStats' | 'bonuses', key: StatKey, rawValue: string) {
    setDraft((current) => {
      const parsed = parseNumber(rawValue);
      const nextBucket = { ...(current[bucket] ?? {}) };
      if (parsed === undefined) {
        delete nextBucket[key];
      } else {
        nextBucket[key] = parsed;
      }
      return {
        ...current,
        [bucket]: nextBucket,
      };
    });
  }

  useEffect(() => {
    if (draft.type === 'material') {
      patch({ slot: 'none' });
      return;
    }
    if (draft.type === 'potion' && (!draft.slot || draft.slot === 'none')) {
      patch({ slot: 'quick' });
      return;
    }
    if (draft.type === 'weapon' && draft.slot !== 'rightHand') {
      patch({ slot: 'rightHand' });
    }
  }, [draft.type, draft.slot]);

  useEffect(() => {
    if (draft.type !== 'weapon' && draft.handsRequired !== 1) {
      patch({ handsRequired: 1 });
    }
  }, [draft.handsRequired, draft.type]);

  useEffect(() => {
    const normalized = draft.imagePath?.trim();
    if (!normalized || isDirectImageSource(normalized)) {
      setPreviewImage(null);
      return;
    }

    let disposed = false;
    void imageService.get(normalized).then((image) => {
      if (!disposed) {
        setPreviewImage(image);
      }
    });

    return () => {
      disposed = true;
    };
  }, [draft.imagePath]);

  const draftImageSrc = useMemo(() => {
    const normalized = draft.imagePath?.trim();
    if (!normalized) {
      return null;
    }
    if (isDirectImageSource(normalized)) {
      return normalized;
    }
    return resolveStoredImageSource(normalized, previewImage ? [previewImage] : []) ?? null;
  }, [draft.imagePath, previewImage]);

  const draftPreviewLabel = useMemo(() => {
    const source = draft.name.trim() || draft.subtype?.trim() || draft.type;
    return source.charAt(0).toUpperCase() || '?';
  }, [draft.name, draft.subtype, draft.type]);

  async function createOrUpdate() {
    if (isSaving) {
      return;
    }

    const id = draft.id.trim() || uid('item');
    const normalized: AdminItem = {
      ...draft,
      id,
      handsRequired: draft.type === 'weapon' && draft.handsRequired === 2 ? 2 : 1,
      maxStack: draft.stackable ? Math.max(2, draft.maxStack ?? 2) : 1,
      updatedAt: new Date().toISOString(),
    };

    const errors = validateItem(normalized);
    if (errors.length > 0) {
      setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
      return;
    }

    setIsSaving(true);
    const saved = await runSaveWithFeedback({
      setState: setSaveState,
      saveLabel: id,
      onSave: () => (selectedId
        ? itemsService.update(selectedId, normalized)
        : itemsService.create(normalized)),
      onAfterSave: async (entry) => {
        const verified = await itemsService.getById(entry.id);
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
      setStatus(selectedId ? `Предмет обновлён: ${saved.id}` : `Предмет создан: ${saved.id}`);
    }
    setIsSaving(false);
  }

  useAdminSaveShortcut({
    enabled: true,
    isSaving,
    onSave: createOrUpdate,
  });

  async function duplicateSelected() {
    if (!selectedId) {
      return;
    }
    const copy = {
      ...draft,
      id: `${draft.id || 'item'}_copy_${Math.floor(Math.random() * 10000)}`,
      name: `${draft.name} Копия`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await itemsService.create(copy);
      setStatus(`Создана копия предмета: ${selectedId}`);
      await refresh();
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function disableSelected() {
    if (!selectedId) {
      return;
    }
    await itemsService.disable(selectedId);
    await refresh();
    setStatus(`Предмет отключён: ${selectedId}`);
  }

  async function deleteSelected() {
    if (!selectedId) {
      return;
    }
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }
    await itemsService.delete(selectedId);
    setSelectedId(null);
    setDraft(emptyItem());
    await refresh();
    setStatus(`Предмет удалён: ${selectedId}`);
  }

  return (
    <div className="admin-items-page admin-page-grid">
      <section className="admin-form-panel">
        <div className="admin-form-grid">
          <label>
            <AdminFieldLabel label="ID" hint="Технический уникальный идентификатор. Используется в коде, магазинах, луте и сохранениях. После публикации лучше не менять." />
            <input value={draft.id} onChange={(event) => patch({ id: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Название" hint="Имя предмета, которое увидит игрок." />
            <input value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Тип" hint="Главная категория предмета. Она влияет на поведение предмета в игре." />
            <select value={draft.type} onChange={(event) => patch({ type: event.target.value as ItemType })}>
              {ITEM_TYPES.map((type) => <option key={type} value={type}>{translateItemType(type)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Подтип" hint="Уточнение внутри типа: например меч, топор, лечебное зелье или руда." />
            <input value={draft.subtype ?? ''} onChange={(event) => patch({ subtype: event.target.value })} />
          </label>
          <label>
            <AdminFieldLabel label="Слот" hint="Куда предмет можно экипировать. Для расходников обычно используется быстрый слот, для материалов — не экипируется." />
            <select value={draft.slot ?? 'none'} onChange={(event) => patch({ slot: event.target.value as ItemSlot })}>
              {SLOTS.map((slot) => <option key={slot} value={slot}>{translateItemSlot(slot)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Редкость" hint="Редкость предмета. Помогает балансировать ценность и редкость выпадения." />
            <select value={draft.rarity} onChange={(event) => patch({ rarity: event.target.value as ItemRarity })}>
              {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{translateRarity(rarity)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Цена" hint="Базовая цена покупки у торговца в золоте." />
            <input type="number" min={0} value={draft.price} onChange={(event) => patch({ price: Number(event.target.value) || 0 })} />
          </label>
          <label>
            <AdminFieldLabel label="Хват" hint="Сколько рук нужно, чтобы держать оружие. Для двуручного оружия левая рука автоматически освобождается." />
            <select
              value={draft.handsRequired ?? 1}
              onChange={(event) => patch({ handsRequired: Number(event.target.value) as HandsRequired })}
              disabled={draft.type !== 'weapon'}
            >
              <option value={1}>{translateHandsRequired(1)}</option>
              <option value={2}>{translateHandsRequired(2)}</option>
            </select>
          </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.stackable} onChange={(event) => patch({ stackable: event.target.checked })} />
            <AdminFieldLabel label="Складывается в стопку" hint="Если включено, несколько копий предмета могут лежать в одном слоте инвентаря." />
          </label>
          <label>
            <AdminFieldLabel label="Макс. в стопке" hint="Сколько копий этого предмета можно хранить в одной стопке." />
            <input type="number" min={1} value={draft.maxStack ?? 1} onChange={(event) => patch({ maxStack: Number(event.target.value) || 1 })} />
          </label>
          <label>
            <AdminFieldLabel label="Мин. урон" hint="Нижняя граница урона оружия или атакующего предмета." />
            <input type="number" value={draft.damageMin ?? ''} onChange={(event) => patch({ damageMin: parseNumber(event.target.value) })} />
          </label>
          <label>
            <AdminFieldLabel label="Макс. урон" hint="Верхняя граница урона. Не должна быть ниже минимального урона." />
            <input type="number" value={draft.damageMax ?? ''} onChange={(event) => patch({ damageMax: parseNumber(event.target.value) })} />
          </label>
          <div className="admin-item-range-tools card">
            <div className="admin-item-range-tools-head">
              <button type="button" onClick={() => setRangePanelOpen((value) => !value)}>
                RANGE {rangePanelOpen ? '▲' : '▼'}
              </button>
              <span className="muted">Дальность / пробитие / урон по площади (лук, арбалет, посох, бомбы, метательное копьё)</span>
            </div>

            {rangePanelOpen ? (
              <div className="admin-item-range-tools-grid">
                <label className="zone-editor-checkbox">
                  <input
                    type="checkbox"
                    checked={typeof draft.attackRange === 'number' && draft.attackRange > 1}
                    onChange={(event) => {
                      if (event.target.checked) {
                        patch({ attackRange: Math.max(2, draft.attackRange ?? 2) });
                        return;
                      }
                      patch({
                        attackRange: undefined,
                        pierceTargets: undefined,
                        splashRadius: undefined,
                        splashCenterMultiplier: undefined,
                        splashOuterMultiplier: undefined,
                      });
                    }}
                  />
                  <AdminFieldLabel label="Дальний бой" hint="Если включено — предмет может атаковать дальше 1 клетки." />
                </label>

                {typeof draft.attackRange === 'number' && draft.attackRange > 1 ? (
                  <>
                    <label>
                      <AdminFieldLabel label="Range (клетки)" hint="Максимальная дальность в клетках. Пример: лук 3, посох 5, бомба 5." />
                      <input
                        type="number"
                        min={2}
                        value={draft.attackRange ?? ''}
                        onChange={(event) => {
                          const parsed = parsePositiveInt(event.target.value);
                          if (!parsed) {
                            patch({
                              attackRange: undefined,
                              pierceTargets: undefined,
                              splashRadius: undefined,
                              splashCenterMultiplier: undefined,
                              splashOuterMultiplier: undefined,
                            });
                            return;
                          }
                          patch({ attackRange: Math.max(2, parsed) });
                        }}
                      />
                    </label>
                    <label>
                      <AdminFieldLabel label="Пробитие (целей)" hint="Сколько целей по линии может задеть снаряд. Пример: метательное копьё 2." />
                      <input
                        type="number"
                        min={2}
                        value={draft.pierceTargets ?? ''}
                        onChange={(event) => {
                          const parsed = parsePositiveInt(event.target.value);
                          patch({ pierceTargets: parsed ? Math.max(2, parsed) : undefined });
                        }}
                      />
                    </label>

                    <label className="zone-editor-checkbox">
                      <input
                        type="checkbox"
                        checked={typeof draft.splashRadius === 'number' && draft.splashRadius >= 1}
                        onChange={(event) => {
                          if (event.target.checked) {
                            patch({
                              splashRadius: Math.max(1, draft.splashRadius ?? 1),
                              splashCenterMultiplier: typeof draft.splashCenterMultiplier === 'number' ? Math.max(1, draft.splashCenterMultiplier) : 1,
                              splashOuterMultiplier: typeof draft.splashOuterMultiplier === 'number' ? Math.max(0, draft.splashOuterMultiplier) : 0.5,
                            });
                            return;
                          }
                          patch({
                            splashRadius: undefined,
                            splashCenterMultiplier: undefined,
                            splashOuterMultiplier: undefined,
                          });
                        }}
                      />
                      <AdminFieldLabel label="Урон по площади" hint="Если включено — атакует клетку попадания и клетки вокруг (бомбы/заклинания из посоха)." />
                    </label>

                    {typeof draft.splashRadius === 'number' && draft.splashRadius >= 1 ? (
                      <>
                        <label>
                          <AdminFieldLabel label="Радиус AoE (клетки)" hint="Радиус поражения вокруг клетки попадания. 1 = ближайшие клетки вокруг." />
                          <input
                            type="number"
                            min={1}
                            value={draft.splashRadius ?? ''}
                            onChange={(event) => {
                              const parsed = parsePositiveInt(event.target.value);
                              if (!parsed) {
                                patch({
                                  splashRadius: undefined,
                                  splashCenterMultiplier: undefined,
                                  splashOuterMultiplier: undefined,
                                });
                                return;
                              }
                              patch({ splashRadius: Math.max(1, parsed) });
                            }}
                          />
                        </label>
                        <label>
                          <AdminFieldLabel label="Множитель центра" hint="Во сколько раз урон по клетке попадания выше, чем базовый (>= 1)." />
                          <input
                            type="number"
                            min={1}
                            step={0.1}
                            value={draft.splashCenterMultiplier ?? ''}
                            onChange={(event) => patch({ splashCenterMultiplier: parseNumber(event.target.value) })}
                          />
                        </label>
                        <label>
                          <AdminFieldLabel label="Множитель вокруг" hint="Урон по клеткам вокруг. 0..(множитель центра). Обычно 0.5." />
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={draft.splashOuterMultiplier ?? ''}
                            onChange={(event) => patch({ splashOuterMultiplier: parseNumber(event.target.value) })}
                          />
                        </label>
                      </>
                    ) : null}
                  </>
                ) : (
                  <p className="muted admin-item-range-tools-note">Для ближнего боя оставь выключенным.</p>
                )}
              </div>
            ) : null}
          </div>
          <label>
            <AdminFieldLabel label="Категория урона" hint="Определяет, к какому типу относится урон предмета: физический, магический, стихия и так далее." />
            <select value={draft.damageCategory ?? ''} onChange={(event) => patch({ damageCategory: (event.target.value || undefined) as DamageCategory | undefined })}>
              <option value="">Не задана</option>
              {DAMAGE_CATEGORIES.map((entry) => <option key={entry} value={entry}>{translateDamageCategory(entry)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Физический тип" hint="Уточняет физический вид урона: режущий, колющий, дробящий и т.д." />
            <select value={draft.physicalType ?? ''} onChange={(event) => patch({ physicalType: (event.target.value || undefined) as PhysicalType | undefined })}>
              <option value="">Не задан</option>
              {PHYSICAL_TYPES.map((entry) => <option key={entry} value={entry}>{translatePhysicalType(entry)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Стихия" hint="Если урон стихийный, здесь указывается конкретная стихия." />
            <select value={draft.elementType ?? ''} onChange={(event) => patch({ elementType: (event.target.value || undefined) as ElementType | undefined })}>
              <option value="">Не задана</option>
              {ELEMENT_TYPES.map((entry) => <option key={entry} value={entry}>{translateElementType(entry)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Школа магии" hint="Если предмет связан с магией, здесь можно указать школу магии." />
            <select value={draft.magicSchool ?? ''} onChange={(event) => patch({ magicSchool: (event.target.value || undefined) as MagicSchool | undefined })}>
              <option value="">Не задана</option>
              {MAGIC_SCHOOLS.map((entry) => <option key={entry} value={entry}>{translateMagicSchool(entry)}</option>)}
            </select>
          </label>
          <label>
            <AdminFieldLabel label="Броня" hint="Плоское значение защиты, которое даёт предмет." />
            <input type="number" value={draft.armorValue ?? ''} onChange={(event) => patch({ armorValue: parseNumber(event.target.value) })} />
          </label>
        <label>
          <AdminFieldLabel label="Путь / ID изображения" hint="Ссылка на изображение или ID загруженной картинки, которое будет использоваться в интерфейсе." />
          <input value={draft.imagePath ?? ''} onChange={(event) => patch({ imagePath: event.target.value })} />
        </label>
          <label className="zone-editor-checkbox">
            <input type="checkbox" checked={draft.isEnabled} onChange={(event) => patch({ isEnabled: event.target.checked })} />
            <AdminFieldLabel label="Включён" hint="Если выключить, предмет останется в базе, но не будет использоваться в игровом контенте." />
          </label>
        </div>

        <AdminImageField
          value={draft.imagePath}
          onChange={(nextValue) => patch({ imagePath: nextValue })}
          onStatus={setStatus}
          presetId="item-icon"
          suggestedName={`${draft.id || draft.name || 'item'}-icon`}
          label="Картинка предмета"
          hint="Загружает иконку предмета и автоматически подгоняет её под единый квадратный размер для магазина, инвентаря и слотов."
        />

        <div className="admin-stat-grid">
          <h4 title="Минимальные характеристики, которые нужны, чтобы экипировать или использовать предмет.">Требования</h4>
          {STAT_KEYS.map((key) => (
            <label key={`required-${key}`}>
              <AdminFieldLabel label={translateStatKey(key)} hint={`Минимальное значение характеристики "${translateStatKey(key)}", которое требуется для использования или экипировки предмета.`} />
              <input type="number" value={draft.requiredStats?.[key] ?? ''} onChange={(event) => patchStatBucket('requiredStats', key, event.target.value)} />
            </label>
          ))}
        </div>

        <div className="admin-stat-grid">
          <h4 title="Бонусы, которые предмет даёт персонажу, пока надет или активен.">Бонусы</h4>
          {STAT_KEYS.map((key) => (
            <label key={`bonus-${key}`}>
              <AdminFieldLabel label={translateStatKey(key)} hint={`Прибавка к характеристике "${translateStatKey(key)}", которую предмет даёт персонажу.`} />
              <input type="number" value={draft.bonuses?.[key] ?? ''} onChange={(event) => patchStatBucket('bonuses', key, event.target.value)} />
            </label>
          ))}
        </div>

        <label>
          <AdminFieldLabel label="Игровое описание" hint="Краткое описание эффекта предмета для игрока: что делает, какие бонусы даёт, зачем нужен." />
          <textarea rows={3} value={draft.gameplayDescription} onChange={(event) => patch({ gameplayDescription: event.target.value })} />
        </label>
        <label>
          <AdminFieldLabel label="Лор / описание мира" hint="Художественное описание предмета: происхождение, легенда, атмосфера." />
          <textarea rows={3} value={draft.loreDescription} onChange={(event) => patch({ loreDescription: event.target.value })} />
        </label>

        <div className="admin-actions-row">
          <button disabled={isSaving} onClick={() => { void createOrUpdate(); }}>{isSaving ? 'Сохранение...' : (selectedId ? 'Сохранить' : 'Создать')}</button>
          <button disabled={!selectedId} onClick={() => { void duplicateSelected(); }}>Дублировать</button>
          <button disabled={!selectedId} onClick={() => { void disableSelected(); }}>Отключить</button>
          <button disabled={!selectedId} onClick={() => { void deleteSelected(); }}>Удалить</button>
        </div>

        <AdminSaveStatus value={saveState} />

        <section className="card admin-item-preview">
          <div className="admin-item-preview-layout">
            <div className="admin-item-preview-icon-shell" aria-hidden="true">
              {draftImageSrc ? (
                <img className="admin-item-preview-icon" src={draftImageSrc} alt={draft.name || 'preview'} />
              ) : (
                <div className="admin-item-preview-icon admin-item-preview-icon-fallback">
                  {draftPreviewLabel}
                </div>
              )}
            </div>
          </div>
          <h4>Предпросмотр предмета</h4>
          {draft.imagePath ? <p className="muted">Иконка: {draft.imagePath}</p> : null}
          <p><strong>{draft.name || '(без названия)'}</strong> ({draft.id || 'ID ещё не задан'})</p>
          <p>{translateItemType(draft.type)} / {draft.subtype || 'без подтипа'} / {translateRarity(draft.rarity)}</p>
          <p>Цена: {draft.price}</p>
          <p>{draft.gameplayDescription || 'Игровое описание пока не заполнено.'}</p>
          <p className="muted">{draft.loreDescription || 'Лоровое описание пока не заполнено.'}</p>
        </section>

        <p className="muted">{status}</p>
      </section>

      <section className="admin-items-catalog card">
        <div className="admin-catalog-header">
          <div>
            <p className="admin-catalog-kicker">Asset Library</p>
            <h3>Все предметы</h3>
            <p className="muted">Режим как в проводнике Windows: обычные значки. Нажми на иконку предмета, чтобы снова редактировать его выше.</p>
          </div>
          <div className="admin-catalog-metrics">
            <span>{visibleItems.length} в выдаче</span>
            <span>{items.filter((item) => item.isEnabled).length} активных</span>
          </div>
        </div>

        <div className="admin-list-tools admin-catalog-toolbar">
          <input placeholder="Поиск по ID или названию" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | ItemType)}>
            <option value="all">Все типы</option>
            {ITEM_TYPES.map((type) => <option key={type} value={type}>{translateItemType(type)}</option>)}
          </select>
          <select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value as 'all' | ItemRarity)}>
            <option value="all">Любая редкость</option>
            {RARITIES.map((rarity) => <option key={rarity} value={rarity}>{translateRarity(rarity)}</option>)}
          </select>
          <button onClick={() => { setSelectedId(null); setDraft(emptyItem()); setRangePanelOpen(false); }}>Новый предмет</button>
        </div>

        {selectedItem ? (
          <section className="admin-items-selected-row">
            <strong>Сейчас редактируется:</strong>
            <span>{selectedItem.name} ({selectedItem.id})</span>
          </section>
        ) : null}

        <div className="admin-items-icons-grid">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              className={`admin-item-icon-card ${selectedId === item.id ? 'is-active' : ''}`}
              onClick={() => select(item)}
              title={`${item.name} (${item.id})`}
            >
              <div className={`admin-catalog-thumb admin-catalog-thumb-lg ${getItemCardAccent(item)}`}>
                {resolveItemImage(item) ? <img src={resolveItemImage(item)} alt={item.name} /> : (item.name.trim() || item.type).charAt(0).toUpperCase()}
              </div>
              <strong>{item.name || '(без названия)'}</strong>
              <span>{item.id || 'ID ещё не задан'}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
