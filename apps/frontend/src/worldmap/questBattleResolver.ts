import type { WorldMapZone } from './zoneEditorTypes';
import type { QuestDefinition, PlayerQuestState } from '../types/quest';
import { createQuestBattleContext, type BattleRuntimeContext } from '@theend/rpg-domain';

export interface QuestBattleResolverBattleMap {
  id: string;
  objectives?: Array<{ id: string }>;
}

export interface ResolveQuestBattleLaunchParams {
  zone: WorldMapZone;
  questDefinitions: QuestDefinition[];
  playerQuestStates: PlayerQuestState[];
  characterId: string;
  trigger: 'enter' | 'interact' | 'inspect';
  battleMaps?: QuestBattleResolverBattleMap[];
}

export type QuestBattleLaunchResolveResult =
  | { ok: true; battleMapId: string; battleContext: BattleRuntimeContext }
  | { ok: false; reason: string };

export function resolveQuestBattleLaunchFromZone(
  params: ResolveQuestBattleLaunchParams
): QuestBattleLaunchResolveResult {
  const config = params.zone.questLaunch;
  if (!config || config.action !== 'start_quest_battle') {
    return { ok: false, reason: 'questLaunch not configured.' };
  }

  // 1. trigger mismatch check
  const triggerOn = config.triggerOn ?? 'enter';
  if (triggerOn !== params.trigger) {
    return { ok: false, reason: 'trigger_mismatch' };
  }

  const questId = String(config.questId ?? '').trim();
  const questStepId = String(config.questStepId ?? '').trim();
  const questObjectiveId = String(config.questObjectiveId ?? '').trim();
  const battleMapId = String(config.battleMapId ?? '').trim();
  const battleObjectiveIds = (config.battleObjectiveIds ?? [])
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);

  if (!questId || !questStepId || !questObjectiveId || !battleMapId || battleObjectiveIds.length === 0) {
    if (!battleMapId) {
      return { ok: false, reason: 'battle_map_not_found' };
    }
    if (battleObjectiveIds.length === 0) {
      return { ok: false, reason: 'battle_objective_not_found' };
    }
    return { ok: false, reason: 'questLaunch is incomplete.' };
  }

  // Check battle map existence
  if (params.battleMaps) {
    const battleMap = params.battleMaps.find((m) => m.id === battleMapId);
    if (!battleMap) {
      return { ok: false, reason: 'battle_map_not_found' };
    }
    const mapObjectiveIds = (battleMap.objectives ?? [])
      .map((obj) => String(obj.id ?? '').trim())
      .filter(Boolean);
    const objectivesExist = battleObjectiveIds.every((id) => mapObjectiveIds.includes(id));
    if (!objectivesExist) {
      return { ok: false, reason: 'battle_objective_not_found' };
    }
  }

  // Check quest definition
  const quest = params.questDefinitions.find((entry) => entry.id === questId) ?? null;
  if (!quest) {
    return { ok: false, reason: 'quest_not_found' };
  }

  // Check quest step
  const step = (quest.steps ?? []).find((entry) => entry.id === questStepId) ?? null;
  if (!step) {
    return { ok: false, reason: 'active_step_mismatch' };
  }

  // Check quest step objective
  const objective = (step.objectives ?? []).find((entry) => entry.id === questObjectiveId) ?? null;
  if (!objective) {
    return { ok: false, reason: 'objective_not_found' };
  }

  // Check objective type
  const rawObjective = objective as unknown as Record<string, unknown>;
  if (String(rawObjective.type ?? '').trim() !== 'battle_objective') {
    return { ok: false, reason: 'objective_not_battle_objective' };
  }

  // Check player quest state status and current step
  const questState = params.playerQuestStates.find(
    (entry) => entry.playerId === params.characterId && entry.questId === questId
  ) ?? null;

  const requiredStatus = config.requireQuestStatus ?? 'active';
  if (requiredStatus !== 'any') {
    if (!questState) {
      return { ok: false, reason: 'quest_not_active' };
    }
    if (requiredStatus === 'active' && questState.status !== 'active') {
      return { ok: false, reason: 'quest_not_active' };
    }
    if (requiredStatus === 'completed' && questState.status !== 'completed') {
      return { ok: false, reason: 'quest_not_active' };
    }
  }

  if (config.requireCurrentStep !== false) {
    if (!questState || (questState.currentStepId && questState.currentStepId !== questStepId)) {
      return { ok: false, reason: 'active_step_mismatch' };
    }
  }

  return {
    ok: true,
    battleMapId,
    battleContext: createQuestBattleContext({
      questId,
      questStepId,
      battleMapId,
      activeBattleObjectiveIds: battleObjectiveIds,
    }),
  };
}
