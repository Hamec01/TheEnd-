"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdjustedSkillCost = getAdjustedSkillCost;
exports.canUseSkill = canUseSkill;
exports.applySkillCost = applySkillCost;
function getMpMultiplier(category, modifiers) {
    if (category === 'magic') {
        return modifiers.magicMpCostMultiplier;
    }
    if (category === 'elemental') {
        return modifiers.elementMpCostMultiplier;
    }
    return 1;
}
function getAdjustedSkillCost(skill, modifiers) {
    const mpBase = skill.cost.mp ?? 0;
    const multiplier = getMpMultiplier(skill.category, modifiers);
    return {
        hp: skill.cost.hp,
        mp: mpBase > 0 ? Math.max(0, Math.round(mpBase * multiplier)) : skill.cost.mp,
        stamina: skill.cost.stamina,
        spirit: skill.cost.spirit,
    };
}
function canUseSkill(user, skill) {
    if (skill.requiredRace && skill.requiredRace.length > 0 && !skill.requiredRace.includes(user.race)) {
        return { ok: false, reason: 'Skill is not available for this race.', adjustedCost: skill.cost };
    }
    if (skill.forbiddenRace && skill.forbiddenRace.includes(user.race)) {
        return { ok: false, reason: 'Skill is forbidden for this race.', adjustedCost: skill.cost };
    }
    if (skill.category === 'magic' && !user.raceModifiers.canUseMagic) {
        return { ok: false, reason: 'Race cannot use magic skills.', adjustedCost: skill.cost };
    }
    if (skill.category === 'elemental' && !user.raceModifiers.canUseElements) {
        return { ok: false, reason: 'Race cannot use elemental skills.', adjustedCost: skill.cost };
    }
    if (skill.requiredStats && user.stats) {
        for (const [stat, required] of Object.entries(skill.requiredStats)) {
            if ((user.stats[stat] ?? 0) < required) {
                return { ok: false, reason: `Required stat ${stat} is too low.`, adjustedCost: skill.cost };
            }
        }
    }
    const adjustedCost = getAdjustedSkillCost(skill, user.raceModifiers);
    if ((adjustedCost.hp ?? 0) > user.currentHp) {
        return { ok: false, reason: 'Not enough HP.', adjustedCost };
    }
    if ((adjustedCost.mp ?? 0) > user.currentMp) {
        return { ok: false, reason: 'Not enough MP.', adjustedCost };
    }
    if ((adjustedCost.stamina ?? 0) > user.currentStamina) {
        return { ok: false, reason: 'Not enough stamina.', adjustedCost };
    }
    if ((adjustedCost.spirit ?? 0) > (user.currentSpirit ?? 0)) {
        return { ok: false, reason: 'Not enough spirit.', adjustedCost };
    }
    return { ok: true, adjustedCost };
}
function applySkillCost(user, skill) {
    const check = canUseSkill(user, skill);
    if (!check.ok) {
        throw new Error(check.reason ?? 'Cannot use skill.');
    }
    return {
        ...user,
        currentHp: Math.max(0, user.currentHp - (check.adjustedCost.hp ?? 0)),
        currentMp: Math.max(0, user.currentMp - (check.adjustedCost.mp ?? 0)),
        currentStamina: Math.max(0, user.currentStamina - (check.adjustedCost.stamina ?? 0)),
        currentSpirit: Math.max(0, (user.currentSpirit ?? 0) - (check.adjustedCost.spirit ?? 0)),
    };
}
