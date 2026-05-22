import {
  BattlefieldTileType,
  DistanceBand,
  MovementType,
  TeamSide,
  getBattlefieldTilePlacements,
  type ArenaCombatEntity,
  type BattlefieldTile,
  type CombatAnimationEvent,
} from '@theend/rpg-domain';
import Phaser from 'phaser';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleFieldProps } from '../BattleField';
import { createBattleGridAdapter, type BattleGridViewport } from '../gridCoordinateAdapter';
import { getBattleEffect, inferEffectIdForAnimation } from '../../phaser/effects/effectRegistry';

type PhaserBattleRendererProps = BattleFieldProps;

interface RendererSnapshot extends PhaserBattleRendererProps {
  widthPx: number;
  heightPx: number;
  viewport: BattleGridViewport;
  sceneCellSize: number;
}

function isBlockingTile(type: BattlefieldTileType): boolean {
  return type === BattlefieldTileType.Blocked || type === BattlefieldTileType.HighCover || type === BattlefieldTileType.Summon;
}

function classifyCombatStyle(entity: ArenaCombatEntity): 'MELEE' | 'RANGED' | 'MAGIC' {
  if (entity.combatStyleHint) return entity.combatStyleHint;
  if (typeof entity.attackRange === 'number' && entity.attackRange > 1) return 'RANGED';
  if (entity.intelligence >= entity.strength && entity.intelligence >= entity.dexterity) return 'MAGIC';
  if (entity.dexterity > entity.strength) return 'RANGED';
  return 'MELEE';
}

function getMaxAttackRange(entity: ArenaCombatEntity, style: 'MELEE' | 'RANGED' | 'MAGIC'): number {
  if (style === 'MELEE') return 1;
  const raw = typeof entity.attackRange === 'number' && Number.isFinite(entity.attackRange) ? Math.floor(entity.attackRange) : undefined;
  return style === 'MAGIC' ? Math.max(2, raw ?? 5) : Math.max(2, raw ?? 6);
}

function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

function hasLineOfSight(fromX: number, fromY: number, toX: number, toY: number, tileTypeByKey: Map<string, BattlefieldTileType>): boolean {
  const points = bresenhamLine(fromX, fromY, toX, toY);
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (isBlockingTile(tileTypeByKey.get(`${point.x}:${point.y}`) ?? BattlefieldTileType.Empty)) {
      return false;
    }
  }
  return true;
}

function getRacePortrait(entity: ArenaCombatEntity, playerId: string, playerAvatarUrl?: string): string {
  if (entity.avatarUrl) return entity.avatarUrl;
  if (entity.id === playerId && playerAvatarUrl) return playerAvatarUrl;
  const raceKey = String(entity.race).toLowerCase();
  if (raceKey.includes('dwarf')) return '/art/races/dwarf.png';
  if (raceKey.includes('elf')) return '/art/races/elf.png';
  return '/art/races/human.png';
}

function buildViewport(props: BattleFieldProps): BattleGridViewport {
  const width = Math.max(4, Math.min(props.battleMapWidth, props.viewportWidth));
  const height = Math.max(4, Math.min(props.battleMapHeight, props.viewportHeight));
  const playerPlacement = getBattlefieldTilePlacements(props.entities, props.distance, props.battleMapWidth, props.battleMapHeight)
    .find((placement) => placement.entityId === props.playerId);
  const focusX = playerPlacement?.x ?? 0;
  const focusY = playerPlacement?.y ?? 0;
  return {
    width,
    height,
    offsetX: Math.max(0, Math.min(Math.max(0, props.battleMapWidth - width), Math.round(focusX - Math.floor(width / 2)))),
    offsetY: Math.max(0, Math.min(Math.max(0, props.battleMapHeight - height), Math.round(focusY - Math.floor(height / 2)))),
  };
}

function buildMovableCells(props: BattleFieldProps): Map<string, { movementType: MovementType; willTriggerOpportunity: boolean }> {
  const placements = getBattlefieldTilePlacements(props.entities, props.distance, props.battleMapWidth, props.battleMapHeight);
  const playerPlacement = placements.find((placement) => placement.entityId === props.playerId);
  if (!playerPlacement) return new Map();
  const placementByTile = new Map(placements.map((placement) => [`${placement.x}:${placement.y}`, placement]));
  const tileTypeByKey = new Map(props.battlefieldTiles.map((tile) => [`${tile.x}:${tile.y}`, tile.type]));
  const adjacentMeleeEnemies = props.entities.filter((entity) =>
    entity.isAlive
    && entity.team === TeamSide.Right
    && classifyCombatStyle(entity) === 'MELEE'
    && Math.abs((entity.battlefieldX ?? 0) - playerPlacement.x) + Math.abs((entity.battlefieldY ?? 0) - playerPlacement.y) <= 1,
  );
  const result = new Map<string, { movementType: MovementType; willTriggerOpportunity: boolean }>();
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number; dist: number }> = [{ x: playerPlacement.x, y: playerPlacement.y, dist: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.x}:${current.y}`;
    if (visited.has(key) || current.dist > 3) continue;
    visited.add(key);
    const tileType = tileTypeByKey.get(key) ?? BattlefieldTileType.Empty;
    if (current.dist > 0 && !placementByTile.has(key) && !isBlockingTile(tileType)) {
      result.set(key, {
        movementType: current.dist > 1 ? MovementType.Dash : MovementType.Step,
        willTriggerOpportunity: adjacentMeleeEnemies.some((enemy) =>
          Math.abs((enemy.battlefieldX ?? 0) - current.x) + Math.abs((enemy.battlefieldY ?? 0) - current.y) > 1,
        ),
      });
    }
    if (current.dist >= 3) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nextKey = `${nx}:${ny}`;
      if (nx < 0 || ny < 0 || nx >= props.battleMapWidth || ny >= props.battleMapHeight) continue;
      if (placementByTile.has(nextKey) || isBlockingTile(tileTypeByKey.get(nextKey) ?? BattlefieldTileType.Empty)) continue;
      queue.push({ x: nx, y: ny, dist: current.dist + 1 });
    }
  }
  return result;
}

function buildTargetableCells(props: BattleFieldProps): Set<string> {
  const player = props.entities.find((entity) => entity.id === props.playerId);
  const selectedEnemy = props.entities.find((entity) => entity.id === props.selectedTargetId) ?? props.entities.find((entity) => entity.team === TeamSide.Right && entity.isAlive);
  if (!player || !selectedEnemy) return new Set();
  const placements = getBattlefieldTilePlacements(props.entities, props.distance, props.battleMapWidth, props.battleMapHeight);
  const playerPlacement = placements.find((placement) => placement.entityId === props.playerId);
  const enemyPlacement = placements.find((placement) => placement.entityId === selectedEnemy.id);
  if (!playerPlacement || !enemyPlacement) return new Set();
  const tileTypeByKey = new Map(props.battlefieldTiles.map((tile) => [`${tile.x}:${tile.y}`, tile.type]));
  const style = classifyCombatStyle(player);
  const maxRange = getMaxAttackRange(player, style);
  const result = new Set<string>();
  for (let x = 0; x < props.battleMapWidth; x += 1) {
    for (let y = 0; y < props.battleMapHeight; y += 1) {
      const dist = Math.abs(playerPlacement.x - x) + Math.abs(playerPlacement.y - y);
      if (dist <= maxRange && hasLineOfSight(playerPlacement.x, playerPlacement.y, x, y, tileTypeByKey)) {
        result.add(`${x}:${y}`);
      }
    }
  }
  result.add(`${enemyPlacement.x}:${enemyPlacement.y}`);
  return result;
}

class PhaserBattleScene extends Phaser.Scene {
  private snapshot: RendererSnapshot | null = null;
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private fxGraphics?: Phaser.GameObjects.Graphics;
  private bg?: Phaser.GameObjects.Image;
  private tokenById = new Map<string, Phaser.GameObjects.Container>();
  private processedEvents = new Set<string>();
  private loadedImages = new Set<string>();

  constructor() {
    super({ key: 'PhaserBattleScene' });
  }

  setSnapshot(snapshot: RendererSnapshot) {
    this.snapshot = snapshot;
    if (this.gridGraphics) {
      this.renderSnapshot();
    }
  }

  create() {
    this.input.mouse?.disableContextMenu();
    this.gridGraphics = this.add.graphics();
    this.fxGraphics = this.add.graphics();
    this.renderSnapshot();
  }

  getAdapter() {
    const snapshot = this.snapshot;
    if (!snapshot) return null;
    return createBattleGridAdapter({
      battleMapWidth: snapshot.battleMapWidth,
      battleMapHeight: snapshot.battleMapHeight,
      viewport: snapshot.viewport,
      calibration: snapshot.mapCalibration,
      renderCellSizePx: snapshot.sceneCellSize,
    });
  }

  private renderSnapshot() {
    const snapshot = this.snapshot;
    const adapter = this.getAdapter();
    if (!snapshot || !adapter || !this.gridGraphics || !this.fxGraphics) return;

    this.scale.resize(snapshot.widthPx, snapshot.heightPx);
    this.cameras.main.setBackgroundColor('#120e09');
    this.ensureBackground(snapshot);

    this.gridGraphics.clear();
    const movableCells = buildMovableCells(snapshot);
    const targetableCells = buildTargetableCells(snapshot);
    const blocked = new Set(snapshot.battlefieldTiles
      .filter((tile) => isBlockingTile(tile.type) || tile.blocksMovement)
      .map((tile) => `${tile.x}:${tile.y}`));
    const placements = getBattlefieldTilePlacements(snapshot.entities, snapshot.distance, snapshot.battleMapWidth, snapshot.battleMapHeight);
    const placementById = new Map(placements.map((placement) => [placement.entityId, placement]));

    for (let row = 0; row < snapshot.viewport.height; row += 1) {
      for (let col = 0; col < snapshot.viewport.width; col += 1) {
        const x = snapshot.viewport.offsetX + col;
        const y = snapshot.viewport.offsetY + row;
        const topLeft = adapter.cellToScreen(x, y);
        const key = `${x}:${y}`;
        const isSelected = snapshot.selectedMoveTile?.x === x && snapshot.selectedMoveTile?.y === y;
        const fill = blocked.has(key)
          ? 0x2b1e1a
          : isSelected
            ? 0x547ad8
            : movableCells.has(key)
              ? 0x285a3f
              : targetableCells.has(key)
                ? 0x5d4630
                : 0x000000;
        const alpha = blocked.has(key) || isSelected || movableCells.has(key) || targetableCells.has(key) ? 0.36 : 0.08;
        this.gridGraphics.fillStyle(fill, alpha);
        this.gridGraphics.fillRect(topLeft.x, topLeft.y, adapter.cellSize, adapter.cellSize);
        this.gridGraphics.lineStyle(1, 0xf4ddb0, 0.18);
        this.gridGraphics.strokeRect(topLeft.x, topLeft.y, adapter.cellSize, adapter.cellSize);
      }
    }

    const aliveIds = new Set(snapshot.entities.map((entity) => entity.id));
    for (const [id, token] of this.tokenById) {
      if (!aliveIds.has(id)) {
        token.destroy(true);
        this.tokenById.delete(id);
      }
    }

    for (const entity of snapshot.entities) {
      const placement = placementById.get(entity.id);
      if (!placement) continue;
      const center = adapter.getCellCenter(placement.x, placement.y);
      const token = this.ensureToken(entity, snapshot);
      token.setPosition(center.x, center.y);
      token.setDepth(entity.id === snapshot.playerId ? 20 : 18);
      token.setAlpha(entity.isAlive ? 1 : 0.42);
      token.setScale(entity.id === snapshot.selectedTargetId || entity.id === snapshot.playerId ? 1.08 : 1);
      this.drawTokenStatus(token, entity, snapshot);
    }

    this.processAnimationEvents(snapshot.animationEvents ?? []);
  }

  private ensureBackground(snapshot: RendererSnapshot) {
    const url = snapshot.mapImageUrl || '/map/battle-map_arena.png';
    const key = `battle-bg:${url}`;
    if (this.textures.exists(key)) {
      if (!this.bg) {
        this.bg = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-10);
      } else {
        this.bg.setTexture(key);
      }
      this.bg.setDisplaySize(snapshot.widthPx, snapshot.heightPx);
      return;
    }
    if (!this.loadedImages.has(key)) {
      this.loadedImages.add(key);
      this.load.image(key, url);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => this.renderSnapshot());
      this.load.start();
    }
  }

  private ensureToken(entity: ArenaCombatEntity, snapshot: RendererSnapshot): Phaser.GameObjects.Container {
    const existing = this.tokenById.get(entity.id);
    if (existing) {
      return existing;
    }

    const size = Math.max(24, Math.floor(snapshot.sceneCellSize * 0.72));
    const token = this.add.container(0, 0);
    const teamColor = entity.team === TeamSide.Right ? 0x8f3333 : entity.team === TeamSide.Left ? 0x2f6f9e : 0x847052;
    const base = this.add.circle(0, 0, size / 2, teamColor, 0.94);
    base.setStrokeStyle(2, 0xf3d9a8, 0.8);
    const label = this.add.text(0, -1, entity.name.slice(0, 2).toUpperCase(), {
      color: '#fff4d4',
      fontFamily: 'Georgia, serif',
      fontSize: `${Math.max(10, Math.floor(size * 0.28))}px`,
      fontStyle: '700',
    }).setOrigin(0.5);
    const hpBack = this.add.rectangle(0, size * 0.48, size * 0.9, 4, 0x1b1612, 0.9);
    const hpFill = this.add.rectangle(-size * 0.45, size * 0.48, size * 0.9, 4, 0x5de082, 1).setOrigin(0, 0.5);
    hpFill.setName('hpFill');
    token.add([base, label, hpBack, hpFill]);
    token.setSize(size, size);
    this.tokenById.set(entity.id, token);

    const portrait = getRacePortrait(entity, snapshot.playerId, snapshot.playerAvatarUrl);
    const imageKey = `actor:${portrait}`;
    if (!this.textures.exists(imageKey) && !this.loadedImages.has(imageKey)) {
      this.loadedImages.add(imageKey);
      this.load.image(imageKey, portrait);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        const sceneToken = this.tokenById.get(entity.id);
        if (!sceneToken || !this.textures.exists(imageKey)) return;
        const image = this.add.image(0, -1, imageKey).setDisplaySize(size * 0.82, size * 0.82);
        sceneToken.addAt(image, 1);
      });
      this.load.start();
    }

    return token;
  }

  private drawTokenStatus(token: Phaser.GameObjects.Container, entity: ArenaCombatEntity, snapshot: RendererSnapshot) {
    const hpFill = token.getByName('hpFill') as Phaser.GameObjects.Rectangle | null;
    if (hpFill) {
      const baseWidth = Math.max(24, Math.floor(snapshot.sceneCellSize * 0.72)) * 0.9;
      hpFill.width = baseWidth * Math.max(0, Math.min(1, entity.currentHp / Math.max(1, entity.maxHp)));
    }
    token.each((child: Phaser.GameObjects.GameObject) => {
      if (child.name === 'statusAura') {
        child.destroy();
      }
    });
    const activeStatus = entity.activeCombatStatuses?.find((status) => status.remainingTurns > 0);
    if (activeStatus) {
      const effect = getBattleEffect(activeStatus.rawStatusId ?? activeStatus.id, 'shielded');
      const aura = this.add.circle(0, 0, Math.max(16, snapshot.sceneCellSize * 0.42), effect.color, 0.12);
      aura.setName('statusAura');
      aura.setStrokeStyle(2, effect.color, 0.58);
      token.addAt(aura, 0);
    }
  }

  private processAnimationEvents(events: CombatAnimationEvent[]) {
    if (!this.snapshot) return;
    for (const event of events) {
      const key = event.id || `${event.roundNumber}:${event.stepIndex}:${event.type}:${event.actorId ?? ''}:${event.targetId ?? ''}:${event.value ?? ''}`;
      if (this.processedEvents.has(key)) continue;
      this.processedEvents.add(key);
      if (this.processedEvents.size > 160) {
        this.processedEvents = new Set([...this.processedEvents].slice(-80));
      }
      this.playAnimationEvent(event);
    }
  }

  private playAnimationEvent(event: CombatAnimationEvent) {
    const snapshot = this.snapshot;
    const adapter = this.getAdapter();
    if (!snapshot || !adapter) return;
    const actorToken = event.actorId ? this.tokenById.get(event.actorId) : undefined;
    const targetToken = event.targetId ? this.tokenById.get(event.targetId) : undefined;
      const inferred = getBattleEffect(event.hitEffectId ?? event.impactEffectId ?? event.visualEffectId, inferEffectIdForAnimation(event));

    if (event.type === 'move_token' && actorToken && event.from && event.to) {
      const from = adapter.getCellCenter(event.from.x, event.from.y);
      const to = adapter.getCellCenter(event.to.x, event.to.y);
      actorToken.setPosition(from.x, from.y);
      this.tweens.add({
        targets: actorToken,
        x: to.x,
        y: to.y,
        duration: event.movementType === 'dash' ? 210 : 320,
        ease: 'Sine.easeInOut',
      });
      return;
    }

    if (event.type === 'attack_bump' && actorToken) {
      const originalX = actorToken.x;
      const originalY = actorToken.y;
      const targetX = targetToken?.x ?? originalX;
      const targetY = targetToken?.y ?? originalY;
      const dx = Math.sign(targetX - originalX) * Math.min(14, adapter.cellSize * 0.24);
      const dy = Math.sign(targetY - originalY) * Math.min(14, adapter.cellSize * 0.24);
      this.tweens.add({
        targets: actorToken,
        x: originalX + dx,
        y: originalY + dy,
        yoyo: true,
        duration: 90,
        ease: 'Quad.easeOut',
      });
      if (targetToken) this.flashImpact(targetToken.x, targetToken.y, inferred.color, inferred.secondaryColor);
      return;
    }

    if (event.type === 'projectile' && event.from && event.to) {
      const from = adapter.getProjectileStart(event.from.x, event.from.y);
      const to = adapter.getProjectileEnd(event.to.x, event.to.y);
      const effect = getBattleEffect(event.projectileEffectId ?? event.visualEffectId, 'projectile_arrow');
      const projectile = this.add.circle(from.x, from.y, effect.radius ?? 4, effect.color, 1).setDepth(40);
      this.tweens.add({
        targets: projectile,
        x: to.x,
        y: to.y,
        duration: effect.durationMs ?? 360,
        ease: 'Sine.easeIn',
        onComplete: () => {
          projectile.destroy();
          const impact = getBattleEffect(event.impactEffectId, 'impact_blood');
          this.flashImpact(to.x, to.y, impact.color, impact.secondaryColor);
        },
      });
      return;
    }

    if ((event.type === 'damage_number' || event.type === 'heal_number') && targetToken) {
      const text = event.type === 'heal_number' ? `+${event.value ?? 0}` : `-${event.value ?? 0}`;
      this.floatText(targetToken.x, targetToken.y - adapter.cellSize * 0.35, text, event.type === 'heal_number' ? '#7dff9a' : '#ffdf8a');
      this.flashImpact(targetToken.x, targetToken.y, inferred.color, inferred.secondaryColor);
      return;
    }

    if (event.type === 'block_flash' && targetToken) {
      this.flashImpact(targetToken.x, targetToken.y, 0x8ed8ff, 0xffffff);
      return;
    }

    if (event.type === 'dodge_step' && targetToken) {
      this.tweens.add({ targets: targetToken, x: targetToken.x + 12, yoyo: true, duration: 80 });
      return;
    }

    if (event.type === 'death_fade' && targetToken) {
      this.tweens.add({ targets: targetToken, alpha: 0.22, scale: 0.82, duration: 420 });
      return;
    }

    if (event.type === 'loot_spawn' && event.to) {
      const to = adapter.getCellCenter(event.to.x, event.to.y);
      this.floatText(to.x, to.y, 'LOOT', '#f6d47b');
      this.flashImpact(to.x, to.y, 0xf6d47b, 0xffffff);
    }
  }

  private flashImpact(x: number, y: number, color: number, secondaryColor?: number) {
    const circle = this.add.circle(x, y, 8, color, 0.35).setDepth(45);
    circle.setStrokeStyle(2, secondaryColor ?? color, 0.8);
    this.tweens.add({
      targets: circle,
      scale: 2.4,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => circle.destroy(),
    });
  }

  private floatText(x: number, y: number, value: string, color: string) {
    const text = this.add.text(x, y, value, {
      color,
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      fontStyle: '700',
      stroke: '#1a1110',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 760,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }
}

export function PhaserBattleRenderer(props: PhaserBattleRendererProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<PhaserBattleScene | null>(null);
  const [hostSize, setHostSize] = useState({ width: 720, height: 520 });

  const viewport = useMemo(() => buildViewport(props), [
    props.battleMapHeight,
    props.battleMapWidth,
    props.distance,
    props.entities,
    props.playerId,
    props.viewportHeight,
    props.viewportWidth,
  ]);

  const sceneCellSize = useMemo(() => {
    const cellByWidth = Math.floor(Math.max(1, hostSize.width) / viewport.width);
    const cellByHeight = Math.floor(Math.max(1, hostSize.height) / viewport.height);
    return Math.max(22, Math.min(cellByWidth, cellByHeight));
  }, [hostSize.height, hostSize.width, viewport.height, viewport.width]);

  const snapshot = useMemo<RendererSnapshot>(() => ({
    ...props,
    widthPx: hostSize.width,
    heightPx: Math.max(320, hostSize.height),
    viewport,
    sceneCellSize,
  }), [hostSize.height, hostSize.width, props, sceneCellSize, viewport]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      setHostSize({
        width: Math.max(360, Math.floor(rect.width || 720)),
        height: Math.max(360, Math.floor(rect.height || 520)),
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || gameRef.current) return undefined;
    const scene = new PhaserBattleScene();
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: snapshot.widthPx,
      height: snapshot.heightPx,
      backgroundColor: '#120e09',
      scene,
      scale: {
        mode: Phaser.Scale.NONE,
      },
      render: {
        antialias: true,
        pixelArt: false,
      },
    });
    gameRef.current = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 2) {
        event.preventDefault();
      }
      const scene = sceneRef.current;
      const adapter = scene?.['getAdapter']?.();
      if (!scene || !adapter) return;
      const rect = host.getBoundingClientRect();
      const cell = adapter.screenToCell(event.clientX - rect.left, event.clientY - rect.top);
      if (!cell) return;
      const placements = getBattlefieldTilePlacements(props.entities, props.distance, props.battleMapWidth, props.battleMapHeight);
      const placement = placements.find((entry) => entry.x === cell.x && entry.y === cell.y);
      const entity = placement ? props.entities.find((entry) => entry.id === placement.entityId) : null;
      if (entity) {
        props.onTargetSelect?.(entity.id);
        if (event.button === 0 && entity.team === TeamSide.Right) {
          props.onQuickAttack?.(entity.id);
        }
        if (event.button === 2) {
          props.onInspectEntity?.(entity.id);
        }
        return;
      }
      if (props.selectedHotbarItemId && props.onQuickUseSelectedItemAt) {
        props.onQuickUseSelectedItemAt({ kind: 'cell', x: cell.x, y: cell.y });
        return;
      }
      const movable = buildMovableCells(props).get(`${cell.x}:${cell.y}`);
      if (movable) {
        props.onMoveTileSelect?.({ x: cell.x, y: cell.y, movementType: movable.movementType, willTriggerOpportunity: movable.willTriggerOpportunity });
      }
    };
    host.addEventListener('pointerdown', onPointerDown);
    return () => host.removeEventListener('pointerdown', onPointerDown);
  }, [props]);

  return (
    <div className="battle-field tactical-field phaser-battle-renderer">
      <div className="tactical-header">
        <h3>Phaser Battlefield</h3>
        <div className="tactical-distance-indicator">Distance: {props.distance} | LMB: action/select | RMB: inspect | Renderer: Phaser</div>
      </div>
      <div ref={hostRef} className="phaser-battle-host" />
      <div className="tactical-info">
        <div className="tactical-info-item"><span>Renderer:</span> <strong>Phaser</strong></div>
        <div className="tactical-info-item"><span>Grid:</span> <strong>{props.battleMapWidth}x{props.battleMapHeight}</strong></div>
      </div>
    </div>
  );
}
