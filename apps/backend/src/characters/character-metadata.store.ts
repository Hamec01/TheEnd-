import type { PrismaService } from '../prisma/prisma.service';
import { isFileStorageMode } from '../config/storage-mode';
import { RuntimeCharacterStore } from './runtime-character-store';
import {
  DEFAULT_KINGDOM_REPUTATION,
  type CharacterCitizenshipState,
  type KingdomId,
} from '@theend/rpg-domain';

const STORE_KEY = 'character-metadata-v1';

export interface CharacterMetadata extends CharacterCitizenshipState {
  startingProfessionIds: string[];
  startingSkillIds: string[];
}

const DEFAULT_METADATA: CharacterMetadata = {
  citizenshipKingdomId: null,
  kingdomReputation: { ...DEFAULT_KINGDOM_REPUTATION },
  startingProfessionIds: [],
  startingSkillIds: [],
};

function normalizeMetadata(raw: unknown): CharacterMetadata {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_METADATA, kingdomReputation: { ...DEFAULT_KINGDOM_REPUTATION } };
  }
  const rec = raw as Record<string, unknown>;
  const kingdomReputationRaw = rec.kingdomReputation;
  const kingdomReputation = { ...DEFAULT_KINGDOM_REPUTATION };
  if (kingdomReputationRaw && typeof kingdomReputationRaw === 'object' && !Array.isArray(kingdomReputationRaw)) {
    for (const kingdomId of Object.keys(DEFAULT_KINGDOM_REPUTATION) as KingdomId[]) {
      const value = Number((kingdomReputationRaw as Record<string, unknown>)[kingdomId] ?? 0);
      kingdomReputation[kingdomId] = Number.isFinite(value) ? Math.trunc(value) : 0;
    }
  }
  return {
    citizenshipKingdomId: typeof rec.citizenshipKingdomId === 'string' ? rec.citizenshipKingdomId as KingdomId : null,
    kingdomReputation,
    startingProfessionIds: Array.isArray(rec.startingProfessionIds)
      ? rec.startingProfessionIds.map((entry) => String(entry)).filter(Boolean)
      : [],
    startingSkillIds: Array.isArray(rec.startingSkillIds)
      ? rec.startingSkillIds.map((entry) => String(entry)).filter(Boolean)
      : [],
  };
}

export class CharacterMetadataStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeStore: RuntimeCharacterStore,
  ) {}

  async get(characterId: string): Promise<CharacterMetadata> {
    if (isFileStorageMode()) {
      const character = await this.runtimeStore.getCharacterById(characterId);
      return normalizeMetadata(character);
    }

    const row = await this.prisma.contentStore.findUnique({ where: { key: STORE_KEY } });
    const map = row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
      ? row.value as Record<string, unknown>
      : {};
    return normalizeMetadata(map[characterId]);
  }

  async set(characterId: string, metadata: CharacterMetadata): Promise<CharacterMetadata> {
    const normalized = normalizeMetadata(metadata);
    if (isFileStorageMode()) {
      await this.runtimeStore.updateCharacter(characterId, normalized as unknown as Record<string, unknown>);
      return normalized;
    }

    const row = await this.prisma.contentStore.findUnique({ where: { key: STORE_KEY } });
    const map = row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
      ? { ...(row.value as Record<string, unknown>) }
      : {};
    map[characterId] = normalized as unknown as Record<string, unknown>;
    await this.prisma.contentStore.upsert({
      where: { key: STORE_KEY },
      create: { key: STORE_KEY, value: map as any },
      update: { value: map as any },
    });
    return normalized;
  }
}
