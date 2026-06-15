import { describe, expect, it } from 'vitest';
import { normalizeNpcForAdmin } from './npcAdminNormalization';

describe('normalizeNpcForAdmin', () => {
  it('maps legacy quest_giver quest binding role to giver', () => {
    const result = normalizeNpcForAdmin({
      id: 'npc_argos_king_gramar_fireblade',
      name: 'Грамар',
      status: 'active',
      kind: 'story_character',
      race: 'human',
      description: '',
      mapBindings: [],
      defaultDisposition: 'friendly',
      isUnique: true,
      canRespawn: false,
      canFight: false,
      canTalk: true,
      canTrade: false,
      canTrain: false,
      canGiveQuests: true,
      canBeKilled: false,
      dialogues: [],
      questBindings: [
        {
          questId: 'argos_quest_field_of_the_fallen',
          role: 'quest_giver',
        },
      ],
    });

    expect(result.npc.questBindings).toEqual([
      {
        questId: 'argos_quest_field_of_the_fallen',
        role: 'giver',
        conditions: undefined,
      },
    ]);
  });
});
