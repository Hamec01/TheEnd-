import { describe, expect, it } from 'vitest';
import {
	createQuestBattleContext,
	shouldApplyArenaVictoryRewards,
	shouldUseArenaVictoryLogic,
	validateBattleContextForBattleMap,
} from './arena-battle';

describe('quest battle runtime context', () => {
	it('rejects quest battles without active objectives', () => {
		const context = createQuestBattleContext({
			questId: 'quest_argos',
			questStepId: 'step_battle',
			battleMapId: 'battlemap_argos_artalon',
			activeBattleObjectiveIds: [],
		});
		const result = validateBattleContextForBattleMap(context, {
			id: 'battlemap_argos_artalon',
			objectives: [{ id: 'obj_extract' }],
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((error) => error.includes('at least one'))).toBe(true);
	});

	it('rejects objective ids that are not present on the selected battle map', () => {
		const context = createQuestBattleContext({
			questId: 'quest_argos',
			questStepId: 'step_battle',
			battleMapId: 'battlemap_argos_artalon',
			activeBattleObjectiveIds: ['obj_missing'],
		});
		const result = validateBattleContextForBattleMap(context, {
			id: 'battlemap_argos_artalon',
			objectives: [{ id: 'obj_extract' }],
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((error) => error.includes('obj_missing'))).toBe(true);
	});

	it('disables arena rewards and arena victory logic for quest battles', () => {
		const context = createQuestBattleContext({
			questId: 'quest_argos',
			questStepId: 'step_battle',
			battleMapId: 'battlemap_argos_artalon',
			activeBattleObjectiveIds: ['obj_extract'],
		});

		expect(shouldApplyArenaVictoryRewards({ battleContext: context })).toBe(false);
		expect(shouldUseArenaVictoryLogic({ battleContext: context })).toBe(false);
		expect(shouldApplyArenaVictoryRewards({ battleType: 'arena' })).toBe(true);
	});
});
