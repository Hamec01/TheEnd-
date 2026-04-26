import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ActionType, CombatSkillType, TargetZone, TeamSide, getItemById, } from '@theend/rpg-domain';
import { useEffect, useMemo, useState } from 'react';
import { sendCombatAction } from '../api';
import { ActionPlanner } from './ActionPlanner';
import { BattleField } from './BattleField';
import { CombatLogPanel } from './CombatLogPanel';
import { FighterCard } from './FighterCard';
function parseZoneFromLogText(text) {
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
export function BattlePanel({ combatId, playerId, state, inventory, selectedSkill, learnedSkills, onSkillChange, onStateChange, onStatus, onClose, resolveItemById, }) {
    const player = useMemo(() => state.entities.find((item) => item.id === playerId), [state, playerId]);
    const enemies = useMemo(() => state.entities.filter((item) => item.team === TeamSide.Right && item.isAlive), [state]);
    const [selectedTargetId, setSelectedTargetId] = useState(enemies[0]?.id ?? '');
    const [actionType, setActionType] = useState(ActionType.Attack);
    const [attackZone, setAttackZone] = useState(TargetZone.Chest);
    const [defenseZones, setDefenseZones] = useState([TargetZone.Chest, TargetZone.Abdomen]);
    const [preferredDistance, setPreferredDistance] = useState(state.distance);
    const [selectedMoveTile, setSelectedMoveTile] = useState(null);
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
    const battleInventoryItems = useMemo(() => inventory.items
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
        .filter(Boolean), [inventory.items, resolveItemById]);
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
    const lastLog = state.logs.at(-1);
    const lastHitZone = useMemo(() => (lastLog ? parseZoneFromLogText(lastLog.text) : null), [lastLog]);
    const selectedEnemy = useMemo(() => enemies.find((enemy) => enemy.id === selectedTargetId) ?? enemies[0] ?? null, [enemies, selectedTargetId]);
    const selectedEnemyPlacement = useMemo(() => state.entities.find((item) => item.id === selectedTargetId), [selectedTargetId, state.entities]);
    const playerPlacement = useMemo(() => state.entities.find((item) => item.id === playerId), [playerId, state.entities]);
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
                playerVisualState: 'idle',
                enemyVisualState: 'idle',
                floatingText: null,
            };
        }
        const playerIsActor = lastLog.actorId === playerId;
        const playerIsTarget = lastLog.targetId === playerId;
        if (lastLog.type === 'HIT') {
            const floatingText = /critical/i.test(lastLog.text)
                ? `CRIT -${lastLog.amount ?? 0}`
                : `-${lastLog.amount ?? 0}`;
            return {
                playerVisualState: playerIsActor ? 'attack' : playerIsTarget ? 'hit' : 'idle',
                enemyVisualState: playerIsActor ? 'hit' : playerIsTarget ? 'attack' : 'idle',
                floatingText,
            };
        }
        if (lastLog.type === 'BLOCK') {
            return {
                playerVisualState: playerIsActor ? 'block' : playerIsTarget ? 'attack' : 'idle',
                enemyVisualState: playerIsActor ? 'attack' : playerIsTarget ? 'block' : 'idle',
                floatingText: 'BLOCK',
            };
        }
        if (lastLog.type === 'MISS') {
            return {
                playerVisualState: playerIsActor ? 'attack' : playerIsTarget ? 'dodge' : 'idle',
                enemyVisualState: playerIsActor ? 'dodge' : playerIsTarget ? 'attack' : 'idle',
                floatingText: 'DODGE',
            };
        }
        return {
            playerVisualState: 'idle',
            enemyVisualState: 'idle',
            floatingText: null,
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
    async function submitRound() {
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
    return (_jsx("div", { className: "battle-fullscreen-root", role: "dialog", "aria-modal": "true", children: _jsxs("div", { className: "battle-fullscreen", children: [_jsxs("div", { className: "battle-header", children: [_jsxs("div", { className: "battle-header-left", children: [_jsx("h2", { children: "Arena Combat" }), _jsxs("span", { children: ["Round ", state.roundNumber] })] }), _jsx("div", { className: "battle-header-center", children: _jsx("span", { children: state.isFinished ? `Battle Over: ${state.winner ?? 'none'} wins` : 'Combat in Progress' }) }), _jsx("div", { className: "battle-header-right", children: _jsx("button", { type: "button", onClick: () => onClose?.(), "aria-label": "Close battle", children: "\u2715" }) })] }), _jsxs("div", { className: "battle-main-grid", children: [_jsxs("div", { className: "battle-left-column battle-column", children: [_jsx("div", { className: "column-player-section", children: _jsx(FighterCard, { fighter: player, highlighted: true, side: "player", visualState: feedback.playerVisualState, floatingText: feedback.floatingText, subtitle: "You" }, `player-${state.logs.length}`) }), _jsx("div", { className: "column-command-section", children: _jsx(ActionPlanner, { enemies: enemies, selectedTargetId: selectedTargetId, actionType: actionType, attackZone: attackZone, defenseZones: defenseZones, currentDistance: state.distance, preferredDistance: preferredDistance, selectedMoveTile: selectedMoveTile, currentStamina: player.currentStamina, maxStamina: player.maxStamina, availableSkills: availableSkills, inventoryItems: battleInventoryItems, selectedSkill: selectedSkill, onActionTypeChange: setActionType, onSkillChange: onSkillChange, onTargetChange: setSelectedTargetId, onAttackZoneChange: setAttackZone, onDefenseZonesChange: setDefenseZones, onPreferredDistanceChange: setPreferredDistance, onSubmit: submitRound, showSubmitButton: false, disabled: state.isFinished || enemies.length === 0 || (actionType === ActionType.Move && !selectedMoveTile), recentHitZone: lastHitZone, recentBlockedZone: recentBlockedZone }) })] }), _jsxs("div", { className: "battle-center-column battle-column", children: [_jsxs("div", { className: "battle-center-log card", children: [_jsx("h3", { children: "Event / Combat Log" }), _jsx(CombatLogPanel, { logs: state.logs })] }), _jsx(BattleField, { entities: state.entities, distance: state.distance, selectedTargetId: selectedTargetId, playerId: playerId, moveSelectionEnabled: actionType === ActionType.Move, selectedMoveTile: selectedMoveTile, onTargetSelect: (targetId) => setSelectedTargetId(targetId), onStatusMessage: onStatus, onQuickAttack: (targetId) => {
                                        setSelectedTargetId(targetId);
                                        setActionType(ActionType.Attack);
                                    }, onQuickMove: (tile) => {
                                        setActionType(ActionType.Move);
                                        setSelectedMoveTile({ x: tile.x, y: tile.y });
                                        setPreferredDistance(tile.distanceBand);
                                    }, onMoveTileSelect: (tile) => {
                                        setSelectedMoveTile({ x: tile.x, y: tile.y });
                                        setPreferredDistance(tile.distanceBand);
                                        onStatus(`Move planned to ${tile.x + 1}:${tile.y + 1}`);
                                    }, onCancelSelection: () => setSelectedMoveTile(null), playerVisualState: feedback.playerVisualState, enemyVisualState: feedback.enemyVisualState, floatingText: feedback.floatingText, animationTick: state.logs.length }), _jsxs("div", { className: "battle-center-controls card", children: [_jsx("button", { type: "button", className: "confirm-turn-button battle-confirm-large", disabled: state.isFinished || enemies.length === 0 || (actionType === ActionType.Move && !selectedMoveTile), onClick: submitRound, children: "\u0421\u0414\u0415\u041B\u0410\u0422\u042C \u0425\u041E\u0414" }), _jsxs("div", { className: "battle-round-summary", children: [_jsx("h4", { children: "Round Summary" }), _jsxs("p", { children: ["Target: ", selectedEnemy?.name ?? 'none'] }), _jsxs("p", { children: ["Action: ", actionType] }), _jsxs("p", { children: ["Attack: ", attackZone] }), _jsxs("p", { children: ["Blocks: ", defenseZones.slice(0, 2).join(', ')] }), _jsxs("p", { children: ["Skill: ", selectedSkill] }), _jsxs("p", { children: ["Move: ", selectedMoveTile ? `${selectedMoveTile.x + 1}:${selectedMoveTile.y + 1}` : 'none'] }), _jsxs("p", { children: ["Cost: ", actionType === ActionType.Attack ? 12 : actionType === ActionType.Defend ? 8 : actionType === ActionType.Move ? 6 : 0, " STA"] }), _jsxs("p", { children: ["Last event: ", lastLog?.text ?? 'none'] })] })] })] }), _jsxs("div", { className: "battle-right-column battle-column", children: [_jsx("div", { className: "column-enemy-section", children: selectedEnemy ? (_jsx(FighterCard, { fighter: selectedEnemy, side: "enemy", visualState: feedback.enemyVisualState, floatingText: feedback.floatingText, subtitle: "Target" }, `enemy-${state.logs.length}`)) : (_jsx("div", { className: "no-enemy-placeholder", children: "No target" })) }), _jsxs("div", { className: "column-log-section card battle-enemy-details", children: [_jsx("div", { className: "combat-log-header", children: _jsx("h3", { children: "Enemy Details" }) }), _jsxs("p", { children: ["Status: ", selectedEnemy?.isAlive ? 'Alive' : 'Down'] }), _jsxs("p", { children: ["Distance: ", targetInRange ? 'Melee range' : 'Out of range'] }), _jsxs("p", { children: ["HP: ", selectedEnemy ? `${selectedEnemy.currentHp}/${selectedEnemy.maxHp}` : '0/0'] }), _jsxs("p", { children: ["MP: ", selectedEnemy ? `${selectedEnemy.currentMp}/${selectedEnemy.maxMp}` : '0/0'] }), _jsxs("p", { children: ["STA: ", selectedEnemy ? `${selectedEnemy.currentStamina}/${selectedEnemy.maxStamina}` : '0/0'] })] })] })] })] }) }));
}
