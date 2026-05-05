import {
  ActionType,
  MovementType,
  TargetZone,
  TeamSide,
  getSkillCostSummary,
  getBattlefieldDistance,
  type AdminSkillDefinition,
  getItemById,
  type ItemDefinition,
  type ArenaBattleState,
  type Equipment,
  type InventoryState,
} from '@theend/rpg-domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendCombatAction, type ArenaHubState, type CharacterActionSlot } from '../api';
import type { AdminItem } from '../services/content/models';
import { ActionPlanner } from './ActionPlanner';
import { BattleField } from './BattleField';
import { CombatLogPanel } from './CombatLogPanel';
import { FighterCard } from './FighterCard';
import { InspectPanel } from './InspectPanel';

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
  availableSkills: Array<{ slotId: CharacterActionSlot['slotId']; slotIndex: number; skillId: string; level: number; label: string; definition: AdminSkillDefinition }>;
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

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toFiniteAmount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function accumulateResourceCost(costs: { mana: number; stamina: number; hp: number }, resource: unknown, amount: unknown): void {
  const key = String(resource ?? '').trim().toLowerCase();
  const safeAmount = toFiniteAmount(amount);
  if (safeAmount <= 0) {
    return;
  }
  if (key === 'mana' || key === 'mp') {
    costs.mana += safeAmount;
    return;
  }
  if (key === 'stamina' || key === 'sta') {
    costs.stamina += safeAmount;
    return;
  }
  if (key === 'hp' || key === 'health') {
    costs.hp += safeAmount;
  }
}

function normalizeAdminItemCosts(rawItem: AdminItem | null): { mana: number; stamina: number; hp: number } {
  const costs = { mana: 0, stamina: 0, hp: 0 };
  const raw = toRecord(rawItem as unknown);
  if (!raw) {
    return costs;
  }
  accumulateResourceCost(costs, 'mana', raw.manaCost);
  accumulateResourceCost(costs, 'stamina', raw.staminaCost);
  accumulateResourceCost(costs, 'hp', raw.hpCost);

  const directCosts = Array.isArray(raw.costs) ? raw.costs : [];
  for (const entry of directCosts) {
    const record = toRecord(entry);
    if (record) {
      accumulateResourceCost(costs, record.resource ?? record.type, record.amount);
    }
  }

  const nestedCosts = toRecord(raw.costs);
  const nestedResources = Array.isArray(nestedCosts?.resources) ? nestedCosts.resources : [];
  for (const entry of nestedResources) {
    const record = toRecord(entry);
    if (record) {
      accumulateResourceCost(costs, record.resource ?? record.type, record.amount);
    }
  }

  return costs;
}

function normalizeAdminItemEffects(rawItem: AdminItem | null): Array<{ type: string; amount: number; target?: string }> {
  const raw = toRecord(rawItem as unknown);
  if (!raw) {
    return [];
  }

  const sources: unknown[] = [];
  const singleEffect = toRecord(raw.useEffect);
  if (singleEffect) {
    sources.push(singleEffect);
  }
  if (Array.isArray(raw.effects)) {
    sources.push(...raw.effects);
  }
  if (Array.isArray(raw.combatEffects)) {
    sources.push(...raw.combatEffects);
  }

  return sources
    .map((entry) => toRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      type: String(entry.type ?? '').trim().toLowerCase(),
      amount: toFiniteAmount(entry.amount),
      target: typeof entry.target === 'string' ? entry.target : undefined,
    }))
    .filter((entry) => entry.type.length > 0);
}

function parseZoneFromLogText(text: string): TargetZone | null {
  const match = text.match(/in\s+([A-Z_]+)/i);
  const token = match?.[1]?.toUpperCase();
  if (!token) {
    return null;
  }
  if (token === 'HEAD' || token === 'H') return TargetZone.Head;
  if (token === 'CHEST' || token === 'C') return TargetZone.Chest;
  if (token === 'ABDOMEN' || token === 'A') return TargetZone.Abdomen;
  if (token === 'LEFT_ARM' || token === 'LA') return TargetZone.LeftArm;
  if (token === 'RIGHT_ARM' || token === 'RA') return TargetZone.RightArm;
  if (token === 'LEGS' || token === 'L') return TargetZone.Legs;
  return null;
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function classifyCombatStyle(entity: { strength: number; dexterity: number; intelligence: number; combatStyleHint?: 'MELEE' | 'RANGED' | 'MAGIC'; attackRange?: number }): 'MELEE' | 'RANGED' | 'MAGIC' {
  if (entity.combatStyleHint) {
    return entity.combatStyleHint;
  }
  if (typeof entity.attackRange === 'number' && entity.attackRange > 1) {
    return 'RANGED';
  }
  if (entity.intelligence >= entity.strength && entity.intelligence >= entity.dexterity) {
    return 'MAGIC';
  }
  if (entity.dexterity > entity.strength) {
    return 'RANGED';
  }
  return 'MELEE';
}

function getActionCost(actionType: ActionType, movementType: MovementType | null): number {
  const actionCost = actionType === ActionType.Attack ? 10 : actionType === ActionType.Defend ? 8 : 0;
  const moveCost = movementType === MovementType.Step
    ? 6
    : movementType === MovementType.Extra
      ? 16
      : movementType === MovementType.Dash
        ? 14
        : movementType === MovementType.Disengage
          ? 10
          : 0;
  return actionCost + moveCost;
}

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
  const player = useMemo(() => state.entities.find((item) => item.id === playerId), [state, playerId]);
  const enemies = useMemo(() => state.entities.filter((item) => item.team === TeamSide.Right && item.isAlive), [state]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const [selectedTargetId, setSelectedTargetId] = useState(enemies[0]?.id ?? '');
  const [actionType, setActionType] = useState<ActionType>(ActionType.Attack);
  const [attackZone, setAttackZone] = useState(TargetZone.Chest);
  const [defenseZones, setDefenseZones] = useState<TargetZone[]>([TargetZone.Chest, TargetZone.Abdomen]);
  const [movementType, setMovementType] = useState<MovementType | null>(null);
  const [selectedMoveTile, setSelectedMoveTile] = useState<{ x: number; y: number } | null>(null);
  const [inspectEntityId, setInspectEntityId] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const autoSubmittedRoundRef = useRef<number>(-1);
  const selectedSkill = useMemo(
    () => availableSkills.find((skill) => skill.skillId === selectedSkillId) ?? null,
    [availableSkills, selectedSkillId],
  );

  const battleInventoryItems = useMemo(
    () => actionSlots
      .filter((slot) => slot.kind === 'item' && Boolean(slot.refId))
      .map((slot) => {
        const itemId = slot.refId;
        if (!itemId) {
          return null;
        }
        const quantity = inventory.items.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
        const item = resolveItemById ? resolveItemById(itemId) : getItemById(itemId);
        if (!item) {
          return {
            id: itemId,
            name: itemId,
            description: 'Missing item definition.',
            icon: '?',
            itemType: 'missing',
            quantity,
            disabled: true,
            disabledReason: 'Предмет не найден в контенте.',
            effectSummary: 'Definition missing',
            costSummary: null,
          };
        }
        const adminItem = resolveAdminItemById ? resolveAdminItemById(itemId) : null;
        const costs = normalizeAdminItemCosts(adminItem);
        const effects = normalizeAdminItemEffects(adminItem);
        const wantsEnemyTarget = effects.some((effect) => effect.type === 'damage_target' || String(effect.target ?? '').toLowerCase().includes('enemy'));
        const costSummary = [
          costs.mana > 0 ? `${costs.mana} mana` : null,
          costs.stamina > 0 ? `${costs.stamina} stamina` : null,
          costs.hp > 0 ? `${costs.hp} HP` : null,
        ].filter(Boolean).join(', ') || null;
        const effectSummary = effects.length > 0
          ? effects.map((effect) => `${effect.type}${effect.amount > 0 ? ` ${effect.amount}` : ''}`).join(', ')
          : (item.description || null);
        const notEnoughMana = costs.mana > (player?.currentMp ?? 0);
        const notEnoughStamina = costs.stamina > (player?.currentStamina ?? 0);
        const invalidTarget = wantsEnemyTarget && !enemies.some((enemy) => enemy.id === selectedTargetId);
        const disabledReason = quantity <= 0
          ? 'Количество закончилось.'
          : notEnoughMana
            ? 'Not enough mana'
            : notEnoughStamina
              ? 'Not enough stamina'
              : invalidTarget
                ? 'Нет цели для предмета.'
                : null;
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          icon: item.icon,
          itemType: item.itemType,
          quantity,
          disabled: Boolean(disabledReason),
          disabledReason,
          effectSummary,
          costSummary,
        };
      })
      .filter(Boolean) as Array<{ id: string; name: string; description: string; icon: string; itemType: string; quantity: number; disabled?: boolean; disabledReason?: string | null; effectSummary?: string | null; costSummary?: string | null }>,
    [actionSlots, enemies, inventory.items, player?.currentMp, player?.currentStamina, resolveAdminItemById, resolveItemById, selectedTargetId],
  );

  useEffect(() => {
    console.info('[combatItems] loaded', battleInventoryItems);
  }, [battleInventoryItems]);

  useEffect(() => {
    console.info('[combatSkills] loaded', availableSkills.map((entry) => entry.skillId));
  }, [availableSkills]);

  const lastLog = state.logs.at(-1);
  const recentLogs = useMemo(() => state.logs.slice(-8), [state.logs]);
  const lastHitZone = useMemo(() => (lastLog ? parseZoneFromLogText(lastLog.text) : null), [lastLog]);
  const selectedEnemy = useMemo(
    () => enemies.find((enemy) => enemy.id === selectedTargetId) ?? enemies[0] ?? null,
    [enemies, selectedTargetId],
  );
  const selectedEnemyPlacement = useMemo(
    () => state.entities.find((item) => item.id === selectedTargetId) ?? null,
    [selectedTargetId, state.entities],
  );
  const playerPlacement = useMemo(
    () => state.entities.find((item) => item.id === playerId) ?? null,
    [playerId, state.entities],
  );
  const pendingPlayerPlacement = useMemo(() => {
    if (!playerPlacement) {
      return null;
    }
    return {
      ...playerPlacement,
      battlefieldX: selectedMoveTile?.x ?? playerPlacement.battlefieldX,
      battlefieldY: selectedMoveTile?.y ?? playerPlacement.battlefieldY,
    };
  }, [playerPlacement, selectedMoveTile]);
  const playerStyle = player ? classifyCombatStyle(player) : 'MELEE';
  const inspectedEntity = useMemo(
    () => state.entities.find((entity) => entity.id === inspectEntityId) ?? null,
    [inspectEntityId, state.entities],
  );
  const targetInRange = useMemo(() => {
    if (!pendingPlayerPlacement || !selectedEnemyPlacement) {
      return false;
    }

    const dist = getBattlefieldDistance(pendingPlayerPlacement, selectedEnemyPlacement);
    if (playerStyle === 'MELEE') {
      return dist <= 1;
    }
    if (playerStyle === 'RANGED') {
      const maxRange = typeof player?.attackRange === 'number' && player.attackRange > 1 ? Math.floor(player.attackRange) : 6;
      return dist <= Math.max(2, maxRange);
    }
    const maxRange = typeof player?.attackRange === 'number' && player.attackRange > 1 ? Math.floor(player.attackRange) : 5;
    return dist <= Math.max(2, maxRange);
  }, [pendingPlayerPlacement, player?.attackRange, playerStyle, selectedEnemyPlacement]);

  const feedback = useMemo(() => {
    if (!lastLog) {
      return { playerVisualState: 'idle' as const, enemyVisualState: 'idle' as const, floatingText: null as string | null };
    }

    const playerIsActor = lastLog.actorId === playerId;
    const playerIsTarget = lastLog.targetId === playerId;

    if (lastLog.type === 'HIT') {
      const floatingText = /critical/i.test(lastLog.text) ? `CRIT -${lastLog.amount ?? 0}` : `-${lastLog.amount ?? 0}`;
      return {
        playerVisualState: playerIsActor ? 'attack' as const : playerIsTarget ? 'hit' as const : 'idle' as const,
        enemyVisualState: playerIsActor ? 'hit' as const : playerIsTarget ? 'attack' as const : 'idle' as const,
        floatingText,
      };
    }

    if (lastLog.type === 'BLOCK') {
      return {
        playerVisualState: playerIsActor ? 'block' as const : playerIsTarget ? 'attack' as const : 'idle' as const,
        enemyVisualState: playerIsActor ? 'attack' as const : playerIsTarget ? 'block' as const : 'idle' as const,
        floatingText: 'BLOCK',
      };
    }

    if (lastLog.type === 'MISS') {
      return {
        playerVisualState: playerIsActor ? 'attack' as const : playerIsTarget ? 'dodge' as const : 'idle' as const,
        enemyVisualState: playerIsActor ? 'dodge' as const : playerIsTarget ? 'attack' as const : 'idle' as const,
        floatingText: 'DODGE',
      };
    }

    return { playerVisualState: 'idle' as const, enemyVisualState: 'idle' as const, floatingText: null as string | null };
  }, [lastLog, playerId]);

  const recentBlockedZone = useMemo(() => {
    if (!lastLog || lastLog.type !== 'BLOCK') {
      return null;
    }
    return defenseZones[0] ?? null;
  }, [defenseZones, lastLog]);

  const actionWarning = useMemo(() => {
    if (actionType === ActionType.Attack && movementType === MovementType.Dash) {
      return 'После Dash атака недоступна.';
    }
    if (actionType === ActionType.Attack && movementType === MovementType.Disengage) {
      return 'После Disengage атака недоступна.';
    }
    if (actionType === ActionType.Attack && movementType === MovementType.Extra) {
      return 'После 2 клеток движения атака по базовым правилам недоступна.';
    }
    if (getActionCost(actionType, movementType) > (player?.currentStamina ?? 0)) {
      return 'Недостаточно stamina для выбранной комбинации действий.';
    }
    if (selectedSkill) {
      const resourceSummary = getSkillCostSummary(selectedSkill.definition, selectedSkill.level);
      const manaCost = resourceSummary.reduce((sum, entry) => String(entry.type).toLowerCase().includes('mp') ? sum + entry.amount : sum, 0);
      const staminaCost = resourceSummary.reduce((sum, entry) => String(entry.type).toLowerCase().includes('stamina') ? sum + entry.amount : sum, 0);
      if (manaCost > (player?.currentMp ?? 0)) {
        return 'Not enough mana';
      }
      if (staminaCost + getActionCost(actionType, movementType) > (player?.currentStamina ?? 0)) {
        return 'Not enough stamina';
      }
    }
    return null;
  }, [actionType, movementType, player?.currentMp, player?.currentStamina, selectedSkill]);

  // Soft hint — shown in UI but does NOT disable the button
  const actionHint = useMemo(() => {
    if (actionType === ActionType.Attack && selectedMoveTile && !targetInRange) {
      return 'Цель вне досягаемости даже после перемещения.';
    }
    if (actionType === ActionType.Attack && !selectedMoveTile && !targetInRange) {
      return 'Цель далеко — подойди к ней на карте или просто атакуй (сервер проверит дистанцию).';
    }
    return null;
  }, [actionType, selectedMoveTile, targetInRange]);

  const pendingActionSummary = useMemo(() => {
    const targetLabel = selectedEnemy?.name ?? 'без цели';
    const parts: string[] = [];

    if (movementType && selectedMoveTile) {
      const movementLabel = movementType === MovementType.Step
        ? 'Шаг'
        : movementType === MovementType.Extra
          ? 'Рывок на 2 клетки'
          : movementType === MovementType.Dash
            ? 'Дэш'
            : 'Отход';
      parts.push(`${movementLabel} -> ${selectedMoveTile.x + 1}:${selectedMoveTile.y + 1}`);
    }

    if (actionType === ActionType.Attack) {
      parts.push(selectedSkill ? `Навык ${selectedSkill.label} -> ${targetLabel}` : `Базовая атака -> ${targetLabel}`);
    } else if (actionType === ActionType.Defend) {
      parts.push(`Защита -> ${defenseZones.map((zone) => zone.toLowerCase()).join(', ')}`);
    } else if (actionType === ActionType.Move) {
      parts.push(selectedMoveTile ? `Перемещение -> ${selectedMoveTile.x + 1}:${selectedMoveTile.y + 1}` : 'Перемещение не выбрано');
    } else if (actionType === ActionType.Wait) {
      parts.push('Ожидание');
    }

    return parts;
  }, [actionType, defenseZones, movementType, selectedEnemy?.name, selectedMoveTile, selectedSkill]);

  const resetPendingAction = useCallback(() => {
    setActionType(ActionType.Attack);
    setMovementType(null);
    setSelectedMoveTile(null);
    onSkillChange(null);
    onStatus('Боевой план сброшен.');
  }, [onSkillChange, onStatus]);

  const secondsLeft = useMemo(() => {
    if (!state.turnDeadlineAt || state.isFinished) {
      return null;
    }
    const diff = state.turnDeadlineAt - nowMs;
    return Math.max(0, Math.ceil(diff / 1000));
  }, [nowMs, state.isFinished, state.turnDeadlineAt]);

  useEffect(() => {
    if (!enemies.some((enemy) => enemy.id === selectedTargetId)) {
      setSelectedTargetId(enemies[0]?.id ?? '');
    }
  }, [enemies, selectedTargetId]);

  useEffect(() => {
    if (!movementType) {
      setSelectedMoveTile(null);
    }
  }, [movementType]);


  const submitRoundWithAction = useCallback(async (actionTypeOverride?: ActionType): Promise<void> => {
    if (isSubmittingRef.current) {
      return;
    }
    const effectiveActionType = actionTypeOverride ?? actionType;
    const effectiveMovementType = effectiveActionType === ActionType.Wait ? undefined : movementType ?? undefined;
    const effectiveDestinationX = effectiveActionType === ActionType.Wait ? undefined : selectedMoveTile?.x;
    const effectiveDestinationY = effectiveActionType === ActionType.Wait ? undefined : selectedMoveTile?.y;

    if (!player || !selectedTargetId) {
      return;
    }
    if (effectiveMovementType && !selectedMoveTile) {
      onStatus('Выберите клетку движения.');
      return;
    }
    if (!actionTypeOverride && actionWarning) {
      onStatus(actionWarning);
      return;
    }

    try {
      isSubmittingRef.current = true;
      const result = await sendCombatAction({
        combatId,
        actorId: player.id,
        targetId: selectedTargetId,
        attackZone,
        defenseZones,
        attackPointsSpent: 0,
        defensePointsSpent: 0,
        actionType: effectiveActionType,
        movementType: effectiveMovementType,
        destinationX: effectiveDestinationX,
        destinationY: effectiveDestinationY,
        skillId: effectiveActionType === ActionType.Attack ? selectedSkill?.skillId : undefined,
        skillLevel: effectiveActionType === ActionType.Attack ? selectedSkill?.level : undefined,
      });
      const nextState = result.state;

      onStateChange(nextState);
      setSelectedMoveTile(null);
      setMovementType(null);

      if (nextState.isFinished) {
        onStatus(`Battle finished. Winner: ${nextState.winner ?? 'none'}.`);
        await onBattleFinished?.(nextState, result.hubState);
      } else {
        onStatus(`Round ${nextState.roundNumber} resolved.`);
      }
    } catch (error) {
      onStatus(`Round error: ${(error as Error).message}`);
    } finally {
      isSubmittingRef.current = false;
    }
  }, [
    actionWarning,
    attackZone,
    combatId,
    defenseZones,
    movementType,
    onStateChange,
    onStatus,
    player,
    selectedMoveTile,
    selectedSkill,
    selectedTargetId,
  ]);

  useEffect(() => {
    if (!state.turnDeadlineAt || state.isFinished) {
      return;
    }
    if (nowMs < state.turnDeadlineAt) {
      return;
    }
    if (autoSubmittedRoundRef.current === state.roundNumber) {
      return;
    }
    autoSubmittedRoundRef.current = state.roundNumber;
    submitRoundWithAction(ActionType.Wait);
  }, [nowMs, state.isFinished, state.roundNumber, state.turnDeadlineAt, submitRoundWithAction]);

  const submitRound = useCallback(async (): Promise<void> => {
    await submitRoundWithAction();
  }, [submitRoundWithAction]);

  const applyMoveSelection = useCallback((tile: { x: number; y: number; movementType: MovementType; willTriggerOpportunity: boolean }) => {
    setMovementType(tile.movementType);
    setSelectedMoveTile({ x: tile.x, y: tile.y });
    if (tile.willTriggerOpportunity) {
      onStatus('Маршрут опасен: будет удар вслед.');
    } else {
      onStatus(`Move planned to ${tile.x + 1}:${tile.y + 1}`);
    }
  }, [onStatus]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const handleHotkeys = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.shiftKey && !event.ctrlKey && !event.altKey && event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) {
          void submitRound();
        }
        return;
      }

      if (event.key === ' ' || event.code === 'Space') {
        if (event.repeat) {
          return;
        }
        event.preventDefault();
        setActionType(ActionType.Wait);
        void submitRoundWithAction(ActionType.Wait);
        return;
      }

      if (!event.ctrlKey && !event.altKey && !event.metaKey) {
        const quickSlotIndex = event.key === '0'
          ? 9
          : /^[1-9]$/.test(event.key)
            ? Number(event.key) - 1
            : -1;
        if (quickSlotIndex >= 0) {
          const quickSkill = availableSkills.find((skill) => skill.slotIndex === quickSlotIndex) ?? null;
          if (quickSkill) {
            event.preventDefault();
            onSkillChange(quickSkill.skillId);
            setActionType(ActionType.Attack);
          }
        }
      }
    };

    window.addEventListener('keydown', handleHotkeys);
    return () => window.removeEventListener('keydown', handleHotkeys);
  }, [availableSkills, onSkillChange, submitRound, submitRoundWithAction]);

  if (!player) {
    return <p>Player entity not found.</p>;
  }

  return (
    <div className="battle-fullscreen-root" role="dialog" aria-modal="true">
      <div className="battle-fullscreen">
        <div className="battle-header">
          <div className="battle-header-left">
            <h2>Arena Combat</h2>
            <span>Round {state.roundNumber}</span>
          </div>
          <div className="battle-header-center">
            <span>{state.isFinished ? `Battle Over: ${state.winner ?? 'none'} wins` : 'Combat in Progress'}</span>
            {secondsLeft !== null ? (
              <span className="battle-turn-timer" title={`Turn deadline: ${new Date(state.turnDeadlineAt ?? 0).toLocaleTimeString()}`}>
                Turn: {formatCountdown(secondsLeft)}
              </span>
            ) : null}
          </div>
          <div className="battle-header-right">
            <button type="button" onClick={() => onClose?.()} aria-label="Close battle">✕</button>
          </div>
        </div>

        <div className="battle-main-grid">
          <div className="battle-left-column battle-column">
            <div className="column-player-section">
              <FighterCard
                key={`player-${state.logs.length}`}
                fighter={player}
                highlighted
                side="player"
                avatarUrl={player.avatarUrl ?? playerAvatarUrl}
                visualState={feedback.playerVisualState}
                floatingText={feedback.floatingText}
                subtitle="You"
              />
            </div>

            <div className="column-command-section">
              <ActionPlanner
                enemies={enemies}
                selectedTargetId={selectedTargetId}
                actionType={actionType}
                attackZone={attackZone}
                defenseZones={defenseZones}
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
                actionWarning={actionWarning ?? actionHint}
                onActionTypeChange={setActionType}
                onSkillChange={onSkillChange}
                onTargetChange={setSelectedTargetId}
                onAttackZoneChange={setAttackZone}
                onDefenseZonesChange={setDefenseZones}
                onUseInventoryItem={(itemId) => {
                  console.info('[combatItems] use', { itemId, targetId: selectedTargetId });
                  if (onUseItem) {
                    void onUseItem(itemId, selectedTargetId);
                  }
                }}
                onSubmit={submitRound}
                showSubmitButton={false}
                disabled={state.isFinished || enemies.length === 0 || Boolean(actionWarning)}
                recentHitZone={lastHitZone}
                recentBlockedZone={recentBlockedZone}
              />
            </div>
          </div>

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
                onTargetSelect={(targetId) => setSelectedTargetId(targetId)}
                onStatusMessage={onStatus}
                onQuickAttack={(targetId) => {
                  setSelectedTargetId(targetId);
                  setActionType(ActionType.Attack);
                  onStatus('Атака поставлена в план. Подтвердите ход.');
                }}
                onQuickMove={(tile) => {
                  applyMoveSelection(tile);
                  onStatus('Перемещение поставлено в план. Подтвердите ход.');
                }}
                onMoveTileSelect={applyMoveSelection}
                onCancelSelection={() => setSelectedMoveTile(null)}
                onInspectEntity={(entityId) => setInspectEntityId(entityId)}
                playerVisualState={feedback.playerVisualState}
                enemyVisualState={feedback.enemyVisualState}
                floatingText={feedback.floatingText}
                animationTick={state.logs.length}
            />

            <div className="battle-center-controls card">
              <div className="battle-pending-action" aria-live="polite">
                <div className="battle-pending-action-head">
                  <strong>Текущий план</strong>
                  <button type="button" className="battle-pending-reset" onClick={resetPendingAction}>Сбросить</button>
                </div>
                <div className="battle-pending-action-body">
                  {pendingActionSummary.map((line) => (
                    <span key={line} className="battle-pending-chip">{line}</span>
                  ))}
                  {actionWarning ? <span className="battle-pending-warning">{actionWarning}</span> : null}
                  {!actionWarning && actionHint ? <span className="battle-pending-hint">{actionHint}</span> : null}
                </div>
              </div>
              <button
                type="button"
                className="confirm-turn-button battle-confirm-large"
                disabled={state.isFinished || enemies.length === 0 || Boolean(actionWarning)}
                title={actionWarning ?? actionHint ?? (pendingActionSummary.length > 0 ? pendingActionSummary.join(' | ') : undefined)}
                onClick={submitRound}
              >
                СДЕЛАТЬ ХОД
              </button>
            </div>
          </div>

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
                  subtitle="Target"
                />
              ) : (
                <div className="no-enemy-placeholder">No target</div>
              )}
            </div>
          </div>
        </div>

        {inspectedEntity ? (
          <div className="battle-inspect-backdrop" onClick={() => setInspectEntityId(null)} role="presentation">
            <div className="battle-inspect-dialog" onClick={(event) => event.stopPropagation()} role="presentation">
              <InspectPanel
                entity={inspectedEntity}
                playerId={playerId}
                onClose={() => setInspectEntityId(null)}
                resolveItemById={resolveItemById}
                playerEquipment={playerEquipment}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
