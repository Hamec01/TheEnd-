import type { ArenaBattleState, CombatAnimationEvent, CombatEvent } from '@theend/rpg-domain';

export type BattlePlaybackPhase = {
  id: string;
  kind:
    | 'movement'
    | 'melee'
    | 'projectile'
    | 'damage'
    | 'status'
    | 'death'
    | 'loot'
    | 'log';
  events: CombatAnimationEvent[];
  durationMs: number;
  mode: 'parallel' | 'sequential';
  stepIndex?: number;
  orderIndex?: number;
  actorIds: string[];
};

type BuildBattlePlaybackTimelineParams = {
  combatEvents: CombatEvent[];
  recentAnimationEvents?: CombatAnimationEvent[] | null;
  previousBattleState: ArenaBattleState;
  finalBattleState: ArenaBattleState;
};

const IS_DEV = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

const PHASE_ORDER: Record<BattlePlaybackPhase['kind'], number> = {
  movement: 0,
  melee: 1,
  projectile: 2,
  damage: 3,
  status: 4,
  death: 5,
  loot: 6,
  log: 7,
};

function eventIdentity(event: CombatAnimationEvent): string {
  if (event.id) {
    return event.id;
  }
  return `${event.type}:${event.actorId ?? ''}:${event.targetId ?? ''}:${event.stepIndex}:${event.from?.x ?? ''}:${event.from?.y ?? ''}:${event.to?.x ?? ''}:${event.to?.y ?? ''}:${event.value ?? ''}`;
}
function eventSemanticIdentity(event: CombatAnimationEvent): string {
  return `${event.type}:${event.roundNumber}:${event.stepIndex}:${event.actorId ?? ''}:${event.targetId ?? ''}:${event.from?.x ?? ''}:${event.from?.y ?? ''}:${event.to?.x ?? ''}:${event.to?.y ?? ''}:${event.value ?? event.damage ?? ''}`;
}

export function getMovementTweenDurationMs(event: Pick<CombatAnimationEvent, 'from' | 'to' | 'movementType'>): number {
  const from = event.from;
  const to = event.to;
  const cells = from && to
    ? Math.max(1, Math.abs(to.x - from.x) + Math.abs(to.y - from.y))
    : 1;

  if (event.movementType === 'dash') {
    return Math.max(450, Math.min(850, 450 + Math.max(0, cells - 2) * 100));
  }
  if (event.movementType === 'disengage') {
    return Math.max(350, Math.min(700, 350 + Math.max(0, cells - 1) * 80));
  }
  return Math.max(350, Math.min(850, 350 + Math.max(0, cells - 1) * 90));
}

function inferPhaseKind(event: CombatAnimationEvent): BattlePlaybackPhase['kind'] {
  switch (event.type) {
    case 'move_token':
      return 'movement';
    case 'attack_bump':
    case 'skill_cast':
      return 'melee';
    case 'projectile':
      return 'projectile';
    case 'damage_number':
    case 'heal_number':
    case 'impact':
    case 'critical_hit':
    case 'miss':
    case 'block':
    case 'dodge':
      return 'damage';
    case 'status_applied':
    case 'status_tick':
    case 'block_flash':
    case 'dodge_step':
      return 'status';
    case 'death_fade':
      return 'death';
    case 'loot_spawn':
      return 'loot';
    default:
      return 'log';
  }
}

function inferPhaseMode(kind: BattlePlaybackPhase['kind']): BattlePlaybackPhase['mode'] {
  return kind === 'log' ? 'sequential' : 'parallel';
}

function inferPhaseDuration(kind: BattlePlaybackPhase['kind'], events: CombatAnimationEvent[]): number {
  switch (kind) {
    case 'movement':
      return events.reduce((max, event) => Math.max(max, getMovementTweenDurationMs(event)), 350);
    case 'melee':
      return 300;
    case 'projectile':
      return 520;
    case 'damage':
      return 520;
    case 'status':
      return 500;
    case 'death':
      return 620;
    case 'loot':
      return 520;
    case 'log':
    default:
      return 120;
  }
}

function pushUniqueAnimation(target: CombatAnimationEvent[], seen: Set<string>, event: CombatAnimationEvent) {
  const key = eventSemanticIdentity(event);
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  target.push(event);
}

function buildSynthesizedAnimationEvents(params: BuildBattlePlaybackTimelineParams): CombatAnimationEvent[] {
  const synthesized: CombatAnimationEvent[] = [];
  const seen = new Set<string>((params.recentAnimationEvents ?? []).map(eventSemanticIdentity));

  for (const event of params.combatEvents) {
    if (event.type === 'movement') {
      const data = (event.data ?? {}) as Record<string, unknown>;
      const from = typeof data.from === 'object' && data.from ? data.from as { x: number; y: number } : null;
      const to = typeof data.to === 'object' && data.to ? data.to as { x: number; y: number } : null;
      if (event.actorId && from && to) {
        pushUniqueAnimation(synthesized, seen, {
          id: `timeline_move_${event.id}`,
          roundNumber: event.roundNumber,
          stepIndex: event.stepIndex,
          type: 'move_token',
          actorId: event.actorId,
          from,
          to,
          movementType: typeof data.movementType === 'string'
            ? data.movementType as 'walk' | 'dash' | 'disengage'
            : undefined,
        });
      }
    }

    if (event.type === 'attack' && event.actorId) {
      pushUniqueAnimation(synthesized, seen, {
        id: `timeline_attack_${event.id}`,
        roundNumber: event.roundNumber,
        stepIndex: event.stepIndex,
        type: 'attack_bump',
        actorId: event.actorId,
        targetId: event.targetId,
      });
    }

    if (event.type === 'damage' && event.actorId) {
      const amount = typeof event.data?.amount === 'number' ? event.data.amount : undefined;
      pushUniqueAnimation(synthesized, seen, {
        id: `timeline_damage_${event.id}`,
        roundNumber: event.roundNumber,
        stepIndex: event.stepIndex,
        type: 'damage_number',
        actorId: event.actorId,
        targetId: event.targetId,
        value: amount,
        damage: amount,
      });
    }

    if (event.type === 'battle_finished' && event.targetId) {
      pushUniqueAnimation(synthesized, seen, {
        id: `timeline_death_${event.id}`,
        roundNumber: event.roundNumber,
        stepIndex: event.stepIndex,
        type: 'death_fade',
        targetId: event.targetId,
      });
    }
  }

  return synthesized;
}

function buildMissingMoveAnimations(previousState: ArenaBattleState, finalState: ArenaBattleState, existing: CombatAnimationEvent[]): CombatAnimationEvent[] {
  const existingKeys = new Set(existing.filter((event) => event.type === 'move_token' && event.actorId && event.from && event.to).map((event) => {
    return `${event.actorId}:${event.from!.x}:${event.from!.y}:${event.to!.x}:${event.to!.y}`;
  }));

  const previousById = new Map(previousState.entities.map((entity) => [entity.id, entity]));
  const next: CombatAnimationEvent[] = [];
  for (const entity of finalState.entities) {
    const before = previousById.get(entity.id);
    if (!before) {
      continue;
    }
    const from = { x: before.battlefieldX ?? 0, y: before.battlefieldY ?? 0 };
    const to = { x: entity.battlefieldX ?? 0, y: entity.battlefieldY ?? 0 };
    if (from.x === to.x && from.y === to.y) {
      continue;
    }
    const key = `${entity.id}:${from.x}:${from.y}:${to.x}:${to.y}`;
    if (existingKeys.has(key)) {
      continue;
    }
    next.push({
      id: `timeline_reconcile_${entity.id}_${finalState.roundNumber}`,
      roundNumber: finalState.roundNumber,
      stepIndex: -1,
      type: 'move_token',
      actorId: entity.id,
      from,
      to,
      movementType: 'walk',
    });
  }
  return next;
}

export function buildBattlePlaybackTimeline(params: BuildBattlePlaybackTimelineParams): BattlePlaybackPhase[] {
  const combinedAnimations: CombatAnimationEvent[] = [
    ...(params.recentAnimationEvents ?? []),
    ...buildSynthesizedAnimationEvents(params),
  ];
  combinedAnimations.push(...buildMissingMoveAnimations(params.previousBattleState, params.finalBattleState, combinedAnimations));

  const phaseBuckets = new Map<string, BattlePlaybackPhase>();
  for (const event of combinedAnimations) {
    const kind = inferPhaseKind(event);
    const bucketKey = `${event.roundNumber}:${event.stepIndex}:${kind}`;
    const current = phaseBuckets.get(bucketKey);
    if (current) {
      current.events.push(event);
      if (event.actorId && !current.actorIds.includes(event.actorId)) {
        current.actorIds.push(event.actorId);
      }
      if (event.targetId && !current.actorIds.includes(event.targetId)) {
        current.actorIds.push(event.targetId);
      }
      continue;
    }

    phaseBuckets.set(bucketKey, {
      id: `phase_${bucketKey}`,
      kind,
      events: [event],
      durationMs: 0,
      mode: inferPhaseMode(kind),
      stepIndex: event.stepIndex,
      orderIndex: event.stepIndex,
      actorIds: [event.actorId, event.targetId].filter((value): value is string => Boolean(value)),
    });
  }

  const phases = [...phaseBuckets.values()]
    .map((phase) => ({
      ...phase,
      durationMs: inferPhaseDuration(phase.kind, phase.events),
    }))
    .sort((left, right) => {
      const stepDiff = (left.stepIndex ?? 0) - (right.stepIndex ?? 0);
      if (stepDiff !== 0) {
        return stepDiff;
      }
      return PHASE_ORDER[left.kind] - PHASE_ORDER[right.kind];
    });

  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.debug('[BattlePlaybackTimeline]', phases.map((phase) => ({
      id: phase.id,
      kind: phase.kind,
      count: phase.events.length,
      mode: phase.mode,
      durationMs: phase.durationMs,
      actorIds: phase.actorIds,
    })));
  }

  return phases;
}