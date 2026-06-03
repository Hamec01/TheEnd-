export type CameraShakePreset = 'none' | 'small' | 'medium' | 'heavy';

export type SkillMovementBehavior =
  | 'none'
  | 'dash_to_target'
  | 'teleport_to_target'
  | 'teleport_there_and_back';

export interface SkillVisualConfig {
  visualEffectId?: string;
  castEffectId?: string;
  projectileEffectId?: string;
  impactEffectId?: string;
  hitEffectId?: string;
  cameraShakePreset?: CameraShakePreset;
  castSoundId?: string;
  impactSoundId?: string;
  movementBehavior?: SkillMovementBehavior;
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

export type VisualEffectKind = 'single' | 'composite';

export type VisualFxPlayOn = 'caster' | 'target' | 'projectile' | 'area' | 'screen';

export type VisualFxPlacementMode =
  | 'once'
  | 'linger'
  | 'follow_target'
  | 'follow_caster'
  | 'ground_persist';

export type VisualEffectStageType =
  | 'cast'
  | 'projectile'
  | 'impact'
  | 'linger'
  | 'sound'
  | 'camera'
  | 'movement'
  | 'return';

export type VisualEffectStageTrigger =
  | 'on_start'
  | 'after_previous'
  | 'on_hit'
  | 'after_delay'
  | 'on_complete';

export type VisualEffectStagePlayOn =
  | 'caster'
  | 'target'
  | 'ground'
  | 'projectile_end'
  | 'projectile_current'
  | 'previous_stage_end';

export type VisualEffectStageFollowMode =
  | 'none'
  | 'follow_target'
  | 'follow_caster'
  | 'follow_projectile';

export type VisualEffectStageCondition =
  | 'always'
  | 'if_hit'
  | 'if_crit'
  | 'if_miss';

export type VisualEffectStageTargetMode =
  | 'primary_target'
  | 'all_targets'
  | 'aoe_targets'
  | 'chain_targets';

export type VisualEffectProjectileBehavior = 'projectile_straight' | 'projectile_arc';

export type VisualEffectStageMovementBehavior =
  | SkillMovementBehavior
  | VisualEffectProjectileBehavior;

export interface VisualEffectStage {
  id: string;
  name?: string;
  stageType: VisualEffectStageType;
  enabled: boolean;
  trigger: VisualEffectStageTrigger;
  delayMs?: number;
  fxRefId?: string;
  fxVariantIds?: string[];
  randomizeFxVariant?: boolean;
  playOn?: VisualEffectStagePlayOn;
  followMode?: VisualEffectStageFollowMode;
  durationMs?: number;
  persistMs?: number;
  movementBehavior?: VisualEffectStageMovementBehavior;
  stopSequenceOnFailure?: boolean;
  parallelGroup?: string;
  branchToStageIds?: string[];
  condition?: VisualEffectStageCondition;
  targetMode?: VisualEffectStageTargetMode;
  audioRefIds?: string[];
  cameraShakePreset?: CameraShakePreset;
  chainFromPrevious?: boolean;
  maxChainTargets?: number;
}

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
  kind?: VisualEffectKind;
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
    mode?: VisualFxPlacementMode;
    anchor?: VisualFxAnchor;
    offsetX?: number;
    offsetY?: number;
    rotateToDirection?: boolean;
    lingerDurationMs?: number;
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
  stages?: VisualEffectStage[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_SKILL_VISUALS: Required<Pick<SkillVisualConfig, 'hitEffectId' | 'impactEffectId' | 'cameraShakePreset'>> = {
  hitEffectId: 'hit_slash',
  impactEffectId: 'impact_blood',
  cameraShakePreset: 'none',
};
