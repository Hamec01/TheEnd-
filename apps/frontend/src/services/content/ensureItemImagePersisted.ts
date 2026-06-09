import type { GameImageRef, StoredImage } from './models';
import { normalizeGameImageRef, toLegacyImagePath } from './gameImageRefs';
import { materializeTilesetFrameToPreset } from './materializeTilesetFrame';
import { buildUploadFolder } from './uploadFolders';

export async function ensureItemImagePersisted(
  imageRef: GameImageRef | null | undefined,
  legacyImagePath: string | null | undefined,
  options: {
    entityId: string;
    entityKind: 'materials' | 'items';
    runtimeImages?: StoredImage[];
  },
): Promise<{ imageRef?: GameImageRef; imagePath?: string }> {
  const normalized = normalizeGameImageRef(imageRef, legacyImagePath);
  if (!normalized) {
    return {};
  }

  if (normalized.type === 'image') {
    return {
      imageRef: normalized,
      imagePath: toLegacyImagePath(normalized),
    };
  }

  const materialized = await materializeTilesetFrameToPreset(normalized, {
    presetId: 'item-icon',
    runtimeImages: options.runtimeImages,
    folder: buildUploadFolder('images', options.entityKind, options.entityId),
    id: options.entityId,
    name: `${options.entityId}-icon`,
  });

  if (!materialized) {
    return {
      imageRef: normalized,
      imagePath: legacyImagePath ?? undefined,
    };
  }

  const persistedSrc = materialized.dataUrl?.trim() || materialized.imageId;
  const nextRef: GameImageRef = { type: 'image', src: persistedSrc };
  return {
    imageRef: nextRef,
    imagePath: toLegacyImagePath(nextRef),
  };
}
