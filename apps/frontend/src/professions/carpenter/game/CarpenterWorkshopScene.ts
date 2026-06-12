import Phaser from 'phaser';
import { CARPENTER_WORKSHOP_GAME_COLORS, CARPENTER_WORKSHOP_GAME_HEIGHT, CARPENTER_WORKSHOP_GAME_WIDTH } from './carpenterWorkshopGameAssets';
import { resolveCarpenterWorkshopQualityScore } from './carpenterWorkshopGameBalance';
import type {
  CarpenterWorkshopPrepSnapshot,
  CarpenterWorkshopResultSnapshot,
  CarpenterWorkshopRiskLevel,
  CarpenterWorkshopSceneCallbacks,
  CarpenterWorkshopSceneSnapshot,
  CarpenterWorkshopStageResult,
  CarpenterWorkshopWorkSnapshot,
} from './carpenterWorkshopGame.types';

interface ClickTarget {
  x: number;
  y: number;
  width: number;
  height: number;
  onClick: () => void;
}

interface InternalWorkState {
  snapshot: CarpenterWorkshopWorkSnapshot;
  cursorPosition: number;
  cursorDirection: 1 | -1;
  stepElapsedMs: number;
  stepIndex: number;
  completedSteps: number;
  mistakes: number;
  combo: number;
  maxCombo: number;
  integrity: number;
  targetCenter: number;
  targetLane: number;
  selectedLane: number;
  resolved: boolean;
  statusText: string;
}

export class CarpenterWorkshopScene extends Phaser.Scene {
  private snapshot: CarpenterWorkshopSceneSnapshot | null = null;
  private callbacks: CarpenterWorkshopSceneCallbacks | null = null;
  private clickTargets: ClickTarget[] = [];
  private workState: InternalWorkState | null = null;
  private workGraphics?: Phaser.GameObjects.Graphics;
  private workTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: 'CarpenterWorkshopScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor(`#${CARPENTER_WORKSHOP_GAME_COLORS.background.toString(16)}`);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.on('keydown-LEFT', () => this.moveWorkLane(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.moveWorkLane(1));
    this.input.keyboard?.on('keydown-A', () => this.moveWorkLane(-1));
    this.input.keyboard?.on('keydown-D', () => this.moveWorkLane(1));
    this.input.keyboard?.on('keydown-SPACE', () => this.handleWorkPress());
    this.input.keyboard?.on('keydown-ENTER', () => this.handleWorkPress());
    this.renderSnapshot();
  }

  setSnapshot(snapshot: CarpenterWorkshopSceneSnapshot, callbacks: CarpenterWorkshopSceneCallbacks) {
    const phaseChanged = this.snapshot?.phase !== snapshot.phase;
    this.snapshot = snapshot;
    this.callbacks = callbacks;
    if (this.sys.isActive()) {
      this.renderSnapshot(phaseChanged);
    }
  }

  update(_time: number, delta: number) {
    if (!this.workState || this.snapshot?.phase !== 'work') {
      return;
    }

    const workState = this.workState;
    const config = workState.snapshot.config;
    if (workState.resolved) {
      return;
    }

    workState.stepElapsedMs += delta;
    workState.cursorPosition += (delta / 1000) * config.cursorSpeed * workState.cursorDirection;
    if (workState.cursorPosition >= 1) {
      workState.cursorPosition = 1;
      workState.cursorDirection = -1;
    } else if (workState.cursorPosition <= 0) {
      workState.cursorPosition = 0;
      workState.cursorDirection = 1;
    }

    if (workState.stepElapsedMs >= config.stepDurationMs) {
      this.applyWorkResolution(false, 'timeout');
    }

    this.redrawWorkState();
  }

  private renderSnapshot(phaseChanged = false) {
    this.children.removeAll(true);
    this.clickTargets = [];
    this.workTexts = [];
    this.workGraphics = undefined;
    if (!this.snapshot || !this.callbacks) {
      return;
    }

    if (this.snapshot.phase !== 'work') {
      this.workState = null;
    }

    this.drawBackground();
    if (this.snapshot.phase === 'prep') {
      this.drawPrepSnapshot(this.snapshot);
      return;
    }
    if (this.snapshot.phase === 'result') {
      this.drawResultSnapshot(this.snapshot);
      return;
    }

    this.drawWorkSnapshot(this.snapshot, phaseChanged);
  }

  private drawBackground() {
    this.add.rectangle(
      CARPENTER_WORKSHOP_GAME_WIDTH / 2,
      CARPENTER_WORKSHOP_GAME_HEIGHT / 2,
      CARPENTER_WORKSHOP_GAME_WIDTH,
      CARPENTER_WORKSHOP_GAME_HEIGHT,
      CARPENTER_WORKSHOP_GAME_COLORS.background,
    ).setOrigin(0.5);
    this.add.rectangle(
      CARPENTER_WORKSHOP_GAME_WIDTH / 2,
      CARPENTER_WORKSHOP_GAME_HEIGHT / 2,
      CARPENTER_WORKSHOP_GAME_WIDTH - 24,
      CARPENTER_WORKSHOP_GAME_HEIGHT - 24,
      CARPENTER_WORKSHOP_GAME_COLORS.panel,
      0.92,
    ).setStrokeStyle(2, CARPENTER_WORKSHOP_GAME_COLORS.border, 0.9);
  }

  private drawPrepSnapshot(snapshot: CarpenterWorkshopPrepSnapshot) {
    const header = this.add.text(40, 28, `Мастерская плотника — ${snapshot.workshopName}`, this.textStyle(28, true));
    header.setWordWrapWidth(CARPENTER_WORKSHOP_GAME_WIDTH - 80);
    this.add.text(40, 70, `Станок: ${snapshot.stationLabel}`, this.textStyle(14));
    if (snapshot.statusText) {
      this.add.text(40, 96, snapshot.statusText, this.textStyle(13, false, CARPENTER_WORKSHOP_GAME_COLORS.success));
    }

    const selectedIndex = Math.max(0, snapshot.templateOptions.findIndex((entry) => entry.template.id === snapshot.selectedTemplateId));
    const selectedTemplateOption = snapshot.templateOptions[selectedIndex] ?? null;
    const selectedTemplate = selectedTemplateOption?.template ?? null;

    this.add.text(40, 138, 'Шаблон', this.textStyle(20, true));
    this.drawButton(40, 170, 54, 42, '←', this.callbacks!.onPrevTemplate, snapshot.templateOptions.length <= 1);
    this.drawButton(CARPENTER_WORKSHOP_GAME_WIDTH - 94, 170, 54, 42, '→', this.callbacks!.onNextTemplate, snapshot.templateOptions.length <= 1);
    this.add.rectangle(CARPENTER_WORKSHOP_GAME_WIDTH / 2, 192, CARPENTER_WORKSHOP_GAME_WIDTH - 220, 86, CARPENTER_WORKSHOP_GAME_COLORS.panelAlt, 0.92)
      .setStrokeStyle(1, CARPENTER_WORKSHOP_GAME_COLORS.border, 0.8);
    this.add.text(120, 162, selectedTemplate?.name ?? 'Нет доступных шаблонов', this.textStyle(21, true));
    this.add.text(120, 192, `${selectedIndex + 1}/${Math.max(1, snapshot.templateOptions.length)} · ${snapshot.selectedTemplateStation ?? '—'} · ${snapshot.selectedTemplateGroup ?? '—'}`, this.textStyle(13));
    this.add.text(120, 214, snapshot.selectedTemplateDescription ?? 'Описание шаблона не задано.', this.textStyle(13))
      .setWordWrapWidth(CARPENTER_WORKSHOP_GAME_WIDTH - 260);
    if (selectedTemplateOption?.lockedReason) {
      this.add.text(120, 236, `Заблокировано: ${selectedTemplateOption.lockedReason}`, this.textStyle(13, false, CARPENTER_WORKSHOP_GAME_COLORS.danger))
        .setWordWrapWidth(CARPENTER_WORKSHOP_GAME_WIDTH - 260);
    }

    let top = 288;
    this.add.text(40, top, 'Материалы', this.textStyle(20, true));
    top += 34;
    if (snapshot.materialSlots.length === 0) {
      this.add.text(40, top, 'У выбранного шаблона нет входных слотов.', this.textStyle(14));
      top += 36;
    } else {
      for (const slot of snapshot.materialSlots) {
        this.add.rectangle(CARPENTER_WORKSHOP_GAME_WIDTH / 2, top + 28, CARPENTER_WORKSHOP_GAME_WIDTH - 80, 58, CARPENTER_WORKSHOP_GAME_COLORS.panelAlt, 0.92)
          .setStrokeStyle(1, CARPENTER_WORKSHOP_GAME_COLORS.border, 0.75);
        this.drawButton(54, top + 7, 40, 42, '←', () => this.callbacks?.onCycleMaterial(slot.slotId, -1), slot.options.length <= 1);
        this.drawButton(CARPENTER_WORKSHOP_GAME_WIDTH - 94, top + 7, 40, 42, '→', () => this.callbacks?.onCycleMaterial(slot.slotId, 1), slot.options.length <= 1);
        const selectedOption = slot.options.find((entry) => entry.itemId === slot.selectedItemId) ?? slot.options[0] ?? null;
        this.add.text(110, top + 4, `${slot.label} ×${slot.quantity}`, this.textStyle(17, true));
        this.add.text(110, top + 28, selectedOption ? `${selectedOption.label} · ${selectedOption.componentKind} · ${selectedOption.quantity} шт.` : 'Подходящего материала нет.', this.textStyle(13, false, selectedOption ? CARPENTER_WORKSHOP_GAME_COLORS.text : CARPENTER_WORKSHOP_GAME_COLORS.danger))
          .setWordWrapWidth(CARPENTER_WORKSHOP_GAME_WIDTH - 220);
        top += 74;
      }
    }

    this.add.text(40, top, 'Инструмент', this.textStyle(20, true));
    top += 34;
    this.add.rectangle(CARPENTER_WORKSHOP_GAME_WIDTH / 2, top + 28, CARPENTER_WORKSHOP_GAME_WIDTH - 80, 58, CARPENTER_WORKSHOP_GAME_COLORS.panelAlt, 0.92)
      .setStrokeStyle(1, CARPENTER_WORKSHOP_GAME_COLORS.border, 0.75);
    this.drawButton(54, top + 7, 40, 42, '←', () => this.callbacks?.onCycleTool(-1), snapshot.toolOptions.length <= 1);
    this.drawButton(CARPENTER_WORKSHOP_GAME_WIDTH - 94, top + 7, 40, 42, '→', () => this.callbacks?.onCycleTool(1), snapshot.toolOptions.length <= 1);
    const selectedTool = snapshot.toolOptions.find((entry) => entry.inventoryItemId === snapshot.selectedToolItemId) ?? snapshot.toolOptions[0] ?? null;
    this.add.text(110, top + 6, selectedTool?.name ?? 'Нет инструмента плотника', this.textStyle(17, true));
    this.add.text(
      110,
      top + 30,
      selectedTool
        ? `${selectedTool.toolKind} · tier ${selectedTool.tier} · прочность ${selectedTool.durability}/${selectedTool.maxDurability}`
        : 'Для старта нужен совместимый инструмент плотника.',
      this.textStyle(13, false, selectedTool ? CARPENTER_WORKSHOP_GAME_COLORS.text : CARPENTER_WORKSHOP_GAME_COLORS.danger),
    ).setWordWrapWidth(CARPENTER_WORKSHOP_GAME_WIDTH - 220);
    top += 84;

    this.add.text(40, top, 'Риск', this.textStyle(20, true));
    top += 36;
    this.drawRiskButton(40, top, 'steady', 'Осторожно', snapshot.selectedRiskLevel);
    this.drawRiskButton(264, top, 'balanced', 'Ровно', snapshot.selectedRiskLevel);
    this.drawRiskButton(488, top, 'reckless', 'Рискованно', snapshot.selectedRiskLevel);
    top += 72;

    if (snapshot.previewText) {
      this.add.text(40, top, snapshot.previewText, this.textStyle(13)).setWordWrapWidth(CARPENTER_WORKSHOP_GAME_WIDTH - 80);
      top += 48;
    }
    if (snapshot.accessReason) {
      this.add.text(40, top, snapshot.accessReason, this.textStyle(13, false, CARPENTER_WORKSHOP_GAME_COLORS.danger)).setWordWrapWidth(CARPENTER_WORKSHOP_GAME_WIDTH - 80);
      top += 44;
    }

    this.drawButton(40, CARPENTER_WORKSHOP_GAME_HEIGHT - 72, 220, 42, 'Начать обработку', this.callbacks!.onStartWork, Boolean(snapshot.accessReason || !selectedTemplate), true);
    this.drawButton(CARPENTER_WORKSHOP_GAME_WIDTH - 260, CARPENTER_WORKSHOP_GAME_HEIGHT - 72, 220, 42, 'Закрыть', this.callbacks!.onClose, false);
  }

  private drawWorkSnapshot(snapshot: CarpenterWorkshopWorkSnapshot, phaseChanged: boolean) {
    if (!this.workState || phaseChanged) {
      this.workState = this.createInitialWorkState(snapshot);
    } else {
      this.workState.snapshot = snapshot;
    }
    this.workGraphics = this.add.graphics();
    this.redrawWorkState();
  }

  private drawResultSnapshot(snapshot: CarpenterWorkshopResultSnapshot) {
    this.add.text(40, 34, 'Итог работы', this.textStyle(30, true));
    const accentColor = snapshot.result.success ? CARPENTER_WORKSHOP_GAME_COLORS.success : CARPENTER_WORKSHOP_GAME_COLORS.danger;
    this.add.text(40, 92, snapshot.result.success ? 'Работа завершена успешно.' : 'Работа сорвалась.', this.textStyle(20, true, accentColor));
    this.add.text(40, 132, `${snapshot.result.templateName} · ${snapshot.result.stationType}`, this.textStyle(15));
    this.add.text(40, 168, `Качество: ${snapshot.result.qualityScore}/100`, this.textStyle(17, true));
    this.add.text(40, 204, snapshot.result.success
      ? `Создано: ${snapshot.result.createdItemName ?? snapshot.result.createdItemId ?? 'предмет'}`
      : `Материал потерян${snapshot.result.reason ? ` · ${snapshot.result.reason}` : ''}.`, this.textStyle(15))
      .setWordWrapWidth(CARPENTER_WORKSHOP_GAME_WIDTH - 80);
    if (snapshot.statusText) {
      this.add.text(40, 250, snapshot.statusText, this.textStyle(13)).setWordWrapWidth(CARPENTER_WORKSHOP_GAME_WIDTH - 80);
    }
    this.drawButton(40, CARPENTER_WORKSHOP_GAME_HEIGHT - 72, 220, 42, 'Ещё раз', this.callbacks!.onRetry, false, true);
    this.drawButton(CARPENTER_WORKSHOP_GAME_WIDTH - 260, CARPENTER_WORKSHOP_GAME_HEIGHT - 72, 220, 42, 'Закрыть', this.callbacks!.onClose, false);
  }

  private createInitialWorkState(snapshot: CarpenterWorkshopWorkSnapshot): InternalWorkState {
    return {
      snapshot,
      cursorPosition: 0.05,
      cursorDirection: 1,
      stepElapsedMs: 0,
      stepIndex: 0,
      completedSteps: 0,
      mistakes: 0,
      combo: 0,
      maxCombo: 0,
      integrity: snapshot.config.integrityStart,
      targetCenter: Phaser.Math.FloatBetween(0.2, 0.8),
      targetLane: Phaser.Math.Between(0, snapshot.config.laneCount - 1),
      selectedLane: Math.floor(snapshot.config.laneCount / 2),
      resolved: false,
      statusText: snapshot.config.instruction,
    };
  }

  private redrawWorkState() {
    if (!this.workGraphics || !this.workState) {
      return;
    }

    const g = this.workGraphics;
    const workState = this.workState;
    const config = workState.snapshot.config;
    g.clear();

    this.workTexts.forEach((entry) => entry.destroy());
    this.workTexts = [];

    this.pushWorkText(this.add.text(40, 34, config.stageTitle, this.textStyle(30, true)));
    this.pushWorkText(this.add.text(40, 72, `${config.templateName} · ${config.stationType}`, this.textStyle(14)));
    this.pushWorkText(this.add.text(40, 98, workState.statusText, this.textStyle(14)).setWordWrapWidth(CARPENTER_WORKSHOP_GAME_WIDTH - 80));

    const info = [
      `Шаг ${Math.min(config.totalSteps, workState.stepIndex + 1)}/${config.totalSteps}`,
      `Удач: ${workState.completedSteps}`,
      `Ошибок: ${workState.mistakes}/${config.maxMistakes}`,
      `Комбо: ${workState.combo} · макс ${workState.maxCombo}`,
      `Целостность: ${workState.integrity}`,
    ];
    info.forEach((line, index) => this.pushWorkText(this.add.text(40 + index * 168, 146, line, this.textStyle(13))));

    const trackLeft = 120;
    const trackWidth = CARPENTER_WORKSHOP_GAME_WIDTH - 240;
    const laneTop = 248;
    const laneGap = 94;
    const laneHeight = 56;

    for (let lane = 0; lane < config.laneCount; lane += 1) {
      const y = laneTop + lane * laneGap;
      g.fillStyle(CARPENTER_WORKSHOP_GAME_COLORS.track, 1);
      g.fillRoundedRect(trackLeft, y, trackWidth, laneHeight, 18);
      g.lineStyle(1, CARPENTER_WORKSHOP_GAME_COLORS.border, 0.7);
      g.strokeRoundedRect(trackLeft, y, trackWidth, laneHeight, 18);

      if (lane === workState.targetLane) {
        const targetX = trackLeft + workState.targetCenter * trackWidth;
        const targetWidth = Math.max(44, config.targetWidth * trackWidth);
        g.fillStyle(CARPENTER_WORKSHOP_GAME_COLORS.target, 0.95);
        g.fillRoundedRect(targetX - targetWidth / 2, y + 8, targetWidth, laneHeight - 16, 14);
      }

      if (lane === workState.selectedLane) {
        g.lineStyle(3, CARPENTER_WORKSHOP_GAME_COLORS.accent, 1);
        g.strokeRoundedRect(trackLeft - 8, y - 8, trackWidth + 16, laneHeight + 16, 20);
      }
    }

    const cursorX = trackLeft + workState.cursorPosition * trackWidth;
    const cursorY = laneTop + workState.selectedLane * laneGap + laneHeight / 2;
    g.fillStyle(CARPENTER_WORKSHOP_GAME_COLORS.trackFill, 1);
    g.fillCircle(cursorX, cursorY, 14);
    g.lineStyle(2, CARPENTER_WORKSHOP_GAME_COLORS.border, 1);
    g.strokeCircle(cursorX, cursorY, 14);

    const progressRatio = config.totalSteps > 0 ? workState.stepIndex / config.totalSteps : 0;
    g.fillStyle(CARPENTER_WORKSHOP_GAME_COLORS.accentDim, 1);
    g.fillRoundedRect(120, 610, trackWidth, 20, 10);
    g.fillStyle(CARPENTER_WORKSHOP_GAME_COLORS.trackFill, 1);
    g.fillRoundedRect(120, 610, Math.max(6, trackWidth * progressRatio), 20, 10);
    this.pushWorkText(this.add.text(120, 584, 'Прогресс', this.textStyle(13)));
  }

  private pushWorkText(text: Phaser.GameObjects.Text) {
    this.workTexts.push(text);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (this.snapshot?.phase === 'work') {
      this.handleWorkPress();
      return;
    }

    for (let index = this.clickTargets.length - 1; index >= 0; index -= 1) {
      const target = this.clickTargets[index]!;
      const inside = pointer.x >= target.x
        && pointer.x <= target.x + target.width
        && pointer.y >= target.y
        && pointer.y <= target.y + target.height;
      if (inside) {
        target.onClick();
        return;
      }
    }
  }

  private moveWorkLane(delta: -1 | 1) {
    if (!this.workState || this.workState.resolved) {
      return;
    }
    const laneCount = this.workState.snapshot.config.laneCount;
    this.workState.selectedLane = Phaser.Math.Clamp(this.workState.selectedLane + delta, 0, laneCount - 1);
    this.redrawWorkState();
  }

  private handleWorkPress() {
    if (!this.workState || !this.callbacks || this.workState.resolved) {
      return;
    }
    const config = this.workState.snapshot.config;
    const windowHalf = config.targetWidth / 2;
    const dist = Math.abs(this.workState.cursorPosition - this.workState.targetCenter);
    const laneMatched = this.workState.selectedLane === this.workState.targetLane;
    const success = laneMatched && dist <= windowHalf;
    this.applyWorkResolution(success, success ? undefined : 'mistakes');
  }

  private applyWorkResolution(success: boolean, failureReason?: CarpenterWorkshopStageResult['reason']) {
    if (!this.workState || this.workState.resolved) {
      return;
    }

    const config = this.workState.snapshot.config;
    if (success) {
      this.workState.completedSteps += 1;
      this.workState.combo += 1;
      this.workState.maxCombo = Math.max(this.workState.maxCombo, this.workState.combo);
      this.workState.integrity = Math.min(config.integrityStart, this.workState.integrity + 2);
      this.workState.statusText = this.workState.combo >= 3 ? 'Чистая серия.' : 'Точный приём.';
    } else {
      this.workState.mistakes += 1;
      this.workState.combo = 0;
      this.workState.integrity = Math.max(0, this.workState.integrity - (10 + config.baseRisk));
      this.workState.statusText = failureReason === 'timeout'
        ? 'Слишком медленно — заготовка ушла.'
        : 'Срыв движения — пошла трещина.';
    }

    this.workState.stepIndex += 1;
    this.workState.stepElapsedMs = 0;

    const workFailed = this.workState.integrity <= 0 || this.workState.mistakes > config.maxMistakes;
    const attemptsFinished = this.workState.stepIndex >= config.totalSteps;
    if (workFailed || attemptsFinished) {
      this.workState.resolved = true;
      const rawResult: CarpenterWorkshopStageResult = {
        success: !workFailed && this.workState.completedSteps >= Math.ceil(config.totalSteps * 0.55),
        qualityScore: 0,
        mistakes: this.workState.mistakes,
        completedSteps: this.workState.completedSteps,
        totalSteps: config.totalSteps,
        maxCombo: this.workState.maxCombo,
        integrityLeft: this.workState.integrity,
        reason: workFailed
          ? (this.workState.integrity <= 0 ? 'integrity' : 'mistakes')
          : failureReason,
      };
      rawResult.qualityScore = resolveCarpenterWorkshopQualityScore({
        config,
        result: rawResult,
      });
      this.callbacks?.onWorkFinished(rawResult);
      return;
    }

    this.workState.targetCenter = Phaser.Math.FloatBetween(0.18, 0.82);
    this.workState.targetLane = Phaser.Math.Between(0, config.laneCount - 1);
    this.redrawWorkState();
  }

  private drawButton(x: number, y: number, width: number, height: number, label: string, onClick: () => void, disabled = false, accent = false) {
    const bg = disabled
      ? CARPENTER_WORKSHOP_GAME_COLORS.accentDim
      : accent
        ? CARPENTER_WORKSHOP_GAME_COLORS.accent
        : CARPENTER_WORKSHOP_GAME_COLORS.panelAlt;
    this.add.rectangle(x + width / 2, y + height / 2, width, height, bg, disabled ? 0.55 : 0.95)
      .setStrokeStyle(1, CARPENTER_WORKSHOP_GAME_COLORS.border, 0.9);
    this.add.text(x + width / 2, y + height / 2, label, this.textStyle(14, true, disabled ? CARPENTER_WORKSHOP_GAME_COLORS.muted : CARPENTER_WORKSHOP_GAME_COLORS.text))
      .setOrigin(0.5);
    if (!disabled) {
      this.clickTargets.push({ x, y, width, height, onClick });
    }
  }

  private drawRiskButton(x: number, y: number, risk: CarpenterWorkshopRiskLevel, label: string, activeRisk: CarpenterWorkshopRiskLevel) {
    const active = risk === activeRisk;
    this.drawButton(x, y, 184, 42, label, () => this.callbacks?.onSelectRisk(risk), false, active);
  }

  private textStyle(size: number, bold = false, color = CARPENTER_WORKSHOP_GAME_COLORS.text) {
    return {
      fontFamily: 'Georgia, serif',
      fontSize: `${size}px`,
      color,
      fontStyle: bold ? 'bold' : 'normal',
    } as Phaser.Types.GameObjects.Text.TextStyle;
  }
}
