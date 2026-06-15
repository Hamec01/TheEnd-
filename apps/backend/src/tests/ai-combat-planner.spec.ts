import { describe, expect, it } from 'vitest';
import {
  BattlefieldTileType,
  DistanceBand,
  Race,
  TeamSide,
  createArenaCombatEntity,
  createInitialBattleState,
  type ArenaCombatEntity,
} from '@theend/rpg-domain';
import { buildAiCombatTurnPlan } from '../combat/ai-combat-planner';

function createEntity(
  overrides: Partial<ArenaCombatEntity> & Pick<ArenaCombatEntity, 'id' | 'name' | 'team' | 'battlefieldX' | 'battlefieldY'>,
): ArenaCombatEntity {
  return createArenaCombatEntity({
    race: Race.Human,
    currentHp: 100,
    maxHp: 100,
    currentMp: 30,
    maxMp: 30,
    currentStamina: 30,
    maxStamina: 30,
    strength: 10,
    constitution: 10,
    dexterity: 10,
    intelligence: 10,
    luck: 10,
    perception: 10,
    willpower: 10,
    position: 0,
    attackRange: 1,
    ...overrides,
  });
}

describe('buildAiCombatTurnPlan', () => {
  it('routes melee around blocked tiles instead of trying to walk through them', () => {
    const actor = createEntity({
      id: 'melee',
      name: 'Melee',
      team: TeamSide.Right,
      battlefieldX: 0,
      battlefieldY: 1,
      strength: 14,
      combatStyleHint: 'MELEE',
    });
    const target = createEntity({
      id: 'player',
      name: 'Player',
      team: TeamSide.Left,
      battlefieldX: 3,
      battlefieldY: 1,
      isPlayer: true,
    });

    const battleState = createInitialBattleState({
      combatId: 'ai-path',
      entities: [actor, target],
      distance: DistanceBand.Far,
      battleMapWidth: 5,
      battleMapHeight: 4,
      viewportWidth: 5,
      viewportHeight: 4,
      battlefieldTiles: [
        { x: 1, y: 1, type: BattlefieldTileType.Blocked },
      ],
    });

    const plan = buildAiCombatTurnPlan({
      battleState,
      actorId: actor.id,
    }).plan;

    const moveCommand = plan.commands.find((command) => command.type === 'move' || command.type === 'dash');
    expect(moveCommand).toBeDefined();
    expect(moveCommand?.target.kind).toBe('cell');
    if (moveCommand?.target.kind === 'cell') {
      expect(moveCommand.target.x).not.toBe(1);
      expect(moveCommand.target.y).not.toBe(1);
    }
  });

  it('lets ranged AI shoot immediately when the target is already in weapon range', () => {
    const actor = createEntity({
      id: 'archer',
      name: 'Archer',
      team: TeamSide.Right,
      battlefieldX: 1,
      battlefieldY: 1,
      dexterity: 14,
      perception: 13,
      attackRange: 4,
      combatStyleHint: 'RANGED',
    });
    const target = createEntity({
      id: 'player',
      name: 'Player',
      team: TeamSide.Left,
      battlefieldX: 4,
      battlefieldY: 1,
      isPlayer: true,
    });

    const battleState = createInitialBattleState({
      combatId: 'ai-ranged',
      entities: [actor, target],
      distance: DistanceBand.Far,
      battleMapWidth: 6,
      battleMapHeight: 4,
      viewportWidth: 6,
      viewportHeight: 4,
    });

    const plan = buildAiCombatTurnPlan({
      battleState,
      actorId: actor.id,
    }).plan;

    expect(plan.commands[0]?.type).toBe('basic_attack');
  });

  it('lets mage AI cast a spell from spell range even when weapon range is too short', () => {
    const actor = createEntity({
      id: 'mage',
      name: 'Mage',
      team: TeamSide.Right,
      battlefieldX: 1,
      battlefieldY: 1,
      intelligence: 16,
      willpower: 14,
      attackRange: 1,
      combatStyleHint: 'MAGIC',
    }) as ArenaCombatEntity & {
      aiSkills?: Array<{ id: string; target: 'entity' | 'cell' | 'self'; range?: number; mpCost?: number }>;
    };
    actor.aiSkills = [
      {
        id: 'skill_lightning_bolt_01',
        target: 'entity',
        range: 4,
        mpCost: 4,
      },
    ];

    const target = createEntity({
      id: 'player',
      name: 'Player',
      team: TeamSide.Left,
      battlefieldX: 4,
      battlefieldY: 1,
      isPlayer: true,
    });

    const battleState = createInitialBattleState({
      combatId: 'ai-mage',
      entities: [actor, target],
      distance: DistanceBand.Far,
      battleMapWidth: 6,
      battleMapHeight: 4,
      viewportWidth: 6,
      viewportHeight: 4,
    });

    const plan = buildAiCombatTurnPlan({
      battleState,
      actorId: actor.id,
      personality: 'cautious',
    }).plan;

    expect(plan.commands[0]?.type).toBe('skill_cast');
    expect(plan.commands[0]?.payload?.skillId).toBe('skill_lightning_bolt_01');
  });
});
