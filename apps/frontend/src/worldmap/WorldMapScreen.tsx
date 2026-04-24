import { useMemo, useState } from 'react';
import type { Equipment, InventoryState, StatBlock } from '@theend/rpg-domain';
import type { ArenaCharacter } from '../arena/types';
import { TopStatusBar } from './TopStatusBar';
import { PlayerQuickPanel } from './PlayerQuickPanel';
import { WorldMapCanvas } from './WorldMapCanvas';
import { ContextActionPanel } from './ContextActionPanel';
import type { ContextMode, MapNodeData } from './types';

type LocationView = 'map' | 'arklein';

interface WorldMapScreenProps {
  character: ArenaCharacter;
  inventory: InventoryState;
  equipment: Equipment;
  battleStats: {
    hp: number;
    mp: number;
    stamina: number;
  };
  chatLines: string[];
  onOpenStats: () => void;
  onOpenInventory: () => void;
  onOpenClan: () => void;
  onExit: () => void;
  onOpenArena: () => void;
  onStartCombat: () => Promise<void>;
  onOpenMerchant: () => void;
  onOpenArenaNpc: () => void;
  onOpenSkills: () => void;
  onStatus: (text: string) => void;
}

export function WorldMapScreen(props: WorldMapScreenProps) {
  const {
    character,
    inventory,
    equipment,
    battleStats,
    chatLines,
    onOpenStats,
    onOpenInventory,
    onOpenClan,
    onExit,
    onOpenArena,
    onStartCombat,
    onOpenMerchant,
    onOpenArenaNpc,
    onOpenSkills,
    onStatus,
  } = props;

  const [contextMode, setContextMode] = useState<ContextMode>('empty');
  const [locationView, setLocationView] = useState<LocationView>('map');
  const selectedNode: MapNodeData | null = null;
  const selectedLocationName = 'Арклейн';

  const avatarLetter = character.name.trim().charAt(0).toUpperCase() || 'H';

  const quickButtons = useMemo(() => [
    {
      id: 'combat',
      tone: 'red' as const,
      icon: '⚔',
      title: 'Combat status',
      onClick: () => setContextMode('combat'),
    },
    {
      id: 'messages',
      tone: 'blue' as const,
      icon: '✉',
      title: 'Messages / quests / notifications',
      badge: 3,
      onClick: () => setContextMode('npc'),
    },
    {
      id: 'inventory',
      tone: 'yellow' as const,
      icon: '🎒',
      title: 'Инвентарь и экипировка',
      onClick: () => onOpenInventory(),
    },
  ], [onOpenInventory]);

  async function handleAction(actionId: string, kind: string): Promise<void> {
    if (kind === 'combat' || actionId === 'enter-battle') {
      await onStartCombat();
      setContextMode('combat');
      return;
    }

    if (kind === 'trade') {
      onOpenMerchant();
      onStatus(`Открыт торговец в ${selectedLocationName}.`);
      return;
    }

    if (kind === 'talk' || kind === 'quest') {
      setContextMode('npc');
      onStatus(`Interaction started in ${selectedLocationName}.`);
      return;
    }

    if (actionId === 'retreat') {
      setContextMode('location');
      onStatus('Retreat selected.');
      return;
    }

    onStatus(`Action: ${actionId}`);
  }

  function handleOpenLocation(locationId: string): void {
    if (locationId !== 'arklein') {
      return;
    }

    setLocationView('arklein');
    setContextMode('location');
    onStatus('Вы вошли в Арклейн. Заглушка города открыта.');
  }

  function handleReturnToMap(): void {
    setLocationView('map');
    setContextMode('empty');
    onStatus('Вы вернулись на карту региона.');
  }

  function handleOpenArkleinMerchant(): void {
    onOpenMerchant();
    onStatus('Открыт торговец Арклейна.');
  }

  function handleOpenSkillsTeacher(): void {
    onOpenSkills();
    onStatus('Учитель навыков Арклейна готов к обучению.');
  }

  async function handleEnterArena(): Promise<void> {
    onOpenArena();
    onStatus('Открыт зал арены Арклейна.');
  }

  return (
    <section className="wm-shell">
      <TopStatusBar
        name={character.name}
        gold={inventory.gold}
        level={character.level}
        exp={character.exp}
        statusValue={character.activeStats.strength}
        oreValue={Math.max(0, character.activeStats.constitution + 80)}
        crystalValue={Math.max(0, character.activeStats.intelligence + 40)}
        woodValue={Math.max(0, character.activeStats.stamina - 10)}
        meatValue={Math.max(0, character.activeStats.hp - 160)}
        herbValue={Math.max(0, character.activeStats.perception + 2)}
        onStats={onOpenStats}
        onSkills={onOpenSkills}
        onInventory={onOpenInventory}
        onMap={() => {
          setLocationView('map');
          setContextMode('empty');
        }}
        onClan={onOpenClan}
        onExit={onExit}
      />

      <section className="wm-grid">
        <PlayerQuickPanel
          name={character.name}
          avatarLetter={avatarLetter}
          hpText={`${battleStats.hp}/${character.activeStats.hp}`}
          mpText={`${battleStats.mp}/${character.activeStats.mp}`}
          staminaText={`${battleStats.stamina}/${character.activeStats.stamina}`}
          activeStats={character.activeStats as StatBlock}
          equipment={equipment}
          inventory={inventory}
          quickActions={quickButtons}
        />

        {locationView === 'map' ? (
          <WorldMapCanvas onOpenLocation={handleOpenLocation} />
        ) : (
          <section className="wm-map card">
            <div
              className="wm-map-surface wm-city-surface"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(24, 17, 12, 0.38), rgba(24, 17, 12, 0.62)), url('/map/City_Arclain.png')",
              }}
            >
              <div className="wm-map-title">Арклейн</div>

              <div className="wm-city-hotspots">
                <button
                  type="button"
                  className="wm-city-hotspot hotspot-market"
                  onClick={handleOpenArkleinMerchant}
                >
                  Рынок / Торговец
                </button>

                <button
                  type="button"
                  className="wm-city-hotspot hotspot-arena"
                  onClick={() => { void handleEnterArena(); }}
                >
                  Арена
                </button>

                <button
                  type="button"
                  className="wm-city-hotspot hotspot-skills"
                  onClick={handleOpenSkillsTeacher}
                >
                  МАГИЧЕСКАЯ БИБЛИОТЕКА
                </button>
              </div>
            </div>

            <footer className="wm-map-legend">
              <span>Арклейн | Нажимайте на точки на карте: Рынок, Арена, Купить навыки</span>
              <button className="wm-city-back" onClick={handleReturnToMap}>Назад к карте</button>
            </footer>
          </section>
        )}

        <div className="wm-right-stack">
          <ContextActionPanel mode={contextMode} selectedNode={selectedNode} onAction={handleAction} />

          <section className="wm-chat card">
            <h3>Чат общий</h3>
            <div className="wm-chat-log">
              {chatLines.map((line, index) => (
                <p key={`${line}-${index}`}>{line}</p>
              ))}
            </div>
            <div className="wm-chat-input">
              <input placeholder="Введите сообщение..." />
              <button>▶</button>
            </div>
          </section>
        </div>
      </section>

      <footer className="wm-footer card">
        <span>Локация: {selectedLocationName} (52, 38)</span>
        <span>Онлайн: 124</span>
        <span>Почта (2)</span>
        <span>22:41</span>
      </footer>
    </section>
  );
}
