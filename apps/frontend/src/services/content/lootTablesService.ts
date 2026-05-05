import type { LootTable } from './models';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { nowIso, uid } from './storage';

export function validateLootTable(table: LootTable): string[] {
  const errors: string[] = [];
  for (const entry of table.entries) {
    if (entry.chance < 0 || entry.chance > 1) {
      errors.push(`entry ${entry.itemId}: chance must be between 0 and 1`);
    }
    if (entry.minQuantity < 1) {
      errors.push(`entry ${entry.itemId}: minQuantity must be >= 1`);
    }
    if (entry.maxQuantity < entry.minQuantity) {
      errors.push(`entry ${entry.itemId}: maxQuantity must be >= minQuantity`);
    }
  }
  return errors;
}

export const lootTablesService = {
  async getAll(): Promise<LootTable[]> {
    return getContentCollection<LootTable>('lootTables');
  },

  async getById(id: string): Promise<LootTable | null> {
    return getContentEntry<LootTable>('lootTables', id);
  },

  async create(payload: Omit<LootTable, 'createdAt' | 'updatedAt'>): Promise<LootTable> {
    const next: LootTable = {
      ...payload,
      id: payload.id?.trim() || uid('loot'),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const errors = validateLootTable(next);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return createContentEntry<LootTable>('lootTables', next);
  },

  async update(id: string, patch: Partial<LootTable>): Promise<LootTable> {
    const found = await this.getById(id);
    if (!found) {
      throw new Error(`Loot table not found: ${id}`);
    }
    const merged: LootTable = {
      ...found,
      ...patch,
      id: found.id,
      updatedAt: nowIso(),
    };
    const errors = validateLootTable(merged);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return updateContentEntry<LootTable>('lootTables', id, merged);
  },

  async rename(oldId: string, nextId: string, payload: LootTable): Promise<LootTable> {
    const fromId = oldId.trim();
    const toId = nextId.trim();
    if (!fromId || !toId) {
      throw new Error('Loot table id is required.');
    }
    if (fromId === toId) {
      return this.update(fromId, payload);
    }

    const existing = await this.getById(toId);
    if (existing) {
      throw new Error(`Duplicate loot table id: ${toId}`);
    }

    const normalized: LootTable = { ...payload, id: toId, updatedAt: nowIso() };
    const errors = validateLootTable(normalized);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    const created = await this.create(normalized);
    await this.delete(fromId);
    return created;
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('lootTables', id);
  },
};
