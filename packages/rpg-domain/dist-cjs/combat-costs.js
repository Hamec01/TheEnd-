"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBAT_ACTION_COSTS = void 0;
exports.resolveCombatCommandCost = resolveCombatCommandCost;
exports.getMoveCostByDistance = getMoveCostByDistance;
exports.getStaminaFatigueMultiplier = getStaminaFatigueMultiplier;
exports.COMBAT_ACTION_COSTS = {
    move_1_cell: { ap: 1, stamina: 5 },
    move_2_cells: { ap: 1, stamina: 10 },
    dash_3_cells: { ap: 1, stamina: 15 },
    disengage: { ap: 1, stamina: 10 },
    basic_attack: { ap: 1, stamina: 10 },
    heavy_attack: { ap: 1, stamina: 18 },
    guard: { ap: 1, stamina: 8 },
    strong_guard: { ap: 1, stamina: 10 },
    weapon_swap: { ap: 1, stamina: 5 },
    use_self_item: { ap: 1, stamina: 3 },
    use_target_item: { ap: 1, stamina: 5 },
    throw_bomb: { ap: 1, stamina: 10 },
    place_trap: { ap: 1, stamina: 8 },
    cast_instant_skill: { ap: 1 },
    cast_heavy_skill: { ap: 1 },
    loot_adjacent: { ap: 1, stamina: 5 },
    start_retreat: { ap: 1, stamina: 5 },
    confirm_retreat: { ap: 1 },
    wait: { ap: 0 },
};
function sanitizePart(part) {
    const ap = Number(part?.ap ?? 0);
    const stamina = Number(part?.stamina ?? 0);
    const mp = Number(part?.mp ?? 0);
    const hp = Number(part?.hp ?? 0);
    return {
        ap: Number.isFinite(ap) ? Math.max(0, Math.round(ap)) : 0,
        stamina: Number.isFinite(stamina) ? Math.max(0, Math.round(stamina)) : 0,
        mp: Number.isFinite(mp) ? Math.max(0, Math.round(mp)) : 0,
        hp: Number.isFinite(hp) ? Math.max(0, Math.round(hp)) : 0,
    };
}
function safeMultiplier(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 1;
    }
    return Math.max(0, value);
}
function resolveCombatCommandCost(params) {
    const base = exports.COMBAT_ACTION_COSTS[params.baseCostKey];
    if (!base) {
        throw new Error('UNKNOWN_COST_KEY');
    }
    const basePart = sanitizePart(base);
    const source = sanitizePart(params.sourceCost);
    const flat = sanitizePart(params.flatModifiers);
    const staminaMultiplier = safeMultiplier(params.staminaMultiplier);
    const mpMultiplier = safeMultiplier(params.mpMultiplier);
    const hpMultiplier = safeMultiplier(params.hpMultiplier);
    const ap = Math.max(0, Math.round(basePart.ap + source.ap + flat.ap));
    const stamina = Math.max(0, Math.round((basePart.stamina + source.stamina + flat.stamina) * staminaMultiplier));
    const mp = Math.max(0, Math.round((basePart.mp + source.mp + flat.mp) * mpMultiplier));
    const hp = Math.max(0, Math.round((basePart.hp + source.hp + flat.hp) * hpMultiplier));
    return {
        ap,
        ...(stamina > 0 ? { stamina } : {}),
        ...(mp > 0 ? { mp } : {}),
        ...(hp > 0 ? { hp } : {}),
    };
}
function getMoveCostByDistance(distance) {
    if (!Number.isFinite(distance) || distance <= 0) {
        return exports.COMBAT_ACTION_COSTS.wait;
    }
    if (distance === 1) {
        return exports.COMBAT_ACTION_COSTS.move_1_cell;
    }
    if (distance === 2) {
        return exports.COMBAT_ACTION_COSTS.move_2_cells;
    }
    if (distance === 3) {
        return exports.COMBAT_ACTION_COSTS.dash_3_cells;
    }
    throw new Error('MOVE_DISTANCE_TOO_LONG');
}
function getStaminaFatigueMultiplier(_actor) {
    return 1;
}
