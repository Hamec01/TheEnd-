import {
  BattlefieldTileType,
  DistanceBand,
  MovementType,
  TeamSide,
  getBattlefieldTilePlacements,
  type ArenaCombatEntity,
  type BattlefieldTile,
  type CombatAnimationEvent,
  type VisualFxDefinition,
} from '@theend/rpg-domain';
import Phaser from 'phaser';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleFieldProps } from '../BattleField';
import { createBattleInteractionAdapter, getEntitiesForBattleRender } from '../battleInteractionAdapter';
import { createBattleGridAdapter, type BattleGridViewport } from '../gridCoordinateAdapter';
import { getBattleEffect, inferEffectIdForAnimation, type CameraShakePreset } from '../../phaser/effects/battleEffectRegistry';
import { PhaserVisualFxPlayer } from '../../phaser/effects/PhaserVisualFxPlayer';
import type { CombatContextAction, ClickedCombatTarget } from '../combatContextActions';
import { getMovementTweenDurationMs, type BattlePlaybackPhase } from '../playback/buildBattlePlaybackTimeline';
import {
  DETERMINISTIC_BANDIT_CANDIDATES,
  normalizeActorVisualSource,
  pickDeterministicBanditPortrait,
  resolveActorPortraitWithFallback,
} from '../../phaser/assets/actorVisualResolver';
import { resolvePhaserAsset } from '../../phaser/assets/phaserAssetRegistry';
import { visualFxService } from '../../services/content/visualFxService';

const IS_DEV = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
const STATIC_ACTOR_TEXTURE_SOURCES = [...DETERMINISTIC_BANDIT_CANDIDATES, '/sprites/actor/human_01.png'] as const;

type PhaserBattleRendererProps = BattleFieldProps;

interface RendererSnapshot extends PhaserBattleRendererProps {
  widthPx: number;
  heightPx: number;
  viewport: BattleGridViewport;
  sceneCellSize: number;
  visualFxDefinitions: VisualFxDefinition[];
}

function isBanditLike(entity: ArenaCombatEntity): boolean {
  const id = entity.id.toLowerCase();
  const name = entity.name.toLowerCase();
  return entity.team === TeamSide.Right
    || id.includes('bandit')
    || name.includes('bandit')
    || name.includes('бандит')
    || name.includes('разбой');
}

function getRacePortrait(entity: ArenaCombatEntity, playerId: string, playerAvatarUrl?: string): string {
  const explicitAvatar = normalizeActorVisualSource(entity.avatarUrl);
  if (explicitAvatar) return explicitAvatar;

  if (entity.id === playerId) {
    const playerAvatar = normalizeActorVisualSource(playerAvatarUrl);
    if (playerAvatar) {
      return playerAvatar;
    }
  }

  const banditLike = isBanditLike(entity);
  if (banditLike) {
    return pickDeterministicBanditPortrait(entity.id);
  }
  const raceKey = String(entity.race).toLowerCase();
  const raceFallback = raceKey.includes('dwarf')
    ? '/art/races/dwarf.png'
    : raceKey.includes('elf')
      ? '/art/races/elf.png'
      : '/art/races/human.png';

  return resolveActorPortraitWithFallback(undefined, {
    entityId: entity.id,
    isBanditLike: banditLike,
    fallback: raceFallback,
  });
}

function buildViewport(props: BattleFieldProps): BattleGridViewport {
  const width = Math.max(4, Math.min(props.battleMapWidth, props.viewportWidth));
  const height = Math.max(4, Math.min(props.battleMapHeight, props.viewportHeight));
  const entitiesForRender = getEntitiesForBattleRender(props);
  const playerPlacement = getBattlefieldTilePlacements(entitiesForRender, props.distance, props.battleMapWidth, props.battleMapHeight)
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

class PhaserBattleScene extends Phaser.Scene {
  private snapshot: RendererSnapshot | null = null;
  private gridGraphics?: Phaser.GameObjects.Graphics;
  private fxGraphics?: Phaser.GameObjects.Graphics;
  private visualFxPlayer?: PhaserVisualFxPlayer;
  private bg?: Phaser.GameObjects.Image;
  private tokenById = new Map<string, Phaser.GameObjects.Container>();
  private statusVfxByEntity = new Map<string, Map<string, Phaser.GameObjects.GameObject[]>>();
  private particleTextureKey = '__battle_fx_dot';
  private processedEvents = new Set<string>();
  private loadedImages = new Set<string>();
  private tokenPortraitKeyById = new Map<string, string>();
  private movingTokenIds = new Set<string>();
  private activeMoveTweenByActor = new Map<string, Phaser.Tweens.Tween>();
  private actorVisualCells = new Map<string, { x: number; y: number }>();
  private playedMoveTokenKeys = new Set<string>();
  private tokenPositionInitialized = new Set<string>();
  private dynamicAudioKeyBySource = new Map<string, string>();
  private pendingDynamicAudioKeys = new Set<string>();
  private failedDynamicAudioSources = new Set<string>();
  private nextDynamicAudioId = 0;
  private lastPlaybackSignature = '';
  private playbackRunId = 0;

  private addCircularPortrait(
    token: Phaser.GameObjects.Container,
    imageKey: string,
    size: number,
  ) {
    const existingImage = token.getByName('portraitImage') as Phaser.GameObjects.Image | null;
    const portraitSize = Math.max(12, size - 6);
    const circularTextureKey = this.ensureCircularPortraitTexture(imageKey, portraitSize);
    if (!circularTextureKey) {
      return;
    }
    if (existingImage?.texture?.key === circularTextureKey) {
      return;
    }

    existingImage?.destroy();
    const existingMaskShape = token.getByName('portraitMask') as Phaser.GameObjects.Graphics | null;
    existingMaskShape?.destroy();

    const image = this.add.image(0, -1, circularTextureKey)
      .setDisplaySize(portraitSize, portraitSize)
      .setName('portraitImage');
    token.addAt(image, 1);

    const label = token.getByName('portraitLabel') as Phaser.GameObjects.Text | null;
    label?.setVisible(false);
  }

  private ensureCircularPortraitTexture(imageKey: string, size: number): string | null {
    const frame = this.textures.getFrame(imageKey);
    if (!frame) {
      return null;
    }

    const circularKey = `${imageKey}::circle::${size}`;
    if (this.textures.exists(circularKey)) {
      return circularKey;
    }

    const canvasTexture = this.textures.createCanvas(circularKey, size, size);
    if (!canvasTexture) {
      return null;
    }
    const context = canvasTexture.context;
    const sourceImage = frame.source.image as CanvasImageSource | undefined;
    if (!context || !sourceImage) {
      this.textures.remove(circularKey);
      return null;
    }

    const sourceWidth = Math.max(1, frame.cutWidth || frame.width);
    const sourceHeight = Math.max(1, frame.cutHeight || frame.height);
    const square = Math.max(1, Math.min(sourceWidth, sourceHeight));
    const cropX = Math.max(0, Math.floor((sourceWidth - square) / 2));
    const cropY = Math.max(0, Math.min(
      Math.floor((sourceHeight - square) * 0.18),
      sourceHeight - square,
    ));

    context.clearRect(0, 0, size, size);
    context.save();
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    context.drawImage(
      sourceImage,
      (frame.cutX || 0) + cropX,
      (frame.cutY || 0) + cropY,
      square,
      square,
      0,
      0,
      size,
      size,
    );
    context.restore();
    canvasTexture.refresh();
    return circularKey;
  }

  private isDirectAudioSource(value: string): boolean {
    return value.startsWith('/')
      || value.startsWith('http://')
      || value.startsWith('https://')
      || value.startsWith('data:audio/');
  }

  private playLoadedSound(soundKey: string, volume: number) {
    try {
      const targetVolume = Math.max(0, Math.min(1, volume));
      const sound = this.sound.add(soundKey, { volume: 0 });
      const started = sound.play();
      if (!started) {
        sound.destroy();
        return;
      }

      sound.once(Phaser.Sound.Events.COMPLETE, () => {
        sound.destroy();
      });

      this.tweens.add({
        targets: sound,
        volume: targetVolume,
        duration: 90,
        ease: 'Sine.easeOut',
      });
    } catch {
      // Keep playback non-blocking when audio decode is not ready yet.
    }
  }

  private playDynamicAudioSource(source: string, volume: number) {
    if (this.failedDynamicAudioSources.has(source)) {
      return;
    }

    const existingKey = this.dynamicAudioKeyBySource.get(source);
    if (existingKey && this.cache.audio.exists(existingKey)) {
      this.playLoadedSound(existingKey, volume);
      return;
    }

    const key = existingKey ?? `battle-audio-${this.nextDynamicAudioId += 1}`;
    if (!existingKey) {
      this.dynamicAudioKeyBySource.set(source, key);
    }

    if (this.pendingDynamicAudioKeys.has(key)) {
      return;
    }

    this.pendingDynamicAudioKeys.add(key);
    this.load.audio(key, source);
    this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.key === key) {
        this.failedDynamicAudioSources.add(source);
        this.pendingDynamicAudioKeys.delete(key);
      }
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.pendingDynamicAudioKeys.delete(key);
      if (this.cache.audio.exists(key)) {
        this.playLoadedSound(key, volume);
      }
    });

    if (!this.load.isLoading()) {
      this.load.start();
    }
  }

  private getAudioSettings(): { muted: boolean; volume: number } {
    if (typeof window === 'undefined') {
      return { muted: false, volume: 1 };
    }
    const mutedKeys = ['theend.audio.mute', 'theend.sound.mute'];
    const volumeKeys = ['theend.audio.volume', 'theend.sound.volume'];
    const muted = mutedKeys.some((key) => {
      const value = window.localStorage.getItem(key);
      return value === 'true' || value === '1';
    });
    const rawVolume = volumeKeys
      .map((key) => window.localStorage.getItem(key))
      .find((value) => value !== null);
    const parsed = rawVolume ? Number(rawVolume) : 1;
    const volume = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 1;
    return { muted, volume };
  }

  private applyCameraShake(preset?: CameraShakePreset) {
    if (!preset || preset === 'none') {
      return;
    }
    const intensity = preset === 'heavy' ? 0.012 : preset === 'medium' ? 0.008 : 0.004;
    const duration = preset === 'heavy' ? 200 : preset === 'medium' ? 150 : 110;
    this.cameras.main.shake(duration, intensity);
  }

  private playSoundSafe(soundId?: string, volumeMultiplier?: number) {
    const normalizedSoundId = String(soundId ?? '').trim();
    if (!normalizedSoundId) {
      return;
    }
    if (!this.sys.isActive()) {
      return;
    }
    const settings = this.getAudioSettings();
    const normalizedMultiplier = Number.isFinite(volumeMultiplier)
      ? Math.max(0, Math.min(1, Number(volumeMultiplier)))
      : 1;
    const finalVolume = Math.max(0, Math.min(1, settings.volume * normalizedMultiplier));
    if (settings.muted || finalVolume <= 0) {
      return;
    }
    try {
      const manager = this.sound as unknown as { context?: AudioContext | null };
      const contextState = manager.context?.state;
      if (contextState === 'closed') {
        return;
      }

      if (this.cache.audio.exists(normalizedSoundId)) {
        this.playLoadedSound(normalizedSoundId, finalVolume);
        return;
      }

      if (this.isDirectAudioSource(normalizedSoundId)) {
        this.playDynamicAudioSource(normalizedSoundId, finalVolume);
        return;
      }

      const bundledAsset = resolvePhaserAsset(normalizedSoundId);
      if (bundledAsset.kind === 'audio' && bundledAsset.url && bundledAsset.url !== normalizedSoundId) {
        if (bundledAsset.optional) {
          return;
        }
        this.playDynamicAudioSource(bundledAsset.url, finalVolume);
        return;
      }

      // Treat custom ids as content audio assets and resolve them through backend raw endpoint.
      const resolvedAssetSource = `/api/content/assets/audio/${encodeURIComponent(normalizedSoundId)}/raw`;
      this.playDynamicAudioSource(resolvedAssetSource, finalVolume);
    } catch {
      // Asset may be missing or not yet decoded; keep playback non-blocking.
    }
  }

  constructor() {
    super({ key: 'PhaserBattleScene' });
  }

  setSnapshot(snapshot: RendererSnapshot) {
    this.snapshot = snapshot;
    this.visualFxPlayer?.setRegistry(snapshot.visualFxDefinitions);
    if (this.gridGraphics) {
      this.renderSnapshot();
    }
  }

  startPlaybackTimeline(phases: BattlePlaybackPhase[], externalRunId: number, onComplete?: (runId: number) => void) {
    const signature = `${externalRunId}:${phases.map((phase) => phase.id).join('|')}`;
    if (!signature || signature === this.lastPlaybackSignature) {
      return;
    }
    this.lastPlaybackSignature = signature;
    const internalRunId = ++this.playbackRunId;
    void this.runPlaybackTimeline(phases, internalRunId, externalRunId, onComplete);
  }

  clearPlaybackTimeline() {
    this.lastPlaybackSignature = '';
    this.playbackRunId += 1;
  }

  create() {
    this.input.mouse?.disableContextMenu();
    this.ensureProceduralParticleTexture();
    this.visualFxPlayer = new PhaserVisualFxPlayer(this);
    if (this.snapshot) {
      this.visualFxPlayer.setRegistry(this.snapshot.visualFxDefinitions);
    }
    this.gridGraphics = this.add.graphics();
    this.fxGraphics = this.add.graphics();
    this.renderSnapshot();
  }

  preload() {
    for (const source of STATIC_ACTOR_TEXTURE_SOURCES) {
      const key = `actor-static:${source}`;
      if (this.textures.exists(key)) {
        continue;
      }
      this.load.image(key, source);
    }
  }

  private ensureProceduralParticleTexture() {
    if (this.textures.exists(this.particleTextureKey)) {
      return;
    }
    const g = this.add.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture(this.particleTextureKey, 8, 8);
    g.destroy();
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
    const interaction = createBattleInteractionAdapter(snapshot);
    const movableCells = interaction.movableCells;
    const targetableCells = interaction.targetableCells;
    const entitiesForRender = interaction.entitiesForRender;
    const entitiesByState = snapshot.entities;
    const placementsForRender = interaction.placements;
    const placementsByState = getBattlefieldTilePlacements(entitiesByState, snapshot.distance, snapshot.battleMapWidth, snapshot.battleMapHeight);
    const renderPlacementById = new Map(placementsForRender.map((placement) => [placement.entityId, placement]));
    const statePlacementById = new Map(placementsByState.map((placement) => [placement.entityId, placement]));
    const trapById = new Map((snapshot.battlefieldTraps ?? []).map((trap) => [trap.id, trap]));
    const visibleTrapByCell = new Set<string>();
    for (const tile of snapshot.battlefieldTiles) {
      if (!tile.trapId) {
        continue;
      }
      const trap = trapById.get(tile.trapId);
      if (!trap || trap.isActive === false) {
        continue;
      }
      visibleTrapByCell.add(`${tile.x}:${tile.y}`);
    }
    const exitZoneByCell = new Map<string, { id: string; team?: 'player' | 'enemy' | 'any' }>();
    for (const zone of snapshot.exitZones ?? []) {
      for (const cell of zone.cells ?? []) {
        exitZoneByCell.set(`${cell.x}:${cell.y}`, { id: zone.id, team: zone.team });
      }
    }
    const lootByCell = new Set<string>();
    for (const container of snapshot.lootContainers ?? []) {
      if (container.claimed) {
        continue;
      }
      lootByCell.add(`${container.x}:${container.y}`);
    }

    for (let row = 0; row < snapshot.viewport.height; row += 1) {
      for (let col = 0; col < snapshot.viewport.width; col += 1) {
        const x = snapshot.viewport.offsetX + col;
        const y = snapshot.viewport.offsetY + row;
        const topLeft = adapter.cellToScreen(x, y);
        const key = `${x}:${y}`;
        const tile = interaction.tileByKey.get(key);
        const isSelected = snapshot.selectedMoveTile?.x === x && snapshot.selectedMoveTile?.y === y;
        const isBlocked = interaction.getTileMovementBlocked(x, y);
        const fill = isBlocked
          ? 0x2b1e1a
          : isSelected
            ? 0x547ad8
            : movableCells.has(key)
              ? 0x285a3f
              : targetableCells.has(key)
                ? 0x5d4630
                : 0x000000;
        const alpha = isBlocked || isSelected || movableCells.has(key) || targetableCells.has(key) ? 0.36 : 0.08;
        this.gridGraphics.fillStyle(fill, alpha);
        this.gridGraphics.fillRect(topLeft.x, topLeft.y, adapter.cellSize, adapter.cellSize);
        this.gridGraphics.lineStyle(1, 0xf4ddb0, 0.18);
        this.gridGraphics.strokeRect(topLeft.x, topLeft.y, adapter.cellSize, adapter.cellSize);

        const tileType = tile?.type;
        if (tileType === BattlefieldTileType.HighCover || tileType === BattlefieldTileType.LowCover) {
          this.gridGraphics.fillStyle(0x8dc8ff, tileType === BattlefieldTileType.HighCover ? 0.55 : 0.35);
          this.gridGraphics.fillRect(topLeft.x + 4, topLeft.y + 4, Math.max(4, adapter.cellSize * 0.3), Math.max(4, adapter.cellSize * 0.18));
        } else if (tileType === BattlefieldTileType.Hazard) {
          this.gridGraphics.lineStyle(2, 0xff9a52, 0.8);
          this.gridGraphics.strokeRect(topLeft.x + 4, topLeft.y + 4, Math.max(6, adapter.cellSize - 8), Math.max(6, adapter.cellSize - 8));
        } else if (tileType === BattlefieldTileType.Summon) {
          this.gridGraphics.fillStyle(0xc1a7ff, 0.7);
          this.gridGraphics.fillCircle(topLeft.x + adapter.cellSize * 0.5, topLeft.y + adapter.cellSize * 0.25, Math.max(3, adapter.cellSize * 0.1));
        }

        if (visibleTrapByCell.has(key)) {
          this.gridGraphics.fillStyle(0xff7a7a, 0.85);
          this.gridGraphics.beginPath();
          this.gridGraphics.moveTo(topLeft.x + adapter.cellSize * 0.5, topLeft.y + adapter.cellSize * 0.2);
          this.gridGraphics.lineTo(topLeft.x + adapter.cellSize * 0.74, topLeft.y + adapter.cellSize * 0.58);
          this.gridGraphics.lineTo(topLeft.x + adapter.cellSize * 0.26, topLeft.y + adapter.cellSize * 0.58);
          this.gridGraphics.closePath();
          this.gridGraphics.fillPath();
        }

        const exitZone = exitZoneByCell.get(key);
        if (exitZone) {
          const exitColor = exitZone.team === 'enemy' ? 0xff6767 : exitZone.team === 'player' ? 0x66e2ff : 0xa5f7ff;
          this.gridGraphics.lineStyle(2, exitColor, 0.85);
          this.gridGraphics.strokeRect(topLeft.x + 2, topLeft.y + 2, Math.max(4, adapter.cellSize - 4), Math.max(4, adapter.cellSize - 4));
        }

        if (lootByCell.has(key)) {
          this.gridGraphics.fillStyle(0xf6d47b, 0.9);
          this.gridGraphics.beginPath();
          this.gridGraphics.moveTo(topLeft.x + adapter.cellSize * 0.5, topLeft.y + adapter.cellSize * 0.15);
          this.gridGraphics.lineTo(topLeft.x + adapter.cellSize * 0.74, topLeft.y + adapter.cellSize * 0.42);
          this.gridGraphics.lineTo(topLeft.x + adapter.cellSize * 0.5, topLeft.y + adapter.cellSize * 0.69);
          this.gridGraphics.lineTo(topLeft.x + adapter.cellSize * 0.26, topLeft.y + adapter.cellSize * 0.42);
          this.gridGraphics.closePath();
          this.gridGraphics.fillPath();
        }
      }
    }

    const aliveEntities = entitiesByState.filter((entity) => entity.isAlive);
    const aliveIds = new Set(aliveEntities.map((entity) => entity.id));
    for (const [id, token] of this.tokenById) {
      if (!aliveIds.has(id)) {
        this.activeMoveTweenByActor.get(id)?.stop();
        this.activeMoveTweenByActor.delete(id);
        this.removeStatusVfx(id);
        token.destroy(true);
        this.tokenById.delete(id);
        this.tokenPortraitKeyById.delete(id);
        this.movingTokenIds.delete(id);
        this.actorVisualCells.delete(id);
        this.tokenPositionInitialized.delete(id);
      }
    }

    for (const entity of aliveEntities) {
      const statePlacement = statePlacementById.get(entity.id);
      const renderPlacement = renderPlacementById.get(entity.id);
      if (!statePlacement && !renderPlacement) continue;

      const moving = this.movingTokenIds.has(entity.id);
      const queuedCell = this.actorVisualCells.get(entity.id);
      const explicitVisualCell = snapshot.visualPositions?.[entity.id] ?? null;
      const stateCell = statePlacement
        ? { x: statePlacement.x, y: statePlacement.y }
        : renderPlacement
          ? { x: renderPlacement.x, y: renderPlacement.y }
          : null;
      const desiredCell = queuedCell
        ?? explicitVisualCell
        ?? stateCell;
      if (!desiredCell) {
        continue;
      }

      const desiredCellSource = queuedCell
        ? 'internal'
        : explicitVisualCell
          ? 'visual'
          : 'entity';

      if (
        queuedCell
        && stateCell
        && queuedCell.x === stateCell.x
        && queuedCell.y === stateCell.y
        && !moving
      ) {
        this.actorVisualCells.delete(entity.id);
      }

      const center = adapter.getCellCenter(desiredCell.x, desiredCell.y);
      const token = this.ensureToken(entity, snapshot);
      if (!moving) {
        const hasInitialPosition = this.tokenPositionInitialized.has(entity.id);
        const shouldSkipEntityForceSync = snapshot.isPlaybackActive && desiredCellSource === 'entity' && hasInitialPosition;
        if (!shouldSkipEntityForceSync) {
          token.setPosition(center.x, center.y);
          this.tokenPositionInitialized.add(entity.id);
        }
      }
      token.setDepth(entity.id === snapshot.playerId ? 20 : 18);
      token.setAlpha(1);
      token.setScale(entity.id === snapshot.selectedTargetId || entity.id === snapshot.playerId ? 1.08 : 1);
      this.drawTokenStatus(token, entity, snapshot);
    }

    this.processAnimationEvents(snapshot.animationEvents ?? []);
  }

  private async runPlaybackTimeline(
    phases: BattlePlaybackPhase[],
    internalRunId: number,
    externalRunId: number,
    onComplete?: (runId: number) => void,
  ) {
    for (const phase of phases) {
      if (internalRunId !== this.playbackRunId) {
        return;
      }

      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.debug('[PhaserBattle playback phase]', {
          id: phase.id,
          kind: phase.kind,
          count: phase.events.length,
          durationMs: phase.durationMs,
          mode: phase.mode,
          actorIds: phase.actorIds,
        });
      }

      if (phase.kind === 'movement') {
        if (IS_DEV) {
          // eslint-disable-next-line no-console
          console.debug('[PhaserBattle movement phase]', {
            count: phase.events.length,
            actorIds: phase.actorIds,
            durationMs: phase.durationMs,
            parallel: true,
          });
        }
        await this.playMovementPhase(phase, internalRunId);
        continue;
      }

      for (const event of phase.events) {
        this.playAnimationEvent(event);
      }
      await new Promise<void>((resolve) => {
        this.time.delayedCall(phase.durationMs, () => resolve());
      });
    }

    if (internalRunId === this.playbackRunId) {
      onComplete?.(externalRunId);
    }
  }

  private async playMovementPhase(phase: BattlePlaybackPhase, runId: number) {
    const adapter = this.getAdapter();
    if (!adapter) {
      return;
    }

    const movementEvents = phase.events.filter((event) => event.type === 'move_token' && event.actorId && event.from && event.to);
    const tweenPromises = movementEvents.map((event) => new Promise<void>((resolve) => {
      if (runId !== this.playbackRunId || !event.actorId || !event.from || !event.to) {
        resolve();
        return;
      }

      const moveKey = this.getMoveTokenKey(event);
      this.playedMoveTokenKeys.add(moveKey);
      if (this.playedMoveTokenKeys.size > 2000) {
        this.playedMoveTokenKeys = new Set([...this.playedMoveTokenKeys].slice(-1200));
      }

      const token = this.tokenById.get(event.actorId);
      if (!token) {
        this.actorVisualCells.set(event.actorId, { x: event.to.x, y: event.to.y });
        resolve();
        return;
      }

      const from = adapter.getCellCenter(event.from.x, event.from.y);
      const to = adapter.getCellCenter(event.to.x, event.to.y);
      const duration = getMovementTweenDurationMs(event);

      this.activeMoveTweenByActor.get(event.actorId)?.stop();
      this.movingTokenIds.add(event.actorId);
      this.actorVisualCells.set(event.actorId, { x: event.from.x, y: event.from.y });
      token.setPosition(from.x, from.y);
      this.tokenPositionInitialized.add(event.actorId);

      const tween = this.tweens.add({
        targets: token,
        x: to.x,
        y: to.y,
        duration,
        ease: event.movementType === 'dash'
          ? 'Cubic.easeOut'
          : event.movementType === 'disengage'
            ? 'Sine.easeInOut'
            : 'Sine.easeInOut',
        onComplete: () => {
          this.actorVisualCells.set(event.actorId!, { x: event.to!.x, y: event.to!.y });
          this.movingTokenIds.delete(event.actorId!);
          this.activeMoveTweenByActor.delete(event.actorId!);
          resolve();
        },
      });
      this.activeMoveTweenByActor.set(event.actorId, tween);
    }));

    await Promise.all(tweenPromises);
  }

  private ensureBackground(snapshot: RendererSnapshot) {
    const url = snapshot.mapImageUrl || '/map/battle-map_arena.png';
    const key = `battle-bg:${url}`;
    if (this.textures.exists(key)) {
      const gridOffsetX = snapshot.mapCalibration?.gridOffsetX ?? 0;
      const gridOffsetY = snapshot.mapCalibration?.gridOffsetY ?? 0;
      const fullMapPixelWidth = gridOffsetX * 2 + snapshot.battleMapWidth * snapshot.sceneCellSize;
      const fullMapPixelHeight = gridOffsetY * 2 + snapshot.battleMapHeight * snapshot.sceneCellSize;
      const backgroundOffsetX = gridOffsetX - snapshot.viewport.offsetX * snapshot.sceneCellSize;
      const backgroundOffsetY = gridOffsetY - snapshot.viewport.offsetY * snapshot.sceneCellSize;
      if (!this.bg) {
        this.bg = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(-10);
      } else {
        this.bg.setTexture(key);
      }
      this.bg.setPosition(backgroundOffsetX, backgroundOffsetY);
      this.bg.setDisplaySize(fullMapPixelWidth, fullMapPixelHeight);
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
    const portrait = getRacePortrait(entity, snapshot.playerId, snapshot.playerAvatarUrl);
    const imageKey = `actor:${portrait}`;
    const staticImageKey = portrait.startsWith('/sprites/actor/') ? `actor-static:${portrait}` : null;
    const fallbackPortrait = isBanditLike(entity)
      ? pickDeterministicBanditPortrait(entity.id)
      : '/sprites/actor/human_01.png';
    const fallbackImageKey = `actor:${fallbackPortrait}`;
    const fallbackStaticImageKey = `actor-static:${fallbackPortrait}`;

    const ensureLoadedPortrait = (targetToken: Phaser.GameObjects.Container, key: string, source: string, size: number) => {
      if (staticImageKey && this.textures.exists(staticImageKey)) {
        this.addCircularPortrait(targetToken, staticImageKey, size);
        this.tokenPortraitKeyById.set(entity.id, staticImageKey);
        return;
      }

      if (this.textures.exists(key)) {
        this.addCircularPortrait(targetToken, key, size);
        this.tokenPortraitKeyById.set(entity.id, key);
        return;
      }

      if (this.textures.exists(fallbackStaticImageKey)) {
        this.addCircularPortrait(targetToken, fallbackStaticImageKey, size);
        this.tokenPortraitKeyById.set(entity.id, fallbackStaticImageKey);
      }

      if (!this.loadedImages.has(key)) {
        this.loadedImages.add(key);

        const onFileError = (file: Phaser.Loader.File) => {
          if (file.key !== key) {
            return;
          }
          if (!this.loadedImages.has(fallbackImageKey)) {
            this.loadedImages.add(fallbackImageKey);
            this.load.image(fallbackImageKey, fallbackPortrait);
          }
        };

        this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
        this.load.image(key, source);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
          const sceneToken = this.tokenById.get(entity.id);
          if (!sceneToken) return;
          if (this.textures.exists(key)) {
            this.addCircularPortrait(sceneToken, key, size);
            this.tokenPortraitKeyById.set(entity.id, key);
          } else if (this.textures.exists(fallbackStaticImageKey)) {
            this.addCircularPortrait(sceneToken, fallbackStaticImageKey, size);
            this.tokenPortraitKeyById.set(entity.id, fallbackStaticImageKey);
          } else if (this.textures.exists(fallbackImageKey)) {
            this.addCircularPortrait(sceneToken, fallbackImageKey, size);
            this.tokenPortraitKeyById.set(entity.id, fallbackImageKey);
          }
          this.renderSnapshot();
        });
        this.load.start();
      }
    };

    if (existing) {
      const size = Math.max(24, Math.floor(snapshot.sceneCellSize * 0.72));
      const currentPortraitKey = this.tokenPortraitKeyById.get(entity.id);
      if (currentPortraitKey !== imageKey || !existing.getByName('portraitImage')) {
        ensureLoadedPortrait(existing, imageKey, portrait, size);
      }
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
    }).setOrigin(0.5).setName('portraitLabel');
    const hpBack = this.add.rectangle(0, size * 0.48, size * 0.9, 4, 0x1b1612, 0.9);
    const hpFill = this.add.rectangle(-size * 0.45, size * 0.48, size * 0.9, 4, 0x5de082, 1).setOrigin(0, 0.5);
    hpFill.setName('hpFill');
    token.add([base, label, hpBack, hpFill]);
    token.setSize(size, size);
    this.tokenById.set(entity.id, token);
    this.tokenPositionInitialized.delete(entity.id);

    ensureLoadedPortrait(token, imageKey, portrait, size);

    return token;
  }

  private drawTokenStatus(token: Phaser.GameObjects.Container, entity: ArenaCombatEntity, snapshot: RendererSnapshot) {
    const hpFill = token.getByName('hpFill') as Phaser.GameObjects.Rectangle | null;
    if (hpFill) {
      const baseWidth = Math.max(24, Math.floor(snapshot.sceneCellSize * 0.72)) * 0.9;
      hpFill.width = baseWidth * Math.max(0, Math.min(1, entity.currentHp / Math.max(1, entity.maxHp)));
    }
    const activeStatuses = (entity.activeCombatStatuses ?? []).filter((status) => status.remainingTurns > 0);
    const keep = new Set<string>();
    for (const status of activeStatuses) {
      const statusKey = status.rawStatusId ?? status.id;
      keep.add(statusKey);
      this.attachStatusVfx(entity.id, token, statusKey);
    }

    const bucket = this.statusVfxByEntity.get(entity.id);
    if (bucket) {
      for (const statusId of bucket.keys()) {
        if (!keep.has(statusId)) {
          this.removeStatusVfx(entity.id, statusId);
        }
      }
    }

    if (!entity.isAlive) {
      this.removeStatusVfx(entity.id);
    }
  }

  private processAnimationEvents(events: CombatAnimationEvent[]) {
    if (!this.snapshot) return;
    for (const event of events) {
      if (event.type === 'move_token') {
        continue;
      }

      const key = event.id || `${event.roundNumber}:${event.stepIndex}:${event.type}:${event.actorId ?? ''}:${event.targetId ?? ''}:${event.value ?? ''}`;
      if (this.processedEvents.has(key)) continue;
      this.processedEvents.add(key);
      if (this.processedEvents.size > 2000) {
        this.processedEvents = new Set([...this.processedEvents].slice(-1200));
      }
      this.playAnimationEvent(event);
    }
  }

  private getMoveTokenKey(event: CombatAnimationEvent): string {
    if (event.id) {
      return event.id;
    }
    if (event.actorId && event.from && event.to) {
      return `${event.actorId}:${event.from.x}:${event.from.y}:${event.to.x}:${event.to.y}:${event.roundNumber}:${event.stepIndex}`;
    }
    return `${event.roundNumber}:${event.stepIndex}:move_token:${event.actorId ?? ''}`;
  }

  private playMeleeSlashEffect(params: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    effectId?: string;
  }) {
    if (this.visualFxPlayer?.playFxById(params.effectId, {
      x: (params.fromX + params.toX) / 2,
      y: (params.fromY + params.toY) / 2,
      rotation: Phaser.Math.Angle.Between(params.fromX, params.fromY, params.toX, params.toY),
    })) {
      return;
    }

    const effect = getBattleEffect(params.effectId, 'default_melee_hit');
    const slash = this.add.graphics().setDepth(46);
    const length = Phaser.Math.Distance.Between(params.fromX, params.fromY, params.toX, params.toY);
    const angle = Phaser.Math.Angle.Between(params.fromX, params.fromY, params.toX, params.toY);
    slash.lineStyle(4, effect.color, 0.95);
    slash.beginPath();
    slash.moveTo(-length * 0.2, -8);
    slash.lineTo(length * 0.3, 8);
    slash.strokePath();
    slash.setPosition((params.fromX + params.toX) / 2, (params.fromY + params.toY) / 2);
    slash.setRotation(angle);
    slash.setBlendMode(Phaser.BlendModes.ADD);

    const flash = this.add.circle(params.toX, params.toY, effect.radius ?? 10, effect.secondaryColor ?? 0xffffff, 0.25).setDepth(45);
    flash.setStrokeStyle(2, 0xffffff, 0.7);

    this.tweens.add({
      targets: [slash, flash],
      alpha: 0,
      duration: effect.durationMs ?? 220,
      ease: 'Sine.easeOut',
      onComplete: () => {
        slash.destroy();
        flash.destroy();
      },
    });
  }

  private playImpactEffect(x: number, y: number, effectId?: string) {
    if (this.visualFxPlayer?.playFxById(effectId, { x, y })) {
      return;
    }

    const effect = getBattleEffect(effectId, 'default_impact');
    const ring = this.add.circle(x, y, effect.radius ?? 9, effect.color, 0.28).setDepth(44);
    ring.setStrokeStyle(2, effect.secondaryColor ?? 0xffffff, 0.7);

    const sparks = this.add.particles(x, y, this.particleTextureKey, {
      lifespan: { min: 120, max: 320 },
      speed: { min: 35, max: 120 },
      scale: { start: 0.24, end: 0.01 },
      quantity: 10,
      tint: [effect.color, effect.secondaryColor ?? effect.color, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(47);
    sparks.explode(10, x, y);

    if (effect.id.includes('blood')) {
      const droplet = this.add.particles(x, y, this.particleTextureKey, {
        lifespan: { min: 180, max: 360 },
        speedY: { min: 35, max: 95 },
        speedX: { min: -65, max: 65 },
        gravityY: 160,
        quantity: 8,
        scale: { start: 0.2, end: 0.02 },
        tint: [0x8c1218, 0xcc2f36],
        blendMode: 'NORMAL',
        emitting: false,
      }).setDepth(43);
      droplet.explode(8, x, y);
      this.time.delayedCall(500, () => droplet.destroy());
    }

    if (effect.id.includes('fire')) {
      const fire = this.add.particles(x, y, this.particleTextureKey, {
        lifespan: { min: 180, max: 380 },
        speed: { min: 35, max: 130 },
        quantity: 14,
        scale: { start: 0.35, end: 0.02 },
        tint: [0xff3d00, 0xff8a00, 0xffd54f],
        blendMode: 'ADD',
        emitting: false,
      }).setDepth(47);
      fire.explode(14, x, y);
      this.time.delayedCall(520, () => fire.destroy());
    }

    if (effect.id.includes('ice')) {
      const shard = this.add.particles(x, y, this.particleTextureKey, {
        lifespan: { min: 160, max: 360 },
        speed: { min: 45, max: 155 },
        quantity: 12,
        scale: { start: 0.22, end: 0.02 },
        tint: [0x66ccff, 0xb3ecff, 0xffffff],
        blendMode: 'ADD',
        emitting: false,
      }).setDepth(47);
      shard.explode(12, x, y);
      this.time.delayedCall(520, () => shard.destroy());
    }

    if (effect.id.includes('poison')) {
      const poison = this.add.particles(x, y, this.particleTextureKey, {
        lifespan: { min: 260, max: 560 },
        speed: { min: 20, max: 60 },
        quantity: 10,
        scale: { start: 0.25, end: 0.1 },
        tint: [0x5fef63, 0x8a4dff],
        blendMode: 'ADD',
        emitting: false,
      }).setDepth(45);
      poison.explode(10, x, y);
      this.time.delayedCall(620, () => poison.destroy());
    }

    this.tweens.add({
      targets: ring,
      scale: 2.3,
      alpha: 0,
      duration: effect.durationMs ?? 260,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.time.delayedCall(Math.max(260, effect.durationMs ?? 260), () => sparks.destroy());
  }

  private playProjectileEffect(params: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    projectileEffectId?: string;
    impactEffectId?: string;
    onImpact?: () => void;
  }) {
    if (this.visualFxPlayer?.playProjectileById(params.projectileEffectId, {
      from: params.from,
      to: params.to,
      onImpact: () => {
        this.playImpactEffect(params.to.x, params.to.y, params.impactEffectId);
        params.onImpact?.();
      },
    })) {
      return;
    }

    const projectileEffect = getBattleEffect(params.projectileEffectId, 'arrow_projectile');
    const projectile = this.add.circle(params.from.x, params.from.y, projectileEffect.radius ?? 4, projectileEffect.color, 1).setDepth(40);
    projectile.setStrokeStyle(1, projectileEffect.secondaryColor ?? 0xffffff, 0.9);

    const trail = this.add.particles(projectile.x, projectile.y, this.particleTextureKey, {
      lifespan: { min: 120, max: 260 },
      speed: { min: 4, max: 16 },
      quantity: 1,
      scale: { start: 0.16, end: 0 },
      tint: [projectileEffect.color, projectileEffect.secondaryColor ?? projectileEffect.color],
      blendMode: 'ADD',
      follow: projectile,
    }).setDepth(39);

    this.tweens.add({
      targets: projectile,
      x: params.to.x,
      y: params.to.y,
      duration: projectileEffect.durationMs ?? 360,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        projectile.destroy();
        trail.destroy();
        this.playImpactEffect(params.to.x, params.to.y, params.impactEffectId);
        params.onImpact?.();
      },
    });
  }

  private playSkillMovementBehavior(
    behavior: CombatAnimationEvent['movementBehavior'],
    actorToken: Phaser.GameObjects.Container,
    targetToken: Phaser.GameObjects.Container,
  ): boolean {
    if (!behavior || behavior === 'none') {
      return false;
    }

    const originX = actorToken.x;
    const originY = actorToken.y;
    const dx = targetToken.x - originX;
    const dy = targetToken.y - originY;
    const distance = Phaser.Math.Distance.Between(originX, originY, targetToken.x, targetToken.y);
    const stopShort = Math.min(32, distance * 0.22);
    const travelRatio = distance <= 0 ? 1 : Math.max(0, (distance - stopShort) / distance);
    const strikeX = originX + dx * travelRatio;
    const strikeY = originY + dy * travelRatio;

    if (behavior === 'dash_to_target') {
      this.tweens.add({
        targets: actorToken,
        x: strikeX,
        y: strikeY,
        duration: 110,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.playMeleeSlashEffect({ fromX: strikeX, fromY: strikeY, toX: targetToken.x, toY: targetToken.y, effectId: 'default_melee_hit' });
          this.tweens.add({
            targets: actorToken,
            x: originX,
            y: originY,
            duration: 110,
            ease: 'Quad.easeIn',
          });
        },
      });
      return true;
    }

    const blinkOut = () => {
      this.tweens.add({
        targets: actorToken,
        alpha: 0,
        duration: 60,
        onComplete: () => {
          actorToken.setPosition(strikeX, strikeY);
          this.playImpactEffect(targetToken.x, targetToken.y, 'impact_arcane');
          this.tweens.add({
            targets: actorToken,
            alpha: 1,
            duration: 60,
            onComplete: () => {
              this.playMeleeSlashEffect({ fromX: strikeX, fromY: strikeY, toX: targetToken.x, toY: targetToken.y, effectId: 'default_melee_hit' });
              const returnDelay = behavior === 'teleport_there_and_back' ? 120 : 20;
              this.time.delayedCall(returnDelay, () => {
                this.tweens.add({
                  targets: actorToken,
                  alpha: 0,
                  duration: 60,
                  onComplete: () => {
                    actorToken.setPosition(originX, originY);
                    this.tweens.add({
                      targets: actorToken,
                      alpha: 1,
                      duration: 60,
                    });
                  },
                });
              });
            },
          });
        },
      });
    };

    blinkOut();
    return true;
  }

  private playSkillMovementBehaviorAsync(
    behavior: CombatAnimationEvent['movementBehavior'],
    actorToken: Phaser.GameObjects.Container,
    targetToken: Phaser.GameObjects.Container,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!behavior || behavior === 'none') {
        resolve(false);
        return;
      }

      const originX = actorToken.x;
      const originY = actorToken.y;
      const dx = targetToken.x - originX;
      const dy = targetToken.y - originY;
      const distance = Phaser.Math.Distance.Between(originX, originY, targetToken.x, targetToken.y);
      const stopShort = Math.min(32, distance * 0.22);
      const travelRatio = distance <= 0 ? 1 : Math.max(0, (distance - stopShort) / distance);
      const strikeX = originX + dx * travelRatio;
      const strikeY = originY + dy * travelRatio;

      if (behavior === 'dash_to_target') {
        this.tweens.add({
          targets: actorToken,
          x: strikeX,
          y: strikeY,
          duration: 110,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.playMeleeSlashEffect({ fromX: strikeX, fromY: strikeY, toX: targetToken.x, toY: targetToken.y, effectId: 'default_melee_hit' });
            this.tweens.add({
              targets: actorToken,
              x: originX,
              y: originY,
              duration: 110,
              ease: 'Quad.easeIn',
              onComplete: () => resolve(true),
            });
          },
        });
        return;
      }

      this.tweens.add({
        targets: actorToken,
        alpha: 0,
        duration: 60,
        onComplete: () => {
          actorToken.setPosition(strikeX, strikeY);
          this.playImpactEffect(targetToken.x, targetToken.y, 'impact_arcane');
          this.tweens.add({
            targets: actorToken,
            alpha: 1,
            duration: 60,
            onComplete: () => {
              this.playMeleeSlashEffect({ fromX: strikeX, fromY: strikeY, toX: targetToken.x, toY: targetToken.y, effectId: 'default_melee_hit' });
              const returnDelay = behavior === 'teleport_there_and_back' ? 120 : 20;
              this.time.delayedCall(returnDelay, () => {
                this.tweens.add({
                  targets: actorToken,
                  alpha: 0,
                  duration: 60,
                  onComplete: () => {
                    actorToken.setPosition(originX, originY);
                    this.tweens.add({
                      targets: actorToken,
                      alpha: 1,
                      duration: 60,
                      onComplete: () => resolve(true),
                    });
                  },
                });
              });
            },
          });
        },
      });
    });
  }

  private playCompositeVisualEffect(event: CombatAnimationEvent, effectId: string, actorToken?: Phaser.GameObjects.Container, targetToken?: Phaser.GameObjects.Container): boolean {
    if (!this.visualFxPlayer || !actorToken) {
      return false;
    }
    const targetPosition = targetToken
      ? { x: targetToken.x, y: targetToken.y }
      : event.to
        ? this.getAdapter()?.getCellCenter(event.to.x, event.to.y)
        : { x: actorToken.x, y: actorToken.y };
    if (!targetPosition) {
      return false;
    }

    const additionalTargetPositions = targetToken
      ? [...this.tokenById.entries()]
        .filter(([id, token]) => id !== event.actorId && id !== event.targetId && token.visible)
        .slice(0, 3)
        .map(([, token]) => ({ x: token.x, y: token.y }))
      : [];

    return this.visualFxPlayer.playEffectById(effectId, {
      casterId: event.actorId,
      targetId: event.targetId,
      casterPosition: { x: actorToken.x, y: actorToken.y },
      targetPosition,
      groundPosition: targetPosition,
      additionalTargetPositions,
      result: event.type === 'miss' ? 'miss' : (event.critical ? 'crit' : 'hit'),
      movementHook: targetToken
        ? (behavior, from, to) => {
          actorToken.setPosition(from.x, from.y);
          return this.playSkillMovementBehaviorAsync(behavior, actorToken, targetToken).then(() => undefined);
        }
        : undefined,
      audioHook: (soundId, volume) => this.playSoundSafe(soundId, volume),
      cameraHook: (preset) => this.applyCameraShake(preset),
    });
  }

  private attachStatusVfx(entityId: string, token: Phaser.GameObjects.Container, statusId: string) {
    let bucket = this.statusVfxByEntity.get(entityId);
    if (!bucket) {
      bucket = new Map<string, Phaser.GameObjects.GameObject[]>();
      this.statusVfxByEntity.set(entityId, bucket);
    }
    if (bucket.has(statusId)) {
      return;
    }

    const effect = getBattleEffect(statusId, 'shielded');
    const circle = this.add.circle(0, 0, Math.max(14, token.width * 0.3), effect.color, 0.12).setName(`statusVfx:${statusId}`);
    circle.setStrokeStyle(2, effect.secondaryColor ?? effect.color, 0.65);
    circle.setBlendMode(Phaser.BlendModes.ADD);
    token.addAt(circle, 0);

    const pulseTween = this.tweens.add({
      targets: circle,
      alpha: { from: 0.08, to: 0.26 },
      scale: { from: 0.92, to: 1.14 },
      yoyo: true,
      repeat: -1,
      duration: effect.durationMs ?? 900,
      ease: 'Sine.easeInOut',
    });

    const statusObjects: Phaser.GameObjects.GameObject[] = [circle];
    const particles = this.add.particles(0, 0, this.particleTextureKey, {
      lifespan: { min: 420, max: 900 },
      speed: { min: 6, max: 18 },
      quantity: 1,
      frequency: 120,
      scale: { start: 0.1, end: 0.01 },
      tint: [effect.color, effect.secondaryColor ?? effect.color],
      blendMode: 'ADD',
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, Math.max(10, token.width * 0.24)), quantity: 12 },
    }).setName(`statusVfx:${statusId}:particles`);
    token.addAt(particles, 1);
    statusObjects.push(particles);

    (circle as unknown as { __pulseTween?: Phaser.Tweens.Tween }).__pulseTween = pulseTween;
    bucket.set(statusId, statusObjects);
  }

  private removeStatusVfx(entityId: string, statusId?: string) {
    const bucket = this.statusVfxByEntity.get(entityId);
    if (!bucket) {
      return;
    }
    const removeOne = (id: string) => {
      const list = bucket?.get(id) ?? [];
      for (const object of list) {
        const pulseTween = (object as unknown as { __pulseTween?: Phaser.Tweens.Tween }).__pulseTween;
        if (pulseTween) {
          pulseTween.stop();
        }
        object.destroy();
      }
      bucket?.delete(id);
    };

    if (statusId) {
      removeOne(statusId);
    } else {
      for (const id of [...bucket.keys()]) {
        removeOne(id);
      }
    }

    if (bucket.size === 0) {
      this.statusVfxByEntity.delete(entityId);
    }
  }

  private playDeathFade(token: Phaser.GameObjects.Container, effectId?: string) {
    const deathEffect = getBattleEffect(effectId, 'death_fade');
    const smoke = this.add.particles(token.x, token.y, this.particleTextureKey, {
      lifespan: { min: 320, max: 680 },
      speed: { min: 16, max: 62 },
      quantity: 18,
      scale: { start: 0.22, end: 0.02 },
      tint: [0x1a1715, deathEffect.color, 0x3a3029],
      blendMode: 'NORMAL',
      emitting: false,
    }).setDepth(48);
    smoke.explode(18, token.x, token.y);

    this.tweens.add({
      targets: token,
      alpha: 0.18,
      scale: 0.8,
      duration: deathEffect.durationMs ?? 420,
      ease: 'Sine.easeOut',
    });
    this.time.delayedCall(720, () => smoke.destroy());
  }

  private playLootSpawn(x: number, y: number, effectId?: string) {
    const lootEffect = getBattleEffect(effectId, 'loot_spawn');
    const star = this.add.star(x, y, 5, 5, 13, lootEffect.color, 0.95).setDepth(46);
    star.setStrokeStyle(2, 0xffffff, 0.8);

    const sparkles = this.add.particles(x, y, this.particleTextureKey, {
      lifespan: { min: 280, max: 540 },
      speed: { min: 20, max: 90 },
      quantity: 14,
      scale: { start: 0.18, end: 0 },
      tint: [lootEffect.color, 0xffffff],
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(47);
    sparkles.explode(14, x, y);

    this.tweens.add({
      targets: star,
      y: y - 18,
      alpha: 0,
      duration: lootEffect.durationMs ?? 420,
      ease: 'Sine.easeOut',
      onComplete: () => star.destroy(),
    });
    this.time.delayedCall(620, () => sparkles.destroy());
  }

  private playAnimationEvent(event: CombatAnimationEvent) {
    const snapshot = this.snapshot;
    const adapter = this.getAdapter();
    if (!snapshot || !adapter) return;
    const actorToken = event.actorId ? this.tokenById.get(event.actorId) : undefined;
    const targetToken = event.targetId ? this.tokenById.get(event.targetId) : undefined;
    const inferred = getBattleEffect(event.hitEffectId ?? event.impactEffectId ?? event.visualEffectId, inferEffectIdForAnimation(event));

    if (event.type === 'skill_cast' && actorToken) {
      const compositeId = [event.visualEffectId, event.castEffectId].find((id) => this.visualFxPlayer?.isComposite(id));
      if (compositeId && this.playCompositeVisualEffect(event, compositeId, actorToken, targetToken)) {
        return;
      }
      if (targetToken) {
        this.playSkillMovementBehavior(event.movementBehavior, actorToken, targetToken);
      }
      const registeredCastFx = this.visualFxPlayer?.getFx(event.castEffectId ?? event.visualEffectId);
      if (registeredCastFx && this.visualFxPlayer?.playFxAt(registeredCastFx, { x: actorToken.x, y: actorToken.y })) {
        this.playSoundSafe(event.castSoundId ?? registeredCastFx.audio?.defaultSoundId, registeredCastFx.audio?.volume);
        this.applyCameraShake(event.cameraShake ?? event.cameraShakePreset ?? registeredCastFx.camera?.shakePreset);
        return;
      }

      const castFx = getBattleEffect(event.castEffectId ?? event.visualEffectId, 'default_melee_hit');
      this.playMeleeSlashEffect({
        fromX: actorToken.x,
        fromY: actorToken.y,
        toX: actorToken.x + 1,
        toY: actorToken.y + 1,
        effectId: castFx.id,
      });
      this.playSoundSafe(event.castSoundId ?? castFx.soundId);
      this.applyCameraShake(event.cameraShake ?? event.cameraShakePreset ?? castFx.cameraShake);
      return;
    }

    if (event.type === 'move_token' && actorToken && event.from && event.to) {
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
      if (targetToken) {
        this.playMeleeSlashEffect({
          fromX: originalX,
          fromY: originalY,
          toX: targetToken.x,
          toY: targetToken.y,
          effectId: event.hitEffectId ?? inferred.id,
        });
        this.playImpactEffect(targetToken.x, targetToken.y, event.impactEffectId ?? inferred.id);
        this.tweens.add({ targets: targetToken, x: targetToken.x + 6, yoyo: true, duration: 80, ease: 'Quad.easeOut' });
      }
      this.playSoundSafe(event.impactSoundId ?? inferred.soundId);
      this.applyCameraShake(event.cameraShake ?? event.cameraShakePreset ?? (event.critical ? 'small' : inferred.cameraShake));
      return;
    }

    if (event.type === 'projectile') {
      const compositeId = [event.projectileEffectId, event.visualEffectId, event.impactEffectId].find((id) => this.visualFxPlayer?.isComposite(id));
      if (compositeId && actorToken && this.playCompositeVisualEffect(event, compositeId, actorToken, targetToken)) {
        return;
      }
      const projectileFxId = event.projectileEffectId ?? event.visualEffectId;
      const impactFxId = event.impactEffectId ?? event.hitEffectId ?? event.visualEffectId;
      const from = event.from
        ? adapter.getProjectileStart(event.from.x, event.from.y)
        : actorToken
          ? { x: actorToken.x, y: actorToken.y }
          : undefined;
      const to = event.to
        ? adapter.getProjectileEnd(event.to.x, event.to.y)
        : targetToken
          ? { x: targetToken.x, y: targetToken.y }
          : undefined;

      if (!from || !to) {
        return;
      }

      const effect = getBattleEffect(projectileFxId, 'arrow_projectile');
      const registeredProjectileFx = this.visualFxPlayer?.getFx(projectileFxId);
      this.playSoundSafe(
        event.castSoundId ?? registeredProjectileFx?.audio?.defaultSoundId ?? effect.soundId,
        registeredProjectileFx?.audio?.volume,
      );
      this.playProjectileEffect({
        from,
        to,
        projectileEffectId: projectileFxId,
        impactEffectId: impactFxId,
        onImpact: () => {
          const impact = getBattleEffect(impactFxId, 'default_impact');
          const registeredImpactFx = this.visualFxPlayer?.getFx(impactFxId);
          this.playSoundSafe(
            event.impactSoundId ?? registeredImpactFx?.audio?.defaultSoundId ?? impact.soundId,
            registeredImpactFx?.audio?.volume,
          );
          this.applyCameraShake(event.cameraShake ?? event.cameraShakePreset ?? registeredImpactFx?.camera?.shakePreset ?? impact.cameraShake);
        },
      });
      return;
    }

    if (event.type === 'impact' && (targetToken || event.to)) {
      const compositeId = [event.impactEffectId, event.hitEffectId, event.visualEffectId].find((id) => this.visualFxPlayer?.isComposite(id));
      if (compositeId && actorToken && this.playCompositeVisualEffect(event, compositeId, actorToken, targetToken)) {
        return;
      }
      const impactTarget = targetToken
        ? { x: targetToken.x, y: targetToken.y }
        : adapter.getCellCenter(event.to!.x, event.to!.y);
      const impact = getBattleEffect(event.impactEffectId ?? event.hitEffectId ?? event.visualEffectId, 'default_impact');
      const registeredImpactFx = this.visualFxPlayer?.getFx(event.impactEffectId ?? event.hitEffectId ?? event.visualEffectId);
      this.playImpactEffect(impactTarget.x, impactTarget.y, impact.id);
      this.playSoundSafe(
        event.impactSoundId ?? registeredImpactFx?.audio?.defaultSoundId ?? impact.soundId,
        registeredImpactFx?.audio?.volume,
      );
      this.applyCameraShake(event.cameraShake ?? event.cameraShakePreset ?? registeredImpactFx?.camera?.shakePreset ?? impact.cameraShake);
      return;
    }

    if ((event.type === 'damage_number' || event.type === 'heal_number') && targetToken) {
      const text = event.type === 'heal_number' ? `+${event.value ?? 0}` : `-${event.value ?? 0}`;
      this.floatText(
        targetToken.x,
        targetToken.y - adapter.cellSize * 0.35,
        text,
        event.type === 'heal_number' ? '#7dff9a' : '#ffdf8a',
        Boolean(event.critical),
      );
      this.playImpactEffect(targetToken.x, targetToken.y, inferred.id);
      if (event.critical) {
        this.applyCameraShake(event.cameraShake ?? event.cameraShakePreset ?? 'small');
      }
      this.playSoundSafe(event.impactSoundId ?? inferred.soundId);
      return;
    }

    if (event.type === 'critical_hit' && targetToken) {
      this.floatText(targetToken.x, targetToken.y - adapter.cellSize * 0.4, 'CRIT!', '#ffd46b', true);
      this.playImpactEffect(targetToken.x, targetToken.y, 'blunt_hit');
      this.applyCameraShake(event.cameraShake ?? event.cameraShakePreset ?? 'medium');
      return;
    }

    if (event.type === 'miss' && targetToken) {
      this.floatText(targetToken.x, targetToken.y - adapter.cellSize * 0.35, 'MISS', '#c6d9ff');
      return;
    }

    if (event.type === 'block' && targetToken) {
      this.floatText(targetToken.x, targetToken.y - adapter.cellSize * 0.35, 'BLOCK', '#9be2ff');
      this.playImpactEffect(targetToken.x, targetToken.y, 'shielded');
      return;
    }

    if (event.type === 'dodge' && targetToken) {
      this.floatText(targetToken.x, targetToken.y - adapter.cellSize * 0.35, 'DODGE', '#b8f5ff');
      this.tweens.add({ targets: targetToken, x: targetToken.x + 12, yoyo: true, duration: 90 });
      return;
    }

    if ((event.type === 'status_applied' || event.type === 'status_tick') && targetToken) {
      const statusFx = getBattleEffect(event.persistentVfx?.[0] ?? event.statusApplied?.[0] ?? event.visualEffectId, 'shielded');
      this.playImpactEffect(targetToken.x, targetToken.y, statusFx.id);
      return;
    }

    if (event.type === 'block_flash' && targetToken) {
      this.playImpactEffect(targetToken.x, targetToken.y, 'shielded');
      return;
    }

    if (event.type === 'dodge_step' && targetToken) {
      this.tweens.add({ targets: targetToken, x: targetToken.x + 12, yoyo: true, duration: 80 });
      return;
    }

    if (event.type === 'death_fade' && targetToken) {
      const deathFx = getBattleEffect(event.visualEffectId, 'death_fade');
      this.playSoundSafe(event.impactSoundId ?? deathFx.soundId);
      this.applyCameraShake(event.cameraShake ?? event.cameraShakePreset ?? deathFx.cameraShake);
      if (event.targetId) {
        this.removeStatusVfx(event.targetId);
      }
      this.playDeathFade(targetToken, deathFx.id);
      return;
    }

    if (event.type === 'loot_spawn' && event.to) {
      const to = adapter.getCellCenter(event.to.x, event.to.y);
      this.floatText(to.x, to.y, 'LOOT', '#f6d47b');
      this.playLootSpawn(to.x, to.y, 'loot_spawn');
      this.playSoundSafe('loot_spawn_01');
      return;
    }

    // Safe no-op fallback for unknown/unimplemented event types.
  }

  private floatText(x: number, y: number, value: string, color: string, emphasize = false) {
    const text = this.add.text(x, y, value, {
      color,
      fontFamily: 'Georgia, serif',
      fontSize: emphasize ? '22px' : '18px',
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<PhaserBattleScene | null>(null);
  const lastRightClickHandleAtRef = useRef(0);
  const mountedRef = useRef(false);
  const creatingGameRef = useRef(false);
  const destroyedRef = useRef(false);
  const [hostSize, setHostSize] = useState({ width: 720, height: 520 });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    actions: CombatContextAction[];
    mode: 'actions' | 'entity' | 'cell' | 'self';
    entityId?: string;
    cell?: { x: number; y: number };
  } | null>(null);
  const [visualFxDefinitions, setVisualFxDefinitions] = useState<VisualFxDefinition[]>([]);

  useEffect(() => {
    let disposed = false;
    void visualFxService.getAll()
      .then((entries) => {
        if (!disposed) {
          setVisualFxDefinitions(entries.filter((entry) => entry.status !== 'disabled'));
        }
      })
      .catch(() => {
        if (!disposed) {
          setVisualFxDefinitions([]);
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

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
    visualFxDefinitions,
  }), [hostSize.height, hostSize.width, props, sceneCellSize, viewport, visualFxDefinitions]);

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
    mountedRef.current = true;
    const host = hostRef.current;
    if (!host || gameRef.current) return undefined;
    if (creatingGameRef.current) return undefined;

    creatingGameRef.current = true;
    destroyedRef.current = false;
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
    creatingGameRef.current = false;

    const preventMouseContext = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const isContextEvent = event.type === 'contextmenu' || mouseEvent.button === 2;
      if (!isContextEvent) {
        return;
      }
      mouseEvent.preventDefault();
      if (IS_DEV && event.type === 'contextmenu') {
        // eslint-disable-next-line no-console
        console.debug('[PhaserBattle] prevented browser context menu');
      }
    };

    const contextBlockEvents: Array<keyof GlobalEventHandlersEventMap> = ['contextmenu', 'auxclick', 'mousedown', 'mouseup'];
    const canvas = game.canvas as HTMLCanvasElement | null;
    for (const eventName of contextBlockEvents) {
      host.addEventListener(eventName, preventMouseContext, true);
      canvas?.addEventListener(eventName, preventMouseContext, true);
    }

    const safeDestroyGame = () => {
      if (destroyedRef.current) {
        return;
      }
      destroyedRef.current = true;

      const current = gameRef.current;
      if (!current) {
        sceneRef.current = null;
        return;
      }

      try {
        // Keep Phaser core plugin cache intact across React remounts.
        current.destroy(true);
      } catch {
        // Keep cleanup resilient in React strict-mode / double-invocation paths.
      } finally {
        gameRef.current = null;
        sceneRef.current = null;
      }
    };

    return () => {
      for (const eventName of contextBlockEvents) {
        host.removeEventListener(eventName, preventMouseContext, true);
        canvas?.removeEventListener(eventName, preventMouseContext, true);
      }
      mountedRef.current = false;
      creatingGameRef.current = false;
      safeDestroyGame();
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current) {
      return;
    }
    sceneRef.current?.setSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }
    if (!props.isPlaybackActive || !props.playbackPhases?.length || !props.playbackRunId) {
      scene.clearPlaybackTimeline();
      return;
    }
    scene.startPlaybackTimeline(props.playbackPhases, props.playbackRunId, props.onPlaybackComplete);
  }, [props.isPlaybackActive, props.onPlaybackComplete, props.playbackPhases, props.playbackRunId]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }

    const preventContextMenuWithinBattle = (event: Event) => {
      const target = event.target as Node | null;
      if (!target || !root.contains(target)) {
        return;
      }
      event.preventDefault();
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.debug('[PhaserBattle] prevented browser context menu');
      }
    };

    document.addEventListener('contextmenu', preventContextMenuWithinBattle, true);
    return () => document.removeEventListener('contextmenu', preventContextMenuWithinBattle, true);
  }, []);

  useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }
    const close = () => setContextMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [contextMenu]);

  const executeTargetActions = (clickedTarget: ClickedCombatTarget, clientX: number, clientY: number): boolean => {
    let actionTaken = 'no_selected_source';
    if (props.selectedSource?.kind === 'none' || !props.buildContextActions) {
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.debug('[PhaserBattle input]', {
          button: 0,
          isRightClick: false,
          isLeftClick: true,
          selectedSource: props.selectedSource,
          clickedTarget,
          entityId: clickedTarget.kind === 'entity' ? clickedTarget.entityId : null,
          cell: clickedTarget.kind === 'cell' ? { x: clickedTarget.x, y: clickedTarget.y } : null,
          actionTaken,
        });
      }
      return false;
    }
    const actions = props.buildContextActions(clickedTarget);
    if (actions.length === 0) {
      actionTaken = 'no_context_actions';
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.debug('[PhaserBattle input]', {
          button: 0,
          isRightClick: false,
          isLeftClick: true,
          selectedSource: props.selectedSource,
          clickedTarget,
          entityId: clickedTarget.kind === 'entity' ? clickedTarget.entityId : null,
          cell: clickedTarget.kind === 'cell' ? { x: clickedTarget.x, y: clickedTarget.y } : null,
          actionTaken,
        });
      }
      return false;
    }
    if (actions.length === 1) {
      const action = actions[0];
      if (action.disabled) {
        props.onStatusMessage?.(action.disabledReason ?? `${action.label} недоступно.`);
        actionTaken = 'single_disabled_action';
        if (IS_DEV) {
          // eslint-disable-next-line no-console
          console.debug('[PhaserBattle input]', {
            button: 0,
            isRightClick: false,
            isLeftClick: true,
            selectedSource: props.selectedSource,
            clickedTarget,
            entityId: clickedTarget.kind === 'entity' ? clickedTarget.entityId : null,
            cell: clickedTarget.kind === 'cell' ? { x: clickedTarget.x, y: clickedTarget.y } : null,
            actionTaken,
          });
        }
        return true;
      }
      if (action.command) {
        props.onExecuteContextCommand?.(action.command);
        actionTaken = 'single_command_executed';
        if (IS_DEV) {
          // eslint-disable-next-line no-console
          console.debug('[PhaserBattle input]', {
            button: 0,
            isRightClick: false,
            isLeftClick: true,
            selectedSource: props.selectedSource,
            clickedTarget,
            entityId: clickedTarget.kind === 'entity' ? clickedTarget.entityId : null,
            cell: clickedTarget.kind === 'cell' ? { x: clickedTarget.x, y: clickedTarget.y } : null,
            actionTaken,
          });
        }
        return true;
      }
      actionTaken = 'single_action_no_command';
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.debug('[PhaserBattle input]', {
          button: 0,
          isRightClick: false,
          isLeftClick: true,
          selectedSource: props.selectedSource,
          clickedTarget,
          entityId: clickedTarget.kind === 'entity' ? clickedTarget.entityId : null,
          cell: clickedTarget.kind === 'cell' ? { x: clickedTarget.x, y: clickedTarget.y } : null,
          actionTaken,
        });
      }
      return false;
    }

    const host = hostRef.current;
    const rect = host?.getBoundingClientRect();
    if (!rect) {
      return false;
    }
    const menuWidth = 320;
    const menuHeight = Math.max(120, Math.min(320, 44 + actions.length * 36));
    const x = Math.max(8, Math.min(clientX - rect.left, rect.width - menuWidth - 8));
    const y = Math.max(8, Math.min(clientY - rect.top, rect.height - menuHeight - 8));
    setContextMenu({ x, y, actions, mode: 'actions' });
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.debug('[PhaserBattle input]', {
        button: 0,
        isRightClick: false,
        isLeftClick: true,
        selectedSource: props.selectedSource,
        clickedTarget,
        entityId: clickedTarget.kind === 'entity' ? clickedTarget.entityId : null,
        cell: clickedTarget.kind === 'cell' ? { x: clickedTarget.x, y: clickedTarget.y } : null,
        actionTaken: 'multiple_actions_open_menu',
      });
    }
    return true;
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const canvas = gameRef.current?.canvas as HTMLCanvasElement | null;

    const openDefaultContextMenu = (event: MouseEvent, payload: { mode: 'entity' | 'cell' | 'self'; entityId?: string; cell?: { x: number; y: number } }) => {
      const rect = host.getBoundingClientRect();
      const menuWidth = payload.mode === 'entity' ? 260 : payload.mode === 'self' ? 240 : 220;
      const menuHeight = payload.mode === 'entity' ? 240 : payload.mode === 'self' ? 190 : 150;
      const x = Math.max(8, Math.min(event.clientX - rect.left, rect.width - menuWidth - 8));
      const y = Math.max(8, Math.min(event.clientY - rect.top, rect.height - menuHeight - 8));
      setContextMenu({
        x,
        y,
        actions: [],
        mode: payload.mode,
        entityId: payload.entityId,
        cell: payload.cell,
      });
    };

    const resolveCellAndEntity = (clientX: number, clientY: number) => {
      const scene = sceneRef.current;
      const adapter = scene?.['getAdapter']?.();
      if (!scene || !adapter) return null;
      const rect = host.getBoundingClientRect();
      const cell = adapter.pointerToCell(clientX - rect.left, clientY - rect.top);
      if (!cell) return null;
      const interaction = createBattleInteractionAdapter(props);
      return interaction.resolveClickedTarget(cell.x, cell.y);
    };

    const handleLeftClick = (event: PointerEvent) => {
      const resolved = resolveCellAndEntity(event.clientX, event.clientY);
      if (!resolved) {
        return;
      }
      if (resolved.kind === 'entity') {
        if (resolved.entity.team === TeamSide.Right && resolved.entity.isAlive) {
          const handled = executeTargetActions({ kind: 'entity', entityId: resolved.entity.id }, event.clientX, event.clientY);
          if (handled) {
            return;
          }
          props.onTargetSelect?.(resolved.entity.id);
          if (IS_DEV) {
            // eslint-disable-next-line no-console
            console.debug('[PhaserBattle input]', {
              button: event.button,
              isRightClick: false,
              isLeftClick: true,
              selectedSource: props.selectedSource,
              clickedTarget: { kind: 'entity', entityId: resolved.entity.id },
              entityId: resolved.entity.id,
              cell: resolved.cell,
              actionTaken: 'select_target',
            });
          }
        }
        return;
      }

      if (resolved.kind === 'self' || resolved.kind === 'blocked') {
        return;
      }

      const handled = executeTargetActions({ kind: 'cell', x: resolved.cell.x, y: resolved.cell.y }, event.clientX, event.clientY);
      if (handled) {
        return;
      }

      if (props.selectedHotbarItemId && props.onQuickUseSelectedItemAt) {
        props.onQuickUseSelectedItemAt({ kind: 'cell', x: resolved.cell.x, y: resolved.cell.y });
        if (IS_DEV) {
          // eslint-disable-next-line no-console
          console.debug('[PhaserBattle input]', {
            button: event.button,
            isRightClick: false,
            isLeftClick: true,
            selectedSource: props.selectedSource,
            clickedTarget: { kind: 'cell', x: resolved.cell.x, y: resolved.cell.y },
            entityId: null,
            cell: resolved.cell,
            actionTaken: 'quick_use_selected_item_at_cell',
          });
        }
        return;
      }

      const movable = createBattleInteractionAdapter(props).movableCells.get(`${resolved.cell.x}:${resolved.cell.y}`);
      if (movable) {
        props.onMoveTileSelect?.({ x: resolved.cell.x, y: resolved.cell.y, movementType: movable.movementType, willTriggerOpportunity: movable.willTriggerOpportunity });
        if (IS_DEV) {
          // eslint-disable-next-line no-console
          console.debug('[PhaserBattle input]', {
            button: event.button,
            isRightClick: false,
            isLeftClick: true,
            selectedSource: props.selectedSource,
            clickedTarget: { kind: 'cell', x: resolved.cell.x, y: resolved.cell.y },
            entityId: null,
            cell: resolved.cell,
            actionTaken: 'move_tile_select',
          });
        }
      }
    };

    const handleRightClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (now - lastRightClickHandleAtRef.current < 80) {
        return;
      }
      lastRightClickHandleAtRef.current = now;
      const resolved = resolveCellAndEntity(event.clientX, event.clientY);
      if (!resolved) {
        return;
      }
      if (resolved.kind === 'self') {
        openDefaultContextMenu(event, { mode: 'self', entityId: resolved.actorId, cell: resolved.cell });
        return;
      }

      if (resolved.kind === 'entity') {
        if (resolved.entity.team === TeamSide.Right && resolved.entity.isAlive) {
          props.onTargetSelect?.(resolved.entity.id);
          openDefaultContextMenu(event, { mode: 'entity', entityId: resolved.entity.id, cell: resolved.cell });
          return;
        }

        props.onInspectEntity?.(resolved.entity.id);
        if (IS_DEV) {
          // eslint-disable-next-line no-console
          console.debug('[PhaserBattle input]', {
            button: 2,
            isRightClick: true,
            isLeftClick: false,
            selectedSource: props.selectedSource,
            clickedTarget: { kind: 'entity', entityId: resolved.entity.id },
            entityId: resolved.entity.id,
            cell: resolved.cell,
            actionTaken: 'inspect_entity',
          });
        }
        return;
      }

      if (resolved.kind === 'blocked') {
        return;
      }

      openDefaultContextMenu(event, { mode: 'cell', cell: resolved.cell });
      if (IS_DEV) {
        // eslint-disable-next-line no-console
        console.debug('[PhaserBattle input]', {
          button: 2,
          isRightClick: true,
          isLeftClick: false,
          selectedSource: props.selectedSource,
          clickedTarget: { kind: 'cell', x: resolved.cell.x, y: resolved.cell.y },
          entityId: null,
          cell: resolved.cell,
          actionTaken: 'open_default_context_menu_cell',
        });
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 2) {
        event.preventDefault();
        handleRightClick(event as unknown as MouseEvent);
        return;
      }
      if (event.button !== 0) {
        return;
      }
      handleLeftClick(event);
    };

    host.addEventListener('pointerdown', onPointerDown, true);
    host.addEventListener('contextmenu', handleRightClick, true);
    canvas?.addEventListener('contextmenu', handleRightClick, true);
    return () => {
      host.removeEventListener('pointerdown', onPointerDown, true);
      host.removeEventListener('contextmenu', handleRightClick, true);
      canvas?.removeEventListener('contextmenu', handleRightClick, true);
    };
  }, [props]);

  const interaction = useMemo(() => createBattleInteractionAdapter(props), [props]);

  const getMoveCloserTile = (enemyX: number, enemyY: number) => interaction.getMoveCloserTile(enemyX, enemyY);

  const movableForContextCell = contextMenu?.cell
    ? interaction.movableCells.get(`${contextMenu.cell.x}:${contextMenu.cell.y}`)
    : undefined;
  const isContextCellDash = movableForContextCell?.movementType === MovementType.Dash;
  const contextTargetActions = useMemo(() => {
    if (!contextMenu || contextMenu.mode === 'actions' || !props.buildContextActions) {
      return [];
    }
    if (contextMenu.mode === 'entity' && contextMenu.entityId) {
      return props.buildContextActions({ kind: 'entity', entityId: contextMenu.entityId });
    }
    if (contextMenu.mode === 'self' && contextMenu.entityId) {
      return props.buildContextActions({ kind: 'self', actorId: contextMenu.entityId });
    }
    if (contextMenu.mode === 'cell' && contextMenu.cell) {
      return props.buildContextActions({ kind: 'cell', x: contextMenu.cell.x, y: contextMenu.cell.y });
    }
    return [];
  }, [contextMenu, props]);

  return (
    <div
      ref={rootRef}
      className="battle-field tactical-field phaser-battle-renderer"
      style={{ position: 'relative' }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (IS_DEV) {
          // eslint-disable-next-line no-console
          console.debug('[PhaserBattle] prevented browser context menu');
        }
      }}
    >
      <div className="tactical-header">
        <h3>Phaser Battlefield</h3>
        <div className="tactical-distance-indicator">Distance: {props.distance} | LMB: action/select | RMB: inspect | Renderer: Phaser</div>
      </div>
      <div ref={hostRef} className="phaser-battle-host" />
      {contextMenu ? (
        <div
          className="tactical-context-menu"
          style={{
            position: 'absolute',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 1500,
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          {contextMenu.mode === 'actions' ? (
            <div className="tactical-context-group">
              <span className="tactical-context-group-title">Действия</span>
              {contextMenu.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={action.disabled}
                  title={action.disabledReason}
                  onClick={() => {
                    if (action.disabled) {
                      props.onStatusMessage?.(action.disabledReason ?? `${action.label} недоступно.`);
                      return;
                    }
                    if (action.command) {
                      props.onExecuteContextCommand?.(action.command);
                    }
                    setContextMenu(null);
                  }}
                >
                  {action.label}{action.disabled && action.disabledReason ? ` - ${action.disabledReason}` : ''}
                </button>
              ))}
              <button type="button" onClick={() => setContextMenu(null)}>Отмена</button>
            </div>
          ) : null}

          {contextMenu.mode === 'entity' && contextMenu.entityId ? (
            <div className="tactical-context-group">
              <span className="tactical-context-group-title">Действия</span>
              {contextTargetActions.length > 0 ? (
                <>
                  <span className="tactical-context-group-title">Выбранный источник</span>
                  {contextTargetActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      disabled={action.disabled}
                      title={action.disabledReason}
                      onClick={() => {
                        if (action.disabled) {
                          props.onStatusMessage?.(action.disabledReason ?? `${action.label} недоступно.`);
                          return;
                        }
                        if (action.command) {
                          props.onExecuteContextCommand?.(action.command);
                        }
                        setContextMenu(null);
                      }}
                    >{action.label}{action.disabled && action.disabledReason ? ` - ${action.disabledReason}` : ''}</button>
                  ))}
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  props.onTargetSelect?.(contextMenu.entityId!);
                  props.onQuickAttack?.(contextMenu.entityId!);
                  setContextMenu(null);
                }}
              >⚔ Базовая атака</button>
              <button
                type="button"
                onClick={() => {
                  props.onTargetSelect?.(contextMenu.entityId!);
                  props.onQuickHeavyAttack?.(contextMenu.entityId!);
                  setContextMenu(null);
                }}
              >💥 Сильная атака</button>
              {props.availableSkills?.length ? (
                <>
                  <span className="tactical-context-group-title">Навыки</span>
                  {props.availableSkills.slice(0, 6).map((skill) => (
                    <button
                      key={skill.slotId}
                      type="button"
                      onClick={() => {
                        props.onTargetSelect?.(contextMenu.entityId!);
                        props.onQuickSkill?.(skill.skillId, contextMenu.entityId!);
                        setContextMenu(null);
                      }}
                    >{skill.slotId.toUpperCase()} · {skill.label}</button>
                  ))}
                </>
              ) : null}
              {props.inventoryItems?.filter((item) => !item.disabled).length ? (
                <>
                  <span className="tactical-context-group-title">Предметы</span>
                  {props.inventoryItems.filter((item) => !item.disabled).slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        props.onQuickItem?.(item.id, contextMenu.entityId!);
                        setContextMenu(null);
                      }}
                    >{item.name} x{item.quantity}</button>
                  ))}
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  props.onInspectEntity?.(contextMenu.entityId!);
                  setContextMenu(null);
                }}
              >🔍 Осмотреть</button>
              <button
                type="button"
                onClick={() => {
                  if (!contextMenu.cell) {
                    setContextMenu(null);
                    return;
                  }
                  const closer = getMoveCloserTile(contextMenu.cell.x, contextMenu.cell.y);
                  if (!closer) {
                    props.onStatusMessage?.('Нет доступной клетки для подхода к цели.');
                    return;
                  }
                  if (props.onQuickMove) {
                    props.onQuickMove(closer);
                  } else {
                    props.onMoveTileSelect?.(closer);
                  }
                  setContextMenu(null);
                }}
              >⇢ Подойти ближе</button>
              <button
                type="button"
                onClick={() => {
                  if (!contextMenu.cell) {
                    setContextMenu(null);
                    return;
                  }
                  const closer = getMoveCloserTile(contextMenu.cell.x, contextMenu.cell.y);
                  if (!closer) {
                    props.onStatusMessage?.('Нет доступной клетки для рывка к цели.');
                    return;
                  }
                  const dashMove = {
                    ...closer,
                    movementType: MovementType.Dash,
                  };
                  if (props.onQuickMove) {
                    props.onQuickMove(dashMove);
                  } else {
                    props.onMoveTileSelect?.(dashMove);
                  }
                  setContextMenu(null);
                }}
              >💨 Рывок ближе</button>
              <button type="button" onClick={() => setContextMenu(null)}>✕ Отмена</button>
            </div>
          ) : null}

          {contextMenu.mode === 'cell' && contextMenu.cell ? (
            <div className="tactical-context-group">
              <span className="tactical-context-group-title">Клетка</span>
              {contextTargetActions.length > 0 ? (
                <>
                  <span className="tactical-context-group-title">Выбранный источник</span>
                  {contextTargetActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      disabled={action.disabled}
                      title={action.disabledReason}
                      onClick={() => {
                        if (action.disabled) {
                          props.onStatusMessage?.(action.disabledReason ?? `${action.label} недоступно.`);
                          return;
                        }
                        if (action.command) {
                          props.onExecuteContextCommand?.(action.command);
                        }
                        setContextMenu(null);
                      }}
                    >{action.label}{action.disabled && action.disabledReason ? ` - ${action.disabledReason}` : ''}</button>
                  ))}
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const moveInfo = interaction.movableCells.get(`${contextMenu.cell!.x}:${contextMenu.cell!.y}`);
                  if (!moveInfo) {
                    props.onStatusMessage?.('Нельзя построить путь в эту клетку.');
                    return;
                  }
                  props.onMoveTileSelect?.({
                    x: contextMenu.cell!.x,
                    y: contextMenu.cell!.y,
                    movementType: moveInfo.movementType,
                    willTriggerOpportunity: moveInfo.willTriggerOpportunity,
                  });
                  setContextMenu(null);
                }}
              >{isContextCellDash ? '💨 Рывок сюда' : '👣 Шаг сюда'}</button>
              <button
                type="button"
                onClick={() => {
                  const moveInfo = interaction.movableCells.get(`${contextMenu.cell!.x}:${contextMenu.cell!.y}`);
                  if (!moveInfo) {
                    props.onStatusMessage?.('Нельзя построить путь в эту клетку.');
                    return;
                  }
                  props.onMoveTileSelect?.({
                    x: contextMenu.cell!.x,
                    y: contextMenu.cell!.y,
                    movementType: MovementType.Dash,
                    willTriggerOpportunity: moveInfo.willTriggerOpportunity,
                  });
                  setContextMenu(null);
                }}
              >💨 Рывок</button>
              <button
                type="button"
                onClick={() => {
                  props.onMoveTileSelect?.({
                    x: contextMenu.cell!.x,
                    y: contextMenu.cell!.y,
                    movementType: MovementType.Disengage,
                    willTriggerOpportunity: false,
                  });
                  setContextMenu(null);
                }}
              >🛡 Отход</button>
              <button
                type="button"
                onClick={() => {
                  props.onClearSelectedSource?.();
                  setContextMenu(null);
                }}
              >✕ Сбросить источник</button>
              <button type="button" onClick={() => setContextMenu(null)}>✕ Отмена</button>
            </div>
          ) : null}

          {contextMenu.mode === 'self' ? (
            <div className="tactical-context-group">
              <span className="tactical-context-group-title">Себя</span>
              {contextTargetActions.length > 0 ? (
                <>
                  <span className="tactical-context-group-title">Выбранный источник</span>
                  {contextTargetActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      disabled={action.disabled}
                      title={action.disabledReason}
                      onClick={() => {
                        if (action.disabled) {
                          props.onStatusMessage?.(action.disabledReason ?? `${action.label} недоступно.`);
                          return;
                        }
                        if (action.command) {
                          props.onExecuteContextCommand?.(action.command);
                        }
                        setContextMenu(null);
                      }}
                    >{action.label}{action.disabled && action.disabledReason ? ` - ${action.disabledReason}` : ''}</button>
                  ))}
                </>
              ) : null}
              {props.selfTargetSkills?.length ? (
                <>
                  <span className="tactical-context-group-title">Навыки</span>
                  {props.selfTargetSkills.slice(0, 5).map((skill) => (
                    <button
                      key={skill.slotId}
                      type="button"
                      onClick={() => {
                        props.onQuickSkill?.(skill.skillId, props.playerId);
                        setContextMenu(null);
                      }}
                    >{skill.slotId.toUpperCase()} · {skill.label}</button>
                  ))}
                </>
              ) : null}
              {props.inventoryItems?.filter((item) => !item.disabled).length ? (
                <>
                  <span className="tactical-context-group-title">Предметы</span>
                  {props.inventoryItems.filter((item) => !item.disabled).slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        props.onQuickItem?.(item.id, props.playerId);
                        setContextMenu(null);
                      }}
                    >{item.name} x{item.quantity}</button>
                  ))}
                </>
              ) : null}
              <button type="button" onClick={() => { props.onResetDefense?.(); setContextMenu(null); }}>🗙 Сбросить защиту</button>
              <button type="button" onClick={() => { props.onQuickGuard?.(); setContextMenu(null); }}>🛡 Защита</button>
              <button type="button" onClick={() => { props.onQuickStrongGuard?.(); setContextMenu(null); }}>🛡 Усиленная защита</button>
              <button type="button" onClick={() => { props.onQuickWait?.(); setContextMenu(null); }}>⌛ Ожидание</button>
              <button type="button" onClick={() => setContextMenu(null)}>✕ Отмена</button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="tactical-info">
        <div className="tactical-info-item"><span>Renderer:</span> <strong>Phaser</strong></div>
        <div className="tactical-info-item"><span>Grid:</span> <strong>{props.battleMapWidth}x{props.battleMapHeight}</strong></div>
      </div>
    </div>
  );
}
