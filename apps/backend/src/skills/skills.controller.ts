import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { CreateSkillDto } from './dto/create-skill.dto';
import type { UpdateSkillDto } from './dto/update-skill.dto';
import { SkillsService } from './skills.service';

@Controller('admin/skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  async list() {
    return this.skillsService.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.skillsService.get(id);
  }

  @Post()
  async create(@Body() payload: CreateSkillDto) {
    return this.skillsService.create(payload);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() payload: UpdateSkillDto) {
    return this.skillsService.update(id, payload);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.skillsService.delete(id);
    return { ok: true };
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id') id: string) {
    return this.skillsService.duplicate(id);
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    return this.skillsService.publish(id);
  }

  @Post(':id/unpublish')
  async unpublish(@Param('id') id: string) {
    return this.skillsService.unpublish(id);
  }
}