import { useEffect, useState } from 'react';

interface TopStatusBarProps {
  name: string;
  gold: number;
  level: number;
  exp: number;
  statusValue: number;
  oreValue: number;
  crystalValue: number;
  woodValue: number;
  meatValue: number;
  herbValue: number;
  onStats: () => void;
  onSkills: () => void;
  onInventory: () => void;
  onMap: () => void;
  onClan: () => void;
  onExit: () => void;
}

export function TopStatusBar(props: TopStatusBarProps) {
  const {
    name,
    gold,
    level,
    exp,
    statusValue,
    oreValue,
    crystalValue,
    woodValue,
    meatValue,
    herbValue,
    onStats,
    onSkills,
    onInventory,
    onMap,
    onClan,
    onExit,
  } = props;
  const [goldPulse, setGoldPulse] = useState<'up' | 'down' | null>(null);
  const [prevGold, setPrevGold] = useState(gold);

  useEffect(() => {
    if (gold === prevGold) {
      return;
    }
    setGoldPulse(gold > prevGold ? 'up' : 'down');
    setPrevGold(gold);
    const timeout = window.setTimeout(() => setGoldPulse(null), 420);
    return () => window.clearTimeout(timeout);
  }, [gold, prevGold]);

  return (
    <header className="wm-topbar card">
      <div className="wm-brand">
        <strong>THEEND</strong>
        <span>{name}</span>
      </div>

      <nav className="wm-nav">
        <button onClick={onStats}>Статы</button>
        <button onClick={onInventory}>Инвентарь</button>
        <button onClick={onSkills}>Навыки</button>
        <button onClick={onStats}>Персонаж</button>
        <button onClick={onMap}>Карта</button>
        <button onClick={onInventory}>Экипировка</button>
        <button onClick={onStats}>Рейды</button>
        <button onClick={onClan}>Клан</button>
        <button onClick={onStats}>Настройки</button>
        <button onClick={onExit}>Выход</button>
      </nav>

      <div className="wm-stats-strip">
        <span title="Current gold balance" className={goldPulse ? `is-${goldPulse}` : ''}>🪙 {gold}</span>
        <span title="Current character level">✶ {level}</span>
        <span title="Current XP progress to next level">{exp} xp</span>
        <span title="Power">⚔ {statusValue}</span>
        <span title="Ore">⛏ {oreValue}</span>
        <span title="Crystals">◈ {crystalValue}</span>
        <span title="Wood">🪵 {woodValue}</span>
        <span title="Rations">🍖 {meatValue}</span>
        <span title="Herbs">☘ {herbValue}</span>
      </div>
    </header>
  );
}
