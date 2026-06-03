import React from 'react';
import type { ItemDefinition } from '@theend/rpg-domain';
import type { GameImageRef, StoredImage } from '../services/content/models';
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
  resolveItemImageRef?: (item: ItemDefinition) => GameImageRef | undefined;
  resolveItemLegacyImagePath?: (item: ItemDefinition) => string | undefined;
  runtimeImages?: StoredImage[];
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
  resolveItemImageRef,
  resolveItemLegacyImagePath,
  runtimeImages = [],
}) => {
  return (
    <div className="inventory-grid-container">
      <h3 className="inventory-title">{title}</h3>
      <div
        className="inventory-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {items.map((item, index) => {
          const iconImageRef = item ? resolveItemImageRef?.(item) : undefined;
          return (
            <ItemSlot
              key={index}
              item={item}
              iconEmoji={getFallbackIcon(item)}
              iconImageRef={iconImageRef}
              iconLegacyImagePath={item ? resolveItemLegacyImagePath?.(item) : undefined}
              runtimeImages={runtimeImages}
              iconImage={item && !iconImageRef ? resolveItemImage?.(item) : undefined}
              onClick={() => item && onItemClick?.(item, index)}
              onDragStart={onDragStart}
              onDrop={onDrop}
              isDragging={isDraggingFrom === String(index)}
            />
          );
        })}
      </div>
    </div>
  );
};
