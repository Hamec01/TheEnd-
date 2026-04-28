"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STARTING_FREE_POINTS = exports.RESOURCE_STATS = exports.PRIMARY_STATS = void 0;
exports.getAllocationCost = getAllocationCost;
exports.validateAllocation = validateAllocation;
exports.applyAllocation = applyAllocation;
exports.PRIMARY_STATS = [
    'hp',
    'mp',
    'stamina',
    'strength',
    'constitution',
    'dexterity',
    'intelligence',
    'luck',
    'perception',
    'willpower',
];
exports.RESOURCE_STATS = ['hp', 'mp', 'stamina'];
exports.STARTING_FREE_POINTS = 5;
function getAllocationCost(allocation) {
    return Object.values(allocation).reduce((sum, value) => sum + Math.max(0, value ?? 0), 0);
}
function validateAllocation(allocation, freePoints = exports.STARTING_FREE_POINTS) {
    const values = Object.values(allocation);
    const hasNegative = values.some((value) => (value ?? 0) < 0);
    if (hasNegative) {
        throw new Error('Allocation values cannot be negative.');
    }
    const cost = getAllocationCost(allocation);
    if (cost > freePoints) {
        throw new Error(`Allocation exceeds available points (${freePoints}).`);
    }
}
function applyAllocation(base, allocation) {
    validateAllocation(allocation);
    const next = { ...base };
    for (const stat of exports.PRIMARY_STATS) {
        const points = allocation[stat] ?? 0;
        if (points <= 0) {
            continue;
        }
        if (stat === 'hp' || stat === 'mp' || stat === 'stamina') {
            next[stat] += points * 10;
        }
        else {
            next[stat] += points;
        }
    }
    return next;
}
