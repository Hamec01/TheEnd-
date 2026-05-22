import { useCallback, useEffect, useRef, useState } from 'react';
import { setPlayerTarget, tickPlayerDirectionalMovement, tickPlayerMovement, type MapPlayer, type MovementSpeedMultiplierResolver, type MovementValidator } from './movementSystem';
import { detectCurrentZone, isInsideZone } from './zoneSystem';
import type { Zone } from './worldMapNodes';
import type { MovementControlScheme } from './playerMovementSettings';
import type { PlayerWorldState } from './types';
import type { WorldMapZone } from './zoneEditorTypes';

interface UseWorldRuntimeControllerOptions {
  enabled: boolean;
  initialPlayer: MapPlayer;
  playerStartPosition?: { x: number; y: number };
  defaultPlayerSpeed: number;
  playerSpeed?: number;
  gameplayPaused: boolean;
  movementLocked: boolean;
  controlScheme: MovementControlScheme;
  sprintActive: boolean;
  zones: WorldMapZone[];
  resolveCanMoveTo: MovementValidator;
  resolveSpeedMultiplier: MovementSpeedMultiplierResolver;
  playerTargetPosition?: { x: number; y: number } | null;
  playerTargetLocationId?: string | null;
  onPlayerPosition?: (x: number, y: number) => void;
  onPlayerState?: (state: PlayerWorldState) => void;
  onEnterZone?: (zone: Zone | null) => void;
  onOpenLocation?: (locationId: string) => void;
}

interface WorldRuntimeControllerHandle {
  player: MapPlayer;
  currentZone: WorldMapZone | null;
  moveToPoint: (point: { x: number; y: number }, pendingLocationId?: string | null) => void;
  clearMovementTarget: () => void;
}

export function resolveWorldRuntimeReportedState(
  movementState: PlayerWorldState,
  zone: Pick<WorldMapZone, 'type'> | null,
): PlayerWorldState {
  if (movementState === 'moving') {
    return 'moving';
  }
  if (zone?.type === 'city') {
    return 'in_city';
  }
  if (zone) {
    return 'in_zone';
  }
  return 'idle';
}

export function shouldOpenPendingWorldLocation(
  pendingLocationId: string | null,
  currentZone: WorldMapZone | null,
  player: Pick<MapPlayer, 'x' | 'y' | 'targetX' | 'targetY'>,
): boolean {
  if (!pendingLocationId || currentZone?.id !== pendingLocationId || player.targetX !== null || player.targetY !== null) {
    return false;
  }
  if (!currentZone || !isInsideZone(currentZone, player.x, player.y, 0)) {
    return false;
  }
  return true;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable || target.closest('[contenteditable="true"]') !== null;
}

export function useWorldRuntimeController(options: UseWorldRuntimeControllerOptions): WorldRuntimeControllerHandle {
  const {
    enabled,
    initialPlayer,
    playerStartPosition,
    defaultPlayerSpeed,
    playerSpeed,
    gameplayPaused,
    movementLocked,
    controlScheme,
    sprintActive,
    zones,
    resolveCanMoveTo,
    resolveSpeedMultiplier,
    playerTargetPosition,
    playerTargetLocationId,
    onPlayerPosition,
    onPlayerState,
    onEnterZone,
    onOpenLocation,
  } = options;

  const movementKeysRef = useRef({ up: false, down: false, left: false, right: false });
  const playerStateRef = useRef<PlayerWorldState>('idle');
  const prevZoneRef = useRef<WorldMapZone | null>(null);
  const pendingCityEntryRef = useRef<string | null>(null);
  const [player, setPlayer] = useState<MapPlayer>(initialPlayer);
  const [currentZone, setCurrentZone] = useState<WorldMapZone | null>(null);

  const resolveReportedState = useCallback((zone: WorldMapZone | null): PlayerWorldState => {
    return resolveWorldRuntimeReportedState(playerStateRef.current, zone);
  }, []);

  const clearMovementTarget = useCallback(() => {
    pendingCityEntryRef.current = null;
    setPlayer((prev) => (
      prev.targetX === null && prev.targetY === null
        ? prev
        : { ...prev, targetX: null, targetY: null }
    ));
  }, []);

  const moveToPoint = useCallback((point: { x: number; y: number }, pendingLocationId?: string | null) => {
    pendingCityEntryRef.current = pendingLocationId ?? null;
    setPlayer((prev) => {
      const nextTargetX = clamp01(point.x);
      const nextTargetY = clamp01(point.y);
      const sameTarget = prev.targetX !== null
        && prev.targetY !== null
        && Math.abs(prev.targetX - nextTargetX) < 0.0005
        && Math.abs(prev.targetY - nextTargetY) < 0.0005;

      if (sameTarget) {
        return prev;
      }

      return setPlayerTarget(prev, nextTargetX, nextTargetY);
    });
  }, []);

  useEffect(() => {
    if (!enabled || !playerStartPosition) {
      return;
    }

    setPlayer((prev) => {
      const nextX = clamp01(playerStartPosition.x);
      const nextY = clamp01(playerStartPosition.y);
      if (Math.abs(prev.x - nextX) < 0.0005 && Math.abs(prev.y - nextY) < 0.0005) {
        return prev;
      }

      return {
        ...prev,
        x: nextX,
        y: nextY,
        targetX: null,
        targetY: null,
      };
    });
  }, [enabled, playerStartPosition?.x, playerStartPosition?.y]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const nextSpeed = playerSpeed ?? defaultPlayerSpeed;
    setPlayer((prev) => (prev.speed === nextSpeed ? prev : { ...prev, speed: nextSpeed }));
  }, [defaultPlayerSpeed, enabled, playerSpeed]);

  useEffect(() => {
    if (!enabled || !playerTargetPosition || movementLocked) {
      return;
    }

    moveToPoint(playerTargetPosition, playerTargetLocationId ?? null);
  }, [enabled, moveToPoint, movementLocked, playerTargetLocationId, playerTargetPosition?.x, playerTargetPosition?.y]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let frameId = 0;

    const animate = () => {
      setPlayer((prev) => {
        if (gameplayPaused || movementLocked) {
          playerStateRef.current = 'idle';
          return prev.targetX === null && prev.targetY === null
            ? prev
            : { ...prev, targetX: null, targetY: null };
        }

        const inputX = (movementKeysRef.current.right ? 1 : 0) - (movementKeysRef.current.left ? 1 : 0);
        const inputY = (movementKeysRef.current.down ? 1 : 0) - (movementKeysRef.current.up ? 1 : 0);
        const effectiveSpeed = (playerSpeed ?? prev.speed) * (sprintActive ? 1.45 : 1);
        const nextPlayer = prev.speed === effectiveSpeed ? prev : { ...prev, speed: effectiveSpeed };
        const tick = (inputX !== 0 || inputY !== 0)
          ? tickPlayerDirectionalMovement(nextPlayer, inputX, inputY, resolveCanMoveTo, resolveSpeedMultiplier)
          : tickPlayerMovement(nextPlayer, 0.0012, resolveCanMoveTo, resolveSpeedMultiplier);

        playerStateRef.current = tick.state;
        setCurrentZone(detectCurrentZone(zones as Zone[], tick.player.x, tick.player.y) as WorldMapZone | null);
        return tick.player;
      });

      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [enabled, gameplayPaused, movementLocked, playerSpeed, resolveCanMoveTo, resolveSpeedMultiplier, sprintActive, zones]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    onPlayerPosition?.(player.x, player.y);
  }, [enabled, onPlayerPosition, player.x, player.y]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    onPlayerState?.(resolveReportedState(currentZone));
  }, [currentZone, enabled, onPlayerState, player.x, player.y, resolveReportedState]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (currentZone?.id !== prevZoneRef.current?.id) {
      prevZoneRef.current = currentZone;
      onEnterZone?.(currentZone as Zone | null);
    }
  }, [currentZone, enabled, onEnterZone]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const pendingCityId = pendingCityEntryRef.current;
    if (!pendingCityId) {
      return;
    }

    if (!shouldOpenPendingWorldLocation(pendingCityId, currentZone, player)) {
      return;
    }

    pendingCityEntryRef.current = null;
    onOpenLocation?.(pendingCityId);
  }, [currentZone, enabled, onOpenLocation, player.targetX, player.targetY, player.x, player.y]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const matchesMovementKey = (key: string) => {
      const normalized = key.toLowerCase();
      if (controlScheme === 'wasd') {
        if (normalized === 'w') return 'up';
        if (normalized === 's') return 'down';
        if (normalized === 'a') return 'left';
        if (normalized === 'd') return 'right';
        return null;
      }

      if (key === 'ArrowUp') return 'up';
      if (key === 'ArrowDown') return 'down';
      if (key === 'ArrowLeft') return 'left';
      if (key === 'ArrowRight') return 'right';
      return null;
    };

    const reportNonMovingState = () => {
      playerStateRef.current = 'idle';
      onPlayerState?.(resolveReportedState(currentZone));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (movementLocked || isTextEditingTarget(event.target)) {
        return;
      }

      const direction = matchesMovementKey(event.key);
      if (!direction) {
        return;
      }

      event.preventDefault();
      movementKeysRef.current[direction] = true;
      pendingCityEntryRef.current = null;
      setPlayer((prev) => ({ ...prev, targetX: null, targetY: null }));
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const direction = matchesMovementKey(event.key);
      if (!direction) {
        return;
      }

      event.preventDefault();
      movementKeysRef.current[direction] = false;

      const anyMovementKeyStillPressed = movementKeysRef.current.up
        || movementKeysRef.current.down
        || movementKeysRef.current.left
        || movementKeysRef.current.right;
      if (!anyMovementKeyStillPressed) {
        reportNonMovingState();
      }
    };

    const handleBlur = () => {
      movementKeysRef.current = { up: false, down: false, left: false, right: false };
      reportNonMovingState();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [controlScheme, currentZone, enabled, movementLocked, onPlayerState, resolveReportedState]);

  return {
    player,
    currentZone,
    moveToPoint,
    clearMovementTarget,
  };
}