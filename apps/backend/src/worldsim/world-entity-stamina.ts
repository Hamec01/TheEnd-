import type { RegionType } from '../content/content.types';

export interface WorldEntityStaminaState {
  maxStamina?: number;
  currentStamina?: number;
  staminaRegenPerTick?: number;
}

export interface StaminaDefaults {
  maxStamina: number;
  regenPerTick: number;
  moveCostPerWorldUnit: number;
}

export interface WorldEntityStaminaTickInput {
  state: WorldEntityStaminaState;
  movementDistance: number;
  regionType?: RegionType;
}

export interface WorldEntityStaminaTickResult {
  maxStamina: number;
  currentStamina: number;
  staminaRegenPerTick: number;
  spentStamina: number;
  canMove: boolean;
  recoveredToFull: boolean;
}

const STAMINA_COST_BY_REGION: Record<string, number> = {
  road: 0.92,
  walkable: 1,
  trigger: 1,
  danger: 1.15,
  sand: 1.25,
  swamp: 1.55,
  blocked: 2.6,
  water: 3,
};

function resolveRegionStaminaMultiplier(regionType?: RegionType): number {
  const normalized = String(regionType ?? 'walkable');
  return STAMINA_COST_BY_REGION[normalized] ?? 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveWorldEntityStaminaDefaults(input: WorldEntityStaminaState, defaults: StaminaDefaults): {
  maxStamina: number;
  currentStamina: number;
  staminaRegenPerTick: number;
} {
  const maxStamina = Number.isFinite(input.maxStamina)
    ? Math.max(1, Number(input.maxStamina))
    : defaults.maxStamina;
  const currentStamina = Number.isFinite(input.currentStamina)
    ? clamp(Number(input.currentStamina), 0, maxStamina)
    : maxStamina;
  const staminaRegenPerTick = Number.isFinite(input.staminaRegenPerTick)
    ? Math.max(0.1, Number(input.staminaRegenPerTick))
    : defaults.regenPerTick;

  return {
    maxStamina,
    currentStamina,
    staminaRegenPerTick,
  };
}

export function applyWorldEntityStaminaTick(
  input: WorldEntityStaminaTickInput,
  defaults: StaminaDefaults,
): WorldEntityStaminaTickResult {
  const resolved = resolveWorldEntityStaminaDefaults(input.state, defaults);

  const movementDistance = Number.isFinite(input.movementDistance)
    ? Math.max(0, Number(input.movementDistance))
    : 0;
  const regionMultiplier = resolveRegionStaminaMultiplier(input.regionType);

  const spentRaw = movementDistance * defaults.moveCostPerWorldUnit * regionMultiplier;
  const spentStamina = movementDistance <= 0.000001 ? 0 : Math.max(0, spentRaw);

  let current = resolved.currentStamina;
  if (spentStamina > 0) {
    current = Math.max(0, current - spentStamina);
  }

  let recoveredToFull = false;
  if (spentStamina <= 0 || current <= 0) {
    const next = Math.min(resolved.maxStamina, current + resolved.staminaRegenPerTick);
    recoveredToFull = next >= resolved.maxStamina;
    current = next;
  }

  const canMove = current > 0 && (spentStamina === 0 ? true : current > 0);

  return {
    maxStamina: resolved.maxStamina,
    currentStamina: current,
    staminaRegenPerTick: resolved.staminaRegenPerTick,
    spentStamina,
    canMove,
    recoveredToFull,
  };
}
