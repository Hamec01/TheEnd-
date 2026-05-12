import type { ActiveCombatStatus, ArenaCombatEntity } from './arena-battle';
import {
  type CombatRuntimeItemEffect,
  effectNumericFlat,
  effectNumericPercent,
  isPassiveEquipmentTrigger,
} from './combat-item-effect';
import {
  canonicalCombatStatusId,
  getCombatStatusDefinition,
  type CombatStatusDefinition,
} from './combat-status-registry';
import { syncControlFlagsFromActiveStatuses } from './combat-status-sync';
import type { DamageCategory, ElementType } from './damage';

export type { ActiveCombatStatus } from './arena-battle';

export type CombatStatusApplyOutcome = 'applied' | 'immune' | 'resisted' | 'missed_chance' | 'skipped';

export interface TryApplyCombatStatusResult {
  outcome: CombatStatusApplyOutcome;
  canonicalStatusId: string | null;
  /** Шанс из эффекта (0–100). */
  baseChancePercent: number;
  /** После сопротивлений (0–100). */
  finalChancePercent: number;
  /** Сколько ходов наложено (если applied). */
  durationApplied?: number;
  messageRu?: string;
}

export interface StatusResistanceImmunityProfile {
  /** Нормализованные ключи иммунитета (канонические + сырой id). */
  immunityKeys: Set<string>;
  /** Суммарный процент сопротивления по каноническому id (кап 90). */
  resistancePercentByCanonical: Map<string, number>;
}

function statusMatchKeys(canonicalId: string, rawId: string | undefined): string[] {
  const keys = new Set<string>();
  keys.add(canonicalId.toLowerCase());
  if (rawId) {
    keys.add(rawId.trim().toLowerCase());
  }
  const def = getCombatStatusDefinition(canonicalId);
  if (def) {
    keys.add(def.id.toLowerCase());
    for (const a of def.aliases) {
      keys.add(a.toLowerCase());
    }
  }
  return [...keys];
}

/**
 * Собирает иммунитеты и сопротивления из пассивных (always) эффектов экипировки/бафов.
 */
export function buildStatusResistanceImmunityProfile(effects: readonly CombatRuntimeItemEffect[]): StatusResistanceImmunityProfile {
  const immunityKeys = new Set<string>();
  const resistancePercentByCanonical = new Map<string, number>();

  for (const e of effects) {
    if (!e || !isPassiveEquipmentTrigger(e.trigger)) {
      continue;
    }
    if (e.type === 'status_immunity') {
      const sid = e.statusId?.trim();
      if (!sid) {
        continue;
      }
      const canon = canonicalCombatStatusId(sid) ?? sid;
      for (const k of statusMatchKeys(canon, sid)) {
        immunityKeys.add(k);
      }
    }
    if (e.type === 'status_resistance') {
      const sid = e.statusId?.trim();
      if (!sid) {
        continue;
      }
      const pct = Math.max(0, effectNumericPercent(e) + effectNumericFlat(e));
      const canon = canonicalCombatStatusId(sid) ?? sid;
      const prev = resistancePercentByCanonical.get(canon) ?? 0;
      resistancePercentByCanonical.set(canon, Math.min(90, prev + pct));
    }
  }

  return { immunityKeys, resistancePercentByCanonical };
}

function isImmuneToStatus(profile: StatusResistanceImmunityProfile, canonicalId: string, rawId?: string): boolean {
  for (const k of statusMatchKeys(canonicalId, rawId)) {
    if (profile.immunityKeys.has(k)) {
      return true;
    }
  }
  return false;
}

function getResistancePercent(profile: StatusResistanceImmunityProfile, canonicalId: string): number {
  return profile.resistancePercentByCanonical.get(canonicalId) ?? 0;
}

/**
 * Формула: finalChance = baseChance * (1 - resistance/100), кламп 0..100.
 */
export function applyStatusResistanceToChance(baseChancePercent: number, resistancePercent: number): number {
  const b = Math.max(0, Math.min(100, baseChancePercent));
  const r = Math.max(0, Math.min(90, resistancePercent));
  return Math.max(0, Math.min(100, Math.round((b * (100 - r)) / 100)));
}

function readTickOverride(effect: CombatRuntimeItemEffect): { flat: number; category: DamageCategory } | undefined {
  const data = effect.data;
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const tick = data.tickDamage;
  const cat = data.damageCategory;
  if (typeof tick !== 'number' || !Number.isFinite(tick) || tick <= 0) {
    return undefined;
  }
  if (typeof cat !== 'string' || !cat.trim()) {
    return undefined;
  }
  return { flat: Math.floor(tick), category: cat as DamageCategory };
}

function resolveDurationTurns(effect: CombatRuntimeItemEffect, def: CombatStatusDefinition | undefined): number {
  if (typeof effect.durationTurns === 'number' && Number.isFinite(effect.durationTurns)) {
    return Math.max(0, Math.floor(effect.durationTurns));
  }
  if (def) {
    return Math.max(1, def.defaultDurationTurns);
  }
  return 1;
}

/**
 * Длительность: уменьшается один раз за полный цикл resolve (конец раунда после всех шагов).
 * Пока remainingTurns > 0, контрольные флаги (stun и т.д.) активны.
 */
export function tryApplyCombatStatus(params: {
  effect: CombatRuntimeItemEffect;
  target: ArenaCombatEntity;
  targetDefenseProfile: StatusResistanceImmunityProfile;
  sourceActorId?: string;
  sourceItemId?: string;
  sourceAbilityId?: string;
  rng: () => number;
  /** Если false — не бросать кубик (уже промах по атаке и т.д.). */
  rollChance: boolean;
}): TryApplyCombatStatusResult {
  const rawId = params.effect.statusId?.trim();
  if (!rawId) {
    return {
      outcome: 'skipped',
      canonicalStatusId: null,
      baseChancePercent: 0,
      finalChancePercent: 0,
      messageRu: 'Эффект наложения статуса без statusId пропущен.',
    };
  }

  const canonical = canonicalCombatStatusId(rawId) ?? rawId;
  const def = getCombatStatusDefinition(canonical);
  const storedId = def?.id ?? canonical;

  if (isImmuneToStatus(params.targetDefenseProfile, storedId, rawId)) {
    const label = def?.labelRu ?? rawId;
    return {
      outcome: 'immune',
      canonicalStatusId: storedId,
      baseChancePercent: Math.max(0, Math.min(100, params.effect.chancePercent ?? 100)),
      finalChancePercent: 0,
      messageRu: `${params.target.name} невосприимчив к эффекту: ${label}.`,
    };
  }

  const baseChance = Math.max(0, Math.min(100, params.effect.chancePercent ?? 100));
  const resist = getResistancePercent(params.targetDefenseProfile, storedId);
  const finalChance = applyStatusResistanceToChance(baseChance, resist);

  if (params.rollChance && finalChance <= 0) {
    const label = def?.labelRu ?? rawId;
    if (baseChance <= 0) {
      return {
        outcome: 'missed_chance',
        canonicalStatusId: storedId,
        baseChancePercent: baseChance,
        finalChancePercent: finalChance,
        messageRu: `${label}: шанс 0%, эффект не сработал.`,
      };
    }
    return {
      outcome: 'resisted',
      canonicalStatusId: storedId,
      baseChancePercent: baseChance,
      finalChancePercent: finalChance,
      messageRu: `${params.target.name} сопротивляется эффекту: ${label}.`,
    };
  }

  if (params.rollChance) {
    const roll = params.rng() * 100;
    if (roll > finalChance) {
      const label = def?.labelRu ?? rawId;
      return {
        outcome: 'missed_chance',
        canonicalStatusId: storedId,
        baseChancePercent: baseChance,
        finalChancePercent: finalChance,
        messageRu: `${label} не сработал против ${params.target.name} (${finalChance}% шанс).`,
      };
    }
  }

  const duration = resolveDurationTurns(params.effect, def);
  if (duration <= 0) {
    return {
      outcome: 'skipped',
      canonicalStatusId: storedId,
      baseChancePercent: baseChance,
      finalChancePercent: finalChance,
    };
  }

  const tickOverride = params.effect.type === 'apply_status' ? readTickOverride(params.effect) : undefined;

  upsertActiveStatus(params.target, {
    id: storedId,
    rawStatusId: rawId,
    remainingTurns: duration,
    sourceActorId: params.sourceActorId,
    sourceItemId: params.sourceItemId,
    sourceAbilityId: params.sourceAbilityId,
    stackMode: def?.stackMode ?? 'refresh',
    tickFlatOverride: tickOverride?.flat,
    tickCategoryOverride: tickOverride?.category,
  });

  const label = def?.labelRu ?? rawId;
  const msg = statusAppliedMessageRu(storedId, params.target.name, label);

  return {
    outcome: 'applied',
    canonicalStatusId: storedId,
    baseChancePercent: baseChance,
    finalChancePercent: finalChance,
    durationApplied: duration,
    messageRu: msg,
  };
}

function statusAppliedMessageRu(canonicalId: string, targetName: string, labelRu: string): string {
  switch (canonicalId) {
    case 'stunned':
      return `${targetName} оглушён.`;
    case 'poisoned':
      return `${targetName} отравлен.`;
    case 'bleeding':
      return `У ${targetName} началось кровотечение.`;
    case 'burning':
      return `${targetName} горит.`;
    case 'blinded':
      return `${targetName} ослеплён.`;
    case 'silenced':
      return `${targetName} не может произносить заклинания.`;
    case 'frozen':
      return `${targetName} заморожен.`;
    case 'slowed':
      return `${targetName} замедлен.`;
    case 'cursed':
      return `${targetName} проклят.`;
    case 'knockdown':
      return `${targetName} сбит с ног.`;
    default:
      return `${targetName} получает эффект: ${labelRu}.`;
  }
}

function upsertActiveStatus(
  target: ArenaCombatEntity,
  params: {
    id: string;
    rawStatusId: string;
    remainingTurns: number;
    sourceActorId?: string;
    sourceItemId?: string;
    sourceAbilityId?: string;
    stackMode: 'refresh' | 'stack';
    tickFlatOverride?: number;
    tickCategoryOverride?: DamageCategory;
  },
): void {
  if (!target.activeCombatStatuses) {
    target.activeCombatStatuses = [];
  }
  const list = target.activeCombatStatuses;
  const idx = list.findIndex((s) => s.id === params.id);
  if (idx < 0) {
    list.push({
      id: params.id,
      rawStatusId: params.rawStatusId,
      remainingTurns: params.remainingTurns,
      sourceActorId: params.sourceActorId,
      sourceItemId: params.sourceItemId,
      sourceAbilityId: params.sourceAbilityId,
      tickDamageFlatOverride: params.tickFlatOverride,
      tickDamageCategoryOverride: params.tickCategoryOverride,
    });
    return;
  }
  const cur = list[idx]!;
  if (params.stackMode === 'stack') {
    cur.stacks = Math.max(1, (cur.stacks ?? 1) + 1);
    cur.remainingTurns = Math.max(cur.remainingTurns, params.remainingTurns);
  } else {
    cur.remainingTurns = Math.max(cur.remainingTurns, params.remainingTurns);
  }
  cur.sourceActorId = params.sourceActorId ?? cur.sourceActorId;
  cur.sourceItemId = params.sourceItemId ?? cur.sourceItemId;
  cur.sourceAbilityId = params.sourceAbilityId ?? cur.sourceAbilityId;
  if (params.tickFlatOverride !== undefined) {
    cur.tickDamageFlatOverride = params.tickFlatOverride;
  }
  if (params.tickCategoryOverride !== undefined) {
    cur.tickDamageCategoryOverride = params.tickCategoryOverride;
  }
}

/**
 * Суммарная правка шанса попадания атакующего (ослепление и реестр).
 */
export function getAttackerHitChanceDeltaFromStatuses(entity: ArenaCombatEntity): number {
  const list = entity.activeCombatStatuses;
  if (!list) {
    return 0;
  }
  let delta = 0;
  for (const s of list) {
    if (s.remainingTurns <= 0) {
      continue;
    }
    const def = getCombatStatusDefinition(s.id);
    if (def) {
      delta += def.attackerHitChanceDeltaPercent;
    }
  }
  return delta;
}

export interface PeriodicStatusDamageTick {
  entityId: string;
  entityName: string;
  statusId: string;
  amount: number;
  damageCategory: DamageCategory;
  elementType?: ElementType;
  messageRu: string;
}

/**
 * Урон от DoT-статусов в фазе раунда (turn_start — яд/огонь; turn_end — кровь).
 */
export function collectPeriodicStatusDamage(
  entities: readonly ArenaCombatEntity[],
  phase: 'turn_start' | 'turn_end',
): PeriodicStatusDamageTick[] {
  const out: PeriodicStatusDamageTick[] = [];
  for (const entity of entities) {
    if (!entity.isAlive) {
      continue;
    }
    const list = entity.activeCombatStatuses;
    if (!list) {
      continue;
    }
    for (const s of list) {
      if (s.remainingTurns <= 0) {
        continue;
      }
      const def = getCombatStatusDefinition(s.id);
      const periodic = def?.periodicDamage;

      if (
        typeof s.tickDamageFlatOverride === 'number'
        && s.tickDamageFlatOverride > 0
        && s.tickDamageCategoryOverride
      ) {
        if (phase === 'turn_start') {
          const label = def?.labelRu ?? s.id;
          out.push({
            entityId: entity.id,
            entityName: entity.name,
            statusId: s.id,
            amount: s.tickDamageFlatOverride,
            damageCategory: s.tickDamageCategoryOverride,
            messageRu: `${entity.name} получает ${s.tickDamageFlatOverride} урона от «${label}».`,
          });
        }
        continue;
      }

      if (!periodic || periodic.phase !== phase) {
        continue;
      }

      const flat = periodic.amountFlat;
      if (flat <= 0) {
        continue;
      }
      const label = def?.labelRu ?? s.id;
      out.push({
        entityId: entity.id,
        entityName: entity.name,
        statusId: s.id,
        amount: flat,
        damageCategory: periodic.damageCategory,
        elementType: periodic.elementType,
        messageRu: `${entity.name} получает ${flat} урона от «${label}».`,
      });
    }
  }
  return out;
}

export interface StatusExpiredInfo {
  entityId: string;
  entityName: string;
  statusId: string;
  labelRu?: string;
}

/**
 * Уменьшает remainingTurns на 1 в конце полного цикла resolve раунда (после всех шагов команд).
 */
export function tickCombatStatusDurationsEndOfRound(entities: readonly ArenaCombatEntity[]): StatusExpiredInfo[] {
  const removed: StatusExpiredInfo[] = [];
  for (const entity of entities) {
    const list = entity.activeCombatStatuses;
    if (!list || list.length === 0) {
      continue;
    }
    const next: ActiveCombatStatus[] = [];
    for (const s of list) {
      if (s.remainingTurns <= 0) {
        continue;
      }
      const left = s.remainingTurns - 1;
      if (left <= 0) {
        const def = getCombatStatusDefinition(s.id);
        removed.push({
          entityId: entity.id,
          entityName: entity.name,
          statusId: s.id,
          labelRu: def?.labelRu,
        });
        continue;
      }
      next.push({ ...s, remainingTurns: left });
    }
    entity.activeCombatStatuses = next;
  }
  return removed;
}

/** @deprecated Используйте syncControlFlagsFromActiveStatuses из combat-status-sync. */
export function syncArenaEntityControlFlagsFromStatuses(entity: ArenaCombatEntity): void {
  syncControlFlagsFromActiveStatuses(entity);
}
