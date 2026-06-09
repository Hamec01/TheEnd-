import type { BiomeDefinition, TreeDefinition } from '../services/content/models';
import type { WorldMapZone } from './zoneEditorTypes';

export function resolveForestZoneTreeIds(
  zone: WorldMapZone,
  biomes: BiomeDefinition[] | undefined,
): string[] {
  if (Array.isArray(zone.treePool) && zone.treePool.length > 0) {
    return zone.treePool;
  }

  const biome = biomes?.find((entry) => entry.id === zone.biomeId);
  if (!biome) {
    return [];
  }

  const forestPool = biome.resourcePools?.forest;
  if (Array.isArray(forestPool) && forestPool.length > 0) {
    return forestPool;
  }

  if (Array.isArray(biome.defaultTreePool) && biome.defaultTreePool.length > 0) {
    return biome.defaultTreePool;
  }

  return [];
}

export function formatForestZoneTreesLabel(
  zone: WorldMapZone,
  biomes: BiomeDefinition[] | undefined,
  trees: TreeDefinition[] | undefined,
): string {
  const treeIds = resolveForestZoneTreeIds(zone, biomes);
  if (treeIds.length === 0) {
    return 'Нет доступных деревьев';
  }

  return treeIds
    .map((treeId) => {
      const tree = trees?.find((entry) => entry.id === treeId);
      if (tree?.name) {
        return tree.name;
      }
      return treeId.replace(/^tree_/, '').replace(/_/g, ' ');
    })
    .join(', ');
}
