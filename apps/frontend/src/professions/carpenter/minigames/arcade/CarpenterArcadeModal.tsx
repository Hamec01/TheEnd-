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

const GAME_WIDTH = 480;
const GAME_HEIGHT = 640;
const PARCHMENT = 0xe8d5a3;
const INK = 0x3d2b1f;
const INK_LIGHT = 0x6b4c3b;
const PARCHMENT_DARK = 0xc9a96e;
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

  private progressText?: Phaser.GameObjects.Text;
  private heatText?: Phaser.GameObjects.Text;
  private staminaText?: Phaser.GameObjects.Text;
  private hpText?: Phaser.GameObjects.Text;
  private durabilityText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;

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
    this.statusText = this.add.text(GAME_WIDTH / 2, 246, "Чередуй ← и →", {
      color: "#8b3a3a",
      fontSize: "18px",
      fontFamily: "Georgia, serif",
      fontStyle: "bold italic",
      align: "center",
    }).setOrigin(0.5, 0);

    this.addActionButton(50, 320, 182, 60, "\u2B05 Пилить влево", () => this.press("left"));
    this.addActionButton(248, 320, 182, 60, "\u27A1 Пилить вправо", () => this.press("right"));
    this.addActionButton(50, 400, 380, 50, "\u274C Прервать", () => this.failRun("cancelled"));

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
    this.heatText?.setText(`Нагрев: ${Math.floor(this.heat)} / 100`);
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
      this.failRun("saw_broken");
      return;
    }
    if (this.staminaLeft < config.recipe.staminaPerStroke) {
      this.statusText?.setText("Недостаточно выносливости.");
      this.failRun("no_stamina");
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

    if (this.heat >= 100) {
      this.hpLeft = Math.max(0, this.hpLeft - 4);
      this.hpDamage += 4;
      this.refreshHud();
      this.statusText?.setText("Перегрев! Пила ушла в клин.");
      if (this.hpLeft <= 0) {
        this.failRun("player_injured");
      } else {
        this.failRun("overheated");
      }
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

  const sceneKey = useMemo(() => (mode === "woodcutting" ? "WoodcuttingScene" : "SawingScene"), [mode]);

  useEffect(() => {
    const mountNode = containerRef.current;
    if (!mountNode) {
      return;
    }
    setLaunchError(null);

    const selectedScene = mode === "woodcutting" ? WoodcuttingScene : SawingScene;
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

    return () => {
      pendingWoodcuttingSceneInit = null;
      pendingSawingSceneInit = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
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
          width: "560px",
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
            minHeight: "640px",
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
