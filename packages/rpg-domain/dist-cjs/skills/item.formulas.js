"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeItemUseCommand = normalizeItemUseCommand;
exports.resolveItemUse = resolveItemUse;
const items_1 = require("../items");
function toRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value;
}
function normalizeTarget(value) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw.includes('enemy')) {
        return 'enemy';
    }
    if (raw.includes('ally')) {
        return 'ally';
    }
    if (raw.includes('area')) {
        return 'area';
    }
    return 'self';
}
function normalizeItemEffects(item, itemData) {
    const record = toRecord(itemData);
    const sources = [];
    if (record) {
        if (Array.isArray(record.useEffects)) {
            sources.push(...record.useEffects);
        }
        sources.push(record.useEffect);
        if (Array.isArray(record.effects)) {
            sources.push(...record.effects);
        }
        if (Array.isArray(record.combatEffects)) {
            sources.push(...record.combatEffects);
        }
    }
    const out = [];
    for (const source of sources) {
        const effect = toRecord(source);
        if (!effect) {
            continue;
        }
        const rawType = String(effect.type ?? '').trim().toLowerCase();
        const amount = Math.max(0, Math.floor(Number(effect.amount ?? 0)));
        if (!rawType) {
            continue;
        }
        if (rawType === 'heal_hp' || rawType === 'heal' || rawType === 'restore_hp') {
            out.push({ type: 'heal_hp', amount, target: normalizeTarget(effect.target) });
            continue;
        }
        if (rawType === 'restore_mana' || rawType === 'heal_mana' || rawType === 'mana_restore') {
            out.push({ type: 'restore_mana', amount, target: normalizeTarget(effect.target) });
            continue;
        }
        if (rawType === 'restore_stamina' || rawType === 'heal_stamina' || rawType === 'stamina_restore') {
            out.push({ type: 'restore_stamina', amount, target: normalizeTarget(effect.target) });
            continue;
        }
        if (rawType === 'damage_target' || rawType === 'damage') {
            out.push({ type: 'damage_target', amount, target: normalizeTarget(effect.target) });
            continue;
        }
        if (rawType === 'apply_status') {
            out.push({
                type: 'apply_status',
                amount,
                target: normalizeTarget(effect.target),
                statusId: typeof effect.statusId === 'string' ? effect.statusId : undefined,
            });
            continue;
        }
        if (rawType === 'remove_status') {
            out.push({
                type: 'remove_status',
                amount,
                target: normalizeTarget(effect.target),
                statusId: typeof effect.statusId === 'string' ? effect.statusId : undefined,
            });
        }
    }
    if (out.length > 0) {
        return out;
    }
    const subType = String(item.itemSubType ?? '').trim().toLowerCase();
    if (subType === 'small_heal') {
        return [{ type: 'heal_hp', amount: 40, target: 'self' }];
    }
    if (subType === 'mana') {
        return [{ type: 'restore_mana', amount: 30, target: 'self' }];
    }
    if (subType === 'stamina') {
        return [{ type: 'restore_stamina', amount: 25, target: 'self' }];
    }
    return [];
}
function resolveTargets(params) {
    const { effect, actor, battleState, commandTarget } = params;
    if (effect.target === 'area' && commandTarget.kind === 'cell') {
        return battleState.entities.filter((entity) => {
            if (!entity.isAlive) {
                return false;
            }
            return entity.battlefieldX === commandTarget.x && entity.battlefieldY === commandTarget.y;
        });
    }
    if (commandTarget.kind === 'entity') {
        const target = battleState.entities.find((entity) => entity.id === commandTarget.entityId && entity.isAlive);
        if (target) {
            return [target];
        }
    }
    if (effect.target === 'enemy') {
        const enemy = battleState.entities.find((entity) => entity.id !== actor.id && entity.team !== actor.team && entity.isAlive);
        return enemy ? [enemy] : [];
    }
    if (effect.target === 'ally') {
        const ally = battleState.entities.find((entity) => entity.id !== actor.id && entity.team === actor.team && entity.isAlive);
        return ally ? [ally] : [actor];
    }
    return [actor];
}
/**
 * Normalize item_use command: checks ownership, quantity, usability, and prepares command for execution.
 */
function normalizeItemUseCommand(params) {
    const { actor, battleState, itemId, itemData, itemInstanceId, target, quantity = 1 } = params;
    const item = (0, items_1.getItemById)(itemId);
    const errors = [];
    const warnings = [];
    const effects = normalizeItemEffects(item, itemData);
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
    if (effects.length === 0) {
        errors.push('ITEM_NOT_USABLE');
        return { ok: false, errors, message: 'Item has no usable combat effects.' };
    }
    const commandCosts = toRecord(itemData);
    const costs = {
        stamina: Math.max(0, Math.floor(Number(commandCosts?.staminaCost ?? commandCosts?.stamina ?? 0))),
        mp: Math.max(0, Math.floor(Number(commandCosts?.manaCost ?? commandCosts?.mp ?? 0))),
        hp: Math.max(0, Math.floor(Number(commandCosts?.hpCost ?? commandCosts?.hp ?? 0))),
    };
    // Build command
    const command = {
        id: `cmd_${Math.random().toString(36).slice(2, 10)}`,
        type: 'item_use',
        sourceSlotId: undefined,
        target,
        apCost: 1,
        costs,
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
    const itemId = String(command.payload?.itemId ?? '').trim();
    if (!itemId) {
        errors.push('ITEM_ID_REQUIRED');
        return { ok: false, events, errors, warnings, message: 'Item id is required.' };
    }
    const item = params.item ?? (0, items_1.getItemById)(itemId);
    const effects = normalizeItemEffects(item, params.itemData);
    if (effects.length === 0) {
        errors.push('ITEM_NOT_USABLE');
        return { ok: false, events, errors, warnings, message: 'Item has no usable combat effects.' };
    }
    events.push({
        type: 'item_used',
        actorId: actor.id,
        itemId,
        message: `${actor.name} uses ${item.name}.`,
    });
    for (const effect of effects) {
        const targets = resolveTargets({
            effect,
            actor,
            battleState,
            commandTarget: command.target,
        });
        if (targets.length === 0) {
            events.push({
                type: 'item_effect_skipped',
                actorId: actor.id,
                itemId,
                effectType: effect.type,
                message: `${item.name}: no valid target for ${effect.type}.`,
            });
            continue;
        }
        for (const target of targets) {
            if (effect.type === 'heal_hp') {
                const healed = Math.max(0, Math.min(target.maxHp - target.currentHp, effect.amount));
                if (healed > 0) {
                    target.currentHp += healed;
                }
                events.push({
                    type: 'heal',
                    actorId: actor.id,
                    targetId: target.id,
                    itemId,
                    effectType: effect.type,
                    amount: healed,
                    message: `${actor.name} heals ${target.name} for ${healed}.`,
                });
                continue;
            }
            if (effect.type === 'restore_mana') {
                const restored = Math.max(0, Math.min(target.maxMp - target.currentMp, effect.amount));
                if (restored > 0) {
                    target.currentMp += restored;
                }
                events.push({
                    type: 'resource_restore',
                    actorId: actor.id,
                    targetId: target.id,
                    itemId,
                    effectType: effect.type,
                    amount: restored,
                    message: `${actor.name} restores ${restored} MP to ${target.name}.`,
                });
                continue;
            }
            if (effect.type === 'restore_stamina') {
                const restored = Math.max(0, Math.min(target.maxStamina - target.currentStamina, effect.amount));
                if (restored > 0) {
                    target.currentStamina += restored;
                }
                events.push({
                    type: 'resource_restore',
                    actorId: actor.id,
                    targetId: target.id,
                    itemId,
                    effectType: effect.type,
                    amount: restored,
                    message: `${actor.name} restores ${restored} stamina to ${target.name}.`,
                });
                continue;
            }
            if (effect.type === 'damage_target') {
                const damage = Math.max(0, effect.amount);
                target.currentHp = Math.max(0, target.currentHp - damage);
                target.isAlive = target.currentHp > 0;
                events.push({
                    type: 'damage',
                    actorId: actor.id,
                    targetId: target.id,
                    itemId,
                    effectType: effect.type,
                    amount: damage,
                    message: `${actor.name} hits ${target.name} for ${damage}.`,
                });
                continue;
            }
            if (effect.type === 'apply_status') {
                events.push({
                    type: 'status_applied',
                    actorId: actor.id,
                    targetId: target.id,
                    itemId,
                    effectType: effect.type,
                    message: `${actor.name} applies ${effect.statusId ?? 'status'} to ${target.name}.`,
                });
                continue;
            }
            if (effect.type === 'remove_status') {
                events.push({
                    type: 'status_removed',
                    actorId: actor.id,
                    targetId: target.id,
                    itemId,
                    effectType: effect.type,
                    message: `${actor.name} removes ${effect.statusId ?? 'status'} from ${target.name}.`,
                });
            }
        }
    }
    return { ok: true, events, warnings };
}
