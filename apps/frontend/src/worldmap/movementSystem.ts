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
  cancelledReason?: 'blocked';
}

export type MovementValidator = (x: number, y: number) => boolean;
export type MovementSpeedMultiplierResolver = (x: number, y: number) => number;

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

export function tickPlayerMovement(
  player: MapPlayer,
  epsilon = 0.0012,
  canMoveTo?: MovementValidator,
  getSpeedMultiplier?: MovementSpeedMultiplierResolver,
): MovementTickResult {
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

  const multiplierRaw = getSpeedMultiplier ? getSpeedMultiplier(player.x, player.y) : 1;
  const speedMultiplier = Number.isFinite(multiplierRaw) ? Math.max(0.15, Math.min(2, multiplierRaw)) : 1;
  const step = Math.min(player.speed * speedMultiplier, distance);
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
      cancelledReason: 'blocked',
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

export function tickPlayerDirectionalMovement(
  player: MapPlayer,
  axisX: number,
  axisY: number,
  canMoveTo?: MovementValidator,
  getSpeedMultiplier?: MovementSpeedMultiplierResolver,
): MovementTickResult {
  const distance = Math.hypot(axisX, axisY);
  if (distance <= 0.0001) {
    return {
      player: {
        ...player,
        targetX: null,
        targetY: null,
      },
      state: 'idle',
      reachedTarget: false,
      cancelledReason: 'blocked',
    };
  }

  const normalizedX = axisX / distance;
  const normalizedY = axisY / distance;
  const multiplierRaw = getSpeedMultiplier ? getSpeedMultiplier(player.x, player.y) : 1;
  const speedMultiplier = Number.isFinite(multiplierRaw) ? Math.max(0.15, Math.min(2, multiplierRaw)) : 1;
  const step = player.speed * speedMultiplier;
  const nextX = clamp01(player.x + normalizedX * step);
  const nextY = clamp01(player.y + normalizedY * step);

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
      targetX: null,
      targetY: null,
    },
    state: 'moving',
    reachedTarget: false,
  };
}
