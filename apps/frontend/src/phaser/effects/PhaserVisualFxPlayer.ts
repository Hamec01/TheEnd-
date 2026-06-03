import type {
  SkillMovementBehavior,
  VisualEffectProjectileBehavior,
  VisualEffectStage,
  VisualFxDefinition,
} from '@theend/rpg-domain';
import Phaser from 'phaser';

type FxPoint = { x: number; y: number };

type SequenceResultKind = 'hit' | 'crit' | 'miss';

interface StageRuntimeResult {
  stageId: string;
  resolvedTargets: FxPoint[];
  endPositions: FxPoint[];
  selectedFxId?: string;
}

export interface VisualFxSequenceContext {
  casterId?: string;
  targetId?: string;
  casterPosition: FxPoint;
  targetPosition: FxPoint;
  groundPosition?: FxPoint;
  projectileCurrentPosition?: FxPoint;
  projectileEndPosition?: FxPoint;
  previousStageEndPosition?: FxPoint;
  additionalTargetPositions?: FxPoint[];
  result?: SequenceResultKind;
  stageResults: Record<string, StageRuntimeResult>;
  movementHook?: (behavior: SkillMovementBehavior, from: FxPoint, to: FxPoint) => Promise<void> | void;
  audioHook?: (soundId: string, volume?: number) => void;
  cameraHook?: (preset: NonNullable<VisualFxDefinition['camera']>['shakePreset']) => void;
}

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
  if (fx.placement?.mode && fx.placement.mode !== 'once') {
    return false;
  }
  return fx.category === 'projectile' || fx.placement?.defaultPlayOn === 'projectile';
}

function uniquePoints(points: FxPoint[]): FxPoint[] {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function clonePoint(point: FxPoint | undefined): FxPoint | undefined {
  return point ? { x: point.x, y: point.y } : undefined;
}

function isProjectileBehavior(value: unknown): value is VisualEffectProjectileBehavior {
  return value === 'projectile_straight' || value === 'projectile_arc';
}

function isSkillMovementBehavior(value: unknown): value is SkillMovementBehavior {
  return value === 'dash_to_target'
    || value === 'teleport_to_target'
    || value === 'teleport_there_and_back';
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

  isComposite(id: string | null | undefined): boolean {
    return this.getFx(id)?.kind === 'composite';
  }

  createSequenceContext(partial: Partial<VisualFxSequenceContext>): VisualFxSequenceContext {
    const casterPosition = partial.casterPosition ?? partial.targetPosition ?? { x: 0, y: 0 };
    const targetPosition = partial.targetPosition ?? partial.casterPosition ?? { x: 0, y: 0 };
    return {
      casterId: partial.casterId,
      targetId: partial.targetId,
      casterPosition: { ...casterPosition },
      targetPosition: { ...targetPosition },
      groundPosition: clonePoint(partial.groundPosition),
      projectileCurrentPosition: clonePoint(partial.projectileCurrentPosition),
      projectileEndPosition: clonePoint(partial.projectileEndPosition),
      previousStageEndPosition: clonePoint(partial.previousStageEndPosition),
      additionalTargetPositions: (partial.additionalTargetPositions ?? []).map((point) => ({ ...point })),
      result: partial.result ?? 'hit',
      stageResults: partial.stageResults ?? {},
      movementHook: partial.movementHook,
      audioHook: partial.audioHook,
      cameraHook: partial.cameraHook,
    };
  }

  playEffectById(id: string | null | undefined, partialContext: Partial<VisualFxSequenceContext>): boolean {
    const fx = this.getFx(id);
    if (!fx) {
      return false;
    }
    void this.playEffect(fx, this.createSequenceContext(partialContext));
    return true;
  }

  playFxById(id: string | null | undefined, options: PlayFxAtOptions): boolean {
    const fx = this.getFx(id);
    if (!fx) {
      return false;
    }
    if (fx.kind === 'composite') {
      return this.playEffectById(id, {
        casterPosition: { x: options.x, y: options.y },
        targetPosition: { x: options.x, y: options.y },
        groundPosition: { x: options.x, y: options.y },
      });
    }
    return this.playFxAt(fx, options);
  }

  playProjectileById(id: string | null | undefined, options: PlayProjectileOptions): boolean {
    const fx = this.getFx(id);
    if (!fx) {
      return false;
    }
    if (fx.kind === 'composite') {
      return this.playEffectById(id, {
        casterPosition: { ...options.from },
        targetPosition: { ...options.to },
        groundPosition: { ...options.to },
      });
    }
    return this.playProjectile(fx, options);
  }

  async playEffect(fx: VisualFxDefinition, context: VisualFxSequenceContext, startStageId?: string): Promise<boolean> {
    if (fx.kind === 'composite') {
      await this.playCompositeEffect(fx, context, startStageId);
      return true;
    }

    const point = context.targetPosition ?? context.casterPosition;
    await this.playSingleFx(fx, { x: point.x, y: point.y });
    return true;
  }

  async playCompositeEffect(fx: VisualFxDefinition, context: VisualFxSequenceContext, startStageId?: string): Promise<void> {
    const stages = (fx.stages ?? []).filter((stage) => stage.enabled !== false);
    if (stages.length === 0) {
      return;
    }

    const stageMap = new Map(stages.map((stage, index) => [stage.id, { stage, index }]));
    const visitedCounts = new Map<string, number>();
    const consumedIndexes = new Set<number>();
    const startIds = startStageId
      ? [startStageId]
      : stages.filter((stage) => stage.trigger === 'on_start').map((stage) => stage.id);
    const launchIds = startIds.length > 0 ? startIds : [stages[0]!.id];

    const runById = async (stageId: string): Promise<void> => {
      const lookup = stageMap.get(stageId);
      if (!lookup) {
        return;
      }
      const count = visitedCounts.get(stageId) ?? 0;
      if (count > 8) {
        return;
      }
      visitedCounts.set(stageId, count + 1);
      await this.runStageAndFollowers(fx, stages, lookup.index, context, stageMap, consumedIndexes, runById);
    };

    for (const stageId of launchIds) {
      await runById(stageId);
    }
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
        ease: fx.projectile?.arc ? 'Cubic.easeOut' : 'Sine.easeInOut',
        onUpdate: () => {
          if (fx.projectile?.arc) {
            const progress = Math.max(0, Math.min(1, sprite.getData('travelProgress') ?? 0));
            sprite.setData('travelProgress', progress + (1 / Math.max(1, duration / 16)));
            sprite.setY((options.to.y + (fx.placement.offsetY ?? 0)) - (Math.sin(Math.PI * progress) * fx.projectile.arc));
          }
        },
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

  private async runStageAndFollowers(
    sequenceFx: VisualFxDefinition,
    stages: VisualEffectStage[],
    startIndex: number,
    context: VisualFxSequenceContext,
    stageMap: Map<string, { stage: VisualEffectStage; index: number }>,
    consumedIndexes: Set<number>,
    runById: (stageId: string) => Promise<void>,
  ): Promise<void> {
    if (consumedIndexes.has(startIndex)) {
      return;
    }
    const startStage = stages[startIndex];
    if (!startStage) {
      return;
    }

    const batchIndexes = [startIndex];
    const group = startStage.parallelGroup?.trim();
    if (group) {
      for (let index = startIndex + 1; index < stages.length; index += 1) {
        const candidate = stages[index];
        if (!candidate || candidate.parallelGroup?.trim() !== group || consumedIndexes.has(index)) {
          continue;
        }
        batchIndexes.push(index);
      }
    }
    batchIndexes.forEach((index) => consumedIndexes.add(index));

    const results = await Promise.all(batchIndexes.map(async (index) => this.executeStage(sequenceFx, stages[index]!, context)));
    const lastResult = [...results].reverse().find(Boolean);
    if (lastResult) {
      context.previousStageEndPosition = clonePoint(lastResult.endPositions[0]) ?? context.previousStageEndPosition;
    }

    const branchIds = results.flatMap((result) => result?.stageId ? (stageMap.get(result.stageId)?.stage.branchToStageIds ?? []) : []);
    if (branchIds.length > 0) {
      for (const branchId of branchIds) {
        await runById(branchId);
      }
      return;
    }

    const nextIndex = this.findNextStageIndex(stages, Math.max(...batchIndexes));
    if (nextIndex >= 0) {
      await this.runStageAndFollowers(sequenceFx, stages, nextIndex, context, stageMap, consumedIndexes, runById);
    }
  }

  private findNextStageIndex(stages: VisualEffectStage[], currentIndex: number): number {
    for (let index = currentIndex + 1; index < stages.length; index += 1) {
      const stage = stages[index];
      if (!stage || stage.enabled === false) {
        continue;
      }
      if (stage.trigger === 'on_start') {
        continue;
      }
      return index;
    }
    return -1;
  }

  private stageConditionPasses(stage: VisualEffectStage, context: VisualFxSequenceContext): boolean {
    switch (stage.condition) {
      case 'if_hit':
        return context.result === 'hit' || context.result === 'crit';
      case 'if_crit':
        return context.result === 'crit';
      case 'if_miss':
        return context.result === 'miss';
      default:
        return true;
    }
  }

  private defaultStagePlayOn(stage: VisualEffectStage): NonNullable<VisualEffectStage['playOn']> {
    switch (stage.stageType) {
      case 'cast':
        return 'caster';
      case 'projectile':
        return 'caster';
      case 'impact':
      case 'linger':
        return 'target';
      case 'movement':
      case 'return':
        return 'caster';
      default:
        return 'target';
    }
  }

  private resolveStageTargets(stage: VisualEffectStage, context: VisualFxSequenceContext): FxPoint[] {
    const targetMode = stage.targetMode ?? 'primary_target';
    const basePlayOn = stage.playOn ?? this.defaultStagePlayOn(stage);
    const resolvePrimary = (): FxPoint => {
      switch (basePlayOn) {
        case 'caster':
          return context.casterPosition;
        case 'ground':
          return context.groundPosition ?? context.targetPosition;
        case 'projectile_end':
          return context.projectileEndPosition ?? context.targetPosition;
        case 'projectile_current':
          return context.projectileCurrentPosition ?? context.targetPosition;
        case 'previous_stage_end':
          return context.previousStageEndPosition ?? context.targetPosition;
        case 'target':
        default:
          return context.targetPosition;
      }
    };

    const primary = resolvePrimary();
    const extras = context.additionalTargetPositions ?? [];
    if (targetMode === 'primary_target') {
      return [primary];
    }
    if (targetMode === 'all_targets' || targetMode === 'aoe_targets') {
      return uniquePoints([primary, ...extras]);
    }
    return uniquePoints([primary, ...extras.slice(0, Math.max(0, (stage.maxChainTargets ?? 3) - 1))]);
  }

  private chooseStageFx(stage: VisualEffectStage): VisualFxDefinition | undefined {
    const variants = [
      ...(stage.fxRefId ? [stage.fxRefId] : []),
      ...(stage.fxVariantIds ?? []),
    ].map((entry) => entry.trim()).filter(Boolean);
    if (variants.length === 0) {
      return undefined;
    }
    const chosen = stage.randomizeFxVariant
      ? variants[Math.floor(Math.random() * variants.length)]!
      : variants[0]!;
    const fx = this.getFx(chosen);
    if (fx?.kind === 'single') {
      return fx;
    }
    return undefined;
  }

  private async executeStage(sequenceFx: VisualFxDefinition, stage: VisualEffectStage, context: VisualFxSequenceContext): Promise<StageRuntimeResult | null> {
    if (!this.stageConditionPasses(stage, context)) {
      return null;
    }

    if (stage.trigger === 'after_delay' && (stage.delayMs ?? 0) > 0) {
      await new Promise<void>((resolve) => {
        this.scene.time.delayedCall(stage.delayMs ?? 0, () => resolve());
      });
    }

    if (stage.trigger === 'on_hit' && context.result === 'miss') {
      return null;
    }

    const resolvedTargets = this.resolveStageTargets(stage, context);
    const selectedFx = this.chooseStageFx(stage);

    if (stage.audioRefIds && stage.audioRefIds.length > 0) {
      for (const audioRef of stage.audioRefIds) {
        context.audioHook?.(audioRef, 1);
      }
    }
    if (stage.cameraShakePreset && stage.cameraShakePreset !== 'none') {
      context.cameraHook?.(stage.cameraShakePreset);
    }

    if ((stage.stageType === 'movement' || stage.stageType === 'return') && stage.movementBehavior && isSkillMovementBehavior(stage.movementBehavior)) {
      const target = resolvedTargets[0] ?? context.targetPosition;
      const from = stage.stageType === 'return'
        ? (context.previousStageEndPosition ?? context.targetPosition)
        : context.casterPosition;
      if (context.movementHook) {
        await Promise.resolve(context.movementHook(stage.movementBehavior, from, target));
      } else {
        await this.playGenericMovement(stage.movementBehavior, from, target);
      }
      const result: StageRuntimeResult = {
        stageId: stage.id,
        resolvedTargets,
        endPositions: [target],
      };
      context.stageResults[stage.id] = result;
      context.previousStageEndPosition = clonePoint(target);
      return result;
    }

    if (selectedFx && stage.targetMode === 'chain_targets' && stage.movementBehavior && isProjectileBehavior(stage.movementBehavior)) {
      const chainTargets = resolvedTargets;
      let current = context.casterPosition;
      const endPositions: FxPoint[] = [];
      for (const target of chainTargets) {
        await this.playSingleProjectile(selectedFx, {
          from: stage.chainFromPrevious ? current : context.casterPosition,
          to: target,
        });
        current = target;
        endPositions.push({ ...target });
      }
      const result: StageRuntimeResult = {
        stageId: stage.id,
        resolvedTargets,
        endPositions,
        selectedFxId: selectedFx.id,
      };
      context.projectileEndPosition = clonePoint(endPositions[endPositions.length - 1]);
      context.previousStageEndPosition = clonePoint(endPositions[endPositions.length - 1]);
      context.stageResults[stage.id] = result;
      return result;
    }

    if (selectedFx && stage.stageType === 'projectile') {
      const target = resolvedTargets[0] ?? context.targetPosition;
      await this.playSingleProjectile(selectedFx, {
        from: context.casterPosition,
        to: target,
      });
      const result: StageRuntimeResult = {
        stageId: stage.id,
        resolvedTargets,
        endPositions: [target],
        selectedFxId: selectedFx.id,
      };
      context.projectileEndPosition = clonePoint(target);
      context.projectileCurrentPosition = clonePoint(target);
      context.previousStageEndPosition = clonePoint(target);
      context.stageResults[stage.id] = result;
      return result;
    }

    const endPositions: FxPoint[] = [];
    if (selectedFx) {
      await Promise.all(resolvedTargets.map(async (target) => {
        await this.playSingleFx(selectedFx, {
          x: target.x,
          y: target.y,
          autoDestroy: true,
        }, stage.persistMs || stage.durationMs);
        endPositions.push({ ...target });
      }));
    } else if (stage.stageType === 'sound' || stage.stageType === 'camera') {
      endPositions.push(...resolvedTargets.map((target) => ({ ...target })));
    }

    const result: StageRuntimeResult = {
      stageId: stage.id,
      resolvedTargets,
      endPositions: endPositions.length > 0 ? endPositions : resolvedTargets.map((target) => ({ ...target })),
      selectedFxId: selectedFx?.id,
    };
    context.stageResults[stage.id] = result;
    context.previousStageEndPosition = clonePoint(result.endPositions[0]) ?? context.previousStageEndPosition;
    return result;
  }

  private playSingleFx(fx: VisualFxDefinition, options: PlayFxAtOptions, lingerOverrideMs?: number): Promise<void> {
    return new Promise((resolve) => {
      const original = lingerOverrideMs && fx.placement.mode && fx.placement.mode !== 'once'
        ? { ...fx, placement: { ...fx.placement, lingerDurationMs: lingerOverrideMs } }
        : fx;
      this.playFxAt(original, {
        ...options,
        onComplete: () => {
          options.onComplete?.();
          resolve();
        },
      });
      if ((fx.type === 'sprite_sheet' && (fx.animation.repeat ?? 0) < 0) || (fx.type === 'static_image' && options.autoDestroy === false)) {
        this.scene.time.delayedCall(Math.max(120, lingerOverrideMs ?? fx.animation.durationMs ?? 700), () => resolve());
      }
    });
  }

  private playSingleProjectile(fx: VisualFxDefinition, options: PlayProjectileOptions): Promise<void> {
    return new Promise((resolve) => {
      this.playProjectile(fx, {
        ...options,
        onImpact: () => {
          options.onImpact?.();
          resolve();
        },
      });
    });
  }

  private playGenericMovement(behavior: SkillMovementBehavior, from: FxPoint, to: FxPoint): Promise<void> {
    return new Promise((resolve) => {
      const ghost = this.scene.add.circle(from.x, from.y, 12, 0xf6d8a2, 0.85).setDepth(4900);
      ghost.setStrokeStyle(2, 0xffffff, 0.85);
      if (behavior === 'dash_to_target') {
        this.scene.tweens.add({
          targets: ghost,
          x: to.x,
          y: to.y,
          duration: 140,
          ease: 'Quad.easeOut',
          onComplete: () => {
            ghost.destroy();
            resolve();
          },
        });
        return;
      }

      this.scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 70,
        onComplete: () => {
          ghost.setPosition(to.x, to.y);
          this.scene.tweens.add({
            targets: ghost,
            alpha: 1,
            duration: 70,
            onComplete: () => {
              if (behavior === 'teleport_to_target') {
                this.scene.time.delayedCall(100, () => {
                  ghost.destroy();
                  resolve();
                });
                return;
              }
              this.scene.time.delayedCall(behavior === 'teleport_there_and_back' ? 140 : 40, () => {
                this.scene.tweens.add({
                  targets: ghost,
                  alpha: 0,
                  duration: 70,
                  onComplete: () => {
                    ghost.destroy();
                    resolve();
                  },
                });
              });
            },
          });
        },
      });
    });
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
    const lingerMode = fx.placement.mode === 'linger'
      || fx.placement.mode === 'follow_target'
      || fx.placement.mode === 'follow_caster'
      || fx.placement.mode === 'ground_persist';
    const lingerDuration = Math.max(80, fx.placement.lingerDurationMs ?? fx.animation.durationMs ?? 900);

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
      const cleanupDelay = lingerMode ? lingerDuration : Math.max(80, fx.animation.durationMs ?? 600);
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (autoDestroy && !lingerMode) {
          options.onComplete?.();
          sprite.destroy();
        }
      });
      if (autoDestroy && ((fx.animation.repeat ?? 0) < 0 || lingerMode)) {
        this.scene.time.delayedCall(cleanupDelay, () => {
          options.onComplete?.();
          sprite.destroy();
        });
      }
    } else {
      if (!autoDestroy) {
        return object;
      }
      if (lingerMode) {
        this.scene.time.delayedCall(lingerDuration, () => {
          options.onComplete?.();
          object.destroy();
        });
      } else {
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
    }

    return object;
  }
}
