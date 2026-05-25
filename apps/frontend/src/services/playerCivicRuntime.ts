import {
  applyCitizenshipChange,
  createInitialCitizenshipState,
  isKingdomId,
  KINGDOM_BONUS_CONFIG,
  type CharacterCitizenshipState,
  type KingdomId,
  type ReputationDelta,
} from '@theend/rpg-domain';

export const PLAYER_REP_KEY = 'theend.player.reputation';
export const PLAYER_CITIZENSHIP_KEY = 'theend.player.citizenship';

function safeParseRecord(raw: string | null): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function readPlayerReputation(): Record<string, number> {
  if (typeof window === 'undefined') {
    return {};
  }
  const record = safeParseRecord(window.localStorage.getItem(PLAYER_REP_KEY));
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    const amount = Number(value);
    normalized[key] = Number.isFinite(amount) ? Math.trunc(amount) : 0;
  }
  return normalized;
}

export function writePlayerReputation(value: Record<string, number>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(PLAYER_REP_KEY, JSON.stringify(value));
}

export function readPlayerCitizenshipKingdomId(): KingdomId | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = String(window.localStorage.getItem(PLAYER_CITIZENSHIP_KEY) ?? '').trim();
  return isKingdomId(raw) ? raw : null;
}

export function writePlayerCitizenshipKingdomId(value: KingdomId | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (value) {
    window.localStorage.setItem(PLAYER_CITIZENSHIP_KEY, value);
    return;
  }
  window.localStorage.removeItem(PLAYER_CITIZENSHIP_KEY);
}

export function readPlayerCitizenshipState(): CharacterCitizenshipState {
  const citizenshipKingdomId = readPlayerCitizenshipKingdomId();
  const defaults = createInitialCitizenshipState(citizenshipKingdomId);
  const currentReputation = readPlayerReputation();
  return {
    citizenshipKingdomId,
    kingdomReputation: {
      ...defaults.kingdomReputation,
      ...Object.fromEntries(
        Object.entries(currentReputation).filter(([key]) => isKingdomId(key)),
      ),
    } as CharacterCitizenshipState['kingdomReputation'],
  };
}

function applyLuminorReputationBonus(delta: ReputationDelta, source: 'dialogue' | 'quest' | 'interaction'): number {
  const citizenshipKingdomId = readPlayerCitizenshipKingdomId();
  const baseAmount = Math.trunc(Number(delta.amount ?? 0));
  if (citizenshipKingdomId !== 'luminor' || baseAmount <= 0 || !isKingdomId(delta.kingdomId ?? '')) {
    return baseAmount;
  }

  let amount = Math.round(baseAmount * (KINGDOM_BONUS_CONFIG.luminor.reputationGainMultiplierHumanKingdoms ?? 1));
  if (source === 'dialogue') {
    amount += KINGDOM_BONUS_CONFIG.luminor.dialogueReputationBonus ?? 0;
  }
  return amount;
}

export function applyPlayerReputationChanges(
  deltas: ReputationDelta[],
  options?: { source?: 'dialogue' | 'quest' | 'interaction' },
): string[] {
  const source = options?.source ?? 'interaction';
  const reputation = readPlayerReputation();
  const logs: string[] = [];

  for (const delta of deltas) {
    const targetKey = String(delta.factionId ?? delta.kingdomId ?? '').trim();
    if (!targetKey) {
      continue;
    }

    const amount = delta.kingdomId
      ? applyLuminorReputationBonus(delta, source)
      : Math.trunc(Number(delta.amount ?? 0));
    const current = Number(reputation[targetKey] ?? 0);
    reputation[targetKey] = current + amount;

    const label = delta.kingdomId ? `kingdom:${targetKey}` : `faction:${targetKey}`;
    const prefix = amount >= 0 ? '+' : '';
    logs.push(`Reputation changed: ${label} (${prefix}${amount})`);
  }

  writePlayerReputation(reputation);
  return logs;
}

export function applyPlayerCitizenshipCommand(newKingdomId: KingdomId): string[] {
  const current = readPlayerCitizenshipState();
  if (current.citizenshipKingdomId === newKingdomId) {
    return [`Citizenship unchanged: ${newKingdomId}`];
  }

  const previousKingdomId = current.citizenshipKingdomId;
  const updated = applyCitizenshipChange(current, newKingdomId);

  writePlayerCitizenshipKingdomId(updated.citizenshipKingdomId);

  const reputation = readPlayerReputation();
  for (const [key, value] of Object.entries(updated.kingdomReputation)) {
    reputation[key] = Math.trunc(Number(value ?? 0));
  }
  writePlayerReputation(reputation);

  if (!previousKingdomId) {
    return [
      `Вы приняли подданство ${KINGDOM_BONUS_CONFIG[newKingdomId].label}.`,
      `Репутация с ${KINGDOM_BONUS_CONFIG[newKingdomId].label} повышена на 20.`,
    ];
  }

  return [
    `Вы отказались от подданства ${KINGDOM_BONUS_CONFIG[previousKingdomId].label} и приняли подданство ${KINGDOM_BONUS_CONFIG[newKingdomId].label}.`,
    `Репутация с ${KINGDOM_BONUS_CONFIG[previousKingdomId].label} снижена на 50.`,
    `Репутация с ${KINGDOM_BONUS_CONFIG[newKingdomId].label} повышена на 20.`,
  ];
}
