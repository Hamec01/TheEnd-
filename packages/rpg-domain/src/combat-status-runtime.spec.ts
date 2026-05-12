import { describe, expect, it } from 'vitest';
import type { ArenaCombatEntity } from './arena-battle';
import { TeamSide } from './arena-battle';
import type { CombatRuntimeItemEffect } from './combat-item-effect';
import { Race } from './races';
import { buildStatusResistanceImmunityProfile, tryApplyCombatStatus } from './combat-status-runtime';

function dummyEntity(overrides: Partial<ArenaCombatEntity> = {}): ArenaCombatEntity {
  return {
    id: 't1',
    name: 'Target',
    team: TeamSide.Right,
    race: Race.Human,
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

describe('combat-status-runtime', () => {
  it('apply_status respects immunity', () => {
    const target = dummyEntity();
    const profile = buildStatusResistanceImmunityProfile([
      { type: 'status_immunity', statusId: 'stunned', trigger: 'always' } as CombatRuntimeItemEffect,
    ]);
    const effect: CombatRuntimeItemEffect = {
      type: 'apply_status',
      statusId: 'stun',
      chancePercent: 100,
      durationTurns: 1,
      trigger: 'on_hit',
    };
    const r = tryApplyCombatStatus({
      effect,
      target,
      targetDefenseProfile: profile,
      sourceActorId: 'a1',
      rng: () => 0,
      rollChance: true,
    });
    expect(r.outcome).toBe('immune');
    expect(target.activeCombatStatuses?.length ?? 0).toBe(0);
  });

  it('apply_status reduces chance with resistance', () => {
    const target = dummyEntity();
    const profile = buildStatusResistanceImmunityProfile([
      { type: 'status_resistance', statusId: 'poisoned', percent: 50, trigger: 'always' } as CombatRuntimeItemEffect,
    ]);
    const effect: CombatRuntimeItemEffect = {
      type: 'apply_status',
      statusId: 'poison',
      chancePercent: 40,
      durationTurns: 2,
      trigger: 'on_hit',
    };
    const r = tryApplyCombatStatus({
      effect,
      target,
      targetDefenseProfile: profile,
      rng: () => 0.5,
      rollChance: true,
    });
    expect(r.finalChancePercent).toBe(20);
    expect(r.outcome).toBe('missed_chance');
  });
});
