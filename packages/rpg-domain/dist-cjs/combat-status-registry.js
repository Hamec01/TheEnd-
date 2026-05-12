"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_COMBAT_STATUS_IDS = exports.COMBAT_STATUS_DEFINITIONS = void 0;
exports.canonicalCombatStatusId = canonicalCombatStatusId;
exports.getCombatStatusDefinition = getCombatStatusDefinition;
exports.isRegisteredCombatStatusId = isRegisteredCombatStatusId;
const STUNNED = {
    id: 'stunned',
    labelRu: 'Оглушение',
    category: 'control',
    defaultDurationTurns: 1,
    stackMode: 'refresh',
    blocksAction: true,
    blocksMagic: true,
    blocksMovement: true,
    attackerHitChanceDeltaPercent: 0,
    aliases: ['stun', 'actor_stunned'],
};
const KNOCKDOWN = {
    id: 'knockdown',
    labelRu: 'Сбит с ног',
    category: 'control',
    defaultDurationTurns: 1,
    stackMode: 'refresh',
    blocksAction: true,
    blocksMagic: true,
    blocksMovement: true,
    attackerHitChanceDeltaPercent: 0,
    aliases: ['knocked_down', 'actor_knocked_down'],
};
const SILENCED = {
    id: 'silenced',
    labelRu: 'Молчание',
    category: 'control',
    defaultDurationTurns: 2,
    stackMode: 'refresh',
    blocksAction: false,
    blocksMagic: true,
    blocksMovement: false,
    attackerHitChanceDeltaPercent: 0,
    aliases: ['silence', 'actor_silenced'],
};
const FROZEN = {
    id: 'frozen',
    labelRu: 'Заморозка',
    category: 'control',
    defaultDurationTurns: 1,
    stackMode: 'refresh',
    blocksAction: true,
    blocksMagic: false,
    blocksMovement: true,
    attackerHitChanceDeltaPercent: 0,
    aliases: ['freeze'],
};
const BLINDED = {
    id: 'blinded',
    labelRu: 'Ослепление',
    category: 'debuff',
    defaultDurationTurns: 2,
    stackMode: 'refresh',
    blocksAction: false,
    blocksMagic: false,
    blocksMovement: false,
    attackerHitChanceDeltaPercent: -25,
    aliases: ['blind'],
};
const POISONED = {
    id: 'poisoned',
    labelRu: 'Отравление',
    category: 'dot',
    defaultDurationTurns: 3,
    stackMode: 'refresh',
    blocksAction: false,
    blocksMagic: false,
    blocksMovement: false,
    attackerHitChanceDeltaPercent: 0,
    periodicDamage: {
        amountFlat: 3,
        damageCategory: 'poison',
        phase: 'turn_start',
    },
    aliases: ['poison'],
};
const BLEEDING = {
    id: 'bleeding',
    labelRu: 'Кровотечение',
    category: 'dot',
    defaultDurationTurns: 3,
    stackMode: 'refresh',
    blocksAction: false,
    blocksMagic: false,
    blocksMovement: false,
    attackerHitChanceDeltaPercent: 0,
    periodicDamage: {
        amountFlat: 3,
        damageCategory: 'bleed',
        phase: 'turn_end',
    },
    aliases: ['bleed'],
};
const BURNING = {
    id: 'burning',
    labelRu: 'Горение',
    category: 'dot',
    defaultDurationTurns: 2,
    stackMode: 'refresh',
    blocksAction: false,
    blocksMagic: false,
    blocksMovement: false,
    attackerHitChanceDeltaPercent: 0,
    periodicDamage: {
        amountFlat: 3,
        damageCategory: 'elemental',
        elementType: 'fire',
        phase: 'turn_start',
    },
    aliases: ['burn'],
};
const SLOWED = {
    id: 'slowed',
    labelRu: 'Замедление',
    category: 'debuff',
    defaultDurationTurns: 2,
    stackMode: 'refresh',
    blocksAction: false,
    blocksMagic: false,
    blocksMovement: false,
    attackerHitChanceDeltaPercent: 0,
    aliases: ['slow'],
};
const CURSED = {
    id: 'cursed',
    labelRu: 'Проклятие',
    category: 'debuff',
    defaultDurationTurns: 3,
    stackMode: 'refresh',
    blocksAction: false,
    blocksMagic: false,
    blocksMovement: false,
    attackerHitChanceDeltaPercent: 0,
    aliases: ['curse'],
};
exports.COMBAT_STATUS_DEFINITIONS = [
    STUNNED,
    KNOCKDOWN,
    SILENCED,
    FROZEN,
    BLINDED,
    POISONED,
    BLEEDING,
    BURNING,
    SLOWED,
    CURSED,
];
const ALIAS_TO_CANONICAL = (() => {
    const m = new Map();
    for (const def of exports.COMBAT_STATUS_DEFINITIONS) {
        m.set(normalizeStatusKey(def.id), def.id);
        for (const a of def.aliases) {
            m.set(normalizeStatusKey(a), def.id);
        }
    }
    return m;
})();
const DEF_BY_ID = new Map(exports.COMBAT_STATUS_DEFINITIONS.map((d) => [d.id, d]));
function normalizeStatusKey(raw) {
    return raw.trim().toLowerCase();
}
/**
 * Канонический id или исходная строка, если статус не из реестра (кастомный контент).
 */
function canonicalCombatStatusId(statusId) {
    if (!statusId || typeof statusId !== 'string') {
        return null;
    }
    const key = normalizeStatusKey(statusId);
    return ALIAS_TO_CANONICAL.get(key) ?? statusId;
}
function getCombatStatusDefinition(canonicalOrRawId) {
    if (!canonicalOrRawId) {
        return undefined;
    }
    const canon = canonicalCombatStatusId(canonicalOrRawId);
    if (!canon) {
        return undefined;
    }
    return DEF_BY_ID.get(canon);
}
function isRegisteredCombatStatusId(statusId) {
    const canon = canonicalCombatStatusId(statusId);
    return Boolean(canon && DEF_BY_ID.has(canon));
}
/** Для подсказок UI. */
exports.KNOWN_COMBAT_STATUS_IDS = exports.COMBAT_STATUS_DEFINITIONS.map((d) => d.id);
