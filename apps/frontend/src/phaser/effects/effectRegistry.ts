export type BattleEffectKind = 'slash' | 'blunt' | 'projectile' | 'impact' | 'status' | 'death' | 'loot';

export interface BattleVisualEffect {
  id: string;
  kind: BattleEffectKind;
  color: number;
  secondaryColor?: number;
  radius?: number;
  durationMs?: number;
}

export const BATTLE_EFFECT_REGISTRY: Record<string, BattleVisualEffect> = {
  hit_slash: { id: 'hit_slash', kind: 'slash', color: 0xf4e6c2, secondaryColor: 0xbb2633, durationMs: 220 },
  hit_blunt: { id: 'hit_blunt', kind: 'blunt', color: 0xc8b89a, secondaryColor: 0x6f6252, durationMs: 220 },
  projectile_arrow: { id: 'projectile_arrow', kind: 'projectile', color: 0xd8b66a, secondaryColor: 0x5f4630, radius: 4, durationMs: 360 },
  projectile_fire: { id: 'projectile_fire', kind: 'projectile', color: 0xff7a22, secondaryColor: 0xffd36a, radius: 6, durationMs: 420 },
  projectile_ice: { id: 'projectile_ice', kind: 'projectile', color: 0x8ed8ff, secondaryColor: 0xe8fbff, radius: 5, durationMs: 420 },
  impact_blood: { id: 'impact_blood', kind: 'impact', color: 0x9e1f2a, secondaryColor: 0xf05252, durationMs: 260 },
  impact_fire: { id: 'impact_fire', kind: 'impact', color: 0xff6a00, secondaryColor: 0xffd35a, durationMs: 360 },
  impact_ice: { id: 'impact_ice', kind: 'impact', color: 0x87ceff, secondaryColor: 0xffffff, durationMs: 320 },
  death_fade: { id: 'death_fade', kind: 'death', color: 0x1f1712, durationMs: 520 },
  loot_spawn: { id: 'loot_spawn', kind: 'loot', color: 0xf3d27a, secondaryColor: 0xffffff, durationMs: 420 },
  burning: { id: 'burning', kind: 'status', color: 0xff5c18, secondaryColor: 0xffc766, durationMs: 900 },
  poisoned: { id: 'poisoned', kind: 'status', color: 0x45c961, secondaryColor: 0x173f25, durationMs: 900 },
  frozen: { id: 'frozen', kind: 'status', color: 0x9be2ff, secondaryColor: 0xffffff, durationMs: 900 },
  bleeding: { id: 'bleeding', kind: 'status', color: 0xb0212a, secondaryColor: 0xff5c63, durationMs: 900 },
  stunned: { id: 'stunned', kind: 'status', color: 0xffe36b, secondaryColor: 0xffffff, durationMs: 900 },
  shielded: { id: 'shielded', kind: 'status', color: 0x57c7ff, secondaryColor: 0xffffff, durationMs: 900 },
};

export const BATTLE_EFFECT_IDS = Object.keys(BATTLE_EFFECT_REGISTRY);

export function getBattleEffect(id: string | null | undefined, fallbackId = 'hit_slash'): BattleVisualEffect {
  return BATTLE_EFFECT_REGISTRY[id ?? ''] ?? BATTLE_EFFECT_REGISTRY[fallbackId] ?? BATTLE_EFFECT_REGISTRY.hit_slash;
}

export function inferEffectIdForAnimation(event: { type: string; movementType?: string; value?: number }): string {
  if (event.type === 'projectile') {
    return 'projectile_arrow';
  }
  if (event.type === 'death_fade') {
    return 'death_fade';
  }
  if (event.type === 'loot_spawn') {
    return 'loot_spawn';
  }
  if (event.type === 'damage_number') {
    return 'impact_blood';
  }
  return event.movementType === 'dash' ? 'hit_blunt' : 'hit_slash';
}
