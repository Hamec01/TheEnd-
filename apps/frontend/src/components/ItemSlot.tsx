import React, { useState } from 'react';
import type { ItemDefinition } from '@theend/rpg-domain';
import { GameImageView } from '../admin/components/GameImageView';
import type { GameImageRef, StoredImage } from '../services/content/models';

export interface ItemSlotProps {
  item?: ItemDefinition;
  iconEmoji?: string;
  iconImage?: string;
  iconImageRef?: GameImageRef | null;
  iconLegacyImagePath?: string | null;
  runtimeImages?: StoredImage[];
  onClick?: () => void;
  showPrice?: boolean;
  price?: number;
  onDragStart?: (item: ItemDefinition) => void;
  onDrop?: (item: ItemDefinition) => void;
  isDragging?: boolean;
}

export const ItemSlot: React.FC<ItemSlotProps> = ({
  item,
  iconEmoji,
  iconImage,
  iconImageRef,
  iconLegacyImagePath,
  runtimeImages = [],
  onClick,
  showPrice = false,
  price,
  onDragStart,
  onDrop,
  isDragging,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipHorizontal, setTooltipHorizontal] = useState<'left' | 'right'>('right');
  const [tooltipVertical, setTooltipVertical] = useState<'top' | 'bottom'>('top');

  if (!item) {
    return (
      <div className="item-slot empty" onClick={onClick}>
        <div className="item-slot-icon">+</div>
        <div className="item-slot-name">Empty</div>
      </div>
    );
  }

  const getDamage = (definition: ItemDefinition): number => {
    let damage = 0;
    if (definition.bonuses) {
      if (definition.bonuses.strength) damage += definition.bonuses.strength * 1.5;
      if (definition.bonuses.dexterity) damage += definition.bonuses.dexterity * 1.2;
    }
    return Math.round(damage);
  };

  const getDefense = (definition: ItemDefinition): number => {
    let defense = 0;
    if (definition.bonuses?.constitution) {
      defense += definition.bonuses.constitution * 0.8;
    }
    return Math.round(defense);
  };

  const damage = getDamage(item);
  const defense = getDefense(item);
  const fallbackIcon = iconEmoji || item.name.trim().charAt(0).toUpperCase() || '?';

  const handleDragStart = (e: React.DragEvent) => {
    if (item && onDragStart) {
      onDragStart(item);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (item && onDrop) {
      onDrop(item);
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    const spaceTop = rect.top;
    const spaceBottom = window.innerHeight - rect.bottom;

    setTooltipHorizontal(spaceRight < 330 && spaceLeft > spaceRight ? 'left' : 'right');
    setTooltipVertical(spaceTop < 220 && spaceBottom > spaceTop ? 'bottom' : 'top');
    setShowTooltip(true);
  };

  return (
    <div
      className={`item-slot ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
      draggable={!!item}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      title={item.name}
    >
      <div className="item-slot-icon">
        {iconImageRef ? (
          <GameImageView
            imageRef={iconImageRef}
            legacyImagePath={iconLegacyImagePath}
            runtimeImages={runtimeImages}
            alt={item.name}
            size={56}
            fit="contain"
            fallbackText={fallbackIcon}
            className="item-slot-icon-image"
          />
        ) : iconImage ? (
          <span
            className="item-slot-icon-image item-slot-icon-image--legacy"
            style={{
              backgroundImage: `url('${iconImage}')`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
            aria-hidden="true"
          />
        ) : (
          fallbackIcon
        )}
      </div>
      <div className="item-slot-name">{item.name}</div>

      {showTooltip && (
        <div className={`item-tooltip item-tooltip-${tooltipHorizontal} item-tooltip-${tooltipVertical}`}>
          <div className="tooltip-title">{item.name}</div>

          {damage > 0 && (
            <div className="tooltip-stat">
              <span className="tooltip-label">Damage:</span>
              <span className="tooltip-value">+{damage}</span>
            </div>
          )}

          {defense > 0 && (
            <div className="tooltip-stat">
              <span className="tooltip-label">Defense:</span>
              <span className="tooltip-value">+{defense}</span>
            </div>
          )}

          {item.bonuses && (
            <>
              {item.bonuses.strength && (
                <div className="tooltip-stat">
                  <span className="tooltip-label">STR:</span>
                  <span className="tooltip-value">+{item.bonuses.strength}</span>
                </div>
              )}
              {item.bonuses.constitution && (
                <div className="tooltip-stat">
                  <span className="tooltip-label">CON:</span>
                  <span className="tooltip-value">+{item.bonuses.constitution}</span>
                </div>
              )}
              {item.bonuses.dexterity && (
                <div className="tooltip-stat">
                  <span className="tooltip-label">DEX:</span>
                  <span className="tooltip-value">+{item.bonuses.dexterity}</span>
                </div>
              )}
              {item.bonuses.intelligence && (
                <div className="tooltip-stat">
                  <span className="tooltip-label">INT:</span>
                  <span className="tooltip-value">+{item.bonuses.intelligence}</span>
                </div>
              )}
            </>
          )}

          {showPrice && price !== undefined && (
            <div className="tooltip-rarity">
              <div className="tooltip-stat">
                <span className="tooltip-label">Price:</span>
                <span className="tooltip-value">{price} gold</span>
              </div>
            </div>
          )}

          {item.rarity && (
            <div className={`tooltip-rarity rarity-${item.rarity}`}>
              {item.rarity.toUpperCase()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
