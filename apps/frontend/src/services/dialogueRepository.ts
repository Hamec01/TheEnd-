import { nowIso } from './content/storage';
import type { DialogueDefinition } from '../types/dialogue';

const DIALOGUES_KEY = 'theend.dialogues';

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

function writeAll(values: DialogueDefinition[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(DIALOGUES_KEY, JSON.stringify(values));
}

function seedDialogues(): DialogueDefinition[] {
  const now = nowIso();
  return [
    {
      id: 'dlg_ash_market_merchant_intro',
      title: 'Ash Market Merchant Intro',
      npcId: 'npc_ash_market_merchant',
      status: 'draft',
      description: 'Стартовый диалог торговца с возможностью запуска квеста.',
      startNodeId: 'n_intro',
      nodes: [
        {
          id: 'n_intro',
          speaker: 'npc',
          text: 'Добро пожаловать на Пепельный рынок. Нужно поручение?',
          choices: [
            {
              id: 'c_take_quest',
              text: 'Да, есть работа?',
              nextNodeId: 'n_quest_offer',
              questIconMode: 'start',
            },
            {
              id: 'c_open_shop',
              text: 'Покажи товары.',
              endsDialogue: true,
              actions: [{ id: 'a_open_shop', type: 'openShop' }],
            },
          ],
        },
        {
          id: 'n_quest_offer',
          speaker: 'npc',
          text: 'Доставь письмо нашему человеку в городе.',
          choices: [
            {
              id: 'c_accept',
              text: 'Берусь.',
              endsDialogue: true,
              questIconMode: 'start',
              actions: [{ id: 'a_start_q', type: 'startQuest', questId: 'q_letter_ash_market' }],
            },
            {
              id: 'c_refuse',
              text: 'Не сейчас.',
              endsDialogue: true,
            },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'dlg_young_archer_trainer_intro',
      title: 'Young Archer Trainer Intro',
      npcId: 'npc_young_archer_trainer',
      status: 'draft',
      startNodeId: 'n_archer_intro',
      nodes: [
        {
          id: 'n_archer_intro',
          speaker: 'npc',
          text: 'Стойка, дыхание, терпение. Готов учиться?',
          choices: [
            {
              id: 'c_archer_start',
              text: 'Да, начинаем.',
              endsDialogue: true,
              questIconMode: 'start',
              actions: [{ id: 'a_archer_start', type: 'startQuest', questId: 'q_path_young_archer' }],
            },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'dlg_artalon_border_guard',
      title: 'Artalon Border Guard',
      npcId: 'npc_artalon_border_guard',
      status: 'draft',
      startNodeId: 'n_guard_intro',
      nodes: [
        {
          id: 'n_guard_intro',
          speaker: 'npc',
          text: 'Граница должна быть чистой. Есть задание.',
          choices: [
            {
              id: 'c_guard_oath',
              text: 'Я помогу.',
              endsDialogue: true,
              questIconMode: 'start',
              actions: [{ id: 'a_guard_start', type: 'startQuest', questId: 'q_oath_border' }],
            },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'dlg_mist_spirit',
      title: 'Mist Spirit',
      npcId: 'npc_mist_spirit',
      status: 'draft',
      startNodeId: 'n_mist_intro',
      nodes: [
        {
          id: 'n_mist_intro',
          speaker: 'npc',
          text: 'Слушай туман, и он покажет путь.',
          choices: [
            {
              id: 'c_mist_continue',
              text: 'Я слушаю.',
              endsDialogue: true,
              questIconMode: 'continue',
              actions: [{ id: 'a_mist_advance', type: 'advanceQuest', questId: 'q_whisper_mist' }],
            },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function readAll(): DialogueDefinition[] {
  if (typeof window === 'undefined') {
    return [];
  }
  const parsed = safeParse<DialogueDefinition[]>(window.localStorage.getItem(DIALOGUES_KEY), []);
  if (parsed.length > 0) {
    return parsed;
  }

  const seeded = seedDialogues();
  writeAll(seeded);
  return seeded;
}

function normalizeDialogue(dialogue: DialogueDefinition): DialogueDefinition {
  const now = nowIso();
  return {
    ...dialogue,
    id: dialogue.id.trim(),
    title: dialogue.title.trim(),
    startNodeId: dialogue.startNodeId.trim(),
    nodes: Array.isArray(dialogue.nodes) ? dialogue.nodes : [],
    createdAt: dialogue.createdAt || now,
    updatedAt: now,
  };
}

export function getAllDialogues(): DialogueDefinition[] {
  return readAll();
}

export function getDialogueById(id: string): DialogueDefinition | null {
  return readAll().find((entry) => entry.id === id) ?? null;
}

export function getDialoguesByNpc(npcId: string): DialogueDefinition[] {
  return readAll().filter((entry) => entry.npcId === npcId);
}

export function saveDialogue(dialogue: DialogueDefinition): DialogueDefinition {
  const normalized = normalizeDialogue(dialogue);
  const all = readAll();
  const next = [...all.filter((entry) => entry.id !== normalized.id), normalized];
  writeAll(next);
  return normalized;
}

export function deleteDialogue(id: string): void {
  writeAll(readAll().filter((entry) => entry.id !== id));
}

export function duplicateDialogue(id: string): DialogueDefinition {
  const source = getDialogueById(id);
  if (!source) {
    throw new Error(`Dialogue not found: ${id}`);
  }

  const copy: DialogueDefinition = {
    ...source,
    id: `${source.id}_copy_${Math.floor(Math.random() * 10000)}`,
    title: `${source.title} Copy`,
    status: 'draft',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    nodes: source.nodes.map((node) => ({
      ...node,
      choices: node.choices.map((choice) => ({ ...choice })),
      actions: node.actions ? node.actions.map((entry) => ({ ...entry })) : undefined,
      conditions: node.conditions ? node.conditions.map((entry) => ({ ...entry })) : undefined,
    })),
  };

  return saveDialogue(copy);
}

export function exportDialoguesJson(): string {
  return JSON.stringify(readAll(), null, 2);
}

export function importDialoguesJson(json: string): number {
  const parsed = JSON.parse(json) as DialogueDefinition[];
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid dialogue JSON payload.');
  }
  const next = parsed.map((entry) => normalizeDialogue(entry));
  writeAll(next);
  return next.length;
}
