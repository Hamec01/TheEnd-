import type { WorldSimulationSnapshot } from '../types/world-simulation.types';
import type { RenderedWorldEntity } from './worldSceneTypes';

type ActiveWorldEntity = WorldSimulationSnapshot['activeEntities'][number];

export interface WorldViewportCamera {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface WorldViewportSize {
  width: number;
  height: number;
}

export interface WorldEntityMarkerLayout {
  widthPx: number;
  heightPx: number;
  hitShape: 'circle' | 'rect';
  clipShape: 'circle' | 'rect';
}

interface FindClickedWorldEntityInScreenSpaceInput {
  entities: ActiveWorldEntity[];
  renderedEntities?: RenderedWorldEntity[];
  screenPointPx: { x: number; y: number };
  viewportPx: WorldViewportSize;
  camera: WorldViewportCamera;
  lockedWorldEntityId?: string | null;
  lockedWorldEntityCoordinates?: { x: number; y: number } | null;
}

const DEFAULT_MARKER_LAYOUT: WorldEntityMarkerLayout = {
  widthPx: 48,
  heightPx: 48,
  hitShape: 'rect',
  clipShape: 'rect',
};

const PORTRAIT_MARKER_LAYOUT: WorldEntityMarkerLayout = {
  widthPx: 42,
  heightPx: 42,
  hitShape: 'circle',
  clipShape: 'circle',
};

const FALLBACK_MARKER_LAYOUT: WorldEntityMarkerLayout = {
  widthPx: 42,
  heightPx: 42,
  hitShape: 'circle',
  clipShape: 'circle',
};

const TRADER_MARKER_LAYOUT: WorldEntityMarkerLayout = {
  widthPx: 120,
  heightPx: 72,
  hitShape: 'rect',
  clipShape: 'rect',
};

export function resolveWorldEntityMarkerLayout(
  entity: Pick<RenderedWorldEntity, 'renderMode' | 'spriteId'> | Pick<ActiveWorldEntity, 'spriteId'> & { renderMode?: RenderedWorldEntity['renderMode'] },
): WorldEntityMarkerLayout {
  if (entity.spriteId === 'trader_world_sprite') {
    return TRADER_MARKER_LAYOUT;
  }

  if (entity.renderMode === 'portrait') {
    return PORTRAIT_MARKER_LAYOUT;
  }

  if (entity.renderMode === 'fallback') {
    return FALLBACK_MARKER_LAYOUT;
  }

  return DEFAULT_MARKER_LAYOUT;
}

export function normalizedPointToViewportPx(
  point: { x: number; y: number },
  camera: WorldViewportCamera,
  viewportPx: WorldViewportSize,
): { x: number; y: number } {
  return {
    x: ((point.x - camera.left) / Math.max(camera.width, 0.0001)) * viewportPx.width,
    y: ((point.y - camera.top) / Math.max(camera.height, 0.0001)) * viewportPx.height,
  };
}

export function isScreenPointInsideWorldEntityMarker(
  screenPointPx: { x: number; y: number },
  markerCenterPx: { x: number; y: number },
  layout: WorldEntityMarkerLayout,
): boolean {
  const dx = screenPointPx.x - markerCenterPx.x;
  const dy = screenPointPx.y - markerCenterPx.y;

  if (layout.hitShape === 'circle') {
    return Math.hypot(dx, dy) <= Math.min(layout.widthPx, layout.heightPx) / 2;
  }

  return Math.abs(dx) <= layout.widthPx / 2 && Math.abs(dy) <= layout.heightPx / 2;
}

export function findClickedWorldEntityInScreenSpace(
  input: FindClickedWorldEntityInScreenSpaceInput,
): ActiveWorldEntity | null {
  const renderedEntityById = new Map(input.renderedEntities?.map((entity) => [entity.id, entity]) ?? []);

  return input.entities
    .map((entity) => {
      const renderedEntity = renderedEntityById.get(entity.id);
      const coordinates = input.lockedWorldEntityId === entity.id && input.lockedWorldEntityCoordinates
        ? input.lockedWorldEntityCoordinates
        : entity.coordinates;
      const markerCenterPx = normalizedPointToViewportPx(coordinates, input.camera, input.viewportPx);
      const layout = resolveWorldEntityMarkerLayout(renderedEntity ?? entity);

      if (!isScreenPointInsideWorldEntityMarker(input.screenPointPx, markerCenterPx, layout)) {
        return null;
      }

      const dx = input.screenPointPx.x - markerCenterPx.x;
      const dy = input.screenPointPx.y - markerCenterPx.y;
      return {
        entity,
        distanceSq: (dx * dx) + (dy * dy),
      };
    })
    .filter((entry): entry is { entity: ActiveWorldEntity; distanceSq: number } => Boolean(entry))
    .sort((left, right) => left.distanceSq - right.distanceSq)[0]?.entity ?? null;
}