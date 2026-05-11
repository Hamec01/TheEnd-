import type { ArenaBattleState, ArenaCombatEntity, EscapeState } from './arena-battle';
import type { ExitZone } from './battle-map';
import type { CombatCommand, CombatPlanValidationResult, CombatPlanErrorCode, CombatPlanWarningCode, CombatEvent } from './combat-plan';
import { isEscapeAllowedForBattle, findActorExitZone } from './escape-helpers';

// 17.64: Валидация команды start_retreat
export function validateStartRetreat(params: {
  battleState: ArenaBattleState;
  actorId: string;
  command: CombatCommand;
}): CombatPlanValidationResult {
  const errors: CombatPlanErrorCode[] = [];
  const warnings: CombatPlanWarningCode[] = [];
  const { battleState, actorId, command } = params;
  if (!isEscapeAllowedForBattle(battleState)) errors.push('ESCAPE_NOT_ALLOWED_IN_ARENA');
  const actor = battleState.entities.find(e => e.id === actorId);
  if (!actor || !actor.isAlive) errors.push('ACTOR_DEAD');
  if (battleState.escapeStates?.[actorId]?.active) errors.push('ESCAPE_ALREADY_ACTIVE');
  const zone = findActorExitZone({ battleState, actorId });
  if (!zone) errors.push('ACTOR_NOT_ON_EXIT_ZONE');
  // Проверка команды зоны (team)
  if (zone && zone.team && zone.team !== 'any') {
    if ((zone.team === 'player' && actor?.team !== 'LEFT') || (zone.team === 'enemy' && actor?.team !== 'RIGHT')) {
      errors.push('EXIT_ZONE_TEAM_NOT_ALLOWED');
    }
  }
  // Контроль: stun/root/knockdown/incapacitated
  const flags = actor as any;
  if (flags.isStunned) errors.push('ACTOR_STUNNED');
  if (flags.isRooted) errors.push('ACTOR_ROOTED');
  if (flags.isKnockedDown || flags.isIncapacitated) errors.push('ACTOR_STUNNED');
  // Проверка ресурсов (AP, stamina)
  const apCost = command.apCost ?? 1;
  const staminaCost = command.costs?.stamina ?? 10;
  if (actor && typeof actor.currentStamina === 'number' && actor.currentStamina < staminaCost) errors.push('NOT_ENOUGH_STAMINA');
  if (typeof command.apCost === 'number' && command.apCost > 0) {
    // AP проверяется на этапе планирования всех команд, но можно добавить здесь при необходимости
  }
  if (errors.length === 0) {
    warnings.push('ESCAPE_REQUIRES_3_ROUNDS', 'ESCAPE_CAN_BE_INTERRUPTED', 'LEAVING_EXIT_ZONE_WILL_CANCEL_ESCAPE');
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    total: {
      commands: 1,
      ap: Math.max(0, apCost),
      mp: 0,
      stamina: Math.max(0, staminaCost),
      hp: 0,
    },
  };
}

// 17.65: resolveStartRetreat (создать EscapeState, event)
export function resolveStartRetreat(params: {
  battleState: ArenaBattleState;
  actorId: string;
  command: CombatCommand;
}): { battleState: ArenaBattleState; events: CombatEvent[] } {
  // Повторная валидация
  const validation = validateStartRetreat(params);
  if (!validation.ok) {
    return { battleState: params.battleState, events: [{
      id: 'evt_' + Math.random().toString(36).slice(2, 10),
      roundNumber: params.battleState.roundNumber,
      stepIndex: 0,
      orderIndex: 0,
      type: 'command_failed',
      actorId: params.actorId,
      commandId: params.command.id,
      message: 'Побег не начат: ' + (validation.errors?.join(', ') || 'ошибка'),
      data: { errors: validation.errors },
    }] };
  }
  // Списание ресурсов (AP, stamina) — предполагается, что это делается в основном combat pipeline
  // Создать EscapeState
  const zone = findActorExitZone({ battleState: params.battleState, actorId: params.actorId });
  const escapeState: EscapeState = {
    actorId: params.actorId,
    active: true,
    startedRound: params.battleState.roundNumber,
    requiredRounds: 3,
    remainingRounds: 3,
    exitZoneId: zone?.id || '',
  };
  const newEscapeStates = { ...(params.battleState.escapeStates ?? {}), [params.actorId]: escapeState };
  const newBattleState: ArenaBattleState = { ...params.battleState, escapeStates: newEscapeStates };
  // Событие escape_started
  const events: CombatEvent[] = [{
    id: 'evt_' + Math.random().toString(36).slice(2, 10),
    roundNumber: params.battleState.roundNumber,
    stepIndex: 0,
    orderIndex: 0,
    type: 'escape_started',
    actorId: params.actorId,
    commandId: params.command.id,
    message: 'Игрок начинает побег через зону выхода.',
    data: {
      exitZoneId: zone?.id,
      requiredRounds: 3,
      remainingRounds: 3,
    },
  }];
  return { battleState: newBattleState, events };
}

// 17.66: tickEscapeStates (end-round tick)
export function tickEscapeStates(params: {
  battleState: ArenaBattleState;
}): { battleState: ArenaBattleState; events: CombatEvent[] } {
  const { battleState } = params;
  const escapeStates = { ...(battleState.escapeStates ?? {}) };
  const events: CombatEvent[] = [];
  for (const [actorId, state] of Object.entries(escapeStates)) {
    if (!state.active) continue;
    const actor = battleState.entities.find(e => e.id === actorId);
    if (!actor || !actor.isAlive) {
      // Сбросить побег (мертв)
      escapeStates[actorId] = { ...state, active: false, interrupted: true, interruptedReason: 'dead' };
      events.push({
        id: 'evt_' + Math.random().toString(36).slice(2, 10),
        roundNumber: battleState.roundNumber,
        stepIndex: 0,
        orderIndex: 0,
        type: 'escape_cancelled',
        actorId,
        message: 'Побег сброшен: персонаж мёртв.',
        data: { reason: 'dead', exitZoneId: state.exitZoneId },
      });
      continue;
    }
    // Проверка: всё ещё в той же зоне
    const zone = findActorExitZone({ battleState, actorId });
    if (!zone || zone.id !== state.exitZoneId) {
      escapeStates[actorId] = { ...state, active: false, interrupted: true, interruptedReason: 'left_zone' };
      events.push({
        id: 'evt_' + Math.random().toString(36).slice(2, 10),
        roundNumber: battleState.roundNumber,
        stepIndex: 0,
        orderIndex: 0,
        type: 'escape_cancelled',
        actorId,
        message: 'Побег сброшен: персонаж покинул зону выхода.',
        data: { reason: 'left_zone', exitZoneId: state.exitZoneId },
      });
      continue;
    }
    // Контроль: stun/root/knockdown/incapacitated
    const flags = actor as any;
    if (flags.isStunned || flags.isRooted || flags.isKnockedDown || flags.isIncapacitated) {
      // Tick не засчитывается
      events.push({
        id: 'evt_' + Math.random().toString(36).slice(2, 10),
        roundNumber: battleState.roundNumber,
        stepIndex: 0,
        orderIndex: 0,
        type: 'escape_delayed',
        actorId,
        message: 'Побег задержан: персонаж не может действовать.',
        data: { reason: flags.isStunned ? 'stunned' : flags.isRooted ? 'rooted' : 'incapacitated', remainingRounds: state.remainingRounds },
      });
      continue;
    }
    // Tick: уменьшить remainingRounds
    const nextRounds = state.remainingRounds - 1;
    if (nextRounds > 0) {
      escapeStates[actorId] = { ...state, remainingRounds: nextRounds };
      events.push({
        id: 'evt_' + Math.random().toString(36).slice(2, 10),
        roundNumber: battleState.roundNumber,
        stepIndex: 0,
        orderIndex: 0,
        type: 'escape_progress',
        actorId,
        message: `Побег: осталось ${nextRounds} раунда(ов).`,
        data: { exitZoneId: state.exitZoneId, remainingRounds: nextRounds },
      });
    } else {
      // Побег завершён
      escapeStates[actorId] = { ...state, active: false, completedRound: battleState.roundNumber, remainingRounds: 0 };
      events.push({
        id: 'evt_' + Math.random().toString(36).slice(2, 10),
        roundNumber: battleState.roundNumber,
        stepIndex: 0,
        orderIndex: 0,
        type: 'escape_success',
        actorId,
        message: 'Побег успешен: персонаж покидает бой.',
        data: { exitZoneId: state.exitZoneId, result: 'escaped' },
      });
    }
  }
  return { battleState: { ...battleState, escapeStates }, events };
}
