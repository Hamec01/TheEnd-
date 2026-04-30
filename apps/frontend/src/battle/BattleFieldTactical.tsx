import React from 'react';
import { CombatState, Fighter } from '../api';

interface Props {
  combatState: CombatState;
  selectedTile: [number, number] | null;
  onTileClick: (row: number, col: number) => void;
  onTileRightClick: (row: number, col: number, e: React.MouseEvent) => void;
}

export const BattleFieldTactical: React.FC<Props> = ({
  combatState,
  selectedTile,
  onTileClick,
  onTileRightClick,
}) => {
  const GRID_SIZE = 8;

  // Helper to get fighter at position
  const getFighterAt = (row: number, col: number): Fighter | null => {
    const allFighters = [...combatState.entities];
    return allFighters.find((f: Fighter) => f.battlefieldX === row && f.battlefieldY === col) || null;
  };

  // Helper to determine tile class
  const getTileClass = (row: number, col: number): string => {
    const classes = ['tactical-tile'];
    const fighter = getFighterAt(row, col);

    if (!fighter) {
      classes.push('tactical-tile.empty');
      return classes.join(' ');
    }

    if (combatState.entities.some((a: Fighter) => a.id === fighter.id && a.team === 'LEFT')) {
      classes.push('ally');
    } else {
      classes.push('enemy');
    }

    if (selectedTile && selectedTile[0] === row && selectedTile[1] === col) {
      classes.push('selected');
    }

    return classes.join(' ');
  };

  const getTileContent = (row: number, col: number): string => {
    const fighter = getFighterAt(row, col);
    return fighter ? fighter.name.charAt(0).toUpperCase() : '';
  };

  return (
    <div className="tactical-field">
      <div className="tactical-header">
        <h4>Tactical Battlefield</h4>
        <div className="distance-info">
          {/* Distance info will be added here */}
        </div>
      </div>

      <div className="tactical-grid">
        {Array.from({ length: GRID_SIZE }).map((_, row) =>
          Array.from({ length: GRID_SIZE }).map((_, col) => (
            <button
              key={`${row}-${col}`}
              className={getTileClass(row, col)}
              onClick={() => onTileClick(row, col)}
              onContextMenu={(e) => onTileRightClick(row, col, e)}
            >
              {getTileContent(row, col)}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
