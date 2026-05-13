import { getSkillCostSummary, type AdminSkillDefinition } from '@theend/rpg-domain';
import { useEffect, useMemo, useState } from 'react';
import type { CharacterSkillLoadout, CharacterSkillRow, CombatSkillSlot } from '../api';
import type { SkillTrainingPlayerContext, TrainerSkillCandidate } from './training/trainerSkillResolver';
import { resolveTrainerSkillCandidates } from './training/trainerSkillResolver';

interface CharacterSkillsPageProps {
  learnedSkills: CharacterSkillRow[];
  availableSkills: AdminSkillDefinition[];
  loadout: CharacterSkillLoadout | null;
  playerContext: SkillTrainingPlayerContext;
  trainerSkillIds?: unknown;
  mode?: 'character' | 'trainer';
  trainerNpcName?: string | null;
  onLearnSkill: (skillId: string) => Promise<void>;
  onSaveLoadout: (slots: Array<{ slotIndex: number; skillId: string | null }>) => Promise<void>;
  onStatus: (text: string) => void;
}

function getSkillSummary(skill: AdminSkillDefinition | null | undefined, level: number): string {
  if (!skill) {
    return 'Данные навыка недоступны.';
  }

  const resourceSummary = getSkillCostSummary(skill, level);
  const resources = resourceSummary.length > 0
    ? resourceSummary.map((entry) => `${entry.type} ${entry.amount}`).join(', ')
    : (skill.costs.isFree ? 'Без затрат' : 'Нет');

  return [
    skill.gameplayDescription?.trim() || skill.shortDescription?.trim() || 'Описание пока не заполнено.',
    `Ресурсы: ${resources}`,
    `Перезарядка: ${skill.cooldown.cooldownTurns} ходов`,
    `Тип: ${skill.type}`,
  ].join('\n');
}

function getSlotTypeLabel(slot: CombatSkillSlot): string {
  return slot.unlocked ? `${slot.slotType} слот` : `Заблокированный ${slot.slotType} слот`;
}

export function CharacterSkillsPage(props: CharacterSkillsPageProps) {
  const { learnedSkills, availableSkills, loadout, playerContext, trainerSkillIds, mode = 'character', trainerNpcName, onLearnSkill, onSaveLoadout, onStatus } = props;
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [draftSlots, setDraftSlots] = useState<CombatSkillSlot[]>([]);
  const [isSavingLoadout, setIsSavingLoadout] = useState(false);
  const [learningSkillId, setLearningSkillId] = useState<string | null>(null);

  useEffect(() => {
    setDraftSlots(loadout?.slots ?? []);
  }, [loadout]);

  const learnedSkillIds = useMemo(() => new Set(learnedSkills.map((entry) => entry.skillId)), [learnedSkills]);

  const trainerCandidates = useMemo<TrainerSkillCandidate[]>(() => {
    const npcId = playerContext.npcId?.trim() || null;
    if (!npcId) return [];
    return resolveTrainerSkillCandidates({
      npcId,
      trainerSkillIds,
      allSkills: availableSkills,
      context: playerContext,
      learnedSkillIds,
    });
  }, [availableSkills, learnedSkillIds, playerContext, trainerSkillIds]);

  const trainerAvailable = useMemo(
    () => trainerCandidates.filter((entry) => entry.isAvailable && entry.skill),
    [trainerCandidates],
  );
  const trainerLocked = useMemo(
    () => trainerCandidates.filter((entry) => !entry.isAvailable && !entry.isLearned),
    [trainerCandidates],
  );
  const trainerLearned = useMemo(
    () => trainerCandidates.filter((entry) => entry.isLearned),
    [trainerCandidates],
  );

  useEffect(() => {
    const isKnown = selectedSkillId && learnedSkills.some((entry) => entry.skillId === selectedSkillId);
    const isTrainerAvailable = selectedSkillId && trainerAvailable.some((entry) => entry.skill?.id === selectedSkillId);
    if (isKnown || isTrainerAvailable) {
      return;
    }
    setSelectedSkillId(learnedSkills[0]?.skillId ?? trainerAvailable[0]?.skillId ?? null);
  }, [learnedSkills, selectedSkillId, trainerAvailable]);

  const learnedSkillDetails = useMemo(
    () => learnedSkills.map((entry) => ({
      ...entry,
      definition: entry.definition ?? availableSkills.find((skill) => skill.id === entry.skillId) ?? null,
    })),
    [availableSkills, learnedSkills],
  );

  const selectedLearnedSkill = learnedSkillDetails.find((entry) => entry.skillId === selectedSkillId) ?? null;
  const selectedAvailableSkill = trainerAvailable.find((entry) => entry.skill?.id === selectedSkillId)?.skill ?? null;
  const selectedDefinition = selectedLearnedSkill?.definition ?? selectedAvailableSkill ?? null;
  const selectedLevel = selectedLearnedSkill?.level ?? 1;

  const hasLoadoutChanges = useMemo(() => {
    if (!loadout) {
      return false;
    }
    if (loadout.slots.length !== draftSlots.length) {
      return true;
    }
    return loadout.slots.some((slot, index) => slot.skillId !== draftSlots[index]?.skillId);
  }, [draftSlots, loadout]);

  const assignedSlots = useMemo(
    () => draftSlots.filter((slot) => slot.unlocked && Boolean(slot.skillId)).length,
    [draftSlots],
  );

  async function handleLearn(skillId: string): Promise<void> {
    try {
      setLearningSkillId(skillId);
      await onLearnSkill(skillId);
      setSelectedSkillId(skillId);
    } catch (error) {
      onStatus(`Не удалось изучить навык: ${(error as Error).message}`);
    } finally {
      setLearningSkillId(null);
    }
  }

  async function handleSaveLoadout(): Promise<void> {
    try {
      setIsSavingLoadout(true);
      await onSaveLoadout(draftSlots.map((slot) => ({ slotIndex: slot.slotIndex, skillId: slot.skillId })));
    } catch (error) {
      onStatus(`Не удалось сохранить loadout: ${(error as Error).message}`);
    } finally {
      setIsSavingLoadout(false);
    }
  }

  return (
    <div className="skills-panel-shell">
      <div className="skills-panel-main">
        {/* Left: learned + learnable stacked, both scroll as one column */}
        <div className="skills-panel-left">
          <section className="inner-card skills-card-section">
            <div className="skills-section-head">
              <div>
                <h3 style={{ marginTop: 0 }}>Изученные навыки</h3>
                <p className="muted">Навыки работают как инвентарь способностей: карточки слева, детали справа.</p>
              </div>
              <span className="skills-count-chip">{learnedSkillDetails.length}</span>
            </div>
            {learnedSkillDetails.length > 0 ? (
              <div className="skills-card-grid">
                {learnedSkillDetails.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={`character-skill-card ${selectedSkillId === entry.skillId ? 'is-active' : ''}`}
                    onClick={() => setSelectedSkillId(entry.skillId)}
                    onMouseEnter={() => setSelectedSkillId(entry.skillId)}
                  >
                    <span className="character-skill-icon">{(entry.definition?.name ?? entry.skillId).slice(0, 2).toUpperCase()}</span>
                    <span className="skills-card-copy">
                      <strong>{entry.definition?.name ?? entry.skillId}</strong>
                      <small>Уровень {entry.level} · {entry.definition?.type ?? 'unknown'}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">Персонаж пока не изучил ни одного навыка.</p>
            )}
          </section>

          <section className="inner-card skills-training-section">
            <div className="skills-section-head">
              <div>
                <h3 style={{ margin: 0 }}>
                  {mode === 'trainer' && playerContext.npcId
                    ? `Обучение у ${trainerNpcName ?? playerContext.npcId}`
                    : 'Обучение'}
                </h3>
                <span className="muted">
                  {mode === 'trainer'
                    ? 'Навыки у выбранного тренера.'
                    : 'Чтобы обучиться, откройте навыки через NPC-тренера.'}
                </span>
              </div>
            </div>
            {mode !== 'trainer' ? (
              <p className="muted" style={{ marginTop: 12 }}>Чтобы обучиться, поговорите с тренером.</p>
            ) : !playerContext.npcId ? (
              <p className="muted" style={{ marginTop: 12 }}>Тренер не выбран.</p>
            ) : trainerCandidates.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>Этот персонаж пока ничему не обучает.</p>
            ) : (
              <>
                {trainerAvailable.length > 0 ? (
                  <div className="skills-training-grid">
                    {trainerAvailable.map((entry) => {
                      const skill = entry.skill;
                      if (!skill) return null;
                      const price = entry.costs.gold ?? 0;
                      const gold = typeof playerContext.gold === 'number' ? playerContext.gold : null;
                      const notEnoughGold = gold !== null && gold < price;
                      const disabledReason = notEnoughGold ? 'Недостаточно золота.' : undefined;
                      const costsItems = entry.costs.items ?? [];
                      const costsQuestItems = entry.costs.questItems ?? [];
                      const extraCostsLine = costsItems.length > 0 || costsQuestItems.length > 0
                        ? `Доп. оплата: ${[
                          ...costsItems.map((c) => `${c.itemId} x${c.quantity}`),
                          ...costsQuestItems.map((c) => `${c.questItemId} x${c.quantity}`),
                        ].join(', ')}`
                        : null;

                      return (
                        <article key={entry.skillId} className="skill-training-card">
                          <div className="skill-training-card-head">
                            <span className="character-skill-icon">{skill.name.slice(0, 2).toUpperCase()}</span>
                            <div>
                              <strong>{skill.name}</strong>
                              <small>{skill.type}</small>
                            </div>
                          </div>
                          <p className="muted">{skill.shortDescription || skill.gameplayDescription || 'Описание пока не заполнено.'}</p>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="muted">{price > 0 ? `Цена: ${price}` : 'Бесплатно'}</span>
                            <button
                              type="button"
                              disabled={learningSkillId === skill.id || notEnoughGold}
                              onClick={() => { void handleLearn(skill.id); }}
                              title={disabledReason}
                            >
                              {learningSkillId === skill.id ? 'Обучение...' : 'Изучить'}
                            </button>
                          </div>
                          {extraCostsLine ? <p className="muted" style={{ marginTop: 6 }}>{extraCostsLine}</p> : null}
                          {disabledReason ? <p className="muted" style={{ marginTop: 6 }}>{disabledReason}</p> : null}
                        </article>
                      );
                    })}
                  </div>
                ) : null}

                {trainerLocked.length > 0 ? (
                  <div style={{ marginTop: trainerAvailable.length > 0 ? 12 : 0 }}>
                    {trainerAvailable.length === 0 ? (
                      <p className="muted" style={{ marginTop: 12 }}>Навыки найдены, но условия не выполнены.</p>
                    ) : (
                      <p className="muted" style={{ marginTop: 12 }}>Заблокировано</p>
                    )}
                    <div className="skills-training-grid">
                      {trainerLocked.map((entry) => {
                        const skill = entry.skill;
                        const name = skill?.name ?? entry.skillId;
                        const description = skill?.shortDescription || skill?.gameplayDescription || 'Описание пока не заполнено.';
                        const reasons = entry.reasons ?? [];
                        const costsItems = entry.costs.items ?? [];
                        const costsQuestItems = entry.costs.questItems ?? [];
                        const extraCostsLine = costsItems.length > 0 || costsQuestItems.length > 0
                          ? `Доп. оплата: ${[
                            ...costsItems.map((c) => `${c.itemId} x${c.quantity}`),
                            ...costsQuestItems.map((c) => `${c.questItemId} x${c.quantity}`),
                          ].join(', ')}`
                          : null;

                        return (
                          <article key={`locked-${entry.skillId}`} className="skill-training-card" style={{ opacity: 0.65 }}>
                            <div className="skill-training-card-head">
                              <span className="character-skill-icon">{name.slice(0, 2).toUpperCase()}</span>
                              <div>
                                <strong>{name}</strong>
                                <small>{skill?.type ?? 'locked'}</small>
                              </div>
                            </div>
                            <p className="muted">{description}</p>
                            {entry.costs.gold > 0 ? <p className="muted" style={{ margin: '6px 0 0' }}>Цена: {entry.costs.gold}</p> : null}
                            {extraCostsLine ? <p className="muted" style={{ margin: '6px 0 0' }}>{extraCostsLine}</p> : null}
                            {reasons.length > 0 ? (
                              <ul className="muted" style={{ margin: '8px 0 0', paddingLeft: 16 }}>
                                {reasons.slice(0, 4).map((reason) => (
                                  <li key={`${entry.skillId}-${reason.code}`}>{reason.message}</li>
                                ))}
                              </ul>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {trainerLearned.length > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <p className="muted" style={{ marginTop: 12 }}>Уже изучено</p>
                    <div className="skills-training-grid">
                      {trainerLearned.map((entry) => {
                        const skill = entry.skill;
                        const name = skill?.name ?? entry.skillId;
                        const description = skill?.shortDescription || skill?.gameplayDescription || 'Описание пока не заполнено.';
                        return (
                          <article key={`learned-${entry.skillId}`} className="skill-training-card" style={{ opacity: 0.55 }}>
                            <div className="skill-training-card-head">
                              <span className="character-skill-icon">{name.slice(0, 2).toUpperCase()}</span>
                              <div>
                                <strong>{name}</strong>
                                <small>{skill?.type ?? 'learned'}</small>
                              </div>
                            </div>
                            <p className="muted">{description}</p>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {trainerAvailable.length === 0 && trainerLocked.length === 0 && trainerLearned.length > 0 ? (
                  <p className="muted" style={{ marginTop: 12 }}>Все навыки этого тренера уже изучены.</p>
                ) : null}
              </>
            )}
          </section>
        </div>

        {/* Right: skill details */}
        <section className="inner-card skills-detail-section">
          <h3 style={{ marginTop: 0 }}>Детали навыка</h3>
          {selectedDefinition ? (
            <>
              <div className="skills-detail-head">
                <span className="character-skill-icon skills-detail-icon">{selectedDefinition.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{selectedDefinition.name}</strong>
                  <p className="muted">ID: {selectedDefinition.id} · Уровень {selectedLevel}/{selectedDefinition.maxLevel}</p>
                </div>
              </div>
              <div className="skills-detail-facts">
                <p><span>Тип</span><strong>{selectedDefinition.type}</strong></p>
                <p><span>Навык</span><strong>{selectedDefinition.name}</strong></p>
                <p><span>Макс. уровень</span><strong>{selectedDefinition.maxLevel}</strong></p>
                <p><span>Перезарядка</span><strong>{selectedDefinition.cooldown.cooldownTurns} ходов</strong></p>
              </div>
              <p className="skills-detail-text" style={{ whiteSpace: 'pre-wrap' }}>{getSkillSummary(selectedDefinition, selectedLevel)}</p>
            </>
          ) : (
            <p className="muted">Выберите навык, чтобы посмотреть детали.</p>
          )}
        </section>
      </div>

      {/* Bottom: loadout — full-width row */}
      <section className="inner-card skills-loadout-section skills-loadout-bottom">
        <div className="skills-section-head">
          <div>
            <h3 style={{ margin: 0 }}>Боевой набор</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>Заполнено слотов: {assignedSlots}/{draftSlots.filter((slot) => slot.unlocked).length}</p>
          </div>
          <button type="button" disabled={!hasLoadoutChanges || isSavingLoadout} onClick={() => { void handleSaveLoadout(); }}>
            {isSavingLoadout ? 'Сохранение...' : 'Сохранить набор'}
          </button>
        </div>
        {draftSlots.length > 0 ? (
          <div className="skills-loadout-grid">
            {draftSlots.map((slot) => (
              <label key={slot.slotIndex} className={`skills-loadout-slot ${slot.unlocked ? '' : 'is-locked'}`}>
                <span className="skills-loadout-slot-title">Слот {slot.slotIndex + 1}</span>
                <span className="muted">{getSlotTypeLabel(slot)}</span>
                <select
                  value={slot.skillId ?? ''}
                  disabled={!slot.unlocked}
                  onChange={(event) => {
                    const nextSkillId = event.target.value || null;
                    setDraftSlots((current) => current.map((entry) => (
                      entry.slotIndex === slot.slotIndex
                        ? { ...entry, skillId: nextSkillId }
                        : entry
                    )));
                  }}
                >
                  <option value="">Пусто</option>
                  {learnedSkillDetails.map((entry) => (
                    <option key={`${slot.slotIndex}-${entry.skillId}`} value={entry.skillId}>
                      {entry.definition?.name ?? entry.skillId} (ур. {entry.level})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>Боевой набор пока не загружен.</p>
        )}
      </section>
    </div>
  );
}
