import { describe, expect, it, beforeEach } from 'vitest';
import { parseIdList, resolveTrainerSkillCandidates } from './trainerSkillResolver';

function mockLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe('trainerSkillResolver', () => {
  beforeEach(() => {
    (globalThis as any).window = { localStorage: mockLocalStorage() };
  });

  it('parseIdList supports comma/newline formats', () => {
    expect(parseIdList('a,b\nc , d')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('collects skills from npc trainerSkillIds', () => {
    const skill = {
      id: 'skill_ice_arrow_01',
      name: 'Ледяная стрела',
      type: 'magic',
      isPublished: true,
      isHidden: false,
      isTrainable: true,
      acquisitionMode: 'trainer',
      costs: { isFree: true },
      cooldown: { cooldownTurns: 0 },
      requirements: {},
      acquisition: { methods: [] },
    } as any;

    const candidates = resolveTrainerSkillCandidates({
      npcId: 'npc_trainer_1',
      trainerSkillIds: 'skill_ice_arrow_01',
      allSkills: [skill],
      context: { playerId: 'p1', level: 1, npcId: 'npc_trainer_1', gold: 999, stats: {} },
      learnedSkillIds: new Set(),
    });

    expect(candidates.map((c) => c.skillId)).toContain('skill_ice_arrow_01');
  });

  it('collects skills from skill.requiredNpcId', () => {
    const skill = {
      id: 'skill_x',
      name: 'X',
      type: 'magic',
      isPublished: true,
      isHidden: false,
      isTrainable: true,
      acquisitionMode: 'trainer',
      requiredNpcId: 'npc_teacher',
      costs: { isFree: true },
      cooldown: { cooldownTurns: 0 },
      requirements: {},
      acquisition: { methods: [] },
    } as any;

    const candidates = resolveTrainerSkillCandidates({
      npcId: 'npc_teacher',
      trainerSkillIds: '',
      allSkills: [skill],
      context: { playerId: 'p1', level: 1, npcId: 'npc_teacher', gold: 999, stats: {} },
      learnedSkillIds: new Set(),
    });

    expect(candidates.map((c) => c.skillId)).toContain('skill_x');
  });

  it('collects skills from acquisition.methods teacherNpcId', () => {
    const skill = {
      id: 'skill_y',
      name: 'Y',
      type: 'magic',
      isPublished: true,
      isHidden: false,
      isTrainable: true,
      acquisitionMode: 'trainer',
      costs: { isFree: true },
      cooldown: { cooldownTurns: 0 },
      requirements: {},
      acquisition: { methods: [{ type: 'teacher', teacherNpcId: 'npc_teacher' }] },
    } as any;

    const candidates = resolveTrainerSkillCandidates({
      npcId: 'npc_teacher',
      trainerSkillIds: '',
      allSkills: [skill],
      context: { playerId: 'p1', level: 1, npcId: 'npc_teacher', gold: 999, stats: {} },
      learnedSkillIds: new Set(),
    });

    expect(candidates.map((c) => c.skillId)).toContain('skill_y');
  });
});

