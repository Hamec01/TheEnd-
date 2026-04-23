import { ActionType, CombatSkillType, DistanceBand, TargetZone, TeamSide, getBattlefieldTilePlacements, type ArenaBattleState } from '@theend/rpg-domain';
import { useEffect, useMemo, useState } from 'react';
import { sendCombatAction } from '../api';
import { ActionPlanner } from './ActionPlanner';
import { BattleField, splitTeams } from './BattleField';
import { CombatLogPanel } from './CombatLogPanel';
import { FighterCard } from './FighterCard';

interface BattlePanelProps {
  combatId: string;
  playerId: string;
  state: ArenaBattleState;
  selectedSkill: CombatSkillType;
  learnedSkills: CombatSkillType[];
  onSkillChange: (skill: CombatSkillType) => void;
  onStateChange: (next: ArenaBattleState) => void;
  onStatus: (text: string) => void;
}

export function BattlePanel({
  combatId,
  playerId,
  state,
  selectedSkill,
  learnedSkills,
  onSkillChange,
  onStateChange,
  onStatus,
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

  const teams = splitTeams(state.entities);
  const placements = useMemo(() => getBattlefieldTilePlacements(state.entities, state.distance), [state.distance, state.entities]);
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
    <div className="battle-layout">
      <div className="battle-round-head">
        <h3>Round {state.roundNumber}</h3>
        <span>{state.isFinished ? `Winner: ${state.winner ?? 'none'}` : 'Fight in progress'}</span>
      </div>

      {state.isFinished ? (
        <div className="battle-reward-summary">
          <strong>Итог боя:</strong>
          <span>+EXP: {battleRewardSummary.expGain}</span>
          <span>+Gold: {battleRewardSummary.goldGain}</span>
          <span>Loot: {battleRewardSummary.lootText}</span>
        </div>
      ) : null}

      <div className="battle-overview-grid">
        <section className="inner-card battle-roster-panel">
          <h3>Allies</h3>
          <div className="fighter-list">
            {teams.leftTeam.map((fighter) => (
              <FighterCard key={fighter.id} fighter={fighter} highlighted={fighter.id === playerId} />
            ))}
          </div>
        </section>

        <section className="inner-card battle-board-panel">
          <BattleField
            entities={state.entities}
            distance={state.distance}
            selectedTargetId={selectedTargetId}
            moveSelectionEnabled={actionType === ActionType.Move}
            selectedMoveTile={selectedMoveTile}
            onMoveTileSelect={(tile) => {
              setSelectedMoveTile({ x: tile.x, y: tile.y });
              setPreferredDistance(tile.distanceBand);
              onStatus(`Move target: ${tile.x + 1}:${tile.y + 1} (${tile.distanceBand})`);
            }}
          />
        </section>

        <section className="inner-card battle-roster-panel">
          <h3>Enemies</h3>
          <div className="fighter-list">
            {teams.rightTeam.map((fighter) => (
              <FighterCard key={fighter.id} fighter={fighter} highlighted={fighter.id === selectedTargetId} />
            ))}
          </div>
        </section>
      </div>

      <div className="battle-controls-grid">
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
          selectedSkill={selectedSkill}
          onActionTypeChange={setActionType}
          onSkillChange={onSkillChange}
          onTargetChange={setSelectedTargetId}
          onAttackZoneChange={setAttackZone}
          onDefenseZonesChange={setDefenseZones}
          onPreferredDistanceChange={setPreferredDistance}
          onSubmit={submitRound}
          disabled={state.isFinished || enemies.length === 0 || (actionType === ActionType.Move && !selectedMoveTile)}
        />

        <CombatLogPanel logs={state.logs} />
      </div>
    </div>
  );
}
