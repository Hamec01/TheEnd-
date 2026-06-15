"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const arena_battle_1 = require("./arena-battle");
const races_1 = require("./races");
function entity(overrides) {
    return {
        id: overrides.id,
        name: overrides.name ?? overrides.id,
        team: overrides.team,
        race: overrides.race ?? races_1.Race.Human,
        currentHp: overrides.currentHp ?? 100,
        maxHp: overrides.maxHp ?? 100,
        currentMp: overrides.currentMp ?? 30,
        maxMp: overrides.maxMp ?? 30,
        currentStamina: overrides.currentStamina ?? 60,
        maxStamina: overrides.maxStamina ?? 60,
        strength: overrides.strength ?? 8,
        constitution: overrides.constitution ?? 8,
        dexterity: overrides.dexterity ?? 8,
        intelligence: overrides.intelligence ?? 5,
        luck: overrides.luck ?? 5,
        perception: overrides.perception ?? 5,
        willpower: overrides.willpower ?? 5,
        initiative: overrides.initiative ?? 10,
        isAlive: overrides.isAlive ?? true,
        position: overrides.position ?? 0,
        battlefieldX: overrides.battlefieldX,
        battlefieldY: overrides.battlefieldY,
        isPlayer: overrides.isPlayer,
        isNpc: overrides.isNpc,
        kingdomId: overrides.kingdomId,
        raceId: overrides.raceId,
    };
}
(0, vitest_1.describe)('arena battle relation integration', () => {
    (0, vitest_1.it)('keeps legacy Left/Right hostility without relation context', () => {
        const player = entity({ id: 'player', team: arena_battle_1.TeamSide.Left, isPlayer: true, battlefieldX: 0, battlefieldY: 0 });
        const enemy = entity({ id: 'enemy', team: arena_battle_1.TeamSide.Right, isNpc: true, battlefieldX: 1, battlefieldY: 0 });
        const state = (0, arena_battle_1.createInitialBattleState)({
            combatId: 'legacy',
            entities: [player, enemy],
            distance: arena_battle_1.DistanceBand.Melee,
        });
        (0, vitest_1.expect)((0, arena_battle_1.getHostileEntities)(state, enemy).map((item) => item.id)).toEqual(['player']);
        (0, vitest_1.expect)((0, arena_battle_1.createNpcAction)(state, 'enemy').targetId).toBe('player');
    });
    (0, vitest_1.it)('uses global relations for same-team NPC target selection', () => {
        const relations = [{
                id: 'rel_argos_artalon',
                sourceActorType: 'kingdom',
                sourceActorId: 'argos',
                targetActorType: 'kingdom',
                targetActorId: 'artalon',
                value: -100,
                isMutual: true,
                createdAt: '',
                updatedAt: '',
            }];
        const argos = entity({ id: 'argos_soldier', team: arena_battle_1.TeamSide.Right, isNpc: true, kingdomId: 'argos', battlefieldX: 0, battlefieldY: 0 });
        const artalon = entity({ id: 'artalon_soldier', team: arena_battle_1.TeamSide.Right, isNpc: true, kingdomId: 'artalon', battlefieldX: 1, battlefieldY: 0 });
        const state = (0, arena_battle_1.createInitialBattleState)({
            combatId: 'quest',
            entities: [argos, artalon],
            distance: arena_battle_1.DistanceBand.Melee,
            globalRelations: relations,
        });
        (0, vitest_1.expect)((0, arena_battle_1.getHostileEntities)(state, argos).map((item) => item.id)).toEqual(['artalon_soldier']);
        (0, vitest_1.expect)((0, arena_battle_1.createNpcAction)(state, 'argos_soldier').targetId).toBe('artalon_soldier');
    });
});
