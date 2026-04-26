import type { Equipment, InventoryState, ItemDefinition, StatBlock } from '@theend/rpg-domain';

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
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveItemImage?: (item: ItemDefinition | null | undefined) => string | undefined;
}

export function PlayerQuickPanel(props: PlayerQuickPanelProps) {
  const { name, avatarLetter, hpText, mpText, staminaText, activeStats, equipment, inventory, quickActions, resolveItemById, resolveItemImage } = props;

  return (
    <aside className="wm-left card">
      <h3>РџРµСЂСЃРѕРЅР°Р¶</h3>

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
        <span className="gold">рџЄ™ {inventory.gold}</span>
        <span>вљ” {activeStats.strength}</span>
        <span>рџ›Ў {activeStats.constitution}</span>
        <span>рџЋЇ {activeStats.perception}</span>
        <span>рџ§  {activeStats.intelligence}</span>
        <span>в {activeStats.luck}</span>
      </div>

      <div className="wm-equipment">
        {Object.entries(equipment).map(([slot, itemId]) => (
          <div key={slot} className="wm-equip-row">
            <span>{slot}</span>
            <strong>{itemId ? (resolveItemById?.(itemId)?.name ?? itemId) : 'Empty'}</strong>
          </div>
        ))}
      </div>

      <h3>РРЅРІРµРЅС‚Р°СЂСЊ</h3>
      <div className="wm-inventory-grid">
        {inventory.items.slice(0, 16).map((entry) => {
          const item = resolveItemById?.(entry.itemId) ?? null;
          const image = resolveItemImage?.(item);
          return (
            <div key={entry.itemId} className="wm-item-cell" title={item?.name ?? entry.itemId}>
              <span
                className={`wm-item-cell-icon${image ? ' has-image' : ''}`}
                style={image ? {
                  backgroundImage: `url("${image}")`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                } : undefined}
              >
                {!image ? (item?.name.slice(0, 2).toUpperCase() ?? entry.itemId.slice(0, 2).toUpperCase()) : null}
              </span>
              <small>{entry.quantity}</small>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
