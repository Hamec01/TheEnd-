"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPTY_EQUIPMENT = void 0;
exports.canEquipItem = canEquipItem;
exports.equipItem = equipItem;
exports.calculateEquipmentBonuses = calculateEquipmentBonuses;
exports.getStatsWithEquipment = getStatsWithEquipment;
const items_1 = require("./items");
exports.EMPTY_EQUIPMENT = {
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
function getEquipConflictReason(equipment, itemId) {
    const item = (0, items_1.getItemById)(itemId);
    if (item.itemType === 'shield' && equipment.weapon) {
        const equippedWeapon = (0, items_1.getItemById)(equipment.weapon);
        if ((0, items_1.isTwoHandedItem)(equippedWeapon)) {
            return 'Левая рука занята двуручным оружием.';
        }
    }
    return undefined;
}
function normalizeHandSlot(itemId, preferredHand) {
    const item = (0, items_1.getItemById)(itemId);
    if (item.itemType === 'weapon') {
        if ((0, items_1.getItemHandsRequired)(item) === 2) {
            return 'weapon';
        }
        return preferredHand ?? 'weapon';
    }
    if (item.itemType === 'shield') {
        return 'shield';
    }
    return undefined;
}
function canEquipItem(baseStats, itemId, equipment, preferredHand) {
    const item = (0, items_1.getItemById)(itemId);
    if (item.itemType === 'consumable') {
        return { ok: false, reason: 'Consumables cannot be equipped.' };
    }
    for (const [stat, required] of Object.entries(item.requiredStats)) {
        const current = baseStats[stat];
        if (required !== undefined && current < required) {
            return { ok: false, reason: `Недостаточно ${stat}: нужно ${required}` };
        }
    }
    if (equipment) {
        if (item.itemType === 'weapon' && (0, items_1.getItemHandsRequired)(item) === 1 && preferredHand === 'shield' && equipment.weapon) {
            const equippedWeapon = (0, items_1.getItemById)(equipment.weapon);
            if ((0, items_1.isTwoHandedItem)(equippedWeapon)) {
                return { ok: false, reason: 'Левая рука занята двуручным оружием.' };
            }
        }
        const conflictReason = getEquipConflictReason(equipment, itemId);
        if (conflictReason) {
            return { ok: false, reason: conflictReason };
        }
    }
    return { ok: true };
}
function equipItem(equipment, itemId, preferredHand) {
    const item = (0, items_1.getItemById)(itemId);
    if (item.itemType === 'consumable') {
        throw new Error('Consumables cannot be equipped.');
    }
    const conflictReason = getEquipConflictReason(equipment, itemId);
    if (conflictReason) {
        throw new Error(conflictReason);
    }
    const handSlot = normalizeHandSlot(itemId, preferredHand);
    const slot = handSlot ?? SLOT_BY_ITEM_TYPE[item.itemType];
    if (!slot) {
        throw new Error(`Unsupported equipment slot for item type: ${item.itemType}`);
    }
    if (item.itemType === 'weapon' && (0, items_1.getItemHandsRequired)(item) === 2) {
        return {
            ...equipment,
            weapon: itemId,
            shield: null,
        };
    }
    return {
        ...equipment,
        [slot]: itemId,
    };
}
function calculateEquipmentBonuses(equipment) {
    const bonus = {};
    for (const itemId of Object.values(equipment)) {
        if (!itemId) {
            continue;
        }
        const item = (0, items_1.getItemById)(itemId);
        for (const [stat, value] of Object.entries(item.bonuses)) {
            const key = stat;
            bonus[key] = (bonus[key] ?? 0) + (value ?? 0);
        }
    }
    return bonus;
}
function getStatsWithEquipment(baseStats, equipment) {
    const bonus = calculateEquipmentBonuses(equipment);
    const next = { ...baseStats };
    for (const [stat, value] of Object.entries(bonus)) {
        const key = stat;
        next[key] = (next[key] ?? 0) + (value ?? 0);
    }
    return next;
}
