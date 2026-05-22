export interface BattleGridViewport {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export interface BattleGridCalibration {
  cellSizePx?: number;
  gridOffsetX?: number;
  gridOffsetY?: number;
  logicalColumns?: number;
  logicalRows?: number;
}

export interface BattleGridAdapterConfig {
  battleMapWidth: number;
  battleMapHeight: number;
  viewport: BattleGridViewport;
  calibration?: BattleGridCalibration;
  renderCellSizePx: number;
}

export interface BattleGridPoint {
  x: number;
  y: number;
}

export function createBattleGridAdapter(config: BattleGridAdapterConfig) {
  const logicalColumns = Math.max(1, Math.floor(config.calibration?.logicalColumns ?? config.battleMapWidth));
  const logicalRows = Math.max(1, Math.floor(config.calibration?.logicalRows ?? config.battleMapHeight));
  const xScale = config.battleMapWidth / logicalColumns;
  const yScale = config.battleMapHeight / logicalRows;
  const cellSize = Math.max(1, config.renderCellSizePx);
  const offsetX = config.calibration?.gridOffsetX ?? 0;
  const offsetY = config.calibration?.gridOffsetY ?? 0;
  const viewport = config.viewport;

  function toLogicalCell(x: number, y: number): BattleGridPoint {
    return {
      x: Math.floor(x / xScale),
      y: Math.floor(y / yScale),
    };
  }

  function toBattleCell(logicalX: number, logicalY: number): BattleGridPoint {
    return {
      x: Math.floor(logicalX * xScale),
      y: Math.floor(logicalY * yScale),
    };
  }

  function cellToScreen(x: number, y: number): BattleGridPoint {
    return {
      x: offsetX + (x - viewport.offsetX) * cellSize,
      y: offsetY + (y - viewport.offsetY) * cellSize,
    };
  }

  function getCellCenter(x: number, y: number): BattleGridPoint {
    const topLeft = cellToScreen(x, y);
    return {
      x: topLeft.x + cellSize / 2,
      y: topLeft.y + cellSize / 2,
    };
  }

  function screenToCell(px: number, py: number): BattleGridPoint | null {
    const x = Math.floor((px - offsetX) / cellSize) + viewport.offsetX;
    const y = Math.floor((py - offsetY) / cellSize) + viewport.offsetY;
    if (x < 0 || y < 0 || x >= config.battleMapWidth || y >= config.battleMapHeight) {
      return null;
    }
    return { x, y };
  }

  function cellToWorld(x: number, y: number): BattleGridPoint {
    return {
      x: offsetX + x * cellSize,
      y: offsetY + y * cellSize,
    };
  }

  function cellCenterToWorld(x: number, y: number): BattleGridPoint {
    const topLeft = cellToWorld(x, y);
    return {
      x: topLeft.x + cellSize / 2,
      y: topLeft.y + cellSize / 2,
    };
  }

  function worldToCell(px: number, py: number): BattleGridPoint | null {
    const logicalX = Math.floor((px - offsetX) / cellSize);
    const logicalY = Math.floor((py - offsetY) / cellSize);
    const { x, y } = toBattleCell(logicalX, logicalY);
    if (x < 0 || y < 0 || x >= config.battleMapWidth || y >= config.battleMapHeight) {
      return null;
    }
    return { x, y };
  }

  function pointerToCell(pointerX: number, pointerY: number): BattleGridPoint | null {
    return screenToCell(pointerX, pointerY);
  }

  return {
    cellSize,
    offsetX,
    offsetY,
    viewport,
    cellToScreen,
    screenToCell,
    cellToWorld,
    cellCenterToWorld,
    worldToCell,
    pointerToCell,
    getCellCenter,
    getProjectileStart: cellCenterToWorld,
    getProjectileEnd: cellCenterToWorld,
    toLogicalCell,
    toBattleCell,
  };
}
