import { Injectable } from '@nestjs/common';
import type { AdminSkillDefinition } from '@theend/rpg-domain';
import { ContentService } from '../content/content.service';

@Injectable()
export class SkillsService {
  constructor(private readonly contentService: ContentService) {}

  list(): AdminSkillDefinition[] {
    return this.contentService.listCollection('skills') as AdminSkillDefinition[];
  }

  get(id: string): AdminSkillDefinition | null {
    return this.contentService.getCollectionEntry('skills', id) as AdminSkillDefinition | null;
  }

  create(payload: AdminSkillDefinition): AdminSkillDefinition {
    return this.contentService.createCollectionEntry('skills', payload) as AdminSkillDefinition;
  }

  update(id: string, payload: Partial<AdminSkillDefinition>): AdminSkillDefinition {
    return this.contentService.updateCollectionEntry('skills', id, payload) as AdminSkillDefinition;
  }

  delete(id: string): void {
    this.contentService.deleteCollectionEntry('skills', id);
  }

  duplicate(id: string): AdminSkillDefinition {
    const current = this.get(id);
    if (!current) {
      throw new Error(`Skill not found: ${id}`);
    }

    const nextId = `${id}_copy_${Math.floor(Math.random() * 10000)}`;
    return this.create({
      ...current,
      id: nextId,
      slug: `${current.slug}-copy-${Math.floor(Math.random() * 10000)}`,
      name: `${current.name} Copy`,
      isPublished: false,
    });
  }

  publish(id: string): AdminSkillDefinition {
    return this.update(id, { isPublished: true });
  }

  unpublish(id: string): AdminSkillDefinition {
    return this.update(id, { isPublished: false });
  }
}
