import type { QuestMarkerDefinition } from '../types/quest';
import type { WorldSimulationSnapshot } from '../types/world-simulation.types';
import type { MovementControlScheme } from './playerMovementSettings';
import type { PlayerWorldState } from './types';
import type { MapDiscoveryMarker } from './worldMapExploration';
import type { WorldMapZone } from './zoneEditorTypes';
import type { RenderedWorldEntity, WorldSceneSnapshot } from './worldSceneTypes';

interface BuildWorldSceneSnapshotInput {
  playerPosition: { x: number; y: number };
  playerState: PlayerWorldState;
  playerAvatarUrl: string | null;
  movementTarget: { x: number; y: number } | null;
  movementLocked: boolean;
  movementLockReason: string | null;
  controlScheme: MovementControlScheme;
  camera: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  zones: WorldMapZone[];
  currentZoneId: string | null;
  hoverZoneId: string | null;
  questMarkers: QuestMarkerDefinition[];
  npcMarkers: Array<{
    id: string;
    name: string;
    kind: string;
    x: number;
    y: number;
    isHostile?: boolean;
    hasQuest?: boolean;
  }>;
  worldSnapshot: WorldSimulationSnapshot | null;
  renderedActiveEntities: RenderedWorldEntity[];
  lockedWorldEntityId: string | null;
  lockedWorldEntityCoordinates: { x: number; y: number } | null;
  discoveryMarkers: MapDiscoveryMarker[];
}

export function buildWorldSceneSnapshot(input: BuildWorldSceneSnapshotInput): WorldSceneSnapshot {
  const now = Date.now();

  return {
    version: now,
    sourceTick: now,
    rendererKind: 'shared',
    player: {
      position: input.playerPosition,
      state: input.playerState,
      avatarUrl: input.playerAvatarUrl,
      movementTarget: input.movementTarget,
      movementLocked: input.movementLocked,
      movementLockReason: input.movementLockReason,
      controlScheme: input.controlScheme,
    },
    camera: input.camera,
    zones: input.zones,
    currentZoneId: input.currentZoneId,
    hoverZoneId: input.hoverZoneId,
    questMarkers: input.questMarkers,
    npcMarkers: input.npcMarkers,
    activeEntities: input.worldSnapshot?.activeEntities ?? [],
    renderedActiveEntities: input.renderedActiveEntities,
    lockedWorldEntityId: input.lockedWorldEntityId,
    lockedWorldEntityCoordinates: input.lockedWorldEntityCoordinates,
    discoveryMarkers: input.discoveryMarkers,
    worldSnapshot: input.worldSnapshot,
  };
}