import { nowIso, uid } from './content/storage';
import type { NpcDefinition } from '../types/npc';

const NPCS_KEY = 'theend.npcs';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readAll(): NpcDefinition[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const current = safeParse<NpcDefinition[]>(window.localStorage.getItem(NPCS_KEY), []);
  if (current.length > 0) {
    return current;
  }

  const seeded = seedNpcs();
  writeAll(seeded);
  return seeded;
}

function writeAll(values: NpcDefinition[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(NPCS_KEY, JSON.stringify(values));
}

function normalizeNpc(input: NpcDefinition): NpcDefinition {
  const now = nowIso();
  return {
    ...input,
    id: input.id.trim(),
    name: input.name.trim(),
    description: input.description ?? '',
    mapBindings: Array.isArray(input.mapBindings) ? input.mapBindings : [],
    dialogues: Array.isArray(input.dialogues) ? input.dialogues : [],
    questBindings: Array.isArray(input.questBindings) ? input.questBindings : [],
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

function seedNpcs(): NpcDefinition[] {
  const now = nowIso();
  return [
    {
      id: 'npc_ash_market_merchant',
      name: 'Ash Market Merchant',
      title: 'Пепельный торговец',
      status: 'draft',
      kind: 'trader',
      race: 'orc',
      cityId: 'arklein',
      locationId: 'ash_market',
      description: 'Торговец с Пепельного рынка. Продает базовые товары и выдает стартовые поручения.',
      portraitUrl: '/assets/placeholders/npc_merchant.png',
      fullImageUrl: '/assets/placeholders/npc_merchant.png',
      iconUrl: '/assets/placeholders/npc_merchant.png',
      mapBindings: [{
        id: uid('npc_map'),
        mapId: 'worldmap-main',
        zoneId: 'arklein',
        spawnType: 'fixed',
        x: 0.53,
        y: 0.83,
        visibleToPlayer: true,
      }],
      defaultDisposition: 'friendly',
      isUnique: true,
      canRespawn: false,
      canFight: false,
      canTalk: true,
      canTrade: true,
      canTrain: false,
      canGiveQuests: true,
      canBeKilled: false,
      traderId: 'merchant_ash_market',
      dialogues: [{ dialogueId: 'dlg_ash_market_merchant_intro', priority: 1 }],
      questBindings: [{ questId: 'q_letter_ash_market', role: 'giver' }],
      inventory: { itemIds: [], questItemIds: [] },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'npc_young_archer_trainer',
      name: 'Young Archer Trainer',
      title: 'Мастер стрельбы',
      status: 'draft',
      kind: 'trainer',
      race: 'forest_elf',
      cityId: 'arklein',
      description: 'Обучает профессии лучника и связанным навыкам.',
      portraitUrl: '/assets/placeholders/unknown_portrait.png',
      defaultDisposition: 'friendly',
      isUnique: true,
      canRespawn: false,
      canFight: false,
      canTalk: true,
      canTrade: false,
      canTrain: true,
      canGiveQuests: true,
      canBeKilled: false,
      mapBindings: [{
        id: uid('npc_map'),
        mapId: 'worldmap-main',
        zoneId: 'arklein',
        spawnType: 'fixed',
        x: 0.56,
        y: 0.79,
        visibleToPlayer: true,
      }],
      trainer: {
        professionIds: ['archer'],
        skillIds: [],
        requiresQuestIds: ['q_path_young_archer'],
        priceGold: 100,
      },
      dialogues: [{ dialogueId: 'dlg_young_archer_trainer_intro', priority: 1 }],
      questBindings: [{ questId: 'q_path_young_archer', role: 'trainer' }],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'npc_artalon_border_guard',
      name: 'Artalon Border Guard',
      title: 'Страж границы',
      status: 'draft',
      kind: 'guard',
      race: 'human',
      kingdomId: 'artalon',
      description: 'Следит за порядком на границе Арталона.',
      portraitUrl: '/assets/placeholders/unknown_portrait.png',
      defaultDisposition: 'neutral',
      isUnique: true,
      canRespawn: true,
      respawnSeconds: 120,
      canFight: true,
      canTalk: true,
      canTrade: false,
      canTrain: false,
      canGiveQuests: true,
      canBeKilled: true,
      mapBindings: [{
        id: uid('npc_map'),
        mapId: 'worldmap-main',
        zoneId: 'artalon_border',
        spawnType: 'fixed',
        x: 0.47,
        y: 0.56,
        visibleToPlayer: true,
      }],
      combat: {
        level: 6,
        role: 'melee',
        hp: 260,
        stamina: 110,
        strength: 18,
        agility: 12,
        endurance: 17,
        physicalArmor: 14,
        magicResist: 6,
        damageMin: 18,
        damageMax: 26,
        skillIds: [],
      },
      dialogues: [{ dialogueId: 'dlg_artalon_border_guard', priority: 1 }],
      questBindings: [{ questId: 'q_oath_border', role: 'giver' }],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'npc_mist_spirit',
      name: 'Mist Spirit',
      title: 'Шепот тумана',
      status: 'draft',
      kind: 'story_character',
      race: 'spirit',
      description: 'Таинственная сущность, появляющаяся при определенных условиях.',
      portraitUrl: '/assets/placeholders/unknown_portrait.png',
      defaultDisposition: 'hidden',
      isUnique: true,
      canRespawn: true,
      respawnSeconds: 300,
      canFight: false,
      canTalk: true,
      canTrade: false,
      canTrain: false,
      canGiveQuests: true,
      canBeKilled: false,
      mapBindings: [{
        id: uid('npc_map'),
        mapId: 'worldmap-main',
        zoneId: 'zone_mist_random',
        spawnType: 'quest_spawn',
        visibleToPlayer: false,
      }],
      dialogues: [{ dialogueId: 'dlg_mist_spirit', priority: 1 }],
      questBindings: [{ questId: 'q_whisper_mist', role: 'lore_source' }],
      conditions: [{ id: uid('cond'), type: 'quest_active', value: 'q_whisper_mist' }],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'npc_bandit_raider',
      name: 'Bandit Raider',
      title: 'Налетчик',
      status: 'draft',
      kind: 'enemy',
      race: 'human',
      description: 'Опасный разбойник, нападающий при встрече.',
      portraitUrl: '/assets/placeholders/enemy_bandit.png',
      combatImageUrl: '/assets/placeholders/enemy_bandit.png',
      iconUrl: '/assets/placeholders/enemy_bandit.png',
      defaultDisposition: 'aggressive_on_sight',
      isUnique: false,
      canRespawn: true,
      respawnSeconds: 90,
      canFight: true,
      canTalk: false,
      canTrade: false,
      canTrain: false,
      canGiveQuests: false,
      canBeKilled: true,
      mapBindings: [{
        id: uid('npc_map'),
        mapId: 'worldmap-main',
        zoneId: 'bandit_wastes',
        spawnType: 'random_in_zone',
        visibleToPlayer: true,
      }],
      combat: {
        level: 4,
        role: 'assassin',
        hp: 210,
        stamina: 130,
        strength: 14,
        agility: 16,
        endurance: 11,
        physicalArmor: 7,
        magicResist: 2,
        damageMin: 12,
        damageMax: 21,
        lootTableId: 'loot_bandit_basic',
        skillIds: [],
      },
      inventory: {
        itemIds: [],
        questItemIds: [],
        lootTableId: 'loot_bandit_basic',
        goldMin: 5,
        goldMax: 25,
      },
      dialogues: [],
      questBindings: [{ questId: 'q_oath_border', role: 'enemy' }],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function getAllNpcs(): NpcDefinition[] {
  return readAll();
}

export function getNpcById(id: string): NpcDefinition | null {
  return readAll().find((entry) => entry.id === id) ?? null;
}

export function saveNpc(npc: NpcDefinition): NpcDefinition {
  const normalized = normalizeNpc(npc);
  const all = readAll();
  const next = [...all.filter((entry) => entry.id !== normalized.id), normalized];
  writeAll(next);
  return normalized;
}

export function deleteNpc(id: string): void {
  writeAll(readAll().filter((entry) => entry.id !== id));
}

export function duplicateNpc(id: string): NpcDefinition {
  const source = getNpcById(id);
  if (!source) {
    throw new Error(`NPC not found: ${id}`);
  }

  const copy: NpcDefinition = {
    ...source,
    id: `${source.id}_copy_${Math.floor(Math.random() * 10000)}`,
    name: `${source.name} Копия`,
    status: 'draft',
    mapBindings: source.mapBindings.map((entry) => ({ ...entry, id: uid('npc_map') })),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  return saveNpc(copy);
}

export function getNpcsByFaction(factionId: string): NpcDefinition[] {
  return readAll().filter((entry) => entry.factionId === factionId);
}

export function getNpcsByCity(cityId: string): NpcDefinition[] {
  return readAll().filter((entry) => entry.cityId === cityId);
}

export function getNpcsByQuest(questId: string): NpcDefinition[] {
  return readAll().filter((entry) => entry.questBindings.some((binding) => binding.questId === questId));
}

export function exportNpcsJson(): string {
  return JSON.stringify(readAll(), null, 2);
}

export function importNpcsJson(json: string): number {
  const parsed = JSON.parse(json) as NpcDefinition[];
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid NPC JSON payload.');
  }

  const normalized = parsed.map((entry) => normalizeNpc(entry));
  writeAll(normalized);
  return normalized.length;
}
