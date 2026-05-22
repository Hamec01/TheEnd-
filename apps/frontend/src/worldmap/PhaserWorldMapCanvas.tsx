import Phaser from 'phaser';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useWorldSnapshot } from '../services/useWorldSimulation';
import type { WorldSimulationSnapshot } from '../types/world-simulation.types';
import { getZoneCenter } from './zoneGeometry';
import { getPaintedRegionCellMap, getRegionMoveSpeedMultiplier, isBlockedRegionType, REGION_GRID_SIZE } from './regionPaintSystem';
import { setPlayerTarget, tickPlayerDirectionalMovement, tickPlayerMovement, type MapPlayer } from './movementSystem';
import { detectCurrentZone, detectHoverZone, isInsideZone, pickRuntimeClickTarget } from './zoneSystem';
import { getDefaultPlayerClickable } from './zoneTaxonomy';
import { WORLD_MAP_ZONES, type Zone } from './worldMapNodes';
import type { PlayerWorldState } from './types';
import type { WorldMapCanvasHandle, WorldMapCanvasProps } from './WorldMapCanvas';
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
  | 'movementLocked'
  | 'controlScheme'
  | 'playerSpeed'
  | 'sprintActive'
  | 'playQuestMarkers'
  | 'playNpcMarkers'
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
  private playerToken?: Phaser.GameObjects.Container;
  private labelLayer?: Phaser.GameObjects.Container;

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
    if (!snapshot || !this.bg || !this.mapGraphics || !this.markerGraphics || !this.labelLayer) {
      return;
    }

    const width = snapshot.widthPx;
    const height = snapshot.heightPx;
    this.scale.resize(width, height);

    const texture = this.textures.get('world-map-main');
    const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
    const sourceWidth = source?.width ?? width;
    const sourceHeight = source?.height ?? height;
    this.bg
      .setPosition(0, 0)
      .setCrop(
        snapshot.camera.left * sourceWidth,
        snapshot.camera.top * sourceHeight,
        snapshot.camera.width * sourceWidth,
        snapshot.camera.height * sourceHeight,
      )
      .setDisplaySize(width, height);

    this.mapGraphics.clear();
    this.markerGraphics.clear();
    this.labelLayer.removeAll(true);

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
    const zones = snapshot.zones.filter((zone) => zone.type === 'kingdom_area' && zone.isVisibleToPlayer);
    if (zones.length === 0 || !this.mapGraphics) {
      return;
    }
    this.mapGraphics.lineStyle(2, 0xd2aa66, 0.55);
    for (const zone of zones) {
      if (this.drawZonePath(this.mapGraphics, zone, snapshot)) {
        this.mapGraphics.strokePath();
      }
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
      this.addLabel(marker.title || marker.id, point.x + 10, point.y - 6);
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
      this.addLabel(npc.name || npc.id, point.x + 10, point.y + 3);
    }
  }

  private drawActiveEntities(snapshot: WorldRendererSnapshot) {
    if (!this.markerGraphics || !this.labelLayer) {
      return;
    }
    for (const entity of snapshot.activeEntities) {
      const coordinates = snapshot.lockedWorldEntityId === entity.id && snapshot.lockedWorldEntityCoordinates
        ? snapshot.lockedWorldEntityCoordinates
        : entity.coordinates;
      const point = normalizedToScreen(coordinates, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
      if (point.x < -24 || point.y < -24 || point.x > snapshot.widthPx + 24 || point.y > snapshot.heightPx + 24) continue;
      this.markerGraphics.fillStyle(entity.isHostile ? 0xc94a42 : entity.kind === 'merchant' ? 0xd4b15e : 0x79b2dc, 0.95);
      this.markerGraphics.lineStyle(2, 0x120e09, 0.9);
      this.markerGraphics.fillCircle(point.x, point.y, 9);
      this.markerGraphics.strokeCircle(point.x, point.y, 9);
      if (entity.memberCount > 1) {
        this.addLabel(String(entity.memberCount), point.x - 3, point.y + 3, '#1a120c');
      }
      if (entity.isHostile) {
        this.addLabel('!', point.x + 9, point.y - 10, '#ffd1c9');
      }
    }
  }

  private drawPlayer(snapshot: WorldRendererSnapshot) {
    const point = normalizedToScreen({ x: snapshot.player.x, y: snapshot.player.y }, snapshot.camera, snapshot.widthPx, snapshot.heightPx);
    if (!this.playerToken) {
      this.playerToken = this.add.container(point.x, point.y);
      const glow = this.add.circle(0, 0, 14, 0xffd55a, 0.22);
      const token = this.add.circle(0, 0, 8, 0xf8e8b0, 1).setStrokeStyle(2, 0xffd55a, 1);
      this.playerToken.add([glow, token]);
    }
    this.playerToken.setPosition(point.x, point.y);
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
    movementLocked = false,
    controlScheme = 'arrows',
    playerSpeed,
    sprintActive = false,
    playQuestMarkers = [],
    playNpcMarkers = [],
    onWorldEntityClick,
    lockedWorldEntityId = null,
    lockedWorldEntityCoordinates = null,
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PhaserWorldMapScene | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const movementKeysRef = useRef({ up: false, down: false, left: false, right: false });
  const playerStateRef = useRef<PlayerWorldState>('idle');
  const prevZoneRef = useRef<WorldMapZone | null>(null);
  const pendingCityEntryRef = useRef<string | null>(null);
  const runtimeSettings = useMemo(() => loadWorldMapRuntimeSettings(), []);
  const paintedCellMap = useMemo(() => getPaintedRegionCellMap(regions), [regions]);
  const { snapshot: worldSnapshot } = useWorldSnapshot();

  const [size, setSize] = useState({ width: 1200, height: 780 });
  const [player, setPlayer] = useState<MapPlayer>(() => ({
    ...PLAY_PLAYER_BASE,
    speed: runtimeSettings.playerSpeed,
    x: clamp01(playerStartPosition?.x ?? PLAY_PLAYER_BASE.x),
    y: clamp01(playerStartPosition?.y ?? PLAY_PLAYER_BASE.y),
  }));
  const [hoverZone, setHoverZone] = useState<WorldMapZone | null>(null);
  const [currentZone, setCurrentZone] = useState<WorldMapZone | null>(null);
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

  const camera = useMemo<WorldCamera>(() => {
    const width = 1 / runtimeSettings.playZoom;
    const height = 1 / runtimeSettings.playZoom;
    return {
      width,
      height,
      left: Math.max(0, Math.min(1 - width, player.x - width / 2)),
      top: Math.max(0, Math.min(1 - height, player.y - height / 2)),
    };
  }, [player.x, player.y, runtimeSettings.playZoom]);

  useImperativeHandle(ref, () => ({
    resetView() {},
    fitToScreen() {},
    focusZone() {},
    focusPoint() {},
  }), []);

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
    if (!playerStartPosition) return;
    setPlayer((prev) => ({
      ...prev,
      x: clamp01(playerStartPosition.x),
      y: clamp01(playerStartPosition.y),
      targetX: null,
      targetY: null,
    }));
  }, [playerStartPosition?.x, playerStartPosition?.y]);

  useEffect(() => {
    setPlayer((prev) => (prev.speed === (playerSpeed ?? runtimeSettings.playerSpeed) ? prev : { ...prev, speed: playerSpeed ?? runtimeSettings.playerSpeed }));
  }, [playerSpeed, runtimeSettings.playerSpeed]);

  useEffect(() => {
    if (!playerTargetPosition || movementLocked) return;
    pendingCityEntryRef.current = null;
    setPlayer((prev) => setPlayerTarget(prev, playerTargetPosition.x, playerTargetPosition.y));
  }, [movementLocked, playerTargetPosition?.x, playerTargetPosition?.y]);

  useEffect(() => {
    let frameId = 0;
    const animate = () => {
      setPlayer((prev) => {
        if (gameplayPaused || movementLocked) {
          playerStateRef.current = 'idle';
          return prev.targetX === null && prev.targetY === null ? prev : { ...prev, targetX: null, targetY: null };
        }
        const inputX = (movementKeysRef.current.right ? 1 : 0) - (movementKeysRef.current.left ? 1 : 0);
        const inputY = (movementKeysRef.current.down ? 1 : 0) - (movementKeysRef.current.up ? 1 : 0);
        const effectiveSpeed = (playerSpeed ?? prev.speed) * (sprintActive ? 1.45 : 1);
        const nextPlayer = prev.speed === effectiveSpeed ? prev : { ...prev, speed: effectiveSpeed };
        const tick = (inputX !== 0 || inputY !== 0)
          ? tickPlayerDirectionalMovement(nextPlayer, inputX, inputY, resolveCanMoveTo, resolveSpeedMultiplier)
          : tickPlayerMovement(nextPlayer, 0.0012, resolveCanMoveTo, resolveSpeedMultiplier);
        const enteredZone = detectCurrentZone(zones as Zone[], tick.player.x, tick.player.y) as WorldMapZone | null;
        playerStateRef.current = tick.state;
        setCurrentZone(enteredZone);
        return tick.player;
      });
      frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [gameplayPaused, movementLocked, playerSpeed, resolveCanMoveTo, resolveSpeedMultiplier, sprintActive, zones]);

  useEffect(() => {
    onPlayerPosition?.(player.x, player.y);
  }, [onPlayerPosition, player.x, player.y]);

  useEffect(() => {
    let state: PlayerWorldState = 'idle';
    if (playerStateRef.current === 'moving') state = 'moving';
    else if (currentZone?.type === 'city') state = 'in_city';
    else if (currentZone) state = 'in_zone';
    onPlayerState?.(state);
  }, [currentZone, onPlayerState, player.x, player.y]);

  useEffect(() => {
    if (currentZone?.id !== prevZoneRef.current?.id) {
      prevZoneRef.current = currentZone;
      onEnterZone?.(currentZone as Zone | null);
    }
  }, [currentZone, onEnterZone]);

  useEffect(() => {
    const pendingCityId = pendingCityEntryRef.current;
    if (!pendingCityId || currentZone?.id !== pendingCityId || player.targetX !== null || player.targetY !== null) return;
    if (!currentZone || !isInsideZone(currentZone, player.x, player.y, 0)) return;
    pendingCityEntryRef.current = null;
    onOpenLocation?.(pendingCityId);
  }, [currentZone, onOpenLocation, player.targetX, player.targetY, player.x, player.y]);

  useEffect(() => {
    const matchesMovementKey = (key: string) => {
      const normalized = key.toLowerCase();
      if (controlScheme === 'wasd') {
        if (normalized === 'w') return 'up';
        if (normalized === 's') return 'down';
        if (normalized === 'a') return 'left';
        if (normalized === 'd') return 'right';
        return null;
      }
      if (key === 'ArrowUp') return 'up';
      if (key === 'ArrowDown') return 'down';
      if (key === 'ArrowLeft') return 'left';
      if (key === 'ArrowRight') return 'right';
      return null;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (movementLocked || isTextEditingTarget(event.target)) return;
      const direction = matchesMovementKey(event.key);
      if (!direction) return;
      event.preventDefault();
      movementKeysRef.current[direction] = true;
      pendingCityEntryRef.current = null;
      setPlayer((prev) => ({ ...prev, targetX: null, targetY: null }));
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const direction = matchesMovementKey(event.key);
      if (!direction) return;
      event.preventDefault();
      movementKeysRef.current[direction] = false;
    };
    const handleBlur = () => {
      movementKeysRef.current = { up: false, down: false, left: false, right: false };
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [controlScheme, movementLocked]);

  useEffect(() => {
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
      activeEntities: worldSnapshot?.activeEntities ?? [],
      lockedWorldEntityId,
      lockedWorldEntityCoordinates,
    });
  }, [camera, currentZone?.id, hoverZone?.id, lockedWorldEntityCoordinates, lockedWorldEntityId, playNpcMarkers, playQuestMarkers, player, props.playerAvatarUrl, size.height, size.width, worldSnapshot?.activeEntities, zones]);

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
    const point = screenToNormalized(event.clientX, event.clientY);
    const activeEntity = (worldSnapshot?.activeEntities ?? []).find((entity) => {
      const coordinates = lockedWorldEntityId === entity.id && lockedWorldEntityCoordinates ? lockedWorldEntityCoordinates : entity.coordinates;
      return Math.hypot(coordinates.x - point.x, coordinates.y - point.y) <= 0.018;
    });
    if (activeEntity && onWorldEntityClick) {
      event.preventDefault();
      event.stopPropagation();
      onWorldEntityClick(activeEntity);
      return;
    }
    const clickedZone = pickRuntimeClickTarget(zones as Zone[], point.x, point.y) as WorldMapZone | null;
    if (clickedZone) {
      onRuntimeZoneInteract?.(clickedZone, { x: point.x, y: point.y });
    }
    if (clickedZone?.type === 'city' || clickedZone?.type === 'location') {
      const [zoneCenterX, zoneCenterY] = getZoneCenter(clickedZone);
      pendingCityEntryRef.current = clickedZone.id;
      setPlayer((prev) => setPlayerTarget(prev, zoneCenterX, zoneCenterY));
      return;
    }
    if (clickedZone) {
      pendingCityEntryRef.current = null;
      const [zoneCenterX, zoneCenterY] = getZoneCenter(clickedZone);
      setPlayer((prev) => setPlayerTarget(prev, zoneCenterX, zoneCenterY));
      return;
    }
    pendingCityEntryRef.current = null;
    setPlayer((prev) => setPlayerTarget(prev, point.x, point.y));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const point = screenToNormalized(event.clientX, event.clientY);
    const hovered = detectHoverZone(zones as Zone[], point.x, point.y) as WorldMapZone | null;
    setHoverZone(hovered);
    onHoverZone?.(hovered as Zone | null);
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
          onHoverZone?.(null);
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
