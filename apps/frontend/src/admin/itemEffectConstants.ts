import type {
  DamageCategory,
  ElementType,
  ItemEffect,
  ItemEffectType,
  MagicSchool,
  PhysicalType,
  StatKey,
} from '../services/content/models';

export const ADMIN_STAT_KEYS: StatKey[] = [
  'hp', 'mp', 'stamina', 'strength', 'constitution', 'dexterity', 'intelligence', 'luck', 'perception', 'willpower',
];

export const ADMIN_ITEM_EFFECT_TYPES: ItemEffectType[] = [
  'stat_bonus',
  'incoming_damage_modifier',
  'outgoing_damage_modifier',
  'armor_penetration',
  'crit_chance_modifier',
  'crit_damage_modifier',
  'crit_chance_taken_modifier',
  'lifesteal',
  'apply_status',
  'status_resistance',
  'status_immunity',
  'block_chance_modifier',
  'dodge_chance_modifier',
  'hit_chance_modifier',
  'extra_attack_chance',
];

export const ADMIN_DAMAGE_CATEGORIES: DamageCategory[] = [
  'physical', 'elemental', 'magic', 'shamanic', 'runic', 'poison', 'bleed', 'true',
];

export const ADMIN_PHYSICAL_TYPES: PhysicalType[] = ['slash', 'pierce', 'blunt', 'cleave', 'unarmed'];

export const ADMIN_ELEMENT_TYPES: ElementType[] = ['fire', 'water', 'earth', 'air', 'light', 'dark'];

export const ADMIN_MAGIC_SCHOOLS: MagicSchool[] = [
  'blood', 'death', 'life', 'mind', 'illusion', 'curse', 'arcane',
];

export const ADMIN_EFFECT_TRIGGERS: NonNullable<ItemEffect['trigger']>[] = [
  'always', 'on_hit', 'on_crit', 'on_use', 'on_turn_start', 'on_turn_end',
];

export function isKnownItemEffectType(type: string): type is ItemEffectType {
  return (ADMIN_ITEM_EFFECT_TYPES as string[]).includes(type);
}

export type ItemEffectJson = ItemEffect & Record<string, unknown>;
