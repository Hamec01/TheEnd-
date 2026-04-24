import { useEffect, useMemo, useState } from 'react';
import {
  CombatSkillType,
  EMPTY_EQUIPMENT,
  ITEMS,
  MERCHANTS,
  RACE_DEFINITIONS,
  STARTING_FREE_POINTS,
  applyAllocation,
  getMerchantItems,
  getAllocationCost,
  getItemById,
  type ItemDefinition,
  type Merchant,
  type ArenaBattleState,
  type Equipment,
  type InventoryState,
  type PrimaryStat,
  Race,
  type StatBlock,
  type StatAllocation,
} from '@theend/rpg-domain';
import {
  allocateStats,
  buyArenaItem,
  createCharacter,
  type CustomArenaNpcPayload,
  equipArenaItem,
  getArenaHubState,
  listCharacters,
  loginAccount,
  registerAccount,
  startCombat,
  startCustomCombat,
  sellArenaItem,
  unequipArenaItem,
  useCombatItem,
} from './api';
import type { ArenaCharacter } from './arena/types';
import { BattlePanel } from './battle/BattlePanel';
import { ArenaCanvas } from './arena/ArenaCanvas';
import { WorldMapScreen } from './worldmap/WorldMapScreen';
import { InventoryPanel } from './components/InventoryPanel';
import { MerchantPanel } from './components/MerchantPanel';

const RACES = [Race.Human, Race.Dwarf, Race.HighElf, Race.WoodElf] as const;
const PROFILE_STATS: PrimaryStat[] = [
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

const STAT_HINTS: Record<PrimaryStat, string> = {
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

type Phase = 'setup' | 'hub';
type OverlayPanel = 'stats' | 'inventory' | 'clan' | 'merchant' | 'skills' | 'arenaNpc' | 'arena' | null;
type MerchantMode = 'buy' | 'sell';
type EquipmentSlot = keyof Equipment;

interface SkillOffer {
  id: CombatSkillType;
  name: string;
  cost: number;
  resource: string;
  description: string;
}

interface HubStatePayload {
  character: ArenaCharacter;
  inventory: InventoryState;
  equipment: Equipment;
}

interface ArenaNpcTemplate {
  id: string;
  name: string;
  race: Race;
  stats: StatBlock;
  equipment: Equipment;
  enabled: boolean;
}

const EQUIPMENT_SLOT_ORDER: EquipmentSlot[] = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'shield'];

const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  helmet: 'Head',
  armor: 'Chest',
  gloves: 'Hands',
  boots: 'Legs',
  shield: 'Offhand',
};

const EQUIPMENT_SLOT_ITEM_TYPES: Record<EquipmentSlot, ItemDefinition['itemType']> = {
  weapon: 'weapon',
  helmet: 'helmet',
  armor: 'armor',
  gloves: 'gloves',
  boots: 'boots',
  shield: 'shield',
};

const DEFAULT_NPC_STATS: StatBlock = {
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

const SKILL_OFFERS: SkillOffer[] = [
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

const SKILL_NAMES: Record<CombatSkillType, string> = {
  [CombatSkillType.None]: 'Базовая атака',
  [CombatSkillType.PowerStrike]: 'Power Strike',
  [CombatSkillType.CrushingBlock]: 'Crushing Block',
  [CombatSkillType.Rage]: 'Rage',
  [CombatSkillType.Fireball]: 'Пламя Фелдана',
  [CombatSkillType.FrostLance]: 'Frost Lance',
  [CombatSkillType.ShieldBash]: 'Таран Арклейна',
  [CombatSkillType.Whirlwind]: 'Whirlwind',
};

const MERCHANT_TYPE_LABELS: Record<Merchant['merchantType'], string> = {
  weaponsmith: 'Оружие и дуэльные наборы',
  armorer: 'Доспехи и защитное снаряжение',
  supplier: 'Зелья, тоники и расходники',
};

const MERCHANT_TYPE_DESCRIPTIONS: Record<Merchant['merchantType'], string> = {
  weaponsmith: 'Собирает стойки для ближнего и дальнего боя. Лучший выбор, если нужен новый стиль боя прямо перед ареной.',
  armorer: 'Закрывает уязвимые слоты и помогает пережить лишний раунд за счёт защиты и полезных статовых прибавок.',
  supplier: 'Держит то, что спасает серию боёв: восстановление, бафы и быстрые расходники под конкретный матчап.',
};

function formatStatLines(stats: Partial<Record<PrimaryStat, number>>): string[] {
  return Object.entries(stats).map(([stat, value]) => `${stat}: ${value >= 0 ? '+' : ''}${value}`);
}

function formatSignedValue(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function titleCase(input: string): string {
  return input.length > 0 ? `${input[0].toUpperCase()}${input.slice(1)}` : input;
}

function getWeaponDamagePreview(item: ItemDefinition): string {
  const baseBySubtype: Record<string, { min: number; max: number }> = {
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

function getItemTooltipRows(item: ItemDefinition, quantity?: number, sellPrice?: number): string[] {
  const req = formatStatLines(item.requiredStats).join(', ') || 'none';
  const bonus = formatStatLines(item.bonuses).join(', ') || 'none';
  const rows: string[] = [
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

function getStatComparisonRows(
  candidateStats: Partial<Record<PrimaryStat, number>>,
  equippedStats: Partial<Record<PrimaryStat, number>>,
): Array<{ stat: PrimaryStat; candidateValue: number; equippedValue: number; delta: number }> {
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

function formatStatPreview(baseValue: number, activeValue: number, pendingPoints: number, stat: PrimaryStat): string {
  const pendingValue = pendingPoints * (['hp', 'mp', 'stamina'].includes(stat) ? 10 : 1);
  if (pendingValue > 0) {
    return `${baseValue} +${pendingValue} -> ${activeValue + pendingValue}`;
  }
  if (baseValue === activeValue) {
    return `${activeValue}`;
  }
  return `${baseValue} -> ${activeValue}`;
}

function createDefaultNpcTemplate(index: number): ArenaNpcTemplate {
  return {
    id: `arena-npc-${crypto.randomUUID()}`,
    name: `Arena NPC ${index}`,
    race: Race.Human,
    stats: { ...DEFAULT_NPC_STATS },
    equipment: { ...EMPTY_EQUIPMENT },
    enabled: true,
  };
}

function normalizeNpcRace(value: unknown): Race {
  if (Object.values(Race).includes(value as Race)) {
    return value as Race;
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

function toCustomNpcPayload(template: ArenaNpcTemplate): CustomArenaNpcPayload {
  return {
    name: template.name,
    race: template.race,
    stats: template.stats,
    equipment: template.equipment,
  };
}

export function App() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [overlayPanel, setOverlayPanel] = useState<OverlayPanel>(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [race, setRace] = useState<Race>(Race.Human);
  const [allocation, setAllocation] = useState<StatAllocation>({});

  const [status, setStatus] = useState('Create a fighter directly or use account login if needed.');

  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(MERCHANTS[0]?.id ?? 'merchant_weaponsmith');
  const [selectedMerchantItemId, setSelectedMerchantItemId] = useState<string | null>(null);
  const [selectedSellItemId, setSelectedSellItemId] = useState<string | null>(null);
  const [merchantMode, setMerchantMode] = useState<MerchantMode>('buy');
  const [sellOnlyAvailable, setSellOnlyAvailable] = useState(false);
  const [selectedCombatSkill, setSelectedCombatSkill] = useState<CombatSkillType>(CombatSkillType.None);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [npcTemplates, setNpcTemplates] = useState<ArenaNpcTemplate[]>([]);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);

  const [character, setCharacter] = useState<ArenaCharacter | null>(null);
  const [inventory, setInventory] = useState<InventoryState>({ gold: 0, items: [] });
  const [equipment, setEquipment] = useState<Equipment>({
    weapon: null,
    helmet: null,
    armor: null,
    boots: null,
    gloves: null,
    shield: null,
  });

  const [combatId, setCombatId] = useState<string | null>(null);
  const [playerCombatId, setPlayerCombatId] = useState<string | null>(null);
  const [combatState, setCombatState] = useState<ArenaBattleState | null>(null);
  const [isBattleWindowOpen, setBattleWindowOpen] = useState(false);
  const [learnedSkills, setLearnedSkills] = useState<CombatSkillType[]>([]);

  const [pendingStatAllocation, setPendingStatAllocation] = useState<StatAllocation>({});
  const [allocatingStats, setAllocatingStats] = useState(false);

  // Drag-drop and trade modal states
  const [draggedItem, setDraggedItem] = useState<ItemDefinition | null>(null);
  const [dragSource, setDragSource] = useState<'inventory' | 'merchant' | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');
  const [tradeItem, setTradeItem] = useState<ItemDefinition | null>(null);

  const raceDef = RACE_DEFINITIONS[race];
  const remaining = STARTING_FREE_POINTS - getAllocationCost(allocation);
  const selectedMerchant = useMemo<Merchant | null>(
    () => MERCHANTS.find((merchant) => merchant.id === selectedMerchantId) ?? null,
    [selectedMerchantId],
  );
  const merchantItems = useMemo<ItemDefinition[]>(
    () => (selectedMerchant ? getMerchantItems(selectedMerchant.id) : []),
    [selectedMerchant],
  );
  const selectedMerchantItem = useMemo<ItemDefinition | null>(
    () => merchantItems.find((item) => item.id === selectedMerchantItemId) ?? merchantItems[0] ?? null,
    [merchantItems, selectedMerchantItemId],
  );
  const equippedItemIds = useMemo(
    () => new Set((Object.values(equipment).filter((itemId): itemId is string => Boolean(itemId)))),
    [equipment],
  );
  const equippedSlotByItemId = useMemo(() => {
    const entries = (Object.entries(equipment) as Array<[EquipmentSlot, string | null]>).flatMap(([slot, itemId]) =>
      itemId ? [[itemId, slot] as [string, EquipmentSlot]] : [],
    );
    return new Map<string, EquipmentSlot>(entries);
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
  const visibleSellEntries = useMemo(
    () => (sellOnlyAvailable ? sellEntries.filter((entry) => !entry.sellLocked) : sellEntries),
    [sellEntries, sellOnlyAvailable],
  );
  const selectedSellEntry = useMemo(
    () => visibleSellEntries.find((entry) => entry.item.id === selectedSellItemId) ?? visibleSellEntries[0] ?? null,
    [selectedSellItemId, visibleSellEntries],
  );
  const selectedMerchantEquippedItem = useMemo(() => {
    if (!selectedMerchantItem || selectedMerchantItem.itemType === 'consumable') {
      return null;
    }

    const slot = selectedMerchantItem.itemType as EquipmentSlot;
    const equippedId = equipment[slot] ?? null;
    return equippedId ? getItemById(equippedId) : null;
  }, [equipment, selectedMerchantItem]);
  const selectedMerchantOwnedCount = useMemo(
    () => (selectedMerchantItem ? inventory.items.find((entry) => entry.itemId === selectedMerchantItem.id)?.quantity ?? 0 : 0),
    [inventory.items, selectedMerchantItem],
  );
  const selectedMerchantCompareRows = useMemo(
    () => (selectedMerchantItem && selectedMerchantItem.itemType !== 'consumable'
      ? getStatComparisonRows(selectedMerchantItem.bonuses, selectedMerchantEquippedItem?.bonuses ?? {})
      : []),
    [selectedMerchantEquippedItem, selectedMerchantItem],
  );
  const selectedInventoryEntry = useMemo(
    () => inventoryEntries.find((entry) => entry.itemId === selectedInventoryItemId) ?? inventoryEntries[0] ?? null,
    [inventoryEntries, selectedInventoryItemId],
  );
  const selectedNpcTemplate = useMemo(
    () => npcTemplates.find((npc) => npc.id === selectedNpcId) ?? npcTemplates[0] ?? null,
    [npcTemplates, selectedNpcId],
  );
  const activeArenaNpcs = useMemo(
    () => npcTemplates.filter((npc) => npc.enabled),
    [npcTemplates],
  );

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
      const parsed = JSON.parse(saved) as CombatSkillType[];
      setLearnedSkills(parsed.filter((skill) => skill !== CombatSkillType.None));
    } catch {
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
      const parsed = JSON.parse(saved) as ArenaNpcTemplate[];
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
    } catch {
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

  function applyHubState(hub: HubStatePayload): void {
    setCharacter(hub.character);
    setInventory(hub.inventory);
    setEquipment(hub.equipment);
  }

  async function onRegister(): Promise<void> {
    setStatus('Registering account...');
    try {
      const account = await registerAccount({ login, password });
      setAccountId(account.id);
      setStatus(`Account created for ${account.login}.`);
    } catch (error) {
      setStatus(`Registration error: ${(error as Error).message}`);
    }
  }

  async function onLogin(): Promise<void> {
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
    } catch (error) {
      setStatus(`Login error: ${(error as Error).message}`);
    }
  }

  async function onCreateCharacter(): Promise<void> {
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
    } catch (error) {
      setStatus(`Character creation error: ${(error as Error).message}`);
    }
  }

  async function handleEquip(itemId: string): Promise<void> {
    if (!character) {
      return;
    }

    try {
      const hub = await equipArenaItem(character.id, itemId);
      applyHubState(hub);
      setStatus(`Equipped ${getItemById(itemId).name}.`);
    } catch (error) {
      setStatus(`Equip error: ${(error as Error).message}`);
    }
  }

  async function handleUnequip(slot: 'weapon' | 'helmet' | 'armor' | 'boots' | 'gloves' | 'shield'): Promise<void> {
    if (!character) {
      return;
    }

    try {
      const hub = await unequipArenaItem(character.id, slot);
      applyHubState(hub);
      setStatus(`Снято из слота: ${slot}`);
    } catch (error) {
      setStatus(`Ошибка снятия: ${(error as Error).message}`);
    }
  }

  async function handleBuy(itemId: string): Promise<void> {
    if (!character) {
      return;
    }

    try {
      const hub = await buyArenaItem(character.id, itemId);
      applyHubState(hub);
      setStatus(`Куплено: ${getItemById(itemId).name}`);
    } catch (error) {
      const item = getItemById(itemId);
      setStatus(`Ошибка покупки: ${(error as Error).message} У вас ${inventory.gold} золота, предмет стоит ${item.price}.`);
    }
  }

  async function handleBuyAndEquip(itemId: string): Promise<void> {
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
    } catch (error) {
      if (purchased) {
        setStatus(`Куплено ${item.name}, но экипировка не удалась: ${(error as Error).message}`);
        return;
      }

      setStatus(`Ошибка покупки: ${(error as Error).message} У вас ${inventory.gold} золота, предмет стоит ${item.price}.`);
    }
  }

  async function handleSell(itemId: string): Promise<void> {
    if (!character) {
      return;
    }

    try {
      const hub = await sellArenaItem(character.id, itemId, 1);
      applyHubState(hub);
      const item = getItemById(itemId);
      const sellPrice = Math.max(1, Math.floor(item.price * 0.6));
      setStatus(`Продано: ${item.name} (+${sellPrice} золота)`);
    } catch (error) {
      setStatus(`Ошибка продажи: ${(error as Error).message}`);
    }
  }

  function openMerchantOverlay(merchantId = 'merchant_weaponsmith'): void {
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

  function openSkillsOverlay(): void {
    setOverlayPanel('skills');
    setStatus('Открыт учитель навыков.');
  }

  function openArenaOverlay(): void {
    setOverlayPanel('arena');
    setStatus('Открыт зал арены. Здесь можно настроить NPC и начать бой.');
  }

  function openArenaNpcOverlay(): void {
    setOverlayPanel('arenaNpc');
    setStatus('Открыт редактор arena NPC. Здесь можно собрать бойцов для арены и выдать им вещи.');
  }

  function updateNpcTemplate(npcId: string, updater: (current: ArenaNpcTemplate) => ArenaNpcTemplate): void {
    setNpcTemplates((current) => current.map((npc) => (npc.id === npcId ? updater(npc) : npc)));
  }

  function addNpcTemplate(): void {
    setNpcTemplates((current) => {
      const nextNpc = createDefaultNpcTemplate(current.length + 1);
      setSelectedNpcId(nextNpc.id);
      return [...current, nextNpc];
    });
  }

  function removeNpcTemplate(npcId: string): void {
    setNpcTemplates((current) => current.filter((npc) => npc.id !== npcId));
  }

  function handleBuySkill(skillId: CombatSkillType): void {
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

  async function openCombat(): Promise<void> {
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
    } catch (error) {
      setStatus(`Battle error: ${(error as Error).message}`);
    }
  }

  async function applyStatAllocation(): Promise<void> {
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
    } catch (error) {
      setStatus(`Allocation error: ${(error as Error).message}`);
    } finally {
      setAllocatingStats(false);
    }
  }

  async function handleUseConsumable(itemId: string): Promise<void> {
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
    } catch (error) {
      setStatus(`Consumable error: ${(error as Error).message}`);
    }
  }

  function adjustPendingStat(stat: PrimaryStat, delta: number): void {
    const current = pendingStatAllocation[stat] ?? 0;
    const nextValue = current + delta;

    if (nextValue < 0) {
      return;
    }

    const next = { ...pendingStatAllocation };
    if (nextValue === 0) {
      delete next[stat];
    } else {
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
    return (
      <div className="page">
        <main className="shell setup-shell">
          <section className="card compact-hero setup-hero-card">
            <div className="setup-hero-copy">
              <p className="eyebrow">TheEnd RPG</p>
              <h1>Quick start</h1>
              <p className="muted setup-hero-text">Создайте персонажа и сразу входите в мир. Аккаунт можно подключить позже, если он вам вообще нужен.</p>
            </div>
            <div className="setup-hero-side">
              <div className="level-pill">{remaining} pts</div>
              <p className="muted">Свободные стартовые очки готовы к распределению позже в игре.</p>
            </div>
          </section>

          <section className="setup-grid">
            <section className="card setup-panel setup-panel-secondary">
              <h2>Account (optional)</h2>
              <p className="muted setup-panel-copy">Если хотите сохранять персонажей под логином, используйте этот блок. Для быстрого старта он не нужен.</p>
              <div className="row">
                <label>Login</label>
                <input value={login} onChange={(event) => setLogin(event.target.value)} />
              </div>
              <div className="row">
                <label>Password</label>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
              <div className="hud-actions setup-actions-row">
                <button onClick={onRegister}>Register</button>
                <button onClick={onLogin}>Login</button>
              </div>
            </section>

            <section className="card setup-panel setup-panel-primary">
              <h2>Character</h2>
              <p className="muted setup-panel-copy">Имя и раса обязательны. После этого можно сразу зайти в хаб и продолжить уже внутри игры.</p>
              <div className="row">
                <label>Name</label>
                <input value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="row">
                <label>Race</label>
                <select value={race} onChange={(event) => setRace(event.target.value as Race)}>
                  {RACES.map((option) => (
                    <option key={option} value={option}>
                      {RACE_DEFINITIONS[option].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="inner-card setup-race-note">
                <strong>{RACE_DEFINITIONS[race].label}</strong>
                <p>{RACE_DEFINITIONS[race].description}</p>
              </div>
              <button className="setup-enter-button" onClick={onCreateCharacter} disabled={name.trim().length < 3}>
                Enter Hub
              </button>
            </section>
          </section>

          <section className="card status-card setup-status-card">
            <h2>Status</h2>
            <p>{status}</p>
          </section>
        </main>
      </div>
    );
  }

  if (!character) {
    return null;
  }

  const freePointsLeft = character.freePoints - getAllocationCost(pendingStatAllocation);

  return (
    <div className="page">
      <main className="shell game-shell world-shell">
        <WorldMapScreen
          character={character}
          inventory={inventory}
          equipment={equipment}
          battleStats={{
            hp: battlePlayer?.currentHp ?? character.activeStats.hp,
            mp: battlePlayer?.currentMp ?? character.activeStats.mp,
            stamina: battlePlayer?.currentStamina ?? character.activeStats.stamina,
          }}
          chatLines={chatLines}
          onOpenStats={() => setOverlayPanel('stats')}
          onOpenInventory={() => {
            setOverlayPanel('inventory');
            setStatus('Открыт инвентарь: здесь можно надеть и снять экипировку.');
          }}
          onOpenClan={() => setOverlayPanel('clan')}
          onExit={() => setExitDialogOpen(true)}
          onOpenArena={openArenaOverlay}
          onOpenMerchant={() => openMerchantOverlay()}
          onOpenArenaNpc={openArenaNpcOverlay}
          onOpenSkills={openSkillsOverlay}
          onStartCombat={openCombat}
          onStatus={setStatus}
        />

        {overlayPanel === 'stats' ? (
          <div className="battle-overlay" role="dialog" aria-modal="true">
            <section className="card battle-window wm-modal">
              <div className="battle-window-head">
                <h2>Stats</h2>
                <button onClick={() => setOverlayPanel(null)}>✕</button>
              </div>
              <p className="muted">Free points: {freePointsLeft}</p>
              <div className="wm-stat-list">
                {PROFILE_STATS.map((stat) => (
                  <div key={stat} className="wm-stat-row">
                    <div>
                      <strong>{STAT_LABELS[stat]}</strong>
                      <p className="wm-stat-hint">{STAT_HINTS[stat]}</p>
                    </div>
                    <span>{formatStatPreview(character.baseStats[stat], character.activeStats[stat], pendingStatAllocation[stat] ?? 0, stat)}</span>
                    <div className="mini-stepper">
                      <button disabled={freePointsLeft <= 0} onClick={() => adjustPendingStat(stat, 1)}>+</button>
                      <button disabled={(pendingStatAllocation[stat] ?? 0) <= 0} onClick={() => adjustPendingStat(stat, -1)}>-</button>
                    </div>
                  </div>
                ))}
              </div>
              <button disabled={allocatingStats || Object.keys(pendingStatAllocation).length === 0} onClick={applyStatAllocation}>
                {allocatingStats ? 'Applying...' : 'Apply'}
              </button>
            </section>
          </div>
        ) : null}

        {overlayPanel === 'arena' ? (
          <div className="battle-overlay" role="dialog" aria-modal="true">
            <section className="card battle-window wm-modal arena-modal-window">
              <div className="battle-window-head">
                <h2>Арена Арклейна</h2>
                <button onClick={() => setOverlayPanel(null)}>✕</button>
              </div>
              <p className="muted">Здесь только арена: настройте состав NPC и запускайте бой. Торговцы и учитель навыков находятся в городе.</p>
              <div className="arena-canvas-shell arena-modal-canvas">
                <ArenaCanvas />
              </div>
              <div className="profile-actions">
                <button onClick={openArenaNpcOverlay}>Настроить NPC</button>
                <button onClick={() => { void openCombat(); }}>Начать бой</button>
              </div>
            </section>
          </div>
        ) : null}

        {overlayPanel === 'inventory' && character ? (
          <InventoryPanel
            character={character}
            inventory={inventory}
            equipment={equipment}
            onClose={() => setOverlayPanel(null)}
            onEquipItem={async (itemId) => {
              await handleEquip(itemId);
            }}
            onUnequipSlot={async (slot) => {
              await handleUnequip(slot);
            }}
          />
        ) : null}

        {overlayPanel === 'arenaNpc' ? (
          <div className="battle-overlay" role="dialog" aria-modal="true">
            <section className="card battle-window wm-modal">
              <div className="battle-window-head">
                <h2>Arena NPC</h2>
                <button onClick={() => setOverlayPanel(null)}>✕</button>
              </div>
              <p className="muted">Создавайте бойцов для арены, выдавайте им вещи и помечайте тех, кто пойдёт в следующий бой.</p>

              <div className="npc-editor-layout">
                <section className="inner-card npc-editor-list">
                  <div className="npc-editor-list-head">
                    <h3>Бойцы</h3>
                    <button onClick={addNpcTemplate}>Добавить NPC</button>
                  </div>
                  <div className="inventory-list tall-list">
                    {npcTemplates.map((npc) => (
                      <button
                        key={npc.id}
                        className={`inventory-card ${selectedNpcTemplate?.id === npc.id ? 'is-active' : ''}`}
                        onClick={() => setSelectedNpcId(npc.id)}
                      >
                        <div>
                          <strong>{npc.name}</strong>
                          <p className="muted">{RACE_DEFINITIONS[npc.race].label}</p>
                        </div>
                        <span className={`inventory-badge ${npc.enabled ? 'enabled' : 'disabled'}`}>
                          {npc.enabled ? 'Arena ON' : 'Arena OFF'}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="inner-card npc-editor-detail">
                  {selectedNpcTemplate ? (
                    <>
                      <div className="npc-editor-topbar">
                        <h3>Редактор NPC</h3>
                        <button onClick={() => removeNpcTemplate(selectedNpcTemplate.id)} disabled={npcTemplates.length <= 1}>Удалить</button>
                      </div>

                      <div className="row">
                        <label>Name</label>
                        <input
                          value={selectedNpcTemplate.name}
                          onChange={(event) => updateNpcTemplate(selectedNpcTemplate.id, (current) => ({
                            ...current,
                            name: event.target.value,
                          }))}
                        />
                      </div>
                      <div className="row">
                        <label>Race</label>
                        <select
                          value={selectedNpcTemplate.race}
                          onChange={(event) => updateNpcTemplate(selectedNpcTemplate.id, (current) => ({
                            ...current,
                            race: event.target.value as Race,
                          }))}
                        >
                          {RACES.map((option) => (
                            <option key={option} value={option}>{RACE_DEFINITIONS[option].label}</option>
                          ))}
                        </select>
                      </div>
                      <label className="shop-filter-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedNpcTemplate.enabled}
                          onChange={(event) => updateNpcTemplate(selectedNpcTemplate.id, (current) => ({
                            ...current,
                            enabled: event.target.checked,
                          }))}
                        />
                        Использовать этого NPC на арене
                      </label>

                      <div className="npc-stat-grid">
                        {PROFILE_STATS.map((stat) => (
                          <div key={stat} className="npc-stat-field">
                            <label>{STAT_LABELS[stat]}</label>
                            <input
                              type="number"
                              min={stat === 'mp' ? 0 : 1}
                              value={selectedNpcTemplate.stats[stat]}
                              onChange={(event) => updateNpcTemplate(selectedNpcTemplate.id, (current) => ({
                                ...current,
                                stats: {
                                  ...current.stats,
                                  [stat]: Math.max(stat === 'mp' ? 0 : 1, Number(event.target.value) || 0),
                                },
                              }))}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="npc-equipment-grid">
                        {EQUIPMENT_SLOT_ORDER.map((slot) => {
                          const options = Object.values(ITEMS).filter((item) => item.itemType === EQUIPMENT_SLOT_ITEM_TYPES[slot]);
                          return (
                            <div key={slot} className="npc-equipment-field">
                              <label>{EQUIPMENT_SLOT_LABELS[slot]}</label>
                              <select
                                value={selectedNpcTemplate.equipment[slot] ?? ''}
                                onChange={(event) => updateNpcTemplate(selectedNpcTemplate.id, (current) => ({
                                  ...current,
                                  equipment: {
                                    ...current.equipment,
                                    [slot]: event.target.value || null,
                                  },
                                }))}
                              >
                                <option value="">Пусто</option>
                                {options.map((item) => (
                                  <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="muted">Добавьте NPC, чтобы открыть редактор.</p>
                  )}
                </section>
              </div>

              <p className="muted">Активных NPC для арены: {activeArenaNpcs.length}. Кнопка «Начать бой» в арене запустит бой именно с ними.</p>
            </section>
          </div>
        ) : null}

        {overlayPanel === 'skills' ? (
          <div className="battle-overlay" role="dialog" aria-modal="true">
            <section className="card battle-window wm-modal">
              <div className="battle-window-head">
                <h2>Учитель навыков</h2>
                <button onClick={() => setOverlayPanel(null)}>✕</button>
              </div>
              <p className="gold" style={{ display: 'inline-flex', marginBottom: '10px' }}>🪙 {inventory.gold}</p>

              <div className="profile-grid">
                <section className="inner-card full-width-skills">
                  <h3>Навыки учителя</h3>
                  <p className="muted">Купленный навык сразу доступен в бою. Магические навыки сейчас работают с штрафом 50% к силе.</p>
                  {SKILL_OFFERS.map((skill) => {
                    const learned = learnedSkills.includes(skill.id);
                    return (
                      <div key={skill.id} className={`skill-entry ${learned ? 'is-selected' : ''}`}>
                        <div>
                          <strong>{skill.name}</strong>
                          <p className="muted">{skill.resource}. {skill.description}</p>
                          <p className="muted">Цена обучения: {skill.cost} золота</p>
                        </div>
                        <div className="skill-entry-actions">
                          {learned ? (
                            <span className="inventory-badge enabled">Изучен</span>
                          ) : (
                            <button onClick={() => handleBuySkill(skill.id)}>Купить</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </section>
              </div>

              <div className="profile-actions">
                <p className="muted">Купленные навыки автоматически появляются в бою в селекторе Skill.</p>
                <p className="muted">В раунде можно выбрать обычную атаку или любой изученный навык.</p>
              </div>
            </section>
          </div>
        ) : null}

        {overlayPanel === 'clan' ? (
          <div className="battle-overlay" role="dialog" aria-modal="true">
            <section className="card battle-window wm-modal">
              <div className="battle-window-head">
                <h2>Clan</h2>
                <button onClick={() => setOverlayPanel(null)}>✕</button>
              </div>
              <p>Clan membership: none</p>
              <p className="muted">Feature coming later: members, invites, wars, storage.</p>
            </section>
          </div>
        ) : null}

        {overlayPanel === 'merchant' && character && selectedMerchant ? (
          <MerchantPanel
            merchant={selectedMerchant}
            inventory={inventory}
            onClose={() => setOverlayPanel(null)}
            onBuyItem={async (itemId) => {
              try {
                const updated = await buyArenaItem(character.id, itemId);
                setInventory(updated.inventory);
                setStatus(`Bought ${getItemById(itemId)?.name || 'item'}`);
              } catch (err: any) {
                setStatus(`Failed to buy: ${err.message}`);
              }
            }}
            onSellItem={async (itemId) => {
              try {
                const updated = await sellArenaItem(character.id, itemId);
                setInventory(updated.inventory);
                setStatus(`Sold ${getItemById(itemId)?.name || 'item'}`);
              } catch (err: any) {
                setStatus(`Failed to sell: ${err.message}`);
              }
            }}
          />
        ) : null}

        {exitDialogOpen ? (
          <div className="battle-overlay" role="dialog" aria-modal="true">
            <section className="card wm-exit-dialog">
              <h2>Exit?</h2>
              <p>Choose what to do:</p>
              <div className="wm-exit-actions">
                <button onClick={() => { setOverlayPanel(null); setExitDialogOpen(false); setPhase('setup'); }}>Return to main menu</button>
                <button onClick={() => { setOverlayPanel(null); setExitDialogOpen(false); setPhase('setup'); }}>Log out</button>
                <button onClick={() => setExitDialogOpen(false)}>Cancel</button>
              </div>
            </section>
          </div>
        ) : null}

        {isBattleWindowOpen && combatState ? (
          <div className="battle-overlay" role="dialog" aria-modal="true">
            <section className="card battle-window">
              <div className="battle-window-head">
                <h2>Battle</h2>
                <button onClick={() => setBattleWindowOpen(false)}>✕</button>
              </div>
              <BattlePanel
                combatId={combatId!}
                playerId={playerCombatId!}
                state={combatState}
                selectedSkill={selectedCombatSkill}
                learnedSkills={learnedSkills}
                onSkillChange={setSelectedCombatSkill}
                onStateChange={setCombatState}
                onStatus={setStatus}
              />
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
