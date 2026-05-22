import type { WorldMapZone } from './zoneEditorTypes';

export function resolveVisibleWorldOverlayZones(
  zones: WorldMapZone[],
  type: WorldMapZone['type'],
): WorldMapZone[] {
  return zones.filter((zone) => (
    zone.type === type
    && zone.isVisibleToPlayer !== false
    && zone.isDiscovered !== false
  ));
}