import type { VisualFxDefinition, VisualFxPlayOn } from '@theend/rpg-domain';
import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { PhaserVisualFxPlayer } from '../../phaser/effects/PhaserVisualFxPlayer';

interface FxBattlePreviewProps {
  fx: VisualFxDefinition;
}

class FxBattlePreviewScene extends Phaser.Scene {
  private fx: VisualFxDefinition | null = null;
  private fxPlayer?: PhaserVisualFxPlayer;
  private player?: Phaser.GameObjects.Container;
  private enemy?: Phaser.GameObjects.Container;

  constructor() {
    super('FxBattlePreviewScene');
  }

  create() {
    this.fxPlayer = new PhaserVisualFxPlayer(this);
    this.drawArena();
    this.player = this.createActor(190, 175, 0x2f6f9e, 'PL');
    this.enemy = this.createActor(430, 175, 0x8f3333, 'EN');
  }

  setFx(fx: VisualFxDefinition) {
    this.fx = fx;
    this.fxPlayer?.setRegistry([fx]);
  }

  play(mode?: VisualFxPlayOn) {
    if (!this.fx || !this.fxPlayer || !this.player || !this.enemy) {
      return;
    }

    const playOn = mode ?? this.fx.placement.defaultPlayOn;
    const playerPoint = { x: this.player.x, y: this.player.y };
    const enemyPoint = { x: this.enemy.x, y: this.enemy.y };

    if (playOn === 'projectile') {
      this.fxPlayer.playProjectile(this.fx, { from: playerPoint, to: enemyPoint });
      return;
    }

    if (playOn === 'target') {
      this.fxPlayer.playFxAt(this.fx, { ...enemyPoint });
      return;
    }

    if (playOn === 'area') {
      this.fxPlayer.playFxAt(this.fx, { x: (playerPoint.x + enemyPoint.x) / 2, y: playerPoint.y });
      return;
    }

    if (playOn === 'screen') {
      this.fxPlayer.playFxAt(this.fx, { x: 310, y: 175, scale: 1.35 });
      return;
    }

    this.fxPlayer.playFxAt(this.fx, { ...playerPoint });
  }

  resetFx() {
    for (const child of this.children.list.slice()) {
      const depth = 'depth' in child ? (child as Phaser.GameObjects.GameObject & { depth: number }).depth : 0;
      if (depth >= 4000) {
        child.destroy();
      }
    }
  }

  private drawArena() {
    this.add.rectangle(310, 175, 620, 350, 0x18120d, 1);
    this.add.rectangle(310, 175, 588, 304, 0x3d3123, 1).setStrokeStyle(2, 0x8a673a, 0.8);
    const grid = this.add.graphics();
    grid.lineStyle(1, 0xf4ddb0, 0.16);
    for (let x = 16; x <= 604; x += 42) {
      grid.lineBetween(x, 23, x, 327);
    }
    for (let y = 23; y <= 327; y += 42) {
      grid.lineBetween(16, y, 604, y);
    }
    this.add.circle(310, 175, 82, 0x6b4a2e, 0.18).setStrokeStyle(1, 0xd8b15a, 0.18);
  }

  private createActor(x: number, y: number, color: number, label: string): Phaser.GameObjects.Container {
    const actor = this.add.container(x, y);
    const ring = this.add.circle(0, 0, 23, 0x1b1410, 0.94).setStrokeStyle(2, 0xf3d9a8, 0.9);
    const avatar = this.add.circle(0, 0, 18, color, 1);
    const text = this.add.text(0, -1, label, {
      color: '#fff4d4',
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      fontStyle: '700',
    }).setOrigin(0.5);
    const hpBack = this.add.rectangle(0, 27, 38, 5, 0x1b1612, 0.9);
    const hp = this.add.rectangle(-19, 27, 38, 5, 0x5de082, 1).setOrigin(0, 0.5);
    actor.add([ring, avatar, text, hpBack, hp]);
    actor.setDepth(50);
    return actor;
  }
}

export function FxBattlePreview({ fx }: FxBattlePreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<FxBattlePreviewScene | null>(null);
  const [isReady, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || gameRef.current) {
      return undefined;
    }

    const scene = new FxBattlePreviewScene();
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: 620,
      height: 350,
      backgroundColor: '#120e09',
      scene,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: {
        antialias: true,
        pixelArt: false,
      },
    });
    gameRef.current = game;
    setReady(true);

    return () => {
      setReady(false);
      sceneRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setFx(fx);
  }, [fx]);

  return (
    <section className="card visual-fx-preview">
      <div className="visual-fx-preview-head">
        <div>
          <h3>Demo Battle Map</h3>
          <p className="muted">Preview uses the current unsaved FX settings.</p>
        </div>
        <div className="admin-actions-row">
          <button type="button" disabled={!isReady} onClick={() => sceneRef.current?.play('caster')}>Caster</button>
          <button type="button" disabled={!isReady} onClick={() => sceneRef.current?.play('target')}>Target</button>
          <button type="button" disabled={!isReady} onClick={() => sceneRef.current?.play('projectile')}>Projectile</button>
          <button type="button" disabled={!isReady} onClick={() => sceneRef.current?.play('area')}>Area</button>
          <button type="button" disabled={!isReady} onClick={() => sceneRef.current?.play()}>Default</button>
          <button type="button" disabled={!isReady} onClick={() => sceneRef.current?.resetFx()}>Reset</button>
        </div>
      </div>
      <div ref={hostRef} className="visual-fx-preview-host" />
    </section>
  );
}
