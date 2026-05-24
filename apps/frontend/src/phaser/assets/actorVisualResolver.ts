export const DETERMINISTIC_BANDIT_CANDIDATES = [
  '/sprites/actor/bandit_01.png',
  '/sprites/actor/bandit_02.png',
  '/sprites/actor/bandit_03.png',
  '/sprites/actor/bandit_04.png',
  '/sprites/actor/bandit_05.png',
  '/sprites/actor/bandit_06.png',
] as const;

export function toContentImageRawUrl(imageId: string): string {
  return `/api/content/images/${encodeURIComponent(imageId)}/raw`;
}

export function isInvalidActorVisualToken(value: string | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (normalized === 'unknown' || normalized === 'none' || normalized === 'null') {
    return true;
  }

  return normalized.startsWith('/assets/placeholders/');
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function pickDeterministicBanditPortrait(entityId: string): string {
  const seed = entityId.trim() || 'bandit';
  const pick = hashSeed(seed) % DETERMINISTIC_BANDIT_CANDIDATES.length;
  return DETERMINISTIC_BANDIT_CANDIDATES[pick] ?? DETERMINISTIC_BANDIT_CANDIDATES[0];
}

export function normalizeActorVisualSource(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || isInvalidActorVisualToken(raw)) {
    return undefined;
  }

  if (raw.startsWith('/') || raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }

  const slashNormalized = raw.replace(/\\/g, '/');

  const actorPathMatch = slashNormalized.match(/(?:^|\/)Resurse\/actor\/([^/]+)$/i);
  if (actorPathMatch?.[1]) {
    return `/sprites/actor/${actorPathMatch[1]}`;
  }

  const banditShort = slashNormalized.match(/^bandit_(\d)$/i);
  if (banditShort) {
    return `/sprites/actor/bandit_0${banditShort[1]}.png`;
  }

  if (/^bandit_\d{2}$/i.test(slashNormalized)) {
    return `/sprites/actor/${slashNormalized}.png`;
  }

  if (/^img_[a-z0-9_\-]+$/i.test(slashNormalized)) {
    return toContentImageRawUrl(slashNormalized);
  }

  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(slashNormalized)) {
    return slashNormalized.startsWith('sprites/actor/')
      ? `/${slashNormalized}`
      : `/sprites/actor/${slashNormalized}`;
  }

  return `/sprites/actor/${slashNormalized}.png`;
}

export function resolveActorPortraitWithFallback(
  primary: string | undefined,
  options?: {
    entityId?: string;
    isBanditLike?: boolean;
    fallback?: string;
  },
): string {
  const normalized = normalizeActorVisualSource(primary);
  if (normalized) {
    return normalized;
  }

  if (options?.fallback) {
    const fallback = normalizeActorVisualSource(options.fallback);
    if (fallback) {
      return fallback;
    }
  }

  if (options?.isBanditLike) {
    return pickDeterministicBanditPortrait(options.entityId ?? 'bandit');
  }

  return '/sprites/actor/human_01.png';
}
