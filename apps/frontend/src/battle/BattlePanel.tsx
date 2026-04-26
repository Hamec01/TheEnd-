import {
  ActionType,
  CombatSkillType,
  DistanceBand,
  TargetZone,
  TeamSide,
  getItemById,
  type ItemDefinition,
  type ArenaBattleState,
  type InventoryState,
} from '@theend/rpg-domain';
import { useEffect, useMemo, useState } from 'react';
import { sendCombatAction } from '../api';
import { ActionPlanner } from './ActionPlanner';
import { BattleField } from './BattleField';
import { CombatLogPanel } from './CombatLogPanel';
import { FighterCard } from './FighterCard';

interface BattlePanelProps {
  combatId: string;
  playerId: string;
  state: ArenaBattleState;
  inventory: InventoryState;
  selectedSkill: CombatSkillType;
  learnedSkills: CombatSkillType[];
  onSkillChange: (skill: CombatSkillType) => void;
  onStateChange: (next: ArenaBattleState) => void;
  onStatus: (text: string) => void;
  onClose?: () => void;
  resolveItemById?: (itemId: string) => ItemDefinition | null;
}

function parseZoneFromLogText(text: string): TargetZone | null {
  const match = text.match(/in\s+([A-Z_]+)/i);
  const token = match?.[1]?.toUpperCase();
  if (!token) {
    return null;
  }
  if (token === 'HEAD') {
    return TargetZone.Head;
  }
  if (token === 'CHEST') {
    return TargetZone.Chest;
  }
  if (token === 'ABDOMEN') {
    return TargetZone.Abdomen;
  }
  if (token === 'LEFT_ARM') {
    return TargetZone.LeftArm;
  }
  if (token === 'RIGHT_ARM') {
    return TargetZone.RightArm;
  }
  if (token === 'LEGS') {
    return TargetZone.Legs;
  }
  if (token === 'H') {
    return TargetZone.Head;
  }
  if (token === 'C') {
    return TargetZone.Chest;
  }
  if (token === 'A') {
    return TargetZone.Abdomen;
  }
  if (token === 'LA') {
    return TargetZone.LeftArm;
  }
  if (token === 'RA') {
    return TargetZone.RightArm;
  }
  if (token === 'L') {
    return TargetZone.Legs;
  }
  return null;
}

export function BattlePanel({
  combatId,
  playerId,
  state,
  inventory,
  selectedSkill,
  learnedSkills,
  onSkillChange,
  onStateChange,
  onStatus,
  onClose,
  resolveItemById,
}: BattlePanelProps) {
  const player = useMemo(() => state.entities.find((item) => item.id === playerId), [state, playerId]);
  const enemies = useMemo(
    () => state.entities.filter((item) => item.team === TeamSide.Right && item.isAlive),
    [state],
  );

  const [selectedTargetId, setSelectedTargetId] = useState(enemies[0]?.id ?? '');
  const [actionType, setActionType] = useState<ActionType>(ActionType.Attack);
  const [attackZone, setAttackZone] = useState(TargetZone.Chest);
  const [defenseZones, setDefenseZones] = useState<TargetZone[]>([TargetZone.Chest, TargetZone.Abdomen]);
  const [preferredDistance, setPreferredDistance] = useState<DistanceBand>(state.distance);
  const [selectedMoveTile, setSelectedMoveTile] = useState<{ x: number; y: number } | null>(null);

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

  const battleRewardSummary = useMemo(() => {
    const expGain = state.logs.reduce((sum, entry) => {
      const match = entry.text.match(/Battle reward:\s*\+(\d+)\s+EXP/i);
      return sum + (match ? Number(match[1]) : 0);
    }, 0);

    const goldGain = state.logs.reduce((sum, entry) => {
      const match = entry.text.match(/Battle reward:\s*\+(\d+)\s+gold/i);
      return sum + (match ? Number(match[1]) : 0);
    }, 0);

    const lootItems = state.logs
      .map((entry) => entry.text.match(/Battle reward:\s*loot\s+(.+)/i)?.[1])
      .filter((value): value is string => Boolean(value));

    return {
      expGain,
      goldGain,
      lootText: lootItems.length > 0 ? lootItems.join(', ') : 'none',
    };
  }, [state.logs]);

  const lastLog = state.logs.at(-1);
  const lastHitZone = useMemo(() => (lastLog ? parseZoneFromLogText(lastLog.text) : null), [lastLog]);
  const selectedEnemy = useMemo(
    () => enemies.find((enemy) => enemy.id === selectedTargetId) ?? enemies[0] ?? null,
    [enemies, selectedTargetId],
  );
  const selectedEnemyPlacement = useMemo(
    () => state.entities.find((item) => item.id === selectedTargetId),
    [selectedTargetId, state.entities],
  );
  const playerPlacement = useMemo(
    () => state.entities.find((item) => item.id === playerId),
    [playerId, state.entities],
  );
  const targetInRange = useMemo(() => {
    if (!playerPlacement || !selectedEnemyPlacement) {
      return false;
    }

    const px = playerPlacement.battlefieldX ?? 0;
    const py = playerPlacement.battlefieldY ?? 0;
    const ex = selectedEnemyPlacement.battlefieldX ?? 0;
    const ey = selectedEnemyPlacement.battlefieldY ?? 0;
    return Math.abs(px - ex) + Math.abs(py - ey) <= 1;
  }, [playerPlacement, selectedEnemyPlacement]);

  const feedback = useMemo(() => {
    if (!lastLog) {
      return {
        playerVisualState: 'idle' as const,
        enemyVisualState: 'idle' as const,
        floatingText: null as string | null,
      };
    }

    const playerIsActor = lastLog.actorId === playerId;
    const playerIsTarget = lastLog.targetId === playerId;

    if (lastLog.type === 'HIT') {
      const floatingText = /critical/i.test(lastLog.text)
        ? `CRIT -${lastLog.amount ?? 0}`
        : `-${lastLog.amount ?? 0}`;
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

    return {
      playerVisualState: 'idle' as const,
      enemyVisualState: 'idle' as const,
      floatingText: null as string | null,
    };
  }, [lastLog, playerId]);

  const recentBlockedZone = useMemo(() => {
    if (!lastLog || lastLog.type !== 'BLOCK') {
      return null;
    }

    return defenseZones[0] ?? null;
  }, [defenseZones, lastLog]);

  useEffect(() => {
    if (!enemies.some((enemy) => enemy.id === selectedTargetId)) {
      setSelectedTargetId(enemies[0]?.id ?? '');
    }
  }, [enemies, selectedTargetId]);

  useEffect(() => {
    setPreferredDistance(state.distance);
  }, [state.distance]);

  useEffect(() => {
    if (actionType !== ActionType.Move) {
      setSelectedMoveTile(null);
    }
  }, [actionType]);

  async function submitRound(): Promise<void> {
    if (!player || !selectedTargetId || (actionType === ActionType.Move && !selectedMoveTile)) {
      return;
    }

    try {
      if (actionType === ActionType.Attack && !targetInRange) {
        onStatus('Target out of range. Select move or use Move closer.');
        return;
      }

      const nextState = await sendCombatAction({
        combatId,
        actorId: player.id,
        targetId: selectedTargetId,
        attackZone,
        defenseZones,
        attackPointsSpent: 0,
        defensePointsSpent: 0,
        actionType,
        preferredDistance: actionType === ActionType.Move ? preferredDistance : undefined,
        destinationX: actionType === ActionType.Move ? selectedMoveTile?.x : undefined,
        destinationY: actionType === ActionType.Move ? selectedMoveTile?.y : undefined,
        skillType: actionType === ActionType.Attack ? selectedSkill : undefined,
      });

      onStateChange(nextState);

      if (nextState.isFinished) {
        onStatus(`Battle finished. Winner: ${nextState.winner ?? 'none'}.`);
      } else {
        onStatus(`Round ${nextState.roundNumber} resolved.`);
      }
    } catch (error) {
      onStatus(`Round error: ${(error as Error).message}`);
    }
  }

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
                preferredDistance={preferredDistance}
                selectedMoveTile={selectedMoveTile}
                currentStamina={player.currentStamina}
                maxStamina={player.maxStamina}
                availableSkills={availableSkills}
                inventoryItems={battleInventoryItems}
                selectedSkill={selectedSkill}
                onActionTypeChange={setActionType}
                onSkillChange={onSkillChange}
                onTargetChange={setSelectedTargetId}
                onAttackZoneChange={setAttackZone}
                onDefenseZonesChange={setDefenseZones}
                onPreferredDistanceChange={setPreferredDistance}
                onSubmit={submitRound}
                showSubmitButton={false}
                disabled={state.isFinished || enemies.length === 0 || (actionType === ActionType.Move && !selectedMoveTile)}
                recentHitZone={lastHitZone}
                recentBlockedZone={recentBlockedZone}
              />
            </div>
          </div>

          <div className="battle-center-column battle-column">
            <div className="battle-center-log card">
              <h3>Event / Combat Log</h3>
              <CombatLogPanel logs={state.logs} />
            </div>

            <BattleField
              entities={state.entities}
              distance={state.distance}
              selectedTargetId={selectedTargetId}
              playerId={playerId}
              moveSelectionEnabled={actionType === ActionType.Move}
              selectedMoveTile={selectedMoveTile}
              onTargetSelect={(targetId) => setSelectedTargetId(targetId)}
              onStatusMessage={onStatus}
              onQuickAttack={(targetId) => {
                setSelectedTargetId(targetId);
                setActionType(ActionType.Attack);
              }}
              onQuickMove={(tile) => {
                setActionType(ActionType.Move);
                setSelectedMoveTile({ x: tile.x, y: tile.y });
                setPreferredDistance(tile.distanceBand);
              }}
              onMoveTileSelect={(tile) => {
                setSelectedMoveTile({ x: tile.x, y: tile.y });
                setPreferredDistance(tile.distanceBand);
                onStatus(`Move planned to ${tile.x + 1}:${tile.y + 1}`);
              }}
              onCancelSelection={() => setSelectedMoveTile(null)}
              playerVisualState={feedback.playerVisualState}
              enemyVisualState={feedback.enemyVisualState}
              floatingText={feedback.floatingText}
              animationTick={state.logs.length}
            />

            <div className="battle-center-controls card">
              <button
                type="button"
                className="confirm-turn-button battle-confirm-large"
                disabled={state.isFinished || enemies.length === 0 || (actionType === ActionType.Move && !selectedMoveTile)}
                onClick={submitRound}
              >
                СДЕЛАТЬ ХОД
              </button>

              <div className="battle-round-summary">
                <h4>Round Summary</h4>
                <p>Target: {selectedEnemy?.name ?? 'none'}</p>
                <p>Action: {actionType}</p>
                <p>Attack: {attackZone}</p>
                <p>Blocks: {defenseZones.slice(0, 2).join(', ')}</p>
                <p>Skill: {selectedSkill}</p>
                <p>Move: {selectedMoveTile ? `${selectedMoveTile.x + 1}:${selectedMoveTile.y + 1}` : 'none'}</p>
                <p>Cost: {actionType === ActionType.Attack ? 12 : actionType === ActionType.Defend ? 8 : actionType === ActionType.Move ? 6 : 0} STA</p>
                <p>Last event: {lastLog?.text ?? 'none'}</p>
              </div>
            </div>
          </div>

          <div className="battle-right-column battle-column">
            <div className="column-enemy-section">
              {selectedEnemy ? (
                <FighterCard
                  key={`enemy-${state.logs.length}`}
                  fighter={selectedEnemy}
                  side="enemy"
                  visualState={feedback.enemyVisualState}
                  floatingText={feedback.floatingText}
                  subtitle="Target"
                />
              ) : (
                <div className="no-enemy-placeholder">No target</div>
              )}
            </div>

            <div className="column-log-section card battle-enemy-details">
              <div className="combat-log-header">
                <h3>Enemy Details</h3>
              </div>
              <p>Status: {selectedEnemy?.isAlive ? 'Alive' : 'Down'}</p>
              <p>Distance: {targetInRange ? 'Melee range' : 'Out of range'}</p>
              <p>HP: {selectedEnemy ? `${selectedEnemy.currentHp}/${selectedEnemy.maxHp}` : '0/0'}</p>
              <p>MP: {selectedEnemy ? `${selectedEnemy.currentMp}/${selectedEnemy.maxMp}` : '0/0'}</p>
              <p>STA: {selectedEnemy ? `${selectedEnemy.currentStamina}/${selectedEnemy.maxStamina}` : '0/0'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
