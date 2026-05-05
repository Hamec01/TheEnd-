import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';

class HotbarSlotDto {
  @IsInt()
  @Min(0)
  @Max(9)
  slotIndex!: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  itemId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  itemInstanceId?: string | null;
}

export class UpdateHotbarDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HotbarSlotDto)
  slots!: HotbarSlotDto[];
}