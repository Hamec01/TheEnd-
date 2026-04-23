import { getItemById } from './items';
export const EMPTY_EQUIPMENT = {
    weapon: null,
    helmet: null,
    armor: null,
    boots: null,
    gloves: null,
    shield: null,
};
const SLOT_BY_ITEM_TYPE = {
    weapon: 'weapon',
    helmet: 'helmet',
    armor: 'armor',
    boots: 'boots',
    gloves: 'gloves',
    shield: 'shield',
};
export function canEquipItem(baseStats, itemId) {
    const item = getItemById(itemId);
    if (item.itemType === 'consumable') {
        return { ok: false, reason: 'Consumables cannot be equipped.' };
    }
    for (const [stat, required] of Object.entries(item.requiredStats)) {
        const current = baseStats[stat];
        if (required !== undefined && current < required) {
            return { ok: false, reason: `Недостаточно ${stat}: нужно ${required}` };
        }
    }
    return { ok: true };
}
export function equipItem(equipment, itemId) {
    const item = getItemById(itemId);
    if (item.itemType === 'consumable') {
        throw new Error('Consumables cannot be equipped.');
    }
    const slot = SLOT_BY_ITEM_TYPE[item.itemType];
    return {
        ...equipment,
        [slot]: itemId,
    };
}
export function calculateEquipmentBonuses(equipment) {
    const bonus = {};
    for (const itemId of Object.values(equipment)) {
        if (!itemId) {
            continue;
        }
        const item = getItemById(itemId);
        for (const [stat, value] of Object.entries(item.bonuses)) {
            const key = stat;
            bonus[key] = (bonus[key] ?? 0) + (value ?? 0);
        }
    }
    return bonus;
}
export function getStatsWithEquipment(baseStats, equipment) {
    const bonus = calculateEquipmentBonuses(equipment);
    const next = { ...baseStats };
    for (const [stat, value] of Object.entries(bonus)) {
        const key = stat;
        next[key] = (next[key] ?? 0) + (value ?? 0);
    }
    return next;
}
