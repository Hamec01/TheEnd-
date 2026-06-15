import type { WorldSimulationSnapshot } from '../types/world-simulation.types';
import { getZoneCenter } from './zoneGeometry';
import { findClickedWorldEntityInScreenSpace, type WorldViewportCamera, type WorldViewportSize } from './worldEntityScreenHitTesting';
import { detectHoverZone, pickRuntimeClickTarget } from './zoneSystem';
import { findClickedLocationSprite } from './worldLocationSprites';
import type { WorldSceneCommand } from './worldSceneTypes';
import type { RenderedWorldEntity } from './worldSceneTypes';
import type { Zone } from './worldMapNodes';
import type { WorldMapZone } from './zoneEditorTypes';

type ActiveWorldEntity = WorldSimulationSnapshot['activeEntities'][number];

const FALLBACK_WORLD_ENTITY_CLICK_RADIUS = 0.018;

interface ResolveWorldClickInteractionInput {
  point: { x: number; y: number };
  screenPointPx?: { x: number; y: number };
  viewportPx?: WorldViewportSize;
  camera?: WorldViewportCamera;
  zones: WorldMapZone[];
  activeEntities: ActiveWorldEntity[];
  renderedEntities?: RenderedWorldEntity[];
  lockedWorldEntityId?: string | null;
  lockedWorldEntityCoordinates?: { x: number; y: number } | null;
  spriteImageSizes?: Map<string, { width: number; height: number }>;
  discoveredLocationIds?: Set<string>;
  discoveredZoneIds?: Set<string>;
}

export interface WorldClickInteractionResolution {
  clickedZone: WorldMapZone | null;
  clickedEntity: ActiveWorldEntity | null;
  commands: WorldSceneCommand[];
  moveTarget: {
    point: { x: number; y: number };
    pendingLocationId: string | null;
    zoneId?: string | null;
  } | null;
}

export function resolveWorldHoverZone(zones: WorldMapZone[], point: { x: number; y: number } | null): WorldMapZone | null {
  if (!point) {
    return null;
  }

  return detectHoverZone(zones as Zone[], point.x, point.y) as WorldMapZone | null;
}

export function findClickedWorldEntity(
  entities: ActiveWorldEntity[],
  point: { x: number; y: number },
  lockedWorldEntityId?: string | null,
  lockedWorldEntityCoordinates?: { x: number; y: number } | null,
): ActiveWorldEntity | null {
  return entities.find((entity) => {
    if (entity.renderOnWorldMap === false) {
      return false;
    }
    const coordinates = lockedWorldEntityId === entity.id && lockedWorldEntityCoordinates
      ? lockedWorldEntityCoordinates
      : entity.coordinates;
    return Math.hypot(coordinates.x - point.x, coordinates.y - point.y) <= FALLBACK_WORLD_ENTITY_CLICK_RADIUS;
  }) ?? null;
}

export function resolveWorldClickInteraction(input: ResolveWorldClickInteractionInput): WorldClickInteractionResolution {
  const interactableEntities = input.activeEntities.filter((entity) => entity.renderOnWorldMap !== false);
  const clickedEntity = input.screenPointPx && input.viewportPx && input.camera
    ? findClickedWorldEntityInScreenSpace({
      entities: interactableEntities,
      renderedEntities: input.renderedEntities,
      screenPointPx: input.screenPointPx,
      viewportPx: input.viewportPx,
      camera: input.camera,
      lockedWorldEntityId: input.lockedWorldEntityId,
      lockedWorldEntityCoordinates: input.lockedWorldEntityCoordinates,
    })
    : findClickedWorldEntity(
      interactableEntities,
      input.point,
      input.lockedWorldEntityId,
      input.lockedWorldEntityCoordinates,
    );

  if (clickedEntity) {
    return {
      clickedZone: null,
      clickedEntity,
      commands: [{ type: 'interact_world_entity', entityId: clickedEntity.id }],
      moveTarget: null,
    };
  }

  const clickedSpriteZone = input.screenPointPx && input.viewportPx && input.camera
    ? findClickedLocationSprite(
      input.zones,
      input.screenPointPx,
      input.camera,
      input.viewportPx,
      input.spriteImageSizes ?? new Map(),
      input.discoveredLocationIds,
      input.discoveredZoneIds,
    )
    : null;
  if (clickedSpriteZone) {
    const [zoneCenterX, zoneCenterY] = getZoneCenter(clickedSpriteZone);
    const moveTarget = {
      point: { x: zoneCenterX, y: zoneCenterY },
      pendingLocationId: clickedSpriteZone.type === 'city' || clickedSpriteZone.type === 'location'
        ? clickedSpriteZone.id
        : null,
      zoneId: clickedSpriteZone.id,
    };
    return {
      clickedZone: clickedSpriteZone,
      clickedEntity: null,
      commands: [
        { type: 'interact_zone', zoneId: clickedSpriteZone.id, point: input.point },
        { type: 'move_to_point', point: moveTarget.point, pendingLocationId: moveTarget.pendingLocationId, zoneId: moveTarget.zoneId },
      ],
      moveTarget,
    };
  }

  const clickedZone = pickRuntimeClickTarget(input.zones as Zone[], input.point.x, input.point.y) as WorldMapZone | null;
  if (!clickedZone) {
    return {
      clickedZone: null,
      clickedEntity: null,
      commands: [{ type: 'move_to_point', point: input.point, pendingLocationId: null, zoneId: null }],
      moveTarget: {
        point: input.point,
        pendingLocationId: null,
        zoneId: null,
      },
    };
  }

  const [zoneCenterX, zoneCenterY] = getZoneCenter(clickedZone);
  const moveTarget = {
    point: { x: zoneCenterX, y: zoneCenterY },
    pendingLocationId: clickedZone.type === 'city' || clickedZone.type === 'location'
      ? clickedZone.id
      : null,
    zoneId: clickedZone.id,
  };

  return {
    clickedZone,
    clickedEntity: null,
      commands: [
        { type: 'interact_zone', zoneId: clickedZone.id, point: input.point },
        { type: 'move_to_point', point: moveTarget.point, pendingLocationId: moveTarget.pendingLocationId, zoneId: moveTarget.zoneId },
      ],
      moveTarget,
    };
  }
