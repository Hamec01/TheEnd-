import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeDialogueActions, getAvailableChoices, getChoiceExplicitActions } from './dialogueRuntime';

const getQuestByIdMock = vi.fn();
const canStartQuestMock = vi.fn();

vi.mock('./questRepository', async () => {
  const actual = await vi.importActual<typeof import('./questRepository')>('./questRepository');
  return {
    ...actual,
    getQuestById: (...args: unknown[]) => getQuestByIdMock(...args),
  };
});

vi.mock('./questRuntime', async () => {
  const actual = await vi.importActual<typeof import('./questRuntime')>('./questRuntime');
  return {
    ...actual,
    canStartQuest: (...args: unknown[]) => canStartQuestMock(...args),
  };
});

describe('dialogueRuntime training intents', () => {
  beforeEach(() => {
    getQuestByIdMock.mockReset();
    canStartQuestMock.mockReset();
  });

  it('emits OPEN_TRAINING for openTraining action', () => {
    const result = executeDialogueActions(
      'player_test',
      'npc_test',
      [{ id: 'a1', type: 'openTraining' } as any],
    );
    expect(result.intents.some((intent) => intent.type === 'OPEN_TRAINING')).toBe(true);
  });

  it('emits OPEN_TRAINING for open_training action', () => {
    const result = executeDialogueActions(
      'player_test',
      'npc_test',
      [{ id: 'a1', type: 'open_training' } as any],
    );
    expect(result.intents.some((intent) => intent.type === 'OPEN_TRAINING')).toBe(true);
  });

  it('does not treat openTraining as GRANT_SKILL', () => {
    const result = executeDialogueActions(
      'player_test',
      'npc_test',
      [{ id: 'a1', type: 'openTraining', skillId: 'skill_ice_arrow_01' } as any],
    );
    expect(result.intents.some((intent) => intent.type === 'GRANT_SKILL')).toBe(false);
  });

  it('resolves trainer npc id from trainerNpcId > npcId > value > dialogue npc', () => {
    const r1 = executeDialogueActions('p', 'npc_dialogue', [{ id: 'a', type: 'openTraining', trainerNpcId: 'npc_t1' } as any]);
    expect(r1.intents.find((i) => i.type === 'OPEN_TRAINING')?.trainerNpcId).toBe('npc_t1');

    const r2 = executeDialogueActions('p', 'npc_dialogue', [{ id: 'a', type: 'openTraining', npcId: 'npc_t2' } as any]);
    expect(r2.intents.find((i) => i.type === 'OPEN_TRAINING')?.trainerNpcId).toBe('npc_t2');

    const r3 = executeDialogueActions('p', 'npc_dialogue', [{ id: 'a', type: 'openTraining', value: 'npc_t3' } as any]);
    expect(r3.intents.find((i) => i.type === 'OPEN_TRAINING')?.trainerNpcId).toBe('npc_t3');

    const r4 = executeDialogueActions('p', 'npc_dialogue', [{ id: 'a', type: 'openTraining' } as any]);
    expect(r4.intents.find((i) => i.type === 'OPEN_TRAINING')?.trainerNpcId).toBe('npc_dialogue');
  });

  it('emits OPEN_MINE for open_mine action with mineId', () => {
    const result = executeDialogueActions(
      'player_test',
      'npc_test',
      [{ id: 'a1', type: 'open_mine', mineId: 'mine_teramor_mineral' } as any],
    );
    expect(result.intents.find((intent) => intent.type === 'OPEN_MINE')).toEqual({
      type: 'OPEN_MINE',
      mineId: 'mine_teramor_mineral',
    });
  });

  it('emits OPEN_MINE for legacy action format', () => {
    const result = executeDialogueActions(
      'player_test',
      'npc_test',
      [{ action: 'open_mine', payload: { mineId: 'mine_legacy' } } as any],
    );
    expect(result.intents.find((intent) => intent.type === 'OPEN_MINE')).toEqual({
      type: 'OPEN_MINE',
      mineId: 'mine_legacy',
    });
  });

  it('injects full-heal intent for a payment choice that only declares takeGold', () => {
    const resolvedActions = getChoiceExplicitActions({
      id: 'choice_pay_full_heal',
      text: 'Заплатить 75 золота за полное лечение.',
      actions: [
        {
          id: 'act_take_gold_full_heal',
          type: 'takeGold',
          amount: 75,
        },
      ],
    } as any);

    const result = executeDialogueActions(
      'player_test',
      'npc_arklein_church_healer',
      resolvedActions,
    );

    expect(result.intents).toContainEqual({
      type: 'HEAL_PLAYER_FULL',
      costGold: 75,
    });
  });

  it('hides a dialogue choice that would restart an active or completed quest', () => {
    getQuestByIdMock.mockReturnValue({
      id: 'argos_quest_klinogorie_first_steps',
      status: 'active',
    });
    canStartQuestMock.mockReturnValue(false);

    const available = getAvailableChoices(
      { id: 'player_1', level: 1 },
      null,
      {
        id: 'node_start',
        text: 'test',
        choices: [
          {
            id: 'choice_restart_quest',
            text: 'Начать заново',
            giveQuest: 'argos_quest_klinogorie_first_steps',
          },
          {
            id: 'choice_leave',
            text: 'Уйти',
            end: true,
          },
        ],
      } as any,
    );

    expect(available.map((choice) => choice.id)).toEqual(['choice_leave']);
  });
});
