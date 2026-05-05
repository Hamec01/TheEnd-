import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ArenaService } from './arena.service';
import { UpdateActionSlotsDto } from './dto.update-action-slots.dto';
import { UpdateCharacterResourcesDto } from './dto.update-character-resources.dto';
import { UpdateHotbarDto } from './dto.update-hotbar.dto';

@Controller('characters/:characterId')
export class CharacterRuntimeController {
  constructor(private readonly arenaService: ArenaService) {}

  @Get('action-slots')
  async getActionSlots(@Param('characterId') characterId: string) {
    return this.arenaService.getOrCreateActionSlots(characterId);
  }

  @Patch('action-slots')
  async updateActionSlots(@Param('characterId') characterId: string, @Body() dto: UpdateActionSlotsDto) {
    return this.arenaService.updateActionSlots(
      characterId,
      (dto.slots ?? []).map((slot) => ({
        slotId: slot.slotId ?? null,
        slotIndex: slot.slotIndex,
        kind: slot.kind ?? null,
        refId: slot.refId ?? null,
        itemInstanceId: slot.itemInstanceId ?? null,
      })),
    );
  }

  @Get('hotbar')
  async getHotbar(@Param('characterId') characterId: string) {
    return this.arenaService.getOrCreateHotbar(characterId);
  }

  @Patch('hotbar')
  async updateHotbar(@Param('characterId') characterId: string, @Body() dto: UpdateHotbarDto) {
    return this.arenaService.updateHotbar(
      characterId,
      (dto.slots ?? []).map((slot) => ({
        slotIndex: slot.slotIndex,
        itemId: slot.itemId ?? null,
        itemInstanceId: slot.itemInstanceId ?? null,
      })),
    );
  }

  @Get('resources')
  async getResources(@Param('characterId') characterId: string) {
    return this.arenaService.getCharacterResources(characterId);
  }

  @Patch('resources')
  async updateResources(
    @Param('characterId') characterId: string,
    @Body() dto: UpdateCharacterResourcesDto,
  ) {
    return this.arenaService.updateCharacterResources(characterId, dto);
  }
}