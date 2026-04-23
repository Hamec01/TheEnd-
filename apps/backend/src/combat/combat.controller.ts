import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CombatActionDto } from './dto.combat-action.dto';
import { StartCombatDto } from './dto.start-combat.dto';
import { UseCombatItemDto } from './dto.use-combat-item.dto';
import { CombatService } from './combat.service';

@Controller('combat')
export class CombatController {
  constructor(private readonly combatService: CombatService) {}

  @Post('start')
  async start(@Body() dto: StartCombatDto) {
    return this.combatService.startCombat(dto.characterId, dto.enemyCount ?? 1, dto.customEnemies ?? []);
  }

  @Post('action')
  async action(@Body() dto: CombatActionDto) {
    return this.combatService.resolvePlayerRound(dto.combatId, {
      actorId: dto.actorId,
      targetId: dto.targetId,
      attackZone: dto.attackZone,
      defenseZones: dto.defenseZones,
      attackPointsSpent: dto.attackPointsSpent,
      defensePointsSpent: dto.defensePointsSpent,
      actionType: dto.actionType,
      preferredDistance: dto.preferredDistance,
      destinationX: dto.destinationX,
      destinationY: dto.destinationY,
      skillType: dto.skillType,
    });
  }

  @Post('use-item')
  async useItem(@Body() dto: UseCombatItemDto) {
    return this.combatService.useCombatItem(dto);
  }

  @Get(':combatId')
  state(@Param('combatId') combatId: string) {
    return this.combatService.getCombatState(combatId);
  }
}
