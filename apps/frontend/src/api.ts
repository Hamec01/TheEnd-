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
  KingdomId,
  DistanceBand,
  TargetZone,
  TeamSide,
  PlayerProfessionsState,
  CombatCommand,
  CombatPlanErrorCode,
  CombatPlanWarning,
  CombatPlanWarningCode,
  CombatTurnPlan,
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
  citizenshipKingdomId?: KingdomId | null;
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
    professions?: PlayerProfessionsState;
    citizenshipKingdomId?: KingdomId | null;
    kingdomReputation?: Partial<Record<KingdomId, number>>;
  };
  inventory: InventoryState;
  equipment: Equipment;
  itemInstances?: ArenaItemInstanceRecord[];
  equipmentState?: ArenaEquipmentState | null;
  actionSlots: CharacterActionSlot[];
}

export interface ArenaMerchantStockState {
  merchantId: string;
  refreshedAt: number;
  nextRefreshAt: number;
  stockByItemId: Record<string, number | null>;
}

export interface CharacterActionSlot {
  slotId: 'quick1' | 'quick2' | 'quick3' | 'quick4' | 'quick5' | 'quick6' | 'quick7' | 'quick8' | 'quick9' | 'quick10';
  slotIndex: number;
  kind: 'skill' | 'item' | 'weapon' | null;
  refId: string | null;
  itemInstanceId?: string | null;
  weaponInstanceId?: string | null;
}

export interface CharacterActionBarSlot {
  slotId: CharacterActionSlot['slotId'];
  order: number;
  entryKind: 'skill' | 'item' | 'weapon' | 'empty';
  skillId?: string;
  itemId?: string;
  itemInstanceId?: string | null;
  weaponItemId?: string;
  weaponInstanceId?: string | null;
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

export interface ArenaItemInstanceState {
  version: 1;
  augmentSlots?: Array<{
    socketId: string;
    socketedAugmentItemId?: string | null;
    isLocked?: boolean;
    source?: 'base' | 'blacksmith_added' | 'scripted';
  }>;
  sourceItemId?: string;
  itemSnapshot?: Record<string, unknown>;
  customName?: string;
  statOverrides?: Record<string, unknown>;
  qualityTierId?: string;
  qualityTier?: number;
  forgeScore?: number;
  forgedAtIso?: string;
  ownerTag?: string;
  craftedFromTemplateId?: string;
  craftedMaterialIds?: string[];
  craftedByProfession?: 'blacksmithing';
  tags?: string[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface ArenaItemInstanceRecord {
  id: string;
  characterId: string;
  itemId: string;
  state: ArenaItemInstanceState | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArenaEquipmentStateSlot {
  itemId?: string | null;
  itemInstanceId?: string | null;
  equippedAtIso?: string;
  metadata?: Record<string, unknown>;
}

export interface ArenaEquipmentState {
  version: 1;
  slots: Partial<Record<keyof Equipment, ArenaEquipmentStateSlot>>;
}

export interface ArenaSocketState {
  socketId: string;
  socketedAugmentItemId?: string | null;
  isLocked?: boolean;
  source?: 'base' | 'blacksmith_added' | 'scripted';
}

export interface SocketAugmentResponse {
  itemInstance: ArenaItemInstanceRecord;
  socket: ArenaSocketState;
  status: 'active' | 'inactive';
  reason?: string;
}

export interface UnsocketAugmentResponse {
  itemInstance: ArenaItemInstanceRecord;
  socket: ArenaSocketState;
  returnedAugmentItemId: string;
}

export interface CombatActionResult {
  state: ArenaBattleState;
  hubState?: ArenaHubState;
}

export interface CombatPlanResult {
  state: ArenaBattleState;
  plan?: CombatTurnPlan;
}

export interface ValidateCombatPlanResponse {
  ok: boolean;
  errors: CombatPlanErrorCode[];
  warnings?: CombatPlanWarningCode[];
  warningDetails?: CombatPlanWarning[];
  normalizedCommands?: CombatCommand[];
  total?: {
    commands: number;
    ap: number;
    stamina: number;
    mp: number;
    hp: number;
  };
}

export type SubmitCombatPlanResponse =
  | {
    ok: true;
    acceptedPlan: CombatTurnPlan;
    battleState: ArenaBattleState;
    warnings?: CombatPlanWarning[];
  }
  | {
    ok: false;
    errorCode: string;
    message: string;
    details?: unknown;
  };

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
  musicAssetId?: string;
  musicUrl?: string;
  ambientAssetId?: string;
  ambientUrl?: string;
  cellSizePx?: number;
  gridOffsetX?: number;
  gridOffsetY?: number;
  logicalColumns?: number;
  logicalRows?: number;
  showEditorGrid?: boolean;
  gridOpacity?: number;
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
  exitZones?: import('@theend/rpg-domain').ExitZone[];
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

export async function deleteCharacter(characterId: string): Promise<{ ok: boolean; id: string }> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}`, {
    method: 'DELETE',
  });

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
  slots: Array<{ slotIndex?: number; slotId?: CharacterActionSlot['slotId']; kind: 'skill' | 'item' | 'weapon' | null; refId: string | null; itemInstanceId?: string | null; weaponInstanceId?: string | null }>,
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
  slots: Array<{ slotId: CharacterActionBarSlot['slotId']; order?: number; entryKind: 'skill' | 'item' | 'weapon' | 'empty'; skillId?: string; itemId?: string; itemInstanceId?: string | null; weaponItemId?: string; weaponInstanceId?: string | null }>,
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

export async function updateCharacterResources(
  characterId: string,
  payload: Partial<Pick<CharacterResourceState, 'currentHp' | 'currentMp' | 'currentStamina' | 'hpRegenPerTurn'>>,
): Promise<CharacterResourceState> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/resources`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function patchDevCharacterState(
  characterId: string,
  payload: Record<string, unknown>,
): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/dev-state`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return getArenaHubState(characterId);
}

export async function adjustDevInventoryItem(
  characterId: string,
  payload: { itemId: string; quantityDelta: number },
): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/inventory/dev`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function revokeCharacterSkill(characterId: string, skillId: string): Promise<{ characterId: string; skillId: string; removed: true }> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/skills/${encodeURIComponent(skillId)}`, {
    method: 'DELETE',
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

export async function buyArenaItem(characterId: string, itemId: string, merchantId: string, quantity = 1): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemId, merchantId, quantity }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function getArenaMerchantStock(characterId: string, merchantId: string): Promise<ArenaMerchantStockState> {
  const res = await fetch(`${API_BASE}/arena/merchant-stock/${encodeURIComponent(characterId)}/${encodeURIComponent(merchantId)}`);
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

export async function useArenaItem(characterId: string, itemId: string): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/use-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemId }),
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

export async function equipArenaItemInstance(
  characterId: string,
  itemInstanceId: string,
  slot?: keyof Equipment,
): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/equip-instance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemInstanceId, slot }),
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

export async function unequipArenaItemInstance(
  characterId: string,
  itemInstanceId: string,
): Promise<ArenaHubState> {
  const res = await fetch(`${API_BASE}/arena/unequip-instance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemInstanceId }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function socketArenaAugment(
  characterId: string,
  itemInstanceId: string,
  socketId: string,
  augmentItemId: string,
): Promise<SocketAugmentResponse> {
  const res = await fetch(`${API_BASE}/arena/socket-augment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemInstanceId, socketId, augmentItemId }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function unsocketArenaAugment(
  characterId: string,
  itemInstanceId: string,
  socketId: string,
): Promise<UnsocketAugmentResponse> {
  const res = await fetch(`${API_BASE}/arena/unsocket-augment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemInstanceId, socketId }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function syncArenaItemInstance(
  characterId: string,
  itemId: string,
  state: Record<string, unknown> | null,
  itemInstanceId?: string,
): Promise<ArenaItemInstanceRecord> {
  const res = await fetch(`${API_BASE}/arena/sync-item-instance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemId, itemInstanceId, state }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json();
}

export async function deleteArenaItemInstance(
  characterId: string,
  itemId: string,
  itemInstanceId?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/arena/delete-item-instance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, itemId, itemInstanceId }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
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

/**
 * P0 Sequential Turn-Based Combat: Execute a single action for the active actor.
 */
export async function executeCombatAction(payload: {
  battleId: string;
  actorId: string;
  roundNumber: number;
  command: CombatCommand;
}): Promise<
  | { ok: true; battleState: ArenaBattleState; events: import('@theend/rpg-domain').CombatEvent[] }
  | { ok: false; errorCode: string; message: string }
> {
  const res = await fetch(`${API_BASE}/combat/${encodeURIComponent(payload.battleId)}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorId: payload.actorId, roundNumber: payload.roundNumber, command: payload.command }),
  });
  if (!res.ok) {
    const raw = await res.text();
    try {
      const parsed = JSON.parse(raw) as { errorCode?: unknown; message?: unknown };
      const errorCode = typeof parsed.errorCode === 'string' ? parsed.errorCode : `HTTP_${res.status}`;
      const message = typeof parsed.message === 'string' ? parsed.message : raw;
      return { ok: false, errorCode, message };
    } catch {
      return { ok: false, errorCode: `HTTP_${res.status}`, message: raw || `HTTP ${res.status}` };
    }
  }
  return res.json();
}

export async function fetchCombatState(battleId: string): Promise<ArenaBattleState> {
  const res = await fetch(`${API_BASE}/combat/${encodeURIComponent(battleId)}/state`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  const payload = await res.json() as { ok?: boolean; battleState?: ArenaBattleState } | ArenaBattleState;
  if (typeof payload === 'object' && payload && 'ok' in payload) {
    if ((payload as { ok?: boolean }).ok && (payload as { battleState?: ArenaBattleState }).battleState) {
      return (payload as { battleState: ArenaBattleState }).battleState;
    }
    throw new Error('Failed to fetch combat state.');
  }

  return payload as ArenaBattleState;
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

export interface OutOfCombatSkillUseResult {
  skillId: string;
  message: string;
  restored: { hp: number; mp: number; stamina: number };
}

export async function useSkillOutOfCombat(
  characterId: string,
  skillId: string,
): Promise<OutOfCombatSkillUseResult> {
  const res = await fetch(`${API_BASE}/characters/${encodeURIComponent(characterId)}/skills/use`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
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
