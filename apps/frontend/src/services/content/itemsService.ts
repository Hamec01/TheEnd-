import type { AdminItem } from './models';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { nowIso, uid } from './storage';

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
    return normalize(await createContentEntry<AdminItem>('items', base));
  },

  async update(id: string, patch: Partial<AdminItem>): Promise<AdminItem> {
    const found = await this.getById(id);
    if (!found) {
      throw new Error(`Item not found: ${id}`);
    }
    const merged = normalize({ ...found, ...patch, id: found.id, updatedAt: nowIso() });
    const errors = validateItem(merged);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return normalize(await updateContentEntry<AdminItem>('items', id, merged));
  },

  async disable(id: string): Promise<AdminItem> {
    return this.update(id, { isEnabled: false });
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('items', id);
  },
};
