import type { VisualFxDefinition } from '@theend/rpg-domain';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { extractRawCollectionFromImportJson, importCollectionFromJsonEntries, type JsonImportResult } from './adminJsonImportExport';
import { nowIso, uid } from './storage';

export const VISUAL_FX_CATEGORIES: VisualFxDefinition['category'][] = [
  'cast',
  'projectile',
  'impact',
  'hit',
  'area',
  'aura',
  'weapon',
  'screen',
  'status',
];

export const VISUAL_FX_ELEMENTS: NonNullable<VisualFxDefinition['element']>[] = [
  'fire',
  'ice',
  'lightning',
  'earth',
  'shadow',
  'light',
  'blood',
  'physical',
  'poison',
  'healing',
  'arcane',
];

export const VISUAL_FX_PLACEMENT_MODES: NonNullable<VisualFxDefinition['placement']['mode']>[] = [
  'once',
  'linger',
  'follow_target',
  'follow_caster',
  'ground_persist',
];

export const VISUAL_FX_KINDS: NonNullable<VisualFxDefinition['kind']>[] = ['single', 'composite'];

export const VISUAL_FX_STAGE_TYPES: NonNullable<NonNullable<VisualFxDefinition['stages']>[number]['stageType']>[] = [
  'cast',
  'projectile',
  'impact',
  'linger',
  'sound',
  'camera',
  'movement',
  'return',
];

export const VISUAL_FX_STAGE_TRIGGERS: NonNullable<NonNullable<VisualFxDefinition['stages']>[number]['trigger']>[] = [
  'on_start',
  'after_previous',
  'on_hit',
  'after_delay',
  'on_complete',
];

export const VISUAL_FX_STAGE_PLAY_ON: NonNullable<NonNullable<VisualFxDefinition['stages']>[number]['playOn']>[] = [
  'caster',
  'target',
  'ground',
  'projectile_end',
  'projectile_current',
  'previous_stage_end',
];

export const VISUAL_FX_STAGE_FOLLOW_MODES: NonNullable<NonNullable<VisualFxDefinition['stages']>[number]['followMode']>[] = [
  'none',
  'follow_target',
  'follow_caster',
  'follow_projectile',
];

export const VISUAL_FX_STAGE_MOVEMENT_BEHAVIORS: NonNullable<NonNullable<VisualFxDefinition['stages']>[number]['movementBehavior']>[] = [
  'none',
  'projectile_straight',
  'projectile_arc',
  'dash_to_target',
  'teleport_to_target',
  'teleport_there_and_back',
];

export const VISUAL_FX_STAGE_CONDITIONS: NonNullable<NonNullable<VisualFxDefinition['stages']>[number]['condition']>[] = [
  'always',
  'if_hit',
  'if_crit',
  'if_miss',
];

export const VISUAL_FX_STAGE_TARGET_MODES: NonNullable<NonNullable<VisualFxDefinition['stages']>[number]['targetMode']>[] = [
  'primary_target',
  'all_targets',
  'aoe_targets',
  'chain_targets',
];

export function emptyVisualFxStage(index = 0): NonNullable<VisualFxDefinition['stages']>[number] {
  return {
    id: `stage_${index + 1}`,
    name: '',
    stageType: 'impact',
    enabled: true,
    trigger: index === 0 ? 'on_start' : 'after_previous',
    delayMs: 0,
    fxRefId: '',
    fxVariantIds: [],
    randomizeFxVariant: false,
    playOn: 'target',
    followMode: 'none',
    durationMs: 700,
    persistMs: 1400,
    movementBehavior: 'none',
    stopSequenceOnFailure: false,
    parallelGroup: '',
    branchToStageIds: [],
    condition: 'always',
    targetMode: 'primary_target',
    audioRefIds: [],
    cameraShakePreset: 'none',
    chainFromPrevious: false,
    maxChainTargets: 3,
  };
}

export function emptyVisualFx(): VisualFxDefinition {
  const now = nowIso();
  return {
    id: '',
    name: '',
    status: 'draft',
    kind: 'single',
    category: 'hit',
    element: 'physical',
    type: 'sprite_sheet',
    description: '',
    asset: {
      url: '',
      key: '',
      frameWidth: 256,
      frameHeight: 256,
      frameCount: 1,
    },
    animation: {
      frameRate: 12,
      repeat: 0,
      durationMs: 500,
    },
    placement: {
      defaultPlayOn: 'target',
      mode: 'once',
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotateToDirection: true,
      lingerDurationMs: 900,
    },
    render: {
      scale: 1,
      alpha: 1,
      rotation: 0,
      blendMode: 'NORMAL',
      originX: 0.5,
      originY: 0.5,
      depth: 5000,
    },
    projectile: {
      speed: 650,
      arc: 0,
      destroyOnImpact: true,
    },
    camera: {
      shakePreset: 'none',
    },
    audio: {
      defaultSoundId: '',
      volume: 1,
    },
    stages: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeVisualFx(input: Partial<VisualFxDefinition>): VisualFxDefinition {
  const base = emptyVisualFx();
  const id = input.id?.trim() || uid('fx');
  const frameWidth = numberOrUndefined(input.asset?.frameWidth) ?? base.asset.frameWidth ?? 256;
  const frameHeight = numberOrUndefined(input.asset?.frameHeight) ?? base.asset.frameHeight ?? 256;
  const frameCount = numberOrUndefined(input.asset?.frameCount) ?? base.asset.frameCount ?? 1;
  const normalizedStages = Array.isArray(input.stages)
    ? input.stages.map((stage, index) => {
      const baseStage = emptyVisualFxStage(index);
      return {
        ...baseStage,
        ...stage,
        id: String(stage.id ?? '').trim() || baseStage.id,
        name: String(stage.name ?? '').trim() || undefined,
        stageType: stage.stageType ?? baseStage.stageType,
        enabled: stage.enabled !== false,
        trigger: stage.trigger ?? baseStage.trigger,
        delayMs: Math.max(0, Math.floor(numberOrUndefined(stage.delayMs) ?? baseStage.delayMs ?? 0)),
        fxRefId: String(stage.fxRefId ?? '').trim() || undefined,
        fxVariantIds: Array.isArray(stage.fxVariantIds) ? stage.fxVariantIds.map((entry) => String(entry).trim()).filter(Boolean) : [],
        randomizeFxVariant: stage.randomizeFxVariant === true,
        playOn: stage.playOn ?? baseStage.playOn,
        followMode: stage.followMode ?? baseStage.followMode,
        durationMs: Math.max(0, Math.floor(numberOrUndefined(stage.durationMs) ?? baseStage.durationMs ?? 0)),
        persistMs: Math.max(0, Math.floor(numberOrUndefined(stage.persistMs) ?? baseStage.persistMs ?? 0)),
        movementBehavior: stage.movementBehavior ?? baseStage.movementBehavior,
        stopSequenceOnFailure: stage.stopSequenceOnFailure === true,
        parallelGroup: String(stage.parallelGroup ?? '').trim() || undefined,
        branchToStageIds: Array.isArray(stage.branchToStageIds) ? stage.branchToStageIds.map((entry) => String(entry).trim()).filter(Boolean) : [],
        condition: stage.condition ?? baseStage.condition,
        targetMode: stage.targetMode ?? baseStage.targetMode,
        audioRefIds: Array.isArray(stage.audioRefIds) ? stage.audioRefIds.map((entry) => String(entry).trim()).filter(Boolean) : [],
        cameraShakePreset: stage.cameraShakePreset ?? baseStage.cameraShakePreset,
        chainFromPrevious: stage.chainFromPrevious === true,
        maxChainTargets: Math.max(1, Math.floor(numberOrUndefined(stage.maxChainTargets) ?? baseStage.maxChainTargets ?? 3)),
      };
    })
    : [];
  return {
    ...base,
    ...input,
    id,
    name: input.name?.trim() || id,
    status: input.status ?? base.status,
    kind: input.kind === 'composite' ? 'composite' : 'single',
    category: input.category ?? base.category,
    element: input.element,
    type: input.type ?? base.type,
    description: input.description?.trim() || undefined,
    asset: {
      ...base.asset,
      ...(input.asset ?? {}),
      url: input.asset?.url?.trim() ?? '',
      key: input.asset?.key?.trim() || id,
      frameWidth: Math.max(1, Math.floor(frameWidth)),
      frameHeight: Math.max(1, Math.floor(frameHeight)),
      frameCount: Math.max(1, Math.floor(frameCount)),
    },
    animation: {
      ...base.animation,
      ...(input.animation ?? {}),
      frameRate: clamp(numberOrUndefined(input.animation?.frameRate) ?? base.animation.frameRate!, 1, 120),
      repeat: Math.floor(numberOrUndefined(input.animation?.repeat) ?? base.animation.repeat!),
      durationMs: Math.max(1, Math.floor(numberOrUndefined(input.animation?.durationMs) ?? base.animation.durationMs!)),
    },
    placement: {
      ...base.placement,
      ...(input.placement ?? {}),
      defaultPlayOn: input.placement?.defaultPlayOn ?? base.placement.defaultPlayOn,
      mode: input.placement?.mode ?? base.placement.mode,
      anchor: input.placement?.anchor ?? base.placement.anchor,
      offsetX: numberOrUndefined(input.placement?.offsetX) ?? base.placement.offsetX,
      offsetY: numberOrUndefined(input.placement?.offsetY) ?? base.placement.offsetY,
      rotateToDirection: input.placement?.rotateToDirection ?? base.placement.rotateToDirection,
      lingerDurationMs: Math.max(80, Math.floor(numberOrUndefined(input.placement?.lingerDurationMs) ?? base.placement.lingerDurationMs ?? 900)),
    },
    render: {
      ...base.render,
      ...(input.render ?? {}),
      scale: Math.max(0.01, numberOrUndefined(input.render?.scale) ?? base.render.scale!),
      alpha: clamp(numberOrUndefined(input.render?.alpha) ?? base.render.alpha!, 0, 1),
      rotation: numberOrUndefined(input.render?.rotation) ?? base.render.rotation,
      blendMode: input.render?.blendMode ?? base.render.blendMode,
      originX: clamp(numberOrUndefined(input.render?.originX) ?? base.render.originX!, 0, 1),
      originY: clamp(numberOrUndefined(input.render?.originY) ?? base.render.originY!, 0, 1),
      depth: Math.floor(numberOrUndefined(input.render?.depth) ?? base.render.depth!),
    },
    projectile: {
      ...base.projectile,
      ...(input.projectile ?? {}),
      speed: Math.max(1, numberOrUndefined(input.projectile?.speed) ?? base.projectile!.speed!),
      arc: numberOrUndefined(input.projectile?.arc) ?? base.projectile!.arc,
      destroyOnImpact: input.projectile?.destroyOnImpact ?? base.projectile!.destroyOnImpact,
    },
    camera: {
      ...base.camera,
      ...(input.camera ?? {}),
      shakePreset: input.camera?.shakePreset ?? base.camera!.shakePreset,
    },
    audio: {
      ...base.audio,
      ...(input.audio ?? {}),
      defaultSoundId: input.audio?.defaultSoundId?.trim() || undefined,
      volume: clamp(numberOrUndefined(input.audio?.volume) ?? base.audio!.volume!, 0, 1),
    },
    stages: normalizedStages,
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    createdAt: input.createdAt || base.createdAt,
    updatedAt: nowIso(),
  };
}

export function extractRawVisualFxFromImportJson(payload: unknown): unknown[] {
  return extractRawCollectionFromImportJson(payload, 'visualFx');
}

export async function importVisualFxFromJsonEntries(entries: unknown[]): Promise<JsonImportResult> {
  return importCollectionFromJsonEntries<VisualFxDefinition>({
    entries,
    defaults: emptyVisualFx,
    normalize: normalizeVisualFx,
    validate: (entry) => (!entry.id ? ['Visual FX id is required.'] : []),
    getAll: () => visualFxService.getAll(),
    create: (value) => visualFxService.create(value),
    update: (id, value) => visualFxService.update(id, value),
  });
}

export const visualFxService = {
  async getAll(): Promise<VisualFxDefinition[]> {
    return (await getContentCollection<VisualFxDefinition>('visualFx')).map(normalizeVisualFx);
  },

  async getById(id: string): Promise<VisualFxDefinition | null> {
    const entry = await getContentEntry<VisualFxDefinition>('visualFx', id);
    return entry ? normalizeVisualFx(entry) : null;
  },

  async create(payload: VisualFxDefinition): Promise<VisualFxDefinition> {
    const normalized = normalizeVisualFx(payload);
    if (!normalized.id) {
      throw new Error('Visual FX id is required.');
    }
    return normalizeVisualFx(await createContentEntry<VisualFxDefinition>('visualFx', normalized));
  },

  async update(id: string, patch: Partial<VisualFxDefinition>): Promise<VisualFxDefinition> {
    const current = await this.getById(id);
    if (!current) {
      throw new Error(`Visual FX not found: ${id}`);
    }
    return normalizeVisualFx(await updateContentEntry<VisualFxDefinition>('visualFx', id, normalizeVisualFx({ ...current, ...patch, id })));
  },

  async rename(oldId: string, nextId: string, payload: VisualFxDefinition): Promise<VisualFxDefinition> {
    const fromId = oldId.trim();
    const toId = nextId.trim();
    if (!fromId || !toId) {
      throw new Error('Visual FX id is required.');
    }
    if (fromId === toId) {
      return this.update(fromId, payload);
    }
    const existing = await this.getById(toId);
    if (existing) {
      throw new Error(`Duplicate visualFx id: ${toId}`);
    }
    const created = await this.create({ ...payload, id: toId });
    await this.delete(fromId);
    return created;
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('visualFx', id);
  },
};
