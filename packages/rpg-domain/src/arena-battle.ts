import type { Race } from './races';

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

export const BATTLEFIELD_GRID_SIZE = 12;

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
  position: number;
  battlefieldX?: number;
  battlefieldY?: number;
}

export interface ArenaCombatAction {
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

export interface ArenaBattleState {
  combatId: string;
  roundNumber: number;
  distance: DistanceBand;
  entities: ArenaCombatEntity[];
  logs: CombatLogEntry[];
  lastRound?: ArenaCombatRound;
  isFinished: boolean;
  winner?: TeamSide;
}

export interface BattlefieldTilePlacement {
  entityId: string;
  x: number;
  y: number;
  team: TeamSide;
}

const DEFENSIVE_ZONES: TargetZone[] = [TargetZone.Chest, TargetZone.Abdomen];
const ALL_TARGET_ZONES: TargetZone[] = [
  TargetZone.Head,
  TargetZone.Chest,
  TargetZone.Abdomen,
  TargetZone.LeftArm,
  TargetZone.RightArm,
  TargetZone.Legs,
];

function getDistanceColumns(distance: DistanceBand): { left: number; right: number } {
  if (distance === DistanceBand.Far) {
    return { left: 1, right: 10 };
  }

  if (distance === DistanceBand.Near) {
    return { left: 3, right: 8 };
  }

  return { left: 5, right: 6 };
}

function classifyGapDistance(gap: number): DistanceBand {
  if (gap <= 1) {
    return DistanceBand.Melee;
  }

  if (gap <= 5) {
    return DistanceBand.Near;
  }

  return DistanceBand.Far;
}

export function getDistanceBandForGap(gap: number): DistanceBand {
  return classifyGapDistance(gap);
}

function distributeRows(count: number): number[] {
  if (count <= 0) {
    return [];
  }

  return Array.from({ length: count }, (_, index) =>
    Math.max(0, Math.min(BATTLEFIELD_GRID_SIZE - 1, Math.round(((index + 1) * (BATTLEFIELD_GRID_SIZE - 1)) / (count + 1)))),
  );
}

function getDefaultBattlefieldTilePlacements(
  entities: ArenaCombatEntity[],
  distance: DistanceBand,
): BattlefieldTilePlacement[] {
  const columns = getDistanceColumns(distance);
  const leftTeam = entities
    .filter((entity) => entity.isAlive && entity.team === TeamSide.Left)
    .sort((left, right) => left.position - right.position);
  const rightTeam = entities
    .filter((entity) => entity.isAlive && entity.team === TeamSide.Right)
    .sort((left, right) => left.position - right.position);
  const leftRows = distributeRows(leftTeam.length);
  const rightRows = distributeRows(rightTeam.length);

  return [
    ...leftTeam.map((entity, index) => ({
      entityId: entity.id,
      x: columns.left,
      y: leftRows[index] ?? Math.floor(BATTLEFIELD_GRID_SIZE / 2),
      team: entity.team,
    })),
    ...rightTeam.map((entity, index) => ({
      entityId: entity.id,
      x: columns.right,
      y: rightRows[index] ?? Math.floor(BATTLEFIELD_GRID_SIZE / 2),
      team: entity.team,
    })),
  ];
}

function hasStoredBattlefieldPositions(entities: ArenaCombatEntity[]): boolean {
  return entities
    .filter((entity) => entity.isAlive)
    .every((entity) => Number.isInteger(entity.battlefieldX) && Number.isInteger(entity.battlefieldY));
}

function syncBattlefieldPositions(entities: ArenaCombatEntity[], distance: DistanceBand): void {
  if (hasStoredBattlefieldPositions(entities)) {
    return;
  }

  const placements = getDefaultBattlefieldTilePlacements(entities, distance);
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

function getHorizontalGap(left: ArenaCombatEntity, right: ArenaCombatEntity): number {
  return Math.abs((left.battlefieldX ?? 0) - (right.battlefieldX ?? 0));
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
      minimumGap = Math.min(minimumGap, getHorizontalGap(left, right));
    }
  }

  if (!Number.isFinite(minimumGap)) {
    return fallback;
  }

  return classifyGapDistance(minimumGap);
}

function getTacticalDistance(left: ArenaCombatEntity, right: ArenaCombatEntity): number {
  return getHorizontalGap(left, right) + Math.abs((left.battlefieldY ?? 0) - (right.battlefieldY ?? 0));
}

function selectNearestEnemy(actor: ArenaCombatEntity, enemies: ArenaCombatEntity[]): ArenaCombatEntity {
  return [...enemies].sort((left, right) => getTacticalDistance(actor, left) - getTacticalDistance(actor, right))[0] ?? enemies[0]!;
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

function findOpenRow(state: ArenaBattleState, x: number, preferredY: number, actorId: string): number | null {
  for (let offset = 0; offset < BATTLEFIELD_GRID_SIZE; offset += 1) {
    const candidates = offset === 0 ? [preferredY] : [preferredY - offset, preferredY + offset];
    for (const y of candidates) {
      if (y < 0 || y >= BATTLEFIELD_GRID_SIZE) {
        continue;
      }

      if (!isTileOccupied(state, x, y, actorId)) {
        return y;
      }
    }
  }

  return null;
}

function findClosestTileForBand(
  state: ArenaBattleState,
  actor: ArenaCombatEntity,
  target: ArenaCombatEntity,
  desiredBand: DistanceBand,
): { x: number; y: number } | null {
  const actorX = actor.battlefieldX ?? 0;
  const actorY = actor.battlefieldY ?? Math.floor(BATTLEFIELD_GRID_SIZE / 2);
  const targetX = target.battlefieldX ?? 0;
  const candidateColumns = Array.from({ length: BATTLEFIELD_GRID_SIZE }, (_, index) => index)
    .filter((column) => (actor.team === TeamSide.Left ? column < targetX : column > targetX))
    .filter((column) => classifyGapDistance(Math.abs(column - targetX)) === desiredBand)
    .sort((left, right) => Math.abs(left - actorX) - Math.abs(right - actorX));

  for (const column of candidateColumns) {
    const row = findOpenRow(state, column, actorY, actor.id);
    if (row !== null) {
      return { x: column, y: row };
    }
  }

  return null;
}

function moveActorOnBattlefield(
  state: ArenaBattleState,
  actor: ArenaCombatEntity,
  target: ArenaCombatEntity,
  preferredDistance: DistanceBand,
  destinationX?: number,
  destinationY?: number,
): boolean {
  const currentBand = classifyGapDistance(getHorizontalGap(actor, target));
  const nextBand = stepDistanceToward(currentBand, preferredDistance);

  if (nextBand === currentBand) {
    return false;
  }

  if (Number.isInteger(destinationX) && Number.isInteger(destinationY)) {
    const x = destinationX as number;
    const y = destinationY as number;
    const targetX = target.battlefieldX ?? 0;
    const destinationBand = classifyGapDistance(Math.abs(x - targetX));
    const staysOnOwnSide = actor.team === TeamSide.Left ? x < targetX : x > targetX;

    if (
      x >= 0
      && x < BATTLEFIELD_GRID_SIZE
      && y >= 0
      && y < BATTLEFIELD_GRID_SIZE
      && staysOnOwnSide
      && destinationBand === nextBand
      && !isTileOccupied(state, x, y, actor.id)
    ) {
      actor.battlefieldX = x;
      actor.battlefieldY = y;
      updateBattleDistance(state);
      return true;
    }
  }

  const nextTile = findClosestTileForBand(state, actor, target, nextBand);
  if (!nextTile) {
    return false;
  }

  actor.battlefieldX = nextTile.x;
  actor.battlefieldY = nextTile.y;
  updateBattleDistance(state);
  return true;
}

export function getBattlefieldTilePlacements(
  entities: ArenaCombatEntity[],
  distance: DistanceBand,
): BattlefieldTilePlacement[] {
  if (!hasStoredBattlefieldPositions(entities)) {
    return getDefaultBattlefieldTilePlacements(entities, distance);
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
  return entity.perception + Math.floor(entity.dexterity * 0.5);
}

export function clampHitChance(chance: number): number {
  return Math.max(25, Math.min(95, chance));
}

export function createArenaCombatEntity(input: Omit<ArenaCombatEntity, 'initiative' | 'isAlive'>): ArenaCombatEntity {
  return {
    ...input,
    initiative: calculateInitiative(input),
    isAlive: input.currentHp > 0,
  };
}

export function createInitialBattleState(params: {
  combatId: string;
  entities: ArenaCombatEntity[];
  distance?: DistanceBand;
}): ArenaBattleState {
  const state: ArenaBattleState = {
    combatId: params.combatId,
    roundNumber: 0,
    distance: params.distance ?? DistanceBand.Melee,
    entities: params.entities,
    logs: [],
    isFinished: false,
  };

  syncBattlefieldPositions(state.entities, state.distance);
  updateBattleDistance(state);
  return state;
}

function ensureActionPoints(entity: ArenaCombatEntity, action: ArenaCombatAction): ArenaCombatAction {
  const available = Math.max(0, entity.currentStamina);
  const attack = Math.max(0, action.attackPointsSpent);
  const defense = Math.max(0, action.defensePointsSpent);
  const defenseZones = action.defenseZones.filter((zone, index, zones) => zones.indexOf(zone) === index).slice(0, 2);

  if (attack + defense <= available) {
    return {
      ...action,
      defenseZones: defenseZones.length > 0 ? defenseZones : DEFENSIVE_ZONES,
      attackPointsSpent: attack,
      defensePointsSpent: defense,
      preferredDistance: action.preferredDistance,
    };
  }

  const normalizedAttack = Math.min(attack, available);
  const normalizedDefense = Math.max(0, available - normalizedAttack);
  return {
    ...action,
    defenseZones: defenseZones.length > 0 ? defenseZones : DEFENSIVE_ZONES,
    attackPointsSpent: normalizedAttack,
    defensePointsSpent: normalizedDefense,
    preferredDistance: action.preferredDistance,
  };
}

function stepDistanceToward(current: DistanceBand, target: DistanceBand): DistanceBand {
  const order = [DistanceBand.Melee, DistanceBand.Near, DistanceBand.Far];
  const currentIndex = order.indexOf(current);
  const targetIndex = order.indexOf(target);

  if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) {
    return current;
  }

  return order[currentIndex + (targetIndex > currentIndex ? 1 : -1)] ?? current;
}

function classifyPreferredDistance(actor: ArenaCombatEntity): DistanceBand {
  if (actor.intelligence >= actor.strength && actor.intelligence >= actor.dexterity) {
    return DistanceBand.Far;
  }

  if (actor.dexterity > actor.strength) {
    return DistanceBand.Near;
  }

  return DistanceBand.Melee;
}

function classifyCombatStyle(actor: ArenaCombatEntity): 'MELEE' | 'RANGED' | 'MAGIC' {
  if (actor.intelligence >= actor.strength && actor.intelligence >= actor.dexterity) {
    return 'MAGIC';
  }

  if (actor.dexterity > actor.strength) {
    return 'RANGED';
  }

  return 'MELEE';
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

function resolveAttack(params: {
  state: ArenaBattleState;
  actor: ArenaCombatEntity;
  target: ArenaCombatEntity;
  actorAction: ArenaCombatAction;
  targetAction: ArenaCombatAction;
  logs: CombatLogEntry[];
  random: () => number;
}): void {
  const { state, actor, target, actorAction, targetAction, logs, random } = params;

  const combatStyle = classifyCombatStyle(actor);
  const actualDistance = classifyGapDistance(getHorizontalGap(actor, target));
  const canAttackAtDistance =
    combatStyle === 'MELEE'
      ? actualDistance === DistanceBand.Melee
      : combatStyle === 'RANGED'
        ? actualDistance === DistanceBand.Near || actualDistance === DistanceBand.Far
        : true;

  if (!canAttackAtDistance) {
    logs.push({
      round: state.roundNumber,
      actorId: actor.id,
      targetId: target.id,
      type: 'INFO',
      text: `${actor.name} cannot hit ${target.name}: target is out of effective range`,
    });
    return;
  }

  const distancePenalty =
    combatStyle === 'MELEE'
      ? 0
      : combatStyle === 'RANGED'
        ? actualDistance === DistanceBand.Near
          ? 0
          : 6
        : actualDistance === DistanceBand.Melee
          ? 4
          : actualDistance === DistanceBand.Near
            ? 0
            : 2;
  const hitChance = clampHitChance(58 + actor.perception * 3 + actor.luck - target.dexterity * 2 - distancePenalty);
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
      ? actor.intelligence + Math.floor(actor.willpower * 0.4) + actorAction.attackPointsSpent
      : combatStyle === 'RANGED'
        ? actor.dexterity + Math.floor(actor.perception * 0.4) + actorAction.attackPointsSpent
        : actor.strength + actorAction.attackPointsSpent;
  const criticalChance = clampHitChance(
    actor.luck + (combatStyle === 'MAGIC' ? actor.intelligence : actor.perception) + (actorAction.attackZone === TargetZone.Head ? 18 : 4),
  );
  const isCritical = Math.floor(random() * 100) + 1 <= criticalChance;
  const criticalMultiplier = isCritical ? 1.5 : 1;
  let finalDamage = 0;
  let blocked = 0;
  const matchedDefense = targetAction.defenseZones.includes(actorAction.attackZone);

  if (matchedDefense) {
    const mitigation = Math.round(
      (combatStyle === 'MAGIC' ? target.willpower : target.constitution) + targetAction.defensePointsSpent * 1.5,
    );
    finalDamage = Math.max(1, Math.round(baseDamage * criticalMultiplier) - mitigation);
    blocked = Math.max(0, Math.round(baseDamage * criticalMultiplier) - finalDamage);
  } else {
    const mitigation = Math.floor((combatStyle === 'MAGIC' ? target.willpower : target.constitution) * 0.5);
    finalDamage = Math.max(1, Math.round(baseDamage * criticalMultiplier) - mitigation);
    blocked = Math.max(0, Math.round(baseDamage * criticalMultiplier) - finalDamage);
  }

  if (actorAction.attackZone === TargetZone.Head && finalDamage > 0) {
    finalDamage += Math.max(1, Math.floor(actor.perception * 0.3));
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

  target.currentHp = Math.max(0, target.currentHp - finalDamage);
  target.isAlive = target.currentHp > 0;

  logs.push({
    round: state.roundNumber,
    actorId: actor.id,
    targetId: target.id,
    type: 'HIT',
    amount: finalDamage,
    text: `${actor.name} hits ${target.name} in ${actorAction.attackZone} for ${finalDamage} damage${isCritical ? ' (critical)' : ''}`,
  });

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

  if (!target.isAlive) {
    logs.push({
      round: state.roundNumber,
      actorId: target.id,
      type: 'DEATH',
      text: `${target.name} dies`,
    });
  }
}

function defaultWaitAction(actor: ArenaCombatEntity, enemy: ArenaCombatEntity): ArenaCombatAction {
  return {
    actorId: actor.id,
    targetId: enemy.id,
    attackZone: TargetZone.Chest,
    defenseZones: DEFENSIVE_ZONES,
    attackPointsSpent: 0,
    defensePointsSpent: 0,
    actionType: ActionType.Wait,
  };
}

export function createNpcAction(state: ArenaBattleState, actorId: string): ArenaCombatAction {
  const actor = getEntity(state, actorId);
  const enemies = state.entities.filter((item) => item.team !== actor.team && item.isAlive);
  if (enemies.length === 0) {
    return defaultWaitAction(actor, actor);
  }

  const target = selectNearestEnemy(actor, enemies);
  const lowHpRatio = actor.currentHp / Math.max(1, actor.maxHp);
  const combatStyle = classifyCombatStyle(actor);
  const attackBias = lowHpRatio < 0.4 ? 0.35 : 0.65;
  const attackPoints = Math.max(0, Math.round(actor.maxStamina * attackBias));
  const defensePoints = Math.max(0, actor.maxStamina - attackPoints);
  const preferredDefense = lowHpRatio < 0.5
    ? [TargetZone.Head, TargetZone.Chest]
    : [TargetZone.Chest, TargetZone.Abdomen];
  const preferredDistance = classifyPreferredDistance(actor);
  const currentBand = classifyGapDistance(getHorizontalGap(actor, target));
  const canReposition = currentBand !== DistanceBand.Melee;

  if ((combatStyle === 'RANGED' || combatStyle === 'MAGIC') && currentBand === DistanceBand.Melee) {
    return ensureActionPoints(actor, {
      actorId,
      targetId: target.id,
      attackZone: TargetZone.Chest,
      defenseZones: preferredDefense,
      attackPointsSpent: 0,
      defensePointsSpent: actor.maxStamina,
      actionType: ActionType.Defend,
    });
  }

  if (canReposition && currentBand !== preferredDistance) {
    return ensureActionPoints(actor, {
      actorId,
      targetId: target.id,
      attackZone: TargetZone.Chest,
      defenseZones: preferredDefense,
      attackPointsSpent: 0,
      defensePointsSpent: Math.max(0, Math.round(actor.maxStamina * 0.5)),
      actionType: ActionType.Move,
      preferredDistance,
    });
  }

  if (lowHpRatio < 0.3) {
    return ensureActionPoints(actor, {
      actorId,
      targetId: target.id,
      attackZone: TargetZone.Chest,
      defenseZones: preferredDefense,
      attackPointsSpent: 0,
      defensePointsSpent: actor.maxStamina,
      actionType: ActionType.Defend,
    });
  }

  return ensureActionPoints(actor, {
    actorId,
    targetId: target.id,
    attackZone: selectNpcAttackZone(actor, currentBand),
    defenseZones: preferredDefense,
    attackPointsSpent: attackPoints,
    defensePointsSpent: defensePoints,
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

  syncBattlefieldPositions(state.entities, state.distance);
  updateBattleDistance(state);

  state.roundNumber += 1;
  for (const entity of state.entities) {
    if (!entity.isAlive) {
      continue;
    }
    entity.currentStamina = entity.maxStamina;
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

    const enemies = state.entities.filter((item) => item.team !== actor.team && item.isAlive);
    if (enemies.length === 0) {
      break;
    }

    const fallback = defaultWaitAction(actor, enemies[0]);
    const actorAction = byActor.get(actorId) ?? fallback;
    const target = enemies.find((item) => item.id === actorAction.targetId) ?? enemies[0];
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

    if (actorAction.actionType === ActionType.Defend) {
      logs.push({
        round: state.roundNumber,
        actorId,
        type: 'INFO',
        text: `${actor.name} guards ${actorAction.defenseZones.join(' & ')}`,
      });
      continue;
    }

    if (actorAction.actionType === ActionType.Move) {
      const desiredDistance = actorAction.preferredDistance ?? classifyPreferredDistance(actor);
      const moved = moveActorOnBattlefield(
        state,
        actor,
        target,
        desiredDistance,
        actorAction.destinationX,
        actorAction.destinationY,
      );

      if (!moved) {
        logs.push({
          round: state.roundNumber,
          actorId,
          type: 'INFO',
          text: `${actor.name} holds position at ${state.distance}`,
        });
      } else {
        logs.push({
          round: state.roundNumber,
          actorId,
          type: 'INFO',
          text: `${actor.name} moves to (${(actor.battlefieldX ?? 0) + 1}, ${(actor.battlefieldY ?? 0) + 1}) and shifts the battle to ${state.distance}`,
        });
      }
      continue;
    }

    resolveAttack({
      state,
      actor,
      target,
      actorAction,
      targetAction,
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
  checkVictory(state);
  return state;
}
