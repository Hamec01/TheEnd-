import { useCallback, useMemo, useReducer } from 'react';
import type { DialogueChoice, DialogueDefinition, DialogueNode } from '../types/dialogue';
import type { NpcDefinition } from '../types/npc';
import { handleQuestEvent, type QuestRuntimePlayer } from './questRuntime';
import { getDialogueById, getDialoguesByNpc } from './dialogueRepository';
import { getNpcById } from './npcRepository';
import {
  evaluateDialogueConditions,
  executeDialogueActions,
  getAvailableChoices,
  getStartNode,
  type DialogueRuntimeEvent,
  type DialogueRuntimeIntent,
} from './dialogueRuntime';
import { markDialogueCompleted } from './dialogueProgressStore';
import { selectBestInteractionForNpc } from './npcInteractionSelector';

export type DialogueSourceType = 'npc' | 'location' | 'location_place' | 'quest' | 'item' | 'zone' | 'system';

export interface DialogueContext {
  npcId?: string;
  locationId?: string;
  placeId?: string;
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
  const bindingByDialogueId = new Map((npc.dialogues ?? []).map((binding) => [binding.dialogueId, binding]));

  const bindingDialogues = (npc.dialogues ?? [])
    .filter((binding) => evaluateDialogueConditions(player, npc, (binding.conditions as any[]) ?? []))
    .map((binding) => getDialogueById(binding.dialogueId))
    .filter((entry): entry is DialogueDefinition => Boolean(entry));

  const npcDialogues = getDialoguesByNpc(npc.id);
  const all = Array.from(new Map([...bindingDialogues, ...npcDialogues].map((d) => [d.id, d])).values())
    .filter((dialogue) => dialogue.status === 'active');

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
  selectChoice: (choiceId: string) => Promise<DialogueChoiceResult | null>;
}

export function useDialogueRunner(params: {
  player: QuestRuntimePlayer;
  onStartQuest?: (questId: string) => Promise<void> | void;
}): DialogueRunnerApi {
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
    const npc = context.npcId ? getNpcById(context.npcId) : null;
    const start = getStartNode(definition, params.player, npc);
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
        id: '__system__no_dialogue',
        title: 'Нет доступной реплики',
        npcId,
        status: 'active',
        description: '',
        startNodeId: 'start',
        nodes: [
          {
            id: 'start',
            speaker: 'npc',
            text: 'Нет доступной реплики.',
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

  const selectChoice = useCallback(async (choiceId: string): Promise<DialogueChoiceResult | null> => {
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
      if (choiceId === '__leave__') {
        return { ended: true, movedToNodeId: null, logs: [], intents: [], events: [] };
      }
      dispatch({ type: 'ERROR', text: `Dialogue choice not found: ${choiceId}` });
      return { ended: false, movedToNodeId: null, logs: [], intents: [], events: [] };
    }

    const conditionsOk = evaluateDialogueConditions(params.player, npc, choice.conditions ?? []);
    if (!conditionsOk) {
      dispatch({ type: 'NOTICE', text: 'Условие не выполнено.' });
      return { ended: false, movedToNodeId: null, logs: [], intents: [], events: [] };
    }

    const effectActions = Array.isArray(choice.effects) ? choice.effects : [];
    const questIdsToStart = new Set<string>();

    if (typeof choice.giveQuest === 'string' && choice.giveQuest.trim()) {
      questIdsToStart.add(choice.giveQuest.trim());
    }
    for (const effect of effectActions) {
      if (
        effect &&
        effect.type === 'start_quest' &&
        typeof effect.questId === 'string' &&
        effect.questId.trim()
      ) {
        questIdsToStart.add(effect.questId.trim());
      }
    }

    const derivedActions: any[] = Array.from(questIdsToStart).map((questId) => ({
      id: `auto-${choice.id}-startQuest-${questId}`,
      type: 'startQuest',
      questId,
    }));
    if (import.meta.env.DEV && questIdsToStart.size > 0) {
      // eslint-disable-next-line no-console
      console.log('[dialogueRunner] choice quest starts:', Array.from(questIdsToStart));
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
      ...effectActions.filter((effect) => !(effect.type === 'start_quest' && typeof effect.questId === 'string' && questIdsToStart.has(effect.questId.trim()))),
      ...derivedActions,
    ], params.player);

    const questEventResult = handleQuestEvent(params.player, {
      type: 'dialogue_choice',
      npcId: npcId ?? undefined,
      dialogueId: state.dialogueId,
      nodeId: state.nodeId,
      choiceId,
    });

    const merged = {
      logs: [...(executed.logs ?? []), ...(questEventResult.logs ?? [])],
      intents: [
        ...(executed.intents ?? []),
        ...questEventResult.startedQuestIds.map((questId) => ({ type: 'QUEST_STARTED' as const, questId })),
        ...questEventResult.advancedQuestIds.map((questId) => ({ type: 'QUEST_ADVANCED' as const, questId })),
        ...questEventResult.completedQuestIds.map((questId) => ({ type: 'QUEST_COMPLETED' as const, questId })),
      ],
      events: executed.events ?? [],
    };

    const startedQuestIds = Array.from(new Set(
      merged.intents
        .filter((intent) => intent.type === 'QUEST_STARTED')
        .map((intent) => intent.questId),
    ));
    for (const questId of startedQuestIds) {
      await params.onStartQuest?.(questId);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[dialogueRunner] quest started:', questId);
      }
    }
    if (import.meta.env.DEV) {
      const startedQuestIdsSet = new Set(startedQuestIds);
      for (const questId of questIdsToStart) {
        if (startedQuestIdsSet.has(questId)) {
          continue;
        }
        const duplicateLogFound = (merged.logs ?? []).some((line) => (
          line === `Quest already active: ${questId}` ||
          line === `Quest not repeatable: ${questId}` ||
          line === `Quest cannot start (${questId}): Quest already active/completed and not repeatable.`
        ));
        if (duplicateLogFound) {
          // eslint-disable-next-line no-console
          console.log('[dialogueRunner] quest already active/completed:', questId);
        }
      }
    }

    const ended = (choice.endsDialogue ?? choice.end) === true;
    const nextNodeIdRaw = choice.nextNodeId ?? choice.next;
    const nextNodeId = typeof nextNodeIdRaw === 'string' ? nextNodeIdRaw.trim() : '';

    // Debug: help verify we don't lose `next/end/giveQuest` properties during rendering.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('CHOICE CLICK:', choice);
      // eslint-disable-next-line no-console
      console.log('NEXT:', nextNodeIdRaw);
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
      const started = (merged.intents ?? []).some(
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
        return { ended: false, movedToNodeId: null, ...merged };
      }
      dispatch({ type: 'SET_NODE', nodeId: nextNode.id });
      return { ended: false, movedToNodeId: nextNode.id, ...merged };
    }

    if (ended) {
      return { ended: true, movedToNodeId: null, ...merged };
    }

    // BUGFIX: treat `end` as the only true terminal marker; treat `next` as missing only when null/undefined/empty.
    const hasNext = Boolean(nextNodeId && nextNodeId.trim().length > 0);
    if (!hasNext) {
      dispatch({ type: 'NOTICE', text: 'Choice has no next or end.' });
    }
    return { ended: false, movedToNodeId: null, ...merged };
  }, [dialogue, params.onStartQuest, params.player, state]);

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
