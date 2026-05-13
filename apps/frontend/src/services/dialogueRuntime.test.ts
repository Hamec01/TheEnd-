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
});

