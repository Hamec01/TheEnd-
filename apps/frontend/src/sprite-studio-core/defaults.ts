import type {
  EquipmentVisualBindingDefinition,
  RuntimeAssemblyRuleDefinition,
  SkillAnimationBindingDefinition,
  SpriteActionType,
  SpriteAnchorKey,
  SpriteAnchorSet,
  SpriteAnimationClipDefinition,
  SpriteAnimationSetDefinition,
  SpriteBodyAuthoringDefinition,
  SpriteBodyTemplateDefinition,
  SpriteBodyType,
  SpriteEquipmentVisualAuthoringDefinition,
  SpriteEquipmentVisualCategory,
  SpriteProfileDefinition,
  SpriteSurface,
  SpriteVectorDocument,
  SpriteVisualAssetDefinition,
  SpriteVisualFittingAnchor,
  WeaponGripType,
} from '@theend/rpg-domain';

export const SPRITE_SURFACE_OPTIONS: SpriteSurface[] = ['paperdoll', 'world', 'battle'];
export const SPRITE_BODY_TYPE_OPTIONS: SpriteBodyType[] = ['humanoid', 'quadruped', 'monster', 'beast', 'undead', 'spirit', 'custom'];
export const WEAPON_GRIP_OPTIONS: WeaponGripType[] = ['none', 'one_handed', 'two_handed', 'main_hand', 'off_hand', 'dual_wield', 'shield', 'bow', 'staff', 'spear', 'thrown'];
export const SPRITE_ACTION_OPTIONS: SpriteActionType[] = ['idle', 'walk', 'run', 'attack_melee', 'attack_ranged', 'cast', 'block', 'hit', 'death', 'interact', 'work', 'carry', 'roll', 'jump'];
export const SPRITE_VISUAL_FITTING_ANCHORS: SpriteVisualFittingAnchor[] = ['head', 'torso', 'back', 'left_hand', 'right_hand', 'left_forearm', 'right_forearm', 'left_foot', 'right_foot'];
export const SPRITE_EQUIPMENT_VISUAL_CATEGORIES: SpriteEquipmentVisualCategory[] = ['sword', 'dagger', 'axe', 'bow', 'staff', 'spear', 'helmet', 'chest_armor', 'shield', 'gloves', 'boots'];
export const SPRITE_ANCHOR_KEYS: SpriteAnchorKey[] = [
  'headAnchor',
  'chestAnchor',
  'rightHandAnchor',
  'leftHandAnchor',
  'offhandAnchor',
  'shieldAnchor',
  'backAnchor',
  'weaponTipAnchor',
  'projectileSpawnAnchor',
  'castFxAnchor',
  'hitFxAnchor',
  'feetAnchor',
  'shadowAnchor',
];

export function nowIso(): string {
  return new Date().toISOString();
}

export function createDefaultAnchorSet(): SpriteAnchorSet {
  return {
    headAnchor: { x: 64, y: 20 },
    chestAnchor: { x: 64, y: 50 },
    rightHandAnchor: { x: 90, y: 68 },
    leftHandAnchor: { x: 38, y: 68 },
    offhandAnchor: { x: 34, y: 66 },
    shieldAnchor: { x: 28, y: 64 },
    backAnchor: { x: 52, y: 54 },
    weaponTipAnchor: { x: 106, y: 42 },
    projectileSpawnAnchor: { x: 96, y: 42 },
    castFxAnchor: { x: 80, y: 34 },
    hitFxAnchor: { x: 64, y: 42 },
    feetAnchor: { x: 64, y: 110 },
    shadowAnchor: { x: 64, y: 118 },
  };
}

export function createEmptyBodyTemplate(seed = Date.now()): SpriteBodyTemplateDefinition {
  const now = nowIso();
  return {
    id: `sprite_body_template_${seed}`,
    schemaVersion: 1,
    name: 'New body template',
    description: '',
    bodyType: 'humanoid',
    visualAssetId: `sprite_visual_asset_body_${seed}`,
    vectorDocumentId: `sprite_vector_document_body_${seed}`,
    authoring: createDefaultBodyAuthoring(),
    compatibleRaceIds: [],
    compatibleBodyTypes: ['humanoid'],
    supportedSurfaces: [...SPRITE_SURFACE_OPTIONS],
    paperdoll: { scale: 1, offsetX: 0, offsetY: 0, rotation: 0, zLayer: 0 },
    world: { scale: 1, offsetX: 0, offsetY: 0, rotation: 0, zLayer: 0 },
    battle: { scale: 1, offsetX: 0, offsetY: 0, rotation: 0, zLayer: 0 },
    anchors: createDefaultAnchorSet(),
    tags: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyAnimationClip(action: SpriteActionType = 'idle'): SpriteAnimationClipDefinition {
  return {
    action,
    label: action,
    frameWidth: 128,
    frameHeight: 128,
    frameCount: 1,
    fps: 8,
    row: 0,
    loop: action !== 'death',
    legacyAliases: action === 'death' ? ['die'] : [],
    notes: '',
  };
}

export function createEmptyAnimationSet(seed = Date.now()): SpriteAnimationSetDefinition {
  const now = nowIso();
  return {
    id: `sprite_animation_set_${seed}`,
    schemaVersion: 1,
    name: 'New animation set',
    description: '',
    compatibleBodyTemplateIds: [],
    compatibleRaceIds: [],
    compatibleBodyTypes: ['humanoid'],
    compatibleSurfaces: [...SPRITE_SURFACE_OPTIONS],
    clips: [createEmptyAnimationClip('idle')],
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyEquipmentBinding(seed = Date.now()): EquipmentVisualBindingDefinition {
  const now = nowIso();
  return {
    id: `equipment_visual_binding_${seed}`,
    schemaVersion: 1,
    name: 'New equipment visual binding',
    itemId: '',
    defaultForItem: false,
    visualAssetId: '',
    vectorDocumentId: '',
    compatibleBodyTemplateIds: [],
    compatibleRaceIds: [],
    compatibleBodyTypes: ['humanoid'],
    compatibleSurfaces: [...SPRITE_SURFACE_OPTIONS],
    supportedActions: ['idle', 'walk', 'attack_melee', 'attack_ranged'],
    equipmentSlot: 'rightHand',
    weaponGripType: 'none',
    preferredAnchor: 'right_hand',
    secondaryAnchor: undefined,
    twoHanded: false,
    bodyRelativeScale: 1,
    bodyRelativeWidth: 1,
    bodyRelativeHeight: 1,
    paperdoll: { scale: 1, offsetX: 0, offsetY: 0, rotation: 0, zLayer: 0 },
    world: { scale: 1, offsetX: 0, offsetY: 0, rotation: 0, zLayer: 0 },
    battle: { scale: 1, offsetX: 0, offsetY: 0, rotation: 0, zLayer: 0 },
    anchorOverrides: {},
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultBodyAuthoring(): SpriteBodyAuthoringDefinition {
  return {
    raceId: 'human',
    bodyPresentation: 'male',
    skinColor: '#d8b08a',
    underwearColor: '#5a3a54',
    bodyHeight: 1,
    shoulderWidth: 1,
    torsoWidth: 1,
    bellySize: 0.2,
    armSize: 1,
    legSize: 1,
    headSize: 1,
    neckLength: 0.5,
  };
}

export function createDefaultEquipmentVisualAuthoring(category: SpriteEquipmentVisualCategory = 'sword'): SpriteEquipmentVisualAuthoringDefinition {
  return {
    category,
    primaryColor: '#c9d1d9',
    secondaryColor: '#5f4933',
    accentColor: '#d4a85f',
    outlineColor: '#1d130d',
    outlineEnabled: true,
    width: 0.9,
    height: 0.9,
    length: 1,
    thickness: 0.35,
    shapePreset: category,
    materialPreset: category === 'bow' ? 'wood' : category === 'staff' ? 'oak' : 'steel',
    rotation: 0,
    scale: 1,
  };
}

export function createEmptyVectorDocument(params?: {
  id?: string;
  name?: string;
  kind?: SpriteVisualAssetDefinition['kind'];
  width?: number;
  height?: number;
}): SpriteVectorDocument {
  const now = nowIso();
  const seed = Date.now();
  return {
    id: params?.id ?? `sprite_vector_document_${seed}`,
    schemaVersion: 1,
    name: params?.name ?? 'New vector document',
    kind: params?.kind ?? 'equipment',
    width: params?.width ?? 128,
    height: params?.height ?? 128,
    layers: [],
    anchors: undefined,
    parameterValues: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyVisualAsset(params?: {
  id?: string;
  name?: string;
  kind?: SpriteVisualAssetDefinition['kind'];
  category?: SpriteEquipmentVisualCategory;
}): SpriteVisualAssetDefinition {
  const now = nowIso();
  const seed = Date.now();
  const kind = params?.kind ?? 'equipment';
  return {
    id: params?.id ?? `sprite_visual_asset_${seed}`,
    schemaVersion: 1,
    name: params?.name ?? 'New visual asset',
    kind,
    vectorDocumentId: `sprite_vector_document_${seed}`,
    bodyAuthoring: kind === 'body' ? createDefaultBodyAuthoring() : undefined,
    equipmentAuthoring: kind === 'equipment' ? createDefaultEquipmentVisualAuthoring(params?.category) : undefined,
    width: 128,
    height: 128,
    tags: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptySpriteProfile(seed = Date.now()): SpriteProfileDefinition {
  const now = nowIso();
  return {
    id: `sprite_profile_${seed}`,
    schemaVersion: 1,
    name: 'New sprite profile',
    npcId: '',
    bodyTemplateId: '',
    animationSetId: '',
    defaultSurface: 'battle',
    defaultEquipmentItemIds: [],
    previewSkillIds: [],
    previewFxIds: [],
    tags: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptySkillAnimationBinding(seed = Date.now()): SkillAnimationBindingDefinition {
  const now = nowIso();
  return {
    id: `skill_animation_binding_${seed}`,
    schemaVersion: 1,
    name: 'New skill animation binding',
    skillId: '',
    action: 'cast',
    animationSetId: '',
    castFxId: '',
    projectileFxId: '',
    hitFxId: '',
    sourceAnchor: 'castFxAnchor',
    projectileAnchor: 'projectileSpawnAnchor',
    hitAnchor: 'hitFxAnchor',
    compatibleSurfaces: [...SPRITE_SURFACE_OPTIONS],
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyRuntimeAssemblyRule(seed = Date.now()): RuntimeAssemblyRuleDefinition {
  const now = nowIso();
  return {
    id: `runtime_assembly_rule_${seed}`,
    schemaVersion: 1,
    name: 'New runtime assembly rule',
    raceId: '',
    bodyTemplateId: '',
    animationSetId: '',
    profileId: '',
    compatibleSurfaces: [...SPRITE_SURFACE_OPTIONS],
    allowLegacyFallback: true,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}
