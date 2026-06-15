"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBAT_COMMAND_PRIORITY = exports.HARD_MAX_AP_PER_ROUND = exports.DEFAULT_MAX_AP_PER_ROUND = exports.HARD_MAX_COMMANDS_PER_ROUND = exports.DEFAULT_MAX_COMMANDS_PER_ROUND = void 0;
exports.getRelationToCaster = getRelationToCaster;
exports.collectAreaEffectTargets = collectAreaEffectTargets;
exports.getAllowedTargetKindsForCommand = getAllowedTargetKindsForCommand;
exports.getCombatCommandBaseCost = getCombatCommandBaseCost;
exports.normalizeCombatCommand = normalizeCombatCommand;
exports.validateCombatCommand = validateCombatCommand;
exports.getCombatRoundLimits = getCombatRoundLimits;
exports.getCombatPlanCostTotal = getCombatPlanCostTotal;
exports.validateCombatTurnPlan = validateCombatTurnPlan;
exports.canAppendCombatCommand = canAppendCombatCommand;
exports.createCombatCommandFromType = createCombatCommandFromType;
exports.revalidateCombatCommandBeforeExecute = revalidateCombatCommandBeforeExecute;
exports.calculateCommandInitiative = calculateCommandInitiative;
const combat_status_sync_1 = require("./combat-status-sync");
const combat_costs_1 = require("./combat-costs");
exports.DEFAULT_MAX_COMMANDS_PER_ROUND = 3;
exports.HARD_MAX_COMMANDS_PER_ROUND = 4;
exports.DEFAULT_MAX_AP_PER_ROUND = 3;
exports.HARD_MAX_AP_PER_ROUND = 4;
const COMMAND_ALLOWED_TARGETS = {
    move: ['cell'],
    dash: ['cell'],
    disengage: ['cell'],
    basic_attack: ['entity'],
    heavy_attack: ['entity'],
    guard: ['self'],
    strong_guard: ['self'],
    skill_cast: ['self', 'entity', 'cell'],
    item_use: ['self', 'entity', 'cell'],
    weapon_swap: ['self'],
    place_trap: ['cell'],
    loot: ['cell', 'entity'],
    pickup_objective_marker: ['cell'],
    evacuate_objective_marker: ['cell'],
    start_retreat: ['self'],
    confirm_retreat: ['self'],
    wait: ['self'],
};
exports.COMBAT_COMMAND_PRIORITY = {
    wait: 20,
    guard: 15,
    strong_guard: 15,
    disengage: 10,
    move: 5,
    dash: 5,
    place_trap: 5,
    weapon_swap: 0,
    basic_attack: 0,
    item_use: 0,
    skill_cast: 0,
    pickup_objective_marker: 0,
    evacuate_objective_marker: 0,
    heavy_attack: -5,
    throw_bomb: -5,
    start_retreat: -10,
    confirm_retreat: -10,
    loot: -20,
};
function toSafeNonNegativeInt(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.round(value));
}
function getEntityCell(entity) {
    return {
        x: entity.battlefieldX ?? 0,
        y: entity.battlefieldY ?? 0,
    };
}
function getCellDistance(left, right) {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}
function getRelationToCaster(params) {
    const caster = params.battleState.entities.find((entity) => entity.id === params.casterId);
    const target = params.battleState.entities.find((entity) => entity.id === params.targetId);
    if (!caster || !target) {
        return 'neutral';
    }
    if (caster.id === target.id) {
        return 'self';
    }
    const casterTeam = caster.team;
    const targetTeam = target.team;
    if (!casterTeam || !targetTeam) {
        return 'neutral';
    }
    return casterTeam === targetTeam ? 'ally' : 'enemy';
}
function collectAreaEffectTargets(params) {
    const radius = Math.max(0, Math.floor(params.radius ?? 0));
    const shape = params.shape ?? 'circle';
    const isInsideArea = (cell) => {
        const dx = Math.abs(cell.x - params.originCell.x);
        const dy = Math.abs(cell.y - params.originCell.y);
        if (shape === 'square') {
            return Math.max(dx, dy) <= radius;
        }
        // P0 uses grid-Manhattan radius for area preview/targeting.
        return dx + dy <= radius;
    };
    return params.battleState.entities
        .filter((entity) => entity.isAlive)
        .map((entity) => ({ entity, cell: getEntityCell(entity) }))
        .filter((entry) => isInsideArea(entry.cell))
        .map((entry) => ({
        entityId: entry.entity.id,
        relationToCaster: getRelationToCaster({
            battleState: params.battleState,
            casterId: params.casterId,
            targetId: entry.entity.id,
        }),
        cell: entry.cell,
    }));
}
function buildFriendlyFireWarnings(params) {
    if (params.command.target.kind !== 'cell' || !isPotentiallyHarmfulAreaCommand(params.command)) {
        return [];
    }
    const radius = getCellCommandRadius(params.command);
    const targets = collectAreaEffectTargets({
        battleState: params.battleState,
        originCell: { x: params.command.target.x, y: params.command.target.y },
        radius,
        shape: 'circle',
        casterId: params.casterId,
    });
    const allyIds = targets.filter((target) => target.relationToCaster === 'ally').map((target) => target.entityId);
    const selfIds = targets.filter((target) => target.relationToCaster === 'self').map((target) => target.entityId);
    const neutralIds = targets.filter((target) => target.relationToCaster === 'neutral').map((target) => target.entityId);
    const warnings = [];
    if (targets.length > 0) {
        warnings.push({
            code: 'AREA_TARGETS_MAY_CHANGE',
            commandId: params.command.id,
            entityIds: targets.map((target) => target.entityId),
            message: 'Текущая зона действия является preview. Реальные цели будут пересчитаны при выполнении.',
        });
    }
    if (allyIds.length > 0 || selfIds.length > 0 || neutralIds.length > 0) {
        warnings.push({
            code: 'FRIENDLY_FIRE',
            commandId: params.command.id,
            entityIds: [...allyIds, ...selfIds, ...neutralIds],
            message: 'Действие заденет не только врагов.',
        });
    }
    if (allyIds.length > 0) {
        warnings.push({
            code: 'ALLY_IN_AREA',
            commandId: params.command.id,
            entityIds: allyIds,
            message: 'Действие заденет союзника.',
        });
    }
    if (selfIds.length > 0) {
        warnings.push({
            code: 'SELF_IN_AREA',
            commandId: params.command.id,
            entityIds: selfIds,
            message: 'Вы тоже попадете в область действия.',
        });
    }
    if (neutralIds.length > 0) {
        warnings.push({
            code: 'NEUTRAL_IN_AREA',
            commandId: params.command.id,
            entityIds: neutralIds,
            message: 'Действие заденет нейтральную цель.',
        });
    }
    return warnings;
}
function isTileSightBlockedForRevalidation(state, x, y) {
    const tile = state.battlefieldTiles.find((entry) => entry.x === x && entry.y === y);
    if (tile?.blocksLineOfSight !== undefined) {
        return tile.blocksLineOfSight;
    }
    const tileType = tile?.type;
    return tileType === 'blocked' || tileType === 'highCover' || tileType === 'summon';
}
function hasLineOfSightForRevalidation(state, from, to) {
    const points = [];
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const sx = from.x < to.x ? 1 : -1;
    const sy = from.y < to.y ? 1 : -1;
    let err = dx - dy;
    let x = from.x;
    let y = from.y;
    while (true) {
        points.push({ x, y });
        if (x === to.x && y === to.y) {
            break;
        }
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }
    for (let i = 1; i < points.length - 1; i += 1) {
        if (isTileSightBlockedForRevalidation(state, points[i].x, points[i].y)) {
            return false;
        }
    }
    return true;
}
function isTileMovementBlockedForRevalidation(state, x, y) {
    const tile = state.battlefieldTiles.find((entry) => entry.x === x && entry.y === y);
    if (tile?.blocksMovement !== undefined) {
        return tile.blocksMovement;
    }
    const tileType = tile?.type;
    return tileType === 'blocked' || tileType === 'highCover' || tileType === 'summon';
}
function getEntityAttackRange(actor) {
    const maxRange = Math.max(1, Number.isFinite(actor.attackRange) ? Math.floor(actor.attackRange ?? 1) : 1);
    const dynamicActor = actor;
    const minRangeRaw = dynamicActor.minAttackRange ?? dynamicActor.minimumAttackRange;
    const minRange = Math.max(1, typeof minRangeRaw === 'number' && Number.isFinite(minRangeRaw) ? Math.floor(minRangeRaw) : 1);
    return { minRange, maxRange };
}
function isPotentiallyHarmfulAreaCommand(command) {
    if (command.target.kind !== 'cell') {
        return false;
    }
    if (command.type === 'place_trap') {
        return true;
    }
    if (command.type === 'skill_cast' || command.type === 'item_use') {
        return true;
    }
    return false;
}
function getCellCommandRadius(command) {
    const payload = command.payload;
    const raw = payload?.radius ?? payload?.splashRadius;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.max(0, Math.floor(raw));
    }
    if (command.type === 'item_use') {
        return 1;
    }
    if (command.type === 'skill_cast') {
        return 1;
    }
    return 0;
}
function getBaseCostKey(command) {
    let key;
    switch (command.type) {
        case 'move':
            key = command.payload?.movementType === 'dash'
                ? 'dash_3_cells'
                : command.payload?.movementType === 'disengage'
                    ? 'disengage'
                    : 'move_1_cell';
            break;
        case 'dash':
            key = 'dash_3_cells';
            break;
        case 'disengage':
            key = 'disengage';
            break;
        case 'basic_attack':
            key = 'basic_attack';
            break;
        case 'heavy_attack':
            key = 'heavy_attack';
            break;
        case 'guard':
            key = 'guard';
            break;
        case 'strong_guard':
            key = 'strong_guard';
            break;
        case 'skill_cast':
            key = 'cast_instant_skill';
            break;
        case 'item_use':
            key = 'use_target_item';
            break;
        case 'weapon_swap':
            key = 'weapon_swap';
            break;
        case 'place_trap':
            key = 'place_trap';
            break;
        case 'loot':
            key = 'loot_adjacent';
            break;
        case 'pickup_objective_marker':
        case 'evacuate_objective_marker':
            key = 'loot_adjacent';
            break;
        case 'start_retreat':
            key = 'start_retreat';
            break;
        case 'confirm_retreat':
            key = 'confirm_retreat';
            break;
        case 'wait':
        default:
            key = 'wait';
            break;
    }
    return key;
}
function getAllowedTargetKindsForCommand(type) {
    return [...(COMMAND_ALLOWED_TARGETS[type] ?? [])];
}
function getCombatCommandBaseCost(command) {
    const key = getBaseCostKey(command);
    const resolved = (0, combat_costs_1.resolveCombatCommandCost)({ baseCostKey: key });
    const stamina = toSafeNonNegativeInt(resolved.stamina);
    const mp = toSafeNonNegativeInt(resolved.mp);
    const hp = toSafeNonNegativeInt(resolved.hp);
    return {
        apCost: toSafeNonNegativeInt(resolved.ap),
        costs: {
            ...(stamina > 0 ? { stamina } : {}),
            ...(mp > 0 ? { mp } : {}),
            ...(hp > 0 ? { hp } : {}),
        },
    };
}
function normalizeCommandPayload(command) {
    const payload = command.payload ?? {};
    switch (command.type) {
        case 'skill_cast':
            return payload.skillId
                ? {
                    skillId: payload.skillId,
                    ...(typeof payload.skillRange === 'number' && Number.isFinite(payload.skillRange)
                        ? { skillRange: Math.max(0, Math.floor(payload.skillRange)) }
                        : {}),
                    targetZone: payload.targetZone,
                }
                : undefined;
        case 'item_use':
            return {
                ...(payload.itemId ? { itemId: payload.itemId } : {}),
                ...(payload.itemInstanceId ? { itemInstanceId: payload.itemInstanceId } : {}),
                ...(payload.targetZone ? { targetZone: payload.targetZone } : {}),
            };
        case 'weapon_swap':
            return {
                ...(payload.weaponItemId ? { weaponItemId: payload.weaponItemId } : {}),
                ...(payload.weaponInstanceId ? { weaponInstanceId: payload.weaponInstanceId } : {}),
            };
        case 'place_trap':
            return {
                ...(payload.trapItemId ? { trapItemId: payload.trapItemId } : {}),
                ...(payload.trapItemInstanceId ? { trapItemInstanceId: payload.trapItemInstanceId } : {}),
            };
        case 'loot':
            return payload.lootContainerId ? { lootContainerId: payload.lootContainerId } : undefined;
        case 'pickup_objective_marker':
            return payload.markerId
                ? {
                    markerId: payload.markerId,
                    ...(payload.objectiveId ? { objectiveId: payload.objectiveId } : {}),
                }
                : undefined;
        case 'evacuate_objective_marker':
            return payload.extractionZoneId
                ? {
                    extractionZoneId: payload.extractionZoneId,
                    ...(payload.markerId ? { markerId: payload.markerId } : {}),
                    ...(payload.objectiveId ? { objectiveId: payload.objectiveId } : {}),
                }
                : undefined;
        case 'move':
        case 'dash':
        case 'disengage':
            return {
                movementType: command.type === 'dash' ? 'dash' : command.type === 'disengage' ? 'disengage' : 'walk',
            };
        case 'basic_attack':
        case 'heavy_attack':
            return payload.targetZone ? { targetZone: payload.targetZone } : undefined;
        default:
            return undefined;
    }
}
function normalizeCombatCommand(params) {
    const type = params.rawCommand.type;
    if (!getAllowedTargetKindsForCommand(type).includes(params.rawCommand.target.kind)) {
        throw new Error('INVALID_TARGET');
    }
    const normalizedTarget = params.rawCommand.target.kind === 'cell'
        ? {
            kind: 'cell',
            x: toSafeNonNegativeInt(params.rawCommand.target.x),
            y: toSafeNonNegativeInt(params.rawCommand.target.y),
        }
        : params.rawCommand.target.kind === 'entity'
            ? { kind: 'entity', entityId: String(params.rawCommand.target.entityId ?? '').trim() }
            : { kind: 'self' };
    const baseCost = getCombatCommandBaseCost(params.rawCommand);
    return {
        id: String(params.rawCommand.id ?? '').trim() || `cmd_${Math.random().toString(36).slice(2, 10)}`,
        type,
        sourceSlotId: params.rawCommand.sourceSlotId,
        target: normalizedTarget,
        apCost: baseCost.apCost,
        costs: baseCost.costs,
        payload: normalizeCommandPayload({ ...params.rawCommand, target: normalizedTarget }),
        createdAt: params.rawCommand.createdAt ?? new Date().toISOString(),
    };
}
function collectWarnings(actor, total, errors) {
    const warnings = [];
    if (!errors.includes('NOT_ENOUGH_STAMINA') && actor.currentStamina - total.stamina <= Math.max(10, Math.floor(actor.maxStamina * 0.15))) {
        warnings.push('LOW_STAMINA_AFTER_ACTION');
    }
    if (!errors.includes('NOT_ENOUGH_HP') && total.hp > 0 && actor.currentHp - total.hp <= Math.max(5, Math.floor(actor.maxHp * 0.15))) {
        warnings.push('LOW_HP_AFTER_HP_COST');
    }
    return warnings;
}
function validateCombatCommand(params) {
    const errors = [];
    const warningDetails = [];
    if (!getAllowedTargetKindsForCommand(params.command.type).includes(params.command.target.kind)) {
        errors.push('INVALID_TARGET');
    }
    if (!params.actor.isAlive) {
        errors.push('ACTOR_DEAD');
    }
    const actorFlags = params.actor;
    if (actorFlags.isStunned || actorFlags.isIncapacitated) {
        errors.push('ACTOR_STUNNED');
    }
    if ((params.command.type === 'move' || params.command.type === 'dash' || params.command.type === 'disengage') && actorFlags.isRooted) {
        errors.push('INVALID_TARGET');
    }
    if ((params.command.type === 'basic_attack' || params.command.type === 'heavy_attack') && actorFlags.isDisarmed) {
        errors.push('ITEM_NOT_USABLE');
    }
    if (params.command.type === 'weapon_swap' && actorFlags.isDisarmed) {
        errors.push('ITEM_NOT_USABLE');
    }
    if (params.command.target.kind === 'entity') {
        const entityTarget = params.command.target;
        const target = params.battleState.entities.find((entity) => entity.id === entityTarget.entityId);
        if (!target) {
            errors.push('TARGET_NOT_FOUND');
        }
        else if (!target.isAlive) {
            errors.push('TARGET_DEAD');
        }
    }
    if (params.command.target.kind === 'cell') {
        const { x, y } = params.command.target;
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= params.battleState.battleMapWidth || y >= params.battleState.battleMapHeight) {
            errors.push('INVALID_TARGET');
        }
    }
    if (params.command.type === 'skill_cast' && !params.command.payload?.skillId) {
        errors.push('SKILL_ID_REQUIRED');
    }
    if (params.command.type === 'item_use' && !params.command.payload?.itemId && !params.command.payload?.itemInstanceId) {
        errors.push('ITEM_ID_REQUIRED');
    }
    if (params.command.type === 'weapon_swap' && !params.command.payload?.weaponItemId && !params.command.payload?.weaponInstanceId) {
        errors.push('WEAPON_ID_REQUIRED');
    }
    if (params.command.type === 'pickup_objective_marker' && !params.command.payload?.markerId) {
        errors.push('INVALID_TARGET');
    }
    if (params.command.type === 'evacuate_objective_marker' && !params.command.payload?.extractionZoneId) {
        errors.push('INVALID_TARGET');
    }
    const warnings = [];
    if (params.command.type === 'basic_attack' || params.command.type === 'heavy_attack') {
        warnings.push('ACTION_MAY_FAIL_IF_TARGET_MOVES');
    }
    if (isPotentiallyHarmfulAreaCommand(params.command) && params.command.target.kind === 'cell') {
        const areaWarnings = buildFriendlyFireWarnings({
            battleState: params.battleState,
            casterId: params.actor.id,
            command: params.command,
        });
        for (const warning of areaWarnings) {
            warnings.push(warning.code);
            warningDetails.push(warning);
        }
    }
    if (params.command.type === 'start_retreat') {
        warnings.push('ESCAPE_CAN_BE_INTERRUPTED');
    }
    return {
        ok: errors.length === 0,
        errors: [...new Set(errors)],
        ...(warnings.length > 0 ? { warnings: [...new Set(warnings)] } : {}),
        ...(warningDetails.length > 0 ? { warningDetails } : {}),
    };
}
function getCombatRoundLimits(actor) {
    const dynamic = actor;
    const isHighTier = Boolean(dynamic.isBoss
        || dynamic.isElite
        || dynamic.isTest
        || dynamic.isDebug
        || String(dynamic.powerTier ?? '').trim().toLowerCase() === 'boss'
        || String(dynamic.powerTier ?? '').trim().toLowerCase() === 'elite'
        || String(dynamic.aiPersonality ?? '').trim().toLowerCase() === 'boss');
    return {
        maxCommands: isHighTier ? exports.HARD_MAX_COMMANDS_PER_ROUND : exports.DEFAULT_MAX_COMMANDS_PER_ROUND,
        maxAP: isHighTier ? exports.HARD_MAX_AP_PER_ROUND : exports.DEFAULT_MAX_AP_PER_ROUND,
    };
}
function getCombatPlanCostTotal(commands) {
    return (commands ?? []).reduce((total, command) => ({
        commands: total.commands + 1,
        ap: total.ap + toSafeNonNegativeInt(command.apCost),
        stamina: total.stamina + toSafeNonNegativeInt(command.costs?.stamina),
        mp: total.mp + toSafeNonNegativeInt(command.costs?.mp),
        hp: total.hp + toSafeNonNegativeInt(command.costs?.hp),
    }), { commands: 0, ap: 0, stamina: 0, mp: 0, hp: 0 });
}
function validateCombatTurnPlan(params) {
    const errors = [];
    const commandWarnings = [];
    const warningDetails = [];
    const limits = params.limits ?? getCombatRoundLimits(params.actor);
    const commands = params.plan.commands ?? [];
    const total = getCombatPlanCostTotal(commands);
    if (params.battleState.roundPhase === 'RESOLVING' || params.battleState.isFinished) {
        errors.push('BATTLE_NOT_PLANNING');
    }
    if (params.plan.battleId !== params.battleState.combatId) {
        errors.push('BATTLE_NOT_FOUND');
    }
    if (params.plan.roundNumber !== params.battleState.roundNumber) {
        errors.push('ROUND_MISMATCH');
    }
    if (params.plan.actorId !== params.actor.id) {
        errors.push('ACTOR_NOT_FOUND');
    }
    if (!params.actor.isAlive) {
        errors.push('ACTOR_DEAD');
    }
    if (total.commands > limits.maxCommands) {
        errors.push('MAX_COMMANDS_REACHED');
    }
    if (total.ap > limits.maxAP) {
        errors.push('NOT_ENOUGH_AP');
    }
    if (total.stamina > params.actor.currentStamina) {
        errors.push('NOT_ENOUGH_STAMINA');
    }
    if (total.mp > params.actor.currentMp) {
        errors.push('NOT_ENOUGH_MP');
    }
    if (total.hp >= params.actor.currentHp) {
        errors.push('NOT_ENOUGH_HP');
    }
    // Duplicate guard/strong_guard in same plan: allow guard+strong_guard but not guard+guard or strong_guard+strong_guard
    const guardCount = commands.filter((cmd) => cmd.type === 'guard').length;
    const strongGuardCount = commands.filter((cmd) => cmd.type === 'strong_guard').length;
    if (guardCount >= 2 || strongGuardCount >= 2) {
        errors.push('GUARD_ALREADY_PLANNED');
    }
    for (const command of commands) {
        const validation = validateCombatCommand({ command, actor: params.actor, battleState: params.battleState });
        errors.push(...validation.errors);
        if (validation.warnings) {
            commandWarnings.push(...validation.warnings);
        }
        if (validation.warningDetails) {
            warningDetails.push(...validation.warningDetails);
        }
    }
    const warnings = [...new Set([...commandWarnings, ...collectWarnings(params.actor, total, errors)])];
    return {
        ok: errors.length === 0,
        errors: [...new Set(errors)],
        ...(warnings.length > 0 ? { warnings } : {}),
        ...(warningDetails.length > 0 ? { warningDetails } : {}),
        total,
    };
}
function canAppendCombatCommand(params) {
    return validateCombatTurnPlan({
        actor: params.actor,
        battleState: params.battleState,
        limits: params.limits,
        plan: {
            battleId: params.battleState.combatId,
            roundNumber: params.battleState.roundNumber,
            actorId: params.actor.id,
            commands: [...params.currentCommands, params.nextCommand],
            ready: false,
        },
    });
}
function createCombatCommandFromType(params) {
    const raw = {
        id: `cmd_${Math.random().toString(36).slice(2, 10)}`,
        type: params.type,
        sourceSlotId: params.sourceSlotId,
        target: params.target,
        apCost: 0,
        costs: {},
        payload: params.payload,
        createdAt: new Date().toISOString(),
    };
    const baseCost = getCombatCommandBaseCost(raw);
    return {
        ...raw,
        apCost: params.costs?.ap ?? baseCost.apCost,
        costs: {
            stamina: params.costs?.stamina ?? baseCost.costs.stamina,
            mp: params.costs?.mp ?? baseCost.costs.mp,
            hp: params.costs?.hp ?? baseCost.costs.hp,
        },
    };
}
function revalidateCombatCommandBeforeExecute(params) {
    const actor = params.battleState.entities.find((entity) => entity.id === params.actorId);
    if (!actor) {
        return { ok: false, reason: 'unknown', message: 'Исполнитель команды не найден.' };
    }
    if (!actor.isAlive) {
        return { ok: false, reason: 'actor_dead', message: 'План прерван: исполнитель уже мертв.' };
    }
    (0, combat_status_sync_1.syncControlFlagsFromActiveStatuses)(actor);
    const actorFlags = actor;
    if (actorFlags.isStunned) {
        return { ok: false, reason: 'actor_stunned', message: 'Действие сорвано: исполнитель оглушен.' };
    }
    if (actorFlags.isKnockedDown) {
        return { ok: false, reason: 'actor_knocked_down', message: 'Действие сорвано: исполнитель сбит с ног.' };
    }
    if (actorFlags.isIncapacitated) {
        return { ok: false, reason: 'actor_incapacitated', message: 'Действие сорвано: исполнитель не может действовать.' };
    }
    if ((params.command.type === 'move' || params.command.type === 'dash' || params.command.type === 'disengage' || params.command.type === 'start_retreat') && actorFlags.isRooted) {
        return { ok: false, reason: 'actor_rooted', message: 'Действие сорвано: исполнитель обездвижен.' };
    }
    if (params.command.type === 'skill_cast' && actorFlags.isSilenced) {
        return { ok: false, reason: 'actor_silenced', message: 'Заклинание сорвано: наложено молчание.' };
    }
    if ((params.command.type === 'basic_attack' || params.command.type === 'heavy_attack') && actorFlags.isDisarmed) {
        return { ok: false, reason: 'actor_disarmed', message: 'Атака сорвана: исполнитель обезоружен.' };
    }
    const staminaCost = params.command.costs.stamina ?? 0;
    const mpCost = params.command.costs.mp ?? 0;
    // HP cost includes normalized blood costs (blood_to_hp conversion is performed on client-side by normalizeSkillResourceCosts)
    // This ensures blood/hp sacrifice mechanics are consistent across frontend preview and backend validation
    const hpCost = params.command.costs.hp ?? 0;
    if (staminaCost > actor.currentStamina) {
        return { ok: false, reason: 'not_enough_stamina', message: 'Недостаточно выносливости для выполнения команды.' };
    }
    if (mpCost > actor.currentMp) {
        return { ok: false, reason: 'not_enough_mp', message: 'Недостаточно маны для выполнения команды.' };
    }
    if (hpCost >= actor.currentHp) {
        return { ok: false, reason: 'not_enough_hp', message: 'Недостаточно здоровья для выполнения команды.' };
    }
    if (params.command.target.kind === 'entity') {
        const targetEntityId = params.command.target.entityId;
        const target = params.battleState.entities.find((entity) => entity.id === targetEntityId);
        if (!target) {
            return { ok: false, reason: 'target_missing', message: 'Цель исчезла с поля боя.' };
        }
        if (!target.isAlive) {
            return { ok: false, reason: 'target_dead', message: 'Цель уже мертва.' };
        }
        const actorCell = getEntityCell(actor);
        const targetCell = getEntityCell(target);
        const distance = getCellDistance(actorCell, targetCell);
        if (params.command.type === 'basic_attack' || params.command.type === 'heavy_attack') {
            const { minRange, maxRange } = getEntityAttackRange(actor);
            if (distance > maxRange) {
                return {
                    ok: false,
                    reason: 'target_out_of_range',
                    message: 'Цель вышла из зоны удара, атака не достигла цели.',
                };
            }
            if (distance < minRange) {
                return {
                    ok: false,
                    reason: 'target_too_close',
                    message: 'Цель слишком близко для выбранной атаки.',
                };
            }
            if (maxRange > 1 && !hasLineOfSightForRevalidation(params.battleState, actorCell, targetCell)) {
                return {
                    ok: false,
                    reason: 'line_of_sight_blocked',
                    message: 'Стрела не была выпущена: линия видимости потеряна.',
                };
            }
        }
        if (params.command.type === 'skill_cast') {
            const explicitSkillRange = params.command.payload?.skillRange;
            const maxRange = typeof explicitSkillRange === 'number' && Number.isFinite(explicitSkillRange)
                ? Math.max(1, Math.floor(explicitSkillRange))
                : Math.max(1, Number.isFinite(actor.attackRange) ? Math.floor(actor.attackRange ?? 1) : 6);
            if (distance > maxRange) {
                return {
                    ok: false,
                    reason: 'target_out_of_range',
                    message: 'Цель вышла из радиуса действия заклинания.',
                };
            }
            if (!hasLineOfSightForRevalidation(params.battleState, actorCell, targetCell)) {
                return {
                    ok: false,
                    reason: 'line_of_sight_blocked',
                    message: 'Цель скрылась за препятствием, заклинание сорвалось.',
                };
            }
        }
    }
    if (params.command.target.kind === 'cell') {
        const targetCell = params.command.target;
        const maxX = params.battleState.battleMapWidth - 1;
        const maxY = params.battleState.battleMapHeight - 1;
        if (targetCell.x < 0 || targetCell.y < 0 || targetCell.x > maxX || targetCell.y > maxY) {
            return { ok: false, reason: 'cell_blocked', message: 'Клетка цели находится вне поля боя.' };
        }
        if (params.command.type === 'move' || params.command.type === 'dash' || params.command.type === 'disengage') {
            if (isTileMovementBlockedForRevalidation(params.battleState, targetCell.x, targetCell.y)) {
                return { ok: false, reason: 'cell_blocked', message: 'Клетка назначения перекрыта препятствием.' };
            }
            const occupied = params.battleState.entities.some((entity) => entity.isAlive
                && entity.id !== actor.id
                && entity.battlefieldX === targetCell.x
                && entity.battlefieldY === targetCell.y);
            if (occupied) {
                return { ok: false, reason: 'cell_occupied', message: 'Клетка назначения уже занята.' };
            }
        }
    }
    return { ok: true };
}
function calculateCommandInitiative(context) {
    const priority = exports.COMBAT_COMMAND_PRIORITY[context.command.type] ?? 0;
    const baseInitiative = context.actor.dexterity * 1.0 + context.actor.perception * 0.5 + context.actor.luck * 0.25;
    const fatiguePenalty = context.actor.currentStamina <= Math.max(10, Math.floor(context.actor.maxStamina * 0.15)) ? 4 : 0;
    const armorLoadPenalty = 0;
    const statusModifiers = context.actor.isStunned ? -20 : 0;
    const smallRandomRoll = context.randomRoll ?? Math.floor(Math.random() * 6);
    return baseInitiative + priority + smallRandomRoll + statusModifiers - armorLoadPenalty - fatiguePenalty;
}
