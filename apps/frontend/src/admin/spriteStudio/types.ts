import type {
  EquipmentVisualBindingDefinition,
  RuntimeAssemblyRuleDefinition,
  SkillAnimationBindingDefinition,
  SpriteAnimationSetDefinition,
  SpriteBodyTemplateDefinition,
  SpriteVectorDocument,
  SpriteVisualAssetDefinition,
  SpriteProfileDefinition,
} from '@theend/rpg-domain';
import type {
  AdminItem,
  AdminNpc,
  AdminSkill,
  AdminVisualFx,
  ImageSheetDefinition,
  StoredImage,
} from '../../services/content/models';

export type SpriteStudioTab = 'control' | 'playground' | 'spritesheet' | 'import' | 'itemForge' | 'bindings' | 'export' | 'notes';

export interface SpriteStudioDraftState {
  bodyTemplates: SpriteBodyTemplateDefinition[];
  animationSets: SpriteAnimationSetDefinition[];
  vectorDocuments: SpriteVectorDocument[];
  visualAssets: SpriteVisualAssetDefinition[];
  equipmentBindings: EquipmentVisualBindingDefinition[];
  spriteProfiles: SpriteProfileDefinition[];
  skillBindings: SkillAnimationBindingDefinition[];
  runtimeRules: RuntimeAssemblyRuleDefinition[];
  npcs: AdminNpc[];
  items: AdminItem[];
  skills: AdminSkill[];
}

export interface SpriteStudioReferenceData {
  visualFx: AdminVisualFx[];
  images: StoredImage[];
  imageSheets: ImageSheetDefinition[];
}

