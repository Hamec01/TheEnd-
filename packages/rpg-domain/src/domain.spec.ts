import { describe, expect, it } from 'vitest';
import {
  EMPTY_EQUIPMENT,
  buyItem,
  calculateDerivedStats,
  canEquipItem,
  equipItem,
  getLevelProgress,
  getRequiredExpForLevel,
  getRequiredExpForNextLevel,
  initializeCombat,
  resolveAction,
  toCombatReadyEntity,
  type CharacterData,
} from './index';
import {
  ActionType,
  BATTLEFIELD_GRID_SIZE,
  BattlefieldTileType,
  DistanceBand,
  MovementType,
  TargetZone,
  TeamSide,
  createNpcAction,
  createArenaCombatEntity,
  createInitialBattleState,
  getBattlefieldDistance,
  getBattlefieldTilePlacements,
  getManaRegen,
  getStaminaRegen,
  resolveRound,
} from './arena-battle';
import { RACE_DEFINITIONS, Race, ensureRaceBaseStatsAreValid } from './races';
import { PRIMARY_STATS } from './stats';

describe('race definitions', () => {
  it('contains exactly all playable races and no AncientElf', () => {
    const races = Object.values(Race);
    expect(races).toEqual([Race.Human, Race.Dwarf, Race.HighElf, Race.WoodElf]);
    expect(races).not.toContain('ANCIENT_ELF');
    expect(Object.keys(RACE_DEFINITIONS)).toHaveLength(4);
  });

  it('has valid base stats for all races', () => {
    expect(() => ensureRaceBaseStatsAreValid()).not.toThrow();

    for (const race of Object.values(Race)) {
      const stats = RACE_DEFINITIONS[race].baseStats;
      expect(stats.hp).toBeGreaterThanOrEqual(65);
      expect(stats.mp).toBeGreaterThanOrEqual(0);
      expect(stats.stamina).toBeGreaterThanOrEqual(0);

      for (const stat of PRIMARY_STATS) {
        expect(typeof stats[stat]).toBe('number');
      }
    }
  });

  it('applies race-specific combat and mp-cost modifiers', () => {
    const human = RACE_DEFINITIONS[Race.Human].modifiers;
    const dwarf = RACE_DEFINITIONS[Race.Dwarf].modifiers;
    const highElf = RACE_DEFINITIONS[Race.HighElf].modifiers;
    const woodElf = RACE_DEFINITIONS[Race.WoodElf].modifiers;

    expect(dwarf.canUseMagic).toBe(false);
    expect(dwarf.canUseElements).toBe(false);
    expect(dwarf.magicDamageTakenMultiplier).toBe(0.5);
    expect(dwarf.elementDamageTakenMultiplier).toBe(0.5);

    expect(human.elementMpCostMultiplier).toBe(2);

    expect(highElf.magicMpCostMultiplier).toBe(2);
    expect(highElf.elementMpCostMultiplier).toBe(1);

    expect(woodElf.magicMpCostMultiplier).toBe(2);
    expect(woodElf.elementMpCostMultiplier).toBe(1);
  });
});

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

describe('progression', () => {
  it('uses the configured experience thresholds for early levels', () => {
    expect(getRequiredExpForLevel(0)).toBe(0);
    expect(getRequiredExpForLevel(1)).toBe(100);
    expect(getRequiredExpForLevel(2)).toBe(500);
    expect(getRequiredExpForLevel(3)).toBe(2000);
    expect(getRequiredExpForLevel(4)).toBe(5000);
    expect(getRequiredExpForNextLevel(0)).toBe(100);
    expect(getRequiredExpForNextLevel(1)).toBe(500);
    expect(getRequiredExpForNextLevel(4)).toBe(10000);
  });

  it('tracks progress inside the current level band', () => {
    expect(getLevelProgress(0, 80)).toMatchObject({
      floor: 0,
      next: 100,
      gainedInsideLevel: 80,
      totalInsideLevel: 100,
    });

    expect(getLevelProgress(2, 1100)).toMatchObject({
      floor: 500,
      next: 2000,
      gainedInsideLevel: 600,
      totalInsideLevel: 1500,
    });
  });
});

describe('derived stats', () => {
  it('responds to the primary stats used by the combat model', () => {
    const baseline = calculateDerivedStats({
      hp: 80,
      mp: 30,
      stamina: 40,
      strength: 5,
      constitution: 5,
      dexterity: 5,
      intelligence: 5,
      luck: 5,
      perception: 5,
      willpower: 5,
    }, EMPTY_EQUIPMENT);

    const boosted = calculateDerivedStats({
      hp: 80,
      mp: 30,
      stamina: 40,
      strength: 9,
      constitution: 8,
      dexterity: 8,
      intelligence: 7,
      luck: 8,
      perception: 9,
      willpower: 8,
    }, EMPTY_EQUIPMENT);

    expect(boosted.minDamage).toBeGreaterThan(baseline.minDamage);
    expect(boosted.maxDamage).toBeGreaterThan(baseline.maxDamage);
    expect(boosted.totalDefense).toBeGreaterThan(baseline.totalDefense);
    expect(boosted.initiative).toBeGreaterThan(baseline.initiative);
    expect(boosted.hitChance).toBeGreaterThan(baseline.hitChance);
    expect(boosted.critChance).toBeGreaterThan(baseline.critChance);
    expect(boosted.magicResistance).toBeGreaterThan(baseline.magicResistance);
  });
});

describe('equipment', () => {
  it('exposes the expanded equipment schema', () => {
    expect(EMPTY_EQUIPMENT).toMatchObject({
      necklace: null,
      outerwear: null,
      belt: null,
      ring1: null,
      ring2: null,
      ring3: null,
      legs: null,
    });
  });

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
    const equipment = equipItem(EMPTY_EQUIPMENT, 'iron_sword');

    expect(equipment.weapon).toBe('iron_sword');
  });

  it('clears shield when equipping a two-handed weapon', () => {
    const equipment = equipItem(
      {
        ...EMPTY_EQUIPMENT,
        weapon: 'iron_sword',
        shield: 'kite_shield',
      },
      'hunter_bow',
    );

    expect(equipment.weapon).toBe('hunter_bow');
    expect(equipment.shield).toBeNull();
  });

  it('prevents equipping a shield while a two-handed weapon is equipped', () => {
    const check = canEquipItem(
      {
        hp: 50,
        mp: 60,
        stamina: 60,
        strength: 6,
        constitution: 6,
        dexterity: 8,
        intelligence: 5,
        luck: 5,
        perception: 6,
        willpower: 5,
      },
      'kite_shield',
      {
        ...EMPTY_EQUIPMENT,
        weapon: 'hunter_bow',
      },
    );

    expect(check.ok).toBe(false);
    expect(check.reason).toBeDefined();
  });

  it('allows equipping a one-handed weapon into offhand for dual-wield', () => {
    const equipment = equipItem(
      {
        ...EMPTY_EQUIPMENT,
        weapon: 'iron_sword',
      },
      'raider_axe',
      'shield',
    );

    expect(equipment.weapon).toBe('iron_sword');
    expect(equipment.shield).toBe('raider_axe');
  });

  it('blocks offhand one-handed weapon when a two-handed weapon is equipped', () => {
    const check = canEquipItem(
      {
        hp: 50,
        mp: 60,
        stamina: 60,
        strength: 9,
        constitution: 6,
        dexterity: 8,
        intelligence: 5,
        luck: 5,
        perception: 6,
        willpower: 5,
      },
      'iron_sword',
      {
        ...EMPTY_EQUIPMENT,
        weapon: 'hunter_bow',
      },
      'shield',
    );

    expect(check.ok).toBe(false);
    expect(check.reason).toBeDefined();
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
      currentStamina: 20,
      maxStamina: 20,
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
      currentStamina: 20,
      maxStamina: 20,
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
      currentStamina: 20,
      maxStamina: 20,
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
      currentStamina: 20,
      maxStamina: 20,
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

  it('moves one cell on the tactical grid', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Scout',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 45,
      maxHp: 45,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 20,
      maxStamina: 20,
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
      currentStamina: 20,
      maxStamina: 20,
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
          movementType: MovementType.Step,
          destinationX: 4,
          destinationY: 6,
        },
      ],
      random: () => 0.1,
    });

    const placement = getBattlefieldTilePlacements(next.entities, next.distance).find((item) => item.entityId === 'p1');

    expect(next.distance).toBe(DistanceBand.Near);
    expect(placement?.x).toBe(4);
    expect(placement?.y).toBe(6);
  });

  it('lets ranged fighters disengage when trapped in melee', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Warrior',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 55,
      maxHp: 55,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 20,
      maxStamina: 20,
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
      name: 'Bandit Archer',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 45,
      maxHp: 45,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 20,
      maxStamina: 20,
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
    expect(npcAction.actionType).toBe(ActionType.Move);
    expect(npcAction.movementType).toBe(MovementType.Disengage);

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

    expect(next.distance).not.toBe(DistanceBand.Melee);
    expect(next.logs.some((entry) => entry.text.includes('moves to'))).toBe(true);
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
      currentStamina: 20,
      maxStamina: 20,
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
      currentStamina: 20,
      maxStamina: 20,
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
      currentStamina: 20,
      maxStamina: 20,
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
      currentStamina: 20,
      maxStamina: 20,
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

  it('derives grid distance from battlefield coordinates', () => {
    const left = createArenaCombatEntity({
      id: 'left',
      name: 'Left',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 10,
      maxHp: 10,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 10,
      maxStamina: 10,
      strength: 4,
      constitution: 4,
      dexterity: 4,
      intelligence: 4,
      luck: 1,
      perception: 4,
      willpower: 4,
      position: 1,
      battlefieldX: 1,
      battlefieldY: 1,
    });

    const right = createArenaCombatEntity({
      id: 'right',
      name: 'Right',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 10,
      maxHp: 10,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 10,
      maxStamina: 10,
      strength: 4,
      constitution: 4,
      dexterity: 4,
      intelligence: 4,
      luck: 1,
      perception: 4,
      willpower: 4,
      position: 2,
      battlefieldX: 4,
      battlefieldY: 3,
    });

    expect(getBattlefieldDistance(left, right)).toBe(5);
  });

  it('exposes stamina and mana regen formulas without auto-regenerating at round start', () => {
    expect(getStaminaRegen({ constitution: 9 })).toBe(12);
    expect(getManaRegen({ willpower: 11 })).toBe(8);

    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Player',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 40,
      maxHp: 40,
      currentMp: 3,
      maxMp: 20,
      currentStamina: 2,
      maxStamina: 30,
      strength: 6,
      constitution: 9,
      dexterity: 5,
      intelligence: 5,
      luck: 2,
      perception: 5,
      willpower: 11,
      position: 1,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Enemy',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 30,
      maxHp: 30,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 10,
      maxStamina: 20,
      strength: 4,
      constitution: 6,
      dexterity: 4,
      intelligence: 2,
      luck: 1,
      perception: 3,
      willpower: 3,
      position: 2,
    });

    const next = resolveRound({
      state: createInitialBattleState({ combatId: 'regen', entities: [player, enemy] }),
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Chest, TargetZone.Abdomen],
          attackPointsSpent: 0,
          defensePointsSpent: 0,
          actionType: ActionType.Wait,
        },
      ],
      random: () => 0.5,
    });

    expect(next.entities.find((x) => x.id === 'p1')!.currentStamina).toBe(2);
    expect(next.entities.find((x) => x.id === 'p1')!.currentMp).toBe(3);
  });

  it('allows attack after one-cell movement', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Player',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 40,
      maxHp: 40,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 25,
      maxStamina: 25,
      strength: 8,
      constitution: 6,
      dexterity: 5,
      intelligence: 2,
      luck: 2,
      perception: 6,
      willpower: 4,
      position: 1,
      battlefieldX: 4,
      battlefieldY: 5,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Enemy',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 40,
      maxHp: 40,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 20,
      maxStamina: 20,
      strength: 5,
      constitution: 5,
      dexterity: 4,
      intelligence: 2,
      luck: 1,
      perception: 4,
      willpower: 3,
      position: 2,
      battlefieldX: 6,
      battlefieldY: 5,
    });

    const next = resolveRound({
      state: createInitialBattleState({ combatId: 'move-attack', entities: [player, enemy] }),
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Chest],
          attackPointsSpent: 0,
          defensePointsSpent: 0,
          actionType: ActionType.Attack,
          movementType: MovementType.Step,
          destinationX: 5,
          destinationY: 5,
        },
      ],
      random: () => 0.1,
    });

    expect(next.entities.find((x) => x.id === 'e1')!.currentHp).toBeLessThan(40);
  });

  it('prevents attack after dash', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Player',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 40,
      maxHp: 40,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 30,
      maxStamina: 30,
      strength: 8,
      constitution: 6,
      dexterity: 5,
      intelligence: 2,
      luck: 2,
      perception: 6,
      willpower: 4,
      position: 1,
      battlefieldX: 2,
      battlefieldY: 5,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Enemy',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 40,
      maxHp: 40,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 20,
      maxStamina: 20,
      strength: 5,
      constitution: 5,
      dexterity: 4,
      intelligence: 2,
      luck: 1,
      perception: 4,
      willpower: 3,
      position: 2,
      battlefieldX: 6,
      battlefieldY: 5,
    });

    const next = resolveRound({
      state: createInitialBattleState({ combatId: 'dash-no-attack', entities: [player, enemy] }),
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Chest],
          attackPointsSpent: 0,
          defensePointsSpent: 0,
          actionType: ActionType.Attack,
          movementType: MovementType.Dash,
          destinationX: 5,
          destinationY: 5,
        },
      ],
      random: () => 0.1,
    });

    expect(next.entities.find((x) => x.id === 'e1')!.currentHp).toBe(40);
    expect(next.logs.some((entry) => entry.text.includes('cannot attack after that movement'))).toBe(true);
  });

  it('applies reckless attack modifiers when no defense zones are selected', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Player',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 50,
      maxHp: 50,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 25,
      maxStamina: 25,
      strength: 8,
      constitution: 6,
      dexterity: 6,
      intelligence: 2,
      luck: 3,
      perception: 8,
      willpower: 4,
      position: 1,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Enemy',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 50,
      maxHp: 50,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 25,
      maxStamina: 25,
      strength: 8,
      constitution: 6,
      dexterity: 5,
      intelligence: 2,
      luck: 3,
      perception: 7,
      willpower: 4,
      position: 2,
    });

    const safeResult = resolveRound({
      state: createInitialBattleState({ combatId: 'safe-hit', entities: [{ ...player }, { ...enemy }] }),
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Chest, TargetZone.Abdomen],
          attackPointsSpent: 0,
          defensePointsSpent: 0,
          actionType: ActionType.Attack,
        },
      ],
      random: () => 0.1,
    });

    const recklessResult = resolveRound({
      state: createInitialBattleState({ combatId: 'reckless-hit', entities: [{ ...player }, { ...enemy }] }),
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [],
          attackPointsSpent: 0,
          defensePointsSpent: 0,
          actionType: ActionType.Attack,
        },
      ],
      random: () => 0.1,
    });

    expect(recklessResult.entities.find((x) => x.id === 'e1')!.currentHp).toBeLessThan(safeResult.entities.find((x) => x.id === 'e1')!.currentHp);
  });

  it('triggers opportunity attack when leaving melee without disengage', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Player',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 50,
      maxHp: 50,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 25,
      maxStamina: 25,
      strength: 6,
      constitution: 6,
      dexterity: 6,
      intelligence: 2,
      luck: 2,
      perception: 6,
      willpower: 4,
      position: 1,
      battlefieldX: 5,
      battlefieldY: 5,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Enemy',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 50,
      maxHp: 50,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 25,
      maxStamina: 25,
      strength: 8,
      constitution: 6,
      dexterity: 4,
      intelligence: 2,
      luck: 2,
      perception: 6,
      willpower: 4,
      position: 2,
      battlefieldX: 6,
      battlefieldY: 5,
    });

    const next = resolveRound({
      state: createInitialBattleState({ combatId: 'opportunity', entities: [player, enemy] }),
      plannedActions: [
        {
          actorId: 'p1',
          targetId: 'e1',
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Chest],
          attackPointsSpent: 0,
          defensePointsSpent: 0,
          actionType: ActionType.Move,
          movementType: MovementType.Step,
          destinationX: 4,
          destinationY: 5,
        },
      ],
      random: () => 0.1,
    });

    expect(next.entities.find((x) => x.id === 'p1')!.currentHp).toBeLessThan(50);
    expect(next.logs.some((entry) => entry.text.includes('free strike'))).toBe(true);
  });

  it('supports battlefield tile data in combat state', () => {
    const player = createArenaCombatEntity({
      id: 'p1',
      name: 'Player',
      team: TeamSide.Left,
      race: Race.Human,
      currentHp: 10,
      maxHp: 10,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 10,
      maxStamina: 10,
      strength: 4,
      constitution: 4,
      dexterity: 4,
      intelligence: 4,
      luck: 1,
      perception: 4,
      willpower: 4,
      position: 1,
    });

    const enemy = createArenaCombatEntity({
      id: 'e1',
      name: 'Enemy',
      team: TeamSide.Right,
      race: Race.Dwarf,
      currentHp: 10,
      maxHp: 10,
      currentMp: 0,
      maxMp: 0,
      currentStamina: 10,
      maxStamina: 10,
      strength: 4,
      constitution: 4,
      dexterity: 4,
      intelligence: 4,
      luck: 1,
      perception: 4,
      willpower: 4,
      position: 2,
    });

    const state = createInitialBattleState({
      combatId: 'tiles',
      entities: [player, enemy],
      battlefieldTiles: [
        { x: 0, y: 0, type: BattlefieldTileType.Blocked },
        { x: 1, y: 0, type: BattlefieldTileType.LowCover },
      ],
    });

    expect(state.battlefieldTiles[0]?.type).toBe(BattlefieldTileType.Blocked);
    expect(state.battlefieldTiles[1]?.type).toBe(BattlefieldTileType.LowCover);
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
