export type SpriteSurface = 'paperdoll' | 'world' | 'battle';

export type SpriteVisualAssetKind = 'body' | 'equipment';

export type SpriteEquipmentVisualCategory =
  | 'sword'
  | 'dagger'
  | 'axe'
  | 'bow'
  | 'staff'
  | 'spear'
  | 'helmet'
  | 'chest_armor'
  | 'shield'
  | 'gloves'
  | 'boots';

export type SpriteVisualFittingAnchor =
  | 'head'
  | 'torso'
  | 'back'
  | 'left_hand'
  | 'right_hand'
  | 'left_forearm'
  | 'right_forearm'
  | 'left_foot'
  | 'right_foot';

export type SpriteBodyType =
  | 'humanoid'
  | 'quadruped'
  | 'monster'
  | 'beast'
  | 'undead'
  | 'spirit'
  | 'custom';

export type WeaponGripType =
  | 'none'
  | 'one_handed'
  | 'two_handed'
  | 'main_hand'
  | 'off_hand'
  | 'dual_wield'
  | 'shield'
  | 'bow'
  | 'staff'
  | 'spear'
  | 'thrown';

export type SpriteActionType =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack_melee'
  | 'attack_ranged'
  | 'cast'
  | 'block'
  | 'hit'
  | 'death'
  | 'interact'
  | 'work'
  | 'carry'
  | 'roll'
  | 'jump';

export type SpriteAnchorKey =
  | 'headAnchor'
  | 'chestAnchor'
  | 'rightHandAnchor'
  | 'leftHandAnchor'
  | 'offhandAnchor'
  | 'shieldAnchor'
  | 'backAnchor'
  | 'weaponTipAnchor'
  | 'projectileSpawnAnchor'
  | 'castFxAnchor'
  | 'hitFxAnchor'
  | 'feetAnchor'
  | 'shadowAnchor';

export type SpriteImageRef =
  | {
    type: 'image';
    src: string;
  }
  | {
    type: 'tileset';
    sheetId: string;
    frame: number;
  };

export interface SpriteAnchorPoint {
  x: number;
  y: number;
}

export interface SpriteAnchorSet {
  headAnchor: SpriteAnchorPoint;
  chestAnchor: SpriteAnchorPoint;
  rightHandAnchor: SpriteAnchorPoint;
  leftHandAnchor: SpriteAnchorPoint;
  offhandAnchor: SpriteAnchorPoint;
  shieldAnchor: SpriteAnchorPoint;
  backAnchor: SpriteAnchorPoint;
  weaponTipAnchor: SpriteAnchorPoint;
  projectileSpawnAnchor: SpriteAnchorPoint;
  castFxAnchor: SpriteAnchorPoint;
  hitFxAnchor: SpriteAnchorPoint;
  feetAnchor: SpriteAnchorPoint;
  shadowAnchor: SpriteAnchorPoint;
}

export interface SpriteSurfaceAssetDefinition {
  imageRef?: SpriteImageRef;
  imagePath?: string;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  zLayer?: number;
  defaultAnimationSetId?: string;
}

export interface SpriteVectorPoint {
  x: number;
  y: number;
}

export interface SpriteVectorStroke {
  color: string;
  width: number;
  enabled?: boolean;
}

export interface SpriteVectorTransform {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  points?: SpriteVectorPoint[];
}

export interface SpriteVectorLayer {
  id: string;
  name: string;
  shape: 'ellipse' | 'rect' | 'rounded_rect' | 'line' | 'polygon';
  fill: string;
  stroke?: SpriteVectorStroke;
  opacity?: number;
  visible?: boolean;
  zIndex?: number;
  transform: SpriteVectorTransform;
  metadata?: Record<string, string | number | boolean>;
}

export interface SpriteVectorDocument {
  id: string;
  schemaVersion: number;
  name: string;
  kind: SpriteVisualAssetKind;
  width: number;
  height: number;
  layers: SpriteVectorLayer[];
  anchors?: Partial<SpriteAnchorSet>;
  parameterValues?: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface SpriteBodyAuthoringDefinition {
  raceId?: string;
  bodyPresentation: 'male' | 'female';
  skinColor: string;
  underwearColor: string;
  bodyHeight: number;
  shoulderWidth: number;
  torsoWidth: number;
  bellySize: number;
  armSize: number;
  legSize: number;
  headSize: number;
  neckLength: number;
}

export interface SpriteEquipmentVisualAuthoringDefinition {
  category: SpriteEquipmentVisualCategory;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  outlineColor: string;
  outlineEnabled: boolean;
  width: number;
  height: number;
  length: number;
  thickness: number;
  shapePreset: string;
  materialPreset: string;
  rotation: number;
  scale: number;
}

export interface SpriteVisualAssetDefinition {
  id: string;
  schemaVersion: number;
  name: string;
  kind: SpriteVisualAssetKind;
  vectorDocumentId?: string;
  bodyAuthoring?: SpriteBodyAuthoringDefinition;
  equipmentAuthoring?: SpriteEquipmentVisualAuthoringDefinition;
  previewImageRef?: SpriteImageRef;
  previewImagePath?: string;
  spritesheetImageRef?: SpriteImageRef;
  spritesheetImagePath?: string;
  width: number;
  height: number;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpriteAnimationClipDefinition {
  action: SpriteActionType;
  label?: string;
  imageRef?: SpriteImageRef;
  imagePath?: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  fps: number;
  row?: number;
  loop?: boolean;
  legacyAliases?: string[];
  notes?: string;
}

export interface SpriteBodyTemplateDefinition {
  id: string;
  schemaVersion: number;
  name: string;
  description?: string;
  bodyType: SpriteBodyType;
  visualAssetId?: string;
  vectorDocumentId?: string;
  authoring?: SpriteBodyAuthoringDefinition;
  compatibleRaceIds: string[];
  compatibleBodyTypes: string[];
  supportedSurfaces: SpriteSurface[];
  paperdoll?: SpriteSurfaceAssetDefinition;
  world?: SpriteSurfaceAssetDefinition;
  battle?: SpriteSurfaceAssetDefinition;
  anchors: SpriteAnchorSet;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpriteAnimationSetDefinition {
  id: string;
  schemaVersion: number;
  name: string;
  description?: string;
  compatibleBodyTemplateIds: string[];
  compatibleRaceIds: string[];
  compatibleBodyTypes: string[];
  compatibleSurfaces: SpriteSurface[];
  clips: SpriteAnimationClipDefinition[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentVisualBindingDefinition {
  id: string;
  schemaVersion: number;
  name: string;
  itemId: string;
  defaultForItem?: boolean;
  visualAssetId?: string;
  vectorDocumentId?: string;
  compatibleBodyTemplateIds: string[];
  compatibleRaceIds: string[];
  compatibleBodyTypes: string[];
  compatibleSurfaces: SpriteSurface[];
  supportedActions?: SpriteActionType[];
  equipmentSlot: string;
  weaponGripType: WeaponGripType;
  preferredAnchor?: SpriteVisualFittingAnchor;
  secondaryAnchor?: SpriteVisualFittingAnchor;
  twoHanded?: boolean;
  bodyRelativeScale?: number;
  bodyRelativeWidth?: number;
  bodyRelativeHeight?: number;
  paperdoll?: SpriteSurfaceAssetDefinition;
  world?: SpriteSurfaceAssetDefinition;
  battle?: SpriteSurfaceAssetDefinition;
  anchorOverrides?: Partial<SpriteAnchorSet>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpriteProfileDefinition {
  id: string;
  schemaVersion: number;
  name: string;
  npcId?: string;
  bodyTemplateId: string;
  animationSetId: string;
  defaultSurface: SpriteSurface;
  defaultEquipmentItemIds: string[];
  previewSkillIds: string[];
  previewFxIds: string[];
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillAnimationBindingDefinition {
  id: string;
  schemaVersion: number;
  name: string;
  skillId: string;
  action: SpriteActionType;
  animationSetId?: string;
  castFxId?: string;
  projectileFxId?: string;
  hitFxId?: string;
  sourceAnchor?: SpriteAnchorKey;
  projectileAnchor?: SpriteAnchorKey;
  hitAnchor?: SpriteAnchorKey;
  compatibleSurfaces: SpriteSurface[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeAssemblyRuleDefinition {
  id: string;
  schemaVersion: number;
  name: string;
  raceId?: string;
  bodyTemplateId?: string;
  animationSetId?: string;
  profileId?: string;
  compatibleSurfaces: SpriteSurface[];
  allowLegacyFallback: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
