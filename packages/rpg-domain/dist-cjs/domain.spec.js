"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
const arena_battle_1 = require("./arena-battle");
const races_1 = require("./races");
const stats_1 = require("./stats");
(0, vitest_1.describe)('race definitions', () => {
    (0, vitest_1.it)('contains exactly all playable races and no AncientElf', () => {
        const races = Object.values(races_1.Race);
        (0, vitest_1.expect)(races).toEqual([races_1.Race.Human, races_1.Race.Dwarf, races_1.Race.HighElf, races_1.Race.WoodElf]);
        (0, vitest_1.expect)(races).not.toContain('ANCIENT_ELF');
        (0, vitest_1.expect)(Object.keys(races_1.RACE_DEFINITIONS)).toHaveLength(4);
    });
    (0, vitest_1.it)('has valid base stats for all races', () => {
        (0, vitest_1.expect)(() => (0, races_1.ensureRaceBaseStatsAreValid)()).not.toThrow();
        for (const race of Object.values(races_1.Race)) {
            const stats = races_1.RACE_DEFINITIONS[race].baseStats;
            (0, vitest_1.expect)(stats.hp).toBeGreaterThanOrEqual(65);
            (0, vitest_1.expect)(stats.mp).toBeGreaterThanOrEqual(0);
            (0, vitest_1.expect)(stats.stamina).toBeGreaterThanOrEqual(0);
            for (const stat of stats_1.PRIMARY_STATS) {
                (0, vitest_1.expect)(typeof stats[stat]).toBe('number');
            }
        }
    });
    (0, vitest_1.it)('applies race-specific combat and mp-cost modifiers', () => {
        const human = races_1.RACE_DEFINITIONS[races_1.Race.Human].modifiers;
        const dwarf = races_1.RACE_DEFINITIONS[races_1.Race.Dwarf].modifiers;
        const highElf = races_1.RACE_DEFINITIONS[races_1.Race.HighElf].modifiers;
        const woodElf = races_1.RACE_DEFINITIONS[races_1.Race.WoodElf].modifiers;
        (0, vitest_1.expect)(dwarf.canUseMagic).toBe(false);
        (0, vitest_1.expect)(dwarf.canUseElements).toBe(false);
        (0, vitest_1.expect)(dwarf.magicDamageTakenMultiplier).toBe(0.5);
        (0, vitest_1.expect)(dwarf.elementDamageTakenMultiplier).toBe(0.5);
        (0, vitest_1.expect)(human.elementMpCostMultiplier).toBe(2);
        (0, vitest_1.expect)(highElf.magicMpCostMultiplier).toBe(2);
        (0, vitest_1.expect)(highElf.elementMpCostMultiplier).toBe(1);
        (0, vitest_1.expect)(woodElf.magicMpCostMultiplier).toBe(2);
        (0, vitest_1.expect)(woodElf.elementMpCostMultiplier).toBe(1);
    });
});
(0, vitest_1.describe)('shop', () => {
    (0, vitest_1.it)('deducts gold and adds inventory item on purchase', () => {
        const result = (0, index_1.buyItem)({
            gold: 200,
            items: [],
        }, 'iron_sword');
        (0, vitest_1.expect)(result.ok).toBe(true);
        (0, vitest_1.expect)(result.inventory.gold).toBe(60);
        (0, vitest_1.expect)(result.inventory.items[0].itemId).toBe('iron_sword');
        (0, vitest_1.expect)(result.inventory.items[0].quantity).toBe(1);
    });
});
(0, vitest_1.describe)('progression', () => {
    (0, vitest_1.it)('uses the configured experience thresholds for early levels', () => {
        (0, vitest_1.expect)((0, index_1.getRequiredExpForLevel)(0)).toBe(0);
        (0, vitest_1.expect)((0, index_1.getRequiredExpForLevel)(1)).toBe(100);
        (0, vitest_1.expect)((0, index_1.getRequiredExpForLevel)(2)).toBe(500);
        (0, vitest_1.expect)((0, index_1.getRequiredExpForLevel)(3)).toBe(2000);
        (0, vitest_1.expect)((0, index_1.getRequiredExpForLevel)(4)).toBe(5000);
        (0, vitest_1.expect)((0, index_1.getRequiredExpForNextLevel)(0)).toBe(100);
        (0, vitest_1.expect)((0, index_1.getRequiredExpForNextLevel)(1)).toBe(500);
        (0, vitest_1.expect)((0, index_1.getRequiredExpForNextLevel)(4)).toBe(10000);
    });
    (0, vitest_1.it)('tracks progress inside the current level band', () => {
        (0, vitest_1.expect)((0, index_1.getLevelProgress)(0, 80)).toMatchObject({
            floor: 0,
            next: 100,
            gainedInsideLevel: 80,
            totalInsideLevel: 100,
        });
        (0, vitest_1.expect)((0, index_1.getLevelProgress)(2, 1100)).toMatchObject({
            floor: 500,
            next: 2000,
            gainedInsideLevel: 600,
            totalInsideLevel: 1500,
        });
    });
});
(0, vitest_1.describe)('derived stats', () => {
    (0, vitest_1.it)('responds to the primary stats used by the combat model', () => {
        const baseline = (0, index_1.calculateDerivedStats)({
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
        }, index_1.EMPTY_EQUIPMENT);
        const boosted = (0, index_1.calculateDerivedStats)({
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
        }, index_1.EMPTY_EQUIPMENT);
        (0, vitest_1.expect)(boosted.minDamage).toBeGreaterThan(baseline.minDamage);
        (0, vitest_1.expect)(boosted.maxDamage).toBeGreaterThan(baseline.maxDamage);
        (0, vitest_1.expect)(boosted.totalDefense).toBeGreaterThan(baseline.totalDefense);
        (0, vitest_1.expect)(boosted.initiative).toBeGreaterThan(baseline.initiative);
        (0, vitest_1.expect)(boosted.hitChance).toBeGreaterThan(baseline.hitChance);
        (0, vitest_1.expect)(boosted.critChance).toBeGreaterThan(baseline.critChance);
        (0, vitest_1.expect)(boosted.magicResistance).toBeGreaterThan(baseline.magicResistance);
    });
});
(0, vitest_1.describe)('equipment', () => {
    (0, vitest_1.it)('prevents equip when stat requirement is not met', () => {
        const check = (0, index_1.canEquipItem)({
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
        }, 'iron_sword');
        (0, vitest_1.expect)(check.ok).toBe(false);
    });
    (0, vitest_1.it)('equips item into correct slot', () => {
        const equipment = (0, index_1.equipItem)({
            weapon: null,
            helmet: null,
            armor: null,
            boots: null,
            gloves: null,
            shield: null,
        }, 'iron_sword');
        (0, vitest_1.expect)(equipment.weapon).toBe('iron_sword');
    });
    (0, vitest_1.it)('clears shield when equipping a two-handed weapon', () => {
        const equipment = (0, index_1.equipItem)({
            weapon: 'iron_sword',
            helmet: null,
            armor: null,
            boots: null,
            gloves: null,
            shield: 'kite_shield',
        }, 'hunter_bow');
        (0, vitest_1.expect)(equipment.weapon).toBe('hunter_bow');
        (0, vitest_1.expect)(equipment.shield).toBeNull();
    });
    (0, vitest_1.it)('prevents equipping a shield while a two-handed weapon is equipped', () => {
        const check = (0, index_1.canEquipItem)({
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
        }, 'kite_shield', {
            weapon: 'hunter_bow',
            helmet: null,
            armor: null,
            boots: null,
            gloves: null,
            shield: null,
        });
        (0, vitest_1.expect)(check.ok).toBe(false);
        (0, vitest_1.expect)(check.reason).toBeDefined();
    });
    (0, vitest_1.it)('allows equipping a one-handed weapon into offhand for dual-wield', () => {
        const equipment = (0, index_1.equipItem)({
            weapon: 'iron_sword',
            helmet: null,
            armor: null,
            boots: null,
            gloves: null,
            shield: null,
        }, 'raider_axe', 'shield');
        (0, vitest_1.expect)(equipment.weapon).toBe('iron_sword');
        (0, vitest_1.expect)(equipment.shield).toBe('raider_axe');
    });
    (0, vitest_1.it)('blocks offhand one-handed weapon when a two-handed weapon is equipped', () => {
        const check = (0, index_1.canEquipItem)({
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
        }, 'iron_sword', {
            weapon: 'hunter_bow',
            helmet: null,
            armor: null,
            boots: null,
            gloves: null,
            shield: null,
        }, 'shield');
        (0, vitest_1.expect)(check.ok).toBe(false);
        (0, vitest_1.expect)(check.reason).toBeDefined();
    });
});
(0, vitest_1.describe)('combat core', () => {
    (0, vitest_1.it)('applies basic attack and advances turn', () => {
        const player = {
            id: 'player-1',
            name: 'Player',
            race: races_1.Race.Human,
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
        const enemy = {
            id: 'bot-1',
            name: 'Bot',
            race: races_1.Race.Dwarf,
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
        const state = (0, index_1.initializeCombat)([(0, index_1.toCombatReadyEntity)(player), (0, index_1.toCombatReadyEntity)(enemy)]);
        const firstActor = state.turnOrder[state.currentTurnIndex];
        const targetId = state.participants.find((x) => x.id !== firstActor).id;
        const targetBefore = state.participants.find((x) => x.id === targetId).currentHp;
        (0, index_1.resolveAction)(state, {
            actorId: firstActor,
            targetId,
            type: 'BASIC_ATTACK',
        });
        const targetAfter = state.participants.find((x) => x.id === targetId).currentHp;
        (0, vitest_1.expect)(targetAfter).toBeLessThan(targetBefore);
    });
});
(0, vitest_1.describe)('arena battle round resolver', () => {
    (0, vitest_1.it)('resolves simultaneous planned actions by initiative and writes logs', () => {
        const player = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Player',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Bandit',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const state = (0, arena_battle_1.createInitialBattleState)({
            combatId: 'c1',
            entities: [player, enemy],
        });
        const next = (0, arena_battle_1.resolveRound)({
            state,
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [arena_battle_1.TargetZone.Head, arena_battle_1.TargetZone.Chest],
                    attackPointsSpent: 4,
                    defensePointsSpent: 2,
                    actionType: arena_battle_1.ActionType.Attack,
                },
                {
                    actorId: 'e1',
                    targetId: 'p1',
                    attackZone: arena_battle_1.TargetZone.Legs,
                    defenseZones: [arena_battle_1.TargetZone.Chest, arena_battle_1.TargetZone.Abdomen],
                    attackPointsSpent: 3,
                    defensePointsSpent: 3,
                    actionType: arena_battle_1.ActionType.Attack,
                },
            ],
            random: () => 0.1,
        });
        (0, vitest_1.expect)(next.roundNumber).toBe(1);
        (0, vitest_1.expect)(next.logs.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(next.entities.find((x) => x.id === 'e1').currentHp).toBeLessThan(42);
    });
    (0, vitest_1.it)('does not deal damage when actor defends', () => {
        const player = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Guardian',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Raider',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const state = (0, arena_battle_1.createInitialBattleState)({
            combatId: 'c-defend',
            entities: [player, enemy],
        });
        const next = (0, arena_battle_1.resolveRound)({
            state,
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [arena_battle_1.TargetZone.Head, arena_battle_1.TargetZone.Chest],
                    attackPointsSpent: 0,
                    defensePointsSpent: 8,
                    actionType: arena_battle_1.ActionType.Defend,
                },
            ],
            random: () => 0.1,
        });
        (0, vitest_1.expect)(next.entities.find((x) => x.id === 'e1').currentHp).toBe(40);
        (0, vitest_1.expect)(next.logs.some((entry) => entry.text.includes('guards'))).toBe(true);
    });
    (0, vitest_1.it)('moves one cell on the tactical grid', () => {
        const player = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Scout',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Bandit',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const state = (0, arena_battle_1.createInitialBattleState)({
            combatId: 'c-move',
            entities: [player, enemy],
            distance: arena_battle_1.DistanceBand.Melee,
        });
        const next = (0, arena_battle_1.resolveRound)({
            state,
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [arena_battle_1.TargetZone.Chest, arena_battle_1.TargetZone.Abdomen],
                    attackPointsSpent: 0,
                    defensePointsSpent: 2,
                    actionType: arena_battle_1.ActionType.Move,
                    movementType: arena_battle_1.MovementType.Step,
                    destinationX: 4,
                    destinationY: 6,
                },
            ],
            random: () => 0.1,
        });
        const placement = (0, arena_battle_1.getBattlefieldTilePlacements)(next.entities, next.distance).find((item) => item.entityId === 'p1');
        (0, vitest_1.expect)(next.distance).toBe(arena_battle_1.DistanceBand.Near);
        (0, vitest_1.expect)(placement?.x).toBe(4);
        (0, vitest_1.expect)(placement?.y).toBe(6);
    });
    (0, vitest_1.it)('lets ranged fighters disengage when trapped in melee', () => {
        const player = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Warrior',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const evasiveBandit = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Bandit Archer',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const state = (0, arena_battle_1.createInitialBattleState)({
            combatId: 'c-locked-melee',
            entities: [player, evasiveBandit],
            distance: arena_battle_1.DistanceBand.Melee,
        });
        const npcAction = (0, arena_battle_1.createNpcAction)(state, 'e1');
        (0, vitest_1.expect)(npcAction.actionType).toBe(arena_battle_1.ActionType.Move);
        (0, vitest_1.expect)(npcAction.movementType).toBe(arena_battle_1.MovementType.Disengage);
        const next = (0, arena_battle_1.resolveRound)({
            state,
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [arena_battle_1.TargetZone.Chest, arena_battle_1.TargetZone.Abdomen],
                    attackPointsSpent: 4,
                    defensePointsSpent: 2,
                    actionType: arena_battle_1.ActionType.Attack,
                },
                npcAction,
            ],
            random: () => 0.1,
        });
        (0, vitest_1.expect)(next.distance).not.toBe(arena_battle_1.DistanceBand.Melee);
        (0, vitest_1.expect)(next.logs.some((entry) => entry.text.includes('moves to'))).toBe(true);
    });
    (0, vitest_1.it)('lets ranged fighters attack from far distance', () => {
        const archer = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Archer',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Bruiser',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const state = (0, arena_battle_1.createInitialBattleState)({
            combatId: 'c-ranged',
            entities: [archer, enemy],
            distance: arena_battle_1.DistanceBand.Far,
        });
        const next = (0, arena_battle_1.resolveRound)({
            state,
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [arena_battle_1.TargetZone.Chest, arena_battle_1.TargetZone.Abdomen],
                    attackPointsSpent: 4,
                    defensePointsSpent: 2,
                    actionType: arena_battle_1.ActionType.Attack,
                },
            ],
            random: () => 0.1,
        });
        (0, vitest_1.expect)(next.entities.find((x) => x.id === 'e1').currentHp).toBeLessThan(42);
    });
    (0, vitest_1.it)('prevents melee fighters from attacking at far distance', () => {
        const warrior = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Warrior',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Mage',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const state = (0, arena_battle_1.createInitialBattleState)({
            combatId: 'c-melee-range-lock',
            entities: [warrior, enemy],
            distance: arena_battle_1.DistanceBand.Far,
        });
        const next = (0, arena_battle_1.resolveRound)({
            state,
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [arena_battle_1.TargetZone.Chest, arena_battle_1.TargetZone.Abdomen],
                    attackPointsSpent: 4,
                    defensePointsSpent: 2,
                    actionType: arena_battle_1.ActionType.Attack,
                },
            ],
            random: () => 0.1,
        });
        (0, vitest_1.expect)(next.entities.find((x) => x.id === 'e1').currentHp).toBe(40);
        (0, vitest_1.expect)(next.logs.some((entry) => entry.text.includes('out of effective range'))).toBe(true);
    });
    (0, vitest_1.it)('derives grid distance from battlefield coordinates', () => {
        const left = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'left',
            name: 'Left',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const right = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'right',
            name: 'Right',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        (0, vitest_1.expect)((0, arena_battle_1.getBattlefieldDistance)(left, right)).toBe(5);
    });
    (0, vitest_1.it)('regenerates stamina and mana at round start instead of full refill', () => {
        (0, vitest_1.expect)((0, arena_battle_1.getStaminaRegen)({ constitution: 9 })).toBe(12);
        (0, vitest_1.expect)((0, arena_battle_1.getManaRegen)({ willpower: 11 })).toBe(8);
        const player = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Player',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Enemy',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const next = (0, arena_battle_1.resolveRound)({
            state: (0, arena_battle_1.createInitialBattleState)({ combatId: 'regen', entities: [player, enemy] }),
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [arena_battle_1.TargetZone.Chest, arena_battle_1.TargetZone.Abdomen],
                    attackPointsSpent: 0,
                    defensePointsSpent: 0,
                    actionType: arena_battle_1.ActionType.Wait,
                },
            ],
            random: () => 0.5,
        });
        (0, vitest_1.expect)(next.entities.find((x) => x.id === 'p1').currentStamina).toBe(14);
        (0, vitest_1.expect)(next.entities.find((x) => x.id === 'p1').currentMp).toBe(11);
    });
    (0, vitest_1.it)('allows attack after one-cell movement', () => {
        const player = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Player',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Enemy',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const next = (0, arena_battle_1.resolveRound)({
            state: (0, arena_battle_1.createInitialBattleState)({ combatId: 'move-attack', entities: [player, enemy] }),
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [arena_battle_1.TargetZone.Chest],
                    attackPointsSpent: 0,
                    defensePointsSpent: 0,
                    actionType: arena_battle_1.ActionType.Attack,
                    movementType: arena_battle_1.MovementType.Step,
                    destinationX: 5,
                    destinationY: 5,
                },
            ],
            random: () => 0.1,
        });
        (0, vitest_1.expect)(next.entities.find((x) => x.id === 'e1').currentHp).toBeLessThan(40);
    });
    (0, vitest_1.it)('prevents attack after dash', () => {
        const player = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Player',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Enemy',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const next = (0, arena_battle_1.resolveRound)({
            state: (0, arena_battle_1.createInitialBattleState)({ combatId: 'dash-no-attack', entities: [player, enemy] }),
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [arena_battle_1.TargetZone.Chest],
                    attackPointsSpent: 0,
                    defensePointsSpent: 0,
                    actionType: arena_battle_1.ActionType.Attack,
                    movementType: arena_battle_1.MovementType.Dash,
                    destinationX: 5,
                    destinationY: 5,
                },
            ],
            random: () => 0.1,
        });
        (0, vitest_1.expect)(next.entities.find((x) => x.id === 'e1').currentHp).toBe(40);
        (0, vitest_1.expect)(next.logs.some((entry) => entry.text.includes('cannot attack after that movement'))).toBe(true);
    });
    (0, vitest_1.it)('applies reckless attack modifiers when no defense zones are selected', () => {
        const player = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Player',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Enemy',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const safeResult = (0, arena_battle_1.resolveRound)({
            state: (0, arena_battle_1.createInitialBattleState)({ combatId: 'safe-hit', entities: [{ ...player }, { ...enemy }] }),
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [arena_battle_1.TargetZone.Chest, arena_battle_1.TargetZone.Abdomen],
                    attackPointsSpent: 0,
                    defensePointsSpent: 0,
                    actionType: arena_battle_1.ActionType.Attack,
                },
            ],
            random: () => 0.1,
        });
        const recklessResult = (0, arena_battle_1.resolveRound)({
            state: (0, arena_battle_1.createInitialBattleState)({ combatId: 'reckless-hit', entities: [{ ...player }, { ...enemy }] }),
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [],
                    attackPointsSpent: 0,
                    defensePointsSpent: 0,
                    actionType: arena_battle_1.ActionType.Attack,
                },
            ],
            random: () => 0.1,
        });
        (0, vitest_1.expect)(recklessResult.entities.find((x) => x.id === 'e1').currentHp).toBeLessThan(safeResult.entities.find((x) => x.id === 'e1').currentHp);
    });
    (0, vitest_1.it)('triggers opportunity attack when leaving melee without disengage', () => {
        const player = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Player',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Enemy',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const next = (0, arena_battle_1.resolveRound)({
            state: (0, arena_battle_1.createInitialBattleState)({ combatId: 'opportunity', entities: [player, enemy] }),
            plannedActions: [
                {
                    actorId: 'p1',
                    targetId: 'e1',
                    attackZone: arena_battle_1.TargetZone.Chest,
                    defenseZones: [arena_battle_1.TargetZone.Chest],
                    attackPointsSpent: 0,
                    defensePointsSpent: 0,
                    actionType: arena_battle_1.ActionType.Move,
                    movementType: arena_battle_1.MovementType.Step,
                    destinationX: 4,
                    destinationY: 5,
                },
            ],
            random: () => 0.1,
        });
        (0, vitest_1.expect)(next.entities.find((x) => x.id === 'p1').currentHp).toBeLessThan(50);
        (0, vitest_1.expect)(next.logs.some((entry) => entry.text.includes('free strike'))).toBe(true);
    });
    (0, vitest_1.it)('supports battlefield tile data in combat state', () => {
        const player = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Player',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Enemy',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const state = (0, arena_battle_1.createInitialBattleState)({
            combatId: 'tiles',
            entities: [player, enemy],
            battlefieldTiles: [
                { x: 0, y: 0, type: arena_battle_1.BattlefieldTileType.Blocked },
                { x: 1, y: 0, type: arena_battle_1.BattlefieldTileType.LowCover },
            ],
        });
        (0, vitest_1.expect)(state.battlefieldTiles[0]?.type).toBe(arena_battle_1.BattlefieldTileType.Blocked);
        (0, vitest_1.expect)(state.battlefieldTiles[1]?.type).toBe(arena_battle_1.BattlefieldTileType.LowCover);
    });
    (0, vitest_1.it)('maps fighters onto a 12x12 tactical grid', () => {
        const player = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p1',
            name: 'Player',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const ally = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'p2',
            name: 'Ally',
            team: arena_battle_1.TeamSide.Left,
            race: races_1.Race.Human,
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
        const enemy = (0, arena_battle_1.createArenaCombatEntity)({
            id: 'e1',
            name: 'Enemy',
            team: arena_battle_1.TeamSide.Right,
            race: races_1.Race.Dwarf,
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
        const placements = (0, arena_battle_1.getBattlefieldTilePlacements)([player, ally, enemy], arena_battle_1.DistanceBand.Near);
        const leftPlacements = placements.filter((item) => item.team === arena_battle_1.TeamSide.Left);
        const rightPlacements = placements.filter((item) => item.team === arena_battle_1.TeamSide.Right);
        (0, vitest_1.expect)(placements).toHaveLength(3);
        (0, vitest_1.expect)(leftPlacements.every((item) => item.x >= 0 && item.x < arena_battle_1.BATTLEFIELD_GRID_SIZE)).toBe(true);
        (0, vitest_1.expect)(rightPlacements.every((item) => item.x >= 0 && item.x < arena_battle_1.BATTLEFIELD_GRID_SIZE)).toBe(true);
        (0, vitest_1.expect)(leftPlacements.every((item) => item.x < rightPlacements[0].x)).toBe(true);
        (0, vitest_1.expect)(new Set(placements.map((item) => `${item.x}:${item.y}`)).size).toBe(3);
    });
});
