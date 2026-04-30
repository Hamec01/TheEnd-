import {
  AcquisitionType,
  CastType,
  SkillSubtype,
  SkillTargetType,
  SkillType,
  type AdminSkillDefinition,
  type SkillLevelData,
} from '@theend/rpg-domain';

export const SKILL_TYPES = Object.values(SkillType);
export const SKILL_SUBTYPES = Object.values(SkillSubtype);
export const SKILL_TARGET_TYPES = Object.values(SkillTargetType);
export const SKILL_CAST_TYPES = Object.values(CastType);
export const SKILL_ACQUISITION_TYPES = Object.values(AcquisitionType);

export function formatEnumLabel(value: string): string {
  return value
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

export function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function formatCommaList(values: string[] | undefined): string {
  return (values ?? []).join(', ');
}

export function clampLevel(level: number, maxLevel: number): number {
  return Math.min(Math.max(1, Math.floor(level || 1)), Math.max(1, Math.floor(maxLevel || 1)));
}

export function syncLevels(levels: SkillLevelData[] | undefined, maxLevel: number): SkillLevelData[] {
  const safeMaxLevel = clampLevel(maxLevel, 5);
  const byLevel = new Map((levels ?? []).map((entry) => [entry.level, entry]));
  return Array.from({ length: safeMaxLevel }, (_, index) => {
    const level = index + 1;
    return byLevel.get(level) ?? { level, basePower: level * 5 };
  });
}

export function normalizeSkillDraft(skill: AdminSkillDefinition): AdminSkillDefinition {
  return {
    ...skill,
    subtypes: skill.subtypes ?? [],
    tags: skill.tags ?? [],
    levels: syncLevels(skill.levels, skill.maxLevel),
    damage: skill.damage ?? [],
    healing: skill.healing ?? [],
    effects: skill.effects ?? [],
    summons: skill.summons ?? [],
    transformations: skill.transformations ?? [],
    risks: skill.risks ?? [],
    classScaling: skill.classScaling ?? [],
    raceRules: skill.raceRules ?? [],
  };
}