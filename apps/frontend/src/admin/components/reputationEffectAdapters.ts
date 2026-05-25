import { isKingdomId } from '@theend/rpg-domain';
import type { DialogueAction } from '../../types/dialogue';
import type { QuestInteractionEffect, QuestReward } from '../../types/quest';
import type { CitizenshipEffectEditorValue } from './CitizenshipEffectEditor';
import type { ReputationChangeEditorValue } from './ReputationChangesEditor';

type ReputationChangeLike = {
  targetType?: unknown;
  targetId?: unknown;
  kingdomId?: unknown;
  factionId?: unknown;
  amount?: unknown;
  reason?: unknown;
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toEditorReputationChanges(raw: unknown): ReputationChangeEditorValue[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.reduce<ReputationChangeEditorValue[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return acc;
    }

    const typed = entry as ReputationChangeLike;
    const typedTargetType = asTrimmedString(typed.targetType);
    const targetType: ReputationChangeEditorValue['targetType'] = typedTargetType === 'faction'
      ? 'faction'
      : (typedTargetType === 'kingdom'
        ? 'kingdom'
        : (asTrimmedString(typed.factionId) ? 'faction' : 'kingdom'));
    const targetId = asTrimmedString(typed.targetId)
      || (targetType === 'kingdom' ? asTrimmedString(typed.kingdomId) : asTrimmedString(typed.factionId));

    acc.push({
      targetType,
      targetId,
      amount: toFiniteNumber(typed.amount, 0),
      reason: asTrimmedString(typed.reason) || undefined,
    });
    return acc;
  }, []);
}

export function toRuntimeReputationChanges(changes: ReputationChangeEditorValue[]): Array<{
  targetType: 'kingdom' | 'faction';
  targetId: string;
  amount: number;
  reason?: string;
  kingdomId?: string;
  factionId?: string;
}> {
  return changes.reduce<Array<{
    targetType: 'kingdom' | 'faction';
    targetId: string;
    amount: number;
    reason?: string;
    kingdomId?: string;
    factionId?: string;
  }>>((acc, entry) => {
    const targetId = asTrimmedString(entry.targetId);
    if (!targetId) {
      return acc;
    }
    const amount = toFiniteNumber(entry.amount, 0);
    acc.push({
      targetType: entry.targetType,
      targetId,
      amount,
      reason: asTrimmedString(entry.reason) || undefined,
      kingdomId: entry.targetType === 'kingdom' ? targetId : undefined,
      factionId: entry.targetType === 'faction' ? targetId : undefined,
    });
    return acc;
  }, []);
}

export function toEditorCitizenshipEffect(raw: unknown): CitizenshipEffectEditorValue | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    const kingdomId = asTrimmedString(record.kingdomId);
    if (!isKingdomId(kingdomId)) {
      return null;
    }
    return {
      kingdomId,
      oldKingdomPenalty: Number.isFinite(Number(record.oldKingdomPenalty)) ? Number(record.oldKingdomPenalty) : undefined,
      newKingdomBonus: Number.isFinite(Number(record.newKingdomBonus)) ? Number(record.newKingdomBonus) : undefined,
      requireAuthorityNpc: typeof record.requireAuthorityNpc === 'boolean' ? record.requireAuthorityNpc : undefined,
    };
  }

  const kingdomId = asTrimmedString(raw);
  if (isKingdomId(kingdomId)) {
    return { kingdomId };
  }

  return null;
}

export function mergeDialogueActionReputation(
  action: DialogueAction,
  changes: ReputationChangeEditorValue[],
): DialogueAction {
  return {
    ...action,
    type: action.type === 'add_reputation' ? action.type : 'addReputation',
    reputationChanges: toRuntimeReputationChanges(changes),
    kingdomId: undefined,
    factionId: undefined,
    amount: undefined,
  };
}

export function mergeInteractionEffectReputation(
  effect: QuestInteractionEffect,
  changes: ReputationChangeEditorValue[],
): QuestInteractionEffect {
  return {
    ...effect,
    type: effect.type === 'addReputation' ? effect.type : 'add_reputation',
    reputationChanges: toRuntimeReputationChanges(changes),
    kingdomId: undefined,
    factionId: undefined,
    amount: undefined,
  };
}

export function mergeQuestRewardReputation(
  reward: QuestReward,
  changes: ReputationChangeEditorValue[],
): QuestReward {
  return {
    ...reward,
    type: 'reputation',
    reputationChanges: toRuntimeReputationChanges(changes),
    targetId: undefined,
    amount: undefined,
    title: undefined,
  };
}

export function mergeDialogueActionCitizenship(
  action: DialogueAction,
  effect: CitizenshipEffectEditorValue,
): DialogueAction {
  return {
    ...action,
    type: action.type === 'change_citizenship' ? action.type : 'changeCitizenship',
    kingdomId: effect.kingdomId,
    changeCitizenship: {
      kingdomId: effect.kingdomId,
      oldKingdomPenalty: effect.oldKingdomPenalty,
      newKingdomBonus: effect.newKingdomBonus,
      requireAuthorityNpc: effect.requireAuthorityNpc,
    },
  };
}

export function mergeInteractionEffectCitizenship(
  effect: QuestInteractionEffect,
  value: CitizenshipEffectEditorValue,
): QuestInteractionEffect {
  return {
    ...effect,
    type: effect.type === 'changeCitizenship' ? effect.type : 'change_citizenship',
    kingdomId: value.kingdomId,
    changeCitizenship: {
      kingdomId: value.kingdomId,
      oldKingdomPenalty: value.oldKingdomPenalty,
      newKingdomBonus: value.newKingdomBonus,
      requireAuthorityNpc: value.requireAuthorityNpc,
    },
  };
}
