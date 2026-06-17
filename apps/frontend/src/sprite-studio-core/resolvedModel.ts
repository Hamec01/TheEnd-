import type {
  EquipmentVisualBindingDefinition,
  SpriteActionType,
  SpriteAnchorKey,
  SpriteAnchorPoint,
  SpriteAnimationSetDefinition,
  SpriteBodyTemplateDefinition,
  SpriteImageRef,
  SpriteProfileDefinition,
  SpriteSurface,
} from '@theend/rpg-domain';
import type {
  AdminItem,
  AdminNpc,
  AdminSkill,
  AdminVisualFx,
  ImageSheetDefinition,
  StoredImage,
} from '../services/content/models';

export type CharacterVisualEntityType = 'player' | 'npc' | 'monster';

export type CharacterVisualIssueSeverity = 'warning' | 'error';

export interface CharacterVisualIssue {
  code: string;
  message: string;
  severity: CharacterVisualIssueSeverity;
  entityId?: string;
  refId?: string;
}

export interface PlayerLikeVisualEntity {
  id: string;
  race?: string;
  gender?: string;
  bodyType?: string;
  spriteProfileId?: string;
  equippedItemIds?: {
    head?: string;
    chest?: string;
    gloves?: string;
    legs?: string;
    boots?: string;
    cloak?: string;
    mainHand?: string;
    offHand?: string;
    back?: string;
    tool?: string;
  };
}

export interface CharacterVisualResolverContent {
  spriteProfiles: SpriteProfileDefinition[];
  spriteBodyTemplates: SpriteBodyTemplateDefinition[];
  spriteAnimationSets: SpriteAnimationSetDefinition[];
  equipmentVisualBindings: EquipmentVisualBindingDefinition[];
  skillAnimationBindings: import('../services/content/models').SkillAnimationBindingDefinition[];
  runtimeAssemblyRules: import('../services/content/models').RuntimeAssemblyRuleDefinition[];
  items: AdminItem[];
  skills: AdminSkill[];
  visualFx: AdminVisualFx[];
  images: StoredImage[];
  imageSheets: ImageSheetDefinition[];
}

export interface CharacterVisualResolverInput {
  surface: SpriteSurface;
  entityType: CharacterVisualEntityType;
  npc?: AdminNpc;
  player?: PlayerLikeVisualEntity;
  spriteProfileId?: string;
  bodyTemplateId?: string;
  animationSetId?: string;
  equippedItemIds?: PlayerLikeVisualEntity['equippedItemIds'];
  skillBindingId?: string;
  visualFxId?: string;
  preferredAction?: string;
  content: CharacterVisualResolverContent;
}

export type ResolvedCharacterLayerGroup =
  | 'shadow'
  | 'back'
  | 'body_legs'
  | 'boots'
  | 'body_torso'
  | 'chest_armor'
  | 'arms'
  | 'gloves'
  | 'head'
  | 'hair'
  | 'helmet'
  | 'main_hand_weapon'
  | 'offhand_shield'
  | 'cloak_front'
  | 'fx';

export interface ResolvedCharacterVisualLayer {
  id: string;
  group: ResolvedCharacterLayerGroup;
  source: 'body' | 'equipment' | 'weapon' | 'shield' | 'fx' | 'fallback';
  itemId?: string;
  bindingId?: string;
  imageRef?: SpriteImageRef;
  imagePath?: string;
  imageId?: string;
  imageSheetId?: string;
  zIndex: number;
  transform?: {
    scale: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
    zLayer: number;
  };
  slot?: string;
  anchorName?: SpriteAnchorKey;
  opacity?: number;
  visible: boolean;
  notes?: string;
}

export interface ResolvedCharacterAnimationClip {
  action: SpriteActionType;
  imageRef?: SpriteImageRef;
  imagePath?: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  row: number;
  loop: boolean;
  notes?: string;
}

export interface ResolvedCharacterVisualFallback {
  used: boolean;
  reason?: string;
  portraitUrl?: string;
  iconUrl?: string;
  fullImageUrl?: string;
  combatImageUrl?: string;
  battleSpriteAssetId?: string;
  worldSpriteId?: string;
}

export interface ResolvedBindingCandidateDebug {
  bindingId: string;
  bindingName: string;
  score: number;
  accepted: boolean;
  scoreBreakdown: Record<string, number>;
  reasons: string[];
}

export interface ResolvedEquipmentBindingDebug {
  itemId: string;
  itemName?: string;
  slot?: string;
  chosenBindingId?: string;
  chosenBindingName?: string;
  chosenScore?: number;
  chosenScoreBreakdown?: Record<string, number>;
  rejectionReasons: string[];
  candidates: ResolvedBindingCandidateDebug[];
}

export interface ResolvedCharacterVisualDebug {
  profileSource: 'explicit' | 'npc' | 'player' | 'fallback';
  explicitSpriteProfileId?: string;
  chosenProfileId?: string;
  chosenRuleId?: string;
  bodyTemplateSource?: 'explicit' | 'profile' | 'rule' | 'missing';
  animationSetSource?: 'explicit' | 'profile' | 'rule' | 'missing';
  equipment: ResolvedEquipmentBindingDebug[];
}

export interface ResolvedCharacterVisual {
  entityId: string;
  entityType: CharacterVisualEntityType;
  surface: SpriteSurface;
  spriteProfileId?: string;
  bodyTemplateId?: string;
  animationSetId?: string;
  resolvedAction?: SpriteActionType | string;
  frame: {
    width: number;
    height: number;
  };
  clip?: ResolvedCharacterAnimationClip;
  fallback: ResolvedCharacterVisualFallback;
  layers: ResolvedCharacterVisualLayer[];
  anchors: Partial<Record<SpriteAnchorKey, SpriteAnchorPoint>>;
  availableActions: SpriteActionType[];
  warnings: CharacterVisualIssue[];
  errors: CharacterVisualIssue[];
  debug: ResolvedCharacterVisualDebug;
}
