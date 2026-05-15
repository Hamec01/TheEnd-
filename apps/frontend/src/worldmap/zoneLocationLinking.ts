import type { ContentSnapshot } from '../services/content/contentApi';
import type { WorldLocation } from '../types/location';
import type { WorldMapZone } from './zoneEditorTypes';

export function getZoneLinkedLocation(
  zone: Pick<WorldMapZone, 'linkedLocationId' | 'linkedLocation'>,
  content: Pick<ContentSnapshot, 'locations'>,
): WorldLocation | null {
  const locationId = zone.linkedLocationId ?? zone.linkedLocation;
  if (!locationId) {
    return null;
  }
  return content.locations.find((location) => location.id === locationId) ?? null;
}

export function getLocationActiveState(location: WorldLocation) {
  if (!location.currentState || !location.stateVariants?.length) {
    return null;
  }
  return location.stateVariants.find((state) => state.stateKey === location.currentState) ?? null;
}

export function isLinkedLocationVisibleToPlayer(location: WorldLocation): boolean {
  const activeState = getLocationActiveState(location);
  if (location.isHidden === true) {
    return false;
  }
  if (activeState?.visibleOnMap === false) {
    return false;
  }
  return true;
}

export function canEnterLinkedLocation(location: WorldLocation): boolean {
  const activeState = getLocationActiveState(location);
  if (activeState?.canEnter === false) {
    return false;
  }
  return true;
}
