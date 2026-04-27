import type { Zone } from './worldMapNodes';
import { getZoneCenter, isPointInZone } from './zoneGeometry';

function getZoneInteractionPadding(zone: Zone): number {
  switch (zone.type) {
    case 'city':
      return 0.035;
    case 'settlement':
      return 0.025;
    case 'profession':
    case 'resource':
      return 0.015;
    default:
      return 0;
  }
}

export function getDistanceToZoneCenter(zone: Zone, x: number, y: number): number {
  const [centerX, centerY] = getZoneCenter(zone);
  return Math.hypot(centerX - x, centerY - y);
}

export function isInsideZone(zone: Zone, x: number, y: number, extraRadius = 0): boolean {
  if (zone.shape === 'circle' && zone.radius !== undefined && zone.x !== undefined && zone.y !== undefined) {
    const radius = Math.max(0.001, zone.radius + extraRadius);
    return Math.hypot(zone.x - x, zone.y - y) <= radius;
  }

  return isPointInZone([x, y], zone);
}

export function detectCurrentZone(zones: Zone[], x: number, y: number): Zone | null {
  let nearest: Zone | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const zone of zones) {
    const extraRadius = zone.type === 'city' ? 0 : getZoneInteractionPadding(zone);
    if (!isInsideZone(zone, x, y, extraRadius)) {
      continue;
    }

    const distance = getDistanceToZoneCenter(zone, x, y);
    if (distance < nearestDistance) {
      nearest = zone;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function detectHoverZone(zones: Zone[], x: number, y: number): Zone | null {
  let nearest: Zone | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const zone of zones) {
    const extraRadius = zone.type === 'city' ? 0.002 : 0.01 + getZoneInteractionPadding(zone);
    if (!isInsideZone(zone, x, y, extraRadius)) {
      continue;
    }

    const distance = getDistanceToZoneCenter(zone, x, y);
    if (distance < nearestDistance) {
      nearest = zone;
      nearestDistance = distance;
    }
  }

  return nearest;
}
