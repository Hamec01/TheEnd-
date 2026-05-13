import { describe, expect, it } from 'vitest';
import { executeDialogueActions } from './dialogueRuntime';

describe('dialogueRuntime training intents', () => {
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
});
