import type { ArenaCombatEntity } from '@theend/rpg-domain';

type FighterVisualState = 'idle' | 'attack' | 'hit' | 'block' | 'dodge';

interface FighterCardProps {
  fighter: ArenaCombatEntity;
  highlighted?: boolean;
  side?: 'player' | 'enemy';
  visualState?: FighterVisualState;
  floatingText?: string | null;
  subtitle?: string;
}

function stateLabel(state: FighterVisualState): string {
  if (state === 'attack') {
    return 'Attacking';
  }
  if (state === 'hit') {
    return 'Hit';
  }
  if (state === 'block') {
    return 'Blocking';
  }
  if (state === 'dodge') {
    return 'Dodge';
  }
  return 'Idle';
}

export function FighterCard({
  fighter,
  highlighted = false,
  side = 'player',
  visualState = 'idle',
  floatingText,
  subtitle,
}: FighterCardProps) {
  const hpPercent = Math.max(0, Math.min(100, Math.round((fighter.currentHp / fighter.maxHp) * 100)));
  const mpPercent = Math.max(0, Math.min(100, Math.round((fighter.currentMp / Math.max(1, fighter.maxMp)) * 100)));
  const staminaPercent = Math.max(0, Math.min(100, Math.round((fighter.currentStamina / fighter.maxStamina) * 100)));

  return (
    <div
      className={[
        'fighter-card',
        'fighter-card-compact',
        'fighter-card-column',
        highlighted ? 'is-highlighted' : '',
        fighter.isAlive ? '' : 'is-dead',
        `fighter-side-${side}`,
        `fighter-state-${visualState}`,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="fighter-header">
        <div className="fighter-name-title">
          <strong>{fighter.name}</strong>
          {subtitle && <span className="fighter-subtitle">{subtitle}</span>}
        </div>
        <span className={`fighter-state-badge ${fighter.isAlive ? 'alive' : 'dead'}`}>
          {fighter.isAlive ? stateLabel(visualState) : 'Down'}
        </span>
      </div>

      <div className="fighter-avatar-section">
        <div className="fighter-avatar">{fighter.name.slice(0, 2).toUpperCase()}</div>
        <div className="fighter-silhouette-grid" aria-label="Combat silhouette">
          <span className="slot-head" title="Helmet">H</span>
          <span className="slot-weapon" title="Weapon">W</span>
          <span className="slot-chest" title="Armor">C</span>
          <span className="slot-shield" title="Shield">S</span>
          <span className="slot-gloves" title="Gloves">G</span>
          <span className="slot-boots" title="Boots">B</span>
        </div>
        {floatingText && <div className="fighter-floating-text">{floatingText}</div>}
      </div>

      <div className="fighter-bars">
        <div className="bar-row">
          <div className="bar-label">
            <span>HP</span>
            <span className="bar-value">
              {fighter.currentHp}/{fighter.maxHp}
            </span>
          </div>
          <div className="meter hp-meter">
            <span style={{ width: `${hpPercent}%` }} />
          </div>
        </div>

        <div className="bar-row">
          <div className="bar-label">
            <span>MP</span>
            <span className="bar-value">
              {fighter.currentMp}/{fighter.maxMp}
            </span>
          </div>
          <div className="meter mana-meter">
            <span style={{ width: `${mpPercent}%` }} />
          </div>
        </div>

        <div className="bar-row">
          <div className="bar-label">
            <span>STA</span>
            <span className="bar-value">
              {fighter.currentStamina}/{fighter.maxStamina}
            </span>
          </div>
          <div className="meter stamina-meter">
            <span style={{ width: `${staminaPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="fighter-weapon-row">
        <span>Weapon:</span>
        <strong>{fighter.dexterity >= fighter.strength ? 'Light / Ranged' : 'Melee'}</strong>
      </div>
    </div>
  );
}
