import {
  createContentEntry,
  deleteContentEntry,
  getContentCollection,
  getContentEntry,
  updateContentEntry,
} from './contentApi';
import {
  extractRawCollectionFromImportJson,
  importCollectionFromJsonEntries,
  type JsonImportResult,
} from './adminJsonImportExport';
import { nowIso, uid } from './storage';
import type { SoundDefinition, SoundCategory, SoundKind } from './models';

export const SOUND_CATEGORIES: SoundCategory[] = [
  'ui',
  'footsteps',
  'combat',
  'weapons',
  'magic',
  'skills',
  'items',
  'inventory',
  'quests',
  'dialogues',
  'npc',
  'cities',
  'kingdoms',
  'locations',
  'battle_maps',
  'ambient',
  'weather',
  'resources',
  'professions',
  'events',
  'system',
];

export const SOUND_KINDS: SoundKind[] = ['sfx', 'music', 'ambient', 'voice', 'loop', 'one_shot'];

export const SOUND_CATEGORY_LABELS: Record<SoundCategory, string> = {
  ui: 'UI / Интерфейс',
  footsteps: 'Шаги',
  combat: 'Бой',
  weapons: 'Оружие',
  magic: 'Магия',
  skills: 'Навыки',
  items: 'Предметы',
  inventory: 'Инвентарь',
  quests: 'Квесты',
  dialogues: 'Диалоги',
  npc: 'NPC',
  cities: 'Города',
  kingdoms: 'Королевства',
  locations: 'Локации',
  battle_maps: 'Карты боя',
  ambient: 'Окружение',
  weather: 'Погода',
  resources: 'Ресурсы',
  professions: 'Профессии',
  events: 'События',
  system: 'Система',
};

export const SOUND_KIND_LABELS: Record<SoundKind, string> = {
  sfx: 'SFX (эффект)',
  music: 'Музыка',
  ambient: 'Ambient',
  voice: 'Голос',
  loop: 'Зацикленный',
  one_shot: 'Одиночный',
};

export function emptySound(): SoundDefinition {
  const now = nowIso();
  return {
    id: '',
    name: '',
    status: 'draft',
    category: 'ui',
    kind: 'sfx',
    description: '',
    assetUrl: '',
    assetKey: '',
    volume: 1,
    loop: false,
    randomPitch: false,
    pitchMin: 0.9,
    pitchMax: 1.1,
    cooldownMs: 0,
    tags: [],
    bindings: [],
    adminNotes: '',
    createdAt: now,
    updatedAt: now,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function normalizeSound(input: Partial<SoundDefinition>): SoundDefinition {
  const base = emptySound();
  const id = input.id?.trim() || uid('sound');
  const status = input.status === 'active' || input.status === 'disabled' ? input.status : 'draft';
  const category: SoundCategory = (SOUND_CATEGORIES as string[]).includes(input.category ?? '')
    ? (input.category as SoundCategory)
    : 'ui';
  const kind: SoundKind = (SOUND_KINDS as string[]).includes(input.kind ?? '')
    ? (input.kind as SoundKind)
    : 'sfx';

  return {
    ...base,
    ...input,
    id,
    name: input.name?.trim() || id,
    status,
    category,
    kind,
    description: input.description?.trim() || undefined,
    assetUrl: input.assetUrl?.trim() ?? '',
    assetKey: input.assetKey?.trim() || undefined,
    volume: clamp(numberOrUndefined(input.volume) ?? 1, 0, 1),
    loop: input.loop === true,
    randomPitch: input.randomPitch === true,
    pitchMin: numberOrUndefined(input.pitchMin) ?? 0.9,
    pitchMax: numberOrUndefined(input.pitchMax) ?? 1.1,
    cooldownMs: Math.max(0, Math.floor(numberOrUndefined(input.cooldownMs) ?? 0)),
    tags: Array.isArray(input.tags) ? input.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    bindings: Array.isArray(input.bindings) ? input.bindings : [],
    adminNotes: input.adminNotes?.trim() || undefined,
    createdAt: input.createdAt || base.createdAt,
    updatedAt: nowIso(),
  };
}

export function validateSound(entry: SoundDefinition): string[] {
  const errors: string[] = [];
  if (!entry.id) errors.push('ID не может быть пустым.');
  if (!entry.name) errors.push('Name не может быть пустым.');
  if (!entry.assetUrl) errors.push('Asset URL не может быть пустым.');
  if (!SOUND_CATEGORIES.includes(entry.category)) errors.push(`Недопустимая категория: ${entry.category}`);
  if (!SOUND_KINDS.includes(entry.kind)) errors.push(`Недопустимый тип: ${entry.kind}`);
  if (entry.volume !== undefined && (entry.volume < 0 || entry.volume > 1)) errors.push('Volume должен быть от 0 до 1.');
  if (entry.cooldownMs !== undefined && entry.cooldownMs < 0) errors.push('cooldownMs не может быть отрицательным.');
  return errors;
}

export function extractRawSoundsFromImportJson(payload: unknown): unknown[] {
  return extractRawCollectionFromImportJson(payload, 'sounds');
}

export async function importSoundsFromJsonEntries(entries: unknown[]): Promise<JsonImportResult> {
  return importCollectionFromJsonEntries<SoundDefinition>({
    entries,
    defaults: emptySound,
    normalize: normalizeSound,
    validate: (entry) => (!entry.id ? ['Sound id is required.'] : []),
    getAll: () => soundsService.getAll(),
    create: (value) => soundsService.create(value),
    update: (id, value) => soundsService.update(id, value),
  });
}

export const soundsService = {
  async getAll(): Promise<SoundDefinition[]> {
    return (await getContentCollection<SoundDefinition>('sounds')).map(normalizeSound);
  },

  async getById(id: string): Promise<SoundDefinition | null> {
    const entry = await getContentEntry<SoundDefinition>('sounds', id);
    return entry ? normalizeSound(entry) : null;
  },

  async create(payload: SoundDefinition): Promise<SoundDefinition> {
    const normalized = normalizeSound(payload);
    if (!normalized.id) {
      throw new Error('Sound id is required.');
    }
    return normalizeSound(await createContentEntry<SoundDefinition>('sounds', normalized));
  },

  async update(id: string, patch: Partial<SoundDefinition>): Promise<SoundDefinition> {
    const current = await this.getById(id);
    if (!current) {
      throw new Error(`Sound not found: ${id}`);
    }
    return normalizeSound(
      await updateContentEntry<SoundDefinition>('sounds', id, normalizeSound({ ...current, ...patch, id })),
    );
  },

  async rename(oldId: string, nextId: string, payload: SoundDefinition): Promise<SoundDefinition> {
    const fromId = oldId.trim();
    const toId = nextId.trim();
    if (!fromId || !toId) {
      throw new Error('Sound id is required.');
    }
    if (fromId === toId) {
      return this.update(fromId, payload);
    }
    const existing = await this.getById(toId);
    if (existing) {
      throw new Error(`Duplicate sound id: ${toId}`);
    }
    const created = await this.create({ ...payload, id: toId });
    await this.delete(fromId);
    return created;
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('sounds', id);
  },
};
