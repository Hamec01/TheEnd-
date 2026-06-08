import { useEffect, useMemo, useState } from 'react';
import type { Equipment, InventoryState, ItemDefinition, StatBlock } from '@theend/rpg-domain';
import { normalizeActorVisualSource } from '../phaser/assets/actorVisualResolver';
import type { GameImageRef, StoredImage } from '../services/content/models';
import { GameImageView } from '../admin/components/GameImageView';

interface QuickActionButton {
  id: string;
  tone: 'red' | 'blue' | 'yellow';
  icon: string;
  title: string;
  badge?: number;
  onClick: () => void;
}

interface PlayerQuickPanelProps {
  name: string;
  avatarLetter: string;
  avatarUrl?: string;
  hpText: string;
  mpText: string;
  staminaText: string;
  activeStats: StatBlock;
  equipment: Equipment;
  inventory: InventoryState;
  quickActions: QuickActionButton[];
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveItemImage?: (item: ItemDefinition | null | undefined) => string | undefined;
  resolveItemImageRef?: (item: ItemDefinition | null | undefined) => GameImageRef | undefined;
  resolveItemLegacyImagePath?: (item: ItemDefinition | null | undefined) => string | undefined;
  runtimeImages?: StoredImage[];
  worldStatusLines?: string[];
}

export function PlayerQuickPanel(props: PlayerQuickPanelProps) {
  const {
    name,
    avatarLetter,
    avatarUrl,
    hpText,
    mpText,
    staminaText,
    activeStats,
    equipment,
    inventory,
    quickActions,
    resolveItemById,
    resolveItemImage,
    resolveItemImageRef,
    resolveItemLegacyImagePath,
    runtimeImages = [],
    worldStatusLines = []
  } = props;
  const [hasAvatarError, setHasAvatarError] = useState(false);
  const resolvedAvatarUrl = useMemo(() => normalizeActorVisualSource(avatarUrl), [avatarUrl]);

  useEffect(() => {
    setHasAvatarError(false);
  }, [resolvedAvatarUrl]);

  return (
    <aside className="wm-left card">
      <h3>Персонаж</h3>

      <div className="wm-avatar-wrap" title={`${name} status`}>
        <button className="wm-avatar" title={`Name: ${name}`}>
          {resolvedAvatarUrl && !hasAvatarError ? (
            <img src={resolvedAvatarUrl} alt={name} className="wm-avatar-img" onError={() => setHasAvatarError(true)} />
          ) : (
            avatarLetter
          )}
        </button>

        <div className="wm-orbs">
          <span><i className="wm-orb hp" />{hpText}</span>
          <span><i className="wm-orb mp" />{mpText}</span>
          <span><i className="wm-orb sta" />{staminaText}</span>
        </div>

        <div className="wm-quick-actions">
          {quickActions.map((action) => (
            <button
              key={action.id}
              className={`wm-quick-btn ${action.tone}`}
              onClick={action.onClick}
              title={action.title}
            >
              <span>{action.icon}</span>
              {action.badge ? <b>{action.badge}</b> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="wm-mini-stats">
        <span className="gold">Золото: {inventory.gold}</span>
        <span>СИЛ: {activeStats.strength}</span>
        <span>ТЕЛ: {activeStats.constitution}</span>
        <span>ВОСП: {activeStats.perception}</span>
        <span>ИНТ: {activeStats.intelligence}</span>
        <span>УДАЧА: {activeStats.luck}</span>
      </div>

      <div className="wm-equipment">
        {Object.entries(equipment).map(([slot, itemId]) => (
          <div key={slot} className="wm-equip-row">
            <span>{slot}</span>
            <strong>{itemId ? (resolveItemById?.(itemId)?.name ?? itemId) : 'Empty'}</strong>
          </div>
        ))}
      </div>

      <h3>Инвентарь</h3>
      <div className="wm-inventory-grid">
        {inventory.items.slice(0, 16).map((entry) => {
          const item = resolveItemById?.(entry.itemId) ?? null;
          const imageRef = item ? resolveItemImageRef?.(item) : undefined;
          const legacyImagePath = item ? resolveItemLegacyImagePath?.(item) : undefined;
          const directImage = item ? resolveItemImage?.(item) : undefined;
          const hasImage = !!(imageRef || legacyImagePath || directImage);

          return (
            <div key={entry.itemId} className="wm-item-cell" title={item?.name ?? entry.itemId}>
              <span className={`wm-item-cell-icon${hasImage ? ' has-image' : ''}`}>
                {hasImage ? (
                  imageRef ? (
                    <GameImageView
                      imageRef={imageRef}
                      legacyImagePath={legacyImagePath}
                      runtimeImages={runtimeImages}
                      alt={item?.name ?? ''}
                      size={24}
                      fit="contain"
                      fallbackText={item?.name.slice(0, 2).toUpperCase() ?? '?'}
                      className="character-item-icon-image"
                    />
                  ) : (
                    <span
                      className="character-item-icon-legacy"
                      style={directImage || legacyImagePath ? {
                        backgroundImage: `url("${directImage || legacyImagePath}")`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        width: '100%',
                        height: '100%',
                        display: 'block',
                      } : undefined}
                    />
                  )
                ) : (
                  item?.name.slice(0, 2).toUpperCase() ?? entry.itemId.slice(0, 2).toUpperCase()
                )}
              </span>
              <small>{entry.quantity}</small>
            </div>
          );
        })}
      </div>

      {worldStatusLines.length > 0 ? (
        <section className="wm-left-mini-module">
          <h4>Статус мира</h4>
          {worldStatusLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
      ) : null}
    </aside>
  );
}
