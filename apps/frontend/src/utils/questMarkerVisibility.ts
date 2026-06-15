import type { PlayerQuestState, QuestDefinition, QuestMarkerDefinition, QuestObjective, QuestStep } from '../types/quest';
import { evaluateRequirements } from '../services/questInteractionRuntime';
import { getPlayerQuestState } from '../services/questRuntime';
import type { QuestRuntimePlayer } from '../services/questRuntime';

/**
 * Determines whether a quest marker should be visible to the player in play mode.
 *
 * Rules (evaluated in order):
 * 1. If marker.isActive === false → hidden
 * 2. If marker.requirements exist → all must pass
 * 3. If marker.hideAfterQuestCompleted and the linked quest is completed → hidden
 * 4. If marker.hideAfterObjectiveCompleted and the linked objective is completed → hidden
 * 5. If marker.hideAfterStepCompleted and the linked step is completed → hidden
 * 6. Otherwise fall through to the caller's legacy visibility logic
 *
 * Returns null when none of the new rules apply (caller should use existing logic).
 * Returns true/false when a new rule definitively resolves visibility.
 */
export function checkMarkerRequirements(
  marker: QuestMarkerDefinition,
  player: QuestRuntimePlayer,
): boolean | null {
  // Rule 1: isActive flag
  if (marker.isActive === false) {
    return false;
  }

  // Rule 2: requirements array (all must pass)
  if (marker.requirements && marker.requirements.length > 0) {
    if (!evaluateRequirements(player, marker.requirements)) {
      return false;
    }
    // Requirements passed — continue to check hide-after rules below
  }

  // Rules 3-5: hide-after checks using linked ids
  const questId = marker.linkedQuestId?.trim() ?? null;
  const objectiveId = marker.linkedObjectiveId?.trim() ?? null;
  const stepId = marker.linkedStepId?.trim() ?? null;

  if (questId) {
    const state = getPlayerQuestState(player.id, questId);

    if (!state || state.status !== 'active') {
      return false;
    }

    if (stepId && state.currentStepId && state.currentStepId !== stepId) {
      return false;
    }

    if (marker.hideAfterObjectiveCompleted && objectiveId && state?.completedObjectiveIds.includes(objectiveId)) {
      return false;
    }
    if (marker.hideAfterStepCompleted && stepId && state?.completedStepIds.includes(stepId)) {
      return false;
    }
  }

  // If we have requirements that all passed and no hide-after triggered, show it
  if (marker.requirements && marker.requirements.length > 0) {
    return true;
  }

  // No new rules applied definitively; let caller decide via legacy logic
  return null;
}

/**
 * Full visibility check: applies new data-driven rules and falls back to
 * the legacy visibleToPlayer / linkedQuestId logic for markers that have
 * no new configuration.
 */
export function isQuestMarkerVisible(
  marker: QuestMarkerDefinition,
  player: QuestRuntimePlayer,
): boolean {
  const result = checkMarkerRequirements(marker, player);
  if (result !== null) {
    return result;
  }

  // Legacy fallback: respect visibleToPlayer flag
  return marker.visibleToPlayer === true;
}

type QuestStatesInput =
  | PlayerQuestState[]
  | Map<string, PlayerQuestState>
  | Record<string, PlayerQuestState | undefined>;

function getQuestState(questStates: QuestStatesInput, questId: string): PlayerQuestState | null {
  if (Array.isArray(questStates)) {
    return questStates.find((state) => state.questId === questId) ?? null;
  }

  if (questStates instanceof Map) {
    return questStates.get(questId) ?? null;
  }

  return questStates[questId] ?? null;
}

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function getCurrentStep(quest: QuestDefinition | null, state: PlayerQuestState): QuestStep | null {
  const steps = asArray(quest?.steps);
  if (steps.length === 0) {
    return null;
  }

  if (state.currentStepId) {
    return steps.find((step) => step.id === state.currentStepId) ?? steps[0] ?? null;
  }

  return steps.find((step) => !state.completedStepIds.includes(step.id)) ?? steps[0] ?? null;
}

function getFirstIncompleteObjective(step: QuestStep | null, state: PlayerQuestState): QuestObjective | null {
  const objectives = asArray(step?.objectives);
  if (objectives.length === 0) {
    return null;
  }

  return objectives.find((objective) => (
    !objective.isOptional && !state.completedObjectiveIds.includes(objective.id)
  )) ?? objectives.find((objective) => !state.completedObjectiveIds.includes(objective.id))
    ?? null;
}

export function getQuestMarkerQuestId(marker: QuestMarkerDefinition): string {
  const legacyQuestId = (marker as QuestMarkerDefinition & { questId?: unknown }).questId;
  return String(marker.linkedQuestId ?? legacyQuestId ?? '').trim();
}

export function getQuestMarkerObjectiveId(marker: QuestMarkerDefinition): string {
  return String(marker.linkedObjectiveId ?? marker.objectiveId ?? '').trim();
}

export function isMarkerForFirstIncompleteObjective(
  marker: QuestMarkerDefinition,
  state: PlayerQuestState,
  quest?: QuestDefinition | null,
): boolean {
  if (marker.linkedStepId && state.currentStepId && marker.linkedStepId !== state.currentStepId) {
    return false;
  }

  const markerObjectiveId = getQuestMarkerObjectiveId(marker);
  if (markerObjectiveId && state.completedObjectiveIds.includes(markerObjectiveId)) {
    return false;
  }

  const firstObjective = getFirstIncompleteObjective(getCurrentStep(quest ?? null, state), state);
  if (!firstObjective) {
    return markerObjectiveId.length === 0;
  }

  return markerObjectiveId === firstObjective.id;
}

export function getTrackedQuestMarker(params: {
  questMarkers: QuestMarkerDefinition[];
  trackedQuestId?: string | null;
  trackedObjectiveId?: string | null;
  questStates: QuestStatesInput;
  questDefinitions?: QuestDefinition[];
}): QuestMarkerDefinition | null {
  const trackedQuestId = params.trackedQuestId?.trim();
  if (!trackedQuestId) {
    return null;
  }

  const questState = getQuestState(params.questStates, trackedQuestId);
  if (!questState) {
    return null;
  }

  if (questState.status === 'completed' || questState.status === 'failed' || questState.status === 'abandoned') {
    return null;
  }

  const quest = params.questDefinitions?.find((entry) => entry.id === trackedQuestId) ?? null;
  const questMarkers = params.questMarkers.filter((marker) => getQuestMarkerQuestId(marker) === trackedQuestId);
  const trackedObjectiveId = params.trackedObjectiveId?.trim();

  if (trackedObjectiveId && !questState.completedObjectiveIds.includes(trackedObjectiveId)) {
    const exact = questMarkers.find((marker) => getQuestMarkerObjectiveId(marker) === trackedObjectiveId) ?? null;
    if (exact) {
      return exact;
    }
  }

  return questMarkers.find((marker) => isMarkerForFirstIncompleteObjective(marker, questState, quest)) ?? null;
}
