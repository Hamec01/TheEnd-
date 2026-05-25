import { describe, expect, it } from 'vitest';
import {
  mergeDialogueActionCitizenship,
  mergeDialogueActionReputation,
  mergeInteractionEffectReputation,
  mergeQuestRewardReputation,
} from '../admin/components/reputationEffectAdapters';
import { extractRawCollectionFromImportJson } from './content/adminJsonImportExport';
import { validateDialogue } from './dialogueValidator';
import { validateQuest } from './questValidator';
import { validateChangeCitizenshipValue, validateReputationChangesValue } from './reputationCitizenshipValidation';

describe('reputation/citizenship admin tools', () => {
  it('dialogue choice with reputationChanges saves correctly', () => {
    const updated = mergeDialogueActionReputation(
      { type: 'addReputation' } as any,
      [
        { targetType: 'kingdom', targetId: 'artalon', amount: 25 },
        { targetType: 'faction', targetId: 'mist_cult', amount: -10 },
      ],
    );

    expect(updated.reputationChanges).toEqual([
      {
        targetType: 'kingdom',
        targetId: 'artalon',
        amount: 25,
        kingdomId: 'artalon',
        factionId: undefined,
        reason: undefined,
      },
      {
        targetType: 'faction',
        targetId: 'mist_cult',
        amount: -10,
        kingdomId: undefined,
        factionId: 'mist_cult',
        reason: undefined,
      },
    ]);
  });

  it('dialogue choice with changeCitizenship saves correctly', () => {
    const updated = mergeDialogueActionCitizenship(
      { type: 'changeCitizenship' } as any,
      {
        kingdomId: 'luminor',
        oldKingdomPenalty: -50,
        newKingdomBonus: 20,
        requireAuthorityNpc: true,
      },
    );

    expect(updated.kingdomId).toBe('luminor');
    expect(updated.changeCitizenship).toEqual({
      kingdomId: 'luminor',
      oldKingdomPenalty: -50,
      newKingdomBonus: 20,
      requireAuthorityNpc: true,
    });
  });

  it('quest interaction effect preserves reputationChanges', () => {
    const updated = mergeInteractionEffectReputation(
      { type: 'add_reputation' } as any,
      [{ targetType: 'kingdom', targetId: 'argos', amount: -15, reason: 'test' }],
    );

    expect(updated.type).toBe('add_reputation');
    expect(updated.reputationChanges).toEqual([
      {
        targetType: 'kingdom',
        targetId: 'argos',
        amount: -15,
        reason: 'test',
        kingdomId: 'argos',
        factionId: undefined,
      },
    ]);
  });

  it('quest reward preserves reputationChanges', () => {
    const reward = mergeQuestRewardReputation(
      { id: 'reward_rep', type: 'reputation' } as any,
      [{ targetType: 'kingdom', targetId: 'kriantar', amount: 30 }],
    );

    expect(reward.type).toBe('reputation');
    expect(reward.reputationChanges?.[0]).toMatchObject({ targetType: 'kingdom', targetId: 'kriantar', kingdomId: 'kriantar', amount: 30 });
  });

  it('import/export helpers preserve add_reputation and addReputation payload fields', () => {
    const payload = {
      questInteractions: [
        {
          id: 'interaction_1',
          choices: [
            {
              id: 'choice_1',
              text: 'x',
              effects: [
                { type: 'add_reputation', reputationChanges: [{ targetType: 'kingdom', targetId: 'artalon', amount: 1 }] },
                { type: 'addReputation', reputationChanges: [{ targetType: 'faction', targetId: 'free_cities', amount: 2 }] },
              ],
            },
          ],
        },
      ],
    };

    const extracted = extractRawCollectionFromImportJson(payload, 'questInteractions') as Array<Record<string, unknown>>;
    expect(extracted[0]).toEqual(payload.questInteractions[0]);
  });

  it('invalid kingdom id fails validation', () => {
    const repErrors = validateReputationChangesValue([
      { targetType: 'kingdom', targetId: 'wrong_kingdom', amount: 10 },
    ], 'action.reputationChanges');
    const citizenshipErrors = validateChangeCitizenshipValue({ kingdomId: 'wrong_kingdom' }, 'action.changeCitizenship');

    expect(repErrors.length).toBeGreaterThan(0);
    expect(citizenshipErrors.length).toBeGreaterThan(0);
  });

  it('existing content without reputation/citizenship fields remains valid', () => {
    const dialogueValidation = validateDialogue(
      {
        id: 'dlg_test',
        title: 'Test',
        status: 'draft',
        startNodeId: 'start',
        nodes: [
          {
            id: 'start',
            speaker: 'npc',
            text: 'Hello',
            choices: [{ id: 'leave', text: 'Bye', endsDialogue: true }],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        npcIds: [],
        questIds: [],
        itemIds: [],
        questItemIds: [],
        skillIds: [],
        factionIds: [],
        kingdomIds: ['luminor', 'artalon', 'kriantar', 'terimia', 'argos'],
        locationIds: [],
      },
    );

    const questValidation = validateQuest(
      {
        id: 'quest_test',
        title: 'Quest',
        adminDescription: '',
        playerDescription: '',
        category: 'global',
        status: 'draft',
        isRepeatable: false,
        isHidden: false,
        steps: [],
        triggers: [],
        conditions: [],
        rewards: [],
        failureConsequences: [],
        flags: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        npcIds: [],
        itemIds: [],
        questItemIds: [],
        skillIds: [],
        professionIds: [],
        markerIds: [],
        zoneIds: [],
        interactionQuestIds: [],
        dialogueCompletableQuestIds: [],
        dialogueIds: [],
        kingdoms: ['luminor', 'artalon', 'kriantar', 'terimia', 'argos'],
        factions: ['free_cities'],
        cities: [],
      },
    );

    expect(dialogueValidation.errors).toEqual([]);
    expect(questValidation.errors).toEqual([]);
  });
});
