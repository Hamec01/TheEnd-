import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AdminSkillDefinition,
  EMPTY_EQUIPMENT,
  normalizePlayerProfessionsState,
  PROFESSION_DEFINITIONS,
  addProfessionXp,
  getPlayerProfession,
  unlockProfession,
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
  type PlayerProfessionsState,
  type PrimaryStat,
  Race,
  type StatBlock,
  type StatAllocation,
} from '@theend/rpg-domain';
import {
  adjustDevInventoryItem,
  allocateStats,
  buyArenaItem,
  createCharacter,
  type CharacterActionBarSlot,
  type CharacterActionSlot,
  type CharacterHotbarSlot,
  getCharacterSkills,
  getCharacterActionBar,
  type ArenaHubState,
  type CharacterSkillLoadout,
  type CharacterSkillRow,
  type CustomArenaNpcPayload,
  equipArenaItem,
  getArenaHubState,
  grantSkill,
  getSkillLoadout,
  learnSkill,
  listCharacters,
  loginAccount,
  MAX_COMBAT_ENEMIES,
  patchDevCharacterState,
  registerAccount,
  revokeCharacterSkill,
  startCombat,
  startCustomCombat,
  updateCharacterResources,
  updateCharacterActionBar,
  updateCharacterHotbar,
  updateSkillLoadout,
  sellArenaItem,
  unequipArenaItem,
  useArenaItem,
  useSkillOutOfCombat,
} from './api';
import type { ArenaCharacter } from './arena/types';
import { BattlePanel } from './battle/BattlePanel';
import { readBattleRendererSetting, writeBattleRendererSetting, type BattleRendererKind } from './battle/battleRendererSettings';
import { ArenaCanvas } from './arena/ArenaCanvas';
import { WorldMapScreen } from './worldmap/WorldMapScreen';
import { GodmodeConsole, type GodmodeConsoleResult } from './components/dev/GodmodeConsole';
import { InventoryPanel, type CharacterPageFocus } from './components/InventoryPanel';
import { PlayerProfessionsPanel } from './components/PlayerProfessionsPanel';
import { MerchantPanel } from './components/MerchantPanel';
import type { AdminItem, AdminMerchant, AdminSkill, StoredImage } from './services/content/models';
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
import { loadRuntimeImages, resolveItemImageSource, resolveMerchantImageSource, resolveStoredImageSource } from './services/content/runtimeImageService';
import { getDomainItemWithFallback } from './services/content/seedService';
import { DEFAULT_BATTLE_MAP_ID, loadBattleMaps, loadBattleMapsFromStore } from './services/battleMaps/battleMapStorage';
import { resolveBattleMapForCombat, toRuntimeBattleMapPayload } from './services/battleMaps/battleMapRuntime';
import { cityService } from './services/cityRepository';
import { itemSetsService } from './services/content/itemSetsService';
import { materialsService } from './services/content/materialsService';
import { ensureDialoguesLoaded, getAllDialogues } from './services/dialogueRepository';
import { loadProfessionBranchesFromStorage } from './services/professionBranchRepository';
import { loadProfessionSkillsFromStorage } from './services/professionSkillRepository';
import { locationService } from './services/locationRepository';
import { deleteNpc, ensureNpcsLoaded, getAllNpcs, saveNpc } from './services/npcRepository';
import { deletePlayerQuestState, ensureQuestsLoaded, getAllPlayerQuestStates, getAllQuests, getQuestById } from './services/questRepository';
import { ensureQuestMarkersLoaded } from './services/questMapRepository';
import { advanceQuest, applyQuestRewards, completeObjective, completeQuest, failQuest, getPlayerQuestState, setQuestFlag, startQuest } from './services/questRuntime';
import type { NpcDefinition, NpcRace } from './types/npc';
import {
  PLAYER_FLAGS_STORAGE_KEY,
  PLAYER_GOLD_STORAGE_KEY,
  PLAYER_ITEMS_STORAGE_KEY,
  PLAYER_MATERIALS_STORAGE_KEY,
  PLAYER_QUEST_ITEMS_STORAGE_KEY,
  PLAYER_RESOURCES_STORAGE_KEY,
  PLAYER_UNLOCKED_DIALOGUES_STORAGE_KEY,
  PLAYER_UNLOCKED_LOCATIONS_STORAGE_KEY,
  PLAYER_UNLOCKED_SHOPS_STORAGE_KEY,
  mergeInventoryWithRuntimeOverlay,
  readNumberStorage,
  readStringArrayStorage,
  readStringNumberRecordStorage,
  writeNumberStorage,
  writeStringArrayStorage,
  writeStringNumberRecordStorage,
} from './utils/playerInventory';
import {
  loadPlayerProfessionsState,
  mergePlayerProfessionsState,
  savePlayerProfessionsState,
} from './services/playerProfessions';

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
type OverlayPanel = 'character' | 'stats' | 'inventory' | 'professions' | 'clan' | 'merchant' | 'skills' | 'arenaNpc' | 'arena' | null;
type ArenaSetupMode = '1v1' | '1v3' | '1v10' | 'random';
type MerchantMode = 'buy' | 'sell';
type EquipmentSlot = keyof Equipment;

interface HubStatePayload {
  character: ArenaCharacter;
  inventory: InventoryState;
  equipment: Equipment;
  actionSlots: CharacterActionSlot[];
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
const PLAYER_SKILLS_STORAGE_KEY = 'theend.player.skills';
const PENDING_SKILL_GRANT_KEY = 'theend.pendingSkillGrant';
const TRACKED_QUEST_STORAGE_PREFIX = 'theend.worldMap.trackedQuest.';
const GODMODE_LOGIN = 'godmod';
const GODMODE_PASSWORD = 'godmod123';
const GODMODE_TUTORIAL_PATH = 'C:\\theend\\docs\\GODMODE_CONSOLE_TUTORIAL.md';

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

function createEmptySkillLoadout(characterId: string): CharacterSkillLoadout {
  return {
    characterId,
    slots: Array.from({ length: 10 }, (_, slotIndex) => ({
      slotIndex,
      skillId: null,
      unlocked: slotIndex < 2,
      slotType: 'ANY' as const,
    })),
  };
}

function createEmptyItemHotbar(): CharacterHotbarSlot[] {
  return Array.from({ length: 10 }, (_, slotIndex) => ({
    slotIndex,
    itemId: null,
    itemInstanceId: null,
  }));
}

function createEmptyActionSlots(): CharacterActionSlot[] {
  return Array.from({ length: 10 }, (_, slotIndex) => ({
    slotId: (`quick${slotIndex + 1}` as CharacterActionSlot['slotId']),
    slotIndex,
    kind: null,
    refId: null,
    itemInstanceId: null,
    weaponInstanceId: null,
  }));
}

function getTrackedQuestStorageKey(characterId: string): string {
  return `${TRACKED_QUEST_STORAGE_PREFIX}${characterId}`;
}

function tokenizeGodmodeCommand(commandLine: string): string[] {
  const matches = commandLine.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\S+/g) ?? [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ''));
}

function countIdEntries(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return counts;
}

function parseLooseConsoleValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return numeric;
  }

  if (/^[\[{"]/.test(trimmed)) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function parseConsoleInteger(value: string | undefined, label: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${label} must be a number.`);
  }
  return Math.trunc(numeric);
}

function readJsonRecord(key: string): Record<string, unknown> {
  if (typeof window === 'undefined') {
    return {};
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function writeJsonRecord(key: string, value: Record<string, unknown>): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeGodmodeCommandTokens(commandLine: string): string[] {
  const trimmed = commandLine.trim();
  if (!trimmed) {
    return [];
  }

  const compactAliases: Array<{ prefix: string; tokens: string[] }> = [
    { prefix: 'get_quest_', tokens: ['quest', 'get'] },
    { prefix: 'delete_quest_', tokens: ['quest', 'reset'] },
    { prefix: 'reset_quest_', tokens: ['quest', 'reset'] },
    { prefix: 'start_quest_', tokens: ['quest', 'start'] },
    { prefix: 'complete_quest_', tokens: ['quest', 'complete'] },
    { prefix: 'fail_quest_', tokens: ['quest', 'fail'] },
    { prefix: 'give_item_', tokens: ['item', 'add'] },
    { prefix: 'remove_item_', tokens: ['item', 'remove'] },
    { prefix: 'give_quest_item_', tokens: ['questitem', 'add'] },
    { prefix: 'remove_quest_item_', tokens: ['questitem', 'remove'] },
    { prefix: 'give_skill_', tokens: ['skill', 'add'] },
    { prefix: 'remove_skill_', tokens: ['skill', 'remove'] },
    { prefix: 'give_gold_', tokens: ['gold', 'add'] },
    { prefix: 'set_gold_', tokens: ['gold', 'set'] },
    { prefix: 'set_level_', tokens: ['level', 'set'] },
    { prefix: 'teleport_city_', tokens: ['teleport', 'city'] },
    { prefix: 'teleport_location_', tokens: ['teleport', 'location'] },
    { prefix: 'open_merchant_', tokens: ['merchant', 'open'] },
    { prefix: 'give_itemset_', tokens: ['itemset', 'give'] },
  ];

  const lowered = trimmed.toLowerCase();
  for (const alias of compactAliases) {
    if (!lowered.startsWith(alias.prefix)) {
      continue;
    }

    const suffix = trimmed.slice(alias.prefix.length).trim();
    return suffix ? [...alias.tokens, suffix] : [...alias.tokens];
  }

  const rawTokens = tokenizeGodmodeCommand(trimmed);
  if (rawTokens.length === 0) {
    return [];
  }

  const aliasHead = rawTokens[0]?.toLowerCase();
  const aliasMap: Record<string, string[]> = {
    get_quest: ['quest', 'get'],
    delete_quest: ['quest', 'reset'],
    reset_quest: ['quest', 'reset'],
    start_quest: ['quest', 'start'],
    complete_quest: ['quest', 'complete'],
    fail_quest: ['quest', 'fail'],
    give_item: ['item', 'add'],
    remove_item: ['item', 'remove'],
    give_quest_item: ['questitem', 'add'],
    remove_quest_item: ['questitem', 'remove'],
    give_skill: ['skill', 'add'],
    remove_skill: ['skill', 'remove'],
    give_gold: ['gold', 'add'],
    set_gold: ['gold', 'set'],
    add_xp: ['xp', 'add'],
    set_xp: ['xp', 'set'],
    set_level: ['level', 'set'],
    set_stat: ['stat', 'set'],
    add_stat: ['stat', 'add'],
    teleport_city: ['teleport', 'city'],
    teleport_location: ['teleport', 'location'],
    merchant_open: ['merchant', 'open'],
    give_itemset: ['itemset', 'give'],
    open_panel: ['panel', 'open'],
  };

  const mapped = aliasHead ? aliasMap[aliasHead] : null;
  if (mapped) {
    return [...mapped, ...rawTokens.slice(1)];
  }

  return rawTokens;
}

function matchesGodmodeFilter(filter: string, ...values: Array<unknown>): boolean {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) {
    return true;
  }

  return values.some((value) => String(value ?? '').toLowerCase().includes(normalizedFilter));
}

function formatGodmodeListLines(label: string, entries: string[], filter = ''): string[] {
  const limit = 40;
  const visible = entries.slice(0, limit);

  return [
    `${label}: ${entries.length}${filter ? ` (filter: ${filter})` : ''}`,
    ...(visible.length > 0 ? visible : ['— nothing found —']),
    ...(entries.length > limit ? [`...and ${entries.length - limit} more.`] : []),
  ];
}

function getGodmodeHelpLines(): string[] {
  return [
    'GODMODE commands:',
    'help',
    'state',
    'gold add <amount> | gold set <amount>',
    'xp add <amount> | xp set <amount>',
    'level set <value> | points add <value> | points set <value>',
    'profession list | profession unlock <professionId> | profession remove <professionId>',
    'profession xp add|set <professionId> <value> | profession level set <professionId> <value> | profession points add|set <professionId> <value>',
    'profession skill learn|reset <professionId> [skillId] | profession branch choose|reset <professionId> [branchId]',
    'stat set <hp|mp|stamina|strength|constitution|dexterity|intelligence|luck|perception|willpower> <value>',
    'stat add <stat> <delta>',
    'resource full | resource set <hp|mp|stamina|regen> <value>',
    'item add <itemId> [qty] | item remove <itemId> [qty]',
    'equip <itemId> [slot] | unequip <slot>',
    'skill add <skillId> | skill remove <skillId>',
    'quest start|get|complete|fail|reset|track|untrack|reward <questId> [objectiveId]',
    'objective complete <questId> <objectiveId>',
    'questitem add|remove <questItemId> [qty]',
    'material add|remove <materialId> [qty] | resource add|remove <resourceId> [qty]',
    'teleport world | teleport city <cityId> | teleport location <locationId>',
    'mine open <mineId> | mine close | mine finish escaped|retreated|failed|dead',
    'panel open inventory|character|stats|skills|equipment|merchant|arena|map | panel close',
    'merchant open <merchantId> | merchant list [filter]',
    'battle map <battleMapId> | battle start [enemyCount] [battleMapId] | battle npc <npcId[,npcId2]> [battleMapId]',
    'itemset give|remove <setId> | itemset list [filter]',
    'list items|skills|quests|npcs|dialogues|merchants|cities|locations|battlemaps|itemsets|materials [filter]',
    'flag get <key> | flag list | flag set <key> <value> | flag delete <key>',
    'unlock location|dialogue|shop <id> | unlock all locations|dialogues|shops',
    'clear questitems|materials|resources|flags|runtimeitems|allruntime',
    'sync runtime',
  ];
}

function actionBarSlotToActionSlot(slot: CharacterActionBarSlot): CharacterActionSlot {
  if (slot.entryKind === 'skill') {
    return {
      slotId: slot.slotId,
      slotIndex: slot.order,
      kind: 'skill',
      refId: slot.skillId ?? null,
      itemInstanceId: null,
      weaponInstanceId: null,
    };
  }

  if (slot.entryKind === 'item') {
    return {
      slotId: slot.slotId,
      slotIndex: slot.order,
      kind: 'item',
      refId: slot.itemId ?? null,
      itemInstanceId: slot.itemInstanceId ?? null,
      weaponInstanceId: null,
    };
  }

  if (slot.entryKind === 'weapon') {
    return {
      slotId: slot.slotId,
      slotIndex: slot.order,
      kind: 'weapon',
      refId: slot.weaponItemId ?? slot.itemId ?? null,
      itemInstanceId: slot.weaponInstanceId ?? slot.itemInstanceId ?? null,
      weaponInstanceId: slot.weaponInstanceId ?? slot.itemInstanceId ?? null,
    };
  }

  return {
    slotId: slot.slotId,
    slotIndex: slot.order,
    kind: null,
    refId: null,
    itemInstanceId: null,
    weaponInstanceId: null,
  };
}

function actionBarToActionSlots(slots: CharacterActionBarSlot[]): CharacterActionSlot[] {
  const base = createEmptyActionSlots();
  for (const slot of slots) {
    const slotIndex = typeof slot.order === 'number' ? slot.order : Number(slot.slotId.replace('quick', '')) - 1;
    if (slotIndex < 0 || slotIndex >= base.length) {
      continue;
    }
    base[slotIndex] = actionBarSlotToActionSlot({ ...slot, order: slotIndex });
  }
  return base;
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

type GodmodeTravelRequest = {
  mode: 'world' | 'city' | 'location' | 'mine';
  targetId?: string | null;
  mineAction?: 'open' | 'close' | 'finish';
  mineResult?: 'escaped' | 'retreated' | 'failed' | 'dead';
  token: number;
};

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
  characterPageFocus: CharacterPageFocus,
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
    switch (characterPageFocus) {
      case 'character':
        return '/character';
      case 'stats':
        return '/stats';
      case 'skills':
        return '/skills';
      case 'equipment':
        return '/equipment';
      case 'inventory':
      default:
        return '/inventory';
    }
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
  const [activeTrainerNpcId, setActiveTrainerNpcId] = useState<string | null>(null);
  const [activeTrainerNpcName, setActiveTrainerNpcName] = useState<string | null>(null);
  const [activeTrainerSkillIds, setActiveTrainerSkillIds] = useState<unknown>(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const travelStaminaSyncTimeoutRef = useRef<number | null>(null);

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
  const [selectedCombatSkillId, setSelectedCombatSkillId] = useState<string | null>(null);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [npcTemplates, setNpcTemplates] = useState<ArenaNpcTemplate[]>([]);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);

  const [playerAvatarUrl, setPlayerAvatarUrl] = useState<string>('');
  const [selectedBattleMapId, setSelectedBattleMapId] = useState<string>(() => DEFAULT_BATTLE_MAP_ID);
  const [battleRenderer, setBattleRenderer] = useState<BattleRendererKind>(() => readBattleRendererSetting());
  const [pendingArenaBattleMapId, setPendingArenaBattleMapId] = useState<string | null>(null);

  const [character, setCharacter] = useState<ArenaCharacter | null>(null);
  const [inventory, setInventory] = useState<InventoryState>({ gold: 0, items: [] });
  const [equipment, setEquipment] = useState<Equipment>({ ...EMPTY_EQUIPMENT });
  const [actionSlots, setActionSlots] = useState<CharacterActionSlot[]>(() => createEmptyActionSlots());
  const [runtimeInventoryRevision, setRuntimeInventoryRevision] = useState(0);
  const [godmodeTravelRequest, setGodmodeTravelRequest] = useState<GodmodeTravelRequest | null>(null);

  const [combatId, setCombatId] = useState<string | null>(null);
  const [playerCombatId, setPlayerCombatId] = useState<string | null>(null);
  const [combatState, setCombatState] = useState<ArenaBattleState | null>(null);
  const [isBattleWindowOpen, setBattleWindowOpen] = useState(false);
  const [battleSummary, setBattleSummary] = useState<BattleSummary | null>(null);
  const [combatRoutePending, setCombatRoutePending] = useState(false);

  const [pendingStatAllocation, setPendingStatAllocation] = useState<StatAllocation>({});
  const [allocatingStats, setAllocatingStats] = useState(false);
  const [runtimeAdminItems, setRuntimeAdminItems] = useState<AdminItem[]>([]);
  const [runtimeAdminMerchants, setRuntimeAdminMerchants] = useState<AdminMerchant[]>([]);
  const [runtimeAdminSkills, setRuntimeAdminSkills] = useState<AdminSkill[]>([]);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [characterSkills, setCharacterSkills] = useState<CharacterSkillRow[]>([]);
  const [skillLoadout, setSkillLoadout] = useState<CharacterSkillLoadout | null>(null);

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
  const worldInventory = useMemo(
    () => mergeInventoryWithRuntimeOverlay(inventory),
    [inventory, runtimeInventoryRevision],
  );
  const isGodmodeAccount = accountId !== null && login.trim().toLowerCase() === GODMODE_LOGIN;

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
  const resolveSkillIcon = useCallback(
    (skill: AdminSkillDefinition | null | undefined) => {
      const raw = skill?.iconUrl?.trim();
      if (!raw) return undefined;
      return resolveStoredImageSource(raw, runtimeImages) ?? raw;
    },
    [runtimeImages],
  );
  const resolveMerchantImage = useCallback(
    (merchant: AdminMerchant | null | undefined) => resolveMerchantImageSource(merchant, runtimeImages),
    [runtimeImages],
  );
  const enabledRuntimeMerchants = useMemo(
    () => runtimeAdminMerchants.filter((merchant) => merchant.isEnabled),
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
  const selectedMerchantAllowedSellItemIds = useMemo(() => {
    if (!selectedAdminMerchant?.materialTradingEnabled) {
      return undefined;
    }

    return (selectedAdminMerchant.materialTrades ?? [])
      .filter((entry) => entry.isEnabled && entry.buys)
      .map((entry) => `mat_${entry.materialId.replace(/[^a-zA-Z0-9_]/g, '_')}`);
  }, [selectedAdminMerchant]);
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
    () => getPlayerRouteFromState(phase, overlayPanel, isBattleWindowOpen, combatRoutePending, characterPageFocus),
    [characterPageFocus, combatRoutePending, isBattleWindowOpen, overlayPanel, phase],
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
  const activeCombatMapImageUrl = useMemo(
    () => resolveStoredImageSource(activeCombatBattleMap.imageUrl, runtimeImages) ?? activeCombatBattleMap.imageUrl,
    [activeCombatBattleMap.imageUrl, runtimeImages],
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
        setRuntimeAdminSkills(content.skills);
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

  const refreshCharacterSkills = useCallback(async (characterId: string) => {
    const [skills, loadout, actionSlotResult] = await Promise.allSettled([
      getCharacterSkills(characterId),
      getSkillLoadout(characterId),
      getCharacterActionBar(characterId),
    ]);

    if (skills.status === 'fulfilled') {
      setCharacterSkills(skills.value);
    } else {
      console.warn('[skills] Failed to load character skills. Falling back to empty list.', skills.reason);
      setCharacterSkills([]);
    }

    if (loadout.status === 'fulfilled') {
      setSkillLoadout(loadout.value);
    } else {
      console.warn('[skills] Failed to load character loadout. Falling back to default slots.', loadout.reason);
      setSkillLoadout(createEmptySkillLoadout(characterId));
    }

    if (actionSlotResult.status === 'fulfilled') {
      console.info('[actionBar] load', { characterId, slots: actionSlotResult.value });
      setActionSlots(actionBarToActionSlots(actionSlotResult.value));
    } else {
      console.warn('[actionBar] reject', { characterId, result: 'load-failed', reason: actionSlotResult.reason });
      setActionSlots(createEmptyActionSlots());
    }
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
      setCharacterSkills([]);
      setSkillLoadout(null);
      setSelectedCombatSkillId(null);
      window.localStorage.setItem(PLAYER_SKILLS_STORAGE_KEY, JSON.stringify([]));
      return;
    }

    void refreshCharacterSkills(character.id).catch(() => {
      setCharacterSkills([]);
      setSkillLoadout(null);
      setSelectedCombatSkillId(null);
    });
  }, [character?.id, refreshCharacterSkills]);

  useEffect(() => {
    const skillIds = characterSkills
      .map((entry) => entry.skillId)
      .filter((skillId) => typeof skillId === 'string' && skillId.trim().length > 0);
    window.localStorage.setItem(PLAYER_SKILLS_STORAGE_KEY, JSON.stringify(skillIds));
  }, [characterSkills]);

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
    let disposed = false;
    void loadBattleMapsFromStore()
      .then((maps) => {
        if (disposed) {
          return;
        }
        const savedBattleMapId = window.localStorage.getItem(SELECTED_BATTLE_MAP_STORAGE_KEY);
        if (savedBattleMapId && maps.some((map) => map.id === savedBattleMapId)) {
          setSelectedBattleMapId(savedBattleMapId);
          return;
        }
        setSelectedBattleMapId(maps[0]?.id ?? DEFAULT_BATTLE_MAP_ID);
      })
      .catch(() => {
        const maps = loadBattleMaps();
        const savedBattleMapId = window.localStorage.getItem(SELECTED_BATTLE_MAP_STORAGE_KEY);
        if (savedBattleMapId && maps.some((map) => map.id === savedBattleMapId)) {
          setSelectedBattleMapId(savedBattleMapId);
          return;
        }
        setSelectedBattleMapId(maps[0]?.id ?? DEFAULT_BATTLE_MAP_ID);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SELECTED_BATTLE_MAP_STORAGE_KEY, selectedBattleMapId);
  }, [selectedBattleMapId]);

  useEffect(() => {
    writeBattleRendererSetting(battleRenderer);
  }, [battleRenderer]);

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
    if (!character?.id) {
      return;
    }

    savePlayerProfessionsState(character.id, normalizePlayerProfessionsState(character.professions));
  }, [character?.id, character?.professions]);

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

    if (requestedPlayerRoute === '/character') {
      if (isBattleWindowOpen) {
        setBattleWindowOpen(false);
      }
      setCharacterPageFocus('character');
      setOverlayPanel('character');
      return;
    }

    if (requestedPlayerRoute === '/stats') {
      if (isBattleWindowOpen) {
        setBattleWindowOpen(false);
      }
      setCharacterPageFocus('stats');
      setOverlayPanel('character');
      return;
    }

    if (requestedPlayerRoute === '/skills') {
      if (isBattleWindowOpen) {
        setBattleWindowOpen(false);
      }
      setCharacterPageFocus('skills');
      setOverlayPanel('character');
      return;
    }

    if (requestedPlayerRoute === '/equipment') {
      if (isBattleWindowOpen) {
        setBattleWindowOpen(false);
      }
      setCharacterPageFocus('equipment');
      setOverlayPanel('character');
      return;
    }

    if (requestedPlayerRoute === '/journal') {
      // Journal is handled within WorldMapScreen
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
    const normalizedHubProfessions = normalizePlayerProfessionsState(hub.character.professions);
    const storedProfessions = loadPlayerProfessionsState(hub.character.id);
    const mergedProfessions = mergePlayerProfessionsState(normalizedHubProfessions, storedProfessions);

    setCharacter({
      ...hub.character,
      professions: mergedProfessions,
    });
    savePlayerProfessionsState(hub.character.id, mergedProfessions);
    setInventory(hub.inventory);
    setEquipment(hub.equipment);
    setActionSlots(hub.actionSlots ?? createEmptyActionSlots());
    const profile = loadCharacterProfile(hub.character.id);
    if (profile?.avatarUrl) {
      setPlayerAvatarUrl(profile.avatarUrl);
      window.localStorage.setItem(`${PLAYER_AVATAR_STORAGE_PREFIX}.${hub.character.id}`, profile.avatarUrl);
    }
    window.localStorage.setItem(LAST_CHARACTER_STORAGE_KEY, hub.character.id);
  }

  const handleRuntimeInventoryChanged = useCallback(() => {
    setRuntimeInventoryRevision((current) => current + 1);
  }, []);

  const handlePlayerProfessionsChange = useCallback((nextState: ArenaCharacter['professions']) => {
    const normalized = normalizePlayerProfessionsState(nextState);
    setCharacter((current) => {
      if (!current) {
        return current;
      }

      savePlayerProfessionsState(current.id, normalized);
      return {
        ...current,
        professions: normalized,
      };
    });
  }, []);

  const applyFullHealingService = useCallback(async (options?: { costGold?: number }) => {
    if (!character) {
      throw new Error('Create or load a character first.');
    }

    const costGold = Math.max(0, Math.floor(Number(options?.costGold ?? 0)));
    const runtimeGold = Math.max(0, readNumberStorage(PLAYER_GOLD_STORAGE_KEY, 0));
    const currentTotalGold = Math.max(0, inventory.gold + runtimeGold);

    if (currentTotalGold < costGold) {
      throw new Error('Недостаточно золота.');
    }

    await updateCharacterResources(character.id, {
      currentHp: character.maxHp,
    });

    const nextGold = currentTotalGold - costGold;
    writeNumberStorage(PLAYER_GOLD_STORAGE_KEY, 0);
    const hub = await patchDevCharacterState(character.id, { gold: nextGold });
    applyHubState(hub);
    handleRuntimeInventoryChanged();
  }, [character, handleRuntimeInventoryChanged, inventory.gold]);

  const refreshActiveCharacterHub = useCallback(async () => {
    if (!character) {
      return null;
    }

    const hub = await getArenaHubState(character.id);
    applyHubState(hub);
    return hub;
  }, [character]);

  async function finalizeAccountLogin(account: { id: string; login: string }): Promise<void> {
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
  }

  async function loginOrProvisionGodmodeAccount(): Promise<void> {
    try {
      const account = await loginAccount({ login: GODMODE_LOGIN, password: GODMODE_PASSWORD });
      await finalizeAccountLogin(account);
      return;
    } catch (error) {
      const message = (error as Error).message ?? '';
      if (!/invalid login or password/i.test(message)) {
        throw error;
      }
    }

    try {
      const account = await registerAccount({ login: GODMODE_LOGIN, password: GODMODE_PASSWORD });
      await finalizeAccountLogin(account);
    } catch (error) {
      const message = (error as Error).message ?? '';
      if (/already used/i.test(message) || /already exists/i.test(message)) {
        const account = await loginAccount({ login: GODMODE_LOGIN, password: GODMODE_PASSWORD });
        await finalizeAccountLogin(account);
        return;
      }
      throw error;
    }
  }

  async function onUseGodmodeAccount(): Promise<void> {
    setLogin(GODMODE_LOGIN);
    setPassword(GODMODE_PASSWORD);
    setStatus('Signing in as GODMODE...');

    try {
      await loginOrProvisionGodmodeAccount();
    } catch (error) {
      setStatus(`GODMODE login error: ${(error as Error).message}`);
    }
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
      if (login.trim().toLowerCase() === GODMODE_LOGIN && password === GODMODE_PASSWORD) {
        await loginOrProvisionGodmodeAccount();
        return;
      }

      const account = await loginAccount({ login, password });
      await finalizeAccountLogin(account);
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

  function openSkillsOverlay(trainerNpcId?: string, trainerSkillIds?: unknown, trainerNpcName?: string): void {
    onNavigate?.('/skills');
    setCharacterPageFocus('skills');
    setOverlayPanel('character');
    const resolvedTrainerId = trainerNpcId?.trim() ? trainerNpcId.trim() : null;
    const resolvedTrainerName = trainerNpcName?.trim() ? trainerNpcName.trim() : null;
    setActiveTrainerNpcId(resolvedTrainerId);
    setActiveTrainerNpcName(resolvedTrainerName);
    setActiveTrainerSkillIds(trainerSkillIds ?? null);

    console.debug('[App] skills mode set', {
      mode: resolvedTrainerId ? 'trainer' : 'character',
      activeTrainerNpcId: resolvedTrainerId,
      activeTrainerName: resolvedTrainerName,
      activeTrainerSkillIds: trainerSkillIds ?? null,
    });

    if (resolvedTrainerId) {
      void ensureNpcsLoaded()
        .then(() => getAllNpcs().find((npc) => npc.id === resolvedTrainerId) ?? null)
        .then((npc) => setActiveTrainerNpcName(resolvedTrainerName ?? npc?.name ?? resolvedTrainerId))
        .catch(() => setActiveTrainerNpcName(resolvedTrainerId));
    }

    const pendingRaw = window.localStorage.getItem(PENDING_SKILL_GRANT_KEY);
    if (pendingRaw) {
      window.localStorage.removeItem(PENDING_SKILL_GRANT_KEY);
      try {
        const pending = JSON.parse(pendingRaw) as { skillId?: unknown; sourceNpcId?: unknown };
        const pendingSkillId = typeof pending.skillId === 'string' ? pending.skillId.trim() : '';
        const pendingSourceNpcId = typeof pending.sourceNpcId === 'string' ? pending.sourceNpcId : undefined;
        if (pendingSkillId) {
          void handleGrantCharacterSkill(pendingSkillId, pendingSourceNpcId);
        }
      } catch {
        // Ignore malformed pending skill grant payload.
      }
    }

    setStatus('Открыта страница навыков.');
  }

  function openCharacterOverlay(): void {
    onNavigate?.('/character');
    setCharacterPageFocus('character');
    setOverlayPanel('character');
    setActiveTrainerNpcId(null);
    setActiveTrainerNpcName(null);
    setActiveTrainerSkillIds(null);
    setStatus('Открыта страница персонажа.');
  }

  const handleTravelStaminaChange = useCallback((nextStamina: number) => {
    if (!character) {
      return;
    }

    const clamped = Math.max(0, Math.min(character.maxStamina, Math.round(nextStamina)));
    setCharacter((current) => {
      if (!current || current.currentStamina === clamped) {
        return current;
      }

      return {
        ...current,
        currentStamina: clamped,
      };
    });

    if (typeof window === 'undefined') {
      return;
    }

    if (travelStaminaSyncTimeoutRef.current !== null) {
      window.clearTimeout(travelStaminaSyncTimeoutRef.current);
    }

    travelStaminaSyncTimeoutRef.current = window.setTimeout(() => {
      void updateCharacterResources(character.id, {
        currentStamina: clamped,
      }).catch((error) => {
        console.warn('Failed to sync travel stamina:', error);
      });
      travelStaminaSyncTimeoutRef.current = null;
    }, 250);
  }, [character]);

  function openEquipmentOverlay(): void {
    onNavigate?.('/equipment');
    setCharacterPageFocus('equipment');
    setOverlayPanel('character');
    setActiveTrainerNpcId(null);
    setActiveTrainerNpcName(null);
    setActiveTrainerSkillIds(null);
    setStatus('Открыта страница экипировки.');
  }

  function changeCharacterOverlayFocus(nextFocus: CharacterPageFocus): void {
    switch (nextFocus) {
      case 'character':
        openCharacterOverlay();
        return;
      case 'inventory':
        onNavigate?.('/inventory');
        setCharacterPageFocus('inventory');
        setOverlayPanel('character');
        setActiveTrainerNpcId(null);
        setActiveTrainerNpcName(null);
        setActiveTrainerSkillIds(null);
        setStatus('Открыт инвентарь.');
        return;
      case 'stats':
        onNavigate?.('/stats');
        setCharacterPageFocus('stats');
        setOverlayPanel('character');
        setActiveTrainerNpcId(null);
        setActiveTrainerNpcName(null);
        setActiveTrainerSkillIds(null);
        setStatus('Открыта страница статов.');
        return;
      case 'skills':
        openSkillsOverlay();
        return;
      case 'equipment':
        openEquipmentOverlay();
        return;
      default:
        return;
    }
  }

  function openArenaOverlay(): void {
    setOverlayPanel('arena');
    setStatus('Открыта арена. Настройте NPC и начинайте бой. Tactical Battle Map Editor доступен в боковой панели карты мира.');
  }

  function openArenaSetup(battleMapId: string): void {
    setPendingArenaBattleMapId(battleMapId);
    setOverlayPanel('arena');
    setStatus('Арена готова. Выберите формат боя.');
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

  const battleSkillOptions = useMemo(() => {
    const bySkillId = new Map(characterSkills.map((entry) => [entry.skillId, entry]));
    return actionSlots
      .filter((slot) => slot.kind === 'skill' && Boolean(slot.refId))
      .map((slot) => {
        const skillId = slot.refId as string;
        const row = bySkillId.get(skillId) ?? null;
        const definition = row?.definition ?? runtimeAdminSkills.find((skill) => skill.id === skillId) ?? null;
        if (!definition || definition.isActive === false || definition.isPassive || !definition.isPublished || definition.isHidden) {
          return null;
        }
        return {
          slotIndex: slot.slotIndex,
          skillId,
          level: row?.level ?? 1,
          label: definition.name || skillId,
          definition,
        };
      })
      .filter((entry, index, list): entry is { slotIndex: number; skillId: string; level: number; label: string; definition: AdminSkillDefinition } => Boolean(entry)
        && list.findIndex((candidate) => candidate?.slotIndex === entry?.slotIndex) === index);
  }, [actionSlots, characterSkills, runtimeAdminSkills]);

  useEffect(() => {
    if (selectedCombatSkillId && battleSkillOptions.some((entry) => entry.skillId === selectedCombatSkillId)) {
      return;
    }
    setSelectedCombatSkillId(null);
  }, [battleSkillOptions, selectedCombatSkillId]);

  const handleLearnCharacterSkill = useCallback(async (skillId: string) => {
    if (!character) {
      return;
    }

    const learned = await learnSkill(character.id, {
      skillId,
      sourceType: 'teacher',
      sourceId: activeTrainerNpcId ?? undefined,
    });
    const refreshedHub = await getArenaHubState(character.id);
    applyHubState(refreshedHub);
    await refreshCharacterSkills(character.id);
    setStatus(`Изучен навык: ${learned.definition?.name ?? learned.skillId}`);
  }, [activeTrainerNpcId, character, refreshCharacterSkills]);

  const handleGrantCharacterSkill = useCallback(async (skillId: string, sourceNpcId?: string) => {
    if (!character) {
      return;
    }

    const normalizedInputSkillId = String(skillId).trim();
    const resolvedSkillId = runtimeAdminSkills.find((entry) => entry.id === normalizedInputSkillId)?.id
      ?? runtimeAdminSkills.find((entry) => entry.id.toLowerCase() === normalizedInputSkillId.toLowerCase())?.id
      ?? normalizedInputSkillId;

    const granted = await grantSkill(character.id, {
      skillId: resolvedSkillId,
      sourceType: 'dialogue',
      sourceId: sourceNpcId,
    });
    await refreshCharacterSkills(character.id);
    setStatus(`Получен навык: ${granted.definition?.name ?? granted.skillId}`);
  }, [character, refreshCharacterSkills, runtimeAdminSkills]);

  const handleSaveCharacterSkillLoadout = useCallback(async (slots: Array<{ slotIndex: number; skillId: string | null }>) => {
    if (!character) {
      return;
    }

    const nextLoadout = await updateSkillLoadout(character.id, slots);
    setSkillLoadout(nextLoadout);
    setStatus('Боевой loadout сохранён.');
  }, [character]);

  const handleSaveCharacterHotbar = useCallback(async (slots: Array<{ slotIndex: number; itemId: string | null; itemInstanceId?: string | null }>) => {
    if (!character) {
      return;
    }

    console.info('[hotbar] save', { characterId: character.id, slots });
    const nextHotbar = await updateCharacterHotbar(character.id, slots);
    setActionSlots((current) => current.map((slot) => {
      const update = nextHotbar.find((entry) => entry.slotIndex === slot.slotIndex);
      if (!update) {
        return slot;
      }
      return update.itemId
        ? { slotId: slot.slotId, slotIndex: update.slotIndex, kind: 'item' as const, refId: update.itemId, itemInstanceId: update.itemInstanceId ?? null }
        : { slotId: slot.slotId, slotIndex: update.slotIndex, kind: null, refId: null, itemInstanceId: null };
    }));
    setStatus('Быстрые слоты сохранены.');
  }, [character]);

  const handleSaveCharacterActionSlots = useCallback(async (slots: Array<{ slotId: CharacterActionBarSlot['slotId']; order?: number; entryKind: 'skill' | 'item' | 'weapon' | 'empty'; skillId?: string; itemId?: string; itemInstanceId?: string | null; weaponItemId?: string; weaponInstanceId?: string | null }>) => {
    if (!character) {
      return;
    }

    console.info('[actionBar] save', { characterId: character.id, slots });
    const nextSlots = await updateCharacterActionBar(character.id, slots);
    setActionSlots(actionBarToActionSlots(nextSlots));
    setStatus('Action-bar сохранён.');
  }, [character]);

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

  function buildGeneratedArenaEnemy(index: number): CustomArenaNpcPayload {
    const stats = character?.activeStats ?? DEFAULT_NPC_STATS;
    const vary = (value: number) => Math.max(1, Math.round(value * (0.8 + Math.random() * 0.4)));
    return {
      name: `Random Arena Enemy ${index}`,
      race: character?.race ?? Race.Human,
      stats: {
        hp: vary(stats.hp),
        mp: vary(stats.mp),
        stamina: vary(stats.stamina),
        strength: vary(stats.strength),
        constitution: vary(stats.constitution),
        dexterity: vary(stats.dexterity),
        intelligence: vary(stats.intelligence),
        luck: vary(stats.luck),
        perception: vary(stats.perception),
        willpower: vary(stats.willpower),
      },
      equipment: {},
    };
  }

  async function openCombat(battleMapIdOverride?: string, options?: { enemyCount?: number; customEnemies?: CustomArenaNpcPayload[] }): Promise<void> {
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
      const battleMapPayload = toRuntimeBattleMapPayload(battleMapIdOverride ? resolveBattleMapForCombat(battleMapIdOverride) : selectedBattleMap);
      const customEnemies = options?.customEnemies ?? (activeArenaNpcs.length > 0 ? activeArenaNpcs.map(toCustomNpcPayload) : null);
      const normalizedCustomEnemies = customEnemies?.slice(0, MAX_COMBAT_ENEMIES) ?? null;
      const started = normalizedCustomEnemies && normalizedCustomEnemies.length > 0
        ? await startCustomCombat(character.id, normalizedCustomEnemies, battleMapPayload)
        : await startCombat(character.id, Math.max(1, Math.min(MAX_COMBAT_ENEMIES, options?.enemyCount ?? 3)), battleMapPayload);
      setOverlayPanel(null);
      setCombatId(started.combatId);
      setPlayerCombatId(started.playerId);
      setCombatState(started.state);
      setBattleWindowOpen(true);
      setStatus(normalizedCustomEnemies && normalizedCustomEnemies.length > 0 ? `Battle started against ${normalizedCustomEnemies.length} arena NPC.` : 'Battle started.');
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
    try {
      if (!character) {
        setStatus('Character is not selected.');
        return;
      }

      const updatedHub = await useArenaItem(character.id, itemId);
      applyHubState(updatedHub);
      setStatus(`${resolveItem(itemId).name} used.`);
    } catch (error) {
      setStatus(`Consumable error: ${(error as Error).message}`);
    }
  }

  async function handleUseSkillOutOfCombat(skillId: string): Promise<void> {
    try {
      if (!character) {
        setStatus('Character is not selected.');
        return;
      }

      const result = await useSkillOutOfCombat(character.id, skillId);
      const updatedHub = await getArenaHubState(character.id);
      applyHubState(updatedHub);
      setStatus(result.message || 'Skill used.');
    } catch (error) {
      setStatus(`Skill use error: ${(error as Error).message}`);
      throw error;
    }
  }

  const executeGodmodeCommand = useCallback(async (commandLine: string): Promise<GodmodeConsoleResult> => {
    if (!isGodmodeAccount) {
      return {
        ok: false,
        lines: ['GODMODE console is available only for the godmod account.'],
      };
    }

    const tokens = normalizeGodmodeCommandTokens(commandLine);
    if (tokens.length === 0) {
      return { ok: true, lines: [] };
    }

    const [headRaw, actionRaw, ...rest] = tokens;
    const head = headRaw.toLowerCase();
    const action = actionRaw?.toLowerCase();

    const requireCharacter = (): ArenaCharacter => {
      if (!character) {
        throw new Error('Create or load a character first.');
      }
      return character;
    };

    const applyHubAndRefresh = async (hub: ArenaHubState): Promise<ArenaHubState> => {
      applyHubState(hub);
      handleRuntimeInventoryChanged();
      return hub;
    };

    const syncRuntimeGoldIntoBackend = async (player: ArenaCharacter, nextTotalGold: number): Promise<ArenaHubState> => {
      writeNumberStorage(PLAYER_GOLD_STORAGE_KEY, 0);
      const hub = await patchDevCharacterState(player.id, { gold: Math.max(0, Math.floor(nextTotalGold)) });
      return applyHubAndRefresh(hub);
    };

    const adjustIdArrayStorage = (
      storageKey: string,
      id: string,
      delta: number,
    ): number => {
      const normalizedId = id.trim();
      if (!normalizedId) {
        throw new Error('ID is required.');
      }

      const safeDelta = Math.trunc(delta);
      if (safeDelta === 0) {
        return 0;
      }

      const current = readStringArrayStorage(storageKey);
      if (safeDelta > 0) {
        writeStringArrayStorage(storageKey, [...current, ...Array.from({ length: safeDelta }, () => normalizedId)]);
        return safeDelta;
      }

      let removed = 0;
      const remaining = current.filter((entry) => {
        if (entry === normalizedId && removed < Math.abs(safeDelta)) {
          removed += 1;
          return false;
        }
        return true;
      });
      writeStringArrayStorage(storageKey, remaining);
      return -removed;
    };

    const adjustCountRecordStorage = (
      storageKey: string,
      id: string,
      delta: number,
    ): number => {
      const normalizedId = id.trim();
      if (!normalizedId) {
        throw new Error('ID is required.');
      }

      const safeDelta = Math.trunc(delta);
      if (safeDelta === 0) {
        return 0;
      }

      const current = readStringNumberRecordStorage(storageKey);
      const previousValue = current[normalizedId] ?? 0;
      const nextValue = Math.max(0, previousValue + safeDelta);
      if (nextValue <= 0) {
        delete current[normalizedId];
      } else {
        current[normalizedId] = nextValue;
      }
      writeStringNumberRecordStorage(storageKey, current);
      return safeDelta > 0 ? safeDelta : -Math.min(Math.abs(safeDelta), previousValue);
    };

    const queueTravelRequest = (mode: GodmodeTravelRequest['mode'], targetId?: string | null): void => {
      onNavigate?.('/map');
      setOverlayPanel(null);
      setGodmodeTravelRequest({
        mode,
        targetId: targetId ?? null,
        token: Date.now(),
      });
    };

    const queueMineRequest = (
      mineAction: NonNullable<GodmodeTravelRequest['mineAction']>,
      mineId?: string | null,
      mineResult?: GodmodeTravelRequest['mineResult'],
    ): void => {
      onNavigate?.('/map');
      setOverlayPanel(null);
      setGodmodeTravelRequest({
        mode: 'mine',
        targetId: mineId ?? null,
        mineAction,
        mineResult,
        token: Date.now(),
      });
    };

    const saveProfessionState = async (
      player: ArenaCharacter,
      nextProfessions: PlayerProfessionsState,
    ): Promise<ArenaHubState> => {
      const hub = await patchDevCharacterState(player.id, { professions: nextProfessions });
      return applyHubAndRefresh(hub);
    };

    try {
      if (head === 'help') {
        return { ok: true, lines: getGodmodeHelpLines() };
      }

      if (head === 'state') {
        const player = character;
        const questStates = player ? getAllPlayerQuestStates().filter((entry) => entry.playerId === player.id) : [];
        const runtimeItems = readStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY);
        const runtimeQuestItems = readStringArrayStorage(PLAYER_QUEST_ITEMS_STORAGE_KEY);
        const materials = readStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY);
        const resources = readStringNumberRecordStorage(PLAYER_RESOURCES_STORAGE_KEY);

        return {
          ok: true,
          lines: [
            `Account: ${login || '—'}`,
            `Character: ${player?.name ?? '—'} (${player?.id ?? 'no-character'})`,
            `Gold: base=${inventory.gold} overlay=${readNumberStorage(PLAYER_GOLD_STORAGE_KEY, 0)} total=${inventory.gold + readNumberStorage(PLAYER_GOLD_STORAGE_KEY, 0)}`,
            `Level=${player?.level ?? 0}, XP=${player?.exp ?? 0}, FreePoints=${player?.freePoints ?? 0}`,
            `Runtime items=${runtimeItems.length}, questItems=${runtimeQuestItems.length}, quests=${questStates.length}`,
            `Known skills=${characterSkills.length}, materials=${Object.keys(materials).length}, resources=${Object.keys(resources).length}`,
            `Tutorial: ${GODMODE_TUTORIAL_PATH}`,
          ],
        };
      }

      if (head === 'list') {
        const scope = action;
        const filter = rest.join(' ').trim();

        if (scope === 'items' || scope === 'item') {
          const byId = new Map<string, { id: string; name: string; type: string; subtype: string; enabled: boolean }>();
          for (const item of Object.values(ITEMS)) {
            byId.set(item.id, {
              id: item.id,
              name: item.name,
              type: item.itemType,
              subtype: item.itemSubType,
              enabled: true,
            });
          }
          for (const item of runtimeAdminItems) {
            byId.set(item.id, {
              id: item.id,
              name: item.name,
              type: item.type,
              subtype: item.subtype ?? item.slot ?? '—',
              enabled: item.isEnabled,
            });
          }
          const lines = Array.from(byId.values())
            .filter((item) => matchesGodmodeFilter(filter, item.id, item.name, item.type, item.subtype))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((item) => `${item.id} — ${item.name} [${item.type}/${item.subtype}] ${item.enabled ? 'enabled' : 'disabled'}`);
          return { ok: true, lines: formatGodmodeListLines('Items', lines, filter) };
        }

        if (scope === 'skills' || scope === 'skill') {
          const skillEntries = runtimeAdminSkills.map((skill) => ({ ...skill, school: skill.type, category: skill.subtypes.join(',') || 'base' }));
          const lines = skillEntries
            .filter((skill) => matchesGodmodeFilter(filter, skill.id, skill.name, skill.type, skill.subtypes.join(',')))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((skill) => `${skill.id} — ${skill.name} [${skill.school}/${skill.category}] ${skill.isPublished ? 'published' : 'draft'}${skill.isPassive ? ' passive' : ''}`);
          return { ok: true, lines: formatGodmodeListLines('Skills', lines, filter) };
        }

        if (scope === 'quests' || scope === 'quest') {
          await ensureQuestsLoaded();
          const lines = getAllQuests()
            .filter((quest) => matchesGodmodeFilter(filter, quest.id, quest.title, quest.status, quest.category))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((quest) => `${quest.id} — ${quest.title} [${quest.status}/${quest.category ?? 'general'}]`);
          return { ok: true, lines: formatGodmodeListLines('Quests', lines, filter) };
        }

        if (scope === 'npcs' || scope === 'npc') {
          await ensureNpcsLoaded();
          const lines = getAllNpcs()
            .filter((npc) => matchesGodmodeFilter(filter, npc.id, npc.name, npc.status, npc.kind, npc.race))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((npc) => `${npc.id} — ${npc.name} [${npc.status}/${npc.kind}/${npc.race}]`);
          return { ok: true, lines: formatGodmodeListLines('NPCs', lines, filter) };
        }

        if (scope === 'dialogues' || scope === 'dialogue') {
          await ensureDialoguesLoaded();
          const lines = getAllDialogues()
            .filter((dialogue) => matchesGodmodeFilter(filter, dialogue.id, dialogue.title, dialogue.status, dialogue.npcId))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((dialogue) => `${dialogue.id} — ${dialogue.title} [${dialogue.status}] npc=${dialogue.npcId ?? '—'}`);
          return { ok: true, lines: formatGodmodeListLines('Dialogues', lines, filter) };
        }

        if (scope === 'merchants' || scope === 'merchant') {
          const lines = runtimeAdminMerchants
            .filter((merchant) => matchesGodmodeFilter(filter, merchant.id, merchant.name, merchant.type, merchant.city, merchant.location))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((merchant) => `${merchant.id} — ${merchant.name} [${merchant.type}] items=${merchant.items.length} ${merchant.isEnabled ? 'enabled' : 'disabled'}`);
          return { ok: true, lines: formatGodmodeListLines('Merchants', lines, filter) };
        }

        if (scope === 'cities' || scope === 'city') {
          const cities = await cityService.getCities();
          const lines = cities
            .filter((city) => matchesGodmodeFilter(filter, city.id, city.name, city.regionId, city.status))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((city) => `${city.id} — ${city.name} [${city.status}] region=${city.regionId ?? '—'}`);
          return { ok: true, lines: formatGodmodeListLines('Cities', lines, filter) };
        }

        if (scope === 'locations' || scope === 'location') {
          const locations = await locationService.getLocations();
          const lines = locations
            .filter((location) => matchesGodmodeFilter(filter, location.id, location.name, location.status, location.subtype, location.regionId))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((location) => `${location.id} — ${location.name} [${location.status}/${location.subtype ?? 'location'}] state=${location.currentState ?? 'default'}`);
          return { ok: true, lines: formatGodmodeListLines('Locations', lines, filter) };
        }

        if (scope === 'battlemaps' || scope === 'battlemap') {
          const maps = await loadBattleMapsFromStore();
          const lines = maps
            .filter((map) => matchesGodmodeFilter(filter, map.id, map.name, map.description))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((map) => `${map.id} — ${map.name} [${map.width}x${map.height}]${map.id === selectedBattleMapId ? ' (selected)' : ''}`);
          return { ok: true, lines: formatGodmodeListLines('Battle maps', lines, filter) };
        }

        if (scope === 'itemsets' || scope === 'itemset') {
          const sets = await itemSetsService.getAll();
          const lines = sets
            .filter((set) => matchesGodmodeFilter(filter, set.id, set.name, set.gameplayDescription, set.loreDescription))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((set) => `${set.id} — ${set.name} [pieces=${set.pieceItemIds.length}] ${set.isEnabled ? 'enabled' : 'disabled'}`);
          return { ok: true, lines: formatGodmodeListLines('Item sets', lines, filter) };
        }

        if (scope === 'materials' || scope === 'material') {
          const materials = await materialsService.getAll();
          const lines = materials
            .filter((material) => matchesGodmodeFilter(filter, material.id, material.name, material.category, material.region))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((material) => `${material.id} — ${material.name} [${material.category}/${material.rarity}] region=${material.region}`);
          return { ok: true, lines: formatGodmodeListLines('Materials', lines, filter) };
        }

        throw new Error('Use: list items|skills|quests|npcs|dialogues|merchants|cities|locations|battlemaps|itemsets|materials [filter].');
      }

      if (head === 'teleport' || head === 'tp') {
        const scope = action;
        if (scope === 'world') {
          queueTravelRequest('world');
          setStatus('GODMODE: returning to world map.');
          return { ok: true, lines: ['Travel request queued: world map.'] };
        }

        const targetId = String(rest[0] ?? '').trim();
        if (scope === 'city') {
          if (!targetId) {
            throw new Error('Use: teleport city <cityId>.');
          }
          const city = await cityService.getCityById(targetId);
          if (!city) {
            throw new Error(`City not found: ${targetId}`);
          }
          queueTravelRequest('city', city.id);
          setStatus(`GODMODE: teleport queued to city ${city.name}.`);
          return { ok: true, lines: [`Travel request queued: city ${city.id} (${city.name}).`] };
        }

        if (scope === 'location') {
          if (!targetId) {
            throw new Error('Use: teleport location <locationId>.');
          }
          const location = await locationService.getLocationById(targetId);
          if (!location) {
            throw new Error(`Location not found: ${targetId}`);
          }
          queueTravelRequest('location', location.id);
          setStatus(`GODMODE: teleport queued to location ${location.name}.`);
          return { ok: true, lines: [`Travel request queued: location ${location.id} (${location.name}).`] };
        }

        throw new Error('Use: teleport world OR teleport city <cityId> OR teleport location <locationId>.');
      }

      if (head === 'panel') {
        if (action === 'close') {
          setOverlayPanel(null);
          onNavigate?.('/map');
          return { ok: true, lines: ['Closed active panel.'] };
        }

        if (action !== 'open') {
          throw new Error('Use: panel open <inventory|character|stats|skills|equipment|merchant|arena|map> OR panel close.');
        }

        const panelName = String(rest[0] ?? '').trim().toLowerCase();
        const panelTargetId = String(rest[1] ?? '').trim();

        if (panelName === 'inventory') {
          changeCharacterOverlayFocus('inventory');
          return { ok: true, lines: ['Opened inventory panel.'] };
        }
        if (panelName === 'character') {
          changeCharacterOverlayFocus('character');
          return { ok: true, lines: ['Opened character panel.'] };
        }
        if (panelName === 'stats') {
          changeCharacterOverlayFocus('stats');
          return { ok: true, lines: ['Opened stats panel.'] };
        }
        if (panelName === 'skills') {
          openSkillsOverlay();
          return { ok: true, lines: ['Opened skills panel.'] };
        }
        if (panelName === 'equipment') {
          openEquipmentOverlay();
          return { ok: true, lines: ['Opened equipment panel.'] };
        }
        if (panelName === 'merchant') {
          if (!panelTargetId && runtimeMerchants.length === 0) {
            throw new Error('No merchants are loaded.');
          }
          if (panelTargetId && !runtimeMerchants.some((merchant) => merchant.id === panelTargetId)) {
            throw new Error(`Merchant not found: ${panelTargetId}`);
          }
          openMerchantOverlay(panelTargetId || undefined);
          return { ok: true, lines: [`Opened merchant panel${panelTargetId ? ` for ${panelTargetId}` : ''}.`] };
        }
        if (panelName === 'arena') {
          openArenaOverlay();
          return { ok: true, lines: ['Opened arena setup panel.'] };
        }
        if (panelName === 'map' || panelName === 'world') {
          setOverlayPanel(null);
          onNavigate?.('/map');
          return { ok: true, lines: ['Switched to world map view.'] };
        }

        throw new Error('Unknown panel. Use: inventory|character|stats|skills|equipment|merchant|arena|map.');
      }

      if (head === 'gold') {
        const player = requireCharacter();
        const amount = parseConsoleInteger(rest[0], 'Amount');
        const currentTotal = Math.max(0, inventory.gold + readNumberStorage(PLAYER_GOLD_STORAGE_KEY, 0));
        const nextTotal = action === 'set'
          ? amount
          : currentTotal + amount;
        const hub = await syncRuntimeGoldIntoBackend(player, nextTotal);
        setStatus(`GODMODE gold updated: ${hub.inventory.gold}`);
        return { ok: true, lines: [`Gold set to ${hub.inventory.gold}.`] };
      }

      if (head === 'xp' || head === 'experience') {
        const player = requireCharacter();
        const amount = parseConsoleInteger(rest[0], 'Amount');
        const nextExp = action === 'set'
          ? amount
          : player.exp + amount;
        const hub = await applyHubAndRefresh(await patchDevCharacterState(player.id, { exp: Math.max(0, nextExp) }));
        setStatus(`GODMODE XP updated: ${hub.character.exp}`);
        return { ok: true, lines: [`Experience set to ${hub.character.exp}.`] };
      }

      if (head === 'level') {
        const player = requireCharacter();
        const value = parseConsoleInteger(rest[0], 'Level');
        const hub = await applyHubAndRefresh(await patchDevCharacterState(player.id, { level: Math.max(0, value) }));
        setStatus(`GODMODE level updated: ${hub.character.level}`);
        return { ok: true, lines: [`Level set to ${hub.character.level}.`] };
      }

      if (head === 'points') {
        const player = requireCharacter();
        const amount = parseConsoleInteger(rest[0], 'Points');
        const nextFreePoints = action === 'set'
          ? amount
          : player.freePoints + amount;
        const hub = await applyHubAndRefresh(await patchDevCharacterState(player.id, { freePoints: Math.max(0, nextFreePoints) }));
        setStatus(`GODMODE free points updated: ${hub.character.freePoints}`);
        return { ok: true, lines: [`Free points set to ${hub.character.freePoints}.`] };
      }

      if (head === 'profession' || head === 'prof') {
        const player = requireCharacter();
        const professionScope = action;
        const professionId = String(rest[1] ?? rest[0] ?? 'mining').trim().toLowerCase();
        const professionDefinition = PROFESSION_DEFINITIONS.find((entry) => entry.id === professionId) ?? null;
        const currentProfessions = normalizePlayerProfessionsState(player.professions);

        const writeProfessions = async (nextProfessions: PlayerProfessionsState): Promise<ArenaHubState> => {
          const hub = await saveProfessionState(player, nextProfessions);
          setStatus(`GODMODE profession updated: ${professionId}`);
          return hub;
        };

        if (professionScope === 'list') {
          const skillDefinitions = loadProfessionSkillsFromStorage();
          const branchDefinitions = loadProfessionBranchesFromStorage();
          const lines = PROFESSION_DEFINITIONS
            .slice()
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((definition) => {
              const state = getPlayerProfession(currentProfessions, definition.id);
              const branchCount = branchDefinitions.filter((entry) => entry.professionId === definition.id && entry.isEnabled).length;
              const skillCount = skillDefinitions.filter((entry) => entry.professionId === definition.id && entry.isEnabled).length;
              return `${definition.id} — ${definition.name} [${definition.category}] ${state ? `unlocked L${state.level} XP ${state.xp}/${state.xpToNextLevel} points ${state.skillPoints}` : 'locked'} skills=${skillCount} branches=${branchCount}`;
            });
          return { ok: true, lines: formatGodmodeListLines('Professions', lines) };
        }

        if (professionScope === 'unlock') {
          if (!professionDefinition) {
            throw new Error(`Unknown profession: ${professionId}`);
          }
          const next = unlockProfession(currentProfessions, professionDefinition.id);
          const hub = await writeProfessions(next);
          return { ok: true, lines: [`Unlocked profession ${professionDefinition.name}.`, `Learned professions: ${hub.character.professions?.professions.length ?? 0}.`] };
        }

        if (professionScope === 'remove') {
          const next = {
            professions: currentProfessions.professions.filter((entry) => entry.professionId !== professionId),
          };
          const hub = await writeProfessions(next);
          return { ok: true, lines: [`Removed profession ${professionId}.`, `Learned professions: ${hub.character.professions?.professions.length ?? 0}.`] };
        }

        if (professionScope === 'xp') {
          const xpMode = String(rest[0] ?? '').trim().toLowerCase();
          const targetId = String(rest[1] ?? 'mining').trim().toLowerCase();
          const amount = parseConsoleInteger(rest[2], 'XP');
          const targetDefinition = PROFESSION_DEFINITIONS.find((entry) => entry.id === targetId) ?? null;
          if (!targetDefinition) {
            throw new Error(`Unknown profession: ${targetId}`);
          }

          if (xpMode === 'add') {
            const unlocked = unlockProfession(currentProfessions, targetDefinition.id);
            const next = addProfessionXp(unlocked, targetDefinition.id, amount);
            const hub = await writeProfessions(next);
            return { ok: true, lines: [`Added ${amount} XP to ${targetDefinition.name}.`, `Current XP: ${hub.character.professions?.professions.find((entry) => entry.professionId === targetDefinition.id)?.xp ?? 0}.`] };
          }

          if (xpMode === 'set') {
            const unlocked = unlockProfession(currentProfessions, targetDefinition.id);
            const nextProfessions = {
              professions: unlocked.professions.map((entry) => (
                entry.professionId === targetDefinition.id
                  ? {
                      ...entry,
                      xp: Math.max(0, amount),
                      xpToNextLevel: Math.max(1, entry.level * 100),
                    }
                  : entry
              )),
            };
            const hub = await writeProfessions(nextProfessions);
            return { ok: true, lines: [`XP set to ${Math.max(0, amount)} for ${targetDefinition.name}.`, `Level remains ${hub.character.professions?.professions.find((entry) => entry.professionId === targetDefinition.id)?.level ?? 1}.`] };
          }

          throw new Error('Use: profession xp add <professionId> <value> OR profession xp set <professionId> <value>.');
        }

        if (professionScope === 'level') {
          if (String(rest[0] ?? '').trim().toLowerCase() !== 'set') {
            throw new Error('Use: profession level set <professionId> <value>.');
          }
          const targetId = String(rest[1] ?? 'mining').trim().toLowerCase();
          const value = parseConsoleInteger(rest[2], 'Level');
          const targetDefinition = PROFESSION_DEFINITIONS.find((entry) => entry.id === targetId) ?? null;
          if (!targetDefinition) {
            throw new Error(`Unknown profession: ${targetId}`);
          }
          const unlocked = unlockProfession(currentProfessions, targetDefinition.id);
          const nextProfessions = {
            professions: unlocked.professions.map((entry) => (
              entry.professionId === targetDefinition.id
                ? {
                    ...entry,
                    level: Math.max(1, value),
                    xp: 0,
                    xpToNextLevel: Math.max(1, Math.max(1, value) * 100),
                  }
                : entry
            )),
          };
          const hub = await writeProfessions(nextProfessions);
          return { ok: true, lines: [`Level set to ${Math.max(1, value)} for ${targetDefinition.name}.`, `Skill points: ${hub.character.professions?.professions.find((entry) => entry.professionId === targetDefinition.id)?.skillPoints ?? 0}.`] };
        }

        if (professionScope === 'points') {
          const pointsMode = String(rest[0] ?? '').trim().toLowerCase();
          const targetId = String(rest[1] ?? 'mining').trim().toLowerCase();
          const amount = parseConsoleInteger(rest[2], 'Points');
          const targetDefinition = PROFESSION_DEFINITIONS.find((entry) => entry.id === targetId) ?? null;
          if (!targetDefinition) {
            throw new Error(`Unknown profession: ${targetId}`);
          }
          const unlocked = unlockProfession(currentProfessions, targetDefinition.id);
          const nextProfessions = {
            professions: unlocked.professions.map((entry) => (
              entry.professionId === targetDefinition.id
                ? {
                    ...entry,
                    skillPoints: Math.max(0, pointsMode === 'set' ? amount : entry.skillPoints + amount),
                  }
                : entry
            )),
          };
          const hub = await writeProfessions(nextProfessions);
          return { ok: true, lines: [`Skill points ${pointsMode === 'set' ? 'set' : 'changed'} for ${targetDefinition.name}.`, `Current points: ${hub.character.professions?.professions.find((entry) => entry.professionId === targetDefinition.id)?.skillPoints ?? 0}.`] };
        }

        if (professionScope === 'skill') {
          const skillMode = String(rest[0] ?? '').trim().toLowerCase();
          const targetId = String(rest[1] ?? 'mining').trim().toLowerCase();
          const skillId = String(rest[2] ?? '').trim();
          const targetDefinition = PROFESSION_DEFINITIONS.find((entry) => entry.id === targetId) ?? null;
          if (!targetDefinition) {
            throw new Error(`Unknown profession: ${targetId}`);
          }

          if (skillMode === 'reset') {
            const nextProfessions = {
              professions: currentProfessions.professions.map((entry) => (
                entry.professionId === targetDefinition.id
                  ? { ...entry, learnedSkillIds: [] }
                  : entry
              )),
            };
            const hub = await writeProfessions(nextProfessions);
            return { ok: true, lines: [`Cleared learned skills for ${targetDefinition.name}.`, `Current skills: ${hub.character.professions?.professions.find((entry) => entry.professionId === targetDefinition.id)?.learnedSkillIds.length ?? 0}.`] };
          }

          if (skillMode !== 'learn') {
            throw new Error('Use: profession skill learn <professionId> <skillId> OR profession skill reset <professionId>.');
          }
          if (!skillId) {
            throw new Error('Skill ID is required.');
          }

          const skill = loadProfessionSkillsFromStorage().find((entry) => entry.id === skillId && entry.professionId === targetDefinition.id && entry.isEnabled) ?? null;
          if (!skill) {
            throw new Error(`Skill not found: ${skillId}`);
          }

          const unlocked = unlockProfession(currentProfessions, targetDefinition.id);
          const professionState = getPlayerProfession(unlocked, targetDefinition.id);
          if (!professionState) {
            throw new Error(`Profession not unlocked: ${targetDefinition.name}.`);
          }

          if (professionState.learnedSkillIds.includes(skill.id)) {
            return { ok: true, lines: [`Skill already learned: ${skill.id}.`] };
          }
          if (professionState.level < skill.requiredLevel) {
            throw new Error(`Required level for ${skill.id}: ${skill.requiredLevel}.`);
          }
          if (professionState.skillPoints < skill.skillPointCost) {
            throw new Error(`Not enough skill points for ${skill.id}.`);
          }

          if (skill.branchId) {
            const branch = loadProfessionBranchesFromStorage().find((entry) => entry.id === skill.branchId && entry.professionId === targetDefinition.id && entry.isEnabled) ?? null;
            if (!branch) {
              throw new Error(`Branch not found: ${skill.branchId}`);
            }
            const missingRequiredBranchId = (skill.requiredBranchIds ?? []).find((requiredBranchId) => !(professionState.selectedBranchIds ?? []).includes(requiredBranchId));
            if (missingRequiredBranchId) {
              throw new Error(`Required branch for ${skill.id}: ${missingRequiredBranchId}.`);
            }
            if (!(professionState.selectedBranchIds ?? []).includes(branch.id)) {
              throw new Error(`Select branch ${branch.name} first.`);
            }
            const missingBranchRequirement = (branch.requiredSkillIds ?? []).find((requiredId) => !professionState.learnedSkillIds.includes(requiredId));
            if (missingBranchRequirement) {
              throw new Error(`Branch ${branch.name} requires skill ${missingBranchRequirement}.`);
            }
          }
          const nextProfessions = {
            professions: unlocked.professions.map((entry) => (
              entry.professionId === targetDefinition.id
                ? {
                    ...entry,
                    skillPoints: Math.max(0, entry.skillPoints - skill.skillPointCost),
                    learnedSkillIds: Array.from(new Set([...(entry.learnedSkillIds ?? []), skill.id])),
                  }
                : entry
            )),
          };
          const hub = await writeProfessions(nextProfessions);
          return { ok: true, lines: [`Learned skill ${skill.id}.`, `Remaining points: ${hub.character.professions?.professions.find((entry) => entry.professionId === targetDefinition.id)?.skillPoints ?? 0}.`] };
        }

        if (professionScope === 'branch') {
          const branchMode = String(rest[0] ?? '').trim().toLowerCase();
          const targetId = String(rest[1] ?? 'mining').trim().toLowerCase();
          const branchId = String(rest[2] ?? '').trim();
          const targetDefinition = PROFESSION_DEFINITIONS.find((entry) => entry.id === targetId) ?? null;
          if (!targetDefinition) {
            throw new Error(`Unknown profession: ${targetId}`);
          }

          if (branchMode === 'reset') {
            const nextProfessions = {
              professions: currentProfessions.professions.map((entry) => (
                entry.professionId === targetDefinition.id
                  ? { ...entry, selectedBranchIds: [] }
                  : entry
              )),
            };
            const hub = await writeProfessions(nextProfessions);
            return { ok: true, lines: [`Cleared selected branches for ${targetDefinition.name}.`, `Current branches: ${hub.character.professions?.professions.find((entry) => entry.professionId === targetDefinition.id)?.selectedBranchIds.length ?? 0}.`] };
          }

          if (branchMode !== 'choose') {
            throw new Error('Use: profession branch choose <professionId> <branchId> OR profession branch reset <professionId>.');
          }
          if (!branchId) {
            throw new Error('Branch ID is required.');
          }

          const branch = loadProfessionBranchesFromStorage().find((entry) => entry.id === branchId && entry.professionId === targetDefinition.id && entry.isEnabled) ?? null;
          if (!branch) {
            throw new Error(`Branch not found: ${branchId}`);
          }

          const unlocked = unlockProfession(currentProfessions, targetDefinition.id);
          const professionState = getPlayerProfession(unlocked, targetDefinition.id);
          if (!professionState) {
            throw new Error(`Profession not unlocked: ${targetDefinition.name}.`);
          }
          const missingBranchRequirement = (branch.requiredSkillIds ?? []).find((requiredId) => !professionState.learnedSkillIds.includes(requiredId));
          if (missingBranchRequirement) {
            throw new Error(`Branch ${branch.name} requires skill ${missingBranchRequirement}.`);
          }
          const missingRequiredBranchId = (branch.requiredBranchIds ?? []).find((requiredBranchId) => !(professionState.selectedBranchIds ?? []).includes(requiredBranchId));
          if (missingRequiredBranchId) {
            throw new Error(`Branch ${branch.name} requires branch ${missingRequiredBranchId}.`);
          }
          const lockedByBranchId = (branch.locksBranchIds ?? []).find((lockedBranchId) => (professionState.selectedBranchIds ?? []).includes(lockedBranchId));
          if (lockedByBranchId) {
            throw new Error(`Branch ${branch.name} is locked by ${lockedByBranchId}.`);
          }
          const nextProfessions = {
            professions: unlocked.professions.map((entry) => {
              if (entry.professionId !== targetDefinition.id) {
                return entry;
              }
              const nextBranchIds = new Set(entry.selectedBranchIds ?? []);
              if (branch.exclusiveGroupId) {
                for (const selectedBranchId of Array.from(nextBranchIds)) {
                  const selectedBranch = loadProfessionBranchesFromStorage().find((candidate) => candidate.id === selectedBranchId && candidate.professionId === targetDefinition.id && candidate.isEnabled) ?? null;
                  if (selectedBranch?.exclusiveGroupId === branch.exclusiveGroupId) {
                    nextBranchIds.delete(selectedBranchId);
                  }
                }
              }
              nextBranchIds.add(branch.id);
              return {
                ...entry,
                selectedBranchIds: Array.from(nextBranchIds),
              };
            }),
          };
          const hub = await writeProfessions(nextProfessions);
          return { ok: true, lines: [`Selected branch ${branch.name}.`, `Current branches: ${hub.character.professions?.professions.find((entry) => entry.professionId === targetDefinition.id)?.selectedBranchIds.join(', ') || 'none'}.`] };
        }

        throw new Error('Use: profession list | profession unlock/remove <professionId> | profession xp add|set <professionId> <value> | profession level set <professionId> <value> | profession points add|set <professionId> <value> | profession skill learn|reset <professionId> [skillId] | profession branch choose|reset <professionId> [branchId].');
      }

      if (head === 'mine') {
        if (action === 'open') {
          const mineId = String(rest[0] ?? '').trim();
          if (!mineId) {
            throw new Error('Use: mine open <mineId>.');
          }
          queueMineRequest('open', mineId);
          return { ok: true, lines: [`Mine open request queued: ${mineId}.`] };
        }

        if (action === 'close') {
          queueMineRequest('close');
          return { ok: true, lines: ['Mine close request queued.'] };
        }

        if (action === 'finish') {
          const result = String(rest[0] ?? '').trim().toLowerCase() as GodmodeTravelRequest['mineResult'];
          if (!result || !['escaped', 'retreated', 'failed', 'dead'].includes(result)) {
            throw new Error('Use: mine finish escaped|retreated|failed|dead.');
          }
          queueMineRequest('finish', null, result);
          return { ok: true, lines: [`Mine finish request queued: ${result}.`] };
        }

        throw new Error('Use: mine open <mineId> | mine close | mine finish escaped|retreated|failed|dead.');
      }

      if (head === 'stat') {
        const player = requireCharacter();
        const statName = String(rest[0] ?? '').trim().toLowerCase();
        const amount = parseConsoleInteger(rest[1], 'Stat value');
        const fieldMap: Record<string, { field: string; current: number }> = {
          hp: { field: 'hpBase', current: player.baseStats.hp },
          mp: { field: 'mpBase', current: player.baseStats.mp },
          stamina: { field: 'staminaBase', current: player.baseStats.stamina },
          strength: { field: 'strength', current: player.baseStats.strength },
          constitution: { field: 'endurance', current: player.baseStats.constitution },
          endurance: { field: 'endurance', current: player.baseStats.constitution },
          dexterity: { field: 'dexterity', current: player.baseStats.dexterity },
          intelligence: { field: 'intelligence', current: player.baseStats.intelligence },
          luck: { field: 'luck', current: player.baseStats.luck },
          perception: { field: 'speed', current: player.baseStats.perception },
          speed: { field: 'speed', current: player.baseStats.perception },
          willpower: { field: 'willpower', current: player.baseStats.willpower },
        };

        const target = fieldMap[statName];
        if (!target) {
          throw new Error(`Unknown stat: ${statName}`);
        }

        const nextValue = action === 'set'
          ? amount
          : target.current + amount;
        const hub = await applyHubAndRefresh(await patchDevCharacterState(player.id, {
          [target.field]: Math.max(0, nextValue),
        }));
        setStatus(`GODMODE stat updated: ${statName}`);
        return { ok: true, lines: [`${statName} set to ${Math.max(0, nextValue)}.`] };
      }

      if (head === 'resource') {
        const player = requireCharacter();
        if (action === 'full') {
          await updateCharacterResources(player.id, {
            currentHp: player.maxHp,
            currentMp: player.maxMp,
            currentStamina: player.maxStamina,
          });
          const hub = await refreshActiveCharacterHub();
          if (hub) {
            handleRuntimeInventoryChanged();
          }
          return { ok: true, lines: ['HP, MP and stamina restored to maximum.'] };
        }

        if (action !== 'set') {
          throw new Error('Use: resource full OR resource set <hp|mp|stamina|regen> <value>.');
        }

        const resourceName = String(rest[0] ?? '').trim().toLowerCase();
        const value = parseConsoleInteger(rest[1], 'Resource value');
        const payload = resourceName === 'hp'
          ? { currentHp: value }
          : resourceName === 'mp'
            ? { currentMp: value }
            : resourceName === 'stamina'
              ? { currentStamina: value }
              : resourceName === 'regen'
                ? { hpRegenPerTurn: value }
                : null;

        if (!payload) {
          throw new Error(`Unknown resource: ${resourceName}`);
        }

        await updateCharacterResources(player.id, payload);
        await refreshActiveCharacterHub();
        return { ok: true, lines: [`Resource ${resourceName} updated.`] };
      }

      if (head === 'item') {
        const player = requireCharacter();
        const itemId = String(rest[0] ?? '').trim();
        const quantity = Math.max(1, Math.abs(parseConsoleInteger(rest[1] ?? '1', 'Quantity')));
        const delta = action === 'remove' ? -quantity : quantity;
        const hub = await applyHubAndRefresh(await adjustDevInventoryItem(player.id, { itemId, quantityDelta: delta }));
        setStatus(`GODMODE inventory updated: ${itemId}`);
        return { ok: true, lines: [`${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} x ${itemId}.`, `Inventory now has ${hub.inventory.items.find((entry) => entry.itemId === itemId)?.quantity ?? 0} x ${itemId}.`] };
      }

      if (head === 'equip') {
        const player = requireCharacter();
        const itemId = String(actionRaw ?? '').trim();
        const slot = rest[0] ? String(rest[0]).trim() as keyof Equipment : undefined;
        if (!itemId) {
          throw new Error('Use: equip <itemId> [slot].');
        }
        const hub = await applyHubAndRefresh(await equipArenaItem(player.id, itemId, slot));
        return { ok: true, lines: [`Equipped ${itemId}.`, `Weapon=${hub.equipment.weapon ?? 'empty'}, Armor=${hub.equipment.armor ?? 'empty'}.`] };
      }

      if (head === 'unequip') {
        const player = requireCharacter();
        const slot = String(actionRaw ?? '').trim() as keyof Equipment;
        if (!slot) {
          throw new Error('Use: unequip <slot>.');
        }
        const hub = await applyHubAndRefresh(await unequipArenaItem(player.id, slot));
        return { ok: true, lines: [`Unequipped slot ${slot}.`, `Slot ${slot} is now ${hub.equipment[slot] ?? 'empty'}.`] };
      }

      if (head === 'skill') {
        const player = requireCharacter();
        const skillId = String(rest[0] ?? '').trim();
        if (!skillId) {
          throw new Error('Use: skill add <skillId> OR skill remove <skillId>.');
        }

        if (action === 'remove') {
          await revokeCharacterSkill(player.id, skillId);
          await refreshCharacterSkills(player.id);
          await refreshActiveCharacterHub();
          return { ok: true, lines: [`Removed skill ${skillId}.`] };
        }

        await grantSkill(player.id, {
          skillId,
          sourceType: 'admin',
          sourceId: 'godmode_console',
        });
        await refreshCharacterSkills(player.id);
        await refreshActiveCharacterHub();
        return { ok: true, lines: [`Granted skill ${skillId}.`] };
      }

      if (head === 'merchant') {
        const filter = rest.join(' ').trim();

        if (action === 'list') {
          const lines = runtimeAdminMerchants
            .filter((merchant) => matchesGodmodeFilter(filter, merchant.id, merchant.name, merchant.type, merchant.city, merchant.location))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((merchant) => `${merchant.id} — ${merchant.name} [${merchant.type}] items=${merchant.items.length} ${merchant.isEnabled ? 'enabled' : 'disabled'}`);
          return { ok: true, lines: formatGodmodeListLines('Merchants', lines, filter) };
        }

        if (action === 'open') {
          const merchantId = String(rest[0] ?? '').trim();
          if (!merchantId && runtimeMerchants.length === 0) {
            throw new Error('No merchants are loaded.');
          }
          if (merchantId && !runtimeMerchants.some((merchant) => merchant.id === merchantId)) {
            throw new Error(`Merchant not found: ${merchantId}`);
          }
          openMerchantOverlay(merchantId || undefined);
          return { ok: true, lines: [`Opened merchant ${merchantId || selectedMerchantId || runtimeMerchants[0]?.id || 'default'}.`] };
        }

        throw new Error('Use: merchant open <merchantId> OR merchant list [filter].');
      }

      if (head === 'battle') {
        if (action === 'map') {
          const battleMapId = String(rest[0] ?? '').trim();
          if (!battleMapId) {
            throw new Error('Use: battle map <battleMapId>.');
          }
          const maps = await loadBattleMapsFromStore();
          const battleMap = maps.find((entry) => entry.id === battleMapId) ?? null;
          if (!battleMap) {
            throw new Error(`Battle map not found: ${battleMapId}`);
          }
          setSelectedBattleMapId(battleMap.id);
          return { ok: true, lines: [`Selected battle map: ${battleMap.id} (${battleMap.name}).`] };
        }

        if (action === 'start') {
          requireCharacter();
          let enemyCount = 3;
          let battleMapId: string | undefined;
          const firstArg = String(rest[0] ?? '').trim();
          const secondArg = String(rest[1] ?? '').trim();

          if (firstArg) {
            const numeric = Number(firstArg);
            if (Number.isFinite(numeric)) {
              enemyCount = Math.max(1, Math.min(MAX_COMBAT_ENEMIES, Math.trunc(numeric)));
              battleMapId = secondArg || undefined;
            } else {
              battleMapId = firstArg;
            }
          }

          if (battleMapId) {
            const maps = await loadBattleMapsFromStore();
            if (!maps.some((entry) => entry.id === battleMapId)) {
              throw new Error(`Battle map not found: ${battleMapId}`);
            }
            setSelectedBattleMapId(battleMapId);
          }

          await openCombat(battleMapId, { enemyCount });
          return { ok: true, lines: [`Started battle with ${enemyCount} generated enemies${battleMapId ? ` on ${battleMapId}` : ''}.`] };
        }

        if (action === 'npc') {
          requireCharacter();
          const npcIdsRaw = String(rest[0] ?? '').trim();
          const battleMapId = String(rest[1] ?? '').trim() || undefined;
          if (!npcIdsRaw) {
            throw new Error('Use: battle npc <npcId[,npcId2,...]> [battleMapId].');
          }

          await ensureNpcsLoaded();
          const ids = npcIdsRaw.split(',').map((entry) => entry.trim()).filter(Boolean).slice(0, MAX_COMBAT_ENEMIES);
          const npcById = new Map(getAllNpcs().map((npc) => [npc.id, npc] as const));
          const missing = ids.filter((id) => !npcById.has(id));
          if (missing.length > 0) {
            throw new Error(`NPC not found: ${missing.join(', ')}`);
          }

          if (battleMapId) {
            const maps = await loadBattleMapsFromStore();
            if (!maps.some((entry) => entry.id === battleMapId)) {
              throw new Error(`Battle map not found: ${battleMapId}`);
            }
            setSelectedBattleMapId(battleMapId);
          }

          const customEnemies = ids.map((id) => toCustomNpcPayload(toArenaNpcTemplate(npcById.get(id)!, resolveArenaNpcItem)));
          await openCombat(battleMapId, { customEnemies });
          return { ok: true, lines: [`Started battle against NPCs: ${ids.join(', ')}${battleMapId ? ` on ${battleMapId}` : ''}.`] };
        }

        throw new Error('Use: battle map <battleMapId> OR battle start [enemyCount] [battleMapId] OR battle npc <npcId[,npcId2,...]> [battleMapId].');
      }

      if (head === 'itemset') {
        const setId = String(rest[0] ?? '').trim();
        const filter = rest.join(' ').trim();

        if (action === 'list') {
          const sets = await itemSetsService.getAll();
          const lines = sets
            .filter((set) => matchesGodmodeFilter(filter, set.id, set.name, set.gameplayDescription, set.loreDescription))
            .sort((left, right) => left.id.localeCompare(right.id))
            .map((set) => `${set.id} — ${set.name} [pieces=${set.pieceItemIds.length}] ${set.isEnabled ? 'enabled' : 'disabled'}`);
          return { ok: true, lines: formatGodmodeListLines('Item sets', lines, filter) };
        }

        if (!setId) {
          throw new Error('Use: itemset give|remove <setId> OR itemset list [filter].');
        }

        const player = requireCharacter();
        const itemSet = await itemSetsService.getById(setId);
        if (!itemSet) {
          throw new Error(`Item set not found: ${setId}`);
        }

        if (action !== 'give' && action !== 'remove') {
          throw new Error('Use: itemset give <setId> OR itemset remove <setId> OR itemset list [filter].');
        }

        let hub: ArenaHubState | null = null;
        for (const pieceItemId of itemSet.pieceItemIds) {
          hub = await applyHubAndRefresh(await adjustDevInventoryItem(player.id, {
            itemId: pieceItemId,
            quantityDelta: action === 'remove' ? -1 : 1,
          }));
        }

        return {
          ok: true,
          lines: [
            `${action === 'remove' ? 'Removed' : 'Granted'} item set ${itemSet.id} (${itemSet.name}).`,
            `Pieces: ${itemSet.pieceItemIds.join(', ') || 'none'}.`,
            ...(hub ? [`Inventory gold remains ${hub.inventory.gold}.`] : []),
          ],
        };
      }

      if (head === 'quest') {
        const player = requireCharacter();
        const questId = String(rest[0] ?? '').trim();
        await ensureQuestsLoaded();
        const questDefinition = questId ? getQuestById(questId) : null;

        if (action !== 'track' && action !== 'untrack' && !questDefinition) {
          throw new Error(`Quest not found: ${questId}`);
        }

        if (action === 'get') {
          const state = getPlayerQuestState(player.id, questId);
          return {
            ok: true,
            lines: state
              ? [
                  `Quest: ${questDefinition?.title ?? questId}`,
                  `Status: ${state.status}`,
                  `Current step: ${state.currentStepId ?? 'none'}`,
                  `Completed objectives: ${(state.completedObjectiveIds ?? []).join(', ') || 'none'}`,
                ]
              : [`Quest ${questId} has no player state yet.`],
          };
        }

        if (action === 'start') {
          const state = startQuest(player.id, questId);
          setStatus(`GODMODE quest started: ${questId}`);
          return { ok: true, lines: [`Quest started: ${questDefinition?.title ?? questId}.`, `Step: ${state.currentStepId ?? 'none'}.`] };
        }

        if (action === 'advance') {
          const state = advanceQuest(player.id, questId);
          const rewards = state.status === 'completed' ? applyQuestRewards(player.id, questId) : { applied: false, rewards: [] };
          return {
            ok: true,
            lines: [
              `Quest advanced: ${questId}.`,
              `Status: ${state.status}.`,
              ...(rewards.applied ? [`Rewards: ${rewards.rewards.join(', ') || 'none'}.`] : []),
            ],
          };
        }

        if (action === 'complete') {
          if (!getPlayerQuestState(player.id, questId)) {
            startQuest(player.id, questId);
          }
          const state = completeQuest(player.id, questId);
          const rewards = applyQuestRewards(player.id, questId);
          handleRuntimeInventoryChanged();
          return {
            ok: true,
            lines: [
              `Quest completed: ${questDefinition?.title ?? questId}.`,
              `Status: ${state.status}.`,
              ...(rewards.applied ? [`Rewards: ${rewards.rewards.join(', ') || 'none'}.`] : []),
            ],
          };
        }

        if (action === 'fail') {
          if (!getPlayerQuestState(player.id, questId)) {
            startQuest(player.id, questId);
          }
          const reason = rest.slice(1).join(' ');
          const state = failQuest(player.id, questId, reason || undefined);
          return { ok: true, lines: [`Quest failed: ${questDefinition?.title ?? questId}.`, `Reason: ${reason || 'none'}.`, `Status: ${state.status}.`] };
        }

        if (action === 'reset') {
          deletePlayerQuestState(player.id, questId);
          window.localStorage.removeItem(getTrackedQuestStorageKey(player.id));
          return { ok: true, lines: [`Quest state removed: ${questId}.`] };
        }

        if (action === 'untrack') {
          window.localStorage.removeItem(getTrackedQuestStorageKey(player.id));
          return { ok: true, lines: ['Tracked quest cleared.'] };
        }

        if (action === 'track') {
          const objectiveId = rest[1] ? String(rest[1]).trim() : null;
          window.localStorage.setItem(getTrackedQuestStorageKey(player.id), JSON.stringify({
            questId: questId || null,
            objectiveId,
          }));
          return { ok: true, lines: [`Tracked quest set to ${questId}${objectiveId ? ` / ${objectiveId}` : ''}.`] };
        }

        if (action === 'reward') {
          const rewards = applyQuestRewards(player.id, questId);
          handleRuntimeInventoryChanged();
          return {
            ok: true,
            lines: [
              `Quest rewards applied for ${questDefinition?.title ?? questId}.`,
              ...(rewards.applied ? [`Rewards: ${rewards.rewards.join(', ') || 'none'}.`] : ['No reward payload was applied.']),
            ],
          };
        }

        if (action === 'flag') {
          const key = String(rest[1] ?? '').trim();
          if (!key) {
            throw new Error('Use: quest flag <questId> <key> <value>.');
          }
          const value = parseLooseConsoleValue(rest.slice(2).join(' '));
          const state = setQuestFlag(player.id, questId, key, value);
          return { ok: true, lines: [`Quest flag set: ${questId}.${key} = ${JSON.stringify(state.flags?.[key] ?? value)}.`] };
        }

        throw new Error('Use: quest get|start|advance|complete|fail|reset|track|untrack|reward|flag <questId> ...');
      }

      if (head === 'objective') {
        const player = requireCharacter();
        const objectiveAction = action;
        const questId = String(rest[0] ?? '').trim();
        const objectiveId = String(rest[1] ?? '').trim();
        await ensureQuestsLoaded();
        if (objectiveAction !== 'complete' || !questId || !objectiveId) {
          throw new Error('Use: objective complete <questId> <objectiveId>.');
        }

        if (!getPlayerQuestState(player.id, questId)) {
          startQuest(player.id, questId);
        }
        completeObjective(player.id, questId, objectiveId);
        const state = advanceQuest(player.id, questId);
        const rewards = state.status === 'completed' ? applyQuestRewards(player.id, questId) : { applied: false, rewards: [] };
        handleRuntimeInventoryChanged();
        return {
          ok: true,
          lines: [
            `Objective completed: ${objectiveId}.`,
            `Quest status: ${state.status}.`,
            ...(rewards.applied ? [`Rewards: ${rewards.rewards.join(', ') || 'none'}.`] : []),
          ],
        };
      }

      if (head === 'questitem') {
        const questItemId = String(rest[0] ?? '').trim();
        const quantity = Math.max(1, Math.abs(parseConsoleInteger(rest[1] ?? '1', 'Quantity')));
        const applied = adjustIdArrayStorage(PLAYER_QUEST_ITEMS_STORAGE_KEY, questItemId, action === 'remove' ? -quantity : quantity);
        handleRuntimeInventoryChanged();
        return { ok: true, lines: [`${applied >= 0 ? 'Added' : 'Removed'} ${Math.abs(applied)} x ${questItemId}.`] };
      }

      if (head === 'material' || head === 'resource') {
        const itemId = String(rest[0] ?? '').trim();
        const quantity = Math.max(1, Math.abs(parseConsoleInteger(rest[1] ?? '1', 'Quantity')));
        const storageKey = head === 'material' ? PLAYER_MATERIALS_STORAGE_KEY : PLAYER_RESOURCES_STORAGE_KEY;
        const applied = adjustCountRecordStorage(storageKey, itemId, action === 'remove' ? -quantity : quantity);
        handleRuntimeInventoryChanged();
        return { ok: true, lines: [`${applied >= 0 ? 'Added' : 'Removed'} ${Math.abs(applied)} ${head} x ${itemId}.`] };
      }

      if (head === 'flag') {
        if (action === 'list') {
          const flags = readJsonRecord(PLAYER_FLAGS_STORAGE_KEY);
          const lines = Object.entries(flags)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, value]) => `${key} = ${JSON.stringify(value)}`);
          return { ok: true, lines: formatGodmodeListLines('Flags', lines) };
        }

        if (action === 'get') {
          const key = String(rest[0] ?? '').trim();
          if (!key) {
            throw new Error('Use: flag get <key>.');
          }
          const flags = readJsonRecord(PLAYER_FLAGS_STORAGE_KEY);
          if (!(key in flags)) {
            return { ok: true, lines: [`Flag not set: ${key}.`] };
          }
          return { ok: true, lines: [`${key} = ${JSON.stringify(flags[key])}`] };
        }

        const key = String(rest[0] ?? '').trim();
        if (!key) {
          throw new Error('Use: flag get <key> | flag list | flag set <key> <value> | flag delete <key>.');
        }

        const flags = readJsonRecord(PLAYER_FLAGS_STORAGE_KEY);
        if (action === 'delete' || action === 'remove') {
          delete flags[key];
          writeJsonRecord(PLAYER_FLAGS_STORAGE_KEY, flags);
          return { ok: true, lines: [`Flag removed: ${key}.`] };
        }

        const value = parseLooseConsoleValue(rest.slice(1).join(' '));
        flags[key] = value;
        writeJsonRecord(PLAYER_FLAGS_STORAGE_KEY, flags);
        return { ok: true, lines: [`Flag set: ${key} = ${JSON.stringify(value)}.`] };
      }

      if (head === 'unlock') {
        const scope = action;
        const targetId = String(rest[0] ?? '').trim();
        if (scope === 'all') {
          const targetScope = String(rest[0] ?? '').trim().toLowerCase();
          if (targetScope === 'locations') {
            const locations = await locationService.getLocations();
            writeStringArrayStorage(PLAYER_UNLOCKED_LOCATIONS_STORAGE_KEY, locations.map((location) => location.id));
            return { ok: true, lines: [`Unlocked all locations (${locations.length}).`] };
          }
          if (targetScope === 'dialogues') {
            await ensureDialoguesLoaded();
            const dialogues = getAllDialogues();
            writeStringArrayStorage(PLAYER_UNLOCKED_DIALOGUES_STORAGE_KEY, dialogues.map((dialogue) => dialogue.id));
            return { ok: true, lines: [`Unlocked all dialogues (${dialogues.length}).`] };
          }
          if (targetScope === 'shops') {
            writeStringArrayStorage(PLAYER_UNLOCKED_SHOPS_STORAGE_KEY, runtimeAdminMerchants.map((merchant) => merchant.id));
            return { ok: true, lines: [`Unlocked all shops (${runtimeAdminMerchants.length}).`] };
          }
          throw new Error('Use: unlock all locations|dialogues|shops.');
        }
        const storageKey = scope === 'location'
          ? PLAYER_UNLOCKED_LOCATIONS_STORAGE_KEY
          : scope === 'dialogue'
            ? PLAYER_UNLOCKED_DIALOGUES_STORAGE_KEY
            : scope === 'shop'
              ? PLAYER_UNLOCKED_SHOPS_STORAGE_KEY
              : null;
        if (!storageKey || !targetId) {
          throw new Error('Use: unlock location|dialogue|shop <id>.');
        }
        const current = readStringArrayStorage(storageKey);
        if (!current.includes(targetId)) {
          writeStringArrayStorage(storageKey, [...current, targetId]);
        }
        return { ok: true, lines: [`Unlocked ${scope}: ${targetId}.`] };
      }

      if (head === 'clear') {
        const scope = action;
        if (scope === 'questitems') {
          writeStringArrayStorage(PLAYER_QUEST_ITEMS_STORAGE_KEY, []);
          handleRuntimeInventoryChanged();
          return { ok: true, lines: ['Cleared all quest items from runtime storage.'] };
        }
        if (scope === 'materials') {
          writeStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY, {});
          handleRuntimeInventoryChanged();
          return { ok: true, lines: ['Cleared all materials from runtime storage.'] };
        }
        if (scope === 'resources') {
          writeStringNumberRecordStorage(PLAYER_RESOURCES_STORAGE_KEY, {});
          handleRuntimeInventoryChanged();
          return { ok: true, lines: ['Cleared all resources from runtime storage.'] };
        }
        if (scope === 'flags') {
          writeJsonRecord(PLAYER_FLAGS_STORAGE_KEY, {});
          return { ok: true, lines: ['Cleared all player flags.'] };
        }
        if (scope === 'runtimeitems') {
          writeStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY, []);
          writeNumberStorage(PLAYER_GOLD_STORAGE_KEY, 0);
          handleRuntimeInventoryChanged();
          return { ok: true, lines: ['Cleared runtime item overlay and runtime gold overlay.'] };
        }
        if (scope === 'allruntime') {
          writeStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY, []);
          writeStringArrayStorage(PLAYER_QUEST_ITEMS_STORAGE_KEY, []);
          writeStringNumberRecordStorage(PLAYER_MATERIALS_STORAGE_KEY, {});
          writeStringNumberRecordStorage(PLAYER_RESOURCES_STORAGE_KEY, {});
          writeJsonRecord(PLAYER_FLAGS_STORAGE_KEY, {});
          writeNumberStorage(PLAYER_GOLD_STORAGE_KEY, 0);
          handleRuntimeInventoryChanged();
          return { ok: true, lines: ['Cleared runtime items, quest items, materials, resources, flags and runtime gold overlay.'] };
        }
        throw new Error('Use: clear questitems|materials|resources|flags|runtimeitems|allruntime.');
      }

      if (head === 'sync' && action === 'runtime') {
        const player = requireCharacter();
        const runtimeGold = Math.max(0, readNumberStorage(PLAYER_GOLD_STORAGE_KEY, 0));
        const runtimeItems = readStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY);
        const itemCounts = countIdEntries(runtimeItems);
        let hub: ArenaHubState | null = null;

        if (runtimeGold > 0) {
          hub = await syncRuntimeGoldIntoBackend(player, inventory.gold + runtimeGold);
        }

        for (const [itemId, quantity] of itemCounts.entries()) {
          hub = await applyHubAndRefresh(await adjustDevInventoryItem(player.id, { itemId, quantityDelta: quantity }));
        }

        if (runtimeItems.length > 0) {
          writeStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY, []);
        }

        handleRuntimeInventoryChanged();
        return {
          ok: true,
          lines: [
            `Synced runtime overlay into backend inventory.`,
            `Gold merged: ${runtimeGold}.`,
            `Items merged: ${runtimeItems.length}.`,
            ...(hub ? [`Current gold: ${hub.inventory.gold}.`] : []),
          ],
        };
      }

      throw new Error(`Unknown GODMODE command: ${tokens.join(' ')}`);
    } catch (error) {
      return {
        ok: false,
        lines: [(error as Error).message || 'Unknown GODMODE error.'],
      };
    }
  }, [
    character,
    characterSkills.length,
    changeCharacterOverlayFocus,
    handleRuntimeInventoryChanged,
    inventory.gold,
    isGodmodeAccount,
    login,
    onNavigate,
    openArenaOverlay,
    openCombat,
    openEquipmentOverlay,
    openMerchantOverlay,
    openSkillsOverlay,
    refreshActiveCharacterHub,
    refreshCharacterSkills,
    resolveArenaNpcItem,
    runtimeAdminItems,
    runtimeAdminMerchants,
    runtimeAdminSkills,
    runtimeMerchants,
    selectedBattleMapId,
    selectedMerchantId,
  ]);

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

  const respecStats = useCallback(async (): Promise<void> => {
    if (!character) {
      return;
    }

    const ok = window.confirm('Ð¡Ð±Ñ€Ð¾ÑÐ¸Ñ‚ÑŒ Ñ…Ð°Ñ€Ð°ÐºÑ‚ÐµÑ€Ð¸ÑÑ‚Ð¸ÐºÐ¸ Ð¸ Ð²ÐµÑ€Ð½ÑƒÑ‚ÑŒ Ð²ÑÐµ Ð¾Ñ‡ÐºÐ¸ Ð´Ð»Ñ Ð¿ÐµÑ€ÐµÑ€Ð°ÑÐ¿Ñ€ÐµÐ´ÐµÐ»ÐµÐ½Ð¸Ñ?');
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

    setStatus('Ð¥Ð°Ñ€Ð°ÐºÑ‚ÐµÑ€Ð¸ÑÑ‚Ð¸ÐºÐ¸ ÑÐ±Ñ€Ð¾ÑˆÐµÐ½Ñ‹. ÐžÑ‡ÐºÐ¸ Ð²Ð¾Ð·Ð²Ñ€Ð°Ñ‰ÐµÐ½Ñ‹.');
  }, [character]);

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
                      <button type="button" className="godmode-login-button" onClick={() => void onUseGodmodeAccount()}>GODMODE</button>
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

  function startArenaSetupBattle(mode: ArenaSetupMode): void {
    const battleMapId = pendingArenaBattleMapId ?? selectedBattleMapId;
    if (mode === 'random') {
      const enemyCount = 1 + Math.floor(Math.random() * 3);
      void openCombat(battleMapId, { customEnemies: Array.from({ length: enemyCount }, (_, index) => buildGeneratedArenaEnemy(index + 1)) });
      return;
    }
    const enemyCount = mode === '1v1' ? 1 : mode === '1v3' ? 3 : 10;
    void openCombat(battleMapId, { enemyCount });
  }

  const freePointsLeft = character.freePoints - getAllocationCost(pendingStatAllocation);

  const respecStatsUnused = async (): Promise<void> => {
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
  };

  return (
    <div className="page game-root">
      <main className="shell game-shell world-shell game-main">
        <WorldMapScreen
          character={character}
          inventory={worldInventory}
          equipment={equipment}
          playerAvatarUrl={playerAvatarUrl}
          battleStats={{
            hp: battlePlayer?.currentHp ?? character.currentHp,
            mp: battlePlayer?.currentMp ?? character.currentMp,
            stamina: battlePlayer?.currentStamina ?? character.currentStamina,
          }}
          chatLines={chatLines}
          onOpenStats={() => {
            onNavigate?.('/stats');
            setCharacterPageFocus('stats');
            setOverlayPanel('character');
            setStatus('Открыта страница статов.');
          }}
          onOpenInventory={() => {
            onNavigate?.('/inventory');
            setCharacterPageFocus('inventory');
            setOverlayPanel('character');
            setStatus('Открыт инвентарь.');
          }}
          onOpenProfessions={() => {
            setOverlayPanel('professions');
            setStatus('Открыт список профессий.');
          }}
          onOpenCharacter={openCharacterOverlay}
          onOpenEquipment={openEquipmentOverlay}
          onOpenClan={() => setOverlayPanel('clan')}
          onExit={() => setExitDialogOpen(true)}
          onOpenMerchant={openMerchantOverlay}
          onOpenSkills={openSkillsOverlay}
          onGrantSkill={handleGrantCharacterSkill}
          onApplyHealingService={applyFullHealingService}
          onRuntimeInventoryChanged={handleRuntimeInventoryChanged}
          onTravelStaminaChange={handleTravelStaminaChange}
          onPlayerProfessionsChange={handlePlayerProfessionsChange}
          onStartCombat={openCombat}
          onStartBattleMap={(battleMapId) => {
            openArenaSetup(battleMapId);
            return Promise.resolve();
          }}
          onStatus={setStatus}
          cityMerchants={enabledRuntimeMerchants}
          resolveItemById={(itemId) => getDomainItemWithFallback(itemId, runtimeAdminItems)}
          resolveItemImage={resolveItemImage}
          resolveMerchantImage={resolveMerchantImage}
          devTravelRequest={godmodeTravelRequest}
        />

        {overlayPanel === 'character' && character ? (
          <InventoryPanel
            character={character}
            inventory={worldInventory}
            equipment={equipment}
            learnedSkills={characterSkills}
            availableSkills={runtimeAdminSkills}
            skillLoadout={skillLoadout}
            actionSlots={actionSlots}
            pendingStatAllocation={pendingStatAllocation}
            freePointsLeft={freePointsLeft}
            allocatingStats={allocatingStats}
            focusSection={characterPageFocus}
            trainerNpcId={activeTrainerNpcId}
            trainerNpcName={activeTrainerNpcName}
            trainerSkillIds={activeTrainerSkillIds}
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
            onLearnSkill={handleLearnCharacterSkill}
            onSaveSkillLoadout={handleSaveCharacterSkillLoadout}
            onSaveActionSlots={handleSaveCharacterActionSlots}
            onSaveHotbar={handleSaveCharacterHotbar}
            onUseItem={handleUseConsumable}
            onUseSkillOutOfCombat={handleUseSkillOutOfCombat}
            onChangeFocus={changeCharacterOverlayFocus}
            playerAvatarUrl={playerAvatarUrl}
            resolveItemById={(itemId) => getDomainItemWithFallback(itemId, runtimeAdminItems)}
            resolveAdminItemById={(itemId) => runtimeAdminItems.find((item) => item.id === itemId) ?? null}
            resolveItemImage={resolveItemImage}
            resolveSkillIcon={resolveSkillIcon}
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

        {overlayPanel === 'professions' && character ? (
          <PlayerProfessionsPanel
            professionsState={normalizePlayerProfessionsState(character.professions)}
            onClose={() => setOverlayPanel(null)}
            onStatus={setStatus}
            onChange={handlePlayerProfessionsChange}
          />
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
                <button onClick={() => startArenaSetupBattle('1v1')}>1 vs 1</button>
                <button onClick={() => startArenaSetupBattle('1v3')}>1 vs 3</button>
                <button onClick={() => startArenaSetupBattle('1v10')}>1 vs 10</button>
                <button onClick={() => startArenaSetupBattle('random')}>Random encounter</button>
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
            allowedSellItemIds={selectedMerchantAllowedSellItemIds}
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
                actionSlots={actionSlots}
                mapImageUrl={activeCombatMapImageUrl}
                mapCalibration={{
                  cellSizePx: activeCombatBattleMap.cellSizePx,
                  gridOffsetX: activeCombatBattleMap.gridOffsetX,
                  gridOffsetY: activeCombatBattleMap.gridOffsetY,
                  logicalColumns: activeCombatBattleMap.logicalColumns,
                  logicalRows: activeCombatBattleMap.logicalRows,
                  showEditorGrid: activeCombatBattleMap.showEditorGrid,
                  gridOpacity: activeCombatBattleMap.gridOpacity,
                }}
                battleRenderer={battleRenderer}
                onBattleRendererChange={setBattleRenderer}
                selectedSkillId={selectedCombatSkillId}
                availableSkills={battleSkillOptions}
                onSkillChange={setSelectedCombatSkillId}
                onStateChange={setCombatState}
                onStatus={setStatus}
                onBattleFinished={handleBattleFinished}
                onClose={() => setBattleWindowOpen(false)}
                playerAvatarUrl={playerAvatarUrl}
                resolveItemById={(itemId) => getDomainItemWithFallback(itemId, runtimeAdminItems)}
                resolveItemImage={resolveItemImage}
                resolveSkillIcon={resolveSkillIcon}
                resolveAdminItemById={(itemId) => runtimeAdminItems.find((item) => item.id === itemId) ?? null}
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

      <GodmodeConsole
        enabled={isGodmodeAccount}
        accountLogin={login || null}
        characterName={character?.name ?? null}
        tutorialPath={GODMODE_TUTORIAL_PATH}
        onExecute={executeGodmodeCommand}
      />
    </div>
  );
}
