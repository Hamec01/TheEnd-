import type { MovementValidator } from './movementSystem';
import { REGION_GRID_SIZE } from './regionPaintSystem';
import { clamp, getZoneCenter, isPointInZone } from './zoneGeometry';
import type { WorldMapZone } from './zoneEditorTypes';

export interface RequestedWorldMoveTarget {
  point: { x: number; y: number };
  pendingLocationId: string | null;
  zoneId?: string | null;
}

export interface ResolvedWorldMoveTarget extends RequestedWorldMoveTarget {
  point: { x: number; y: number };
  adjusted: boolean;
  adjustmentReason: 'nearest_walkable_point' | 'nearest_zone_approach' | null;
}

interface ResolveWorldTravelTargetParams {
  target: RequestedWorldMoveTarget;
  clickedZone?: WorldMapZone | null;
  playerPosition: { x: number; y: number };
  canMoveTo: MovementValidator;
  gridSize?: number;
}

function pointDistance(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function normalizePoint(point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: clamp(point.x, 0, 1),
    y: clamp(point.y, 0, 1),
  };
}

function getZoneBounds(zone: WorldMapZone): { left: number; right: number; top: number; bottom: number } {
  if (zone.shape === 'circle') {
    const radius = Number.isFinite(zone.radius) && (zone.radius ?? 0) > 0 ? Number(zone.radius) : 0.03;
    return {
      left: clamp((zone.x ?? 0) - radius, 0, 1),
      right: clamp((zone.x ?? 0) + radius, 0, 1),
      top: clamp((zone.y ?? 0) - radius, 0, 1),
      bottom: clamp((zone.y ?? 0) + radius, 0, 1),
    };
  }

  const points = zone.points ?? [];
  if (points.length === 0) {
    const [x, y] = getZoneCenter(zone);
    return { left: x, right: x, top: y, bottom: y };
  }

  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const [x, y] of points) {
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }

  return {
    left: clamp(left, 0, 1),
    right: clamp(right, 0, 1),
    top: clamp(top, 0, 1),
    bottom: clamp(bottom, 0, 1),
  };
}

function toCellIndex(value: number, gridSize: number): number {
  return Math.max(0, Math.min(gridSize - 1, Math.floor(clamp(value, 0, 1) * gridSize)));
}

function toCellCenter(index: number, gridSize: number): number {
  return clamp((index + 0.5) / gridSize, 0, 1);
}

function findNearestWalkablePoint(
  point: { x: number; y: number },
  canMoveTo: MovementValidator,
  gridSize: number,
  maxRadiusCells = 160,
): { x: number; y: number } | null {
  const normalizedPoint = normalizePoint(point);
  if (canMoveTo(normalizedPoint.x, normalizedPoint.y)) {
    return normalizedPoint;
  }

  const startCellX = toCellIndex(normalizedPoint.x, gridSize);
  const startCellY = toCellIndex(normalizedPoint.y, gridSize);

  for (let radius = 1; radius <= maxRadiusCells; radius += 1) {
    let best: { x: number; y: number } | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) {
          continue;
        }

        const cellX = startCellX + offsetX;
        const cellY = startCellY + offsetY;
        if (cellX < 0 || cellX >= gridSize || cellY < 0 || cellY >= gridSize) {
          continue;
        }

        const candidate = {
          x: toCellCenter(cellX, gridSize),
          y: toCellCenter(cellY, gridSize),
        };
        if (!canMoveTo(candidate.x, candidate.y)) {
          continue;
        }

        const distance = pointDistance(candidate, normalizedPoint);
        if (distance < bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      }
    }

    if (best) {
      return best;
    }
  }

  return null;
}

function findNearestWalkableZonePoint(
  zone: WorldMapZone,
  preferredPoint: { x: number; y: number },
  playerPosition: { x: number; y: number },
  canMoveTo: MovementValidator,
  gridSize: number,
): { x: number; y: number } | null {
  const normalizedPreferred = normalizePoint(preferredPoint);
  if (isPointInZone([normalizedPreferred.x, normalizedPreferred.y], zone) && canMoveTo(normalizedPreferred.x, normalizedPreferred.y)) {
    return normalizedPreferred;
  }

  const [centerX, centerY] = getZoneCenter(zone);
  const centerPoint = normalizePoint({ x: centerX, y: centerY });
  if (isPointInZone([centerPoint.x, centerPoint.y], zone) && canMoveTo(centerPoint.x, centerPoint.y)) {
    return centerPoint;
  }

  const bounds = getZoneBounds(zone);
  const minCellX = toCellIndex(bounds.left, gridSize);
  const maxCellX = toCellIndex(bounds.right, gridSize);
  const minCellY = toCellIndex(bounds.top, gridSize);
  const maxCellY = toCellIndex(bounds.bottom, gridSize);

  let best: { x: number; y: number } | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      const candidate = {
        x: toCellCenter(cellX, gridSize),
        y: toCellCenter(cellY, gridSize),
      };

      if (!isPointInZone([candidate.x, candidate.y], zone) || !canMoveTo(candidate.x, candidate.y)) {
        continue;
      }

      const score = pointDistance(candidate, playerPosition) + pointDistance(candidate, centerPoint) * 0.15;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
  }

  return best;
}

export function resolveWorldTravelTarget(params: ResolveWorldTravelTargetParams): ResolvedWorldMoveTarget | null {
  const {
    target,
    clickedZone,
    playerPosition,
    canMoveTo,
    gridSize = REGION_GRID_SIZE,
  } = params;

  const normalizedTargetPoint = normalizePoint(target.point);
  const normalizedTarget: RequestedWorldMoveTarget = {
    ...target,
    point: normalizedTargetPoint,
    zoneId: target.zoneId ?? clickedZone?.id ?? null,
  };

  if (!clickedZone) {
    const directPoint = findNearestWalkablePoint(normalizedTargetPoint, canMoveTo, gridSize);
    if (!directPoint) {
      return null;
    }

    return {
      ...normalizedTarget,
      point: directPoint,
      adjusted: pointDistance(directPoint, normalizedTargetPoint) > 0.0005,
      adjustmentReason: pointDistance(directPoint, normalizedTargetPoint) > 0.0005
        ? 'nearest_walkable_point'
        : null,
    };
  }

  const zonePoint = findNearestWalkableZonePoint(
    clickedZone,
    normalizedTargetPoint,
    normalizePoint(playerPosition),
    canMoveTo,
    gridSize,
  );
  if (!zonePoint) {
    return null;
  }

  return {
    ...normalizedTarget,
    point: zonePoint,
    adjusted: pointDistance(zonePoint, normalizedTargetPoint) > 0.0005,
    adjustmentReason: pointDistance(zonePoint, normalizedTargetPoint) > 0.0005
      ? 'nearest_zone_approach'
      : null,
  };
}
