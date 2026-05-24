import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import type { MineDefinition, MineDepth, MineRunState } from '../../types/mining';
import { itemsService } from '../../services/content/itemsService';
import { materialsService } from '../../services/content/materialsService';
import { loadRuntimeImages, resolveStoredImageSource } from '../../services/content/runtimeImageService';
import type { StoredImage } from '../../services/content/models';

interface MiningPhaserRendererProps {
  mine: MineDefinition;
  depth: MineDepth;
  run: MineRunState;
  disabled: boolean;
  onHitBlock: (blockIndex: number) => void;
}

interface MiningSnapshot {
  mine: MineDefinition;
  depth: MineDepth;
  run: MineRunState;
  widthPx: number;
  heightPx: number;
  itemIconById: Record<string, string | undefined>;
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

function resolveImageSource(value?: string | null): string | null {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
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
  private background?: Phaser.GameObjects.Image;
  private backgroundFallback?: Phaser.GameObjects.Rectangle;
  private gridLayer?: Phaser.GameObjects.Container;
  private fxLayer?: Phaser.GameObjects.Container;
  private pickaxe?: Phaser.GameObjects.Container;
  private blockNodes = new Map<number, Phaser.GameObjects.Container>();
  private previousBlockStates = new Map<number, MineRunState['blocks'][number]['state']>();
  private loadedImageSources = new Map<string, string>();
  private pendingBlockIndex: number | null = null;
  private nextDynamicTextureId = 0;

  constructor() {
    super({ key: 'MiningScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#17110d');
    this.backgroundFallback = this.add.rectangle(0, 0, 10, 10, 0x251a13).setOrigin(0);
    this.gridLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.pickaxe = this.createPickaxe();
    this.renderSnapshot();
  }

  setSnapshot(snapshot: MiningSnapshot, onHitBlock: (blockIndex: number) => void) {
    this.snapshot = snapshot;
    this.onHitBlock = onHitBlock;
    if (this.sys.isActive()) {
      this.renderSnapshot();
    }
  }

  private createPickaxe(): Phaser.GameObjects.Container {
    const handle = this.add.rectangle(0, 0, 10, 46, 0x6a4a2b).setOrigin(0.5, 0.85);
    const head = this.add.rectangle(0, -18, 32, 10, 0xb8b5af).setOrigin(0.5);
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

    this.scale.resize(snapshot.widthPx, snapshot.heightPx);
    this.renderBackground(snapshot);
    this.gridLayer.removeAll(true);
    this.fxLayer.removeAll(true);
    this.blockNodes.clear();

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
      this.gridLayer!.add(node);
      this.blockNodes.set(block.index, node);

      const previousState = this.previousBlockStates.get(block.index);
      if (previousState === 'closed' && block.state === 'opened') {
        this.playReveal(node);
      }
      this.previousBlockStates.set(block.index, block.state);
    });
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

  private createBlockNode(
    block: MineRunState['blocks'][number],
    x: number,
    y: number,
    size: number,
    disabled: boolean,
  ) {
    const isClosed = block.state === 'closed';
    const fill = isClosed ? 0x3d2f22 : 0x2b241d;
    const stroke = isClosed ? 0xcfb27d : 0x9d8b72;
    const background = this.add.rectangle(0, 0, size, size, fill, 0.94)
      .setStrokeStyle(2, stroke, 0.95)
      .setOrigin(0);

    const baseSpriteSource = this.resolveBaseSprite(block);
    const baseTextureKey = this.resolveTextureKey(baseSpriteSource);
    const baseSprite = baseTextureKey && this.textures.exists(baseTextureKey)
      ? this.add.image(size / 2, size / 2, baseTextureKey).setDisplaySize(size - 3, size - 3)
      : null;

    if (!baseSprite) {
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

    if (isClosed && !disabled) {
      const hitArea = new Phaser.Geom.Rectangle(0, 0, size, size);
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
      container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (this.pendingBlockIndex !== null || !this.onHitBlock) {
          return;
        }
        this.pendingBlockIndex = block.index;
        this.playPickaxeImpact(
          block.index,
          container,
          { x: pointer.worldX, y: pointer.worldY },
          () => {
          this.onHitBlock?.(block.index);
          this.pendingBlockIndex = null;
          },
        );
      });
      container.on('pointerover', () => {
        background.setFillStyle(0x71593f, 0.98);
      });
      container.on('pointerout', () => {
        background.setFillStyle(fill, 0.95);
      });
    }

    return container;
  }

  private resolveTextureKey(source: string): string | null {
    const textureKey = this.loadedImageSources.get(source);
    return textureKey ?? null;
  }

  private resolveBaseSprite(block: MineRunState['blocks'][number]): string {
    if (block.state === 'opened' || block.visibleType === 'loot' || block.visibleType === 'empty' || block.visibleType === 'passage' || block.visibleType === 'exit') {
      return MINE_CELL_SPRITES.opened;
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
    onImpact: () => void,
  ) {
    void blockIndex;
    if (!this.pickaxe || !this.fxLayer) {
      onImpact();
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
    this.pickaxe.setPosition(targetX + 54, targetY - 46);
    this.pickaxe.setRotation(1.05);

    this.tweens.killTweensOf(this.pickaxe);
    this.tweens.add({
      targets: this.pickaxe,
      x: targetX + 16,
      y: targetY - 24,
      rotation: 0.36,
      duration: 120,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.pickaxe,
          x: targetX - 8,
          y: targetY + 14,
          rotation: -0.72,
          duration: 90,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            this.playImpactFx(hitX, hitY);
            const originX = blockNode.x;
            const originY = blockNode.y;
            this.tweens.add({
              targets: blockNode,
              x: originX + 3,
              y: originY + 2,
              yoyo: true,
              repeat: 2,
              duration: 40,
              onComplete: () => {
                blockNode.setPosition(originX, originY);
              },
            });
            onImpact();
            this.pickaxe?.setVisible(false);
          },
        });
      },
    });
  }

  private playImpactFx(x: number, y: number) {
    if (!this.fxLayer) {
      return;
    }
    for (let index = 0; index < 6; index += 1) {
      const dot = this.add.circle(x, y, 3 + (index % 2), 0xd8c28f, 0.85);
      this.fxLayer.add(dot);
      const angle = (Math.PI * 2 * index) / 6;
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * (18 + index * 2),
        y: y + Math.sin(angle) * (18 + index * 2),
        alpha: 0,
        scale: 0.2,
        duration: 180,
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
}: MiningPhaserRendererProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<MiningScene | null>(null);
  const [size, setSize] = useState({ width: 720, height: 520 });
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [itemIconById, setItemIconById] = useState<Record<string, string | undefined>>({});

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

    const scene = new MiningScene();
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: size.width,
      height: size.height,
      parent: host,
      transparent: true,
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
    };
  }, [size.height, size.width]);

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
    }, disabled ? () => undefined : onHitBlock);
  }, [depth, disabled, itemIconById, mine, onHitBlock, run, size.height, size.width]);

  return (
    <div
      ref={hostRef}
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
