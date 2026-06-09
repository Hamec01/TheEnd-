import type { ProfessionSkill } from '../types/profession';
import {
  createContentEntry,
  getContentCollection,
  updateContentEntry,
} from './content/contentApi';

export async function loadProfessionSkillsFromBackend(): Promise<ProfessionSkill[]> {
  try {
    const entries = await getContentCollection<ProfessionSkill>('professionSkills');
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export async function syncProfessionSkillsToBackend(skills: ProfessionSkill[]): Promise<void> {
  let current: ProfessionSkill[] = [];
  try {
    current = await getContentCollection<ProfessionSkill>('professionSkills');
  } catch {
    current = [];
  }

  const currentById = new Map(current.map((entry) => [entry.id, entry]));
  for (const skill of skills) {
    if (!skill.id?.trim()) {
      continue;
    }
    if (currentById.has(skill.id)) {
      await updateContentEntry('professionSkills', skill.id, skill);
    } else {
      await createContentEntry('professionSkills', skill);
    }
  }
}
