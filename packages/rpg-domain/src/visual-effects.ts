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
  castSoundId?: string;
  impactSoundId?: string;
}

export type VisualFxStatus = 'draft' | 'active' | 'disabled';

export type VisualFxCategory =
  | 'cast'
  | 'projectile'
  | 'impact'
  | 'hit'
  | 'area'
  | 'aura'
  | 'weapon'
  | 'screen'
  | 'status';

export type VisualFxElement =
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'earth'
  | 'shadow'
  | 'light'
  | 'blood'
  | 'physical'
  | 'poison'
  | 'healing'
  | 'arcane';

export type VisualFxType = 'static_image' | 'sprite_sheet';

export type VisualFxPlayOn = 'caster' | 'target' | 'projectile' | 'area' | 'screen';

export type VisualFxAnchor =
  | 'center'
  | 'feet'
  | 'head'
  | 'front'
  | 'behind'
  | 'weapon_right'
  | 'weapon_left'
  | 'ground';

export type VisualFxBlendMode = 'NORMAL' | 'ADD' | 'MULTIPLY' | 'SCREEN';

export interface VisualFxDefinition {
  id: string;
  name: string;
  status: VisualFxStatus;
  category: VisualFxCategory;
  element?: VisualFxElement;
  type: VisualFxType;
  description?: string;
  asset: {
    url: string;
    key?: string;
    frameWidth?: number;
    frameHeight?: number;
    frameCount?: number;
  };
  animation: {
    frameRate?: number;
    repeat?: number;
    durationMs?: number;
  };
  placement: {
    defaultPlayOn: VisualFxPlayOn;
    anchor?: VisualFxAnchor;
    offsetX?: number;
    offsetY?: number;
    rotateToDirection?: boolean;
  };
  render: {
    scale?: number;
    alpha?: number;
    rotation?: number;
    blendMode?: VisualFxBlendMode;
    originX?: number;
    originY?: number;
    depth?: number;
  };
  projectile?: {
    speed?: number;
    arc?: number;
    destroyOnImpact?: boolean;
  };
  camera?: {
    shakePreset?: CameraShakePreset;
  };
  audio?: {
    defaultSoundId?: string;
    volume?: number;
  };
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_SKILL_VISUALS: Required<Pick<SkillVisualConfig, 'hitEffectId' | 'impactEffectId' | 'cameraShakePreset'>> = {
  hitEffectId: 'hit_slash',
  impactEffectId: 'impact_blood',
  cameraShakePreset: 'none',
};
