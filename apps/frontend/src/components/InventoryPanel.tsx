import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Equipment, InventoryState, ItemDefinition, PrimaryStat } from '@theend/rpg-domain';
import { getItemById, getItemHandsRequired } from '@theend/rpg-domain';
import type { ArenaCharacter } from '../arena/types';
import { PaperDoll } from './PaperDoll';
import { PAPER_DOLL_ASSETS, type EquipmentSlotId, type PaperDollRace } from './paperDollSlots';
import {
  getRaceSilhouette,
  getRaceSilhouetteFallback,
} from '../utils/raceSilhouette';

export type CharacterPageFocus = 'character' | 'equipment' | 'inventory' | 'stats' | 'skills';

interface InventoryPanelProps {
  character: ArenaCharacter;
  inventory: InventoryState;
  equipment: Equipment;
  learnedSkills: string[];
  pendingStatAllocation: Partial<Record<PrimaryStat, number>>;
  freePointsLeft: number;
  allocatingStats: boolean;
  focusSection: CharacterPageFocus;
  onClose: () => void;
  onStatus: (text: string) => void;
  onEquipItem: (itemId: string) => Promise<void>;
  onUnequipSlot: (slot: keyof Equipment) => Promise<void>;
  onAdjustStat: (stat: PrimaryStat, delta: number) => void;
  onApplyStatAllocation: () => Promise<void>;
  onUseItem?: (itemId: string) => Promise<void>;
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveItemImage?: (item: ItemDefinition | null | undefined) => string | undefined;
}

const CORE_SLOT_BY_LAYOUT: Partial<Record<EquipmentSlotId, keyof Equipment>> = {
  helmet: 'helmet',
  armor: 'armor',
  boots: 'boots',
  gloves: 'gloves',
  leftHand: 'shield',
  rightHand: 'weapon',
};

const SLOT_LABELS: Record<EquipmentSlotId, string> = {
  helmet: 'Helmet / Шлем',
  necklace: 'Necklace / Амулет',
  armor: 'Armor / Броня',
  cloak: 'Cloak / Плащ',
  belt: 'Belt / Пояс',
  leftHand: 'Left Hand / Левая рука',
  gloves: 'Gloves / Перчатки',
  rightHand: 'Right Hand / Правая рука',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  ring3: 'Ring 3',
  knees: 'Knees / Наколенники',
  boots: 'Boots / Сапоги',
  quick1: 'Quick 1',
  quick2: 'Quick 2',
  quick3: 'Quick 3',
  quick4: 'Quick 4',
  quick5: 'Quick 5',
  quick6: 'Quick 6',
  quick7: 'Quick 7',
  quick8: 'Quick 8',
  quick9: 'Quick 9',
  quick10: 'Quick 10',
};

const SLOT_ACCEPTED_TYPES: Record<EquipmentSlotId, string[]> = {
  helmet: ['helmet', 'hat', 'hood', 'crown'],
  necklace: ['necklace', 'amulet', 'pendant', 'chain', 'small_accessory'],
  armor: ['armor', 'chest_armor', 'robe'],
  cloak: ['cloak', 'cape', 'fur_cloak', 'mantle', 'small_accessory'],
  belt: ['belt', 'small_accessory'],
  leftHand: ['shield', 'offhand'],
  gloves: ['gloves', 'bracers'],
  rightHand: ['one_handed_weapon', 'two_handed_weapon', 'sword', 'axe', 'mace', 'bow', 'staff', 'hammer', 'spear', 'dagger'],
  ring1: ['ring', 'small_accessory'],
  ring2: ['ring', 'small_accessory'],
  ring3: ['ring', 'small_accessory'],
  knees: ['kneepads', 'leg_armor', 'pants'],
  boots: ['boots', 'shoes'],
  quick1: ['quick_item', 'consumable', 'consumable_combat', 'small_accessory'],
  quick2: ['quick_item', 'consumable', 'consumable_combat', 'small_accessory'],
  quick3: ['quick_item', 'consumable', 'consumable_combat', 'small_accessory'],
  quick4: ['quick_item', 'consumable', 'consumable_combat', 'small_accessory'],
  quick5: ['quick_item', 'consumable', 'consumable_combat', 'small_accessory'],
  quick6: ['quick_item', 'consumable', 'consumable_combat', 'small_accessory'],
  quick7: ['quick_item', 'consumable', 'consumable_combat', 'small_accessory'],
  quick8: ['quick_item', 'consumable', 'consumable_combat', 'small_accessory'],
  quick9: ['quick_item', 'consumable', 'consumable_combat', 'small_accessory'],
  quick10: ['quick_item', 'consumable', 'consumable_combat', 'small_accessory'],
};

const ALL_SLOT_IDS = Object.keys(SLOT_LABELS) as EquipmentSlotId[];

const STATS_ORDER: PrimaryStat[] = [
  'hp',
  'mp',
  'stamina',
  'strength',
  'constitution',
  'dexterity',
  'intelligence',
  'luck',
  'perception',
  'willpower',
];

const STAT_LABELS: Record<PrimaryStat, string> = {
  hp: 'HP',
  mp: 'Mana',
  stamina: 'Stamina',
  strength: 'Strength',
  constitution: 'Constitution',
  dexterity: 'Dexterity',
  intelligence: 'Intelligence',
  luck: 'Luck',
  perception: 'Perception',
  willpower: 'Willpower',
};

const SKILL_NAMES: Record<string, string> = {
  NONE: 'Базовая атака',
  POWER_STRIKE: 'Power Strike',
  CRUSHING_BLOCK: 'Crushing Block',
  RAGE: 'Rage',
  FIREBALL: 'Пламя Фелдана',
  FROST_LANCE: 'Frost Lance',
  SHIELD_BASH: 'Таран Арклейна',
  WHIRLWIND: 'Whirlwind',
};

const FOCUS_SECTION_COLUMN: Record<CharacterPageFocus, 'left' | 'center' | 'right'> = {
  character: 'left',
  equipment: 'left',
  inventory: 'center',
  stats: 'right',
  skills: 'right',
};

function getItemCategories(item: ItemDefinition): string[] {
  const categories = new Set<string>([item.itemType, item.itemSubType, 'small_accessory']);

  if (item.itemType === 'weapon') {
    if (getItemHandsRequired(item) === 2) {
      categories.add('two_handed_weapon');
    } else {
      categories.add('one_handed_weapon');
    }
    if (item.itemSubType === 'daggers') {
      categories.add('dagger');
      categories.add('knife');
    }
    categories.add(item.itemSubType);
  }

  if (item.itemType === 'consumable') {
    categories.add('quick_item');
    categories.add('consumable_combat');
  }

  if (item.itemType === 'shield') {
    categories.add('offhand');
  }

  if (item.itemType === 'armor') {
    categories.add('chest_armor');
  }

  return [...categories];
}

export function canEquipItemInSlot(item: ItemDefinition, slotId: EquipmentSlotId): boolean {
  const accepted = SLOT_ACCEPTED_TYPES[slotId];
  if (!accepted) {
    return false;
  }

  const categories = getItemCategories(item);
  return accepted.some((itemType) => categories.includes(itemType));
}

export function getAcceptedSlotsForItem(item: ItemDefinition): EquipmentSlotId[] {
  return ALL_SLOT_IDS.filter((slotId) => canEquipItemInSlot(item, slotId));
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({
  character,
  inventory,
  equipment,
  learnedSkills,
  pendingStatAllocation,
  freePointsLeft,
  allocatingStats,
  focusSection,
  onClose,
  onStatus,
  onEquipItem,
  onUnequipSlot,
  onAdjustStat,
  onApplyStatAllocation,
  onUseItem,
  resolveItemById,
  resolveItemImage,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillTab, setSkillTab] = useState<'skills' | 'abilities' | 'passives' | 'status'>('skills');
  const [virtualEquipment, setVirtualEquipment] = useState<Partial<Record<EquipmentSlotId, string>>>({});
  const [silhouetteBroken, setSilhouetteBroken] = useState(false);
  const [silhouetteSrc, setSilhouetteSrc] = useState<string>(() => getRaceSilhouette(character.race));

  const leftColumnRef = useRef<HTMLElement | null>(null);
  const centerColumnRef = useRef<HTMLElement | null>(null);
  const rightColumnRef = useRef<HTMLElement | null>(null);

  const inventoryEntries = useMemo(
    () => inventory.items
      .map((entry) => {
        const item = resolveItemById ? resolveItemById(entry.itemId) : getItemById(entry.itemId);
        return item ? { item, quantity: entry.quantity } : null;
      })
      .filter(Boolean) as Array<{ item: ItemDefinition; quantity: number }>,
    [inventory.items, resolveItemById],
  );

  const inventoryByItemId = useMemo(
    () => new Map(inventoryEntries.map((entry) => [entry.item.id, entry])),
    [inventoryEntries],
  );

  const selectedInventoryEntry = useMemo(
    () => (selectedItemId ? inventoryByItemId.get(selectedItemId) ?? null : null),
    [inventoryByItemId, selectedItemId],
  );

  const selectedItem = selectedInventoryEntry?.item ?? null;
  const equippedWeapon = useMemo(
    () => (equipment.weapon ? (resolveItemById ? resolveItemById(equipment.weapon) : getItemById(equipment.weapon)) : null),
    [equipment.weapon, resolveItemById],
  );
  const selectedItemHandsRequired = selectedItem ? getItemHandsRequired(selectedItem) : 1;
  const selectedIsTwoHandedWeapon = Boolean(selectedItem && selectedItem.itemType === 'weapon' && selectedItemHandsRequired === 2);
  const shieldBlockedByTwoHandedWeapon = Boolean(selectedItem?.itemType === 'shield' && equippedWeapon && getItemHandsRequired(equippedWeapon) === 2);

  const paperDollRace = (character.race in PAPER_DOLL_ASSETS ? character.race : 'HUMAN') as PaperDollRace;
  const paperDollDebug = useMemo(() => {
    if (!import.meta.env.DEV) {
      return false;
    }

    try {
      return window.localStorage.getItem('paperDoll.debug') === '1';
    } catch {
      return false;
    }
  }, []);

  const equippedByLayoutSlot = useMemo(() => {
    const full: Partial<Record<EquipmentSlotId, ItemDefinition | null>> = {};

    for (const slotId of ALL_SLOT_IDS) {
      const coreSlot = CORE_SLOT_BY_LAYOUT[slotId];
      if (coreSlot) {
        const itemId = equipment[coreSlot];
        full[slotId] = itemId ? (resolveItemById ? resolveItemById(itemId) : getItemById(itemId)) : null;
      } else {
        const itemId = virtualEquipment[slotId] ?? null;
        full[slotId] = itemId ? (resolveItemById ? resolveItemById(itemId) : getItemById(itemId)) : null;
      }
    }

    return full;
  }, [equipment, resolveItemById, virtualEquipment]);

  useEffect(() => {
    if (!selectedItemId && inventoryEntries.length > 0) {
      setSelectedItemId(inventoryEntries[0].item.id);
      return;
    }

    if (selectedItemId && !inventoryEntries.some((entry) => entry.item.id === selectedItemId)) {
      setSelectedItemId(inventoryEntries[0]?.item.id ?? null);
    }
  }, [inventoryEntries, selectedItemId]);

  useEffect(() => {
    const target = FOCUS_SECTION_COLUMN[focusSection];
    if (target === 'left') {
      leftColumnRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    if (target === 'center') {
      centerColumnRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    if (target === 'right') {
      rightColumnRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [focusSection]);

  const equippedItemIds = useMemo(
    () => new Set(Object.values(equippedByLayoutSlot).filter((item): item is ItemDefinition => Boolean(item)).map((item) => item.id)),
    [equippedByLayoutSlot],
  );
  const selectedAlreadyEquipped = Boolean(selectedItem && equippedItemIds.has(selectedItem.id));

  useEffect(() => {
    setSilhouetteBroken(false);
    setSilhouetteSrc(getRaceSilhouette(paperDollRace as any));
  }, [paperDollRace]);

  const skillItems = useMemo(
    () => learnedSkills.map((skillId) => ({
      id: skillId,
      name: SKILL_NAMES[skillId] ?? skillId,
      type: skillTab,
      description: skillTab === 'status' ? 'Статусный эффект из текущего билда.' : 'Детали будут расширены в следующем обновлении.',
    })),
    [learnedSkills, skillTab],
  );

  const selectedSkill = skillItems.find((skill) => skill.id === selectedSkillId) ?? null;

  async function equipToSlot(slotId: EquipmentSlotId, item: ItemDefinition): Promise<void> {
    if (!canEquipItemInSlot(item, slotId)) {
      onStatus('Item cannot be equipped in this slot');
      return;
    }

    const coreSlot = CORE_SLOT_BY_LAYOUT[slotId];
    if (coreSlot) {
      try {
        await onEquipItem(item.id);
      } catch {
        // parent already reports error status
      }
      return;
    }

    setVirtualEquipment((current) => ({ ...current, [slotId]: item.id }));
    onStatus(`${item.name} assigned to ${slotId}`);
  }

  async function equipSelectedItem(): Promise<void> {
    if (!selectedItem) {
      return;
    }

    if (shieldBlockedByTwoHandedWeapon) {
      onStatus('Левая рука занята двуручным оружием. Сначала снимите его.');
      return;
    }

    const acceptedSlots = getAcceptedSlotsForItem(selectedItem);
    if (acceptedSlots.length === 0) {
      onStatus('This item has no valid equipment slot mapping.');
      return;
    }

    const firstEmpty = acceptedSlots.find((slotId) => !equippedByLayoutSlot[slotId]);
    await equipToSlot(firstEmpty ?? acceptedSlots[0], selectedItem);
  }

  async function unequipFromSlot(slotId: EquipmentSlotId): Promise<void> {
    const coreSlot = CORE_SLOT_BY_LAYOUT[slotId];
    if (coreSlot) {
      try {
        await onUnequipSlot(coreSlot);
      } catch {
        // parent already reports error status
      }
      return;
    }

    setVirtualEquipment((current) => {
      const next = { ...current };
      delete next[slotId];
      return next;
    });
  }

  const focusedColumnClass = FOCUS_SECTION_COLUMN[focusSection];

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true">
      <section className="card battle-window wm-modal character-page-modal">
        <div className="battle-window-head">
          <h2>Character Page - {character.name}</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="character-page-grid">
          <section ref={leftColumnRef} className={`character-column character-left ${focusedColumnClass === 'left' ? 'is-focused' : ''}`}>
            <section className="character-status-card">
              <div className="character-status-head">
                <div className="character-avatar-circle">{character.name.charAt(0).toUpperCase()}</div>
                <div>
                  <strong>{character.name}</strong>
                  <p className="muted">Race: {character.race}</p>
                </div>
              </div>
              <div className="character-status-bars">
                <p>HP {character.activeStats.hp}</p>
                <p>Mana {character.activeStats.mp}</p>
                <p>Stamina {character.activeStats.stamina}</p>
                <p>Gold {inventory.gold}</p>
              </div>
            </section>

            <section className="character-paperdoll-card">
              <div className="character-paperdoll-canvas inventory-wrapper">
                {!silhouetteBroken ? (
                  <PaperDoll
                    race={paperDollRace}
                    imageSrc={silhouetteSrc}
                    slotItems={equippedByLayoutSlot}
                    slotLabels={SLOT_LABELS}
                    resolveItemImage={resolveItemImage}
                    debug={paperDollDebug}
                    onImageError={() => {
                      const fallback = getRaceSilhouetteFallback(paperDollRace as any);
                      if (silhouetteSrc !== fallback) {
                        setSilhouetteSrc(fallback);
                        return;
                      }
                      setSilhouetteBroken(true);
                    }}
                    onSlotClick={(slotId) => {
                      const equippedItem = equippedByLayoutSlot[slotId] ?? null;
                      if (equippedItem) {
                        setSelectedItemId(equippedItem.id);
                        return;
                      }

                      if (selectedItem) {
                        void equipToSlot(slotId, selectedItem);
                      }
                    }}
                    onSlotDrop={(slotId, itemId) => {
                      try {
                        const item = resolveItemById ? resolveItemById(itemId) : getItemById(itemId);
                        if (item) {
                          void equipToSlot(slotId, item);
                        }
                      } catch {
                        // ignore invalid drop payload
                      }
                    }}
                    onSlotContextMenu={(slotId) => {
                      if (equippedByLayoutSlot[slotId]) {
                        void unequipFromSlot(slotId);
                      }
                    }}
                  />
                ) : null}
              </div>
            </section>
          </section>

          <section ref={centerColumnRef} className={`character-column character-center ${focusedColumnClass === 'center' ? 'is-focused' : ''}`}>
            <section className="character-backpack-card">
              <div className="character-backpack-head">
                <h3>Рюкзак / Backpack</h3>
                <p className="gold">🪙 {inventory.gold}</p>
              </div>

              <div className="character-inventory-grid-wrap">
                <div className="character-inventory-grid">
                  {inventoryEntries.map((entry) => (
                    <button
                      key={entry.item.id}
                      type="button"
                      className={`character-item-card ${selectedItemId === entry.item.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedItemId(entry.item.id)}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/theend-item-id', entry.item.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                    >
                      <span
                        className="character-item-icon"
                        style={resolveItemImage?.(entry.item)
                          ? {
                              backgroundImage: `url("${resolveItemImage(entry.item)}")`,
                              backgroundSize: 'contain',
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'center',
                            }
                          : undefined}
                      >
                        {!resolveItemImage?.(entry.item) ? entry.item.name.slice(0, 1).toUpperCase() : null}
                      </span>
                      <span className="character-item-name">{entry.item.name}</span>
                      <span className="character-item-qty">x{entry.quantity}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="character-item-detail-card">
              <h3>Item Details</h3>
              {selectedItem ? (
                <>
                  <strong>{selectedItem.name}</strong>
                  <p className="muted">Type: {selectedItem.itemType} / {selectedItem.itemSubType}</p>
                  {selectedItem.itemType === 'weapon' ? (
                    <p className="muted">Hands: {selectedItemHandsRequired === 2 ? 'Two-handed / Двуручное' : 'One-handed / Одноручное'}</p>
                  ) : null}
                  <p className="muted">Rarity: {selectedItem.rarity}</p>
                  <p>{selectedItem.description}</p>
                  {selectedIsTwoHandedWeapon && equipment.shield ? (
                    <p className="muted">Equipping this weapon will remove the offhand item and leave it in your inventory.</p>
                  ) : null}
                  {shieldBlockedByTwoHandedWeapon ? (
                    <p className="muted">Cannot equip this offhand item while a two-handed weapon is worn.</p>
                  ) : null}
                  <p className="muted">
                    Bonuses: {Object.entries(selectedItem.bonuses).map(([key, value]) => `${key} ${value ?? 0}`).join(', ') || 'none'}
                  </p>
                  <p className="muted">
                    Requirements: {Object.entries(selectedItem.requiredStats).map(([key, value]) => `${key} ${value ?? 0}`).join(', ') || 'none'}
                  </p>
                  <div className="character-item-actions">
                    <button
                      disabled={selectedAlreadyEquipped}
                      onClick={() => {
                        void equipSelectedItem();
                      }}
                    >
                      {selectedAlreadyEquipped ? 'Equipped' : 'Equip'}
                    </button>
                    <button
                      disabled={selectedItem.itemType !== 'consumable'}
                      onClick={() => {
                        if (onUseItem) {
                          void onUseItem(selectedItem.id);
                        } else {
                          onStatus('Use action is not available in this context.');
                        }
                      }}
                    >
                      Use
                    </button>
                    <button disabled>Drop</button>
                  </div>
                </>
              ) : (
                <p className="muted">Select an item from backpack.</p>
              )}
            </section>
          </section>

          <section ref={rightColumnRef} className={`character-column character-right ${focusedColumnClass === 'right' ? 'is-focused' : ''}`}>
            <section className="character-stats-card">
              <h3>Stats</h3>
              <p className="muted">Free points: {freePointsLeft}</p>
              <div className="character-stats-list">
                {STATS_ORDER.map((stat) => (
                  <div key={stat} className="character-stat-row">
                    <span>{STAT_LABELS[stat]}</span>
                    <strong>{character.activeStats[stat]}</strong>
                    <div className="mini-stepper">
                      <button disabled={freePointsLeft <= 0} onClick={() => onAdjustStat(stat, 1)}>+</button>
                      <button disabled={(pendingStatAllocation[stat] ?? 0) <= 0} onClick={() => onAdjustStat(stat, -1)}>-</button>
                    </div>
                  </div>
                ))}
              </div>
              <button disabled={allocatingStats || Object.keys(pendingStatAllocation).length === 0} onClick={() => void onApplyStatAllocation()}>
                {allocatingStats ? 'Applying...' : 'Apply'}
              </button>
            </section>

            <section className="character-meta-card">
              <h3>Level / Progression</h3>
              <p>Level: {character.level}</p>
              <p>Experience: {character.exp}</p>
              <p>Faction: None</p>
              <p>Reputation: None</p>
              <p>Professions: Не изучено</p>
              <p>Class: None</p>
              <p>Race: {character.race}</p>
            </section>

            <section className="character-skills-card">
              <div className="character-skills-tabs">
                <button className={skillTab === 'skills' ? 'is-active' : ''} onClick={() => setSkillTab('skills')}>Skills</button>
                <button className={skillTab === 'abilities' ? 'is-active' : ''} onClick={() => setSkillTab('abilities')}>Abilities</button>
                <button className={skillTab === 'passives' ? 'is-active' : ''} onClick={() => setSkillTab('passives')}>Passives</button>
                <button className={skillTab === 'status' ? 'is-active' : ''} onClick={() => setSkillTab('status')}>Status</button>
              </div>

              <div className="character-skills-list">
                {skillItems.length > 0 ? skillItems.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    className={`character-skill-card ${selectedSkillId === skill.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedSkillId(skill.id)}
                  >
                    <span className="character-skill-icon">{skill.name.slice(0, 2).toUpperCase()}</span>
                    <span>
                      <strong>{skill.name}</strong>
                      <small>{skill.type}</small>
                    </span>
                  </button>
                )) : (
                  <p className="muted">Навыки пока не изучены</p>
                )}
              </div>

              <div className="character-skill-detail">
                {selectedSkill ? (
                  <>
                    <strong>{selectedSkill.name}</strong>
                    <p>{selectedSkill.description}</p>
                    <p>Mana cost: variable</p>
                    <p>Stamina cost: variable</p>
                    <p>Cooldown: none</p>
                  </>
                ) : (
                  <p className="muted">Select a skill or state to inspect.</p>
                )}
              </div>
            </section>
          </section>
        </div>
      </section>
    </div>
  );
};
