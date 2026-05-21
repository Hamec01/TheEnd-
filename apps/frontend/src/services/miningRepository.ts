import type {
  MineBlockPayload,
  MineBlockTable,
  MineDefinition,
  MineDepth,
  MineHazard,
  MineHazardTable,
  MineLootTable,
  MiningContentBundle,
} from '../types/mining';
import { fixMojibake } from '../utils/fixMojibake';

const MINING_STORAGE_KEYS = {
  mines: 'theend.mining.mines',
  depths: 'theend.mining.depths',
  blockTables: 'theend.mining.blockTables',
  hazards: 'theend.mining.hazards',
  hazardTables: 'theend.mining.hazardTables',
  lootTables: 'theend.mining.lootTables',
  seeded: 'theend.mining.seeded.v2',
} as const;

export const MINING_MINE_STORAGE_KEY = MINING_STORAGE_KEYS.mines;

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

  return {
    id,
    name: fixMojibake(name),
    description: fixMojibake(String(row.description ?? '').trim()),
    shortDescription: fixMojibake(String(row.shortDescription ?? '').trim()) || undefined,
    requiredProfessionId: 'mining',
    requiredMiningLevel: Math.max(1, Math.floor(Number(row.requiredMiningLevel ?? 1))),
    dangerLevel,
    visualTheme,
    region: fixMojibake(String(row.region ?? '').trim()) || undefined,
    depthIds: Array.isArray(row.depthIds) ? row.depthIds.map((entry) => String(entry ?? '').trim()).filter(Boolean) : [],
    knownResources: Array.isArray(row.knownResources) ? row.knownResources.map((entry) => fixMojibake(String(entry ?? '').trim())).filter(Boolean) : [],
    entryText: fixMojibake(String(row.entryText ?? '').trim()) || undefined,
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

  return {
    id,
    mineId,
    depthLevel: Math.max(1, Math.floor(Number(row.depthLevel ?? 1))),
    name: fixMojibake(name),
    description: fixMojibake(String(row.description ?? '').trim()) || undefined,
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
    backgroundImage: fixMojibake(String(row.backgroundImage ?? '').trim()) || undefined,
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

  const entries: MineBlockTable['entries'] = [];
  if (Array.isArray(row.entries)) {
    for (const entry of row.entries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }
      const block = entry as Record<string, unknown>;
      const type = String(block.type ?? '').trim();
      const weight = Number(block.weight ?? 0);
      if (!type || !Number.isFinite(weight) || weight <= 0) {
        continue;
      }
      const payloads: MineBlockTable['entries'][number]['payloads'] = [];
      if (Array.isArray(block.payloads)) {
        for (const payload of block.payloads) {
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            continue;
          }
          const rawPayload = payload as Record<string, unknown>;
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
            rarity: fixMojibake(String(rawPayload.rarity ?? '').trim()) || undefined,
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
        label: fixMojibake(String(block.label ?? '').trim()) || undefined,
        description: fixMojibake(String(block.description ?? '').trim()) || undefined,
        payloads: payloads.length > 0 ? payloads : undefined,
      });
    }
  }

  return {
    id,
    name: fixMojibake(name),
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

  return {
    id,
    name: fixMojibake(name),
    type: type as MineHazard['type'],
    description: fixMojibake(String(row.description ?? '').trim()),
    hpDamageMin: Math.max(0, Math.floor(Number(row.hpDamageMin ?? 0))),
    hpDamageMax: Math.max(0, Math.floor(Number(row.hpDamageMax ?? 0))),
    staminaDamageMin: Math.max(0, Math.floor(Number(row.staminaDamageMin ?? 0))),
    staminaDamageMax: Math.max(0, Math.floor(Number(row.staminaDamageMax ?? 0))),
    lootLossChance: Math.max(0, Number(row.lootLossChance ?? 0)),
    lootLossPercent: Math.max(0, Number(row.lootLossPercent ?? 0)),
    statusEffectIds: Array.isArray(row.statusEffectIds) ? row.statusEffectIds.map((entry) => fixMojibake(String(entry ?? '').trim())).filter(Boolean) : [],
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
    name: fixMojibake(name),
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

  const entries: MineLootTable['entries'] = [];
  if (Array.isArray(row.entries)) {
    for (const entry of row.entries) {
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
      entries.push({
        itemId,
        weight,
        minQuantity: Math.max(1, Math.floor(minQuantity)),
        maxQuantity: Math.max(1, Math.floor(maxQuantity)),
        requiredDepth: Number.isFinite(Number(value.requiredDepth)) ? Math.max(1, Math.floor(Number(value.requiredDepth))) : undefined,
        rarity: fixMojibake(String(value.rarity ?? '').trim()) || undefined,
      });
    }
  }

  return {
    id,
    name: fixMojibake(name),
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
        name: 'Ð¡Ñ‚Ð°Ñ€Ð°Ñ ÑˆÐ°Ñ…Ñ‚Ð° Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€Ð°',
        description: 'Ð¡Ñ‚Ð°Ñ€Ð°Ñ ÑˆÐ°Ñ…Ñ‚Ð° Ð² Ð·ÐµÐ¼Ð»ÑÑ… Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€Ð°. Ð—Ð´ÐµÑÑŒ Ð¼Ð¾Ð¶Ð½Ð¾ Ð½Ð°Ð¹Ñ‚Ð¸ ÐºÐ°Ð¼ÐµÐ½ÑŒ, Ð¶ÐµÐ»ÐµÐ·Ð¾, Ð·Ð¾Ð»Ð¾Ñ‚Ð¾ Ð¸ Ñ€ÐµÐ´ÐºÐ¸Ðµ Ð·ÐµÐ¿Ñ‚Ð¸Ñ€Ð¸Ñ‚Ð¾Ð²Ñ‹Ðµ ÑÐ»ÐµÐ´Ñ‹.',
        shortDescription: 'Ð¡Ñ‚Ð°Ñ€Ñ‹Ðµ ÑˆÑ‚Ñ€ÐµÐºÐ¸ Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€Ð° Ñ Ð¶ÐµÐ»ÐµÐ·Ð¾Ð¼ Ð¸ Ñ€ÐµÐ´ÐºÐ¸Ð¼Ð¸ ÑÐ»ÐµÐ´Ð°Ð¼Ð¸ Ð·ÐµÐ¿Ñ‚Ð¸Ñ€Ð¸Ñ‚Ð°.',
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
          'ÐšÐ°Ð¼ÐµÐ½ÑŒ',
          'Ð–ÐµÐ»ÐµÐ·Ð½Ð°Ñ Ñ€ÑƒÐ´Ð°',
          'Ð—Ð¾Ð»Ð¾Ñ‚Ð¾',
          'Ð—ÐµÐ¿Ñ‚Ð¸Ñ€Ð¸Ñ‚Ð¾Ð²Ñ‹Ð¹ ÑÐ»ÐµÐ´',
        ],
        entryText: 'Ð¥Ð¾Ð»Ð¾Ð´Ð½Ñ‹Ð¹ Ð²Ð¾Ð·Ð´ÑƒÑ… Ð¿Ð°Ñ…Ð½ÐµÑ‚ ÑÑ‹Ñ€Ð¾ÑÑ‚ÑŒÑŽ Ð¸ Ð¿Ñ‹Ð»ÑŒÑŽ. Ð—Ð° Ñ€Ð¶Ð°Ð²Ð¾Ð¹ Ñ€ÐµÑˆÑ‘Ñ‚ÐºÐ¾Ð¹ Ð½Ð°Ñ‡Ð¸Ð½Ð°ÐµÑ‚ÑÑ ÑÑ‚Ð°Ñ€Ð°Ñ Ñ‚ÐµÑ€Ð°Ð¼Ð¾Ñ€ÑÐºÐ°Ñ Ð²Ñ‹Ñ€Ð°Ð±Ð¾Ñ‚ÐºÐ°.',
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
        name: 'Ð’ÐµÑ€Ñ…Ð½Ð¸Ðµ ÑˆÑ‚Ñ€ÐµÐºÐ¸',
        description: 'Ð¡Ñ‚Ð°Ñ€Ñ‹Ðµ Ð¿Ñ€Ð¾Ñ…Ð¾Ð´Ñ‹ Ñ ÑƒÑÑ‚Ð¾Ð¹Ñ‡Ð¸Ð²Ñ‹Ð¼Ð¸ ÑÑ‚ÐµÐ½Ð°Ð¼Ð¸ Ð¸ Ð¼ÐµÐ»ÐºÐ¸Ð¼Ð¸ Ð¶Ð¸Ð»Ð°Ð¼Ð¸ Ð¶ÐµÐ»ÐµÐ·Ð°.',
        rows: 4,
        columns: 6,
        baseHits: 13,
        staminaCostPerHit: 2,
        baseCollapseRisk: 0.03,
        riskIncreasePerHit: 0.005,
        lootTableId: 'mine_loot_teramor_depth_1',
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
        name: 'Ð¡Ñ€ÐµÐ´Ð½Ð¸Ðµ Ð¶Ð¸Ð»Ñ‹',
        description: 'Ð’Ð¾Ð·Ð´ÑƒÑ… Ñ‚ÑÐ¶ÐµÐ»ÐµÐµ, Ð° Ð¿Ð¾Ñ€Ð¾Ð´Ð° Ð±Ð¾Ð³Ð°Ñ‡Ðµ Ð¸ Ð·Ð»ÐµÐµ.',
        rows: 4,
        columns: 4,
        baseHits: 10,
        staminaCostPerHit: 3,
        baseCollapseRisk: 0.07,
        riskIncreasePerHit: 0.01,
        lootTableId: 'mine_loot_teramor_depth_2',
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
        name: 'Ð“Ð»ÑƒÐ±Ð¾ÐºÐ¸Ð¹ ÐºÐ°Ñ€Ð¼Ð°Ð½',
        description: 'Ð¢ÑƒÑ‚ ÑƒÐ¶Ðµ ÑÐ»Ñ‹ÑˆÐ½Ð¾, ÐºÐ°Ðº Ð³Ð¾Ñ€Ð° Ð¶Ð¸Ð²Ñ‘Ñ‚ ÑÐ²Ð¾ÐµÐ¹ Ð¶Ð¸Ð·Ð½ÑŒÑŽ.',
        rows: 3,
        columns: 4,
        baseHits: 7,
        staminaCostPerHit: 5,
        baseCollapseRisk: 0.12,
        riskIncreasePerHit: 0.015,
        lootTableId: 'mine_loot_teramor_depth_3',
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
    ],
    blockTables: [
      {
        id: 'mine_blocks_teramor_depth_1',
        name: 'Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€ I',
        mineId: 'mine_teramor_old_iron',
        depthLevel: 1,
        entries: [
          { type: 'empty', weight: 18, label: 'ÐŸÑƒÑÑ‚Ð°Ñ Ð¿Ð¾Ñ€Ð¾Ð´Ð°' },
          { type: 'stone', weight: 26, label: 'ÐšÐ°Ð¼ÐµÐ½ÑŒ', lootTableId: 'mine_loot_teramor_depth_1' },
          { type: 'ore', weight: 28, label: 'Ð–ÐµÐ»ÐµÐ·Ð½Ð°Ñ Ð¶Ð¸Ð»Ð°', lootTableId: 'mine_loot_teramor_depth_1' },
          { type: 'gold', weight: 8, label: 'Ð—Ð¾Ð»Ð¾Ñ‚Ð¾Ð¹ ÑÐ»ÐµÐ´', lootTableId: 'mine_loot_teramor_depth_1' },
          { type: 'crystal', weight: 4, label: 'ÐšÑ€Ð¸ÑÑ‚Ð°Ð»Ð»', lootTableId: 'mine_loot_teramor_depth_1' },
          { type: 'hazard', weight: 8, label: 'ÐžÐ¿Ð°ÑÐ½Ð°Ñ Ñ‚Ñ€ÐµÑ‰Ð¸Ð½Ð°', hazardTableId: 'mine_hazards_teramor_common' },
          { type: 'passage', weight: 4, label: 'Ð£Ð·ÐºÐ¸Ð¹ Ð¿Ñ€Ð¾Ñ…Ð¾Ð´' },
          { type: 'exit', weight: 4, label: 'Ð’Ñ‹Ñ…Ð¾Ð´' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_blocks_teramor_depth_2',
        name: 'Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€ II',
        mineId: 'mine_teramor_old_iron',
        depthLevel: 2,
        entries: [
          { type: 'empty', weight: 12, label: 'ÐŸÑƒÑÑ‚Ð¾Ñ‚Ð°' },
          { type: 'stone', weight: 20, label: 'ÐšÐ°Ð¼ÐµÐ½ÑŒ', lootTableId: 'mine_loot_teramor_depth_2' },
          { type: 'ore', weight: 26, label: 'Ð–Ð¸Ð»Ð° Ð¶ÐµÐ»ÐµÐ·Ð°', lootTableId: 'mine_loot_teramor_depth_2' },
          { type: 'rich_ore', weight: 10, label: 'Ð‘Ð¾Ð³Ð°Ñ‚Ð°Ñ Ð¶Ð¸Ð»Ð°', lootTableId: 'mine_loot_teramor_depth_2' },
          { type: 'gold', weight: 10, label: 'Ð—Ð¾Ð»Ð¾Ñ‚Ð¾', lootTableId: 'mine_loot_teramor_depth_2' },
          { type: 'crystal', weight: 6, label: 'ÐšÑ€Ð¸ÑÑ‚Ð°Ð»Ð»', lootTableId: 'mine_loot_teramor_depth_2' },
          { type: 'hazard', weight: 10, label: 'ÐžÐ¿Ð°ÑÐ½Ð¾ÑÑ‚ÑŒ', hazardTableId: 'mine_hazards_teramor_deep' },
          { type: 'passage', weight: 3, label: 'Ð¡Ð¿ÑƒÑÐº Ð½Ð¸Ð¶Ðµ' },
          { type: 'exit', weight: 3, label: 'Ð’Ñ‹Ñ…Ð¾Ð´' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_blocks_teramor_depth_3',
        name: 'Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€ III',
        mineId: 'mine_teramor_old_iron',
        depthLevel: 3,
        entries: [
          { type: 'empty', weight: 8, label: 'Пустота' },
          { type: 'stone', weight: 15, label: 'Камень', lootTableId: 'mine_loot_teramor_depth_3' },
          { type: 'ore', weight: 22, label: 'Жила', lootTableId: 'mine_loot_teramor_depth_3' },
          { type: 'rich_ore', weight: 14, label: 'Богатая жила', lootTableId: 'mine_loot_teramor_depth_3', payloads: [{ type: 'rune_trace', weight: 2, itemId: 'item_rune_fragment_weak', minQuantity: 1, maxQuantity: 1, rarity: 'rare', minDepth: 3, tags: ['porter_save_allowed'] }, { type: 'loot_item', weight: 8, itemId: 'item_iron_ore', minQuantity: 2, maxQuantity: 4 }] },
          { type: 'gold', weight: 10, label: 'Золото', lootTableId: 'mine_loot_teramor_depth_3' },
          { type: 'gem', weight: 6, label: 'Драгоценный камень', lootTableId: 'mine_loot_teramor_depth_3' },
          { type: 'crystal', weight: 8, label: 'Кристалл', lootTableId: 'mine_loot_teramor_depth_3' },
          { type: 'hazard', weight: 12, label: 'Опасность', hazardTableId: 'mine_hazards_teramor_deep' },
          { type: 'event', weight: 5, label: 'Древнее эхо', payloads: [{ type: 'event_ref', weight: 3, eventId: 'ancient_tablet', minDepth: 3 }, { type: 'event_ref', weight: 3, eventId: 'hidden_cache', minDepth: 3 }, { type: 'event_ref', weight: 2, eventId: 'old_mining_mark', minDepth: 3 }, { type: 'event_ref', weight: 1, eventId: 'spirit_whisper', minDepth: 3 }, { type: 'event_ref', weight: 1, eventId: 'dwarf_cart', minDepth: 3 }] },
          { type: 'exit', weight: 5, label: 'Выход' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
    ],
    hazards: [
      {
        id: 'hazard_minor_collapse',
        name: 'ÐœÐ°Ð»Ñ‹Ð¹ Ð¾Ð±Ð²Ð°Ð»',
        type: 'minor_collapse',
        description: 'ÐÐµÑÐºÐ¾Ð»ÑŒÐºÐ¾ ÐºÐ°Ð¼Ð½ÐµÐ¹ ÑÑ€Ñ‹Ð²Ð°ÑŽÑ‚ÑÑ ÑÐ²ÐµÑ€Ñ…Ñƒ Ð¸ Ð±Ð¾Ð»ÑŒÐ½Ð¾ Ð±ÑŒÑŽÑ‚ Ð¿Ð¾ Ð¿Ð»ÐµÑ‡Ð°Ð¼.',
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
        name: 'Ð¡Ñ€ÐµÐ´Ð½Ð¸Ð¹ Ð¾Ð±Ð²Ð°Ð»',
        type: 'medium_collapse',
        description: 'ÐŸÐ¾Ñ€Ð¾Ð´Ð° Ñ‚Ñ€ÐµÑ‰Ð¸Ñ‚ Ð¸ Ð¾ÑÑ‹Ð¿Ð°ÐµÑ‚ÑÑ Ð·Ð°Ð¼ÐµÑ‚Ð½Ð¾ ÑÐ¸Ð»ÑŒÐ½ÐµÐµ.',
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
        name: 'Ð¨Ð°Ñ…Ñ‚Ð½Ð°Ñ Ð¿Ñ‹Ð»ÑŒ',
        type: 'dust',
        description: 'Ð¢ÑÐ¶Ñ‘Ð»Ð°Ñ Ð¿Ñ‹Ð»ÑŒ Ð·Ð°Ð±Ð¸Ð²Ð°ÐµÑ‚ Ð»Ñ‘Ð³ÐºÐ¸Ðµ Ð¸ ÑÐ±Ð¸Ð²Ð°ÐµÑ‚ Ð´Ñ‹Ñ…Ð°Ð½Ð¸Ðµ.',
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
        name: 'Ð“Ð°Ð·Ð¾Ð²Ñ‹Ð¹ ÐºÐ°Ñ€Ð¼Ð°Ð½',
        type: 'gas',
        description: 'Ð˜Ð· Ñ‰ÐµÐ»Ð¸ Ð²Ñ‹Ñ€Ñ‹Ð²Ð°ÐµÑ‚ÑÑ ÑƒÐ´ÑƒÑˆÐ»Ð¸Ð²Ñ‹Ð¹ Ð³Ð°Ð·.',
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
        name: 'Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€: Ð¾Ð±Ñ‹Ñ‡Ð½Ñ‹Ðµ Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑ‚Ð¸',
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
        name: 'Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€: Ð³Ð»ÑƒÐ±Ð¾ÐºÐ¸Ðµ Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑ‚Ð¸',
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
    ],
    lootTables: [
      {
        id: 'mine_loot_teramor_depth_1',
        name: 'Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€ I',
        entries: [
          { itemId: 'item_raw_stone', weight: 40, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'item_iron_ore', weight: 35, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'item_small_gold_nugget', weight: 12, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
          { itemId: 'item_cracked_crystal', weight: 8, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
          { itemId: 'item_zeptyrite_trace', weight: 5, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_2',
        name: 'Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€ II',
        entries: [
          { itemId: 'item_raw_stone', weight: 28, minQuantity: 1, maxQuantity: 3 },
          { itemId: 'item_iron_ore', weight: 34, minQuantity: 1, maxQuantity: 3 },
          { itemId: 'item_small_gold_nugget', weight: 16, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'item_cracked_crystal', weight: 12, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'item_zeptyrite_trace', weight: 10, minQuantity: 1, maxQuantity: 2, rarity: 'epic' },
        ],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'mine_loot_teramor_depth_3',
        name: 'Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€ III',
        entries: [
          { itemId: 'item_raw_stone', weight: 20, minQuantity: 1, maxQuantity: 2 },
          { itemId: 'item_iron_ore', weight: 26, minQuantity: 2, maxQuantity: 4 },
          { itemId: 'item_small_gold_nugget', weight: 18, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'item_cracked_crystal', weight: 18, minQuantity: 1, maxQuantity: 2, rarity: 'rare' },
          { itemId: 'item_zeptyrite_trace', weight: 18, minQuantity: 1, maxQuantity: 3, rarity: 'epic' },
        ],
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
  const defaults = defaultMiningContent();
  writeArray(MINING_STORAGE_KEYS.mines, mergeById(readArray<MineDefinition>(MINING_STORAGE_KEYS.mines), defaults.mines));
  writeArray(MINING_STORAGE_KEYS.depths, mergeById(readArray<MineDepth>(MINING_STORAGE_KEYS.depths), defaults.depths));
  writeArray(MINING_STORAGE_KEYS.blockTables, mergeById(readArray<MineBlockTable>(MINING_STORAGE_KEYS.blockTables), defaults.blockTables));
  writeArray(MINING_STORAGE_KEYS.hazards, mergeById(readArray<MineHazard>(MINING_STORAGE_KEYS.hazards), defaults.hazards));
  writeArray(MINING_STORAGE_KEYS.hazardTables, mergeById(readArray<MineHazardTable>(MINING_STORAGE_KEYS.hazardTables), defaults.hazardTables));
  writeArray(MINING_STORAGE_KEYS.lootTables, mergeById(readArray<MineLootTable>(MINING_STORAGE_KEYS.lootTables), defaults.lootTables));
  window.localStorage.setItem(MINING_STORAGE_KEYS.seeded, 'true');
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

export function getMiningContentSnapshot(): MiningContentBundle {
  ensureSeeded();
  return clone({
    mines: loadMinesFromStorage(),
    depths: loadMineDepthsFromStorage(),
    blockTables: loadMineBlockTablesFromStorage(),
    hazards: loadMineHazardsFromStorage(),
    hazardTables: loadMineHazardTablesFromStorage(),
    lootTables: loadMineLootTablesFromStorage(),
  });
}

export function resetMiningContentToDefaults(): MiningContentBundle {
  const defaults = defaultMiningContent();
  saveMinesToStorage(defaults.mines);
  saveMineDepthsToStorage(defaults.depths);
  saveMineBlockTablesToStorage(defaults.blockTables);
  saveMineHazardsToStorage(defaults.hazards);
  saveMineHazardTablesToStorage(defaults.hazardTables);
  saveMineLootTablesToStorage(defaults.lootTables);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MINING_STORAGE_KEYS.seeded, 'true');
  }
  return clone(defaults);
}
