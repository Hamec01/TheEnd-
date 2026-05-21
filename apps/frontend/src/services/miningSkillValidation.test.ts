import { describe, expect, it } from 'vitest';
import { getBlockedByExclusiveBranchReason, validateMiningSkillConnectivity } from './miningSkillValidation';
import type { ProfessionBranch, ProfessionSkill } from '../types/profession';

describe('mining branch exclusivity', () => {
  const branches: ProfessionBranch[] = [
    {
      id: 'mining_branch_deep_delver',
      professionId: 'mining',
      name: 'Глубинник',
      description: 'deep',
      exclusiveGroupId: 'tier_1_choice',
      isEnabled: true,
    },
    {
      id: 'mining_branch_prospector',
      professionId: 'mining',
      name: 'Старатель',
      description: 'prospector',
      exclusiveGroupId: 'tier_1_choice',
      isEnabled: true,
    },
  ];

  const skills: ProfessionSkill[] = [
    {
      id: 'skill_deep_1',
      professionId: 'mining',
      name: 'Deep 1',
      description: 'd',
      requiredLevel: 1,
      skillPointCost: 1,
      branchId: 'mining_branch_deep_delver',
      isEnabled: true,
    },
    {
      id: 'skill_prospect_1',
      professionId: 'mining',
      name: 'Prospect 1',
      description: 'p',
      requiredLevel: 1,
      skillPointCost: 1,
      branchId: 'mining_branch_prospector',
      isEnabled: true,
    },
  ];

  it('blocks learning skill from opposite exclusive branch', () => {
    const reason = getBlockedByExclusiveBranchReason({
      skill: skills[1]!,
      learnedSkillIds: ['skill_deep_1'],
      allSkills: skills,
      branches,
    });
    expect(reason).toContain('Старатель');
  });

  it('allows learning when no conflicting branch skill learned', () => {
    const reason = getBlockedByExclusiveBranchReason({
      skill: skills[1]!,
      learnedSkillIds: [],
      allSkills: skills,
      branches,
    });
    expect(reason).toBeNull();
  });

  it('does not warn that implemented mining effects are unsupported', () => {
    const warnings = validateMiningSkillConnectivity([{
      id: 'skill_runtime_supported',
      professionId: 'mining',
      name: 'Runtime supported',
      description: 'd',
      requiredLevel: 1,
      skillPointCost: 1,
      isEnabled: true,
      effects: [
        { type: 'mine_fragile_loot_break_chance_modifier', value: -10, valueType: 'percent' },
        { type: 'mine_loot_sell_value_modifier', value: 10, valueType: 'percent' },
        { type: 'mine_loot_special_property_chance', value: 5, valueType: 'percent', condition: { blockType: ['crystal'] } },
      ],
    }], []);

    expect(warnings.some((entry) => entry.message.includes('не поддержан'))).toBe(false);
  });
});
