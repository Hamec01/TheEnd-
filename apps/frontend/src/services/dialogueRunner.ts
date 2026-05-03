import { useCallback, useMemo, useReducer } from 'react';
import type { DialogueChoice, DialogueDefinition, DialogueNode } from '../types/dialogue';
import type { NpcDefinition } from '../types/npc';
import type { QuestRuntimePlayer } from './questRuntime';
import { getDialogueById, getDialoguesByNpc } from './dialogueRepository';
import { getNpcById } from './npcRepository';
import { getQuestById } from './questRepository';
import {
  evaluateDialogueConditions,
  executeDialogueActions,
  getAvailableChoices,
  getStartNode,
  type DialogueRuntimeEvent,
  type DialogueRuntimeIntent,
} from './dialogueRuntime';
import { isDialogueCompleted, markDialogueCompleted } from './dialogueProgressStore';
import { selectBestInteractionForNpc } from './npcInteractionSelector';

export type DialogueSourceType = 'npc' | 'location' | 'quest' | 'item' | 'zone' | 'system';

export interface DialogueContext {
  npcId?: string;
  locationId?: string;
  cityId?: string;
  questId?: string;
  sourceType?: DialogueSourceType;
}

type DialogueRunnerState =
  | {
    isOpen: false;
    dialogueId: null;
    nodeId: null;
    context: null;
    dialogueOverride: null;
    notice: null;
    error: null;
  }
  | {
    isOpen: true;
    dialogueId: string;
    nodeId: string;
    context: DialogueContext;
    dialogueOverride: DialogueDefinition | null;
    notice: string | null;
    error: string | null;
  };

type DialogueRunnerAction =
  | { type: 'OPEN'; dialogueId: string; nodeId: string; context: DialogueContext; dialogueOverride?: DialogueDefinition | null }
  | { type: 'CLOSE' }
  | { type: 'SET_NODE'; nodeId: string }
  | { type: 'MERGE_CONTEXT'; context: Partial<DialogueContext> }
  | { type: 'NOTICE'; text: string | null }
  | { type: 'ERROR'; text: string | null };

const CLOSED_STATE: DialogueRunnerState = {
  isOpen: false,
  dialogueId: null,
  nodeId: null,
  context: null,
  dialogueOverride: null,
  notice: null,
  error: null,
};

function reducer(state: DialogueRunnerState, action: DialogueRunnerAction): DialogueRunnerState {
  switch (action.type) {
    case 'OPEN':
      return {
        isOpen: true,
        dialogueId: action.dialogueId,
        nodeId: action.nodeId,
        context: action.context,
        dialogueOverride: action.dialogueOverride ?? null,
        notice: null,
        error: null,
      };
    case 'CLOSE':
      return CLOSED_STATE;
    case 'SET_NODE':
      if (!state.isOpen) {
        return state;
      }
      return { ...state, nodeId: action.nodeId, notice: null, error: null };
    case 'MERGE_CONTEXT':
      if (!state.isOpen) {
        return state;
      }
      return {
        ...state,
        context: { ...state.context, ...action.context },
        notice: null,
        error: null,
      };
    case 'NOTICE':
      if (!state.isOpen) {
        return state;
      }
      return {
        ...state,
        notice: action.text && action.text.includes('\u0403') ? 'Условие не выполнено.' : action.text,
        error: null,
      };
    case 'ERROR':
      if (!state.isOpen) {
        return state;
      }
      return { ...state, error: action.text, notice: null };
    default:
      return state;
  }
}

function pickNpcDialogue(player: QuestRuntimePlayer, npc: NpcDefinition): DialogueDefinition | null {
  const filterCompleted = (dialogue: DialogueDefinition): boolean => {
    const record = isDialogueCompleted(npc.id, dialogue.id);
    if (!record) {
      return true;
    }
    if (record.questId) {
      const quest = getQuestById(record.questId);
      if (quest?.isRepeatable) {
        return true;
      }
    }
    return false;
  };

  const bindingByDialogueId = new Map((npc.dialogues ?? []).map((binding) => [binding.dialogueId, binding]));

  const bindingDialogues = (npc.dialogues ?? [])
    .filter((binding) => evaluateDialogueConditions(player, npc, (binding.conditions as any[]) ?? []))
    .map((binding) => getDialogueById(binding.dialogueId))
    .filter((entry): entry is DialogueDefinition => Boolean(entry));

  const npcDialogues = getDialoguesByNpc(npc.id);
  const all = Array.from(new Map([...bindingDialogues, ...npcDialogues].map((d) => [d.id, d])).values())
    .filter((dialogue) => dialogue.status === 'active')
    .filter(filterCompleted);

  const selected = selectBestInteractionForNpc({
    npc,
    player,
    questDefinitions: [],
    playerQuestStates: [],
    dialogues: all.filter((dialogue) => {
      const binding = bindingByDialogueId.get(dialogue.id);
      if (!binding) {
        return true;
      }
      return evaluateDialogueConditions(player, npc, (binding.conditions as any[]) ?? []);
    }),
  });

  if (selected.kind === 'dialogue') {
    return getDialogueById(selected.dialogueId);
  }

  if (selected.kind === 'npc_menu') {
    return null;
  }

  // quest_scene is handled by world UI; dialogue runner falls back.
  return null;
}

export interface DialogueChoiceResult {
  ended: boolean;
  movedToNodeId: string | null;
  logs: string[];
  intents: DialogueRuntimeIntent[];
  events: DialogueRuntimeEvent[];
}

export interface DialogueRunnerApi {
  state: DialogueRunnerState;
  dialogue: DialogueDefinition | null;
  node: DialogueNode | null;
  npc: NpcDefinition | null;
  choices: Array<DialogueChoice & { disabled: boolean; hidden: boolean }>;
  openDialogue: (dialogueId: string, context?: DialogueContext) => void;
  openDialogueForNpc: (npcId: string, context?: Omit<DialogueContext, 'npcId' | 'sourceType'>) => void;
  closeDialogue: () => void;
  restartDialogue: () => void;
  selectChoice: (choiceId: string) => DialogueChoiceResult | null;
}

export function useDialogueRunner(params: { player: QuestRuntimePlayer }): DialogueRunnerApi {
  const [state, dispatch] = useReducer(reducer, CLOSED_STATE);

  const dialogue = useMemo(() => {
    if (!state.isOpen) {
      return null;
    }
    return state.dialogueOverride ?? getDialogueById(state.dialogueId);
  }, [state.isOpen, state.dialogueId, state.dialogueOverride]);
  const npc = useMemo(() => {
    if (!state.isOpen) {
      return null;
    }
    const npcId = state.context.npcId;
    return npcId ? getNpcById(npcId) : null;
  }, [state.isOpen, state.context]);

  const node = useMemo(() => {
    if (!state.isOpen || !dialogue) {
      return null;
    }
    return dialogue.nodes.find((entry) => entry.id === state.nodeId) ?? null;
  }, [dialogue, state.isOpen, state.nodeId]);

  const choices = useMemo(() => {
    if (!state.isOpen || !node) {
      return [];
    }
    return getAvailableChoices(params.player, npc, node);
  }, [node, npc, params.player, state.isOpen]);

  const openDialogue = useCallback((dialogueId: string, context: DialogueContext = {}) => {
    if (state.isOpen && state.dialogueId === dialogueId) {
      dispatch({
        type: 'MERGE_CONTEXT',
        context: {
          ...context,
          sourceType: context.sourceType ?? state.context.sourceType ?? 'system',
        },
      });
      return;
    }
    const definition = getDialogueById(dialogueId);
    if (!definition) {
      dispatch({ type: 'OPEN', dialogueId, nodeId: 'missing', context: { ...context, sourceType: context.sourceType ?? 'system' } });
      dispatch({ type: 'ERROR', text: `Dialogue not found: ${dialogueId}` });
      return;
    }
    const start = getStartNode(definition);
    if (!start) {
      dispatch({ type: 'OPEN', dialogueId, nodeId: definition.startNodeId || 'missing', context: { ...context, sourceType: context.sourceType ?? 'system' } });
      dispatch({ type: 'ERROR', text: `Start node not found: ${definition.startNodeId}` });
      return;
    }

    dispatch({ type: 'OPEN', dialogueId, nodeId: start.id, context: { ...context, sourceType: context.sourceType ?? 'system' } });
  }, [state.context, state.dialogueId, state.isOpen]);

  const openDialogueForNpc = useCallback((npcId: string, context: Omit<DialogueContext, 'npcId' | 'sourceType'> = {}) => {
    const npc = getNpcById(npcId);
    if (!npc) {
      dispatch({ type: 'OPEN', dialogueId: 'missing', nodeId: 'missing', context: { ...context, npcId, sourceType: 'npc' } });
      dispatch({ type: 'ERROR', text: `NPC not found: ${npcId}` });
      return;
    }
    const picked = pickNpcDialogue(params.player, npc);
    if (!picked) {
      const systemDialogue: DialogueDefinition = {
        id: '__system__already_talked',
        title: 'Already talked',
        npcId,
        status: 'active',
        description: '',
        startNodeId: 'start',
        nodes: [
          {
            id: 'start',
            speaker: 'npc',
            text: 'Мы уже говорили.',
            choices: [{ id: 'leave', text: 'Уйти', end: true } as any],
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      dispatch({
        type: 'OPEN',
        dialogueId: systemDialogue.id,
        nodeId: systemDialogue.startNodeId,
        context: { ...context, npcId, sourceType: 'npc' },
        dialogueOverride: systemDialogue,
      });
      return;
    }

    openDialogue(picked.id, { ...context, npcId, sourceType: 'npc' });
  }, [openDialogue, params.player]);

  const closeDialogue = useCallback(() => {
    dispatch({ type: 'CLOSE' });
  }, []);

  const restartDialogue = useCallback(() => {
    if (!state.isOpen) {
      return;
    }
    openDialogue(state.dialogueId, state.context);
  }, [openDialogue, state]);

  const selectChoice = useCallback((choiceId: string): DialogueChoiceResult | null => {
    if (!state.isOpen || !dialogue) {
      return null;
    }
    const npcId = state.context.npcId;
    const npc = npcId ? getNpcById(npcId) : null;
    const currentNode = dialogue.nodes.find((entry) => entry.id === state.nodeId) ?? null;
    if (!currentNode) {
      dispatch({ type: 'ERROR', text: `Dialogue node not found: ${state.nodeId}` });
      return { ended: false, movedToNodeId: null, logs: [], intents: [], events: [] };
    }

    const choice = currentNode.choices.find((entry) => entry.id === choiceId) ?? null;
    if (!choice) {
      dispatch({ type: 'ERROR', text: `Dialogue choice not found: ${choiceId}` });
      return { ended: false, movedToNodeId: null, logs: [], intents: [], events: [] };
    }

    const conditionsOk = evaluateDialogueConditions(params.player, npc, choice.conditions ?? []);
    if (!conditionsOk) {
      dispatch({ type: 'NOTICE', text: 'Условие не выполнено.' });
      return { ended: false, movedToNodeId: null, logs: [], intents: [], events: [] };
    }

    const derivedActions: any[] = [];
    if (choice.giveQuest) {
      derivedActions.push({ id: `auto-${choice.id}-giveQuest`, type: 'startQuest', questId: choice.giveQuest });
    }
    if (choice.completeQuest) {
      derivedActions.push({ id: `auto-${choice.id}-completeQuest`, type: 'completeQuest', questId: choice.completeQuest });
    }
    if (choice.completeObjective) {
      if (typeof choice.completeObjective === 'string') {
        const questIdFromContext = state.context.questId;
        if (questIdFromContext) {
          derivedActions.push({
            id: `auto-${choice.id}-completeObjective`,
            type: 'completeObjective',
            questId: questIdFromContext,
            objectiveId: choice.completeObjective,
          });
        }
      } else if (choice.completeObjective?.questId && choice.completeObjective.objectiveId) {
        derivedActions.push({
          id: `auto-${choice.id}-completeObjective`,
          type: 'completeObjective',
          questId: choice.completeObjective.questId,
          objectiveId: choice.completeObjective.objectiveId,
        });
      }
    }
    if (choice.completeStep) {
      if (typeof choice.completeStep === 'string') {
        const questIdFromContext = state.context.questId;
        if (questIdFromContext) {
          derivedActions.push({
            id: `auto-${choice.id}-completeStep`,
            type: 'completeStep',
            questId: questIdFromContext,
            key: choice.completeStep,
          });
        }
      } else if (choice.completeStep?.questId) {
        derivedActions.push({
          id: `auto-${choice.id}-completeStep`,
          type: 'completeStep',
          questId: choice.completeStep.questId,
          key: choice.completeStep.stepId,
        });
      }
    }

    const executed = executeDialogueActions(params.player.id, npcId ?? 'system', [
      ...(currentNode.actions ?? []),
      ...(choice.actions ?? []),
      ...derivedActions,
    ], params.player);
    const ended = (choice.endsDialogue ?? choice.end) === true;
    const nextNodeIdRaw = choice.nextNodeId ?? choice.next;
    const nextNodeId = typeof nextNodeIdRaw === 'string' ? nextNodeIdRaw.trim() : '';

    // Debug: help verify we don't lose `next/end/giveQuest` properties during rendering.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('CHOICE CLICK:', choice);
      // eslint-disable-next-line no-console
      console.log('NEXT:', nextNodeId);
    }

    const questIdGiven = (() => {
      if (choice.giveQuest) {
        return choice.giveQuest;
      }
      for (const action of [...(choice.actions ?? []), ...derivedActions]) {
        if (action?.type === 'startQuest' && typeof action.questId === 'string') {
          return action.questId;
        }
      }
      return null;
    })();

    if (questIdGiven && npcId) {
      const started = (executed.intents ?? []).some(
        (intent) => intent.type === 'QUEST_STARTED' && (intent as any).questId === questIdGiven,
      );
      if (started) {
        markDialogueCompleted(npcId, state.dialogueId, { completedAt: new Date().toISOString(), questId: questIdGiven });
      }
    }

    if (nextNodeId) {
      const nextNode = dialogue.nodes.find((entry) => entry.id === nextNodeId) ?? null;
      if (!nextNode) {
        dispatch({ type: 'ERROR', text: `Dialogue node not found: ${nextNodeId}` });
        return { ended: false, movedToNodeId: null, ...executed };
      }
      dispatch({ type: 'SET_NODE', nodeId: nextNode.id });
      return { ended: false, movedToNodeId: nextNode.id, ...executed };
    }

    if (ended) {
      return { ended: true, movedToNodeId: null, ...executed };
    }

    dispatch({ type: 'NOTICE', text: 'Choice has no next or end.' });
    return { ended: false, movedToNodeId: null, ...executed };
  }, [dialogue, params.player, state]);

  return {
    state,
    dialogue,
    node,
    npc,
    choices,
    openDialogue,
    openDialogueForNpc,
    closeDialogue,
    restartDialogue,
    selectChoice,
  };
}
