import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActionType,
  CombatSkillType,
  DistanceBand,
  EMPTY_EQUIPMENT,
  TargetZone,
  TeamSide,
  createArenaCombatEntity,
  createInitialBattleState,
  createNpcAction,
  getStatsWithEquipment,
  getItemById,
  resolveRound,
  type ArenaBattleState,
  type ArenaCombatAction,
  type Equipment,
  type Race,
  type StatBlock,
} from '@theend/rpg-domain';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { CustomCombatNpcDto } from './dto.start-combat.dto';

interface CharacterRecord {
  id: string;
  name: string;
  race: string;
  hpBase: number;
  mpBase: number;
  staminaBase: number;
  strength: number;
  endurance: number;
  dexterity: number;
  intelligence: number;
  luck: number;
  speed: number;
  willpower: number;
  equipment?: Equipment | null;
}

type CombatEquipmentPayload = Partial<Equipment> | null | undefined;

interface CombatSession {
  state: ArenaBattleState;
  playerId: string;
  activeEffects: Array<{ type: CombatSkillType.CrushingBlock | CombatSkillType.Rage; remainingRounds: number }>;
  enemyTempoBreaks: Array<{ targetId: string; remainingRounds: number }>;
  damageContribution: number;
}

@Injectable()
export class CombatService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly sessions = new Map<string, CombatSession>();
  private readonly combatLootPool = [
    'potion_hp_small',
    'potion_mp_small',
    'tonic_focus',
    'iron_sword',
    'leather_helmet',
    'traveler_boots',
  ];

  private toBaseStats(character: CharacterRecord): StatBlock {
    return {
      hp: character.hpBase,
      mp: character.mpBase,
      stamina: character.staminaBase,
      strength: character.strength,
      dexterity: character.dexterity,
      constitution: character.endurance,
      luck: character.luck,
      intelligence: character.intelligence,
      perception: character.speed,
      willpower: character.willpower,
    };
  }

  private normalizePlayerActionPoints(
    action: {
      attackPointsSpent: number;
      defensePointsSpent: number;
      actionType: ActionType;
    },
    availableStamina: number,
  ): { attackPointsSpent: number; defensePointsSpent: number } {
    const requestedAttack = Math.max(0, action.attackPointsSpent);
    const requestedDefense = Math.max(0, action.defensePointsSpent);

    if (requestedAttack + requestedDefense > 0) {
      const cappedAttack = Math.min(requestedAttack, availableStamina);
      return {
        attackPointsSpent: cappedAttack,
        defensePointsSpent: Math.max(0, Math.min(requestedDefense, availableStamina - cappedAttack)),
      };
    }

    if (action.actionType === ActionType.Defend) {
      return {
        attackPointsSpent: 0,
        defensePointsSpent: availableStamina,
      };
    }

    if (action.actionType === ActionType.Attack) {
      const attackPointsSpent = Math.max(1, Math.round(availableStamina * 0.65));
      return {
        attackPointsSpent,
        defensePointsSpent: Math.max(0, availableStamina - attackPointsSpent),
      };
    }

    return {
      attackPointsSpent: 0,
      defensePointsSpent: 0,
    };
  }

  private refreshBattleResult(state: ArenaBattleState): void {
    const leftAlive = state.entities.some((item) => item.team === TeamSide.Left && item.isAlive);
    const rightAlive = state.entities.some((item) => item.team === TeamSide.Right && item.isAlive);

    if (!leftAlive && !rightAlive) {
      state.isFinished = true;
      state.winner = undefined;
      return;
    }
    if (!leftAlive) {
      state.isFinished = true;
      state.winner = TeamSide.Right;
      return;
    }
    if (!rightAlive) {
      state.isFinished = true;
      state.winner = TeamSide.Left;
    }
  }

  private requiredExpForNextLevel(level: number): number {
    return 100 * (level + 1);
  }

  private async applyCombatExp(characterId: string, gainedExp: number): Promise<{ gainedExp: number; levelsGained: number }> {
    if (gainedExp <= 0) {
      return { gainedExp: 0, levelsGained: 0 };
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { level: true, exp: true, freePoints: true },
    });

    if (!character) {
      return { gainedExp: 0, levelsGained: 0 };
    }

    let nextLevel = character.level;
    let nextExp = character.exp + gainedExp;
    let levelsGained = 0;

    while (nextExp >= this.requiredExpForNextLevel(nextLevel)) {
      nextLevel += 1;
      levelsGained += 1;
    }

    await this.prisma.character.update({
      where: { id: characterId },
      data: {
        exp: nextExp,
        level: nextLevel,
        freePoints: character.freePoints + levelsGained * 5,
      },
    });

    return { gainedExp, levelsGained };
  }

  private async applyCombatGold(characterId: string, gainedGold: number): Promise<number> {
    if (gainedGold <= 0) {
      return 0;
    }

    await this.prisma.character.update({
      where: { id: characterId },
      data: {
        gold: {
          increment: gainedGold,
        },
      },
    });

    return gainedGold;
  }

  private calculateCombatGoldReward(state: ArenaBattleState, damageContribution: number): number {
    const enemies = state.entities.filter((entity) => entity.team === TeamSide.Right);
    const enemyCount = enemies.length;
    const threatScore = enemies.reduce(
      (sum, enemy) => sum + Math.round((enemy.strength + enemy.constitution + enemy.dexterity + enemy.perception) / 4),
      0,
    );

    return Math.max(20, enemyCount * 14 + threatScore * 3 + Math.floor(damageContribution * 0.35));
  }

  private rollCombatDrop(state: ArenaBattleState): string | null {
    const enemies = state.entities.filter((entity) => entity.team === TeamSide.Right);
    const enemyCount = enemies.length;
    const threatScore = enemies.reduce(
      (sum, enemy) => sum + Math.round((enemy.strength + enemy.constitution + enemy.dexterity + enemy.perception) / 4),
      0,
    );

    const chance = Math.min(0.7, 0.16 + enemyCount * 0.1 + Math.min(0.34, threatScore / 260));
    if (Math.random() > chance) {
      return null;
    }

    const index = Math.floor(Math.random() * this.combatLootPool.length);
    return this.combatLootPool[index] ?? null;
  }

  private async grantCombatLoot(characterId: string, itemId: string): Promise<string | null> {
    const item = getItemById(itemId);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.characterInventoryItem.findUnique({
        where: { characterId_itemId: { characterId, itemId } },
      });

      if (existing) {
        await tx.characterInventoryItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + 1 },
        });
      } else {
        await tx.characterInventoryItem.create({
          data: { characterId, itemId, quantity: 1 },
        });
      }
    });

    return item.name;
  }

  private upsertEffect(
    effects: Array<{ type: CombatSkillType.CrushingBlock | CombatSkillType.Rage; remainingRounds: number }>,
    effectType: CombatSkillType.CrushingBlock | CombatSkillType.Rage,
    rounds: number,
  ): void {
    const existing = effects.find((item) => item.type === effectType);
    if (existing) {
      existing.remainingRounds = Math.max(existing.remainingRounds, rounds);
      return;
    }

    effects.push({ type: effectType, remainingRounds: rounds });
  }

  private toCombatEntity(character: CharacterRecord, team: TeamSide, position: number) {
    const baseStats = this.toBaseStats(character);
    const equipment = this.normalizeEquipment(character.equipment);
    const activeStats = getStatsWithEquipment(baseStats, equipment);

    return this.toCombatEntityFromStats({
      id: character.id,
      name: character.name,
      race: character.race as Race,
      team,
      position,
      stats: activeStats,
    });
  }

  private normalizeEquipment(equipment?: CombatEquipmentPayload): Equipment {
    return {
      ...EMPTY_EQUIPMENT,
      weapon: equipment?.weapon ?? null,
      helmet: equipment?.helmet ?? null,
      armor: equipment?.armor ?? null,
      boots: equipment?.boots ?? null,
      gloves: equipment?.gloves ?? null,
      shield: equipment?.shield ?? null,
    };
  }

  private toCombatEntityFromStats(params: {
    id: string;
    name: string;
    race: Race;
    team: TeamSide;
    position: number;
    stats: StatBlock;
  }) {
    return createArenaCombatEntity({
      id: params.id,
      name: params.name,
      team: params.team,
      race: params.race,
      currentHp: params.stats.hp,
      maxHp: params.stats.hp,
      currentMp: params.stats.mp,
      maxMp: params.stats.mp,
      currentStamina: params.stats.stamina,
      maxStamina: params.stats.stamina,
      strength: params.stats.strength,
      constitution: params.stats.constitution,
      dexterity: params.stats.dexterity,
      intelligence: params.stats.intelligence,
      luck: params.stats.luck,
      perception: params.stats.perception,
      willpower: params.stats.willpower,
      position: params.position,
    });
  }

  private createGeneratedEnemy(playerStats: StatBlock, playerRace: Race, position: number, index: number, count: number) {
    return this.toCombatEntityFromStats({
      id: `bot-${randomUUID()}`,
      name: count > 1 ? `Bandit ${index + 1}` : 'Bandit',
      race: playerRace,
      team: TeamSide.Right,
      position,
      stats: {
        hp: Math.max(20, Math.round(playerStats.hp * (0.82 + (index % 2) * 0.06))),
        mp: Math.max(0, Math.round(playerStats.mp * 0.45)),
        stamina: Math.max(4, Math.round(playerStats.stamina * 0.88)),
        strength: Math.max(1, playerStats.strength - 1),
        constitution: Math.max(1, playerStats.constitution),
        dexterity: Math.max(1, playerStats.dexterity),
        intelligence: Math.max(1, playerStats.intelligence - 1),
        luck: Math.max(1, playerStats.luck),
        perception: Math.max(1, playerStats.perception - 1),
        willpower: Math.max(1, playerStats.willpower),
      },
    });
  }

  private createCustomEnemy(template: CustomCombatNpcDto, position: number) {
    const equipment = this.normalizeEquipment(template.equipment);
    const activeStats = getStatsWithEquipment(template.stats, equipment);

    return this.toCombatEntityFromStats({
      id: `npc-${randomUUID()}`,
      name: template.name,
      race: template.race,
      team: TeamSide.Right,
      position,
      stats: activeStats,
    });
  }

  async startCombat(characterId: string, enemyCount = 1, customEnemies: CustomCombatNpcDto[] = []) {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { equipment: true },
    });

    if (!character) {
      throw new NotFoundException('Character not found.');
    }

    const player = this.toCombatEntity(character, TeamSide.Left, 1);
    const playerStats: StatBlock = {
      hp: player.maxHp,
      mp: player.maxMp,
      stamina: player.maxStamina,
      strength: player.strength,
      constitution: player.constitution,
      dexterity: player.dexterity,
      intelligence: player.intelligence,
      luck: player.luck,
      perception: player.perception,
      willpower: player.willpower,
    };

    const normalizedCustomEnemies = customEnemies.filter((enemy) => enemy.name.trim().length > 0);
    const count = normalizedCustomEnemies.length > 0
      ? normalizedCustomEnemies.length
      : Math.max(1, Math.min(5, enemyCount));

    const enemies = normalizedCustomEnemies.length > 0
      ? normalizedCustomEnemies.map((enemy, index) => this.createCustomEnemy(enemy, 3 + index))
      : Array.from({ length: count }, (_, index) => this.createGeneratedEnemy(playerStats, character.race as Race, 3 + index, index, count));

    const combatId = randomUUID();
    const state = createInitialBattleState({
      combatId,
      distance: DistanceBand.Melee,
      entities: [player, ...enemies],
    });

    this.sessions.set(combatId, {
      state,
      playerId: player.id,
      activeEffects: [],
      enemyTempoBreaks: [],
      damageContribution: 0,
    });

    return {
      combatId,
      playerId: player.id,
      state,
    };
  }

  getCombatState(combatId: string): ArenaBattleState {
    const session = this.sessions.get(combatId);
    if (!session) {
      throw new NotFoundException('Combat not found.');
    }
    return session.state;
  }

  async useCombatItem(payload: { combatId: string; actorId: string; itemId: string }) {
    const session = this.sessions.get(payload.combatId);
    if (!session) {
      throw new NotFoundException('Combat not found.');
    }

    if (payload.actorId !== session.playerId) {
      throw new BadRequestException('Only the player can use combat items.');
    }

    const item = getItemById(payload.itemId);
    if (item.itemType !== 'consumable') {
      throw new BadRequestException('Only consumables can be used in combat.');
    }

    const actor = session.state.entities.find((entity) => entity.id === payload.actorId);
    if (!actor || !actor.isAlive) {
      throw new BadRequestException('Actor cannot use items now.');
    }

    const inventoryEntry = await this.prisma.characterInventoryItem.findUnique({
      where: { characterId_itemId: { characterId: payload.actorId, itemId: payload.itemId } },
    });

    if (!inventoryEntry || inventoryEntry.quantity <= 0) {
      throw new BadRequestException('Item is not available in inventory.');
    }

    if (item.itemSubType === 'potion_hp') {
      actor.currentHp = Math.min(actor.maxHp, actor.currentHp + 40);
    } else if (item.itemSubType === 'potion_mp') {
      actor.currentMp = Math.min(actor.maxMp, actor.currentMp + 30);
    } else {
      actor.currentStamina = Math.min(actor.maxStamina, actor.currentStamina + 25);
    }

    if (inventoryEntry.quantity === 1) {
      await this.prisma.characterInventoryItem.delete({ where: { id: inventoryEntry.id } });
    } else {
      await this.prisma.characterInventoryItem.update({
        where: { id: inventoryEntry.id },
        data: { quantity: inventoryEntry.quantity - 1 },
      });
    }

    const latestInventory = await this.prisma.characterInventoryItem.findMany({
      where: { characterId: payload.actorId },
      select: { itemId: true, quantity: true },
      orderBy: { itemId: 'asc' },
    });

    const character = await this.prisma.character.findUnique({
      where: { id: payload.actorId },
      select: { gold: true },
    });

    const logText = `${actor.name} uses ${item.name}`;
    const infoLog = {
      round: session.state.roundNumber,
      actorId: actor.id,
      type: 'INFO' as const,
      text: logText,
    };
    session.state.logs.push(infoLog);
    session.state.lastRound?.logs.push(infoLog);

    return {
      state: session.state,
      inventory: latestInventory,
      gold: character?.gold ?? 0,
    };
  }

  async resolvePlayerRound(
    combatId: string,
    playerAction: {
      actorId: string;
      targetId: string;
      attackZone: TargetZone;
      defenseZones: TargetZone[];
      attackPointsSpent: number;
      defensePointsSpent: number;
      actionType: ActionType;
      preferredDistance?: DistanceBand;
      destinationX?: number;
      destinationY?: number;
      skillType?: CombatSkillType;
    },
  ): Promise<ArenaBattleState> {
    const session = this.sessions.get(combatId);
    if (!session) {
      throw new NotFoundException('Combat not found.');
    }

    const { state, playerId } = session;
    if (state.isFinished) {
      return state;
    }

    if (playerAction.actorId !== playerId) {
      throw new BadRequestException('Only player actor can submit action.');
    }

    const playerEntity = state.entities.find((item) => item.id === playerId);
    if (!playerEntity || !playerEntity.isAlive) {
      throw new BadRequestException('Player cannot act.');
    }

    const requestedTotalSpent = Math.max(0, playerAction.attackPointsSpent) + Math.max(0, playerAction.defensePointsSpent);
    if (requestedTotalSpent > playerEntity.currentStamina) {
      throw new BadRequestException('Not enough stamina for selected action points.');
    }

    const hasRage = session.activeEffects.some((item) => item.type === CombatSkillType.Rage && item.remainingRounds > 0);
    const hasCrushing = session.activeEffects.some(
      (item) => item.type === CombatSkillType.CrushingBlock && item.remainingRounds > 0,
    );

    let powerStrikeActive = false;
    const skillLogs: string[] = [];
    const selectedSkill = playerAction.actionType === ActionType.Attack
      ? playerAction.skillType ?? CombatSkillType.None
      : CombatSkillType.None;
    const magicPenaltyMultiplier = 0.5;

    const skillCostMap: Record<CombatSkillType, number> = {
      [CombatSkillType.None]: 0,
      [CombatSkillType.PowerStrike]: 15,
      [CombatSkillType.CrushingBlock]: 20,
      [CombatSkillType.Rage]: 25,
      [CombatSkillType.Fireball]: 18,
      [CombatSkillType.FrostLance]: 16,
      [CombatSkillType.ShieldBash]: 14,
      [CombatSkillType.Whirlwind]: 22,
    };

    const skillResourceMap: Record<CombatSkillType, 'mp' | 'stamina'> = {
      [CombatSkillType.None]: 'mp',
      [CombatSkillType.PowerStrike]: 'mp',
      [CombatSkillType.CrushingBlock]: 'mp',
      [CombatSkillType.Rage]: 'mp',
      [CombatSkillType.Fireball]: 'mp',
      [CombatSkillType.FrostLance]: 'mp',
      [CombatSkillType.ShieldBash]: 'stamina',
      [CombatSkillType.Whirlwind]: 'stamina',
    };

    const cost = skillCostMap[selectedSkill];
    if (cost > 0) {
      const resourceType = skillResourceMap[selectedSkill];
      if (resourceType === 'mp') {
        if (playerEntity.currentMp < cost) {
          throw new BadRequestException('Not enough MP for selected skill.');
        }
        playerEntity.currentMp -= cost;
      } else {
        if (playerEntity.currentStamina < cost) {
          throw new BadRequestException('Not enough stamina for selected skill.');
        }
        playerEntity.currentStamina -= cost;
      }

      if (selectedSkill === CombatSkillType.PowerStrike) {
        powerStrikeActive = true;
        skillLogs.push(`${playerEntity.name} uses Power Strike`);
      }
      if (selectedSkill === CombatSkillType.CrushingBlock) {
        this.upsertEffect(session.activeEffects, CombatSkillType.CrushingBlock, 2);
        skillLogs.push(`${playerEntity.name} uses Crushing Block`);
      }
      if (selectedSkill === CombatSkillType.Rage) {
        this.upsertEffect(session.activeEffects, CombatSkillType.Rage, 3);
        skillLogs.push(`${playerEntity.name} enters Rage`);
      }
      if (selectedSkill === CombatSkillType.Fireball) {
        skillLogs.push(`${playerEntity.name} casts Fireball`);
      }
      if (selectedSkill === CombatSkillType.FrostLance) {
        skillLogs.push(`${playerEntity.name} casts Frost Lance`);
      }
      if (selectedSkill === CombatSkillType.ShieldBash) {
        skillLogs.push(`${playerEntity.name} uses Shield Bash`);
      }
      if (selectedSkill === CombatSkillType.Whirlwind) {
        skillLogs.push(`${playerEntity.name} uses Whirlwind`);
      }
    }

    const crushingActiveNow = hasCrushing || selectedSkill === CombatSkillType.CrushingBlock;
    const rageActiveNow = hasRage || selectedSkill === CombatSkillType.Rage;
    const normalizedPoints = this.normalizePlayerActionPoints(playerAction, playerEntity.currentStamina);

    const buffedPlayerAction: ArenaCombatAction = {
      actorId: playerAction.actorId,
      targetId: playerAction.targetId,
      attackZone: playerAction.attackZone,
      defenseZones: playerAction.defenseZones,
      attackPointsSpent: normalizedPoints.attackPointsSpent,
      defensePointsSpent: crushingActiveNow
        ? Math.max(0, Math.ceil(normalizedPoints.defensePointsSpent * 1.4))
        : normalizedPoints.defensePointsSpent,
      actionType: playerAction.actionType,
      preferredDistance: playerAction.preferredDistance,
      destinationX: playerAction.destinationX,
      destinationY: playerAction.destinationY,
    };

    const originalStrength = playerEntity.strength;
    const originalConstitution = playerEntity.constitution;

    if (rageActiveNow) {
      playerEntity.strength = Math.max(1, playerEntity.strength + 15);
      playerEntity.constitution = Math.max(1, playerEntity.constitution - 10);
    }

    if (powerStrikeActive) {
      playerEntity.strength = Math.max(1, playerEntity.strength + Math.max(1, Math.ceil(originalStrength * 0.25)));
    }

    const tempoBrokenTargets = new Set(
      session.enemyTempoBreaks
        .filter((item) => item.remainingRounds > 0)
        .map((item) => item.targetId),
    );

    const enemyActions: ArenaCombatAction[] = state.entities
      .filter((item) => item.team !== TeamSide.Left && item.isAlive)
      .map((item) => {
        const npcAction = createNpcAction(state, item.id);
        if (!tempoBrokenTargets.has(item.id)) {
          return npcAction;
        }

        const reducedAttack = Math.max(
          npcAction.actionType === ActionType.Attack ? 1 : 0,
          Math.floor(npcAction.attackPointsSpent * 0.65),
        );
        const reducedDefense = Math.max(0, Math.floor(npcAction.defensePointsSpent * 0.65));

        skillLogs.push(`${item.name} loses tempo: -35% ATK/DEF points this round`);

        return {
          ...npcAction,
          attackPointsSpent: reducedAttack,
          defensePointsSpent: reducedDefense,
        };
      });

    const allActions: ArenaCombatAction[] = [
      buffedPlayerAction,
      ...enemyActions,
    ];

    const nextState = resolveRound({
      state,
      plannedActions: allActions,
    });

    const selectedTarget = nextState.entities.find((item) => item.id === playerAction.targetId);
    if (selectedSkill === CombatSkillType.Fireball && selectedTarget?.isAlive) {
      const extraDamage = Math.max(4, Math.floor(playerEntity.intelligence * 1.8 * magicPenaltyMultiplier));
      selectedTarget.currentHp = Math.max(0, selectedTarget.currentHp - extraDamage);
      selectedTarget.isAlive = selectedTarget.currentHp > 0;
      const fireballLog = {
        round: nextState.roundNumber,
        actorId: playerEntity.id,
        targetId: selectedTarget.id,
        type: 'HIT' as const,
        amount: extraDamage,
        text: `${playerEntity.name} hits ${selectedTarget.name} with Fireball for ${extraDamage} (non-mage penalty)`,
      };
      nextState.logs.push(fireballLog);
      nextState.lastRound?.logs.push(fireballLog);
    }

    if (selectedSkill === CombatSkillType.FrostLance && selectedTarget?.isAlive) {
      const extraDamage = Math.max(3, Math.floor(playerEntity.intelligence * 1.4 * magicPenaltyMultiplier));
      selectedTarget.currentHp = Math.max(0, selectedTarget.currentHp - extraDamage);
      selectedTarget.perception = Math.max(1, selectedTarget.perception - 1);
      selectedTarget.isAlive = selectedTarget.currentHp > 0;
      const frostLog = {
        round: nextState.roundNumber,
        actorId: playerEntity.id,
        targetId: selectedTarget.id,
        type: 'HIT' as const,
        amount: extraDamage,
        text: `${playerEntity.name} impales ${selectedTarget.name} with Frost Lance for ${extraDamage} (non-mage penalty)`,
      };
      nextState.logs.push(frostLog);
      nextState.lastRound?.logs.push(frostLog);
    }

    if (selectedSkill === CombatSkillType.ShieldBash && selectedTarget?.isAlive) {
      const bashDamage = Math.max(4, Math.floor(playerEntity.constitution * 0.8));
      selectedTarget.currentHp = Math.max(0, selectedTarget.currentHp - bashDamage);
      selectedTarget.currentStamina = Math.max(0, selectedTarget.currentStamina - 16);
      selectedTarget.isAlive = selectedTarget.currentHp > 0;

      const existingTempoBreak = session.enemyTempoBreaks.find((item) => item.targetId === selectedTarget.id);
      if (existingTempoBreak) {
        existingTempoBreak.remainingRounds = Math.max(existingTempoBreak.remainingRounds, 1);
      } else {
        session.enemyTempoBreaks.push({
          targetId: selectedTarget.id,
          remainingRounds: 1,
        });
      }

      const bashLog = {
        round: nextState.roundNumber,
        actorId: playerEntity.id,
        targetId: selectedTarget.id,
        type: 'HIT' as const,
        amount: bashDamage,
        text: `${playerEntity.name} bashes ${selectedTarget.name} for ${bashDamage}; stamina -16, tempo broken`,
      };
      nextState.logs.push(bashLog);
      nextState.lastRound?.logs.push(bashLog);
    }

    if (selectedSkill === CombatSkillType.Whirlwind) {
      const aliveEnemies = nextState.entities.filter((item) => item.team === TeamSide.Right && item.isAlive);
      for (const enemy of aliveEnemies) {
        const aoeDamage = Math.max(5, Math.floor(playerEntity.strength * 0.9));
        enemy.currentHp = Math.max(0, enemy.currentHp - aoeDamage);
        enemy.isAlive = enemy.currentHp > 0;
        const aoeLog = {
          round: nextState.roundNumber,
          actorId: playerEntity.id,
          targetId: enemy.id,
          type: 'HIT' as const,
          amount: aoeDamage,
          text: `${playerEntity.name} hits ${enemy.name} with Whirlwind for ${aoeDamage}`,
        };
        nextState.logs.push(aoeLog);
        nextState.lastRound?.logs.push(aoeLog);
      }
    }

    this.refreshBattleResult(nextState);

    playerEntity.strength = originalStrength;
    playerEntity.constitution = originalConstitution;

    for (const effect of session.activeEffects) {
      effect.remainingRounds -= 1;
    }
    session.activeEffects = session.activeEffects.filter((item) => item.remainingRounds > 0);

    for (const debuff of session.enemyTempoBreaks) {
      debuff.remainingRounds -= 1;
    }
    session.enemyTempoBreaks = session.enemyTempoBreaks.filter((item) => item.remainingRounds > 0);

    if (skillLogs.length > 0) {
      const entries = skillLogs.map((text) => ({
        round: nextState.roundNumber,
        actorId: playerEntity.id,
        type: 'INFO' as const,
        text,
      }));
      nextState.logs.push(...entries);
      if (nextState.lastRound) {
        nextState.lastRound.logs.push(...entries);
      }
    }

    const roundLogs = nextState.lastRound?.logs ?? [];
    const roundDamage = roundLogs
      .filter((entry) => entry.type === 'HIT' && entry.actorId === playerId)
      .reduce((sum, entry) => sum + Math.max(0, entry.amount ?? 0), 0);
    session.damageContribution += roundDamage;

    if (nextState.isFinished && nextState.winner === TeamSide.Left) {
      const progression = await this.applyCombatExp(playerId, session.damageContribution);
      if (progression.gainedExp > 0) {
        const expLog = {
          round: nextState.roundNumber,
          actorId: playerId,
          type: 'INFO' as const,
          text: `Battle reward: +${progression.gainedExp} EXP`,
        };
        nextState.logs.push(expLog);
        if (nextState.lastRound) {
          nextState.lastRound.logs.push(expLog);
        }
      }

      if (progression.levelsGained > 0) {
        const levelLog = {
          round: nextState.roundNumber,
          actorId: playerId,
          type: 'INFO' as const,
          text: `${playerEntity.name} levels up! +${progression.levelsGained * 5} free stat points`,
        };
        nextState.logs.push(levelLog);
        if (nextState.lastRound) {
          nextState.lastRound.logs.push(levelLog);
        }
      }

      const gainedGold = await this.applyCombatGold(playerId, this.calculateCombatGoldReward(nextState, session.damageContribution));

      if (gainedGold > 0) {
        const goldLog = {
          round: nextState.roundNumber,
          actorId: playerId,
          type: 'INFO' as const,
          text: `Battle reward: +${gainedGold} gold`,
        };
        nextState.logs.push(goldLog);
        if (nextState.lastRound) {
          nextState.lastRound.logs.push(goldLog);
        }
      }

      const droppedItemId = this.rollCombatDrop(nextState);
      if (droppedItemId) {
        const itemName = await this.grantCombatLoot(playerId, droppedItemId);
        if (itemName) {
          const lootLog = {
            round: nextState.roundNumber,
            actorId: playerId,
            type: 'INFO' as const,
            text: `Battle reward: loot ${itemName}`,
          };
          nextState.logs.push(lootLog);
          if (nextState.lastRound) {
            nextState.lastRound.logs.push(lootLog);
          }
        }
      }
    }

    if (nextState.isFinished && !playerEntity.isAlive) {
      session.damageContribution = 0;
      playerEntity.currentHp = playerEntity.maxHp;
      playerEntity.currentStamina = playerEntity.maxStamina;
      playerEntity.isAlive = true;

      const reviveLog = {
        round: nextState.roundNumber,
        actorId: playerId,
        type: 'INFO' as const,
        text: `${playerEntity.name} is revived after defeat with full HP`,
      };
      nextState.logs.push(reviveLog);
      if (nextState.lastRound) {
        nextState.lastRound.logs.push(reviveLog);
      }
    }

    return nextState;
  }
}
