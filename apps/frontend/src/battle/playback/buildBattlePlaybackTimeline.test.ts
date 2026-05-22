import { describe, expect, it } from 'vitest';
import type { ArenaBattleState, CombatAnimationEvent, CombatEvent } from '@theend/rpg-domain';
import { buildBattlePlaybackTimeline } from './buildBattlePlaybackTimeline';

function createState(x: number, y: number): ArenaBattleState {
  return {
    combatId: 'battle_test',
    roundNumber: 1,
    activeActorId: 'player',
    currentTurnAp: 2,
    isFinished: false,
    winner: null,
    distance: 1,
    logs: [],
    battlefieldTiles: [],
    battlefieldTraps: [],
    battleMapWidth: 8,
    battleMapHeight: 8,
    viewportWidth: 8,
    viewportHeight: 8,
    entities: [
      {
        id: 'player',
        name: 'Player',
        team: 'LEFT' as any,
        race: 'human',
        level: 1,
        currentHp: 10,
        maxHp: 10,
        currentMp: 5,
        maxMp: 5,
        currentStamina: 5,
        maxStamina: 5,
        strength: 5,
        dexterity: 5,
        intelligence: 5,
        attackRange: 1,
        isAlive: true,
        battlefieldX: x,
        battlefieldY: y,
        activeCombatStatuses: [],
      } as any,
    ],
    recentAnimationEvents: [],
  } as unknown as ArenaBattleState;
}

describe('buildBattlePlaybackTimeline', () => {
  it('does not duplicate move_token when backend animation already exists', () => {
    const combatEvents: CombatEvent[] = [
      {
        id: 'evt_move',
        roundNumber: 1,
        stepIndex: 0,
        type: 'movement',
        actorId: 'player',
        data: {
          from: { x: 1, y: 1 },
          to: { x: 2, y: 1 },
          movementType: 'walk',
        },
      } as unknown as CombatEvent,
    ];
    const recentAnimationEvents: CombatAnimationEvent[] = [
      {
        id: 'anim_move',
        roundNumber: 1,
        stepIndex: 0,
        type: 'move_token',
        actorId: 'player',
        from: { x: 1, y: 1 },
        to: { x: 2, y: 1 },
        movementType: 'walk',
      },
    ];

    const phases = buildBattlePlaybackTimeline({
      combatEvents,
      recentAnimationEvents,
      previousBattleState: createState(1, 1),
      finalBattleState: createState(2, 1),
    });

    const movementEventCount = phases
      .filter((phase) => phase.kind === 'movement')
      .reduce((sum, phase) => sum + phase.events.length, 0);
    expect(movementEventCount).toBe(1);
  });
});