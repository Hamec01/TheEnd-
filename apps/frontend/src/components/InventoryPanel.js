import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { getItemById, getItemHandsRequired } from '@theend/rpg-domain';
import { PaperDoll } from './PaperDoll';
import { PAPER_DOLL_ASSETS } from './paperDollSlots';
import { getRaceSilhouette, getRaceSilhouetteFallback, } from '../utils/raceSilhouette';
const CORE_SLOT_BY_LAYOUT = {
    helmet: 'helmet',
    armor: 'armor',
    boots: 'boots',
    gloves: 'gloves',
    leftHand: 'shield',
    rightHand: 'weapon',
};
const SLOT_LABELS = {
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
const SLOT_ACCEPTED_TYPES = {
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
const ALL_SLOT_IDS = Object.keys(SLOT_LABELS);
const STATS_ORDER = [
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
const STAT_LABELS = {
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
const SKILL_NAMES = {
    NONE: 'Базовая атака',
    POWER_STRIKE: 'Power Strike',
    CRUSHING_BLOCK: 'Crushing Block',
    RAGE: 'Rage',
    FIREBALL: 'Пламя Фелдана',
    FROST_LANCE: 'Frost Lance',
    SHIELD_BASH: 'Таран Арклейна',
    WHIRLWIND: 'Whirlwind',
};
const FOCUS_SECTION_COLUMN = {
    character: 'left',
    equipment: 'left',
    inventory: 'center',
    stats: 'right',
    skills: 'right',
};
function getItemCategories(item) {
    const categories = new Set([item.itemType, item.itemSubType, 'small_accessory']);
    if (item.itemType === 'weapon') {
        if (getItemHandsRequired(item) === 2) {
            categories.add('two_handed_weapon');
        }
        else {
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
export function canEquipItemInSlot(item, slotId) {
    const accepted = SLOT_ACCEPTED_TYPES[slotId];
    if (!accepted) {
        return false;
    }
    const categories = getItemCategories(item);
    return accepted.some((itemType) => categories.includes(itemType));
}
export function getAcceptedSlotsForItem(item) {
    return ALL_SLOT_IDS.filter((slotId) => canEquipItemInSlot(item, slotId));
}
export const InventoryPanel = ({ character, inventory, equipment, learnedSkills, pendingStatAllocation, freePointsLeft, allocatingStats, focusSection, onClose, onStatus, onEquipItem, onUnequipSlot, onAdjustStat, onApplyStatAllocation, onUseItem, resolveItemById, resolveItemImage, }) => {
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [selectedSkillId, setSelectedSkillId] = useState(null);
    const [skillTab, setSkillTab] = useState('skills');
    const [virtualEquipment, setVirtualEquipment] = useState({});
    const [silhouetteBroken, setSilhouetteBroken] = useState(false);
    const [silhouetteSrc, setSilhouetteSrc] = useState(() => getRaceSilhouette(character.race));
    const leftColumnRef = useRef(null);
    const centerColumnRef = useRef(null);
    const rightColumnRef = useRef(null);
    const inventoryEntries = useMemo(() => inventory.items
        .map((entry) => {
        const item = resolveItemById ? resolveItemById(entry.itemId) : getItemById(entry.itemId);
        return item ? { item, quantity: entry.quantity } : null;
    })
        .filter(Boolean), [inventory.items, resolveItemById]);
    const inventoryByItemId = useMemo(() => new Map(inventoryEntries.map((entry) => [entry.item.id, entry])), [inventoryEntries]);
    const selectedInventoryEntry = useMemo(() => (selectedItemId ? inventoryByItemId.get(selectedItemId) ?? null : null), [inventoryByItemId, selectedItemId]);
    const selectedItem = selectedInventoryEntry?.item ?? null;
    const equippedWeapon = useMemo(() => (equipment.weapon ? (resolveItemById ? resolveItemById(equipment.weapon) : getItemById(equipment.weapon)) : null), [equipment.weapon, resolveItemById]);
    const selectedItemHandsRequired = selectedItem ? getItemHandsRequired(selectedItem) : 1;
    const selectedIsTwoHandedWeapon = Boolean(selectedItem && selectedItem.itemType === 'weapon' && selectedItemHandsRequired === 2);
    const shieldBlockedByTwoHandedWeapon = Boolean(selectedItem?.itemType === 'shield' && equippedWeapon && getItemHandsRequired(equippedWeapon) === 2);
    const paperDollRace = (character.race in PAPER_DOLL_ASSETS ? character.race : 'HUMAN');
    const paperDollDebug = useMemo(() => {
        if (!import.meta.env.DEV) {
            return false;
        }
        try {
            return window.localStorage.getItem('paperDoll.debug') === '1';
        }
        catch {
            return false;
        }
    }, []);
    const equippedByLayoutSlot = useMemo(() => {
        const full = {};
        for (const slotId of ALL_SLOT_IDS) {
            const coreSlot = CORE_SLOT_BY_LAYOUT[slotId];
            if (coreSlot) {
                const itemId = equipment[coreSlot];
                full[slotId] = itemId ? (resolveItemById ? resolveItemById(itemId) : getItemById(itemId)) : null;
            }
            else {
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
    const equippedItemIds = useMemo(() => new Set(Object.values(equippedByLayoutSlot).filter((item) => Boolean(item)).map((item) => item.id)), [equippedByLayoutSlot]);
    const selectedAlreadyEquipped = Boolean(selectedItem && equippedItemIds.has(selectedItem.id));
    useEffect(() => {
        setSilhouetteBroken(false);
        setSilhouetteSrc(getRaceSilhouette(paperDollRace));
    }, [paperDollRace]);
    const skillItems = useMemo(() => learnedSkills.map((skillId) => ({
        id: skillId,
        name: SKILL_NAMES[skillId] ?? skillId,
        type: skillTab,
        description: skillTab === 'status' ? 'Статусный эффект из текущего билда.' : 'Детали будут расширены в следующем обновлении.',
    })), [learnedSkills, skillTab]);
    const selectedSkill = skillItems.find((skill) => skill.id === selectedSkillId) ?? null;
    async function equipToSlot(slotId, item) {
        if (!canEquipItemInSlot(item, slotId)) {
            onStatus('Item cannot be equipped in this slot');
            return;
        }
        const coreSlot = CORE_SLOT_BY_LAYOUT[slotId];
        if (coreSlot) {
            try {
                await onEquipItem(item.id);
            }
            catch {
                // parent already reports error status
            }
            return;
        }
        setVirtualEquipment((current) => ({ ...current, [slotId]: item.id }));
        onStatus(`${item.name} assigned to ${slotId}`);
    }
    async function equipSelectedItem() {
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
    async function unequipFromSlot(slotId) {
        const coreSlot = CORE_SLOT_BY_LAYOUT[slotId];
        if (coreSlot) {
            try {
                await onUnequipSlot(coreSlot);
            }
            catch {
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
    return (_jsx("div", { className: "battle-overlay", role: "dialog", "aria-modal": "true", children: _jsxs("section", { className: "card battle-window wm-modal character-page-modal", children: [_jsxs("div", { className: "battle-window-head", children: [_jsxs("h2", { children: ["Character Page - ", character.name] }), _jsx("button", { onClick: onClose, children: "\u2715" })] }), _jsxs("div", { className: "character-page-grid", children: [_jsxs("section", { ref: leftColumnRef, className: `character-column character-left ${focusedColumnClass === 'left' ? 'is-focused' : ''}`, children: [_jsxs("section", { className: "character-status-card", children: [_jsxs("div", { className: "character-status-head", children: [_jsx("div", { className: "character-avatar-circle", children: character.name.charAt(0).toUpperCase() }), _jsxs("div", { children: [_jsx("strong", { children: character.name }), _jsxs("p", { className: "muted", children: ["Race: ", character.race] })] })] }), _jsxs("div", { className: "character-status-bars", children: [_jsxs("p", { children: ["HP ", character.activeStats.hp] }), _jsxs("p", { children: ["Mana ", character.activeStats.mp] }), _jsxs("p", { children: ["Stamina ", character.activeStats.stamina] }), _jsxs("p", { children: ["Gold ", inventory.gold] })] })] }), _jsx("section", { className: "character-paperdoll-card", children: _jsx("div", { className: "character-paperdoll-canvas inventory-wrapper", children: !silhouetteBroken ? (_jsx(PaperDoll, { race: paperDollRace, imageSrc: silhouetteSrc, slotItems: equippedByLayoutSlot, slotLabels: SLOT_LABELS, resolveItemImage: resolveItemImage, debug: paperDollDebug, onImageError: () => {
                                                const fallback = getRaceSilhouetteFallback(paperDollRace);
                                                if (silhouetteSrc !== fallback) {
                                                    setSilhouetteSrc(fallback);
                                                    return;
                                                }
                                                setSilhouetteBroken(true);
                                            }, onSlotClick: (slotId) => {
                                                const equippedItem = equippedByLayoutSlot[slotId] ?? null;
                                                if (equippedItem) {
                                                    setSelectedItemId(equippedItem.id);
                                                    return;
                                                }
                                                if (selectedItem) {
                                                    void equipToSlot(slotId, selectedItem);
                                                }
                                            }, onSlotDrop: (slotId, itemId) => {
                                                try {
                                                    const item = resolveItemById ? resolveItemById(itemId) : getItemById(itemId);
                                                    if (item) {
                                                        void equipToSlot(slotId, item);
                                                    }
                                                }
                                                catch {
                                                    // ignore invalid drop payload
                                                }
                                            }, onSlotContextMenu: (slotId) => {
                                                if (equippedByLayoutSlot[slotId]) {
                                                    void unequipFromSlot(slotId);
                                                }
                                            } })) : null }) })] }), _jsxs("section", { ref: centerColumnRef, className: `character-column character-center ${focusedColumnClass === 'center' ? 'is-focused' : ''}`, children: [_jsxs("section", { className: "character-backpack-card", children: [_jsxs("div", { className: "character-backpack-head", children: [_jsx("h3", { children: "\u0420\u044E\u043A\u0437\u0430\u043A / Backpack" }), _jsxs("p", { className: "gold", children: ["\uD83E\uDE99 ", inventory.gold] })] }), _jsx("div", { className: "character-inventory-grid-wrap", children: _jsx("div", { className: "character-inventory-grid", children: inventoryEntries.map((entry) => (_jsxs("button", { type: "button", className: `character-item-card ${selectedItemId === entry.item.id ? 'is-active' : ''}`, onClick: () => setSelectedItemId(entry.item.id), draggable: true, onDragStart: (event) => {
                                                        event.dataTransfer.setData('text/theend-item-id', entry.item.id);
                                                        event.dataTransfer.effectAllowed = 'move';
                                                    }, children: [_jsx("span", { className: "character-item-icon", style: resolveItemImage?.(entry.item)
                                                                ? {
                                                                    backgroundImage: `url("${resolveItemImage(entry.item)}")`,
                                                                    backgroundSize: 'contain',
                                                                    backgroundRepeat: 'no-repeat',
                                                                    backgroundPosition: 'center',
                                                                }
                                                                : undefined, children: !resolveItemImage?.(entry.item) ? entry.item.name.slice(0, 1).toUpperCase() : null }), _jsx("span", { className: "character-item-name", children: entry.item.name }), _jsxs("span", { className: "character-item-qty", children: ["x", entry.quantity] })] }, entry.item.id))) }) })] }), _jsxs("section", { className: "character-item-detail-card", children: [_jsx("h3", { children: "Item Details" }), selectedItem ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: selectedItem.name }), _jsxs("p", { className: "muted", children: ["Type: ", selectedItem.itemType, " / ", selectedItem.itemSubType] }), selectedItem.itemType === 'weapon' ? (_jsxs("p", { className: "muted", children: ["Hands: ", selectedItemHandsRequired === 2 ? 'Two-handed / Двуручное' : 'One-handed / Одноручное'] })) : null, _jsxs("p", { className: "muted", children: ["Rarity: ", selectedItem.rarity] }), _jsx("p", { children: selectedItem.description }), selectedIsTwoHandedWeapon && equipment.shield ? (_jsx("p", { className: "muted", children: "Equipping this weapon will remove the offhand item and leave it in your inventory." })) : null, shieldBlockedByTwoHandedWeapon ? (_jsx("p", { className: "muted", children: "Cannot equip this offhand item while a two-handed weapon is worn." })) : null, _jsxs("p", { className: "muted", children: ["Bonuses: ", Object.entries(selectedItem.bonuses).map(([key, value]) => `${key} ${value ?? 0}`).join(', ') || 'none'] }), _jsxs("p", { className: "muted", children: ["Requirements: ", Object.entries(selectedItem.requiredStats).map(([key, value]) => `${key} ${value ?? 0}`).join(', ') || 'none'] }), _jsxs("div", { className: "character-item-actions", children: [_jsx("button", { disabled: selectedAlreadyEquipped, onClick: () => {
                                                                void equipSelectedItem();
                                                            }, children: selectedAlreadyEquipped ? 'Equipped' : 'Equip' }), _jsx("button", { disabled: selectedItem.itemType !== 'consumable', onClick: () => {
                                                                if (onUseItem) {
                                                                    void onUseItem(selectedItem.id);
                                                                }
                                                                else {
                                                                    onStatus('Use action is not available in this context.');
                                                                }
                                                            }, children: "Use" }), _jsx("button", { disabled: true, children: "Drop" })] })] })) : (_jsx("p", { className: "muted", children: "Select an item from backpack." }))] })] }), _jsxs("section", { ref: rightColumnRef, className: `character-column character-right ${focusedColumnClass === 'right' ? 'is-focused' : ''}`, children: [_jsxs("section", { className: "character-stats-card", children: [_jsx("h3", { children: "Stats" }), _jsxs("p", { className: "muted", children: ["Free points: ", freePointsLeft] }), _jsx("div", { className: "character-stats-list", children: STATS_ORDER.map((stat) => (_jsxs("div", { className: "character-stat-row", children: [_jsx("span", { children: STAT_LABELS[stat] }), _jsx("strong", { children: character.activeStats[stat] }), _jsxs("div", { className: "mini-stepper", children: [_jsx("button", { disabled: freePointsLeft <= 0, onClick: () => onAdjustStat(stat, 1), children: "+" }), _jsx("button", { disabled: (pendingStatAllocation[stat] ?? 0) <= 0, onClick: () => onAdjustStat(stat, -1), children: "-" })] })] }, stat))) }), _jsx("button", { disabled: allocatingStats || Object.keys(pendingStatAllocation).length === 0, onClick: () => void onApplyStatAllocation(), children: allocatingStats ? 'Applying...' : 'Apply' })] }), _jsxs("section", { className: "character-meta-card", children: [_jsx("h3", { children: "Level / Progression" }), _jsxs("p", { children: ["Level: ", character.level] }), _jsxs("p", { children: ["Experience: ", character.exp] }), _jsx("p", { children: "Faction: None" }), _jsx("p", { children: "Reputation: None" }), _jsx("p", { children: "Professions: \u041D\u0435 \u0438\u0437\u0443\u0447\u0435\u043D\u043E" }), _jsx("p", { children: "Class: None" }), _jsxs("p", { children: ["Race: ", character.race] })] }), _jsxs("section", { className: "character-skills-card", children: [_jsxs("div", { className: "character-skills-tabs", children: [_jsx("button", { className: skillTab === 'skills' ? 'is-active' : '', onClick: () => setSkillTab('skills'), children: "Skills" }), _jsx("button", { className: skillTab === 'abilities' ? 'is-active' : '', onClick: () => setSkillTab('abilities'), children: "Abilities" }), _jsx("button", { className: skillTab === 'passives' ? 'is-active' : '', onClick: () => setSkillTab('passives'), children: "Passives" }), _jsx("button", { className: skillTab === 'status' ? 'is-active' : '', onClick: () => setSkillTab('status'), children: "Status" })] }), _jsx("div", { className: "character-skills-list", children: skillItems.length > 0 ? skillItems.map((skill) => (_jsxs("button", { type: "button", className: `character-skill-card ${selectedSkillId === skill.id ? 'is-active' : ''}`, onClick: () => setSelectedSkillId(skill.id), children: [_jsx("span", { className: "character-skill-icon", children: skill.name.slice(0, 2).toUpperCase() }), _jsxs("span", { children: [_jsx("strong", { children: skill.name }), _jsx("small", { children: skill.type })] })] }, skill.id))) : (_jsx("p", { className: "muted", children: "\u041D\u0430\u0432\u044B\u043A\u0438 \u043F\u043E\u043A\u0430 \u043D\u0435 \u0438\u0437\u0443\u0447\u0435\u043D\u044B" })) }), _jsx("div", { className: "character-skill-detail", children: selectedSkill ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: selectedSkill.name }), _jsx("p", { children: selectedSkill.description }), _jsx("p", { children: "Mana cost: variable" }), _jsx("p", { children: "Stamina cost: variable" }), _jsx("p", { children: "Cooldown: none" })] })) : (_jsx("p", { className: "muted", children: "Select a skill or state to inspect." })) })] })] })] })] }) }));
};
