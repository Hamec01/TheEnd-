import { describe, expect, it } from 'vitest';
import { BattlefieldTileType, TeamSide, type ArenaBattleState, type ArenaCombatEntity, type CombatCommand } from './index';
import { revalidateCombatCommandBeforeExecute } from './combat-plan';

function createEntity(id: string, team: TeamSide, x: number, y: number): ArenaCombatEntity {
  return {
    id,
    name: id,
    team,
    race: 'human',
    level: 1,
    currentHp: 100,
    maxHp: 100,
    currentMp: 100,
    maxMp: 100,
    currentStamina: 100,
    maxStamina: 100,
    strength: 5,
    dexterity: 5,
    intelligence: 10,
    perception: 5,
    luck: 5,
    willpower: 5,
    constitution: 5,
    attackRange: 1,
    isAlive: true,
    battlefieldX: x,
    battlefieldY: y,
    activeCombatStatuses: [],
  } as unknown as ArenaCombatEntity;
}

function createBattleState(): ArenaBattleState {
  return {
    combatId: 'battle_skill_range',
    battleMapWidth: 8,
    battleMapHeight: 8,
    viewportWidth: 8,
    viewportHeight: 8,
    roundNumber: 1,
    distance: 1 as any,
    entities: [
      createEntity('player', TeamSide.Left, 1, 1),
      createEntity('enemy', TeamSide.Right, 4, 1),
    ],
    battlefieldTiles: [],
    battlefieldTraps: [],
    logs: [],
    isFinished: false,
  } as unknown as ArenaBattleState;
}

describe('skill cast revalidation', () => {
  it('uses skillRange from command payload instead of actor attackRange', () => {
    const battleState = createBattleState();
    const command: CombatCommand = {
      id: 'cmd_skill',
      type: 'skill_cast',
      target: { kind: 'entity', entityId: 'enemy' },
      apCost: 1,
      costs: {},
      payload: {
        skillId: 'skill_ice_arrow_01',
        skillRange: 7,
      },
      createdAt: new Date().toISOString(),
    };

    const result = revalidateCombatCommandBeforeExecute({
      battleState,
      actorId: 'player',
      command,
    });

    expect(result.ok).toBe(true);
  });

  it('rejects ranged skill targets beyond configured max range', () => {
    const battleState = createBattleState();
    const command: CombatCommand = {
      id: 'cmd_skill_far',
      type: 'skill_cast',
      target: { kind: 'entity', entityId: 'enemy' },
      apCost: 1,
      costs: {},
      payload: {
        skillId: 'skill_ice_arrow_01',
        skillRange: 2,
      },
      createdAt: new Date().toISOString(),
    };

    const result = revalidateCombatCommandBeforeExecute({
      battleState,
      actorId: 'player',
      command,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('target_out_of_range');
  });

  it('rejects ranged skill targets behind blocked line of sight', () => {
    const battleState = createBattleState();
    battleState.battlefieldTiles = [{ x: 2, y: 1, type: BattlefieldTileType.HighCover } as any];
    const command: CombatCommand = {
      id: 'cmd_skill_los',
      type: 'skill_cast',
      target: { kind: 'entity', entityId: 'enemy' },
      apCost: 1,
      costs: {},
      payload: {
        skillId: 'skill_ice_arrow_01',
        skillRange: 7,
      },
      createdAt: new Date().toISOString(),
    };

    const result = revalidateCombatCommandBeforeExecute({
      battleState,
      actorId: 'player',
      command,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('line_of_sight_blocked');
  });
});