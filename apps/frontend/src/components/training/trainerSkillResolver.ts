import type { AdminSkillDefinition } from '@theend/rpg-domain';
import { getPlayerQuestState } from '../../services/questRuntime';

const PLAYER_ITEMS_KEY = 'theend.player.items';
const PLAYER_QUEST_ITEMS_KEY = 'theend.player.questItems';

export interface SkillTrainingPlayerContext {
  playerId: string;
  level: number;
  race?: string | null;
  classId?: string | null;
  npcId?: string | null;
  gold?: number | null;
  stats?: Record<string, number> | null;
}

export type RequirementReasonCode =
  | 'already_learned'
  | 'not_published'
  | 'hidden'
  | 'not_trainable'
  | 'wrong_trainer'
  | 'missing_level'
  | 'missing_stat'
  | 'missing_known_skill'
  | 'missing_quest'
  | 'missing_completed_quest'
  | 'missing_quest_item'
  | 'missing_item'
  | 'class_system_missing'
  | 'wrong_class'
  | 'race_system_missing'
  | 'wrong_race'
  | 'forbidden_race'
  | 'missing_magic_school_system'
  | 'missing_magic_school'
  | 'not_enough_gold'
  | 'cost_items_not_supported'
  | 'cost_quest_items_not_supported'
  | 'missing_reputation_system'
  | 'missing_reputation';

export interface RequirementReason {
  code: RequirementReasonCode;
  message: string;
  data?: Record<string, unknown>;
}

export interface TrainerSkillCandidate {
  skillId: string;
  skill: AdminSkillDefinition | null;
  sources: string[];
  costs: {
    gold: number;
    items: Array<{ itemId: string; quantity: number }>;
    questItems: Array<{ questItemId: string; quantity: number; consume?: boolean }>;
  };
  isLearned: boolean;
  isAvailable: boolean;
  reasons: RequirementReason[];
}

function readArray(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry));
  } catch {
    return [];
  }
}

export function parseIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((entry) => String(entry ?? '').trim()).filter(Boolean)));
  }
  if (typeof value === 'string') {
    return Array.from(
      new Set(
        value
          .split(/[\n,]+/g)
          .map((entry) => entry.trim())
          .filter(Boolean),
      ),
    );
  }
  return [];
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getTrainerNpcIdFromMethod(method: unknown): string | null {
  const rec = toRecord(method);
  if (!rec) return null;
  const raw =
    rec.teacherNpcId
    ?? rec.npcId
    ?? rec.trainerNpcId
    ?? rec.teacherId;
  const id = typeof raw === 'string' ? raw.trim() : '';
  return id ? id : null;
}

function isTeacherMethod(method: unknown): boolean {
  const rec = toRecord(method);
  const t = typeof rec?.type === 'string' ? rec.type.trim().toLowerCase() : '';
  return t === 'teacher' || t === 'trainer';
}

function getPriceGoldFromMethod(method: unknown): number | null {
  const rec = toRecord(method);
  if (!rec) return null;
  const raw = rec.priceGold;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function parseTrainingCosts(value: unknown): { gold: number; items: Array<{ itemId: string; quantity: number }>; questItems: Array<{ questItemId: string; quantity: number; consume?: boolean }> } {
  const rec = toRecord(value);
  const goldRaw = rec?.gold;
  const goldN = typeof goldRaw === 'number' ? goldRaw : Number(goldRaw);
  const gold = Number.isFinite(goldN) ? Math.max(0, Math.floor(goldN)) : 0;

  const items: Array<{ itemId: string; quantity: number }> = [];
  const rawItems = rec?.items;
  if (Array.isArray(rawItems)) {
    for (const entry of rawItems) {
      const itemRec = toRecord(entry);
      if (!itemRec) continue;
      const itemId = typeof itemRec.itemId === 'string' ? itemRec.itemId.trim() : '';
      const qtyRaw = itemRec.quantity;
      const qtyN = typeof qtyRaw === 'number' ? qtyRaw : Number(qtyRaw);
      const quantity = Number.isFinite(qtyN) ? Math.max(1, Math.floor(qtyN)) : 1;
      if (itemId) items.push({ itemId, quantity });
    }
  }

  const questItems: Array<{ questItemId: string; quantity: number; consume?: boolean }> = [];
  const rawQuestItems = rec?.questItems;
  if (Array.isArray(rawQuestItems)) {
    for (const entry of rawQuestItems) {
      const qiRec = toRecord(entry);
      if (!qiRec) continue;
      const questItemId = typeof qiRec.questItemId === 'string' ? qiRec.questItemId.trim() : '';
      const qtyRaw = qiRec.quantity;
      const qtyN = typeof qtyRaw === 'number' ? qtyRaw : Number(qtyRaw);
      const quantity = Number.isFinite(qtyN) ? Math.max(1, Math.floor(qtyN)) : 1;
      const consume = typeof qiRec.consume === 'boolean' ? qiRec.consume : undefined;
      if (questItemId) questItems.push({ questItemId, quantity, consume });
    }
  }

  return { gold, items, questItems };
}

export function getSkillTrainingCosts(skill: AdminSkillDefinition, npcId: string | null | undefined): { gold: number; items: Array<{ itemId: string; quantity: number }>; questItems: Array<{ questItemId: string; quantity: number; consume?: boolean }> } {
  const methods = Array.isArray((skill as any)?.acquisition?.methods) ? (skill as any).acquisition.methods as unknown[] : [];
  const trainerMethods = methods.filter(isTeacherMethod);

  if (npcId) {
    for (const method of trainerMethods) {
      const teacherNpcId = getTrainerNpcIdFromMethod(method);
      if (teacherNpcId && teacherNpcId === npcId) {
        const legacyGold = getPriceGoldFromMethod(method) ?? 0;
        const costs = parseTrainingCosts((toRecord(method) as any)?.costs);
        return {
          gold: costs.gold > 0 ? costs.gold : legacyGold,
          items: costs.items,
          questItems: costs.questItems,
        };
      }
    }
  }

  for (const method of trainerMethods) {
    const legacyGold = getPriceGoldFromMethod(method) ?? 0;
    const costs = parseTrainingCosts((toRecord(method) as any)?.costs);
    if (costs.gold > 0 || legacyGold > 0 || costs.items.length > 0 || costs.questItems.length > 0) {
      return {
        gold: costs.gold > 0 ? costs.gold : legacyGold,
        items: costs.items,
        questItems: costs.questItems,
      };
    }
  }

  const top = (skill as any).priceGold;
  const topN = typeof top === 'number' ? top : Number(top);
  const gold = Number.isFinite(topN) ? Math.max(0, Math.floor(topN)) : 0;
  return { gold, items: [], questItems: [] };
}

function skillHasTeacherLink(skill: AdminSkillDefinition, npcId: string): boolean {
  const methods = Array.isArray((skill as any)?.acquisition?.methods) ? (skill as any).acquisition.methods as unknown[] : [];
  for (const method of methods) {
    if (!isTeacherMethod(method)) continue;
    const linkedNpcId = getTrainerNpcIdFromMethod(method);
    if (linkedNpcId && linkedNpcId === npcId) return true;
  }
  return false;
}

export function getTrainerCandidateSources(params: {
  skill: AdminSkillDefinition;
  npcId: string;
  trainerSkillIds: Set<string>;
}): string[] {
  const sources: string[] = [];
  if (params.trainerSkillIds.has(params.skill.id)) sources.push('npc.trainerSkillIds');
  if (params.skill.requiredNpcId?.trim() === params.npcId) sources.push('skill.requiredNpcId');
  if (skillHasTeacherLink(params.skill, params.npcId)) sources.push('skill.acquisition.methods.teacher');
  return sources;
}

export function isTrainerCandidate(params: {
  skill: AdminSkillDefinition;
  npcId: string;
  trainerSkillIds: Set<string>;
}): boolean {
  return getTrainerCandidateSources(params).length > 0;
}

export function checkSkillRequirements(params: {
  skill: AdminSkillDefinition;
  context: SkillTrainingPlayerContext;
  learnedSkillIds: Set<string>;
  costs: { gold: number; items: Array<{ itemId: string; quantity: number }>; questItems: Array<{ questItemId: string; quantity: number; consume?: boolean }> };
}): RequirementReason[] {
  const { skill, context, learnedSkillIds, costs } = params;
  const reasons: RequirementReason[] = [];

  if (learnedSkillIds.has(skill.id)) {
    reasons.push({ code: 'already_learned', message: 'Навык уже изучен.' });
    return reasons;
  }

  if (!skill.isPublished) {
    reasons.push({ code: 'not_published', message: 'Навык ещё не опубликован.' });
  }
  if (skill.isHidden) {
    reasons.push({ code: 'hidden', message: 'Навык скрыт.' });
  }

  const methods = Array.isArray((skill as any)?.acquisition?.methods) ? (skill as any).acquisition.methods as unknown[] : [];
  const hasTeacherMethod = methods.some(isTeacherMethod);
  const isTrainableLike =
    skill.isTrainable === true
    || (skill as any).acquisitionMode === 'trainer'
    || hasTeacherMethod;
  if (!isTrainableLike) {
    reasons.push({ code: 'not_trainable', message: 'Навык не помечен как обучаемый у тренера.' });
  }

  const requiredNpcId = skill.requiredNpcId?.trim();
  if (requiredNpcId && context.npcId && requiredNpcId !== context.npcId) {
    reasons.push({ code: 'wrong_trainer', message: `Навык можно изучить только у тренера: ${requiredNpcId}.` });
  }

  const requiredLevel = skill.requiredLevel ?? (skill as any).requirements?.minCharacterLevel;
  if (typeof requiredLevel === 'number' && context.level < requiredLevel) {
    reasons.push({ code: 'missing_level', message: `Требуется уровень: ${requiredLevel}.` });
  }

  const reqStats = (skill as any).requirements?.requiredStats;
  if (reqStats && typeof reqStats === 'object' && !Array.isArray(reqStats)) {
    for (const [stat, rawMin] of Object.entries(reqStats as Record<string, unknown>)) {
      const min = typeof rawMin === 'number' ? rawMin : Number(rawMin);
      if (!Number.isFinite(min)) continue;
      const actual = context.stats?.[stat] ?? null;
      if (typeof actual === 'number' && actual < min) {
        reasons.push({ code: 'missing_stat', message: `Требуется ${stat}: ${min}.`, data: { stat, required: min, actual } });
      }
    }
  }

  const requiredKnownSkillIds = [
    ...parseIdList((skill as any).requiredKnownSkillIds),
    ...parseIdList((skill as any).requirements?.requiredSkills),
  ];
  for (const requiredSkillId of requiredKnownSkillIds) {
    if (!learnedSkillIds.has(requiredSkillId)) {
      reasons.push({ code: 'missing_known_skill', message: `Требуется навык: ${requiredSkillId}.` });
      break;
    }
  }

  if (skill.requiredQuestId) {
    const st = getPlayerQuestState(context.playerId, skill.requiredQuestId);
    if (!st) reasons.push({ code: 'missing_quest', message: `Требуется квест: ${skill.requiredQuestId}.` });
  }
  if (skill.requiredCompletedQuestId) {
    const st = getPlayerQuestState(context.playerId, skill.requiredCompletedQuestId);
    if (!st || st.status !== 'completed') reasons.push({ code: 'missing_completed_quest', message: `Требуется завершить квест: ${skill.requiredCompletedQuestId}.` });
  }

  if (skill.requiredQuestItemId && !readArray(PLAYER_QUEST_ITEMS_KEY).includes(skill.requiredQuestItemId)) {
    reasons.push({ code: 'missing_quest_item', message: `Требуется квестовый предмет: ${skill.requiredQuestItemId}.` });
  }

  const requiredItems = parseIdList((skill as any).requirements?.requiredItems);
  if (requiredItems.length > 0) {
    const itemIds = new Set(readArray(PLAYER_ITEMS_KEY));
    const missing = requiredItems.find((id) => !itemIds.has(id));
    if (missing) reasons.push({ code: 'missing_item', message: `Требуется предмет: ${missing}.` });
  }

  if (Array.isArray(skill.requiredClassIds) && skill.requiredClassIds.length > 0) {
    if (!context.classId) {
      reasons.push({ code: 'class_system_missing', message: `Требуется класс: ${skill.requiredClassIds.join(', ')} (у персонажа нет classId).` });
    } else if (!skill.requiredClassIds.includes(context.classId)) {
      reasons.push({ code: 'wrong_class', message: `Класс не подходит. Нужно: ${skill.requiredClassIds.join(', ')}.` });
    }
  }

  const allowedRaces = parseIdList(skill.requiredRaceIds?.length ? skill.requiredRaceIds : (skill as any).requirements?.allowedRaces);
  const forbiddenRaces = parseIdList((skill as any).requirements?.forbiddenRaces);
  if (forbiddenRaces.length > 0 && context.race && forbiddenRaces.includes(context.race)) {
    reasons.push({ code: 'forbidden_race', message: `Раса запрещена для навыка: ${context.race}.` });
  } else if (allowedRaces.length > 0) {
    if (!context.race) {
      reasons.push({ code: 'race_system_missing', message: 'У персонажа не указана раса.' });
    } else if (!allowedRaces.includes(context.race)) {
      reasons.push({ code: 'wrong_race', message: `Раса не подходит. Разрешено: ${allowedRaces.join(', ')}.` });
    }
  }

  const requiredMagicSchools = parseIdList((skill as any).requirements?.requiredMagicSchools);
  if (requiredMagicSchools.length > 0) {
    reasons.push({ code: 'missing_magic_school_system', message: `Требуются школы магии: ${requiredMagicSchools.join(', ')} (система школ у персонажа не найдена).` });
  }

  const requiredReputation = (skill as any).requirements?.requiredReputation;
  if (Array.isArray(requiredReputation) && requiredReputation.length > 0) {
    reasons.push({ code: 'missing_reputation_system', message: 'Требуется репутация (система репутации у персонажа не найдена).' });
  }

  const gold = typeof context.gold === 'number' ? context.gold : null;
  if (gold !== null && costs.gold > 0 && gold < costs.gold) {
    reasons.push({ code: 'not_enough_gold', message: `Недостаточно золота: нужно ${costs.gold}, у вас ${gold}.` });
  }

  if (costs.items.length > 0) {
    const preview = costs.items.slice(0, 3).map((entry) => `${entry.itemId} x${entry.quantity}`).join(', ');
    reasons.push({ code: 'cost_items_not_supported', message: `Требуются предметы: ${preview}. (Оплата предметами ещё не подключена)` });
  }
  if (costs.questItems.length > 0) {
    const preview = costs.questItems.slice(0, 3).map((entry) => `${entry.questItemId} x${entry.quantity}`).join(', ');
    reasons.push({ code: 'cost_quest_items_not_supported', message: `Требуются квестовые предметы: ${preview}. (Оплата квестовыми предметами ещё не подключена)` });
  }

  return reasons;
}

export function resolveTrainerSkillCandidates(params: {
  npcId: string | null;
  trainerSkillIds?: unknown;
  allSkills: AdminSkillDefinition[];
  context: SkillTrainingPlayerContext;
  learnedSkillIds: Set<string>;
}): TrainerSkillCandidate[] {
  const npcId = params.npcId?.trim() || null;
  if (!npcId) return [];

  const trainerSkillIds = new Set(parseIdList(params.trainerSkillIds));

  const candidates: TrainerSkillCandidate[] = [];
  for (const skill of params.allSkills) {
    const sources = isTrainerCandidate({ skill, npcId, trainerSkillIds })
      ? getTrainerCandidateSources({ skill, npcId, trainerSkillIds })
      : [];
    if (sources.length === 0) continue;

    const costs = getSkillTrainingCosts(skill, npcId);
    const reasons = checkSkillRequirements({
      skill,
      context: { ...params.context, npcId },
      learnedSkillIds: params.learnedSkillIds,
      costs,
    });
    const isLearned = params.learnedSkillIds.has(skill.id);
    const isAvailable = !isLearned && reasons.length === 0;

    candidates.push({
      skillId: skill.id,
      skill,
      sources,
      costs,
      isLearned,
      isAvailable,
      reasons,
    });
  }

  // Include broken references from trainerSkillIds (ids with no matching skill definition).
  for (const referencedId of trainerSkillIds) {
    if (params.allSkills.some((s) => s.id === referencedId)) continue;
    candidates.push({
      skillId: referencedId,
      skill: null,
      sources: ['npc.trainerSkillIds'],
      costs: { gold: 0, items: [], questItems: [] },
      isLearned: false,
      isAvailable: false,
      reasons: [{ code: 'not_trainable', message: `Навык не найден в базе: ${referencedId}.` }],
    });
  }

  return candidates.sort((a, b) => (a.skill?.name ?? a.skillId).localeCompare(b.skill?.name ?? b.skillId, 'ru', { sensitivity: 'base' }));
}
