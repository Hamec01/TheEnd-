import type { WorldMapZone } from './zoneEditorTypes';

export interface EditorViewport {
  zoom: number;
  panX: number;
  panY: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
}

export interface ZoneHandleHit {
  type: 'center' | 'radius' | 'point';
  pointIndex?: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function screenToMapNormalized(screenX: number, screenY: number, viewport: EditorViewport): [number, number] {
  const mapX = (screenX - viewport.panX) / viewport.zoom;
  const mapY = (screenY - viewport.panY) / viewport.zoom;
  return [
    clamp(mapX / viewport.imageWidth, 0, 1),
    clamp(mapY / viewport.imageHeight, 0, 1),
  ];
}

export function mapNormalizedToScreen(x: number, y: number, viewport: EditorViewport): [number, number] {
  return [
    x * viewport.imageWidth * viewport.zoom + viewport.panX,
    y * viewport.imageHeight * viewport.zoom + viewport.panY,
  ];
}

export function pointInCircle(point: [number, number], zone: WorldMapZone): boolean {
  if (zone.shape !== 'circle' || zone.x === undefined || zone.y === undefined || zone.radius === undefined) {
    return false;
  }
  return distance(point, [zone.x, zone.y]) <= zone.radius;
}

export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  for (let index = 0, prev = polygon.length - 1; index < polygon.length; prev = index++) {
    const xi = polygon[index][0];
    const yi = polygon[index][1];
    const xj = polygon[prev][0];
    const yj = polygon[prev][1];
    const intersect = ((yi > point[1]) !== (yj > point[1]))
      && (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

export function getZoneCenter(zone: WorldMapZone): [number, number] {
  if (zone.shape === 'circle') {
    return [zone.x ?? 0, zone.y ?? 0];
  }

  const points = zone.points ?? [];
  if (points.length === 0) {
    return [0, 0];
  }
  const total = points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]] as [number, number], [0, 0]);
  return [total[0] / points.length, total[1] / points.length];
}

function zoneArea(zone: WorldMapZone): number {
  if (zone.shape === 'circle') {
    return Math.PI * Math.pow(zone.radius ?? 0, 2);
  }

  const points = zone.points ?? [];
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    area += points[i][0] * next[1] - next[0] * points[i][1];
  }
  return Math.abs(area / 2);
}

export function isPointInZone(point: [number, number], zone: WorldMapZone): boolean {
  if (zone.shape === 'circle') {
    return pointInCircle(point, zone);
  }
  return pointInPolygon(point, zone.points ?? []);
}

export function hitTestZones(zones: WorldMapZone[], point: [number, number]): WorldMapZone | null {
  const hits = zones.filter((zone) => isPointInZone(point, zone));
  if (hits.length === 0) {
    return null;
  }

  const defaultPriorityForType = (type: WorldMapZone['type']): number => {
    switch (type) {
      case 'kingdom_area':
        return 100;
      case 'faction_area':
        return 120;
      case 'danger_area':
        return 200;
      case 'resource_area':
        return 220;
      case 'city_area':
        return 300;
      case 'quest_area':
        return 400;
      case 'hidden_area':
        return 500;
      default:
        return 100;
    }
  };

  hits.sort((a, b) => {
    const priorityDelta = (b.layerPriority ?? defaultPriorityForType(b.type)) - (a.layerPriority ?? defaultPriorityForType(a.type));
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    const areaDelta = zoneArea(a) - zoneArea(b);
    if (Math.abs(areaDelta) > 1e-6) {
      return areaDelta;
    }
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });

  return hits[0] ?? null;
}

export function hitTestHandle(zone: WorldMapZone, point: [number, number], viewport: EditorViewport): ZoneHandleHit | null {
  const tolerance = 10;
  if (zone.shape === 'circle') {
    const center = mapNormalizedToScreen(zone.x ?? 0, zone.y ?? 0, viewport);
    if (distance(center, mapNormalizedToScreen(point[0], point[1], viewport)) <= tolerance) {
      return { type: 'center' };
    }

    const edgePoint = mapNormalizedToScreen((zone.x ?? 0) + (zone.radius ?? 0), zone.y ?? 0, viewport);
    if (distance(edgePoint, mapNormalizedToScreen(point[0], point[1], viewport)) <= tolerance) {
      return { type: 'radius' };
    }

    return null;
  }

  const points = zone.points ?? [];
  for (let index = 0; index < points.length; index += 1) {
    const screenPoint = mapNormalizedToScreen(points[index][0], points[index][1], viewport);
    if (distance(screenPoint, mapNormalizedToScreen(point[0], point[1], viewport)) <= tolerance) {
      return { type: 'point', pointIndex: index };
    }
  }
  return null;
}

export function moveZone(zone: WorldMapZone, deltaX: number, deltaY: number): WorldMapZone {
  if (zone.shape === 'circle') {
    return {
      ...zone,
      x: clamp((zone.x ?? 0) + deltaX, 0, 1),
      y: clamp((zone.y ?? 0) + deltaY, 0, 1),
      updatedAt: Date.now(),
    };
  }

  return {
    ...zone,
    points: (zone.points ?? []).map(([x, y]) => [clamp(x + deltaX, 0, 1), clamp(y + deltaY, 0, 1)] as [number, number]),
    updatedAt: Date.now(),
  };
}

export function resizeCircle(zone: WorldMapZone, point: [number, number]): WorldMapZone {
  if (zone.shape !== 'circle' || zone.x === undefined || zone.y === undefined) {
    return zone;
  }

  return {
    ...zone,
    radius: clamp(distance([zone.x, zone.y], point), 0.0025, 0.5),
    updatedAt: Date.now(),
  };
}

export function movePolygonPoint(zone: WorldMapZone, pointIndex: number, toPoint: [number, number]): WorldMapZone {
  if (zone.shape === 'circle') {
    return zone;
  }

  return {
    ...zone,
    points: (zone.points ?? []).map((point, index) => (
      index === pointIndex ? [clamp(toPoint[0], 0, 1), clamp(toPoint[1], 0, 1)] as [number, number] : point
    )),
    updatedAt: Date.now(),
  };
}

export function deletePolygonPoint(zone: WorldMapZone, pointIndex: number): WorldMapZone {
  if (zone.shape === 'circle') {
    return zone;
  }

  const points = zone.points ?? [];
  if (pointIndex < 0 || pointIndex >= points.length) {
    return zone;
  }

  return {
    ...zone,
    points: points.filter((_, index) => index !== pointIndex),
    updatedAt: Date.now(),
  };
}

export function insertPolygonPointAfter(zone: WorldMapZone, pointIndex: number): WorldMapZone {
  if (zone.shape === 'circle') {
    return zone;
  }

  const points = zone.points ?? [];
  if (points.length < 2) {
    return zone;
  }

  const safeIndex = Math.max(0, Math.min(points.length - 1, pointIndex));
  const a = points[safeIndex];
  const b = points[(safeIndex + 1) % points.length];
  const midpoint: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  const next = points.slice();
  next.splice(safeIndex + 1, 0, midpoint);
  return {
    ...zone,
    points: next,
    updatedAt: Date.now(),
  };
}
