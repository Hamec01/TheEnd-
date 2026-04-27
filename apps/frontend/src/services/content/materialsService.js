import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { nowIso, uid } from './storage';
export function validateMaterial(material) {
    const errors = [];
    if (!material.id.trim()) {
        errors.push('id is required');
    }
    if (!material.name.trim()) {
        errors.push('name is required');
    }
    if (!material.region.trim()) {
        errors.push('region is required');
    }
    return errors;
}
export const materialsService = {
    async getAll() {
        return getContentCollection('materials');
    },
    async getById(id) {
        return getContentEntry('materials', id);
    },
    async create(payload) {
        const next = {
            ...payload,
            id: payload.id?.trim() || uid('material'),
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        return createContentEntry('materials', next);
    },
    async update(id, patch) {
        const found = await this.getById(id);
        if (!found) {
            throw new Error(`Material not found: ${id}`);
        }
        const merged = {
            ...found,
            ...patch,
            id: found.id,
            updatedAt: nowIso(),
        };
        return updateContentEntry('materials', id, merged);
    },
    async disable(id) {
        return this.update(id, { isEnabled: false });
    },
    async delete(id) {
        await deleteContentEntry('materials', id);
    },
};
