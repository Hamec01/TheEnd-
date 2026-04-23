import Phaser from 'phaser';

export class ArenaScene extends Phaser.Scene {
  constructor() {
    super('ArenaScene');
  }

  create(): void {
    const width = Number(this.scale.width);
    const height = Number(this.scale.height);

    this.add.rectangle(width / 2, height / 2, width, height, 0x2a2117);
    this.add.rectangle(width / 2, height / 2, width - 26, height - 26, 0x3a2c1d, 0.7);
    this.add.text(20, 16, 'Арена Арклейна', { color: '#f8e7c5', fontSize: '24px' });
    this.add.text(20, 50, 'Здесь только бой: настрой состав NPC и запускай матч.', {
      color: '#d5c39d',
      fontSize: '14px',
    });

    this.add.ellipse(width / 2, 165, 420, 150, 0x6b4d2a, 0.3).setStrokeStyle(2, 0x8f6a3d, 0.6);
    this.add.text(width / 2 - 122, 142, 'Подготовка арены', {
      color: '#f8e7c5',
      fontSize: '18px',
    });
    this.add.text(width / 2 - 178, 172, 'Собери бойцов, проверь состав и сразу переходи в бой.', {
      color: '#d5c39d',
      fontSize: '13px',
    });

    const startBattle = this.add
      .rectangle(width - 130, height - 54, 210, 56, 0x3f7a43)
      .setStrokeStyle(2, 0xa2f0ae)
      .setInteractive({ useHandCursor: true });

    this.add.text(width - 218, height - 63, 'Начать бой', {
      color: '#e9ffe9',
      fontSize: '20px',
    });

    startBattle.on('pointerdown', () => {
      window.dispatchEvent(new CustomEvent('arena:start-battle'));
    });

    const npcEditor = this.add
      .rectangle(width / 2, height - 54, 220, 56, 0x6b4a7a)
      .setStrokeStyle(2, 0xd2aef0)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2 - 82, height - 63, 'Настроить NPC', {
      color: '#f7e9ff',
      fontSize: '20px',
    });

    npcEditor.on('pointerdown', () => {
      window.dispatchEvent(new CustomEvent('arena:npc-editor'));
    });
  }
}
