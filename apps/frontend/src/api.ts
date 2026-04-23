import type {
  ActionType,
  ArenaBattleState,
  CombatSkillType,
  Equipment,
  InventoryState,
  PrimaryStat,
  Race,
  StatBlock,
  DistanceBand,
  TargetZone,
} from '@theend/rpg-domain';

const API_BASE = 'http://localhost:3001';

export interface RegisterRequest {
  login: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  login: string;
  createdAt: string;
}

export interface CharacterSummary {
  id: string;
  name: string;
  race: Race;
  level: number;
}

export interface CreateCharacterRequest {
  name: string;
  race: Race;
  allocation: Partial<Record<PrimaryStat, number>>;
}

export interface ArenaHubState {
  character: {
    id: string;
    name: string;
    race: Race;
    level: number;
    exp: number;
    freePoints: number;
    baseStats: StatBlock;
    activeStats: StatBlock;
  };
  inventory: InventoryState;
  equipment: Equipment;
}

export interface CustomArenaNpcPayload {
  name: string;
  race: Race;
  stats: StatBlock;
  equipment?: Partial<Equipment>;
}

export async function registerAccount(payload: RegisterRequest): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export async function createCharacter(
  payload: CreateCharacterRequest,
  accountId?: string | null,
): Promise<{ id: string; name: string; race: Race }> {
  const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  const res = await fetch(`${API_BASE}/characters${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export async function loginAccount(payload: RegisterRequest): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export async function listCharacters(accountId: string): Promise<CharacterSummary[]> {
  const res = await fetch(`${API_BASE}/characters?accountId=${encodeURIComponent(accountId)}`);

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

export async function getArenaHubState(characterId: string): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/hub/${encodeURIComponent(characterId)}`);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

async function readErrorMessage(res: Response): Promise<string> {
  const raw = await res.text();

  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(', ');
    }
    if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
      return parsed.message;
    }
  } catch {
    // Fallback to raw text below.
  }

  return raw;
}

export async function buyArenaItem(characterId: string, itemId: string): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemId }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function sellArenaItem(characterId: string, itemId: string, quantity = 1): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/sell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemId, quantity }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function equipArenaItem(characterId: string, itemId: string): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/equip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemId }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function unequipArenaItem(
  characterId: string,
  slot: 'weapon' | 'helmet' | 'armor' | 'boots' | 'gloves' | 'shield',
): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/unequip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, slot }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function startCombat(characterId: string, enemyCount = 1): Promise<{
  combatId: string;
  playerId: string;
  state: ArenaBattleState;
}> {
  const res = await fetch(`${API_BASE}/combat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, enemyCount }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function startCustomCombat(
  characterId: string,
  customEnemies: CustomArenaNpcPayload[],
): Promise<{
  combatId: string;
  playerId: string;
  state: ArenaBattleState;
}> {
  const res = await fetch(`${API_BASE}/combat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      characterId,
      enemyCount: Math.max(1, customEnemies.length),
      customEnemies,
    }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function sendCombatAction(payload: {
  combatId: string;
  actorId: string;
  targetId: string;
  attackZone: TargetZone;
  defenseZones: TargetZone[];
  attackPointsSpent: number;
  defensePointsSpent: number;
  actionType: ActionType;
  preferredDistance?: DistanceBand;
  destinationX?: number;
  destinationY?: number;
  skillType?: CombatSkillType;
}): Promise<ArenaBattleState> {
  const res = await fetch(`${API_BASE}/combat/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function allocateStats(
  characterId: string,
  allocation: Partial<Record<PrimaryStat, number>>,
): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/allocate-stats`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(allocation),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function useCombatItem(payload: {
  combatId: string;
  actorId: string;
  itemId: string;
}): Promise<{
  state: ArenaBattleState;
  inventory: InventoryState['items'];
  gold: number;
}> {
  const res = await fetch(`${API_BASE}/combat/use-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}
