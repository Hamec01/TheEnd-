import type {
  EquipmentVisualBindingDefinition,
  RuntimeAssemblyRuleDefinition,
  SkillAnimationBindingDefinition,
  SpriteAnchorKey,
  SpriteAnimationClipDefinition,
  SpriteAnimationSetDefinition,
  SpriteBodyTemplateDefinition,
  SpriteImageRef,
  SpriteVectorDocument,
  SpriteVisualAssetDefinition,
  SpriteProfileDefinition,
} from '@theend/rpg-domain';
import type { AdminItem, AdminNpc, AdminSkill, AdminVisualFx, ImageSheetDefinition, StoredImage } from '../services/content/models';

export interface SpriteStudioValidationState {
  bodyTemplates: SpriteBodyTemplateDefinition[];
  animationSets: SpriteAnimationSetDefinition[];
  vectorDocuments?: SpriteVectorDocument[];
  visualAssets?: SpriteVisualAssetDefinition[];
  equipmentBindings: EquipmentVisualBindingDefinition[];
  spriteProfiles: SpriteProfileDefinition[];
  skillBindings: SkillAnimationBindingDefinition[];
  runtimeRules: RuntimeAssemblyRuleDefinition[];
  npcs: AdminNpc[];
  items: AdminItem[];
  skills: AdminSkill[];
  visualFx: AdminVisualFx[];
  images: StoredImage[];
  imageSheets: ImageSheetDefinition[];
}

export interface SpriteStudioValidationResult {
  errors: string[];
  warnings: string[];
}

function hasBase64Deep(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().startsWith('data:');
  }
  if (!value || typeof value !== 'object') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(hasBase64Deep);
  }
  return Object.values(value).some(hasBase64Deep);
}

function checkImageRef(ref: SpriteImageRef | undefined, imagePath: string | undefined, imageIds: Set<string>, sheetIds: Set<string>, label: string, errors: string[]) {
  if (ref?.type === 'image') {
    const src = ref.src.trim();
    if (!src) {
      errors.push(`${label}: image src is empty.`);
    } else if (!src.startsWith('/') && !src.startsWith('http') && !imageIds.has(src)) {
      errors.push(`${label}: image ref '${src}' is missing in images.`);
    }
  }
  if (ref?.type === 'tileset') {
    if (!sheetIds.has(ref.sheetId)) {
      errors.push(`${label}: tileset '${ref.sheetId}' is missing in imageSheets.`);
    }
  }
  const legacy = String(imagePath ?? '').trim();
  if (legacy && !legacy.startsWith('/') && !legacy.startsWith('http') && !imageIds.has(legacy)) {
    errors.push(`${label}: legacy imagePath '${legacy}' is missing in images.`);
  }
}

function requiredWeaponAnchors(grip: EquipmentVisualBindingDefinition['weaponGripType']): SpriteAnchorKey[] {
  switch (grip) {
    case 'two_handed':
    case 'bow':
    case 'staff':
    case 'spear':
      return ['rightHandAnchor', 'leftHandAnchor'];
    case 'off_hand':
    case 'shield':
      return ['leftHandAnchor'];
    case 'one_handed':
    case 'main_hand':
    case 'thrown':
    case 'dual_wield':
      return ['rightHandAnchor'];
    default:
      return [];
  }
}

function hasAnchor(template: SpriteBodyTemplateDefinition, key: SpriteAnchorKey): boolean {
  const point = template.anchors?.[key];
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function validateSpriteStudioState(state: SpriteStudioValidationState): SpriteStudioValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const imageIds = new Set(state.images.map((entry) => entry.id));
  const sheetIds = new Set(state.imageSheets.map((entry) => entry.id));
  const npcIds = new Set(state.npcs.map((entry) => entry.id));
  const itemMap = new Map(state.items.map((entry) => [entry.id, entry] as const));
  const skillIds = new Set(state.skills.map((entry) => entry.id));
  const fxIds = new Set(state.visualFx.map((entry) => entry.id));
  const bodyTemplateMap = new Map(state.bodyTemplates.map((entry) => [entry.id, entry] as const));
  const animationSetIds = new Set(state.animationSets.map((entry) => entry.id));
  const equipmentBindingIds = new Set(state.equipmentBindings.map((entry) => entry.id));
  const profileIds = new Set(state.spriteProfiles.map((entry) => entry.id));

  if (state.bodyTemplates.length === 0) {
    warnings.push('No sprite body templates created yet.');
  }
  if (state.animationSets.length === 0) {
    warnings.push('No sprite animation sets created yet.');
  }

  for (const entry of [...state.bodyTemplates, ...state.animationSets, ...state.equipmentBindings, ...state.spriteProfiles, ...state.skillBindings, ...state.runtimeRules]) {
    if (hasBase64Deep(entry)) {
      errors.push(`${entry.id}: base64/data URL detected in persisted payload. Use upload pipeline refs instead.`);
    }
  }

  for (const template of state.bodyTemplates) {
    checkImageRef(template.paperdoll?.imageRef, template.paperdoll?.imagePath, imageIds, sheetIds, `${template.id}.paperdoll`, errors);
    checkImageRef(template.world?.imageRef, template.world?.imagePath, imageIds, sheetIds, `${template.id}.world`, errors);
    checkImageRef(template.battle?.imageRef, template.battle?.imagePath, imageIds, sheetIds, `${template.id}.battle`, errors);
  }

  for (const set of state.animationSets) {
    if (set.clips.length === 0) {
      warnings.push(`${set.id}: animation set has no clips.`);
    }
    for (const clip of set.clips) {
      checkImageRef(clip.imageRef, clip.imagePath, imageIds, sheetIds, `${set.id}.${clip.action}`, errors);
      if (clip.frameWidth <= 0 || clip.frameHeight <= 0 || clip.frameCount <= 0 || clip.fps <= 0) {
        errors.push(`${set.id}.${clip.action}: invalid spritesheet dimensions or fps.`);
      }
    }
  }

  for (const binding of state.equipmentBindings) {
    const item = itemMap.get(binding.itemId);
    if (!item) {
      errors.push(`${binding.id}: item '${binding.itemId}' not found.`);
    } else if (item.slot && item.slot !== 'none' && binding.equipmentSlot && item.slot !== binding.equipmentSlot) {
      warnings.push(`${binding.id}: item slot '${item.slot}' does not match binding slot '${binding.equipmentSlot}'.`);
    }
    if (binding.compatibleBodyTemplateIds.length === 0) {
      warnings.push(`${binding.id}: no compatible body templates selected.`);
    }
    checkImageRef(binding.paperdoll?.imageRef, binding.paperdoll?.imagePath, imageIds, sheetIds, `${binding.id}.paperdoll`, errors);
    checkImageRef(binding.world?.imageRef, binding.world?.imagePath, imageIds, sheetIds, `${binding.id}.world`, errors);
    checkImageRef(binding.battle?.imageRef, binding.battle?.imagePath, imageIds, sheetIds, `${binding.id}.battle`, errors);

    const neededAnchors = requiredWeaponAnchors(binding.weaponGripType);
    for (const templateId of binding.compatibleBodyTemplateIds) {
      const template = bodyTemplateMap.get(templateId);
      if (!template) {
        errors.push(`${binding.id}: body template '${templateId}' not found.`);
        continue;
      }
      for (const anchorKey of neededAnchors) {
        if (!hasAnchor(template, anchorKey)) {
          errors.push(`${binding.id}: body template '${templateId}' is missing required anchor '${anchorKey}'.`);
        }
      }
    }
  }

  for (const profile of state.spriteProfiles) {
    if (!profile.bodyTemplateId || !bodyTemplateMap.has(profile.bodyTemplateId)) {
      errors.push(`${profile.id}: bodyTemplateId '${profile.bodyTemplateId}' not found.`);
    }
    if (!profile.animationSetId || !animationSetIds.has(profile.animationSetId)) {
      errors.push(`${profile.id}: animationSetId '${profile.animationSetId}' not found.`);
    }
    if (profile.npcId && !npcIds.has(profile.npcId)) {
      errors.push(`${profile.id}: npcId '${profile.npcId}' not found.`);
    }
    for (const itemId of profile.defaultEquipmentItemIds) {
      if (!itemMap.has(itemId)) {
        errors.push(`${profile.id}: default equipment item '${itemId}' not found.`);
      }
    }
    for (const skillId of profile.previewSkillIds) {
      if (!skillIds.has(skillId)) {
        errors.push(`${profile.id}: preview skill '${skillId}' not found.`);
      }
    }
    for (const fxId of profile.previewFxIds) {
      if (!fxIds.has(fxId)) {
        errors.push(`${profile.id}: preview FX '${fxId}' not found.`);
      }
    }
  }

  for (const binding of state.skillBindings) {
    if (!skillIds.has(binding.skillId)) {
      errors.push(`${binding.id}: skill '${binding.skillId}' not found.`);
    }
    if (binding.animationSetId && !animationSetIds.has(binding.animationSetId)) {
      errors.push(`${binding.id}: animationSetId '${binding.animationSetId}' not found.`);
    }
    for (const fxId of [binding.castFxId, binding.projectileFxId, binding.hitFxId]) {
      if (fxId && !fxIds.has(fxId)) {
        errors.push(`${binding.id}: FX '${fxId}' not found.`);
      }
    }
  }

  for (const rule of state.runtimeRules) {
    if (rule.bodyTemplateId && !bodyTemplateMap.has(rule.bodyTemplateId)) {
      errors.push(`${rule.id}: bodyTemplateId '${rule.bodyTemplateId}' not found.`);
    }
    if (rule.animationSetId && !animationSetIds.has(rule.animationSetId)) {
      errors.push(`${rule.id}: animationSetId '${rule.animationSetId}' not found.`);
    }
    if (rule.profileId && !profileIds.has(rule.profileId)) {
      errors.push(`${rule.id}: profileId '${rule.profileId}' not found.`);
    }
  }

  for (const npc of state.npcs) {
    if (npc.spriteProfileId && !profileIds.has(npc.spriteProfileId)) {
      errors.push(`npc:${npc.id}: spriteProfileId '${npc.spriteProfileId}' not found.`);
    }
  }
  for (const item of state.items) {
    if (item.defaultEquipmentVisualBindingId && !equipmentBindingIds.has(item.defaultEquipmentVisualBindingId)) {
      errors.push(`item:${item.id}: defaultEquipmentVisualBindingId '${item.defaultEquipmentVisualBindingId}' not found.`);
    }
  }
  for (const skill of state.skills) {
    if (skill.skillAnimationBindingId && !state.skillBindings.some((entry) => entry.id === skill.skillAnimationBindingId)) {
      errors.push(`skill:${skill.id}: skillAnimationBindingId '${skill.skillAnimationBindingId}' not found.`);
    }
  }

  return { errors, warnings };
}

