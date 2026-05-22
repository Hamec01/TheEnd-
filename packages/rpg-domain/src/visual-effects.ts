export type CameraShakePreset = 'none' | 'small' | 'medium' | 'heavy';

export interface SkillVisualConfig {
  visualEffectId?: string;
  castEffectId?: string;
  projectileEffectId?: string;
  impactEffectId?: string;
  hitEffectId?: string;
  cameraShakePreset?: CameraShakePreset;
  castSoundId?: string;
  impactSoundId?: string;
}

export interface StatusVisualConfig {
  statusVfxId?: string;
  statusApplyEffectId?: string;
  statusRemoveEffectId?: string;
  loopOnTarget?: boolean;
}

export interface ActorBattleVisualConfig {
  battleSpriteAssetId?: string;
  deathEffectId?: string;
  hitEffectPreset?: string;
}

export const DEFAULT_SKILL_VISUALS: Required<Pick<SkillVisualConfig, 'hitEffectId' | 'impactEffectId' | 'cameraShakePreset'>> = {
  hitEffectId: 'hit_slash',
  impactEffectId: 'impact_blood',
  cameraShakePreset: 'none',
};
