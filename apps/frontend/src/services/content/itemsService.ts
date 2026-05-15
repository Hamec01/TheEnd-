import type { AdminItem } from './models';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { nowIso, uid } from './storage';

/** Базовые поля для частичного JSON-импорта (остальное подставляется из файла). */
export function createAdminItemDefaults(): AdminItem {
  const now = nowIso();
  return {
    id: '',
    name: '',
    type: 'weapon',
    subtype: '',
    slot: 'rightHand',
    handsRequired: 1,
    rarity: 'common',
    price: 0,
    stackable: false,
    maxStack: 1,
    requiredStats: {},
    bonuses: {},
    gameplayDescription: '',
    loreDescription: '',
    imagePath: '',
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Извлекает массив сырых записей предметов из экспорта/ручного JSON.
 * Поддерживает: массив, { items }, полный backup { content: { items } }.
 */
export function extractRawItemsFromImportJson(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const root = payload as Record<string, unknown>;
    if (Array.isArray(root.items)) {
      return root.items;
    }
    const content = root.content;
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      const items = (content as Record<string, unknown>).items;
      if (Array.isArray(items)) {
        return items;
      }
    }
  }
  throw new Error('Ожидался массив предметов или объект с полем items (или content.items).');
}

export interface ItemsJsonImportResult {
  created: string[];
  skippedExisting: string[];
  updated: string[];
  errors: Array<{ id: string; message: string }>;
}

/**
 * Импорт предметов в хранилище контента (то же API, что у формы админки).
 * Существующие id обновляются целиком (после слияния с дефолтами и normalize).
 */
export async function importItemsFromJsonEntries(
  entries: unknown[],
  mode: 'addOnly' | 'merge' = 'addOnly',
): Promise<ItemsJsonImportResult> {
  const existingIds = new Set((await itemsService.getAll()).map((i) => i.id));
  const seen = new Set<string>();
  const created: string[] = [];
  const skippedExisting: string[] = [];
  const updated: string[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  for (const raw of entries) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ id: '—', message: 'Элемент списка должен быть объектом.' });
      continue;
    }
    const record = raw as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id) {
      errors.push({ id: '—', message: 'У записи нет строкового id.' });
      continue;
    }
    if (seen.has(id)) {
      errors.push({ id, message: 'Повторяющийся id внутри файла.' });
      continue;
    }
    seen.add(id);

    const candidate = normalize({ ...createAdminItemDefaults(), ...record, id } as AdminItem);
    const validationErrors = validateItem(candidate);
    if (validationErrors.length > 0) {
      errors.push({ id, message: validationErrors.join(', ') });
      continue;
    }

    try {
      if (existingIds.has(id)) {
        if (mode === 'addOnly') {
          skippedExisting.push(id);
        } else {
          await itemsService.update(id, candidate);
          updated.push(id);
        }
      } else {
        await itemsService.create(candidate);
        existingIds.add(id);
        created.push(id);
      }
    } catch (error) {
      errors.push({ id, message: (error as Error).message || 'Ошибка сохранения' });
    }
  }

  return { created, skippedExisting, updated, errors };
}

function normalizeItemSlot(slot: AdminItem['slot'] | string | undefined): AdminItem['slot'] {
  switch (slot) {
    case 'cloak':
      return 'outerwear';
    case 'knees':
      return 'legs';
    case 'charm':
      return 'necklace';
    case 'trinket':
      return 'ring';
    default:
      return (slot as AdminItem['slot']) ?? 'none';
  }
}

function normalize(item: AdminItem): AdminItem {
  const normalizedRange = typeof item.attackRange === 'number'
    ? Math.max(2, Math.min(24, Math.floor(item.attackRange)))
    : undefined;

  const normalizedPierce = normalizedRange && typeof item.pierceTargets === 'number'
    ? Math.max(2, Math.min(12, Math.floor(item.pierceTargets)))
    : undefined;

  const normalizedSplashRadius = normalizedRange && typeof item.splashRadius === 'number'
    ? Math.max(1, Math.min(6, Math.floor(item.splashRadius)))
    : undefined;

  const normalizedSplashCenter = normalizedSplashRadius
    ? (typeof item.splashCenterMultiplier === 'number' ? Math.max(1, Math.min(10, item.splashCenterMultiplier)) : 1)
    : undefined;

  const normalizedSplashOuter = normalizedSplashRadius
    ? (typeof item.splashOuterMultiplier === 'number' ? Math.max(0, Math.min(normalizedSplashCenter ?? 1, item.splashOuterMultiplier)) : 0.5)
    : undefined;

  const normalized: AdminItem = {
    ...item,
    requiredStats: item.requiredStats ?? {},
    bonuses: item.bonuses ?? {},
    slot: normalizeItemSlot(item.slot),
    handsRequired: item.type === 'weapon' && item.handsRequired === 2 ? 2 : 1,
    maxStack: item.stackable ? Math.max(2, item.maxStack ?? 2) : 1,
    price: Math.max(0, item.price),
    attackRange: normalizedRange,
    pierceTargets: normalizedPierce,
    splashRadius: normalizedSplashRadius,
    splashCenterMultiplier: normalizedSplashCenter,
    splashOuterMultiplier: normalizedSplashOuter,
    updatedAt: item.updatedAt || nowIso(),
    createdAt: item.createdAt || nowIso(),
  };

  if (normalized.type === 'material' && (!normalized.slot || normalized.slot !== 'none')) {
    normalized.slot = 'none';
  }
  if (normalized.type === 'potion' && (!normalized.slot || normalized.slot === 'none')) {
    normalized.slot = 'quick';
  }
  if (normalized.type === 'weapon' && (!normalized.slot || normalized.slot === 'none')) {
    normalized.slot = 'rightHand';
  }

  if (!normalized.attackRange) {
    normalized.pierceTargets = undefined;
    normalized.splashRadius = undefined;
    normalized.splashCenterMultiplier = undefined;
    normalized.splashOuterMultiplier = undefined;
  }

  return normalized;
}

export function validateItem(item: AdminItem): string[] {
  const errors: string[] = [];
  const hasDamageMin = typeof item.damageMin === 'number';
  const hasDamageMax = typeof item.damageMax === 'number';

  if (!item.id.trim()) {
    errors.push('id required');
  }
  if (!item.name.trim()) {
    errors.push('name required');
  }
  if (!item.type) {
    errors.push('type required');
  }
  if (!item.rarity) {
    errors.push('rarity required');
  }
  if (![1, 2].includes(item.handsRequired ?? 1)) {
    errors.push('handsRequired must be 1 or 2');
  }
  if (item.price < 0) {
    errors.push('price must be >= 0');
  }
  if (hasDamageMin !== hasDamageMax) {
    errors.push('damageMin and damageMax must both be set');
  }
  if (typeof item.damageMin === 'number' && typeof item.damageMax === 'number' && item.damageMin > item.damageMax) {
    errors.push('damageMin must be <= damageMax');
  }
  if (item.stackable && (item.maxStack ?? 0) <= 1) {
    errors.push('stackable item must have maxStack > 1');
  }
  if (!item.stackable && (item.maxStack ?? 1) !== 1) {
    errors.push('non-stackable item maxStack must be 1');
  }

  if (typeof item.attackRange === 'number') {
    if (!Number.isFinite(item.attackRange) || Math.floor(item.attackRange) !== item.attackRange) {
      errors.push('attackRange must be an integer');
    } else if (item.attackRange <= 1) {
      errors.push('attackRange must be > 1');
    }
  }

  if (typeof item.pierceTargets === 'number') {
    if (!item.attackRange) {
      errors.push('pierceTargets requires attackRange');
    } else if (!Number.isFinite(item.pierceTargets) || Math.floor(item.pierceTargets) !== item.pierceTargets) {
      errors.push('pierceTargets must be an integer');
    } else if (item.pierceTargets < 2) {
      errors.push('pierceTargets must be >= 2');
    }
  }

  if (typeof item.splashRadius === 'number') {
    if (!item.attackRange) {
      errors.push('splashRadius requires attackRange');
    } else if (!Number.isFinite(item.splashRadius) || Math.floor(item.splashRadius) !== item.splashRadius) {
      errors.push('splashRadius must be an integer');
    } else if (item.splashRadius < 1) {
      errors.push('splashRadius must be >= 1');
    }
  }

  if (typeof item.splashCenterMultiplier === 'number') {
    if (!item.splashRadius) {
      errors.push('splashCenterMultiplier requires splashRadius');
    } else if (!Number.isFinite(item.splashCenterMultiplier) || item.splashCenterMultiplier < 1) {
      errors.push('splashCenterMultiplier must be >= 1');
    }
  }

  if (typeof item.splashOuterMultiplier === 'number') {
    if (!item.splashRadius) {
      errors.push('splashOuterMultiplier requires splashRadius');
    } else if (!Number.isFinite(item.splashOuterMultiplier) || item.splashOuterMultiplier < 0) {
      errors.push('splashOuterMultiplier must be >= 0');
    } else if (typeof item.splashCenterMultiplier === 'number' && item.splashOuterMultiplier > item.splashCenterMultiplier) {
      errors.push('splashOuterMultiplier must be <= splashCenterMultiplier');
    }
  }

  return errors;
}

export const itemsService = {
  async getAll(): Promise<AdminItem[]> {
    return (await getContentCollection<AdminItem>('items')).map(normalize);
  },

  async getById(id: string): Promise<AdminItem | null> {
    const item = await getContentEntry<AdminItem>('items', id);
    return item ? normalize(item) : null;
  },

  async create(payload: Omit<AdminItem, 'createdAt' | 'updatedAt'>): Promise<AdminItem> {
    const base: AdminItem = normalize({
      ...payload,
      id: payload.id?.trim() || uid('item'),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const errors = validateItem(base);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    const saved = normalize(await createContentEntry<AdminItem>('items', base));
    const verified = await getContentEntry<AdminItem>('items', saved.id);
    if (!verified) {
      throw new Error('Сохранение не подтверждено: запись не найдена после сохранения.');
    }
    return normalize(verified);
  },

  async update(id: string, patch: Partial<AdminItem>): Promise<AdminItem> {
    const normalizedId = id.trim();
    const found = await this.getById(normalizedId);
    if (!found) {
      throw new Error(`Item not found: ${normalizedId}`);
    }
    const merged = normalize({ ...found, ...patch, id: found.id, updatedAt: nowIso() });
    const errors = validateItem(merged);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    const saved = normalize(await updateContentEntry<AdminItem>('items', normalizedId, merged));
    const verified = await getContentEntry<AdminItem>('items', saved.id);
    if (!verified) {
      throw new Error('Сохранение не подтверждено: запись не найдена после сохранения.');
    }
    return normalize(verified);
  },

  async rename(oldId: string, nextId: string, payload: AdminItem): Promise<AdminItem> {
    const fromId = oldId.trim();
    const toId = nextId.trim();
    if (!fromId || !toId) {
      throw new Error('Item id is required.');
    }
    if (fromId === toId) {
      return this.update(fromId, payload);
    }

    const existing = await this.getById(toId);
    if (existing) {
      throw new Error(`Duplicate item id: ${toId}`);
    }

    const normalized = normalize({ ...payload, id: toId, updatedAt: nowIso() });
    const errors = validateItem(normalized);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    const created = await this.create(normalized);
    await this.delete(fromId);
    return created;
  },

  async disable(id: string): Promise<AdminItem> {
    return this.update(id, { isEnabled: false });
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('items', id);
  },
};
