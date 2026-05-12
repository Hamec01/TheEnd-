import {
  COMBAT_ACTION_COSTS,
  canAppendCombatCommand,
  collectAreaEffectTargets,
  createCombatCommandFromType,
  DEFAULT_MAX_AP_PER_ROUND,
  DEFAULT_MAX_COMMANDS_PER_ROUND,
  HARD_MAX_AP_PER_ROUND,
  HARD_MAX_COMMANDS_PER_ROUND,
  getBattlefieldDistance,
  getCombatRoundLimits,
  getReachableBattlefieldTiles,
  TeamSide,
  validateCombatTurnPlan,
  type ArenaBattleState,
  type ArenaCombatEntity,
  type CombatCommand,
  type CombatRoundLimits,
  type CombatTarget,
  type CombatTurnPlan,
} from '@theend/rpg-domain';
import type { SkillCooldownEntry } from '../skills/skill-runtime.service';

export type AiCombatIntent =
  | 'heal_self'
  | 'finish_weak_target'
  | 'attack'
  | 'use_skill'
  | 'move_to_range'
  | 'retreat'
  | 'guard'
  | 'escape'
  | 'support_ally'
  | 'avoid_friendly_fire'
  | 'wait';

export type AiCombatPersonality =
  | 'normal'
  | 'cautious'
  | 'aggressive'
  | 'reckless'
  | 'stupid'
  | 'traitor'
  | 'boss';

export type AiPlanRejectReason =
  | 'NO_TARGET'
  | 'TARGET_OUT_OF_RANGE'
  | 'NO_PATH'
  | 'NOT_ENOUGH_AP'
  | 'NOT_ENOUGH_STAMINA'
  | 'NOT_ENOUGH_MP'
  | 'NOT_ENOUGH_HP'
  | 'SKILL_ON_COOLDOWN'
  | 'FRIENDLY_FIRE_RISK'
  | 'ITEM_NOT_AVAILABLE'
  | 'WEAPON_NOT_AVAILABLE'
  | 'UNKNOWN';

export interface AiPlanDebugInfo {
  actorId: string;
  selectedTargetId?: string;
  intent?: AiCombatIntent;
  scores?: Record<string, number>;
  rejectedActions?: Array<{
    action: string;
    reason: AiPlanRejectReason | string;
  }>;
  log?: string[];
}

export interface BuildAiCombatPlanParams {
  battleState: ArenaBattleState;
  actorId: string;
  personality?: AiCombatPersonality;
  preferredTargetId?: string;
  roundLimits?: CombatRoundLimits;
  skillCooldowns?: SkillCooldownEntry[];
}

export interface BuildAiCombatPlanResult {
  plan: CombatTurnPlan;
  debug?: AiPlanDebugInfo;
}

interface PlannerContext {
  battleState: ArenaBattleState;
  actor: ArenaCombatEntity;
  personality: AiCombatPersonality;
  limits: CombatRoundLimits;
  skillCooldowns: SkillCooldownEntry[];
  preferredTargetId?: string;
  commands: CombatCommand[];
  debug: AiPlanDebugInfo;
}

interface DynamicAiSkill {
  id: string;
  target?: 'self' | 'entity' | 'cell';
  mpCost?: number;
  staminaCost?: number;
  hpCost?: number;
  range?: number;
  areaRadius?: number;
  isHealing?: boolean;
}

const DEFAULT_PERSONALITY: AiCombatPersonality = 'normal';

export function buildAiCombatTurnPlan(params: BuildAiCombatPlanParams): BuildAiCombatPlanResult {
  const actor = params.battleState.entities.find((entity) => entity.id === params.actorId);
  const debug: AiPlanDebugInfo = {
    actorId: params.actorId,
    log: ['[AI] planner:start'],
    rejectedActions: [],
    scores: {},
  };

  if (!actor || !actor.isAlive) {
    debug.log?.push('actor missing or dead -> fallback');
    return { plan: fallbackWaitOrGuardPlan(params.battleState, params.actorId, actor), debug };
  }

  const context: PlannerContext = {
    battleState: params.battleState,
    actor,
    personality: params.personality ?? inferPersonality(actor),
    limits: params.roundLimits ?? getCombatRoundLimits(actor),
    skillCooldowns: params.skillCooldowns ?? [],
    preferredTargetId: params.preferredTargetId,
    commands: [],
    debug,
  };

  let virtualX = context.actor.battlefieldX ?? 0;
  let virtualY = context.actor.battlefieldY ?? 0;

  const target = selectAiTarget({
    battleState: context.battleState,
    actor: context.actor,
    preferredTargetId: context.preferredTargetId,
  });
  context.debug.selectedTargetId = target?.id;

  if (!target) {
    context.debug.rejectedActions?.push({ action: 'select_target', reason: 'NO_TARGET' });
    appendDefensiveFallback(context);
    return finalizePlan(context);
  }

  if (shouldUseStrongGuard(context)) {
    tryAppend(context, createAiStrongGuardCommand());
    context.debug.intent = 'guard';
  }

  const healingActionTaken = tryUseHealing(context);
  if (healingActionTaken) {
    context.debug.intent = 'heal_self';
  }

  for (let step = 0; step < context.limits.maxCommands; step += 1) {
    if (isAtPlanCapacity(context)) {
      break;
    }

    const liveTarget = selectAiTarget({
      battleState: context.battleState,
      actor: context.actor,
      preferredTargetId: context.preferredTargetId,
    });
    if (!liveTarget) {
      break;
    }

    const distance = getCellDistance({ x: virtualX, y: virtualY }, { x: liveTarget.battlefieldX ?? 0, y: liveTarget.battlefieldY ?? 0 });
    const attackRange = Math.max(1, Math.floor(context.actor.attackRange ?? 1));
    const lowTargetHpRatio = liveTarget.currentHp / Math.max(1, liveTarget.maxHp);

    if (isTargetEscaping(liveTarget, context.battleState)) {
      context.debug.log?.push(`target ${liveTarget.id} escaping -> priority boost`);
      context.debug.intent = 'escape';
    }

    // Finish weak target first when possible.
    if (distance <= attackRange && lowTargetHpRatio <= 0.3) {
      const skillFinisher = tryUseSingleTargetSkill(context, liveTarget);
      if (skillFinisher) {
        context.debug.intent = 'finish_weak_target';
        continue;
      }

      if (tryAppend(context, createAiBasicAttackCommand(liveTarget))) {
        context.debug.intent = 'finish_weak_target';
        continue;
      }
    }

    if (distance <= attackRange) {
      const areaSkillApplied = tryUseAreaSkill(context, liveTarget);
      if (areaSkillApplied) {
        context.debug.intent = 'use_skill';
        continue;
      }

      const singleSkillApplied = tryUseSingleTargetSkill(context, liveTarget, distance);
      if (singleSkillApplied) {
        context.debug.intent = 'use_skill';
        continue;
      }

      if (tryAppend(context, createAiBasicAttackCommand(liveTarget))) {
        context.debug.intent = 'attack';
        continue;
      }
    }

    const moveCommand = createAiMoveCommand(context.actor, liveTarget, context.battleState);
    if (moveCommand && tryAppend(context, moveCommand)) {
      if (moveCommand.target.kind === 'cell') {
        virtualX = moveCommand.target.x;
        virtualY = moveCommand.target.y;

        const projectedDistance = getCellDistance({ x: virtualX, y: virtualY }, { x: liveTarget.battlefieldX ?? 0, y: liveTarget.battlefieldY ?? 0 });
        if (projectedDistance <= attackRange && !isAtPlanCapacity(context)) {
          tryAppend(context, createAiBasicAttackCommand(liveTarget));
        }
      }
      context.debug.intent = 'move_to_range';
      continue;
    }

    break;
  }

  appendDefensiveFallback(context);
  return finalizePlan(context);
}

export function selectAiTarget(params: {
  battleState: ArenaBattleState;
  actor: ArenaCombatEntity;
  preferredTargetId?: string;
}): ArenaCombatEntity | undefined {
  const enemies = params.battleState.entities.filter((entity) => entity.isAlive && entity.team !== params.actor.team);
  if (enemies.length === 0) {
    return undefined;
  }

  const preferred = params.preferredTargetId
    ? enemies.find((entity) => entity.id === params.preferredTargetId)
    : undefined;

  const escaping = enemies.filter((entity) => isTargetEscaping(entity, params.battleState));
  const weak = enemies
    .slice()
    .sort((left, right) => (left.currentHp / Math.max(1, left.maxHp)) - (right.currentHp / Math.max(1, right.maxHp)));

  return escaping[0] ?? preferred ?? weak[0] ?? enemies[0];
}

export function createAiMoveCommand(
  actor: ArenaCombatEntity,
  target: ArenaCombatEntity,
  battleState: ArenaBattleState,
): CombatCommand | undefined {
  const maxWalk = 3;
  const reachable = getReachableBattlefieldTiles(battleState, actor.id, maxWalk);
  if (reachable.length === 0) {
    return undefined;
  }

  const fromX = actor.battlefieldX ?? 0;
  const fromY = actor.battlefieldY ?? 0;
  const currentDistance = Math.abs(fromX - (target.battlefieldX ?? 0)) + Math.abs(fromY - (target.battlefieldY ?? 0));

  const best = reachable
    .filter((cell) => !(cell.x === fromX && cell.y === fromY))
    .slice()
    .sort((left, right) => {
      const leftDistance = Math.abs(left.x - (target.battlefieldX ?? 0)) + Math.abs(left.y - (target.battlefieldY ?? 0));
      const rightDistance = Math.abs(right.x - (target.battlefieldX ?? 0)) + Math.abs(right.y - (target.battlefieldY ?? 0));
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      return left.distance - right.distance;
    })[0];

  if (!best) {
    return undefined;
  }

  const bestDistance = Math.abs(best.x - (target.battlefieldX ?? 0)) + Math.abs(best.y - (target.battlefieldY ?? 0));
  if (bestDistance >= currentDistance && currentDistance <= Math.max(1, Math.floor(actor.attackRange ?? 1))) {
    return undefined;
  }

  const moveType = best.distance > 1 ? 'dash' : 'move';

  return createCombatCommandFromType({
    type: moveType,
    target: { kind: 'cell', x: best.x, y: best.y },
    payload: { movementType: moveType === 'dash' ? 'dash' : 'walk' },
  });
}

export function createAiBasicAttackCommand(target: ArenaCombatEntity): CombatCommand {
  return createCombatCommandFromType({
    type: 'basic_attack',
    target: { kind: 'entity', entityId: target.id },
  });
}

export function createAiSkillCastCommand(params: {
  skillId: string;
  target: CombatTarget;
}): CombatCommand {
  return createCombatCommandFromType({
    type: 'skill_cast',
    target: params.target,
    payload: {
      skillId: params.skillId,
    },
  });
}

export function createAiItemUseCommand(itemId: string, target: CombatTarget): CombatCommand {
  return createCombatCommandFromType({
    type: 'item_use',
    target,
    payload: { itemId },
  });
}

export function createAiWeaponSwapCommand(weaponItemId: string): CombatCommand {
  return createCombatCommandFromType({
    type: 'weapon_swap',
    target: { kind: 'self' },
    payload: { weaponItemId },
  });
}

export function createAiGuardCommand(): CombatCommand {
  return createCombatCommandFromType({
    type: 'guard',
    target: { kind: 'self' },
  });
}

export function createAiStrongGuardCommand(): CombatCommand {
  return createCombatCommandFromType({
    type: 'strong_guard',
    target: { kind: 'self' },
  });
}

export function createAiWaitCommand(): CombatCommand {
  return createCombatCommandFromType({
    type: 'wait',
    target: { kind: 'self' },
  });
}

function tryUseHealing(context: PlannerContext): boolean {
  const hpRatio = context.actor.currentHp / Math.max(1, context.actor.maxHp);
  if (hpRatio > 0.55 || isAtPlanCapacity(context)) {
    return false;
  }

  const healSkill = getHealingSkill(context);
  if (healSkill) {
    const command = createAiSkillCastCommand({
      skillId: healSkill.id,
      target: { kind: 'self' },
    });
    if (tryAppend(context, command)) {
      context.debug.log?.push(`heal via skill ${healSkill.id}`);
      return true;
    }
  }

  return false;
}

function tryUseAreaSkill(context: PlannerContext, target: ArenaCombatEntity): boolean {
  const areaSkill = getAreaSkill(context);
  if (!areaSkill) {
    return false;
  }

  const center = {
    x: target.battlefieldX ?? 0,
    y: target.battlefieldY ?? 0,
  };

  const areaTargets = collectAreaEffectTargets({
    battleState: context.battleState,
    originCell: center,
    radius: Math.max(1, areaSkill.areaRadius ?? 1),
    casterId: context.actor.id,
    shape: 'circle',
  });

  const friendlyFireRisk = areaTargets.some((entry) => entry.relationToCaster === 'ally' || entry.relationToCaster === 'self');
  if (friendlyFireRisk && !canIgnoreFriendlyFire(context.personality)) {
    context.debug.rejectedActions?.push({ action: `area_skill:${areaSkill.id}`, reason: 'FRIENDLY_FIRE_RISK' });
    return false;
  }

  const command = createAiSkillCastCommand({
    skillId: areaSkill.id,
    target: { kind: 'cell', x: center.x, y: center.y },
  });

  return tryAppend(context, command);
}

function tryUseSingleTargetSkill(context: PlannerContext, target: ArenaCombatEntity, currentDistance?: number): boolean {
  const attackSkill = getSingleTargetSkill(context, target, currentDistance);
  if (!attackSkill) {
    return false;
  }

  const distance = typeof currentDistance === 'number' ? currentDistance : getBattlefieldDistance(context.actor, target);
  const skillRange = Math.max(1, Math.floor(attackSkill.range ?? Math.max(1, context.actor.attackRange ?? 1)));
  if (distance > skillRange) {
    context.debug.rejectedActions?.push({ action: `skill:${attackSkill.id}`, reason: 'TARGET_OUT_OF_RANGE' });
    return false;
  }

  const command = createAiSkillCastCommand({
    skillId: attackSkill.id,
    target: { kind: 'entity', entityId: target.id },
  });

  return tryAppend(context, command);
}

function getHealingSkill(context: PlannerContext): DynamicAiSkill | undefined {
  const skills = listActorSkills(context.actor)
    .filter((skill) => skill.isHealing)
    .filter((skill) => canUseSkillByCooldown(skill.id, context.skillCooldowns))
    .filter((skill) => hasResourcesForSkill(skill, context.actor));
  return skills[0];
}

function getAreaSkill(context: PlannerContext): DynamicAiSkill | undefined {
  const skills = listActorSkills(context.actor)
    .filter((skill) => (skill.target ?? 'entity') === 'cell')
    .filter((skill) => canUseSkillByCooldown(skill.id, context.skillCooldowns))
    .filter((skill) => hasResourcesForSkill(skill, context.actor));
  return skills[0];
}

function getSingleTargetSkill(context: PlannerContext, target: ArenaCombatEntity, currentDistance?: number): DynamicAiSkill | undefined {
  const distance = typeof currentDistance === 'number'
    ? currentDistance
    : getBattlefieldDistance(context.actor, target);
  const skills = listActorSkills(context.actor)
    .filter((skill) => (skill.target ?? 'entity') === 'entity')
    .filter((skill) => canUseSkillByCooldown(skill.id, context.skillCooldowns))
    .filter((skill) => hasResourcesForSkill(skill, context.actor))
    .filter((skill) => {
      const range = Math.max(1, Math.floor(skill.range ?? Math.max(1, context.actor.attackRange ?? 1)));
      return distance <= range;
    });
  return skills[0];
}

function getCellDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function hasResourcesForSkill(skill: DynamicAiSkill, actor: ArenaCombatEntity): boolean {
  const mpCost = Math.max(0, Math.floor(skill.mpCost ?? 0));
  const staminaCost = Math.max(0, Math.floor(skill.staminaCost ?? 0));
  const hpCost = Math.max(0, Math.floor(skill.hpCost ?? 0));

  if (actor.currentMp < mpCost) {
    return false;
  }
  if (actor.currentStamina < staminaCost) {
    return false;
  }
  if (hpCost >= actor.currentHp) {
    return false;
  }

  return true;
}

function canUseSkillByCooldown(skillId: string, cooldowns: SkillCooldownEntry[]): boolean {
  const cooldown = cooldowns.find((entry) => entry.skillId === skillId);
  return !cooldown || cooldown.remainingRounds <= 0;
}

function listActorSkills(actor: ArenaCombatEntity): DynamicAiSkill[] {
  const fromActor = (actor as { aiSkills?: unknown }).aiSkills;
  if (Array.isArray(fromActor)) {
    const parsed = fromActor
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const row = entry as Record<string, unknown>;
        const id = typeof row.id === 'string' ? row.id.trim() : '';
        if (!id) {
          return null;
        }

        const targetRaw = typeof row.target === 'string' ? row.target : undefined;
        const normalizedTarget = targetRaw === 'self' || targetRaw === 'entity' || targetRaw === 'cell'
          ? targetRaw
          : undefined;

        return {
          id,
          target: normalizedTarget,
          mpCost: toSafeNumber(row.mpCost),
          staminaCost: toSafeNumber(row.staminaCost),
          hpCost: toSafeNumber(row.hpCost),
          range: toSafeNumber(row.range),
          areaRadius: toSafeNumber(row.areaRadius),
          isHealing: Boolean(row.isHealing),
        } satisfies DynamicAiSkill;
      })
      .filter((skill): skill is NonNullable<typeof skill> => skill !== null);

    if (parsed.length > 0) {
      return parsed;
    }
  }

  return [];
}

function appendDefensiveFallback(context: PlannerContext): void {
  if (isAtPlanCapacity(context)) {
    return;
  }

  if (shouldUseStrongGuard(context) && tryAppend(context, createAiStrongGuardCommand())) {
    context.debug.intent = context.debug.intent ?? 'guard';
    return;
  }

  if (tryAppend(context, createAiGuardCommand())) {
    context.debug.intent = context.debug.intent ?? 'guard';
    return;
  }

  tryAppend(context, createAiWaitCommand());
  context.debug.intent = context.debug.intent ?? 'wait';
}

function tryAppend(context: PlannerContext, command: CombatCommand): boolean {
  if (isAtPlanCapacity(context)) {
    context.debug.rejectedActions?.push({ action: command.type, reason: 'NOT_ENOUGH_AP' });
    return false;
  }

  const appendValidation = canAppendCombatCommand({
    actor: context.actor,
    currentCommands: context.commands,
    nextCommand: command,
    battleState: context.battleState,
    limits: context.limits,
  });

  if (!appendValidation.ok) {
    context.debug.rejectedActions?.push({
      action: command.type,
      reason: appendValidation.errors[0] ?? 'UNKNOWN',
    });
    return false;
  }

  context.commands.push(command);
  return true;
}

function finalizePlan(context: PlannerContext): BuildAiCombatPlanResult {
  const plan: CombatTurnPlan = {
    battleId: context.battleState.combatId,
    roundNumber: context.battleState.roundNumber,
    actorId: context.actor.id,
    commands: context.commands,
    ready: true,
    submittedAt: new Date().toISOString(),
  };

  const validation = validateCombatTurnPlan({
    plan,
    actor: context.actor,
    battleState: context.battleState,
    limits: context.limits,
  });

  if (!validation.ok) {
    context.debug.rejectedActions?.push({
      action: 'final_plan',
      reason: validation.errors[0] ?? 'UNKNOWN',
    });

    const fallback = fallbackWaitOrGuardPlan(context.battleState, context.actor.id, context.actor);
    return {
      plan: fallback,
      debug: context.debug,
    };
  }

  if (!context.debug.intent) {
    context.debug.intent = context.commands.some((command) => command.type === 'basic_attack')
      ? 'attack'
      : context.commands.some((command) => command.type === 'move')
        ? 'move_to_range'
        : context.commands.some((command) => command.type === 'skill_cast')
          ? 'use_skill'
          : context.commands.some((command) => command.type === 'item_use')
            ? 'heal_self'
            : context.commands.some((command) => command.type === 'strong_guard' || command.type === 'guard')
              ? 'guard'
              : 'wait';
  }

  return {
    plan,
    debug: context.debug,
  };
}

function fallbackWaitOrGuardPlan(
  battleState: ArenaBattleState,
  actorId: string,
  actor?: ArenaCombatEntity,
): CombatTurnPlan {
  const guardStaminaCost = COMBAT_ACTION_COSTS.guard.stamina ?? 15;
  const flags = actor as {
    isStunned?: boolean;
    isKnockedDown?: boolean;
    isIncapacitated?: boolean;
    isFeared?: boolean;
    isSleeping?: boolean;
  } | undefined;
  const canGuard = Boolean(actor)
    && (actor?.currentStamina ?? 0) >= guardStaminaCost
    && !flags?.isStunned
    && !flags?.isKnockedDown
    && !flags?.isIncapacitated
    && !flags?.isFeared
    && !flags?.isSleeping;
  return {
    battleId: battleState.combatId,
    roundNumber: battleState.roundNumber,
    actorId,
    commands: [canGuard ? createAiGuardCommand() : createAiWaitCommand()],
    ready: true,
    submittedAt: new Date().toISOString(),
  };
}

function isTargetEscaping(target: ArenaCombatEntity, state: ArenaBattleState): boolean {
  return Boolean(state.escapeStates?.[target.id]?.active);
}

function shouldUseStrongGuard(context: PlannerContext): boolean {
  const hpRatio = context.actor.currentHp / Math.max(1, context.actor.maxHp);
  return hpRatio <= 0.35;
}

function isAtPlanCapacity(context: PlannerContext): boolean {
  if (context.commands.length >= context.limits.maxCommands) {
    return true;
  }

  const totalAp = context.commands.reduce((sum, command) => sum + Math.max(0, command.apCost), 0);
  return totalAp >= context.limits.maxAP;
}

function canIgnoreFriendlyFire(personality: AiCombatPersonality): boolean {
  return personality === 'reckless' || personality === 'stupid' || personality === 'traitor';
}

function inferPersonality(actor: ArenaCombatEntity): AiCombatPersonality {
  const dynamic = actor as { aiPersonality?: unknown; isBoss?: unknown; powerTier?: unknown };
  if (dynamic.isBoss === true || String(dynamic.powerTier ?? '').toLowerCase() === 'boss') {
    return 'boss';
  }

  const raw = String(dynamic.aiPersonality ?? '').trim().toLowerCase();
  if (raw === 'normal' || raw === 'cautious' || raw === 'aggressive' || raw === 'reckless' || raw === 'stupid' || raw === 'traitor' || raw === 'boss') {
    return raw;
  }

  return DEFAULT_PERSONALITY;
}

export function getAiRoundLimits(params: {
  actor: ArenaCombatEntity;
  personality?: AiCombatPersonality;
}): CombatRoundLimits {
  const personality = params.personality ?? inferPersonality(params.actor);
  if (personality === 'boss') {
    return {
      maxCommands: HARD_MAX_COMMANDS_PER_ROUND,
      maxAP: HARD_MAX_AP_PER_ROUND,
    };
  }

  return {
    maxCommands: DEFAULT_MAX_COMMANDS_PER_ROUND,
    maxAP: DEFAULT_MAX_AP_PER_ROUND,
  };
}

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  return 0;
}
