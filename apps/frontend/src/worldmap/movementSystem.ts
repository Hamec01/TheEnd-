import type { PlayerWorldState } from './types';

export interface MapPlayer {
  x: number;
  y: number;
  targetX: number | null;
  targetY: number | null;
  speed: number;
}

export interface MovementTickResult {
  player: MapPlayer;
  state: PlayerWorldState;
  reachedTarget: boolean;
}

export type MovementValidator = (x: number, y: number) => boolean;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function setPlayerTarget(player: MapPlayer, x: number, y: number): MapPlayer {
  return {
    ...player,
    targetX: clamp01(x),
    targetY: clamp01(y),
  };
}

export function tickPlayerMovement(player: MapPlayer, epsilon = 0.0012, canMoveTo?: MovementValidator): MovementTickResult {
  if (player.targetX === null || player.targetY === null) {
    return {
      player,
      state: 'idle',
      reachedTarget: false,
    };
  }

  const dx = player.targetX - player.x;
  const dy = player.targetY - player.y;
  const distance = Math.hypot(dx, dy);

  if (distance < epsilon) {
    return {
      player: {
        ...player,
        x: player.targetX,
        y: player.targetY,
        targetX: null,
        targetY: null,
      },
      state: 'idle',
      reachedTarget: true,
    };
  }

  const step = Math.min(player.speed, distance);
  const nextX = clamp01(player.x + (dx / distance) * step);
  const nextY = clamp01(player.y + (dy / distance) * step);

  if (canMoveTo && !canMoveTo(nextX, nextY)) {
    return {
      player: {
        ...player,
        targetX: null,
        targetY: null,
      },
      state: 'idle',
      reachedTarget: false,
    };
  }

  return {
    player: {
      ...player,
      x: nextX,
      y: nextY,
    },
    state: 'moving',
    reachedTarget: false,
  };
}
