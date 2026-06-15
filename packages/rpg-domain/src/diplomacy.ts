export type DiplomaticActorType =
	| 'kingdom'
	| 'faction'
	| 'race'
	| 'clan'
	| 'guild'
	| 'bandit_group'
	| 'monster_group'
	| 'animal_group'
	| 'undead_group'
	| 'cult'
	| 'custom';

export type RelationStance =
	| 'war'
	| 'hostile'
	| 'unfriendly'
	| 'neutral'
	| 'friendly'
	| 'ally';

export type MagicPolicy = 'allowed' | 'forbidden' | 'restricted' | 'unknown';

export interface CombatPolicy {
	magicPolicy?: MagicPolicy;
	allowedSkillTags?: string[];
	forbiddenSkillTags?: string[];
}

export interface DiplomaticActorDefinition {
	id: string;
	actorType: DiplomaticActorType;
	name: string;
	description?: string;
	linkedContentType?: 'kingdom' | 'race' | 'faction' | 'npc_faction' | 'custom';
	linkedContentId?: string;
	sourceContentId?: string;
	aliases?: string[];
	combatPolicy?: CombatPolicy;
	notes?: string;
	createdAt: string;
	updatedAt: string;
}

export interface GlobalRelation {
	id: string;
	sourceActorType: DiplomaticActorType;
	sourceActorId: string;
	targetActorType: DiplomaticActorType;
	targetActorId: string;
	value: number;
	stance?: RelationStance;
	isMutual?: boolean;
	attackOnSight?: boolean;
	assistInCombat?: boolean;
	allowTrade?: boolean;
	allowDialogue?: boolean;
	crimeOnAttack?: boolean;
	crimeFactionId?: string;
	reputationImpactOnKill?: number;
	reputationImpactOnAttack?: number;
	notes?: string;
	createdAt: string;
	updatedAt: string;
}

export interface SkillPolicyCheckInput {
	id?: string;
	type?: string;
	category?: string;
	tags?: string[];
}

export interface DiplomaticActorRef {
	actorType: DiplomaticActorType;
	actorId: string;
}

export interface ResolvedActorIdentity {
	actorId: string;
	kingdomId?: string;
	factionId?: string;
	factionIds?: string[];
	raceId?: string;
	clanId?: string;
	guildId?: string;
	groupId?: string;
	diplomaticActorIds: DiplomaticActorRef[];
	isPlayer?: boolean;
	isNpc?: boolean;
	isMonster?: boolean;
	isAnimal?: boolean;
	isBandit?: boolean;
}

export interface BattleRelationOverride {
	id?: string;
	sourceActorType: DiplomaticActorType;
	sourceActorId: string;
	targetActorType: DiplomaticActorType;
	targetActorId: string;
	value: number;
	stance?: RelationStance;
	isMutual?: boolean;
	attackOnSight?: boolean;
	assistInCombat?: boolean;
}

export interface ResolvedCombatRelation {
	value: number;
	stance: RelationStance;
	isHostile: boolean;
	isAlly: boolean;
	isNeutral: boolean;
	attackOnSight: boolean;
	assistInCombat: boolean;
	source: 'personal' | 'faction' | 'kingdom' | 'race' | 'group' | 'default' | 'battle_override';
	matchedRelationId?: string;
}

type ActorIdentityInput = Record<string, unknown>;

export function normalizeDiplomaticActorId(value: string | null | undefined): string {
	const normalized = String(value ?? '').trim().toLowerCase();
	if (!normalized) {
		return '';
	}
	const aliases: Record<string, string> = {
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

function readString(input: ActorIdentityInput, keys: string[]): string | undefined {
	for (const key of keys) {
		const value = input[key];
		if (typeof value === 'string' && value.trim()) {
			return value;
		}
	}
	return undefined;
}

function readStringArray(input: ActorIdentityInput, keys: string[]): string[] {
	const values: string[] = [];
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

function appendRef(refs: DiplomaticActorRef[], actorType: DiplomaticActorType, actorId: string | undefined): void {
	const normalizedId = normalizeDiplomaticActorId(actorId);
	if (!normalizedId) {
		return;
	}
	if (!refs.some((ref) => ref.actorType === actorType && ref.actorId === normalizedId)) {
		refs.push({ actorType, actorId: normalizedId });
	}
}

export function resolveActorIdentity(actor: ActorIdentityInput): ResolvedActorIdentity {
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
	const refs: DiplomaticActorRef[] = [];

	for (const rawRef of Array.isArray(actor.diplomaticActorIds) ? actor.diplomaticActorIds : []) {
		if (!rawRef || typeof rawRef !== 'object') {
			continue;
		}
		const ref = rawRef as Partial<DiplomaticActorRef>;
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

export function inferRelationStance(value: number): RelationStance {
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

export function normalizeRelationValue(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.max(-100, Math.min(100, Math.round(value)));
}

function isMagicTaggedSkill(skill: SkillPolicyCheckInput): boolean {
	const tokens = [
		skill.type,
		skill.category,
		...(skill.tags ?? []),
	].map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean);
	return tokens.some((token) => ['magic', 'elemental', 'necromancy', 'dark_magic', 'arcane', 'fire', 'water', 'earth', 'air', 'light', 'dark'].includes(token));
}

export function canActorUseSkillByCombatPolicy(
	identity: ResolvedActorIdentity,
	diplomaticActors: DiplomaticActorDefinition[],
	skill: SkillPolicyCheckInput,
): boolean {
	const skillTags = new Set([
		String(skill.type ?? '').trim().toLowerCase(),
		String(skill.category ?? '').trim().toLowerCase(),
		...(skill.tags ?? []).map((tag) => tag.trim().toLowerCase()),
	].filter(Boolean));
	for (const ref of identity.diplomaticActorIds) {
		const actor = diplomaticActors.find((entry) =>
			entry.actorType === ref.actorType && normalizeDiplomaticActorId(entry.id) === ref.actorId,
		);
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

function buildResolvedRelation(
	value: number,
	source: ResolvedCombatRelation['source'],
	options: {
		stance?: RelationStance;
		attackOnSight?: boolean;
		assistInCombat?: boolean;
		matchedRelationId?: string;
	} = {},
): ResolvedCombatRelation {
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

function relationSourceForType(actorType: DiplomaticActorType): ResolvedCombatRelation['source'] {
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

function findRelation<T extends GlobalRelation | BattleRelationOverride>(
	relations: T[],
	a: DiplomaticActorRef,
	b: DiplomaticActorRef,
): T | undefined {
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

function refsByPriority(identity: ResolvedActorIdentity, priority: DiplomaticActorType[]): DiplomaticActorRef[] {
	return identity.diplomaticActorIds.filter((ref) => priority.includes(ref.actorType));
}

export function resolveCombatRelation(
	actorA: ResolvedActorIdentity,
	actorB: ResolvedActorIdentity,
	globalRelations: GlobalRelation[],
	localOverrides: BattleRelationOverride[] = [],
): ResolvedCombatRelation {
	const priorityGroups: DiplomaticActorType[][] = [
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
