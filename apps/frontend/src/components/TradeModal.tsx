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

  const resolvedPrice = typeof price === 'number'
    ? price
    : action === 'buy'
      ? item.price
      : Math.max(1, Math.floor(item.price * 0.6));
  const canAfford = playerGold >= resolvedPrice;
  const isBuy = action === 'buy';
  const title = isBuy ? 'Подтверждение покупки' : 'Подтверждение продажи';

  const description = adminItem?.gameplayDescription?.trim() || item.description;
  const loreDescription = adminItem?.loreDescription?.trim();
  const damageMin = adminItem?.damageMin;
  const damageMax = adminItem?.damageMax;
  const hasDamage = typeof damageMin === 'number' || typeof damageMax === 'number';
  const damageText = typeof damageMin === 'number' && typeof damageMax === 'number'
    ? `${damageMin}-${damageMax}`
    : typeof damageMin === 'number'
      ? `${damageMin}`
      : typeof damageMax === 'number'
        ? `${damageMax}`
        : '—';
  const hasArmorValue = typeof adminItem?.armorValue === 'number';
  const reqRows = formatStatRows((adminItem?.requiredStats as Record<string, number> | undefined) ?? (item.requiredStats as Record<string, number>));
  const bonusRows = formatStatRows((adminItem?.bonuses as Record<string, number> | undefined) ?? (item.bonuses as Record<string, number>));
  const rarity = adminItem?.rarity ?? item.rarity;
  const rarityKey = String(rarity).toLowerCase();
  const rarityClass = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'forbidden'].includes(rarityKey)
    ? rarityKey
    : 'common';
  const type = adminItem?.type ?? item.itemType;
  const subtype = adminItem?.subtype ?? item.itemSubType;
  const hands = adminItem?.handsRequired ?? item.handsRequired;
  const equippedBonusSource = (equippedAdminItem?.bonuses as Record<string, number> | undefined) ?? (equippedItem?.bonuses as Record<string, number> | undefined);
  const selectedBonusSource = (adminItem?.bonuses as Record<string, number> | undefined) ?? (item.bonuses as Record<string, number> | undefined);
  const equippedDamageMin = equippedAdminItem?.damageMin;
  const equippedDamageMax = equippedAdminItem?.damageMax;
  const equippedArmorValue = equippedAdminItem?.armorValue;
  const showComparison = isBuy && item.itemType !== 'consumable';
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
  const armorDiff = showComparison && typeof adminItem?.armorValue === 'number' && typeof equippedArmorValue === 'number'
    ? adminItem.armorValue - equippedArmorValue
    : null;

  return (
    <div className="trade-modal" onClick={onCancel}>
      <div className={`trade-modal-content rarity-${rarityClass}`} onClick={(e) => e.stopPropagation()}>
        <header className="trade-modal-head">
          <h2 className="trade-modal-title">{title}</h2>
          <span className={`trade-modal-action-badge ${isBuy ? 'is-buy' : 'is-sell'} rarity-${rarityClass}`}>
            {isBuy ? 'Купить' : 'Продать'}
          </span>
        </header>

        <section className="trade-modal-item-card">
          <div className="trade-modal-item-media">
            {itemImage ? (
              <img src={itemImage} alt={item.name} />
            ) : (
              <span aria-hidden="true">{item.name.trim().charAt(0).toUpperCase() || '?'}</span>
            )}
          </div>

          <div className="trade-modal-item-main">
            <h3>{item.name}</h3>
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
              {equippedItem ? <span>Слот занят: {equippedItem.name}</span> : <span>Слот пуст</span>}
            </div>

            {equippedItem ? (
              <div className="trade-modal-compare-body">
                <div className="trade-modal-compare-items">
                  <div className="trade-modal-compare-item current">
                    <div className="trade-modal-compare-item-media">
                      {equippedItemImage ? <img src={equippedItemImage} alt={equippedItem.name} /> : <span aria-hidden="true">{equippedItem.name.trim().charAt(0).toUpperCase() || '?'}</span>}
                    </div>
                    <div>
                      <strong>Сейчас</strong>
                      <p>{equippedItem.name}</p>
                    </div>
                  </div>

                  <div className="trade-modal-compare-item next">
                    <div className="trade-modal-compare-item-media">
                      {itemImage ? <img src={itemImage} alt={item.name} /> : <span aria-hidden="true">{item.name.trim().charAt(0).toUpperCase() || '?'}</span>}
                    </div>
                    <div>
                      <strong>После покупки</strong>
                      <p>{item.name}</p>
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
                          <b>{adminItem?.armorValue}</b>
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
              <p><strong>Броня:</strong> {adminItem?.armorValue}</p>
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
