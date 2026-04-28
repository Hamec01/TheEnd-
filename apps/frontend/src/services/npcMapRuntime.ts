import { getAllNpcs } from './npcRepository';
import type { NpcDefinition } from '../types/npc';

export interface MappedNpc {
  npc: NpcDefinition;
  x: number;
  y: number;
  distance: number;
}

function toDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getMappedNpcsForMap(mapId: string): MappedNpc[] {
  const out: MappedNpc[] = [];
  for (const npc of getAllNpcs()) {
    for (const binding of npc.mapBindings) {
      if (binding.mapId !== mapId) {
        continue;
      }
      if (typeof binding.x !== 'number' || typeof binding.y !== 'number') {
        continue;
      }
      out.push({
        npc,
        x: binding.x,
        y: binding.y,
        distance: 0,
      });
      break;
    }
  }
  return out;
}

export function getNearbyMappedNpcs(mapId: string, playerX: number, playerY: number, maxDistance = 0.08): MappedNpc[] {
  return getMappedNpcsForMap(mapId)
    .map((entry) => ({
      ...entry,
      distance: toDistance(entry.x, entry.y, playerX, playerY),
    }))
    .filter((entry) => entry.distance <= maxDistance)
    .sort((left, right) => left.distance - right.distance);
}
