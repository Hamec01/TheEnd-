import React, { useState } from 'react';
import type { ItemDefinition } from '@theend/rpg-domain';

export interface ItemSlotProps {
  item?: ItemDefinition;
  iconEmoji?: string;
  iconImage?: string;
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
        <div className="item-slot-icon">⬜</div>
        <div className="item-slot-name">Empty</div>
      </div>
    );
  }

  const getDamage = (item: ItemDefinition): number => {
    let damage = 0;
    if (item.bonuses) {
      if (item.bonuses.strength) damage += item.bonuses.strength * 1.5;
      if (item.bonuses.dexterity) damage += item.bonuses.dexterity * 1.2;
    }
    return Math.round(damage);
  };

  const getDefense = (item: ItemDefinition): number => {
    let defense = 0;
    if (item.bonuses) {
      if (item.bonuses.constitution) defense += item.bonuses.constitution * 0.8;
    }
    return Math.round(defense);
  };

  const damage = getDamage(item);
  const defense = getDefense(item);

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
    >
      <div 
        className="item-slot-icon"
        style={iconImage ? { backgroundImage: `url('${iconImage}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' } : {}}
      >
        {!iconImage && (iconEmoji || '📦')}
      </div>
      <div className="item-slot-name">{item.name.substring(0, 10)}</div>

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
                <span className="tooltip-value">{price} 💰</span>
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
