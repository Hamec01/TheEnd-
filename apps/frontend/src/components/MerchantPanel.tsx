import React, { useMemo, useState } from 'react';
import { getItemById, getMerchantItems, type Equipment, type InventoryState, type Merchant } from '@theend/rpg-domain';
import type { ItemDefinition } from '@theend/rpg-domain';
import type { AdminItem } from '../services/content/models';
import { InventoryGrid } from './InventoryGrid';
import { TradeModal } from './TradeModal';
import { resolvePreferredEquipmentSlot } from '../utils/equipmentTarget';

interface MerchantPanelProps {
  merchant: Merchant;
  inventory: InventoryState;
  equipment: Equipment;
  merchantItems?: ItemDefinition[];
  allowedSellItemIds?: string[];
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveAdminItemById?: (itemId: string) => AdminItem | null;
  resolveItemImage?: (item: ItemDefinition) => string | undefined;
  merchantDescription?: string;
  merchantLocation?: string;
  merchantPortrait?: string;
  onClose: () => void;
  merchantStockByItemId?: Record<string, number | null>;
  onBuyItem: (itemId: string, merchantId: string, quantity: number) => Promise<void>;
  onSellItem: (itemId: string, quantity: number) => Promise<void>;
}

export const MerchantPanel: React.FC<MerchantPanelProps> = ({
  merchant,
  inventory,
  equipment,
  merchantItems: merchantItemsOverride,
  allowedSellItemIds,
  resolveItemById,
  resolveAdminItemById,
  resolveItemImage,
  merchantDescription,
  merchantLocation,
  merchantPortrait,
  merchantStockByItemId,
  onClose,
  onBuyItem,
  onSellItem,
}) => {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemDefinition | null>(null);
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const merchantInitial = merchant.name.trim().charAt(0).toUpperCase() || 'Т';

  const merchantItems = useMemo(
    () => merchantItemsOverride ?? getMerchantItems(merchant.id),
    [merchant.id, merchantItemsOverride],
  );
  const isMaterialItem = useMemo(
    () => (item: ItemDefinition) => {
      const adminItem = resolveAdminItemById?.(item.id);
      if (adminItem?.type === 'material') {
        return true;
      }
      return item.id.startsWith('mat_');
    },
    [resolveAdminItemById],
  );
  const merchantMaterialItems = useMemo(
    () => merchantItems.filter((item) => isMaterialItem(item)),
    [isMaterialItem, merchantItems],
  );
  const merchantRegularItems = useMemo(
    () => merchantItems.filter((item) => !isMaterialItem(item)),
    [isMaterialItem, merchantItems],
  );
  const inventoryItems = useMemo(
    () => {
      const allowedSet = allowedSellItemIds && allowedSellItemIds.length > 0 ? new Set(allowedSellItemIds) : null;
      return inventory.items
        .filter((entry) => !allowedSet || allowedSet.has(entry.itemId))
        .map((entry) => (resolveItemById ? resolveItemById(entry.itemId) : getItemById(entry.itemId)))
        .filter(Boolean) as ItemDefinition[];
    },
    [allowedSellItemIds, inventory.items, resolveItemById],
  );
  const inventoryQuantityByItemId = useMemo(() => {
    const quantityByItemId = new Map<string, number>();
    for (const entry of inventory.items) {
      quantityByItemId.set(entry.itemId, (quantityByItemId.get(entry.itemId) ?? 0) + entry.quantity);
    }
    return quantityByItemId;
  }, [inventory.items]);
  const selectedAdminItem = useMemo(
    () => (selectedItem && resolveAdminItemById ? resolveAdminItemById(selectedItem.id) : null),
    [resolveAdminItemById, selectedItem],
  );
  const equippedItemIdForSelected = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    const comparisonSlot = resolvePreferredEquipmentSlot(selectedItem, equipment);
    return comparisonSlot ? equipment[comparisonSlot] ?? null : null;
  }, [equipment, selectedItem]);
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

  const selectedUnitPrice = useMemo(
    () => (mode === 'buy' ? selectedItem?.price ?? 0 : selectedItem ? Math.max(1, Math.floor(selectedItem.price * 0.55)) : 0),
    [mode, selectedItem],
  );

  const maxBuyByGold = useMemo(() => {
    if (selectedUnitPrice <= 0) {
      return 999;
    }
    return Math.max(0, Math.floor(inventory.gold / selectedUnitPrice));
  }, [inventory.gold, selectedUnitPrice]);

  const selectedMerchantStock = useMemo(() => {
    if (!selectedItem || !merchantStockByItemId) {
      return null;
    }
    return merchantStockByItemId[selectedItem.id] ?? null;
  }, [merchantStockByItemId, selectedItem]);

  const maxBuyQuantity = useMemo(() => {
    if (typeof selectedMerchantStock === 'number') {
      return Math.max(0, Math.min(maxBuyByGold, selectedMerchantStock));
    }
    return maxBuyByGold;
  }, [maxBuyByGold, selectedMerchantStock]);

  const maxSellQuantity = useMemo(() => {
    if (!selectedItem) {
      return 0;
    }
    return Math.max(0, inventoryQuantityByItemId.get(selectedItem.id) ?? 0);
  }, [inventoryQuantityByItemId, selectedItem]);

  const maxTradeQuantity = mode === 'buy' ? maxBuyQuantity : maxSellQuantity;
  const merchantStockLabel = useMemo(() => {
    if (mode !== 'buy') {
      return undefined;
    }
    if (typeof selectedMerchantStock === 'number') {
      return `${selectedMerchantStock} шт.`;
    }
    return 'Бесконечно';
  }, [mode, selectedMerchantStock]);

  const handleBuy = async () => {
    if (selectedItem) {
      try {
        await onBuyItem(selectedItem.id, merchant.id, tradeQuantity);
        setTradeModalOpen(false);
        setSelectedItem(null);
        setTradeQuantity(1);
      } catch (err) {
        console.error('Failed to buy item:', err);
      }
    }
  };

  const handleSell = async () => {
    if (selectedItem) {
      try {
        await onSellItem(selectedItem.id, tradeQuantity);
        setTradeModalOpen(false);
        setSelectedItem(null);
        setTradeQuantity(1);
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
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMode('buy');
            }}
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
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMode('sell');
            }}
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
          <>
            {merchantRegularItems.length > 0 ? (
              <InventoryGrid
                title={`Товары: ${merchant.name}`}
                items={merchantRegularItems}
                columns={5}
                resolveItemImage={resolveItemImage}
                onItemClick={(item) => {
                  if (!item) return;
                  setSelectedItem(item);
                  setTradeQuantity(1);
                  setTradeModalOpen(true);
                }}
              />
            ) : null}

            {merchantMaterialItems.length > 0 ? (
              <InventoryGrid
                title="Материалы"
                items={merchantMaterialItems}
                columns={5}
                resolveItemImage={resolveItemImage}
                onItemClick={(item) => {
                  if (!item) return;
                  setSelectedItem(item);
                  setTradeQuantity(1);
                  setTradeModalOpen(true);
                }}
              />
            ) : null}
          </>
        ) : (
          <InventoryGrid
            title="Ваши предметы на продажу"
            items={inventoryItems}
            columns={5}
            resolveItemImage={resolveItemImage}
            onItemClick={(item) => {
              if (!item) return;
              setSelectedItem(item);
              setTradeQuantity(1);
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
          price={selectedUnitPrice}
          quantity={tradeQuantity}
          maxQuantity={maxTradeQuantity}
          merchantStockLabel={merchantStockLabel}
          onQuantityChange={setTradeQuantity}
          onConfirm={mode === 'buy' ? handleBuy : handleSell}
          onCancel={() => {
            setTradeModalOpen(false);
            setSelectedItem(null);
            setTradeQuantity(1);
          }}
        />
      </section>
    </div>
  );
};
