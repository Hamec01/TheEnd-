import { beforeEach, describe, expect, it } from 'vitest';
import { canStartQuest } from './questRuntime';

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('canStartQuest', () => {
  const localStorage = new MemoryStorage();

  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });
  });

  it('uses stored completed quest states when runtime player lacks completedQuestIds', () => {
    localStorage.setItem('theend.playerQuests', JSON.stringify([
      {
        playerId: 'player_argos',
        questId: 'argos_quest_klinogorie_first_steps',
        status: 'completed',
        currentStepId: 'step_pass_king_citizenship_test',
        completedStepIds: ['step_find_omtara', 'step_learn_about_documents', 'step_talk_to_citizenship_magistrate', 'step_pass_king_citizenship_test'],
        completedObjectiveIds: ['obj_reach_omtara', 'obj_learn_about_documents', 'obj_talk_to_citizenship_magistrate', 'obj_pass_king_citizenship_test'],
        flags: {},
        startedAt: '2026-06-15T00:00:00.000Z',
        completedAt: '2026-06-15T00:05:00.000Z',
        repeatCount: 1,
      },
    ]));

    const canStart = canStartQuest(
      {
        id: 'player_argos',
        level: 1,
        kingdomId: 'argos',
      },
      {
        id: 'argos_quest_field_of_the_fallen',
        title: 'Поле павших',
        status: 'active',
        category: 'kingdom',
        kingdomId: 'argos',
        isRepeatable: false,
        conditions: [
          {
            id: 'cond_field_player_argos',
            type: 'player_kingdom',
            value: 'argos',
          },
          {
            id: 'cond_field_identity_completed',
            type: 'quest_completed',
            value: 'argos_quest_klinogorie_first_steps',
          },
        ],
        steps: [],
        rewards: [],
        triggers: [],
        failureConsequences: [],
        flags: {},
        createdAt: '2026-06-15T00:00:00.000Z',
        updatedAt: '2026-06-15T00:00:00.000Z',
        playerDescription: '',
      } as any,
    );

    expect(canStart).toBe(true);
  });
});
