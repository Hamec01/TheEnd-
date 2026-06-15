import { describe, expect, it } from 'vitest';
import { resolveQuestBattleLaunchFromZone } from './questBattleResolver';
import type { WorldMapZone } from './zoneEditorTypes';
import type { QuestDefinition, PlayerQuestState } from '../types/quest';

function createBaseZone(fields?: Partial<WorldMapZone>): WorldMapZone {
  return {
    id: 'argos_quest_field_of_the_fallen',
    name: 'Поле павших',
    type: 'location',
    shape: 'circle',
    x: 0.5,
    y: 0.5,
    radius: 0.05,
    description: 'A quest zone',
    isDiscovered: true,
    isVisibleToPlayer: true,
    dangerLevel: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    questLaunch: {
      action: 'start_quest_battle',
      questId: 'argos_quest_field_of_the_fallen',
      questStepId: 'step_extract_wounded',
      questObjectiveId: 'obj_extract_argos_wounded',
      battleMapId: 'battlemap_argos_artalon',
      battleObjectiveIds: ['obj_extract_argos_wounded_5'],
      triggerOn: 'enter',
      requireCurrentStep: true,
    },
    ...fields,
  };
}

const mockQuest: QuestDefinition = {
  id: 'argos_quest_field_of_the_fallen',
  title: 'Поле павших',
  adminDescription: '',
  playerDescription: '',
  category: 'global',
  status: 'active',
  isRepeatable: false,
  isHidden: false,
  createdAt: '',
  updatedAt: '',
  steps: [
    {
      id: 'step_extract_wounded',
      questId: 'argos_quest_field_of_the_fallen',
      title: 'Вынести раненых',
      journalText: '',
      order: 1,
      objectives: [
        {
          id: 'obj_extract_argos_wounded',
          type: 'battle_objective',
        },
      ],
    },
  ],
  triggers: [],
  conditions: [],
  rewards: [],
  failureConsequences: [],
};

const mockBattleMaps = [
  {
    id: 'battlemap_argos_artalon',
    objectives: [
      { id: 'obj_extract_argos_wounded_5' },
    ],
  },
];

describe('questBattleResolver', () => {
  it('successfully resolves a valid quest battle launch', () => {
    const zone = createBaseZone();
    const questState: PlayerQuestState = {
      playerId: 'char_1',
      questId: 'argos_quest_field_of_the_fallen',
      status: 'active',
      currentStepId: 'step_extract_wounded',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    };

    const res = resolveQuestBattleLaunchFromZone({
      zone,
      questDefinitions: [mockQuest],
      playerQuestStates: [questState],
      characterId: 'char_1',
      trigger: 'enter',
      battleMaps: mockBattleMaps,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.battleMapId).toBe('battlemap_argos_artalon');
      expect(res.battleContext.battleType).toBe('quest');
      if (res.battleContext.battleType === 'quest') {
        expect(res.battleContext.questId).toBe('argos_quest_field_of_the_fallen');
        expect(res.battleContext.questStepId).toBe('step_extract_wounded');
        expect(res.battleContext.activeBattleObjectiveIds).toEqual(['obj_extract_argos_wounded_5']);
      }
    }
  });

  it('fails with trigger_mismatch when trigger does not match triggerOn', () => {
    const zone = createBaseZone();
    const questState: PlayerQuestState = {
      playerId: 'char_1',
      questId: 'argos_quest_field_of_the_fallen',
      status: 'active',
      currentStepId: 'step_extract_wounded',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    };

    const res = resolveQuestBattleLaunchFromZone({
      zone,
      questDefinitions: [mockQuest],
      playerQuestStates: [questState],
      characterId: 'char_1',
      trigger: 'interact', // interact vs enter
      battleMaps: mockBattleMaps,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('trigger_mismatch');
    }
  });

  it('fails with quest_not_found if quest is missing', () => {
    const zone = createBaseZone();
    const questState: PlayerQuestState = {
      playerId: 'char_1',
      questId: 'argos_quest_field_of_the_fallen',
      status: 'active',
      currentStepId: 'step_extract_wounded',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    };

    const res = resolveQuestBattleLaunchFromZone({
      zone,
      questDefinitions: [], // empty
      playerQuestStates: [questState],
      characterId: 'char_1',
      trigger: 'enter',
      battleMaps: mockBattleMaps,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('quest_not_found');
    }
  });

  it('fails with quest_not_active if quest is not active', () => {
    const zone = createBaseZone();
    // Quest not in playerQuestStates (not started)
    const res = resolveQuestBattleLaunchFromZone({
      zone,
      questDefinitions: [mockQuest],
      playerQuestStates: [],
      characterId: 'char_1',
      trigger: 'enter',
      battleMaps: mockBattleMaps,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('quest_not_active');
    }
  });

  it('fails with active_step_mismatch if current step does not match', () => {
    const zone = createBaseZone();
    const questState: PlayerQuestState = {
      playerId: 'char_1',
      questId: 'argos_quest_field_of_the_fallen',
      status: 'active',
      currentStepId: 'step_some_other_step',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    };

    const res = resolveQuestBattleLaunchFromZone({
      zone,
      questDefinitions: [mockQuest],
      playerQuestStates: [questState],
      characterId: 'char_1',
      trigger: 'enter',
      battleMaps: mockBattleMaps,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('active_step_mismatch');
    }
  });

  it('fails with objective_not_battle_objective if target objective is not battle_objective', () => {
    const zone = createBaseZone();
    const nonBattleQuest = {
      ...mockQuest,
      steps: [
        {
          ...mockQuest.steps[0]!,
          objectives: [
            {
              id: 'obj_extract_argos_wounded',
              type: 'visit_location' as any,
            },
          ],
        },
      ],
    };
    const questState: PlayerQuestState = {
      playerId: 'char_1',
      questId: 'argos_quest_field_of_the_fallen',
      status: 'active',
      currentStepId: 'step_extract_wounded',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    };

    const res = resolveQuestBattleLaunchFromZone({
      zone,
      questDefinitions: [nonBattleQuest],
      playerQuestStates: [questState],
      characterId: 'char_1',
      trigger: 'enter',
      battleMaps: mockBattleMaps,
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('objective_not_battle_objective');
    }
  });

  it('fails with battle_map_not_found if battleMapId is missing or wrong', () => {
    const zone = createBaseZone();
    const questState: PlayerQuestState = {
      playerId: 'char_1',
      questId: 'argos_quest_field_of_the_fallen',
      status: 'active',
      currentStepId: 'step_extract_wounded',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    };

    const res = resolveQuestBattleLaunchFromZone({
      zone,
      questDefinitions: [mockQuest],
      playerQuestStates: [questState],
      characterId: 'char_1',
      trigger: 'enter',
      battleMaps: [{ id: 'some_other_map' }],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('battle_map_not_found');
    }
  });

  it('fails with battle_objective_not_found if objective id is not on the battle map', () => {
    const zone = createBaseZone();
    const questState: PlayerQuestState = {
      playerId: 'char_1',
      questId: 'argos_quest_field_of_the_fallen',
      status: 'active',
      currentStepId: 'step_extract_wounded',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    };

    const res = resolveQuestBattleLaunchFromZone({
      zone,
      questDefinitions: [mockQuest],
      playerQuestStates: [questState],
      characterId: 'char_1',
      trigger: 'enter',
      battleMaps: [
        {
          id: 'battlemap_argos_artalon',
          objectives: [{ id: 'obj_wrong_objective' }],
        },
      ],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('battle_objective_not_found');
    }
  });
});
