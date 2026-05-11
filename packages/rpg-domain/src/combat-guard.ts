import type { CombatCommandType } from './combat-plan';

export type CombatGuardType = 'guard' | 'strong_guard';
export type GuardDamageKind = 'physical' | 'magical';

export interface GuardEndRoundRegen {
  hpPercent?: number;
  mpPercent?: number;
  staminaPercent?: number;
}

export interface CombatGuardState {
  type: CombatGuardType;
  appliedRound: number;
  appliedStep: number;
  expiresAtRoundEnd: true;
  blockChanceBonus: number;
  physicalResistanceBonus: number;
  magicResistanceBonus: number;
  endRoundRegen?: GuardEndRoundRegen;
  broken?: boolean;
}

export interface GuardEquipmentBonus {
  blockChanceBonus: number;
  physicalResistanceBonus: number;
  projectileBlockBonus: number;
}

export interface GuardMitigationResult {
  finalDamage: number;
  blocked: boolean;
  partiallyBlocked: boolean;
  guardBroken: boolean;
  blockRoll: number;
  blockThreshold: number;
}

export interface GuardableEntity {
  hasShield?: boolean;
  isDisarmed?: boolean;
}

export const GUARD_RANK: Record<CombatGuardType, number> = {
  guard: 1,
  strong_guard: 2,
};

export const GUARD_EFFECTS: Record<CombatGuardType, Omit<CombatGuardState, 'type' | 'appliedRound' | 'appliedStep' | 'expiresAtRoundEnd'>> = {
  guard: {
    blockChanceBonus: 10,
    physicalResistanceBonus: 8,
    magicResistanceBonus: 0,
  },
  strong_guard: {
    blockChanceBonus: 20,
    physicalResistanceBonus: 15,
    magicResistanceBonus: 5,
    endRoundRegen: {
      hpPercent: 2,
      mpPercent: 3,
      staminaPercent: 5,
    },
  },
};

function toSafeChance(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(95, Math.round(value)));
}

function toSafePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(90, Math.round(value)));
}

export function getGuardEquipmentBonus(actor: GuardableEntity): GuardEquipmentBonus {
  if (actor.hasShield) {
    return {
      blockChanceBonus: 10,
      physicalResistanceBonus: 5,
      projectileBlockBonus: 15,
    };
  }

  return {
    blockChanceBonus: 0,
    physicalResistanceBonus: 0,
    projectileBlockBonus: 0,
  };
}

export function createGuardState(params: {
  type: CombatGuardType;
  roundNumber: number;
  stepIndex: number;
  actor: GuardableEntity;
  previous?: CombatGuardState;
}): CombatGuardState {
  // Weak stance should never overwrite a stronger active guard in the same round.
  if (params.previous && !params.previous.broken && GUARD_RANK[params.previous.type] > GUARD_RANK[params.type]) {
    return params.previous;
  }

  const effect = GUARD_EFFECTS[params.type];
  const equipmentBonus = getGuardEquipmentBonus(params.actor);

  return {
    type: params.type,
    appliedRound: params.roundNumber,
    appliedStep: params.stepIndex,
    expiresAtRoundEnd: true,
    blockChanceBonus: toSafeChance(effect.blockChanceBonus + equipmentBonus.blockChanceBonus),
    physicalResistanceBonus: toSafePercent(effect.physicalResistanceBonus + equipmentBonus.physicalResistanceBonus),
    magicResistanceBonus: toSafePercent(effect.magicResistanceBonus),
    ...(effect.endRoundRegen ? { endRoundRegen: effect.endRoundRegen } : {}),
    broken: false,
  };
}

export function markGuardBroken(state: CombatGuardState | undefined): CombatGuardState | undefined {
  if (!state || state.broken) {
    return state;
  }
  return { ...state, broken: true };
}

export function applyGuardMitigation(params: {
  guardState?: CombatGuardState;
  defender: GuardableEntity;
  incomingDamage: number;
  damageKind: GuardDamageKind;
  attackCommandType?: CombatCommandType;
  isProjectile?: boolean;
  random?: () => number;
}): GuardMitigationResult {
  const baseDamage = Math.max(0, Math.floor(params.incomingDamage));
  if (!params.guardState || params.guardState.broken || baseDamage <= 0) {
    return {
      finalDamage: baseDamage,
      blocked: false,
      partiallyBlocked: false,
      guardBroken: false,
      blockRoll: 0,
      blockThreshold: 0,
    };
  }

  const random = params.random ?? Math.random;
  const guard = params.guardState;
  const equipmentBonus = getGuardEquipmentBonus(params.defender);

  if (params.damageKind === 'magical') {
    const multiplier = 1 - (toSafePercent(guard.magicResistanceBonus) / 100);
    return {
      finalDamage: Math.max(0, Math.floor(baseDamage * multiplier)),
      blocked: false,
      partiallyBlocked: false,
      guardBroken: false,
      blockRoll: 0,
      blockThreshold: 0,
    };
  }

  const physicalResist = Math.min(85, toSafePercent(guard.physicalResistanceBonus));
  const baseAfterResistance = Math.max(0, Math.floor(baseDamage * (1 - physicalResist / 100)));

  const baseBlockChance = guard.blockChanceBonus;
  const projectilePenalty = params.isProjectile && !params.defender.hasShield ? 12 : 0;
  const projectileBonus = params.isProjectile ? equipmentBonus.projectileBlockBonus : 0;
  const disarmedPenalty = params.defender.isDisarmed ? 8 : 0;
  const heavyPenalty = params.attackCommandType === 'heavy_attack' ? 8 : 0;
  const blockThreshold = toSafeChance(baseBlockChance + projectileBonus - projectilePenalty - disarmedPenalty - heavyPenalty);
  const blockRoll = Math.floor(random() * 100) + 1;

  let blocked = false;
  let partiallyBlocked = false;
  let multiplier = 1;

  if (blockRoll <= blockThreshold) {
    blocked = true;
    multiplier = guard.type === 'strong_guard' ? 0.55 : 0.7;
  } else if (blockRoll <= Math.min(95, blockThreshold + 20)) {
    partiallyBlocked = true;
    multiplier = guard.type === 'strong_guard' ? 0.8 : 0.9;
  }

  const finalDamage = Math.max(0, Math.floor(baseAfterResistance * multiplier));

  const heavyBreakThreshold = guard.type === 'strong_guard' ? 48 : 58;
  const guardBreakRoll = Math.floor(random() * 100) + 1;
  const guardBroken = params.attackCommandType === 'heavy_attack'
    ? guardBreakRoll <= heavyBreakThreshold
    : false;

  return {
    finalDamage,
    blocked,
    partiallyBlocked,
    guardBroken,
    blockRoll,
    blockThreshold,
  };
}

export function calculateGuardEndRoundRegen(params: {
  guardState?: CombatGuardState;
  maxHp: number;
  maxMp: number;
  maxStamina: number;
}): { hp: number; mp: number; stamina: number } {
  const regen = params.guardState?.endRoundRegen;
  if (!regen) {
    return { hp: 0, mp: 0, stamina: 0 };
  }

  return {
    hp: Math.max(0, Math.floor(params.maxHp * ((regen.hpPercent ?? 0) / 100))),
    mp: Math.max(0, Math.floor(params.maxMp * ((regen.mpPercent ?? 0) / 100))),
    stamina: Math.max(0, Math.floor(params.maxStamina * ((regen.staminaPercent ?? 0) / 100))),
  };
}