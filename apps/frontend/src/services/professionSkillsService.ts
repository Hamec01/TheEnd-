import type { ProfessionSkill } from '../types/profession';
import {
  createContentEntry,
  getContentCollection,
  replaceProfessionSkillsCollection,
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
  const normalized = skills.filter((skill) => Boolean(skill.id?.trim()));
  if (normalized.length === 0) {
    return;
  }

  try {
    await replaceProfessionSkillsCollection(normalized);
    return;
  } catch {
    // Fallback for older backends: upsert entry-by-entry.
  }

  let current: ProfessionSkill[] = [];
  try {
    current = await getContentCollection<ProfessionSkill>('professionSkills');
  } catch {
    current = [];
  }

  const currentById = new Map(current.map((entry) => [entry.id, entry]));
  for (const skill of normalized) {
    if (currentById.has(skill.id)) {
      await updateContentEntry('professionSkills', skill.id, skill);
    } else {
      await createContentEntry('professionSkills', skill);
    }
  }
}
