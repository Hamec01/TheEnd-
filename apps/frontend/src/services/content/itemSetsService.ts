import type { ItemSet } from './models';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { nowIso, uid } from './storage';

export function validateItemSet(set: ItemSet): string[] {
  const errors: string[] = [];
  if (!set.id.trim()) {
    errors.push('id required');
  }
  if (!set.name.trim()) {
    errors.push('name required');
  }
  if (!Array.isArray(set.pieceItemIds)) {
    errors.push('pieceItemIds must be an array');
  }
  for (const bonus of set.bonuses ?? []) {
    if (!Number.isFinite(bonus.requiredPieces) || bonus.requiredPieces < 1) {
      errors.push(`bonus requiredPieces must be a positive integer`);
      break;
    }
    if (!Array.isArray(bonus.effects)) {
      errors.push('bonus.effects must be an array');
      break;
    }
    const pe = (bonus as { penaltyEffects?: unknown }).penaltyEffects;
    if (pe !== undefined && !Array.isArray(pe)) {
      errors.push('bonus.penaltyEffects must be an array when set');
      break;
    }
  }
  return errors;
}

export const itemSetsService = {
  async getAll(): Promise<ItemSet[]> {
    return getContentCollection<ItemSet>('itemSets');
  },

  async getById(id: string): Promise<ItemSet | null> {
    return getContentEntry<ItemSet>('itemSets', id);
  },

  async create(payload: ItemSet): Promise<ItemSet> {
    const next: ItemSet = {
      ...payload,
      id: payload.id?.trim() || uid('item_set'),
      pieceItemIds: Array.isArray(payload.pieceItemIds) ? payload.pieceItemIds : [],
      bonuses: Array.isArray(payload.bonuses) ? payload.bonuses : [],
      isEnabled: payload.isEnabled !== false,
      createdAt: payload.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    const err = validateItemSet(next);
    if (err.length > 0) {
      throw new Error(err.join(', '));
    }
    return createContentEntry<ItemSet>('itemSets', next);
  },

  async update(id: string, patch: Partial<ItemSet>): Promise<ItemSet> {
    const found = await this.getById(id);
    if (!found) {
      throw new Error(`Item set not found: ${id}`);
    }
    const merged: ItemSet = {
      ...found,
      ...patch,
      id: found.id,
      updatedAt: nowIso(),
    };
    const err = validateItemSet(merged);
    if (err.length > 0) {
      throw new Error(err.join(', '));
    }
    return updateContentEntry<ItemSet>('itemSets', id, merged);
  },

  async disable(id: string): Promise<ItemSet> {
    return this.update(id, { isEnabled: false });
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('itemSets', id);
  },
};
