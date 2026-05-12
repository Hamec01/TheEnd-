import type { DamageCategory, ElementType, MagicSchool, PhysicalDamageType } from './damage';
import type { PrimaryStat } from './stats';

/**
 * Триггеры ItemEffect из контент-модели (источник истины совпадает с backend content.types).
 */
export type CombatItemEffectTrigger =
  | 'on_hit'
  | 'on_crit'
  | 'on_use'
  | 'on_turn_start'
  | 'on_turn_end'
  | 'always';

export type CombatItemEffectType =
  | 'stat_bonus'
  | 'incoming_damage_modifier'
  | 'outgoing_damage_modifier'
  | 'armor_penetration'
  | 'crit_chance_modifier'
  | 'crit_damage_modifier'
  | 'crit_chance_taken_modifier'
  | 'lifesteal'
  | 'apply_status'
  | 'status_resistance'
  | 'status_immunity'
  | 'block_chance_modifier'
  | 'dodge_chance_modifier'
  | 'hit_chance_modifier'
  | 'extra_attack_chance';

/**
 * Подмножество ItemEffect, достаточное для боевого рантайма в rpg-domain.
 * Структурно совместимо с backend `ItemEffect`.
 */
export interface CombatRuntimeItemEffect {
  type: CombatItemEffectType;
  stat?: PrimaryStat;
  value?: number;
  percent?: number;
  flat?: number;
  damageCategory?: DamageCategory;
  physicalType?: PhysicalDamageType;
  elementType?: ElementType;
  magicSchool?: MagicSchool;
  statusId?: string;
  chancePercent?: number;
  durationTurns?: number;
  trigger?: CombatItemEffectTrigger;
  activationContexts?: string[];
  condition?: string;
  /** Расширение контента (tickDamage и т.д.) без изменения основных полей. */
  data?: Record<string, unknown>;
}

export function isPassiveEquipmentTrigger(trigger: CombatItemEffectTrigger | undefined): boolean {
  return trigger === undefined || trigger === 'always';
}

export function effectNumericPercent(effect: CombatRuntimeItemEffect): number {
  if (typeof effect.percent === 'number' && Number.isFinite(effect.percent)) {
    return effect.percent;
  }
  return 0;
}

export function effectNumericFlat(effect: CombatRuntimeItemEffect): number {
  if (typeof effect.flat === 'number' && Number.isFinite(effect.flat)) {
    return effect.flat;
  }
  if (typeof effect.value === 'number' && Number.isFinite(effect.value)) {
    return effect.value;
  }
  return 0;
}
