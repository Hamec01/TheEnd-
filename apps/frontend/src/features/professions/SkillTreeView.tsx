import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MouseEventHandler, ReactNode } from 'react';
import type { PlayerProfessionState } from '@theend/rpg-domain';
import { getBlockedBySelectedExclusiveBranchReason } from '../../services/miningSkillValidation';
import {
  canUnlockFinalBlacksmithTrial,
  countSelectedBranchesInExclusiveGroup,
  getBlockedByExclusiveSkillGroupReason,
  getExclusiveGroupMax,
} from '../../services/professionSkillTreeUtils';
import {
  getImageSheet,
  getTilesetFrameRect,
  normalizeGameImageRef,
  resolveGameImageRefSource,
} from '../../services/content/gameImageRefs';
import type { StoredImage } from '../../services/content/models';
import type { ProfessionBranch, ProfessionSkill } from '../../types/profession';
import { SkillTreeDetailsPanel, type SelectedTreeNode } from './SkillTreeDetailsPanel';
import {
  MINING_BRANCH_NODE_HEIGHT,
  MINING_BRANCH_NODE_WIDTH,
  MINING_SKILL_NODE_HEIGHT,
  MINING_SKILL_NODE_WIDTH,
  DEFAULT_BRANCH_NODE_HEIGHT,
  DEFAULT_BRANCH_NODE_WIDTH,
  DEFAULT_SKILL_NODE_HEIGHT,
  DEFAULT_SKILL_NODE_WIDTH,
  SkillTreeNode,
  type SkillTreeNodeVisualState,
} from './SkillTreeNode';

interface SkillTreeViewProps {
  professionId: string;
  professionName: string;
  skills: ProfessionSkill[];
  branches: ProfessionBranch[];
  playerProfessionState: PlayerProfessionState;
  onLearnSkill: (skillId: string) => void;
  onChooseBranch: (branchId: string) => void;
  onReset?: () => void;
  onBack?: () => void;
  resolveIcon?: (icon?: string) => string | undefined;
  runtimeImages?: StoredImage[];
  legacyFallback?: ReactNode;
  isDev?: boolean;
}

type TreeNodeType = 'skill' | 'branch';

interface NodePosition {
  x: number;
  y: number;
  kind: 'skill' | 'branch';
}

interface MiningConnection {
  from: string;
  to: string;
}

interface ComputedSkillState {
  visualState: SkillTreeNodeVisualState;
  missingRequirements: string[];
  blockedReason?: string;
  canLearn: boolean;
}

interface ComputedBranchState {
  visualState: SkillTreeNodeVisualState;
  missingRequirements: string[];
  blockedReason?: string;
  canChoose: boolean;
}

function darkBackgroundForProfession(professionId: string): string {
  if (professionId === 'mining') {
    return 'radial-gradient(circle at 14% 18%, rgba(125, 74, 19, 0.26), transparent 44%), radial-gradient(circle at 82% 12%, rgba(35, 92, 122, 0.24), transparent 42%), linear-gradient(180deg, rgba(11, 9, 8, 0.95), rgba(7, 6, 6, 0.96))';
  }
  if (professionId === 'carpenter') {
    return 'radial-gradient(circle at 18% 24%, rgba(92, 60, 36, 0.26), transparent 42%), linear-gradient(180deg, rgba(14, 11, 9, 0.95), rgba(8, 6, 5, 0.98))';
  }
  return 'radial-gradient(circle at 18% 24%, rgba(70, 50, 34, 0.28), transparent 42%), linear-gradient(180deg, rgba(18, 14, 11, 0.9), rgba(10, 8, 7, 0.95))';
}

const MINING_STAGE_WIDTH = 1220;
const MINING_STAGE_HEIGHT = 820;
const BLACKSMITH_STAGE_WIDTH = 920;
const BLACKSMITH_STAGE_HEIGHT = 1800;
const BLACKSMITH_SLOT_OFFSET_X = 0;
const BLACKSMITH_SLOT_OFFSET_Y = 0;
const BLACKSMITH_SKILL_NODE_SIZE = 72;
const BLACKSMITH_BRANCH_NODE_WIDTH = 220;
const BLACKSMITH_BRANCH_NODE_HEIGHT = 56;
const MINING_EXTRA_SKILLS_COLUMN_X = 18;
const MINING_EXTRA_SKILLS_COLUMN_START_Y = 24;
const MINING_EXTRA_SKILLS_ROW_GAP = 74;
const MINING_LEFT_COLUMN_SKILL_NAMES = new Set([
  'подрывник',
  'страховка добычи',
  'носильщик',
  'старший носильщик',
  'защита от духов',
]);
const MINING_CANONICAL_SKILL_ID_BY_NAME = new Map<string, string>([
  ['чутье прохода', 'mining_passage_sense'],
  ['каменная выдержка', 'mining_stone_endurance'],
]);

const BLACKSMITH_TREE_LAYOUT_BY_ID: Record<string, { x: number; y: number; kind?: 'skill' | 'branch' }> = {
  blacksmith_unlock_jewelcrafting: { x: 724, y: 56 },
  blacksmith_unlock_runecrafting: { x: 424, y: 56 },
  blacksmith_unlock_forge_engineering: { x: 124, y: 56 },

  final_blacksmith_trial: { x: 350, y: 176, kind: 'branch' },

  blacksmith_razor_steel: { x: 124, y: 320 },
  blacksmith_heavy_impact: { x: 124, y: 410 },
  blacksmith_personal_weapon_fit: { x: 124, y: 500 },
  blacksmith_clean_weapon_profile: { x: 124, y: 590 },
  blacksmith_second_weapon_socket: { x: 124, y: 680 },

  blacksmith_firm_armor_fit: { x: 424, y: 320 },
  blacksmith_dampening_layer: { x: 424, y: 410 },
  blacksmith_iron_stance: { x: 424, y: 500 },
  blacksmith_anti_stun_assembly: { x: 424, y: 590 },
  blacksmith_second_defense_socket: { x: 424, y: 680 },

  blacksmith_gem_settings: { x: 724, y: 320 },
  blacksmith_rune_marking: { x: 724, y: 410 },
  blacksmith_stable_mount: { x: 724, y: 500 },
  blacksmith_thin_metalwork: { x: 724, y: 590 },
  blacksmith_base_seal: { x: 724, y: 680 },

  blacksmith_weapon_master_path: { x: 50, y: 804, kind: 'branch' },
  blacksmith_armor_master_path: { x: 350, y: 804, kind: 'branch' },
  blacksmith_setting_master_path: { x: 650, y: 804, kind: 'branch' },

  blacksmith_weapon_blades: { x: 124, y: 956 },
  blacksmith_weapon_balance: { x: 124, y: 1046 },
  blacksmith_sharp_edge: { x: 124, y: 1136 },
  blacksmith_combat_grip: { x: 124, y: 1226 },
  blacksmith_weapon_socket: { x: 124, y: 1316 },

  blacksmith_armor_forging: { x: 424, y: 956 },
  blacksmith_reinforced_plates: { x: 424, y: 1046 },
  blacksmith_shield_brace: { x: 424, y: 1136 },
  blacksmith_armor_fitting: { x: 424, y: 1226 },
  blacksmith_armor_socket: { x: 424, y: 1316 },

  blacksmith_fine_work: { x: 724, y: 956 },
  blacksmith_metal_setting: { x: 724, y: 1046 },
  blacksmith_insert_mounting: { x: 724, y: 1136 },
  blacksmith_minor_rune_surface: { x: 724, y: 1226 },
  blacksmith_clean_setting: { x: 724, y: 1316 },

  blacksmith_weapon_path: { x: 50, y: 1460, kind: 'branch' },
  blacksmith_armor_path: { x: 350, y: 1460, kind: 'branch' },
  blacksmith_precision_path: { x: 650, y: 1460, kind: 'branch' },

  blacksmith_basic_forging: { x: 64, y: 1588 },
  blacksmith_metal_knowledge: { x: 244, y: 1588 },
  blacksmith_even_blank: { x: 424, y: 1588 },
  blacksmith_simple_tempering: { x: 604, y: 1588 },
  blacksmith_rough_socket: { x: 784, y: 1588 },

  blacksmith_start: { x: 350, y: 1708, kind: 'branch' },
};

function normalizeMiningSkillNameForMatch(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function shouldAutoActivateBranch(professionId: string, branch: ProfessionBranch): boolean {
  if (professionId === 'mining') {
    return branch.id === 'mining_branch_common' || branch.id === 'mining_branch_transition';
  }
  if (professionId === 'blacksmithing') {
    return branch.id === 'blacksmith_start';
  }
  return !branch.exclusiveGroupId;
}

const MINING_TREE_LAYOUT: Record<string, { x: number; y: number }> = {
  mining_firm_swing: { x: 452, y: 24 },
  mining_stone_hearing: { x: 522, y: 24 },
  mining_work_breathing: { x: 592, y: 24 },
  mining_careful_strike: { x: 662, y: 24 },
  mining_ore_habit: { x: 732, y: 24 },

  mining_support_beams: { x: 522, y: 102 },
  mining_safety_rope: { x: 592, y: 102 },
  mining_dark_eye: { x: 662, y: 102 },

  mining_branch_deep_delver: { x: 420, y: 180 },
  mining_branch_prospector: { x: 650, y: 180 },

  mining_heavy_helmet: { x: 324, y: 360 },
  mining_dust_lungs: { x: 394, y: 360 },
  mining_passage_sense: { x: 464, y: 360 },
  mining_do_not_look_back: { x: 534, y: 360 },
  mining_deep_breath: { x: 604, y: 360 },

  mining_glimmer_in_stone: { x: 650, y: 360 },
  mining_sharp_eye: { x: 720, y: 360 },
  mining_clean_vein: { x: 790, y: 360 },
  mining_rich_bag: { x: 860, y: 360 },
  mining_soft_strike: { x: 930, y: 360 },

  mining_anchor_rope: { x: 394, y: 434 },
  mining_vein_under_feet: { x: 464, y: 434 },
  mining_stone_endurance: { x: 534, y: 434 },

  mining_gold_scent: { x: 720, y: 434 },
  mining_stonecutter: { x: 790, y: 434 },
  mining_trader_eye: { x: 860, y: 434 },

  mining_branch_dwarf_tunneler: { x: 350, y: 510 },
  mining_branch_abyss_conqueror: { x: 520, y: 510 },
  mining_branch_gem_seeker: { x: 690, y: 510 },
  mining_branch_rune_seeker: { x: 860, y: 510 },

  mining_dwarf_sight: { x: 284, y: 690 },
  mining_crack_reading: { x: 354, y: 690 },
  mining_master_brace: { x: 424, y: 690 },
  mining_underground_map: { x: 494, y: 690 },
  mining_heart_of_depth: { x: 424, y: 752 },

  mining_lava_caution: { x: 564, y: 690 },
  mining_last_strike: { x: 634, y: 690 },
  mining_one_step_from_death: { x: 599, y: 752 },

  mining_blue_vein: { x: 704, y: 690 },
  mining_unbroken_crystal: { x: 774, y: 690 },
  mining_pure_crystal_heart: { x: 739, y: 752 },

  mining_stone_memory: { x: 844, y: 690 },
  mining_ancient_traces: { x: 914, y: 690 },
  mining_do_not_touch_the_sign: { x: 984, y: 690 },
  mining_stone_whisper: { x: 914, y: 752 },
  mining_language_of_cracks: { x: 984, y: 752 },
};

const MINING_VISUAL_CONNECTIONS: MiningConnection[] = [
  { from: 'mining_firm_swing', to: 'mining_support_beams' },
  { from: 'mining_work_breathing', to: 'mining_safety_rope' },
  { from: 'mining_ore_habit', to: 'mining_dark_eye' },
  { from: 'mining_support_beams', to: 'mining_branch_deep_delver' },
  { from: 'mining_dark_eye', to: 'mining_branch_prospector' },

  { from: 'mining_branch_deep_delver', to: 'mining_passage_sense' },
  { from: 'mining_branch_deep_delver', to: 'mining_deep_breath' },
  { from: 'mining_branch_prospector', to: 'mining_clean_vein' },
  { from: 'mining_branch_prospector', to: 'mining_soft_strike' },

  { from: 'mining_passage_sense', to: 'mining_vein_under_feet' },
  { from: 'mining_deep_breath', to: 'mining_stone_endurance' },
  { from: 'mining_clean_vein', to: 'mining_stonecutter' },
  { from: 'mining_soft_strike', to: 'mining_trader_eye' },

  { from: 'mining_stone_endurance', to: 'mining_branch_abyss_conqueror' },
  { from: 'mining_vein_under_feet', to: 'mining_branch_dwarf_tunneler' },
  { from: 'mining_stonecutter', to: 'mining_branch_gem_seeker' },
  { from: 'mining_trader_eye', to: 'mining_branch_rune_seeker' },

  { from: 'mining_branch_dwarf_tunneler', to: 'mining_master_brace' },
  { from: 'mining_branch_abyss_conqueror', to: 'mining_last_strike' },
  { from: 'mining_branch_gem_seeker', to: 'mining_unbroken_crystal' },
  { from: 'mining_branch_rune_seeker', to: 'mining_ancient_traces' },
  { from: 'mining_ancient_traces', to: 'mining_stone_whisper' },
  { from: 'mining_stone_whisper', to: 'mining_language_of_cracks' },
];

const BLACKSMITH_VISUAL_CONNECTIONS: MiningConnection[] = [
  { from: 'blacksmith_start', to: 'blacksmith_basic_forging' },
  { from: 'blacksmith_start', to: 'blacksmith_even_blank' },
  { from: 'blacksmith_start', to: 'blacksmith_rough_socket' },

  { from: 'blacksmith_basic_forging', to: 'blacksmith_weapon_path' },
  { from: 'blacksmith_even_blank', to: 'blacksmith_armor_path' },
  { from: 'blacksmith_rough_socket', to: 'blacksmith_precision_path' },

  { from: 'blacksmith_weapon_path', to: 'blacksmith_weapon_blades' },
  { from: 'blacksmith_weapon_blades', to: 'blacksmith_weapon_socket' },
  { from: 'blacksmith_weapon_socket', to: 'blacksmith_weapon_master_path' },
  { from: 'blacksmith_weapon_master_path', to: 'blacksmith_razor_steel' },

  { from: 'blacksmith_armor_path', to: 'blacksmith_armor_forging' },
  { from: 'blacksmith_armor_forging', to: 'blacksmith_armor_socket' },
  { from: 'blacksmith_armor_socket', to: 'blacksmith_armor_master_path' },
  { from: 'blacksmith_armor_master_path', to: 'blacksmith_firm_armor_fit' },

  { from: 'blacksmith_precision_path', to: 'blacksmith_fine_work' },
  { from: 'blacksmith_fine_work', to: 'blacksmith_clean_setting' },
  { from: 'blacksmith_clean_setting', to: 'blacksmith_setting_master_path' },
  { from: 'blacksmith_setting_master_path', to: 'blacksmith_gem_settings' },

  { from: 'blacksmith_weapon_master_path', to: 'final_blacksmith_trial' },
  { from: 'blacksmith_armor_master_path', to: 'final_blacksmith_trial' },
  { from: 'blacksmith_setting_master_path', to: 'final_blacksmith_trial' },

  { from: 'final_blacksmith_trial', to: 'blacksmith_unlock_forge_engineering' },
  { from: 'final_blacksmith_trial', to: 'blacksmith_unlock_runecrafting' },
  { from: 'final_blacksmith_trial', to: 'blacksmith_unlock_jewelcrafting' },
];

const BLACKSMITH_SPARKS = [
  { left: '6%', bottom: '10%', delay: '0s', duration: '5.2s', size: 2 },
  { left: '14%', bottom: '22%', delay: '0.8s', duration: '4.8s', size: 3 },
  { left: '22%', bottom: '14%', delay: '1.3s', duration: '5.4s', size: 2 },
  { left: '30%', bottom: '30%', delay: '0.2s', duration: '4.6s', size: 2 },
  { left: '38%', bottom: '18%', delay: '1.7s', duration: '5s', size: 3 },
  { left: '46%', bottom: '12%', delay: '0.5s', duration: '5.6s', size: 2 },
  { left: '54%', bottom: '28%', delay: '1.1s', duration: '4.9s', size: 3 },
  { left: '62%', bottom: '16%', delay: '0.9s', duration: '5.1s', size: 2 },
  { left: '70%', bottom: '26%', delay: '1.5s', duration: '4.7s', size: 2 },
  { left: '78%', bottom: '12%', delay: '0.4s', duration: '5.5s', size: 3 },
  { left: '86%', bottom: '24%', delay: '1.9s', duration: '4.5s', size: 2 },
  { left: '92%', bottom: '10%', delay: '0.6s', duration: '5.3s', size: 2 },
];

const CARPENTER_LEAVES = [
  { left: '8%', delay: '0s', duration: '12s', fontSize: 16 },
  { left: '20%', delay: '3.2s', duration: '15s', fontSize: 20 },
  { left: '32%', delay: '1.1s', duration: '10s', fontSize: 14 },
  { left: '45%', delay: '5.3s', duration: '18s', fontSize: 22 },
  { left: '58%', delay: '2.4s', duration: '14s', fontSize: 18 },
  { left: '70%', delay: '7.1s', duration: '16s', fontSize: 15 },
  { left: '82%', delay: '4.5s', duration: '12s', fontSize: 20 },
  { left: '92%', delay: '8.2s', duration: '19s', fontSize: 17 },
];

export function SkillTreeView(props: SkillTreeViewProps) {
  const {
    professionId,
    professionName,
    skills,
    branches,
    playerProfessionState,
    onLearnSkill,
    onChooseBranch,
    onReset,
    onBack,
    resolveIcon,
    runtimeImages = [],
    legacyFallback,
    isDev = false,
  } = props;

  const [selectedNode, setSelectedNode] = useState<{ type: TreeNodeType; id: string } | null>(null);
  const [selectedNodePopupPosition, setSelectedNodePopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedNodePopupSize, setSelectedNodePopupSize] = useState<{ width: number; height: number }>({ width: 560, height: 360 });
  const [showLegacyList, setShowLegacyList] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const didAutoCenter = useRef(false);

  const allSkills = useMemo(() => {
    const visible = skills.filter((entry) => entry.professionId === professionId && entry.isEnabled);
    if (professionId !== 'mining') {
      return visible;
    }

    const visibleIdSet = new Set(visible.map((entry) => entry.id));
    return visible.filter((entry) => {
      const normalizedName = normalizeMiningSkillNameForMatch(entry.name);
      const canonicalId = MINING_CANONICAL_SKILL_ID_BY_NAME.get(normalizedName);
      if (!canonicalId) {
        return true;
      }
      if (!visibleIdSet.has(canonicalId)) {
        return true;
      }
      return entry.id === canonicalId;
    });
  }, [professionId, skills]);
  const allBranches = useMemo(
    () => branches.filter((entry) => entry.professionId === professionId && entry.isEnabled),
    [branches, professionId],
  );
  const visibleBranches = useMemo(
    () => {
      if (professionId === 'blacksmithing') {
        return allBranches;
      }
      return allBranches.filter((entry) => !['mining_branch_common', 'mining_branch_transition'].includes(entry.id));
    },
    [allBranches, professionId],
  );

  const skillById = useMemo(() => new Map(allSkills.map((entry) => [entry.id, entry])), [allSkills]);
  const branchById = useMemo(() => new Map(allBranches.map((entry) => [entry.id, entry])), [allBranches]);

  const learnedSkillIds = useMemo(() => new Set(playerProfessionState.learnedSkillIds ?? []), [playerProfessionState.learnedSkillIds]);
  const selectedBranchIds = useMemo(() => new Set(playerProfessionState.selectedBranchIds ?? []), [playerProfessionState.selectedBranchIds]);
  const effectiveSelectedBranchIds = useMemo(() => {
    const merged = new Set(selectedBranchIds);
    for (const branch of allBranches) {
      if (shouldAutoActivateBranch(professionId, branch)) {
        merged.add(branch.id);
      }
    }
    return merged;
  }, [allBranches, professionId, selectedBranchIds]);

  const skillStates = useMemo(() => {
    const result = new Map<string, ComputedSkillState>();

    for (const skill of allSkills) {
      const missing: string[] = [];
      const isLearned = learnedSkillIds.has(skill.id);

      if (!isLearned && playerProfessionState.level < skill.requiredLevel) {
        missing.push(`Нужен уровень ${skill.requiredLevel}`);
      }
      if (!isLearned && playerProfessionState.skillPoints < skill.skillPointCost) {
        missing.push(`Нужно очков навыков: ${skill.skillPointCost}`);
      }

      for (const requiredSkillId of skill.requiredSkillIds ?? []) {
        if (!learnedSkillIds.has(requiredSkillId)) {
          const requiredSkillName = skillById.get(requiredSkillId)?.name ?? requiredSkillId;
          missing.push(`Требуется навык: ${requiredSkillName}`);
        }
      }

      for (const requiredBranchId of skill.requiredBranchIds ?? []) {
        if (!effectiveSelectedBranchIds.has(requiredBranchId)) {
          const requiredBranchName = branchById.get(requiredBranchId)?.name ?? requiredBranchId;
          missing.push(`Требуется ветка: ${requiredBranchName}`);
        }
      }

      if (skill.branchId) {
        const branch = branchById.get(skill.branchId);
        if (!branch) {
          missing.push(`Ветка не найдена: ${skill.branchId}`);
        } else {
          if (branch.exclusiveGroupId && !effectiveSelectedBranchIds.has(branch.id)) {
            missing.push(`Сначала выберите ветку: ${branch.name}`);
          }
          const missingBranchSkill = (branch.requiredSkillIds ?? []).find((requiredId) => !learnedSkillIds.has(requiredId));
          if (missingBranchSkill) {
            const requiredName = skillById.get(missingBranchSkill)?.name ?? missingBranchSkill;
            missing.push(`Ветка ${branch.name} требует: ${requiredName}`);
          }
        }
      }

      const blockedByExclusive = getBlockedBySelectedExclusiveBranchReason({
        skill,
        branches: allBranches,
        selectedBranchIds: Array.from(selectedBranchIds),
      });
      const blockedByExclusiveSkill = getBlockedByExclusiveSkillGroupReason({
        skill,
        learnedSkillIds: Array.from(learnedSkillIds),
        allSkills,
      });

      const blockedReason = blockedByExclusive || blockedByExclusiveSkill || undefined;
      const canLearn = !isLearned && !blockedReason && missing.length === 0;
      const visualState: SkillTreeNodeVisualState = isLearned
        ? 'learned'
        : blockedReason
          ? 'blocked'
          : canLearn
            ? 'available'
            : 'locked';

      result.set(skill.id, {
        visualState,
        missingRequirements: missing,
        blockedReason,
        canLearn,
      });
    }

    return result;
  }, [allBranches, allSkills, branchById, effectiveSelectedBranchIds, learnedSkillIds, playerProfessionState.level, playerProfessionState.skillPoints, selectedBranchIds, skillById]);

  const branchStates = useMemo(() => {
    const result = new Map<string, ComputedBranchState>();

    for (const branch of allBranches) {
      const missing: string[] = [];
      const isSelected = selectedBranchIds.has(branch.id);

      for (const requiredSkillId of branch.requiredSkillIds ?? []) {
        if (!learnedSkillIds.has(requiredSkillId)) {
          const name = skillById.get(requiredSkillId)?.name ?? requiredSkillId;
          missing.push(`Требуется навык: ${name}`);
        }
      }
      for (const requiredBranchId of branch.requiredBranchIds ?? []) {
        if (!selectedBranchIds.has(requiredBranchId)) {
          const name = branchById.get(requiredBranchId)?.name ?? requiredBranchId;
          missing.push(`Требуется ветка: ${name}`);
        }
      }

      const groupId = branch.exclusiveGroupId?.trim();
      const selectedInGroup = groupId
        ? countSelectedBranchesInExclusiveGroup(groupId, allBranches, selectedBranchIds)
        : 0;
      const groupMax = getExclusiveGroupMax(branch);
      const groupFull = Boolean(groupId) && selectedInGroup >= groupMax;
      const lockConflictId = (branch.locksBranchIds ?? []).find((lockedBranchId) => selectedBranchIds.has(lockedBranchId));
      const finalTrialBlocked = branch.id === 'final_blacksmith_trial'
        && professionId === 'blacksmithing'
        && !canUnlockFinalBlacksmithTrial(allBranches, allSkills, learnedSkillIds, selectedBranchIds);
      const blockedReason = finalTrialBlocked
        ? 'Нужно завершить 5 навыков в двух мастерских ветках'
        : groupFull
          ? `Можно выбрать только ${groupMax} ветки в этой группе`
          : lockConflictId
            ? `Конфликт с веткой: ${branchById.get(lockConflictId)?.name ?? lockConflictId}`
            : undefined;

      const canChoose = !isSelected && !blockedReason && missing.length === 0;
      const visualState: SkillTreeNodeVisualState = isSelected
        ? 'learned'
        : blockedReason
          ? 'blocked'
          : canChoose
            ? 'available'
            : 'locked';

      result.set(branch.id, {
        visualState,
        missingRequirements: missing,
        blockedReason,
        canChoose,
      });
    }

    return result;
  }, [allBranches, branchById, learnedSkillIds, selectedBranchIds, skillById]);

  const positions = useMemo(() => {
    const map = new Map<string, NodePosition>();
    const isBlacksmith = professionId === 'blacksmithing';

    if (isBlacksmith) {
      for (const [nodeId, layout] of Object.entries(BLACKSMITH_TREE_LAYOUT_BY_ID)) {
        if (layout.kind === 'branch') {
          const branch = allBranches.find((entry) => entry.id === nodeId);
          if (branch) {
            map.set(`branch:${branch.id}`, { x: layout.x, y: layout.y, kind: 'branch' });
          }
          continue;
        }
        const skill = allSkills.find((entry) => entry.id === nodeId);
        if (skill) {
          map.set(`skill:${skill.id}`, {
            x: layout.x + BLACKSMITH_SLOT_OFFSET_X,
            y: layout.y + BLACKSMITH_SLOT_OFFSET_Y,
            kind: 'skill',
          });
        }
      }
    }

    const extraMiningSkillsOrder = professionId === 'mining'
      ? allSkills
          .filter((skill) => {
            if (MINING_TREE_LAYOUT[skill.id]) {
              return false;
            }
            const normalizedName = skill.name.trim().toLowerCase();
            if (!MINING_LEFT_COLUMN_SKILL_NAMES.has(normalizedName)) {
              return false;
            }
            // Left column is only for specifically requested skills with no explicit icon.
            return !String(skill.icon ?? '').trim();
          })
          .slice()
          .sort((a, b) => {
            const levelDiff = a.requiredLevel - b.requiredLevel;
            if (levelDiff !== 0) {
              return levelDiff;
            }
            return a.name.localeCompare(b.name, 'ru');
          })
      : [];
    const extraMiningSkillIndex = new Map(extraMiningSkillsOrder.map((skill, index) => [skill.id, index]));

    allSkills.forEach((skill, index) => {
      const autoX = 120 + ((skill.requiredLevel - 1) % 6) * 220;
      const autoY = 120 + Math.floor(index / 6) * 180;
      if (isBlacksmith && map.has(`skill:${skill.id}`)) {
        return;
      }
      const layoutPosition = professionId === 'mining' ? MINING_TREE_LAYOUT[skill.id] : undefined;
      const extraIndex = professionId === 'mining' ? extraMiningSkillIndex.get(skill.id) : undefined;
      map.set(`skill:${skill.id}`, {
        x: layoutPosition?.x
          ?? (extraIndex !== undefined ? MINING_EXTRA_SKILLS_COLUMN_X : (Number.isFinite(skill.positionX) ? Number(skill.positionX) : autoX)),
        y: layoutPosition?.y
          ?? (extraIndex !== undefined
            ? MINING_EXTRA_SKILLS_COLUMN_START_Y + extraIndex * MINING_EXTRA_SKILLS_ROW_GAP
            : (Number.isFinite(skill.positionY) ? Number(skill.positionY) : autoY)),
        kind: 'skill',
      });
    });

    const maxSkillY = allSkills.reduce((acc, skill) => {
      const y = map.get(`skill:${skill.id}`)?.y ?? 0;
      return Math.max(acc, y);
    }, 0);

    allBranches.forEach((branch, index) => {
      if (isBlacksmith && map.has(`branch:${branch.id}`)) {
        return;
      }
      const linked = allSkills.filter((skill) => skill.branchId === branch.id);
      const layoutPosition = professionId === 'mining' ? MINING_TREE_LAYOUT[branch.id] : undefined;
      if (layoutPosition) {
        map.set(`branch:${branch.id}`, { ...layoutPosition, kind: 'branch' });
      } else if (linked.length > 0) {
        const avgX = linked.reduce((sum, skill) => sum + (map.get(`skill:${skill.id}`)?.x ?? 0), 0) / linked.length;
        const maxY = linked.reduce((sum, skill) => Math.max(sum, map.get(`skill:${skill.id}`)?.y ?? 0), 0);
        map.set(`branch:${branch.id}`, { x: avgX, y: maxY + 170, kind: 'branch' });
      } else {
        map.set(`branch:${branch.id}`, {
          x: 120 + (index % 4) * 280,
          y: maxSkillY + 220 + Math.floor(index / 4) * 180,
          kind: 'branch',
        });
      }
    });

    return map;
  }, [allBranches, allSkills]);

  const canvasSize = useMemo(() => {
    if (professionId === 'mining') {
      return { width: MINING_STAGE_WIDTH, height: MINING_STAGE_HEIGHT };
    }
    if (professionId === 'blacksmithing') {
      return { width: BLACKSMITH_STAGE_WIDTH, height: BLACKSMITH_STAGE_HEIGHT };
    }
    let maxX = 1280;
    let maxY = 760;
    for (const value of positions.values()) {
      maxX = Math.max(maxX, value.x + 240);
      maxY = Math.max(maxY, value.y + 240);
    }
    return { width: maxX, height: maxY };
  }, [positions, professionId]);

  const nodeSize = useMemo(() => {
    if (professionId === 'mining') {
      return {
        skillWidth: MINING_SKILL_NODE_WIDTH,
        skillHeight: MINING_SKILL_NODE_HEIGHT,
        branchWidth: MINING_BRANCH_NODE_WIDTH,
        branchHeight: MINING_BRANCH_NODE_HEIGHT,
      };
    }
    if (professionId === 'blacksmithing') {
      return {
        skillWidth: BLACKSMITH_SKILL_NODE_SIZE,
        skillHeight: BLACKSMITH_SKILL_NODE_SIZE,
        branchWidth: BLACKSMITH_BRANCH_NODE_WIDTH,
        branchHeight: BLACKSMITH_BRANCH_NODE_HEIGHT,
      };
    }
    return {
      skillWidth: DEFAULT_SKILL_NODE_WIDTH,
      skillHeight: DEFAULT_SKILL_NODE_HEIGHT,
      branchWidth: DEFAULT_BRANCH_NODE_WIDTH,
      branchHeight: DEFAULT_BRANCH_NODE_HEIGHT,
    };
  }, [professionId]);

  const stageScale = professionId === 'mining' ? 0.68 : 1;
  const stageWidth = Math.round(canvasSize.width * stageScale);
  const stageHeight = Math.round(canvasSize.height * stageScale);

  const selected = useMemo<SelectedTreeNode | null>(() => {
    if (!selectedNode) {
      return null;
    }

    if (selectedNode.type === 'skill') {
      const skill = skillById.get(selectedNode.id);
      const state = skillStates.get(selectedNode.id);
      if (!skill || !state) {
        return null;
      }

      const iconData = resolveSkillIconData(skill);
      return {
        type: 'skill',
        id: skill.id,
        name: skill.name,
        description: skill.description,
        icon: iconData.icon,
        iconFrame: iconData.iconFrame,
        item: skill,
        blockedReason: state.blockedReason,
        missingRequirements: state.missingRequirements,
        canAct: state.canLearn,
        actionLabel: learnedSkillIds.has(skill.id)
          ? 'Изучено'
          : state.canLearn
            ? 'Изучить навык'
            : state.blockedReason
              ? 'Заблокировано'
              : 'Требования не выполнены',
      };
    }

    const branch = branchById.get(selectedNode.id);
    const state = branchStates.get(selectedNode.id);
    if (!branch || !state) {
      return null;
    }

    const iconData = resolveBranchIconData(branch);
    return {
      type: 'branch',
      id: branch.id,
      name: branch.name,
      description: branch.description,
      icon: iconData.icon,
      iconFrame: iconData.iconFrame,
      item: branch,
      blockedReason: state.blockedReason,
      missingRequirements: state.missingRequirements,
      canAct: state.canChoose,
      actionLabel: selectedBranchIds.has(branch.id)
        ? 'Выбрано'
        : state.canChoose
          ? 'Выбрать ветку'
          : state.blockedReason
            ? 'Заблокировано'
            : 'Требования не выполнены',
    };
  }, [branchById, branchStates, learnedSkillIds, resolveIcon, selectedBranchIds, selectedNode, skillById, skillStates]);

  const lines = useMemo(() => {
    const out: Array<{ key: string; from: NodePosition; to: NodePosition; color: string }> = [];
    const emittedLineKeys = new Set<string>();

    const pushLine = (key: string, from: NodePosition, to: NodePosition, color: string) => {
      if (emittedLineKeys.has(key)) {
        return;
      }
      emittedLineKeys.add(key);
      out.push({ key, from, to, color });
    };

    const colorForState = (state: SkillTreeNodeVisualState): string => {
      if (professionId === 'blacksmithing') {
        if (state === 'learned') return 'rgba(255, 176, 104, 0.94)';
        if (state === 'available') return 'rgba(255, 144, 62, 0.72)';
        return 'rgba(130, 90, 58, 0.46)';
      }
      if (professionId === 'carpenter') {
        if (state === 'learned') return 'rgba(244, 194, 98, 0.96)';
        if (state === 'available') return 'rgba(224, 148, 66, 0.74)';
        return 'rgba(110, 80, 56, 0.48)';
      }
      if (state === 'learned') return 'rgba(255, 255, 255, 0.95)';
      if (state === 'available') return 'rgba(255, 255, 255, 0.72)';
      return 'rgba(255, 255, 255, 0.38)';
    };

    const extraVisualConnections = professionId === 'mining'
      ? MINING_VISUAL_CONNECTIONS
      : professionId === 'blacksmithing'
        ? BLACKSMITH_VISUAL_CONNECTIONS
        : [];

    for (const connection of extraVisualConnections) {
      const from = positions.get(`skill:${connection.from}`) ?? positions.get(`branch:${connection.from}`);
      const to = positions.get(`skill:${connection.to}`) ?? positions.get(`branch:${connection.to}`);
      if (!from || !to) {
        continue;
      }
      const destinationSkill = skillStates.get(connection.to);
      const destinationBranch = branchStates.get(connection.to);
      const visualState = destinationSkill?.visualState ?? destinationBranch?.visualState ?? 'locked';
      pushLine(`${connection.from}->${connection.to}`, from, to, colorForState(visualState));
    }

    for (const skill of allSkills) {
      const to = positions.get(`skill:${skill.id}`);
      if (!to) continue;
      const state = skillStates.get(skill.id)?.visualState ?? 'locked';
      for (const requiredId of skill.requiredSkillIds ?? []) {
        const from = positions.get(`skill:${requiredId}`);
        if (!from) continue;
        pushLine(`skill:${requiredId}->skill:${skill.id}`, from, to, colorForState(state));
      }
      const branchSourceIds = new Set<string>(skill.requiredBranchIds ?? []);
      if (skill.branchId) {
        branchSourceIds.add(skill.branchId);
      }
      for (const requiredBranchId of branchSourceIds) {
        const from = positions.get(`branch:${requiredBranchId}`);
        if (!from) continue;
        pushLine(`branch:${requiredBranchId}->skill:${skill.id}`, from, to, colorForState(state));
      }
    }

    for (const branch of allBranches) {
      const to = positions.get(`branch:${branch.id}`);
      if (!to) continue;
      const state = branchStates.get(branch.id)?.visualState ?? 'locked';
      for (const requiredSkillId of branch.requiredSkillIds ?? []) {
        const from = positions.get(`skill:${requiredSkillId}`);
        if (!from) continue;
        pushLine(`skill:${requiredSkillId}->branch:${branch.id}`, from, to, colorForState(state));
      }
      for (const requiredBranchId of branch.requiredBranchIds ?? []) {
        const from = positions.get(`branch:${requiredBranchId}`);
        if (!from) continue;
        pushLine(`branch:${requiredBranchId}->branch:${branch.id}`, from, to, colorForState(state));
      }
    }

    return out;
  }, [allBranches, allSkills, branchStates, positions, professionId, skillStates]);

  function resolveTreeIcon(nodeName: string, icon?: string): string | undefined {
    const resolved = resolveIcon?.(icon) ?? icon;
    if (resolved) {
      return resolved;
    }
    if (professionId === 'mining') {
      return `/art/mining-skills/${nodeName}.png`;
    }
    return undefined;
  }

  function resolveSkillIconData(skill: ProfessionSkill): {
    icon?: string;
    iconFrame?: {
      src: string;
      frameX: number;
      frameY: number;
      frameWidth: number;
      frameHeight: number;
      sheetWidth: number;
      sheetHeight: number;
    };
  } {
    const imageRef = normalizeGameImageRef(skill.iconImageRef as never, skill.icon);
    if (!imageRef) {
      const autoIconSource = runtimeImages.find((image) => image.id === skill.id)?.dataUrl ?? resolveIcon?.(skill.id);
      if (autoIconSource) {
        return { icon: autoIconSource };
      }
      return { icon: resolveTreeIcon(skill.name, skill.icon) };
    }

    if (imageRef.type === 'image') {
      return { icon: resolveGameImageRefSource(imageRef, runtimeImages) ?? resolveIcon?.(imageRef.src) ?? imageRef.src };
    }

    const sheet = getImageSheet(imageRef.sheetId);
    if (!sheet) {
      return { icon: resolveTreeIcon(skill.name, skill.icon) };
    }
    const source = resolveGameImageRefSource(imageRef, runtimeImages) ?? resolveIcon?.(sheet.src) ?? sheet.src;
    if (!source) {
      return { icon: resolveTreeIcon(skill.name, skill.icon) };
    }
    const frame = getTilesetFrameRect(sheet, imageRef.frame);
    return {
      iconFrame: {
        src: source,
        frameX: frame.x,
        frameY: frame.y,
        frameWidth: Math.max(1, sheet.frameWidth),
        frameHeight: Math.max(1, sheet.frameHeight),
        sheetWidth: Math.max(1, sheet.columns * sheet.frameWidth),
        sheetHeight: Math.max(1, sheet.rows * sheet.frameHeight),
      },
    };
  }

  function resolveBranchIconData(branch: ProfessionBranch): {
    icon?: string;
    iconFrame?: {
      src: string;
      frameX: number;
      frameY: number;
      frameWidth: number;
      frameHeight: number;
      sheetWidth: number;
      sheetHeight: number;
    };
  } {
    const imageRef = normalizeGameImageRef(branch.iconImageRef as never, branch.icon);
    if (!imageRef) {
      const autoIconSource = runtimeImages.find((image) => image.id === branch.id)?.dataUrl ?? resolveIcon?.(branch.id);
      if (autoIconSource) {
        return { icon: autoIconSource };
      }
      return { icon: resolveTreeIcon(branch.name, branch.icon) };
    }

    if (imageRef.type === 'image') {
      return { icon: resolveGameImageRefSource(imageRef, runtimeImages) ?? resolveIcon?.(imageRef.src) ?? imageRef.src };
    }

    const sheet = getImageSheet(imageRef.sheetId);
    if (!sheet) {
      return { icon: resolveTreeIcon(branch.name, branch.icon) };
    }
    const source = resolveGameImageRefSource(imageRef, runtimeImages) ?? resolveIcon?.(sheet.src) ?? sheet.src;
    if (!source) {
      return { icon: resolveTreeIcon(branch.name, branch.icon) };
    }
    const frame = getTilesetFrameRect(sheet, imageRef.frame);
    return {
      iconFrame: {
        src: source,
        frameX: frame.x,
        frameY: frame.y,
        frameWidth: Math.max(1, sheet.frameWidth),
        frameHeight: Math.max(1, sheet.frameHeight),
        sheetWidth: Math.max(1, sheet.columns * sheet.frameWidth),
        sheetHeight: Math.max(1, sheet.rows * sheet.frameHeight),
      },
    };
  }

  const onPointerDownTree: MouseEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 0 || !viewportRef.current) {
      return;
    }
    dragState.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    };
  };

  const onPointerMoveTree: MouseEventHandler<HTMLDivElement> = (event) => {
    if (!dragState.current || !viewportRef.current) {
      return;
    }
    const dx = event.clientX - dragState.current.x;
    const dy = event.clientY - dragState.current.y;
    viewportRef.current.scrollLeft = dragState.current.scrollLeft - dx;
    viewportRef.current.scrollTop = dragState.current.scrollTop - dy;
  };

  const clearDrag = () => {
    dragState.current = null;
  };

  useEffect(() => {
    didAutoCenter.current = false;
    setSelectedNodePopupPosition(null);
  }, [professionId]);

  useEffect(() => {
    if (didAutoCenter.current) {
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const maxScrollLeft = Math.max(0, stageWidth - viewport.clientWidth);
    viewport.scrollLeft = maxScrollLeft * 0.5;
    if (professionId === 'mining') {
      viewport.scrollTop = 0;
    } else if (professionId === 'blacksmithing') {
      viewport.scrollTop = Math.max(0, stageHeight - viewport.clientHeight);
    }
    didAutoCenter.current = true;
  }, [professionId, stageHeight, stageWidth]);

  const handleNodeAction = (item: SelectedTreeNode) => {
    if (item.type === 'skill' && item.canAct) {
      onLearnSkill(item.id);
      return;
    }
    if (item.type === 'branch' && item.canAct) {
      onChooseBranch(item.id);
    }
  };

  const handleSelectNode = (type: TreeNodeType, id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const viewportRect = viewportRef.current?.getBoundingClientRect();
    if (viewportRect) {
      const viewport = viewportRef.current;
      const scrollLeft = viewport?.scrollLeft ?? 0;
      const scrollTop = viewport?.scrollTop ?? 0;
      const x = Math.max(8, scrollLeft + (event.clientX - viewportRect.left));
      const y = Math.max(8, scrollTop + (event.clientY - viewportRect.top));
      setSelectedNodePopupPosition({ x, y });
    } else {
      setSelectedNodePopupPosition(null);
    }
    setSelectedNode({ type, id });
  };

  useLayoutEffect(() => {
    if (!selected || !popupRef.current) {
      return;
    }
    const rect = popupRef.current.getBoundingClientRect();
    const width = Math.max(280, Math.round(rect.width));
    const height = Math.max(200, Math.round(rect.height));
    if (width !== selectedNodePopupSize.width || height !== selectedNodePopupSize.height) {
      setSelectedNodePopupSize({ width, height });
    }
  }, [selected, selectedNodePopupSize.height, selectedNodePopupSize.width]);

  const popupPosition = useMemo(() => {
    const viewport = viewportRef.current;
    const anchor = selectedNodePopupPosition;
    if (!viewport || !anchor) {
      return { left: 12, top: 12 };
    }

    const minLeft = viewport.scrollLeft + 8;
    const minTop = viewport.scrollTop + 8;
    const maxLeft = viewport.scrollLeft + Math.max(8, viewport.clientWidth - selectedNodePopupSize.width - 8);
    const maxTop = viewport.scrollTop + Math.max(8, viewport.clientHeight - selectedNodePopupSize.height - 8);

    return {
      left: Math.min(maxLeft, Math.max(minLeft, anchor.x)),
      top: Math.min(maxTop, Math.max(minTop, anchor.y)),
    };
  }, [selectedNodePopupPosition, selectedNodePopupSize.height, selectedNodePopupSize.width]);

  return (
    <section
      className="inner-card"
      style={{
        display: 'grid',
        gap: 10,
        borderRadius: 12,
        border: '1px solid rgba(183, 140, 72, 0.36)',
        background: 'linear-gradient(180deg, rgba(14, 11, 9, 0.95), rgba(8, 7, 6, 0.98))',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(72, 54, 33, 0.52)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          paddingBottom: 8,
          borderBottom: '1px solid rgba(139, 102, 56, 0.32)',
        }}
      >
        {onBack ? (
          <button
            type="button"
            onClick={() => onBack()}
            style={{
              borderRadius: 8,
              border: '1px solid rgba(149, 111, 62, 0.52)',
              background: 'rgba(21, 18, 14, 0.86)',
              color: '#e8d8be',
              padding: '8px 12px',
            }}
          >
            ← Назад к профессиям
          </button>
        ) : null}
        <strong style={{ fontSize: 20, letterSpacing: 0.6, color: '#f1dfbf' }}>{professionName.toUpperCase()}</strong>
        <span
          style={{
            marginLeft: 'auto',
            borderRadius: 8,
            border: '1px solid rgba(167, 126, 72, 0.62)',
            background: 'rgba(18, 14, 11, 0.86)',
            padding: '6px 10px',
            color: '#efddb8',
            fontWeight: 700,
          }}
        >
          Очки навыков: {playerProfessionState.skillPoints}
        </span>
        {onReset ? <button type="button" onClick={onReset}>Сброс</button> : null}
        {isDev && legacyFallback ? (
          <button type="button" onClick={() => setShowLegacyList((current) => !current)}>
            DEV: список навыков
          </button>
        ) : null}
      </div>

      {showLegacyList && legacyFallback ? (
        <div>{legacyFallback}</div>
      ) : (
        <>
          <div
            ref={viewportRef}
            onMouseDown={onPointerDownTree}
            onMouseMove={onPointerMoveTree}
            onMouseUp={clearDrag}
            onMouseLeave={clearDrag}
            style={{
              position: 'relative',
              height: professionId === 'blacksmithing' ? 'clamp(520px, 72vh, 840px)' : 'clamp(340px, 46vh, 500px)',
              overflow: 'auto',
              borderRadius: 10,
              border: '1px solid rgba(184, 143, 78, 0.36)',
              background: darkBackgroundForProfession(professionId),
              boxShadow: 'inset 0 0 0 1px rgba(57, 42, 26, 0.65)',
              cursor: dragState.current ? 'grabbing' : 'grab',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
             <div
              style={{
                position: 'relative',
                width: stageWidth,
                height: stageHeight,
                background: professionId === 'blacksmithing'
                  ? 'radial-gradient(circle at 50% 8%, rgba(255, 157, 77, 0.16), transparent 20%), radial-gradient(circle at 18% 82%, rgba(194, 107, 32, 0.14), transparent 28%), radial-gradient(circle at 82% 24%, rgba(163, 92, 27, 0.12), transparent 26%), linear-gradient(180deg, rgba(16, 12, 10, 0.99), rgba(10, 8, 7, 0.99))'
                  : 'radial-gradient(circle at 20% 78%, rgba(194, 107, 32, 0.15), transparent 42%), radial-gradient(circle at 76% 24%, rgba(40, 116, 148, 0.15), transparent 40%)',
              }}
            >
              <style>{`
                @keyframes blacksmithSparkRise { 0% { transform: translateY(0) scale(1); opacity: 0.9; } 100% { transform: translateY(-240px) scale(0.25); opacity: 0; } }
                @keyframes leafFall {
                  0% {
                    transform: translateY(0) translateX(0) rotate(0deg) scale(0.7);
                    opacity: 0;
                  }
                  10% {
                    opacity: 0.85;
                  }
                  50% {
                    transform: translateY(300px) translateX(60px) rotate(180deg) scale(1);
                  }
                  95% {
                    opacity: 0.85;
                  }
                  100% {
                    transform: translateY(620px) translateX(-30px) rotate(360deg) scale(0.7);
                    opacity: 0;
                  }
                }
                .skill-node-btn {
                  transition: transform 0.18s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.18s ease, border-color 0.18s ease, filter 0.18s ease !important;
                }
                .skill-node-btn:hover {
                  transform: scale(1.04) translateY(-2px) !important;
                  z-index: 10 !important;
                }
                .skill-node-btn:active {
                  transform: scale(0.98) translateY(0) !important;
                }
              `}</style>
              {professionId === 'blacksmithing' ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'url(/art/professions/craft_background.png)',
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    backgroundRepeat: 'no-repeat',
                    opacity: 0.28,
                    filter: 'saturate(0.75) contrast(1.06) brightness(0.9)',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                />
              ) : null}
              {professionId === 'carpenter' ? (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: 'url(/art/professions/wood_skills.jpg)',
                      backgroundPosition: 'center',
                      backgroundSize: '100% 100%',
                      backgroundRepeat: 'no-repeat',
                      opacity: 0.62,
                      filter: 'saturate(0.75) contrast(1.1) brightness(0.65)',
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  />
                  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
                    {CARPENTER_LEAVES.map((leaf, idx) => (
                      <span
                        key={`leaf-${idx}`}
                        style={{
                          position: 'absolute',
                          left: leaf.left,
                          top: -40,
                          fontSize: leaf.fontSize,
                          animation: `leafFall ${leaf.duration} linear infinite`,
                          animationDelay: leaf.delay,
                          opacity: 0,
                          pointerEvents: 'none',
                          userSelect: 'none',
                        }}
                      >
                        {idx % 2 === 0 ? '🍃' : '🍂'}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              {professionId === 'blacksmithing' ? (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 2 }}>
                  {BLACKSMITH_SPARKS.map((spark) => (
                    <span
                      key={`${spark.left}-${spark.bottom}-${spark.delay}`}
                      style={{
                        position: 'absolute',
                        left: spark.left,
                        bottom: spark.bottom,
                        width: spark.size,
                        height: spark.size,
                        borderRadius: 999,
                        background: 'rgba(255, 132, 42, 0.95)',
                        boxShadow: '0 0 8px rgba(255, 132, 42, 0.72)',
                        animation: `blacksmithSparkRise ${spark.duration} linear infinite`,
                        animationDelay: spark.delay,
                      }}
                    />
                  ))}
                </div>
              ) : null}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: `scale(${stageScale})`,
                  transformOrigin: 'top left',
                  zIndex: 3,
                }}
              >
              <svg width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {lines.map((line) => (
                  <path
                    key={line.key}
                    d={`M ${line.from.x + (line.from.kind === 'branch' ? nodeSize.branchWidth / 2 : nodeSize.skillWidth / 2)} ${line.from.y + (line.from.kind === 'branch' ? nodeSize.branchHeight / 2 : nodeSize.skillHeight / 2)} C ${(line.from.x + line.to.x) / 2} ${line.from.y + (line.from.kind === 'branch' ? nodeSize.branchHeight / 2 : nodeSize.skillHeight / 2)}, ${(line.from.x + line.to.x) / 2} ${line.to.y + (line.to.kind === 'branch' ? nodeSize.branchHeight / 2 : nodeSize.skillHeight / 2)}, ${line.to.x + (line.to.kind === 'branch' ? nodeSize.branchWidth / 2 : nodeSize.skillWidth / 2)} ${line.to.y + (line.to.kind === 'branch' ? nodeSize.branchHeight / 2 : nodeSize.skillHeight / 2)}`}
                    fill="none"
                    stroke={line.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    style={{ filter: professionId === 'blacksmithing' ? 'drop-shadow(0 0 8px rgba(255, 141, 62, 0.38))' : (professionId === 'carpenter' ? 'drop-shadow(0 0 8px rgba(244, 194, 98, 0.45))' : 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.35))') }}
                  />
                ))}
              </svg>

              {allSkills.map((skill) => {
                const position = positions.get(`skill:${skill.id}`);
                if (!position) return null;
                const iconData = resolveSkillIconData(skill);
                return (
                  <SkillTreeNode
                    key={skill.id}
                    id={skill.id}
                    name={skill.name}
                    icon={iconData.icon}
                    iconFrame={iconData.iconFrame}
                    x={position.x}
                    y={position.y}
                    width={nodeSize.skillWidth}
                    height={nodeSize.skillHeight}
                    visualState={skillStates.get(skill.id)?.visualState ?? 'locked'}
                    isSelected={selectedNode?.type === 'skill' && selectedNode.id === skill.id}
                    showName={professionId !== 'mining' && professionId !== 'blacksmithing'}
                    grayUntilLearned={professionId === 'blacksmithing'}
                    slotMode={false}
                    isWoodlandTheme={professionId === 'carpenter'}
                    onSelect={(id, event) => handleSelectNode('skill', id, event)}
                  />
                );
              })}
              {visibleBranches.map((branch) => {
                const position = positions.get(`branch:${branch.id}`);
                if (!position) return null;
                const iconData = resolveBranchIconData(branch);
                return (
                  <SkillTreeNode
                    key={branch.id}
                    id={branch.id}
                    name={branch.name}
                    icon={iconData.icon}
                    iconFrame={iconData.iconFrame}
                    x={position.x}
                    y={position.y}
                    width={nodeSize.branchWidth}
                    height={nodeSize.branchHeight}
                    isBranch
                    visualState={branchStates.get(branch.id)?.visualState ?? 'locked'}
                    isSelected={selectedNode?.type === 'branch' && selectedNode.id === branch.id}
                    showName={professionId !== 'mining'}
                    grayUntilLearned={professionId === 'blacksmithing'}
                    isWoodlandTheme={professionId === 'carpenter'}
                    onSelect={(id, event) => handleSelectNode('branch', id, event)}
                  />
                );
              })}
              </div>
            </div>

            {selected ? (
              <div
                ref={popupRef}
                style={{
                  position: 'absolute',
                  left: popupPosition.left,
                  top: popupPosition.top,
                  zIndex: 24,
                  width: 'min(560px, calc(100% - 24px))',
                  maxWidth: 'calc(100% - 24px)',
                  pointerEvents: 'auto',
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onMouseMove={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <SkillTreeDetailsPanel
                  selected={selected}
                  onAction={handleNodeAction}
                  onClose={() => {
                    setSelectedNode(null);
                    setSelectedNodePopupPosition(null);
                  }}
                />
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
