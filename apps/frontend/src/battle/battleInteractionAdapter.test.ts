import { BattlefieldTileType, DistanceBand, MovementType, Race, TeamSide, type ArenaCombatEntity, type BattlefieldTile } from '@theend/rpg-domain';
import { describe, expect, it } from 'vitest';
import type { SelectedCombatSource } from './combatContextActions';
import { createBattleInteractionAdapter, type BattleInteractionAdapterInput } from './battleInteractionAdapter';

function createEntity(overrides: Partial<ArenaCombatEntity> & Pick<ArenaCombatEntity, 'id' | 'name' | 'team'>): ArenaCombatEntity {
  return {
    race: Race.Human,
    currentHp: 100,
    maxHp: 100,
    currentMp: 20,
    maxMp: 20,
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
    battlefieldX: 0,
    battlefieldY: 0,
    ...overrides,
  };
}

function createInput(overrides?: {
  entities?: ArenaCombatEntity[];
  battlefieldTiles?: BattlefieldTile[];
  selectedTargetId?: string | null;
  selectedSource?: SelectedCombatSource;
  movementType?: MovementType | null;
  availableSkills?: BattleInteractionAdapterInput['availableSkills'];
  resolveAdminItemById?: (itemId: string) => unknown | null;
}): BattleInteractionAdapterInput {
  const entities = overrides?.entities ?? [
    createEntity({ id: 'player', name: 'Player', team: TeamSide.Left, battlefieldX: 1, battlefieldY: 1, dexterity: 8, strength: 12 }),
    createEntity({ id: 'enemy', name: 'Enemy', team: TeamSide.Right, battlefieldX: 4, battlefieldY: 1, dexterity: 12, strength: 8, attackRange: 4 }),
  ];
  return {
    entities,
    battlefieldTiles: overrides?.battlefieldTiles ?? [],
    battleMapWidth: 6,
    battleMapHeight: 6,
    distance: DistanceBand.Melee,
    playerId: 'player',
    selectedTargetId: overrides?.selectedTargetId ?? 'enemy',
    selectedSource: overrides?.selectedSource ?? { kind: 'none' as const },
    movementType: overrides?.movementType ?? null,
    availableSkills: overrides?.availableSkills ?? [
      {
        skillId: 'fireball',
        definition: {
          id: 'fireball',
          name: 'Fireball',
          target: { targetType: 'cell', range: 2 },
        } as any,
      },
      {
        skillId: 'heal',
        definition: {
          id: 'heal',
          name: 'Heal',
          target: { targetType: 'entity', range: 2, canTargetSelf: true, canTargetAllies: true, canTargetEnemies: false },
        } as any,
      },
    ],
    resolveAdminItemById: overrides?.resolveAdminItemById,
  };
}

describe('battleInteractionAdapter', () => {
  it('produces the same movable cells for props-like and snapshot-like inputs', () => {
    const input = createInput({
      battlefieldTiles: [{ x: 2, y: 1, type: BattlefieldTileType.LowCover, movementCost: 2 }],
    });

    const snapshotLikeInput: BattleInteractionAdapterInput & {
      widthPx: number;
      heightPx: number;
      sceneCellSize: number;
    } = {
      ...input,
      widthPx: 720,
      heightPx: 520,
      sceneCellSize: 48,
    };

    const fromProps = createBattleInteractionAdapter(input);
    const fromSnapshot = createBattleInteractionAdapter(snapshotLikeInput);

    expect([...fromProps.movableCells.entries()]).toEqual([...fromSnapshot.movableCells.entries()]);
  });

  it('blocks movement through blocked and high cover cells but keeps low cover walkable', () => {
    const adapter = createBattleInteractionAdapter(createInput({
      battlefieldTiles: [
        { x: 2, y: 1, type: BattlefieldTileType.Blocked },
        { x: 1, y: 2, type: BattlefieldTileType.HighCover },
        { x: 0, y: 1, type: BattlefieldTileType.LowCover, movementCost: 2 },
      ],
    }));

    expect(adapter.movableCells.has('2:1')).toBe(false);
    expect(adapter.movableCells.has('1:2')).toBe(false);
    expect(adapter.movableCells.has('0:1')).toBe(true);
  });

  it('respects line of sight for ranged targeting', () => {
    const entities = [
      createEntity({ id: 'player', name: 'Player', team: TeamSide.Left, battlefieldX: 1, battlefieldY: 1, attackRange: 4, dexterity: 14, strength: 8 }),
      createEntity({ id: 'enemy', name: 'Enemy', team: TeamSide.Right, battlefieldX: 4, battlefieldY: 1 }),
    ];
    const adapter = createBattleInteractionAdapter(createInput({
      entities,
      battlefieldTiles: [{ x: 3, y: 1, type: BattlefieldTileType.HighCover }],
    }));

    expect(adapter.targetableCells.has('1:1')).toBe(false);
    expect(adapter.hasLineOfSight(1, 1, 4, 1)).toBe(false);
  });

  it('respects adjacency for melee targeting', () => {
    const adapter = createBattleInteractionAdapter(createInput({
      entities: [
        createEntity({ id: 'player', name: 'Player', team: TeamSide.Left, battlefieldX: 1, battlefieldY: 1, strength: 12, dexterity: 8 }),
        createEntity({ id: 'enemy', name: 'Enemy', team: TeamSide.Right, battlefieldX: 4, battlefieldY: 1 }),
      ],
    }));

    expect(adapter.targetableCells.has('3:1')).toBe(true);
    expect(adapter.targetableCells.has('1:1')).toBe(false);
  });

  it('computes targetable cells for selected skill and item sources', () => {
    const skillAdapter = createBattleInteractionAdapter(createInput({
      selectedSource: { kind: 'skill', skillId: 'skill_fireball_content' },
      availableSkills: [
        {
          skillId: 'learned_fireball',
          definition: {
            id: 'skill_fireball_content',
            name: 'Fireball',
            target: { targetType: 'cell', range: 2 },
            cast: { requiresLineOfSight: true },
          } as any,
        },
      ],
    }));
    const itemAdapter = createBattleInteractionAdapter(createInput({
      selectedSource: { kind: 'item', itemId: 'bomb' },
      resolveAdminItemById: () => ({ itemSubType: 'bomb', itemType: 'explosive', name: 'Bomb' }),
    }));

    expect(skillAdapter.targetableCells.has('3:1')).toBe(true);
    expect(skillAdapter.targetableCells.has('4:1')).toBe(false);
    expect(itemAdapter.targetableCells.has('5:5')).toBe(true);
  });

  it('blocks ranged skill targetable cells behind line of sight obstacles', () => {
    const adapter = createBattleInteractionAdapter(createInput({
      battlefieldTiles: [{ x: 2, y: 1, type: BattlefieldTileType.HighCover }],
      selectedSource: { kind: 'skill', skillId: 'skill_ice_arrow_01' },
      availableSkills: [
        {
          skillId: 'learned_ice_arrow',
          definition: {
            id: 'skill_ice_arrow_01',
            name: 'Ice Arrow',
            target: { targetType: 'single_enemy', range: 7, canTargetSelf: false, canTargetAllies: false, canTargetEnemies: true },
            cast: { requiresLineOfSight: true },
          } as any,
        },
      ],
    }));

    expect(adapter.targetableCells.has('4:1')).toBe(false);
  });

  it('classifies enemy, walkable, and blocked clicks consistently', () => {
    const adapter = createBattleInteractionAdapter(createInput({
      battlefieldTiles: [{ x: 5, y: 5, type: BattlefieldTileType.Blocked }],
    }));

    const enemyTarget = adapter.resolveClickedTarget(4, 1);
    const walkableTarget = adapter.resolveClickedTarget(0, 1);
    const blockedTarget = adapter.resolveClickedTarget(5, 5);

    expect(enemyTarget.kind).toBe('entity');
    expect(adapter.toClickedCombatTarget(enemyTarget)).toEqual({ kind: 'entity', entityId: 'enemy' });
    expect(walkableTarget.kind).toBe('cell');
    expect(adapter.toClickedCombatTarget(walkableTarget)).toEqual({ kind: 'cell', x: 0, y: 1 });
    expect(blockedTarget.kind).toBe('blocked');
    expect(adapter.toClickedCombatTarget(blockedTarget)).toBeNull();
    expect(blockedTarget.kind === 'blocked' ? blockedTarget.cell.x : -1).toBe(5);
  });
});