import Phaser from 'phaser';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { WorldSimulationSnapshot } from '../types/world-simulation.types';
import { detectHoverZone, pickRuntimeClickTarget } from './zoneSystem';
import { getDefaultPlayerClickable } from './zoneTaxonomy';
import { WORLD_MAP_ZONES, type Zone } from './worldMapNodes';
import type { WorldMapCanvasHandle, WorldMapCanvasProps } from './WorldMapCanvas';
import { resolveWorldClickInteraction, resolveWorldHoverZone } from './worldInteractionCommands';
import { resolveWorldEntityMarkerLayout } from './worldEntityScreenHitTesting';
import { resolveVisibleWorldOverlayZones } from './worldOverlayVisibility';
import type { RenderedWorldEntity, WorldSceneSnapshot } from './worldSceneTypes';
import {
  loadWorldMapRuntimeSettings,
  WORLD_MAP_RUNTIME_SETTINGS_EVENT,
} from './worldMapRuntimeSettings';
import type { WorldMapZone } from './zoneEditorTypes';
import { DETERMINISTIC_BANDIT_CANDIDATES, pickDeterministicBanditPortrait } from '../phaser/assets/actorVisualResolver';

const PLAY_WORLD_MAP_IMAGE_PATH = '/map/main_world_map.webp';
const STATIC_WORLD_ENTITY_TEXTURE_SOURCES = [...DETERMINISTIC_BANDIT_CANDIDATES, '/sprites/actor/human_01.png'] as const;

type ActiveEntity = WorldSimulationSnapshot['activeEntities'][number];

type PhaserWorldMapCanvasProps = Pick<
  WorldMapCanvasProps,
  | 'gameplayPaused'
  | 'playerStartPosition'
  | 'playerAvatarUrl'
  | 'zones'
  | 'onHoverZone'
  | 'movementLocked'
  | 'playQuestMarkers'
  | 'playNpcMarkers'
  | 'sceneSnapshot'
  | 'onSceneCommand'
  | 'onWorldEntityClick'
  | 'lockedWorldEntityId'
  | 'lockedWorldEntityCoordinates'
>;

interface WorldCamera {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface WorldRendererSnapshot {
  widthPx: number;
  heightPx: number;
  camera: WorldCamera;
  player: { x: number; y: number };
  playerAvatarUrl?: string | null;
  zones: WorldMapZone[];
  hoverZoneId: string | null;
  currentZoneId: string | null;
  playQuestMarkers: NonNullable<WorldMapCanvasProps['playQuestMarkers']>;
  playNpcMarkers: NonNullable<WorldMapCanvasProps['playNpcMarkers']>;
  activeEntities: ActiveEntity[];
  renderedActiveEntities: RenderedWorldEntity[];
  lockedWorldEntityId?: string | null;
  lockedWorldEntityCoordinates?: { x: number; y: number } | null;
  npcMovement: {
    speedScale: number;
    tweenMinMs: number;
    tweenMaxMs: number;
  };
}

interface ActiveEntityInterpolationSource {
  sourceTick?: number;
  updatedAt?: string;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable || target.closest('[contenteditable="true"]') !== null;
}

function shouldShowPlayModeHoverTooltip(zone: WorldMapZone): boolean {
  const playerClickable = typeof zone.playerClickable === 'boolean'
    ? zone.playerClickable
    : getDefaultPlayerClickable(zone.type);
  return playerClickable;
}

function normalizedToScreen(point: { x: number; y: number }, camera: WorldCamera, width: number, height: number) {
  return {
    x: ((point.x - camera.left) / camera.width) * width,
    y: ((point.y - camera.top) / camera.height) * height,
  };
}

function resolveTextureSource(imageSrc: string): string {
  const normalized = imageSrc.trim();
  if (!normalized) {
    return normalized;
  }
  if (
    normalized.startsWith('/')
    || normalized.startsWith('data:')
    || normalized.startsWith('http://')
    || normalized.startsWith('https://')
  ) {
    return normalized;
  }
  return `/api/content/images/${encodeURIComponent(normalized)}/raw`;
}

class PhaserWorldMapScene extends Phaser.Scene {
  private snapshot: WorldRendererSnapshot | null = null;
  private bg?: Phaser.GameObjects.Image;
  private mapGraphics?: Phaser.GameObjects.Graphics;
  private markerGraphics?: Phaser.GameObjects.Graphics;
  private entityLayer?: Phaser.GameObjects.Container;
  private playerToken?: Phaser.GameObjects.Container;
  private labelLayer?: Phaser.GameObjects.Container;
  private dynamicTextureKeys = new Map<string, string>();
  private pendingTextureKeys = new Set<string>();
  private nextDynamicTextureId = 0;
  private activeEntitySprites = new Map<string, {
    container: Phaser.GameObjects.Container;
    imageSrc?: string;
    memberCount: number;
    isHostile: boolean;
    hasQuest: boolean;
    kind?: RenderedWorldEntity['kind'];
    renderWorldX: number;
    renderWorldY: number;
    fromWorldX: number;
    fromWorldY: number;
    targetWorldX: number;
    targetWorldY: number;
    blendStartedAtMs: number;
    blendDurationMs: number;
    lastWorldMoveAtMs?: number;
    lastWorldMoveIntervalMs?: number;
    lastSourceTick?: number;
    lastSourceUpdatedAtMs?: number;
    sourceCadenceMs?: number;
  }>();

  constructor() {
    super({ key: 'PhaserWorldMapScene' });
  }

  preload() {
    if (!this.textures.exists('world-map-main')) {
      this.load.image('world-map-main', PLAY_WORLD_MAP_IMAGE_PATH);
    }
    for (const source of STATIC_WORLD_ENTITY_TEXTURE_SOURCES) {
      const key = `world-entity-static:${source}`;
      if (this.textures.exists(key)) {
        continue;
      }
      this.load.image(key, source);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#120e09');
    this.bg = this.add.image(0, 0, 'world-map-main').setOrigin(0);
    this.mapGraphics = this.add.graphics();
    this.markerGraphics = this.add.graphics();
    this.entityLayer = this.add.container(0, 0);
    this.labelLayer = this.add.container(0, 0);
    this.renderSnapshot();
  }

  update(time: number) {
    this.updateActiveEntityPositions(time);
  }

  setSnapshot(snapshot: WorldRendererSnapshot) {
    this.snapshot = snapshot;
    if (this.mapGraphics && this.markerGraphics) {
      this.renderSnapshot();
    }
  }

  private renderSnapshot() {
    const snapshot = this.snapshot;
    if (!snapshot || !this.bg || !this.mapGraphics || !this.markerGraphics || !this.entityLayer || !this.labelLayer) {
      return;
    }

    const width = snapshot.widthPx;
    const height = snapshot.heightPx;
    this.scale.resize(width, height);

    const texture = this.textures.get('world-map-main');
    const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
    const sourceWidth = source?.width ?? width;
    const sourceHeight = source?.height ?? height;
    const cropX = snapshot.camera.left * sourceWidth;
    const cropY = snapshot.camera.top * sourceHeight;
    const cropWidth = Math.max(1, snapshot.camera.width * sourceWidth);
    const cropHeight = Math.max(1, snapshot.camera.height * sourceHeight);

    // Match the React canvas drawImage crop by transforming the full map texture.
    // Phaser setCrop keeps the source offset in object space, which made the map
    // appear as a tiny tile at the player's position instead of filling the view.
    this.bg
      .setCrop()
      .setScale(width / cropWidth, height / cropHeight)
      .setPosition(-cropX * (width / cropWidth), -cropY * (height / cropHeight));

    this.mapGraphics.clear();
    this.markerGraphics.clear();
    this.labelLayer.removeAll(true);
    if (this.playerToken) {
      this.playerToken.destroy(true);
      this.playerToken = undefined;
    }

    this.drawKingdomBorders(snapshot);
    this.drawHoverZone(snapshot);
    this.drawQuestMarkers(snapshot);
    this.drawNpcMarkers(snapshot);
    this.drawActiveEntities(snapshot);
    this.drawPlayer(snapshot);
  }

  private drawZonePath(graphics: Phaser.GameObjects.Graphics, zone: WorldMapZone, snapshot: WorldRendererSnapshot): boolean {
    if (zone.shape === 'circle') {
      const center = normalizedToScreen({ x: zone.x ?? 0, y: zone.y ?? 0 }, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
      const radius = (zone.radius ?? 0.03) * snapshot.widthPx / snapshot.camera.width;
      graphics.beginPath();
      graphics.arc(center.x, center.y, radius, 0, Math.PI * 2);
      return true;
    }

    const points = zone.points ?? [];
    if (points.length === 0) {
      return false;
    }

    graphics.beginPath();
    points.forEach(([x, y], index) => {
      const point = normalizedToScreen({ x, y }, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
      if (index === 0) {
        graphics.moveTo(point.x, point.y);
      } else {
        graphics.lineTo(point.x, point.y);
      }
    });
    graphics.closePath();
    return true;
  }

  private drawKingdomBorders(snapshot: WorldRendererSnapshot) {
    const zones = resolveVisibleWorldOverlayZones(snapshot.zones, 'kingdom_area');
    if (zones.length === 0 || !this.mapGraphics) {
      return;
    }
    this.mapGraphics.lineStyle(2, 0xd2aa66, 0.55);
    for (const zone of zones) {
      this.drawDashedZoneOutline(zone, snapshot, 10, 8);
    }
  }

  private drawDashedZoneOutline(zone: WorldMapZone, snapshot: WorldRendererSnapshot, dashPx: number, gapPx: number) {
    if (!this.mapGraphics) {
      return;
    }

    if (zone.shape === 'circle') {
      const center = normalizedToScreen({ x: zone.x ?? 0, y: zone.y ?? 0 }, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
      const radius = (zone.radius ?? 0.03) * snapshot.widthPx / snapshot.camera.width;
      const fullStep = (dashPx + gapPx) / Math.max(radius, 1);
      const dashStep = dashPx / Math.max(radius, 1);
      for (let angle = 0; angle < Math.PI * 2; angle += fullStep) {
        this.mapGraphics.beginPath();
        this.mapGraphics.arc(center.x, center.y, radius, angle, Math.min(angle + dashStep, Math.PI * 2));
        this.mapGraphics.strokePath();
      }
      return;
    }

    const points = zone.points ?? [];
    if (points.length === 0) {
      return;
    }

    const screenPoints = points.map(([x, y]) => normalizedToScreen({ x, y }, snapshot.camera, snapshot.widthPx, snapshot.heightPx));
    for (let index = 0; index < screenPoints.length; index += 1) {
      const start = screenPoints[index];
      const end = screenPoints[(index + 1) % screenPoints.length];
      this.drawDashedScreenLine(start, end, dashPx, gapPx);
    }
  }

  private drawDashedScreenLine(start: { x: number; y: number }, end: { x: number; y: number }, dashPx: number, gapPx: number) {
    if (!this.mapGraphics) {
      return;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.01) {
      return;
    }

    const step = dashPx + gapPx;
    const ux = dx / length;
    const uy = dy / length;

    for (let offset = 0; offset < length; offset += step) {
      const from = offset;
      const to = Math.min(offset + dashPx, length);
      const line = new Phaser.Geom.Line(
        start.x + ux * from,
        start.y + uy * from,
        start.x + ux * to,
        start.y + uy * to,
      );
      this.mapGraphics.strokeLineShape(line);
    }
  }

  private drawHoverZone(snapshot: WorldRendererSnapshot) {
    const zone = snapshot.zones.find((entry) => entry.id === snapshot.hoverZoneId);
    if (!zone || !this.mapGraphics) {
      return;
    }
    if (this.drawZonePath(this.mapGraphics, zone, snapshot)) {
      this.mapGraphics.fillStyle(0xf2d28f, 0.12);
      this.mapGraphics.fillPath();
      this.mapGraphics.lineStyle(2, 0xf2d28f, 0.85);
      this.mapGraphics.strokePath();
    }
  }

  private drawQuestMarkers(snapshot: WorldRendererSnapshot) {
    if (!this.markerGraphics || !this.labelLayer) {
      return;
    }
    for (const marker of snapshot.playQuestMarkers) {
      if (marker.mapId !== 'worldmap-main') continue;
      const point = normalizedToScreen({ x: marker.x, y: marker.y }, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
      if (point.x < -20 || point.y < -20 || point.x > snapshot.widthPx + 20 || point.y > snapshot.heightPx + 20) continue;
      const color = marker.type === 'quest_finish' ? 0x7de59b : 0xf0d68a;
      this.markerGraphics.fillStyle(color, 1);
      this.markerGraphics.lineStyle(1, 0x2b2016, 1);
      this.markerGraphics.fillTriangle(point.x, point.y - 9, point.x + 8, point.y + 8, point.x - 8, point.y + 8);
      this.markerGraphics.strokeTriangle(point.x, point.y - 9, point.x + 8, point.y + 8, point.x - 8, point.y + 8);
      if (this.shouldRenderWorldLabels(snapshot)) {
        this.addLabel(marker.title || marker.id, point.x + 10, point.y - 6);
      }
    }
  }

  private drawNpcMarkers(snapshot: WorldRendererSnapshot) {
    if (!this.markerGraphics || !this.labelLayer) {
      return;
    }
    for (const npc of snapshot.playNpcMarkers) {
      const point = normalizedToScreen({ x: npc.x, y: npc.y }, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
      if (point.x < -20 || point.y < -20 || point.x > snapshot.widthPx + 20 || point.y > snapshot.heightPx + 20) continue;
      this.markerGraphics.fillStyle(npc.isHostile ? 0xcf6760 : 0x8fb9de, 1);
      this.markerGraphics.lineStyle(1, 0x1f1712, 1);
      this.markerGraphics.fillCircle(point.x, point.y, 6);
      this.markerGraphics.strokeCircle(point.x, point.y, 6);
      if (npc.hasQuest) {
        this.markerGraphics.fillStyle(0xf1d28a, 1);
        this.markerGraphics.fillCircle(point.x + 7, point.y - 6, 3.5);
      }
      if (this.shouldRenderWorldLabels(snapshot)) {
        this.addLabel(npc.name || npc.id, point.x + 10, point.y + 3);
      }
    }
  }

  private drawActiveEntities(snapshot: WorldRendererSnapshot) {
    if (!this.entityLayer) {
      return;
    }

    const sourceByEntityId = new Map<string, ActiveEntityInterpolationSource>();
    for (const source of snapshot.activeEntities) {
      sourceByEntityId.set(source.id, {
        sourceTick: source.sourceTick,
        updatedAt: source.updatedAt,
      });
    }

    const renderedIds = new Set<string>();

    for (const entity of snapshot.renderedActiveEntities) {
      const coordinates = snapshot.lockedWorldEntityId === entity.id && snapshot.lockedWorldEntityCoordinates
        ? snapshot.lockedWorldEntityCoordinates
        : entity.coordinates;
      const point = normalizedToScreen(coordinates, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
      if (point.x < -48 || point.y < -48 || point.x > snapshot.widthPx + 48 || point.y > snapshot.heightPx + 48) {
        continue;
      }

      renderedIds.add(entity.id);
      this.upsertActiveEntityVisual(entity, point.x, point.y, snapshot, coordinates, sourceByEntityId.get(entity.id));
    }

    for (const [entityId, value] of this.activeEntitySprites.entries()) {
      if (renderedIds.has(entityId)) {
        continue;
      }
      value.container.destroy(true);
      this.activeEntitySprites.delete(entityId);
    }
  }

  private sampleInterpolatedWorldPosition(
    value: {
      fromWorldX: number;
      fromWorldY: number;
      targetWorldX: number;
      targetWorldY: number;
      blendStartedAtMs: number;
      blendDurationMs: number;
    },
    nowMs: number,
  ): { x: number; y: number } {
    if (value.blendDurationMs <= 1) {
      return { x: value.targetWorldX, y: value.targetWorldY };
    }

    const progress = Phaser.Math.Clamp((nowMs - value.blendStartedAtMs) / value.blendDurationMs, 0, 1);
    return {
      x: value.fromWorldX + ((value.targetWorldX - value.fromWorldX) * progress),
      y: value.fromWorldY + ((value.targetWorldY - value.fromWorldY) * progress),
    };
  }

  private updateActiveEntityPositions(nowMs: number): void {
    const snapshot = this.snapshot;
    if (!snapshot) {
      return;
    }

    for (const value of this.activeEntitySprites.values()) {
      const world = this.sampleInterpolatedWorldPosition(value, nowMs);
      value.renderWorldX = world.x;
      value.renderWorldY = world.y;
      const screen = normalizedToScreen(world, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
      value.container.setPosition(screen.x, screen.y);
    }
  }

  private upsertActiveEntityVisual(
    entity: RenderedWorldEntity,
    x: number,
    y: number,
    snapshot: WorldRendererSnapshot,
    worldCoordinates: { x: number; y: number },
    source?: ActiveEntityInterpolationSource,
  ): void {
    if (!this.entityLayer) {
      return;
    }

    const imageSrc = entity.imageSrc?.trim();
    const fallbackHostileSrc = entity.isHostile ? pickDeterministicBanditPortrait(entity.id) : undefined;
    const resolvedImageSrc = imageSrc || fallbackHostileSrc;
    const textureKey = resolvedImageSrc ? this.ensureDynamicTexture(resolvedImageSrc) : null;
    const canUseImage = Boolean(textureKey && this.textures.exists(textureKey));
    const existing = this.activeEntitySprites.get(entity.id);
    const shouldRecreate = !existing
      || existing.imageSrc !== (canUseImage ? resolvedImageSrc : undefined)
      || existing.memberCount !== entity.memberCount
      || existing.isHostile !== entity.isHostile
      || existing.hasQuest !== entity.hasQuest
      || existing.kind !== entity.kind;

    let container = existing?.container;
    if (shouldRecreate) {
      if (existing) {
        existing.container.destroy(true);
      }
      container = this.buildActiveEntityContainer(entity, canUseImage ? (textureKey as string) : null, x, y);
      this.entityLayer.add(container);
      this.activeEntitySprites.set(entity.id, {
        container,
        imageSrc: canUseImage ? resolvedImageSrc : undefined,
        memberCount: entity.memberCount,
        isHostile: entity.isHostile,
        hasQuest: entity.hasQuest,
        kind: entity.kind,
        renderWorldX: worldCoordinates.x,
        renderWorldY: worldCoordinates.y,
        fromWorldX: worldCoordinates.x,
        fromWorldY: worldCoordinates.y,
        targetWorldX: worldCoordinates.x,
        targetWorldY: worldCoordinates.y,
        blendStartedAtMs: this.time.now,
        blendDurationMs: 1,
        lastWorldMoveAtMs: existing?.lastWorldMoveAtMs,
        lastWorldMoveIntervalMs: existing?.lastWorldMoveIntervalMs,
        lastSourceTick: source?.sourceTick,
        lastSourceUpdatedAtMs: source?.updatedAt ? Date.parse(source.updatedAt) : undefined,
        sourceCadenceMs: existing?.sourceCadenceMs,
      });
      return;
    }

    if (!container) {
      return;
    }

    const nowMs = this.time.now;
    const currentWorld = this.sampleInterpolatedWorldPosition(existing, nowMs);

    const movedInWorld = Math.hypot(
      worldCoordinates.x - existing.targetWorldX,
      worldCoordinates.y - existing.targetWorldY,
    ) > 0.00012;

    const nextSourceUpdatedAtMs = source?.updatedAt ? Date.parse(source.updatedAt) : undefined;
    const sourceTickChanged = Number.isFinite(source?.sourceTick)
      && source?.sourceTick !== existing.lastSourceTick;
    const sourceUpdatedAtChanged = Number.isFinite(nextSourceUpdatedAtMs)
      && Number.isFinite(existing.lastSourceUpdatedAtMs)
      ? (nextSourceUpdatedAtMs as number) > (existing.lastSourceUpdatedAtMs as number)
      : Number.isFinite(nextSourceUpdatedAtMs);

    const hasNewSourceSample = Boolean(sourceTickChanged || sourceUpdatedAtChanged || movedInWorld);

    if (!hasNewSourceSample) {
      this.activeEntitySprites.set(entity.id, {
        ...existing,
        container,
        renderWorldX: currentWorld.x,
        renderWorldY: currentWorld.y,
        lastSourceTick: source?.sourceTick ?? existing.lastSourceTick,
        lastSourceUpdatedAtMs: nextSourceUpdatedAtMs ?? existing.lastSourceUpdatedAtMs,
      });
      return;
    }

    const fromScreen = normalizedToScreen(currentWorld, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
    const toScreen = normalizedToScreen(worldCoordinates, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
    const distancePx = Phaser.Math.Distance.Between(fromScreen.x, fromScreen.y, toScreen.x, toScreen.y);
    const heroPixelsPerSecond = this.resolveHeroLikePixelsPerSecond(snapshot);
    const configuredTweenMaxMs = Math.max(snapshot.npcMovement.tweenMinMs, snapshot.npcMovement.tweenMaxMs);
    const effectiveTweenMaxMs = Math.min(configuredTweenMaxMs, 560);

    const baseDurationMs = Phaser.Math.Clamp(
      (distancePx / heroPixelsPerSecond) * 1000,
      snapshot.npcMovement.tweenMinMs,
      effectiveTweenMaxMs,
    );

    const observedSourceIntervalMs = Number.isFinite(nextSourceUpdatedAtMs) && Number.isFinite(existing.lastSourceUpdatedAtMs)
      ? Phaser.Math.Clamp((nextSourceUpdatedAtMs as number) - (existing.lastSourceUpdatedAtMs as number), 90, 2400)
      : undefined;
    const observedIntervalMs = observedSourceIntervalMs ?? (existing.lastWorldMoveAtMs !== undefined
      ? Phaser.Math.Clamp(nowMs - existing.lastWorldMoveAtMs, 120, 2200)
      : undefined);
    const smoothedIntervalMs = observedIntervalMs === undefined
      ? existing.lastWorldMoveIntervalMs
      : existing.lastWorldMoveIntervalMs === undefined
        ? observedIntervalMs
        : (existing.lastWorldMoveIntervalMs * 0.65) + (observedIntervalMs * 0.35);
    const cadenceDurationMs = smoothedIntervalMs === undefined
      ? undefined
      : Phaser.Math.Clamp(
        smoothedIntervalMs * 0.92,
        snapshot.npcMovement.tweenMinMs,
        effectiveTweenMaxMs,
      );
    const durationMs = Phaser.Math.Clamp(
      Math.max(baseDurationMs, cadenceDurationMs ?? 0),
      snapshot.npcMovement.tweenMinMs,
      effectiveTweenMaxMs,
    );

    this.activeEntitySprites.set(entity.id, {
      ...existing,
      container,
      renderWorldX: currentWorld.x,
      renderWorldY: currentWorld.y,
      fromWorldX: currentWorld.x,
      fromWorldY: currentWorld.y,
      targetWorldX: worldCoordinates.x,
      targetWorldY: worldCoordinates.y,
      blendStartedAtMs: nowMs,
      blendDurationMs: distancePx <= 1.2 ? 1 : durationMs,
      lastWorldMoveAtMs: nowMs,
      lastWorldMoveIntervalMs: smoothedIntervalMs,
      lastSourceTick: source?.sourceTick ?? existing.lastSourceTick,
      lastSourceUpdatedAtMs: nextSourceUpdatedAtMs ?? existing.lastSourceUpdatedAtMs,
      sourceCadenceMs: smoothedIntervalMs,
    });
  }

  private buildActiveEntityContainer(
    entity: RenderedWorldEntity,
    textureKey: string | null,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const layout = resolveWorldEntityMarkerLayout(entity);

    if (textureKey) {
      if (layout.clipShape === 'circle') {
        const ring = this.add.circle(0, 0, (layout.widthPx / 2) + 1, 0x1a120c, 0.96).setStrokeStyle(2, 0xd8b15a, 1);
        container.add(ring);
      }

      const image = this.add.image(0, 0, textureKey).setDisplaySize(layout.widthPx, layout.heightPx);
      if (layout.clipShape === 'circle') {
        const maskGraphics = this.add.graphics({ x: 0, y: 0 });
        maskGraphics.setVisible(false);
        maskGraphics.fillStyle(0xffffff, 1);
        maskGraphics.fillCircle(0, 0, Math.min(layout.widthPx, layout.heightPx) / 2);
        image.setMask(maskGraphics.createGeometryMask());
        image.once(Phaser.GameObjects.Events.DESTROY, () => {
          maskGraphics.destroy();
        });
      }
      container.add(image);
    } else {
      const fillColor = entity.isHostile ? 0xc94a42 : entity.kind === 'merchant' ? 0xd4b15e : 0x79b2dc;
      const token = this.add.circle(0, 0, 9, fillColor, 0.95).setStrokeStyle(2, 0x120e09, 0.9);
      container.add(token);
    }

    if (entity.memberCount > 1) {
      container.add(this.createMarkerBadge(String(entity.memberCount), 10, 10, 0xf5d18d, 0x2d1a0e));
    }
    if (entity.isHostile) {
      container.add(this.createMarkerBadge('!', 12, -12, 0xff4444, 0xffffff));
    }
    if (entity.hasQuest) {
      container.add(this.createMarkerBadge('?', -12, -12, 0xffff00, 0x333333));
    }

    if (entity.isHostile) {
      container.setAlpha(0.96);
    }

    container.setDepth(20);
    return container;
  }

  private resolveHeroLikePixelsPerSecond(snapshot: WorldRendererSnapshot): number {
    const heroWorldUnitsPerSecond = 0.0105;
    const pxPerWorldUnitX = snapshot.widthPx / Math.max(snapshot.camera.width, 0.0001);
    const pxPerWorldUnitY = snapshot.heightPx / Math.max(snapshot.camera.height, 0.0001);
    const averagePxPerWorldUnit = (pxPerWorldUnitX + pxPerWorldUnitY) / 2;
    const baseline = heroWorldUnitsPerSecond * averagePxPerWorldUnit;
    return Math.max(120, baseline * snapshot.npcMovement.speedScale);
  }

  private ensureDynamicTexture(imageSrc: string): string | null {
    if (imageSrc.startsWith('/sprites/actor/')) {
      const staticKey = `world-entity-static:${imageSrc}`;
      if (this.textures.exists(staticKey)) {
        return staticKey;
      }
    }

    const existingKey = this.dynamicTextureKeys.get(imageSrc);
    if (existingKey) {
      return existingKey;
    }

    const textureKey = `world-entity-${this.nextDynamicTextureId += 1}`;
    this.dynamicTextureKeys.set(imageSrc, textureKey);

    if (this.pendingTextureKeys.has(textureKey) || this.textures.exists(textureKey)) {
      return textureKey;
    }

    this.pendingTextureKeys.add(textureKey);
    this.load.image(textureKey, resolveTextureSource(imageSrc));
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.pendingTextureKeys.delete(textureKey);
      this.renderSnapshot();
    });

    if (!this.load.isLoading()) {
      this.load.start();
    }

    return textureKey;
  }

  private drawPlayer(snapshot: WorldRendererSnapshot) {
    const point = normalizedToScreen({ x: snapshot.player.x, y: snapshot.player.y }, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
    this.playerToken = this.add.container(point.x, point.y);

    const avatarSrc = snapshot.playerAvatarUrl?.trim();
    const avatarTextureKey = avatarSrc ? this.ensureDynamicTexture(avatarSrc) : null;
    if (avatarTextureKey && this.textures.exists(avatarTextureKey)) {
      const glow = this.add.circle(0, 0, 17, 0xffd55a, 0.18);
      const ringShadow = this.add.circle(0, 0, 19, 0x2f200d, 0.92);
      const ring = this.add.circle(0, 0, 17, 0x1e160d, 0.92).setStrokeStyle(2, 0xd8b15a, 1);
      const avatar = this.add.image(0, 0, avatarTextureKey).setDisplaySize(34, 34);
      const maskShape = this.add.circle(0, 0, 15, 0xffffff, 1);
      maskShape.setVisible(false);
      avatar.setMask(maskShape.createGeometryMask());
      this.playerToken.add([glow, ringShadow, ring, maskShape, avatar]);
    } else {
      const glow = this.add.circle(0, 0, 14, 0xffd55a, 0.22);
      const token = this.add.circle(0, 0, 8, 0xf8e8b0, 1).setStrokeStyle(2, 0xffd55a, 1);
      this.playerToken.add([glow, token]);
    }

    this.playerToken.setDepth(25);
  }

  private shouldRenderWorldLabels(snapshot: WorldRendererSnapshot): boolean {
    return snapshot.camera.width <= 0.105;
  }

  private createMarkerBadge(text: string, x: number, y: number, backgroundColor: number, textColor: number): Phaser.GameObjects.Container {
    const badge = this.add.container(x, y);
    const circle = this.add.circle(0, 0, 10, backgroundColor, 1).setStrokeStyle(1, 0x2b2016, 0.8);
    const label = this.add.text(0, 0, text, {
      color: `#${textColor.toString(16).padStart(6, '0')}`,
      fontFamily: 'Georgia, serif',
      fontSize: text === '?' ? '14px' : '12px',
      fontStyle: '700',
    }).setOrigin(0.5, 0.5);
    badge.add([circle, label]);
    badge.setDepth(30);
    return badge;
  }

  private addLabel(text: string, x: number, y: number, color = '#f8edd8') {
    if (!this.labelLayer) {
      return;
    }
    const label = this.add.text(x, y, text, {
      color,
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      fontStyle: '600',
      stroke: '#1f1712',
      strokeThickness: 2,
    });
    this.labelLayer.add(label);
  }
}

export const PhaserWorldMapCanvas = forwardRef<WorldMapCanvasHandle, PhaserWorldMapCanvasProps>(function PhaserWorldMapCanvas(props, ref) {
  const {
    gameplayPaused = false,
    playerStartPosition,
    zones = WORLD_MAP_ZONES as WorldMapZone[],
    onHoverZone,
    movementLocked = false,
    playQuestMarkers = [],
    playNpcMarkers = [],
    sceneSnapshot = null,
    onSceneCommand,
    onWorldEntityClick,
    lockedWorldEntityId = null,
    lockedWorldEntityCoordinates = null,
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PhaserWorldMapScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  const [size, setSize] = useState({ width: 1200, height: 780 });
  const [hoverZone, setHoverZone] = useState<WorldMapZone | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; zone: WorldMapZone } | null>(null);
  const [runtimeSettings, setRuntimeSettings] = useState(() => loadWorldMapRuntimeSettings());
  const snapshotPlayerPosition = sceneSnapshot?.player.position ?? playerStartPosition ?? { x: 0.53, y: 0.83 };
  const currentZone = sceneSnapshot?.currentZoneId
    ? zones.find((zone) => zone.id === sceneSnapshot.currentZoneId) ?? null
    : null;

  const camera = useMemo<WorldCamera>(() => {
    const fallback = { left: 0, top: 0, width: 1, height: 1 };
    const snapshotCamera = sceneSnapshot?.camera ?? fallback;
    const width = Math.max(0.001, Math.min(1, snapshotCamera.width));
    const height = Math.max(0.001, Math.min(1, snapshotCamera.height));
    return {
      width,
      height,
      left: Math.max(0, Math.min(1 - width, snapshotCamera.left)),
      top: Math.max(0, Math.min(1 - height, snapshotCamera.top)),
    };
  }, [sceneSnapshot?.camera]);

  useImperativeHandle(ref, () => ({
    resetView() {
      onSceneCommand?.({ type: 'focus_point', point: null });
    },
    fitToScreen() {
      onSceneCommand?.({ type: 'focus_point', point: null });
    },
    focusZone(zoneId) {
      onSceneCommand?.({ type: 'focus_zone', zoneId: zoneId ?? null });
    },
    focusPoint(point) {
      onSceneCommand?.({
        type: 'focus_point',
        point: point ? { x: point[0], y: point[1] } : null,
      });
    },
  }), [onSceneCommand]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const resize = () => setSize({
      width: Math.max(320, Math.floor(host.clientWidth)),
      height: Math.max(380, Math.floor(host.clientHeight)),
    });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleRuntimeSettingsChanged = (event: Event) => {
      const detail = (event as CustomEvent<ReturnType<typeof loadWorldMapRuntimeSettings>>).detail;
      if (detail && typeof detail === 'object') {
        setRuntimeSettings(detail);
        return;
      }
      setRuntimeSettings(loadWorldMapRuntimeSettings());
    };

    window.addEventListener(WORLD_MAP_RUNTIME_SETTINGS_EVENT, handleRuntimeSettingsChanged as EventListener);
    return () => {
      window.removeEventListener(WORLD_MAP_RUNTIME_SETTINGS_EVENT, handleRuntimeSettingsChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || gameRef.current) return undefined;
    const scene = new PhaserWorldMapScene();
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: size.width,
      height: size.height,
      backgroundColor: '#120e09',
      scene,
      render: { antialias: true },
      scale: { mode: Phaser.Scale.NONE },
    });
    gameRef.current = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const activeEntities = sceneSnapshot?.activeEntities ?? [];
    const renderedActiveEntities = sceneSnapshot?.renderedActiveEntities ?? [];
    sceneRef.current?.setSnapshot({
      widthPx: size.width,
      heightPx: size.height,
      camera,
      player: { x: snapshotPlayerPosition.x, y: snapshotPlayerPosition.y },
      playerAvatarUrl: props.playerAvatarUrl,
      zones,
      hoverZoneId: hoverZone?.id ?? null,
      currentZoneId: currentZone?.id ?? null,
      playQuestMarkers,
      playNpcMarkers,
      activeEntities,
      renderedActiveEntities,
      lockedWorldEntityId,
      lockedWorldEntityCoordinates,
      npcMovement: {
        speedScale: runtimeSettings.phaserNpcMoveSpeedScale,
        tweenMinMs: runtimeSettings.phaserNpcMoveTweenMinMs,
        tweenMaxMs: runtimeSettings.phaserNpcMoveTweenMaxMs,
      },
    });
  }, [
    camera,
    currentZone?.id,
    hoverZone?.id,
    lockedWorldEntityCoordinates,
    lockedWorldEntityId,
    playNpcMarkers,
    playQuestMarkers,
    props.playerAvatarUrl,
    runtimeSettings.phaserNpcMoveSpeedScale,
    runtimeSettings.phaserNpcMoveTweenMaxMs,
    runtimeSettings.phaserNpcMoveTweenMinMs,
    sceneSnapshot?.activeEntities,
    sceneSnapshot?.renderedActiveEntities,
    size.height,
    size.width,
    snapshotPlayerPosition.x,
    snapshotPlayerPosition.y,
    zones,
  ]);

  function screenToNormalized(clientX: number, clientY: number): { x: number; y: number; localX: number; localY: number } {
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return { x: snapshotPlayerPosition.x, y: snapshotPlayerPosition.y, localX: 0, localY: 0 };
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    return {
      localX,
      localY,
      x: clamp01(camera.left + (localX / Math.max(1, rect.width)) * camera.width),
      y: clamp01(camera.top + (localY / Math.max(1, rect.height)) * camera.height),
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (gameplayPaused || movementLocked || event.button !== 0) return;
    const point = screenToNormalized(event.clientX, event.clientY);
    const resolution = resolveWorldClickInteraction({
      point: { x: point.x, y: point.y },
      screenPointPx: { x: point.localX, y: point.localY },
      viewportPx: { width: size.width, height: size.height },
      camera,
      zones,
      activeEntities: sceneSnapshot?.activeEntities ?? [],
      renderedEntities: sceneSnapshot?.renderedActiveEntities ?? [],
      lockedWorldEntityId,
      lockedWorldEntityCoordinates,
    });
    if (resolution.clickedEntity) {
      event.preventDefault();
      event.stopPropagation();
      if (onSceneCommand) {
        onSceneCommand({ type: 'interact_world_entity', entityId: resolution.clickedEntity.id });
      } else {
        onWorldEntityClick?.(resolution.clickedEntity);
      }
      return;
    }

    if (resolution.clickedZone) {
      if (onSceneCommand) {
        onSceneCommand({ type: 'interact_zone', zoneId: resolution.clickedZone.id, point: { x: point.x, y: point.y } });
      }
    }

    const moveCommand = resolution.commands.find((command) => command.type === 'move_to_point');
    if (moveCommand) {
      onSceneCommand?.(moveCommand);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = screenToNormalized(event.clientX, event.clientY);
    const hovered = resolveWorldHoverZone(zones, { x: point.x, y: point.y });
    setHoverZone(hovered);
    if (onSceneCommand) {
      onSceneCommand({ type: 'hover_point', point: { x: point.x, y: point.y } });
    } else {
      onHoverZone?.(hovered as Zone | null);
    }
    setTooltip(hovered && shouldShowPlayModeHoverTooltip(hovered) ? { x: point.localX, y: point.localY, zone: hovered } : null);
  }

  return (
    <section className="wm-map card wm-map-phaser">
      <div
        className="wm-map-surface wm-map-phaser-surface"
        ref={hostRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => {
          setTooltip(null);
          setHoverZone(null);
          if (onSceneCommand) {
            onSceneCommand({ type: 'hover_point', point: null });
          } else {
            onHoverZone?.(null);
          }
        }}
      >
        <div className="wm-map-title">Сольеймар: Мир</div>
        {tooltip ? (
          <div className="wm-zone-tooltip" style={{ left: `${tooltip.x + 14}px`, top: `${tooltip.y + 14}px` }}>
            <strong>{tooltip.zone.name}</strong>
            <p>{tooltip.zone.description}</p>
          </div>
        ) : null}
      </div>
      <footer className="wm-map-legend">
        <span>Игрок: {snapshotPlayerPosition.x.toFixed(3)}, {snapshotPlayerPosition.y.toFixed(3)} | Зона: {currentZone?.name ?? 'Пустоши'} | Наведение: {hoverZone?.name ?? '-'}</span>
      </footer>
    </section>
  );
});
