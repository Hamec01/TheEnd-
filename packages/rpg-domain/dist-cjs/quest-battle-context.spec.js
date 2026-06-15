"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const arena_battle_1 = require("./arena-battle");
(0, vitest_1.describe)('quest battle runtime context', () => {
    (0, vitest_1.it)('rejects quest battles without active objectives', () => {
        const context = (0, arena_battle_1.createQuestBattleContext)({
            questId: 'quest_argos',
            questStepId: 'step_battle',
            battleMapId: 'battlemap_argos_artalon',
            activeBattleObjectiveIds: [],
        });
        const result = (0, arena_battle_1.validateBattleContextForBattleMap)(context, {
            id: 'battlemap_argos_artalon',
            objectives: [{ id: 'obj_extract' }],
        });
        (0, vitest_1.expect)(result.ok).toBe(false);
        (0, vitest_1.expect)(result.errors.some((error) => error.includes('at least one'))).toBe(true);
    });
    (0, vitest_1.it)('rejects objective ids that are not present on the selected battle map', () => {
        const context = (0, arena_battle_1.createQuestBattleContext)({
            questId: 'quest_argos',
            questStepId: 'step_battle',
            battleMapId: 'battlemap_argos_artalon',
            activeBattleObjectiveIds: ['obj_missing'],
        });
        const result = (0, arena_battle_1.validateBattleContextForBattleMap)(context, {
            id: 'battlemap_argos_artalon',
            objectives: [{ id: 'obj_extract' }],
        });
        (0, vitest_1.expect)(result.ok).toBe(false);
        (0, vitest_1.expect)(result.errors.some((error) => error.includes('obj_missing'))).toBe(true);
    });
    (0, vitest_1.it)('disables arena rewards and arena victory logic for quest battles', () => {
        const context = (0, arena_battle_1.createQuestBattleContext)({
            questId: 'quest_argos',
            questStepId: 'step_battle',
            battleMapId: 'battlemap_argos_artalon',
            activeBattleObjectiveIds: ['obj_extract'],
        });
        (0, vitest_1.expect)((0, arena_battle_1.shouldApplyArenaVictoryRewards)({ battleContext: context })).toBe(false);
        (0, vitest_1.expect)((0, arena_battle_1.shouldUseArenaVictoryLogic)({ battleContext: context })).toBe(false);
        (0, vitest_1.expect)((0, arena_battle_1.shouldApplyArenaVictoryRewards)({ battleType: 'arena' })).toBe(true);
    });
});
