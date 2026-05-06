import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PvpService } from './pvp.service';

@Controller(['pvp', 'api/pvp'])
export class PvpController {
  constructor(private readonly pvpService: PvpService) {}

  @Get('nearby/:characterId')
  async nearby(@Param('characterId') characterId: string) {
    return this.pvpService.listNearbyPlayers(characterId);
  }

  @Post('challenge')
  async challenge(@Body() payload: { challengerId: string; targetId: string }) {
    return this.pvpService.challengePlayer(payload.challengerId, payload.targetId);
  }
}
