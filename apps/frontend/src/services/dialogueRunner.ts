import { useCallback, useMemo, useReducer } from 'react';
import type { DialogueChoice, DialogueDefinition, DialogueNode } from '../types/dialogue';
import type { NpcDefinition } from '../types/npc';
import { getPlayerQuestState, handleQuestEvent, type QuestRuntimePlayer } from './questRuntime';
import { getDialogueById, getDialoguesByNpc } from './dialogueRepository';
import { getNpcById } from './npcRepository';
import { getQuestById } from './questRepository';
import {
  choiceShorthandToActions,
  evaluateDialogueConditions,
  executeDialogueActions,
  getAvailableChoices,
  getChoiceExplicitActions,
  getStartNode,
  type DialogueRuntimeEvent,
  type DialogueRuntimeIntent,
} from './dialogueRuntime';
import { markDialogueCompleted } from './dialogueProgressStore';
import { selectBestInteractionForNpc } from './npcInteractionSelector';
import { loadCharacterProfile } from './characterProfileStorage';

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

function normalizeRaceId(value: string | null | undefined): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^race_/, '');
  if (normalized === 'high_elf' || normalized === 'forest_elf' || normalized === 'wood_elf' || normalized === 'ancient_elf' || normalized === 'dark_elf') {
    return 'elf';
  }
  return normalized;
}

function normalizeKingdomId(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^origin_/, '')
    .replace(/^kingdom_/, '')
    .replace(/_kingdom$/, '')
    .replace(/\s+/g, '_');
}

function resolvePlayerOriginKingdomId(characterId: string): string {
  const profile = loadCharacterProfile(characterId);
  if (!profile) {
    return '';
  }
  const fromOrigin = normalizeKingdomId(profile.originId);
  if (fromOrigin) {
    return fromOrigin;
  }
  const fromKingdom = normalizeKingdomId(profile.kingdomId);
  if (fromKingdom) {
    return fromKingdom;
  }
  return normalizeKingdomId(profile.citizenshipKingdomId);
}

function getRaceAddress(characterId: string): string {
  const race = normalizeRaceId(loadCharacterProfile(characterId)?.raceId);
  if (race === 'dwarf') {
    return 'гном';
  }
  if (race === 'elf') {
    return 'эльф';
  }
  if (race === 'human') {
    return 'человек';
  }
  return 'путник';
}

function getRaceDisplay(characterId: string): string {
  const raceRaw = String(loadCharacterProfile(characterId)?.raceId ?? '').trim().toLowerCase().replace(/^race_/, '');
  if (raceRaw === 'high_elf') {
    return 'Высший эльф';
  }
  const race = normalizeRaceId(raceRaw);
  if (race === 'elf') {
    return 'Эльф';
  }
  if (race === 'dwarf') {
    return 'Гном';
  }
  if (race === 'human') {
    return 'Человек';
  }
  return 'Путник';
}

function getKingdomLabelRu(kingdomId: string): string {
  const normalized = normalizeKingdomId(kingdomId);
  switch (normalized) {
    case 'terimia':
      return 'Теримии';
    case 'artalon':
      return 'Арталона';
    case 'luminor':
      return 'Люминора';
    case 'kriantar':
      return 'Криантара';
    case 'argos':
      return 'Аргоса';
    default:
      return normalized || 'чужих земель';
  }
}

function resolveNpcKingdomId(npc: NpcDefinition | null | undefined): string {
  if (!npc) {
    return '';
  }

  const directKingdomId = normalizeKingdomId(npc.kingdomId);
  if (directKingdomId) {
    return directKingdomId;
  }

  const bindings = Array.isArray(npc.questBindings) ? npc.questBindings : [];
  if (bindings.length === 0) {
    return '';
  }

  const boundKingdomIds = Array.from(new Set(
    bindings
      .map((binding) => getQuestById(String(binding.questId ?? '').trim()))
      .map((quest) => normalizeKingdomId(quest?.kingdomId))
      .filter((kingdomId) => Boolean(kingdomId)),
  ));

  return boundKingdomIds.length === 1 ? boundKingdomIds[0] : '';
}

function buildArgosOutsiderIntro(playerId: string): string {
  const raceLabel = getRaceDisplay(playerId);
  const raceAddress = getRaceAddress(playerId);
  const playerKingdomId = resolvePlayerOriginKingdomId(playerId);

  if (raceAddress === 'человек' && playerKingdomId && playerKingdomId !== 'argos') {
    return `— Что тут забыл человек из ${getKingdomLabelRu(playerKingdomId)}? В Аргосе чужаков замечают сразу.`;
  }

  return `— О! ${raceLabel}? В нашем городе? Ладно, говори, что тебе нужно.`;
}

function withIntroOnStartNode(dialogue: DialogueDefinition, introText: string): DialogueDefinition {
  if (!introText.trim()) {
    return dialogue;
  }

  const nodes = Array.isArray(dialogue.nodes) ? dialogue.nodes : [];
  const startNodeIndex = nodes.findIndex((node) => node.id === dialogue.startNodeId);
  if (startNodeIndex < 0) {
    return dialogue;
  }

  const startNode = nodes[startNodeIndex];
  const currentText = String(startNode.text ?? '');
  if (currentText.includes(introText)) {
    return dialogue;
  }

  const nextNodes = nodes.slice();
  nextNodes[startNodeIndex] = {
    ...startNode,
    text: `${introText}\n\n${currentText}`.trim(),
  };

  return {
    ...dialogue,
    id: `${dialogue.id}__outsider_intro`,
    nodes: nextNodes,
  };
}

function collectChoiceQuestStartIds(choice: DialogueChoice): string[] {
  const questIds = new Set<string>();
  const giveQuestId = String(choice.giveQuest ?? '').trim();
  if (giveQuestId) {
    questIds.add(giveQuestId);
  }

  const actionPool = [
    ...(Array.isArray(choice.actions) ? choice.actions : []),
    ...(Array.isArray(choice.effects) ? choice.effects : []),
  ] as Array<{ type?: unknown; questId?: unknown }>;

  for (const action of actionPool) {
    const type = String(action?.type ?? '').trim().toLowerCase();
    if (type !== 'startquest' && type !== 'start_quest') {
      continue;
    }
    const questId = String(action?.questId ?? '').trim();
    if (questId) {
      questIds.add(questId);
    }
  }

  return Array.from(questIds);
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

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeQuestConditionType(rawType: string): string {
  switch (rawType) {
    case 'questActive':
      return 'quest_active';
    case 'questCompleted':
      return 'quest_completed';
    case 'questNotStarted':
      return 'quest_not_started';
    case 'questFailed':
      return 'quest_failed';
    default:
      return rawType;
  }
}

function extractQuestIdsFromConditions(conditions: Array<{ type?: unknown; questId?: unknown; value?: unknown }> | undefined): string[] {
  const ids: string[] = [];
  for (const condition of asArray(conditions)) {
    const normalizedType = normalizeQuestConditionType(String(condition?.type ?? '').trim());
    const isQuestCondition = normalizedType.includes('quest') || normalizedType === 'objective_completed' || normalizedType === 'objective_not_completed';
    if (!isQuestCondition) {
      continue;
    }
    const questId = String(condition?.questId ?? condition?.value ?? '').trim();
    if (questId) {
      ids.push(questId);
    }
  }
  return ids;
}

function collectDialogueQuestIds(dialogue: DialogueDefinition): string[] {
  const questIds = new Set<string>();
  for (const node of asArray(dialogue.nodes)) {
    for (const questId of extractQuestIdsFromConditions(node.conditions as Array<{ type?: unknown; questId?: unknown; value?: unknown }> | undefined)) {
      questIds.add(questId);
    }
    for (const action of asArray(node.actions as Array<{ questId?: unknown }> | undefined)) {
      const questId = String(action?.questId ?? '').trim();
      if (questId) {
        questIds.add(questId);
      }
    }
    for (const choice of asArray(node.choices)) {
      const giveQuestId = String(choice.giveQuest ?? '').trim();
      if (giveQuestId) {
        questIds.add(giveQuestId);
      }
      const completeQuestId = String(choice.completeQuest ?? '').trim();
      if (completeQuestId) {
        questIds.add(completeQuestId);
      }
      const completeObjectiveQuestId = typeof choice.completeObjective === 'object'
        ? String(choice.completeObjective.questId ?? '').trim()
        : '';
      if (completeObjectiveQuestId) {
        questIds.add(completeObjectiveQuestId);
      }
      const completeStepQuestId = typeof choice.completeStep === 'object'
        ? String(choice.completeStep.questId ?? '').trim()
        : '';
      if (completeStepQuestId) {
        questIds.add(completeStepQuestId);
      }
      for (const questId of extractQuestIdsFromConditions(choice.conditions as Array<{ type?: unknown; questId?: unknown; value?: unknown }> | undefined)) {
        questIds.add(questId);
      }
      for (const action of [...asArray(choice.actions as Array<{ questId?: unknown }> | undefined), ...asArray(choice.effects as Array<{ questId?: unknown }> | undefined)]) {
        const questId = String(action?.questId ?? '').trim();
        if (questId) {
          questIds.add(questId);
        }
      }
    }
  }
  return Array.from(questIds);
}

function hasQuestCompletedAwareNode(dialogue: DialogueDefinition): boolean {
  return asArray(dialogue.nodes).some((node) => {
    const nodeConditions = asArray(node.conditions as Array<{ type?: unknown }> | undefined);
    if (nodeConditions.some((condition) => normalizeQuestConditionType(String(condition?.type ?? '').trim()) === 'quest_completed')) {
      return true;
    }
    return asArray(node.choices).some((choice) => asArray(choice.conditions as Array<{ type?: unknown }> | undefined)
      .some((condition) => normalizeQuestConditionType(String(condition?.type ?? '').trim()) === 'quest_completed'));
  });
}

function areAllDialogueQuestsCompleted(playerId: string, dialogue: DialogueDefinition): boolean {
  const relatedQuestIds = collectDialogueQuestIds(dialogue);
  if (relatedQuestIds.length === 0) {
    return false;
  }
  return relatedQuestIds.every((questId) => getPlayerQuestState(playerId, questId)?.status === 'completed');
}

function buildCompletedQuestFallbackDialogue(dialogue: DialogueDefinition, npc: NpcDefinition | null): DialogueDefinition {
  if (npc?.id === 'npc_argos_king_gramar_fireblade') {
    return {
      ...dialogue,
      id: `${dialogue.id}__completed_fallback`,
      startNodeId: 'post_quest_start',
      nodes: [
        {
          id: 'post_quest_start',
          speaker: 'npc',
          text: 'Грамар Огненный Клинок стоит над разложенными картами, и даже в походном шатре держится так, будто перед ним весь Аргос.\n\n— Запомни: корона не для того, чтобы прятаться за каменными стенами.\n— Пока мои солдаты стоят в пыли, крови и холоде, моё место рядом с армией, а не в праздных залах.',
          choices: [
            {
              id: 'ask_why_not_in_city',
              text: 'Почему ты не в городах?',
              nextNodeId: 'post_quest_explain',
            },
            {
              id: 'ask_about_field_of_battle_service',
              text: 'Ты говорил о службе Аргосу. Что за поручение?',
              nextNodeId: 'post_quest_field_of_battle_offer',
              conditions: [
                {
                  id: 'cond_field_of_battle_not_started',
                  type: 'quest_not_started',
                  questId: 'argos_quest_field_of_battle',
                }
              ]
            },
            {
              id: 'leave_after_completed',
              text: 'Понял. Уйти.',
              nextNodeId: 'post_quest_disrespect_warning',
            },
          ],
        },
        {
          id: 'post_quest_explain',
          speaker: 'npc',
          text: '— Замки удерживают стены. Королевство удерживают люди в строю.\n— Я король Аргоса, а не смотритель дворцовых окон. Пока идёт война, я обязан быть там, где решается судьба моего знамени и моей земли.',
          choices: [
            {
              id: 'leave_after_explain',
              text: 'Я понял, ваше величество.',
              endsDialogue: true,
            },
          ],
        },
        {
          id: 'post_quest_field_of_battle_offer',
          speaker: 'npc',
          text: '— Поручение называется «Поле Брани».\n\n— Клиногорье и южная дорога всё ещё несут на себе след недавней бойни. Мне нужен не болтун, а человек, который посмотрит на кровь, пепел и страх своими глазами и не дрогнет.\n\n— Отправишься в Клиногорье, поговоришь с Браном Камышом и узнаешь, что осталось после резни у южного тракта. Потом Аргос решит, чего ты стоишь дальше.',
          choices: [
            {
              id: 'accept_field_of_battle_service',
              text: 'Я возьму это поручение.',
              endsDialogue: true,
              giveQuest: 'argos_quest_field_of_battle',
              actions: [
                {
                  id: 'act_start_field_of_battle',
                  type: 'startQuest',
                  questId: 'argos_quest_field_of_battle'
                }
              ]
            },
            {
              id: 'delay_field_of_battle_service',
              text: 'Я вернусь, когда буду готов.',
              endsDialogue: true
            }
          ]
        },
        {
          id: 'post_quest_disrespect_warning',
          speaker: 'npc',
          text: 'Взгляд Грамара тяжелеет.\n\n— Не забывай, с кем говоришь. Даже тот, кому дарована милость Аргоса, обязан помнить почтение к своему королю.\n— За такую вольность ты теряешь часть доверия Аргоса.',
          choices: [
            {
              id: 'leave_after_warning',
              text: 'Склонить голову и уйти.',
              endsDialogue: true,
              actions: [
                {
                  id: 'act_lose_argos_reputation_for_disrespect',
                  type: 'addReputation',
                  reputationChanges: [
                    {
                      targetType: 'kingdom',
                      targetId: 'argos',
                      amount: -5
                    }
                  ]
                }
              ]
            }
          ]
        },
      ],
    };
  }

  return {
    ...dialogue,
    id: `${dialogue.id}__completed_fallback`,
    startNodeId: 'post_quest_start',
    nodes: [
      {
        id: 'post_quest_start',
        speaker: 'npc',
        text: `${npc?.name ?? 'Собеседник'} уже обсудил с тобой всё по завершённому делу. Если появятся новые приказы или квесты, он скажет об этом первым.`,
        choices: [
          {
            id: 'leave_post_quest',
            text: 'Понял. Уйти.',
            endsDialogue: true,
          },
        ],
      },
    ],
  };
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
    const shouldUseCompletedQuestFallback = (
      areAllDialogueQuestsCompleted(params.player.id, definition)
      && !hasQuestCompletedAwareNode(definition)
    );
    const effectiveDefinition = shouldUseCompletedQuestFallback
      ? buildCompletedQuestFallbackDialogue(definition, npc)
      : definition;
    const start = getStartNode(effectiveDefinition, params.player, npc);
    if (!start) {
      dispatch({ type: 'OPEN', dialogueId, nodeId: effectiveDefinition.startNodeId || 'missing', context: { ...context, sourceType: context.sourceType ?? 'system' } });
      dispatch({ type: 'ERROR', text: `Start node not found: ${effectiveDefinition.startNodeId}` });
      return;
    }

    if (import.meta.env.DEV && (context.npcId === 'npc_klinogorie_bran_legless_soldier' || effectiveDefinition.id === 'dlg_npc_klinogorie_bran_legless_soldier_yyzx')) {
      // eslint-disable-next-line no-console
      console.log('[bran-dialogue] openDialogue', {
        npcId: context.npcId ?? effectiveDefinition.npcId ?? null,
        dialogueId: effectiveDefinition.id,
        updatedAt: effectiveDefinition.updatedAt ?? null,
        startNodeId: effectiveDefinition.startNodeId,
        resolvedStartNodeId: start.id,
        startChoices: (start.choices ?? []).map((choice) => ({
          id: choice.id,
          text: choice.text,
          conditions: choice.conditions ?? [],
          giveQuest: choice.giveQuest ?? null,
        })),
      });
    }

    dispatch({
      type: 'OPEN',
      dialogueId,
      nodeId: start.id,
      context: { ...context, sourceType: context.sourceType ?? 'system' },
      dialogueOverride: shouldUseCompletedQuestFallback ? effectiveDefinition : null,
    });
  }, [params.player.id, state.context, state.dialogueId, state.isOpen]);

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

    if (import.meta.env.DEV && npc.id === 'npc_klinogorie_bran_legless_soldier') {
      const startNode = getStartNode(picked, params.player, npc);
      // eslint-disable-next-line no-console
      console.log('[bran-dialogue] openDialogueForNpc', {
        npcId: npc.id,
        npcDialogues: npc.dialogues ?? [],
        selectedDialogueId: picked.id,
        updatedAt: picked.updatedAt ?? null,
        startNodeId: picked.startNodeId,
        resolvedStartNodeId: startNode?.id ?? null,
        startChoices: (startNode?.choices ?? []).map((choice) => ({
          id: choice.id,
          text: choice.text,
          conditions: choice.conditions ?? [],
          giveQuest: choice.giveQuest ?? null,
        })),
      });
    }

    const npcKingdomId = resolveNpcKingdomId(npc);
    const playerKingdomId = resolvePlayerOriginKingdomId(params.player.id);
    const resolvedStart = getStartNode(picked, params.player, npc);
    const dialogueHasContextSpecificStart = Boolean(resolvedStart && resolvedStart.id !== picked.startNodeId);
    const shouldInjectArgosOutsiderIntro = npcKingdomId === 'argos'
      && Boolean(playerKingdomId)
      && playerKingdomId !== 'argos'
      && !dialogueHasContextSpecificStart;

    if (!shouldInjectArgosOutsiderIntro) {
      openDialogue(picked.id, { ...context, npcId, sourceType: 'npc' });
      return;
    }

    const shouldUseCompletedQuestFallback = (
      areAllDialogueQuestsCompleted(params.player.id, picked)
      && !hasQuestCompletedAwareNode(picked)
    );
    const effectiveDefinition = shouldUseCompletedQuestFallback
      ? buildCompletedQuestFallbackDialogue(picked, npc)
      : picked;

    const intro = buildArgosOutsiderIntro(params.player.id);
    const dialogueWithIntro = withIntroOnStartNode(effectiveDefinition, intro);
    const start = getStartNode(dialogueWithIntro, params.player, npc);
    if (!start) {
      dispatch({ type: 'OPEN', dialogueId: dialogueWithIntro.id, nodeId: dialogueWithIntro.startNodeId || 'missing', context: { ...context, npcId, sourceType: 'npc' } });
      dispatch({ type: 'ERROR', text: `Start node not found: ${dialogueWithIntro.startNodeId}` });
      return;
    }

    dispatch({
      type: 'OPEN',
      dialogueId: dialogueWithIntro.id,
      nodeId: start.id,
      context: { ...context, npcId, sourceType: 'npc' },
      dialogueOverride: dialogueWithIntro,
    });
  }, [openDialogue, params.player, params.player.id]);

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
      ...getChoiceExplicitActions(choice),
      ...choiceShorthandToActions(choice),
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
