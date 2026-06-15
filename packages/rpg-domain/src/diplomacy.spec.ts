import { describe, expect, it } from 'vitest';
import {
	canActorUseSkillByCombatPolicy,
	normalizeDiplomaticActorId,
	resolveActorIdentity,
	resolveCombatRelation,
	type DiplomaticActorDefinition,
	type GlobalRelation,
} from './diplomacy';

describe('diplomacy resolver', () => {
	it('normalizes legacy kingdom aliases', () => {
		expect(normalizeDiplomaticActorId('Аргос')).toBe('argos');
		expect(normalizeDiplomaticActorId('Argos')).toBe('argos');
	});

	it('supports mutual relations in both directions', () => {
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
		const argos = resolveActorIdentity({ id: 'argos_guard', kingdomId: 'argos', raceId: 'human' });
		const artalon = resolveActorIdentity({ id: 'artalon_guard', kingdomId: 'artalon', raceId: 'human' });

		expect(resolveCombatRelation(argos, artalon, relations).attackOnSight).toBe(true);
		expect(resolveCombatRelation(artalon, argos, relations).attackOnSight).toBe(true);
	});

	it('keeps directional relations one-way when not mutual', () => {
		const relations: GlobalRelation[] = [{
			id: 'rel_one_way',
			sourceActorType: 'kingdom',
			sourceActorId: 'argos',
			targetActorType: 'kingdom',
			targetActorId: 'artalon',
			value: -80,
			createdAt: '',
			updatedAt: '',
		}];
		const argos = resolveActorIdentity({ id: 'argos_guard', kingdomId: 'argos' });
		const artalon = resolveActorIdentity({ id: 'artalon_guard', kingdomId: 'artalon' });

		expect(resolveCombatRelation(argos, artalon, relations).isHostile).toBe(true);
		expect(resolveCombatRelation(artalon, argos, relations).isNeutral).toBe(true);
	});

	it('uses kingdom hostility over race neutrality', () => {
		const relations: GlobalRelation[] = [
			{
				id: 'rel_human_human',
				sourceActorType: 'race',
				sourceActorId: 'human',
				targetActorType: 'race',
				targetActorId: 'human',
				value: 40,
				isMutual: true,
				createdAt: '',
				updatedAt: '',
			},
			{
				id: 'rel_argos_artalon',
				sourceActorType: 'kingdom',
				sourceActorId: 'argos',
				targetActorType: 'kingdom',
				targetActorId: 'artalon',
				value: -100,
				isMutual: true,
				createdAt: '',
				updatedAt: '',
			},
		];
		const argosHuman = resolveActorIdentity({ id: 'argos_human', kingdomId: 'Аргос', raceId: 'human' });
		const artalonHuman = resolveActorIdentity({ id: 'artalon_human', kingdomId: 'artalon', raceId: 'human' });
		const relation = resolveCombatRelation(argosHuman, artalonHuman, relations);

		expect(relation.source).toBe('kingdom');
		expect(relation.value).toBe(-100);
		expect(relation.isHostile).toBe(true);
	});

	it('falls back to neutral without matching relations', () => {
		const argos = resolveActorIdentity({ id: 'argos_guard', kingdomId: 'argos' });
		const wolf = resolveActorIdentity({ id: 'wolf', groupId: 'wolves' });

		expect(resolveCombatRelation(argos, wolf, []).isNeutral).toBe(true);
	});

	it('blocks magic skills through actor combat policy', () => {
		const actors: DiplomaticActorDefinition[] = [{
			id: 'argos',
			actorType: 'kingdom',
			name: 'Argos',
			combatPolicy: {
				magicPolicy: 'forbidden',
				forbiddenSkillTags: ['magic', 'elemental'],
			},
			createdAt: '',
			updatedAt: '',
		}];
		const argosSoldier = resolveActorIdentity({ id: 'soldier', kingdomId: 'Аргос' });

		expect(canActorUseSkillByCombatPolicy(argosSoldier, actors, { id: 'fireball', tags: ['magic', 'fire'] })).toBe(false);
		expect(canActorUseSkillByCombatPolicy(argosSoldier, actors, { id: 'slash', tags: ['melee'] })).toBe(true);
	});
});
