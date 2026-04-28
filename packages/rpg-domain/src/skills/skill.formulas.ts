import type { SkillDefinition, SkillLevelData } from './skill.types';

export function getSkillLevelData(skill: SkillDefinition, level: number): SkillLevelData {
  const safeLevel = Math.min(skill.maxLevel, Math.max(1, Math.floor(level)));
  return skill.levels.find((entry) => entry.level === safeLevel)
    ?? skill.levels[0]
    ?? { level: safeLevel, basePower: 0 };
}

export function getSkillPowerAtLevel(skill: SkillDefinition, level: number): number {
  const levelData = getSkillLevelData(skill, level);
  return levelData.basePower + (levelData.scalingPower ?? 0) * Math.max(0, levelData.level - 1);
}

export function getSkillCostSummary(skill: SkillDefinition, level: number): Array<{ type: string; amount: number }> {
  const levelData = getSkillLevelData(skill, level);
  const overrides = levelData.costsOverride?.resources;
  const resources = overrides && overrides.length > 0 ? overrides : skill.costs.resources;
  return resources.map((cost) => ({
    type: cost.type,
    amount: cost.amount + (cost.amountPerLevel ?? 0) * Math.max(0, level - 1),
  }));
}
