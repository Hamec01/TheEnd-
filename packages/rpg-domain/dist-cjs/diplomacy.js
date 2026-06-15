"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDiplomaticActorId = normalizeDiplomaticActorId;
exports.resolveActorIdentity = resolveActorIdentity;
exports.inferRelationStance = inferRelationStance;
exports.normalizeRelationValue = normalizeRelationValue;
exports.canActorUseSkillByCombatPolicy = canActorUseSkillByCombatPolicy;
exports.resolveCombatRelation = resolveCombatRelation;
function normalizeDiplomaticActorId(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) {
        return '';
    }
    const aliases = {
        'аргос': 'argos',
        argos: 'argos',
        'арталон': 'artalon',
        artalon: 'artalon',
        'луминор': 'luminor',
        luminor: 'luminor',
        'теримия': 'terimia',
        terimia: 'terimia',
    };
    return aliases[normalized] ?? normalized;
}
function readString(input, keys) {
    for (const key of keys) {
        const value = input[key];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }
    return undefined;
}
function readStringArray(input, keys) {
    const values = [];
    for (const key of keys) {
        const raw = input[key];
        if (!Array.isArray(raw)) {
            continue;
        }
        for (const item of raw) {
            if (typeof item === 'string' && item.trim()) {
                values.push(item);
            }
        }
    }
    return values;
}
function appendRef(refs, actorType, actorId) {
    const normalizedId = normalizeDiplomaticActorId(actorId);
    if (!normalizedId) {
        return;
    }
    if (!refs.some((ref) => ref.actorType === actorType && ref.actorId === normalizedId)) {
        refs.push({ actorType, actorId: normalizedId });
    }
}
function resolveActorIdentity(actor) {
    const actorId = readString(actor, ['actorId', 'id', 'npcId', 'characterId']) ?? 'unknown_actor';
    const kingdomId = normalizeDiplomaticActorId(readString(actor, ['citizenshipKingdomId', 'kingdomId', 'kingdom']));
    const factionId = normalizeDiplomaticActorId(readString(actor, ['factionId', 'primaryFactionId']));
    const factionIds = [
        ...new Set([
            ...(factionId ? [factionId] : []),
            ...readStringArray(actor, ['factionIds', 'factions']).map((value) => normalizeDiplomaticActorId(value)).filter(Boolean),
        ]),
    ];
    const raceId = normalizeDiplomaticActorId(readString(actor, ['raceId', 'race']));
    const clanId = normalizeDiplomaticActorId(readString(actor, ['clanId']));
    const guildId = normalizeDiplomaticActorId(readString(actor, ['guildId']));
    const groupId = normalizeDiplomaticActorId(readString(actor, ['groupId', 'monsterGroupId', 'animalGroupId', 'banditGroupId']));
    const refs = [];
    for (const rawRef of Array.isArray(actor.diplomaticActorIds) ? actor.diplomaticActorIds : []) {
        if (!rawRef || typeof rawRef !== 'object') {
            continue;
        }
        const ref = rawRef;
        if (ref.actorType && ref.actorId) {
            appendRef(refs, ref.actorType, ref.actorId);
        }
    }
    for (const id of factionIds) {
        appendRef(refs, 'faction', id);
    }
    appendRef(refs, 'kingdom', kingdomId);
    appendRef(refs, 'clan', clanId);
    appendRef(refs, 'guild', guildId);
    appendRef(refs, 'custom', groupId);
    appendRef(refs, 'race', raceId);
    return {
        actorId,
        kingdomId: kingdomId || undefined,
        factionId: factionId || undefined,
        factionIds,
        raceId: raceId || undefined,
        clanId: clanId || undefined,
        guildId: guildId || undefined,
        groupId: groupId || undefined,
        diplomaticActorIds: refs,
        isPlayer: actor.isPlayer === true || actor.actorType === 'player',
        isNpc: actor.isNpc === true || actor.actorType === 'npc',
        isMonster: actor.isMonster === true || actor.actorType === 'monster',
        isAnimal: actor.isAnimal === true || actor.actorType === 'animal',
        isBandit: actor.isBandit === true || actor.actorType === 'bandit',
    };
}
function inferRelationStance(value) {
    if (value <= -75) {
        return 'war';
    }
    if (value <= -30) {
        return 'hostile';
    }
    if (value >= 75) {
        return 'ally';
    }
    if (value >= 30) {
        return 'friendly';
    }
    return 'neutral';
}
function normalizeRelationValue(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(-100, Math.min(100, Math.round(value)));
}
function isMagicTaggedSkill(skill) {
    const tokens = [
        skill.type,
        skill.category,
        ...(skill.tags ?? []),
    ].map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean);
    return tokens.some((token) => ['magic', 'elemental', 'necromancy', 'dark_magic', 'arcane', 'fire', 'water', 'earth', 'air', 'light', 'dark'].includes(token));
}
function canActorUseSkillByCombatPolicy(identity, diplomaticActors, skill) {
    const skillTags = new Set([
        String(skill.type ?? '').trim().toLowerCase(),
        String(skill.category ?? '').trim().toLowerCase(),
        ...(skill.tags ?? []).map((tag) => tag.trim().toLowerCase()),
    ].filter(Boolean));
    for (const ref of identity.diplomaticActorIds) {
        const actor = diplomaticActors.find((entry) => entry.actorType === ref.actorType && normalizeDiplomaticActorId(entry.id) === ref.actorId);
        const policy = actor?.combatPolicy;
        if (!policy) {
            continue;
        }
        if (policy.forbiddenSkillTags?.some((tag) => skillTags.has(tag.trim().toLowerCase()))) {
            return false;
        }
        if (policy.magicPolicy === 'forbidden' && isMagicTaggedSkill(skill)) {
            return false;
        }
        if (policy.allowedSkillTags && policy.allowedSkillTags.length > 0) {
            return policy.allowedSkillTags.some((tag) => skillTags.has(tag.trim().toLowerCase()));
        }
    }
    return true;
}
function buildResolvedRelation(value, source, options = {}) {
    const normalizedValue = normalizeRelationValue(value);
    const stance = options.stance ?? inferRelationStance(normalizedValue);
    const attackOnSight = options.attackOnSight ?? normalizedValue <= -75;
    const assistInCombat = options.assistInCombat ?? normalizedValue >= 75;
    return {
        value: normalizedValue,
        stance,
        isHostile: normalizedValue <= -30 || attackOnSight,
        isAlly: normalizedValue >= 75 || assistInCombat,
        isNeutral: normalizedValue > -30 && normalizedValue < 30 && !attackOnSight && !assistInCombat,
        attackOnSight,
        assistInCombat,
        source,
        matchedRelationId: options.matchedRelationId,
    };
}
function relationSourceForType(actorType) {
    if (actorType === 'faction') {
        return 'faction';
    }
    if (actorType === 'kingdom') {
        return 'kingdom';
    }
    if (actorType === 'race') {
        return 'race';
    }
    return 'group';
}
function findRelation(relations, a, b) {
    return relations.find((relation) => {
        const sourceId = normalizeDiplomaticActorId(relation.sourceActorId);
        const targetId = normalizeDiplomaticActorId(relation.targetActorId);
        const exact = relation.sourceActorType === a.actorType
            && sourceId === a.actorId
            && relation.targetActorType === b.actorType
            && targetId === b.actorId;
        if (exact) {
            return true;
        }
        return relation.isMutual === true
            && relation.sourceActorType === b.actorType
            && sourceId === b.actorId
            && relation.targetActorType === a.actorType
            && targetId === a.actorId;
    });
}
function refsByPriority(identity, priority) {
    return identity.diplomaticActorIds.filter((ref) => priority.includes(ref.actorType));
}
function resolveCombatRelation(actorA, actorB, globalRelations, localOverrides = []) {
    const priorityGroups = [
        ['faction'],
        ['kingdom'],
        ['clan', 'guild', 'cult', 'bandit_group', 'monster_group', 'animal_group', 'undead_group', 'custom'],
        ['race'],
    ];
    const allRefsA = actorA.diplomaticActorIds;
    const allRefsB = actorB.diplomaticActorIds;
    for (const refA of allRefsA) {
        for (const refB of allRefsB) {
            const override = findRelation(localOverrides, refA, refB);
            if (override) {
                return buildResolvedRelation(override.value, 'battle_override', {
                    stance: override.stance,
                    attackOnSight: override.attackOnSight,
                    assistInCombat: override.assistInCombat,
                    matchedRelationId: override.id,
                });
            }
        }
    }
    for (const group of priorityGroups) {
        const refsA = refsByPriority(actorA, group);
        const refsB = refsByPriority(actorB, group);
        for (const refA of refsA) {
            for (const refB of refsB) {
                const relation = findRelation(globalRelations, refA, refB);
                if (relation) {
                    return buildResolvedRelation(relation.value, relationSourceForType(refA.actorType), {
                        stance: relation.stance,
                        attackOnSight: relation.attackOnSight,
                        assistInCombat: relation.assistInCombat,
                        matchedRelationId: relation.id,
                    });
                }
            }
        }
    }
    return buildResolvedRelation(0, 'default');
}
