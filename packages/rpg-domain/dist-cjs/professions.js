"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROFESSION_DEFINITIONS = exports.EMPTY_PLAYER_PROFESSIONS_STATE = void 0;
exports.getProfessionDefinition = getProfessionDefinition;
exports.normalizePlayerProfessionsState = normalizePlayerProfessionsState;
exports.getPlayerProfession = getPlayerProfession;
exports.hasProfession = hasProfession;
exports.unlockProfession = unlockProfession;
exports.addProfessionXp = addProfessionXp;
exports.EMPTY_PLAYER_PROFESSIONS_STATE = {
    professions: [],
};
exports.PROFESSION_DEFINITIONS = [
    {
        id: 'mining',
        name: 'Горняк',
        description: 'Добыча руды и минералов в опасных местах мира.',
        category: 'gathering',
        maxLevel: 100,
        isEnabled: true,
    },
    {
        id: 'blacksmithing',
        name: 'Кузнец',
        description: 'Создание и улучшение металлического оружия и брони.',
        category: 'crafting',
        maxLevel: 100,
        isEnabled: true,
    },
    {
        id: 'carpentry',
        name: 'Плотник',
        description: 'Работа с древесиной, инструментами и конструкциями.',
        category: 'crafting',
        maxLevel: 100,
        isEnabled: true,
    },
    {
        id: 'leatherworking',
        name: 'Кожевник',
        description: 'Выделка кожи и изготовление снаряжения из шкур.',
        category: 'crafting',
        maxLevel: 100,
        isEnabled: true,
    },
    {
        id: 'jewelcrafting',
        name: 'Ювелир',
        description: 'Огранка камней и создание украшений с эффектами.',
        category: 'crafting',
        maxLevel: 100,
        isEnabled: true,
    },
    {
        id: 'runecrafting',
        name: 'Рунорез',
        description: 'Создание рун и нанесение магических символов.',
        category: 'crafting',
        maxLevel: 100,
        isEnabled: true,
    },
    {
        id: 'fishing',
        name: 'Рыбак',
        description: 'Ловля рыбы и водных ресурсов для ремесла и пищи.',
        category: 'gathering',
        maxLevel: 100,
        isEnabled: true,
    },
    {
        id: 'cooking',
        name: 'Повар',
        description: 'Приготовление еды и полезных рационов для приключений.',
        category: 'survival',
        maxLevel: 100,
        isEnabled: true,
    },
    {
        id: 'hunting',
        name: 'Охотник',
        description: 'Добыча трофеев и редких материалов с диких существ.',
        category: 'gathering',
        maxLevel: 100,
        isEnabled: true,
    },
    {
        id: 'alchemy',
        name: 'Алхимик',
        description: 'Создание зелий и составов из редких ингредиентов.',
        category: 'alchemy',
        maxLevel: 100,
        isEnabled: true,
    },
    {
        id: 'herbalism',
        name: 'Травник',
        description: 'Сбор трав, корений и природных реагентов.',
        category: 'gathering',
        maxLevel: 100,
        isEnabled: true,
    },
];
const PROFESSION_BY_ID = new Map(exports.PROFESSION_DEFINITIONS.map((entry) => [entry.id, entry]));
function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const unique = new Set();
    for (const entry of value) {
        const normalized = String(entry ?? '').trim();
        if (normalized) {
            unique.add(normalized);
        }
    }
    return Array.from(unique);
}
function normalizeStats(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) {
            out[key] = numeric;
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
function createDefaultProfessionState(professionId, unlockedAt = new Date().toISOString()) {
    return {
        professionId,
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        skillPoints: 0,
        learnedSkillIds: [],
        selectedBranchIds: [],
        unlockedAt,
    };
}
function getProfessionDefinition(professionId) {
    return PROFESSION_BY_ID.get(professionId) ?? null;
}
function normalizePlayerProfessionsState(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return exports.EMPTY_PLAYER_PROFESSIONS_STATE;
    }
    const source = raw;
    if (!Array.isArray(source.professions)) {
        return exports.EMPTY_PLAYER_PROFESSIONS_STATE;
    }
    const normalized = [];
    for (const entry of source.professions) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            continue;
        }
        const row = entry;
        const professionId = row.professionId;
        if (professionId !== 'mining'
            && professionId !== 'blacksmithing'
            && professionId !== 'carpentry'
            && professionId !== 'leatherworking'
            && professionId !== 'jewelcrafting'
            && professionId !== 'runecrafting'
            && professionId !== 'fishing'
            && professionId !== 'cooking'
            && professionId !== 'hunting'
            && professionId !== 'alchemy'
            && professionId !== 'herbalism') {
            continue;
        }
        const level = Math.max(1, Math.floor(Number(row.level ?? 1)));
        const xp = Math.max(0, Math.floor(Number(row.xp ?? 0)));
        const xpToNextLevel = Math.max(1, Math.floor(Number(row.xpToNextLevel ?? level * 100)));
        const skillPoints = Math.max(0, Math.floor(Number(row.skillPoints ?? 0)));
        const unlockedAt = typeof row.unlockedAt === 'string' && row.unlockedAt.trim().length > 0
            ? row.unlockedAt
            : new Date().toISOString();
        const stats = normalizeStats(row.stats);
        const normalizedEntry = {
            professionId,
            level,
            xp,
            xpToNextLevel,
            skillPoints,
            learnedSkillIds: normalizeStringArray(row.learnedSkillIds),
            selectedBranchIds: normalizeStringArray(row.selectedBranchIds),
            unlockedAt,
            ...(stats ? { stats } : {}),
        };
        normalized.push(normalizedEntry);
    }
    return {
        professions: normalized,
    };
}
function getPlayerProfession(playerProfessions, professionId) {
    return playerProfessions.professions.find((entry) => entry.professionId === professionId) ?? null;
}
function hasProfession(playerProfessions, professionId) {
    return Boolean(getPlayerProfession(playerProfessions, professionId));
}
function unlockProfession(playerProfessions, professionId) {
    if (hasProfession(playerProfessions, professionId)) {
        return playerProfessions;
    }
    return {
        professions: [...playerProfessions.professions, createDefaultProfessionState(professionId)],
    };
}
function addProfessionXp(playerProfessions, professionId, amount) {
    const normalizedAmount = Math.floor(Number(amount));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        return playerProfessions;
    }
    const index = playerProfessions.professions.findIndex((entry) => entry.professionId === professionId);
    if (index < 0) {
        return playerProfessions;
    }
    const current = playerProfessions.professions[index];
    const definition = getProfessionDefinition(professionId);
    const maxLevel = Math.max(1, definition?.maxLevel ?? 100);
    let level = Math.max(1, current.level);
    let xp = Math.max(0, current.xp) + normalizedAmount;
    let xpToNextLevel = Math.max(1, current.xpToNextLevel || level * 100);
    let skillPoints = Math.max(0, current.skillPoints);
    while (level < maxLevel && xp >= xpToNextLevel) {
        xp -= xpToNextLevel;
        level += 1;
        skillPoints += 1;
        xpToNextLevel = Math.max(1, level * 100);
    }
    if (level >= maxLevel) {
        level = maxLevel;
        xpToNextLevel = Math.max(1, maxLevel * 100);
        xp = Math.min(xp, xpToNextLevel - 1);
    }
    const updated = {
        ...current,
        level,
        xp,
        xpToNextLevel,
        skillPoints,
    };
    return {
        professions: playerProfessions.professions.map((entry, entryIndex) => (entryIndex === index ? updated : entry)),
    };
}
