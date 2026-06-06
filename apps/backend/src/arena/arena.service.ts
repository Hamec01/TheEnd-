import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  getMerchantPriceModifiers,
  getKingdomMaxStaminaMultiplier,
  type Equipment,
  type InventoryState,
  type StatBlock,
} from '@theend/rpg-domain';
import { randomUUID } from 'crypto';
import { ContentService } from '../content/content.service';
import {
  normalizeCharacterEquipmentState,
  normalizeCharacterItemInstanceState,
  type CharacterEquipmentState,
  type CharacterItemInstanceState,
  type CharacterItemSocketState,
  type CharacterItemInstanceRecord,
} from '../characters/character-item-instance.types';
import { CharacterMetadataStore } from '../characters/character-metadata.store';
import { isDatabaseEnabled, isFileStorageMode } from '../config/storage-mode';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeCharacterStore } from '../characters/runtime-character-store';
import type { AdminItem } from '../content/content.types';

type InventoryItemRow = { id: string; itemId: string; quantity: number };
type CharacterEquipmentRecordRow = {
  weapon?: string | null;
  helmet?: string | null;
  necklace?: string | null;
  armor?: string | null;
  outerwear?: string | null;
  belt?: string | null;
  gloves?: string | null;
  shield?: string | null;
  ring1?: string | null;
  ring2?: string | null;
  ring3?: string | null;
  legs?: string | null;
  boots?: string | null;
  equipmentState?: unknown;
} | null | undefined;

const ACTION_SLOT_IDS = ['quick1', 'quick2', 'quick3', 'quick4', 'quick5', 'quick6', 'quick7', 'quick8', 'quick9', 'quick10'] as const;

export type CharacterActionSlotId = (typeof ACTION_SLOT_IDS)[number];

export type CharacterActionSlotKind = 'skill' | 'item' | 'weapon' | null;
export type CharacterActionBarEntryKind = 'skill' | 'item' | 'weapon' | 'empty';

export interface CharacterActionSlot {
  slotId: CharacterActionSlotId;
  slotIndex: number;
  kind: CharacterActionSlotKind;
  refId: string | null;
  itemInstanceId?: string | null;
  weaponInstanceId?: string | null;
}

export interface CharacterActionBarSlot {
  slotId: CharacterActionSlotId;
  order: number;
  entryKind: CharacterActionBarEntryKind;
  skillId?: string;
  itemId?: string;
  itemInstanceId?: string | null;
  weaponItemId?: string;
  weaponInstanceId?: string | null;
  isLocked: false;
}

export interface CharacterHotbarSlot {
  slotIndex: number;
  itemId: string | null;
  itemInstanceId?: string | null;
}

export interface CharacterResourceState {
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  currentStamina: number;
  maxStamina: number;
  hpRegenPerTurn: number;
}

export interface SocketAugmentResult {
  itemInstance: CharacterItemInstanceRecord;
  socket: CharacterItemSocketState;
  status: 'active' | 'inactive';
  reason?: string;
}

export interface UnsocketAugmentResult {
  itemInstance: CharacterItemInstanceRecord;
  socket: CharacterItemSocketState;
  returnedAugmentItemId: string;
}

type StoredHotbarMap = Record<string, CharacterHotbarSlot[] | undefined>;
type StoredActionSlotMap = Record<string, CharacterActionSlot[] | undefined>;
type StoredActionSlotPhysicalMap = Record<string, string[] | undefined>;
type StoredResourceMap = Record<string, {
  currentHp?: number;
  currentMp?: number;
  currentStamina?: number;
  hpRegenPerTurn?: number;
} | undefined>;
type InputJsonValue = Prisma.InputJsonValue;
type ItemResourceRestore = { hp: number; mp: number; stamina: number };

const CHARACTER_ACTION_SLOTS_STORE_KEY = 'character-action-slots-v1';
const CHARACTER_ACTION_SLOT_PHYSICAL_STORE_KEY = 'character-action-slot-physical-v1';
const CHARACTER_HOTBAR_STORE_KEY = 'character-item-hotbars-v1';
const CHARACTER_RESOURCES_STORE_KEY = 'character-runtime-resources-v1';
const CHARACTER_QUEST_STATES_STORE_KEY = 'character-quest-states-v1';
const HOTBAR_SLOT_COUNT = 10;
const MERCHANT_STOCK_RESTOCK_INTERVAL_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class ArenaService implements OnModuleInit {
  private readonly logger = new Logger(ArenaService.name);
  private readonly metadataStore: CharacterMetadataStore;

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
    private readonly runtimeStore: RuntimeCharacterStore,
  ) {
    this.metadataStore = new CharacterMetadataStore(this.prisma, this.runtimeStore);
  }

  async onModuleInit(): Promise<void> {
    if (!isDatabaseEnabled()) {
      if (isFileStorageMode()) {
        this.logger.log('Local file mode active: skipping Prisma database initialization.');
      }
      return;
    }

    await this.ensureEquipmentSchema();
    await this.sanitizeAllCharactersInventoryAndEquipment();
  }

  private assertDatabaseEnabled(): void {
    if (!isDatabaseEnabled()) {
      throw new ServiceUnavailableException('Arena endpoints require database storage. Database is disabled in local file content storage mode.');
    }
  }

  private toBaseStats(character: any): StatBlock {
    return {
      hp: character.hpBase || 0,
      mp: character.mpBase || 0,
      stamina: character.staminaBase || 0,
      strength: character.strength || 0,
      dexterity: character.dexterity || 0,
      constitution: character.endurance || 0,
      intelligence: character.intelligence || 0,
      luck: character.luck || 0,
      perception: character.speed || 0,
      willpower: character.willpower || 0,
    };
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

  private normalizeRuntimeEquipment(value: unknown): Equipment {
    return this.contentService.normalizeEquipment((value ?? null) as Partial<Equipment> | null);
  }

  private async requireRuntimeCharacter(characterId: string): Promise<Record<string, unknown>> {
    const character = await this.runtimeStore.getCharacterById(characterId);
    if (!character) {
      throw new NotFoundException('Character not found.');
    }
    return character as Record<string, unknown>;
  }

  private async readRuntimeInventoryItems(characterId: string): Promise<Array<{ id: string; itemId: string; quantity: number }>> {
    const character = await this.requireRuntimeCharacter(characterId);
    return this.normalizeRuntimeInventoryItems((character as { inventoryItems?: unknown }).inventoryItems);
  }

  private async writeRuntimeInventoryItems(characterId: string, inventoryItems: Array<{ id: string; itemId: string; quantity: number }>): Promise<void> {
    await this.runtimeStore.updateCharacter(characterId, { inventoryItems: this.normalizeRuntimeInventoryItems(inventoryItems) });
  }

  private async readRuntimeEquipment(characterId: string): Promise<Equipment> {
    const character = await this.requireRuntimeCharacter(characterId);
    return this.normalizeRuntimeEquipment((character as { equipment?: unknown }).equipment ?? null);
  }

  private async writeRuntimeEquipment(characterId: string, equipment: Equipment): Promise<void> {
    await this.runtimeStore.updateCharacter(characterId, { equipment: equipment });
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
        throw new BadRequestException('Item is not in inventory.');
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
      throw new BadRequestException('Item is not in inventory.');
    }

    if (nextQuantity === 0) {
      current.splice(index, 1);
      await this.writeRuntimeInventoryItems(characterId, current);
      return;
    }

    current[index] = { ...row, quantity: nextQuantity };
    await this.writeRuntimeInventoryItems(characterId, current);
  }

  private async getCharacterArenaStateForFileMode(characterId: string) {
    const character = await this.requireRuntimeCharacter(characterId);
    const metadata = await this.metadataStore.get(characterId);

    const baseStats = this.toBaseStats(character);
    const equipment = this.normalizeRuntimeEquipment((character as { equipment?: unknown }).equipment ?? null);
    const inventoryItems = this.normalizeRuntimeInventoryItems((character as { inventoryItems?: unknown }).inventoryItems);

    const activeStats = this.contentService.getStatsWithEquipment(baseStats, equipment);
    const resources = await this.getCharacterResources(characterId);
    const actionSlots = await this.getOrCreateActionSlots(characterId);
    const physicalSlotIds = await this.readCharacterPhysicalItemSlots(characterId);

    const inventory: InventoryState = {
      gold: Number((character as { gold?: unknown }).gold ?? 0) || 0,
      items: this.applyItemSlotReservationsToInventory(
        inventoryItems.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity })),
        actionSlots,
        physicalSlotIds,
      ),
    };

    return {
      character: {
        id: String((character as { id?: unknown }).id ?? ''),
        name: String((character as { name?: unknown }).name ?? ''),
        race: String((character as { race?: unknown }).race ?? ''),
        level: Number((character as { level?: unknown }).level ?? 0) || 0,
        exp: Number((character as { exp?: unknown }).exp ?? 0) || 0,
        freePoints: Number((character as { freePoints?: unknown }).freePoints ?? 0) || 0,
        baseStats,
        activeStats,
        currentHp: resources.currentHp,
        maxHp: resources.maxHp,
        currentMp: resources.currentMp,
        maxMp: resources.maxMp,
        currentStamina: resources.currentStamina,
        maxStamina: resources.maxStamina,
        hpRegenPerTurn: resources.hpRegenPerTurn,
        professions: metadata.startingProfessionIds.length > 0
          ? { professions: metadata.startingProfessionIds.map((professionId) => ({ professionId, level: 1, xp: 0, xpToNextLevel: 100, skillPoints: 0, learnedSkillIds: [], selectedBranchIds: [], unlockedAt: new Date().toISOString() })) }
          : undefined,
        citizenshipKingdomId: metadata.citizenshipKingdomId,
        kingdomReputation: metadata.kingdomReputation,
      },
      inventory,
      equipment,
      itemInstances: [],
      equipmentState: null,
      actionSlots,
    };
  }

  private applyItemSlotReservationsToInventory(
    items: Array<{ itemId: string; quantity: number }>,
    actionSlots: CharacterActionSlot[],
    physicalSlotIds: Set<CharacterActionSlotId>,
  ): Array<{ itemId: string; quantity: number }> {
    const reservedCounts = new Map<string, number>();
    for (const slot of actionSlots) {
      if (slot.kind !== 'item' || !slot.refId) {
        continue;
      }
      if (physicalSlotIds.has(slot.slotId)) {
        continue;
      }
      reservedCounts.set(slot.refId, (reservedCounts.get(slot.refId) ?? 0) + 1);
    }

    return items
      .map((entry) => {
        const reserved = reservedCounts.get(entry.itemId) ?? 0;
        return {
          itemId: entry.itemId,
          quantity: Math.max(0, entry.quantity - reserved),
        };
      })
      .filter((entry) => entry.quantity > 0);
  }

  private toActionSlotId(slotIndex: number): CharacterActionSlotId {
    return ACTION_SLOT_IDS[slotIndex] ?? ACTION_SLOT_IDS[0];
  }

  private toActionSlotIndex(slotId: string | null | undefined): number {
    if (!slotId) {
      return -1;
    }

    return ACTION_SLOT_IDS.indexOf(slotId as CharacterActionSlotId);
  }

  private resolveActionBarSlotIndex(slotId?: string | null, order?: number): number {
    if (typeof order === 'number' && order >= 0 && order < HOTBAR_SLOT_COUNT) {
      return order;
    }

    return this.toActionSlotIndex(slotId);
  }

  private toActionBarSlot(slot: CharacterActionSlot): CharacterActionBarSlot {
    if (slot.kind === 'skill' && slot.refId) {
      return {
        slotId: slot.slotId,
        order: slot.slotIndex,
        entryKind: 'skill',
        skillId: slot.refId,
        isLocked: false,
      };
    }

    if (slot.kind === 'item' && slot.refId) {
      return {
        slotId: slot.slotId,
        order: slot.slotIndex,
        entryKind: 'item',
        itemId: slot.refId,
        itemInstanceId: slot.itemInstanceId ?? null,
        isLocked: false,
      };
    }

    if (slot.kind === 'weapon' && slot.refId) {
      return {
        slotId: slot.slotId,
        order: slot.slotIndex,
        entryKind: 'weapon',
        weaponItemId: slot.refId,
        weaponInstanceId: slot.weaponInstanceId ?? slot.itemInstanceId ?? null,
        isLocked: false,
      };
    }

    return {
      slotId: slot.slotId,
      order: slot.slotIndex,
      entryKind: 'empty',
      isLocked: false,
    };
  }

  private getCharacterSkillModel(): {
    findFirst(args: { where: { characterId: string; skillId: string }; select: { id: true } }): Promise<{ id: string } | null>;
  } | null {
    return (this.prisma as unknown as {
      characterSkill?: {
        findFirst(args: { where: { characterId: string; skillId: string }; select: { id: true } }): Promise<{ id: string } | null>;
      };
    }).characterSkill ?? null;
  }

  private getCharacterItemInstanceModel(): {
    findFirst(args: {
      where: { characterId: string; itemId?: string; id?: string };
      select?: {
        id: true;
        characterId: true;
        itemId: true;
        state: true;
        createdAt: true;
        updatedAt: true;
      };
    }): Promise<{
      id: string;
      characterId: string;
      itemId: string;
      state: unknown;
      createdAt: Date;
      updatedAt: Date;
    } | null>;
    findMany(args: {
      where: { characterId: string };
      orderBy?: { createdAt: 'asc' | 'desc' };
      select?: {
        id: true;
        characterId: true;
        itemId: true;
        state: true;
        createdAt: true;
        updatedAt: true;
      };
    }): Promise<Array<{
      id: string;
      characterId: string;
      itemId: string;
      state: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>>;
    update(args: {
      where: { id: string };
      data: { state: Record<string, unknown> | null };
      select?: {
        id: true;
        characterId: true;
        itemId: true;
        state: true;
        createdAt: true;
        updatedAt: true;
      };
    }): Promise<{
      id: string;
      characterId: string;
      itemId: string;
      state: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>;
    create(args: {
      data: { characterId: string; itemId: string; state: Record<string, unknown> | null };
      select?: {
        id: true;
        characterId: true;
        itemId: true;
        state: true;
        createdAt: true;
        updatedAt: true;
      };
    }): Promise<{
      id: string;
      characterId: string;
      itemId: string;
      state: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  } | null {
    return (this.prisma as unknown as {
      characterItemInstance?: {
        findFirst(args: {
          where: { characterId: string; itemId?: string; id?: string };
          select?: {
            id: true;
            characterId: true;
            itemId: true;
            state: true;
            createdAt: true;
            updatedAt: true;
          };
        }): Promise<{
          id: string;
          characterId: string;
          itemId: string;
          state: unknown;
          createdAt: Date;
          updatedAt: Date;
        } | null>;
        findMany(args: {
          where: { characterId: string };
          orderBy?: { createdAt: 'asc' | 'desc' };
          select?: {
            id: true;
            characterId: true;
            itemId: true;
            state: true;
            createdAt: true;
            updatedAt: true;
          };
        }): Promise<Array<{
          id: string;
          characterId: string;
          itemId: string;
          state: unknown;
          createdAt: Date;
          updatedAt: Date;
        }>>;
        update(args: {
          where: { id: string };
          data: { state: Record<string, unknown> | null };
          select?: {
            id: true;
            characterId: true;
            itemId: true;
            state: true;
            createdAt: true;
            updatedAt: true;
          };
        }): Promise<{
          id: string;
          characterId: string;
          itemId: string;
          state: unknown;
          createdAt: Date;
          updatedAt: Date;
        }>;
        create(args: {
          data: { characterId: string; itemId: string; state: Record<string, unknown> | null };
          select?: {
            id: true;
            characterId: true;
            itemId: true;
            state: true;
            createdAt: true;
            updatedAt: true;
          };
        }): Promise<{
          id: string;
          characterId: string;
          itemId: string;
          state: unknown;
          createdAt: Date;
          updatedAt: Date;
        }>;
        delete(args: { where: { id: string } }): Promise<unknown>;
      };
    }).characterItemInstance ?? null;
  }

  private getActiveAdminItemById(itemId: string): AdminItem {
    const raw = this.contentService.getCollectionEntry('items', itemId) as AdminItem | null;
    if (!raw || raw.isEnabled === false) {
      throw new NotFoundException(`Item not found: ${itemId}`);
    }
    return raw;
  }

  private resolveEffectiveInstanceSockets(item: AdminItem, state: CharacterItemInstanceState | null): CharacterItemSocketState[] {
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

  private buildSocketActivationStatus(item: AdminItem, socket: CharacterItemSocketState, augmentItem: AdminItem): {
    status: 'active' | 'inactive';
    reason?: string;
  } {
    const augment = augmentItem.augment;
    if (!augment) {
      return {
        status: 'inactive',
        reason: 'Augment payload is missing on inserted item.',
      };
    }

    const required = new Set<string>();
    for (const value of augment.activationContexts ?? []) {
      if (typeof value === 'string' && value.trim().length > 0) {
        required.add(value.trim().toLowerCase());
      }
    }

    const baseSocket = (item.augmentSlots ?? []).find((entry) => entry.id === socket.socketId);
    for (const value of baseSocket?.activationContexts ?? []) {
      if (typeof value === 'string' && value.trim().length > 0) {
        required.add(value.trim().toLowerCase());
      }
    }

    if (required.size === 0) {
      return { status: 'active' };
    }

    const available = new Set<string>();
    const pushAvailable = (value: string | undefined | null): void => {
      if (typeof value === 'string' && value.trim().length > 0) {
        available.add(value.trim().toLowerCase());
      }
    };

    pushAvailable(`item:${item.id}`);
    pushAvailable(`itemtype:${item.type}`);
    pushAvailable(item.subtype ? `itemsubtype:${item.subtype}` : null);
    pushAvailable(item.damageCategory ? `damagecategory:${item.damageCategory}` : null);
    pushAvailable(item.physicalType ? `physicaltype:${item.physicalType}` : null);
    pushAvailable(item.elementType ? `elementtype:${item.elementType}` : null);
    pushAvailable(item.magicSchool ? `magicschool:${item.magicSchool}` : null);
    pushAvailable(`socket:${socket.socketId}`);
    for (const tag of item.tags ?? []) {
      pushAvailable(`tag:${tag}`);
    }

    const hasMatch = [...required].some((entry) => available.has(entry));
    if (hasMatch) {
      return { status: 'active' };
    }

    return {
      status: 'inactive',
      reason: `Activation context mismatch for socket ${socket.socketId}.`,
    };
  }

  private toPersistedItemInstanceState(state: CharacterItemInstanceState | null): Record<string, unknown> | null {
    if (!state) {
      return null;
    }
    return state as unknown as Record<string, unknown>;
  }

  private async warnAboutActionBarEntries(characterId: string, slots: CharacterActionSlot[]): Promise<void> {
    const inventoryRows: Array<{ id: string; itemId: string; quantity: number }> = await this.prisma.characterInventoryItem.findMany({
      where: { characterId },
      select: { id: true, itemId: true, quantity: true },
    });
    const inventoryItemIds = new Set(inventoryRows.filter((entry: { quantity: number }) => entry.quantity > 0).map((entry: { itemId: string }) => entry.itemId));
    const inventoryInstanceIds = new Set(inventoryRows.map((entry: { id: string }) => entry.id));
    const itemInstances = await this.getCharacterItemInstances(characterId);
    const itemInstanceIds = new Set(itemInstances.map((entry) => entry.id));
    const skillModel = this.getCharacterSkillModel();

    for (const slot of slots) {
      if (slot.kind === 'skill' && slot.refId) {
        const skillId = slot.refId;
        const skillDef = this.contentService.getCollectionEntry('skills', skillId) as Record<string, unknown> | null;
        if (!skillDef) {
          console.warn('[actionBar] warning', { characterId, slotId: slot.slotId, entryKind: 'skill', skillId, result: 'missing-skill-definition' });
          continue;
        }

        if (!skillModel) {
          console.warn('[actionBar] warning', { characterId, slotId: slot.slotId, entryKind: 'skill', skillId, result: 'skill-knowledge-check-unavailable' });
          continue;
        }

        const knownSkill = await skillModel.findFirst({ where: { characterId, skillId }, select: { id: true } });
        if (!knownSkill) {
          console.warn('[actionBar] warning', { characterId, slotId: slot.slotId, entryKind: 'skill', skillId, result: 'skill-not-learned-preserved' });
        }
        continue;
      }

      if (slot.kind === 'item' && slot.refId) {
        const itemId = slot.refId;
        try {
          this.contentService.resolveItemById(itemId);
        } catch {
          const rawItem = this.contentService.getCollectionEntry('items', itemId) as Record<string, unknown> | null;
          if (!rawItem) {
            console.warn('[actionBar] warning', { characterId, slotId: slot.slotId, entryKind: 'item', itemId, result: 'missing-item-definition' });
            continue;
          }
        }

        if (slot.itemInstanceId && !inventoryInstanceIds.has(slot.itemInstanceId) && !itemInstanceIds.has(slot.itemInstanceId)) {
          console.warn('[actionBar] warning', { characterId, slotId: slot.slotId, entryKind: 'item', itemId, itemInstanceId: slot.itemInstanceId, result: 'item-instance-missing-preserved' });
          continue;
        }

        if (!slot.itemInstanceId && !inventoryItemIds.has(itemId)) {
          console.warn('[actionBar] warning', { characterId, slotId: slot.slotId, entryKind: 'item', itemId, result: 'item-not-in-inventory-preserved' });
        }
      }
    }
  }

  private async ensureEquipmentSchema(): Promise<void> {
    const columns = ['necklace', 'outerwear', 'belt', 'ring1', 'ring2', 'ring3', 'legs'];

    for (const column of columns) {
      await this.prisma.$executeRawUnsafe(`ALTER TABLE "CharacterEquipment" ADD COLUMN IF NOT EXISTS "${column}" TEXT`);
    }

    // Keep startup compatible with databases that have not applied the latest migration yet.
    await this.prisma.$executeRawUnsafe('ALTER TABLE "CharacterEquipment" ADD COLUMN IF NOT EXISTS "equipmentState" JSONB');
  }

  private toEquipmentRecord(equipment: Equipment) {
    return {
      weapon: equipment.weapon,
      helmet: equipment.helmet,
      necklace: equipment.necklace,
      armor: equipment.armor,
      outerwear: equipment.outerwear,
      belt: equipment.belt,
      gloves: equipment.gloves,
      shield: equipment.shield,
      ring1: equipment.ring1,
      ring2: equipment.ring2,
      ring3: equipment.ring3,
      legs: equipment.legs,
      boots: equipment.boots,
    };
  }

  private getEquipmentStateFromRecord(record: CharacterEquipmentRecordRow): CharacterEquipmentState | null {
    return normalizeCharacterEquipmentState(record?.equipmentState ?? null);
  }

  private buildEquipmentStateForPersist(
    equipment: Equipment,
    previousState: CharacterEquipmentState | null,
    slotInstanceOverrides?: Partial<Record<keyof Equipment, string | null>>,
  ): CharacterEquipmentState {
    const slots: CharacterEquipmentState['slots'] = {};

    for (const slot of Object.keys(equipment) as Array<keyof Equipment>) {
      const itemId = equipment[slot];
      if (!itemId) {
        continue;
      }

      const prevSlot = previousState?.slots?.[slot];
      const override = slotInstanceOverrides?.[slot];
      const nextInstanceId = typeof override === 'string'
        ? override
        : override === null
          ? null
          : prevSlot?.itemInstanceId ?? null;

      slots[slot] = {
        itemId,
        itemInstanceId: nextInstanceId,
      };
    }

    return {
      version: 1,
      slots,
    };
  }

  private fromEquipmentRecord(record: CharacterEquipmentRecordRow): Equipment {
    const legacyEquipment: Equipment = {
      weapon: record?.weapon ?? null,
      helmet: record?.helmet ?? null,
      necklace: record?.necklace ?? null,
      armor: record?.armor ?? null,
      outerwear: record?.outerwear ?? null,
      belt: record?.belt ?? null,
      gloves: record?.gloves ?? null,
      shield: record?.shield ?? null,
      ring1: record?.ring1 ?? null,
      ring2: record?.ring2 ?? null,
      ring3: record?.ring3 ?? null,
      legs: record?.legs ?? null,
      boots: record?.boots ?? null,
    };

    const state = this.getEquipmentStateFromRecord(record);
    if (!state) {
      return legacyEquipment;
    }

    const next: Equipment = { ...legacyEquipment };
    for (const slot of Object.keys(next) as Array<keyof Equipment>) {
      const stateSlot = state.slots[slot];
      if (!stateSlot) {
        continue;
      }

      if (typeof stateSlot.itemId === 'string' && stateSlot.itemId.trim().length > 0) {
        next[slot] = stateSlot.itemId.trim();
      } else if (stateSlot.itemId === null) {
        next[slot] = null;
      }
    }

    return next;
  }

  private cloneAdminItem<T extends AdminItem>(item: T): T {
    return JSON.parse(JSON.stringify(item)) as T;
  }

  private buildEffectiveEquippedItemsBySlot(
    equipment: Equipment,
    equipmentState: CharacterEquipmentState | null,
    itemInstances: CharacterItemInstanceRecord[],
  ): Partial<Record<keyof Equipment, AdminItem | null>> {
    const byInstanceId = new Map(itemInstances.map((entry) => [entry.id, entry] as const));
    const next: Partial<Record<keyof Equipment, AdminItem | null>> = {};

    for (const slot of Object.keys(equipment) as Array<keyof Equipment>) {
      const itemId = equipment[slot];
      if (!itemId) {
        next[slot] = null;
        continue;
      }

      const baseItem = this.contentService.resolveAdminItemById(itemId);
      if (!baseItem) {
        next[slot] = null;
        continue;
      }

      const itemInstanceId = equipmentState?.slots?.[slot]?.itemInstanceId ?? null;
      const instance = itemInstanceId ? byInstanceId.get(itemInstanceId) ?? null : null;
      const cloned = this.applyItemInstanceOverlay(baseItem, instance?.state ?? null);
      const socketOverrides = instance?.state?.augmentSlots ?? [];

      if (socketOverrides.length > 0) {
        const bySocketId = new Map(socketOverrides.map((entry) => [entry.socketId, entry] as const));
        cloned.augmentSlots = (cloned.augmentSlots ?? []).map((socket) => {
          const override = bySocketId.get(socket.id);
          return override
            ? {
              ...socket,
              socketedAugmentItemId: override.socketedAugmentItemId ?? undefined,
              isLocked: override.isLocked ?? socket.isLocked,
              source: override.source ?? socket.source,
            }
            : socket;
        });
      }

      next[slot] = cloned;
    }

    return next;
  }

  private applyItemInstanceOverlay(item: AdminItem, state: CharacterItemInstanceState | null): AdminItem {
    const snapshot = state?.itemSnapshot && state.itemSnapshot.isEnabled !== false
      ? this.cloneAdminItem(state.itemSnapshot)
      : this.cloneAdminItem(item);
    const bonuses = state?.statOverrides?.bonuses
      ? {
        ...(snapshot.bonuses ?? {}),
        ...state.statOverrides.bonuses,
      }
      : snapshot.bonuses;
    return {
      ...snapshot,
      id: item.id,
      name: state?.customName?.trim() || snapshot.name,
      damageMin: state?.statOverrides?.damageMin ?? snapshot.damageMin,
      damageMax: state?.statOverrides?.damageMax ?? snapshot.damageMax,
      armorValue: state?.statOverrides?.armorValue ?? snapshot.armorValue,
      price: state?.statOverrides?.price ?? snapshot.price,
      attackRange: state?.statOverrides?.attackRange ?? snapshot.attackRange,
      pierceTargets: state?.statOverrides?.pierceTargets ?? snapshot.pierceTargets,
      splashRadius: state?.statOverrides?.splashRadius ?? snapshot.splashRadius,
      splashCenterMultiplier: state?.statOverrides?.splashCenterMultiplier ?? snapshot.splashCenterMultiplier,
      splashOuterMultiplier: state?.statOverrides?.splashOuterMultiplier ?? snapshot.splashOuterMultiplier,
      bonuses,
      equipmentEffects: state?.statOverrides?.equipmentEffects ?? snapshot.equipmentEffects,
      augmentSlots: state?.statOverrides?.augmentSlots ?? snapshot.augmentSlots,
      maxAugmentSlots: state?.statOverrides?.maxAugmentSlots ?? snapshot.maxAugmentSlots,
      canAddAugmentSlots: state?.statOverrides?.canAddAugmentSlots ?? snapshot.canAddAugmentSlots,
      canHaveRuneComplex: state?.statOverrides?.canHaveRuneComplex ?? snapshot.canHaveRuneComplex,
      tags: Array.from(new Set([...(snapshot.tags ?? []), ...(state?.tags ?? [])])),
    };
  }

  private async readMap<TMap extends Record<string, unknown>>(key: string): Promise<TMap> {
    if (isFileStorageMode()) {
      // In file mode, read from runtime storage
      const data = await this.runtimeStore.readArenaData(key);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return {} as TMap;
      }
      return data as unknown as TMap;
    }
    const row = await this.prisma.contentStore.findUnique({ where: { key } });
    if (!row || !row.value || typeof row.value !== 'object' || Array.isArray(row.value)) {
      return {} as TMap;
    }
    return row.value as unknown as TMap;
  }

  private async writeMap(key: string, value: Record<string, unknown>): Promise<void> {
    if (isFileStorageMode()) {
      // In file mode, write to runtime storage
      await this.runtimeStore.writeArenaData(key, value);
      return;
    }
    const jsonValue = value as unknown as InputJsonValue;
    await this.prisma.contentStore.upsert({
      where: { key },
      create: { key, value: jsonValue },
      update: { value: jsonValue },
    });
  }

  private async ensureCharacterExists(characterId: string): Promise<void> {
    if (isFileStorageMode()) {
      const character = await this.runtimeStore.getCharacterById(characterId);

      if (!character) {
        throw new NotFoundException('Character not found.');
      }

      return;
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { id: true },
    });

    if (!character) {
      throw new NotFoundException('Character not found.');
    }
  }

  private createEmptyHotbar(): CharacterHotbarSlot[] {
    return Array.from({ length: HOTBAR_SLOT_COUNT }, (_, slotIndex) => ({
      slotIndex,
      itemId: null,
      itemInstanceId: null,
    }));
  }

  private createEmptyActionSlots(): CharacterActionSlot[] {
    return Array.from({ length: HOTBAR_SLOT_COUNT }, (_, slotIndex) => ({
      slotId: this.toActionSlotId(slotIndex),
      slotIndex,
      kind: null,
      refId: null,
      itemInstanceId: null,
    }));
  }

  private normalizeHotbarSlots(slots: unknown): CharacterHotbarSlot[] {
    const base = this.createEmptyHotbar();
    if (!Array.isArray(slots)) {
      return base;
    }

    for (const entry of slots) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const raw = entry as Record<string, unknown>;
      const slotIndex = typeof raw.slotIndex === 'number' ? raw.slotIndex : -1;
      if (slotIndex < 0 || slotIndex >= HOTBAR_SLOT_COUNT) {
        continue;
      }

      base[slotIndex] = {
        slotIndex,
        itemId: typeof raw.itemId === 'string' && raw.itemId.trim().length > 0 ? raw.itemId.trim() : null,
        itemInstanceId: typeof raw.itemInstanceId === 'string' && raw.itemInstanceId.trim().length > 0
          ? raw.itemInstanceId.trim()
          : null,
      };
    }

    return base;
  }

  private normalizeActionSlots(slots: unknown): CharacterActionSlot[] {
    const base = this.createEmptyActionSlots();
    if (!Array.isArray(slots)) {
      return base;
    }

    for (const entry of slots) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const raw = entry as Record<string, unknown>;
      const slotIndexFromId = typeof raw.slotId === 'string' ? this.toActionSlotIndex(raw.slotId) : -1;
      const slotIndex = typeof raw.slotIndex === 'number' ? raw.slotIndex : slotIndexFromId;
      if (slotIndex < 0 || slotIndex >= HOTBAR_SLOT_COUNT) {
        continue;
      }

      const rawKind = raw.kind === 'skill' || raw.kind === 'item' || raw.kind === 'weapon' ? raw.kind : null;
      const refId = typeof raw.refId === 'string' && raw.refId.trim().length > 0 ? raw.refId.trim() : null;
      const maybeWeapon = rawKind === 'item' && refId
        ? ((this.contentService.getCollectionEntry('items', refId) as Record<string, unknown> | null)?.type === 'weapon')
        : false;
      const kind = rawKind === 'weapon' || maybeWeapon
        ? 'weapon'
        : rawKind;
      base[slotIndex] = {
        slotId: this.toActionSlotId(slotIndex),
        slotIndex,
        kind: kind && refId ? kind : null,
        refId: kind && refId ? refId : null,
        itemInstanceId: typeof raw.itemInstanceId === 'string' && raw.itemInstanceId.trim().length > 0
          ? raw.itemInstanceId.trim()
          : null,
        weaponInstanceId: typeof raw.weaponInstanceId === 'string' && raw.weaponInstanceId.trim().length > 0
          ? raw.weaponInstanceId.trim()
          : null,
      };
    }

    return base;
  }

  private isItemUsableInHotbar(itemId: string): boolean {
    const rawItem = this.contentService.getCollectionEntry('items', itemId) as Record<string, unknown> | null;

    try {
      const item = this.contentService.resolveItemById(itemId);
      return item.itemType === 'consumable';
    } catch {
      // Fall through to raw admin item checks.
    }

    if (!rawItem) {
      return false;
    }

    return rawItem.slot === 'quick'
      || rawItem.type === 'potion'
      || rawItem.isUsable === true
      || rawItem.usableInCombat === true
      || rawItem.isCombatUsable === true
      || (Array.isArray(rawItem.useEffects) && rawItem.useEffects.length > 0)
      || Object.prototype.hasOwnProperty.call(rawItem, 'useEffect')
      || (Array.isArray(rawItem.effects) && rawItem.effects.length > 0)
      || (Array.isArray(rawItem.combatEffects) && rawItem.combatEffects.length > 0);
  }

  private async readCharacterHotbar(characterId: string): Promise<CharacterHotbarSlot[]> {
    const map = await this.readMap<StoredHotbarMap>(CHARACTER_HOTBAR_STORE_KEY);
    return this.normalizeHotbarSlots(map[characterId]);
  }

  private async readCharacterActionSlots(characterId: string): Promise<CharacterActionSlot[]> {
    const map = await this.readMap<StoredActionSlotMap>(CHARACTER_ACTION_SLOTS_STORE_KEY);
    return this.normalizeActionSlots(map[characterId]);
  }

  private async readCharacterPhysicalItemSlots(characterId: string): Promise<Set<CharacterActionSlotId>> {
    const map = await this.readMap<StoredActionSlotPhysicalMap>(CHARACTER_ACTION_SLOT_PHYSICAL_STORE_KEY);
    const value = map[characterId];
    if (!Array.isArray(value)) {
      return new Set<CharacterActionSlotId>();
    }

    return new Set<CharacterActionSlotId>(
      value
        .map((slotId) => this.toActionSlotId(this.toActionSlotIndex(slotId)))
        .filter((slotId) => this.toActionSlotIndex(slotId) >= 0),
    );
  }

  private async writeCharacterHotbar(characterId: string, slots: CharacterHotbarSlot[]): Promise<void> {
    const map = await this.readMap<StoredHotbarMap>(CHARACTER_HOTBAR_STORE_KEY);
    map[characterId] = this.normalizeHotbarSlots(slots);
    await this.writeMap(CHARACTER_HOTBAR_STORE_KEY, map);
  }

  async saveCharacterQuestState(characterId: string, state: Record<string, unknown>): Promise<Record<string, unknown>> {
    const character = isFileStorageMode()
      ? await this.runtimeStore.getCharacterById(characterId)
      : await this.prisma.character.findUnique({ where: { id: characterId }, select: { id: true } });
    if (!character) {
      throw new NotFoundException('Character not found.');
    }

    const questId = String(state.questId ?? '').trim();
    if (!questId) {
      throw new BadRequestException('questId is required.');
    }

    const map = await this.readMap<Record<string, Record<string, unknown>[]>>(CHARACTER_QUEST_STATES_STORE_KEY);
    const current = Array.isArray(map[characterId]) ? map[characterId] : [];
    const nextState = {
      ...state,
      playerId: characterId,
      questId,
    };
    map[characterId] = [
      ...current.filter((entry) => String(entry?.questId ?? '').trim() !== questId),
      nextState,
    ];
    await this.writeMap(CHARACTER_QUEST_STATES_STORE_KEY, map);
    return nextState;
  }

  private async writeCharacterActionSlots(characterId: string, slots: CharacterActionSlot[]): Promise<void> {
    const map = await this.readMap<StoredActionSlotMap>(CHARACTER_ACTION_SLOTS_STORE_KEY);
    map[characterId] = this.normalizeActionSlots(slots);
    await this.writeMap(CHARACTER_ACTION_SLOTS_STORE_KEY, map);
  }

  private async writeCharacterPhysicalItemSlots(characterId: string, slotIds: Set<CharacterActionSlotId>): Promise<void> {
    const map = await this.readMap<StoredActionSlotPhysicalMap>(CHARACTER_ACTION_SLOT_PHYSICAL_STORE_KEY);
    map[characterId] = [...slotIds].sort((left, right) => this.toActionSlotIndex(left) - this.toActionSlotIndex(right));
    await this.writeMap(CHARACTER_ACTION_SLOT_PHYSICAL_STORE_KEY, map);
  }

  async getPhysicalItemActionSlotIds(characterId: string): Promise<string[]> {
    const slotIds = await this.readCharacterPhysicalItemSlots(characterId);
    return [...slotIds];
  }

  async consumePhysicalItemActionSlot(characterId: string, itemId: string): Promise<CharacterActionSlot[] | null> {
    const slots = await this.getOrCreateActionSlots(characterId);
    const physicalSlotIds = await this.readCharacterPhysicalItemSlots(characterId);
    const target = slots.find((slot) => slot.kind === 'item' && slot.refId === itemId && physicalSlotIds.has(slot.slotId));
    if (!target) {
      return null;
    }

    const next = slots.map((slot) => {
      if (slot.slotId !== target.slotId) {
        return slot;
      }
      return {
        ...slot,
        kind: null,
        refId: null,
        itemInstanceId: null,
      };
    });
    physicalSlotIds.delete(target.slotId);
    await this.writeCharacterActionSlots(characterId, next);
    await this.writeCharacterPhysicalItemSlots(characterId, physicalSlotIds);
    return next;
  }

  private async readCharacterResourceMap(characterId: string): Promise<StoredResourceMap[string]> {
    const map = await this.readMap<StoredResourceMap>(CHARACTER_RESOURCES_STORE_KEY);
    return map[characterId];
  }

  private async writeCharacterResourceMap(characterId: string, value: NonNullable<StoredResourceMap[string]>): Promise<void> {
    const map = await this.readMap<StoredResourceMap>(CHARACTER_RESOURCES_STORE_KEY);
    map[characterId] = value;
    await this.writeMap(CHARACTER_RESOURCES_STORE_KEY, map);
  }

  private buildResourceState(activeStats: StatBlock, stored?: StoredResourceMap[string]): CharacterResourceState {
    const maxHp = Math.max(1, activeStats.hp);
    const maxMp = Math.max(0, activeStats.mp);
    const maxStamina = Math.max(0, activeStats.stamina);

    return {
      currentHp: Math.max(0, Math.min(maxHp, typeof stored?.currentHp === 'number' ? stored.currentHp : maxHp)),
      maxHp,
      currentMp: Math.max(0, Math.min(maxMp, typeof stored?.currentMp === 'number' ? stored.currentMp : maxMp)),
      maxMp,
      currentStamina: Math.max(0, Math.min(maxStamina, typeof stored?.currentStamina === 'number' ? stored.currentStamina : maxStamina)),
      maxStamina,
      hpRegenPerTurn: typeof stored?.hpRegenPerTurn === 'number' ? Math.max(0, stored.hpRegenPerTurn) : 0,
    };
  }

  async getOrCreateHotbar(characterId: string): Promise<CharacterHotbarSlot[]> {
    if (!isFileStorageMode()) {
      this.assertDatabaseEnabled();
      await this.ensureCharacterExists(characterId);
    } else {
      const char = await this.runtimeStore.getCharacterById(characterId);
      if (!char) throw new NotFoundException('Character not found.');
      return this.readCharacterHotbar(characterId);
    }

    const inventoryRows: Array<{ itemId: string; quantity: number }> = await this.prisma.characterInventoryItem.findMany({
      where: { characterId },
      select: { itemId: true, quantity: true },
    });
    const inventoryByItemId = new Map<string, number>(inventoryRows.map((entry: { itemId: string; quantity: number }) => [entry.itemId, entry.quantity]));

    const current = await this.readCharacterHotbar(characterId);
    const reconciled = this.normalizeHotbarSlots(current).map((slot) => {
      if (!slot.itemId) {
        return slot;
      }

      const quantity = inventoryByItemId.get(slot.itemId) ?? 0;
      if (quantity <= 0 || !this.isItemUsableInHotbar(slot.itemId)) {
        return { ...slot, itemId: null, itemInstanceId: null };
      }

      return slot;
    });

    if (JSON.stringify(current) !== JSON.stringify(reconciled)) {
      await this.writeCharacterHotbar(characterId, reconciled);
    }

    return reconciled;
  }

  async getOrCreateActionSlots(characterId: string): Promise<CharacterActionSlot[]> {
    if (!isFileStorageMode()) {
      this.assertDatabaseEnabled();
      await this.ensureCharacterExists(characterId);
    } else {
      const char = await this.runtimeStore.getCharacterById(characterId);
      if (!char) throw new NotFoundException('Character not found.');
    }

    const current = await this.readCharacterActionSlots(characterId);
    const physicalSlotIds = await this.readCharacterPhysicalItemSlots(characterId);
    const validPhysicalSlotIds = new Set<CharacterActionSlotId>(
      current
        .filter((slot) => slot.kind === 'item' && slot.refId && physicalSlotIds.has(slot.slotId))
        .map((slot) => slot.slotId),
    );
    if (validPhysicalSlotIds.size !== physicalSlotIds.size) {
      await this.writeCharacterPhysicalItemSlots(characterId, validPhysicalSlotIds);
    }

    const hasSavedEntries = current.some((slot) => slot.kind && slot.refId);
    if (hasSavedEntries) {
      return current;
    }

    const legacyHotbar = await this.readCharacterHotbar(characterId);
    const migrated = this.createEmptyActionSlots().map((slot) => {
      const legacy = legacyHotbar.find((entry) => entry.slotIndex === slot.slotIndex);
      if (!legacy?.itemId) {
        return slot;
      }
      return {
        slotId: slot.slotId,
        slotIndex: slot.slotIndex,
        kind: 'item' as const,
        refId: legacy.itemId,
        itemInstanceId: legacy.itemInstanceId ?? null,
      };
    });

    if (migrated.some((slot) => slot.kind && slot.refId)) {
      await this.writeCharacterActionSlots(characterId, migrated);
      return migrated;
    }

    await this.writeCharacterActionSlots(characterId, current);
    return current;
  }

  async getOrCreateActionBar(characterId: string): Promise<CharacterActionBarSlot[]> {
    const slots = await this.getOrCreateActionSlots(characterId);
    if (!isFileStorageMode()) {
      await this.warnAboutActionBarEntries(characterId, slots);
    }
    const actionBar = slots.map((slot) => this.toActionBarSlot(slot));
    console.info('[actionBar] load', { characterId, slots: actionBar });
    return actionBar;
  }

  async updateHotbar(
    characterId: string,
    updates: Array<{ slotIndex: number; itemId: string | null; itemInstanceId?: string | null }>,
  ): Promise<CharacterHotbarSlot[]> {
    let inventoryByItemId: Map<string, number>;

    if (isFileStorageMode()) {
      await this.requireRuntimeCharacter(characterId);
      const inventoryRows = await this.readRuntimeInventoryItems(characterId);
      inventoryByItemId = new Map(inventoryRows.map((entry) => [entry.itemId, entry.quantity] as const));
    } else {
      this.assertDatabaseEnabled();
      await this.ensureCharacterExists(characterId);
      const inventoryRows: Array<{ itemId: string; quantity: number }> = await this.prisma.characterInventoryItem.findMany({
        where: { characterId },
        select: { itemId: true, quantity: true },
      });
      inventoryByItemId = new Map<string, number>(inventoryRows.map((entry: { itemId: string; quantity: number }) => [entry.itemId, entry.quantity]));
    }

    const current = await this.getOrCreateHotbar(characterId);
    const next = this.normalizeHotbarSlots(current);

    for (const update of updates) {
      const slot = next.find((entry) => entry.slotIndex === update.slotIndex);
      if (!slot) {
        throw new BadRequestException(`Hotbar slot ${update.slotIndex} not found.`);
      }

      if (!update.itemId) {
        slot.itemId = null;
        slot.itemInstanceId = null;
        continue;
      }

      const quantity = inventoryByItemId.get(update.itemId) ?? 0;
      if (quantity <= 0) {
        throw new BadRequestException(`Item is not available in inventory: ${update.itemId}`);
      }
      if (!this.isItemUsableInHotbar(update.itemId)) {
        throw new BadRequestException('Only usable items can be assigned to the hotbar.');
      }

      slot.itemId = update.itemId;
      slot.itemInstanceId = update.itemInstanceId ?? null;
    }

    await this.writeCharacterHotbar(characterId, next);
    return next;
  }

  async updateActionSlots(
    characterId: string,
    updates: Array<{ slotIndex?: number; slotId?: string | null; kind: CharacterActionSlotKind; refId: string | null; itemInstanceId?: string | null; weaponInstanceId?: string | null }>,
  ): Promise<CharacterActionSlot[]> {
    let inventoryByItemId: Map<string, number>;

    if (isFileStorageMode()) {
      await this.requireRuntimeCharacter(characterId);
      const inventoryRows = await this.readRuntimeInventoryItems(characterId);
      inventoryByItemId = new Map(inventoryRows.map((entry) => [entry.itemId, entry.quantity] as const));
    } else {
      this.assertDatabaseEnabled();
      await this.ensureCharacterExists(characterId);
      const inventoryRows: Array<{ itemId: string; quantity: number }> = await this.prisma.characterInventoryItem.findMany({
        where: { characterId },
        select: { itemId: true, quantity: true },
      });
      inventoryByItemId = new Map<string, number>(inventoryRows.map((entry: { itemId: string; quantity: number }) => [entry.itemId, entry.quantity]));
    }

    const current = await this.getOrCreateActionSlots(characterId);
    const next = this.normalizeActionSlots(current);
    const physicalSlotIds = await this.readCharacterPhysicalItemSlots(characterId);
    const inventoryDeltas = new Map<string, number>();

    const addInventoryDelta = (itemId: string, delta: number): void => {
      const normalized = String(itemId ?? '').trim();
      if (!normalized || !Number.isFinite(delta) || delta === 0) {
        return;
      }
      const nextDelta = (inventoryDeltas.get(normalized) ?? 0) + delta;
      if (nextDelta === 0) {
        inventoryDeltas.delete(normalized);
      } else {
        inventoryDeltas.set(normalized, nextDelta);
      }
      inventoryByItemId.set(normalized, Math.max(0, (inventoryByItemId.get(normalized) ?? 0) + delta));
    };

    const releaseSlotIfPhysical = (slot: CharacterActionSlot): void => {
      if (slot.kind !== 'item' || !slot.refId || !physicalSlotIds.has(slot.slotId)) {
        return;
      }
      addInventoryDelta(slot.refId, 1);
      physicalSlotIds.delete(slot.slotId);
    };

    for (const update of updates) {
      const resolvedSlotIndex = typeof update.slotIndex === 'number'
        ? update.slotIndex
        : this.toActionSlotIndex(update.slotId);
      const slot = next.find((entry) => entry.slotIndex === resolvedSlotIndex);
      if (!slot) {
        throw new BadRequestException(`Action slot ${update.slotId ?? update.slotIndex ?? 'unknown'} not found.`);
      }

      releaseSlotIfPhysical(slot);

      if (!update.kind || !update.refId) {
        slot.kind = null;
        slot.refId = null;
        slot.itemInstanceId = null;
        slot.weaponInstanceId = null;
        continue;
      }

      if (update.kind === 'item' || update.kind === 'weapon') {
        const quantity = inventoryByItemId.get(update.refId) ?? 0;
        if (quantity <= 0) {
          throw new BadRequestException(`Item is not available in inventory: ${update.refId}`);
        }

        const rawItem = this.contentService.getCollectionEntry('items', update.refId) as Record<string, unknown> | null;
        const isWeapon = rawItem?.type === 'weapon';

        if (update.kind === 'weapon') {
          if (!isWeapon) {
            throw new BadRequestException(`Item is not a weapon: ${update.refId}`);
          }
          slot.kind = 'weapon';
          slot.refId = update.refId;
          slot.itemInstanceId = update.weaponInstanceId ?? update.itemInstanceId ?? null;
          slot.weaponInstanceId = update.weaponInstanceId ?? update.itemInstanceId ?? null;
          continue;
        }

        if (!this.isItemUsableInHotbar(update.refId) && !isWeapon) {
          throw new BadRequestException('Only usable items can be assigned to action slots.');
        }

        if (!isWeapon) {
          const quantity = inventoryByItemId.get(update.refId) ?? 0;
          if (quantity <= 0) {
            throw new BadRequestException(`Недостаточно предметов для назначения в слоты: ${update.refId}`);
          }
          addInventoryDelta(update.refId, -1);
          physicalSlotIds.add(slot.slotId);
        } else {
          physicalSlotIds.delete(slot.slotId);
        }

        slot.kind = isWeapon ? 'weapon' : 'item';
        slot.refId = update.refId;
        slot.itemInstanceId = update.itemInstanceId ?? null;
        slot.weaponInstanceId = isWeapon ? (update.weaponInstanceId ?? update.itemInstanceId ?? null) : null;
        continue;
      }

      slot.kind = 'skill';
      slot.refId = update.refId;
      slot.itemInstanceId = null;
      slot.weaponInstanceId = null;
      physicalSlotIds.delete(slot.slotId);
    }

    if (inventoryDeltas.size > 0) {
      if (isFileStorageMode()) {
        for (const [itemId, delta] of inventoryDeltas) {
          await this.updateRuntimeInventoryItemQuantity(characterId, itemId, delta);
        }
      } else {
        this.assertDatabaseEnabled();
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          for (const [itemId, delta] of inventoryDeltas) {
            if (delta > 0) {
              await this.incrementInventoryItem(tx, characterId, itemId, delta);
            } else if (delta < 0) {
              await this.decrementInventoryItem(tx, characterId, itemId, Math.abs(delta));
            }
          }
        });
      }
    }

    await this.writeCharacterActionSlots(characterId, next);
    await this.writeCharacterPhysicalItemSlots(characterId, physicalSlotIds);
    return next;
  }

  async updateActionBar(
    characterId: string,
    updates: Array<{
      slotId?: string | null;
      order?: number;
      entryKind?: CharacterActionBarEntryKind;
      skillId?: string | null;
      itemId?: string | null;
      itemInstanceId?: string | null;
      weaponItemId?: string | null;
      weaponInstanceId?: string | null;
    }>,
  ): Promise<CharacterActionBarSlot[]> {
    let inventoryByItemId: Map<string, number>;
    let inventoryInstanceIds: Set<string>;

    if (isFileStorageMode()) {
      await this.requireRuntimeCharacter(characterId);
      const inventoryRows = await this.readRuntimeInventoryItems(characterId);
      inventoryByItemId = new Map(inventoryRows.map((entry) => [entry.itemId, entry.quantity] as const));
      inventoryInstanceIds = new Set(inventoryRows.map((entry) => entry.id));
    } else {
      this.assertDatabaseEnabled();
      await this.ensureCharacterExists(characterId);
      const inventoryRows: Array<{ id: string; itemId: string; quantity: number }> = await this.prisma.characterInventoryItem.findMany({
        where: { characterId },
        select: { id: true, itemId: true, quantity: true },
      });
      inventoryByItemId = new Map<string, number>(inventoryRows.map((entry: { itemId: string; quantity: number }) => [entry.itemId, entry.quantity]));
      inventoryInstanceIds = new Set(inventoryRows.map((entry: { id: string }) => entry.id));
    }

    const itemInstances = await this.getCharacterItemInstances(characterId);
    const itemInstanceIds = new Set(itemInstances.map((entry) => entry.id));

    const skillModel = isFileStorageMode() ? null : this.getCharacterSkillModel();
    const normalizedUpdates: Array<{ slotIndex?: number; slotId?: string | null; kind: CharacterActionSlotKind; refId: string | null; itemInstanceId?: string | null; weaponInstanceId?: string | null }> = [];

    for (const update of updates) {
      const slotIndex = this.resolveActionBarSlotIndex(update.slotId, update.order);
      if (slotIndex < 0 || slotIndex >= HOTBAR_SLOT_COUNT) {
        console.warn('[actionBar] reject', { characterId, slotId: update.slotId ?? null, order: update.order ?? null, result: 'invalid-slot' });
        throw new BadRequestException(`Action bar slot ${update.slotId ?? update.order ?? 'unknown'} not found.`);
      }

      const slotId = this.toActionSlotId(slotIndex);
      const entryKind = update.entryKind ?? 'empty';

      if (entryKind === 'empty') {
        console.info('[actionBar] clear', { characterId, slotId, entryKind, result: 'cleared' });
        normalizedUpdates.push({ slotId, slotIndex, kind: null, refId: null, itemInstanceId: null, weaponInstanceId: null });
        continue;
      }

      if (entryKind === 'skill') {
        const skillId = typeof update.skillId === 'string' ? update.skillId.trim() : '';
        if (skillId.length === 0) {
          console.warn('[actionBar] reject', { characterId, slotId, entryKind, result: 'missing-skill-id' });
          throw new BadRequestException(`Skill entry for ${slotId} is missing skillId.`);
        }

        const skillDef = this.contentService.getCollectionEntry('skills', skillId) as Record<string, unknown> | null;
        if (!skillDef) {
          console.warn('[actionBar] reject', { characterId, slotId, entryKind, skillId, result: 'missing-skill-definition' });
          throw new BadRequestException(`Skill not found: ${skillId}`);
        }

        if (!skillModel) {
          console.warn('[actionBar] warning', { characterId, slotId, entryKind, skillId, result: 'skill-knowledge-check-unavailable' });
        } else {
          const knownSkill = await skillModel.findFirst({ where: { characterId, skillId }, select: { id: true } });
          if (!knownSkill) {
            console.warn('[actionBar] warning', { characterId, slotId, entryKind, skillId, result: 'skill-not-learned-preserved' });
          }
        }

        console.info('[actionBar] assignSkill', { characterId, slotId, entryKind, skillId, result: 'saved' });
        normalizedUpdates.push({ slotId, slotIndex, kind: 'skill', refId: skillId, itemInstanceId: null, weaponInstanceId: null });
        continue;
      }

      const itemId = typeof (entryKind === 'weapon' ? update.weaponItemId : update.itemId) === 'string'
        ? String(entryKind === 'weapon' ? update.weaponItemId : update.itemId).trim()
        : '';
      if (itemId.length === 0) {
        console.warn('[actionBar] reject', { characterId, slotId, entryKind, result: 'missing-item-id' });
        throw new BadRequestException(`Item entry for ${slotId} is missing ${entryKind === 'weapon' ? 'weaponItemId' : 'itemId'}.`);
      }

      try {
        this.contentService.resolveItemById(itemId);
      } catch {
        const rawItem = this.contentService.getCollectionEntry('items', itemId) as Record<string, unknown> | null;
        if (!rawItem) {
          console.warn('[actionBar] reject', { characterId, slotId, entryKind, itemId, result: 'missing-item-definition' });
          throw new BadRequestException(`Item not found: ${itemId}`);
        }
      }

      const itemInstanceIdRaw = entryKind === 'weapon' ? update.weaponInstanceId : update.itemInstanceId;
      const itemInstanceId = typeof itemInstanceIdRaw === 'string' && itemInstanceIdRaw.trim().length > 0
        ? itemInstanceIdRaw.trim()
        : null;
      if (itemInstanceId && !inventoryInstanceIds.has(itemInstanceId) && !itemInstanceIds.has(itemInstanceId)) {
        console.warn('[actionBar] reject', { characterId, slotId, entryKind, itemId, itemInstanceId, result: 'missing-item-instance' });
        throw new BadRequestException(`Item instance is not available in inventory: ${itemInstanceId}`);
      }

      const quantity = inventoryByItemId.get(itemId) ?? 0;
      if (quantity <= 0) {
        console.warn('[actionBar] reject', { characterId, slotId, entryKind, itemId, result: 'item-not-in-inventory' });
        throw new BadRequestException(`Item is not available in inventory: ${itemId}`);
      }

      const rawItem = this.contentService.getCollectionEntry('items', itemId) as Record<string, unknown> | null;
      const isWeaponEntry = entryKind === 'weapon' || rawItem?.type === 'weapon';
      const weaponItemId = isWeaponEntry
        ? (typeof update.weaponItemId === 'string' && update.weaponItemId.trim().length > 0 ? update.weaponItemId.trim() : itemId)
        : null;
      const weaponInstanceId = isWeaponEntry
        ? (typeof update.weaponInstanceId === 'string' && update.weaponInstanceId.trim().length > 0 ? update.weaponInstanceId.trim() : itemInstanceId)
        : null;

      if (isWeaponEntry && rawItem?.type !== 'weapon') {
        console.warn('[actionBar] reject', { characterId, slotId, entryKind, itemId, result: 'item-is-not-weapon' });
        throw new BadRequestException(`Item cannot be assigned as weapon in ${slotId}: ${itemId}`);
      }

      if (isWeaponEntry) {
        console.info('[actionBar] assignWeapon', { characterId, slotId, entryKind: 'weapon', weaponItemId, weaponInstanceId, result: 'saved' });
        normalizedUpdates.push({ slotId, slotIndex, kind: 'weapon', refId: weaponItemId, itemInstanceId: weaponInstanceId, weaponInstanceId });
      } else {
        console.info('[actionBar] assignItem', { characterId, slotId, entryKind, itemId, itemInstanceId, result: 'saved' });
        normalizedUpdates.push({ slotId, slotIndex, kind: 'item', refId: itemId, itemInstanceId });
      }
    }

    await this.updateActionSlots(characterId, normalizedUpdates);
    const actionBar = await this.getOrCreateActionBar(characterId);
    console.info('[actionBar] save', { characterId, slots: actionBar });
    return actionBar;
  }

  async getCharacterResources(characterId: string): Promise<CharacterResourceState> {
    const character = isFileStorageMode()
      ? await this.runtimeStore.getCharacterById(characterId)
      : await this.prisma.character.findUnique({
        where: { id: characterId },
        include: { equipment: true },
      });

    if (!character) {
      throw new NotFoundException('Character not found.');
    }

    const baseStats = this.toBaseStats(character);
    const equipment = isFileStorageMode()
      ? this.contentService.normalizeEquipment((character as { equipment?: Partial<Equipment> | null }).equipment ?? null)
      : this.fromEquipmentRecord((character as { equipment?: Record<string, unknown> | null }).equipment ?? null);
    const activeStats = this.contentService.getStatsWithEquipment(baseStats, equipment);
    const metadata = await this.metadataStore.get(characterId);
    const stored = await this.readCharacterResourceMap(characterId);
    const runtimeOverride = isFileStorageMode() && character
      ? {
        currentHp: typeof (character as any).currentHp === 'number' ? (character as any).currentHp
          : typeof (character as any).hp === 'number' ? (character as any).hp
            : undefined,
        currentMp: typeof (character as any).currentMp === 'number' ? (character as any).currentMp
          : typeof (character as any).mp === 'number' ? (character as any).mp
            : undefined,
        currentStamina: typeof (character as any).currentStamina === 'number' ? (character as any).currentStamina
          : typeof (character as any).stamina === 'number' ? (character as any).stamina
            : undefined,
      }
      : null;

    const effectiveStored = runtimeOverride
      ? {
        ...stored,
        currentHp: typeof stored?.currentHp === 'number' ? stored.currentHp : runtimeOverride.currentHp,
        currentMp: typeof stored?.currentMp === 'number' ? stored.currentMp : runtimeOverride.currentMp,
        currentStamina: typeof stored?.currentStamina === 'number' ? stored.currentStamina : runtimeOverride.currentStamina,
      }
      : stored;

    const resourceState = this.buildResourceState(
      {
        ...activeStats,
        stamina: Math.max(0, Math.round(activeStats.stamina * getKingdomMaxStaminaMultiplier(metadata.citizenshipKingdomId))),
      },
      effectiveStored,
    );

    await this.writeCharacterResourceMap(characterId, {
      currentHp: resourceState.currentHp,
      currentMp: resourceState.currentMp,
      currentStamina: resourceState.currentStamina,
      hpRegenPerTurn: resourceState.hpRegenPerTurn,
    });

    return resourceState;
  }

  async updateCharacterResources(
    characterId: string,
    updates: Partial<Pick<CharacterResourceState, 'currentHp' | 'currentMp' | 'currentStamina' | 'hpRegenPerTurn'>>,
  ): Promise<CharacterResourceState> {
    const current = await this.getCharacterResources(characterId);
    const next: CharacterResourceState = {
      ...current,
      currentHp: typeof updates.currentHp === 'number' ? Math.max(0, Math.min(current.maxHp, updates.currentHp)) : current.currentHp,
      currentMp: typeof updates.currentMp === 'number' ? Math.max(0, Math.min(current.maxMp, updates.currentMp)) : current.currentMp,
      currentStamina: typeof updates.currentStamina === 'number'
        ? Math.max(0, Math.min(current.maxStamina, updates.currentStamina))
        : current.currentStamina,
      hpRegenPerTurn: typeof updates.hpRegenPerTurn === 'number' ? Math.max(0, updates.hpRegenPerTurn) : current.hpRegenPerTurn,
    };

    await this.writeCharacterResourceMap(characterId, {
      currentHp: next.currentHp,
      currentMp: next.currentMp,
      currentStamina: next.currentStamina,
      hpRegenPerTurn: next.hpRegenPerTurn,
    });

    return next;
  }

  async adjustInventoryItemQuantityForDev(characterId: string, itemId: string, quantityDelta: number): Promise<void> {
    const normalizedItemId = String(itemId ?? '').trim();
    const safeDelta = Math.trunc(Number(quantityDelta));

    if (!normalizedItemId) {
      throw new BadRequestException('itemId is required.');
    }

    if (!Number.isFinite(safeDelta) || safeDelta === 0) {
      throw new BadRequestException('quantityDelta must be a non-zero number.');
    }

    this.contentService.resolveItemById(normalizedItemId);

    if (isFileStorageMode()) {
      await this.requireRuntimeCharacter(characterId);
      await this.updateRuntimeInventoryItemQuantity(characterId, normalizedItemId, safeDelta);
      return;
    }

    this.assertDatabaseEnabled();
    await this.ensureCharacterExists(characterId);
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (safeDelta > 0) {
        await this.incrementInventoryItem(tx, characterId, normalizedItemId, safeDelta);
        return;
      }

      await this.decrementInventoryItem(tx, characterId, normalizedItemId, Math.abs(safeDelta));
    });
  }

  private async sanitizeAllCharactersInventoryAndEquipment(): Promise<void> {
    const characters = await this.prisma.character.findMany({
      include: {
        inventoryItems: true,
        equipment: true,
      },
    });

    for (const character of characters) {
      await this.sanitizeCharacterInventoryAndEquipment({
        characterId: character.id,
        inventoryItems: character.inventoryItems.map((entry: InventoryItemRow) => ({
          id: entry.id,
          itemId: entry.itemId,
          quantity: entry.quantity,
        })),
        equipment: this.fromEquipmentRecord(character.equipment),
      });
    }
  }

  private async sanitizeCharacterInventoryAndEquipment(params: {
    characterId: string;
    inventoryItems: Array<{ id: string; itemId: string; quantity: number }>;
    equipment: Equipment;
  }): Promise<{
    inventoryItems: Array<{ id: string; itemId: string; quantity: number }>;
    equipment: Equipment;
  }> {
    const canonicalItemIds = new Set(this.contentService.getCanonicalItemIds({ enabledOnly: true }));
    const invalidInventoryItemIds = params.inventoryItems
      .filter((entry) => !canonicalItemIds.has(entry.itemId))
      .map((entry) => entry.id);

    const nextEquipment: Equipment = { ...params.equipment };
    let equipmentChanged = false;

    const isItemAllowedInSlot = (slot: keyof Equipment, itemId: string): boolean => {
      try {
        const item = this.contentService.resolveItemById(itemId);
        if (slot === 'weapon') {
          return item.itemType === 'weapon';
        }

        if (slot === 'shield') {
          return item.itemType === 'shield' || (item.itemType === 'weapon' && (item.handsRequired ?? 1) === 1);
        }

        if (slot === 'ring1' || slot === 'ring2' || slot === 'ring3') {
          return item.itemType === 'ring';
        }

        return item.itemType === slot;
      } catch {
        return false;
      }
    };

    for (const slot of Object.keys(nextEquipment) as Array<keyof Equipment>) {
      const itemId = nextEquipment[slot];
      if (itemId && (!canonicalItemIds.has(itemId) || !isItemAllowedInSlot(slot, itemId))) {
        nextEquipment[slot] = null;
        equipmentChanged = true;
      }
    }

    if (nextEquipment.weapon) {
      try {
        const weapon = this.contentService.resolveItemById(nextEquipment.weapon);
        if (weapon.itemType === 'weapon' && (weapon.handsRequired ?? 1) === 2 && nextEquipment.shield) {
          nextEquipment.shield = null;
          equipmentChanged = true;
        }
      } catch {
        // Ignore stale records here; previous checks already cleaned invalid ids.
      }
    }

    const equippedItemCounts = new Map<string, number>();
    for (const itemId of Object.values(nextEquipment)) {
      if (!itemId) {
        continue;
      }
      equippedItemCounts.set(itemId, (equippedItemCounts.get(itemId) ?? 0) + 1);
    }

    const inventoryAdjustments: Array<{ id: string; quantity: number }> = [];
    const sanitizedInventoryItems: Array<{ id: string; itemId: string; quantity: number }> = [];

    for (const entry of params.inventoryItems) {
      if (!canonicalItemIds.has(entry.itemId)) {
        continue;
      }

      const equippedCount = equippedItemCounts.get(entry.itemId) ?? 0;
      const nextQuantity = Math.max(0, entry.quantity - equippedCount);
      if (nextQuantity !== entry.quantity) {
        inventoryAdjustments.push({ id: entry.id, quantity: nextQuantity });
      }

      if (nextQuantity > 0) {
        sanitizedInventoryItems.push({ ...entry, quantity: nextQuantity });
      }
    }

    if (invalidInventoryItemIds.length === 0 && inventoryAdjustments.length === 0 && !equipmentChanged) {
      return {
        inventoryItems: params.inventoryItems,
        equipment: params.equipment,
      };
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (invalidInventoryItemIds.length > 0) {
        await tx.characterInventoryItem.deleteMany({
          where: {
            id: {
              in: invalidInventoryItemIds,
            },
          },
        });
      }

      for (const adjustment of inventoryAdjustments) {
        if (adjustment.quantity <= 0) {
          await tx.characterInventoryItem.delete({
            where: { id: adjustment.id },
          });
        } else {
          await tx.characterInventoryItem.update({
            where: { id: adjustment.id },
            data: { quantity: adjustment.quantity },
          });
        }
      }

      if (equipmentChanged) {
        await tx.characterEquipment.upsert({
          where: { characterId: params.characterId },
          update: this.toEquipmentRecord(nextEquipment),
          create: {
            characterId: params.characterId,
            ...this.toEquipmentRecord(nextEquipment),
          },
        });
      }
    });

    return {
      inventoryItems: sanitizedInventoryItems,
      equipment: nextEquipment,
    };
  }

  private async incrementInventoryItem(
    tx: Prisma.TransactionClient,
    characterId: string,
    itemId: string,
    quantity = 1,
  ): Promise<void> {
    const existing = await tx.characterInventoryItem.findUnique({
      where: { characterId_itemId: { characterId, itemId } },
    });

    if (existing) {
      await tx.characterInventoryItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
      return;
    }

    await tx.characterInventoryItem.create({
      data: { characterId, itemId, quantity },
    });
  }

  private async decrementInventoryItem(
    tx: Prisma.TransactionClient,
    characterId: string,
    itemId: string,
    quantity = 1,
  ): Promise<void> {
    const existing = await tx.characterInventoryItem.findUnique({
      where: { characterId_itemId: { characterId, itemId } },
    });

    if (!existing || existing.quantity < quantity) {
      throw new BadRequestException('Item is not in inventory.');
    }

    const nextQuantity = existing.quantity - quantity;
    if (nextQuantity <= 0) {
      await tx.characterInventoryItem.delete({
        where: { id: existing.id },
      });
      return;
    }

    await tx.characterInventoryItem.update({
      where: { id: existing.id },
      data: { quantity: nextQuantity },
    });
  }

  private isItemUsableOutsideCombat(itemId: string, itemType: string): boolean {
    if (itemType === 'consumable') {
      return true;
    }

    const adminItem = this.readAdminItemRecord(itemId);
    if (!adminItem) {
      return false;
    }

    return adminItem.isUsable === true
      || adminItem.usableInCombat === true
      || adminItem.isCombatUsable === true
      || adminItem.slot === 'quick'
      || adminItem.type === 'potion';
  }

  private resolveOutOfCombatItemRestore(itemId: string, itemSubType?: string): ItemResourceRestore {
    const adminItem = this.readAdminItemRecord(itemId);
    const effects = this.extractRawItemEffects(adminItem);
    const restore: ItemResourceRestore = { hp: 0, mp: 0, stamina: 0 };

    for (const effect of effects) {
      const type = String(effect.type ?? '').trim().toLowerCase();
      const amount = Number(effect.amount ?? effect.flat ?? effect.value);
      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }

      if (type === 'stat_bonus') {
        const stat = String(effect.stat ?? '').trim().toLowerCase();
        if (stat === 'hp' || stat === 'health') {
          restore.hp += Math.floor(amount);
          continue;
        }
        if (stat === 'mp' || stat === 'mana') {
          restore.mp += Math.floor(amount);
          continue;
        }
        if (stat === 'stamina' || stat === 'sta') {
          restore.stamina += Math.floor(amount);
          continue;
        }
      }

      if (type === 'restore_resource' || type === 'restoreresource' || type === 'restore' || type === 'heal_resource') {
        const resource = String(effect.resource ?? effect.stat ?? '').trim().toLowerCase();
        if (resource === 'hp' || resource === 'health') {
          restore.hp += Math.floor(amount);
          continue;
        }
        if (resource === 'mp' || resource === 'mana') {
          restore.mp += Math.floor(amount);
          continue;
        }
        if (resource === 'stamina' || resource === 'sta') {
          restore.stamina += Math.floor(amount);
          continue;
        }
      }

      if (type === 'heal_hp' || type === 'heal' || type === 'restore_hp') {
        restore.hp += Math.floor(amount);
        continue;
      }

      if (type === 'restore_mana' || type === 'heal_mana' || type === 'mana_restore') {
        restore.mp += Math.floor(amount);
        continue;
      }

      if (type === 'restore_stamina' || type === 'heal_stamina' || type === 'stamina_restore') {
        restore.stamina += Math.floor(amount);
      }
    }

    if (restore.hp > 0 || restore.mp > 0 || restore.stamina > 0) {
      return restore;
    }

    const normalizedSubType = String(itemSubType ?? '').trim().toLowerCase();
    if (normalizedSubType === 'small_heal') {
      return { hp: 40, mp: 0, stamina: 0 };
    }
    if (normalizedSubType === 'mana') {
      return { hp: 0, mp: 30, stamina: 0 };
    }
    if (normalizedSubType === 'stamina') {
      return { hp: 0, mp: 0, stamina: 25 };
    }

    throw new BadRequestException('У предмета нет эффекта использования.');
  }

  private readAdminItemRecord(itemId: string): Record<string, unknown> | null {
    const raw = this.contentService.getCollectionEntry('items', itemId);
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    return raw as unknown as Record<string, unknown>;
  }

  private extractRawItemEffects(raw: Record<string, unknown> | null): Array<Record<string, unknown>> {
    if (!raw) {
      return [];
    }

    const effects: Array<Record<string, unknown>> = [];
    const pushRecord = (value: unknown): void => {
      if (value && typeof value === 'object') {
        effects.push(value as Record<string, unknown>);
      }
    };

    if (Array.isArray(raw.useEffects)) {
      for (const entry of raw.useEffects) {
        pushRecord(entry);
      }
    }
    pushRecord(raw.useEffect);
    if (Array.isArray(raw.effects)) {
      for (const entry of raw.effects) {
        pushRecord(entry);
      }
    }
    if (Array.isArray(raw.combatEffects)) {
      for (const entry of raw.combatEffects) {
        pushRecord(entry);
      }
    }

    return effects;
  }

  private async getCharacterArenaState(characterId: string) {
    if (isFileStorageMode()) {
      return this.getCharacterArenaStateForFileMode(characterId);
    }

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: {
        inventoryItems: true,
        equipment: true,
      },
    });

    if (!character) {
      throw new NotFoundException('Character not found.');
    }

    const rawEquipment = this.fromEquipmentRecord(character.equipment);

    const sanitized = await this.sanitizeCharacterInventoryAndEquipment({
      characterId,
      inventoryItems: character.inventoryItems.map((entry: InventoryItemRow) => ({
        id: entry.id,
        itemId: entry.itemId,
        quantity: entry.quantity,
      })),
      equipment: rawEquipment,
    });

    const equipment = sanitized.equipment;
    const equipmentState = this.getEquipmentStateFromRecord(character.equipment);
    const itemInstances = await this.getCharacterItemInstances(characterId);
    const equippedItemsBySlot = this.buildEffectiveEquippedItemsBySlot(equipment, equipmentState, itemInstances);
    const actionSlots = await this.getOrCreateActionSlots(characterId);
    const physicalSlotIds = await this.readCharacterPhysicalItemSlots(characterId);
    const inventory: InventoryState = {
      gold: character.gold,
      items: this.applyItemSlotReservationsToInventory(
        sanitized.inventoryItems.map((entry) => ({
          itemId: entry.itemId,
          quantity: entry.quantity,
        })),
        actionSlots,
        physicalSlotIds,
      ),
    };

    const baseStats = this.toBaseStats(character);
    const activeStats = this.contentService.getStatsWithEquipment(baseStats, equipment, equippedItemsBySlot);
    const resources = await this.getCharacterResources(characterId);
    const metadata = await this.metadataStore.get(characterId);

    return {
      character: {
        id: character.id,
        name: character.name,
        race: character.race,
        level: character.level,
        exp: character.exp,
        freePoints: character.freePoints,
        baseStats,
        activeStats,
        currentHp: resources.currentHp,
        maxHp: resources.maxHp,
        currentMp: resources.currentMp,
        maxMp: resources.maxMp,
        currentStamina: resources.currentStamina,
        maxStamina: resources.maxStamina,
        hpRegenPerTurn: resources.hpRegenPerTurn,
        professions: metadata.startingProfessionIds.length > 0
          ? { professions: metadata.startingProfessionIds.map((professionId) => ({ professionId, level: 1, xp: 0, xpToNextLevel: 100, skillPoints: 0, learnedSkillIds: [], selectedBranchIds: [], unlockedAt: new Date().toISOString() })) }
          : undefined,
        citizenshipKingdomId: metadata.citizenshipKingdomId,
        kingdomReputation: metadata.kingdomReputation,
      },
      inventory,
      equipment,
      itemInstances,
      equipmentState,
      actionSlots,
    };
  }

  async getHubState(characterId: string) {
    return this.getCharacterArenaState(characterId);
  }

  async getMerchantStock(characterId: string, merchantId: string): Promise<{
    merchantId: string;
    refreshedAt: number;
    nextRefreshAt: number;
    stockByItemId: Record<string, number | null>;
  }> {
    const snapshot = await this.getOrRefreshMerchantStockState(characterId, merchantId);
    return {
      merchantId,
      refreshedAt: snapshot.lastRefreshAt,
      nextRefreshAt: snapshot.lastRefreshAt + MERCHANT_STOCK_RESTOCK_INTERVAL_MS,
      stockByItemId: snapshot.stockByItemId,
    };
  }

  private buildMerchantStockCatalog(merchantId: string): {
    stockByItemId: Record<string, number | null>;
    finiteBaseStockByItemId: Record<string, number>;
  } {
    const stockByItemId: Record<string, number | null> = {};
    const finiteBaseStockByItemId: Record<string, number> = {};
    const merchant = this.contentService.getCollectionEntry('merchants', merchantId) as {
      items?: Array<{ itemId?: string; isEnabled?: boolean; infiniteStock?: boolean; stock?: number }>;
    } | null;
    if (!merchant || !Array.isArray(merchant.items)) {
      return { stockByItemId, finiteBaseStockByItemId };
    }

    for (const entry of merchant.items) {
      const itemId = typeof entry?.itemId === 'string' ? entry.itemId.trim() : '';
      if (!itemId || entry?.isEnabled === false) {
        continue;
      }

      if (entry.infiniteStock !== false) {
        stockByItemId[itemId] = null;
        continue;
      }

      const normalizedStock = typeof entry.stock === 'number' && Number.isFinite(entry.stock)
        ? Math.max(0, Math.floor(entry.stock))
        : 0;
      stockByItemId[itemId] = normalizedStock;
      finiteBaseStockByItemId[itemId] = normalizedStock;
    }

    return { stockByItemId, finiteBaseStockByItemId };
  }

  private async getOrRefreshMerchantStockState(characterId: string, merchantId: string): Promise<{
    lastRefreshAt: number;
    stockByItemId: Record<string, number | null>;
  }> {
    const metadata = await this.metadataStore.get(characterId);
    const nowMs = Date.now();
    const { stockByItemId: baseStockByItemId, finiteBaseStockByItemId } = this.buildMerchantStockCatalog(merchantId);
    const finiteItemIds = Object.keys(finiteBaseStockByItemId);
    const stockStateMap = { ...(metadata.merchantStockByMerchantId ?? {}) };
    const existingState = stockStateMap[merchantId];
    const existingLastRefreshAt = Number(existingState?.lastRefreshAt ?? 0);
    const normalizedLastRefreshAt = Number.isFinite(existingLastRefreshAt) ? Math.max(0, Math.floor(existingLastRefreshAt)) : 0;
    const shouldRefresh = normalizedLastRefreshAt <= 0 || (nowMs - normalizedLastRefreshAt) >= MERCHANT_STOCK_RESTOCK_INTERVAL_MS;

    let runtimeFiniteStockByItemId: Record<string, number> = {};
    let nextLastRefreshAt = normalizedLastRefreshAt;
    let changed = false;

    if (shouldRefresh) {
      runtimeFiniteStockByItemId = { ...finiteBaseStockByItemId };
      nextLastRefreshAt = nowMs;
      changed = true;
    } else {
      const rawRuntimeStock = existingState?.stockByItemId ?? {};
      for (const itemId of finiteItemIds) {
        const rawRuntimeQuantity = Number((rawRuntimeStock as Record<string, unknown>)[itemId] ?? finiteBaseStockByItemId[itemId]);
        const normalizedRuntimeQuantity = Number.isFinite(rawRuntimeQuantity)
          ? Math.max(0, Math.floor(rawRuntimeQuantity))
          : finiteBaseStockByItemId[itemId];
        const clampedQuantity = Math.min(normalizedRuntimeQuantity, finiteBaseStockByItemId[itemId]);
        runtimeFiniteStockByItemId[itemId] = clampedQuantity;
      }

      const previousItemIds = Object.keys(rawRuntimeStock as Record<string, unknown>);
      if (previousItemIds.length !== finiteItemIds.length) {
        changed = true;
      } else if (finiteItemIds.some((itemId) => Number((rawRuntimeStock as Record<string, unknown>)[itemId] ?? -1) !== runtimeFiniteStockByItemId[itemId])) {
        changed = true;
      }
    }

    if (shouldRefresh || changed || !stockStateMap[merchantId]) {
      stockStateMap[merchantId] = {
        lastRefreshAt: nextLastRefreshAt,
        stockByItemId: runtimeFiniteStockByItemId,
      };
      await this.metadataStore.set(characterId, {
        ...metadata,
        merchantStockByMerchantId: stockStateMap,
      });
    }

    const mergedStockByItemId: Record<string, number | null> = {
      ...baseStockByItemId,
    };
    for (const itemId of finiteItemIds) {
      mergedStockByItemId[itemId] = runtimeFiniteStockByItemId[itemId] ?? finiteBaseStockByItemId[itemId] ?? 0;
    }

    return {
      lastRefreshAt: nextLastRefreshAt,
      stockByItemId: mergedStockByItemId,
    };
  }

  private async consumeMerchantFiniteStock(characterId: string, merchantId: string, itemId: string, quantity: number): Promise<void> {
    const safeQuantity = Math.max(1, Math.floor(quantity));
    const snapshot = await this.getOrRefreshMerchantStockState(characterId, merchantId);
    const currentStock = snapshot.stockByItemId[itemId];
    if (typeof currentStock !== 'number') {
      return;
    }

    const metadata = await this.metadataStore.get(characterId);
    const stockStateMap = { ...(metadata.merchantStockByMerchantId ?? {}) };
    const merchantState = stockStateMap[merchantId];
    if (!merchantState) {
      return;
    }

    merchantState.stockByItemId = {
      ...merchantState.stockByItemId,
      [itemId]: Math.max(0, currentStock - safeQuantity),
    };
    stockStateMap[merchantId] = merchantState;

    await this.metadataStore.set(characterId, {
      ...metadata,
      merchantStockByMerchantId: stockStateMap,
    });
  }

  async buyItem(characterId: string, itemId: string, merchantId: string, quantity = 1) {
    if (isFileStorageMode()) {
      return this.buyItemFileMode(characterId, itemId, merchantId, quantity);
    }
    this.assertDatabaseEnabled();
    const safeQuantity = Math.max(1, Math.floor(quantity));
    const state = await this.getCharacterArenaState(characterId);
    const unitPrice = await this.getAdjustedMerchantBuyPrice(characterId, merchantId, itemId);
    const totalPrice = unitPrice * safeQuantity;
    const stockState = await this.getOrRefreshMerchantStockState(characterId, merchantId);
    const finiteStock = stockState.stockByItemId[itemId];
    if (typeof finiteStock === 'number' && safeQuantity > finiteStock) {
      throw new BadRequestException(`У торговца доступно только ${finiteStock} шт.`);
    }

    if (state.inventory.gold < totalPrice) {
      throw new BadRequestException('Недостаточно золота.');
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.character.update({
        where: { id: characterId },
        data: { gold: state.inventory.gold - totalPrice },
      });

      const existing = await tx.characterInventoryItem.findUnique({
        where: { characterId_itemId: { characterId, itemId } },
      });

      if (existing) {
        await tx.characterInventoryItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + safeQuantity },
        });
      } else {
        await tx.characterInventoryItem.create({
          data: { characterId, itemId, quantity: safeQuantity },
        });
      }
    });

    if (typeof finiteStock === 'number') {
      await this.consumeMerchantFiniteStock(characterId, merchantId, itemId, safeQuantity);
    }

    return this.getCharacterArenaState(characterId);
  }

  async sellItem(characterId: string, itemId: string, quantity = 1) {
    if (isFileStorageMode()) {
      return this.sellItemFileMode(characterId, itemId, quantity);
    }
    this.assertDatabaseEnabled();
    const safeQuantity = Math.max(1, Math.floor(quantity));
    const state = await this.getCharacterArenaState(characterId);

    const inventoryEntry = state.inventory.items.find((entry) => entry.itemId === itemId);
    if (!inventoryEntry || inventoryEntry.quantity < safeQuantity) {
      throw new BadRequestException('Недостаточно предметов для продажи.');
    }

    const sellPrice = await this.getAdjustedMerchantSellPrice(characterId, null, itemId);
    const goldGain = sellPrice * safeQuantity;

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.character.update({
        where: { id: characterId },
        data: {
          gold: {
            increment: goldGain,
          },
        },
      });

      const existing = await tx.characterInventoryItem.findUnique({
        where: { characterId_itemId: { characterId, itemId } },
      });

      if (!existing) {
        throw new BadRequestException('Предмет не найден в инвентаре.');
      }

      if (existing.quantity === safeQuantity) {
        await tx.characterInventoryItem.delete({
          where: { id: existing.id },
        });
      } else {
        await tx.characterInventoryItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity - safeQuantity },
        });
      }
    });

    return this.getCharacterArenaState(characterId);
  }

  async useItem(characterId: string, itemId: string) {
    const state = await this.getCharacterArenaState(characterId);
    const inventoryEntry = state.inventory.items.find((entry) => entry.itemId === itemId);
    if (!inventoryEntry || inventoryEntry.quantity <= 0) {
      throw new BadRequestException('Item is not in inventory.');
    }

    const item = this.contentService.resolveItemById(itemId);
    if (!this.isItemUsableOutsideCombat(itemId, item.itemType)) {
      throw new BadRequestException('Этот предмет нельзя использовать вне боя.');
    }

    const restore = this.resolveOutOfCombatItemRestore(itemId, item.itemSubType);
    const resources = await this.getCharacterResources(characterId);
    const nextResources = {
      currentHp: Math.min(resources.maxHp, resources.currentHp + restore.hp),
      currentMp: Math.min(resources.maxMp, resources.currentMp + restore.mp),
      currentStamina: Math.min(resources.maxStamina, resources.currentStamina + restore.stamina),
    };
    if (
      nextResources.currentHp === resources.currentHp
      && nextResources.currentMp === resources.currentMp
      && nextResources.currentStamina === resources.currentStamina
    ) {
      throw new BadRequestException('Ресурс уже полон.');
    }

    if (isFileStorageMode()) {
      await this.updateRuntimeInventoryItemQuantity(characterId, itemId, -1);
      await this.updateCharacterResources(characterId, nextResources);
      return this.getCharacterArenaState(characterId);
    }

    this.assertDatabaseEnabled();
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.decrementInventoryItem(tx, characterId, itemId);
    });
    await this.updateCharacterResources(characterId, nextResources);

    return this.getCharacterArenaState(characterId);
  }

  async equipItem(characterId: string, itemId: string, preferredSlot?: keyof Equipment) {
    if (isFileStorageMode()) {
      return this.equipItemFileMode(characterId, itemId, preferredSlot);
    }
    this.assertDatabaseEnabled();
    const state = await this.getCharacterArenaState(characterId);
    const hasItem = state.inventory.items.find((entry) => entry.itemId === itemId && entry.quantity > 0);
    if (!hasItem) {
      throw new BadRequestException('Item is not in inventory.');
    }

    const check = this.contentService.canEquipItem(state.character.activeStats, itemId, state.equipment, preferredSlot);
    if (!check.ok) {
      throw new BadRequestException(check.reason ?? 'Cannot equip this item.');
    }

    const nextEquipment = this.contentService.equipItem(state.equipment, itemId, preferredSlot);
    const returnedItems = new Map<string, number>();
    for (const slot of Object.keys(state.equipment) as Array<keyof Equipment>) {
      const previousItemId = state.equipment[slot];
      if (previousItemId && previousItemId !== nextEquipment[slot]) {
        returnedItems.set(previousItemId, (returnedItems.get(previousItemId) ?? 0) + 1);
      }
    }

    const equipmentRow = await this.prisma.characterEquipment.findUnique({
      where: { characterId },
      select: {
        weapon: true,
        helmet: true,
        necklace: true,
        armor: true,
        outerwear: true,
        belt: true,
        gloves: true,
        shield: true,
        ring1: true,
        ring2: true,
        ring3: true,
        legs: true,
        boots: true,
        // Keep runtime compatibility with legacy JSON state if column exists.
        // Typed Prisma client may not expose this field in all environments.
      },
    });
    const equipmentState = this.getEquipmentStateFromRecord(equipmentRow);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.decrementInventoryItem(tx, characterId, itemId);

      for (const [returnedItemId, quantity] of returnedItems) {
        const wasInstanceEquipped = (Object.keys(state.equipment) as Array<keyof Equipment>).some((slot) => {
          const prevItem = state.equipment[slot];
          const replaced = prevItem === returnedItemId && prevItem !== nextEquipment[slot];
          return replaced && Boolean(equipmentState?.slots[slot]?.itemInstanceId);
        });
        if (wasInstanceEquipped) {
          continue;
        }
        await this.incrementInventoryItem(tx, characterId, returnedItemId, quantity);
      }

      const nextEquipmentState = this.buildEquipmentStateForPersist(nextEquipment, equipmentState);

      await tx.characterEquipment.upsert({
        where: { characterId },
        update: {
          ...this.toEquipmentRecord(nextEquipment),
          equipmentState: nextEquipmentState as unknown as Record<string, unknown>,
        } as any,
        create: {
          characterId,
          ...this.toEquipmentRecord(nextEquipment),
          equipmentState: nextEquipmentState as unknown as Record<string, unknown>,
        } as any,
      });
    });

    return this.getCharacterArenaState(characterId);
  }

  async unequipItem(characterId: string, slot: keyof Equipment) {
    if (isFileStorageMode()) {
      return this.unequipItemFileMode(characterId, slot);
    }
    this.assertDatabaseEnabled();
    const state = await this.getCharacterArenaState(characterId);
    const currentItem = state.equipment[slot];
    if (!currentItem) {
      throw new BadRequestException('Slot is already empty.');
    }

    const nextEquipment: Equipment = {
      ...state.equipment,
      [slot]: null,
    };

    const equipmentRow = await this.prisma.characterEquipment.findUnique({
      where: { characterId },
      select: {
        weapon: true,
        helmet: true,
        necklace: true,
        armor: true,
        outerwear: true,
        belt: true,
        gloves: true,
        shield: true,
        ring1: true,
        ring2: true,
        ring3: true,
        legs: true,
        boots: true,
        // Keep runtime compatibility with legacy JSON state if column exists.
        // Typed Prisma client may not expose this field in all environments.
      },
    });
    const equipmentState = this.getEquipmentStateFromRecord(equipmentRow);
    const unequippedInstanceId = equipmentState?.slots[slot]?.itemInstanceId ?? null;
    const nextEquipmentState = this.buildEquipmentStateForPersist(nextEquipment, equipmentState, { [slot]: null });

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.characterEquipment.upsert({
        where: { characterId },
        update: {
          ...this.toEquipmentRecord(nextEquipment),
          equipmentState: nextEquipmentState as unknown as Record<string, unknown>,
        } as any,
        create: {
          characterId,
          ...this.toEquipmentRecord(nextEquipment),
          equipmentState: nextEquipmentState as unknown as Record<string, unknown>,
        } as any,
      });

      if (!unequippedInstanceId) {
        await this.incrementInventoryItem(tx, characterId, currentItem);
      }
    });

    return this.getCharacterArenaState(characterId);
  }

  private resolveMerchantKingdomId(merchantId: string): string | null {
    const merchant = this.contentService.getCollectionEntry('merchants', merchantId) as { cityId?: string; placeId?: string } | null;
    if (!merchant) {
      return null;
    }
    if (merchant.cityId) {
      const city = this.contentService.getCollectionEntry('cities', merchant.cityId) as { kingdomId?: string } | null;
      return city?.kingdomId?.trim() || null;
    }
    return null;
  }

  private async getAdjustedMerchantBuyPrice(characterId: string, merchantId: string, itemId: string): Promise<number> {
    const basePrice = this.contentService.getMerchantItemPrice(merchantId, itemId);
    const metadata = await this.metadataStore.get(characterId);
    const kingdomId = this.resolveMerchantKingdomId(merchantId);
    if (!kingdomId) {
      return basePrice;
    }
    const modifiers = getMerchantPriceModifiers({
      kingdomReputation: metadata.kingdomReputation[kingdomId as keyof typeof metadata.kingdomReputation] ?? 0,
      playerKingdomId: metadata.citizenshipKingdomId ?? undefined,
    });
    if (modifiers.tradeBlocked) {
      throw new BadRequestException('Trade is blocked by kingdom reputation.');
    }
    return Math.max(1, Math.round(basePrice * modifiers.buyMultiplier));
  }

  private async getAdjustedMerchantSellPrice(characterId: string, merchantId: string | null, itemId: string): Promise<number> {
    const item = this.contentService.resolveItemById(itemId);
    const basePrice = Math.max(1, Math.floor(item.price * 0.55));
    const metadata = await this.metadataStore.get(characterId);
    if (!merchantId) {
      const modifiers = getMerchantPriceModifiers({
        kingdomReputation: 0,
        playerKingdomId: metadata.citizenshipKingdomId ?? undefined,
      });
      return Math.max(1, Math.round(basePrice * modifiers.sellMultiplier));
    }
    const kingdomId = this.resolveMerchantKingdomId(merchantId);
    if (!kingdomId) {
      return basePrice;
    }
    const modifiers = getMerchantPriceModifiers({
      kingdomReputation: metadata.kingdomReputation[kingdomId as keyof typeof metadata.kingdomReputation] ?? 0,
      playerKingdomId: metadata.citizenshipKingdomId ?? undefined,
    });
    if (modifiers.tradeBlocked) {
      throw new BadRequestException('Trade is blocked by kingdom reputation.');
    }
    return Math.max(1, Math.round(basePrice * modifiers.sellMultiplier));
  }

  private async buyItemFileMode(characterId: string, itemId: string, merchantId: string, quantity = 1) {
    const character = await this.requireRuntimeCharacter(characterId);
    const safeQuantity = Math.max(1, Math.floor(quantity));
    const unitPrice = await this.getAdjustedMerchantBuyPrice(characterId, merchantId, itemId);
    const totalPrice = unitPrice * safeQuantity;
    const stockState = await this.getOrRefreshMerchantStockState(characterId, merchantId);
    const finiteStock = stockState.stockByItemId[itemId];
    if (typeof finiteStock === 'number' && safeQuantity > finiteStock) {
      throw new BadRequestException(`У торговца доступно только ${finiteStock} шт.`);
    }
    const gold = Number((character as { gold?: unknown }).gold ?? 0) || 0;

    if (gold < totalPrice) {
      throw new BadRequestException('Недостаточно золота.');
    }

    await this.runtimeStore.updateCharacter(characterId, { gold: gold - totalPrice });
    await this.updateRuntimeInventoryItemQuantity(characterId, itemId, safeQuantity);

    if (typeof finiteStock === 'number') {
      await this.consumeMerchantFiniteStock(characterId, merchantId, itemId, safeQuantity);
    }

    return this.getCharacterArenaState(characterId);
  }

  private async sellItemFileMode(characterId: string, itemId: string, quantity = 1) {
    await this.requireRuntimeCharacter(characterId);
    const safeQuantity = Math.max(1, Math.floor(quantity));
    const inventoryItems = await this.readRuntimeInventoryItems(characterId);

    const row = inventoryItems.find((entry) => entry.itemId === itemId);
    if (!row || row.quantity < safeQuantity) {
      throw new BadRequestException('Недостаточно предметов для продажи.');
    }

    const sellPrice = await this.getAdjustedMerchantSellPrice(characterId, null, itemId);
    const goldGain = sellPrice * safeQuantity;

    const character = await this.requireRuntimeCharacter(characterId);
    const currentGold = Number((character as { gold?: unknown }).gold ?? 0) || 0;
    await this.runtimeStore.updateCharacter(characterId, { gold: currentGold + goldGain });
    await this.updateRuntimeInventoryItemQuantity(characterId, itemId, -safeQuantity);

    return this.getCharacterArenaState(characterId);
  }

  private async equipItemFileMode(characterId: string, itemId: string, preferredSlot?: keyof Equipment) {
    const character = await this.requireRuntimeCharacter(characterId);
    const baseStats = this.toBaseStats(character);
    const equipment = await this.readRuntimeEquipment(characterId);
    const activeStats = this.contentService.getStatsWithEquipment(baseStats, equipment);
    const inventoryItems = await this.readRuntimeInventoryItems(characterId);
    const hasItem = inventoryItems.some((entry) => entry.itemId === itemId && entry.quantity > 0);
    if (!hasItem) {
      throw new BadRequestException('Item is not in inventory.');
    }

    const check = this.contentService.canEquipItem(activeStats, itemId, equipment, preferredSlot);
    if (!check.ok) {
      throw new BadRequestException(check.reason ?? 'Cannot equip this item.');
    }

    const nextEquipment = this.contentService.equipItem(equipment, itemId, preferredSlot);
    const returnedItems = new Map<string, number>();
    for (const slot of Object.keys(equipment) as Array<keyof Equipment>) {
      const previousItemId = equipment[slot];
      if (previousItemId && previousItemId !== nextEquipment[slot]) {
        returnedItems.set(previousItemId, (returnedItems.get(previousItemId) ?? 0) + 1);
      }
    }

    await this.updateRuntimeInventoryItemQuantity(characterId, itemId, -1);
    for (const [returnedItemId, qty] of returnedItems) {
      await this.updateRuntimeInventoryItemQuantity(characterId, returnedItemId, qty);
    }
    await this.writeRuntimeEquipment(characterId, nextEquipment);

    return this.getCharacterArenaState(characterId);
  }

  private async unequipItemFileMode(characterId: string, slot: keyof Equipment) {
    await this.requireRuntimeCharacter(characterId);
    const equipment = await this.readRuntimeEquipment(characterId);
    const currentItem = equipment[slot];
    if (!currentItem) {
      throw new BadRequestException('Slot is already empty.');
    }

    const nextEquipment: Equipment = {
      ...equipment,
      [slot]: null,
    };

    await this.writeRuntimeEquipment(characterId, nextEquipment);
    await this.updateRuntimeInventoryItemQuantity(characterId, currentItem, 1);

    return this.getCharacterArenaState(characterId);
  }

  async getCharacterItemInstances(characterId: string): Promise<CharacterItemInstanceRecord[]> {
    if (isFileStorageMode()) {
      await this.requireRuntimeCharacter(characterId);
      return [];
    }

    this.assertDatabaseEnabled();
    await this.ensureCharacterExists(characterId);
    const model = this.getCharacterItemInstanceModel();
    if (!model) {
      return [];
    }

    const rows = await model.findMany({
      where: { characterId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        characterId: true,
        itemId: true,
        state: true,
        createdAt: true,
        updatedAt: true,
      },
    } as any);

    return rows.map((row) => ({
      id: row.id,
      characterId: row.characterId,
      itemId: row.itemId,
      state: normalizeCharacterItemInstanceState(row.state),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async getItemInstance(characterId: string, itemInstanceId: string): Promise<CharacterItemInstanceRecord> {
    const normalizedId = String(itemInstanceId ?? '').trim();
    if (!normalizedId) {
      throw new BadRequestException('itemInstanceId is required.');
    }

    const instances = await this.getCharacterItemInstances(characterId);
    const match = instances.find((entry) => entry.id === normalizedId);
    if (!match) {
      throw new NotFoundException('Item instance not found.');
    }

    return match;
  }

  async upsertCharacterItemInstance(params: {
    characterId: string;
    itemId: string;
    itemInstanceId?: string;
    state: CharacterItemInstanceState | null;
  }): Promise<CharacterItemInstanceRecord> {
    if (isFileStorageMode()) {
      throw new ServiceUnavailableException('Item instances are not available in local file mode.');
    }

    this.assertDatabaseEnabled();
    await this.ensureCharacterExists(params.characterId);
    const model = this.getCharacterItemInstanceModel();
    if (!model) {
      throw new InternalServerErrorException('Character item instance model is unavailable.');
    }

    const normalizedItemId = String(params.itemId ?? '').trim();
    const normalizedInstanceId = String(params.itemInstanceId ?? '').trim();
    if (!normalizedItemId) {
      throw new BadRequestException('itemId is required.');
    }

    const existing = normalizedInstanceId
      ? await model.findFirst({
        where: { characterId: params.characterId, id: normalizedInstanceId },
        select: { id: true, characterId: true, itemId: true, state: true, createdAt: true, updatedAt: true },
      })
      : await model.findFirst({
        where: { characterId: params.characterId, itemId: normalizedItemId },
        select: { id: true, characterId: true, itemId: true, state: true, createdAt: true, updatedAt: true },
      });

    if (existing) {
      const row = await model.update({
        where: { id: existing.id },
        data: { state: this.toPersistedItemInstanceState(params.state) },
        select: { id: true, characterId: true, itemId: true, state: true, createdAt: true, updatedAt: true },
      });
      return {
        id: row.id,
        characterId: row.characterId,
        itemId: row.itemId,
        state: normalizeCharacterItemInstanceState(row.state),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }

    const row = await model.create({
      data: {
        characterId: params.characterId,
        itemId: normalizedItemId,
        state: this.toPersistedItemInstanceState(params.state),
      },
      select: { id: true, characterId: true, itemId: true, state: true, createdAt: true, updatedAt: true },
    });
    return {
      id: row.id,
      characterId: row.characterId,
      itemId: row.itemId,
      state: normalizeCharacterItemInstanceState(row.state),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async deleteCharacterItemInstance(characterId: string, itemId: string, itemInstanceId?: string): Promise<void> {
    if (isFileStorageMode()) {
      throw new ServiceUnavailableException('Item instances are not available in local file mode.');
    }

    this.assertDatabaseEnabled();
    await this.ensureCharacterExists(characterId);
    const model = this.getCharacterItemInstanceModel();
    if (!model) {
      return;
    }

    const normalizedItemId = String(itemId ?? '').trim();
    const normalizedInstanceId = String(itemInstanceId ?? '').trim();
    const existing = normalizedInstanceId
      ? await model.findFirst({
        where: { characterId, id: normalizedInstanceId },
        select: { id: true, characterId: true, itemId: true, state: true, createdAt: true, updatedAt: true },
      })
      : await model.findFirst({
        where: { characterId, itemId: normalizedItemId },
        select: { id: true, characterId: true, itemId: true, state: true, createdAt: true, updatedAt: true },
      });

    if (!existing) {
      return;
    }

    await model.delete({ where: { id: existing.id } });
  }

  async equipItemInstance(characterId: string, itemInstanceId: string, preferredSlot?: keyof Equipment) {
    if (isFileStorageMode()) {
      throw new ServiceUnavailableException('Item instances are not available in local file mode.');
    }

    this.assertDatabaseEnabled();
    const instance = await this.getItemInstance(characterId, itemInstanceId);
    const state = await this.getCharacterArenaState(characterId);

    const check = this.contentService.canEquipItem(state.character.activeStats, instance.itemId, state.equipment, preferredSlot);
    if (!check.ok) {
      throw new BadRequestException(check.reason ?? 'Cannot equip this item instance.');
    }

    const nextEquipment = this.contentService.equipItem(state.equipment, instance.itemId, preferredSlot);
    const targetSlot = (Object.keys(nextEquipment) as Array<keyof Equipment>).find((slot) => {
      const becameThisItem = nextEquipment[slot] === instance.itemId && state.equipment[slot] !== instance.itemId;
      return becameThisItem;
    })
      ?? (Object.keys(nextEquipment) as Array<keyof Equipment>).find((slot) => nextEquipment[slot] === instance.itemId)
      ?? null;

    if (!targetSlot) {
      throw new BadRequestException('Failed to resolve equipment slot for item instance.');
    }

    const equipmentRow = await this.prisma.characterEquipment.findUnique({
      where: { characterId },
      select: {
        weapon: true,
        helmet: true,
        necklace: true,
        armor: true,
        outerwear: true,
        belt: true,
        gloves: true,
        shield: true,
        ring1: true,
        ring2: true,
        ring3: true,
        legs: true,
        boots: true,
        equipmentState: true,
      },
    } as any);
    const equipmentState = this.getEquipmentStateFromRecord(equipmentRow);

    const returnedItems = new Map<string, number>();
    for (const slot of Object.keys(state.equipment) as Array<keyof Equipment>) {
      const previousItemId = state.equipment[slot];
      if (previousItemId && previousItemId !== nextEquipment[slot]) {
        returnedItems.set(previousItemId, (returnedItems.get(previousItemId) ?? 0) + 1);
      }
    }

    const slotOverrides: Partial<Record<keyof Equipment, string | null>> = {
      [targetSlot]: instance.id,
    };
    for (const slot of Object.keys(state.equipment) as Array<keyof Equipment>) {
      if (state.equipment[slot] !== nextEquipment[slot]) {
        const changedToSameTarget = slot === targetSlot;
        if (!changedToSameTarget) {
          slotOverrides[slot] = null;
        }
      }
    }
    const nextEquipmentState = this.buildEquipmentStateForPersist(nextEquipment, equipmentState, slotOverrides);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.characterInventoryItem.findUnique({
        where: { characterId_itemId: { characterId, itemId: instance.itemId } },
      });
      if (existing && existing.quantity > 0) {
        await this.decrementInventoryItem(tx, characterId, instance.itemId);
      }

      for (const [returnedItemId, quantity] of returnedItems) {
        const wasInstanceEquipped = (Object.keys(state.equipment) as Array<keyof Equipment>).some((slot) => {
          const prevItem = state.equipment[slot];
          const replaced = prevItem === returnedItemId && prevItem !== nextEquipment[slot];
          return replaced && Boolean(equipmentState?.slots[slot]?.itemInstanceId);
        });
        if (wasInstanceEquipped) {
          continue;
        }
        await this.incrementInventoryItem(tx, characterId, returnedItemId, quantity);
      }

      await tx.characterEquipment.upsert({
        where: { characterId },
        update: {
          ...this.toEquipmentRecord(nextEquipment),
          equipmentState: nextEquipmentState as unknown as Record<string, unknown>,
        },
        create: {
          characterId,
          ...this.toEquipmentRecord(nextEquipment),
          equipmentState: nextEquipmentState as unknown as Record<string, unknown>,
        },
      } as any);
    });

    return this.getCharacterArenaState(characterId);
  }

  async unequipItemInstance(characterId: string, itemInstanceId: string) {
    if (isFileStorageMode()) {
      throw new ServiceUnavailableException('Item instances are not available in local file mode.');
    }

    this.assertDatabaseEnabled();
    await this.getItemInstance(characterId, itemInstanceId);
    const state = await this.getCharacterArenaState(characterId);
    const equipmentRow = await this.prisma.characterEquipment.findUnique({
      where: { characterId },
      select: {
        weapon: true,
        helmet: true,
        necklace: true,
        armor: true,
        outerwear: true,
        belt: true,
        gloves: true,
        shield: true,
        ring1: true,
        ring2: true,
        ring3: true,
        legs: true,
        boots: true,
        equipmentState: true,
      },
    } as any);
    const equipmentState = this.getEquipmentStateFromRecord(equipmentRow);

    const slot = (Object.keys(state.equipment) as Array<keyof Equipment>).find(
      (entry) => equipmentState?.slots[entry]?.itemInstanceId === itemInstanceId,
    );

    if (!slot) {
      throw new BadRequestException('Item instance is not currently equipped.');
    }

    const currentItem = state.equipment[slot];
    if (!currentItem) {
      throw new BadRequestException('Slot is already empty.');
    }

    const nextEquipment: Equipment = {
      ...state.equipment,
      [slot]: null,
    };
    const nextEquipmentState = this.buildEquipmentStateForPersist(nextEquipment, equipmentState, { [slot]: null });

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.characterEquipment.upsert({
        where: { characterId },
        update: {
          ...this.toEquipmentRecord(nextEquipment),
          equipmentState: nextEquipmentState as unknown as Record<string, unknown>,
        },
        create: {
          characterId,
          ...this.toEquipmentRecord(nextEquipment),
          equipmentState: nextEquipmentState as unknown as Record<string, unknown>,
        },
      } as any);
    });

    return this.getCharacterArenaState(characterId);
  }

  async socketAugment(
    characterId: string,
    itemInstanceId: string,
    socketId: string,
    augmentItemId: string,
  ): Promise<SocketAugmentResult> {
    if (isFileStorageMode()) {
      throw new ServiceUnavailableException('Item instances are not available in local file mode.');
    }

    this.assertDatabaseEnabled();
    const normalizedSocketId = String(socketId ?? '').trim();
    const normalizedAugmentItemId = String(augmentItemId ?? '').trim();
    if (!normalizedSocketId) {
      throw new BadRequestException('socketId is required.');
    }
    if (!normalizedAugmentItemId) {
      throw new BadRequestException('augmentItemId is required.');
    }

    const instance = await this.getItemInstance(characterId, itemInstanceId);
    const targetItem = this.getActiveAdminItemById(instance.itemId);
    const augmentItem = this.getActiveAdminItemById(normalizedAugmentItemId);

    if (!augmentItem.augment) {
      throw new BadRequestException('Selected augment item has no augment payload.');
    }

    const sockets = this.resolveEffectiveInstanceSockets(targetItem, instance.state);
    const targetSocket = sockets.find((entry) => entry.socketId === normalizedSocketId);
    if (!targetSocket) {
      throw new BadRequestException(`Socket not found: ${normalizedSocketId}`);
    }
    if (targetSocket.isLocked) {
      throw new BadRequestException(`Socket is locked: ${normalizedSocketId}`);
    }
    if (targetSocket.socketedAugmentItemId) {
      throw new BadRequestException(`Socket is already occupied: ${normalizedSocketId}`);
    }

    const nextSlots = sockets.map((entry) => (
      entry.socketId === normalizedSocketId
        ? { ...entry, socketedAugmentItemId: normalizedAugmentItemId }
        : entry
    ));

    const nextState: CharacterItemInstanceState = {
      ...(instance.state ?? { version: 1 }),
      version: 1,
      augmentSlots: nextSlots,
    };

    const model = this.getCharacterItemInstanceModel();
    if (!model) {
      throw new ServiceUnavailableException('CharacterItemInstance model is not available.');
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.decrementInventoryItem(tx, characterId, normalizedAugmentItemId);
      await (tx as any).characterItemInstance.update({
        where: { id: instance.id },
        data: {
          state: this.toPersistedItemInstanceState(nextState),
        },
      });
    });

    const updated = await this.getItemInstance(characterId, instance.id);
    const updatedSocket = this.resolveEffectiveInstanceSockets(targetItem, updated.state).find((entry) => entry.socketId === normalizedSocketId);
    if (!updatedSocket) {
      throw new InternalServerErrorException('Socket update failed.');
    }

    const activation = this.buildSocketActivationStatus(targetItem, updatedSocket, augmentItem);
    return {
      itemInstance: updated,
      socket: updatedSocket,
      status: activation.status,
      reason: activation.reason,
    };
  }

  async unsocketAugment(
    characterId: string,
    itemInstanceId: string,
    socketId: string,
  ): Promise<UnsocketAugmentResult> {
    if (isFileStorageMode()) {
      throw new ServiceUnavailableException('Item instances are not available in local file mode.');
    }

    this.assertDatabaseEnabled();
    const normalizedSocketId = String(socketId ?? '').trim();
    if (!normalizedSocketId) {
      throw new BadRequestException('socketId is required.');
    }

    const instance = await this.getItemInstance(characterId, itemInstanceId);
    const targetItem = this.getActiveAdminItemById(instance.itemId);
    const sockets = this.resolveEffectiveInstanceSockets(targetItem, instance.state);
    const targetSocket = sockets.find((entry) => entry.socketId === normalizedSocketId);
    if (!targetSocket) {
      throw new BadRequestException(`Socket not found: ${normalizedSocketId}`);
    }
    if (targetSocket.isLocked) {
      throw new BadRequestException(`Socket is locked: ${normalizedSocketId}`);
    }
    if (!targetSocket.socketedAugmentItemId) {
      throw new BadRequestException(`Socket is empty: ${normalizedSocketId}`);
    }

    const returnedAugmentItemId = targetSocket.socketedAugmentItemId;
    const nextSlots = sockets.map((entry) => (
      entry.socketId === normalizedSocketId
        ? { ...entry, socketedAugmentItemId: null }
        : entry
    ));

    const nextState: CharacterItemInstanceState = {
      ...(instance.state ?? { version: 1 }),
      version: 1,
      augmentSlots: nextSlots,
    };

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await (tx as any).characterItemInstance.update({
        where: { id: instance.id },
        data: {
          state: this.toPersistedItemInstanceState(nextState),
        },
      });
      await this.incrementInventoryItem(tx, characterId, returnedAugmentItemId);
    });

    const updated = await this.getItemInstance(characterId, instance.id);
    const updatedSocket = this.resolveEffectiveInstanceSockets(targetItem, updated.state).find((entry) => entry.socketId === normalizedSocketId);
    if (!updatedSocket) {
      throw new InternalServerErrorException('Socket update failed.');
    }

    return {
      itemInstance: updated,
      socket: updatedSocket,
      returnedAugmentItemId,
    };
  }
}
