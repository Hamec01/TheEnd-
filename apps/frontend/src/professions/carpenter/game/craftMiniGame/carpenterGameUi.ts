import type Phaser from 'phaser';

export const COLORS = {
  bgPanel: 0x1a110a,
  panelBorder: 0x6a4020,
  panelBorderBright: 0xc08040,
  textPrimary: 0xf5e8c8,
  textSecondary: 0xb09060,
  textDim: 0x706040,
  gold: 0xffe066,
  green: 0x4cde68,
  yellow: 0xf5c842,
  red: 0xe03030,
  pressureLow: 0x4080a0,
  pressureIdeal: 0x4cde68,
  pressureHigh: 0xf5c842,
  pressureOver: 0xe03030,
  markerColor: 0xffffff,
};

export const FONT_FAMILY = '"Palatino Linotype", "Palatino", "Book Antiqua", Georgia, serif';

export function makeTextStyle(size: number, color = '#f5e8c8', bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    color,
    fontStyle: bold ? 'bold' : 'normal',
  };
}

export function drawStatBar(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  value: number,
  max: number,
  fillColor: number,
  bgColor = 0x0a0705,
): void {
  gfx.fillStyle(bgColor, 1);
  gfx.fillRoundedRect(x, y, width, height, 3);

  const pct = Math.max(0, Math.min(1, value / max));
  if (pct > 0) {
    gfx.fillStyle(fillColor, 1);
    gfx.fillRoundedRect(x + 1, y + 1, (width - 2) * pct, height - 2, 2);
  }

  gfx.lineStyle(1, 0x6a4020, 1);
  gfx.strokeRoundedRect(x, y, width, height, 3);
}

export function drawPanel(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 0.88,
): void {
  gfx.fillStyle(COLORS.bgPanel, alpha);
  gfx.fillRoundedRect(x, y, width, height, 6);
  gfx.lineStyle(1.5, COLORS.panelBorder, 1);
  gfx.strokeRoundedRect(x, y, width, height, 6);
}

export function flashText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string,
  size = 28,
  duration = 900,
): void {
  const t = scene.add.text(x, y, text, makeTextStyle(size, color, true))
    .setOrigin(0.5)
    .setAlpha(1);
  scene.tweens.add({
    targets: t,
    y: y - 40,
    alpha: 0,
    duration,
    ease: 'Power2',
    onComplete: () => t.destroy(),
  });
}

export function spawnSparks(scene: Phaser.Scene, x: number, y: number, count = 8, color = 0xffe066): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist = 30 + Math.random() * 40;
    const gfx = scene.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillCircle(0, 0, 3 + Math.random() * 3);
    gfx.x = x;
    gfx.y = y;

    scene.tweens.add({
      targets: gfx,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: 400 + Math.random() * 300,
      ease: 'Power2',
      onComplete: () => gfx.destroy(),
    });
  }
}

export function spawnCrackFlash(scene: Phaser.Scene, x: number, y: number): void {
  const gfx = scene.add.graphics();
  gfx.lineStyle(3, 0xe03030, 0.9);

  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const len = 20 + Math.random() * 30;
    gfx.beginPath();
    gfx.moveTo(x, y);
    const midX = x + Math.cos(angle) * len * 0.5 + (Math.random() - 0.5) * 10;
    const midY = y + Math.sin(angle) * len * 0.5 + (Math.random() - 0.5) * 10;
    gfx.lineTo(midX, midY);
    gfx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    gfx.strokePath();
  }

  scene.tweens.add({
    targets: gfx,
    alpha: 0,
    duration: 700,
    ease: 'Power2',
    onComplete: () => gfx.destroy(),
  });

  const flash = scene.add.graphics();
  flash.fillStyle(0xe03030, 0.3);
  flash.fillRect(0, 0, 1280, 720);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 200,
    onComplete: () => flash.destroy(),
  });
}

export function spawnWoodShaving(scene: Phaser.Scene, x: number, y: number): void {
  const gfx = scene.add.graphics();
  gfx.fillStyle(0x8a5c30, 0.8);

  const w = 6 + Math.random() * 8;
  const h = 2 + Math.random() * 3;
  gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 1);
  gfx.x = x + (Math.random() - 0.5) * 60;
  gfx.y = y;

  scene.tweens.add({
    targets: gfx,
    x: gfx.x + (Math.random() - 0.5) * 80,
    y: gfx.y + 40 + Math.random() * 60,
    angle: (Math.random() - 0.5) * 180,
    alpha: 0,
    duration: 600 + Math.random() * 400,
    ease: 'Power1',
    onComplete: () => gfx.destroy(),
  });
}
