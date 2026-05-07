import { Body, Controller, Post } from '@nestjs/common';
import { AddAugmentSlotDto } from './dto/add-augment-slot.dto';
import { OpenLockedSlotDto } from './dto/open-locked-slot.dto';
import { BlacksmithService } from './blacksmith.service';

@Controller(['blacksmith', 'api/blacksmith'])
export class BlacksmithController {
  constructor(private readonly blacksmithService: BlacksmithService) {}

  @Post('open-locked-slot')
  async openLockedSlot(@Body() payload: OpenLockedSlotDto) {
    return this.blacksmithService.openLockedSlot(
      payload.characterId,
      payload.itemInstanceId,
      payload.socketId,
      {
        blacksmithTier: payload.blacksmithTier,
        successRollPercent: payload.successRollPercent,
        failureRollPercent: payload.failureRollPercent,
      },
    );
  }

  @Post('add-augment-slot')
  async addAugmentSlot(@Body() payload: AddAugmentSlotDto) {
    return this.blacksmithService.addAugmentSlot(
      payload.characterId,
      payload.itemInstanceId,
      {
        blacksmithTier: payload.blacksmithTier,
        successRollPercent: payload.successRollPercent,
        failureRollPercent: payload.failureRollPercent,
      },
    );
  }
}
