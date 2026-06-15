import { describe, expect, it } from 'vitest';
import {
	DistanceBand,
	TeamSide,
	createInitialBattleState,
	createQuestBattleContext,
	evacuateCarriedBodyAtZone,
	pickUpBattleObjectiveMarker,
	type ArenaCombatEntity,
	type BattleQuestObjectiveEffect,
} from './arena-battle';
import type { BattleMapExtractionZone, BattleMapObjective, BattleMapPlacedNpc } from './battle-map';
import { Race } from './races';

function playerEntity(): ArenaCombatEntity {
	return {
		id: 'player',
		name: 'Player',
		team: TeamSide.Left,
		race: Race.Human,
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

function wounded(id: string): BattleMapPlacedNpc {
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

const objective: BattleMapObjective = {
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

const extractionZone: BattleMapExtractionZone = {
	id: 'extraction_argos_banner',
	name: 'Argos Banner',
	cells: [{ x: 0, y: 0 }],
	allowedObjectiveTags: ['argos_wounded'],
	objectiveId: 'obj_extract_argos_wounded_5',
};

describe('battle objective emitter', () => {
	it('does not count the same body marker twice', () => {
		const state = createInitialBattleState({
			combatId: 'quest',
			entities: [playerEntity()],
			distance: DistanceBand.Melee,
			battleContext: createQuestBattleContext({
				questId: 'argos_quest_field_of_the_fallen',
				questStepId: 'step_extract',
				battleMapId: 'battlemap_argos_artalon',
				activeBattleObjectiveIds: ['obj_extract_argos_wounded_5'],
			}),
		});
		const marker = wounded('wounded_1');

		expect(pickUpBattleObjectiveMarker(state, marker, [objective]).ok).toBe(true);
		expect(evacuateCarriedBodyAtZone(state, [objective], extractionZone).progress?.currentCount).toBe(1);
		expect(pickUpBattleObjectiveMarker(state, marker, [objective]).ok).toBe(false);
		expect(state.battleObjectiveProgress?.[objective.id].currentCount).toBe(1);
	});

	it('emits quest objective completion at required progress', () => {
		const state = createInitialBattleState({
			combatId: 'quest',
			entities: [playerEntity()],
			distance: DistanceBand.Melee,
			battleContext: createQuestBattleContext({
				questId: 'argos_quest_field_of_the_fallen',
				questStepId: 'step_extract',
				battleMapId: 'battlemap_argos_artalon',
				activeBattleObjectiveIds: ['obj_extract_argos_wounded_5'],
			}),
		});

		let effects: BattleQuestObjectiveEffect[] = [];
		for (let index = 1; index <= 5; index += 1) {
			const marker = wounded(`wounded_${index}`);
			pickUpBattleObjectiveMarker(state, marker, [objective]);
			const result = evacuateCarriedBodyAtZone(state, [objective], extractionZone);
			effects = result.questEffects;
		}

		expect(state.battleObjectiveProgress?.[objective.id].currentCount).toBe(5);
		expect(state.questBattleResultState).toBe('objective_completed');
		expect(effects).toEqual([{
			type: 'complete_quest_objective',
			questId: 'argos_quest_field_of_the_fallen',
			objectiveId: 'obj_extract_argos_wounded',
			battleObjectiveId: 'obj_extract_argos_wounded_5',
		}]);
	});
});
