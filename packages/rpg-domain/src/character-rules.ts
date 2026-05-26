import type { DamageCategory, MagicSchool } from './damage';
import { Race } from './races';
import { SkillType, MagicSchoolType, type SkillDefinition as AdminSkillDefinition } from './skills/index';
import type { StatBlock } from './stats';

export type KingdomId = 'luminor' | 'artalon' | 'kriantar' | 'terimia' | 'argos';
export type AcademyId =
  | 'academy_four_winds_temple'
  | 'academy_aurelia_garden'
  | 'academy_tower_of_knowledge'
  | 'academy_hall_of_shadows'
  | 'academy_black_rite';

export interface RaceRuleConfig {
  race: Race;
  startingFreePoints: number;
  allowedSkillTypes: SkillType[];
  elementalMpCostMultiplier: number;
  elementalDamageMultiplier: number;
  missChanceMultiplier: number;
  iceDamageMultiplier?: number;
  incomingDamageMultipliers: Partial<Record<DamageCategory, number>>;
  allowedMagicSchools?: Array<MagicSchoolType | MagicSchool>;
  blockedMagicSchools?: Array<MagicSchoolType | MagicSchool>;
  startingProfessionIds?: string[];
  startingSkillIds?: string[];
}

export interface KingdomBonusConfig {
  kingdomId: KingdomId;
  label: string;
  startingGoldBonus?: number;
  sellPriceMultiplierBonus?: number;
  reputationGainMultiplierHumanKingdoms?: number;
  dialogueReputationBonus?: number;
  ignoreSandMovementPenalty?: boolean;
  physicalSkillStaminaCostMultiplier?: number;
  elementalSkillMpCostMultiplier?: number;
  physicalDamageMultiplier?: number;
  maxStaminaMultiplier?: number;
  magicDamageMultiplier?: number;
  magicMpCostMultiplier?: number;
  academyAccessBypass?: AcademyId[];
  necromancySkillAllowedWithoutIntroQuest?: boolean;
  deathMagicMpCostMultiplier?: number;
  curseMpCostMultiplier?: number;
  mindMagicMpCostMultiplier?: number;
  missChanceMultiplier?: number;
}

export interface AcademyConfig {
  academyId: AcademyId;
  name: string;
  magicTypes: SkillType[];
  schools: string[];
  subtypes?: string[];
  elements?: string[];
  allowedRaces: Race[];
}

export interface CharacterCitizenshipState {
  citizenshipKingdomId: KingdomId | null;
  kingdomReputation: Record<KingdomId, number>;
}

export interface ReputationDelta {
  kingdomId?: string;
  factionId?: string;
  amount: number;
}

export interface MerchantPriceModifiers {
  buyMultiplier: number;
  sellMultiplier: number;
  tradeBlocked: boolean;
}

export interface CityAccessOutcome {
  allowed: boolean;
  hostile: boolean;
  message: string | null;
}

const ALL_KINGDOM_IDS: KingdomId[] = ['luminor', 'artalon', 'kriantar', 'terimia', 'argos'];

export const DEFAULT_KINGDOM_REPUTATION: Record<KingdomId, number> = {
  luminor: 0,
  artalon: 0,
  kriantar: 0,
  terimia: 0,
  argos: 0,
};

export const KINGDOM_RELATION_PRESETS: Partial<Record<KingdomId, Partial<Record<KingdomId, number>>>> = {
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

export const RACE_RULES: Record<Race, RaceRuleConfig> = {
  [Race.Human]: {
    race: Race.Human,
    startingFreePoints: 10,
    allowedSkillTypes: [
      SkillType.PHYSICAL,
      SkillType.PASSIVE,
      SkillType.MAGIC,
      SkillType.ELEMENTAL_MAGIC,
      SkillType.NORMAL_MAGIC,
      SkillType.FORBIDDEN_MAGIC,
      SkillType.MIXED,
      SkillType.SHAMANISM,
      SkillType.RUNE,
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
  [Race.Dwarf]: {
    race: Race.Dwarf,
    startingFreePoints: 5,
    allowedSkillTypes: [SkillType.PHYSICAL, SkillType.PASSIVE, SkillType.RUNE],
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
      MagicSchoolType.ELEMENTAL,
      MagicSchoolType.NORMAL,
      MagicSchoolType.FORBIDDEN,
      MagicSchoolType.NECROMANCY,
      MagicSchoolType.BLOOD,
      MagicSchoolType.DEATH,
      MagicSchoolType.ILLUSION,
      MagicSchoolType.SHADOW,
      'curse',
    ],
    startingProfessionIds: ['mining', 'blacksmithing'],
    startingSkillIds: ['mining_basic_swing', 'blacksmithing_basic_tempering'],
  },
  [Race.WoodElf]: {
    race: Race.WoodElf,
    startingFreePoints: 5,
    allowedSkillTypes: [SkillType.PHYSICAL, SkillType.PASSIVE, SkillType.ELEMENTAL_MAGIC],
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
    allowedMagicSchools: [MagicSchoolType.ELEMENTAL],
    blockedMagicSchools: [
      MagicSchoolType.NORMAL,
      MagicSchoolType.FORBIDDEN,
      MagicSchoolType.NECROMANCY,
      MagicSchoolType.BLOOD,
      MagicSchoolType.DEATH,
      MagicSchoolType.ILLUSION,
      MagicSchoolType.SHADOW,
      'curse',
    ],
  },
  [Race.HighElf]: {
    race: Race.HighElf,
    startingFreePoints: 5,
    allowedSkillTypes: [SkillType.PHYSICAL, SkillType.PASSIVE, SkillType.ELEMENTAL_MAGIC],
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
    allowedMagicSchools: [MagicSchoolType.ELEMENTAL],
    blockedMagicSchools: [
      MagicSchoolType.NORMAL,
      MagicSchoolType.FORBIDDEN,
      MagicSchoolType.NECROMANCY,
      MagicSchoolType.BLOOD,
      MagicSchoolType.DEATH,
      MagicSchoolType.ILLUSION,
      MagicSchoolType.SHADOW,
      'curse',
    ],
  },
};

export const KINGDOM_BONUS_CONFIG: Record<KingdomId, KingdomBonusConfig> = {
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

export const ACADEMY_CONFIGS: Record<AcademyId, AcademyConfig> = {
  academy_four_winds_temple: {
    academyId: 'academy_four_winds_temple',
    name: 'Храм Четырёх Ветров',
    magicTypes: [SkillType.ELEMENTAL_MAGIC],
    schools: ['elemental'],
    elements: ['fire', 'water', 'earth', 'air', 'light', 'darkness'],
    allowedRaces: [Race.Human, Race.WoodElf, Race.HighElf],
  },
  academy_aurelia_garden: {
    academyId: 'academy_aurelia_garden',
    name: 'Сад Аурелии',
    magicTypes: [SkillType.NORMAL_MAGIC],
    schools: ['life', 'arcane'],
    subtypes: ['heal', 'blessing', 'aura'],
    allowedRaces: [Race.Human],
  },
  academy_tower_of_knowledge: {
    academyId: 'academy_tower_of_knowledge',
    name: 'Башня Знания',
    magicTypes: [SkillType.NORMAL_MAGIC],
    schools: ['mind', 'arcane'],
    subtypes: ['control', 'aura', 'transformation'],
    allowedRaces: [Race.Human],
  },
  academy_hall_of_shadows: {
    academyId: 'academy_hall_of_shadows',
    name: 'Зал Теней',
    magicTypes: [SkillType.NORMAL_MAGIC, SkillType.MIXED],
    schools: ['illusion', 'shadow', 'mind'],
    subtypes: ['illusion', 'control', 'transformation'],
    allowedRaces: [Race.Human],
  },
  academy_black_rite: {
    academyId: 'academy_black_rite',
    name: 'Чёрный Обряд',
    magicTypes: [SkillType.FORBIDDEN_MAGIC, SkillType.NORMAL_MAGIC, SkillType.MIXED],
    schools: ['death', 'blood', 'necromancy', 'curse', 'forbidden'],
    subtypes: ['curse', 'ritual', 'summon', 'contract'],
    allowedRaces: [Race.Human],
  },
};

export function isResourceStat(stat: keyof StatBlock): boolean {
  return stat === 'hp' || stat === 'mp' || stat === 'stamina';
}

export function scaleResourceStat(stat: keyof StatBlock, value: number): number {
  return isResourceStat(stat) ? value * 10 : value;
}

export function getStartingFreePoints(race: Race): number {
  return RACE_RULES[race].startingFreePoints;
}

export function createInitialKingdomReputation(citizenshipKingdomId: KingdomId | null): Record<KingdomId, number> {
  const next = { ...DEFAULT_KINGDOM_REPUTATION };
  if (citizenshipKingdomId) {
    const preset = KINGDOM_RELATION_PRESETS[citizenshipKingdomId] ?? {};
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

export function createInitialCitizenshipState(citizenshipKingdomId: KingdomId | null): CharacterCitizenshipState {
  return {
    citizenshipKingdomId,
    kingdomReputation: createInitialKingdomReputation(citizenshipKingdomId),
  };
}

export function applyCitizenshipChange(
  state: CharacterCitizenshipState,
  newKingdomId: KingdomId,
): CharacterCitizenshipState {
  const current = {
    citizenshipKingdomId: state.citizenshipKingdomId,
    kingdomReputation: { ...DEFAULT_KINGDOM_REPUTATION, ...state.kingdomReputation },
  };
  if (current.citizenshipKingdomId) {
    current.kingdomReputation[current.citizenshipKingdomId] -= 50;
  }
  current.citizenshipKingdomId = newKingdomId;
  current.kingdomReputation[newKingdomId] += 20;
  return current;
}

function normalizeMagicSchool(value: unknown): string | null {
  const school = String(value ?? '').trim().toLowerCase();
  return school.length > 0 ? school : null;
}

export function canRaceUseSkillType(race: Race, skillType: SkillType): boolean {
  return RACE_RULES[race].allowedSkillTypes.includes(skillType);
}

export function canRaceUseSkillDefinition(race: Race, skill: Pick<AdminSkillDefinition, 'type' | 'requirements' | 'damage' | 'tags'>): boolean {
  if (!canRaceUseSkillType(race, skill.type)) {
    return false;
  }

  const rules = RACE_RULES[race];
  const blockedSchools = new Set((rules.blockedMagicSchools ?? []).map((entry) => String(entry).toLowerCase()));
  const allowedSchools = rules.allowedMagicSchools
    ? new Set(rules.allowedMagicSchools.map((entry) => String(entry).toLowerCase()))
    : null;

  const candidateSchools = new Set<string>();
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

export function getRaceIncomingDamageMultiplier(race: Race, category: DamageCategory): number {
  return RACE_RULES[race].incomingDamageMultipliers[category] ?? 1;
}

export function getRaceOutgoingDamageMultiplier(params: {
  race: Race;
  category: DamageCategory;
  elementType?: string | null;
  tags?: string[] | null;
}): number {
  const rules = RACE_RULES[params.race];
  let multiplier = 1;

  if (params.category === 'elemental') {
    multiplier *= rules.elementalDamageMultiplier;
  }

  const tags = new Set((params.tags ?? []).map((entry) => String(entry).toLowerCase()));
  const isIce = params.elementType === 'ice' || (params.elementType === 'water' && tags.has('ice')) || tags.has('ice');
  if (params.race === Race.HighElf && params.category === 'elemental' && isIce) {
    multiplier *= rules.iceDamageMultiplier ?? 1;
  }

  return multiplier;
}

export function getKingdomStartingGoldBonus(kingdomId: KingdomId | null | undefined): number {
  if (!kingdomId) {
    return 0;
  }
  return KINGDOM_BONUS_CONFIG[kingdomId].startingGoldBonus ?? 0;
}

export function getKingdomBonusHighlights(kingdomId: KingdomId): string[] {
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

export function getKingdomMaxStaminaMultiplier(kingdomId: KingdomId | null | undefined): number {
  if (!kingdomId) {
    return 1;
  }
  return KINGDOM_BONUS_CONFIG[kingdomId].maxStaminaMultiplier ?? 1;
}

export function getSkillMpCostMultiplier(params: {
  race: Race;
  kingdomId?: KingdomId | null;
  skillType: SkillType;
  schools?: string[] | null;
}): number {
  const raceRules = RACE_RULES[params.race];
  let multiplier = 1;

  if (params.skillType === SkillType.ELEMENTAL_MAGIC) {
    multiplier *= raceRules.elementalMpCostMultiplier;
    if (params.kingdomId) {
      multiplier *= KINGDOM_BONUS_CONFIG[params.kingdomId].elementalSkillMpCostMultiplier ?? 1;
    }
  }
  if (
    params.skillType === SkillType.MAGIC
    || params.skillType === SkillType.NORMAL_MAGIC
    || params.skillType === SkillType.FORBIDDEN_MAGIC
    || params.skillType === SkillType.MIXED
  ) {
    if (params.kingdomId) {
      multiplier *= KINGDOM_BONUS_CONFIG[params.kingdomId].magicMpCostMultiplier ?? 1;
    }
  }

  const schools = new Set((params.schools ?? []).map((entry) => String(entry).toLowerCase()));
  if (params.kingdomId === 'terimia') {
    if (schools.has('death') || schools.has('necromancy')) {
      multiplier *= KINGDOM_BONUS_CONFIG.terimia.deathMagicMpCostMultiplier ?? 1;
    }
    if (schools.has('curse')) {
      multiplier *= KINGDOM_BONUS_CONFIG.terimia.curseMpCostMultiplier ?? 1;
    }
  }
  if (params.kingdomId === 'kriantar' && schools.has('mind')) {
    multiplier *= KINGDOM_BONUS_CONFIG.kriantar.mindMagicMpCostMultiplier ?? 1;
  }

  return multiplier;
}

export function getPhysicalSkillStaminaCostMultiplier(kingdomId: KingdomId | null | undefined): number {
  if (!kingdomId) {
    return 1;
  }
  return KINGDOM_BONUS_CONFIG[kingdomId].physicalSkillStaminaCostMultiplier ?? 1;
}

export function getMissChanceMultiplier(race: Race, kingdomId?: KingdomId | null): number {
  let multiplier = RACE_RULES[race].missChanceMultiplier;
  if (kingdomId) {
    multiplier *= KINGDOM_BONUS_CONFIG[kingdomId].missChanceMultiplier ?? 1;
  }
  return multiplier;
}

export function canAccessAcademy(params: {
  race: Race;
  academyId: AcademyId;
  citizenshipKingdomId?: KingdomId | null;
}): { allowed: boolean; bypassIntroQuest: boolean } {
  const academy = ACADEMY_CONFIGS[params.academyId];
  if (!academy.allowedRaces.includes(params.race)) {
    return { allowed: false, bypassIntroQuest: false };
  }
  const bypassIntroQuest = Boolean(
    params.citizenshipKingdomId
      && KINGDOM_BONUS_CONFIG[params.citizenshipKingdomId].academyAccessBypass?.includes(params.academyId),
  );
  return { allowed: true, bypassIntroQuest };
}

export function getMerchantPriceModifiers(params: {
  kingdomReputation: number;
  playerKingdomId?: KingdomId | null;
}): MerchantPriceModifiers {
  const rep = params.kingdomReputation;
  if (rep <= -90) {
    return { buyMultiplier: 1, sellMultiplier: 1, tradeBlocked: true };
  }

  let buyMultiplier = 1;
  let sellMultiplier = 1;
  if (rep >= 80) {
    buyMultiplier = 0.8;
    sellMultiplier = 1.2;
  } else if (rep >= 50) {
    buyMultiplier = 0.9;
    sellMultiplier = 1.1;
  } else if (rep >= 20) {
    buyMultiplier = 0.95;
    sellMultiplier = 1.05;
  } else if (rep <= -50) {
    buyMultiplier = 1.25;
    sellMultiplier = 0.75;
  } else if (rep <= -20) {
    buyMultiplier = 1.1;
    sellMultiplier = 0.9;
  }

  if (params.playerKingdomId === 'luminor') {
    sellMultiplier *= 1 + (KINGDOM_BONUS_CONFIG.luminor.sellPriceMultiplierBonus ?? 0);
  }

  return {
    buyMultiplier: Math.min(2, Math.max(0.5, buyMultiplier)),
    sellMultiplier: Math.min(2, Math.max(0.25, sellMultiplier)),
    tradeBlocked: false,
  };
}

export function getNpcDispositionBonus(kingdomReputation: number): number {
  return kingdomReputation;
}

export function getCityAccessOutcome(kingdomReputation: number): CityAccessOutcome {
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

export function getStartingProfessionIds(race: Race): string[] {
  return [...(RACE_RULES[race].startingProfessionIds ?? [])];
}

export function getStartingSkillIds(race: Race): string[] {
  return [...(RACE_RULES[race].startingSkillIds ?? [])];
}

export function isKingdomId(value: unknown): value is KingdomId {
  return ALL_KINGDOM_IDS.includes(value as KingdomId);
}
