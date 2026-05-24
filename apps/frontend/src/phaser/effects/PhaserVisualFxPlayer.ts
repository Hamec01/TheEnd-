import type { VisualFxDefinition } from '@theend/rpg-domain';
import Phaser from 'phaser';

type FxPoint = { x: number; y: number };

export interface PlayFxAtOptions {
  x: number;
  y: number;
  scale?: number;
  rotation?: number;
  depth?: number;
  autoDestroy?: boolean;
  onComplete?: () => void;
}

export interface PlayProjectileOptions {
  from: FxPoint;
  to: FxPoint;
  onImpact?: () => void;
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function trimQuery(value: string): string {
  return value.split('?')[0] ?? value;
}

function resolveBlendMode(value: VisualFxDefinition['render']['blendMode']): Phaser.BlendModes {
  switch (value) {
    case 'ADD':
      return Phaser.BlendModes.ADD;
    case 'MULTIPLY':
      return Phaser.BlendModes.MULTIPLY;
    case 'SCREEN':
      return Phaser.BlendModes.SCREEN;
    default:
      return Phaser.BlendModes.NORMAL;
  }
}

function withVersion(url: string, version?: string): string {
  if (!version || url.startsWith('data:')) {
    return url;
  }
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}

function shouldMoveAsProjectile(fx: VisualFxDefinition): boolean {
  return fx.category === 'projectile' || fx.placement?.defaultPlayOn === 'projectile';
}

export class PhaserVisualFxPlayer {
  private registry = new Map<string, VisualFxDefinition>();
  private loadingKeys = new Set<string>();
  private failedKeys = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  setRegistry(definitions: VisualFxDefinition[]): void {
    this.registry = new Map(definitions.map((entry) => [entry.id, entry]));
  }

  getFx(id: string | null | undefined): VisualFxDefinition | undefined {
    const normalized = id?.trim();
    if (!normalized) {
      return undefined;
    }
    const fx = this.registry.get(normalized);
    if (!fx || fx.status === 'disabled') {
      return undefined;
    }
    return fx;
  }

  playFxById(id: string | null | undefined, options: PlayFxAtOptions): boolean {
    const fx = this.getFx(id);
    if (!fx) {
      return false;
    }
    return this.playFxAt(fx, options);
  }

  playProjectileById(id: string | null | undefined, options: PlayProjectileOptions): boolean {
    const fx = this.getFx(id);
    if (!fx) {
      return false;
    }
    return this.playProjectile(fx, options);
  }

  playFxAt(fx: VisualFxDefinition, options: PlayFxAtOptions): boolean {
    const url = fx.asset.url?.trim();
    if (!url) {
      return false;
    }

    this.ensureLoaded(fx, () => {
      this.spawnFxAt(fx, options);
    });
    return true;
  }

  playProjectile(fx: VisualFxDefinition, options: PlayProjectileOptions): boolean {
    const url = fx.asset.url?.trim();
    if (!url) {
      return false;
    }

    if (!shouldMoveAsProjectile(fx)) {
      return this.playFxAt(fx, {
        x: options.to.x,
        y: options.to.y,
        onComplete: options.onImpact,
      });
    }

    this.ensureLoaded(fx, () => {
      const sprite = this.spawnFxAt(fx, {
        x: options.from.x,
        y: options.from.y,
        autoDestroy: false,
        rotation: fx.placement.rotateToDirection === false
          ? fx.render.rotation
          : Phaser.Math.Angle.Between(options.from.x, options.from.y, options.to.x, options.to.y),
      });
      if (!sprite) {
        options.onImpact?.();
        return;
      }

      const distance = Phaser.Math.Distance.Between(options.from.x, options.from.y, options.to.x, options.to.y);
      const speed = Math.max(1, fx.projectile?.speed ?? 650);
      const duration = Math.max(80, (distance / speed) * 1000);
      this.scene.tweens.add({
        targets: sprite,
        x: options.to.x + (fx.placement.offsetX ?? 0),
        y: options.to.y + (fx.placement.offsetY ?? 0),
        duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (fx.projectile?.destroyOnImpact !== false) {
            sprite.destroy();
          }
          options.onImpact?.();
        },
      });
    });
    return true;
  }

  private textureKey(fx: VisualFxDefinition): string {
    const signature = [
      fx.id,
      fx.asset.key,
      trimQuery(fx.asset.url ?? ''),
      fx.type,
      fx.asset.frameWidth,
      fx.asset.frameHeight,
      fx.asset.frameCount,
      fx.updatedAt,
    ].join('|');
    return `visual-fx:${fx.asset.key || fx.id}:${hashString(signature)}`;
  }

  private animationKey(fx: VisualFxDefinition): string {
    return `${this.textureKey(fx)}:anim`;
  }

  private ensureLoaded(fx: VisualFxDefinition, onReady: () => void): void {
    const key = this.textureKey(fx);
    if (this.failedKeys.has(key)) {
      return;
    }

    if (this.scene.textures.exists(key)) {
      this.ensureAnimation(fx);
      onReady();
      return;
    }

    if (this.loadingKeys.has(key)) {
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (this.scene.textures.exists(key)) {
          this.ensureAnimation(fx);
          onReady();
        }
      });
      return;
    }

    this.loadingKeys.add(key);
    const source = withVersion(fx.asset.url, fx.updatedAt);
    if (fx.type === 'sprite_sheet') {
      this.scene.load.spritesheet(key, source, {
        frameWidth: Math.max(1, fx.asset.frameWidth ?? 1),
        frameHeight: Math.max(1, fx.asset.frameHeight ?? 1),
      });
    } else {
      this.scene.load.image(key, source);
    }

    this.scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.key === key) {
        this.failedKeys.add(key);
      }
    });
    this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.loadingKeys.delete(key);
      if (this.scene.textures.exists(key)) {
        this.ensureAnimation(fx);
        onReady();
      }
    });

    if (!this.scene.load.isLoading()) {
      this.scene.load.start();
    }
  }

  private ensureAnimation(fx: VisualFxDefinition): void {
    if (fx.type !== 'sprite_sheet') {
      return;
    }
    const animationKey = this.animationKey(fx);
    if (this.scene.anims.exists(animationKey)) {
      return;
    }
    const frameCount = Math.max(1, fx.asset.frameCount ?? 1);
    this.scene.anims.create({
      key: animationKey,
      frames: this.scene.anims.generateFrameNumbers(this.textureKey(fx), {
        start: 0,
        end: frameCount - 1,
      }),
      frameRate: Math.max(1, fx.animation.frameRate ?? 12),
      repeat: fx.animation.repeat ?? 0,
    });
  }

  private spawnFxAt(fx: VisualFxDefinition, options: PlayFxAtOptions): Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null {
    const key = this.textureKey(fx);
    if (!this.scene.textures.exists(key)) {
      return null;
    }

    const x = options.x + (fx.placement.offsetX ?? 0);
    const y = options.y + (fx.placement.offsetY ?? 0);
    const depth = options.depth ?? fx.render.depth ?? 5000;
    const scale = (options.scale ?? 1) * (fx.render.scale ?? 1);
    const rotation = options.rotation ?? fx.render.rotation ?? 0;
    const autoDestroy = options.autoDestroy !== false;

    const object = fx.type === 'sprite_sheet'
      ? this.scene.add.sprite(x, y, key)
      : this.scene.add.image(x, y, key);
    object
      .setOrigin(fx.render.originX ?? 0.5, fx.render.originY ?? 0.5)
      .setScale(scale)
      .setAlpha(fx.render.alpha ?? 1)
      .setRotation(rotation)
      .setDepth(depth)
      .setBlendMode(resolveBlendMode(fx.render.blendMode));

    if (fx.type === 'sprite_sheet') {
      const sprite = object as Phaser.GameObjects.Sprite;
      sprite.play(this.animationKey(fx));
      const cleanupDelay = Math.max(80, fx.animation.durationMs ?? 600);
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (autoDestroy) {
          options.onComplete?.();
          sprite.destroy();
        }
      });
      if (autoDestroy && (fx.animation.repeat ?? 0) < 0) {
        this.scene.time.delayedCall(cleanupDelay, () => {
          options.onComplete?.();
          sprite.destroy();
        });
      }
    } else {
      if (!autoDestroy) {
        return object;
      }
      const duration = Math.max(80, fx.animation.durationMs ?? 420);
      this.scene.tweens.add({
        targets: object,
        alpha: 0,
        scale: scale * 1.18,
        duration,
        ease: 'Quad.easeOut',
        onComplete: () => {
          options.onComplete?.();
          object.destroy();
        },
      });
    }

    return object;
  }
}
