import {
  AcquisitionType,
  CastType,
  DamageKind,
  EffectStackMode,
  SkillResourceType,
  SkillTargetType,
  SkillType,
  validateSkillDefinition,
  type AdminSkillDefinition,
} from '@theend/rpg-domain';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { extractRawCollectionFromImportJson, importCollectionFromJsonEntries, type JsonImportResult } from './adminJsonImportExport';
import { nowIso, uid } from './storage';

export function emptySkill(): AdminSkillDefinition {
  const now = nowIso();
  return {
    id: '',
    name: '',
    slug: '',
    type: SkillType.PHYSICAL,
    subtypes: [],
    iconUrl: '',
    shortDescription: '',
    gameplayDescription: '',
    loreDescription: '',
    isActive: true,
    isPassive: false,
    isToggleable: false,
    maxLevel: 5,
    levels: [1, 2, 3, 4, 5].map((level) => ({ level, basePower: level * 5 })),
    target: {
      targetType: SkillTargetType.SINGLE_ENEMY,
      range: 1,
      canTargetSelf: false,
      canTargetAllies: false,
      canTargetEnemies: true,
      canTargetDead: false,
    },
    costs: {
      resources: [{ type: SkillResourceType.STAMINA, amount: 10 }],
      allowClassModifiers: true,
      allowRaceModifiers: true,
      allowEquipmentModifiers: true,
      isFree: false,
    },
    damage: [{
      id: 'damage_1',
      damageKind: DamageKind.PHYSICAL,
      minDamage: 1,
      maxDamage: 3,
      canCrit: true,
    }],
    healing: [],
    effects: [],
    summons: [],
    transformations: [],
    risks: [],
    rune: {
      usesRunes: false,
      runeIds: [],
      requiredRuneIds: [],
      bindingRuneIds: [],
      runeCosts: [],
      removable: true,
      canDestroyHost: false,
    },
    shamanism: {
      requiresSpirit: false,
      requiresContract: false,
      canSummonEntity: false,
      canMakeContract: false,
      canLoseControl: false,
    },
    requirements: {},
    acquisition: {
      methods: [{ type: AcquisitionType.ADMIN_GRANT }],
      isStarterSkill: false,
      isQuestReward: false,
      isBuyable: false,
      isDiscoverable: false,
      isAdminOnly: true,
    },
    classScaling: [],
    raceRules: [],
    cooldown: { cooldownTurns: 0 },
    cast: {
      castType: CastType.INSTANT,
      requiresLineOfSight: true,
      canBeInterrupted: false,
    },
    tags: [],
    isPublished: false,
    isHidden: false,
    acquisitionMode: 'admin',
    isTrainable: false,
    requiredLevel: undefined,
    requiredQuestId: undefined,
    requiredCompletedQuestId: undefined,
    requiredQuestItemId: undefined,
    requiredNpcId: undefined,
    requiredClassIds: [],
    requiredRaceIds: [],
    requiredKnownSkillIds: [],
    adminNotes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeSkill(skill: AdminSkillDefinition): AdminSkillDefinition {
  const id = skill.id?.trim() || uid('skill');
  const slug = skill.slug?.trim() || id.replace(/^skill_/, '').replaceAll('_', '-');
  return {
    ...emptySkill(),
    ...skill,
    id,
    slug,
    subtypes: skill.subtypes ?? [],
    maxLevel: Math.min(5, Math.max(1, Number(skill.maxLevel || 1))) as AdminSkillDefinition['maxLevel'],
    levels: (skill.levels?.length ? skill.levels : emptySkill().levels).slice(0, 5),
    costs: {
      ...emptySkill().costs,
      ...skill.costs,
      resources: skill.costs?.resources ?? [],
    },
    damage: skill.damage ?? [],
    healing: skill.healing ?? [],
    effects: skill.effects ?? [],
    summons: skill.summons ?? [],
    transformations: skill.transformations ?? [],
    risks: skill.risks ?? [],
    tags: skill.tags ?? [],
    classScaling: skill.classScaling ?? [],
    raceRules: skill.raceRules ?? [],
    acquisitionMode: skill.acquisitionMode ?? 'admin',
    isTrainable: skill.isTrainable === true,
    requiredLevel: typeof skill.requiredLevel === 'number' ? Math.max(0, Math.floor(skill.requiredLevel)) : undefined,
    requiredQuestId: skill.requiredQuestId?.trim() || undefined,
    requiredCompletedQuestId: skill.requiredCompletedQuestId?.trim() || undefined,
    requiredQuestItemId: skill.requiredQuestItemId?.trim() || undefined,
    requiredNpcId: skill.requiredNpcId?.trim() || undefined,
    requiredClassIds: skill.requiredClassIds ?? [],
    requiredRaceIds: skill.requiredRaceIds ?? [],
    requiredKnownSkillIds: skill.requiredKnownSkillIds ?? [],
    createdAt: skill.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

export function validateSkill(skill: AdminSkillDefinition): string[] {
  return validateSkillDefinition(skill);
}

/**
 * Extracts an array of raw skill records from export/manual json.
 * Supports: array, { skills }, full backup { content: { skills } }.
 */
export function extractRawSkillsFromImportJson(payload: unknown): unknown[] {
  return extractRawCollectionFromImportJson(payload, 'skills');
}

export async function importSkillsFromJsonEntries(entries: unknown[]): Promise<JsonImportResult> {
  return importCollectionFromJsonEntries<AdminSkillDefinition>({
    entries,
    defaults: emptySkill,
    normalize: normalizeSkill,
    validate: validateSkill,
    getAll: () => skillsService.getAll(),
    create: (value) => skillsService.create(value),
    update: (id, value) => skillsService.update(id, value),
  });
}

export const skillsService = {
  async getAll(): Promise<AdminSkillDefinition[]> {
    return (await getContentCollection<AdminSkillDefinition>('skills')).map(normalizeSkill);
  },

  async getById(id: string): Promise<AdminSkillDefinition | null> {
    const skill = await getContentEntry<AdminSkillDefinition>('skills', id);
    return skill ? normalizeSkill(skill) : null;
  },

  async create(payload: AdminSkillDefinition): Promise<AdminSkillDefinition> {
    const normalized = normalizeSkill(payload);
    const errors = validateSkill(normalized);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    const saved = normalizeSkill(await createContentEntry<AdminSkillDefinition>('skills', normalized));
    const verified = await getContentEntry<AdminSkillDefinition>('skills', saved.id);
    if (!verified) {
      throw new Error('Сохранение не подтверждено: запись не найдена после сохранения.');
    }
    return normalizeSkill(verified);
  },

  async update(id: string, patch: Partial<AdminSkillDefinition>): Promise<AdminSkillDefinition> {
    const normalizedId = id.trim();
    const found = await this.getById(normalizedId);
    if (!found) {
      throw new Error(`Skill not found: ${normalizedId}`);
    }
    const merged = normalizeSkill({ ...found, ...patch, id: found.id });
    const errors = validateSkill(merged);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    const saved = normalizeSkill(await updateContentEntry<AdminSkillDefinition>('skills', normalizedId, merged));
    const verified = await getContentEntry<AdminSkillDefinition>('skills', saved.id);
    if (!verified) {
      throw new Error('Сохранение не подтверждено: запись не найдена после сохранения.');
    }
    return normalizeSkill(verified);
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('skills', id);
  },

  async rename(oldId: string, nextId: string, payload: AdminSkillDefinition): Promise<AdminSkillDefinition> {
    const fromId = oldId.trim();
    const toId = nextId.trim();
    if (!fromId || !toId) {
      throw new Error('Skill id is required.');
    }
    if (fromId === toId) {
      return this.update(fromId, payload);
    }

    const existing = await this.getById(toId);
    if (existing) {
      throw new Error(`Duplicate skills id: ${toId}`);
    }

    const normalized = normalizeSkill({ ...payload, id: toId });
    const errors = validateSkill(normalized);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    const created = await this.create(normalized);
    await this.delete(fromId);
    return created;
  },
};
