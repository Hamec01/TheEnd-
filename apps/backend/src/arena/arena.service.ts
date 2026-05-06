import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type Equipment,
  type InventoryState,
  type StatBlock,
} from '@theend/rpg-domain';
import { randomUUID } from 'crypto';
import { ContentService } from '../content/content.service';
import { isDatabaseEnabled, isFileStorageMode } from '../config/storage-mode';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeCharacterStore } from '../characters/runtime-character-store';

type InventoryItemRow = { id: string; itemId: string; quantity: number };

const ACTION_SLOT_IDS = ['quick1', 'quick2', 'quick3', 'quick4', 'quick5', 'quick6', 'quick7', 'quick8', 'quick9', 'quick10'] as const;

export type CharacterActionSlotId = (typeof ACTION_SLOT_IDS)[number];

export type CharacterActionSlotKind = 'skill' | 'item' | null;
export type CharacterActionBarEntryKind = 'skill' | 'item' | 'empty';

export interface CharacterActionSlot {
  slotId: CharacterActionSlotId;
  slotIndex: number;
  kind: CharacterActionSlotKind;
  refId: string | null;
  itemInstanceId?: string | null;
}

export interface CharacterActionBarSlot {
  slotId: CharacterActionSlotId;
  order: number;
  entryKind: CharacterActionBarEntryKind;
  skillId?: string;
  itemId?: string;
  itemInstanceId?: string | null;
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

type StoredHotbarMap = Record<string, CharacterHotbarSlot[] | undefined>;
type StoredActionSlotMap = Record<string, CharacterActionSlot[] | undefined>;
type StoredResourceMap = Record<string, {
  currentHp?: number;
  currentMp?: number;
  currentStamina?: number;
  hpRegenPerTurn?: number;
} | undefined>;

const CHARACTER_ACTION_SLOTS_STORE_KEY = 'character-action-slots-v1';
const CHARACTER_HOTBAR_STORE_KEY = 'character-item-hotbars-v1';
const CHARACTER_RESOURCES_STORE_KEY = 'character-runtime-resources-v1';
const CHARACTER_QUEST_STATES_STORE_KEY = 'character-quest-states-v1';
const HOTBAR_SLOT_COUNT = 10;

@Injectable()
export class ArenaService implements OnModuleInit {
  private readonly logger = new Logger(ArenaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
    private readonly runtimeStore: RuntimeCharacterStore,
  ) { }

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

    const baseStats = this.toBaseStats(character);
    const equipment = this.normalizeRuntimeEquipment((character as { equipment?: unknown }).equipment ?? null);
    const inventoryItems = this.normalizeRuntimeInventoryItems((character as { inventoryItems?: unknown }).inventoryItems);

    const activeStats = this.contentService.getStatsWithEquipment(baseStats, equipment);
    const resources = await this.getCharacterResources(characterId);
    const actionSlots = await this.getOrCreateActionSlots(characterId);

    const inventory: InventoryState = {
      gold: Number((character as { gold?: unknown }).gold ?? 0) || 0,
      items: inventoryItems.map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity })),
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
      },
      inventory,
      equipment,
      actionSlots,
    };
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

  private async warnAboutActionBarEntries(characterId: string, slots: CharacterActionSlot[]): Promise<void> {
    const inventoryRows = await this.prisma.characterInventoryItem.findMany({
      where: { characterId },
      select: { id: true, itemId: true, quantity: true },
    });
    const inventoryItemIds = new Set(inventoryRows.filter((entry) => entry.quantity > 0).map((entry) => entry.itemId));
    const inventoryInstanceIds = new Set(inventoryRows.map((entry) => entry.id));
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

        if (slot.itemInstanceId && !inventoryInstanceIds.has(slot.itemInstanceId)) {
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

  private fromEquipmentRecord(record: {
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
  } | null | undefined): Equipment {
    return {
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
    const jsonValue = value as Prisma.InputJsonValue;
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

      const kind = raw.kind === 'skill' || raw.kind === 'item' ? raw.kind : null;
      const refId = typeof raw.refId === 'string' && raw.refId.trim().length > 0 ? raw.refId.trim() : null;
      base[slotIndex] = {
        slotId: this.toActionSlotId(slotIndex),
        slotIndex,
        kind: kind && refId ? kind : null,
        refId: kind && refId ? refId : null,
        itemInstanceId: typeof raw.itemInstanceId === 'string' && raw.itemInstanceId.trim().length > 0
          ? raw.itemInstanceId.trim()
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

    const inventoryRows = await this.prisma.characterInventoryItem.findMany({
      where: { characterId },
      select: { itemId: true, quantity: true },
    });
    const inventoryByItemId = new Map(inventoryRows.map((entry) => [entry.itemId, entry.quantity] as const));

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
      const inventoryRows = await this.prisma.characterInventoryItem.findMany({
        where: { characterId },
        select: { itemId: true, quantity: true },
      });
      inventoryByItemId = new Map(inventoryRows.map((entry) => [entry.itemId, entry.quantity] as const));
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
    updates: Array<{ slotIndex?: number; slotId?: string | null; kind: CharacterActionSlotKind; refId: string | null; itemInstanceId?: string | null }>,
  ): Promise<CharacterActionSlot[]> {
    let inventoryByItemId: Map<string, number>;

    if (isFileStorageMode()) {
      await this.requireRuntimeCharacter(characterId);
      const inventoryRows = await this.readRuntimeInventoryItems(characterId);
      inventoryByItemId = new Map(inventoryRows.map((entry) => [entry.itemId, entry.quantity] as const));
    } else {
      this.assertDatabaseEnabled();
      await this.ensureCharacterExists(characterId);
      const inventoryRows = await this.prisma.characterInventoryItem.findMany({
        where: { characterId },
        select: { itemId: true, quantity: true },
      });
      inventoryByItemId = new Map(inventoryRows.map((entry) => [entry.itemId, entry.quantity] as const));
    }

    const current = await this.getOrCreateActionSlots(characterId);
    const next = this.normalizeActionSlots(current);

    for (const update of updates) {
      const resolvedSlotIndex = typeof update.slotIndex === 'number'
        ? update.slotIndex
        : this.toActionSlotIndex(update.slotId);
      const slot = next.find((entry) => entry.slotIndex === resolvedSlotIndex);
      if (!slot) {
        throw new BadRequestException(`Action slot ${update.slotId ?? update.slotIndex ?? 'unknown'} not found.`);
      }

      if (!update.kind || !update.refId) {
        slot.kind = null;
        slot.refId = null;
        slot.itemInstanceId = null;
        continue;
      }

      if (update.kind === 'item') {
        const quantity = inventoryByItemId.get(update.refId) ?? 0;
        if (quantity <= 0) {
          throw new BadRequestException(`Item is not available in inventory: ${update.refId}`);
        }
        if (!this.isItemUsableInHotbar(update.refId)) {
          throw new BadRequestException('Only usable items can be assigned to action slots.');
        }
        slot.kind = 'item';
        slot.refId = update.refId;
        slot.itemInstanceId = update.itemInstanceId ?? null;
        continue;
      }

      slot.kind = 'skill';
      slot.refId = update.refId;
      slot.itemInstanceId = null;
    }

    await this.writeCharacterActionSlots(characterId, next);
    return next;
  }

  async updateActionBar(
    characterId: string,
    updates: Array<{ slotId?: string | null; order?: number; entryKind?: CharacterActionBarEntryKind; skillId?: string | null; itemId?: string | null; itemInstanceId?: string | null }>,
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
      const inventoryRows = await this.prisma.characterInventoryItem.findMany({
        where: { characterId },
        select: { id: true, itemId: true, quantity: true },
      });
      inventoryByItemId = new Map(inventoryRows.map((entry) => [entry.itemId, entry.quantity] as const));
      inventoryInstanceIds = new Set(inventoryRows.map((entry) => entry.id));
    }

    const skillModel = isFileStorageMode() ? null : this.getCharacterSkillModel();
    const normalizedUpdates: Array<{ slotIndex?: number; slotId?: string | null; kind: CharacterActionSlotKind; refId: string | null; itemInstanceId?: string | null }> = [];

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
        normalizedUpdates.push({ slotId, slotIndex, kind: null, refId: null, itemInstanceId: null });
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
        normalizedUpdates.push({ slotId, slotIndex, kind: 'skill', refId: skillId, itemInstanceId: null });
        continue;
      }

      const itemId = typeof update.itemId === 'string' ? update.itemId.trim() : '';
      if (itemId.length === 0) {
        console.warn('[actionBar] reject', { characterId, slotId, entryKind, result: 'missing-item-id' });
        throw new BadRequestException(`Item entry for ${slotId} is missing itemId.`);
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

      const itemInstanceId = typeof update.itemInstanceId === 'string' && update.itemInstanceId.trim().length > 0
        ? update.itemInstanceId.trim()
        : null;
      if (itemInstanceId && !inventoryInstanceIds.has(itemInstanceId)) {
        console.warn('[actionBar] reject', { characterId, slotId, entryKind, itemId, itemInstanceId, result: 'missing-item-instance' });
        throw new BadRequestException(`Item instance is not available in inventory: ${itemInstanceId}`);
      }

      const quantity = inventoryByItemId.get(itemId) ?? 0;
      if (quantity <= 0) {
        console.warn('[actionBar] reject', { characterId, slotId, entryKind, itemId, result: 'item-not-in-inventory' });
        throw new BadRequestException(`Item is not available in inventory: ${itemId}`);
      }

      console.info('[actionBar] assignItem', { characterId, slotId, entryKind, itemId, itemInstanceId, result: 'saved' });
      normalizedUpdates.push({ slotId, slotIndex, kind: 'item', refId: itemId, itemInstanceId });
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
    const stored = await this.readCharacterResourceMap(characterId);
    const resourceState = this.buildResourceState(activeStats, stored);

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
    const inventory: InventoryState = {
      gold: character.gold,
      items: sanitized.inventoryItems.map((entry) => ({
        itemId: entry.itemId,
        quantity: entry.quantity,
      })),
    };

    const baseStats = this.toBaseStats(character);
    const activeStats = this.contentService.getStatsWithEquipment(baseStats, equipment);
    const resources = await this.getCharacterResources(characterId);
    const actionSlots = await this.getOrCreateActionSlots(characterId);

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
      },
      inventory,
      equipment,
      actionSlots,
    };
  }

  async getHubState(characterId: string) {
    return this.getCharacterArenaState(characterId);
  }

  async buyItem(characterId: string, itemId: string, merchantId: string) {
    if (isFileStorageMode()) {
      return this.buyItemFileMode(characterId, itemId, merchantId);
    }
    this.assertDatabaseEnabled();
    const state = await this.getCharacterArenaState(characterId);
    const price = this.contentService.getMerchantItemPrice(merchantId, itemId);

    if (state.inventory.gold < price) {
      throw new BadRequestException('Недостаточно золота.');
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.character.update({
        where: { id: characterId },
        data: { gold: state.inventory.gold - price },
      });

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

    return this.getCharacterArenaState(characterId);
  }

  async sellItem(characterId: string, itemId: string, quantity = 1) {
    if (isFileStorageMode()) {
      return this.sellItemFileMode(characterId, itemId, quantity);
    }
    this.assertDatabaseEnabled();
    const item = this.contentService.resolveItemById(itemId);
    const safeQuantity = Math.max(1, Math.floor(quantity));
    const state = await this.getCharacterArenaState(characterId);

    const inventoryEntry = state.inventory.items.find((entry) => entry.itemId === itemId);
    if (!inventoryEntry || inventoryEntry.quantity < safeQuantity) {
      throw new BadRequestException('Недостаточно предметов для продажи.');
    }

    const sellPrice = Math.max(1, Math.floor(item.price * 0.6));
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

    const check = this.contentService.canEquipItem(state.character.baseStats, itemId, state.equipment, preferredSlot);
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

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.decrementInventoryItem(tx, characterId, itemId);

      for (const [returnedItemId, quantity] of returnedItems) {
        await this.incrementInventoryItem(tx, characterId, returnedItemId, quantity);
      }

      await tx.characterEquipment.upsert({
        where: { characterId },
        update: this.toEquipmentRecord(nextEquipment),
        create: {
          characterId,
          ...this.toEquipmentRecord(nextEquipment),
        },
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

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.characterEquipment.upsert({
        where: { characterId },
        update: this.toEquipmentRecord(nextEquipment),
        create: {
          characterId,
          ...this.toEquipmentRecord(nextEquipment),
        },
      });

      await this.incrementInventoryItem(tx, characterId, currentItem);
    });

    return this.getCharacterArenaState(characterId);
  }

  private async buyItemFileMode(characterId: string, itemId: string, merchantId: string) {
    const character = await this.requireRuntimeCharacter(characterId);
    const price = this.contentService.getMerchantItemPrice(merchantId, itemId);
    const gold = Number((character as { gold?: unknown }).gold ?? 0) || 0;

    if (gold < price) {
      throw new BadRequestException('Недостаточно золота.');
    }

    await this.runtimeStore.updateCharacter(characterId, { gold: gold - price });
    await this.updateRuntimeInventoryItemQuantity(characterId, itemId, 1);

    return this.getCharacterArenaState(characterId);
  }

  private async sellItemFileMode(characterId: string, itemId: string, quantity = 1) {
    await this.requireRuntimeCharacter(characterId);
    const item = this.contentService.resolveItemById(itemId);
    const safeQuantity = Math.max(1, Math.floor(quantity));
    const inventoryItems = await this.readRuntimeInventoryItems(characterId);

    const row = inventoryItems.find((entry) => entry.itemId === itemId);
    if (!row || row.quantity < safeQuantity) {
      throw new BadRequestException('Недостаточно предметов для продажи.');
    }

    const sellPrice = Math.max(1, Math.floor(item.price * 0.6));
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
    const inventoryItems = await this.readRuntimeInventoryItems(characterId);
    const hasItem = inventoryItems.some((entry) => entry.itemId === itemId && entry.quantity > 0);
    if (!hasItem) {
      throw new BadRequestException('Item is not in inventory.');
    }

    const check = this.contentService.canEquipItem(baseStats, itemId, equipment, preferredSlot);
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
}
