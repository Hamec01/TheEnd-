import { useMemo } from 'react';
import type { InventoryState } from '@theend/rpg-domain';
import type { AdminItem, CraftingRecipe, Material, StoredImage } from '../../services/content/models';
import { normalizeGameImageRef } from '../../services/content/gameImageRefs';
import { GameImageView } from '../../admin/components/GameImageView';
import { normalizeMaterialLikeId, readPlayerMaterialQuantities } from './blacksmithRecipeMaterials';

interface BlacksmithInventoryTabProps {
  selectedRecipe: CraftingRecipe | null;
  materials: Material[];
  items: AdminItem[];
  runtimeImages: StoredImage[];
  inventory: InventoryState;
  inventoryRevision: number;
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

export function BlacksmithInventoryTab({
  selectedRecipe,
  materials,
  items,
  runtimeImages,
  inventory,
  inventoryRevision,
}: BlacksmithInventoryTabProps) {
  const materialsById = useMemo(() => new Map(materials.map((entry) => [entry.id, entry])), [materials]);
  const itemsById = useMemo(() => new Map(items.map((entry) => [entry.id, entry])), [items]);

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
      `}</style>
    </div>
  );
}
