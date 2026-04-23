import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BuyItemDto } from './dto.buy-item.dto';
import { EquipItemDto } from './dto.equip-item.dto';
import { SellItemDto } from './dto.sell-item.dto';
import { UnequipItemDto } from './dto.unequip-item.dto';
import { ArenaService } from './arena.service';

@Controller('arena')
export class ArenaController {
  constructor(private readonly arenaService: ArenaService) {}

  @Get('hub/:characterId')
  getHubState(@Param('characterId') characterId: string) {
    return this.arenaService.getHubState(characterId);
  }

  @Post('buy')
  buy(@Body() dto: BuyItemDto) {
    return this.arenaService.buyItem(dto.characterId, dto.itemId);
  }

  @Post('sell')
  sell(@Body() dto: SellItemDto) {
    return this.arenaService.sellItem(dto.characterId, dto.itemId, dto.quantity ?? 1);
  }

  @Post('equip')
  equip(@Body() dto: EquipItemDto) {
    return this.arenaService.equipItem(dto.characterId, dto.itemId);
  }

  @Post('unequip')
  unequip(@Body() dto: UnequipItemDto) {
    return this.arenaService.unequipItem(dto.characterId, dto.slot);
  }
}
