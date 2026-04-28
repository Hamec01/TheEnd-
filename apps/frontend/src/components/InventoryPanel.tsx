import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Equipment, InventoryState, ItemDefinition, PrimaryStat, StatBlock } from '@theend/rpg-domain';
import { calculateDerivedStats, getItemById, getItemHandsRequired } from '@theend/rpg-domain';
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
  onEquipItem: (itemId: string, slot?: 'weapon' | 'shield') => Promise<void>;
  onUnequipSlot: (slot: keyof Equipment) => Promise<void>;
  onAdjustStat: (stat: PrimaryStat, delta: number) => void;
  onApplyStatAllocation: () => Promise<void>;
  onResetStatAllocation?: () => void;
  onUseItem?: (itemId: string) => Promise<void>;
  playerAvatarUrl?: string;
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

export function canEquipItemInSlot(item: ItemDefinition, slotId: EquipmentSlotId): boolean {
  switch (slotId) {
    case 'rightHand':
      return item.itemType === 'weapon';
    case 'leftHand':
      return item.itemType === 'shield' || (item.itemType === 'weapon' && getItemHandsRequired(item) === 1);
    case 'helmet':
      return item.itemType === 'helmet';
    case 'armor':
      return item.itemType === 'armor';
    case 'boots':
      return item.itemType === 'boots';
    case 'gloves':
      return item.itemType === 'gloves';
    default:
      return false;
  }
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
  onResetStatAllocation,
  onUseItem,
  playerAvatarUrl,
  resolveItemById,
  resolveItemImage,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemDetailOpen, setItemDetailOpen] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillTab, setSkillTab] = useState<'skills' | 'abilities' | 'passives' | 'status'>('skills');
  const [silhouetteBroken, setSilhouetteBroken] = useState(false);
  const [silhouetteSrc, setSilhouetteSrc] = useState<string>(() => getRaceSilhouette(character.race));

  const leftColumnRef = useRef<HTMLElement | null>(null);
  const centerColumnRef = useRef<HTMLElement | null>(null);
  const rightColumnRef = useRef<HTMLElement | null>(null);

  const previewStats = useMemo<StatBlock>(() => {
    const next = { ...character.activeStats };
    for (const stat of STATS_ORDER) {
      const points = pendingStatAllocation[stat] ?? 0;
      if (points <= 0) {
        continue;
      }
      if (stat === 'hp' || stat === 'mp' || stat === 'stamina') {
        next[stat] += points * 10;
      } else {
        next[stat] += points;
      }
    }
    return next;
  }, [character.activeStats, pendingStatAllocation]);

  const derivedBase = useMemo(() => calculateDerivedStats(character.activeStats, equipment), [character.activeStats, equipment]);
  const derivedPreview = useMemo(() => calculateDerivedStats(previewStats, equipment), [equipment, previewStats]);

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

  const selectedItem = useMemo(
    () => (selectedItemId ? selectedInventoryEntry?.item ?? (resolveItemById ? resolveItemById(selectedItemId) : getItemById(selectedItemId)) : null),
    [resolveItemById, selectedInventoryEntry, selectedItemId],
  );
  const equippedWeapon = useMemo(
    () => (equipment.weapon ? (resolveItemById ? resolveItemById(equipment.weapon) : getItemById(equipment.weapon)) : null),
    [equipment.weapon, resolveItemById],
  );
  const selectedItemHandsRequired = selectedItem ? getItemHandsRequired(selectedItem) : 1;
  const selectedIsTwoHandedWeapon = Boolean(selectedItem && selectedItem.itemType === 'weapon' && selectedItemHandsRequired === 2);
  const shieldBlockedByTwoHandedWeapon = Boolean(selectedItem?.itemType === 'shield' && equippedWeapon && getItemHandsRequired(equippedWeapon) === 2);

  const paperDollRace = (character.race in PAPER_DOLL_ASSETS ? character.race : 'HUMAN') as PaperDollRace;
  const paperDollDebug = false;

  const equippedByLayoutSlot = useMemo(() => {
    const full: Partial<Record<EquipmentSlotId, ItemDefinition | null>> = {};

    for (const slotId of ALL_SLOT_IDS) {
      const coreSlot = CORE_SLOT_BY_LAYOUT[slotId];
      const itemId = coreSlot ? equipment[coreSlot] : null;
      full[slotId] = itemId ? (resolveItemById ? resolveItemById(itemId) : getItemById(itemId)) : null;
    }

    return full;
  }, [equipment, resolveItemById]);

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
  const selectedEquippedSlotId = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    return ALL_SLOT_IDS.find((slotId) => equippedByLayoutSlot[slotId]?.id === selectedItem.id) ?? null;
  }, [equippedByLayoutSlot, selectedItem]);
  const selectedAlreadyEquipped = Boolean(selectedItem && equippedItemIds.has(selectedItem.id));

  useEffect(() => {
    if (!selectedItemId && inventoryEntries.length > 0) {
      setSelectedItemId(inventoryEntries[0].item.id);
      return;
    }

    if (
      selectedItemId
      && !inventoryEntries.some((entry) => entry.item.id === selectedItemId)
      && !equippedItemIds.has(selectedItemId)
    ) {
      setSelectedItemId(inventoryEntries[0]?.item.id ?? null);
      setItemDetailOpen(false);
    }
  }, [equippedItemIds, inventoryEntries, selectedItemId]);

  const comparisonSlotId = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    return selectedEquippedSlotId
      ?? getAcceptedSlotsForItem(selectedItem).find((slotId) => Boolean(CORE_SLOT_BY_LAYOUT[slotId]))
      ?? null;
  }, [selectedEquippedSlotId, selectedItem]);

  const comparisonCoreSlot = comparisonSlotId ? CORE_SLOT_BY_LAYOUT[comparisonSlotId] ?? null : null;
  const comparisonCurrentItem = comparisonSlotId ? equippedByLayoutSlot[comparisonSlotId] ?? null : null;
  const selectedPreviewEquipment = useMemo<Equipment>(() => {
    if (!selectedItem || !comparisonCoreSlot || selectedAlreadyEquipped) {
      return equipment;
    }

    const next: Equipment = {
      ...equipment,
      [comparisonCoreSlot]: selectedItem.id,
    };

    if (selectedItem.itemType === 'weapon' && getItemHandsRequired(selectedItem) === 2) {
      next.shield = null;
    }

    return next;
  }, [comparisonCoreSlot, equipment, selectedAlreadyEquipped, selectedItem]);

  const derivedItemPreview = useMemo(
    () => calculateDerivedStats(character.activeStats, selectedPreviewEquipment),
    [character.activeStats, selectedPreviewEquipment],
  );

  const itemComparisonRows = [
    ['Defense', derivedBase.totalDefense, derivedItemPreview.totalDefense],
    ['Min Damage', derivedBase.minDamage, derivedItemPreview.minDamage],
    ['Max Damage', derivedBase.maxDamage, derivedItemPreview.maxDamage],
    ['Crit', derivedBase.critChance, derivedItemPreview.critChance],
    ['Block', derivedBase.blockChance, derivedItemPreview.blockChance],
    ['STA Load', derivedBase.staminaLoad, derivedItemPreview.staminaLoad],
  ] as const;

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
    const coreSlot = CORE_SLOT_BY_LAYOUT[slotId];
    if (!coreSlot) {
      onStatus('Этот слот пока декоративный и не поддерживает экипировку.');
      return;
    }

    if (!canEquipItemInSlot(item, slotId)) {
      onStatus('Этот предмет нельзя надеть в выбранный слот.');
      return;
    }

    try {
      const preferredHand = coreSlot === 'weapon' || coreSlot === 'shield' ? coreSlot : undefined;
      await onEquipItem(item.id, preferredHand);
    } catch {
      // parent already reports error status
    }
  }

  async function equipSelectedItem(): Promise<void> {
    if (!selectedItem) {
      return;
    }

    if (!selectedInventoryEntry) {
      onStatus('This item is already equipped. Unequip it first if you want it back in the backpack.');
      return;
    }

    if (shieldBlockedByTwoHandedWeapon) {
      onStatus('Левая рука занята двуручным оружием. Сначала снимите его.');
      return;
    }

    const acceptedSlots = getAcceptedSlotsForItem(selectedItem);
    if (acceptedSlots.length === 0) {
      onStatus('Этот предмет нельзя экипировать.');
      return;
    }

    const firstEmpty = acceptedSlots.find((slotId) => !equippedByLayoutSlot[slotId]);
    await equipToSlot(firstEmpty ?? acceptedSlots[0], selectedItem);
  }

  async function unequipFromSlot(slotId: EquipmentSlotId): Promise<void> {
    const coreSlot = CORE_SLOT_BY_LAYOUT[slotId];
    if (!coreSlot) {
      onStatus('Этот слот пока декоративный и не поддерживает снятие предметов.');
      return;
    }

    try {
      await onUnequipSlot(coreSlot);
    } catch {
      // parent already reports error status
    }
  }

  const focusedColumnClass = FOCUS_SECTION_COLUMN[focusSection];

  const hasPendingAllocation = Object.keys(pendingStatAllocation).length > 0;

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
                {playerAvatarUrl ? (
                  <img src={playerAvatarUrl} alt={character.name} className="character-avatar-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="character-avatar-circle">{character.name.charAt(0).toUpperCase()}</div>
                )}
                <div>
                  <strong>{character.name}</strong>
                  <p className="muted">Race: {character.race}</p>
                </div>
              </div>
              <div className="character-status-bars">
                <p><span>HP</span><strong>{character.activeStats.hp}</strong></p>
                <p><span>Mana</span><strong>{character.activeStats.mp}</strong></p>
                <p><span>Stamina</span><strong>{character.activeStats.stamina}</strong></p>
                <p><span>Gold</span><strong>{inventory.gold}</strong></p>
                <p><span>Total Defense</span><strong>{derivedPreview.totalDefense}</strong></p>
                <p><span>Min Damage</span><strong>{derivedPreview.minDamage}</strong></p>
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
                    canDropItemInSlot={(slotId, itemId) => {
                      try {
                        const item = resolveItemById ? resolveItemById(itemId) : getItemById(itemId);
                        return Boolean(item && canEquipItemInSlot(item, slotId));
                      } catch {
                        return false;
                      }
                    }}
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
                        setItemDetailOpen(true);
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
                      onClick={() => {
                        setSelectedItemId(entry.item.id);
                        setItemDetailOpen(true);
                      }}
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
                      disabled={!selectedEquippedSlotId}
                      onClick={() => {
                        if (selectedEquippedSlotId) {
                          void unequipFromSlot(selectedEquippedSlotId);
                        }
                      }}
                    >
                      Unequip
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
                    <strong>{character.activeStats[stat]}{previewStats[stat] !== character.activeStats[stat] ? ` -> ${previewStats[stat]}` : ''}</strong>
                    <div className="mini-stepper">
                      <button disabled={freePointsLeft <= 0} onClick={() => onAdjustStat(stat, 1)}>+</button>
                      <button disabled={(pendingStatAllocation[stat] ?? 0) <= 0} onClick={() => onAdjustStat(stat, -1)}>-</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="character-item-actions">
                <button disabled={allocatingStats || !hasPendingAllocation || freePointsLeft < 0} onClick={() => void onApplyStatAllocation()}>
                  {allocatingStats ? 'Applying...' : 'Apply'}
                </button>
                <button type="button" disabled={!hasPendingAllocation} onClick={() => onResetStatAllocation?.()}>Revert</button>
              </div>
            </section>

            <section className="character-meta-card">
              <h3>Combat Statistics</h3>
              <p>HP: {character.activeStats.hp}{' -> '}{previewStats.hp}</p>
              <p>Mana: {character.activeStats.mp}{' -> '}{previewStats.mp}</p>
              <p>Stamina: {character.activeStats.stamina}{' -> '}{previewStats.stamina}</p>
              <p>Total Defense: {derivedBase.totalDefense}{' -> '}{derivedPreview.totalDefense}</p>
              <p>Min Damage: {derivedBase.minDamage}{' -> '}{derivedPreview.minDamage}</p>
              <p>Max Damage: {derivedBase.maxDamage}{' -> '}{derivedPreview.maxDamage}</p>
              <p>Crit Chance: {derivedBase.critChance}%{' -> '}{derivedPreview.critChance}%</p>
              <p>Initiative: {derivedBase.initiative}{' -> '}{derivedPreview.initiative}</p>
              <p>Hit Chance: {derivedPreview.hitChance}%</p>
              <p>Evasion: {derivedPreview.evasion}%</p>
              <p>Block Chance: {derivedPreview.blockChance}%</p>
              <p>Physical Resistance: {derivedPreview.physicalResistance}</p>
              <p>Magic Resistance: {derivedPreview.magicResistance}</p>
              <p>STA Load: {derivedPreview.staminaLoad}</p>
            </section>

            <section className="character-meta-card">
              <h3>Breakdown</h3>
              <p>Defense: {derivedPreview.defenseBreakdown.map((entry) => `${entry.label} ${entry.value}`).join(' | ')}</p>
              <p>Damage: {derivedPreview.damageBreakdown.map((entry) => `${entry.label} ${entry.value}`).join(' | ')}</p>
              <p>Crit: {derivedPreview.critBreakdown.map((entry) => `${entry.label} ${entry.value}`).join(' | ')}</p>
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

        {itemDetailOpen && selectedItem ? (
          <div
            className="character-item-popup-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setItemDetailOpen(false);
              }
            }}
          >
            <section className="character-item-popup" role="dialog" aria-modal="true" aria-label="Item details">
              <div className="character-item-popup-head">
                <div className="character-item-popup-title">
                  <span
                    className="character-item-popup-icon"
                    style={resolveItemImage?.(selectedItem)
                      ? {
                          backgroundImage: `url("${resolveItemImage(selectedItem)}")`,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                        }
                      : undefined}
                  />
                  <div>
                    <h3>{selectedItem.name}</h3>
                    <p className="muted">{selectedItem.itemType} / {selectedItem.itemSubType} / {selectedItem.rarity}</p>
                  </div>
                </div>
                <button type="button" className="character-item-popup-close" onClick={() => setItemDetailOpen(false)}>×</button>
              </div>

              <div className="character-item-popup-body">
                <section className="character-item-popup-main">
                  {selectedItem.itemType === 'weapon' ? (
                    <p className="muted">Hands: {selectedItemHandsRequired === 2 ? 'Two-handed' : 'One-handed'}</p>
                  ) : null}
                  <p>{selectedItem.description}</p>
                  {selectedIsTwoHandedWeapon && equipment.shield ? (
                    <p className="muted">Equipping this weapon will move the offhand item back to the backpack.</p>
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
                </section>

                <section className="character-item-compare">
                  <div className="character-item-compare-items">
                    <div>
                      <span>Equipped</span>
                      <strong>{comparisonCurrentItem?.name ?? 'Empty slot'}</strong>
                      <small>{comparisonSlotId ? SLOT_LABELS[comparisonSlotId] : 'No slot'}</small>
                    </div>
                    <div>
                      <span>Selected</span>
                      <strong>{selectedItem.name}</strong>
                      <small>{selectedAlreadyEquipped ? 'Already equipped' : selectedInventoryEntry ? 'In backpack' : 'Equipped'}</small>
                    </div>
                  </div>
                  <div className="character-item-compare-grid">
                    {itemComparisonRows.map(([label, before, after]) => {
                      const delta = Number((after - before).toFixed(1));
                      return (
                        <p key={label}>
                          <span>{label}</span>
                          <strong>{before} → {after}</strong>
                          <em className={delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}>
                            {delta > 0 ? `+${delta}` : delta}
                          </em>
                        </p>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="character-item-actions character-item-popup-actions">
                <button
                  disabled={selectedAlreadyEquipped || !selectedInventoryEntry}
                  onClick={() => {
                    void equipSelectedItem();
                  }}
                >
                  {selectedAlreadyEquipped ? 'Equipped' : 'Equip'}
                </button>
                <button
                  disabled={!selectedEquippedSlotId}
                  onClick={() => {
                    if (selectedEquippedSlotId) {
                      void unequipFromSlot(selectedEquippedSlotId);
                    }
                  }}
                >
                  Unequip
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
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
};
