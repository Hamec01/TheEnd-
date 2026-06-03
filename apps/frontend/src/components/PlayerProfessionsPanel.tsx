import { useEffect, useMemo, useState } from 'react';
import {
  BLACKSMITH_STATS_KEYS,
  applyBlacksmithCraftResult,
  type BlacksmithSessionState,
  normalizePlayerProfessionsState,
  PROFESSION_DEFINITIONS,
  type PlayerProfessionState,
  type PlayerProfessionsState,
  type ProfessionId,
} from '@theend/rpg-domain';
import { BlacksmithForgeTab } from '../features/blacksmith/BlacksmithForgeTab';
import { BlacksmithInventoryTab } from '../features/blacksmith/BlacksmithInventoryTab';
import { BlacksmithRecipesTab } from '../features/blacksmith/BlacksmithRecipesTab';
import { resolveBlacksmithSkillBonuses } from '../features/blacksmith/blacksmithSkillEffects';
import {
  canUnlockFinalBlacksmithTrial,
  countSelectedBranchesInExclusiveGroup,
  getBlockedByExclusiveSkillGroupReason,
  getExclusiveGroupMax,
} from '../services/professionSkillTreeUtils';
import { loadProfessionSkillsFromStorage } from '../services/professionSkillRepository';
import { loadProfessionBranchesFromStorage } from '../services/professionBranchRepository';
import { getBlockedByExclusiveBranchReason } from '../services/miningSkillValidation';
import { loadRuntimeImages, resolveStoredImageSource } from '../services/content/runtimeImageService';
import { getContentSnapshot } from '../services/content/contentApi';
import { loadRuntimeBlacksmithContent } from '../services/content/runtimeContentService';
import type { AdminItem, BlacksmithBalance, BlacksmithForgeTier, BlacksmithModule, BlacksmithQualityTier, BlacksmithTool, CraftingRecipe, Material, RecipeVisualProfile, StoredImage } from '../services/content/models';
import { loadMiningToolsFromStorage } from '../services/miningRepository';
import { loadMiningCareerStats, type MiningCareerStats } from '../services/miningCareerStats';
import type { ProfessionBranch, ProfessionSkill } from '../types/profession';
import { SkillTreeView } from '../features/professions/SkillTreeView';

interface PlayerProfessionsPanelProps {
  characterId: string;
  professionsState: PlayerProfessionsState;
  onClose: () => void;
  onStatus: (text: string) => void;
  onChange: (next: PlayerProfessionsState) => void;
}

export function PlayerProfessionsPanel(props: PlayerProfessionsPanelProps) {
  const { characterId, professionsState, onClose, onStatus, onChange } = props;

  const [selectedProfessionId, setSelectedProfessionId] = useState<ProfessionId | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'recipes' | 'forge' | 'inventory' | 'stats' | 'tree'>('overview');
  const [professionSkills, setProfessionSkills] = useState<ProfessionSkill[]>([]);
  const [professionBranches, setProfessionBranches] = useState<ProfessionBranch[]>([]);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [miningCareerStats, setMiningCareerStats] = useState<MiningCareerStats | null>(null);
  const [blacksmithRecipes, setBlacksmithRecipes] = useState<CraftingRecipe[]>([]);
  const [blacksmithForgeTiers, setBlacksmithForgeTiers] = useState<BlacksmithForgeTier[]>([]);
  const [blacksmithModules, setBlacksmithModules] = useState<BlacksmithModule[]>([]);
  const [blacksmithTools, setBlacksmithTools] = useState<BlacksmithTool[]>([]);
  const [blacksmithQualityTiers, setBlacksmithQualityTiers] = useState<BlacksmithQualityTier[]>([]);
  const [blacksmithBalance, setBlacksmithBalance] = useState<BlacksmithBalance | null>(null);
  const [recipeVisualProfiles, setRecipeVisualProfiles] = useState<RecipeVisualProfile[]>([]);
  const [materialsCatalog, setMaterialsCatalog] = useState<Material[]>([]);
  const [itemsCatalog, setItemsCatalog] = useState<AdminItem[]>([]);
  const [selectedBlacksmithRecipeId, setSelectedBlacksmithRecipeId] = useState<string | null>(null);
  const [blacksmithSession, setBlacksmithSession] = useState<BlacksmithSessionState | null>(null);

  const definitionById = useMemo(
    () => new Map(PROFESSION_DEFINITIONS.map((entry) => [entry.id, entry])),
    [],
  );

  useEffect(() => {
    setProfessionSkills(loadProfessionSkillsFromStorage());
    setProfessionBranches(loadProfessionBranchesFromStorage());
    setMiningCareerStats(loadMiningCareerStats(characterId));
    let cancelled = false;
    loadRuntimeImages()
      .then((images) => {
        if (!cancelled) {
          setRuntimeImages(images);
        }
      })
      .catch(() => undefined);

    Promise.all([loadRuntimeBlacksmithContent(), getContentSnapshot()])
      .then(([runtimeBlacksmith, snapshot]) => {
        if (cancelled) {
          return;
        }
        setBlacksmithForgeTiers(runtimeBlacksmith.forgeTiers);
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
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

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
      if (!branch.exclusiveGroupId) {
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

    const blockedByBranch = getBlockedByExclusiveBranchReason({
      skill,
      learnedSkillIds: selectedProfession.state.learnedSkillIds ?? [],
      allSkills: professionSkillsForTree,
      branches: professionBranchesForTree,
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
      ? ['overview', 'inventory', 'recipes', 'forge', 'tree'] as const
      : ['overview', 'tree'] as const;

  const xpToNext = selectedProfession
    ? Math.max(0, Math.floor((selectedProfession.state.xpToNextLevel ?? 0) - (selectedProfession.state.xp ?? 0)))
    : 0;

  const miningRunRate = miningCareerStats && miningCareerStats.totalRuns > 0
    ? Math.round((miningCareerStats.escapedRuns / miningCareerStats.totalRuns) * 100)
    : 0;

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true">
      <section className="card battle-window wm-modal profession-modal">
        <div className="battle-window-head">
          <h2>Профессии</h2>
          <button onClick={onClose}>×</button>
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
                  setBlacksmithSession(null);
                }}
                />
              </div>
            ) : null}

            {activeTab === 'forge' && selectedProfession.state.professionId === 'blacksmithing' ? (
              <div className="profession-tab-panel">
                <BlacksmithForgeTab
                selectedRecipe={selectedBlacksmithRecipe}
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
                resolveImageRef={(value) => resolveStoredImageSource(value?.trim(), runtimeImages) ?? value}
                skillBonuses={blacksmithSkillBonuses}
                onSessionChange={setBlacksmithSession}
                onComplete={({ xp, score, qualityTierId, success }) => {
                  const normalized = normalizePlayerProfessionsState(professionsState);
                  const next = applyBlacksmithCraftResult(normalized, 'blacksmithing', {
                    xpReward: xp,
                    score,
                    success,
                    isQualityCraft: qualityTierId === 'quality_fine' || qualityTierId === 'quality_masterwork',
                    isMasterwork: qualityTierId === 'quality_masterwork',
                  });
                  onChange(next);
                  onStatus(`Ковка завершена: ${score}/100 (${qualityTierId}). Получено XP: ${xp}.`);
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
                runtimeImages={runtimeImages}
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

        <style>{`
          .profession-modal {
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
          @media (max-width: 1180px) {
            .profession-cards-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .profession-overview-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
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
