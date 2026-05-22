export type BattleEffectKind = 'slash' | 'blunt' | 'projectile' | 'impact' | 'status' | 'death' | 'loot' | 'cast';

export type CameraShakePreset = 'none' | 'small' | 'medium' | 'heavy';

export interface BattleVisualEffect {
  id: string;
  kind: BattleEffectKind;
  color: number;
  secondaryColor?: number;
  radius?: number;
  durationMs?: number;
  particleKey?: string;
  cameraShake?: CameraShakePreset;
  soundId?: string;
  fallbackId?: string;
}

const BASE_BATTLE_EFFECTS: Record<string, BattleVisualEffect> = {
  default_melee_hit: {
    id: 'default_melee_hit',
    kind: 'slash',
    color: 0xf4e6c2,
    secondaryColor: 0xbb2633,
    durationMs: 220,
    radius: 8,
    soundId: 'melee_hit_01',
  },
  default_impact: {
    id: 'default_impact',
    kind: 'impact',
    color: 0xd7b486,
    secondaryColor: 0xffffff,
    durationMs: 240,
    radius: 8,
  },
  sword_slash: {
    id: 'sword_slash',
    kind: 'slash',
    color: 0xffe5be,
    secondaryColor: 0xcf3a49,
    durationMs: 220,
    radius: 9,
    soundId: 'sword_slash_01',
  },
  axe_hit: {
    id: 'axe_hit',
    kind: 'blunt',
    color: 0xc7b08e,
    secondaryColor: 0x5f4a3a,
    durationMs: 240,
    radius: 10,
    soundId: 'melee_hit_01',
  },
  blunt_hit: {
    id: 'blunt_hit',
    kind: 'blunt',
    color: 0xd4c0a0,
    secondaryColor: 0x6a5744,
    durationMs: 230,
    radius: 9,
    soundId: 'melee_hit_01',
  },
  arrow_projectile: {
    id: 'arrow_projectile',
    kind: 'projectile',
    color: 0xd8b66a,
    secondaryColor: 0x5f4630,
    radius: 4,
    durationMs: 360,
    soundId: 'arrow_shot_01',
  },
  arrow_impact: {
    id: 'arrow_impact',
    kind: 'impact',
    color: 0xe2c089,
    secondaryColor: 0xffffff,
    durationMs: 250,
    radius: 8,
    soundId: 'arrow_hit_01',
  },
  fire_projectile: {
    id: 'fire_projectile',
    kind: 'projectile',
    color: 0xff7a22,
    secondaryColor: 0xffd36a,
    radius: 6,
    durationMs: 420,
    soundId: 'fire_cast_01',
  },
  fire_impact: {
    id: 'fire_impact',
    kind: 'impact',
    color: 0xff6a00,
    secondaryColor: 0xffd35a,
    durationMs: 340,
    radius: 10,
    cameraShake: 'small',
    soundId: 'fire_hit_01',
  },
  ice_projectile: {
    id: 'ice_projectile',
    kind: 'projectile',
    color: 0x8ed8ff,
    secondaryColor: 0xe8fbff,
    radius: 5,
    durationMs: 420,
    soundId: 'ice_cast_01',
  },
  ice_impact: {
    id: 'ice_impact',
    kind: 'impact',
    color: 0x87ceff,
    secondaryColor: 0xffffff,
    durationMs: 320,
    radius: 9,
    soundId: 'ice_hit_01',
  },
  poison_impact: {
    id: 'poison_impact',
    kind: 'impact',
    color: 0x45c961,
    secondaryColor: 0x173f25,
    durationMs: 320,
    radius: 9,
  },
  blood_hit: {
    id: 'blood_hit',
    kind: 'impact',
    color: 0x9e1f2a,
    secondaryColor: 0xf05252,
    durationMs: 260,
    radius: 8,
    soundId: 'melee_hit_01',
  },
  death_fade: {
    id: 'death_fade',
    kind: 'death',
    color: 0x1f1712,
    durationMs: 520,
    cameraShake: 'small',
    soundId: 'death_01',
  },
  burning: {
    id: 'burning',
    kind: 'status',
    color: 0xff5c18,
    secondaryColor: 0xffc766,
    durationMs: 900,
  },
  poisoned: {
    id: 'poisoned',
    kind: 'status',
    color: 0x45c961,
    secondaryColor: 0x173f25,
    durationMs: 900,
  },
  bleeding: {
    id: 'bleeding',
    kind: 'status',
    color: 0xb0212a,
    secondaryColor: 0xff5c63,
    durationMs: 900,
  },
  frozen: {
    id: 'frozen',
    kind: 'status',
    color: 0x9be2ff,
    secondaryColor: 0xffffff,
    durationMs: 900,
  },
  stunned: {
    id: 'stunned',
    kind: 'status',
    color: 0xffe36b,
    secondaryColor: 0xffffff,
    durationMs: 900,
  },
  shielded: {
    id: 'shielded',
    kind: 'status',
    color: 0x57c7ff,
    secondaryColor: 0xffffff,
    durationMs: 900,
  },
  healing: {
    id: 'healing',
    kind: 'status',
    color: 0x7dff9a,
    secondaryColor: 0xffffff,
    durationMs: 760,
  },
  loot_spawn: {
    id: 'loot_spawn',
    kind: 'loot',
    color: 0xf3d27a,
    secondaryColor: 0xffffff,
    durationMs: 420,
    soundId: 'loot_spawn_01',
  },
};

const LEGACY_ALIASES: Record<string, string> = {
  hit_slash: 'sword_slash',
  hit_blunt: 'axe_hit',
  blunt: 'blunt_hit',
  projectile_arrow: 'arrow_projectile',
  projectile_fire: 'fire_projectile',
  projectile_ice: 'ice_projectile',
  impact_blood: 'blood_hit',
  impact_fire: 'fire_impact',
  impact_ice: 'ice_impact',
};

export const BATTLE_EFFECT_REGISTRY: Record<string, BattleVisualEffect> = {
  ...BASE_BATTLE_EFFECTS,
  ...Object.fromEntries(Object.entries(LEGACY_ALIASES).map(([legacyId, canonicalId]) => [
    legacyId,
    {
      ...BASE_BATTLE_EFFECTS[canonicalId],
      id: legacyId,
      fallbackId: canonicalId,
    },
  ])),
};

export const BATTLE_EFFECT_IDS = Object.keys(BATTLE_EFFECT_REGISTRY).sort();

export function getBattleEffect(id: string | null | undefined, fallbackId: string = 'default_melee_hit'): BattleVisualEffect {
  if (id && BATTLE_EFFECT_REGISTRY[id]) {
    return BATTLE_EFFECT_REGISTRY[id];
  }
  if (BATTLE_EFFECT_REGISTRY[fallbackId]) {
    return BATTLE_EFFECT_REGISTRY[fallbackId];
  }
  return BATTLE_EFFECT_REGISTRY.default_melee_hit;
}

function asStatusEffectId(statusId: string): string {
  const lowered = statusId.toLowerCase();
  if (lowered.includes('burn')) return 'burning';
  if (lowered.includes('poison')) return 'poisoned';
  if (lowered.includes('bleed')) return 'bleeding';
  if (lowered.includes('frozen') || lowered.includes('freeze') || lowered.includes('ice')) return 'frozen';
  if (lowered.includes('stun')) return 'stunned';
  if (lowered.includes('shield') || lowered.includes('barrier')) return 'shielded';
  if (lowered.includes('heal') || lowered.includes('regen')) return 'healing';
  return 'shielded';
}

export function inferEffectIdForAnimation(event: {
  type: string;
  movementType?: string;
  visualEffectId?: string;
  castEffectId?: string;
  projectileEffectId?: string;
  impactEffectId?: string;
  hitEffectId?: string;
  statusApplied?: string[];
  statusRemoved?: string[];
  persistentVfx?: string[];
  value?: number;
  critical?: boolean;
}): string {
  if (event.type === 'projectile') {
    return event.projectileEffectId ?? event.visualEffectId ?? 'arrow_projectile';
  }
  if (event.type === 'skill_cast') {
    return event.castEffectId ?? event.visualEffectId ?? 'default_melee_hit';
  }
  if (event.type === 'impact') {
    return event.impactEffectId ?? event.hitEffectId ?? event.visualEffectId ?? 'default_impact';
  }
  if (event.type === 'death_fade') {
    return 'death_fade';
  }
  if (event.type === 'loot_spawn') {
    return 'loot_spawn';
  }
  if (event.type === 'status_applied' || event.type === 'status_tick') {
    const raw = event.statusApplied?.[0] ?? event.persistentVfx?.[0] ?? event.statusRemoved?.[0];
    return raw ? asStatusEffectId(raw) : 'shielded';
  }
  if (event.type === 'heal_number') {
    return 'healing';
  }
  if (event.type === 'damage_number' || event.type === 'critical_hit') {
    if (event.impactEffectId) return event.impactEffectId;
    if (event.hitEffectId) return event.hitEffectId;
    return event.critical ? 'axe_hit' : 'blood_hit';
  }
  if (event.type === 'block' || event.type === 'block_flash') {
    return 'shielded';
  }
  if (event.type === 'dodge' || event.type === 'dodge_step' || event.type === 'miss') {
    return 'default_impact';
  }
  return event.hitEffectId ?? event.visualEffectId ?? (event.movementType === 'dash' ? 'axe_hit' : 'default_melee_hit');
}
