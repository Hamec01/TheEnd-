import React, { useState, useMemo } from 'react';
import { InventoryGrid } from './InventoryGrid';
import { TradeModal } from './TradeModal';
import { getMerchantItems, getItemById, type Merchant, type InventoryState } from '@theend/rpg-domain';
import type { ItemDefinition } from '@theend/rpg-domain';

interface MerchantPanelProps {
  merchant: Merchant;
  inventory: InventoryState;
  onClose: () => void;
  onBuyItem: (itemId: string) => Promise<void>;
  onSellItem: (itemId: string) => Promise<void>;
}

export const MerchantPanel: React.FC<MerchantPanelProps> = ({
  merchant,
  inventory,
  onClose,
  onBuyItem,
  onSellItem,
}) => {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemDefinition | null>(null);

  const merchantItems = useMemo(() => getMerchantItems(merchant.id), [merchant.id]);
  const inventoryItems = useMemo(
    () => inventory.items.map(entry => getItemById(entry.itemId)).filter(Boolean) as ItemDefinition[],
    [inventory.items]
  );

  const handleBuy = async () => {
    if (selectedItem) {
      try {
        await onBuyItem(selectedItem.id);
        setTradeModalOpen(false);
        setSelectedItem(null);
      } catch (err) {
        console.error('Failed to buy item:', err);
      }
    }
  };

  const handleSell = async () => {
    if (selectedItem) {
      try {
        await onSellItem(selectedItem.id);
        setTradeModalOpen(false);
        setSelectedItem(null);
      } catch (err) {
        console.error('Failed to sell item:', err);
      }
    }
  };

  return (
    <div className="merchant-page" role="dialog" aria-modal="true">
      <section className="card battle-window wm-modal merchant-page-window">
        <div className="battle-window-head merchant-page-head">
          <h2>{merchant.name}</h2>
          <button onClick={onClose}>НАЗАД</button>
        </div>

        <p className="gold" style={{ display: 'inline-flex', marginBottom: '10px' }}>
          🪙 Your Gold: {inventory.gold}
        </p>

        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${mode === 'buy' ? 'is-active' : ''}`}
            onClick={() => setMode('buy')}
            style={{
              padding: '6px 12px',
              border: mode === 'buy' ? '2px solid #d2aa66' : '2px solid #666',
              background: mode === 'buy' ? 'rgba(210, 170, 102, 0.2)' : 'transparent',
              color: '#efe5d1',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            Buy
          </button>
          <button
            className={`btn ${mode === 'sell' ? 'is-active' : ''}`}
            onClick={() => setMode('sell')}
            style={{
              padding: '6px 12px',
              border: mode === 'sell' ? '2px solid #d2aa66' : '2px solid #666',
              background: mode === 'sell' ? 'rgba(210, 170, 102, 0.2)' : 'transparent',
              color: '#efe5d1',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            Sell
          </button>
        </div>

        {mode === 'buy' ? (
          <InventoryGrid
            title={`${merchant.name}'s Wares`}
            items={merchantItems}
            columns={5}
            onItemClick={(item) => {
              setSelectedItem(item);
              setTradeModalOpen(true);
            }}
          />
        ) : (
          <InventoryGrid
            title="Your Items to Sell"
            items={inventoryItems}
            columns={5}
            onItemClick={(item) => {
              setSelectedItem(item);
              setTradeModalOpen(true);
            }}
          />
        )}

        <TradeModal
          isOpen={tradeModalOpen}
          action={mode}
          item={selectedItem}
          playerGold={inventory.gold}
          onConfirm={mode === 'buy' ? handleBuy : handleSell}
          onCancel={() => {
            setTradeModalOpen(false);
            setSelectedItem(null);
          }}
        />
      </section>
    </div>
  );
};
