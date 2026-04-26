import { ZONE_COLORS } from './zoneColors';
import type { WorldMapZone, ZoneType } from './zoneEditorTypes';

const BASE_TIMESTAMP = 1_713_484_800_000;

function circleZone(zone: Omit<WorldMapZone, 'shape' | 'createdAt' | 'updatedAt'> & { x: number; y: number; radius: number }): WorldMapZone {
  return {
    ...zone,
    shape: 'circle',
    createdAt: BASE_TIMESTAMP,
    updatedAt: BASE_TIMESTAMP,
  };
}

export type Zone = WorldMapZone;
export type { ZoneType };
export { ZONE_COLORS };

export const WORLD_MAP_ZONES: WorldMapZone[] = [
  circleZone({
    id: 'arklein',
    name: 'Арклейн',
    type: 'city',
    x: 0.4468848060321677,
    y: 0.5077146500192697,
    radius: 0.00801239402054759,
    description: 'город Арклейн',
    tooltip: 'город Арклейн',
    dangerLevel: 1,
    recommendedLevel: 1,
    targetScene: 'city_arklein',
    isDiscovered: true,
    isVisibleToPlayer: true,
    isSafeZone: true,
    allowPvP: false,
    faction: 'Арклейн',
  }),
];
