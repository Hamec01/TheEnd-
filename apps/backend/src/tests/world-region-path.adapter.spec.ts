import { describe, expect, it } from 'vitest';
import type { WorldMapContent } from '../content/content.types';
import { WorldRegionPathAdapter } from '../worldsim/world-region-path.adapter';

function createWorldMap(regions: WorldMapContent['regions']): WorldMapContent {
  return {
    zones: [],
    regions,
    updatedAt: new Date().toISOString(),
  };
}

describe('WorldRegionPathAdapter', () => {
  it('treats blocked and water as impassable and routes around them', () => {
    const blockedWall = [] as Array<{ x: number; y: number }>;
    for (let y = 2; y <= 8; y += 1) {
      if (y === 5) {
        continue;
      }
      blockedWall.push({ x: 5, y });
    }

    const worldMap = createWorldMap([
      {
        id: 'blocked-wall',
        name: 'wall',
        type: 'blocked',
        cells: blockedWall,
      },
      {
        id: 'water-pool',
        name: 'water',
        type: 'water',
        cells: [{ x: 7, y: 5 }],
      },
    ]);

    const adapter = new WorldRegionPathAdapter(worldMap);
    const path = adapter.buildPolyline({ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 });

    expect(path).not.toBeNull();

    const blockedCell = { x: 5, y: 4 };
    const waterCell = { x: 7, y: 5 };
    expect(adapter.isPassable(blockedCell)).toBe(false);
    expect(adapter.isPassable(waterCell)).toBe(false);
  });

  it('returns null when all neighbors are blocked', () => {
    const ring: Array<{ x: number; y: number }> = [];
    const center = { x: 10, y: 10 };
    for (let y = center.y - 1; y <= center.y + 1; y += 1) {
      for (let x = center.x - 1; x <= center.x + 1; x += 1) {
        if (x === center.x && y === center.y) {
          continue;
        }
        ring.push({ x, y });
      }
    }

    const worldMap = createWorldMap([
      {
        id: 'ring',
        name: 'ring',
        type: 'blocked',
        cells: ring,
      },
    ]);

    const adapter = new WorldRegionPathAdapter(worldMap);
    const path = adapter.buildPolyline(
      adapter.cellToWorld(center),
      { x: 0.95, y: 0.95 },
    );

    expect(path).toBeNull();
  });
});
