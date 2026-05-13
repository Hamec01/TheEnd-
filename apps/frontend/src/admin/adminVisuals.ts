import type { StoredImage } from '../services/content/models';

export function isDirectAdminImageSource(value: string | null | undefined): boolean {
  const normalized = value?.trim() ?? '';
  return normalized.startsWith('data:')
    || normalized.startsWith('/')
    || normalized.startsWith('http://')
    || normalized.startsWith('https://');
}

export function resolveAdminImageSource(value: string | null | undefined, images: StoredImage[]): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  if (isDirectAdminImageSource(normalized)) {
    return normalized;
  }
  return images.find((image) => image.id === normalized)?.dataUrl;
}

export function getNpcPreviewImageKey(npc: {
  portraitUrl?: string | null;
  fullImageUrl?: string | null;
  combatImageUrl?: string | null;
  iconUrl?: string | null;
} | null | undefined): string | undefined {
  return npc?.portraitUrl?.trim()
    || npc?.fullImageUrl?.trim()
    || npc?.combatImageUrl?.trim()
    || npc?.iconUrl?.trim()
    || undefined;
}

export function getAdminInitials(label: string | null | undefined, fallback = '?'): string {
  const normalized = label?.trim();
  if (!normalized) {
    return fallback;
  }
  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}
