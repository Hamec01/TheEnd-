"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeItemUseCommand = normalizeItemUseCommand;
exports.resolveItemUse = resolveItemUse;
const items_1 = require("../items");
/**
 * Normalize item_use command: checks ownership, quantity, usability, and prepares command for execution.
 */
function normalizeItemUseCommand(params) {
    const { actor, battleState, itemId, itemInstanceId, target, quantity = 1 } = params;
    const item = (0, items_1.getItemById)(itemId);
    const errors = [];
    const warnings = [];
    // Ownership/quantity check (pseudo, real logic may differ)
    const inv = actor.inventory;
    const invItem = inv?.items?.find((it) => it.itemId === itemId && (!itemInstanceId || it.id === itemInstanceId));
    if (!invItem) {
        errors.push('ITEM_NOT_OWNED');
        return { ok: false, errors, message: 'Item not owned by actor.' };
    }
    if (invItem.quantity < quantity) {
        errors.push('ITEM_NOT_ENOUGH_QUANTITY');
        return { ok: false, errors, message: 'Not enough item quantity.' };
    }
    if (item.itemType !== 'consumable') {
        errors.push('ITEM_NOT_USABLE');
        return { ok: false, errors, message: 'Item is not usable in combat.' };
    }
    // TODO: Add more checks (cooldown, usability, etc.)
    // Build command
    const command = {
        id: `cmd_${Math.random().toString(36).slice(2, 10)}`,
        type: 'item_use',
        sourceSlotId: undefined,
        target,
        apCost: 1, // TODO: calculate real AP cost
        costs: {}, // TODO: calculate real resource costs if any
        payload: { itemId, itemInstanceId },
        createdAt: new Date().toISOString(),
    };
    return { ok: true, command, warnings };
}
/**
 * Resolve item_use: applies effects, reduces quantity, generates events.
 */
function resolveItemUse(params) {
    const { actor, battleState, command } = params;
    const events = [];
    const errors = [];
    const warnings = [];
    // TODO: Implement effect pipeline, quantity/charges reduction, event generation
    // For now, just a stub event
    events.push({
        type: 'item_used',
        actorId: actor.id,
        itemId: command.payload?.itemId,
        target: command.target,
        message: 'Item used (stub event)',
    });
    return { ok: true, events, warnings };
}
