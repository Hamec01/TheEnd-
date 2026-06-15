"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const arena_battle_1 = require("./arena-battle");
const races_1 = require("./races");
function playerEntity() {
    return {
        id: 'player',
        name: 'Player',
        team: arena_battle_1.TeamSide.Left,
        race: races_1.Race.Human,
        currentHp: 100,
        maxHp: 100,
        currentMp: 30,
        maxMp: 30,
        currentStamina: 60,
        maxStamina: 60,
        strength: 8,
        constitution: 8,
        dexterity: 8,
        intelligence: 5,
        luck: 5,
        perception: 5,
        willpower: 5,
        initiative: 10,
        isAlive: true,
        isPlayer: true,
        position: 0,
    };
}
function wounded(id) {
    return {
        id,
        name: id,
        role: 'ally',
        x: 1,
        y: 1,
        kingdomId: 'argos',
        canBeCarried: true,
        countsForObjective: true,
        objectiveTag: 'argos_wounded',
    };
}
const objective = {
    id: 'obj_extract_argos_wounded_5',
    type: 'extract_bodies',
    title: 'Extract Argos wounded',
    requiredCount: 5,
    sourceKingdomId: 'argos',
    sourceObjectiveTag: 'argos_wounded',
    targetZoneId: 'extraction_argos_banner',
    questId: 'argos_quest_field_of_the_fallen',
    questObjectiveId: 'obj_extract_argos_wounded',
    completeQuestObjectiveOnDone: true,
};
const extractionZone = {
    id: 'extraction_argos_banner',
    name: 'Argos Banner',
    cells: [{ x: 0, y: 0 }],
    allowedObjectiveTags: ['argos_wounded'],
    objectiveId: 'obj_extract_argos_wounded_5',
};
(0, vitest_1.describe)('battle objective emitter', () => {
    (0, vitest_1.it)('does not count the same body marker twice', () => {
        const state = (0, arena_battle_1.createInitialBattleState)({
            combatId: 'quest',
            entities: [playerEntity()],
            distance: arena_battle_1.DistanceBand.Melee,
            battleContext: (0, arena_battle_1.createQuestBattleContext)({
                questId: 'argos_quest_field_of_the_fallen',
                questStepId: 'step_extract',
                battleMapId: 'battlemap_argos_artalon',
                activeBattleObjectiveIds: ['obj_extract_argos_wounded_5'],
            }),
        });
        const marker = wounded('wounded_1');
        (0, vitest_1.expect)((0, arena_battle_1.pickUpBattleObjectiveMarker)(state, marker, [objective]).ok).toBe(true);
        (0, vitest_1.expect)((0, arena_battle_1.evacuateCarriedBodyAtZone)(state, [objective], extractionZone).progress?.currentCount).toBe(1);
        (0, vitest_1.expect)((0, arena_battle_1.pickUpBattleObjectiveMarker)(state, marker, [objective]).ok).toBe(false);
        (0, vitest_1.expect)(state.battleObjectiveProgress?.[objective.id].currentCount).toBe(1);
    });
    (0, vitest_1.it)('emits quest objective completion at required progress', () => {
        const state = (0, arena_battle_1.createInitialBattleState)({
            combatId: 'quest',
            entities: [playerEntity()],
            distance: arena_battle_1.DistanceBand.Melee,
            battleContext: (0, arena_battle_1.createQuestBattleContext)({
                questId: 'argos_quest_field_of_the_fallen',
                questStepId: 'step_extract',
                battleMapId: 'battlemap_argos_artalon',
                activeBattleObjectiveIds: ['obj_extract_argos_wounded_5'],
            }),
        });
        let effects = [];
        for (let index = 1; index <= 5; index += 1) {
            const marker = wounded(`wounded_${index}`);
            (0, arena_battle_1.pickUpBattleObjectiveMarker)(state, marker, [objective]);
            const result = (0, arena_battle_1.evacuateCarriedBodyAtZone)(state, [objective], extractionZone);
            effects = result.questEffects;
        }
        (0, vitest_1.expect)(state.battleObjectiveProgress?.[objective.id].currentCount).toBe(5);
        (0, vitest_1.expect)(state.questBattleResultState).toBe('objective_completed');
        (0, vitest_1.expect)(effects).toEqual([{
                type: 'complete_quest_objective',
                questId: 'argos_quest_field_of_the_fallen',
                objectiveId: 'obj_extract_argos_wounded',
                battleObjectiveId: 'obj_extract_argos_wounded_5',
            }]);
    });
});
