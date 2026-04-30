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
    createdAt: skill.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

export function validateSkill(skill: AdminSkillDefinition): string[] {
  return validateSkillDefinition(skill);
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
    return normalizeSkill(await createContentEntry<AdminSkillDefinition>('skills', normalized));
  },

  async update(id: string, patch: Partial<AdminSkillDefinition>): Promise<AdminSkillDefinition> {
    const found = await this.getById(id);
    if (!found) {
      throw new Error(`Skill not found: ${id}`);
    }
    const merged = normalizeSkill({ ...found, ...patch, id: found.id });
    const errors = validateSkill(merged);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return normalizeSkill(await updateContentEntry<AdminSkillDefinition>('skills', id, merged));
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('skills', id);
  },
};
