"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPTY_EQUIPMENT = exports.RING_SLOTS = void 0;
exports.canEquipItem = canEquipItem;
exports.equipItem = equipItem;
exports.calculateEquipmentBonuses = calculateEquipmentBonuses;
exports.getStatsWithEquipment = getStatsWithEquipment;
const items_1 = require("./items");
exports.RING_SLOTS = ['ring1', 'ring2', 'ring3'];
exports.EMPTY_EQUIPMENT = {
    weapon: null,
    helmet: null,
    necklace: null,
    armor: null,
    outerwear: null,
    belt: null,
    ring1: null,
    ring2: null,
    ring3: null,
    legs: null,
    boots: null,
    gloves: null,
    shield: null,
};
const SLOT_BY_ITEM_TYPE = {
    weapon: 'weapon',
    helmet: 'helmet',
    necklace: 'necklace',
    armor: 'armor',
    outerwear: 'outerwear',
    belt: 'belt',
    legs: 'legs',
    boots: 'boots',
    gloves: 'gloves',
    shield: 'shield',
};
function isRingSlot(slot) {
    return slot === 'ring1' || slot === 'ring2' || slot === 'ring3';
}
function normalizeTargetSlot(itemId, equipment, preferredSlot) {
    const item = (0, items_1.getItemById)(itemId);
    if (item.itemType === 'weapon') {
        if ((0, items_1.getItemHandsRequired)(item) === 2) {
            return 'weapon';
        }
        return preferredSlot === 'shield' ? 'shield' : 'weapon';
    }
    if (item.itemType === 'shield') {
        return 'shield';
    }
    if (item.itemType === 'ring') {
        if (isRingSlot(preferredSlot)) {
            return preferredSlot;
        }
        return exports.RING_SLOTS.find((slot) => !equipment[slot]) ?? 'ring1';
    }
    return SLOT_BY_ITEM_TYPE[item.itemType];
}
function getEquipConflictReason(equipment, itemId, preferredSlot) {
    const item = (0, items_1.getItemById)(itemId);
    const targetSlot = normalizeTargetSlot(itemId, equipment, preferredSlot);
    if (!targetSlot) {
        return `Unsupported equipment slot for item type: ${item.itemType}`;
    }
    if (item.itemType === 'ring' && preferredSlot && !isRingSlot(preferredSlot)) {
        return 'Кольцо можно надеть только в один из слотов колец.';
    }
    if (item.itemType === 'weapon' && preferredSlot && preferredSlot !== 'weapon' && preferredSlot !== 'shield') {
        return 'Оружие можно надеть только в руку.';
    }
    if (item.itemType !== 'weapon' && item.itemType !== 'ring' && preferredSlot && preferredSlot !== targetSlot) {
        return 'Предмет нельзя надеть в выбранный слот.';
    }
    if (item.itemType === 'shield' && equipment.weapon) {
        const equippedWeapon = (0, items_1.getItemById)(equipment.weapon);
        if ((0, items_1.isTwoHandedItem)(equippedWeapon)) {
            return 'Левая рука занята двуручным оружием.';
        }
    }
    if (item.itemType === 'weapon' && targetSlot === 'shield' && equipment.weapon) {
        const equippedWeapon = (0, items_1.getItemById)(equipment.weapon);
        if ((0, items_1.isTwoHandedItem)(equippedWeapon)) {
            return 'Левая рука занята двуручным оружием.';
        }
    }
    return undefined;
}
function canEquipItem(baseStats, itemId, equipment, preferredSlot) {
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
        const conflictReason = getEquipConflictReason(equipment, itemId, preferredSlot);
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
    const conflictReason = getEquipConflictReason(equipment, itemId, preferredHand);
    if (conflictReason) {
        throw new Error(conflictReason);
    }
    const slot = normalizeTargetSlot(itemId, equipment, preferredHand);
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
    if (item.itemType === 'ring') {
        return {
            ...equipment,
            [slot]: itemId,
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
