import { resolveStoredImageSource } from '../services/content/runtimeImageService';
import type { StoredImage } from '../services/content/models';
import type { NpcDefinition } from '../types/npc';
import type { WorldSimulationSnapshot } from '../types/world-simulation.types';
import type { RenderedWorldEntity } from './worldSceneTypes';

type ActiveWorldEntity = WorldSimulationSnapshot['activeEntities'][number];

function isMeaningfulPortraitId(value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && normalized !== 'unknown' && normalized !== 'none' && normalized !== 'null');
}

function resolveSpriteSource(spriteId: string | undefined, runtimeImages: StoredImage[]): string | undefined {
  const normalized = spriteId?.trim();
  if (!normalized) {
    return undefined;
  }

  const runtimeSprite = resolveStoredImageSource(normalized, runtimeImages);
  if (runtimeSprite) {
    return runtimeSprite;
  }

  return normalized.startsWith('/') ? normalized : `/sprites/world/${normalized}.png`;
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

    if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('data:') || normalized.startsWith('/')) {
      return normalized;
    }

    return normalized.includes('.') ? `/sprites/actor/${normalized}` : `/sprites/actor/${normalized}.png`;
  }

  if (!npc) {
    return undefined;
  }

  const candidates = [npc.fullImageUrl, npc.portraitUrl, npc.iconUrl]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const resolved = resolveStoredImageSource(candidate, runtimeImages) ?? candidate;
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

    const renderMode = entity.kind === 'merchant' && spriteSrc
      ? 'sprite'
      : portraitSrc
        ? 'portrait'
        : spriteSrc
          ? 'sprite'
          : 'fallback';

    const label = npc?.name?.trim() || entity.archetypeId || entity.id;
    const title = `${label} (${entity.state})`;
    const imageSrc = renderMode === 'portrait'
      ? (portraitSrc ?? spriteSrc)
      : (spriteSrc ?? portraitSrc);

    return {
      id: entity.id,
      archetypeId: entity.archetypeId,
      kind: entity.kind,
      state: entity.state,
      coordinates: entity.coordinates,
      spriteId: entity.spriteId,
      spriteSrc,
      portraitSrc,
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