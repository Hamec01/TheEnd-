import React from 'react';
import type { ItemDefinition } from '@theend/rpg-domain';
import type { AdminItem } from '../services/content/models';

const STAT_LABELS: Record<string, string> = {
  strength: 'Сила',
  dexterity: 'Ловкость',
  constitution: 'Телосложение',
  intelligence: 'Интеллект',
  wisdom: 'Мудрость',
  willpower: 'Воля',
  stamina: 'Выносливость',
  perception: 'Восприятие',
  luck: 'Удача',
  speed: 'Скорость',
  hp: 'HP',
  mp: 'MP',
};

function formatLabel(value: string): string {
  return STAT_LABELS[value] ?? value;
}

function formatStatRows(stats: Record<string, number> | undefined): Array<{ key: string; label: string; value: number }> {
  if (!stats) {
    return [];
  }

  return Object.entries(stats)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value !== 0)
    .map(([key, value]) => ({
      key,
      label: formatLabel(key),
      value,
    }));
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function safeRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};

  const result: Record<string, number> = {};

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[key] = raw;
    }
  }

  return result;
}

interface TradeModalProps {
  isOpen: boolean;
  action: 'buy' | 'sell';
  item: ItemDefinition | null;
  adminItem?: AdminItem | null;
  itemImage?: string;
  equippedItem?: ItemDefinition | null;
  equippedAdminItem?: AdminItem | null;
  equippedItemImage?: string;
  playerGold: number;
  price?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({
  isOpen,
  action,
  item,
  adminItem,
  itemImage,
  equippedItem,
  equippedAdminItem,
  equippedItemImage,
  playerGold,
  price,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !item) return null;

  const itemName = safeText(item.name, 'Неизвестный предмет');
  const itemDescription = safeText(item.description, 'Описание отсутствует.');
  const itemType = safeText(adminItem?.type, safeText(item.itemType, 'unknown'));
  const itemSubType = safeText(adminItem?.subtype, safeText(item.itemSubType, 'unknown'));
  const itemRarity = safeText(adminItem?.rarity, safeText(item.rarity, 'common'));
  const itemPrice = safeNumber(item.price, 0);
  const itemHands = typeof adminItem?.handsRequired === 'number'
    ? adminItem.handsRequired
    : typeof item.handsRequired === 'number'
      ? item.handsRequired
      : null;

  const selectedBonuses = safeRecord(adminItem?.bonuses ?? item.bonuses);
  const selectedRequiredStats = safeRecord(adminItem?.requiredStats ?? item.requiredStats);
  const equippedBonuses = safeRecord(equippedAdminItem?.bonuses ?? equippedItem?.bonuses);

  const selectedDamageMin = typeof adminItem?.damageMin === 'number' ? adminItem.damageMin : null;
  const selectedDamageMax = typeof adminItem?.damageMax === 'number' ? adminItem.damageMax : null;
  const selectedArmorValue = typeof adminItem?.armorValue === 'number' ? adminItem.armorValue : null;

  const equippedDamageMin = typeof equippedAdminItem?.damageMin === 'number' ? equippedAdminItem.damageMin : null;
  const equippedDamageMax = typeof equippedAdminItem?.damageMax === 'number' ? equippedAdminItem.damageMax : null;
  const equippedArmorValue = typeof equippedAdminItem?.armorValue === 'number' ? equippedAdminItem.armorValue : null;

  const resolvedPrice =
    typeof price === 'number'
      ? price
      : action === 'buy'
        ? itemPrice
        : Math.max(1, Math.floor(itemPrice * 0.6));
  const canAfford = playerGold >= resolvedPrice;
  const isBuy = action === 'buy';
  const title = isBuy ? 'Подтверждение покупки' : 'Подтверждение продажи';

  const description = safeText(adminItem?.gameplayDescription, itemDescription);
  const loreDescription = safeText(adminItem?.loreDescription, '');
  const damageMin = selectedDamageMin;
  const damageMax = selectedDamageMax;
  const hasDamage = typeof damageMin === 'number' || typeof damageMax === 'number';
  const damageText = typeof damageMin === 'number' && typeof damageMax === 'number'
    ? `${damageMin}-${damageMax}`
    : typeof damageMin === 'number'
      ? `${damageMin}`
      : typeof damageMax === 'number'
        ? `${damageMax}`
        : '—';
  const hasArmorValue = selectedArmorValue !== null;
  const reqRows = formatStatRows(selectedRequiredStats);
  const bonusRows = formatStatRows(selectedBonuses);
  const rarity = itemRarity;
  const rarityKey = String(rarity).toLowerCase();
  const rarityClass = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'forbidden'].includes(rarityKey)
    ? rarityKey
    : 'common';
  const type = itemType;
  const subtype = itemSubType;
  const hands = itemHands;
  const equippedBonusSource = equippedBonuses;
  const selectedBonusSource = selectedBonuses;
  const showComparison = isBuy && itemType !== 'consumable';
  const statDiffRows = showComparison
    ? Array.from(new Set([...Object.keys(selectedBonusSource ?? {}), ...Object.keys(equippedBonusSource ?? {})]))
      .map((key) => {
        const selected = selectedBonusSource?.[key] ?? 0;
        const equipped = equippedBonusSource?.[key] ?? 0;
        return {
          key,
          label: formatLabel(key),
          next: selected,
          current: equipped,
          diff: selected - equipped,
        };
      })
      .filter((row) => row.next !== 0 || row.current !== 0)
    : [];
  const damageDiff = showComparison && typeof damageMin === 'number' && typeof damageMax === 'number' && typeof equippedDamageMin === 'number' && typeof equippedDamageMax === 'number'
    ? {
      min: damageMin - equippedDamageMin,
      max: damageMax - equippedDamageMax,
    }
    : null;
  const armorDiff = showComparison && typeof selectedArmorValue === 'number' && typeof equippedArmorValue === 'number'
    ? selectedArmorValue - equippedArmorValue
    : null;

  return (
    <div className="trade-modal" onClick={onCancel}>
      <div className={`trade-modal-content rarity-${rarityClass}`} onClick={(e) => e.stopPropagation()}>
        <header className="trade-modal-head">
          <h2 className="trade-modal-title">{title}</h2>
          <button type="button" className="trade-modal-close" aria-label="Закрыть" onClick={onCancel}>×</button>
        </header>

        <section className="trade-modal-item-card">
          <div className="trade-modal-item-media">
            {itemImage ? (
              <img src={itemImage} alt={itemName} />
            ) : (
              <span aria-hidden="true">{itemName.charAt(0).toUpperCase() || '?'}</span>
            )}
          </div>

          <div className="trade-modal-item-main">
            <h3>{itemName}</h3>
            <p className="trade-modal-item-classline">
              {type} / {subtype} / {rarity}
            </p>
            {typeof hands === 'number' && type === 'weapon' ? (
              <p className="trade-modal-item-hands">Хват: {hands === 2 ? 'двуручное' : 'одноручное'}</p>
            ) : null}
            <p className="trade-modal-item-description">{description || 'Описание отсутствует.'}</p>
            {loreDescription ? <p className="trade-modal-item-lore">{loreDescription}</p> : null}
          </div>
        </section>

        {showComparison ? (
          <section className="trade-modal-compare-card">
            <div className="trade-modal-compare-head">
              <h4>Сравнение с экипированным</h4>
              {equippedItem ? <span>Слот занят: {safeText(equippedItem?.name, 'Экипированный предмет')}</span> : <span>Слот пуст</span>}
            </div>

            {equippedItem ? (
              <div className="trade-modal-compare-body">
                <div className="trade-modal-compare-items">
                  <div className="trade-modal-compare-item current">
                    <div className="trade-modal-compare-item-media">
                      {equippedItemImage ? <img src={equippedItemImage} alt={safeText(equippedItem?.name, 'Экипированный предмет')} /> : <span aria-hidden="true">{safeText(equippedItem?.name, 'Экипированный предмет').charAt(0).toUpperCase() || '?'}</span>}
                    </div>
                    <div>
                      <strong>Сейчас</strong>
                      <p>{safeText(equippedItem?.name, 'Экипированный предмет')}</p>
                    </div>
                  </div>

                  <div className="trade-modal-compare-item next">
                    <div className="trade-modal-compare-item-media">
                      {itemImage ? <img src={itemImage} alt={itemName} /> : <span aria-hidden="true">{itemName.charAt(0).toUpperCase() || '?'}</span>}
                    </div>
                    <div>
                      <strong>После покупки</strong>
                      <p>{itemName}</p>
                    </div>
                  </div>
                </div>

                {(statDiffRows.length > 0 || damageDiff || armorDiff !== null) ? (
                  <ul className="trade-modal-compare-list">
                    {statDiffRows.map((row) => (
                      <li key={row.key}>
                        <span>{row.label}</span>
                        <div>
                          <em>{row.current > 0 ? `+${row.current}` : row.current}</em>
                          <strong className={row.diff >= 0 ? 'up' : 'down'}>{row.diff >= 0 ? `+${row.diff}` : row.diff}</strong>
                          <b>{row.next > 0 ? `+${row.next}` : row.next}</b>
                        </div>
                      </li>
                    ))}
                    {damageDiff ? (
                      <li>
                        <span>Урон</span>
                        <div>
                          <em>{equippedDamageMin}-{equippedDamageMax}</em>
                          <strong className={(damageDiff.min + damageDiff.max) >= 0 ? 'up' : 'down'}>
                            {damageDiff.min >= 0 ? `+${damageDiff.min}` : damageDiff.min} / {damageDiff.max >= 0 ? `+${damageDiff.max}` : damageDiff.max}
                          </strong>
                          <b>{damageMin}-{damageMax}</b>
                        </div>
                      </li>
                    ) : null}
                    {armorDiff !== null ? (
                      <li>
                        <span>Броня</span>
                        <div>
                          <em>{equippedArmorValue}</em>
                          <strong className={armorDiff >= 0 ? 'up' : 'down'}>{armorDiff >= 0 ? `+${armorDiff}` : armorDiff}</strong>
                          <b>{selectedArmorValue ?? 0}</b>
                        </div>
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="muted">Для сравнения нет числовых параметров.</p>
                )}
              </div>
            ) : (
              <p className="muted">В этом слоте нет предмета, покупка даст чистое усиление.</p>
            )}
          </section>
        ) : null}

        <section className="trade-modal-stats-grid">
          <div className="trade-modal-stats-card">
            <h4>Боевые параметры</h4>
            {hasDamage ? (
              <p><strong>Урон:</strong> {damageText}</p>
            ) : null}
            {hasArmorValue ? (
              <p><strong>Броня:</strong> {selectedArmorValue}</p>
            ) : null}
            {!hasDamage && !hasArmorValue ? <p className="muted">Нет дополнительных боевых параметров.</p> : null}
          </div>

          <div className="trade-modal-stats-card">
            <h4>Требования</h4>
            {reqRows.length > 0 ? (
              <ul className="trade-modal-stat-list">
                {reqRows.map((row) => (
                  <li key={row.key}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Без требований</p>
            )}
          </div>

          <div className="trade-modal-stats-card">
            <h4>Бонусы предмета</h4>
            {bonusRows.length > 0 ? (
              <ul className="trade-modal-stat-list">
                {bonusRows.map((row) => (
                  <li key={row.key}>
                    <span>{row.label}</span>
                    <strong>{row.value > 0 ? `+${row.value}` : row.value}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Нет бонусов</p>
            )}
          </div>
        </section>

        <div className="trade-modal-economy-row">
          <div className="trade-modal-price-block">
            <span>Цена</span>
            <strong>{resolvedPrice} gold</strong>
          </div>
          <div className="trade-modal-price-block">
            <span>{isBuy ? 'Ваше золото' : 'После продажи'}</span>
            <strong>{isBuy ? playerGold : playerGold + resolvedPrice} gold</strong>
          </div>
        </div>

        {isBuy ? (
          <div className="trade-modal-gold">
            {canAfford ? 'Средств достаточно для покупки.' : 'Недостаточно золота для покупки.'}
          </div>
        ) : (
          <div className="trade-modal-gold">После продажи вы получите {resolvedPrice} gold.</div>
        )}

        <div className="trade-modal-buttons">
          <button
            className="trade-modal-btn confirm"
            onClick={onConfirm}
            disabled={!canAfford && isBuy}
          >
            {isBuy ? 'Купить предмет' : 'Продать предмет'}
          </button>
          <button className="trade-modal-btn cancel" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};
