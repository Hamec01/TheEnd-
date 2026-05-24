import type { PaintedRegion, RegionBrushSize, RegionCell, RegionToolMode, RegionType } from './zoneEditorTypes';

export const LEGACY_REGION_GRID_SIZE = 256;
export const REGION_GRID_SIZE = 1024;

export const REGION_TYPE_HEX_COLORS: Record<RegionType, string> = {
  walkable: '#8cc284',
  blocked: '#cc4444',
  water: '#4a7cdb',
  swamp: '#628048',
  sand: '#ceaa5e',
  road: '#b89359',
  danger: '#c0702a',
  trigger: '#54b275',
};

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim();
  const value = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) {
    return `rgba(255, 0, 0, ${alpha})`;
  }
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export const REGION_TYPE_COLORS: Record<RegionType, string> = {
  walkable: hexToRgba(REGION_TYPE_HEX_COLORS.walkable, 0.175),
  blocked: hexToRgba(REGION_TYPE_HEX_COLORS.blocked, 0.175),
  water: hexToRgba(REGION_TYPE_HEX_COLORS.water, 0.175),
  swamp: hexToRgba(REGION_TYPE_HEX_COLORS.swamp, 0.175),
  sand: hexToRgba(REGION_TYPE_HEX_COLORS.sand, 0.175),
  road: hexToRgba(REGION_TYPE_HEX_COLORS.road, 0.175),
  danger: hexToRgba(REGION_TYPE_HEX_COLORS.danger, 0.175),
  trigger: hexToRgba(REGION_TYPE_HEX_COLORS.trigger, 0.175),
};

export interface RegionPaintSettings {
  toolMode: RegionToolMode;
  regionType: RegionType;
  brushSize: RegionBrushSize;
  regionColor?: string;
}

function clampCell(value: number): number {
  return Math.max(0, Math.min(REGION_GRID_SIZE - 1, value));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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

type BrushShape = 'square' | 'circle';

function resolveBrushRadius(size: RegionBrushSize, shape: BrushShape): number {
  if (shape !== 'circle') {
    return size / 2;
  }

  // Keep tiny values precise while still making them visually different.
  if (size <= 0.05) return 0.48;
  if (size <= 0.25) return 0.95;
  if (size <= 0.5) return 1.35;
  if (size <= 0.75) return 1.8;
  if (size <= 1) return 2.2;
  if (size <= 2) return 3;
  if (size <= 3) return 3.8;
  if (size <= 5) return 5;
  if (size <= 8) return 6.5;
  return 8.2;
}

export function brushCells(center: RegionCell, size: RegionBrushSize, shape: BrushShape = 'square'): RegionCell[] {
  const result: RegionCell[] = [];
  const radius = resolveBrushRadius(size, shape);
  const bound = Math.ceil(radius);
  for (let oy = -bound; oy <= bound; oy += 1) {
    for (let ox = -bound; ox <= bound; ox += 1) {
      if (Math.abs(ox) > radius + 0.001 || Math.abs(oy) > radius + 0.001) {
        continue;
      }
      if (shape === 'circle' && Math.hypot(ox, oy) > radius + 0.15) {
        continue;
      }
      result.push({ x: clampCell(center.x + ox), y: clampCell(center.y + oy) });
    }
  }
  return result;
}

export function applyBrushAlongLine(from: RegionCell, to: RegionCell, size: RegionBrushSize, mode: RegionToolMode): RegionCell[] {
  const fromPoint: [number, number] = [
    (from.x + 0.5) / REGION_GRID_SIZE,
    (from.y + 0.5) / REGION_GRID_SIZE,
  ];
  const toPoint: [number, number] = [
    (to.x + 0.5) / REGION_GRID_SIZE,
    (to.y + 0.5) / REGION_GRID_SIZE,
  ];
  return applyBrushAlongPoints(fromPoint, toPoint, size, mode);
}

function paintBrushAtGridPoint(
  centerX: number,
  centerY: number,
  radius: number,
  shape: BrushShape,
  out: Map<string, RegionCell>,
) {
  const bound = Math.ceil(radius);
  const startX = Math.floor(centerX - bound);
  const endX = Math.ceil(centerX + bound);
  const startY = Math.floor(centerY - bound);
  const endY = Math.ceil(centerY + bound);

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (shape === 'square') {
        if (Math.abs(dx) > radius + 0.001 || Math.abs(dy) > radius + 0.001) {
          continue;
        }
      } else if (Math.hypot(dx, dy) > radius + 0.2) {
        continue;
      }

      const cell = { x: clampCell(x), y: clampCell(y) };
      out.set(regionCellKey(cell), cell);
    }
  }
}

export function applyBrushAlongPoints(
  fromPoint: [number, number],
  toPoint: [number, number],
  size: RegionBrushSize,
  mode: RegionToolMode,
): RegionCell[] {
  const brushShape: BrushShape = mode === 'pencil' ? 'square' : 'circle';
  const radius = resolveBrushRadius(size, brushShape);
  const startX = clamp01(fromPoint[0]) * REGION_GRID_SIZE;
  const startY = clamp01(fromPoint[1]) * REGION_GRID_SIZE;
  const endX = clamp01(toPoint[0]) * REGION_GRID_SIZE;
  const endY = clamp01(toPoint[1]) * REGION_GRID_SIZE;
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  const isContinuousMode = true;

  const out = new Map<string, RegionCell>();
  if (!isContinuousMode || distance <= 0.0001) {
    paintBrushAtGridPoint(endX, endY, radius, brushShape, out);
    return [...out.values()];
  }

  const step = mode === 'pencil'
    ? 0.7
    : Math.max(0.08, radius * 0.18);
  const steps = Math.max(1, Math.ceil(distance / step));

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const x = startX + dx * t;
    const y = startY + dy * t;
    paintBrushAtGridPoint(x, y, radius, brushShape, out);
  }

  const byKey = new Map<string, RegionCell>();
  for (const value of out.values()) {
    byKey.set(regionCellKey(value), value);
  }

  return [...byKey.values()];
}

function cloneRegions(regions: PaintedRegion[]): PaintedRegion[] {
  return regions.map((region) => ({
    ...region,
    cells: region.cells.map((cell) => ({ ...cell })),
  }));
}

function normalizeRegionCellsToGrid(region: PaintedRegion, targetGridSize: number): PaintedRegion {
  const sourceGridSize = region.gridSize && Number.isFinite(region.gridSize)
    ? Math.max(1, Math.floor(region.gridSize))
    : LEGACY_REGION_GRID_SIZE;

  if (sourceGridSize === targetGridSize) {
    return region;
  }

  const scale = targetGridSize / sourceGridSize;
  const seen = new Set<string>();
  const cells: RegionCell[] = [];
  for (const cell of region.cells) {
    if (scale > 1) {
      const baseX = Math.floor(cell.x * scale);
      const baseY = Math.floor(cell.y * scale);
      const span = Math.max(1, Math.ceil(scale));
      for (let oy = 0; oy < span; oy += 1) {
        for (let ox = 0; ox < span; ox += 1) {
          const expandedCell = {
            x: clampCell(baseX + ox),
            y: clampCell(baseY + oy),
          };
          const expandedKey = regionCellKey(expandedCell);
          if (seen.has(expandedKey)) {
            continue;
          }
          seen.add(expandedKey);
          cells.push(expandedCell);
        }
      }
      continue;
    }

    const nextCell = {
      x: clampCell(Math.floor(cell.x * scale)),
      y: clampCell(Math.floor(cell.y * scale)),
    };
    const key = regionCellKey(nextCell);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cells.push(nextCell);
  }

  return {
    ...region,
    gridSize: targetGridSize,
    cells,
  };
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
    case 'swamp':
      return 'Swamp Regions';
    case 'sand':
      return 'Sand Regions';
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
  const existingIndex = next.findIndex((region) => region.id === regionId);
  const existing = existingIndex >= 0
    ? normalizeRegionCellsToGrid(next[existingIndex], REGION_GRID_SIZE)
    : undefined;
  if (existingIndex >= 0 && existing) {
    next[existingIndex] = existing;
  }
  const target = existing ?? {
    id: regionId,
    name: regionNameForType(settings.regionType),
    type: settings.regionType,
    color: settings.regionColor,
    gridSize: REGION_GRID_SIZE,
    cells: [],
  };

  const targetByKey = new Map<string, RegionCell>(target.cells.map((cell) => [regionCellKey(cell), cell]));
  for (const cell of incoming.values()) {
    targetByKey.set(regionCellKey(cell), cell);
  }

  target.cells = [...targetByKey.values()];
  if (settings.regionColor) {
    target.color = settings.regionColor;
  }
  if (!existing) {
    next.push(target);
  }

  return next.filter((region) => region.cells.length > 0);
}

export function getPaintedRegionCellMap(regions: PaintedRegion[]): Map<string, { regionId: string; regionType: RegionType }> {
  const map = new Map<string, { regionId: string; regionType: RegionType }>();
  for (const region of regions) {
    const sourceGridSize = region.gridSize && Number.isFinite(region.gridSize)
      ? Math.max(1, Math.floor(region.gridSize))
      : LEGACY_REGION_GRID_SIZE;
    const scale = REGION_GRID_SIZE / sourceGridSize;
    for (const cell of region.cells) {
      if (scale > 1) {
        const baseX = Math.floor(cell.x * scale);
        const baseY = Math.floor(cell.y * scale);
        const span = Math.max(1, Math.ceil(scale));
        for (let oy = 0; oy < span; oy += 1) {
          for (let ox = 0; ox < span; ox += 1) {
            const expandedCell = {
              x: clampCell(baseX + ox),
              y: clampCell(baseY + oy),
            };
            map.set(regionCellKey(expandedCell), { regionId: region.id, regionType: region.type });
          }
        }
        continue;
      }

      const normalizedCell = {
        x: clampCell(Math.floor(cell.x * scale)),
        y: clampCell(Math.floor(cell.y * scale)),
      };
      map.set(regionCellKey(normalizedCell), { regionId: region.id, regionType: region.type });
    }
  }
  return map;
}

export function isBlockedRegionType(regionType: RegionType): boolean {
  return regionType === 'water';
}

export function getRegionMoveSpeedMultiplier(regionType: RegionType): number {
  if (regionType === 'blocked') {
    return 0.4;
  }
  if (regionType === 'swamp') {
    return 0.55;
  }
  if (regionType === 'sand') {
    return 0.72;
  }
  return 1;
}

export function getRegionStaminaCostMultiplier(regionType: RegionType): number {
  if (regionType === 'blocked') {
    return 2.6;
  }
  if (regionType === 'swamp') {
    return 1.55;
  }
  if (regionType === 'sand') {
    return 1.25;
  }
  if (regionType === 'danger') {
    return 1.15;
  }
  return 1;
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
