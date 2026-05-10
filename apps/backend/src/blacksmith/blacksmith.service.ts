import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { isFileStorageMode } from '../config/storage-mode';
import type { AdminItem, ItemSocket, SlotUpgradeRules } from '../content/content.types';
import { ContentService } from '../content/content.service';
import {
  normalizeCharacterItemInstanceState,
  type CharacterItemInstanceRecord,
  type CharacterItemInstanceState,
  type CharacterItemSocketState,
} from '../characters/character-item-instance.types';
import { PrismaService } from '../prisma/prisma.service';

export type SlotUpgradeFailureMode = 'none' | 'material_lost' | 'item_damaged' | 'slot_locked';

type UpgradeOperation = 'open_locked_slot' | 'add_augment_slot';

interface UpgradeOptions {
  blacksmithTier?: number;
  successRollPercent?: number;
  failureRollPercent?: number;
}

export interface SlotUpgradeResult {
  operation: UpgradeOperation;
  success: boolean;
  failureMode?: SlotUpgradeFailureMode;
  reason?: string;
  blacksmithTier: number;
  successChancePercent: number;
  rollPercent: number;
  goldSpent: number;
  materialSpent: Array<{ itemId: string; quantity: number }>;
  itemInstance: CharacterItemInstanceRecord;
  sockets: CharacterItemSocketState[];
}

@Injectable()
export class BlacksmithService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
  ) {}

  async openLockedSlot(
    characterId: string,
    itemInstanceId: string,
    socketId: string,
    options?: UpgradeOptions,
  ): Promise<SlotUpgradeResult> {
    const normalizedSocketId = String(socketId ?? '').trim();
    if (!normalizedSocketId) {
      throw new BadRequestException('socketId is required.');
    }

    const context = await this.loadUpgradeContext(characterId, itemInstanceId, options?.blacksmithTier);
    const targetSocket = context.sockets.find((entry) => entry.socketId === normalizedSocketId);
    if (!targetSocket) {
      throw new BadRequestException(`Socket not found: ${normalizedSocketId}`);
    }
    if (!targetSocket.isLocked) {
      throw new BadRequestException('Socket is not locked.');
    }

    const outcome = this.resolveOutcome(context.rules, options);

    let nextSockets = context.sockets.map((entry) => ({ ...entry }));
    let materialSpent: Array<{ itemId: string; quantity: number }> = [];
    let goldSpent = 0;

    if (outcome.success) {
      nextSockets = nextSockets.map((entry) => (
        entry.socketId === normalizedSocketId
          ? { ...entry, isLocked: false }
          : entry
      ));
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        goldSpent = await this.trySpendGold(tx, context.characterId, context.rules.goldCost);
        materialSpent = await this.trySpendMaterials(tx, context.characterId, context.rules.materialCosts, true);
        await tx.characterItemInstance.update({
          where: { id: context.instance.id },
          data: { state: this.toPersistedState(this.withSockets(context.instance.state, nextSockets)) },
        });
      });
    } else {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        materialSpent = await this.trySpendMaterials(
          tx,
          context.characterId,
          context.rules.materialCosts,
          outcome.failureMode === 'material_lost',
        );

        const failedState = this.applyFailureMode(
          context.instance.state,
          nextSockets,
          outcome.failureMode,
          {
            operation: 'open_locked_slot',
            socketId: normalizedSocketId,
          },
        );
        nextSockets = failedState.sockets;

        if (failedState.changed) {
          await tx.characterItemInstance.update({
            where: { id: context.instance.id },
            data: { state: this.toPersistedState(failedState.state) },
          });
        }
      });
    }

    const updatedInstance = await this.readItemInstance(context.characterId, context.instance.id);
    return {
      operation: 'open_locked_slot',
      success: outcome.success,
      failureMode: outcome.success ? undefined : outcome.failureMode,
      reason: outcome.success ? undefined : this.describeFailureMode(outcome.failureMode),
      blacksmithTier: context.blacksmithTier,
      successChancePercent: outcome.successChancePercent,
      rollPercent: outcome.rollPercent,
      goldSpent,
      materialSpent,
      itemInstance: updatedInstance,
      sockets: this.resolveEffectiveSockets(context.item, updatedInstance.state),
    };
  }

  async addAugmentSlot(
    characterId: string,
    itemInstanceId: string,
    options?: UpgradeOptions,
  ): Promise<SlotUpgradeResult> {
    const context = await this.loadUpgradeContext(characterId, itemInstanceId, options?.blacksmithTier);

    if (context.item.canAddAugmentSlots !== true) {
      throw new BadRequestException('This item cannot receive additional augment slots.');
    }

    const currentSlots = context.sockets;
    const maxAugmentSlots = typeof context.item.maxAugmentSlots === 'number' && Number.isFinite(context.item.maxAugmentSlots)
      ? Math.max(0, Math.floor(context.item.maxAugmentSlots))
      : currentSlots.length;

    if (currentSlots.length >= maxAugmentSlots) {
      throw new BadRequestException(`Max augment slots reached (${maxAugmentSlots}).`);
    }

    const outcome = this.resolveOutcome(context.rules, options);

    let nextSockets = currentSlots.map((entry) => ({ ...entry }));
    let materialSpent: Array<{ itemId: string; quantity: number }> = [];
    let goldSpent = 0;

    if (outcome.success) {
      nextSockets.push({
        socketId: `socket_bs_${randomUUID()}`,
        socketedAugmentItemId: null,
        isLocked: false,
        source: 'blacksmith_added',
      });

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        goldSpent = await this.trySpendGold(tx, context.characterId, context.rules.goldCost);
        materialSpent = await this.trySpendMaterials(tx, context.characterId, context.rules.materialCosts, true);
        await tx.characterItemInstance.update({
          where: { id: context.instance.id },
          data: { state: this.toPersistedState(this.withSockets(context.instance.state, nextSockets)) },
        });
      });
    } else {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        materialSpent = await this.trySpendMaterials(
          tx,
          context.characterId,
          context.rules.materialCosts,
          outcome.failureMode === 'material_lost',
        );

        const failedState = this.applyFailureMode(
          context.instance.state,
          nextSockets,
          outcome.failureMode,
          {
            operation: 'add_augment_slot',
          },
        );
        nextSockets = failedState.sockets;

        if (failedState.changed) {
          await tx.characterItemInstance.update({
            where: { id: context.instance.id },
            data: { state: this.toPersistedState(failedState.state) },
          });
        }
      });
    }

    const updatedInstance = await this.readItemInstance(context.characterId, context.instance.id);
    return {
      operation: 'add_augment_slot',
      success: outcome.success,
      failureMode: outcome.success ? undefined : outcome.failureMode,
      reason: outcome.success ? undefined : this.describeFailureMode(outcome.failureMode),
      blacksmithTier: context.blacksmithTier,
      successChancePercent: outcome.successChancePercent,
      rollPercent: outcome.rollPercent,
      goldSpent,
      materialSpent,
      itemInstance: updatedInstance,
      sockets: this.resolveEffectiveSockets(context.item, updatedInstance.state),
    };
  }

  private async loadUpgradeContext(characterId: string, itemInstanceId: string, requestedTier?: number) {
    if (isFileStorageMode()) {
      throw new ServiceUnavailableException('Blacksmith upgrade endpoints require database mode.');
    }

    const normalizedCharacterId = String(characterId ?? '').trim();
    const normalizedInstanceId = String(itemInstanceId ?? '').trim();
    if (!normalizedCharacterId) {
      throw new BadRequestException('characterId is required.');
    }
    if (!normalizedInstanceId) {
      throw new BadRequestException('itemInstanceId is required.');
    }

    const character = await this.prisma.character.findUnique({
      where: { id: normalizedCharacterId },
      select: { id: true, gold: true },
    });
    if (!character) {
      throw new NotFoundException('Character not found.');
    }

    const instance = await this.readItemInstance(normalizedCharacterId, normalizedInstanceId);
    const item = this.readAdminItem(instance.itemId);
    if (!item.slotUpgradeRules) {
      throw new BadRequestException('Slot upgrade rules are not configured for this item.');
    }
    const rules = this.normalizeRules(item.slotUpgradeRules);
    const sockets = this.resolveEffectiveSockets(item, instance.state);
    const blacksmithTier = this.resolveBlacksmithTier(requestedTier);

    if (blacksmithTier < rules.minBlacksmithTier) {
      throw new BadRequestException(`Blacksmith tier ${blacksmithTier} is below required ${rules.minBlacksmithTier}.`);
    }

    await this.ensureEnoughGold(character.gold, rules.goldCost);
    await this.ensureEnoughMaterials(normalizedCharacterId, rules.materialCosts);

    return {
      characterId: normalizedCharacterId,
      characterGold: character.gold,
      blacksmithTier,
      instance,
      item,
      rules,
      sockets,
    };
  }

  private readAdminItem(itemId: string): AdminItem {
    const entry = this.contentService.getCollectionEntry('items', itemId) as AdminItem | null;
    if (!entry || entry.isEnabled === false) {
      throw new NotFoundException(`Item not found: ${itemId}`);
    }
    return entry;
  }

  private async readItemInstance(characterId: string, itemInstanceId: string): Promise<CharacterItemInstanceRecord> {
    const row = await this.prisma.characterItemInstance.findFirst({
      where: { id: itemInstanceId, characterId },
      select: {
        id: true,
        characterId: true,
        itemId: true,
        state: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!row) {
      throw new NotFoundException('Item instance not found.');
    }

    return {
      id: row.id,
      characterId: row.characterId,
      itemId: row.itemId,
      state: normalizeCharacterItemInstanceState(row.state),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private normalizeRules(rules: SlotUpgradeRules | undefined): {
    minBlacksmithTier: number;
    goldCost: number;
    materialCosts: Array<{ itemId: string; quantity: number }>;
    successChancePercent: number;
    failureModes: SlotUpgradeFailureMode[];
  } {
    return {
      minBlacksmithTier: Math.max(1, Number.isFinite(rules?.minBlacksmithTier ?? NaN) ? Math.floor(rules?.minBlacksmithTier ?? 1) : 1),
      goldCost: Math.max(0, Number.isFinite(rules?.goldCost ?? NaN) ? Math.floor(rules?.goldCost ?? 0) : 0),
      materialCosts: Array.isArray(rules?.materialCosts)
        ? rules.materialCosts
          .map((entry) => ({
            itemId: String(entry?.itemId ?? '').trim(),
            quantity: Math.max(1, Number.isFinite(entry?.quantity ?? NaN) ? Math.floor(entry?.quantity ?? 1) : 1),
          }))
          .filter((entry) => entry.itemId.length > 0)
        : [],
      successChancePercent: Math.max(0, Math.min(100, Number.isFinite(rules?.successChancePercent ?? NaN) ? Number(rules?.successChancePercent) : 100)),
      failureModes: this.normalizeFailureModes(rules?.failureModes),
    };
  }

  private normalizeFailureModes(value: SlotUpgradeRules['failureModes']): SlotUpgradeFailureMode[] {
    const modes = Array.isArray(value)
      ? value.filter((entry): entry is SlotUpgradeFailureMode => (
        entry === 'none' || entry === 'material_lost' || entry === 'item_damaged' || entry === 'slot_locked'
      ))
      : [];
    return modes.length > 0 ? modes : ['none'];
  }

  private resolveBlacksmithTier(requestedTier?: number): number {
    return Math.max(1, Number.isFinite(requestedTier ?? NaN) ? Math.floor(requestedTier as number) : 1);
  }

  private async ensureEnoughGold(currentGold: number, requiredGold: number): Promise<void> {
    if (requiredGold <= 0) {
      return;
    }
    if (currentGold < requiredGold) {
      throw new BadRequestException('Not enough gold.');
    }
  }

  private async ensureEnoughMaterials(characterId: string, materialCosts: Array<{ itemId: string; quantity: number }>): Promise<void> {
    if (materialCosts.length === 0) {
      return;
    }

    for (const cost of materialCosts) {
      const row = await this.prisma.characterInventoryItem.findUnique({
        where: { characterId_itemId: { characterId, itemId: cost.itemId } },
        select: { quantity: true },
      });
      const quantity = row?.quantity ?? 0;
      if (quantity < cost.quantity) {
        throw new BadRequestException(`Not enough materials: ${cost.itemId}`);
      }
    }
  }

  private resolveOutcome(
    rules: { successChancePercent: number; failureModes: SlotUpgradeFailureMode[] },
    options?: Pick<UpgradeOptions, 'successRollPercent' | 'failureRollPercent'>,
  ): {
    success: boolean;
    failureMode: SlotUpgradeFailureMode;
    successChancePercent: number;
    rollPercent: number;
  } {
    const rollPercent = this.normalizeRoll(options?.successRollPercent);
    const success = rollPercent < rules.successChancePercent;
    if (success) {
      return {
        success: true,
        failureMode: 'none',
        successChancePercent: rules.successChancePercent,
        rollPercent,
      };
    }

    const failureMode = this.pickFailureMode(rules.failureModes, options?.failureRollPercent);
    return {
      success: false,
      failureMode,
      successChancePercent: rules.successChancePercent,
      rollPercent,
    };
  }

  private normalizeRoll(value?: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.min(100, Math.floor(value)));
    }
    return Math.floor(Math.random() * 101);
  }

  private pickFailureMode(modes: SlotUpgradeFailureMode[], roll?: number): SlotUpgradeFailureMode {
    if (modes.length === 0) {
      return 'none';
    }
    if (modes.length === 1) {
      return modes[0];
    }

    const normalizedRoll = this.normalizeRoll(roll);
    const index = Math.min(modes.length - 1, Math.floor((normalizedRoll / 100) * modes.length));
    return modes[index] ?? 'none';
  }

  private async trySpendGold(tx: { character: { update(args: { where: { id: string }; data: { gold: { decrement: number } } }): Promise<unknown> } }, characterId: string, amount: number): Promise<number> {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0) {
      return 0;
    }
    await tx.character.update({
      where: { id: characterId },
      data: { gold: { decrement: safeAmount } },
    });
    return safeAmount;
  }

  private async trySpendMaterials(
    tx: {
      characterInventoryItem: {
        findUnique(args: { where: { characterId_itemId: { characterId: string; itemId: string } }; select?: { id: true; quantity: true } }): Promise<{ id: string; quantity: number } | null>;
        update(args: { where: { id: string }; data: { quantity: number } }): Promise<unknown>;
        delete(args: { where: { id: string } }): Promise<unknown>;
      };
    },
    characterId: string,
    materialCosts: Array<{ itemId: string; quantity: number }>,
    spend: boolean,
  ): Promise<Array<{ itemId: string; quantity: number }>> {
    if (!spend || materialCosts.length === 0) {
      return [];
    }

    for (const cost of materialCosts) {
      const existing = await tx.characterInventoryItem.findUnique({
        where: { characterId_itemId: { characterId, itemId: cost.itemId } },
        select: { id: true, quantity: true },
      });
      if (!existing || existing.quantity < cost.quantity) {
        throw new BadRequestException(`Not enough materials: ${cost.itemId}`);
      }

      const nextQuantity = existing.quantity - cost.quantity;
      if (nextQuantity <= 0) {
        await tx.characterInventoryItem.delete({ where: { id: existing.id } });
      } else {
        await tx.characterInventoryItem.update({
          where: { id: existing.id },
          data: { quantity: nextQuantity },
        });
      }
    }

    return materialCosts.map((entry) => ({ ...entry }));
  }

  private resolveEffectiveSockets(item: AdminItem, state: CharacterItemInstanceState | null): CharacterItemSocketState[] {
    const byId = new Map<string, CharacterItemSocketState>();

    for (const slot of item.augmentSlots ?? []) {
      if (!slot || typeof slot.id !== 'string' || slot.id.trim().length === 0) {
        continue;
      }
      byId.set(slot.id, {
        socketId: slot.id,
        socketedAugmentItemId: slot.socketedAugmentItemId ?? null,
        isLocked: slot.isLocked ?? false,
        source: slot.source ?? 'base',
      });
    }

    for (const slot of state?.augmentSlots ?? []) {
      const existing = byId.get(slot.socketId);
      if (existing) {
        byId.set(slot.socketId, {
          socketId: slot.socketId,
          socketedAugmentItemId: slot.socketedAugmentItemId ?? existing.socketedAugmentItemId ?? null,
          isLocked: typeof slot.isLocked === 'boolean' ? slot.isLocked : existing.isLocked,
          source: slot.source ?? existing.source,
        });
      } else {
        byId.set(slot.socketId, {
          socketId: slot.socketId,
          socketedAugmentItemId: slot.socketedAugmentItemId ?? null,
          isLocked: slot.isLocked ?? false,
          source: slot.source,
        });
      }
    }

    return [...byId.values()];
  }

  private withSockets(state: CharacterItemInstanceState | null, sockets: CharacterItemSocketState[]): CharacterItemInstanceState {
    return {
      ...(state ?? { version: 1 }),
      version: 1,
      augmentSlots: sockets,
    };
  }

  private applyFailureMode(
    currentState: CharacterItemInstanceState | null,
    currentSockets: CharacterItemSocketState[],
    mode: SlotUpgradeFailureMode,
    context: { operation: UpgradeOperation; socketId?: string },
  ): { state: CharacterItemInstanceState; sockets: CharacterItemSocketState[]; changed: boolean } {
    const nextState = this.withSockets(currentState, currentSockets.map((entry) => ({ ...entry })));
    let changed = false;

    if (mode === 'item_damaged') {
      const metadata = nextState.metadata ?? {};
      const previous = typeof metadata.blacksmithDamageCount === 'number' ? metadata.blacksmithDamageCount : 0;
      nextState.metadata = {
        ...metadata,
        blacksmithDamageCount: previous + 1,
      };
      changed = true;
    }

    if (mode === 'slot_locked') {
      if (context.operation === 'open_locked_slot' && context.socketId) {
        const target = nextState.augmentSlots?.find((entry) => entry.socketId === context.socketId);
        if (target && target.isLocked !== true) {
          target.isLocked = true;
          changed = true;
        }
      } else if (context.operation === 'add_augment_slot') {
        const target = nextState.augmentSlots?.find((entry) => entry.isLocked !== true);
        if (target) {
          target.isLocked = true;
          changed = true;
        }
      }
    }

    return {
      state: nextState,
      sockets: nextState.augmentSlots ?? [],
      changed,
    };
  }

  private describeFailureMode(mode: SlotUpgradeFailureMode): string {
    if (mode === 'material_lost') {
      return 'Upgrade failed: materials were lost.';
    }
    if (mode === 'item_damaged') {
      return 'Upgrade failed: item was damaged.';
    }
    if (mode === 'slot_locked') {
      return 'Upgrade failed: a slot was locked.';
    }
    return 'Upgrade failed with no additional penalty.';
  }

  private toPersistedState(state: CharacterItemInstanceState): Record<string, unknown> {
    return state as unknown as Record<string, unknown>;
  }
}
