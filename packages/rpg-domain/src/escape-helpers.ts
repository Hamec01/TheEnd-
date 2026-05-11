import type { ArenaBattleState, EscapeState, ArenaCombatEntity } from './arena-battle';
import type { ExitZone } from './battle-map';
import type { CombatCommand, CombatPlanValidationResult, CombatPlanErrorCode, CombatPlanWarningCode } from './combat-plan';

// 17.62: Проверка разрешён ли побег в этом бою
export function isEscapeAllowedForBattle(battleState: ArenaBattleState): boolean {
  return battleState.battleType != null && battleState.battleType !== 'arena';
}

// 17.63: Найти exit_zone, на которой стоит actor
export function findActorExitZone(params: {
  battleState: ArenaBattleState;
  actorId: string;
}): ExitZone | null {
  const actor = params.battleState.entities.find(e => e.id === params.actorId && e.isAlive);
  if (!actor || typeof actor.battlefieldX !== 'number' || typeof actor.battlefieldY !== 'number') return null;
  const zones = params.battleState.exitZones ?? [];
  for (const zone of zones) {
    if (zone.cells.some(cell => cell.x === actor.battlefieldX && cell.y === actor.battlefieldY)) {
      // Проверка команды
      if (!zone.team || zone.team === 'any') return zone;
      if (zone.team === 'player' && actor.team === 'LEFT') return zone;
      if (zone.team === 'enemy' && actor.team === 'RIGHT') return zone;
    }
  }
  return null;
}

// 17.10: Проверка стоит ли actor на exit_zone
export function isActorStandingOnExitZone(params: {
  battleState: ArenaBattleState;
  actorId: string;
}): { ok: boolean; exitZone?: ExitZone } {
  const zone = findActorExitZone(params);
  return zone ? { ok: true, exitZone: zone } : { ok: false };
}
