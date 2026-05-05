import { EMPTY_EQUIPMENT, Race, type InventoryState } from '@theend/rpg-domain';
import { useMemo, useState } from 'react';
import { WorldMapScreen } from '../../worldmap/WorldMapScreen';

const EMPTY_INVENTORY: InventoryState = {
  gold: 0,
  items: [],
};

const ADMIN_EDITOR_CHARACTER = {
  id: 'admin-zone-editor',
  name: 'Zone Editor',
  race: Race.Human,
  level: 1,
  exp: 0,
  freePoints: 0,
  baseStats: {
    hp: 120,
    mp: 40,
    stamina: 80,
    strength: 5,
    constitution: 5,
    dexterity: 5,
    intelligence: 5,
    luck: 5,
    perception: 5,
    willpower: 5,
  },
  activeStats: {
    hp: 120,
    mp: 40,
    stamina: 80,
    strength: 5,
    constitution: 5,
    dexterity: 5,
    intelligence: 5,
    luck: 5,
    perception: 5,
    willpower: 5,
  },
  currentHp: 120,
  maxHp: 120,
  currentMp: 40,
  maxMp: 40,
  currentStamina: 80,
  maxStamina: 80,
  hpRegenPerTurn: 0,
} as const;

export function ZoneEditorPage() {
  const [status, setStatus] = useState('Zone Editor готов.');

  const chatLines = useMemo(() => [status], [status]);

  return (
    <div className="admin-editor-page">
      <WorldMapScreen
        character={ADMIN_EDITOR_CHARACTER}
        inventory={EMPTY_INVENTORY}
        equipment={EMPTY_EQUIPMENT}
        battleStats={{
          hp: ADMIN_EDITOR_CHARACTER.activeStats.hp,
          mp: ADMIN_EDITOR_CHARACTER.activeStats.mp,
          stamina: ADMIN_EDITOR_CHARACTER.activeStats.stamina,
        }}
        chatLines={chatLines}
        onOpenStats={() => setStatus('Admin editor mode: stats panel disabled.')}
        onOpenInventory={() => setStatus('Admin editor mode: inventory panel disabled.')}
        onOpenCharacter={() => setStatus('Admin editor mode: character panel disabled.')}
        onOpenEquipment={() => setStatus('Admin editor mode: equipment panel disabled.')}
        onOpenClan={() => setStatus('Admin editor mode: clan panel disabled.')}
        onExit={() => setStatus('Admin editor mode active.')}
        onStartCombat={async () => {
          setStatus('Admin editor mode: combat disabled.');
        }}
        onOpenMerchant={() => setStatus('Admin editor mode: merchants disabled.')}
        onOpenSkills={() => setStatus('Admin editor mode: skills disabled.')}
        onStatus={setStatus}
        cityMerchants={[]}
        initialMode="editor"
        adminEditorOnly
      />
      <div className="admin-editor-status">{status}</div>
    </div>
  );
}
