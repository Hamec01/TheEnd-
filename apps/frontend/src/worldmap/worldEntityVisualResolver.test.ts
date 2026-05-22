import { describe, expect, it } from 'vitest';
import { resolveRenderedWorldEntities } from './worldEntityVisualResolver';

describe('resolveRenderedWorldEntities', () => {
  it('prefers shared sprite rendering for merchants when a sprite image is available', () => {
    const entities = resolveRenderedWorldEntities(
      [{
        id: 'merchant_1',
        archetypeId: 'merchant',
        kind: 'merchant',
        state: 'traveling',
        spriteId: 'merchant_cart',
        portraitId: 'merchant_portrait',
        memberCount: 2,
        zoneId: 'city',
        coordinates: { x: 0.5, y: 0.5 },
        isHostile: false,
        hasQuest: true,
      }],
      [{
        id: 'merchant_cart',
        name: 'merchant_cart',
        mimeType: 'image/png',
        width: 32,
        height: 32,
        dataUrl: 'data:image/png;base64,sprite',
        createdAt: 'now',
        updatedAt: 'now',
      }],
      [],
    );

    expect(entities[0]).toMatchObject({
      renderMode: 'sprite',
      spriteSrc: 'data:image/png;base64,sprite',
      imageSrc: 'data:image/png;base64,sprite',
      hasQuest: true,
      memberCount: 2,
    });
  });

  it('falls back to npc portrait data when the world entity portrait id is not meaningful', () => {
    const entities = resolveRenderedWorldEntities(
      [{
        id: 'quest_giver_1',
        archetypeId: 'quest_giver',
        kind: 'quest_giver',
        npcTemplateId: 'npc_1',
        state: 'resting',
        spriteId: '',
        portraitId: 'unknown',
        memberCount: 1,
        zoneId: 'camp',
        coordinates: { x: 0.2, y: 0.3 },
        isHostile: false,
        hasQuest: true,
      }],
      [],
      [{
        id: 'npc_1',
        name: 'Sage',
        kind: 'quest_giver',
        race: 'human',
        status: 'active',
        description: 'wise',
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
        questBindings: [],
        createdAt: 'now',
        updatedAt: 'now',
        fullImageUrl: '/npc/sage.png',
      }],
    );

    expect(entities[0]).toMatchObject({
      renderMode: 'portrait',
      portraitSrc: '/npc/sage.png',
      imageSrc: '/npc/sage.png',
      label: 'Sage',
    });
  });

  it('keeps fallback render mode when neither sprite nor portrait can be resolved', () => {
    const entities = resolveRenderedWorldEntities(
      [{
        id: 'bandit_1',
        archetypeId: 'bandit',
        kind: 'bandit',
        state: 'traveling',
        spriteId: '',
        portraitId: 'none',
        memberCount: 3,
        zoneId: 'road',
        coordinates: { x: 0.7, y: 0.4 },
        isHostile: true,
        hasQuest: false,
      }],
      [],
      [],
    );

    expect(entities[0]).toMatchObject({
      renderMode: 'fallback',
      imageSrc: undefined,
      isHostile: true,
      memberCount: 3,
    });
  });
});