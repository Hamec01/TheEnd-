"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSkillDefinition = validateSkillDefinition;
const skill_enums_1 = require("./skill.enums");
function isMagicSkill(type) {
    return [
        skill_enums_1.SkillType.MAGIC,
        skill_enums_1.SkillType.ELEMENTAL_MAGIC,
        skill_enums_1.SkillType.NORMAL_MAGIC,
        skill_enums_1.SkillType.FORBIDDEN_MAGIC,
        skill_enums_1.SkillType.MIXED,
    ].includes(type);
}
function validateSkillDefinition(skill) {
    const errors = [];
    if (!skill.id.trim()) {
        errors.push('id required');
    }
    if (!skill.name.trim()) {
        errors.push('name required');
    }
    if (!skill.slug.trim()) {
        errors.push('slug required');
    }
    if (!skill.type) {
        errors.push('type required');
    }
    if (skill.maxLevel < 1 || skill.maxLevel > 5) {
        errors.push('maxLevel must be between 1 and 5');
    }
    if (skill.levels.some((level) => level.level < 1 || level.level > 5)) {
        errors.push('levels must be between 1 and 5');
    }
    if (skill.isActive && !skill.costs.isFree && skill.costs.resources.length === 0) {
        errors.push('active skill must have cost or be marked free');
    }
    for (const component of skill.damage) {
        if (component.minDamage > component.maxDamage) {
            errors.push(`damage ${component.id}: minDamage must be <= maxDamage`);
        }
    }
    for (const component of skill.healing) {
        if (component.minHeal > component.maxHeal) {
            errors.push(`healing ${component.id}: minHeal must be <= maxHeal`);
        }
    }
    for (const component of skill.effects) {
        if (component.chancePercent < 0 || component.chancePercent > 100) {
            errors.push(`effect ${component.id}: chance must be 0-100`);
        }
    }
    for (const component of skill.risks) {
        if (component.chancePercent < 0 || component.chancePercent > 100) {
            errors.push(`risk ${component.id}: chance must be 0-100`);
        }
    }
    if (skill.cooldown.cooldownTurns < 0) {
        errors.push('cooldown must be >= 0');
    }
    const dwarfRule = skill.raceRules.find((rule) => rule.raceId === 'race_dwarf' || rule.raceId === 'DWARF');
    if (isMagicSkill(skill.type) && dwarfRule && dwarfRule.canUse !== false && !skill.adminNotes?.includes('dwarf magic exception')) {
        errors.push('dwarf magic skills must set canUse=false or include admin exception note');
    }
    if (skill.rune.usesRunes && skill.rune.runeIds.length === 0 && skill.rune.requiredRuneIds.length === 0 && !skill.rune.ritualRuneAllowed) {
        errors.push('runic skill requires at least one rune or ritual rune allowance');
    }
    if (skill.type === skill_enums_1.SkillType.SHAMANISM && skill.shamanism.requiresSpirit && !skill.shamanism.spiritType) {
        errors.push('shamanic skill requires spirit type or explicit no-spirit setup');
    }
    if (skill.damage.some((component) => component.damageKind === skill_enums_1.DamageKind.RUNE) && !skill.rune.usesRunes) {
        errors.push('rune damage requires rune settings');
    }
    return errors;
}
