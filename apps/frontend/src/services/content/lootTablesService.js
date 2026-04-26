import { nowIso, readCollection, uid, writeCollection } from './storage';
export function validateLootTable(table) {
    const errors = [];
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
    async getAll() {
        return readCollection('lootTables');
    },
    async getById(id) {
        const all = await this.getAll();
        return all.find((entry) => entry.id === id) ?? null;
    },
    async create(payload) {
        const all = await this.getAll();
        const next = {
            ...payload,
            id: payload.id?.trim() || uid('loot'),
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        const errors = validateLootTable(next);
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
        writeCollection('lootTables', [...all, next]);
        return next;
    },
    async update(id, patch) {
        const all = await this.getAll();
        const found = all.find((entry) => entry.id === id);
        if (!found) {
            throw new Error(`Loot table not found: ${id}`);
        }
        const merged = {
            ...found,
            ...patch,
            id: found.id,
            updatedAt: nowIso(),
        };
        const errors = validateLootTable(merged);
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
        writeCollection('lootTables', all.map((entry) => (entry.id === id ? merged : entry)));
        return merged;
    },
    async delete(id) {
        const all = await this.getAll();
        writeCollection('lootTables', all.filter((entry) => entry.id !== id));
    },
};
