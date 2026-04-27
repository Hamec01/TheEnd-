import type { BattleMapCellType, BattleMapDefinition } from '@theend/rpg-domain';
import type { RuntimeBattleMapPayload } from '../../api';
import { DEFAULT_BATTLE_MAP_ID, createDefaultBattleMap, getBattleMapById, normalizeBattleMap } from './battleMapStorage';

function shouldCellBlockMovement(type: BattleMapCellType): boolean {
  return type === 'blocked' || type === 'highCover';
}

function shouldCellBlockSight(type: BattleMapCellType): boolean {
  return type === 'blocked' || type === 'highCover';
}

export function resolveBattleMapForCombat(battleMapId?: string | null): BattleMapDefinition {
  const fallback = getBattleMapById(DEFAULT_BATTLE_MAP_ID) ?? createDefaultBattleMap();
  if (!battleMapId) {
    return normalizeBattleMap(fallback);
  }
  return normalizeBattleMap(getBattleMapById(battleMapId) ?? fallback);
}

export function toRuntimeBattleMapPayload(map: BattleMapDefinition): RuntimeBattleMapPayload {
  return {
    id: map.id,
    name: map.name,
    description: map.description,
    imageUrl: map.imageUrl,
    width: map.width,
    height: map.height,
    viewportWidth: map.viewportWidth,
    viewportHeight: map.viewportHeight,
    cells: map.cells.map((cell) => ({
      x: cell.x,
      y: cell.y,
      type: cell.type,
      trapId: cell.trapId,
      movementCost: cell.movementCost,
      blocksMovement: cell.blocksMovement ?? shouldCellBlockMovement(cell.type),
      blocksLineOfSight: cell.blocksLineOfSight ?? shouldCellBlockSight(cell.type),
    })),
    spawnZones: map.spawnZones.map((zone) => ({
      id: zone.id,
      type: zone.type,
      name: zone.name,
      cells: zone.cells.map((cell) => ({ x: cell.x, y: cell.y })),
    })),
    objects: map.objects.map((object) => ({
      id: object.id,
      type: object.type,
      name: object.name,
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
      blocksMovement: object.blocksMovement,
      blocksLineOfSight: object.blocksLineOfSight,
      interactable: object.interactable,
      iconUrl: object.iconUrl,
      imageUrl: object.imageUrl,
      lootTableId: object.lootTableId,
      questId: object.questId,
      triggerId: object.triggerId,
      description: object.description,
    })),
    traps: map.traps.map((trap) => ({
      id: trap.id,
      name: trap.name,
      x: trap.x,
      y: trap.y,
      damage: trap.damage,
      staminaCost: trap.staminaCost,
      triggerOnce: trap.triggerOnce,
      revealedByDefault: trap.revealedByDefault,
      detectionDifficulty: trap.detectionDifficulty,
      description: trap.description,
    })),
  };
}