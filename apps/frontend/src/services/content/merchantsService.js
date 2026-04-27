import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { nowIso, uid } from './storage';
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
        return getContentCollection('merchants');
    },
    async getById(id) {
        return getContentEntry('merchants', id);
    },
    async create(payload) {
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
        return createContentEntry('merchants', nextEntry);
    },
    async update(id, patch) {
        const found = await this.getById(id);
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
        return updateContentEntry('merchants', id, merged);
    },
    async disable(id) {
        return this.update(id, { isEnabled: false });
    },
    async delete(id) {
        await deleteContentEntry('merchants', id);
    },
};
