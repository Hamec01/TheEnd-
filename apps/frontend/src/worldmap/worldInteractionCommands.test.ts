import { describe, expect, it } from 'vitest';
import { detectCurrentZone } from './zoneSystem';
import { resolveWorldClickInteraction, resolveWorldHoverZone } from './worldInteractionCommands';
import type { RenderedWorldEntity } from './worldSceneTypes';
import type { WorldMapZone } from './zoneEditorTypes';

function createCircleZone(overrides: Partial<WorldMapZone> & Pick<WorldMapZone, 'id' | 'name' | 'type'>): WorldMapZone {
  return {
    id: overrides.id,
    name: overrides.name,
    type: overrides.type,
    shape: 'circle',
    x: overrides.x ?? 0.5,
    y: overrides.y ?? 0.5,
    radius: overrides.radius ?? 0.05,
    editorLayer: overrides.editorLayer ?? 'zones',
    interactionMode: overrides.interactionMode,
    playerClickable: overrides.playerClickable,
    blocksClick: overrides.blocksClick,
    passiveEffects: overrides.passiveEffects,
    isVisibleToPlayer: overrides.isVisibleToPlayer ?? true,
    isDiscovered: overrides.isDiscovered ?? true,
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
  } as WorldMapZone;
}

function createRenderedEntity(overrides: Partial<RenderedWorldEntity> & Pick<RenderedWorldEntity, 'id' | 'archetypeId' | 'state' | 'coordinates' | 'spriteId' | 'renderMode' | 'isHostile' | 'hasQuest' | 'memberCount' | 'label' | 'title'>): RenderedWorldEntity {
  return {
    id: overrides.id,
    archetypeId: overrides.archetypeId,
    kind: overrides.kind,
    state: overrides.state,
    coordinates: overrides.coordinates,
    spriteId: overrides.spriteId,
    spriteSrc: overrides.spriteSrc,
    portraitSrc: overrides.portraitSrc,
    imageSrc: overrides.imageSrc,
    renderMode: overrides.renderMode,
    isHostile: overrides.isHostile,
    hasQuest: overrides.hasQuest,
    memberCount: overrides.memberCount,
    label: overrides.label,
    title: overrides.title,
  };
}

describe('world interaction command mapping', () => {
  it('keeps hover on the nearest visible zone while current zone skips passive overlays', () => {
    const passiveArea = createCircleZone({
      id: 'city_area',
      name: 'City Area',
      type: 'city_area',
      radius: 0.08,
      playerClickable: false,
      passiveEffects: true,
    });
    const city = createCircleZone({
      id: 'city',
      name: 'City',
      type: 'city',
      editorLayer: 'locations',
      interactionMode: 'enter',
      playerClickable: true,
      blocksClick: true,
      radius: 0.03,
    });
    const point = { x: 0.5, y: 0.5 };

    expect(resolveWorldHoverZone([passiveArea, city], point)?.id).toBe('city_area');
    expect(detectCurrentZone([passiveArea, city], point.x, point.y)?.id).toBe('city');
  });

  it('maps empty-map clicks to move_to_point only', () => {
    const resolution = resolveWorldClickInteraction({
      point: { x: 0.2, y: 0.3 },
      zones: [],
      activeEntities: [],
    });

    expect(resolution.clickedZone).toBeNull();
    expect(resolution.clickedEntity).toBeNull();
    expect(resolution.commands).toEqual([{ type: 'move_to_point', point: { x: 0.2, y: 0.3 }, pendingLocationId: null }]);
    expect(resolution.moveTarget).toEqual({ point: { x: 0.2, y: 0.3 }, pendingLocationId: null });
  });

  it('maps regular zone clicks to interact plus move-to-center', () => {
    const zone = createCircleZone({
      id: 'camp',
      name: 'Camp',
      type: 'landmark',
      x: 0.4,
      y: 0.6,
      radius: 0.05,
      playerClickable: true,
      interactionMode: 'inspect',
    });

    const resolution = resolveWorldClickInteraction({
      point: { x: 0.39, y: 0.61 },
      zones: [zone],
      activeEntities: [],
    });

    expect(resolution.clickedZone?.id).toBe('camp');
    expect(resolution.commands).toEqual([
      { type: 'interact_zone', zoneId: 'camp', point: { x: 0.39, y: 0.61 } },
      { type: 'move_to_point', point: { x: 0.4, y: 0.6 }, pendingLocationId: null },
    ]);
    expect(resolution.moveTarget).toEqual({ point: { x: 0.4, y: 0.6 }, pendingLocationId: null });
  });

  it('maps city clicks to interact plus move-to-center with pending location gate', () => {
    const city = createCircleZone({
      id: 'city_arklein',
      name: 'Arklein',
      type: 'city',
      x: 0.44,
      y: 0.5,
      radius: 0.04,
      editorLayer: 'locations',
      interactionMode: 'enter',
      playerClickable: true,
      blocksClick: true,
    });

    const resolution = resolveWorldClickInteraction({
      point: { x: 0.45, y: 0.5 },
      zones: [city],
      activeEntities: [],
    });

    expect(resolution.clickedZone?.id).toBe('city_arklein');
    expect(resolution.commands).toEqual([
      { type: 'interact_zone', zoneId: 'city_arklein', point: { x: 0.45, y: 0.5 } },
      { type: 'move_to_point', point: { x: 0.44, y: 0.5 }, pendingLocationId: 'city_arklein' },
    ]);
    expect(resolution.moveTarget).toEqual({ point: { x: 0.44, y: 0.5 }, pendingLocationId: 'city_arklein' });
  });

  it('prefers active world entity interaction over zone movement when click is in entity radius', () => {
    const zone = createCircleZone({
      id: 'camp',
      name: 'Camp',
      type: 'landmark',
      x: 0.4,
      y: 0.6,
      radius: 0.05,
      playerClickable: true,
      interactionMode: 'inspect',
    });

    const resolution = resolveWorldClickInteraction({
      point: { x: 0.401, y: 0.601 },
      screenPointPx: { x: 401, y: 601 },
      viewportPx: { width: 1000, height: 1000 },
      camera: { left: 0, top: 0, width: 1, height: 1 },
      zones: [zone],
      activeEntities: [
        {
          id: 'entity_1',
          archetypeId: 'merchant_1',
          kind: 'merchant',
          state: 'traveling',
          spriteId: 'merchant_cart',
          memberCount: 1,
          zoneId: 'camp',
          coordinates: { x: 0.4, y: 0.6 },
          isHostile: false,
          hasQuest: false,
          updatedAt: 'now',
          sourceTick: 1,
        },
      ],
      renderedEntities: [createRenderedEntity({
        id: 'entity_1',
        archetypeId: 'merchant_1',
        state: 'traveling',
        coordinates: { x: 0.4, y: 0.6 },
        spriteId: 'merchant_cart',
        imageSrc: '/sprites/world/merchant_cart.png',
        renderMode: 'sprite',
        isHostile: false,
        hasQuest: false,
        memberCount: 1,
        label: 'Merchant',
        title: 'Merchant',
      })],
    });

    expect(resolution.clickedEntity?.id).toBe('entity_1');
    expect(resolution.commands).toEqual([{ type: 'interact_world_entity', entityId: 'entity_1' }]);
    expect(resolution.moveTarget).toBeNull();
  });

  it('does not interact with entities hidden from the world map and lets the city click win', () => {
    const city = createCircleZone({
      id: 'city_arklein',
      name: 'Arklein',
      type: 'city',
      x: 0.44,
      y: 0.5,
      radius: 0.04,
      editorLayer: 'locations',
      interactionMode: 'enter',
      playerClickable: true,
      blocksClick: true,
    });

    const resolution = resolveWorldClickInteraction({
      point: { x: 0.44, y: 0.5 },
      screenPointPx: { x: 440, y: 500 },
      viewportPx: { width: 1000, height: 1000 },
      camera: { left: 0, top: 0, width: 1, height: 1 },
      zones: [city],
      activeEntities: [{
        id: 'entity_city_merchant',
        archetypeId: 'merchant_arklein',
        kind: 'merchant',
        state: 'in_city',
        spriteId: 'trader_world_sprite',
        cityId: 'city_arklein',
        renderOnWorldMap: false,
        renderInCityMap: true,
        memberCount: 1,
        zoneId: 'city_arklein',
        coordinates: { x: 0.44, y: 0.5 },
        isHostile: false,
        hasQuest: false,
        updatedAt: 'now',
        sourceTick: 1,
      }],
      renderedEntities: [],
    });

    expect(resolution.clickedEntity).toBeNull();
    expect(resolution.clickedZone?.id).toBe('city_arklein');
    expect(resolution.commands).toEqual([
      { type: 'interact_zone', zoneId: 'city_arklein', point: { x: 0.44, y: 0.5 } },
      { type: 'move_to_point', point: { x: 0.44, y: 0.5 }, pendingLocationId: 'city_arklein' },
    ]);
  });

  it('maps exact entity marker clicks to interact_world_entity in screen space', () => {
    const resolution = resolveWorldClickInteraction({
      point: { x: 0.5, y: 0.5 },
      screenPointPx: { x: 500, y: 500 },
      viewportPx: { width: 1000, height: 1000 },
      camera: { left: 0, top: 0, width: 1, height: 1 },
      zones: [],
      activeEntities: [{
        id: 'entity_1',
        archetypeId: 'bandit_1',
        kind: 'bandit',
        state: 'resting',
        spriteId: 'bandit_marker',
        memberCount: 1,
        zoneId: 'road',
        coordinates: { x: 0.5, y: 0.5 },
        isHostile: true,
        hasQuest: false,
        updatedAt: 'now',
        sourceTick: 1,
      }],
      renderedEntities: [createRenderedEntity({
        id: 'entity_1',
        archetypeId: 'bandit_1',
        kind: 'bandit',
        state: 'resting',
        coordinates: { x: 0.5, y: 0.5 },
        spriteId: 'bandit_marker',
        portraitSrc: '/sprites/actor/bandit_01.png',
        imageSrc: '/sprites/actor/bandit_01.png',
        renderMode: 'portrait',
        isHostile: true,
        hasQuest: false,
        memberCount: 1,
        label: 'Bandit',
        title: 'Bandit',
      })],
    });

    expect(resolution.commands).toEqual([{ type: 'interact_world_entity', entityId: 'entity_1' }]);
    expect(resolution.clickedEntity?.id).toBe('entity_1');
  });

  it('treats a near-miss beside an entity marker as no entity interaction', () => {
    const resolution = resolveWorldClickInteraction({
      point: { x: 0.523, y: 0.5 },
      screenPointPx: { x: 523, y: 500 },
      viewportPx: { width: 1000, height: 1000 },
      camera: { left: 0, top: 0, width: 1, height: 1 },
      zones: [],
      activeEntities: [{
        id: 'entity_1',
        archetypeId: 'bandit_1',
        kind: 'bandit',
        state: 'resting',
        spriteId: 'bandit_marker',
        memberCount: 1,
        zoneId: 'road',
        coordinates: { x: 0.5, y: 0.5 },
        isHostile: true,
        hasQuest: false,
        updatedAt: 'now',
        sourceTick: 1,
      }],
      renderedEntities: [createRenderedEntity({
        id: 'entity_1',
        archetypeId: 'bandit_1',
        kind: 'bandit',
        state: 'resting',
        coordinates: { x: 0.5, y: 0.5 },
        spriteId: 'bandit_marker',
        portraitSrc: '/sprites/actor/bandit_01.png',
        imageSrc: '/sprites/actor/bandit_01.png',
        renderMode: 'portrait',
        isHostile: true,
        hasQuest: false,
        memberCount: 1,
        label: 'Bandit',
        title: 'Bandit',
      })],
    });

    expect(resolution.clickedEntity).toBeNull();
    expect(resolution.commands).toEqual([{ type: 'move_to_point', point: { x: 0.523, y: 0.5 }, pendingLocationId: null }]);
  });

  it('keeps city priority when a click is inside the city but outside the overlapping entity marker', () => {
    const city = createCircleZone({
      id: 'city_arklein',
      name: 'Arklein',
      type: 'city',
      x: 0.5,
      y: 0.5,
      radius: 0.06,
      editorLayer: 'locations',
      interactionMode: 'enter',
      playerClickable: true,
      blocksClick: true,
    });

    const resolution = resolveWorldClickInteraction({
      point: { x: 0.524, y: 0.5 },
      screenPointPx: { x: 524, y: 500 },
      viewportPx: { width: 1000, height: 1000 },
      camera: { left: 0, top: 0, width: 1, height: 1 },
      zones: [city],
      activeEntities: [{
        id: 'entity_1',
        archetypeId: 'bandit_1',
        kind: 'bandit',
        state: 'resting',
        spriteId: 'bandit_marker',
        memberCount: 1,
        zoneId: 'city_arklein',
        coordinates: { x: 0.5, y: 0.5 },
        isHostile: true,
        hasQuest: false,
        updatedAt: 'now',
        sourceTick: 1,
      }],
      renderedEntities: [createRenderedEntity({
        id: 'entity_1',
        archetypeId: 'bandit_1',
        kind: 'bandit',
        state: 'resting',
        coordinates: { x: 0.5, y: 0.5 },
        spriteId: 'bandit_marker',
        portraitSrc: '/sprites/actor/bandit_01.png',
        imageSrc: '/sprites/actor/bandit_01.png',
        renderMode: 'portrait',
        isHostile: true,
        hasQuest: false,
        memberCount: 1,
        label: 'Bandit',
        title: 'Bandit',
      })],
    });

    expect(resolution.clickedEntity).toBeNull();
    expect(resolution.clickedZone?.id).toBe('city_arklein');
    expect(resolution.moveTarget).toEqual({ point: { x: 0.5, y: 0.5 }, pendingLocationId: 'city_arklein' });
  });
});
