"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSkillLevelData = getSkillLevelData;
exports.getSkillPowerAtLevel = getSkillPowerAtLevel;
exports.getSkillCostSummary = getSkillCostSummary;
function getSkillLevelData(skill, level) {
    const safeLevel = Math.min(skill.maxLevel, Math.max(1, Math.floor(level)));
    return skill.levels.find((entry) => entry.level === safeLevel)
        ?? skill.levels[0]
        ?? { level: safeLevel, basePower: 0 };
}
function getSkillPowerAtLevel(skill, level) {
    const levelData = getSkillLevelData(skill, level);
    return levelData.basePower + (levelData.scalingPower ?? 0) * Math.max(0, levelData.level - 1);
}
function getSkillCostSummary(skill, level) {
    const levelData = getSkillLevelData(skill, level);
    const overrides = levelData.costsOverride?.resources;
    const resources = overrides && overrides.length > 0 ? overrides : skill.costs.resources;
    return resources.map((cost) => ({
        type: cost.type,
        amount: cost.amount + (cost.amountPerLevel ?? 0) * Math.max(0, level - 1),
    }));
}
