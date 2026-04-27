import type { AdminItem } from './models';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { nowIso, uid } from './storage';

function normalize(item: AdminItem): AdminItem {
  const normalized: AdminItem = {
    ...item,
    requiredStats: item.requiredStats ?? {},
    bonuses: item.bonuses ?? {},
    slot: item.slot ?? 'none',
    handsRequired: item.type === 'weapon' && item.handsRequired === 2 ? 2 : 1,
    maxStack: item.stackable ? Math.max(2, item.maxStack ?? 2) : 1,
    price: Math.max(0, item.price),
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

  return normalized;
}

export function validateItem(item: AdminItem): string[] {
  const errors: string[] = [];
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
  if (typeof item.damageMin === 'number' && typeof item.damageMax === 'number' && item.damageMin > item.damageMax) {
    errors.push('damageMin must be <= damageMax');
  }
  if (item.stackable && (item.maxStack ?? 0) <= 1) {
    errors.push('stackable item must have maxStack > 1');
  }
  if (!item.stackable && (item.maxStack ?? 1) !== 1) {
    errors.push('non-stackable item maxStack must be 1');
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
