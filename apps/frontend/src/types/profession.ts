export type ProfessionCategory = 'gathering' | 'crafting' | 'survival' | 'alchemy' | 'other';

export function translateProfessionCategory(category: ProfessionCategory): string {
  const translations: Record<ProfessionCategory, string> = {
    'gathering': 'Добыча',
    'crafting': 'Ремесло',
    'survival': 'Выживание',
    'alchemy': 'Алхимия',
    'other': 'Другое',
  };
  return translations[category] || category;
}

export interface ProfessionDefinition {
  id: string;
  name: string;
  description: string;
  category: ProfessionCategory;
  icon?: string;
  maxLevel: number;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfessionSkill {
  id: string;
  professionId: string;
  name: string;
  description: string;
  requiredLevel: number;
  requiredSkillIds?: string[];
  branchId?: string;
  skillPointCost: number;
  effects?: Record<string, unknown>;
  icon?: string;
  positionX?: number;
  positionY?: number;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfessionBranch {
  id: string;
  professionId: string;
  name: string;
  description: string;
  exclusiveGroupId?: string;
  requiredSkillIds?: string[];
  isFinalBranch?: boolean;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}
