import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialogueDefinition } from '../types/dialogue';

let dialogueById: Record<string, DialogueDefinition | null> = {};
let npcById: Record<string, { id: string; traderId?: string | null }> = {};

vi.mock('./dialogueRepository', () => ({
  getDialogueById: (id: string) => dialogueById[id] ?? null,
  getDialoguesByNpc: (npcId: string) =>
    Object.values(dialogueById).filter((entry) => entry?.npcId === npcId) as DialogueDefinition[],
}));

vi.mock('./npcRepository', () => ({
  getNpcById: (id: string) => npcById[id] ?? null,
}));

describe('dialogueRuntime', () => {
  beforeEach(() => {
    dialogueById = {};
    npcById = {};
  });

  it('executeDialogueActions emits OPEN_SHOP intent with merchantId from NPC', async () => {
    npcById.n1 = { id: 'n1', traderId: 'm1' };
    const { executeDialogueActions } = await import('./dialogueRuntime');
    const result = executeDialogueActions('p1', 'n1', [{ id: 'a1', type: 'openShop' }]);
    expect(result.intents).toEqual([{ type: 'OPEN_SHOP', merchantId: 'm1' }]);
  });

  it('chooseDialogueOption returns intents from node and choice actions', async () => {
    npcById.n1 = { id: 'n1', traderId: 'm1' };
    const dialogue: DialogueDefinition = {
      id: 'd1',
      title: 'Test',
      npcId: 'n1',
      status: 'active',
      description: '',
      startNodeId: 'n1',
      nodes: [
        {
          id: 'n1',
          speaker: 'npc',
          text: 'Hello',
          choices: [
            {
              id: 'c1',
              text: 'Fight',
              nextNodeId: 'n2',
              actions: [{ id: 'a2', type: 'startCombat' }],
            },
          ],
          actions: [{ id: 'a1', type: 'openShop' }],
        },
        {
          id: 'n2',
          speaker: 'system',
          text: '...',
          choices: [],
        },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    dialogueById.d1 = dialogue;

    const { chooseDialogueOption } = await import('./dialogueRuntime');
    const result = chooseDialogueOption('p1', 'n1', 'd1', 'n1', 'c1');

    expect(result.ended).toBe(false);
    expect(result.nextNode?.id).toBe('n2');
    expect(result.intents.map((intent) => intent.type)).toEqual(['OPEN_SHOP', 'START_COMBAT']);
  });
});
