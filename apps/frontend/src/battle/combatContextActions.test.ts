import { DistanceBand, Race, TeamSide, type ArenaBattleState, type ArenaCombatEntity } from '@theend/rpg-domain';
import { describe, expect, it } from 'vitest';
import { buildCombatContextActions, type SelectedCombatSource } from './combatContextActions';

function createEntity(id: string, team: TeamSide, x: number, y: number): ArenaCombatEntity {
  return {
    id,
    name: id,
    team,
    race: Race.Human,
    currentHp: 100,
    maxHp: 100,
    currentMp: 100,
    maxMp: 100,
    currentStamina: 100,
    maxStamina: 100,
    strength: 8,
    constitution: 8,
    dexterity: 8,
    intelligence: 12,
    luck: 8,
    perception: 8,
    willpower: 8,
    initiative: 10,
    isAlive: true,
    position: 0,
    battlefieldX: x,
    battlefieldY: y,
  } as ArenaCombatEntity;
}

describe('buildCombatContextActions', () => {
  it('emits content skill ids and configured range for ranged skill commands', () => {
    const actor = createEntity('player', TeamSide.Left, 1, 1);
    const enemy = createEntity('enemy', TeamSide.Right, 4, 1);
    const battleState: ArenaBattleState = {
      combatId: 'battle_1',
      battleMapWidth: 8,
      battleMapHeight: 8,
      viewportWidth: 8,
      viewportHeight: 8,
      roundNumber: 1,
      distance: DistanceBand.Melee,
      entities: [actor, enemy],
      battlefieldTiles: [],
      battlefieldTraps: [],
      logs: [],
      isFinished: false,
    } as ArenaBattleState;

    const selectedSource: SelectedCombatSource = {
      kind: 'skill',
      skillId: 'learned_ice_arrow',
      slotId: 'quick1',
    };

    const actions = buildCombatContextActions({
      selectedSource,
      clickedTarget: { kind: 'entity', entityId: 'enemy' },
      activeActor: actor,
      battleState,
      selectedSkill: {
        label: 'Ice Arrow',
        definition: {
          id: 'skill_ice_arrow_01',
          name: 'Ice Arrow',
          target: {
            targetType: 'single_enemy',
            range: 7,
            canTargetSelf: false,
            canTargetAllies: false,
            canTargetEnemies: true,
          },
        } as any,
      },
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.command?.payload?.skillId).toBe('skill_ice_arrow_01');
    expect(actions[0]?.command?.payload?.skillRange).toBe(7);
  });
});