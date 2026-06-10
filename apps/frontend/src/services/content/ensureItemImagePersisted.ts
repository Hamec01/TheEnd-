import type { ProfessionSkill } from '../../types/profession';
import type { GameImageRef, StoredImage } from './models';
import { normalizeGameImageRef, toLegacyImagePath } from './gameImageRefs';
import { materializeTilesetFrameToPreset } from './materializeTilesetFrame';
import { buildUploadFolder } from './uploadFolders';

export function withUploadCacheBuster(src: string, updatedAt?: string): string {
  const normalized = src.trim();
  if (!normalized.startsWith('/assets/upload/') || !updatedAt?.trim()) {
    return normalized;
  }
  const stamp = encodeURIComponent(updatedAt.trim());
  return `${normalized}${normalized.includes('?') ? '&' : '?'}v=${stamp}`;
}

function resolvePersistedImageSrc(materialized: { imageId: string; dataUrl?: string }): string {
  const dataUrl = materialized.dataUrl?.trim();
  if (dataUrl?.startsWith('/assets/upload/')) {
    return dataUrl;
  }
  return materialized.imageId;
}

function stripCacheBuster(path: string): string {
  return path.trim().split('?')[0] ?? '';
}

function isLegacyCarpentryAutoIconPath(path: string, skillId: string): boolean {
  const normalized = stripCacheBuster(path);
  if (!normalized) {
    return false;
  }
  return normalized.endsWith(`${skillId}-icon-${skillId}-icon.png`);
}

function carpentrySkillIconAssetName(skillId: string): string {
  return `${skillId}-custom-icon`;
}

export function clearLegacyCarpentryAutoIconForEdit(skill: ProfessionSkill): ProfessionSkill {
  if (skill.professionId !== 'carpenter') {
    return skill;
  }
  const iconPath = stripCacheBuster(String(skill.icon ?? ''));
  const refPath = skill.iconImageRef?.type === 'image'
    ? stripCacheBuster(String(skill.iconImageRef.src ?? ''))
    : '';
  if (!isLegacyCarpentryAutoIconPath(iconPath, skill.id) && !isLegacyCarpentryAutoIconPath(refPath, skill.id)) {
    return skill;
  }
  return {
    ...skill,
    icon: undefined,
    iconImageRef: undefined,
  };
}

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

  const persistedSrc = withUploadCacheBuster(
    resolvePersistedImageSrc(materialized),
    materialized.updatedAt,
  );
  const nextRef: GameImageRef = { type: 'image', src: persistedSrc };
  return {
    imageRef: nextRef,
    imagePath: toLegacyImagePath(nextRef),
  };
}

export async function ensureProfessionSkillIconPersisted(
  imageRef: GameImageRef | null | undefined,
  legacyImagePath: string | null | undefined,
  options: {
    skillId: string;
    runtimeImages?: StoredImage[];
  },
): Promise<{ icon?: string; iconImageRef?: GameImageRef }> {
  const skillId = options.skillId.trim();
  if (!skillId) {
    return {};
  }

  const normalized = normalizeGameImageRef(imageRef, legacyImagePath);
  if (!normalized) {
    return {};
  }

  if (normalized.type === 'image') {
    const src = normalized.src.trim();
    if (isLegacyCarpentryAutoIconPath(src, skillId)) {
      return {};
    }
    if (src.startsWith('/assets/upload/') || src) {
      return {
        icon: toLegacyImagePath(normalized),
        iconImageRef: normalized,
      };
    }
    return {};
  }

  const materialized = await materializeTilesetFrameToPreset(normalized, {
    presetId: 'item-icon',
    runtimeImages: options.runtimeImages,
    folder: buildUploadFolder('images', 'skills', skillId),
    id: `${skillId}-icon`,
    name: carpentrySkillIconAssetName(skillId),
  });

  if (!materialized) {
    return {
      icon: legacyImagePath ?? undefined,
      iconImageRef: normalized,
    };
  }

  const persistedSrc = withUploadCacheBuster(
    resolvePersistedImageSrc(materialized),
    materialized.updatedAt,
  );
  const nextRef: GameImageRef = { type: 'image', src: persistedSrc };
  return {
    icon: toLegacyImagePath(nextRef),
    iconImageRef: nextRef,
  };
}
