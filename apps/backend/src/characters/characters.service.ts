import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  Race,
  STARTING_GOLD,
  applyAllocation,
  createInitialCitizenshipState,
  getAllocationCost,
  getRaceDefinition,
  getStartingFreePoints,
  getStartingProfessionIds,
  getStartingSkillIds,
  getKingdomStartingGoldBonus,
  isKingdomId,
  validateAllocation,
} from '@theend/rpg-domain';
import { PrismaService } from '../prisma/prisma.service';
import { isFileStorageMode } from '../config/storage-mode';
import { CreateCharacterDto, normalizeAllocation } from './dto.create-character.dto';
import { AllocateStatsDto } from './dto.allocate-stats.dto';
import { RuntimeCharacterStore, type RuntimeCharacterRecord } from './runtime-character-store';
import { CharacterMetadataStore } from './character-metadata.store';

@Injectable()
export class CharactersService {
  private readonly runtimeStore = new RuntimeCharacterStore();
  private readonly metadataStore: CharacterMetadataStore;

  constructor(private readonly prisma: PrismaService) {
    this.metadataStore = new CharacterMetadataStore(this.prisma, this.runtimeStore);
  }

  getRuntimeStorageHealth(): {
    runtimeStorage: 'readable-writable' | 'unavailable';
    runtimeFile: string;
    runtimeFilePath: string;
  } {
    const health = this.runtimeStore.getStorageHealth();
    return {
      runtimeStorage: health.runtimeStorage,
      runtimeFile: this.runtimeStore.getRuntimeFileName(),
      runtimeFilePath: this.runtimeStore.getRuntimeFilePath(),
    };
  }

  private isFileMode(): boolean {
    return isFileStorageMode();
  }

  private async resolveAccountId(accountId?: string): Promise<string> {
    if (this.isFileMode()) {
      const normalized = String(accountId ?? '').trim() || `guest_${randomUUID()}`;
      await this.runtimeStore.upsertAccount(normalized);
      return normalized;
    }

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
      validateAllocation(allocation, getStartingFreePoints(dto.race as Race));
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const citizenshipKingdomId = dto.citizenshipKingdomId && isKingdomId(dto.citizenshipKingdomId)
      ? dto.citizenshipKingdomId
      : null;
    if (dto.race === Race.Human && !citizenshipKingdomId) {
      throw new BadRequestException('Human characters must select a kingdom citizenship.');
    }
    if (dto.race !== Race.Human && citizenshipKingdomId) {
      throw new BadRequestException('Only humans can start with human kingdom citizenship.');
    }

    const finalStats = applyAllocation(raceDef.baseStats, allocation);
    const spent = getAllocationCost(allocation);
    const startingFreePoints = getStartingFreePoints(dto.race as Race);
    const finalStartingGold = STARTING_GOLD + getKingdomStartingGoldBonus(citizenshipKingdomId);

    const data = {
      name: dto.name,
      race: dto.race,
      level: 0,
      exp: 0,
      freePoints: Math.max(0, startingFreePoints - spent),
      gold: finalStartingGold,
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
      combatMastery: 0,
    };

    if (this.isFileMode()) {
      const now = new Date().toISOString();
      const character: RuntimeCharacterRecord = {
        id: randomUUID(),
        accountId: resolvedAccountId,
        ...data,
        ...createInitialCitizenshipState(citizenshipKingdomId),
        startingProfessionIds: getStartingProfessionIds(dto.race as Race),
        startingSkillIds: getStartingSkillIds(dto.race as Race),
        createdAt: now,
        updatedAt: now,
      };
      return this.runtimeStore.createCharacter(character);
    }

    const { combatMastery: _combatMastery, ...prismaCharacterData } = data;

    const createData = {
      account: { connect: { id: resolvedAccountId } },
      ...prismaCharacterData,
      equipment: { create: {} },
    };

    const created = await this.prisma.character.create({ data: createData });
    await this.metadataStore.set(created.id, {
      ...createInitialCitizenshipState(citizenshipKingdomId),
      startingProfessionIds: getStartingProfessionIds(dto.race as Race),
      startingSkillIds: getStartingSkillIds(dto.race as Race),
    });
    return created;
  }

  async listForAccount(accountId?: string) {
    if (this.isFileMode()) {
      return this.runtimeStore.listCharacters(accountId);
    }

    const normalizedAccountId = String(accountId ?? '').trim();
    if (!normalizedAccountId) {
      return [];
    }

    return this.prisma.character.findMany({
      where: { accountId: normalizedAccountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    if (this.isFileMode()) {
      const character = await this.runtimeStore.getCharacterById(id);
      if (!character) {
        throw new NotFoundException('Character not found.');
      }
      return character;
    }

    const character = await this.prisma.character.findUnique({ where: { id } });
    if (!character) {
      throw new NotFoundException('Character not found.');
    }
    return character;
  }

  async allocateStats(id: string, dto: AllocateStatsDto) {
    const character = await this.getById(id);
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

    if (this.isFileMode()) {
      const updated = await this.runtimeStore.updateCharacter(id, {
        ...updateData,
        freePoints: character.freePoints - spent,
      });
      if (!updated) {
        throw new NotFoundException('Character not found.');
      }
      return updated;
    }

    return this.prisma.character.update({
      where: { id },
      data: {
        ...updateData,
        freePoints: character.freePoints - spent,
      },
    });
  }

  async updateCharacter(id: string, payload: Record<string, unknown>) {
    if (this.isFileMode()) {
      const updated = await this.runtimeStore.updateCharacter(id, payload);
      if (!updated) {
        throw new NotFoundException('Character not found.');
      }
      return updated;
    }

    const updates: {
      name?: string;
      race?: string;
    } = {};

    if (typeof payload.name === 'string' && payload.name.trim().length >= 3) {
      updates.name = payload.name.trim();
    }
    if (typeof payload.race === 'string' && payload.race.trim().length > 0) {
      updates.race = payload.race.trim();
    }

    if (Object.keys(updates).length === 0) {
      return this.getById(id);
    }

    return this.prisma.character.update({
      where: { id },
      data: updates,
    });
  }

  async applyDevStatePatch(id: string, payload: Record<string, unknown>) {
    const character = await this.getById(id);
    if (!character) {
      throw new NotFoundException('Character not found.');
    }

    const integerFields = [
      'level',
      'exp',
      'freePoints',
      'gold',
      'hpBase',
      'mpBase',
      'staminaBase',
      'strength',
      'endurance',
      'dexterity',
      'intelligence',
      'luck',
      'speed',
      'willpower',
      'combatMastery',
    ] as const;

    const updates: Record<string, unknown> = {};

    for (const fieldName of integerFields) {
      if (!(fieldName in payload)) {
        continue;
      }

      const numericValue = Number(payload[fieldName]);
      if (!Number.isFinite(numericValue)) {
        throw new BadRequestException(`Field ${fieldName} must be a number.`);
      }

      updates[fieldName] = Math.max(0, Math.floor(numericValue));
    }

    if (typeof payload.name === 'string' && payload.name.trim().length >= 1) {
      updates.name = payload.name.trim();
    }

    if (typeof payload.race === 'string' && payload.race.trim().length >= 1) {
      updates.race = payload.race.trim();
    }

    if (Object.keys(updates).length === 0) {
      return character;
    }

    if (this.isFileMode()) {
      const updated = await this.runtimeStore.updateCharacter(id, updates);
      if (!updated) {
        throw new NotFoundException('Character not found.');
      }
      return updated;
    }

    return this.prisma.character.update({
      where: { id },
      data: updates,
    });
  }

  async deleteCharacter(id: string): Promise<{ ok: boolean; id: string }> {
    if (this.isFileMode()) {
      const deleted = await this.runtimeStore.deleteCharacter(id);
      return { ok: deleted, id };
    }

    await this.prisma.character.delete({ where: { id } });
    return { ok: true, id };
  }
}
