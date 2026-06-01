import type {
  AcquisitionType,
  CastType,
  DamageKind,
  EffectStackMode,
  EffectType,
  ElementType,
  HealType,
  MagicSchoolType,
  PhysicalDamageType,
  RiskSeverity,
  SkillAreaShape,
  SkillClassRole,
  SkillResourceType,
  SkillRiskType,
  SkillSubtype,
  SkillTargetType,
  SkillType,
  SpiritType,
  StatType,
  SummonControlType,
  SummonType,
} from './skill.enums';
import type { SkillVisualConfig } from '../visual-effects';

export interface AreaFalloffConfig {
  enabled: boolean;
  minPercent?: number;
}

export interface SkillLevelData {
  level: number;
  basePower: number;
  scalingPower?: number;
  costsOverride?: Partial<SkillCostConfig>;
  cooldownOverride?: Partial<SkillCooldownConfig>;
  damage?: SkillDamageComponent[];
  healing?: SkillHealingComponent[];
  effects?: SkillEffectComponent[];
  descriptionOverride?: string;
}

export interface SkillResourceCost {
  type: SkillResourceType;
  amount: number;
  amountPerLevel?: number;
  percentOfMax?: boolean;
  itemId?: string;
}

export interface SkillCostConfig {
  resources: SkillResourceCost[];
  allowClassModifiers: boolean;
  allowRaceModifiers: boolean;
  allowEquipmentModifiers: boolean;
  isFree?: boolean;
}

export interface SkillDamageComponent {
  id: string;
  damageKind: DamageKind;
  physicalType?: PhysicalDamageType;
  elements?: ElementType[];
  magicSchool?: MagicSchoolType;
  runeIds?: string[];
  minDamage: number;
  maxDamage: number;
  scalingStat?: StatType;
  scalingMultiplier?: number;
  canCrit: boolean;
  critChanceBonus?: number;
  critDamageMultiplier?: number;
  armorPenetrationPercent?: number;
  resistancePenetrationPercent?: number;
  isAreaDamage?: boolean;
  falloff?: AreaFalloffConfig;
}

export interface SkillHealingComponent {
  id: string;
  healType: HealType;
  minHeal: number;
  maxHeal: number;
  scalingStat?: StatType;
  scalingMultiplier?: number;
  canCrit: boolean;
  removesEffects?: EffectType[];
}

export interface SkillEffectComponent {
  id: string;
  effectType: EffectType;
  chancePercent: number;
  durationTurns?: number;
  value?: number;
  valuePerLevel?: number;
  stackMode: EffectStackMode;
  maxStacks?: number;
  targetStat?: StatType;
  dispellable: boolean;
}

export interface SkillAreaConfig {
  shape: SkillAreaShape;
  radius?: number;
  width?: number;
  length?: number;
  maxTargets?: number;
  friendlyFire: boolean;
}

export interface SkillTargetConfig {
  targetType: SkillTargetType;
  maxTargets?: number;
  range: number;
  area?: SkillAreaConfig;
  canTargetSelf: boolean;
  canTargetAllies: boolean;
  canTargetEnemies: boolean;
  canTargetDead: boolean;
}

export interface SkillCastConfig {
  castType: CastType;
  castTimeTurns?: number;
  requiresLineOfSight: boolean;
  canBeInterrupted: boolean;
  requiresWeapon?: boolean;
  requiredWeaponSubtypes?: string[];
  requiresFreeHands?: boolean;
  requiresRuneMark?: boolean;
  requiresSpiritContract?: boolean;
}

export interface SkillCooldownConfig {
  cooldownTurns: number;
  startsOnCombatStart?: boolean;
  oncePerCombat?: boolean;
  charges?: number;
  rechargeTurns?: number;
}

export interface RequirementReputation {
  factionId: string;
  minValue: number;
}

export interface SkillRequirementConfig {
  minCharacterLevel?: number;
  requiredStats?: Partial<Record<StatType, number>>;
  allowedRaces?: string[];
  forbiddenRaces?: string[];
  allowedClasses?: string[];
  forbiddenClasses?: string[];
  requiredSkills?: string[];
  requiredSkillLevels?: Record<string, number>;
  requiredItems?: string[];
  requiredQuestIds?: string[];
  requiredFactionIds?: string[];
  requiredReputation?: RequirementReputation[];
  requiredElements?: ElementType[];
  requiredMagicSchools?: MagicSchoolType[];
  requiredRuneIds?: string[];
  requiredSpiritContracts?: string[];
  requiresTeacher?: boolean;
  requiresBook?: boolean;
  requiresDiscovery?: boolean;
}

export interface SkillAcquisitionMethod {
  type: AcquisitionType;
  priceGold?: number;
  teacherNpcId?: string;
  questId?: string;
  itemId?: string;
  bookId?: string;
  locationId?: string;
  factionId?: string;
  eventId?: string;
  discoveryText?: string;
}

export interface SkillAcquisitionConfig {
  methods: SkillAcquisitionMethod[];
  isStarterSkill: boolean;
  isQuestReward: boolean;
  isBuyable: boolean;
  isDiscoverable: boolean;
  isAdminOnly: boolean;
}

export type SkillAvailabilityChannel = 'trainer' | 'quest' | 'dialogue' | 'item' | 'hidden' | 'admin';

export interface SkillClassScalingConfig {
  classId: string;
  role: SkillClassRole;
  damageMultiplier: number;
  healingMultiplier: number;
  costMultiplier: number;
  failChanceModifier: number;
  riskModifier: number;
}

export interface SkillRaceRuleConfig {
  raceId: string;
  canUse: boolean;
  damageMultiplier?: number;
  healingMultiplier?: number;
  costMultiplier?: number;
  riskModifier?: number;
  failChanceModifier?: number;
  note?: string;
}

export interface SkillRiskComponent {
  id: string;
  riskType: SkillRiskType;
  chancePercent: number;
  severity: RiskSeverity;
  value?: number;
  durationTurns?: number;
  description: string;
}

export interface SkillRuneConfig {
  usesRunes: boolean;
  runeIds: string[];
  requiredRuneIds: string[];
  bindingRuneIds: string[];
  runeCosts: SkillResourceCost[];
  overloadRisk?: SkillRiskComponent;
  removable: boolean;
  canDestroyHost: boolean;
  ritualRuneAllowed?: boolean;
}

export interface SkillShamanismConfig {
  requiresSpirit: boolean;
  requiresContract: boolean;
  spiritType?: SpiritType;
  canSummonEntity: boolean;
  canMakeContract: boolean;
  canLoseControl: boolean;
  spiritAngerRisk?: SkillRiskComponent;
  possessionRisk?: SkillRiskComponent;
}

export interface SkillSummonComponent {
  summonId: string;
  summonType: SummonType;
  durationTurns?: number;
  maxSummons?: number;
  controlType: SummonControlType;
  riskOnFail?: SkillRiskComponent[];
}

export interface SkillTransformationComponent {
  transformationId: string;
  target: 'self' | 'enemy' | 'ally';
  durationTurns: number;
  statModifiers: Partial<Record<StatType, number>>;
  lockSkills?: boolean;
  replaceSkillsWith?: string[];
  riskOnExpire?: SkillRiskComponent[];
}

export type SkillImageRef =
  | {
    type: 'image';
    src: string;
  }
  | {
    type: 'tileset';
    sheetId: string;
    frame: number;
  };

export interface SkillDefinition {
  id: string;
  name: string;
  slug: string;
  type: SkillType;
  subtypes: SkillSubtype[];
  iconUrl?: string;
  iconImageRef?: SkillImageRef;
  visuals?: SkillVisualConfig;
  shortDescription: string;
  gameplayDescription: string;
  loreDescription?: string;
  isActive: boolean;
  isPassive: boolean;
  isToggleable: boolean;
  maxLevel: 1 | 2 | 3 | 4 | 5;
  levels: SkillLevelData[];
  target: SkillTargetConfig;
  costs: SkillCostConfig;
  damage: SkillDamageComponent[];
  healing: SkillHealingComponent[];
  effects: SkillEffectComponent[];
  summons: SkillSummonComponent[];
  transformations: SkillTransformationComponent[];
  risks: SkillRiskComponent[];
  rune: SkillRuneConfig;
  shamanism: SkillShamanismConfig;
  requirements: SkillRequirementConfig;
  acquisition: SkillAcquisitionConfig;
  classScaling: SkillClassScalingConfig[];
  raceRules: SkillRaceRuleConfig[];
  cooldown: SkillCooldownConfig;
  cast: SkillCastConfig;
  tags: string[];
  isPublished: boolean;
  isHidden: boolean;

  // Explicit generic-training availability settings.
  acquisitionMode?: SkillAvailabilityChannel;
  isTrainable?: boolean;
  requiredLevel?: number;
  requiredQuestId?: string;
  requiredCompletedQuestId?: string;
  requiredQuestItemId?: string;
  requiredNpcId?: string;
  requiredClassIds?: string[];
  requiredRaceIds?: string[];
  requiredKnownSkillIds?: string[];

  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}
