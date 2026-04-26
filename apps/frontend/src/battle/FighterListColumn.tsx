import React from 'react';
import { Fighter } from '../api';

interface Props {
  fighters: Fighter[];
  selectedFighterId: string | null;
  onFighterSelect: (fighterId: string) => void;
  isEnemySide?: boolean;
}

export const FighterListColumn: React.FC<Props> = ({
  fighters,
  selectedFighterId,
  onFighterSelect,
  isEnemySide = false,
}) => {
  const getHealthPercentage = (current: number, max: number): number => {
    return Math.max(0, Math.min(100, (current / max) * 100));
  };

  const getManaPercentage = (current: number, max: number): number => {
    return Math.max(0, Math.min(100, (current / max) * 100));
  };

  return (
    <div className={`battle-${isEnemySide ? 'right' : 'left'}-column`}>
      <div className="battle-column-header">
        <h3>{isEnemySide ? 'Enemies' : 'Allies'}</h3>
        <div className="round-info">{fighters.length} active</div>
      </div>

      <div className="fighter-list-container">
        {fighters.map((fighter) => (
          <div
            key={fighter.id}
            className={`fullscreen-fighter-card ${selectedFighterId === fighter.id ? 'is-selected' : ''} ${fighter.currentHp <= 0 ? 'is-dead' : ''}`}
            onClick={() => onFighterSelect(fighter.id)}
          >
            <div className="fullscreen-fighter-avatar">
              {fighter.name.charAt(0).toUpperCase()}
            </div>

            <div className="fullscreen-fighter-info">
              <div className="fullscreen-fighter-name">
                <strong>{fighter.name}</strong>
                <span className={`state-badge ${fighter.currentHp > 0 ? 'alive' : 'dead'}`}>
                  {fighter.currentHp > 0 ? 'Alive' : 'Dead'}
                </span>
              </div>

              <div className="fullscreen-fighter-bars">
                <div className="fullscreen-bar-row">
                  <div className="fullscreen-bar-label">
                    <span>HP</span>
                    <span>{fighter.currentHp} / {fighter.maxHp}</span>
                  </div>
                  <div className="fullscreen-meter hp">
                    <span style={{ width: `${getHealthPercentage(fighter.currentHp, fighter.maxHp)}%` }} />
                  </div>
                </div>

                {fighter.currentMp > 0 && (
                  <div className="fullscreen-bar-row">
                    <div className="fullscreen-bar-label">
                      <span>Mana</span>
                      <span>{fighter.currentMp} / {fighter.maxMp || 0}</span>
                    </div>
                    <div className="fullscreen-meter mana">
                      <span style={{ width: `${getManaPercentage(fighter.currentMp, fighter.maxMp || 1)}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {fighters.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No fighters active
        </div>
      )}
    </div>
  );
};
