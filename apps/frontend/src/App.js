import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { CombatSkillType, EMPTY_EQUIPMENT, ITEMS, MERCHANTS, RACE_DEFINITIONS, STARTING_FREE_POINTS, getMerchantItems, getAllocationCost, getItemById, Race, } from '@theend/rpg-domain';
import { allocateStats, buyArenaItem, createCharacter, equipArenaItem, getArenaHubState, listCharacters, loginAccount, registerAccount, startCombat, startCustomCombat, sellArenaItem, unequipArenaItem, useCombatItem, } from './api';
import { BattlePanel } from './battle/BattlePanel';
import { ArenaCanvas } from './arena/ArenaCanvas';
import { WorldMapScreen } from './worldmap/WorldMapScreen';
import { InventoryPanel } from './components/InventoryPanel';
import { MerchantPanel } from './components/MerchantPanel';
const RACES = [Race.Human, Race.Dwarf, Race.HighElf, Race.WoodElf];
const PROFILE_STATS = [
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
const STAT_HINTS = {
    hp: '+10 HP/pt',
    mp: '+10 MP/pt',
    stamina: '+10 STA/pt',
    strength: 'Melee/penetration',
    constitution: 'Physical defense',
    dexterity: 'Dodge/ranged',
    intelligence: 'Magic power',
    luck: 'Crit/loot',
    perception: 'Accuracy/anti-dodge',
    willpower: 'Magic/control resist',
};
const EQUIPMENT_SLOT_ORDER = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'shield'];
const EQUIPMENT_SLOT_LABELS = {
    weapon: 'Weapon',
    helmet: 'Head',
    armor: 'Chest',
    gloves: 'Hands',
    boots: 'Legs',
    shield: 'Offhand',
};
const EQUIPMENT_SLOT_ITEM_TYPES = {
    weapon: 'weapon',
    helmet: 'helmet',
    armor: 'armor',
    gloves: 'gloves',
    boots: 'boots',
    shield: 'shield',
};
const DEFAULT_NPC_STATS = {
    hp: 110,
    mp: 20,
    stamina: 60,
    strength: 6,
    constitution: 6,
    dexterity: 6,
    intelligence: 4,
    luck: 4,
    perception: 5,
    willpower: 4,
};
const NPC_STORAGE_KEY = 'theend.arenaNpcTemplates';
const SKILL_OFFERS = [
    {
        id: CombatSkillType.Fireball,
        name: 'Пламя Фелдана',
        cost: 120,
        resource: 'MP 18',
        description: 'Огненный урон по одной цели: INT x1.8 (сейчас -50% для не-мага).',
    },
    {
        id: CombatSkillType.ShieldBash,
        name: 'Таран Арклейна',
        cost: 110,
        resource: 'Stamina 14',
        description: 'Удар щитом: урон CON x0.8, -16 STA цели и -35% ATK/DEF points на следующий раунд.',
    },
];
const SKILL_NAMES = {
    [CombatSkillType.None]: 'Базовая атака',
    [CombatSkillType.PowerStrike]: 'Power Strike',
    [CombatSkillType.CrushingBlock]: 'Crushing Block',
    [CombatSkillType.Rage]: 'Rage',
    [CombatSkillType.Fireball]: 'Пламя Фелдана',
    [CombatSkillType.FrostLance]: 'Frost Lance',
    [CombatSkillType.ShieldBash]: 'Таран Арклейна',
    [CombatSkillType.Whirlwind]: 'Whirlwind',
};
const MERCHANT_TYPE_LABELS = {
    weaponsmith: 'Оружие и дуэльные наборы',
    armorer: 'Доспехи и защитное снаряжение',
    supplier: 'Зелья, тоники и расходники',
};
const MERCHANT_TYPE_DESCRIPTIONS = {
    weaponsmith: 'Собирает стойки для ближнего и дальнего боя. Лучший выбор, если нужен новый стиль боя прямо перед ареной.',
    armorer: 'Закрывает уязвимые слоты и помогает пережить лишний раунд за счёт защиты и полезных статовых прибавок.',
    supplier: 'Держит то, что спасает серию боёв: восстановление, бафы и быстрые расходники под конкретный матчап.',
};
function formatStatLines(stats) {
    return Object.entries(stats).map(([stat, value]) => `${stat}: ${value >= 0 ? '+' : ''}${value}`);
}
function formatSignedValue(value) {
    return `${value >= 0 ? '+' : ''}${value}`;
}
function titleCase(input) {
    return input.length > 0 ? `${input[0].toUpperCase()}${input.slice(1)}` : input;
}
function getWeaponDamagePreview(item) {
    const baseBySubtype = {
        sword: { min: 18, max: 26 },
        axe: { min: 20, max: 30 },
        hammer: { min: 24, max: 34 },
        spear: { min: 19, max: 28 },
        bow: { min: 16, max: 24 },
        daggers: { min: 14, max: 20 },
        staff: { min: 17, max: 25 },
    };
    const base = baseBySubtype[item.itemSubType] ?? { min: 16, max: 24 };
    const str = item.bonuses.strength ?? 0;
    const dex = item.bonuses.dexterity ?? 0;
    const int = item.bonuses.intelligence ?? 0;
    const scaling = Math.max(0, str * 1.5 + dex + int * 1.3);
    return `${Math.round(base.min + scaling)}-${Math.round(base.max + scaling)}`;
}
function getItemTooltipRows(item, quantity, sellPrice) {
    const req = formatStatLines(item.requiredStats).join(', ') || 'none';
    const bonus = formatStatLines(item.bonuses).join(', ') || 'none';
    const rows = [
        `Type: ${titleCase(item.itemType)} / ${titleCase(item.itemSubType)}`,
        `Rarity: ${titleCase(item.rarity)}`,
        `Requirements: ${req}`,
        `Bonuses: ${bonus}`,
        `Buy price: ${item.price}g`,
    ];
    if (item.itemType === 'weapon') {
        rows.unshift(`Damage: ${getWeaponDamagePreview(item)}`);
    }
    if (item.itemType === 'consumable') {
        rows.unshift(`Effect: ${item.description}`);
    }
    if (typeof quantity === 'number') {
        rows.push(`In bag: x${quantity}`);
    }
    if (typeof sellPrice === 'number') {
        rows.push(`Sell price: ${sellPrice}g`);
    }
    return rows;
}
function getStatComparisonRows(candidateStats, equippedStats) {
    return PROFILE_STATS
        .map((stat) => {
        const candidateValue = candidateStats[stat] ?? 0;
        const equippedValue = equippedStats[stat] ?? 0;
        return {
            stat,
            candidateValue,
            equippedValue,
            delta: candidateValue - equippedValue,
        };
    })
        .filter((row) => row.candidateValue !== 0 || row.equippedValue !== 0);
}
function formatStatPreview(baseValue, activeValue, pendingPoints, stat) {
    const pendingValue = pendingPoints * (['hp', 'mp', 'stamina'].includes(stat) ? 10 : 1);
    if (pendingValue > 0) {
        return `${baseValue} +${pendingValue} -> ${activeValue + pendingValue}`;
    }
    if (baseValue === activeValue) {
        return `${activeValue}`;
    }
    return `${baseValue} -> ${activeValue}`;
}
function createDefaultNpcTemplate(index) {
    return {
        id: `arena-npc-${crypto.randomUUID()}`,
        name: `Arena NPC ${index}`,
        race: Race.Human,
        stats: { ...DEFAULT_NPC_STATS },
        equipment: { ...EMPTY_EQUIPMENT },
        enabled: true,
    };
}
function normalizeNpcRace(value) {
    if (Object.values(Race).includes(value)) {
        return value;
    }
    switch (value) {
        case 'Human':
            return Race.Human;
        case 'Dwarf':
            return Race.Dwarf;
        case 'HighElf':
            return Race.HighElf;
        case 'WoodElf':
            return Race.WoodElf;
        default:
            return Race.Human;
    }
}
function toCustomNpcPayload(template) {
    return {
        name: template.name,
        race: template.race,
        stats: template.stats,
        equipment: template.equipment,
    };
}
export function App() {
    const [phase, setPhase] = useState('setup');
    const [overlayPanel, setOverlayPanel] = useState(null);
    const [exitDialogOpen, setExitDialogOpen] = useState(false);
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [accountId, setAccountId] = useState(null);
    const [name, setName] = useState('');
    const [race, setRace] = useState(Race.Human);
    const [allocation, setAllocation] = useState({});
    const [status, setStatus] = useState('Create a fighter directly or use account login if needed.');
    const [selectedMerchantId, setSelectedMerchantId] = useState(MERCHANTS[0]?.id ?? 'merchant_weaponsmith');
    const [selectedMerchantItemId, setSelectedMerchantItemId] = useState(null);
    const [selectedSellItemId, setSelectedSellItemId] = useState(null);
    const [merchantMode, setMerchantMode] = useState('buy');
    const [sellOnlyAvailable, setSellOnlyAvailable] = useState(false);
    const [selectedCombatSkill, setSelectedCombatSkill] = useState(CombatSkillType.None);
    const [selectedInventoryItemId, setSelectedInventoryItemId] = useState(null);
    const [npcTemplates, setNpcTemplates] = useState([]);
    const [selectedNpcId, setSelectedNpcId] = useState(null);
    const [character, setCharacter] = useState(null);
    const [inventory, setInventory] = useState({ gold: 0, items: [] });
    const [equipment, setEquipment] = useState({
        weapon: null,
        helmet: null,
        armor: null,
        boots: null,
        gloves: null,
        shield: null,
    });
    const [combatId, setCombatId] = useState(null);
    const [playerCombatId, setPlayerCombatId] = useState(null);
    const [combatState, setCombatState] = useState(null);
    const [isBattleWindowOpen, setBattleWindowOpen] = useState(false);
    const [learnedSkills, setLearnedSkills] = useState([]);
    const [pendingStatAllocation, setPendingStatAllocation] = useState({});
    const [allocatingStats, setAllocatingStats] = useState(false);
    // Drag-drop and trade modal states
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragSource, setDragSource] = useState(null);
    const [tradeModalOpen, setTradeModalOpen] = useState(false);
    const [tradeAction, setTradeAction] = useState('buy');
    const [tradeItem, setTradeItem] = useState(null);
    const raceDef = RACE_DEFINITIONS[race];
    const remaining = STARTING_FREE_POINTS - getAllocationCost(allocation);
    const selectedMerchant = useMemo(() => MERCHANTS.find((merchant) => merchant.id === selectedMerchantId) ?? null, [selectedMerchantId]);
    const merchantItems = useMemo(() => (selectedMerchant ? getMerchantItems(selectedMerchant.id) : []), [selectedMerchant]);
    const selectedMerchantItem = useMemo(() => merchantItems.find((item) => item.id === selectedMerchantItemId) ?? merchantItems[0] ?? null, [merchantItems, selectedMerchantItemId]);
    const equippedItemIds = useMemo(() => new Set((Object.values(equipment).filter((itemId) => Boolean(itemId)))), [equipment]);
    const equippedSlotByItemId = useMemo(() => {
        const entries = Object.entries(equipment).flatMap(([slot, itemId]) => itemId ? [[itemId, slot]] : []);
        return new Map(entries);
    }, [equipment]);
    const inventoryEntries = useMemo(() => inventory.items.map((entry) => {
        const item = getItemById(entry.itemId);
        const equippedSlot = equippedSlotByItemId.get(entry.itemId) ?? null;
        return {
            ...entry,
            item,
            equippedSlot,
            isEquipped: Boolean(equippedSlot),
        };
    }), [equippedSlotByItemId, inventory.items]);
    const sellEntries = useMemo(() => {
        return inventory.items.map((entry) => {
            const item = getItemById(entry.itemId);
            const sellPrice = Math.max(1, Math.floor(item.price * 0.6));
            const sellLocked = equippedItemIds.has(entry.itemId) && entry.quantity <= 1;
            return {
                item,
                quantity: entry.quantity,
                sellPrice,
                sellLocked,
            };
        });
    }, [equippedItemIds, inventory.items]);
    const visibleSellEntries = useMemo(() => (sellOnlyAvailable ? sellEntries.filter((entry) => !entry.sellLocked) : sellEntries), [sellEntries, sellOnlyAvailable]);
    const selectedSellEntry = useMemo(() => visibleSellEntries.find((entry) => entry.item.id === selectedSellItemId) ?? visibleSellEntries[0] ?? null, [selectedSellItemId, visibleSellEntries]);
    const selectedMerchantEquippedItem = useMemo(() => {
        if (!selectedMerchantItem || selectedMerchantItem.itemType === 'consumable') {
            return null;
        }
        const slot = selectedMerchantItem.itemType;
        const equippedId = equipment[slot] ?? null;
        return equippedId ? getItemById(equippedId) : null;
    }, [equipment, selectedMerchantItem]);
    const selectedMerchantOwnedCount = useMemo(() => (selectedMerchantItem ? inventory.items.find((entry) => entry.itemId === selectedMerchantItem.id)?.quantity ?? 0 : 0), [inventory.items, selectedMerchantItem]);
    const selectedMerchantCompareRows = useMemo(() => (selectedMerchantItem && selectedMerchantItem.itemType !== 'consumable'
        ? getStatComparisonRows(selectedMerchantItem.bonuses, selectedMerchantEquippedItem?.bonuses ?? {})
        : []), [selectedMerchantEquippedItem, selectedMerchantItem]);
    const selectedInventoryEntry = useMemo(() => inventoryEntries.find((entry) => entry.itemId === selectedInventoryItemId) ?? inventoryEntries[0] ?? null, [inventoryEntries, selectedInventoryItemId]);
    const selectedNpcTemplate = useMemo(() => npcTemplates.find((npc) => npc.id === selectedNpcId) ?? npcTemplates[0] ?? null, [npcTemplates, selectedNpcId]);
    const activeArenaNpcs = useMemo(() => npcTemplates.filter((npc) => npc.enabled), [npcTemplates]);
    const battlePlayer = useMemo(() => {
        if (!combatState || !playerCombatId) {
            return null;
        }
        return combatState.entities.find((entity) => entity.id === playerCombatId) ?? null;
    }, [combatState, playerCombatId]);
    const chatLines = useMemo(() => {
        const logs = combatState?.logs?.slice(-7).map((entry) => entry.text) ?? [];
        return [status, ...logs].filter((line) => line.trim().length > 0).slice(-8);
    }, [status, combatState?.logs]);
    useEffect(() => {
        if (!character) {
            setLearnedSkills([]);
            return;
        }
        const saved = window.localStorage.getItem(`theend.learnedSkills.${character.id}`);
        if (!saved) {
            setLearnedSkills([]);
            return;
        }
        try {
            const parsed = JSON.parse(saved);
            setLearnedSkills(parsed.filter((skill) => skill !== CombatSkillType.None));
        }
        catch {
            setLearnedSkills([]);
        }
    }, [character?.id]);
    useEffect(() => {
        if (!character) {
            return;
        }
        window.localStorage.setItem(`theend.learnedSkills.${character.id}`, JSON.stringify(learnedSkills));
    }, [character, learnedSkills]);
    useEffect(() => {
        if (!selectedSellItemId && visibleSellEntries.length > 0) {
            setSelectedSellItemId(visibleSellEntries[0].item.id);
            return;
        }
        if (selectedSellItemId && !visibleSellEntries.some((entry) => entry.item.id === selectedSellItemId)) {
            setSelectedSellItemId(visibleSellEntries[0]?.item.id ?? null);
        }
    }, [selectedSellItemId, visibleSellEntries]);
    useEffect(() => {
        if (!selectedInventoryItemId && inventoryEntries.length > 0) {
            setSelectedInventoryItemId(inventoryEntries[0].itemId);
            return;
        }
        if (selectedInventoryItemId && !inventoryEntries.some((entry) => entry.itemId === selectedInventoryItemId)) {
            setSelectedInventoryItemId(inventoryEntries[0]?.itemId ?? null);
        }
    }, [inventoryEntries, selectedInventoryItemId]);
    useEffect(() => {
        const saved = window.localStorage.getItem(NPC_STORAGE_KEY);
        if (!saved) {
            const defaults = [createDefaultNpcTemplate(1)];
            setNpcTemplates(defaults);
            setSelectedNpcId(defaults[0].id);
            return;
        }
        try {
            const parsed = JSON.parse(saved);
            const normalized = parsed.length > 0
                ? parsed.map((npc, index) => ({
                    ...createDefaultNpcTemplate(index + 1),
                    ...npc,
                    race: normalizeNpcRace(npc.race),
                    equipment: {
                        ...EMPTY_EQUIPMENT,
                        ...(npc.equipment ?? {}),
                    },
                }))
                : [createDefaultNpcTemplate(1)];
            setNpcTemplates(normalized);
            setSelectedNpcId(normalized[0]?.id ?? null);
        }
        catch {
            const defaults = [createDefaultNpcTemplate(1)];
            setNpcTemplates(defaults);
            setSelectedNpcId(defaults[0].id);
        }
    }, []);
    useEffect(() => {
        if (npcTemplates.length === 0) {
            return;
        }
        window.localStorage.setItem(NPC_STORAGE_KEY, JSON.stringify(npcTemplates));
    }, [npcTemplates]);
    useEffect(() => {
        if (!selectedNpcId && npcTemplates.length > 0) {
            setSelectedNpcId(npcTemplates[0].id);
            return;
        }
        if (selectedNpcId && !npcTemplates.some((npc) => npc.id === selectedNpcId)) {
            setSelectedNpcId(npcTemplates[0]?.id ?? null);
        }
    }, [npcTemplates, selectedNpcId]);
    useEffect(() => {
        if (phase !== 'hub' || !character || !combatState) {
            return;
        }
        void getArenaHubState(character.id)
            .then((hub) => applyHubState(hub))
            .catch(() => {
            // Keep current UI state if sync fails.
        });
    }, [phase, character?.id, combatState?.roundNumber, combatState?.isFinished]);
    useEffect(() => {
        if (phase !== 'hub') {
            return;
        }
        const onBattleStart = () => {
            void openCombat();
        };
        const onNpcEditorOpen = () => {
            openArenaNpcOverlay();
        };
        window.addEventListener('arena:start-battle', onBattleStart);
        window.addEventListener('arena:npc-editor', onNpcEditorOpen);
        return () => {
            window.removeEventListener('arena:start-battle', onBattleStart);
            window.removeEventListener('arena:npc-editor', onNpcEditorOpen);
        };
    }, [phase, character?.id]);
    function applyHubState(hub) {
        setCharacter(hub.character);
        setInventory(hub.inventory);
        setEquipment(hub.equipment);
    }
    async function onRegister() {
        setStatus('Registering account...');
        try {
            const account = await registerAccount({ login, password });
            setAccountId(account.id);
            setStatus(`Account created for ${account.login}.`);
        }
        catch (error) {
            setStatus(`Registration error: ${error.message}`);
        }
    }
    async function onLogin() {
        setStatus('Signing in...');
        try {
            const account = await loginAccount({ login, password });
            setAccountId(account.id);
            const characters = await listCharacters(account.id);
            if (characters.length > 0) {
                const latestCharacter = characters[0];
                const hub = await getArenaHubState(latestCharacter.id);
                applyHubState(hub);
                setPhase('hub');
                setStatus(`Welcome back, ${account.login}.`);
                return;
            }
            setStatus(`Welcome, ${account.login}. Create your first character.`);
        }
        catch (error) {
            setStatus(`Login error: ${error.message}`);
        }
    }
    async function onCreateCharacter() {
        setStatus(accountId ? 'Creating character...' : 'Creating character without registration...');
        try {
            const saved = await createCharacter({
                name: name.trim(),
                race,
                allocation: {},
            }, accountId);
            const hub = await getArenaHubState(saved.id);
            applyHubState(hub);
            setPhase('hub');
            setStatus(`${saved.name} entered the hub.`);
        }
        catch (error) {
            setStatus(`Character creation error: ${error.message}`);
        }
    }
    async function handleEquip(itemId) {
        if (!character) {
            return;
        }
        try {
            const hub = await equipArenaItem(character.id, itemId);
            applyHubState(hub);
            setStatus(`Equipped ${getItemById(itemId).name}.`);
        }
        catch (error) {
            setStatus(`Equip error: ${error.message}`);
        }
    }
    async function handleUnequip(slot) {
        if (!character) {
            return;
        }
        try {
            const hub = await unequipArenaItem(character.id, slot);
            applyHubState(hub);
            setStatus(`Снято из слота: ${slot}`);
        }
        catch (error) {
            setStatus(`Ошибка снятия: ${error.message}`);
        }
    }
    async function handleBuy(itemId) {
        if (!character) {
            return;
        }
        try {
            const hub = await buyArenaItem(character.id, itemId);
            applyHubState(hub);
            setStatus(`Куплено: ${getItemById(itemId).name}`);
        }
        catch (error) {
            const item = getItemById(itemId);
            setStatus(`Ошибка покупки: ${error.message} У вас ${inventory.gold} золота, предмет стоит ${item.price}.`);
        }
    }
    async function handleBuyAndEquip(itemId) {
        if (!character) {
            return;
        }
        const item = getItemById(itemId);
        if (item.itemType === 'consumable') {
            await handleBuy(itemId);
            return;
        }
        let purchased = false;
        try {
            const boughtHub = await buyArenaItem(character.id, itemId);
            purchased = true;
            applyHubState(boughtHub);
            const equippedHub = await equipArenaItem(character.id, itemId);
            applyHubState(equippedHub);
            setStatus(`Куплено и экипировано: ${item.name}`);
        }
        catch (error) {
            if (purchased) {
                setStatus(`Куплено ${item.name}, но экипировка не удалась: ${error.message}`);
                return;
            }
            setStatus(`Ошибка покупки: ${error.message} У вас ${inventory.gold} золота, предмет стоит ${item.price}.`);
        }
    }
    async function handleSell(itemId) {
        if (!character) {
            return;
        }
        try {
            const hub = await sellArenaItem(character.id, itemId, 1);
            applyHubState(hub);
            const item = getItemById(itemId);
            const sellPrice = Math.max(1, Math.floor(item.price * 0.6));
            setStatus(`Продано: ${item.name} (+${sellPrice} золота)`);
        }
        catch (error) {
            setStatus(`Ошибка продажи: ${error.message}`);
        }
    }
    function openMerchantOverlay(merchantId = 'merchant_weaponsmith') {
        const merchant = MERCHANTS.find((item) => item.id === merchantId);
        if (!merchant) {
            return;
        }
        setSelectedMerchantId(merchant.id);
        const defaultItem = getMerchantItems(merchant.id)[0] ?? null;
        setSelectedMerchantItemId(defaultItem?.id ?? null);
        setMerchantMode('buy');
        setOverlayPanel('merchant');
        setStatus(`Открыт торговец: ${merchant.name}`);
    }
    function openSkillsOverlay() {
        setOverlayPanel('skills');
        setStatus('Открыт учитель навыков.');
    }
    function openArenaOverlay() {
        setOverlayPanel('arena');
        setStatus('Открыт зал арены. Здесь можно настроить NPC и начать бой.');
    }
    function openArenaNpcOverlay() {
        setOverlayPanel('arenaNpc');
        setStatus('Открыт редактор arena NPC. Здесь можно собрать бойцов для арены и выдать им вещи.');
    }
    function updateNpcTemplate(npcId, updater) {
        setNpcTemplates((current) => current.map((npc) => (npc.id === npcId ? updater(npc) : npc)));
    }
    function addNpcTemplate() {
        setNpcTemplates((current) => {
            const nextNpc = createDefaultNpcTemplate(current.length + 1);
            setSelectedNpcId(nextNpc.id);
            return [...current, nextNpc];
        });
    }
    function removeNpcTemplate(npcId) {
        setNpcTemplates((current) => current.filter((npc) => npc.id !== npcId));
    }
    function handleBuySkill(skillId) {
        const offer = SKILL_OFFERS.find((entry) => entry.id === skillId);
        if (!offer) {
            return;
        }
        if (learnedSkills.includes(skillId)) {
            setStatus(`Навык уже изучен: ${offer.name}`);
            return;
        }
        if (inventory.gold < offer.cost) {
            setStatus(`Недостаточно золота для навыка ${offer.name}.`);
            return;
        }
        setInventory((current) => ({
            ...current,
            gold: current.gold - offer.cost,
        }));
        setLearnedSkills((current) => [...current, skillId]);
        setStatus(`Изучен навык: ${offer.name}`);
    }
    async function openCombat() {
        if (!character) {
            return;
        }
        try {
            const started = activeArenaNpcs.length > 0
                ? await startCustomCombat(character.id, activeArenaNpcs.map(toCustomNpcPayload))
                : await startCombat(character.id, 1);
            setOverlayPanel(null);
            setCombatId(started.combatId);
            setPlayerCombatId(started.playerId);
            setCombatState(started.state);
            setBattleWindowOpen(true);
            setStatus(activeArenaNpcs.length > 0 ? `Battle started against ${activeArenaNpcs.length} arena NPC.` : 'Battle started.');
        }
        catch (error) {
            setStatus(`Battle error: ${error.message}`);
        }
    }
    async function applyStatAllocation() {
        if (!character || Object.keys(pendingStatAllocation).length === 0) {
            return;
        }
        setAllocatingStats(true);
        try {
            await allocateStats(character.id, pendingStatAllocation);
            const updatedHub = await getArenaHubState(character.id);
            applyHubState(updatedHub);
            setPendingStatAllocation({});
            setStatus('Points applied.');
        }
        catch (error) {
            setStatus(`Allocation error: ${error.message}`);
        }
        finally {
            setAllocatingStats(false);
        }
    }
    async function handleUseConsumable(itemId) {
        if (!combatId || !playerCombatId || !combatState || combatState.isFinished) {
            setStatus('Consumables can be used only during an active battle.');
            return;
        }
        try {
            const result = await useCombatItem({
                combatId,
                actorId: playerCombatId,
                itemId,
            });
            setCombatState(result.state);
            setInventory((prev) => ({
                ...prev,
                gold: result.gold,
                items: result.inventory,
            }));
            setStatus(`${getItemById(itemId).name} used.`);
        }
        catch (error) {
            setStatus(`Consumable error: ${error.message}`);
        }
    }
    function adjustPendingStat(stat, delta) {
        const current = pendingStatAllocation[stat] ?? 0;
        const nextValue = current + delta;
        if (nextValue < 0) {
            return;
        }
        const next = { ...pendingStatAllocation };
        if (nextValue === 0) {
            delete next[stat];
        }
        else {
            next[stat] = nextValue;
        }
        if (character) {
            const freePointsLeft = character.freePoints - getAllocationCost(next);
            if (freePointsLeft < 0) {
                return;
            }
        }
        setPendingStatAllocation(next);
    }
    if (phase === 'setup') {
        return (_jsx("div", { className: "page", children: _jsxs("main", { className: "shell setup-shell", children: [_jsxs("section", { className: "card compact-hero setup-hero-card", children: [_jsxs("div", { className: "setup-hero-copy", children: [_jsx("p", { className: "eyebrow", children: "TheEnd RPG" }), _jsx("h1", { children: "Quick start" }), _jsx("p", { className: "muted setup-hero-text", children: "\u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 \u0438 \u0441\u0440\u0430\u0437\u0443 \u0432\u0445\u043E\u0434\u0438\u0442\u0435 \u0432 \u043C\u0438\u0440. \u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u043C\u043E\u0436\u043D\u043E \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043F\u043E\u0437\u0436\u0435, \u0435\u0441\u043B\u0438 \u043E\u043D \u0432\u0430\u043C \u0432\u043E\u043E\u0431\u0449\u0435 \u043D\u0443\u0436\u0435\u043D." })] }), _jsxs("div", { className: "setup-hero-side", children: [_jsxs("div", { className: "level-pill", children: [remaining, " pts"] }), _jsx("p", { className: "muted", children: "\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u044B\u0435 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0435 \u043E\u0447\u043A\u0438 \u0433\u043E\u0442\u043E\u0432\u044B \u043A \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044E \u043F\u043E\u0437\u0436\u0435 \u0432 \u0438\u0433\u0440\u0435." })] })] }), _jsxs("section", { className: "setup-grid", children: [_jsxs("section", { className: "card setup-panel setup-panel-secondary", children: [_jsx("h2", { children: "Account (optional)" }), _jsx("p", { className: "muted setup-panel-copy", children: "\u0415\u0441\u043B\u0438 \u0445\u043E\u0442\u0438\u0442\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0442\u044C \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439 \u043F\u043E\u0434 \u043B\u043E\u0433\u0438\u043D\u043E\u043C, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u044D\u0442\u043E\u0442 \u0431\u043B\u043E\u043A. \u0414\u043B\u044F \u0431\u044B\u0441\u0442\u0440\u043E\u0433\u043E \u0441\u0442\u0430\u0440\u0442\u0430 \u043E\u043D \u043D\u0435 \u043D\u0443\u0436\u0435\u043D." }), _jsxs("div", { className: "row", children: [_jsx("label", { children: "Login" }), _jsx("input", { value: login, onChange: (event) => setLogin(event.target.value) })] }), _jsxs("div", { className: "row", children: [_jsx("label", { children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (event) => setPassword(event.target.value) })] }), _jsxs("div", { className: "hud-actions setup-actions-row", children: [_jsx("button", { onClick: onRegister, children: "Register" }), _jsx("button", { onClick: onLogin, children: "Login" })] })] }), _jsxs("section", { className: "card setup-panel setup-panel-primary", children: [_jsx("h2", { children: "Character" }), _jsx("p", { className: "muted setup-panel-copy", children: "\u0418\u043C\u044F \u0438 \u0440\u0430\u0441\u0430 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B. \u041F\u043E\u0441\u043B\u0435 \u044D\u0442\u043E\u0433\u043E \u043C\u043E\u0436\u043D\u043E \u0441\u0440\u0430\u0437\u0443 \u0437\u0430\u0439\u0442\u0438 \u0432 \u0445\u0430\u0431 \u0438 \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u0443\u0436\u0435 \u0432\u043D\u0443\u0442\u0440\u0438 \u0438\u0433\u0440\u044B." }), _jsxs("div", { className: "row", children: [_jsx("label", { children: "Name" }), _jsx("input", { value: name, onChange: (event) => setName(event.target.value) })] }), _jsxs("div", { className: "row", children: [_jsx("label", { children: "Race" }), _jsx("select", { value: race, onChange: (event) => setRace(event.target.value), children: RACES.map((option) => (_jsx("option", { value: option, children: RACE_DEFINITIONS[option].label }, option))) })] }), _jsxs("div", { className: "inner-card setup-race-note", children: [_jsx("strong", { children: RACE_DEFINITIONS[race].label }), _jsx("p", { children: RACE_DEFINITIONS[race].description })] }), _jsx("button", { className: "setup-enter-button", onClick: onCreateCharacter, disabled: name.trim().length < 3, children: "Enter Hub" })] })] }), _jsxs("section", { className: "card status-card setup-status-card", children: [_jsx("h2", { children: "Status" }), _jsx("p", { children: status })] })] }) }));
    }
    if (!character) {
        return null;
    }
    const freePointsLeft = character.freePoints - getAllocationCost(pendingStatAllocation);
    return (_jsx("div", { className: "page", children: _jsxs("main", { className: "shell game-shell world-shell", children: [_jsx(WorldMapScreen, { character: character, inventory: inventory, equipment: equipment, battleStats: {
                        hp: battlePlayer?.currentHp ?? character.activeStats.hp,
                        mp: battlePlayer?.currentMp ?? character.activeStats.mp,
                        stamina: battlePlayer?.currentStamina ?? character.activeStats.stamina,
                    }, chatLines: chatLines, onOpenStats: () => setOverlayPanel('stats'), onOpenInventory: () => {
                        setOverlayPanel('inventory');
                        setStatus('Открыт инвентарь: здесь можно надеть и снять экипировку.');
                    }, onOpenClan: () => setOverlayPanel('clan'), onExit: () => setExitDialogOpen(true), onOpenArena: openArenaOverlay, onOpenMerchant: () => openMerchantOverlay(), onOpenArenaNpc: openArenaNpcOverlay, onOpenSkills: openSkillsOverlay, onStartCombat: openCombat, onStatus: setStatus }), overlayPanel === 'stats' ? (_jsx("div", { className: "battle-overlay", role: "dialog", "aria-modal": "true", children: _jsxs("section", { className: "card battle-window wm-modal", children: [_jsxs("div", { className: "battle-window-head", children: [_jsx("h2", { children: "Stats" }), _jsx("button", { onClick: () => setOverlayPanel(null), children: "\u2715" })] }), _jsxs("p", { className: "muted", children: ["Free points: ", freePointsLeft] }), _jsx("div", { className: "wm-stat-list", children: PROFILE_STATS.map((stat) => (_jsxs("div", { className: "wm-stat-row", children: [_jsxs("div", { children: [_jsx("strong", { children: STAT_LABELS[stat] }), _jsx("p", { className: "wm-stat-hint", children: STAT_HINTS[stat] })] }), _jsx("span", { children: formatStatPreview(character.baseStats[stat], character.activeStats[stat], pendingStatAllocation[stat] ?? 0, stat) }), _jsxs("div", { className: "mini-stepper", children: [_jsx("button", { disabled: freePointsLeft <= 0, onClick: () => adjustPendingStat(stat, 1), children: "+" }), _jsx("button", { disabled: (pendingStatAllocation[stat] ?? 0) <= 0, onClick: () => adjustPendingStat(stat, -1), children: "-" })] })] }, stat))) }), _jsx("button", { disabled: allocatingStats || Object.keys(pendingStatAllocation).length === 0, onClick: applyStatAllocation, children: allocatingStats ? 'Applying...' : 'Apply' })] }) })) : null, overlayPanel === 'arena' ? (_jsx("div", { className: "battle-overlay", role: "dialog", "aria-modal": "true", children: _jsxs("section", { className: "card battle-window wm-modal arena-modal-window", children: [_jsxs("div", { className: "battle-window-head", children: [_jsx("h2", { children: "\u0410\u0440\u0435\u043D\u0430 \u0410\u0440\u043A\u043B\u0435\u0439\u043D\u0430" }), _jsx("button", { onClick: () => setOverlayPanel(null), children: "\u2715" })] }), _jsx("p", { className: "muted", children: "\u0417\u0434\u0435\u0441\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0430\u0440\u0435\u043D\u0430: \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 \u0441\u043E\u0441\u0442\u0430\u0432 NPC \u0438 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0439\u0442\u0435 \u0431\u043E\u0439. \u0422\u043E\u0440\u0433\u043E\u0432\u0446\u044B \u0438 \u0443\u0447\u0438\u0442\u0435\u043B\u044C \u043D\u0430\u0432\u044B\u043A\u043E\u0432 \u043D\u0430\u0445\u043E\u0434\u044F\u0442\u0441\u044F \u0432 \u0433\u043E\u0440\u043E\u0434\u0435." }), _jsx("div", { className: "arena-canvas-shell arena-modal-canvas", children: _jsx(ArenaCanvas, {}) }), _jsxs("div", { className: "profile-actions", children: [_jsx("button", { onClick: openArenaNpcOverlay, children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C NPC" }), _jsx("button", { onClick: () => { void openCombat(); }, children: "\u041D\u0430\u0447\u0430\u0442\u044C \u0431\u043E\u0439" })] })] }) })) : null, overlayPanel === 'inventory' && character ? (_jsx(InventoryPanel, { character: character, inventory: inventory, onClose: () => setOverlayPanel(null), onSellItem: async (itemId) => {
                        try {
                            const updated = await sellArenaItem(character.id, itemId);
                            setInventory(updated.inventory);
                            setStatus(`Sold ${getItemById(itemId)?.name || 'item'}`);
                        }
                        catch (err) {
                            setStatus(`Failed to sell: ${err.message}`);
                        }
                    } })) : null, overlayPanel === 'arenaNpc' ? (_jsx("div", { className: "battle-overlay", role: "dialog", "aria-modal": "true", children: _jsxs("section", { className: "card battle-window wm-modal", children: [_jsxs("div", { className: "battle-window-head", children: [_jsx("h2", { children: "Arena NPC" }), _jsx("button", { onClick: () => setOverlayPanel(null), children: "\u2715" })] }), _jsx("p", { className: "muted", children: "\u0421\u043E\u0437\u0434\u0430\u0432\u0430\u0439\u0442\u0435 \u0431\u043E\u0439\u0446\u043E\u0432 \u0434\u043B\u044F \u0430\u0440\u0435\u043D\u044B, \u0432\u044B\u0434\u0430\u0432\u0430\u0439\u0442\u0435 \u0438\u043C \u0432\u0435\u0449\u0438 \u0438 \u043F\u043E\u043C\u0435\u0447\u0430\u0439\u0442\u0435 \u0442\u0435\u0445, \u043A\u0442\u043E \u043F\u043E\u0439\u0434\u0451\u0442 \u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0431\u043E\u0439." }), _jsxs("div", { className: "npc-editor-layout", children: [_jsxs("section", { className: "inner-card npc-editor-list", children: [_jsxs("div", { className: "npc-editor-list-head", children: [_jsx("h3", { children: "\u0411\u043E\u0439\u0446\u044B" }), _jsx("button", { onClick: addNpcTemplate, children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C NPC" })] }), _jsx("div", { className: "inventory-list tall-list", children: npcTemplates.map((npc) => (_jsxs("button", { className: `inventory-card ${selectedNpcTemplate?.id === npc.id ? 'is-active' : ''}`, onClick: () => setSelectedNpcId(npc.id), children: [_jsxs("div", { children: [_jsx("strong", { children: npc.name }), _jsx("p", { className: "muted", children: RACE_DEFINITIONS[npc.race].label })] }), _jsx("span", { className: `inventory-badge ${npc.enabled ? 'enabled' : 'disabled'}`, children: npc.enabled ? 'Arena ON' : 'Arena OFF' })] }, npc.id))) })] }), _jsx("section", { className: "inner-card npc-editor-detail", children: selectedNpcTemplate ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "npc-editor-topbar", children: [_jsx("h3", { children: "\u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440 NPC" }), _jsx("button", { onClick: () => removeNpcTemplate(selectedNpcTemplate.id), disabled: npcTemplates.length <= 1, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] }), _jsxs("div", { className: "row", children: [_jsx("label", { children: "Name" }), _jsx("input", { value: selectedNpcTemplate.name, onChange: (event) => updateNpcTemplate(selectedNpcTemplate.id, (current) => ({
                                                                ...current,
                                                                name: event.target.value,
                                                            })) })] }), _jsxs("div", { className: "row", children: [_jsx("label", { children: "Race" }), _jsx("select", { value: selectedNpcTemplate.race, onChange: (event) => updateNpcTemplate(selectedNpcTemplate.id, (current) => ({
                                                                ...current,
                                                                race: event.target.value,
                                                            })), children: RACES.map((option) => (_jsx("option", { value: option, children: RACE_DEFINITIONS[option].label }, option))) })] }), _jsxs("label", { className: "shop-filter-checkbox", children: [_jsx("input", { type: "checkbox", checked: selectedNpcTemplate.enabled, onChange: (event) => updateNpcTemplate(selectedNpcTemplate.id, (current) => ({
                                                                ...current,
                                                                enabled: event.target.checked,
                                                            })) }), "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u044D\u0442\u043E\u0433\u043E NPC \u043D\u0430 \u0430\u0440\u0435\u043D\u0435"] }), _jsx("div", { className: "npc-stat-grid", children: PROFILE_STATS.map((stat) => (_jsxs("div", { className: "npc-stat-field", children: [_jsx("label", { children: STAT_LABELS[stat] }), _jsx("input", { type: "number", min: stat === 'mp' ? 0 : 1, value: selectedNpcTemplate.stats[stat], onChange: (event) => updateNpcTemplate(selectedNpcTemplate.id, (current) => ({
                                                                    ...current,
                                                                    stats: {
                                                                        ...current.stats,
                                                                        [stat]: Math.max(stat === 'mp' ? 0 : 1, Number(event.target.value) || 0),
                                                                    },
                                                                })) })] }, stat))) }), _jsx("div", { className: "npc-equipment-grid", children: EQUIPMENT_SLOT_ORDER.map((slot) => {
                                                        const options = Object.values(ITEMS).filter((item) => item.itemType === EQUIPMENT_SLOT_ITEM_TYPES[slot]);
                                                        return (_jsxs("div", { className: "npc-equipment-field", children: [_jsx("label", { children: EQUIPMENT_SLOT_LABELS[slot] }), _jsxs("select", { value: selectedNpcTemplate.equipment[slot] ?? '', onChange: (event) => updateNpcTemplate(selectedNpcTemplate.id, (current) => ({
                                                                        ...current,
                                                                        equipment: {
                                                                            ...current.equipment,
                                                                            [slot]: event.target.value || null,
                                                                        },
                                                                    })), children: [_jsx("option", { value: "", children: "\u041F\u0443\u0441\u0442\u043E" }), options.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] })] }, slot));
                                                    }) })] })) : (_jsx("p", { className: "muted", children: "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 NPC, \u0447\u0442\u043E\u0431\u044B \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440." })) })] }), _jsxs("p", { className: "muted", children: ["\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0445 NPC \u0434\u043B\u044F \u0430\u0440\u0435\u043D\u044B: ", activeArenaNpcs.length, ". \u041A\u043D\u043E\u043F\u043A\u0430 \u00AB\u041D\u0430\u0447\u0430\u0442\u044C \u0431\u043E\u0439\u00BB \u0432 \u0430\u0440\u0435\u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442 \u0431\u043E\u0439 \u0438\u043C\u0435\u043D\u043D\u043E \u0441 \u043D\u0438\u043C\u0438."] })] }) })) : null, overlayPanel === 'skills' ? (_jsx("div", { className: "battle-overlay", role: "dialog", "aria-modal": "true", children: _jsxs("section", { className: "card battle-window wm-modal", children: [_jsxs("div", { className: "battle-window-head", children: [_jsx("h2", { children: "\u0423\u0447\u0438\u0442\u0435\u043B\u044C \u043D\u0430\u0432\u044B\u043A\u043E\u0432" }), _jsx("button", { onClick: () => setOverlayPanel(null), children: "\u2715" })] }), _jsxs("p", { className: "gold", style: { display: 'inline-flex', marginBottom: '10px' }, children: ["\uD83E\uDE99 ", inventory.gold] }), _jsx("div", { className: "profile-grid", children: _jsxs("section", { className: "inner-card full-width-skills", children: [_jsx("h3", { children: "\u041D\u0430\u0432\u044B\u043A\u0438 \u0443\u0447\u0438\u0442\u0435\u043B\u044F" }), _jsx("p", { className: "muted", children: "\u041A\u0443\u043F\u043B\u0435\u043D\u043D\u044B\u0439 \u043D\u0430\u0432\u044B\u043A \u0441\u0440\u0430\u0437\u0443 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0432 \u0431\u043E\u044E. \u041C\u0430\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043D\u0430\u0432\u044B\u043A\u0438 \u0441\u0435\u0439\u0447\u0430\u0441 \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u0441 \u0448\u0442\u0440\u0430\u0444\u043E\u043C 50% \u043A \u0441\u0438\u043B\u0435." }), SKILL_OFFERS.map((skill) => {
                                            const learned = learnedSkills.includes(skill.id);
                                            return (_jsxs("div", { className: `skill-entry ${learned ? 'is-selected' : ''}`, children: [_jsxs("div", { children: [_jsx("strong", { children: skill.name }), _jsxs("p", { className: "muted", children: [skill.resource, ". ", skill.description] }), _jsxs("p", { className: "muted", children: ["\u0426\u0435\u043D\u0430 \u043E\u0431\u0443\u0447\u0435\u043D\u0438\u044F: ", skill.cost, " \u0437\u043E\u043B\u043E\u0442\u0430"] })] }), _jsx("div", { className: "skill-entry-actions", children: learned ? (_jsx("span", { className: "inventory-badge enabled", children: "\u0418\u0437\u0443\u0447\u0435\u043D" })) : (_jsx("button", { onClick: () => handleBuySkill(skill.id), children: "\u041A\u0443\u043F\u0438\u0442\u044C" })) })] }, skill.id));
                                        })] }) }), _jsxs("div", { className: "profile-actions", children: [_jsx("p", { className: "muted", children: "\u041A\u0443\u043F\u043B\u0435\u043D\u043D\u044B\u0435 \u043D\u0430\u0432\u044B\u043A\u0438 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u043E\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0432 \u0431\u043E\u044E \u0432 \u0441\u0435\u043B\u0435\u043A\u0442\u043E\u0440\u0435 Skill." }), _jsx("p", { className: "muted", children: "\u0412 \u0440\u0430\u0443\u043D\u0434\u0435 \u043C\u043E\u0436\u043D\u043E \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043E\u0431\u044B\u0447\u043D\u0443\u044E \u0430\u0442\u0430\u043A\u0443 \u0438\u043B\u0438 \u043B\u044E\u0431\u043E\u0439 \u0438\u0437\u0443\u0447\u0435\u043D\u043D\u044B\u0439 \u043D\u0430\u0432\u044B\u043A." })] })] }) })) : null, overlayPanel === 'clan' ? (_jsx("div", { className: "battle-overlay", role: "dialog", "aria-modal": "true", children: _jsxs("section", { className: "card battle-window wm-modal", children: [_jsxs("div", { className: "battle-window-head", children: [_jsx("h2", { children: "Clan" }), _jsx("button", { onClick: () => setOverlayPanel(null), children: "\u2715" })] }), _jsx("p", { children: "Clan membership: none" }), _jsx("p", { className: "muted", children: "Feature coming later: members, invites, wars, storage." })] }) })) : null, overlayPanel === 'merchant' && character && selectedMerchant ? (_jsx(MerchantPanel, { merchant: selectedMerchant, inventory: inventory, onClose: () => setOverlayPanel(null), onBuyItem: async (itemId) => {
                        try {
                            const updated = await buyArenaItem(character.id, itemId);
                            setInventory(updated.inventory);
                            setStatus(`Bought ${getItemById(itemId)?.name || 'item'}`);
                        }
                        catch (err) {
                            setStatus(`Failed to buy: ${err.message}`);
                        }
                    }, onSellItem: async (itemId) => {
                        try {
                            const updated = await sellArenaItem(character.id, itemId);
                            setInventory(updated.inventory);
                            setStatus(`Sold ${getItemById(itemId)?.name || 'item'}`);
                        }
                        catch (err) {
                            setStatus(`Failed to sell: ${err.message}`);
                        }
                    } })) : null, exitDialogOpen ? (_jsx("div", { className: "battle-overlay", role: "dialog", "aria-modal": "true", children: _jsxs("section", { className: "card wm-exit-dialog", children: [_jsx("h2", { children: "Exit?" }), _jsx("p", { children: "Choose what to do:" }), _jsxs("div", { className: "wm-exit-actions", children: [_jsx("button", { onClick: () => { setOverlayPanel(null); setExitDialogOpen(false); setPhase('setup'); }, children: "Return to main menu" }), _jsx("button", { onClick: () => { setOverlayPanel(null); setExitDialogOpen(false); setPhase('setup'); }, children: "Log out" }), _jsx("button", { onClick: () => setExitDialogOpen(false), children: "Cancel" })] })] }) })) : null, isBattleWindowOpen && combatState ? (_jsx("div", { className: "battle-overlay", role: "dialog", "aria-modal": "true", children: _jsxs("section", { className: "card battle-window", children: [_jsxs("div", { className: "battle-window-head", children: [_jsx("h2", { children: "Battle" }), _jsx("button", { onClick: () => setBattleWindowOpen(false), children: "\u2715" })] }), _jsx(BattlePanel, { combatId: combatId, playerId: playerCombatId, state: combatState, selectedSkill: selectedCombatSkill, learnedSkills: learnedSkills, onSkillChange: setSelectedCombatSkill, onStateChange: setCombatState, onStatus: setStatus })] }) })) : null] }) }));
}
