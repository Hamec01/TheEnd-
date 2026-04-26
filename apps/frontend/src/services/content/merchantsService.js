import { nowIso, readCollection, uid, writeCollection } from './storage';
export function validateMerchant(merchant) {
    const errors = [];
    if (!merchant.id.trim()) {
        errors.push('id required');
    }
    if (!merchant.name.trim()) {
        errors.push('name required');
    }
    if (!merchant.city.trim()) {
        errors.push('city required');
    }
    if (!(merchant.priceMultiplier > 0)) {
        errors.push('priceMultiplier must be > 0');
    }
    return errors;
}
export const merchantsService = {
    async getAll() {
        return readCollection('merchants');
    },
    async getById(id) {
        const all = await this.getAll();
        return all.find((entry) => entry.id === id) ?? null;
    },
    async create(payload) {
        const all = await this.getAll();
        const nextEntry = {
            ...payload,
            id: payload.id?.trim() || uid('merchant'),
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        const errors = validateMerchant(nextEntry);
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
        if (all.some((entry) => entry.id === nextEntry.id)) {
            throw new Error(`Duplicate merchant id: ${nextEntry.id}`);
        }
        writeCollection('merchants', [...all, nextEntry]);
        return nextEntry;
    },
    async update(id, patch) {
        const all = await this.getAll();
        const found = all.find((entry) => entry.id === id);
        if (!found) {
            throw new Error(`Merchant not found: ${id}`);
        }
        const merged = {
            ...found,
            ...patch,
            id: found.id,
            updatedAt: nowIso(),
        };
        const errors = validateMerchant(merged);
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
        writeCollection('merchants', all.map((entry) => (entry.id === id ? merged : entry)));
        return merged;
    },
    async disable(id) {
        return this.update(id, { isEnabled: false });
    },
    async delete(id) {
        const all = await this.getAll();
        writeCollection('merchants', all.filter((entry) => entry.id !== id));
    },
};
