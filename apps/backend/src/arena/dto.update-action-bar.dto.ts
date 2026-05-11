import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';

class ActionBarSlotDto {
  @IsString()
  @Length(1, 20)
  slotId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9)
  order?: number;

  @IsIn(['skill', 'item', 'weapon', 'empty'])
  entryKind!: 'skill' | 'item' | 'weapon' | 'empty';

  @IsOptional()
  @IsString()
  @Length(1, 120)
  skillId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  itemId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  itemInstanceId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  weaponItemId?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  weaponInstanceId?: string | null;
}

export class UpdateActionBarDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionBarSlotDto)
  slots!: ActionBarSlotDto[];
}