import { getItemById, type Equipment, type InventoryState, type StatBlock } from '@theend/rpg-domain';

interface QuickActionButton {
  id: string;
  tone: 'red' | 'blue' | 'yellow';
  icon: string;
  title: string;
  badge?: number;
  onClick: () => void;
}

interface PlayerQuickPanelProps {
  name: string;
  avatarLetter: string;
  hpText: string;
  mpText: string;
  staminaText: string;
  activeStats: StatBlock;
  equipment: Equipment;
  inventory: InventoryState;
  quickActions: QuickActionButton[];
}

export function PlayerQuickPanel(props: PlayerQuickPanelProps) {
  const { name, avatarLetter, hpText, mpText, staminaText, activeStats, equipment, inventory, quickActions } = props;

  return (
    <aside className="wm-left card">
      <h3>Персонаж</h3>

      <div className="wm-avatar-wrap" title={`${name} status`}>
        <button className="wm-avatar" title={`Name: ${name}`}>
          {avatarLetter}
        </button>

        <div className="wm-orbs">
          <span><i className="wm-orb hp" />{hpText}</span>
          <span><i className="wm-orb mp" />{mpText}</span>
          <span><i className="wm-orb sta" />{staminaText}</span>
        </div>

        <div className="wm-quick-actions">
          {quickActions.map((action) => (
            <button
              key={action.id}
              className={`wm-quick-btn ${action.tone}`}
              onClick={action.onClick}
              title={action.title}
            >
              <span>{action.icon}</span>
              {action.badge ? <b>{action.badge}</b> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="wm-mini-stats">
        <span className="gold">🪙 {inventory.gold}</span>
        <span>⚔ {activeStats.strength}</span>
        <span>🛡 {activeStats.constitution}</span>
        <span>🎯 {activeStats.perception}</span>
        <span>🧠 {activeStats.intelligence}</span>
        <span>☘ {activeStats.luck}</span>
      </div>

      <div className="wm-equipment">
        {Object.entries(equipment).map(([slot, itemId]) => (
          <div key={slot} className="wm-equip-row">
            <span>{slot}</span>
            <strong>{itemId ? getItemById(itemId).name : 'Empty'}</strong>
          </div>
        ))}
      </div>

      <h3>Инвентарь</h3>
      <div className="wm-inventory-grid">
        {inventory.items.slice(0, 16).map((entry) => (
          <div key={entry.itemId} className="wm-item-cell" title={getItemById(entry.itemId).name}>
            <span>{getItemById(entry.itemId).name.slice(0, 2).toUpperCase()}</span>
            <small>{entry.quantity}</small>
          </div>
        ))}
      </div>
    </aside>
  );
}
