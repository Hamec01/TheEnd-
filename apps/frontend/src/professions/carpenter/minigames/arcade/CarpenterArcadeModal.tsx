import { useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";

export type CarpenterArcadeMode = "woodcutting" | "sawing";

export type WoodcuttingArcadeResultReason =
  | "cancelled"
  | "no_stamina"
  | "axe_broken"
  | "player_injured"
  | "tree_fall";

export type SawingArcadeResultReason =
  | "cancelled"
  | "no_stamina"
  | "saw_broken"
  | "overheated"
  | "player_injured";

export interface WoodcuttingArcadeResult {
  success: boolean;
  treeId: string;
  staminaSpent: number;
  hpDamage: number;
  durabilitySpent: number;
  treesFelled?: number;
  reason?: WoodcuttingArcadeResultReason;
}

export interface SawingArcadeResult {
  success: boolean;
  logItemId: string;
  recipeId: string;
  outputItemId: string;
  staminaSpent: number;
  hpDamage: number;
  durabilitySpent: number;
  reason?: SawingArcadeResultReason;
}

export interface WoodcuttingArcadeConfig {
  tree: {
    id: string;
    name: string;
    hp: number;
    hardness: number;
    stability: number;
    fallRisk: number;
  };
  player: {
    stamina: number;
    hp: number;
    carpenterLevel: number;
  };
  axe: {
    id: string;
    name: string;
    durability: number;
    maxDurability: number;
    efficiency: number;
    tier: number;
    staminaCostModifier?: number;
  } | null;
}

export interface SawingArcadeConfig {
  log: {
    id: string;
    name: string;
    woodType?: string;
    hardness?: number;
  };
  recipe: {
    id: string;
    name: string;
    outputItemId: string;
    staminaPerStroke: number;
  };
  player: {
    stamina: number;
    hp: number;
  };
  saw: {
    id: string;
    name: string;
    durability: number;
    maxDurability: number;
    efficiency: number;
    tier: number;
  } | null;
}

interface WoodcuttingSceneInit {
  config: WoodcuttingArcadeConfig;
  complete: (result: WoodcuttingArcadeResult) => void;
  fail: (result: WoodcuttingArcadeResult) => void;
}

interface SawingSceneInit {
  config: SawingArcadeConfig;
  complete: (result: SawingArcadeResult) => void;
  fail: (result: SawingArcadeResult) => void;
}

const GAME_WIDTH = 720;
const GAME_HEIGHT = 900;
const PARCHMENT = 0xe8d5a3;
const INK = 0x3d2b1f;
const INK_LIGHT = 0x6b4c3b;
const PARCHMENT_DARK = 0xc9a96e;
const TREE_X = GAME_WIDTH / 2;
const PLAYER_LEFT_X = TREE_X - 72;
const PLAYER_RIGHT_X = TREE_X + 72;
const GROUND_Y = GAME_HEIGHT - 100;
const PLAYER_Y = GROUND_Y - 20;
const TREE_BASE_Y = GROUND_Y;
let pendingWoodcuttingSceneInit: WoodcuttingSceneInit | null = null;
let pendingSawingSceneInit: SawingSceneInit | null = null;

class WoodcuttingScene extends Phaser.Scene {
  private initData: WoodcuttingSceneInit | null = null;
  private treeHp = 0;
  private treeStability = 100;
  private staminaLeft = 0;
  private hpLeft = 0;
  private durabilityLeft = 0;
  private staminaSpent = 0;
  private hpDamage = 0;
  private durabilitySpent = 0;
  private aimed = false;
  private steppedBack = false;

  private treeHpText?: Phaser.GameObjects.Text;
  private stabilityText?: Phaser.GameObjects.Text;
  private staminaText?: Phaser.GameObjects.Text;
  private hpText?: Phaser.GameObjects.Text;
  private durabilityText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "WoodcuttingScene" });
  }

  init(data: WoodcuttingSceneInit) {
    this.initData = data;
  }

  create() {
    if (!this.initData) {
      this.initData = pendingWoodcuttingSceneInit;
    }
    if (!this.initData) {
      this.drawBackdrop();
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Ошибка запуска рубки:\ninitData отсутствует", {
        color: "#6b1f1f",
        fontSize: "18px",
        fontFamily: "Georgia, serif",
        align: "center",
      }).setOrigin(0.5);
      return;
    }
    const { config } = this.initData;
    this.treeHp = Math.max(1, Math.floor(config.tree.hp));
    this.treeStability = Math.max(1, Math.floor(config.tree.stability || 100));
    this.staminaLeft = Math.max(0, Math.floor(config.player.stamina));
    this.hpLeft = Math.max(0, Math.floor(config.player.hp));
    this.durabilityLeft = Math.max(0, Math.floor(config.axe?.durability ?? 0));
    this.staminaSpent = 0;
    this.hpDamage = 0;
    this.durabilitySpent = 0;
    this.aimed = false;
    this.steppedBack = false;

    this.drawBackdrop();
    this.add.text(GAME_WIDTH / 2, 24, `\uD83E\uDE93 ${config.tree.name}`, {
      color: "#3d2b1f",
      fontSize: "26px",
      fontFamily: "Georgia, serif",
      fontStyle: "bold",
    }).setOrigin(0.5, 0);

    this.treeHpText = this.addTextLine(70, "");
    this.stabilityText = this.addTextLine(98, "");
    this.staminaText = this.addTextLine(126, "");
    this.hpText = this.addTextLine(154, "");
    this.durabilityText = this.addTextLine(182, "");
    this.statusText = this.add.text(GAME_WIDTH / 2, 220, "", {
      color: "#8b3a3a",
      fontSize: "18px",
      fontFamily: "Georgia, serif",
      fontStyle: "bold italic",
      align: "center",
    }).setOrigin(0.5, 0);

    this.addActionButton(50, 288, 380, 50, "\uD83E\uDE93 Ударить топором", () => this.strike());
    this.addActionButton(50, 350, 182, 50, "\uD83C\uDFAF Прицелиться", () => this.aim());
    this.addActionButton(248, 350, 182, 50, "\uD83D\uDEE1 Отойти назад", () => this.stepBack());
    this.addActionButton(50, 420, 380, 50, "\u274C Прервать", () => this.failRun("cancelled"));

    this.input.keyboard?.on("keydown-SPACE", () => this.strike());
    this.input.keyboard?.on("keydown-A", () => this.aim());
    this.input.keyboard?.on("keydown-S", () => this.stepBack());
    this.input.keyboard?.on("keydown-ESC", () => this.failRun("cancelled"));

    this.refreshHud();
  }

  private drawBackdrop() {
    const g = this.add.graphics();
    g.fillStyle(PARCHMENT);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.lineStyle(1, PARCHMENT_DARK, 0.35);
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      g.lineBetween(0, y, GAME_WIDTH, y);
    }
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      g.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    g.fillStyle(0xb8894a, 0.16);
    g.fillRect(0, 0, GAME_WIDTH, 32);
    g.fillRect(0, GAME_HEIGHT - 32, GAME_WIDTH, 32);
  }

  private addTextLine(y: number, text: string): Phaser.GameObjects.Text {
    return this.add.text(36, y, text, {
      color: "#5a4131",
      fontSize: "16px",
      fontFamily: "Georgia, serif",
    });
  }

  private addActionButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
  ) {
    const bg = this.add.rectangle(x + width / 2, y + height / 2, width, height, INK, 0.86).setStrokeStyle(2, PARCHMENT_DARK);
    const text = this.add.text(x + width / 2, y + height / 2, label, {
      color: "#f0ddb9",
      fontSize: "18px",
      fontFamily: "Georgia, serif",
      fontStyle: "bold",
    }).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    bg.on("pointerover", () => bg.setFillStyle(INK_LIGHT, 0.9));
    bg.on("pointerout", () => bg.setFillStyle(INK, 0.86));
    text.setDepth(1);
  }

  private refreshHud() {
    const config = this.initData?.config;
    if (!config) {
      return;
    }
    this.treeHpText?.setText(`Прочность дерева: ${Math.max(0, this.treeHp)} / ${Math.floor(config.tree.hp)}`);
    this.stabilityText?.setText(`Устойчивость: ${Math.max(0, this.treeStability)}% (риск падения ${Math.floor(config.tree.fallRisk)}%)`);
    this.staminaText?.setText(`Выносливость: ${Math.max(0, this.staminaLeft)} / ${Math.floor(config.player.stamina)}`);
    this.hpText?.setText(`HP игрока: ${Math.max(0, this.hpLeft)} / ${Math.floor(config.player.hp)}`);
    if (config.axe) {
      this.durabilityText?.setText(`Топор: ${Math.max(0, this.durabilityLeft)} / ${Math.floor(config.axe.maxDurability)} (${config.axe.name})`);
    } else {
      this.durabilityText?.setText("Топор: нет подходящего инструмента");
    }
  }

  private strike() {
    const config = this.initData?.config;
    if (!config || !this.initData) {
      return;
    }
    if (!config.axe) {
      this.statusText?.setText("Нет подходящего топора.");
      this.failRun("axe_broken");
      return;
    }

    const staminaCost = Math.max(1, Math.round(8 * (1 + (config.axe.staminaCostModifier ?? 0))));
    if (this.staminaLeft < staminaCost) {
      this.statusText?.setText("Недостаточно выносливости.");
      this.failRun("no_stamina");
      return;
    }
    if (this.durabilityLeft <= 0) {
      this.statusText?.setText("Топор сломан.");
      this.failRun("axe_broken");
      return;
    }

    const baseDamage = Math.max(1, Math.round(10 * (config.axe.efficiency || 1) + config.player.carpenterLevel - config.tree.hardness));
    let damage = baseDamage;
    let stabilityReduction = 5 + config.tree.fallRisk / 5;
    if (this.aimed) {
      damage = Math.max(1, Math.round(baseDamage * 2));
      stabilityReduction = 2;
      this.aimed = false;
    }
    if (this.steppedBack) {
      damage = Math.max(1, Math.round(damage * 0.5));
    }

    this.staminaLeft -= staminaCost;
    this.staminaSpent += staminaCost;
    this.durabilityLeft -= 1;
    this.durabilitySpent += 1;
    this.treeHp = Math.max(0, this.treeHp - damage);
    this.treeStability = Math.max(0, this.treeStability - stabilityReduction);

    if (this.treeHp <= 0) {
      this.initData.complete({
        success: true,
        treeId: config.tree.id,
        staminaSpent: this.staminaSpent,
        hpDamage: this.hpDamage,
        durabilitySpent: this.durabilitySpent,
      });
      return;
    }

    if (this.treeStability <= 0 && !this.steppedBack) {
      this.staminaLeft = Math.max(0, this.staminaLeft - 30);
      this.staminaSpent += 30;
      this.hpLeft = Math.max(0, this.hpLeft - 8);
      this.hpDamage += 8;
      this.refreshHud();
      this.statusText?.setText("Дерево рухнуло рядом. Вы пострадали.");
      this.failRun(this.hpLeft <= 0 ? "player_injured" : "tree_fall");
      return;
    }

    if (this.hpLeft <= 0) {
      this.failRun("player_injured");
      return;
    }

    this.statusText?.setText(this.aimed ? "Прицельный удар готовится." : "Рубка продолжается...");
    this.refreshHud();
  }

  private aim() {
    if (this.staminaLeft < 10) {
      this.statusText?.setText("Недостаточно выносливости для прицеливания.");
      this.failRun("no_stamina");
      return;
    }
    this.staminaLeft -= 10;
    this.staminaSpent += 10;
    this.aimed = true;
    this.statusText?.setText("Следующий удар будет усилен.");
    this.refreshHud();
  }

  private stepBack() {
    if (this.staminaLeft < 10) {
      this.statusText?.setText("Недостаточно выносливости.");
      this.failRun("no_stamina");
      return;
    }
    this.staminaLeft -= 10;
    this.staminaSpent += 10;
    this.steppedBack = !this.steppedBack;
    this.statusText?.setText(this.steppedBack ? "Вы отошли назад." : "Вы вернулись ближе к стволу.");
    this.refreshHud();
  }

  private failRun(reason: WoodcuttingArcadeResultReason) {
    const treeId = this.initData?.config.tree.id ?? "unknown_tree";
    this.initData?.fail({
      success: false,
      treeId,
      staminaSpent: this.staminaSpent,
      hpDamage: this.hpDamage,
      durabilitySpent: this.durabilitySpent,
      reason,
    });
  }
}

class WoodcuttingDemoScene extends Phaser.Scene {
  private initData: WoodcuttingSceneInit | null = null;
  private treeHp = 0;
  private staminaLeft = 0;
  private hpLeft = 0;
  private durabilityLeft = 0;
  private staminaSpent = 0;
  private hpDamage = 0;
  private durabilitySpent = 0;
  private treesFelled = 0;
  private side: "left" | "right" = "left";
  private segs: Array<{ branch: "left" | "right" | null }> = [];
  private canChop = true;
  private warning = false;
  private warnSide: "left" | "right" | null = null;
  private falling = false;
  private fallAngle = 0;
  private dead = false;
  private chopTimer: Phaser.Time.TimerEvent | null = null;
  private warnTimer: Phaser.Time.TimerEvent | null = null;
  private bg?: Phaser.GameObjects.Graphics;
  private treeGfx?: Phaser.GameObjects.Graphics;
  private charGfx?: Phaser.GameObjects.Graphics;
  private uiGfx?: Phaser.GameObjects.Graphics;
  private treeHpText?: Phaser.GameObjects.Text;
  private staminaText?: Phaser.GameObjects.Text;
  private hpText?: Phaser.GameObjects.Text;
  private durabilityText?: Phaser.GameObjects.Text;
  private treesText?: Phaser.GameObjects.Text;
  private axeLabel?: Phaser.GameObjects.Text;
  private warnText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private strikeButton?: Phaser.GameObjects.Rectangle;
  private finishButton?: Phaser.GameObjects.Rectangle;
  private readonly movementStaminaCost = 2;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private enterKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "WoodcuttingDemoScene" });
  }

  init(data: WoodcuttingSceneInit) {
    this.initData = data;
  }

  create() {
    if (!this.initData) this.initData = pendingWoodcuttingSceneInit;
    if (!this.initData) this.initData = (this.scene.settings.data as WoodcuttingSceneInit | undefined) ?? null;
    if (!this.initData?.config) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Ошибка запуска рубки: нет конфигурации", {
        color: "#6b1f1f",
        fontSize: "18px",
        fontFamily: "Georgia, serif",
        align: "center",
      }).setOrigin(0.5);
      return;
    }
    const { config } = this.initData;
    this.treeHp = Math.max(1, Math.floor(config.tree.hp));
    this.staminaLeft = Math.max(0, Math.floor(config.player.stamina));
    this.hpLeft = Math.max(0, Math.floor(config.player.hp));
    this.durabilityLeft = Math.max(0, Math.floor(config.axe?.durability ?? 0));
    this.staminaSpent = 0;
    this.hpDamage = 0;
    this.durabilitySpent = 0;
    this.treesFelled = 0;
    this.side = "left";
    this.canChop = true;
    this.warning = false;
    this.warnSide = null;
    this.falling = false;
    this.fallAngle = 0;
    this.dead = false;
    this.segs = Array.from({ length: 10 }, () => ({ branch: this.randomBranch() }));
    this.chopTimer?.remove();
    this.warnTimer?.remove();

    this.bg = this.add.graphics();
    this.treeGfx = this.add.graphics();
    this.charGfx = this.add.graphics();
    this.uiGfx = this.add.graphics();

    this.add.text(GAME_WIDTH / 2, 18, "АРКАДНАЯ РУБКА", { fontSize: "23px", color: "#3d2b1f", fontFamily: "Georgia, serif", fontStyle: "bold" }).setOrigin(0.5, 0);
    this.axeLabel = this.add.text(GAME_WIDTH / 2, 52, "", { fontSize: "13px", color: "#6b4c3b", fontFamily: "Georgia, serif" }).setOrigin(0.5, 0);
    this.warnText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, "", { fontSize: "22px", color: "#8b3a3a", fontFamily: "Georgia, serif", fontStyle: "bold italic", stroke: "#e8d5a3", strokeThickness: 3 }).setOrigin(0.5);
    this.treeHpText = this.add.text(36, 86, "", { color: "#5a4131", fontSize: "16px", fontFamily: "Georgia, serif" });
    this.staminaText = this.add.text(36, 112, "", { color: "#5a4131", fontSize: "16px", fontFamily: "Georgia, serif" });
    this.hpText = this.add.text(36, 138, "", { color: "#5a4131", fontSize: "16px", fontFamily: "Georgia, serif" });
    this.durabilityText = this.add.text(36, 164, "", { color: "#5a4131", fontSize: "16px", fontFamily: "Georgia, serif" });
    this.treesText = this.add.text(36, 190, "", { color: "#5a4131", fontSize: "16px", fontFamily: "Georgia, serif", fontStyle: "bold" });
    this.statusText = this.add.text(GAME_WIDTH / 2, 220, "Стрелки/A,D: перемещение. ENTER/SPACE: удар.", {
      color: "#6b4c3b",
      fontSize: "14px",
      fontFamily: "Georgia, serif",
      align: "center",
    }).setOrigin(0.5);

    this.strikeButton = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 90, 260, 54, INK, 0.9).setStrokeStyle(2, PARCHMENT_DARK);
    this.strikeButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.chop());
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 90, "УДАР", {
      color: "#f0ddb9",
      fontSize: "20px",
      fontFamily: "Georgia, serif",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.finishButton = this.add.rectangle(GAME_WIDTH - 92, 38, 120, 28, 0x2d1d15, 0.9).setStrokeStyle(1, PARCHMENT_DARK);
    this.finishButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.completeRun());
    this.add.text(GAME_WIDTH - 92, 38, "Забрать", {
      color: "#f0ddb9",
      fontSize: "14px",
      fontFamily: "Georgia, serif",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.input.keyboard?.on("keydown-LEFT", () => this.setSide("left"));
    this.input.keyboard?.on("keydown-A", () => this.setSide("left"));
    this.input.keyboard?.on("keydown-RIGHT", () => this.setSide("right"));
    this.input.keyboard?.on("keydown-D", () => this.setSide("right"));
    this.spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.ENTER,
    ]);
    this.input.keyboard?.on("keydown-ESC", () => this.completeRun());

    this.drawBackdrop();
    this.refreshHud();
    this.redraw();
  }

  update(_t: number, dt: number) {
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.chop();
    }
    if (this.enterKey && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.chop();
    }
    if (this.dead || !this.falling) return;
    this.fallAngle += (dt / 1000) * 130;
    if (this.fallAngle < 90) {
      this.redraw();
      return;
    }
    this.fallAngle = 90;
    this.treesFelled += 1;
    const hits = this.warnSide === this.side;
    if (hits) {
      const heavyHit = 24;
      this.hpLeft = Math.max(0, this.hpLeft - heavyHit);
      this.hpDamage += heavyHit;
      this.statusText?.setText("Ствол задел вас! Сильный урон.");
      this.refreshHud();
      if (this.hpLeft <= 0) {
        this.failRun("player_injured");
        return;
      }
    } else {
      this.statusText?.setText("Дерево упало. +1 в заготовку.");
    }
    this.resetTreeState();
    this.refreshHud();
    this.redraw();
  }

  private randomBranch(): "left" | "right" | null {
    const r = Math.random();
    if (r < 0.28) return "left";
    if (r < 0.56) return "right";
    return null;
  }

  private setSide(side: "left" | "right") {
    if (this.dead) return;
    if (this.side === side) return;
    if (this.staminaLeft < this.movementStaminaCost) {
      this.failRun("no_stamina");
      return;
    }
    this.staminaLeft -= this.movementStaminaCost;
    this.staminaSpent += this.movementStaminaCost;
    this.side = side;
    this.statusText?.setText(`Перемещение: -${this.movementStaminaCost} выносливости.`);
    this.refreshHud();
    this.redraw();
  }

  private chop() {
    if (this.dead || !this.canChop || this.falling) return;
    const config = this.initData?.config;
    if (!config || !config.axe) {
      this.failRun("axe_broken");
      return;
    }
    const staminaCost = Math.max(1, Math.round(8 * (1 + (config.axe.staminaCostModifier ?? 0))));
    if (this.staminaLeft < staminaCost) {
      this.failRun("no_stamina");
      return;
    }
    if (this.durabilityLeft <= 0) {
      this.failRun("axe_broken");
      return;
    }
    const damage = Math.max(
      1,
      Math.round(
        4 * (config.axe.efficiency || 1)
          + Math.max(0, config.player.carpenterLevel * 0.4)
          - (config.tree.hardness ?? 0) * 0.3,
      ),
    );
    this.staminaLeft -= staminaCost;
    this.staminaSpent += staminaCost;
    this.durabilityLeft -= 1;
    this.durabilitySpent += 1;
    if (this.segs[0]?.branch === this.side) {
      const branchHitDamage = 12;
      this.hpLeft = Math.max(0, this.hpLeft - branchHitDamage);
      this.hpDamage += branchHitDamage;
      this.statusText?.setText("Вы задели сучок. Потеря HP.");
      if (this.hpLeft <= 0) {
        this.refreshHud();
        this.failRun("player_injured");
        return;
      }
    }
    this.treeHp = Math.max(0, this.treeHp - damage);
    this.segs.shift();
    this.segs.push({ branch: this.randomBranch() });
    this.canChop = false;
    this.chopTimer?.remove();
    this.chopTimer = this.time.delayedCall(300, () => { this.canChop = true; });
    if (this.treeHp <= 0) {
      this.treesFelled += 1;
      this.statusText?.setText("Дерево срублено. Можно рубить следующее или забрать.");
      this.resetTreeState();
      this.refreshHud();
      this.redraw();
      return;
    }
    if (this.durabilityLeft <= 0) {
      this.failRun("axe_broken");
      return;
    }
    if (!this.warning && this.treeImbalance() > 3) this.startWarning(this.heavySide());
    this.refreshHud();
    this.redraw();
  }

  private resetTreeState() {
    const config = this.initData?.config;
    if (!config) return;
    this.falling = false;
    this.fallAngle = 0;
    this.warnSide = null;
    this.warning = false;
    this.canChop = true;
    this.treeHp = Math.max(1, Math.floor(config.tree.hp));
    this.segs = Array.from({ length: 10 }, () => ({ branch: this.randomBranch() }));
    this.warnTimer?.remove();
    this.warnText?.setText("");
  }

  private completeRun() {
    const treeId = this.initData?.config.tree.id ?? "unknown_tree";
    this.initData?.complete({
      success: true,
      treeId,
      staminaSpent: this.staminaSpent,
      hpDamage: this.hpDamage,
      durabilitySpent: this.durabilitySpent,
      treesFelled: this.treesFelled,
    });
  }

  private treeImbalance(): number {
    let l = 0; let r = 0;
    this.segs.slice(0, 5).forEach((seg, i) => {
      const w = 5 - i;
      if (seg.branch === "left") l += w;
      if (seg.branch === "right") r += w;
    });
    return Math.abs(l - r);
  }

  private heavySide(): "left" | "right" {
    let l = 0; let r = 0;
    this.segs.slice(0, 5).forEach((seg, i) => {
      const w = 5 - i;
      if (seg.branch === "left") l += w;
      if (seg.branch === "right") r += w;
    });
    return l >= r ? "left" : "right";
  }

  private startWarning(side: "left" | "right") {
    this.warning = true;
    this.warnSide = side;
    this.warnText?.setText(`⚠ Дерево падает ${side === "left" ? "←" : "→"} ⚠`);
    this.warnTimer?.remove();
    this.warnTimer = this.time.delayedCall(1400, () => { if (!this.dead) this.startFall(); });
  }

  private startFall() {
    this.falling = true;
    this.warning = false;
    this.canChop = false;
    this.warnText?.setText("");
  }

  private refreshHud() {
    const config = this.initData?.config;
    if (!config) return;
    const maxDur = Math.max(1, Math.floor((config.axe?.maxDurability ?? this.durabilityLeft) || 1));
    this.treeHpText?.setText(`Дерево: ${Math.max(0, this.treeHp)} / ${Math.floor(config.tree.hp)}`);
    this.staminaText?.setText(`Выносливость: ${Math.max(0, this.staminaLeft)} / ${Math.floor(config.player.stamina)}`);
    this.hpText?.setText(`HP: ${Math.max(0, this.hpLeft)} / ${Math.floor(config.player.hp)}`);
    this.durabilityText?.setText(`Топор: ${Math.max(0, this.durabilityLeft)} / ${maxDur}`);
    this.treesText?.setText(`Срублено деревьев: ${this.treesFelled}`);
    this.axeLabel?.setText(`Axe  ${Math.max(0, this.durabilityLeft)}/${maxDur}`);
  }

  private redraw() {
    this.drawTree();
    this.drawCharacter();
    this.drawUi();
  }

  private drawBackdrop() {
    const g = this.bg;
    if (!g) return;
    g.clear();
    g.fillStyle(PARCHMENT);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.lineStyle(1, PARCHMENT_DARK, 0.35);
    for (let y = 0; y < GAME_HEIGHT; y += 40) g.lineBetween(0, y, GAME_WIDTH, y);
    for (let x = 0; x < GAME_WIDTH; x += 40) g.lineBetween(x, 0, x, GAME_HEIGHT);
    g.fillStyle(0xb8894a, 0.16);
    g.fillRect(0, 0, GAME_WIDTH, 30);
    g.fillRect(0, GAME_HEIGHT - 30, GAME_WIDTH, 30);
    g.fillRect(0, 0, 30, GAME_HEIGHT);
    g.fillRect(GAME_WIDTH - 30, 0, 30, GAME_HEIGHT);
    g.lineStyle(2.5, INK, 0.6);
    g.lineBetween(0, GROUND_Y, GAME_WIDTH, GROUND_Y);
    g.fillStyle(PARCHMENT_DARK, 0.35);
    g.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    g.fillStyle(INK, 0.08);
    g.fillEllipse(PLAYER_LEFT_X, GROUND_Y + 4, 52, 10);
    g.fillEllipse(PLAYER_RIGHT_X, GROUND_Y + 4, 52, 10);
  }

  private drawTree() {
    const g = this.treeGfx;
    if (!g) return;
    g.clear();
    const segH = 42;
    const tw = 16;
    if (this.falling && this.warnSide) {
      const dir = this.warnSide === "left" ? -1 : 1;
      const rad = Phaser.Math.DegToRad(this.fallAngle * dir);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const rot = (lx: number, ly: number) => ({ x: TREE_X + lx * cos - ly * sin, y: TREE_BASE_Y + lx * sin + ly * cos });
      for (let i = 0; i < 6; i++) {
        const y0 = -(i + 1) * segH;
        const y1 = -i * segH;
        const c = i % 2 === 0 ? 0xb08060 : 0x8b6340;
        const tl = rot(-tw / 2, y0);
        const tr = rot(tw / 2, y0);
        const br = rot(tw / 2, y1);
        const bl = rot(-tw / 2, y1);
        g.fillStyle(c);
        g.fillPoints([tl, tr, br, bl], true);
        g.lineStyle(1.5, INK, 0.45);
        g.strokePoints([tl, tr, br, bl], true);
      }
      return;
    }
    for (let i = 0; i < 6; i++) {
      const seg = this.segs[i];
      const y1 = TREE_BASE_Y - i * segH;
      const y0 = y1 - segH;
      g.fillStyle(i % 2 === 0 ? 0xb08060 : 0x8b6340);
      g.fillRect(TREE_X - tw / 2, y0, tw, segH);
      g.lineStyle(1, INK, 0.25);
      g.lineBetween(TREE_X - tw / 2, y0, TREE_X + tw / 2, y0);
      g.lineStyle(1.5, INK, 0.5);
      g.strokeRect(TREE_X - tw / 2, y0, tw, segH);
      if (seg?.branch) {
        const dir = seg.branch === "left" ? -1 : 1;
        const bx = TREE_X + dir * (tw / 2);
        const len = 32;
        g.fillStyle(0x9e7a4a);
        g.fillRect(seg.branch === "left" ? bx - len : bx, y0 + segH * 0.55 - 5, len, 9);
        g.lineStyle(1, INK, 0.4);
        g.strokeRect(seg.branch === "left" ? bx - len : bx, y0 + segH * 0.55 - 5, len, 9);
      }
    }
  }

  private drawCharacter() {
    const g = this.charGfx;
    if (!g) return;
    g.clear();
    const px = this.side === "left" ? PLAYER_LEFT_X : PLAYER_RIGHT_X;
    const flip = this.side === "right" ? 1 : -1;
    g.fillStyle(INK, 0.1);
    g.fillEllipse(px, GROUND_Y + 2, 40, 8);
    g.fillStyle(PARCHMENT_DARK);
    g.fillCircle(px, PLAYER_Y - 4, 18);
    g.lineStyle(2, INK, 0.8);
    g.strokeCircle(px, PLAYER_Y - 4, 18);
    g.fillStyle(INK);
    g.fillCircle(px + flip * 5, PLAYER_Y - 6, 2.5);
    g.fillCircle(px + flip * 11, PLAYER_Y - 6, 2.5);
    g.fillRect(px - 12, PLAYER_Y - 24, 24, 7);
    g.fillRect(px - 8, PLAYER_Y - 30, 16, 8);
  }

  private drawUi() {
    const g = this.uiGfx;
    const config = this.initData?.config;
    if (!g || !config?.axe) return;
    g.clear();
    const maxDur = Math.max(1, Math.floor(config.axe.maxDurability));
    const ratio = Math.max(0, Math.min(1, this.durabilityLeft / maxDur));
    const bw = 140;
    const bh = 10;
    const bx = GAME_WIDTH / 2 - bw / 2;
    const by = 72;
    const c = ratio > 0.5 ? 0x6b8f50 : ratio > 0.25 ? 0xb8860b : 0x8b3a3a;
    g.fillStyle(PARCHMENT_DARK, 0.5);
    g.fillRoundedRect(bx - 2, by - 2, bw + 4, bh + 4, 3);
    g.fillStyle(0xd4c9a8);
    g.fillRoundedRect(bx, by, bw, bh, 2);
    g.fillStyle(c);
    g.fillRoundedRect(bx, by, bw * ratio, bh, 2);
    g.lineStyle(1.5, INK, 0.5);
    g.strokeRoundedRect(bx, by, bw, bh, 2);
    if (this.warning) {
      g.fillStyle(0x8b3a3a, 0.035);
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  private failRun(reason: WoodcuttingArcadeResultReason) {
    this.dead = true;
    this.canChop = false;
    this.warnTimer?.remove();
    const treeId = this.initData?.config.tree.id ?? "unknown_tree";
    this.initData?.fail({
      success: false,
      treeId,
      staminaSpent: this.staminaSpent,
      hpDamage: this.hpDamage,
      durabilitySpent: this.durabilitySpent,
      reason,
    });
  }
}

class SawingScene extends Phaser.Scene {
  private initData: SawingSceneInit | null = null;
  private progress = 0;
  private heat = 0;
  private staminaLeft = 0;
  private hpLeft = 0;
  private durabilityLeft = 0;
  private staminaSpent = 0;
  private hpDamage = 0;
  private durabilitySpent = 0;
  private lastDir: "left" | "right" | null = null;
  private coreX = 0;
  private knotX = 0;
  private defect = 0;

  private progressText?: Phaser.GameObjects.Text;
  private heatText?: Phaser.GameObjects.Text;
  private staminaText?: Phaser.GameObjects.Text;
  private hpText?: Phaser.GameObjects.Text;
  private durabilityText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private rigGfx?: Phaser.GameObjects.Graphics;
  private sawCenterX = GAME_WIDTH / 2 - 90;
  private readonly sawNeutralX = GAME_WIDTH / 2 - 90;
  private sawTween?: Phaser.Tweens.Tween;

  constructor() {
    super({ key: "SawingScene" });
  }

  init(data: SawingSceneInit) {
    this.initData = data;
  }

  create() {
    if (!this.initData) {
      this.initData = pendingSawingSceneInit;
    }
    if (!this.initData) {
      this.drawBackdrop();
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Ошибка запуска распила:\ninitData отсутствует", {
        color: "#6b1f1f",
        fontSize: "18px",
        fontFamily: "Georgia, serif",
        align: "center",
      }).setOrigin(0.5);
      return;
    }
    const { config } = this.initData;
    this.progress = 0;
    this.heat = 0;
    this.staminaLeft = Math.max(0, Math.floor(config.player.stamina));
    this.hpLeft = Math.max(0, Math.floor(config.player.hp));
    this.durabilityLeft = Math.max(0, Math.floor(config.saw?.durability ?? 0));
    this.staminaSpent = 0;
    this.hpDamage = 0;
    this.durabilitySpent = 0;
    this.lastDir = null;
    this.defect = 0;
    this.coreX = GAME_WIDTH / 2 + Phaser.Math.Between(-18, 18);
    this.knotX = GAME_WIDTH / 2 + Phaser.Math.Between(-70, 70);

    this.drawBackdrop();
    this.add.text(GAME_WIDTH / 2, 24, `\uD83E\uDE9A ${config.log.name}`, {
      color: "#3d2b1f",
      fontSize: "26px",
      fontFamily: "Georgia, serif",
      fontStyle: "bold",
    }).setOrigin(0.5, 0);
    this.add.text(GAME_WIDTH / 2, 58, `Рецепт: ${config.recipe.name}`, {
      color: "#6b4c3b",
      fontSize: "16px",
      fontFamily: "Georgia, serif",
    }).setOrigin(0.5, 0);

    this.progressText = this.addTextLine(100, "");
    this.heatText = this.addTextLine(128, "");
    this.staminaText = this.addTextLine(156, "");
    this.hpText = this.addTextLine(184, "");
    this.durabilityText = this.addTextLine(212, "");
    this.statusText = this.add.text(GAME_WIDTH / 2, 334, "Чередуй ← и →", {
      color: "#8b3a3a",
      fontSize: "18px",
      fontFamily: "Georgia, serif",
      fontStyle: "bold italic",
      align: "center",
    }).setOrigin(0.5, 0);
    this.statusText.setDepth(20);
    this.rigGfx = this.add.graphics();
    this.rigGfx.setDepth(10);
    this.sawCenterX = this.sawNeutralX;
    this.drawSawingRig();

    this.addActionButton(120, 680, 220, 64, "\u2B05 Пилить влево", () => this.press("left"));
    this.addActionButton(380, 680, 220, 64, "\u27A1 Пилить вправо", () => this.press("right"));
    this.addActionButton(120, 766, 480, 58, "\u274C Выйти", () => this.failRun("cancelled"));

    this.input.keyboard?.on("keydown-LEFT", () => this.press("left"));
    this.input.keyboard?.on("keydown-A", () => this.press("left"));
    this.input.keyboard?.on("keydown-RIGHT", () => this.press("right"));
    this.input.keyboard?.on("keydown-D", () => this.press("right"));
    this.input.keyboard?.on("keydown-ESC", () => this.failRun("cancelled"));

    this.refreshHud();
  }

  private drawBackdrop() {
    const g = this.add.graphics();
    g.fillStyle(PARCHMENT);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.lineStyle(1, PARCHMENT_DARK, 0.35);
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      g.lineBetween(0, y, GAME_WIDTH, y);
    }
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      g.lineBetween(x, 0, x, GAME_HEIGHT);
    }
  }

  private addTextLine(y: number, text: string): Phaser.GameObjects.Text {
    return this.add.text(36, y, text, {
      color: "#5a4131",
      fontSize: "16px",
      fontFamily: "Georgia, serif",
    });
  }

  private addActionButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
  ) {
    const bg = this.add.rectangle(x + width / 2, y + height / 2, width, height, INK, 0.86).setStrokeStyle(2, PARCHMENT_DARK);
    const text = this.add.text(x + width / 2, y + height / 2, label, {
      color: "#f0ddb9",
      fontSize: "18px",
      fontFamily: "Georgia, serif",
      fontStyle: "bold",
      align: "center",
    }).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true }).on("pointerdown", onClick);
    bg.on("pointerover", () => bg.setFillStyle(INK_LIGHT, 0.9));
    bg.on("pointerout", () => bg.setFillStyle(INK, 0.86));
    text.setDepth(1);
  }

  private refreshHud() {
    const config = this.initData?.config;
    if (!config) {
      return;
    }
    this.progressText?.setText(`Прогресс распила: ${Math.floor(this.progress)}%`);
    this.heatText?.setText(`Нагрев/дефект: ${Math.floor(this.heat)} / 100  •  Дефект: ${Math.floor(this.defect)}%`);
    this.staminaText?.setText(`Выносливость: ${Math.max(0, this.staminaLeft)} / ${Math.floor(config.player.stamina)}`);
    this.hpText?.setText(`HP игрока: ${Math.max(0, this.hpLeft)} / ${Math.floor(config.player.hp)}`);
    if (config.saw) {
      this.durabilityText?.setText(`Пила: ${Math.max(0, this.durabilityLeft)} / ${Math.floor(config.saw.maxDurability)} (${config.saw.name})`);
    } else {
      this.durabilityText?.setText("Пила: нет подходящего инструмента");
    }
  }

  private press(dir: "left" | "right") {
    const config = this.initData?.config;
    if (!config || !this.initData) {
      return;
    }
    if (!config.saw) {
      this.statusText?.setText("Нет подходящей пилы.");
      return;
    }
    if (this.staminaLeft < config.recipe.staminaPerStroke) {
      this.statusText?.setText("Недостаточно выносливости.");
      return;
    }
    if (this.durabilityLeft <= 0) {
      this.statusText?.setText("Пила сломана.");
      this.failRun("saw_broken");
      return;
    }

    this.staminaLeft -= config.recipe.staminaPerStroke;
    this.staminaSpent += config.recipe.staminaPerStroke;
    this.durabilityLeft -= 1;
    this.durabilitySpent += 1;

    const efficientSwing = this.lastDir !== null && this.lastDir !== dir;
    const efficiencyBonus = Math.round((config.saw.efficiency || 1) * 12);
    const progressGain = efficientSwing ? 20 + efficiencyBonus : 6 + Math.round(efficiencyBonus * 0.35);
    this.progress = Math.min(100, this.progress + progressGain);

    const heatGain = efficientSwing ? 8 + Math.floor(Math.random() * 9) : 16 + Math.floor(Math.random() * 10);
    this.heat = Math.min(100, this.heat + heatGain);
    this.lastDir = dir;
    this.animateSaw(dir);

    const sawHeadX = dir === "left" ? GAME_WIDTH / 2 - 124 : GAME_WIDTH / 2 + 4;
    const coreDist = Math.abs(sawHeadX - this.coreX);
    const knotDist = Math.abs(sawHeadX - this.knotX);
    if (coreDist < 24) {
      this.statusText?.setText("Сердцевина: режь плавно, не перегревай.");
      this.defect = Math.max(0, this.defect - 2);
      this.heat = Math.max(0, this.heat - 3);
    }
    if (knotDist < 28) {
      this.statusText?.setText("⚠ Сучок — тише!");
      this.heat = Math.min(100, this.heat + 10);
      this.defect = Math.min(100, this.defect + 8);
    } else if (!efficientSwing) {
      this.defect = Math.min(100, this.defect + 2);
    } else {
      this.defect = Math.max(0, this.defect - 1);
    }

    if (this.heat >= 100) {
      this.hpLeft = Math.max(0, this.hpLeft - 4);
      this.hpDamage += 4;
      this.statusText?.setText("Перегрев! Пила ушла в клин.");
      if (this.hpLeft <= 0) {
        this.failRun("player_injured");
        return;
      }
      // Keep the mini-game running: apply setback instead of closing modal.
      this.heat = 62;
      this.progress = Math.max(0, this.progress - 12);
      this.defect = Math.min(100, this.defect + 10);
      this.refreshHud();
      return;
    }
    if (this.defect >= 100) {
      this.statusText?.setText("Слишком много дефекта! Пропил сброшен, продолжайте аккуратнее.");
      // Keep the run alive but punish the player progress/durability.
      this.progress = Math.max(0, this.progress - 20);
      this.defect = 45;
      this.heat = Math.min(95, this.heat + 8);
      this.durabilityLeft = Math.max(0, this.durabilityLeft - 1);
      this.durabilitySpent += 1;
      if (this.durabilityLeft <= 0) {
        this.statusText?.setText("Пила сломалась. Распил завершен.");
        this.failRun("saw_broken");
        return;
      }
      this.refreshHud();
      return;
    }

    if (this.progress >= 100) {
      this.initData.complete({
        success: true,
        logItemId: config.log.id,
        recipeId: config.recipe.id,
        outputItemId: config.recipe.outputItemId,
        staminaSpent: this.staminaSpent,
        hpDamage: this.hpDamage,
        durabilitySpent: this.durabilitySpent,
      });
      return;
    }

    this.heat = Math.max(0, this.heat - 1);
    this.refreshHud();
  }

  private drawSawingRig() {
    const g = this.rigGfx;
    if (!g) {
      return;
    }
    g.clear();

    const benchY = 472;
    const logWidth = 320;
    const logHeight = 86;
    const logLeft = GAME_WIDTH / 2 - logWidth / 2;
    const logTop = benchY - logHeight / 2;

    g.fillStyle(0x8f6b45);
    g.fillRect(logLeft + 28, benchY + 28, 16, 62);
    g.fillRect(logLeft + logWidth - 44, benchY + 28, 16, 62);
    g.lineStyle(3, 0x6f5236, 0.9);
    g.strokeRect(logLeft + 28, benchY + 28, 16, 62);
    g.strokeRect(logLeft + logWidth - 44, benchY + 28, 16, 62);
    g.strokeRect(logLeft + 30, benchY + 54, logWidth - 60, 16);

    g.fillStyle(0xb9845a);
    g.fillRoundedRect(logLeft, logTop, logWidth, logHeight, 18);
    g.fillStyle(0xc48f64);
    g.fillRoundedRect(logLeft + 4, logTop + 14, logWidth - 8, logHeight - 28, 12);
    g.lineStyle(3, 0x7c573a, 0.95);
    g.strokeRoundedRect(logLeft, logTop, logWidth, logHeight, 18);
    g.fillStyle(0xd2ac85, 0.75);
    g.fillCircle(logLeft + 8, benchY, logHeight / 2 - 8);
    g.fillCircle(logLeft + logWidth - 8, benchY, logHeight / 2 - 8);

    g.lineStyle(4, 0x6f4a2f, 0.72);
    g.lineBetween(this.coreX, logTop + 6, this.coreX, logTop + logHeight - 6);
    g.fillStyle(0x845730, 0.9);
    g.fillCircle(this.knotX, benchY + 3, 22);
    g.lineStyle(3, 0x6c4527, 0.95);
    g.strokeCircle(this.knotX, benchY + 3, 22);
    g.lineStyle(2, 0x6c4527, 0.65);
    g.strokeCircle(this.knotX, benchY + 3, 10);

    g.fillStyle(0xd8d0b6);
    g.fillRoundedRect(logLeft + 10, benchY + 84, logWidth - 20, 12, 4);
    g.lineStyle(2, 0x8f876f, 0.9);
    g.strokeRoundedRect(logLeft + 10, benchY + 84, logWidth - 20, 12, 4);

    const sawY = benchY - 72;
    const sawTint = this.heat > 80 ? 0xffb347 : this.heat > 55 ? 0xe7c88a : 0xadb1b8;
    g.fillStyle(sawTint);
    g.fillRect(this.sawCenterX - 110, sawY - 12, 220, 36);
    g.lineStyle(3, 0x7f838b, 1);
    g.strokeRect(this.sawCenterX - 110, sawY - 12, 220, 36);
    g.fillStyle(0x8d5f3f);
    g.fillRect(this.sawCenterX - 112, sawY - 44, 10, 32);
    g.lineStyle(2, 0x69462e, 1);
    g.strokeRect(this.sawCenterX - 112, sawY - 44, 10, 32);

    g.fillStyle(0xe0d8c0);
    const teethTop = sawY + 24;
    const teethCount = 24;
    for (let i = 0; i < teethCount; i += 1) {
      const tx = this.sawCenterX - 104 + i * 9;
      g.fillTriangle(tx, teethTop, tx + 4.5, teethTop + 10, tx + 9, teethTop);
    }

    const progressRatio = Math.max(0, Math.min(1, this.progress / 100));
    const railWidth = logWidth - 20;
    g.fillStyle(0x9c6d42, 0.95);
    g.fillRoundedRect(logLeft + 10, benchY + 84, railWidth * progressRatio, 12, 4);
  }

  private animateSaw(dir: "left" | "right") {
    this.sawTween?.stop();
    const targetX = dir === "left" ? GAME_WIDTH / 2 - 124 : GAME_WIDTH / 2 + 124;
    this.sawTween = this.tweens.add({
      targets: this,
      sawCenterX: targetX,
      duration: 120,
      yoyo: true,
      ease: "Sine.InOut",
      onUpdate: () => {
        this.drawSawingRig();
      },
      onComplete: () => {
        this.sawCenterX = this.sawNeutralX;
        this.drawSawingRig();
      },
    });
  }

  private failRun(reason: SawingArcadeResultReason) {
    const config = this.initData?.config;
    this.initData?.fail({
      success: false,
      logItemId: config?.log.id ?? "unknown_log",
      recipeId: config?.recipe.id ?? "unknown_recipe",
      outputItemId: config?.recipe.outputItemId ?? "unknown_output",
      staminaSpent: this.staminaSpent,
      hpDamage: this.hpDamage,
      durabilitySpent: this.durabilitySpent,
      reason,
    });
  }
}

type AnyArcadeResult = WoodcuttingArcadeResult | SawingArcadeResult;

interface CarpenterArcadeModalProps {
  mode: CarpenterArcadeMode;
  woodcuttingConfig?: WoodcuttingArcadeConfig | null;
  sawingConfig?: SawingArcadeConfig | null;
  onComplete: (result: AnyArcadeResult) => void;
  onFail: (result: AnyArcadeResult) => void;
  onClose: () => void;
}

export function CarpenterArcadeModal({
  mode,
  woodcuttingConfig,
  sawingConfig,
  onComplete,
  onFail,
  onClose,
}: CarpenterArcadeModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const sceneKey = useMemo(() => (mode === "woodcutting" ? "WoodcuttingDemoScene" : "SawingScene"), [mode]);

  useEffect(() => {
    const mountNode = containerRef.current;
    if (!mountNode) {
      return;
    }
    setLaunchError(null);

    const selectedScene = mode === "woodcutting" ? WoodcuttingDemoScene : SawingScene;
    const scenePayload =
      mode === "woodcutting" && woodcuttingConfig
        ? ({
            config: woodcuttingConfig,
            complete: (result: WoodcuttingArcadeResult) => onComplete(result),
            fail: (result: WoodcuttingArcadeResult) => onFail(result),
          } satisfies WoodcuttingSceneInit)
        : mode === "sawing" && sawingConfig
          ? ({
              config: sawingConfig,
              complete: (result: SawingArcadeResult) => onComplete(result),
              fail: (result: SawingArcadeResult) => onFail(result),
            } satisfies SawingSceneInit)
          : null;

    if (!scenePayload) {
      setLaunchError(
        mode === "woodcutting"
          ? "Не удалось запустить рубку: отсутствует конфиг дерева/топора."
          : "Не удалось запустить распил: отсутствует конфиг бревна/пилы.",
      );
      return;
    }

    if (mode === "woodcutting") {
      pendingWoodcuttingSceneInit = scenePayload as WoodcuttingSceneInit;
      pendingSawingSceneInit = null;
    } else {
      pendingSawingSceneInit = scenePayload as SawingSceneInit;
      pendingWoodcuttingSceneInit = null;
    }

    const sceneInstance = new selectedScene();
    if (mode === "woodcutting") {
      (sceneInstance as unknown as { initData?: WoodcuttingSceneInit | null }).initData = scenePayload as WoodcuttingSceneInit;
    } else {
      (sceneInstance as unknown as { initData?: SawingSceneInit | null }).initData = scenePayload as SawingSceneInit;
    }

    mountNode.innerHTML = "";

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: "#e8d5a3",
      parent: mountNode,
      scene: [sceneInstance],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        antialias: true,
      },
    });

    gameRef.current = game;
    game.scene.start(sceneKey, scenePayload);

    return () => {
      pendingWoodcuttingSceneInit = null;
      pendingSawingSceneInit = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      mountNode.innerHTML = "";
    };
  }, [mode, onComplete, onFail, sawingConfig, sceneKey, woodcuttingConfig]);

  const title = mode === "woodcutting" ? "Аркадная рубка" : "Аркадный распил";

  return (
    <div
      className="wm-modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(10, 8, 6, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
      }}
    >
      <div
        style={{
          width: "820px",
          backgroundColor: "#1d1511",
          border: "2px solid #8b5a2b",
          borderRadius: "12px",
          color: "#f4ede6",
          padding: "16px",
          boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h3 style={{ margin: 0, color: "#ffb97b", fontSize: "20px" }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #8b5a2b",
              background: "#2d1d15",
              color: "#f2d6a3",
              cursor: "pointer",
            }}
          >
            Закрыть
          </button>
        </div>
        <div
          ref={containerRef}
          style={{
            width: "100%",
            minHeight: "900px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #553f34",
            borderRadius: "8px",
            overflow: "hidden",
            background: "#0f0a07",
          }}
        >
          {launchError ? (
            <div
              style={{
                color: "#f2d6a3",
                fontFamily: "Georgia, serif",
                fontSize: "16px",
                padding: "16px",
              }}
            >
              {launchError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
