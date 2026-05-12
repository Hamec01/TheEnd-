import type { ArenaCombatEquipmentModifiers } from '@theend/rpg-domain';
import { emptyArenaCombatEquipmentModifiers } from '@theend/rpg-domain';
import type { DamageCategory, ItemEffect } from './content.types';

function isPassiveEquipmentTrigger(trigger: ItemEffect['trigger'] | undefined): boolean {
  return trigger === undefined || trigger === 'always';
}

function addEffectPercent(effect: ItemEffect): number {
  if (typeof effect.percent === 'number' && Number.isFinite(effect.percent)) {
    return effect.percent;
  }
  return 0;
}

function addEffectFlat(effect: ItemEffect): number {
  if (typeof effect.flat === 'number' && Number.isFinite(effect.flat)) {
    return effect.flat;
  }
  if (typeof effect.value === 'number' && Number.isFinite(effect.value)) {
    return effect.value;
  }
  return 0;
}

function routeIncomingDamage(
  m: ArenaCombatEquipmentModifiers,
  category: DamageCategory | undefined,
  percent: number,
  flat: number,
): void {
  if (!category) {
    m.incomingPhysical.percent += percent;
    m.incomingPhysical.flat += flat;
    m.incomingMagic.percent += percent;
    m.incomingMagic.flat += flat;
    return;
  }
  if (category === 'physical' || category === 'true') {
    m.incomingPhysical.percent += percent;
    m.incomingPhysical.flat += flat;
    return;
  }
  if (
    category === 'magic'
    || category === 'elemental'
    || category === 'shamanic'
    || category === 'runic'
    || category === 'poison'
    || category === 'bleed'
  ) {
    m.incomingMagic.percent += percent;
    m.incomingMagic.flat += flat;
  }
}

/**
 * Суммирует пассивные ItemEffect (trigger always / без trigger) в модификаторы шага боя арены.
 */
export function aggregateArenaCombatEquipmentModifiers(effects: readonly ItemEffect[]): ArenaCombatEquipmentModifiers {
  const m = emptyArenaCombatEquipmentModifiers();
  for (const e of effects) {
    if (!e || !isPassiveEquipmentTrigger(e.trigger)) {
      continue;
    }
    switch (e.type) {
      case 'hit_chance_modifier':
        m.hitChancePercent += addEffectPercent(e) + addEffectFlat(e);
        break;
      case 'crit_chance_modifier':
        m.critChancePercent += addEffectPercent(e) + addEffectFlat(e);
        break;
      case 'dodge_chance_modifier':
        m.dodgeChancePercent += addEffectPercent(e) + addEffectFlat(e);
        break;
      case 'block_chance_modifier':
        m.blockChancePercent += addEffectPercent(e) + addEffectFlat(e);
        break;
      case 'crit_chance_taken_modifier':
        m.critChanceTakenPercent += addEffectPercent(e) + addEffectFlat(e);
        break;
      case 'outgoing_damage_modifier':
        m.outgoingDamagePercent += addEffectPercent(e) + addEffectFlat(e);
        break;
      case 'incoming_damage_modifier': {
        const p = addEffectPercent(e);
        const f = addEffectFlat(e);
        routeIncomingDamage(m, e.damageCategory, p, f);
        break;
      }
      default:
        break;
    }
  }
  return m;
}
