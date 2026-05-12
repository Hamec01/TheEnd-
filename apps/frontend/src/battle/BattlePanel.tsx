// BattlePanel.tsx — P0 Sequential Turn-Based Combat UI
// Replaces simultaneous planning model with active-actor turn flow.
import {
  ActionType,
  COMBAT_ACTION_COSTS,
  DistanceBand,
  MovementType,
  TargetZone,
  TeamSide,
  createCombatCommandFromType,
  getBattlefieldDistance,
  getSkillCostSummary,
  isActorStandingOnExitZone,
  type AdminSkillDefinition,
  type ArenaBattleState,
  type ArenaCombatEntity,
  type CombatCommand,
  type Equipment,
  type InventoryState,
  type ItemDefinition,
} from '@theend/rpg-domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  executeCombatAction,
  fetchCombatState,
  type ArenaHubState,
  type CharacterActionSlot,
} from '../api';
import type { AdminItem } from '../services/content/models';
import { ActionPlanner } from './ActionPlanner';
import { BattleField } from './BattleField';
import { CombatLogPanel } from './CombatLogPanel';
import { FighterCard } from './FighterCard';
import { InspectPanel } from './InspectPanel';

// ── Types ─────────────────────────────────────────────────────────────────

interface BattlePanelProps {
  combatId: string;
  playerId: string;
  state: ArenaBattleState;
  inventory: InventoryState;
  actionSlots: CharacterActionSlot[];
  mapImageUrl?: string;
  mapCalibration?: {
    cellSizePx?: number;
    gridOffsetX?: number;
    gridOffsetY?: number;
  };
  selectedSkillId: string | null;
  availableSkills: Array<{ skillId: string; level: number; label: string; definition: AdminSkillDefinition }>;
  onSkillChange: (skillId: string | null) => void;
  onStateChange: (next: ArenaBattleState) => void;
  onStatus: (text: string) => void;
  onUseItem?: (itemId: string, targetId?: string) => Promise<void> | void;
  onBattleFinished?: (next: ArenaBattleState, hubState?: ArenaHubState) => Promise<void> | void;
  onClose?: () => void;
  playerAvatarUrl?: string;
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveAdminItemById?: (itemId: string) => AdminItem | null;
  playerEquipment?: Equipment;
}

/** What the player has currently selected to do next */
type SelectedSource =
  | { kind: 'none' }
  | { kind: 'basic_attack' }
  | { kind: 'heavy_attack' }
  | { kind: 'guard' }
  | { kind: 'strong_guard' }
  | { kind: 'skill'; slotId?: CharacterActionSlot['slotId']; skillId: string }
  | { kind: 'item'; slotId?: CharacterActionSlot['slotId']; itemId: string; itemInstanceId?: string }
  | { kind: 'weapon'; slotId?: CharacterActionSlot['slotId']; weaponItemId: string; weaponInstanceId?: string };

// ── Helpers ───────────────────────────────────────────────────────────────

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toFiniteAmount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function classifyCombatStyle(
  entity: Pick<ArenaCombatEntity, 'strength' | 'dexterity' | 'intelligence' | 'combatStyleHint' | 'attackRange'>,
): 'MELEE' | 'RANGED' | 'MAGIC' {
  if (entity.combatStyleHint) return entity.combatStyleHint;
  if (typeof entity.attackRange === 'number' && entity.attackRange > 1) return 'RANGED';
  if (entity.intelligence >= entity.strength && entity.intelligence >= entity.dexterity) return 'MAGIC';
  if (entity.dexterity > entity.strength) return 'RANGED';
  return 'MELEE';
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatActionError(errorCode: string, message: string): string {
  const map: Record<string, string> = {
    NOT_ENOUGH_AP: 'Недостаточно AP.',
    NOT_ENOUGH_STAMINA: 'Недостаточно выносливости.',
    NOT_ENOUGH_MP: 'Недостаточно маны.',
    NOT_ENOUGH_HP: 'Недостаточно HP.',
    TARGET_OUT_OF_RANGE: 'Цель вне дальности.',
    NOT_ACTIVE_ACTOR: 'Сейчас не ваш ход.',
    BATTLE_FINISHED: 'Бой уже завершён.',
    ROUND_MISMATCH: 'Несоответствие раунда — обновите состояние.',
    COMMAND_REVALIDATION_FAILED: 'Действие не прошло проверку.',
    ACTOR_DEAD: 'Персонаж мёртв.',
  };
  return map[errorCode] ?? message;
}

function isCellTargetItem(item: AdminItem | null): boolean {
  if (!item) return false;
  const raw = toRecord(item as unknown);
  const subtype = String(raw?.itemSubType ?? '').toLowerCase();
  return subtype.includes('bomb') || subtype.includes('trap') || subtype.includes('grenade');
}

function isWeaponAdminItem(item: AdminItem | null): boolean {
  if (!item) return false;
  const raw = toRecord(item as unknown);
  const type = String(raw?.itemType ?? '').toLowerCase();
  const subtype = String(raw?.itemSubType ?? '').toLowerCase();
  return type === 'weapon' || subtype.includes('sword') || subtype.includes('axe') || subtype.includes('bow');
}

function normalizeAdminItemCosts(rawItem: AdminItem | null): { mana: number; stamina: number; hp: number } {
  const costs = { mana: 0, stamina: 0, hp: 0 };
  const raw = toRecord(rawItem as unknown);
  if (!raw) return costs;
  const add = (key: string, val: unknown) => {
    const k = key.toLowerCase();
    const v = toFiniteAmount(val);
    if (v <= 0) return;
    if (k === 'mana' || k === 'mp') costs.mana += v;
    else if (k === 'stamina' || k === 'sta') costs.stamina += v;
    else if (k === 'hp' || k === 'health') costs.hp += v;
  };
  add('mana', raw.manaCost);
  add('stamina', raw.staminaCost);
  add('hp', raw.hpCost);
  const directCosts = Array.isArray(raw.costs) ? raw.costs : [];
  for (const entry of directCosts) {
    const r = toRecord(entry);
    if (r) add(String(r.resource ?? r.type ?? ''), r.amount);
  }
  return costs;
}

function normalizeAdminItemEffects(rawItem: AdminItem | null): Array<{ type: string; amount: number; target?: string }> {
  const raw = toRecord(rawItem as unknown);
  if (!raw) return [];
  const sources: unknown[] = [];
  const single = toRecord(raw.useEffect);
  if (single) sources.push(single);
  if (Array.isArray(raw.effects)) sources.push(...raw.effects);
  if (Array.isArray(raw.combatEffects)) sources.push(...raw.combatEffects);
  return sources
    .map((e) => toRecord(e))
    .filter((e): e is Record<string, unknown> => Boolean(e))
    .map((e) => ({
      type: String(e.type ?? '').trim().toLowerCase(),
      amount: toFiniteAmount(e.amount),
      target: typeof e.target === 'string' ? e.target : undefined,
    }))
    .filter((e) => e.type.length > 0);
}

function parseZoneFromLogText(text: string): TargetZone | null {
  const match = text.match(/in\s+([A-Z_]+)/i);
  const token = match?.[1]?.toUpperCase();
  if (!token) return null;
  if (token === 'HEAD') return TargetZone.Head;
  if (token === 'CHEST') return TargetZone.Chest;
  if (token === 'ABDOMEN') return TargetZone.Abdomen;
  if (token === 'LEFT_ARM') return TargetZone.LeftArm;
  if (token === 'RIGHT_ARM') return TargetZone.RightArm;
  if (token === 'LEGS') return TargetZone.Legs;
  return null;
}

function formatRevalidationReason(reason: string): string {
  const map: Record<string, string> = {
    target_out_of_range: 'цель вне радиуса действия',
    target_too_close: 'цель слишком близко',
    line_of_sight_blocked: 'линия атаки перекрыта',
    cell_blocked: 'клетка заблокирована',
    cell_occupied: 'клетка занята',
    not_enough_stamina: 'недостаточно выносливости',
    not_enough_mp: 'недостаточно маны',
    not_enough_hp: 'недостаточно здоровья',
    actor_dead: 'исполнитель мёртв',
    target_dead: 'цель уже мертва',
    target_missing: 'цель недоступна',
  };
  return map[reason] ?? reason;
}

// ── Component ─────────────────────────────────────────────────────────────

export function BattlePanel({
  combatId,
  playerId,
  state,
  inventory,
  actionSlots,
  mapImageUrl,
  mapCalibration,
  selectedSkillId,
  availableSkills,
  onSkillChange,
  onStateChange,
  onStatus,
  onUseItem,
  onBattleFinished,
  onClose,
  playerAvatarUrl,
  resolveItemById,
  resolveAdminItemById,
  playerEquipment,
}: BattlePanelProps) {
  // ── Core entity refs ────────────────────────────────────────────────────
  const player = useMemo(
    () => state.entities.find((e) => e.id === playerId) ?? null,
    [state.entities, playerId],
  );
  const enemies = useMemo(
    () => state.entities.filter((e) => e.team === TeamSide.Right && e.isAlive),
    [state.entities],
  );

  // ── Sequential turn model ───────────────────────────────────────────────
  const stateWithTurn = state as ArenaBattleState & {
    roundPhase?: string;
    activeActorId?: string;
    currentTurnAp?: Record<string, number>;
    pendingActorIds?: string[];
  };
  const roundPhase = stateWithTurn.roundPhase;
  const isPlayerPending = Boolean((state.pendingActorIds ?? stateWithTurn.pendingActorIds ?? []).includes(playerId));
  const isLegacyPlanningMode =
    !state.isFinished &&
    (isPlayerPending
      || (!stateWithTurn.activeActorId && (state.phase === 'planning' || roundPhase === 'PLANNING')));
  const isPlayerTurn = !state.isFinished && (isPlayerPending || stateWithTurn.activeActorId === playerId || isLegacyPlanningMode);
  const currentTurnAp = isLegacyPlanningMode
    ? Math.max(0, 3 - ((state.submittedPlans?.[playerId]?.commands ?? []).reduce((sum, cmd) => sum + Math.max(0, Number(cmd.apCost ?? 0)), 0)))
    : (stateWithTurn.currentTurnAp?.[playerId] ?? 0);
  const activeActor = useMemo(
    () => (stateWithTurn.activeActorId ? state.entities.find((e) => e.id === stateWithTurn.activeActorId) ?? null : null),
    [stateWithTurn.activeActorId, state.entities],
  );

  // ── Timer ───────────────────────────────────────────────────────────────
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!state.turnDeadlineAt || !isPlayerTurn) return null;
    const deadline = Date.parse(state.turnDeadlineAt);
    if (!Number.isFinite(deadline)) return null;
    return Math.max(0, Math.ceil((deadline - nowMs) / 1000));
  }, [nowMs, state.turnDeadlineAt, isPlayerTurn]);

  // ── UI state ────────────────────────────────────────────────────────────
  const [selectedTargetId, setSelectedTargetId] = useState(() => enemies[0]?.id ?? '');
  const [selectedSource, setSelectedSource] = useState<SelectedSource>({ kind: 'none' });
  const [movementType, setMovementType] = useState<MovementType | null>(null);
  const [selectedMoveTile, setSelectedMoveTile] = useState<{ x: number; y: number } | null>(null);
  const [inspectEntityId, setInspectEntityId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<ActionType>(ActionType.Attack);
  const [guardMode, setGuardMode] = useState<'guard' | 'strong_guard'>('guard');
  const isSubmittingRef = useRef(false);
  const lastFailureEventIdRef = useRef<string | null>(null);

  const legacyPlan = useMemo(
    () => (state.submittedPlans?.[playerId] ?? null),
    [playerId, state.submittedPlans],
  );
  const legacyApSpent = useMemo(
    () => (legacyPlan?.commands ?? []).reduce((sum, cmd) => sum + Math.max(0, Number(cmd.apCost ?? 0)), 0),
    [legacyPlan],
  );
  const legacyApLeft = Math.max(0, 3 - legacyApSpent);

  // ── Derived ─────────────────────────────────────────────────────────────
  const playerStyle = useMemo(() => (player ? classifyCombatStyle(player) : 'MELEE'), [player]);
  const selectedSkill = useMemo(
    () => availableSkills.find((s) => s.skillId === selectedSkillId) ?? null,
    [availableSkills, selectedSkillId],
  );
  const selectedEnemy = useMemo(
    () => enemies.find((e) => e.id === selectedTargetId) ?? enemies[0] ?? null,
    [enemies, selectedTargetId],
  );
  const playerPlacement = useMemo(
    () => state.entities.find((e) => e.id === playerId) ?? null,
    [state.entities, playerId],
  );
  const pendingPlayerPlacement = useMemo(() => {
    if (!playerPlacement) return null;
    return {
      ...playerPlacement,
      battlefieldX: selectedMoveTile?.x ?? playerPlacement.battlefieldX,
      battlefieldY: selectedMoveTile?.y ?? playerPlacement.battlefieldY,
    };
  }, [playerPlacement, selectedMoveTile]);
  const selectedEnemyPlacement = useMemo(
    () => state.entities.find((e) => e.id === selectedTargetId) ?? null,
    [state.entities, selectedTargetId],
  );
  const targetInRange = useMemo(() => {
    if (!pendingPlayerPlacement || !selectedEnemyPlacement) return false;
    const dist = getBattlefieldDistance(pendingPlayerPlacement, selectedEnemyPlacement);
    if (playerStyle === 'MELEE') return dist <= 1;
    const maxRange = typeof player?.attackRange === 'number' && player.attackRange > 1
      ? Math.floor(player.attackRange)
      : playerStyle === 'RANGED' ? 6 : 5;
    return dist <= Math.max(2, maxRange);
  }, [pendingPlayerPlacement, player?.attackRange, playerStyle, selectedEnemyPlacement]);

  const playerEscapeState = useMemo(
    () => state.escapeStates?.[playerId] ?? null,
    [state.escapeStates, playerId],
  );
  const playerOnExitZone = useMemo(
    () => Boolean(isActorStandingOnExitZone({ battleState: state, actorId: playerId }).ok),
    [state, playerId],
  );

  const lastLog = state.logs.at(-1) ?? null;
  const recentLogs = useMemo(() => state.logs.slice(-8), [state.logs]);

  const feedback = useMemo(() => {
    if (!lastLog) {
      return { playerVisualState: 'idle' as const, enemyVisualState: 'idle' as const, floatingText: null as string | null };
    }
    const isActor = lastLog.actorId === playerId;
    const isTarget = lastLog.targetId === playerId;
    if (lastLog.type === 'HIT') {
      const floatingText = /critical/i.test(lastLog.text) ? `CRIT -${lastLog.amount ?? 0}` : `-${lastLog.amount ?? 0}`;
      return {
        playerVisualState: isActor ? 'attack' as const : isTarget ? 'hit' as const : 'idle' as const,
        enemyVisualState: isActor ? 'hit' as const : isTarget ? 'attack' as const : 'idle' as const,
        floatingText,
      };
    }
    if (lastLog.type === 'BLOCK') {
      return {
        playerVisualState: isActor ? 'block' as const : isTarget ? 'attack' as const : 'idle' as const,
        enemyVisualState: isActor ? 'attack' as const : isTarget ? 'block' as const : 'idle' as const,
        floatingText: 'BLOCK',
      };
    }
    if (lastLog.type === 'MISS') {
      return {
        playerVisualState: isActor ? 'attack' as const : isTarget ? 'dodge' as const : 'idle' as const,
        enemyVisualState: isActor ? 'dodge' as const : isTarget ? 'attack' as const : 'idle' as const,
        floatingText: 'DODGE',
      };
    }
    return { playerVisualState: 'idle' as const, enemyVisualState: 'idle' as const, floatingText: null as string | null };
  }, [lastLog, playerId]);

  // Inventory items for hotbar
  const battleInventoryItems = useMemo(() => {
    return actionSlots
      .filter((slot) => slot.kind === 'item' && Boolean(slot.refId))
      .map((slot) => {
        const itemId = slot.refId!;
        const quantity = inventory.items.find((e) => e.itemId === itemId)?.quantity ?? 0;
        const adminItem = resolveAdminItemById ? resolveAdminItemById(itemId) : null;
        const costs = normalizeAdminItemCosts(adminItem);
        const effects = normalizeAdminItemEffects(adminItem);
        const wantsEnemy = effects.some(
          (e) => e.type === 'damage_target' || String(e.target ?? '').toLowerCase().includes('enemy'),
        );
        const costSummary = [
          costs.mana > 0 ? `${costs.mana} MP` : null,
          costs.stamina > 0 ? `${costs.stamina} STA` : null,
          costs.hp > 0 ? `${costs.hp} HP` : null,
        ].filter(Boolean).join(', ') || null;
        const effectSummary = effects.length > 0
          ? effects.map((e) => `${e.type}${e.amount > 0 ? ` ${e.amount}` : ''}`).join(', ')
          : null;
        const notEnoughMana = costs.mana > (player?.currentMp ?? 0);
        const notEnoughStamina = costs.stamina > (player?.currentStamina ?? 0);
        const invalidTarget = wantsEnemy && !enemies.some((e) => e.id === selectedTargetId);
        const disabledReason = quantity <= 0
          ? 'Закончилось.'
          : notEnoughMana ? 'Нет маны.'
          : notEnoughStamina ? 'Нет выносливости.'
          : invalidTarget ? 'Нет цели.'
          : null;
        return {
          id: itemId,
          name: adminItem ? String(toRecord(adminItem as unknown)?.name ?? itemId) : itemId,
          description: adminItem ? String(toRecord(adminItem as unknown)?.description ?? '') : '',
          icon: adminItem ? String(toRecord(adminItem as unknown)?.icon ?? '?') : '?',
          itemType: adminItem ? String(toRecord(adminItem as unknown)?.itemType ?? 'item') : 'item',
          quantity,
          disabled: Boolean(disabledReason),
          disabledReason,
          effectSummary,
          costSummary,
        };
      });
  }, [actionSlots, enemies, inventory.items, player?.currentMp, player?.currentStamina, resolveAdminItemById, selectedTargetId]);

  // Skill resource warning
  const skillResourceWarning = useMemo(() => {
    if (!selectedSkill || !player) return null;
    const summary = getSkillCostSummary(selectedSkill.definition, selectedSkill.level);
    const mp = summary.reduce((s, e) => String(e.type).toLowerCase().includes('mp') ? s + e.amount : s, 0);
    const sta = summary.reduce((s, e) => String(e.type).toLowerCase().includes('stamina') ? s + e.amount : s, 0);
    const hp = summary.reduce((s, e) => String(e.type).toLowerCase().includes('hp') ? s + e.amount : s, 0);
    if (mp > player.currentMp) return 'Недостаточно маны для навыка.';
    if (sta > player.currentStamina) return 'Недостаточно выносливости для навыка.';
    if (hp >= player.currentHp) return 'Недостаточно HP для навыка.';
    return null;
  }, [player, selectedSkill]);

  const actionHint = useMemo(() => {
    if (!isPlayerTurn) return null;
    if (selectedSource.kind === 'basic_attack' && !targetInRange) {
      return 'Цель вне досягаемости. Подойди ближе.';
    }
    return null;
  }, [isPlayerTurn, selectedSource.kind, targetInRange]);

  // ── Core action executor ────────────────────────────────────────────────

  const executeAction = useCallback(async (command: CombatCommand): Promise<boolean> => {
    if (!player || isSubmittingRef.current) return false;
    if (!isPlayerTurn) { onStatus('Сейчас не ваш ход.'); return false; }
    if (state.isFinished) return false;

    try {
      isSubmittingRef.current = true;
      const result = await executeCombatAction({
        battleId: combatId,
        actorId: player.id,
        roundNumber: state.roundNumber,
        command,
      });

      if (!result.ok) {
        if (
          result.errorCode === 'ROUND_MISMATCH'
          || result.errorCode === 'TURN_ALREADY_ENDED'
          || result.errorCode === 'BATTLE_NOT_PLANNING'
          || result.errorCode === 'ALREADY_SUBMITTED_THIS_ROUND'
          || result.errorCode === 'HTTP_400'
        ) {
          try {
            const fresh = await fetchCombatState(combatId);
            onStateChange(fresh);
          } catch {
            // Keep original error status message below.
          }
        }
        onStatus(formatActionError(result.errorCode, result.message));
        return false;
      }

      onStateChange(result.battleState);
      setSelectedMoveTile(null);
      setMovementType(null);
      setSelectedSource({ kind: 'none' });

      if (result.battleState.isFinished) {
        onStatus(`Бой завершён. Победитель: ${result.battleState.winner ?? 'ничья'}.`);
        await onBattleFinished?.(result.battleState);
      }
      return true;
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Ошибка выполнения действия.');
      return false;
    } finally {
      isSubmittingRef.current = false;
    }
  }, [
    combatId,
    isPlayerTurn,
    onBattleFinished,
    onStateChange,
    onStatus,
    player,
    state.isFinished,
    state.roundNumber,
  ]);

  // End turn (wait — 0 AP, 0 stamina)
  const endTurn = useCallback(async () => {
    await executeAction(createCombatCommandFromType({ type: 'wait', target: { kind: 'self' } }));
  }, [executeAction]);

  // Move to cell
  const executeMoveToTile = useCallback(async (tile: { x: number; y: number; movementType: MovementType }) => {
    const moveType = tile.movementType === MovementType.Dash
      ? 'dash'
      : tile.movementType === MovementType.Disengage
        ? 'disengage'
        : 'move';
    await executeAction(createCombatCommandFromType({
      type: moveType,
      target: { kind: 'cell', x: tile.x, y: tile.y },
      payload: { movementType: moveType === 'dash' ? 'dash' : moveType === 'disengage' ? 'disengage' : 'walk' },
    }));
  }, [executeAction]);

  // Attack / skill / item / weapon on entity
  const executeOnEntity = useCallback(async (entityId: string, forceBasicAttack = false) => {
    if (!player) return;

    if (!forceBasicAttack && selectedSource.kind === 'skill') {
      await executeAction(createCombatCommandFromType({
        type: 'skill_cast',
        target: { kind: 'entity', entityId },
        sourceSlotId: selectedSource.slotId,
        payload: { skillId: selectedSource.skillId, targetZone: TargetZone.Chest },
      }));
      onSkillChange(null);
      return;
    }

    if (!forceBasicAttack && selectedSource.kind === 'item') {
      const targetEntity = state.entities.find((e) => e.id === entityId);
      const adminItem = resolveAdminItemById ? resolveAdminItemById(selectedSource.itemId) : null;
      if (targetEntity && isCellTargetItem(adminItem)) {
        await executeAction(createCombatCommandFromType({
          type: 'item_use',
          target: { kind: 'cell', x: targetEntity.battlefieldX ?? 0, y: targetEntity.battlefieldY ?? 0 },
          sourceSlotId: selectedSource.slotId,
          payload: { itemId: selectedSource.itemId, itemInstanceId: selectedSource.itemInstanceId },
        }));
      } else {
        await executeAction(createCombatCommandFromType({
          type: 'item_use',
          target: { kind: 'entity', entityId },
          sourceSlotId: selectedSource.slotId,
          payload: { itemId: selectedSource.itemId, itemInstanceId: selectedSource.itemInstanceId },
        }));
      }
      return;
    }

    if (!forceBasicAttack && selectedSource.kind === 'weapon') {
      const alreadyEquipped = player.activeWeaponItemId === selectedSource.weaponItemId;
      if (!alreadyEquipped) {
        await executeAction(createCombatCommandFromType({
          type: 'weapon_swap',
          target: { kind: 'self' },
          sourceSlotId: selectedSource.slotId,
          payload: { weaponItemId: selectedSource.weaponItemId, weaponInstanceId: selectedSource.weaponInstanceId },
        }));
        return;
      }
    }

    // Default: basic attack
    setSelectedSource({ kind: 'basic_attack' });
    await executeAction(createCombatCommandFromType({
      type: 'basic_attack',
      target: { kind: 'entity', entityId },
      payload: { targetZone: TargetZone.Chest },
    }));
  }, [executeAction, onSkillChange, player, resolveAdminItemById, selectedSource, state.entities]);

  // Guard
  const executeGuard = useCallback(async (type: 'guard' | 'strong_guard') => {
    setGuardMode(type);
    setSelectedSource({ kind: type });
    await executeAction(createCombatCommandFromType({ type, target: { kind: 'self' } }));
  }, [executeAction]);

  // Heavy attack
  const executeHeavyAttack = useCallback(async (entityId: string) => {
    await executeAction(createCombatCommandFromType({
      type: 'heavy_attack',
      target: { kind: 'entity', entityId },
      payload: { targetZone: TargetZone.Chest },
    }));
  }, [executeAction]);

  // ── Effects ─────────────────────────────────────────────────────────────

  // Report command_failed events
  useEffect(() => {
    const latest = [...(state.recentCombatEvents ?? [])]
      .reverse()
      .find((e) => e.type === 'command_failed' && e.actorId === playerId);
    if (!latest || latest.id === lastFailureEventIdRef.current) return;
    lastFailureEventIdRef.current = latest.id;
    const reason = typeof latest.data?.reason === 'string' ? formatRevalidationReason(latest.data.reason) : null;
    onStatus(reason ? `${latest.message} Причина: ${reason}.` : latest.message);
  }, [onStatus, playerId, state.recentCombatEvents]);

  // Auto-select first alive enemy
  useEffect(() => {
    if (!enemies.some((e) => e.id === selectedTargetId)) {
      setSelectedTargetId(enemies[0]?.id ?? '');
    }
  }, [enemies, selectedTargetId]);

  // Clear move tile when movement type cleared
  useEffect(() => {
    if (!movementType) setSelectedMoveTile(null);
  }, [movementType]);

  // Timer expiry: sync state from server
  useEffect(() => {
    if (!isPlayerTurn || state.isFinished || remainingSeconds === null || remainingSeconds > 0) return;
    void (async () => {
      try {
        const fresh = await fetchCombatState(combatId);
        onStateChange(fresh);
      } catch { /* ignore */ }
    })();
  }, [combatId, isPlayerTurn, onStateChange, remainingSeconds, state.isFinished]);

  // Keyboard shortcuts
  useEffect(() => {
    const isEditable = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target) || !isPlayerTurn || state.isFinished) return;

      // Space = end turn
      if ((e.key === ' ' || e.code === 'Space') && !e.repeat) {
        e.preventDefault();
        void endTurn();
        return;
      }
      // E = guard, Shift+E = strong guard
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'e' && !e.repeat) {
        e.preventDefault();
        void executeGuard(e.shiftKey ? 'strong_guard' : 'guard');
        return;
      }
      // Escape = clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedMoveTile(null);
        setMovementType(null);
        setSelectedSource({ kind: 'none' });
        onSkillChange(null);
        return;
      }
      // 1-9, 0 = hotbar
      if (!e.ctrlKey && !e.metaKey && !e.altKey && /^[0-9]$/.test(e.key)) {
        const slotId = e.key === '0' ? 'quick10' : (`quick${e.key}` as CharacterActionSlot['slotId']);
        const slot = actionSlots.find((s) => s.slotId === slotId);
        if (!slot?.kind || !slot.refId) return;
        e.preventDefault();
        if (slot.kind === 'skill') {
          setSelectedSource({ kind: 'skill', slotId, skillId: slot.refId });
          onSkillChange(slot.refId);
          onStatus(`Навык ${slot.refId} выбран. Кликните цель.`);
        } else if (slot.kind === 'weapon') {
          setSelectedSource({ kind: 'weapon', slotId, weaponItemId: slot.refId, weaponInstanceId: slot.weaponInstanceId ?? undefined });
          onStatus(`Оружие выбрано. Кликните цель.`);
        } else if (slot.kind === 'item') {
          setSelectedSource({ kind: 'item', slotId, itemId: slot.refId, itemInstanceId: slot.itemInstanceId ?? undefined });
          onStatus(`Предмет выбран. Кликните цель.`);
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actionSlots, endTurn, executeGuard, isPlayerTurn, onSkillChange, onStatus, state.isFinished]);

  // ── Guard status labels (from recentCombatEvents) ───────────────────────
  const guardStatusByActorId = useMemo(() => {
    const map = new Map<string, { type: 'guard' | 'strong_guard'; broken: boolean }>();
    for (const event of state.recentCombatEvents ?? []) {
      if (event.type === 'guard_applied' && event.actorId) {
        const guardType = String(event.data?.guardType ?? 'guard') as 'guard' | 'strong_guard';
        map.set(event.actorId, { type: guardType, broken: false });
      }
      if (event.type === 'guard_broken' && event.actorId) {
        const existing = map.get(event.actorId);
        if (existing) map.set(event.actorId, { ...existing, broken: true });
      }
    }
    return map;
  }, [state.recentCombatEvents]);

  const playerGuardLabel = useMemo(() => {
    const g = guardStatusByActorId.get(playerId);
    if (!g) return null;
    if (g.broken) return g.type === 'strong_guard' ? 'Усиленная защита пробита' : 'Защита пробита';
    return g.type === 'strong_guard' ? 'Усиленная защита' : 'Защита';
  }, [guardStatusByActorId, playerId]);

  const enemyGuardLabel = useMemo(() => {
    if (!selectedEnemy) return null;
    const g = guardStatusByActorId.get(selectedEnemy.id);
    if (!g) return null;
    if (g.broken) return g.type === 'strong_guard' ? 'Усиленная защита пробита' : 'Защита пробита';
    return g.type === 'strong_guard' ? 'Усиленная защита' : 'Защита';
  }, [guardStatusByActorId, selectedEnemy]);

  const inspectedEntity = useMemo(
    () => state.entities.find((e) => e.id === inspectEntityId) ?? null,
    [inspectEntityId, state.entities],
  );

  if (!player) return <p>Player entity not found.</p>;

  // ── Turn status bar text ────────────────────────────────────────────────
  const turnStatusText = state.isFinished
    ? `Бой завершён — ${state.winner ?? 'ничья'}`
    : isLegacyPlanningMode
      ? `Ваш ход — AP: ${legacyApLeft} / 3`
    : isPlayerTurn
      ? `Ваш ход — AP: ${currentTurnAp} / 3`
      : `Ход: ${activeActor?.name ?? '...'}`;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="battle-fullscreen-root" role="dialog" aria-modal="true">
      <div className="battle-fullscreen">

        {/* ── Header ── */}
        <div className="battle-header">
          <div className="battle-header-left">
            <h2>Бой</h2>
            <span>Раунд {state.roundNumber}</span>
          </div>
          <div className="battle-header-center">
            <span
              className={isPlayerTurn ? 'turn-status-active' : 'turn-status-waiting'}
              aria-live="polite"
            >
              {turnStatusText}
            </span>
            {remainingSeconds !== null && (
              <span
                className={`battle-turn-timer${remainingSeconds <= 10 ? ' battle-turn-timer--urgent' : ''}`}
                title={`Дедлайн: ${new Date(state.turnDeadlineAt ?? 0).toLocaleTimeString()}`}
              >
                {formatCountdown(remainingSeconds)}
              </span>
            )}
          </div>
          <div className="battle-header-right">
            <button type="button" onClick={() => onClose?.()} aria-label="Закрыть бой">✕</button>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="battle-main-grid">

          {/* ── Left column: player card + hotbar + action planner ── */}
          <div className="battle-left-column battle-column">
            <div className="column-player-section">
              <FighterCard
                key={`player-${state.logs.length}`}
                fighter={player}
                highlighted={isPlayerTurn}
                side="player"
                avatarUrl={player.avatarUrl ?? playerAvatarUrl}
                visualState={feedback.playerVisualState}
                floatingText={feedback.floatingText}
                subtitle={playerGuardLabel ? `Вы — ${playerGuardLabel}` : 'Вы'}
              />
            </div>

            {/* AP indicator */}
            {isPlayerTurn && (
              <div className="battle-ap-bar" aria-label="Action Points">
                {(() => {
                  const visibleAp = isLegacyPlanningMode ? legacyApLeft : currentTurnAp;
                  return (
                    <>
                {[1, 2, 3].map((pip) => (
                  <span
                    key={pip}
                    className={`battle-ap-pip${pip <= visibleAp ? ' battle-ap-pip--filled' : ''}`}
                    title={`AP ${pip}`}
                  />
                ))}
                <span className="battle-ap-label">AP {visibleAp} / 3</span>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Hotbar */}
            <div className="battle-detail-popover" style={{ marginBottom: 12 }}>
              <strong>Быстрые слоты</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
                {actionSlots.map((slot) => {
                  const isSelected = selectedSource.kind !== 'none' && 'slotId' in selectedSource && selectedSource.slotId === slot.slotId;
                  const adminItem = (slot.kind === 'item' || slot.kind === 'weapon') && slot.refId && resolveAdminItemById
                    ? resolveAdminItemById(slot.refId)
                    : null;
                  const slotIsWeapon = slot.kind === 'weapon' || (slot.kind === 'item' && isWeaponAdminItem(adminItem));
                  const isEquipped = slotIsWeapon && slot.refId && player.activeWeaponItemId === slot.refId;
                  const disabled = !isPlayerTurn || !slot.kind || !slot.refId;
                  return (
                    <button
                      key={slot.slotId}
                      type="button"
                      className={`hotbar-slot${isSelected ? ' is-active' : ''}${isEquipped ? ' is-equipped' : ''}`}
                      disabled={disabled}
                      title={slot.refId ?? 'Пусто'}
                      onClick={() => {
                        if (!slot.kind || !slot.refId) { onStatus('Слот пуст.'); return; }
                        if (slot.kind === 'skill') {
                          setSelectedSource({ kind: 'skill', slotId: slot.slotId, skillId: slot.refId });
                          onSkillChange(slot.refId);
                          onStatus(`Навык выбран. Кликните цель.`);
                        } else if (slotIsWeapon) {
                          if (isEquipped) {
                            // Already equipped — just attack
                            setSelectedSource({ kind: 'basic_attack' });
                            onStatus('Оружие активно. Кликните врага для атаки.');
                          } else {
                            setSelectedSource({ kind: 'weapon', slotId: slot.slotId, weaponItemId: slot.refId, weaponInstanceId: slot.weaponInstanceId ?? undefined });
                            onStatus('Кликните цель для смены оружия.');
                          }
                        } else {
                          setSelectedSource({ kind: 'item', slotId: slot.slotId, itemId: slot.refId, itemInstanceId: slot.itemInstanceId ?? undefined });
                          onStatus('Предмет выбран. Кликните цель.');
                        }
                      }}
                    >
                      <span className="hotbar-slot-id">{slot.slotId.replace('quick', '')}</span>
                      <span className="hotbar-slot-label">{slot.refId ?? '—'}</span>
                      {isEquipped && <span className="hotbar-slot-badge">●</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action planner (target/skill/guard selectors) */}
            <ActionPlanner
              enemies={enemies}
              selectedTargetId={selectedTargetId}
              actionType={actionType}
              guardMode={guardMode}
              currentDistance={state.distance}
              movementType={movementType}
              selectedMoveTile={selectedMoveTile}
              currentStamina={player.currentStamina}
              maxStamina={player.maxStamina}
              currentMp={player.currentMp}
              maxMp={player.maxMp}
              availableSkills={availableSkills}
              inventoryItems={battleInventoryItems}
              selectedSkillId={selectedSkillId}
              actionWarning={skillResourceWarning ?? actionHint}
              onActionTypeChange={setActionType}
              onGuardModeChange={setGuardMode}
              onSkillChange={(id) => {
                onSkillChange(id);
                if (id) setSelectedSource({ kind: 'skill', skillId: id });
                else setSelectedSource({ kind: 'none' });
              }}
              onTargetChange={setSelectedTargetId}
              onUseInventoryItem={(itemId) => {
                if (onUseItem) void onUseItem(itemId, selectedTargetId);
              }}
              onSubmit={() => {
                // ActionPlanner submit = execute the selected action on the selected target
                if (!isPlayerTurn) return;
                const targetId = selectedTargetId || enemies[0]?.id;
                if (!targetId) { void endTurn(); return; }
                if (actionType === ActionType.Defend) {
                  void executeGuard(guardMode);
                } else if (actionType === ActionType.Wait) {
                  void endTurn();
                } else if (actionType === ActionType.Attack) {
                  if (selectedSkillId) {
                    setSelectedSource({ kind: 'skill', skillId: selectedSkillId });
                    void executeOnEntity(targetId, false);
                  } else {
                    void executeOnEntity(targetId, true);
                  }
                } else if (actionType === ActionType.Move) {
                  if (selectedMoveTile && movementType) {
                    void executeMoveToTile({ x: selectedMoveTile.x, y: selectedMoveTile.y, movementType });
                  } else {
                    onStatus('Выберите клетку для движения на карте.');
                  }
                }
              }}
              showSubmitButton={true}
              disabled={!isPlayerTurn || state.isFinished || enemies.length === 0}
            />

            {/* Escape button */}
            {state.battleType !== 'arena' && playerOnExitZone && !playerEscapeState?.active && isPlayerTurn && (
              <button
                type="button"
                className="secondary-button"
                style={{ marginTop: 8 }}
                title="Побег займёт 3 раунда в зоне выхода."
                onClick={() => {
                  if (!window.confirm('Начать побег? Нужно продержаться 3 раунда в зоне выхода.')) return;
                  void executeAction(createCombatCommandFromType({ type: 'start_retreat', target: { kind: 'self' } }));
                }}
              >
                СБЕЖАТЬ ИЗ БОЯ
              </button>
            )}
            {playerEscapeState?.active && (
              <div className="battle-escape-status">
                Побег: осталось {playerEscapeState.remainingRounds} раунда(ов)
              </div>
            )}
          </div>

          {/* ── Center column: battlefield + log + controls ── */}
          <div className="battle-center-column battle-column">
            <div className="battle-center-log card">
              <CombatLogPanel logs={state.logs} />
            </div>

            <BattleField
              entities={state.entities}
              battlefieldTiles={state.battlefieldTiles}
              battleMapWidth={state.battleMapWidth}
              battleMapHeight={state.battleMapHeight}
              viewportWidth={state.viewportWidth}
              viewportHeight={state.viewportHeight}
              mapImageUrl={mapImageUrl}
              mapCalibration={mapCalibration}
              distance={state.distance}
              selectedTargetId={selectedTargetId}
              playerId={playerId}
              playerAvatarUrl={playerAvatarUrl}
              movementType={movementType}
              selectedMoveTile={selectedMoveTile}
              lastLog={lastLog}
              recentLogs={recentLogs}
              animationEvents={state.recentAnimationEvents ?? []}
              selectedSkillId={selectedSkillId}
              playerVisualState={feedback.playerVisualState}
              enemyVisualState={feedback.enemyVisualState}
              floatingText={feedback.floatingText}
              animationTick={state.logs.length}
              onTargetSelect={(targetId) => {
                setSelectedTargetId(targetId);
                if (isPlayerTurn && selectedSource.kind !== 'none') {
                  void executeOnEntity(targetId, false);
                }
              }}
              onQuickAttack={(targetId) => {
                if (!isPlayerTurn) return;
                setSelectedTargetId(targetId);
                void executeOnEntity(targetId, true);
              }}
              onQuickHeavyAttack={(targetId) => {
                if (!isPlayerTurn) return;
                setSelectedTargetId(targetId);
                void executeHeavyAttack(targetId);
              }}
              onQuickWait={() => { if (isPlayerTurn) void endTurn(); }}
              onQuickGuard={() => { if (isPlayerTurn) void executeGuard('guard'); }}
              onQuickStrongGuard={() => { if (isPlayerTurn) void executeGuard('strong_guard'); }}
              onClearSelectedSource={() => {
                setSelectedSource({ kind: 'none' });
                onSkillChange(null);
              }}
              onMoveTileSelect={(tile) => {
                if (!isPlayerTurn) return;
                setMovementType(tile.movementType);
                setSelectedMoveTile({ x: tile.x, y: tile.y });
                onStatus(`Перемещение к ${tile.x + 1}:${tile.y + 1}.`);
                void executeMoveToTile(tile);
              }}
              onQuickMove={(tile) => {
                if (!isPlayerTurn) return;
                void executeMoveToTile(tile);
              }}
              onCancelSelection={() => setSelectedMoveTile(null)}
              onInspectEntity={(entityId) => setInspectEntityId(entityId)}
              onStatusMessage={onStatus}
            />

            {/* Controls bar */}
            <div className="battle-center-controls card">
              {/* Enemy turn overlay */}
              {!isPlayerTurn && !state.isFinished && (
                <div className="battle-enemy-turn-notice" aria-live="polite">
                  {activeActor
                    ? `Ход: ${activeActor.name}...`
                    : 'Ожидание хода...'}
                </div>
              )}

              {/* Quick action buttons */}
              {isPlayerTurn && (
                <div className="battle-quick-actions">
                  <button
                    type="button"
                    className={`secondary-button${selectedSource.kind === 'basic_attack' ? ' is-active' : ''}`}
                    disabled={enemies.length === 0}
                    onClick={() => {
                      setSelectedSource({ kind: 'basic_attack' });
                      if (selectedEnemy) void executeOnEntity(selectedEnemy.id, true);
                    }}
                    title={`1 AP / ${COMBAT_ACTION_COSTS.basic_attack.stamina ?? 0} STA`}
                  >
                    ⚔ Атака
                  </button>
                  <button
                    type="button"
                    className={`secondary-button${selectedSource.kind === 'heavy_attack' ? ' is-active' : ''}`}
                    disabled={enemies.length === 0}
                    onClick={() => {
                      setSelectedSource({ kind: 'heavy_attack' });
                      if (selectedEnemy) void executeHeavyAttack(selectedEnemy.id);
                    }}
                    title={`2 AP / ${COMBAT_ACTION_COSTS.heavy_attack.stamina ?? 0} STA`}
                  >
                    💥 Сильная атака
                  </button>
                  <button
                    type="button"
                    className={`secondary-button${selectedSource.kind === 'guard' ? ' is-active' : ''}`}
                    onClick={() => void executeGuard('guard')}
                    title={`1 AP / ${COMBAT_ACTION_COSTS.guard.stamina ?? 0} STA`}
                  >
                    🛡 Защита
                  </button>
                  <button
                    type="button"
                    className={`secondary-button${selectedSource.kind === 'strong_guard' ? ' is-active' : ''}`}
                    onClick={() => void executeGuard('strong_guard')}
                    title={`1 AP / ${COMBAT_ACTION_COSTS.strong_guard.stamina ?? 0} STA`}
                  >
                    🛡🛡 Усиленная защита
                  </button>
                </div>
              )}

              {/* End turn button */}
              <button
                type="button"
                className="confirm-turn-button battle-confirm-large"
                disabled={!isPlayerTurn || state.isFinished}
                onClick={endTurn}
                title="Завершить ход (Space)"
              >
                {isPlayerTurn ? 'ЗАВЕРШИТЬ ХОД' : (state.isFinished ? 'БОЙ ЗАВЕРШЁН' : 'ОЖИДАНИЕ...')}
              </button>
            </div>
          </div>

          {/* ── Right column: enemy card ── */}
          <div className="battle-right-column battle-column">
            <div className="column-enemy-section">
              {selectedEnemy ? (
                <FighterCard
                  key={`enemy-${state.logs.length}`}
                  fighter={selectedEnemy}
                  side="enemy"
                  avatarUrl={selectedEnemy.avatarUrl}
                  visualState={feedback.enemyVisualState}
                  floatingText={feedback.floatingText}
                  subtitle={enemyGuardLabel ? `Цель — ${enemyGuardLabel}` : 'Цель'}
                />
              ) : (
                <div className="no-enemy-placeholder">Нет цели</div>
              )}

              {/* All enemies list */}
              {enemies.length > 1 && (
                <div className="battle-enemy-list" style={{ marginTop: 12 }}>
                  <strong>Противники</strong>
                  {enemies.map((enemy) => (
                    <button
                      key={enemy.id}
                      type="button"
                      className={`enemy-list-item${enemy.id === selectedTargetId ? ' is-selected' : ''}`}
                      onClick={() => {
                        setSelectedTargetId(enemy.id);
                        if (isPlayerTurn && selectedSource.kind !== 'none') {
                          void executeOnEntity(enemy.id, false);
                        }
                      }}
                    >
                      <span>{enemy.name}</span>
                      <span className="enemy-hp-mini">{enemy.currentHp}/{enemy.maxHp} HP</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Inspect panel overlay ── */}
        {inspectedEntity && (
          <div
            className="battle-inspect-backdrop"
            onClick={() => setInspectEntityId(null)}
            role="presentation"
          >
            <div onClick={(e) => e.stopPropagation()} role="presentation">
              <InspectPanel
                entity={inspectedEntity}
                playerId={playerId}
                onClose={() => setInspectEntityId(null)}
                resolveItemById={resolveItemById}
                playerEquipment={playerEquipment}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
