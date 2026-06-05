import { BadRequestException, Body, Controller, Delete, Get, Logger, Param, Post, Put } from '@nestjs/common';
import { WorldSimulationService } from './world-simulation.service';
import type {
  ActiveWorldEntity,
  WorldNpcArchetype,
  WorldRoute,
  WorldSimConfig,
  WorldSpawnRule,
} from './types/world-simulation.types';

/**
 * API контроллер для управления мировой симуляцией.
 * Используется админкой для конфигурации и монитора для GM-команд.
 */
@Controller('api/world-simulation')
export class WorldSimulationController {
  private readonly logger = new Logger(WorldSimulationController.name);

  constructor(private readonly worldSim: WorldSimulationService) {}

  // ─── Config / Import / Export ─────────────────────────────────────────────

  /** GET /api/world-simulation/config — current persistent config */
  @Get('config')
  getConfig(): WorldSimConfig {
    return this.worldSim.getConfig();
  }

  /** GET /api/world-simulation/export — alias for config (frontend clarity) */
  @Get('export')
  exportConfig(): WorldSimConfig {
    return this.worldSim.getConfig();
  }

  /** PUT /api/world-simulation/config — full replace of persistent config */
  @Put('config')
  async putConfig(@Body() config: WorldSimConfig): Promise<{ ok: boolean; errors: string[]; config: WorldSimConfig }> {
    this.logger.log('PUT /config — replacing world-sim config');
    const result = await this.worldSim.importConfig('replace', config);
    if (!result.ok) {
      throw new BadRequestException({ errors: result.errors });
    }
    return result;
  }

  /** POST /api/world-simulation/import — replace or merge config */
  @Post('import')
  async importConfig(
    @Body() body: { mode: 'replace' | 'merge'; config: WorldSimConfig },
  ): Promise<{ ok: boolean; errors: string[]; config: WorldSimConfig }> {
    const mode = body.mode === 'merge' ? 'merge' : 'replace';
    this.logger.log(`POST /import — mode=${mode}`);
    const result = await this.worldSim.importConfig(mode, body.config);
    if (!result.ok) {
      throw new BadRequestException({ errors: result.errors });
    }
    return result;
  }

  /** POST /api/world-simulation/validate — validate config without saving */
  @Post('validate')
  validateConfig(@Body() config: WorldSimConfig): { ok: boolean; errors: string[] } {
    const errors = this.worldSim.validateWorldSimConfig(config);
    return { ok: errors.length === 0, errors };
  }

  // ─── Архетипы NPC ─────────────────────────────────────────────────────────

  @Post('archetypes')
  async createArchetype(@Body() archetype: WorldNpcArchetype): Promise<WorldNpcArchetype> {
    this.logger.log(`Create archetype: ${archetype.id}`);
    return this.worldSim.createArchetype(archetype);
  }

  @Get('archetypes')
  listArchetypes(): WorldNpcArchetype[] {
    return this.worldSim.listArchetypes();
  }

  @Get('archetypes/:id')
  getArchetype(@Param('id') id: string): WorldNpcArchetype | null {
    return this.worldSim.getArchetype(id);
  }

  @Put('archetypes/:id')
  async updateArchetype(
    @Param('id') id: string,
    @Body() updates: Partial<WorldNpcArchetype>,
  ): Promise<WorldNpcArchetype | null> {
    this.logger.log(`Update archetype: ${id}`);
    return this.worldSim.updateArchetype(id, updates);
  }

  @Delete('archetypes/:id')
  async deleteArchetype(@Param('id') id: string): Promise<{
    success: boolean;
    removedActiveEntities: number;
    updatedRoutes: number;
    updatedSpawnRules: number;
  }> {
    this.logger.log(`Delete archetype: ${id}`);
    return this.worldSim.deleteArchetype(id);
  }

  // ─── Маршруты ─────────────────────────────────────────────────────────────

  @Post('routes')
  async createRoute(@Body() route: WorldRoute): Promise<WorldRoute> {
    this.logger.log(`Create route: ${route.id}`);
    return this.worldSim.createRoute(route);
  }

  @Get('routes')
  listRoutes(): WorldRoute[] {
    return this.worldSim.listRoutes();
  }

  @Get('routes/:id')
  getRoute(@Param('id') id: string): WorldRoute | null {
    return this.worldSim.getRoute(id);
  }

  @Put('routes/:id')
  async updateRoute(
    @Param('id') id: string,
    @Body() updates: Partial<WorldRoute>,
  ): Promise<WorldRoute | null> {
    this.logger.log(`Update route: ${id}`);
    return this.worldSim.updateRoute(id, updates);
  }

  @Delete('routes/:id')
  async deleteRoute(@Param('id') id: string): Promise<{ success: boolean; removedActiveEntities: number }> {
    this.logger.log(`Delete route: ${id}`);
    return this.worldSim.deleteRoute(id);
  }

  // ─── Правила спавна ───────────────────────────────────────────────────────

  @Post('spawn-rules')
  async createSpawnRule(@Body() rule: WorldSpawnRule): Promise<WorldSpawnRule> {
    this.logger.log(`Create spawn rule: ${rule.id}`);
    return this.worldSim.createSpawnRule(rule);
  }

  @Get('spawn-rules')
  listSpawnRules(): WorldSpawnRule[] {
    return this.worldSim.listSpawnRules();
  }

  @Get('spawn-rules/:id')
  getSpawnRule(@Param('id') id: string): WorldSpawnRule | null {
    return this.worldSim.getSpawnRule(id);
  }

  @Put('spawn-rules/:id')
  async updateSpawnRule(
    @Param('id') id: string,
    @Body() updates: Partial<WorldSpawnRule>,
  ): Promise<WorldSpawnRule | null> {
    this.logger.log(`Update spawn rule: ${id}`);
    return this.worldSim.updateSpawnRule(id, updates);
  }

  @Delete('spawn-rules/:id')
  async deleteSpawnRule(@Param('id') id: string): Promise<{ success: boolean }> {
    this.logger.log(`Delete spawn rule: ${id}`);
    return this.worldSim.deleteSpawnRule(id);
  }

  // ─── Активные сущности (Monitor / GM commands) ────────────────────────────

  @Get('active-entities')
  listActiveEntities(): ActiveWorldEntity[] {
    return this.worldSim.listActiveEntities();
  }

  @Post('active-entities/:id/kill')
  killEntity(@Param('id') id: string): { success: boolean } {
    this.logger.log(`Kill entity: ${id}`);
    return { success: this.worldSim.killEntity(id) };
  }

  @Post('active-entities/:id/freeze')
  freezeEntity(
    @Param('id') id: string,
    @Body() body: { durationHours: number },
  ): { success: boolean } {
    this.logger.log(`Freeze entity: ${id} for ${body.durationHours}h`);
    return { success: this.worldSim.freezeEntity(id, body.durationHours) };
  }

  @Post('active-entities/:id/teleport')
  teleportEntity(
    @Param('id') id: string,
    @Body() body: { zoneId: string; coordinates: { x: number; y: number } },
  ): { success: boolean } {
    this.logger.log(`Teleport entity: ${id} to ${body.zoneId}`);
    return { success: this.worldSim.teleportEntity(id, body.zoneId, body.coordinates) };
  }

  // ─── Снимок мира (для фронтенда/игрока) ──────────────────────────────────

  @Get('snapshot')
  getSnapshot() {
    return this.worldSim.getWorldSnapshot();
  }
}
