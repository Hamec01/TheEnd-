import type { AdminItem } from './models';
import { nowIso, readCollection, uid, writeCollection } from './storage';

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
    return readCollection<AdminItem>('items').map(normalize);
  },

  async getById(id: string): Promise<AdminItem | null> {
    const all = await this.getAll();
    return all.find((item) => item.id === id) ?? null;
  },

  async create(payload: Omit<AdminItem, 'createdAt' | 'updatedAt'>): Promise<AdminItem> {
    const all = await this.getAll();
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
    if (all.some((item) => item.id === base.id)) {
      throw new Error(`Duplicate item id: ${base.id}`);
    }
    const next = [...all, base];
    writeCollection('items', next);
    return base;
  },

  async update(id: string, patch: Partial<AdminItem>): Promise<AdminItem> {
    const all = await this.getAll();
    const found = all.find((item) => item.id === id);
    if (!found) {
      throw new Error(`Item not found: ${id}`);
    }
    const merged = normalize({ ...found, ...patch, id: found.id, updatedAt: nowIso() });
    const errors = validateItem(merged);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    const next = all.map((item) => (item.id === id ? merged : item));
    writeCollection('items', next);
    return merged;
  },

  async disable(id: string): Promise<AdminItem> {
    return this.update(id, { isEnabled: false });
  },

  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    writeCollection('items', all.filter((item) => item.id !== id));
  },
};
