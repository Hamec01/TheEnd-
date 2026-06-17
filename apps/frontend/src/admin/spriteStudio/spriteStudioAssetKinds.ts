import type { GameImageRef, ImageSheetDefinition, StoredImage } from '../../services/content/models';

export type AssetUsageKind =
  | 'game_npc_portrait'
  | 'game_dialogue_portrait'
  | 'game_battle_image'
  | 'game_item_icon'
  | 'game_material_icon'
  | 'game_quest_image'
  | 'game_reference_image'
  | 'sprite_body'
  | 'sprite_paperdoll_body'
  | 'sprite_equipment_weapon'
  | 'sprite_equipment_shield'
  | 'sprite_equipment_helmet'
  | 'sprite_equipment_armor'
  | 'sprite_skill_fx'
  | 'sprite_animation_sheet'
  | 'sprite_generated_sheet'
  | 'legacy_sprite_reference'
  | 'invalid_body_candidate'
  | 'reference_only'
  | 'unknown';

export type SpriteStudioAssetKind = AssetUsageKind;
export type SpriteStudioAssetSelectionMode = 'mixed' | 'sprite-layer' | 'reference-only';
export type SpriteStudioAssetEligibility = 'ok' | 'warning' | 'blocked';

interface SpriteStudioAssetDescriptor {
  imageRef?: GameImageRef | null;
  legacyImagePath?: string | null;
  runtimeImages?: StoredImage[];
  imageSheet?: ImageSheetDefinition | null;
  label?: string;
  uploadPresetId?: string;
  uploadFolder?: string;
}

const BODY_KEYWORDS = ['body', 'paperdoll', 'torso', 'legs', 'hair', 'sprite-body'];
const WEAPON_KEYWORDS = ['weapon', 'sword', 'bow', 'spear', 'axe', 'mace', 'blade'];
const SHIELD_KEYWORDS = ['shield'];
const HELMET_KEYWORDS = ['helmet', 'helm'];
const ARMOR_KEYWORDS = ['armor', 'armour', 'chest', 'cloak', 'glove', 'boot', 'belt'];
const ITEM_ICON_KEYWORDS = ['inventoryicon', 'merchanticon', 'item-icon', 'item_icon', 'thumbnail', 'looticon', 'craftingicon', '/items/', 'icon'];
const MATERIAL_ICON_KEYWORDS = ['material', '/materials/'];
const QUEST_IMAGE_KEYWORDS = ['quest', '/quests/'];
const NPC_PORTRAIT_KEYWORDS = ['portrait', 'portraitimage', 'profileimage', 'charactercard'];
const DIALOGUE_KEYWORDS = ['dialogueavatar', 'dialogue-avatar', 'dialogueimage', 'avatar'];
const BATTLE_REFERENCE_KEYWORDS = ['battleimage', 'combatimage', 'battle-avatar'];
const FX_KEYWORDS = ['fx', 'effect', 'projectile', 'castfx', 'hitfx'];
const SPRITE_STUDIO_VISUAL_ROOTS = ['/assets/sprite-studio/', '/assets/upload/images/sprite-studio/'];
const EQUIPMENT_VISUAL_ROOT = '/sprites/equipment/';
const ACTOR_REFERENCE_ROOT = '/sprites/actor/';

function buildKeywordProbe(parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => String(part ?? '').trim().toLowerCase())
    .filter(Boolean)
    .join(' | ');
}

function includesAny(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function normalizeAssetPath(value: string | undefined | null): string {
  return String(value ?? '').trim().toLowerCase();
}

function startsWithAny(value: string, roots: string[]): boolean {
  return roots.some((root) => value.startsWith(root));
}

function findStoredImageById(runtimeImages: StoredImage[], imageId: string): StoredImage | undefined {
  const normalizedId = imageId.trim();
  if (!normalizedId) {
    return undefined;
  }
  return runtimeImages.find((entry) => entry.id === normalizedId);
}

export function classifySpriteStudioAsset(descriptor: SpriteStudioAssetDescriptor): AssetUsageKind {
  const { imageRef, legacyImagePath, runtimeImages = [], imageSheet, label, uploadPresetId, uploadFolder } = descriptor;
  const storedImage = imageRef?.type === 'image' ? findStoredImageById(runtimeImages, imageRef.src) : undefined;
  const imagePath = normalizeAssetPath(imageRef?.type === 'image' ? imageRef.src : '');
  const legacyPath = normalizeAssetPath(legacyImagePath);
  const storedImageName = normalizeAssetPath(storedImage?.name);
  const uploadFolderProbe = normalizeAssetPath(uploadFolder);
  const uploadPresetProbe = normalizeAssetPath(uploadPresetId);
  const isSpriteStudioManagedImage = startsWithAny(imagePath, SPRITE_STUDIO_VISUAL_ROOTS)
    || startsWithAny(legacyPath, SPRITE_STUDIO_VISUAL_ROOTS)
    || uploadFolderProbe.includes('sprite-studio')
    || uploadPresetProbe.includes('sprite-studio')
    || storedImageName.includes('sprite-studio');
  const isActorReferenceImage = imagePath.startsWith(ACTOR_REFERENCE_ROOT)
    || legacyPath.startsWith(ACTOR_REFERENCE_ROOT);
  const probe = buildKeywordProbe([
    label,
    uploadPresetId,
    uploadFolder,
    legacyImagePath,
    imageRef?.type === 'image' ? imageRef.src : '',
    imageRef?.type === 'tileset' ? imageRef.sheetId : '',
    storedImage?.id,
    storedImage?.name,
    imageSheet?.id,
    imageSheet?.name,
    imageSheet?.src,
    imageSheet?.category,
  ]);
  const isEquipmentOverlayImage = imagePath.startsWith(EQUIPMENT_VISUAL_ROOT)
    || legacyPath.startsWith(EQUIPMENT_VISUAL_ROOT)
    || (isSpriteStudioManagedImage && probe.includes('equipment'));

  if (!probe) {
    return 'unknown';
  }
  if (includesAny(probe, NPC_PORTRAIT_KEYWORDS)) {
    return 'game_npc_portrait';
  }
  if (includesAny(probe, DIALOGUE_KEYWORDS)) {
    return 'game_dialogue_portrait';
  }
  if (includesAny(probe, BATTLE_REFERENCE_KEYWORDS)) {
    return 'game_battle_image';
  }
  if (includesAny(probe, QUEST_IMAGE_KEYWORDS)) {
    return 'game_quest_image';
  }
  if (includesAny(probe, MATERIAL_ICON_KEYWORDS)) {
    return 'game_material_icon';
  }
  if (includesAny(probe, ITEM_ICON_KEYWORDS)) {
    return 'game_item_icon';
  }
  if (isActorReferenceImage) {
    return 'game_reference_image';
  }
  if (probe.includes('reference') || probe.includes('concept')) {
    return 'reference_only';
  }
  if (includesAny(probe, FX_KEYWORDS)) {
    return isSpriteStudioManagedImage ? 'sprite_skill_fx' : 'game_reference_image';
  }

  const looksLegacy = probe.includes('legacy') || probe.includes('wolf-2d') || probe.includes('sprite+engine');
  if (looksLegacy) {
    return 'legacy_sprite_reference';
  }

  if (imageRef?.type === 'tileset') {
    if (probe.includes('generated') || probe.includes('export') || probe.includes('spritesheet')) {
      return 'sprite_generated_sheet';
    }
    return isSpriteStudioManagedImage ? 'sprite_animation_sheet' : 'unknown';
  }

  if (isEquipmentOverlayImage && includesAny(probe, SHIELD_KEYWORDS)) {
    return 'sprite_equipment_shield';
  }
  if (isEquipmentOverlayImage && includesAny(probe, HELMET_KEYWORDS)) {
    return 'sprite_equipment_helmet';
  }
  if (isEquipmentOverlayImage && includesAny(probe, WEAPON_KEYWORDS)) {
    return 'sprite_equipment_weapon';
  }
  if (isEquipmentOverlayImage && includesAny(probe, ARMOR_KEYWORDS)) {
    return 'sprite_equipment_armor';
  }
  if (isSpriteStudioManagedImage && probe.includes('paperdoll')) {
    return 'sprite_paperdoll_body';
  }
  if (isSpriteStudioManagedImage && includesAny(probe, BODY_KEYWORDS)) {
    return 'sprite_body';
  }
  if (isSpriteStudioManagedImage && (probe.includes('sprite') || probe.includes('sheet'))) {
    return 'sprite_generated_sheet';
  }

  return 'unknown';
}

export function canUseAsBodySprite(kind: AssetUsageKind): boolean {
  return kind === 'sprite_body'
    || kind === 'sprite_paperdoll_body'
    || kind === 'sprite_generated_sheet'
    || kind === 'legacy_sprite_reference';
}

export function canUseAsEquipmentVisual(kind: AssetUsageKind): boolean {
  return kind === 'sprite_equipment_weapon'
    || kind === 'sprite_equipment_shield'
    || kind === 'sprite_equipment_helmet'
    || kind === 'sprite_equipment_armor'
    || kind === 'legacy_sprite_reference';
}

export function canUseAsSkillFx(kind: AssetUsageKind): boolean {
  return kind === 'sprite_skill_fx'
    || kind === 'sprite_animation_sheet'
    || kind === 'sprite_generated_sheet'
    || kind === 'legacy_sprite_reference';
}

export function canUseAsReferenceOnly(kind: AssetUsageKind): boolean {
  return kind === 'game_npc_portrait'
    || kind === 'game_dialogue_portrait'
    || kind === 'game_battle_image'
    || kind === 'game_item_icon'
    || kind === 'game_material_icon'
    || kind === 'game_quest_image'
    || kind === 'game_reference_image'
    || kind === 'reference_only'
    || kind === 'unknown';
}

export function canUseAsBodyLayer(kind: AssetUsageKind): boolean {
  return canUseAsBodySprite(kind);
}

export function canUseAsEquipmentOverlay(kind: AssetUsageKind): boolean {
  return canUseAsEquipmentVisual(kind);
}

export function canUseAsReference(kind: AssetUsageKind): boolean {
  return canUseAsReferenceOnly(kind);
}

export function canUseAsSpriteLayer(kind: AssetUsageKind): boolean {
  return canUseAsBodySprite(kind)
    || canUseAsEquipmentVisual(kind)
    || kind === 'sprite_skill_fx'
    || kind === 'sprite_animation_sheet'
    || kind === 'sprite_generated_sheet';
}

export function getBodyLayerEligibility(kind: AssetUsageKind): SpriteStudioAssetEligibility {
  if (canUseAsBodySprite(kind)) {
    return 'ok';
  }
  if (kind === 'unknown' || kind === 'game_reference_image') {
    return 'warning';
  }
  return 'blocked';
}

export function getEquipmentOverlayEligibility(kind: AssetUsageKind): SpriteStudioAssetEligibility {
  if (canUseAsEquipmentVisual(kind)) {
    return 'ok';
  }
  if (kind === 'unknown' || kind === 'game_reference_image') {
    return 'warning';
  }
  return 'blocked';
}

export function describeSpriteStudioAssetKind(kind: AssetUsageKind): string {
  switch (kind) {
    case 'game_npc_portrait':
      return 'Game NPC portrait';
    case 'game_dialogue_portrait':
      return 'Game dialogue portrait';
    case 'game_battle_image':
      return 'Game battle image';
    case 'game_item_icon':
      return 'Game item icon';
    case 'game_material_icon':
      return 'Game material icon';
    case 'game_quest_image':
      return 'Game quest image';
    case 'game_reference_image':
      return 'Game reference image';
    case 'sprite_body':
      return 'Sprite body';
    case 'sprite_paperdoll_body':
      return 'Sprite paperdoll body';
    case 'sprite_equipment_weapon':
      return 'Sprite equipment weapon';
    case 'sprite_equipment_shield':
      return 'Sprite equipment shield';
    case 'sprite_equipment_helmet':
      return 'Sprite equipment helmet';
    case 'sprite_equipment_armor':
      return 'Sprite equipment armor';
    case 'sprite_skill_fx':
      return 'Sprite skill FX';
    case 'sprite_animation_sheet':
      return 'Sprite animation sheet';
    case 'sprite_generated_sheet':
      return 'Sprite generated sheet';
    case 'legacy_sprite_reference':
      return 'Legacy sprite reference';
    case 'invalid_body_candidate':
      return 'Invalid body candidate';
    case 'reference_only':
      return 'Reference only';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

export function buildSpriteStudioSelectionWarning(kind: AssetUsageKind): string | null {
  if (kind === 'game_npc_portrait' || kind === 'game_dialogue_portrait' || kind === 'game_battle_image') {
    return 'Body template points to a game/reference image, not a Sprite Studio body sprite.';
  }
  if (kind === 'game_item_icon' || kind === 'game_material_icon' || kind === 'game_quest_image') {
    return 'This game content asset is reference-only inside Sprite Studio and should not be used as a visual sprite.';
  }
  if (kind === 'game_reference_image') {
    return 'Body template points to an image that is not confirmed as a Sprite Studio body sprite.';
  }
  if (kind === 'invalid_body_candidate') {
    return 'Invalid body asset: this looks like a portrait/reference image, not a body sprite.';
  }
  if (kind === 'unknown') {
    return 'This asset is not classified yet. Review Asset Sources before using it as a Sprite Visual Asset.';
  }
  return null;
}

export function describeAssetEligibility(eligibility: SpriteStudioAssetEligibility): string {
  switch (eligibility) {
    case 'ok':
      return 'OK';
    case 'warning':
      return 'Warning';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Unknown';
  }
}
