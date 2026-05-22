import { describe, expect, it } from 'vitest';
import { buildWorldSceneSnapshot } from './worldSceneAdapter';

describe('buildWorldSceneSnapshot', () => {
  it('keeps shared world parity fields aligned in the snapshot shape', () => {
    const snapshot = buildWorldSceneSnapshot({
      playerPosition: { x: 0.2, y: 0.3 },
      playerState: 'moving',
      playerAvatarUrl: '/player.png',
      movementTarget: { x: 0.4, y: 0.5 },
      movementLocked: true,
      movementLockReason: 'dialogue',
      controlScheme: 'arrows',
      zones: [],
      currentZoneId: 'zone_a',
      hoverZoneId: 'zone_b',
      questMarkers: [],
      npcMarkers: [],
      worldSnapshot: {
        activeEntities: [{
          id: 'entity_1',
          archetypeId: 'merchant_1',
          kind: 'merchant',
          state: 'traveling',
          spriteId: 'merchant_cart',
          memberCount: 1,
          zoneId: 'zone_a',
          coordinates: { x: 0.4, y: 0.5 },
          isHostile: false,
          hasQuest: true,
        }],
        cityMarkets: [],
        events: [],
      },
      renderedActiveEntities: [{
        id: 'entity_1',
        archetypeId: 'merchant_1',
        kind: 'merchant',
        state: 'traveling',
        coordinates: { x: 0.4, y: 0.5 },
        spriteId: 'merchant_cart',
        spriteSrc: '/sprites/world/merchant_cart.png',
        portraitSrc: undefined,
        imageSrc: '/sprites/world/merchant_cart.png',
        renderMode: 'sprite',
        isHostile: false,
        hasQuest: true,
        memberCount: 1,
        label: 'Merchant',
        title: 'Merchant (traveling)',
      }],
      lockedWorldEntityId: 'entity_1',
      lockedWorldEntityCoordinates: { x: 0.41, y: 0.49 },
      discoveryMarkers: [],
    });

    expect(snapshot.rendererKind).toBe('shared');
    expect(snapshot.player).toMatchObject({
      position: { x: 0.2, y: 0.3 },
      state: 'moving',
      avatarUrl: '/player.png',
      movementTarget: { x: 0.4, y: 0.5 },
      movementLocked: true,
      movementLockReason: 'dialogue',
      controlScheme: 'arrows',
    });
    expect(snapshot.currentZoneId).toBe('zone_a');
    expect(snapshot.hoverZoneId).toBe('zone_b');
    expect(snapshot.activeEntities).toHaveLength(1);
    expect(snapshot.renderedActiveEntities).toHaveLength(1);
    expect(snapshot.lockedWorldEntityId).toBe('entity_1');
    expect(snapshot.lockedWorldEntityCoordinates).toEqual({ x: 0.41, y: 0.49 });
    expect(snapshot.version).toBeGreaterThan(0);
    expect(snapshot.sourceTick).toBeGreaterThan(0);
  });
});