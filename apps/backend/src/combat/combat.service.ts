import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ActionType,
  BATTLEFIELD_GRID_SIZE,
  BattlefieldTrapState,
  BattlefieldTileType,
  CombatSkillType,
  DistanceBand,
  MovementType,
  TargetZone,
  TeamSide,
  createArenaCombatEntity,
  createInitialBattleState,
  createNpcAction,
  getRequiredExpForNextLevel,
  resolveRound,
  type ArenaBattleState,
  type ArenaCombatAction,
  type BattlefieldTile,
  type Equipment,
  type Race,
  type StatBlock,
} from '@theend/rpg-domain';
import { randomUUID } from 'crypto';
import { ArenaService } from '../arena/arena.service';
import { ContentService } from '../content/content.service';
import { PrismaService } from '../prisma/prisma.service';
import { SkillRuntimeService, type SkillCooldownEntry } from '../skills/skill-runtime.service';
import { MAX_COMBAT_ENEMIES, type CustomCombatNpcDto, type RuntimeBattleMapDto } from './dto.start-combat.dto';
import type { AdminItem } from '../content/content.types';
import { RuntimeCharacterStore } from '../characters/runtime-character-store';
import { isFileStorageMode } from '../config/storage-mode';

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
  equipment?: Partial<Equipment> | null;
}

type CombatEquipmentPayload = Partial<Equipment> | null | undefined;
type CombatStyleHint = 'MELEE' | 'RANGED' | 'MAGIC';
type WeaponCombatProfile = Pick<AdminItem, 'attackRange' | 'pierceTargets' | 'splashRadius' | 'splashCenterMultiplier' | 'splashOuterMultiplier'> & {
  combatStyleHint: CombatStyleHint;
};

interface CombatSession {
  state: ArenaBattleState;
  playerId: string;
  activeEffects: Array<{ type: CombatSkillType.CrushingBlock | CombatSkillType.Rage; remainingRounds: number }>;
  enemyTempoBreaks: Array<{ targetId: string; remainingRounds: number }>;
  damageContribution: number;
  skillCooldowns: SkillCooldownEntry[];
}

interface NormalizedResourceCosts {
  mana: number;
  stamina: number;
  hp: number;
}

interface NormalizedItemEffect {
  type: string;
  amount: number;
  statusId?: string;
  target?: string;
}

export interface CombatActionResult {
  state: ArenaBattleState;
  hubState?: Awaited<ReturnType<ArenaService['getHubState']>>;
}

const DEFAULT_TURN_SECONDS = 60;

@Injectable()
export class CombatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
    private readonly arenaService: ArenaService,
    private readonly skillRuntime: SkillRuntimeService,
    private readonly runtimeStore: RuntimeCharacterStore,
  ) {}

  private readonly sessions = new Map<string, CombatSession>();

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

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private normalizeRuntimeInventoryItems(value: unknown): Array<{ id: string; itemId: string; quantity: number }> {
    if (!Array.isArray(value)) {
      return [];
    }

    const merged = new Map<string, { id: string; itemId: string; quantity: number }>();

    for (const entry of value) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const raw = entry as Record<string, unknown>;
      const rawItemId = typeof raw.itemId === 'string' ? raw.itemId.trim() : '';
      if (!rawItemId) {
        continue;
      }

      const rawId = typeof raw.id === 'string' ? raw.id.trim() : '';
      const id = rawId.length > 0 ? rawId : `local_inv_${randomUUID()}`;

      const rawQuantity = typeof raw.quantity === 'number' ? raw.quantity : Number(raw.quantity);
      const quantity = Number.isFinite(rawQuantity) ? Math.max(0, Math.floor(rawQuantity)) : 0;
      if (quantity <= 0) {
        continue;
      }

      const existing = merged.get(rawItemId);
      if (existing) {
        existing.quantity += quantity;
      } else {
        merged.set(rawItemId, { id, itemId: rawItemId, quantity });
      }
    }

    return [...merged.values()];
  }

  private async readRuntimeInventoryItems(characterId: string): Promise<Array<{ id: string; itemId: string; quantity: number }>> {
    const character = await this.runtimeStore.getCharacterById(characterId);
    if (!character) {
      throw new NotFoundException('Character not found.');
    }

    return this.normalizeRuntimeInventoryItems((character as { inventoryItems?: unknown }).inventoryItems);
  }

  private async writeRuntimeInventoryItems(characterId: string, inventoryItems: Array<{ id: string; itemId: string; quantity: number }>): Promise<void> {
    const updated = await this.runtimeStore.updateCharacter(characterId, {
      inventoryItems: this.normalizeRuntimeInventoryItems(inventoryItems),
    });

    if (!updated) {
      throw new NotFoundException('Character not found.');
    }
  }

  private async updateRuntimeInventoryItemQuantity(characterId: string, itemId: string, delta: number): Promise<void> {
    const normalizedItemId = String(itemId ?? '').trim();
    if (!normalizedItemId) {
      throw new BadRequestException('itemId is required.');
    }

    const safeDelta = Math.trunc(delta);
    if (safeDelta === 0) {
      return;
    }

    const current = await this.readRuntimeInventoryItems(characterId);
    const index = current.findIndex((row) => row.itemId === normalizedItemId);

    if (index < 0) {
      if (safeDelta < 0) {
        throw new BadRequestException('Item is not available in inventory.');
      }

      await this.writeRuntimeInventoryItems(characterId, [
        ...current,
        { id: `local_inv_${randomUUID()}`, itemId: normalizedItemId, quantity: safeDelta },
      ]);
      return;
    }

    const row = current[index]!;
    const nextQuantity = row.quantity + safeDelta;
    if (nextQuantity < 0) {
      throw new BadRequestException('Item is not available in inventory.');
    }

    if (nextQuantity === 0) {
      current.splice(index, 1);
      await this.writeRuntimeInventoryItems(characterId, current);
      return;
    }

    current[index] = { ...row, quantity: nextQuantity };
    await this.writeRuntimeInventoryItems(characterId, current);
  }

  private toFiniteAmount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  private accumulateResourceCost(costs: NormalizedResourceCosts, resource: unknown, amount: unknown): void {
    const key = String(resource ?? '').trim().toLowerCase();
    const safeAmount = this.toFiniteAmount(amount);
    if (safeAmount <= 0) {
      return;
    }
    if (key === 'mana' || key === 'mp') {
      costs.mana += safeAmount;
      return;
    }
    if (key === 'stamina' || key === 'sta') {
      costs.stamina += safeAmount;
      return;
    }
    if (key === 'hp' || key === 'health') {
      costs.hp += safeAmount;
    }
  }

  private normalizeResourceCosts(rawValue: unknown): NormalizedResourceCosts {
    const costs: NormalizedResourceCosts = { mana: 0, stamina: 0, hp: 0 };
    const raw = this.toRecord(rawValue);
    if (!raw) {
      return costs;
    }

    this.accumulateResourceCost(costs, 'mana', raw.manaCost);
    this.accumulateResourceCost(costs, 'stamina', raw.staminaCost);
    this.accumulateResourceCost(costs, 'hp', raw.hpCost);

    const directCosts = Array.isArray(raw.costs) ? raw.costs : [];
    for (const entry of directCosts) {
      const record = this.toRecord(entry);
      if (!record) {
        continue;
      }
      this.accumulateResourceCost(costs, record.resource ?? record.type, record.amount);
    }

    const nestedCosts = this.toRecord(raw.costs);
    const nestedResources = Array.isArray(nestedCosts?.resources) ? nestedCosts.resources : [];
    for (const entry of nestedResources) {
      const record = this.toRecord(entry);
      if (!record) {
        continue;
      }
      this.accumulateResourceCost(costs, record.resource ?? record.type, record.amount);
    }

    return costs;
  }

  private normalizeItemEffects(item: { itemType: string; itemSubType?: string } | null, rawValue: unknown): NormalizedItemEffect[] {
    const raw = this.toRecord(rawValue);
    const sources: unknown[] = [];

    // New item-effects contract for active use effects.
    if (Array.isArray(raw?.useEffects)) {
      sources.push(...raw.useEffects);
    }

    // Legacy fields are kept unchanged for backward compatibility.
    const singleEffect = raw ? this.toRecord(raw.useEffect) : null;
    if (singleEffect) {
      sources.push(singleEffect);
    }
    if (Array.isArray(raw?.effects)) {
      sources.push(...raw.effects);
    }
    if (Array.isArray(raw?.combatEffects)) {
      sources.push(...raw.combatEffects);
    }

    const normalized = sources
      .map((entry) => this.toRecord(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .map((entry) => ({
        type: String(entry.type ?? '').trim().toLowerCase(),
        amount: this.toFiniteAmount(entry.amount),
        statusId: typeof entry.statusId === 'string' ? entry.statusId : undefined,
        target: typeof entry.target === 'string' ? entry.target : undefined,
      }))
      .filter((entry) => entry.type.length > 0);

    if (normalized.length > 0) {
      return normalized;
    }

    if (item?.itemSubType === 'potion_hp') {
      return [{ type: 'heal_hp', amount: 40, target: 'self' }];
    }
    if (item?.itemSubType === 'potion_mp') {
      return [{ type: 'restore_mana', amount: 30, target: 'self' }];
    }
    if (item?.itemType === 'consumable') {
      return [{ type: 'restore_stamina', amount: 25, target: 'self' }];
    }

    return [];
  }

  private describeResourceCosts(costs: NormalizedResourceCosts): string | null {
    const parts = [
      costs.mana > 0 ? `${costs.mana} mana` : null,
      costs.stamina > 0 ? `${costs.stamina} stamina` : null,
      costs.hp > 0 ? `${costs.hp} HP` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  private ensureSufficientResources(entity: { id?: string; currentMp: number; currentStamina: number; currentHp: number }, costs: NormalizedResourceCosts): void {
    console.info('[resourceCost] check', { entityId: entity.id, costs });
    if (costs.mana > entity.currentMp) {
      throw new BadRequestException('Not enough mana');
    }
    if (costs.stamina > entity.currentStamina) {
      throw new BadRequestException('Not enough stamina');
    }
    if (costs.hp >= entity.currentHp) {
      throw new BadRequestException('Not enough HP');
    }
  }

  private spendEntityResources(entity: { id?: string; currentMp: number; currentStamina: number; currentHp: number }, costs: NormalizedResourceCosts): void {
    console.info('[resourceCost] spend', { entityId: entity.id, costs });
    entity.currentMp = Math.max(0, entity.currentMp - costs.mana);
    entity.currentStamina = Math.max(0, entity.currentStamina - costs.stamina);
    entity.currentHp = Math.max(0, entity.currentHp - costs.hp);
  }

  private resolveItemEffectTarget(
    effect: NormalizedItemEffect,
    actor: ArenaBattleState['entities'][number],
    state: ArenaBattleState,
    targetId?: string,
  ) {
    const targetMode = String(effect.target ?? '').trim().toLowerCase();
    if (effect.type === 'damage_target' || targetMode.includes('enemy')) {
      const target = state.entities.find((entity) => entity.id === targetId);
      if (!target || !target.isAlive || target.team === actor.team) {
        throw new BadRequestException('Invalid enemy target for item.');
      }
      return target;
    }
    if (targetMode.includes('ally')) {
      const ally = state.entities.find((entity) => entity.id === targetId && entity.team === actor.team && entity.isAlive);
      return ally ?? actor;
    }
    return actor;
  }

  private applyItemEffect(
    effect: NormalizedItemEffect,
    actor: ArenaBattleState['entities'][number],
    state: ArenaBattleState,
    round: number,
    targetId?: string,
  ): Array<{ round: number; actorId: string; targetId?: string; type: 'INFO' | 'HIT'; amount?: number; text: string }> {
    const target = this.resolveItemEffectTarget(effect, actor, state, targetId);
    switch (effect.type) {
      case 'heal_hp': {
        const healed = Math.max(0, Math.min(target.maxHp - target.currentHp, effect.amount));
        target.currentHp += healed;
        return [{ round, actorId: actor.id, targetId: target.id, type: 'INFO', text: `${actor.name} heals ${target.name} for ${healed}` }];
      }
      case 'restore_mana': {
        const restored = Math.max(0, Math.min(target.maxMp - target.currentMp, effect.amount));
        target.currentMp += restored;
        return [{ round, actorId: actor.id, targetId: target.id, type: 'INFO', text: `${actor.name} restores ${restored} mana to ${target.name}` }];
      }
      case 'restore_stamina': {
        const restored = Math.max(0, Math.min(target.maxStamina - target.currentStamina, effect.amount));
        target.currentStamina += restored;
        return [{ round, actorId: actor.id, targetId: target.id, type: 'INFO', text: `${actor.name} restores ${restored} stamina to ${target.name}` }];
      }
      case 'damage_target': {
        if (target.id === actor.id) {
          throw new BadRequestException('Offensive item requires an enemy target.');
        }
        const damage = Math.max(0, effect.amount);
        target.currentHp = Math.max(0, target.currentHp - damage);
        target.isAlive = target.currentHp > 0;
        return [{ round, actorId: actor.id, targetId: target.id, type: 'HIT', amount: damage, text: `${actor.name} uses an item on ${target.name} for ${damage}` }];
      }
      case 'apply_status':
        return [{ round, actorId: actor.id, targetId: target.id, type: 'INFO', text: `${actor.name} applies ${effect.statusId ?? 'status'} to ${target.name}` }];
      case 'remove_status':
        return [{ round, actorId: actor.id, targetId: target.id, type: 'INFO', text: `${actor.name} removes ${effect.statusId ?? 'status'} from ${target.name}` }];
      default:
        throw new BadRequestException(`Unsupported item effect: ${effect.type}`);
    }
  }

  private applyEndOfRoundRegeneration(state: ArenaBattleState): void {
    // Regen runs after the round is resolved so both sides spend resources first, then recover once per full cycle.
    const round = state.roundNumber;
    const roundLogs = state.lastRound?.logs;
    for (const entity of state.entities) {
      if (!entity.isAlive) {
        continue;
      }

      const staminaRegen = Math.max(0, 5 + Math.floor(entity.constitution / 2) + Math.floor(entity.willpower / 4));
      const manaRegen = Math.max(0, 3 + Math.floor(entity.intelligence / 3) + Math.floor(entity.willpower / 3));
      const hpRegen = Math.max(0, typeof (entity as { hpRegenPerTurn?: number }).hpRegenPerTurn === 'number'
        ? (entity as { hpRegenPerTurn?: number }).hpRegenPerTurn ?? 0
        : 0);

      const appliedStamina = Math.max(0, Math.min(entity.maxStamina - entity.currentStamina, staminaRegen));
      const appliedMana = Math.max(0, Math.min(entity.maxMp - entity.currentMp, manaRegen));
      const appliedHp = Math.max(0, Math.min(entity.maxHp - entity.currentHp, hpRegen));

      if (appliedStamina <= 0 && appliedMana <= 0 && appliedHp <= 0) {
        continue;
      }

      entity.currentStamina += appliedStamina;
      entity.currentMp += appliedMana;
      entity.currentHp += appliedHp;

      console.info('[resourceRegen] apply', {
        entityId: entity.id,
        stamina: appliedStamina,
        mana: appliedMana,
        hp: appliedHp,
      });

      const textParts = [
        appliedStamina > 0 ? `+${appliedStamina} stamina` : null,
        appliedMana > 0 ? `+${appliedMana} mana` : null,
        appliedHp > 0 ? `+${appliedHp} HP` : null,
      ].filter(Boolean);
      const logEntry = {
        round,
        actorId: entity.id,
        type: 'INFO' as const,
        text: `${entity.name} regenerates ${textParts.join(', ')}`,
      };
      state.logs.push(logEntry);
      roundLogs?.push(logEntry);
    }
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

    const combatLootPool = this.contentService.getCombatLootPool();
    if (combatLootPool.length === 0) {
      return null;
    }

    const index = Math.floor(Math.random() * combatLootPool.length);
    return combatLootPool[index] ?? null;
  }

  private async grantCombatLootTx(tx: PrismaService['$transaction'] extends (...args: any[]) => any ? Prisma.TransactionClient : never, characterId: string, itemId: string): Promise<string | null> {
    const item = this.contentService.resolveItemById(itemId);

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

    return item.name;
  }

  private async applyVictoryRewards(characterId: string, state: ArenaBattleState, damageContribution: number): Promise<{
    progression: { gainedExp: number; levelsGained: number };
    gainedGold: number;
    itemName: string | null;
    hubState: Awaited<ReturnType<ArenaService['getHubState']>>;
  }> {
    if (isFileStorageMode()) {
      return this.applyVictoryRewardsFileMode(characterId, state, damageContribution);
    }

    const gainedExp = Math.max(0, Math.floor(damageContribution));
    const gainedGold = this.calculateCombatGoldReward(state, damageContribution);
    const droppedItemId = this.rollCombatDrop(state);

    let progression = { gainedExp: 0, levelsGained: 0 };
    let itemName: string | null = null;

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const character = await tx.character.findUnique({
        where: { id: characterId },
        select: { level: true, exp: true, freePoints: true },
      });

      if (!character) {
        throw new NotFoundException('Character not found.');
      }

      let nextLevel = character.level;
      const nextExp = character.exp + gainedExp;
      let levelsGained = 0;

      while (nextExp >= getRequiredExpForNextLevel(nextLevel)) {
        nextLevel += 1;
        levelsGained += 1;
      }

      await tx.character.update({
        where: { id: characterId },
        data: {
          exp: nextExp,
          level: nextLevel,
          freePoints: character.freePoints + levelsGained * 5,
          gold: {
            increment: gainedGold,
          },
        },
      });

      if (droppedItemId) {
        itemName = await this.grantCombatLootTx(tx, characterId, droppedItemId);
      }

      progression = {
        gainedExp,
        levelsGained,
      };
    });

    const hubState = await this.arenaService.getHubState(characterId);
    return {
      progression,
      gainedGold,
      itemName,
      hubState,
    };
  }

  private async applyVictoryRewardsFileMode(characterId: string, state: ArenaBattleState, damageContribution: number): Promise<{
    progression: { gainedExp: number; levelsGained: number };
    gainedGold: number;
    itemName: string | null;
    hubState: Awaited<ReturnType<ArenaService['getHubState']>>;
  }> {
    const gainedExp = Math.max(0, Math.floor(damageContribution));
    const gainedGold = this.calculateCombatGoldReward(state, damageContribution);
    const droppedItemId = this.rollCombatDrop(state);

    const character = await this.runtimeStore.getCharacterById(characterId);
    if (!character) {
      throw new NotFoundException('Character not found.');
    }

    const currentLevel = Number((character as { level?: unknown }).level ?? 0) || 0;
    const currentExp = Number((character as { exp?: unknown }).exp ?? 0) || 0;
    const currentFreePoints = Number((character as { freePoints?: unknown }).freePoints ?? 0) || 0;
    const currentGold = Number((character as { gold?: unknown }).gold ?? 0) || 0;

    let nextLevel = currentLevel;
    const nextExp = currentExp + gainedExp;
    let levelsGained = 0;

    while (nextExp >= getRequiredExpForNextLevel(nextLevel)) {
      nextLevel += 1;
      levelsGained += 1;
    }

    let itemName: string | null = null;
    if (droppedItemId) {
      try {
        const item = this.contentService.resolveItemById(droppedItemId);
        itemName = item.name ?? null;
      } catch {
        itemName = null;
      }
      if (itemName) {
        await this.updateRuntimeInventoryItemQuantity(characterId, droppedItemId, 1);
      }
    }

    const updated = await this.runtimeStore.updateCharacter(characterId, {
      exp: nextExp,
      level: nextLevel,
      freePoints: currentFreePoints + levelsGained * 5,
      gold: currentGold + gainedGold,
    });

    if (!updated) {
      throw new NotFoundException('Character not found.');
    }

    const hubState = await this.arenaService.getHubState(characterId);
    return {
      progression: { gainedExp, levelsGained },
      gainedGold,
      itemName,
      hubState,
    };
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
    const activeStats = this.contentService.getStatsWithEquipment(baseStats, equipment);
    const weaponProfile = this.resolveWeaponCombatProfile(equipment);

    return this.toCombatEntityFromStats({
      id: character.id,
      name: character.name,
      race: character.race as Race,
      team,
      position,
      stats: activeStats,
      combatStyleHint: weaponProfile.combatStyleHint,
      attackRange: weaponProfile.attackRange,
      pierceTargets: weaponProfile.pierceTargets,
      splashRadius: weaponProfile.splashRadius,
      splashCenterMultiplier: weaponProfile.splashCenterMultiplier,
      splashOuterMultiplier: weaponProfile.splashOuterMultiplier,
    });
  }

  private resolveWeaponCombatProfile(equipment: Equipment): WeaponCombatProfile {
    if (!equipment.weapon) {
      return { combatStyleHint: 'MELEE' };
    }

    const weaponId = String(equipment.weapon ?? '').trim();
    const adminWeapon = this.contentService.listCollection('items').find((item) => item.id === weaponId) ?? null;
    if (adminWeapon) {
      const isMagicWeapon = Boolean(adminWeapon.magicSchool) || adminWeapon.damageCategory === 'magic';
      const hasRange = typeof adminWeapon.attackRange === 'number' && adminWeapon.attackRange > 1;

      const combatStyleHint: CombatStyleHint = isMagicWeapon
        ? 'MAGIC'
        : hasRange
          ? 'RANGED'
          : 'MELEE';

      return {
        combatStyleHint,
        attackRange: adminWeapon.attackRange,
        pierceTargets: adminWeapon.pierceTargets,
        splashRadius: adminWeapon.splashRadius,
        splashCenterMultiplier: adminWeapon.splashCenterMultiplier,
        splashOuterMultiplier: adminWeapon.splashOuterMultiplier,
      };
    }

    try {
      const weapon = this.contentService.resolveItemById(equipment.weapon);
      const subtype = String(weapon.itemSubType ?? '').toLowerCase();

      if (subtype.includes('bow') || subtype.includes('crossbow') || subtype.includes('sling') || subtype.includes('throw')) {
        return { combatStyleHint: 'RANGED' };
      }

      if (subtype.includes('staff') || subtype.includes('wand') || subtype.includes('tome') || subtype.includes('orb')) {
        return { combatStyleHint: 'MAGIC' };
      }
    } catch {
      return { combatStyleHint: 'MELEE' };
    }

    return { combatStyleHint: 'MELEE' };
  }

  private normalizeEquipment(equipment?: CombatEquipmentPayload): Equipment {
    return this.contentService.normalizeEquipment(equipment);
  }

  private toCombatEntityFromStats(params: {
    id: string;
    name: string;
    race: Race;
    team: TeamSide;
    position: number;
    stats: StatBlock;
    avatarUrl?: string;
    combatStyleHint?: CombatStyleHint;
    attackRange?: number;
    pierceTargets?: number;
    splashRadius?: number;
    splashCenterMultiplier?: number;
    splashOuterMultiplier?: number;
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
      avatarUrl: params.avatarUrl,
      combatStyleHint: params.combatStyleHint,
      attackRange: params.attackRange,
      pierceTargets: params.pierceTargets,
      splashRadius: params.splashRadius,
      splashCenterMultiplier: params.splashCenterMultiplier,
      splashOuterMultiplier: params.splashOuterMultiplier,
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
    const activeStats = this.contentService.getStatsWithEquipment(template.stats, equipment);
    const weaponProfile = this.resolveWeaponCombatProfile(equipment);

    return this.toCombatEntityFromStats({
      id: `npc-${randomUUID()}`,
      name: template.name,
      race: template.race,
      team: TeamSide.Right,
      position,
      stats: activeStats,
      avatarUrl: template.avatarUrl,
      combatStyleHint: weaponProfile.combatStyleHint,
      attackRange: weaponProfile.attackRange,
      pierceTargets: weaponProfile.pierceTargets,
      splashRadius: weaponProfile.splashRadius,
      splashCenterMultiplier: weaponProfile.splashCenterMultiplier,
      splashOuterMultiplier: weaponProfile.splashOuterMultiplier,
    });
  }

  private cellKey(x: number, y: number): string {
    return `${x}:${y}`;
  }

  private mapCellTypeToTileType(type: string): BattlefieldTileType {
    switch (type) {
      case 'blocked':
        return BattlefieldTileType.Blocked;
      case 'lowCover':
        return BattlefieldTileType.LowCover;
      case 'highCover':
        return BattlefieldTileType.HighCover;
      case 'trap':
        return BattlefieldTileType.Hazard;
      default:
        return BattlefieldTileType.Empty;
    }
  }

  private isMovementBlocked(tile: BattlefieldTile | undefined): boolean {
    if (!tile) {
      return false;
    }
    if (tile.blocksMovement !== undefined) {
      return tile.blocksMovement;
    }
    return tile.type === BattlefieldTileType.Blocked || tile.type === BattlefieldTileType.HighCover || tile.type === BattlefieldTileType.Summon;
  }

  private buildBattlefieldTiles(
    battleMap?: RuntimeBattleMapDto,
    blockedTiles: Array<{ x: number; y: number }> = [],
  ): BattlefieldTile[] {
    const width = Math.max(1, battleMap?.width ?? BATTLEFIELD_GRID_SIZE);
    const height = Math.max(1, battleMap?.height ?? BATTLEFIELD_GRID_SIZE);
    const tileByKey = new Map<string, BattlefieldTile>();

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        tileByKey.set(this.cellKey(x, y), {
          x,
          y,
          type: BattlefieldTileType.Empty,
          blocksMovement: false,
          blocksLineOfSight: false,
        });
      }
    }

    if (battleMap) {
      for (const cell of battleMap.cells) {
        const key = this.cellKey(cell.x, cell.y);
        const current = tileByKey.get(key);
        if (!current) {
          continue;
        }
        tileByKey.set(key, {
          ...current,
          type: this.mapCellTypeToTileType(cell.type),
          movementCost: cell.movementCost,
          trapId: cell.trapId,
          blocksMovement: cell.blocksMovement ?? (cell.type === 'blocked' || cell.type === 'highCover'),
          blocksLineOfSight: cell.blocksLineOfSight ?? (cell.type === 'blocked' || cell.type === 'highCover'),
        });
      }

      for (const object of battleMap.objects ?? []) {
        const objectWidth = Math.max(1, object.width ?? 1);
        const objectHeight = Math.max(1, object.height ?? 1);
        for (let offsetY = 0; offsetY < objectHeight; offsetY += 1) {
          for (let offsetX = 0; offsetX < objectWidth; offsetX += 1) {
            const x = object.x + offsetX;
            const y = object.y + offsetY;
            const key = this.cellKey(x, y);
            const current = tileByKey.get(key);
            if (!current) {
              continue;
            }
            tileByKey.set(key, {
              ...current,
              type: object.blocksLineOfSight ? BattlefieldTileType.HighCover : object.blocksMovement ? BattlefieldTileType.Blocked : current.type,
              blocksMovement: object.blocksMovement ?? current.blocksMovement,
              blocksLineOfSight: object.blocksLineOfSight ?? current.blocksLineOfSight,
            });
          }
        }
      }
    } else {
      for (const blockedTile of blockedTiles) {
        const key = this.cellKey(blockedTile.x, blockedTile.y);
        const current = tileByKey.get(key);
        if (!current) {
          continue;
        }
        tileByKey.set(key, {
          ...current,
          type: BattlefieldTileType.Blocked,
          blocksMovement: true,
          blocksLineOfSight: true,
        });
      }
    }

    return [...tileByKey.values()];
  }

  private buildBattlefieldTraps(battleMap?: RuntimeBattleMapDto): BattlefieldTrapState[] {
    return (battleMap?.traps ?? []).map((trap) => ({
      id: trap.id,
      name: trap.name,
      x: trap.x,
      y: trap.y,
      damage: trap.damage,
      staminaCost: trap.staminaCost,
      triggerOnce: trap.triggerOnce,
      isActive: true,
    }));
  }

  private shuffleCells(cells: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    const next = [...cells];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex]!, next[index]!];
    }
    return next;
  }

  private findNearestValidCell(
    seeds: Array<{ x: number; y: number }>,
    width: number,
    height: number,
    tileByKey: Map<string, BattlefieldTile>,
    occupied: Set<string>,
  ): { x: number; y: number } | null {
    const visited = new Set<string>();
    const queue = this.shuffleCells(seeds)
      .filter((cell) => cell.x >= 0 && cell.x < width && cell.y >= 0 && cell.y < height)
      .map((cell) => ({ ...cell }));

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = this.cellKey(current.x, current.y);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      const tile = tileByKey.get(key);
      if (!occupied.has(key) && !this.isMovementBlocked(tile)) {
        return current;
      }

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nextX = current.x + dx;
        const nextY = current.y + dy;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
          continue;
        }
        queue.push({ x: nextX, y: nextY });
      }
    }

    return null;
  }

  private assignSpawnPositions(
    entities: ReturnType<typeof createArenaCombatEntity>[],
    battleMap: RuntimeBattleMapDto | undefined,
    battlefieldTiles: BattlefieldTile[],
  ): void {
    const width = Math.max(1, battleMap?.width ?? BATTLEFIELD_GRID_SIZE);
    const height = Math.max(1, battleMap?.height ?? BATTLEFIELD_GRID_SIZE);
    const tileByKey = new Map(battlefieldTiles.map((tile) => [this.cellKey(tile.x, tile.y), tile]));
    const occupied = new Set<string>();

    const distributedRows = (count: number) => Array.from({ length: count }, (_, index) =>
      Math.max(0, Math.min(height - 1, Math.round(((index + 1) * (height - 1)) / (count + 1)))));

    const fallbackSeedsByTeam = (team: TeamSide, count: number) => {
      const rows = distributedRows(count);
      const column = team === TeamSide.Left ? Math.min(1, width - 1) : Math.max(0, width - 2);
      return rows.map((row) => ({ x: column, y: row }));
    };

    const playerSeeds = battleMap?.spawnZones.filter((zone) => zone.type === 'player').flatMap((zone) => zone.cells) ?? [];
    const enemySeeds = battleMap?.spawnZones.filter((zone) => zone.type === 'enemy').flatMap((zone) => zone.cells) ?? [];

    const leftTeam = entities.filter((entity) => entity.team === TeamSide.Left && entity.isAlive).sort((left, right) => left.position - right.position);
    const rightTeam = entities.filter((entity) => entity.team === TeamSide.Right && entity.isAlive).sort((left, right) => left.position - right.position);

    for (const [teamEntities, seeds, team] of [
      [leftTeam, playerSeeds, TeamSide.Left],
      [rightTeam, enemySeeds, TeamSide.Right],
    ] as const) {
      for (const entity of teamEntities) {
        const candidate = this.findNearestValidCell(
          seeds.length > 0 ? seeds : fallbackSeedsByTeam(team, teamEntities.length),
          width,
          height,
          tileByKey,
          occupied,
        );
        if (!candidate) {
          continue;
        }
        entity.battlefieldX = candidate.x;
        entity.battlefieldY = candidate.y;
        occupied.add(this.cellKey(candidate.x, candidate.y));
      }
    }
  }

  private getBattlefieldCellDistance(
    left: { battlefieldX?: number; battlefieldY?: number },
    right: { battlefieldX?: number; battlefieldY?: number },
  ): number {
    const leftX = left.battlefieldX ?? 0;
    const leftY = left.battlefieldY ?? 0;
    const rightX = right.battlefieldX ?? 0;
    const rightY = right.battlefieldY ?? 0;
    return Math.abs(leftX - rightX) + Math.abs(leftY - rightY);
  }

  private async loadCharacterForCombat(characterId: string): Promise<CharacterRecord> {
    if (isFileStorageMode()) {
      const character = await this.runtimeStore.getCharacterById(characterId);
      if (!character) {
        throw new NotFoundException('Character not found.');
      }

      return {
        id: character.id,
        name: String(character.name ?? ''),
        race: String(character.race ?? 'HUMAN'),
        hpBase: Number(character.hpBase ?? 0),
        mpBase: Number(character.mpBase ?? 0),
        staminaBase: Number(character.staminaBase ?? 0),
        strength: Number(character.strength ?? 0),
        endurance: Number(character.endurance ?? 0),
        dexterity: Number(character.dexterity ?? 0),
        intelligence: Number(character.intelligence ?? 0),
        luck: Number(character.luck ?? 0),
        speed: Number(character.speed ?? 0),
        willpower: Number(character.willpower ?? 0),
        equipment: (character.equipment ?? null) as Partial<Equipment> | null,
      };
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { equipment: true },
    });

    if (!character) {
      throw new NotFoundException('Character not found.');
    }

    return character as unknown as CharacterRecord;
  }

  async startCombat(
    characterId: string,
    enemyCount = 1,
    customEnemies: CustomCombatNpcDto[] = [],
    battleMap?: RuntimeBattleMapDto,
    blockedTiles: Array<{ x: number; y: number }> = [],
  ) {
    const character = await this.loadCharacterForCombat(characterId);

    const player = this.toCombatEntity(character, TeamSide.Left, 1);
    const resourceState = await this.arenaService.getCharacterResources(characterId);
    player.currentHp = resourceState.currentHp;
    player.currentMp = resourceState.currentMp;
    player.currentStamina = resourceState.currentStamina;
    player.maxHp = resourceState.maxHp;
    player.maxMp = resourceState.maxMp;
    player.maxStamina = resourceState.maxStamina;
    (player as { hpRegenPerTurn?: number }).hpRegenPerTurn = resourceState.hpRegenPerTurn;
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

    const normalizedCustomEnemies = customEnemies
      .filter((enemy) => enemy.name.trim().length > 0)
      .slice(0, MAX_COMBAT_ENEMIES);
    const count = normalizedCustomEnemies.length > 0
      ? normalizedCustomEnemies.length
      : Math.max(1, Math.min(MAX_COMBAT_ENEMIES, enemyCount));

    const enemies = normalizedCustomEnemies.length > 0
      ? normalizedCustomEnemies.map((enemy, index) => this.createCustomEnemy(enemy, 3 + index))
      : Array.from({ length: count }, (_, index) => this.createGeneratedEnemy(playerStats, character.race as Race, 3 + index, index, count));

    const battlefieldTiles = this.buildBattlefieldTiles(battleMap, blockedTiles);
    this.assignSpawnPositions([player, ...enemies], battleMap, battlefieldTiles);

    const combatId = randomUUID();
    const state = createInitialBattleState({
      combatId,
      battleMapId: battleMap?.id,
      battleMapWidth: battleMap?.width ?? BATTLEFIELD_GRID_SIZE,
      battleMapHeight: battleMap?.height ?? BATTLEFIELD_GRID_SIZE,
      viewportWidth: battleMap?.viewportWidth ?? BATTLEFIELD_GRID_SIZE,
      viewportHeight: battleMap?.viewportHeight ?? BATTLEFIELD_GRID_SIZE,
      distance: DistanceBand.Melee,
      entities: [player, ...enemies],
      battlefieldTiles,
      battlefieldTraps: this.buildBattlefieldTraps(battleMap),
    });
    state.turnDeadlineAt = Date.now() + DEFAULT_TURN_SECONDS * 1000;

    this.sessions.set(combatId, {
      state,
      playerId: player.id,
      activeEffects: [],
      enemyTempoBreaks: [],
      damageContribution: 0,
      skillCooldowns: [],
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

  async useCombatItem(payload: { combatId: string; actorId: string; itemId: string; targetId?: string }) {
    const session = this.sessions.get(payload.combatId);
    if (!session) {
      throw new NotFoundException('Combat not found.');
    }

    if (payload.actorId !== session.playerId) {
      throw new BadRequestException('Only the player can use combat items.');
    }

    const item = this.contentService.resolveItemById(payload.itemId);
    const rawItem = this.contentService.getCollectionEntry('items', payload.itemId) as Record<string, unknown> | null;
    const costs = this.normalizeResourceCosts(rawItem);
    const effects = this.normalizeItemEffects(item, rawItem);
    const actionSlots = await this.arenaService.getOrCreateActionSlots(payload.actorId);
    if (!actionSlots.some((slot) => slot.kind === 'item' && slot.refId === payload.itemId)) {
      throw new BadRequestException('Item is not assigned to an action slot.');
    }
    if (effects.length === 0) {
      throw new BadRequestException('Item has no usable combat effects configured.');
    }

    const actor = session.state.entities.find((entity) => entity.id === payload.actorId);
    if (!actor || !actor.isAlive) {
      throw new BadRequestException('Actor cannot use items now.');
    }

    const inventoryEntry = isFileStorageMode()
      ? (await this.readRuntimeInventoryItems(payload.actorId)).find((entry) => entry.itemId === payload.itemId) ?? null
      : await this.prisma.characterInventoryItem.findUnique({
        where: { characterId_itemId: { characterId: payload.actorId, itemId: payload.itemId } },
      });

    if (!inventoryEntry || inventoryEntry.quantity <= 0) {
      throw new BadRequestException('Item is not available in inventory.');
    }

    for (const effect of effects) {
      this.resolveItemEffectTarget(effect, actor, session.state, payload.targetId);
    }

    this.ensureSufficientResources(actor, costs);
    this.spendEntityResources(actor, costs);
    console.info('[combatItems] use', {
      itemId: payload.itemId,
      actorId: payload.actorId,
      targetId: payload.targetId,
      costs,
    });

    const effectLogs = effects.flatMap((effect) => this.applyItemEffect(effect, actor, session.state, session.state.roundNumber, payload.targetId));

    if (isFileStorageMode()) {
      await this.updateRuntimeInventoryItemQuantity(payload.actorId, payload.itemId, -1);
    } else if (inventoryEntry.quantity === 1) {
      await this.prisma.characterInventoryItem.delete({ where: { id: inventoryEntry.id } });
    } else {
      await this.prisma.characterInventoryItem.update({
        where: { id: inventoryEntry.id },
        data: { quantity: inventoryEntry.quantity - 1 },
      });
    }

    let nextActionSlots = actionSlots;
    if (inventoryEntry.quantity === 1) {
      const clearedSlots = actionSlots
        .filter((slot) => slot.kind === 'item' && slot.refId === payload.itemId)
        .map((slot) => ({ slotIndex: slot.slotIndex, kind: null, refId: null, itemInstanceId: null }));
      if (clearedSlots.length > 0) {
        nextActionSlots = await this.arenaService.updateActionSlots(payload.actorId, clearedSlots);
      }
    }

    await this.arenaService.updateCharacterResources(payload.actorId, {
      currentHp: actor.currentHp,
      currentMp: actor.currentMp,
      currentStamina: actor.currentStamina,
    });

    const latestInventory = isFileStorageMode()
      ? (await this.readRuntimeInventoryItems(payload.actorId))
        .map((row) => ({ itemId: row.itemId, quantity: row.quantity }))
        .sort((a, b) => a.itemId.localeCompare(b.itemId))
      : await this.prisma.characterInventoryItem.findMany({
        where: { characterId: payload.actorId },
        select: { itemId: true, quantity: true },
        orderBy: { itemId: 'asc' },
      });

    const characterGold = isFileStorageMode()
      ? Number(((await this.runtimeStore.getCharacterById(payload.actorId)) as { gold?: unknown } | null | undefined)?.gold ?? 0) || 0
      : (await this.prisma.character.findUnique({
        where: { id: payload.actorId },
        select: { gold: true },
      }))?.gold ?? 0;

    const costText = this.describeResourceCosts(costs);
    const infoLog = {
      round: session.state.roundNumber,
      actorId: actor.id,
      type: 'INFO' as const,
      text: `${actor.name} uses ${item.name}${costText ? ` (${costText})` : ''}`,
    };
    session.state.logs.push(infoLog, ...effectLogs);
    session.state.lastRound?.logs.push(infoLog, ...effectLogs);

    return {
      state: session.state,
      inventory: latestInventory,
      gold: characterGold,
      actionSlots: nextActionSlots,
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
      movementType?: MovementType;
      preferredDistance?: DistanceBand;
      destinationX?: number;
      destinationY?: number;
      skillId?: string;
      skillLevel?: number;
    },
  ): Promise<CombatActionResult> {
    const session = this.sessions.get(combatId);
    if (!session) {
      throw new NotFoundException('Combat not found.');
    }

    const { state, playerId } = session;
    if (state.isFinished) {
      return { state };
    }

    if (playerAction.actorId !== playerId) {
      throw new BadRequestException('Only player actor can submit action.');
    }

    const playerEntity = state.entities.find((item) => item.id === playerId);
    if (!playerEntity || !playerEntity.isAlive) {
      throw new BadRequestException('Player cannot act.');
    }

    const now = Date.now();
    const isTimedOut = typeof state.turnDeadlineAt === 'number'
      && Number.isFinite(state.turnDeadlineAt)
      && now > state.turnDeadlineAt;
    const effectiveAction = isTimedOut
      ? (() => {
        const fallbackTarget = state.entities.find((item) => item.team !== TeamSide.Left && item.isAlive)?.id ?? playerAction.targetId;
        return {
          actorId: playerId,
          targetId: fallbackTarget,
          attackZone: TargetZone.Chest,
          defenseZones: [TargetZone.Chest, TargetZone.Abdomen],
          attackPointsSpent: 0,
          defensePointsSpent: 0,
          actionType: ActionType.Wait,
          movementType: undefined,
          preferredDistance: undefined,
          destinationX: undefined,
          destinationY: undefined,
          skillId: undefined,
          skillLevel: undefined,
        };
      })()
      : playerAction;

    const requestedTotalSpent = Math.max(0, effectiveAction.attackPointsSpent) + Math.max(0, effectiveAction.defensePointsSpent);
    if (requestedTotalSpent > playerEntity.currentStamina) {
      throw new BadRequestException('Not enough stamina for selected action points.');
    }

    const hasRage = session.activeEffects.some((item) => item.type === CombatSkillType.Rage && item.remainingRounds > 0);
    const hasCrushing = session.activeEffects.some(
      (item) => item.type === CombatSkillType.CrushingBlock && item.remainingRounds > 0,
    );

    const skillLogs: string[] = [];

    // ── New skill system: AdminSkillDefinition + skillId ──────────────────────
    if (effectiveAction.skillId && effectiveAction.actionType === ActionType.Attack) {
      const targetEntity = state.entities.find((e) => e.id === effectiveAction.targetId) ?? null;
      const result = await this.skillRuntime.executeSkill(
        session.playerId,
        effectiveAction.skillId,
        effectiveAction.skillLevel ?? 1,
        session.skillCooldowns,
        playerEntity,
        targetEntity,
      );

      // Apply resource costs to entity
      if (result.resourcesSpent.mp) {
        playerEntity.currentMp = Math.max(0, playerEntity.currentMp - result.resourcesSpent.mp);
      }
      if (result.resourcesSpent.stamina) {
        playerEntity.currentStamina = Math.max(0, playerEntity.currentStamina - result.resourcesSpent.stamina);
      }
      if (result.resourcesSpent.hp) {
        playerEntity.currentHp = Math.max(0, playerEntity.currentHp - result.resourcesSpent.hp);
      }

      // Apply damage
      for (const dmg of result.damageDone) {
        const dmgTarget = state.entities.find((e) => e.id === dmg.targetId);
        if (dmgTarget) {
          dmgTarget.currentHp = Math.max(0, dmgTarget.currentHp - dmg.amount);
          dmgTarget.isAlive = dmgTarget.currentHp > 0;
        }
      }

      // Apply healing
      for (const heal of result.healingDone) {
        const healTarget = state.entities.find((e) => e.id === heal.targetId);
        if (healTarget) {
          healTarget.currentHp = Math.min(healTarget.maxHp, healTarget.currentHp + heal.amount);
        }
      }

      skillLogs.push(...result.logs);

      // Track cooldown
      if (result.cooldownStarted > 0) {
        const existing = session.skillCooldowns.find((c) => c.skillId === effectiveAction.skillId);
        if (existing) {
          existing.remainingRounds = result.cooldownStarted;
        } else {
          session.skillCooldowns.push({
            skillId: effectiveAction.skillId,
            remainingRounds: result.cooldownStarted,
            oncePerCombat: result.oncePerCombat,
          });
        }
      }
    }

    const crushingActiveNow = hasCrushing;
    const rageActiveNow = hasRage;
    const normalizedPoints = this.normalizePlayerActionPoints(effectiveAction, playerEntity.currentStamina);

    const buffedPlayerAction: ArenaCombatAction = {
      actorId: effectiveAction.actorId,
      targetId: effectiveAction.targetId,
      attackZone: effectiveAction.attackZone,
      defenseZones: effectiveAction.defenseZones,
      attackPointsSpent: normalizedPoints.attackPointsSpent,
      defensePointsSpent: crushingActiveNow
        ? Math.max(0, Math.ceil(normalizedPoints.defensePointsSpent * 1.4))
        : normalizedPoints.defensePointsSpent,
      actionType: effectiveAction.actionType,
      movementType: effectiveAction.movementType,
      preferredDistance: effectiveAction.preferredDistance,
      destinationX: effectiveAction.destinationX,
      destinationY: effectiveAction.destinationY,
    };

    const originalStrength = playerEntity.strength;
    const originalConstitution = playerEntity.constitution;

    if (rageActiveNow) {
      playerEntity.strength = Math.max(1, playerEntity.strength + 15);
      playerEntity.constitution = Math.max(1, playerEntity.constitution - 10);
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

    if (!nextState.isFinished) {
      nextState.turnDeadlineAt = Date.now() + DEFAULT_TURN_SECONDS * 1000;
    }

    const selectedTarget = nextState.entities.find((item) => item.id === effectiveAction.targetId);
    const playerInNextState = nextState.entities.find((item) => item.id === playerEntity.id);
    const roundLogs = nextState.lastRound?.logs ?? [];
    const playerHitTargetThisRound = roundLogs.some(
      (entry) => entry.type === 'HIT' && entry.actorId === playerEntity.id && entry.targetId === effectiveAction.targetId,
    );
    if (isTimedOut) {
      const timeoutLog = {
        round: nextState.roundNumber,
        actorId: playerId,
        type: 'INFO' as const,
        text: `${playerEntity.name} timed out and waits`,
      };
      nextState.logs.push(timeoutLog);
      nextState.lastRound?.logs.push(timeoutLog);
    }

    const isAdjacentToTarget = Boolean(
      playerInNextState
      && selectedTarget
      && this.getBattlefieldCellDistance(playerInNextState, selectedTarget) <= 1,
    );

    this.applyEndOfRoundRegeneration(nextState);
    this.refreshBattleResult(nextState);

    playerEntity.strength = originalStrength;
    playerEntity.constitution = originalConstitution;

    for (const effect of session.activeEffects) {
      effect.remainingRounds -= 1;
    }
    session.activeEffects = session.activeEffects.filter((item) => item.remainingRounds > 0);

    // Decrement skill cooldowns
    for (const cd of session.skillCooldowns) {
      if (!cd.oncePerCombat) {
        cd.remainingRounds -= 1;
      }
    }
    session.skillCooldowns = session.skillCooldowns.filter((cd) => cd.remainingRounds > 0 || cd.oncePerCombat);

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

    const roundDamage = roundLogs
      .filter((entry) => entry.type === 'HIT' && entry.actorId === playerId)
      .reduce((sum, entry) => sum + Math.max(0, entry.amount ?? 0), 0);
    session.damageContribution += roundDamage;

    let finishedHubState: Awaited<ReturnType<ArenaService['getHubState']>> | undefined;
    let victoryRewards: Awaited<ReturnType<CombatService['applyVictoryRewards']>> | undefined;

    if (nextState.isFinished && nextState.winner === TeamSide.Left) {
      victoryRewards = await this.applyVictoryRewards(playerId, nextState, session.damageContribution);
      const rewards = victoryRewards;
      if (rewards.progression.gainedExp > 0) {
        const expLog = {
          round: nextState.roundNumber,
          actorId: playerId,
          type: 'INFO' as const,
          text: `Battle reward: +${rewards.progression.gainedExp} EXP`,
        };
        nextState.logs.push(expLog);
        if (nextState.lastRound) {
          nextState.lastRound.logs.push(expLog);
        }
      }

      if (rewards.progression.levelsGained > 0) {
        const levelLog = {
          round: nextState.roundNumber,
          actorId: playerId,
          type: 'INFO' as const,
          text: `${playerEntity.name} levels up! +${rewards.progression.levelsGained * 5} free stat points`,
        };
        nextState.logs.push(levelLog);
        if (nextState.lastRound) {
          nextState.lastRound.logs.push(levelLog);
        }
      }

      if (rewards.gainedGold > 0) {
        const goldLog = {
          round: nextState.roundNumber,
          actorId: playerId,
          type: 'INFO' as const,
          text: `Battle reward: +${rewards.gainedGold} gold`,
        };
        nextState.logs.push(goldLog);
        if (nextState.lastRound) {
          nextState.lastRound.logs.push(goldLog);
        }
      }

      if (rewards.itemName) {
        const lootLog = {
          round: nextState.roundNumber,
          actorId: playerId,
          type: 'INFO' as const,
          text: `Battle reward: loot ${rewards.itemName}`,
        };
        nextState.logs.push(lootLog);
        if (nextState.lastRound) {
          nextState.lastRound.logs.push(lootLog);
        }
      }
    }

    if (nextState.isFinished && !playerEntity.isAlive) {
      session.damageContribution = 0;
      playerEntity.currentHp = playerEntity.maxHp;
      playerEntity.currentMp = playerEntity.maxMp;
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

    const persistedPlayer = nextState.entities.find((entity) => entity.id === playerId);
    if (persistedPlayer) {
      await this.arenaService.updateCharacterResources(playerId, {
        currentHp: persistedPlayer.currentHp,
        currentMp: persistedPlayer.currentMp,
        currentStamina: persistedPlayer.currentStamina,
      });
    }

    if (victoryRewards) {
      finishedHubState = await this.arenaService.getHubState(playerId);
    }

    return {
      state: nextState,
      hubState: finishedHubState,
    };
  }
}
