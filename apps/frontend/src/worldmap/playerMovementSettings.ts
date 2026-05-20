export type MovementControlScheme = 'arrows' | 'wasd';

export const PLAYER_MOVEMENT_CONTROL_SCHEME_KEY = 'theend.worldMap.controlScheme';
export const PLAYER_MOVEMENT_CONTROL_SCHEME_EVENT = 'theend:worldMapControlSchemeChanged';

function isControlScheme(value: unknown): value is MovementControlScheme {
  return value === 'arrows' || value === 'wasd';
}

export function loadMovementControlScheme(): MovementControlScheme {
  if (typeof window === 'undefined') {
    return 'arrows';
  }

  const raw = window.localStorage.getItem(PLAYER_MOVEMENT_CONTROL_SCHEME_KEY);
  return isControlScheme(raw) ? raw : 'arrows';
}

export function saveMovementControlScheme(value: MovementControlScheme): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PLAYER_MOVEMENT_CONTROL_SCHEME_KEY, value);
  window.dispatchEvent(new CustomEvent<MovementControlScheme>(PLAYER_MOVEMENT_CONTROL_SCHEME_EVENT, {
    detail: value,
  }));
}
