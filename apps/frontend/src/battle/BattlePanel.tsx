// BattlePanel.tsx — P0 Sequential Turn-Based Combat UI
// Replaces simultaneous planning model with active-actor turn flow.
import {
  COMBAT_ACTION_COSTS,
  DistanceBand,
  MovementType,
  TargetZone,
  TeamSide,
  createCombatCommandFromType,
  getBattlefieldDistance,
  isActorStandingOnExitZone,
  type AdminSkillDefinition,
  type ArenaBattleState,
  type ArenaCombatEntity,
  type CombatAnimationEvent,
  type CombatCommand,
  type CombatEvent,
  type CombatLogEntry,
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
import { BattleField } from './BattleField';
import { CombatLogPanel } from './CombatLogPanel';
import { FighterCard } from './FighterCard';
import { InspectPanel } from './InspectPanel';
import { buildCombatContextActions, buildSelectedSourceHint } from './combatContextActions';

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
  onBattleFinished?: (next: ArenaBattleState, hubState?: ArenaHubState) => Promise<void> | void;
  onClose?: () => void;
  playerAvatarUrl?: string;
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveItemImage?: (item: ItemDefinition | null | undefined) => string | undefined;
  resolveSkillIcon?: (skill: AdminSkillDefinition | null | undefined) => string | undefined;
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
    SKILL_VALIDATION_FAILED: 'Навык сейчас недоступен.',
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readCell(value: unknown): { x: number; y: number } | null {
  const raw = toRecord(value);
  const x = raw && typeof raw.x === 'number' && Number.isFinite(raw.x) ? Math.floor(raw.x) : null;
  const y = raw && typeof raw.y === 'number' && Number.isFinite(raw.y) ? Math.floor(raw.y) : null;
  if (x === null || y === null) return null;
  return { x, y };
}

function readDamageAmount(event: CombatEvent): number {
  const data = event.data ?? {};
  return toFiniteAmount((data as Record<string, unknown>).finalDamage)
    || toFiniteAmount((data as Record<string, unknown>).amount)
    || toFiniteAmount((data as Record<string, unknown>).damage);
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
  onBattleFinished,
  onClose,
  playerAvatarUrl,
  resolveItemById,
  resolveItemImage,
  resolveSkillIcon,
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
  const skillCooldowns = useMemo(() => {
    const raw = (state as unknown as { skillCooldowns?: Array<{ skillId: string; remainingRounds: number }> }).skillCooldowns;
    const map = new Map<string, number>();
    for (const entry of Array.isArray(raw) ? raw : []) {
      if (entry.skillId && entry.remainingRounds > 0) {
        map.set(entry.skillId, entry.remainingRounds);
      }
    }
    return map;
  }, [state]);

  // ── Sequential turn model ───────────────────────────────────────────────
  const isPlayerTurn = !state.isFinished && state.activeActorId === playerId;
  const currentTurnAp = state.currentTurnAp ?? 0;
  const activeActor = useMemo(
    () => (state.activeActorId ? state.entities.find((e) => e.id === state.activeActorId) ?? null : null),
    [state.activeActorId, state.entities],
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
  const [guardMode, setGuardMode] = useState<'guard' | 'strong_guard'>('guard');
  const [playback, setPlayback] = useState<{
    isPlaying: boolean;
    statusText: string | null;
    activeActorId: string | null;
    animationEvents: CombatAnimationEvent[];
    recentLogs: CombatLogEntry[];
    lastLog: CombatLogEntry | null;
    visualPositions: Record<string, { x: number; y: number }>;
  }>({
    isPlaying: false,
    statusText: null,
    activeActorId: null,
    animationEvents: [],
    recentLogs: [],
    lastLog: null,
    visualPositions: {},
  });
  const isSubmittingRef = useRef(false);
  const lastFailureEventIdRef = useRef<string | null>(null);
  const pendingFinalStateRef = useRef<ArenaBattleState | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const playerStyle = useMemo(() => (player ? classifyCombatStyle(player) : 'MELEE'), [player]);
  const selectedSkill = useMemo(
    () => availableSkills.find((s) => s.skillId === selectedSkillId) ?? null,
    [availableSkills, selectedSkillId],
  );

  const selectedContextSource = useMemo(() => {
    if (selectedSource.kind === 'skill') return selectedSource;
    if (selectedSource.kind === 'item') return selectedSource;
    if (selectedSource.kind === 'weapon') return selectedSource;
    return { kind: 'none' as const };
  }, [selectedSource]);
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

  const lastLog = playback.isPlaying ? playback.lastLog : state.logs.at(-1) ?? null;
  const recentLogs = useMemo(
    () => (playback.isPlaying ? playback.recentLogs : state.logs.slice(-8)),
    [playback.isPlaying, playback.recentLogs, state.logs],
  );

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
        const inventoryQuantity = inventory.items.find((e) => e.itemId === itemId)?.quantity ?? 0;
        const quantity = Math.max(1, inventoryQuantity);
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
  const selectedSlotLabel = useMemo(() => {
    if (selectedSource.kind === 'none' || !('slotId' in selectedSource) || !selectedSource.slotId) {
      return null;
    }

    const slot = actionSlots.find((entry) => entry.slotId === selectedSource.slotId);
    if (!slot || !slot.refId) {
      return selectedSource.slotId;
    }

    if (slot.kind === 'skill') {
      const skill = availableSkills.find((entry) => entry.skillId === slot.refId || entry.definition.id === slot.refId)?.definition ?? null;
      return skill?.name ?? slot.refId;
    }

    const resolvedItem = resolveItemById ? resolveItemById(slot.refId) : null;
    const adminItem = resolveAdminItemById ? resolveAdminItemById(slot.refId) : null;
    return resolvedItem?.name ?? adminItem?.name ?? slot.refId;
  }, [actionSlots, availableSkills, resolveAdminItemById, resolveItemById, selectedSource]);

  // ── Core action executor ────────────────────────────────────────────────

  const executeAction = useCallback(async (command: CombatCommand): Promise<boolean> => {
    if (!player || isSubmittingRef.current) return false;
    if (playback.isPlaying) { onStatus('Дождитесь окончания действия.'); return false; }
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

      // Hold final state until playback ends to avoid teleporting tokens before movement animations.
      pendingFinalStateRef.current = result.battleState;
      setSelectedMoveTile(null);
      setMovementType(null);
      setSelectedSource({ kind: 'none' });

      const events: CombatEvent[] = Array.isArray((result as { events?: unknown }).events)
        ? ((result as { events: CombatEvent[] }).events)
        : [];

      if (events.length > 0) {
        setPlayback({
          isPlaying: true,
          statusText: 'Выполняется действие...',
          activeActorId: null,
          animationEvents: [],
          recentLogs: [],
          lastLog: null,
          visualPositions: {},
        });

        const finalState = result.battleState;
        const entityById = new Map(finalState.entities.map((e) => [e.id, e]));
        const movedActorIds = new Set<string>();
        const setTurnStatus = (actorId: string | null) => {
          const entity = actorId ? entityById.get(actorId) : undefined;
          const isEnemy = entity?.team === TeamSide.Right;
          setPlayback((prev) => ({
            ...prev,
            statusText: isEnemy ? 'Ход врага...' : actorId === playerId ? 'Ваш ход' : 'Выполняется действие...',
            activeActorId: actorId,
          }));
        };

        for (const event of events) {
          if (!event || typeof event !== 'object') continue;

          if (event.type === 'turn_started' || event.type === 'turn_changed') {
            setTurnStatus(event.actorId ?? null);
            const actorId = event.actorId ?? null;
            const actorFinal = actorId ? entityById.get(actorId) : undefined;
            const delay = actorFinal?.team === TeamSide.Right ? 600 : actorId === playerId ? 400 : 400;
            await sleep(delay);
            continue;
          }

          if (event.type === 'turn_ended') {
            await sleep(300);
            continue;
          }

          if (event.type === 'command_started') {
            setPlayback((prev) => ({ ...prev, statusText: prev.statusText ?? 'Выполняется действие...' }));
            await sleep(250);
            continue;
          }

          if (event.type === 'command_failed') {
            if (event.message) onStatus(event.message);
            setPlayback((prev) => ({ ...prev, statusText: 'Ошибка действия' }));
            await sleep(500);
            continue;
          }

          if (event.type === 'movement') {
            const data = (event.data ?? {}) as Record<string, unknown>;
            const from = readCell(data.from);
            const to = readCell(data.to);
            if (event.actorId && from && to) {
              const moveActorId = event.actorId;
              movedActorIds.add(moveActorId);
              const cells = Math.max(1, Math.abs(to.x - from.x) + Math.abs(to.y - from.y));
              const duration = Math.max(450, Math.min(1200, 400 * cells));

              // Render at `from` first to avoid any one-frame snap to destination.
              setPlayback((prev) => ({
                ...prev,
                visualPositions: { ...prev.visualPositions, [moveActorId]: { x: from.x, y: from.y } },
              }));
              await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

              // Then move to `to` (keeping override) and add a move_token animation hint for smooth interpolation.
              setPlayback((prev) => ({
                ...prev,
                visualPositions: { ...prev.visualPositions, [moveActorId]: { x: to.x, y: to.y } },
                animationEvents: [
                  ...prev.animationEvents,
                  {
                    id: `pb_move_${event.id}`,
                    roundNumber: event.roundNumber,
                    stepIndex: event.stepIndex,
                    type: 'move_token',
                    actorId: moveActorId,
                    from,
                    to,
                    movementType: typeof data.movementType === 'string'
                      ? String(data.movementType) as 'walk' | 'dash' | 'disengage'
                      : undefined,
                  },
                ],
              }));
              await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
              await sleep(duration);
            } else {
              await sleep(150);
            }
            continue;
          }

          if (event.type === 'attack') {
            const bump: CombatAnimationEvent = {
              id: `pb_bump_${event.id}`,
              roundNumber: event.roundNumber,
              stepIndex: event.stepIndex,
              type: 'attack_bump',
              actorId: event.actorId,
              targetId: event.targetId,
            };
            setPlayback((prev) => ({ ...prev, animationEvents: [...prev.animationEvents, bump] }));
            await sleep(220);
            continue;
          }

          if (event.type === 'damage') {
            const amount = readDamageAmount(event);
            if (event.actorId) {
              const log: CombatLogEntry = {
                round: event.roundNumber,
                actorId: event.actorId,
                targetId: event.targetId,
                type: 'HIT',
                amount: amount > 0 ? amount : undefined,
                text: event.message || (amount > 0 ? `-${amount}` : 'HIT'),
              };
              setPlayback((prev) => ({
                ...prev,
                lastLog: log,
                recentLogs: [...prev.recentLogs.slice(-7), log],
              }));
            }
            await sleep(700);
            continue;
          }

          if (event.type === 'resource_regen') {
            if (event.message) {
              const log: CombatLogEntry = {
                round: event.roundNumber,
                actorId: event.actorId ?? playerId,
                type: 'INFO',
                text: event.message,
              };
              setPlayback((prev) => ({
                ...prev,
                lastLog: log,
                recentLogs: [...prev.recentLogs.slice(-7), log],
              }));
            }
            await sleep(350);
            continue;
          }

          // Unknown / unhandled event — keep it safe and readable.
          if (event.message) {
            onStatus(event.message);
          }
          await sleep(150);
        }

        // Safety net: if any actor position changed in finalState without a movement event, warn and animate reconciliation.
        const baselineById = new Map(state.entities.map((e) => [e.id, e]));
        const missingMoves: Array<{ actorId: string; from: { x: number; y: number }; to: { x: number; y: number } }> = [];
        for (const entity of finalState.entities) {
          const before = baselineById.get(entity.id);
          if (!before) continue;
          const from = { x: before.battlefieldX ?? 0, y: before.battlefieldY ?? 0 };
          const to = { x: entity.battlefieldX ?? 0, y: entity.battlefieldY ?? 0 };
          if (from.x === to.x && from.y === to.y) continue;
          if (movedActorIds.has(entity.id)) continue;
          missingMoves.push({ actorId: entity.id, from, to });
        }

        if (missingMoves.length > 0) {
          if (import.meta.env.DEV) {
            for (const entry of missingMoves) {
              // eslint-disable-next-line no-console
              console.warn('Actor position changed without movement event', entry.actorId, entry.from, entry.to);
            }
          }
          for (const entry of missingMoves) {
            setPlayback((prev) => ({
              ...prev,
              visualPositions: { ...prev.visualPositions, [entry.actorId]: { x: entry.from.x, y: entry.from.y } },
            }));
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
            setPlayback((prev) => ({
              ...prev,
              visualPositions: { ...prev.visualPositions, [entry.actorId]: { x: entry.to.x, y: entry.to.y } },
              animationEvents: [
                ...prev.animationEvents,
                {
                  id: `pb_reconcile_${entry.actorId}_${Date.now()}`,
                  roundNumber: finalState.roundNumber,
                  stepIndex: -1,
                  type: 'move_token',
                  actorId: entry.actorId,
                  from: entry.from,
                  to: entry.to,
                  movementType: 'walk',
                },
              ],
            }));
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
            await sleep(450);
          }
        }

        // Keep playback locked until final authoritative state is applied below.
      }

      // Apply final authoritative state after playback finishes.
      if (pendingFinalStateRef.current) {
        const final = pendingFinalStateRef.current;
        pendingFinalStateRef.current = null;
        onStateChange(final);
        setPlayback({
          isPlaying: false,
          statusText: null,
          activeActorId: null,
          animationEvents: [],
          recentLogs: [],
          lastLog: null,
          visualPositions: {},
        });

        if (final.isFinished) {
          onStatus(`Бой завершён. Победитель: ${final.winner ?? 'ничья'}.`);
          await onBattleFinished?.(final);
        }
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
    playback.isPlaying,
    playerId,
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

  const executeItemUseCommand = useCallback(async (params: {
    itemId: string;
    sourceSlotId?: CharacterActionSlot['slotId'];
    itemInstanceId?: string;
    target: CombatCommand['target'];
  }) => {
    await executeAction(createCombatCommandFromType({
      type: 'item_use',
      target: params.target,
      sourceSlotId: params.sourceSlotId,
      payload: { itemId: params.itemId, itemInstanceId: params.itemInstanceId },
    }));
  }, [executeAction]);

  // Attack / skill / item / weapon on entity
  const executeOnEntity = useCallback(async (entityId: string, forceBasicAttack = false) => {
    if (!player) return;

    if (!forceBasicAttack && selectedSource.kind === 'skill') {
      const cooldownRemaining = skillCooldowns.get(selectedSource.skillId) ?? 0;
      if (cooldownRemaining > 0) {
        onStatus(`Навык на перезарядке: ${cooldownRemaining} ход.`);
        return;
      }
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
        await executeItemUseCommand({
          itemId: selectedSource.itemId,
          sourceSlotId: selectedSource.slotId,
          itemInstanceId: selectedSource.itemInstanceId,
          target: { kind: 'cell', x: targetEntity.battlefieldX ?? 0, y: targetEntity.battlefieldY ?? 0 },
        });
      } else {
        await executeItemUseCommand({
          itemId: selectedSource.itemId,
          sourceSlotId: selectedSource.slotId,
          itemInstanceId: selectedSource.itemInstanceId,
          target: { kind: 'entity', entityId },
        });
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
  }, [executeAction, executeItemUseCommand, onSkillChange, onStatus, player, resolveAdminItemById, selectedSource, skillCooldowns, state.entities]);

  const quickUseSelectedSlotItemAt = useCallback((target: { kind: 'entity'; entityId: string } | { kind: 'cell'; x: number; y: number }) => {
    if (!isPlayerTurn || state.isFinished) {
      return;
    }
    if (selectedSource.kind !== 'item') {
      onStatus('Сначала выберите предмет в быстром слоте.');
      return;
    }

    if (target.kind === 'cell') {
      void executeItemUseCommand({
        itemId: selectedSource.itemId,
        sourceSlotId: selectedSource.slotId,
        itemInstanceId: selectedSource.itemInstanceId,
        target: { kind: 'cell', x: target.x, y: target.y },
      });
      return;
    }

    const targetEntity = state.entities.find((entity) => entity.id === target.entityId);
    const adminItem = resolveAdminItemById ? resolveAdminItemById(selectedSource.itemId) : null;
    if (targetEntity && isCellTargetItem(adminItem)) {
      void executeItemUseCommand({
        itemId: selectedSource.itemId,
        sourceSlotId: selectedSource.slotId,
        itemInstanceId: selectedSource.itemInstanceId,
        target: { kind: 'cell', x: targetEntity.battlefieldX ?? 0, y: targetEntity.battlefieldY ?? 0 },
      });
      return;
    }

    void executeItemUseCommand({
      itemId: selectedSource.itemId,
      sourceSlotId: selectedSource.slotId,
      itemInstanceId: selectedSource.itemInstanceId,
      target: { kind: 'entity', entityId: target.entityId },
    });
  }, [executeItemUseCommand, isPlayerTurn, onStatus, resolveAdminItemById, selectedSource, state.entities, state.isFinished]);

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
  const turnStatusText = playback.isPlaying && playback.statusText
    ? playback.statusText
    : state.isFinished
    ? `Бой завершён — ${state.winner ?? 'ничья'}`
    : isPlayerTurn
      ? `Ваш ход — AP: ${currentTurnAp} / 3`
      : `Ход: ${activeActor?.name ?? '...'}` ;

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
                {[1, 2, 3].map((pip) => (
                  <span
                    key={pip}
                    className={`battle-ap-pip${pip <= currentTurnAp ? ' battle-ap-pip--filled' : ''}`}
                    title={`AP ${pip}`}
                  />
                ))}
                <span className="battle-ap-label">AP {currentTurnAp} / 3</span>
              </div>
            )}

            {/* Hotbar */}
            <div className="battle-detail-popover" style={{ marginBottom: 12 }}>
              <strong>Быстрые слоты</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
                {actionSlots.map((slot) => {
                  const isSelected = selectedSource.kind !== 'none' && 'slotId' in selectedSource && selectedSource.slotId === slot.slotId;
                  const skillOption = slot.kind === 'skill' && slot.refId
                    ? availableSkills.find((entry) => entry.skillId === slot.refId || entry.definition.id === slot.refId) ?? null
                    : null;
                  const skillDef = skillOption?.definition ?? null;
                  const skillCooldownRemaining = slot.kind === 'skill' && slot.refId ? skillCooldowns.get(slot.refId) ?? 0 : 0;
                  const isOnCooldown = skillCooldownRemaining > 0;
                  const resolvedItem = slot.kind !== 'skill' && slot.refId && resolveItemById ? resolveItemById(slot.refId) : null;
                  const adminItem = (slot.kind === 'item' || slot.kind === 'weapon') && slot.refId && resolveAdminItemById
                    ? resolveAdminItemById(slot.refId)
                    : null;
                  const slotIsWeapon = slot.kind === 'weapon' || (slot.kind === 'item' && isWeaponAdminItem(adminItem));
                  const isEquipped = slotIsWeapon && slot.refId && player.activeWeaponItemId === slot.refId;
                  const disabled = playback.isPlaying || !isPlayerTurn || !slot.kind || !slot.refId || isOnCooldown;
                  const slotImage = slot.kind === 'skill'
                    ? resolveSkillIcon?.(skillDef)
                    : resolvedItem ? resolveItemImage?.(resolvedItem) : undefined;
                  const slotTitle = slot.kind === 'skill'
                    ? (skillDef?.name ?? slot.refId ?? 'Навык')
                    : resolvedItem?.name ?? adminItem?.name ?? slot.refId ?? 'Пусто';
                  const slotFallbackText = slot.kind === 'skill'
                    ? slotTitle.slice(0, 2).toUpperCase()
                    : slotIsWeapon
                      ? '⚔'
                      : String(toRecord(adminItem as unknown)?.icon ?? '•');
                  return (
                    <button
                      key={slot.slotId}
                      type="button"
                      className={`hotbar-slot${isSelected ? ' is-active' : ''}${isEquipped ? ' is-equipped' : ''}`}
                      disabled={disabled}
                      title={isOnCooldown ? `${slotTitle}: перезарядка ${skillCooldownRemaining} ход.` : slotTitle}
                      onClick={() => {
                        if (playback.isPlaying) { onStatus('Дождитесь окончания действия.'); return; }
                        if (!slot.kind || !slot.refId) { onStatus('Слот пуст.'); return; }
                        if (slot.kind === 'skill' && isOnCooldown) {
                          onStatus(`Навык на перезарядке: ${skillCooldownRemaining} ход.`);
                          return;
                        }
                        if (isSelected) {
                          setSelectedSource({ kind: 'none' });
                          onSkillChange(null);
                          onStatus('Выбор слота снят.');
                          return;
                        }
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
                          onStatus('Предмет выбран. ПКМ по цели/клетке или кнопка "На себя".');
                        }
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateRows: '1fr auto',
                        alignItems: 'center',
                        justifyItems: 'center',
                        gap: 4,
                        minHeight: 68,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={slotImage ? {
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          backgroundImage: `url("${slotImage}")`,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                        } : {
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 16,
                          lineHeight: 1,
                        }}
                      >
                        {slotImage ? null : slotFallbackText}
                      </span>
                      <span style={{ fontSize: 11, lineHeight: 1.1, textAlign: 'center', wordBreak: 'break-word' }}>
                        {slot.kind === 'skill' ? slotTitle : (slot.kind === 'item' || slot.kind === 'weapon' ? slotTitle : slot.slotId.replace('quick', ''))}
                      </span>
                      {isEquipped && <span className="hotbar-slot-badge">●</span>}
                      {isOnCooldown && <span className="hotbar-slot-badge">{skillCooldownRemaining}</span>}
                    </button>
                  );
                })}
              </div>
              {selectedSource.kind !== 'none' && selectedSlotLabel ? (
                <div className="battle-selection-hint" role="status" aria-live="polite">
                  <span>{buildSelectedSourceHint({ selectedSource: selectedContextSource, selectedLabel: selectedSlotLabel, resolveAdminItemById })}</span>
                </div>
              ) : null}
            </div>



            {/* Escape button */}
            {state.battleType !== 'arena' && playerOnExitZone && !playerEscapeState?.active && isPlayerTurn && !playback.isPlaying && (
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

            <div style={{ position: 'relative' }}>
              {playback.isPlaying ? (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 1200,
                    background: 'transparent',
                  }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onStatus('Дождитесь окончания действия.'); }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onStatus('Дождитесь окончания действия.'); }}
                />
              ) : null}

              <BattleField
                entities={state.entities}
                battlefieldTiles={state.battlefieldTiles}
                battleMapWidth={state.battleMapWidth}
                battleMapHeight={state.battleMapHeight}
                viewportWidth={state.viewportWidth}
                viewportHeight={state.viewportHeight}
                visualPositions={playback.isPlaying ? playback.visualPositions : undefined}
                selectedSource={selectedContextSource}
                buildContextActions={(clickedTarget) => {
                  if (!player) return [];
                  return buildCombatContextActions({
                    selectedSource: selectedContextSource,
                    clickedTarget,
                    activeActor: player,
                    battleState: state,
                    selectedSkill: selectedContextSource.kind === 'skill' && selectedSkill
                      ? { label: selectedSkill.label, definition: selectedSkill.definition }
                      : null,
                    resolveAdminItemById,
                  });
                }}
                onExecuteContextCommand={(command) => { void executeAction(command); }}
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
                animationEvents={playback.isPlaying ? playback.animationEvents : (state.recentAnimationEvents ?? [])}
                selectedSkillId={selectedSkillId}
                playerVisualState={feedback.playerVisualState}
                enemyVisualState={feedback.enemyVisualState}
                floatingText={feedback.floatingText}
                animationTick={state.logs.length}
                onTargetSelect={(targetId) => {
                  if (playback.isPlaying) return;
                  setSelectedTargetId(targetId);
                }}
                onQuickAttack={(targetId) => {
                  if (playback.isPlaying) return;
                  if (!isPlayerTurn) return;
                  setSelectedTargetId(targetId);
                  void executeOnEntity(targetId, true);
                }}
                onQuickHeavyAttack={(targetId) => {
                  if (playback.isPlaying) return;
                  if (!isPlayerTurn) return;
                  setSelectedTargetId(targetId);
                  void executeHeavyAttack(targetId);
                }}
                onQuickWait={() => { if (!playback.isPlaying && isPlayerTurn) void endTurn(); }}
                onQuickGuard={() => { if (!playback.isPlaying && isPlayerTurn) void executeGuard('guard'); }}
                onQuickStrongGuard={() => { if (!playback.isPlaying && isPlayerTurn) void executeGuard('strong_guard'); }}
                onQuickItem={(itemId, targetId) => {
                  if (playback.isPlaying) return;
                  if (!isPlayerTurn || state.isFinished) {
                    return;
                  }
                const sourceSlot = actionSlots.find((slot) => slot.kind === 'item' && slot.refId === itemId);
                if (!sourceSlot) {
                  onStatus('Предмет не найден в быстрых слотах.');
                  return;
                }

                const entityTargetId = targetId ?? player.id;
                const targetEntity = state.entities.find((entity) => entity.id === entityTargetId);
                const adminItem = resolveAdminItemById ? resolveAdminItemById(itemId) : null;
                if (targetEntity && isCellTargetItem(adminItem)) {
                  void executeItemUseCommand({
                    itemId,
                    sourceSlotId: sourceSlot.slotId,
                    itemInstanceId: sourceSlot.itemInstanceId ?? undefined,
                    target: { kind: 'cell', x: targetEntity.battlefieldX ?? 0, y: targetEntity.battlefieldY ?? 0 },
                  });
                  return;
                }

                void executeItemUseCommand({
                  itemId,
                  sourceSlotId: sourceSlot.slotId,
                  itemInstanceId: sourceSlot.itemInstanceId ?? undefined,
                  target: { kind: 'entity', entityId: entityTargetId },
                });
                }}
                selectedHotbarItemId={selectedSource.kind === 'item' ? selectedSource.itemId : null}
                onQuickUseSelectedItemAt={quickUseSelectedSlotItemAt}
                onClearSelectedSource={() => {
                  if (playback.isPlaying) return;
                  setSelectedSource({ kind: 'none' });
                  onSkillChange(null);
                }}
                onMoveTileSelect={(tile) => {
                  if (playback.isPlaying) return;
                  if (!isPlayerTurn) return;
                  if (selectedContextSource.kind !== 'none') { onStatus('Сначала отмените выбранный источник.'); return; }
                  setMovementType(tile.movementType);
                  setSelectedMoveTile({ x: tile.x, y: tile.y });
                  onStatus(`Перемещение к ${tile.x + 1}:${tile.y + 1}.`);
                  void executeMoveToTile(tile);
                }}
                onQuickMove={(tile) => {
                  if (playback.isPlaying) return;
                  if (!isPlayerTurn) return;
                  if (selectedContextSource.kind !== 'none') { onStatus('Сначала отмените выбранный источник.'); return; }
                  void executeMoveToTile(tile);
                }}
                onCancelSelection={() => setSelectedMoveTile(null)}
                onInspectEntity={(entityId) => setInspectEntityId(entityId)}
                onStatusMessage={onStatus}
              />
            </div>

            {/* Controls bar */}
            <div className="battle-center-controls card">
              {/* Enemy turn overlay */}
              {playback.isPlaying && !state.isFinished && (
                <div className="battle-enemy-turn-notice battle-playback-notice" aria-live="polite">
                  {playback.statusText ?? 'Выполняется действие...'}
                </div>
              )}
              {!playback.isPlaying && !isPlayerTurn && !state.isFinished && (
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
                    disabled={playback.isPlaying || enemies.length === 0}
                    onClick={() => {
                      if (playback.isPlaying) { onStatus('Дождитесь окончания действия.'); return; }
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
                    disabled={playback.isPlaying || enemies.length === 0}
                    onClick={() => {
                      if (playback.isPlaying) { onStatus('Дождитесь окончания действия.'); return; }
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
                    disabled={playback.isPlaying}
                    onClick={() => { if (playback.isPlaying) { onStatus('Дождитесь окончания действия.'); return; } void executeGuard('guard'); }}
                    title={`1 AP / ${COMBAT_ACTION_COSTS.guard.stamina ?? 0} STA`}
                  >
                    🛡 Защита
                  </button>
                  <button
                    type="button"
                    className={`secondary-button${selectedSource.kind === 'strong_guard' ? ' is-active' : ''}`}
                    disabled={playback.isPlaying}
                    onClick={() => { if (playback.isPlaying) { onStatus('Дождитесь окончания действия.'); return; } void executeGuard('strong_guard'); }}
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
                disabled={playback.isPlaying || !isPlayerTurn || state.isFinished}
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
