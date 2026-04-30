import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { ArenaScene } from './ArenaScene';

export function ArenaCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: 720,
      height: 280,
      parent: hostRef.current,
      scene: [ArenaScene],
      backgroundColor: '#1c150f',
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div className="arena-canvas" ref={hostRef} />;
}
