import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import type { MineDefinition, MineDepth, MineRunState } from '../../types/mining';
import { itemsService } from '../../services/content/itemsService';
import { materialsService } from '../../services/content/materialsService';
import { loadRuntimeImages, resolveStoredImageSource } from '../../services/content/runtimeImageService';
import type { StoredImage } from '../../services/content/models';
import { playRegisteredSound } from '../../services/soundRuntime';

interface MiningPhaserRendererProps {
  mine: MineDefinition;
  depth: MineDepth;
  run: MineRunState;
  disabled: boolean;
  onHitBlock: (blockIndex: number) => void;
  onBlockContextMenu?: (payload: { blockIndex: number; x: number; y: number }) => void;
  onMusicStatus?: (status: string) => void;
}

interface MiningSnapshot {
  mine: MineDefinition;
  depth: MineDepth;
  run: MineRunState;
  widthPx: number;
  heightPx: number;
  itemIconById: Record<string, string | undefined>;
}

interface MiningBlockNode {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  fill: number;
  isClosed: boolean;
  disabled: boolean;
  size: number;
}

const MINE_CELL_SPRITES = {
  depth1: '/assets/mining/block_depth_1.png',
  depth2: '/assets/mining/block_depth_2.png',
  depth3: '/assets/mining/block_depth_3.png',
  cracked: '/assets/mining/cracked_overlay.png',
  opened: '/assets/mining/cell_opened.png',
  passage: '/assets/mining/passage.png',
  exit: '/assets/mining/exit.png',
};

const COLLAPSE_ROCK_SPRITES = [
  '/assets/mining/collapse_rock_01.png',
  '/assets/mining/collapse_rock_02.png',
  '/assets/mining/collapse_rock_03.png',
  '/assets/mining/collapse_rock_04.png',
  '/assets/mining/collapse_rock_05.png',
  '/assets/mining/collapse_rock_06.png',
  '/assets/mining/collapse_rock_07.png',
];

const MINING_SFX = {
  mineHit: '/assets/mining/sfx/sfx_mine_hit.mp3',
  debrisFall: '/assets/mining/sfx/sfx_debris_fall_low.mp3',
  collapseRumble: '/assets/mining/sfx/sfx_collapse_rumble.mp3',
};

const MINING_MUSIC_TRACKS = [
  '/assets/mining/music/mine_music_1.mp3',
  '/assets/mining/music/mine_music_2.mp3',
  '/assets/mining/music/mine_music_3.mp3',
  '/assets/mining/music/mine_music_4.mp3',
  '/assets/mining/music/mine_music_5.mp3',
  '/assets/mining/music/mine_music_6.mp3',
  '/assets/mining/music/mine_music_7.mp3',
];

function getGlobalAudioVolume(): number {
  if (typeof window === 'undefined') {
    return 1;
  }
  const volumeKeys = ['theend.audio.volume', 'theend.sound.volume'];
  const rawVolume = volumeKeys
    .map((key) => window.localStorage.getItem(key))
    .find((value) => value !== null);
  const parsed = rawVolume ? Number(rawVolume) : 1;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 1;
}

function isAutoplayBlocked(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const name = String((error as { name?: string }).name ?? '').toLowerCase();
  const message = String(error.message ?? '').toLowerCase();
  return name.includes('notallowed')
    || message.includes('user') && message.includes('interact')
    || message.includes('play() failed');
}

function isBenignPlayInterruption(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const name = String((error as { name?: string }).name ?? '').toLowerCase();
  const message = String(error.message ?? '').toLowerCase();
  return name.includes('aborterror')
    || message.includes('interrupted by a call to pause');
}

function resolveImageSource(value?: string | null): string | null {
  const normalized = String(value ?? '').trim().replace(/\\/g, '/');
  if (!normalized) {
    return null;
  }

  const assetsMarkerIndex = normalized.toLowerCase().indexOf('/assets/');
  if (assetsMarkerIndex >= 0) {
    return normalized.slice(assetsMarkerIndex);
  }
  if (normalized.toLowerCase().startsWith('assets/')) {
    return `/${normalized}`;
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

class MiningScene extends Phaser.Scene {
  private snapshot: MiningSnapshot | null = null;
  private onHitBlock: ((blockIndex: number) => void) | null = null;
  private onBlockContextMenu: ((payload: { blockIndex: number; x: number; y: number }) => void) | null = null;
  private background?: Phaser.GameObjects.Image;
  private backgroundFallback?: Phaser.GameObjects.Rectangle;
  private gridLayer?: Phaser.GameObjects.Container;
  private fxLayer?: Phaser.GameObjects.Container;
  private pickaxe?: Phaser.GameObjects.Container;
  private pickaxeHead?: Phaser.GameObjects.Rectangle;
  private pickaxeToolSprite?: Phaser.GameObjects.Image;
  private pickaxeVisualSource: string | null = null;
  private blockNodes = new Map<number, MiningBlockNode>();
  private previousBlockStates = new Map<number, MineRunState['blocks'][number]['state']>();
  private loadedImageSources = new Map<string, string>();
  private loadedAudioSources = new Map<string, string>();
  private pendingBlockIndex: number | null = null;
  private hoveredBlockIndex: number | null = null;
  private nextDynamicTextureId = 0;
  private nextDynamicAudioId = 0;
  private previousEventLogSize = 0;
  private lastCollapseSignature = '';

  constructor() {
    super({ key: 'MiningScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#17110d');
    this.input.mouse?.disableContextMenu();
    this.backgroundFallback = this.add.rectangle(0, 0, 10, 10, 0x251a13).setOrigin(0);
    this.gridLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.pickaxe = this.createPickaxe();
    this.preloadCollapseAssets();
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('gameout', () => this.setHoveredBlock(null));
    this.renderSnapshot();
  }

  setSnapshot(
    snapshot: MiningSnapshot,
    onHitBlock: (blockIndex: number) => void,
    onBlockContextMenu?: (payload: { blockIndex: number; x: number; y: number }) => void,
  ) {
    this.snapshot = snapshot;
    this.onHitBlock = onHitBlock;
    this.onBlockContextMenu = onBlockContextMenu ?? null;
    if (this.sys.isActive()) {
      this.renderSnapshot();
    }
  }

  private createPickaxe(): Phaser.GameObjects.Container {
    const handle = this.add.rectangle(0, 0, 10, 46, 0x6a4a2b).setOrigin(0.5, 0.85);
    const head = this.add.rectangle(0, -18, 32, 10, 0xb8b5af).setOrigin(0.5);
    this.pickaxeHead = head;
    const container = this.add.container(-1000, -1000, [handle, head]);
    container.setDepth(40);
    container.setVisible(false);
    return container;
  }

  private renderSnapshot() {
    const snapshot = this.snapshot;
    if (!snapshot || !this.gridLayer || !this.fxLayer || !this.pickaxe || !this.backgroundFallback) {
      return;
    }

    // A snapshot redraw can happen while hit tweens are running (asset loads, resize).
    // Reset pending lock so a canceled tween cannot freeze block interactions.
    this.pendingBlockIndex = null;

    this.scale.resize(snapshot.widthPx, snapshot.heightPx);
    this.renderBackground(snapshot);
    this.renderPickaxe(snapshot);
    this.gridLayer.removeAll(true);
    this.fxLayer.removeAll(true);
    this.blockNodes.clear();
    this.hoveredBlockIndex = null;

    const gap = Math.max(6, Math.min(10, Math.floor(snapshot.widthPx / 120)));
    const availableWidth = Math.max(220, snapshot.widthPx - 48);
    const availableHeight = Math.max(220, snapshot.heightPx - 48);
    const cellWidth = Math.min(110, Math.floor((availableWidth - gap * (snapshot.depth.columns - 1)) / snapshot.depth.columns));
    const cellHeight = Math.min(110, Math.floor((availableHeight - gap * (snapshot.depth.rows - 1)) / snapshot.depth.rows));
    const minCell = snapshot.widthPx <= 900 ? 52 : 76;
    const cellSize = Math.max(minCell, Math.min(cellWidth, cellHeight));
    const gridWidth = snapshot.depth.columns * cellSize + gap * (snapshot.depth.columns - 1);
    const gridHeight = snapshot.depth.rows * cellSize + gap * (snapshot.depth.rows - 1);
    const startX = Math.round((snapshot.widthPx - gridWidth) / 2);
    const startY = Math.round((snapshot.heightPx - gridHeight) / 2);

    snapshot.run.blocks.forEach((block) => {
      const row = Math.floor(block.index / snapshot.depth.columns);
      const col = block.index % snapshot.depth.columns;
      const x = startX + col * (cellSize + gap);
      const y = startY + row * (cellSize + gap);
      const node = this.createBlockNode(block, x, y, cellSize, snapshot.run.status !== 'active');
      this.gridLayer!.add(node.container);
      this.blockNodes.set(block.index, node);

      const previousState = this.previousBlockStates.get(block.index);
      if (previousState === 'closed' && block.state === 'opened') {
        this.playReveal(node.container);
      }
      this.previousBlockStates.set(block.index, block.state);
    });

    this.maybePlayCollapseCinematic(snapshot);
  }

  private preloadCollapseAssets() {
    COLLAPSE_ROCK_SPRITES.forEach((source) => this.requestDynamicImage(source));
    this.requestDynamicAudio(MINING_SFX.mineHit);
    this.requestDynamicAudio(MINING_SFX.debrisFall);
    this.requestDynamicAudio(MINING_SFX.collapseRumble);
  }

  private renderPickaxe(snapshot: MiningSnapshot) {
    if (!this.pickaxe) {
      return;
    }

    const selectedTool = snapshot.run.miningInventory?.find((entry) => entry.toolId === snapshot.run.selectedToolId)
      ?? snapshot.run.miningInventory?.find((entry) => /кирк|pickaxe/i.test(entry.name ?? ''))
      ?? null;

    const source = resolveImageSource(selectedTool?.iconUrl);
    if (!source) {
      this.pickaxeHead?.setVisible(true);
      this.pickaxeToolSprite?.setVisible(false);
      this.pickaxeVisualSource = null;
      return;
    }

    if (source !== this.pickaxeVisualSource) {
      this.pickaxeVisualSource = source;
      const textureKey = this.resolveTextureKey(source);
      if (!textureKey || !this.textures.exists(textureKey)) {
        this.requestDynamicImage(source);
        return;
      }
    }

    const textureKey = this.resolveTextureKey(source);
    if (!textureKey || !this.textures.exists(textureKey)) {
      return;
    }

    if (!this.pickaxeToolSprite) {
      this.pickaxeToolSprite = this.add.image(0, -18, textureKey);
      this.pickaxe.add(this.pickaxeToolSprite);
    }

    this.pickaxeToolSprite
      .setTexture(textureKey)
      .setPosition(0, -18)
      .setDisplaySize(44, 44)
      .setVisible(true)
      .setAlpha(1);
    this.pickaxeHead?.setVisible(false);
  }

  private renderBackground(snapshot: MiningSnapshot) {
    const backgroundUrl = resolveImageSource(
      snapshot.mine.backgroundImageUrl
      || snapshot.depth.backgroundImage
      || undefined,
    );

    this.backgroundFallback?.setSize(snapshot.widthPx, snapshot.heightPx);
    this.backgroundFallback?.setVisible(true);

    if (!backgroundUrl) {
      this.background?.destroy();
      this.background = undefined;
      return;
    }

    const textureKey = this.loadedImageSources.get(backgroundUrl);
    if (textureKey && this.textures.exists(textureKey)) {
      if (!this.background || this.background.texture.key !== textureKey) {
        this.background?.destroy();
        this.background = this.add.image(0, 0, textureKey).setOrigin(0).setDepth(-10);
      }
      const frame = this.textures.getFrame(textureKey);
      const sourceWidth = frame?.width ?? snapshot.widthPx;
      const sourceHeight = frame?.height ?? snapshot.heightPx;
      const scale = Math.max(snapshot.widthPx / sourceWidth, snapshot.heightPx / sourceHeight);
      this.background
        .setScale(scale)
        .setPosition(snapshot.widthPx / 2, snapshot.heightPx / 2)
        .setOrigin(0.5);
      this.backgroundFallback?.setVisible(false);
      return;
    }

    this.requestDynamicImage(backgroundUrl);
  }

  private requestDynamicImage(source: string) {
    if (this.loadedImageSources.has(source)) {
      return;
    }
    const key = `mining-img-${this.nextDynamicTextureId += 1}`;
    this.loadedImageSources.set(source, key);
    this.load.image(key, source);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.renderSnapshot();
    });
    if (!this.load.isLoading()) {
      this.load.start();
    }
  }

  private requestDynamicAudio(source: string) {
    if (this.loadedAudioSources.has(source)) {
      return;
    }
    const key = `mining-sfx-${this.nextDynamicAudioId += 1}`;
    this.loadedAudioSources.set(source, key);
    this.load.audio(key, source);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.renderSnapshot();
    });
    if (!this.load.isLoading()) {
      this.load.start();
    }
  }

  private playSfx(source: string, volume: number) {
    const key = this.loadedAudioSources.get(source);
    if (!key || !this.cache.audio.exists(key)) {
      this.requestDynamicAudio(source);
      return;
    }
    this.sound.play(key, {
      volume,
      rate: Phaser.Math.FloatBetween(0.96, 1.04),
    });
  }

  private createBlockNode(
    block: MineRunState['blocks'][number],
    x: number,
    y: number,
    size: number,
    disabled: boolean,
  ): MiningBlockNode {
    const isClosed = block.state === 'closed';
    const isOpenedEmpty = block.state === 'opened' && (!block.visibleType || block.visibleType === 'empty');
    const fill = isClosed ? 0x3d2f22 : 0x2b241d;
    const stroke = isClosed ? 0xcfb27d : 0x9d8b72;
    const background = this.add.rectangle(0, 0, size, size, fill, 0.94)
      .setStrokeStyle(2, stroke, 0.95)
      .setOrigin(0);

    if (isOpenedEmpty) {
      // Open empty cells should not leave a visible square artifact.
      background.setVisible(false);
    }

    const baseSpriteSource = this.resolveBaseSprite(block);
    const baseTextureKey = baseSpriteSource ? this.resolveTextureKey(baseSpriteSource) : null;
    const baseSprite = baseTextureKey && this.textures.exists(baseTextureKey)
      ? this.add.image(size / 2, size / 2, baseTextureKey).setDisplaySize(size - 3, size - 3)
      : null;

    if (baseSpriteSource && !baseSprite) {
      this.requestDynamicImage(baseSpriteSource);
    }

    const content: Phaser.GameObjects.GameObject[] = [background];
    if (baseSprite) {
      content.push(baseSprite);
    }

    if (this.isCrackedBlock(block)) {
      const crackedTextureKey = this.resolveTextureKey(MINE_CELL_SPRITES.cracked);
      if (crackedTextureKey && this.textures.exists(crackedTextureKey)) {
        content.push(
          this.add.image(size / 2, size / 2, crackedTextureKey)
            .setDisplaySize(size - 2, size - 2)
            .setAlpha(0.86),
        );
      } else {
        this.requestDynamicImage(MINE_CELL_SPRITES.cracked);
        content.push(this.add.rectangle(size / 2, size / 2, size - 6, size - 6, 0x68412f, 0.24));
      }
    }

    const specialIconSource = block.visibleType === 'passage'
      ? MINE_CELL_SPRITES.passage
      : block.visibleType === 'exit'
        ? MINE_CELL_SPRITES.exit
        : null;

    const resourceIconSource = this.resolveResourceIcon(block);
    const overlayIconSource = resourceIconSource ?? specialIconSource;
    if (overlayIconSource) {
      const overlayTextureKey = this.resolveTextureKey(overlayIconSource);
      if (overlayTextureKey && this.textures.exists(overlayTextureKey)) {
        content.push(
          this.add.image(size / 2, size / 2, overlayTextureKey)
            .setDisplaySize(size * 0.62, size * 0.62)
            .setAlpha(0.98),
        );
      } else {
        this.requestDynamicImage(overlayIconSource);
      }
    }

    const container = this.add.container(x, y, content);
    container.setSize(size, size);
    container.setDepth(isClosed ? 10 : 8);

    return {
      container,
      background,
      fill,
      isClosed,
      disabled,
      size,
    };
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    const nextHover = this.findHoverBlock(pointer.x, pointer.y);
    this.setHoveredBlock(nextHover);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (this.hoveredBlockIndex === null) {
      return;
    }

    const blockIndex = this.hoveredBlockIndex;
    const node = this.blockNodes.get(blockIndex);
    if (!node || !node.isClosed || node.disabled) {
      return;
    }

    const isRightButton = pointer.button === 2 || pointer.rightButtonDown();
    if (isRightButton) {
      pointer.event?.preventDefault();
      this.onBlockContextMenu?.({ blockIndex, x: pointer.x, y: pointer.y });
      return;
    }

    if (this.pendingBlockIndex !== null || !this.onHitBlock) {
      return;
    }

    const bounds = node.container.getBounds();
    const hitInset = Math.max(3, Math.floor(node.size * 0.08));
    const hitX = Phaser.Math.Clamp(pointer.x, bounds.left + hitInset, bounds.right - hitInset);
    const hitY = Phaser.Math.Clamp(pointer.y, bounds.top + hitInset, bounds.bottom - hitInset);

    this.pendingBlockIndex = blockIndex;
    this.playPickaxeImpact(
      blockIndex,
      node.container,
      { x: hitX, y: hitY },
      () => {
        try {
          this.onHitBlock?.(blockIndex);
        } finally {
          this.pendingBlockIndex = null;
        }
      },
    );
  }

  private findHoverBlock(pointerX: number, pointerY: number): number | null {
    let winnerBlockIndex: number | null = null;
    let winnerScore = Number.POSITIVE_INFINITY;
    this.blockNodes.forEach((node, blockIndex) => {
      if (!node.isClosed || node.disabled) {
        return;
      }
      const bounds = node.container.getBounds();
      const inset = Math.max(3, Math.floor(node.size * 0.08));
      const left = bounds.left + inset;
      const right = bounds.right - inset;
      const top = bounds.top + inset;
      const bottom = bounds.bottom - inset;
      if (pointerX < left || pointerX > right || pointerY < top || pointerY > bottom) {
        return;
      }
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      const score = Phaser.Math.Distance.Squared(pointerX, pointerY, centerX, centerY);
      if (score < winnerScore) {
        winnerScore = score;
        winnerBlockIndex = blockIndex;
      }
    });
    return winnerBlockIndex;
  }

  private setHoveredBlock(nextIndex: number | null) {
    if (this.hoveredBlockIndex === nextIndex) {
      return;
    }

    if (this.hoveredBlockIndex !== null) {
      const prevNode = this.blockNodes.get(this.hoveredBlockIndex);
      if (prevNode) {
        this.tweens.killTweensOf(prevNode.container);
        prevNode.container.setScale(1);
        prevNode.background.setFillStyle(prevNode.fill, 0.94);
      }
    }

    this.hoveredBlockIndex = nextIndex;

    if (nextIndex !== null) {
      const nextNode = this.blockNodes.get(nextIndex);
      if (nextNode) {
        this.tweens.killTweensOf(nextNode.container);
        nextNode.container.setScale(1.02);
        nextNode.background.setFillStyle(0x7a6245, 1);
      }
    }
  }

  private maybePlayCollapseCinematic(snapshot: MiningSnapshot) {
    const log = snapshot.run.eventLog ?? [];
    if (this.previousEventLogSize <= 0) {
      this.previousEventLogSize = log.length;
      return;
    }

    const delta = log.slice(this.previousEventLogSize);
    this.previousEventLogSize = log.length;
    const collapseEntry = [...delta].reverse().find((entry) => /обвал:/i.test(entry));
    if (!collapseEntry) {
      return;
    }

    const signature = `${snapshot.run.runId}:${log.length}:${collapseEntry}`;
    if (signature === this.lastCollapseSignature) {
      return;
    }
    this.lastCollapseSignature = signature;
    this.playCollapseCinematic();
  }

  private playCollapseCinematic() {
    if (!this.fxLayer) {
      return;
    }

    this.playSfx(MINING_SFX.collapseRumble, 0.34);
    this.playSfx(MINING_SFX.debrisFall, 0.27);
    this.cameras.main.shake(150, 0.0052, true);

    const width = this.scale.width;
    const height = this.scale.height;
    const dustOverlay = this.add.rectangle(width / 2, Math.max(110, height * 0.34), width * 1.1, Math.max(140, height * 0.45), 0x776551, 0.2)
      .setDepth(36);
    this.fxLayer.add(dustOverlay);
    this.tweens.add({
      targets: dustOverlay,
      alpha: 0,
      duration: 360,
      ease: 'Sine.easeOut',
      onComplete: () => dustOverlay.destroy(),
    });

    const fallingCount = Phaser.Math.Between(16, 26);
    for (let index = 0; index < fallingCount; index += 1) {
      const source = COLLAPSE_ROCK_SPRITES[index % COLLAPSE_ROCK_SPRITES.length];
      const textureKey = this.resolveTextureKey(source);
      const startX = Phaser.Math.Between(-20, width + 20);
      const startY = Phaser.Math.Between(-240, -28);
      const targetY = Phaser.Math.Between(Math.floor(height * 0.48), Math.floor(height * 0.95));
      const driftX = Phaser.Math.Between(-52, 52);
      const duration = Phaser.Math.Between(360, 640);

      const rock: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle = textureKey && this.textures.exists(textureKey)
        ? this.add.image(startX, startY, textureKey).setDisplaySize(Phaser.Math.Between(16, 34), Phaser.Math.Between(16, 34)).setDepth(34)
        : this.add.rectangle(startX, startY, Phaser.Math.Between(7, 13), Phaser.Math.Between(7, 13), 0x5f4d3d, 0.92).setDepth(34);

      if (!textureKey || !this.textures.exists(textureKey)) {
        this.requestDynamicImage(source);
      }

      this.fxLayer.add(rock);
      this.tweens.add({
        targets: rock,
        x: startX + driftX,
        y: targetY,
        angle: Phaser.Math.Between(-200, 200),
        ease: 'Cubic.easeIn',
        duration,
        onComplete: () => {
          this.playImpactFx(rock.x, rock.y);
          this.tweens.add({
            targets: rock,
            alpha: 0,
            duration: 100,
            onComplete: () => rock.destroy(),
          });
        },
      });
    }
  }

  private resolveTextureKey(source: string): string | null {
    const textureKey = this.loadedImageSources.get(source);
    return textureKey ?? null;
  }

  private resolveBaseSprite(block: MineRunState['blocks'][number]): string | null {
    if (block.state === 'opened' || block.visibleType === 'loot' || block.visibleType === 'empty' || block.visibleType === 'passage' || block.visibleType === 'exit') {
      // Keep opened cells visually clean: once broken, the stone sprite should disappear.
      return null;
    }

    const depthLevel = this.snapshot?.depth.depthLevel ?? 1;
    if (depthLevel >= 3) {
      return MINE_CELL_SPRITES.depth3;
    }
    if (depthLevel === 2) {
      return MINE_CELL_SPRITES.depth2;
    }
    return MINE_CELL_SPRITES.depth1;
  }

  private isCrackedBlock(block: MineRunState['blocks'][number]): boolean {
    const normalizedLabel = String(block.label ?? '').trim().toLowerCase();
    return block.state === 'closed' && (normalizedLabel.includes('1x') || normalizedLabel.includes('1х') || normalizedLabel.includes('трещ'));
  }

  private resolveResourceIcon(block: MineRunState['blocks'][number]): string | null {
    if (block.visibleType !== 'loot' || !block.loot?.length) {
      return null;
    }
    const first = block.loot[0];
    if (!first?.itemId) {
      return null;
    }
    return this.snapshot?.itemIconById[first.itemId] ?? null;
  }

  private playPickaxeImpact(
    blockIndex: number,
    blockNode: Phaser.GameObjects.Container,
    pointerWorld: { x: number; y: number } | null,
    onImpactResolved: () => void,
  ) {
    void blockIndex;
    if (!this.pickaxe || !this.fxLayer) {
      onImpactResolved();
      return;
    }

    const bounds = blockNode.getBounds();
    const hitX = pointerWorld
      ? Phaser.Math.Clamp(pointerWorld.x, bounds.left + 6, bounds.right - 6)
      : bounds.centerX;
    const hitY = pointerWorld
      ? Phaser.Math.Clamp(pointerWorld.y, bounds.top + 6, bounds.bottom - 6)
      : bounds.centerY;
    const targetX = hitX;
    const targetY = hitY;
    this.pickaxe.setVisible(true);
    this.pickaxe.setPosition(targetX + 70, targetY - 62);
    this.pickaxe.setRotation(1.16);

    this.tweens.killTweensOf(this.pickaxe);
    this.tweens.add({
      targets: this.pickaxe,
      x: targetX + 18,
      y: targetY - 18,
      rotation: 0.52,
      duration: 104,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.pickaxe,
          x: targetX,
          y: targetY,
          rotation: -0.92,
          duration: 70,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            void playRegisteredSound('res_mine_hit', {
              fallbackUrl: MINING_SFX.mineHit,
              volumeMultiplier: 0.3,
            });
            this.cameras.main.shake(64, 0.0016, true);
            this.playImpactFx(hitX, hitY);
            const originX = blockNode.x;
            const originY = blockNode.y;
            this.tweens.add({
              targets: blockNode,
              x: originX + 1.3,
              y: originY + 0.9,
              yoyo: true,
              repeat: 2,
              duration: 34,
              ease: 'Sine.easeInOut',
              onComplete: () => {
                blockNode.setPosition(originX, originY);
                this.playCrumbleFx(blockNode, hitX, hitY, onImpactResolved);
              },
            });
            this.tweens.add({
              targets: this.pickaxe,
              x: targetX + 38,
              y: targetY - 30,
              rotation: 0.28,
              duration: 92,
              ease: 'Quad.easeOut',
              onComplete: () => {
                this.pickaxe?.setVisible(false);
              },
            });
          },
        });
      },
    });
  }

  private playCrumbleFx(
    blockNode: Phaser.GameObjects.Container,
    hitX: number,
    hitY: number,
    onComplete: () => void,
  ) {
    const shardCount = 12;
    const shardColors = [0xc9b48d, 0xb08d62, 0x8a6847, 0x6a4f36];

    for (let index = 0; index < shardCount; index += 1) {
      const size = 2 + Math.floor(Math.random() * 4);
      const shard = this.add.rectangle(
        hitX + Phaser.Math.Between(-7, 7),
        hitY + Phaser.Math.Between(-7, 7),
        size,
        size,
        shardColors[index % shardColors.length],
        0.95,
      );
      this.fxLayer?.add(shard);
      this.tweens.add({
        targets: shard,
        x: shard.x + Phaser.Math.Between(-24, 24),
        y: shard.y + Phaser.Math.Between(-20, 18),
        angle: Phaser.Math.Between(-120, 120),
        alpha: 0,
        scaleX: 0.55,
        scaleY: 0.55,
        duration: 140,
        ease: 'Cubic.easeOut',
        onComplete: () => shard.destroy(),
      });
    }

    this.tweens.add({
      targets: blockNode.list,
      alpha: 0,
      duration: 90,
      ease: 'Quad.easeIn',
      onComplete,
    });
  }

  private playImpactFx(x: number, y: number) {
    if (!this.fxLayer) {
      return;
    }
    for (let index = 0; index < 9; index += 1) {
      const dot = this.add.circle(x, y, 3 + (index % 2), 0xd8c28f, 0.85);
      this.fxLayer.add(dot);
      const angle = (Math.PI * 2 * index) / 9;
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * (16 + index * 2.2),
        y: y + Math.sin(angle) * (16 + index * 2.2),
        alpha: 0,
        scale: 0.2,
        duration: 240,
        onComplete: () => dot.destroy(),
      });
    }
  }

  private playReveal(node: Phaser.GameObjects.Container) {
    node.setAlpha(0.35);
    node.setScale(0.86);
    this.tweens.add({
      targets: node,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: 'Back.easeOut',
    });
  }
}

export function MiningPhaserRenderer({
  mine,
  depth,
  run,
  disabled,
  onHitBlock,
  onBlockContextMenu,
  onMusicStatus,
}: MiningPhaserRendererProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<MiningScene | null>(null);
  const [size, setSize] = useState({ width: 720, height: 520 });
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [itemIconById, setItemIconById] = useState<Record<string, string | undefined>>({});
  const mineMusicRef = useRef<HTMLAudioElement | null>(null);
  const mineMusicStoppedRef = useRef(false);
  const mineMusicLastTrackRef = useRef<number | null>(null);
  const pausedExternalMediaRef = useRef<HTMLMediaElement[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadRuntimeImages()
      .then((images) => {
        if (!cancelled) {
          setRuntimeImages(images);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRuntimeImages([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const itemIds = new Set<string>();
    run.blocks.forEach((block) => {
      block.loot?.forEach((drop) => {
        if (drop.itemId) {
          itemIds.add(drop.itemId);
        }
      });
    });
    run.temporaryLoot.forEach((drop) => {
      if (drop.itemId) {
        itemIds.add(drop.itemId);
      }
    });

    if (!itemIds.size) {
      setItemIconById({});
      return () => {
        cancelled = true;
      };
    }

    const resolveIconUrl = async (itemId: string): Promise<string | undefined> => {
      const item = await itemsService.getById(itemId);
      if (item?.imagePath) {
        return resolveStoredImageSource(item.imagePath, runtimeImages) ?? resolveImageSource(item.imagePath) ?? undefined;
      }

      const material = await materialsService.getById(itemId);
      if (material?.imagePath) {
        return resolveStoredImageSource(material.imagePath, runtimeImages) ?? resolveImageSource(material.imagePath) ?? undefined;
      }

      return undefined;
    };

    Promise.all(Array.from(itemIds).map(async (itemId) => [itemId, await resolveIconUrl(itemId)] as const))
      .then((pairs) => {
        if (cancelled) {
          return;
        }
        const nextMap: Record<string, string | undefined> = {};
        pairs.forEach(([itemId, iconUrl]) => {
          nextMap[itemId] = iconUrl;
        });
        setItemIconById(nextMap);
      })
      .catch(() => {
        if (!cancelled) {
          setItemIconById({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [run.blocks, run.temporaryLoot, runtimeImages]);

  useEffect(() => {
    if (!onMusicStatus) {
      return undefined;
    }

    mineMusicStoppedRef.current = false;
    mineMusicLastTrackRef.current = null;
    pausedExternalMediaRef.current = [];
    const failedTracks = new Set<number>();
    let retryTimer: number | null = null;
    let unlockHandler: (() => void) | null = null;

    if (typeof document !== 'undefined') {
      const media = Array.from(document.querySelectorAll('audio, video')) as HTMLMediaElement[];
      for (const entry of media) {
        if (!entry.paused) {
          pausedExternalMediaRef.current.push(entry);
          entry.pause();
        }
      }
    }

    const audio = mineMusicRef.current ?? new Audio();
    mineMusicRef.current = audio;
    audio.preload = 'auto';
    audio.loop = false;
    onMusicStatus?.(`Музыка шахты: найдено треков ${MINING_MUSIC_TRACKS.length}.`);

    const applyVolume = () => {
      // Keep mine music below pickaxe impact loudness.
      audio.volume = Math.max(0.03, Math.min(0.14, getGlobalAudioVolume() * 0.12));
    };

    const pickNextTrack = (exclude: number | null): number | null => {
      const available = MINING_MUSIC_TRACKS.map((_, index) => index)
        .filter((index) => index !== exclude && !failedTracks.has(index));
      if (available.length === 0) {
        return null;
      }
      return available[Math.floor(Math.random() * available.length)] ?? null;
    };

    const scheduleNextTrack = (exclude: number | null, delayMs: number) => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        playNextTrack(exclude);
      }, delayMs);
    };

    const detachUnlockListener = () => {
      if (!unlockHandler || typeof window === 'undefined') {
        return;
      }
      window.removeEventListener('pointerdown', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
      unlockHandler = null;
    };

    const waitForUserUnlock = (exclude: number | null) => {
      if (unlockHandler || typeof window === 'undefined') {
        return;
      }
      onMusicStatus?.('Музыка ожидает клик/клавишу (ограничение автозапуска браузера).');
      unlockHandler = () => {
        detachUnlockListener();
        scheduleNextTrack(exclude, 20);
      };
      window.addEventListener('pointerdown', unlockHandler, { once: true });
      window.addEventListener('keydown', unlockHandler, { once: true });
    };

    const playNextTrack = (exclude: number | null) => {
      if (mineMusicStoppedRef.current) {
        return;
      }
      const nextTrackIndex = pickNextTrack(exclude);
      if (nextTrackIndex === null) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        return;
      }
      mineMusicLastTrackRef.current = nextTrackIndex;
      audio.pause();
      audio.currentTime = 0;
      audio.src = MINING_MUSIC_TRACKS[nextTrackIndex]!;
      applyVolume();
      void audio.play().then(() => {
        onMusicStatus?.(`Музыка: ${MINING_MUSIC_TRACKS[nextTrackIndex]!.split('/').pop() ?? 'трек'} играет.`);
      }).catch((error) => {
        if (mineMusicStoppedRef.current) {
          return;
        }
        if (isBenignPlayInterruption(error)) {
          return;
        }
        if (isAutoplayBlocked(error)) {
          waitForUserUnlock(nextTrackIndex);
          return;
        }
        failedTracks.add(nextTrackIndex);
        const errText = error instanceof Error ? error.message : 'unknown error';
        onMusicStatus?.(`Ошибка трека ${MINING_MUSIC_TRACKS[nextTrackIndex]!.split('/').pop() ?? ''}: ${errText}`);
        scheduleNextTrack(nextTrackIndex, 220);
      });
    };

    audio.onended = () => {
      playNextTrack(mineMusicLastTrackRef.current);
    };
    audio.onerror = () => {
      const failedIndex = mineMusicLastTrackRef.current;
      if (typeof failedIndex === 'number') {
        failedTracks.add(failedIndex);
      }
      onMusicStatus?.('Ошибка загрузки/воспроизведения трека, пытаюсь переключить.');
      waitForUserUnlock(failedIndex ?? null);
      scheduleNextTrack(failedIndex ?? null, 220);
    };

    playNextTrack(null);

    return () => {
      mineMusicStoppedRef.current = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      detachUnlockListener();
      if (mineMusicRef.current) {
        mineMusicRef.current.onended = null;
        mineMusicRef.current.onerror = null;
        mineMusicRef.current.pause();
        mineMusicRef.current.currentTime = 0;
      }
      pausedExternalMediaRef.current = [];
      onMusicStatus?.('Музыка шахты остановлена.');
    };
  }, [onMusicStatus]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const resize = () => {
      const nextWidth = Math.max(320, Math.floor(host.clientWidth || 720));
      const nextHeight = Math.max(280, Math.floor(host.clientHeight || 520));
      setSize((current) => (current.width === nextWidth && current.height === nextHeight ? current : { width: nextWidth, height: nextHeight }));
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || gameRef.current) {
      return undefined;
    }

    while (host.firstChild) {
      host.removeChild(host.firstChild);
    }

    const scene = new MiningScene();
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: size.width,
      height: size.height,
      parent: host,
      transparent: true,
      audio: {
        disableWebAudio: true,
      },
      scene: [scene],
      scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      render: {
        antialias: true,
        pixelArt: false,
      },
    });
    gameRef.current = game;

    return () => {
      sceneRef.current = null;
      gameRef.current = null;
      game.destroy(true);
      while (host.firstChild) {
        host.removeChild(host.firstChild);
      }
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }
    scene.setSnapshot({
      mine,
      depth,
      run,
      widthPx: size.width,
      heightPx: size.height,
      itemIconById,
    }, disabled ? () => undefined : onHitBlock, disabled ? undefined : onBlockContextMenu);
  }, [depth, disabled, itemIconById, mine, onBlockContextMenu, onHitBlock, run, size.height, size.width]);

  return (
    <div
      ref={hostRef}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        width: '100%',
        minHeight: 620,
        height: '100%',
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid rgba(164, 141, 110, 0.28)',
        background: 'radial-gradient(circle at top, rgba(91, 63, 38, 0.32), rgba(20, 14, 10, 0.96))',
      }}
    />
  );
}
