import type { RegionType, WorldMapContent } from '../content/content.types';

export interface WorldPathNode {
  x: number;
  y: number;
}

interface RegionCellMatch {
  regionType: RegionType;
}

interface QueueNode {
  key: string;
  x: number;
  y: number;
}

interface OpenNode {
  key: string;
  x: number;
  y: number;
  g: number;
  f: number;
}

const WALKABLE_COST: Record<string, number> = {
  walkable: 1,
  trigger: 1,
  road: 0.85,
  danger: 1.15,
  sand: 1.25,
  swamp: 1.55,
};

const BLOCKED_TYPES = new Set<string>(['blocked', 'water']);

function keyOf(x: number, y: number): string {
  return `${x}:${y}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(':');
  return {
    x: Number.parseInt(x ?? '0', 10) || 0,
    y: Number.parseInt(y ?? '0', 10) || 0,
  };
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function movementStepCost(fromX: number, fromY: number, toX: number, toY: number): number {
  const diagonal = fromX !== toX && fromY !== toY;
  return diagonal ? Math.SQRT2 : 1;
}

export class WorldRegionPathAdapter {
  private readonly cellMap = new Map<string, RegionCellMatch>();

  private readonly gridSize: number;

  constructor(worldMap: WorldMapContent) {
    const inferredMax = this.inferGridSize(worldMap);
    this.gridSize = Math.max(16, inferredMax);

    for (const region of worldMap.regions ?? []) {
      for (const cell of region.cells ?? []) {
        const x = clamp(Math.floor(cell.x), 0, this.gridSize - 1);
        const y = clamp(Math.floor(cell.y), 0, this.gridSize - 1);
        this.cellMap.set(keyOf(x, y), { regionType: region.type as RegionType });
      }
    }
  }

  getGridSize(): number {
    return this.gridSize;
  }

  getRegionTypeAt(node: WorldPathNode): RegionType {
    return this.cellMap.get(keyOf(node.x, node.y))?.regionType ?? 'walkable';
  }

  isPassable(node: WorldPathNode): boolean {
    const type = this.getRegionTypeAt(node);
    return !BLOCKED_TYPES.has(type);
  }

  getMoveMultiplier(node: WorldPathNode): number {
    const type = this.getRegionTypeAt(node);
    return WALKABLE_COST[type] ?? 1;
  }

  worldToCell(point: { x: number; y: number }): WorldPathNode {
    return {
      x: clamp(Math.floor(point.x * this.gridSize), 0, this.gridSize - 1),
      y: clamp(Math.floor(point.y * this.gridSize), 0, this.gridSize - 1),
    };
  }

  cellToWorld(node: WorldPathNode): { x: number; y: number } {
    return {
      x: clamp((node.x + 0.5) / this.gridSize, 0, 1),
      y: clamp((node.y + 0.5) / this.gridSize, 0, 1),
    };
  }

  buildPolyline(startWorld: { x: number; y: number }, endWorld: { x: number; y: number }): Array<{ x: number; y: number }> | null {
    const start = this.resolveNearestPassable(this.worldToCell(startWorld));
    const end = this.resolveNearestPassable(this.worldToCell(endWorld));

    if (!start || !end) {
      return null;
    }

    const path = this.findPath(start, end);
    if (!path || path.length === 0) {
      return null;
    }

    return path.map((node) => this.cellToWorld(node));
  }

  private inferGridSize(worldMap: WorldMapContent): number {
    let maxCoord = 0;
    for (const region of worldMap.regions ?? []) {
      for (const cell of region.cells ?? []) {
        maxCoord = Math.max(maxCoord, Number(cell.x) || 0, Number(cell.y) || 0);
      }
    }

    // Common editor sizes are 256 and 1024. Keep inferred size stable and bounded.
    if (maxCoord <= 0) {
      return 256;
    }

    if (maxCoord <= 255) {
      return 256;
    }

    if (maxCoord <= 1023) {
      return 1024;
    }

    return maxCoord + 1;
  }

  private getNeighbors(node: WorldPathNode): WorldPathNode[] {
    const neighbors: WorldPathNode[] = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const x = node.x + dx;
        const y = node.y + dy;
        if (x < 0 || y < 0 || x >= this.gridSize || y >= this.gridSize) {
          continue;
        }
        neighbors.push({ x, y });
      }
    }
    return neighbors;
  }

  private resolveNearestPassable(start: WorldPathNode): WorldPathNode | null {
    if (this.isPassable(start)) {
      return start;
    }

    const visited = new Set<string>();
    const queue: QueueNode[] = [{ key: keyOf(start.x, start.y), x: start.x, y: start.y }];
    visited.add(queue[0].key);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = { x: current.x, y: current.y };
      for (const next of this.getNeighbors(node)) {
        const nextKey = keyOf(next.x, next.y);
        if (visited.has(nextKey)) {
          continue;
        }
        visited.add(nextKey);
        if (this.isPassable(next)) {
          return next;
        }
        if (visited.size < 22000) {
          queue.push({ key: nextKey, x: next.x, y: next.y });
        }
      }
    }

    return null;
  }

  private findPath(start: WorldPathNode, end: WorldPathNode): WorldPathNode[] | null {
    const startKey = keyOf(start.x, start.y);
    const endKey = keyOf(end.x, end.y);

    const open = new Map<string, OpenNode>();
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();

    open.set(startKey, {
      key: startKey,
      x: start.x,
      y: start.y,
      g: 0,
      f: heuristic(start.x, start.y, end.x, end.y),
    });
    gScore.set(startKey, 0);

    const closed = new Set<string>();

    while (open.size > 0) {
      let current: OpenNode | null = null;
      for (const candidate of open.values()) {
        if (!current || candidate.f < current.f) {
          current = candidate;
        }
      }
      if (!current) {
        break;
      }

      if (current.key === endKey) {
        return this.reconstructPath(cameFrom, current.key);
      }

      open.delete(current.key);
      closed.add(current.key);

      const currentNode = { x: current.x, y: current.y };
      for (const neighbor of this.getNeighbors(currentNode)) {
        const neighborKey = keyOf(neighbor.x, neighbor.y);
        if (closed.has(neighborKey) || !this.isPassable(neighbor)) {
          continue;
        }

        const tentativeG = (gScore.get(current.key) ?? Number.POSITIVE_INFINITY)
          + movementStepCost(current.x, current.y, neighbor.x, neighbor.y)
          * this.getMoveMultiplier(neighbor);

        if (tentativeG >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
          continue;
        }

        cameFrom.set(neighborKey, current.key);
        gScore.set(neighborKey, tentativeG);

        const f = tentativeG + heuristic(neighbor.x, neighbor.y, end.x, end.y);
        open.set(neighborKey, {
          key: neighborKey,
          x: neighbor.x,
          y: neighbor.y,
          g: tentativeG,
          f,
        });
      }

      if (closed.size > 150000) {
        break;
      }
    }

    return null;
  }

  private reconstructPath(cameFrom: Map<string, string>, endKey: string): WorldPathNode[] {
    const out: WorldPathNode[] = [parseKey(endKey)];
    let current = endKey;

    while (cameFrom.has(current)) {
      current = cameFrom.get(current)!;
      out.push(parseKey(current));
    }

    out.reverse();
    return out;
  }
}
