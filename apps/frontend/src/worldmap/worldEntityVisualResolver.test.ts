import { describe, expect, it } from 'vitest';
import { resolveRenderedWorldEntities } from './worldEntityVisualResolver';
import { pickDeterministicBanditPortrait } from '../phaser/assets/actorVisualResolver';

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
        updatedAt: 'now',
        sourceTick: 1,
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
      spriteSrc: 'data:image/png;base64,sprite?v=now',
      imageSrc: 'data:image/png;base64,sprite?v=now',
      hasQuest: true,
      memberCount: 2,
    });
  });

  it('keeps static world sprite ids in the world sprite folder', () => {
    const entities = resolveRenderedWorldEntities(
      [{
        id: 'merchant_1',
        archetypeId: 'merchant',
        kind: 'merchant',
        state: 'traveling',
        spriteId: 'trader_world_sprite',
        portraitId: 'unknown',
        memberCount: 2,
        zoneId: 'city',
        coordinates: { x: 0.5, y: 0.5 },
        isHostile: false,
        hasQuest: false,
        updatedAt: 'now',
        sourceTick: 1,
      }],
      [],
      [],
    );

    expect(entities[0]).toMatchObject({
      renderMode: 'sprite',
      spriteSrc: '/sprites/world/trader_world_sprite.png',
      imageSrc: '/sprites/world/trader_world_sprite.png',
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
        updatedAt: 'now',
        sourceTick: 1,
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

  it('uses deterministic actor portrait fallback for hostile entities without a portrait', () => {
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
        updatedAt: 'now',
        sourceTick: 1,
      }],
      [],
      [],
    );

    expect(entities[0]).toMatchObject({
      renderMode: 'portrait',
      portraitSrc: pickDeterministicBanditPortrait('bandit_1'),
      imageSrc: pickDeterministicBanditPortrait('bandit_1'),
      isHostile: true,
      memberCount: 3,
    });
  });

  it('hides in-city entities from the world-map render list', () => {
    const entities = resolveRenderedWorldEntities(
      [{
        id: 'merchant_hidden_in_city',
        archetypeId: 'merchant',
        kind: 'merchant',
        state: 'in_city',
        spriteId: 'trader_world_sprite',
        portraitId: 'merchant_portrait',
        cityId: 'city_arklein',
        renderOnWorldMap: false,
        renderInCityMap: true,
        memberCount: 1,
        zoneId: 'city_arklein',
        coordinates: { x: 0.5, y: 0.5 },
        isHostile: false,
        hasQuest: false,
        updatedAt: 'now',
        sourceTick: 1,
      }],
      [],
      [],
    );

    expect(entities).toHaveLength(0);
  });
});
