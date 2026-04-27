import React, { useMemo, useState } from 'react';
import { getItemById, getMerchantItems, type Equipment, type InventoryState, type Merchant } from '@theend/rpg-domain';
import type { ItemDefinition } from '@theend/rpg-domain';
import type { AdminItem } from '../services/content/models';
import { InventoryGrid } from './InventoryGrid';
import { TradeModal } from './TradeModal';

interface MerchantPanelProps {
  merchant: Merchant;
  inventory: InventoryState;
  equipment: Equipment;
  merchantItems?: ItemDefinition[];
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveAdminItemById?: (itemId: string) => AdminItem | null;
  resolveItemImage?: (item: ItemDefinition) => string | undefined;
  merchantDescription?: string;
  merchantLocation?: string;
  merchantPortrait?: string;
  onClose: () => void;
  onBuyItem: (itemId: string, merchantId: string) => Promise<void>;
  onSellItem: (itemId: string) => Promise<void>;
}

export const MerchantPanel: React.FC<MerchantPanelProps> = ({
  merchant,
  inventory,
  equipment,
  merchantItems: merchantItemsOverride,
  resolveItemById,
  resolveAdminItemById,
  resolveItemImage,
  merchantDescription,
  merchantLocation,
  merchantPortrait,
  onClose,
  onBuyItem,
  onSellItem,
}) => {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemDefinition | null>(null);
  const merchantInitial = merchant.name.trim().charAt(0).toUpperCase() || 'Т';

  const merchantItems = useMemo(
    () => merchantItemsOverride ?? getMerchantItems(merchant.id),
    [merchant.id, merchantItemsOverride],
  );
  const inventoryItems = useMemo(
    () => inventory.items
      .map((entry) => (resolveItemById ? resolveItemById(entry.itemId) : getItemById(entry.itemId)))
      .filter(Boolean) as ItemDefinition[],
    [inventory.items, resolveItemById],
  );
  const selectedAdminItem = useMemo(
    () => (selectedItem && resolveAdminItemById ? resolveAdminItemById(selectedItem.id) : null),
    [resolveAdminItemById, selectedItem],
  );
  const equippedItemIdForSelected = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    switch (selectedItem.itemType) {
      case 'weapon':
        return equipment.weapon;
      case 'helmet':
        return equipment.helmet;
      case 'armor':
        return equipment.armor;
      case 'boots':
        return equipment.boots;
      case 'gloves':
        return equipment.gloves;
      case 'shield':
        return equipment.shield;
      default:
        return null;
    }
  }, [equipment.armor, equipment.boots, equipment.gloves, equipment.helmet, equipment.shield, equipment.weapon, selectedItem]);
  const equippedItemForSelected = useMemo(() => {
    if (!equippedItemIdForSelected) {
      return null;
    }

    if (resolveItemById) {
      return resolveItemById(equippedItemIdForSelected);
    }

    try {
      return getItemById(equippedItemIdForSelected);
    } catch {
      return null;
    }
  }, [equippedItemIdForSelected, resolveItemById]);
  const equippedAdminItemForSelected = useMemo(
    () => (equippedItemIdForSelected && resolveAdminItemById ? resolveAdminItemById(equippedItemIdForSelected) : null),
    [equippedItemIdForSelected, resolveAdminItemById],
  );

  const handleBuy = async () => {
    if (selectedItem) {
      try {
        await onBuyItem(selectedItem.id, merchant.id);
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
          <button onClick={onClose}>Закрыть</button>
        </div>

        <section className="merchant-page-hero card">
          {merchantPortrait ? (
            <img className="merchant-page-portrait" src={merchantPortrait} alt={merchant.name} />
          ) : (
            <div className="merchant-page-portrait merchant-page-portrait-fallback" aria-hidden="true">
              {merchantInitial}
            </div>
          )}

          <div className="merchant-page-hero-copy">
            <span className="merchant-page-location">{merchantLocation?.trim() || 'Торговая лавка'}</span>
            <h3>{merchant.name}</h3>
            <p className="muted">
              {merchantDescription?.trim() || 'Этот торговец уже доступен в городе и продаёт предметы, которые вы задали в админке.'}
            </p>
          </div>
        </section>

        <p className="gold" style={{ display: 'inline-flex', marginBottom: '10px' }}>
          Ваше золото: {inventory.gold}
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
            Купить
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
            Продать
          </button>
        </div>

        {mode === 'buy' ? (
          <InventoryGrid
            title={`Товары: ${merchant.name}`}
            items={merchantItems}
            columns={5}
            resolveItemImage={resolveItemImage}
            onItemClick={(item) => {
              setSelectedItem(item);
              setTradeModalOpen(true);
            }}
          />
        ) : (
          <InventoryGrid
            title="Ваши предметы на продажу"
            items={inventoryItems}
            columns={5}
            resolveItemImage={resolveItemImage}
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
          adminItem={selectedAdminItem}
          itemImage={selectedItem && resolveItemImage ? resolveItemImage(selectedItem) : undefined}
          equippedItem={equippedItemForSelected}
          equippedAdminItem={equippedAdminItemForSelected}
          equippedItemImage={equippedItemForSelected && resolveItemImage ? resolveItemImage(equippedItemForSelected) : undefined}
          playerGold={inventory.gold}
          price={mode === 'buy' ? selectedItem?.price : selectedItem ? Math.max(1, Math.floor(selectedItem.price * 0.6)) : undefined}
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
