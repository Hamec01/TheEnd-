import type { PaintedRegion, RegionBrushSize, RegionCell, RegionToolMode, RegionType } from './zoneEditorTypes';

export const REGION_GRID_SIZE = 256;

export const REGION_TYPE_COLORS: Record<RegionType, string> = {
  walkable: 'rgba(140, 194, 132, 0.35)',
  blocked: 'rgba(204, 68, 68, 0.35)',
  water: 'rgba(74, 124, 219, 0.35)',
  road: 'rgba(184, 147, 89, 0.35)',
  danger: 'rgba(192, 112, 42, 0.35)',
  trigger: 'rgba(84, 178, 117, 0.35)',
};

export interface RegionPaintSettings {
  toolMode: RegionToolMode;
  regionType: RegionType;
  brushSize: RegionBrushSize;
}

function clampCell(value: number): number {
  return Math.max(0, Math.min(REGION_GRID_SIZE - 1, value));
}

export function mapPointToRegionCell(point: [number, number]): RegionCell {
  return {
    x: clampCell(Math.floor(point[0] * REGION_GRID_SIZE)),
    y: clampCell(Math.floor(point[1] * REGION_GRID_SIZE)),
  };
}

export function regionCellKey(cell: RegionCell): string {
  return `${cell.x}:${cell.y}`;
}

export function bresenhamCells(a: RegionCell, b: RegionCell): RegionCell[] {
  const cells: RegionCell[] = [];
  let x0 = a.x;
  let y0 = a.y;
  const x1 = b.x;
  const y1 = b.y;

  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    cells.push({ x: clampCell(x0), y: clampCell(y0) });
    if (x0 === x1 && y0 === y1) {
      break;
    }

    const e2 = err * 2;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }

  return cells;
}

export function brushCells(center: RegionCell, size: RegionBrushSize): RegionCell[] {
  const result: RegionCell[] = [];
  const radius = Math.floor(size / 2);
  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      result.push({ x: clampCell(center.x + ox), y: clampCell(center.y + oy) });
    }
  }
  return result;
}

export function applyBrushAlongLine(from: RegionCell, to: RegionCell, size: RegionBrushSize, mode: RegionToolMode): RegionCell[] {
  const line = mode === 'pencil' ? bresenhamCells(from, to) : [to];
  const byKey = new Map<string, RegionCell>();

  for (const cell of line) {
    for (const brushCell of brushCells(cell, size)) {
      byKey.set(regionCellKey(brushCell), brushCell);
    }
  }

  return [...byKey.values()];
}

function cloneRegions(regions: PaintedRegion[]): PaintedRegion[] {
  return regions.map((region) => ({
    ...region,
    cells: region.cells.map((cell) => ({ ...cell })),
  }));
}

function regionIdForType(type: RegionType): string {
  return `region-${type}`;
}

function regionNameForType(type: RegionType): string {
  switch (type) {
    case 'blocked':
      return 'Blocked Regions';
    case 'water':
      return 'Water Regions';
    case 'road':
      return 'Road Regions';
    case 'danger':
      return 'Danger Regions';
    case 'trigger':
      return 'Trigger Regions';
    case 'walkable':
    default:
      return 'Walkable Regions';
  }
}

export function applyRegionPaint(
  regions: PaintedRegion[],
  cells: RegionCell[],
  settings: RegionPaintSettings,
): PaintedRegion[] {
  const next = cloneRegions(regions);
  const incoming = new Map<string, RegionCell>();
  for (const cell of cells) {
    incoming.set(regionCellKey(cell), cell);
  }

  if (incoming.size === 0) {
    return next;
  }

  for (const region of next) {
    region.cells = region.cells.filter((cell) => !incoming.has(regionCellKey(cell)));
  }

  if (settings.toolMode === 'eraser') {
    return next.filter((region) => region.cells.length > 0);
  }

  const regionId = regionIdForType(settings.regionType);
  const existing = next.find((region) => region.id === regionId);
  const target = existing ?? {
    id: regionId,
    name: regionNameForType(settings.regionType),
    type: settings.regionType,
    cells: [],
  };

  const targetByKey = new Map<string, RegionCell>(target.cells.map((cell) => [regionCellKey(cell), cell]));
  for (const cell of incoming.values()) {
    targetByKey.set(regionCellKey(cell), cell);
  }

  target.cells = [...targetByKey.values()];
  if (!existing) {
    next.push(target);
  }

  return next.filter((region) => region.cells.length > 0);
}

export function getPaintedRegionCellMap(regions: PaintedRegion[]): Map<string, { regionId: string; regionType: RegionType }> {
  const map = new Map<string, { regionId: string; regionType: RegionType }>();
  for (const region of regions) {
    for (const cell of region.cells) {
      map.set(regionCellKey(cell), { regionId: region.id, regionType: region.type });
    }
  }
  return map;
}

export function isBlockedRegionType(regionType: RegionType): boolean {
  return regionType === 'blocked' || regionType === 'water';
}

export function canMoveToMapPoint(regions: PaintedRegion[], point: [number, number]): boolean {
  const cell = mapPointToRegionCell(point);
  const key = regionCellKey(cell);
  const map = getPaintedRegionCellMap(regions);
  const match = map.get(key);
  if (!match) {
    return true;
  }

  return !isBlockedRegionType(match.regionType);
}
