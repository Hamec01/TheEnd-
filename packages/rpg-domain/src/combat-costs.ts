export interface CombatActionCost {
  ap: number;
  stamina?: number;
  mp?: number;
  hp?: number;
}

export type CombatActionCostKey =
  | 'move_1_cell'
  | 'move_2_cells'
  | 'dash_3_cells'
  | 'disengage'
  | 'basic_attack'
  | 'heavy_attack'
  | 'guard'
  | 'strong_guard'
  | 'weapon_swap'
  | 'use_self_item'
  | 'use_target_item'
  | 'throw_bomb'
  | 'place_trap'
  | 'cast_instant_skill'
  | 'cast_heavy_skill'
  | 'loot_adjacent'
  | 'start_retreat'
  | 'confirm_retreat'
  | 'wait';

export type CombatCostErrorCode =
  | 'NOT_ENOUGH_AP'
  | 'NOT_ENOUGH_STAMINA'
  | 'NOT_ENOUGH_MP'
  | 'NOT_ENOUGH_HP'
  | 'UNKNOWN_COST_KEY'
  | 'INVALID_NEGATIVE_COST'
  | 'INVALID_NAN_COST';

export const COMBAT_ACTION_COSTS: Record<CombatActionCostKey, CombatActionCost> = {
  move_1_cell: { ap: 1, stamina: 10 },
  move_2_cells: { ap: 1, stamina: 20 },
  dash_3_cells: { ap: 2, stamina: 30 },
  disengage: { ap: 1, stamina: 20 },
  basic_attack: { ap: 1, stamina: 20 },
  heavy_attack: { ap: 1, stamina: 18 },
  guard: { ap: 1, stamina: 8 },
  strong_guard: { ap: 1, stamina: 10 },
  weapon_swap: { ap: 1, stamina: 5 },
  use_self_item: { ap: 1, stamina: 3 },
  use_target_item: { ap: 1, stamina: 5 },
  throw_bomb: { ap: 1, stamina: 10 },
  place_trap: { ap: 1, stamina: 8 },
  cast_instant_skill: { ap: 1 },
  cast_heavy_skill: { ap: 1 },
  loot_adjacent: { ap: 1, stamina: 5 },
  start_retreat: { ap: 1, stamina: 5 },
  confirm_retreat: { ap: 1 },
  wait: { ap: 0 },
};

export interface ResolveCombatCommandCostParams {
  baseCostKey: CombatActionCostKey;
  sourceCost?: Partial<CombatActionCost>;
  flatModifiers?: Partial<CombatActionCost>;
  staminaMultiplier?: number;
  mpMultiplier?: number;
  hpMultiplier?: number;
}

function sanitizePart(part?: Partial<CombatActionCost>): Required<CombatActionCost> {
  const ap = Number(part?.ap ?? 0);
  const stamina = Number(part?.stamina ?? 0);
  const mp = Number(part?.mp ?? 0);
  const hp = Number(part?.hp ?? 0);

  return {
    ap: Number.isFinite(ap) ? Math.max(0, Math.round(ap)) : 0,
    stamina: Number.isFinite(stamina) ? Math.max(0, Math.round(stamina)) : 0,
    mp: Number.isFinite(mp) ? Math.max(0, Math.round(mp)) : 0,
    hp: Number.isFinite(hp) ? Math.max(0, Math.round(hp)) : 0,
  };
}

function safeMultiplier(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, value);
}

export function resolveCombatCommandCost(
  params: ResolveCombatCommandCostParams,
): CombatActionCost {
  const base = COMBAT_ACTION_COSTS[params.baseCostKey];
  if (!base) {
    throw new Error('UNKNOWN_COST_KEY');
  }

  const basePart = sanitizePart(base);
  const source = sanitizePart(params.sourceCost);
  const flat = sanitizePart(params.flatModifiers);

  const staminaMultiplier = safeMultiplier(params.staminaMultiplier);
  const mpMultiplier = safeMultiplier(params.mpMultiplier);
  const hpMultiplier = safeMultiplier(params.hpMultiplier);

  const ap = Math.max(0, Math.round(basePart.ap + source.ap + flat.ap));
  const stamina = Math.max(0, Math.round((basePart.stamina + source.stamina + flat.stamina) * staminaMultiplier));
  const mp = Math.max(0, Math.round((basePart.mp + source.mp + flat.mp) * mpMultiplier));
  const hp = Math.max(0, Math.round((basePart.hp + source.hp + flat.hp) * hpMultiplier));

  return {
    ap,
    ...(stamina > 0 ? { stamina } : {}),
    ...(mp > 0 ? { mp } : {}),
    ...(hp > 0 ? { hp } : {}),
  };
}

export function getMoveCostByDistance(distance: number): CombatActionCost {
  if (!Number.isFinite(distance) || distance <= 0) {
    return COMBAT_ACTION_COSTS.wait;
  }
  if (distance === 1) {
    return COMBAT_ACTION_COSTS.move_1_cell;
  }
  if (distance === 2) {
    return COMBAT_ACTION_COSTS.move_2_cells;
  }
  if (distance === 3) {
    return COMBAT_ACTION_COSTS.dash_3_cells;
  }

  throw new Error('MOVE_DISTANCE_TOO_LONG');
}

export function getStaminaFatigueMultiplier(_actor: { currentStamina: number; maxStamina: number }): number {
  return 1;
}
