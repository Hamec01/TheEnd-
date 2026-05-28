import { useEffect, useMemo, useState } from 'react';
import type { StoredImage } from '../services/content/models';
import type { PlayerQuestState, QuestDefinition, QuestObjective, QuestStep } from '../types/quest';
import { resolveQuestBanner, resolveQuestIcon, resolveQuestPortrait } from './questVisuals';

type QuestJournalFilter = 'active' | 'completed' | 'failed' | 'all';

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function currentStep(quest: QuestDefinition, state: PlayerQuestState): QuestStep | null {
  const steps = asArray(quest.steps);
  if (steps.length === 0) {
    return null;
  }
  const found = steps.find((step) => step.id === state.currentStepId);
  return found ?? steps[0] ?? null;
}

function objectiveProgress(step: QuestStep, state: PlayerQuestState): { completed: number; total: number } {
  const required = asArray(step.objectives).filter((objective) => !objective.isOptional);
  const total = required.length;
  const completed = required.filter((objective) => state.completedObjectiveIds.includes(objective.id)).length;
  return { completed, total };
}

function stepState(step: QuestStep, state: PlayerQuestState): 'completed' | 'current' | 'future' {
  if (state.completedStepIds.includes(step.id)) {
    return 'completed';
  }
  if (state.currentStepId && step.id === state.currentStepId) {
    return 'current';
  }
  if (!state.currentStepId && state.completedStepIds.length === 0) {
    return 'current';
  }
  return 'future';
}

function renderObjectiveLine(objective: QuestObjective, state: PlayerQuestState): string {
  const done = state.completedObjectiveIds.includes(objective.id);
  const prefix = done ? '✓' : '•';
  return `${prefix} ${objective.description || objective.id}`;
}

function pickTrackObjectiveId(step: QuestStep | null, state: PlayerQuestState | null): string | null {
  if (!step || !state) {
    return null;
  }

  const objectives = asArray(step.objectives);
  if (objectives.length === 0) {
    return null;
  }

  const preferred = objectives.find((objective) => {
    if (objective.isOptional) {
      return false;
    }
    return !state.completedObjectiveIds.includes(objective.id);
  }) ?? objectives.find((objective) => !state.completedObjectiveIds.includes(objective.id))
    ?? objectives[0]
    ?? null;

  return preferred?.id ?? null;
}

export function QuestJournalModal(props: {
  isOpen: boolean;
  onClose: () => void;
  questDefinitions: QuestDefinition[];
  playerQuestStates: PlayerQuestState[];
  runtimeImages: StoredImage[];
  trackedQuestId?: string | null;
  trackedObjectiveId?: string | null;
  onTrackQuest?: (questId: string, objectiveId: string | null) => void;
  onClearTrackedQuest?: () => void;
}) {
  const {
    isOpen,
    onClose,
    questDefinitions,
    playerQuestStates,
    runtimeImages,
    trackedQuestId = null,
    trackedObjectiveId = null,
    onTrackQuest,
    onClearTrackedQuest,
  } = props;
  const [filter, setFilter] = useState<QuestJournalFilter>('active');
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

  const questById = useMemo(() => new Map(questDefinitions.map((quest) => [quest.id, quest])), [questDefinitions]);

  const filteredStates = useMemo(() => {
    const base = [...playerQuestStates]
      .filter((state) => Boolean(questById.get(state.questId)))
      .sort((a, b) => (a.questId ?? '').localeCompare(b.questId ?? ''));

    if (filter === 'all') {
      return base;
    }
    return base.filter((state) => state.status === filter);
  }, [filter, playerQuestStates, questById]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (selectedQuestId && filteredStates.some((state) => state.questId === selectedQuestId)) {
      return;
    }
    setSelectedQuestId(filteredStates[0]?.questId ?? null);
  }, [filteredStates, isOpen, selectedQuestId]);

  if (!isOpen) {
    return null;
  }

  const selectedQuest = selectedQuestId ? questById.get(selectedQuestId) ?? null : null;
  const selectedState = selectedQuest ? filteredStates.find((state) => state.questId === selectedQuest.id) ?? null : null;
  const step = selectedQuest && selectedState ? currentStep(selectedQuest, selectedState) : null;
  const progress = step && selectedState ? objectiveProgress(step, selectedState) : null;
  const nextTrackObjectiveId = pickTrackObjectiveId(step, selectedState);
  const isTrackedSelectedQuest = Boolean(selectedQuest && trackedQuestId === selectedQuest.id);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        background: 'rgba(0, 0, 0, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div className="card" style={{ width: 'min(980px, 100%)', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Журнал квестов</h2>
          <button onClick={onClose}>Закрыть</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <button className={filter === 'active' ? 'is-active' : ''} onClick={() => setFilter('active')}>
            Активные
          </button>
          <button className={filter === 'completed' ? 'is-active' : ''} onClick={() => setFilter('completed')}>
            Выполненные
          </button>
          <button className={filter === 'failed' ? 'is-active' : ''} onClick={() => setFilter('failed')}>
            Проваленные
          </button>
          <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
            Все
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, marginTop: 16 }}>
          <div className="card" style={{ padding: 12, maxHeight: '70vh', overflow: 'auto' }}>
            {filteredStates.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Квестов в этом разделе пока нет.
              </p>
            ) : (
              filteredStates.map((state) => {
                const quest = questById.get(state.questId)!;
                const step = currentStep(quest, state);
                const progress = step ? objectiveProgress(step, state) : null;
                const progressText = progress ? `${progress.completed}/${progress.total}` : '—';
                const isSelected = quest.id === selectedQuestId;
                const cardIcon = resolveQuestIcon(quest, runtimeImages);
                return (
                  <button
                    key={state.questId}
                    onClick={() => setSelectedQuestId(quest.id)}
                    className={isSelected ? 'is-active' : ''}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      marginBottom: 8,
                      borderRadius: 8,
                      border: isSelected ? '1px solid #d2aa66' : '1px solid rgba(210,170,102,0.35)',
                      background: isSelected ? 'rgba(50, 40, 26, 0.75)' : 'rgba(15, 10, 6, 0.35)',
                      color: '#f3e4c8',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span className="wm-quest-journal-card-icon-wrap" aria-hidden>
                        {cardIcon ? (
                          <img
                            className="wm-quest-journal-card-icon"
                            src={cardIcon}
                            alt=""
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="wm-quest-journal-card-icon-fallback" />
                        )}
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <strong style={{ fontWeight: 700 }}>{quest.title}</strong>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {state.status.toUpperCase()}
                          </span>
                        </span>
                        <span className="muted" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
                          Прогресс: {progressText}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="card" style={{ padding: 14, maxHeight: '70vh', overflow: 'auto' }}>
            {!selectedQuest || !selectedState ? (
              <p className="muted" style={{ margin: 0 }}>
                Выберите квест слева.
              </p>
            ) : (
              <>
                {resolveQuestBanner(selectedQuest, runtimeImages) ? (
                  <img
                    className="wm-quest-journal-banner"
                    src={resolveQuestBanner(selectedQuest, runtimeImages)}
                    alt={selectedQuest.title}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <h3 style={{ marginTop: 0, marginBottom: 8 }} className="wm-quest-journal-title-row">
                  {(resolveQuestPortrait(selectedQuest, runtimeImages) ?? resolveQuestIcon(selectedQuest, runtimeImages)) ? (
                    <img
                      className="wm-quest-journal-title-icon"
                      src={resolveQuestPortrait(selectedQuest, runtimeImages) ?? resolveQuestIcon(selectedQuest, runtimeImages)}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span>{selectedQuest.title}</span>
                </h3>
                <p className="muted" style={{ marginTop: 0 }}>
                  {selectedQuest.playerDescription || 'Нет описания для игрока.'}
                </p>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  <span className="muted">Статус: {selectedState.status}</span>
                  {progress ? <span className="muted">Цели: {progress.completed}/{progress.total}</span> : null}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                  {selectedState.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => onTrackQuest?.(selectedQuest.id, nextTrackObjectiveId)}
                      className={isTrackedSelectedQuest ? 'is-active' : ''}
                    >
                      {isTrackedSelectedQuest ? 'Отслеживается' : 'Отслеживать'}
                    </button>
                  ) : null}
                  {isTrackedSelectedQuest ? (
                    <button type="button" onClick={() => onClearTrackedQuest?.()}>
                      Снять отслеживание
                    </button>
                  ) : null}
                  {isTrackedSelectedQuest ? (
                    <span className="muted" style={{ alignSelf: 'center' }}>
                      Цель: {trackedObjectiveId ?? 'квест целиком'}
                    </span>
                  ) : null}
                </div>

                {step ? (
                  <>
                    <h4 style={{ marginTop: 16, marginBottom: 8 }}>Текущий шаг</h4>
                    <p className="muted" style={{ marginTop: 0 }}>
                      {step.journalText || step.title || step.id}
                    </p>

                    {asArray(step.objectives).length > 0 ? (
                      <div className="card" style={{ padding: 12, marginTop: 10 }}>
                        <h4 style={{ marginTop: 0, marginBottom: 8 }}>Цели</h4>
                        {asArray(step.objectives).map((objective) => (
                          <p key={objective.id} className="muted" style={{ margin: '6px 0' }}>
                            {renderObjectiveLine(objective, selectedState)}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="muted">У квеста нет шагов.</p>
                )}

                {asArray(selectedQuest.steps).length > 0 ? (
                  <>
                    <h4 style={{ marginTop: 18, marginBottom: 8 }}>Шаги</h4>
                    {asArray(selectedQuest.steps).map((questStep) => {
                      const st = stepState(questStep, selectedState);
                      return (
                        <div
                          key={questStep.id}
                          className="card"
                          style={{
                            padding: 10,
                            marginBottom: 10,
                            opacity: st === 'future' ? 0.6 : 1,
                            border: st === 'current' ? '1px solid #d2aa66' : '1px solid rgba(210,170,102,0.25)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <strong>{questStep.title || questStep.id}</strong>
                            <span className="muted" style={{ fontSize: 12 }}>
                              {st === 'completed' ? '✓' : st === 'current' ? '▶' : ''}
                            </span>
                          </div>
                          {questStep.journalText ? (
                            <p className="muted" style={{ margin: '8px 0 0' }}>
                              {questStep.journalText}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
