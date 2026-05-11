import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';

class ActionSlotDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  slotIndex?: number;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  slotId?: string;

  @IsOptional()
  @IsIn(['skill', 'item', 'weapon', null])
  kind?: 'skill' | 'item' | 'weapon' | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  refId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  itemInstanceId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  weaponInstanceId?: string | null;
}

export class UpdateActionSlotsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionSlotDto)
  slots!: ActionSlotDto[];
}