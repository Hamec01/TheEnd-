import type { ArenaCombatEntity, Equipment, ItemDefinition } from '@theend/rpg-domain';

interface InspectPanelProps {
  entity: ArenaCombatEntity | null;
  playerId: string;
  onClose: () => void;
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  playerEquipment?: Equipment;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getEquipmentRows(equipment: Equipment | undefined, resolveItemById?: (itemId: string) => ItemDefinition | null): Array<{ label: string; value: string }> {
  if (!equipment) {
    return [];
  }

  const rows: Array<{ label: string; value: string }> = [];
  const slots: Array<{ key: keyof Equipment; label: string }> = [
    { key: 'helmet', label: 'Шлем' },
    { key: 'armor', label: 'Броня' },
    { key: 'weapon', label: 'Оружие' },
    { key: 'shield', label: 'Щит/оффхенд' },
    { key: 'boots', label: 'Сапоги' },
    { key: 'gloves', label: 'Перчатки' },
  ];

  for (const slot of slots) {
    const itemId = equipment[slot.key];
    if (!itemId) {
      rows.push({ label: slot.label, value: '-' });
      continue;
    }

    const item = resolveItemById?.(itemId);
    rows.push({ label: slot.label, value: item?.name ?? itemId });
  }

  return rows;
}

export function InspectPanel({ entity, playerId, onClose, resolveItemById, playerEquipment }: InspectPanelProps) {
  if (!entity) {
    return null;
  }

  const hpPercent = Math.max(0, Math.min(100, Math.round((entity.currentHp / Math.max(1, entity.maxHp)) * 100)));
  const isPlayer = entity.id === playerId;
  const equipmentRows = isPlayer ? getEquipmentRows(playerEquipment, resolveItemById) : [];
  const entityLevel = typeof (entity as ArenaCombatEntity & { level?: unknown }).level === 'number'
    ? (entity as ArenaCombatEntity & { level?: number }).level
    : null;

  return (
    <aside className="battle-inspect-panel card" role="dialog" aria-label="Inspect panel">
      <div className="battle-inspect-head">
        <h3>Осмотр</h3>
        <button type="button" onClick={onClose}>✕</button>
      </div>

      <div className="battle-inspect-identity">
        <div className={`combat-avatar ${entity.isAlive ? '' : 'is-dead'}`} style={{ ['--hp-percent' as string]: `${hpPercent}%` }}>
          {entity.avatarUrl ? <img src={entity.avatarUrl} alt={entity.name} className="combat-avatar-image" /> : <div className="combat-avatar-fallback">{getInitials(entity.name)}</div>}
          <div className="combat-avatar-base" />
          <div className="combat-avatar-hp-fill" />
        </div>
        <div>
          <strong>{entity.name}</strong>
          <p className="muted">Раса: {entity.race}</p>
          <p className="muted">Сторона: {entity.team === 'LEFT' ? 'Игрок' : 'Противник'}</p>
          {entityLevel !== null ? <p className="muted">Уровень: {entityLevel}</p> : null}
        </div>
      </div>

      <div className="battle-inspect-bars">
        <p>HP: {entity.currentHp} / {entity.maxHp}</p>
      </div>

      {isPlayer ? (
        <section className="battle-inspect-stats">
          <h4>Экипировка</h4>
          {equipmentRows.map((row) => (
            <p key={row.label}>{row.label}: {row.value}</p>
          ))}
        </section>
      ) : (
        <section className="battle-inspect-stats">
          <h4>Наблюдение</h4>
          <p>Статус: {entity.isAlive ? 'В бою' : 'Повержен'}</p>
          <p>Экипировка: пока недоступно в данных боя.</p>
        </section>
      )}
    </aside>
  );
}
