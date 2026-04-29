import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CombatSkillType,
  EMPTY_EQUIPMENT,
  ITEMS,
  RACE_DEFINITIONS,
  TeamSide,
  applyAllocation,
  getItemHandsRequired,
  getAllocationCost,
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
  type ArenaHubState,
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
import { InventoryPanel, type CharacterPageFocus } from './components/InventoryPanel';
import { MerchantPanel } from './components/MerchantPanel';
import type { AdminItem, AdminMerchant, StoredImage } from './services/content/models';
import {
  HUMAN_ORIGINS,
  STARTING_ELEMENT_SKILLS,
  getCharacterCreationRaceConfig,
  getDefaultAvatarFor,
  getRandomStartingElements,
  type CharacterElement,
  type CharacterGender,
  type CharacterOrigin,
} from './config/characterCreation';
import type { PlayerPath } from './RootApp';
import { subscribeToContentSync } from './services/content/contentSync';
import {
  getRuntimeMerchantItems,
  getRuntimeMerchants,
  loadRuntimeAdminContent,
} from './services/content/runtimeContentService';
import { loadRuntimeImages, resolveItemImageSource, resolveMerchantImageSource } from './services/content/runtimeImageService';
import { getDomainItemWithFallback } from './services/content/seedService';
import { DEFAULT_BATTLE_MAP_ID, loadBattleMaps } from './services/battleMaps/battleMapStorage';
import { resolveBattleMapForCombat, toRuntimeBattleMapPayload } from './services/battleMaps/battleMapRuntime';
import { ensureDialoguesLoaded } from './services/dialogueRepository';
import { deleteNpc, ensureNpcsLoaded, getAllNpcs, saveNpc } from './services/npcRepository';
import { ensureQuestsLoaded } from './services/questRepository';
import { ensureQuestMarkersLoaded } from './services/questMapRepository';
import type { NpcDefinition, NpcRace } from './types/npc';

const RACES = [Race.Human, Race.WoodElf, Race.HighElf, Race.Dwarf] as const;
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
  mp: 'MP',
  stamina: 'Выносливость',
  strength: 'Сила',
  constitution: 'Телосложение',
  dexterity: 'Ловкость',
  intelligence: 'Интеллект',
  luck: 'Удача',
  perception: 'Восприятие',
  willpower: 'Сила воли',
};

const STAT_HINTS: Record<PrimaryStat, string> = {
  hp: 'Живучесть персонажа',
  mp: 'Ресурс магии',
  stamina: 'Ресурс боевых действий',
  strength: 'Физический урон',
  constitution: 'Выживаемость и защита',
  dexterity: 'Точность и уклонение',
  intelligence: 'Сила заклинаний',
  luck: 'Криты и удачные события',
  perception: 'Наблюдательность',
  willpower: 'Сопротивление магии/контролю',
};

interface CharacterCreationProfile {
  id: string;
  name: string;
  gender: CharacterGender;
  raceId: string;
  originId: string | null;
  avatarUrl: string;
  stats: StatBlock;
  elements: string[];
  skills: string[];
  traits: Record<string, number | boolean>;
}

type Phase = 'setup' | 'hub';
type SetupStep = 'account' | 'character';
type OverlayPanel = 'character' | 'stats' | 'inventory' | 'clan' | 'merchant' | 'skills' | 'arenaNpc' | 'arena' | null;
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
  avatarUrl?: string;
}

interface BattleStartSnapshot {
  level: number;
  exp: number;
  freePoints: number;
}

interface BattleSummary {
  title: string;
  expGained: number;
  goldGained: number;
  lootNames: string[];
  damageDealt: number;
  damageTaken: number;
  damageBlocked: number;
  levelBefore: number;
  levelAfter: number;
  freePointsAfter: number;
}

const ARENA_NPC_LOCATION_ID = 'arena:combat';
const DEFAULT_ARENA_NPC_DESCRIPTION = 'Arena combat NPC managed from the arena editor.';

const EQUIPMENT_SLOT_ORDER: EquipmentSlot[] = ['weapon', 'helmet', 'necklace', 'armor', 'outerwear', 'belt', 'gloves', 'shield', 'ring1', 'ring2', 'ring3', 'legs', 'boots'];

const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  helmet: 'Head',
  necklace: 'Necklace',
  armor: 'Chest',
  outerwear: 'Outerwear',
  belt: 'Belt',
  gloves: 'Hands',
  shield: 'Offhand',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  ring3: 'Ring 3',
  legs: 'Legs',
  boots: 'Boots',
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

const LAST_CHARACTER_STORAGE_KEY = 'theend.lastCharacterId';
const LAST_ACCOUNT_ID_STORAGE_KEY = 'theend.lastAccountId';
const LAST_ACCOUNT_LOGIN_STORAGE_KEY = 'theend.lastAccountLogin';
const PLAYER_AVATAR_STORAGE_PREFIX = 'theend.playerAvatarUrl';
const CHARACTER_PROFILE_STORAGE_PREFIX = 'theend.characterProfile';
const SELECTED_BATTLE_MAP_STORAGE_KEY = 'theend.selectedBattleMapId';

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

function normalizeCityName(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function isArkleinCity(value: string | null | undefined): boolean {
  const normalized = normalizeCityName(value);
  return normalized === 'арклейн' || normalized === 'arklein' || normalized === 'arclein';
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

function toNpcRace(race: Race): NpcRace {
  switch (race) {
    case Race.Dwarf:
      return 'dwarf';
    case Race.HighElf:
      return 'high_elf';
    case Race.WoodElf:
      return 'forest_elf';
    case Race.Human:
    default:
      return 'human';
  }
}

function toArenaRace(race: NpcRace | string | undefined): Race {
  switch (race) {
    case 'dwarf':
      return Race.Dwarf;
    case 'high_elf':
      return Race.HighElf;
    case 'forest_elf':
      return Race.WoodElf;
    case 'human':
    default:
      return Race.Human;
  }
}

function isArenaNpcDefinition(npc: NpcDefinition): boolean {
  return npc.locationId === ARENA_NPC_LOCATION_ID;
}

function buildArenaEquipmentFromNpc(
  npc: NpcDefinition,
  resolveItemById: (itemId: string) => ItemDefinition | null,
): Equipment {
  const equipment: Equipment = { ...EMPTY_EQUIPMENT };
  const armorIds = npc.combat?.armorItemIds ?? [];

  if (npc.combat?.weaponItemId) {
    equipment.weapon = npc.combat.weaponItemId;
  }

  for (const itemId of armorIds) {
    const item = resolveItemById(itemId);
    switch (item?.itemType) {
      case 'helmet':
        equipment.helmet = itemId;
        break;
      case 'armor':
        equipment.armor = itemId;
        break;
      case 'gloves':
        equipment.gloves = itemId;
        break;
      case 'boots':
        equipment.boots = itemId;
        break;
      case 'shield':
        equipment.shield = itemId;
        break;
      default:
        break;
    }
  }

  return equipment;
}

function toArenaNpcTemplate(
  npc: NpcDefinition,
  resolveItemById: (itemId: string) => ItemDefinition | null,
): ArenaNpcTemplate {
  return {
    id: npc.id,
    name: npc.name,
    race: toArenaRace(npc.race),
    stats: {
      hp: npc.combat?.hp ?? DEFAULT_NPC_STATS.hp,
      mp: npc.combat?.mana ?? DEFAULT_NPC_STATS.mp,
      stamina: npc.combat?.stamina ?? DEFAULT_NPC_STATS.stamina,
      strength: npc.combat?.strength ?? DEFAULT_NPC_STATS.strength,
      constitution: npc.combat?.endurance ?? DEFAULT_NPC_STATS.constitution,
      dexterity: npc.combat?.agility ?? DEFAULT_NPC_STATS.dexterity,
      intelligence: npc.combat?.intellect ?? DEFAULT_NPC_STATS.intelligence,
      luck: npc.combat?.luck ?? DEFAULT_NPC_STATS.luck,
      perception: npc.combat?.perception ?? DEFAULT_NPC_STATS.perception,
      willpower: npc.combat?.wisdom ?? DEFAULT_NPC_STATS.willpower,
    },
    equipment: buildArenaEquipmentFromNpc(npc, resolveItemById),
    enabled: npc.status === 'active' && npc.canFight !== false,
    avatarUrl: npc.portraitUrl ?? npc.combatImageUrl ?? npc.iconUrl ?? undefined,
  };
}

function deriveArenaNpcRole(
  template: ArenaNpcTemplate,
  resolveItemById: (itemId: string) => ItemDefinition | null,
): NonNullable<NonNullable<NpcDefinition['combat']>['role']> {
  const weaponId = template.equipment.weapon;
  const weapon = weaponId ? resolveItemById(weaponId) : null;
  const subtype = String(weapon?.itemSubType ?? '').toLowerCase();

  if (subtype.includes('bow') || subtype.includes('crossbow') || subtype.includes('sling') || subtype.includes('throw')) {
    return 'ranged';
  }

  if (subtype.includes('staff') || subtype.includes('wand') || subtype.includes('orb') || subtype.includes('tome')) {
    return 'mage';
  }

  return 'melee';
}

function toArenaNpcDefinition(
  template: ArenaNpcTemplate,
  resolveItemById: (itemId: string) => ItemDefinition | null,
  existing?: NpcDefinition | null,
): NpcDefinition {
  const now = new Date().toISOString();
  const armorItemIds = [template.equipment.helmet, template.equipment.armor, template.equipment.gloves, template.equipment.boots, template.equipment.shield]
    .filter((itemId): itemId is string => Boolean(itemId));
  const base = existing ?? {
    id: template.id,
    name: template.name,
    status: 'active' as const,
    kind: 'enemy' as const,
    race: toNpcRace(template.race),
    description: DEFAULT_ARENA_NPC_DESCRIPTION,
    mapBindings: [],
    defaultDisposition: 'hostile' as const,
    isUnique: true,
    canRespawn: true,
    canFight: true,
    canTalk: false,
    canTrade: false,
    canTrain: false,
    canGiveQuests: false,
    canBeKilled: true,
    dialogues: [],
    questBindings: [],
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...base,
    id: template.id,
    name: template.name.trim() || base.name || 'Arena NPC',
    status: template.enabled ? 'active' : 'disabled',
    kind: 'enemy',
    race: toNpcRace(template.race),
    locationId: ARENA_NPC_LOCATION_ID,
    description: base.description?.trim() || DEFAULT_ARENA_NPC_DESCRIPTION,
    portraitUrl: template.avatarUrl,
    combatImageUrl: template.avatarUrl,
    iconUrl: template.avatarUrl,
    defaultDisposition: 'hostile',
    isUnique: true,
    canRespawn: true,
    canFight: true,
    canTalk: false,
    canTrade: false,
    canTrain: false,
    canGiveQuests: false,
    canBeKilled: true,
    traderId: undefined,
    mapBindings: Array.isArray(base.mapBindings) ? base.mapBindings : [],
    dialogues: Array.isArray(base.dialogues) ? base.dialogues : [],
    questBindings: Array.isArray(base.questBindings) ? base.questBindings : [],
    inventory: base.inventory ?? { itemIds: [], questItemIds: [] },
    combat: {
      ...base.combat,
      level: Math.max(1, Math.round((template.stats.strength + template.stats.constitution + template.stats.dexterity + template.stats.perception) / 16)),
      role: deriveArenaNpcRole(template, resolveItemById),
      hp: template.stats.hp,
      mana: template.stats.mp,
      stamina: template.stats.stamina,
      strength: template.stats.strength,
      agility: template.stats.dexterity,
      endurance: template.stats.constitution,
      intellect: template.stats.intelligence,
      wisdom: template.stats.willpower,
      luck: template.stats.luck,
      perception: template.stats.perception,
      initiative: template.stats.perception + Math.floor(template.stats.dexterity * 0.5),
      weaponItemId: template.equipment.weapon ?? undefined,
      armorItemIds,
      skillIds: base.combat?.skillIds ?? [],
    },
    createdAt: base.createdAt || now,
    updatedAt: now,
  };
}

function buildBattleSummary(
  state: ArenaBattleState,
  playerId: string,
  started: BattleStartSnapshot | null,
  currentCharacter: ArenaCharacter,
): BattleSummary {
  let expGained = 0;
  let goldGained = 0;
  let damageDealt = 0;
  let damageTaken = 0;
  let damageBlocked = 0;
  const lootNames: string[] = [];

  for (const entry of state.logs) {
    if (entry.type === 'HIT') {
      if (entry.actorId === playerId) {
        damageDealt += Math.max(0, entry.amount ?? 0);
      }
      if (entry.targetId === playerId) {
        damageTaken += Math.max(0, entry.amount ?? 0);
      }
    }

    if (entry.type === 'BLOCK' && entry.actorId === playerId) {
      damageBlocked += Math.max(0, entry.amount ?? 0);
    }

    if (entry.type !== 'INFO' || entry.actorId !== playerId) {
      continue;
    }

    const expMatch = entry.text.match(/Battle reward:\s*\+(\d+)\s*EXP/i);
    if (expMatch) {
      expGained += Number(expMatch[1] ?? 0);
      continue;
    }

    const goldMatch = entry.text.match(/Battle reward:\s*\+(\d+)\s*gold/i);
    if (goldMatch) {
      goldGained += Number(goldMatch[1] ?? 0);
      continue;
    }

    const lootMatch = entry.text.match(/Battle reward:\s*loot\s+(.+)/i);
    if (lootMatch?.[1]) {
      lootNames.push(lootMatch[1].trim());
    }
  }

  const levelBefore = started?.level ?? currentCharacter.level;
  const title = state.winner === TeamSide.Left
    ? 'Победа'
    : state.winner === TeamSide.Right
      ? 'Поражение'
      : 'Бой завершён';

  return {
    title,
    expGained,
    goldGained,
    lootNames,
    damageDealt,
    damageTaken,
    damageBlocked,
    levelBefore,
    levelAfter: currentCharacter.level,
    freePointsAfter: currentCharacter.freePoints,
  };
}

function toCustomNpcPayload(template: ArenaNpcTemplate): CustomArenaNpcPayload {
  return {
    name: template.name,
    race: template.race,
    stats: template.stats,
    equipment: template.equipment,
    avatarUrl: template.avatarUrl,
  };
}

interface AppProps {
  currentPlayerRoute?: PlayerPath;
  onNavigate?: (path: PlayerPath, options?: { replace?: boolean }) => void;
}

function createUnknownItem(itemId: string): ItemDefinition {
  return {
    id: itemId,
    name: `Unknown item (${itemId})`,
    itemType: 'consumable',
    itemSubType: 'unknown',
    price: 0,
    requiredStats: {},
    bonuses: {},
    stackable: true,
    description: 'Item definition unavailable.',
    icon: 'unknown',
    rarity: 'common',
  };
}

function getPlayerRouteFromState(
  phase: Phase,
  overlayPanel: OverlayPanel,
  isBattleWindowOpen: boolean,
  combatRoutePending: boolean,
): PlayerPath {
  if (phase !== 'hub') {
    return '/';
  }

  if (isBattleWindowOpen || combatRoutePending) {
    return '/combat';
  }

  if (overlayPanel === 'merchant') {
    return '/merchant';
  }

  if (overlayPanel === 'character') {
    return '/inventory';
  }

  return '/map';
}

function getCharacterProfileStorageKey(characterId: string): string {
  return `${CHARACTER_PROFILE_STORAGE_PREFIX}.${characterId}`;
}

function saveCharacterProfile(profile: CharacterCreationProfile): void {
  window.localStorage.setItem(getCharacterProfileStorageKey(profile.id), JSON.stringify(profile));
}

function loadCharacterProfile(characterId: string): CharacterCreationProfile | null {
  const raw = window.localStorage.getItem(getCharacterProfileStorageKey(characterId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as CharacterCreationProfile;
  } catch {
    return null;
  }
}

export function App({ currentPlayerRoute = '/', onNavigate }: AppProps) {
  const pendingRouteSyncRef = useRef<{ from: PlayerPath; to: PlayerPath } | null>(null);
  const runtimeContentRefreshRef = useRef<Promise<void> | null>(null);
  const lastRuntimeContentRefreshAtRef = useRef(0);
  const battleStartSnapshotRef = useRef<BattleStartSnapshot | null>(null);
  const arenaNpcInitializedRef = useRef(false);
  const arenaNpcSyncedIdsRef = useRef<Set<string>>(new Set());
  const arenaNpcSkipNextSyncRef = useRef(false);
  const arenaNpcSyncTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<Phase>('setup');
  const [setupStep, setSetupStep] = useState<SetupStep>('account');
  const [overlayPanel, setOverlayPanel] = useState<OverlayPanel>(null);
  const [characterPageFocus, setCharacterPageFocus] = useState<CharacterPageFocus>('character');
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [gender, setGender] = useState<CharacterGender>('male');
  const [race, setRace] = useState<Race>(Race.Human);
  const [originId, setOriginId] = useState<string>(HUMAN_ORIGINS[0].id);
  const [setupElements, setSetupElements] = useState<CharacterElement[]>([]);
  const [setupAvatarUrl, setSetupAvatarUrl] = useState<string>('');
  const setupAvatarInputRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState('Сначала зарегистрируйтесь или войдите, затем создайте персонажа и начните игру.');

  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('merchant_weaponsmith');
  const [selectedMerchantItemId, setSelectedMerchantItemId] = useState<string | null>(null);
  const [selectedSellItemId, setSelectedSellItemId] = useState<string | null>(null);
  const [merchantMode, setMerchantMode] = useState<MerchantMode>('buy');
  const [sellOnlyAvailable, setSellOnlyAvailable] = useState(false);
  const [selectedCombatSkill, setSelectedCombatSkill] = useState<CombatSkillType>(CombatSkillType.None);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [npcTemplates, setNpcTemplates] = useState<ArenaNpcTemplate[]>([]);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);

  const [playerAvatarUrl, setPlayerAvatarUrl] = useState<string>('');
  const [selectedBattleMapId, setSelectedBattleMapId] = useState<string>(() => DEFAULT_BATTLE_MAP_ID);

  const [character, setCharacter] = useState<ArenaCharacter | null>(null);
  const [inventory, setInventory] = useState<InventoryState>({ gold: 0, items: [] });
  const [equipment, setEquipment] = useState<Equipment>({ ...EMPTY_EQUIPMENT });

  const [combatId, setCombatId] = useState<string | null>(null);
  const [playerCombatId, setPlayerCombatId] = useState<string | null>(null);
  const [combatState, setCombatState] = useState<ArenaBattleState | null>(null);
  const [isBattleWindowOpen, setBattleWindowOpen] = useState(false);
  const [battleSummary, setBattleSummary] = useState<BattleSummary | null>(null);
  const [combatRoutePending, setCombatRoutePending] = useState(false);
  const [learnedSkills, setLearnedSkills] = useState<CombatSkillType[]>([]);

  const [pendingStatAllocation, setPendingStatAllocation] = useState<StatAllocation>({});
  const [allocatingStats, setAllocatingStats] = useState(false);
  const [runtimeAdminItems, setRuntimeAdminItems] = useState<AdminItem[]>([]);
  const [runtimeAdminMerchants, setRuntimeAdminMerchants] = useState<AdminMerchant[]>([]);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);

  const [restoringSession, setRestoringSession] = useState(true);

  // Drag-drop and trade modal states
  const [draggedItem, setDraggedItem] = useState<ItemDefinition | null>(null);
  const [dragSource, setDragSource] = useState<'inventory' | 'merchant' | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');
  const [tradeItem, setTradeItem] = useState<ItemDefinition | null>(null);

  const raceConfig = useMemo(() => getCharacterCreationRaceConfig(race), [race]);
  const selectedOrigin = useMemo<CharacterOrigin | null>(
    () => HUMAN_ORIGINS.find((entry) => entry.id === originId) ?? null,
    [originId],
  );
  const setupSkills = useMemo(
    () => setupElements.map((entry) => STARTING_ELEMENT_SKILLS[entry.id]?.skillId).filter((entry): entry is string => Boolean(entry)),
    [setupElements],
  );
  const setupAvatarFallback = useMemo(() => getDefaultAvatarFor(race, gender), [gender, race]);
  const setupAvatarResolved = setupAvatarUrl || setupAvatarFallback;
  const setupStatsPreview = useMemo<StatBlock>(() => {
    const base = { ...raceConfig.stats };
    if (race === Race.Human && selectedOrigin) {
      for (const [key, value] of Object.entries(selectedOrigin.bonuses)) {
        const stat = key as PrimaryStat;
        base[stat] += value ?? 0;
      }
    }
    return base;
  }, [race, raceConfig.stats, selectedOrigin]);
  const runtimeMerchants = useMemo(() => getRuntimeMerchants(runtimeAdminMerchants), [runtimeAdminMerchants]);

  function resolveItem(itemId: string): ItemDefinition {
    const resolved = getDomainItemWithFallback(itemId, runtimeAdminItems);
    return resolved ?? createUnknownItem(itemId);
  }

  const resolveArenaNpcItem = useCallback(
    (itemId: string) => getDomainItemWithFallback(itemId, runtimeAdminItems),
    [runtimeAdminItems],
  );

  const resolveItemImage = useCallback(
    (item: ItemDefinition | null | undefined) => resolveItemImageSource(item, runtimeImages),
    [runtimeImages],
  );
  const resolveMerchantImage = useCallback(
    (merchant: AdminMerchant | null | undefined) => resolveMerchantImageSource(merchant, runtimeImages),
    [runtimeImages],
  );
  const arkleinMerchants = useMemo(
    () => runtimeAdminMerchants.filter((merchant) => merchant.isEnabled && isArkleinCity(merchant.city)),
    [runtimeAdminMerchants],
  );
  const arenaEquipmentOptionsBySlot = useMemo<Record<EquipmentSlot, ItemDefinition[]>>(() => {
    const merged = new Map<string, ItemDefinition>();

    for (const item of Object.values(ITEMS)) {
      merged.set(item.id, item);
    }

    for (const entry of runtimeAdminItems) {
      const resolved = getDomainItemWithFallback(entry.id, runtimeAdminItems);
      if (resolved) {
        merged.set(resolved.id, resolved);
      }
    }

    const values = Array.from(merged.values());
    return {
      weapon: values.filter((item) => item.itemType === 'weapon'),
      helmet: values.filter((item) => item.itemType === 'helmet'),
      necklace: values.filter((item) => item.itemType === 'necklace'),
      armor: values.filter((item) => item.itemType === 'armor'),
      outerwear: values.filter((item) => item.itemType === 'outerwear'),
      belt: values.filter((item) => item.itemType === 'belt'),
      gloves: values.filter((item) => item.itemType === 'gloves'),
      shield: values.filter((item) => item.itemType === 'shield'),
      ring1: values.filter((item) => item.itemType === 'ring'),
      ring2: values.filter((item) => item.itemType === 'ring'),
      ring3: values.filter((item) => item.itemType === 'ring'),
      legs: values.filter((item) => item.itemType === 'legs'),
      boots: values.filter((item) => item.itemType === 'boots'),
    };
  }, [runtimeAdminItems]);
  const loadArenaNpcTemplatesFromBackend = useCallback(async (force = false) => {
    await ensureNpcsLoaded(force);
    const templates = getAllNpcs()
      .filter(isArenaNpcDefinition)
      .map((npc) => toArenaNpcTemplate(npc, (itemId) => resolveArenaNpcItem(itemId) ?? null))
      .sort((left, right) => left.name.localeCompare(right.name));

    arenaNpcInitializedRef.current = true;
    arenaNpcSkipNextSyncRef.current = true;
    arenaNpcSyncedIdsRef.current = new Set(templates.map((entry) => entry.id));
    setNpcTemplates(templates);
    setSelectedNpcId((current) => {
      if (current && templates.some((entry) => entry.id === current)) {
        return current;
      }
      return templates[0]?.id ?? null;
    });
  }, [resolveArenaNpcItem]);

  const selectedMerchant = useMemo<Merchant | null>(
    () => runtimeMerchants.find((merchant) => merchant.id === selectedMerchantId) ?? null,
    [runtimeMerchants, selectedMerchantId],
  );
  const selectedAdminMerchant = useMemo(
    () => runtimeAdminMerchants.find((merchant) => merchant.id === selectedMerchantId) ?? null,
    [runtimeAdminMerchants, selectedMerchantId],
  );
  const merchantItems = useMemo<ItemDefinition[]>(
    () => (selectedMerchant ? getRuntimeMerchantItems(selectedMerchant.id, runtimeAdminMerchants, runtimeAdminItems) : []),
    [runtimeAdminItems, runtimeAdminMerchants, selectedMerchant],
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
    const item = resolveItem(entry.itemId);
    const equippedSlot = equippedSlotByItemId.get(entry.itemId) ?? null;
    return {
      ...entry,
      item,
      equippedSlot,
      isEquipped: Boolean(equippedSlot),
    };
  }), [equippedSlotByItemId, inventory.items, runtimeAdminItems]);
  const sellEntries = useMemo(() => {
    return inventory.items.map((entry) => {
      const item = resolveItem(entry.itemId);
      const sellPrice = Math.max(1, Math.floor(item.price * 0.6));
      const sellLocked = equippedItemIds.has(entry.itemId) && entry.quantity <= 1;
      return {
        item,
        quantity: entry.quantity,
        sellPrice,
        sellLocked,
      };
    });
  }, [equippedItemIds, inventory.items, runtimeAdminItems]);
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
    return equippedId ? resolveItem(equippedId) : null;
  }, [equipment, runtimeAdminItems, selectedMerchantItem]);
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
  const activePlayerRoute = useMemo(
    () => getPlayerRouteFromState(phase, overlayPanel, isBattleWindowOpen, combatRoutePending),
    [combatRoutePending, isBattleWindowOpen, overlayPanel, phase],
  );
  const requestedPlayerRoute = useMemo<PlayerPath>(
    () => (phase === 'hub' && currentPlayerRoute === '/' ? '/map' : currentPlayerRoute),
    [currentPlayerRoute, phase],
  );

  const chatLines = useMemo(() => {
    const logs = combatState?.logs?.slice(-7).map((entry) => entry.text) ?? [];
    return [status, ...logs].filter((line) => line.trim().length > 0).slice(-8);
  }, [status, combatState?.logs]);
  const selectedBattleMap = useMemo(
    () => resolveBattleMapForCombat(selectedBattleMapId || DEFAULT_BATTLE_MAP_ID),
    [selectedBattleMapId],
  );
  const activeCombatBattleMap = useMemo(
    () => resolveBattleMapForCombat(combatState?.battleMapId ?? selectedBattleMap.id),
    [combatState?.battleMapId, selectedBattleMap.id],
  );

  const refreshRuntimeContent = useCallback(async (options?: { force?: boolean }) => {
    const now = Date.now();
    if (!options?.force && runtimeContentRefreshRef.current && now - lastRuntimeContentRefreshAtRef.current < 1200) {
      return runtimeContentRefreshRef.current;
    }

    lastRuntimeContentRefreshAtRef.current = now;
    const refreshPromise = Promise.all([
      loadRuntimeAdminContent(),
      loadRuntimeImages(),
      ensureDialoguesLoaded(options?.force === true),
      ensureNpcsLoaded(options?.force === true),
      ensureQuestsLoaded(options?.force === true),
      ensureQuestMarkersLoaded(options?.force === true),
    ])
      .then(([content, images]) => {
        setRuntimeAdminItems(content.items);
        setRuntimeAdminMerchants(content.merchants);
        setRuntimeImages(images);
      })
      .catch(() => {
        // Keep hardcoded fallback content if backend content is unavailable.
      })
      .finally(() => {
        if (runtimeContentRefreshRef.current === refreshPromise) {
          runtimeContentRefreshRef.current = null;
        }
      });

    runtimeContentRefreshRef.current = refreshPromise;
    return refreshPromise;
  }, []);

  useEffect(() => {
    const savedAccountId = window.localStorage.getItem(LAST_ACCOUNT_ID_STORAGE_KEY);
    const savedAccountLogin = window.localStorage.getItem(LAST_ACCOUNT_LOGIN_STORAGE_KEY);
    if (savedAccountId) {
      setAccountId(savedAccountId);
      setSetupStep('character');
    }
    if (savedAccountLogin) {
      setLogin(savedAccountLogin);
    }

    const savedCharacterId = window.localStorage.getItem(LAST_CHARACTER_STORAGE_KEY);
    if (!savedCharacterId) {
      setRestoringSession(false);
      return;
    }

    void getArenaHubState(savedCharacterId)
      .then((hub) => {
        applyHubState(hub);
        setPhase('hub');
        setStatus(`Сессия восстановлена: ${hub.character.name}.`);
      })
      .catch(() => {
        window.localStorage.removeItem(LAST_CHARACTER_STORAGE_KEY);
      })
      .finally(() => {
        setRestoringSession(false);
      });
  }, []);

  useEffect(() => {
    void refreshRuntimeContent({ force: true });
  }, [refreshRuntimeContent]);

  useEffect(() => {
    if (race === Race.Human) {
      setSetupElements([]);
      return;
    }

    setOriginId(HUMAN_ORIGINS[0].id);

    if (race === Race.Dwarf) {
      setSetupElements([]);
      return;
    }

    const elementCount = race === Race.HighElf ? 2 : 1;
    setSetupElements(getRandomStartingElements(elementCount));
  }, [race]);

  useEffect(() => {
    const refreshVisibleContent = () => {
      void refreshRuntimeContent();
    };

    const unsubscribe = subscribeToContentSync((payload) => {
      if (payload.scope === 'content' || payload.scope === 'all') {
        void refreshRuntimeContent({ force: true });
        if (overlayPanel !== 'arenaNpc') {
          void loadArenaNpcTemplatesFromBackend(true).catch(() => undefined);
        }
      }
    });

    const handleFocus = () => {
      refreshVisibleContent();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshVisibleContent();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadArenaNpcTemplatesFromBackend, overlayPanel, refreshRuntimeContent]);

  useEffect(() => {
    if (runtimeMerchants.length === 0) {
      return;
    }
    if (!runtimeMerchants.some((merchant) => merchant.id === selectedMerchantId)) {
      setSelectedMerchantId(runtimeMerchants[0].id);
    }
  }, [runtimeMerchants, selectedMerchantId]);

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
    void loadArenaNpcTemplatesFromBackend(true).catch(() => {
      arenaNpcInitializedRef.current = true;
      setNpcTemplates([]);
      setSelectedNpcId(null);
    });
  }, [loadArenaNpcTemplatesFromBackend]);

  useEffect(() => {
    if (!arenaNpcInitializedRef.current) {
      return;
    }
    if (arenaNpcSkipNextSyncRef.current) {
      arenaNpcSkipNextSyncRef.current = false;
      return;
    }

    if (arenaNpcSyncTimerRef.current !== null) {
      window.clearTimeout(arenaNpcSyncTimerRef.current);
    }

    arenaNpcSyncTimerRef.current = window.setTimeout(() => {
      const sync = async () => {
        try {
          await ensureNpcsLoaded();
          const existingById = new Map(getAllNpcs().map((entry) => [entry.id, entry] as const));
          const nextIds = new Set(npcTemplates.map((entry) => entry.id));
          const previousIds = arenaNpcSyncedIdsRef.current;

          for (const template of npcTemplates) {
            await saveNpc(toArenaNpcDefinition(template, (itemId) => resolveArenaNpcItem(itemId) ?? null, existingById.get(template.id) ?? null));
          }

          for (const removedId of previousIds) {
            if (!nextIds.has(removedId) && existingById.has(removedId)) {
              await deleteNpc(removedId);
            }
          }

          arenaNpcSyncedIdsRef.current = nextIds;
        } catch (error) {
          setStatus(`Arena NPC sync error: ${(error as Error).message}`);
        }
      };

      void sync();
    }, 350);

    return () => {
      if (arenaNpcSyncTimerRef.current !== null) {
        window.clearTimeout(arenaNpcSyncTimerRef.current);
        arenaNpcSyncTimerRef.current = null;
      }
    };
  }, [npcTemplates, resolveArenaNpcItem]);

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
    if (!arenaNpcInitializedRef.current) {
      return;
    }

    void loadArenaNpcTemplatesFromBackend().catch(() => undefined);
  }, [loadArenaNpcTemplatesFromBackend, runtimeAdminItems]);

  useEffect(() => {
    const maps = loadBattleMaps();
    const savedBattleMapId = window.localStorage.getItem(SELECTED_BATTLE_MAP_STORAGE_KEY);
    if (savedBattleMapId && maps.some((map) => map.id === savedBattleMapId)) {
      setSelectedBattleMapId(savedBattleMapId);
      return;
    }
    setSelectedBattleMapId(maps[0]?.id ?? DEFAULT_BATTLE_MAP_ID);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SELECTED_BATTLE_MAP_STORAGE_KEY, selectedBattleMapId);
  }, [selectedBattleMapId]);

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
    if (!character?.id) {
      setPlayerAvatarUrl('');
      return;
    }

    const saved = window.localStorage.getItem(`${PLAYER_AVATAR_STORAGE_PREFIX}.${character.id}`);
    setPlayerAvatarUrl(saved ?? '');
  }, [character?.id]);

  useEffect(() => {
    if (!character?.id) {
      return;
    }

    const storageKey = `${PLAYER_AVATAR_STORAGE_PREFIX}.${character.id}`;
    if (!playerAvatarUrl) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, playerAvatarUrl);
  }, [character?.id, playerAvatarUrl]);

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

  useEffect(() => {
    if (restoringSession) {
      return;
    }

    if (currentPlayerRoute === activePlayerRoute) {
      if (pendingRouteSyncRef.current?.to === currentPlayerRoute) {
        pendingRouteSyncRef.current = null;
      }
      return;
    }

    pendingRouteSyncRef.current = { from: currentPlayerRoute, to: activePlayerRoute };
    onNavigate?.(activePlayerRoute, { replace: activePlayerRoute === '/' });
  }, [activePlayerRoute, currentPlayerRoute, onNavigate, restoringSession]);

  useEffect(() => {
    if (restoringSession || phase !== 'hub') {
      return;
    }

    const pendingRouteSync = pendingRouteSyncRef.current;
    if (pendingRouteSync) {
      if (currentPlayerRoute === pendingRouteSync.to) {
        pendingRouteSyncRef.current = null;
        return;
      }

      if (currentPlayerRoute === pendingRouteSync.from && activePlayerRoute === pendingRouteSync.to) {
        return;
      }

      pendingRouteSyncRef.current = null;
    }

    if (requestedPlayerRoute === activePlayerRoute) {
      return;
    }

    if (requestedPlayerRoute === '/inventory') {
      if (isBattleWindowOpen) {
        setBattleWindowOpen(false);
      }
      setCharacterPageFocus('inventory');
      setOverlayPanel('character');
      return;
    }

    if (requestedPlayerRoute === '/map') {
      if (isBattleWindowOpen) {
        setBattleWindowOpen(false);
      }
      setOverlayPanel(null);
      return;
    }

    if (requestedPlayerRoute === '/merchant') {
      if (isBattleWindowOpen) {
        setBattleWindowOpen(false);
      }
      openMerchantOverlay();
      return;
    }

    if (requestedPlayerRoute === '/combat') {
      setOverlayPanel(null);

      if (combatState && combatId) {
        setBattleWindowOpen(true);
        return;
      }

      void openCombat();
    }
  }, [
    activePlayerRoute,
    combatId,
    combatState,
    isBattleWindowOpen,
    phase,
    requestedPlayerRoute,
    restoringSession,
    runtimeAdminItems,
    runtimeAdminMerchants,
    runtimeMerchants,
  ]);

  function applyHubState(hub: HubStatePayload): void {
    setCharacter(hub.character);
    setInventory(hub.inventory);
    setEquipment(hub.equipment);
    const profile = loadCharacterProfile(hub.character.id);
    if (profile?.avatarUrl) {
      setPlayerAvatarUrl(profile.avatarUrl);
      window.localStorage.setItem(`${PLAYER_AVATAR_STORAGE_PREFIX}.${hub.character.id}`, profile.avatarUrl);
    }
    window.localStorage.setItem(LAST_CHARACTER_STORAGE_KEY, hub.character.id);
  }

  async function onRegister(): Promise<void> {
    setStatus('Registering account...');
    try {
      const account = await registerAccount({ login, password });
      setAccountId(account.id);
      window.localStorage.setItem(LAST_ACCOUNT_ID_STORAGE_KEY, account.id);
      window.localStorage.setItem(LAST_ACCOUNT_LOGIN_STORAGE_KEY, account.login);
      setLogin(account.login);
      setSetupStep('character');
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
      window.localStorage.setItem(LAST_ACCOUNT_ID_STORAGE_KEY, account.id);
      window.localStorage.setItem(LAST_ACCOUNT_LOGIN_STORAGE_KEY, account.login);
      setLogin(account.login);
      const characters = await listCharacters(account.id);

      if (characters.length > 0) {
        const latestCharacter = characters[0];
        const hub = await getArenaHubState(latestCharacter.id);
        applyHubState(hub);
        setPhase('hub');
        setStatus(`Welcome back, ${account.login}.`);
        return;
      }

      setSetupStep('character');
      setStatus(`Welcome, ${account.login}. Create your first character.`);
    } catch (error) {
      setStatus(`Login error: ${(error as Error).message}`);
    }
  }

  async function onCreateCharacter(): Promise<void> {
    if (!accountId) {
      setSetupStep('account');
      setStatus('Сначала зарегистрируйтесь или войдите в аккаунт.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setStatus('Имя персонажа обязательно.');
      return;
    }
    if (race === Race.Human && !originId) {
      setStatus('Для человека обязательно выбрать подданство.');
      return;
    }
    if (race === Race.Dwarf && setupElements.length > 0) {
      setStatus('Гном не может получить стартовые стихии.');
      return;
    }

    setStatus('Создаем персонажа...');
    try {
      const saved = await createCharacter({
        name: trimmedName,
        race,
        allocation: {},
      }, accountId);

      const profile: CharacterCreationProfile = {
        id: saved.id,
        name: trimmedName,
        gender,
        raceId: raceConfig.id,
        originId: race === Race.Human ? originId : null,
        avatarUrl: setupAvatarResolved,
        stats: setupStatsPreview,
        elements: race === Race.Dwarf ? [] : setupElements.map((entry) => entry.id),
        skills: race === Race.Dwarf ? [] : setupSkills,
        traits: {
          ...(raceConfig.traits.experienceGainMultiplier !== undefined ? { experienceGainMultiplier: raceConfig.traits.experienceGainMultiplier } : {}),
          ...(raceConfig.traits.elementalMagicCostMultiplier !== undefined ? { elementalMagicCostMultiplier: raceConfig.traits.elementalMagicCostMultiplier } : {}),
          ...(raceConfig.traits.normalMagicCostMultiplier !== undefined ? { normalMagicCostMultiplier: raceConfig.traits.normalMagicCostMultiplier } : {}),
          ...(raceConfig.traits.magicDamageTakenMultiplier !== undefined ? { magicDamageTakenMultiplier: raceConfig.traits.magicDamageTakenMultiplier } : {}),
          canUseMagic: raceConfig.traits.canUseMagic,
          canUseElementalMagic: raceConfig.traits.canUseElementalMagic,
        },
      };
      saveCharacterProfile(profile);

      const hub = await getArenaHubState(saved.id);
      applyHubState(hub);

      setPlayerAvatarUrl(setupAvatarResolved);
      window.localStorage.setItem(`${PLAYER_AVATAR_STORAGE_PREFIX}.${saved.id}`, setupAvatarResolved);

      setPhase('hub');
      setStatus(`${saved.name} вошел в мир.`);
    } catch (error) {
      setStatus(`Character creation error: ${(error as Error).message}`);
    }
  }

  function handleSetupAvatarChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setStatus('Формат аватара: PNG, JPG, JPEG или WEBP.');
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStatus('Максимальный размер аватара: 2 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        return;
      }

      const image = new Image();
      image.onload = () => {
        if (image.width < 128 || image.height < 128) {
          setStatus('Минимальный размер аватара: 128x128.');
          event.target.value = '';
          return;
        }
        setSetupAvatarUrl(result);
        if (image.width < 256 || image.height < 256) {
          setStatus('Аватар загружен. Рекомендуемый размер: 256x256 или больше.');
        } else {
          setStatus('Аватар загружен.');
        }
      };
      image.src = result;
    };
    reader.readAsDataURL(file);
  }

  async function handleEquip(itemId: string, preferredSlot?: keyof Equipment): Promise<void> {
    if (!character) {
      return;
    }

    const item = resolveItem(itemId);
    const previousShieldId = equipment.shield;
    const isTwoHandedWeapon = item.itemType === 'weapon' && getItemHandsRequired(item) === 2;

    try {
      const hub = await equipArenaItem(character.id, itemId, preferredSlot);
      applyHubState(hub);
      if (isTwoHandedWeapon && previousShieldId && !hub.equipment.shield) {
        setStatus(`Экипировано: ${item.name}. Предмет из левой руки снят и остался в инвентаре, потому что оружие двуручное.`);
        return;
      }

      setStatus(`Экипировано: ${item.name}.`);
    } catch (error) {
      setStatus(`Ошибка экипировки: ${(error as Error).message}`);
    }
  }

  async function handleUnequip(slot: keyof Equipment): Promise<void> {
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

  async function handleBuy(itemId: string, merchantId = selectedMerchantId): Promise<void> {
    if (!character) {
      return;
    }

    try {
      const hub = await buyArenaItem(character.id, itemId, merchantId);
      applyHubState(hub);
      setStatus(`Куплено: ${resolveItem(itemId).name}`);
    } catch (error) {
      const item = resolveItem(itemId);
      setStatus(`Ошибка покупки: ${(error as Error).message} У вас ${inventory.gold} золота, предмет стоит ${item.price}.`);
    }
  }

  async function handleBuyAndEquip(itemId: string, merchantId = selectedMerchantId): Promise<void> {
    if (!character) {
      return;
    }

    const item = resolveItem(itemId);
    const previousShieldId = equipment.shield;
    if (item.itemType === 'consumable') {
      await handleBuy(itemId, merchantId);
      return;
    }

    let purchased = false;

    try {
      const boughtHub = await buyArenaItem(character.id, itemId, merchantId);
      purchased = true;
      applyHubState(boughtHub);

      const equippedHub = await equipArenaItem(character.id, itemId);
      applyHubState(equippedHub);
      if (item.itemType === 'weapon' && getItemHandsRequired(item) === 2 && previousShieldId && !equippedHub.equipment.shield) {
        setStatus(`Куплено и экипировано: ${item.name}. Предмет из левой руки снят и остался в инвентаре.`);
        return;
      }
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
      const item = resolveItem(itemId);
      const sellPrice = Math.max(1, Math.floor(item.price * 0.6));
      setStatus(`Продано: ${item.name} (+${sellPrice} золота)`);
    } catch (error) {
      setStatus(`Ошибка продажи: ${(error as Error).message}`);
    }
  }

  function openMerchantOverlay(merchantId = runtimeMerchants[0]?.id ?? 'merchant_weaponsmith'): void {
    const merchant = runtimeMerchants.find((item) => item.id === merchantId);
    if (!merchant) {
      return;
    }

    setSelectedMerchantId(merchant.id);
    const defaultItem = getRuntimeMerchantItems(merchant.id, runtimeAdminMerchants, runtimeAdminItems)[0] ?? null;
    setSelectedMerchantItemId(defaultItem?.id ?? null);
    setMerchantMode('buy');
    setOverlayPanel('merchant');
    setStatus(`Открыт торговец: ${merchant.name}`);
  }

  function openSkillsOverlay(): void {
    onNavigate?.('/inventory');
    setCharacterPageFocus('skills');
    setOverlayPanel('character');
    setStatus('Открыта страница персонажа: раздел навыков.');
  }

  function openArenaOverlay(): void {
    setOverlayPanel('arena');
    setStatus('Открыта арена. Настройте NPC и начинайте бой. Tactical Battle Map Editor доступен в боковой панели карты мира.');
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

  async function handleBattleFinished(nextState: ArenaBattleState, resolvedHubState?: ArenaHubState): Promise<void> {
    if (!character || !playerCombatId) {
      setBattleWindowOpen(false);
      battleStartSnapshotRef.current = null;
      return;
    }

    try {
      const refreshedHub = resolvedHubState ?? await getArenaHubState(character.id);
      applyHubState(refreshedHub);
      setBattleSummary(buildBattleSummary(nextState, playerCombatId, battleStartSnapshotRef.current, refreshedHub.character));
      setStatus('Бой завершён. Открылось окно итогов.');
    } catch (error) {
      setStatus(`Battle sync error: ${(error as Error).message}`);
    } finally {
      setBattleWindowOpen(false);
      battleStartSnapshotRef.current = null;
    }
  }

  async function openCombat(): Promise<void> {
    if (!character) {
      return;
    }

    setCombatRoutePending(true);
    setBattleSummary(null);
    battleStartSnapshotRef.current = {
      level: character.level,
      exp: character.exp,
      freePoints: character.freePoints,
    };

    try {
      const battleMapPayload = toRuntimeBattleMapPayload(selectedBattleMap);
      const started = activeArenaNpcs.length > 0
        ? await startCustomCombat(character.id, activeArenaNpcs.map(toCustomNpcPayload), battleMapPayload)
        : await startCombat(character.id, 3, battleMapPayload);
      setOverlayPanel(null);
      setCombatId(started.combatId);
      setPlayerCombatId(started.playerId);
      setCombatState(started.state);
      setBattleWindowOpen(true);
      setStatus(activeArenaNpcs.length > 0 ? `Battle started against ${activeArenaNpcs.length} arena NPC.` : 'Battle started.');
    } catch (error) {
      battleStartSnapshotRef.current = null;
      setStatus(`Battle error: ${(error as Error).message}`);
    } finally {
      setCombatRoutePending(false);
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
      setStatus(`${resolveItem(itemId).name} used.`);
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

  const setupOriginRequired = race === Race.Human;
  const setupElementsText = setupElements.map((entry) => entry.name).join(', ');
  const setupSkillNames = setupElements
    .map((entry) => STARTING_ELEMENT_SKILLS[entry.id]?.name)
    .filter((entry): entry is string => Boolean(entry));
  const setupCharacterPreview = useMemo(() => ({
    id: 'char_generated_uuid',
    name: name.trim() || '(имя не задано)',
    gender,
    raceId: raceConfig.id,
    originId: setupOriginRequired ? originId : null,
    avatarUrl: setupAvatarResolved,
    stats: setupStatsPreview,
    elements: race === Race.Dwarf ? [] : setupElements.map((entry) => entry.id),
    skills: race === Race.Dwarf ? [] : setupSkills,
    traits: {
      ...(raceConfig.traits.experienceGainMultiplier !== undefined ? { experienceGainMultiplier: raceConfig.traits.experienceGainMultiplier } : {}),
      ...(raceConfig.traits.elementalMagicCostMultiplier !== undefined ? { elementalMagicCostMultiplier: raceConfig.traits.elementalMagicCostMultiplier } : {}),
      ...(raceConfig.traits.normalMagicCostMultiplier !== undefined ? { normalMagicCostMultiplier: raceConfig.traits.normalMagicCostMultiplier } : {}),
      ...(raceConfig.traits.magicDamageTakenMultiplier !== undefined ? { magicDamageTakenMultiplier: raceConfig.traits.magicDamageTakenMultiplier } : {}),
      canUseMagic: raceConfig.traits.canUseMagic,
      canUseElementalMagic: raceConfig.traits.canUseElementalMagic,
    },
  }), [gender, name, originId, race, raceConfig.id, raceConfig.traits, setupAvatarResolved, setupElements, setupOriginRequired, setupSkills, setupStatsPreview]);

  if (phase === 'setup') {
    if (restoringSession) {
      return (
        <div className="page">
          <main className="shell setup-shell">
            <section className="card status-card setup-status-card">
              <h2>Status</h2>
              <p>Восстанавливаем сохранённого персонажа...</p>
            </section>
          </main>
        </div>
      );
    }

    return (
      <div className="page page--scroll">
        <main className="shell setup-shell">
          <section className="card compact-hero setup-hero-card">
            <div className="setup-hero-copy">
              <p className="eyebrow">TheEnd RPG</p>
                  <h1>{setupStep === 'account' ? 'Регистрация' : 'Создание персонажа'}</h1>
                  <p className="muted setup-hero-text">
                    {setupStep === 'account'
                      ? 'Шаг 1 из 2. Создайте аккаунт или войдите в существующий. Подтверждение почты пока не требуется.'
                      : 'Шаг 2 из 2. Настройте персонажа: имя, пол, раса, подданство и аватар.'}
                  </p>
            </div>
            <div className="setup-hero-side">
                  <div className="level-pill">{setupStep === 'account' ? 'Шаг 1/2' : 'Шаг 2/2'}</div>
                  <p className="muted">
                    {setupStep === 'account' ? 'После входа откроется создание персонажа.' : 'Люди, Лесные эльфы, Высшие эльфы, Гномы.'}
                  </p>
            </div>
          </section>

              {setupStep === 'account' ? (
                <section className="setup-grid setup-creation-grid">
                  <section className="card setup-panel setup-panel-primary">
                    <h2>Аккаунт</h2>
                    <p className="muted setup-panel-copy">Введите логин и пароль, затем зарегистрируйтесь или войдите.</p>

                    <div className="row">
                      <label>Login</label>
                      <input value={login} onChange={(event) => setLogin(event.target.value)} />
                    </div>
                    <div className="row">
                      <label>Password</label>
                      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                    </div>

                    <div className="hud-actions setup-actions-row">
                      <button onClick={onRegister} disabled={!login.trim() || !password.trim()}>Register</button>
                      <button onClick={onLogin} disabled={!login.trim() || !password.trim()}>Login</button>
                    </div>
                  </section>

                  <section className="card setup-panel setup-panel-secondary">
                    <h2>Дальше</h2>
                    <p className="muted setup-panel-copy">После успешного входа будет доступно создание персонажа.</p>
                    <section className="inner-card setup-race-note">
                      <strong>Сохранение прогресса</strong>
                      <p>Аккаунт и персонажи сохраняются. При следующем входе можно продолжить с последнего персонажа.</p>
                    </section>
                    {accountId ? (
                      <section className="inner-card setup-race-note">
                        <strong>Аккаунт подключен</strong>
                        <p>Можно переходить к созданию персонажа.</p>
                        <button type="button" onClick={() => setSetupStep('character')}>Перейти к созданию персонажа</button>
                      </section>
                    ) : null}
                  </section>
                </section>
              ) : (
                <section className="setup-grid setup-creation-grid">
            <section className="card setup-panel setup-panel-primary">
              <h2>Персонаж</h2>
              <p className="muted setup-panel-copy">Левая панель: аватар, имя, пол, раса, подданство (только для людей).</p>

              <div className="setup-avatar-upload setup-avatar-upload-large">
                <input ref={setupAvatarInputRef} type="file" accept="image/png,image/jpg,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleSetupAvatarChange} />
                <img src={setupAvatarResolved} alt="Character avatar" className="setup-avatar-preview setup-avatar-preview-xl" />
                <div className="setup-avatar-actions">
                  <button type="button" onClick={() => setupAvatarInputRef.current?.click()}>{setupAvatarUrl ? 'Заменить аватар' : 'Загрузить аватар'}</button>
                  {setupAvatarUrl ? <button type="button" onClick={() => setSetupAvatarUrl('')}>Сбросить</button> : null}
                </div>
                <p className="muted">PNG/JPG/JPEG/WEBP, минимум 128x128, рекомендуется 256x256, до 2 MB.</p>
              </div>

              <div className="row">
                <label>Имя</label>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Введите имя персонажа" />
              </div>

              <div className="row">
                <label>Пол</label>
                <select value={gender} onChange={(event) => setGender(event.target.value as CharacterGender)}>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                </select>
              </div>

              <div className="row">
                <label>Раса</label>
                <select value={race} onChange={(event) => setRace(event.target.value as Race)}>
                  {RACES.map((option) => {
                    const optionConfig = getCharacterCreationRaceConfig(option);
                    return (
                      <option key={option} value={option}>
                        {optionConfig.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {setupOriginRequired ? (
                <div className="row">
                  <label>Подданство</label>
                  <select value={originId} onChange={(event) => setOriginId(event.target.value)}>
                    {HUMAN_ORIGINS.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <section className="inner-card setup-race-note">
                <strong>{raceConfig.name}</strong>
                <p>{raceConfig.description}</p>
                {setupOriginRequired && selectedOrigin ? (
                  <p><strong>Подданство:</strong> {selectedOrigin.name} - {selectedOrigin.description}</p>
                ) : null}
              </section>
            </section>

            <section className="card setup-panel setup-panel-secondary">
              <h2>Предпросмотр</h2>
              <p className="muted setup-panel-copy">Правая панель: описание расы, особенности, итоговые статы, стихии и стартовые навыки.</p>

                  <section className="inner-card setup-race-note">
                    <strong>Аккаунт</strong>
                    <p>{login.trim() ? `Вы вошли как ${login}.` : 'Аккаунт подключен.'}</p>
                    <button type="button" onClick={() => setSetupStep('account')}>Сменить аккаунт</button>
                  </section>

              <section className="inner-card setup-race-note">
                <strong>Расовые особенности</strong>
                {raceConfig.traitHighlights.map((entry) => <p key={entry}>{entry}</p>)}
              </section>

              <section className="inner-card setup-race-note">
                <strong>Итоговые статы</strong>
                <div className="compact-stat-list">
                  {PROFILE_STATS.map((stat) => (
                    <div key={stat} className="compact-stat-row">
                      <span>{STAT_LABELS[stat]}</span>
                      <strong>{setupStatsPreview[stat]}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="inner-card setup-race-note">
                <strong>Стартовые стихии</strong>
                <p>
                  {race === Race.Human || race === Race.Dwarf
                    ? 'Стартовые стихии не выдаются.'
                    : (setupElementsText || 'Подбираются автоматически.')}
                </p>
                <strong>Стартовые стихийные навыки</strong>
                <p>{setupSkillNames.length > 0 ? setupSkillNames.join(', ') : 'Нет'}</p>
              </section>

              <section className="inner-card setup-race-note">
                <strong>Итоговый объект персонажа</strong>
                <pre className="setup-preview-json">{JSON.stringify(setupCharacterPreview, null, 2)}</pre>
              </section>
            </section>
                </section>
              )}

              {setupStep === 'character' ? (
                <section className="card setup-bottom-actions">
                  <button
                    className="setup-enter-button"
                    onClick={onCreateCharacter}
                    disabled={!name.trim() || (setupOriginRequired && !originId)}
                  >
                    Создать персонажа
                  </button>
                </section>
              ) : null}

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

  const respecStats = useCallback(async (): Promise<void> => {
    const ok = window.confirm('Сбросить характеристики и вернуть все очки для перераспределения?');
    if (!ok) {
      return;
    }

    const baseline = { ...getCharacterCreationRaceConfig(character.race).stats };
    const level = character.level ?? 1;
    const totalFreePoints = 5 + Math.max(0, level - 1) * 5;

    setPendingStatAllocation({});
    setCharacter((current) => {
      if (!current) return current;
      return {
        ...current,
        baseStats: baseline,
        activeStats: baseline,
        freePoints: totalFreePoints,
      };
    });

    setStatus('Характеристики сброшены. Очки возвращены.');
  }, [character.level, character.race]);

  return (
    <div className="page game-root">
      <main className="shell game-shell world-shell game-main">
        <WorldMapScreen
          character={character}
          inventory={inventory}
          equipment={equipment}
          playerAvatarUrl={playerAvatarUrl}
          battleStats={{
            hp: battlePlayer?.currentHp ?? character.activeStats.hp,
            mp: battlePlayer?.currentMp ?? character.activeStats.mp,
            stamina: battlePlayer?.currentStamina ?? character.activeStats.stamina,
          }}
          chatLines={chatLines}
          onOpenStats={() => {
            onNavigate?.('/inventory');
            setCharacterPageFocus('stats');
            setOverlayPanel('character');
            setStatus('Открыта страница персонажа: раздел характеристик.');
          }}
          onOpenInventory={() => {
            onNavigate?.('/inventory');
            setCharacterPageFocus('inventory');
            setOverlayPanel('character');
            setStatus('Открыта страница персонажа: раздел инвентаря.');
          }}
          onOpenClan={() => setOverlayPanel('clan')}
          onExit={() => setExitDialogOpen(true)}
          onOpenArena={openArenaOverlay}
          onOpenMerchant={openMerchantOverlay}
          onOpenArenaNpc={openArenaNpcOverlay}
          onOpenSkills={openSkillsOverlay}
          onStartCombat={openCombat}
          onStatus={setStatus}
          cityMerchants={arkleinMerchants}
          resolveItemById={(itemId) => getDomainItemWithFallback(itemId, runtimeAdminItems)}
          resolveItemImage={resolveItemImage}
          resolveMerchantImage={resolveMerchantImage}
        />

        {overlayPanel === 'character' && character ? (
          <InventoryPanel
            character={character}
            inventory={inventory}
            equipment={equipment}
            learnedSkills={learnedSkills}
            pendingStatAllocation={pendingStatAllocation}
            freePointsLeft={freePointsLeft}
            allocatingStats={allocatingStats}
            focusSection={characterPageFocus}
            onClose={() => setOverlayPanel(null)}
            onStatus={setStatus}
            onEquipItem={async (itemId, preferredHand) => {
              await handleEquip(itemId, preferredHand);
            }}
            onUnequipSlot={async (slot) => {
              await handleUnequip(slot);
            }}
            onAdjustStat={adjustPendingStat}
            onApplyStatAllocation={applyStatAllocation}
            onResetStatAllocation={() => setPendingStatAllocation({})}
            onRespecStats={respecStats}
            onUseItem={handleUseConsumable}
            playerAvatarUrl={playerAvatarUrl}
            resolveItemById={(itemId) => getDomainItemWithFallback(itemId, runtimeAdminItems)}
            resolveAdminItemById={(itemId) => runtimeAdminItems.find((item) => item.id === itemId) ?? null}
            resolveItemImage={resolveItemImage}
          />
        ) : null}

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
                      <strong className="character-stat-label">
                        {STAT_LABELS[stat]}
                        <button
                          type="button"
                          className="stat-help-chip"
                          title={STAT_HINTS[stat]}
                          aria-label={`Что делает параметр ${STAT_LABELS[stat]}`}
                        >
                          ?
                        </button>
                      </strong>
                      <p className="wm-stat-hint">Наведите на ? чтобы увидеть, за что отвечает параметр.</p>
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
                <button onClick={() => setStatus('Tactical Battle Map Editor находится в боковой панели карты мира под Zone Editor.')}>Где редактор карты</button>
                <button onClick={() => { void openCombat(); }}>Начать бой</button>
              </div>
            </section>
          </div>
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
                      <div className="row">
                        <label>Аватар (URL картинки)</label>
                        <div className="avatar-input-row">
                          {selectedNpcTemplate.avatarUrl ? (
                            <img
                              src={selectedNpcTemplate.avatarUrl}
                              alt="avatar preview"
                              className="npc-avatar-preview"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : null}
                          <input
                            type="url"
                            placeholder="https://..."
                            value={selectedNpcTemplate.avatarUrl ?? ''}
                            onChange={(event) => updateNpcTemplate(selectedNpcTemplate.id, (current) => ({
                              ...current,
                              avatarUrl: event.target.value || undefined,
                            }))}
                          />
                        </div>
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
                          const options = arenaEquipmentOptionsBySlot[slot];
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
            equipment={equipment}
            merchantItems={merchantItems}
            resolveItemById={(itemId) => getDomainItemWithFallback(itemId, runtimeAdminItems)}
            resolveAdminItemById={(itemId) => runtimeAdminItems.find((item) => item.id === itemId) ?? null}
            resolveItemImage={resolveItemImage}
            merchantDescription={selectedAdminMerchant?.description}
            merchantLocation={selectedAdminMerchant?.location}
            merchantPortrait={resolveMerchantImage(selectedAdminMerchant)}
            onClose={() => setOverlayPanel(null)}
            onBuyItem={async (itemId, merchantId) => {
              try {
                const updated = await buyArenaItem(character.id, itemId, merchantId);
                setInventory(updated.inventory);
                setStatus(`Bought ${resolveItem(itemId).name || 'item'}`);
              } catch (err: any) {
                setStatus(`Failed to buy: ${err.message}`);
              }
            }}
            onSellItem={async (itemId) => {
              try {
                const updated = await sellArenaItem(character.id, itemId);
                setInventory(updated.inventory);
                setStatus(`Sold ${resolveItem(itemId).name || 'item'}`);
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
                <button
                  onClick={() => {
                    setOverlayPanel(null);
                    setExitDialogOpen(false);
                    setPhase('setup');
                    setSetupStep('account');
                    setCharacter(null);
                    setAccountId(null);
                    window.localStorage.removeItem(LAST_ACCOUNT_ID_STORAGE_KEY);
                    window.localStorage.removeItem(LAST_ACCOUNT_LOGIN_STORAGE_KEY);
                    setLogin('');
                    setPassword('');
                    setInventory({ gold: 0, items: [] });
                    setEquipment({ ...EMPTY_EQUIPMENT });
                    setPendingStatAllocation({});
                    window.localStorage.removeItem(LAST_CHARACTER_STORAGE_KEY);
                    setStatus('Вы вышли из аккаунта.');
                  }}
                >
                  Log out
                </button>
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
                inventory={inventory}
                mapImageUrl={activeCombatBattleMap.imageUrl}
                mapCalibration={{
                  cellSizePx: activeCombatBattleMap.cellSizePx,
                  gridOffsetX: activeCombatBattleMap.gridOffsetX,
                  gridOffsetY: activeCombatBattleMap.gridOffsetY,
                }}
                selectedSkill={selectedCombatSkill}
                learnedSkills={learnedSkills}
                onSkillChange={setSelectedCombatSkill}
                onStateChange={setCombatState}
                onStatus={setStatus}
                onBattleFinished={handleBattleFinished}
                onClose={() => setBattleWindowOpen(false)}
                playerAvatarUrl={playerAvatarUrl}
                resolveItemById={(itemId) => getDomainItemWithFallback(itemId, runtimeAdminItems)}
                playerEquipment={equipment}
              />
            </section>
          </div>
        ) : null}

        {battleSummary ? (
          <div className="battle-overlay" role="dialog" aria-modal="true">
            <section className="card battle-window wm-modal battle-summary-modal">
              <div className="battle-window-head">
                <h2>{battleSummary.title}</h2>
                <button onClick={() => setBattleSummary(null)}>✕</button>
              </div>

              <div className="battle-summary-grid">
                <section className="inner-card">
                  <h3>Награды</h3>
                  <p>Опыт: +{battleSummary.expGained}</p>
                  <p>Золото: +{battleSummary.goldGained}</p>
                  <p>Уровень: {battleSummary.levelBefore} -&gt; {battleSummary.levelAfter}</p>
                  <p>Свободные очки: {battleSummary.freePointsAfter}</p>
                </section>

                <section className="inner-card">
                  <h3>Статистика боя</h3>
                  <p>Нанесено урона: {battleSummary.damageDealt}</p>
                  <p>Получено урона: {battleSummary.damageTaken}</p>
                  <p>Заблокировано: {battleSummary.damageBlocked}</p>
                </section>

                <section className="inner-card">
                  <h3>Добыча</h3>
                  {battleSummary.lootNames.length > 0 ? (
                    <ul className="battle-summary-loot-list">
                      {battleSummary.lootNames.map((lootName, index) => (
                        <li key={`${lootName}-${index}`}>{lootName}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">В этот раз без добычи.</p>
                  )}
                </section>
              </div>

              <div className="character-item-actions">
                <button type="button" onClick={() => setBattleSummary(null)}>Продолжить</button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
