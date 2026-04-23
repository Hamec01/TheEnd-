import type { CombatReadyEntity } from './combat';

export type DamageType = 'physical' | 'magic' | 'element';
export type CombatActionType = 'BASIC_ATTACK' | 'DEFEND' | 'SKIP_TURN';

export interface ActiveEffect {
  id: string;
  type: string;
  turnsLeft: number;
}

export interface CombatEntity extends Omit<CombatReadyEntity, 'activeEffects'> {
  defending: boolean;
  turnMeter: number;
  activeEffects: ActiveEffect[];
}

export interface CombatAction {
  actorId: string;
  targetId?: string;
  type: CombatActionType;
}

export interface CombatState {
  participants: CombatEntity[];
  turnOrder: string[];
  currentTurnIndex: number;
  finished: boolean;
  winnerId?: string;
}

export function createCombatEntity(entity: CombatReadyEntity): CombatEntity {
  return {
    ...entity,
    defending: false,
    turnMeter: entity.derived.initiative,
    activeEffects: [],
  };
}

export function initializeCombat(participants: CombatReadyEntity[]): CombatState {
  const entities = participants.map(createCombatEntity);
  const turnOrder = [...entities]
    .sort((a, b) => b.derived.initiative - a.derived.initiative)
    .map((entity) => entity.id);

  return {
    participants: entities,
    turnOrder,
    currentTurnIndex: 0,
    finished: false,
  };
}

function findEntity(state: CombatState, id: string): CombatEntity {
  const entity = state.participants.find((item) => item.id === id);
  if (!entity) {
    throw new Error(`Entity ${id} not found.`);
  }
  return entity;
}

function applyDamage(target: CombatEntity, amount: number, damageType: DamageType): void {
  let effective = amount;

  if (damageType === 'magic') {
    effective = Math.round(effective * target.raceModifiers.magicDamageTakenMultiplier);
  }
  if (damageType === 'element') {
    effective = Math.round(effective * target.raceModifiers.elementDamageTakenMultiplier);
  }
  if (target.defending) {
    effective = Math.round(effective * 0.5);
  }

  target.currentHp = Math.max(0, target.currentHp - effective);
  target.isAlive = target.currentHp > 0;
}

function nextTurn(state: CombatState): void {
  if (state.finished) {
    return;
  }

  const alive = state.participants.filter((item) => item.isAlive);
  if (alive.length <= 1) {
    state.finished = true;
    state.winnerId = alive[0]?.id;
    return;
  }

  let nextIndex = state.currentTurnIndex;
  for (let i = 0; i < state.turnOrder.length; i += 1) {
    nextIndex = (nextIndex + 1) % state.turnOrder.length;
    const id = state.turnOrder[nextIndex];
    const entity = findEntity(state, id);
    if (entity.isAlive) {
      state.currentTurnIndex = nextIndex;
      break;
    }
  }
}

export function resolveAction(state: CombatState, action: CombatAction): CombatState {
  if (state.finished) {
    return state;
  }

  const activeId = state.turnOrder[state.currentTurnIndex];
  if (activeId !== action.actorId) {
    throw new Error('Actor is not the current participant.');
  }

  const actor = findEntity(state, action.actorId);
  if (!actor.isAlive) {
    nextTurn(state);
    return state;
  }

  actor.defending = false;

  if (action.type === 'BASIC_ATTACK') {
    if (!action.targetId) {
      throw new Error('Target is required for BASIC_ATTACK.');
    }
    const target = findEntity(state, action.targetId);
    applyDamage(target, actor.derived.physicalDamage, 'physical');
  } else if (action.type === 'DEFEND') {
    actor.defending = true;
  }

  nextTurn(state);
  return state;
}
