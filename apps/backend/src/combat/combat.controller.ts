import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { ArenaBattleState } from '@theend/rpg-domain';
import { CombatActionDto } from './dto.combat-action.dto';
import { StartCombatDto } from './dto.start-combat.dto';
import { UseCombatItemDto } from './dto.use-combat-item.dto';
import { CombatService } from './combat.service';

type StartCombatResponse = {
  combatId: string;
  playerId: string;
  state: ArenaBattleState;
};

type UseCombatItemResponse = {
  state: ArenaBattleState;
  inventory: Array<{ itemId: string; quantity: number }>;
  gold: number;
};

@Controller('combat')
export class CombatController {
  constructor(private readonly combatService: CombatService) {}

  @Post('start')
  async start(@Body() dto: StartCombatDto): Promise<StartCombatResponse> {
    return this.combatService.startCombat(dto.characterId, dto.enemyCount ?? 1, dto.customEnemies ?? [], dto.battleMap, dto.blockedTiles ?? []);
  }

  @Post('action')
  async action(@Body() dto: CombatActionDto): Promise<ArenaBattleState> {
    return this.combatService.resolvePlayerRound(dto.combatId, {
      actorId: dto.actorId,
      targetId: dto.targetId,
      attackZone: dto.attackZone,
      defenseZones: dto.defenseZones,
      attackPointsSpent: dto.attackPointsSpent,
      defensePointsSpent: dto.defensePointsSpent,
      actionType: dto.actionType,
      movementType: dto.movementType,
      preferredDistance: dto.preferredDistance,
      destinationX: dto.destinationX,
      destinationY: dto.destinationY,
      skillType: dto.skillType,
    });
  }

  @Post('use-item')
  async useItem(@Body() dto: UseCombatItemDto): Promise<UseCombatItemResponse> {
    return this.combatService.useCombatItem(dto);
  }

  @Get(':combatId')
  state(@Param('combatId') combatId: string): ArenaBattleState {
    return this.combatService.getCombatState(combatId);
  }
}
