import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Race, StatBlock, Equipment } from '@theend/rpg-domain';
import { isFileStorageMode } from '../config/storage-mode';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeCharacterStore } from '../characters/runtime-character-store';

@Injectable()
export class PvpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeStore: RuntimeCharacterStore,
  ) {}

  async listNearbyPlayers(characterId: string) {
    // In file mode, only one character exists, so no other characters to challenge
    if (isFileStorageMode()) {
      return [];
    }

    const players = await this.prisma.character.findMany({
      where: { id: { not: characterId } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        id: true,
        name: true,
        race: true,
        level: true,
      },
    });

    return players.map((player) => ({
      characterId: player.id,
      name: player.name,
      race: player.race,
      level: player.level,
    }));
  }

  async challengePlayer(challengerId: string, targetId: string) {
    if (!challengerId || !targetId) {
      throw new BadRequestException('challengerId and targetId are required.');
    }
    if (challengerId === targetId) {
      throw new BadRequestException('Cannot challenge self.');
    }

    if (isFileStorageMode()) {
      // In file mode, verify challenger exists
      const challenger = await this.runtimeStore.getCharacterById(challengerId);
      if (!challenger) {
        throw new NotFoundException('Challenger character not found.');
      }

      // In file mode, cannot challenge another character (only self exists)
      throw new NotFoundException('Target character not found.');
    }

    const challenger = await this.prisma.character.findUnique({
      where: { id: challengerId },
      select: { id: true },
    });
    if (!challenger) {
      throw new NotFoundException('Challenger character not found.');
    }

    const target = await this.prisma.character.findUnique({
      where: { id: targetId },
      include: { equipment: true },
    });
    if (!target) {
      throw new NotFoundException('Target character not found.');
    }

    const stats: StatBlock = {
      hp: target.hpBase,
      mp: target.mpBase,
      stamina: target.staminaBase,
      strength: target.strength,
      dexterity: target.dexterity,
      constitution: target.endurance,
      luck: target.luck,
      intelligence: target.intelligence,
      perception: target.speed,
      willpower: target.willpower,
    };

    const equipment: Partial<Equipment> = {
      weapon: target.equipment?.weapon ?? null,
      helmet: target.equipment?.helmet ?? null,
      necklace: target.equipment?.necklace ?? null,
      armor: target.equipment?.armor ?? null,
      outerwear: target.equipment?.outerwear ?? null,
      belt: target.equipment?.belt ?? null,
      gloves: target.equipment?.gloves ?? null,
      shield: target.equipment?.shield ?? null,
      ring1: target.equipment?.ring1 ?? null,
      ring2: target.equipment?.ring2 ?? null,
      ring3: target.equipment?.ring3 ?? null,
      legs: target.equipment?.legs ?? null,
      boots: target.equipment?.boots ?? null,
    };

    return {
      target: {
        characterId: target.id,
        name: target.name,
        race: target.race,
        level: target.level,
      },
      customEnemy: {
        name: target.name,
        race: target.race as Race,
        stats,
        equipment,
      },
    };
  }
}
