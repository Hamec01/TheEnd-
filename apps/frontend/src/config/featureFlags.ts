const env = import.meta.env as Record<string, string | undefined>;

function flagEnabled(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return fallback;
}

export const featureFlags = {
  enableSpriteStudioAdmin: flagEnabled(env.VITE_ENABLE_SPRITE_STUDIO_ADMIN, true),
  enableSpriteRuntimeAssembly: flagEnabled(env.VITE_ENABLE_SPRITE_RUNTIME_ASSEMBLY, false),
} as const;

