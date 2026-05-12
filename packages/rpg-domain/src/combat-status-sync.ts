import { getCombatStatusDefinition } from './combat-status-registry';

/**
 * Обновляет legacy boolean-флаги контроля на сущности по activeCombatStatuses.
 * Не импортирует arena-battle (избегает циклов с combat-plan).
 */
export function syncControlFlagsFromActiveStatuses(entity: {
  activeCombatStatuses?: Array<{ id: string; remainingTurns: number }> | undefined;
  isStunned?: boolean;
  isKnockedDown?: boolean;
  isSilenced?: boolean;
  isRooted?: boolean;
  isIncapacitated?: boolean;
}): void {
  const list = entity.activeCombatStatuses;
  if (!list) {
    return;
  }

  let isStunned = false;
  let isKnockedDown = false;
  let isSilenced = false;
  let isRooted = false;
  let isIncapacitated = false;

  for (const s of list) {
    if (s.remainingTurns <= 0) {
      continue;
    }
    const def = getCombatStatusDefinition(s.id);
    if (!def) {
      continue;
    }
    if (def.id === 'stunned') {
      isStunned = true;
    }
    if (def.id === 'knockdown') {
      isKnockedDown = true;
    }
    if (def.id === 'silenced') {
      isSilenced = true;
    }
    if (def.blocksMovement) {
      isRooted = true;
    }
    if (def.blocksAction && def.id !== 'stunned' && def.id !== 'knockdown') {
      isIncapacitated = true;
    }
  }

  entity.isStunned = isStunned;
  entity.isKnockedDown = isKnockedDown;
  entity.isSilenced = isSilenced;
  entity.isRooted = isRooted;
  entity.isIncapacitated = isIncapacitated;
}
