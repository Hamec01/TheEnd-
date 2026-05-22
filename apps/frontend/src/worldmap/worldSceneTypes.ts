import type { QuestMarkerDefinition } from '../types/quest';
import type { WorldSimulationSnapshot } from '../types/world-simulation.types';
import type { MovementControlScheme } from './playerMovementSettings';
import type { PlayerWorldState } from './types';
import type { MapDiscoveryMarker } from './worldMapExploration';
import type { WorldMapZone } from './zoneEditorTypes';

export type WorldEntityRenderMode = 'portrait' | 'sprite' | 'fallback';

export interface RenderedWorldEntity {
  id: string;
  archetypeId: string;
  kind?: WorldSimulationSnapshot['activeEntities'][number]['kind'];
  state: string;
  coordinates: { x: number; y: number };
  spriteId: string;
  spriteSrc?: string;
  portraitSrc?: string;
  imageSrc?: string;
  renderMode: WorldEntityRenderMode;
  isHostile: boolean;
  hasQuest: boolean;
  memberCount: number;
  label: string;
  title: string;
}

export interface WorldSceneViewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WorldSceneSnapshot {
  version: number;
  sourceTick: number;
  rendererKind: 'shared';
  player: {
    position: { x: number; y: number };
    state: PlayerWorldState;
    avatarUrl: string | null;
    movementTarget: { x: number; y: number } | null;
    movementLocked: boolean;
    movementLockReason: string | null;
    controlScheme: MovementControlScheme;
  };
  camera: WorldSceneViewport;
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
  activeEntities: WorldSimulationSnapshot['activeEntities'];
  renderedActiveEntities: RenderedWorldEntity[];
  lockedWorldEntityId: string | null;
  lockedWorldEntityCoordinates: { x: number; y: number } | null;
  discoveryMarkers: MapDiscoveryMarker[];
  worldSnapshot: WorldSimulationSnapshot | null;
}

export type WorldSceneCommand =
  | { type: 'move_to_point'; point: { x: number; y: number }; pendingLocationId?: string | null }
  | { type: 'move_directional'; direction: 'up' | 'down' | 'left' | 'right'; active: boolean }
  | { type: 'stop_movement' }
  | { type: 'hover_point'; point: { x: number; y: number } | null }
  | { type: 'interact_zone'; zoneId: string; point: { x: number; y: number } }
  | { type: 'interact_world_entity'; entityId: string }
  | { type: 'inspect_current_zone' }
  | { type: 'focus_zone'; zoneId: string | null }
  | { type: 'focus_point'; point: { x: number; y: number } | null };