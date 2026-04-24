import React from 'react';
import { ItemSlot } from './ItemSlot';
import type { ItemDefinition } from '@theend/rpg-domain';

interface InventoryGridProps {
  title: string;
  items: (ItemDefinition | undefined)[];
  onItemClick?: (item: ItemDefinition, index: number) => void;
  onDragStart?: (item: ItemDefinition) => void;
  onDrop?: (item: ItemDefinition) => void;
  columns?: number;
  isDraggingFrom?: string;
}

export const InventoryGrid: React.FC<InventoryGridProps> = ({
  title,
  items,
  onItemClick,
  onDragStart,
  onDrop,
  columns = 4,
  isDraggingFrom,
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
            iconEmoji={['⚔️', '🛡️', '🧪', '💎'][index % 4]}
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
