"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeBloodCostToHp = normalizeBloodCostToHp;
exports.normalizeSkillResourceCosts = normalizeSkillResourceCosts;
exports.getSkillLevelData = getSkillLevelData;
exports.getSkillPowerAtLevel = getSkillPowerAtLevel;
exports.getSkillCostSummary = getSkillCostSummary;
const skill_enums_1 = require("./skill.enums");
/**
 * Conversion ratio for blood costs to HP equivalents.
 * Blood is a health sacrifice mechanic; 1 blood = 1 HP cost.
 * This ensures consistent resource balance in frontend preview and backend validation.
 */
const BLOOD_TO_HP_RATIO = 1;
/**
 * Convert blood cost amount to HP equivalent using the configured ratio.
 * Used for frontend preview and backend validation of skill resource costs.
 * @param bloodAmount The amount of blood cost
 * @returns HP equivalent of the blood cost
 */
function normalizeBloodCostToHp(bloodAmount) {
    return Math.ceil(bloodAmount * BLOOD_TO_HP_RATIO);
}
/**
 * Normalize skill resource costs by converting blood costs to HP equivalents.
 * Replaces 'blood' resource type entries with 'hp' entries in the returned summary.
 * This ensures consistent cost display and validation across frontend and backend.
 * @param costs Array of cost entries from getSkillCostSummary
 * @returns Normalized costs with blood converted to hp
 */
function normalizeSkillResourceCosts(costs) {
    return costs.map((cost) => {
        if (String(cost.type).toLowerCase() === 'blood' || cost.type === skill_enums_1.SkillResourceType.BLOOD) {
            return {
                type: skill_enums_1.SkillResourceType.HP,
                amount: normalizeBloodCostToHp(cost.amount),
            };
        }
        return cost;
    });
}
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
    const rawCosts = resources.map((cost) => ({
        type: cost.type,
        amount: cost.amount + (cost.amountPerLevel ?? 0) * Math.max(0, level - 1),
    }));
    // Normalize blood costs to HP equivalent for consistent frontend preview and backend validation
    return normalizeSkillResourceCosts(rawCosts);
}
