import type {
  EquipmentVisualBindingDefinition,
  SpriteActionType,
  SpriteAnchorKey,
  SpriteAnchorPoint,
  SpriteAnimationSetDefinition,
  SpriteBodyTemplateDefinition,
  SpriteProfileDefinition,
  SpriteSurface,
  WeaponGripType,
} from '@theend/rpg-domain';
import type {
  AdminItem,
  AdminNpc,
  RuntimeAssemblyRuleDefinition,
  SkillAnimationBindingDefinition,
} from '../services/content/models';
import { normalizeLegacySpriteAction } from './legacyAdapter';
import { fittingAnchorToSpriteAnchor, normalizeBindingFitting } from './vectorForge';
import type {
  CharacterVisualIssue,
  CharacterVisualResolverInput,
  CharacterVisualResolverContent,
  PlayerLikeVisualEntity,
  ResolvedBindingCandidateDebug,
  ResolvedCharacterLayerGroup,
  ResolvedCharacterVisual,
  ResolvedCharacterVisualDebug,
  ResolvedCharacterVisualLayer,
  ResolvedEquipmentBindingDebug,
} from './resolvedModel';

const LAYER_ORDER: ResolvedCharacterLayerGroup[] = [
  'shadow',
  'back',
  'body_legs',
  'boots',
  'body_torso',
  'chest_armor',
  'arms',
  'gloves',
  'head',
  'hair',
  'helmet',
  'main_hand_weapon',
  'offhand_shield',
  'cloak_front',
  'fx',
];

const LAYER_Z_INDEX = Object.fromEntries(LAYER_ORDER.map((entry, index) => [entry, index])) as Record<ResolvedCharacterLayerGroup, number>;

type ScoreBreakdown = Record<string, number>;

interface BindingScoreResult {
  accepted: boolean;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reasons: string[];
}

interface ResolvedBindingSelection {
  binding: EquipmentVisualBindingDefinition | null;
  debug: ResolvedEquipmentBindingDebug;
}

interface ResolvedProfileContext {
  profile: SpriteProfileDefinition | null;
  source: ResolvedCharacterVisualDebug['profileSource'];
}

interface ResolvedRuleContext {
  rule: RuntimeAssemblyRuleDefinition | null;
  source: 'rule' | 'none';
}

export interface ResolveEquipmentBindingParams {
  bindings: EquipmentVisualBindingDefinition[];
  itemId: string;
  bodyTemplateId?: string | null;
  raceId?: string | null;
  bodyType?: string | null;
  surface: SpriteSurface;
  preferredSlot?: string | null;
}

function createIssue(
  severity: CharacterVisualIssue['severity'],
  code: string,
  message: string,
  entityId?: string,
  refId?: string,
): CharacterVisualIssue {
  return { severity, code, message, entityId, refId };
}

function uniqueActions(actions: Array<SpriteActionType | null | undefined>): SpriteActionType[] {
  const seen = new Set<SpriteActionType>();
  const next: SpriteActionType[] = [];
  for (const action of actions) {
    if (!action || seen.has(action)) {
      continue;
    }
    seen.add(action);
    next.push(action);
  }
  return next;
}

function inferEntityId(input: CharacterVisualResolverInput): string {
  if (input.npc?.id) {
    return input.npc.id;
  }
  if (input.player?.id) {
    return input.player.id;
  }
  return `resolved_${input.entityType}`;
}

function inferRaceId(input: CharacterVisualResolverInput): string | null {
  return String(input.npc?.race ?? input.player?.race ?? '').trim() || null;
}

function inferBodyType(input: CharacterVisualResolverInput, template: SpriteBodyTemplateDefinition | null): string | null {
  return String(template?.bodyType ?? input.player?.bodyType ?? '').trim() || null;
}

function normalizePreferredAction(input: CharacterVisualResolverInput): SpriteActionType | null {
  return normalizeLegacySpriteAction(input.preferredAction) ?? null;
}

function resolveProfileContext(input: CharacterVisualResolverInput, warnings: CharacterVisualIssue[], errors: CharacterVisualIssue[]): ResolvedProfileContext {
  const profilesById = new Map(input.content.spriteProfiles.map((entry) => [entry.id, entry] as const));
  const entityId = inferEntityId(input);
  const explicitId = String(input.spriteProfileId ?? '').trim();
  if (explicitId) {
    const profile = profilesById.get(explicitId) ?? null;
    if (!profile) {
      errors.push(createIssue('error', 'missing_sprite_profile', `Sprite profile '${explicitId}' not found.`, entityId, explicitId));
    }
    return { profile, source: 'explicit' };
  }

  const npcProfileId = String(input.npc?.spriteProfileId ?? '').trim();
  if (npcProfileId) {
    const profile = profilesById.get(npcProfileId) ?? null;
    if (!profile) {
      errors.push(createIssue('error', 'missing_npc_sprite_profile', `NPC sprite profile '${npcProfileId}' not found.`, entityId, npcProfileId));
    }
    return { profile, source: 'npc' };
  }

  const playerProfileId = String(input.player?.spriteProfileId ?? '').trim();
  if (playerProfileId) {
    const profile = profilesById.get(playerProfileId) ?? null;
    if (!profile) {
      errors.push(createIssue('error', 'missing_player_sprite_profile', `Player sprite profile '${playerProfileId}' not found.`, entityId, playerProfileId));
    }
    return { profile, source: 'player' };
  }

  if (input.npc) {
    warnings.push(createIssue('warning', 'legacy_npc_fallback', 'NPC has no spriteProfileId; legacy fallback will be used.', entityId, input.npc.id));
    return { profile: null, source: 'fallback' };
  }

  return { profile: null, source: 'player' };
}

function scoreRuntimeRule(rule: RuntimeAssemblyRuleDefinition, params: {
  raceId: string | null;
  surface: SpriteSurface;
}): number {
  if (rule.compatibleSurfaces.length > 0 && !rule.compatibleSurfaces.includes(params.surface)) {
    return -1;
  }
  let score = 0;
  if (rule.compatibleSurfaces.includes(params.surface)) {
    score += 8;
  }
  if (params.raceId) {
    if (String(rule.raceId ?? '').trim() === params.raceId) {
      score += 6;
    } else if (String(rule.raceId ?? '').trim()) {
      return -1;
    }
  }
  if (rule.profileId) {
    score += 2;
  }
  if (rule.bodyTemplateId) {
    score += 1;
  }
  if (rule.animationSetId) {
    score += 1;
  }
  return score;
}

function resolveRuntimeRule(input: CharacterVisualResolverInput): ResolvedRuleContext {
  const raceId = inferRaceId(input);
  const ranked = input.content.runtimeAssemblyRules
    .map((rule) => ({ rule, score: scoreRuntimeRule(rule, { raceId, surface: input.surface }) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.rule.id.localeCompare(right.rule.id));
  return { rule: ranked[0]?.rule ?? null, source: ranked[0] ? 'rule' : 'none' };
}

function resolveProfileBodyTemplate(
  profile: SpriteProfileDefinition | null | undefined,
  templates: SpriteBodyTemplateDefinition[],
): SpriteBodyTemplateDefinition | null {
  if (!profile?.bodyTemplateId) {
    return null;
  }
  return templates.find((template) => template.id === profile.bodyTemplateId) ?? null;
}

function resolveBodyTemplate(input: CharacterVisualResolverInput, profile: SpriteProfileDefinition | null, rule: RuntimeAssemblyRuleDefinition | null, errors: CharacterVisualIssue[]): {
  template: SpriteBodyTemplateDefinition | null;
  source: ResolvedCharacterVisualDebug['bodyTemplateSource'];
} {
  const templatesById = new Map(input.content.spriteBodyTemplates.map((entry) => [entry.id, entry] as const));
  const explicitBodyTemplateId = String(input.bodyTemplateId ?? '').trim();
  const profileBodyTemplateId = String(profile?.bodyTemplateId ?? '').trim();
  const ruleBodyTemplateId = String(rule?.bodyTemplateId ?? '').trim();
  const entityId = inferEntityId(input);

  if (explicitBodyTemplateId) {
    const template = templatesById.get(explicitBodyTemplateId) ?? null;
    if (!template) {
      errors.push(createIssue('error', 'missing_body_template', `Body template '${explicitBodyTemplateId}' not found.`, entityId, explicitBodyTemplateId));
    }
    return { template, source: template ? 'explicit' : 'missing' };
  }
  if (profileBodyTemplateId) {
    const template = templatesById.get(profileBodyTemplateId) ?? null;
    if (!template) {
      errors.push(createIssue('error', 'missing_profile_body_template', `Profile body template '${profileBodyTemplateId}' not found.`, entityId, profileBodyTemplateId));
    }
    return { template, source: template ? 'profile' : 'missing' };
  }
  if (ruleBodyTemplateId) {
    const template = templatesById.get(ruleBodyTemplateId) ?? null;
    if (!template) {
      errors.push(createIssue('error', 'missing_rule_body_template', `Runtime rule body template '${ruleBodyTemplateId}' not found.`, entityId, ruleBodyTemplateId));
    }
    return { template, source: template ? 'rule' : 'missing' };
  }
  return { template: null, source: 'missing' };
}

export function resolveAnimationSet(input: CharacterVisualResolverInput, params?: {
  profile?: SpriteProfileDefinition | null;
  rule?: RuntimeAssemblyRuleDefinition | null;
  errors?: CharacterVisualIssue[];
}): SpriteAnimationSetDefinition | null {
  const animationSetsById = new Map(input.content.spriteAnimationSets.map((entry) => [entry.id, entry] as const));
  const entityId = inferEntityId(input);
  const explicitAnimationSetId = String(input.animationSetId ?? '').trim();
  const profileAnimationSetId = String(params?.profile?.animationSetId ?? '').trim();
  const ruleAnimationSetId = String(params?.rule?.animationSetId ?? '').trim();

  if (explicitAnimationSetId) {
    const animationSet = animationSetsById.get(explicitAnimationSetId) ?? null;
    if (!animationSet) {
      params?.errors?.push(createIssue('error', 'missing_animation_set', `Animation set '${explicitAnimationSetId}' not found.`, entityId, explicitAnimationSetId));
    }
    return animationSet;
  }
  if (profileAnimationSetId) {
    const animationSet = animationSetsById.get(profileAnimationSetId) ?? null;
    if (!animationSet) {
      params?.errors?.push(createIssue('error', 'missing_profile_animation_set', `Profile animation set '${profileAnimationSetId}' not found.`, entityId, profileAnimationSetId));
    }
    return animationSet;
  }
  if (ruleAnimationSetId) {
    const animationSet = animationSetsById.get(ruleAnimationSetId) ?? null;
    if (!animationSet) {
      params?.errors?.push(createIssue('error', 'missing_rule_animation_set', `Runtime rule animation set '${ruleAnimationSetId}' not found.`, entityId, ruleAnimationSetId));
    }
    return animationSet;
  }
  return null;
}

function scoreBinding(params: ResolveEquipmentBindingParams, binding: EquipmentVisualBindingDefinition): BindingScoreResult {
  const reasons: string[] = [];
  const scoreBreakdown: ScoreBreakdown = {};

  if (binding.itemId !== params.itemId) {
    reasons.push('item_id_mismatch');
    return { accepted: false, score: -1, scoreBreakdown, reasons };
  }

  if (binding.compatibleSurfaces.length > 0) {
    if (!binding.compatibleSurfaces.includes(params.surface)) {
      reasons.push('surface_mismatch');
      return { accepted: false, score: -1, scoreBreakdown, reasons };
    }
    scoreBreakdown.surface = 10;
  }

  if (params.bodyTemplateId) {
    if (binding.compatibleBodyTemplateIds.length > 0 && !binding.compatibleBodyTemplateIds.includes(params.bodyTemplateId)) {
      reasons.push('body_template_mismatch');
      return { accepted: false, score: -1, scoreBreakdown, reasons };
    }
    if (binding.compatibleBodyTemplateIds.includes(params.bodyTemplateId)) {
      scoreBreakdown.bodyTemplate = 8;
    }
  }

  if (params.raceId) {
    if (binding.compatibleRaceIds.length > 0 && !binding.compatibleRaceIds.includes(params.raceId)) {
      reasons.push('race_mismatch');
      return { accepted: false, score: -1, scoreBreakdown, reasons };
    }
    if (binding.compatibleRaceIds.includes(params.raceId)) {
      scoreBreakdown.race = 6;
    }
  }

  if (params.bodyType) {
    if (binding.compatibleBodyTypes.length > 0 && !binding.compatibleBodyTypes.includes(params.bodyType)) {
      reasons.push('body_type_mismatch');
      return { accepted: false, score: -1, scoreBreakdown, reasons };
    }
    if (binding.compatibleBodyTypes.includes(params.bodyType)) {
      scoreBreakdown.bodyType = 4;
    }
  }

  if (params.preferredSlot) {
    if (binding.equipmentSlot === params.preferredSlot) {
      scoreBreakdown.slot = 3;
    } else {
      reasons.push('slot_preference_mismatch');
    }
  }

  if (binding.defaultForItem) {
    scoreBreakdown.default = 1;
  }

  const score = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0);
  reasons.push('binding_accepted');
  return { accepted: true, score, scoreBreakdown, reasons };
}

export function resolveBestEquipmentBinding(params: ResolveEquipmentBindingParams): EquipmentVisualBindingDefinition | null {
  return resolveBestEquipmentBindingWithDebug(params).binding;
}

export function resolveBestEquipmentVisualBinding(params: ResolveEquipmentBindingParams): EquipmentVisualBindingDefinition | null {
  return resolveBestEquipmentBinding(params);
}

function resolveBestEquipmentBindingWithDebug(params: ResolveEquipmentBindingParams): ResolvedBindingSelection {
  const candidates: Array<{ binding: EquipmentVisualBindingDefinition; result: BindingScoreResult }> = params.bindings
    .filter((binding) => binding.itemId === params.itemId)
    .map((binding) => ({ binding, result: scoreBinding(params, binding) }));

  const sortedAccepted = candidates
    .filter((entry) => entry.result.accepted)
    .sort((left, right) => right.result.score - left.result.score || left.binding.id.localeCompare(right.binding.id));

  const chosen = sortedAccepted[0] ?? null;
  const debugCandidates: ResolvedBindingCandidateDebug[] = candidates.map((entry) => ({
    bindingId: entry.binding.id,
    bindingName: entry.binding.name,
    score: entry.result.score,
    accepted: chosen?.binding.id === entry.binding.id,
    scoreBreakdown: entry.result.scoreBreakdown,
    reasons: entry.result.reasons,
  }));

  return {
    binding: chosen?.binding ?? null,
    debug: {
      itemId: params.itemId,
      slot: params.preferredSlot ?? undefined,
      chosenBindingId: chosen?.binding.id,
      chosenBindingName: chosen?.binding.name,
      chosenScore: chosen?.result.score,
      chosenScoreBreakdown: chosen?.result.scoreBreakdown,
      rejectionReasons: chosen ? [] : ['no_compatible_binding'],
      candidates: debugCandidates,
    },
  };
}

function collectEquippedItems(input: CharacterVisualResolverInput, profile: SpriteProfileDefinition | null): Array<{ itemId: string; slot?: string }> {
  const explicit = input.equippedItemIds ?? input.player?.equippedItemIds;
  if (explicit) {
    return Object.entries(explicit)
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([slot, itemId]) => ({ slot, itemId }));
  }
  return (profile?.defaultEquipmentItemIds ?? []).map((itemId) => ({ itemId }));
}

function findItemById(items: AdminItem[], itemId: string): AdminItem | null {
  return items.find((entry) => entry.id === itemId) ?? null;
}

function mapLayerGroup(binding: EquipmentVisualBindingDefinition, preferredSlot: string | undefined): ResolvedCharacterLayerGroup {
  const slot = preferredSlot ?? binding.equipmentSlot;
  if (binding.weaponGripType === 'shield' || slot === 'offHand' || slot === 'leftHand') {
    return 'offhand_shield';
  }
  if (binding.weaponGripType !== 'none' || slot === 'mainHand' || slot === 'rightHand' || slot === 'tool') {
    return 'main_hand_weapon';
  }
  if (slot === 'boots') {
    return 'boots';
  }
  if (slot === 'gloves') {
    return 'gloves';
  }
  if (slot === 'head') {
    return 'helmet';
  }
  if (slot === 'chest') {
    return 'chest_armor';
  }
  if (slot === 'cloak') {
    return 'cloak_front';
  }
  if (slot === 'back' || slot === 'belt') {
    return 'back';
  }
  return 'back';
}

function inferAnchorName(binding: EquipmentVisualBindingDefinition, preferredSlot: string | undefined): SpriteAnchorKey | undefined {
  const normalizedBinding = normalizeBindingFitting(binding);
  const explicitAnchor = fittingAnchorToSpriteAnchor(normalizedBinding.preferredAnchor);
  if (explicitAnchor) {
    return explicitAnchor;
  }
  if (binding.weaponGripType === 'shield') {
    return 'shieldAnchor';
  }
  if (binding.weaponGripType === 'off_hand' || preferredSlot === 'offHand' || preferredSlot === 'leftHand') {
    return 'offhandAnchor';
  }
  if (binding.weaponGripType !== 'none' || preferredSlot === 'mainHand' || preferredSlot === 'rightHand' || preferredSlot === 'tool') {
    return 'rightHandAnchor';
  }
  if (preferredSlot === 'head') {
    return 'headAnchor';
  }
  if (preferredSlot === 'chest') {
    return 'chestAnchor';
  }
  if (preferredSlot === 'cloak' || preferredSlot === 'back') {
    return 'backAnchor';
  }
  return undefined;
}

function surfaceAssetFor<T extends {
  paperdoll?: { imageRef?: import('@theend/rpg-domain').SpriteImageRef; imagePath?: string; scale?: number; offsetX?: number; offsetY?: number; rotation?: number; zLayer?: number };
  world?: { imageRef?: import('@theend/rpg-domain').SpriteImageRef; imagePath?: string; scale?: number; offsetX?: number; offsetY?: number; rotation?: number; zLayer?: number };
  battle?: { imageRef?: import('@theend/rpg-domain').SpriteImageRef; imagePath?: string; scale?: number; offsetX?: number; offsetY?: number; rotation?: number; zLayer?: number };
}>(entry: T | null | undefined, surface: SpriteSurface) {
  if (!entry) {
    return undefined;
  }
  if (surface === 'paperdoll') {
    return entry.paperdoll;
  }
  if (surface === 'world') {
    return entry.world;
  }
  return entry.battle;
}

function imageIdFromRef(ref: import('@theend/rpg-domain').SpriteImageRef | undefined): string | undefined {
  return ref?.type === 'image' ? ref.src : undefined;
}

function imageSheetIdFromRef(ref: import('@theend/rpg-domain').SpriteImageRef | undefined): string | undefined {
  return ref?.type === 'tileset' ? ref.sheetId : undefined;
}

function hasRuntimeImageRef(content: CharacterVisualResolverContent, imageIdOrPath: string): boolean {
  if (!imageIdOrPath) {
    return false;
  }
  if (imageIdOrPath.startsWith('/') || imageIdOrPath.startsWith('http') || imageIdOrPath.startsWith('data:')) {
    return true;
  }
  return content.images.some((entry) => entry.id === imageIdOrPath);
}

function validateResolvedLayerAsset(
  input: CharacterVisualResolverInput,
  layer: ResolvedCharacterVisualLayer,
  warnings: CharacterVisualIssue[],
) {
  if (layer.imageRef?.type === 'image') {
    if (!hasRuntimeImageRef(input.content, layer.imageRef.src)) {
      warnings.push(createIssue('warning', 'missing_layer_image', `Layer '${layer.id}' references missing image '${layer.imageRef.src}'.`, inferEntityId(input), layer.bindingId ?? layer.id));
    }
    return;
  }
  if (layer.imageRef?.type === 'tileset') {
    const tilesetRef = layer.imageRef;
    const sheet = input.content.imageSheets.find((entry) => entry.id === tilesetRef.sheetId);
    if (!sheet) {
      warnings.push(createIssue('warning', 'missing_layer_image_sheet', `Layer '${layer.id}' references missing image sheet '${tilesetRef.sheetId}'.`, inferEntityId(input), layer.bindingId ?? layer.id));
      return;
    }
    if (!hasRuntimeImageRef(input.content, sheet.src)) {
      warnings.push(createIssue('warning', 'missing_layer_sheet_source', `Layer '${layer.id}' references missing sheet source '${sheet.src}'.`, inferEntityId(input), layer.bindingId ?? layer.id));
    }
    return;
  }
  const legacyPath = String(layer.imagePath ?? '').trim();
  if (legacyPath && !hasRuntimeImageRef(input.content, legacyPath)) {
    warnings.push(createIssue('warning', 'missing_layer_legacy_image', `Layer '${layer.id}' references missing legacy image '${legacyPath}'.`, inferEntityId(input), layer.bindingId ?? layer.id));
  }
}

function cloneAnchorPoint(point: SpriteAnchorPoint | undefined): SpriteAnchorPoint | undefined {
  return point ? { x: point.x, y: point.y } : undefined;
}

function mergeAnchors(
  template: SpriteBodyTemplateDefinition | null,
  bindings: Array<{ binding: EquipmentVisualBindingDefinition; preferredSlot?: string }>,
): Partial<Record<SpriteAnchorKey, SpriteAnchorPoint>> {
  const anchors: Partial<Record<SpriteAnchorKey, SpriteAnchorPoint>> = {};
  if (template?.anchors) {
    for (const [key, point] of Object.entries(template.anchors) as Array<[SpriteAnchorKey, SpriteAnchorPoint]>) {
      anchors[key] = cloneAnchorPoint(point);
    }
  }
  for (const { binding } of bindings) {
    for (const [key, point] of Object.entries(binding.anchorOverrides ?? {}) as Array<[SpriteAnchorKey, SpriteAnchorPoint]>) {
      anchors[key] = cloneAnchorPoint(point);
    }
  }
  return anchors;
}

function resolveSkillBinding(input: CharacterVisualResolverInput): SkillAnimationBindingDefinition | null {
  const explicitId = String(input.skillBindingId ?? '').trim();
  if (explicitId) {
    return input.content.skillAnimationBindings.find((entry) => entry.id === explicitId) ?? null;
  }
  return null;
}

export function resolveSkillAnimation(input: CharacterVisualResolverInput): SkillAnimationBindingDefinition | null {
  return resolveSkillBinding(input);
}

function resolveLegacyFallback(input: CharacterVisualResolverInput) {
  const npc = input.npc;
  return {
    used: Boolean(npc),
    reason: npc ? 'legacy_npc_visuals' : undefined,
    portraitUrl: npc?.portraitUrl,
    iconUrl: npc?.iconUrl,
    fullImageUrl: npc?.fullImageUrl,
    combatImageUrl: npc?.combatImageUrl,
    battleSpriteAssetId: npc?.battleSpriteAssetId,
    worldSpriteId: undefined,
  };
}

function resolveFrame(input: CharacterVisualResolverInput, animationSet: SpriteAnimationSetDefinition | null, warnings: CharacterVisualIssue[]): {
  width: number;
  height: number;
  action?: SpriteActionType;
  clip?: ResolvedCharacterVisual['clip'];
} {
  const preferredAction = normalizePreferredAction(input);
  const availableActions = uniqueActions(animationSet?.clips.map((entry) => entry.action) ?? []);
  const clip = (preferredAction
    ? animationSet?.clips.find((entry) => entry.action === preferredAction)
    : null) ?? animationSet?.clips[0];

  if (preferredAction && !clip) {
    warnings.push(createIssue('warning', 'missing_action_clip', `Action '${preferredAction}' is missing in the selected animation set.`, inferEntityId(input), animationSet?.id));
  }

  return {
    width: clip?.frameWidth ?? 128,
    height: clip?.frameHeight ?? 128,
    action: clip?.action ?? availableActions[0],
    clip: clip
      ? {
        action: clip.action,
        imageRef: clip.imageRef,
        imagePath: clip.imagePath,
        frameWidth: clip.frameWidth,
        frameHeight: clip.frameHeight,
        frameCount: clip.frameCount,
        fps: clip.fps,
        row: clip.row ?? 0,
        loop: clip.loop !== false,
        notes: clip.notes,
      }
      : undefined,
  };
}

export function resolveEquipmentVisuals(input: CharacterVisualResolverInput): ResolvedCharacterVisualLayer[] {
  return resolveCharacterVisual(input).layers.filter((entry) => entry.source !== 'body' && entry.source !== 'fx');
}

export function listProfileBindings(params: {
  profile: SpriteProfileDefinition | null | undefined;
  templates: SpriteBodyTemplateDefinition[];
  bindings: EquipmentVisualBindingDefinition[];
  raceId?: string | null;
  surface: SpriteSurface;
}): EquipmentVisualBindingDefinition[] {
  const template = resolveProfileBodyTemplate(params.profile, params.templates);
  const bodyType = template?.bodyType ?? null;
  return (params.profile?.defaultEquipmentItemIds ?? [])
    .map((itemId) => resolveBestEquipmentBinding({
      bindings: params.bindings,
      itemId,
      bodyTemplateId: template?.id ?? null,
      bodyType,
      raceId: params.raceId ?? null,
      surface: params.surface,
    }))
    .filter((entry): entry is EquipmentVisualBindingDefinition => Boolean(entry));
}

export function resolveCharacterVisual(input: CharacterVisualResolverInput): ResolvedCharacterVisual {
  const warnings: CharacterVisualIssue[] = [];
  const errors: CharacterVisualIssue[] = [];
  const entityId = inferEntityId(input);
  const profileContext = resolveProfileContext(input, warnings, errors);
  const ruleContext = profileContext.profile ? { rule: null, source: 'none' as const } : resolveRuntimeRule(input);
  const bodyContext = resolveBodyTemplate(input, profileContext.profile, ruleContext.rule, errors);
  const animationSet = resolveAnimationSet(input, { profile: profileContext.profile, rule: ruleContext.rule, errors });
  const resolvedRaceId = inferRaceId(input);
  const resolvedBodyType = inferBodyType(input, bodyContext.template);
  const equippedItems = collectEquippedItems(input, profileContext.profile);

  const chosenBindings: Array<{ binding: EquipmentVisualBindingDefinition; preferredSlot?: string; item: AdminItem | null }> = [];
  const equipmentDebug: ResolvedEquipmentBindingDebug[] = [];

  for (const equipped of equippedItems) {
    const item = findItemById(input.content.items, equipped.itemId);
    if (!item) {
      warnings.push(createIssue('warning', 'missing_item', `Equipped item '${equipped.itemId}' was not found.`, entityId, equipped.itemId));
      equipmentDebug.push({
        itemId: equipped.itemId,
        slot: equipped.slot,
        rejectionReasons: ['missing_item'],
        candidates: [],
      });
      continue;
    }

    const selection = resolveBestEquipmentBindingWithDebug({
      bindings: input.content.equipmentVisualBindings,
      itemId: item.id,
      bodyTemplateId: bodyContext.template?.id ?? null,
      raceId: resolvedRaceId,
      bodyType: resolvedBodyType,
      surface: input.surface,
      preferredSlot: equipped.slot ?? item.slot ?? null,
    });
    selection.debug.itemName = item.name;
    equipmentDebug.push(selection.debug);

    if (!selection.binding) {
      warnings.push(createIssue('warning', 'missing_equipment_binding', `No compatible binding found for item '${item.name}'.`, entityId, item.id));
      continue;
    }

    chosenBindings.push({ binding: selection.binding, preferredSlot: equipped.slot, item });
  }

  const layers: ResolvedCharacterVisualLayer[] = [];
  const bodySurface = surfaceAssetFor(bodyContext.template, input.surface);
  if (bodyContext.template) {
    layers.push({
      id: `${entityId}:body:${bodyContext.template.id}`,
      group: 'body_torso',
      source: 'body',
      imageRef: bodySurface?.imageRef,
      imagePath: bodySurface?.imagePath,
      imageId: imageIdFromRef(bodySurface?.imageRef),
      imageSheetId: imageSheetIdFromRef(bodySurface?.imageRef),
      zIndex: LAYER_Z_INDEX.body_torso + (bodySurface?.zLayer ?? 0),
      transform: {
        scale: bodySurface?.scale ?? 1,
        offsetX: bodySurface?.offsetX ?? 0,
        offsetY: bodySurface?.offsetY ?? 0,
        rotation: bodySurface?.rotation ?? 0,
        zLayer: bodySurface?.zLayer ?? 0,
      },
      visible: true,
      opacity: 1,
      notes: bodySurface?.imageRef || bodySurface?.imagePath ? undefined : 'No body art configured.',
    });
  }

  for (const entry of chosenBindings) {
    const asset = surfaceAssetFor(entry.binding, input.surface);
    const group = mapLayerGroup(entry.binding, entry.preferredSlot ?? entry.item?.slot);
    const anchorName = inferAnchorName(entry.binding, entry.preferredSlot ?? entry.item?.slot);
    if (!asset?.imageRef && !asset?.imagePath) {
      warnings.push(createIssue('warning', 'missing_binding_art', `Binding '${entry.binding.name}' has no art configured for ${input.surface}.`, entityId, entry.binding.id));
    }
    layers.push({
      id: `${entityId}:binding:${entry.binding.id}`,
      group,
      source: group === 'offhand_shield' ? 'shield' : group === 'main_hand_weapon' ? 'weapon' : 'equipment',
      itemId: entry.item?.id,
      bindingId: entry.binding.id,
      imageRef: asset?.imageRef,
      imagePath: asset?.imagePath,
      imageId: imageIdFromRef(asset?.imageRef),
      imageSheetId: imageSheetIdFromRef(asset?.imageRef),
      zIndex: LAYER_Z_INDEX[group] + (asset?.zLayer ?? 0),
      transform: {
        scale: asset?.scale ?? 1,
        offsetX: asset?.offsetX ?? 0,
        offsetY: asset?.offsetY ?? 0,
        rotation: asset?.rotation ?? 0,
        zLayer: asset?.zLayer ?? 0,
      },
      slot: entry.preferredSlot ?? entry.item?.slot ?? entry.binding.equipmentSlot,
      anchorName,
      opacity: 1,
      visible: true,
    });
  }

  const skillBinding = resolveSkillBinding(input);
  const visualFx = input.visualFxId
    ? input.content.visualFx.find((entry) => entry.id === input.visualFxId) ?? null
    : null;
  if (skillBinding || visualFx) {
    layers.push({
      id: `${entityId}:fx:${skillBinding?.id ?? visualFx?.id ?? 'preview'}`,
      group: 'fx',
      source: 'fx',
      bindingId: skillBinding?.id,
      zIndex: LAYER_Z_INDEX.fx,
      anchorName: skillBinding?.sourceAnchor ?? 'castFxAnchor',
      visible: true,
      opacity: 1,
      notes: skillBinding?.name ?? visualFx?.name,
    });
  }

  const anchors = mergeAnchors(bodyContext.template, chosenBindings.map((entry) => ({
    binding: entry.binding,
    preferredSlot: entry.preferredSlot,
  })));

  const frame = resolveFrame(input, animationSet, warnings);
  const availableActions = uniqueActions(animationSet?.clips.map((entry) => entry.action) ?? []);
  const fallback = resolveLegacyFallback(input);

  if (!bodyContext.template && !fallback.used) {
    warnings.push(createIssue('warning', 'missing_visual_body', 'No body template or legacy fallback is available.', entityId));
  }
  if (!animationSet && !fallback.used) {
    warnings.push(createIssue('warning', 'missing_visual_animation_set', 'No animation set is available; preview will remain static.', entityId));
  }
  for (const layer of layers) {
    validateResolvedLayerAsset(input, layer, warnings);
  }

  return {
    entityId,
    entityType: input.entityType,
    surface: input.surface,
    spriteProfileId: profileContext.profile?.id,
    bodyTemplateId: bodyContext.template?.id,
    animationSetId: animationSet?.id,
    resolvedAction: frame.action,
    frame: {
      width: frame.width,
      height: frame.height,
    },
    clip: frame.clip,
    fallback,
    layers: [...layers].sort((left, right) => left.zIndex - right.zIndex || left.id.localeCompare(right.id)),
    anchors,
    availableActions,
    warnings,
    errors,
    debug: {
      profileSource: profileContext.source,
      explicitSpriteProfileId: String(input.spriteProfileId ?? '').trim() || undefined,
      chosenProfileId: profileContext.profile?.id,
      chosenRuleId: ruleContext.rule?.id,
      bodyTemplateSource: bodyContext.source,
      animationSetSource: String(input.animationSetId ?? '').trim()
        ? 'explicit'
        : animationSet?.id && animationSet.id === profileContext.profile?.animationSetId
          ? 'profile'
          : animationSet?.id && animationSet.id === ruleContext.rule?.animationSetId
            ? 'rule'
            : 'missing',
      equipment: equipmentDebug,
    },
  };
}
