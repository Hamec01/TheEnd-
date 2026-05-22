import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ActionType,
  BATTLEFIELD_GRID_SIZE,
  BattlefieldTrapState,
  BattlefieldTileType,
  CombatSkillType,
  DistanceBand,
  DEFAULT_MAX_AP_PER_ROUND,
  DEFAULT_MAX_COMMANDS_PER_ROUND,
  HARD_MAX_AP_PER_ROUND,
  HARD_MAX_COMMANDS_PER_ROUND,
  MovementType,
  TargetZone,
  TeamSide,
  canAppendCombatCommand,
  calculateCommandInitiative,
  createArenaCombatEntity,
  createCombatCommandFromType,
  createInitialBattleState,
  createNpcAction,
  collectAreaEffectTargets,
  getBattlefieldDistance,
  getReachableBattlefieldTiles,
  getRelationToCaster,
  buildCombatLogMessage,
  normalizeArenaBattleState,
  normalizeCombatCommand,
  revalidateCombatCommandBeforeExecute,
  getRequiredExpForNextLevel,
  resolveRound,
  validateCombatTurnPlan,
  applyGuardMitigation,
  calculateGuardEndRoundRegen,
  createGuardState,
  markGuardBroken,
  COMBAT_ACTION_COSTS,
  clampHitChance,
  buildStatusResistanceImmunityProfile,
  tryApplyCombatStatus,
  collectPeriodicStatusDamage,
  tickCombatStatusDurationsEndOfRound,
  getAttackerHitChanceDeltaFromStatuses,
  syncControlFlagsFromActiveStatuses,
  effectNumericPercent,
  type TryApplyCombatStatusResult,
  type ArenaBattleState,
  type ArenaCombatAction,
  type ArenaCombatEntity,
  type CombatActorLifeState,
  type CombatLootContainer,
  type CombatGuardState,
  type CombatCommand,
  type CombatEvent,
  type LootItem,
  type CombatAnimationEvent,
  type CombatCommandRevalidationResult,
  type CombatRevalidationFailReason,
  type CombatRoundResolveSnapshot,
  type CombatBattlePhase,
  type CombatPlanErrorCode,
  type CombatPlanWarning,
  type CombatPlanValidationResult,
  type CombatPlanWarningCode,
  type CombatResolveErrorCode,
  type CombatRoundLimits,
  type CombatTurnPlan,
  type ArenaCombatEquipmentModifiers,
  type BattlefieldTile,
  type Equipment,
  type ExitZone,
  type Race,
  type StatBlock,
} from '@theend/rpg-domain';
import { randomUUID } from 'crypto';
import { ArenaService } from '../arena/arena.service';
import { ContentService } from '../content/content.service';
import { PrismaService } from '../prisma/prisma.service';
import { SkillRuntimeService, type SkillCooldownEntry } from '../skills/skill-runtime.service';
import { MAX_COMBAT_ENEMIES, type CustomCombatNpcDto, type RuntimeBattleMapDto } from './dto.start-combat.dto';
import type { AdminItem, ItemEffect } from '../content/content.types';
import { resolveCharacterEquipmentModifiers } from '../content/item-effects.resolver';
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

type GuardMode = 'guard' | 'strong_guard';

interface CombatSession {
  state: ArenaBattleState;
  playerId: string;
  plannedActions: Map<string, ArenaCombatAction>;
  turnPlans: Map<string, CombatTurnPlan>;
  activeEffects: Array<{ type: CombatSkillType.CrushingBlock | CombatSkillType.Rage; remainingRounds: number }>;
  enemyTempoBreaks: Array<{ targetId: string; remainingRounds: number }>;
  damageContribution: number;
  skillCooldowns: SkillCooldownEntry[];
  guardStates: Map<string, CombatGuardState>;
  /** Снимок экипировки по id сущности (для прок-эффектов и сетов). */
  equipmentByActorId: Map<string, Equipment>;
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
const DEFAULT_ROUND_DURATION_SECONDS = DEFAULT_TURN_SECONDS;
const ACTIVE_TURN_DURATION_SECONDS = 30;
const MAX_AUTOMATED_TURN_LOOPS = 24;
const ARENA_GOLD_PER_DEFEATED_ENEMY = 50;
const PVP_LOOT_CONFIG = {
  maxDroppedItems: 2,
  itemDropChance: 0.15,
  pvpGoldDropEnabled: false,
} as const;

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
      .flatMap((entry) => {
        const type = String(entry.type ?? '').trim().toLowerCase();
        const target = typeof entry.target === 'string' ? entry.target : undefined;

        // Content skill-like effects: { type:'stat_bonus', stat:'hp', flat:50, trigger:'on_use' }
        if (type === 'stat_bonus') {
          const stat = String(entry.stat ?? '').trim().toLowerCase();
          const flat = this.toFiniteAmount(entry.flat ?? entry.amount);
          if (flat <= 0) return [];
          if (stat === 'hp' || stat === 'health') return [{ type: 'heal_hp', amount: flat, target }];
          if (stat === 'mp' || stat === 'mana') return [{ type: 'restore_mana', amount: flat, target }];
          if (stat === 'stamina' || stat === 'sta') return [{ type: 'restore_stamina', amount: flat, target }];
          return [];
        }

        // Alternative naming conventions.
        if (type === 'restore_resource' || type === 'restoreResource' || type === 'restore') {
          const resource = String(entry.resource ?? entry.stat ?? '').trim().toLowerCase();
          const amount = this.toFiniteAmount(entry.amount ?? entry.flat);
          if (amount <= 0) return [];
          if (resource === 'hp' || resource === 'health') return [{ type: 'heal_hp', amount, target }];
          if (resource === 'mp' || resource === 'mana') return [{ type: 'restore_mana', amount, target }];
          if (resource === 'stamina' || resource === 'sta') return [{ type: 'restore_stamina', amount, target }];
          return [];
        }

        return [{
          type,
          amount: this.toFiniteAmount(entry.amount),
          statusId: typeof entry.statusId === 'string' ? entry.statusId : undefined,
          target,
        }];
      })
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

  private async consumeCombatItemCharge(actorId: string, itemId: string): Promise<void> {
    const normalizedItemId = String(itemId ?? '').trim();
    if (!normalizedItemId) {
      return;
    }

    const actionSlots = await this.arenaService.getOrCreateActionSlots(actorId);
    const physicalSlotIds = new Set(await this.arenaService.getPhysicalItemActionSlotIds(actorId));
    const hasPhysicalSlotCopy = actionSlots.some(
      (slot) => slot.kind === 'item' && slot.refId === normalizedItemId && physicalSlotIds.has(slot.slotId),
    );

    if (hasPhysicalSlotCopy) {
      await this.arenaService.consumePhysicalItemActionSlot(actorId, normalizedItemId);
      return;
    }

    if (isFileStorageMode()) {
      const inventoryEntry = (await this.readRuntimeInventoryItems(actorId)).find((entry) => entry.itemId === normalizedItemId) ?? null;
      if (!inventoryEntry || inventoryEntry.quantity <= 0) {
        return;
      }

      await this.updateRuntimeInventoryItemQuantity(actorId, normalizedItemId, -1);
      if (inventoryEntry.quantity === 1) {
        const clearedSlots = actionSlots
          .filter((slot) => slot.kind === 'item' && slot.refId === normalizedItemId)
          .map((slot) => ({ slotIndex: slot.slotIndex, kind: null, refId: null, itemInstanceId: null }));
        if (clearedSlots.length > 0) {
          await this.arenaService.updateActionSlots(actorId, clearedSlots);
        }
      }
      return;
    }

    const inventoryEntry = await this.prisma.characterInventoryItem.findUnique({
      where: { characterId_itemId: { characterId: actorId, itemId: normalizedItemId } },
    });
    if (!inventoryEntry || inventoryEntry.quantity <= 0) {
      return;
    }

    if (inventoryEntry.quantity === 1) {
      await this.prisma.characterInventoryItem.delete({ where: { id: inventoryEntry.id } });
      const clearedSlots = actionSlots
        .filter((slot) => slot.kind === 'item' && slot.refId === normalizedItemId)
        .map((slot) => ({ slotIndex: slot.slotIndex, kind: null, refId: null, itemInstanceId: null }));
      if (clearedSlots.length > 0) {
        await this.arenaService.updateActionSlots(actorId, clearedSlots);
      }
      return;
    }

    await this.prisma.characterInventoryItem.update({
      where: { id: inventoryEntry.id },
      data: { quantity: inventoryEntry.quantity - 1 },
    });
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
      state.phase = 'finished';
      state.winner = undefined;
      return;
    }
    if (!leftAlive) {
      state.isFinished = true;
      state.phase = 'finished';
      state.winner = TeamSide.Right;
      return;
    }
    if (!rightAlive) {
      state.isFinished = true;
      state.phase = 'finished';
      state.winner = TeamSide.Left;
    }
  }

  private getCombatRoundLimitsForActor(actor: { combatStyleHint?: 'MELEE' | 'RANGED' | 'MAGIC' }): CombatRoundLimits {
    const dynamic = actor as {
      isBoss?: boolean;
      isElite?: boolean;
      isTest?: boolean;
      isDebug?: boolean;
      powerTier?: string;
      aiPersonality?: string;
    };
    const powerTier = String(dynamic.powerTier ?? '').trim().toLowerCase();
    const personality = String(dynamic.aiPersonality ?? '').trim().toLowerCase();
    const isHighTier = Boolean(
      dynamic.isBoss
      || dynamic.isElite
      || dynamic.isTest
      || dynamic.isDebug
      || powerTier === 'boss'
      || powerTier === 'elite'
      || personality === 'boss',
    );

    return {
      maxCommands: isHighTier ? HARD_MAX_COMMANDS_PER_ROUND : DEFAULT_MAX_COMMANDS_PER_ROUND,
      maxAP: isHighTier ? HARD_MAX_AP_PER_ROUND : DEFAULT_MAX_AP_PER_ROUND,
    };
  }

  private getOrCreateTurnPlan(session: CombatSession, actorId: string): CombatTurnPlan {
    const existing = session.turnPlans.get(actorId);
    if (existing) {
      return existing;
    }

    const plan: CombatTurnPlan = {
      battleId: session.state.combatId,
      roundNumber: session.state.roundNumber,
      actorId,
      commands: [],
      ready: false,
    };

    session.turnPlans.set(actorId, plan);
    session.state.submittedPlans = {
      ...(session.state.submittedPlans ?? {}),
      [actorId]: plan,
    };
    return plan;
  }

  private syncSubmittedPlansState(session: CombatSession): void {
    const submittedPlans: Record<string, CombatTurnPlan> = {};
    for (const [actorId, plan] of session.turnPlans.entries()) {
      submittedPlans[actorId] = plan;
    }
    session.state.submittedPlans = submittedPlans;
  }

  private syncTurnPlanState(session: CombatSession): void {
    const controllableActors = this.getLivingControllableActors(session.state, session.playerId);
    session.state.readyActorIds = controllableActors.filter((entity) => session.turnPlans.get(entity.id)?.ready).map((entity) => entity.id);
    session.state.pendingActorIds = controllableActors.filter((entity) => !session.turnPlans.get(entity.id)?.ready).map((entity) => entity.id);
    session.state.roundPhase = session.state.isFinished ? undefined : 'PLANNING';
    session.state.phase = session.state.isFinished ? 'finished' : 'planning';
    this.syncSubmittedPlansState(session);
  }

  private ensurePlanningState(session: CombatSession): void {
    if (session.state.isFinished || session.state.roundPhase === 'RESOLVING') {
      throw new BadRequestException('BATTLE_NOT_PLANNING');
    }
  }

  private async resolveRoundByTimeoutIfNeeded(session: CombatSession): Promise<void> {
    const state = session.state;
    if (state.phase === 'acting' || state.phase === 'animating') {
      await this.resolveActiveTurnTimeoutIfNeeded(session);
      await this.executeAutomatedTurns(session);
      return;
    }

    if (!this.shouldResolveRoundByTimeout(state)) {
      return;
    }

    const actors = this.getLivingControllableActors(state, session.playerId);
    for (const actor of actors) {
      const plan = session.turnPlans.get(actor.id);
      if (plan && plan.commands.length > 0) {
        plan.ready = true;
        plan.submittedAt = new Date().toISOString();
        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex: -1,
          orderIndex: -1,
          type: 'plan_auto_submitted',
          actorId: actor.id,
          message: `${actor.name} не успевает подтвердить план, сервер отправляет черновик автоматически.`,
          data: { reason: 'timeout_draft' },
        });
        continue;
      }

      const fallback = this.buildTimeoutFallbackPlan(state, actor);
      session.turnPlans.set(actor.id, fallback);
      this.addCombatEvent(state, {
        id: randomUUID(),
        roundNumber: state.roundNumber,
        stepIndex: -1,
        orderIndex: -1,
        type: 'plan_auto_submitted',
        actorId: actor.id,
        message: `${actor.name} не успевает среагировать и выполняет безопасное действие автоматически.`,
        data: { reason: 'timeout_fallback', fallbackType: fallback.commands[0]?.type ?? 'wait' },
      });
    }

    this.addCombatEvent(state, {
      id: randomUUID(),
      roundNumber: state.roundNumber,
      stepIndex: -1,
      orderIndex: -1,
      type: 'round_timeout',
      message: 'Время на планирование вышло. Сервер завершает сбор планов автоматически.',
      data: {
        deadlineAt: state.turnDeadlineAt,
        resolvedAt: Date.now(),
      },
    });

    this.syncTurnPlanState(session);
    await this.tryResolveWhenAllReady(session);
  }

  private getLivingPlayerSideActors(state: ArenaBattleState): ArenaCombatEntity[] {
    return state.entities.filter((entity) => entity.team === TeamSide.Left && this.canActorPlan(state, entity));
  }

  private buildSequentialTurnQueue(session: CombatSession): string[] {
    const state = session.state;
    const leftSide = this.getLivingPlayerSideActors(state)
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((entity) => entity.id);
    const rightSide = this.getLivingAiActors(state)
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((entity) => entity.id);
    return [...leftSide, ...rightSide];
  }

  private getActiveActor(state: ArenaBattleState): ArenaCombatEntity | null {
    if (!state.activeActorId) {
      return null;
    }
    return state.entities.find((entity) => entity.id === state.activeActorId) ?? null;
  }

  private isAutomatedActor(session: CombatSession, actor: ArenaCombatEntity): boolean {
    return actor.id !== session.playerId;
  }

  private assignActiveTurnState(session: CombatSession, actor: ArenaCombatEntity | null): void {
    const state = session.state;
    if (!actor || !this.canActorPlan(state, actor)) {
      state.activeActorId = undefined;
      state.currentTurnAp = 0;
      state.turnStartedAt = undefined;
      state.turnDeadlineAt = undefined;
      state.turnDurationSeconds = ACTIVE_TURN_DURATION_SECONDS;
      state.pendingActorIds = [];
      state.readyActorIds = [];
      return;
    }

    const limits = this.getCombatRoundLimitsForActor(actor);
    state.activeActorId = actor.id;
    state.currentTurnAp = limits.maxAP;
    state.turnStartedAt = new Date().toISOString();
    state.turnDurationSeconds = ACTIVE_TURN_DURATION_SECONDS;
    state.turnDeadlineAt = this.isAutomatedActor(session, actor)
      ? undefined
      : new Date(Date.now() + ACTIVE_TURN_DURATION_SECONDS * 1000).toISOString();
    state.pendingActorIds = actor.id === session.playerId ? [actor.id] : [];
    state.readyActorIds = [];

    // Turn-start stamina regeneration (must happen before AI chooses actions).
    if (actor.isAlive) {
      const maxStamina = Math.max(0, Math.floor(actor.maxStamina ?? 0));
      const before = Math.max(0, Math.floor(actor.currentStamina ?? maxStamina));
      if (maxStamina > 0 && before < maxStamina) {
        const regenAmount = Math.max(10, Math.floor(maxStamina * 0.10));
        const after = Math.min(maxStamina, before + regenAmount);
        const amount = Math.max(0, after - before);
        if (amount > 0) {
          actor.currentStamina = after;
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex: -1,
            orderIndex: 0,
            type: 'resource_regen',
            actorId: actor.id,
            message: `${actor.name} восстанавливает силы.`,
            data: {
              resource: 'stamina',
              amount,
              before,
              after,
              reason: 'turn_start',
            },
          });
        }
      }
    }
  }

  private emitTurnTransitionEvents(params: {
    session: CombatSession;
    fromActorId?: string;
    toActorId?: string;
    reason: string;
  }): void {
    const { session, fromActorId, toActorId, reason } = params;
    const state = session.state;
    if (state.isFinished) {
      return;
    }

    if (fromActorId) {
      this.addCombatEvent(state, {
        id: randomUUID(),
        roundNumber: state.roundNumber,
        stepIndex: -1,
        orderIndex: 0,
        type: 'turn_ended',
        actorId: fromActorId,
        message: `Ход ${fromActorId} завершён.`,
        data: { fromActorId, toActorId, reason },
      });
    }

    if (toActorId) {
      this.addCombatEvent(state, {
        id: randomUUID(),
        roundNumber: state.roundNumber,
        stepIndex: -1,
        orderIndex: 0,
        type: 'turn_started',
        actorId: toActorId,
        message: `Ход ${toActorId} начинается.`,
        data: {
          fromActorId,
          toActorId,
          reason,
          currentTurnAp: state.currentTurnAp ?? 0,
          turnDurationSeconds: state.turnDurationSeconds,
          turnDeadlineAt: state.turnDeadlineAt,
        },
      });
    }

    if (fromActorId || toActorId) {
      this.addCombatEvent(state, {
        id: randomUUID(),
        roundNumber: state.roundNumber,
        stepIndex: -1,
        orderIndex: 0,
        type: 'turn_changed',
        actorId: toActorId,
        message: 'Переход хода.',
        data: { fromActorId, toActorId, reason },
      });
    }
  }

  private primeSequentialTurnState(session: CombatSession): void {
    const state = session.state;
    const turnQueue = this.buildSequentialTurnQueue(session);
    state.turnQueue = turnQueue;
    state.turnIndex = 0;
    state.roundPhase = undefined;
    state.phase = state.isFinished ? 'finished' : 'acting';
    this.syncSubmittedPlansState(session);

    if (state.isFinished || turnQueue.length === 0) {
      this.assignActiveTurnState(session, null);
      return;
    }

    const firstActor = state.entities.find((entity) => entity.id === turnQueue[0]) ?? null;
    this.assignActiveTurnState(session, firstActor);
    this.emitTurnTransitionEvents({
      session,
      toActorId: firstActor?.id,
      reason: 'combat_started',
    });
  }

  private findNextActiveActorIndex(session: CombatSession, fromIndex: number): { index: number; wrapped: boolean } | null {
    const state = session.state;
    const queue = state.turnQueue ?? [];
    if (queue.length === 0) {
      return null;
    }

    for (let offset = 1; offset <= queue.length; offset += 1) {
      const candidateIndex = (fromIndex + offset) % queue.length;
      const candidateId = queue[candidateIndex];
      const candidate = state.entities.find((entity) => entity.id === candidateId);
      if (candidate && this.canActorPlan(state, candidate)) {
        return {
          index: candidateIndex,
          wrapped: candidateIndex <= fromIndex,
        };
      }
    }

    return null;
  }

  private async advanceSequentialTurn(session: CombatSession, reason = 'advance'): Promise<void> {
    const state = session.state;
    const fromActorId = state.activeActorId;
    this.refreshBattleResult(state);
    if (state.isFinished) {
      state.phase = 'finished';
      state.roundPhase = undefined;
      this.assignActiveTurnState(session, null);
      return;
    }

    const queue = state.turnQueue ?? [];
    if (queue.length === 0) {
      state.turnQueue = this.buildSequentialTurnQueue(session);
    }

    const effectiveQueue = state.turnQueue ?? [];
    if (effectiveQueue.length === 0) {
      this.refreshBattleResult(state);
      state.phase = state.isFinished ? 'finished' : 'acting';
      this.assignActiveTurnState(session, null);
      return;
    }

    const currentIndex = typeof state.turnIndex === 'number' && Number.isFinite(state.turnIndex)
      ? Math.max(0, Math.floor(state.turnIndex))
      : 0;
    let next = this.findNextActiveActorIndex(session, currentIndex);
    if (!next) {
      this.refreshBattleResult(state);
      if (state.isFinished) {
        state.phase = 'finished';
      }
      this.assignActiveTurnState(session, null);
      return;
    }

    if (next.wrapped) {
      await this.applyPeriodicDamagePhase(session, 'turn_end', HARD_MAX_COMMANDS_PER_ROUND, 0);
      this.tickAllCombatStatusesEndOfRound(session, HARD_MAX_COMMANDS_PER_ROUND, 0);

      for (const effect of session.activeEffects) {
        effect.remainingRounds = Math.max(0, effect.remainingRounds - 1);
      }
      session.activeEffects = session.activeEffects.filter((item) => item.remainingRounds > 0);

      for (const cd of session.skillCooldowns) {
        if (!cd.oncePerCombat) {
          cd.remainingRounds = Math.max(0, cd.remainingRounds - 1);
        }
      }
      session.skillCooldowns = session.skillCooldowns.filter((cd) => cd.remainingRounds > 0 || cd.oncePerCombat);

      for (const debuff of session.enemyTempoBreaks) {
        debuff.remainingRounds = Math.max(0, debuff.remainingRounds - 1);
      }
      session.enemyTempoBreaks = session.enemyTempoBreaks.filter((item) => item.remainingRounds > 0);

      this.applyEndOfRoundRegeneration(state);
      this.refreshBattleResult(state);
      if (state.isFinished) {
        state.phase = 'finished';
        state.roundPhase = undefined;
        this.assignActiveTurnState(session, null);
        return;
      }

      state.roundNumber += 1;
      next = this.findNextActiveActorIndex(session, currentIndex);
      if (!next) {
        this.refreshBattleResult(state);
        if (state.isFinished) {
          state.phase = 'finished';
        }
        this.assignActiveTurnState(session, null);
        return;
      }
    }

    state.turnIndex = next.index;
    state.phase = 'acting';
    const actorId = effectiveQueue[next.index];
    const actor = state.entities.find((entity) => entity.id === actorId) ?? null;
    this.assignActiveTurnState(session, actor);
    this.emitTurnTransitionEvents({
      session,
      fromActorId,
      toActorId: actor?.id,
      reason,
    });
  }

  private async resolveActiveTurnTimeoutIfNeeded(session: CombatSession): Promise<void> {
    const state = session.state;
    if (state.phase !== 'acting') {
      return;
    }

    const actor = this.getActiveActor(state);
    if (!actor || actor.id !== session.playerId) {
      return;
    }

    const deadlineMs = this.getTurnDeadlineMs(state);
    if (deadlineMs == null || Date.now() < deadlineMs) {
      return;
    }

    state.currentTurnAp = 0;
    this.addCombatEvent(state, {
      id: randomUUID(),
      roundNumber: state.roundNumber,
      stepIndex: -1,
      orderIndex: 0,
      type: 'command_started',
      actorId: actor.id,
      message: `${actor.name} не успевает сделать ход и автоматически завершает его.`,
      data: { reason: 'turn_timeout', endTurn: true, resourceCost: { ap: 0, stamina: 0, mp: 0, hp: 0 } },
    });
    await this.advanceSequentialTurn(session, 'timeout');
  }

  private async executeAutomatedTurns(session: CombatSession): Promise<void> {
    for (let iteration = 0; iteration < MAX_AUTOMATED_TURN_LOOPS; iteration += 1) {
      const state = session.state;
      if (state.isFinished || state.phase !== 'acting') {
        return;
      }

      const actor = this.getActiveActor(state);
      if (!actor || !this.canActorPlan(state, actor)) {
        await this.advanceSequentialTurn(session, 'invalid_active_actor');
        continue;
      }
      if (!this.isAutomatedActor(session, actor)) {
        return;
      }

      await this.executeAiTurn(session, actor);
    }
  }

  private async executeAiTurn(session: CombatSession, aiActor: ArenaCombatEntity): Promise<void> {
    const state = session.state;
    if (state.activeActorId !== aiActor.id || state.phase !== 'acting' || state.isFinished) {
      return;
    }
    if (!this.canActorPlan(state, aiActor)) {
      await this.advanceSequentialTurn(session, 'ai_actor_cannot_act');
      return;
    }

    const limits = this.getCombatRoundLimitsForActor(aiActor);
    const aiPlan = this.buildNpcAiPlan(session, aiActor);
    const commands = (aiPlan.commands ?? []).slice(0, limits.maxCommands);

    for (const rawCommand of commands) {
      if (state.activeActorId !== aiActor.id || state.phase !== 'acting' || state.isFinished) {
        break;
      }

      let command: CombatCommand;
      try {
        command = this.normalizeAuthoritativeCombatCommand({ rawCommand, actor: aiActor, battleState: state });
      } catch {
        break;
      }

      if (command.apCost > (state.currentTurnAp ?? 0)) {
        break;
      }

      const revalidation = this.revalidateCommandForResolve({ state, actor: aiActor, command });
      if (!revalidation.ok) {
        break;
      }

      await this.executeImmediateCombatCommand({
        session,
        actor: aiActor,
        command,
        stepIndex: 0,
        orderIndex: 0,
      });
      state.currentTurnAp = Math.max(0, (state.currentTurnAp ?? 0) - command.apCost);

      if (command.type === 'wait' || (state.currentTurnAp ?? 0) <= 0 || state.isFinished || !this.canActorPlan(state, aiActor)) {
        break;
      }
    }

    await this.advanceSequentialTurn(session, 'ai_end_turn');
  }

  private withCommandResourceCost(command: CombatCommand): { ap: number; stamina: number; mp: number; hp: number } {
    return {
      ap: Math.max(0, Math.floor(command.apCost ?? 0)),
      stamina: Math.max(0, Math.floor(command.costs?.stamina ?? 0)),
      mp: Math.max(0, Math.floor(command.costs?.mp ?? 0)),
      hp: Math.max(0, Math.floor(command.costs?.hp ?? 0)),
    };
  }

  private applyImmediateMovementRules(params: {
    actor: ArenaCombatEntity;
    command: CombatCommand;
  }):
    | { ok: true; command: CombatCommand; distance: number; movementType: 'walk' | 'dash' | 'disengage' }
    | { ok: false; errorCode: string; reason: string; message: string; details: Record<string, unknown> } {
    const { actor, command } = params;
    if ((command.type !== 'move' && command.type !== 'dash' && command.type !== 'disengage') || command.target.kind !== 'cell') {
      return { ok: true, command, distance: 0, movementType: command.type === 'dash' ? 'dash' : command.type === 'disengage' ? 'disengage' : 'walk' };
    }

    const from = this.getEntityCell(actor);
    const to = { x: command.target.x, y: command.target.y };
    const distance = this.getCellDistance(from, to);
    const movementType = command.type === 'dash' ? 'dash' : command.type === 'disengage' ? 'disengage' : 'walk';

    if (distance <= 0) {
      return {
        ok: false,
        errorCode: 'INVALID_MOVE_DISTANCE',
        reason: 'invalid_move_distance',
        message: 'Недопустимая дистанция перемещения.',
        details: { distance, maxDistance: movementType === 'dash' ? 3 : movementType === 'walk' ? 2 : 1, movementType },
      };
    }

    if (movementType === 'walk' && distance > 2) {
      return {
        ok: false,
        errorCode: 'MOVEMENT_TOO_FAR',
        reason: 'movement_too_far',
        message: 'Слишком большая дистанция для move.',
        details: { distance, maxDistance: 2, movementType },
      };
    }

    if (movementType === 'dash' && distance > 3) {
      return {
        ok: false,
        errorCode: 'DASH_TOO_FAR',
        reason: 'dash_too_far',
        message: 'Слишком большая дистанция для dash.',
        details: { distance, maxDistance: 3, movementType },
      };
    }

    if (movementType === 'disengage' && distance > 1) {
      return {
        ok: false,
        errorCode: 'DISENGAGE_TOO_FAR',
        reason: 'disengage_too_far',
        message: 'Слишком большая дистанция для disengage.',
        details: { distance, maxDistance: 1, movementType },
      };
    }

    const movementCost = movementType === 'dash'
      ? { ap: 2, stamina: 30 }
      : movementType === 'disengage'
        ? { ap: 1, stamina: 20 }
        : distance === 1
          ? { ap: 1, stamina: 10 }
          : { ap: 1, stamina: 20 };

    return {
      ok: true,
      command: {
        ...command,
        apCost: movementCost.ap,
        costs: {
          ...command.costs,
          stamina: movementCost.stamina,
          mp: command.costs?.mp,
          hp: command.costs?.hp,
        },
      },
      distance,
      movementType,
    };
  }

  private mapPlanErrorsToMessage(errors: CombatPlanErrorCode[]): string {
    return [...new Set(errors)].join(', ');
  }

  private collectWeaponSwapPlanErrors(command: CombatCommand, actor: ArenaBattleState['entities'][number]): CombatPlanErrorCode[] {
    if (command.type !== 'weapon_swap') {
      return [];
    }

    const weaponId = command.payload?.weaponItemId ?? command.payload?.weaponInstanceId;
    if (!weaponId) {
      return ['WEAPON_ID_REQUIRED'];
    }

    const adminItem = this.contentService.listCollection('items').find((item) => item.id === weaponId) ?? null;
    if (!adminItem) {
      return ['WEAPON_NOT_FOUND'];
    }
    if (adminItem.type !== 'weapon') {
      return ['ITEM_IS_NOT_WEAPON'];
    }
    if (actor.activeWeaponItemId === weaponId) {
      return ['WEAPON_ALREADY_EQUIPPED'];
    }

    return [];
  }

  private normalizeAndValidateCommand(params: {
    session: CombatSession;
    actor: ArenaBattleState['entities'][number];
    rawCommand: CombatCommand;
    currentCommands: CombatCommand[];
  }): { command: CombatCommand; validation: CombatPlanValidationResult } {
    const trusted = this.normalizeAuthoritativeCombatCommand({
      rawCommand: params.rawCommand,
      actor: params.actor,
      battleState: params.session.state,
    });

    const validation = canAppendCombatCommand({
      actor: params.actor,
      currentCommands: params.currentCommands,
      nextCommand: trusted,
      battleState: params.session.state,
      limits: this.getCombatRoundLimitsForActor(params.actor),
    });

    const weaponSwapErrors = this.collectWeaponSwapPlanErrors(trusted, params.actor);
    if (weaponSwapErrors.length > 0) {
      return {
        command: trusted,
        validation: {
          ...validation,
          ok: false,
          errors: [...new Set([...(validation.errors ?? []), ...weaponSwapErrors])],
        },
      };
    }

    return { command: trusted, validation };
  }

  private normalizeAuthoritativeCombatCommand(params: {
    rawCommand: CombatCommand;
    actor: ArenaCombatEntity;
    battleState: ArenaBattleState;
  }): CombatCommand {
    const normalized = normalizeCombatCommand({
      rawCommand: params.rawCommand,
      actor: params.actor,
      battleState: params.battleState,
    });

    if (normalized.type !== 'skill_cast') {
      return normalized;
    }

    const skillId = typeof normalized.payload?.skillId === 'string' ? normalized.payload.skillId.trim() : '';
    if (!skillId) {
      return normalized;
    }

    const skillDef = this.skillRuntime.getSkillDefinition(skillId);
    if (!skillDef) {
      return normalized;
    }

    return {
      ...normalized,
      payload: {
        ...(normalized.payload ?? {}),
        skillId,
        skillRange: Math.max(0, Math.floor(skillDef.target?.range ?? normalized.payload?.skillRange ?? 0)),
      },
    };
  }

  private toLegacyArenaAction(command: CombatCommand, actorId: string, defaultTargetId: string): ArenaCombatAction {
    const targetId = command.target.kind === 'entity' ? command.target.entityId : defaultTargetId;
    const targetZone = command.payload?.targetZone ?? TargetZone.Chest;

    if (command.type === 'move' || command.type === 'dash' || command.type === 'disengage') {
      return {
        actorId,
        targetId,
        attackZone: targetZone,
        defenseZones: [],
        attackPointsSpent: 0,
        defensePointsSpent: 0,
        actionType: ActionType.Move,
        movementType: command.type === 'move'
          ? MovementType.Step
          : command.type === 'dash'
            ? MovementType.Dash
            : MovementType.Disengage,
        destinationX: command.target.kind === 'cell' ? command.target.x : undefined,
        destinationY: command.target.kind === 'cell' ? command.target.y : undefined,
      };
    }

    if (command.type === 'guard' || command.type === 'strong_guard') {
      return {
        actorId,
        targetId,
        attackZone: targetZone,
        defenseZones: command.type === 'strong_guard' ? [TargetZone.Chest, TargetZone.Abdomen] : [TargetZone.Chest],
        attackPointsSpent: 0,
        defensePointsSpent: 0,
        actionType: ActionType.Defend,
      };
    }

    if (command.type === 'wait') {
      return {
        actorId,
        targetId,
        attackZone: targetZone,
        defenseZones: [],
        attackPointsSpent: 0,
        defensePointsSpent: 0,
        actionType: ActionType.Wait,
      };
    }

    return {
      actorId,
      targetId,
      attackZone: targetZone,
      defenseZones: [],
      attackPointsSpent: 0,
      defensePointsSpent: 0,
      actionType: ActionType.Attack,
    };
  }

  private addCommandToTurnPlan(session: CombatSession, actorId: string, command: CombatCommand): { plan: CombatTurnPlan; validation: ReturnType<typeof validateCombatTurnPlan> } {
    const actor = session.state.entities.find((entity) => entity.id === actorId);
    if (!actor) {
      throw new NotFoundException('Actor not found.');
    }
    if (!this.canActorPlan(session.state, actor)) {
      throw new BadRequestException('ACTOR_DEFEATED');
    }

    const plan = this.getOrCreateTurnPlan(session, actorId);
    const { command: trusted, validation } = this.normalizeAndValidateCommand({
      session,
      actor,
      rawCommand: command,
      currentCommands: plan.commands,
    });

    if (!validation.ok) {
      throw new BadRequestException(this.mapPlanErrorsToMessage(validation.errors));
    }

    plan.commands = [...plan.commands, trusted];
    plan.ready = false;
    plan.submittedAt = new Date().toISOString();
    this.syncTurnPlanState(session);
    return { plan, validation };
  }

  private clearTurnPlan(session: CombatSession, actorId: string): CombatTurnPlan {
    const plan = this.getOrCreateTurnPlan(session, actorId);
    plan.commands = [];
    plan.ready = false;
    this.syncTurnPlanState(session);
    return plan;
  }

  private undoTurnPlanCommand(session: CombatSession, actorId: string): CombatTurnPlan {
    const plan = this.getOrCreateTurnPlan(session, actorId);
    plan.commands = plan.commands.slice(0, -1);
    plan.ready = false;
    this.syncTurnPlanState(session);
    return plan;
  }

  private setTurnPlanReady(session: CombatSession, actorId: string, ready: boolean): CombatTurnPlan {
    this.ensurePlanningState(session);

    const actor = session.state.entities.find((entity) => entity.id === actorId);
    if (!actor) {
      throw new NotFoundException('Actor not found.');
    }
    if (!this.canActorPlan(session.state, actor)) {
      throw new BadRequestException('ACTOR_DEFEATED');
    }

    const plan = this.getOrCreateTurnPlan(session, actorId);

    if (ready && plan.commands.length === 0) {
      const guardStaminaCost = COMBAT_ACTION_COSTS.guard.stamina ?? 0;
      const fallbackType = actor.currentStamina >= guardStaminaCost ? 'guard' : 'wait';
      const fallbackTarget = fallbackType === 'wait' ? { kind: 'self' as const } : { kind: 'self' as const };
      const fallbackCommand = createCombatCommandFromType({
        type: fallbackType,
        target: fallbackTarget,
      });
      const normalized = this.normalizeAuthoritativeCombatCommand({ rawCommand: fallbackCommand, actor, battleState: session.state });
      plan.commands = [normalized];
    }

    if (ready) {
      const validation = validateCombatTurnPlan({
        plan,
        actor,
        battleState: session.state,
        limits: this.getCombatRoundLimitsForActor(actor),
      });
      if (!validation.ok) {
        throw new BadRequestException(this.mapPlanErrorsToMessage(validation.errors));
      }
    }

    plan.ready = ready;
    plan.submittedAt = ready ? new Date().toISOString() : undefined;
    this.syncTurnPlanState(session);
    return plan;
  }

  private rollCombatRandom(): number {
    return Math.floor(Math.random() * 6);
  }

  private rollUniform01(): number {
    return Math.random();
  }

  private getActorEquipmentSnapshot(session: CombatSession, actor: ArenaCombatEntity): Equipment {
    const base = session.equipmentByActorId.get(actor.id) ?? this.contentService.normalizeEquipment({});
    const merged: Partial<Equipment> = { ...base };
    if (actor.activeWeaponItemId) {
      merged.weapon = actor.activeWeaponItemId;
    }
    if (actor.offHandItemId !== undefined) {
      merged.shield = actor.offHandItemId ?? undefined;
    }
    return this.contentService.normalizeEquipment(merged);
  }

  private getResolvedCombatItemEffects(equipment: Equipment): ItemEffect[] {
    return resolveCharacterEquipmentModifiers({
      equipment,
      items: this.contentService.listCollection('items'),
      itemSets: this.contentService.listCollection('itemSets'),
      activeStatuses: [],
      activationContexts: ['combat'],
    }).effects;
  }

  private buildTargetStatusDefenseProfile(session: CombatSession, target: ArenaCombatEntity) {
    const equipment = this.getActorEquipmentSnapshot(session, target);
    return buildStatusResistanceImmunityProfile(this.getResolvedCombatItemEffects(equipment));
  }

  private emitTryApplyStatusResult(
    state: ArenaBattleState,
    ctx: {
      stepIndex: number;
      orderIndex: number;
      commandId: string;
      attackerId: string;
      targetId: string;
    },
    result: TryApplyCombatStatusResult,
  ): void {
    if (!result.messageRu) {
      return;
    }
    const eventType =
      result.outcome === 'immune'
        ? 'status_immune'
        : result.outcome === 'resisted' || result.outcome === 'missed_chance'
          ? 'status_resisted'
          : result.outcome === 'applied'
            ? 'status_applied'
            : 'effect_triggered';
    this.addCombatEvent(state, {
      id: randomUUID(),
      roundNumber: state.roundNumber,
      stepIndex: ctx.stepIndex,
      orderIndex: ctx.orderIndex,
      type: eventType,
      actorId: ctx.attackerId,
      targetId: ctx.targetId,
      commandId: ctx.commandId,
      message: result.messageRu,
      data: {
        statusId: result.canonicalStatusId,
        baseChancePercent: result.baseChancePercent,
        finalChancePercent: result.finalChancePercent,
        durationTurns: result.durationApplied,
        outcome: result.outcome,
      },
    });
  }

  private applyAttackStatusProcs(params: {
    session: CombatSession;
    state: ArenaBattleState;
    attacker: ArenaCombatEntity;
    target: ArenaCombatEntity;
    trigger: 'on_hit' | 'on_crit';
    stepIndex: number;
    orderIndex: number;
    commandId: string;
  }): void {
    if (!params.target.isAlive) {
      return;
    }
    const equipment = this.getActorEquipmentSnapshot(params.session, params.attacker);
    const effects = this.getResolvedCombatItemEffects(equipment).filter(
      (e) => e.trigger === params.trigger && e.type === 'apply_status',
    );
    if (effects.length === 0) {
      return;
    }
    const profile = this.buildTargetStatusDefenseProfile(params.session, params.target);
    const rng = () => this.rollUniform01();
    const ctx = {
      stepIndex: params.stepIndex,
      orderIndex: params.orderIndex,
      commandId: params.commandId,
      attackerId: params.attacker.id,
      targetId: params.target.id,
    };
    for (const effect of effects) {
      const result = tryApplyCombatStatus({
        effect: { ...effect, type: 'apply_status', data: effect.data },
        target: params.target,
        targetDefenseProfile: profile,
        sourceActorId: params.attacker.id,
        sourceItemId: params.attacker.activeWeaponItemId ?? undefined,
        rng,
        rollChance: true,
      });
      if (result.outcome !== 'skipped' || result.messageRu) {
        this.emitTryApplyStatusResult(params.state, ctx, result);
      }
      syncControlFlagsFromActiveStatuses(params.target);
    }
  }

  private applyLifestealFromAttack(params: {
    session: CombatSession;
    state: ArenaBattleState;
    actor: ArenaCombatEntity;
    damageDealt: number;
    stepIndex: number;
    orderIndex: number;
    commandId: string;
  }): void {
    if (params.damageDealt <= 0 || !params.actor.isAlive) {
      return;
    }
    const equipment = this.getActorEquipmentSnapshot(params.session, params.actor);
    const effects = this.getResolvedCombatItemEffects(equipment).filter(
      (e) => e.trigger === 'on_hit' && e.type === 'lifesteal',
    );
    if (effects.length === 0) {
      return;
    }
    let totalPct = 0;
    for (const e of effects) {
      const ch = e.chancePercent ?? 100;
      if (this.rollUniform01() * 100 > ch) {
        continue;
      }
      totalPct += effectNumericPercent(e);
    }
    if (totalPct <= 0) {
      return;
    }
    const heal = Math.max(0, Math.floor((params.damageDealt * Math.min(100, totalPct)) / 100));
    if (heal <= 0) {
      return;
    }
    const restored = Math.max(0, Math.min(params.actor.maxHp - params.actor.currentHp, heal));
    if (restored <= 0) {
      return;
    }
    params.actor.currentHp += restored;
    this.addCombatEvent(params.state, {
      id: randomUUID(),
      roundNumber: params.state.roundNumber,
      stepIndex: params.stepIndex,
      orderIndex: params.orderIndex,
      type: 'heal',
      actorId: params.actor.id,
      targetId: params.actor.id,
      commandId: params.commandId,
      message: `${params.actor.name} восстанавливает ${restored} HP (вампиризм).`,
      data: { amount: restored, kind: 'lifesteal' },
    });
  }

  private extractItemEffectsFromContentPayload(rawValue: unknown): ItemEffect[] {
    const raw = this.toRecord(rawValue);
    if (!raw) {
      return [];
    }
    const sources: unknown[] = [];
    if (Array.isArray(raw.useEffects)) {
      sources.push(...raw.useEffects);
    }
    const singleEffect = this.toRecord(raw.useEffect);
    if (singleEffect) {
      sources.push(singleEffect);
    }
    if (Array.isArray(raw.effects)) {
      sources.push(...raw.effects);
    }
    if (Array.isArray(raw.combatEffects)) {
      sources.push(...raw.combatEffects);
    }
    const out: ItemEffect[] = [];
    for (const entry of sources) {
      const rec = this.toRecord(entry);
      if (!rec || typeof rec.type !== 'string') {
        continue;
      }
      out.push({
        type: rec.type as ItemEffect['type'],
        stat: rec.stat as ItemEffect['stat'],
        value: typeof rec.value === 'number' ? rec.value : undefined,
        percent: typeof rec.percent === 'number' ? rec.percent : undefined,
        flat: typeof rec.flat === 'number' ? rec.flat : undefined,
        damageCategory: rec.damageCategory as ItemEffect['damageCategory'],
        physicalType: rec.physicalType as ItemEffect['physicalType'],
        elementType: rec.elementType as ItemEffect['elementType'],
        magicSchool: rec.magicSchool as ItemEffect['magicSchool'],
        statusId: typeof rec.statusId === 'string' ? rec.statusId : undefined,
        chancePercent: typeof rec.chancePercent === 'number' ? rec.chancePercent : undefined,
        durationTurns: typeof rec.durationTurns === 'number' ? rec.durationTurns : undefined,
        trigger: rec.trigger as ItemEffect['trigger'],
        activationContexts: Array.isArray(rec.activationContexts)
          ? (rec.activationContexts as string[])
          : undefined,
        condition: typeof rec.condition === 'string' ? rec.condition : undefined,
        data: (() => {
          const dr = this.toRecord(rec.data);
          return dr ? { ...dr } : undefined;
        })(),
      });
    }
    return out;
  }

  private async applyPeriodicDamagePhase(
    session: CombatSession,
    phase: 'turn_start' | 'turn_end',
    stepIndex: number,
    orderIndex: number,
  ): Promise<void> {
    const state = session.state;
    const ticks = collectPeriodicStatusDamage(state.entities, phase);
    for (const tick of ticks) {
      const entity = state.entities.find((e) => e.id === tick.entityId);
      if (!entity || !entity.isAlive) {
        continue;
      }
      entity.currentHp = Math.max(0, entity.currentHp - tick.amount);
      entity.isAlive = entity.currentHp > 0;
      this.addCombatEvent(state, {
        id: randomUUID(),
        roundNumber: state.roundNumber,
        stepIndex,
        orderIndex,
        type: 'status_tick',
        actorId: entity.id,
        targetId: entity.id,
        message: tick.messageRu,
        data: {
          amount: tick.amount,
          statusId: tick.statusId,
          damageCategory: tick.damageCategory,
          elementType: tick.elementType,
        },
      });
      if (!entity.isAlive) {
        await this.processActorDeath({
          session,
          actor: entity,
          sourceActorId: entity.id,
          roundNumber: state.roundNumber,
          stepIndex,
          orderIndex,
        });
      }
    }
  }

  private tickAllCombatStatusesEndOfRound(session: CombatSession, stepIndex: number, orderIndex: number): void {
    const state = session.state;
    const expired = tickCombatStatusDurationsEndOfRound(state.entities);
    for (const ex of expired) {
      this.addCombatEvent(state, {
        id: randomUUID(),
        roundNumber: state.roundNumber,
        stepIndex,
        orderIndex,
        type: 'status_removed',
        actorId: ex.entityId,
        targetId: ex.entityId,
        message: ex.labelRu
          ? `Эффект «${ex.labelRu}» спал с ${ex.entityName}.`
          : `Эффект ${ex.statusId} спал с ${ex.entityName}.`,
        data: { statusId: ex.statusId },
      });
    }
    for (const entity of state.entities) {
      syncControlFlagsFromActiveStatuses(entity);
    }
  }

  private addCombatEvent(
    state: ArenaBattleState,
    event: CombatEvent,
    animationEvent?: CombatAnimationEvent,
  ): void {
    const nextEvents = [...(state.recentCombatEvents ?? []), event];
    state.recentCombatEvents = nextEvents;
    if (animationEvent) {
      state.recentAnimationEvents = [...(state.recentAnimationEvents ?? []), animationEvent];
    }
    state.logs.push({
      round: event.roundNumber,
      actorId: event.actorId ?? 'system',
      targetId: event.targetId,
      type: event.type === 'damage' ? 'HIT' : 'INFO',
      amount: typeof event.data?.amount === 'number' ? event.data.amount : undefined,
      text: event.message,
    });
  }

  private resolveErrorToCode(error: string): CombatResolveErrorCode {
    switch (error.toLowerCase()) {
      case 'actor_dead':
        return 'ACTOR_DEAD';
      case 'actor_knocked_down':
      case 'actor_incapacitated':
        return 'COMMAND_REVALIDATION_FAILED';
      case 'target_dead':
      case 'target_missing':
        return 'TARGET_DEAD';
      case 'target_out_of_range':
      case 'target_too_close':
        return 'TARGET_OUT_OF_RANGE';
      case 'line_of_sight_blocked':
        return 'LINE_OF_SIGHT_BLOCKED';
      case 'cell_blocked':
        return 'CELL_BLOCKED';
      case 'cell_occupied':
        return 'CELL_OCCUPIED';
      case 'not_enough_stamina':
        return 'NOT_ENOUGH_STAMINA';
      case 'not_enough_mp':
        return 'NOT_ENOUGH_MP';
      case 'not_enough_hp':
        return 'NOT_ENOUGH_HP';
      case 'unknown_command':
        return 'UNKNOWN_COMMAND';
      default:
        return 'COMMAND_REVALIDATION_FAILED';
    }
  }

  private getEntityCell(entity: ArenaBattleState['entities'][number]): { x: number; y: number } {
    return {
      x: entity.battlefieldX ?? 0,
      y: entity.battlefieldY ?? 0,
    };
  }

  private getCellDistance(left: { x: number; y: number }, right: { x: number; y: number }): number {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
  }

  private isPveBattle(state: ArenaBattleState): boolean {
    return state.battleType !== 'pvp' && state.battleType !== 'arena';
  }

  private isActorEscaped(state: ArenaBattleState, actorId: string): boolean {
    return Boolean(state.escapeStates?.[actorId]?.active === false && state.escapeStates?.[actorId]?.completedRound);
  }

  private isActorDefeated(actor: ArenaCombatEntity): boolean {
    return actor.lifeState === 'defeated' || actor.lifeState === 'dead' || actor.lifeState === 'escaped' || !actor.isAlive;
  }

  private canActorPlan(state: ArenaBattleState, actor: ArenaCombatEntity): boolean {
    if (this.isActorDefeated(actor)) {
      return false;
    }
    if (this.isActorEscaped(state, actor.id)) {
      return false;
    }
    return true;
  }

  private hasLivingAllies(params: { battleState: ArenaBattleState; actorId: string }): boolean {
    const actor = params.battleState.entities.find((entry) => entry.id === params.actorId);
    if (!actor) {
      return false;
    }

    return params.battleState.entities.some((entry) => (
      entry.id !== actor.id
      && entry.team === actor.team
      && entry.isAlive
      && !this.isActorDefeated(entry)
      && !this.isActorEscaped(params.battleState, entry.id)
    ));
  }

  private getLivingControllableActors(state: ArenaBattleState, playerId?: string): ArenaCombatEntity[] {
    return state.entities.filter((entity) => (
      entity.team === TeamSide.Left
      && (playerId ? entity.id === playerId : true)
      && this.canActorPlan(state, entity)
    ));
  }

  private getLivingAiActors(state: ArenaBattleState): ArenaCombatEntity[] {
    return state.entities.filter((entity) => (
      entity.team === TeamSide.Right
      && this.canActorPlan(state, entity)
    ));
  }

  private getTurnDeadlineMs(state: ArenaBattleState): number | null {
    if (typeof state.turnDeadlineAt !== 'string') {
      return null;
    }
    const parsed = Date.parse(state.turnDeadlineAt);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private shouldResolveRoundByTimeout(state: ArenaBattleState, now = Date.now()): boolean {
    const deadlineMs = this.getTurnDeadlineMs(state);
    return state.phase === 'planning' && deadlineMs != null && now >= deadlineMs;
  }

  private buildTimeoutFallbackPlan(state: ArenaBattleState, actor: ArenaCombatEntity): CombatTurnPlan {
    const guardStaminaCost = COMBAT_ACTION_COSTS.guard.stamina ?? 15;
    const canGuard = actor.currentStamina >= guardStaminaCost && !this.hasGuardBreakingControlFlag(actor);
    const fallback = createCombatCommandFromType({
      type: canGuard ? 'guard' : 'wait',
      target: { kind: 'self' },
    });
    const normalized = this.normalizeAuthoritativeCombatCommand({ rawCommand: fallback, actor, battleState: state });
    return {
      battleId: state.combatId,
      roundNumber: state.roundNumber,
      actorId: actor.id,
      commands: [normalized],
      ready: true,
      submittedAt: new Date().toISOString(),
    };
  }

  private collectPvpLootCandidates(actorId: string): Promise<LootItem[]> {
    return (async () => {
      const arenaState = await this.arenaService.getHubState(actorId);
      const equippedIds = new Set<string>(Object.values(arenaState.equipment ?? {}).filter((id): id is string => typeof id === 'string' && id.length > 0));
      const candidates: LootItem[] = [];

      for (const row of arenaState.inventory?.items ?? []) {
        if (!row?.itemId || row.quantity <= 0) {
          continue;
        }
        if (equippedIds.has(row.itemId)) {
          continue;
        }

        const item = this.contentService.getCollectionEntry('items', row.itemId) as AdminItem | null;
        if (!item) {
          continue;
        }

        const type = String(item.type ?? '').toLowerCase();
        const subtype = String(item.subtype ?? '').toLowerCase();
        if (type === 'quest' || subtype === 'quest') {
          continue;
        }
        if (item.isQuestItem || item.isBound || item.isStarterItem || item.isDroppable === false) {
          continue;
        }

        candidates.push({
          itemId: row.itemId,
          quantity: Math.max(1, Math.floor(row.quantity)),
          name: item.name,
          rarity: item.rarity,
          generatedFrom: 'pvp_backpack',
        });
      }

      return candidates;
    })();
  }

  private rollPvpLoot(candidates: LootItem[]): LootItem[] {
    const dropped: LootItem[] = [];
    for (const candidate of candidates) {
      if (dropped.length >= PVP_LOOT_CONFIG.maxDroppedItems) {
        break;
      }
      if (Math.random() > PVP_LOOT_CONFIG.itemDropChance) {
        continue;
      }
      dropped.push({
        ...candidate,
        quantity: 1,
      });
    }
    return dropped;
  }

  private async claimLootContainerForActor(params: {
    state: ArenaBattleState;
    actor: ArenaCombatEntity;
    command: CombatCommand;
    stepIndex: number;
    orderIndex: number;
    ignoreRange?: boolean;
  }): Promise<void> {
    const { state, actor, command, stepIndex, orderIndex } = params;
    const containerId = command.payload?.lootContainerId;
    const containers = state.lootContainers ?? [];
    const container = containers.find((entry) => entry.id === containerId);
    if (!container) {
      this.addCombatEvent(state, {
        id: randomUUID(),
        roundNumber: state.roundNumber,
        stepIndex,
        orderIndex,
        type: 'command_failed',
        actorId: actor.id,
        commandId: command.id,
        message: 'Контейнер добычи не найден.',
        data: { error: 'LOOT_CONTAINER_NOT_FOUND' },
      });
      return;
    }
    if (container.claimed) {
      this.addCombatEvent(state, {
        id: randomUUID(),
        roundNumber: state.roundNumber,
        stepIndex,
        orderIndex,
        type: 'command_failed',
        actorId: actor.id,
        commandId: command.id,
        message: 'Добыча уже собрана.',
        data: { error: 'LOOT_ALREADY_CLAIMED' },
      });
      return;
    }

    const distance = this.getCellDistance(this.getEntityCell(actor), { x: container.x, y: container.y });
    if (!params.ignoreRange && distance > 1) {
      this.addCombatEvent(state, {
        id: randomUUID(),
        roundNumber: state.roundNumber,
        stepIndex,
        orderIndex,
        type: 'command_failed',
        actorId: actor.id,
        commandId: command.id,
        message: 'Слишком далеко от добычи.',
        data: { error: 'LOOT_NOT_IN_RANGE' },
      });
      return;
    }

    for (const item of container.items) {
      const qty = Math.max(1, Math.floor(item.quantity ?? 1));
      if (isFileStorageMode()) {
        await this.updateRuntimeInventoryItemQuantity(actor.id, item.itemId, qty);
      } else {
        const existing = await this.prisma.characterInventoryItem.findUnique({
          where: { characterId_itemId: { characterId: actor.id, itemId: item.itemId } },
        });
        if (existing) {
          await this.prisma.characterInventoryItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + qty } });
        } else {
          await this.prisma.characterInventoryItem.create({ data: { characterId: actor.id, itemId: item.itemId, quantity: qty } });
        }
      }
    }

    if ((container.gold ?? 0) > 0) {
      if (isFileStorageMode()) {
        const character = await this.runtimeStore.getCharacterById(actor.id);
        const currentGold = Number((character as { gold?: unknown } | null | undefined)?.gold ?? 0) || 0;
        await this.runtimeStore.updateCharacter(actor.id, { gold: currentGold + (container.gold ?? 0) });
      } else {
        await this.prisma.character.update({ where: { id: actor.id }, data: { gold: { increment: container.gold ?? 0 } } });
      }
    }

    container.claimed = true;
    container.claimedByActorId = actor.id;
    container.claimedAt = new Date().toISOString();

    this.addCombatEvent(state, {
      id: randomUUID(),
      roundNumber: state.roundNumber,
      stepIndex,
      orderIndex,
      type: 'loot_taken',
      actorId: actor.id,
      commandId: command.id,
      message: `${actor.name} подбирает добычу с земли.`,
      data: {
        lootContainerId: container.id,
        items: container.items,
        gold: container.gold ?? 0,
      },
    });
  }

  private async claimAllAvailableLootForActor(state: ArenaBattleState, actorId: string): Promise<void> {
    const actor = state.entities.find((entry) => entry.id === actorId);
    if (!actor) {
      return;
    }

    const containers = (state.lootContainers ?? []).filter((entry) => !entry.claimed);
    for (const container of containers) {
      const syntheticCommand = createCombatCommandFromType({
        type: 'loot',
        target: { kind: 'self' },
        payload: { lootContainerId: container.id },
      });
      await this.claimLootContainerForActor({
        state,
        actor,
        command: syntheticCommand,
        stepIndex: HARD_MAX_COMMANDS_PER_ROUND,
        orderIndex: 0,
        ignoreRange: true,
      });
    }
  }

  private async processActorDeath(params: {
    session: CombatSession;
    actor: ArenaCombatEntity;
    sourceActorId?: string;
    roundNumber: number;
    stepIndex: number;
    orderIndex: number;
    commandId?: string;
  }): Promise<void> {
    const { session, actor, sourceActorId, roundNumber, stepIndex, orderIndex, commandId } = params;
    const state = session.state;
    if (actor.currentHp > 0) {
      return;
    }

    actor.currentHp = 0;
    actor.isAlive = false;

    const isPlayer = actor.team === TeamSide.Left;
    const pve = this.isPveBattle(state);
    actor.lifeState = isPlayer && !pve ? 'defeated' : 'dead';

    this.addCombatEvent(state, {
      id: randomUUID(),
      roundNumber,
      stepIndex,
      orderIndex,
      type: 'death',
      actorId: sourceActorId,
      targetId: actor.id,
      commandId,
      message: isPlayer && !pve
        ? `${actor.name} падает, но бой вокруг него продолжается.`
        : `${actor.name} падает без сил.`,
      data: {
        mode: pve ? 'pve' : 'pvp',
        lifeState: actor.lifeState,
        canAct: false,
      },
    });

    if (isPlayer && pve && !this.hasLivingAllies({ battleState: state, actorId: actor.id })) {
      state.isFinished = true;
      state.phase = 'finished';
      state.roundPhase = undefined;
      state.winner = TeamSide.Right;
      this.addCombatEvent(state, {
        id: randomUUID(),
        roundNumber,
        stepIndex,
        orderIndex,
        type: 'battle_finished',
        message: 'Бой завершён поражением.',
        data: { result: 'defeat' },
      });
      return;
    }

    if (!isPlayer) {
      const dropId = this.rollCombatDrop(state);
      const items: LootItem[] = [];
      if (dropId) {
        const item = this.contentService.resolveItemById(dropId);
        items.push({ itemId: dropId, quantity: 1, name: item.name, rarity: item.rarity, generatedFrom: 'pve_drop' });
      }

      if (items.length > 0) {
        const container: CombatLootContainer = {
          id: `loot_${randomUUID()}`,
          battleId: state.combatId,
          x: actor.battlefieldX ?? 0,
          y: actor.battlefieldY ?? 0,
          sourceEntityId: actor.id,
          sourceName: actor.name,
          items,
          gold: 0,
          createdRound: roundNumber,
          claimed: false,
        };
        state.lootContainers = [...(state.lootContainers ?? []), container];
        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber,
          stepIndex,
          orderIndex,
          type: 'loot_created',
          actorId: actor.id,
          targetId: actor.id,
          message: `После смерти ${actor.name} на земле остаются трофеи.`,
          data: {
            lootContainerId: container.id,
            sourceEntityId: actor.id,
            x: container.x,
            y: container.y,
            itemCount: container.items.length,
            gold: container.gold ?? 0,
          },
        });
      }
    } else if (!pve) {
      const candidates = await this.collectPvpLootCandidates(actor.id);
      const dropped = this.rollPvpLoot(candidates);
      if (dropped.length > 0) {
        const container: CombatLootContainer = {
          id: `loot_${randomUUID()}`,
          battleId: state.combatId,
          x: actor.battlefieldX ?? 0,
          y: actor.battlefieldY ?? 0,
          sourceEntityId: actor.id,
          sourceName: actor.name,
          items: dropped,
          gold: PVP_LOOT_CONFIG.pvpGoldDropEnabled ? 0 : 0,
          createdRound: roundNumber,
          claimed: false,
        };
        state.lootContainers = [...(state.lootContainers ?? []), container];
        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber,
          stepIndex,
          orderIndex,
          type: 'loot_created',
          actorId: actor.id,
          targetId: actor.id,
          message: `После падения ${actor.name} на земле остаётся мешочек с вещами.`,
          data: {
            sourceEntityId: actor.id,
            mode: 'pvp',
            itemCount: dropped.length,
            lootContainerId: container.id,
          },
        });
      }
    }

    this.refreshBattleResult(state);
  }

  private async applyCellAreaDamage(params: {
    session: CombatSession;
    state: ArenaBattleState;
    actor: ArenaBattleState['entities'][number];
    command: CombatCommand;
    guardStates: Map<string, CombatGuardState>;
    center: { x: number; y: number };
    radius: number;
    minDamage: number;
    maxDamage: number;
    damageKind: 'physical' | 'magical';
    stepIndex: number;
    orderIndex: number;
    sourceText: string;
  }): Promise<void> {
    const radius = Math.max(0, Math.floor(params.radius));
    const minDamage = Math.max(1, Math.floor(params.minDamage));
    const maxDamage = Math.max(minDamage, Math.floor(params.maxDamage));

    const targets = collectAreaEffectTargets({
      battleState: params.state,
      originCell: params.center,
      radius,
      shape: 'circle',
      casterId: params.actor.id,
    });

    for (const targetRef of targets) {
      const target = params.state.entities.find((entry) => entry.id === targetRef.entityId && entry.isAlive);
      if (!target) {
        continue;
      }

      const relationToCaster = getRelationToCaster({
        battleState: params.state,
        casterId: params.actor.id,
        targetId: target.id,
      });
      const isFriendlyFire = relationToCaster === 'self' || relationToCaster === 'ally' || relationToCaster === 'neutral';

      const damage = minDamage + Math.floor(Math.random() * (maxDamage - minDamage + 1));
      const guardState = params.guardStates.get(target.id);
      const mitigation = applyGuardMitigation({
        guardState,
        defender: target,
        incomingDamage: damage,
        damageKind: params.damageKind,
        attackCommandType: params.command.type,
        isProjectile: false,
      });

      if (mitigation.guardBroken) {
        this.breakGuardForActor({
          state: params.state,
          guardStates: params.guardStates,
          defender: target,
          stepIndex: params.stepIndex,
          orderIndex: params.orderIndex,
          commandId: params.command.id,
          brokenBy: 'heavy_attack',
          attackerId: params.actor.id,
        });
      }

      const finalDamage = mitigation.finalDamage;
      target.currentHp = Math.max(0, target.currentHp - finalDamage);
      target.isAlive = target.currentHp > 0;

      this.addCombatEvent(
        params.state,
        {
          id: randomUUID(),
          roundNumber: params.state.roundNumber,
          stepIndex: params.stepIndex,
          orderIndex: params.orderIndex,
          type: 'damage',
          actorId: params.actor.id,
          targetId: target.id,
          commandId: params.command.id,
          message: `${target.name} получает ${finalDamage} урона от эффекта ${params.sourceText}.${isFriendlyFire ? ' Friendly fire!' : ''}`,
          data: {
            amount: finalDamage,
            friendlyFire: isFriendlyFire,
            relationToCaster,
            radius,
            center: params.center,
            guardMitigation: {
              blocked: mitigation.blocked,
              partiallyBlocked: mitigation.partiallyBlocked,
            },
          },
        },
        {
          id: randomUUID(),
          roundNumber: params.state.roundNumber,
          stepIndex: params.stepIndex,
          type: 'damage_number',
          actorId: params.actor.id,
          targetId: target.id,
          value: finalDamage,
        },
      );

      if (!target.isAlive) {
        await this.processActorDeath({
          session: params.session,
          actor: target,
          sourceActorId: params.actor.id,
          roundNumber: params.state.roundNumber,
          stepIndex: params.stepIndex,
          orderIndex: params.orderIndex,
          commandId: params.command.id,
        });
      }
    }
  }

  private ensureResolvePlanForActor(session: CombatSession, actor: ArenaBattleState['entities'][number]): CombatTurnPlan {
    const existing = session.turnPlans.get(actor.id);
    if (existing && existing.commands.length > 0) {
      return existing;
    }

    if (actor.team === TeamSide.Right) {
      const npcPlan = this.buildNpcAiPlan(session, actor);
      session.turnPlans.set(actor.id, npcPlan);
      return npcPlan;
    }

    const guardStaminaCost = COMBAT_ACTION_COSTS.guard.stamina ?? 0;
    const fallback = createCombatCommandFromType({
      type: actor.currentStamina >= guardStaminaCost ? 'guard' : 'wait',
      target: { kind: 'self' },
    });
    const trusted = this.normalizeAuthoritativeCombatCommand({ rawCommand: fallback, actor, battleState: session.state });
    const fallbackPlan: CombatTurnPlan = {
      battleId: session.state.combatId,
      roundNumber: session.state.roundNumber,
      actorId: actor.id,
      commands: [trusted],
      ready: true,
      submittedAt: new Date().toISOString(),
    };
    session.turnPlans.set(actor.id, fallbackPlan);
    return fallbackPlan;
  }

  private createResolveSnapshot(session: CombatSession): CombatRoundResolveSnapshot {
    const aliveEntities = session.state.entities.filter((entity) => this.canActorPlan(session.state, entity));
    const actorPlans: Record<string, CombatTurnPlan> = {};

    for (const actor of aliveEntities) {
      const plan = this.ensureResolvePlanForActor(session, actor);
      actorPlans[actor.id] = {
        ...plan,
        commands: [...plan.commands],
        ready: true,
      };
    }

    return {
      battleId: session.state.combatId,
      roundNumber: session.state.roundNumber,
      startedAt: new Date().toISOString(),
      actorPlans,
    };
  }

  private collectCommandsForStep(params: {
    plans: Record<string, CombatTurnPlan>;
    stepIndex: number;
    battleState: ArenaBattleState;
  }): Array<{ actorId: string; command: CombatCommand }> {
    const entries: Array<{ actorId: string; command: CombatCommand }> = [];

    for (const [actorId, plan] of Object.entries(params.plans)) {
      const actor = params.battleState.entities.find((entity) => entity.id === actorId);
      if (!actor || !this.canActorPlan(params.battleState, actor)) {
        continue;
      }
      const command = plan.commands[params.stepIndex];
      if (!command) {
        continue;
      }
      entries.push({ actorId, command });
    }

    return entries;
  }

  private revalidateCommandForResolve(params: {
    state: ArenaBattleState;
    actor: ArenaBattleState['entities'][number];
    command: CombatCommand;
  }): CombatCommandRevalidationResult {
    return revalidateCombatCommandBeforeExecute({
      battleState: params.state,
      actorId: params.actor.id,
      command: params.command,
    });
  }

  private buildRevalidationFailureData(params: {
    state: ArenaBattleState;
    actor: ArenaBattleState['entities'][number];
    command: CombatCommand;
    reason: CombatRevalidationFailReason;
  }): Record<string, unknown> {
    const data: Record<string, unknown> = {
      reason: params.reason,
      error: this.resolveErrorToCode(params.reason),
    };

    if ((params.reason === 'target_out_of_range' || params.reason === 'target_too_close') && params.command.target.kind === 'entity') {
      const entityTarget = params.command.target;
      const target = params.state.entities.find((entity) => entity.id === entityTarget.entityId);
      if (target) {
        const currentDistance = getBattlefieldDistance(params.actor, target);
        const dynamicActor = params.actor as { minAttackRange?: number; minimumAttackRange?: number };
        const explicitSkillRange = params.command.type === 'skill_cast' ? params.command.payload?.skillRange : undefined;
        data.currentDistance = currentDistance;
        data.previousDistance = currentDistance;
        data.requiredRange = params.command.type === 'skill_cast' && typeof explicitSkillRange === 'number' && Number.isFinite(explicitSkillRange)
          ? Math.max(1, Math.floor(explicitSkillRange))
          : Math.max(1, Math.floor(params.actor.attackRange ?? 1));
        data.minimumRange = params.command.type === 'skill_cast'
          ? 1
          : Math.max(1, Math.floor(dynamicActor.minAttackRange ?? dynamicActor.minimumAttackRange ?? 1));
      }
    }

    return data;
  }

  private hasGuardBreakingControlFlag(entity: ArenaBattleState['entities'][number]): boolean {
    const flags = entity as {
      isStunned?: boolean;
      isKnockedDown?: boolean;
      isIncapacitated?: boolean;
      isFeared?: boolean;
      isSleeping?: boolean;
      hasEscaped?: boolean;
      isEscaped?: boolean;
      hasFled?: boolean;
    };

    return Boolean(
      flags.isStunned
      || flags.isKnockedDown
      || flags.isIncapacitated
      || flags.isFeared
      || flags.isSleeping
      || flags.hasEscaped
      || flags.isEscaped
      || flags.hasFled,
    );
  }

  private applyGuardStateForActor(params: {
    guardStates: Map<string, CombatGuardState>;
    actor: ArenaBattleState['entities'][number];
    guardType: 'guard' | 'strong_guard';
    roundNumber: number;
    stepIndex: number;
  }): CombatGuardState {
    const current = params.guardStates.get(params.actor.id);
    const next = createGuardState({
      type: params.guardType,
      roundNumber: params.roundNumber,
      stepIndex: params.stepIndex,
      actor: params.actor,
      previous: current,
    });
    params.guardStates.set(params.actor.id, next);
    return next;
  }

  private breakGuardForActor(params: {
    state: ArenaBattleState;
    guardStates: Map<string, CombatGuardState>;
    defender: ArenaBattleState['entities'][number];
    stepIndex: number;
    orderIndex: number;
    commandId?: string;
    brokenBy: 'heavy_attack' | 'control';
    attackerId?: string;
  }): void {
    const current = params.guardStates.get(params.defender.id);
    if (!current || current.broken) {
      return;
    }

    const broken = markGuardBroken(current);
    if (!broken) {
      return;
    }

    params.guardStates.set(params.defender.id, broken);
    this.addCombatEvent(params.state, {
      id: randomUUID(),
      roundNumber: params.state.roundNumber,
      stepIndex: params.stepIndex,
      orderIndex: params.orderIndex,
      type: 'guard_broken',
      actorId: params.defender.id,
      targetId: params.defender.id,
      commandId: params.commandId,
      message: params.brokenBy === 'heavy_attack'
        ? (current.type === 'guard'
            ? `Удар пробивает защитную стойку ${params.defender.name}.`
            : `Тяжёлый удар пробивает защитную стойку ${params.defender.name}.`)
        : `Защитная стойка ${params.defender.name} ломается под давлением контроля.`,
      data: {
        guardType: current.type,
        brokenBy: params.brokenBy,
        ...(params.attackerId ? { attackerId: params.attackerId } : {}),
      },
    });
  }

  private async executeImmediateCombatCommand(params: {
    session: CombatSession;
    actor: ArenaBattleState['entities'][number];
    command: CombatCommand;
    stepIndex?: number;
    orderIndex?: number;
  }): Promise<void> {
    const { session, actor, command } = params;
    const state = session.state;
    state.phase = 'animating';
    await this.executeResolveCommand({
      session,
      actor,
      command,
      stepIndex: params.stepIndex ?? 0,
      orderIndex: params.orderIndex ?? 0,
      guardStates: session.guardStates,
    });
    state.phase = state.isFinished ? 'finished' : 'acting';
  }

  private async executeResolveCommand(params: {
    session: CombatSession;
    actor: ArenaBattleState['entities'][number];
    command: CombatCommand;
    stepIndex: number;
    orderIndex: number;
    guardStates: Map<string, CombatGuardState>;
  }): Promise<void> {
    const { session, actor, command, stepIndex, orderIndex, guardStates } = params;
    const state = session.state;

    actor.currentStamina = Math.max(0, actor.currentStamina - (command.costs.stamina ?? 0));
    actor.currentMp = Math.max(0, actor.currentMp - (command.costs.mp ?? 0));
    actor.currentHp = Math.max(0, actor.currentHp - (command.costs.hp ?? 0));

    if (actor.currentHp <= 0) {
      await this.processActorDeath({
        session,
        actor,
        roundNumber: state.roundNumber,
        stepIndex,
        orderIndex,
        commandId: command.id,
      });
      return;
    }

    this.addCombatEvent(state, {
      id: randomUUID(),
      roundNumber: state.roundNumber,
      stepIndex,
      orderIndex,
      type: 'command_started',
      actorId: actor.id,
      commandId: command.id,
      message: command.type === 'wait'
        ? `${actor.name} waits and watches the battlefield.`
        : `${actor.name} начинает действие ${command.type}.`,
    });

    switch (command.type) {
      case 'move':
      case 'dash':
      case 'disengage': {
        if (command.target.kind !== 'cell') {
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'command_failed',
            actorId: actor.id,
            commandId: command.id,
            message: `${actor.name} не может выполнить перемещение: неверная цель.`,
            data: { reason: 'invalid_target' },
          });
          break;
        }

        const from = { x: actor.battlefieldX ?? 0, y: actor.battlefieldY ?? 0 };
        const to = { x: command.target.x, y: command.target.y };
        const isInside = to.x >= 0 && to.x < state.battleMapWidth && to.y >= 0 && to.y < state.battleMapHeight;
        const tile = state.battlefieldTiles.find((entry) => entry.x === to.x && entry.y === to.y);
        const isBlocked = tile?.blocksMovement === true
          || tile?.type === BattlefieldTileType.Blocked
          || tile?.type === BattlefieldTileType.HighCover
          || tile?.type === BattlefieldTileType.Summon;
        const isOccupied = state.entities.some((entry) => (
          entry.id !== actor.id
          && entry.isAlive
          && (entry.battlefieldX ?? 0) === to.x
          && (entry.battlefieldY ?? 0) === to.y
        ));

        if (!isInside || isBlocked || isOccupied) {
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'command_failed',
            actorId: actor.id,
            commandId: command.id,
            message: `${actor.name} не может сместиться в выбранную клетку.`,
            data: {
              reason: !isInside ? 'invalid_cell' : isBlocked ? 'cell_blocked' : 'cell_occupied',
            },
          });
          break;
        }

        actor.battlefieldX = to.x;
        actor.battlefieldY = to.y;
        const movementType = command.type === 'dash' ? 'dash' : command.type === 'disengage' ? 'disengage' : 'walk';
        const distance = this.getCellDistance(from, to);
        const resourceCost = this.withCommandResourceCost(command);
        this.addCombatEvent(
          state,
          {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'movement',
            actorId: actor.id,
            commandId: command.id,
            message: `${actor.name} moves closer to the enemy.`,
            data: { from, to, movementType, distance, resourceCost },
          },
          {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            type: 'move_token',
            actorId: actor.id,
            from,
            to,
            movementType,
          },
        );
        break;
      }
      case 'guard': {
        const guardState = this.applyGuardStateForActor({
          guardStates,
          actor,
          guardType: 'guard',
          roundNumber: state.roundNumber,
          stepIndex,
        });
        const guardAppliedMessage = actor.hasShield
          ? `${actor.name} поднимает щит и занимает защитную стойку.`
          : `${actor.name} сжимает оружие крепче и готовится принять удар.`;
        /* if (!anyRestore && effectLogs.length === 0) {
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'command_failed',
            actorId: actor.id,
            commandId: command.id,
            message: 'Ресурс уже полон.',
            data: { reason: 'item_no_effect_applied', itemId },
          });
          break;
        } */

        /* if (anyRestore) {
          const resource = restoredHp > 0 ? 'hp' : restoredMp > 0 ? 'mp' : 'stamina';
          const before = resource === 'hp' ? beforeHp : resource === 'mp' ? beforeMp : beforeStamina;
          const after = resource === 'hp' ? afterHp : resource === 'mp' ? afterMp : afterStamina;
          const amount = Math.max(0, after - before);
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'heal',
            actorId: actor.id,
            targetId: command.target.kind === 'entity' ? command.target.entityId : actor.id,
            commandId: command.id,
            message: `${actor.name} выпивает ${String(itemData?.name ?? itemId ?? 'предмет')} и восстанавливает ${amount} ${resource.toUpperCase()}.`,
            data: { resource, before, after, amount, itemId, itemInstanceId: command.payload?.itemInstanceId, source: 'item_use' },
          });
        } */

        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex,
          orderIndex,
          type: 'guard_applied',
          actorId: actor.id,
          commandId: command.id,
          message: guardAppliedMessage,
          data: {
            guardType: 'guard',
            blockChanceBonus: guardState.blockChanceBonus,
            physicalResistanceBonus: guardState.physicalResistanceBonus,
            magicResistanceBonus: guardState.magicResistanceBonus,
          },
        });
        break;
      }
      case 'strong_guard': {
        const guardState = this.applyGuardStateForActor({
          guardStates,
          actor,
          guardType: 'strong_guard',
          roundNumber: state.roundNumber,
          stepIndex,
        });
        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex,
          orderIndex,
          type: 'guard_applied',
          actorId: actor.id,
          commandId: command.id,
          message: `${actor.name} ставит ноги шире, поднимает щит и уходит в усиленную защитную стойку.`,
          data: {
            guardType: 'strong_guard',
            blockChanceBonus: guardState.blockChanceBonus,
            physicalResistanceBonus: guardState.physicalResistanceBonus,
            magicResistanceBonus: guardState.magicResistanceBonus,
          },
        });
        break;
      }
      case 'weapon_swap': {
        const nextWeaponId = command.payload?.weaponItemId ?? command.payload?.weaponInstanceId;
        if (!nextWeaponId) {
          // No weapon id — skip silently, cost already deducted by cost-deduction phase
          break;
        }

        const adminItem = this.contentService.listCollection('items').find((item) => item.id === nextWeaponId) ?? null;

        // Validate: item must be a weapon
        if (!adminItem || adminItem.type !== 'weapon') {
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'weapon_swap',
            actorId: actor.id,
            commandId: command.id,
            message: `${actor.name} потянулся за оружием, но в суматохе боя не сумел достать его вовремя.`,
          });
          break;
        }

        // Validate: not already equipped
        if (actor.activeWeaponItemId === nextWeaponId) {
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'weapon_swap',
            actorId: actor.id,
            commandId: command.id,
            message: `${actor.name} тянется за оружием — но оно уже в руке.`,
          });
          break;
        }

        const prevWeaponId = actor.activeWeaponItemId;
        const prevAdminWeapon = prevWeaponId ? (this.contentService.listCollection('items').find((item) => item.id === prevWeaponId) ?? null) : null;
        const isTwoHanded = adminItem.handsRequired === 2;
        const hadOffHand = Boolean(actor.offHandItemId);

        // Update entity weapon state
        actor.activeWeaponItemId = nextWeaponId;
        actor.attackRange = adminItem.attackRange;
        actor.combatStyleHint = adminItem.damageCategory === 'magic'
          ? 'MAGIC'
          : (typeof adminItem.attackRange === 'number' && adminItem.attackRange > 1 ? 'RANGED' : 'MELEE');
        actor.pierceTargets = adminItem.pierceTargets;
        actor.splashRadius = adminItem.splashRadius;
        actor.splashCenterMultiplier = adminItem.splashCenterMultiplier;
        actor.splashOuterMultiplier = adminItem.splashOuterMultiplier;

        // Two-handed weapon removes off-hand (shield)
        if (isTwoHanded) {
          actor.offHandItemId = null;
          actor.hasShield = false;
        }

        // Build contextual event message
        const prevIsRanged = prevAdminWeapon ? (typeof prevAdminWeapon.attackRange === 'number' && prevAdminWeapon.attackRange > 1) : false;
        const nextIsRanged = typeof adminItem.attackRange === 'number' && adminItem.attackRange > 1;
        let swapMessage: string;
        if (isTwoHanded && hadOffHand) {
          swapMessage = `${actor.name} убирает щит за спину и берёт ${adminItem.name} обеими руками.`;
        } else if (!prevIsRanged && nextIsRanged) {
          swapMessage = `${actor.name} убирает ${prevAdminWeapon?.name ?? 'оружие'} и достаёт ${adminItem.name}.`;
        } else if (prevIsRanged && !nextIsRanged) {
          swapMessage = `${actor.name} опускает ${prevAdminWeapon?.name ?? 'оружие'} и выхватывает ${adminItem.name}.`;
        } else {
          swapMessage = `${actor.name} убирает ${prevAdminWeapon?.name ?? 'оружие'} и берёт ${adminItem.name}.`;
        }

        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex,
          orderIndex,
          type: 'weapon_swap',
          actorId: actor.id,
          commandId: command.id,
          message: swapMessage,
          data: {
            previousWeaponId: prevWeaponId ?? null,
            newWeaponId: nextWeaponId,
            twoHandedEquipped: isTwoHanded,
            shieldCleared: isTwoHanded && hadOffHand,
          },
        });

        const eq = this.getActorEquipmentSnapshot(session, actor);
        session.equipmentByActorId.set(actor.id, { ...eq, weapon: nextWeaponId });
        break;
      }
      case 'basic_attack':
      case 'heavy_attack': {
        if (command.target.kind === 'entity') {
          const targetEntityId = command.target.entityId;
          const target = state.entities.find((entity) => entity.id === targetEntityId);
          if (!target || !target.isAlive) {
            break;
          }

          syncControlFlagsFromActiveStatuses(actor);
          syncControlFlagsFromActiveStatuses(target);

          const hitChance = clampHitChance(
            85
              + (actor.combatModifiers?.hitChancePercent ?? 0)
              - (target.combatModifiers?.dodgeChancePercent ?? 0)
              + getAttackerHitChanceDeltaFromStatuses(actor),
          );
          const hitRoll = this.rollUniform01() * 100;
          if (hitRoll > hitChance) {
            this.addCombatEvent(state, {
              id: randomUUID(),
              roundNumber: state.roundNumber,
              stepIndex,
              orderIndex,
              type: 'attack',
              actorId: actor.id,
              targetId: target.id,
              commandId: command.id,
              message: `${actor.name} промахивается по ${target.name} (шанс попадания ${hitChance}%).`,
              data: { hit: false, hitChancePercent: hitChance },
            });
            break;
          }

          let weaponDamageBonus = 0;
          if (actor.activeWeaponItemId) {
            const weapon = this.contentService.resolveItemById(actor.activeWeaponItemId);
            if (weapon) {
              const baseByRarity = weapon.rarity === 'rare' ? 6 : weapon.rarity === 'uncommon' ? 4 : 3;
              const bonusSum = (weapon.bonuses.strength ?? 0) + (weapon.bonuses.dexterity ?? 0) + (weapon.bonuses.intelligence ?? 0);
              weaponDamageBonus = baseByRarity + Math.floor(bonusSum * 0.5);
            }
          }
          let base = Math.max(1, Math.round(actor.strength * (command.type === 'heavy_attack' ? 1.25 : 0.9) + weaponDamageBonus));
          const outPct = actor.combatModifiers?.outgoingDamagePercent ?? 0;
          if (outPct !== 0) {
            base = Math.max(1, Math.round(base * (1 + outPct / 100)));
          }

          const critChance = Math.max(
            0,
            Math.min(
              95,
              5 + (actor.combatModifiers?.critChancePercent ?? 0) - (target.combatModifiers?.critChanceTakenPercent ?? 0),
            ),
          );
          const critRoll = this.rollUniform01() * 100;
          let isCrit = critRoll <= critChance;
          if (isCrit) {
            base = Math.max(1, Math.round(base * 1.5));
          }

          const guardState = guardStates.get(target.id);
          const mitigation = applyGuardMitigation({
            guardState,
            defender: target,
            incomingDamage: base,
            damageKind: 'physical',
            attackCommandType: command.type,
            isProjectile: (actor.attackRange ?? 1) > 1,
            random: this.rollUniform01.bind(this),
          });

          if (mitigation.guardBroken) {
            this.breakGuardForActor({
              state,
              guardStates,
              defender: target,
              stepIndex,
              orderIndex,
              commandId: command.id,
              brokenBy: 'heavy_attack',
              attackerId: actor.id,
            });
          }

          let damage = Math.max(0, mitigation.finalDamage);
          const inc = target.combatModifiers?.incomingPhysical;
          if (inc && (inc.percent !== 0 || inc.flat !== 0)) {
            damage = Math.max(0, Math.floor(damage * (1 + inc.percent / 100) + inc.flat));
          }
          damage = Math.max(1, damage);

          const hpBefore = target.currentHp;
          target.currentHp = Math.max(0, target.currentHp - damage);
          target.isAlive = target.currentHp > 0;
          const hpAfter = target.currentHp;

          this.addCombatEvent(
            state,
            {
              id: randomUUID(),
              roundNumber: state.roundNumber,
              stepIndex,
              orderIndex,
              type: 'damage',
              actorId: actor.id,
              targetId: target.id,
              commandId: command.id,
              message: isCrit
                ? `${actor.name} наносит критический удар: ${damage} урона цели ${target.name}.`
                : `${actor.name} наносит ${damage} урона цели ${target.name}.`,
              data: {
                amount: damage,
                blocked: mitigation.blocked,
                partiallyBlocked: mitigation.partiallyBlocked,
                guardBroken: mitigation.guardBroken,
                crit: isCrit,
                beforeHp: hpBefore,
                afterHp: hpAfter,
                finalDamage: damage,
                resourceCost: this.withCommandResourceCost(command),
              },
            },
            {
              id: randomUUID(),
              roundNumber: state.roundNumber,
              stepIndex,
              type: 'attack_bump',
              actorId: actor.id,
              targetId: target.id,
              hitEffectId: isCrit ? 'hit_blunt' : 'hit_slash',
              impactEffectId: 'impact_blood',
              damage,
              critical: isCrit,
            },
          );

          if (isCrit) {
            this.applyAttackStatusProcs({
              session,
              state,
              attacker: actor,
              target,
              trigger: 'on_crit',
              stepIndex,
              orderIndex,
              commandId: command.id,
            });
          }

          this.applyAttackStatusProcs({
            session,
            state,
            attacker: actor,
            target,
            trigger: 'on_hit',
            stepIndex,
            orderIndex,
            commandId: command.id,
          });

          this.applyLifestealFromAttack({
            session,
            state,
            actor,
            damageDealt: damage,
            stepIndex,
            orderIndex,
            commandId: command.id,
          });

          if (!target.isAlive) {
            await this.processActorDeath({
              session,
              actor: target,
              sourceActorId: actor.id,
              roundNumber: state.roundNumber,
              stepIndex,
              orderIndex,
              commandId: command.id,
            });
          }

          if (mitigation.blocked || mitigation.partiallyBlocked) {
            this.addCombatEvent(state, {
              id: randomUUID(),
              roundNumber: state.roundNumber,
              stepIndex,
              orderIndex,
              type: 'status_applied',
              actorId: target.id,
              targetId: target.id,
              commandId: command.id,
              message: mitigation.blocked
                ? `Удар глухо ложится в защиту ${target.name}, теряя большую часть силы.`
                : `${target.name} частично принимает удар на защиту.`,
              data: {
                kind: mitigation.blocked ? 'block' : 'partial_block',
                guardType: guardState?.type,
              },
            });
          }
        }
        break;
      }
      case 'skill_cast': {
        const skillId = typeof command.payload?.skillId === 'string' ? command.payload.skillId : '';
        if (!skillId) {
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'command_failed',
            actorId: actor.id,
            commandId: command.id,
            message: `${actor.name} не может использовать навык: не указан skillId.`,
            data: { reason: 'skill_missing' },
          });
          break;
        }

        const skillDef = this.skillRuntime.getSkillDefinition(skillId);
        if (!skillDef) {
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'command_failed',
            actorId: actor.id,
            commandId: command.id,
            message: `${actor.name} не может использовать навык ${skillId}: навык не найден.`,
            data: { reason: 'skill_not_found' },
          });
          break;
        }

        const skillLevel = Math.max(1, Math.floor(Number((command.payload as { skillLevel?: number } | undefined)?.skillLevel ?? 1)));
        const validation = await this.skillRuntime.validateSkillUse(actor.id, skillId, session.skillCooldowns, actor);
        if (!validation.valid) {
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'command_failed',
            actorId: actor.id,
            commandId: command.id,
            message: validation.reason ?? `${actor.name} не может использовать навык ${skillId}.`,
            data: { reason: 'skill_validation_failed', error: validation.reason },
          });
          break;
        }

        const targets: ArenaCombatEntity[] = [];
        if (command.target.kind === 'entity') {
          const entityTargetId = command.target.entityId;
          const target = state.entities.find((entry) => entry.id === entityTargetId && entry.isAlive);
          if (target) {
            targets.push(target);
          }
        } else if (command.target.kind === 'self') {
          targets.push(actor);
        } else if (command.target.kind === 'cell') {
          const radius = Math.max(1, Math.floor(Number((command.payload as { radius?: number } | undefined)?.radius ?? 1)));
          const center = { x: command.target.x, y: command.target.y };
          const areaTargets = collectAreaEffectTargets({
            battleState: state,
            originCell: center,
            radius,
            casterId: actor.id,
            shape: 'circle',
          });
          for (const entry of areaTargets) {
            const entity = state.entities.find((item) => item.id === entry.entityId && item.isAlive);
            if (entity) {
              targets.push(entity);
            }
          }
        }

        if (targets.length === 0) {
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'command_failed',
            actorId: actor.id,
            commandId: command.id,
            message: `${actor.name} не находит подходящую цель для навыка ${skillId}.`,
            data: { reason: 'target_missing' },
          });
          break;
        }

        const resourceTemplate = this.skillRuntime.resolveSkillExecution(skillDef, actor, targets[0] ?? null, skillLevel);
        if (resourceTemplate.resourcesSpent.mp) {
          actor.currentMp = Math.max(0, actor.currentMp - resourceTemplate.resourcesSpent.mp);
        }
        if (resourceTemplate.resourcesSpent.stamina) {
          actor.currentStamina = Math.max(0, actor.currentStamina - resourceTemplate.resourcesSpent.stamina);
        }
        if (resourceTemplate.resourcesSpent.hp) {
          actor.currentHp = Math.max(0, actor.currentHp - resourceTemplate.resourcesSpent.hp);
        }

        if (skillDef.cooldown.cooldownTurns > 0 || skillDef.cooldown.oncePerCombat) {
          const existing = session.skillCooldowns.find((entry) => entry.skillId === skillId);
          if (existing) {
            existing.remainingRounds = skillDef.cooldown.cooldownTurns;
            existing.oncePerCombat = skillDef.cooldown.oncePerCombat ?? existing.oncePerCombat;
          } else {
            session.skillCooldowns.push({
              skillId,
              remainingRounds: skillDef.cooldown.cooldownTurns,
              oncePerCombat: skillDef.cooldown.oncePerCombat ?? false,
            });
          }
        }

        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex,
          orderIndex,
          type: 'skill_cast',
          actorId: actor.id,
          commandId: command.id,
          message: command.target.kind === 'cell'
            ? `${actor.name} направляет ${skillId} в область.`
            : `${actor.name} использует навык ${skillId}.`,
          data: { targets: targets.map((target) => target.id) },
        });

        const skillVisuals = skillDef.visuals ?? {};
        state.recentAnimationEvents = [...(state.recentAnimationEvents ?? []), {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex,
          type: 'skill_cast',
          actorId: actor.id,
          targetId: targets[0]?.id,
          skillId,
          visualEffectId: skillVisuals.visualEffectId,
          castEffectId: skillVisuals.castEffectId,
          projectileEffectId: skillVisuals.projectileEffectId,
          impactEffectId: skillVisuals.impactEffectId,
          hitEffectId: skillVisuals.hitEffectId,
          cameraShakePreset: skillVisuals.cameraShakePreset,
          cameraShake: skillVisuals.cameraShakePreset,
          castSoundId: skillVisuals.castSoundId,
          impactSoundId: skillVisuals.impactSoundId,
        }];

        for (const target of targets) {
          const execution = this.skillRuntime.resolveSkillExecution(skillDef, actor, target, skillLevel);

          for (const dmg of execution.damageDone) {
            const dmgTarget = state.entities.find((entity) => entity.id === dmg.targetId);
            if (!dmgTarget || !dmgTarget.isAlive) {
              continue;
            }

            const damage = Math.max(0, Math.floor(dmg.amount));
            if (damage <= 0) {
              continue;
            }
            dmgTarget.currentHp = Math.max(0, dmgTarget.currentHp - damage);
            dmgTarget.isAlive = dmgTarget.currentHp > 0;

            this.addCombatEvent(
              state,
              {
                id: randomUUID(),
                roundNumber: state.roundNumber,
                stepIndex,
                orderIndex,
                type: 'damage',
                actorId: actor.id,
                targetId: dmgTarget.id,
                commandId: command.id,
                message: `${actor.name} наносит ${damage} урона навыком ${skillId} цели ${dmgTarget.name}.`,
                data: { amount: damage, skillId },
              },
              {
                id: randomUUID(),
                roundNumber: state.roundNumber,
                stepIndex,
                type: command.target.kind === 'entity' ? 'projectile' : 'damage_number',
                actorId: actor.id,
                targetId: dmgTarget.id,
                skillId,
                visualEffectId: skillVisuals.visualEffectId,
                castEffectId: skillVisuals.castEffectId,
                projectileEffectId: skillVisuals.projectileEffectId,
                impactEffectId: skillVisuals.impactEffectId,
                hitEffectId: skillVisuals.hitEffectId,
                cameraShakePreset: skillVisuals.cameraShakePreset,
                cameraShake: skillVisuals.cameraShakePreset,
                castSoundId: skillVisuals.castSoundId,
                impactSoundId: skillVisuals.impactSoundId,
                value: damage,
                damage,
              },
            );

            if (command.target.kind === 'entity') {
              state.recentAnimationEvents = [...(state.recentAnimationEvents ?? []), {
                id: randomUUID(),
                roundNumber: state.roundNumber,
                stepIndex,
                type: 'damage_number',
                actorId: actor.id,
                targetId: dmgTarget.id,
                skillId,
                visualEffectId: skillVisuals.visualEffectId,
                impactEffectId: skillVisuals.impactEffectId,
                hitEffectId: skillVisuals.hitEffectId,
                cameraShakePreset: skillVisuals.cameraShakePreset,
                cameraShake: skillVisuals.cameraShakePreset,
                impactSoundId: skillVisuals.impactSoundId,
                value: damage,
                damage,
              }];
            }

            if (!dmgTarget.isAlive) {
              await this.processActorDeath({
                session,
                actor: dmgTarget,
                sourceActorId: actor.id,
                roundNumber: state.roundNumber,
                stepIndex,
                orderIndex,
                commandId: command.id,
              });
            }
          }

          for (const heal of execution.healingDone) {
            const healTarget = state.entities.find((entity) => entity.id === heal.targetId && entity.isAlive);
            if (!healTarget) {
              continue;
            }
            const amount = Math.max(0, Math.floor(heal.amount));
            if (amount <= 0) {
              continue;
            }
            const restored = Math.max(0, Math.min(healTarget.maxHp - healTarget.currentHp, amount));
            if (restored <= 0) {
              continue;
            }
            healTarget.currentHp += restored;

            this.addCombatEvent(
              state,
              {
                id: randomUUID(),
                roundNumber: state.roundNumber,
                stepIndex,
                orderIndex,
                type: 'heal',
                actorId: actor.id,
                targetId: healTarget.id,
                commandId: command.id,
                message: `${actor.name} восстанавливает ${restored} HP цели ${healTarget.name} навыком ${skillId}.`,
                data: { amount: restored, skillId },
              },
              {
                id: randomUUID(),
                roundNumber: state.roundNumber,
                stepIndex,
                type: 'heal_number',
                actorId: actor.id,
                targetId: healTarget.id,
                skillId,
                visualEffectId: skillVisuals.visualEffectId,
                impactEffectId: skillVisuals.impactEffectId,
                cameraShakePreset: skillVisuals.cameraShakePreset,
                cameraShake: skillVisuals.cameraShakePreset,
                impactSoundId: skillVisuals.impactSoundId,
                value: restored,
              },
            );
          }

          for (const applied of execution.effectsApplied) {
            this.addCombatEvent(state, {
              id: randomUUID(),
              roundNumber: state.roundNumber,
              stepIndex,
              orderIndex,
              type: 'status_applied',
              actorId: actor.id,
              targetId: applied.targetId,
              commandId: command.id,
              message: `${actor.name} накладывает ${applied.effectType} на цель.`,
              data: {
                effectType: applied.effectType,
                durationTurns: applied.durationTurns,
                skillId,
              },
            });
          }
        }
        break;
      }
      case 'item_use': {
        let usedBomb = false;
        const itemId = command.payload?.itemId;
        const item = itemId
          ? (() => {
            try {
              return this.contentService.resolveItemById(itemId);
            } catch {
              return null;
            }
          })()
          : null;
        const adminItem = typeof itemId === 'string'
          ? (() => {
            try {
              return this.contentService.resolveAdminItemById(itemId);
            } catch {
              return null;
            }
          })()
          : null;
        const itemData = (adminItem ?? item) as unknown as Record<string, unknown> | null;
        const itemSubType = String(itemData?.itemSubType ?? item?.itemSubType ?? '').toLowerCase();

        if (command.target.kind === 'cell' && (itemSubType.includes('bomb') || itemSubType.includes('grenade'))) {
          usedBomb = true;
          const radius = Math.max(1, Math.floor(Number(itemData?.splashRadius ?? 1)));
          const minDamage = Math.max(1, Math.floor(Number(itemData?.damageMin ?? Math.max(1, Math.round(actor.strength * 0.8)))));
          const maxDamage = Math.max(minDamage, Math.floor(Number(itemData?.damageMax ?? Math.max(minDamage, Math.round(actor.strength * 1.25)))));
          const center = { x: command.target.x, y: command.target.y };

          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'item_used',
            actorId: actor.id,
            commandId: command.id,
            message: `${actor.name} бросает бомбу в клетку ${center.x + 1}:${center.y + 1}.`,
            data: { radius },
          });

          await this.applyCellAreaDamage({
            session,
            state,
            actor,
            command,
            guardStates,
            center,
            radius,
            minDamage,
            maxDamage,
            damageKind: 'physical',
            stepIndex,
            orderIndex,
            sourceText: 'bomb',
          });
        }

        if (usedBomb) {
          if (typeof itemId === 'string' && actor.id === session.playerId) {
            await this.consumeCombatItemCharge(actor.id, itemId);
          }
          break;
        }

        const effects = this.normalizeItemEffects(item, itemData);
        if (effects.length === 0) {
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'command_failed',
            actorId: actor.id,
            commandId: command.id,
            message: `${actor.name} не может использовать предмет: нет боевых эффектов.`,
            data: { reason: 'item_no_effects' },
          });
          break;
        }

        if (command.target.kind === 'cell') {
          const radius = Math.max(1, Math.floor(Number(itemData?.splashRadius ?? itemData?.areaRadius ?? 1)));
          const center = { x: command.target.x, y: command.target.y };
          const targets = state.entities.filter((entity) => {
            if (!entity.isAlive) {
              return false;
            }
            const distance = this.getCellDistance({ x: entity.battlefieldX ?? 0, y: entity.battlefieldY ?? 0 }, center);
            return distance <= radius;
          });

          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'item_used',
            actorId: actor.id,
            commandId: command.id,
            message: `${actor.name} использует предмет по области (${targets.length} целей).`,
            data: { radius, targets: targets.map((target) => target.id) },
          });

          for (const target of targets) {
            for (const effect of effects) {
              const amount = Math.max(0, Math.floor(effect.amount));
              if (effect.type === 'damage_target') {
                if (amount <= 0) {
                  continue;
                }
                target.currentHp = Math.max(0, target.currentHp - amount);
                target.isAlive = target.currentHp > 0;
                this.addCombatEvent(
                  state,
                  {
                    id: randomUUID(),
                    roundNumber: state.roundNumber,
                    stepIndex,
                    orderIndex,
                    type: 'damage',
                    actorId: actor.id,
                    targetId: target.id,
                    commandId: command.id,
                    message: `${actor.name} наносит ${amount} урона предметом цели ${target.name}.`,
                    data: { amount, itemId },
                  },
                  {
                    id: randomUUID(),
                    roundNumber: state.roundNumber,
                    stepIndex,
                    type: 'damage_number',
                    actorId: actor.id,
                    targetId: target.id,
                    value: amount,
                  },
                );
                if (!target.isAlive) {
                  await this.processActorDeath({
                    session,
                    actor: target,
                    sourceActorId: actor.id,
                    roundNumber: state.roundNumber,
                    stepIndex,
                    orderIndex,
                    commandId: command.id,
                  });
                }
                continue;
              }

              if (effect.type === 'heal_hp') {
                const restored = Math.max(0, Math.min(target.maxHp - target.currentHp, amount));
                if (restored > 0) {
                  target.currentHp += restored;
                  this.addCombatEvent(
                    state,
                    {
                      id: randomUUID(),
                      roundNumber: state.roundNumber,
                      stepIndex,
                      orderIndex,
                      type: 'heal',
                      actorId: actor.id,
                      targetId: target.id,
                      commandId: command.id,
                      message: `${actor.name} восстанавливает ${restored} HP цели ${target.name} предметом.`,
                      data: { amount: restored, itemId },
                    },
                    {
                      id: randomUUID(),
                      roundNumber: state.roundNumber,
                      stepIndex,
                      type: 'heal_number',
                      actorId: actor.id,
                      targetId: target.id,
                      value: restored,
                    },
                  );
                }
                continue;
              }

              if (effect.type === 'restore_mana') {
                const restored = Math.max(0, Math.min(target.maxMp - target.currentMp, amount));
                target.currentMp += restored;
                continue;
              }

              if (effect.type === 'restore_stamina') {
                const restored = Math.max(0, Math.min(target.maxStamina - target.currentStamina, amount));
                target.currentStamina += restored;
                continue;
              }
            }
          }
          if (typeof itemId === 'string' && actor.id === session.playerId) {
            await this.consumeCombatItemCharge(actor.id, itemId);
          }
          break;
        }

        const targetId = command.target.kind === 'entity'
          ? command.target.entityId
          : actor.id;

        const statusTargetEntity = state.entities.find((e) => e.id === targetId && e.isAlive);
        if (statusTargetEntity && itemData) {
          const rawItemEffects = this.extractItemEffectsFromContentPayload(itemData);
          const prof = this.buildTargetStatusDefenseProfile(session, statusTargetEntity);
          const ctx = {
            stepIndex,
            orderIndex,
            commandId: command.id,
            attackerId: actor.id,
            targetId: statusTargetEntity.id,
          };
          for (const eff of rawItemEffects) {
            if (eff.type !== 'apply_status') {
              continue;
            }
            const tr = eff.trigger;
            if (tr && tr !== 'on_use' && tr !== 'always') {
              continue;
            }
            const result = tryApplyCombatStatus({
              effect: eff,
              target: statusTargetEntity,
              targetDefenseProfile: prof,
              sourceActorId: actor.id,
              sourceItemId: typeof itemId === 'string' ? itemId : undefined,
              rng: () => this.rollUniform01(),
              rollChance: true,
            });
            if (result.outcome !== 'skipped' || result.messageRu) {
              this.emitTryApplyStatusResult(state, ctx, result);
            }
            syncControlFlagsFromActiveStatuses(statusTargetEntity);
          }
        }

        const beforeTarget = state.entities.find((e) => e.id === targetId) ?? null;
        const beforeHp = beforeTarget ? beforeTarget.currentHp : actor.currentHp;
        const beforeMp = beforeTarget ? beforeTarget.currentMp : actor.currentMp;
        const beforeStamina = beforeTarget ? beforeTarget.currentStamina : actor.currentStamina;

        const effectLogs = effects.flatMap((effect) => this.applyItemEffect(effect, actor, state, state.roundNumber, targetId));

        const afterTarget = state.entities.find((e) => e.id === targetId) ?? null;
        const afterHp = afterTarget ? afterTarget.currentHp : actor.currentHp;
        const afterMp = afterTarget ? afterTarget.currentMp : actor.currentMp;
        const afterStamina = afterTarget ? afterTarget.currentStamina : actor.currentStamina;

        const restoredHp = Math.max(0, afterHp - beforeHp);
        const restoredMp = Math.max(0, afterMp - beforeMp);
        const restoredStamina = Math.max(0, afterStamina - beforeStamina);
        const anyRestore = restoredHp > 0 || restoredMp > 0 || restoredStamina > 0;
        const anyEffect = anyRestore || effectLogs.length > 0;

        if (!anyEffect) {
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'command_failed',
            actorId: actor.id,
            commandId: command.id,
            message: 'Ресурс уже полон.',
            data: { reason: 'item_no_effect_applied', itemId },
          });
          break;
        }

        if (anyRestore) {
          const resource = restoredHp > 0 ? 'hp' : restoredMp > 0 ? 'mp' : 'stamina';
          const before = resource === 'hp' ? beforeHp : resource === 'mp' ? beforeMp : beforeStamina;
          const after = resource === 'hp' ? afterHp : resource === 'mp' ? afterMp : afterStamina;
          const amount = Math.max(0, after - before);
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'heal',
            actorId: actor.id,
            targetId,
            commandId: command.id,
            message: `${actor.name} выпивает ${String(itemData?.name ?? itemId ?? 'предмет')} и восстанавливает ${amount} ${resource.toUpperCase()}.`,
            data: { resource, before, after, amount, itemId, itemInstanceId: command.payload?.itemInstanceId, source: 'item_use' },
          });
        }
        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex,
          orderIndex,
          type: 'item_used',
          actorId: actor.id,
          commandId: command.id,
          targetId: command.target.kind === 'entity' ? command.target.entityId : actor.id,
          message: effectLogs[0]?.text ?? `${actor.name} использует предмет.`,
          data: { itemId, effects: effects.map((effect) => effect.type) },
        });
        if (typeof itemId === 'string' && actor.id === session.playerId) {
          await this.consumeCombatItemCharge(actor.id, itemId);
        }
        break;
      }
      case 'loot': {
        await this.claimLootContainerForActor({
          state,
          actor,
          command,
          stepIndex,
          orderIndex,
        });
        break;
      }
      case 'start_retreat': {
        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex,
          orderIndex,
          type: 'escape_started',
          actorId: actor.id,
          commandId: command.id,
          message: `${actor.name} добрался до выхода и пытается покинуть бой.`,
        });
        break;
      }
      case 'wait':
      default:
        break;
    }
  }

  private async resolveCombatRoundByPlans(session: CombatSession): Promise<void> {
    const state = session.state;
    const snapshot = this.createResolveSnapshot(session);
    state.resolveSnapshot = snapshot;
    state.roundPhase = 'RESOLVING';
    state.phase = 'resolving';
    state.recentCombatEvents = [];
    state.recentAnimationEvents = [];

    for (const entity of state.entities) {
      syncControlFlagsFromActiveStatuses(entity);
    }
    await this.applyPeriodicDamagePhase(session, 'turn_start', 0, -1);

    const guardStates = new Map<string, CombatGuardState>();
    const interruptedActorIds = new Set<string>();

    for (let stepIndex = 0; stepIndex < HARD_MAX_COMMANDS_PER_ROUND; stepIndex += 1) {
      if (state.isFinished) {
        break;
      }

      for (const [actorId, plan] of Object.entries(snapshot.actorPlans)) {
        if (interruptedActorIds.has(actorId)) {
          continue;
        }
        const actor = state.entities.find((entity) => entity.id === actorId);
        const hasRemainingCommands = plan.commands.slice(stepIndex).length > 0;
        if (!actor || !this.canActorPlan(state, actor)) {
          if (hasRemainingCommands) {
            const firstRemaining = plan.commands[stepIndex] ?? plan.commands.find((command) => Boolean(command));
            this.addCombatEvent(state, {
              id: randomUUID(),
              roundNumber: state.roundNumber,
              stepIndex,
              orderIndex: -1,
              type: 'command_failed',
              actorId,
              commandId: firstRemaining?.id,
              message: `План бойца ${actorId} обрывается: он уже не может действовать.`,
              data: { reason: 'actor_dead' },
            });
            interruptedActorIds.add(actorId);
          }
        }
      }

      const commands = this.collectCommandsForStep({
        plans: snapshot.actorPlans,
        stepIndex,
        battleState: state,
      })
        .map((entry) => {
          const actor = state.entities.find((entity) => entity.id === entry.actorId);
          return actor ? { ...entry, actor } : null;
        })
        .filter((entry): entry is { actorId: string; command: CombatCommand; actor: ArenaBattleState['entities'][number] } => Boolean(entry))
        .sort((left, right) => {
          const leftInitiative = calculateCommandInitiative({
            actor: left.actor,
            command: left.command,
            battleState: state,
            stepIndex,
            randomRoll: this.rollCombatRandom(),
          });
          const rightInitiative = calculateCommandInitiative({
            actor: right.actor,
            command: right.command,
            battleState: state,
            stepIndex,
            randomRoll: this.rollCombatRandom(),
          });

          if (leftInitiative !== rightInitiative) {
            return rightInitiative - leftInitiative;
          }
          if (left.actor.dexterity !== right.actor.dexterity) {
            return right.actor.dexterity - left.actor.dexterity;
          }
          if (left.actor.perception !== right.actor.perception) {
            return right.actor.perception - left.actor.perception;
          }
          if (left.actor.luck !== right.actor.luck) {
            return right.actor.luck - left.actor.luck;
          }
          return left.actor.id.localeCompare(right.actor.id);
        });

      for (let orderIndex = 0; orderIndex < commands.length; orderIndex += 1) {
        const item = commands[orderIndex]!;
        if (!this.canActorPlan(state, item.actor) || state.isFinished) {
          continue;
        }

        if (this.hasGuardBreakingControlFlag(item.actor)) {
          this.breakGuardForActor({
            state,
            guardStates,
            defender: item.actor,
            stepIndex,
            orderIndex,
            brokenBy: 'control',
          });
        }

        const validation = this.revalidateCommandForResolve({ state, actor: item.actor, command: item.command });
        if (!validation.ok) {
          const reason = validation.reason ?? 'unknown';
          const strongGuardStaminaFail = item.command.type === 'strong_guard' && reason === 'not_enough_stamina';
          const guardStaminaFail = item.command.type === 'guard' && reason === 'not_enough_stamina';
          state.logs.push({
            round: state.roundNumber,
            actorId: item.actor.id,
            targetId: item.command.target.kind === 'entity' ? item.command.target.entityId : undefined,
            type: 'INFO',
            text: `[AI DEBUG] command_failed actor=${item.actor.name} command=${item.command.type} reason=${reason}`,
          });
          this.addCombatEvent(state, {
            id: randomUUID(),
            roundNumber: state.roundNumber,
            stepIndex,
            orderIndex,
            type: 'command_failed',
            actorId: item.actor.id,
            targetId: item.command.target.kind === 'entity' ? item.command.target.entityId : undefined,
            commandId: item.command.id,
            message: strongGuardStaminaFail
              ? `${item.actor.name} хотел поднять щит выше, но руки уже дрожали от усталости.`
              : (guardStaminaFail
                ? `${item.actor.name} хотел поднять щит, но сил уже не хватило.`
                : (validation.message ?? `${item.actor.name} не смог выполнить ${item.command.type}.`)),
            data: this.buildRevalidationFailureData({
              state,
              actor: item.actor,
              command: item.command,
              reason,
            }),
          });
          continue;
        }

        await this.executeResolveCommand({
          session,
          actor: item.actor,
          command: item.command,
          stepIndex,
          orderIndex,
          guardStates,
        });

        this.refreshBattleResult(state);
      }
    }

    // Strong guard grants end-round recovery only if stance survived and actor is able to recover.
    for (const entity of state.entities) {
      const guardState = guardStates.get(entity.id);
      if (!entity.isAlive || !guardState || guardState.type !== 'strong_guard') {
        continue;
      }

      if (this.hasGuardBreakingControlFlag(entity)) {
        this.breakGuardForActor({
          state,
          guardStates,
          defender: entity,
          stepIndex: HARD_MAX_COMMANDS_PER_ROUND,
          orderIndex: 0,
          brokenBy: 'control',
        });
        continue;
      }

      if (guardState.broken) {
        continue;
      }

      const regen = calculateGuardEndRoundRegen({
        guardState,
        maxHp: entity.maxHp,
        maxMp: entity.maxMp,
        maxStamina: entity.maxStamina,
      });

      const hp = Math.max(0, Math.min(entity.maxHp - entity.currentHp, regen.hp));
      const mp = Math.max(0, Math.min(entity.maxMp - entity.currentMp, regen.mp));
      const stamina = Math.max(0, Math.min(entity.maxStamina - entity.currentStamina, regen.stamina));

      if (hp <= 0 && mp <= 0 && stamina <= 0) {
        continue;
      }

      entity.currentHp = Math.min(entity.maxHp, entity.currentHp + hp);
      entity.currentMp = Math.min(entity.maxMp, entity.currentMp + mp);
      entity.currentStamina = Math.min(entity.maxStamina, entity.currentStamina + stamina);

      this.addCombatEvent(state, {
        id: randomUUID(),
        roundNumber: state.roundNumber,
        stepIndex: HARD_MAX_COMMANDS_PER_ROUND,
        orderIndex: 0,
        type: 'guard_regen',
        actorId: entity.id,
        message: `${entity.name} удерживает стойку и восстанавливает дыхание.`,
        data: {
          hpRestored: hp,
          mpRestored: mp,
          staminaRestored: stamina,
        },
      });
    }

    await this.applyPeriodicDamagePhase(session, 'turn_end', HARD_MAX_COMMANDS_PER_ROUND, 0);
    this.tickAllCombatStatusesEndOfRound(session, HARD_MAX_COMMANDS_PER_ROUND, 0);

    // Уменьшаем кулдауны скиллов в конце раунда
    for (const cooldown of session.skillCooldowns) {
      if (cooldown.remainingRounds > 0) {
        cooldown.remainingRounds -= 1;
      }
    }

    this.applyEndOfRoundRegeneration(state);
    this.refreshBattleResult(state);

    const roundDamage = state.logs
      .filter((entry) => entry.round === state.roundNumber && entry.type === 'HIT' && entry.actorId === session.playerId)
      .reduce((sum, entry) => sum + Math.max(0, entry.amount ?? 0), 0);
    session.damageContribution += roundDamage;

    if (state.isFinished && state.winner === TeamSide.Left) {
      const rewards = await this.applyVictoryRewards(session.playerId, state, session.damageContribution);

      if (rewards.progression.gainedExp > 0) {
        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex: HARD_MAX_COMMANDS_PER_ROUND,
          orderIndex: 0,
          type: 'round_end',
          actorId: session.playerId,
          message: `Battle reward: +${rewards.progression.gainedExp} EXP`,
          data: { gainedExp: rewards.progression.gainedExp },
        });
      }

      if (rewards.progression.levelsGained > 0) {
        const playerEntity = state.entities.find((entity) => entity.id === session.playerId);
        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex: HARD_MAX_COMMANDS_PER_ROUND,
          orderIndex: 0,
          type: 'round_end',
          actorId: session.playerId,
          message: `${playerEntity?.name ?? 'Player'} levels up! +${rewards.progression.levelsGained * 5} free stat points`,
          data: { levelsGained: rewards.progression.levelsGained },
        });
      }

      if (rewards.gainedGold > 0) {
        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex: HARD_MAX_COMMANDS_PER_ROUND,
          orderIndex: 0,
          type: 'round_end',
          actorId: session.playerId,
          message: `Battle reward: +${rewards.gainedGold} gold`,
          data: { gainedGold: rewards.gainedGold },
        });
      }

      if (rewards.itemName) {
        this.addCombatEvent(state, {
          id: randomUUID(),
          roundNumber: state.roundNumber,
          stepIndex: HARD_MAX_COMMANDS_PER_ROUND,
          orderIndex: 0,
          type: 'round_end',
          actorId: session.playerId,
          message: `Battle reward: loot ${rewards.itemName}`,
          data: { itemName: rewards.itemName },
        });
      }
    }

    if (!state.isFinished) {
      state.roundNumber += 1;
      this.primeRoundPlanning(session);
      this.syncTurnPlanState(session);
    } else {
      if (state.winner === TeamSide.Left) {
        await this.claimAllAvailableLootForActor(state, session.playerId);
      }
      state.roundPhase = undefined;
      state.phase = 'finished';
      state.readyActorIds = [];
      state.pendingActorIds = [];
    }
  }

  private async tryResolveWhenAllReady(session: CombatSession): Promise<void> {
    if (session.state.isFinished || session.state.roundPhase !== 'PLANNING') {
      return;
    }

    const controllableActors = this.getLivingControllableActors(session.state, session.playerId);
    const allReady = controllableActors.every((entity) => session.turnPlans.get(entity.id)?.ready);
    if (!allReady) {
      return;
    }

    for (const aiActor of this.getLivingAiActors(session.state)) {
      // Rebuild AI plans from the latest state so NPCs react to player movement/actions this round.
      session.turnPlans.set(aiActor.id, this.buildNpcAiPlan(session, aiActor));
    }

    this.syncTurnPlanState(session);

    await this.resolveCombatRoundByPlans(session);
  }

  private primeRoundPlanning(session: CombatSession): void {
    const { state } = session;

    session.plannedActions.clear();
    session.turnPlans.clear();

    if (state.isFinished) {
      state.roundPhase = undefined;
      state.phase = 'finished';
      state.readyActorIds = [];
      state.pendingActorIds = [];
      return;
    }

    state.roundPhase = 'PLANNING';
    state.phase = 'planning';

    const aliveEntities = state.entities.filter((entity) => this.canActorPlan(state, entity));
    for (const entity of aliveEntities) {
      if (entity.team === TeamSide.Right) {
        session.plannedActions.set(entity.id, createNpcAction(state, entity.id));

        const npcPlan = this.buildNpcAiPlan(session, entity);
        session.turnPlans.set(entity.id, npcPlan);
      } else {
        session.turnPlans.set(entity.id, {
          battleId: state.combatId,
          roundNumber: state.roundNumber,
          actorId: entity.id,
          commands: [],
          ready: false,
        });
      }
    }

    state.readyActorIds = [];
    state.pendingActorIds = this.getLivingControllableActors(state, session.playerId).map((entity) => entity.id);
    this.syncSubmittedPlansState(session);
    state.turnStartedAt = new Date().toISOString();
    state.roundDurationSeconds = DEFAULT_ROUND_DURATION_SECONDS;
    state.turnDeadlineAt = new Date(Date.now() + state.roundDurationSeconds * 1000).toISOString();
  }

  private buildNpcAiPlan(session: CombatSession, actor: ArenaBattleState['entities'][number]): CombatTurnPlan {
    const state = session.state;
    const limits = this.getCombatRoundLimitsForActor(actor);
    const commands: CombatCommand[] = [];
    const debugNotes: string[] = [];
    let rejectReason = 'none';

    const enemies = state.entities
      .filter((entity) => entity.team !== actor.team && this.canActorPlan(state, entity))
      .sort((left, right) => {
        const leftPreferred = left.id === session.playerId ? 0 : 1;
        const rightPreferred = right.id === session.playerId ? 0 : 1;
        if (leftPreferred !== rightPreferred) {
          return leftPreferred - rightPreferred;
        }

        const leftDistance = getBattlefieldDistance(actor, left);
        const rightDistance = getBattlefieldDistance(actor, right);
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }

        const leftHpRatio = left.currentHp / Math.max(1, left.maxHp);
        const rightHpRatio = right.currentHp / Math.max(1, right.maxHp);
        return leftHpRatio - rightHpRatio;
      });

    const target = enemies[0];
    const attackRange = Math.max(1, Math.floor(actor.attackRange ?? 1));
    if (!target) {
      debugNotes.push('no_target');
    }

    if (target) {
      const distanceToTarget = getBattlefieldDistance(actor, target);
      debugNotes.push(`dist=${distanceToTarget}`);

      if (distanceToTarget <= attackRange) {
        while (commands.length < limits.maxCommands) {
          const attackCommand = createCombatCommandFromType({
            type: 'basic_attack',
            target: { kind: 'entity', entityId: target.id },
            payload: { targetZone: TargetZone.Chest },
          });

          const validation = canAppendCombatCommand({
            actor,
            currentCommands: commands,
            nextCommand: attackCommand,
            battleState: state,
            limits,
          });

          if (!validation.ok) {
            rejectReason = validation.errors[0] ?? 'attack_validation_failed';
            break;
          }

          commands.push(attackCommand);
        }
      } else {
        const maxMoveDistance = actor.currentStamina >= (COMBAT_ACTION_COSTS.dash_3_cells.stamina ?? 0)
          ? 3
          : actor.currentStamina >= (COMBAT_ACTION_COSTS.move_2_cells.stamina ?? 0)
            ? 2
            : actor.currentStamina >= (COMBAT_ACTION_COSTS.move_1_cell.stamina ?? 0)
              ? 1
              : 0;
        debugNotes.push(`moveBudget=${maxMoveDistance}`);

        const reachable = maxMoveDistance > 0
          ? getReachableBattlefieldTiles(state, actor.id, maxMoveDistance)
          : [];
        const bestCell = reachable
          .map((cell) => ({
            ...cell,
            distanceToTarget: Math.abs((target.battlefieldX ?? 0) - cell.x) + Math.abs((target.battlefieldY ?? 0) - cell.y),
          }))
          .sort((left, right) => {
            if (left.distanceToTarget !== right.distanceToTarget) {
              return left.distanceToTarget - right.distanceToTarget;
            }
            return left.distance - right.distance;
          })[0];

        if (bestCell) {
          const moveType = bestCell.distance >= 3 && maxMoveDistance >= 3 ? 'dash' : 'move';
          debugNotes.push(`move=${moveType}@${bestCell.x}:${bestCell.y}`);
          const moveCommand = createCombatCommandFromType({
            type: moveType,
            target: { kind: 'cell', x: bestCell.x, y: bestCell.y },
            payload: { movementType: moveType === 'dash' ? 'dash' : 'walk' },
          });

          const moveValidation = canAppendCombatCommand({
            actor,
            currentCommands: commands,
            nextCommand: moveCommand,
            battleState: state,
            limits,
          });

          if (moveValidation.ok) {
            commands.push(moveCommand);
          } else {
            rejectReason = moveValidation.errors[0] ?? 'move_validation_failed';
          }
        } else if (maxMoveDistance <= 0) {
          rejectReason = 'NOT_ENOUGH_STAMINA';
          debugNotes.push('no_stamina_for_move');
        } else {
          debugNotes.push('no_reachable_cell');
        }
      }
    }

    if (commands.length === 0) {
      const guardCommand = createCombatCommandFromType({
        type: 'guard',
        target: { kind: 'self' },
      });
      const guardValidation = canAppendCombatCommand({
        actor,
        currentCommands: commands,
        nextCommand: guardCommand,
        battleState: state,
        limits,
      });
      if (guardValidation.ok) {
        commands.push(guardCommand);
        debugNotes.push('fallback=guard');
      } else {
        commands.push(createCombatCommandFromType({ type: 'wait', target: { kind: 'self' } }));
        rejectReason = guardValidation.errors[0] ?? 'guard_validation_failed';
        debugNotes.push('fallback=wait');
      }
    }

    const totalAp = commands.reduce((sum, command) => sum + Math.max(0, command.apCost), 0);
    const planned = commands.map((command) => command.type).join(' -> ');
    const debugText = `[AI DEBUG] ${actor.name}: target=${target?.name ?? 'none'} plan=${planned || 'none'} ap=${totalAp}/${limits.maxAP} reject=${rejectReason} notes=${debugNotes.join(',') || 'none'}`;
    if (process.env.NODE_ENV !== 'production') {
      // Keep debug visibility for developers without leaking to player-facing combat log.
      console.debug(debugText);
    }

    return {
      battleId: state.combatId,
      roundNumber: state.roundNumber,
      actorId: actor.id,
      commands,
      ready: true,
      submittedAt: new Date().toISOString(),
    };
  }

  private calculateCombatExperienceReward(damageContribution: number): number {
    return Math.max(0, Math.floor(damageContribution));
  }

  private calculateDamageContributionFromLogs(state: ArenaBattleState, actorId: string): number {
    return state.logs
      .filter((entry) => entry.type === 'HIT' && entry.actorId === actorId)
      .reduce((sum, entry) => sum + Math.max(0, entry.amount ?? 0), 0);
  }

  private resolveDamageContributionForRewards(
    state: ArenaBattleState,
    actorId: string,
    damageContribution: number,
  ): number {
    const tracked = Math.max(0, damageContribution);
    const fromLogs = this.calculateDamageContributionFromLogs(state, actorId);
    // Some combat flows can finish without updating the session accumulator.
    return Math.max(tracked, fromLogs);
  }

  private calculateCombatGoldReward(state: ArenaBattleState): number {
    const defeatedEnemies = state.entities.filter((entity) => entity.team === TeamSide.Right && !entity.isAlive).length;
    return defeatedEnemies * ARENA_GOLD_PER_DEFEATED_ENEMY;
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
    const effectiveDamageContribution = this.resolveDamageContributionForRewards(state, characterId, damageContribution);

    if (isFileStorageMode()) {
      return this.applyVictoryRewardsFileMode(characterId, state, effectiveDamageContribution);
    }

    const gainedExp = this.calculateCombatExperienceReward(effectiveDamageContribution);
    const gainedGold = this.calculateCombatGoldReward(state);
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
    const gainedExp = this.calculateCombatExperienceReward(damageContribution);
    const gainedGold = this.calculateCombatGoldReward(state);
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
    const combatModifiers = this.contentService.getArenaCombatEquipmentModifiers(equipment);

    const entity = this.toCombatEntityFromStats({
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
      combatModifiers,
    });

    entity.activeWeaponItemId = equipment.weapon ?? null;
    entity.offHandItemId = equipment.shield ?? null;
    entity.hasShield = Boolean(equipment.shield);

    return entity;
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
    combatModifiers?: ArenaCombatEquipmentModifiers;
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
      combatModifiers: params.combatModifiers,
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
    const combatModifiers = this.contentService.getArenaCombatEquipmentModifiers(equipment);

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
      combatModifiers,
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

    // Combat start resources:
    // - HP comes from persisted character resource state (do not reset to full).
    // - MP/stamina start full for the current P0 combat rules.
    player.currentHp = resourceState.currentHp;
    player.currentMp = resourceState.maxMp;
    player.currentStamina = resourceState.maxStamina;
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
      exitZones: battleMap?.exitZones as ExitZone[] | undefined,
    });
    state.roundDurationSeconds = DEFAULT_ROUND_DURATION_SECONDS;
    state.turnDurationSeconds = ACTIVE_TURN_DURATION_SECONDS;
    state.lootContainers = [];

    const equipmentByActorId = new Map<string, Equipment>();
    equipmentByActorId.set(player.id, this.normalizeEquipment(character.equipment));
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i]!;
      if (normalizedCustomEnemies.length > 0) {
        const tpl = normalizedCustomEnemies[i];
        equipmentByActorId.set(enemy.id, this.normalizeEquipment(tpl?.equipment));
      } else {
        equipmentByActorId.set(enemy.id, this.normalizeEquipment({}));
      }
    }

    const session: CombatSession = {
      state,
      playerId: player.id,
      plannedActions: new Map<string, ArenaCombatAction>(),
      turnPlans: new Map<string, CombatTurnPlan>(),
      activeEffects: [],
      enemyTempoBreaks: [],
      damageContribution: 0,
      skillCooldowns: [],
      guardStates: new Map<string, CombatGuardState>(),
      equipmentByActorId,
    };

    this.primeSequentialTurnState(session);
    await this.executeAutomatedTurns(session);
    this.sessions.set(combatId, session);

    return {
      combatId,
      playerId: player.id,
      state,
    };
  }

  async getCombatState(combatId: string): Promise<ArenaBattleState> {
    const session = this.sessions.get(combatId);
    if (!session) {
      throw new NotFoundException('Combat not found.');
    }
    await this.resolveRoundByTimeoutIfNeeded(session);
    return normalizeArenaBattleState({
      ...session.state,
      skillCooldowns: this.serializeSkillCooldowns(session),
    });
  }

  private serializeSkillCooldowns(session: CombatSession): SkillCooldownEntry[] {
    return session.skillCooldowns
      .filter((entry) => entry.remainingRounds > 0 || entry.oncePerCombat)
      .map((entry) => ({
        skillId: entry.skillId,
        remainingRounds: Math.max(0, Math.floor(entry.remainingRounds)),
        oncePerCombat: entry.oncePerCombat,
      }));
  }

  async executeSequentialAction(payload: {
    battleId: string;
    actorId: string;
    roundNumber: number;
    command: CombatCommand;
  }): Promise<
    | { ok: true; battleState: ArenaBattleState; events: CombatEvent[] }
    | { ok: false; errorCode: string; message: string; details?: unknown }
  > {
    const session = this.sessions.get(payload.battleId);
    if (!session) {
      return { ok: false, errorCode: 'BATTLE_NOT_FOUND', message: 'Battle not found.' };
    }

    await this.resolveRoundByTimeoutIfNeeded(session);
    if (session.state.isFinished || session.state.phase === 'finished') {
      return { ok: false, errorCode: 'BATTLE_FINISHED', message: 'Battle is already finished.' };
    }
    if (session.state.phase !== 'acting') {
      return { ok: false, errorCode: 'BATTLE_NOT_ACTING', message: 'Battle is not in active-turn phase.' };
    }
    if (payload.actorId !== session.playerId) {
      return { ok: false, errorCode: 'ACTOR_NOT_CONTROLLED_BY_USER', message: 'Actor is not controlled by this user.' };
    }
    if (payload.roundNumber !== session.state.roundNumber) {
      return { ok: false, errorCode: 'ROUND_MISMATCH', message: 'Round number mismatch.' };
    }
    if (session.state.activeActorId !== payload.actorId) {
      return { ok: false, errorCode: 'ACTOR_NOT_ACTIVE', message: 'Actor is not active right now.' };
    }

    const actor = session.state.entities.find((entity) => entity.id === payload.actorId);
    if (!actor || !this.canActorPlan(session.state, actor)) {
      return { ok: false, errorCode: 'ACTOR_DEAD', message: 'Actor cannot act right now.' };
    }

    let command: CombatCommand;
    try {
      command = this.normalizeAuthoritativeCombatCommand({
        rawCommand: payload.command,
        actor,
        battleState: session.state,
      });
    } catch {
      return {
        ok: false,
        errorCode: 'UNKNOWN_COMMAND',
        message: 'Unknown or invalid command.',
      };
    }

    const movementPrepared = this.applyImmediateMovementRules({ actor, command });
    if (!movementPrepared.ok) {
      this.addCombatEvent(session.state, {
        id: randomUUID(),
        roundNumber: session.state.roundNumber,
        stepIndex: 0,
        orderIndex: 0,
        type: 'command_failed',
        actorId: actor.id,
        commandId: command.id,
        message: movementPrepared.message,
        data: {
          reason: movementPrepared.reason,
          error: movementPrepared.errorCode,
          ...movementPrepared.details,
        },
      });
      return {
        ok: false,
        errorCode: movementPrepared.errorCode,
        message: movementPrepared.message,
        details: movementPrepared.details,
      };
    }
    command = movementPrepared.command;

    const weaponSwapErrors = this.collectWeaponSwapPlanErrors(command, actor);
    if (weaponSwapErrors.length > 0) {
      const firstError = weaponSwapErrors[0] ?? 'UNKNOWN';
      return {
        ok: false,
        errorCode: firstError,
        message: String(firstError),
      };
    }

    if (command.apCost > (session.state.currentTurnAp ?? 0)) {
      return {
        ok: false,
        errorCode: 'NOT_ENOUGH_AP',
        message: 'Not enough AP for this command.',
      };
    }

    const revalidation = this.revalidateCommandForResolve({
      state: session.state,
      actor,
      command,
    });
    if (!revalidation.ok) {
      const reason = revalidation.reason ?? 'unknown';
      const errorCode = this.resolveErrorToCode(reason);
      this.addCombatEvent(session.state, {
        id: randomUUID(),
        roundNumber: session.state.roundNumber,
        stepIndex: 0,
        orderIndex: 0,
        type: 'command_failed',
        actorId: actor.id,
        commandId: command.id,
        message: revalidation.message ?? 'Действие сорвано до выполнения.',
        data: this.buildRevalidationFailureData({
          state: session.state,
          actor,
          command,
          reason,
        }),
      });
      return {
        ok: false,
        errorCode,
        message: revalidation.message ?? 'Command failed validation before execution.',
        details: this.buildRevalidationFailureData({
          state: session.state,
          actor,
          command,
          reason,
        }),
      };
    }

    if (command.type === 'skill_cast') {
      const skillId = typeof command.payload?.skillId === 'string' ? command.payload.skillId.trim() : '';
      if (skillId) {
        const skillValidation = await this.skillRuntime.validateSkillUse(actor.id, skillId, session.skillCooldowns, actor);
        if (!skillValidation.valid) {
          this.addCombatEvent(session.state, {
            id: randomUUID(),
            roundNumber: session.state.roundNumber,
            stepIndex: 0,
            orderIndex: 0,
            type: 'command_failed',
            actorId: actor.id,
            commandId: command.id,
            message: skillValidation.reason ?? 'Навык сейчас недоступен.',
            data: { reason: 'skill_validation_failed', error: skillValidation.reason, skillId },
          });
          return {
            ok: false,
            errorCode: 'SKILL_VALIDATION_FAILED',
            message: skillValidation.reason ?? 'Skill is not available.',
            details: { skillId },
          };
        }
      }
    }

    session.state.recentCombatEvents = [];
    session.state.recentAnimationEvents = [];
    await this.executeImmediateCombatCommand({
      session,
      actor,
      command,
      stepIndex: 0,
      orderIndex: 0,
    });

    if (!session.state.isFinished) {
      if (command.type === 'wait') {
        session.state.currentTurnAp = 0;
      } else {
        session.state.currentTurnAp = Math.max(0, (session.state.currentTurnAp ?? 0) - command.apCost);
      }
    }

    if (!session.state.isFinished && (command.type === 'wait' || (session.state.currentTurnAp ?? 0) <= 0 || !this.canActorPlan(session.state, actor))) {
      await this.advanceSequentialTurn(session, command.type === 'wait' ? 'wait' : 'ap_exhausted');
      await this.executeAutomatedTurns(session);
    }

    // Persist final HP back to character state when combat ends (so next combat starts with correct HP).
    // Rewards are also applied on victory (idempotently).
    if (session.state.isFinished) {
      const playerEntity = session.state.entities.find((e) => e.id === session.playerId);
      if (playerEntity) {
        await this.arenaService.updateCharacterResources(session.playerId, { currentHp: playerEntity.currentHp });
      }

      const stateAny = session.state as unknown as { rewardsApplied?: boolean; victoryRewards?: unknown };
      if (session.state.winner === TeamSide.Left && !stateAny.rewardsApplied) {
        const rewards = await this.applyVictoryRewards(session.playerId, session.state, session.damageContribution);
        stateAny.rewardsApplied = true;
        stateAny.victoryRewards = {
          expGained: rewards.progression.gainedExp,
          goldGained: rewards.gainedGold,
          levelsGained: rewards.progression.levelsGained,
          lootName: rewards.itemName,
        };

        // Append INFO logs so the existing frontend victory summary can parse rewards from battle logs.
        if (rewards.progression.gainedExp > 0) {
          session.state.logs.push({
            round: session.state.roundNumber,
            actorId: session.playerId,
            type: 'INFO' as const,
            text: `Battle reward: +${rewards.progression.gainedExp} EXP`,
          });
        }
        if (rewards.gainedGold > 0) {
          session.state.logs.push({
            round: session.state.roundNumber,
            actorId: session.playerId,
            type: 'INFO' as const,
            text: `Battle reward: +${rewards.gainedGold} gold`,
          });
        }
        if (rewards.itemName) {
          session.state.logs.push({
            round: session.state.roundNumber,
            actorId: session.playerId,
            type: 'INFO' as const,
            text: `Battle reward: loot ${rewards.itemName}`,
          });
        }
      }
    }

    return {
      ok: true,
      battleState: normalizeArenaBattleState({
        ...session.state,
        skillCooldowns: this.serializeSkillCooldowns(session),
      }),
      events: session.state.recentCombatEvents ?? [],
    };
  }

  async submitCombatPlanV2(
    combatId: string,
    payload: { actorId: string; roundNumber: number; commands: CombatCommand[]; ready?: boolean },
  ): Promise<
    | { ok: true; acceptedPlan: CombatTurnPlan; battleState: ArenaBattleState; warnings?: CombatPlanWarning[] }
    | { ok: false; errorCode: string; message: string; details?: unknown }
  > {
    const session = this.sessions.get(combatId);
    if (!session) {
      return { ok: false, errorCode: 'BATTLE_NOT_FOUND', message: 'Battle not found.' };
    }

    await this.resolveRoundByTimeoutIfNeeded(session);
    if (session.state.roundPhase === 'RESOLVING' || session.state.phase === 'resolving') {
      return { ok: false, errorCode: 'ROUND_ALREADY_RESOLVING', message: 'Round is already resolving.' };
    }
    if (session.state.phase === 'finished' || session.state.isFinished) {
      return { ok: false, errorCode: 'BATTLE_NOT_PLANNING', message: 'Battle is not in planning phase.' };
    }
    if (payload.roundNumber !== session.state.roundNumber) {
      return { ok: false, errorCode: 'ROUND_MISMATCH', message: 'Round number mismatch.' };
    }
    if (payload.actorId !== session.playerId) {
      return { ok: false, errorCode: 'ACTOR_NOT_CONTROLLED_BY_USER', message: 'Actor is not controlled by this user.' };
    }

    const result = this.validateCombatPlan(combatId, {
      actorId: payload.actorId,
      roundNumber: payload.roundNumber,
      commands: payload.commands,
    });
    if (!result.ok || !result.normalizedCommands) {
      const firstError = result.errors?.[0] ?? 'UNKNOWN';
      return {
        ok: false,
        errorCode: firstError,
        message: String(firstError),
        details: { errors: result.errors, warnings: result.warnings, warningDetails: result.warningDetails },
      };
    }

    const plan = this.getOrCreateTurnPlan(session, payload.actorId);
    const alreadyReadyThisRound =
      (session.state.readyActorIds ?? []).includes(payload.actorId) &&
      plan.roundNumber === payload.roundNumber;
    if (alreadyReadyThisRound) {
      return {
        ok: false,
        errorCode: 'ALREADY_SUBMITTED_THIS_ROUND',
        message: 'Action for this round is already submitted.',
      };
    }

    plan.battleId = combatId;
    plan.roundNumber = payload.roundNumber;
    plan.actorId = payload.actorId;
    plan.commands = result.normalizedCommands;
    plan.submittedAt = new Date().toISOString();
    plan.ready = Boolean(payload.ready);

    if (plan.ready) {
      this.setTurnPlanReady(session, payload.actorId, true);
    } else {
      this.setTurnPlanReady(session, payload.actorId, false);
    }

    this.syncTurnPlanState(session);

    if (plan.ready) {
      await this.tryResolveWhenAllReady(session);
    }

    return {
      ok: true,
      acceptedPlan: plan,
      battleState: normalizeArenaBattleState(session.state),
      ...(result.warningDetails ? { warnings: result.warningDetails } : {}),
    };
  }

  addCombatCommand(combatId: string, actorId: string, command: CombatCommand): {
    plan: CombatTurnPlan;
    validation: ReturnType<typeof validateCombatTurnPlan>;
  } {
    const session = this.sessions.get(combatId);
    if (!session) {
      throw new NotFoundException('Combat not found.');
    }
    this.ensurePlanningState(session);

    return this.addCommandToTurnPlan(session, actorId, command);
  }

  validateCombatPlan(
    combatId: string,
    payload: { actorId: string; roundNumber: number; commands: CombatCommand[] },
  ): {
    ok: boolean;
    errors: CombatPlanErrorCode[];
    warnings?: CombatPlanWarningCode[];
    warningDetails?: CombatPlanWarning[];
    normalizedCommands?: CombatCommand[];
    total?: { commands: number; ap: number; stamina: number; mp: number; hp: number };
  } {
    const session = this.sessions.get(combatId);
    if (!session) {
      return { ok: false, errors: ['BATTLE_NOT_FOUND'] };
    }

    if (session.state.isFinished || session.state.roundPhase === 'RESOLVING') {
      return { ok: false, errors: ['BATTLE_NOT_PLANNING'] };
    }

    const actor = session.state.entities.find((entity) => entity.id === payload.actorId);
    if (!actor) {
      return { ok: false, errors: ['ACTOR_NOT_FOUND'] };
    }
    if (!this.canActorPlan(session.state, actor)) {
      return { ok: false, errors: ['ACTOR_DEFEATED'] };
    }

    const normalizedCommands: CombatCommand[] = [];
    for (const rawCommand of payload.commands ?? []) {
      try {
        normalizedCommands.push(this.normalizeAuthoritativeCombatCommand({ rawCommand, actor, battleState: session.state }));
      } catch {
        return { ok: false, errors: ['UNKNOWN_COMMAND'] };
      }
    }

    const plan: CombatTurnPlan = {
      battleId: combatId,
      roundNumber: payload.roundNumber,
      actorId: payload.actorId,
      commands: normalizedCommands,
      ready: false,
    };

    const validation = validateCombatTurnPlan({
      plan,
      actor,
      battleState: session.state,
      limits: this.getCombatRoundLimitsForActor(actor),
    });

    return {
      ok: validation.ok,
      errors: validation.errors,
      ...(validation.warnings ? { warnings: validation.warnings } : {}),
      ...(validation.warningDetails ? { warningDetails: validation.warningDetails } : {}),
      ...(validation.ok ? { normalizedCommands, total: validation.total } : {}),
    };
  }

  async submitCombatPlan(
    combatId: string,
    payload: { actorId: string; roundNumber: number; commands: CombatCommand[] },
  ): Promise<{
    ok: boolean;
    plan?: CombatTurnPlan;
    battleState?: ArenaBattleState;
    errors?: CombatPlanErrorCode[];
    warnings?: CombatPlanWarningCode[];
    warningDetails?: CombatPlanWarning[];
  }> {
    const session = this.sessions.get(combatId);
    if (!session) {
      return { ok: false, errors: ['BATTLE_NOT_FOUND'] };
    }
    await this.resolveRoundByTimeoutIfNeeded(session);
    this.ensurePlanningState(session);

    const result = this.validateCombatPlan(combatId, payload);
    if (!result.ok || !result.normalizedCommands) {
      return {
        ok: false,
        errors: result.errors,
        ...(result.warnings ? { warnings: result.warnings } : {}),
        ...(result.warningDetails ? { warningDetails: result.warningDetails } : {}),
      };
    }

    const plan = this.getOrCreateTurnPlan(session, payload.actorId);
    plan.battleId = combatId;
    plan.roundNumber = payload.roundNumber;
    plan.actorId = payload.actorId;
    plan.commands = result.normalizedCommands;
    plan.ready = false;
    plan.submittedAt = new Date().toISOString();

    this.syncTurnPlanState(session);
    return {
      ok: true,
      plan,
      battleState: session.state,
      ...(result.warnings ? { warnings: result.warnings } : {}),
      ...(result.warningDetails ? { warningDetails: result.warningDetails } : {}),
    };
  }

  async clearCombatCommands(combatId: string, actorId: string, roundNumber?: number): Promise<CombatTurnPlan> {
    const session = this.sessions.get(combatId);
    if (!session) {
      throw new NotFoundException('Combat not found.');
    }
    await this.resolveRoundByTimeoutIfNeeded(session);
    this.ensurePlanningState(session);
    if (typeof roundNumber === 'number' && roundNumber !== session.state.roundNumber) {
      throw new BadRequestException('ROUND_MISMATCH');
    }
    return this.clearTurnPlan(session, actorId);
  }

  async undoCombatCommand(combatId: string, actorId: string, roundNumber?: number): Promise<CombatTurnPlan> {
    const session = this.sessions.get(combatId);
    if (!session) {
      throw new NotFoundException('Combat not found.');
    }
    await this.resolveRoundByTimeoutIfNeeded(session);
    this.ensurePlanningState(session);
    if (typeof roundNumber === 'number' && roundNumber !== session.state.roundNumber) {
      throw new BadRequestException('ROUND_MISMATCH');
    }
    return this.undoTurnPlanCommand(session, actorId);
  }

  async setCombatReady(combatId: string, actorId: string, roundNumber?: number): Promise<CombatTurnPlan> {
    const session = this.sessions.get(combatId);
    if (!session) {
      throw new NotFoundException('Combat not found.');
    }
    await this.resolveRoundByTimeoutIfNeeded(session);
    this.ensurePlanningState(session);
    if (typeof roundNumber === 'number' && roundNumber !== session.state.roundNumber) {
      throw new BadRequestException('ROUND_MISMATCH');
    }
    const plan = this.setTurnPlanReady(session, actorId, true);
    await this.tryResolveWhenAllReady(session);
    return plan;
  }

  async cancelCombatReady(combatId: string, actorId: string, roundNumber?: number): Promise<CombatTurnPlan> {
    const session = this.sessions.get(combatId);
    if (!session) {
      throw new NotFoundException('Combat not found.');
    }
    await this.resolveRoundByTimeoutIfNeeded(session);
    this.ensurePlanningState(session);
    if (typeof roundNumber === 'number' && roundNumber !== session.state.roundNumber) {
      throw new BadRequestException('ROUND_MISMATCH');
    }
    return this.setTurnPlanReady(session, actorId, false);
  }

  async resolvePlayerRound(
    combatId: string,
    playerAction: {
      actorId: string;
      targetId: string;
      attackZone?: TargetZone;
      defenseZones?: TargetZone[];
      attackPointsSpent?: number;
      defensePointsSpent?: number;
      actionType: ActionType;
      movementType?: MovementType;
      preferredDistance?: DistanceBand;
      destinationX?: number;
      destinationY?: number;
      skillId?: string;
      skillLevel?: number;
      guardMode?: GuardMode;
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
    const deadlineMs = this.getTurnDeadlineMs(state);
    const isTimedOut = deadlineMs != null && now > deadlineMs;
    const effectiveAction = isTimedOut
      ? (() => {
        const fallbackTarget = state.entities.find((item) => item.team !== TeamSide.Left && item.isAlive)?.id ?? playerAction.targetId;
        return {
          actorId: playerId,
          targetId: fallbackTarget,
          attackZone: playerAction.attackZone ?? TargetZone.Chest,
          defenseZones: playerAction.actionType === ActionType.Defend
            ? (playerAction.guardMode === 'strong_guard' ? [TargetZone.Chest, TargetZone.Abdomen] : [TargetZone.Chest])
            : (playerAction.defenseZones ?? []),
          attackPointsSpent: playerAction.attackPointsSpent ?? 0,
          defensePointsSpent: playerAction.defensePointsSpent ?? 0,
          actionType: ActionType.Wait,
          movementType: undefined,
          preferredDistance: undefined,
          destinationX: undefined,
          destinationY: undefined,
          skillId: undefined,
          skillLevel: undefined,
          guardMode: undefined,
        };
      })()
      : playerAction;

    const legacyAttackZone = effectiveAction.attackZone ?? TargetZone.Chest;
    const legacyDefenseZones = Array.isArray(effectiveAction.defenseZones)
      ? effectiveAction.defenseZones.filter((zone, index, zones) => zones.indexOf(zone) === index).slice(0, 2)
      : [];
    const normalizedGuardMode: GuardMode | undefined = effectiveAction.actionType === ActionType.Defend
      ? (effectiveAction.guardMode === 'strong_guard' ? 'strong_guard' : 'guard')
      : undefined;

    const requestedTotalSpent = Math.max(0, effectiveAction.attackPointsSpent ?? 0) + Math.max(0, effectiveAction.defensePointsSpent ?? 0);
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
    const normalizedPoints = this.normalizePlayerActionPoints({
      actionType: effectiveAction.actionType,
      attackPointsSpent: effectiveAction.attackPointsSpent ?? 0,
      defensePointsSpent: effectiveAction.defensePointsSpent ?? 0,
    }, playerEntity.currentStamina);

    const defenseZones = effectiveAction.actionType === ActionType.Defend
      ? (normalizedGuardMode === 'strong_guard' ? [TargetZone.Chest, TargetZone.Abdomen] : [TargetZone.Chest])
      : legacyDefenseZones;
    const defensePointsSpent = effectiveAction.actionType === ActionType.Defend
      ? (normalizedGuardMode === 'strong_guard'
        ? Math.max(1, Math.round(playerEntity.maxStamina * 0.3))
        : Math.max(1, Math.round(playerEntity.maxStamina * 0.18)))
      : (crushingActiveNow
        ? Math.max(0, Math.ceil(normalizedPoints.defensePointsSpent * 1.4))
        : normalizedPoints.defensePointsSpent);

    const buffedPlayerAction: ArenaCombatAction = {
      actorId: effectiveAction.actorId,
      targetId: effectiveAction.targetId,
      attackZone: legacyAttackZone,
      defenseZones,
      attackPointsSpent: normalizedPoints.attackPointsSpent,
      defensePointsSpent,
      actionType: effectiveAction.actionType,
      movementType: effectiveAction.movementType,
      preferredDistance: effectiveAction.preferredDistance,
      destinationX: effectiveAction.destinationX,
      destinationY: effectiveAction.destinationY,
    };

    session.plannedActions.set(playerId, buffedPlayerAction);

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
        const cachedAction = session.plannedActions.get(item.id) ?? createNpcAction(state, item.id);
        if (!tempoBrokenTargets.has(item.id)) {
          return cachedAction;
        }

        const reducedAttack = Math.max(
          cachedAction.actionType === ActionType.Attack ? 1 : 0,
          Math.floor(cachedAction.attackPointsSpent * 0.65),
        );
        const reducedDefense = Math.max(0, Math.floor(cachedAction.defensePointsSpent * 0.65));

        skillLogs.push(`${item.name} loses tempo: -35% ATK/DEF points this round`);

        return {
          ...cachedAction,
          attackPointsSpent: reducedAttack,
          defensePointsSpent: reducedDefense,
        };
      });

    const allActions: ArenaCombatAction[] = [
      buffedPlayerAction,
      ...enemyActions,
    ];

    state.roundPhase = 'RESOLVING';
    const nextState = resolveRound({
      state,
      plannedActions: allActions,
    });

    if (!nextState.isFinished) {
      this.primeRoundPlanning(session);
      nextState.roundPhase = 'PLANNING';
      nextState.readyActorIds = [...session.plannedActions.keys()];
      nextState.pendingActorIds = nextState.entities
        .filter((entity) => entity.isAlive)
        .map((entity) => entity.id)
        .filter((entityId) => !session.plannedActions.has(entityId));
    }
    if (nextState.isFinished) {
      session.plannedActions.clear();
      nextState.roundPhase = undefined;
      nextState.readyActorIds = [];
      nextState.pendingActorIds = [];
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
