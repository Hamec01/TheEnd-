import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type Equipment,
  type InventoryState,
  type StatBlock,
} from '@theend/rpg-domain';
import { ContentService } from '../content/content.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ArenaService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureEquipmentSchema();
    await this.sanitizeAllCharactersInventoryAndEquipment();
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
        inventoryItems: character.inventoryItems.map((entry) => ({
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

    await this.prisma.$transaction(async (tx) => {
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

  private toBaseStats(character: {
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
  }): StatBlock {
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

  private async getCharacterArenaState(characterId: string) {
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
      inventoryItems: character.inventoryItems.map((entry) => ({
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
      },
      inventory,
      equipment,
    };
  }

  async getHubState(characterId: string) {
    return this.getCharacterArenaState(characterId);
  }

  async buyItem(characterId: string, itemId: string, merchantId: string) {
    const state = await this.getCharacterArenaState(characterId);
    const price = this.contentService.getMerchantItemPrice(merchantId, itemId);

    if (state.inventory.gold < price) {
      throw new BadRequestException('Недостаточно золота.');
    }

    await this.prisma.$transaction(async (tx) => {
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
    const item = this.contentService.resolveItemById(itemId);
    const safeQuantity = Math.max(1, Math.floor(quantity));
    const state = await this.getCharacterArenaState(characterId);

    const inventoryEntry = state.inventory.items.find((entry) => entry.itemId === itemId);
    if (!inventoryEntry || inventoryEntry.quantity < safeQuantity) {
      throw new BadRequestException('Недостаточно предметов для продажи.');
    }

    const sellPrice = Math.max(1, Math.floor(item.price * 0.6));
    const goldGain = sellPrice * safeQuantity;

    await this.prisma.$transaction(async (tx) => {
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

    await this.prisma.$transaction(async (tx) => {
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
    const state = await this.getCharacterArenaState(characterId);
    const currentItem = state.equipment[slot];
    if (!currentItem) {
      throw new BadRequestException('Slot is already empty.');
    }

    const nextEquipment: Equipment = {
      ...state.equipment,
      [slot]: null,
    };

    await this.prisma.$transaction(async (tx) => {
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
}
