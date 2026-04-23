import { describe, expect, it } from 'vitest';
import {
  buyItem,
  canEquipItem,
  equipItem,
  initializeCombat,
  resolveAction,
  toCombatReadyEntity,
  type CharacterData,
} from './index';
import {
  ActionType,
  BATTLEFIELD_GRID_SIZE,
  DistanceBand,
  TargetZone,
  TeamSide,
  createNpcAction,
  createArenaCombatEntity,
  createInitialBattleState,
  getBattlefieldTilePlacements,
  resolveRound,
} from './arena-battle';
import { Race } from './races';

describe('shop', () => {
  it('deducts gold and adds inventory item on purchase', () => {
    const result = buyItem(
      {
        gold: 200,
        items: [],
      },
      'iron_sword',
    );

    expect(result.ok).toBe(true);
    expect(result.inventory.gold).toBe(60);
    expect(result.inventory.items[0].itemId).toBe('iron_sword');
    expect(result.inventory.items[0].quantity).toBe(1);
  });
});

describe('equipment', () => {
  it('prevents equip when stat requirement is not met', () => {
    const check = canEquipItem(
      {
        hp: 50,
        mp: 60,
        stamina: 60,
        strength: 4,
        constitution: 5,
        dexterity: 5,
        intelligence: 5,
        luck: 5,
        perception: 5,
        willpower: 5,
      },
      'iron_sword',
    );

    expect(check.ok).toBe(false);
  });

  it('equips item into correct slot', () => {
    const equipment = equipItem(
      {
        weapon: null,
        helmet: null,
        armor: null,
        boots: null,
        gloves: null,
        shield: null,
      },
      'iron_sword',
    );

    expect(equipment.weapon).toBe('iron_sword');
  });
});

describe('combat core', () => {
  it('applies basic attack and advances turn', () => {
    const player: CharacterData = {
      id: 'player-1',
      name: 'Player',
      race: Race.Human,
      level: 0,
      exp: 0,
      stats: {
        hp: 100,
        mp: 60,
        stamina: 60,
        strength: 8,
        constitution: 6,
        dexterity: 6,
        intelligence: 6,
        luck: 5,
        perception: 7,
        willpower: 5,
      },
    };

    const enemy: CharacterData = {
      id: 'bot-1',
      name: 'Bot',
      race: Race.Dwarf,
      level: 0,
      exp: 0,
      stats: {
        hp: 100,
        mp: 30,
        stamina: 70,
        strength: 6,
        constitution: 8,
        dexterity: 4,
        intelligence: 4,
        luck: 5,
        perception: 4,
        willpower: 7,
      },
    };

    const state = initializeCombat([toCombatReadyEntity(player), toCombatReadyEntity(enemy)]);
    const firstActor = state.turnOrder[state.currentTurnIndex];
    const targetId = state.participants.find((x) => x.id !== firstActor)!.id;
    const targetBefore = state.participants.find((x) => x.id === targetId)!.currentHp;

    resolveAction(state, {
      actorId: firstActor,
      targetId,
      type: 'BASIC_ATTACK',
    });

    const targetAfter = state.participants.find((x) => x.id === targetId)!.currentHp;
    expect(targetAfter).toBeLessThan(targetBefore);
  });
});

describe('arena battle round resolver', () => {
  it('resolves simultaneous planned actions by initiative and writes logs', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Player',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 50,
      maxHp: 50,
      currentMp: 10,
      maxMp: 10,
      currentStamina: 6,
      maxStamina: 6,
      strength: 8,
      constitution: 5,
      dexterity: 6,
      intelligence: 3,
      luck: 4,
      perception: 7,
      willpower: 4,
      position: 1,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Bandit',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 42,
      maxHp: 42,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 6,
      maxStamina: 6,
      strength: 7,
      constitution: 4,
      dexterity: 5,
      intelligence: 2,
      luck: 3,
      perception: 5,
      willpower: 3,
      position: 3,
    });

    const state = createInitialBattleState({
      combatId: 'c1',
      entities: [player, enemy],
    });

    const next = resolveRound({
      state,
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Head, TargetZone.Chest],
          attackPointsSpent: 4,
          defensePointsSpent: 2,
          actionType: ActionType.Attack,
        },
        {
          actorId: 'e1',
          targetId: 'p1',
          attackZone: TargetZone.Legs,
          defenseZones: [TargetZone.Chest, TargetZone.Abdomen],
          attackPointsSpent: 3,
          defensePointsSpent: 3,
          actionType: ActionType.Attack,
        },
      ],
      random: () => 0.1,
    });

    expect(next.roundNumber).toBe(1);
    expect(next.logs.length).toBeGreaterThan(0);
    expect(next.entities.find((x) => x.id === 'e1')!.currentHp).toBeLessThan(42);
  });

  it('does not deal damage when actor defends', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Guardian',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 50,
      maxHp: 50,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 8,
      maxStamina: 8,
      strength: 6,
      constitution: 7,
      dexterity: 4,
      intelligence: 2,
      luck: 2,
      perception: 5,
      willpower: 4,
      position: 1,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Raider',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 40,
      maxHp: 40,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 8,
      maxStamina: 8,
      strength: 5,
      constitution: 4,
      dexterity: 4,
      intelligence: 2,
      luck: 2,
      perception: 4,
      willpower: 3,
      position: 3,
    });

    const state = createInitialBattleState({
      combatId: 'c-defend',
      entities: [player, enemy],
    });

    const next = resolveRound({
      state,
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Head, TargetZone.Chest],
          attackPointsSpent: 0,
          defensePointsSpent: 8,
          actionType: ActionType.Defend,
        },
      ],
      random: () => 0.1,
    });

    expect(next.entities.find((x) => x.id === 'e1')!.currentHp).toBe(40);
    expect(next.logs.some((entry) => entry.text.includes('guards'))).toBe(true);
  });

  it('moves battle one distance band toward preferred distance', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Scout',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 45,
      maxHp: 45,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 8,
      maxStamina: 8,
      strength: 4,
      constitution: 4,
      dexterity: 7,
      intelligence: 3,
      luck: 2,
      perception: 6,
      willpower: 4,
      position: 1,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Bandit',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 42,
      maxHp: 42,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 6,
      maxStamina: 6,
      strength: 7,
      constitution: 4,
      dexterity: 5,
      intelligence: 2,
      luck: 3,
      perception: 5,
      willpower: 3,
      position: 3,
    });

    const state = createInitialBattleState({
      combatId: 'c-move',
      entities: [player, enemy],
      distance: DistanceBand.Melee,
    });

    const next = resolveRound({
      state,
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Chest, TargetZone.Abdomen],
          attackPointsSpent: 0,
          defensePointsSpent: 2,
          actionType: ActionType.Move,
          preferredDistance: DistanceBand.Far,
        },
      ],
      random: () => 0.1,
    });

    const placement = getBattlefieldTilePlacements(next.entities, next.distance).find((item) => item.entityId === 'p1');

    expect(next.distance).toBe(DistanceBand.Near);
    expect(placement?.x).toBe(4);
  });

  it('keeps melee fighters engaged unless someone explicitly moves', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Warrior',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 55,
      maxHp: 55,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 6,
      maxStamina: 6,
      strength: 8,
      constitution: 5,
      dexterity: 5,
      intelligence: 2,
      luck: 3,
      perception: 6,
      willpower: 4,
      position: 1,
    });

    const evasiveBandit = createArenaCombatEntity({
      id: 'e1',
      name: 'Bandit',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 45,
      maxHp: 45,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 6,
      maxStamina: 6,
      strength: 4,
      constitution: 4,
      dexterity: 7,
      intelligence: 2,
      luck: 3,
      perception: 6,
      willpower: 3,
      position: 3,
    });

    const state = createInitialBattleState({
      combatId: 'c-locked-melee',
      entities: [player, evasiveBandit],
      distance: DistanceBand.Melee,
    });

    const npcAction = createNpcAction(state, 'e1');
    expect(npcAction.actionType).not.toBe(ActionType.Move);

    const next = resolveRound({
      state,
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Chest, TargetZone.Abdomen],
          attackPointsSpent: 4,
          defensePointsSpent: 2,
          actionType: ActionType.Attack,
        },
        npcAction,
      ],
      random: () => 0.1,
    });

    expect(next.distance).toBe(DistanceBand.Melee);
    expect(next.logs.some((entry) => entry.text.includes('repositions the battle'))).toBe(false);
  });

  it('lets ranged fighters attack from far distance', () => {
    const archer = createArenaCombatEntity({
      id: 'p1',
      name: 'Archer',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 45,
      maxHp: 45,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 8,
      maxStamina: 8,
      strength: 3,
      constitution: 4,
      dexterity: 8,
      intelligence: 2,
      luck: 2,
      perception: 7,
      willpower: 4,
      position: 1,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Bruiser',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 42,
      maxHp: 42,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 6,
      maxStamina: 6,
      strength: 7,
      constitution: 4,
      dexterity: 4,
      intelligence: 1,
      luck: 1,
      perception: 4,
      willpower: 3,
      position: 3,
    });

    const state = createInitialBattleState({
      combatId: 'c-ranged',
      entities: [archer, enemy],
      distance: DistanceBand.Far,
    });

    const next = resolveRound({
      state,
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Chest, TargetZone.Abdomen],
          attackPointsSpent: 4,
          defensePointsSpent: 2,
          actionType: ActionType.Attack,
        },
      ],
      random: () => 0.1,
    });

    expect(next.entities.find((x) => x.id === 'e1')!.currentHp).toBeLessThan(42);
  });

  it('prevents melee fighters from attacking at far distance', () => {
    const warrior = createArenaCombatEntity({
      id: 'p1',
      name: 'Warrior',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 50,
      maxHp: 50,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 8,
      maxStamina: 8,
      strength: 8,
      constitution: 5,
      dexterity: 4,
      intelligence: 2,
      luck: 2,
      perception: 5,
      willpower: 4,
      position: 1,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Mage',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 40,
      maxHp: 40,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 6,
      maxStamina: 6,
      strength: 3,
      constitution: 4,
      dexterity: 4,
      intelligence: 7,
      luck: 2,
      perception: 5,
      willpower: 6,
      position: 3,
    });

    const state = createInitialBattleState({
      combatId: 'c-melee-range-lock',
      entities: [warrior, enemy],
      distance: DistanceBand.Far,
    });

    const next = resolveRound({
      state,
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Chest, TargetZone.Abdomen],
          attackPointsSpent: 4,
          defensePointsSpent: 2,
          actionType: ActionType.Attack,
        },
      ],
      random: () => 0.1,
    });

    expect(next.entities.find((x) => x.id === 'e1')!.currentHp).toBe(40);
    expect(next.logs.some((entry) => entry.text.includes('out of effective range'))).toBe(true);
  });

  it('maps fighters onto a 12x12 tactical grid', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Player',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 50,
      maxHp: 50,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 8,
      maxStamina: 8,
      strength: 7,
      constitution: 5,
      dexterity: 4,
      intelligence: 2,
      luck: 2,
      perception: 6,
      willpower: 4,
      position: 1,
    });

    const ally = createArenaCombatEntity({
      id: 'p2',
      name: 'Ally',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 40,
      maxHp: 40,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 8,
      maxStamina: 8,
      strength: 5,
      constitution: 4,
      dexterity: 5,
      intelligence: 2,
      luck: 1,
      perception: 5,
      willpower: 3,
      position: 2,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Enemy',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 42,
      maxHp: 42,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 6,
      maxStamina: 6,
      strength: 6,
      constitution: 4,
      dexterity: 4,
      intelligence: 1,
      luck: 1,
      perception: 4,
      willpower: 3,
      position: 3,
    });

    const placements = getBattlefieldTilePlacements([player, ally, enemy], DistanceBand.Near);
    const leftPlacements = placements.filter((item) => item.team === TeamSide.Left);
    const rightPlacements = placements.filter((item) => item.team === TeamSide.Right);

    expect(placements).toHaveLength(3);
    expect(leftPlacements.every((item) => item.x >= 0 && item.x < BATTLEFIELD_GRID_SIZE)).toBe(true);
    expect(rightPlacements.every((item) => item.x >= 0 && item.x < BATTLEFIELD_GRID_SIZE)).toBe(true);
    expect(leftPlacements.every((item) => item.x < rightPlacements[0]!.x)).toBe(true);
    expect(new Set(placements.map((item) => `${item.x}:${item.y}`)).size).toBe(3);
  });
});
