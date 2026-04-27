import React from 'react';
import type { ItemDefinition } from '@theend/rpg-domain';

interface TradeModalProps {
  isOpen: boolean;
  action: 'buy' | 'sell';
  item: ItemDefinition | null;
  playerGold: number;
  price?: number;
  merchantGold?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({
  isOpen,
  action,
  item,
  playerGold,
  price,
  merchantGold,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !item) return null;

  const resolvedPrice = typeof price === 'number'
    ? price
    : action === 'buy'
      ? item.price
      : Math.max(1, Math.floor(item.price * 0.6));
  const canAfford = playerGold >= resolvedPrice;
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
          <span className="trade-modal-item-price">{resolvedPrice} gold</span>
        </div>

        {action === 'buy' ? (
          <div className="trade-modal-gold">
            Your Gold: {playerGold} {!canAfford && <span style={{ color: '#d06d68' }}>Not enough!</span>}
          </div>
        ) : (
          <div className="trade-modal-gold">
            You will receive: {resolvedPrice} gold
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
