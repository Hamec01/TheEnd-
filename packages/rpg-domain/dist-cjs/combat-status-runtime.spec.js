"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const arena_battle_1 = require("./arena-battle");
const races_1 = require("./races");
const combat_status_runtime_1 = require("./combat-status-runtime");
function dummyEntity(overrides = {}) {
    return {
        id: 't1',
        name: 'Target',
        team: arena_battle_1.TeamSide.Right,
        race: races_1.Race.Human,
        currentHp: 50,
        maxHp: 50,
        currentMp: 10,
        maxMp: 10,
        currentStamina: 20,
        maxStamina: 20,
        strength: 10,
        constitution: 10,
        dexterity: 10,
        intelligence: 10,
        luck: 10,
        perception: 10,
        willpower: 10,
        initiative: 10,
        isAlive: true,
        position: 0,
        activeCombatStatuses: [],
        ...overrides,
    };
}
(0, vitest_1.describe)('combat-status-runtime', () => {
    (0, vitest_1.it)('apply_status respects immunity', () => {
        const target = dummyEntity();
        const profile = (0, combat_status_runtime_1.buildStatusResistanceImmunityProfile)([
            { type: 'status_immunity', statusId: 'stunned', trigger: 'always' },
        ]);
        const effect = {
            type: 'apply_status',
            statusId: 'stun',
            chancePercent: 100,
            durationTurns: 1,
            trigger: 'on_hit',
        };
        const r = (0, combat_status_runtime_1.tryApplyCombatStatus)({
            effect,
            target,
            targetDefenseProfile: profile,
            sourceActorId: 'a1',
            rng: () => 0,
            rollChance: true,
        });
        (0, vitest_1.expect)(r.outcome).toBe('immune');
        (0, vitest_1.expect)(target.activeCombatStatuses?.length ?? 0).toBe(0);
    });
    (0, vitest_1.it)('apply_status reduces chance with resistance', () => {
        const target = dummyEntity();
        const profile = (0, combat_status_runtime_1.buildStatusResistanceImmunityProfile)([
            { type: 'status_resistance', statusId: 'poisoned', percent: 50, trigger: 'always' },
        ]);
        const effect = {
            type: 'apply_status',
            statusId: 'poison',
            chancePercent: 40,
            durationTurns: 2,
            trigger: 'on_hit',
        };
        const r = (0, combat_status_runtime_1.tryApplyCombatStatus)({
            effect,
            target,
            targetDefenseProfile: profile,
            rng: () => 0.5,
            rollChance: true,
        });
        (0, vitest_1.expect)(r.finalChancePercent).toBe(20);
        (0, vitest_1.expect)(r.outcome).toBe('missed_chance');
    });
});
