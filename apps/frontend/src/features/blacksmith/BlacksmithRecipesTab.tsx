import { useMemo } from 'react';
import type {
  AdminItem,
  CraftingRecipe,
  Material,
  RecipeVisualProfile,
  StoredImage,
} from '../../services/content/models';
import { normalizeGameImageRef, resolveGameImageRefSource } from '../../services/content/gameImageRefs';
import { GameImageView } from '../../admin/components/GameImageView';
import { BLACKSMITH_BUTTON_SOUNDS, playBlacksmithUiSound } from './blacksmithAudio';

interface BlacksmithRecipesTabProps {
  recipes: CraftingRecipe[];
  recipeVisualProfiles: RecipeVisualProfile[];
  materials: Material[];
  items: AdminItem[];
  runtimeImages: StoredImage[];
  selectedRecipe: CraftingRecipe | null;
  selectedRecipeId: string | null;
  onSelectRecipe: (recipeId: string) => void;
}

function getRecipeIngredients(
  recipe: CraftingRecipe,
  materialsById: Map<string, Material>,
  itemsById: Map<string, AdminItem>,
): Array<{ id: string; label: string }> {
  const parts: Array<{ id: string; label: string }> = [];
  for (const entry of recipe.inputMaterials ?? []) {
    const material = materialsById.get(entry.materialId);
    parts.push({
      id: `mat:${entry.materialId}`,
      label: `${material?.name ?? 'Материал'} x${entry.quantity}`,
    });
  }
  for (const entry of recipe.inputItems ?? []) {
    const item = itemsById.get(entry.itemId);
    parts.push({
      id: `item:${entry.itemId}`,
      label: `${item?.name ?? 'Предмет'} x${entry.quantity}`,
    });
  }
  return parts;
}

function resolveRecipeCover(
  recipe: CraftingRecipe,
  profile: RecipeVisualProfile | null,
  runtimeImages: StoredImage[],
): string | undefined {
  return resolveGameImageRefSource(
    normalizeGameImageRef(recipe.visualImageRef, profile?.coverImageRef),
    runtimeImages,
  );
}

function resolveRecipeIcon(
  recipe: CraftingRecipe,
  profile: RecipeVisualProfile | null,
  materialsById: Map<string, Material>,
  itemsById: Map<string, AdminItem>,
): { imageRef?: ReturnType<typeof normalizeGameImageRef>; legacyImagePath?: string } {
  const probeIds = [
    recipe.outputItems?.[0]?.itemId,
    recipe.outputMaterials?.[0]?.materialId,
    recipe.inputItems?.[0]?.itemId,
    recipe.inputMaterials?.[0]?.materialId,
  ].filter(Boolean) as string[];

  for (const probe of probeIds) {
    const candidates = Array.from(new Set([
      probe,
      probe.replace(/^item_/, ''),
      probe.replace(/^mat_/, ''),
      `item_${probe.replace(/^item_|^mat_/, '')}`,
      `mat_${probe.replace(/^item_|^mat_/, '')}`,
    ]));
    for (const candidate of candidates) {
      const material = materialsById.get(candidate);
      if (material) {
        const imageRef = normalizeGameImageRef(material.imageRef, material.imagePath ?? material.id);
        if (imageRef) {
          return { imageRef, legacyImagePath: material.imagePath ?? material.id };
        }
      }
      const item = itemsById.get(candidate);
      if (item) {
        const imageRef = normalizeGameImageRef(item.imageRef, item.imagePath ?? item.id);
        if (imageRef) {
          return { imageRef, legacyImagePath: item.imagePath ?? item.id };
        }
      }
    }
  }

  const imageRef = normalizeGameImageRef(recipe.visualIconRef, profile?.iconImageRef);
  return {
    imageRef: imageRef ?? undefined,
    legacyImagePath: recipe.visualIconRef ?? profile?.iconImageRef ?? undefined,
  };
}

export function BlacksmithRecipesTab({
  recipes,
  recipeVisualProfiles,
  materials,
  items,
  runtimeImages,
  selectedRecipe,
  selectedRecipeId,
  onSelectRecipe,
}: BlacksmithRecipesTabProps) {
  const sortedRecipes = useMemo(
    () => [...recipes].sort((a, b) => (a.requiredProfessionLevel ?? 0) - (b.requiredProfessionLevel ?? 0) || a.name.localeCompare(b.name, 'ru')),
    [recipes],
  );

  const profileById = useMemo(
    () => new Map(recipeVisualProfiles.map((entry) => [entry.id, entry])),
    [recipeVisualProfiles],
  );
  const materialsById = useMemo(() => new Map(materials.map((entry) => [entry.id, entry])), [materials]);
  const itemsById = useMemo(() => new Map(items.map((entry) => [entry.id, entry])), [items]);

  const selectedIngredients = useMemo(
    () => selectedRecipe ? getRecipeIngredients(selectedRecipe, materialsById, itemsById) : [],
    [itemsById, materialsById, selectedRecipe],
  );

  return (
    <div className="blacksmith-recipes-layout">
      {selectedRecipe ? (
        <section className="blacksmith-recipe-selected-panel">
          <div>
            <p className="blacksmith-recipe-selected-kicker">Выбранный рецепт</p>
            <strong>{selectedRecipe.name}</strong>
            <p className="wm-stat-hint" style={{ margin: '4px 0 0' }}>
              Уровень кузнеца: {selectedRecipe.requiredProfessionLevel ?? 1} · Шанс успеха: {selectedRecipe.successChance ?? 100}% · Станция: {selectedRecipe.stationType ?? 'forge'}
            </p>
          </div>
          <div className="blacksmith-recipe-selected-ingredients">
            {selectedIngredients.map((entry) => (
              <span key={entry.id}>{entry.label}</span>
            ))}
          </div>
        </section>
      ) : (
        <p className="wm-stat-hint" style={{ margin: 0 }}>
          Выберите рецепт: после выбора он раскроется сверху и станет доступен в кузне.
        </p>
      )}

      <div className="blacksmith-recipes-grid">
        {sortedRecipes.length === 0 ? <p className="wm-stat-hint">Нет активных рецептов кузнеца.</p> : null}
        {sortedRecipes.map((recipe) => {
          const profile = recipe.visualProfileId ? profileById.get(recipe.visualProfileId) ?? null : null;
          const coverRef = resolveRecipeCover(recipe, profile, runtimeImages);
          const iconMeta = resolveRecipeIcon(recipe, profile, materialsById, itemsById);
          const ingredients = getRecipeIngredients(recipe, materialsById, itemsById);
          const isSelected = selectedRecipeId === recipe.id;

          return (
            <article
              key={recipe.id}
              className={`blacksmith-recipe-card ${isSelected ? 'is-selected' : ''}`}
            >
              <button
                type="button"
                className="blacksmith-recipe-card-hitbox"
                onClick={() => {
                  playBlacksmithUiSound(BLACKSMITH_BUTTON_SOUNDS.selectRecipe);
                  onSelectRecipe(recipe.id);
                }}
                title={`Выбрать рецепт: ${recipe.name}`}
              >
                <div className="blacksmith-recipe-card-cover">
                  {coverRef ? (
                    <img src={coverRef} alt={recipe.name} />
                  ) : (
                    <div className="blacksmith-recipe-card-cover-fallback">Кузнечный рецепт</div>
                  )}
                  <div className="blacksmith-recipe-card-overlay">
                    <div>
                      <strong>{recipe.name}</strong>
                      <p>
                        {recipe.recipeType} · Ур. {recipe.requiredProfessionLevel ?? 1}
                      </p>
                    </div>
                    <div className="blacksmith-recipe-card-icon-wrap">
                      <GameImageView
                        imageRef={iconMeta.imageRef}
                        legacyImagePath={iconMeta.legacyImagePath}
                        runtimeImages={runtimeImages}
                        alt={`${recipe.name} icon`}
                        size={44}
                        fallbackText={(recipe.name.trim().charAt(0) || 'Р').toUpperCase()}
                      />
                    </div>
                  </div>
                </div>

                <div className="blacksmith-recipe-card-body">
                  <div className="blacksmith-recipe-badges">
                    <span>{recipe.recipeType}</span>
                    <span>{recipe.visualStyle ?? profile?.backgroundStyle ?? 'forging'}</span>
                    <span>{recipe.visualMaterialFamily ?? profile?.materialFamilies?.[0] ?? 'metal'}</span>
                  </div>

                  <div className="blacksmith-recipe-ingredients">
                    {ingredients.slice(0, 3).map((entry) => (
                      <span key={entry.id}>{entry.label}</span>
                    ))}
                    {ingredients.length > 3 ? <span>+ ещё {ingredients.length - 3}</span> : null}
                  </div>

                  <div className="blacksmith-recipe-card-footer">
                    <span className="wm-stat-hint">Шанс {recipe.successChance ?? 100}%</span>
                    <span className="blacksmith-recipe-card-cta">{isSelected ? 'Выбран' : 'Выбрать'}</span>
                  </div>
                </div>
              </button>
            </article>
          );
        })}
      </div>

      <style>{`
        .blacksmith-recipes-layout {
          display: grid;
          gap: 12px;
          min-height: 0;
          align-content: start;
        }
        .blacksmith-recipe-selected-panel {
          position: sticky;
          top: 0;
          z-index: 2;
          border: 1px solid rgba(184, 153, 111, 0.34);
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(46, 31, 22, 0.92), rgba(21, 16, 13, 0.96));
          padding: 12px;
          display: grid;
          gap: 10px;
        }
        .blacksmith-recipe-selected-kicker {
          margin: 0 0 4px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 0.72rem;
          color: #c7a977;
        }
        .blacksmith-recipe-selected-ingredients {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .blacksmith-recipe-selected-ingredients span {
          font-size: 0.76rem;
          color: #e0cfb2;
          border: 1px solid rgba(171, 142, 104, 0.34);
          border-radius: 999px;
          background: rgba(56, 40, 28, 0.76);
          padding: 4px 9px;
        }
        .blacksmith-recipes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
        .blacksmith-recipe-card {
          border: 1px solid rgba(164, 141, 110, 0.26);
          border-radius: 12px;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(38, 28, 22, 0.9), rgba(16, 12, 10, 0.98));
        }
        .blacksmith-recipe-card.is-selected {
          border-color: rgba(239, 185, 120, 0.78);
          box-shadow: 0 0 0 1px rgba(239, 185, 120, 0.34), 0 10px 22px rgba(0, 0, 0, 0.35);
        }
        .blacksmith-recipe-card-hitbox {
          width: 100%;
          display: grid;
          grid-template-rows: 150px auto;
          padding: 0;
          background: transparent;
          border: 0;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }
        .blacksmith-recipe-card-cover {
          position: relative;
          overflow: hidden;
          background: rgba(12, 10, 8, 0.95);
        }
        .blacksmith-recipe-card-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .blacksmith-recipe-card-cover-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #d7c2a4;
          background: radial-gradient(circle at 30% 20%, rgba(201, 126, 67, 0.25), rgba(26, 20, 16, 0.9));
          font-weight: 600;
          letter-spacing: 0.03em;
        }
        .blacksmith-recipe-card-overlay {
          position: absolute;
          inset: auto 0 0 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: end;
          padding: 12px;
          background: linear-gradient(180deg, rgba(9, 8, 7, 0) 0%, rgba(14, 11, 9, 0.92) 72%, rgba(14, 11, 9, 0.98) 100%);
        }
        .blacksmith-recipe-card-overlay strong {
          display: block;
          font-size: 1rem;
          line-height: 1.12;
          color: #fff3dd;
        }
        .blacksmith-recipe-card-overlay p {
          margin: 3px 0 0;
          font-size: 0.76rem;
          color: #d7c2a4;
        }
        .blacksmith-recipe-card-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .blacksmith-recipe-card-body {
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .blacksmith-recipe-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .blacksmith-recipe-badges span {
          font-size: 0.72rem;
          color: #e6d3b5;
          border: 1px solid rgba(167, 142, 106, 0.35);
          border-radius: 999px;
          padding: 2px 8px;
          background: rgba(49, 37, 28, 0.75);
        }
        .blacksmith-recipe-ingredients {
          display: grid;
          gap: 4px;
          font-size: 0.76rem;
          color: #ccb99b;
          min-height: 50px;
        }
        .blacksmith-recipe-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .blacksmith-recipe-card-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 92px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(201, 163, 110, 0.34);
          background: rgba(62, 42, 28, 0.82);
          font-size: 0.78rem;
          color: #f0dcc0;
        }
      `}</style>
    </div>
  );
}
