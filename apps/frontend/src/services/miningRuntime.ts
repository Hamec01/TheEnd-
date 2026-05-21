import type { PlayerProfessionState } from '@theend/rpg-domain';
import { itemsService } from './content/itemsService';
import {
  loadProfessionSkillsFromStorage,
} from './professionSkillRepository';
import type {
  ActiveMiningEffect,
  InternalMineBlockState,
  InternalMineRunState,
  MineBlockEntry,
  MineBlockPayload,
  MineBlockState,
  MineDepth,
  MineHazard,
  MineLootEntry,
  MineLootStack,
  MinePortersState,
  MineRunResultSummary,
  MineRunState,
  MiningEffectContext,
  MineSpecialFind,
} from '../types/mining';
import type { ProfessionSkill, ProfessionSkillEffect, ProfessionSkillEffectValueType } from '../types/profession';
import { fixMojibake } from '../utils/fixMojibake';
import {
  findMineById,
  findMineBlockTableById,
  findMineDepthById as findDepthById,
  findMineDepthsByMineId,
  findMineHazardById,
  findMineHazardTableById,
  findMineLootTableById,
} from './miningRepository';

const DEFAULT_LOG_LIMIT = 30;
const DEV = (import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.DEV === true
  || ((import.meta as { env?: { MODE?: string } }).env?.MODE ?? 'production') !== 'production';

const warnedUnknownEffectTypes = new Set<string>();

const KNOWN_MINING_EFFECT_TYPES = new Set<string>([
  'mine_stamina_cost_modifier',
  'mine_extra_stamina',
  'mine_extra_hits',
  'mine_extra_hits_on_descend',
  'mine_loot_quantity_modifier',
  'mine_loot_quality_modifier',
  'mine_block_hint_chance',
  'mine_ore_chance_modifier',
  'mine_rare_ore_chance_modifier',
  'mine_gold_chance_modifier',
  'mine_gem_chance_modifier',
  'mine_crystal_chance_modifier',
  'mine_rune_fragment_chance_modifier',
  'mine_fragile_loot_break_chance_modifier',
  'mine_passage_chance_modifier',
  'mine_exit_chance_modifier',
  'mine_collapse_chance_modifier',
  'mine_collapse_damage_modifier',
  'mine_hazard_resistance',
  'mine_gas_resistance',
  'mine_lava_resistance',
  'mine_fire_resistance',
  'mine_ice_resistance',
  'mine_dust_resistance',
  'mine_curse_resistance',
  'mine_spirit_resistance',
  'mine_once_per_run_escape',
  'mine_once_per_run_survive_1hp',
  'mine_death_loot_save_modifier',
  'mine_retreat_loot_save',
  'mine_area_break',
  'mine_area_break_chance',
  'mine_reveal_adjacent_blocks',
  'mine_free_adjacent_breaks',
  'mine_porters_unlock',
  'mine_porters_save_items_on_death',
  'mine_porters_save_items_on_retreat',
  'mine_porters_capacity_modifier',
  'mine_reduce_risk_increase_per_hit',
  'mine_start_with_exit_hint',
  'mine_start_with_passage_hint',
  'mine_ignore_first_hazard',
  'mine_loot_sell_value_modifier',
  'mine_loot_special_property_chance',
  'mine_event_chance_modifier',
  'mine_refund_hit_chance',
  'mine_refund_stamina_chance',
  'mine_hazard_type_resistance',
  'mine_block_type_yield_modifier',
  'mine_payload_type_chance_modifier',
  'mine_rune_trace_chance_modifier',
  'mine_block_weight_modifier',
  'mine_hazard_weight_modifier',
  'mine_event_weight_modifier',
]);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createRunId(): string {
  return `mine_run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pushLog(current: string[], entry: string): string[] {
  return [...current, fixMojibake(entry)].slice(-DEFAULT_LOG_LIMIT);
}

function pushSkillEffectLog(current: string[] | undefined, entry: string): string[] {
  return [...(current ?? []), fixMojibake(entry)].slice(-DEFAULT_LOG_LIMIT);
}

function buildLoot(itemId: string, quantity: number): MineLootStack {
  return {
    itemId,
    quantity: Math.max(1, Math.floor(quantity)),
  };
}

const FRAGILE_BREAK_BASE_CHANCE: Record<string, number> = {
  gem: 0.2,
  crystal: 0.25,
};

const SPECIAL_PROPERTY_IDS = [
  'region_memory',
  'pure_core',
  'warm_glow',
  'cold_echo',
  'deep_resonance',
  'cracked_soul_trace',
] as const;

const SPECIAL_PROPERTY_LABELS: Record<string, string> = {
  region_memory: 'ÐŸÐ°Ð¼ÑÑ‚ÑŒ Ñ€ÐµÐ³Ð¸Ð¾Ð½Ð°',
  pure_core: 'Ð§Ð¸ÑÑ‚Ð¾Ðµ ÑÐ´Ñ€Ð¾',
  warm_glow: 'Ð¢Ñ‘Ð¿Ð»Ð¾Ðµ ÑÐ²ÐµÑ‡ÐµÐ½Ð¸Ðµ',
  cold_echo: 'Ð¥Ð¾Ð»Ð¾Ð´Ð½Ð¾Ðµ ÑÑ…Ð¾',
  deep_resonance: 'Ð“Ð»ÑƒÐ±Ð¸Ð½Ð½Ñ‹Ð¹ Ñ€ÐµÐ·Ð¾Ð½Ð°Ð½Ñ',
  cracked_soul_trace: 'Ð¡Ð»ÐµÐ´ Ñ‚Ñ€ÐµÑÐ½ÑƒÐ²ÑˆÐµÐ¹ Ð´ÑƒÑˆÐ¸',
};

function mergeLootStacks(current: MineLootStack[], incoming: MineLootStack[]): MineLootStack[] {
  const quantityByItemId = new Map<string, number>();
  for (const stack of [...current, ...incoming]) {
    quantityByItemId.set(stack.itemId, (quantityByItemId.get(stack.itemId) ?? 0) + Math.max(0, Math.floor(stack.quantity)));
  }
  return Array.from(quantityByItemId.entries())
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity }));
}

function subtractLootStacks(source: MineLootStack[], toRemove: MineLootStack[]): MineLootStack[] {
  const quantityByItemId = new Map<string, number>();
  for (const stack of source) {
    quantityByItemId.set(stack.itemId, (quantityByItemId.get(stack.itemId) ?? 0) + stack.quantity);
  }
  for (const stack of toRemove) {
    quantityByItemId.set(stack.itemId, (quantityByItemId.get(stack.itemId) ?? 0) - stack.quantity);
  }
  return Array.from(quantityByItemId.entries())
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity }));
}

function computeLootXp(stacks: MineLootStack[]): number {
  let xp = 0;
  for (const stack of stacks) {
    const quantity = Math.max(1, Math.floor(stack.quantity));
    if (stack.itemId === 'item_raw_stone') {
      xp += quantity;
    } else if (stack.itemId === 'item_iron_ore') {
      xp += 3 * quantity;
    } else if (stack.itemId === 'item_small_gold_nugget') {
      xp += 5 * quantity + 10;
    } else if (stack.itemId === 'item_cracked_crystal') {
      xp += 10 * quantity;
    } else if (stack.itemId === 'item_zeptyrite_trace') {
      xp += 10 * quantity + 10;
    } else if (stack.itemId === 'item_rune_fragment_weak' || stack.itemId === 'item_rune_dust') {
      xp += 10 * quantity + 10;
    } else {
      xp += quantity;
    }
  }
  return xp;
}

function estimateLootGoldValue(itemId: string): number {
  const normalized = itemId.trim().toLowerCase();
  if (normalized.includes('rune') || normalized.includes('zeptyrite')) {
    return 15;
  }
  if (normalized.includes('gem') || normalized.includes('crystal')) {
    return 8;
  }
  if (normalized.includes('gold') || normalized.includes('ore')) {
    return 3;
  }
  return 1;
}

function estimateLootStacksGoldValue(stacks: MineLootStack[]): number {
  return stacks.reduce((sum, stack) => sum + estimateLootGoldValue(stack.itemId) * Math.max(0, stack.quantity), 0);
}

function pickSpecialProperty(run: InternalMineRunState, rng: () => number): string {
  const mine = findMineById(run.mineId);
  if (mine?.visualTheme === 'ice') {
    return 'cold_echo';
  }
  if (mine?.visualTheme === 'lava') {
    return 'warm_glow';
  }
  if (mine?.visualTheme === 'shadow') {
    return 'cracked_soul_trace';
  }
  if (mine?.visualTheme === 'crystal') {
    return 'pure_core';
  }
  return SPECIAL_PROPERTY_IDS[Math.floor(rng() * SPECIAL_PROPERTY_IDS.length)] ?? 'region_memory';
}

function toFrontendBlock(block: InternalMineBlockState): MineBlockState {
  const opened = block.state === 'opened';
  return {
    index: block.index,
    state: block.state,
    visibleType: opened ? block.visibleType : undefined,
    label: block.label,
    loot: opened ? block.loot : undefined,
    hazardId: opened ? block.hazardId : undefined,
  };
}

function toFrontendRun(run: InternalMineRunState): MineRunState {
  return {
    ...run,
    blocks: run.blocks.map(toFrontendBlock),
  };
}

function blockLabelForType(type: InternalMineBlockState['hiddenType']): string {
  switch (type) {
    case 'empty':
      return 'Пусто';
    case 'stone':
      return 'Камень';
    case 'ore':
      return 'Руда';
    case 'rich_ore':
      return 'Богатая жила';
    case 'gold':
      return 'Золото';
    case 'gem':
      return 'Самоцвет';
    case 'crystal':
      return 'Кристалл';
    case 'hazard':
      return 'Опасность';
    case 'passage':
      return 'Проход';
    case 'exit':
      return 'Выход';
    case 'event':
      return 'Событие';
    default:
      return 'Находка';
  }
}

function weightedPick<T extends { weight: number }>(entries: T[], rng: () => number): T {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) {
    return entries[0]!;
  }
  let cursor = rng() * total;
  for (const entry of entries) {
    cursor -= Math.max(0, entry.weight);
    if (cursor <= 0) {
      return entry;
    }
  }
  return entries[entries.length - 1]!;
}

function matchesList(expected: string[] | undefined, actual: string | undefined): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }
  if (!actual) {
    return false;
  }
  return expected.includes(actual);
}

function matchesTags(expected: string[] | undefined, actual: string[] | undefined): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }
  if (!actual || actual.length === 0) {
    return false;
  }
  return expected.some((tag) => actual.includes(tag));
}

function matchesCondition(effect: ProfessionSkillEffect, context: MiningEffectContext): boolean {
  const condition = effect.condition;
  if (!condition) {
    return true;
  }
  if (condition.minDepth !== undefined && (context.depthLevel ?? 0) < condition.minDepth) {
    return false;
  }
  if (condition.maxDepth !== undefined && (context.depthLevel ?? 0) > condition.maxDepth) {
    return false;
  }
  if (condition.remainingHitsMin !== undefined && (context.remainingHits ?? 0) < condition.remainingHitsMin) {
    return false;
  }
  if (condition.remainingHitsMax !== undefined && (context.remainingHits ?? Number.MAX_SAFE_INTEGER) > condition.remainingHitsMax) {
    return false;
  }
  return matchesList(condition.mineTheme, context.mineTheme)
    && matchesList(condition.mineDangerLevel, context.mineDangerLevel)
    && matchesList(condition.hazardType, context.hazardType)
    && matchesList(condition.blockType, context.blockType)
    && matchesList(condition.lootRarity, context.lootRarity)
    && matchesTags(condition.itemTags, context.itemTags);
}

function warnUnknownEffectType(type: string): void {
  if (!DEV || KNOWN_MINING_EFFECT_TYPES.has(type) || warnedUnknownEffectTypes.has(type)) {
    return;
  }
  warnedUnknownEffectTypes.add(type);
  console.warn(`[mining] unknown effect type ignored: ${type}`);
}

function getMatchingEffects(
  effects: ActiveMiningEffect[],
  type: string,
  context: MiningEffectContext,
): ActiveMiningEffect[] {
  return effects.filter((effect) => {
    warnUnknownEffectType(effect.type);
    return effect.type === type && matchesCondition(effect, context);
  });
}

function effectNumericValue(effect: ActiveMiningEffect, valueType: ProfessionSkillEffectValueType): number {
  if ((effect.valueType ?? 'flat') !== valueType) {
    return 0;
  }
  return Number.isFinite(Number(effect.value)) ? Number(effect.value) : 0;
}

export function getActiveMiningEffects(
  profession: PlayerProfessionState | null,
  allProfessionSkills: ProfessionSkill[],
): ActiveMiningEffect[] {
  if (!profession) {
    return [];
  }
  const learned = new Set(profession.learnedSkillIds ?? []);
  return allProfessionSkills
    .filter((skill) => skill.professionId === 'mining' && skill.isEnabled && learned.has(skill.id))
    .flatMap((skill) => (skill.effects ?? []).map((effect, index) => ({
      ...effect,
      skillId: skill.id,
      skillName: skill.name,
      runtimeKey: effect.id?.trim() || `${skill.id}:${effect.type}:${index}`,
    })));
}

export function sumMiningEffect(
  effects: ActiveMiningEffect[],
  type: string,
  context: MiningEffectContext,
  valueType: ProfessionSkillEffectValueType = 'flat',
): number {
  return getMatchingEffects(effects, type, context)
    .reduce((sum, effect) => sum + effectNumericValue(effect, valueType), 0);
}

export function percentMiningEffect(
  effects: ActiveMiningEffect[],
  type: string,
  context: MiningEffectContext,
): number {
  return sumMiningEffect(effects, type, context, 'percent');
}

export function hasMiningEffect(
  effects: ActiveMiningEffect[],
  type: string,
  context: MiningEffectContext,
): boolean {
  return getMatchingEffects(effects, type, context).some((effect) => {
    if ((effect.valueType ?? 'flat') === 'boolean') {
      return Number(effect.value ?? 1) !== 0;
    }
    return true;
  });
}

export function canUseLimitedEffect(
  effect: ActiveMiningEffect,
  runState: InternalMineRunState,
  depthLevel: number,
): boolean {
  const used = runState.usedEffects ?? {};
  const runCount = used[effect.runtimeKey] ?? 0;
  const depthCount = used[`${effect.runtimeKey}@depth:${depthLevel}`] ?? 0;
  if (effect.maxUsesPerRun !== undefined && runCount >= effect.maxUsesPerRun) {
    return false;
  }
  if (effect.maxUsesPerDepth !== undefined && depthCount >= effect.maxUsesPerDepth) {
    return false;
  }
  return true;
}

export function markEffectUsed(
  effect: ActiveMiningEffect,
  runState: InternalMineRunState,
  depthLevel: number,
): void {
  if (!runState.usedEffects) {
    runState.usedEffects = {};
  }
  runState.usedEffects[effect.runtimeKey] = (runState.usedEffects[effect.runtimeKey] ?? 0) + 1;
  runState.usedEffects[`${effect.runtimeKey}@depth:${depthLevel}`] = (runState.usedEffects[`${effect.runtimeKey}@depth:${depthLevel}`] ?? 0) + 1;
}

export function rollMiningEffect(
  effects: ActiveMiningEffect[],
  type: string,
  context: MiningEffectContext,
  rng: () => number,
  runState?: InternalMineRunState,
): boolean {
  for (const effect of getMatchingEffects(effects, type, context)) {
    if (runState && !canUseLimitedEffect(effect, runState, context.depthLevel ?? runState.currentDepthLevel)) {
      continue;
    }
    const chance = effect.chance ?? 1;
    if (rng() <= chance) {
      if (runState) {
        markEffectUsed(effect, runState, context.depthLevel ?? runState.currentDepthLevel);
      }
      return true;
    }
  }
  return false;
}

function getEffectContextForRun(run: InternalMineRunState): MiningEffectContext {
  const mine = findMineById(run.mineId);
  return {
    mineId: run.mineId,
    depthLevel: run.currentDepthLevel,
    mineTheme: mine?.visualTheme,
    mineDangerLevel: mine?.dangerLevel,
  };
}

function getDynamicValue(
  effects: ActiveMiningEffect[],
  type: string,
  context: MiningEffectContext,
  defaultValue = 0,
): number {
  return defaultValue + sumMiningEffect(effects, type, context, 'flat') + (percentMiningEffect(effects, type, context) / 100);
}

function isForbiddenSavedLoot(itemId: string): boolean {
  const normalized = itemId.trim().toLowerCase();
  return normalized.includes('artifact')
    || normalized.includes('full_rune')
    || normalized.includes('unique')
    || normalized.includes('quest');
}

function canGenericSaveItem(itemId: string, params?: Record<string, unknown>): boolean {
  if (Boolean(params?.allowArtifacts)) {
    return true;
  }
  const normalized = itemId.trim().toLowerCase();
  if (normalized.includes('no_porter_save')) {
    return false;
  }
  return !isForbiddenSavedLoot(itemId);
}

function canPorterSaveItem(itemId: string): boolean {
  const normalized = itemId.trim().toLowerCase();
  if (normalized.includes('no_porter_save')) {
    return false;
  }
  return !isForbiddenSavedLoot(itemId) && !normalized.includes('cursed');
}

function applyKeepRatio(current: MineLootStack[], keepRatio: number, predicate?: (itemId: string) => boolean): MineLootStack[] {
  const ratio = clamp(keepRatio, 0, 1);
  return current
    .map((stack) => {
      if (predicate && !predicate(stack.itemId)) {
        return null;
      }
      const quantity = Math.floor(stack.quantity * ratio);
      return quantity > 0 ? { itemId: stack.itemId, quantity } : null;
    })
    .filter((entry): entry is MineLootStack => Boolean(entry));
}

function selectPorterSavedLoot(source: MineLootStack[], porters: MinePortersState | undefined): MineLootStack[] {
  if (!porters?.enabled) {
    return [];
  }
  const saved: MineLootStack[] = [];
  let remainingItems = Math.max(0, Math.floor(porters.capacityItems));
  let remainingStacks = Math.max(0, Math.floor(porters.capacityStacks));
  for (const stack of source) {
    if (remainingItems <= 0 || remainingStacks <= 0) {
      break;
    }
    if (!canPorterSaveItem(stack.itemId)) {
      continue;
    }
    const quantity = Math.min(stack.quantity, remainingItems);
    if (quantity <= 0) {
      continue;
    }
    saved.push({ itemId: stack.itemId, quantity });
    remainingItems -= quantity;
    remainingStacks -= 1;
  }
  return saved;
}

function createResultSummary(
  run: InternalMineRunState,
  xpAwarded: number,
): MineRunResultSummary {
  return {
    totalLoot: clone(run.collectedLoot ?? []),
    savedLoot: clone(run.awardedLoot ?? []),
    lostLoot: clone(run.lostLoot ?? []),
    savedBySkills: clone(run.savedBySkills ?? []),
    savedByPorters: clone(run.savedByPorters ?? []),
    specialFinds: clone(run.specialFinds ?? []),
    xpAwarded,
    goldAwarded: Math.max(0, Math.floor(run.awardedGold ?? run.temporaryGold ?? 0)),
    bonusGoldFromSellValue: Math.max(0, Math.floor(run.bonusGoldFromSellValue ?? 0)),
  };
}

function maybeApplyFragileLootDamage(params: {
  loot: MineLootStack[];
  blockType: InternalMineBlockState['hiddenType'];
  effects: ActiveMiningEffect[];
  run: InternalMineRunState;
  rng: () => number;
}): MineLootStack[] {
  const { loot, blockType, effects, run, rng } = params;
  if ((blockType !== 'gem' && blockType !== 'crystal') || loot.length === 0) {
    return loot;
  }
  const context = { ...getEffectContextForRun(run), blockType };
  const baseChance = FRAGILE_BREAK_BASE_CHANCE[blockType] ?? 0;
  const modifierPercent = percentMiningEffect(effects, 'mine_fragile_loot_break_chance_modifier', context);
  const finalChance = clamp(baseChance * (1 + modifierPercent / 100), 0, 1);
  const protectedBySkill = modifierPercent < 0 && finalChance < baseChance;
  if (rng() > finalChance) {
    if (protectedBySkill) {
      run.eventLog = pushLog(run.eventLog, 'Ð¥Ñ€ÑƒÐ¿ÐºÐ°Ñ Ð´Ð¾Ð±Ñ‹Ñ‡Ð° Ð²Ñ‹Ð´ÐµÑ€Ð¶Ð°Ð»Ð° ÑƒÐ´Ð°Ñ€.');
      run.skillEffectLog = pushSkillEffectLog(run.skillEffectLog, 'ÐœÑÐ³ÐºÐ¸Ð¹ ÑƒÐ´Ð°Ñ€ ÑÐ¾Ñ…Ñ€Ð°Ð½Ð¸Ð» Ñ…Ñ€ÑƒÐ¿ÐºÑƒÑŽ Ð´Ð¾Ð±Ñ‹Ñ‡Ñƒ.');
    }
    return loot;
  }

  const [first, ...rest] = loot;
  if (!first) {
    return loot;
  }
  if (first.quantity > 1) {
    run.eventLog = pushLog(run.eventLog, blockType === 'crystal' ? 'ÐšÑ€Ð¸ÑÑ‚Ð°Ð»Ð» Ñ‚Ñ€ÐµÑÐ½ÑƒÐ».' : 'Ð¡Ð°Ð¼Ð¾Ñ†Ð²ÐµÑ‚ Ñ€Ð°ÑÐºÐ¾Ð»Ð¾Ð»ÑÑ.');
    return [{ ...first, quantity: first.quantity - 1 }, ...rest];
  }
  if (blockType === 'crystal' && first.itemId !== 'item_cracked_crystal') {
    run.eventLog = pushLog(run.eventLog, 'ÐšÑ€Ð¸ÑÑ‚Ð°Ð»Ð» Ñ‚Ñ€ÐµÑÐ½ÑƒÐ», Ð½Ð¾ Ñ‡Ð°ÑÑ‚ÑŒ ÑÐµÑ€Ð´Ñ†ÐµÐ²Ð¸Ð½Ñ‹ ÑƒÑ†ÐµÐ»ÐµÐ»Ð°.');
    return [{ itemId: 'item_cracked_crystal', quantity: 1 }, ...rest];
  }
  run.eventLog = pushLog(run.eventLog, blockType === 'crystal' ? 'ÐšÑ€Ð¸ÑÑ‚Ð°Ð»Ð» Ñ€Ð°ÑÑÑ‹Ð¿Ð°Ð»ÑÑ Ð² Ð¿Ñ‹Ð»ÑŒ.' : 'Ð¡Ð°Ð¼Ð¾Ñ†Ð²ÐµÑ‚ Ð¾ÐºÐ°Ð·Ð°Ð»ÑÑ Ð¸ÑÐ¿Ð¾Ñ€Ñ‡ÐµÐ½.');
  return rest;
}

function maybeAddSpecialProperty(params: {
  loot: MineLootStack[];
  blockType: InternalMineBlockState['hiddenType'];
  effects: ActiveMiningEffect[];
  run: InternalMineRunState;
  rng: () => number;
}): void {
  const { loot, blockType, effects, run, rng } = params;
  if ((blockType !== 'gem' && blockType !== 'crystal') || loot.length === 0) {
    return;
  }
  const context = { ...getEffectContextForRun(run), blockType };
  const chance = clamp(
    (sumMiningEffect(effects, 'mine_loot_special_property_chance', context, 'flat') / 100)
      + (percentMiningEffect(effects, 'mine_loot_special_property_chance', context) / 100),
    0,
    1,
  );
  if (chance <= 0 || rng() > chance) {
    return;
  }
  const sourceSkill = getMatchingEffects(effects, 'mine_loot_special_property_chance', context)[0];
  const first = loot[0];
  if (!first) {
    return;
  }
  const propertyId = pickSpecialProperty(run, rng);
  const specialFind: MineSpecialFind = {
    itemId: first.itemId,
    quantity: first.quantity,
    propertyId,
    sourceSkillId: sourceSkill?.skillId,
  };
  run.specialFinds = [...(run.specialFinds ?? []), specialFind];
  const label = fixMojibake(SPECIAL_PROPERTY_LABELS[propertyId] ?? 'Ð¡ÐºÑ€Ñ‹Ñ‚Ð¾Ðµ ÑÐ²Ð¾Ð¹ÑÑ‚Ð²Ð¾');
  run.eventLog = pushLog(run.eventLog, `ÐžÑÐ¾Ð±Ð¾Ðµ ÑÐ²Ð¾Ð¹ÑÑ‚Ð²Ð¾: ${label}.`);
  run.skillEffectLog = pushSkillEffectLog(run.skillEffectLog, 'ÐŸÐ°Ð¼ÑÑ‚ÑŒ ÐºÐ°Ð¼Ð½Ñ: Ð½Ð°Ð¹Ð´ÐµÐ½ ÐºÑ€Ð¸ÑÑ‚Ð°Ð»Ð» ÑÐ¾ ÑÐºÑ€Ñ‹Ñ‚Ñ‹Ð¼ ÑÐ²Ð¾Ð¹ÑÑ‚Ð²Ð¾Ð¼.');
}

function maybeAddDynamicRuneTrace(
  run: InternalMineRunState,
  blockType: InternalMineBlockState['hiddenType'],
  effects: ActiveMiningEffect[],
  rng: () => number,
): MineLootStack[] {
  const context = { ...getEffectContextForRun(run), blockType };
  const percent = percentMiningEffect(effects, 'mine_rune_fragment_chance_modifier', context);
  const flat = sumMiningEffect(effects, 'mine_rune_fragment_chance_modifier', context, 'flat');
  if (percent === 0 && flat === 0) {
    return [];
  }
  const chance = clamp(0.02 + (percent / 200) + (flat / 100), 0, 0.35);
  if (rng() > chance) {
    return [];
  }
  const itemId = rng() <= 0.4 ? 'item_rune_dust' : 'item_rune_fragment_weak';
  run.eventLog = pushLog(run.eventLog, itemId === 'item_rune_dust' ? 'Ð’ ÐºÐ°Ð¼Ð½Ðµ Ð¾ÑÑ‚Ð°Ð»Ð°ÑÑŒ Ñ€ÑƒÐ½Ð½Ð°Ñ Ð¿Ñ‹Ð»ÑŒ.' : 'Ð’Ñ‹ Ð½Ð°ÑˆÐ»Ð¸ ÑÐ»Ð°Ð±Ñ‹Ð¹ Ñ€ÑƒÐ½Ð½Ñ‹Ð¹ Ð¾ÑÐºÐ¾Ð»Ð¾Ðº.');
  run.skillEffectLog = pushSkillEffectLog(run.skillEffectLog, 'Ð¡Ð»ÐµÐ´Ñ‹ Ð´Ñ€ÐµÐ²Ð½Ð¸Ñ…: Ð½Ð°Ð¹Ð´ÐµÐ½ Ñ€ÑƒÐ½Ð½Ñ‹Ð¹ ÑÐ»ÐµÐ´.');
  return [buildLoot(itemId, 1)];
}

function resolveMineEvent(
  run: InternalMineRunState,
  eventId: string,
  effects: ActiveMiningEffect[],
  rng: () => number,
): MineLootStack[] {
  switch (eventId) {
    case 'ancient_tablet':
      run.earnedXp += 12;
      run.eventLog = pushLog(run.eventLog, 'Ð”Ñ€ÐµÐ²Ð½ÑÑ Ñ‚Ð°Ð±Ð»Ð¸Ñ‡ÐºÐ° Ð¿Ð¾Ð´ÑÐºÐ°Ð·Ð°Ð»Ð° Ð·Ð°Ð±Ñ‹Ñ‚Ñ‹Ð¹ Ð¿Ñ€Ð¸Ñ‘Ð¼ Ð³Ð¾Ñ€Ð½ÑÐºÐ°.');
      run.skillEffectLog = pushSkillEffectLog(run.skillEffectLog, 'Ð¯Ð·Ñ‹Ðº Ñ‚Ñ€ÐµÑ‰Ð¸Ð½: Ð¾Ð±Ð½Ð°Ñ€ÑƒÐ¶ÐµÐ½Ð¾ Ð´Ñ€ÐµÐ²Ð½ÐµÐµ ÑÐ¾Ð±Ñ‹Ñ‚Ð¸Ðµ.');
      return [];
    case 'dwarf_cart':
      run.eventLog = pushLog(run.eventLog, 'Ð’ Ð·Ð°Ð²Ð°Ð»Ðµ ÑƒÑ†ÐµÐ»ÐµÐ»Ð° ÑÑ‚Ð°Ñ€Ð°Ñ Ð³Ð½Ð¾Ð¼ÑŒÑ Ñ‚ÐµÐ»ÐµÐ¶ÐºÐ°.');
      return [buildLoot(rng() <= 0.3 ? 'item_small_gold_nugget' : 'item_iron_ore', 1)];
    case 'hidden_cache':
      run.eventLog = pushLog(run.eventLog, 'Ð’Ñ‹ Ð½Ð°ÑˆÐ»Ð¸ ÑÐºÑ€Ñ‹Ñ‚Ñ‹Ð¹ Ñ‚Ð°Ð¹Ð½Ð¸Ðº ÑˆÐ°Ñ…Ñ‚Ñ‘Ñ€Ð¾Ð².');
      return [buildLoot(rng() <= 0.5 ? 'item_iron_ore' : 'item_cracked_crystal', 1)];
    case 'spirit_whisper': {
      run.eventLog = pushLog(run.eventLog, 'Ð¨Ñ‘Ð¿Ð¾Ñ‚ Ð² ÑÑ‚ÐµÐ½Ð°Ñ… Ð¿Ñ€ÐµÐ´ÑƒÐ¿Ñ€ÐµÐ¶Ð´Ð°ÐµÑ‚ Ð¾Ð± Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑ‚Ð¸.');
      const hazard = findMineHazardById('hazard_spirit_attack');
      if (hazard) {
        applyHazardToRun(run, hazard, effects, getEffectContextForRun(run), rng, 0.5);
      }
      return [];
    }
    case 'old_mining_mark': {
      const target = run.blocks.find((block) => block.state === 'closed' && (block.hiddenType === 'passage' || block.hiddenType === 'hazard'));
      if (target) {
        target.label = target.hiddenType === 'passage' ? 'Ð¡Ñ‚Ð°Ñ€Ñ‹Ð¹ Ð·Ð½Ð°Ðº Ð¿Ñ€Ð¾Ñ…Ð¾Ð´Ð°' : 'Ð¡Ñ‚Ð°Ñ€Ñ‹Ð¹ Ð·Ð½Ð°Ðº Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑ‚Ð¸';
      }
      run.eventLog = pushLog(run.eventLog, 'Ð¡Ñ‚Ð°Ñ€Ñ‹Ðµ Ð¼ÐµÑ‚ÐºÐ¸ Ð¿Ð¾Ð´ÑÐºÐ°Ð·Ð°Ð»Ð¸, ÐºÑƒÐ´Ð° ÑÐ¼Ð¾Ñ‚Ñ€ÐµÑ‚ÑŒ Ð´Ð°Ð»ÑŒÑˆÐµ.');
      run.skillEffectLog = pushSkillEffectLog(run.skillEffectLog, 'Ð¯Ð·Ñ‹Ðº Ñ‚Ñ€ÐµÑ‰Ð¸Ð½: Ð¾Ð±Ð½Ð°Ñ€ÑƒÐ¶ÐµÐ½Ð¾ Ð´Ñ€ÐµÐ²Ð½ÐµÐµ ÑÐ¾Ð±Ñ‹Ñ‚Ð¸Ðµ.');
      return [];
    }
    default:
      run.eventLog = pushLog(run.eventLog, `ÐÐµÐ¸Ð·Ð²ÐµÑÑ‚Ð½Ð¾Ðµ ÑÐ¾Ð±Ñ‹Ñ‚Ð¸Ðµ ÑˆÐ°Ñ…Ñ‚Ñ‹: ${eventId}`);
      return [];
  }
}

function calculatePorters(effects: ActiveMiningEffect[], context: MiningEffectContext): MinePortersState | undefined {
  const unlocks = getMatchingEffects(effects, 'mine_porters_unlock', context);
  if (unlocks.length === 0) {
    return undefined;
  }
  const baseItems = unlocks.reduce((max, effect) => Math.max(max, Number(effect.params?.capacityItems ?? 3)), 3);
  const baseStacks = unlocks.reduce((max, effect) => Math.max(max, Number(effect.params?.capacityStacks ?? 3)), 3);
  const extraItems = getMatchingEffects(effects, 'mine_porters_capacity_modifier', context)
    .filter((effect) => effect.params?.capacityType === 'items')
    .reduce((sum, effect) => sum + (Number(effect.value ?? 0) || 0), 0);
  const extraStacks = getMatchingEffects(effects, 'mine_porters_capacity_modifier', context)
    .filter((effect) => effect.params?.capacityType === 'stacks')
    .reduce((sum, effect) => sum + (Number(effect.value ?? 0) || 0), 0);
  return {
    enabled: true,
    capacityItems: Math.max(0, Math.floor(baseItems + extraItems)),
    capacityStacks: Math.max(0, Math.floor(baseStacks + extraStacks)),
    savedLoot: [],
    used: false,
  };
}

function rollLoot(
  entries: MineLootEntry[],
  depthLevel: number,
  effects: ActiveMiningEffect[],
  context: MiningEffectContext,
  rng: () => number,
): MineLootStack[] {
  const filtered = entries.filter((entry) => !entry.requiredDepth || depthLevel >= entry.requiredDepth);
  if (filtered.length === 0) {
    return [];
  }
  const selected = weightedPick(filtered, rng);
  const min = Math.max(1, Math.floor(selected.minQuantity));
  const max = Math.max(min, Math.floor(selected.maxQuantity));
  const baseQuantity = min + Math.floor(rng() * (max - min + 1));
  const quantityFlat = sumMiningEffect(effects, 'mine_loot_quantity_modifier', { ...context, lootRarity: selected.rarity }, 'flat');
  const quantityPercent = percentMiningEffect(effects, 'mine_loot_quantity_modifier', { ...context, lootRarity: selected.rarity });
  const quantity = Math.max(1, Math.floor((baseQuantity + quantityFlat) * (1 + quantityPercent / 100)));
  return [buildLoot(selected.itemId, quantity)];
}

function getResourceWeightMultiplier(type: MineBlockEntry['type'], effects: ActiveMiningEffect[], context: MiningEffectContext): number {
  let percent = 0;
  let flat = 0;
  if (type === 'ore') {
    percent += percentMiningEffect(effects, 'mine_ore_chance_modifier', { ...context, blockType: type });
    flat += sumMiningEffect(effects, 'mine_ore_chance_modifier', { ...context, blockType: type }, 'flat');
  }
  if (type === 'rich_ore') {
    percent += percentMiningEffect(effects, 'mine_rare_ore_chance_modifier', { ...context, blockType: type });
    flat += sumMiningEffect(effects, 'mine_rare_ore_chance_modifier', { ...context, blockType: type }, 'flat');
  }
  if (type === 'gold') {
    percent += percentMiningEffect(effects, 'mine_gold_chance_modifier', { ...context, blockType: type });
    flat += sumMiningEffect(effects, 'mine_gold_chance_modifier', { ...context, blockType: type }, 'flat');
  }
  if (type === 'gem') {
    percent += percentMiningEffect(effects, 'mine_gem_chance_modifier', { ...context, blockType: type });
    flat += sumMiningEffect(effects, 'mine_gem_chance_modifier', { ...context, blockType: type }, 'flat');
  }
  if (type === 'crystal') {
    percent += percentMiningEffect(effects, 'mine_crystal_chance_modifier', { ...context, blockType: type });
    flat += sumMiningEffect(effects, 'mine_crystal_chance_modifier', { ...context, blockType: type }, 'flat');
  }
  if (type === 'event') {
    percent += percentMiningEffect(effects, 'mine_event_chance_modifier', { ...context, blockType: type });
    flat += sumMiningEffect(effects, 'mine_event_chance_modifier', { ...context, blockType: type }, 'flat');
  }
  if (type === 'passage') {
    percent += percentMiningEffect(effects, 'mine_passage_chance_modifier', { ...context, blockType: type });
    flat += sumMiningEffect(effects, 'mine_passage_chance_modifier', { ...context, blockType: type }, 'flat');
  }
  if (type === 'exit') {
    percent += percentMiningEffect(effects, 'mine_exit_chance_modifier', { ...context, blockType: type });
    flat += sumMiningEffect(effects, 'mine_exit_chance_modifier', { ...context, blockType: type }, 'flat');
  }
  percent += percentMiningEffect(effects, 'mine_block_weight_modifier', { ...context, blockType: type });
  flat += sumMiningEffect(effects, 'mine_block_weight_modifier', { ...context, blockType: type }, 'flat');
  return Math.max(0.05, 1 + (percent / 100) + flat);
}

function getPayloadWeightMultiplier(
  payload: MineBlockPayload,
  blockType: MineBlockEntry['type'],
  effects: ActiveMiningEffect[],
  context: MiningEffectContext,
): number {
  const payloadContext: MiningEffectContext = {
    ...context,
    blockType,
    lootRarity: payload.rarity,
    itemTags: payload.tags,
  };
  let percent = percentMiningEffect(effects, 'mine_payload_type_chance_modifier', payloadContext);
  let flat = sumMiningEffect(effects, 'mine_payload_type_chance_modifier', payloadContext, 'flat');

  if (payload.type === 'rune_trace') {
    percent += percentMiningEffect(effects, 'mine_rune_trace_chance_modifier', payloadContext);
    percent += percentMiningEffect(effects, 'mine_rune_fragment_chance_modifier', payloadContext);
    flat += sumMiningEffect(effects, 'mine_rune_trace_chance_modifier', payloadContext, 'flat');
    flat += sumMiningEffect(effects, 'mine_rune_fragment_chance_modifier', payloadContext, 'flat');
  }
  if (payload.type === 'hazard_ref') {
    percent += percentMiningEffect(effects, 'mine_hazard_weight_modifier', payloadContext);
    flat += sumMiningEffect(effects, 'mine_hazard_weight_modifier', payloadContext, 'flat');
  }
  if (payload.type === 'event_ref') {
    percent += percentMiningEffect(effects, 'mine_event_weight_modifier', payloadContext);
    percent += percentMiningEffect(effects, 'mine_event_chance_modifier', payloadContext);
    flat += sumMiningEffect(effects, 'mine_event_weight_modifier', payloadContext, 'flat');
    flat += sumMiningEffect(effects, 'mine_event_chance_modifier', payloadContext, 'flat');
  }

  return Math.max(0.05, 1 + percent / 100 + flat);
}

function generateBlocks(depth: MineDepth, effects: ActiveMiningEffect[], rng: () => number): InternalMineBlockState[] {
  const blockTable = findMineBlockTableById(depth.blockTableId);
  const mine = findMineById(depth.mineId);
  if (!blockTable || blockTable.entries.length === 0 || !mine) {
    throw new Error(`Block table not found: ${depth.blockTableId}`);
  }
  const context: MiningEffectContext = {
    mineId: depth.mineId,
    depthLevel: depth.depthLevel,
    mineTheme: mine.visualTheme,
    mineDangerLevel: mine.dangerLevel,
  };
  const weightedEntries: MineBlockEntry[] = blockTable.entries.map((entry: MineBlockEntry) => ({
    ...entry,
    weight: Math.max(0.1, entry.weight * getResourceWeightMultiplier(entry.type, effects, context)),
  }));

  const blockCount = Math.max(1, depth.rows * depth.columns);
  const result: InternalMineBlockState[] = [];
  for (let index = 0; index < blockCount; index += 1) {
    const selected = weightedPick(weightedEntries, rng);
    result.push({
      index,
      state: 'closed',
      hiddenType: selected.type,
      hiddenLabel: selected.label ?? blockLabelForType(selected.type),
      label: undefined,
      hiddenLootTableId: selected.lootTableId || depth.lootTableId,
      hiddenHazardTableId: selected.hazardTableId || depth.hazardTableId,
      hiddenPayloads: selected.payloads,
    });
  }

  const closedIndexes = result.map((entry) => entry.index);
  // Legacy exit blocks are intentionally ignored: safe exit is always available via UI button.
  if (depth.canSpawnPassage && !depth.isFinalDepth && !result.some((entry) => entry.hiddenType === 'passage')) {
    const randomIndex = closedIndexes[Math.floor(rng() * closedIndexes.length)] ?? 0;
    result[randomIndex] = { ...result[randomIndex]!, hiddenType: 'passage', hiddenLabel: 'ÐŸÑ€Ð¾Ñ…Ð¾Ð´' };
  }
  return result;
}

function applyStartHints(run: InternalMineRunState, effects: ActiveMiningEffect[], rng: () => number): void {
  const context = getEffectContextForRun(run);
  const revealMatching = (type: InternalMineBlockState['hiddenType'], label: string) => {
    const candidates = run.blocks.filter((block) => block.state === 'closed' && block.hiddenType === type);
    if (candidates.length === 0) {
      return;
    }
    const selected = candidates[Math.floor(rng() * candidates.length)]!;
    selected.label = label;
  };

  if (hasMiningEffect(effects, 'mine_start_with_exit_hint', context)) {
    revealMatching('exit', 'Ð¡Ð»ÐµÐ´ Ðº Ð²Ñ‹Ñ…Ð¾Ð´Ñƒ');
  }
  if (hasMiningEffect(effects, 'mine_start_with_passage_hint', context)) {
    revealMatching('passage', 'Ð¡Ð»ÐµÐ´ Ð²Ð½Ð¸Ð·');
  }

  run.blocks.forEach((block) => {
    if (block.state !== 'closed') {
      return;
    }
    const blockHintChance = sumMiningEffect(
      effects,
      'mine_block_hint_chance',
      { ...context, blockType: block.hiddenType },
      'flat',
    );
    if (blockHintChance <= 0) {
      return;
    }
    if (rng() <= blockHintChance) {
      block.label = block.hiddenLabel;
    }
  });
}

function rollHazard(hazardTableId: string, depthLevel: number, rng: () => number, collapseOnly = false): MineHazard | null {
  const hazardTable = findMineHazardTableById(hazardTableId);
  if (!hazardTable) {
    return null;
  }
  const eligible = hazardTable.entries
    .filter((entry) => {
      if (entry.minDepth && depthLevel < entry.minDepth) {
        return false;
      }
      if (entry.maxDepth && depthLevel > entry.maxDepth) {
        return false;
      }
      const hazard = findMineHazardById(entry.hazardId);
      if (!hazard?.isEnabled) {
        return false;
      }
      if (!collapseOnly) {
        return true;
      }
      return hazard.type.includes('collapse');
    })
    .map((entry) => ({
      weight: entry.weight,
      hazard: findMineHazardById(entry.hazardId)!,
    }));

  if (eligible.length === 0) {
    return null;
  }
  return weightedPick(eligible, rng).hazard;
}

function applyResistanceDamage(base: number, flat: number, percent: number, multiplier: number): number {
  const reduced = (Math.max(0, base) - flat) * (1 - percent / 100) * multiplier;
  return Math.max(0, Math.floor(reduced));
}

function getHazardResistance(effects: ActiveMiningEffect[], context: MiningEffectContext): { flat: number; percent: number } {
  let flat = sumMiningEffect(effects, 'mine_hazard_resistance', context, 'flat');
  let percent = percentMiningEffect(effects, 'mine_hazard_resistance', context);
  const hazardType = context.hazardType ?? '';
  const map: Record<string, string[]> = {
    gas: ['mine_gas_resistance'],
    poison_gas: ['mine_gas_resistance'],
    toxic_gas: ['mine_gas_resistance'],
    dust: ['mine_dust_resistance'],
    silica_dust: ['mine_dust_resistance'],
    lava_crack: ['mine_lava_resistance', 'mine_fire_resistance'],
    fire_burst: ['mine_lava_resistance', 'mine_fire_resistance'],
    steam_burst: ['mine_lava_resistance', 'mine_fire_resistance'],
    ice_crack: ['mine_ice_resistance'],
    frost_pocket: ['mine_ice_resistance'],
    spirit: ['mine_spirit_resistance'],
    spirit_attack: ['mine_spirit_resistance'],
    wraith: ['mine_spirit_resistance'],
    curse: ['mine_curse_resistance'],
    rune_backlash: ['mine_curse_resistance'],
    minor_collapse: ['mine_collapse_damage_modifier'],
    medium_collapse: ['mine_collapse_damage_modifier'],
    major_collapse: ['mine_collapse_damage_modifier'],
    deadly_collapse: ['mine_collapse_damage_modifier'],
    rockfall: ['mine_collapse_damage_modifier'],
    cave_in: ['mine_collapse_damage_modifier'],
  };
  for (const type of map[hazardType] ?? []) {
    flat += sumMiningEffect(effects, type, context, 'flat');
    percent += percentMiningEffect(effects, type, context);
  }
  return { flat, percent };
}

function buildFailureRecovery(
  run: InternalMineRunState,
  effects: ActiveMiningEffect[],
  rng: () => number,
  mode: 'dead' | 'failed',
): InternalMineRunState {
  const context = getEffectContextForRun(run);
  const keptBySkillRatio = clamp(percentMiningEffect(effects, 'mine_death_loot_save_modifier', context) / 100, 0, 1);
  const savedBySkills = applyKeepRatio(run.temporaryLoot, keptBySkillRatio, (itemId) => canGenericSaveItem(itemId));
  const afterSkillLoss = subtractLootStacks(run.temporaryLoot, savedBySkills);
  const canPortersRecover = run.porters?.enabled && hasMiningEffect(effects, 'mine_porters_save_items_on_death', context);
  const savedByPorters = canPortersRecover ? selectPorterSavedLoot(afterSkillLoss, run.porters) : [];
  const awardedLoot = mergeLootStacks(savedBySkills, savedByPorters);
  const lostLoot = subtractLootStacks(run.temporaryLoot, awardedLoot);
  const nextRun: InternalMineRunState = {
    ...run,
    status: mode,
    temporaryLoot: awardedLoot,
    awardedLoot,
    savedBySkills,
    savedByPorters,
    lostLoot,
    temporaryGold: 0,
    awardedGold: 0,
    bonusGoldFromSellValue: 0,
  };
  if (nextRun.porters) {
    nextRun.porters.savedLoot = savedByPorters;
    nextRun.porters.used = savedByPorters.length > 0;
  }
  nextRun.resultSummary = createResultSummary(nextRun, getMineRunAwardXp(nextRun));
  nextRun.eventLog = pushLog(nextRun.eventLog, mode === 'dead' ? 'Ð’Ñ‹ Ð¿Ð¾Ñ‚ÐµÑ€ÑÐ»Ð¸ ÑÐ¾Ð·Ð½Ð°Ð½Ð¸Ðµ Ð² ÑˆÐ°Ñ…Ñ‚Ðµ.' : 'Ð’Ñ‹ Ð½Ðµ ÑÐ¼Ð¾Ð³Ð»Ð¸ Ð²Ñ‹Ð±Ñ€Ð°Ñ‚ÑŒÑÑ Ð¸Ð· ÑˆÐ°Ñ…Ñ‚Ñ‹.');
  if (savedByPorters.length > 0) {
    nextRun.eventLog = pushLog(nextRun.eventLog, 'ÐÐ¾ÑÐ¸Ð»ÑŒÑ‰Ð¸ÐºÐ¸ Ð²Ñ‹Ð½ÐµÑÐ»Ð¸ Ñ‡Ð°ÑÑ‚ÑŒ Ð´Ð¾Ð±Ñ‹Ñ‡Ð¸.');
  }
  if (savedBySkills.length > 0) {
    nextRun.eventLog = pushLog(nextRun.eventLog, 'ÐÐ°Ð²Ñ‹Ðº ÑÐ¿Ð°Ñ Ñ‡Ð°ÑÑ‚ÑŒ Ñ€ÐµÑÑƒÑ€ÑÐ¾Ð².');
  }
  return nextRun;
}

function applyRetreatRecovery(run: InternalMineRunState, effects: ActiveMiningEffect[]): InternalMineRunState {
  const baseKeepByDepth: Record<number, number> = {
    1: 0.75,
    2: 0.6,
    3: 0.4,
    4: 0.2,
  };
  const context = getEffectContextForRun(run);
  const keepBonus = percentMiningEffect(effects, 'mine_retreat_loot_save', context) / 100
    + sumMiningEffect(effects, 'mine_retreat_loot_save', context, 'flat');
  const keepRatio = clamp((baseKeepByDepth[run.currentDepthLevel] ?? 0.2) + keepBonus, 0, 1);
  const baseKept = applyKeepRatio(run.temporaryLoot, keepRatio);
  const lostLoot = subtractLootStacks(run.temporaryLoot, baseKept);
  const canPortersRecover = run.porters?.enabled && hasMiningEffect(effects, 'mine_porters_save_items_on_retreat', context);
  const savedByPorters = canPortersRecover ? selectPorterSavedLoot(lostLoot, run.porters) : [];
  const awardedLoot = mergeLootStacks(baseKept, savedByPorters);
  const finalLost = subtractLootStacks(run.temporaryLoot, awardedLoot);
  const nextRun: InternalMineRunState = {
    ...run,
    status: 'retreated',
    temporaryLoot: awardedLoot,
    awardedLoot,
    savedBySkills: [],
    savedByPorters,
    lostLoot: finalLost,
    temporaryGold: Math.max(0, Math.floor((run.temporaryGold ?? 0) * keepRatio)),
    awardedGold: Math.max(0, Math.floor((run.temporaryGold ?? 0) * keepRatio)),
    bonusGoldFromSellValue: 0,
  };
  if (nextRun.porters) {
    nextRun.porters.savedLoot = savedByPorters;
    nextRun.porters.used = savedByPorters.length > 0;
  }
  nextRun.resultSummary = createResultSummary(nextRun, getMineRunAwardXp(nextRun));
  nextRun.eventLog = pushLog(nextRun.eventLog, 'Ð’Ñ‹ Ð¾Ñ‚ÑÑ‚ÑƒÐ¿Ð¸Ð»Ð¸ Ð¸ Ð¿Ð¾Ñ‚ÐµÑ€ÑÐ»Ð¸ Ñ‡Ð°ÑÑ‚ÑŒ Ð´Ð¾Ð±Ñ‹Ñ‡Ð¸.');
  if (savedByPorters.length > 0) {
    nextRun.eventLog = pushLog(nextRun.eventLog, 'ÐÐ¾ÑÐ¸Ð»ÑŒÑ‰Ð¸ÐºÐ¸ Ð²Ñ‹Ð½ÐµÑÐ»Ð¸ Ñ‡Ð°ÑÑ‚ÑŒ Ð´Ð¾Ð±Ñ‹Ñ‡Ð¸.');
  }
  return nextRun;
}

function applyEscapeResult(run: InternalMineRunState, effects: ActiveMiningEffect[] = []): InternalMineRunState {
  const awardedLoot = clone(run.temporaryLoot);
  const context = getEffectContextForRun(run);
  const nextRun: InternalMineRunState = {
    ...run,
    status: 'escaped',
    awardedLoot,
    awardedGold: Math.max(0, Math.floor(run.temporaryGold ?? 0)),
    lostLoot: [],
    savedBySkills: [],
    savedByPorters: run.porters?.savedLoot ?? [],
    bonusGoldFromSellValue: 0,
  };
  const sellValuePercent = percentMiningEffect(effects, 'mine_loot_sell_value_modifier', context);
  if (sellValuePercent > 0) {
    nextRun.bonusGoldFromSellValue = Math.max(0, Math.floor(estimateLootStacksGoldValue(awardedLoot) * (sellValuePercent / 100)));
    nextRun.awardedGold = Math.max(0, Math.floor((nextRun.awardedGold ?? 0) + nextRun.bonusGoldFromSellValue));
    if (nextRun.bonusGoldFromSellValue > 0) {
      nextRun.eventLog = pushLog(nextRun.eventLog, `Ð¢Ð¾Ñ€Ð³Ð¾Ð²Ñ‹Ð¹ Ð³Ð»Ð°Ð· Ð´Ð¾Ð±Ð°Ð²Ð¸Ð» +${nextRun.bonusGoldFromSellValue} Ð·Ð¾Ð»Ð¾Ñ‚Ð°.`);
      nextRun.skillEffectLog = pushSkillEffectLog(nextRun.skillEffectLog, `Ð¢Ð¾Ñ€Ð³Ð¾Ð²Ñ‹Ð¹ Ð³Ð»Ð°Ð· Ð´Ð¾Ð±Ð°Ð²Ð¸Ð» +${nextRun.bonusGoldFromSellValue} Ð·Ð¾Ð»Ð¾Ñ‚Ð°.`);
    }
  }
  nextRun.resultSummary = createResultSummary(nextRun, getMineRunAwardXp(nextRun));
  nextRun.eventLog = pushLog(nextRun.eventLog, 'Ð’Ñ‹ Ð²Ñ‹Ð±Ñ€Ð°Ð»Ð¸ÑÑŒ Ð¸Ð· ÑˆÐ°Ñ…Ñ‚Ñ‹.');
  return nextRun;
}

function getAdjacentIndexes(
  depth: MineDepth,
  centerIndex: number,
  radius: number,
  includeDiagonals: boolean,
): number[] {
  const row = Math.floor(centerIndex / depth.columns);
  const col = centerIndex % depth.columns;
  const indexes: number[] = [];
  for (let y = row - radius; y <= row + radius; y += 1) {
    for (let x = col - radius; x <= col + radius; x += 1) {
      if (y < 0 || x < 0 || y >= depth.rows || x >= depth.columns) {
        continue;
      }
      const distanceRow = Math.abs(y - row);
      const distanceCol = Math.abs(x - col);
      if (distanceRow === 0 && distanceCol === 0) {
        continue;
      }
      if (!includeDiagonals && distanceRow > 0 && distanceCol > 0) {
        continue;
      }
      indexes.push(y * depth.columns + x);
    }
  }
  return indexes;
}

interface ResolveBlockOptions {
  hazardMultiplier?: number;
}

function pickBlockPayload(
  payloads: MineBlockPayload[] | undefined,
  blockType: MineBlockEntry['type'],
  depthLevel: number,
  effects: ActiveMiningEffect[],
  context: MiningEffectContext,
  rng: () => number,
): MineBlockPayload | null {
  const eligible = (payloads ?? [])
    .filter((payload) => {
      if (payload.minDepth !== undefined && depthLevel < payload.minDepth) {
        return false;
      }
      if (payload.maxDepth !== undefined && depthLevel > payload.maxDepth) {
        return false;
      }
      return true;
    })
    .map((payload) => ({
      ...payload,
      weight: Math.max(0.1, payload.weight * getPayloadWeightMultiplier(payload, blockType, effects, context)),
    }));

  if (eligible.length === 0) {
    return null;
  }
  return weightedPick(eligible, rng);
}

function applyHazardToRun(
  run: InternalMineRunState,
  hazard: MineHazard,
  effects: ActiveMiningEffect[],
  baseContext: MiningEffectContext,
  rng: () => number,
  hazardMultiplier: number,
): void {
  const hazardContext: MiningEffectContext = { ...baseContext, hazardType: hazard.type, blockType: 'hazard' };
  if (rollMiningEffect(effects, 'mine_ignore_first_hazard', hazardContext, rng, run)) {
    run.eventLog = pushLog(run.eventLog, `${hazard.name}: Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑ‚ÑŒ ÑÑ€Ð°Ð±Ð¾Ñ‚Ð°Ð»Ð°, Ð½Ð¾ Ð½Ð°Ð²Ñ‹Ðº ÐµÑ‘ Ð½ÐµÐ¹Ñ‚Ñ€Ð°Ð»Ð¸Ð·Ð¾Ð²Ð°Ð».`);
    return;
  }

  const resistance = getHazardResistance(effects, hazardContext);
  const specificHazardResistFlat = sumMiningEffect(effects, 'mine_hazard_type_resistance', hazardContext, 'flat');
  const specificHazardResistPercent = percentMiningEffect(effects, 'mine_hazard_type_resistance', hazardContext);
  const collapseFlat = sumMiningEffect(effects, 'mine_collapse_damage_modifier', hazardContext, 'flat');
  const collapsePercent = percentMiningEffect(effects, 'mine_collapse_damage_modifier', hazardContext);
  const hpDamageBase = hazard.hpDamageMin + Math.floor(rng() * (Math.max(hazard.hpDamageMin, hazard.hpDamageMax) - hazard.hpDamageMin + 1));
  const staminaDamageBase = hazard.staminaDamageMin + Math.floor(rng() * (Math.max(hazard.staminaDamageMin, hazard.staminaDamageMax) - hazard.staminaDamageMin + 1));
  const hpDamage = applyResistanceDamage(
    hpDamageBase,
    resistance.flat + collapseFlat + specificHazardResistFlat,
    resistance.percent + collapsePercent + specificHazardResistPercent,
    hazardMultiplier,
  );
  const staminaDamage = applyResistanceDamage(
    staminaDamageBase,
    resistance.flat + collapseFlat + specificHazardResistFlat,
    resistance.percent + collapsePercent + specificHazardResistPercent,
    hazardMultiplier,
  );

  run.hp = Math.max(0, run.hp - hpDamage);
  run.stamina = Math.max(0, run.stamina - staminaDamage);
  if (hazard.lootLossChance > 0 && run.temporaryLoot.length > 0 && rng() <= hazard.lootLossChance * hazardMultiplier) {
    const keepRatio = clamp(1 - (hazard.lootLossPercent * hazardMultiplier), 0, 1);
    run.temporaryLoot = applyKeepRatio(run.temporaryLoot, keepRatio);
  }
  run.eventLog = pushLog(run.eventLog, `${hazard.name}: -${hpDamage} HP, -${staminaDamage} stamina.`);
}

function resolveBlockOpen(
  run: InternalMineRunState,
  blockIndex: number,
  effects: ActiveMiningEffect[],
  rng: () => number,
  options: ResolveBlockOptions = {},
): void {
  const depth = findDepthById(run.currentDepthId);
  if (!depth) {
    return;
  }
  const block = run.blocks[blockIndex];
  if (!block || block.state === 'opened') {
    return;
  }
  const baseContext = getEffectContextForRun(run);
  const hazardMultiplier = options.hazardMultiplier ?? 1;
  block.state = 'opened';
  block.visibleType = block.hiddenType;
  block.label = block.hiddenLabel ?? blockLabelForType(block.hiddenType);

  if (block.hiddenType === 'empty') {
    run.eventLog = pushLog(run.eventLog, 'Пустая порода. Здесь ничего полезного.');
    return;
  }

  if (['stone', 'ore', 'rich_ore', 'gold', 'gem', 'crystal'].includes(block.hiddenType)) {
    const payload = pickBlockPayload(block.hiddenPayloads, block.hiddenType, depth.depthLevel, effects, baseContext, rng);
    let loot: MineLootStack[] = [];

    if (payload) {
      if (payload.type === 'hazard_ref' && payload.hazardId) {
        const hazard = findMineHazardById(payload.hazardId);
        if (hazard) {
          block.hazardId = hazard.id;
          applyHazardToRun(run, hazard, effects, baseContext, rng, hazardMultiplier);
          return;
        }
        run.eventLog = pushLog(run.eventLog, `Неизвестная опасность: ${payload.hazardId}`);
        return;
      }

      if (payload.type === 'event_ref') {
        block.label = payload.eventId ? `Событие: ${payload.eventId}` : 'Событие';
        loot = resolveMineEvent(run, payload.eventId ?? 'hidden_cache', effects, rng);
      } else if (payload.type === 'gold') {
        const minGold = Math.max(0, Math.floor(payload.goldMin ?? 0));
        const maxGold = Math.max(minGold, Math.floor(payload.goldMax ?? minGold));
        const goldAmount = minGold + Math.floor(rng() * (maxGold - minGold + 1));
        run.temporaryGold = Math.max(0, (run.temporaryGold ?? 0) + goldAmount);
        run.eventLog = pushLog(run.eventLog, goldAmount > 0 ? `Найдено золото: +${goldAmount}.` : 'Золота не найдено.');
        block.visibleType = 'loot';
        return;
      } else if (payload.type === 'rune_trace' || payload.type === 'loot_item' || payload.type === 'loot_material') {
        const itemId = payload.itemId || payload.materialId || (payload.type === 'rune_trace' ? 'item_rune_fragment_weak' : '');
        if (!itemId) {
          run.eventLog = pushLog(run.eventLog, 'Неизвестная добыча: пустой itemId.');
          return;
        }
        const baseMin = Math.max(1, Math.floor(payload.minQuantity ?? 1));
        const baseMax = Math.max(baseMin, Math.floor(payload.maxQuantity ?? baseMin));
        const baseQuantity = baseMin + Math.floor(rng() * (baseMax - baseMin + 1));
        const quantityFlat = sumMiningEffect(effects, 'mine_loot_quantity_modifier', { ...baseContext, blockType: block.hiddenType, lootRarity: payload.rarity }, 'flat')
          + sumMiningEffect(effects, 'mine_block_type_yield_modifier', { ...baseContext, blockType: block.hiddenType, lootRarity: payload.rarity }, 'flat');
        const quantityPercent = percentMiningEffect(effects, 'mine_loot_quantity_modifier', { ...baseContext, blockType: block.hiddenType, lootRarity: payload.rarity })
          + percentMiningEffect(effects, 'mine_block_type_yield_modifier', { ...baseContext, blockType: block.hiddenType, lootRarity: payload.rarity });
        loot = [buildLoot(itemId, Math.max(1, Math.floor((baseQuantity + quantityFlat) * (1 + quantityPercent / 100))))];
        if (payload.type === 'rune_trace') {
          run.skillEffectLog = pushSkillEffectLog(run.skillEffectLog, 'Следы древних: найден рунный след.');
        }
      }
    }

    if (loot.length === 0) {
      const lootTable = findMineLootTableById(block.hiddenLootTableId ?? depth.lootTableId);
      loot = lootTable ? rollLoot(lootTable.entries, depth.depthLevel, effects, { ...baseContext, blockType: block.hiddenType }, rng) : [];
    }

    loot = maybeApplyFragileLootDamage({ loot, blockType: block.hiddenType, effects, run, rng });
    maybeAddSpecialProperty({ loot, blockType: block.hiddenType, effects, run, rng });
    if (loot.length > 0 && payload?.type !== 'rune_trace') {
      loot = mergeLootStacks(loot, maybeAddDynamicRuneTrace(run, block.hiddenType, effects, rng));
    }

    block.loot = loot;
    block.visibleType = loot.length > 0 ? 'loot' : block.hiddenType;
    run.temporaryLoot = mergeLootStacks(run.temporaryLoot, loot);
    run.collectedLoot = mergeLootStacks(run.collectedLoot ?? [], loot);
    run.earnedXp += computeLootXp(loot);
    run.eventLog = pushLog(
      run.eventLog,
      loot.length > 0
        ? `Вы добыли: ${loot.map((entry) => `${entry.itemId} x${entry.quantity}`).join(', ')}.`
        : 'Порода раскололась, но ничего ценного внутри не оказалось.',
    );
    return;
  }

  if (block.hiddenType === 'event') {
    const payload = pickBlockPayload(block.hiddenPayloads, block.hiddenType, depth.depthLevel, effects, baseContext, rng);
    const eventId = payload?.type === 'event_ref' ? (payload.eventId ?? 'hidden_cache') : 'hidden_cache';
    const loot = resolveMineEvent(run, eventId, effects, rng);
    block.loot = loot;
    block.visibleType = loot.length > 0 ? 'loot' : block.hiddenType;
    run.temporaryLoot = mergeLootStacks(run.temporaryLoot, loot);
    run.collectedLoot = mergeLootStacks(run.collectedLoot ?? [], loot);
    run.earnedXp += computeLootXp(loot);
    return;
  }

  if (block.hiddenType === 'passage') {
    run.foundPassage = true;
    run.earnedXp += 10;
    run.eventLog = pushLog(run.eventLog, 'Вы нашли проход на следующую глубину.');
    return;
  }

  if (block.hiddenType === 'exit') {
    run.eventLog = pushLog(run.eventLog, 'Старый выход помечен как неактуальный блок. Используйте кнопку выхода.');
    return;
  }

  if (block.hiddenType === 'hazard') {
    const payload = pickBlockPayload(block.hiddenPayloads, block.hiddenType, depth.depthLevel, effects, baseContext, rng);
    const hazardFromPayload = payload?.type === 'hazard_ref' && payload.hazardId
      ? findMineHazardById(payload.hazardId)
      : null;
    if (payload?.type === 'hazard_ref' && payload.hazardId && !hazardFromPayload) {
      run.eventLog = pushLog(run.eventLog, `Неизвестная опасность: ${payload.hazardId}`);
      return;
    }
    const hazard = hazardFromPayload ?? rollHazard(block.hiddenHazardTableId ?? depth.hazardTableId, depth.depthLevel, rng);
    if (!hazard) {
      run.eventLog = pushLog(run.eventLog, 'Вы потревожили пустую трещину.');
      return;
    }
    block.hazardId = hazard.id;
    applyHazardToRun(run, hazard, effects, baseContext, rng, hazardMultiplier);
    return;
  }

  run.eventLog = pushLog(run.eventLog, `${block.label ?? 'Событие'} пока не дало результата.`);
}

function applyAreaReveal(
  run: InternalMineRunState,
  depth: MineDepth,
  centerIndex: number,
  effects: ActiveMiningEffect[],
  rng: () => number,
): void {
  const context = getEffectContextForRun(run);
  const revealEffects = getMatchingEffects(effects, 'mine_reveal_adjacent_blocks', context);
  for (const effect of revealEffects) {
    if (!canUseLimitedEffect(effect, run, run.currentDepthLevel)) {
      continue;
    }
    if (rng() > (effect.chance ?? 1)) {
      continue;
    }
    const radius = Math.max(1, Number(effect.params?.radius ?? 1));
    const indexes = getAdjacentIndexes(depth, centerIndex, radius, Boolean(effect.params?.includeDiagonals));
    for (const index of indexes) {
      const block = run.blocks[index];
      if (block && block.state === 'closed') {
        block.label = block.hiddenLabel;
      }
    }
    markEffectUsed(effect, run, run.currentDepthLevel);
  }
}

function applyAreaBreak(
  run: InternalMineRunState,
  centerIndex: number,
  effects: ActiveMiningEffect[],
  rng: () => number,
): void {
  const depth = findDepthById(run.currentDepthId);
  if (!depth) {
    return;
  }
  const context = getEffectContextForRun(run);
  const candidates = effects.filter((effect) => matchesCondition(effect, context) && (effect.type === 'mine_area_break' || effect.type === 'mine_area_break_chance'));
  for (const effect of candidates) {
    if (!canUseLimitedEffect(effect, run, run.currentDepthLevel)) {
      continue;
    }
    const triggerMode = String(effect.params?.triggerMode ?? 'on_hit');
    if (triggerMode === 'manual') {
      continue;
    }
    const chance = effect.type === 'mine_area_break_chance' ? (effect.chance ?? 1) : 1;
    if (rng() > chance) {
      continue;
    }
    const radius = Math.max(1, Number(effect.params?.radius ?? 1));
    const maxExtraBlocks = Math.max(1, Number(effect.params?.maxExtraBlocks ?? 1));
    const includeDiagonals = Boolean(effect.params?.includeDiagonals);
    const hazardMultiplier = Number(effect.params?.hazardMultiplier ?? 0.5);
    const indexes = getAdjacentIndexes(depth, centerIndex, radius, includeDiagonals)
      .filter((index) => run.blocks[index]?.state === 'closed')
      .slice(0, maxExtraBlocks);
    if (indexes.length === 0) {
      continue;
    }
    markEffectUsed(effect, run, run.currentDepthLevel);
    run.eventLog = pushLog(run.eventLog, `${effect.skillName}: ÑÐ¾ÑÐµÐ´Ð½Ð¸Ðµ Ð±Ð»Ð¾ÐºÐ¸ Ñ‚Ñ€ÐµÑÐ½ÑƒÐ»Ð¸ Ð¾Ñ‚ ÑƒÐ´Ð°Ñ€Ð°.`);
    indexes.forEach((index) => resolveBlockOpen(run, index, effects, rng, { hazardMultiplier }));
  }
}

function applyFreeAdjacentBreaks(
  run: InternalMineRunState,
  centerIndex: number,
  effects: ActiveMiningEffect[],
  rng: () => number,
): void {
  const depth = findDepthById(run.currentDepthId);
  if (!depth) {
    return;
  }
  const context = getEffectContextForRun(run);
  const candidates = getMatchingEffects(effects, 'mine_free_adjacent_breaks', context);
  for (const effect of candidates) {
    if (!canUseLimitedEffect(effect, run, run.currentDepthLevel)) {
      continue;
    }
    const count = Math.max(1, Math.floor(Number(effect.value ?? 1)));
    const indexes = getAdjacentIndexes(depth, centerIndex, 1, false)
      .filter((index) => run.blocks[index]?.state === 'closed')
      .slice(0, count);
    if (indexes.length === 0) {
      continue;
    }
    markEffectUsed(effect, run, run.currentDepthLevel);
    indexes.forEach((index) => resolveBlockOpen(run, index, effects, rng, { hazardMultiplier: 0.5 }));
  }
}

function applyFailureState(
  run: InternalMineRunState,
  effects: ActiveMiningEffect[],
  rng: () => number,
): InternalMineRunState {
  const context = getEffectContextForRun(run);
  if (run.hp <= 0) {
    const surviveEffect = getMatchingEffects(effects, 'mine_once_per_run_survive_1hp', context)
      .find((effect) => canUseLimitedEffect(effect, run, run.currentDepthLevel));
    if (surviveEffect) {
      markEffectUsed(surviveEffect, run, run.currentDepthLevel);
      run.hp = 1;
      run.eventLog = pushLog(run.eventLog, `${surviveEffect.skillName}: Ð²Ñ‹ ÑƒÐ´ÐµÑ€Ð¶Ð°Ð»Ð¸ÑÑŒ Ð½Ð° Ð³Ñ€Ð°Ð½Ð¸ ÑÐ¼ÐµÑ€Ñ‚Ð¸.`);
      return run;
    }

    const escapeEffect = getMatchingEffects(effects, 'mine_once_per_run_escape', context)
      .find((effect) => canUseLimitedEffect(effect, run, run.currentDepthLevel));
    if (escapeEffect) {
      markEffectUsed(escapeEffect, run, run.currentDepthLevel);
      return emergencyEscapeMineRun(run, effects, rng, true);
    }
    return buildFailureRecovery(run, effects, rng, 'dead');
  }

  if (run.remainingHits <= 0 && !run.foundExit) {
    return buildFailureRecovery(run, effects, rng, 'failed');
  }
  return run;
}

function computeStaminaCost(depth: MineDepth, effects: ActiveMiningEffect[], context: MiningEffectContext): number {
  const flat = sumMiningEffect(effects, 'mine_stamina_cost_modifier', context, 'flat');
  const percent = percentMiningEffect(effects, 'mine_stamina_cost_modifier', context);
  return Math.max(1, Math.ceil((depth.staminaCostPerHit + flat) * (1 + percent / 100)));
}

function computeRiskIncrease(depth: MineDepth, effects: ActiveMiningEffect[], context: MiningEffectContext): number {
  const flat = sumMiningEffect(effects, 'mine_reduce_risk_increase_per_hit', context, 'flat');
  const percent = percentMiningEffect(effects, 'mine_reduce_risk_increase_per_hit', context);
  return Math.max(0, (depth.riskIncreasePerHit + flat) * (1 + percent / 100));
}

function maybeTriggerCollapse(run: InternalMineRunState, effects: ActiveMiningEffect[], rng: () => number): InternalMineRunState {
  const depth = findDepthById(run.currentDepthId);
  if (!depth || run.status !== 'active') {
    return run;
  }
  const context = getEffectContextForRun(run);
  const collapsePercent = percentMiningEffect(effects, 'mine_collapse_chance_modifier', context);
  const collapseFlat = sumMiningEffect(effects, 'mine_collapse_chance_modifier', context, 'flat');
  const risk = clamp(run.collapseRisk * (1 + collapsePercent / 100) + collapseFlat, 0, 0.95);
  if (rng() > risk) {
    return run;
  }
  const hazard = rollHazard(depth.hazardTableId, depth.depthLevel, rng, true) ?? rollHazard(depth.hazardTableId, depth.depthLevel, rng, false);
  if (!hazard) {
    return run;
  }
  const collapseBlock: InternalMineBlockState = {
    index: -1,
    state: 'opened',
    hiddenType: 'hazard',
    visibleType: 'hazard',
    hiddenLabel: hazard.name,
    label: hazard.name,
    hazardId: hazard.id,
  };
  run.blocks = [...run.blocks, collapseBlock];
  run.eventLog = pushLog(run.eventLog, `ÐžÐ±Ð²Ð°Ð»: ${hazard.name}.`);
  const hazardContext: MiningEffectContext = { ...context, hazardType: hazard.type };
  if (rollMiningEffect(effects, 'mine_ignore_first_hazard', hazardContext, rng, run)) {
    run.eventLog = pushLog(run.eventLog, 'ÐÐ°Ð²Ñ‹Ðº ÑÐ¼ÑÐ³Ñ‡Ð¸Ð» Ð¿ÐµÑ€Ð²Ñ‹Ð¹ Ð¾Ð±Ð²Ð°Ð».');
    return run;
  }
  const resistance = getHazardResistance(effects, hazardContext);
  const hpDamageBase = hazard.hpDamageMin + Math.floor(rng() * (Math.max(hazard.hpDamageMin, hazard.hpDamageMax) - hazard.hpDamageMin + 1));
  const staminaDamageBase = hazard.staminaDamageMin + Math.floor(rng() * (Math.max(hazard.staminaDamageMin, hazard.staminaDamageMax) - hazard.staminaDamageMin + 1));
  run.hp = Math.max(0, run.hp - applyResistanceDamage(hpDamageBase, resistance.flat, resistance.percent, 1));
  run.stamina = Math.max(0, run.stamina - applyResistanceDamage(staminaDamageBase, resistance.flat, resistance.percent, 1));
  return run;
}

function createBaseRun(
  depth: MineDepth,
  mineId: string,
  hp: number,
  stamina: number,
  effects: ActiveMiningEffect[],
  rng: () => number,
): InternalMineRunState {
  const mine = findMineById(mineId);
  const context: MiningEffectContext = {
    mineId,
    depthLevel: depth.depthLevel,
    mineTheme: mine?.visualTheme,
    mineDangerLevel: mine?.dangerLevel,
  };
  const extraStamina = sumMiningEffect(effects, 'mine_extra_stamina', context, 'flat');
  const extraHits = sumMiningEffect(effects, 'mine_extra_hits', context, 'flat');
  const run: InternalMineRunState = {
    runId: createRunId(),
    mineId,
    currentDepthId: depth.id,
    currentDepthLevel: depth.depthLevel,
    status: 'active',
    hp,
    maxHp: hp,
    stamina: Math.max(1, Math.floor(stamina + extraStamina)),
    maxStamina: Math.max(1, Math.floor(stamina + extraStamina)),
    remainingHits: Math.max(1, depth.baseHits + Math.floor(extraHits)),
    collapseRisk: clamp(depth.baseCollapseRisk, 0, 0.95),
    temporaryLoot: [],
    temporaryGold: 0,
    blocks: generateBlocks(depth, effects, rng),
    foundExit: false,
    foundPassage: false,
    eventLog: [depth.description ? `${depth.name}: ${depth.description}` : `Ð’Ñ‹ Ð²Ð¾ÑˆÐ»Ð¸ Ð² Ð³Ð»ÑƒÐ±Ð¸Ð½Ñƒ: ${depth.name}.`],
    startedAt: new Date().toISOString(),
    earnedXp: 0,
    usedEmergencyEscape: false,
    collectedLoot: [],
    awardedLoot: [],
    awardedGold: 0,
    lostLoot: [],
    savedBySkills: [],
    savedByPorters: [],
    specialFinds: [],
    skillEffectLog: [],
    bonusGoldFromSellValue: 0,
    usedEffects: {},
    porters: calculatePorters(effects, context),
  };
  applyStartHints(run, effects, rng);
  return run;
}

export interface StartMineRunOptions {
  mineId: string;
  playerHp: number;
  playerStamina: number;
  effects?: ActiveMiningEffect[];
  rng?: () => number;
}

export function startMineRun(options: StartMineRunOptions): InternalMineRunState {
  const mine = findMineById(options.mineId);
  if (!mine) {
    throw new Error(`Ð¨Ð°Ñ…Ñ‚Ð° Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð°: ${options.mineId}`);
  }
  const firstDepth = findMineDepthsByMineId(mine.id)[0];
  if (!firstDepth) {
    throw new Error(`Ð”Ð»Ñ ÑˆÐ°Ñ…Ñ‚Ñ‹ ${mine.id} Ð½Ðµ Ð½Ð°Ð¹Ð´ÐµÐ½Ð° Ð½Ð¸ Ð¾Ð´Ð½Ð° Ð³Ð»ÑƒÐ±Ð¸Ð½Ð°.`);
  }
  const rng = options.rng ?? Math.random;
  return createBaseRun(
    firstDepth,
    mine.id,
    Math.max(1, Math.floor(options.playerHp)),
    Math.max(1, Math.floor(options.playerStamina)),
    options.effects ?? [],
    rng,
  );
}

export interface HitMineBlockResult {
  run: InternalMineRunState;
  changed: boolean;
}

export function hitMineBlock(
  run: InternalMineRunState,
  blockIndex: number,
  effects: ActiveMiningEffect[],
  rng: () => number = Math.random,
): HitMineBlockResult {
  if (run.status !== 'active') {
    return { run, changed: false };
  }
  const depth = findDepthById(run.currentDepthId);
  if (!depth) {
    return {
      run: buildFailureRecovery({
        ...run,
        eventLog: pushLog(run.eventLog, 'Ð¢ÐµÐºÑƒÑ‰Ð°Ñ Ð³Ð»ÑƒÐ±Ð¸Ð½Ð° Ð±Ð¾Ð»ÑŒÑˆÐµ Ð½Ðµ ÑÑƒÑ‰ÐµÑÑ‚Ð²ÑƒÐµÑ‚.'),
      }, effects, rng, 'failed'),
      changed: true,
    };
  }
  const block = run.blocks[blockIndex];
  if (!block || block.state === 'opened') {
    return { run, changed: false };
  }

  const nextRun = clone(run);
  const context = getEffectContextForRun(nextRun);
  context.remainingHits = nextRun.remainingHits;
  const staminaCost = computeStaminaCost(depth, effects, context);
  if (nextRun.remainingHits <= 0 || nextRun.stamina < staminaCost) {
    return { run, changed: false };
  }

  nextRun.remainingHits = Math.max(0, nextRun.remainingHits - 1);
  nextRun.stamina = Math.max(0, nextRun.stamina - staminaCost);

  resolveBlockOpen(nextRun, blockIndex, effects, rng);
  applyAreaReveal(nextRun, depth, blockIndex, effects, rng);
  applyAreaBreak(nextRun, blockIndex, effects, rng);
  applyFreeAdjacentBreaks(nextRun, blockIndex, effects, rng);

  const riskIncrease = computeRiskIncrease(depth, effects, context);
  nextRun.collapseRisk = clamp(nextRun.collapseRisk + riskIncrease, 0, 0.95);
  const withCollapse = maybeTriggerCollapse(nextRun, effects, rng);
  const resolvedRun = applyFailureState(withCollapse, effects, rng);

  if (rollMiningEffect(effects, 'mine_refund_hit_chance', context, rng, resolvedRun)) {
    resolvedRun.remainingHits += 1;
    resolvedRun.eventLog = pushLog(resolvedRun.eventLog, 'ÐÐ°Ð²Ñ‹Ðº Ð²ÐµÑ€Ð½ÑƒÐ» Ð¾Ð´Ð¸Ð½ ÑƒÐ´Ð°Ñ€.');
  }
  if (rollMiningEffect(effects, 'mine_refund_stamina_chance', context, rng, resolvedRun)) {
    resolvedRun.stamina = Math.min(resolvedRun.maxStamina, resolvedRun.stamina + staminaCost);
    resolvedRun.eventLog = pushLog(resolvedRun.eventLog, 'ÐÐ°Ð²Ñ‹Ðº Ð²ÐµÑ€Ð½ÑƒÐ» Ð¿Ð¾Ñ‚Ñ€Ð°Ñ‡ÐµÐ½Ð½ÑƒÑŽ stamina.');
  }

  return { run: resolvedRun, changed: true };
}

export function descendMineRun(
  run: InternalMineRunState,
  effects: ActiveMiningEffect[],
  rng: () => number = Math.random,
): InternalMineRunState {
  if (run.status !== 'active' || !run.foundPassage) {
    return run;
  }
  const mineDepths = findMineDepthsByMineId(run.mineId);
  const currentIndex = mineDepths.findIndex((entry) => entry.id === run.currentDepthId);
  const nextDepth = currentIndex >= 0 ? mineDepths[currentIndex + 1] ?? null : null;
  if (!nextDepth) {
    return {
      ...run,
      eventLog: pushLog(run.eventLog, 'ÐÐ¸Ð¶Ðµ Ð¸Ð´Ñ‚Ð¸ ÑƒÐ¶Ðµ Ð½ÐµÐºÑƒÐ´Ð°.'),
    };
  }

  const nextRun: InternalMineRunState = {
    ...run,
    currentDepthId: nextDepth.id,
    currentDepthLevel: nextDepth.depthLevel,
    remainingHits: Math.max(
      run.remainingHits,
      nextDepth.baseHits
        + Math.floor(sumMiningEffect(effects, 'mine_extra_hits', { ...getEffectContextForRun(run), depthLevel: nextDepth.depthLevel }, 'flat'))
        + Math.floor(sumMiningEffect(effects, 'mine_extra_hits_on_descend', { ...getEffectContextForRun(run), depthLevel: nextDepth.depthLevel }, 'flat')),
    ),
    blocks: generateBlocks(nextDepth, effects, rng),
    foundExit: false,
    foundPassage: false,
    earnedXp: run.earnedXp + 15,
    eventLog: pushLog(run.eventLog, `Ð’Ñ‹ ÑÐ¿ÑƒÑÐºÐ°ÐµÑ‚ÐµÑÑŒ Ð³Ð»ÑƒÐ±Ð¶Ðµ: ${nextDepth.name}.`),
  };
  applyStartHints(nextRun, effects, rng);
  return nextRun;
}

export function retreatMineRun(
  run: InternalMineRunState,
  effects: ActiveMiningEffect[] = [],
  _rng: () => number = Math.random,
): InternalMineRunState {
  if (run.status !== 'active') {
    return run;
  }
  return applyRetreatRecovery(run, effects);
}

export function escapeMineRun(run: InternalMineRunState, effects: ActiveMiningEffect[] = []): InternalMineRunState {
  if (run.status !== 'active') {
    return run;
  }
  const escapeBonus = run.currentDepthLevel === 1 ? 10 : run.currentDepthLevel === 2 ? 20 : 30;
  return applyEscapeResult({
    ...run,
    earnedXp: run.earnedXp + escapeBonus,
  }, effects);
}

export function emergencyEscapeMineRun(
  run: InternalMineRunState,
  effects: ActiveMiningEffect[] = [],
  rng: () => number = Math.random,
  autoTriggered = false,
): InternalMineRunState {
  if (run.status !== 'active') {
    return run;
  }
  const nextRun = applyEscapeResult({
    ...run,
    foundExit: true,
    usedEmergencyEscape: true,
    temporaryLoot: applyKeepRatio(run.temporaryLoot, 0.5),
    temporaryGold: Math.max(0, Math.floor((run.temporaryGold ?? 0) * 0.5)),
  }, effects);
  nextRun.eventLog = pushLog(
    nextRun.eventLog,
    autoTriggered
      ? 'ÐÐ°Ð²Ñ‹Ðº Ð°Ð²Ð°Ñ€Ð¸Ð¹Ð½Ð¾Ð³Ð¾ Ð¿Ð¾Ð±ÐµÐ³Ð° Ð²Ñ‹Ð²ÐµÐ» Ð²Ð°Ñ Ð¸Ð· ÑˆÐ°Ñ…Ñ‚Ñ‹ Ð² Ð¿Ð¾ÑÐ»ÐµÐ´Ð½Ð¸Ð¹ Ð¼Ð¾Ð¼ÐµÐ½Ñ‚.'
      : 'Ð’Ñ‹ Ð²Ð¾ÑÐ¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ð»Ð¸ÑÑŒ Ð°Ð²Ð°Ñ€Ð¸Ð¹Ð½Ñ‹Ð¼ Ð²Ñ‹Ñ…Ð¾Ð´Ð¾Ð¼ Ð¸ Ð±Ñ€Ð¾ÑÐ¸Ð»Ð¸ Ñ‡Ð°ÑÑ‚ÑŒ Ð´Ð¾Ð±Ñ‹Ñ‡Ð¸.',
  );
  return nextRun;
}

export function closeMineRun(
  run: InternalMineRunState,
  effects: ActiveMiningEffect[] = [],
  rng: () => number = Math.random,
): InternalMineRunState {
  if (run.status !== 'active') {
    return run;
  }
  return retreatMineRun(run, effects, rng);
}

export function forceMineRunOutcome(
  run: InternalMineRunState,
  outcome: 'escaped' | 'retreated' | 'failed' | 'dead',
  effects: ActiveMiningEffect[] = [],
  rng: () => number = Math.random,
): InternalMineRunState {
  if (run.status !== 'active') {
    return run;
  }

  if (outcome === 'escaped') {
    return escapeMineRun(run, effects);
  }

  if (outcome === 'retreated') {
    return retreatMineRun(run, effects, rng);
  }

  return buildFailureRecovery(run, effects, rng, outcome);
}

export function getMineRunAwardXp(run: InternalMineRunState): number {
  return run.status === 'active' ? 0 : Math.max(0, Math.floor(run.earnedXp));
}

export function resolveMiningSkillEffects(profession: PlayerProfessionState | null): ActiveMiningEffect[] {
  if (!profession) {
    return [];
  }
  return getActiveMiningEffects(profession, loadProfessionSkillsFromStorage());
}

export function toPublicMineRun(run: InternalMineRunState): MineRunState {
  return toFrontendRun(run);
}

const MINING_PLACEHOLDER_ITEMS = [
  {
    id: 'item_raw_stone',
    name: 'ÐÐµÐ¾Ð±Ñ€Ð°Ð±Ð¾Ñ‚Ð°Ð½Ð½Ñ‹Ð¹ ÐºÐ°Ð¼ÐµÐ½ÑŒ',
    gameplayDescription: 'ÐšÑƒÑÐ¾Ðº Ð¾Ð±Ñ‹Ñ‡Ð½Ð¾Ð¹ Ð¿Ð¾Ñ€Ð¾Ð´Ñ‹ Ð¸Ð· ÑˆÐ°Ñ…Ñ‚Ñ‹.',
    loreDescription: 'Ð“Ñ€ÑƒÐ±Ñ‹Ð¹ ÐºÐ°Ð¼ÐµÐ½ÑŒ, ÐºÐ¾Ñ‚Ð¾Ñ€Ñ‹Ð¹ ÑˆÐ°Ñ…Ñ‚Ñ‘Ñ€Ñ‹ Ð²Ñ‹Ð½Ð¾ÑÑÑ‚ Ð¼ÐµÑˆÐºÐ°Ð¼Ð¸.',
  },
  {
    id: 'item_iron_ore',
    name: 'Ð–ÐµÐ»ÐµÐ·Ð½Ð°Ñ Ñ€ÑƒÐ´Ð°',
    gameplayDescription: 'Ð–Ð¸Ð»Ð° Ð¶ÐµÐ»ÐµÐ·Ð°, Ð¿Ñ€Ð¸Ð³Ð¾Ð´Ð½Ð°Ñ Ð´Ð»Ñ Ð²Ñ‹Ð¿Ð»Ð°Ð²ÐºÐ¸.',
    loreDescription: 'ÐžÐ±Ñ‹Ñ‡Ð½Ð°Ñ Ð¶ÐµÐ»ÐµÐ·Ð½Ð°Ñ Ñ€ÑƒÐ´Ð° Ñ Ð³Ð»ÑƒÐ±Ð¸Ð½ Ð¢ÐµÑ€Ð°Ð¼Ð¾Ñ€Ð°.',
  },
  {
    id: 'item_small_gold_nugget',
    name: 'ÐœÐ°Ð»ÐµÐ½ÑŒÐºÐ¸Ð¹ Ð·Ð¾Ð»Ð¾Ñ‚Ð¾Ð¹ ÑÐ°Ð¼Ð¾Ñ€Ð¾Ð´Ð¾Ðº',
    gameplayDescription: 'ÐÐµÐ±Ð¾Ð»ÑŒÑˆÐ¾Ð¹, Ð½Ð¾ Ñ†ÐµÐ½Ð½Ñ‹Ð¹ ÐºÑƒÑÐ¾Ðº Ð·Ð¾Ð»Ð¾Ñ‚Ð°.',
    loreDescription: 'Ð ÐµÐ´ÐºÐ°Ñ Ð½Ð°Ñ…Ð¾Ð´ÐºÐ°, Ð·Ð° ÐºÐ¾Ñ‚Ð¾Ñ€ÑƒÑŽ Ñ‚Ð¾Ñ€Ð³Ð¾Ð²Ñ†Ñ‹ Ð¾Ñ…Ð¾Ñ‚Ð½Ð¾ Ð¿Ð»Ð°Ñ‚ÑÑ‚.',
  },
  {
    id: 'item_cracked_crystal',
    name: 'Ð¢Ñ€ÐµÑÐ½ÑƒÐ²ÑˆÐ¸Ð¹ ÐºÑ€Ð¸ÑÑ‚Ð°Ð»Ð»',
    gameplayDescription: 'Ð¥Ñ€ÑƒÐ¿ÐºÐ¸Ð¹ ÐºÑ€Ð¸ÑÑ‚Ð°Ð»Ð» Ñ Ð¾ÑÑ‚Ð°Ñ‚Ð¾Ñ‡Ð½Ð¾Ð¹ Ñ†ÐµÐ½Ð½Ð¾ÑÑ‚ÑŒÑŽ.',
    loreDescription: 'ÐÐµÐ¸Ð´ÐµÐ°Ð»ÑŒÐ½Ñ‹Ð¹, Ð½Ð¾ Ð²ÑÑ‘ ÐµÑ‰Ñ‘ ÐºÑ€Ð°ÑÐ¸Ð²Ñ‹Ð¹ ÑˆÐ°Ñ…Ñ‚Ð½Ñ‹Ð¹ ÐºÑ€Ð¸ÑÑ‚Ð°Ð»Ð».',
  },
  {
    id: 'item_zeptyrite_trace',
    name: 'Ð—ÐµÐ¿Ñ‚Ð¸Ñ€Ð¸Ñ‚Ð¾Ð²Ñ‹Ð¹ ÑÐ»ÐµÐ´',
    gameplayDescription: 'Ð ÐµÐ´ÐºÐ¸Ð¹ ÑÐ»ÐµÐ´ Ð·Ð°Ð³Ð°Ð´Ð¾Ñ‡Ð½Ð¾Ð³Ð¾ Ð¼Ð¸Ð½ÐµÑ€Ð°Ð»Ð°.',
    loreDescription: 'Ð¡Ð»Ð°Ð±Ñ‹Ð¹ Ð·ÐµÐ¿Ñ‚Ð¸Ñ€Ð¸Ñ‚Ð¾Ð²Ñ‹Ð¹ ÑÐ»ÐµÐ´, Ð¿Ð¾ ÐºÐ¾Ñ‚Ð¾Ñ€Ð¾Ð¼Ñƒ Ð¾Ñ…Ð¾Ñ‚ÑÑ‚ÑÑ Ð¼Ð°ÑÑ‚ÐµÑ€Ð° Ð¸ Ð°Ð»Ñ…Ð¸Ð¼Ð¸ÐºÐ¸.',
  },
  {
    id: 'item_rune_fragment_weak',
    name: 'Слабый рунный осколок',
    gameplayDescription: 'Осколок древней руны, найденный в глубокой породе.',
    loreDescription: 'Хрупкий рунный фрагмент, ещё хранящий эхо старой силы.',
  },
  {
    id: 'item_rune_dust',
    name: 'Рунная пыль',
    gameplayDescription: 'Мелкая рунная пыль, осевшая в трещинах камня.',
    loreDescription: 'Остаток древних знаков, стёртых временем и обвалами.',
  },
];

let miningItemsEnsured = false;

export async function ensureMiningPlaceholderItems(): Promise<void> {
  if (miningItemsEnsured) {
    return;
  }

  try {
    for (const entry of MINING_PLACEHOLDER_ITEMS) {
      const existing = await itemsService.getById(entry.id);
      if (existing) {
        continue;
      }
      await itemsService.create({
        id: entry.id,
        name: fixMojibake(entry.name),
        type: 'material',
        subtype: 'mining',
        slot: 'none',
        handsRequired: 1,
        rarity: entry.id === 'item_zeptyrite_trace' || entry.id === 'item_rune_fragment_weak' ? 'rare' : 'common',
        price: entry.id === 'item_small_gold_nugget'
          ? 25
          : entry.id === 'item_zeptyrite_trace'
            ? 40
            : entry.id === 'item_rune_fragment_weak'
              ? 35
              : entry.id === 'item_rune_dust'
                ? 12
                : 5,
        stackable: true,
        maxStack: 99,
        requiredStats: {},
        bonuses: {},
        gameplayDescription: fixMojibake(entry.gameplayDescription),
        loreDescription: fixMojibake(entry.loreDescription),
        imagePath: '',
        isEnabled: true,
      });
    }
    miningItemsEnsured = true;
  } catch {
    // Mining still works with raw ids if content API is unavailable.
  }
}

