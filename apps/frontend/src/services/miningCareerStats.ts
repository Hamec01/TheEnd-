import type { MineRunState } from '../types/mining';

const MINING_CAREER_STATS_PREFIX = 'theend.miningCareerStats';

export interface MiningCareerInventoryEntry {
  toolId: string;
  itemId: string;
  name: string;
  quantity: number;
  iconUrl?: string;
}

export interface MiningCareerStats {
  totalRuns: number;
  escapedRuns: number;
  retreatedRuns: number;
  failedRuns: number;
  deadRuns: number;
  totalHpLost: number;
  totalStaminaLost: number;
  deepestDepthReached: number;
  totalGoldEarned: number;
  totalXpEarned: number;
  totalLootItems: number;
  lastRunAt?: string;
  lastMineId?: string;
  lastStatus?: MineRunState['status'];
  lastMiningInventory?: MiningCareerInventoryEntry[];
}

function getMiningCareerStatsStorageKey(characterId: string): string {
  return `${MINING_CAREER_STATS_PREFIX}.${characterId}`;
}

function normalizeEntry(raw: unknown): MiningCareerInventoryEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const toolId = String(row.toolId ?? '').trim();
  const itemId = String(row.itemId ?? '').trim();
  const name = String(row.name ?? '').trim();
  const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0));
  if (!toolId || !itemId || !name || quantity <= 0) {
    return null;
  }
  const iconUrl = String(row.iconUrl ?? '').trim();
  return {
    toolId,
    itemId,
    name,
    quantity,
    iconUrl: iconUrl || undefined,
  };
}

function normalizeStats(raw: unknown): MiningCareerStats {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      totalRuns: 0,
      escapedRuns: 0,
      retreatedRuns: 0,
      failedRuns: 0,
      deadRuns: 0,
      totalHpLost: 0,
      totalStaminaLost: 0,
      deepestDepthReached: 0,
      totalGoldEarned: 0,
      totalXpEarned: 0,
      totalLootItems: 0,
    };
  }

  const row = raw as Record<string, unknown>;
  const toInt = (value: unknown): number => Math.max(0, Math.floor(Number(value) || 0));

  const inventory = Array.isArray(row.lastMiningInventory)
    ? row.lastMiningInventory.map(normalizeEntry).filter((entry): entry is MiningCareerInventoryEntry => Boolean(entry))
    : [];

  return {
    totalRuns: toInt(row.totalRuns),
    escapedRuns: toInt(row.escapedRuns),
    retreatedRuns: toInt(row.retreatedRuns),
    failedRuns: toInt(row.failedRuns),
    deadRuns: toInt(row.deadRuns),
    totalHpLost: toInt(row.totalHpLost),
    totalStaminaLost: toInt(row.totalStaminaLost),
    deepestDepthReached: toInt(row.deepestDepthReached),
    totalGoldEarned: toInt(row.totalGoldEarned),
    totalXpEarned: toInt(row.totalXpEarned),
    totalLootItems: toInt(row.totalLootItems),
    lastRunAt: String(row.lastRunAt ?? '').trim() || undefined,
    lastMineId: String(row.lastMineId ?? '').trim() || undefined,
    lastStatus: ['active', 'escaped', 'retreated', 'failed', 'dead'].includes(String(row.lastStatus ?? '').trim())
      ? (String(row.lastStatus ?? '').trim() as MineRunState['status'])
      : undefined,
    lastMiningInventory: inventory,
  };
}

export function loadMiningCareerStats(characterId: string): MiningCareerStats {
  if (typeof window === 'undefined') {
    return normalizeStats(null);
  }

  const raw = window.localStorage.getItem(getMiningCareerStatsStorageKey(characterId));
  if (!raw) {
    return normalizeStats(null);
  }

  try {
    return normalizeStats(JSON.parse(raw));
  } catch {
    return normalizeStats(null);
  }
}

export function saveMiningCareerStats(characterId: string, stats: MiningCareerStats): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(getMiningCareerStatsStorageKey(characterId), JSON.stringify(normalizeStats(stats)));
}

export function recordMiningCareerRun(characterId: string, run: MineRunState, xpAward: number): MiningCareerStats {
  const current = loadMiningCareerStats(characterId);
  const hpLost = Math.max(0, Math.floor(Number(run.maxHp ?? 0) - Number(run.hp ?? 0)));
  const staminaLost = Math.max(0, Math.floor(Number(run.maxStamina ?? 0) - Number(run.stamina ?? 0)));
  const goldEarned = Math.max(0, Math.floor(Number(run.awardedGold ?? run.temporaryGold ?? 0)));
  const lootItems = (run.awardedLoot ?? run.temporaryLoot ?? []).reduce((sum, entry) => (
    sum + Math.max(0, Math.floor(Number(entry.quantity) || 0))
  ), 0);

  const next: MiningCareerStats = {
    ...current,
    totalRuns: current.totalRuns + 1,
    escapedRuns: current.escapedRuns + (run.status === 'escaped' ? 1 : 0),
    retreatedRuns: current.retreatedRuns + (run.status === 'retreated' ? 1 : 0),
    failedRuns: current.failedRuns + (run.status === 'failed' ? 1 : 0),
    deadRuns: current.deadRuns + (run.status === 'dead' ? 1 : 0),
    totalHpLost: current.totalHpLost + hpLost,
    totalStaminaLost: current.totalStaminaLost + staminaLost,
    deepestDepthReached: Math.max(current.deepestDepthReached, Math.max(0, Math.floor(Number(run.currentDepthLevel) || 0))),
    totalGoldEarned: current.totalGoldEarned + goldEarned,
    totalXpEarned: current.totalXpEarned + Math.max(0, Math.floor(Number(xpAward) || 0)),
    totalLootItems: current.totalLootItems + lootItems,
    lastRunAt: new Date().toISOString(),
    lastMineId: String(run.mineId ?? '').trim() || undefined,
    lastStatus: run.status,
    lastMiningInventory: (run.miningInventory ?? []).map((entry) => ({
      toolId: String(entry.toolId ?? '').trim(),
      itemId: String(entry.itemId ?? '').trim(),
      name: String(entry.name ?? '').trim() || String(entry.itemId ?? '').trim(),
      quantity: Math.max(0, Math.floor(Number(entry.quantity) || 0)),
      iconUrl: String(entry.iconUrl ?? '').trim() || undefined,
    })).filter((entry) => entry.toolId && entry.itemId && entry.quantity > 0),
  };

  saveMiningCareerStats(characterId, next);
  return next;
}
