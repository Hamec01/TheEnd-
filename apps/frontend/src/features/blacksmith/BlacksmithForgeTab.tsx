import { useEffect, useMemo, useRef } from 'react';
import {
  applyBlacksmithAction,
  computeBlacksmithXpReward,
  createBlacksmithSession,
  finalizeBlacksmithScore,
  type BlacksmithSessionBonuses,
  type BlacksmithSessionState,
} from '@theend/rpg-domain';
import type {
  BlacksmithBalance,
  BlacksmithForgeTier,
  BlacksmithModule,
  BlacksmithQualityTier,
  BlacksmithTool,
  CraftingRecipe,
  Material,
  RecipeVisualProfile,
  AdminItem,
  StoredImage,
} from '../../services/content/models';
import { normalizeGameImageRef } from '../../services/content/gameImageRefs';
import type { BlacksmithSkillBonuses } from './blacksmithSkillEffects';
import { GameImageView } from '../../admin/components/GameImageView';
import { BLACKSMITH_BUTTON_SOUNDS, BLACKSMITH_MUSIC_TRACKS, playBlacksmithUiSound } from './blacksmithAudio';
import { loadWorldAudioSettings } from '../../worldmap/worldAudioSettings';
import {
  canAffordRecipeMaterials,
  canAffordRecipeMaterialsWithInventory,
  consumeRecipeMaterials,
  getRecipeMaterialShortages,
} from './blacksmithRecipeMaterials';
import type { InventoryState } from '@theend/rpg-domain';

interface BlacksmithForgeTabProps {
  selectedRecipe: CraftingRecipe | null;
  session: BlacksmithSessionState | null;
  forgeTiers: BlacksmithForgeTier[];
  modules: BlacksmithModule[];
  tools: BlacksmithTool[];
  qualityTiers: BlacksmithQualityTier[];
  balance: BlacksmithBalance | null;
  recipeVisualProfiles: RecipeVisualProfile[];
  materials: Material[];
  items: AdminItem[];
  runtimeImages: StoredImage[];
  inventory: InventoryState;
  inventoryRevision: number;
  resolveImageRef: (value?: string) => string | undefined;
  skillBonuses: BlacksmithSkillBonuses;
  onSessionChange: (next: BlacksmithSessionState | null) => void;
  onInventoryChange: (next: InventoryState) => void;
  onComplete: (payload: { xp: number; score: number; qualityTierId: string; success: boolean }) => void | Promise<void>;
}

const OBJECT_SHEET_SRC = '/art/blacksmith/objects/blacksmith_forge_objects_sheet_384.png';
const OBJECT_FRAME_SIZE = 384;
const OBJECT_SHEET_COLUMNS = 4;
const TOOL_SHEET_ID = 'blacksmith_workshop_tools_256';
const TOOL_FRAMES = {
  hammer: 0,
  anvil: 4,
  forge: 7,
  tongs: 10,
  gauge: 12,
} as const;

const MATERIAL_FRAME_MATCHERS: Array<{ includes: string[]; frame: number }> = [
  { includes: ['iron'], frame: 0 },
  { includes: ['steel'], frame: 1 },
  { includes: ['bronze'], frame: 2 },
  { includes: ['silver'], frame: 3 },
  { includes: ['gold'], frame: 4 },
  { includes: ['felandar'], frame: 5 },
  { includes: ['mythic'], frame: 6 },
  { includes: ['blade'], frame: 7 },
  { includes: ['axe'], frame: 8 },
  { includes: ['spear'], frame: 9 },
  { includes: ['helmet'], frame: 10 },
  { includes: ['chest', 'armor'], frame: 11 },
  { includes: ['shield'], frame: 12 },
  { includes: ['plate'], frame: 13 },
  { includes: ['chain'], frame: 14 },
];

function resolveBonuses(
  forgeTiers: BlacksmithForgeTier[],
  modules: BlacksmithModule[],
  tools: BlacksmithTool[],
  skillBonuses: BlacksmithSkillBonuses,
): BlacksmithSessionBonuses {
  const activeTier = [...forgeTiers].sort((a, b) => b.tier - a.tier)[0];
  const activeModules = modules.filter((entry) => entry.isEnabled);
  const activeTools = tools.filter((entry) => entry.isEnabled);

  const moduleBonus = activeModules.reduce((sum, entry) => sum + Number(entry.bonuses.heatControlBonus ?? 0), 0);
  const toolPrecision = activeTools.reduce((sum, entry) => sum + Number(entry.bonuses.strikePrecisionBonus ?? 0), 0);
  const quenchBonus = activeTools.reduce((sum, entry) => sum + Number(entry.bonuses.quenchControlBonus ?? 0), 0);
  const defectReduction = activeModules.reduce((sum, entry) => sum + Number(entry.bonuses.defectChanceReduction ?? 0), 0);
  const minFloor = activeTools.reduce((sum, entry) => Math.max(sum, Number(entry.minResultFloor ?? 0)), 0);

  return {
    heatControlBonus: (activeTier?.heatControlBonus ?? 0) + moduleBonus + skillBonuses.heatControlBonus,
    strikePrecisionBonus: toolPrecision + skillBonuses.strikePrecisionBonus,
    quenchControlBonus: quenchBonus + skillBonuses.quenchControlBonus,
    defectChanceReduction: (activeTier?.failureChanceReduction ?? 0) + defectReduction + skillBonuses.failureChanceReduction,
    qualityBonus: (activeTier?.qualityCapBonus ?? 0) + skillBonuses.qualityBonus,
    failureChanceReduction: (activeTier?.failureChanceReduction ?? 0) + skillBonuses.failureChanceReduction,
    minResultFloor: Math.max(minFloor, skillBonuses.minResultFloor),
  };
}

function resolveQualityTier(score: number, qualityTiers: BlacksmithQualityTier[]): BlacksmithQualityTier | null {
  return qualityTiers.find((entry) => score >= entry.minScore && score <= entry.maxScore) ?? null;
}

function heatLabel(heat: number): string {
  if (heat < 45) {
    return 'Холодно';
  }
  if (heat <= 75) {
    return 'Оптимум';
  }
  return 'Перегрев';
}

function mapStageLabel(stage: BlacksmithSessionState['stage']): string {
  switch (stage) {
    case 'prep':
      return 'Подготовка';
    case 'heat':
      return 'Нагрев';
    case 'strike':
      return 'Формовка';
    case 'quench':
      return 'Закалка';
    case 'finish':
      return 'Финиш';
    case 'completed':
      return 'Завершено';
    default:
      return stage;
  }
}

function resolveObjectFrame(selectedRecipe: CraftingRecipe | null, materialsById: Map<string, Material>, itemsById: Map<string, AdminItem>): number {
  if (!selectedRecipe) {
    return 15;
  }
  const outputItemId = selectedRecipe.outputItems?.[0]?.itemId?.toLowerCase() ?? '';
  const outputMaterialId = selectedRecipe.outputMaterials?.[0]?.materialId?.toLowerCase() ?? '';
  const outputItemName = (selectedRecipe.outputItems?.[0]?.itemId ? itemsById.get(selectedRecipe.outputItems[0].itemId)?.name : '')?.toLowerCase() ?? '';
  const outputMaterialName = (selectedRecipe.outputMaterials?.[0]?.materialId ? materialsById.get(selectedRecipe.outputMaterials[0].materialId)?.name : '')?.toLowerCase() ?? '';
  const haystack = [outputItemId, outputMaterialId, outputItemName, outputMaterialName, selectedRecipe.name.toLowerCase()].join(' ');

  for (const matcher of MATERIAL_FRAME_MATCHERS) {
    if (matcher.includes.some((entry) => haystack.includes(entry))) {
      return matcher.frame;
    }
  }
  return 15;
}

function normalizeMaterialLikeId(id: string | undefined): string[] {
  const probe = String(id ?? '').trim();
  if (!probe) {
    return [];
  }
  const strippedItem = probe.replace(/^item_/, '');
  const strippedMaterial = probe.replace(/^mat_/, '');
  const base = strippedItem.replace(/^mat_/, '') || strippedMaterial.replace(/^item_/, '') || probe;
  return Array.from(new Set([
    probe,
    strippedItem,
    strippedMaterial,
    base,
    `item_${base}`,
    `mat_${base}`,
  ])).filter(Boolean);
}

function resolveImageCandidate(
  id: string | undefined,
  materialsById: Map<string, Material>,
  itemsById: Map<string, AdminItem>,
): { imageRef?: ReturnType<typeof normalizeGameImageRef>; legacyImagePath?: string } | null {
  const candidateIds = normalizeMaterialLikeId(id);
  for (const candidate of candidateIds) {
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

  return null;
}

function qualityClass(score: number, isFailure: boolean): string {
  if (isFailure) {
    return 'quality-broken';
  }
  if (score < 30) {
    return 'quality-crude';
  }
  if (score < 50) {
    return 'quality-normal';
  }
  if (score < 70) {
    return 'quality-good';
  }
  if (score < 85) {
    return 'quality-excellent';
  }
  if (score < 97) {
    return 'quality-masterwork';
  }
  return 'quality-legendary';
}

function frameStyle(sheetSrc: string, frame: number, frameSize: number, columns: number, renderSize: number): React.CSSProperties {
  const safeFrame = Math.max(0, Math.floor(frame));
  const col = safeFrame % columns;
  const row = Math.floor(safeFrame / columns);
  return {
    backgroundImage: `url(${sheetSrc})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `-${col * renderSize}px -${row * renderSize}px`,
    backgroundSize: `${columns * renderSize}px auto`,
  };
}

function makeTilesetRef(sheetId: string, frame: number) {
  return { type: 'tileset' as const, sheetId, frame };
}

export function BlacksmithForgeTab({
  selectedRecipe,
  session,
  forgeTiers,
  modules,
  tools,
  qualityTiers,
  balance,
  recipeVisualProfiles,
  materials,
  items,
  runtimeImages,
  inventory,
  inventoryRevision,
  resolveImageRef,
  skillBonuses,
  onSessionChange,
  onInventoryChange,
  onComplete,
}: BlacksmithForgeTabProps) {
  const bonuses = useMemo(
    () => resolveBonuses(forgeTiers, modules, tools, skillBonuses),
    [forgeTiers, modules, tools, skillBonuses],
  );

  const currentScore = session ? finalizeBlacksmithScore(session, bonuses) : 0;
  const currentQualityTier = resolveQualityTier(currentScore, qualityTiers);
  const materialsById = useMemo(() => new Map(materials.map((entry) => [entry.id, entry])), [materials]);
  const itemsById = useMemo(() => new Map(items.map((entry) => [entry.id, entry])), [items]);
  const profileById = useMemo(() => new Map(recipeVisualProfiles.map((entry) => [entry.id, entry])), [recipeVisualProfiles]);
  const selectedProfile = selectedRecipe?.visualProfileId ? profileById.get(selectedRecipe.visualProfileId) : null;

  const sceneBackgroundSrc = resolveImageRef('/art/blacksmith/scene/forge_background.png');
  const furnaceSrc = resolveImageRef('/art/blacksmith/scene/furnace_ui.png');
  const anvilSrc = resolveImageRef('/art/blacksmith/scene/anvil_ui.png');
  const bellowsSrc = resolveImageRef('/art/blacksmith/scene/bellows_ui.png');
  const quenchVatSrc = resolveImageRef('/art/blacksmith/scene/quench_vat_ui.png');
  const forgeGlowSrc = resolveImageRef('/art/blacksmith/effects/forge_glow.png');
  const embersSrc = resolveImageRef('/art/blacksmith/effects/embers_overlay.png');
  const sparksSrc = resolveImageRef('/art/blacksmith/effects/sparks_overlay.png');
  const smokeSrc = resolveImageRef('/art/blacksmith/effects/smoke_overlay.png');
  const crackSmallSrc = resolveImageRef('/art/blacksmith/effects/crack_small.png');
  const crackMediumSrc = resolveImageRef('/art/blacksmith/effects/crack_medium.png');
  const crackCriticalSrc = resolveImageRef('/art/blacksmith/effects/crack_critical.png');
  const impuritySrc = resolveImageRef('/art/blacksmith/effects/impurity.png');
  const overheatedSrc = resolveImageRef('/art/blacksmith/effects/overheated.png');
  const quenchedBadlySrc = resolveImageRef('/art/blacksmith/effects/quenched_badly.png');
  const warpedMetalSrc = resolveImageRef('/art/blacksmith/effects/warped_metal.png');

  const objectFrame = resolveObjectFrame(selectedRecipe, materialsById, itemsById);
  const directCentralObject = selectedRecipe
    ? resolveImageCandidate(
      selectedRecipe.outputMaterials?.[0]?.materialId
        ?? selectedRecipe.outputItems?.[0]?.itemId
        ?? selectedRecipe.inputMaterials?.[0]?.materialId
        ?? selectedRecipe.inputItems?.[0]?.itemId,
      materialsById,
      itemsById,
    )
    : null;
  const qualityToneClass = qualityClass(currentScore, currentQualityTier?.isFailureTier ?? false);
  const defectOverlaySources = useMemo(() => {
    if (!session) {
      return [];
    }

    const overlays: string[] = [];
    if (session.heat > 75 && overheatedSrc) {
      overlays.push(overheatedSrc);
    }
    if (session.stage === 'prep' && session.defectScore > 0 && impuritySrc) {
      overlays.push(impuritySrc);
    }
    if (session.stage === 'quench' && session.defectScore > 0 && quenchedBadlySrc) {
      overlays.push(quenchedBadlySrc);
    }
    if (session.progress >= 14 && session.defectScore >= 2 && warpedMetalSrc) {
      overlays.push(warpedMetalSrc);
    }
    if (session.defectScore >= 1 && crackSmallSrc) {
      overlays.push(crackSmallSrc);
    }
    if (session.defectScore >= 4 && crackMediumSrc) {
      overlays.push(crackMediumSrc);
    }
    if (session.defectScore >= 7 && crackCriticalSrc) {
      overlays.push(crackCriticalSrc);
    }
    return overlays;
  }, [
    crackCriticalSrc,
    crackMediumSrc,
    crackSmallSrc,
    impuritySrc,
    overheatedSrc,
    quenchedBadlySrc,
    session,
    warpedMetalSrc,
  ]);
  const materialShortages = useMemo(
    () => getRecipeMaterialShortages(selectedRecipe, inventory),
    [inventory, inventoryRevision, selectedRecipe],
  );
  const canStartSession = Boolean(selectedRecipe) && materialShortages.length === 0 && !session;
  const musicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audioSettings = loadWorldAudioSettings();
    if (!audioSettings.musicEnabled || BLACKSMITH_MUSIC_TRACKS.length === 0) {
      return undefined;
    }

    const audio = musicRef.current ?? new Audio();
    musicRef.current = audio;
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = Math.max(0, Math.min(1, 0.34 * audioSettings.musicVolume));

    const queue = [...BLACKSMITH_MUSIC_TRACKS].sort(() => Math.random() - 0.5);
    let index = 0;

    const playNext = () => {
      if (index >= queue.length) {
        index = 0;
      }
      const source = queue[index];
      index += 1;
      audio.pause();
      audio.currentTime = 0;
      audio.src = source;
      void audio.play().catch(() => undefined);
    };

    audio.onended = () => playNext();
    audio.onerror = () => playNext();
    playNext();

    return () => {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
    };
  }, []);

  function startSession() {
    if (!selectedRecipe) {
      return;
    }
    if (!canAffordRecipeMaterialsWithInventory(selectedRecipe, inventory)) {
      const firstShortage = getRecipeMaterialShortages(selectedRecipe, inventory)[0];
      if (firstShortage) {
        const label = materialsById.get(firstShortage.catalogId)?.name
          ?? itemsById.get(firstShortage.catalogId)?.name
          ?? firstShortage.catalogId;
        window.alert(`Недостаточно материалов: ${label} (нужно ${firstShortage.required}, есть ${firstShortage.available}).`);
      } else {
        window.alert('Недостаточно материалов для этой ковки.');
      }
      return;
    }
    const consumeResult = consumeRecipeMaterials(selectedRecipe, inventory);
    if (!consumeResult.ok) {
      window.alert('Не удалось списать материалы. Проверьте инвентарь.');
      return;
    }
    if (consumeResult.inventory) {
      onInventoryChange(consumeResult.inventory);
    }
    playBlacksmithUiSound(BLACKSMITH_BUTTON_SOUNDS.startSession);

    const nextSession = createBlacksmithSession(
      {
        recipeId: selectedRecipe.id,
        recipeType: selectedRecipe.recipeType,
        materialTier: 'common',
        baseDifficulty: 45,
      },
      bonuses,
    );
    onSessionChange(nextSession);
  }

  function completeSession(next: BlacksmithSessionState) {
    playBlacksmithUiSound(BLACKSMITH_BUTTON_SOUNDS.takeResult);
    const finalScore = finalizeBlacksmithScore(next, bonuses);
    const qualityTier = resolveQualityTier(finalScore, qualityTiers);
    const tierId = qualityTier?.id ?? 'quality_normal';
    const baseXp = Number(balance?.baseXpByRecipeType?.[next.recipeType] ?? 20);
    const qualityDelta = Number(balance?.qualityBonuses?.[tierId] ?? 0) + Number(balance?.qualityPenalties?.[tierId] ?? 0);
    const xp = computeBlacksmithXpReward({
      baseXp,
      materialTierXp: Number(balance?.xpByMaterialTier?.[next.materialTier ?? 'common'] ?? 0),
      qualityBonus: qualityDelta,
      repeatCraftCount: 0,
      diminishingStartAfter: Number(balance?.repeatCraftDiminishingReturns?.startAfter ?? 3),
      diminishingFloorMultiplier: Number(balance?.repeatCraftDiminishingReturns?.floorMultiplier ?? 0.35),
      diminishingDecayPerCraft: Number(balance?.repeatCraftDiminishingReturns?.decayPerCraft ?? 0.12),
      successBonusPercent: Number(skillBonuses.craftSuccessBonus ?? 0),
      failureReductionPercent: Number(skillBonuses.failureChanceReduction ?? 0),
    });
    void Promise.resolve(onComplete({
      xp,
      score: finalScore,
      qualityTierId: tierId,
      success: !(qualityTier?.isFailureTier ?? false),
    })).finally(() => {
      onSessionChange(null);
    });
  }

  function runAction(action: 'prepare_blank' | 'add_heat' | 'stabilize_heat' | 'light_strike' | 'medium_strike' | 'heavy_strike' | 'quench_water' | 'quench_oil' | 'finish_polish') {
    if (!session) {
      return;
    }
    const soundByAction: Record<typeof action, string> = {
      prepare_blank: BLACKSMITH_BUTTON_SOUNDS.prepare,
      add_heat: BLACKSMITH_BUTTON_SOUNDS.heat,
      stabilize_heat: BLACKSMITH_BUTTON_SOUNDS.stabilize,
      light_strike: BLACKSMITH_BUTTON_SOUNDS.lightStrike,
      medium_strike: BLACKSMITH_BUTTON_SOUNDS.mediumStrike,
      heavy_strike: BLACKSMITH_BUTTON_SOUNDS.heavyStrike,
      quench_water: BLACKSMITH_BUTTON_SOUNDS.quenchWater,
      quench_oil: BLACKSMITH_BUTTON_SOUNDS.quenchOil,
      finish_polish: BLACKSMITH_BUTTON_SOUNDS.finish,
    };
    playBlacksmithUiSound(soundByAction[action]);
    const next = applyBlacksmithAction(session, action, bonuses).state;
    onSessionChange(next);
  }

  return (
    <div className="blacksmith-forge-layout">
      {!selectedRecipe ? <p className="wm-stat-hint">Сначала выберите рецепт во вкладке "Рецепты".</p> : null}
      {selectedRecipe ? (
        <article className="blacksmith-recipe-focus-card">
          <div className="blacksmith-recipe-focus-main">
            <div>
              <strong>{selectedRecipe.name}</strong>
              <p className="wm-stat-hint" style={{ margin: 0 }}>
                Тип: {selectedRecipe.recipeType} · Шанс: {selectedRecipe.successChance ?? 100}%
              </p>
              <p className="wm-stat-hint" style={{ margin: 0 }}>
                Стиль: {selectedRecipe.visualStyle ?? selectedProfile?.backgroundStyle ?? 'forging'}
              </p>
            </div>
            <button type="button" onClick={startSession} disabled={!canStartSession}>
              {materialShortages.length > 0 ? 'Нет материалов' : 'Старт сессии'}
            </button>
          </div>
          <div className="blacksmith-recipe-focus-io">
            {(selectedRecipe.inputMaterials ?? []).map((entry) => {
              const shortage = materialShortages.find((row) => row.catalogId === entry.materialId);
              const label = materialsById.get(entry.materialId)?.name ?? 'Материал';
              return (
                <span
                  key={`mat-${entry.materialId}`}
                  className={shortage ? 'blacksmith-recipe-io--missing' : undefined}
                  title={shortage ? `Есть ${shortage.available} из ${shortage.required}` : undefined}
                >
                  {label} x{entry.quantity}
                </span>
              );
            })}
            {(selectedRecipe.inputItems ?? []).map((entry) => (
              <span key={`item-${entry.itemId}`}>{itemsById.get(entry.itemId)?.name ?? 'Предмет'} x{entry.quantity}</span>
            ))}
          </div>
        </article>
      ) : null}

      {session ? (
        <div className="blacksmith-forge-scene-wrap">
          <div
            className={`blacksmith-forge-scene ${qualityToneClass}`}
            style={{ backgroundImage: sceneBackgroundSrc ? `url(${sceneBackgroundSrc})` : undefined }}
          >
            {forgeGlowSrc ? <img className="forge-overlay forge-overlay--glow" src={forgeGlowSrc} alt="" aria-hidden="true" /> : null}
            {embersSrc ? <img className="forge-overlay forge-overlay--embers" src={embersSrc} alt="" aria-hidden="true" /> : null}
            {sparksSrc ? <img className="forge-overlay forge-overlay--sparks" src={sparksSrc} alt="" aria-hidden="true" /> : null}
            {smokeSrc ? <img className="forge-overlay forge-overlay--smoke" src={smokeSrc} alt="" aria-hidden="true" /> : null}

            {furnaceSrc ? <img className="forge-station forge-station--furnace" src={furnaceSrc} alt="Горн" /> : null}
            {anvilSrc ? <img className="forge-station forge-station--anvil" src={anvilSrc} alt="Наковальня" /> : null}
            {bellowsSrc ? <img className="forge-station forge-station--bellows" src={bellowsSrc} alt="Меха" /> : null}
            {quenchVatSrc ? <img className="forge-station forge-station--quench" src={quenchVatSrc} alt="Ванна закалки" /> : null}

            {directCentralObject?.imageRef ? (
              <div className="forge-central-object forge-central-object--image" title="Текущая заготовка">
                <GameImageView
                  imageRef={directCentralObject.imageRef}
                  legacyImagePath={directCentralObject.legacyImagePath}
                  runtimeImages={runtimeImages}
                  alt="Текущая заготовка"
                  size={128}
                  fit="contain"
                  className="forge-central-object-image"
                  fallbackText="?"
                />
                {defectOverlaySources.map((src, index) => (
                  <img
                    key={`${src}-${index}`}
                    className={`forge-central-overlay forge-central-overlay--${Math.min(index + 1, 4)}`}
                    src={src}
                    alt=""
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : (
              <div
                className="forge-central-object forge-central-object--sheet"
                style={frameStyle(OBJECT_SHEET_SRC, objectFrame, OBJECT_FRAME_SIZE, OBJECT_SHEET_COLUMNS, 144)}
                title="Текущая заготовка"
              >
                {defectOverlaySources.map((src, index) => (
                  <img
                    key={`${src}-${index}`}
                    className={`forge-central-overlay forge-central-overlay--${Math.min(index + 1, 4)}`}
                    src={src}
                    alt=""
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="blacksmith-forge-hud">
            <div className="profession-overview-item"><span>Этап</span><strong>{mapStageLabel(session.stage)}</strong></div>
            <div className="profession-overview-item"><span>Жар</span><strong>{session.heat}</strong></div>
            <div className="profession-overview-item"><span>Состояние жара</span><strong>{heatLabel(session.heat)} (оптимум 55-75)</strong></div>
            <div className="profession-overview-item"><span>Прогресс</span><strong>{session.progress}</strong></div>
            <div className="profession-overview-item"><span>Качество</span><strong>{session.qualityScore}</strong></div>
            <div className="profession-overview-item"><span>Дефекты</span><strong>{session.defectScore}</strong></div>
            <div className="profession-overview-item"><span>Итог</span><strong>{currentScore}</strong></div>
            <div className={`profession-overview-item ${qualityToneClass}`}><span>Тир</span><strong>{currentQualityTier?.name ?? '-'}</strong></div>
          </div>
        </div>
      ) : null}

      {session ? (
        <div className="blacksmith-action-panel">
          <div className="blacksmith-tool-strip">
            <GameImageView
              imageRef={makeTilesetRef(TOOL_SHEET_ID, TOOL_FRAMES.forge)}
              runtimeImages={runtimeImages}
              alt="Горн"
              size={58}
              fit="contain"
              className="blacksmith-tool-frame"
              fallbackText="Г"
            />
            <GameImageView
              imageRef={makeTilesetRef(TOOL_SHEET_ID, TOOL_FRAMES.gauge)}
              runtimeImages={runtimeImages}
              alt="Измеритель температуры"
              size={58}
              fit="contain"
              className="blacksmith-tool-frame"
              fallbackText="Т"
            />
            <GameImageView
              imageRef={makeTilesetRef(TOOL_SHEET_ID, TOOL_FRAMES.hammer)}
              runtimeImages={runtimeImages}
              alt="Кузнечный молот"
              size={58}
              fit="contain"
              className="blacksmith-tool-frame"
              fallbackText="М"
            />
            <GameImageView
              imageRef={makeTilesetRef(TOOL_SHEET_ID, TOOL_FRAMES.tongs)}
              runtimeImages={runtimeImages}
              alt="Клещи"
              size={58}
              fit="contain"
              className="blacksmith-tool-frame"
              fallbackText="К"
            />
            <GameImageView
              imageRef={makeTilesetRef(TOOL_SHEET_ID, TOOL_FRAMES.anvil)}
              runtimeImages={runtimeImages}
              alt="Наковальня"
              size={58}
              fit="contain"
              className="blacksmith-tool-frame"
              fallbackText="Н"
            />
          </div>
          <div className="blacksmith-action-grid">
            <button type="button" onClick={() => runAction('prepare_blank')}>Подготовка</button>
            <button type="button" onClick={() => runAction('add_heat')}>Поддать жару</button>
            <button type="button" onClick={() => runAction('stabilize_heat')}>Стабилизировать жар</button>
            <button type="button" onClick={() => runAction('light_strike')}>Лёгкий удар</button>
            <button type="button" onClick={() => runAction('medium_strike')}>Средний удар</button>
            <button type="button" onClick={() => runAction('heavy_strike')}>Тяжёлый удар</button>
            <button type="button" onClick={() => runAction('quench_water')}>Закалка (вода)</button>
            <button type="button" onClick={() => runAction('quench_oil')}>Закалка (масло)</button>
            <button type="button" onClick={() => runAction('finish_polish')}>Финишная обработка</button>
            <button type="button" onClick={() => completeSession(session)}>Забрать результат сейчас</button>
            <button type="button" onClick={() => onSessionChange(null)}>Сброс</button>
          </div>
        </div>
      ) : null}

      <style>{`
        .blacksmith-forge-layout {
          display: grid;
          gap: 10px;
          min-height: 0;
        }
        .blacksmith-recipe-focus-card {
          border: 1px solid rgba(164, 141, 110, 0.26);
          border-radius: 10px;
          background: rgba(24, 19, 14, 0.86);
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .blacksmith-recipe-focus-main {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }
        .blacksmith-recipe-focus-io {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .blacksmith-recipe-focus-io span {
          font-size: 0.74rem;
          border: 1px solid rgba(168, 143, 108, 0.35);
          border-radius: 999px;
          padding: 2px 8px;
          background: rgba(50, 36, 25, 0.74);
        }
        .blacksmith-forge-scene-wrap {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
          gap: 10px;
          align-items: stretch;
        }
        .blacksmith-forge-scene {
          position: relative;
          min-height: 330px;
          border-radius: 12px;
          overflow: hidden;
          background: radial-gradient(circle at 50% 10%, rgba(80, 47, 30, 0.6), rgba(14, 11, 9, 0.96));
          background-size: cover;
          background-position: center;
          border: 1px solid rgba(164, 141, 110, 0.28);
        }
        .forge-overlay {
          position: absolute;
          pointer-events: none;
          opacity: 0.48;
        }
        .forge-overlay--glow { left: 34%; top: 30%; width: 220px; }
        .forge-overlay--embers { left: 42%; bottom: 8%; width: 200px; opacity: 0.62; }
        .forge-overlay--sparks { right: 22%; top: 24%; width: 200px; opacity: 0.42; }
        .forge-overlay--smoke { right: 30%; top: 3%; width: 210px; opacity: 0.34; }
        .forge-station {
          position: absolute;
          object-fit: contain;
          filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.55));
          opacity: 0.93;
        }
        .forge-station--furnace { width: 170px; left: 6%; top: 18%; }
        .forge-station--anvil { width: 160px; right: 8%; top: 36%; }
        .forge-station--bellows { width: 120px; left: 18%; bottom: 16%; }
        .forge-station--quench { width: 120px; right: 22%; bottom: 9%; }
        .forge-central-object {
          position: absolute;
          width: 144px;
          height: 144px;
          left: 50%;
          top: 56%;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(255, 214, 154, 0.34);
          border-radius: 12px;
          box-shadow: 0 0 28px rgba(218, 138, 74, 0.25);
          background-color: rgba(18, 13, 10, 0.85);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .forge-central-object--sheet {
          background-size: 1344px auto;
          image-rendering: crisp-edges;
        }
        .forge-central-object-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          border-radius: 0;
          background: transparent;
        }
        .forge-central-overlay {
          position: absolute;
          inset: 8px;
          width: calc(100% - 16px);
          height: calc(100% - 16px);
          object-fit: contain;
          pointer-events: none;
          opacity: 0.64;
          mix-blend-mode: screen;
          filter: drop-shadow(0 0 10px rgba(255, 140, 65, 0.2));
        }
        .forge-central-overlay--2 { opacity: 0.54; transform: scale(0.98); }
        .forge-central-overlay--3 { opacity: 0.48; transform: scale(0.96); }
        .forge-central-overlay--4 { opacity: 0.42; transform: scale(0.94); }
        .blacksmith-forge-hud {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .blacksmith-action-panel {
          display: grid;
          gap: 8px;
        }
        .blacksmith-tool-strip {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .blacksmith-tool-frame {
          width: 58px;
          height: 58px;
          border-radius: 8px;
          border: 1px solid rgba(164, 141, 110, 0.3);
          background-color: rgba(15, 11, 8, 0.9);
        }
        .blacksmith-action-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .quality-broken { border-color: rgba(123, 59, 59, 0.8); box-shadow: inset 0 0 0 1px rgba(123, 59, 59, 0.45); }
        .quality-crude { border-color: rgba(130, 110, 86, 0.8); box-shadow: inset 0 0 0 1px rgba(130, 110, 86, 0.35); }
        .quality-normal { border-color: rgba(132, 124, 111, 0.7); box-shadow: inset 0 0 0 1px rgba(132, 124, 111, 0.28); }
        .quality-good { border-color: rgba(94, 129, 86, 0.78); box-shadow: inset 0 0 0 1px rgba(94, 129, 86, 0.35); }
        .quality-excellent { border-color: rgba(69, 128, 150, 0.78); box-shadow: inset 0 0 0 1px rgba(69, 128, 150, 0.32); }
        .quality-masterwork { border-color: rgba(144, 110, 186, 0.78); box-shadow: inset 0 0 0 1px rgba(144, 110, 186, 0.35); }
        .quality-legendary { border-color: rgba(210, 153, 54, 0.88); box-shadow: inset 0 0 0 1px rgba(210, 153, 54, 0.45), 0 0 14px rgba(210, 153, 54, 0.22); }
        @media (max-width: 1180px) {
          .blacksmith-forge-scene-wrap { grid-template-columns: 1fr; }
          .blacksmith-forge-scene { min-height: 280px; }
        }
      `}</style>
    </div>
  );
}
