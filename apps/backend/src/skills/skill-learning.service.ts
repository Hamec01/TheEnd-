import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import type { AdminSkillDefinition } from '@theend/rpg-domain';
import { SkillType, validateSkillDefinition } from '@theend/rpg-domain';
import { isFileStorageMode } from '../config/storage-mode';
import { ContentService } from '../content/content.service';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeCharacterStore } from '../characters/runtime-character-store';
import type { CharacterSkill, CharacterSkillLoadout, CharacterSkillSourceType, CombatSkillSlot } from './character-skill.types';
import { createDefaultLoadout, getUnlockedSlotCount } from './character-skill.types';

const MAGIC_SKILL_TYPES = new Set<SkillType>([
  SkillType.MAGIC,
  SkillType.ELEMENTAL_MAGIC,
  SkillType.NORMAL_MAGIC,
  SkillType.FORBIDDEN_MAGIC,
  SkillType.MIXED,
]);

const DWARF_RACES = new Set(['race_dwarf', 'DWARF', 'dwarf']);
const GENERIC_TRAINING_SOURCE_TYPES = new Set<CharacterSkillSourceType>(['teacher', 'academy']);

const CHARACTER_SKILLS_STORE_KEY = 'character-skills-v1';
const CHARACTER_LOADOUTS_STORE_KEY = 'character-skill-loadouts-v1';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type InputJsonValue = Prisma.InputJsonValue;

type StoredCharacterSkill = {
  id: string;
  characterId: string;
  skillId: string;
  level: number;
  learnedAt: string;
  sourceType: CharacterSkillSourceType;
  sourceId?: string | null;
};

type StoredCharacterSkillMap = Record<string, StoredCharacterSkill[]>;
type StoredCharacterLoadoutMap = Record<string, CombatSkillSlot[]>;

function parseIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(value.map((entry) => String(entry ?? '').trim()).filter(Boolean)),
    );
  }
  if (typeof value === 'string') {
    return Array.from(
      new Set(
        value
          .split(/[\n,]+/g)
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    );
  }
  return [];
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isTeacherMethod(method: unknown): boolean {
  const rec = toRecord(method);
  const t = typeof rec?.type === 'string' ? rec.type.trim().toLowerCase() : '';
  return t === 'teacher' || t === 'trainer';
}

function getTrainerNpcIdFromMethod(method: unknown): string | null {
  const rec = toRecord(method);
  if (!rec) return null;
  const raw =
    rec.teacherNpcId
    ?? rec.npcId
    ?? rec.trainerNpcId
    ?? rec.teacherId;
  const id = typeof raw === 'string' ? raw.trim() : '';
  return id ? id : null;
}

function getPriceGoldFromMethod(method: unknown): number | null {
  const rec = toRecord(method);
  if (!rec) return null;
  const raw = rec.priceGold;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function skillHasTeacherLink(skill: AdminSkillDefinition, npcId: string): boolean {
  const methods = Array.isArray((skill as any)?.acquisition?.methods) ? (skill as any).acquisition.methods as unknown[] : [];
  for (const method of methods) {
    if (!isTeacherMethod(method)) continue;
    const linkedNpcId = getTrainerNpcIdFromMethod(method);
    if (linkedNpcId && linkedNpcId === npcId) return true;
  }
  return false;
}

function isTrainableLike(skill: AdminSkillDefinition): boolean {
  const methods = Array.isArray((skill as any)?.acquisition?.methods) ? (skill as any).acquisition.methods as unknown[] : [];
  return skill.isTrainable === true
    || (skill as any).acquisitionMode === 'trainer'
    || methods.some(isTeacherMethod);
}

function isCandidateForTrainer(skill: AdminSkillDefinition, npcId: string, trainerSkillIds: Set<string>): boolean {
  if (trainerSkillIds.has(skill.id)) return true;
  if (skill.requiredNpcId?.trim() === npcId) return true;
  if (skillHasTeacherLink(skill, npcId)) return true;
  return false;
}

function getSkillTrainingPrice(skill: AdminSkillDefinition, npcId: string | null | undefined): number {
  const methods = Array.isArray((skill as any)?.acquisition?.methods) ? (skill as any).acquisition.methods as unknown[] : [];
  const trainerMethods = methods.filter(isTeacherMethod);

  if (npcId) {
    for (const method of trainerMethods) {
      const teacherNpcId = getTrainerNpcIdFromMethod(method);
      if (teacherNpcId && teacherNpcId === npcId) {
        const price = getPriceGoldFromMethod(method);
        if (typeof price === 'number') return price;
      }
    }
  }

  for (const method of trainerMethods) {
    const price = getPriceGoldFromMethod(method);
    if (typeof price === 'number') return price;
  }

  const top = (skill as any).priceGold;
  const topN = typeof top === 'number' ? top : Number(top);
  return Number.isFinite(topN) ? Math.max(0, Math.floor(topN)) : 0;
}

@Injectable()
export class SkillLearningService {
  private readonly logger = new Logger(SkillLearningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
    private readonly runtimeStore: RuntimeCharacterStore,
  ) {}

  async getCharacterSkills(characterId: string): Promise<Array<CharacterSkill & { definition: AdminSkillDefinition | null }>> {
    await this.contentService.ensureInitialized();
    await this.ensureCharacterExists(characterId);
    const rows = await this.readCharacterSkills(characterId);

    return rows.map((row) => ({
      id: row.id,
      characterId: row.characterId,
      skillId: row.skillId,
      level: row.level,
      learnedAt: row.learnedAt,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      definition: this.contentService.getCollectionEntry('skills', row.skillId) as AdminSkillDefinition | null,
    })).sort((a, b) => a.learnedAt.getTime() - b.learnedAt.getTime());
  }

  async learnSkill(
    characterId: string,
    skillId: string,
    sourceType: CharacterSkillSourceType,
    sourceId?: string,
  ): Promise<{ skill: CharacterSkill; definition: AdminSkillDefinition; blockedReason?: string }> {
    if (GENERIC_TRAINING_SOURCE_TYPES.has(sourceType)) {
      return this.learnSkillFromTraining(characterId, skillId, sourceId);
    }

    return this.grantSkillToCharacter(characterId, skillId, sourceType, sourceId);
  }

  async learnSkillFromTraining(
    characterId: string,
    skillId: string,
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

    this.assertSkillIsUsable(skillDef, skillId);

    const trainerNpcId = (sourceId ?? '').trim();
    const hasTrainerNpc = Boolean(trainerNpcId);
    const trainerSkillIds = new Set<string>();
    if (hasTrainerNpc) {
      const npc = this.contentService.getCollectionEntry('npcs', trainerNpcId) as unknown as Record<string, unknown> | null;
      if (!npc) {
        throw new BadRequestException(`Trainer not found: ${trainerNpcId}`);
      }
      if ('canTrain' in npc && npc.canTrain !== true) {
        throw new BadRequestException(`NPC ${trainerNpcId} cannot train skills`);
      }
      const trainer = toRecord((npc as any).trainer);
      const rawSkillIds =
        trainer?.skillIds
        ?? (npc as any).trainerSkillIds
        ?? (npc as any).trainerSkillIdsText;
      for (const id of parseIdList(rawSkillIds)) {
        trainerSkillIds.add(id);
      }
    }

    if (!isTrainableLike(skillDef)) {
      throw new BadRequestException(`Skill is not available for trainer learning: ${skillId}`);
    }

    const requiredTrainerId = skillDef.requiredNpcId?.trim();
    if (hasTrainerNpc && requiredTrainerId && requiredTrainerId !== trainerNpcId) {
      throw new BadRequestException(`Skill can only be learned from trainer ${requiredTrainerId}`);
    }
    if (!hasTrainerNpc && requiredTrainerId) {
      throw new BadRequestException(`Skill can only be learned from trainer ${requiredTrainerId}`);
    }

    if (hasTrainerNpc && !isCandidateForTrainer(skillDef, trainerNpcId, trainerSkillIds)) {
      throw new BadRequestException(`Skill ${skillId} is not offered by trainer ${trainerNpcId}`);
    }

    const characterRecord = await this.ensureCharacterExists(characterId);
    const character = {
      race: String(characterRecord.race ?? ''),
      classId: typeof (characterRecord as { classId?: unknown }).classId === 'string'
        ? String((characterRecord as { classId?: string }).classId ?? '').trim()
        : '',
      level: Number(characterRecord.level ?? 0) || 0,
      strength: Number(characterRecord.strength ?? 0) || 0,
      endurance: Number(characterRecord.endurance ?? 0) || 0,
      dexterity: Number(characterRecord.dexterity ?? 0) || 0,
      intelligence: Number(characterRecord.intelligence ?? 0) || 0,
      luck: Number(characterRecord.luck ?? 0) || 0,
      speed: Number(characterRecord.speed ?? 0) || 0,
      willpower: Number(characterRecord.willpower ?? 0) || 0,
    };

    const currentGold = Number((characterRecord as { gold?: unknown }).gold ?? 0) || 0;
    const priceGold = hasTrainerNpc ? getSkillTrainingPrice(skillDef, trainerNpcId) : getSkillTrainingPrice(skillDef, null);

    // Check already learned
    const existing = (await this.readCharacterSkills(characterId)).find((entry) => entry.skillId === skillId);
    if (existing) {
      throw new BadRequestException('Character already knows this skill');
    }

    await this.assertTrainingRequirements(characterId, character, skillDef, trainerNpcId || undefined);

    if (priceGold > 0 && currentGold < priceGold) {
      throw new BadRequestException('Недостаточно золота.');
    }

    let row: CharacterSkill;
    if (isFileStorageMode()) {
      if (priceGold > 0) {
        await this.runtimeStore.updateCharacter(characterId, { gold: currentGold - priceGold });
      }
      row = await this.createCharacterSkill({
        characterId,
        skillId,
        level: 1,
        sourceType: 'teacher',
        sourceId: hasTrainerNpc ? trainerNpcId : null,
      });
    } else {
      const created = await this.prisma.$transaction(async (tx) => {
        if (priceGold > 0) {
          const refreshed = await tx.character.findUnique({ where: { id: characterId }, select: { gold: true } });
          const latestGold = Number(refreshed?.gold ?? 0) || 0;
          if (latestGold < priceGold) {
            throw new BadRequestException('Недостаточно золота.');
          }
          await tx.character.update({ where: { id: characterId }, data: { gold: { decrement: priceGold } } });
        }
        const createdRow = await (tx as any).characterSkill.create({
          data: {
            characterId,
            skillId,
            level: 1,
            sourceType: 'teacher',
            sourceId: hasTrainerNpc ? trainerNpcId : null,
          },
        });
        return this.normalizeSkillRow(createdRow as unknown as Record<string, unknown>);
      });
      if (!created) {
        throw new BadRequestException('Failed to persist learned skill');
      }
      row = created;
    }

    return {
      skill: {
        id: row.id,
        characterId: row.characterId,
        skillId: row.skillId,
        level: row.level,
        learnedAt: row.learnedAt,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
      },
      definition: skillDef,
    };
  }

  async grantSkillToCharacter(
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

    await this.ensureCharacterExists(characterId);

    const existing = (await this.readCharacterSkills(characterId)).find((entry) => entry.skillId === skillId);
    if (existing) {
      throw new BadRequestException('Character already knows this skill');
    }

    const row = await this.createCharacterSkill({
      characterId,
      skillId,
      level: 1,
      sourceType,
      sourceId: sourceId ?? null,
    });

    return {
      skill: {
        id: row.id,
        characterId: row.characterId,
        skillId: row.skillId,
        level: row.level,
        learnedAt: row.learnedAt,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
      },
      definition: skillDef,
    };
  }

  private async assertTrainingRequirements(
    characterId: string,
    character: {
      race: string;
      classId?: string;
      level: number;
      strength: number;
      endurance: number;
      dexterity: number;
      intelligence: number;
      luck: number;
      speed: number;
      willpower: number;
    },
    skillDef: AdminSkillDefinition,
    sourceId?: string,
  ): Promise<void> {
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

    const requiredKnownSkillIds = [
      ...(skillDef.requiredKnownSkillIds ?? []),
      ...(req.requiredSkills ?? []),
    ];
    if (requiredKnownSkillIds.length > 0) {
      const known = new Set((await this.readCharacterSkills(characterId)).map((entry) => entry.skillId));
      const missing = requiredKnownSkillIds.find((requiredSkillId) => !known.has(requiredSkillId));
      if (missing) {
        throw new BadRequestException(`Requires known skill ${missing}`);
      }
    }

    const requiredLevel = skillDef.requiredLevel;
    if (typeof requiredLevel === 'number' && character.level < requiredLevel) {
      throw new BadRequestException(`Requires character level ${requiredLevel}`);
    }

    if (skillDef.requiredRaceIds && skillDef.requiredRaceIds.length > 0 && !skillDef.requiredRaceIds.includes(character.race)) {
      throw new BadRequestException(`Race ${character.race} cannot learn this skill`);
    }

    if (skillDef.requiredClassIds && skillDef.requiredClassIds.length > 0) {
      const classId = typeof character.classId === 'string' ? character.classId.trim() : '';
      if (!classId) {
        throw new BadRequestException(`Character class system missing (requires: ${skillDef.requiredClassIds.join(', ')})`);
      }
      if (!skillDef.requiredClassIds.includes(classId)) {
        throw new BadRequestException(`Skill requires one of classes: ${skillDef.requiredClassIds.join(', ')}`);
      }
    }

    const requiredNpcId = skillDef.requiredNpcId?.trim();
    if (requiredNpcId && requiredNpcId !== (sourceId ?? '').trim()) {
      throw new BadRequestException(`Skill can only be learned from trainer ${requiredNpcId}`);
    }

    if (skillDef.requiredQuestId?.trim()) {
      throw new BadRequestException(`Requires quest state: ${skillDef.requiredQuestId.trim()}`);
    }
    if (skillDef.requiredCompletedQuestId?.trim()) {
      throw new BadRequestException(`Requires completed quest: ${skillDef.requiredCompletedQuestId.trim()}`);
    }

    const requiredItems = [
      ...(req.requiredItems ?? []),
      ...(skillDef.requiredQuestItemId ? [skillDef.requiredQuestItemId] : []),
    ].map((entry) => String(entry).trim()).filter(Boolean);
    if (requiredItems.length > 0) {
      const ownedItemIds = new Set(await this.readCharacterItemIds(characterId));
      const missing = requiredItems.find((requiredItemId) => !ownedItemIds.has(requiredItemId));
      if (missing) {
        throw new BadRequestException(`Requires item: ${missing}`);
      }
    }

    if ((req.requiredQuestIds ?? []).length > 0) {
      const firstRequiredQuestId = req.requiredQuestIds?.[0] ?? 'unknown';
      throw new BadRequestException(`Requires completed quest: ${firstRequiredQuestId}`);
    }
  }

  private assertSkillIsUsable(skillDef: AdminSkillDefinition, skillId: string): void {
    if (!skillDef.isPublished) {
      throw new BadRequestException(`Skill is not published: ${skillId}`);
    }
    if (skillDef.isHidden) {
      throw new BadRequestException(`Skill is hidden: ${skillId}`);
    }
  }

  private assertSkillIsTrainable(_skillDef: AdminSkillDefinition, _skillId: string, _sourceId?: string): void {
    // Legacy: training validation now lives in learnSkillFromTraining (universal trainer resolver).
  }

  async knowsSkill(characterId: string, skillId: string): Promise<boolean> {
    return (await this.readCharacterSkills(characterId)).some((entry) => entry.skillId === skillId);
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
        await this.grantSkillToCharacter(characterId, skillId, 'quest', questId);
        results.push({ skillId, granted: true });
      } catch (error) {
        results.push({ skillId, granted: false, reason: (error as Error).message });
      }
    }

    return results;
  }

  async getOrCreateLoadout(characterId: string): Promise<CharacterSkillLoadout> {
    const character = await this.ensureCharacterExists(characterId);
    const combatMastery = typeof (character as { combatMastery?: unknown }).combatMastery === 'number'
      ? Number((character as { combatMastery?: number }).combatMastery)
      : 0;

    const existing = await this.readCharacterLoadout(characterId);
    if (existing.length > 0) {
      const unlocked = getUnlockedSlotCount(combatMastery);
      const updatedSlots = existing.map((slot) => ({
        ...slot,
        unlocked: slot.slotIndex < unlocked,
      }));
      await this.writeCharacterLoadout(characterId, updatedSlots);
      return { characterId, slots: updatedSlots };
    }

    const slots = createDefaultLoadout(combatMastery);
    await this.writeCharacterLoadout(characterId, slots);
    return { characterId, slots };
  }

  async updateLoadout(
    characterId: string,
    updates: Array<{ slotIndex: number; skillId: string | null }>,
  ): Promise<CharacterSkillLoadout> {
    await this.contentService.ensureInitialized();
    const loadout = await this.getOrCreateLoadout(characterId);

    const learnedSkillIds = new Set((await this.readCharacterSkills(characterId)).map((entry) => entry.skillId));

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

    await this.writeCharacterLoadout(characterId, nextSlots);

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

  private async ensureCharacterExists(characterId: string) {
    if (isFileStorageMode()) {
      const character = await this.runtimeStore.getCharacterById(characterId);
      if (!character) {
        throw new NotFoundException(`Character not found: ${characterId}`);
      }
      return character as unknown as Record<string, unknown>;
    }

    const character = await this.prisma.character.findUnique({ where: { id: characterId } });
    if (!character) {
      throw new NotFoundException(`Character not found: ${characterId}`);
    }
    return character as unknown as Record<string, unknown>;
  }

  private getCharacterSkillModel(): {
    findMany?: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findUnique?: (args: unknown) => Promise<Record<string, unknown> | null>;
    create?: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    if (isFileStorageMode()) {
      return {};
    }
    return (this.prisma as unknown as { characterSkill?: unknown }).characterSkill as {
      findMany?: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findUnique?: (args: unknown) => Promise<Record<string, unknown> | null>;
      create?: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  private getCharacterSkillLoadoutModel(): {
    findUnique?: (args: unknown) => Promise<Record<string, unknown> | null>;
    create?: (args: unknown) => Promise<Record<string, unknown>>;
    upsert?: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    if (isFileStorageMode()) {
      return {};
    }
    return (this.prisma as unknown as { characterSkillLoadout?: unknown }).characterSkillLoadout as {
      findUnique?: (args: unknown) => Promise<Record<string, unknown> | null>;
      create?: (args: unknown) => Promise<Record<string, unknown>>;
      upsert?: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  private normalizeSkillRow(row: Record<string, unknown>): CharacterSkill | null {
    const id = typeof row.id === 'string' ? row.id : '';
    const characterId = typeof row.characterId === 'string' ? row.characterId : '';
    const skillId = typeof row.skillId === 'string' ? row.skillId : '';
    const level = typeof row.level === 'number' ? row.level : 1;
    const sourceType = typeof row.sourceType === 'string' ? row.sourceType as CharacterSkillSourceType : 'admin';
    const sourceId = typeof row.sourceId === 'string' || row.sourceId === null ? row.sourceId : null;
    const learnedRaw = row.learnedAt;
    const learnedAt = learnedRaw instanceof Date
      ? learnedRaw
      : typeof learnedRaw === 'string'
        ? new Date(learnedRaw)
        : new Date();

    if (!id || !characterId || !skillId || Number.isNaN(learnedAt.getTime())) {
      return null;
    }

    return {
      id,
      characterId,
      skillId,
      level,
      learnedAt,
      sourceType,
      sourceId,
    };
  }

  private normalizeLoadoutSlots(slots: unknown): CombatSkillSlot[] {
    if (!Array.isArray(slots)) {
      return [];
    }

    const normalized = slots
      .map((slot) => {
        if (!slot || typeof slot !== 'object') {
          return null;
        }
        const raw = slot as Record<string, unknown>;
        const slotIndex = typeof raw.slotIndex === 'number' ? raw.slotIndex : -1;
        const unlocked = Boolean(raw.unlocked);
        const skillId = typeof raw.skillId === 'string' || raw.skillId === null ? raw.skillId : null;
        const slotType = typeof raw.slotType === 'string' ? raw.slotType : 'ANY';
        if (slotIndex < 0) {
          return null;
        }
        return {
          slotIndex,
          unlocked,
          skillId,
          slotType: (['ANY', 'MAGIC', 'PHYSICAL', 'PASSIVE', 'RUNE', 'SHAMANIC'].includes(slotType)
            ? slotType
            : 'ANY') as CombatSkillSlot['slotType'],
        };
      })
      .filter((slot): slot is CombatSkillSlot => slot !== null)
      .sort((a, b) => a.slotIndex - b.slotIndex);

    return normalized;
  }

  private async readMap<TMap extends Record<string, unknown>>(key: string): Promise<TMap> {
    if (isFileStorageMode()) {
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
      await this.runtimeStore.writeArenaData(key, value);
      return;
    }

    const jsonValue = value as InputJsonValue;
    await this.prisma.contentStore.upsert({
      where: { key },
      create: { key, value: jsonValue },
      update: { value: jsonValue },
    });
  }

  private async readCharacterItemIds(characterId: string): Promise<string[]> {
    if (isFileStorageMode()) {
      const character = await this.runtimeStore.getCharacterById(characterId);
      const rawItems = Array.isArray((character as { inventoryItems?: unknown } | null | undefined)?.inventoryItems)
        ? (character as { inventoryItems?: Array<Record<string, unknown>> }).inventoryItems ?? []
        : [];

      const ids = rawItems
        .map((entry) => (entry && typeof entry === 'object' ? String((entry as { itemId?: unknown }).itemId ?? '').trim() : ''))
        .filter((itemId) => itemId.length > 0);

      return [...new Set(ids)];
    }

    try {
      const rows: Array<{ itemId: string }> = await this.prisma.characterInventoryItem.findMany({
        where: { characterId },
        select: { itemId: true },
      });
      return rows.map((row) => row.itemId);
    } catch (error) {
      this.logger.warn(`Unable to read inventory items for ${characterId}: ${(error as Error).message}`);
      return [];
    }
  }

  private async readCharacterSkills(characterId: string): Promise<CharacterSkill[]> {
    const model = this.getCharacterSkillModel();
    if (model?.findMany) {
      try {
        const rows = await model.findMany({
          where: { characterId },
          orderBy: { learnedAt: 'asc' },
        });
        return rows
          .map((row) => this.normalizeSkillRow(row))
          .filter((row): row is CharacterSkill => row !== null);
      } catch (error) {
        this.logger.warn(`Falling back to content-store skill rows for ${characterId}: ${(error as Error).message}`);
      }
    }

    const map = await this.readMap<StoredCharacterSkillMap>(CHARACTER_SKILLS_STORE_KEY);
    const rawRows = Array.isArray(map[characterId]) ? map[characterId] : [];
    return rawRows
      .map((row) => this.normalizeSkillRow(row as unknown as Record<string, unknown>))
      .filter((row): row is CharacterSkill => row !== null)
      .sort((a, b) => a.learnedAt.getTime() - b.learnedAt.getTime());
  }

  private async createCharacterSkill(input: {
    characterId: string;
    skillId: string;
    level: number;
    sourceType: CharacterSkillSourceType;
    sourceId: string | null;
  }): Promise<CharacterSkill> {
    const model = this.getCharacterSkillModel();
    if (model?.create) {
      try {
        const row = await model.create({
          data: {
            characterId: input.characterId,
            skillId: input.skillId,
            level: input.level,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
          },
        });
        const normalized = this.normalizeSkillRow(row);
        if (normalized) {
          return normalized;
        }
      } catch (error) {
        this.logger.warn(`Falling back to content-store skill create for ${input.characterId}: ${(error as Error).message}`);
      }
    }

    const map = await this.readMap<StoredCharacterSkillMap>(CHARACTER_SKILLS_STORE_KEY);
    const list = Array.isArray(map[input.characterId]) ? map[input.characterId] : [];
    const row: StoredCharacterSkill = {
      id: randomUUID(),
      characterId: input.characterId,
      skillId: input.skillId,
      level: input.level,
      learnedAt: new Date().toISOString(),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    };
    map[input.characterId] = [...list, row];
    await this.writeMap(CHARACTER_SKILLS_STORE_KEY, map);

    return {
      ...row,
      learnedAt: new Date(row.learnedAt),
    };
  }

  private async readCharacterLoadout(characterId: string): Promise<CombatSkillSlot[]> {
    const model = this.getCharacterSkillLoadoutModel();
    if (model?.findUnique) {
      try {
        const row = await model.findUnique({ where: { characterId } });
        const slots = this.normalizeLoadoutSlots((row as { slots?: unknown } | null)?.slots ?? []);
        if (slots.length > 0) {
          return slots;
        }
      } catch (error) {
        this.logger.warn(`Falling back to content-store loadout rows for ${characterId}: ${(error as Error).message}`);
      }
    }

    const map = await this.readMap<StoredCharacterLoadoutMap>(CHARACTER_LOADOUTS_STORE_KEY);
    return this.normalizeLoadoutSlots(map[characterId]);
  }

  private async writeCharacterLoadout(characterId: string, slots: CombatSkillSlot[]): Promise<void> {
    const normalizedSlots = this.normalizeLoadoutSlots(slots);

    const model = this.getCharacterSkillLoadoutModel();
    if (model?.upsert) {
      try {
        await model.upsert({
          where: { characterId },
          create: { characterId, slots: normalizedSlots },
          update: { slots: normalizedSlots },
        });
        return;
      } catch (error) {
        this.logger.warn(`Falling back to content-store loadout upsert for ${characterId}: ${(error as Error).message}`);
      }
    }

    const map = await this.readMap<StoredCharacterLoadoutMap>(CHARACTER_LOADOUTS_STORE_KEY);
    map[characterId] = normalizedSlots;
    await this.writeMap(CHARACTER_LOADOUTS_STORE_KEY, map);
  }
}
