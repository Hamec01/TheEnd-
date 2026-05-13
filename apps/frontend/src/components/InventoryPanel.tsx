import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Equipment, InventoryState, ItemDefinition, PrimaryStat, StatBlock } from '@theend/rpg-domain';
import { calculateDerivedStats, getItemById, getItemHandsRequired, getLevelProgress } from '@theend/rpg-domain';
import type { ArenaCharacter } from '../arena/types';
import type { CharacterActionBarSlot, CharacterActionSlot, CharacterSkillLoadout, CharacterSkillRow, CombatSkillSlot } from '../api';
import type { AdminItem } from '../services/content/models';
import { CharacterSkillsPage } from './CharacterSkillsPage';
import { resolveTrainerSkillCandidates, type TrainerSkillCandidate } from './training/trainerSkillResolver';
import { PaperDoll } from './PaperDoll';
import { PAPER_DOLL_ASSETS, type EquipmentSlotId, type PaperDollRace } from './paperDollSlots';
import {
  getRaceSilhouette,
  getRaceSilhouetteFallback,
} from '../utils/raceSilhouette';
import { findEquippedCoreSlot, resolvePreferredEquipmentSlot } from '../utils/equipmentTarget';

export type CharacterPageFocus = 'character' | 'equipment' | 'inventory' | 'stats' | 'skills';

interface InventoryPanelProps {
  character: ArenaCharacter;
  inventory: InventoryState;
  equipment: Equipment;
  learnedSkills: CharacterSkillRow[];
  availableSkills: Array<import('@theend/rpg-domain').AdminSkillDefinition>;
  skillLoadout: CharacterSkillLoadout | null;
  actionSlots: CharacterActionSlot[];
  pendingStatAllocation: Partial<Record<PrimaryStat, number>>;
  freePointsLeft: number;
  allocatingStats: boolean;
  focusSection: CharacterPageFocus;
  trainerNpcId?: string | null;
  trainerNpcName?: string | null;
  trainerSkillIds?: unknown;
  onClose: () => void;
  onStatus: (text: string) => void;
  onEquipItem: (itemId: string, slot?: keyof Equipment) => Promise<void>;
  onUnequipSlot: (slot: keyof Equipment) => Promise<void>;
  onAdjustStat: (stat: PrimaryStat, delta: number) => void;
  onApplyStatAllocation: () => Promise<void>;
  onResetStatAllocation?: () => void;
  onRespecStats?: () => Promise<void> | void;
  onLearnSkill?: (skillId: string) => Promise<void>;
  onSaveSkillLoadout?: (slots: Array<{ slotIndex: number; skillId: string | null }>) => Promise<void>;
  onSaveActionSlots?: (slots: Array<{ slotId: CharacterActionBarSlot['slotId']; order?: number; entryKind: 'skill' | 'item' | 'weapon' | 'empty'; skillId?: string; itemId?: string; itemInstanceId?: string | null; weaponItemId?: string; weaponInstanceId?: string | null }>) => Promise<void>;
  onSaveHotbar?: (slots: Array<{ slotIndex: number; itemId: string | null; itemInstanceId?: string | null }>) => Promise<void>;
  onUseItem?: (itemId: string) => Promise<void>;
  onChangeFocus?: (focus: CharacterPageFocus) => void;
  playerAvatarUrl?: string;
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveAdminItemById?: (itemId: string) => AdminItem | null;
  resolveItemImage?: (item: ItemDefinition | null | undefined) => string | undefined;
  resolveSkillIcon?: (skill: import('@theend/rpg-domain').AdminSkillDefinition | null | undefined) => string | undefined;
}

const CORE_SLOT_BY_LAYOUT: Partial<Record<EquipmentSlotId, keyof Equipment>> = {
  helmet: 'helmet',
  necklace: 'necklace',
  armor: 'armor',
  outerwear: 'outerwear',
  belt: 'belt',
  boots: 'boots',
  gloves: 'gloves',
  leftHand: 'shield',
  rightHand: 'weapon',
  ring1: 'ring1',
  ring2: 'ring2',
  ring3: 'ring3',
  legs: 'legs',
};

const LAYOUT_SLOT_BY_CORE_SLOT: Record<keyof Equipment, EquipmentSlotId> = {
  weapon: 'rightHand',
  helmet: 'helmet',
  necklace: 'necklace',
  armor: 'armor',
  outerwear: 'outerwear',
  belt: 'belt',
  gloves: 'gloves',
  shield: 'leftHand',
  ring1: 'ring1',
  ring2: 'ring2',
  ring3: 'ring3',
  legs: 'legs',
  boots: 'boots',
};

const SLOT_LABELS: Record<EquipmentSlotId, string> = {
  helmet: 'Шлем',
  necklace: 'Амулет',
  armor: 'Броня',
  outerwear: 'Плащ',
  belt: 'Пояс',
  leftHand: 'Левая рука',
  gloves: 'Перчатки',
  rightHand: 'Правая рука',
  ring1: 'Кольцо 1',
  ring2: 'Кольцо 2',
  ring3: 'Кольцо 3',
  legs: 'Поножи',
  boots: 'Сапоги',
  quick1: 'Быстрый слот 1',
  quick2: 'Быстрый слот 2',
  quick3: 'Быстрый слот 3',
  quick4: 'Быстрый слот 4',
  quick5: 'Быстрый слот 5',
  quick6: 'Быстрый слот 6',
  quick7: 'Быстрый слот 7',
  quick8: 'Быстрый слот 8',
  quick9: 'Быстрый слот 9',
  quick10: 'Быстрый слот 10',
};

const ALL_SLOT_IDS = Object.keys(SLOT_LABELS) as EquipmentSlotId[];
const QUICK_SLOT_IDS: EquipmentSlotId[] = ['quick1', 'quick2', 'quick3', 'quick4', 'quick5', 'quick6', 'quick7', 'quick8', 'quick9', 'quick10'];

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
  mp: 'Мана',
  stamina: 'Выносливость',
  strength: 'Сила',
  constitution: 'Телосложение',
  dexterity: 'Ловкость',
  intelligence: 'Интеллект',
  luck: 'Удача',
  perception: 'Восприятие',
  willpower: 'Воля',
};

const STAT_HINTS: Record<PrimaryStat, string> = {
  hp: 'Здоровье персонажа. Если HP падает до нуля, персонаж проигрывает бой.',
  mp: 'Ресурс для магии, стихийных заклинаний и некоторых особых способностей.',
  stamina: 'Ресурс для физических навыков, блоков, тяжёлых атак и активных действий в бою.',
  strength: 'Влияет на физический урон, тяжёлое оружие и силовые проверки.',
  constitution: 'Влияет на здоровье, защиту, сопротивление физическому урону и тяжёлую броню.',
  dexterity: 'Влияет на точность, уклонение, инициативу и лёгкое оружие.',
  intelligence: 'Влияет на магический урон, объём маны, обучение магии и силу заклинаний.',
  luck: 'Влияет на шанс критического удара, редкую добычу и случайные проверки.',
  perception: 'Влияет на точность, инициативу, обнаружение ловушек и скрытых объектов.',
  willpower: 'Влияет на сопротивление магии, страху, контролю, проклятиям и ментальным эффектам.',
};

const ITEM_STAT_LABELS: Record<string, string> = {
  strength: 'Сила',
  dexterity: 'Ловкость',
  constitution: 'Телосложение',
  intelligence: 'Интеллект',
  stamina: 'Выносливость',
  perception: 'Восприятие',
  luck: 'Удача',
  willpower: 'Воля',
  hp: 'HP',
  mp: 'Мана',
};

const EQUIPMENT_ORDER: Array<keyof Equipment> = [
  'weapon',
  'shield',
  'helmet',
  'armor',
  'outerwear',
  'gloves',
  'belt',
  'legs',
  'boots',
  'necklace',
  'ring1',
  'ring2',
  'ring3',
];

const EQUIPMENT_LABELS: Record<keyof Equipment, string> = {
  weapon: 'Оружие',
  shield: 'Щит',
  helmet: 'Шлем',
  armor: 'Броня',
  outerwear: 'Плащ',
  belt: 'Пояс',
  gloves: 'Перчатки',
  necklace: 'Амулет',
  ring1: 'Кольцо 1',
  ring2: 'Кольцо 2',
  ring3: 'Кольцо 3',
  legs: 'Поножи',
  boots: 'Сапоги',
};

const INVENTORY_FILTER_LABELS = {
  all: 'Все',
  weapon: 'Оружие',
  armor: 'Броня',
  consumable: 'Расходники',
  quest: 'Квестовые',
  material: 'Материалы',
} satisfies Record<'all' | 'weapon' | 'armor' | 'consumable' | 'quest' | 'material', string>;

const INVENTORY_SORT_LABELS = {
  name: 'имени',
  type: 'типу',
  rarity: 'редкости',
  price: 'цене',
  damage: 'урону',
  defense: 'защите',
} satisfies Record<'name' | 'type' | 'rarity' | 'price' | 'damage' | 'defense', string>;

function formatItemStatLabel(value: string): string {
  return ITEM_STAT_LABELS[value] ?? value;
}

function formatItemStatRows(stats: Record<string, number> | undefined): Array<{ key: string; label: string; value: number }> {
  if (!stats) {
    return [];
  }

  return Object.entries(stats)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value !== 0)
    .map(([key, value]) => ({
      key,
      label: formatItemStatLabel(key),
      value,
    }));
}

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
    case 'necklace':
      return item.itemType === 'necklace';
    case 'armor':
      return item.itemType === 'armor';
    case 'outerwear':
      return item.itemType === 'outerwear';
    case 'belt':
      return item.itemType === 'belt';
    case 'ring1':
    case 'ring2':
    case 'ring3':
      return item.itemType === 'ring';
    case 'legs':
      return item.itemType === 'legs';
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
  availableSkills,
  skillLoadout,
  actionSlots,
  pendingStatAllocation,
  freePointsLeft,
  allocatingStats,
  focusSection,
  trainerNpcId,
  trainerNpcName,
  trainerSkillIds,
  onClose,
  onStatus,
  onEquipItem,
  onUnequipSlot,
  onAdjustStat,
  onApplyStatAllocation,
  onResetStatAllocation,
  onRespecStats,
  onLearnSkill,
  onSaveSkillLoadout,
  onSaveActionSlots,
  onSaveHotbar,
  onUseItem,
  onChangeFocus,
  playerAvatarUrl,
  resolveItemById,
  resolveAdminItemById,
  resolveItemImage,
  resolveSkillIcon,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemDetailOpen, setItemDetailOpen] = useState(false);
  const [silhouetteBroken, setSilhouetteBroken] = useState(false);
  const [silhouetteSrc, setSilhouetteSrc] = useState<string>(() => getRaceSilhouette(character.race));
  const [hoverPreview, setHoverPreview] = useState<{ itemId: string; x: number; y: number } | null>(null);
  // Collapsible modules for character overview page (set of collapsed module keys)
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => new Set(['stats', 'combat', 'breakdown', 'progression', 'skills']));
  // Inventory sorting/filter
  const [inventorySort, setInventorySort] = useState<'name' | 'type' | 'rarity' | 'price' | 'damage' | 'defense'>('type');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'weapon' | 'armor' | 'consumable' | 'quest' | 'material'>('all');
  // Skills page: selected skill + selected loadout slot
  const [selectedLearnedSkillId, setSelectedLearnedSkillId] = useState<string | null>(null);
  const [selectedLoadoutSlotIndex, setSelectedLoadoutSlotIndex] = useState<number | null>(null);
  const [skillsFilter, setSkillsFilter] = useState<'all' | 'magic' | 'elemental' | 'physical' | 'passive' | 'rune'>('all');
  // Loadout presets (stored in localStorage)
  const [activePresetIndex, setActivePresetIndex] = useState<0 | 1 | 2>(0);
  // Skills page state
  const [skillsDraftSlots, setSkillsDraftSlots] = useState<CombatSkillSlot[]>([]);
  const [selectedQuickSlotId, setSelectedQuickSlotId] = useState<EquipmentSlotId | null>(null);
  const [isSavingSkillLoadout, setIsSavingSkillLoadout] = useState(false);
  const [learningSkillId, setLearningSkillId] = useState<string | null>(null);
  const [trainerPopupSkillId, setTrainerPopupSkillId] = useState<string | null>(null);

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
  const levelProgress = useMemo(() => getLevelProgress(character.level, character.exp), [character.exp, character.level]);
  const expToNextLevel = Math.max(0, levelProgress.next - character.exp);

  const inventoryEntries = useMemo(
    () => inventory.items
      .map((entry) => {
        const item = resolveItemById ? resolveItemById(entry.itemId) : getItemById(entry.itemId);
        if (!item) {
          return null;
        }
        return { item, quantity: entry.quantity };
      })
      .filter((entry): entry is { item: ItemDefinition; quantity: number } => Boolean(entry))
      .filter((entry) => entry.quantity > 0),
    [inventory.items, resolveItemById],
  );

  const inventoryByItemId = useMemo(
    () => new Map(inventoryEntries.map((entry) => [entry.item.id, entry])),
    [inventoryEntries],
  );

  const actionSlotsBySlot = useMemo(
    () => new Map(actionSlots.map((slot) => [slot.slotIndex, slot])),
    [actionSlots],
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
  const weaponOccupiesBothHands = Boolean(equippedWeapon && equippedWeapon.itemType === 'weapon' && getItemHandsRequired(equippedWeapon) === 2);
  const selectedItemHandsRequired = selectedItem ? getItemHandsRequired(selectedItem) : 1;
  const selectedIsTwoHandedWeapon = Boolean(selectedItem && selectedItem.itemType === 'weapon' && selectedItemHandsRequired === 2);
  const shieldBlockedByTwoHandedWeapon = Boolean(selectedItem?.itemType === 'shield' && equippedWeapon && getItemHandsRequired(equippedWeapon) === 2);

  const paperDollRace = (character.race in PAPER_DOLL_ASSETS ? character.race : 'HUMAN') as PaperDollRace;
  const paperDollDebug = false;

  const equippedByLayoutSlot = useMemo(() => {
    const full: Partial<Record<EquipmentSlotId, ItemDefinition | null>> = {};

    for (const slotId of ALL_SLOT_IDS) {
      const coreSlot = CORE_SLOT_BY_LAYOUT[slotId];
      if (slotId === 'leftHand' && !equipment.shield && weaponOccupiesBothHands && equippedWeapon) {
        full[slotId] = equippedWeapon;
        continue;
      }

      const itemId = coreSlot ? equipment[coreSlot] : null;
      full[slotId] = itemId ? (resolveItemById ? resolveItemById(itemId) : getItemById(itemId)) : null;
    }

    return full;
  }, [equipment, equippedWeapon, resolveItemById, weaponOccupiesBothHands]);

  const paperDollSlotItems = useMemo(() => {
    const full: Partial<Record<EquipmentSlotId, ItemDefinition | null>> = { ...equippedByLayoutSlot };

    for (const slotId of QUICK_SLOT_IDS) {
      const slotIndex = QUICK_SLOT_IDS.indexOf(slotId);
      const actionSlot = actionSlotsBySlot.get(slotIndex);
      const itemId = actionSlot?.kind === 'item' || actionSlot?.kind === 'weapon' ? actionSlot.refId : null;
      full[slotId] = itemId ? (resolveItemById ? resolveItemById(itemId) : getItemById(itemId)) : null;
    }

    return full;
  }, [actionSlotsBySlot, equippedByLayoutSlot, resolveItemById]);

  const actionSlotQuickContent = useMemo(() => {
    const content: Partial<Record<EquipmentSlotId, string>> = {};
    for (const slotId of QUICK_SLOT_IDS) {
      const slotIndex = QUICK_SLOT_IDS.indexOf(slotId);
      const slot = actionSlotsBySlot.get(slotIndex);
      if (!slot?.kind || !slot.refId) {
        continue;
      }
      if (slot.kind === 'item') {
        const quantity = inventoryByItemId.get(slot.refId)?.quantity ?? 0;
        content[slotId] = quantity > 0 ? `x${quantity}` : '0';
        continue;
      }
      if (slot.kind === 'weapon') {
        content[slotId] = equipment.weapon === slot.refId ? 'ACTIVE' : 'WEAPON';
        continue;
      }

      const learned = learnedSkills.find((entry) => entry.skillId === slot.refId) ?? null;
      const def = learned?.definition ?? availableSkills.find((entry) => entry.id === slot.refId) ?? null;
      content[slotId] = def ? def.name.slice(0, 2).toUpperCase() : '??';
    }
    return content;
  }, [actionSlotsBySlot, availableSkills, inventoryByItemId, learnedSkills]);

  function isUsableHotbarItem(item: ItemDefinition | null): boolean {
    if (!item) {
      return false;
    }

    const adminItem = (resolveAdminItemById ? resolveAdminItemById(item.id) : null) as (AdminItem & Record<string, unknown>) | null;
    return item.itemType === 'consumable'
      || adminItem?.slot === 'quick'
      || adminItem?.type === 'potion'
      || adminItem?.isUsable === true
      || adminItem?.usableInCombat === true
      || adminItem?.isCombatUsable === true
      || Boolean(adminItem?.useEffect)
      || (Array.isArray(adminItem?.effects) && adminItem.effects.length > 0)
      || (Array.isArray(adminItem?.combatEffects) && adminItem.combatEffects.length > 0);
  }

  async function assignItemToActionSlot(slotId: EquipmentSlotId, itemId: string | null): Promise<void> {
    const slotIndex = QUICK_SLOT_IDS.indexOf(slotId);
    if (slotIndex < 0) {
      return;
    }

    if (!onSaveActionSlots) {
      onStatus('Сохранение active slots недоступно.');
      return;
    }

    const item = itemId ? (resolveItemById ? resolveItemById(itemId) : getItemById(itemId)) : null;
    if (itemId && !isUsableHotbarItem(item) && item?.itemType !== 'weapon') {
      onStatus('В быстрые слоты можно ставить используемые предметы и оружие.');
      return;
    }
    const entryKind = item?.itemType === 'weapon' ? 'weapon' : (itemId ? 'item' : 'empty');

    const actionBarSlotId = slotId as CharacterActionBarSlot['slotId'];
    console.info(itemId ? '[actionBar] assign' : '[actionBar] clear', {
      characterId: character.id,
      slotId: actionBarSlotId,
      entryKind,
      itemId,
      result: 'requested',
    });
    try {
      await onSaveActionSlots([{
        slotId: actionBarSlotId,
        order: slotIndex,
        entryKind,
        itemId: entryKind === 'item' ? (itemId ?? undefined) : undefined,
        itemInstanceId: entryKind === 'item' ? null : undefined,
        weaponItemId: entryKind === 'weapon' ? (itemId ?? undefined) : undefined,
        weaponInstanceId: entryKind === 'weapon' ? null : undefined,
      }]);
    } catch (error) {
      console.warn('[actionBar] reject', { characterId: character.id, slotId: actionBarSlotId, entryKind, itemId, result: 'save-failed', message: (error as Error).message });
      onStatus(`Не удалось сохранить action-bar: ${(error as Error).message}`);
    }
  }

  function findEquippedSlotId(itemId: string): EquipmentSlotId | null {
    const equippedCoreSlot = findEquippedCoreSlot(equipment, itemId);
    return equippedCoreSlot ? LAYOUT_SLOT_BY_CORE_SLOT[equippedCoreSlot] : null;
  }

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
    () => new Set(Object.values(equipment).filter((itemId): itemId is string => Boolean(itemId))),
    [equipment],
  );
  const selectedEquippedSlotId = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    return findEquippedSlotId(selectedItem.id);
  }, [equipment, selectedItem]);
  const selectedAlreadyEquipped = Boolean(selectedItem && equippedItemIds.has(selectedItem.id));

  const getComparisonForItem = (item: ItemDefinition | null) => {
    if (!item) {
      return {
        slotId: null as EquipmentSlotId | null,
        currentItem: null as ItemDefinition | null,
        currentAdminItem: null as AdminItem | null,
        rows: [] as Array<{ label: string; before: number; after: number }>,
        statDiffRows: [] as Array<{ key: string; label: string; current: number; next: number; diff: number }>,
        damageComparison: null as { currentMin?: number; currentMax?: number; nextMin?: number; nextMax?: number; minDiff: number; maxDiff: number } | null,
        armorComparison: null as { current: number; next: number; diff: number } | null,
      };
    }

    const comparisonCoreSlot = resolvePreferredEquipmentSlot(item, equipment);
    const comparisonSlotId = comparisonCoreSlot ? LAYOUT_SLOT_BY_CORE_SLOT[comparisonCoreSlot] ?? null : null;
    const alreadyEquipped = equippedItemIds.has(item.id);

    const previewEquipment: Equipment = (() => {
      if (!comparisonCoreSlot || alreadyEquipped) {
        return equipment;
      }

      const next: Equipment = {
        ...equipment,
        [comparisonCoreSlot]: item.id,
      };

      if (item.itemType === 'weapon' && getItemHandsRequired(item) === 2) {
        next.shield = null;
      }

      return next;
    })();

    const derivedItemPreview = calculateDerivedStats(character.activeStats, previewEquipment);
    const currentItemId = comparisonCoreSlot ? equipment[comparisonCoreSlot] : null;
    const currentItem = currentItemId
      ? (resolveItemById ? resolveItemById(currentItemId) : getItemById(currentItemId))
      : null;
    const selectedAdminItem = resolveAdminItemById ? resolveAdminItemById(item.id) : null;
    const currentAdminItem = currentItem && resolveAdminItemById ? resolveAdminItemById(currentItem.id) : null;
    const selectedBonusSource = (selectedAdminItem?.bonuses as Record<string, number> | undefined) ?? (item.bonuses as Record<string, number> | undefined);
    const currentBonusSource = (currentAdminItem?.bonuses as Record<string, number> | undefined) ?? (currentItem?.bonuses as Record<string, number> | undefined);
    const statDiffRows = Array.from(new Set([...Object.keys(selectedBonusSource ?? {}), ...Object.keys(currentBonusSource ?? {})]))
      .map((key) => {
        const next = selectedBonusSource?.[key] ?? 0;
        const current = currentBonusSource?.[key] ?? 0;
        return {
          key,
          label: formatItemStatLabel(key),
          current,
          next,
          diff: next - current,
        };
      })
      .filter((row) => row.current !== 0 || row.next !== 0);
    const damageComparison = typeof selectedAdminItem?.damageMin === 'number'
      || typeof selectedAdminItem?.damageMax === 'number'
      || typeof currentAdminItem?.damageMin === 'number'
      || typeof currentAdminItem?.damageMax === 'number'
      ? {
        currentMin: currentAdminItem?.damageMin,
        currentMax: currentAdminItem?.damageMax,
        nextMin: selectedAdminItem?.damageMin,
        nextMax: selectedAdminItem?.damageMax,
        minDiff: (selectedAdminItem?.damageMin ?? 0) - (currentAdminItem?.damageMin ?? 0),
        maxDiff: (selectedAdminItem?.damageMax ?? 0) - (currentAdminItem?.damageMax ?? 0),
      }
      : null;
    const armorComparison = typeof selectedAdminItem?.armorValue === 'number'
      || typeof currentAdminItem?.armorValue === 'number'
      ? {
        current: currentAdminItem?.armorValue ?? 0,
        next: selectedAdminItem?.armorValue ?? 0,
        diff: (selectedAdminItem?.armorValue ?? 0) - (currentAdminItem?.armorValue ?? 0),
      }
      : null;

    return {
      slotId: comparisonSlotId,
      currentItem,
      currentAdminItem,
      rows: [
        { label: 'Defense', before: derivedBase.totalDefense, after: derivedItemPreview.totalDefense },
        { label: 'Min Damage', before: derivedBase.minDamage, after: derivedItemPreview.minDamage },
        { label: 'Max Damage', before: derivedBase.maxDamage, after: derivedItemPreview.maxDamage },
        { label: 'Crit', before: derivedBase.critChance, after: derivedItemPreview.critChance },
        { label: 'Block', before: derivedBase.blockChance, after: derivedItemPreview.blockChance },
        { label: 'STA Load', before: derivedBase.staminaLoad, after: derivedItemPreview.staminaLoad },
      ],
      statDiffRows,
      damageComparison,
      armorComparison,
    };
  };

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

  const selectedComparison = useMemo(() => getComparisonForItem(selectedItem), [selectedItem, equipment, character.activeStats, equippedByLayoutSlot, equippedItemIds, derivedBase, resolveAdminItemById]);
  const comparisonSlotId = selectedComparison.slotId;
  const comparisonCurrentItem = selectedComparison.currentItem;
  const itemComparisonRows = selectedComparison.rows;
  const itemStatDiffRows = selectedComparison.statDiffRows;
  const itemDamageComparison = selectedComparison.damageComparison;
  const itemArmorComparison = selectedComparison.armorComparison;

  const hoverItem = useMemo(
    () => (hoverPreview?.itemId ? inventoryByItemId.get(hoverPreview.itemId)?.item ?? null : null),
    [hoverPreview, inventoryByItemId],
  );
  const hoverComparison = useMemo(
    () => getComparisonForItem(hoverItem),
    [hoverItem, equipment, character.activeStats, equippedByLayoutSlot, equippedItemIds, derivedBase, resolveAdminItemById],
  );
  const selectedAdminItem = useMemo(
    () => (selectedItem && resolveAdminItemById ? resolveAdminItemById(selectedItem.id) : null),
    [resolveAdminItemById, selectedItem],
  );
  const selectedDescription = selectedAdminItem?.gameplayDescription?.trim() || selectedItem?.description || 'Description unavailable.';
  const selectedLoreDescription = selectedAdminItem?.loreDescription?.trim() || '';
  const selectedRequirementRows = formatItemStatRows((selectedAdminItem?.requiredStats as Record<string, number> | undefined) ?? (selectedItem?.requiredStats as Record<string, number> | undefined));
  const selectedBonusRows = formatItemStatRows((selectedAdminItem?.bonuses as Record<string, number> | undefined) ?? (selectedItem?.bonuses as Record<string, number> | undefined));

  useEffect(() => {
    setSilhouetteBroken(false);
    setSilhouetteSrc(getRaceSilhouette(paperDollRace as any));
  }, [paperDollRace]);

  useEffect(() => {
    setSkillsDraftSlots(skillLoadout?.slots ?? []);
  }, [skillLoadout]);

  useEffect(() => {
    const clearHoverPreview = () => setHoverPreview(null);
    window.addEventListener('scroll', clearHoverPreview, true);
    window.addEventListener('resize', clearHoverPreview);
    return () => {
      window.removeEventListener('scroll', clearHoverPreview, true);
      window.removeEventListener('resize', clearHoverPreview);
    };
  }, []);

  async function equipToSlot(slotId: EquipmentSlotId, item: ItemDefinition): Promise<void> {
    const coreSlot = CORE_SLOT_BY_LAYOUT[slotId];
    if (!coreSlot) {
      onStatus('Этот слот пока декоративный и не поддерживает экипировку.');
      return;
    }

    if (slotId === 'leftHand' && weaponOccupiesBothHands && !equipment.shield) {
      onStatus('Левая рука уже занята двуручным оружием.');
      return;
    }

    if (!canEquipItemInSlot(item, slotId)) {
      onStatus('Этот предмет нельзя надеть в выбранный слот.');
      return;
    }

    try {
      await onEquipItem(item.id, coreSlot);
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

    const preferredCoreSlot = resolvePreferredEquipmentSlot(selectedItem, equipment);
    if (!preferredCoreSlot) {
      onStatus('Этот предмет нельзя экипировать.');
      return;
    }

    const targetSlotId = LAYOUT_SLOT_BY_CORE_SLOT[preferredCoreSlot];
    if (!targetSlotId || !canEquipItemInSlot(selectedItem, targetSlotId)) {
      onStatus('Этот предмет нельзя экипировать.');
      return;
    }

    try {
      await onEquipItem(selectedItem.id, preferredCoreSlot);
    } catch {
      // parent already reports error status
    }
  }

  async function useSelectedItem(): Promise<void> {
    if (!selectedItem || !onUseItem) {
      onStatus('Использование предмета недоступно.');
      return;
    }

    try {
      await onUseItem(selectedItem.id);
      setItemDetailOpen(false);
    } catch {
      // parent already reports error status
    }
  }

  async function unequipFromSlot(slotId: EquipmentSlotId): Promise<void> {
    const coreSlot = slotId === 'leftHand' && weaponOccupiesBothHands && !equipment.shield
      ? 'weapon'
      : CORE_SLOT_BY_LAYOUT[slotId];
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

  async function handleDoubleClickInventoryItem(itemId: string): Promise<void> {
    const item = resolveItemById ? resolveItemById(itemId) : getItemById(itemId);
    if (!item) {
      return;
    }

    if (isUsableHotbarItem(item) && onUseItem) {
      try {
        await onUseItem(itemId);
        return;
      } catch {
        // parent already reports error status
      }
    }

    // Item is not equipped - equip it to preferred slot
    if (shieldBlockedByTwoHandedWeapon && item.itemType === 'shield') {
      onStatus('Левая рука занята двуручным оружием. Сначала снимите его.');
      return;
    }

    const preferredCoreSlot = resolvePreferredEquipmentSlot(item, equipment);
    if (!preferredCoreSlot) {
      onStatus('Этот предмет нельзя экипировать.');
      return;
    }

    const targetSlotId = LAYOUT_SLOT_BY_CORE_SLOT[preferredCoreSlot];
    if (!targetSlotId || !canEquipItemInSlot(item, targetSlotId)) {
      onStatus('Этот предмет нельзя экипировать.');
      return;
    }

    try {
      await onEquipItem(itemId, preferredCoreSlot);
    } catch {
      // parent already reports error status
    }
  }

  const focusedColumnClass = FOCUS_SECTION_COLUMN[focusSection];

  const hasPendingAllocation = Object.keys(pendingStatAllocation).length > 0;

  function toggleModule(key: string): void {
    setCollapsedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function isModuleCollapsed(key: string): boolean {
    return collapsedModules.has(key);
  }

  function getPresetsStorageKey(): string {
    return `theend.loadoutPresets.${character.id}`;
  }

  interface CharacterLoadoutPreset {
    id: string;
    name: string;
    index: 0 | 1 | 2;
    slots: Array<{ slotIndex: number; entryType: 'skill' | 'item'; entryId: string }>;
  }

  function loadPresets(): CharacterLoadoutPreset[] {
    try {
      const raw = window.localStorage.getItem(getPresetsStorageKey());
      if (!raw) return [
        { id: 'preset_0', name: 'Preset 1', index: 0, slots: [] },
        { id: 'preset_1', name: 'Preset 2', index: 1, slots: [] },
        { id: 'preset_2', name: 'Preset 3', index: 2, slots: [] },
      ];
      return JSON.parse(raw) as CharacterLoadoutPreset[];
    } catch {
      return [
        { id: 'preset_0', name: 'Preset 1', index: 0, slots: [] },
        { id: 'preset_1', name: 'Preset 2', index: 1, slots: [] },
        { id: 'preset_2', name: 'Preset 3', index: 2, slots: [] },
      ];
    }
  }

  function savePresets(presets: CharacterLoadoutPreset[]): void {
    window.localStorage.setItem(getPresetsStorageKey(), JSON.stringify(presets));
  }

  async function saveCurrentLoadoutAsPreset(presetIndex: 0 | 1 | 2): Promise<void> {
    const currentSlots = (skillLoadout?.slots ?? [])
      .filter((slot) => slot.unlocked && Boolean(slot.skillId))
      .map((slot) => ({
        slotIndex: slot.slotIndex,
        entryType: 'skill' as const,
        entryId: slot.skillId as string,
      }));
    const presets = loadPresets();
    presets[presetIndex] = {
      ...presets[presetIndex],
      slots: currentSlots,
    };
    savePresets(presets);
    onStatus(`Preset ${presetIndex + 1} saved.`);
  }

  async function applyPreset(presetIndex: 0 | 1 | 2): Promise<void> {
    const presets = loadPresets();
    const preset = presets[presetIndex];
    if (!preset) return;
    const newSlots = preset.slots
      .filter((s) => s.entryType === 'skill')
      .map((s) => ({ slotIndex: s.slotIndex, skillId: s.entryId }));
    if (onSaveSkillLoadout) {
      await onSaveSkillLoadout(newSlots);
    }
    setActivePresetIndex(presetIndex);
    onStatus(`Preset ${presetIndex + 1} loaded.`);
  }

  // ── Skills page helpers ──────────────────────────────────────────────
  async function assignSkillToQuickSlot(slotId: EquipmentSlotId, skillId: string | null): Promise<void> {
    const slotIndex = QUICK_SLOT_IDS.indexOf(slotId);
    if (slotIndex < 0) {
      return;
    }

    if (skillId && !skillsLearnedIds.has(skillId)) {
      onStatus('Можно назначать только уже изученные навыки.');
      return;
    }

    const actionBarSlotId = slotId as CharacterActionBarSlot['slotId'];
    console.info(skillId ? '[actionBar] assignSkill' : '[actionBar] clear', {
      characterId: character.id,
      slotId: actionBarSlotId,
      entryKind: skillId ? 'skill' : 'empty',
      skillId,
      result: 'requested',
    });
    if (!onSaveActionSlots) {
      return;
    }

    try {
      setIsSavingSkillLoadout(true);
      console.info('[actionBar] save', {
        characterId: character.id,
        slots: [{ slotId: actionBarSlotId, order: slotIndex, entryKind: skillId ? 'skill' : 'empty', skillId: skillId ?? undefined, itemInstanceId: null }],
      });
      await onSaveActionSlots([{ slotId: actionBarSlotId, order: slotIndex, entryKind: skillId ? 'skill' : 'empty', skillId: skillId ?? undefined, itemInstanceId: null }]);
    } catch (error) {
      console.warn('[actionBar] reject', { characterId: character.id, slotId: actionBarSlotId, entryKind: skillId ? 'skill' : 'empty', skillId, result: 'save-failed', message: (error as Error).message });
      onStatus(`Не удалось сохранить action-bar: ${(error as Error).message}`);
    } finally {
      setIsSavingSkillLoadout(false);
    }
  }

  async function saveSkillsLoadout(): Promise<void> {
    if (!onSaveSkillLoadout) return;
    try {
      setIsSavingSkillLoadout(true);
      await onSaveSkillLoadout(skillsDraftSlots.map((s) => ({ slotIndex: s.slotIndex, skillId: s.skillId })));
      onStatus('Боевой набор сохранён.');
    } catch (error) {
      onStatus(`Не удалось сохранить: ${(error as Error).message}`);
    } finally {
      setIsSavingSkillLoadout(false);
    }
  }

  async function handleLearnSkill(skillId: string): Promise<void> {
    if (!onLearnSkill) return;
    try {
      setLearningSkillId(skillId);
      await onLearnSkill(skillId);
      setSelectedLearnedSkillId(skillId);
    } catch (error) {
      onStatus(`Не удалось изучить навык: ${(error as Error).message}`);
    } finally {
      setLearningSkillId(null);
    }
  }

  function openTrainerPopup(skillId: string) {
    setTrainerPopupSkillId(skillId);
  }

  function closeTrainerPopup() {
    setTrainerPopupSkillId(null);
  }

  useEffect(() => {
    if (!trainerPopupSkillId) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setTrainerPopupSkillId(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [trainerPopupSkillId]);

  // Sorted/filtered inventory entries
  const sortedFilteredInventory = useMemo(() => {
    let entries = [...inventoryEntries];
    if (inventoryFilter !== 'all') {
      entries = entries.filter((entry) => {
        const type = entry.item.itemType;
        switch (inventoryFilter) {
          case 'weapon': return type === 'weapon';
          case 'armor': return type === 'helmet' || type === 'armor' || type === 'gloves' || type === 'boots' || type === 'legs' || type === 'outerwear' || type === 'belt' || type === 'shield' || type === 'necklace' || type === 'ring';
          case 'consumable': return type === 'consumable';
          default: return true;
        }
      });
    }
    entries.sort((a, b) => {
      switch (inventorySort) {
        case 'name': return a.item.name.localeCompare(b.item.name);
        case 'type': return a.item.itemType.localeCompare(b.item.itemType);
        case 'rarity': {
          const order = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
          return (order[a.item.rarity as keyof typeof order] ?? 9) - (order[b.item.rarity as keyof typeof order] ?? 9);
        }
        case 'price': return b.item.price - a.item.price;
        case 'damage': {
          const damageA = resolveAdminItemById?.(a.item.id)?.damageMax ?? 0;
          const damageB = resolveAdminItemById?.(b.item.id)?.damageMax ?? 0;
          return damageB - damageA;
        }
        case 'defense': {
          const armorA = resolveAdminItemById?.(a.item.id)?.armorValue ?? 0;
          const armorB = resolveAdminItemById?.(b.item.id)?.armorValue ?? 0;
          return armorB - armorA;
        }
        default: return 0;
      }
    });
    return entries;
  }, [inventoryEntries, inventoryFilter, inventorySort, resolveAdminItemById]);

  const STAT_EXPLANATIONS = STAT_HINTS;

  const equippedSummary = useMemo(
    () => EQUIPMENT_ORDER.map((slot) => {
      const itemId = equipment[slot];
      const item = itemId ? (resolveItemById ? resolveItemById(itemId) : getItemById(itemId)) : null;
      return {
        slot,
        label: EQUIPMENT_LABELS[slot],
        item,
      };
    }),
    [equipment, resolveItemById],
  );

  const learnedSkillsSummary = useMemo(
    () => learnedSkills
      .map((entry) => ({
        id: entry.skillId,
        level: entry.level,
        name: entry.definition?.name ?? availableSkills.find((skill) => skill.id === entry.skillId)?.name ?? entry.skillId,
      }))
      .slice(0, 6),
    [availableSkills, learnedSkills],
  );
  const skillsPlayerContext = useMemo(
    () => ({
      playerId: character.id,
      level: character.level,
      race: String(character.race ?? ''),
      classId: null,
      npcId: trainerNpcId ?? null,
      gold: inventory.gold ?? null,
      stats: character.activeStats ?? null,
    }),
    [character.activeStats, character.id, character.level, character.race, inventory.gold, trainerNpcId],
  );

  // ── Skills page derived data ─────────────────────────────────────────
  const skillsLearnedIds = useMemo(() => new Set(learnedSkills.map((s) => s.skillId)), [learnedSkills]);
  const skillsTrainerCandidates = useMemo<TrainerSkillCandidate[]>(() => {
    const npcId = skillsPlayerContext.npcId?.trim() || null;
    if (!npcId) return [];
    return resolveTrainerSkillCandidates({
      npcId,
      trainerSkillIds,
      allSkills: availableSkills,
      context: skillsPlayerContext,
      learnedSkillIds: skillsLearnedIds,
    });
  }, [availableSkills, skillsLearnedIds, skillsPlayerContext, trainerSkillIds]);
  const skillsTrainerAvailable = useMemo(
    () => skillsTrainerCandidates.filter((entry) => entry.isAvailable && entry.skill),
    [skillsTrainerCandidates],
  );
  const skillsTrainerLocked = useMemo(
    () => skillsTrainerCandidates.filter((entry) => !entry.isAvailable && !entry.isLearned),
    [skillsTrainerCandidates],
  );
  const skillsTrainerLearned = useMemo(
    () => skillsTrainerCandidates.filter((entry) => entry.isLearned),
    [skillsTrainerCandidates],
  );

  useEffect(() => {
    const env = (import.meta as any)?.env as { DEV?: boolean; MODE?: string } | undefined;
    const isDev = env?.DEV === true || (typeof env?.MODE === 'string' && env.MODE !== 'production');
    if (!isDev) return;
    if (!skillsPlayerContext.npcId) return;
    // Diagnostics for trainer content setup.
    console.debug('[trainer]', {
      npcId: skillsPlayerContext.npcId,
      trainerSkillIdsRaw: trainerSkillIds,
      candidates: skillsTrainerCandidates.map((entry) => ({
        skillId: entry.skillId,
        sources: entry.sources,
        costs: entry.costs,
        isLearned: entry.isLearned,
        isAvailable: entry.isAvailable,
        reasons: entry.reasons.map((r) => r.code),
      })),
    });
  }, [skillsPlayerContext.npcId, skillsTrainerCandidates, trainerSkillIds]);
  const skillsLearnedFull = useMemo(
    () => learnedSkills.map((entry) => ({
      ...entry,
      definition: entry.definition ?? availableSkills.find((s) => s.id === entry.skillId) ?? null,
    })),
    [availableSkills, learnedSkills],
  );
  const skillsQuickContent = useMemo<Partial<Record<EquipmentSlotId, string>>>(() => {
    const result: Partial<Record<EquipmentSlotId, string>> = {};
    for (const slot of actionSlots) {
      if (slot.kind !== 'skill' || !slot.refId) continue;
      const slotId = QUICK_SLOT_IDS[slot.slotIndex];
      if (!slotId) continue;
      const def = availableSkills.find((s) => s.id === slot.refId);
      result[slotId] = def
        ? def.name.slice(0, 2).toUpperCase()
        : '??';
    }
    return result;
  }, [actionSlots, availableSkills]);
  const skillsSelectedDef = useMemo(() => {
    if (!selectedLearnedSkillId) return null;
    const learned = skillsLearnedFull.find((e) => e.skillId === selectedLearnedSkillId);
    if (learned?.definition) return { def: learned.definition, level: learned.level };
    const available = skillsTrainerAvailable.find((entry) => entry.skill?.id === selectedLearnedSkillId)?.skill ?? null;
    if (available) return { def: available, level: 1 };
    return null;
  }, [selectedLearnedSkillId, skillsLearnedFull, skillsTrainerAvailable]);
  const skillsAssignedCount = useMemo(
    () => skillsDraftSlots.filter((s) => s.unlocked && s.skillId).length,
    [skillsDraftSlots],
  );
  const skillsHasDraftChanges = useMemo(() => {
    if (!skillLoadout) return false;
    const original = skillLoadout.slots;
    if (original.length !== skillsDraftSlots.length) return true;
    return original.some((slot, index) => slot.skillId !== skillsDraftSlots[index]?.skillId);
  }, [skillLoadout, skillsDraftSlots]);

  // Shared fragments

  function renderPageHeader() {
    return (
      <div className="battle-window-head">
        <h2>{character.name}</h2>
        <button onClick={onClose} aria-label="Закрыть окно персонажа">×</button>
      </div>
    );
  }

  /** The full-detail item popup used by Inventory and Equipment pages */
  function renderItemPopup() {
    if (!itemDetailOpen || !selectedItem) return null;
    return (
      <div
        className="character-item-popup-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setItemDetailOpen(false);
          }
        }}
      >
        <section className="character-item-popup" role="dialog" aria-modal="true" aria-label="Детали предмета">
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
                <p className="muted">Хват: {selectedItemHandsRequired === 2 ? 'Двуручное' : 'Одноручное'}</p>
              ) : null}
              <p>{selectedDescription}</p>
              {selectedLoreDescription ? <p className="muted">{selectedLoreDescription}</p> : null}
              {typeof selectedAdminItem?.damageMin === 'number' || typeof selectedAdminItem?.damageMax === 'number' ? (
                <p className="muted">Урон: {selectedAdminItem?.damageMin ?? 0}-{selectedAdminItem?.damageMax ?? selectedAdminItem?.damageMin ?? 0}</p>
              ) : null}
              {typeof selectedAdminItem?.armorValue === 'number' ? (
                <p className="muted">Защита: {selectedAdminItem.armorValue}</p>
              ) : null}
              {selectedIsTwoHandedWeapon && equipment.shield ? (
                <p className="muted">Если надеть это оружие, предмет в левой руке вернётся в рюкзак.</p>
              ) : null}
              {shieldBlockedByTwoHandedWeapon ? (
                <p className="muted">Нельзя надеть этот предмет в левую руку, пока экипировано двуручное оружие.</p>
              ) : null}
              <p className="muted">
                Бонусы: {selectedBonusRows.map((row) => `${row.label} ${row.value > 0 ? `+${row.value}` : row.value}`).join(', ') || 'нет'}
              </p>
              <p className="muted">
                Требования: {selectedRequirementRows.map((row) => `${row.label} ${row.value}`).join(', ') || 'нет'}
              </p>
              <div className="character-item-actions">
                {selectedItem && isUsableHotbarItem(selectedItem) && onUseItem ? (
                  <button type="button" onClick={() => void useSelectedItem()}>
                    Использовать
                  </button>
                ) : null}
                {selectedItem && !isUsableHotbarItem(selectedItem) && resolvePreferredEquipmentSlot(selectedItem, equipment) ? (
                  <button type="button" onClick={() => void equipSelectedItem()}>
                    Экипировать
                  </button>
                ) : null}
                {selectedAlreadyEquipped ? (
                  <button type="button" onClick={() => { if (selectedEquippedSlotId) { void unequipFromSlot(selectedEquippedSlotId); } }}>
                    Снять
                  </button>
                ) : null}
              </div>
            </section>
            <section className="character-item-compare">
              <div className="character-item-compare-items">
                <div>
                  <span>Сейчас экипировано</span>
                  <strong>{comparisonCurrentItem?.name ?? 'Слот пуст'}</strong>
                  <small>{comparisonSlotId ? SLOT_LABELS[comparisonSlotId] : 'Нет слота'}</small>
                </div>
                <div>
                  <span>Выбранный предмет</span>
                  <strong>{selectedItem.name}</strong>
                  <small>{selectedAlreadyEquipped ? 'Уже экипирован' : selectedInventoryEntry ? 'В рюкзаке' : 'Экипирован'}</small>
                </div>
              </div>
              {itemDamageComparison ? (
                <p className="muted">
                  Сравнение урона: {(itemDamageComparison.currentMin ?? 0)}-{(itemDamageComparison.currentMax ?? itemDamageComparison.currentMin ?? 0)} → {(itemDamageComparison.nextMin ?? 0)}-{(itemDamageComparison.nextMax ?? itemDamageComparison.nextMin ?? 0)}
                </p>
              ) : null}
              {itemArmorComparison ? (
                <p className="muted">
                  Сравнение защиты: {itemArmorComparison.current} → {itemArmorComparison.next}
                </p>
              ) : null}
              {itemStatDiffRows.length > 0 ? (
                <div className="character-item-compare-grid">
                  {itemStatDiffRows.map((row) => (
                    <p key={`popup-stat-${row.key}`}>
                      <span>{row.label}</span>
                      <strong>{row.current > 0 ? `+${row.current}` : row.current} → {row.next > 0 ? `+${row.next}` : row.next}</strong>
                      <em className={row.diff > 0 ? 'is-up' : row.diff < 0 ? 'is-down' : ''}>
                        {row.diff > 0 ? `+${row.diff}` : row.diff}
                      </em>
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="character-item-compare-grid">
                {itemComparisonRows.map((row) => {
                  const delta = Number((row.after - row.before).toFixed(1));
                  return (
                    <p key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.before} → {row.after}</strong>
                      <em className={delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}>
                        {delta > 0 ? `+${delta}` : delta}
                      </em>
                    </p>
                  );
                })}
              </div>
            </section>
          </div>
        </section>
      </div>
    );
  }

  function renderTrainerSkillPopup() {
    if (!trainerPopupSkillId) return null;
    const entry = skillsTrainerCandidates.find((candidate) => candidate.skillId === trainerPopupSkillId) ?? null;
    if (!entry) return null;

    const skill = entry.skill;
    const skillName = skill?.name ?? entry.skillId;
    const skillType = skill?.type ?? 'unknown';
    const iconSrc = resolveSkillIcon?.(skill);
    const glyphFallback = skillName.slice(0, 2).toUpperCase();

    const costsGold = entry.costs.gold ?? 0;
    const costsItems = entry.costs.items ?? [];
    const costsQuestItems = entry.costs.questItems ?? [];
    const hasNonGoldCosts = costsItems.length > 0 || costsQuestItems.length > 0;

    const isBusy = learningSkillId === entry.skillId;
    const canLearn = Boolean(skill) && entry.isAvailable && !entry.isLearned && !isBusy;
    const learnDisabledReason =
      !skill
        ? 'Навык не найден.'
        : entry.isLearned
          ? 'Навык уже изучен.'
          : entry.reasons?.[0]?.message ?? 'Навык недоступен.';

    return (
      <div
        className="character-item-popup-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeTrainerPopup();
          }
        }}
      >
        <section className="character-item-popup" role="dialog" aria-modal="true" aria-label="Детали навыка">
          <div className="character-item-popup-head">
            <div className="character-item-popup-title">
              <span
                className="character-item-popup-icon"
                style={iconSrc
                  ? {
                      backgroundImage: `url("${iconSrc}")`,
                      backgroundSize: 'cover',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                    }
                  : {
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      color: 'rgba(232, 188, 110, 0.92)',
                    }}
              >
                {!iconSrc ? glyphFallback : null}
              </span>
              <div>
                <h3>{skillName}</h3>
                <p className="muted">ID: {entry.skillId} · {skillType}</p>
              </div>
            </div>
            <button type="button" className="character-item-popup-close" onClick={closeTrainerPopup}>×</button>
          </div>
          <div className="character-item-popup-body">
            <section className="character-item-popup-main">
              <p style={{ whiteSpace: 'pre-wrap' }}>
                {skill?.gameplayDescription?.trim()
                  || skill?.shortDescription?.trim()
                  || 'Описание пока не заполнено.'}
              </p>
              {entry.sources?.length ? (
                <p className="muted" style={{ marginTop: 10 }}>
                  Источники: {entry.sources.join(', ')}
                </p>
              ) : null}
            </section>
            <section className="character-item-compare">
              <div style={{ border: '1px solid rgba(169, 139, 87, 0.28)', background: 'rgba(12, 9, 7, 0.55)', padding: 10 }}>
                <p className="muted" style={{ margin: 0 }}>Стоимость</p>
                <p style={{ margin: '6px 0 0' }}>{costsGold > 0 ? `${costsGold} золота` : 'Бесплатно'}</p>
                {costsItems.length > 0 ? (
                  <p className="muted" style={{ margin: '6px 0 0' }}>
                    Предметы: {costsItems.map((c) => `${c.itemId} x${c.quantity}`).join(', ')}
                  </p>
                ) : null}
                {costsQuestItems.length > 0 ? (
                  <p className="muted" style={{ margin: '6px 0 0' }}>
                    Квестовые предметы: {costsQuestItems.map((c) => `${c.questItemId} x${c.quantity}`).join(', ')}
                  </p>
                ) : null}
                {hasNonGoldCosts ? (
                  <p className="muted" style={{ margin: '6px 0 0' }}>
                    Оплата предметами пока не подключена.
                  </p>
                ) : null}
              </div>

              <div style={{ marginTop: 12, border: '1px solid rgba(169, 139, 87, 0.28)', background: 'rgba(12, 9, 7, 0.55)', padding: 10 }}>
                <p className="muted" style={{ margin: 0 }}>Требования</p>
                {entry.reasons?.length ? (
                  <ul className="muted" style={{ margin: '8px 0 0', paddingLeft: 16 }}>
                    {entry.reasons.map((reason) => (
                      <li key={`${entry.skillId}-${reason.code}`}>{reason.message}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ margin: '8px 0 0' }}>Нет</p>
                )}
              </div>

              <div className="character-item-actions" style={{ marginTop: 12 }}>
                <button type="button" disabled={!canLearn} title={!canLearn ? learnDisabledReason : undefined} onClick={() => { void handleLearnSkill(entry.skillId); }}>
                  {entry.isLearned ? 'Изучено' : isBusy ? 'Обучение...' : entry.isAvailable ? 'Изучить' : 'Недоступно'}
                </button>
                <button type="button" onClick={closeTrainerPopup}>Закрыть</button>
              </div>
            </section>
          </div>
        </section>
      </div>
    );
  }

  /** Paper doll used by both Character Overview and Equipment pages */
  function renderPaperDoll() {
    return (
      <section className="character-paperdoll-card">
        <div className="character-paperdoll-canvas inventory-wrapper">
          {!silhouetteBroken ? (
            <PaperDoll
              race={paperDollRace}
              imageSrc={silhouetteSrc}
              slotItems={paperDollSlotItems}
              slotLabels={SLOT_LABELS}
              slotTextContent={actionSlotQuickContent}
              resolveItemImage={resolveItemImage}
              canDropItemInSlot={(slotId, itemId) => {
                try {
                  const item = resolveItemById ? resolveItemById(itemId) : getItemById(itemId);
                  if (!item) return false;
                  if ((QUICK_SLOT_IDS as string[]).includes(slotId)) return isUsableHotbarItem(item);
                  if (slotId === 'leftHand' && weaponOccupiesBothHands && !equipment.shield) return false;
                  return canEquipItemInSlot(item, slotId);
                } catch { return false; }
              }}
              debug={paperDollDebug}
              onImageError={() => {
                const fallback = getRaceSilhouetteFallback(paperDollRace as any);
                if (silhouetteSrc !== fallback) { setSilhouetteSrc(fallback); return; }
                setSilhouetteBroken(true);
              }}
              onSlotClick={(slotId) => {
                const isQuickSlot = (QUICK_SLOT_IDS as string[]).includes(slotId);
                const displayedItem = paperDollSlotItems[slotId] ?? null;
                if (displayedItem) { setSelectedItemId(displayedItem.id); setItemDetailOpen(true); return; }
                if (selectedItem && isQuickSlot) { void assignItemToActionSlot(slotId, selectedItem.id); return; }
                if (selectedItem) { void equipToSlot(slotId, selectedItem); }
              }}
              onSlotDoubleClick={(slotId) => {
                const isQuickSlot = (QUICK_SLOT_IDS as string[]).includes(slotId);
                if (!isQuickSlot && paperDollSlotItems[slotId]) {
                  void unequipFromSlot(slotId);
                }
              }}
              onSlotDrop={(slotId, itemId) => {
                try {
                  const item = resolveItemById ? resolveItemById(itemId) : getItemById(itemId);
                  if (!item) { return; }
                  if ((QUICK_SLOT_IDS as string[]).includes(slotId)) {
                    void assignItemToActionSlot(slotId, item.id);
                    return;
                  }
                  void equipToSlot(slotId, item);
                } catch { /* ignore invalid drop */ }
              }}
              onSlotContextMenu={(slotId) => {
                if ((QUICK_SLOT_IDS as string[]).includes(slotId)) {
                  console.info('[actionBar] clear', { characterId: character.id, slotId, entryKind: 'empty', result: 'requested' });
                  void assignItemToActionSlot(slotId, null);
                } else if (equippedByLayoutSlot[slotId]) {
                  void unequipFromSlot(slotId);
                }
              }}
            />
          ) : null}
        </div>
      </section>
    );
  }

  /** Paper doll for the Skills page: equipment slots work normally, quick slots accept skill assignments */
  function renderSkillsPaperDoll() {
    return (
      <section className="character-paperdoll-card">
        <div className="character-paperdoll-canvas inventory-wrapper">
          {!silhouetteBroken ? (
            <PaperDoll
              race={paperDollRace}
              imageSrc={silhouetteSrc}
              slotItems={paperDollSlotItems}
              slotLabels={SLOT_LABELS}
              slotTextContent={skillsQuickContent}
              selectedSlotId={selectedQuickSlotId}
              resolveItemImage={resolveItemImage}
              canDropItemInSlot={(slotId, itemId) => {
                if ((QUICK_SLOT_IDS as string[]).includes(slotId)) {
                  try {
                    const item = resolveItemById ? resolveItemById(itemId) : getItemById(itemId);
                    return isUsableHotbarItem(item);
                  } catch { return false; }
                }
                try {
                  const item = resolveItemById ? resolveItemById(itemId) : getItemById(itemId);
                  if (!item) return false;
                  if (slotId === 'leftHand' && weaponOccupiesBothHands && !equipment.shield) return false;
                  return canEquipItemInSlot(item, slotId);
                } catch { return false; }
              }}
              debug={paperDollDebug}
              onImageError={() => {
                const fallback = getRaceSilhouetteFallback(paperDollRace as any);
                if (silhouetteSrc !== fallback) { setSilhouetteSrc(fallback); return; }
                setSilhouetteBroken(true);
              }}
              onSlotClick={(slotId) => {
                const isQuickSlot = (QUICK_SLOT_IDS as string[]).includes(slotId);
                if (isQuickSlot) {
                  const slotIndex = QUICK_SLOT_IDS.indexOf(slotId);
                  const currentSlot = actionSlotsBySlot.get(slotIndex);
                  const currentSkillId = currentSlot?.kind === 'skill' ? currentSlot.refId : null;
                  if (selectedLearnedSkillId && !currentSkillId) {
                    void assignSkillToQuickSlot(slotId, selectedLearnedSkillId);
                    setSelectedQuickSlotId(null);
                  } else if (currentSkillId) {
                    setSelectedLearnedSkillId(currentSkillId);
                    setSelectedQuickSlotId(slotId === selectedQuickSlotId ? null : slotId);
                  } else {
                    setSelectedQuickSlotId(slotId === selectedQuickSlotId ? null : slotId);
                  }
                } else {
                  const equippedItem = equippedByLayoutSlot[slotId] ?? null;
                  if (equippedItem) { setSelectedItemId(equippedItem.id); setItemDetailOpen(true); }
                  else if (selectedItem) { void equipToSlot(slotId, selectedItem); }
                }
              }}
              onSlotDoubleClick={(slotId) => {
                const isQuickSlot = (QUICK_SLOT_IDS as string[]).includes(slotId);
                if (!isQuickSlot && equippedByLayoutSlot[slotId]) {
                  void unequipFromSlot(slotId);
                }
              }}
              onSlotDrop={(slotId, itemId) => {
                try {
                  const item = resolveItemById ? resolveItemById(itemId) : getItemById(itemId);
                  if (!item) { return; }
                  if ((QUICK_SLOT_IDS as string[]).includes(slotId)) {
                    void assignItemToActionSlot(slotId, item.id);
                    return;
                  }
                  void equipToSlot(slotId, item);
                } catch { /* ignore */ }
              }}
              onSkillDrop={(slotId, skillId) => {
                if ((QUICK_SLOT_IDS as string[]).includes(slotId)) {
                  void assignSkillToQuickSlot(slotId, skillId);
                }
              }}
              onSlotContextMenu={(slotId) => {
                if ((QUICK_SLOT_IDS as string[]).includes(slotId)) {
                  console.info('[actionBar] clear', { characterId: character.id, slotId, entryKind: 'empty', result: 'requested' });
                  void assignSkillToQuickSlot(slotId, null);
                } else if (equippedByLayoutSlot[slotId]) {
                  void unequipFromSlot(slotId);
                }
              }}
            />
          ) : null}
        </div>
      </section>
    );
  }

  function renderHoverPreviewCard() {
    if (!hoverPreview || !hoverItem) {
      return null;
    }

    return (
      <aside className="character-item-hover-card" style={{ left: hoverPreview.x, top: hoverPreview.y }} role="tooltip">
        <div className="character-item-hover-head">
          <strong>{hoverItem.name}</strong>
          <small>{hoverItem.itemType} / {hoverItem.itemSubType} / {hoverItem.rarity}</small>
        </div>
        <p className="muted">{hoverItem.description || 'Описание отсутствует.'}</p>
        <p className="muted">Бонусы: {Object.entries(hoverItem.bonuses).map(([key, value]) => `${formatItemStatLabel(key)} ${value ?? 0}`).join(', ') || 'нет'}</p>
        <p className="muted">Требования: {Object.entries(hoverItem.requiredStats).map(([key, value]) => `${formatItemStatLabel(key)} ${value ?? 0}`).join(', ') || 'нет'}</p>
        <div className="character-item-inline-compare-head">
          <span>Сравнение со слотом</span>
          <strong>{hoverComparison.currentItem?.name ?? 'Слот пуст'}</strong>
        </div>
        <div className="character-item-inline-compare-grid">
          {hoverComparison.rows.map((row) => {
            const delta = Number((row.after - row.before).toFixed(1));
            return (
              <p key={row.label}>
                <span>{row.label}</span>
                <strong>{row.before} → {row.after}</strong>
                <em className={delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}>{delta > 0 ? `+${delta}` : delta}</em>
              </p>
            );
          })}
        </div>
      </aside>
    );
  }

  function renderSelectedItemDetails(title: string, emptyText: string, showEquipAction: boolean, showUnequipAction: boolean) {
    return (
      <section className="character-item-detail-card">
        <h3>{title}</h3>
        {selectedItem ? (
          <>
            <strong>{selectedItem.name}</strong>
            <p className="muted">Тип: {selectedItem.itemType} / {selectedItem.itemSubType}</p>
            {selectedItem.itemType === 'weapon' ? (
              <p className="muted">Хват: {selectedItemHandsRequired === 2 ? 'Двуручное' : 'Одноручное'}</p>
            ) : null}
            <p className="muted">Редкость: {selectedItem.rarity}</p>
            <p>{selectedDescription}</p>
            {selectedLoreDescription ? <p className="muted">{selectedLoreDescription}</p> : null}
            {typeof selectedAdminItem?.damageMin === 'number' || typeof selectedAdminItem?.damageMax === 'number' ? (
              <p className="muted">Урон: {selectedAdminItem?.damageMin ?? 0}-{selectedAdminItem?.damageMax ?? selectedAdminItem?.damageMin ?? 0}</p>
            ) : null}
            {typeof selectedAdminItem?.armorValue === 'number' ? (
              <p className="muted">Защита: {selectedAdminItem.armorValue}</p>
            ) : null}
            <p className="muted">Бонусы: {selectedBonusRows.map((row) => `${row.label} ${row.value > 0 ? `+${row.value}` : row.value}`).join(', ') || 'нет'}</p>
            <p className="muted">Требования: {selectedRequirementRows.map((row) => `${row.label} ${row.value}`).join(', ') || 'нет'}</p>
            <div className="character-item-inline-compare-head">
              <span>Сравнение со слотом</span>
              <strong>{comparisonCurrentItem?.name ?? 'Слот пуст'}</strong>
            </div>
            {itemDamageComparison ? (
              <p className="muted">Сравнение урона: {(itemDamageComparison.currentMin ?? 0)}-{(itemDamageComparison.currentMax ?? itemDamageComparison.currentMin ?? 0)} → {(itemDamageComparison.nextMin ?? 0)}-{(itemDamageComparison.nextMax ?? itemDamageComparison.nextMin ?? 0)}</p>
            ) : null}
            {itemArmorComparison ? (
              <p className="muted">Сравнение защиты: {itemArmorComparison.current} → {itemArmorComparison.next}</p>
            ) : null}
            {itemStatDiffRows.length > 0 ? (
              <div className="character-item-inline-compare-grid">
                {itemStatDiffRows.map((row) => (
                  <p key={`stat-${row.key}`}>
                    <span>{row.label}</span>
                    <strong>{row.current > 0 ? `+${row.current}` : row.current} → {row.next > 0 ? `+${row.next}` : row.next}</strong>
                    <em className={row.diff > 0 ? 'is-up' : row.diff < 0 ? 'is-down' : ''}>{row.diff > 0 ? `+${row.diff}` : row.diff}</em>
                  </p>
                ))}
              </div>
            ) : null}
            <div className="character-item-inline-compare-grid">
              {itemComparisonRows.map((row) => {
                const delta = Number((row.after - row.before).toFixed(1));
                return (
                  <p key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.before} → {row.after}</strong>
                    <em className={delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}>{delta > 0 ? `+${delta}` : delta}</em>
                  </p>
                );
              })}
            </div>
            <div className="character-item-actions">
              {selectedItem && isUsableHotbarItem(selectedItem) && onUseItem ? (
                <button type="button" onClick={() => void useSelectedItem()}>
                  Использовать
                </button>
              ) : null}
              {showEquipAction && selectedItem && !isUsableHotbarItem(selectedItem) && resolvePreferredEquipmentSlot(selectedItem, equipment) ? (
                <button type="button" onClick={() => void equipSelectedItem()}>
                  Экипировать
                </button>
              ) : null}
              {showUnequipAction && selectedAlreadyEquipped ? (
                <button type="button" onClick={() => { if (selectedEquippedSlotId) { void unequipFromSlot(selectedEquippedSlotId); } }}>
                  Снять
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="muted">{emptyText}</p>
        )}
      </section>
    );
  }

  function renderEquipmentSummary(interactive = false) {
    return (
      <section className="character-meta-card character-equipment-summary-card">
        <h3>Экипировка</h3>
        <div className="character-equipment-summary-list">
          {equippedSummary.map((entry) => {
            const content = (
              <>
                <span>{entry.label}</span>
                <strong>{entry.item?.name ?? 'Пусто'}</strong>
              </>
            );

            if (!interactive || !entry.item) {
              return <div key={entry.slot} className="character-equipment-summary-row">{content}</div>;
            }

            return (
              <button
                key={entry.slot}
                type="button"
                className={`character-equipment-summary-row ${selectedItemId === entry.item.id ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedItemId(entry.item?.id ?? null);
                  setItemDetailOpen(true);
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function renderInventoryCards(
    entries: Array<{ item: ItemDefinition; quantity: number }>,
    compact = false,
  ) {
    return (
      <div className={`character-inventory-grid ${compact ? 'is-compact' : ''}`}>
        {entries.map((entry) => (
          <button
            key={entry.item.id}
            type="button"
            className={`character-item-card ${selectedItemId === entry.item.id ? 'is-active' : ''}`}
            onMouseEnter={(event) => {
              const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
              const cardWidth = Math.min(360, window.innerWidth - 24);
              const nextX = rect.right + cardWidth + 18 <= window.innerWidth ? rect.right + 12 : Math.max(12, rect.left - cardWidth - 12);
              const nextY = Math.max(12, Math.min(rect.top - 6, window.innerHeight - 280));
              setHoverPreview({ itemId: entry.item.id, x: nextX, y: nextY });
              setSelectedItemId(entry.item.id);
            }}
            onFocus={() => { setSelectedItemId(entry.item.id); }}
            onMouseLeave={() => { setHoverPreview((current) => (current?.itemId === entry.item.id ? null : current)); }}
            onBlur={() => { setHoverPreview((current) => (current?.itemId === entry.item.id ? null : current)); }}
            onClick={() => { setHoverPreview(null); setSelectedItemId(entry.item.id); setItemDetailOpen(true); }}
            onDoubleClick={() => { void handleDoubleClickInventoryItem(entry.item.id); }}
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
            />
            <span className="character-item-name">{entry.item.name}</span>
            <span className="character-item-qty">x{entry.quantity}</span>
          </button>
        ))}
      </div>
    );
  }

  function renderCharacterOverview() {
    const overviewInventory = inventoryEntries.slice(0, 12);

    return (
      <>
        {renderPageHeader()}
        <div className="inventory-panel-body inventory-panel-body--overview">
          <div className="character-overview-layout">
            <section className="character-status-card character-overview-hero">
              <div className="character-status-head">
                {playerAvatarUrl ? (
                  <img src={playerAvatarUrl} alt={character.name} className="character-avatar-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="character-avatar-circle">{character.name.charAt(0).toUpperCase()}</div>
                )}
                <div>
                  <strong>{character.name}</strong>
                  <p className="muted">Раса: {character.race}</p>
                  <p className="muted">Уровень {character.level}</p>
                </div>
              </div>
              <div className="character-status-bars">
                <p><span>HP</span><strong>{character.activeStats.hp}</strong></p>
                <p><span>Мана</span><strong>{character.activeStats.mp}</strong></p>
                <p><span>Выносливость</span><strong>{character.activeStats.stamina}</strong></p>
                <p><span>Золото</span><strong>{inventory.gold}</strong></p>
                <p><span>Опыт</span><strong>{character.exp}</strong></p>
                <p><span>До уровня</span><strong>{expToNextLevel}</strong></p>
              </div>
            </section>

            <div className="character-overview-paperdoll">
              {renderPaperDoll()}
              {renderEquipmentSummary(true)}
            </div>

            <section className="character-backpack-card character-overview-inventory-card">
              <div className="character-backpack-head">
                <div>
                  <h3>Рюкзак</h3>
                  <p className="muted">Компактный обзор предметов, экипировки и текущего выбора.</p>
                </div>
                {onChangeFocus ? <button type="button" onClick={() => onChangeFocus('inventory')}>Полный инвентарь</button> : null}
              </div>
              <div className="character-inventory-grid-wrap">
                {overviewInventory.length > 0 ? renderInventoryCards(overviewInventory, true) : <p className="muted">Рюкзак пуст.</p>}
              </div>
            </section>

            <div className="character-overview-side">
              <section className="character-meta-card">
                <button type="button" className="character-module-toggle" onClick={() => toggleModule('equipment')}>Снаряжение {isModuleCollapsed('equipment') ? '+' : '−'}</button>
                {!isModuleCollapsed('equipment') ? (
                  <div className="character-overview-combat-summary">
                    <p><span>Мин. урон</span><strong>{derivedPreview.minDamage}</strong></p>
                    <p><span>Макс. урон</span><strong>{derivedPreview.maxDamage}</strong></p>
                    <p><span>Защита</span><strong>{derivedPreview.totalDefense}</strong></p>
                    <p><span>Инициатива</span><strong>{derivedPreview.initiative}</strong></p>
                    <p><span>Попадание</span><strong>{derivedPreview.hitChance}%</strong></p>
                    <p><span>Уклонение</span><strong>{derivedPreview.evasion}%</strong></p>
                  </div>
                ) : null}
              </section>
              <section className="character-meta-card">
                <button type="button" className="character-module-toggle" onClick={() => toggleModule('stats')}>Краткие характеристики {isModuleCollapsed('stats') ? '+' : '−'}</button>
                {!isModuleCollapsed('stats') ? (
                  <div className="character-overview-stat-summary">
                    <p><span>Сила</span><strong>{previewStats.strength}</strong></p>
                    <p><span>Телосложение</span><strong>{previewStats.constitution}</strong></p>
                    <p><span>Ловкость</span><strong>{previewStats.dexterity}</strong></p>
                    <p><span>Интеллект</span><strong>{previewStats.intelligence}</strong></p>
                    <p><span>Защита</span><strong>{derivedPreview.totalDefense}</strong></p>
                    <p><span>Крит</span><strong>{derivedPreview.critChance}%</strong></p>
                  </div>
                ) : null}
              </section>
              <section className="character-meta-card">
                <button type="button" className="character-module-toggle" onClick={() => toggleModule('skills')}>Изученные навыки {isModuleCollapsed('skills') ? '+' : '−'}</button>
                {!isModuleCollapsed('skills') ? (
                  learnedSkillsSummary.length > 0 ? (
                    <div className="character-overview-skills-summary">
                      {learnedSkillsSummary.map((skill) => (
                        <div key={skill.id} className="character-overview-skill-pill">
                          <strong>{skill.name}</strong>
                          <span>ур. {skill.level}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="muted">Навыки ещё не изучены.</p>
                ) : null}
              </section>
              {renderSelectedItemDetails('Текущий предмет', 'Выберите предмет в рюкзаке или на силуэте, чтобы сразу увидеть сравнение.', true, true)}
            </div>
          </div>
          {renderHoverPreviewCard()}
        </div>
        {renderItemPopup()}
      </>
    );
  }

  function renderInventoryPage() {
    return (
      <>
        {renderPageHeader()}
        <div className="inventory-panel-body">
          <div className="character-inventory-layout">
            {/* Left: paper doll only — slots visible on silhouette, hover shows details */}
            <div className="character-inventory-side">
              {renderPaperDoll()}
            </div>
            {/* Right: inventory grid + item details (scrollable column) */}
            <div className="character-inventory-right-col">
              <section className="character-backpack-card">
                <div className="character-backpack-head">
                  <div>
                    <h3>Рюкзак</h3>
                    <p className="gold">Золото: {inventory.gold}</p>
                  </div>
                  <div className="character-inventory-controls">
                    <label>
                      Сортировка
                      <select value={inventorySort} onChange={(event) => setInventorySort(event.target.value as typeof inventorySort)}>
                        {Object.entries(INVENTORY_SORT_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>По {label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Фильтр
                      <select value={inventoryFilter} onChange={(event) => setInventoryFilter(event.target.value as typeof inventoryFilter)}>
                        {Object.entries(INVENTORY_FILTER_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="character-inventory-grid-wrap">
                  {renderInventoryCards(sortedFilteredInventory)}
                </div>
              </section>
              {renderSelectedItemDetails('Детали предмета', 'Выберите предмет в рюкзаке или кликните слот на силуэте.', true, true)}
            </div>
          </div>
          {renderHoverPreviewCard()}
        </div>
        {renderItemPopup()}
      </>
    );
  }

  function renderStatsPage() {
    return (
      <>
        {renderPageHeader()}
        <div className="inventory-panel-body inventory-panel-body--stats">
          <div className="character-stats-layout">
            {/* Left column: base stats with +/- buttons */}
            <section className="character-stats-card">
              <h3>Статы</h3>
              <p className="muted">Свободные очки: {freePointsLeft}</p>
              <div className="character-stats-list">
                {STATS_ORDER.map((stat) => (
                  <div key={stat} className="character-stat-row">
                    <span className="character-stat-label">
                      {STAT_LABELS[stat]}
                      <button type="button" className="stat-help-chip" title={STAT_HINTS[stat]} aria-label={`Что делает параметр ${STAT_LABELS[stat]}`}>?</button>
                    </span>
                    <strong>{character.activeStats[stat]}{previewStats[stat] !== character.activeStats[stat] ? ` → ${previewStats[stat]}` : ''}</strong>
                    <div className="mini-stepper">
                      <button disabled={freePointsLeft <= 0} onClick={() => onAdjustStat(stat, 1)}>+</button>
                      <button disabled={(pendingStatAllocation[stat] ?? 0) <= 0} onClick={() => onAdjustStat(stat, -1)}>-</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="character-item-actions">
                <button disabled={allocatingStats || !hasPendingAllocation || freePointsLeft < 0} onClick={() => void onApplyStatAllocation()}>
                  {allocatingStats ? 'Применение...' : 'Применить'}
                </button>
                <button type="button" disabled={!hasPendingAllocation} onClick={() => onResetStatAllocation?.()}>Откатить</button>
                <button type="button" onClick={() => void onRespecStats?.()} title="Сбросить распределение характеристик и вернуть все очки для перераспределения.">Сбросить</button>
              </div>
            </section>

            {/* Right column: derived stats, progress, breakdown, collapsible explanations */}
            <div className="character-stats-right-col">
              <section className="character-meta-card">
                <h3>Боевой обзор</h3>
                <p className="muted">Предпросмотр учитывает незакреплённые очки.</p>
                <div className="character-overview-combat-summary">
                  <p><span>HP</span><strong>{character.activeStats.hp}{previewStats.hp !== character.activeStats.hp ? ` → ${previewStats.hp}` : ''}</strong></p>
                  <p><span>Мана</span><strong>{character.activeStats.mp}{previewStats.mp !== character.activeStats.mp ? ` → ${previewStats.mp}` : ''}</strong></p>
                  <p><span>Выносливость</span><strong>{character.activeStats.stamina}{previewStats.stamina !== character.activeStats.stamina ? ` → ${previewStats.stamina}` : ''}</strong></p>
                  <p><span>Защита</span><strong>{derivedBase.totalDefense}{derivedPreview.totalDefense !== derivedBase.totalDefense ? ` → ${derivedPreview.totalDefense}` : ''}</strong></p>
                  <p><span>Мин. урон</span><strong>{derivedBase.minDamage}{derivedPreview.minDamage !== derivedBase.minDamage ? ` → ${derivedPreview.minDamage}` : ''}</strong></p>
                  <p><span>Макс. урон</span><strong>{derivedBase.maxDamage}{derivedPreview.maxDamage !== derivedBase.maxDamage ? ` → ${derivedPreview.maxDamage}` : ''}</strong></p>
                  <p><span>Крит</span><strong>{derivedBase.critChance}%{derivedPreview.critChance !== derivedBase.critChance ? ` → ${derivedPreview.critChance}%` : ''}</strong></p>
                  <p><span>Инициатива</span><strong>{derivedBase.initiative}{derivedPreview.initiative !== derivedBase.initiative ? ` → ${derivedPreview.initiative}` : ''}</strong></p>
                  <p><span>Попадание</span><strong>{derivedPreview.hitChance}%</strong></p>
                  <p><span>Уклонение</span><strong>{derivedPreview.evasion}%</strong></p>
                  <p><span>Блок</span><strong>{derivedPreview.blockChance}%</strong></p>
                  <p><span>Физ. сопр.</span><strong>{derivedPreview.physicalResistance}</strong></p>
                  <p><span>Маг. сопр.</span><strong>{derivedPreview.magicResistance}</strong></p>
                  <p><span>Нагр. выносл.</span><strong>{derivedPreview.staminaLoad}</strong></p>
                </div>
              </section>

              <section className="character-meta-card">
                <h3>Прогресс</h3>
                <p><span>Уровень</span><strong>{character.level}</strong></p>
                <p className="muted">Опыт: {character.exp} / {levelProgress.next}</p>
                <div style={{ margin: '0.4rem 0 0.6rem' }}>
                  <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                    <div style={{ width: `${levelProgress.totalInsideLevel > 0 ? Math.max(0, Math.min(100, (levelProgress.gainedInsideLevel / levelProgress.totalInsideLevel) * 100)) : 0}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #b6d36b 0%, #e6c15a 100%)' }} />
                  </div>
                </div>
                <p className="muted">До следующего уровня: {expToNextLevel} XP</p>
                <p className="muted">Раса: {character.race}</p>
              </section>

              <section className="character-meta-card">
                <h3>Разбор</h3>
                <p className="muted">Защита: {derivedPreview.defenseBreakdown.map((entry) => `${entry.label} ${entry.value}`).join(' | ')}</p>
                <p className="muted">Урон: {derivedPreview.damageBreakdown.map((entry) => `${entry.label} ${entry.value}`).join(' | ')}</p>
                <p className="muted">Крит: {derivedPreview.critBreakdown.map((entry) => `${entry.label} ${entry.value}`).join(' | ')}</p>
              </section>

              <section className="character-meta-card">
                <button type="button" className="character-module-toggle" onClick={() => toggleModule('explanations')}>
                  Пояснения {isModuleCollapsed('explanations') ? '+' : '−'}
                </button>
                {!isModuleCollapsed('explanations') && (
                  <div className="character-stat-explanations">
                    {STATS_ORDER.map((stat) => (
                      <article key={stat}>
                        <strong>{STAT_LABELS[stat]}</strong>
                        <p>{STAT_EXPLANATIONS[stat]}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderSkillsPage() {
    return (
      <>
        {renderPageHeader()}
        <div className="inventory-panel-body">
          <div className="character-skills-layout">
            {/* ── Preset toolbar ────────────────────────────────────── */}
            <section className="character-meta-card character-skills-toolbar">
              <div>
                <h3>Боевой набор</h3>
                <p className="muted">Переключение пресетов доступно вне боя. Каждый пресет хранит раскладку слотов.</p>
              </div>
              <div className="character-loadout-presets">
                {[0, 1, 2].map((presetIndex) => (
                  <div key={presetIndex} className="character-loadout-preset-actions">
                    <button type="button" className={activePresetIndex === presetIndex ? 'is-active' : ''} onClick={() => { void applyPreset(presetIndex as 0 | 1 | 2); }}>
                      Пресет {presetIndex + 1}
                    </button>
                    <button type="button" onClick={() => { void saveCurrentLoadoutAsPreset(presetIndex as 0 | 1 | 2); }}>
                      Сохранить
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Main 3-column area ────────────────────────────────── */}
            <div className="character-skills-3col">

              {/* LEFT: paper doll with quick skill slots */}
              <div className="character-skills-paperdoll-col">
                {renderSkillsPaperDoll()}
                <div className="character-skills-slot-hint">
                  {selectedQuickSlotId
                    ? <p className="muted">Слот {QUICK_SLOT_IDS.indexOf(selectedQuickSlotId) + 1} выбран — кликните навык чтобы назначить</p>
                    : <p className="muted">Кликните слот (внизу силуэта) для назначения навыка. ПКМ — убрать.</p>
                  }
                  <button
                    type="button"
                    disabled={!skillsHasDraftChanges || isSavingSkillLoadout}
                    onClick={() => { void saveSkillsLoadout(); }}
                  >
                    {isSavingSkillLoadout
                      ? 'Сохранение...'
                      : `Сохранить набор (${skillsAssignedCount}/${skillsDraftSlots.filter((s) => s.unlocked).length})`
                    }
                  </button>
                </div>
              </div>

              {/* CENTER: learned skills + learnable */}
              <div className="character-skills-list-col">
                <section className="inner-card skills-card-section">
                  <div className="skills-section-head">
                    <div>
                      <h3 style={{ marginTop: 0 }}>Изученные навыки</h3>
                      <p className="muted">Кликните навык чтобы выбрать, затем кликните слот на силуэте.</p>
                    </div>
                    <span className="skills-count-chip">{skillsLearnedFull.length}</span>
                  </div>
                  {skillsLearnedFull.length > 0 ? (
                    <div className="skills-card-grid">
                      {skillsLearnedFull.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className={`character-skill-card ${selectedLearnedSkillId === entry.skillId ? 'is-active' : ''}`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/theend-skill-id', entry.skillId);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onClick={() => {
                            if (selectedQuickSlotId) {
                              void assignSkillToQuickSlot(selectedQuickSlotId, entry.skillId);
                              setSelectedQuickSlotId(null);
                            }
                            setSelectedLearnedSkillId(entry.skillId);
                          }}
                          onMouseEnter={() => setSelectedLearnedSkillId(entry.skillId)}
                        >
                          <span className="character-skill-icon">{(entry.definition?.name ?? entry.skillId).slice(0, 2).toUpperCase()}</span>
                          <span className="skills-card-copy">
                            <strong>{entry.definition?.name ?? entry.skillId}</strong>
                            <small>Ур. {entry.level} · {entry.definition?.type ?? 'unknown'}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Персонаж пока не изучил ни одного навыка.</p>
                  )}
                </section>

                <section className="inner-card skills-training-section">
                  <div className="skills-section-head">
                    <div>
                      <h3 style={{ margin: 0 }}>
                        {trainerNpcId ? `Обучение у ${trainerNpcName ?? trainerNpcId}` : 'Обучение'}
                      </h3>
                      <span className="muted">Навыки у выбранного тренера.</span>
                    </div>
                  </div>
                  {!skillsPlayerContext.npcId ? (
                    <p className="muted" style={{ marginTop: 12 }}>Чтобы обучиться, поговорите с тренером.</p>
                  ) : skillsTrainerCandidates.length === 0 ? (
                    <p className="muted" style={{ marginTop: 12 }}>Этот персонаж пока ничему не обучает.</p>
                  ) : (
                    <>
                      {skillsTrainerAvailable.length > 0 ? (
                        <div style={{ marginTop: 12 }}>
                          <p className="muted" style={{ margin: 0 }}>Доступно для изучения</p>
                          <div className="skill-icon-grid" style={{ marginTop: 8 }}>
                            {skillsTrainerAvailable.map((entry) => {
                              const skill = entry.skill;
                              const name = skill?.name ?? entry.skillId;
                              const iconSrc = resolveSkillIcon?.(skill);
                              const glyph = name.slice(0, 2).toUpperCase();
                              return (
                                <button
                                  key={entry.skillId}
                                  type="button"
                                  className={`skill-icon-item ${trainerPopupSkillId === entry.skillId ? 'is-active' : ''}`}
                                  onClick={() => openTrainerPopup(entry.skillId)}
                                >
                                  <span className="skill-icon-glyph">
                                    {iconSrc ? <img src={iconSrc} alt="" /> : glyph}
                                  </span>
                                  <span className="skill-icon-label">{name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {skillsTrainerLocked.length > 0 ? (
                        <div style={{ marginTop: 12 }}>
                          {skillsTrainerAvailable.length === 0 ? (
                            <p className="muted" style={{ margin: 0 }}>Навыки найдены, но условия не выполнены.</p>
                          ) : (
                            <p className="muted" style={{ margin: 0 }}>Заблокировано</p>
                          )}
                          <div className="skill-icon-grid" style={{ marginTop: 8 }}>
                            {skillsTrainerLocked.map((entry) => {
                              const skill = entry.skill;
                              const name = skill?.name ?? entry.skillId;
                              const iconSrc = resolveSkillIcon?.(skill);
                              const glyph = name.slice(0, 2).toUpperCase();
                              return (
                                <button
                                  key={`locked-${entry.skillId}`}
                                  type="button"
                                  className={`skill-icon-item is-locked ${trainerPopupSkillId === entry.skillId ? 'is-active' : ''}`}
                                  onClick={() => openTrainerPopup(entry.skillId)}
                                >
                                  <span className="skill-icon-glyph">
                                    {iconSrc ? <img src={iconSrc} alt="" /> : glyph}
                                  </span>
                                  <span className="skill-icon-label">{name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {skillsTrainerLearned.length > 0 ? (
                        <div style={{ marginTop: 12 }}>
                          <p className="muted" style={{ margin: 0 }}>Уже изучено</p>
                          <div className="skill-icon-grid" style={{ marginTop: 8 }}>
                            {skillsTrainerLearned.map((entry) => {
                              const skill = entry.skill;
                              const name = skill?.name ?? entry.skillId;
                              const iconSrc = resolveSkillIcon?.(skill);
                              const glyph = name.slice(0, 2).toUpperCase();
                              return (
                                <button
                                  key={`learned-${entry.skillId}`}
                                  type="button"
                                  className={`skill-icon-item is-learned ${trainerPopupSkillId === entry.skillId ? 'is-active' : ''}`}
                                  onClick={() => openTrainerPopup(entry.skillId)}
                                >
                                  <span className="skill-icon-glyph">
                                    {iconSrc ? <img src={iconSrc} alt="" /> : glyph}
                                  </span>
                                  <span className="skill-icon-label">{name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {skillsTrainerAvailable.length === 0 && skillsTrainerLocked.length === 0 && skillsTrainerLearned.length > 0 ? (
                        <p className="muted" style={{ marginTop: 12 }}>Все навыки этого тренера уже изучены.</p>
                      ) : null}
                    </>
                  )}
                </section>
              </div>

              {/* RIGHT: skill detail */}
              <section className="inner-card skills-detail-section">
                <h3 style={{ marginTop: 0 }}>Детали навыка</h3>
                {skillsSelectedDef ? (
                  <>
                    <div className="skills-detail-head">
                      <span className="character-skill-icon skills-detail-icon">{skillsSelectedDef.def.name.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <strong>{skillsSelectedDef.def.name}</strong>
                        <p className="muted">ID: {skillsSelectedDef.def.id} · Уровень {skillsSelectedDef.level}/{skillsSelectedDef.def.maxLevel}</p>
                      </div>
                    </div>
                    <div className="skills-detail-facts">
                      <p><span>Тип</span><strong>{skillsSelectedDef.def.type}</strong></p>
                      <p><span>Навык</span><strong>{skillsSelectedDef.def.name}</strong></p>
                      <p><span>Макс. уровень</span><strong>{skillsSelectedDef.def.maxLevel}</strong></p>
                      <p><span>Перезарядка</span><strong>{skillsSelectedDef.def.cooldown.cooldownTurns} ходов</strong></p>
                    </div>
                    <p className="skills-detail-text" style={{ whiteSpace: 'pre-wrap' }}>
                      {[
                        skillsSelectedDef.def.gameplayDescription?.trim() || skillsSelectedDef.def.shortDescription?.trim() || 'Описание не заполнено.',
                        `Ресурсы: ${skillsSelectedDef.def.costs.isFree ? 'без затрат' : 'смотри описание'}`,
                        `Перезарядка: ${skillsSelectedDef.def.cooldown.cooldownTurns} ходов`,
                        `Тип: ${skillsSelectedDef.def.type}`,
                      ].join('\n')}
                    </p>
                    {selectedQuickSlotId ? (
                      <button
                        type="button"
                        onClick={() => {
                          void assignSkillToQuickSlot(selectedQuickSlotId, skillsSelectedDef.def.id);
                          setSelectedQuickSlotId(null);
                        }}
                      >
                        → Назначить в слот {QUICK_SLOT_IDS.indexOf(selectedQuickSlotId) + 1}
                      </button>
                    ) : (
                      <p className="muted" style={{ marginTop: 8, fontSize: '0.82rem' }}>
                        Выберите слот на силуэте, чтобы назначить этот навык.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="muted">Выберите навык, чтобы посмотреть детали.</p>
                )}
              </section>
            </div>
          </div>
        </div>
        {renderTrainerSkillPopup()}
      </>
    );
  }

  function renderEquipmentPage() {
    return renderInventoryPage();
  }

  function renderCombinedCharacterPage() {
    return (
      <>
        {renderPageHeader()}
        <div className="inventory-panel-body inventory-panel-body--combined">
          <div className="combined-char-layout">

            {/* ── LEFT: Stats + Derived ─────────────────────────────────── */}
            <div className="combined-char-left">
              {/* Character hero */}
              <section className="character-meta-card combined-char-hero">
                <div className="character-status-head">
                  {playerAvatarUrl ? (
                    <img src={playerAvatarUrl} alt={character.name} className="character-avatar-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="character-avatar-circle">{character.name.charAt(0).toUpperCase()}</div>
                  )}
                  <div>
                    <strong>{character.name}</strong>
                    <p className="muted">Раса: {character.race}</p>
                    <p className="muted">Ур. {character.level}</p>
                  </div>
                </div>
                <div className="combined-char-hero-bars">
                  <p><span>HP</span><strong>{character.activeStats.hp}</strong></p>
                  <p><span>Мана</span><strong>{character.activeStats.mp}</strong></p>
                  <p><span>Выносл.</span><strong>{character.activeStats.stamina}</strong></p>
                  <p><span>Золото</span><strong>{inventory.gold}</strong></p>
                  <p><span>Опыт</span><strong>{character.exp} / {levelProgress.next}</strong></p>
                </div>
              </section>

              {/* Base stats with allocation */}
              <section className="character-stats-card">
                <h3>Статы</h3>
                <p className="muted">Свободные очки: {freePointsLeft}</p>
                <div className="character-stats-list combined-char-stats-list">
                  {STATS_ORDER.map((stat) => (
                    <div key={stat} className="character-stat-row">
                      <span className="character-stat-label">
                        {STAT_LABELS[stat]}
                        <button type="button" className="stat-help-chip" title={STAT_HINTS[stat]} aria-label={`Что делает ${STAT_LABELS[stat]}`}>?</button>
                      </span>
                      <strong>{character.activeStats[stat]}{previewStats[stat] !== character.activeStats[stat] ? ` → ${previewStats[stat]}` : ''}</strong>
                      <div className="mini-stepper">
                        <button disabled={freePointsLeft <= 0} onClick={() => onAdjustStat(stat, 1)}>+</button>
                        <button disabled={(pendingStatAllocation[stat] ?? 0) <= 0} onClick={() => onAdjustStat(stat, -1)}>-</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="character-item-actions">
                  <button disabled={allocatingStats || !hasPendingAllocation || freePointsLeft < 0} onClick={() => void onApplyStatAllocation()}>
                    {allocatingStats ? 'Применение...' : 'Применить'}
                  </button>
                  <button type="button" disabled={!hasPendingAllocation} onClick={() => onResetStatAllocation?.()}>Откатить</button>
                </div>
              </section>

              {/* Derived stats compact */}
              <section className="character-meta-card">
                <h3>Боевые показатели</h3>
                <div className="combined-char-derived">
                  <p><span>Защита</span><strong>{derivedPreview.totalDefense}</strong></p>
                  <p><span>Мин. урон</span><strong>{derivedPreview.minDamage}</strong></p>
                  <p><span>Макс. урон</span><strong>{derivedPreview.maxDamage}</strong></p>
                  <p><span>Крит</span><strong>{derivedPreview.critChance}%</strong></p>
                  <p><span>Инициатива</span><strong>{derivedPreview.initiative}</strong></p>
                  <p><span>Попадание</span><strong>{derivedPreview.hitChance}%</strong></p>
                  <p><span>Уклонение</span><strong>{derivedPreview.evasion}%</strong></p>
                  <p><span>Блок</span><strong>{derivedPreview.blockChance}%</strong></p>
                  <p><span>Физ. сопр.</span><strong>{derivedPreview.physicalResistance}</strong></p>
                  <p><span>Маг. сопр.</span><strong>{derivedPreview.magicResistance}</strong></p>
                </div>
              </section>
            </div>

            {/* ── CENTER: Paper Doll ───────────────────────────────────── */}
            <div className="combined-char-center">
              {renderPaperDoll()}
            </div>

            {/* ── RIGHT: Skills ────────────────────────────────────────── */}
            <div className="combined-char-right">
              {/* Preset toolbar */}
              <section className="character-meta-card character-skills-toolbar">
                <div>
                  <h3>Боевой набор</h3>
                </div>
                <div className="character-loadout-presets">
                  {[0, 1, 2].map((presetIndex) => (
                    <div key={presetIndex} className="character-loadout-preset-actions">
                      <button type="button" className={activePresetIndex === presetIndex ? 'is-active' : ''} onClick={() => { void applyPreset(presetIndex as 0 | 1 | 2); }}>
                        Пресет {presetIndex + 1}
                      </button>
                      <button type="button" onClick={() => { void saveCurrentLoadoutAsPreset(presetIndex as 0 | 1 | 2); }}>
                        Сохранить
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              {/* Skills page */}
              <section className="character-skills-card">
                <CharacterSkillsPage
                  learnedSkills={learnedSkills}
                  availableSkills={availableSkills}
                  loadout={skillLoadout}
                  trainerSkillIds={trainerSkillIds}
                  mode={trainerNpcId ? 'trainer' : 'character'}
                  trainerNpcName={trainerNpcName}
                  playerContext={{
                    playerId: character.id,
                    level: character.level,
                    race: String(character.race ?? ''),
                    classId: null,
                    npcId: trainerNpcId ?? null,
                    gold: inventory.gold ?? null,
                    stats: character.activeStats ?? null,
                  }}
                  onLearnSkill={onLearnSkill ?? (async () => undefined)}
                  onSaveLoadout={onSaveSkillLoadout ?? (async () => undefined)}
                  onStatus={onStatus}
                />
              </section>
            </div>

            {/* ── BOTTOM: Inventory + Item Details ─────────────────────── */}
            <div className="combined-char-bottom">
              <section className="character-backpack-card">
                <div className="character-backpack-head">
                  <div>
                    <h3>Рюкзак</h3>
                  </div>
                  <div className="character-inventory-controls">
                    <label>
                      Сортировка
                      <select value={inventorySort} onChange={(event) => setInventorySort(event.target.value as typeof inventorySort)}>
                        {Object.entries(INVENTORY_SORT_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>По {label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Фильтр
                      <select value={inventoryFilter} onChange={(event) => setInventoryFilter(event.target.value as typeof inventoryFilter)}>
                        {Object.entries(INVENTORY_FILTER_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="character-inventory-grid-wrap">
                  {sortedFilteredInventory.length > 0
                    ? renderInventoryCards(sortedFilteredInventory, true)
                    : <p className="muted">Рюкзак пуст.</p>}
                </div>
              </section>
              {renderSelectedItemDetails('Детали предмета', 'Выберите предмет в рюкзаке или кликните слот на силуэте.', true, true)}
            </div>

          </div>
          {renderHoverPreviewCard()}
        </div>
        {renderItemPopup()}
      </>
    );
  }


  // â”€â”€ main return â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true">
      <section className="card battle-window wm-modal character-page-modal">
        {focusSection === 'character' && renderCombinedCharacterPage()}
        {focusSection === 'inventory' && renderInventoryPage()}
        {focusSection === 'stats' && renderStatsPage()}
        {focusSection === 'skills' && renderSkillsPage()}
        {focusSection === 'equipment' && renderEquipmentPage()}
      </section>
    </div>
  );
};
