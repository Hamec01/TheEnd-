import React, { useState } from 'react';

export interface Action {
  id: string;
  name: string;
  cost: number;
  costType: 'mana' | 'stamina' | 'action';
  icon: string;
}

interface Props {
  actions: Action[];
  onActionSelect: (action: Action) => void;
  isDisabled?: boolean;
  availableResources?: {
    mana?: number;
    stamina?: number;
    actions?: number;
  };
}

export const ActionPanel: React.FC<Props> = ({
  actions,
  onActionSelect,
  isDisabled = false,
  availableResources = {},
}) => {
  const [activeTab, setActiveTab] = useState<'attack' | 'defense' | 'skill'>('attack');

  const canUseAction = (action: Action): boolean => {
    if (!availableResources) return true;

    const resourceKey = action.costType === 'action' ? 'actions' : action.costType;
    const resource = availableResources[resourceKey];
    return resource !== undefined ? resource >= action.cost : true;
  };

  const filterActionsByTab = (): Action[] => {
    const tabMap = {
      attack: ['basic_attack', 'power_attack', 'slash'],
      defense: ['defend', 'parry', 'dodge'],
      skill: ['special_move', 'ultimate', 'buff'],
    };

    return actions.filter((a) => {
      const prefix = a.id.split('_')[0];
      return tabMap[activeTab]?.includes(prefix) || activeTab === 'attack';
    });
  };

  const filteredActions = filterActionsByTab();

  return (
    <div className="action-panel" style={{ visibility: isDisabled ? 'hidden' : 'visible' }}>
      <div className="action-panel-header">
        <h4>Actions</h4>
      </div>

      <div className="action-tabs">
        <button
          className={`action-tab-button ${activeTab === 'attack' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('attack')}
        >
          ⚔️ Attack
        </button>
        <button
          className={`action-tab-button ${activeTab === 'defense' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('defense')}
        >
          🛡️ Defense
        </button>
        <button
          className={`action-tab-button ${activeTab === 'skill' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('skill')}
        >
          ✨ Skill
        </button>
      </div>

      <div className="action-list">
        {filteredActions.map((action) => {
          const isDisabledAction = !canUseAction(action);

          return (
            <button
              key={action.id}
              className={`action-item ${isDisabledAction ? 'is-disabled' : ''}`}
              onClick={() => !isDisabledAction && onActionSelect(action)}
              disabled={isDisabledAction}
            >
              <div className="action-item-name">
                <strong>{action.name}</strong>
                <span className="action-item-cost">
                  {action.cost} {action.costType}
                </span>
              </div>
              <div className="action-item-icon">{action.icon}</div>
            </button>
          );
        })}
      </div>

      {filteredActions.length === 0 && (
        <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          No actions available
        </div>
      )}
    </div>
  );
};
