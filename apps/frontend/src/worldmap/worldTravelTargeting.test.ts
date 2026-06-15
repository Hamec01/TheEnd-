import { describe, expect, it } from 'vitest';
import { resolveWorldTravelTarget } from './worldTravelTargeting';
import type { WorldMapZone } from './zoneEditorTypes';

function createCityZone(overrides: Partial<WorldMapZone> = {}): WorldMapZone {
  return {
    id: 'city_arklein',
    name: 'Arklein',
    type: 'city',
    shape: 'circle',
    x: overrides.x ?? 0.5,
    y: overrides.y ?? 0.5,
    radius: overrides.radius ?? 0.06,
    editorLayer: 'locations',
    interactionMode: 'enter',
    playerClickable: true,
    blocksClick: true,
    isVisibleToPlayer: true,
    isDiscovered: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as WorldMapZone;
}

describe('resolveWorldTravelTarget', () => {
  it('keeps a free-point target unchanged when it is already walkable', () => {
    const target = resolveWorldTravelTarget({
      target: {
        point: { x: 0.2, y: 0.3 },
        pendingLocationId: null,
        zoneId: null,
      },
      playerPosition: { x: 0.1, y: 0.1 },
      canMoveTo: () => true,
      gridSize: 32,
    });

    expect(target).toEqual({
      point: { x: 0.2, y: 0.3 },
      pendingLocationId: null,
      zoneId: null,
      adjusted: false,
      adjustmentReason: null,
    });
  });

  it('moves a blocked free-point click to the nearest walkable cell', () => {
    const target = resolveWorldTravelTarget({
      target: {
        point: { x: 0.5, y: 0.5 },
        pendingLocationId: null,
        zoneId: null,
      },
      playerPosition: { x: 0.1, y: 0.1 },
      canMoveTo: (x, y) => !(Math.abs(x - 0.5) < 0.02 && Math.abs(y - 0.5) < 0.02),
      gridSize: 32,
    });

    expect(target).not.toBeNull();
    expect(target?.adjusted).toBe(true);
    expect(target?.adjustmentReason).toBe('nearest_walkable_point');
    expect(target?.point).not.toEqual({ x: 0.5, y: 0.5 });
  });

  it('resolves a city target to the nearest walkable point inside the zone when the center is blocked', () => {
    const city = createCityZone({ x: 0.5, y: 0.5, radius: 0.08 });
    const target = resolveWorldTravelTarget({
      target: {
        point: { x: 0.5, y: 0.5 },
        pendingLocationId: 'city_arklein',
        zoneId: 'city_arklein',
      },
      clickedZone: city,
      playerPosition: { x: 0.15, y: 0.5 },
      canMoveTo: (x, y) => Math.hypot(x - 0.5, y - 0.5) > 0.035,
      gridSize: 64,
    });

    expect(target).not.toBeNull();
    expect(target?.pendingLocationId).toBe('city_arklein');
    expect(target?.zoneId).toBe('city_arklein');
    expect(target?.adjusted).toBe(true);
    expect(target?.adjustmentReason).toBe('nearest_zone_approach');
    expect(Math.hypot((target?.point.x ?? 0) - 0.5, (target?.point.y ?? 0) - 0.5)).toBeLessThanOrEqual(0.08);
  });

  it('returns null when no walkable point exists inside the clicked zone', () => {
    const city = createCityZone({ x: 0.5, y: 0.5, radius: 0.05 });
    const target = resolveWorldTravelTarget({
      target: {
        point: { x: 0.5, y: 0.5 },
        pendingLocationId: 'city_arklein',
        zoneId: 'city_arklein',
      },
      clickedZone: city,
      playerPosition: { x: 0.2, y: 0.2 },
      canMoveTo: () => false,
      gridSize: 32,
    });

    expect(target).toBeNull();
  });
});
