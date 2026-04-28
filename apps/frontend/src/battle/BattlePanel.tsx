import {
  ActionType,
  CombatSkillType,
  MovementType,
  TargetZone,
  TeamSide,
  getBattlefieldDistance,
  getItemById,
  type ItemDefinition,
  type ArenaBattleState,
  type Equipment,
  type InventoryState,
} from '@theend/rpg-domain';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sendCombatAction } from '../api';
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
  mapImageUrl?: string;
  mapCalibration?: {
    cellSizePx?: number;
    gridOffsetX?: number;
    gridOffsetY?: number;
  };
  selectedSkill: CombatSkillType;
  learnedSkills: CombatSkillType[];
  onSkillChange: (skill: CombatSkillType) => void;
  onStateChange: (next: ArenaBattleState) => void;
  onStatus: (text: string) => void;
  onBattleFinished?: (next: ArenaBattleState) => Promise<void> | void;
  onClose?: () => void;
  playerAvatarUrl?: string;
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  playerEquipment?: Equipment;
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

function classifyCombatStyle(entity: { strength: number; dexterity: number; intelligence: number; combatStyleHint?: 'MELEE' | 'RANGED' | 'MAGIC' }): 'MELEE' | 'RANGED' | 'MAGIC' {
  if (entity.combatStyleHint) {
    return entity.combatStyleHint;
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
  mapImageUrl,
  mapCalibration,
  selectedSkill,
  learnedSkills,
  onSkillChange,
  onStateChange,
  onStatus,
  onBattleFinished,
  onClose,
  playerAvatarUrl,
  resolveItemById,
  playerEquipment,
}: BattlePanelProps) {
  const player = useMemo(() => state.entities.find((item) => item.id === playerId), [state, playerId]);
  const enemies = useMemo(() => state.entities.filter((item) => item.team === TeamSide.Right && item.isAlive), [state]);

  const [selectedTargetId, setSelectedTargetId] = useState(enemies[0]?.id ?? '');
  const [actionType, setActionType] = useState<ActionType>(ActionType.Attack);
  const [attackZone, setAttackZone] = useState(TargetZone.Chest);
  const [defenseZones, setDefenseZones] = useState<TargetZone[]>([TargetZone.Chest, TargetZone.Abdomen]);
  const [movementType, setMovementType] = useState<MovementType | null>(null);
  const [selectedMoveTile, setSelectedMoveTile] = useState<{ x: number; y: number } | null>(null);
  const [inspectEntityId, setInspectEntityId] = useState<string | null>(null);

  const availableSkills = useMemo(
    () => [
      { id: CombatSkillType.None, label: 'Базовая атака' },
      ...learnedSkills.map((skill) => ({
        id: skill,
        label: {
          [CombatSkillType.PowerStrike]: 'Power Strike',
          [CombatSkillType.CrushingBlock]: 'Crushing Block',
          [CombatSkillType.Rage]: 'Rage',
          [CombatSkillType.Fireball]: 'Пламя Фелдана',
          [CombatSkillType.FrostLance]: 'Frost Lance',
          [CombatSkillType.ShieldBash]: 'Таран Арклейна',
          [CombatSkillType.Whirlwind]: 'Whirlwind',
          [CombatSkillType.None]: 'Базовая атака',
        }[skill],
      })),
    ],
    [learnedSkills],
  );

  const battleInventoryItems = useMemo(
    () => inventory.items
      .map((entry) => {
        const item = resolveItemById ? resolveItemById(entry.itemId) : getItemById(entry.itemId);
        if (!item) {
          return null;
        }
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          icon: item.icon,
          itemType: item.itemType,
          quantity: entry.quantity,
        };
      })
      .filter(Boolean) as Array<{ id: string; name: string; description: string; icon: string; itemType: string; quantity: number }>,
    [inventory.items, resolveItemById],
  );

  const lastLog = state.logs.at(-1);
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
      return dist >= 2;
    }
    return dist <= 5;
  }, [pendingPlayerPlacement, playerStyle, selectedEnemyPlacement]);

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
    return null;
  }, [actionType, movementType, player?.currentStamina]);

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
      const nextState = await sendCombatAction({
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
        skillType: effectiveActionType === ActionType.Attack ? selectedSkill : undefined,
      });

      onStateChange(nextState);
      setSelectedMoveTile(null);
      setMovementType(null);

      if (nextState.isFinished) {
        onStatus(`Battle finished. Winner: ${nextState.winner ?? 'none'}.`);
        await onBattleFinished?.(nextState);
      } else {
        onStatus(`Round ${nextState.roundNumber} resolved.`);
      }
    } catch (error) {
      onStatus(`Round error: ${(error as Error).message}`);
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
      }
    };

    window.addEventListener('keydown', handleHotkeys);
    return () => window.removeEventListener('keydown', handleHotkeys);
  }, [submitRound, submitRoundWithAction]);

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
                selectedSkill={selectedSkill}
                actionWarning={actionWarning ?? actionHint}
                onActionTypeChange={setActionType}
                onSkillChange={onSkillChange}
                onTargetChange={setSelectedTargetId}
                onAttackZoneChange={setAttackZone}
                onDefenseZonesChange={setDefenseZones}
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
              onTargetSelect={(targetId) => setSelectedTargetId(targetId)}
              onStatusMessage={onStatus}
              onQuickAttack={(targetId) => {
                setSelectedTargetId(targetId);
                setActionType(ActionType.Attack);
              }}
              onQuickMove={applyMoveSelection}
              onMoveTileSelect={applyMoveSelection}
              onCancelSelection={() => setSelectedMoveTile(null)}
              onInspectEntity={(entityId) => setInspectEntityId(entityId)}
              playerVisualState={feedback.playerVisualState}
              enemyVisualState={feedback.enemyVisualState}
              floatingText={feedback.floatingText}
              animationTick={state.logs.length}
            />

            <div className="battle-center-controls card">
              <button
                type="button"
                className="confirm-turn-button battle-confirm-large"
                disabled={state.isFinished || enemies.length === 0 || Boolean(actionWarning)}
                title={actionWarning ?? actionHint ?? undefined}
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
