"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ELEMENTAL_COMBOS = exports.ELEMENT_STATUS_MAP = exports.ELEMENT_TYPES = exports.DAMAGE_CATEGORIES = void 0;
exports.getElementCounterMultiplier = getElementCounterMultiplier;
exports.getElementMultiplier = getElementMultiplier;
exports.applyElementEffect = applyElementEffect;
exports.checkElementCombo = checkElementCombo;
exports.calculateFinalDamage = calculateFinalDamage;
exports.isEffectBlockedByRace = isEffectBlockedByRace;
exports.DAMAGE_CATEGORIES = [
    'physical',
    'elemental',
    'magic',
    'shamanic',
    'runic',
    'bleed',
    'poison',
    'true',
];
exports.ELEMENT_TYPES = ['fire', 'water', 'earth', 'air', 'light', 'dark'];
const SIMPLE_ELEMENT_STATUS_MAP = {
    fire: {
        elementType: 'fire',
        statusEffectId: 'burning',
        description: 'Applies burning damage over time.',
    },
    water: {
        elementType: 'water',
        statusEffectId: 'wet',
        description: 'Applies wet, increasing incoming air damage and reducing fire impact.',
    },
    earth: {
        elementType: 'earth',
        statusEffectId: 'slow',
        description: 'Applies slow/petrify-like movement reduction.',
    },
    air: {
        elementType: 'air',
        statusEffectId: 'rupture',
        description: 'Applies rupture, making the target more vulnerable to crit pressure.',
    },
    light: {
        elementType: 'light',
        statusEffectId: 'cleanse',
        description: 'Applies cleanse/protective purification.',
    },
    dark: {
        elementType: 'dark',
        statusEffectId: 'corruption',
        description: 'Applies corruption, reducing healing efficiency.',
    },
};
exports.ELEMENT_STATUS_MAP = {
    fire: {
        id: 'burning',
        element: 'fire',
        description: 'Damage over time from fire ignition.',
    },
    water: {
        id: 'wet',
        element: 'water',
        description: 'Increases incoming air damage and slightly reduces fire damage taken.',
    },
    earth: {
        id: 'petrified_or_slowed',
        element: 'earth',
        description: 'Reduces initiative and may cause short stun.',
    },
    air: {
        id: 'rupture',
        element: 'air',
        description: 'Target becomes vulnerable to critical strikes.',
    },
    light: {
        id: 'cleanse_or_blessed',
        element: 'light',
        description: 'Removes negative effects or grants minor protection.',
    },
    dark: {
        id: 'corruption',
        element: 'dark',
        description: 'Reduces healing received and weakens magic resistance.',
    },
};
const STRONG_ELEMENT_RELATIONS = {
    fire: ['earth', 'dark'],
    water: ['fire'],
    earth: ['air'],
    air: ['water'],
    light: ['dark'],
    dark: ['light'],
};
const WEAK_ELEMENT_RELATIONS = {
    fire: ['water'],
    water: ['air'],
    earth: ['fire'],
    air: ['earth'],
};
function getElementCounterMultiplier(attacking, defending) {
    if (!defending) {
        return 1;
    }
    if (STRONG_ELEMENT_RELATIONS[attacking]?.includes(defending)) {
        return 1.25;
    }
    if (WEAK_ELEMENT_RELATIONS[attacking]?.includes(defending)) {
        return 0.75;
    }
    return 1;
}
function getElementMultiplier(attackerElement, defenderElement) {
    if (!attackerElement || !defenderElement) {
        return 1;
    }
    return getElementCounterMultiplier(attackerElement, defenderElement);
}
exports.ELEMENTAL_COMBOS = [
    { id: 'storm', requiredElements: ['water', 'air'], resultEffect: 'storm', description: 'Charged storm field', damageMultiplier: 1.2, statusEffect: 'wet' },
    { id: 'firestorm', requiredElements: ['fire', 'air'], resultEffect: 'firestorm', description: 'Spreading blazing winds', damageMultiplier: 1.3, statusEffect: 'burning' },
    { id: 'mud', requiredElements: ['water', 'earth'], resultEffect: 'mud', description: 'Heavy mud, slowing movement', statusEffect: 'petrified_or_slowed' },
    { id: 'lava', requiredElements: ['fire', 'earth'], resultEffect: 'lava', description: 'Melting eruption zone', damageMultiplier: 1.35, statusEffect: 'burning' },
    { id: 'healing_wave', requiredElements: ['light', 'water'], resultEffect: 'healing_wave', description: 'Purifying recovery pulse', statusEffect: 'cleanse_or_blessed' },
    { id: 'poison', requiredElements: ['dark', 'water'], resultEffect: 'poison', description: 'Toxic wave application', statusEffect: 'poison' },
    { id: 'solar_burst', requiredElements: ['light', 'fire'], resultEffect: 'solar_burst', description: 'Focused holy flare', damageMultiplier: 1.25, statusEffect: 'cleanse_or_blessed' },
    { id: 'cursed_flame', requiredElements: ['dark', 'fire'], resultEffect: 'cursed_flame', description: 'Flame that corrupts', damageMultiplier: 1.25, statusEffect: 'corruption' },
    { id: 'sacred_bastion', requiredElements: ['light', 'earth'], resultEffect: 'sacred_bastion', description: 'Protective sacred wall', statusEffect: 'cleanse_or_blessed' },
    { id: 'necrosis', requiredElements: ['dark', 'earth'], resultEffect: 'necrosis', description: 'Necrotic decay field', statusEffect: 'corruption' },
    { id: 'blessing_wind', requiredElements: ['light', 'air'], resultEffect: 'blessing_wind', description: 'Blessed air current', statusEffect: 'cleanse_or_blessed' },
    { id: 'illusions', requiredElements: ['dark', 'air'], resultEffect: 'illusions', description: 'Vision-distorting mirage', statusEffect: 'rupture' },
];
const CORE_ELEMENTAL_COMBO_IDS = new Set(['storm', 'lava', 'solar_burst', 'cursed_flame']);
function applyElementEffect(target, elementType) {
    const effect = SIMPLE_ELEMENT_STATUS_MAP[elementType];
    const nextActiveEffects = [...(target.activeEffects ?? [])];
    if (!nextActiveEffects.includes(effect.statusEffectId)) {
        nextActiveEffects.push(effect.statusEffectId);
    }
    return {
        effect,
        nextActiveEffects,
    };
}
function checkElementCombo(previousElement, newElement) {
    if (!previousElement || !newElement || previousElement === newElement) {
        return null;
    }
    const combo = exports.ELEMENTAL_COMBOS.find((entry) => {
        if (!CORE_ELEMENTAL_COMBO_IDS.has(entry.id)) {
            return false;
        }
        const [a, b] = entry.requiredElements;
        return (a === previousElement && b === newElement)
            || (a === newElement && b === previousElement);
    });
    return combo ?? null;
}
function getArmorMitigation(defender, context, halfArmor = false) {
    const armor = context.armor ?? 0;
    const effectiveArmor = halfArmor ? armor * 0.5 : armor;
    const constitutionMitigation = defender.stats.constitution * 0.6;
    const physicalResistance = context.physicalResistance ?? 0;
    return effectiveArmor + constitutionMitigation + physicalResistance;
}
function getMagicMitigation(defender, context) {
    return defender.stats.willpower * 0.7 + (context.magicResistance ?? 0);
}
function calculateFinalDamage(input) {
    const context = input.context ?? {};
    const payload = input.damagePayload;
    const baseAmount = Math.max(0, payload.amount);
    let amount = baseAmount;
    let multiplier = payload.canCrit ? (context.criticalMultiplier ?? 1) : 1;
    if (payload.category === 'elemental' && payload.elementType) {
        multiplier *= getElementMultiplier(payload.elementType, context.targetElementState);
    }
    amount = Math.max(0, amount * multiplier);
    if (payload.category === 'magic') {
        amount *= input.defender.raceModifiers?.magicDamageTakenMultiplier ?? 1;
    }
    if (payload.category === 'elemental') {
        amount *= input.defender.raceModifiers?.elementDamageTakenMultiplier ?? 1;
    }
    let mitigation = 0;
    if (!payload.ignoresArmor && payload.category === 'physical') {
        mitigation += getArmorMitigation(input.defender, context);
    }
    if (!payload.ignoresResistance) {
        if (payload.category === 'magic') {
            mitigation += getMagicMitigation(input.defender, context);
        }
        else if (payload.category === 'elemental') {
            const elementResistance = payload.elementType ? (context.elementalResistance?.[payload.elementType] ?? 0) : 0;
            mitigation += elementResistance + input.defender.stats.willpower * 0.25;
        }
        else if (payload.category === 'shamanic') {
            mitigation += input.defender.stats.willpower * 0.8;
            if (!payload.ignoresArmor) {
                mitigation += (context.armor ?? 0) * 0.4;
            }
        }
        else if (payload.category === 'runic') {
            if (payload.runicType === 'empowered_physical') {
                mitigation += getArmorMitigation(input.defender, context, true);
            }
            else if (payload.runicType === 'spiritual' || payload.runicType === 'binding') {
                mitigation += input.defender.stats.willpower * 0.8;
            }
            else {
                mitigation += input.defender.stats.willpower * 0.5;
            }
        }
        else if (payload.category === 'bleed' || payload.category === 'poison') {
            mitigation += input.defender.stats.constitution * 0.2;
        }
    }
    if (payload.category === 'true') {
        mitigation = 0;
    }
    if (payload.category === 'runic' && payload.runicType === 'binding') {
        amount *= 0.6;
    }
    const finalDamage = Math.max(0, Math.round(Math.max(0, amount - mitigation)));
    return {
        finalDamage,
        preventedDamage: Math.max(0, Math.round(baseAmount - finalDamage)),
        multiplier,
        ignoredArmor: payload.ignoresArmor === true || payload.category === 'true',
        ignoredResistance: payload.ignoresResistance === true || payload.category === 'true',
    };
}
function isEffectBlockedByRace(defender, effect, sourceCategory) {
    if (sourceCategory !== 'magic') {
        return false;
    }
    const modifiers = defender.raceModifiers;
    if (!modifiers) {
        return false;
    }
    if (effect === 'curse') {
        return modifiers.immuneToMagicalCurses === true;
    }
    if (effect === 'silence') {
        return modifiers.immuneToMagicalSilence === true;
    }
    if (effect === 'stun') {
        return modifiers.immuneToMagicalStun === true;
    }
    return modifiers.immuneToMagicalBlind === true;
}
