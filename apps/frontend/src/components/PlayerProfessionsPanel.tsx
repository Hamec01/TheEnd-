import { useEffect, useMemo, useState } from 'react';
import {
  BLACKSMITH_STATS_KEYS,
  applyBlacksmithCraftResult,
  type InventoryState,
  type BlacksmithSessionState,
  normalizePlayerProfessionsState,
  PROFESSION_DEFINITIONS,
  type PlayerProfessionState,
  type PlayerProfessionsState,
  type ProfessionId,
} from '@theend/rpg-domain';
import { BlacksmithForgeTab } from '../features/blacksmith/BlacksmithForgeTab';
import { BlacksmithCustomForgeTab } from '../features/blacksmith/BlacksmithCustomForgeTab';
import { BlacksmithInventoryTab } from '../features/blacksmith/BlacksmithInventoryTab';
import { BlacksmithRecipesTab } from '../features/blacksmith/BlacksmithRecipesTab';
import {
  applyItemWorkToCharacterV2,
  buildWorkedItemV2,
  calculateCustomForgePriceBreakdown,
  calculateItemWorkPriceBreakdown,
  calculateRecipeCraftPriceBreakdown,
  createForgedItemFromBase,
  createForgedItemFromTemplateV2,
  grantCustomForgeItemToCharacterV2,
  grantRecipeOutputsToCharacterV2,
  type BlacksmithItemWorkSelection,
  type BlacksmithPriceBreakdown,
} from '../features/blacksmith/blacksmithRecipeMaterials';
import { resolveBlacksmithSkillBonuses } from '../features/blacksmith/blacksmithSkillEffects';
import {
  canUnlockFinalBlacksmithTrial,
  countSelectedBranchesInExclusiveGroup,
  getBlockedByExclusiveSkillGroupReason,
  getExclusiveGroupMax,
} from '../services/professionSkillTreeUtils';
import { loadProfessionSkillsFromStorage } from '../services/professionSkillRepository';
import { loadProfessionBranchesFromStorage } from '../services/professionBranchRepository';
import { getBlockedBySelectedExclusiveBranchReason } from '../services/miningSkillValidation';
import { loadRuntimeImages, resolveStoredImageSource } from '../services/content/runtimeImageService';
import { getContentSnapshot } from '../services/content/contentApi';
import { subscribeToContentSync } from '../services/content/contentSync';
import {
  getFallbackBlacksmithItemTemplates,
  getFallbackBlacksmithItemWorkActions,
  loadRuntimeBlacksmithContent,
} from '../services/content/runtimeContentService';
import type {
  AdminItem,
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
  StoredImage,
} from '../services/content/models';
import { loadMiningToolsFromStorage } from '../services/miningRepository';
import { loadMiningCareerStats, type MiningCareerStats } from '../services/miningCareerStats';
import { itemsService } from '../services/content/itemsService';
import type { ProfessionBranch, ProfessionSkill } from '../types/profession';
import { SkillTreeView } from '../features/professions/SkillTreeView';
import { GameImageView } from '../admin/components/GameImageView';

interface PlayerProfessionsPanelProps {
  characterId: string;
  inventory: InventoryState;
  runtimeInventoryRevision: number;
  professionsState: PlayerProfessionsState;
  onClose: () => void;
  onStatus: (text: string) => void;
  onChange: (next: PlayerProfessionsState) => void;
  onInventoryChange: (next: InventoryState) => void;
}

function shouldAutoActivateProfessionBranch(professionId: string, branch: ProfessionBranch): boolean {
  if (professionId === 'mining') {
    return branch.id === 'mining_branch_common' || branch.id === 'mining_branch_transition';
  }
  if (professionId === 'blacksmithing') {
    return branch.id === 'blacksmith_start';
  }
  return !branch.exclusiveGroupId;
}

interface PendingBlacksmithReward {
  mode: 'recipe' | 'custom_forge' | 'item_work';
  previewItem: AdminItem;
  priceBreakdown: BlacksmithPriceBreakdown;
  qualityTierId: string;
  score: number;
  xp: number;
  success: boolean;
  draftName: string;
  draftDescription: string;
  finalize: (draft: { name: string; description: string }) => Promise<void>;
}

function formatBlacksmithItemStats(item: AdminItem): string[] {
  const parts: string[] = [];
  if (typeof item.damageMin === 'number' || typeof item.damageMax === 'number') {
    parts.push(`Урон ${item.damageMin ?? 0}-${item.damageMax ?? item.damageMin ?? 0}`);
  }
  if (typeof item.armorValue === 'number') {
    parts.push(`Броня ${item.armorValue}`);
  }
  if (typeof item.attackRange === 'number') {
    parts.push(`Дистанция ${item.attackRange}`);
  }
  parts.push(`Редкость ${item.rarity}`);
  parts.push(`Слот ${item.slot}`);
  parts.push(`Гнёзда ${item.augmentSlots?.length ?? 0}/${item.maxAugmentSlots ?? item.augmentSlots?.length ?? 0}`);
  parts.push(`Цена ${item.price}`);
  return parts;
}

function formatBlacksmithItemProperties(item: AdminItem): string[] {
  const props: string[] = [];
  if (item.type === 'weapon' && item.handsRequired === 2) {
    props.push('Двуручное');
  }
  if (item.canAddAugmentSlots) {
    props.push('Можно расширять гнёзда');
  }
  if (item.canHaveRuneComplex) {
    props.push('Поддерживает рунный комплекс');
  }
  for (const effect of item.equipmentEffects ?? []) {
    if (effect.type === 'stat_bonus' && effect.stat) {
      props.push(`Бонус к ${effect.stat}: ${effect.value ?? 0}`);
    }
    if (effect.type === 'status_resistance' && effect.statusId) {
      props.push(`Сопротивление ${effect.statusId}: ${effect.percent ?? 0}%`);
    }
  }
  return Array.from(new Set(props)).slice(0, 8);
}

export function PlayerProfessionsPanel(props: PlayerProfessionsPanelProps) {
  const { characterId, inventory, runtimeInventoryRevision, professionsState, onClose, onStatus, onChange, onInventoryChange } = props;

  const [selectedProfessionId, setSelectedProfessionId] = useState<ProfessionId | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'recipes' | 'customForge' | 'forge' | 'inventory' | 'stats' | 'tree'>('overview');
  const [professionSkills, setProfessionSkills] = useState<ProfessionSkill[]>([]);
  const [professionBranches, setProfessionBranches] = useState<ProfessionBranch[]>([]);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [miningCareerStats, setMiningCareerStats] = useState<MiningCareerStats | null>(null);
  const [blacksmithRecipes, setBlacksmithRecipes] = useState<CraftingRecipe[]>([]);
  const [blacksmithForgeTiers, setBlacksmithForgeTiers] = useState<BlacksmithForgeTier[]>([]);
  const [blacksmithItemTemplates, setBlacksmithItemTemplates] = useState<BlacksmithItemTemplate[]>([]);
  const [blacksmithItemWorkActions, setBlacksmithItemWorkActions] = useState<BlacksmithItemWorkAction[]>([]);
  const [blacksmithModules, setBlacksmithModules] = useState<BlacksmithModule[]>([]);
  const [blacksmithTools, setBlacksmithTools] = useState<BlacksmithTool[]>([]);
  const [blacksmithQualityTiers, setBlacksmithQualityTiers] = useState<BlacksmithQualityTier[]>([]);
  const [blacksmithBalance, setBlacksmithBalance] = useState<BlacksmithBalance | null>(null);
  const [recipeVisualProfiles, setRecipeVisualProfiles] = useState<RecipeVisualProfile[]>([]);
  const [materialsCatalog, setMaterialsCatalog] = useState<Material[]>([]);
  const [itemsCatalog, setItemsCatalog] = useState<AdminItem[]>([]);
  const [selectedBlacksmithRecipeId, setSelectedBlacksmithRecipeId] = useState<string | null>(null);
  const [preparedCustomForgePlan, setPreparedCustomForgePlan] = useState<BlacksmithCustomForgePlan | null>(null);
  const [preparedCustomForgeTemplateId, setPreparedCustomForgeTemplateId] = useState<string | null>(null);
  const [preparedItemWork, setPreparedItemWork] = useState<BlacksmithItemWorkSelection | null>(null);
  const [blacksmithMode, setBlacksmithMode] = useState<'recipe' | 'custom_forge' | 'item_work'>('recipe');
  const [blacksmithSession, setBlacksmithSession] = useState<BlacksmithSessionState | null>(null);
  const [pendingBlacksmithReward, setPendingBlacksmithReward] = useState<PendingBlacksmithReward | null>(null);

  const definitionById = useMemo(
    () => new Map(PROFESSION_DEFINITIONS.map((entry) => [entry.id, entry])),
    [],
  );

  const refreshProfessionAssets = useMemo(
    () => async () => {
      const [images, runtimeBlacksmith, snapshot] = await Promise.all([
        loadRuntimeImages().catch(() => [] as StoredImage[]),
        loadRuntimeBlacksmithContent(),
        getContentSnapshot(),
      ]);

      setRuntimeImages(images);
        const fallbackTemplates = getFallbackBlacksmithItemTemplates();
        const fallbackItemWorkActions = getFallbackBlacksmithItemWorkActions();
        setBlacksmithForgeTiers(runtimeBlacksmith.forgeTiers);
        setBlacksmithItemTemplates(runtimeBlacksmith.itemTemplates.length > 0 ? runtimeBlacksmith.itemTemplates : fallbackTemplates);
        setBlacksmithItemWorkActions(runtimeBlacksmith.itemWorkActions.length > 0 ? runtimeBlacksmith.itemWorkActions : fallbackItemWorkActions);
      setBlacksmithModules(runtimeBlacksmith.modules);
      setBlacksmithTools(runtimeBlacksmith.tools);
      setBlacksmithQualityTiers(runtimeBlacksmith.qualityTiers);
      setBlacksmithBalance(runtimeBlacksmith.balance);
      setRecipeVisualProfiles(runtimeBlacksmith.recipeVisualProfiles ?? []);
      setMaterialsCatalog(snapshot.materials ?? []);
      setItemsCatalog(snapshot.items ?? []);

      const recipes = (snapshot.craftingRecipes ?? []).filter((entry) => entry.professionId === 'blacksmithing' && entry.isEnabled && entry.status === 'active');
      setBlacksmithRecipes(recipes);
      if (recipes.length > 0) {
        setSelectedBlacksmithRecipeId((current) => current ?? recipes[0].id);
      }
    },
    [],
  );

  useEffect(() => {
    setProfessionSkills(loadProfessionSkillsFromStorage());
    setProfessionBranches(loadProfessionBranchesFromStorage());
    setMiningCareerStats(loadMiningCareerStats(characterId));
    let cancelled = false;
    void refreshProfessionAssets().catch(() => undefined);

    const unsubscribe = subscribeToContentSync((payload) => {
      if (cancelled || (payload.scope !== 'content' && payload.scope !== 'all')) {
        return;
      }
      void refreshProfessionAssets().catch(() => undefined);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [characterId, refreshProfessionAssets]);

  useEffect(() => {
    setMiningCareerStats(loadMiningCareerStats(characterId));
  }, [characterId, professionsState]);

  const unlockedProfessions = useMemo(
    () => professionsState.professions.map((entry) => ({
      state: entry,
      definition: definitionById.get(entry.professionId) ?? null,
    })),
    [definitionById, professionsState.professions],
  );

  const selectedProfession = useMemo(
    () => unlockedProfessions.find((entry) => entry.state.professionId === selectedProfessionId) ?? null,
    [selectedProfessionId, unlockedProfessions],
  );

  useEffect(() => {
    if (!unlockedProfessions.some((entry) => entry.state.professionId === selectedProfessionId)) {
      setSelectedProfessionId(null);
    }
  }, [selectedProfessionId, unlockedProfessions]);

  useEffect(() => {
    setActiveTab('overview');
  }, [selectedProfessionId]);

  const miningBranches = useMemo(
    () => professionBranches.filter((entry) => entry.professionId === 'mining' && entry.isEnabled).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [professionBranches],
  );

  const selectedProfessionBranches = useMemo(() => {
    if (!selectedProfession) {
      return [] as ProfessionBranch[];
    }
    return professionBranches
      .filter((entry) => entry.professionId === selectedProfession.state.professionId && entry.isEnabled)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [professionBranches, selectedProfession]);

  const learnedSkillCount = selectedProfession?.state.learnedSkillIds?.length ?? 0;

  const selectedBlacksmithRecipe = useMemo(
    () => blacksmithRecipes.find((entry) => entry.id === selectedBlacksmithRecipeId) ?? null,
    [blacksmithRecipes, selectedBlacksmithRecipeId],
  );
  const selectedBlacksmithTemplate = useMemo(
    () => blacksmithItemTemplates.find((entry) => entry.id === preparedCustomForgeTemplateId) ?? null,
    [blacksmithItemTemplates, preparedCustomForgeTemplateId],
  );
  const selectedItemWorkAction = useMemo(
    () => blacksmithItemWorkActions.find((entry) => entry.id === preparedItemWork?.actionId) ?? null,
    [blacksmithItemWorkActions, preparedItemWork?.actionId],
  );
  const selectedItemWorkItem = useMemo(
    () => itemsCatalog.find((entry) => entry.id === preparedItemWork?.targetItemId) ?? null,
    [itemsCatalog, preparedItemWork?.targetItemId],
  );

  const blacksmithSkillBonuses = useMemo(
    () => resolveBlacksmithSkillBonuses(selectedProfession?.state.learnedSkillIds ?? [], professionSkills),
    [professionSkills, selectedProfession?.state.learnedSkillIds],
  );

  const blacksmithOverview = useMemo(() => {
    const stats = selectedProfession?.state.professionId === 'blacksmithing'
      ? (selectedProfession.state.stats ?? {})
      : {};

    const totalCrafts = Math.max(0, Math.round(Number(stats[BLACKSMITH_STATS_KEYS.totalCrafts] ?? 0)));
    const successfulCrafts = Math.max(0, Math.round(Number(stats[BLACKSMITH_STATS_KEYS.successfulCrafts] ?? 0)));
    const failedCrafts = Math.max(0, Math.round(Number(stats[BLACKSMITH_STATS_KEYS.failedCrafts] ?? 0)));
    const bestScore = Math.max(0, Math.round(Number(stats[BLACKSMITH_STATS_KEYS.bestScore] ?? 0)));
    const qualityCrafts = Math.max(0, Math.round(Number(stats[BLACKSMITH_STATS_KEYS.qualityCrafts] ?? 0)));
    const masterworkCrafts = Math.max(0, Math.round(Number(stats.blacksmithMasterworkCrafts ?? 0)));

    const bestTier = blacksmithQualityTiers
      .find((entry) => bestScore >= entry.minScore && bestScore <= entry.maxScore)
      ?.name ?? '-';

    const forgeStatus = blacksmithSession
      ? `Активна сессия (${blacksmithSession.stage})`
      : selectedBlacksmithRecipe
        ? `Готова к ковке: ${selectedBlacksmithRecipe.name}`
        : 'Ожидание рецепта';

    const openedWorkTypes = Array.from(new Set([
      ...blacksmithRecipes
        .filter((entry) => (entry.requiredProfessionLevel ?? 1) <= (selectedProfession?.state.level ?? 1))
        .map((entry) => entry.recipeType),
      ...blacksmithSkillBonuses.unlockedActions,
    ])).sort((a, b) => a.localeCompare(b, 'ru'));

    const openedMetals = Array.from(new Set(
      blacksmithForgeTiers
        .filter((entry) => entry.requiredBlacksmithLevel <= (selectedProfession?.state.level ?? 1))
        .flatMap((entry) => entry.allowedMaterialTiers ?? []),
    )).sort((a, b) => a.localeCompare(b, 'ru'));

    return {
      totalCrafts,
      successfulCrafts,
      failedCrafts,
      bestScore,
      bestTier,
      qualityCrafts,
      masterworkCrafts,
      forgeStatus,
      openedWorkTypes,
      openedMetals,
    };
  }, [blacksmithForgeTiers, blacksmithQualityTiers, blacksmithRecipes, blacksmithSession, blacksmithSkillBonuses.unlockedActions, selectedBlacksmithRecipe, selectedProfession]);

  const miningInventorySnapshot = useMemo(() => {
    const last = miningCareerStats?.lastMiningInventory ?? [];
    if (last.length > 0) {
      return last.map((entry) => ({
        ...entry,
        icon: resolveStoredImageSource(entry.iconUrl?.trim(), runtimeImages) ?? entry.iconUrl,
      }));
    }

    return loadMiningToolsFromStorage()
      .filter((entry) => entry.isEnabled)
      .map((entry) => ({
        toolId: entry.id,
        itemId: entry.itemId,
        name: entry.name,
        quantity: 1,
        icon: resolveStoredImageSource(entry.spriteUrl?.trim(), runtimeImages) ?? entry.spriteUrl,
      }));
  }, [miningCareerStats?.lastMiningInventory, runtimeImages]);

  const updateSelectedProfessionState = (updater: (state: PlayerProfessionState) => PlayerProfessionState): void => {
    if (!selectedProfession) {
      return;
    }
    const normalized = normalizePlayerProfessionsState(professionsState);
    const next: PlayerProfessionsState = {
      professions: normalized.professions.map((entry) => (
        entry.professionId === selectedProfession.state.professionId
          ? updater(entry)
          : entry
      )),
    };
    onChange(next);
  };

  const resetPreparedBlacksmithFlows = (): void => {
    setPreparedCustomForgePlan(null);
    setPreparedCustomForgeTemplateId(null);
    setPreparedItemWork(null);
    setBlacksmithSession(null);
  };

  const handleLearnSkill = (skill: ProfessionSkill): void => {
    if (!selectedProfession) {
      onStatus('Сначала выберите профессию.');
      return;
    }

    const professionId = selectedProfession.state.professionId;
    if (skill.professionId !== professionId) {
      onStatus(`Навык ${skill.name} не относится к профессии ${selectedProfession.definition?.name ?? professionId}.`);
      return;
    }

    const learnedIds = new Set(selectedProfession.state.learnedSkillIds ?? []);
    const selectedBranchIds = new Set(selectedProfession.state.selectedBranchIds ?? []);
    const effectiveSelectedBranchIds = new Set(selectedBranchIds);
    const professionSkillsForTree = professionSkills.filter((entry) => entry.professionId === professionId);
    const professionBranchesForTree = selectedProfessionBranches;
    const branchById = new Map(professionBranchesForTree.map((entry) => [entry.id, entry]));

    for (const branch of professionBranchesForTree) {
      if (shouldAutoActivateProfessionBranch(professionId, branch)) {
        effectiveSelectedBranchIds.add(branch.id);
      }
    }

    if (learnedIds.has(skill.id)) {
      onStatus('Навык уже изучен.');
      return;
    }
    if (selectedProfession.state.skillPoints < skill.skillPointCost) {
      onStatus('Недостаточно очков навыков.');
      return;
    }
    if (selectedProfession.state.level < skill.requiredLevel) {
      onStatus(`Требуется уровень профессии ${selectedProfession.definition?.name ?? professionId}: ${skill.requiredLevel}.`);
      return;
    }

    const missingSkill = (skill.requiredSkillIds ?? []).find((requiredId) => !learnedIds.has(requiredId));
    if (missingSkill) {
      onStatus(`Не изучен prerequisite: ${missingSkill}.`);
      return;
    }

    const missingRequiredBranchId = (skill.requiredBranchIds ?? []).find((requiredBranchId) => !effectiveSelectedBranchIds.has(requiredBranchId));
    if (missingRequiredBranchId) {
      const requiredBranch = branchById.get(missingRequiredBranchId);
      onStatus(`Сначала выберите ветку ${requiredBranch?.name ?? missingRequiredBranchId}.`);
      return;
    }

    const blockedByBranch = getBlockedBySelectedExclusiveBranchReason({
      skill,
      branches: professionBranchesForTree,
      selectedBranchIds: Array.from(selectedBranchIds),
    });
    if (blockedByBranch) {
      onStatus(blockedByBranch);
      return;
    }

    const blockedByExclusiveSkill = getBlockedByExclusiveSkillGroupReason({
      skill,
      learnedSkillIds: selectedProfession.state.learnedSkillIds ?? [],
      allSkills: professionSkillsForTree,
    });
    if (blockedByExclusiveSkill) {
      onStatus(blockedByExclusiveSkill);
      return;
    }

    if (skill.branchId) {
      const branch = branchById.get(skill.branchId) ?? null;
      if (!branch) {
        onStatus(`Ветка не найдена: ${skill.branchId}.`);
        return;
      }
      if (!effectiveSelectedBranchIds.has(branch.id)) {
        onStatus(`Сначала выберите ветку ${branch.name}.`);
        return;
      }
      const missingBranchRequirement = (branch.requiredSkillIds ?? []).find((requiredId) => !learnedIds.has(requiredId));
      if (missingBranchRequirement) {
        onStatus(`Ветка ${branch.name} требует навык ${missingBranchRequirement}.`);
        return;
      }
    }

    updateSelectedProfessionState((current) => ({
      ...current,
      skillPoints: Math.max(0, current.skillPoints - skill.skillPointCost),
      learnedSkillIds: Array.from(new Set([...(current.learnedSkillIds ?? []), skill.id])),
    }));
    onStatus(`Изучен навык: ${skill.name}.`);
  };

  const handleSelectBranch = (branch: ProfessionBranch): void => {
    if (!selectedProfession) {
      onStatus('Сначала выберите профессию.');
      return;
    }

    const professionId = selectedProfession.state.professionId;
    if (branch.professionId !== professionId) {
      onStatus(`Ветка ${branch.name} не относится к профессии ${selectedProfession.definition?.name ?? professionId}.`);
      return;
    }

    const selectedIds = new Set(selectedProfession.state.selectedBranchIds ?? []);
    if (selectedIds.has(branch.id)) {
      onStatus(`Ветка ${branch.name} уже выбрана.`);
      return;
    }

    const groupId = branch.exclusiveGroupId?.trim();
    if (groupId) {
      const selectedInGroup = countSelectedBranchesInExclusiveGroup(groupId, selectedProfessionBranches, selectedIds);
      const groupMax = getExclusiveGroupMax(branch);
      if (selectedInGroup >= groupMax) {
        onStatus(`Нельзя выбрать ${branch.name}: в этой группе уже выбрано максимум веток (${groupMax}).`);
        return;
      }
    }

    if (branch.id === 'final_blacksmith_trial' && professionId === 'blacksmithing') {
      const learned = new Set(selectedProfession.state.learnedSkillIds ?? []);
      if (!canUnlockFinalBlacksmithTrial(selectedProfessionBranches, professionSkills, learned, selectedIds)) {
        onStatus('Финальное испытание откроется после 5 навыков в двух выбранных мастерских ветках.');
        return;
      }
    }

    const learned = new Set(selectedProfession.state.learnedSkillIds ?? []);
    const missingSkill = (branch.requiredSkillIds ?? []).find((requiredId) => !learned.has(requiredId));
    if (missingSkill) {
      onStatus(`Для ветки ${branch.name} нужен навык ${missingSkill}.`);
      return;
    }

    const missingBranch = (branch.requiredBranchIds ?? []).find((requiredBranchId) => !selectedIds.has(requiredBranchId));
    if (missingBranch) {
      const requiredBranch = selectedProfessionBranches.find((entry) => entry.id === missingBranch);
      onStatus(`Для ветки ${branch.name} нужна ветка ${requiredBranch?.name ?? missingBranch}.`);
      return;
    }

    const lockedByBranch = (branch.locksBranchIds ?? []).find((lockedBranchId) => selectedIds.has(lockedBranchId));
    if (lockedByBranch) {
      const lockedBranch = selectedProfessionBranches.find((entry) => entry.id === lockedByBranch);
      onStatus(`Нельзя выбрать ${branch.name}: уже выбрана конфликтующая ветка ${lockedBranch?.name ?? lockedByBranch}.`);
      return;
    }

    updateSelectedProfessionState((current) => ({
      ...current,
      selectedBranchIds: Array.from(new Set([...(current.selectedBranchIds ?? []), branch.id])),
    }));
    onStatus(`Вы выбрали ветку: ${branch.name}.`);
  };

  const learnedByProfessionId = useMemo(
    () => new Map(unlockedProfessions.map((entry) => [entry.state.professionId, entry])),
    [unlockedProfessions],
  );

  const translateProfessionCategory = (category: string | undefined): string => {
    switch (category) {
      case 'gathering':
        return 'Добыча';
      case 'crafting':
        return 'Ремесло';
      case 'alchemy':
        return 'Алхимия';
      default:
        return 'Профессия';
    }
  };

  const selectedTabs = selectedProfession?.state.professionId === 'mining'
    ? ['overview', 'inventory', 'stats', 'tree'] as const
    : selectedProfession?.state.professionId === 'blacksmithing'
      ? ['overview', 'inventory', 'recipes', 'customForge', 'forge', 'tree'] as const
      : ['overview', 'tree'] as const;

  const xpToNext = selectedProfession
    ? Math.max(0, Math.floor((selectedProfession.state.xpToNextLevel ?? 0) - (selectedProfession.state.xp ?? 0)))
    : 0;

  const miningRunRate = miningCareerStats && miningCareerStats.totalRuns > 0
    ? Math.round((miningCareerStats.escapedRuns / miningCareerStats.totalRuns) * 100)
    : 0;

  async function persistCraftedPresentation(item: AdminItem | null | undefined, draft: { name: string; description: string }): Promise<AdminItem | null> {
    if (!item) {
      return null;
    }
    const trimmedName = draft.name.trim();
    const trimmedDescription = draft.description.trim();
    if (!trimmedName && !trimmedDescription) {
      return item;
    }
    const next: AdminItem = {
      ...item,
      name: trimmedName || item.name,
      loreDescription: trimmedDescription ? `${trimmedDescription} ${item.loreDescription}`.trim() : item.loreDescription,
    };
    try {
      return await itemsService.update(item.id, next);
    } catch {
      return next;
    }
  }

  function applyBlacksmithProgressAndStatus(payload: {
    xp: number;
    score: number;
    success: boolean;
    qualityTierId: string;
    rewardMessage: string;
  }) {
    const normalized = normalizePlayerProfessionsState(professionsState);
    const next = applyBlacksmithCraftResult(normalized, 'blacksmithing', {
      xpReward: payload.xp,
      score: payload.score,
      success: payload.success,
      isQualityCraft: payload.qualityTierId === 'quality_fine' || payload.qualityTierId === 'quality_masterwork',
      isMasterwork: payload.qualityTierId === 'quality_masterwork',
    });
    onChange(next);
    onStatus(`Ковка завершена: ${payload.score}/100 (${payload.qualityTierId}). Получено XP: ${payload.xp}.${payload.rewardMessage}`);
  }

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true">
      <section className="card battle-window wm-modal profession-modal">
        <div className="battle-window-head">
          <h2>Профессии</h2>
          <button onClick={onClose} disabled={Boolean(pendingBlacksmithReward)}>×</button>
        </div>

        {unlockedProfessions.length === 0 ? <p>У вас пока нет профессий. Найдите наставника, чтобы изучить первую профессию.</p> : null}

        {!selectedProfession ? (
          <section className="profession-cards-grid">
            {PROFESSION_DEFINITIONS.map((definition) => {
              const unlocked = learnedByProfessionId.get(definition.id) ?? null;
              if (!unlocked) {
                return <div key={definition.id} className="profession-card profession-card-empty" aria-hidden="true" />;
              }
              const xpRemain = Math.max(0, Math.floor((unlocked.state.xpToNextLevel ?? 0) - (unlocked.state.xp ?? 0)));
              return (
                <button
                  key={definition.id}
                  type="button"
                  className="profession-card"
                  onClick={() => setSelectedProfessionId(definition.id)}
                >
                  <div className="profession-card-icon">{definition.icon || '📚'}</div>
                  <h3>{definition.name}</h3>
                  <p className="profession-card-id">{definition.id.toUpperCase()}</p>
                  <p className="profession-card-description">{definition.description}</p>
                  <div className="profession-card-meta">
                    <span>{translateProfessionCategory(definition.category)}</span>
                    <span>Ур. {unlocked.state.level}</span>
                    <span>До ур.: {xpRemain}</span>
                  </div>
                </button>
              );
            })}
          </section>
        ) : null}

        {selectedProfession ? (
          <section className="inner-card profession-details-card">
            <header className="profession-details-head">
              <div className="profession-focus-title">
                <button
                  type="button"
                  className="profession-back-button"
                  onClick={() => setSelectedProfessionId(null)}
                >
                  ← Назад к профессиям
                </button>
                <h3>{selectedProfession.definition?.name ?? selectedProfession.state.professionId}</h3>
                <p className="wm-stat-hint">{selectedProfession.definition?.description ?? 'Профессия персонажа'}</p>
              </div>
              <div className="profession-tabs" role="tablist" aria-label="Вкладки профессии">
                {selectedTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={activeTab === tab ? 'profession-tab profession-tab-active' : 'profession-tab'}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'overview' ? 'Обзор' : null}
                    {tab === 'recipes' ? 'Рецепты' : null}
                    {tab === 'customForge' ? 'Свободная ковка' : null}
                    {tab === 'forge' ? (selectedProfession.state.professionId === 'blacksmithing' ? 'Кузня' : 'Горн') : null}
                    {tab === 'inventory' ? (selectedProfession.state.professionId === 'blacksmithing' ? 'Инвентарь' : 'Инвентарь Горняка') : null}
                    {tab === 'stats' ? (selectedProfession.state.professionId === 'blacksmithing' ? 'Статистика ковки' : 'Статистика спусков') : null}
                    {tab === 'tree' ? 'Древо навыков' : null}
                  </button>
                ))}
              </div>
            </header>

            {activeTab === 'overview' ? (
              <div className="profession-overview-grid">
                <div className="profession-overview-item"><span>Уровень</span><strong>{selectedProfession.state.level}</strong></div>
                <div className="profession-overview-item"><span>XP</span><strong>{selectedProfession.state.xp} / {selectedProfession.state.xpToNextLevel}</strong></div>
                <div className="profession-overview-item"><span>До следующего уровня</span><strong>{xpToNext}</strong></div>
                <div className="profession-overview-item"><span>Очки навыков</span><strong>{selectedProfession.state.skillPoints}</strong></div>
                <div className="profession-overview-item"><span>Изучено навыков</span><strong>{learnedSkillCount}</strong></div>
                <div className="profession-overview-item"><span>Выбрано веток</span><strong>{selectedProfession.state.selectedBranchIds?.length ?? 0}</strong></div>
                {selectedProfession.state.professionId === 'blacksmithing' ? (
                  <>
                    <div className="profession-overview-item"><span>Лучший ранг качества</span><strong>{blacksmithOverview.bestTier}</strong></div>
                    <div className="profession-overview-item"><span>Всего выковано</span><strong>{blacksmithOverview.totalCrafts}</strong></div>
                    <div className="profession-overview-item"><span>Брак</span><strong>{blacksmithOverview.failedCrafts}</strong></div>
                    <div className="profession-overview-item"><span>Мастерских результатов</span><strong>{blacksmithOverview.masterworkCrafts}</strong></div>
                    <div className="profession-overview-item"><span>Текущий статус кузни</span><strong>{blacksmithOverview.forgeStatus}</strong></div>
                    <div className="profession-overview-item"><span>Открытые типы работ</span><strong>{blacksmithOverview.openedWorkTypes.length > 0 ? blacksmithOverview.openedWorkTypes.join(', ') : 'нет'}</strong></div>
                    <div className="profession-overview-item"><span>Открытые металлы</span><strong>{blacksmithOverview.openedMetals.length > 0 ? blacksmithOverview.openedMetals.join(', ') : 'нет'}</strong></div>
                    <div className="profession-overview-item"><span>Лучший score</span><strong>{blacksmithOverview.bestScore}</strong></div>
                    <div className="profession-overview-item"><span>Успешных ковок</span><strong>{blacksmithOverview.successfulCrafts}</strong></div>
                    <div className="profession-overview-item"><span>Качественных изделий</span><strong>{blacksmithOverview.qualityCrafts}</strong></div>
                  </>
                ) : null}
              </div>
            ) : null}

            {activeTab === 'inventory' && selectedProfession.state.professionId === 'mining' ? (
              <div className="profession-mining-tools-list">
                {miningInventorySnapshot.length === 0 ? (
                  <p className="wm-stat-hint">Инструменты Горняка пока не зафиксированы.</p>
                ) : (
                  miningInventorySnapshot.map((entry) => (
                    <article key={`${entry.toolId}:${entry.itemId}`} className="profession-mining-tool-item">
                      <div className="profession-mining-tool-icon">
                        {entry.icon ? <img src={entry.icon} alt={entry.name} /> : <span>⛏</span>}
                      </div>
                      <div>
                        <strong>{entry.name}</strong>
                        <p className="wm-stat-hint" style={{ margin: 0 }}>x{entry.quantity} • {entry.itemId}</p>
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : null}

            {activeTab === 'recipes' && selectedProfession.state.professionId === 'blacksmithing' ? (
              <div className="profession-tab-panel">
                <BlacksmithRecipesTab
                recipes={blacksmithRecipes}
                recipeVisualProfiles={recipeVisualProfiles}
                materials={materialsCatalog}
                items={itemsCatalog}
                runtimeImages={runtimeImages}
                selectedRecipe={selectedBlacksmithRecipe}
                selectedRecipeId={selectedBlacksmithRecipeId}
                onSelectRecipe={(recipeId) => {
                  setSelectedBlacksmithRecipeId(recipeId);
                  resetPreparedBlacksmithFlows();
                  setBlacksmithMode('recipe');
                }}
                />
              </div>
            ) : null}

            {activeTab === 'customForge' && selectedProfession.state.professionId === 'blacksmithing' ? (
              <div className="profession-tab-panel">
                <BlacksmithCustomForgeTab
                  templates={blacksmithItemTemplates}
                  materials={materialsCatalog}
                  runtimeImages={runtimeImages}
                  inventory={inventory}
                  inventoryRevision={runtimeInventoryRevision}
                  blacksmithLevel={selectedProfession.state.level}
                  initialTemplateId={preparedCustomForgeTemplateId}
                  onPreparePlan={({ template, plan }) => {
                    setPreparedCustomForgeTemplateId(template.id);
                    setPreparedCustomForgePlan(plan);
                    setPreparedItemWork(null);
                    setBlacksmithMode('custom_forge');
                    setBlacksmithSession(null);
                    setActiveTab('forge');
                    onStatus(`Подготовлен план свободной ковки: ${template.name}.`);
                  }}
                />
              </div>
            ) : null}

            {activeTab === 'forge' && selectedProfession.state.professionId === 'blacksmithing' ? (
              <div className="profession-tab-panel">
                <BlacksmithForgeTab
                selectedRecipe={selectedBlacksmithRecipe}
                mode={blacksmithMode}
                customForgePlan={preparedCustomForgePlan}
                customForgeTemplate={selectedBlacksmithTemplate}
                itemWorkAction={selectedItemWorkAction}
                itemWorkItem={selectedItemWorkItem}
                session={blacksmithSession}
                forgeTiers={blacksmithForgeTiers}
                modules={blacksmithModules}
                tools={blacksmithTools}
                qualityTiers={blacksmithQualityTiers}
                balance={blacksmithBalance}
                recipeVisualProfiles={recipeVisualProfiles}
                materials={materialsCatalog}
                items={itemsCatalog}
                runtimeImages={runtimeImages}
                inventory={inventory}
                inventoryRevision={runtimeInventoryRevision}
                resolveImageRef={(value) => resolveStoredImageSource(value?.trim(), runtimeImages) ?? value}
                skillBonuses={blacksmithSkillBonuses}
                onSessionChange={setBlacksmithSession}
                onInventoryChange={onInventoryChange}
                onComplete={async ({ xp, score, qualityTierId, success, mode }) => {
                  const qualityTier = blacksmithQualityTiers.find((entry) => entry.id === qualityTierId) ?? null;
                  const openRewardModal = (
                    previewItem: AdminItem,
                    priceBreakdown: BlacksmithPriceBreakdown,
                    finalizeGrant: (draft: { name: string; description: string }) => Promise<{ rewardMessage: string; createdItem?: AdminItem | null }>,
                  ) => {
                    setPendingBlacksmithReward({
                      mode,
                      previewItem,
                      priceBreakdown,
                      qualityTierId,
                      score,
                      xp,
                      success,
                      draftName: previewItem.name,
                      draftDescription: '',
                      finalize: async (draft) => {
                        const result = await finalizeGrant(draft);
                        if (result.createdItem) {
                          await persistCraftedPresentation(result.createdItem, draft);
                        }
                        setPendingBlacksmithReward(null);
                        applyBlacksmithProgressAndStatus({
                          xp,
                          score,
                          success,
                          qualityTierId,
                          rewardMessage: result.rewardMessage,
                        });
                      },
                    });
                  };

                  if (mode === 'recipe' && success && selectedBlacksmithRecipe) {
                    const craftedOutput = selectedBlacksmithRecipe.outputItems?.find((entry) => {
                      const item = itemsCatalog.find((candidate) => candidate.id === entry.itemId) ?? null;
                      return item && !item.stackable && (item.type === 'weapon' || item.type === 'armor') && (entry.quantity ?? 0) === 1;
                    });

                    if (craftedOutput) {
                      const baseItem = itemsCatalog.find((entry) => entry.id === craftedOutput.itemId) ?? null;
                      if (baseItem) {
                        const priceBreakdown = calculateRecipeCraftPriceBreakdown({
                          recipe: selectedBlacksmithRecipe,
                          itemsCatalog,
                          materialsCatalog,
                          score,
                          qualityTier,
                        });
                        const recipePreviewMaterials = (selectedBlacksmithRecipe.inputMaterials ?? []).flatMap((entry) => {
                          const material = materialsCatalog.find((candidate) => candidate.id === entry.materialId) ?? null;
                          return material ? Array.from({ length: Math.max(1, Math.floor(entry.quantity ?? 1)) }, () => material) : [];
                        });
                        const previewItem = createForgedItemFromBase(
                          baseItem,
                          selectedBlacksmithRecipe,
                          qualityTier,
                          characterId,
                          { priceOverride: priceBreakdown.totalPrice },
                          recipePreviewMaterials,
                          selectedProfession.state.level,
                        );
                        openRewardModal({ ...previewItem, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, priceBreakdown, async (draft) => {
                          const rewardResult = await grantRecipeOutputsToCharacterV2({
                            characterId,
                            recipe: selectedBlacksmithRecipe,
                            baseInventory: inventory,
                            itemsCatalog,
                            materialsCatalog,
                            qualityTier,
                            blacksmithLevel: selectedProfession.state.level,
                            overrides: {
                              customName: draft.name.trim() || undefined,
                              customDescription: draft.description.trim() || undefined,
                              priceOverride: priceBreakdown.totalPrice,
                            },
                          });
                          if (rewardResult.inventory) {
                            onInventoryChange(rewardResult.inventory);
                          }
                          return {
                            rewardMessage: ` Создан предмет: ${draft.name.trim() || rewardResult.createdItem?.name || baseItem.name}.`,
                            createdItem: rewardResult.createdItem,
                          };
                        });
                        return;
                      }
                    }
                  }

                  if (mode === 'custom_forge' && preparedCustomForgePlan && selectedBlacksmithTemplate && success && !(qualityTier?.isFailureTier ?? false) && score >= 20) {
                    const priceBreakdown = calculateCustomForgePriceBreakdown({
                      plan: preparedCustomForgePlan,
                      template: selectedBlacksmithTemplate,
                      materialsCatalog,
                      score,
                      qualityTier,
                    });
                    const previewItem = createForgedItemFromTemplateV2({
                      template: selectedBlacksmithTemplate,
                      plan: preparedCustomForgePlan,
                      materials: materialsCatalog,
                      qualityTier,
                      score,
                      characterId,
                      blacksmithLevel: selectedProfession.state.level,
                      overrides: { priceOverride: priceBreakdown.totalPrice },
                    });
                    openRewardModal({ ...previewItem, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, priceBreakdown, async (draft) => {
                      const forgeResult = await grantCustomForgeItemToCharacterV2({
                        characterId,
                        template: selectedBlacksmithTemplate,
                        plan: preparedCustomForgePlan,
                        materialsCatalog,
                        qualityTier,
                        score,
                        blacksmithLevel: selectedProfession.state.level,
                        overrides: {
                          customName: draft.name.trim() || undefined,
                          customDescription: draft.description.trim() || undefined,
                          priceOverride: priceBreakdown.totalPrice,
                        },
                      });
                      if (forgeResult.inventory) {
                        onInventoryChange(forgeResult.inventory);
                      }
                      setPreparedCustomForgePlan(null);
                      setPreparedCustomForgeTemplateId(null);
                      setBlacksmithMode('recipe');
                      return {
                        rewardMessage: ` Создан предмет: ${draft.name.trim() || forgeResult.createdItem?.name || selectedBlacksmithTemplate.name}.`,
                        createdItem: forgeResult.createdItem,
                      };
                    });
                    return;
                  }

                  if (mode === 'item_work' && selectedItemWorkAction && selectedItemWorkItem && selectedItemWorkAction.actionType !== 'dismantle') {
                    const priceBreakdown = calculateItemWorkPriceBreakdown({
                      action: selectedItemWorkAction,
                      materialsCatalog,
                      itemsCatalog,
                      score,
                      qualityTier,
                    });
                    const previewItem = buildWorkedItemV2(
                      selectedItemWorkItem,
                      selectedItemWorkAction,
                      score,
                      selectedProfession.state.level,
                      { priceOverride: priceBreakdown.totalPrice },
                    );
                    openRewardModal({ ...previewItem, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, priceBreakdown, async (draft) => {
                      const workResult = await applyItemWorkToCharacterV2({
                        characterId,
                        action: selectedItemWorkAction,
                        baseItem: selectedItemWorkItem,
                        score,
                        blacksmithLevel: selectedProfession.state.level,
                        inventory,
                        overrides: {
                          customName: draft.name.trim() || undefined,
                          customDescription: draft.description.trim() || undefined,
                          priceOverride: priceBreakdown.totalPrice,
                        },
                      });
                      if (workResult.inventory) {
                        onInventoryChange(workResult.inventory);
                      }
                      setPreparedItemWork(null);
                      setBlacksmithMode('recipe');
                      return {
                        rewardMessage: ` ${workResult.message}`,
                        createdItem: workResult.createdItem,
                      };
                    });
                    return;
                  }

                  let rewardMessage = '';
                  if (mode === 'recipe' && success && selectedBlacksmithRecipe) {
                    const rewardResult = await grantRecipeOutputsToCharacterV2({
                      characterId,
                      recipe: selectedBlacksmithRecipe,
                      baseInventory: inventory,
                      itemsCatalog,
                      materialsCatalog,
                      qualityTier,
                      blacksmithLevel: selectedProfession.state.level,
                    });
                    if (rewardResult.inventory) {
                      onInventoryChange(rewardResult.inventory);
                    }
                    rewardMessage = ' Результат рецепта добавлен в инвентарь.';
                  }
                  if (mode === 'custom_forge' && preparedCustomForgePlan && selectedBlacksmithTemplate) {
                    const forgeResult = await grantCustomForgeItemToCharacterV2({
                      characterId,
                      template: selectedBlacksmithTemplate,
                      plan: preparedCustomForgePlan,
                      materialsCatalog,
                      qualityTier,
                      score,
                      blacksmithLevel: selectedProfession.state.level,
                    });
                    if (forgeResult.inventory) {
                      onInventoryChange(forgeResult.inventory);
                    }
                    rewardMessage = forgeResult.success
                      ? ` Создан предмет: ${forgeResult.createdItem?.name ?? selectedBlacksmithTemplate.name}.`
                      : ' Свободная ковка завершилась браком, часть материалов возвращена.';
                    setPreparedCustomForgePlan(null);
                    setPreparedCustomForgeTemplateId(null);
                    setBlacksmithMode('recipe');
                  }
                  if (mode === 'item_work' && selectedItemWorkAction && selectedItemWorkItem) {
                    const workResult = await applyItemWorkToCharacterV2({
                      characterId,
                      action: selectedItemWorkAction,
                      baseItem: selectedItemWorkItem,
                      score,
                      blacksmithLevel: selectedProfession.state.level,
                      inventory,
                    });
                    if (workResult.inventory) {
                      onInventoryChange(workResult.inventory);
                    }
                    rewardMessage = ` ${workResult.message}`;
                    setPreparedItemWork(null);
                    setBlacksmithMode('recipe');
                  }
                  const normalized = normalizePlayerProfessionsState(professionsState);
                  const next = applyBlacksmithCraftResult(normalized, 'blacksmithing', {
                    xpReward: xp,
                    score,
                    success,
                    isQualityCraft: qualityTierId === 'quality_fine' || qualityTierId === 'quality_masterwork',
                    isMasterwork: qualityTierId === 'quality_masterwork',
                  });
                  onChange(next);
                  onStatus(`Ковка завершена: ${score}/100 (${qualityTierId}). Получено XP: ${xp}.${rewardMessage}`);
                }}
                />
              </div>
            ) : null}

            {activeTab === 'inventory' && selectedProfession.state.professionId === 'blacksmithing' ? (
              <div className="profession-tab-panel">
                <BlacksmithInventoryTab
                selectedRecipe={selectedBlacksmithRecipe}
                materials={materialsCatalog}
                items={itemsCatalog}
                itemWorkActions={blacksmithItemWorkActions}
                runtimeImages={runtimeImages}
                inventory={inventory}
                inventoryRevision={runtimeInventoryRevision}
                onPrepareItemWork={({ item, action }) => {
                  setPreparedItemWork({
                    targetItemId: item.id,
                    actionId: action.id,
                  });
                  setPreparedCustomForgePlan(null);
                  setPreparedCustomForgeTemplateId(null);
                  setBlacksmithMode('item_work');
                  setBlacksmithSession(null);
                  setActiveTab('forge');
                  onStatus(`Подготовлена кузнечная работа: ${action.name} для ${item.name}.`);
                }}
                />
              </div>
            ) : null}

            {activeTab === 'stats' && selectedProfession.state.professionId === 'mining' ? (
              <div className="profession-overview-grid">
                <div className="profession-overview-item"><span>Всего спусков</span><strong>{miningCareerStats?.totalRuns ?? 0}</strong></div>
                <div className="profession-overview-item"><span>Успешных выходов</span><strong>{miningCareerStats?.escapedRuns ?? 0}</strong></div>
                <div className="profession-overview-item"><span>Шанс успеха</span><strong>{miningRunRate}%</strong></div>
                <div className="profession-overview-item"><span>Потеряно HP</span><strong>{miningCareerStats?.totalHpLost ?? 0}</strong></div>
                <div className="profession-overview-item"><span>Потеряно выносливости</span><strong>{miningCareerStats?.totalStaminaLost ?? 0}</strong></div>
                <div className="profession-overview-item"><span>Самая глубокая глубина</span><strong>{miningCareerStats?.deepestDepthReached ?? 0}</strong></div>
                <div className="profession-overview-item"><span>Золото из шахт</span><strong>{miningCareerStats?.totalGoldEarned ?? 0}</strong></div>
                <div className="profession-overview-item"><span>Опыт Горняка из шахт</span><strong>{miningCareerStats?.totalXpEarned ?? 0}</strong></div>
                <div className="profession-overview-item"><span>Последний статус</span><strong>{miningCareerStats?.lastStatus ?? '-'}</strong></div>
                <div className="profession-overview-item"><span>Последний спуск</span><strong>{miningCareerStats?.lastRunAt ? new Date(miningCareerStats.lastRunAt).toLocaleString('ru-RU') : '-'}</strong></div>
              </div>
            ) : null}

            {activeTab === 'tree' ? (
              <SkillTreeView
                professionId={selectedProfession.state.professionId}
                professionName={selectedProfession.definition?.name ?? selectedProfession.state.professionId}
                skills={professionSkills}
                branches={selectedProfessionBranches}
                playerProfessionState={selectedProfession.state}
                onLearnSkill={(skillId) => {
                  const skill = professionSkills.find((entry) => entry.id === skillId);
                  if (!skill) {
                    onStatus(`Навык не найден: ${skillId}.`);
                    return;
                  }
                  handleLearnSkill(skill);
                }}
                onChooseBranch={(branchId) => {
                  const branch = selectedProfessionBranches.find((entry) => entry.id === branchId);
                  if (!branch) {
                    onStatus(`Ветка не найдена: ${branchId}.`);
                    return;
                  }
                  handleSelectBranch(branch);
                }}
                onBack={undefined}
                resolveIcon={(icon) => resolveStoredImageSource(icon?.trim(), runtimeImages) ?? icon}
                runtimeImages={runtimeImages}
                isDev={false}
              />
            ) : null}
          </section>
        ) : null}

        {pendingBlacksmithReward ? (
          <div className="profession-reward-overlay" role="dialog" aria-modal="true">
            <section className="profession-reward-modal">
              <div className="profession-reward-head">
                <div>
                  <h3>{pendingBlacksmithReward.previewItem.name}</h3>
                  <p className="wm-stat-hint" style={{ margin: 0 }}>
                    Итог ковки: {pendingBlacksmithReward.score}/100 • {pendingBlacksmithReward.qualityTierId}
                  </p>
                </div>
              </div>

              <div className="profession-reward-body">
                <div className="profession-reward-visual">
                  <GameImageView
                    imageRef={pendingBlacksmithReward.previewItem.imageRef}
                    legacyImagePath={pendingBlacksmithReward.previewItem.imagePath}
                    runtimeImages={runtimeImages}
                    alt={pendingBlacksmithReward.previewItem.name}
                    size={132}
                    fit="contain"
                    fallbackText={(pendingBlacksmithReward.previewItem.name.trim().charAt(0) || 'К').toUpperCase()}
                  />
                </div>

                <div className="profession-reward-copy">
                  <div className="profession-reward-chip-grid">
                    {formatBlacksmithItemStats(pendingBlacksmithReward.previewItem).map((entry) => (
                      <span key={entry}>{entry}</span>
                    ))}
                  </div>

                  <div className="profession-reward-properties">
                    <strong>Свойства</strong>
                    <div className="profession-reward-chip-grid">
                      {formatBlacksmithItemProperties(pendingBlacksmithReward.previewItem).length > 0
                        ? formatBlacksmithItemProperties(pendingBlacksmithReward.previewItem).map((entry) => <span key={entry}>{entry}</span>)
                        : <span>Без дополнительных свойств</span>}
                    </div>
                  </div>

                  <div className="profession-reward-price">
                    <strong>Цена предмета</strong>
                    <div className="profession-reward-price-grid">
                      <div><span>Материалы</span><strong>{pendingBlacksmithReward.priceBreakdown.materialsCost}</strong></div>
                      <div><span>Работа кузнеца</span><strong>{pendingBlacksmithReward.priceBreakdown.laborCost}</strong></div>
                      <div><span>Итог</span><strong>{pendingBlacksmithReward.priceBreakdown.totalPrice}</strong></div>
                    </div>
                  </div>

                  <label className="profession-reward-field">
                    <span>Имя предмета</span>
                    <input
                      value={pendingBlacksmithReward.draftName}
                      maxLength={64}
                      onChange={(event) => setPendingBlacksmithReward((current) => current ? { ...current, draftName: event.target.value } : current)}
                    />
                  </label>

                  <label className="profession-reward-field">
                    <span>Описание предмета</span>
                    <textarea
                      rows={4}
                      value={pendingBlacksmithReward.draftDescription}
                      placeholder="Что делает этот клинок особенным?"
                      onChange={(event) => setPendingBlacksmithReward((current) => current ? { ...current, draftDescription: event.target.value } : current)}
                    />
                  </label>
                </div>
              </div>

              <div className="profession-reward-actions">
                <button
                  type="button"
                  onClick={() => {
                    void pendingBlacksmithReward.finalize({
                      name: pendingBlacksmithReward.draftName,
                      description: pendingBlacksmithReward.draftDescription,
                    });
                  }}
                >
                  Завершить ковку и забрать предмет
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <style>{`
          .profession-modal {
            position: relative;
            width: min(1500px, 96vw);
            height: min(920px, 94vh);
            max-width: 96vw;
            max-height: 94vh;
            overflow: hidden;
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            gap: 0.8rem;
          }
          .profession-cards-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0.8rem;
          }
          .profession-card {
            border: 1px solid rgba(164, 141, 110, 0.3);
            border-radius: 10px;
            background: linear-gradient(180deg, rgba(48, 35, 24, 0.84), rgba(20, 16, 12, 0.96));
            color: #eadbc2;
            text-align: center;
            padding: 0.75rem;
            display: grid;
            gap: 0.3rem;
            align-content: start;
            min-height: 182px;
          }
          .profession-card-empty {
            background: transparent;
            border-color: transparent;
            pointer-events: none;
          }
          .profession-card-icon {
            font-size: 38px;
            line-height: 1;
          }
          .profession-card h3 {
            margin: 0;
            font-size: 1.15rem;
          }
          .profession-card-id {
            margin: 0;
            font-size: 0.78rem;
            color: #baac93;
          }
          .profession-card-description {
            margin: 0;
            font-size: 0.9rem;
          }
          .profession-card-meta {
            margin-top: 0.2rem;
            display: flex;
            justify-content: center;
            gap: 0.35rem;
            flex-wrap: wrap;
            font-size: 0.76rem;
            color: #bca989;
          }
          .profession-card-meta span {
            border: 1px solid rgba(164, 141, 110, 0.2);
            border-radius: 6px;
            padding: 0.14rem 0.35rem;
            background: rgba(38, 30, 24, 0.62);
          }
          .profession-details-card {
            min-height: 0;
            overflow: hidden;
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            gap: 0.65rem;
          }
          .profession-tab-panel {
            min-height: 0;
            overflow: auto;
            padding-right: 0.2rem;
          }
          .profession-details-head {
            display: flex;
            justify-content: space-between;
            gap: 0.8rem;
            flex-wrap: wrap;
            align-items: flex-start;
          }
          .profession-focus-title {
            display: grid;
            gap: 0.35rem;
          }
          .profession-back-button {
            justify-self: flex-start;
            font-size: 0.9rem;
            padding: 0.28rem 0.62rem;
          }
          .profession-details-head h3 {
            margin: 0;
          }
          .profession-tabs {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            align-items: flex-start;
          }
          .profession-tab {
            font-size: 0.82rem;
            padding: 0.32rem 0.58rem;
          }
          .profession-tab-active {
            box-shadow: inset 0 0 0 1px rgba(241, 197, 130, 0.86);
          }
          .profession-overview-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.6rem;
            overflow: auto;
            padding-right: 0.2rem;
          }
          .profession-overview-item {
            border: 1px solid rgba(164, 141, 110, 0.22);
            border-radius: 8px;
            background: rgba(25, 20, 16, 0.82);
            padding: 0.55rem;
            display: grid;
            gap: 0.28rem;
          }
          .profession-overview-item span {
            font-size: 0.8rem;
            color: #bca98a;
          }
          .profession-overview-item strong {
            font-size: 1.02rem;
          }
          .profession-mining-tools-list {
            display: grid;
            gap: 0.5rem;
            overflow: auto;
            padding-right: 0.2rem;
          }
          .profession-mining-tool-item {
            border: 1px solid rgba(164, 141, 110, 0.22);
            border-radius: 8px;
            background: rgba(25, 20, 16, 0.82);
            padding: 0.5rem;
            display: grid;
            grid-template-columns: 44px 1fr;
            gap: 0.6rem;
            align-items: center;
          }
          .profession-mining-tool-icon {
            width: 44px;
            height: 44px;
            border-radius: 8px;
            border: 1px solid rgba(164, 141, 110, 0.24);
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(16, 12, 9, 0.9);
          }
          .profession-mining-tool-icon img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .profession-reward-overlay {
            position: fixed;
            inset: 0;
            display: grid;
            place-items: center;
            background: rgba(8, 6, 5, 0.72);
            backdrop-filter: blur(8px);
            z-index: 9999;
            padding: 2rem;
          }
          .profession-reward-modal {
            width: min(880px, calc(100vw - 48px));
            max-height: min(860px, calc(100vh - 48px));
            overflow: auto;
            border: 1px solid rgba(205, 154, 89, 0.42);
            border-radius: 22px;
            background:
              radial-gradient(circle at top left, rgba(255, 170, 91, 0.1), transparent 30%),
              linear-gradient(180deg, rgba(46, 30, 21, 0.985), rgba(20, 14, 11, 0.99));
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
            padding: 1.35rem;
            display: grid;
            gap: 1.1rem;
          }
          .profession-reward-head h3 {
            margin: 0 0 0.25rem;
            font-size: 1.45rem;
          }
          .profession-reward-body {
            display: grid;
            grid-template-columns: 210px minmax(0, 1fr);
            gap: 1.1rem;
            align-items: start;
          }
          .profession-reward-visual {
            border: 1px solid rgba(224, 179, 108, 0.28);
            border-radius: 18px;
            background:
              radial-gradient(circle at 50% 35%, rgba(255, 145, 67, 0.18), rgba(15, 11, 9, 0.96));
            min-height: 210px;
            display: grid;
            place-items: center;
            padding: 0.85rem;
          }
          .profession-reward-copy {
            display: grid;
            gap: 0.9rem;
          }
          .profession-reward-chip-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
          }
          .profession-reward-chip-grid span {
            border: 1px solid rgba(164, 141, 110, 0.28);
            border-radius: 999px;
            background: rgba(56, 38, 24, 0.74);
            color: #f1e1c4;
            padding: 0.32rem 0.66rem;
            font-size: 0.82rem;
          }
          .profession-reward-properties,
          .profession-reward-price {
            display: grid;
            gap: 0.5rem;
          }
          .profession-reward-price-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.6rem;
          }
          .profession-reward-price-grid > div {
            border: 1px solid rgba(164, 141, 110, 0.2);
            border-radius: 12px;
            background: rgba(24, 19, 14, 0.72);
            padding: 0.7rem;
            display: grid;
            gap: 0.25rem;
          }
          .profession-reward-price-grid span,
          .profession-reward-field span {
            color: #c8b18e;
            font-size: 0.8rem;
          }
          .profession-reward-field {
            display: grid;
            gap: 0.35rem;
          }
          .profession-reward-field input,
          .profession-reward-field textarea {
            border-radius: 12px;
            border: 1px solid rgba(183, 142, 86, 0.42);
            background: rgba(255, 255, 255, 0.03);
            color: #f1e1c4;
            padding: 0.78rem 0.9rem;
          }
          .profession-reward-actions {
            display: flex;
            justify-content: flex-end;
          }
          .profession-reward-actions button {
            min-width: 260px;
            padding: 0.85rem 1rem;
            border-radius: 12px;
            font-weight: 700;
          }
          @media (max-width: 1180px) {
            .profession-cards-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .profession-overview-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .profession-reward-body,
            .profession-reward-price-grid {
              grid-template-columns: 1fr;
            }
          }
          @media (max-width: 780px) {
            .profession-modal {
              width: 98vw;
              height: 96vh;
              max-width: 98vw;
              max-height: 96vh;
            }
            .profession-cards-grid,
            .profession-overview-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </section>
    </div>
  );
}
