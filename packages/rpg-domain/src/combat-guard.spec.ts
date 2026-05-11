import { describe, expect, it } from 'vitest';
import {
  applyGuardMitigation,
  calculateGuardEndRoundRegen,
  createGuardState,
  getGuardEquipmentBonus,
} from './combat-guard';

describe('combat guard', () => {
  it('creates stronger guard state with shield bonus', () => {
    const guard = createGuardState({
      type: 'strong_guard',
      roundNumber: 3,
      stepIndex: 1,
      actor: { hasShield: true },
    });

    expect(guard.type).toBe('strong_guard');
    expect(guard.blockChanceBonus).toBeGreaterThanOrEqual(30);
    expect(guard.physicalResistanceBonus).toBeGreaterThanOrEqual(20);
    expect(guard.magicResistanceBonus).toBe(5);
  });

  it('does not downgrade strong guard when guard is applied later', () => {
    const strong = createGuardState({
      type: 'strong_guard',
      roundNumber: 1,
      stepIndex: 0,
      actor: {},
    });

    const laterGuard = createGuardState({
      type: 'guard',
      roundNumber: 1,
      stepIndex: 2,
      actor: {},
      previous: strong,
    });

    expect(laterGuard.type).toBe('strong_guard');
    expect(laterGuard.appliedStep).toBe(0);
  });

  it('reduces physical damage and may partially block', () => {
    const guard = createGuardState({
      type: 'strong_guard',
      roundNumber: 1,
      stepIndex: 0,
      actor: {},
    });

    const sequence = [0.3, 0.9];
    let index = 0;
    const result = applyGuardMitigation({
      guardState: guard,
      defender: {},
      incomingDamage: 20,
      damageKind: 'physical',
      attackCommandType: 'basic_attack',
      random: () => sequence[index++] ?? 0.9,
    });

    expect(result.finalDamage).toBeLessThan(20);
    expect(result.blocked || result.partiallyBlocked).toBe(true);
  });

  it('heavy attack can break strong guard', () => {
    const guard = createGuardState({
      type: 'strong_guard',
      roundNumber: 1,
      stepIndex: 0,
      actor: {},
    });

    const sequence = [0.99, 0.01];
    let index = 0;
    const result = applyGuardMitigation({
      guardState: guard,
      defender: {},
      incomingDamage: 30,
      damageKind: 'physical',
      attackCommandType: 'heavy_attack',
      random: () => sequence[index++] ?? 0.5,
    });

    expect(result.guardBroken).toBe(true);
  });

  it('applies magic mitigation but does not fully negate magic damage', () => {
    const guard = createGuardState({
      type: 'strong_guard',
      roundNumber: 2,
      stepIndex: 1,
      actor: {},
    });

    const result = applyGuardMitigation({
      guardState: guard,
      defender: {},
      incomingDamage: 40,
      damageKind: 'magical',
      random: () => 0.5,
    });

    expect(result.finalDamage).toBeLessThan(40);
    expect(result.finalDamage).toBeGreaterThan(0);
    expect(result.blocked).toBe(false);
  });

  it('calculates end-round regen percentages for strong guard', () => {
    const guard = createGuardState({
      type: 'strong_guard',
      roundNumber: 5,
      stepIndex: 2,
      actor: {},
    });

    const regen = calculateGuardEndRoundRegen({
      guardState: guard,
      maxHp: 100,
      maxMp: 80,
      maxStamina: 60,
    });

    expect(regen).toEqual({ hp: 2, mp: 2, stamina: 3 });
  });

  it('shield bonus enables better projectile blocking profile', () => {
    const withShield = getGuardEquipmentBonus({ hasShield: true });
    const withoutShield = getGuardEquipmentBonus({ hasShield: false });

    expect(withShield.projectileBlockBonus).toBeGreaterThan(withoutShield.projectileBlockBonus);
  });
});
