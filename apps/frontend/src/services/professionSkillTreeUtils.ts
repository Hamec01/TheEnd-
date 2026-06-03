import type { ProfessionBranch, ProfessionSkill } from '../types/profession';

const BLACKSMITH_STARTER_SKILL_IDS = [
  'blacksmith_basic_forging',
  'blacksmith_metal_knowledge',
  'blacksmith_even_blank',
  'blacksmith_simple_tempering',
  'blacksmith_rough_socket',
] as const;

const BLACKSMITH_MASTER_BRANCH_IDS = [
  'blacksmith_weapon_master_path',
  'blacksmith_armor_master_path',
  'blacksmith_setting_master_path',
] as const;

export function countLearnedSkillsInBranch(
  branchId: string,
  skills: ProfessionSkill[],
  learnedSkillIds: Set<string>,
): number {
  return skills.filter((skill) => skill.branchId === branchId && learnedSkillIds.has(skill.id)).length;
}

export function countSelectedBranchesInExclusiveGroup(
  groupId: string,
  branches: ProfessionBranch[],
  selectedBranchIds: Set<string>,
): number {
  return branches.filter((branch) => branch.exclusiveGroupId === groupId && selectedBranchIds.has(branch.id)).length;
}

export function getExclusiveGroupMax(branch: ProfessionBranch): number {
  if (!branch.exclusiveGroupId) {
    return 0;
  }
  return Math.max(1, branch.exclusiveGroupMax ?? 1);
}

export function isBlacksmithStarterComplete(learnedSkillIds: Set<string>): boolean {
  return BLACKSMITH_STARTER_SKILL_IDS.every((skillId) => learnedSkillIds.has(skillId));
}

export function canUnlockFinalBlacksmithTrial(
  branches: ProfessionBranch[],
  skills: ProfessionSkill[],
  learnedSkillIds: Set<string>,
  selectedBranchIds: Set<string>,
): boolean {
  const learnedMasters = BLACKSMITH_MASTER_BRANCH_IDS.filter((branchId) => (
    selectedBranchIds.has(branchId) && countLearnedSkillsInBranch(branchId, skills, learnedSkillIds) >= 5
  ));
  return learnedMasters.length >= 2;
}

export function getBlockedByExclusiveSkillGroupReason(params: {
  skill: ProfessionSkill;
  learnedSkillIds: string[];
  allSkills: ProfessionSkill[];
}): string | null {
  const groupId = params.skill.exclusiveSkillGroupId?.trim();
  if (!groupId) {
    return null;
  }
  const learned = new Set(params.learnedSkillIds);
  for (const learnedSkillId of learned) {
    if (learnedSkillId === params.skill.id) {
      continue;
    }
    const learnedSkill = params.allSkills.find((entry) => entry.id === learnedSkillId);
    if (learnedSkill?.exclusiveSkillGroupId === groupId) {
      return `Уже выбран финальный путь: ${learnedSkill.name}.`;
    }
  }
  return null;
}
