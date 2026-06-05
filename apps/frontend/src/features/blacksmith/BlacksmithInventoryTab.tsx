import { useMemo, useState } from 'react';
import type { InventoryState } from '@theend/rpg-domain';
import type { AdminItem, BlacksmithItemWorkAction, CraftingRecipe, Material, StoredImage } from '../../services/content/models';
import { normalizeGameImageRef } from '../../services/content/gameImageRefs';
import { GameImageView } from '../../admin/components/GameImageView';
import { getFallbackBlacksmithItemWorkActions } from '../../services/content/runtimeContentService';
import { normalizeMaterialLikeId, readPlayerMaterialQuantities } from './blacksmithRecipeMaterials';

interface BlacksmithInventoryTabProps {
  selectedRecipe: CraftingRecipe | null;
  materials: Material[];
  items: AdminItem[];
  itemWorkActions?: BlacksmithItemWorkAction[];
  runtimeImages: StoredImage[];
  inventory: InventoryState;
  inventoryRevision: number;
  onPrepareItemWork?: (payload: { item: AdminItem; action: BlacksmithItemWorkAction }) => void;
}

interface InventoryRow {
  id: string;
  catalogId: string;
  name: string;
  imageRef?: ReturnType<typeof normalizeGameImageRef>;
  legacyImagePath?: string;
  source: 'material' | 'item' | 'unknown';
  quantity: number;
  requiredByRecipe?: number;
}

function looksRelevantToSmithing(id: string): boolean {
  const probe = id.toLowerCase();
  return [
    'ore', 'ingot', 'plate', 'bloom', 'coal', 'wood', 'timber', 'leather',
    'chain', 'rivet', 'blank', 'tools', 'gear', 'ash', 'oil', 'salt', 'core',
    'crystal', 'metal', 'steel', 'iron', 'bronze', 'silver', 'gold',
  ].some((token) => probe.includes(token));
}

function itemCoreStats(item: AdminItem): string[] {
  const parts: string[] = [];
  if (typeof item.damageMin === 'number' || typeof item.damageMax === 'number') {
    parts.push(`Урон: ${item.damageMin ?? 0}-${item.damageMax ?? item.damageMin ?? 0}`);
  }
  if (typeof item.armorValue === 'number') {
    parts.push(`Броня: ${item.armorValue}`);
  }
  parts.push(`Слоты: ${item.augmentSlots?.length ?? 0}/${item.maxAugmentSlots ?? item.augmentSlots?.length ?? 0}`);
  return parts;
}

function itemWorkPreview(item: AdminItem | null, action: BlacksmithItemWorkAction | null): string[] {
  if (!item || !action) {
    return [];
  }
  if (action.actionType === 'improve_stats' || action.actionType === 'reinforce') {
    return typeof item.armorValue === 'number'
      ? ['Броня предмета вырастет примерно на 5% ... 15% при удачной работе.']
      : ['Урон предмета вырастет примерно на 5% ... 15% при удачной работе.'];
  }
  if (action.actionType === 'add_socket') {
    return [`Попытка добавить слот: ${(item.augmentSlots?.length ?? 0)} -> ${Math.min((item.augmentSlots?.length ?? 0) + 1, item.maxAugmentSlots ?? (item.augmentSlots?.length ?? 0) + 1)}.`];
  }
  if (action.actionType === 'temporary_buff') {
    return ['Предмет получит временный кузнечный бафф.'];
  }
  if (action.actionType === 'dismantle') {
    return ['Предмет будет разобран, а часть материалов вернётся в инвентарь.'];
  }
  return [];
}

export function BlacksmithInventoryTab({
  selectedRecipe,
  materials,
  items,
  itemWorkActions = [],
  runtimeImages,
  inventory,
  inventoryRevision,
  onPrepareItemWork,
}: BlacksmithInventoryTabProps) {
  const effectiveItemWorkActions = useMemo(
    () => (itemWorkActions.length > 0 ? itemWorkActions : getFallbackBlacksmithItemWorkActions()),
    [itemWorkActions],
  );
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string>('');
  const [selectedWorkActionId, setSelectedWorkActionId] = useState<string>('');
  const materialsById = useMemo(() => new Map(materials.map((entry) => [entry.id, entry])), [materials]);
  const itemsById = useMemo(() => new Map(items.map((entry) => [entry.id, entry])), [items]);
  const itemWorkActionsById = useMemo(() => new Map(effectiveItemWorkActions.map((entry) => [entry.id, entry])), [effectiveItemWorkActions]);

  const rows = useMemo<InventoryRow[]>(() => {
    const quantityById = readPlayerMaterialQuantities(inventory);

    const recipeNeeds = new Map<string, number>();
    for (const input of selectedRecipe?.inputMaterials ?? []) {
      for (const candidate of normalizeMaterialLikeId(input.materialId)) {
        recipeNeeds.set(candidate, (recipeNeeds.get(candidate) ?? 0) + Math.max(1, input.quantity ?? 1));
      }
    }
    for (const input of selectedRecipe?.inputItems ?? []) {
      for (const candidate of normalizeMaterialLikeId(input.itemId)) {
        recipeNeeds.set(candidate, (recipeNeeds.get(candidate) ?? 0) + Math.max(1, input.quantity ?? 1));
      }
    }

    return Array.from(quantityById.entries())
      .filter(([id]) => recipeNeeds.has(id) || looksRelevantToSmithing(id))
      .map(([id, quantity]) => {
        const candidates = normalizeMaterialLikeId(id);
        const material = candidates.map((candidate) => materialsById.get(candidate)).find(Boolean) ?? null;
        const item = itemsById.get(id) ?? candidates.map((candidate) => itemsById.get(candidate)).find(Boolean) ?? null;
        const catalogId = material?.id ?? item?.id ?? id;
        const imageRef = normalizeGameImageRef(material?.imageRef ?? item?.imageRef, material?.imagePath ?? item?.imagePath);

        return {
          id,
          catalogId,
          name: material?.name ?? item?.name ?? id,
          imageRef: imageRef ?? undefined,
          legacyImagePath: material?.imagePath ?? item?.imagePath ?? catalogId,
          source: material ? 'material' as const : item ? 'item' as const : 'unknown' as const,
          quantity,
          requiredByRecipe: candidates.reduce((max, candidate) => Math.max(max, recipeNeeds.get(candidate) ?? 0), 0) || undefined,
        };
      })
      .sort((a, b) => (b.requiredByRecipe ?? 0) - (a.requiredByRecipe ?? 0) || b.quantity - a.quantity || a.name.localeCompare(b.name, 'ru'));
  }, [inventory, inventoryRevision, itemsById, materialsById, selectedRecipe]);

  const ownedWorkableItems = useMemo(() => (
    inventory.items
      .map((entry) => ({
        quantity: entry.quantity,
        item: itemsById.get(entry.itemId) ?? null,
      }))
      .filter((entry): entry is { quantity: number; item: AdminItem } => Boolean(entry.item) && (entry.item!.type === 'weapon' || entry.item!.type === 'armor'))
      .sort((a, b) => a.item.name.localeCompare(b.item.name, 'ru'))
  ), [inventory.items, itemsById]);

  const selectedWorkItem = selectedWorkItemId ? itemsById.get(selectedWorkItemId) ?? null : null;
  const filteredActions = useMemo(() => {
    if (!selectedWorkItem) {
      return effectiveItemWorkActions;
    }
    return effectiveItemWorkActions.filter((action) =>
      action.allowedItemTypes.includes(selectedWorkItem.type)
      && (!action.allowedSubtypes?.length || action.allowedSubtypes.includes(selectedWorkItem.subtype ?? '')),
    );
  }, [effectiveItemWorkActions, selectedWorkItem]);
  const selectedWorkAction = selectedWorkActionId ? itemWorkActionsById.get(selectedWorkActionId) ?? null : null;
  const selectedWorkStats = useMemo(() => (selectedWorkItem ? itemCoreStats(selectedWorkItem) : []), [selectedWorkItem]);
  const selectedWorkPreview = useMemo(() => itemWorkPreview(selectedWorkItem, selectedWorkAction), [selectedWorkAction, selectedWorkItem]);

  return (
    <div className="blacksmith-inventory-grid">
      {selectedRecipe ? (
        <p className="wm-stat-hint" style={{ margin: 0 }}>
          Фильтр по рецепту: {selectedRecipe.name}
        </p>
      ) : (
        <p className="wm-stat-hint" style={{ margin: 0 }}>
          Показываются кузнечные материалы и компоненты из инвентаря игрока.
        </p>
      )}
      {rows.length === 0 ? <p className="wm-stat-hint">Подходящие материалы не найдены.</p> : null}
      {rows.map((entry) => (
        <article key={entry.id} className={`blacksmith-inventory-item ${entry.requiredByRecipe ? 'is-required' : ''}`}>
          <div className="blacksmith-inventory-icon">
            <GameImageView
              imageRef={entry.imageRef}
              legacyImagePath={entry.legacyImagePath}
              runtimeImages={runtimeImages}
              alt={entry.name}
              size={52}
              fit="contain"
              fallbackText={(entry.name.trim().charAt(0) || '?').toUpperCase()}
            />
          </div>
          <div className="blacksmith-inventory-copy">
            <strong>{entry.name}</strong>
            <p className="wm-stat-hint" style={{ margin: 0 }}>В наличии: {entry.quantity}</p>
            {entry.requiredByRecipe ? (
              <p className="wm-stat-hint" style={{ margin: 0 }}>
                Нужно по рецепту: {entry.requiredByRecipe} ({entry.quantity >= entry.requiredByRecipe ? 'достаточно' : 'не хватает'})
              </p>
            ) : null}
          </div>
        </article>
      ))}
      {onPrepareItemWork ? (
        <section className="blacksmith-item-work-card">
          <strong>Работа с предметом</strong>
          <label className="blacksmith-item-work-field">
            <span>Предмет из инвентаря</span>
            <select value={selectedWorkItemId} onChange={(event) => {
              const nextItemId = event.target.value;
              setSelectedWorkItemId(nextItemId);
              setSelectedWorkActionId('');
            }}>
              <option value="">Выберите предмет</option>
              {ownedWorkableItems.map(({ item, quantity }) => (
                <option key={item.id} value={item.id}>
                  {item.name} ×{quantity}
                </option>
              ))}
            </select>
          </label>
          <label className="blacksmith-item-work-field">
            <span>Кузнечная операция</span>
            <select value={selectedWorkActionId} onChange={(event) => setSelectedWorkActionId(event.target.value)}>
              <option value="">Выберите действие</option>
              {filteredActions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.name}
                </option>
              ))}
            </select>
          </label>
          {selectedWorkItem ? (
            <div className="blacksmith-item-work-preview">
              <strong>Текущий предмет</strong>
              <div className="blacksmith-item-work-stat-list">
                {selectedWorkStats.map((entry) => <span key={entry}>{entry}</span>)}
              </div>
              {selectedWorkAction ? (
                <>
                  <p className="wm-stat-hint" style={{ margin: 0 }}>
                    {selectedWorkAction.description || `Сложность ${selectedWorkAction.baseDifficulty} · риск ${selectedWorkAction.risk}`}
                  </p>
                  {selectedWorkPreview.length > 0 ? (
                    <div className="blacksmith-item-work-delta-list">
                      {selectedWorkPreview.map((entry) => <span key={entry}>{entry}</span>)}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="wm-stat-hint" style={{ margin: 0 }}>
                  Выберите кузнечную операцию, и здесь появится прогноз изменений.
                </p>
              )}
            </div>
          ) : null}
          <button
            type="button"
            disabled={!selectedWorkItem || !selectedWorkAction}
            onClick={() => {
              if (!selectedWorkItem || !selectedWorkAction) {
                return;
              }
              onPrepareItemWork({ item: selectedWorkItem, action: selectedWorkAction });
            }}
          >
            Подготовить работу с предметом
          </button>
        </section>
      ) : null}
      <style>{`
        .blacksmith-inventory-grid {
          display: grid;
          gap: 8px;
        }
        .blacksmith-inventory-item {
          border: 1px solid rgba(164, 141, 110, 0.24);
          border-radius: 10px;
          background: rgba(24, 20, 15, 0.84);
          padding: 8px;
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }
        .blacksmith-inventory-item.is-required {
          border-color: rgba(224, 179, 108, 0.5);
          box-shadow: inset 0 0 0 1px rgba(224, 179, 108, 0.18);
        }
        .blacksmith-inventory-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .blacksmith-inventory-copy {
          min-width: 0;
        }
        .blacksmith-item-work-card {
          border: 1px solid rgba(164, 141, 110, 0.24);
          border-radius: 10px;
          background: rgba(24, 20, 15, 0.84);
          padding: 10px;
          display: grid;
          gap: 10px;
        }
        .blacksmith-item-work-field {
          display: grid;
          gap: 6px;
        }
        .blacksmith-item-work-field span {
          font-size: 0.82rem;
          color: #d7c3a2;
        }
        .blacksmith-item-work-preview {
          display: grid;
          gap: 8px;
          border: 1px solid rgba(164, 141, 110, 0.2);
          border-radius: 10px;
          background: rgba(34, 25, 18, 0.74);
          padding: 10px;
        }
        .blacksmith-item-work-stat-list,
        .blacksmith-item-work-delta-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .blacksmith-item-work-stat-list span,
        .blacksmith-item-work-delta-list span {
          border: 1px solid rgba(164, 141, 110, 0.28);
          border-radius: 999px;
          background: rgba(61, 45, 31, 0.78);
          padding: 4px 8px;
          font-size: 0.78rem;
          color: #efe1c7;
        }
        .blacksmith-item-work-delta-list span {
          border-color: rgba(224, 179, 108, 0.36);
          background: rgba(77, 54, 32, 0.82);
        }
      `}</style>
    </div>
  );
}
