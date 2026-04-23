import type { ArenaCombatEntity } from '@theend/rpg-domain';

interface FighterCardProps {
  fighter: ArenaCombatEntity;
  highlighted?: boolean;
}

export function FighterCard({ fighter, highlighted = false }: FighterCardProps) {
  const hpPercent = Math.max(0, Math.min(100, Math.round((fighter.currentHp / fighter.maxHp) * 100)));
  const staminaPercent = Math.max(0, Math.min(100, Math.round((fighter.currentStamina / fighter.maxStamina) * 100)));

  return (
    <div className={`fighter-card ${highlighted ? 'is-highlighted' : ''} ${fighter.isAlive ? '' : 'is-dead'}`}>
      <div className="fighter-name-row">
        <strong>{fighter.name}</strong>
        <span className={`fighter-state ${fighter.isAlive ? 'alive' : 'dead'}`}>
          {fighter.isAlive ? 'Жив' : 'Пал'}
        </span>
      </div>

      <div className="bar-label-row">
        <span>HP</span>
        <span>
          {fighter.currentHp}/{fighter.maxHp}
        </span>
      </div>
      <div className="meter hp-meter">
        <span style={{ width: `${hpPercent}%` }} />
      </div>

      <div className="bar-label-row">
        <span>STA</span>
        <span>
          {fighter.currentStamina}/{fighter.maxStamina}
        </span>
      </div>
      <div className="meter stamina-meter">
        <span style={{ width: `${staminaPercent}%` }} />
      </div>
    </div>
  );
}
