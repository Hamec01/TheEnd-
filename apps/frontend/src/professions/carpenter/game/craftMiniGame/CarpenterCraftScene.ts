import Phaser from 'phaser';
import type { CarpenterGameInput, CarpenterGameResult, PassStats, SceneCallbacks } from './carpenterGameTypes';
import {
  gradeHit,
  getPressureZone,
  getTimingZone,
  computeHitEffects,
  computeGrade,
  computeTraitRetention,
  getMarkerSpeed,
  clamp,
  RISK_CONFIGS,
  HITS_PER_PASS,
  PASS_DURATION_MS,
} from './carpenterGameBalance';
import {
  COLORS,
  makeTextStyle,
  drawStatBar,
  drawPanel,
  flashText,
  spawnSparks,
  spawnCrackFlash,
  spawnWoodShaving,
} from './carpenterGameUi';
import { getWoodColor, getIntegrityColor, getProgressColor } from './carpenterGameAssets';

export const SCENE_KEY = 'CarpenterCraftScene';

export class CarpenterCraftScene extends Phaser.Scene {
  private config!: CarpenterGameInput;
  private callbacks!: SceneCallbacks;

  private qualityScore = 0;
  private integrityRemaining = 100;
  private progress = 0;
  private masteryChance = 0;
  private totalMistakes = 0;
  private totalPerfect = 0;
  private totalGood = 0;
  private totalBad = 0;
  private currentPass = 0;
  private broken = false;
  private gameActive = false;
  private passActive = false;

  private markerPos = 0.5;
  private markerDir = 1;
  private pressure = 0;
  private isPressing = false;
  private externalActionDown = false;

  private hitsThisPass = 0;
  private passTimeElapsed = 0;
  private passEnding = false;

  private bgGfx!: Phaser.GameObjects.Graphics;
  private woodGfx!: Phaser.GameObjects.Graphics;
  private timingBarGfx!: Phaser.GameObjects.Graphics;
  private pressureGfx!: Phaser.GameObjects.Graphics;
  private statsGfx!: Phaser.GameObjects.Graphics;
  private particleLayer!: Phaser.GameObjects.Container;

  private txtPassNum!: Phaser.GameObjects.Text;
  private txtQuality!: Phaser.GameObjects.Text;
  private txtIntegrity!: Phaser.GameObjects.Text;
  private txtProgress!: Phaser.GameObjects.Text;
  private txtMastery!: Phaser.GameObjects.Text;
  private txtMistakes!: Phaser.GameObjects.Text;
  private txtPressureLabel!: Phaser.GameObjects.Text;
  private txtTimingHint!: Phaser.GameObjects.Text;
  private txtTemplate!: Phaser.GameObjects.Text;
  private txtMaterial!: Phaser.GameObjects.Text;
  private txtTool!: Phaser.GameObjects.Text;
  private txtRisk!: Phaser.GameObjects.Text;
  private txtHitFeedback!: Phaser.GameObjects.Text;

  private spaceKey!: Phaser.Input.Keyboard.Key;

  readonly BAR_W = 740;
  readonly BAR_H = 38;
  readonly BAR_X = 640 - 370;
  readonly BAR_Y = 640;

  readonly PRESS_W = 28;
  readonly PRESS_H = 220;
  readonly PRESS_X = 1080;
  readonly PRESS_Y = 300;

  readonly WOOD_X = 640;
  readonly WOOD_Y = 340;

  constructor() {
    super({ key: SCENE_KEY });
  }

  init(data: { config: CarpenterGameInput; callbacks: SceneCallbacks }) {
    this.config = data.config;
    this.callbacks = data.callbacks;
    this.qualityScore = 0;
    this.integrityRemaining = 100;
    this.progress = 0;
    this.masteryChance = 0;
    this.totalMistakes = 0;
    this.totalPerfect = 0;
    this.totalGood = 0;
    this.totalBad = 0;
    this.currentPass = 0;
    this.broken = false;
    this.gameActive = false;
    this.passActive = false;
    this.markerPos = 0.5;
    this.markerDir = 1;
    this.pressure = 0;
    this.isPressing = false;
    this.externalActionDown = false;
    this.hitsThisPass = 0;
    this.passTimeElapsed = 0;
    this.passEnding = false;
  }

  preload() {
  }

  create() {
    this.particleLayer = this.add.container(0, 0);

    this.bgGfx = this.add.graphics();
    this.drawBackground();

    this.woodGfx = this.add.graphics();
    this.drawWoodBlank();

    this.timingBarGfx = this.add.graphics();
    this.drawTimingBar();

    this.pressureGfx = this.add.graphics();
    this.drawPressureMeter();

    this.statsGfx = this.add.graphics();
    this.drawStatsPanel();

    this.createTexts();

    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on('down', () => {
        this.cancelGame();
      });
    }

    this.input.on('pointerdown', () => { this.isPressing = true; });
    this.input.on('pointerup', () => {
      if (this.isPressing) {
        this.isPressing = false;
        this.scoreHit();
      }
    });

    this.gameActive = true;
    this.startPass();
  }

  private drawBackground() {
    const gfx = this.bgGfx;
    gfx.clear();

    gfx.fillGradientStyle(0x1a0e06, 0x1a0e06, 0x0d0804, 0x0d0804, 1);
    gfx.fillRect(0, 0, 1280, 720);

    gfx.fillStyle(0x2c1a0c, 0.6);
    gfx.fillRect(0, 480, 1280, 240);

    for (let i = 0; i < 12; i++) {
      const x = (i * 130) % 1280;
      const y = 490 + (i % 3) * 25;
      gfx.fillStyle(0x3d2510, 0.4);
      gfx.fillRect(x, y, 120, 8);
    }

    gfx.fillStyle(0x4a2c14, 0.5);
    gfx.fillRect(220, 290, 840, 180);
    gfx.fillStyle(0x5c3a1c, 0.4);
    gfx.fillRect(240, 300, 800, 160);

    gfx.lineStyle(2, 0x7a4a22, 0.5);
    gfx.strokeRect(240, 300, 800, 160);
  }

  private drawWoodBlank() {
    const gfx = this.woodGfx;
    gfx.clear();

    const color = getWoodColor(this.qualityScore, this.broken);
    const cx = this.WOOD_X;
    const cy = this.WOOD_Y;

    if (this.broken) {
      gfx.fillStyle(0x2a1005, 0.9);
      gfx.fillRoundedRect(cx - 60, cy - 100, 120, 200, 8);
      gfx.lineStyle(2, 0x8b0000, 0.8);
      gfx.strokeRoundedRect(cx - 60, cy - 100, 120, 200, 8);
      gfx.lineStyle(2, 0x5a0a0a, 1);
      for (let i = 0; i < 5; i++) {
        gfx.beginPath();
        const sx = cx - 40 + i * 20;
        gfx.moveTo(sx, cy - 80);
        gfx.lineTo(sx + (Math.random() - 0.5) * 20, cy + 80);
        gfx.strokePath();
      }
      return;
    }

    const grainColor = Phaser.Display.Color.IntegerToColor(color);
    grainColor.lighten(8);

    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(cx - 55, cy - 110, 110, 220, 10);

    const lighter = Phaser.Display.Color.IntegerToColor(color);
    lighter.lighten(15);
    gfx.lineStyle(1, lighter.color, 0.4);
    for (let i = 0; i < 6; i++) {
      gfx.beginPath();
      gfx.moveTo(cx - 45, cy - 90 + i * 34);
      gfx.lineTo(cx + 45, cy - 90 + i * 34);
      gfx.strokePath();
    }

    const borderColor = Phaser.Display.Color.IntegerToColor(color);
    borderColor.darken(20);
    gfx.lineStyle(2, borderColor.color, 1);
    gfx.strokeRoundedRect(cx - 55, cy - 110, 110, 220, 10);

    if (this.qualityScore >= 60) {
      gfx.lineStyle(1.5, COLORS.gold, 0.4);
      gfx.strokeRoundedRect(cx - 57, cy - 112, 114, 224, 11);
    }
  }

  private getZoneBoundaries(): { goldL: number; goldR: number; greenL: number; greenR: number; yellowL: number; yellowR: number } {
    const cfg = RISK_CONFIGS[this.config.riskLevel];
    const c = 0.5;
    const hg = cfg.goldZoneWidth / 2;
    const hGr = hg + cfg.greenZoneWidth / 2;
    const hY = hGr + cfg.yellowZoneWidth / 2;
    return {
      goldL: c - hg,
      goldR: c + hg,
      greenL: c - hGr,
      greenR: c + hGr,
      yellowL: c - hY,
      yellowR: c + hY,
    };
  }

  private drawTimingBar() {
    const gfx = this.timingBarGfx;
    gfx.clear();

    const { BAR_X, BAR_Y, BAR_W, BAR_H } = this;
    const z = this.getZoneBoundaries();

    drawPanel(gfx, BAR_X - 10, BAR_Y - 20, BAR_W + 20, BAR_H + 40, 0.85);

    gfx.fillStyle(COLORS.red, 1);
    gfx.fillRoundedRect(BAR_X, BAR_Y, BAR_W, BAR_H, 4);

    const fillZone = (normL: number, normR: number, color: number) => {
      gfx.fillStyle(color, 1);
      gfx.fillRect(BAR_X + normL * BAR_W, BAR_Y, (normR - normL) * BAR_W, BAR_H);
    };

    fillZone(z.yellowL, z.yellowR, COLORS.yellow);
    fillZone(z.greenL, z.greenR, COLORS.green);
    fillZone(z.goldL, z.goldR, COLORS.gold);

    gfx.lineStyle(1.5, COLORS.panelBorder, 1);
    gfx.strokeRoundedRect(BAR_X, BAR_Y, BAR_W, BAR_H, 4);

    const markerX = BAR_X + this.markerPos * BAR_W;
    gfx.fillStyle(COLORS.markerColor, 1);
    gfx.fillRect(markerX - 3, BAR_Y - 6, 6, BAR_H + 12);
    gfx.fillTriangle(markerX, BAR_Y - 10, markerX - 7, BAR_Y - 18, markerX + 7, BAR_Y - 18);
  }

  private drawPressureMeter() {
    const gfx = this.pressureGfx;
    gfx.clear();

    const { PRESS_X, PRESS_Y, PRESS_W, PRESS_H } = this;

    drawPanel(gfx, PRESS_X - 14, PRESS_Y - 14, PRESS_W + 28, PRESS_H + 70, 0.88);

    const zone = getPressureZone(this.pressure);
    const fillColor = zone === 'low' ? COLORS.pressureLow
      : zone === 'ideal' ? COLORS.pressureIdeal
      : zone === 'high' ? COLORS.pressureHigh
      : COLORS.pressureOver;

    gfx.fillStyle(0x080504, 1);
    gfx.fillRoundedRect(PRESS_X, PRESS_Y, PRESS_W, PRESS_H, 3);

    const fillH = (this.pressure / 100) * PRESS_H;
    gfx.fillStyle(fillColor, 1);
    gfx.fillRoundedRect(PRESS_X + 1, PRESS_Y + PRESS_H - fillH + 1, PRESS_W - 2, fillH - 2, 2);

    const idealTop = PRESS_Y + PRESS_H * (1 - 0.65);
    const idealBot = PRESS_Y + PRESS_H * (1 - 0.22);
    gfx.lineStyle(1, 0x4cde68, 0.5);
    gfx.strokeRect(PRESS_X, idealTop, PRESS_W, idealBot - idealTop);

    gfx.lineStyle(1.5, COLORS.panelBorder, 1);
    gfx.strokeRoundedRect(PRESS_X, PRESS_Y, PRESS_W, PRESS_H, 3);
  }

  private drawStatsPanel() {
    const gfx = this.statsGfx;
    gfx.clear();

    const sx = 940;
    const sy = 80;
    const sw = 260;
    drawPanel(gfx, sx, sy, sw, 480, 0.9);

    const barX = sx + 10;
    const barW = sw - 20;
    const barH = 14;

    drawStatBar(gfx, barX, sy + 105, barW, barH, this.qualityScore, 100, 0xffe066);
    drawStatBar(gfx, barX, sy + 175, barW, barH, this.integrityRemaining, 100, getIntegrityColor(this.integrityRemaining));
    drawStatBar(gfx, barX, sy + 245, barW, barH, this.progress, 100, getProgressColor(this.progress));
    drawStatBar(gfx, barX, sy + 315, barW, barH, this.masteryChance, 100, 0xc8a0f0);
  }

  private createTexts() {
    const infoY = 24;
    this.txtTemplate = this.add.text(20, infoY, `Предмет: ${this.config.templateName}`, makeTextStyle(16)).setAlpha(0.9);
    this.txtMaterial = this.add.text(20, infoY + 22, `Материал: ${this.config.materialName}`, makeTextStyle(14, '#b09060')).setAlpha(0.85);
    this.txtTool = this.add.text(20, infoY + 42, `Инструмент: ${this.config.toolName}`, makeTextStyle(14, '#b09060')).setAlpha(0.85);

    const riskColors: Record<string, string> = { safe: '#4cde68', normal: '#f5c842', bold: '#f09030', dangerous: '#e05020', insane: '#e03030' };
    this.txtRisk = this.add.text(20, infoY + 62, `Риск: ${this.config.riskLevel.toUpperCase()}`, makeTextStyle(14, riskColors[this.config.riskLevel] ?? '#ffffff', true));

    const sx = 950;
    const sy = 80;
    this.add.text(sx + 10, sy + 12, 'СТАТЫ', makeTextStyle(15, '#c08040', true));

    this.add.text(sx + 10, sy + 70, 'Качество', makeTextStyle(13, '#b09060'));
    this.txtQuality = this.add.text(sx + 240, sy + 70, '0', makeTextStyle(13, '#ffe066')).setOrigin(1, 0);

    this.add.text(sx + 10, sy + 140, 'Целостность', makeTextStyle(13, '#b09060'));
    this.txtIntegrity = this.add.text(sx + 240, sy + 140, '100', makeTextStyle(13, '#4cde68')).setOrigin(1, 0);

    this.add.text(sx + 10, sy + 210, 'Прогресс', makeTextStyle(13, '#b09060'));
    this.txtProgress = this.add.text(sx + 240, sy + 210, '0', makeTextStyle(13, '#5abaff')).setOrigin(1, 0);

    this.add.text(sx + 10, sy + 280, 'Мастерство', makeTextStyle(13, '#b09060'));
    this.txtMastery = this.add.text(sx + 240, sy + 280, '0', makeTextStyle(13, '#c8a0f0')).setOrigin(1, 0);

    this.add.text(sx + 10, sy + 350, 'Ошибки', makeTextStyle(13, '#b09060'));
    this.txtMistakes = this.add.text(sx + 240, sy + 350, '0', makeTextStyle(13, '#e03030')).setOrigin(1, 0);

    this.txtPassNum = this.add.text(sx + 10, sy + 410, '', makeTextStyle(14, '#c08040', true));

    const pressX = this.PRESS_X + this.PRESS_W / 2;
    this.txtPressureLabel = this.add.text(pressX, this.PRESS_Y + this.PRESS_H + 15, 'ДАВЛЕНИЕ', makeTextStyle(11, '#b09060')).setOrigin(0.5, 0);

    this.txtTimingHint = this.add.text(640, this.BAR_Y + this.BAR_H + 16, 'Удержи [ПРОБЕЛ] → отпусти в нужный момент', makeTextStyle(13, '#9a7050')).setOrigin(0.5, 0);

    this.txtHitFeedback = this.add.text(this.WOOD_X, this.WOOD_Y - 130, '', makeTextStyle(20, '#ffffff', true)).setOrigin(0.5).setAlpha(0);
  }

  startPass() {
    this.currentPass++;
    this.hitsThisPass = 0;
    this.passTimeElapsed = 0;
    this.passEnding = false;
    this.passActive = true;
    this.pressure = 0;
    this.isPressing = false;
    this.externalActionDown = false;
  }

  setExternalActionDown(isDown: boolean): void {
    this.externalActionDown = isDown;
  }

  private scoreHit() {
    if (!this.passActive || this.passEnding || !this.gameActive) return;

    const timing = getTimingZone(this.markerPos, this.config.riskLevel);
    const pressZone = getPressureZone(this.pressure);
    const grade = gradeHit(timing, pressZone);
    const effects = computeHitEffects(grade, this.config.riskLevel, this.currentPass);

    this.qualityScore = clamp(this.qualityScore + effects.qualityGain, 0, 100);
    this.progress = clamp(this.progress + effects.progressGain, 0, 100);
    this.masteryChance = clamp(this.masteryChance + effects.masteryGain, 0, 100);
    this.integrityRemaining = clamp(this.integrityRemaining - effects.integrityLoss, 0, 100);

    if (effects.isMistake) {
      this.totalMistakes++;
      this.totalBad++;
    } else if (grade === 'perfect') {
      this.totalPerfect++;
    } else if (grade === 'good') {
      this.totalGood++;
    }

    this.hitsThisPass++;
    this.showHitFeedback(grade, timing);

    const cx = this.WOOD_X;
    const cy = this.WOOD_Y;

    if (grade === 'perfect') {
      spawnSparks(this, cx, cy, 10, COLORS.gold);
      spawnWoodShaving(this, cx, cy);
      spawnWoodShaving(this, cx, cy);
    } else if (grade === 'good') {
      spawnSparks(this, cx, cy, 5, 0x88ff88);
      spawnWoodShaving(this, cx, cy);
    } else if (grade === 'critical_bad') {
      spawnCrackFlash(this, cx, cy);
    } else if (grade === 'bad') {
      spawnSparks(this, cx, cy, 4, COLORS.red);
    } else {
      spawnWoodShaving(this, cx, cy);
    }

    this.drawWoodBlank();
    this.refreshStats();

    if (this.integrityRemaining <= 0) {
      this.broken = true;
      this.endPass(true);
      return;
    }

    if (this.hitsThisPass >= HITS_PER_PASS) {
      this.time.delayedCall(300, () => this.endPass(false));
    }
  }

  private showHitFeedback(grade: string, timing: string) {
    const labels: Record<string, string> = {
      perfect: '✦ ИДЕАЛЬНО!',
      good: '▲ Хорошо',
      normal: '● Нормально',
      bad: '▽ Ошибка',
      critical_bad: '✕ КРИТИЧНО',
    };
    const colors: Record<string, string> = {
      perfect: '#ffe066',
      good: '#4cde68',
      normal: '#d0d0d0',
      bad: '#e03030',
      critical_bad: '#ff1010',
    };

    const label = (labels[grade] ?? grade) + (timing ? ` [${timing}]` : '');
    flashText(this, this.WOOD_X, this.WOOD_Y - 140, label, colors[grade] ?? '#ffffff', 22);
  }

  private endPass(broken: boolean) {
    if (this.passEnding) return;
    this.passEnding = true;
    this.passActive = false;
    this.isPressing = false;
    this.externalActionDown = false;
    this.pressure = 0;

    const stats: PassStats = {
      passNumber: this.currentPass,
      hitsScored: this.hitsThisPass,
      perfectHits: this.totalPerfect,
      goodHits: this.totalGood,
      badHits: this.totalBad,
      qualityScore: Math.round(this.qualityScore),
      integrityRemaining: Math.round(this.integrityRemaining),
      progress: Math.round(this.progress),
      masteryChance: Math.round(this.masteryChance),
      mistakes: this.totalMistakes,
      broken,
    };

    this.time.delayedCall(400, () => {
      this.callbacks.onPassComplete(stats);
    });
  }

  continuePass() {
    if (this.broken) return;
    this.startPass();
  }

  finishEarly(): CarpenterGameResult {
    this.passActive = false;
    return this.buildResult('completed');
  }

  cancelGame(): void {
    if (!this.gameActive) return;
    this.passActive = false;
    this.gameActive = false;
    this.externalActionDown = false;
    const result = this.buildResult('cancelled');
    result.success = false;
    this.callbacks.onGameOver(result);
  }

  buildResult(reason: CarpenterGameResult['reason']): CarpenterGameResult {
    const grade = computeGrade(this.qualityScore, this.integrityRemaining, this.progress);
    const retention = computeTraitRetention(this.qualityScore, this.masteryChance, this.totalMistakes);
    const success = grade !== 'broken' && grade !== 'poor' && reason !== 'cancelled';

    return {
      success,
      reason,
      templateId: this.config.templateId,
      materialId: this.config.materialId,
      toolId: this.config.toolId,
      riskLevel: this.config.riskLevel,
      qualityScore: Math.round(this.qualityScore),
      integrityRemaining: Math.round(this.integrityRemaining),
      progress: Math.round(this.progress),
      masteryChance: Math.round(this.masteryChance),
      passesCompleted: this.currentPass,
      mistakes: this.totalMistakes,
      perfectHits: this.totalPerfect,
      goodHits: this.totalGood,
      badHits: this.totalBad,
      resultGrade: grade,
      traitRetentionPercent: Math.round(retention),
    };
  }

  private refreshStats() {
    this.txtQuality?.setText(String(Math.round(this.qualityScore)));
    this.txtIntegrity?.setText(String(Math.round(this.integrityRemaining)));
    this.txtProgress?.setText(String(Math.round(this.progress)));
    this.txtMastery?.setText(String(Math.round(this.masteryChance)));
    this.txtMistakes?.setText(String(this.totalMistakes));
    this.txtPassNum?.setText(`Проход: ${this.currentPass} / ${this.config.maxPasses ?? 5}`);
    this.drawStatsPanel();
  }

  update(_time: number, delta: number) {
    if (!this.gameActive) return;

    if (this.passActive && !this.passEnding) {
      this.passTimeElapsed += delta;

      const speed = getMarkerSpeed(this.config.riskLevel, this.currentPass, this.config.baseDifficulty);
      const dt = delta / 1000;
      this.markerPos += this.markerDir * speed * dt / this.BAR_W;

      if (this.markerPos >= 1) { this.markerPos = 1; this.markerDir = -1; }
      if (this.markerPos <= 0) { this.markerPos = 0; this.markerDir = 1; }

      const isPressingNow = this.externalActionDown || (this.spaceKey?.isDown) || this.input.activePointer.isDown;

      if (isPressingNow && !this.isPressing) {
        this.isPressing = true;
      } else if (!isPressingNow && this.isPressing) {
        this.isPressing = false;
        this.scoreHit();
      }

      if (isPressingNow) {
        this.pressure = clamp(this.pressure + 55 * dt, 0, 100);
      } else {
        this.pressure = clamp(this.pressure - 40 * dt, 0, 100);
      }

      if (this.passTimeElapsed >= PASS_DURATION_MS && !this.passEnding) {
        this.endPass(false);
      }
    }

    this.drawTimingBar();
    this.drawPressureMeter();
  }
}
