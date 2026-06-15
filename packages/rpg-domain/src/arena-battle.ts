import type { Race } from './races';
import type { DamageCategory } from './damage';
import type { ArenaCombatEquipmentModifiers } from './arena-combat-equipment';
import { COMBAT_ACTION_COSTS } from './combat-costs';
import type { BattleMapExtractionZone, BattleMapObjective, BattleMapPlacedNpc, BattleMapScriptEvent, ExitZone } from './battle-map';
import {
  resolveActorIdentity,
  resolveCombatRelation,
  type BattleRelationOverride,
  type DiplomaticActorRef,
  type GlobalRelation,
} from './diplomacy';
import type {
  CombatAnimationEvent,
  CombatBattlePhase,
  CombatEvent,
  CombatRoundResolveSnapshot,
  CombatTurnPlan,
} from './combat-plan';

export enum TargetZone {
  Head = 'HEAD',
  Chest = 'CHEST',
  Abdomen = 'ABDOMEN',
  LeftArm = 'LEFT_ARM',
  RightArm = 'RIGHT_ARM',
  Legs = 'LEGS',
}

export enum ActionType {
  Attack = 'ATTACK',
  Move = 'MOVE',
  Defend = 'DEFEND',
  Wait = 'WAIT',
}

export enum MovementType {
  Step = 'STEP',
  Extra = 'EXTRA',
  Dash = 'DASH',
  Disengage = 'DISENGAGE',
}

export enum CombatSkillType {
  None = 'NONE',
  PowerStrike = 'POWER_STRIKE',
  CrushingBlock = 'CRUSHING_BLOCK',
  Rage = 'RAGE',
  Fireball = 'FIREBALL',
  FrostLance = 'FROST_LANCE',
  ShieldBash = 'SHIELD_BASH',
  Whirlwind = 'WHIRLWIND',
}

export enum TeamSide {
  Left = 'LEFT',
  Right = 'RIGHT',
}

export enum DistanceBand {
  Melee = 'MELEE',
  Near = 'NEAR',
  Far = 'FAR',
}

export type ArenaBattlePhase = 'PLANNING' | 'RESOLVING';

export enum BattlefieldTileType {
  Empty = 'empty',
  Blocked = 'blocked',
  LowCover = 'lowCover',
  HighCover = 'highCover',
  Hazard = 'hazard',
  Summon = 'summon',
}

export const BATTLEFIELD_GRID_SIZE = 12;

/**
 * Активный боевой статус на сущности (игрок, NPC, монстр).
 * Длительность уменьшается в конце полного цикла resolve раунда (см. combat-status-runtime).
 */
export interface ActiveCombatStatus {
  id: string;
  sourceActorId?: string;
  sourceItemId?: string;
  sourceAbilityId?: string;
  remainingTurns: number;
  stacks?: number;
  rawStatusId?: string;
  /** Переопределение урона тика из effect.data.tickDamage. */
  tickDamageFlatOverride?: number;
  tickDamageCategoryOverride?: DamageCategory;
}

export interface ArenaCombatEntity {
  id: string;
  name: string;
  team: TeamSide;
  race: Race;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  currentStamina: number;
  maxStamina: number;
  strength: number;
  constitution: number;
  dexterity: number;
  intelligence: number;
  luck: number;
  perception: number;
  willpower: number;
  initiative: number;
  isAlive: boolean;
  lifeState?: CombatActorLifeState;
  position: number;
  battlefieldX?: number;
  battlefieldY?: number;
  avatarUrl?: string;
  battleSpriteUrl?: string;
  battleSpriteId?: string;
  battleRenderMode?: 'portrait' | 'sprite';
  combatStyleHint?: 'MELEE' | 'RANGED' | 'MAGIC';
  /**
   * Grid-based combat targeting (cells).
   * If set to > 1, enables ranged attacks for this entity and defines max range.
   */
  attackRange?: number;
  /** Optional line piercing (e.g. thrown spear hits 2 targets in a line). */
  pierceTargets?: number;
  /** Optional splash radius around the impact cell (e.g. bomb). */
  splashRadius?: number;
  /** Damage multiplier for the impact cell when splash is enabled (>= 1). */
  splashCenterMultiplier?: number;
  /** Damage multiplier for adjacent cells inside the splash radius (>= 0). */
  splashOuterMultiplier?: number;
  /** Whether the entity has a shield equipped (affects guard block chance). */
  hasShield?: boolean;
  /** Currently equipped weapon item id (admin item id, updated by weapon_swap). */
  activeWeaponItemId?: string | null;
  /** Currently equipped unique weapon instance id when combat is driven by item instances. */
  activeWeaponInstanceId?: string | null;
  /** Currently equipped off-hand item id (admin item id, e.g. shield). Cleared when two-handed weapon equipped. */
  offHandItemId?: string | null;
  /** Currently equipped unique off-hand instance id when combat is driven by item instances. */
  offHandInstanceId?: string | null;
  isPlayer?: boolean;
  isNpc?: boolean;
  kingdomId?: string;
  citizenshipKingdomId?: string;
  factionId?: string;
  factionIds?: string[];
  raceId?: string;
  clanId?: string;
  guildId?: string;
  groupId?: string;
  diplomaticActorIds?: DiplomaticActorRef[];
  /** Пассивные модификаторы из экипировки и сетов (агрегируются на бэкенде). */
  combatModifiers?: ArenaCombatEquipmentModifiers;
  /** Наложенные статусы (яд, оглушение и т.д.). */
  activeCombatStatuses?: ActiveCombatStatus[];
}

export interface ArenaCombatAction {
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
}

export interface CombatLogEntry {
  round: number;
  actorId: string;
  targetId?: string;
  type: 'HIT' | 'MISS' | 'BLOCK' | 'DEATH' | 'INFO';
  amount?: number;
  text: string;
}

export interface ArenaCombatRound {
  roundNumber: number;
  order: string[];
  actions: ArenaCombatAction[];
  logs: CombatLogEntry[];
}

export interface BattlefieldTile {
  x: number;
  y: number;
  type: BattlefieldTileType;
  movementCost?: number;
  blocksMovement?: boolean;
  blocksLineOfSight?: boolean;
  trapId?: string;
}

export interface BattlefieldTrapState {
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
  isActive?: boolean;
}

// --- Escape/exit zone additions ---
export type CombatBattleType =
  | 'arena'
  | 'pve'
  | 'pvp'
  | 'quest'
  | 'event'
  | 'farm'
  | 'ambush'
  | 'wild'
  | 'random_encounter';

export type QuestBattleResultState =
  | 'objective_completed'
  | 'player_defeated'
  | 'quest_failed'
  | 'aborted/debug_exit';

export interface ArenaBattleRuntimeContext {
  battleType: 'arena';
  allowArenaRewards: true;
  allowArenaVictoryLogic: true;
}

export interface QuestBattleRuntimeContext {
  battleType: 'quest';
  questId: string;
  questStepId: string;
  battleMapId: string;
  activeBattleObjectiveIds: string[];
  allowArenaRewards: false;
  allowArenaVictoryLogic: false;
  resultState?: QuestBattleResultState;
}

export type BattleRuntimeContext = ArenaBattleRuntimeContext | QuestBattleRuntimeContext;

export interface BattleContextValidationResult {
  ok: boolean;
  errors: string[];
}

export type CombatActorLifeState = 'alive' | 'downed' | 'defeated' | 'dead' | 'escaped';

export interface LootItem {
  itemId: string;
  itemInstanceId?: string;
  quantity?: number;
  name?: string;
  rarity?: string;
  generatedFrom?: string;
}

export interface CombatLootContainer {
  id: string;
  battleId: string;
  x: number;
  y: number;
  sourceEntityId: string;
  sourceName: string;
  items: LootItem[];
  gold?: number;
  createdRound: number;
  claimed?: boolean;
  claimedByActorId?: string;
  claimedAt?: string;
}

export interface CarryingBodyState {
  markerId: string;
  objectiveId: string;
  sourceActorName?: string;
  objectiveTag?: string;
}

export interface BattleObjectiveProgressState {
  objectiveId: string;
  currentCount: number;
  requiredCount: number;
  evacuatedMarkerIds: string[];
  completed?: boolean;
}

export interface BattleQuestObjectiveEffect {
  type: 'complete_quest_objective';
  questId: string;
  objectiveId: string;
  battleObjectiveId: string;
}

export interface BattleObjectiveMarkerState {
  id: string;
  sourceNpcId?: string;
  name: string;
  x: number;
  y: number;
  kingdomId?: string;
  factionId?: string;
  groupId?: string;
  objectiveTag?: string;
  canBeCarried: boolean;
  countsForObjective: boolean;
  status: 'available' | 'carried' | 'evacuated';
}

export interface BattleObjectiveEmitterResult {
  ok: boolean;
  reason?: string;
  progress?: BattleObjectiveProgressState;
  questEffects: BattleQuestObjectiveEffect[];
}

// ExitZone lives in `battle-map.ts` and is referenced by combat runtime state.

export interface EscapeState {
  actorId: string;
  active: boolean;
  startedRound: number;
  requiredRounds: number;
  remainingRounds: number;
  exitZoneId: string;
  interrupted?: boolean;
  interruptedReason?: 'left_zone' | 'stunned' | 'knocked_down' | 'dead' | 'battle_finished';
  completedRound?: number;
}

export interface ArenaBattleState {
  combatId: string;
  battleMapId?: string;
  battleMapWidth: number;
  battleMapHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  roundPhase?: ArenaBattlePhase;
  phase?: CombatBattlePhase;
  readyActorIds?: string[];
  pendingActorIds?: string[];
  submittedPlans?: Record<string, CombatTurnPlan>;
  resolveSnapshot?: CombatRoundResolveSnapshot;
  recentCombatEvents?: CombatEvent[];
  recentAnimationEvents?: CombatAnimationEvent[];
  activeActorId?: string;
  turnQueue?: string[];
  turnIndex?: number;
  currentTurnAp?: number;
  skillCooldowns?: Array<{ skillId: string; remainingRounds: number; oncePerCombat?: boolean }>;
  turnDurationSeconds?: number;
  /**
   * Turn timer deadline (ISO string). Client renders countdown; server may auto-resolve when expired.
   */
  turnStartedAt?: string;
  turnDeadlineAt?: string;
  roundDurationSeconds?: number;
  roundNumber: number;
  distance: DistanceBand;
  entities: ArenaCombatEntity[];
  battlefieldTiles: BattlefieldTile[];
  battlefieldTraps: BattlefieldTrapState[];
  logs: CombatLogEntry[];
  lastRound?: ArenaCombatRound;
  isFinished: boolean;
  winner?: TeamSide;
  // --- Escape/exit zone additions ---
  battleType?: CombatBattleType;
  battleContext?: BattleRuntimeContext;
  questBattleResultState?: QuestBattleResultState;
  globalRelations?: GlobalRelation[];
  relationOverrides?: BattleRelationOverride[];
  exitZones?: ExitZone[];
  battleObjectives?: BattleMapObjective[];
  battleExtractionZones?: BattleMapExtractionZone[];
  battleObjectiveMarkers?: BattleObjectiveMarkerState[];
  escapeStates?: Record<string, EscapeState>;
  lootContainers?: CombatLootContainer[];
  carryingBody?: CarryingBodyState | null;
  battleObjectiveProgress?: Record<string, BattleObjectiveProgressState>;
  pendingQuestEffects?: BattleQuestObjectiveEffect[];
  battleScriptEvents?: BattleMapScriptEvent[];
  triggeredBattleScriptEventIds?: string[];
}

export function normalizeArenaBattleState(state: ArenaBattleState): ArenaBattleState {
  return {
    ...state,
    phase: state.phase ?? (state.isFinished ? 'finished' : 'acting'),
    roundNumber: Number.isFinite(state.roundNumber) && state.roundNumber >= 0 ? state.roundNumber : 0,
    submittedPlans: state.submittedPlans ?? {},
    readyActorIds: state.readyActorIds ?? [],
    turnQueue: state.turnQueue ?? [],
    turnIndex: typeof state.turnIndex === 'number' && Number.isFinite(state.turnIndex) ? Math.max(0, Math.floor(state.turnIndex)) : 0,
    currentTurnAp: typeof state.currentTurnAp === 'number' && Number.isFinite(state.currentTurnAp) ? Math.max(0, Math.floor(state.currentTurnAp)) : 0,
    skillCooldowns: Array.isArray(state.skillCooldowns) ? state.skillCooldowns : [],
    battleType: state.battleContext?.battleType ?? state.battleType,
    questBattleResultState: state.battleContext?.battleType === 'quest' ? state.battleContext.resultState : state.questBattleResultState,
    globalRelations: state.globalRelations ?? [],
    relationOverrides: state.relationOverrides ?? [],
    battleObjectives: state.battleObjectives ?? [],
    battleExtractionZones: state.battleExtractionZones ?? [],
    battleObjectiveMarkers: state.battleObjectiveMarkers ?? [],
    escapeStates: state.escapeStates ?? {},
    lootContainers: state.lootContainers ?? [],
    carryingBody: state.carryingBody ?? null,
    battleObjectiveProgress: state.battleObjectiveProgress ?? {},
    pendingQuestEffects: state.pendingQuestEffects ?? [],
    battleScriptEvents: state.battleScriptEvents ?? [],
    triggeredBattleScriptEventIds: state.triggeredBattleScriptEventIds ?? [],
  };
}

export interface BattlefieldTilePlacement {
  entityId: string;
  x: number;
  y: number;
  team: TeamSide;
}

const DEFENSIVE_ZONES: TargetZone[] = [TargetZone.Chest, TargetZone.Abdomen];

type GuardMode = 'RECKLESS' | 'AGGRESSIVE' | 'NORMAL';
type CombatStyle = 'MELEE' | 'RANGED' | 'MAGIC';

function getBattleMapWidth(source?: Pick<ArenaBattleState, 'battleMapWidth'> | null): number {
  return source?.battleMapWidth ?? BATTLEFIELD_GRID_SIZE;
}

function getBattleMapHeight(source?: Pick<ArenaBattleState, 'battleMapHeight'> | null): number {
  return source?.battleMapHeight ?? BATTLEFIELD_GRID_SIZE;
}

function getDistanceColumns(distance: DistanceBand, width: number): { left: number; right: number } {
  const safeWidth = Math.max(2, width);
  if (distance === DistanceBand.Far) {
    return { left: 1, right: Math.max(1, safeWidth - 2) };
  }

  if (distance === DistanceBand.Near) {
    const left = Math.max(1, Math.floor(safeWidth * 0.28));
    const right = Math.max(left + 1, Math.min(safeWidth - 2, safeWidth - 1 - left));
    return { left, right };
  }

  const left = Math.max(0, Math.floor(safeWidth / 2) - 1);
  return { left, right: Math.min(safeWidth - 1, left + 1) };
}

function classifyGapDistance(gap: number): DistanceBand {
  if (gap <= 1) {
    return DistanceBand.Melee;
  }

  if (gap <= 4) {
    return DistanceBand.Near;
  }

  return DistanceBand.Far;
}

export function getDistanceBandForGap(gap: number): DistanceBand {
  return classifyGapDistance(gap);
}

function distributeRows(count: number, height: number): number[] {
  if (count <= 0) {
    return [];
  }

  return Array.from({ length: count }, (_, index) =>
    Math.max(0, Math.min(height - 1, Math.round(((index + 1) * (height - 1)) / (count + 1)))),
  );
}

function getDefaultBattlefieldTilePlacements(
  entities: ArenaCombatEntity[],
  distance: DistanceBand,
  width: number,
  height: number,
): BattlefieldTilePlacement[] {
  const columns = getDistanceColumns(distance, width);
  const leftTeam = entities
    .filter((entity) => entity.isAlive && entity.team === TeamSide.Left)
    .sort((left, right) => left.position - right.position);
  const rightTeam = entities
    .filter((entity) => entity.isAlive && entity.team === TeamSide.Right)
    .sort((left, right) => left.position - right.position);
  const leftRows = distributeRows(leftTeam.length, height);
  const rightRows = distributeRows(rightTeam.length, height);

  return [
    ...leftTeam.map((entity, index) => ({
      entityId: entity.id,
      x: columns.left,
      y: leftRows[index] ?? Math.floor(height / 2),
      team: entity.team,
    })),
    ...rightTeam.map((entity, index) => ({
      entityId: entity.id,
      x: columns.right,
      y: rightRows[index] ?? Math.floor(height / 2),
      team: entity.team,
    })),
  ];
}

function hasStoredBattlefieldPositions(entities: ArenaCombatEntity[]): boolean {
  return entities
    .filter((entity) => entity.isAlive)
    .every((entity) => Number.isInteger(entity.battlefieldX) && Number.isInteger(entity.battlefieldY));
}

function syncBattlefieldPositions(entities: ArenaCombatEntity[], distance: DistanceBand, width: number, height: number): void {
  if (hasStoredBattlefieldPositions(entities)) {
    return;
  }

  const placements = getDefaultBattlefieldTilePlacements(entities, distance, width, height);
  const placementById = new Map(placements.map((placement) => [placement.entityId, placement]));

  for (const entity of entities) {
    const placement = placementById.get(entity.id);
    if (!placement) {
      continue;
    }

    entity.battlefieldX = placement.x;
    entity.battlefieldY = placement.y;
  }
}

function createDefaultBattlefieldTiles(width = BATTLEFIELD_GRID_SIZE, height = BATTLEFIELD_GRID_SIZE): BattlefieldTile[] {
  return Array.from({ length: width * height }, (_, index) => ({
    x: index % width,
    y: Math.floor(index / width),
    type: BattlefieldTileType.Empty,
  }));
}

function isWithinBattlefield(state: Pick<ArenaBattleState, 'battleMapWidth' | 'battleMapHeight'>, x: number, y: number): boolean {
  return x >= 0 && x < getBattleMapWidth(state) && y >= 0 && y < getBattleMapHeight(state);
}

function getBattlefieldTileType(state: ArenaBattleState, x: number, y: number): BattlefieldTileType {
  return state.battlefieldTiles.find((tile) => tile.x === x && tile.y === y)?.type ?? BattlefieldTileType.Empty;
}

function isTileWalkBlocked(state: ArenaBattleState, x: number, y: number): boolean {
  const tile = state.battlefieldTiles.find((entry) => entry.x === x && entry.y === y);
  if (tile?.blocksMovement !== undefined) {
    return tile.blocksMovement;
  }
  const tileType = tile?.type ?? BattlefieldTileType.Empty;
  return tileType === BattlefieldTileType.Blocked || tileType === BattlefieldTileType.HighCover || tileType === BattlefieldTileType.Summon;
}

function isTileSightBlocked(state: ArenaBattleState, x: number, y: number): boolean {
  const tile = state.battlefieldTiles.find((entry) => entry.x === x && entry.y === y);
  if (tile?.blocksLineOfSight !== undefined) {
    return tile.blocksLineOfSight;
  }
  const tileType = tile?.type ?? BattlefieldTileType.Empty;
  return tileType === BattlefieldTileType.Blocked || tileType === BattlefieldTileType.HighCover || tileType === BattlefieldTileType.Summon;
}

function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;
  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) {
      break;
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
}

function hasLineOfSight(state: ArenaBattleState, fromX: number, fromY: number, toX: number, toY: number): boolean {
  const points = bresenhamLine(fromX, fromY, toX, toY);
  for (let i = 1; i < points.length - 1; i += 1) {
    if (isTileSightBlocked(state, points[i].x, points[i].y)) {
      return false;
    }
  }
  return true;
}

export function getBattlefieldDistance(left: ArenaCombatEntity, right: ArenaCombatEntity): number {
  return Math.abs((left.battlefieldX ?? 0) - (right.battlefieldX ?? 0)) + Math.abs((left.battlefieldY ?? 0) - (right.battlefieldY ?? 0));
}

export function getDistanceBandBetweenEntities(left: ArenaCombatEntity, right: ArenaCombatEntity): DistanceBand {
  return classifyGapDistance(getBattlefieldDistance(left, right));
}

function deriveBattleDistance(entities: ArenaCombatEntity[], fallback: DistanceBand): DistanceBand {
  const leftAlive = entities.filter((entity) => entity.isAlive && entity.team === TeamSide.Left);
  const rightAlive = entities.filter((entity) => entity.isAlive && entity.team === TeamSide.Right);

  if (leftAlive.length === 0 || rightAlive.length === 0) {
    return fallback;
  }

  let minimumGap = Number.POSITIVE_INFINITY;
  for (const left of leftAlive) {
    for (const right of rightAlive) {
      minimumGap = Math.min(minimumGap, getBattlefieldDistance(left, right));
    }
  }

  if (!Number.isFinite(minimumGap)) {
    return fallback;
  }

  return classifyGapDistance(minimumGap);
}

function getTacticalDistance(left: ArenaCombatEntity, right: ArenaCombatEntity): number {
  return getBattlefieldDistance(left, right);
}

function selectNearestEnemy(actor: ArenaCombatEntity, enemies: ArenaCombatEntity[]): ArenaCombatEntity {
  return [...enemies].sort((left, right) => getTacticalDistance(actor, left) - getTacticalDistance(actor, right))[0] ?? enemies[0]!;
}

function hasCombatRelationContext(state: ArenaBattleState): boolean {
  return (state.globalRelations?.length ?? 0) > 0 || (state.relationOverrides?.length ?? 0) > 0;
}

export function isCombatHostileTarget(state: ArenaBattleState, actor: ArenaCombatEntity, target: ArenaCombatEntity): boolean {
  if (!target.isAlive || actor.id === target.id) {
    return false;
  }

  if (!hasCombatRelationContext(state)) {
    return target.team !== actor.team;
  }

  const relation = resolveCombatRelation(
    resolveActorIdentity(actor as unknown as Record<string, unknown>),
    resolveActorIdentity(target as unknown as Record<string, unknown>),
    state.globalRelations ?? [],
    state.relationOverrides ?? [],
  );

  if (relation.isHostile) {
    return true;
  }

  return target.team !== actor.team && relation.source === 'default';
}

export function getHostileEntities(state: ArenaBattleState, actor: ArenaCombatEntity): ArenaCombatEntity[] {
  return state.entities.filter((item) => isCombatHostileTarget(state, actor, item));
}

function shouldUseNpcFallback(state: ArenaBattleState, actor: ArenaCombatEntity): boolean {
  if (hasCombatRelationContext(state)) {
    return actor.isPlayer !== true;
  }
  return actor.team === TeamSide.Right;
}

function classifyCombatStyle(actor: ArenaCombatEntity): CombatStyle {
  if (actor.combatStyleHint) {
    return actor.combatStyleHint;
  }

  if (typeof actor.attackRange === 'number' && actor.attackRange > 1) {
    return 'RANGED';
  }

  if (actor.intelligence >= actor.strength && actor.intelligence >= actor.dexterity) {
    return 'MAGIC';
  }

  if (actor.dexterity >= actor.strength + 3 && actor.perception >= actor.strength + 2) {
    return 'RANGED';
  }

  return 'MELEE';
}

function getMaxAttackRange(actor: ArenaCombatEntity, style: CombatStyle): number {
  if (style === 'MELEE') {
    return 1;
  }

  const raw = typeof actor.attackRange === 'number' && Number.isFinite(actor.attackRange)
    ? Math.floor(actor.attackRange)
    : undefined;

  if (style === 'MAGIC') {
    return Math.max(2, raw ?? 5);
  }

  return Math.max(2, raw ?? 6);
}

function selectNpcAttackZone(actor: ArenaCombatEntity, currentBand: DistanceBand): TargetZone {
  const combatStyle = classifyCombatStyle(actor);

  if (combatStyle === 'MAGIC') {
    return actor.intelligence >= actor.willpower ? TargetZone.Head : TargetZone.Chest;
  }

  if (combatStyle === 'RANGED') {
    return currentBand === DistanceBand.Far ? TargetZone.Legs : TargetZone.Chest;
  }

  if (actor.strength >= actor.dexterity + 2) {
    return TargetZone.Chest;
  }

  return TargetZone.Head;
}

function updateBattleDistance(state: ArenaBattleState): void {
  state.distance = deriveBattleDistance(state.entities, state.distance);
}

function isTileOccupied(state: ArenaBattleState, x: number, y: number, ignoredEntityId: string): boolean {
  return state.entities.some((entity) =>
    entity.isAlive
      && entity.id !== ignoredEntityId
      && entity.battlefieldX === x
      && entity.battlefieldY === y,
  );
}

function buildDistanceMap(state: ArenaBattleState, actor: ArenaCombatEntity, maxDistance: number): Map<string, number> {
  const originX = actor.battlefieldX ?? 0;
  const originY = actor.battlefieldY ?? 0;
  const distances = new Map<string, number>([[`${originX}:${originY}`, 0]]);
  const queue: Array<{ x: number; y: number; distance: number }> = [{ x: originX, y: originY, distance: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.distance >= maxDistance) {
      continue;
    }

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nextX = current.x + dx;
      const nextY = current.y + dy;
      const key = `${nextX}:${nextY}`;
      if (!isWithinBattlefield(state, nextX, nextY) || distances.has(key)) {
        continue;
      }

      if (isTileWalkBlocked(state, nextX, nextY) || isTileOccupied(state, nextX, nextY, actor.id)) {
        continue;
      }

      distances.set(key, current.distance + 1);
      queue.push({ x: nextX, y: nextY, distance: current.distance + 1 });
    }
  }

  return distances;
}

export function getReachableBattlefieldTiles(
  state: ArenaBattleState,
  actorId: string,
  maxDistance: number,
): Array<{ x: number; y: number; distance: number }> {
  const actor = getEntity(state, actorId);
  const distances = buildDistanceMap(state, actor, maxDistance);

  return [...distances.entries()]
    .filter(([, distance]) => distance > 0 && distance <= maxDistance)
    .map(([key, distance]) => {
      const [x, y] = key.split(':').map(Number);
      return { x, y, distance };
    });
}

export function getThreatenedTiles(state: ArenaBattleState, team: TeamSide): Array<{ x: number; y: number; enemyId: string }> {
  const threatened: Array<{ x: number; y: number; enemyId: string }> = [];

  for (const entity of state.entities) {
    if (!entity.isAlive || entity.team === team || classifyCombatStyle(entity) !== 'MELEE') {
      continue;
    }

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = (entity.battlefieldX ?? 0) + dx;
      const y = (entity.battlefieldY ?? 0) + dy;
      if (isWithinBattlefield(state, x, y)) {
        threatened.push({ x, y, enemyId: entity.id });
      }
    }
  }

  return threatened;
}

export function getBattlefieldTilePlacements(
  entities: ArenaCombatEntity[],
  distance: DistanceBand,
  width = BATTLEFIELD_GRID_SIZE,
  height = BATTLEFIELD_GRID_SIZE,
): BattlefieldTilePlacement[] {
  if (!hasStoredBattlefieldPositions(entities)) {
    return getDefaultBattlefieldTilePlacements(entities, distance, width, height);
  }

  return entities
    .filter((entity) => entity.isAlive)
    .map((entity) => ({
      entityId: entity.id,
      x: entity.battlefieldX ?? 0,
      y: entity.battlefieldY ?? 0,
      team: entity.team,
    }));
}

export function calculateInitiative(entity: Pick<ArenaCombatEntity, 'perception' | 'dexterity'>): number {
  return Math.floor(entity.perception * 0.7 + entity.dexterity * 0.8);
}

export function clampHitChance(chance: number): number {
  return Math.max(25, Math.min(95, chance));
}

export function getStaminaRegen(entity: Pick<ArenaCombatEntity, 'constitution'>): number {
  return 10 + Math.floor(entity.constitution / 4);
}

export function getManaRegen(entity: Pick<ArenaCombatEntity, 'willpower'>): number {
  return 6 + Math.floor(entity.willpower / 4);
}

export function createArenaCombatEntity(input: Omit<ArenaCombatEntity, 'initiative' | 'isAlive'>): ArenaCombatEntity {
  return {
    ...input,
    activeCombatStatuses: input.activeCombatStatuses ?? [],
    initiative: calculateInitiative(input),
    isAlive: input.currentHp > 0,
  };
}

export function createInitialBattleState(params: {
  combatId: string;
  entities: ArenaCombatEntity[];
  distance?: DistanceBand;
  battlefieldTiles?: BattlefieldTile[];
  battlefieldTraps?: BattlefieldTrapState[];
  battleMapId?: string;
  battleMapWidth?: number;
  battleMapHeight?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  exitZones?: ExitZone[];
  battleContext?: BattleRuntimeContext;
  globalRelations?: GlobalRelation[];
  relationOverrides?: BattleRelationOverride[];
  battleObjectives?: BattleMapObjective[];
  battleExtractionZones?: BattleMapExtractionZone[];
  battleObjectiveMarkers?: BattleObjectiveMarkerState[];
}): ArenaBattleState {
  const battleMapWidth = Math.max(1, params.battleMapWidth ?? BATTLEFIELD_GRID_SIZE);
  const battleMapHeight = Math.max(1, params.battleMapHeight ?? BATTLEFIELD_GRID_SIZE);
  const state: ArenaBattleState = {
    combatId: params.combatId,
    battleMapId: params.battleMapId,
    battleMapWidth,
    battleMapHeight,
    viewportWidth: Math.max(1, Math.min(params.viewportWidth ?? BATTLEFIELD_GRID_SIZE, battleMapWidth)),
    viewportHeight: Math.max(1, Math.min(params.viewportHeight ?? BATTLEFIELD_GRID_SIZE, battleMapHeight)),
    roundNumber: 0,
    phase: 'planning',
    distance: params.distance ?? DistanceBand.Melee,
    entities: params.entities,
    battlefieldTiles: params.battlefieldTiles ?? createDefaultBattlefieldTiles(battleMapWidth, battleMapHeight),
    battlefieldTraps: params.battlefieldTraps ?? [],
    logs: [],
    submittedPlans: {},
    recentCombatEvents: [],
    recentAnimationEvents: [],
    exitZones: params.exitZones ?? [],
    battleContext: params.battleContext,
    battleType: params.battleContext?.battleType,
    questBattleResultState: params.battleContext?.battleType === 'quest' ? params.battleContext.resultState : undefined,
    globalRelations: params.globalRelations ?? [],
    relationOverrides: params.relationOverrides ?? [],
    battleObjectives: params.battleObjectives ?? [],
    battleExtractionZones: params.battleExtractionZones ?? [],
    battleObjectiveMarkers: params.battleObjectiveMarkers ?? [],
    carryingBody: null,
    battleObjectiveProgress: {},
    pendingQuestEffects: [],
    isFinished: false,
  };

  syncBattlefieldPositions(state.entities, state.distance, battleMapWidth, battleMapHeight);
  updateBattleDistance(state);
  return state;
}

export function createQuestBattleContext(params: {
  questId: string;
  questStepId: string;
  battleMapId: string;
  activeBattleObjectiveIds: string[];
}): QuestBattleRuntimeContext {
  return {
    battleType: 'quest',
    questId: params.questId,
    questStepId: params.questStepId,
    battleMapId: params.battleMapId,
    activeBattleObjectiveIds: [...new Set(params.activeBattleObjectiveIds.filter(Boolean))],
    allowArenaRewards: false,
    allowArenaVictoryLogic: false,
  };
}

export function validateBattleContextForBattleMap(
  context: BattleRuntimeContext | undefined,
  battleMap: { id?: string; objectives?: Array<{ id: string }> } | undefined,
): BattleContextValidationResult {
  const errors: string[] = [];
  if (!context) {
    return { ok: true, errors };
  }
  if (context.battleType !== 'quest') {
    return { ok: true, errors };
  }

  if (!context.questId) {
    errors.push('Quest battle requires questId.');
  }
  if (!context.questStepId) {
    errors.push('Quest battle requires questStepId.');
  }
  if (!context.battleMapId) {
    errors.push('Quest battle requires battleMapId.');
  }
  if (context.allowArenaRewards || context.allowArenaVictoryLogic) {
    errors.push('Quest battle cannot use arena rewards or arena victory logic.');
  }
  if (!battleMap || battleMap.id !== context.battleMapId) {
    errors.push('Quest battle context must match selected battleMapId.');
  }

  const objectiveIds = new Set((battleMap?.objectives ?? []).map((objective) => objective.id).filter(Boolean));
  if (context.activeBattleObjectiveIds.length === 0) {
    errors.push('Quest battle requires at least one active battle objective.');
  }
  for (const objectiveId of context.activeBattleObjectiveIds) {
    if (!objectiveIds.has(objectiveId)) {
      errors.push(`Quest battle objective "${objectiveId}" does not exist on selected battle map.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function shouldApplyArenaVictoryRewards(state: Pick<ArenaBattleState, 'battleContext' | 'battleType'>): boolean {
  if (state.battleContext) {
    return state.battleContext.allowArenaRewards;
  }
  return state.battleType !== 'quest';
}

export function shouldUseArenaVictoryLogic(state: Pick<ArenaBattleState, 'battleContext' | 'battleType'>): boolean {
  if (state.battleContext) {
    return state.battleContext.allowArenaVictoryLogic;
  }
  return state.battleType !== 'quest';
}

function getBattleObjectiveProgress(state: ArenaBattleState, objective: BattleMapObjective): BattleObjectiveProgressState {
  state.battleObjectiveProgress ??= {};
  const current = state.battleObjectiveProgress[objective.id];
  if (current) {
    return current;
  }
  const next: BattleObjectiveProgressState = {
    objectiveId: objective.id,
    currentCount: Math.max(0, Math.floor(objective.currentCount ?? 0)),
    requiredCount: Math.max(1, Math.floor(objective.requiredCount ?? 1)),
    evacuatedMarkerIds: [],
    completed: false,
  };
  state.battleObjectiveProgress[objective.id] = next;
  return next;
}

function markerMatchesObjective(marker: BattleMapPlacedNpc, objective: BattleMapObjective): boolean {
  if (objective.type !== 'extract_bodies') {
    return false;
  }
  if (marker.canBeCarried !== true || marker.countsForObjective !== true) {
    return false;
  }
  if (objective.sourceObjectiveTag && marker.objectiveTag !== objective.sourceObjectiveTag) {
    return false;
  }
  if (objective.sourceKingdomId && marker.kingdomId !== objective.sourceKingdomId) {
    return false;
  }
  if (objective.sourceFactionId && marker.factionId !== objective.sourceFactionId) {
    return false;
  }
  if (objective.sourceGroupId && marker.groupId !== objective.sourceGroupId) {
    return false;
  }
  return true;
}

function markerAlreadyEvacuated(state: ArenaBattleState, markerId: string): boolean {
  return Object.values(state.battleObjectiveProgress ?? {}).some((progress) => progress.evacuatedMarkerIds.includes(markerId));
}

function refreshQuestBattleObjectiveResult(state: ArenaBattleState): void {
  if (state.battleContext?.battleType !== 'quest') {
    return;
  }
  const progress = state.battleObjectiveProgress ?? {};
  const allActiveCompleted = state.battleContext.activeBattleObjectiveIds.every((objectiveId) => progress[objectiveId]?.completed === true);
  if (allActiveCompleted) {
    state.questBattleResultState = 'objective_completed';
    state.battleContext.resultState = 'objective_completed';
  }
}

export function pickUpBattleObjectiveMarker(
  state: ArenaBattleState,
  marker: BattleMapPlacedNpc,
  objectives: BattleMapObjective[],
): BattleObjectiveEmitterResult {
  if (state.carryingBody) {
    return { ok: false, reason: 'already_carrying_body', questEffects: [] };
  }
  if (markerAlreadyEvacuated(state, marker.id)) {
    return { ok: false, reason: 'marker_already_evacuated', questEffects: [] };
  }
  const objective = objectives.find((candidate) => markerMatchesObjective(marker, candidate));
  if (!objective) {
    return { ok: false, reason: 'no_matching_extract_objective', questEffects: [] };
  }

  state.carryingBody = {
    markerId: marker.id,
    objectiveId: objective.id,
    sourceActorName: marker.name,
    objectiveTag: marker.objectiveTag,
  };
  return {
    ok: true,
    progress: getBattleObjectiveProgress(state, objective),
    questEffects: [],
  };
}

export function evacuateCarriedBodyAtZone(
  state: ArenaBattleState,
  objectives: BattleMapObjective[],
  zone: BattleMapExtractionZone,
): BattleObjectiveEmitterResult {
  const carrying = state.carryingBody;
  if (!carrying) {
    return { ok: false, reason: 'not_carrying_body', questEffects: [] };
  }
  const objective = objectives.find((candidate) => candidate.id === carrying.objectiveId);
  if (!objective) {
    return { ok: false, reason: 'objective_missing', questEffects: [] };
  }
  if (objective.targetZoneId && zone.id !== objective.targetZoneId) {
    return { ok: false, reason: 'wrong_extraction_zone', questEffects: [] };
  }
  if (zone.objectiveId && zone.objectiveId !== objective.id) {
    return { ok: false, reason: 'zone_objective_mismatch', questEffects: [] };
  }
  if (zone.allowedObjectiveTags?.length && carrying.objectiveTag && !zone.allowedObjectiveTags.includes(carrying.objectiveTag)) {
    return { ok: false, reason: 'objective_tag_not_allowed', questEffects: [] };
  }

  const progress = getBattleObjectiveProgress(state, objective);
  if (!progress.evacuatedMarkerIds.includes(carrying.markerId)) {
    progress.evacuatedMarkerIds.push(carrying.markerId);
    progress.currentCount = Math.min(progress.requiredCount, progress.currentCount + 1);
  }
  progress.completed = progress.currentCount >= progress.requiredCount;
  state.carryingBody = null;

  const questEffects: BattleQuestObjectiveEffect[] = [];
  if (progress.completed && objective.completeQuestObjectiveOnDone && objective.questId && objective.questObjectiveId) {
    questEffects.push({
      type: 'complete_quest_objective',
      questId: objective.questId,
      objectiveId: objective.questObjectiveId,
      battleObjectiveId: objective.id,
    });
  }
  refreshQuestBattleObjectiveResult(state);
  return { ok: true, progress, questEffects };
}

function normalizeMovementType(action: ArenaCombatAction): MovementType | undefined {
  if (action.movementType) {
    return action.movementType;
  }

  if (action.actionType === ActionType.Move) {
    return MovementType.Step;
  }

  if (Number.isInteger(action.destinationX) && Number.isInteger(action.destinationY)) {
    return MovementType.Step;
  }

  return undefined;
}

function ensureActionPoints(_entity: ArenaCombatEntity, action: ArenaCombatAction): ArenaCombatAction {
  const attack = Math.max(0, action.attackPointsSpent);
  const defense = Math.max(0, action.defensePointsSpent);
  const defenseZones = action.defenseZones.filter((zone, index, zones) => zones.indexOf(zone) === index).slice(0, 2);

  return {
    ...action,
    defenseZones,
    attackPointsSpent: attack,
    defensePointsSpent: defense,
    movementType: normalizeMovementType(action),
  };
}

function classifyPreferredDistance(actor: ArenaCombatEntity): DistanceBand {
  const style = classifyCombatStyle(actor);

  if (style === 'MAGIC') {
    return DistanceBand.Far;
  }

  if (style === 'RANGED') {
    return DistanceBand.Near;
  }

  return DistanceBand.Melee;
}

function getEntity(state: ArenaBattleState, id: string): ArenaCombatEntity {
  const entity = state.entities.find((item) => item.id === id);
  if (!entity) {
    throw new Error(`Entity ${id} not found`);
  }
  return entity;
}

function getAliveByTeam(state: ArenaBattleState, team: TeamSide): ArenaCombatEntity[] {
  return state.entities.filter((item) => item.team === team && item.isAlive);
}

function checkVictory(state: ArenaBattleState): void {
  const leftAlive = getAliveByTeam(state, TeamSide.Left).length;
  const rightAlive = getAliveByTeam(state, TeamSide.Right).length;

  if (leftAlive === 0 && rightAlive === 0) {
    state.isFinished = true;
    state.winner = undefined;
  } else if (leftAlive === 0) {
    state.isFinished = true;
    state.winner = TeamSide.Right;
  } else if (rightAlive === 0) {
    state.isFinished = true;
    state.winner = TeamSide.Left;
  }
}

function getGuardMode(defenseZones: TargetZone[]): GuardMode {
  if (defenseZones.length === 0) {
    return 'RECKLESS';
  }

  if (defenseZones.length === 1) {
    return 'AGGRESSIVE';
  }

  return 'NORMAL';
}

function getOutgoingDamageMultiplier(mode: GuardMode): number {
  if (mode === 'RECKLESS') {
    return 1.2;
  }

  if (mode === 'AGGRESSIVE') {
    return 1.1;
  }

  return 1;
}

function getIncomingDamageMultiplier(mode: GuardMode): number {
  return mode === 'RECKLESS' ? 1.2 : 1;
}

function getHitChanceBonus(mode: GuardMode): number {
  return mode === 'RECKLESS' ? 15 : 0;
}

function getCritChanceBonus(mode: GuardMode): number {
  return mode === 'RECKLESS' ? 10 : 0;
}

function getEnemyCritBonusAgainst(mode: GuardMode): number {
  return mode === 'RECKLESS' ? 10 : 0;
}

function getMovementDistanceAllowance(movementType?: MovementType): number {
  if (!movementType) {
    return 0;
  }

  if (movementType === MovementType.Step || movementType === MovementType.Disengage) {
    return 1;
  }

  if (movementType === MovementType.Extra) {
    return 2;
  }

  if (movementType === MovementType.Dash) {
    return 3;
  }

  return 0;
}

function getMovementStaminaCost(movementType?: MovementType): number {
  if (!movementType) {
    return 0;
  }

  if (movementType === MovementType.Step) {
    return COMBAT_ACTION_COSTS.move_1_cell.stamina ?? 0;
  }

  if (movementType === MovementType.Extra) {
    return COMBAT_ACTION_COSTS.move_2_cells.stamina ?? 0;
  }

  if (movementType === MovementType.Dash) {
    return COMBAT_ACTION_COSTS.dash_3_cells.stamina ?? 0;
  }

  if (movementType === MovementType.Disengage) {
    return COMBAT_ACTION_COSTS.disengage.stamina ?? 0;
  }

  return 0;
}

function getActionStaminaCost(actionType: ActionType, defenseZones: TargetZone[] = []): number {
  if (actionType === ActionType.Attack) {
    return COMBAT_ACTION_COSTS.basic_attack.stamina ?? 0;
  }

  if (actionType === ActionType.Defend) {
    const guardMode = getGuardMode(defenseZones);
    return guardMode === 'NORMAL'
      ? (COMBAT_ACTION_COSTS.strong_guard.stamina ?? 0)
      : (COMBAT_ACTION_COSTS.guard.stamina ?? 0);
  }

  return 0;
}

function canAttackAtDistance(state: ArenaBattleState, actor: ArenaCombatEntity, target: ArenaCombatEntity): boolean {
  const style = classifyCombatStyle(actor);
  const distance = getBattlefieldDistance(actor, target);
  if (distance <= 0) {
    return false;
  }

  if (style === 'MELEE') {
    return distance <= 1;
  }

  if (style === 'RANGED') {
    const maxRange = getMaxAttackRange(actor, style);
    if (distance > maxRange) {
      return false;
    }
    // Check line of sight for ranged attacks
    const fromX = actor.battlefieldX ?? 0;
    const fromY = actor.battlefieldY ?? 0;
    const toX = target.battlefieldX ?? 0;
    const toY = target.battlefieldY ?? 0;
    return hasLineOfSight(state, fromX, fromY, toX, toY);
  }

  const maxRange = getMaxAttackRange(actor, style);
  if (distance > maxRange) {
    return false;
  }
  const fromX = actor.battlefieldX ?? 0;
  const fromY = actor.battlefieldY ?? 0;
  const toX = target.battlefieldX ?? 0;
  const toY = target.battlefieldY ?? 0;
  return hasLineOfSight(state, fromX, fromY, toX, toY);
}

function spendStamina(actor: ArenaCombatEntity, amount: number): boolean {
  if (amount <= 0) {
    return true;
  }

  if (actor.currentStamina < amount) {
    return false;
  }

  actor.currentStamina -= amount;
  return true;
}

function resolveDestinationForAction(
  state: ArenaBattleState,
  actor: ArenaCombatEntity,
  target: ArenaCombatEntity,
  action: ArenaCombatAction,
): { x: number; y: number } | null {
  if (Number.isInteger(action.destinationX) && Number.isInteger(action.destinationY)) {
    return { x: action.destinationX as number, y: action.destinationY as number };
  }

  if (!action.movementType) {
    return null;
  }

  const candidates = getReachableBattlefieldTiles(state, actor.id, getMovementDistanceAllowance(action.movementType));
  if (candidates.length === 0) {
    return null;
  }

  const style = classifyCombatStyle(actor);
  const maxRange = getMaxAttackRange(actor, style);
  const desiredMinDistance = style === 'MELEE' ? 1 : 2;
  const preferRetreat = action.actionType === ActionType.Move
    && (((style === 'RANGED' || style === 'MAGIC') && getBattlefieldDistance(actor, target) < desiredMinDistance) || action.movementType === MovementType.Disengage);

  candidates.sort((left, right) => {
    const leftDistance = Math.abs(left.x - (target.battlefieldX ?? 0)) + Math.abs(left.y - (target.battlefieldY ?? 0));
    const rightDistance = Math.abs(right.x - (target.battlefieldX ?? 0)) + Math.abs(right.y - (target.battlefieldY ?? 0));

    if (preferRetreat) {
      if (leftDistance !== rightDistance) {
        return rightDistance - leftDistance;
      }
    } else if (style === 'RANGED' || style === 'MAGIC') {
      const leftOutOfRange = leftDistance > maxRange;
      const rightOutOfRange = rightDistance > maxRange;
      if (leftOutOfRange !== rightOutOfRange) {
        return leftOutOfRange ? 1 : -1;
      }
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
    } else if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return left.distance - right.distance;
  });

  return { x: candidates[0]!.x, y: candidates[0]!.y };
}

function applyMovement(
  state: ArenaBattleState,
  actor: ArenaCombatEntity,
  action: ArenaCombatAction,
  target: ArenaCombatEntity,
): { moved: boolean; cellsMoved: number; opportunityEnemies: ArenaCombatEntity[]; reason?: string } {
  const movementType = action.movementType;
  if (!movementType) {
    return { moved: false, cellsMoved: 0, opportunityEnemies: [], reason: 'No movement selected.' };
  }

  const destination = resolveDestinationForAction(state, actor, target, action);
  if (!destination) {
    return { moved: false, cellsMoved: 0, opportunityEnemies: [], reason: 'No destination available.' };
  }

  if (!isWithinBattlefield(state, destination.x, destination.y)) {
    return { moved: false, cellsMoved: 0, opportunityEnemies: [], reason: 'Destination is outside battlefield.' };
  }

  if (isTileWalkBlocked(state, destination.x, destination.y) || isTileOccupied(state, destination.x, destination.y, actor.id)) {
    return { moved: false, cellsMoved: 0, opportunityEnemies: [], reason: 'Destination is blocked.' };
  }

  const maxDistance = getMovementDistanceAllowance(movementType);
  const distances = buildDistanceMap(state, actor, maxDistance);
  const key = `${destination.x}:${destination.y}`;
  const cellsMoved = distances.get(key) ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(cellsMoved) || cellsMoved > maxDistance) {
    return { moved: false, cellsMoved: 0, opportunityEnemies: [], reason: 'Destination is not reachable.' };
  }

  const adjacentMeleeEnemies = state.entities.filter((entity) =>
    isCombatHostileTarget(state, actor, entity) && classifyCombatStyle(entity) === 'MELEE' && getBattlefieldDistance(actor, entity) <= 1,
  );

  actor.battlefieldX = destination.x;
  actor.battlefieldY = destination.y;
  updateBattleDistance(state);

  const opportunityEnemies = movementType === MovementType.Disengage
    ? []
    : adjacentMeleeEnemies.filter((enemy) => getBattlefieldDistance(actor, enemy) > 1);

  return { moved: true, cellsMoved, opportunityEnemies };
}

function canAttackAfterMovement(action: ArenaCombatAction, cellsMoved: number): boolean {
  if (action.actionType !== ActionType.Attack) {
    return false;
  }

  if (!action.movementType) {
    return true;
  }

  if (action.movementType === MovementType.Dash || action.movementType === MovementType.Disengage) {
    return false;
  }

  return cellsMoved <= 1;
}

function resolveOpportunityAttacks(params: {
  state: ArenaBattleState;
  mover: ArenaCombatEntity;
  moverAction: ArenaCombatAction;
  enemies: ArenaCombatEntity[];
  logs: CombatLogEntry[];
  random: () => number;
}): void {
  const { state, mover, moverAction, enemies, logs, random } = params;
  const guardMode = getGuardMode(moverAction.defenseZones);

  for (const enemy of enemies) {
    if (!enemy.isAlive || !spendStamina(enemy, COMBAT_ACTION_COSTS.basic_attack.stamina ?? 0)) {
      continue;
    }

    const hitChance = clampHitChance(
      52
      + Math.floor(enemy.perception * 1.4)
      + Math.floor(enemy.dexterity * 0.6)
      - Math.floor(mover.dexterity * 1.1),
    );
    const roll = Math.floor(random() * 100) + 1;
    if (roll > hitChance) {
      logs.push({
        round: state.roundNumber,
        actorId: enemy.id,
        targetId: mover.id,
        type: 'MISS',
        text: `${enemy.name} misses a free strike on ${mover.name}`,
      });
      continue;
    }

    const damage = Math.max(
      1,
      Math.round(
        (enemy.strength + Math.floor(enemy.dexterity * 0.25) + Math.floor(enemy.perception * 0.2))
        * 0.55
        * getIncomingDamageMultiplier(guardMode)
        - Math.floor(mover.constitution * 0.22),
      ),
    );

    mover.currentHp = Math.max(0, mover.currentHp - damage);
    mover.isAlive = mover.currentHp > 0;

    logs.push({
      round: state.roundNumber,
      actorId: enemy.id,
      targetId: mover.id,
      type: 'HIT',
      amount: damage,
      text: `${enemy.name} lands a free strike on ${mover.name} for ${damage}`,
    });

    if (!mover.isAlive) {
      logs.push({
        round: state.roundNumber,
        actorId: mover.id,
        type: 'DEATH',
        text: `${mover.name} dies`,
      });
      break;
    }
  }
}

function applyIncomingEquipmentDamageAdjust(
  damage: number,
  combatStyle: ReturnType<typeof classifyCombatStyle>,
  target: ArenaCombatEntity,
): number {
  const cat = combatStyle === 'MAGIC' ? target.combatModifiers?.incomingMagic : target.combatModifiers?.incomingPhysical;
  if (!cat || (cat.flat === 0 && cat.percent === 0)) {
    return damage;
  }
  return Math.max(1, Math.round(damage * (1 + cat.percent / 100)) + cat.flat);
}

function resolveAttack(params: {
  state: ArenaBattleState;
  actor: ArenaCombatEntity;
  target: ArenaCombatEntity;
  actorAction: ArenaCombatAction;
  targetAction: ArenaCombatAction;
  byActor: Map<string, ArenaCombatAction>;
  logs: CombatLogEntry[];
  random: () => number;
}): void {
  const { state, actor, target, actorAction, targetAction, byActor, logs, random } = params;
  const combatStyle = classifyCombatStyle(actor);
  const actualCells = getBattlefieldDistance(actor, target);
  const actualBand = classifyGapDistance(actualCells);

  if (!canAttackAtDistance(state, actor, target)) {
    let reason = 'target is out of effective range';
    
    if (combatStyle === 'RANGED' || combatStyle === 'MAGIC') {
      const maxRange = getMaxAttackRange(actor, combatStyle);
      if (actualCells > maxRange) {
        reason = `target is out of range (${actualCells}/${maxRange})`;
      } else {
        const fromX = actor.battlefieldX ?? 0;
        const fromY = actor.battlefieldY ?? 0;
        const toX = target.battlefieldX ?? 0;
        const toY = target.battlefieldY ?? 0;
        if (!hasLineOfSight(state, fromX, fromY, toX, toY)) {
          reason = 'target is behind a wall (line of sight blocked)';
        }
      }
    }
    
    logs.push({
      round: state.roundNumber,
      actorId: actor.id,
      targetId: target.id,
      type: 'INFO',
      text: `${actor.name} cannot hit ${target.name}: ${reason}`,
    });
    return;
  }

  const actorGuardMode = getGuardMode(actorAction.defenseZones);
  const targetGuardMode = getGuardMode(targetAction.defenseZones);
  const distancePenalty =
    combatStyle === 'MELEE'
      ? 0
      : combatStyle === 'RANGED'
        ? actualCells <= 1
          ? 8
          : actualCells <= 6
            ? 0
            : 6
        : actualBand === DistanceBand.Melee
          ? 4
          : actualBand === DistanceBand.Near
            ? 0
            : 2;

  const hitChance = clampHitChance(
    56
      + actor.perception * 2
      + actor.dexterity
      + Math.floor(actor.luck * 0.5)
      - Math.round(target.dexterity * 1.5)
      - Math.floor(target.luck * 0.3)
      - distancePenalty
      + getHitChanceBonus(actorGuardMode)
      + (actor.combatModifiers?.hitChancePercent ?? 0)
      - (target.combatModifiers?.dodgeChancePercent ?? 0),
  );
  const roll = Math.floor(random() * 100) + 1;
  if (roll > hitChance) {
    logs.push({
      round: state.roundNumber,
      actorId: actor.id,
      targetId: target.id,
      type: 'MISS',
      text: `${actor.name} misses ${target.name} in ${actorAction.attackZone}`,
    });
    return;
  }

  const baseDamage =
    combatStyle === 'MAGIC'
      ? actor.intelligence + Math.floor(actor.willpower * 0.5) + actorAction.attackPointsSpent
      : combatStyle === 'RANGED'
        ? actor.dexterity + Math.floor(actor.perception * 0.25) + Math.floor(actor.luck * 0.15) + actorAction.attackPointsSpent
        : actor.strength + Math.floor(actor.dexterity * 0.25) + actorAction.attackPointsSpent;

  const criticalChance = clampHitChance(
    Math.floor(actor.luck * 0.7)
      + Math.floor((combatStyle === 'MAGIC' ? actor.intelligence : actor.perception) * 0.6)
      + (actorAction.attackZone === TargetZone.Head ? 12 : 3)
      + getCritChanceBonus(actorGuardMode)
      + getEnemyCritBonusAgainst(targetGuardMode)
      + (actor.combatModifiers?.critChancePercent ?? 0)
      + (target.combatModifiers?.critChanceTakenPercent ?? 0),
  );
  const isCritical = Math.floor(random() * 100) + 1 <= criticalChance;
  const criticalMultiplier = isCritical ? 1.5 : 1;
  const outgoingMultiplier =
    getOutgoingDamageMultiplier(actorGuardMode) * (1 + (actor.combatModifiers?.outgoingDamagePercent ?? 0) / 100);
  const incomingMultiplier = getIncomingDamageMultiplier(targetGuardMode);
  const matchedDefense = targetAction.defenseZones.includes(actorAction.attackZone);

  let finalDamage = 0;
  let blocked = 0;
  if (matchedDefense) {
    const mitigation = combatStyle === 'MAGIC'
      ? Math.round(target.willpower * 0.7 + targetAction.defensePointsSpent * 1.2)
      : Math.round(target.constitution * 0.65 + targetAction.defensePointsSpent * 1.2);
    finalDamage = Math.max(1, Math.round(baseDamage * criticalMultiplier * outgoingMultiplier * incomingMultiplier) - mitigation);
    blocked = Math.max(0, Math.round(baseDamage * criticalMultiplier) - finalDamage);
  } else {
    const mitigation = combatStyle === 'MAGIC'
      ? Math.floor(target.willpower * 0.35)
      : Math.floor(target.constitution * 0.3);
    finalDamage = Math.max(1, Math.round(baseDamage * criticalMultiplier * outgoingMultiplier * incomingMultiplier) - mitigation);
    blocked = Math.max(0, Math.round(baseDamage * criticalMultiplier) - finalDamage);
  }

  if (actorAction.attackZone === TargetZone.Head && finalDamage > 0) {
    finalDamage += Math.max(1, Math.floor(actor.perception * 0.2 + actor.dexterity * 0.1));
  }

  if ((actorAction.attackZone === TargetZone.LeftArm || actorAction.attackZone === TargetZone.RightArm) && finalDamage > 0) {
    target.strength = Math.max(1, target.strength - 1);
    logs.push({
      round: state.roundNumber,
      actorId: actor.id,
      targetId: target.id,
      type: 'INFO',
      text: `${actor.name} disrupts ${target.name}'s weapon arm`,
    });
  }

  if (actorAction.attackZone === TargetZone.Legs && finalDamage > 0) {
    target.dexterity = Math.max(1, target.dexterity - 1);
    logs.push({
      round: state.roundNumber,
      actorId: actor.id,
      targetId: target.id,
      type: 'INFO',
      text: `${actor.name} slows ${target.name}`,
    });
  }

  const centerMultiplier = typeof actor.splashCenterMultiplier === 'number' && Number.isFinite(actor.splashCenterMultiplier)
    ? Math.max(1, actor.splashCenterMultiplier)
    : 1;
  const outerMultiplier = typeof actor.splashOuterMultiplier === 'number' && Number.isFinite(actor.splashOuterMultiplier)
    ? Math.max(0, actor.splashOuterMultiplier)
    : 0.5;

  const impacted = new Map<string, { entity: ArenaCombatEntity; damage: number; kind: 'primary' | 'pierce' | 'splash' }>();
  const primaryDamage = Math.max(1, Math.round(finalDamage * (actor.splashRadius ? centerMultiplier : 1)));
  impacted.set(target.id, { entity: target, damage: primaryDamage, kind: 'primary' });

  if (typeof actor.pierceTargets === 'number' && actor.pierceTargets >= 2) {
    const fromX = actor.battlefieldX ?? 0;
    const fromY = actor.battlefieldY ?? 0;
    const toX = target.battlefieldX ?? 0;
    const toY = target.battlefieldY ?? 0;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const isLine = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
    if (isLine) {
      const stepX = Math.sign(dx);
      const stepY = Math.sign(dy);
      let x = toX + stepX;
      let y = toY + stepY;
      let remaining = Math.floor(actor.pierceTargets) - 1;
      while (remaining > 0 && isWithinBattlefield(state, x, y)) {
        if (isTileSightBlocked(state, x, y)) {
          break;
        }
        const nextVictim = state.entities.find((entity) =>
          entity.isAlive && entity.id !== actor.id && entity.battlefieldX === x && entity.battlefieldY === y,
        );
        if (nextVictim && !impacted.has(nextVictim.id) && canAttackAtDistance(state, actor, nextVictim)) {
          impacted.set(nextVictim.id, { entity: nextVictim, damage: finalDamage, kind: 'pierce' });
          remaining -= 1;
        }
        x += stepX;
        y += stepY;
      }
    }
  }

  if (typeof actor.splashRadius === 'number' && actor.splashRadius >= 1) {
    const radius = Math.max(1, Math.floor(actor.splashRadius));
    const impactX = target.battlefieldX ?? 0;
    const impactY = target.battlefieldY ?? 0;
    for (const victim of state.entities) {
      if (!victim.isAlive || victim.id === actor.id || impacted.has(victim.id)) {
        continue;
      }
      const distance = Math.abs((victim.battlefieldX ?? 0) - impactX) + Math.abs((victim.battlefieldY ?? 0) - impactY);
      if (distance <= radius) {
        impacted.set(victim.id, { entity: victim, damage: Math.max(1, Math.round(finalDamage * outerMultiplier)), kind: 'splash' });
      }
    }
  }

  for (const entry of impacted.values()) {
    const victim = entry.entity;
    if (!victim.isAlive) {
      continue;
    }

    const appliedDamage = applyIncomingEquipmentDamageAdjust(entry.damage, combatStyle, victim);
    victim.currentHp = Math.max(0, victim.currentHp - appliedDamage);
    victim.isAlive = victim.currentHp > 0;

    const tag = entry.kind === 'primary'
      ? ''
      : entry.kind === 'pierce'
        ? ' (pierce)'
        : ' (splash)';

    logs.push({
      round: state.roundNumber,
      actorId: actor.id,
      targetId: victim.id,
      type: 'HIT',
      amount: appliedDamage,
      text: `${actor.name} hits ${victim.name} in ${actorAction.attackZone} for ${appliedDamage} damage${isCritical ? ' (critical)' : ''}${tag}`,
    });

    if (!victim.isAlive) {
      logs.push({
        round: state.roundNumber,
        actorId: victim.id,
        type: 'DEATH',
        text: `${victim.name} dies`,
      });
    } else if (entry.kind !== 'primary') {
      const victimAction = byActor.get(victim.id) ?? defaultWaitAction(victim, actor);
      if (victimAction.actionType === ActionType.Defend) {
        logs.push({
          round: state.roundNumber,
          actorId: victim.id,
          targetId: actor.id,
          type: 'INFO',
          text: `${victim.name} was guarding but got caught in the impact`,
        });
      }
    }
  }

  if (blocked > 0) {
    logs.push({
      round: state.roundNumber,
      actorId: target.id,
      targetId: actor.id,
      type: 'BLOCK',
      amount: blocked,
      text: `${target.name} blocks ${blocked} damage`,
    });
  }
}

function defaultWaitAction(actor: ArenaCombatEntity, enemy: ArenaCombatEntity): ArenaCombatAction {
  return {
    actorId: actor.id,
    targetId: enemy.id,
    attackZone: TargetZone.Chest,
    defenseZones: [...DEFENSIVE_ZONES],
    attackPointsSpent: 0,
    defensePointsSpent: 0,
    actionType: ActionType.Wait,
  };
}

export function createNpcAction(state: ArenaBattleState, actorId: string): ArenaCombatAction {
  const actor = getEntity(state, actorId);
  const enemies = getHostileEntities(state, actor);
  if (enemies.length === 0) {
    return defaultWaitAction(actor, actor);
  }

  const target = selectNearestEnemy(actor, enemies);
  const lowHpRatio = actor.currentHp / Math.max(1, actor.maxHp);
  const combatStyle = classifyCombatStyle(actor);
  const maxRange = getMaxAttackRange(actor, combatStyle);
  const desiredMinDistance = combatStyle === 'MELEE' ? 1 : 2;
  const preferredDefense = lowHpRatio < 0.5
    ? [TargetZone.Head]
    : [TargetZone.Chest, TargetZone.Abdomen];
  const currentDistance = getBattlefieldDistance(actor, target);

  const inRange = currentDistance <= maxRange;
  const canAttackNow = inRange && actor.currentStamina >= 10;

  if (lowHpRatio < 0.25 && currentDistance <= 1 && !canAttackNow) {
    return ensureActionPoints(actor, {
      actorId,
      targetId: target.id,
      attackZone: TargetZone.Chest,
      defenseZones: preferredDefense,
      attackPointsSpent: 0,
      defensePointsSpent: 0,
      actionType: ActionType.Move,
      movementType: MovementType.Disengage,
    });
  }

  if (combatStyle === 'MELEE' && currentDistance > 1) {
    return ensureActionPoints(actor, {
      actorId,
      targetId: target.id,
      attackZone: TargetZone.Chest,
      defenseZones: preferredDefense,
      attackPointsSpent: 0,
      defensePointsSpent: 0,
      actionType: ActionType.Move,
      movementType: MovementType.Step,
    });
  }

  if ((combatStyle === 'RANGED' || combatStyle === 'MAGIC') && currentDistance < desiredMinDistance) {
    return ensureActionPoints(actor, {
      actorId,
      targetId: target.id,
      attackZone: TargetZone.Chest,
      defenseZones: preferredDefense,
      attackPointsSpent: 0,
      defensePointsSpent: 0,
      actionType: ActionType.Move,
      movementType: currentDistance <= 1 ? MovementType.Disengage : MovementType.Step,
    });
  }

  if ((combatStyle === 'RANGED' || combatStyle === 'MAGIC') && currentDistance > maxRange) {
    return ensureActionPoints(actor, {
      actorId,
      targetId: target.id,
      attackZone: TargetZone.Chest,
      defenseZones: preferredDefense,
      attackPointsSpent: 0,
      defensePointsSpent: 0,
      actionType: ActionType.Move,
      movementType: MovementType.Step,
    });
  }

  if (lowHpRatio < 0.3 && !canAttackNow) {
    return ensureActionPoints(actor, {
      actorId,
      targetId: target.id,
      attackZone: TargetZone.Chest,
      defenseZones: preferredDefense,
      attackPointsSpent: 0,
      defensePointsSpent: 0,
      actionType: ActionType.Defend,
    });
  }

  return ensureActionPoints(actor, {
    actorId,
    targetId: target.id,
    attackZone: selectNpcAttackZone(actor, getDistanceBandBetweenEntities(actor, target)),
    defenseZones: preferredDefense,
    attackPointsSpent: Math.max(0, Math.round(actor.maxStamina * 0.35)),
    defensePointsSpent: Math.max(0, Math.round(actor.maxStamina * 0.15)),
    actionType: ActionType.Attack,
  });
}

export function resolveRound(params: {
  state: ArenaBattleState;
  plannedActions: ArenaCombatAction[];
  random?: () => number;
}): ArenaBattleState {
  const random = params.random ?? Math.random;
  const state = params.state;
  if (state.isFinished) {
    return state;
  }

  syncBattlefieldPositions(state.entities, state.distance, getBattleMapWidth(state), getBattleMapHeight(state));
  if (!state.battlefieldTiles || state.battlefieldTiles.length === 0) {
    state.battlefieldTiles = createDefaultBattlefieldTiles(getBattleMapWidth(state), getBattleMapHeight(state));
  }
  if (!state.battlefieldTraps) {
    state.battlefieldTraps = [];
  }
  updateBattleDistance(state);

  state.roundNumber += 1;
  for (const entity of state.entities) {
    if (!entity.isAlive) {
      continue;
    }
    entity.initiative = calculateInitiative(entity);
  }

  const byActor = new Map<string, ArenaCombatAction>();
  for (const action of params.plannedActions) {
    const actor = getEntity(state, action.actorId);
    byActor.set(action.actorId, ensureActionPoints(actor, action));
  }

  const order = state.entities
    .filter((item) => item.isAlive)
    .sort((a, b) => b.initiative - a.initiative)
    .map((item) => item.id);

  const logs: CombatLogEntry[] = [];

  for (const actorId of order) {
    const actor = getEntity(state, actorId);
    if (!actor.isAlive) {
      continue;
    }

    const enemies = getHostileEntities(state, actor);
    if (enemies.length === 0) {
      break;
    }

    if (actor.currentStamina <= 0) {
      logs.push({
        round: state.roundNumber,
        actorId,
        type: 'INFO',
        text: `${actor.name} is exhausted and skips turn`,
      });
      continue;
    }

    const fallback = shouldUseNpcFallback(state, actor)
      ? createNpcAction(state, actorId)
      : defaultWaitAction(actor, enemies[0]!);
    const actorAction = byActor.get(actorId) ?? fallback;
    const target = enemies.find((item) => item.id === actorAction.targetId) ?? enemies[0]!;
    const targetAction = byActor.get(target.id) ?? defaultWaitAction(target, actor);

    if (actorAction.actionType === ActionType.Wait) {
      logs.push({
        round: state.roundNumber,
        actorId,
        type: 'INFO',
        text: `${actor.name} waits`,
      });
      continue;
    }

    let movedCells = 0;
    if (actorAction.movementType) {
      if (!spendStamina(actor, getMovementStaminaCost(actorAction.movementType))) {
        logs.push({
          round: state.roundNumber,
          actorId,
          type: 'INFO',
          text: `${actor.name} lacks stamina to move`,
        });
        continue;
      }

      const movement = applyMovement(state, actor, actorAction, target);
      movedCells = movement.cellsMoved;

      if (!movement.moved) {
        logs.push({
          round: state.roundNumber,
          actorId,
          type: 'INFO',
          text: `${actor.name} cannot move: ${movement.reason ?? 'movement failed'}`,
        });
        if (actorAction.actionType === ActionType.Move) {
          continue;
        }
      } else {
        logs.push({
          round: state.roundNumber,
          actorId,
          type: 'INFO',
          text: `${actor.name} moves to (${(actor.battlefieldX ?? 0) + 1}, ${(actor.battlefieldY ?? 0) + 1})`,
        });
        const triggeredTrap = state.battlefieldTraps.find((trap) => trap.isActive !== false && trap.x === actor.battlefieldX && trap.y === actor.battlefieldY);
        if (triggeredTrap) {
          logs.push({
            round: state.roundNumber,
            actorId,
            type: 'INFO',
            text: `${actor.name} stepped onto a trap.`,
          });
          if ((triggeredTrap.damage ?? 3) > 0) {
            const amount = triggeredTrap.damage ?? 3;
            actor.currentHp = Math.max(0, actor.currentHp - amount);
            actor.isAlive = actor.currentHp > 0;
            logs.push({
              round: state.roundNumber,
              actorId,
              type: 'HIT',
              amount,
              text: `${actor.name} takes ${amount} damage from trap ${triggeredTrap.name}`,
            });
          } else {
            const amount = triggeredTrap.staminaCost ?? 5;
            actor.currentStamina = Math.max(0, actor.currentStamina - amount);
            logs.push({
              round: state.roundNumber,
              actorId,
              type: 'INFO',
              text: `${actor.name} loses ${amount} stamina from trap ${triggeredTrap.name}`,
            });
          }
          if (triggeredTrap.triggerOnce) {
            triggeredTrap.isActive = false;
          }
        }
        if (movement.opportunityEnemies.length > 0) {
          resolveOpportunityAttacks({
            state,
            mover: actor,
            moverAction: actorAction,
            enemies: movement.opportunityEnemies,
            logs,
            random,
          });
          checkVictory(state);
          if (!actor.isAlive || state.isFinished) {
            if (state.isFinished) {
              break;
            }
            continue;
          }
        }
      }
    }

    if (actorAction.actionType === ActionType.Move) {
      continue;
    }

    if (actorAction.actionType === ActionType.Defend) {
      if (!spendStamina(actor, getActionStaminaCost(ActionType.Defend, actorAction.defenseZones))) {
        logs.push({
          round: state.roundNumber,
          actorId,
          type: 'INFO',
          text: `${actor.name} lacks stamina to defend`,
        });
        continue;
      }

      const guardMode = getGuardMode(actorAction.defenseZones);
      logs.push({
        round: state.roundNumber,
        actorId,
        type: 'INFO',
        text: guardMode === 'RECKLESS'
          ? `${actor.name} drops all defense and fights recklessly`
          : `${actor.name} guards ${actorAction.defenseZones.join(' & ')}`,
      });
      continue;
    }

    if (!canAttackAfterMovement(actorAction, movedCells)) {
      logs.push({
        round: state.roundNumber,
        actorId,
        type: 'INFO',
        text: `${actor.name} cannot attack after that movement`,
      });
      continue;
    }

    if (!spendStamina(actor, getActionStaminaCost(ActionType.Attack))) {
      logs.push({
        round: state.roundNumber,
        actorId,
        type: 'INFO',
        text: `${actor.name} lacks stamina to attack`,
      });
      continue;
    }

    resolveAttack({
      state,
      actor,
      target,
      actorAction,
      targetAction,
      byActor,
      logs,
      random,
    });

    checkVictory(state);
    if (state.isFinished) {
      break;
    }
  }

  const round: ArenaCombatRound = {
    roundNumber: state.roundNumber,
    order,
    actions: order.map((id) => byActor.get(id) ?? defaultWaitAction(getEntity(state, id), getEntity(state, id))),
    logs,
  };

  state.lastRound = round;
  state.logs = [...state.logs, ...logs];
  updateBattleDistance(state);
  checkVictory(state);
  return state;
}
