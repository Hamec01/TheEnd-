import type { ItemDefinition } from '@theend/rpg-domain';
import { imageService } from './imageService';
import type { AdminMerchant, StoredImage } from './models';

function isDirectImageSource(value: string): boolean {
  return value.startsWith('data:') || value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
}

export async function loadRuntimeImages(): Promise<StoredImage[]> {
  return imageService.getAll();
}

export function resolveStoredImageSource(imageKey: string | undefined, images: StoredImage[]): string | undefined {
  const normalized = imageKey?.trim();
  if (!normalized) {
    return undefined;
  }

  if (isDirectImageSource(normalized)) {
    return normalized;
  }

  const stored = images.find((image) => image.id === normalized);
  return stored?.dataUrl;
}

export function resolveItemImageSource(item: ItemDefinition | null | undefined, images: StoredImage[]): string | undefined {
  if (!item) {
    return undefined;
  }

  return resolveStoredImageSource(item.icon, images);
}

export function resolveMerchantImageSource(merchant: AdminMerchant | null | undefined, images: StoredImage[]): string | undefined {
  if (!merchant) {
    return undefined;
  }

  return resolveStoredImageSource(merchant.portraitPath, images);
}
