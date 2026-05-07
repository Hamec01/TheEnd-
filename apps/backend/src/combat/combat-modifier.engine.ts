export interface OutgoingDamageModifiersInput {
  baseDamage: number;
  outgoingFlat?: number;
  outgoingPercent?: number;
}

export interface OutgoingDamageModifiersResult {
  valueAfterFlat: number;
  valueAfterPercent: number;
  finalDamage: number;
}

export interface ArmorAndPenetrationInput {
  damage: number;
  baseArmor?: number;
  armorBonus?: number;
  penetrationFlat?: number;
  penetrationPercent?: number;
  isBlocked?: boolean;
  blockReductionPercent?: number;
}

export interface ArmorAndPenetrationResult {
  armorTotal: number;
  effectiveArmor: number;
  afterArmor: number;
  afterBlock: number;
  finalDamage: number;
}

export interface IncomingDamageModifiersInput {
  damage: number;
  incomingFlat?: number;
  incomingPercent?: number;
  clampMin?: number;
  clampMax?: number;
}

export interface IncomingDamageModifiersResult {
  valueAfterFlat: number;
  valueAfterPercent: number;
  finalDamage: number;
}

export interface ResolveCritInput {
  damage: number;
  baseCritChance?: number;
  attackerCritChanceBonus?: number;
  defenderCritTakenReduction?: number;
  baseCritMultiplier?: number;
  attackerCritDamagePercent?: number;
  critRollPercent?: number;
}

export interface ResolveCritResult {
  critChance: number;
  critMultiplier: number;
  isCrit: boolean;
  finalDamage: number;
}

export interface ResolveStatusApplicationChanceInput {
  baseChancePercent: number;
  sourceChanceBonusPercent?: number;
  targetStatusResistancePercent?: number;
  targetStatusImmunity?: boolean;
  rollPercent?: number;
}

export interface ResolveStatusApplicationChanceResult {
  finalChancePercent: number;
  applied: boolean;
  reason?: 'immune';
}

export interface StatusTickInput {
  baseTickDamage: number;
  outgoingFlat?: number;
  outgoingPercent?: number;
  incomingFlat?: number;
  incomingPercent?: number;
  clampMin?: number;
  clampMax?: number;
}

export interface StatusTickResult {
  afterOutgoing: number;
  afterIncoming: number;
  finalDamage: number;
}

/**
 * Formula 1 + 2:
 * 1) base + outgoing flat
 * 2) outgoing percent
 */
export function applyOutgoingDamageModifiers(input: OutgoingDamageModifiersInput): OutgoingDamageModifiersResult {
  const base = sanitizeNumber(input.baseDamage);
  const outgoingFlat = sanitizeNumber(input.outgoingFlat);
  const outgoingPercent = sanitizeNumber(input.outgoingPercent);

  const valueAfterFlat = base + outgoingFlat;
  const valueAfterPercent = valueAfterFlat * (1 + outgoingPercent / 100);

  return {
    valueAfterFlat,
    valueAfterPercent,
    finalDamage: clamp(valueAfterPercent, 0),
  };
}

/**
 * Formula 5 + 6 + 7:
 * 5) armorTotal = baseArmor + armorBonus
 * 6) effectiveArmor = max(0, (armorTotal - penFlat) * (1 - penPct/100))
 * 7) block reduction
 */
export function applyArmorAndPenetration(input: ArmorAndPenetrationInput): ArmorAndPenetrationResult {
  const damage = clamp(sanitizeNumber(input.damage), 0);
  const baseArmor = sanitizeNumber(input.baseArmor);
  const armorBonus = sanitizeNumber(input.armorBonus);
  const penFlat = sanitizeNumber(input.penetrationFlat);
  const penPct = sanitizePercent(input.penetrationPercent);
  const blockReductionPercent = sanitizePercent(input.blockReductionPercent);

  const armorTotal = baseArmor + armorBonus;
  const effectiveArmor = clamp((armorTotal - penFlat) * (1 - penPct / 100), 0);
  const afterArmor = clamp(damage - effectiveArmor, 0);

  const afterBlock = input.isBlocked
    ? clamp(afterArmor * (1 - blockReductionPercent / 100), 0)
    : afterArmor;

  return {
    armorTotal,
    effectiveArmor,
    afterArmor,
    afterBlock,
    finalDamage: afterBlock,
  };
}

/**
 * Formula 8 + 9:
 * 8) incoming flat/percent
 * 9) final clamp
 */
export function applyIncomingDamageModifiers(input: IncomingDamageModifiersInput): IncomingDamageModifiersResult {
  const damage = clamp(sanitizeNumber(input.damage), 0);
  const incomingFlat = sanitizeNumber(input.incomingFlat);
  const incomingPercent = sanitizeNumber(input.incomingPercent);

  const valueAfterFlat = damage + incomingFlat;
  const valueAfterPercent = valueAfterFlat * (1 + incomingPercent / 100);

  return {
    valueAfterFlat,
    valueAfterPercent,
    finalDamage: clamp(valueAfterPercent, input.clampMin ?? 0, input.clampMax),
  };
}

/**
 * Formula 3 + 4:
 * 3) crit chance = base + atkCrit - defCritTaken
 * 4) crit multiplier = baseCritMultiplier + critDamagePct/100
 *
 * Pure behavior: to avoid hidden randomness, pass critRollPercent explicitly.
 */
export function resolveCrit(input: ResolveCritInput): ResolveCritResult {
  const damage = clamp(sanitizeNumber(input.damage), 0);
  const baseCritChance = sanitizeNumber(input.baseCritChance);
  const attackerCritChanceBonus = sanitizeNumber(input.attackerCritChanceBonus);
  const defenderCritTakenReduction = sanitizeNumber(input.defenderCritTakenReduction);
  const baseCritMultiplier = sanitizeNumber(input.baseCritMultiplier, 1.5);
  const attackerCritDamagePercent = sanitizeNumber(input.attackerCritDamagePercent);

  const critChance = clamp(baseCritChance + attackerCritChanceBonus - defenderCritTakenReduction, 0, 100);
  const critMultiplier = Math.max(1, baseCritMultiplier + attackerCritDamagePercent / 100);

  const roll = input.critRollPercent;
  const isCrit = typeof roll === 'number' && Number.isFinite(roll)
    ? roll >= 0 && roll < critChance
    : false;

  return {
    critChance,
    critMultiplier,
    isCrit,
    finalDamage: isCrit ? damage * critMultiplier : damage,
  };
}

/**
 * Pure status chance resolver with deterministic optional roll.
 */
export function resolveStatusApplicationChance(
  input: ResolveStatusApplicationChanceInput,
): ResolveStatusApplicationChanceResult {
  if (input.targetStatusImmunity) {
    return {
      finalChancePercent: 0,
      applied: false,
      reason: 'immune',
    };
  }

  const baseChance = sanitizePercent(input.baseChancePercent);
  const sourceBonus = sanitizeNumber(input.sourceChanceBonusPercent);
  const resistance = sanitizePercent(input.targetStatusResistancePercent);

  const finalChancePercent = clamp(baseChance + sourceBonus - resistance, 0, 100);
  const roll = input.rollPercent;
  const applied = typeof roll === 'number' && Number.isFinite(roll)
    ? roll >= 0 && roll < finalChancePercent
    : false;

  return {
    finalChancePercent,
    applied,
  };
}

/**
 * Status DOT tick resolver using the same modifier pipeline pieces.
 */
export function applyStatusTick(input: StatusTickInput): StatusTickResult {
  const outgoing = applyOutgoingDamageModifiers({
    baseDamage: input.baseTickDamage,
    outgoingFlat: input.outgoingFlat,
    outgoingPercent: input.outgoingPercent,
  });

  const incoming = applyIncomingDamageModifiers({
    damage: outgoing.finalDamage,
    incomingFlat: input.incomingFlat,
    incomingPercent: input.incomingPercent,
    clampMin: input.clampMin ?? 0,
    clampMax: input.clampMax,
  });

  return {
    afterOutgoing: outgoing.finalDamage,
    afterIncoming: incoming.finalDamage,
    finalDamage: incoming.finalDamage,
  };
}

function sanitizeNumber(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizePercent(value: number | undefined): number {
  return clamp(sanitizeNumber(value), 0, 100);
}

function clamp(value: number, min = 0, max?: number): number {
  const lowerBounded = Math.max(min, value);
  if (typeof max !== 'number' || !Number.isFinite(max)) {
    return lowerBounded;
  }
  return Math.min(max, lowerBounded);
}
