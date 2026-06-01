import type {
  MineBlockPayload,
  MineBlockTable,
  MineDefinition,
  MineDepth,
  MineHazard,
  MineHazardTable,
  MineLootTable,
  MiningToolDefinition,
  MiningContentBundle,
} from '../types/mining';
import { fixMojibake } from '../utils/fixMojibake';
import { normalizeGameImageRef, toLegacyImagePath } from './content/gameImageRefs';

const MINING_STORAGE_KEYS = {
  mines: 'theend.mining.mines',
  depths: 'theend.mining.depths',
  blockTables: 'theend.mining.blockTables',
  hazards: 'theend.mining.hazards',
  hazardTables: 'theend.mining.hazardTables',
  lootTables: 'theend.mining.lootTables',
  tools: 'theend.mining.tools',
  seeded: 'theend.mining.seeded.v2',
} as const;

export const MINING_MINE_STORAGE_KEY = MINING_STORAGE_KEYS.mines;

const DEFAULT_MINING_FALLBACK = defaultMiningContent();
const DEFAULT_MINE_BY_ID = new Map(DEFAULT_MINING_FALLBACK.mines.map((entry) => [entry.id, entry]));
const DEFAULT_DEPTH_BY_ID = new Map(DEFAULT_MINING_FALLBACK.depths.map((entry) => [entry.id, entry]));
const DEFAULT_BLOCK_TABLE_BY_ID = new Map(DEFAULT_MINING_FALLBACK.blockTables.map((entry) => [entry.id, entry]));
const DEFAULT_HAZARD_BY_ID = new Map(DEFAULT_MINING_FALLBACK.hazards.map((entry) => [entry.id, entry]));
const DEFAULT_HAZARD_TABLE_BY_ID = new Map(DEFAULT_MINING_FALLBACK.hazardTables.map((entry) => [entry.id, entry]));
const DEFAULT_LOOT_TABLE_BY_ID = new Map(DEFAULT_MINING_FALLBACK.lootTables.map((entry) => [entry.id, entry]));
const DEFAULT_TOOL_BY_ID = new Map((DEFAULT_MINING_FALLBACK.tools ?? []).map((entry) => [entry.id, entry]));

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function mergeById<T extends { id: string }>(current: T[], defaults: T[]): T[] {
  const seen = new Set(current.map((entry) => entry.id));
  return [...current, ...defaults.filter((entry) => !seen.has(entry.id))];
}

function readArray<T>(key: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeMine(raw: unknown): MineDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (!id || !name) {
    return null;
  }

  const dangerLevel = row.dangerLevel;
  const visualTheme = row.visualTheme;
  if (
    dangerLevel !== 'low'
    && dangerLevel !== 'medium'
    && dangerLevel !== 'high'
    && dangerLevel !== 'deadly'
  ) {
    return null;
  }
  if (
    visualTheme !== 'teramor_stone'
    && visualTheme !== 'coal'
    && visualTheme !== 'zeptyrite'
    && visualTheme !== 'lava'
    && visualTheme !== 'ice'
    && visualTheme !== 'shadow'
    && visualTheme !== 'crystal'
  ) {
    return null;
  }

  const fallback = DEFAULT_MINE_BY_ID.get(id);

  return {
    id,
    name: fixMojibake(name, fallback?.name),
    description: fixMojibake(String(row.description ?? '').trim(), fallback?.description),
    shortDescription: fixMojibake(String(row.shortDescription ?? '').trim(), fallback?.shortDescription) || undefined,
    requiredProfessionId: 'mining',
    requiredMiningLevel: Math.max(1, Math.floor(Number(row.requiredMiningLevel ?? 1))),
    dangerLevel,
    visualTheme,
    region: fixMojibake(String(row.region ?? '').trim(), fallback?.region) || undefined,
    locationId: firstNonEmpty(row.locationId as string | undefined, fallback?.locationId),
    backgroundImageAssetId: firstNonEmpty(row.backgroundImageAssetId as string | undefined, fallback?.backgroundImageAssetId),
    backgroundImageUrl: firstNonEmpty(row.backgroundImageUrl as string | undefined, fallback?.backgroundImageUrl),
    depthIds: Array.isArray(row.depthIds) ? row.depthIds.map((entry) => String(entry ?? '').trim()).filter(Boolean) : [],
    knownResources: Array.isArray(row.knownResources)
      ? row.knownResources
        .map((entry, index) => fixMojibake(String(entry ?? '').trim(), fallback?.knownResources?.[index]))
        .filter(Boolean)
      : (fallback?.knownResources ?? []),
    knownResourceItemIds: Array.isArray(row.knownResourceItemIds)
      ? row.knownResourceItemIds.map((entry) => String(entry ?? '').trim()).filter(Boolean)
      : (fallback?.knownResourceItemIds ?? []),
    knownMaterialIds: Array.isArray(row.knownMaterialIds)
      ? row.knownMaterialIds.map((entry) => String(entry ?? '').trim()).filter(Boolean)
      : (fallback?.knownMaterialIds ?? []),
    entryText: fixMojibake(String(row.entryText ?? '').trim(), fallback?.entryText) || undefined,
    isEnabled: row.isEnabled !== false,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
  };
}

function normalizeDepth(raw: unknown): MineDepth | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const mineId = String(row.mineId ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (!id || !mineId || !name) {
    return null;
  }

  const fallback = DEFAULT_DEPTH_BY_ID.get(id);
  const blockSpriteFallback = firstNonEmpty(row.blockSpriteUrl as string | undefined, row.blockSpriteAssetId as string | undefined, fallback?.blockSpriteUrl, fallback?.blockSpriteAssetId);
  const blockCrackSpriteFallback = firstNonEmpty(row.blockCrackSpriteUrl as string | undefined, row.blockCrackSpriteAssetId as string | undefined, fallback?.blockCrackSpriteUrl, fallback?.blockCrackSpriteAssetId);
  const particleTextureFallback = firstNonEmpty(row.particleTextureUrl as string | undefined, row.particleTextureAssetId as string | undefined, fallback?.particleTextureUrl, fallback?.particleTextureAssetId);
  const normalizedBlockSpriteRef = normalizeGameImageRef(
    row.blockSpriteRef,
    blockSpriteFallback,
  );
  const normalizedCrackSpriteRef = normalizeGameImageRef(
    row.blockCrackSpriteRef,
    blockCrackSpriteFallback,
  );
  const normalizedParticleTextureRef = normalizeGameImageRef(
    row.particleTextureRef,
    particleTextureFallback,
  );

  return {
    id,
    mineId,
    depthLevel: Math.max(1, Math.floor(Number(row.depthLevel ?? 1))),
    name: fixMojibake(name, fallback?.name),
    description: fixMojibake(String(row.description ?? '').trim(), fallback?.description) || undefined,
    rows: Math.max(1, Math.floor(Number(row.rows ?? 4))),
    columns: Math.max(1, Math.floor(Number(row.columns ?? 4))),
    baseHits: Math.max(1, Math.floor(Number(row.baseHits ?? 10))),
    staminaCostPerHit: Math.max(0, Math.floor(Number(row.staminaCostPerHit ?? 1))),
    baseCollapseRisk: Math.max(0, Number(row.baseCollapseRisk ?? 0)),
    riskIncreasePerHit: Math.max(0, Number(row.riskIncreasePerHit ?? 0)),
    lootTableId: String(row.lootTableId ?? '').trim(),
    blockTableId: String(row.blockTableId ?? '').trim(),
    hazardTableId: String(row.hazardTableId ?? '').trim(),
    guaranteedExit: row.guaranteedExit !== false,
    canSpawnPassage: row.canSpawnPassage !== false,
    isFinalDepth: row.isFinalDepth === true,
    requiredMiningLevel: Math.max(1, Math.floor(Number(row.requiredMiningLevel ?? 1))),
    backgroundImage: fixMojibake(String(row.backgroundImage ?? '').trim(), fallback?.backgroundImage) || undefined,
    blockSpriteRef: normalizedBlockSpriteRef,
    blockSpriteAssetId: firstNonEmpty(row.blockSpriteAssetId as string | undefined, fallback?.blockSpriteAssetId),
    blockSpriteUrl: toLegacyImagePath(normalizedBlockSpriteRef) ?? firstNonEmpty(row.blockSpriteUrl as string | undefined, fallback?.blockSpriteUrl),
    blockCrackSpriteRef: normalizedCrackSpriteRef,
    blockCrackSpriteAssetId: firstNonEmpty(row.blockCrackSpriteAssetId as string | undefined, fallback?.blockCrackSpriteAssetId),
    blockCrackSpriteUrl: toLegacyImagePath(normalizedCrackSpriteRef) ?? firstNonEmpty(row.blockCrackSpriteUrl as string | undefined, fallback?.blockCrackSpriteUrl),
    blockBreakSpriteSheetAssetId: firstNonEmpty(row.blockBreakSpriteSheetAssetId as string | undefined, fallback?.blockBreakSpriteSheetAssetId),
    blockBreakSpriteSheetUrl: firstNonEmpty(row.blockBreakSpriteSheetUrl as string | undefined, fallback?.blockBreakSpriteSheetUrl),
    particleTextureRef: normalizedParticleTextureRef,
    particleTextureAssetId: firstNonEmpty(row.particleTextureAssetId as string | undefined, fallback?.particleTextureAssetId),
    particleTextureUrl: toLegacyImagePath(normalizedParticleTextureRef) ?? firstNonEmpty(row.particleTextureUrl as string | undefined, fallback?.particleTextureUrl),
    isEnabled: row.isEnabled !== false,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
  };
}

function normalizeTool(raw: unknown): MiningToolDefinition | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const itemId = String(row.itemId ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (!id || !itemId || !name) {
    return null;
  }
  const fallback = DEFAULT_TOOL_BY_ID.get(id);
  const spriteFallback = firstNonEmpty(row.spriteUrl as string | undefined, row.spriteAssetId as string | undefined, fallback?.spriteUrl, fallback?.spriteAssetId);
  const normalizedSpriteRef = normalizeGameImageRef(
    row.spriteRef,
    spriteFallback,
  );
  return {
    id,
    professionId: 'mining',
    itemId,
    toolType: String(row.toolType ?? fallback?.toolType ?? 'pickaxe').trim() as MiningToolDefinition['toolType'],
    name: fixMojibake(name, fallback?.name),
    description: fixMojibake(String(row.description ?? '').trim(), fallback?.description) || undefined,
    spriteRef: normalizedSpriteRef,
    spriteAssetId: firstNonEmpty(row.spriteAssetId as string | undefined, fallback?.spriteAssetId),
    spriteUrl: toLegacyImagePath(normalizedSpriteRef) ?? firstNonEmpty(row.spriteUrl as string | undefined, fallback?.spriteUrl),
    effectType: (String(row.effectType ?? fallback?.effectType ?? '').trim() || undefined) as MiningToolDefinition['effectType'],
    effectValue: Number.isFinite(Number(row.effectValue)) ? Number(row.effectValue) : fallback?.effectValue,
    isConsumable: row.isConsumable === true,
    isEnabled: row.isEnabled !== false,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
  };
}

function normalizeBlockTable(raw: unknown): MineBlockTable | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (!id || !name) {
    return null;
  }

  const fallback = DEFAULT_BLOCK_TABLE_BY_ID.get(id);

  const entries: MineBlockTable['entries'] = [];
  if (Array.isArray(row.entries)) {
    for (const [entryIndex, entry] of row.entries.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }
      const block = entry as Record<string, unknown>;
      const fallbackEntry = fallback?.entries?.[entryIndex];
      const type = String(block.type ?? '').trim();
      const weight = Number(block.weight ?? 0);
      if (!type || !Number.isFinite(weight) || weight <= 0) {
        continue;
      }
      const payloads: MineBlockTable['entries'][number]['payloads'] = [];
      if (Array.isArray(block.payloads)) {
        for (const [payloadIndex, payload] of block.payloads.entries()) {
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            continue;
          }
          const rawPayload = payload as Record<string, unknown>;
          const fallbackPayload = fallbackEntry?.payloads?.[payloadIndex];
          const payloadType = String(rawPayload.type ?? '').trim();
          const payloadWeight = Number(rawPayload.weight ?? 0);
          if (!payloadType || !Number.isFinite(payloadWeight) || payloadWeight <= 0) {
            continue;
          }
          const tags = Array.isArray(rawPayload.tags)
            ? rawPayload.tags.map((tag) => String(tag ?? '').trim()).filter(Boolean)
            : undefined;
          payloads.push({
            id: String(rawPayload.id ?? '').trim() || undefined,
            type: payloadType as MineBlockPayload['type'],
            weight: payloadWeight,
            itemId: String(rawPayload.itemId ?? '').trim() || undefined,
            materialId: String(rawPayload.materialId ?? '').trim() || undefined,
            hazardId: String(rawPayload.hazardId ?? '').trim() || undefined,
            eventId: String(rawPayload.eventId ?? '').trim() || undefined,
            goldMin: Number.isFinite(Number(rawPayload.goldMin)) ? Math.max(0, Math.floor(Number(rawPayload.goldMin))) : undefined,
            goldMax: Number.isFinite(Number(rawPayload.goldMax)) ? Math.max(0, Math.floor(Number(rawPayload.goldMax))) : undefined,
            minQuantity: Number.isFinite(Number(rawPayload.minQuantity)) ? Math.max(1, Math.floor(Number(rawPayload.minQuantity))) : undefined,
            maxQuantity: Number.isFinite(Number(rawPayload.maxQuantity)) ? Math.max(1, Math.floor(Number(rawPayload.maxQuantity))) : undefined,
            minDepth: Number.isFinite(Number(rawPayload.minDepth)) ? Math.max(1, Math.floor(Number(rawPayload.minDepth))) : undefined,
            maxDepth: Number.isFinite(Number(rawPayload.maxDepth)) ? Math.max(1, Math.floor(Number(rawPayload.maxDepth))) : undefined,
            rarity: fixMojibake(String(rawPayload.rarity ?? '').trim(), fallbackPayload?.rarity) || undefined,
            tags,
            params: rawPayload.params && typeof rawPayload.params === 'object' && !Array.isArray(rawPayload.params)
              ? rawPayload.params as Record<string, unknown>
              : undefined,
          });
        }
      }

      entries.push({
        type: type as MineBlockTable['entries'][number]['type'],
        weight,
        lootTableId: String(block.lootTableId ?? '').trim() || undefined,
        hazardTableId: String(block.hazardTableId ?? '').trim() || undefined,
        label: fixMojibake(String(block.label ?? '').trim(), fallbackEntry?.label) || undefined,
        description: fixMojibake(String(block.description ?? '').trim(), fallbackEntry?.description) || undefined,
        payloads: payloads.length > 0 ? payloads : undefined,
      });
    }
  }

  return {
    id,
    name: fixMojibake(name, fallback?.name),
    mineId: String(row.mineId ?? '').trim() || undefined,
    depthLevel: Number.isFinite(Number(row.depthLevel)) ? Math.max(1, Math.floor(Number(row.depthLevel))) : undefined,
    entries,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
  };
}

function normalizeHazard(raw: unknown): MineHazard | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const name = String(row.name ?? '').trim();
  const type = String(row.type ?? '').trim();
  if (!id || !name || !type) {
    return null;
  }

  const fallback = DEFAULT_HAZARD_BY_ID.get(id);

  return {
    id,
    name: fixMojibake(name, fallback?.name),
    type: type as MineHazard['type'],
    description: fixMojibake(String(row.description ?? '').trim(), fallback?.description),
    hpDamageMin: Math.max(0, Math.floor(Number(row.hpDamageMin ?? 0))),
    hpDamageMax: Math.max(0, Math.floor(Number(row.hpDamageMax ?? 0))),
    staminaDamageMin: Math.max(0, Math.floor(Number(row.staminaDamageMin ?? 0))),
    staminaDamageMax: Math.max(0, Math.floor(Number(row.staminaDamageMax ?? 0))),
    lootLossChance: Math.max(0, Number(row.lootLossChance ?? 0)),
    lootLossPercent: Math.max(0, Number(row.lootLossPercent ?? 0)),
    statusEffectIds: Array.isArray(row.statusEffectIds)
      ? row.statusEffectIds.map((entry, index) => fixMojibake(String(entry ?? '').trim(), fallback?.statusEffectIds?.[index])).filter(Boolean)
      : (fallback?.statusEffectIds ?? []),
    canBeReducedByConstitution: row.canBeReducedByConstitution !== false,
    canBeDodgedByDexterity: row.canBeDodgedByDexterity === true,
    isDeadly: row.isDeadly === true,
    isEnabled: row.isEnabled !== false,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
  };
}

function normalizeHazardTable(raw: unknown): MineHazardTable | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (!id || !name) {
    return null;
  }

  const fallback = DEFAULT_HAZARD_TABLE_BY_ID.get(id);

  const entries: MineHazardTable['entries'] = [];
  if (Array.isArray(row.entries)) {
    for (const entry of row.entries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }
      const value = entry as Record<string, unknown>;
      const hazardId = String(value.hazardId ?? '').trim();
      const weight = Number(value.weight ?? 0);
      if (!hazardId || !Number.isFinite(weight) || weight <= 0) {
        continue;
      }
      const minDepth = Number(value.minDepth);
      const maxDepth = Number(value.maxDepth);
      entries.push({
        hazardId,
        weight,
        minDepth: Number.isFinite(minDepth) ? Math.max(1, Math.floor(minDepth)) : undefined,
        maxDepth: Number.isFinite(maxDepth) ? Math.max(1, Math.floor(maxDepth)) : undefined,
      });
    }
  }

  return {
    id,
    name: fixMojibake(name, fallback?.name),
    entries,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
  };
}

function normalizeLootTable(raw: unknown): MineLootTable | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  const name = String(row.name ?? '').trim();
  if (!id || !name) {
    return null;
  }

  const fallback = DEFAULT_LOOT_TABLE_BY_ID.get(id);

  const entries: MineLootTable['entries'] = [];
  if (Array.isArray(row.entries)) {
    for (const [entryIndex, entry] of row.entries.entries()) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }
      const value = entry as Record<string, unknown>;
      const itemId = String(value.itemId ?? '').trim();
      const weight = Number(value.weight ?? 0);
      const minQuantity = Number(value.minQuantity ?? 1);
      const maxQuantity = Number(value.maxQuantity ?? 1);
      if (!itemId || !Number.isFinite(weight) || weight <= 0) {
        continue;
      }
      const fallbackEntry = fallback?.entries.find((candidate) => candidate.itemId === itemId) ?? fallback?.entries?.[entryIndex];
      entries.push({
        itemId,
        weight,
        minQuantity: Math.max(1, Math.floor(minQuantity)),
        maxQuantity: Math.max(1, Math.floor(maxQuantity)),
        requiredDepth: Number.isFinite(Number(value.requiredDepth)) ? Math.max(1, Math.floor(Number(value.requiredDepth))) : undefined,
        rarity: fixMojibake(String(value.rarity ?? '').trim(), fallbackEntry?.rarity) || undefined,
      });
    }
  }

  return {
    id,
    name: fixMojibake(name, fallback?.name),
    entries,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
  };
}

function defaultMiningContent(): MiningContentBundle {
  const createdAt = nowIso();
  return {
    mines: [
      {
        id: 'mine_teramor_old_iron',
        name: 'Старая шахта Терамора',
        description: 'Старая шахта в землях Терамора. Здесь можно найти камень, железо, золото и редкие зептиритовые следы.',
        shortDescription: 'Старые штреки Терамора с железом и редкими следами зептирита.',
        requiredProfessionId: 'mining',
        requiredMiningLevel: 1,
        dangerLevel: 'low',
        visualTheme: 'teramor_stone',
        region: 'teramor',
        depthIds: [
          'mine_teramor_old_iron_depth_1',
          'mine_teramor_old_iron_depth_2',
          'mine_teramor_old_iron_depth_3',
        ],
        knownResources: [
          'Камень',
          'Железная руда',
          'Золото',
          'Зептиритовый след',
        ],
        entryText: 'Холодный воздух пахнет сыростью и пылью. За ржавой решеткой начинается старая тераморская выработка.',
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_argos_black_coal',
        name: 'Черноугольная шахта Аргоса',
        description: 'Шахта в предгорьях Аргоса. Здесь добывают уголь и глубинный уголь, а иногда находят жилы железа и странные зептиритовые прожилки.',
        shortDescription: 'Уголь и железные жилы Аргоса. Опаснее тераморских штреков.',
        requiredProfessionId: 'mining',
        requiredMiningLevel: 2,
        dangerLevel: 'high',
        visualTheme: 'coal',
        region: 'argos',
        depthIds: [
          'mine_argos_black_coal_depth_1',
          'mine_argos_black_coal_depth_2',
          'mine_argos_black_coal_depth_3',
        ],
        knownResources: [
          'Камень',
          'Уголь',
          'Глубинный уголь',
          'Железная руда',
          'Зептиритовый след',
        ],
        entryText: 'Сажа лежит на стенах толстым слоем. Здесь пахнет копотью, железом и чем-то старым, что не любит свет.',
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_nocturna_abyss_runes',
        name: 'Бездна Ноктурны',
        description: 'Разлом, где рунические осколки и ночное стекло проступают из породы. Здесь добыча щедра, но шанс не вернуться слишком реален.',
        shortDescription: 'Очень опасная бездна с руническими находками и ночным стеклом.',
        requiredProfessionId: 'mining',
        requiredMiningLevel: 4,
        dangerLevel: 'deadly',
        visualTheme: 'shadow',
        region: 'nocturna',
        depthIds: [
          'mine_nocturna_abyss_runes_depth_1',
          'mine_nocturna_abyss_runes_depth_2',
          'mine_nocturna_abyss_runes_depth_3',
        ],
        knownResources: [
          'Ночное стекло',
          'Рунные осколки',
          'Пепел душ',
          'Обсидиан смерти',
          'Осколок гравитации',
        ],
        entryText: 'Тишина здесь давит сильнее камня. Слышно, как в трещинах шепчет Ноктурна, и каждый удар кирки будто будит что-то глубже.',
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    depths: [
      {
        id: 'mine_teramor_old_iron_depth_1',
        mineId: 'mine_teramor_old_iron',
        depthLevel: 1,
        name: 'Верхние штреки',
        description: 'Старые проходы с устойчивыми стенами и мелкими жилами железа.',
        rows: 4,
        columns: 6,
        baseHits: 13,
        staminaCostPerHit: 2,
        baseCollapseRisk: 0.03,
        riskIncreasePerHit: 0.005,
        lootTableId: 'mine_loot_teramor_depth_1_stone',
        blockTableId: 'mine_blocks_teramor_depth_1',
        hazardTableId: 'mine_hazards_teramor_common',
        guaranteedExit: true,
        canSpawnPassage: true,
        isFinalDepth: false,
        requiredMiningLevel: 1,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_teramor_old_iron_depth_2',
        mineId: 'mine_teramor_old_iron',
        depthLevel: 2,
        name: 'Средние жилы',
        description: 'Воздух тяжелее, а порода богаче и злее.',
        rows: 4,
        columns: 4,
        baseHits: 10,
        staminaCostPerHit: 3,
        baseCollapseRisk: 0.07,
        riskIncreasePerHit: 0.01,
        lootTableId: 'mine_loot_teramor_depth_2_stone',
        blockTableId: 'mine_blocks_teramor_depth_2',
        hazardTableId: 'mine_hazards_teramor_deep',
        guaranteedExit: true,
        canSpawnPassage: true,
        isFinalDepth: false,
        requiredMiningLevel: 1,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_teramor_old_iron_depth_3',
        mineId: 'mine_teramor_old_iron',
        depthLevel: 3,
        name: 'Глубокий карман',
        description: 'Тут уже слышно, как гора живет своей жизнью.',
        rows: 3,
        columns: 4,
        baseHits: 7,
        staminaCostPerHit: 5,
        baseCollapseRisk: 0.12,
        riskIncreasePerHit: 0.015,
        lootTableId: 'mine_loot_teramor_depth_3_stone',
        blockTableId: 'mine_blocks_teramor_depth_3',
        hazardTableId: 'mine_hazards_teramor_deep',
        guaranteedExit: true,
        canSpawnPassage: false,
        isFinalDepth: true,
        requiredMiningLevel: 1,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_argos_black_coal_depth_1',
        mineId: 'mine_argos_black_coal',
        depthLevel: 1,
        name: 'Копотные штреки',
        description: 'Неглубокие галереи, где уголь лежит почти на поверхности.',
        rows: 4,
        columns: 6,
        baseHits: 14,
        staminaCostPerHit: 2,
        baseCollapseRisk: 0.05,
        riskIncreasePerHit: 0.007,
        lootTableId: 'mine_loot_argos_coal_depth_1_stone',
        blockTableId: 'mine_blocks_argos_coal_depth_1',
        hazardTableId: 'mine_hazards_teramor_common',
        guaranteedExit: true,
        canSpawnPassage: true,
        isFinalDepth: false,
        requiredMiningLevel: 2,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_argos_black_coal_depth_2',
        mineId: 'mine_argos_black_coal',
        depthLevel: 2,
        name: 'Горячие карманы',
        description: 'Порода плотнее, воздуха меньше. Иногда попадаются странные прожилки.',
        rows: 4,
        columns: 5,
        baseHits: 11,
        staminaCostPerHit: 3,
        baseCollapseRisk: 0.09,
        riskIncreasePerHit: 0.012,
        lootTableId: 'mine_loot_argos_coal_depth_2_stone',
        blockTableId: 'mine_blocks_argos_coal_depth_2',
        hazardTableId: 'mine_hazards_teramor_deep',
        guaranteedExit: true,
        canSpawnPassage: true,
        isFinalDepth: false,
        requiredMiningLevel: 2,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_argos_black_coal_depth_3',
        mineId: 'mine_argos_black_coal',
        depthLevel: 3,
        name: 'Глубинный пласт',
        description: 'Тут уголь уже почти черный металл. Ошибка стоит дорого.',
        rows: 3,
        columns: 5,
        baseHits: 8,
        staminaCostPerHit: 5,
        baseCollapseRisk: 0.14,
        riskIncreasePerHit: 0.018,
        lootTableId: 'mine_loot_argos_coal_depth_3_stone',
        blockTableId: 'mine_blocks_argos_coal_depth_3',
        hazardTableId: 'mine_hazards_teramor_deep',
        guaranteedExit: true,
        canSpawnPassage: false,
        isFinalDepth: true,
        requiredMiningLevel: 2,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_nocturna_abyss_runes_depth_1',
        mineId: 'mine_nocturna_abyss_runes',
        depthLevel: 1,
        name: 'Кромка бездны',
        description: 'Свет еще держится, но трещины уже дышат ночным стеклом.',
        rows: 4,
        columns: 6,
        baseHits: 13,
        staminaCostPerHit: 3,
        baseCollapseRisk: 0.11,
        riskIncreasePerHit: 0.014,
        lootTableId: 'mine_loot_nocturna_abyss_depth_1_stone',
        blockTableId: 'mine_blocks_nocturna_abyss_depth_1',
        hazardTableId: 'mine_hazards_nocturna_abyss',
        guaranteedExit: true,
        canSpawnPassage: true,
        isFinalDepth: false,
        requiredMiningLevel: 4,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_nocturna_abyss_runes_depth_2',
        mineId: 'mine_nocturna_abyss_runes',
        depthLevel: 2,
        name: 'Ночная расщелина',
        description: 'Здесь камень будто темнее ночи. С каждым ударом просыпаются рунические шрамы.',
        rows: 4,
        columns: 5,
        baseHits: 10,
        staminaCostPerHit: 5,
        baseCollapseRisk: 0.18,
        riskIncreasePerHit: 0.02,
        lootTableId: 'mine_loot_nocturna_abyss_depth_2_stone',
        blockTableId: 'mine_blocks_nocturna_abyss_depth_2',
        hazardTableId: 'mine_hazards_nocturna_abyss',
        guaranteedExit: true,
        canSpawnPassage: true,
        isFinalDepth: false,
        requiredMiningLevel: 4,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_nocturna_abyss_runes_depth_3',
        mineId: 'mine_nocturna_abyss_runes',
        depthLevel: 3,
        name: 'Горло тьмы',
        description: 'Сюда не спускаются без причины. Рунные осколки здесь как зубы, а шепот режет слух.',
        rows: 3,
        columns: 5,
        baseHits: 7,
        staminaCostPerHit: 7,
        baseCollapseRisk: 0.28,
        riskIncreasePerHit: 0.03,
        lootTableId: 'mine_loot_nocturna_abyss_depth_3_stone',
        blockTableId: 'mine_blocks_nocturna_abyss_depth_3',
        hazardTableId: 'mine_hazards_nocturna_abyss',
        guaranteedExit: true,
        canSpawnPassage: false,
        isFinalDepth: true,
        requiredMiningLevel: 4,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    blockTables: [
      {
        id: 'mine_blocks_teramor_depth_1',
        name: 'Терамор I',
        mineId: 'mine_teramor_old_iron',
        depthLevel: 1,
        entries: [
          { type: 'empty', weight: 18, label: 'Пустая порода' },
          { type: 'stone', weight: 26, label: 'Камень', lootTableId: 'mine_loot_teramor_depth_1_stone' },
          { type: 'ore', weight: 28, label: 'Железная жила', lootTableId: 'mine_loot_teramor_depth_1_iron' },
          { type: 'gold', weight: 8, label: 'Золотой след', lootTableId: 'mine_loot_teramor_depth_1_gold' },
          { type: 'crystal', weight: 4, label: 'Кристалл', lootTableId: 'mine_loot_teramor_depth_1_crystal' },
          { type: 'hazard', weight: 8, label: 'Опасная трещина', hazardTableId: 'mine_hazards_teramor_common' },
          { type: 'passage', weight: 4, label: 'Узкий проход' },
          { type: 'exit', weight: 4, label: 'Выход' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_blocks_teramor_depth_2',
        name: 'Терамор II',
        mineId: 'mine_teramor_old_iron',
        depthLevel: 2,
        entries: [
          { type: 'empty', weight: 12, label: 'Пустота' },
          { type: 'stone', weight: 20, label: 'Камень', lootTableId: 'mine_loot_teramor_depth_2_stone' },
          { type: 'ore', weight: 26, label: 'Жила железа', lootTableId: 'mine_loot_teramor_depth_2_iron' },
          { type: 'rich_ore', weight: 10, label: 'Богатая жила', lootTableId: 'mine_loot_teramor_depth_2_iron_rich' },
          { type: 'gold', weight: 10, label: 'Золото', lootTableId: 'mine_loot_teramor_depth_2_gold' },
          { type: 'crystal', weight: 6, label: 'Кристалл', lootTableId: 'mine_loot_teramor_depth_2_crystal' },
          { type: 'hazard', weight: 10, label: 'Опасность', hazardTableId: 'mine_hazards_teramor_deep' },
          { type: 'passage', weight: 3, label: 'Спуск ниже' },
          { type: 'exit', weight: 3, label: 'Выход' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_blocks_teramor_depth_3',
        name: 'Терамор III',
        mineId: 'mine_teramor_old_iron',
        depthLevel: 3,
        entries: [
          { type: 'empty', weight: 8, label: 'Пустота' },
          { type: 'stone', weight: 15, label: 'Камень', lootTableId: 'mine_loot_teramor_depth_3_stone' },
          { type: 'ore', weight: 22, label: 'Жила', lootTableId: 'mine_loot_teramor_depth_3_iron' },
          { type: 'rich_ore', weight: 14, label: 'Богатая жила', lootTableId: 'mine_loot_teramor_depth_3_iron_rich', payloads: [{ type: 'rune_trace', weight: 2, itemId: 'mat_weak_rune_fragment', minQuantity: 1, maxQuantity: 1, rarity: 'rare', minDepth: 3, tags: ['porter_save_allowed'] }, { type: 'loot_item', weight: 8, itemId: 'mat_rich_iron_ore', minQuantity: 1, maxQuantity: 2 }] },
          { type: 'gold', weight: 10, label: 'Золото', lootTableId: 'mine_loot_teramor_depth_3_gold' },
          { type: 'gem', weight: 6, label: 'Драгоценный камень', lootTableId: 'mine_loot_teramor_depth_3_gem' },
          { type: 'crystal', weight: 8, label: 'Кристалл', lootTableId: 'mine_loot_teramor_depth_3_crystal' },
          { type: 'hazard', weight: 12, label: 'Опасность', hazardTableId: 'mine_hazards_teramor_deep' },
          { type: 'event', weight: 5, label: 'Древнее эхо', payloads: [{ type: 'event_ref', weight: 3, eventId: 'ancient_tablet', minDepth: 3 }, { type: 'event_ref', weight: 3, eventId: 'hidden_cache', minDepth: 3 }, { type: 'event_ref', weight: 2, eventId: 'old_mining_mark', minDepth: 3 }, { type: 'event_ref', weight: 1, eventId: 'spirit_whisper', minDepth: 3 }, { type: 'event_ref', weight: 1, eventId: 'dwarf_cart', minDepth: 3 }] },
          { type: 'exit', weight: 5, label: 'Выход' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_blocks_argos_coal_depth_1',
        name: 'Аргос: уголь I',
        mineId: 'mine_argos_black_coal',
        depthLevel: 1,
        entries: [
          { type: 'empty', weight: 16, label: 'Пустая порода' },
          { type: 'stone', weight: 22, label: 'Камень', lootTableId: 'mine_loot_argos_coal_depth_1_stone' },
          { type: 'ore', weight: 30, label: 'Угольная жила', lootTableId: 'mine_loot_argos_coal_depth_1_coal' },
          { type: 'rich_ore', weight: 7, label: 'Жила железа', lootTableId: 'mine_loot_argos_coal_depth_1_iron' },
          { type: 'crystal', weight: 4, label: 'Следы', lootTableId: 'mine_loot_argos_coal_depth_1_crystal' },
          { type: 'hazard', weight: 14, label: 'Опасность', hazardTableId: 'mine_hazards_teramor_common' },
          { type: 'passage', weight: 4, label: 'Спуск ниже' },
          { type: 'exit', weight: 3, label: 'Выход' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_blocks_argos_coal_depth_2',
        name: 'Аргос: уголь II',
        mineId: 'mine_argos_black_coal',
        depthLevel: 2,
        entries: [
          { type: 'empty', weight: 12, label: 'Пустота' },
          { type: 'stone', weight: 18, label: 'Камень', lootTableId: 'mine_loot_argos_coal_depth_2_stone' },
          { type: 'ore', weight: 28, label: 'Угольная жила', lootTableId: 'mine_loot_argos_coal_depth_2_coal' },
          { type: 'rich_ore', weight: 10, label: 'Глубинный уголь', lootTableId: 'mine_loot_argos_coal_depth_2_deep_coal' },
          { type: 'gold', weight: 8, label: 'Жила железа', lootTableId: 'mine_loot_argos_coal_depth_2_iron' },
          { type: 'crystal', weight: 6, label: 'Зептиритовый след', lootTableId: 'mine_loot_argos_coal_depth_2_crystal' },
          { type: 'hazard', weight: 16, label: 'Опасность', hazardTableId: 'mine_hazards_teramor_deep' },
          { type: 'passage', weight: 4, label: 'Спуск ниже' },
          { type: 'exit', weight: 3, label: 'Выход' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_blocks_argos_coal_depth_3',
        name: 'Аргос: уголь III',
        mineId: 'mine_argos_black_coal',
        depthLevel: 3,
        entries: [
          { type: 'empty', weight: 10, label: 'Пустота' },
          { type: 'stone', weight: 14, label: 'Камень', lootTableId: 'mine_loot_argos_coal_depth_3_stone' },
          { type: 'ore', weight: 24, label: 'Угольная жила', lootTableId: 'mine_loot_argos_coal_depth_3_coal' },
          { type: 'rich_ore', weight: 12, label: 'Глубинный уголь', lootTableId: 'mine_loot_argos_coal_depth_3_deep_coal' },
          { type: 'gold', weight: 10, label: 'Богатая жила железа', lootTableId: 'mine_loot_argos_coal_depth_3_iron_rich' },
          { type: 'crystal', weight: 10, label: 'Зептирит', lootTableId: 'mine_loot_argos_coal_depth_3_crystal' },
          { type: 'hazard', weight: 20, label: 'Опасность', hazardTableId: 'mine_hazards_teramor_deep' },
          { type: 'exit', weight: 10, label: 'Выход' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_blocks_nocturna_abyss_depth_1',
        name: 'Ноктурна: бездна I',
        mineId: 'mine_nocturna_abyss_runes',
        depthLevel: 1,
        entries: [
          { type: 'empty', weight: 10, label: 'Пустота' },
          { type: 'stone', weight: 16, label: 'Темная порода', lootTableId: 'mine_loot_nocturna_abyss_depth_1_stone' },
          { type: 'crystal', weight: 12, label: 'Ночное стекло', lootTableId: 'mine_loot_nocturna_abyss_depth_1_glass' },
          { type: 'ore', weight: 10, label: 'Рунный след', lootTableId: 'mine_loot_nocturna_abyss_depth_1_runes' },
          { type: 'gem', weight: 8, label: 'Осколок', lootTableId: 'mine_loot_nocturna_abyss_depth_1_gem' },
          { type: 'hazard', weight: 18, label: 'Опасность', hazardTableId: 'mine_hazards_nocturna_abyss' },
          { type: 'passage', weight: 4, label: 'Спуск ниже' },
          { type: 'exit', weight: 4, label: 'Выход' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_blocks_nocturna_abyss_depth_2',
        name: 'Ноктурна: бездна II',
        mineId: 'mine_nocturna_abyss_runes',
        depthLevel: 2,
        entries: [
          { type: 'empty', weight: 8, label: 'Пустота' },
          { type: 'stone', weight: 14, label: 'Темная порода', lootTableId: 'mine_loot_nocturna_abyss_depth_2_stone' },
          { type: 'crystal', weight: 14, label: 'Ночное стекло', lootTableId: 'mine_loot_nocturna_abyss_depth_2_glass' },
          { type: 'ore', weight: 12, label: 'Руническая пыль', lootTableId: 'mine_loot_nocturna_abyss_depth_2_ash' },
          { type: 'rich_ore', weight: 10, label: 'Рунный след', lootTableId: 'mine_loot_nocturna_abyss_depth_2_runes' },
          { type: 'gem', weight: 8, label: 'Осколок гравитации', lootTableId: 'mine_loot_nocturna_abyss_depth_2_gem' },
          { type: 'hazard', weight: 22, label: 'Опасность', hazardTableId: 'mine_hazards_nocturna_abyss' },
          { type: 'passage', weight: 4, label: 'Спуск ниже' },
          { type: 'exit', weight: 4, label: 'Выход' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_blocks_nocturna_abyss_depth_3',
        name: 'Ноктурна: бездна III',
        mineId: 'mine_nocturna_abyss_runes',
        depthLevel: 3,
        entries: [
          { type: 'empty', weight: 7, label: 'Пустота' },
          { type: 'stone', weight: 12, label: 'Темная порода', lootTableId: 'mine_loot_nocturna_abyss_depth_3_stone' },
          { type: 'crystal', weight: 14, label: 'Ночное стекло', lootTableId: 'mine_loot_nocturna_abyss_depth_3_glass' },
          { type: 'ore', weight: 12, label: 'Пепел душ', lootTableId: 'mine_loot_nocturna_abyss_depth_3_ash' },
          { type: 'rich_ore', weight: 12, label: 'Руническая находка', lootTableId: 'mine_loot_nocturna_abyss_depth_3_runes' },
          { type: 'gem', weight: 10, label: 'Осколок силы', lootTableId: 'mine_loot_nocturna_abyss_depth_3_gem' },
          { type: 'gold', weight: 7, label: 'Обсидиан смерти', lootTableId: 'mine_loot_nocturna_abyss_depth_3_obsidian' },
          { type: 'hazard', weight: 26, label: 'Опасность', hazardTableId: 'mine_hazards_nocturna_abyss' },
          { type: 'event', weight: 6, label: 'Голос глубины', payloads: [{ type: 'event_ref', weight: 2, eventId: 'spirit_whisper', minDepth: 3 }, { type: 'event_ref', weight: 2, eventId: 'ancient_tablet', minDepth: 3 }, { type: 'event_ref', weight: 1, eventId: 'hidden_cache', minDepth: 3 }, { type: 'event_ref', weight: 1, eventId: 'old_mining_mark', minDepth: 3 }] },
          { type: 'exit', weight: 6, label: 'Выход' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
    ],
    hazards: [
      {
        id: 'hazard_minor_collapse',
        name: 'Малый обвал',
        type: 'minor_collapse',
        description: 'Несколько камней срываются сверху и больно бьют по плечам.',
        hpDamageMin: 2,
        hpDamageMax: 6,
        staminaDamageMin: 1,
        staminaDamageMax: 3,
        lootLossChance: 0,
        lootLossPercent: 0,
        canBeReducedByConstitution: true,
        canBeDodgedByDexterity: true,
        isDeadly: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'hazard_medium_collapse',
        name: 'Средний обвал',
        type: 'medium_collapse',
        description: 'Порода трещит и осыпается заметно сильнее.',
        hpDamageMin: 5,
        hpDamageMax: 12,
        staminaDamageMin: 2,
        staminaDamageMax: 6,
        lootLossChance: 0.15,
        lootLossPercent: 0.2,
        canBeReducedByConstitution: true,
        canBeDodgedByDexterity: true,
        isDeadly: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'hazard_mine_dust',
        name: 'Шахтная пыль',
        type: 'dust',
        description: 'Тяжелая пыль забивает легкие и сбивает дыхание.',
        hpDamageMin: 0,
        hpDamageMax: 3,
        staminaDamageMin: 3,
        staminaDamageMax: 8,
        lootLossChance: 0,
        lootLossPercent: 0,
        canBeReducedByConstitution: true,
        canBeDodgedByDexterity: false,
        isDeadly: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'hazard_gas_pocket',
        name: 'Газовый карман',
        type: 'gas',
        description: 'Из щели вырывается удушливый газ.',
        hpDamageMin: 4,
        hpDamageMax: 10,
        staminaDamageMin: 4,
        staminaDamageMax: 10,
        lootLossChance: 0,
        lootLossPercent: 0,
        canBeReducedByConstitution: true,
        canBeDodgedByDexterity: false,
        isDeadly: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'hazard_major_collapse',
        name: 'Крупный обвал',
        type: 'major_collapse',
        description: 'С потолка срывается тяжёлая порода и ломает строй шахты.',
        hpDamageMin: 10,
        hpDamageMax: 18,
        staminaDamageMin: 5,
        staminaDamageMax: 9,
        lootLossChance: 0.25,
        lootLossPercent: 0.3,
        canBeReducedByConstitution: true,
        canBeDodgedByDexterity: false,
        isDeadly: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'hazard_deadly_collapse',
        name: 'Смертельный обвал',
        type: 'deadly_collapse',
        description: 'Штольня рушится почти целиком.',
        hpDamageMin: 18,
        hpDamageMax: 32,
        staminaDamageMin: 8,
        staminaDamageMax: 14,
        lootLossChance: 0.4,
        lootLossPercent: 0.5,
        canBeReducedByConstitution: true,
        canBeDodgedByDexterity: false,
        isDeadly: true,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'hazard_poison_gas',
        name: 'Ядовитый газ',
        type: 'poison_gas',
        description: 'Из глубокой щели поднимается жгучий ядовитый газ.',
        hpDamageMin: 6,
        hpDamageMax: 13,
        staminaDamageMin: 5,
        staminaDamageMax: 10,
        lootLossChance: 0,
        lootLossPercent: 0,
        canBeReducedByConstitution: true,
        canBeDodgedByDexterity: false,
        isDeadly: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'hazard_lava_crack',
        name: 'Лавовая трещина',
        type: 'lava_crack',
        description: 'Сквозь трещину прорывается жар глубин.',
        hpDamageMin: 7,
        hpDamageMax: 15,
        staminaDamageMin: 4,
        staminaDamageMax: 8,
        lootLossChance: 0,
        lootLossPercent: 0,
        canBeReducedByConstitution: false,
        canBeDodgedByDexterity: true,
        isDeadly: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'hazard_fire_burst',
        name: 'Огненный выброс',
        type: 'fire_burst',
        description: 'Горячий карман вспыхивает и обжигает горняка.',
        hpDamageMin: 5,
        hpDamageMax: 11,
        staminaDamageMin: 3,
        staminaDamageMax: 6,
        lootLossChance: 0,
        lootLossPercent: 0,
        canBeReducedByConstitution: false,
        canBeDodgedByDexterity: true,
        isDeadly: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'hazard_curse',
        name: 'Проклятая трещина',
        type: 'curse',
        description: 'Древний знак отзывается болью и дурным холодом.',
        hpDamageMin: 4,
        hpDamageMax: 9,
        staminaDamageMin: 4,
        staminaDamageMax: 8,
        lootLossChance: 0.1,
        lootLossPercent: 0.1,
        canBeReducedByConstitution: false,
        canBeDodgedByDexterity: false,
        isDeadly: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'hazard_spirit_attack',
        name: 'Удар духа',
        type: 'spirit_attack',
        description: 'Эхо подземья царапает разум и вырывает воздух из груди.',
        hpDamageMin: 4,
        hpDamageMax: 10,
        staminaDamageMin: 5,
        staminaDamageMax: 9,
        lootLossChance: 0,
        lootLossPercent: 0,
        canBeReducedByConstitution: false,
        canBeDodgedByDexterity: false,
        isDeadly: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'hazard_lost_loot',
        name: 'Порванный мешок',
        type: 'lost_loot',
        description: 'Часть добычи сыплется в расщелину.',
        hpDamageMin: 0,
        hpDamageMax: 0,
        staminaDamageMin: 0,
        staminaDamageMax: 2,
        lootLossChance: 1,
        lootLossPercent: 0.35,
        canBeReducedByConstitution: false,
        canBeDodgedByDexterity: true,
        isDeadly: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    hazardTables: [
      {
        id: 'mine_hazards_teramor_common',
        name: 'Терамор: обычные опасности',
        entries: [
          { hazardId: 'hazard_minor_collapse', weight: 6, minDepth: 1, maxDepth: 3 },
          { hazardId: 'hazard_mine_dust', weight: 4, minDepth: 1, maxDepth: 3 },
          { hazardId: 'hazard_lost_loot', weight: 2, minDepth: 1, maxDepth: 3 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_hazards_teramor_deep',
        name: 'Терамор: глубокие опасности',
        entries: [
          { hazardId: 'hazard_minor_collapse', weight: 4, minDepth: 1, maxDepth: 3 },
          { hazardId: 'hazard_medium_collapse', weight: 5, minDepth: 2, maxDepth: 3 },
          { hazardId: 'hazard_major_collapse', weight: 3, minDepth: 3, maxDepth: 3 },
          { hazardId: 'hazard_deadly_collapse', weight: 1, minDepth: 3, maxDepth: 3 },
          { hazardId: 'hazard_mine_dust', weight: 3, minDepth: 2, maxDepth: 3 },
          { hazardId: 'hazard_gas_pocket', weight: 4, minDepth: 2, maxDepth: 3 },
          { hazardId: 'hazard_poison_gas', weight: 2, minDepth: 3, maxDepth: 3 },
          { hazardId: 'hazard_lava_crack', weight: 1, minDepth: 3, maxDepth: 3 },
          { hazardId: 'hazard_fire_burst', weight: 1, minDepth: 3, maxDepth: 3 },
          { hazardId: 'hazard_curse', weight: 1, minDepth: 3, maxDepth: 3 },
          { hazardId: 'hazard_spirit_attack', weight: 1, minDepth: 3, maxDepth: 3 },
          { hazardId: 'hazard_lost_loot', weight: 2, minDepth: 1, maxDepth: 3 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_hazards_nocturna_abyss',
        name: 'Ноктурна: бездна (очень опасно)',
        entries: [
          { hazardId: 'hazard_minor_collapse', weight: 2, minDepth: 1, maxDepth: 3 },
          { hazardId: 'hazard_medium_collapse', weight: 4, minDepth: 1, maxDepth: 3 },
          { hazardId: 'hazard_major_collapse', weight: 4, minDepth: 2, maxDepth: 3 },
          { hazardId: 'hazard_deadly_collapse', weight: 3, minDepth: 3, maxDepth: 3 },
          { hazardId: 'hazard_poison_gas', weight: 3, minDepth: 1, maxDepth: 3 },
          { hazardId: 'hazard_gas_pocket', weight: 4, minDepth: 1, maxDepth: 3 },
          { hazardId: 'hazard_curse', weight: 3, minDepth: 2, maxDepth: 3 },
          { hazardId: 'hazard_spirit_attack', weight: 3, minDepth: 2, maxDepth: 3 },
          { hazardId: 'hazard_lost_loot', weight: 2, minDepth: 1, maxDepth: 3 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
    ],
    lootTables: [
      {
        id: 'mine_loot_teramor_depth_1_stone',
        name: 'Терамор I: камень',
        entries: [
          { itemId: 'mat_raw_stone', weight: 92, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'mat_black_basalt', weight: 8, minQuantity: 1, maxQuantity: 1, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_1_iron',
        name: 'Терамор I: железо',
        entries: [
          { itemId: 'mat_iron_ore', weight: 86, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'mat_raw_stone', weight: 14, minQuantity: 1, maxQuantity: 1 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_1_gold',
        name: 'Терамор I: золото',
        entries: [
          { itemId: 'mat_gold_nugget', weight: 70, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
          { itemId: 'mat_raw_stone', weight: 30, minQuantity: 1, maxQuantity: 1 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_1_crystal',
        name: 'Терамор I: кристаллы',
        entries: [
          { itemId: 'mat_cracked_crystal', weight: 65, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
          { itemId: 'mat_zeptyrite_trace', weight: 35, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },

      {
        id: 'mine_loot_teramor_depth_2_stone',
        name: 'Терамор II: камень',
        entries: [
          { itemId: 'mat_raw_stone', weight: 82, minQuantity: 1, maxQuantity: 3 },
          { itemId: 'mat_black_basalt', weight: 18, minQuantity: 1, maxQuantity: 2, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_2_iron',
        name: 'Терамор II: железо',
        entries: [
          { itemId: 'mat_iron_ore', weight: 78, minQuantity: 1, maxQuantity: 3 },
          { itemId: 'mat_rich_iron_ore', weight: 22, minQuantity: 1, maxQuantity: 1, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_2_iron_rich',
        name: 'Терамор II: богатая жила',
        entries: [
          { itemId: 'mat_rich_iron_ore', weight: 70, minQuantity: 1, maxQuantity: 2, rarity: 'uncommon' },
          { itemId: 'mat_iron_ore', weight: 30, minQuantity: 1, maxQuantity: 2 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_2_gold',
        name: 'Терамор II: золото',
        entries: [
          { itemId: 'mat_gold_nugget', weight: 76, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'mat_raw_stone', weight: 24, minQuantity: 1, maxQuantity: 2 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_2_crystal',
        name: 'Терамор II: кристаллы',
        entries: [
          { itemId: 'mat_cracked_crystal', weight: 55, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'mat_zeptyrite_trace', weight: 25, minQuantity: 1, maxQuantity: 2, rarity: 'epic' },
          { itemId: 'mat_aurishel_crystal', weight: 20, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },

      {
        id: 'mine_loot_teramor_depth_3_stone',
        name: 'Терамор III: камень',
        entries: [
          { itemId: 'mat_raw_stone', weight: 72, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'mat_black_basalt', weight: 28, minQuantity: 1, maxQuantity: 2, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_3_iron',
        name: 'Терамор III: железо',
        entries: [
          { itemId: 'mat_iron_ore', weight: 65, minQuantity: 2, maxQuantity: 4 },
          { itemId: 'mat_rich_iron_ore', weight: 35, minQuantity: 1, maxQuantity: 2, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_3_iron_rich',
        name: 'Терамор III: богатая жила',
        entries: [
          { itemId: 'mat_rich_iron_ore', weight: 62, minQuantity: 1, maxQuantity: 3, rarity: 'uncommon' },
          { itemId: 'mat_iron_ore', weight: 28, minQuantity: 2, maxQuantity: 4 },
          { itemId: 'mat_zeptyrite_ore', weight: 10, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_3_gold',
        name: 'Терамор III: золото',
        entries: [
          { itemId: 'mat_gold_nugget', weight: 80, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'mat_raw_stone', weight: 20, minQuantity: 1, maxQuantity: 2 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_3_crystal',
        name: 'Терамор III: кристаллы',
        entries: [
          { itemId: 'mat_cracked_crystal', weight: 45, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'mat_aurishel_crystal', weight: 25, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
          { itemId: 'mat_zeptyrite_ore', weight: 20, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
          { itemId: 'mat_pure_zeptyrite_core', weight: 10, minQuantity: 1, maxQuantity: 1, rarity: 'legendary' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_3_gem',
        name: 'Терамор III: драгоценные камни',
        entries: [
          { itemId: 'mat_gravity_tear_crystal', weight: 30, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
          { itemId: 'mat_aurishel_crystal', weight: 45, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
          { itemId: 'mat_cracked_crystal', weight: 25, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },

      {
        id: 'mine_loot_argos_coal_depth_1_stone',
        name: 'Аргос: уголь I (камень)',
        entries: [
          { itemId: 'mat_raw_stone', weight: 88, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'mat_black_basalt', weight: 12, minQuantity: 1, maxQuantity: 1, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_argos_coal_depth_1_coal',
        name: 'Аргос: уголь I (уголь)',
        entries: [
          { itemId: 'mat_coal_chunk', weight: 60, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'mat_coal_lumps', weight: 40, minQuantity: 1, maxQuantity: 1 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_argos_coal_depth_1_iron',
        name: 'Аргос: уголь I (железо)',
        entries: [
          { itemId: 'mat_iron_ore', weight: 86, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'mat_raw_stone', weight: 14, minQuantity: 1, maxQuantity: 1 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_argos_coal_depth_1_crystal',
        name: 'Аргос: уголь I (следы)',
        entries: [
          { itemId: 'mat_zeptyrite_trace', weight: 60, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
          { itemId: 'mat_cracked_crystal', weight: 40, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },

      {
        id: 'mine_loot_argos_coal_depth_2_stone',
        name: 'Аргос: уголь II (камень)',
        entries: [
          { itemId: 'mat_raw_stone', weight: 78, minQuantity: 1, maxQuantity: 3 },
          { itemId: 'mat_black_basalt', weight: 22, minQuantity: 1, maxQuantity: 2, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_argos_coal_depth_2_coal',
        name: 'Аргос: уголь II (уголь)',
        entries: [
          { itemId: 'mat_coal_chunk', weight: 52, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'mat_coal_lumps', weight: 38, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'mat_deep_coal', weight: 10, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_argos_coal_depth_2_deep_coal',
        name: 'Аргос: уголь II (глубинный уголь)',
        entries: [
          { itemId: 'mat_deep_coal', weight: 70, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
          { itemId: 'mat_coal_chunk', weight: 30, minQuantity: 1, maxQuantity: 2 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_argos_coal_depth_2_iron',
        name: 'Аргос: уголь II (железо)',
        entries: [
          { itemId: 'mat_iron_ore', weight: 74, minQuantity: 1, maxQuantity: 3 },
          { itemId: 'mat_rich_iron_ore', weight: 26, minQuantity: 1, maxQuantity: 1, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_argos_coal_depth_2_crystal',
        name: 'Аргос: уголь II (зептирит)',
        entries: [
          { itemId: 'mat_zeptyrite_trace', weight: 50, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
          { itemId: 'mat_zeptyrite_ore', weight: 35, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
          { itemId: 'mat_cracked_crystal', weight: 15, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },

      {
        id: 'mine_loot_argos_coal_depth_3_stone',
        name: 'Аргос: уголь III (камень)',
        entries: [
          { itemId: 'mat_raw_stone', weight: 68, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'mat_black_basalt', weight: 32, minQuantity: 1, maxQuantity: 2, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_argos_coal_depth_3_coal',
        name: 'Аргос: уголь III (уголь)',
        entries: [
          { itemId: 'mat_coal_lumps', weight: 46, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'mat_coal_chunk', weight: 34, minQuantity: 1, maxQuantity: 3 },
          { itemId: 'mat_deep_coal', weight: 20, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_argos_coal_depth_3_deep_coal',
        name: 'Аргос: уголь III (глубинный уголь)',
        entries: [
          { itemId: 'mat_deep_coal', weight: 82, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
          { itemId: 'mat_coal_lumps', weight: 18, minQuantity: 1, maxQuantity: 2 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_argos_coal_depth_3_iron_rich',
        name: 'Аргос: уголь III (богатая жила)',
        entries: [
          { itemId: 'mat_rich_iron_ore', weight: 60, minQuantity: 1, maxQuantity: 3, rarity: 'uncommon' },
          { itemId: 'mat_iron_ore', weight: 28, minQuantity: 2, maxQuantity: 4 },
          { itemId: 'mat_zeptyrite_ore', weight: 12, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_argos_coal_depth_3_crystal',
        name: 'Аргос: уголь III (зептирит)',
        entries: [
          { itemId: 'mat_zeptyrite_ore', weight: 45, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
          { itemId: 'mat_zeptyrite_trace', weight: 35, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'mat_pure_zeptyrite_core', weight: 20, minQuantity: 1, maxQuantity: 1, rarity: 'legendary' },
        ],
        createdAt,
        updatedAt: createdAt,
      },

      {
        id: 'mine_loot_nocturna_abyss_depth_1_stone',
        name: 'Ноктурна: бездна I (порода)',
        entries: [
          { itemId: 'mat_black_basalt', weight: 70, minQuantity: 1, maxQuantity: 2, rarity: 'uncommon' },
          { itemId: 'mat_raw_stone', weight: 30, minQuantity: 1, maxQuantity: 2 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_1_glass',
        name: 'Ноктурна: бездна I (ночное стекло)',
        entries: [
          { itemId: 'mat_night_glass_shard', weight: 78, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'mat_gravity_tear_crystal', weight: 22, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_1_runes',
        name: 'Ноктурна: бездна I (рунические следы)',
        entries: [
          { itemId: 'mat_weak_rune_fragment', weight: 60, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'mat_rune_dust', weight: 40, minQuantity: 1, maxQuantity: 2, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_1_gem',
        name: 'Ноктурна: бездна I (осколки)',
        entries: [
          { itemId: 'mat_gravity_tear_crystal', weight: 60, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
          { itemId: 'mat_aurishel_crystal', weight: 40, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },

      {
        id: 'mine_loot_nocturna_abyss_depth_2_stone',
        name: 'Ноктурна: бездна II (порода)',
        entries: [
          { itemId: 'mat_black_basalt', weight: 72, minQuantity: 1, maxQuantity: 3, rarity: 'uncommon' },
          { itemId: 'mat_raw_stone', weight: 28, minQuantity: 1, maxQuantity: 2 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_2_glass',
        name: 'Ноктурна: бездна II (ночное стекло)',
        entries: [
          { itemId: 'mat_night_glass_shard', weight: 70, minQuantity: 1, maxQuantity: 3, rarity: 'rare' },
          { itemId: 'mat_gravity_tear_crystal', weight: 30, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_2_ash',
        name: 'Ноктурна: бездна II (пепел)',
        entries: [
          { itemId: 'mat_soul_ash', weight: 70, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'mat_soulbound_black_slag', weight: 30, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_2_runes',
        name: 'Ноктурна: бездна II (руны)',
        entries: [
          { itemId: 'mat_weak_rune_fragment', weight: 45, minQuantity: 1, maxQuantity: 3, rarity: 'rare' },
          { itemId: 'mat_night_rune_splinter', weight: 35, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'mat_rune_dust', weight: 20, minQuantity: 1, maxQuantity: 2, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_2_gem',
        name: 'Ноктурна: бездна II (осколки)',
        entries: [
          { itemId: 'mat_gravity_tear_crystal', weight: 70, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
          { itemId: 'mat_aurishel_crystal', weight: 30, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },

      {
        id: 'mine_loot_nocturna_abyss_depth_3_stone',
        name: 'Ноктурна: бездна III (порода)',
        entries: [
          { itemId: 'mat_black_basalt', weight: 68, minQuantity: 1, maxQuantity: 3, rarity: 'uncommon' },
          { itemId: 'mat_raw_stone', weight: 32, minQuantity: 1, maxQuantity: 2 },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_3_glass',
        name: 'Ноктурна: бездна III (ночное стекло)',
        entries: [
          { itemId: 'mat_night_glass_shard', weight: 62, minQuantity: 1, maxQuantity: 3, rarity: 'rare' },
          { itemId: 'mat_gravity_tear_crystal', weight: 28, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
          { itemId: 'mat_morgul_salt', weight: 10, minQuantity: 1, maxQuantity: 1, rarity: 'forbidden' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_3_ash',
        name: 'Ноктурна: бездна III (пепел душ)',
        entries: [
          { itemId: 'mat_soul_ash', weight: 60, minQuantity: 1, maxQuantity: 3, rarity: 'rare' },
          { itemId: 'mat_soulbound_black_slag', weight: 40, minQuantity: 1, maxQuantity: 2, rarity: 'epic' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_3_runes',
        name: 'Ноктурна: бездна III (рунические находки)',
        entries: [
          { itemId: 'mat_full_minor_rune_stone', weight: 12, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
          { itemId: 'mat_weak_rune_fragment', weight: 42, minQuantity: 1, maxQuantity: 3, rarity: 'rare' },
          { itemId: 'mat_night_rune_splinter', weight: 34, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'mat_rune_dust', weight: 12, minQuantity: 1, maxQuantity: 2, rarity: 'uncommon' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_3_gem',
        name: 'Ноктурна: бездна III (осколки)',
        entries: [
          { itemId: 'mat_gravity_tear_crystal', weight: 80, minQuantity: 1, maxQuantity: 2, rarity: 'epic' },
          { itemId: 'mat_aurishel_crystal', weight: 20, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_nocturna_abyss_depth_3_obsidian',
        name: 'Ноктурна: бездна III (обсидиан)',
        entries: [
          { itemId: 'mat_death_obsidian', weight: 100, minQuantity: 1, maxQuantity: 1, rarity: 'epic' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
    ],
    tools: [
      {
        id: 'mining_tool_rusty_pickaxe',
        professionId: 'mining',
        itemId: 'tool_pickaxe_rusty',
        toolType: 'pickaxe',
        name: 'Ржавая кирка',
        description: 'Старая, но надежная кирка для первых спусков.',
        effectType: 'extra_hits',
        effectValue: 0,
        isConsumable: false,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mining_tool_dynamite',
        professionId: 'mining',
        itemId: 'tool_dynamite',
        toolType: 'dynamite',
        name: 'Динамит',
        description: 'Моментально вскрывает один блок.',
        effectType: 'break_block',
        effectValue: 1,
        isConsumable: true,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mining_tool_torch',
        professionId: 'mining',
        itemId: 'tool_torch',
        toolType: 'torch',
        name: 'Факел',
        description: 'Подсказывает один перспективный блок.',
        effectType: 'reveal_hint',
        effectValue: 1,
        isConsumable: true,
        isEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
  };
}

function ensureSeeded(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const defaults = normalizeMiningBundle(defaultMiningContent());

  const mines = mergeById(
    readArray<unknown>(MINING_STORAGE_KEYS.mines).map(normalizeMine).filter((entry): entry is MineDefinition => Boolean(entry)),
    defaults.mines,
  );
  const depths = mergeById(
    readArray<unknown>(MINING_STORAGE_KEYS.depths).map(normalizeDepth).filter((entry): entry is MineDepth => Boolean(entry)),
    defaults.depths,
  );
  const blockTables = mergeById(
    readArray<unknown>(MINING_STORAGE_KEYS.blockTables).map(normalizeBlockTable).filter((entry): entry is MineBlockTable => Boolean(entry)),
    defaults.blockTables,
  );
  const hazards = mergeById(
    readArray<unknown>(MINING_STORAGE_KEYS.hazards).map(normalizeHazard).filter((entry): entry is MineHazard => Boolean(entry)),
    defaults.hazards,
  );
  const hazardTables = mergeById(
    readArray<unknown>(MINING_STORAGE_KEYS.hazardTables).map(normalizeHazardTable).filter((entry): entry is MineHazardTable => Boolean(entry)),
    defaults.hazardTables,
  );
  const lootTables = mergeById(
    readArray<unknown>(MINING_STORAGE_KEYS.lootTables).map(normalizeLootTable).filter((entry): entry is MineLootTable => Boolean(entry)),
    defaults.lootTables,
  );
  const tools = mergeById(
    readArray<unknown>(MINING_STORAGE_KEYS.tools).map(normalizeTool).filter((entry): entry is MiningToolDefinition => Boolean(entry)),
    defaults.tools ?? [],
  );

  writeArray(MINING_STORAGE_KEYS.mines, mines);
  writeArray(MINING_STORAGE_KEYS.depths, depths);
  writeArray(MINING_STORAGE_KEYS.blockTables, blockTables);
  writeArray(MINING_STORAGE_KEYS.hazards, hazards);
  writeArray(MINING_STORAGE_KEYS.hazardTables, hazardTables);
  writeArray(MINING_STORAGE_KEYS.lootTables, lootTables);
  writeArray(MINING_STORAGE_KEYS.tools, tools);
  window.localStorage.setItem(MINING_STORAGE_KEYS.seeded, 'true');
}

function normalizeMiningBundle(bundle: MiningContentBundle): MiningContentBundle {
  return {
    mines: bundle.mines.map(normalizeMine).filter((entry): entry is MineDefinition => Boolean(entry)),
    depths: bundle.depths.map(normalizeDepth).filter((entry): entry is MineDepth => Boolean(entry)),
    blockTables: bundle.blockTables.map(normalizeBlockTable).filter((entry): entry is MineBlockTable => Boolean(entry)),
    hazards: bundle.hazards.map(normalizeHazard).filter((entry): entry is MineHazard => Boolean(entry)),
    hazardTables: bundle.hazardTables.map(normalizeHazardTable).filter((entry): entry is MineHazardTable => Boolean(entry)),
    lootTables: bundle.lootTables.map(normalizeLootTable).filter((entry): entry is MineLootTable => Boolean(entry)),
    tools: (bundle.tools ?? []).map(normalizeTool).filter((entry): entry is MiningToolDefinition => Boolean(entry)),
  };
}

export function loadMinesFromStorage(): MineDefinition[] {
  ensureSeeded();
  return readArray<unknown>(MINING_STORAGE_KEYS.mines).map(normalizeMine).filter((entry): entry is MineDefinition => Boolean(entry));
}

export function saveMinesToStorage(mines: MineDefinition[]): void {
  writeArray(MINING_STORAGE_KEYS.mines, mines);
}

export function loadMineDepthsFromStorage(): MineDepth[] {
  ensureSeeded();
  return readArray<unknown>(MINING_STORAGE_KEYS.depths).map(normalizeDepth).filter((entry): entry is MineDepth => Boolean(entry));
}

export function saveMineDepthsToStorage(depths: MineDepth[]): void {
  writeArray(MINING_STORAGE_KEYS.depths, depths);
}

export function loadMineBlockTablesFromStorage(): MineBlockTable[] {
  ensureSeeded();
  return readArray<unknown>(MINING_STORAGE_KEYS.blockTables).map(normalizeBlockTable).filter((entry): entry is MineBlockTable => Boolean(entry));
}

export function saveMineBlockTablesToStorage(tables: MineBlockTable[]): void {
  writeArray(MINING_STORAGE_KEYS.blockTables, tables);
}

export function loadMineHazardsFromStorage(): MineHazard[] {
  ensureSeeded();
  return readArray<unknown>(MINING_STORAGE_KEYS.hazards).map(normalizeHazard).filter((entry): entry is MineHazard => Boolean(entry));
}

export function saveMineHazardsToStorage(hazards: MineHazard[]): void {
  writeArray(MINING_STORAGE_KEYS.hazards, hazards);
}

export function loadMineHazardTablesFromStorage(): MineHazardTable[] {
  ensureSeeded();
  return readArray<unknown>(MINING_STORAGE_KEYS.hazardTables).map(normalizeHazardTable).filter((entry): entry is MineHazardTable => Boolean(entry));
}

export function saveMineHazardTablesToStorage(tables: MineHazardTable[]): void {
  writeArray(MINING_STORAGE_KEYS.hazardTables, tables);
}

export function loadMineLootTablesFromStorage(): MineLootTable[] {
  ensureSeeded();
  return readArray<unknown>(MINING_STORAGE_KEYS.lootTables).map(normalizeLootTable).filter((entry): entry is MineLootTable => Boolean(entry));
}

export function saveMineLootTablesToStorage(tables: MineLootTable[]): void {
  writeArray(MINING_STORAGE_KEYS.lootTables, tables);
}

export function loadMiningToolsFromStorage(): MiningToolDefinition[] {
  ensureSeeded();
  return readArray<unknown>(MINING_STORAGE_KEYS.tools).map(normalizeTool).filter((entry): entry is MiningToolDefinition => Boolean(entry));
}

export function saveMiningToolsToStorage(tools: MiningToolDefinition[]): void {
  writeArray(MINING_STORAGE_KEYS.tools, tools);
}

export function findMineById(mineId: string): MineDefinition | null {
  const normalizedId = String(mineId ?? '').trim();
  return loadMinesFromStorage().find((entry) => entry.id === normalizedId) ?? null;
}

export function findMineDepthById(depthId: string): MineDepth | null {
  const normalizedId = String(depthId ?? '').trim();
  return loadMineDepthsFromStorage().find((entry) => entry.id === normalizedId) ?? null;
}

export function findMineDepthsByMineId(mineId: string): MineDepth[] {
  const normalizedId = String(mineId ?? '').trim();
  return loadMineDepthsFromStorage()
    .filter((entry) => entry.mineId === normalizedId && entry.isEnabled)
    .sort((left, right) => left.depthLevel - right.depthLevel);
}

export function findMineBlockTableById(id: string): MineBlockTable | null {
  const normalizedId = String(id ?? '').trim();
  return loadMineBlockTablesFromStorage().find((entry) => entry.id === normalizedId) ?? null;
}

export function findMineHazardById(id: string): MineHazard | null {
  const normalizedId = String(id ?? '').trim();
  return loadMineHazardsFromStorage().find((entry) => entry.id === normalizedId) ?? null;
}

export function findMineHazardTableById(id: string): MineHazardTable | null {
  const normalizedId = String(id ?? '').trim();
  return loadMineHazardTablesFromStorage().find((entry) => entry.id === normalizedId) ?? null;
}

export function findMineLootTableById(id: string): MineLootTable | null {
  const normalizedId = String(id ?? '').trim();
  return loadMineLootTablesFromStorage().find((entry) => entry.id === normalizedId) ?? null;
}

export function findMiningToolById(id: string): MiningToolDefinition | null {
  const normalizedId = String(id ?? '').trim();
  return loadMiningToolsFromStorage().find((entry) => entry.id === normalizedId) ?? null;
}

export function getMiningContentSnapshot(): MiningContentBundle {
  ensureSeeded();
  return clone({
    mines: loadMinesFromStorage(),
    depths: loadMineDepthsFromStorage(),
    blockTables: loadMineBlockTablesFromStorage(),
    hazards: loadMineHazardsFromStorage(),
    hazardTables: loadMineHazardTablesFromStorage(),
    lootTables: loadMineLootTablesFromStorage(),
    tools: loadMiningToolsFromStorage(),
  });
}

export function resetMiningContentToDefaults(): MiningContentBundle {
  const defaults = normalizeMiningBundle(defaultMiningContent());
  saveMinesToStorage(defaults.mines);
  saveMineDepthsToStorage(defaults.depths);
  saveMineBlockTablesToStorage(defaults.blockTables);
  saveMineHazardsToStorage(defaults.hazards);
  saveMineHazardTablesToStorage(defaults.hazardTables);
  saveMineLootTablesToStorage(defaults.lootTables);
  saveMiningToolsToStorage(defaults.tools ?? []);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MINING_STORAGE_KEYS.seeded, 'true');
  }
  return clone(defaults);
}
