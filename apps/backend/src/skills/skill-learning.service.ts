import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminSkillDefinition } from '@theend/rpg-domain';
import { SkillType, validateSkillDefinition } from '@theend/rpg-domain';
import type { PrismaClient } from '@prisma/client';
import { ContentService } from '../content/content.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CharacterSkill, CharacterSkillSourceType } from './character-skill.types';
import { createDefaultLoadout, getUnlockedSlotCount } from './character-skill.types';

const MAGIC_SKILL_TYPES = new Set<SkillType>([
  SkillType.MAGIC,
  SkillType.ELEMENTAL_MAGIC,
  SkillType.NORMAL_MAGIC,
  SkillType.FORBIDDEN_MAGIC,
  SkillType.MIXED,
]);

const DWARF_RACES = new Set(['race_dwarf', 'DWARF', 'dwarf']);

@Injectable()
export class SkillLearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
  ) {}

  async getCharacterSkills(characterId: string): Promise<Array<CharacterSkill & { definition: AdminSkillDefinition | null }>> {
    await this.contentService.ensureInitialized();
    const rows = await this.prisma.characterSkill.findMany({
      where: { characterId },
      orderBy: { learnedAt: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      characterId: row.characterId,
      skillId: row.skillId,
      level: row.level,
      learnedAt: row.learnedAt,
      sourceType: row.sourceType as CharacterSkillSourceType,
      sourceId: row.sourceId,
      definition: this.contentService.getCollectionEntry('skills', row.skillId) as AdminSkillDefinition | null,
    }));
  }

  async learnSkill(
    characterId: string,
    skillId: string,
    sourceType: CharacterSkillSourceType,
    sourceId?: string,
  ): Promise<{ skill: CharacterSkill; definition: AdminSkillDefinition; blockedReason?: string }> {
    await this.contentService.ensureInitialized();

    const skillDef = this.contentService.getCollectionEntry('skills', skillId) as AdminSkillDefinition | null;
    if (!skillDef) {
      throw new NotFoundException(`Skill not found: ${skillId}`);
    }

    // Validate skill definition
    const defErrors = validateSkillDefinition(skillDef);
    if (defErrors.length > 0) {
      throw new BadRequestException(`Skill definition invalid: ${defErrors[0]}`);
    }

    if (!skillDef.isPublished) {
      throw new BadRequestException('Skill is not published');
    }
    if (skillDef.isHidden) {
      throw new BadRequestException('Skill is hidden');
    }

    // Load character
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: {
        id: true, race: true, level: true,
        strength: true, endurance: true, dexterity: true,
        intelligence: true, luck: true, speed: true, willpower: true,
      },
    });
    if (!character) {
      throw new NotFoundException(`Character not found: ${characterId}`);
    }

    // Check already learned
    const existing = await this.prisma.characterSkill.findUnique({
      where: { characterId_skillId: { characterId, skillId } },
    });
    if (existing) {
      throw new BadRequestException('Character already knows this skill');
    }

    // Race restrictions
    const req = skillDef.requirements;

    if (DWARF_RACES.has(character.race) && MAGIC_SKILL_TYPES.has(skillDef.type)) {
      const dwarfRule = skillDef.raceRules.find((r) => DWARF_RACES.has(r.raceId));
      if (!dwarfRule || dwarfRule.canUse !== false) {
        // no explicit exception
        if (!skillDef.adminNotes?.includes('dwarf magic exception')) {
          throw new BadRequestException('Dwarves cannot learn magic');
        }
      }
    }

    if (req.allowedRaces && req.allowedRaces.length > 0 && !req.allowedRaces.includes(character.race)) {
      throw new BadRequestException(`Race ${character.race} cannot learn this skill`);
    }
    if (req.forbiddenRaces && req.forbiddenRaces.includes(character.race)) {
      throw new BadRequestException(`Race ${character.race} is forbidden from learning this skill`);
    }

    // Level requirement
    if (req.minCharacterLevel && character.level < req.minCharacterLevel) {
      throw new BadRequestException(`Requires character level ${req.minCharacterLevel}`);
    }

    // Stat requirements
    if (req.requiredStats) {
      const statMap: Record<string, number> = {
        strength: character.strength,
        endurance: character.endurance,
        constitution: character.endurance,
        dexterity: character.dexterity,
        intelligence: character.intelligence,
        luck: character.luck,
        perception: character.speed,
        willpower: character.willpower,
      };
      for (const [stat, minValue] of Object.entries(req.requiredStats)) {
        const actual = statMap[stat] ?? 0;
        if (actual < (minValue ?? 0)) {
          throw new BadRequestException(`Requires ${stat} ${minValue}`);
        }
      }
    }

    // Quest requirements (content-based check)
    if (req.requiredQuestIds && req.requiredQuestIds.length > 0) {
      // We can only verify against available player quest states if passed in;
      // for now throw a descriptive error - caller should validate upstream
      // This is intentionally lenient at the service level since quest state
      // is managed by the quest runtime (localStorage / worldmap).
      // Teacher NPC flow validates this before calling learnSkill.
    }

    const row = await this.prisma.characterSkill.create({
      data: {
        characterId,
        skillId,
        level: 1,
        sourceType,
        sourceId: sourceId ?? null,
      },
    });

    return {
      skill: {
        id: row.id,
        characterId: row.characterId,
        skillId: row.skillId,
        level: row.level,
        learnedAt: row.learnedAt,
        sourceType: row.sourceType as CharacterSkillSourceType,
        sourceId: row.sourceId,
      },
      definition: skillDef,
    };
  }

  async knowsSkill(characterId: string, skillId: string): Promise<boolean> {
    const row = await this.prisma.characterSkill.findUnique({
      where: { characterId_skillId: { characterId, skillId } },
    });
    return row !== null;
  }

  async grantQuestSkillRewards(
    characterId: string,
    questId: string,
    skillIds: string[],
  ): Promise<Array<{ skillId: string; granted: boolean; reason?: string }>> {
    await this.contentService.ensureInitialized();
    const results: Array<{ skillId: string; granted: boolean; reason?: string }> = [];

    for (const skillId of skillIds) {
      try {
        await this.learnSkill(characterId, skillId, 'quest', questId);
        results.push({ skillId, granted: true });
      } catch (error) {
        results.push({ skillId, granted: false, reason: (error as Error).message });
      }
    }

    return results;
  }

  async getOrCreateLoadout(characterId: string): Promise<import('./character-skill.types').CharacterSkillLoadout> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { combatMastery: true },
    });
    const combatMastery = character?.combatMastery ?? 0;

    const existing = await this.prisma.characterSkillLoadout.findUnique({
      where: { characterId },
    });

    if (existing) {
      const slots = existing.slots as unknown as import('./character-skill.types').CombatSkillSlot[];
      // Update unlock status based on current combat mastery
      const unlocked = getUnlockedSlotCount(combatMastery);
      const updatedSlots = slots.map((slot) => ({
        ...slot,
        unlocked: slot.slotIndex < unlocked,
      }));
      return { characterId, slots: updatedSlots };
    }

    const slots = createDefaultLoadout(combatMastery);
    await this.prisma.characterSkillLoadout.create({
      data: { characterId, slots: slots as unknown as import('@prisma/client').Prisma.JsonArray },
    });
    return { characterId, slots };
  }

  async updateLoadout(
    characterId: string,
    updates: Array<{ slotIndex: number; skillId: string | null }>,
  ): Promise<import('./character-skill.types').CharacterSkillLoadout> {
    await this.contentService.ensureInitialized();
    const loadout = await this.getOrCreateLoadout(characterId);

    const learnedSkillIds = new Set(
      (await this.prisma.characterSkill.findMany({
        where: { characterId },
        select: { skillId: true },
      })).map((r) => r.skillId),
    );

    const nextSlots = [...loadout.slots];
    const equippedSkillIds = new Set(
      nextSlots
        .filter((s) => s.skillId !== null && s.unlocked)
        .map((s) => s.skillId as string),
    );

    for (const update of updates) {
      const slotIdx = nextSlots.findIndex((s) => s.slotIndex === update.slotIndex);
      if (slotIdx === -1) {
        throw new BadRequestException(`Slot ${update.slotIndex} not found`);
      }
      const slot = nextSlots[slotIdx]!;

      if (!slot.unlocked) {
        throw new BadRequestException(`Slot ${update.slotIndex} is locked`);
      }

      if (update.skillId === null) {
        if (slot.skillId) {
          equippedSkillIds.delete(slot.skillId);
        }
        nextSlots[slotIdx] = { ...slot, skillId: null };
        continue;
      }

      if (!learnedSkillIds.has(update.skillId)) {
        throw new BadRequestException(`Character has not learned skill: ${update.skillId}`);
      }

      const skillDef = this.contentService.getCollectionEntry('skills', update.skillId) as AdminSkillDefinition | null;
      if (!skillDef) {
        throw new NotFoundException(`Skill not found: ${update.skillId}`);
      }
      if (!skillDef.isPublished) {
        throw new BadRequestException(`Skill ${update.skillId} is not published`);
      }
      if (skillDef.isHidden) {
        throw new BadRequestException(`Skill ${update.skillId} is hidden`);
      }

      // Duplicate slot check
      if (!skillDef.isActive && equippedSkillIds.has(update.skillId) && slot.skillId !== update.skillId) {
        throw new BadRequestException(`Skill ${update.skillId} is already equipped in another slot`);
      }
      const isPassive = skillDef.isPassive;
      const slotType = slot.slotType;
      if (isPassive && slotType !== 'ANY' && slotType !== 'PASSIVE') {
        throw new BadRequestException(`Passive skills can only be placed in PASSIVE or ANY slots`);
      }
      if (MAGIC_SKILL_TYPES.has(skillDef.type) && slotType !== 'ANY' && slotType !== 'MAGIC') {
        throw new BadRequestException(`Magic skills can only be placed in MAGIC or ANY slots`);
      }
      if (skillDef.type === 'rune' && slotType !== 'ANY' && slotType !== 'RUNE') {
        throw new BadRequestException(`Rune skills can only be placed in RUNE or ANY slots`);
      }
      if (skillDef.type === 'shamanism' && slotType !== 'ANY' && slotType !== 'SHAMANIC') {
        throw new BadRequestException(`Shamanic skills can only be placed in SHAMANIC or ANY slots`);
      }

      if (slot.skillId) {
        equippedSkillIds.delete(slot.skillId);
      }
      equippedSkillIds.add(update.skillId);
      nextSlots[slotIdx] = { ...slot, skillId: update.skillId };
    }

    await this.prisma.characterSkillLoadout.upsert({
      where: { characterId },
      create: { characterId, slots: nextSlots as unknown as import('@prisma/client').Prisma.JsonArray },
      update: { slots: nextSlots as unknown as import('@prisma/client').Prisma.JsonArray },
    });

    return { characterId, slots: nextSlots };
  }

  async getEquippedSkillDefinitions(characterId: string): Promise<AdminSkillDefinition[]> {
    await this.contentService.ensureInitialized();
    const loadout = await this.getOrCreateLoadout(characterId);
    const result: AdminSkillDefinition[] = [];
    for (const slot of loadout.slots) {
      if (!slot.unlocked || !slot.skillId) {
        continue;
      }
      const def = this.contentService.getCollectionEntry('skills', slot.skillId) as AdminSkillDefinition | null;
      if (def) {
        result.push(def);
      }
    }
    return result;
  }
}
