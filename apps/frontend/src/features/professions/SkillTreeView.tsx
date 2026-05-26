import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEventHandler, ReactNode } from 'react';
import type { PlayerProfessionState } from '@theend/rpg-domain';
import { getBlockedByExclusiveBranchReason } from '../../services/miningSkillValidation';
import type { ProfessionBranch, ProfessionSkill } from '../../types/profession';
import { SkillTreeDetailsPanel, type SelectedTreeNode } from './SkillTreeDetailsPanel';
import {
  MINING_BRANCH_NODE_HEIGHT,
  MINING_BRANCH_NODE_WIDTH,
  MINING_SKILL_NODE_HEIGHT,
  MINING_SKILL_NODE_WIDTH,
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
  return 'radial-gradient(circle at 18% 24%, rgba(70, 50, 34, 0.28), transparent 42%), linear-gradient(180deg, rgba(18, 14, 11, 0.9), rgba(10, 8, 7, 0.95))';
}

const MINING_STAGE_WIDTH = 1220;
const MINING_STAGE_HEIGHT = 820;
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

function normalizeMiningSkillNameForMatch(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
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
    legacyFallback,
    isDev = false,
  } = props;

  const [selectedNode, setSelectedNode] = useState<{ type: TreeNodeType; id: string } | null>(null);
  const [showLegacyList, setShowLegacyList] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
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
    () => allBranches.filter((entry) => !['mining_branch_common', 'mining_branch_transition'].includes(entry.id)),
    [allBranches],
  );

  const skillById = useMemo(() => new Map(allSkills.map((entry) => [entry.id, entry])), [allSkills]);
  const branchById = useMemo(() => new Map(allBranches.map((entry) => [entry.id, entry])), [allBranches]);

  const learnedSkillIds = useMemo(() => new Set(playerProfessionState.learnedSkillIds ?? []), [playerProfessionState.learnedSkillIds]);
  const selectedBranchIds = useMemo(() => new Set(playerProfessionState.selectedBranchIds ?? []), [playerProfessionState.selectedBranchIds]);
  const effectiveSelectedBranchIds = useMemo(() => {
    const merged = new Set(selectedBranchIds);
    for (const branch of allBranches) {
      if (!branch.exclusiveGroupId) {
        merged.add(branch.id);
      }
    }
    return merged;
  }, [allBranches, selectedBranchIds]);

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

      const blockedByExclusive = getBlockedByExclusiveBranchReason({
        skill,
        learnedSkillIds: Array.from(learnedSkillIds),
        allSkills,
        branches: allBranches,
      });

      const blockedReason = blockedByExclusive || undefined;
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
  }, [allBranches, allSkills, branchById, effectiveSelectedBranchIds, learnedSkillIds, playerProfessionState.level, playerProfessionState.skillPoints, skillById]);

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

      const conflict = allBranches.find((candidate) => (
        candidate.id !== branch.id
        && Boolean(candidate.exclusiveGroupId)
        && candidate.exclusiveGroupId === branch.exclusiveGroupId
        && selectedBranchIds.has(candidate.id)
      ));
      const lockConflictId = (branch.locksBranchIds ?? []).find((lockedBranchId) => selectedBranchIds.has(lockedBranchId));
      const blockedReason = conflict
        ? `Заблокировано веткой: ${conflict.name}`
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
    let maxX = 1280;
    let maxY = 760;
    for (const value of positions.values()) {
      maxX = Math.max(maxX, value.x + 240);
      maxY = Math.max(maxY, value.y + 240);
    }
    return { width: maxX, height: maxY };
  }, [positions, professionId]);

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

      const icon = resolveIcon?.(skill.icon) ?? skill.icon;
      return {
        type: 'skill',
        id: skill.id,
        name: skill.name,
        description: skill.description,
        icon,
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

    return {
      type: 'branch',
      id: branch.id,
      name: branch.name,
      description: branch.description,
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

    const colorForState = (state: SkillTreeNodeVisualState): string => {
      if (state === 'learned') return 'rgba(255, 255, 255, 0.95)';
      if (state === 'available') return 'rgba(255, 255, 255, 0.72)';
      return 'rgba(255, 255, 255, 0.38)';
    };

    if (professionId === 'mining') {
      for (const connection of MINING_VISUAL_CONNECTIONS) {
        const from = positions.get(`skill:${connection.from}`) ?? positions.get(`branch:${connection.from}`);
        const to = positions.get(`skill:${connection.to}`) ?? positions.get(`branch:${connection.to}`);
        if (!from || !to) {
          continue;
        }
        const destinationSkill = skillStates.get(connection.to);
        const destinationBranch = branchStates.get(connection.to);
        const visualState = destinationSkill?.visualState ?? destinationBranch?.visualState ?? 'locked';
        out.push({
          key: `${connection.from}->${connection.to}`,
          from,
          to,
          color: colorForState(visualState),
        });
      }
      return out;
    }

    for (const skill of allSkills) {
      const to = positions.get(`skill:${skill.id}`);
      if (!to) continue;
      const state = skillStates.get(skill.id)?.visualState ?? 'locked';
      for (const requiredId of skill.requiredSkillIds ?? []) {
        const from = positions.get(`skill:${requiredId}`);
        if (!from) continue;
        out.push({ key: `skill:${requiredId}->skill:${skill.id}`, from, to, color: colorForState(state) });
      }
      for (const requiredBranchId of skill.requiredBranchIds ?? []) {
        const from = positions.get(`branch:${requiredBranchId}`);
        if (!from) continue;
        out.push({ key: `branch:${requiredBranchId}->skill:${skill.id}`, from, to, color: colorForState(state) });
      }
      if (skill.branchId) {
        const from = positions.get(`branch:${skill.branchId}`);
        if (from) {
          out.push({ key: `branch:${skill.branchId}->skill:${skill.id}`, from, to, color: colorForState(state) });
        }
      }
    }

    for (const branch of allBranches) {
      const to = positions.get(`branch:${branch.id}`);
      if (!to) continue;
      const state = branchStates.get(branch.id)?.visualState ?? 'locked';
      for (const requiredSkillId of branch.requiredSkillIds ?? []) {
        const from = positions.get(`skill:${requiredSkillId}`);
        if (!from) continue;
        out.push({ key: `skill:${requiredSkillId}->branch:${branch.id}`, from, to, color: colorForState(state) });
      }
      for (const requiredBranchId of branch.requiredBranchIds ?? []) {
        const from = positions.get(`branch:${requiredBranchId}`);
        if (!from) continue;
        out.push({ key: `branch:${requiredBranchId}->branch:${branch.id}`, from, to, color: colorForState(state) });
      }
    }

    return out;
  }, [allBranches, allSkills, branchStates, positions, professionId, skillStates]);

  const resolveTreeIcon = (nodeName: string, icon?: string): string | undefined => {
    const resolved = resolveIcon?.(icon) ?? icon;
    if (resolved) {
      return resolved;
    }
    if (professionId === 'mining') {
      return `/art/mining-skills/${nodeName}.png`;
    }
    return undefined;
  };

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
    if (professionId !== 'mining' || didAutoCenter.current) {
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const maxScrollLeft = Math.max(0, stageWidth - viewport.clientWidth);
    viewport.scrollLeft = maxScrollLeft * 0.5;
    viewport.scrollTop = 0;
    didAutoCenter.current = true;
  }, [professionId, stageWidth]);

  useEffect(() => {
    if (selectedNode || allSkills.length === 0) {
      return;
    }
    const firstAvailable = allSkills.find((skill) => skillStates.get(skill.id)?.canLearn) ?? allSkills[0];
    if (firstAvailable) {
      setSelectedNode({ type: 'skill', id: firstAvailable.id });
    }
  }, [allSkills, selectedNode, skillStates]);

  const handleNodeAction = (item: SelectedTreeNode) => {
    if (item.type === 'skill' && item.canAct) {
      onLearnSkill(item.id);
      return;
    }
    if (item.type === 'branch' && item.canAct) {
      onChooseBranch(item.id);
    }
  };

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
              height: 'clamp(340px, 46vh, 500px)',
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
                background: 'radial-gradient(circle at 20% 78%, rgba(194, 107, 32, 0.15), transparent 42%), radial-gradient(circle at 76% 24%, rgba(40, 116, 148, 0.15), transparent 40%)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: `scale(${stageScale})`,
                  transformOrigin: 'top left',
                }}
              >
              <svg width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {lines.map((line) => (
                  <path
                    key={line.key}
                    d={`M ${line.from.x + (line.from.kind === 'branch' ? MINING_BRANCH_NODE_WIDTH / 2 : MINING_SKILL_NODE_WIDTH / 2)} ${line.from.y + (line.from.kind === 'branch' ? MINING_BRANCH_NODE_HEIGHT / 2 : MINING_SKILL_NODE_HEIGHT / 2)} C ${(line.from.x + line.to.x) / 2} ${line.from.y + (line.from.kind === 'branch' ? MINING_BRANCH_NODE_HEIGHT / 2 : MINING_SKILL_NODE_HEIGHT / 2)}, ${(line.from.x + line.to.x) / 2} ${line.to.y + (line.to.kind === 'branch' ? MINING_BRANCH_NODE_HEIGHT / 2 : MINING_SKILL_NODE_HEIGHT / 2)}, ${line.to.x + (line.to.kind === 'branch' ? MINING_BRANCH_NODE_WIDTH / 2 : MINING_SKILL_NODE_WIDTH / 2)} ${line.to.y + (line.to.kind === 'branch' ? MINING_BRANCH_NODE_HEIGHT / 2 : MINING_SKILL_NODE_HEIGHT / 2)}`}
                    fill="none"
                    stroke={line.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.35))' }}
                  />
                ))}
              </svg>

              {allSkills.map((skill) => {
                const position = positions.get(`skill:${skill.id}`);
                if (!position) return null;
                const icon = resolveTreeIcon(skill.name, skill.icon);
                return (
                  <SkillTreeNode
                    key={skill.id}
                    id={skill.id}
                    name={skill.name}
                    icon={icon}
                    x={position.x}
                    y={position.y}
                    visualState={skillStates.get(skill.id)?.visualState ?? 'locked'}
                    isSelected={selectedNode?.type === 'skill' && selectedNode.id === skill.id}
                    onSelect={(id) => setSelectedNode({ type: 'skill', id })}
                  />
                );
              })}
              {visibleBranches.map((branch) => {
                const position = positions.get(`branch:${branch.id}`);
                if (!position) return null;
                return (
                  <SkillTreeNode
                    key={branch.id}
                    id={branch.id}
                    name={branch.name}
                    icon={resolveTreeIcon(branch.name)}
                    x={position.x}
                    y={position.y}
                    isBranch
                    visualState={branchStates.get(branch.id)?.visualState ?? 'locked'}
                    isSelected={selectedNode?.type === 'branch' && selectedNode.id === branch.id}
                    onSelect={(id) => setSelectedNode({ type: 'branch', id })}
                  />
                );
              })}
              </div>
            </div>
          </div>

          <SkillTreeDetailsPanel selected={selected} onAction={handleNodeAction} />
        </>
      )}
    </section>
  );
}
