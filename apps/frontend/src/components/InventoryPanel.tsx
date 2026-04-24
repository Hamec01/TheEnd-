import React, { useMemo, useState } from 'react';
import { InventoryGrid } from './InventoryGrid';
import type { Equipment, InventoryState, ItemDefinition } from '@theend/rpg-domain';
import { getItemById } from '@theend/rpg-domain';
import type { ArenaCharacter } from '../arena/types';

interface InventoryPanelProps {
  character: ArenaCharacter;
  inventory: InventoryState;
  equipment: Equipment;
  onClose: () => void;
  onEquipItem: (itemId: string) => Promise<void>;
  onUnequipSlot: (slot: keyof Equipment) => Promise<void>;
}

const SLOT_ORDER: Array<keyof Equipment> = ['helmet', 'weapon', 'armor', 'gloves', 'boots', 'shield'];

const SLOT_LABELS: Record<keyof Equipment, string> = {
  weapon: 'Правая рука',
  shield: 'Левая рука',
  helmet: 'Голова',
  armor: 'Тело',
  gloves: 'Руки',
  boots: 'Ноги',
};

const SLOT_CLASS: Record<keyof Equipment, string> = {
  helmet: 'slot-helmet',
  armor: 'slot-armor',
  gloves: 'slot-gloves',
  boots: 'slot-boots',
  weapon: 'slot-weapon',
  shield: 'slot-shield',
};

function itemTypeToSlot(itemType: ItemDefinition['itemType']): keyof Equipment | null {
  switch (itemType) {
    case 'weapon':
      return 'weapon';
    case 'shield':
      return 'shield';
    case 'helmet':
      return 'helmet';
    case 'armor':
      return 'armor';
    case 'gloves':
      return 'gloves';
    case 'boots':
      return 'boots';
    default:
      return null;
  }
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({
  character,
  inventory,
  equipment,
  onClose,
  onEquipItem,
  onUnequipSlot,
}) => {
  const [selectedItem, setSelectedItem] = useState<ItemDefinition | null>(null);

  const inventoryItems = useMemo(
    () => inventory.items.map((entry) => getItemById(entry.itemId)).filter(Boolean) as ItemDefinition[],
    [inventory.items],
  );

  const equippedItemsBySlot = useMemo(() => {
    const pairs = SLOT_ORDER.map((slot) => {
      const itemId = equipment[slot];
      return [slot, itemId ? getItemById(itemId) : null] as const;
    });
    return Object.fromEntries(pairs) as Record<keyof Equipment, ItemDefinition | null>;
  }, [equipment]);

  const selectedSlot = selectedItem ? itemTypeToSlot(selectedItem.itemType) : null;
  const selectedAlreadyEquipped = Boolean(
    selectedSlot && equipment[selectedSlot] && equipment[selectedSlot] === selectedItem?.id,
  );

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true">
      <section className="card battle-window wm-modal inventory-layout-modal">
        <div className="battle-window-head">
          <h2>Инвентарь - {character.name}</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <p className="gold" style={{ display: 'inline-flex', marginBottom: '10px' }}>
          🪙 {inventory.gold}
        </p>

        <div className="inventory-layout-grid">
          <section className="inventory-avatar-panel">
            <div className="inventory-paperdoll">
              <div className="inventory-avatar-figure">
                <span>{character.name.charAt(0).toUpperCase() || 'H'}</span>
              </div>

              {SLOT_ORDER.map((slot) => {
                const equipped = equippedItemsBySlot[slot];
                return (
                  <article key={slot} className={`inventory-equip-slot ${SLOT_CLASS[slot]}`}>
                    <p className="inventory-equip-slot-label">{SLOT_LABELS[slot]}</p>
                    <p className="inventory-equip-slot-item">{equipped?.name ?? 'Пусто'}</p>
                    {equipped ? (
                      <button onClick={() => void onUnequipSlot(slot)}>Снять</button>
                    ) : (
                      <button disabled>Пусто</button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="inventory-bag-panel">
            <InventoryGrid
              title="Рюкзак"
              items={inventoryItems}
              columns={5}
              onItemClick={(item) => setSelectedItem(item)}
            />
          </section>

          <section className="inventory-item-panel">
            <h3>Предмет</h3>
            {selectedItem ? (
              <>
                <p><strong>{selectedItem.name}</strong></p>
                <p className="muted">Тип: {selectedItem.itemType} / {selectedItem.itemSubType}</p>
                <p className="muted">Редкость: {selectedItem.rarity}</p>
                {selectedItem.itemType !== 'consumable' && selectedSlot ? (
                  <button
                    disabled={selectedAlreadyEquipped}
                    onClick={() => void onEquipItem(selectedItem.id)}
                  >
                    {selectedAlreadyEquipped ? 'Уже надето' : 'Надеть'}
                  </button>
                ) : (
                  <p className="muted">Расходники не надеваются.</p>
                )}
              </>
            ) : (
              <p className="muted">Выберите предмет в рюкзаке.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
};
