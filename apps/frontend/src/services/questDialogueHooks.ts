import { getQuestItemById } from './questRepository';
import {
  advanceQuest,
  canStartQuest,
  completeObjective,
  completeQuest,
  failQuest,
  getPlayerQuestState,
  setQuestFlag,
  startQuest,
  type QuestRuntimePlayer,
} from './questRuntime';
import { getQuestById } from './questRepository';

export type DialogueQuestActionType =
  | 'startQuest'
  | 'completeObjective'
  | 'advanceQuest'
  | 'failQuest'
  | 'setQuestFlag'
  | 'giveQuestItem'
  | 'takeQuestItem'
  | 'giveReward'
  | 'addReputation';

export interface DialogueQuestAction {
  type: DialogueQuestActionType;
  questId?: string;
  objectiveId?: string;
  key?: string;
  value?: unknown;
  questItemId?: string;
  amount?: number;
}

export interface DialogueQuestConditionCheck {
  questId?: string;
  requiresActive?: boolean;
  requiresCompleted?: boolean;
  requiresNotCompleted?: boolean;
  objectiveId?: string;
  hasQuestItemId?: string;
  hasItemId?: string;
  requiredProfessionId?: string;
  requiredRace?: string;
  requiredClassId?: string;
  flagKey?: string;
  flagValue?: unknown;
}

export function checkDialogueQuestCondition(player: QuestRuntimePlayer, condition: DialogueQuestConditionCheck): boolean {
  if (condition.questId) {
    const state = getPlayerQuestState(player.id, condition.questId);
    if (condition.requiresActive && state?.status !== 'active') {
      return false;
    }
    if (condition.requiresCompleted && state?.status !== 'completed') {
      return false;
    }
    if (condition.requiresNotCompleted && state?.status === 'completed') {
      return false;
    }
    if (condition.objectiveId && !state?.completedObjectiveIds.includes(condition.objectiveId)) {
      return false;
    }
  }

  if (condition.hasQuestItemId && !getQuestItemById(condition.hasQuestItemId)) {
    return false;
  }

  if (condition.requiredProfessionId && player.professionId !== condition.requiredProfessionId) {
    return false;
  }

  if (condition.requiredRace && player.race !== condition.requiredRace) {
    return false;
  }

  if (condition.requiredClassId && player.classId !== condition.requiredClassId) {
    return false;
  }

  if (condition.flagKey) {
    const current = player.flags?.[condition.flagKey];
    if (current !== condition.flagValue) {
      return false;
    }
  }

  return true;
}

export function applyDialogueQuestAction(player: QuestRuntimePlayer, action: DialogueQuestAction): string {
  switch (action.type) {
    case 'startQuest': {
      if (!action.questId) {
        return 'Quest id missing for startQuest action.';
      }
      const quest = getQuestById(action.questId);
      if (!quest) {
        return `Quest not found: ${action.questId}`;
      }
      if (!canStartQuest(player, quest)) {
        return `Cannot start quest: ${action.questId}`;
      }
      startQuest(player.id, action.questId);
      return `Quest started: ${action.questId}`;
    }
    case 'completeObjective': {
      if (!action.questId || !action.objectiveId) {
        return 'Quest id or objective id missing for completeObjective action.';
      }
      completeObjective(player.id, action.questId, action.objectiveId);
      return `Objective completed: ${action.objectiveId}`;
    }
    case 'advanceQuest': {
      if (!action.questId) {
        return 'Quest id missing for advanceQuest action.';
      }
      advanceQuest(player.id, action.questId);
      return `Quest advanced: ${action.questId}`;
    }
    case 'failQuest': {
      if (!action.questId) {
        return 'Quest id missing for failQuest action.';
      }
      failQuest(player.id, action.questId, 'dialogue');
      return `Quest failed: ${action.questId}`;
    }
    case 'setQuestFlag': {
      if (!action.questId || !action.key) {
        return 'Quest id or key missing for setQuestFlag action.';
      }
      setQuestFlag(player.id, action.questId, action.key, action.value ?? true);
      return `Quest flag set: ${action.key}`;
    }
    case 'giveQuestItem': {
      if (!action.questItemId) {
        return 'Quest item id missing for giveQuestItem action.';
      }
      return `Quest item granted: ${action.questItemId}`;
    }
    case 'takeQuestItem': {
      if (!action.questItemId) {
        return 'Quest item id missing for takeQuestItem action.';
      }
      return `Quest item removed: ${action.questItemId}`;
    }
    case 'giveReward': {
      if (!action.questId) {
        return 'Quest id missing for giveReward action.';
      }
      completeQuest(player.id, action.questId);
      return `Rewards issued for quest: ${action.questId}`;
    }
    case 'addReputation': {
      return `Reputation changed by ${action.amount ?? 0}.`;
    }
    default:
      return 'Unsupported dialogue quest action.';
  }
}
