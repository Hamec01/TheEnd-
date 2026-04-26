import { nowIso, readCollection, uid, writeCollection } from './storage';
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
        return readCollection('materials');
    },
    async getById(id) {
        const all = await this.getAll();
        return all.find((entry) => entry.id === id) ?? null;
    },
    async create(payload) {
        const all = await this.getAll();
        const next = {
            ...payload,
            id: payload.id?.trim() || uid('material'),
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        writeCollection('materials', [...all, next]);
        return next;
    },
    async update(id, patch) {
        const all = await this.getAll();
        const found = all.find((entry) => entry.id === id);
        if (!found) {
            throw new Error(`Material not found: ${id}`);
        }
        const merged = {
            ...found,
            ...patch,
            id: found.id,
            updatedAt: nowIso(),
        };
        writeCollection('materials', all.map((entry) => (entry.id === id ? merged : entry)));
        return merged;
    },
    async disable(id) {
        return this.update(id, { isEnabled: false });
    },
    async delete(id) {
        const all = await this.getAll();
        writeCollection('materials', all.filter((entry) => entry.id !== id));
    },
};
