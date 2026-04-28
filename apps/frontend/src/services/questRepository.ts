import { nowIso, uid } from './content/storage';
import type {
  PlayerQuestState,
  QuestDefinition,
  QuestItemDefinition,
  RandomQuestCooldown,
} from '../types/quest';

const QUESTS_KEY = 'theend.quests';
const QUEST_ITEMS_KEY = 'theend.questItems';
const PLAYER_QUESTS_KEY = 'theend.playerQuests';
const RANDOM_ZONE_COOLDOWNS_KEY = 'theend.questRandomZoneCooldowns';

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

function readArray<T>(key: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return safeParse<T[]>(window.localStorage.getItem(key), []);
}

function writeArray<T>(key: string, values: T[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(values));
}

function ensureQuestDefaults(quests: QuestDefinition[]): QuestDefinition[] {
  if (quests.length > 0) {
    return quests;
  }

  const now = nowIso();
  return [
    {
      id: 'q_letter_ash_market',
      title: 'Letter from the Ash Market',
      adminDescription: 'Starter NPC delivery quest for smoke-testing NPC -> NPC flow.',
      playerDescription: 'A courier from Ash Market asks you to deliver a sealed letter to a city contact.',
      category: 'npc',
      status: 'draft',
      cityId: 'arklein',
      npcId: 'npc_ash_courier',
      recommendedLevel: 1,
      minLevel: 1,
      isRepeatable: false,
      isHidden: false,
      portraitUrl: '/assets/placeholders/unknown_portrait.png',
      imageUrl: '/assets/placeholders/npc_merchant.png',
      bannerUrl: '/assets/placeholders/quest_banner.png',
      steps: [
        {
          id: 'step_receive_letter',
          questId: 'q_letter_ash_market',
          title: 'Receive the sealed letter',
          journalText: 'Talk to the courier and receive the sealed delivery letter.',
          order: 1,
          objectives: [
            {
              id: 'obj_receive_letter',
              type: 'collect_item',
              description: 'Receive the sealed letter.',
              questItemId: 'qi_sealed_letter',
              requiredCount: 1,
            },
          ],
          nextStepId: 'step_deliver_letter',
        },
        {
          id: 'step_deliver_letter',
          questId: 'q_letter_ash_market',
          title: 'Deliver the letter',
          journalText: 'Deliver the letter to the Ash Market contact.',
          order: 2,
          objectives: [
            {
              id: 'obj_deliver_letter',
              type: 'deliver_item',
              description: 'Deliver the sealed letter to npc_ash_contact.',
              npcId: 'npc_ash_contact',
              questItemId: 'qi_sealed_letter',
              requiredCount: 1,
            },
          ],
        },
      ],
      triggers: [
        {
          id: 'trg_npc_start_letter',
          type: 'npc_dialogue',
          npcId: 'npc_ash_courier',
          dialogueId: 'dlg_ash_courier',
        },
      ],
      conditions: [],
      rewards: [
        { id: 'rw_letter_gold', type: 'gold', amount: 50 },
        { id: 'rw_letter_rep', type: 'reputation', targetId: 'arklein_merchants', amount: 5 },
      ],
      failureConsequences: [],
      flags: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'q_missing_apprentice',
      title: 'Missing Apprentice',
      adminDescription: 'City investigation quest with marker + inspect objective.',
      playerDescription: 'A worried artisan asks you to find their missing apprentice near the old district.',
      category: 'city',
      status: 'draft',
      cityId: 'arklein',
      recommendedLevel: 2,
      minLevel: 1,
      isRepeatable: false,
      isHidden: false,
      portraitUrl: '/assets/placeholders/unknown_portrait.png',
      bannerUrl: '/assets/placeholders/quest_banner.png',
      steps: [
        {
          id: 'step_reach_site',
          questId: 'q_missing_apprentice',
          title: 'Reach the old district marker',
          journalText: 'Travel to the old district and inspect the marked location.',
          order: 1,
          objectives: [
            {
              id: 'obj_reach_marker',
              type: 'reach_marker',
              description: 'Reach marker mk_old_district_trace.',
              markerId: 'mk_old_district_trace',
            },
            {
              id: 'obj_inspect_trace',
              type: 'inspect_object',
              description: 'Inspect the object at the marker.',
              targetId: 'obj_apprentice_bag',
            },
          ],
          nextStepId: 'step_report_back',
        },
        {
          id: 'step_report_back',
          questId: 'q_missing_apprentice',
          title: 'Return to the artisan',
          journalText: 'Return and report your findings.',
          order: 2,
          objectives: [
            {
              id: 'obj_report_back',
              type: 'talk_to_npc',
              description: 'Talk to npc_artisan_master.',
              npcId: 'npc_artisan_master',
            },
          ],
        },
      ],
      triggers: [
        {
          id: 'trg_missing_apprentice_start',
          type: 'manual_admin',
        },
      ],
      conditions: [],
      rewards: [
        { id: 'rw_missing_gold', type: 'gold', amount: 80 },
      ],
      failureConsequences: [],
      flags: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'q_path_young_archer',
      title: 'Path of the Young Archer',
      adminDescription: 'Profession unlock quest for archer.',
      playerDescription: 'Train with the range master and prove your discipline.',
      category: 'profession',
      status: 'draft',
      cityId: 'arklein',
      npcId: 'npc_range_master',
      recommendedLevel: 3,
      minLevel: 2,
      isRepeatable: false,
      isHidden: false,
      portraitUrl: '/assets/placeholders/unknown_portrait.png',
      bannerUrl: '/assets/placeholders/quest_banner.png',
      steps: [
        {
          id: 'step_archer_talk',
          questId: 'q_path_young_archer',
          title: 'Speak with the range master',
          journalText: 'Receive your training assignment.',
          order: 1,
          objectives: [
            {
              id: 'obj_archer_talk',
              type: 'talk_to_npc',
              description: 'Talk to npc_range_master.',
              npcId: 'npc_range_master',
            },
          ],
          nextStepId: 'step_archer_trial',
        },
        {
          id: 'step_archer_trial',
          questId: 'q_path_young_archer',
          title: 'Complete the range trial',
          journalText: 'Survive the trial battle and report back.',
          order: 2,
          objectives: [
            {
              id: 'obj_archer_trial',
              type: 'survive_battle',
              description: 'Complete the training battle.',
              targetId: 'arena_archer_trial',
            },
          ],
        },
      ],
      triggers: [{ id: 'trg_archer_start', type: 'profession_unlock' }],
      conditions: [],
      rewards: [
        { id: 'rw_archer_profession', type: 'profession', targetId: 'archer' },
      ],
      failureConsequences: [],
      flags: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'q_whisper_mist',
      title: 'Whisper in the Mist',
      adminDescription: 'Random zone quest prototype with hidden marker.',
      playerDescription: 'A whisper in the mist draws you to investigate a hidden sign.',
      category: 'random',
      status: 'draft',
      isRepeatable: true,
      isHidden: true,
      portraitUrl: '/assets/placeholders/unknown_portrait.png',
      bannerUrl: '/assets/placeholders/quest_banner.png',
      steps: [
        {
          id: 'step_whisper_inspect',
          questId: 'q_whisper_mist',
          title: 'Inspect the hidden marker',
          journalText: 'Find and inspect the hidden marker in the mist zone.',
          order: 1,
          objectives: [
            {
              id: 'obj_whisper_marker',
              type: 'inspect_object',
              description: 'Inspect hidden marker mk_whisper_stone.',
              markerId: 'mk_whisper_stone',
              targetId: 'mk_whisper_stone',
            },
          ],
        },
      ],
      triggers: [
        {
          id: 'trg_whisper_random',
          type: 'random_zone_roll',
          zoneId: 'zone_mist_random',
          chancePercent: 20,
          cooldownSeconds: 180,
        },
      ],
      conditions: [],
      rewards: [{ id: 'rw_whisper_lore', type: 'lore_entry', targetId: 'lore_whisper_mist' }],
      failureConsequences: [],
      flags: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'q_oath_border',
      title: 'Oath of the Border',
      adminDescription: 'Kingdom border quest scaffold for Artalon.',
      playerDescription: 'Patrol the Artalon border and secure the marked perimeter.',
      category: 'kingdom',
      status: 'draft',
      kingdomId: 'artalon',
      minLevel: 4,
      recommendedLevel: 5,
      isRepeatable: false,
      isHidden: false,
      portraitUrl: '/assets/placeholders/unknown_portrait.png',
      bannerUrl: '/assets/placeholders/quest_banner.png',
      steps: [
        {
          id: 'step_border_clear',
          questId: 'q_oath_border',
          title: 'Secure border marker',
          journalText: 'Inspect and clear the border marker objective.',
          order: 1,
          objectives: [
            {
              id: 'obj_border_marker',
              type: 'reach_marker',
              description: 'Reach border marker mk_artalon_border.',
              markerId: 'mk_artalon_border',
            },
          ],
        },
      ],
      triggers: [{ id: 'trg_oath_border_start', type: 'manual_admin' }],
      conditions: [],
      rewards: [
        { id: 'rw_oath_gold', type: 'gold', amount: 160 },
        { id: 'rw_oath_rep', type: 'reputation', targetId: 'artalon', amount: 15 },
      ],
      failureConsequences: [],
      flags: {},
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function ensureQuestItemDefaults(items: QuestItemDefinition[]): QuestItemDefinition[] {
  if (items.length > 0) {
    return items;
  }

  return [
    {
      id: 'qi_sealed_letter',
      name: 'Sealed Letter',
      description: 'Official letter from Ash Market.',
      iconUrl: '/assets/placeholders/npc_merchant.png',
      imageUrl: '/assets/placeholders/unknown_portrait.png',
      linkedQuestId: 'q_letter_ash_market',
      canDrop: false,
      canSell: false,
      canTrade: false,
      removeOnQuestComplete: true,
      showInQuestInventory: true,
    },
  ];
}

function normalizedQuest(input: QuestDefinition): QuestDefinition {
  const now = nowIso();
  return {
    ...input,
    id: input.id.trim(),
    title: input.title.trim(),
    adminDescription: input.adminDescription ?? '',
    playerDescription: input.playerDescription ?? '',
    steps: Array.isArray(input.steps) ? input.steps : [],
    triggers: Array.isArray(input.triggers) ? input.triggers : [],
    conditions: Array.isArray(input.conditions) ? input.conditions : [],
    rewards: Array.isArray(input.rewards) ? input.rewards : [],
    failureConsequences: Array.isArray(input.failureConsequences) ? input.failureConsequences : [],
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

function normalizedQuestItem(input: QuestItemDefinition): QuestItemDefinition {
  return {
    ...input,
    id: input.id.trim(),
    name: input.name.trim(),
    description: input.description ?? '',
    canDrop: Boolean(input.canDrop),
    canSell: Boolean(input.canSell),
    canTrade: Boolean(input.canTrade),
    removeOnQuestComplete: input.removeOnQuestComplete !== false,
    showInQuestInventory: input.showInQuestInventory !== false,
  };
}

function getStoredQuests(): QuestDefinition[] {
  const quests = ensureQuestDefaults(readArray<QuestDefinition>(QUESTS_KEY)).map(normalizedQuest);
  writeArray(QUESTS_KEY, quests);
  return quests;
}

function getStoredQuestItems(): QuestItemDefinition[] {
  const items = ensureQuestItemDefaults(readArray<QuestItemDefinition>(QUEST_ITEMS_KEY)).map(normalizedQuestItem);
  writeArray(QUEST_ITEMS_KEY, items);
  return items;
}

export function getAllQuests(): QuestDefinition[] {
  return getStoredQuests();
}

export function getQuestById(id: string): QuestDefinition | null {
  return getStoredQuests().find((quest) => quest.id === id) ?? null;
}

export function saveQuest(quest: QuestDefinition): QuestDefinition {
  const normalized = normalizedQuest({
    ...quest,
    id: quest.id.trim() || uid('quest'),
  });

  const quests = getStoredQuests();
  const next = [...quests.filter((entry) => entry.id !== normalized.id), normalized];
  writeArray(QUESTS_KEY, next);
  return normalized;
}

export function deleteQuest(id: string): void {
  const next = getStoredQuests().filter((quest) => quest.id !== id);
  writeArray(QUESTS_KEY, next);
}

export function duplicateQuest(id: string): QuestDefinition {
  const source = getQuestById(id);
  if (!source) {
    throw new Error(`Quest not found: ${id}`);
  }

  const suffix = Math.floor(Math.random() * 10000);
  const copy: QuestDefinition = {
    ...source,
    id: `${source.id}_copy_${suffix}`,
    title: `${source.title} Copy`,
    status: 'draft',
    updatedAt: nowIso(),
    createdAt: nowIso(),
  };

  return saveQuest(copy);
}

export function getQuestItems(): QuestItemDefinition[] {
  return getStoredQuestItems();
}

export function getQuestItemById(id: string): QuestItemDefinition | null {
  return getStoredQuestItems().find((item) => item.id === id) ?? null;
}

export function saveQuestItem(item: QuestItemDefinition): QuestItemDefinition {
  const normalized = normalizedQuestItem({
    ...item,
    id: item.id.trim() || uid('quest_item'),
  });

  const items = getStoredQuestItems();
  const next = [...items.filter((entry) => entry.id !== normalized.id), normalized];
  writeArray(QUEST_ITEMS_KEY, next);
  return normalized;
}

export function deleteQuestItem(id: string): void {
  const next = getStoredQuestItems().filter((item) => item.id !== id);
  writeArray(QUEST_ITEMS_KEY, next);
}

export function exportQuestsJson(): string {
  return JSON.stringify(
    {
      quests: getStoredQuests(),
      questItems: getStoredQuestItems(),
    },
    null,
    2,
  );
}

export function importQuestsJson(raw: string): { quests: number; questItems: number } {
  const parsed = JSON.parse(raw) as { quests?: QuestDefinition[]; questItems?: QuestItemDefinition[] };
  const quests = Array.isArray(parsed.quests) ? parsed.quests.map(normalizedQuest) : [];
  const questItems = Array.isArray(parsed.questItems) ? parsed.questItems.map(normalizedQuestItem) : [];

  if (quests.length > 0) {
    writeArray(QUESTS_KEY, quests);
  }
  if (questItems.length > 0) {
    writeArray(QUEST_ITEMS_KEY, questItems);
  }

  return {
    quests: quests.length,
    questItems: questItems.length,
  };
}

export function getAllPlayerQuestStates(): PlayerQuestState[] {
  return readArray<PlayerQuestState>(PLAYER_QUESTS_KEY);
}

export function savePlayerQuestState(nextState: PlayerQuestState): void {
  const states = readArray<PlayerQuestState>(PLAYER_QUESTS_KEY);
  const next = [
    ...states.filter((entry) => !(entry.playerId === nextState.playerId && entry.questId === nextState.questId)),
    nextState,
  ];
  writeArray(PLAYER_QUESTS_KEY, next);
}

export function getRandomZoneCooldowns(): RandomQuestCooldown[] {
  return readArray<RandomQuestCooldown>(RANDOM_ZONE_COOLDOWNS_KEY);
}

export function saveRandomZoneCooldown(cooldown: RandomQuestCooldown): void {
  const values = getRandomZoneCooldowns();
  const next = [
    ...values.filter((entry) => !(entry.playerId === cooldown.playerId && entry.zoneId === cooldown.zoneId)),
    cooldown,
  ];
  writeArray(RANDOM_ZONE_COOLDOWNS_KEY, next);
}
