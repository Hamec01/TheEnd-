"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStatusResistanceImmunityProfile = buildStatusResistanceImmunityProfile;
exports.applyStatusResistanceToChance = applyStatusResistanceToChance;
exports.tryApplyCombatStatus = tryApplyCombatStatus;
exports.getAttackerHitChanceDeltaFromStatuses = getAttackerHitChanceDeltaFromStatuses;
exports.collectPeriodicStatusDamage = collectPeriodicStatusDamage;
exports.tickCombatStatusDurationsEndOfRound = tickCombatStatusDurationsEndOfRound;
exports.syncArenaEntityControlFlagsFromStatuses = syncArenaEntityControlFlagsFromStatuses;
const combat_item_effect_1 = require("./combat-item-effect");
const combat_status_registry_1 = require("./combat-status-registry");
const combat_status_sync_1 = require("./combat-status-sync");
function statusMatchKeys(canonicalId, rawId) {
    const keys = new Set();
    keys.add(canonicalId.toLowerCase());
    if (rawId) {
        keys.add(rawId.trim().toLowerCase());
    }
    const def = (0, combat_status_registry_1.getCombatStatusDefinition)(canonicalId);
    if (def) {
        keys.add(def.id.toLowerCase());
        for (const a of def.aliases) {
            keys.add(a.toLowerCase());
        }
    }
    return [...keys];
}
/**
 * Собирает иммунитеты и сопротивления из пассивных (always) эффектов экипировки/бафов.
 */
function buildStatusResistanceImmunityProfile(effects) {
    const immunityKeys = new Set();
    const resistancePercentByCanonical = new Map();
    for (const e of effects) {
        if (!e || !(0, combat_item_effect_1.isPassiveEquipmentTrigger)(e.trigger)) {
            continue;
        }
        if (e.type === 'status_immunity') {
            const sid = e.statusId?.trim();
            if (!sid) {
                continue;
            }
            const canon = (0, combat_status_registry_1.canonicalCombatStatusId)(sid) ?? sid;
            for (const k of statusMatchKeys(canon, sid)) {
                immunityKeys.add(k);
            }
        }
        if (e.type === 'status_resistance') {
            const sid = e.statusId?.trim();
            if (!sid) {
                continue;
            }
            const pct = Math.max(0, (0, combat_item_effect_1.effectNumericPercent)(e) + (0, combat_item_effect_1.effectNumericFlat)(e));
            const canon = (0, combat_status_registry_1.canonicalCombatStatusId)(sid) ?? sid;
            const prev = resistancePercentByCanonical.get(canon) ?? 0;
            resistancePercentByCanonical.set(canon, Math.min(90, prev + pct));
        }
    }
    return { immunityKeys, resistancePercentByCanonical };
}
function isImmuneToStatus(profile, canonicalId, rawId) {
    for (const k of statusMatchKeys(canonicalId, rawId)) {
        if (profile.immunityKeys.has(k)) {
            return true;
        }
    }
    return false;
}
function getResistancePercent(profile, canonicalId) {
    return profile.resistancePercentByCanonical.get(canonicalId) ?? 0;
}
/**
 * Формула: finalChance = baseChance * (1 - resistance/100), кламп 0..100.
 */
function applyStatusResistanceToChance(baseChancePercent, resistancePercent) {
    const b = Math.max(0, Math.min(100, baseChancePercent));
    const r = Math.max(0, Math.min(90, resistancePercent));
    return Math.max(0, Math.min(100, Math.round((b * (100 - r)) / 100)));
}
function readTickOverride(effect) {
    const data = effect.data;
    if (!data || typeof data !== 'object') {
        return undefined;
    }
    const tick = data.tickDamage;
    const cat = data.damageCategory;
    if (typeof tick !== 'number' || !Number.isFinite(tick) || tick <= 0) {
        return undefined;
    }
    if (typeof cat !== 'string' || !cat.trim()) {
        return undefined;
    }
    return { flat: Math.floor(tick), category: cat };
}
function resolveDurationTurns(effect, def) {
    if (typeof effect.durationTurns === 'number' && Number.isFinite(effect.durationTurns)) {
        return Math.max(0, Math.floor(effect.durationTurns));
    }
    if (def) {
        return Math.max(1, def.defaultDurationTurns);
    }
    return 1;
}
/**
 * Длительность: уменьшается один раз за полный цикл resolve (конец раунда после всех шагов).
 * Пока remainingTurns > 0, контрольные флаги (stun и т.д.) активны.
 */
function tryApplyCombatStatus(params) {
    const rawId = params.effect.statusId?.trim();
    if (!rawId) {
        return {
            outcome: 'skipped',
            canonicalStatusId: null,
            baseChancePercent: 0,
            finalChancePercent: 0,
            messageRu: 'Эффект наложения статуса без statusId пропущен.',
        };
    }
    const canonical = (0, combat_status_registry_1.canonicalCombatStatusId)(rawId) ?? rawId;
    const def = (0, combat_status_registry_1.getCombatStatusDefinition)(canonical);
    const storedId = def?.id ?? canonical;
    if (isImmuneToStatus(params.targetDefenseProfile, storedId, rawId)) {
        const label = def?.labelRu ?? rawId;
        return {
            outcome: 'immune',
            canonicalStatusId: storedId,
            baseChancePercent: Math.max(0, Math.min(100, params.effect.chancePercent ?? 100)),
            finalChancePercent: 0,
            messageRu: `${params.target.name} невосприимчив к эффекту: ${label}.`,
        };
    }
    const baseChance = Math.max(0, Math.min(100, params.effect.chancePercent ?? 100));
    const resist = getResistancePercent(params.targetDefenseProfile, storedId);
    const finalChance = applyStatusResistanceToChance(baseChance, resist);
    if (params.rollChance && finalChance <= 0) {
        const label = def?.labelRu ?? rawId;
        if (baseChance <= 0) {
            return {
                outcome: 'missed_chance',
                canonicalStatusId: storedId,
                baseChancePercent: baseChance,
                finalChancePercent: finalChance,
                messageRu: `${label}: шанс 0%, эффект не сработал.`,
            };
        }
        return {
            outcome: 'resisted',
            canonicalStatusId: storedId,
            baseChancePercent: baseChance,
            finalChancePercent: finalChance,
            messageRu: `${params.target.name} сопротивляется эффекту: ${label}.`,
        };
    }
    if (params.rollChance) {
        const roll = params.rng() * 100;
        if (roll > finalChance) {
            const label = def?.labelRu ?? rawId;
            return {
                outcome: 'missed_chance',
                canonicalStatusId: storedId,
                baseChancePercent: baseChance,
                finalChancePercent: finalChance,
                messageRu: `${label} не сработал против ${params.target.name} (${finalChance}% шанс).`,
            };
        }
    }
    const duration = resolveDurationTurns(params.effect, def);
    if (duration <= 0) {
        return {
            outcome: 'skipped',
            canonicalStatusId: storedId,
            baseChancePercent: baseChance,
            finalChancePercent: finalChance,
        };
    }
    const tickOverride = params.effect.type === 'apply_status' ? readTickOverride(params.effect) : undefined;
    upsertActiveStatus(params.target, {
        id: storedId,
        rawStatusId: rawId,
        remainingTurns: duration,
        sourceActorId: params.sourceActorId,
        sourceItemId: params.sourceItemId,
        sourceAbilityId: params.sourceAbilityId,
        stackMode: def?.stackMode ?? 'refresh',
        tickFlatOverride: tickOverride?.flat,
        tickCategoryOverride: tickOverride?.category,
    });
    const label = def?.labelRu ?? rawId;
    const msg = statusAppliedMessageRu(storedId, params.target.name, label);
    return {
        outcome: 'applied',
        canonicalStatusId: storedId,
        baseChancePercent: baseChance,
        finalChancePercent: finalChance,
        durationApplied: duration,
        messageRu: msg,
    };
}
function statusAppliedMessageRu(canonicalId, targetName, labelRu) {
    switch (canonicalId) {
        case 'stunned':
            return `${targetName} оглушён.`;
        case 'poisoned':
            return `${targetName} отравлен.`;
        case 'bleeding':
            return `У ${targetName} началось кровотечение.`;
        case 'burning':
            return `${targetName} горит.`;
        case 'blinded':
            return `${targetName} ослеплён.`;
        case 'silenced':
            return `${targetName} не может произносить заклинания.`;
        case 'frozen':
            return `${targetName} заморожен.`;
        case 'slowed':
            return `${targetName} замедлен.`;
        case 'cursed':
            return `${targetName} проклят.`;
        case 'knockdown':
            return `${targetName} сбит с ног.`;
        default:
            return `${targetName} получает эффект: ${labelRu}.`;
    }
}
function upsertActiveStatus(target, params) {
    if (!target.activeCombatStatuses) {
        target.activeCombatStatuses = [];
    }
    const list = target.activeCombatStatuses;
    const idx = list.findIndex((s) => s.id === params.id);
    if (idx < 0) {
        list.push({
            id: params.id,
            rawStatusId: params.rawStatusId,
            remainingTurns: params.remainingTurns,
            sourceActorId: params.sourceActorId,
            sourceItemId: params.sourceItemId,
            sourceAbilityId: params.sourceAbilityId,
            tickDamageFlatOverride: params.tickFlatOverride,
            tickDamageCategoryOverride: params.tickCategoryOverride,
        });
        return;
    }
    const cur = list[idx];
    if (params.stackMode === 'stack') {
        cur.stacks = Math.max(1, (cur.stacks ?? 1) + 1);
        cur.remainingTurns = Math.max(cur.remainingTurns, params.remainingTurns);
    }
    else {
        cur.remainingTurns = Math.max(cur.remainingTurns, params.remainingTurns);
    }
    cur.sourceActorId = params.sourceActorId ?? cur.sourceActorId;
    cur.sourceItemId = params.sourceItemId ?? cur.sourceItemId;
    cur.sourceAbilityId = params.sourceAbilityId ?? cur.sourceAbilityId;
    if (params.tickFlatOverride !== undefined) {
        cur.tickDamageFlatOverride = params.tickFlatOverride;
    }
    if (params.tickCategoryOverride !== undefined) {
        cur.tickDamageCategoryOverride = params.tickCategoryOverride;
    }
}
/**
 * Суммарная правка шанса попадания атакующего (ослепление и реестр).
 */
function getAttackerHitChanceDeltaFromStatuses(entity) {
    const list = entity.activeCombatStatuses;
    if (!list) {
        return 0;
    }
    let delta = 0;
    for (const s of list) {
        if (s.remainingTurns <= 0) {
            continue;
        }
        const def = (0, combat_status_registry_1.getCombatStatusDefinition)(s.id);
        if (def) {
            delta += def.attackerHitChanceDeltaPercent;
        }
    }
    return delta;
}
/**
 * Урон от DoT-статусов в фазе раунда (turn_start — яд/огонь; turn_end — кровь).
 */
function collectPeriodicStatusDamage(entities, phase) {
    const out = [];
    for (const entity of entities) {
        if (!entity.isAlive) {
            continue;
        }
        const list = entity.activeCombatStatuses;
        if (!list) {
            continue;
        }
        for (const s of list) {
            if (s.remainingTurns <= 0) {
                continue;
            }
            const def = (0, combat_status_registry_1.getCombatStatusDefinition)(s.id);
            const periodic = def?.periodicDamage;
            if (typeof s.tickDamageFlatOverride === 'number'
                && s.tickDamageFlatOverride > 0
                && s.tickDamageCategoryOverride) {
                if (phase === 'turn_start') {
                    const label = def?.labelRu ?? s.id;
                    out.push({
                        entityId: entity.id,
                        entityName: entity.name,
                        statusId: s.id,
                        amount: s.tickDamageFlatOverride,
                        damageCategory: s.tickDamageCategoryOverride,
                        messageRu: `${entity.name} получает ${s.tickDamageFlatOverride} урона от «${label}».`,
                    });
                }
                continue;
            }
            if (!periodic || periodic.phase !== phase) {
                continue;
            }
            const flat = periodic.amountFlat;
            if (flat <= 0) {
                continue;
            }
            const label = def?.labelRu ?? s.id;
            out.push({
                entityId: entity.id,
                entityName: entity.name,
                statusId: s.id,
                amount: flat,
                damageCategory: periodic.damageCategory,
                elementType: periodic.elementType,
                messageRu: `${entity.name} получает ${flat} урона от «${label}».`,
            });
        }
    }
    return out;
}
/**
 * Уменьшает remainingTurns на 1 в конце полного цикла resolve раунда (после всех шагов команд).
 */
function tickCombatStatusDurationsEndOfRound(entities) {
    const removed = [];
    for (const entity of entities) {
        const list = entity.activeCombatStatuses;
        if (!list || list.length === 0) {
            continue;
        }
        const next = [];
        for (const s of list) {
            if (s.remainingTurns <= 0) {
                continue;
            }
            const left = s.remainingTurns - 1;
            if (left <= 0) {
                const def = (0, combat_status_registry_1.getCombatStatusDefinition)(s.id);
                removed.push({
                    entityId: entity.id,
                    entityName: entity.name,
                    statusId: s.id,
                    labelRu: def?.labelRu,
                });
                continue;
            }
            next.push({ ...s, remainingTurns: left });
        }
        entity.activeCombatStatuses = next;
    }
    return removed;
}
/** @deprecated Используйте syncControlFlagsFromActiveStatuses из combat-status-sync. */
function syncArenaEntityControlFlagsFromStatuses(entity) {
    (0, combat_status_sync_1.syncControlFlagsFromActiveStatuses)(entity);
}
