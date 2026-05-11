import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { ArenaBattleState, CombatCommand, CombatPlanErrorCode, CombatPlanWarning, CombatPlanWarningCode, CombatTurnPlan } from '@theend/rpg-domain';
import { CombatActionDto } from './dto.combat-action.dto';
import { StartCombatDto } from './dto.start-combat.dto';
import { UseCombatItemDto } from './dto.use-combat-item.dto';
import { CombatService, type CombatActionResult } from './combat.service';

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

type UseCombatItemResponse = {
  state: ArenaBattleState;
  inventory: Array<{ itemId: string; quantity: number }>;
  gold: number;
  actionSlots: Array<{ slotIndex: number; kind: 'skill' | 'item' | 'weapon' | null; refId: string | null; itemInstanceId?: string | null; weaponInstanceId?: string | null }>;
};

type CombatPlanResponse = {
  state: ArenaBattleState;
  plan?: CombatTurnPlan;
};

type ValidateCombatPlanRequest = {
  actorId: string;
  roundNumber: number;
  commands: CombatCommand[];
};

type ValidateCombatPlanResponse = {
  ok: boolean;
  errors: CombatPlanErrorCode[];
  warnings?: CombatPlanWarningCode[];
  warningDetails?: CombatPlanWarning[];
  normalizedCommands?: CombatCommand[];
  total?: {
    commands: number;
    ap: number;
    stamina: number;
    mp: number;
    hp: number;
  };
};

type SubmitCombatPlanRequest = {
  actorId: string;
  roundNumber: number;
  commands: CombatCommand[];
  ready?: boolean;
};

type SubmitCombatPlanResponse = {
  ok: true;
  acceptedPlan: CombatTurnPlan;
  battleState: ArenaBattleState;
  warnings?: CombatPlanWarning[];
};

@Controller(['combat', 'api/combat'])
export class CombatController {
  constructor(private readonly combatService: CombatService) {}

  @Post('start')
  async start(@Body() dto: StartCombatDto): Promise<StartCombatResponse> {
    return this.combatService.startCombat(dto.characterId, dto.enemyCount ?? 1, dto.customEnemies ?? [], dto.battleMap, dto.blockedTiles ?? []);
  }

  @Post('action')
  async action(@Body() dto: CombatActionDto): Promise<CombatActionResult> {
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
      skillId: dto.skillId,
      skillLevel: dto.skillLevel,
      guardMode: dto.guardMode,
    });
  }

  @Post('plan')
  async plan(@Body() dto: { combatId: string; actorId: string; command: CombatCommand }): Promise<CombatPlanResponse> {
    const result = this.combatService.addCombatCommand(dto.combatId, dto.actorId, dto.command);
    return {
      state: await this.combatService.getCombatState(dto.combatId),
      plan: result.plan,
    };
  }

  @Post('clear-plan')
  async clearPlan(@Body() dto: { combatId: string; actorId: string; roundNumber?: number }): Promise<CombatPlanResponse> {
    const plan = await this.combatService.clearCombatCommands(dto.combatId, dto.actorId, dto.roundNumber);
    return { state: await this.combatService.getCombatState(dto.combatId), plan };
  }

  @Post('undo-command')
  async undoCommand(@Body() dto: { combatId: string; actorId: string; roundNumber?: number }): Promise<CombatPlanResponse> {
    const plan = await this.combatService.undoCombatCommand(dto.combatId, dto.actorId, dto.roundNumber);
    return { state: await this.combatService.getCombatState(dto.combatId), plan };
  }

  @Post('ready')
  async ready(@Body() dto: { combatId: string; actorId: string; roundNumber?: number }): Promise<CombatPlanResponse> {
    const plan = await this.combatService.setCombatReady(dto.combatId, dto.actorId, dto.roundNumber);
    return { state: await this.combatService.getCombatState(dto.combatId), plan };
  }

  @Post('cancel-ready')
  async cancelReady(@Body() dto: { combatId: string; actorId: string; roundNumber?: number }): Promise<CombatPlanResponse> {
    const plan = await this.combatService.cancelCombatReady(dto.combatId, dto.actorId, dto.roundNumber);
    return { state: await this.combatService.getCombatState(dto.combatId), plan };
  }

  @Post(':battleId/validate-plan')
  async validatePlan(
    @Param('battleId') battleId: string,
    @Body() dto: ValidateCombatPlanRequest,
  ): Promise<ValidateCombatPlanResponse> {
    return this.combatService.validateCombatPlan(battleId, dto);
  }

  @Post(':battleId/submit-plan')
  async submitPlan(
    @Param('battleId') battleId: string,
    @Body() dto: SubmitCombatPlanRequest,
  ): Promise<SubmitCombatPlanResponse | CombatApiErrorResponse> {
    return this.combatService.submitCombatPlanV2(battleId, dto);
  }

  @Post('use-item')
  async useItem(@Body() dto: UseCombatItemDto): Promise<UseCombatItemResponse> {
    return this.combatService.useCombatItem(dto);
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
