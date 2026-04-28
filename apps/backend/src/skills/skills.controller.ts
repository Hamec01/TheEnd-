import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import type { CreateSkillDto } from './dto/create-skill.dto';
import type { UpdateSkillDto } from './dto/update-skill.dto';
import { SkillsService } from './skills.service';

@Controller('admin/skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  list() {
    return this.skillsService.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.skillsService.get(id);
  }

  @Post()
  create(@Body() payload: CreateSkillDto) {
    return this.skillsService.create(payload);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() payload: UpdateSkillDto) {
    return this.skillsService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.skillsService.delete(id);
    return { ok: true };
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.skillsService.duplicate(id);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.skillsService.publish(id);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.skillsService.unpublish(id);
  }
}