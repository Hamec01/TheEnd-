import React, { useState, useCallback } from 'react';
import { CombatState, Fighter } from '../api';
import { BattleFieldTactical } from './BattleFieldTactical';
import { FighterListColumn } from './FighterListColumn';
import { ActionPanel, Action } from './ActionPanel';
import { CombatFeedbackArea, FeedbackMessage } from './CombatFeedbackArea';

interface Props {
  combatState: CombatState;
  feedbackMessages: FeedbackMessage[];
  onCombatAction: (actionId: string, targetId: string, targetTile?: [number, number]) => void;
  onRoundEnd: () => void;
}

export const FullScreenBattleLayout: React.FC<Props> = ({
  combatState,
  feedbackMessages,
  onCombatAction,
  onRoundEnd,
}) => {
  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(
    combatState.entities.find(e => e.team === 'LEFT')?.id || null
  );
  const [selectedTile, setSelectedTile] = useState<[number, number] | null>(null);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Get available actions for the selected fighter
  const getAvailableActions = (): Action[] => {
    // This should be populated from the API based on the selected fighter
    return [
      { id: 'basic_attack', name: 'Basic Attack', cost: 1, costType: 'action', icon: '⚔️' },
      { id: 'power_attack', name: 'Power Attack', cost: 2, costType: 'action', icon: '💥' },
      { id: 'defend', name: 'Defend', cost: 1, costType: 'action', icon: '🛡️' },
      { id: 'special_move', name: 'Special Move', cost: 10, costType: 'mana', icon: '✨' },
    ];
  };

  const handleTileClick = useCallback((row: number, col: number) => {
    setSelectedTile([row, col]);
    if (selectedAction) {
      // Execute action on tile
      const selectedFighter = combatState.entities.find((f: Fighter) => f.id === selectedFighterId);
      if (selectedFighter) {
        // Find target at tile if any
        const targetFighter = combatState.entities.find(
          (f: Fighter) => f.battlefieldX === row && f.battlefieldY === col
        );
        onCombatAction(
          selectedAction.id,
          targetFighter?.id || '',
          [row, col]
        );
        setSelectedAction(null);
      }
    }
  }, [selectedAction, selectedFighterId, combatState, onCombatAction]);

  const handleTileRightClick = (row: number, col: number, e: React.MouseEvent) => {
    e.preventDefault();
    const fighter = combatState.entities.find(
      (f: Fighter) => f.battlefieldX === row && f.battlefieldY === col
    );
    if (fighter) {
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  const handleActionSelect = useCallback((action: Action) => {
    setSelectedAction(action);
  }, []);

  const getAvailableResources = () => {
    const selectedFighter = combatState.entities.find((f: Fighter) => f.id === selectedFighterId);
    return {
      mana: selectedFighter?.currentMp || 0,
      stamina: selectedFighter?.currentStamina || 0,
      actions: 3, // Placeholder
    };
  };

  return (
    <div className="battle-layout fullscreen-battle">
      {/* Left Column: Allies */}
      <FighterListColumn
        fighters={combatState.entities.filter((f: Fighter) => f.team === 'LEFT')}
        selectedFighterId={selectedFighterId}
        onFighterSelect={setSelectedFighterId}
        isEnemySide={false}
      />

      {/* Center Column: Tactical Field */}
      <div className="battle-center-column">
        <BattleFieldTactical
          combatState={combatState}
          selectedTile={selectedTile}
          onTileClick={handleTileClick}
          onTileRightClick={handleTileRightClick}
        />

        <CombatFeedbackArea messages={feedbackMessages} />

        <button
          onClick={onRoundEnd}
          style={{
            padding: '10px 20px',
            fontSize: '1rem',
            minHeight: '42px',
            alignSelf: 'center',
          }}
        >
          End Turn
        </button>
      </div>

      {/* Right Column: Enemies */}
      <FighterListColumn
        fighters={combatState.entities.filter((f: Fighter) => f.team === 'RIGHT')}
        selectedFighterId={null}
        onFighterSelect={() => {}}
        isEnemySide={true}
      />

      {/* Action Panel (Right Column) - Overlays or below */}
      <div style={{ position: 'absolute', bottom: '12px', right: '12px', width: '280px' }}>
        <ActionPanel
          actions={getAvailableActions()}
          onActionSelect={handleActionSelect}
          availableResources={getAvailableResources()}
        />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

const ContextMenu: React.FC<{ x: number; y: number; onClose: () => void }> = ({
  x,
  y,
  onClose,
}) => {
  return (
    <div
      className="context-menu"
      style={{ left: `${x}px`, top: `${y}px` }}
      onMouseLeave={onClose}
    >
      <div className="context-menu-item">
        <span className="context-menu-icon">❌</span>
        Cancel
      </div>
    </div>
  );
};
