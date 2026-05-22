import React from 'react';
import type { ItemDefinition } from '@theend/rpg-domain';
import { PAPER_DOLL_ASSETS, PAPER_DOLL_SLOT_LAYOUT, type EquipmentSlotId, type PaperDollRace, type PaperDollSlotLayout } from './paperDollSlots';

interface PaperDollProps {
  race: PaperDollRace;
  imageSrc: string;
  slotItems: Partial<Record<EquipmentSlotId, ItemDefinition | null>>;
  slotLabels: Partial<Record<EquipmentSlotId, string>>;
  /** Text badge to display in a slot when there is no item (used for skill assignments in quick slots) */
  slotTextContent?: Partial<Record<EquipmentSlotId, string>>;
  slotImageContent?: Partial<Record<EquipmentSlotId, { src: string; alt: string }>>;
  /** Slot to highlight as selected (e.g. waiting for a skill to be assigned) */
  selectedSlotId?: EquipmentSlotId | null;
  resolveItemImage?: (item: ItemDefinition) => string | undefined;
  canDropItemInSlot?: (slotId: EquipmentSlotId, itemId: string) => boolean;
  onSlotClick: (slotId: EquipmentSlotId) => void;
  onSlotDoubleClick?: (slotId: EquipmentSlotId) => void;
  onSlotDrop: (slotId: EquipmentSlotId, itemId: string) => void;
  onSkillDrop?: (slotId: EquipmentSlotId, skillId: string) => void;
  onSlotContextMenu?: (slotId: EquipmentSlotId) => void;
  debug?: boolean;
  onImageError?: () => void;
}

export function PaperDoll({
  race,
  imageSrc,
  slotItems,
  slotLabels,
  slotTextContent,
  slotImageContent,
  selectedSlotId,
  resolveItemImage,
  canDropItemInSlot,
  onSlotClick,
    onSlotDoubleClick,
  onSlotDrop,
  onSkillDrop,
  onSlotContextMenu,
  debug = false,
  onImageError,
}: PaperDollProps) {
  const asset = PAPER_DOLL_ASSETS[race];
  const layout = PAPER_DOLL_SLOT_LAYOUT[race];
  const equipmentSlots = layout.filter((slot) => slot.group === 'equipment');
  const bottomSlots = layout.filter((slot) => slot.group === 'bottom');

  function renderSlot(slot: PaperDollSlotLayout): React.JSX.Element {
    const equippedItem = slotItems[slot.id] ?? null;
    const label = slotLabels[slot.id] ?? slot.label;
    const textBadge = slotTextContent?.[slot.id] ?? null;
    const imageBadge = slotImageContent?.[slot.id] ?? null;
    const isSelected = slot.id === selectedSlotId;
    const showPlaceholder = !equippedItem && !imageBadge && !textBadge && Boolean(slot.placeholder);

    return (
      <button
        key={slot.id}
        type="button"
        className={`paper-doll-slot ${debug ? 'is-debug' : ''} ${equippedItem || imageBadge || textBadge ? 'is-equipped' : 'is-empty'} ${isSelected ? 'is-selected' : ''} ${slot.group === 'bottom' ? 'is-bottom-slot' : 'is-equipment-slot'}`}
        style={{
          left: `${slot.xPercent}%`,
          top: `${slot.yPercent}%`,
          width: `${slot.widthPercent}%`,
          height: `${slot.heightPercent}%`,
          transform: 'translate(-50%, -50%)',
        }}
        onClick={() => {
          if (debug) {
            console.info('paper-doll-slot', {
              id: slot.id,
              group: slot.group,
              xPercent: slot.xPercent,
              yPercent: slot.yPercent,
              widthPercent: slot.widthPercent,
              heightPercent: slot.heightPercent,
            });
          }
          onSlotClick(slot.id);
        }}
        onDoubleClick={() => {
          onSlotDoubleClick?.(slot.id);
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
        title={equippedItem ? `${label}: ${equippedItem.name}${textBadge ? ` (${textBadge})` : ''}` : imageBadge ? `${label}: ${imageBadge.alt}` : textBadge ? `${label}: ${textBadge}` : label}
        data-slot-id={slot.id}
        data-slot-group={slot.group}
      >
        {debug ? <span className="paper-doll-slot-id">{slot.id}</span> : null}

        {showPlaceholder ? <span className="paper-doll-slot-placeholder" aria-hidden="true">{slot.placeholder}</span> : null}

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
        ) : imageBadge ? (
          <>
            <span className="paper-doll-slot-item-wrap">
              <img
                src={imageBadge.src}
                alt={imageBadge.alt}
                className="paper-doll-slot-item-icon"
                draggable={false}
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            </span>
            {textBadge ? <span className="paper-doll-slot-skill-badge">{textBadge}</span> : null}
            <span className="paper-doll-slot-tooltip" role="tooltip">
              <strong>{label}</strong>
              <span>{imageBadge.alt}</span>
            </span>
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
  }

  return (
    <div className="paper-doll-stage">
      <div className="paper-doll-figure-shell">
        <div className="paper-doll-image-shell" style={{ aspectRatio: `${asset.naturalWidth} / ${asset.naturalHeight}` }}>
          <img
            src={imageSrc}
            alt=""
            aria-hidden="true"
            className="paper-doll-image"
            onError={onImageError}
          />

          <div className="paper-doll-overlay" aria-hidden={false}>
            {equipmentSlots.map((slot) => renderSlot(slot))}
          </div>
        </div>
      </div>

      <div className="paper-doll-bottom-shell">
        <div className="paper-doll-bottom-row" aria-hidden={false}>
          {bottomSlots.map((slot) => renderSlot(slot))}
        </div>
      </div>
    </div>
  );
}
