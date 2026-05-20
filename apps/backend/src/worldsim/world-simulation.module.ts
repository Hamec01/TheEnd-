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
    const tickIntervalMs = 1000;
    const devGameSecondsPerRealSecond = 10;
    const prodGameSecondsPerRealSecond = 1;

    setInterval(async () => {
      const gameSecondsPerRealSecond = process.env.NODE_ENV === 'production'
        ? prodGameSecondsPerRealSecond
        : devGameSecondsPerRealSecond;
      const deltaSeconds = (tickIntervalMs / 1000) * gameSecondsPerRealSecond;
      await this.worldSim.tick(deltaSeconds);
    }, tickIntervalMs);
  }
}
