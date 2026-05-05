import { getSkillCostSummary, type AdminSkillDefinition } from '@theend/rpg-domain';
import { useEffect, useMemo, useState } from 'react';
import type { CharacterSkillLoadout, CharacterSkillRow, CombatSkillSlot } from '../api';
import { getPlayerQuestState } from '../services/questRuntime';

const PLAYER_ITEMS_KEY = 'theend.player.items';
const PLAYER_QUEST_ITEMS_KEY = 'theend.player.questItems';

export interface SkillTrainingPlayerContext {
  playerId: string;
  level: number;
  race?: string | null;
  classId?: string | null;
  npcId?: string | null;
}

interface CharacterSkillsPageProps {
  learnedSkills: CharacterSkillRow[];
  availableSkills: AdminSkillDefinition[];
  loadout: CharacterSkillLoadout | null;
  playerContext: SkillTrainingPlayerContext;
  onLearnSkill: (skillId: string) => Promise<void>;
  onSaveLoadout: (slots: Array<{ slotIndex: number; skillId: string | null }>) => Promise<void>;
  onStatus: (text: string) => void;
}

function readArray(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => String(entry));
  } catch {
    return [];
  }
}

export function canShowSkillInTraining(
  skill: AdminSkillDefinition,
  context: SkillTrainingPlayerContext,
  learnedSkillIds: Set<string>,
): boolean {
  if (!skill.isActive || !skill.isPublished) {
    return false;
  }
  if (skill.isHidden) {
    return false;
  }
  if (skill.isTrainable !== true) {
    return false;
  }
  if (skill.acquisitionMode !== 'trainer') {
    return false;
  }
  if (learnedSkillIds.has(skill.id)) {
    return false;
  }

  const requiredLevel = skill.requiredLevel ?? skill.requirements?.minCharacterLevel;
  if (typeof requiredLevel === 'number' && context.level < requiredLevel) {
    return false;
  }

  if (skill.requiredQuestId) {
    const state = getPlayerQuestState(context.playerId, skill.requiredQuestId);
    if (!state) {
      return false;
    }
  }

  if (skill.requiredCompletedQuestId) {
    const state = getPlayerQuestState(context.playerId, skill.requiredCompletedQuestId);
    if (!state || state.status !== 'completed') {
      return false;
    }
  }

  if (skill.requiredQuestItemId && !readArray(PLAYER_QUEST_ITEMS_KEY).includes(skill.requiredQuestItemId)) {
    return false;
  }

  if (skill.requiredNpcId && (!context.npcId || context.npcId !== skill.requiredNpcId)) {
    return false;
  }

  if (skill.requiredClassIds && skill.requiredClassIds.length > 0) {
    if (!context.classId || !skill.requiredClassIds.includes(context.classId)) {
      return false;
    }
  }

  const requiredRaceIds = skill.requiredRaceIds && skill.requiredRaceIds.length > 0
    ? skill.requiredRaceIds
    : (skill.requirements?.allowedRaces ?? []);
  if (requiredRaceIds.length > 0 && (!context.race || !requiredRaceIds.includes(context.race))) {
    return false;
  }

  const requiredKnownSkillIds = [
    ...(skill.requiredKnownSkillIds ?? []),
    ...(skill.requirements?.requiredSkills ?? []),
  ];
  if (requiredKnownSkillIds.some((requiredSkillId) => !learnedSkillIds.has(requiredSkillId))) {
    return false;
  }

  const requiredItems = skill.requirements?.requiredItems ?? [];
  if (requiredItems.length > 0) {
    const itemIds = new Set(readArray(PLAYER_ITEMS_KEY));
    if (requiredItems.some((itemId) => !itemIds.has(itemId))) {
      return false;
    }
  }

  return true;
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
  const { learnedSkills, availableSkills, loadout, playerContext, onLearnSkill, onSaveLoadout, onStatus } = props;
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [draftSlots, setDraftSlots] = useState<CombatSkillSlot[]>([]);
  const [isSavingLoadout, setIsSavingLoadout] = useState(false);
  const [learningSkillId, setLearningSkillId] = useState<string | null>(null);

  useEffect(() => {
    setDraftSlots(loadout?.slots ?? []);
  }, [loadout]);

  useEffect(() => {
    if (selectedSkillId && learnedSkills.some((entry) => entry.skillId === selectedSkillId)) {
      return;
    }
    setSelectedSkillId(learnedSkills[0]?.skillId ?? availableSkills[0]?.id ?? null);
  }, [availableSkills, learnedSkills, selectedSkillId]);

  const learnedSkillIds = useMemo(() => new Set(learnedSkills.map((entry) => entry.skillId)), [learnedSkills]);

  const learnableSkills = useMemo(
    () => availableSkills.filter((skill) => canShowSkillInTraining(skill, playerContext, learnedSkillIds)),
    [availableSkills, learnedSkillIds, playerContext],
  );

  const learnedSkillDetails = useMemo(
    () => learnedSkills.map((entry) => ({
      ...entry,
      definition: entry.definition ?? availableSkills.find((skill) => skill.id === entry.skillId) ?? null,
    })),
    [availableSkills, learnedSkills],
  );

  const selectedLearnedSkill = learnedSkillDetails.find((entry) => entry.skillId === selectedSkillId) ?? null;
  const selectedAvailableSkill = learnableSkills.find((entry) => entry.id === selectedSkillId) ?? null;
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
                <h3 style={{ margin: 0 }}>Обучение</h3>
                <span className="muted">Показываются только навыки, явно доступные для обычного обучения и подходящие по требованиям.</span>
              </div>
            </div>
            {learnableSkills.length > 0 ? (
              <div className="skills-training-grid">
                {learnableSkills.map((skill) => (
                  <article key={skill.id} className="skill-training-card">
                    <div className="skill-training-card-head">
                      <span className="character-skill-icon">{skill.name.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <strong>{skill.name}</strong>
                        <small>{skill.type}</small>
                      </div>
                    </div>
                    <p className="muted">{skill.shortDescription || skill.gameplayDescription || 'Описание пока не заполнено.'}</p>
                    <button type="button" disabled={learningSkillId === skill.id} onClick={() => { void handleLearn(skill.id); }}>
                      {learningSkillId === skill.id ? 'Обучение...' : 'Изучить'}
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 12 }}>Все доступные навыки уже изучены или ещё не опубликованы.</p>
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
