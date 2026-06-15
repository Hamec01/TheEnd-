import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { ArenaBattleState, CombatCommand, CombatEvent } from '@theend/rpg-domain';
import { ExecuteCombatActionDto } from './dto.execute-action.dto';
import { StartCombatDto } from './dto.start-combat.dto';
import { CombatService } from './combat.service';

type CombatApiErrorResponse = {
  ok: false;
  errorCode: string;
  message: string;
  details?: unknown;
};

type GetCombatStateResponse = {
  ok: true;
  battleState: ArenaBattleState;
};

type StartCombatResponse = {
  combatId: string;
  playerId: string;
  state: ArenaBattleState;
};

@Controller(['combat', 'api/combat'])
export class CombatController {
  constructor(private readonly combatService: CombatService) {}

  @Post('start')
  async start(@Body() dto: StartCombatDto): Promise<StartCombatResponse> {
    return this.combatService.startCombat(dto.characterId, dto.enemyCount ?? 1, dto.customEnemies ?? [], dto.battleMap, dto.blockedTiles ?? [], dto.battleContext);
  }

  @Post(':battleId/action')
  async executeAction(
    @Param('battleId') battleId: string,
    @Body() dto: ExecuteCombatActionDto,
  ): Promise<{ ok: true; battleState: ArenaBattleState; events: CombatEvent[] } | CombatApiErrorResponse> {
    return this.combatService.executeSequentialAction({
      battleId,
      actorId: dto.actorId,
      roundNumber: dto.roundNumber,
      command: dto.command as unknown as CombatCommand,
    });
  }

  @Get(':combatId')
  async state(@Param('combatId') combatId: string): Promise<ArenaBattleState> {
    return this.combatService.getCombatState(combatId);
  }

  @Get(':battleId/state')
  async stateV2(@Param('battleId') battleId: string): Promise<GetCombatStateResponse | CombatApiErrorResponse> {
    try {
      const battleState = await this.combatService.getCombatState(battleId);
      return { ok: true, battleState };
    } catch (error) {
      return { ok: false, errorCode: 'BATTLE_NOT_FOUND', message: (error as Error).message };
    }
  }
}
