import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BuyItemDto } from './dto.buy-item.dto';
import { EquipItemDto } from './dto.equip-item.dto';
import { SellItemDto } from './dto.sell-item.dto';
import { SocketAugmentDto } from './dto.socket-augment.dto';
import { UnequipItemDto } from './dto.unequip-item.dto';
import { UnsocketAugmentDto } from './dto.unsocket-augment.dto';
import { UseItemDto } from './dto.use-item.dto';
import { ArenaService } from './arena.service';

@Controller(['arena', 'api/arena'])
export class ArenaController {
  constructor(private readonly arenaService: ArenaService) {}

  @Get('hub/:characterId')
  getHubState(@Param('characterId') characterId: string) {
    return this.arenaService.getHubState(characterId);
  }

  @Get('merchant-stock/:characterId/:merchantId')
  getMerchantStock(
    @Param('characterId') characterId: string,
    @Param('merchantId') merchantId: string,
  ) {
    return this.arenaService.getMerchantStock(characterId, merchantId);
  }

  @Post('buy')
  buy(@Body() dto: BuyItemDto) {
    return this.arenaService.buyItem(dto.characterId, dto.itemId, dto.merchantId, dto.quantity ?? 1);
  }

  @Post('sell')
  sell(@Body() dto: SellItemDto) {
    return this.arenaService.sellItem(dto.characterId, dto.itemId, dto.quantity ?? 1);
  }

  @Post('equip')
  equip(@Body() dto: EquipItemDto) {
    return this.arenaService.equipItem(dto.characterId, dto.itemId, dto.slot);
  }

  @Post('unequip')
  unequip(@Body() dto: UnequipItemDto) {
    return this.arenaService.unequipItem(dto.characterId, dto.slot);
  }

  @Post('use-item')
  useItem(@Body() dto: UseItemDto) {
    return this.arenaService.useItem(dto.characterId, dto.itemId);
  }

  @Post('socket-augment')
  socketAugment(@Body() dto: SocketAugmentDto) {
    return this.arenaService.socketAugment(
      dto.characterId,
      dto.itemInstanceId,
      dto.socketId,
      dto.augmentItemId,
    );
  }

  @Post('unsocket-augment')
  unsocketAugment(@Body() dto: UnsocketAugmentDto) {
    return this.arenaService.unsocketAugment(
      dto.characterId,
      dto.itemInstanceId,
      dto.socketId,
    );
  }
}
