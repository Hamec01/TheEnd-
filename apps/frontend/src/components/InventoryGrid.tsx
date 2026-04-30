import React from 'react';
import type { ItemDefinition } from '@theend/rpg-domain';
import { ItemSlot } from './ItemSlot';

interface InventoryGridProps {
  title: string;
  items: (ItemDefinition | undefined)[];
  onItemClick?: (item: ItemDefinition, index: number) => void;
  onDragStart?: (item: ItemDefinition) => void;
  onDrop?: (item: ItemDefinition) => void;
  columns?: number;
  isDraggingFrom?: string;
  resolveItemImage?: (item: ItemDefinition) => string | undefined;
}

function getFallbackIcon(item: ItemDefinition | undefined): string {
  if (!item) {
    return '';
  }

  switch (item.itemType) {
    case 'weapon':
      return 'W';
    case 'shield':
      return 'S';
    case 'helmet':
      return 'H';
    case 'armor':
      return 'A';
    case 'boots':
      return 'B';
    case 'gloves':
      return 'G';
    case 'consumable':
      return 'P';
    default:
      return item.name.trim().charAt(0).toUpperCase() || '?';
  }
}

export const InventoryGrid: React.FC<InventoryGridProps> = ({
  title,
  items,
  onItemClick,
  onDragStart,
  onDrop,
  columns = 4,
  isDraggingFrom,
  resolveItemImage,
}) => {
  return (
    <div className="inventory-grid-container">
      <h3 className="inventory-title">{title}</h3>
      <div
        className="inventory-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {items.map((item, index) => (
          <ItemSlot
            key={index}
            item={item}
            iconEmoji={getFallbackIcon(item)}
            iconImage={item ? resolveItemImage?.(item) : undefined}
            onClick={() => item && onItemClick?.(item, index)}
            onDragStart={onDragStart}
            onDrop={onDrop}
            isDragging={isDraggingFrom === String(index)}
          />
        ))}
      </div>
    </div>
  );
};
