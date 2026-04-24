import React from 'react';
import type { ItemDefinition } from '@theend/rpg-domain';

interface TradeModalProps {
  isOpen: boolean;
  action: 'buy' | 'sell';
  item: ItemDefinition | null;
  playerGold: number;
  merchantGold?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({
  isOpen,
  action,
  item,
  playerGold,
  merchantGold,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !item) return null;

  const basePrice = 100; // Default price, can be customized per item
  const price = action === 'buy' ? basePrice : Math.floor(basePrice * 0.5);
  const canAfford = playerGold >= price;
  const title = action === 'buy' ? `Buy ${item.name}?` : `Sell ${item.name}?`;

  return (
    <div className="trade-modal" onClick={onCancel}>
      <div className="trade-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="trade-modal-title">{title}</h2>

        <div className="trade-modal-item">
          <span className="trade-modal-item-name">{item.name}</span>
        </div>

        <div className="trade-modal-item">
          <span className="trade-modal-item-name">Price:</span>
          <span className="trade-modal-item-price">{price} 💰</span>
        </div>

        {action === 'buy' ? (
          <div className="trade-modal-gold">
            Your Gold: {playerGold} 💰 {!canAfford && <span style={{ color: '#d06d68' }}>Not enough!</span>}
          </div>
        ) : (
          <div className="trade-modal-gold">
            You will receive: {price} 💰
          </div>
        )}

        <div className="trade-modal-buttons">
          <button
            className="trade-modal-btn confirm"
            onClick={onConfirm}
            disabled={!canAfford && action === 'buy'}
          >
            Confirm
          </button>
          <button className="trade-modal-btn cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
