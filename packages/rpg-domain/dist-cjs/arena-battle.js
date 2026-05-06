"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BATTLEFIELD_GRID_SIZE = exports.BattlefieldTileType = exports.DistanceBand = exports.TeamSide = exports.CombatSkillType = exports.MovementType = exports.ActionType = exports.TargetZone = void 0;
exports.getDistanceBandForGap = getDistanceBandForGap;
exports.getBattlefieldDistance = getBattlefieldDistance;
exports.getDistanceBandBetweenEntities = getDistanceBandBetweenEntities;
exports.getReachableBattlefieldTiles = getReachableBattlefieldTiles;
exports.getThreatenedTiles = getThreatenedTiles;
exports.getBattlefieldTilePlacements = getBattlefieldTilePlacements;
exports.calculateInitiative = calculateInitiative;
exports.clampHitChance = clampHitChance;
exports.getStaminaRegen = getStaminaRegen;
exports.getManaRegen = getManaRegen;
exports.createArenaCombatEntity = createArenaCombatEntity;
exports.createInitialBattleState = createInitialBattleState;
exports.createNpcAction = createNpcAction;
exports.resolveRound = resolveRound;
var TargetZone;
(function (TargetZone) {
    TargetZone["Head"] = "HEAD";
    TargetZone["Chest"] = "CHEST";
    TargetZone["Abdomen"] = "ABDOMEN";
    TargetZone["LeftArm"] = "LEFT_ARM";
    TargetZone["RightArm"] = "RIGHT_ARM";
    TargetZone["Legs"] = "LEGS";
})(TargetZone || (exports.TargetZone = TargetZone = {}));
var ActionType;
(function (ActionType) {
    ActionType["Attack"] = "ATTACK";
    ActionType["Move"] = "MOVE";
    ActionType["Defend"] = "DEFEND";
    ActionType["Wait"] = "WAIT";
})(ActionType || (exports.ActionType = ActionType = {}));
var MovementType;
(function (MovementType) {
    MovementType["Step"] = "STEP";
    MovementType["Extra"] = "EXTRA";
    MovementType["Dash"] = "DASH";
    MovementType["Disengage"] = "DISENGAGE";
})(MovementType || (exports.MovementType = MovementType = {}));
var CombatSkillType;
(function (CombatSkillType) {
    CombatSkillType["None"] = "NONE";
    CombatSkillType["PowerStrike"] = "POWER_STRIKE";
    CombatSkillType["CrushingBlock"] = "CRUSHING_BLOCK";
    CombatSkillType["Rage"] = "RAGE";
    CombatSkillType["Fireball"] = "FIREBALL";
    CombatSkillType["FrostLance"] = "FROST_LANCE";
    CombatSkillType["ShieldBash"] = "SHIELD_BASH";
    CombatSkillType["Whirlwind"] = "WHIRLWIND";
})(CombatSkillType || (exports.CombatSkillType = CombatSkillType = {}));
var TeamSide;
(function (TeamSide) {
    TeamSide["Left"] = "LEFT";
    TeamSide["Right"] = "RIGHT";
})(TeamSide || (exports.TeamSide = TeamSide = {}));
var DistanceBand;
(function (DistanceBand) {
    DistanceBand["Melee"] = "MELEE";
    DistanceBand["Near"] = "NEAR";
    DistanceBand["Far"] = "FAR";
})(DistanceBand || (exports.DistanceBand = DistanceBand = {}));
var BattlefieldTileType;
(function (BattlefieldTileType) {
    BattlefieldTileType["Empty"] = "empty";
    BattlefieldTileType["Blocked"] = "blocked";
    BattlefieldTileType["LowCover"] = "lowCover";
    BattlefieldTileType["HighCover"] = "highCover";
    BattlefieldTileType["Hazard"] = "hazard";
    BattlefieldTileType["Summon"] = "summon";
})(BattlefieldTileType || (exports.BattlefieldTileType = BattlefieldTileType = {}));
exports.BATTLEFIELD_GRID_SIZE = 12;
const DEFENSIVE_ZONES = [TargetZone.Chest, TargetZone.Abdomen];
const ACTION_STAMINA_COSTS = {
    attack: 10,
    defend: 8,
    move: 6,
    extraMove: 16,
    dash: 14,
    disengage: 10,
    opportunity: 6,
};
function getBattleMapWidth(source) {
    return source?.battleMapWidth ?? exports.BATTLEFIELD_GRID_SIZE;
}
function getBattleMapHeight(source) {
    return source?.battleMapHeight ?? exports.BATTLEFIELD_GRID_SIZE;
}
function getDistanceColumns(distance, width) {
    const safeWidth = Math.max(2, width);
    if (distance === DistanceBand.Far) {
        return { left: 1, right: Math.max(1, safeWidth - 2) };
    }
    if (distance === DistanceBand.Near) {
        const left = Math.max(1, Math.floor(safeWidth * 0.28));
        const right = Math.max(left + 1, Math.min(safeWidth - 2, safeWidth - 1 - left));
        return { left, right };
    }
    const left = Math.max(0, Math.floor(safeWidth / 2) - 1);
    return { left, right: Math.min(safeWidth - 1, left + 1) };
}
function classifyGapDistance(gap) {
    if (gap <= 1) {
        return DistanceBand.Melee;
    }
    if (gap <= 4) {
        return DistanceBand.Near;
    }
    return DistanceBand.Far;
}
function getDistanceBandForGap(gap) {
    return classifyGapDistance(gap);
}
function distributeRows(count, height) {
    if (count <= 0) {
        return [];
    }
    return Array.from({ length: count }, (_, index) => Math.max(0, Math.min(height - 1, Math.round(((index + 1) * (height - 1)) / (count + 1)))));
}
function getDefaultBattlefieldTilePlacements(entities, distance, width, height) {
    const columns = getDistanceColumns(distance, width);
    const leftTeam = entities
        .filter((entity) => entity.isAlive && entity.team === TeamSide.Left)
        .sort((left, right) => left.position - right.position);
    const rightTeam = entities
        .filter((entity) => entity.isAlive && entity.team === TeamSide.Right)
        .sort((left, right) => left.position - right.position);
    const leftRows = distributeRows(leftTeam.length, height);
    const rightRows = distributeRows(rightTeam.length, height);
    return [
        ...leftTeam.map((entity, index) => ({
            entityId: entity.id,
            x: columns.left,
            y: leftRows[index] ?? Math.floor(height / 2),
            team: entity.team,
        })),
        ...rightTeam.map((entity, index) => ({
            entityId: entity.id,
            x: columns.right,
            y: rightRows[index] ?? Math.floor(height / 2),
            team: entity.team,
        })),
    ];
}
function hasStoredBattlefieldPositions(entities) {
    return entities
        .filter((entity) => entity.isAlive)
        .every((entity) => Number.isInteger(entity.battlefieldX) && Number.isInteger(entity.battlefieldY));
}
function syncBattlefieldPositions(entities, distance, width, height) {
    if (hasStoredBattlefieldPositions(entities)) {
        return;
    }
    const placements = getDefaultBattlefieldTilePlacements(entities, distance, width, height);
    const placementById = new Map(placements.map((placement) => [placement.entityId, placement]));
    for (const entity of entities) {
        const placement = placementById.get(entity.id);
        if (!placement) {
            continue;
        }
        entity.battlefieldX = placement.x;
        entity.battlefieldY = placement.y;
    }
}
function createDefaultBattlefieldTiles(width = exports.BATTLEFIELD_GRID_SIZE, height = exports.BATTLEFIELD_GRID_SIZE) {
    return Array.from({ length: width * height }, (_, index) => ({
        x: index % width,
        y: Math.floor(index / width),
        type: BattlefieldTileType.Empty,
    }));
}
function isWithinBattlefield(state, x, y) {
    return x >= 0 && x < getBattleMapWidth(state) && y >= 0 && y < getBattleMapHeight(state);
}
function getBattlefieldTileType(state, x, y) {
    return state.battlefieldTiles.find((tile) => tile.x === x && tile.y === y)?.type ?? BattlefieldTileType.Empty;
}
function isTileWalkBlocked(state, x, y) {
    const tile = state.battlefieldTiles.find((entry) => entry.x === x && entry.y === y);
    if (tile?.blocksMovement !== undefined) {
        return tile.blocksMovement;
    }
    const tileType = tile?.type ?? BattlefieldTileType.Empty;
    return tileType === BattlefieldTileType.Blocked || tileType === BattlefieldTileType.HighCover || tileType === BattlefieldTileType.Summon;
}
function isTileSightBlocked(state, x, y) {
    const tile = state.battlefieldTiles.find((entry) => entry.x === x && entry.y === y);
    if (tile?.blocksLineOfSight !== undefined) {
        return tile.blocksLineOfSight;
    }
    const tileType = tile?.type ?? BattlefieldTileType.Empty;
    return tileType === BattlefieldTileType.Blocked || tileType === BattlefieldTileType.HighCover || tileType === BattlefieldTileType.Summon;
}
function bresenhamLine(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    while (true) {
        points.push({ x, y });
        if (x === x1 && y === y1) {
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
    return points;
}
function hasLineOfSight(state, fromX, fromY, toX, toY) {
    const points = bresenhamLine(fromX, fromY, toX, toY);
    for (let i = 1; i < points.length - 1; i += 1) {
        if (isTileSightBlocked(state, points[i].x, points[i].y)) {
            return false;
        }
    }
    return true;
}
function getBattlefieldDistance(left, right) {
    return Math.abs((left.battlefieldX ?? 0) - (right.battlefieldX ?? 0)) + Math.abs((left.battlefieldY ?? 0) - (right.battlefieldY ?? 0));
}
function getDistanceBandBetweenEntities(left, right) {
    return classifyGapDistance(getBattlefieldDistance(left, right));
}
function deriveBattleDistance(entities, fallback) {
    const leftAlive = entities.filter((entity) => entity.isAlive && entity.team === TeamSide.Left);
    const rightAlive = entities.filter((entity) => entity.isAlive && entity.team === TeamSide.Right);
    if (leftAlive.length === 0 || rightAlive.length === 0) {
        return fallback;
    }
    let minimumGap = Number.POSITIVE_INFINITY;
    for (const left of leftAlive) {
        for (const right of rightAlive) {
            minimumGap = Math.min(minimumGap, getBattlefieldDistance(left, right));
        }
    }
    if (!Number.isFinite(minimumGap)) {
        return fallback;
    }
    return classifyGapDistance(minimumGap);
}
function getTacticalDistance(left, right) {
    return getBattlefieldDistance(left, right);
}
function selectNearestEnemy(actor, enemies) {
    return [...enemies].sort((left, right) => getTacticalDistance(actor, left) - getTacticalDistance(actor, right))[0] ?? enemies[0];
}
function classifyCombatStyle(actor) {
    if (actor.combatStyleHint) {
        return actor.combatStyleHint;
    }
    if (typeof actor.attackRange === 'number' && actor.attackRange > 1) {
        return 'RANGED';
    }
    if (actor.intelligence >= actor.strength && actor.intelligence >= actor.dexterity) {
        return 'MAGIC';
    }
    if (actor.dexterity >= actor.strength + 3 && actor.perception >= actor.strength + 2) {
        return 'RANGED';
    }
    return 'MELEE';
}
function getMaxAttackRange(actor, style) {
    if (style === 'MELEE') {
        return 1;
    }
    const raw = typeof actor.attackRange === 'number' && Number.isFinite(actor.attackRange)
        ? Math.floor(actor.attackRange)
        : undefined;
    if (style === 'MAGIC') {
        return Math.max(2, raw ?? 5);
    }
    return Math.max(2, raw ?? 6);
}
function selectNpcAttackZone(actor, currentBand) {
    const combatStyle = classifyCombatStyle(actor);
    if (combatStyle === 'MAGIC') {
        return actor.intelligence >= actor.willpower ? TargetZone.Head : TargetZone.Chest;
    }
    if (combatStyle === 'RANGED') {
        return currentBand === DistanceBand.Far ? TargetZone.Legs : TargetZone.Chest;
    }
    if (actor.strength >= actor.dexterity + 2) {
        return TargetZone.Chest;
    }
    return TargetZone.Head;
}
function updateBattleDistance(state) {
    state.distance = deriveBattleDistance(state.entities, state.distance);
}
function isTileOccupied(state, x, y, ignoredEntityId) {
    return state.entities.some((entity) => entity.isAlive
        && entity.id !== ignoredEntityId
        && entity.battlefieldX === x
        && entity.battlefieldY === y);
}
function buildDistanceMap(state, actor, maxDistance) {
    const originX = actor.battlefieldX ?? 0;
    const originY = actor.battlefieldY ?? 0;
    const distances = new Map([[`${originX}:${originY}`, 0]]);
    const queue = [{ x: originX, y: originY, distance: 0 }];
    while (queue.length > 0) {
        const current = queue.shift();
        if (current.distance >= maxDistance) {
            continue;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nextX = current.x + dx;
            const nextY = current.y + dy;
            const key = `${nextX}:${nextY}`;
            if (!isWithinBattlefield(state, nextX, nextY) || distances.has(key)) {
                continue;
            }
            if (isTileWalkBlocked(state, nextX, nextY) || isTileOccupied(state, nextX, nextY, actor.id)) {
                continue;
            }
            distances.set(key, current.distance + 1);
            queue.push({ x: nextX, y: nextY, distance: current.distance + 1 });
        }
    }
    return distances;
}
function getReachableBattlefieldTiles(state, actorId, maxDistance) {
    const actor = getEntity(state, actorId);
    const distances = buildDistanceMap(state, actor, maxDistance);
    return [...distances.entries()]
        .filter(([, distance]) => distance > 0 && distance <= maxDistance)
        .map(([key, distance]) => {
        const [x, y] = key.split(':').map(Number);
        return { x, y, distance };
    });
}
function getThreatenedTiles(state, team) {
    const threatened = [];
    for (const entity of state.entities) {
        if (!entity.isAlive || entity.team === team || classifyCombatStyle(entity) !== 'MELEE') {
            continue;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = (entity.battlefieldX ?? 0) + dx;
            const y = (entity.battlefieldY ?? 0) + dy;
            if (isWithinBattlefield(state, x, y)) {
                threatened.push({ x, y, enemyId: entity.id });
            }
        }
    }
    return threatened;
}
function getBattlefieldTilePlacements(entities, distance, width = exports.BATTLEFIELD_GRID_SIZE, height = exports.BATTLEFIELD_GRID_SIZE) {
    if (!hasStoredBattlefieldPositions(entities)) {
        return getDefaultBattlefieldTilePlacements(entities, distance, width, height);
    }
    return entities
        .filter((entity) => entity.isAlive)
        .map((entity) => ({
        entityId: entity.id,
        x: entity.battlefieldX ?? 0,
        y: entity.battlefieldY ?? 0,
        team: entity.team,
    }));
}
function calculateInitiative(entity) {
    return entity.perception + Math.floor(entity.dexterity * 0.5);
}
function clampHitChance(chance) {
    return Math.max(25, Math.min(95, chance));
}
function getStaminaRegen(entity) {
    return 10 + Math.floor(entity.constitution / 4);
}
function getManaRegen(entity) {
    return 6 + Math.floor(entity.willpower / 4);
}
function createArenaCombatEntity(input) {
    return {
        ...input,
        initiative: calculateInitiative(input),
        isAlive: input.currentHp > 0,
    };
}
function createInitialBattleState(params) {
    const battleMapWidth = Math.max(1, params.battleMapWidth ?? exports.BATTLEFIELD_GRID_SIZE);
    const battleMapHeight = Math.max(1, params.battleMapHeight ?? exports.BATTLEFIELD_GRID_SIZE);
    const state = {
        combatId: params.combatId,
        battleMapId: params.battleMapId,
        battleMapWidth,
        battleMapHeight,
        viewportWidth: Math.max(1, Math.min(params.viewportWidth ?? exports.BATTLEFIELD_GRID_SIZE, battleMapWidth)),
        viewportHeight: Math.max(1, Math.min(params.viewportHeight ?? exports.BATTLEFIELD_GRID_SIZE, battleMapHeight)),
        roundNumber: 0,
        distance: params.distance ?? DistanceBand.Melee,
        entities: params.entities,
        battlefieldTiles: params.battlefieldTiles ?? createDefaultBattlefieldTiles(battleMapWidth, battleMapHeight),
        battlefieldTraps: params.battlefieldTraps ?? [],
        logs: [],
        isFinished: false,
    };
    syncBattlefieldPositions(state.entities, state.distance, battleMapWidth, battleMapHeight);
    updateBattleDistance(state);
    return state;
}
function normalizeMovementType(action) {
    if (action.movementType) {
        return action.movementType;
    }
    if (action.actionType === ActionType.Move) {
        return MovementType.Step;
    }
    if (Number.isInteger(action.destinationX) && Number.isInteger(action.destinationY)) {
        return MovementType.Step;
    }
    return undefined;
}
function ensureActionPoints(_entity, action) {
    const attack = Math.max(0, action.attackPointsSpent);
    const defense = Math.max(0, action.defensePointsSpent);
    const defenseZones = action.defenseZones.filter((zone, index, zones) => zones.indexOf(zone) === index).slice(0, 2);
    return {
        ...action,
        defenseZones,
        attackPointsSpent: attack,
        defensePointsSpent: defense,
        movementType: normalizeMovementType(action),
    };
}
function classifyPreferredDistance(actor) {
    const style = classifyCombatStyle(actor);
    if (style === 'MAGIC') {
        return DistanceBand.Far;
    }
    if (style === 'RANGED') {
        return DistanceBand.Near;
    }
    return DistanceBand.Melee;
}
function getEntity(state, id) {
    const entity = state.entities.find((item) => item.id === id);
    if (!entity) {
        throw new Error(`Entity ${id} not found`);
    }
    return entity;
}
function getAliveByTeam(state, team) {
    return state.entities.filter((item) => item.team === team && item.isAlive);
}
function checkVictory(state) {
    const leftAlive = getAliveByTeam(state, TeamSide.Left).length;
    const rightAlive = getAliveByTeam(state, TeamSide.Right).length;
    if (leftAlive === 0 && rightAlive === 0) {
        state.isFinished = true;
        state.winner = undefined;
    }
    else if (leftAlive === 0) {
        state.isFinished = true;
        state.winner = TeamSide.Right;
    }
    else if (rightAlive === 0) {
        state.isFinished = true;
        state.winner = TeamSide.Left;
    }
}
function getGuardMode(defenseZones) {
    if (defenseZones.length === 0) {
        return 'RECKLESS';
    }
    if (defenseZones.length === 1) {
        return 'AGGRESSIVE';
    }
    return 'NORMAL';
}
function getOutgoingDamageMultiplier(mode) {
    if (mode === 'RECKLESS') {
        return 1.2;
    }
    if (mode === 'AGGRESSIVE') {
        return 1.1;
    }
    return 1;
}
function getIncomingDamageMultiplier(mode) {
    return mode === 'RECKLESS' ? 1.2 : 1;
}
function getHitChanceBonus(mode) {
    return mode === 'RECKLESS' ? 15 : 0;
}
function getCritChanceBonus(mode) {
    return mode === 'RECKLESS' ? 10 : 0;
}
function getEnemyCritBonusAgainst(mode) {
    return mode === 'RECKLESS' ? 10 : 0;
}
function getMovementDistanceAllowance(movementType) {
    if (!movementType) {
        return 0;
    }
    if (movementType === MovementType.Step || movementType === MovementType.Disengage) {
        return 1;
    }
    if (movementType === MovementType.Extra) {
        return 2;
    }
    if (movementType === MovementType.Dash) {
        return 3;
    }
    return 0;
}
function getMovementStaminaCost(movementType) {
    if (!movementType) {
        return 0;
    }
    if (movementType === MovementType.Step) {
        return ACTION_STAMINA_COSTS.move;
    }
    if (movementType === MovementType.Extra) {
        return ACTION_STAMINA_COSTS.extraMove;
    }
    if (movementType === MovementType.Dash) {
        return ACTION_STAMINA_COSTS.dash;
    }
    if (movementType === MovementType.Disengage) {
        return ACTION_STAMINA_COSTS.disengage;
    }
    return 0;
}
function getActionStaminaCost(actionType) {
    if (actionType === ActionType.Attack) {
        return ACTION_STAMINA_COSTS.attack;
    }
    if (actionType === ActionType.Defend) {
        return ACTION_STAMINA_COSTS.defend;
    }
    return 0;
}
function canAttackAtDistance(state, actor, target) {
    const style = classifyCombatStyle(actor);
    const distance = getBattlefieldDistance(actor, target);
    if (distance <= 0) {
        return false;
    }
    if (style === 'MELEE') {
        return distance <= 1;
    }
    if (style === 'RANGED') {
        const maxRange = getMaxAttackRange(actor, style);
        if (distance > maxRange) {
            return false;
        }
        // Check line of sight for ranged attacks
        const fromX = actor.battlefieldX ?? 0;
        const fromY = actor.battlefieldY ?? 0;
        const toX = target.battlefieldX ?? 0;
        const toY = target.battlefieldY ?? 0;
        return hasLineOfSight(state, fromX, fromY, toX, toY);
    }
    const maxRange = getMaxAttackRange(actor, style);
    if (distance > maxRange) {
        return false;
    }
    const fromX = actor.battlefieldX ?? 0;
    const fromY = actor.battlefieldY ?? 0;
    const toX = target.battlefieldX ?? 0;
    const toY = target.battlefieldY ?? 0;
    return hasLineOfSight(state, fromX, fromY, toX, toY);
}
function spendStamina(actor, amount) {
    if (amount <= 0) {
        return true;
    }
    if (actor.currentStamina < amount) {
        return false;
    }
    actor.currentStamina -= amount;
    return true;
}
function resolveDestinationForAction(state, actor, target, action) {
    if (Number.isInteger(action.destinationX) && Number.isInteger(action.destinationY)) {
        return { x: action.destinationX, y: action.destinationY };
    }
    if (!action.movementType) {
        return null;
    }
    const candidates = getReachableBattlefieldTiles(state, actor.id, getMovementDistanceAllowance(action.movementType));
    if (candidates.length === 0) {
        return null;
    }
    const style = classifyCombatStyle(actor);
    const maxRange = getMaxAttackRange(actor, style);
    const desiredMinDistance = style === 'MELEE' ? 1 : 2;
    const preferRetreat = action.actionType === ActionType.Move
        && (((style === 'RANGED' || style === 'MAGIC') && getBattlefieldDistance(actor, target) < desiredMinDistance) || action.movementType === MovementType.Disengage);
    candidates.sort((left, right) => {
        const leftDistance = Math.abs(left.x - (target.battlefieldX ?? 0)) + Math.abs(left.y - (target.battlefieldY ?? 0));
        const rightDistance = Math.abs(right.x - (target.battlefieldX ?? 0)) + Math.abs(right.y - (target.battlefieldY ?? 0));
        if (preferRetreat) {
            if (leftDistance !== rightDistance) {
                return rightDistance - leftDistance;
            }
        }
        else if (style === 'RANGED' || style === 'MAGIC') {
            const leftOutOfRange = leftDistance > maxRange;
            const rightOutOfRange = rightDistance > maxRange;
            if (leftOutOfRange !== rightOutOfRange) {
                return leftOutOfRange ? 1 : -1;
            }
            if (leftDistance !== rightDistance) {
                return leftDistance - rightDistance;
            }
        }
        else if (leftDistance !== rightDistance) {
            return leftDistance - rightDistance;
        }
        return left.distance - right.distance;
    });
    return { x: candidates[0].x, y: candidates[0].y };
}
function applyMovement(state, actor, action, target) {
    const movementType = action.movementType;
    if (!movementType) {
        return { moved: false, cellsMoved: 0, opportunityEnemies: [], reason: 'No movement selected.' };
    }
    const destination = resolveDestinationForAction(state, actor, target, action);
    if (!destination) {
        return { moved: false, cellsMoved: 0, opportunityEnemies: [], reason: 'No destination available.' };
    }
    if (!isWithinBattlefield(state, destination.x, destination.y)) {
        return { moved: false, cellsMoved: 0, opportunityEnemies: [], reason: 'Destination is outside battlefield.' };
    }
    if (isTileWalkBlocked(state, destination.x, destination.y) || isTileOccupied(state, destination.x, destination.y, actor.id)) {
        return { moved: false, cellsMoved: 0, opportunityEnemies: [], reason: 'Destination is blocked.' };
    }
    const maxDistance = getMovementDistanceAllowance(movementType);
    const distances = buildDistanceMap(state, actor, maxDistance);
    const key = `${destination.x}:${destination.y}`;
    const cellsMoved = distances.get(key) ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(cellsMoved) || cellsMoved > maxDistance) {
        return { moved: false, cellsMoved: 0, opportunityEnemies: [], reason: 'Destination is not reachable.' };
    }
    const adjacentMeleeEnemies = state.entities.filter((entity) => entity.isAlive && entity.team !== actor.team && classifyCombatStyle(entity) === 'MELEE' && getBattlefieldDistance(actor, entity) <= 1);
    actor.battlefieldX = destination.x;
    actor.battlefieldY = destination.y;
    updateBattleDistance(state);
    const opportunityEnemies = movementType === MovementType.Disengage
        ? []
        : adjacentMeleeEnemies.filter((enemy) => getBattlefieldDistance(actor, enemy) > 1);
    return { moved: true, cellsMoved, opportunityEnemies };
}
function canAttackAfterMovement(action, cellsMoved) {
    if (action.actionType !== ActionType.Attack) {
        return false;
    }
    if (!action.movementType) {
        return true;
    }
    if (action.movementType === MovementType.Dash || action.movementType === MovementType.Disengage) {
        return false;
    }
    return cellsMoved <= 1;
}
function resolveOpportunityAttacks(params) {
    const { state, mover, moverAction, enemies, logs, random } = params;
    const guardMode = getGuardMode(moverAction.defenseZones);
    for (const enemy of enemies) {
        if (!enemy.isAlive || !spendStamina(enemy, ACTION_STAMINA_COSTS.opportunity)) {
            continue;
        }
        const hitChance = clampHitChance(55 + enemy.perception * 2 - mover.dexterity);
        const roll = Math.floor(random() * 100) + 1;
        if (roll > hitChance) {
            logs.push({
                round: state.roundNumber,
                actorId: enemy.id,
                targetId: mover.id,
                type: 'MISS',
                text: `${enemy.name} misses a free strike on ${mover.name}`,
            });
            continue;
        }
        const damage = Math.max(1, Math.round((enemy.strength + Math.floor(enemy.perception * 0.4)) * 0.6 * getIncomingDamageMultiplier(guardMode) - Math.floor(mover.constitution * 0.35)));
        mover.currentHp = Math.max(0, mover.currentHp - damage);
        mover.isAlive = mover.currentHp > 0;
        logs.push({
            round: state.roundNumber,
            actorId: enemy.id,
            targetId: mover.id,
            type: 'HIT',
            amount: damage,
            text: `${enemy.name} lands a free strike on ${mover.name} for ${damage}`,
        });
        if (!mover.isAlive) {
            logs.push({
                round: state.roundNumber,
                actorId: mover.id,
                type: 'DEATH',
                text: `${mover.name} dies`,
            });
            break;
        }
    }
}
function resolveAttack(params) {
    const { state, actor, target, actorAction, targetAction, byActor, logs, random } = params;
    const combatStyle = classifyCombatStyle(actor);
    const actualCells = getBattlefieldDistance(actor, target);
    const actualBand = classifyGapDistance(actualCells);
    if (!canAttackAtDistance(state, actor, target)) {
        let reason = 'target is out of effective range';
        if (combatStyle === 'RANGED' || combatStyle === 'MAGIC') {
            const maxRange = getMaxAttackRange(actor, combatStyle);
            if (actualCells > maxRange) {
                reason = `target is out of range (${actualCells}/${maxRange})`;
            }
            else {
                const fromX = actor.battlefieldX ?? 0;
                const fromY = actor.battlefieldY ?? 0;
                const toX = target.battlefieldX ?? 0;
                const toY = target.battlefieldY ?? 0;
                if (!hasLineOfSight(state, fromX, fromY, toX, toY)) {
                    reason = 'target is behind a wall (line of sight blocked)';
                }
            }
        }
        logs.push({
            round: state.roundNumber,
            actorId: actor.id,
            targetId: target.id,
            type: 'INFO',
            text: `${actor.name} cannot hit ${target.name}: ${reason}`,
        });
        return;
    }
    const actorGuardMode = getGuardMode(actorAction.defenseZones);
    const targetGuardMode = getGuardMode(targetAction.defenseZones);
    const distancePenalty = combatStyle === 'MELEE'
        ? 0
        : combatStyle === 'RANGED'
            ? actualCells <= 1
                ? 8
                : actualCells <= 6
                    ? 0
                    : 6
            : actualBand === DistanceBand.Melee
                ? 4
                : actualBand === DistanceBand.Near
                    ? 0
                    : 2;
    const hitChance = clampHitChance(58 + actor.perception * 3 + actor.luck - target.dexterity * 2 - distancePenalty + getHitChanceBonus(actorGuardMode));
    const roll = Math.floor(random() * 100) + 1;
    if (roll > hitChance) {
        logs.push({
            round: state.roundNumber,
            actorId: actor.id,
            targetId: target.id,
            type: 'MISS',
            text: `${actor.name} misses ${target.name} in ${actorAction.attackZone}`,
        });
        return;
    }
    const baseDamage = combatStyle === 'MAGIC'
        ? actor.intelligence + Math.floor(actor.willpower * 0.4) + actorAction.attackPointsSpent
        : combatStyle === 'RANGED'
            ? actor.dexterity + Math.floor(actor.perception * 0.4) + actorAction.attackPointsSpent
            : actor.strength + actorAction.attackPointsSpent;
    const criticalChance = clampHitChance(actor.luck
        + (combatStyle === 'MAGIC' ? actor.intelligence : actor.perception)
        + (actorAction.attackZone === TargetZone.Head ? 18 : 4)
        + getCritChanceBonus(actorGuardMode)
        + getEnemyCritBonusAgainst(targetGuardMode));
    const isCritical = Math.floor(random() * 100) + 1 <= criticalChance;
    const criticalMultiplier = isCritical ? 1.5 : 1;
    const outgoingMultiplier = getOutgoingDamageMultiplier(actorGuardMode);
    const incomingMultiplier = getIncomingDamageMultiplier(targetGuardMode);
    const matchedDefense = targetAction.defenseZones.includes(actorAction.attackZone);
    let finalDamage = 0;
    let blocked = 0;
    if (matchedDefense) {
        const mitigation = Math.round((combatStyle === 'MAGIC' ? target.willpower : target.constitution) + targetAction.defensePointsSpent * 1.5);
        finalDamage = Math.max(1, Math.round(baseDamage * criticalMultiplier * outgoingMultiplier * incomingMultiplier) - mitigation);
        blocked = Math.max(0, Math.round(baseDamage * criticalMultiplier) - finalDamage);
    }
    else {
        const mitigation = Math.floor((combatStyle === 'MAGIC' ? target.willpower : target.constitution) * 0.5);
        finalDamage = Math.max(1, Math.round(baseDamage * criticalMultiplier * outgoingMultiplier * incomingMultiplier) - mitigation);
        blocked = Math.max(0, Math.round(baseDamage * criticalMultiplier) - finalDamage);
    }
    if (actorAction.attackZone === TargetZone.Head && finalDamage > 0) {
        finalDamage += Math.max(1, Math.floor(actor.perception * 0.3));
    }
    if ((actorAction.attackZone === TargetZone.LeftArm || actorAction.attackZone === TargetZone.RightArm) && finalDamage > 0) {
        target.strength = Math.max(1, target.strength - 1);
        logs.push({
            round: state.roundNumber,
            actorId: actor.id,
            targetId: target.id,
            type: 'INFO',
            text: `${actor.name} disrupts ${target.name}'s weapon arm`,
        });
    }
    if (actorAction.attackZone === TargetZone.Legs && finalDamage > 0) {
        target.dexterity = Math.max(1, target.dexterity - 1);
        logs.push({
            round: state.roundNumber,
            actorId: actor.id,
            targetId: target.id,
            type: 'INFO',
            text: `${actor.name} slows ${target.name}`,
        });
    }
    const centerMultiplier = typeof actor.splashCenterMultiplier === 'number' && Number.isFinite(actor.splashCenterMultiplier)
        ? Math.max(1, actor.splashCenterMultiplier)
        : 1;
    const outerMultiplier = typeof actor.splashOuterMultiplier === 'number' && Number.isFinite(actor.splashOuterMultiplier)
        ? Math.max(0, actor.splashOuterMultiplier)
        : 0.5;
    const impacted = new Map();
    const primaryDamage = Math.max(1, Math.round(finalDamage * (actor.splashRadius ? centerMultiplier : 1)));
    impacted.set(target.id, { entity: target, damage: primaryDamage, kind: 'primary' });
    if (typeof actor.pierceTargets === 'number' && actor.pierceTargets >= 2) {
        const fromX = actor.battlefieldX ?? 0;
        const fromY = actor.battlefieldY ?? 0;
        const toX = target.battlefieldX ?? 0;
        const toY = target.battlefieldY ?? 0;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const isLine = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
        if (isLine) {
            const stepX = Math.sign(dx);
            const stepY = Math.sign(dy);
            let x = toX + stepX;
            let y = toY + stepY;
            let remaining = Math.floor(actor.pierceTargets) - 1;
            while (remaining > 0 && isWithinBattlefield(state, x, y)) {
                if (isTileSightBlocked(state, x, y)) {
                    break;
                }
                const nextVictim = state.entities.find((entity) => entity.isAlive && entity.id !== actor.id && entity.battlefieldX === x && entity.battlefieldY === y);
                if (nextVictim && !impacted.has(nextVictim.id) && canAttackAtDistance(state, actor, nextVictim)) {
                    impacted.set(nextVictim.id, { entity: nextVictim, damage: finalDamage, kind: 'pierce' });
                    remaining -= 1;
                }
                x += stepX;
                y += stepY;
            }
        }
    }
    if (typeof actor.splashRadius === 'number' && actor.splashRadius >= 1) {
        const radius = Math.max(1, Math.floor(actor.splashRadius));
        const impactX = target.battlefieldX ?? 0;
        const impactY = target.battlefieldY ?? 0;
        for (const victim of state.entities) {
            if (!victim.isAlive || victim.id === actor.id || impacted.has(victim.id)) {
                continue;
            }
            const distance = Math.abs((victim.battlefieldX ?? 0) - impactX) + Math.abs((victim.battlefieldY ?? 0) - impactY);
            if (distance <= radius) {
                impacted.set(victim.id, { entity: victim, damage: Math.max(1, Math.round(finalDamage * outerMultiplier)), kind: 'splash' });
            }
        }
    }
    for (const entry of impacted.values()) {
        const victim = entry.entity;
        if (!victim.isAlive) {
            continue;
        }
        victim.currentHp = Math.max(0, victim.currentHp - entry.damage);
        victim.isAlive = victim.currentHp > 0;
        const tag = entry.kind === 'primary'
            ? ''
            : entry.kind === 'pierce'
                ? ' (pierce)'
                : ' (splash)';
        logs.push({
            round: state.roundNumber,
            actorId: actor.id,
            targetId: victim.id,
            type: 'HIT',
            amount: entry.damage,
            text: `${actor.name} hits ${victim.name} in ${actorAction.attackZone} for ${entry.damage} damage${isCritical ? ' (critical)' : ''}${tag}`,
        });
        if (!victim.isAlive) {
            logs.push({
                round: state.roundNumber,
                actorId: victim.id,
                type: 'DEATH',
                text: `${victim.name} dies`,
            });
        }
        else if (entry.kind !== 'primary') {
            const victimAction = byActor.get(victim.id) ?? defaultWaitAction(victim, actor);
            if (victimAction.actionType === ActionType.Defend) {
                logs.push({
                    round: state.roundNumber,
                    actorId: victim.id,
                    targetId: actor.id,
                    type: 'INFO',
                    text: `${victim.name} was guarding but got caught in the impact`,
                });
            }
        }
    }
    if (blocked > 0) {
        logs.push({
            round: state.roundNumber,
            actorId: target.id,
            targetId: actor.id,
            type: 'BLOCK',
            amount: blocked,
            text: `${target.name} blocks ${blocked} damage`,
        });
    }
}
function defaultWaitAction(actor, enemy) {
    return {
        actorId: actor.id,
        targetId: enemy.id,
        attackZone: TargetZone.Chest,
        defenseZones: [...DEFENSIVE_ZONES],
        attackPointsSpent: 0,
        defensePointsSpent: 0,
        actionType: ActionType.Wait,
    };
}
function createNpcAction(state, actorId) {
    const actor = getEntity(state, actorId);
    const enemies = state.entities.filter((item) => item.team !== actor.team && item.isAlive);
    if (enemies.length === 0) {
        return defaultWaitAction(actor, actor);
    }
    const target = selectNearestEnemy(actor, enemies);
    const lowHpRatio = actor.currentHp / Math.max(1, actor.maxHp);
    const combatStyle = classifyCombatStyle(actor);
    const maxRange = getMaxAttackRange(actor, combatStyle);
    const desiredMinDistance = combatStyle === 'MELEE' ? 1 : 2;
    const preferredDefense = lowHpRatio < 0.5
        ? [TargetZone.Head]
        : [TargetZone.Chest, TargetZone.Abdomen];
    const currentDistance = getBattlefieldDistance(actor, target);
    if (lowHpRatio < 0.25 && currentDistance <= 1) {
        return ensureActionPoints(actor, {
            actorId,
            targetId: target.id,
            attackZone: TargetZone.Chest,
            defenseZones: preferredDefense,
            attackPointsSpent: 0,
            defensePointsSpent: 0,
            actionType: ActionType.Move,
            movementType: MovementType.Disengage,
        });
    }
    if (combatStyle === 'MELEE' && currentDistance > 1) {
        return ensureActionPoints(actor, {
            actorId,
            targetId: target.id,
            attackZone: TargetZone.Chest,
            defenseZones: preferredDefense,
            attackPointsSpent: 0,
            defensePointsSpent: 0,
            actionType: ActionType.Move,
            movementType: MovementType.Step,
        });
    }
    if ((combatStyle === 'RANGED' || combatStyle === 'MAGIC') && currentDistance < desiredMinDistance) {
        return ensureActionPoints(actor, {
            actorId,
            targetId: target.id,
            attackZone: TargetZone.Chest,
            defenseZones: preferredDefense,
            attackPointsSpent: 0,
            defensePointsSpent: 0,
            actionType: ActionType.Move,
            movementType: currentDistance <= 1 ? MovementType.Disengage : MovementType.Step,
        });
    }
    if ((combatStyle === 'RANGED' || combatStyle === 'MAGIC') && currentDistance > maxRange) {
        return ensureActionPoints(actor, {
            actorId,
            targetId: target.id,
            attackZone: TargetZone.Chest,
            defenseZones: preferredDefense,
            attackPointsSpent: 0,
            defensePointsSpent: 0,
            actionType: ActionType.Move,
            movementType: MovementType.Step,
        });
    }
    if (lowHpRatio < 0.3) {
        return ensureActionPoints(actor, {
            actorId,
            targetId: target.id,
            attackZone: TargetZone.Chest,
            defenseZones: preferredDefense,
            attackPointsSpent: 0,
            defensePointsSpent: 0,
            actionType: ActionType.Defend,
        });
    }
    return ensureActionPoints(actor, {
        actorId,
        targetId: target.id,
        attackZone: selectNpcAttackZone(actor, getDistanceBandBetweenEntities(actor, target)),
        defenseZones: preferredDefense,
        attackPointsSpent: Math.max(0, Math.round(actor.maxStamina * 0.35)),
        defensePointsSpent: Math.max(0, Math.round(actor.maxStamina * 0.15)),
        actionType: ActionType.Attack,
    });
}
function resolveRound(params) {
    const random = params.random ?? Math.random;
    const state = params.state;
    if (state.isFinished) {
        return state;
    }
    syncBattlefieldPositions(state.entities, state.distance, getBattleMapWidth(state), getBattleMapHeight(state));
    if (!state.battlefieldTiles || state.battlefieldTiles.length === 0) {
        state.battlefieldTiles = createDefaultBattlefieldTiles(getBattleMapWidth(state), getBattleMapHeight(state));
    }
    if (!state.battlefieldTraps) {
        state.battlefieldTraps = [];
    }
    updateBattleDistance(state);
    state.roundNumber += 1;
    for (const entity of state.entities) {
        if (!entity.isAlive) {
            continue;
        }
        entity.initiative = calculateInitiative(entity);
    }
    const byActor = new Map();
    for (const action of params.plannedActions) {
        const actor = getEntity(state, action.actorId);
        byActor.set(action.actorId, ensureActionPoints(actor, action));
    }
    const order = state.entities
        .filter((item) => item.isAlive)
        .sort((a, b) => b.initiative - a.initiative)
        .map((item) => item.id);
    const logs = [];
    for (const actorId of order) {
        const actor = getEntity(state, actorId);
        if (!actor.isAlive) {
            continue;
        }
        const enemies = state.entities.filter((item) => item.team !== actor.team && item.isAlive);
        if (enemies.length === 0) {
            break;
        }
        if (actor.currentStamina <= 0) {
            logs.push({
                round: state.roundNumber,
                actorId,
                type: 'INFO',
                text: `${actor.name} is exhausted and skips turn`,
            });
            continue;
        }
        const fallback = defaultWaitAction(actor, enemies[0]);
        const actorAction = byActor.get(actorId) ?? fallback;
        const target = enemies.find((item) => item.id === actorAction.targetId) ?? enemies[0];
        const targetAction = byActor.get(target.id) ?? defaultWaitAction(target, actor);
        if (actorAction.actionType === ActionType.Wait) {
            logs.push({
                round: state.roundNumber,
                actorId,
                type: 'INFO',
                text: `${actor.name} waits`,
            });
            continue;
        }
        let movedCells = 0;
        if (actorAction.movementType) {
            if (!spendStamina(actor, getMovementStaminaCost(actorAction.movementType))) {
                logs.push({
                    round: state.roundNumber,
                    actorId,
                    type: 'INFO',
                    text: `${actor.name} lacks stamina to move`,
                });
                continue;
            }
            const movement = applyMovement(state, actor, actorAction, target);
            movedCells = movement.cellsMoved;
            if (!movement.moved) {
                logs.push({
                    round: state.roundNumber,
                    actorId,
                    type: 'INFO',
                    text: `${actor.name} cannot move: ${movement.reason ?? 'movement failed'}`,
                });
                if (actorAction.actionType === ActionType.Move) {
                    continue;
                }
            }
            else {
                logs.push({
                    round: state.roundNumber,
                    actorId,
                    type: 'INFO',
                    text: `${actor.name} moves to (${(actor.battlefieldX ?? 0) + 1}, ${(actor.battlefieldY ?? 0) + 1})`,
                });
                const triggeredTrap = state.battlefieldTraps.find((trap) => trap.isActive !== false && trap.x === actor.battlefieldX && trap.y === actor.battlefieldY);
                if (triggeredTrap) {
                    logs.push({
                        round: state.roundNumber,
                        actorId,
                        type: 'INFO',
                        text: `${actor.name} stepped onto a trap.`,
                    });
                    if ((triggeredTrap.damage ?? 3) > 0) {
                        const amount = triggeredTrap.damage ?? 3;
                        actor.currentHp = Math.max(0, actor.currentHp - amount);
                        actor.isAlive = actor.currentHp > 0;
                        logs.push({
                            round: state.roundNumber,
                            actorId,
                            type: 'HIT',
                            amount,
                            text: `${actor.name} takes ${amount} damage from trap ${triggeredTrap.name}`,
                        });
                    }
                    else {
                        const amount = triggeredTrap.staminaCost ?? 5;
                        actor.currentStamina = Math.max(0, actor.currentStamina - amount);
                        logs.push({
                            round: state.roundNumber,
                            actorId,
                            type: 'INFO',
                            text: `${actor.name} loses ${amount} stamina from trap ${triggeredTrap.name}`,
                        });
                    }
                    if (triggeredTrap.triggerOnce) {
                        triggeredTrap.isActive = false;
                    }
                }
                if (movement.opportunityEnemies.length > 0) {
                    resolveOpportunityAttacks({
                        state,
                        mover: actor,
                        moverAction: actorAction,
                        enemies: movement.opportunityEnemies,
                        logs,
                        random,
                    });
                    checkVictory(state);
                    if (!actor.isAlive || state.isFinished) {
                        if (state.isFinished) {
                            break;
                        }
                        continue;
                    }
                }
            }
        }
        if (actorAction.actionType === ActionType.Move) {
            continue;
        }
        if (actorAction.actionType === ActionType.Defend) {
            if (!spendStamina(actor, getActionStaminaCost(ActionType.Defend))) {
                logs.push({
                    round: state.roundNumber,
                    actorId,
                    type: 'INFO',
                    text: `${actor.name} lacks stamina to defend`,
                });
                continue;
            }
            const guardMode = getGuardMode(actorAction.defenseZones);
            logs.push({
                round: state.roundNumber,
                actorId,
                type: 'INFO',
                text: guardMode === 'RECKLESS'
                    ? `${actor.name} drops all defense and fights recklessly`
                    : `${actor.name} guards ${actorAction.defenseZones.join(' & ')}`,
            });
            continue;
        }
        if (!canAttackAfterMovement(actorAction, movedCells)) {
            logs.push({
                round: state.roundNumber,
                actorId,
                type: 'INFO',
                text: `${actor.name} cannot attack after that movement`,
            });
            continue;
        }
        if (!spendStamina(actor, getActionStaminaCost(ActionType.Attack))) {
            logs.push({
                round: state.roundNumber,
                actorId,
                type: 'INFO',
                text: `${actor.name} lacks stamina to attack`,
            });
            continue;
        }
        resolveAttack({
            state,
            actor,
            target,
            actorAction,
            targetAction,
            byActor,
            logs,
            random,
        });
        checkVictory(state);
        if (state.isFinished) {
            break;
        }
    }
    const round = {
        roundNumber: state.roundNumber,
        order,
        actions: order.map((id) => byActor.get(id) ?? defaultWaitAction(getEntity(state, id), getEntity(state, id))),
        logs,
    };
    state.lastRound = round;
    state.logs = [...state.logs, ...logs];
    updateBattleDistance(state);
    checkVictory(state);
    return state;
}
