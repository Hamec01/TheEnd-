import { Injectable } from '@nestjs/common';
import type { AdminSkillDefinition } from '@theend/rpg-domain';
import { ContentService } from '../content/content.service';

@Injectable()
export class SkillsService {
  constructor(private readonly contentService: ContentService) {}

  async list(): Promise<AdminSkillDefinition[]> {
    await this.contentService.ensureInitialized();
    return this.contentService.listCollection('skills') as AdminSkillDefinition[];
  }

  async get(id: string): Promise<AdminSkillDefinition | null> {
    await this.contentService.ensureInitialized();
    return this.contentService.getCollectionEntry('skills', id) as AdminSkillDefinition | null;
  }

  async create(payload: AdminSkillDefinition): Promise<AdminSkillDefinition> {
    await this.contentService.ensureInitialized();
    return await this.contentService.createCollectionEntry('skills', payload) as AdminSkillDefinition;
  }

  async update(id: string, payload: Partial<AdminSkillDefinition>): Promise<AdminSkillDefinition> {
    await this.contentService.ensureInitialized();
    return await this.contentService.updateCollectionEntry('skills', id, payload) as AdminSkillDefinition;
  }

  async delete(id: string): Promise<void> {
    await this.contentService.ensureInitialized();
    await this.contentService.deleteCollectionEntry('skills', id);
  }

  async duplicate(id: string): Promise<AdminSkillDefinition> {
    const current = await this.get(id);
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

  publish(id: string): Promise<AdminSkillDefinition> {
    return this.update(id, { isPublished: true });
  }

  unpublish(id: string): Promise<AdminSkillDefinition> {
    return this.update(id, { isPublished: false });
  }
}
