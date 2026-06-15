import { describe, expect, it } from 'vitest';
import {
	DistanceBand,
	TeamSide,
	createInitialBattleState,
	createNpcAction,
	getHostileEntities,
	type ArenaCombatEntity,
} from './arena-battle';
import { Race } from './races';
import type { GlobalRelation } from './diplomacy';

function entity(overrides: Partial<ArenaCombatEntity> & Pick<ArenaCombatEntity, 'id' | 'team'>): ArenaCombatEntity {
	return {
		id: overrides.id,
		name: overrides.name ?? overrides.id,
		team: overrides.team,
		race: overrides.race ?? Race.Human,
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

describe('arena battle relation integration', () => {
	it('keeps legacy Left/Right hostility without relation context', () => {
		const player = entity({ id: 'player', team: TeamSide.Left, isPlayer: true, battlefieldX: 0, battlefieldY: 0 });
		const enemy = entity({ id: 'enemy', team: TeamSide.Right, isNpc: true, battlefieldX: 1, battlefieldY: 0 });
		const state = createInitialBattleState({
			combatId: 'legacy',
			entities: [player, enemy],
			distance: DistanceBand.Melee,
		});

		expect(getHostileEntities(state, enemy).map((item) => item.id)).toEqual(['player']);
		expect(createNpcAction(state, 'enemy').targetId).toBe('player');
	});

	it('uses global relations for same-team NPC target selection', () => {
		const relations: GlobalRelation[] = [{
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
		const argos = entity({ id: 'argos_soldier', team: TeamSide.Right, isNpc: true, kingdomId: 'argos', battlefieldX: 0, battlefieldY: 0 });
		const artalon = entity({ id: 'artalon_soldier', team: TeamSide.Right, isNpc: true, kingdomId: 'artalon', battlefieldX: 1, battlefieldY: 0 });
		const state = createInitialBattleState({
			combatId: 'quest',
			entities: [argos, artalon],
			distance: DistanceBand.Melee,
			globalRelations: relations,
		});

		expect(getHostileEntities(state, argos).map((item) => item.id)).toEqual(['artalon_soldier']);
		expect(createNpcAction(state, 'argos_soldier').targetId).toBe('artalon_soldier');
	});
});
