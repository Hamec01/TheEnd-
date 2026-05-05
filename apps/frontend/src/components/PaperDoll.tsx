import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ItemDefinition } from '@theend/rpg-domain';
import { PAPER_DOLL_ASSETS, type EquipmentSlotId, type PaperDollRace, type PaperDollSlotRect } from './paperDollSlots';

interface PaperDollProps {
  race: PaperDollRace;
  imageSrc: string;
  slotItems: Partial<Record<EquipmentSlotId, ItemDefinition | null>>;
  slotLabels: Partial<Record<EquipmentSlotId, string>>;
  /** Text badge to display in a slot when there is no item (used for skill assignments in quick slots) */
  slotTextContent?: Partial<Record<EquipmentSlotId, string>>;
  /** Slot to highlight as selected (e.g. waiting for a skill to be assigned) */
  selectedSlotId?: EquipmentSlotId | null;
  resolveItemImage?: (item: ItemDefinition) => string | undefined;
  canDropItemInSlot?: (slotId: EquipmentSlotId, itemId: string) => boolean;
  onSlotClick: (slotId: EquipmentSlotId) => void;
  onSlotDrop: (slotId: EquipmentSlotId, itemId: string) => void;
  onSkillDrop?: (slotId: EquipmentSlotId, skillId: string) => void;
  onSlotContextMenu?: (slotId: EquipmentSlotId) => void;
  debug?: boolean;
  onImageError?: () => void;
}

interface RenderedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function toRenderedRect(
  slot: PaperDollSlotRect,
  naturalWidth: number,
  naturalHeight: number,
  renderedWidth: number,
  renderedHeight: number,
): RenderedRect {
  const scaleX = renderedWidth / naturalWidth;
  const scaleY = renderedHeight / naturalHeight;

  return {
    left: slot.x * scaleX,
    top: slot.y * scaleY,
    width: slot.w * scaleX,
    height: slot.h * scaleY,
  };
}

export function PaperDoll({
  race,
  imageSrc,
  slotItems,
  slotLabels,
  slotTextContent,
  selectedSlotId,
  resolveItemImage,
  canDropItemInSlot,
  onSlotClick,
  onSlotDrop,
  onSkillDrop,
  onSlotContextMenu,
  debug = false,
  onImageError,
}: PaperDollProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });

  const asset = PAPER_DOLL_ASSETS[race];

  useEffect(() => {
    const image = imageRef.current;
    if (!image) {
      return;
    }

    const updateSize = () => {
      const rect = image.getBoundingClientRect();
      setRenderedSize({
        width: rect.width,
        height: rect.height,
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(image);
    return () => {
      observer.disconnect();
    };
  }, [imageSrc, race]);

  const renderedRects = useMemo(() => {
    if (renderedSize.width <= 0 || renderedSize.height <= 0) {
      return new Map<EquipmentSlotId, RenderedRect>();
    }

    return new Map<EquipmentSlotId, RenderedRect>(
      asset.slots.map((slot) => [
        slot.id,
        toRenderedRect(slot, asset.naturalWidth, asset.naturalHeight, renderedSize.width, renderedSize.height),
      ]),
    );
  }, [asset, renderedSize.height, renderedSize.width]);

  return (
    <div className="paper-doll-stage">
      <div className="paper-doll-image-shell">
        <img
          ref={imageRef}
          src={imageSrc}
          alt=""
          aria-hidden="true"
          className="paper-doll-image"
          onLoad={() => {
            const rect = imageRef.current?.getBoundingClientRect();
            if (rect) {
              setRenderedSize({ width: rect.width, height: rect.height });
            }
          }}
          onError={onImageError}
        />

        <div className="paper-doll-overlay" aria-hidden={false}>
          {asset.slots.map((slot) => {
            const rect = renderedRects.get(slot.id);
            if (!rect) {
              return null;
            }

            const equippedItem = slotItems[slot.id] ?? null;
            const label = slotLabels[slot.id] ?? slot.id;
            const textBadge = slotTextContent?.[slot.id] ?? null;
            const isSelected = slot.id === selectedSlotId;

            return (
              <button
                key={slot.id}
                type="button"
                className={`paper-doll-slot ${debug ? 'is-debug' : ''} ${equippedItem || textBadge ? 'is-equipped' : 'is-empty'} ${isSelected ? 'is-selected' : ''}`}
                style={{
                  left: `${rect.left}px`,
                  top: `${rect.top}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                }}
                onClick={() => {
                  if (debug) {
                    console.info('paper-doll-slot', {
                      id: slot.id,
                      x: slot.x,
                      y: slot.y,
                      w: slot.w,
                      h: slot.h,
                    });
                  }
                  onSlotClick(slot.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onSlotContextMenu?.(slot.id);
                }}
                onDragOver={(event) => {
                  const itemId = event.dataTransfer.getData('text/theend-item-id');
                  const skillId = event.dataTransfer.getData('text/theend-skill-id');
                  if (skillId && onSkillDrop) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                    return;
                  }
                  if (itemId && canDropItemInSlot && !canDropItemInSlot(slot.id, itemId)) {
                    event.dataTransfer.dropEffect = 'none';
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const skillId = event.dataTransfer.getData('text/theend-skill-id');
                  if (skillId) {
                    onSkillDrop?.(slot.id, skillId);
                    return;
                  }
                  const itemId = event.dataTransfer.getData('text/theend-item-id');
                  if (!itemId) {
                    return;
                  }
                  if (canDropItemInSlot && !canDropItemInSlot(slot.id, itemId)) {
                    return;
                  }
                  onSlotDrop(slot.id, itemId);
                }}
                title={equippedItem ? `${label}: ${equippedItem.name}${textBadge ? ` (${textBadge})` : ''}` : textBadge ? `${label}: ${textBadge}` : label}
                data-slot-id={slot.id}
              >
                {debug ? <span className="paper-doll-slot-id">{slot.id}</span> : null}

                {equippedItem ? (
                  <>
                    <span className="paper-doll-slot-item-wrap">
                      <img
                        src={resolveItemImage?.(equippedItem) ?? `/art/items/${equippedItem.icon}.png`}
                        alt={equippedItem.name}
                        className="paper-doll-slot-item-icon"
                        draggable={false}
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    </span>
                    <span className="paper-doll-slot-tooltip" role="tooltip">
                      <strong>{label}</strong>
                      <span>{equippedItem.name}</span>
                      <small>{equippedItem.itemType} / {equippedItem.itemSubType}</small>
                    </span>
                    {textBadge ? <span className="paper-doll-slot-skill-badge">{textBadge}</span> : null}
                  </>
                ) : textBadge ? (
                  <>
                    <span className="paper-doll-slot-skill-badge">{textBadge}</span>
                    <span className="paper-doll-slot-tooltip" role="tooltip">
                      <strong>{label}</strong>
                      <span>{textBadge}</span>
                    </span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
