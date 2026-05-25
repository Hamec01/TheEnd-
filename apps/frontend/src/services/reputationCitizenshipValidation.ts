import { isKingdomId } from '@theend/rpg-domain';

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

type ReputationChangeEntry = {
  targetType?: unknown;
  targetId?: unknown;
  factionId?: unknown;
  kingdomId?: unknown;
  amount?: unknown;
  reason?: unknown;
};

export function validateReputationChangesValue(value: unknown, path: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [`${path} must be an array.`];
  }

  const errors: string[] = [];

  value.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${path}[${index}] must be an object.`);
      return;
    }

    const typed = entry as ReputationChangeEntry;
    const targetType = asTrimmedString(typed.targetType);
    const targetId = asTrimmedString(typed.targetId);
    const factionId = asTrimmedString(typed.factionId);
    const kingdomId = asTrimmedString(typed.kingdomId);

    if (!isFiniteNumber(typed.amount)) {
      errors.push(`${path}[${index}].amount must be a number.`);
    }

    if (typed.reason !== undefined && typeof typed.reason !== 'string') {
      errors.push(`${path}[${index}].reason must be a string when present.`);
    }

    if (targetType) {
      if (targetType !== 'kingdom' && targetType !== 'faction') {
        errors.push(`${path}[${index}].targetType must be 'kingdom' or 'faction'.`);
        return;
      }

      if (!targetId) {
        errors.push(`${path}[${index}].targetId is required when targetType is provided.`);
      }

      if (targetType === 'kingdom' && targetId && !isKingdomId(targetId)) {
        errors.push(`${path}[${index}] has invalid kingdom targetId '${targetId}'.`);
      }
      return;
    }

    if (kingdomId) {
      if (!isKingdomId(kingdomId)) {
        errors.push(`${path}[${index}] has invalid kingdomId '${kingdomId}'.`);
      }
      return;
    }

    if (!factionId) {
      errors.push(`${path}[${index}] must define targetType/targetId or kingdomId/factionId.`);
    }
  });

  return errors;
}

export function validateChangeCitizenshipValue(value: unknown, path: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${path} must be an object.`];
  }

  const typed = value as Record<string, unknown>;
  const kingdomId = asTrimmedString(typed.kingdomId);
  const errors: string[] = [];

  if (!isKingdomId(kingdomId)) {
    errors.push(`${path}.kingdomId has invalid value '${kingdomId}'.`);
  }
  if (typed.oldKingdomPenalty !== undefined && !isFiniteNumber(typed.oldKingdomPenalty)) {
    errors.push(`${path}.oldKingdomPenalty must be a number when present.`);
  }
  if (typed.newKingdomBonus !== undefined && !isFiniteNumber(typed.newKingdomBonus)) {
    errors.push(`${path}.newKingdomBonus must be a number when present.`);
  }
  if (typed.requireAuthorityNpc !== undefined && typeof typed.requireAuthorityNpc !== 'boolean') {
    errors.push(`${path}.requireAuthorityNpc must be a boolean when present.`);
  }

  return errors;
}
