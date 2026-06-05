import { useEffect, useMemo, useRef, useState } from 'react';
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
  BlacksmithCustomForgePlan,
  BlacksmithForgeTier,
  BlacksmithItemTemplate,
  BlacksmithItemWorkAction,
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
  calculateCustomForgeDifficulty,
  canAffordRecipeMaterialsWithInventory,
  consumeCustomForgeMaterials,
  consumeItemWorkCosts,
  consumeRecipeMaterials,
  getRecipeMaterialShortages,
} from './blacksmithRecipeMaterials';
import type { InventoryState } from '@theend/rpg-domain';

interface BlacksmithForgeTabProps {
  selectedRecipe: CraftingRecipe | null;
  mode: 'recipe' | 'custom_forge' | 'item_work';
  customForgePlan: BlacksmithCustomForgePlan | null;
  customForgeTemplate: BlacksmithItemTemplate | null;
  itemWorkAction: BlacksmithItemWorkAction | null;
  itemWorkItem: AdminItem | null;
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
  onComplete: (payload: { xp: number; score: number; qualityTierId: string; success: boolean; mode: 'recipe' | 'custom_forge' | 'item_work' }) => void | Promise<void>;
}

const OBJECT_SHEET_SRC = '/art/blacksmith/objects/blacksmith_forge_objects_sheet_384.png';
const OBJECT_FRAME_SIZE = 384;
const OBJECT_SHEET_COLUMNS = 4;

type BlacksmithActionId =
  | 'prepare_blank'
  | 'add_heat'
  | 'stabilize_heat'
  | 'light_strike'
  | 'medium_strike'
  | 'heavy_strike'
  | 'quench_water'
  | 'quench_oil'
  | 'finish_polish';

interface ForgeStripEntry {
  id: string;
  name: string;
  imageRef?: ReturnType<typeof normalizeGameImageRef>;
  legacyImagePath?: string;
  fallbackText: string;
}

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

export function BlacksmithForgeTab({
  selectedRecipe,
  mode,
  customForgePlan,
  customForgeTemplate,
  itemWorkAction,
  itemWorkItem,
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
  const [lastAction, setLastAction] = useState<BlacksmithActionId | null>(null);
  const [isShaking, setIsShaking] = useState(false);
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
  const customDifficulty = useMemo(
    () => (customForgePlan && customForgeTemplate ? calculateCustomForgeDifficulty(customForgePlan, materials, customForgeTemplate) : null),
    [customForgePlan, customForgeTemplate, materials],
  );

  const heatGlowStyle = useMemo(() => {
    if (!session) {
      return {};
    }
    const intensity = Math.max(0, Math.min(1, (session.heat - 35) / 55));
    return {
      '--heat-intensity': intensity,
      boxShadow: `0 0 ${15 + intensity * 25}px rgba(255, ${60 + (1 - intensity) * 80}, 0, ${0.15 + intensity * 0.55})`,
      borderColor: `rgba(255, ${160 + (1 - intensity) * 80}, 100, ${0.34 + intensity * 0.46})`,
    } as React.CSSProperties;
  }, [session?.heat]);

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
  const directCentralObject = mode === 'custom_forge' && customForgePlan
    ? resolveImageCandidate(
      customForgePlan.selectedMaterials[0]?.materialId,
      materialsById,
      itemsById,
    ) ?? (customForgeTemplate?.imageRef ? { imageRef: customForgeTemplate.imageRef } : null)
    : mode === 'item_work' && itemWorkItem
      ? resolveImageCandidate(itemWorkItem.id, materialsById, itemsById) ?? {
        imageRef: normalizeGameImageRef(itemWorkItem.imageRef, itemWorkItem.imagePath ?? itemWorkItem.id) ?? undefined,
        legacyImagePath: itemWorkItem.imagePath ?? itemWorkItem.id,
      }
      : selectedRecipe
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
  const defectOverlaySource = useMemo(() => {
    if (!session) {
      return null;
    }
    if (session.defectScore >= 7 && crackCriticalSrc) {
      return crackCriticalSrc;
    }
    if (session.defectScore >= 4 && crackMediumSrc) {
      return crackMediumSrc;
    }
    if (session.heat > 75 && overheatedSrc) {
      return overheatedSrc;
    }
    if (session.stage === 'quench' && session.defectScore > 0 && quenchedBadlySrc) {
      return quenchedBadlySrc;
    }
    if (session.stage === 'prep' && session.defectScore > 0 && impuritySrc) {
      return impuritySrc;
    }
    if (session.progress >= 14 && session.defectScore >= 2 && warpedMetalSrc) {
      return warpedMetalSrc;
    }
    if (session.defectScore >= 1 && crackSmallSrc) {
      return crackSmallSrc;
    }
    return null;
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
  const canStartRecipeSession = Boolean(selectedRecipe) && materialShortages.length === 0 && !session;
  const canStartCustomForgeSession = mode === 'custom_forge' && Boolean(customForgePlan && customForgeTemplate) && !session;
  const canStartItemWorkSession = mode === 'item_work' && Boolean(itemWorkAction && itemWorkItem) && !session;
  const canStartSession = canStartRecipeSession || canStartCustomForgeSession || canStartItemWorkSession;
  const musicRef = useRef<HTMLAudioElement | null>(null);

  const workingStripEntries = useMemo<ForgeStripEntry[]>(() => {
    const entries: ForgeStripEntry[] = [];
    const pushCandidate = (id: string, fallbackName?: string) => {
      const resolved = resolveImageCandidate(id, materialsById, itemsById);
      if (!resolved) {
        return;
      }
      const item = itemsById.get(id);
      const material = materialsById.get(id);
      entries.push({
        id,
        name: item?.name ?? material?.name ?? fallbackName ?? id,
        imageRef: resolved.imageRef,
        legacyImagePath: resolved.legacyImagePath,
        fallbackText: ((item?.name ?? material?.name ?? fallbackName ?? id).trim().charAt(0) || '?').toUpperCase(),
      });
    };

    if (mode === 'recipe' && selectedRecipe) {
      const outputId = selectedRecipe.outputItems?.[0]?.itemId ?? selectedRecipe.outputMaterials?.[0]?.materialId;
      if (outputId) {
        pushCandidate(outputId, selectedRecipe.name);
      }
      for (const input of selectedRecipe.inputItems ?? []) {
        pushCandidate(input.itemId);
      }
      for (const input of selectedRecipe.inputMaterials ?? []) {
        pushCandidate(input.materialId);
      }
    } else if (mode === 'custom_forge' && customForgePlan) {
      for (const input of customForgePlan.selectedMaterials) {
        pushCandidate(input.materialId);
      }
    } else if (mode === 'item_work' && itemWorkItem) {
      pushCandidate(itemWorkItem.id, itemWorkItem.name);
      for (const input of itemWorkAction?.materialCosts ?? []) {
        pushCandidate(input.materialId);
      }
      for (const input of itemWorkAction?.itemCosts ?? []) {
        pushCandidate(input.itemId);
      }
    }

    const deduped = new Map<string, ForgeStripEntry>();
    for (const entry of entries) {
      if (!deduped.has(entry.id)) {
        deduped.set(entry.id, entry);
      }
    }
    return Array.from(deduped.values()).slice(0, 5);
  }, [customForgePlan, itemWorkAction?.itemCosts, itemWorkAction?.materialCosts, itemWorkItem, itemsById, materialsById, mode, selectedRecipe]);

  const highlightedStation = useMemo(() => {
    if (!session) {
      return { furnace: false, bellows: false, anvil: false, quench: false, sparks: false };
    }
    const furnace = session.stage === 'heat' || lastAction === 'add_heat';
    const bellows = lastAction === 'stabilize_heat';
    const anvil = session.stage === 'strike'
      || lastAction === 'prepare_blank'
      || lastAction === 'light_strike'
      || lastAction === 'medium_strike'
      || lastAction === 'heavy_strike';
    const quench = session.stage === 'quench' || lastAction === 'quench_water' || lastAction === 'quench_oil';
    const sparks = lastAction === 'light_strike' || lastAction === 'medium_strike' || lastAction === 'heavy_strike' || session.stage === 'strike';
    return { furnace, bellows, anvil, quench, sparks };
  }, [lastAction, session]);

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

  useEffect(() => {
    if (!session) {
      setLastAction(null);
    }
  }, [session]);

  function startSession() {
    if (mode === 'recipe') {
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
      onSessionChange(createBlacksmithSession({
        recipeId: selectedRecipe.id,
        recipeType: selectedRecipe.recipeType,
        materialTier: 'common',
        baseDifficulty: 45,
        mode: 'recipe',
      }, bonuses));
      return;
    }

    if (mode === 'custom_forge' && customForgePlan && customForgeTemplate) {
      const consumeResult = consumeCustomForgeMaterials(customForgePlan, inventory);
      if (!consumeResult.ok) {
        window.alert('Не удалось списать материалы для свободной ковки.');
        return;
      }
      if (consumeResult.inventory) {
        onInventoryChange(consumeResult.inventory);
      }
      const difficulty = customDifficulty ?? calculateCustomForgeDifficulty(customForgePlan, materials, customForgeTemplate);
      playBlacksmithUiSound(BLACKSMITH_BUTTON_SOUNDS.startSession);
      onSessionChange(createBlacksmithSession({
        recipeId: customForgeTemplate.id,
        recipeType: 'custom_forge',
        materialTier: difficulty.materialTier,
        baseDifficulty: difficulty.baseDifficulty,
        mode: 'custom_forge',
        customForgePlanId: customForgePlan.id,
      }, bonuses));
      return;
    }

    if (mode === 'item_work' && itemWorkAction && itemWorkItem) {
      if (itemWorkAction.actionType === 'add_socket') {
        if (itemWorkItem.canAddAugmentSlots !== true) {
          window.alert('Этот предмет не поддерживает добавление слотов.');
          return;
        }
        const currentSlots = itemWorkItem.augmentSlots?.length ?? 0;
        const maxSlots = itemWorkItem.maxAugmentSlots ?? currentSlots;
        if (currentSlots >= maxSlots) {
          window.alert(`Для предмета уже достигнут максимум слотов (${maxSlots}).`);
          return;
        }
      }
      const consumeResult = consumeItemWorkCosts(itemWorkAction, inventory);
      if (!consumeResult.ok) {
        window.alert('Не удалось списать материалы для кузнечной доработки.');
        return;
      }
      if (consumeResult.inventory) {
        onInventoryChange(consumeResult.inventory);
      }
      playBlacksmithUiSound(BLACKSMITH_BUTTON_SOUNDS.startSession);
      onSessionChange(createBlacksmithSession({
        recipeId: itemWorkAction.id,
        recipeType: 'item_work',
        materialTier: itemWorkItem.rarity ?? 'common',
        baseDifficulty: itemWorkAction.baseDifficulty,
        mode: 'item_work',
        targetItemId: itemWorkItem.id,
        itemWorkActionId: itemWorkAction.id,
      }, bonuses));
    }
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
      mode,
    })).finally(() => {
      onSessionChange(null);
    });
  }

  function runAction(action: BlacksmithActionId) {
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
    setLastAction(action);
    if (action.includes('strike')) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
    }
    const next = applyBlacksmithAction(session, action, bonuses).state;
    onSessionChange(next);
  }

  return (
    <div className="blacksmith-forge-layout">
      {mode === 'recipe' && !selectedRecipe ? <p className="wm-stat-hint">Сначала выберите рецепт во вкладке "Рецепты".</p> : null}
      {mode === 'custom_forge' && !customForgePlan ? <p className="wm-stat-hint">Сначала подготовьте план во вкладке "Свободная ковка".</p> : null}
      {mode === 'item_work' && !(itemWorkAction && itemWorkItem) ? <p className="wm-stat-hint">Сначала выберите предмет и кузнечную операцию во вкладке "Инвентарь".</p> : null}
      {mode === 'recipe' && selectedRecipe ? (
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

      {mode === 'custom_forge' && customForgePlan && customForgeTemplate ? (
        <article className="blacksmith-recipe-focus-card">
          <div className="blacksmith-recipe-focus-main">
            <div>
              <strong>{customForgeTemplate.name}</strong>
              <p className="wm-stat-hint" style={{ margin: 0 }}>
                Режим: свободная ковка · Сложность: {customDifficulty?.baseDifficulty ?? customForgePlan.predictedDifficulty}
              </p>
              <p className="wm-stat-hint" style={{ margin: 0 }}>
                Риск: {customDifficulty?.risk ?? customForgePlan.predictedRisk} · Потенциал: {customDifficulty?.power ?? customForgePlan.predictedPower}
              </p>
              {customForgePlan.customName ? (
                <p className="wm-stat-hint" style={{ margin: 0 }}>Имя предмета: {customForgePlan.customName}</p>
              ) : null}
            </div>
            <button type="button" onClick={startSession} disabled={!canStartSession}>
              Старт сессии
            </button>
          </div>
          <div className="blacksmith-recipe-focus-io">
            {customForgePlan.selectedMaterials.map((entry) => (
              <span key={`${entry.slotId}:${entry.materialId}`}>
                {materialsById.get(entry.materialId)?.name ?? entry.materialId} x{entry.quantity}
              </span>
            ))}
          </div>
        </article>
      ) : null}

      {mode === 'item_work' && itemWorkAction && itemWorkItem ? (
        <article className="blacksmith-recipe-focus-card">
          <div className="blacksmith-recipe-focus-main">
            <div>
              <strong>{itemWorkItem.name}</strong>
              <p className="wm-stat-hint" style={{ margin: 0 }}>
                Режим: работа с предметом · Операция: {itemWorkAction.name}
              </p>
              <p className="wm-stat-hint" style={{ margin: 0 }}>
                Сложность: {itemWorkAction.baseDifficulty} · Риск: {itemWorkAction.risk}
              </p>
              <p className="wm-stat-hint" style={{ margin: 0 }}>
                {typeof itemWorkItem.damageMin === 'number' || typeof itemWorkItem.damageMax === 'number'
                  ? `Урон: ${itemWorkItem.damageMin ?? 0}-${itemWorkItem.damageMax ?? itemWorkItem.damageMin ?? 0}`
                  : typeof itemWorkItem.armorValue === 'number'
                    ? `Броня: ${itemWorkItem.armorValue}`
                    : 'Предмет можно доработать в кузнице.'}
                {' · '}Слоты: {itemWorkItem.augmentSlots?.length ?? 0}/{itemWorkItem.maxAugmentSlots ?? itemWorkItem.augmentSlots?.length ?? 0}
              </p>
            </div>
            <button type="button" onClick={startSession} disabled={!canStartSession}>
              Старт сессии
            </button>
          </div>
          <div className="blacksmith-recipe-focus-io">
            {(itemWorkAction.materialCosts ?? []).map((entry) => (
              <span key={`mat-${entry.materialId}`}>{materialsById.get(entry.materialId)?.name ?? entry.materialId} x{entry.quantity}</span>
            ))}
            {(itemWorkAction.itemCosts ?? []).map((entry) => (
              <span key={`item-${entry.itemId}`}>{itemsById.get(entry.itemId)?.name ?? entry.itemId} x{entry.quantity}</span>
            ))}
          </div>
        </article>
      ) : null}

      {session ? (
        <div className="blacksmith-forge-scene-wrap">
          <div
            className={`blacksmith-forge-scene ${qualityToneClass} ${isShaking ? 'is-shaking' : ''}`}
            style={{ backgroundImage: sceneBackgroundSrc ? `url(${sceneBackgroundSrc})` : undefined }}
          >
            {forgeGlowSrc ? <img className="forge-overlay forge-overlay--glow" src={forgeGlowSrc} alt="" aria-hidden="true" /> : null}
            {embersSrc ? <img className="forge-overlay forge-overlay--embers" src={embersSrc} alt="" aria-hidden="true" /> : null}
            {sparksSrc ? <img className={`forge-overlay forge-overlay--sparks ${highlightedStation.sparks ? 'is-active' : ''}`} src={sparksSrc} alt="" aria-hidden="true" /> : null}
            {smokeSrc ? <img className={`forge-overlay forge-overlay--smoke ${highlightedStation.quench ? 'is-active' : ''}`} src={smokeSrc} alt="" aria-hidden="true" /> : null}

            {furnaceSrc ? <img className={`forge-station forge-station--furnace ${highlightedStation.furnace ? 'is-active' : ''}`} src={furnaceSrc} alt="Горн" /> : null}
            {anvilSrc ? <img className={`forge-station forge-station--anvil ${highlightedStation.anvil ? 'is-active' : ''}`} src={anvilSrc} alt="Наковальня" /> : null}
            {bellowsSrc ? <img className={`forge-station forge-station--bellows ${highlightedStation.bellows ? 'is-active' : ''}`} src={bellowsSrc} alt="Меха" /> : null}
            {quenchVatSrc ? <img className={`forge-station forge-station--quench ${highlightedStation.quench ? 'is-active' : ''}`} src={quenchVatSrc} alt="Ванна закалки" /> : null}

            {directCentralObject?.imageRef ? (
              <div className="forge-central-object forge-central-object--image" style={heatGlowStyle} title="Текущая заготовка">
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
                <div 
                  className="forge-heat-glow-overlay" 
                  style={{ opacity: session ? Math.max(0, Math.min(0.75, (session.heat - 35) / 55)) : 0 }} 
                />
                {defectOverlaySource ? <img className="forge-central-overlay" src={defectOverlaySource} alt="" aria-hidden="true" /> : null}
              </div>
            ) : (
              <div
                className="forge-central-object forge-central-object--sheet"
                style={{
                  ...frameStyle(OBJECT_SHEET_SRC, objectFrame, OBJECT_FRAME_SIZE, OBJECT_SHEET_COLUMNS, 144),
                  ...heatGlowStyle,
                }}
                title="Текущая заготовка"
              >
                <div 
                  className="forge-heat-glow-overlay" 
                  style={{ opacity: session ? Math.max(0, Math.min(0.75, (session.heat - 35) / 55)) : 0 }} 
                />
                {defectOverlaySource ? <img className="forge-central-overlay" src={defectOverlaySource} alt="" aria-hidden="true" /> : null}
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
            {workingStripEntries.map((entry) => (
              <div key={entry.id} className="blacksmith-tool-frame" title={entry.name}>
                <GameImageView
                  imageRef={entry.imageRef}
                  legacyImagePath={entry.legacyImagePath}
                  runtimeImages={runtimeImages}
                  alt={entry.name}
                  size={58}
                  fit="contain"
                  className="blacksmith-tool-frame-image"
                  fallbackText={entry.fallbackText}
                />
              </div>
            ))}
          </div>

          <div className="blacksmith-action-grid">
            {/* ── Подготовка ── */}
            <button type="button" className="forge-btn forge-btn--prep" onClick={() => runAction('prepare_blank')}>
              <span className="forge-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="13" width="14" height="4" rx="1.5" fill="currentColor" opacity="0.7"/>
                  <rect x="7" y="4" width="6" height="9" rx="1" fill="currentColor"/>
                  <path d="M5 7h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="forge-btn-label">Подготовка</span>
            </button>

            {/* ── Жар ── */}
            <button type="button" className="forge-btn forge-btn--heat" onClick={() => runAction('add_heat')}>
              <span className="forge-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 3C10 3 6 7 6 11a4 4 0 008 0C14 7 10 3 10 3z" fill="currentColor"/>
                  <path d="M10 10c0 0-2 2-2 3.5a2 2 0 004 0C12 12 10 10 10 10z" fill="white" opacity="0.45"/>
                </svg>
              </span>
              <span className="forge-btn-label">Поддать жару</span>
            </button>

            <button type="button" className="forge-btn forge-btn--heat" onClick={() => runAction('stabilize_heat')}>
              <span className="forge-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 13c1-4 3-5 6-5s5 1 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  <circle cx="10" cy="8" r="2.5" fill="currentColor" opacity="0.6"/>
                  <path d="M8 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="forge-btn-label">Стабилизировать жар</span>
            </button>

            {/* ── Удары ── */}
            <button type="button" className="forge-btn forge-btn--strike forge-btn--strike-light" onClick={() => runAction('light_strike')}>
              <span className="forge-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="12" width="12" height="4" rx="2" fill="currentColor" opacity="0.5"/>
                  <path d="M10 3v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M7 7l3-4 3 4" fill="currentColor"/>
                </svg>
              </span>
              <span className="forge-btn-label">Лёгкий удар</span>
            </button>

            <button type="button" className="forge-btn forge-btn--strike forge-btn--strike-medium" onClick={() => runAction('medium_strike')}>
              <span className="forge-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="12" width="12" height="4" rx="2" fill="currentColor" opacity="0.6"/>
                  <path d="M10 2v10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M6.5 6.5l3.5-4.5 3.5 4.5" fill="currentColor"/>
                </svg>
              </span>
              <span className="forge-btn-label">Средний удар</span>
            </button>

            <button type="button" className="forge-btn forge-btn--strike forge-btn--strike-heavy" onClick={() => runAction('heavy_strike')}>
              <span className="forge-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="12" width="14" height="5" rx="2" fill="currentColor" opacity="0.7"/>
                  <path d="M10 1v11" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  <path d="M5.5 6l4.5-5 4.5 5" fill="currentColor"/>
                </svg>
              </span>
              <span className="forge-btn-label">Тяжёлый удар</span>
            </button>

            {/* ── Закалка ── */}
            <button type="button" className="forge-btn forge-btn--quench forge-btn--quench-water" onClick={() => runAction('quench_water')}>
              <span className="forge-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 3C10 3 5 9 5 13a5 5 0 0010 0C15 9 10 3 10 3z" fill="currentColor" opacity="0.75"/>
                  <path d="M8 13.5C8 13.5 9 15 10 13.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
                </svg>
              </span>
              <span className="forge-btn-label">Закалка (вода)</span>
            </button>

            <button type="button" className="forge-btn forge-btn--quench forge-btn--quench-oil" onClick={() => runAction('quench_oil')}>
              <span className="forge-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <ellipse cx="10" cy="14" rx="6" ry="3" fill="currentColor" opacity="0.55"/>
                  <path d="M10 4c0 0-3 4-3 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M10 4c0 0 3 4 3 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <ellipse cx="10" cy="11" rx="3" ry="1.5" fill="currentColor" opacity="0.4"/>
                </svg>
              </span>
              <span className="forge-btn-label">Закалка (масло)</span>
            </button>

            {/* ── Финиш ── */}
            <button type="button" className="forge-btn forge-btn--finish" onClick={() => runAction('finish_polish')}>
              <span className="forge-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 16l3-3 9-9-3-3-9 9 3 3z" fill="currentColor" opacity="0.8"/>
                  <circle cx="15" cy="6" r="1.5" fill="white" opacity="0.7"/>
                  <path d="M13 14l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="forge-btn-label">Финишная обработка</span>
            </button>

            {/* ── Забрать / Сброс ── */}
            <button type="button" className="forge-btn forge-btn--take" onClick={() => completeSession(session)}>
              <span className="forge-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M10 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M6 9l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="forge-btn-label">Забрать результат</span>
            </button>

            <button type="button" className="forge-btn forge-btn--reset" onClick={() => onSessionChange(null)}>
              <span className="forge-btn-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 10a6 6 0 1012 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M4 6v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="forge-btn-label">Сброс</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Итог ковки ── показывается сразу после завершения */}
      {session && session.stage === 'completed' ? (
        <div className={`forge-result-card ${qualityToneClass}`}>
          <div className="forge-result-left">
            {directCentralObject?.imageRef ? (
              <div className="forge-result-image-wrap">
                <GameImageView
                  imageRef={directCentralObject.imageRef}
                  legacyImagePath={directCentralObject.legacyImagePath}
                  runtimeImages={runtimeImages}
                  alt="Результат ковки"
                  size={80}
                  fit="contain"
                  className="forge-result-image"
                  fallbackText="?"
                />
                <div className="forge-result-image-glow" />
              </div>
            ) : (
              <div
                className="forge-result-image-wrap forge-result-image-sheet"
                style={frameStyle(OBJECT_SHEET_SRC, objectFrame, OBJECT_FRAME_SIZE, OBJECT_SHEET_COLUMNS, 80)}
              />
            )}
          </div>

          <div className="forge-result-info">
            <div className="forge-result-title">
              {mode === 'recipe' && selectedRecipe ? selectedRecipe.name
                : mode === 'custom_forge' && customForgeTemplate ? customForgeTemplate.name
                : mode === 'item_work' && itemWorkItem ? itemWorkItem.name
                : 'Предмет'}
            </div>
            <div className={`forge-result-quality ${qualityToneClass}`}>
              {currentQualityTier?.name ?? 'Неизвестное качество'}
            </div>
            <div className="forge-result-score">Итог: {currentScore} баллов</div>

            {/* Список использованных материалов */}
            {mode === 'recipe' && selectedRecipe ? (
              <div className="forge-result-materials">
                {(selectedRecipe.inputMaterials ?? []).map((entry) => (
                  <span key={`rmat-${entry.materialId}`} className="forge-result-mat-chip">
                    {materialsById.get(entry.materialId)?.name ?? entry.materialId} ×{entry.quantity}
                  </span>
                ))}
                {(selectedRecipe.inputItems ?? []).map((entry) => (
                  <span key={`ritem-${entry.itemId}`} className="forge-result-mat-chip">
                    {itemsById.get(entry.itemId)?.name ?? entry.itemId} ×{entry.quantity}
                  </span>
                ))}
              </div>
            ) : mode === 'custom_forge' && customForgePlan ? (
              <div className="forge-result-materials">
                {customForgePlan.selectedMaterials.map((entry) => (
                  <span key={`cfmat-${entry.slotId}:${entry.materialId}`} className="forge-result-mat-chip">
                    {materialsById.get(entry.materialId)?.name ?? entry.materialId} ×{entry.quantity}
                  </span>
                ))}
              </div>
            ) : mode === 'item_work' && itemWorkAction ? (
              <div className="forge-result-materials">
                {(itemWorkAction.materialCosts ?? []).map((entry) => (
                  <span key={`iwmat-${entry.materialId}`} className="forge-result-mat-chip">
                    {materialsById.get(entry.materialId)?.name ?? entry.materialId} ×{entry.quantity}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <button type="button" className="forge-btn forge-btn--take forge-result-take-btn" onClick={() => completeSession(session)}>
            <span className="forge-btn-icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M6 9l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="forge-btn-label">Забрать</span>
          </button>
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
          transition: border-color 0.25s ease;
        }
        .blacksmith-forge-scene.is-shaking {
          animation: scene-shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes scene-shake {
          10%, 90% { transform: translate3d(-1px, -1px, 0); }
          20%, 80% { transform: translate3d(2px, 1px, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, -2px, 0); }
          40%, 60% { transform: translate3d(4px, 2px, 0); }
        }
        .forge-overlay {
          position: absolute;
          pointer-events: none;
          opacity: 0.48;
        }
        .forge-overlay--glow { left: 34%; top: 30%; width: 220px; }
        .forge-overlay--embers { left: 42%; bottom: 8%; width: 200px; opacity: 0.62; }
        .forge-overlay--sparks { right: 22%; top: 24%; width: 200px; opacity: 0.12; transition: opacity 140ms ease, transform 140ms ease; }
        .forge-overlay--sparks.is-active { opacity: 0.72; transform: scale(1.06); animation: forge-spark-pulse 0.32s ease-in-out infinite alternate; }
        .forge-overlay--smoke { right: 30%; top: 3%; width: 210px; opacity: 0.34; transition: opacity 300ms ease, transform 300ms ease; }
        .forge-overlay--smoke.is-active {
          opacity: 0.85;
          animation: steam-rise 1.5s ease-out infinite;
        }
        @keyframes steam-rise {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 0.85; }
          50% { transform: translateY(-15px) scale(1.15) rotate(5deg); opacity: 0.55; }
          100% { transform: translateY(-30px) scale(1.3) rotate(10deg); opacity: 0; }
        }
        .forge-station {
          position: absolute;
          object-fit: contain;
          filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.55));
          opacity: 0.8;
          transition: transform 160ms ease, opacity 160ms ease, filter 160ms ease;
        }
        .forge-station.is-active {
          opacity: 1;
          transform: scale(1.04);
          filter: drop-shadow(0 0 18px rgba(255, 173, 84, 0.42)) drop-shadow(0 8px 14px rgba(0, 0, 0, 0.62));
        }
        .forge-station--furnace { width: 170px; left: 6%; top: 31%; }
        .forge-station--furnace.is-active {
          animation: furnace-burn 1.5s ease-in-out infinite alternate;
        }
        @keyframes furnace-burn {
          0% {
            filter: drop-shadow(0 0 10px rgba(255, 69, 0, 0.65)) drop-shadow(0 8px 14px rgba(0, 0, 0, 0.62));
            transform: scale(1.02);
          }
          50% {
            filter: drop-shadow(0 0 18px rgba(255, 140, 0, 0.88)) drop-shadow(0 8px 14px rgba(0, 0, 0, 0.62));
            transform: scale(1.05) rotate(0.5deg);
          }
          100% {
            filter: drop-shadow(0 0 12px rgba(255, 69, 0, 0.72)) drop-shadow(0 8px 14px rgba(0, 0, 0, 0.62));
            transform: scale(1.03) rotate(-0.5deg);
          }
        }
        .forge-station--anvil { width: 160px; right: 8%; top: 36%; }
        .forge-station--bellows { width: 120px; left: 18%; bottom: 16%; }
        .forge-station--bellows.is-active {
          animation: bellows-pump 0.8s ease-in-out infinite;
          transform-origin: bottom center;
        }
        @keyframes bellows-pump {
          0% { transform: scale(1.04, 1.04); }
          30% { transform: scale(1.12, 0.85); }
          60% { transform: scale(0.95, 1.08); }
          100% { transform: scale(1.04, 1.04); }
        }
        .forge-station--quench { width: 120px; right: 22%; bottom: 9%; }
        .forge-station--quench.is-active {
          animation: quench-bubble 1s ease-in-out infinite alternate;
        }
        @keyframes quench-bubble {
          0% {
            filter: drop-shadow(0 0 8px rgba(0, 191, 255, 0.5)) drop-shadow(0 8px 14px rgba(0, 0, 0, 0.62));
            transform: translateY(0) scale(1.02);
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(30, 144, 255, 0.8)) drop-shadow(0 8px 14px rgba(0, 0, 0, 0.62));
            transform: translateY(-2px) scale(1.04);
          }
          100% {
            filter: drop-shadow(0 0 10px rgba(0, 191, 255, 0.6)) drop-shadow(0 8px 14px rgba(0, 0, 0, 0.62));
            transform: translateY(0) scale(1.03);
          }
        }
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
          animation: object-float 3s ease-in-out infinite;
        }
        @keyframes object-float {
          0% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-6px); }
          100% { transform: translate(-50%, -50%) translateY(0px); }
        }
        .forge-heat-glow-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(255, 69, 0, 0.6) 0%, rgba(255, 0, 0, 0.2) 70%, transparent 100%);
          mix-blend-mode: color-dodge;
          pointer-events: none;
          transition: opacity 200ms ease;
          z-index: 1;
          animation: heat-pulse 2s ease-in-out infinite alternate;
        }
        @keyframes heat-pulse {
          0% { transform: scale(1); filter: brightness(1); }
          100% { transform: scale(1.05); filter: brightness(1.2); }
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
          filter: drop-shadow(0 0 10px rgba(255, 140, 65, 0.18));
          z-index: 2;
        }
        .blacksmith-forge-hud {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .profession-overview-item {
          border: 1px solid rgba(164, 141, 110, 0.22);
          border-radius: 8px;
          background: rgba(25, 20, 16, 0.82);
          padding: 0.55rem;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .profession-overview-item span {
          font-size: 0.74rem;
          color: #bca98a;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .profession-overview-item strong {
          font-size: 1rem;
          color: #fff3dd;
        }
        .blacksmith-action-panel {
          display: grid;
          gap: 10px;
        }
        .blacksmith-tool-strip {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .blacksmith-tool-frame {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          border: 1px solid rgba(164, 141, 110, 0.3);
          background-color: rgba(15, 11, 8, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .blacksmith-tool-frame-image {
          width: 100%;
          height: 100%;
        }
        .blacksmith-action-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        /* ── Forge action buttons ── */
        .forge-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 13px 6px 9px;
          border-radius: 8px;
          border: 1px solid rgba(164, 141, 110, 0.28);
          background: rgba(28, 22, 16, 0.88);
          color: #ddc9a3;
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.03em;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
          position: relative;
          overflow: hidden;
        }
        .forge-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0);
          transition: background 0.12s ease;
          pointer-events: none;
        }
        .forge-btn:hover::after { background: rgba(255,255,255,0.04); }
        .forge-btn:active { transform: scale(0.96); }
        .forge-btn-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          flex-shrink: 0;
          opacity: 0.9;
        }
        .forge-btn-icon svg {
          width: 100%;
          height: 100%;
        }
        .forge-btn-label {
          white-space: nowrap;
        }
        /* Prep */
        .forge-btn--prep {
          border-color: rgba(180, 155, 110, 0.4);
          background: rgba(38, 30, 18, 0.9);
          color: #e2c98a;
        }
        .forge-btn--prep:hover {
          background: rgba(55, 42, 24, 0.95);
          border-color: rgba(210, 175, 120, 0.55);
          box-shadow: 0 0 8px rgba(210, 175, 80, 0.18);
        }
        /* Heat */
        .forge-btn--heat {
          border-color: rgba(220, 80, 20, 0.45);
          background: rgba(45, 18, 8, 0.9);
          color: #f0956a;
        }
        .forge-btn--heat:hover {
          background: rgba(65, 25, 10, 0.95);
          border-color: rgba(255, 110, 40, 0.65);
          box-shadow: 0 0 10px rgba(255, 100, 30, 0.25);
        }
        /* Strike light */
        .forge-btn--strike {
          border-color: rgba(140, 140, 160, 0.4);
          background: rgba(22, 22, 30, 0.9);
          color: #c8c8de;
        }
        .forge-btn--strike:hover {
          border-color: rgba(180, 180, 210, 0.6);
          box-shadow: 0 0 10px rgba(160, 160, 200, 0.2);
        }
        .forge-btn--strike-light { color: #aab5d0; }
        .forge-btn--strike-medium { color: #c0c8e8; border-color: rgba(160, 160, 200, 0.45); }
        .forge-btn--strike-heavy {
          color: #e0e4ff;
          border-color: rgba(180, 180, 255, 0.5);
          background: rgba(20, 20, 40, 0.92);
        }
        .forge-btn--strike-heavy:hover {
          border-color: rgba(200, 200, 255, 0.7);
          box-shadow: 0 0 14px rgba(160, 160, 255, 0.28);
        }
        /* Quench */
        .forge-btn--quench {
          border-color: rgba(40, 100, 180, 0.45);
          background: rgba(10, 20, 40, 0.92);
          color: #80b4e8;
        }
        .forge-btn--quench:hover {
          border-color: rgba(60, 140, 220, 0.65);
          box-shadow: 0 0 12px rgba(40, 120, 200, 0.25);
        }
        .forge-btn--quench-oil {
          color: #c8a060;
          border-color: rgba(160, 110, 30, 0.45);
          background: rgba(30, 20, 8, 0.92);
        }
        .forge-btn--quench-oil:hover {
          border-color: rgba(200, 140, 50, 0.65);
          box-shadow: 0 0 12px rgba(180, 120, 30, 0.25);
        }
        /* Finish */
        .forge-btn--finish {
          border-color: rgba(120, 200, 120, 0.4);
          background: rgba(14, 28, 14, 0.92);
          color: #88dd88;
        }
        .forge-btn--finish:hover {
          border-color: rgba(140, 220, 140, 0.6);
          box-shadow: 0 0 12px rgba(100, 200, 100, 0.22);
        }
        /* Take */
        .forge-btn--take {
          border-color: rgba(210, 168, 54, 0.55);
          background: linear-gradient(135deg, rgba(60, 44, 12, 0.95) 0%, rgba(38, 30, 10, 0.95) 100%);
          color: #f0d060;
          font-weight: 700;
        }
        .forge-btn--take:hover {
          border-color: rgba(240, 195, 70, 0.75);
          box-shadow: 0 0 16px rgba(220, 170, 40, 0.32);
        }
        /* Reset */
        .forge-btn--reset {
          border-color: rgba(160, 60, 60, 0.38);
          background: rgba(30, 12, 12, 0.88);
          color: #d08080;
        }
        .forge-btn--reset:hover {
          border-color: rgba(200, 80, 80, 0.58);
          box-shadow: 0 0 10px rgba(180, 60, 60, 0.2);
        }
        /* ── Result card ── */
        .forge-result-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid rgba(210, 165, 60, 0.45);
          background: linear-gradient(135deg, rgba(30, 22, 10, 0.96) 0%, rgba(18, 14, 8, 0.98) 100%);
          box-shadow: 0 0 22px rgba(200, 155, 40, 0.18), inset 0 0 0 1px rgba(255, 220, 100, 0.06);
          animation: result-appear 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes result-appear {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .forge-result-left { flex-shrink: 0; }
        .forge-result-image-wrap {
          position: relative;
          width: 80px;
          height: 80px;
          border-radius: 10px;
          border: 1px solid rgba(210, 165, 60, 0.35);
          background: rgba(18, 14, 8, 0.9);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .forge-result-image-sheet {
          background-size: 320px auto;
          image-rendering: crisp-edges;
        }
        .forge-result-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .forge-result-image-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(255, 200, 60, 0.18) 0%, transparent 70%);
          pointer-events: none;
          animation: result-glow-pulse 2s ease-in-out infinite alternate;
        }
        @keyframes result-glow-pulse {
          from { opacity: 0.6; }
          to   { opacity: 1; }
        }
        .forge-result-info { flex: 1; min-width: 0; }
        .forge-result-title {
          font-size: 1rem;
          font-weight: 700;
          color: #f5e4be;
          margin-bottom: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .forge-result-quality {
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .quality-legendary .forge-result-quality { color: #f0c844; text-shadow: 0 0 8px rgba(240, 200, 60, 0.5); }
        .quality-masterwork .forge-result-quality { color: #c090f0; }
        .quality-excellent .forge-result-quality { color: #60a8d0; }
        .quality-good .forge-result-quality { color: #70c870; }
        .quality-normal .forge-result-quality { color: #a8a08a; }
        .quality-crude .forge-result-quality { color: #887860; }
        .quality-broken .forge-result-quality { color: #c05050; }
        .forge-result-score {
          font-size: 0.72rem;
          color: #9a8870;
          margin-bottom: 8px;
        }
        .forge-result-materials {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .forge-result-mat-chip {
          font-size: 0.7rem;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid rgba(210, 165, 60, 0.3);
          background: rgba(40, 30, 10, 0.8);
          color: #c8a860;
          white-space: nowrap;
        }
        .forge-result-take-btn {
          flex-shrink: 0;
          flex-direction: column;
          gap: 4px;
          padding: 10px 14px;
        }
        .forge-result-take-btn .forge-btn-icon { width: 28px; height: 28px; }
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
        @keyframes forge-spark-pulse {
          from { opacity: 0.46; transform: scale(0.98) translateY(0); }
          to { opacity: 0.82; transform: scale(1.08) translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
