import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  buyItem,
  canEquipItem,
  equipItem,
  getItemById,
  getStatsWithEquipment,
  type Equipment,
  type InventoryState,
  type StatBlock,
} from '@theend/rpg-domain';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ArenaService {
  constructor(private readonly prisma: PrismaService) {}

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

    const equipment: Equipment = {
      weapon: character.equipment?.weapon ?? null,
      helmet: character.equipment?.helmet ?? null,
      armor: character.equipment?.armor ?? null,
      boots: character.equipment?.boots ?? null,
      gloves: character.equipment?.gloves ?? null,
      shield: character.equipment?.shield ?? null,
    };

    const inventory: InventoryState = {
      gold: character.gold,
      items: character.inventoryItems.map((entry) => ({
        itemId: entry.itemId,
        quantity: entry.quantity,
      })),
    };

    const baseStats = this.toBaseStats(character);
    const activeStats = getStatsWithEquipment(baseStats, equipment);

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

  async buyItem(characterId: string, itemId: string) {
    getItemById(itemId);
    const state = await this.getCharacterArenaState(characterId);
    const result = buyItem(state.inventory, itemId);

    if (!result.ok) {
      throw new BadRequestException(result.reason ?? 'Purchase failed.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.character.update({
        where: { id: characterId },
        data: { gold: result.inventory.gold },
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
    const item = getItemById(itemId);
    const safeQuantity = Math.max(1, Math.floor(quantity));
    const state = await this.getCharacterArenaState(characterId);

    const inventoryEntry = state.inventory.items.find((entry) => entry.itemId === itemId);
    if (!inventoryEntry || inventoryEntry.quantity < safeQuantity) {
      throw new BadRequestException('Недостаточно предметов для продажи.');
    }

    const isEquipped = Object.values(state.equipment).some((equippedItemId) => equippedItemId === itemId);
    const remainingQuantity = inventoryEntry.quantity - safeQuantity;
    if (isEquipped && remainingQuantity < 1) {
      throw new BadRequestException('Сначала снимите экипированный предмет.');
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

  async equipItem(characterId: string, itemId: string) {
    const state = await this.getCharacterArenaState(characterId);
    const hasItem = state.inventory.items.find((entry) => entry.itemId === itemId && entry.quantity > 0);
    if (!hasItem) {
      throw new BadRequestException('Item is not in inventory.');
    }

    const check = canEquipItem(state.character.baseStats, itemId);
    if (!check.ok) {
      throw new BadRequestException(check.reason ?? 'Cannot equip this item.');
    }

    const nextEquipment = equipItem(state.equipment, itemId);

    await this.prisma.characterEquipment.upsert({
      where: { characterId },
      update: {
        weapon: nextEquipment.weapon,
        helmet: nextEquipment.helmet,
        armor: nextEquipment.armor,
        boots: nextEquipment.boots,
        gloves: nextEquipment.gloves,
        shield: nextEquipment.shield,
      },
      create: {
        characterId,
        weapon: nextEquipment.weapon,
        helmet: nextEquipment.helmet,
        armor: nextEquipment.armor,
        boots: nextEquipment.boots,
        gloves: nextEquipment.gloves,
        shield: nextEquipment.shield,
      },
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

    await this.prisma.characterEquipment.upsert({
      where: { characterId },
      update: {
        weapon: nextEquipment.weapon,
        helmet: nextEquipment.helmet,
        armor: nextEquipment.armor,
        boots: nextEquipment.boots,
        gloves: nextEquipment.gloves,
        shield: nextEquipment.shield,
      },
      create: {
        characterId,
        weapon: nextEquipment.weapon,
        helmet: nextEquipment.helmet,
        armor: nextEquipment.armor,
        boots: nextEquipment.boots,
        gloves: nextEquipment.gloves,
        shield: nextEquipment.shield,
      },
    });

    return this.getCharacterArenaState(characterId);
  }
}
