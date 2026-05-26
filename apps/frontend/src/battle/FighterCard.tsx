import { useEffect, useState } from 'react';
import type { ArenaCombatEntity } from '@theend/rpg-domain';

type FighterVisualState = 'idle' | 'attack' | 'hit' | 'block' | 'dodge';

interface FighterCardProps {
  fighter: ArenaCombatEntity;
  highlighted?: boolean;
  side?: 'player' | 'enemy';
  visualState?: FighterVisualState;
  floatingText?: string | null;
  subtitle?: string;
  avatarUrl?: string;
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

function describeStaminaState(current: number, max: number): string {
  const ratio = Math.max(0, Math.min(1, current / Math.max(1, max)));
  if (ratio <= 0.15) {
    return 'Выдохся';
  }
  if (ratio <= 0.45) {
    return 'Еще может биться';
  }
  return 'Бодрый';
}

export function FighterCard({
  fighter,
  highlighted = false,
  side = 'player',
  visualState = 'idle',
  floatingText,
  subtitle,
  avatarUrl,
}: FighterCardProps) {
  const [hasAvatarError, setHasAvatarError] = useState(false);
  const hpPercent = Math.max(0, Math.min(100, Math.round((fighter.currentHp / fighter.maxHp) * 100)));
  const mpPercent = Math.max(0, Math.min(100, Math.round((fighter.currentMp / Math.max(1, fighter.maxMp)) * 100)));
  const staminaPercent = Math.max(0, Math.min(100, Math.round((fighter.currentStamina / fighter.maxStamina) * 100)));
  const shouldRenderAvatarImage = Boolean(avatarUrl) && !hasAvatarError;
  const showCompactEnemyVitals = side === 'enemy';
  const enemyStaminaState = describeStaminaState(fighter.currentStamina, fighter.maxStamina);

  useEffect(() => {
    setHasAvatarError(false);
  }, [avatarUrl]);

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
          <span className="fighter-race-line">Race: {fighter.race}</span>
          {subtitle && <span className="fighter-subtitle">{subtitle}</span>}
        </div>
        <span className={`fighter-state-badge ${fighter.isAlive ? 'alive' : 'dead'}`}>
          {fighter.isAlive ? stateLabel(visualState) : 'Down'}
        </span>
      </div>

      <div className="fighter-avatar-section">
        <div className={`combat-avatar ${fighter.isAlive ? '' : 'is-dead'}`} style={{ ['--hp-percent' as string]: `${hpPercent}%` }}>
          {shouldRenderAvatarImage ? (
            <img src={avatarUrl} alt={fighter.name} className="combat-avatar-image" onError={() => setHasAvatarError(true)} />
          ) : (
            <div className="combat-avatar-fallback">{fighter.name.slice(0, 2).toUpperCase()}</div>
          )}
          <div className="combat-avatar-base" />
          <div className="combat-avatar-hp-fill" />
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

        {showCompactEnemyVitals ? (
          <p className="fighter-vitals-note" title={`Stamina ${fighter.currentStamina}/${fighter.maxStamina}`}>
            Состояние: {enemyStaminaState}
          </p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
