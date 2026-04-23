import { Body, Controller, Get, Param, Post, Patch, Query } from '@nestjs/common';
import { CreateCharacterDto } from './dto.create-character.dto';
import { AllocateStatsDto } from './dto.allocate-stats.dto';
import { CharactersService } from './characters.service';

@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Post()
  create(
    @Query('accountId') accountId: string | undefined,
    @Body() dto: CreateCharacterDto,
  ) {
    return this.charactersService.createCharacter(accountId, dto);
  }

  @Get()
  list(@Query('accountId') accountId: string) {
    return this.charactersService.listForAccount(accountId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.charactersService.getById(id);
  }

  @Patch(':id/allocate-stats')
  allocateStats(
    @Param('id') id: string,
    @Body() dto: AllocateStatsDto,
  ) {
    return this.charactersService.allocateStats(id, dto);
  }
}
