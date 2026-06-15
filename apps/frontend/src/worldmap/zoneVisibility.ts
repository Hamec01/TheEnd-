import type { PlayerQuestState } from '../types/quest';
import type { WorldMapZone } from './zoneEditorTypes';

/**
 * Resolves player visibility of a world map zone based on visibility conditions.
 *
 * Rules:
 * 1. If zone is not isVisibleToPlayer -> hidden.
 * 2. If zone has no visibilityConditions -> visible (keeps legacy/default behavior).
 * 3. Check visibleWhenQuestId and visibleWhenQuestStatus.
 * 4. Check hideWhenQuestId and hideWhenQuestStatus.
 * 5. Check hideAfterQuestCompleted.
 * 6. Check hideAfterObjectiveCompleted.
 * 7. Check hideAfterStepCompleted.
 * 8. In admin/editor mode, the zone is always visible (isAdminMode = true).
 */
export function isWorldMapZoneVisibleForPlayer(
  zone: WorldMapZone,
  questState?: PlayerQuestState,
  isAdminMode?: boolean
): boolean {
  if (isAdminMode) {
    return true;
  }

  if (zone.isVisibleToPlayer === false) {
    return false;
  }

  const cond = zone.visibilityConditions;
  if (!cond && !zone.requiredQuestId && !zone.requiredQuestStatus && !zone.requiredStepId && !zone.requiredObjectiveId) {
    return true;
  }

  const effectiveQuestState = zone.requiredQuestId || zone.requiredQuestStatus || zone.requiredStepId || zone.requiredObjectiveId
    ? questState
    : questState;

  if (zone.requiredQuestId) {
    if (!effectiveQuestState) {
      return false;
    }
  }

  if (zone.requiredQuestStatus) {
    const status = effectiveQuestState?.status ?? 'inactive';
    if (zone.requiredQuestStatus === 'active' && status !== 'active') {
      return false;
    }
    if (zone.requiredQuestStatus === 'completed' && status !== 'completed') {
      return false;
    }
    if (zone.requiredQuestStatus === 'failed' && status !== 'failed') {
      return false;
    }
  }

  if (zone.requiredStepId) {
    if (!effectiveQuestState || effectiveQuestState.status !== 'active') {
      return false;
    }
    if (effectiveQuestState.currentStepId !== zone.requiredStepId) {
      return false;
    }
    if (effectiveQuestState.completedStepIds?.includes(zone.requiredStepId)) {
      return false;
    }
  }

  if (zone.requiredObjectiveId) {
    if (!effectiveQuestState || effectiveQuestState.status !== 'active') {
      return false;
    }
    if (effectiveQuestState.completedObjectiveIds?.includes(zone.requiredObjectiveId)) {
      return false;
    }
  }

  // 3. If there is visibleWhenQuestId, check quest status.
  if (cond?.visibleWhenQuestId) {
    const status = questState?.status ?? 'inactive';
    if (cond?.visibleWhenQuestStatus) {
      if (cond.visibleWhenQuestStatus === 'active' && status !== 'active') {
        return false;
      }
      if (cond.visibleWhenQuestStatus === 'inactive' && status !== 'inactive') {
        return false;
      }
      if (cond.visibleWhenQuestStatus === 'completed' && status !== 'completed') {
        return false;
      }
      if (cond.visibleWhenQuestStatus === 'not_completed' && status === 'completed') {
        return false;
      }
    }

    if (cond.stepId) {
      if (!questState || questState.status !== 'active') {
        return false;
      }
      if (questState.currentStepId !== cond.stepId || questState.completedStepIds?.includes(cond.stepId)) {
        return false;
      }
    }

    if (cond.objectiveId) {
      if (!questState || questState.status !== 'active') {
        return false;
      }
      if (questState.completedObjectiveIds?.includes(cond.objectiveId)) {
        return false;
      }
    }
  }

  // 4. If there is hideWhenQuestId, check quest status.
  if (cond?.hideWhenQuestId) {
    const status = questState?.status ?? 'inactive';
    if (cond.hideWhenQuestStatus) {
      if (cond.hideWhenQuestStatus === 'inactive' && status === 'inactive') {
        return false;
      }
      if (cond.hideWhenQuestStatus === 'active' && status === 'active') {
        return false;
      }
      if (cond.hideWhenQuestStatus === 'completed' && status === 'completed') {
        return false;
      }
    }
  }

  // 5. If hideAfterQuestCompleted is true, hide if quest completed.
  if (cond?.hideAfterQuestCompleted === true) {
    if (questState?.status === 'completed') {
      return false;
    }
  }

  // 6. If hideAfterObjectiveCompleted is true, hide if objective completed.
  if (cond?.hideAfterObjectiveCompleted === true && cond.objectiveId) {
    if (questState?.completedObjectiveIds?.includes(cond.objectiveId)) {
      return false;
    }
  }

  // 7. If hideAfterStepCompleted is true, hide if step completed.
  if (cond?.hideAfterStepCompleted === true && cond.stepId) {
    if (questState?.completedStepIds?.includes(cond.stepId)) {
      return false;
    }
  }

  return true;
}
