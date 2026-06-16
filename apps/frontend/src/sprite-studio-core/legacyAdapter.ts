import type { SpriteActionType } from '@theend/rpg-domain';

const LEGACY_ACTION_ALIAS_MAP: Record<string, SpriteActionType> = {
  die: 'death',
  sword_strike: 'attack_melee',
  attack: 'attack_melee',
  shoot_bow: 'attack_ranged',
  claws_slash: 'attack_melee',
  cast_spell: 'cast',
  shield_block: 'block',
  defense: 'block',
};

export function normalizeLegacySpriteAction(action: string | null | undefined): SpriteActionType | null {
  const normalized = String(action ?? '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized in LEGACY_ACTION_ALIAS_MAP) {
    return LEGACY_ACTION_ALIAS_MAP[normalized]!;
  }
  switch (normalized) {
    case 'idle':
    case 'walk':
    case 'run':
    case 'attack_melee':
    case 'attack_ranged':
    case 'cast':
    case 'block':
    case 'hit':
    case 'death':
    case 'interact':
    case 'work':
    case 'carry':
    case 'roll':
    case 'jump':
      return normalized;
    default:
      return null;
  }
}

