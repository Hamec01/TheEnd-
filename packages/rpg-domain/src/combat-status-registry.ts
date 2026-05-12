import type { DamageCategory, ElementType } from './damage';
import type { PrimaryStat } from './stats';

export type CombatStatusStackMode = 'refresh' | 'stack';

export interface CombatStatusPeriodicDamage {
  amountFlat: number;
  scalingStat?: PrimaryStat;
  damageCategory: DamageCategory;
  elementType?: ElementType;
  /** Когда наносить урон: в начале раунда (яд/огонь) или в конце (кровь). */
  phase: 'turn_start' | 'turn_end';
}

/**
 * Метаданные статуса для боевого рантайма и UI.
 * id — канонический идентификатор в состоянии боя и логах.
 */
export interface CombatStatusDefinition {
  id: string;
  labelRu: string;
  category: 'control' | 'dot' | 'debuff' | 'other';
  defaultDurationTurns: number;
  stackMode: CombatStatusStackMode;
  blocksAction: boolean;
  blocksMagic: boolean;
  /** Обездвиживание: move/dash/disengage/retreat запрещены (см. revalidateCombatCommandBeforeExecute). */
  blocksMovement: boolean;
  /** Пенальти к шансу попадания, когда этот статус на **атакующем** (ослепление). */
  attackerHitChanceDeltaPercent: number;
  periodicDamage?: CombatStatusPeriodicDamage;
  aliases: string[];
}

const STUNNED: CombatStatusDefinition = {
  id: 'stunned',
  labelRu: 'Оглушение',
  category: 'control',
  defaultDurationTurns: 1,
  stackMode: 'refresh',
  blocksAction: true,
  blocksMagic: true,
  blocksMovement: true,
  attackerHitChanceDeltaPercent: 0,
  aliases: ['stun', 'actor_stunned'],
};

const KNOCKDOWN: CombatStatusDefinition = {
  id: 'knockdown',
  labelRu: 'Сбит с ног',
  category: 'control',
  defaultDurationTurns: 1,
  stackMode: 'refresh',
  blocksAction: true,
  blocksMagic: true,
  blocksMovement: true,
  attackerHitChanceDeltaPercent: 0,
  aliases: ['knocked_down', 'actor_knocked_down'],
};

const SILENCED: CombatStatusDefinition = {
  id: 'silenced',
  labelRu: 'Молчание',
  category: 'control',
  defaultDurationTurns: 2,
  stackMode: 'refresh',
  blocksAction: false,
  blocksMagic: true,
  blocksMovement: false,
  attackerHitChanceDeltaPercent: 0,
  aliases: ['silence', 'actor_silenced'],
};

const FROZEN: CombatStatusDefinition = {
  id: 'frozen',
  labelRu: 'Заморозка',
  category: 'control',
  defaultDurationTurns: 1,
  stackMode: 'refresh',
  blocksAction: true,
  blocksMagic: false,
  blocksMovement: true,
  attackerHitChanceDeltaPercent: 0,
  aliases: ['freeze'],
};

const BLINDED: CombatStatusDefinition = {
  id: 'blinded',
  labelRu: 'Ослепление',
  category: 'debuff',
  defaultDurationTurns: 2,
  stackMode: 'refresh',
  blocksAction: false,
  blocksMagic: false,
  blocksMovement: false,
  attackerHitChanceDeltaPercent: -25,
  aliases: ['blind'],
};

const POISONED: CombatStatusDefinition = {
  id: 'poisoned',
  labelRu: 'Отравление',
  category: 'dot',
  defaultDurationTurns: 3,
  stackMode: 'refresh',
  blocksAction: false,
  blocksMagic: false,
  blocksMovement: false,
  attackerHitChanceDeltaPercent: 0,
  periodicDamage: {
    amountFlat: 3,
    damageCategory: 'poison',
    phase: 'turn_start',
  },
  aliases: ['poison'],
};

const BLEEDING: CombatStatusDefinition = {
  id: 'bleeding',
  labelRu: 'Кровотечение',
  category: 'dot',
  defaultDurationTurns: 3,
  stackMode: 'refresh',
  blocksAction: false,
  blocksMagic: false,
  blocksMovement: false,
  attackerHitChanceDeltaPercent: 0,
  periodicDamage: {
    amountFlat: 3,
    damageCategory: 'bleed',
    phase: 'turn_end',
  },
  aliases: ['bleed'],
};

const BURNING: CombatStatusDefinition = {
  id: 'burning',
  labelRu: 'Горение',
  category: 'dot',
  defaultDurationTurns: 2,
  stackMode: 'refresh',
  blocksAction: false,
  blocksMagic: false,
  blocksMovement: false,
  attackerHitChanceDeltaPercent: 0,
  periodicDamage: {
    amountFlat: 3,
    damageCategory: 'elemental',
    elementType: 'fire',
    phase: 'turn_start',
  },
  aliases: ['burn'],
};

const SLOWED: CombatStatusDefinition = {
  id: 'slowed',
  labelRu: 'Замедление',
  category: 'debuff',
  defaultDurationTurns: 2,
  stackMode: 'refresh',
  blocksAction: false,
  blocksMagic: false,
  blocksMovement: false,
  attackerHitChanceDeltaPercent: 0,
  aliases: ['slow'],
};

const CURSED: CombatStatusDefinition = {
  id: 'cursed',
  labelRu: 'Проклятие',
  category: 'debuff',
  defaultDurationTurns: 3,
  stackMode: 'refresh',
  blocksAction: false,
  blocksMagic: false,
  blocksMovement: false,
  attackerHitChanceDeltaPercent: 0,
  aliases: ['curse'],
};

export const COMBAT_STATUS_DEFINITIONS: readonly CombatStatusDefinition[] = [
  STUNNED,
  KNOCKDOWN,
  SILENCED,
  FROZEN,
  BLINDED,
  POISONED,
  BLEEDING,
  BURNING,
  SLOWED,
  CURSED,
];

const ALIAS_TO_CANONICAL: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const def of COMBAT_STATUS_DEFINITIONS) {
    m.set(normalizeStatusKey(def.id), def.id);
    for (const a of def.aliases) {
      m.set(normalizeStatusKey(a), def.id);
    }
  }
  return m;
})();

const DEF_BY_ID = new Map(COMBAT_STATUS_DEFINITIONS.map((d) => [d.id, d]));

function normalizeStatusKey(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Канонический id или исходная строка, если статус не из реестра (кастомный контент).
 */
export function canonicalCombatStatusId(statusId: string | undefined | null): string | null {
  if (!statusId || typeof statusId !== 'string') {
    return null;
  }
  const key = normalizeStatusKey(statusId);
  return ALIAS_TO_CANONICAL.get(key) ?? statusId;
}

export function getCombatStatusDefinition(canonicalOrRawId: string | undefined | null): CombatStatusDefinition | undefined {
  if (!canonicalOrRawId) {
    return undefined;
  }
  const canon = canonicalCombatStatusId(canonicalOrRawId);
  if (!canon) {
    return undefined;
  }
  return DEF_BY_ID.get(canon);
}

export function isRegisteredCombatStatusId(statusId: string): boolean {
  const canon = canonicalCombatStatusId(statusId);
  return Boolean(canon && DEF_BY_ID.has(canon));
}

/** Для подсказок UI. */
export const KNOWN_COMBAT_STATUS_IDS: string[] = COMBAT_STATUS_DEFINITIONS.map((d) => d.id);
