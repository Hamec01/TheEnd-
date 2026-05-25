import { Controller, Post, Get, Put, Delete, Body, Param, Logger } from '@nestjs/common';
import { WorldSimulationService } from './world-simulation.service';
import type {
  WorldNpcArchetype,
  WorldRoute,
  WorldSpawnRule,
  ActiveWorldEntity,
} from './types/world-simulation.types';

/**
 * API контроллер для управления мировой симуляцией.
 * Используется админкой для конфигурации и монитора для GM-команд.
 */
@Controller('api/world-simulation')
export class WorldSimulationController {
  private readonly logger = new Logger(WorldSimulationController.name);

  constructor(private readonly worldSim: WorldSimulationService) {}

  /**
   * === АРХЕТИПЫ NPC ===
   */

  @Post('archetypes')
  createArchetype(@Body() archetype: WorldNpcArchetype): WorldNpcArchetype {
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
  updateArchetype(@Param('id') id: string, @Body() updates: Partial<WorldNpcArchetype>): WorldNpcArchetype | null {
    this.logger.log(`Update archetype: ${id}`);
    return this.worldSim.updateArchetype(id, updates);
  }

  @Delete('archetypes/:id')
  deleteArchetype(@Param('id') id: string): {
    success: boolean;
    removedActiveEntities: number;
    updatedRoutes: number;
    updatedSpawnRules: number;
  } {
    this.logger.log(`Delete archetype: ${id}`);
    return this.worldSim.deleteArchetype(id);
  }

  /**
   * === МАРШРУТЫ ===
   */

  @Post('routes')
  createRoute(@Body() route: WorldRoute): WorldRoute {
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
  updateRoute(@Param('id') id: string, @Body() updates: Partial<WorldRoute>): WorldRoute | null {
    this.logger.log(`Update route: ${id}`);
    return this.worldSim.updateRoute(id, updates);
  }

  /**
   * === ПРАВИЛА СПАВНА ===
   */

  @Post('spawn-rules')
  createSpawnRule(@Body() rule: WorldSpawnRule): WorldSpawnRule {
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
  updateSpawnRule(@Param('id') id: string, @Body() updates: Partial<WorldSpawnRule>): WorldSpawnRule | null {
    this.logger.log(`Update spawn rule: ${id}`);
    return this.worldSim.updateSpawnRule(id, updates);
  }

  /**
   * === АКТИВНЫЕ СУЩНОСТИ (MONITOR / GM COMMANDS) ===
   */

  @Get('active-entities')
  listActiveEntities(): ActiveWorldEntity[] {
    return this.worldSim.listActiveEntities();
  }

  @Post('active-entities/:id/kill')
  killEntity(@Param('id') id: string): { success: boolean } {
    this.logger.log(`Kill entity: ${id}`);
    const success = this.worldSim.killEntity(id);
    return { success };
  }

  @Post('active-entities/:id/freeze')
  freezeEntity(@Param('id') id: string, @Body() body: { durationHours: number }): { success: boolean } {
    this.logger.log(`Freeze entity: ${id} for ${body.durationHours}h`);
    const success = this.worldSim.freezeEntity(id, body.durationHours);
    return { success };
  }

  @Post('active-entities/:id/teleport')
  teleportEntity(
    @Param('id') id: string,
    @Body() body: { zoneId: string; coordinates: { x: number; y: number } },
  ): { success: boolean } {
    this.logger.log(`Teleport entity: ${id} to ${body.zoneId}`);
    const success = this.worldSim.teleportEntity(id, body.zoneId, body.coordinates);
    return { success };
  }

  /**
   * === СНИМОК МИРА (для фронтенда/игрока) ===
   */

  @Get('snapshot')
  getSnapshot() {
    return this.worldSim.getWorldSnapshot();
  }
}
