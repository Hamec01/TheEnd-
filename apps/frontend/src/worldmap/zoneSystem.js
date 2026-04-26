import { getZoneCenter, isPointInZone } from './zoneGeometry';
export function getDistanceToZoneCenter(zone, x, y) {
    const [centerX, centerY] = getZoneCenter(zone);
    return Math.hypot(centerX - x, centerY - y);
}
export function isInsideZone(zone, x, y, extraRadius = 0) {
    if (zone.shape === 'circle' && zone.radius !== undefined && zone.x !== undefined && zone.y !== undefined) {
        const radius = Math.max(0.001, zone.radius + extraRadius);
        return Math.hypot(zone.x - x, zone.y - y) <= radius;
    }
    return isPointInZone([x, y], zone);
}
export function detectCurrentZone(zones, x, y) {
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const zone of zones) {
        if (!isInsideZone(zone, x, y)) {
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
export function detectHoverZone(zones, x, y) {
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const zone of zones) {
        if (!isInsideZone(zone, x, y, 0.01)) {
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
