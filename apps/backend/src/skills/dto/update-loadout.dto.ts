import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateLoadoutSlotDto {
  @IsInt()
  @Min(0)
  slotIndex!: number;

  @IsOptional()
  @IsString()
  skillId!: string | null;
}

export class UpdateLoadoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateLoadoutSlotDto)
  slots!: UpdateLoadoutSlotDto[];
}
