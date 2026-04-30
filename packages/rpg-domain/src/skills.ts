import type { Race, RaceModifiers } from './races';
import type { DamagePayload } from './damage';
import type { PrimaryStat, StatBlock } from './stats';

export type StatKey = PrimaryStat;

export interface SkillCost {
  hp?: number;
  mp?: number;
  stamina?: number;
  spirit?: number;
}

export interface RunicSkillCost extends SkillCost {
  selfDebuffId?: string;
  riskChance?: number;
}

export type SkillCategory = 'physical' | 'elemental' | 'magic' | 'shamanic' | 'runic';

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  cost: SkillCost;
  damage?: DamagePayload;
  statusEffects?: string[];
  requiredRace?: Race[];
  forbiddenRace?: Race[];
  requiredStats?: Partial<Record<StatKey, number>>;
}

export interface SkillUser {
  race: Race;
  raceModifiers: RaceModifiers;
  currentHp: number;
  currentMp: number;
  currentStamina: number;
  currentSpirit?: number;
  stats?: StatBlock;
}

export interface SkillUsageCheck {
  ok: boolean;
  reason?: string;
  adjustedCost: SkillCost;
}

function getMpMultiplier(category: SkillCategory, modifiers: RaceModifiers): number {
  if (category === 'magic') {
    return modifiers.magicMpCostMultiplier;
  }
  if (category === 'elemental') {
    return modifiers.elementMpCostMultiplier;
  }
  return 1;
}

export function getAdjustedSkillCost(skill: SkillDefinition, modifiers: RaceModifiers): SkillCost {
  const mpBase = skill.cost.mp ?? 0;
  const multiplier = getMpMultiplier(skill.category, modifiers);

  return {
    hp: skill.cost.hp,
    mp: mpBase > 0 ? Math.max(0, Math.round(mpBase * multiplier)) : skill.cost.mp,
    stamina: skill.cost.stamina,
    spirit: skill.cost.spirit,
  };
}

export function canUseSkill(user: SkillUser, skill: SkillDefinition): SkillUsageCheck {
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
    for (const [stat, required] of Object.entries(skill.requiredStats) as Array<[StatKey, number]>) {
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

export function applySkillCost<T extends SkillUser>(user: T, skill: SkillDefinition): T {
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
