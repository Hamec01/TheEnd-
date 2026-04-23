import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ActionType, CombatSkillType, TargetZone, TeamSide, getBattlefieldTilePlacements } from '@theend/rpg-domain';
import { useEffect, useMemo, useState } from 'react';
import { sendCombatAction } from '../api';
import { ActionPlanner } from './ActionPlanner';
import { BattleField, splitTeams } from './BattleField';
import { CombatLogPanel } from './CombatLogPanel';
import { FighterCard } from './FighterCard';
export function BattlePanel({ combatId, playerId, state, selectedSkill, learnedSkills, onSkillChange, onStateChange, onStatus, }) {
    const player = useMemo(() => state.entities.find((item) => item.id === playerId), [state, playerId]);
    const enemies = useMemo(() => state.entities.filter((item) => item.team === TeamSide.Right && item.isAlive), [state]);
    const [selectedTargetId, setSelectedTargetId] = useState(enemies[0]?.id ?? '');
    const [actionType, setActionType] = useState(ActionType.Attack);
    const [attackZone, setAttackZone] = useState(TargetZone.Chest);
    const [defenseZones, setDefenseZones] = useState([TargetZone.Chest, TargetZone.Abdomen]);
    const [preferredDistance, setPreferredDistance] = useState(state.distance);
    const [selectedMoveTile, setSelectedMoveTile] = useState(null);
    const teams = splitTeams(state.entities);
    const placements = useMemo(() => getBattlefieldTilePlacements(state.entities, state.distance), [state.distance, state.entities]);
    const availableSkills = useMemo(() => [
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
    ], [learnedSkills]);
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
            .filter((value) => Boolean(value));
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
    async function submitRound() {
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
            }
            else {
                onStatus(`Round ${nextState.roundNumber} resolved.`);
            }
        }
        catch (error) {
            onStatus(`Round error: ${error.message}`);
        }
    }
    if (!player) {
        return _jsx("p", { children: "Player entity not found." });
    }
    return (_jsxs("div", { className: "battle-layout", children: [_jsxs("div", { className: "battle-round-head", children: [_jsxs("h3", { children: ["Round ", state.roundNumber] }), _jsx("span", { children: state.isFinished ? `Winner: ${state.winner ?? 'none'}` : 'Fight in progress' })] }), state.isFinished ? (_jsxs("div", { className: "battle-reward-summary", children: [_jsx("strong", { children: "\u0418\u0442\u043E\u0433 \u0431\u043E\u044F:" }), _jsxs("span", { children: ["+EXP: ", battleRewardSummary.expGain] }), _jsxs("span", { children: ["+Gold: ", battleRewardSummary.goldGain] }), _jsxs("span", { children: ["Loot: ", battleRewardSummary.lootText] })] })) : null, _jsxs("div", { className: "battle-overview-grid", children: [_jsxs("section", { className: "inner-card battle-roster-panel", children: [_jsx("h3", { children: "Allies" }), _jsx("div", { className: "fighter-list", children: teams.leftTeam.map((fighter) => (_jsx(FighterCard, { fighter: fighter, highlighted: fighter.id === playerId }, fighter.id))) })] }), _jsx("section", { className: "inner-card battle-board-panel", children: _jsx(BattleField, { entities: state.entities, distance: state.distance, selectedTargetId: selectedTargetId, moveSelectionEnabled: actionType === ActionType.Move, selectedMoveTile: selectedMoveTile, onMoveTileSelect: (tile) => {
                                setSelectedMoveTile({ x: tile.x, y: tile.y });
                                setPreferredDistance(tile.distanceBand);
                                onStatus(`Move target: ${tile.x + 1}:${tile.y + 1} (${tile.distanceBand})`);
                            } }) }), _jsxs("section", { className: "inner-card battle-roster-panel", children: [_jsx("h3", { children: "Enemies" }), _jsx("div", { className: "fighter-list", children: teams.rightTeam.map((fighter) => (_jsx(FighterCard, { fighter: fighter, highlighted: fighter.id === selectedTargetId }, fighter.id))) })] })] }), _jsxs("div", { className: "battle-controls-grid", children: [_jsx(ActionPlanner, { enemies: enemies, selectedTargetId: selectedTargetId, actionType: actionType, attackZone: attackZone, defenseZones: defenseZones, currentDistance: state.distance, preferredDistance: preferredDistance, selectedMoveTile: selectedMoveTile, currentStamina: player.currentStamina, maxStamina: player.maxStamina, availableSkills: availableSkills, selectedSkill: selectedSkill, onActionTypeChange: setActionType, onSkillChange: onSkillChange, onTargetChange: setSelectedTargetId, onAttackZoneChange: setAttackZone, onDefenseZonesChange: setDefenseZones, onPreferredDistanceChange: setPreferredDistance, onSubmit: submitRound, disabled: state.isFinished || enemies.length === 0 || (actionType === ActionType.Move && !selectedMoveTile) }), _jsx(CombatLogPanel, { logs: state.logs })] })] }));
}
