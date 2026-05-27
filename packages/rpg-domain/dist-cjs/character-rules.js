"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACADEMY_CONFIGS = exports.KINGDOM_BONUS_CONFIG = exports.RACE_RULES = exports.KINGDOM_RELATION_PRESETS = exports.DEFAULT_KINGDOM_REPUTATION = void 0;
exports.isResourceStat = isResourceStat;
exports.scaleResourceStat = scaleResourceStat;
exports.getStartingFreePoints = getStartingFreePoints;
exports.createInitialKingdomReputation = createInitialKingdomReputation;
exports.createInitialCitizenshipState = createInitialCitizenshipState;
exports.applyCitizenshipChange = applyCitizenshipChange;
exports.canRaceUseSkillType = canRaceUseSkillType;
exports.canRaceUseSkillDefinition = canRaceUseSkillDefinition;
exports.getRaceIncomingDamageMultiplier = getRaceIncomingDamageMultiplier;
exports.getRaceOutgoingDamageMultiplier = getRaceOutgoingDamageMultiplier;
exports.getKingdomStartingGoldBonus = getKingdomStartingGoldBonus;
exports.getKingdomBonusHighlights = getKingdomBonusHighlights;
exports.getKingdomMaxStaminaMultiplier = getKingdomMaxStaminaMultiplier;
exports.getSkillMpCostMultiplier = getSkillMpCostMultiplier;
exports.getPhysicalSkillStaminaCostMultiplier = getPhysicalSkillStaminaCostMultiplier;
exports.getMissChanceMultiplier = getMissChanceMultiplier;
exports.canAccessAcademy = canAccessAcademy;
exports.getMerchantPriceModifiers = getMerchantPriceModifiers;
exports.getNpcDispositionBonus = getNpcDispositionBonus;
exports.getCityAccessOutcome = getCityAccessOutcome;
exports.getStartingProfessionIds = getStartingProfessionIds;
exports.getStartingSkillIds = getStartingSkillIds;
exports.isKingdomId = isKingdomId;
const races_1 = require("./races");
const index_1 = require("./skills/index");
const ALL_KINGDOM_IDS = ['luminor', 'artalon', 'kriantar', 'terimia', 'argos'];
exports.DEFAULT_KINGDOM_REPUTATION = {
    luminor: 0,
    artalon: 0,
    kriantar: 0,
    terimia: 0,
    argos: 0,
};
exports.KINGDOM_RELATION_PRESETS = {
    luminor: {
        artalon: 10,
        kriantar: 10,
        terimia: 10,
        argos: 10,
    },
    artalon: {
        kriantar: 50,
        terimia: -40,
        argos: -20,
    },
    kriantar: {
        artalon: 50,
        argos: -10,
    },
    terimia: {
        luminor: -40,
        artalon: -40,
        kriantar: -40,
        argos: -40,
    },
    argos: {
        artalon: -20,
        kriantar: -10,
        terimia: -30,
    },
};
exports.RACE_RULES = {
    [races_1.Race.Human]: {
        race: races_1.Race.Human,
        startingFreePoints: 10,
        allowedSkillTypes: [
            index_1.SkillType.PHYSICAL,
            index_1.SkillType.PASSIVE,
            index_1.SkillType.MAGIC,
            index_1.SkillType.ELEMENTAL_MAGIC,
            index_1.SkillType.NORMAL_MAGIC,
            index_1.SkillType.FORBIDDEN_MAGIC,
            index_1.SkillType.MIXED,
            index_1.SkillType.SHAMANISM,
            index_1.SkillType.RUNE,
        ],
        elementalMpCostMultiplier: 1,
        elementalDamageMultiplier: 1,
        missChanceMultiplier: 1,
        incomingDamageMultipliers: {
            magic: 1,
            elemental: 1,
            runic: 1,
            shamanic: 1,
            physical: 1,
        },
    },
    [races_1.Race.Dwarf]: {
        race: races_1.Race.Dwarf,
        startingFreePoints: 5,
        allowedSkillTypes: [index_1.SkillType.PHYSICAL, index_1.SkillType.PASSIVE, index_1.SkillType.RUNE],
        elementalMpCostMultiplier: 999,
        elementalDamageMultiplier: 1,
        missChanceMultiplier: 1,
        incomingDamageMultipliers: {
            magic: 0.5,
            elemental: 1,
            runic: 1,
            shamanic: 0.5,
            physical: 1,
        },
        blockedMagicSchools: [
            index_1.MagicSchoolType.ELEMENTAL,
            index_1.MagicSchoolType.NORMAL,
            index_1.MagicSchoolType.FORBIDDEN,
            index_1.MagicSchoolType.NECROMANCY,
            index_1.MagicSchoolType.BLOOD,
            index_1.MagicSchoolType.DEATH,
            index_1.MagicSchoolType.ILLUSION,
            index_1.MagicSchoolType.SHADOW,
            'curse',
        ],
        startingProfessionIds: ['mining', 'blacksmithing'],
        startingSkillIds: ['mining_basic_swing', 'blacksmithing_basic_tempering'],
    },
    [races_1.Race.WoodElf]: {
        race: races_1.Race.WoodElf,
        startingFreePoints: 5,
        allowedSkillTypes: [index_1.SkillType.PHYSICAL, index_1.SkillType.PASSIVE, index_1.SkillType.ELEMENTAL_MAGIC],
        elementalMpCostMultiplier: 0.5,
        elementalDamageMultiplier: 1.5,
        missChanceMultiplier: 0.6,
        incomingDamageMultipliers: {
            magic: 1,
            elemental: 1,
            runic: 1,
            shamanic: 1,
            physical: 1,
        },
        allowedMagicSchools: [index_1.MagicSchoolType.ELEMENTAL],
        blockedMagicSchools: [
            index_1.MagicSchoolType.NORMAL,
            index_1.MagicSchoolType.FORBIDDEN,
            index_1.MagicSchoolType.NECROMANCY,
            index_1.MagicSchoolType.BLOOD,
            index_1.MagicSchoolType.DEATH,
            index_1.MagicSchoolType.ILLUSION,
            index_1.MagicSchoolType.SHADOW,
            'curse',
        ],
    },
    [races_1.Race.HighElf]: {
        race: races_1.Race.HighElf,
        startingFreePoints: 5,
        allowedSkillTypes: [index_1.SkillType.PHYSICAL, index_1.SkillType.PASSIVE, index_1.SkillType.ELEMENTAL_MAGIC],
        elementalMpCostMultiplier: 0.5,
        elementalDamageMultiplier: 1.5,
        missChanceMultiplier: 0.6,
        iceDamageMultiplier: 1.5,
        incomingDamageMultipliers: {
            magic: 1,
            elemental: 1,
            runic: 1,
            shamanic: 1,
            physical: 1,
        },
        allowedMagicSchools: [index_1.MagicSchoolType.ELEMENTAL],
        blockedMagicSchools: [
            index_1.MagicSchoolType.NORMAL,
            index_1.MagicSchoolType.FORBIDDEN,
            index_1.MagicSchoolType.NECROMANCY,
            index_1.MagicSchoolType.BLOOD,
            index_1.MagicSchoolType.DEATH,
            index_1.MagicSchoolType.ILLUSION,
            index_1.MagicSchoolType.SHADOW,
            'curse',
        ],
    },
};
exports.KINGDOM_BONUS_CONFIG = {
    luminor: {
        kingdomId: 'luminor',
        label: 'Луминор',
        startingGoldBonus: 80,
        sellPriceMultiplierBonus: 0.15,
        reputationGainMultiplierHumanKingdoms: 1.1,
        dialogueReputationBonus: 5,
    },
    artalon: {
        kingdomId: 'artalon',
        label: 'Арталон',
        ignoreSandMovementPenalty: true,
        physicalSkillStaminaCostMultiplier: 0.9,
        elementalSkillMpCostMultiplier: 0.9,
    },
    kriantar: {
        kingdomId: 'kriantar',
        label: 'Криантар',
        elementalSkillMpCostMultiplier: 0.9,
        mindMagicMpCostMultiplier: 0.9,
        missChanceMultiplier: 0.9,
    },
    terimia: {
        kingdomId: 'terimia',
        label: 'Теримия',
        academyAccessBypass: ['academy_black_rite'],
        necromancySkillAllowedWithoutIntroQuest: true,
        deathMagicMpCostMultiplier: 0.9,
        curseMpCostMultiplier: 0.9,
    },
    argos: {
        kingdomId: 'argos',
        label: 'Аргос',
        physicalDamageMultiplier: 1.1,
        maxStaminaMultiplier: 1.1,
        magicDamageMultiplier: 0.85,
        magicMpCostMultiplier: 1.15,
    },
};
exports.ACADEMY_CONFIGS = {
    academy_four_winds_temple: {
        academyId: 'academy_four_winds_temple',
        name: 'Храм Четырёх Ветров',
        magicTypes: [index_1.SkillType.ELEMENTAL_MAGIC],
        schools: ['elemental'],
        elements: ['fire', 'water', 'earth', 'air', 'light', 'darkness'],
        allowedRaces: [races_1.Race.Human, races_1.Race.WoodElf, races_1.Race.HighElf],
    },
    academy_aurelia_garden: {
        academyId: 'academy_aurelia_garden',
        name: 'Сад Аурелии',
        magicTypes: [index_1.SkillType.NORMAL_MAGIC],
        schools: ['life', 'arcane'],
        subtypes: ['heal', 'blessing', 'aura'],
        allowedRaces: [races_1.Race.Human],
    },
    academy_tower_of_knowledge: {
        academyId: 'academy_tower_of_knowledge',
        name: 'Башня Знания',
        magicTypes: [index_1.SkillType.NORMAL_MAGIC],
        schools: ['mind', 'arcane'],
        subtypes: ['control', 'aura', 'transformation'],
        allowedRaces: [races_1.Race.Human],
    },
    academy_hall_of_shadows: {
        academyId: 'academy_hall_of_shadows',
        name: 'Зал Теней',
        magicTypes: [index_1.SkillType.NORMAL_MAGIC, index_1.SkillType.MIXED],
        schools: ['illusion', 'shadow', 'mind'],
        subtypes: ['illusion', 'control', 'transformation'],
        allowedRaces: [races_1.Race.Human],
    },
    academy_black_rite: {
        academyId: 'academy_black_rite',
        name: 'Чёрный Обряд',
        magicTypes: [index_1.SkillType.FORBIDDEN_MAGIC, index_1.SkillType.NORMAL_MAGIC, index_1.SkillType.MIXED],
        schools: ['death', 'blood', 'necromancy', 'curse', 'forbidden'],
        subtypes: ['curse', 'ritual', 'summon', 'contract'],
        allowedRaces: [races_1.Race.Human],
    },
};
function isResourceStat(stat) {
    return stat === 'hp' || stat === 'mp' || stat === 'stamina';
}
function scaleResourceStat(stat, value) {
    return isResourceStat(stat) ? value * 10 : value;
}
function getStartingFreePoints(race) {
    return exports.RACE_RULES[race].startingFreePoints;
}
function createInitialKingdomReputation(citizenshipKingdomId) {
    const next = { ...exports.DEFAULT_KINGDOM_REPUTATION };
    if (citizenshipKingdomId) {
        const preset = exports.KINGDOM_RELATION_PRESETS[citizenshipKingdomId] ?? {};
        for (const kingdomId of ALL_KINGDOM_IDS) {
            const value = preset[kingdomId];
            if (typeof value === 'number' && Number.isFinite(value)) {
                next[kingdomId] = Math.trunc(value);
            }
        }
        next[citizenshipKingdomId] += 20;
    }
    return next;
}
function createInitialCitizenshipState(citizenshipKingdomId) {
    return {
        citizenshipKingdomId,
        kingdomReputation: createInitialKingdomReputation(citizenshipKingdomId),
    };
}
function applyCitizenshipChange(state, newKingdomId) {
    const current = {
        citizenshipKingdomId: state.citizenshipKingdomId,
        kingdomReputation: { ...exports.DEFAULT_KINGDOM_REPUTATION, ...state.kingdomReputation },
    };
    if (current.citizenshipKingdomId) {
        current.kingdomReputation[current.citizenshipKingdomId] -= 50;
    }
    current.citizenshipKingdomId = newKingdomId;
    current.kingdomReputation[newKingdomId] += 20;
    return current;
}
function normalizeMagicSchool(value) {
    const school = String(value ?? '').trim().toLowerCase();
    return school.length > 0 ? school : null;
}
function canRaceUseSkillType(race, skillType) {
    return exports.RACE_RULES[race].allowedSkillTypes.includes(skillType);
}
function canRaceUseSkillDefinition(race, skill) {
    if (!canRaceUseSkillType(race, skill.type)) {
        return false;
    }
    const rules = exports.RACE_RULES[race];
    const blockedSchools = new Set((rules.blockedMagicSchools ?? []).map((entry) => String(entry).toLowerCase()));
    const allowedSchools = rules.allowedMagicSchools
        ? new Set(rules.allowedMagicSchools.map((entry) => String(entry).toLowerCase()))
        : null;
    const candidateSchools = new Set();
    for (const school of skill.requirements?.requiredMagicSchools ?? []) {
        const normalized = normalizeMagicSchool(school);
        if (normalized) {
            candidateSchools.add(normalized);
        }
    }
    for (const component of skill.damage ?? []) {
        const normalized = normalizeMagicSchool(component.magicSchool);
        if (normalized) {
            candidateSchools.add(normalized);
        }
    }
    for (const tag of skill.tags ?? []) {
        const normalized = normalizeMagicSchool(tag);
        if (normalized) {
            candidateSchools.add(normalized);
        }
    }
    for (const school of candidateSchools) {
        if (blockedSchools.has(school)) {
            return false;
        }
    }
    if (allowedSchools && candidateSchools.size > 0) {
        for (const school of candidateSchools) {
            if (!allowedSchools.has(school) && school !== 'ice') {
                return false;
            }
        }
    }
    return true;
}
function getRaceIncomingDamageMultiplier(race, category) {
    return exports.RACE_RULES[race].incomingDamageMultipliers[category] ?? 1;
}
function getRaceOutgoingDamageMultiplier(params) {
    const rules = exports.RACE_RULES[params.race];
    let multiplier = 1;
    if (params.category === 'elemental') {
        multiplier *= rules.elementalDamageMultiplier;
    }
    const tags = new Set((params.tags ?? []).map((entry) => String(entry).toLowerCase()));
    const isIce = params.elementType === 'ice' || (params.elementType === 'water' && tags.has('ice')) || tags.has('ice');
    if (params.race === races_1.Race.HighElf && params.category === 'elemental' && isIce) {
        multiplier *= rules.iceDamageMultiplier ?? 1;
    }
    return multiplier;
}
function getKingdomStartingGoldBonus(kingdomId) {
    if (!kingdomId) {
        return 0;
    }
    return exports.KINGDOM_BONUS_CONFIG[kingdomId].startingGoldBonus ?? 0;
}
function getKingdomBonusHighlights(kingdomId) {
    switch (kingdomId) {
        case 'luminor':
            return [
                '+500 стартового золота',
                '+15% к цене продажи торговцам',
                '+10% к положительной репутации с человеческими королевствами',
                '+5 к репутации из диалоговых решений',
            ];
        case 'artalon':
            return [
                'Игнорирует штрафы песка',
                '-10% затрат stamina на физические навыки',
                '-10% затрат MP на стихийные навыки',
            ];
        case 'kriantar':
            return [
                '-10% затрат MP на магию разума',
                '-10% затрат MP на стихийную магию',
                '-10% к шансу промаха',
            ];
        case 'terimia':
            return [
                'Доступ в Чёрный Обряд без вступительного квеста',
                '-10% затрат MP на магию смерти',
                '-10% затрат MP на проклятия',
            ];
        case 'argos':
            return [
                '+10% физического урона',
                '+10% к максимуму stamina',
                '-15% к силе магии',
                '+15% к затратам MP на магию',
            ];
        default:
            return [];
    }
}
function getKingdomMaxStaminaMultiplier(kingdomId) {
    if (!kingdomId) {
        return 1;
    }
    return exports.KINGDOM_BONUS_CONFIG[kingdomId].maxStaminaMultiplier ?? 1;
}
function getSkillMpCostMultiplier(params) {
    const raceRules = exports.RACE_RULES[params.race];
    let multiplier = 1;
    if (params.skillType === index_1.SkillType.ELEMENTAL_MAGIC) {
        multiplier *= raceRules.elementalMpCostMultiplier;
        if (params.kingdomId) {
            multiplier *= exports.KINGDOM_BONUS_CONFIG[params.kingdomId].elementalSkillMpCostMultiplier ?? 1;
        }
    }
    if (params.skillType === index_1.SkillType.MAGIC
        || params.skillType === index_1.SkillType.NORMAL_MAGIC
        || params.skillType === index_1.SkillType.FORBIDDEN_MAGIC
        || params.skillType === index_1.SkillType.MIXED) {
        if (params.kingdomId) {
            multiplier *= exports.KINGDOM_BONUS_CONFIG[params.kingdomId].magicMpCostMultiplier ?? 1;
        }
    }
    const schools = new Set((params.schools ?? []).map((entry) => String(entry).toLowerCase()));
    if (params.kingdomId === 'terimia') {
        if (schools.has('death') || schools.has('necromancy')) {
            multiplier *= exports.KINGDOM_BONUS_CONFIG.terimia.deathMagicMpCostMultiplier ?? 1;
        }
        if (schools.has('curse')) {
            multiplier *= exports.KINGDOM_BONUS_CONFIG.terimia.curseMpCostMultiplier ?? 1;
        }
    }
    if (params.kingdomId === 'kriantar' && schools.has('mind')) {
        multiplier *= exports.KINGDOM_BONUS_CONFIG.kriantar.mindMagicMpCostMultiplier ?? 1;
    }
    return multiplier;
}
function getPhysicalSkillStaminaCostMultiplier(kingdomId) {
    if (!kingdomId) {
        return 1;
    }
    return exports.KINGDOM_BONUS_CONFIG[kingdomId].physicalSkillStaminaCostMultiplier ?? 1;
}
function getMissChanceMultiplier(race, kingdomId) {
    let multiplier = exports.RACE_RULES[race].missChanceMultiplier;
    if (kingdomId) {
        multiplier *= exports.KINGDOM_BONUS_CONFIG[kingdomId].missChanceMultiplier ?? 1;
    }
    return multiplier;
}
function canAccessAcademy(params) {
    const academy = exports.ACADEMY_CONFIGS[params.academyId];
    if (!academy.allowedRaces.includes(params.race)) {
        return { allowed: false, bypassIntroQuest: false };
    }
    const bypassIntroQuest = Boolean(params.citizenshipKingdomId
        && exports.KINGDOM_BONUS_CONFIG[params.citizenshipKingdomId].academyAccessBypass?.includes(params.academyId));
    return { allowed: true, bypassIntroQuest };
}
function getMerchantPriceModifiers(params) {
    const rep = params.kingdomReputation;
    if (rep <= -90) {
        return { buyMultiplier: 1, sellMultiplier: 1, tradeBlocked: true };
    }
    let buyMultiplier = 1;
    let sellMultiplier = 1;
    if (rep >= 80) {
        buyMultiplier = 0.8;
        sellMultiplier = 1.2;
    }
    else if (rep >= 50) {
        buyMultiplier = 0.9;
        sellMultiplier = 1.1;
    }
    else if (rep >= 20) {
        buyMultiplier = 0.95;
        sellMultiplier = 1.05;
    }
    else if (rep <= -50) {
        buyMultiplier = 1.25;
        sellMultiplier = 0.75;
    }
    else if (rep <= -20) {
        buyMultiplier = 1.1;
        sellMultiplier = 0.9;
    }
    if (params.playerKingdomId === 'luminor') {
        sellMultiplier *= 1 + (exports.KINGDOM_BONUS_CONFIG.luminor.sellPriceMultiplierBonus ?? 0);
    }
    return {
        buyMultiplier: Math.min(2, Math.max(0.5, buyMultiplier)),
        sellMultiplier: Math.min(2, Math.max(0.25, sellMultiplier)),
        tradeBlocked: false,
    };
}
function getNpcDispositionBonus(kingdomReputation) {
    return kingdomReputation;
}
function getCityAccessOutcome(kingdomReputation) {
    if (kingdomReputation <= -90) {
        return {
            allowed: false,
            hostile: true,
            message: 'Вас не впускают. Ваша репутация слишком низкая.',
        };
    }
    if (kingdomReputation >= 50) {
        return {
            allowed: true,
            hostile: false,
            message: 'Стража приветствует вас как союзника государства.',
        };
    }
    return {
        allowed: true,
        hostile: false,
        message: null,
    };
}
function getStartingProfessionIds(race) {
    return [...(exports.RACE_RULES[race].startingProfessionIds ?? [])];
}
function getStartingSkillIds(race) {
    return [...(exports.RACE_RULES[race].startingSkillIds ?? [])];
}
function isKingdomId(value) {
    return ALL_KINGDOM_IDS.includes(value);
}
