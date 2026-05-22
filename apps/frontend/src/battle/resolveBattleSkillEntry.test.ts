import { describe, expect, it } from 'vitest';
import { resolveBattleSkillEntry, resolveBattleSkillId, type BattleSkillEntry } from './resolveBattleSkillEntry';

const availableSkills: BattleSkillEntry[] = [
  {
    skillId: 'learned_ice_arrow',
    level: 1,
    label: 'Ice Arrow',
    definition: {
      id: 'skill_ice_arrow_01',
      name: 'Ice Arrow',
    } as any,
  },
];

describe('resolveBattleSkillEntry', () => {
  it('finds a battle skill by learned skillId', () => {
    expect(resolveBattleSkillEntry(availableSkills, 'learned_ice_arrow')?.definition.id).toBe('skill_ice_arrow_01');
    expect(resolveBattleSkillId(availableSkills, 'learned_ice_arrow')).toBe('learned_ice_arrow');
  });

  it('finds a battle skill by definition.id and returns canonical learned skillId', () => {
    expect(resolveBattleSkillEntry(availableSkills, 'skill_ice_arrow_01')?.skillId).toBe('learned_ice_arrow');
    expect(resolveBattleSkillId(availableSkills, 'skill_ice_arrow_01')).toBe('learned_ice_arrow');
  });
});