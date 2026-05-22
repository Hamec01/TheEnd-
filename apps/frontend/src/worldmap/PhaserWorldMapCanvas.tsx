import Phaser from 'phaser';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { WorldSimulationSnapshot } from '../types/world-simulation.types';
import { getZoneCenter } from './zoneGeometry';
import { getPaintedRegionCellMap, getRegionMoveSpeedMultiplier, isBlockedRegionType, REGION_GRID_SIZE } from './regionPaintSystem';
import { type MapPlayer } from './movementSystem';
import { detectHoverZone, pickRuntimeClickTarget } from './zoneSystem';
import { getDefaultPlayerClickable } from './zoneTaxonomy';
import { WORLD_MAP_ZONES, type Zone } from './worldMapNodes';
import type { PlayerWorldState } from './types';
import type { WorldMapCanvasHandle, WorldMapCanvasProps } from './WorldMapCanvas';
import { resolveWorldClickInteraction, resolveWorldHoverZone } from './worldInteractionCommands';
import { resolveWorldEntityMarkerLayout } from './worldEntityScreenHitTesting';
import { resolveVisibleWorldOverlayZones } from './worldOverlayVisibility';
import type { RenderedWorldEntity, WorldSceneSnapshot } from './worldSceneTypes';
import { useWorldRuntimeController } from './useWorldRuntimeController';
import type { WorldMapZone } from './zoneEditorTypes';
import { loadWorldMapRuntimeSettings } from './worldMapRuntimeSettings';

const PLAY_WORLD_MAP_IMAGE_PATH = '/map/main_world_map.webp';
const PLAY_PLAYER_BASE: Omit<MapPlayer, 'speed'> = {
  x: 0.53,
  y: 0.83,
  targetX: null,
  targetY: null,
};

type ActiveEntity = WorldSimulationSnapshot['activeEntities'][number];

type PhaserWorldMapCanvasProps = Pick<
  WorldMapCanvasProps,
  | 'gameplayPaused'
  | 'playerStartPosition'
  | 'playerAvatarUrl'
  | 'zones'
  | 'regions'
  | 'onOpenLocation'
  | 'onEnterZone'
  | 'onHoverZone'
  | 'onRuntimeZoneInteract'
  | 'onPlayerPosition'
  | 'onPlayerState'
  | 'playerTargetPosition'
  | 'playerTargetLocationId'
  | 'movementLocked'
  | 'controlScheme'
  | 'playerSpeed'
  | 'sprintActive'
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
  player: MapPlayer;
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

  constructor() {
    super({ key: 'PhaserWorldMapScene' });
  }

  preload() {
    if (!this.textures.exists('world-map-main')) {
      this.load.image('world-map-main', PLAY_WORLD_MAP_IMAGE_PATH);
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
    this.entityLayer.removeAll(true);
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
    if (!this.markerGraphics || !this.labelLayer || !this.entityLayer) {
      return;
    }
    for (const entity of snapshot.renderedActiveEntities) {
      const coordinates = snapshot.lockedWorldEntityId === entity.id && snapshot.lockedWorldEntityCoordinates
        ? snapshot.lockedWorldEntityCoordinates
        : entity.coordinates;
      const point = normalizedToScreen(coordinates, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
      if (point.x < -24 || point.y < -24 || point.x > snapshot.widthPx + 24 || point.y > snapshot.heightPx + 24) continue;

      if (!this.drawActiveEntityVisual(entity, point.x, point.y)) {
        this.markerGraphics.fillStyle(entity.isHostile ? 0xc94a42 : entity.kind === 'merchant' ? 0xd4b15e : 0x79b2dc, 0.95);
        this.markerGraphics.lineStyle(2, 0x120e09, 0.9);
        this.markerGraphics.fillCircle(point.x, point.y, 9);
        this.markerGraphics.strokeCircle(point.x, point.y, 9);
      }

      if (entity.memberCount > 1) {
        this.drawMarkerBadge(String(entity.memberCount), point.x + 10, point.y + 10, 0xf5d18d, 0x2d1a0e);
      }
      if (entity.isHostile) {
        this.drawMarkerBadge('!', point.x + 12, point.y - 12, 0xff4444, 0xffffff);
      }
      if (entity.hasQuest) {
        this.drawMarkerBadge('?', point.x - 12, point.y - 12, 0xffff00, 0x333333);
      }
    }
  }

  private drawActiveEntityVisual(entity: RenderedWorldEntity, x: number, y: number): boolean {
    if (!this.entityLayer) {
      return false;
    }

    const imageSrc = entity.imageSrc;
    if (!imageSrc) {
      return false;
    }

    const textureKey = this.ensureDynamicTexture(imageSrc);
    if (!textureKey || !this.textures.exists(textureKey)) {
      return false;
    }

    const container = this.add.container(x, y);
    const layout = resolveWorldEntityMarkerLayout(entity);

    if (layout.clipShape === 'circle') {
      const ring = this.add.circle(0, 0, (layout.widthPx / 2) + 1, 0x1a120c, 0.96).setStrokeStyle(2, 0xd8b15a, 1);
      container.add(ring);
    }

    const image = this.add.image(0, 0, textureKey).setDisplaySize(layout.widthPx, layout.heightPx);

    if (layout.clipShape === 'circle') {
      const maskShape = this.add.circle(0, 0, Math.min(layout.widthPx, layout.heightPx) / 2, 0xffffff, 1);
      maskShape.setVisible(false);
      image.setMask(maskShape.createGeometryMask());
      container.add(maskShape);
    }

    container.add(image);

    if (entity.isHostile) {
      container.setAlpha(0.96);
    }

    container.setDepth(20);

    this.entityLayer.add(container);
    return true;
  }

  private ensureDynamicTexture(imageSrc: string): string | null {
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
    this.load.image(textureKey, imageSrc);
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

  private drawMarkerBadge(text: string, x: number, y: number, backgroundColor: number, textColor: number) {
    if (!this.entityLayer) {
      return;
    }

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
    this.entityLayer.add(badge);
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
    regions = [],
    onOpenLocation,
    onEnterZone,
    onHoverZone,
    onRuntimeZoneInteract,
    onPlayerPosition,
    onPlayerState,
    playerTargetPosition = null,
    playerTargetLocationId = null,
    movementLocked = false,
    controlScheme = 'arrows',
    playerSpeed,
    sprintActive = false,
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
  const runtimeSettings = useMemo(() => loadWorldMapRuntimeSettings(), []);
  const paintedCellMap = useMemo(() => getPaintedRegionCellMap(regions), [regions]);

  const [size, setSize] = useState({ width: 1200, height: 780 });
  const initialPlayer = useMemo<MapPlayer>(() => ({
    ...PLAY_PLAYER_BASE,
    speed: runtimeSettings.playerSpeed,
    x: clamp01(playerStartPosition?.x ?? PLAY_PLAYER_BASE.x),
    y: clamp01(playerStartPosition?.y ?? PLAY_PLAYER_BASE.y),
  }), [playerStartPosition?.x, playerStartPosition?.y, runtimeSettings.playerSpeed]);
  const [hoverZone, setHoverZone] = useState<WorldMapZone | null>(null);
  const [cameraFocusPoint, setCameraFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; zone: WorldMapZone } | null>(null);

  const resolveCanMoveTo = useCallback((x: number, y: number) => {
    const cellX = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(x * REGION_GRID_SIZE)));
    const cellY = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(y * REGION_GRID_SIZE)));
    const cell = paintedCellMap.get(`${cellX}:${cellY}`);
    return cell ? !isBlockedRegionType(cell.regionType) : true;
  }, [paintedCellMap]);

  const resolveSpeedMultiplier = useCallback((x: number, y: number) => {
    const cellX = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(x * REGION_GRID_SIZE)));
    const cellY = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(y * REGION_GRID_SIZE)));
    const cell = paintedCellMap.get(`${cellX}:${cellY}`);
    return cell ? getRegionMoveSpeedMultiplier(cell.regionType) : 1;
  }, [paintedCellMap]);
  const { player, currentZone, moveToPoint } = useWorldRuntimeController({
    enabled: true,
    initialPlayer,
    playerStartPosition,
    defaultPlayerSpeed: runtimeSettings.playerSpeed,
    playerSpeed,
    gameplayPaused,
    movementLocked,
    controlScheme,
    sprintActive,
    zones,
    resolveCanMoveTo,
    resolveSpeedMultiplier,
    playerTargetPosition,
    playerTargetLocationId,
    onPlayerPosition,
    onPlayerState,
    onEnterZone,
    onOpenLocation,
  });

  const camera = useMemo<WorldCamera>(() => {
    const width = 1 / runtimeSettings.playZoom;
    const height = 1 / runtimeSettings.playZoom;
    const cameraTarget = cameraFocusPoint ?? { x: player.x, y: player.y };
    return {
      width,
      height,
      left: Math.max(0, Math.min(1 - width, cameraTarget.x - width / 2)),
      top: Math.max(0, Math.min(1 - height, cameraTarget.y - height / 2)),
    };
  }, [cameraFocusPoint, player.x, player.y, runtimeSettings.playZoom]);

  useImperativeHandle(ref, () => ({
    resetView() {
      setCameraFocusPoint(null);
    },
    fitToScreen() {
      setCameraFocusPoint(null);
    },
    focusZone(zoneId) {
      if (!zoneId) {
        setCameraFocusPoint(null);
        return;
      }

      const zone = zones.find((entry) => entry.id === zoneId) ?? null;
      if (!zone) {
        return;
      }

      const [x, y] = getZoneCenter(zone);
      setCameraFocusPoint({ x, y });
    },
    focusPoint(point) {
      setCameraFocusPoint(point ? { x: point[0], y: point[1] } : null);
    },
  }), [zones]);

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
      player,
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
    });
  }, [camera, currentZone?.id, hoverZone?.id, lockedWorldEntityCoordinates, lockedWorldEntityId, playNpcMarkers, playQuestMarkers, player, props.playerAvatarUrl, sceneSnapshot?.activeEntities, sceneSnapshot?.renderedActiveEntities, size.height, size.width, zones]);

  function screenToNormalized(clientX: number, clientY: number): { x: number; y: number; localX: number; localY: number } {
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return { x: player.x, y: player.y, localX: 0, localY: 0 };
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
    setCameraFocusPoint(null);
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
      } else {
        onRuntimeZoneInteract?.(resolution.clickedZone, { x: point.x, y: point.y });
      }
    }

    const moveCommand = resolution.commands.find((command) => command.type === 'move_to_point');
    if (moveCommand) {
      onSceneCommand?.(moveCommand);
    }

    if (resolution.moveTarget && !onSceneCommand) {
      moveToPoint(resolution.moveTarget.point, resolution.moveTarget.pendingLocationId);
      return;
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
        <span>Игрок: {player.x.toFixed(3)}, {player.y.toFixed(3)} | Зона: {currentZone?.name ?? 'Пустоши'} | Наведение: {hoverZone?.name ?? '-'}</span>
      </footer>
    </section>
  );
});
