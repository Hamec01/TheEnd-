"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const combat_guard_1 = require("./combat-guard");
(0, vitest_1.describe)('combat guard', () => {
    (0, vitest_1.it)('creates stronger guard state with shield bonus', () => {
        const guard = (0, combat_guard_1.createGuardState)({
            type: 'strong_guard',
            roundNumber: 3,
            stepIndex: 1,
            actor: { hasShield: true },
        });
        (0, vitest_1.expect)(guard.type).toBe('strong_guard');
        (0, vitest_1.expect)(guard.blockChanceBonus).toBeGreaterThanOrEqual(30);
        (0, vitest_1.expect)(guard.physicalResistanceBonus).toBeGreaterThanOrEqual(20);
        (0, vitest_1.expect)(guard.magicResistanceBonus).toBe(5);
    });
    (0, vitest_1.it)('does not downgrade strong guard when guard is applied later', () => {
        const strong = (0, combat_guard_1.createGuardState)({
            type: 'strong_guard',
            roundNumber: 1,
            stepIndex: 0,
            actor: {},
        });
        const laterGuard = (0, combat_guard_1.createGuardState)({
            type: 'guard',
            roundNumber: 1,
            stepIndex: 2,
            actor: {},
            previous: strong,
        });
        (0, vitest_1.expect)(laterGuard.type).toBe('strong_guard');
        (0, vitest_1.expect)(laterGuard.appliedStep).toBe(0);
    });
    (0, vitest_1.it)('reduces physical damage and may partially block', () => {
        const guard = (0, combat_guard_1.createGuardState)({
            type: 'strong_guard',
            roundNumber: 1,
            stepIndex: 0,
            actor: {},
        });
        const sequence = [0.3, 0.9];
        let index = 0;
        const result = (0, combat_guard_1.applyGuardMitigation)({
            guardState: guard,
            defender: {},
            incomingDamage: 20,
            damageKind: 'physical',
            attackCommandType: 'basic_attack',
            random: () => sequence[index++] ?? 0.9,
        });
        (0, vitest_1.expect)(result.finalDamage).toBeLessThan(20);
        (0, vitest_1.expect)(result.blocked || result.partiallyBlocked).toBe(true);
    });
    (0, vitest_1.it)('heavy attack can break strong guard', () => {
        const guard = (0, combat_guard_1.createGuardState)({
            type: 'strong_guard',
            roundNumber: 1,
            stepIndex: 0,
            actor: {},
        });
        const sequence = [0.99, 0.01];
        let index = 0;
        const result = (0, combat_guard_1.applyGuardMitigation)({
            guardState: guard,
            defender: {},
            incomingDamage: 30,
            damageKind: 'physical',
            attackCommandType: 'heavy_attack',
            random: () => sequence[index++] ?? 0.5,
        });
        (0, vitest_1.expect)(result.guardBroken).toBe(true);
    });
    (0, vitest_1.it)('applies magic mitigation but does not fully negate magic damage', () => {
        const guard = (0, combat_guard_1.createGuardState)({
            type: 'strong_guard',
            roundNumber: 2,
            stepIndex: 1,
            actor: {},
        });
        const result = (0, combat_guard_1.applyGuardMitigation)({
            guardState: guard,
            defender: {},
            incomingDamage: 40,
            damageKind: 'magical',
            random: () => 0.5,
        });
        (0, vitest_1.expect)(result.finalDamage).toBeLessThan(40);
        (0, vitest_1.expect)(result.finalDamage).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.blocked).toBe(false);
    });
    (0, vitest_1.it)('calculates end-round regen percentages for strong guard', () => {
        const guard = (0, combat_guard_1.createGuardState)({
            type: 'strong_guard',
            roundNumber: 5,
            stepIndex: 2,
            actor: {},
        });
        const regen = (0, combat_guard_1.calculateGuardEndRoundRegen)({
            guardState: guard,
            maxHp: 100,
            maxMp: 80,
            maxStamina: 60,
        });
        (0, vitest_1.expect)(regen).toEqual({ hp: 2, mp: 2, stamina: 3 });
    });
    (0, vitest_1.it)('shield bonus enables better projectile blocking profile', () => {
        const withShield = (0, combat_guard_1.getGuardEquipmentBonus)({ hasShield: true });
        const withoutShield = (0, combat_guard_1.getGuardEquipmentBonus)({ hasShield: false });
        (0, vitest_1.expect)(withShield.projectileBlockBonus).toBeGreaterThan(withoutShield.projectileBlockBonus);
    });
});
