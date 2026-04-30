import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Race,
  STARTING_GOLD,
  applyAllocation,
  getAllocationCost,
  getRaceDefinition,
  validateAllocation,
} from '@theend/rpg-domain';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCharacterDto, normalizeAllocation } from './dto.create-character.dto';
import { AllocateStatsDto } from './dto.allocate-stats.dto';

@Injectable()
export class CharactersService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveAccountId(accountId?: string): Promise<string> {
    if (accountId) {
      const account = await this.prisma.account.findUnique({ where: { id: accountId } });
      if (!account) {
        throw new NotFoundException('Account not found.');
      }

      return account.id;
    }

    const guestAccount = await this.prisma.account.create({
      data: {
        login: `guest_${randomUUID()}`,
        passwordHash: 'temporary-guest-account',
      },
      select: {
        id: true,
      },
    });

    return guestAccount.id;
  }

  async createCharacter(accountId: string | undefined, dto: CreateCharacterDto) {
    const resolvedAccountId = await this.resolveAccountId(accountId);

    const raceDef = getRaceDefinition(dto.race as Race);
    const allocation = normalizeAllocation(dto.allocation ?? {});

    try {
      validateAllocation(allocation);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const finalStats = applyAllocation(raceDef.baseStats, allocation);
    const spent = getAllocationCost(allocation);

    const data = {
      account: { connect: { id: resolvedAccountId } },
      name: dto.name,
      race: dto.race,
      level: 0,
      exp: 0,
      freePoints: Math.max(0, 5 - spent),
      gold: STARTING_GOLD,
      hpBase: finalStats.hp,
      mpBase: finalStats.mp,
      staminaBase: finalStats.stamina,
      strength: finalStats.strength,
      endurance: finalStats.constitution,
      dexterity: finalStats.dexterity,
      intelligence: finalStats.intelligence,
      luck: finalStats.luck,
      speed: finalStats.perception,
      willpower: finalStats.willpower,
      equipment: { create: {} },
    };

    return this.prisma.character.create({ data });
  }

  async listForAccount(accountId: string) {
    return this.prisma.character.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const character = await this.prisma.character.findUnique({ where: { id } });
    if (!character) {
      throw new NotFoundException('Character not found.');
    }
    return character;
  }

  async allocateStats(id: string, dto: AllocateStatsDto) {
    const character = await this.prisma.character.findUnique({ where: { id } });
    if (!character) {
      throw new NotFoundException('Character not found.');
    }
    try {
      validateAllocation(dto, character.freePoints);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const spent = getAllocationCost(dto);
    if (spent > character.freePoints) {
      throw new BadRequestException(
        `Not enough points. Required: ${spent}, available: ${character.freePoints}`,
      );
    }

    const updateData: Record<string, number> = {};

    const allocation = {
      hp: dto.hp ?? 0,
      mp: dto.mp ?? 0,
      stamina: dto.stamina ?? 0,
      strength: dto.strength ?? 0,
      dexterity: dto.dexterity ?? 0,
      constitution: dto.constitution ?? 0,
      luck: dto.luck ?? 0,
      intelligence: dto.intelligence ?? 0,
      perception: dto.perception ?? 0,
      willpower: dto.willpower ?? 0,
    };

    for (const [stat, points] of Object.entries(allocation)) {
      if (points > 0) {
        let fieldName = stat === 'hp' || stat === 'mp' || stat === 'stamina'
          ? `${stat}Base`
          : stat === 'constitution'
            ? 'endurance'
            : stat === 'perception'
              ? 'speed'
              : stat;
        const multiplier = (stat === 'hp' || stat === 'mp' || stat === 'stamina') ? 10 : 1;
        const currentValue = character[fieldName as keyof typeof character];

        if (typeof currentValue !== 'number') {
          throw new BadRequestException(`Cannot allocate ${stat} (field ${fieldName} is not a number).`);
        }
        updateData[fieldName] = currentValue + points * multiplier;
      }
    }

    return this.prisma.character.update({
      where: { id },
      data: {
        ...updateData,
        freePoints: character.freePoints - spent,
      },
    });
  }
}
