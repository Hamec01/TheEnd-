export interface DialogueProgressRecord {
  completedAt: string;
  questId?: string | null;
}

export type CompletedDialoguesState = Record<string, Record<string, DialogueProgressRecord>>;

const STORAGE_KEY = 'theend.dialogueProgress.completedDialogues';

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

export function readCompletedDialogues(): CompletedDialoguesState {
  if (typeof window === 'undefined') {
    return {};
  }
  return safeParse<CompletedDialoguesState>(window.localStorage.getItem(STORAGE_KEY), {});
}

export function writeCompletedDialogues(state: CompletedDialoguesState): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isDialogueCompleted(npcId: string, dialogueId: string): DialogueProgressRecord | null {
  const state = readCompletedDialogues();
  return state[npcId]?.[dialogueId] ?? null;
}

export function markDialogueCompleted(npcId: string, dialogueId: string, record: DialogueProgressRecord): void {
  const state = readCompletedDialogues();
  const npcMap = state[npcId] ?? {};
  state[npcId] = { ...npcMap, [dialogueId]: record };
  writeCompletedDialogues(state);
}

