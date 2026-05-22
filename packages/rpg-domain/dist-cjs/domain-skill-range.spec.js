"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
const combat_plan_1 = require("./combat-plan");
function createEntity(id, team, x, y) {
    return {
        id,
        name: id,
        team,
        race: 'human',
        level: 1,
        currentHp: 100,
        maxHp: 100,
        currentMp: 100,
        maxMp: 100,
        currentStamina: 100,
        maxStamina: 100,
        strength: 5,
        dexterity: 5,
        intelligence: 10,
        perception: 5,
        luck: 5,
        willpower: 5,
        constitution: 5,
        attackRange: 1,
        isAlive: true,
        battlefieldX: x,
        battlefieldY: y,
        activeCombatStatuses: [],
    };
}
function createBattleState() {
    return {
        combatId: 'battle_skill_range',
        battleMapWidth: 8,
        battleMapHeight: 8,
        viewportWidth: 8,
        viewportHeight: 8,
        roundNumber: 1,
        distance: 1,
        entities: [
            createEntity('player', index_1.TeamSide.Left, 1, 1),
            createEntity('enemy', index_1.TeamSide.Right, 4, 1),
        ],
        battlefieldTiles: [],
        battlefieldTraps: [],
        logs: [],
        isFinished: false,
    };
}
(0, vitest_1.describe)('skill cast revalidation', () => {
    (0, vitest_1.it)('uses skillRange from command payload instead of actor attackRange', () => {
        const battleState = createBattleState();
        const command = {
            id: 'cmd_skill',
            type: 'skill_cast',
            target: { kind: 'entity', entityId: 'enemy' },
            apCost: 1,
            costs: {},
            payload: {
                skillId: 'skill_ice_arrow_01',
                skillRange: 7,
            },
            createdAt: new Date().toISOString(),
        };
        const result = (0, combat_plan_1.revalidateCombatCommandBeforeExecute)({
            battleState,
            actorId: 'player',
            command,
        });
        (0, vitest_1.expect)(result.ok).toBe(true);
    });
    (0, vitest_1.it)('rejects ranged skill targets beyond configured max range', () => {
        const battleState = createBattleState();
        const command = {
            id: 'cmd_skill_far',
            type: 'skill_cast',
            target: { kind: 'entity', entityId: 'enemy' },
            apCost: 1,
            costs: {},
            payload: {
                skillId: 'skill_ice_arrow_01',
                skillRange: 2,
            },
            createdAt: new Date().toISOString(),
        };
        const result = (0, combat_plan_1.revalidateCombatCommandBeforeExecute)({
            battleState,
            actorId: 'player',
            command,
        });
        (0, vitest_1.expect)(result.ok).toBe(false);
        (0, vitest_1.expect)(result.reason).toBe('target_out_of_range');
    });
    (0, vitest_1.it)('rejects ranged skill targets behind blocked line of sight', () => {
        const battleState = createBattleState();
        battleState.battlefieldTiles = [{ x: 2, y: 1, type: index_1.BattlefieldTileType.HighCover }];
        const command = {
            id: 'cmd_skill_los',
            type: 'skill_cast',
            target: { kind: 'entity', entityId: 'enemy' },
            apCost: 1,
            costs: {},
            payload: {
                skillId: 'skill_ice_arrow_01',
                skillRange: 7,
            },
            createdAt: new Date().toISOString(),
        };
        const result = (0, combat_plan_1.revalidateCombatCommandBeforeExecute)({
            battleState,
            actorId: 'player',
            command,
        });
        (0, vitest_1.expect)(result.ok).toBe(false);
        (0, vitest_1.expect)(result.reason).toBe('line_of_sight_blocked');
    });
});
