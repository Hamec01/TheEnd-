import { resolveStoredImageSource } from '../services/content/runtimeImageService';
import type { StoredImage } from '../services/content/models';
import type { NpcDefinition } from '../types/npc';
import type { WorldSimulationSnapshot } from '../types/world-simulation.types';
import {
  isInvalidActorVisualToken,
  normalizeActorVisualSource,
  pickDeterministicBanditPortrait,
  toContentImageRawUrl,
} from '../phaser/assets/actorVisualResolver';
import type { RenderedWorldEntity } from './worldSceneTypes';

type ActiveWorldEntity = WorldSimulationSnapshot['activeEntities'][number];

function isMeaningfulPortraitId(value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && normalized !== 'unknown' && normalized !== 'none' && normalized !== 'null');
}

function isDirectImageSource(value: string): boolean {
  return value.startsWith('/')
    || value.startsWith('data:')
    || value.startsWith('http://')
    || value.startsWith('https://');
}

function shouldResolveAsActorSprite(value: string): boolean {
  const slashNormalized = value.replace(/\\/g, '/');
  if (/(?:^|\/)Resurse\/actor\//i.test(slashNormalized)) {
    return true;
  }

  if (/^bandit_\d{1,2}$/i.test(slashNormalized)) {
    return true;
  }

  return /^(human_01|dwarf_01|high_elf_01|drogan|mirel|selene)(\.(png|jpg|jpeg|webp|gif))?$/i.test(slashNormalized);
}

function resolveSpriteSource(spriteId: string | undefined, runtimeImages: StoredImage[]): string | undefined {
  const normalized = spriteId?.trim();
  if (!normalized || isInvalidActorVisualToken(normalized)) {
    return undefined;
  }

  const runtimeSprite = resolveStoredImageSource(normalized, runtimeImages);
  if (runtimeSprite) {
    return runtimeSprite;
  }

  if (/^img_[a-z0-9_\-]+$/i.test(normalized)) {
    return toContentImageRawUrl(normalized);
  }

  if (isDirectImageSource(normalized)) {
    return normalized;
  }

  if (shouldResolveAsActorSprite(normalized)) {
    return normalizeActorVisualSource(normalized);
  }

  const slashNormalized = normalized.replace(/\\/g, '/');
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(slashNormalized)
    ? `/sprites/world/${slashNormalized}`
    : `/sprites/world/${slashNormalized}.png`;
}

function resolvePortraitSource(
  portraitId: string | undefined,
  npc: NpcDefinition | undefined,
  runtimeImages: StoredImage[],
): string | undefined {
  if (isMeaningfulPortraitId(portraitId)) {
    const normalized = portraitId!.trim();
    const runtimePortrait = resolveStoredImageSource(normalized, runtimeImages);
    if (runtimePortrait) {
      return runtimePortrait;
    }

    return normalizeActorVisualSource(normalized);
  }

  if (!npc) {
    return undefined;
  }

  const candidates = [npc.fullImageUrl, npc.portraitUrl, npc.iconUrl]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const resolved = resolveStoredImageSource(candidate, runtimeImages) ?? normalizeActorVisualSource(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

export function resolveRenderedWorldEntities(
  entities: ActiveWorldEntity[],
  runtimeImages: StoredImage[],
  npcs: NpcDefinition[],
): RenderedWorldEntity[] {
  const npcById = new Map<string, NpcDefinition>();
  for (const npc of npcs) {
    npcById.set(npc.id, npc);
  }

  return entities.map((entity) => {
    const npc = entity.npcTemplateId ? npcById.get(entity.npcTemplateId) : undefined;
    const spriteSrc = resolveSpriteSource(entity.spriteId, runtimeImages);
    const portraitSrc = resolvePortraitSource(entity.portraitId, npc, runtimeImages);
    const isBanditLike = entity.isHostile || entity.kind === 'bandit';
    const finalPortraitSrc = portraitSrc
      ?? (isBanditLike ? pickDeterministicBanditPortrait(entity.id) : undefined);
    const shouldPreferSprite = entity.kind === 'merchant' && Boolean(spriteSrc);

    const renderMode = shouldPreferSprite
      ? 'sprite'
      : finalPortraitSrc
        ? 'portrait'
        : spriteSrc
          ? 'sprite'
          : 'fallback';

    const label = npc?.name?.trim() || entity.archetypeId || entity.id;
    const title = `${label} (${entity.state})`;
    const imageSrc = renderMode === 'portrait'
      ? (finalPortraitSrc ?? spriteSrc)
      : (spriteSrc ?? finalPortraitSrc);

    return {
      id: entity.id,
      archetypeId: entity.archetypeId,
      kind: entity.kind,
      state: entity.state,
      coordinates: entity.coordinates,
      spriteId: entity.spriteId,
      spriteSrc,
      portraitSrc: finalPortraitSrc,
      imageSrc,
      renderMode,
      isHostile: entity.isHostile,
      hasQuest: entity.hasQuest,
      memberCount: entity.memberCount,
      label,
      title,
    };
  });
}
