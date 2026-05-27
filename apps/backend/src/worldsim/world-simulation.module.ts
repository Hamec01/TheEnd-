import { Module, OnModuleInit } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { WorldSimulationService } from './world-simulation.service';
import { WorldSimulationController } from './world-simulation.controller';

/**
 * Модуль симуляции живого мира.
 * Управляет активными сущностями, маршрутами, экономикой городов.
 */
@Module({
  imports: [ContentModule],
  controllers: [WorldSimulationController],
  providers: [WorldSimulationService],
  exports: [WorldSimulationService],
})
export class WorldSimulationModule implements OnModuleInit {
  constructor(private readonly worldSim: WorldSimulationService) {}

  async onModuleInit(): Promise<void> {
    await this.worldSim.initializeSimulation();

    // Запустить тиковый воркер для симуляции.
    // Двигаем мир маленькими шагами, чтобы перемещение было видно игроку на карте,
    // а не происходило телепортом между waypoint-ами.
    const tickIntervalMs = 250;
    const gameSecondsPerRealSecond = 1;
    let lastTickAt = Date.now();

    setInterval(async () => {
      const now = Date.now();
      const elapsedSeconds = Math.max(0, (now - lastTickAt) / 1000);
      lastTickAt = now;
      const deltaSeconds = elapsedSeconds * gameSecondsPerRealSecond;
      await this.worldSim.tick(deltaSeconds);
    }, tickIntervalMs);
  }
}
