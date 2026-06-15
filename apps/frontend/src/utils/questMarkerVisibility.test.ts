import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkMarkerRequirements } from './questMarkerVisibility';
import type { QuestMarkerDefinition } from '../types/quest';

const getPlayerQuestStateMock = vi.fn();

vi.mock('../services/questRuntime', async () => {
  const actual = await vi.importActual<typeof import('../services/questRuntime')>('../services/questRuntime');
  return {
    ...actual,
    getPlayerQuestState: (...args: unknown[]) => getPlayerQuestStateMock(...args),
  };
});

function createMarker(fields?: Partial<QuestMarkerDefinition>): QuestMarkerDefinition {
  return {
    id: 'marker_test',
    mapId: 'worldmap-main',
    x: 0.5,
    y: 0.5,
    type: 'quest_objective',
    title: 'Test marker',
    visibleToPlayer: true,
    conditionIds: [],
    linkedQuestId: 'argos_quest_klinogorie_first_steps',
    linkedStepId: 'step_find_omtara',
    linkedObjectiveId: 'obj_reach_omtara',
    showOnWorldMap: true,
    showOnMiniMap: true,
    ...fields,
  };
}

describe('questMarkerVisibility', () => {
  beforeEach(() => {
    getPlayerQuestStateMock.mockReset();
  });

  it('hides quest markers when the quest is not active', () => {
    getPlayerQuestStateMock.mockReturnValue({
      playerId: 'player_1',
      questId: 'argos_quest_klinogorie_first_steps',
      status: 'completed',
      currentStepId: 'step_find_omtara',
      completedStepIds: ['step_find_omtara'],
      completedObjectiveIds: ['obj_reach_omtara'],
      flags: {},
    });

    expect(checkMarkerRequirements(createMarker(), { id: 'player_1' })).toBe(false);
  });

  it('hides quest markers when the current step no longer matches', () => {
    getPlayerQuestStateMock.mockReturnValue({
      playerId: 'player_1',
      questId: 'argos_quest_klinogorie_first_steps',
      status: 'active',
      currentStepId: 'step_learn_about_documents',
      completedStepIds: ['step_find_omtara'],
      completedObjectiveIds: ['obj_reach_omtara'],
      flags: {},
    });

    expect(checkMarkerRequirements(createMarker(), { id: 'player_1' })).toBe(false);
  });

  it('shows quest markers while the linked objective is active', () => {
    getPlayerQuestStateMock.mockReturnValue({
      playerId: 'player_1',
      questId: 'argos_quest_klinogorie_first_steps',
      status: 'active',
      currentStepId: 'step_find_omtara',
      completedStepIds: [],
      completedObjectiveIds: [],
      flags: {},
    });

    expect(checkMarkerRequirements(createMarker(), { id: 'player_1' })).toBe(null);
  });
});
