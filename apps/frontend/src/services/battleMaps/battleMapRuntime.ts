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
    musicAssetId: map.musicAssetId,
    musicUrl: map.musicUrl,
    ambientAssetId: map.ambientAssetId,
    ambientUrl: map.ambientUrl,
    cellSizePx: map.cellSizePx,
    gridOffsetX: map.gridOffsetX,
    gridOffsetY: map.gridOffsetY,
    logicalColumns: map.logicalColumns,
    logicalRows: map.logicalRows,
    showEditorGrid: map.showEditorGrid,
    gridOpacity: map.gridOpacity,
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
      kingdomId: zone.kingdomId,
      factionId: zone.factionId,
      raceId: zone.raceId,
      groupId: zone.groupId,
      spawnMode: zone.spawnMode,
      count: zone.count,
      npcTemplateIds: zone.npcTemplateIds,
      combatPresetId: zone.combatPresetId,
      loadoutPresetId: zone.loadoutPresetId,
      aiProfileId: zone.aiProfileId,
      objectiveTag: zone.objectiveTag,
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
    npcs: map.npcs.map((npc) => ({
      id: npc.id,
      npcId: npc.npcId,
      name: npc.name,
      role: npc.role,
      x: npc.x,
      y: npc.y,
      factionId: npc.factionId,
      dialogueId: npc.dialogueId,
      questId: npc.questId,
      merchantId: npc.merchantId,
      startsCombat: npc.startsCombat,
      avatarUrl: npc.avatarUrl,
      description: npc.description,
      sourceType: npc.sourceType,
      kingdomId: npc.kingdomId,
      raceId: npc.raceId,
      clanId: npc.clanId,
      groupId: npc.groupId,
      combatRole: npc.combatRole,
      combatPresetId: npc.combatPresetId,
      loadoutPresetId: npc.loadoutPresetId,
      aiProfileId: npc.aiProfileId,
      aiPersonality: npc.aiPersonality,
      level: npc.level,
      equipment: npc.equipment,
      skillIds: npc.skillIds,
      statOverrides: npc.statOverrides,
      avatarPoolId: npc.avatarPoolId,
      imageRef: npc.imageRef,
      canBeCarried: npc.canBeCarried,
      countsForObjective: npc.countsForObjective,
      objectiveTag: npc.objectiveTag,
    })),
    triggers: map.triggers.map((trigger) => ({
      id: trigger.id,
      type: trigger.type,
      name: trigger.name,
      cells: trigger.cells.map((cell) => ({ x: cell.x, y: cell.y })),
      questId: trigger.questId,
      dialogueId: trigger.dialogueId,
      targetBattleMapId: trigger.targetBattleMapId,
      targetWorldZoneId: trigger.targetWorldZoneId,
      startsCombat: trigger.startsCombat,
      once: trigger.once,
      enabled: trigger.enabled,
      description: trigger.description,
    })),
    exitZones: map.exitZones,
    objectives: map.objectives,
    extractionZones: map.extractionZones,
    scriptEvents: map.scriptEvents,
  };
}
