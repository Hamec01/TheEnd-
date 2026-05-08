import type {
  ActionType,
  ArenaBattleState,
  ArenaCombatEntity,
  Equipment,
  InventoryState,
  MovementType,
  PrimaryStat,
  Race,
  StatBlock,
  DistanceBand,
  TargetZone,
  TeamSide,
} from '@theend/rpg-domain';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api';
export const MAX_COMBAT_ENEMIES = 10;

// Type aliases for battle UI components
export type CombatState = ArenaBattleState;
export type Fighter = ArenaCombatEntity;

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
    currentHp: number;
    maxHp: number;
    currentMp: number;
    maxMp: number;
    currentStamina: number;
    maxStamina: number;
    hpRegenPerTurn?: number;
  };
  inventory: InventoryState;
  equipment: Equipment;
  actionSlots: CharacterActionSlot[];
}

export interface CharacterActionSlot {
  slotId: 'quick1' | 'quick2' | 'quick3' | 'quick4' | 'quick5' | 'quick6' | 'quick7' | 'quick8' | 'quick9' | 'quick10';
  slotIndex: number;
  kind: 'skill' | 'item' | null;
  refId: string | null;
  itemInstanceId?: string | null;
}

export interface CharacterActionBarSlot {
  slotId: CharacterActionSlot['slotId'];
  order: number;
  entryKind: 'skill' | 'item' | 'empty';
  skillId?: string;
  itemId?: string;
  itemInstanceId?: string | null;
  isLocked?: false;
}

export interface CharacterHotbarSlot {
  slotIndex: number;
  itemId: string | null;
  itemInstanceId?: string | null;
}

export interface CharacterResourceState {
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  currentStamina: number;
  maxStamina: number;
  hpRegenPerTurn: number;
}

export interface CombatActionResult {
  state: ArenaBattleState;
  hubState?: ArenaHubState;
}

export interface NearbyPvpPlayer {
  characterId: string;
  name: string;
  race: Race;
  level: number;
}

export interface CustomArenaNpcPayload {
  name: string;
  race: Race;
  stats: StatBlock;
  equipment?: Partial<Equipment>;
  avatarUrl?: string;
}

export interface ArenaBlockedTilePayload {
  x: number;
  y: number;
}

export interface RuntimeBattleMapCellPayload {
  x: number;
  y: number;
  type: string;
  trapId?: string;
  movementCost?: number;
  blocksMovement?: boolean;
  blocksLineOfSight?: boolean;
}

export interface RuntimeBattleMapSpawnZonePayload {
  id: string;
  type: string;
  name: string;
  cells: Array<{ x: number; y: number }>;
}

export interface RuntimeBattleMapObjectPayload {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  blocksMovement?: boolean;
  blocksLineOfSight?: boolean;
  interactable?: boolean;
  iconUrl?: string;
  imageUrl?: string;
  lootTableId?: string;
  questId?: string;
  triggerId?: string;
  description?: string;
}

export interface RuntimeBattleMapTrapPayload {
  id: string;
  name: string;
  x: number;
  y: number;
  damage?: number;
  staminaCost?: number;
  triggerOnce?: boolean;
  revealedByDefault?: boolean;
  detectionDifficulty?: number;
  description?: string;
}

export interface RuntimeBattleMapPlacedNpcPayload {
  id: string;
  npcId?: string;
  name: string;
  role: string;
  x: number;
  y: number;
  factionId?: string;
  dialogueId?: string;
  questId?: string;
  merchantId?: string;
  startsCombat?: boolean;
  avatarUrl?: string;
  description?: string;
}

export interface RuntimeBattleMapTriggerPayload {
  id: string;
  type: string;
  name: string;
  cells: Array<{ x: number; y: number }>;
  questId?: string;
  dialogueId?: string;
  targetBattleMapId?: string;
  targetWorldZoneId?: string;
  startsCombat?: boolean;
  once?: boolean;
  enabled?: boolean;
  description?: string;
}

export interface RuntimeBattleMapPayload {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  cells: RuntimeBattleMapCellPayload[];
  spawnZones: RuntimeBattleMapSpawnZonePayload[];
  objects: RuntimeBattleMapObjectPayload[];
  traps: RuntimeBattleMapTrapPayload[];
  npcs?: RuntimeBattleMapPlacedNpcPayload[];
  triggers?: RuntimeBattleMapTriggerPayload[];
}

export async function registerAccount(payload: RegisterRequest): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
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
    throw new Error(await readErrorMessage(res));
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
    throw new Error(await readErrorMessage(res));
  }

  return res.json();
}

export async function fetchNearbyPvpPlayers(characterId: string): Promise<NearbyPvpPlayer[]> {
  const res = await fetch(`${API_BASE}/pvp/nearby/${encodeURIComponent(characterId)}`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function challengePvpPlayer(payload: { challengerId: string; targetId: string }): Promise<{
  target: NearbyPvpPlayer;
  customEnemy: CustomArenaNpcPayload;
}> {
  const res = await fetch(`${API_BASE}/pvp/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function listCharacters(accountId: string): Promise<CharacterSummary[]> {
  const res = await fetch(`${API_BASE}/characters?accountId=${encodeURIComponent(accountId)}`);

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return res.json();
}

export async function getArenaHubState(characterId: string): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/hub/${encodeURIComponent(characterId)}`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function getCharacterHotbar(characterId: string): Promise<CharacterHotbarSlot[]> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/hotbar`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function getCharacterActionSlots(characterId: string): Promise<CharacterActionSlot[]> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/action-slots`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function getCharacterActionBar(characterId: string): Promise<CharacterActionBarSlot[]> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/action-bar`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function updateCharacterActionSlots(
  characterId: string,
  slots: Array<{ slotIndex?: number; slotId?: CharacterActionSlot['slotId']; kind: 'skill' | 'item' | null; refId: string | null; itemInstanceId?: string | null }>,
): Promise<CharacterActionSlot[]> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/action-slots`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function updateCharacterActionBar(
  characterId: string,
  slots: Array<{ slotId: CharacterActionBarSlot['slotId']; order?: number; entryKind: 'skill' | 'item' | 'empty'; skillId?: string; itemId?: string; itemInstanceId?: string | null }>,
): Promise<CharacterActionBarSlot[]> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/action-bar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function updateCharacterHotbar(
  characterId: string,
  slots: Array<{ slotIndex: number; itemId: string | null; itemInstanceId?: string | null }>,
): Promise<CharacterHotbarSlot[]> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/hotbar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function saveCharacterQuestState(
  characterId: string,
  questId: string,
  state: unknown,
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/quest-states/${encodeURIComponent(questId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
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

export async function buyArenaItem(characterId: string, itemId: string, merchantId: string): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemId, merchantId }),
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

export async function equipArenaItem(
  characterId: string,
  itemId: string,
  slot?: keyof Equipment,
): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/equip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemId, slot }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function unequipArenaItem(
  characterId: string,
  slot: keyof Equipment,
): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/unequip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, slot }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function startCombat(
  characterId: string,
  enemyCount = 1,
  battleMap?: RuntimeBattleMapPayload,
): Promise<{
  combatId: string;
  playerId: string;
  state: ArenaBattleState;
}> {
  const normalizedEnemyCount = Math.max(1, Math.min(MAX_COMBAT_ENEMIES, enemyCount));
  const res = await fetch(`${API_BASE}/combat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, enemyCount: normalizedEnemyCount, battleMap }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function startCustomCombat(
  characterId: string,
  customEnemies: CustomArenaNpcPayload[],
  battleMap?: RuntimeBattleMapPayload,
): Promise<{
  combatId: string;
  playerId: string;
  state: ArenaBattleState;
}> {
  const normalizedCustomEnemies = customEnemies.slice(0, MAX_COMBAT_ENEMIES);
  const res = await fetch(`${API_BASE}/combat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      characterId,
      enemyCount: Math.max(1, normalizedCustomEnemies.length),
      customEnemies: normalizedCustomEnemies,
      battleMap,
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
  movementType?: MovementType;
  preferredDistance?: DistanceBand;
  destinationX?: number;
  destinationY?: number;
  skillId?: string;
  skillLevel?: number;
}): Promise<CombatActionResult> {
  const res = await fetch(`${API_BASE}/combat/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
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

export async function respecStats(characterId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/respec-stats`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

export async function useCombatItem(payload: {
  combatId: string;
  actorId: string;
  itemId: string;
  targetId?: string;
}): Promise<{
  state: ArenaBattleState;
  inventory: InventoryState['items'];
  gold: number;
  actionSlots?: CharacterActionSlot[];
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

// ── Character skills + loadout ─────────────────────────────────────────────

export interface CharacterSkillRow {
  id: string;
  characterId: string;
  skillId: string;
  level: number;
  learnedAt: string;
  sourceType: string;
  sourceId: string | null;
  definition: import('@theend/rpg-domain').AdminSkillDefinition | null;
}

export interface CombatSkillSlot {
  slotIndex: number;
  skillId: string | null;
  unlocked: boolean;
  slotType: 'ANY' | 'MAGIC' | 'PHYSICAL' | 'PASSIVE' | 'RUNE' | 'SHAMANIC';
}

export interface CharacterSkillLoadout {
  characterId: string;
  slots: CombatSkillSlot[];
}

export async function getCharacterSkills(characterId: string): Promise<CharacterSkillRow[]> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/skills`);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function learnSkill(
  characterId: string,
  payload: { skillId: string; sourceType?: string; sourceId?: string },
): Promise<CharacterSkillRow> {
  const body = {
    ...payload,
    sourceType: payload.sourceType ?? 'teacher',
  };
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/skills/learn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function grantSkill(
  characterId: string,
  payload: { skillId: string; sourceType?: string; sourceId?: string },
): Promise<CharacterSkillRow> {
  const body = {
    ...payload,
    sourceType: payload.sourceType ?? 'dialogue',
  };
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/skills/grant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function getSkillLoadout(characterId: string): Promise<CharacterSkillLoadout> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/skill-loadout`);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function updateSkillLoadout(
  characterId: string,
  slots: Array<{ slotIndex: number; skillId: string | null }>,
): Promise<CharacterSkillLoadout> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/skill-loadout`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}
