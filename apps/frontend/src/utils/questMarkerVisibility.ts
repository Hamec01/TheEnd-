import type { QuestMarkerDefinition } from '../types/quest';
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

    if (marker.hideAfterQuestCompleted && state?.status === 'completed') {
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
