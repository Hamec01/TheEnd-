import { useEffect, useMemo, useState } from 'react';
import {
  normalizePlayerProfessionsState,
  PROFESSION_DEFINITIONS,
  unlockProfession,
  type PlayerProfessionState,
  type PlayerProfessionsState,
  type ProfessionId,
} from '@theend/rpg-domain';
import { loadProfessionSkillsFromStorage } from '../services/professionSkillRepository';
import { loadProfessionBranchesFromStorage } from '../services/professionBranchRepository';
import { getBlockedByExclusiveBranchReason } from '../services/miningSkillValidation';
import { loadRuntimeImages, resolveStoredImageSource } from '../services/content/runtimeImageService';
import type { StoredImage } from '../services/content/models';
import type { ProfessionBranch, ProfessionSkill } from '../types/profession';
import { SkillTreeView } from '../features/professions/SkillTreeView';

interface PlayerProfessionsPanelProps {
  professionsState: PlayerProfessionsState;
  onClose: () => void;
  onStatus: (text: string) => void;
  onChange: (next: PlayerProfessionsState) => void;
}

export function PlayerProfessionsPanel(props: PlayerProfessionsPanelProps) {
  const { professionsState, onClose, onStatus, onChange } = props;

  const [selectedProfessionId, setSelectedProfessionId] = useState<ProfessionId | null>(null);
  const [professionSkills, setProfessionSkills] = useState<ProfessionSkill[]>([]);
  const [professionBranches, setProfessionBranches] = useState<ProfessionBranch[]>([]);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);

  const definitionById = useMemo(
    () => new Map(PROFESSION_DEFINITIONS.map((entry) => [entry.id, entry])),
    [],
  );

  useEffect(() => {
    setProfessionSkills(loadProfessionSkillsFromStorage());
    setProfessionBranches(loadProfessionBranchesFromStorage());
    let cancelled = false;
    loadRuntimeImages()
      .then((images) => {
        if (!cancelled) {
          setRuntimeImages(images);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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

  const selectedProfessionSkills = useMemo(() => {
    if (!selectedProfession) {
      return [];
    }
    const learnedIds = new Set(selectedProfession.state.learnedSkillIds ?? []);
    return professionSkills.filter((skill) => skill.professionId === selectedProfession.state.professionId && learnedIds.has(skill.id));
  }, [professionSkills, selectedProfession]);

  const selectedProfessionSkillTree = useMemo(() => {
    if (!selectedProfession) {
      return { available: [] as ProfessionSkill[], locked: [] as Array<{ skill: ProfessionSkill; reason: string }>, learned: [] as ProfessionSkill[] };
    }

    const professionId = selectedProfession.state.professionId;
    const allForProfession = professionSkills
      .filter((skill) => skill.professionId === professionId && skill.isEnabled)
      .sort((a, b) => a.requiredLevel - b.requiredLevel || a.name.localeCompare(b.name, 'ru'));
    const learnedIds = new Set(selectedProfession.state.learnedSkillIds ?? []);
    const selectedBranchIds = new Set(selectedProfession.state.selectedBranchIds ?? []);
    const learned = allForProfession.filter((skill) => learnedIds.has(skill.id));
    const available: ProfessionSkill[] = [];
    const locked: Array<{ skill: ProfessionSkill; reason: string }> = [];
    const branches = professionBranches.filter((branch) => branch.professionId === professionId && branch.isEnabled);
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));

    for (const skill of allForProfession) {
      if (learnedIds.has(skill.id)) {
        continue;
      }
      if (selectedProfession.state.level < skill.requiredLevel) {
        locked.push({ skill, reason: `Нужен уровень профессии ${skill.requiredLevel}.` });
        continue;
      }
      if (selectedProfession.state.skillPoints < skill.skillPointCost) {
        locked.push({ skill, reason: `Нужно очков навыков: ${skill.skillPointCost}.` });
        continue;
      }
      const missingRequiredSkillId = (skill.requiredSkillIds ?? []).find((requiredId) => !learnedIds.has(requiredId));
      if (missingRequiredSkillId) {
        locked.push({ skill, reason: `Не изучен prerequisite: ${missingRequiredSkillId}.` });
        continue;
      }
      const missingRequiredBranchId = (skill.requiredBranchIds ?? []).find((requiredBranchId) => !selectedBranchIds.has(requiredBranchId));
      if (missingRequiredBranchId) {
        const requiredBranch = branchById.get(missingRequiredBranchId);
        locked.push({ skill, reason: `Нужна ветка: ${requiredBranch?.name ?? missingRequiredBranchId}.` });
        continue;
      }
      const blockedByBranch = getBlockedByExclusiveBranchReason({
        skill,
        learnedSkillIds: selectedProfession.state.learnedSkillIds ?? [],
        allSkills: allForProfession,
        branches,
      });
      if (blockedByBranch) {
        locked.push({ skill, reason: blockedByBranch });
        continue;
      }
      const branch = skill.branchId ? branchById.get(skill.branchId) : null;
      if (branch && !selectedBranchIds.has(branch.id)) {
        locked.push({ skill, reason: `Сначала выберите ветку ${branch.name}.` });
        continue;
      }
      const missingBranchRequirement = (branch?.requiredSkillIds ?? []).find((requiredId) => !learnedIds.has(requiredId));
      if (missingBranchRequirement) {
        locked.push({ skill, reason: `Ветка ${branch?.name ?? skill.branchId} требует: ${missingBranchRequirement}.` });
        continue;
      }
      available.push(skill);
    }

    return { available, locked, learned };
  }, [professionBranches, professionSkills, selectedProfession]);

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
    if (!selectedProfession || selectedProfession.state.professionId !== 'mining') {
      onStatus('Навык можно изучать только в профессии Горняк.');
      return;
    }

    const learnedIds = new Set(selectedProfession.state.learnedSkillIds ?? []);
    const selectedBranchIds = new Set(selectedProfession.state.selectedBranchIds ?? []);
    const miningSkills = professionSkills.filter((entry) => entry.professionId === 'mining');
    const branchById = new Map(miningBranches.map((entry) => [entry.id, entry]));

    if (learnedIds.has(skill.id)) {
      onStatus('Навык уже изучен.');
      return;
    }
    if (selectedProfession.state.skillPoints < skill.skillPointCost) {
      onStatus('Недостаточно очков навыков.');
      return;
    }
    if (selectedProfession.state.level < skill.requiredLevel) {
      onStatus(`Требуется уровень Горняка ${skill.requiredLevel}.`);
      return;
    }

    const missingSkill = (skill.requiredSkillIds ?? []).find((requiredId) => !learnedIds.has(requiredId));
    if (missingSkill) {
      onStatus(`Не изучен prerequisite: ${missingSkill}.`);
      return;
    }

    const missingRequiredBranchId = (skill.requiredBranchIds ?? []).find((requiredBranchId) => !selectedBranchIds.has(requiredBranchId));
    if (missingRequiredBranchId) {
      const requiredBranch = branchById.get(missingRequiredBranchId);
      onStatus(`Сначала выберите ветку ${requiredBranch?.name ?? missingRequiredBranchId}.`);
      return;
    }

    const blockedByBranch = getBlockedByExclusiveBranchReason({
      skill,
      learnedSkillIds: selectedProfession.state.learnedSkillIds ?? [],
      allSkills: miningSkills,
      branches: miningBranches,
    });
    if (blockedByBranch) {
      onStatus(blockedByBranch);
      return;
    }

    if (skill.branchId) {
      const branch = branchById.get(skill.branchId) ?? null;
      if (!branch) {
        onStatus(`Ветка не найдена: ${skill.branchId}.`);
        return;
      }
      if (!selectedBranchIds.has(branch.id)) {
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
    if (!selectedProfession || selectedProfession.state.professionId !== 'mining') {
      return;
    }

    const selectedIds = new Set(selectedProfession.state.selectedBranchIds ?? []);
    if (selectedIds.has(branch.id)) {
      onStatus(`Ветка ${branch.name} уже выбрана.`);
      return;
    }

    const conflict = miningBranches.find((entry) => (
      entry.id !== branch.id
      && Boolean(entry.exclusiveGroupId)
      && entry.exclusiveGroupId === branch.exclusiveGroupId
      && selectedIds.has(entry.id)
    ));
    if (conflict) {
      onStatus(`Нельзя выбрать ${branch.name}: уже выбрана взаимоисключающая ветка ${conflict.name}.`);
      return;
    }

    const learned = new Set(selectedProfession.state.learnedSkillIds ?? []);
    const missingSkill = (branch.requiredSkillIds ?? []).find((requiredId) => !learned.has(requiredId));
    if (missingSkill) {
      onStatus(`Для ветки ${branch.name} нужен навык ${missingSkill}.`);
      return;
    }

    const missingBranch = (branch.requiredBranchIds ?? []).find((requiredBranchId) => !selectedIds.has(requiredBranchId));
    if (missingBranch) {
      const requiredBranch = miningBranches.find((entry) => entry.id === missingBranch);
      onStatus(`Для ветки ${branch.name} нужна ветка ${requiredBranch?.name ?? missingBranch}.`);
      return;
    }

    const lockedByBranch = (branch.locksBranchIds ?? []).find((lockedBranchId) => selectedIds.has(lockedBranchId));
    if (lockedByBranch) {
      const lockedBranch = miningBranches.find((entry) => entry.id === lockedByBranch);
      onStatus(`Нельзя выбрать ${branch.name}: уже выбрана конфликтующая ветка ${lockedBranch?.name ?? lockedByBranch}.`);
      return;
    }

    updateSelectedProfessionState((current) => ({
      ...current,
      selectedBranchIds: Array.from(new Set([...(current.selectedBranchIds ?? []), branch.id])),
    }));
    onStatus(`Вы выбрали ветку: ${branch.name}.`);
  };

  const isDev = (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.DEV === true
    || ((import.meta as { env?: { MODE?: string } }).env?.MODE ?? 'production') !== 'production';

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true">
      <section className="card battle-window wm-modal">
        <div className="battle-window-head">
          <h2>Профессии</h2>
          <button onClick={onClose}>×</button>
        </div>

        {isDev ? (
          <div style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => {
                const next = unlockProfession(professionsState, 'mining');
                onChange(next);
                onStatus('DEV: профессия Горняк открыта.');
              }}
            >
              DEV: открыть Горняка
            </button>
          </div>
        ) : null}

        {unlockedProfessions.length === 0 ? (
          <p>У вас пока нет профессий. Найдите наставника, чтобы изучить первую профессию.</p>
        ) : (
          <>
            <div className="wm-stat-list" style={{ marginBottom: 12 }}>
              {unlockedProfessions.map((entry) => {
                const definition = entry.definition;
                const state = entry.state;
                const name = definition?.name ?? state.professionId;
                return (
                  <div key={state.professionId} className="wm-stat-row" style={{ alignItems: 'center' }}>
                    <div>
                      <strong>{name}</strong>
                      <p className="wm-stat-hint">Уровень {state.level}</p>
                      <p className="wm-stat-hint">{state.xp} / {state.xpToNextLevel} XP</p>
                      <p className="wm-stat-hint">Очки навыков: {state.skillPoints}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedProfessionId(state.professionId)}>
                      Открыть
                    </button>
                  </div>
                );
              })}
            </div>

            {selectedProfession ? (
              <section className="inner-card">
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
                  onBack={() => setSelectedProfessionId(null)}
                  resolveIcon={(icon) => resolveStoredImageSource(icon?.trim(), runtimeImages) ?? icon}
                  isDev={isDev}
                  legacyFallback={(
                    <>
                      {selectedProfessionSkills.length > 0 ? (
                        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                          <strong>Изученные навыки</strong>
                          <div style={{ display: 'grid', gap: 8 }}>
                            {selectedProfessionSkills.map((skill) => {
                              const iconSrc = resolveStoredImageSource(skill.icon?.trim(), runtimeImages);
                              return (
                                <div
                                  key={skill.id}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '64px minmax(0, 1fr)',
                                    gap: 12,
                                    alignItems: 'center',
                                    padding: 8,
                                    border: '1px solid rgba(164, 141, 110, 0.18)',
                                    borderRadius: 8,
                                    background: 'rgba(27, 22, 18, 0.72)',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 64,
                                      height: 64,
                                      borderRadius: 8,
                                      overflow: 'hidden',
                                      border: '1px solid rgba(164, 141, 110, 0.24)',
                                      background: 'rgba(14, 11, 9, 0.95)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {iconSrc ? <img src={iconSrc} alt={skill.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 12 }}>64x64</span>}
                                  </div>
                                  <div>
                                    <strong>{skill.name}</strong>
                                    <p className="wm-stat-hint" style={{ marginTop: 4 }}>{skill.description}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                        <strong>Доступные навыки дерева</strong>
                        {selectedProfessionSkillTree.available.length === 0 ? (
                          <p className="wm-stat-hint">Нет доступных навыков для покупки на текущем уровне.</p>
                        ) : (
                          selectedProfessionSkillTree.available.map((skill) => (
                            <div key={`available-${skill.id}`} style={{ border: '1px solid rgba(164, 141, 110, 0.2)', borderRadius: 8, padding: 8 }}>
                              <p className="wm-stat-hint" style={{ margin: 0 }}>
                                {skill.name} ({skill.id}) • cost {skill.skillPointCost}
                              </p>
                              <p className="wm-stat-hint" style={{ margin: '4px 0 8px' }}>{skill.description}</p>
                              <button type="button" onClick={() => handleLearnSkill(skill)}>Изучить</button>
                            </div>
                          ))
                        )}
                      </div>

                      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                        <strong>Заблокировано</strong>
                        {selectedProfessionSkillTree.locked.length === 0 ? (
                          <p className="wm-stat-hint">Нет заблокированных узлов.</p>
                        ) : (
                          selectedProfessionSkillTree.locked.slice(0, 12).map((entry) => (
                            <p key={`locked-${entry.skill.id}`} className="wm-stat-hint" style={{ margin: 0 }}>
                              {entry.skill.name}: {entry.reason}
                            </p>
                          ))
                        )}
                      </div>

                      {selectedProfession.state.professionId === 'mining' ? (
                        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                          <strong>Ветки Горняка</strong>
                          {miningBranches.map((branch) => {
                            const selectedIds = new Set(selectedProfession.state.selectedBranchIds ?? []);
                            const isSelected = selectedIds.has(branch.id);
                            const isLockedByExclusive = miningBranches.some((candidate) => (
                              candidate.id !== branch.id
                              && candidate.exclusiveGroupId
                              && candidate.exclusiveGroupId === branch.exclusiveGroupId
                              && selectedIds.has(candidate.id)
                            ));
                            return (
                              <div key={branch.id} style={{ border: '1px solid rgba(164, 141, 110, 0.2)', borderRadius: 8, padding: 8 }}>
                                <p className="wm-stat-hint" style={{ margin: 0 }}>
                                  {branch.name} ({branch.id})
                                </p>
                                <p className="wm-stat-hint" style={{ margin: '4px 0 8px' }}>{branch.description}</p>
                                <button
                                  type="button"
                                  disabled={isSelected || isLockedByExclusive}
                                  onClick={() => handleSelectBranch(branch)}
                                >
                                  {isSelected ? 'Выбрано' : isLockedByExclusive ? 'Заблокировано веткой' : 'Выбрать ветку'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </>
                  )}
                />
              </section>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
