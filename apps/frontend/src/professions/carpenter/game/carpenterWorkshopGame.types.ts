import type { InventoryState } from '@theend/rpg-domain';
import type {
  AdminItem,
  CarpenterCraftedComponentSnapshot,
  CarpenterItemTemplate,
  Material,
  ProfessionWorkshopDefinition,
  TreeDefinition,
} from '../../../services/content/models';
import type { CarpenterCraftInputSelection } from '../carpenterComponentCrafting';

export type CarpenterWorkshopRiskLevel = 'steady' | 'balanced' | 'reckless';
export type CarpenterWorkshopGamePhase = 'prep' | 'work' | 'result';

export interface CarpenterWorkshopGameLaunchParams {
  characterId: string;
  inventory: InventoryState;
  workshop: ProfessionWorkshopDefinition;
  activeStationType?: string | null;
  initialTemplateId?: string | null;
  carpenterLevel: number;
  learnedSkillIds: string[];
  skillNameById?: Record<string, string>;
}

export interface CarpenterWorkshopGameContent {
  items: AdminItem[];
  materials: Material[];
  trees: TreeDefinition[];
  templates: CarpenterItemTemplate[];
}

export interface CarpenterWorkshopToolOption {
  inventoryItemId: string;
  templateItemId: string;
  item: AdminItem;
  name: string;
  toolKind: string;
  tier: number;
  efficiency: number;
  durability: number;
  maxDurability: number;
}

export interface CarpenterWorkshopMaterialOption {
  itemId: string;
  label: string;
  quantity: number;
  componentKind: string;
}

export interface CarpenterWorkshopTemplateOption {
  template: CarpenterItemTemplate;
  lockedReason?: string;
}

export interface CarpenterWorkshopRunConfig {
  workshopId: string;
  templateId: string;
  templateName: string;
  stationType: string;
  stageTitle: string;
  instruction: string;
  laneCount: number;
  totalSteps: number;
  stepDurationMs: number;
  cursorSpeed: number;
  targetWidth: number;
  maxMistakes: number;
  integrityStart: number;
  baseDifficulty: number;
  baseRisk: number;
  riskLevel: CarpenterWorkshopRiskLevel;
  toolEfficiency: number;
  toolTier: number;
  carpenterLevel: number;
}

export interface CarpenterWorkshopStageResult {
  success: boolean;
  qualityScore: number;
  mistakes: number;
  completedSteps: number;
  totalSteps: number;
  maxCombo: number;
  integrityLeft: number;
  reason?: 'cancelled' | 'mistakes' | 'integrity' | 'timeout' | 'material_broken' | 'too_many_mistakes';
  resultGrade?: 'broken' | 'poor' | 'common' | 'good' | 'excellent' | 'masterwork' | 'masterpiece';
  traitRetentionPercent?: number;
}

export interface CarpenterWorkshopResult {
  success: boolean;
  templateId: string;
  templateName: string;
  workshopId: string;
  stationType: string;
  qualityScore: number;
  lostMaterials: boolean;
  createdItemId?: string;
  createdItemName?: string;
  snapshot?: CarpenterCraftedComponentSnapshot;
  reason?: string;
}

export interface CarpenterWorkshopResolvedSelections {
  template: CarpenterItemTemplate;
  inputSelections: CarpenterCraftInputSelection[];
  tool: CarpenterWorkshopToolOption | null;
}
