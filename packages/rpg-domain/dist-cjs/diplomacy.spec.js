"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const diplomacy_1 = require("./diplomacy");
(0, vitest_1.describe)('diplomacy resolver', () => {
    (0, vitest_1.it)('normalizes legacy kingdom aliases', () => {
        (0, vitest_1.expect)((0, diplomacy_1.normalizeDiplomaticActorId)('Аргос')).toBe('argos');
        (0, vitest_1.expect)((0, diplomacy_1.normalizeDiplomaticActorId)('Argos')).toBe('argos');
    });
    (0, vitest_1.it)('supports mutual relations in both directions', () => {
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
        const argos = (0, diplomacy_1.resolveActorIdentity)({ id: 'argos_guard', kingdomId: 'argos', raceId: 'human' });
        const artalon = (0, diplomacy_1.resolveActorIdentity)({ id: 'artalon_guard', kingdomId: 'artalon', raceId: 'human' });
        (0, vitest_1.expect)((0, diplomacy_1.resolveCombatRelation)(argos, artalon, relations).attackOnSight).toBe(true);
        (0, vitest_1.expect)((0, diplomacy_1.resolveCombatRelation)(artalon, argos, relations).attackOnSight).toBe(true);
    });
    (0, vitest_1.it)('keeps directional relations one-way when not mutual', () => {
        const relations = [{
                id: 'rel_one_way',
                sourceActorType: 'kingdom',
                sourceActorId: 'argos',
                targetActorType: 'kingdom',
                targetActorId: 'artalon',
                value: -80,
                createdAt: '',
                updatedAt: '',
            }];
        const argos = (0, diplomacy_1.resolveActorIdentity)({ id: 'argos_guard', kingdomId: 'argos' });
        const artalon = (0, diplomacy_1.resolveActorIdentity)({ id: 'artalon_guard', kingdomId: 'artalon' });
        (0, vitest_1.expect)((0, diplomacy_1.resolveCombatRelation)(argos, artalon, relations).isHostile).toBe(true);
        (0, vitest_1.expect)((0, diplomacy_1.resolveCombatRelation)(artalon, argos, relations).isNeutral).toBe(true);
    });
    (0, vitest_1.it)('uses kingdom hostility over race neutrality', () => {
        const relations = [
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
        const argosHuman = (0, diplomacy_1.resolveActorIdentity)({ id: 'argos_human', kingdomId: 'Аргос', raceId: 'human' });
        const artalonHuman = (0, diplomacy_1.resolveActorIdentity)({ id: 'artalon_human', kingdomId: 'artalon', raceId: 'human' });
        const relation = (0, diplomacy_1.resolveCombatRelation)(argosHuman, artalonHuman, relations);
        (0, vitest_1.expect)(relation.source).toBe('kingdom');
        (0, vitest_1.expect)(relation.value).toBe(-100);
        (0, vitest_1.expect)(relation.isHostile).toBe(true);
    });
    (0, vitest_1.it)('falls back to neutral without matching relations', () => {
        const argos = (0, diplomacy_1.resolveActorIdentity)({ id: 'argos_guard', kingdomId: 'argos' });
        const wolf = (0, diplomacy_1.resolveActorIdentity)({ id: 'wolf', groupId: 'wolves' });
        (0, vitest_1.expect)((0, diplomacy_1.resolveCombatRelation)(argos, wolf, []).isNeutral).toBe(true);
    });
    (0, vitest_1.it)('blocks magic skills through actor combat policy', () => {
        const actors = [{
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
        const argosSoldier = (0, diplomacy_1.resolveActorIdentity)({ id: 'soldier', kingdomId: 'Аргос' });
        (0, vitest_1.expect)((0, diplomacy_1.canActorUseSkillByCombatPolicy)(argosSoldier, actors, { id: 'fireball', tags: ['magic', 'fire'] })).toBe(false);
        (0, vitest_1.expect)((0, diplomacy_1.canActorUseSkillByCombatPolicy)(argosSoldier, actors, { id: 'slash', tags: ['melee'] })).toBe(true);
    });
});
