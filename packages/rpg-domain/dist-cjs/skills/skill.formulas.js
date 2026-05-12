"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSkillCast = resolveSkillCast;
exports.validateSkillCast = validateSkillCast;
exports.normalizeSkillCastCommand = normalizeSkillCastCommand;
exports.normalizeSkillRuntimeCost = normalizeSkillRuntimeCost;
exports.normalizeBloodCostToHp = normalizeBloodCostToHp;
exports.normalizeSkillResourceCosts = normalizeSkillResourceCosts;
exports.getSkillLevelData = getSkillLevelData;
exports.getSkillPowerAtLevel = getSkillPowerAtLevel;
exports.getSkillCostSummary = getSkillCostSummary;
/**
 * Универсальный расчёт результата применения скилла (урон, лечение, эффекты) для skill_cast.
 * Возвращает { damageDone, healingDone, effectsApplied, logs }
 */
function resolveSkillCast(params) {
    const { skill, actor, target, level } = params;
    const logs = [];
    const damageDone = [];
    const healingDone = [];
    const effectsApplied = [];
    // Damage
    if (target && Array.isArray(skill.damage) && skill.damage.length > 0) {
        for (const dmg of skill.damage) {
            // Простейшая формула: base + scaling
            const base = typeof dmg.minDamage === 'number' ? dmg.minDamage : 0;
            const scaling = dmg.scalingStat && typeof actor[dmg.scalingStat] === 'number' && typeof dmg.scalingMultiplier === 'number'
                ? Math.floor(actor[dmg.scalingStat] * dmg.scalingMultiplier)
                : 0;
            const amount = Math.max(1, base + scaling);
            damageDone.push({ targetId: target.id, amount, damageKind: String(dmg.damageKind) });
            logs.push(`Deals ${amount} ${dmg.damageKind} damage to ${target.name}`);
        }
    }
    // Healing
    if (Array.isArray(skill.healing) && skill.healing.length > 0) {
        const healTarget = target ?? actor;
        for (const heal of skill.healing) {
            const base = typeof heal.minHeal === 'number' ? heal.minHeal : 0;
            const scaling = heal.scalingStat && typeof actor[heal.scalingStat] === 'number' && typeof heal.scalingMultiplier === 'number'
                ? Math.floor(actor[heal.scalingStat] * heal.scalingMultiplier)
                : 0;
            const amount = Math.max(1, base + scaling);
            healingDone.push({ targetId: healTarget.id, amount, healType: String(heal.healType) });
            logs.push(`Heals ${amount} ${heal.healType} on ${healTarget.name}`);
        }
    }
    // Effects
    if (target && Array.isArray(skill.effects) && skill.effects.length > 0) {
        for (const eff of skill.effects) {
            // Применяем эффект с вероятностью (упрощённо: всегда применяем)
            effectsApplied.push({ targetId: target.id, effectType: String(eff.effectType), durationTurns: eff.durationTurns });
            logs.push(`Applied ${eff.effectType} to ${target.name}`);
        }
    }
    return { damageDone, healingDone, effectsApplied, logs };
}
/**
 * Проверка валидности команды skill_cast (ресурсы, цель, кулдаун, требования).
 * Возвращает { ok, errors: string[] }
 */
function validateSkillCast(params) {
    const { skill, actor, command, level } = params;
    const errors = [];
    // Проверка знания скилла
    if (actor.knownSkillIds && !actor.knownSkillIds.includes(skill.id)) {
        errors.push('SKILL_NOT_KNOWN');
    }
    // Проверка кулдауна
    if (actor.cooldownSkillIds && actor.cooldownSkillIds.includes(skill.id)) {
        errors.push('SKILL_ON_COOLDOWN');
    }
    // Проверка ресурсов
    const cost = normalizeSkillRuntimeCost({ skill });
    if (actor.currentMp < cost.mp)
        errors.push('NOT_ENOUGH_MP');
    if (actor.currentStamina < cost.stamina)
        errors.push('NOT_ENOUGH_STAMINA');
    if (actor.currentHp <= cost.hp)
        errors.push('NOT_ENOUGH_HP');
    // Проверка требований (уровень, классы, расы и т.д.)
    if (skill.requirements?.minCharacterLevel && skill.requirements.minCharacterLevel > level) {
        errors.push('REQUIREMENTS_NOT_MET');
    }
    // TODO: добавить дополнительные проверки требований по необходимости
    return { ok: errors.length === 0, errors };
}
/**
 * Универсальный нормализатор команды skill_cast для боевой системы.
 * Строит CombatCommand для skill_cast с учетом всех нормализаций, payload, уровня и слота.
 * @param params.skill SkillDefinition
 * @param params.skillId string
 * @param params.level number
 * @param params.sourceSlotId CombatQuickSlotId
 * @param params.target CombatTarget
 * @returns CombatCommand
 */
function normalizeSkillCastCommand(params) {
    const { skill, skillId, level, sourceSlotId, target } = params;
    const cost = normalizeSkillRuntimeCost({ skill });
    return {
        id: `cmd_skill_${skillId}_${Date.now()}`,
        type: 'skill_cast',
        sourceSlotId,
        target,
        apCost: cost.ap,
        costs: {
            stamina: cost.stamina,
            mp: cost.mp,
            hp: cost.hp,
        },
        payload: {
            skillId,
            // Можно добавить targetZone, если нужно для area-скиллов
        },
        createdAt: new Date().toISOString(),
    };
}
/**
 * Robustly extract and normalize AP, MP, stamina, and HP costs from a SkillDefinition.
 * Handles legacy and new fields, applies blood→HP normalization, and safe fallbacks.
 * @param skill SkillDefinition
 * @param actor (optional) ArenaCombatEntity for future modifiers
 */
function normalizeSkillRuntimeCost(params) {
    const { skill } = params;
    // --- AP cost ---
    let ap = 1;
    if (typeof skill.apCost === 'number') {
        ap = Math.max(1, Math.round(skill.apCost));
    }
    else if (skill.costs && skill.costs.ap) {
        ap = Math.max(1, Math.round(skill.costs.ap));
    }
    else if (skill.cast && skill.cast.castType) {
        switch (skill.cast.castType) {
            case 'instant':
                ap = 1;
                break;
            case 'cast_time':
            case 'channeling':
                ap = 2;
                break;
            default:
                ap = 1;
        }
    }
    // --- Resource costs ---
    let mp = 0, stamina = 0, hp = 0;
    // New format: costs.resources[]
    if (skill.costs && Array.isArray(skill.costs.resources)) {
        for (const cost of skill.costs.resources) {
            const type = String(cost.type).toLowerCase();
            const amount = cost.amount ?? 0;
            if (type === 'mp')
                mp += amount;
            else if (type === 'stamina')
                stamina += amount;
            else if (type === 'hp')
                hp += amount;
            else if (type === 'blood')
                hp += normalizeBloodCostToHp(amount);
        }
    }
    // Legacy fields
    if (skill.manaCost)
        mp += skill.manaCost;
    if (skill.staminaCost)
        stamina += skill.staminaCost;
    if (skill.hpCost)
        hp += skill.hpCost;
    if (skill.bloodCost)
        hp += normalizeBloodCostToHp(skill.bloodCost);
    if (skill.cost && typeof skill.cost === 'object') {
        if (skill.cost.mp)
            mp += skill.cost.mp;
        if (skill.cost.stamina)
            stamina += skill.cost.stamina;
        if (skill.cost.hp)
            hp += skill.cost.hp;
        if (skill.cost.blood)
            hp += normalizeBloodCostToHp(skill.cost.blood);
    }
    // Clamp to safe non-negative integers
    ap = Math.max(1, Math.round(ap));
    mp = Math.max(0, Math.round(mp));
    stamina = Math.max(0, Math.round(stamina));
    hp = Math.max(0, Math.round(hp));
    return { ap, mp, stamina, hp };
}
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
