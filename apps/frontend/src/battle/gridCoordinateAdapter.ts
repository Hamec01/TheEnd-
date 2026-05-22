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
  const cellSize = Math.max(1, config.renderCellSizePx);
  const offsetX = config.calibration?.gridOffsetX ?? 0;
  const offsetY = config.calibration?.gridOffsetY ?? 0;
  const viewport = config.viewport;

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

  function worldToCell(px: number, py: number): BattleGridPoint | null {
    const x = Math.floor((px - offsetX) / cellSize);
    const y = Math.floor((py - offsetY) / cellSize);
    if (x < 0 || y < 0 || x >= config.battleMapWidth || y >= config.battleMapHeight) {
      return null;
    }
    return { x, y };
  }

  return {
    cellSize,
    offsetX,
    offsetY,
    viewport,
    cellToScreen,
    screenToCell,
    cellToWorld,
    worldToCell,
    getCellCenter,
    getProjectileStart: getCellCenter,
    getProjectileEnd: getCellCenter,
  };
}
