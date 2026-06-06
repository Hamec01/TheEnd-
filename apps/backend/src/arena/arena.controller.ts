import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BuyItemDto } from './dto.buy-item.dto';
import { DeleteItemInstanceDto } from './dto.delete-item-instance.dto';
import { EquipItemDto } from './dto.equip-item.dto';
import { EquipItemInstanceDto } from './dto.equip-item-instance.dto';
import { SellItemDto } from './dto.sell-item.dto';
import { SocketAugmentDto } from './dto.socket-augment.dto';
import { SyncItemInstanceDto } from './dto.sync-item-instance.dto';
import { UnequipItemDto } from './dto.unequip-item.dto';
import { UnequipItemInstanceDto } from './dto.unequip-item-instance.dto';
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

  @Post('equip-instance')
  equipInstance(@Body() dto: EquipItemInstanceDto) {
    return this.arenaService.equipItemInstance(dto.characterId, dto.itemInstanceId, dto.slot);
  }

  @Post('unequip')
  unequip(@Body() dto: UnequipItemDto) {
    return this.arenaService.unequipItem(dto.characterId, dto.slot);
  }

  @Post('unequip-instance')
  unequipInstance(@Body() dto: UnequipItemInstanceDto) {
    return this.arenaService.unequipItemInstance(dto.characterId, dto.itemInstanceId);
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

  @Post('sync-item-instance')
  syncItemInstance(@Body() dto: SyncItemInstanceDto) {
    return this.arenaService.upsertCharacterItemInstance({
      characterId: dto.characterId,
      itemId: dto.itemId,
      itemInstanceId: dto.itemInstanceId,
      state: (dto.state ?? null) as any,
    });
  }

  @Post('delete-item-instance')
  async deleteItemInstance(@Body() dto: DeleteItemInstanceDto) {
    await this.arenaService.deleteCharacterItemInstance(dto.characterId, dto.itemId, dto.itemInstanceId);
    return { ok: true };
  }
}
