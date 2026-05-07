import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class OpenLockedSlotDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemInstanceId!: string;

  @IsString()
  @Length(1, 100)
  socketId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  blacksmithTier?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  successRollPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  failureRollPercent?: number;
}
