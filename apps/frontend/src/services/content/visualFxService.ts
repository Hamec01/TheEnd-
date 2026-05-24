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

export function emptyVisualFx(): VisualFxDefinition {
  const now = nowIso();
  return {
    id: '',
    name: '',
    status: 'draft',
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
      anchor: 'center',
      offsetX: 0,
      offsetY: 0,
      rotateToDirection: true,
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
  return {
    ...base,
    ...input,
    id,
    name: input.name?.trim() || id,
    status: input.status ?? base.status,
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
      anchor: input.placement?.anchor ?? base.placement.anchor,
      offsetX: numberOrUndefined(input.placement?.offsetX) ?? base.placement.offsetX,
      offsetY: numberOrUndefined(input.placement?.offsetY) ?? base.placement.offsetY,
      rotateToDirection: input.placement?.rotateToDirection ?? base.placement.rotateToDirection,
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
